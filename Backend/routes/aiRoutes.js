const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");

const aiAttachDir = path.join(__dirname, "../uploads/ai-attachments");
if (!fs.existsSync(aiAttachDir)) {
  fs.mkdirSync(aiAttachDir, { recursive: true });
}
const aiUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, aiAttachDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || "").slice(0, 12);
      const base = path.basename(file.originalname || "file", ext).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 48);
      cb(null, `${Date.now()}_${base}${ext}`);
    },
  }),
  limits: { fileSize: 15 * 1024 * 1024, files: 5 },
});
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
  getAssistantSession,
  getAssistantModels,
  postAssistantChat,
  uploadAssistantAttachments,
  deleteAssistantAttachment,
  exportAssistantArtifact,
  executeAssistantCardStep,
  stopAssistantGeneration,
  setAssistantMode,
  confirmAssistantAction,
  clearAssistantSession,
} = require("../controllers/aiController");

// Global AI assistant routes (`ai.use`)
router.post("/breakdown", protect("ai.use"), generateTaskBreakdown);
router.post("/query", protect("ai.use"), executeModularQuery);
router.get("/models", protect("ai.use"), getAIModelsSummary);
router.get("/my-access", protect("ai.use"), getMyAIAccess);

// Reload-Resilient Lira AI Copilot Routes (`ai.use`)
router.get("/assistant/session", protect("ai.use"), getAssistantSession);
router.get("/assistant/models", protect("ai.use"), getAssistantModels);
router.post("/assistant/upload", protect("ai.use"), aiUpload.array("files", 5), uploadAssistantAttachments);
router.delete("/assistant/upload", protect("ai.use"), deleteAssistantAttachment);
router.post("/assistant/chat", protect("ai.use"), postAssistantChat);
router.post("/assistant/stop", protect("ai.use"), stopAssistantGeneration);
router.put("/assistant/mode", protect("ai.use"), setAssistantMode);
router.post("/assistant/confirm/:messageId", protect("ai.use"), confirmAssistantAction);
router.post("/assistant/execute-step", protect("ai.use"), executeAssistantCardStep);
router.post("/assistant/export", protect("ai.use"), exportAssistantArtifact);
router.delete("/assistant/session", protect("ai.use"), clearAssistantSession);

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
