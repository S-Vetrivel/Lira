const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const {
  generateTaskBreakdown,
  executeModularQuery,
  testRawKeyEndpoint,
  addKeyRingEntry,
  activateKeyRingEntry,
  testKeyRingEntry,
  deleteKeyRingEntry,
  getAIModelsSummary,
  getAIAdminConfig,
  updateAIAdminConfig,
  revokeAIAdminKey,
  testAIProviderConnection,
  listUserAIKeys,
  saveUserAIKey,
  deleteUserAIKey,
  listGlobalGrants,
  createGlobalGrant,
  revokeGlobalGrant,
  restoreGlobalGrant,
  deleteGlobalGrant,
  getMyAIAccess,
  getAIUsageLogs,
} = require("../controllers/aiController");

// Global AI assistant routes (`ai.use`)
router.post("/breakdown", protect("ai.use"), generateTaskBreakdown);
router.post("/query", protect("ai.use"), executeModularQuery);
router.get("/models", protect("ai.use"), getAIModelsSummary);
router.get("/my-access", protect("ai.use"), getMyAIAccess);

// Test Before Storing + Multi-Key Vault Ring CRUD & Switching (Superadmin global OR User BYOK)
router.post("/test-raw", protect("ai.use"), testRawKeyEndpoint);
router.post("/keys", protect("ai.use"), addKeyRingEntry);
router.put("/keys/:configId/:keyId/activate", protect("ai.use"), activateKeyRingEntry);
router.post("/keys/:configId/:keyId/test", protect("ai.use"), testKeyRingEntry);
router.delete("/keys/:configId/:keyId", protect("ai.use"), deleteKeyRingEntry);

// Modular User BYOK routes (`ai.use`)
router.get("/user-keys", protect("ai.use"), listUserAIKeys);
router.put("/user-keys/:provider", protect("ai.use"), saveUserAIKey);
router.delete("/user-keys/:provider", protect("ai.use"), deleteUserAIKey);

// Superadmin AI Provider, Model & Encrypted Global Key Governance (`ai.manage` or Superadmin)
router.get("/config", protect("ai.manage"), getAIAdminConfig);
router.put("/config/:provider", protect("ai.manage"), updateAIAdminConfig);
router.delete("/config/:provider/key", protect("ai.manage"), revokeAIAdminKey);
router.post("/config/:provider/test", protect("ai.manage"), testAIProviderConnection);

// Superadmin Global Key Grants (User / Department / Project-Team + Module scoping)
router.get("/grants", protect("ai.manage"), listGlobalGrants);
router.post("/grants", protect("ai.manage"), createGlobalGrant);
router.put("/grants/:grantId/revoke", protect("ai.manage"), revokeGlobalGrant);
router.put("/grants/:grantId/restore", protect("ai.manage"), restoreGlobalGrant);
router.delete("/grants/:grantId", protect("ai.manage"), deleteGlobalGrant);

// Fine-Grained AI Key Usage Audit Logs (`audit.view` / `dashboard.logs` / `ai.manage`)
router.get("/usage-logs", protect(["audit.view", "dashboard.logs", "ai.manage"]), getAIUsageLogs);

module.exports = router;
