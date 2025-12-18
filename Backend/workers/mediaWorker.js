const { Worker } = require("bullmq");
const mongoose = require("mongoose");
const { connection } = require("../services/queue");
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

// Disable Sharp cache to ensure file handles are released immediately
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
      outputDir, // Expected to be 'public/uploads' or similar
      modelName,
      fieldName,
      operation,
    } = job.data;

    console.log(`[Worker] 🟢 Job started: ${modelName} (${fileId})`);

    // --- 1. RESOLVE INPUT PATH (BULLETPROOF) ---
    // Try to find the file in multiple common locations
    let absoluteInputPath = path.resolve(filePath);

    // Fix: If running from root but file is in Backend/, check there
    if (!fs.existsSync(absoluteInputPath)) {
      const potentialPath = path.join(process.cwd(), "Backend", filePath);
      if (fs.existsSync(potentialPath)) {
        absoluteInputPath = potentialPath;
      }
    }

    // Final Input Check
    if (!fs.existsSync(absoluteInputPath)) {
      const errorMsg = `❌ Input file missing at: ${absoluteInputPath}`;
      console.error(errorMsg);
      throw new Error(errorMsg); // Triggers retry
    }

    // --- 2. RESOLVE OUTPUT PATH (ABSOLUTE) ---
    // We resolve outputDir relative to CWD or Backend to ensure we know EXACTLY where it goes
    let absoluteOutputDir = path.resolve(outputDir);

    // Fix: Ensure we are writing to Backend/public/uploads if that's where the app expects it
    if (
      !absoluteOutputDir.includes("Backend") &&
      fs.existsSync(path.join(process.cwd(), "Backend"))
    ) {
      absoluteOutputDir = path.join(process.cwd(), "Backend", outputDir);
    }

    if (!fs.existsSync(absoluteOutputDir)) {
      console.log(`[Worker] Creating output dir: ${absoluteOutputDir}`);
      fs.mkdirSync(absoluteOutputDir, { recursive: true });
    }

    const timestamp = Date.now();
    let finalFilename = "";
    let absoluteFinalPath = "";
    let relativeUrl = "";

    try {
      // --- 3. PROCESSING (CONVERSION) ---
      if (mimeType.startsWith("image/")) {
        finalFilename = `${modelName.toLowerCase()}-${fileId}-${timestamp}.webp`;
        absoluteFinalPath = path.join(absoluteOutputDir, finalFilename);

        console.log(`[Worker] ⚙️ Converting to: ${absoluteFinalPath}`);

        let pipeline = sharp(absoluteInputPath);

        // Apply Resizing Logic
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

        // Write to file
        await pipeline.webp({ quality: 80 }).toFile(absoluteFinalPath);
      } else {
        throw new Error("Unsupported MIME type for this worker");
      }

      // --- 4. BULLETPROOF VERIFICATION (THE FIX) ---
      // Check 1: Does file exist?
      if (!fs.existsSync(absoluteFinalPath)) {
        throw new Error(
          `Conversion failed: File not found at ${absoluteFinalPath}`
        );
      }

      // Check 2: Is file size > 0? (catches empty file corruptions)
      const stats = fs.statSync(absoluteFinalPath);
      if (stats.size === 0) {
        // Delete the empty file to clean up
        fs.unlinkSync(absoluteFinalPath);
        throw new Error(`Conversion failed: Generated file is empty (0 bytes)`);
      }

      console.log(
        `[Worker] ✅ Verification Passed: File exists (${(
          stats.size / 1024
        ).toFixed(2)} KB)`
      );

      // --- 5. DATABASE UPDATE ---
      // Only now do we generate the URL and touch the DB
      // relativeUrl = /uploads/filename.webp
      relativeUrl = `/${path
        .relative(path.join(process.cwd(), "Backend/public"), absoluteFinalPath)
        .replace(/\\/g, "/")}`;

      // Fallback if the logic above gets messy with paths:
      if (!relativeUrl.startsWith("/"))
        relativeUrl = `/uploads/${finalFilename}`;

      const Model = mongoose.model(modelName);

      if (operation === "push") {
        await Model.findByIdAndUpdate(fileId, {
          $push: { [fieldName]: relativeUrl },
        });
      } else {
        // --- 6. OLD FILE CLEANUP (SAFE) ---
        // Fetch old doc to find old image
        const doc = await Model.findById(fileId);
        if (doc && doc[fieldName]) {
          const oldUrl = doc[fieldName];
          // Construct absolute path of old file
          const oldFileName = path.basename(oldUrl);
          const oldAbsolutePath = path.join(absoluteOutputDir, oldFileName);

          // Only delete if it's a different file and it actually exists
          if (oldFileName !== finalFilename && fs.existsSync(oldAbsolutePath)) {
            try {
              fs.unlinkSync(oldAbsolutePath);
              console.log(`[Worker] 🗑️ Deleted old image: ${oldFileName}`);
            } catch (err) {
              console.error(
                `[Worker Warning] Failed to delete old image: ${err.message}`
              );
            }
          }
        }

        const updateData = { [fieldName]: relativeUrl };
        if (modelName === "Gallery") updateData.status = "completed";
        await Model.findByIdAndUpdate(fileId, updateData);
      }

      // --- 7. CLEANUP INPUT FILE ---
      try {
        if (fs.existsSync(absoluteInputPath)) {
          fs.unlinkSync(absoluteInputPath);
          console.log(`[Worker] 🧹 Cleaned up input file`);
        }
      } catch (e) {
        console.error("Cleanup warning:", e.message);
      }

      console.log(`[Worker] 🎉 JOB COMPLETE. URL: ${relativeUrl}`);
      return relativeUrl;
    } catch (error) {
      console.error(`❌ [Worker Failed] ${error.message}`);

      // Emergency Cleanup: If we created a file but failed DB update, delete the orphan file
      if (absoluteFinalPath && fs.existsSync(absoluteFinalPath)) {
        try {
          fs.unlinkSync(absoluteFinalPath);
        } catch (e) {}
      }

      throw error; // Trigger Retry
    }
  },
  {
    connection,
    attempts: 3,
    backoff: { type: "exponential", delay: 1000 },
  }
);

console.log("Media Worker started (Bulletproof Mode)...");
