const express = require("express");
const router = express.Router();
const { protect, requireSuperAdmin } = require("../middleware/authMiddleware");
const {
  generateTaskBreakdown,
  executeModularQuery,
  getAIModelsSummary,
  getAIAdminConfig,
  updateAIAdminConfig,
  revokeAIAdminKey,
  testAIProviderConnection,
  listUserAIKeys,
  saveUserAIKey,
  deleteUserAIKey,
} = require("../controllers/aiController");

// Global AI assistant routes (`ai.use`)
router.post("/breakdown", protect("ai.use"), generateTaskBreakdown);
router.post("/query", protect("ai.use"), executeModularQuery);
router.get("/models", protect("ai.use"), getAIModelsSummary);

// Modular User BYOK routes (`ai.use` personal encrypted keys per module)
router.get("/user-keys", protect("ai.use"), listUserAIKeys);
router.put("/user-keys/:provider", protect("ai.use"), saveUserAIKey);
router.delete("/user-keys/:provider", protect("ai.use"), deleteUserAIKey);

// Superadmin AI Provider, Model & Encrypted Global Key Governance (`ai.manage` or Superadmin)
router.get("/config", protect("ai.manage"), getAIAdminConfig);
router.put("/config/:provider", protect("ai.manage"), updateAIAdminConfig);
router.delete("/config/:provider/key", protect("ai.manage"), revokeAIAdminKey);
router.post("/config/:provider/test", protect("ai.manage"), testAIProviderConnection);

module.exports = router;
