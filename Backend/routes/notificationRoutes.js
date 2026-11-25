const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const {
  getNotifications,
  markAsRead,
  markAllAsRead,
  subscribePush,
} = require("../controllers/notificationController");

router.get("/", protect(), getNotifications);
router.patch("/:id/read", protect(), markAsRead);
router.post("/read-all", protect(), markAllAsRead);
router.post("/subscribe", protect(), subscribePush);

module.exports = router;
