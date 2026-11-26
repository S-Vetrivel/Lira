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

router.get("/", protect("requests.view"), getRequests);
router.post("/", protect("requests.create"), createRequest);
router.get("/:id", protect("requests.view"), getRequestById);
router.post("/:id/approve", protect("requests.approve"), approveStage);
router.post("/:id/reject", protect("requests.approve"), rejectRequest);

module.exports = router;
