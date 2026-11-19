const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const { getComments, addComment } = require("../controllers/commentController");

router.get("/:taskId", protect(), getComments);
router.post("/:taskId", protect(), addComment);

module.exports = router;
