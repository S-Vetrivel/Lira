const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const {
  getBroadcastOverview,
  sendBroadcast,
  draftBroadcastWithAI,
} = require("../controllers/broadcastController");

router.get("/", protect("broadcast.view"), getBroadcastOverview);
router.post("/send", protect("broadcast.send"), sendBroadcast);
router.post("/ai-draft", protect(["broadcast.ai", "broadcast.send"]), draftBroadcastWithAI);

module.exports = router;

