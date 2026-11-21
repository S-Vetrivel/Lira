const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { enqueueFileJob } = require("../services/queue");

const CHUNKS_DIR = path.join(__dirname, "../uploads/chunks");
const FILES_DIR = path.join(__dirname, "../uploads/files");

if (!fs.existsSync(CHUNKS_DIR)) fs.mkdirSync(CHUNKS_DIR, { recursive: true });
if (!fs.existsSync(FILES_DIR)) fs.mkdirSync(FILES_DIR, { recursive: true });

// 1. Upload a single chunk with bandwidth throttling support
exports.uploadChunk = async (req, res) => {
  try {
    const { uploadId, chunkIndex, totalChunks, fileName, fileSize, speedLimitKbps } = req.body;
    const file = req.file;

    if (!uploadId || chunkIndex === undefined || !totalChunks || !file) {
      return res.status(400).json({ success: false, message: "Missing required chunk parameters" });
    }

    const cIndex = parseInt(chunkIndex, 10);
    const tChunks = parseInt(totalChunks, 10);
    const uploadPath = path.join(CHUNKS_DIR, uploadId);

    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }

    const chunkFilePath = path.join(uploadPath, `part_${cIndex}`);
    fs.renameSync(file.path, chunkFilePath);

    // Bandwidth throttling simulation / rate-limiting delay
    // If speedLimitKbps > 0, throttle response time based on chunk size
    const limitKbps = parseInt(speedLimitKbps, 10) || 0;
    if (limitKbps > 0) {
      const chunkSizeKb = file.size / 1024;
      const expectedDelayMs = Math.min(2000, Math.round((chunkSizeKb / limitKbps) * 1000));
      if (expectedDelayMs > 10) {
        await new Promise((resolve) => setTimeout(resolve, expectedDelayMs));
      }
    }

    // Check if all chunks have arrived
    const uploadedParts = fs.readdirSync(uploadPath).filter((f) => f.startsWith("part_"));

    if (uploadedParts.length === tChunks) {
      // Assemble all chunks into final file
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

      // Clean up chunk files
      fs.rmSync(uploadPath, { recursive: true, force: true });

      // Enqueue background processing (virus scan/caching/audit)
      try {
        if (typeof enqueueFileJob === "function") {
          await enqueueFileJob({
            fileName: safeName,
            originalName: fileName,
            size: stat.size,
            checksum,
            userId: req.user?._id,
          });
        }
      } catch (err) {
        // non-blocking
      }

      const fileUrl = `/api/files/download/${safeName}`;

      return res.status(200).json({
        success: true,
        completed: true,
        fileUrl,
        fileName: safeName,
        originalName: fileName,
        size: stat.size,
        checksum,
      });
    }

    res.status(200).json({
      success: true,
      completed: false,
      chunkIndex: cIndex,
      uploadedCount: uploadedParts.length,
      totalChunks: tChunks,
    });
  } catch (error) {
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

// 3. Resumable Byte-Range Chunk Download (RFC 7233)
exports.downloadFile = (req, res) => {
  try {
    const { fileName } = req.params;
    const safeName = path.basename(fileName);
    const filePath = path.join(FILES_DIR, safeName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: "File not found" });
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (start >= fileSize) {
        res.status(416).send(`Requested range not satisfiable: ${start} >= ${fileSize}`);
        return;
      }

      const chunksize = end - start + 1;
      const file = fs.createReadStream(filePath, { start, end });
      const head = {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunksize,
        "Content-Type": "application/octet-stream",
      };

      res.writeHead(206, head);
      file.pipe(res);
    } else {
      const head = {
        "Content-Length": fileSize,
        "Content-Type": "application/octet-stream",
        "Accept-Ranges": "bytes",
        "Content-Disposition": `attachment; filename="${safeName}"`,
      };
      res.writeHead(200, head);
      fs.createReadStream(filePath).pipe(res);
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
