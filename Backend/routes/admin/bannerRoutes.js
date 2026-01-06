const express = require("express");
const router = express.Router();
const multer = require("multer");
const bannerController = require("../../controllers/bannerController");

const upload = multer({ dest: "uploads/temp/" });

// GET /api/banners
router.get("/", bannerController.getBanners);

// POST /api/admin/banners
router.post(
  "/", // mounted at /admin in main file or keep full path here
  upload.single("image"),
  bannerController.createBanner
);

// DELETE /api/admin/banners/:id
router.delete("/:id", bannerController.deleteBanner);

module.exports = router;
