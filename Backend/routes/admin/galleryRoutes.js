const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");

// Note: Auth Middleware import removed

const {
  getGallery,
  uploadImages,
  updateImageDetails,
  deleteImages,
  reorderImages,
} = require("../../controllers/galleryControllers");

// --- 1. Multer Storage Configuration ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, `raw-${Date.now()}${path.extname(file.originalname)}`);
  },
});

// --- 2. File Filter ---
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Invalid file type. Only images are allowed."), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 1024 * 1024 * 50 }, // 50MB limit
});

// --- 3. Route Definitions ---

// Base Route: /api/gallery
router
  .route("/")
  .get(getGallery) // GET: Fetch all images (No Auth)
  .post(upload.array("images", 20), uploadImages); // POST: Bulk Upload (No Auth)

// Reorder Route
router.put("/reorder", reorderImages);

// Delete Route
router.post("/delete-batch", deleteImages);

// Single Item Route
router.put("/:id", updateImageDetails);

module.exports = router;
