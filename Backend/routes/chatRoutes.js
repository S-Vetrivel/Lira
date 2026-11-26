const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const {
  sendMessage,
  getMessages,
  markRead,
  getConversations,
  togglePinMessage,
} = require("../controllers/chatController");

router.post("/messages", protect("chat.send"), sendMessage);
router.patch("/messages/:messageId/pin", protect(["chat.pin", "chat.send"]), togglePinMessage);
router.get("/rooms/:roomId/messages", protect("chat.view"), getMessages);
router.post("/rooms/:roomId/read", protect("chat.view"), markRead);
router.get("/conversations", protect("chat.view"), getConversations);

module.exports = router;
