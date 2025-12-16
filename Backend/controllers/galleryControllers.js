const Gallery = require("../models/galleryModel");
const { enqueueMedia } = require("../services/mediaService"); // Modular Queue Helper
const path = require("path");
const fs = require("fs");

// @desc    Get all images (Sorted by order)
// @route   GET /api/gallery
// @access  Private
const getGallery = async (req, res) => {
  try {
    const isAdmin = req.user?.role === "admin";

    const query = Gallery.find({}).sort({ order: 1 });

    if (!isAdmin) {
      query.select("order url");
    }

    const images = await query;

    res.status(200).json(images);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Bulk Upload & Enqueue for Processing (Modular)
// @route   POST /api/gallery
// @access  Private
const uploadImages = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "No files uploaded" });
    }

    // 1. Get current order count to append new images at the end
    const lastImage = await Gallery.findOne({ uploadedBy: req.user._id }).sort({
      order: -1,
    });
    let currentOrder = lastImage ? lastImage.order + 1 : 0;

    const processedFiles = [];

    // 2. Loop through uploaded files
    for (const file of req.files) {
      // A. Create initial DB record (Status: "processing")
      const newImage = new Gallery({
        uploadedBy: req.user._id,
        title: file.originalname,
        category: "Upload",
        fileType: file.mimetype,
        size: file.size,
        order: currentOrder++,
        url: "", // Worker will fill this later
        status: "processing", // UI can show a spinner for this status
      });

      const savedImage = await newImage.save();

      // B. Add job to Queue using the Modular Service
      // Params: (fileObject, databaseID, ModelName, FieldToUpdate)
      await enqueueMedia(file, savedImage._id, "Gallery", "url");

      processedFiles.push(savedImage);
    }

    res.status(201).json({
      message: "Uploads started. Processing in background.",
      data: processedFiles,
    });
  } catch (error) {
    console.error("Upload Error:", error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update Image Details (Title)
// @route   PUT /api/gallery/:id
// @access  Private
const updateImageDetails = async (req, res) => {
  try {
    const { title } = req.body;

    const image = await Gallery.findOne({
      _id: req.params.id,
      uploadedBy: req.user._id,
    });

    if (!image) {
      return res.status(404).json({ message: "Image not found" });
    }

    // Only update if a new title is provided
    image.title = title !== undefined ? title : image.title;
    await image.save();

    res.status(200).json(image);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Bulk Delete Images
// @route   POST /api/gallery/delete-batch
// @access  Private
const deleteImages = async (req, res) => {
  try {
    const { ids } = req.body; // Expects array: ["id1", "id2"]

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: "No IDs provided" });
    }

    // 1. Find images to get file paths (for cleanup)
    const imagesToDelete = await Gallery.find({
      _id: { $in: ids },
      uploadedBy: req.user._id,
    });

    // 2. Delete processed files from disk (Optional but recommended)
    imagesToDelete.forEach((img) => {
      // Check if it's a local file path (and not an external http link)
      if (img.url && !img.url.startsWith("http")) {
        // Construct absolute path. Assumes 'uploads' folder is one level up from controllers
        const absolutePath = path.join(__dirname, "..", img.url);
        if (fs.existsSync(absolutePath)) {
          try {
            fs.unlinkSync(absolutePath);
          } catch (err) {
            console.error(`Failed to delete file: ${absolutePath}`, err);
          }
        }
      }
    });

    // 3. Delete from DB
    await Gallery.deleteMany({
      _id: { $in: ids },
      uploadedBy: req.user._id,
    });

    res.status(200).json({ message: "Images deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Reorder Images
// @route   PUT /api/gallery/reorder
// @access  Private
const reorderImages = async (req, res) => {
  try {
    const { items } = req.body; // Expects: [{ id: "...", order: 0 }, ...]

    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ message: "Invalid items data" });
    }

    // Use bulkWrite for high performance (one DB call instead of many)
    const bulkOps = items.map((item) => ({
      updateOne: {
        filter: { _id: item.id, uploadedBy: req.user._id },
        update: { $set: { order: item.order } },
      },
    }));

    if (bulkOps.length > 0) {
      await Gallery.bulkWrite(bulkOps);
    }

    res.status(200).json({ message: "Order updated successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getGallery,
  uploadImages,
  updateImageDetails,
  deleteImages,
  reorderImages,
};
