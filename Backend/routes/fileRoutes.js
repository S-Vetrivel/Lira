const express = require("express");
const router = express.Router();
const upload = require("../config/upload");
const { protect } = require("../middleware/authMiddleware");
const {
  uploadChunk,
  getChunkStatus,
  downloadFile,
} = require("../controllers/fileController");

// Optional auth wrapper for download links
const optionalAuth = (req, res, next) => {
  if (req.query?.token) {
    req.headers.authorization = `Bearer ${req.query.token}`;
  }
  if (req.cookies?.token || (req.headers.authorization && req.headers.authorization.startsWith("Bearer"))) {
    return protect()(req, res, next);
  }
  next();
};

router.post("/chunk/upload", protect(), upload.single("chunk"), uploadChunk);
router.get("/chunk/status/:uploadId", protect(), getChunkStatus);
router.get("/download/:fileName", optionalAuth, downloadFile);

module.exports = router;
