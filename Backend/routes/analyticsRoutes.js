const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const {
  getManagerOverview,
  getActionLogs,
  getActionLogStats,
  getAuditOverview,
} = require("../controllers/analyticsController");

// All authenticated roles can access analytics overview tailored to their dynamic modules
router.get("/overview", protect("dashboard.view"), getManagerOverview);

// Action Logs & Batched Preservation Endpoints
router.get("/action-logs", protect(["audit.view", "dashboard.logs"]), getActionLogs);
router.get("/action-logs/stats", protect(["audit.view", "dashboard.logs"]), getActionLogStats);

// Superadmin Comprehensive Audit + Online Presence + Teams Overview
router.get("/audit-overview", protect(["audit.view", "dashboard.logs"]), getAuditOverview);

module.exports = router;
