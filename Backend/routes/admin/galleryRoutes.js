const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
// const { protect } = require("../middleware/authMiddleware"); // removed as per your setup

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
    // FIX: Add a random number to prevent duplicate names in the same millisecond
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `raw-${uniqueSuffix}${path.extname(file.originalname)}`);
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

router
  .route("/")
  .get(getGallery)
  .post(upload.array("images", 20), uploadImages);

router.put("/reorder", reorderImages);
router.post("/delete-batch", deleteImages);
router.put("/:id", updateImageDetails);

module.exports = router;
