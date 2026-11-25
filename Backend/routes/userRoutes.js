const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const {
  getTeamMembers,
  createUser,
  updateUser,
  deleteUser,
  getJoinRequestStatus,
  submitJoinRequest,
  getPendingJoinRequests,
  approveJoinRequest,
  rejectJoinRequest,
} = require("../controllers/userControllers");

// Team directory & user management
router.get("/team", protect(), getTeamMembers);
router.post("/", protect(["admin"]), createUser);
router.put("/:id", protect(["admin", "manager"]), updateUser);
router.delete("/:id", protect(["admin"]), deleteUser);

// Team Join Request & Follow Tracking workflow
router.get("/join-request/status", protect(), getJoinRequestStatus);
router.post("/join-request/submit", protect(), submitJoinRequest);

// Admin & Manager review of pending join requests
router.get("/join-requests", protect(["admin", "manager"]), getPendingJoinRequests);
router.put("/join-requests/:id/approve", protect(["admin", "manager"]), approveJoinRequest);
router.put("/join-requests/:id/reject", protect(["admin", "manager"]), rejectJoinRequest);

module.exports = router;
