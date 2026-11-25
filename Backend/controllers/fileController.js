const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { Transform } = require("stream");
const { enqueueFileJob } = require("../services/queue");
const minioService = require("../services/minioService");

const CHUNKS_DIR = path.join(__dirname, "../uploads/chunks");
const FILES_DIR = path.join(__dirname, "../uploads/files");

if (!fs.existsSync(CHUNKS_DIR)) fs.mkdirSync(CHUNKS_DIR, { recursive: true });
if (!fs.existsSync(FILES_DIR)) fs.mkdirSync(FILES_DIR, { recursive: true });

// Server-wide total transfer bandwidth pool (KB/s), shared evenly across active transfers
const MAX_SERVER_BANDWIDTH_KBPS = Math.max(
  256,
  parseInt(process.env.MAX_TRANSFER_BANDWIDTH_KBPS || "10240", 10)
);
const activeTransfers = new Map(); // transferKey -> lastSeenTimestamp

function pruneStaleTransfers() {
  const cutoff = Date.now() - 15000;
  for (const [key, ts] of activeTransfers.entries()) {
    if (ts < cutoff) activeTransfers.delete(key);
  }
}

function getFairShareKbps(transferKey) {
  pruneStaleTransfers();
  activeTransfers.set(transferKey, Date.now());
  const concurrentCount = Math.max(1, activeTransfers.size);
  return {
    allocatedKbps: Math.max(64, Math.floor(MAX_SERVER_BANDWIDTH_KBPS / concurrentCount)),
    concurrentCount,
    serverPoolKbps: MAX_SERVER_BANDWIDTH_KBPS,
  };
}

function releaseTransfer(transferKey) {
  activeTransfers.delete(transferKey);
}

// Create a throttle transform stream to pace downloads fairly
function createThrottleStream(kbps) {
  const bytesPerSecond = Math.max(64 * 1024, kbps * 1024);
  let startTime = Date.now();
  let bytesSent = 0;

  return new Transform({
    transform(chunk, encoding, callback) {
      bytesSent += chunk.length;
      const elapsedSec = (Date.now() - startTime) / 1000;
      const expectedSec = bytesSent / bytesPerSecond;
      const delayMs = Math.max(0, Math.round((expectedSec - elapsedSec) * 1000));

      if (delayMs > 5) {
        setTimeout(() => callback(null, chunk), Math.min(delayMs, 1000));
      } else {
        callback(null, chunk);
      }
    },
  });
}

