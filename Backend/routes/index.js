// routes/index.js

const express = require("express");
const router = require("express").Router();
const { getGallery } = require("../controllers/galleryControllers");
// Admin Routes
router.use("/admin", require("./adminRoutes"));
router.use("/auth", require("./authRoutes"));
router.use("/profile", require("./profileRoutes"));
router.get("/gallery", getGallery);
module.exports = router;
