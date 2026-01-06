const Banner = require("../models/bannerModal"); // Ensure file is named bannerModel.js
const { mediaQueue } = require("../services/queue");
const minio = require("../config/minio");
const path = require("path");

const BUCKET = process.env.MINIO_BUCKET_NAME;

// --- HELPER: Queue Image Processing ---
const queueBannerProcessing = async (file, bannerId) => {
  await mediaQueue.add("process-product-image", {
    fileId: bannerId,
    filePath: file.path,
    mimeType: file.mimetype,
    outputDir: path.join(__dirname, "../public/uploads"),
    modelName: "Banner", // Matches the check in Worker
    fieldName: "image",
    operation: "replace", // Banners replace the old image
  });
};

// --- 1. GET BANNERS ---
exports.getBanners = async (req, res) => {
  try {
    const { page } = req.query;
    const query = page ? { page } : {};
    const banners = await Banner.find(query).sort({ createdAt: -1 });
    res.status(200).json(banners);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// --- 2. CREATE BANNER ---
exports.createBanner = async (req, res) => {
  try {
    const { title, subtitle, page } = req.body;

    const newBanner = new Banner({
      title,
      subtitle,
      page: page || "home",
    });

    const savedBanner = await newBanner.save();

    // Handle Image File via Queue
    if (req.file) {
      await queueBannerProcessing(req.file, savedBanner._id);
    }

    res.status(201).json(savedBanner);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// --- 3. DELETE BANNER ---
exports.deleteBanner = async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.id);
    if (!banner) return res.status(404).json({ message: "Banner not found" });

    // Cleanup MinIO Object immediately
    if (banner.image && banner.image.startsWith("/uploads/")) {
      const objectKey = banner.image.replace("/uploads/", "");
      try {
        await minio.removeObject(BUCKET, objectKey);
      } catch (e) {
        console.warn(`[Banner] MinIO deletion warning:`, e.message);
      }
    }

    await Banner.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "Banner deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
