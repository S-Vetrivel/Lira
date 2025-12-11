// routes/index.js

const express = require("express");
const router = require("express").Router();

// Admin Routes
router.use("/admin", require("./admin/index"));
router.use("/auth", require("./auth/index"));
module.exports = router;
