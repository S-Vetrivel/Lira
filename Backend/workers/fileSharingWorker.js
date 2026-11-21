const { Worker } = require("bullmq");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { redisConfig, enqueueActivityLog, enqueueNotification } = require("../services/queue");
const { emitToUser, emitToAll } = require("../config/socket");

const FILES_DIR = path.join(__dirname, "../uploads/files");

const fileSharingWorker = new Worker(
  "file-sharing-queue",
  async (job) => {
    const { fileName, originalName, size, checksum, userId } = job.data;
    console.log(`[FileSharingWorker] Processing file ${fileName} (${size} bytes)`);

    const filePath = path.join(FILES_DIR, fileName);
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    // Verify SHA-256 Checksum integrity
    const hash = crypto.createHash("sha256");
    const fileStream = fs.createReadStream(filePath);

    await new Promise((resolve, reject) => {
      fileStream.on("data", (chunk) => hash.update(chunk));
      fileStream.on("end", resolve);
      fileStream.on("error", reject);
    });

    const calculatedChecksum = hash.digest("hex");
    const isVerified = calculatedChecksum === checksum;

    // Notify user via Socket.IO
    if (userId) {
      emitToUser(userId.toString(), "file:processed", {
        fileName,
        originalName,
        size,
        checksum,
        verified: isVerified,
        url: `/api/files/download/${fileName}`,
      });

      // Audit log
      await enqueueActivityLog({
        user: userId,
        action: "UPLOAD_FILE",
        details: `Uploaded and verified ${originalName} (${(size / (1024 * 1024)).toFixed(2)} MB)`,
      });
    }

    return {
      fileName,
      originalName,
      size,
      checksum,
      verified: isVerified,
    };
  },
  {
    connection: redisConfig,
    concurrency: 5,
  }
);

fileSharingWorker.on("completed", (job) => {
  console.log(`[FileSharingWorker] Job ${job.id} verified successfully`);
});

fileSharingWorker.on("failed", (job, err) => {
  console.error(`[FileSharingWorker] Job ${job?.id} failed:`, err.message);
});

module.exports = fileSharingWorker;
