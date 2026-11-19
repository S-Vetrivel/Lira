const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const { getManagerOverview } = require("../controllers/analyticsController");

router.get("/overview", protect(["admin", "manager"]), getManagerOverview);

module.exports = router;
