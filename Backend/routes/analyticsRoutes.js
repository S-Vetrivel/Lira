const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const {
  getManagerOverview,
  getActionLogs,
  getActionLogStats,
} = require("../controllers/analyticsController");

// All authenticated roles (admin, manager, employee) can access analytics overview tailored to their role
router.get("/overview", protect(), getManagerOverview);

// Action Logs & Batched Preservation Endpoints
router.get("/action-logs", protect(), getActionLogs);
router.get("/action-logs/stats", protect(), getActionLogStats);

module.exports = router;
