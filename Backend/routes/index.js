// routes/index.js

const express = require("express");
const router = require("express").Router();

// Admin Routes
router.use("/admin", require("./admin/admin"));
router.use("/auth", require("./auth/auth"));
router.use("/profile", require("./profile/profile"));

module.exports = router;
