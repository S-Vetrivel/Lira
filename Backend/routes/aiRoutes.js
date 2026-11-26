const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const { generateTaskBreakdown } = require("../controllers/aiController");

router.post("/breakdown", protect("ai.use"), generateTaskBreakdown);

module.exports = router;
