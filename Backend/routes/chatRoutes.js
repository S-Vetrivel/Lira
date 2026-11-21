const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const {
  sendMessage,
  getMessages,
  markRead,
  getConversations,
} = require("../controllers/chatController");

router.post("/messages", protect(), sendMessage);
router.get("/rooms/:roomId/messages", protect(), getMessages);
router.post("/rooms/:roomId/read", protect(), markRead);
router.get("/conversations", protect(), getConversations);

module.exports = router;
