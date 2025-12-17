const { Worker } = require("bullmq");
const mongoose = require("mongoose");
const { connection } = require("../services/queue");
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

// Disable Sharp cache to prevent file lock issues (Critical for deletion)
sharp.cache(false);

// Import Models
require("../models/galleryModel");
require("../models/userModel");
require("../models/productModel");

const worker = new Worker(
  "media-processing",
  async (job) => {
    const {
      fileId,
      filePath,
      mimeType,
      outputDir,
      modelName,
      fieldName,
      operation,
    } = job.data;

    console.log(`[Worker] Job: ${modelName} (${fileId})`);

    const absoluteFilePath = path.resolve(filePath);

    // --- FIX: WAIT FOR FILE TO EXIST (Handle FS Latency) ---
    let fileExists = false;
    for (let i = 0; i < 6; i++) {
      // Try for 3 seconds (6 * 500ms)
      if (fs.existsSync(absoluteFilePath)) {
        fileExists = true;
        break;
      }
      console.log(`[Worker] Waiting for file... Attempt ${i + 1}`);
      await new Promise((r) => setTimeout(r, 500));
    }

    if (!fileExists) {
      console.error(`[Worker Error] File never appeared: ${absoluteFilePath}`);
      // Mark gallery as failed if applicable
      if (modelName === "Gallery") {
        await mongoose
          .model("Gallery")
          .findByIdAndUpdate(fileId, { status: "failed" });
      }
      return; // Stop here, don't throw (avoids infinite retries of bad jobs)
    }

    // --- ENSURE OUTPUT DIR ---
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const timestamp = Date.now();
    let finalPath = "";
    let relativeUrl = "";

    try {
      // --- IMAGE PROCESSING ---
      if (mimeType.startsWith("image/")) {
        const finalFilename = `${modelName.toLowerCase()}-${fileId}-${timestamp}.webp`;
        finalPath = path.join(outputDir, finalFilename);

        let pipeline = sharp(absoluteFilePath);

        if (modelName === "User") {
          pipeline = pipeline.resize(500, 500, { fit: "cover" });
        } else if (modelName === "Product") {
          pipeline = pipeline.resize(1200, 1200, {
            fit: "inside",
            withoutEnlargement: true,
          });
        } else if (modelName === "Gallery") {
          pipeline = pipeline.resize(1920, 1080, {
            fit: "inside",
            withoutEnlargement: true,
          });
        }

        await pipeline.webp({ quality: 80 }).toFile(finalPath);
      }

      // --- DB UPDATE ---
      // URL relative to server root (e.g. /uploads/file.webp)
      relativeUrl = `/uploads/${path.basename(finalPath)}`;
      const Model = mongoose.model(modelName);

      if (operation === "push") {
        // Array Push (Product Visuals)
        await Model.findByIdAndUpdate(fileId, {
          $push: { [fieldName]: relativeUrl },
        });
      } else {
        // Single Field Set (Gallery/User) + Cleanup Old
        const doc = await Model.findById(fileId);
        if (doc) {
          // If replacing an existing image, delete the old one
          const oldUrl = doc[fieldName];
          if (oldUrl && oldUrl.startsWith("/uploads/")) {
            // Resolve path relative to where worker is running (assuming /workers/..)
            // Adjust "../public" based on your actual folder structure relative to worker file
            const oldPath = path.join(outputDir, path.basename(oldUrl));
            if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
          }
        }

        const updateData = { [fieldName]: relativeUrl };
        if (modelName === "Gallery") updateData.status = "completed";
        await Model.findByIdAndUpdate(fileId, updateData);
      }

      // --- CLEANUP RAW UPLOAD ---
      // We are done with the raw Multer file
      try {
        fs.unlinkSync(absoluteFilePath);
      } catch (e) {
        console.error("Cleanup warning:", e.message);
      }

      console.log(`✅ [Success] ${relativeUrl}`);
      return relativeUrl;
    } catch (error) {
      console.error(`❌ [Worker Failed] ${error.message}`);
      throw error;
    }
  },
  { connection }
);

console.log("Media Worker started...");
