const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const { getManagerOverview } = require("../controllers/analyticsController");

// All authenticated roles (admin, manager, employee) can access analytics overview tailored to their role
router.get("/overview", protect(), getManagerOverview);

module.exports = router;
