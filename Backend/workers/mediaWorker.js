const { Worker } = require("bullmq");
const { connection } = require("../services/queue"); // Reuse Redis connection
const sharp = require("sharp");
const ffmpeg = require("fluent-ffmpeg");
const path = require("path");
const fs = require("fs");

// Helper to update your database (Mock function)
async function updateDatabaseStatus(fileId, status, finalPath) {
  console.log(
    `[DB UPDATE] File ${fileId} is now ${status}. Path: ${finalPath}`
  );
  // In real app: await MediaModel.findByIdAndUpdate(fileId, { status, url: finalPath });
}

// 3. Define the Worker
const worker = new Worker(
  "media-processing",
  async (job) => {
    const { filePath, mimeType, outputDir, fileId } = job.data;

    console.log(`Processing Job ${job.id} for file: ${filePath}`);

    const originalName = path.parse(filePath).name;
    const timestamp = Date.now();

    try {
      // --- IMAGE PROCESSING ---
      if (mimeType.startsWith("image/")) {
        const finalFilename = `${originalName}-${timestamp}.webp`;
        const finalPath = path.join(outputDir, finalFilename);

        await sharp(filePath).webp({ quality: 80 }).toFile(finalPath);

        // Cleanup Raw File
        fs.unlinkSync(filePath);

        // Notify System
        await updateDatabaseStatus(fileId, "COMPLETED", finalPath);
        return finalPath;
      }

      // --- VIDEO PROCESSING ---
      else if (mimeType.startsWith("video/")) {
        const finalFilename = `${originalName}-${timestamp}.webm`;
        const finalPath = path.join(outputDir, finalFilename);

        return new Promise((resolve, reject) => {
          ffmpeg(filePath)
            .output(finalPath)
            .withVideoCodec("libvpx-vp9")
            .withAudioCodec("libvorbis")
            .on("end", async () => {
              fs.unlinkSync(filePath); // Cleanup
              await updateDatabaseStatus(fileId, "COMPLETED", finalPath);
              resolve(finalPath);
            })
            .on("error", (err) => {
              reject(err);
            })
            .run();
        });
      }
    } catch (error) {
      console.error(`Job ${job.id} failed:`, error);
      await updateDatabaseStatus(fileId, "FAILED", null);
      throw error; // Triggers BullMQ retry logic
    }
  },
  { connection }
);

console.log("Worker is running and listening for jobs...");