// 1. Upload a single chunk with server-enforced fair-share bandwidth allocation
exports.uploadChunk = async (req, res) => {
  const { uploadId, chunkIndex, totalChunks, fileName, mimeType } = req.body;
  const transferKey = `up_${uploadId || req.user?._id || req.ip}`;

  try {
    const file = req.file;
    if (!uploadId || chunkIndex === undefined || !totalChunks || !file) {
      return res.status(400).json({ success: false, message: "Missing required file parameters" });
    }

    const cIndex = parseInt(chunkIndex, 10);
    const tChunks = parseInt(totalChunks, 10);
    const uploadPath = path.join(CHUNKS_DIR, uploadId);

    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }

    const chunkFilePath = path.join(uploadPath, `part_${cIndex}`);
    fs.renameSync(file.path, chunkFilePath);

    // Enforce server-side shared bandwidth evenly across all active transfers
    const { allocatedKbps, concurrentCount } = getFairShareKbps(transferKey);
    const chunkSizeKb = file.size / 1024;
    const targetDelayMs = Math.round((chunkSizeKb / allocatedKbps) * 1000);
    if (targetDelayMs > 10) {
      await new Promise((resolve) => setTimeout(resolve, Math.min(targetDelayMs, 2000)));
    }

    const uploadedParts = fs.readdirSync(uploadPath).filter((f) => f.startsWith("part_"));

    if (uploadedParts.length === tChunks) {
      const safeName = `${Date.now()}_${(fileName || "document").replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const finalFilePath = path.join(FILES_DIR, safeName);
      const writeStream = fs.createWriteStream(finalFilePath);
      const hash = crypto.createHash("sha256");

      for (let i = 0; i < tChunks; i++) {
        const partFile = path.join(uploadPath, `part_${i}`);
        if (fs.existsSync(partFile)) {
          const buffer = fs.readFileSync(partFile);
          hash.update(buffer);
          writeStream.write(buffer);
        }
      }
      writeStream.end();

      await new Promise((resolve, reject) => {
        writeStream.on("finish", resolve);
        writeStream.on("error", reject);
      });

      const checksum = hash.digest("hex");
      const stat = fs.statSync(finalFilePath);

      fs.rmSync(uploadPath, { recursive: true, force: true });
      releaseTransfer(transferKey);

      let minioResult = null;
      try {
        minioResult = await minioService.uploadFile(`files/${safeName}`, finalFilePath);
      } catch (minioErr) {
        // Fallback to local storage silently
      }

      try {
        if (typeof enqueueFileJob === "function") {
          await enqueueFileJob({
            fileName: safeName,
            originalName: fileName,
            size: stat.size,
            checksum,
            userId: req.user?._id,
            minioKey: minioResult?.objectKey || null,
          });
        }
      } catch (err) {
        // non-blocking
      }

      const fileUrl = `/v3/files/download/${safeName}`;

      return res.status(200).json({
        success: true,
        completed: true,
        fileUrl,
        fileName: safeName,
        originalName: fileName,
        size: stat.size,
        mimetype: mimeType || "application/octet-stream",
        checksum,
        allocatedKbps,
        concurrentCount,
      });
    }

    res.status(200).json({
      success: true,
      completed: false,
      chunkIndex: cIndex,
      uploadedCount: uploadedParts.length,
      totalChunks: tChunks,
      allocatedKbps,
      concurrentCount,
    });
  } catch (error) {
    releaseTransfer(transferKey);
    console.error("Chunk upload error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 2. Query status of uploaded chunks for instant resume
exports.getChunkStatus = async (req, res) => {
  try {
    const { uploadId } = req.params;
    const uploadPath = path.join(CHUNKS_DIR, uploadId);

    if (!fs.existsSync(uploadPath)) {
      return res.status(200).json({ success: true, uploadedChunks: [], totalUploaded: 0 });
    }

    const parts = fs
      .readdirSync(uploadPath)
      .filter((f) => f.startsWith("part_"))
      .map((f) => parseInt(f.replace("part_", ""), 10))
      .sort((a, b) => a - b);

    res.status(200).json({
      success: true,
      uploadedChunks: parts,
      totalUploaded: parts.length,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 3. Fair-Share Bandwidth Throttled File Download
exports.downloadFile = async (req, res) => {
  const { fileName } = req.params;
  const safeName = path.basename(fileName);
  const transferKey = `dl_${safeName}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  try {
    const filePath = path.join(FILES_DIR, safeName);
    const { allocatedKbps } = getFairShareKbps(transferKey);
    const throttle = createThrottleStream(allocatedKbps);

    res.on("close", () => releaseTransfer(transferKey));
    res.on("finish", () => releaseTransfer(transferKey));

    if (fs.existsSync(filePath)) {
      const stat = fs.statSync(filePath);
      const fileSize = stat.size;
      const range = req.headers.range;

      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

        if (start >= fileSize) {
          releaseTransfer(transferKey);
          res.status(416).send(`Requested range not satisfiable: ${start} >= ${fileSize}`);
          return;
        }

        const chunksize = end - start + 1;
        const file = fs.createReadStream(filePath, { start, end });
        res.writeHead(206, {
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunksize,
          "Content-Type": "application/octet-stream",
        });
        file.pipe(throttle).pipe(res);
      } else {
        res.writeHead(200, {
          "Content-Length": fileSize,
          "Content-Type": "application/octet-stream",
          "Accept-Ranges": "bytes",
          "Content-Disposition": `attachment; filename="${safeName}"`,
        });
        fs.createReadStream(filePath).pipe(throttle).pipe(res);
      }
      return;
    }

    const minioStream = await minioService.getFileStream(`files/${safeName}`);
    if (minioStream) {
      res.setHeader("Content-Disposition", `attachment; filename="${safeName}"`);
      res.setHeader("Content-Type", "application/octet-stream");
      return minioStream.pipe(throttle).pipe(res);
    }

    releaseTransfer(transferKey);
    return res.status(404).json({ success: false, message: "File not found" });
  } catch (error) {
    releaseTransfer(transferKey);
    res.status(500).json({ success: false, message: error.message });
  }
};
