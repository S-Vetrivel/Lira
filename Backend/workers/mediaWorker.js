const { Worker } = require("bullmq");
const mongoose = require("mongoose");
const { connection } = require("../services/queue");
const sharp = require("sharp");
const ffmpeg = require("fluent-ffmpeg");
const path = require("path");
const fs = require("fs");

// 1. DISABLE SHARP CACHE (Critical Fix)
// This prevents sharp from holding onto the file handle,
// allowing fs.unlinkSync to actually delete the file without creating .fuse_hidden artifacts.
sharp.cache(false);

// Import models
require("../models/galleryModel");
require("../models/userModel");

const worker = new Worker(
  "media-processing",
  async (job) => {
    const { fileId, filePath, mimeType, outputDir, modelName, fieldName } =
      job.data;

    console.log(`[Worker] Processing ${modelName} ID: ${fileId}`);

    // Resolve absolute path to be safe
    const absoluteFilePath = path.resolve(filePath);

    // Check if input file exists before starting
    if (!fs.existsSync(absoluteFilePath)) {
      console.error(`[Job Failed] Input file missing: ${absoluteFilePath}`);
      const Model = mongoose.model(modelName);
      if (Model) await Model.findByIdAndUpdate(fileId, { status: "failed" });
      return;
    }

    const originalName = path.parse(filePath).name;
    const timestamp = Date.now();
    let finalPath = "";
    let relativeUrl = "";

    try {
      // 2. --- PROCESSING ---
      if (mimeType.startsWith("image/")) {
        const finalFilename = `${originalName}-${timestamp}.webp`;
        finalPath = path.join(outputDir, finalFilename);

        // Process image
        await sharp(absoluteFilePath).webp({ quality: 80 }).toFile(finalPath);
      } else if (mimeType.startsWith("video/")) {
        const finalFilename = `${originalName}-${timestamp}.webm`;
        finalPath = path.join(outputDir, finalFilename);

        await new Promise((resolve, reject) => {
          ffmpeg(absoluteFilePath)
            .output(finalPath)
            .withVideoCodec("libvpx-vp9")
            .withAudioCodec("libvorbis")
            .on("end", resolve)
            .on("error", reject)
            .run();
        });
      }

      // 3. --- DB UPDATE ---
      // We only update the DB if processing succeeded
      relativeUrl = `/uploads/${path.basename(finalPath)}`;

      const Model = mongoose.model(modelName);
      if (!Model) throw new Error(`Model ${modelName} not found`);

      const updateData = { status: "completed" };
      updateData[fieldName] = relativeUrl;

      await Model.findByIdAndUpdate(fileId, updateData);
      console.log(`[Success] Updated ${modelName} ${fileId}`);

      // 4. --- CLEANUP (Delete Raw File) ---
      // Now that sharp.cache(false) is set, this will permanently delete the file
      // without creating .fuse_hidden ghosts.
      if (fs.existsSync(absoluteFilePath)) {
        fs.unlinkSync(absoluteFilePath);
        console.log(`[Cleanup] Deleted raw file: ${absoluteFilePath}`);
      }

      return relativeUrl;
    } catch (error) {
      console.error(`[Job Failed] ${error.message}`);

      // Mark DB as failed
      const Model = mongoose.model(modelName);
      if (Model) {
        await Model.findByIdAndUpdate(fileId, { status: "failed" });
      }

      // NOTE: We do NOT delete the file on error, so you can retry the job if needed.
      throw error;
    }
  },
  { connection }
);

console.log("Media Worker started...");
