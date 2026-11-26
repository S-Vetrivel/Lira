import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  X,
  KeyRound,
  Plus,
  CheckCircle2,
  AlertCircle,
  Zap,
  Trash2,
  Lock,
  Eye,
  EyeOff,
  Check,
  ShieldCheck,
  Loader2,
} from "lucide-react";
import {
  getAIAdminConfig,
  getUserAIKeys,
  getAIModelsSummary,
  testRawAIKeyAPI,
  addEncryptedAIKey,
  activateAIKeyEntry,
  testStoredAIKeyEntry,
  deleteStoredAIKeyEntry,
} from "../../services/api";
import { getGlassTokens } from "../../styles/glassTheme";

/**
 * Shared Multi-Key Storage, Live Pre-Save Verification & Key Switcher Modal.
 * Works seamlessly in:
 * - `scope="global"`: Superadmin managing organization-wide global encrypted keys & `.env` switch
 * - `scope="user"`: Workspace members storing & switching personal encrypted BYOK keys per module
 */
export default function AIKeyManagerModal({
  isOpen,
  onClose,
  scope = "user", // "global" | "user"
  initialProvider = "google",
  onUpdated,
  isDark = true,
}) {
  const g = getGlassTokens(isDark);
  const [activeProvider, setActiveProvider] = useState(initialProvider);
  const [moduleScope, setModuleScope] = useState(scope === "global" ? "global" : "all");
  const [providersMeta, setProvidersMeta] = useState([]);
  const [userConfigs, setUserConfigs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Add New Key Form
  const [keyLabel, setKeyLabel] = useState("");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [showRawKey, setShowRawKey] = useState(false);
  const [selectedModel, setSelectedModel] = useState("");
  const [testBeforeSave, setTestBeforeSave] = useState(false);
  const [testingRaw, setTestingRaw] = useState(false);
  const [rawTestResult, setRawTestResult] = useState(null);
  const [savingKey, setSavingKey] = useState(false);
  const [busyKeyId, setBusyKeyId] = useState("");

  useEffect(() => {
    if (isOpen) {
      setActiveProvider(initialProvider || "google");
      setModuleScope(scope === "global" ? "global" : "all");
      setRawTestResult(null);
      loadVaultData();
    }
  }, [isOpen, scope, initialProvider]);

  const loadVaultData = async () => {
    setLoading(true);
    if (scope === "global") {
      const res = await getAIAdminConfig();
      if (res.success) {
        setProvidersMeta(res.providers || []);
      }
    } else {
      const [modRes, uRes] = await Promise.all([getAIModelsSummary(), getUserAIKeys()]);
      if (modRes.success) setProvidersMeta(modRes.providers || []);
      if (uRes.success) setUserConfigs(uRes.configs || uRes.keys || []);
    }
    setLoading(false);
  };

  const currentProviderObj = useMemo(
    () => providersMeta.find((p) => p.key === activeProvider) || providersMeta[0],
    [providersMeta, activeProvider]
  );

  useEffect(() => {
    if (currentProviderObj && !selectedModel) {
      setSelectedModel(currentProviderObj.defaultModel || currentProviderObj.models?.[0]?.id || "");
    }
  }, [currentProviderObj]);

  const activeConfig = useMemo(() => {
    if (scope === "global") {
      return currentProviderObj;
    }
    return userConfigs.find(
      (c) => c.provider === activeProvider && c.moduleKey === moduleScope
    );
  }, [scope, currentProviderObj, userConfigs, activeProvider, moduleScope]);

  const storedKeys = activeConfig?.keys || [];
  const configId = scope === "global" ? activeConfig?.configId : activeConfig?._id;
  const isEnvActive = scope === "global" && activeConfig?.keySource === "env";

  const handleTestBeforeSave = async () => {
    if (!apiKeyInput.trim()) return;
    setTestingRaw(true);
    setRawTestResult(null);
    const res = await testRawAIKeyAPI({
      provider: activeProvider,
      model: selectedModel || currentProviderObj?.defaultModel,
      apiKey: apiKeyInput.trim(),
    });
    setTestingRaw(false);
    setRawTestResult(res);
  };

  const handleSaveNewKey = async (e) => {
    e.preventDefault();
    if (!apiKeyInput.trim()) return;
    setSavingKey(true);
    const res = await addEncryptedAIKey({
      scope,
      provider: activeProvider,
      moduleKey: scope === "global" ? "global" : moduleScope,
      label: keyLabel.trim() || `${activeProvider.toUpperCase()} Key #${storedKeys.length + 1}`,
      apiKey: apiKeyInput.trim(),
      defaultModel: selectedModel || currentProviderObj?.defaultModel,
      activate: true,
      testBeforeSave,
    });
    setSavingKey(false);
    if (res.success) {
      setKeyLabel("");
      setApiKeyInput("");
      setRawTestResult(null);
      await loadVaultData();
      onUpdated?.();
    }
  };

  const handleActivateKey = async (targetKeyId) => {
    if (!configId) return;
    setBusyKeyId(targetKeyId);
    const res = await activateAIKeyEntry(configId, targetKeyId);
    setBusyKeyId("");
    if (res.success) {
      await loadVaultData();
      onUpdated?.();
    }
  };

  const handleTestStored = async (targetKeyId) => {
    if (!configId) return;
    setBusyKeyId(targetKeyId);
    await testStoredAIKeyEntry(configId, targetKeyId, {
      model: selectedModel || currentProviderObj?.defaultModel,
    });
    setBusyKeyId("");
    await loadVaultData();
  };

  const handleDeleteStored = async (targetKeyId) => {
    if (!configId) return;
    setBusyKeyId(targetKeyId);
    const res = await deleteStoredAIKeyEntry(configId, targetKeyId);
    setBusyKeyId("");
    if (res.success) {
      await loadVaultData();
      onUpdated?.();
    }
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16, ease: "easeOut" }}
          className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-[3px]"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ type: "spring", damping: 28, stiffness: 360 }}
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-2xl max-h-[88vh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden ${g.dropdown}`}
          >
        {/* Header */}
        <div className={`px-5 py-4 border-b flex items-center justify-between gap-3 shrink-0 ${g.subHeader}`}>
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl border flex items-center justify-center ${g.badge}`}>
              <KeyRound className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <h3 className={`text-sm sm:text-base font-bold ${g.heading}`}>
                {scope === "global"
                  ? "Superadmin Global AI Key Ring & Switcher"
                  : "Personal Encrypted AI Keys (BYOK)"}
              </h3>
              <p className={`text-[11px] ${g.muted}`}>
                {scope === "global"
                  ? "Test keys live before storing with AES-256-GCM encryption & switch active global keys anytime."
                  : "Add personal API keys per module, test live before saving, and switch between multiple stored keys."}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`p-1.5 rounded-lg cursor-pointer ${g.iconBtn}`}
            title="Close Key Vault Modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Provider Switcher Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              {[
                { key: "google", label: "Google Gemini" },
                { key: "openai", label: "OpenAI GPT-6" },
                { key: "anthropic", label: "Anthropic Claude 5" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => {
                    setActiveProvider(tab.key);
                    setSelectedModel("");
                    setRawTestResult(null);
                  }}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-all ${
                    activeProvider === tab.key ? g.pillActive : g.pillInactive
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {scope === "user" && (
              <select
                value={moduleScope}
                onChange={(e) => setModuleScope(e.target.value)}
                className={`rounded-xl px-3 py-1.5 text-xs border focus:outline-none ${g.input}`}
              >
                <option value="all" className={isDark ? "bg-[#14151a]" : "bg-white"}>Scope: All Modules</option>
                <option value="tasks" className={isDark ? "bg-[#14151a]" : "bg-white"}>Scope: Tasks Assistant</option>
                <option value="chat" className={isDark ? "bg-[#14151a]" : "bg-white"}>Scope: Chat Assistant</option>
              </select>
            )}
          </div>

          {loading ? (
            <div className={`py-10 flex items-center justify-center gap-2 text-xs ${g.muted}`}>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Loading encrypted key ring...</span>
            </div>
          ) : (
            <>
              {/* Stored Keys & Live Switcher */}
              <div className={`p-4 rounded-2xl border space-y-3 ${g.subtleSurface}`}>
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${g.heading}`}>
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Stored Keys & Active Selector ({storedKeys.length})</span>
                  </span>
                  {scope === "global" && activeConfig?.envConfigured && (
                    <button
                      type="button"
                      disabled={!configId || isEnvActive}
                      onClick={() => handleActivateKey("env")}
                      className={`px-2.5 py-1 rounded-lg border text-[10px] font-bold cursor-pointer transition-all ${
                        isEnvActive
                          ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
                          : `${g.btnSecondary} opacity-45 hover:opacity-85`
                      }`}
                    >
                      {isEnvActive ? `Active: .env (${activeConfig.envMaskedKey})` : `Switch to .env Key`}
                    </button>
                  )}
                </div>

                {storedKeys.length === 0 ? (
                  <p className={`text-xs italic py-2 ${g.muted}`}>
                    No custom encrypted keys stored for {currentProviderObj?.name || activeProvider} yet. Add and test one below.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {storedKeys.map((entry) => {
                      const active = entry.isActive && !isEnvActive;
                      return (
                        <div
                          key={entry._id}
                          className={`p-3 rounded-xl border flex flex-wrap items-center justify-between gap-2 transition-opacity ${
                            active ? g.selectedRow : `${g.card} opacity-50 hover:opacity-90`
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <Lock className="w-3 h-3 text-purple-400 shrink-0" />
                              <span className="text-xs font-bold truncate">{entry.label}</span>
                              <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded border ${g.badge}`}>
                                {entry.maskedKey}
                              </span>
                              {active && (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-[9px] font-bold">
                                  ACTIVE
                                </span>
                              )}
                            </div>
                            {entry.lastTestResult?.message && (
                              <p className={`text-[10px] mt-1 truncate ${entry.lastTestResult.ok ? "text-emerald-400" : "text-rose-400"}`}>
                                {entry.lastTestResult.message}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {!active && (
                              <button
                                type="button"
                                disabled={busyKeyId === entry._id}
                                onClick={() => handleActivateKey(entry._id)}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 cursor-pointer ${g.btnPrimary}`}
                              >
                                <Check className="w-3 h-3" />
                                <span>Use Key</span>
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={busyKeyId === entry._id}
                              onClick={() => handleTestStored(entry._id)}
                              className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold flex items-center gap-1 cursor-pointer ${g.btnSecondary}`}
                              title="Test stored encrypted key"
                            >
                              <Zap className="w-3 h-3 text-amber-400" />
                              <span>Test</span>
                            </button>
                            <button
                              type="button"
                              disabled={busyKeyId === entry._id}
                              onClick={() => handleDeleteStored(entry._id)}
                              className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/15 cursor-pointer"
                              title="Remove key from ring"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Add + Test Before Storing Form */}
              <form onSubmit={handleSaveNewKey} className={`p-4 rounded-2xl border space-y-3.5 ${g.card}`}>
                <h4 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${g.heading}`}>
                  <Plus className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Add & Test New Encrypted Key</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={`text-[11px] font-semibold block mb-1 ${g.heading}`}>
                      Key Label
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Production Billing Key"
                      value={keyLabel}
                      onChange={(e) => setKeyLabel(e.target.value)}
                      className={`w-full rounded-xl px-3 py-2 text-xs border focus:outline-none ${g.input}`}
                    />
                  </div>
                  <div>
                    <label className={`text-[11px] font-semibold block mb-1 ${g.heading}`}>
                      Model to Test & Route
                    </label>
                    <select
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                      className={`w-full rounded-xl px-3 py-2 text-xs border focus:outline-none ${g.input}`}
                    >
                      {(currentProviderObj?.models || []).map((m) => (
                        <option key={m.id} value={m.id} className={isDark ? "bg-[#14151a]" : "bg-white"}>
                          {m.name} ({m.id})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className={`text-[11px] font-semibold block mb-1 ${g.heading}`}>
                    API Key Secret *
                  </label>
                  <div className="relative">
                    <input
                      type={showRawKey ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      placeholder={`Paste ${currentProviderObj?.name || activeProvider} secret key...`}
                      value={apiKeyInput}
                      onChange={(e) => {
                        setApiKeyInput(e.target.value);
                        setRawTestResult(null);
                      }}
                      className={`w-full rounded-xl pl-3 pr-9 py-2 text-xs font-mono border focus:outline-none ${g.input}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowRawKey((v) => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 opacity-60 hover:opacity-100 cursor-pointer"
                    >
                      {showRawKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {rawTestResult && (
                  <div
                    className={`p-2.5 rounded-xl border text-xs flex items-center gap-2 ${
                      rawTestResult.ok || rawTestResult.success
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                        : "bg-rose-500/10 border-rose-500/30 text-rose-400"
                    }`}
                  >
                    {rawTestResult.ok || rawTestResult.success ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0" />
                    )}
                    <span className="truncate">{rawTestResult.message}</span>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={testBeforeSave}
                      onChange={(e) => setTestBeforeSave(e.target.checked)}
                      className="accent-indigo-500"
                    />
                    <span className={g.muted}>Require live verification before saving</span>
                  </label>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={!apiKeyInput.trim() || testingRaw}
                      onClick={handleTestBeforeSave}
                      className={`px-3.5 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-40 ${g.btnSecondary}`}
                    >
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                      <span>{testingRaw ? "Testing Live..." : "Test Before Saving"}</span>
                    </button>
                    <button
                      type="submit"
                      disabled={!apiKeyInput.trim() || savingKey}
                      className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-40 ${g.btnPrimary}`}
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>{savingKey ? "Encrypting..." : "Encrypt & Store Key"}</span>
                    </button>
                  </div>
                </div>
              </form>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

