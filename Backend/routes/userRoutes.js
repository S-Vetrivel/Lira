const express = require("express");
const router = express.Router();
const { protect, requireSuperAdmin } = require("../middleware/authMiddleware");
const {
  getTeamMembers,
  createUser,
  updateUser,
  deleteUser,
  bulkRemoveNonSuperadmins,
  getJoinRequestStatus,
  submitJoinRequest,
  getPendingJoinRequests,
  approveJoinRequest,
  rejectJoinRequest,
} = require("../controllers/userControllers");

// Team directory & user management
router.get("/team", protect("team.view"), getTeamMembers);
router.post("/", protect("team.create"), createUser);
router.post("/bulk-remove-non-superadmins", requireSuperAdmin, bulkRemoveNonSuperadmins);
router.put("/:id", protect("team.edit"), updateUser);
router.delete("/:id", protect("team.delete"), deleteUser);

// Team Join Request & Follow Tracking workflow
router.get("/join-request/status", protect(), getJoinRequestStatus);
router.post("/join-request/submit", protect(), submitJoinRequest);

// Admin, Manager & Superadmin review of pending join requests
router.get("/join-requests", protect("team.join_requests"), getPendingJoinRequests);
router.put("/join-requests/:id/approve", protect("team.join_requests"), approveJoinRequest);
router.put("/join-requests/:id/reject", protect("team.join_requests"), rejectJoinRequest);

module.exports = router;
