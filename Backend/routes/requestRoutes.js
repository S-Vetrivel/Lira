const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const {
  createRequest,
  getRequests,
  getRequestById,
  approveStage,
  rejectRequest,
} = require("../controllers/requestController");

router.get("/", protect(), getRequests);
router.post("/", protect(), createRequest);
router.get("/:id", protect(), getRequestById);
router.post("/:id/approve", protect(["admin", "manager"]), approveStage);
router.post("/:id/reject", protect(["admin", "manager"]), rejectRequest);

module.exports = router;
