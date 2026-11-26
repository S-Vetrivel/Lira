const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const {
  getAuditOverview,
  getActionLogs,
  getActionLogStats,
} = require("../controllers/analyticsController");

router.get("/overview", protect(["audit.view", "dashboard.logs"]), getAuditOverview);
router.get("/action-logs", protect(["audit.view", "dashboard.logs"]), getActionLogs);
router.get("/action-logs/stats", protect(["audit.view", "dashboard.logs"]), getActionLogStats);

module.exports = router;

