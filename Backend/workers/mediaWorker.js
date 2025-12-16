const { Worker } = require("bullmq");
const mongoose = require("mongoose");
const { connection } = require("../services/queue");
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

// Disable Sharp cache to allow file deletion on Windows/Linux
sharp.cache(false);

// Import Models
require("../models/galleryModel");
require("../models/userModel");

const worker = new Worker(
  "media-processing",
  async (job) => {
    const { fileId, filePath, mimeType, outputDir, modelName, fieldName } =
      job.data;

    console.log(`[Worker] Processing ${modelName} ID: ${fileId}`);

    const absoluteFilePath = path.resolve(filePath);

    // 1. Safety Check: Ensure Input File Exists
    if (!fs.existsSync(absoluteFilePath)) {
      console.error(`[Job Failed] Input file missing: ${absoluteFilePath}`);
      return;
    }

    const originalName = path.parse(filePath).name;
    const timestamp = Date.now();
    let finalPath = "";
    let relativeUrl = "";

    try {
      // 2. --- PROCESSING (Resize & Compress) ---
      if (mimeType.startsWith("image/")) {
        // Create new filename (e.g. profile-12345.webp)
        const finalFilename = `${originalName}-${timestamp}.webp`;
        finalPath = path.join(outputDir, finalFilename);

        let pipeline = sharp(absoluteFilePath);

        // Specific Logic for User Avatars (Resize to 500x500)
        if (modelName === "User") {
          pipeline = pipeline.resize(500, 500, {
            fit: "cover",
            position: "center",
          });
        }

        // Convert to WebP
        await pipeline.webp({ quality: 80 }).toFile(finalPath);
      }

      // 3. --- DELETE OLD AVATAR (Cleanup Logic) ---
      relativeUrl = `/uploads/${path.basename(finalPath)}`;
      const Model = mongoose.model(modelName);

      // Fetch the document to see if there is an OLD image
      const document = await Model.findById(fileId);

      if (document) {
        // Check if field exists (e.g. user.profilePicture)
        const oldRelativePath = document[fieldName];

        // Only delete if it's a local file in /uploads/ (ignore Google/External URLs)
        if (oldRelativePath && oldRelativePath.startsWith("/uploads/")) {
          const oldAbsolutePath = path.join(__dirname, "..", oldRelativePath);

          if (fs.existsSync(oldAbsolutePath)) {
            try {
              fs.unlinkSync(oldAbsolutePath);
              console.log(`[Cleanup] Deleted old file: ${oldAbsolutePath}`);
            } catch (err) {
              console.error(
                `[Cleanup Error] Could not delete ${oldAbsolutePath}`,
                err
              );
            }
          }
        }
      }

      // 4. --- UPDATE DATABASE ---
      const updateData = {};
      updateData[fieldName] = relativeUrl;

      // If it's a Gallery item, mark as completed
      if (modelName === "Gallery") {
        updateData.status = "completed";
      }

      await Model.findByIdAndUpdate(fileId, updateData);
      console.log(`[Success] Updated ${modelName} ${fileId}`);

      // 5. --- DELETE RAW UPLOADED FILE ---
      // We are done with the raw file Multer created
      if (fs.existsSync(absoluteFilePath)) {
        fs.unlinkSync(absoluteFilePath);
      }

      return relativeUrl;
    } catch (error) {
      console.error(`[Job Failed] ${error.message}`);

      // Mark as failed if Gallery
      if (modelName === "Gallery") {
        const Model = mongoose.model("Gallery");
        await Model.findByIdAndUpdate(fileId, { status: "failed" });
      }
      throw error;
    }
  },
  { connection }
);

console.log("Media Worker started...");
