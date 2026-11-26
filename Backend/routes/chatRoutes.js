const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const {
  sendMessage,
  getMessages,
  markRead,
  getConversations,
} = require("../controllers/chatController");

router.post("/messages", protect("chat.send"), sendMessage);
router.get("/rooms/:roomId/messages", protect("chat.view"), getMessages);
router.post("/rooms/:roomId/read", protect("chat.view"), markRead);
router.get("/conversations", protect("chat.view"), getConversations);

module.exports = router;
