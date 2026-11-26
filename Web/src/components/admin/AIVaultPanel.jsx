import React, { useState, useEffect } from "react";
import {
  Sparkles,
  KeyRound,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Trash2,
  Lock,
  Cpu,
  Zap,
} from "lucide-react";
import {
  getAIAdminConfig,
  updateAIAdminConfig,
  revokeAIAdminKey,
  testAIProviderConnection,
} from "../../services/api";
import { getGlassTokens } from "../../styles/glassTheme";

export default function AIVaultPanel({ isDark = true }) {
  const g = getGlassTokens(isDark);
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userByokCount, setUserByokCount] = useState(0);

  // Per-provider local form edits
  const [drafts, setDrafts] = useState({});
  const [savingProvider, setSavingProvider] = useState("");
  const [testingProvider, setTestingProvider] = useState("");

  const loadConfig = async () => {
    setLoading(true);
    const res = await getAIAdminConfig();
    if (res.success) {
      setProviders(res.providers || []);
      setUserByokCount(res.userByokCount || 0);
      const nextDrafts = {};
      (res.providers || []).forEach((p) => {
        nextDrafts[p.key] = {
          apiKeyInput: "",
          keySource: p.keySource || (p.envConfigured ? "env" : "superadmin_vault"),
          defaultModel: p.defaultModel || p.models[0]?.id,
          thinkingLevel: p.thinkingLevel || "low",
          enabled: p.enabled,
          isGlobalDefault: p.isGlobalDefault,
        };
      });
      setDrafts(nextDrafts);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const updateDraft = (pKey, patch) => {
    setDrafts((prev) => ({
      ...prev,
      [pKey]: { ...(prev[pKey] || {}), ...patch },
    }));
  };

  const handleSave = async (pKey) => {
    const d = drafts[pKey] || {};
    setSavingProvider(pKey);
    const payload = {
      defaultModel: d.defaultModel,
      thinkingLevel: d.thinkingLevel,
      enabled: d.enabled,
      isGlobalDefault: d.isGlobalDefault,
      keySource: d.apiKeyInput?.trim() ? "superadmin_vault" : d.keySource,
      ...(d.apiKeyInput?.trim() ? { apiKey: d.apiKeyInput.trim() } : {}),
    };
    const res = await updateAIAdminConfig(pKey, payload);
    setSavingProvider("");
    if (res.success) {
      await loadConfig();
    }
  };

  const handleRevoke = async (pKey) => {
    setSavingProvider(pKey);
    const res = await revokeAIAdminKey(pKey);
    setSavingProvider("");
    if (res.success) {
      await loadConfig();
    }
  };

  const handleTest = async (pKey) => {
    setTestingProvider(pKey);
    const d = drafts[pKey] || {};
    await testAIProviderConnection(pKey, { model: d.defaultModel });
    setTestingProvider("");
    await loadConfig();
  };

  if (loading) {
    return (
      <div className={`p-10 rounded-2xl border flex items-center justify-center gap-2 text-xs ${g.card} ${g.muted}`}>
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>Loading Encrypted AI Engine & Models Catalog...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Architecture Banner */}
      <div className={`p-4 rounded-2xl border flex flex-wrap items-center justify-between gap-4 ${g.cardGlow}`}>
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${g.badge}`}>
            <ShieldCheck className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h2 className={`text-sm font-bold flex items-center gap-2 ${g.heading}`}>
              <span>Superadmin AI Engine Vault & Multi-Provider Model Routing</span>
              <span className="px-2 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 text-[10px] font-mono">
                AES-256-GCM
              </span>
            </h2>
            <p className={`text-xs mt-1 leading-relaxed ${g.muted}`}>
              Invoked Superadmin keys are encrypted at rest with AES-256-GCM and strictly restricted to{" "}
              <strong>Global Platform Tasks</strong>. Users holding BYOK module permissions supply their own encrypted personal keys separately ({userByokCount} active user keys).
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={loadConfig}
          className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${g.btnSecondary}`}
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Sync Status</span>
        </button>
      </div>

      {/* Provider Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {providers.map((p) => {
          const d = drafts[p.key] || {};
          const selectedModelObj = p.models.find((m) => m.id === d.defaultModel) || p.models[0];
          const isBusy = savingProvider === p.key || testingProvider === p.key;

          return (
            <div
              key={p.key}
              className={`p-5 rounded-2xl border flex flex-col justify-between gap-4 ${
                d.isGlobalDefault ? g.cardActive : g.card
              }`}
            >
              <div className="space-y-4">
                {/* Card Header */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <Cpu className="w-4 h-4 text-indigo-400 shrink-0" />
                      <h3 className={`text-sm font-bold ${g.heading}`}>{p.name}</h3>
                    </div>
                    <p className={`text-[10px] font-mono mt-1 ${g.muted}`}>{p.sdkInfo}</p>
                  </div>
                  {d.isGlobalDefault && (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold shrink-0">
                      Global Active
                    </span>
                  )}
                </div>

                {/* Env & Vault Detection Badges */}
                <div className={`p-3 rounded-xl border space-y-2 text-xs ${g.subtleSurface}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className={g.muted}>.env ({p.envVar})</span>
                    {p.envConfigured ? (
                      <span className="inline-flex items-center gap-1 font-mono text-[10px] text-emerald-400 font-bold">
                        <CheckCircle2 className="w-3 h-3" /> {p.envMaskedKey}
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono opacity-60">Not configured in .env</span>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className={g.muted}>Superadmin Vault</span>
                    {p.vaultConfigured ? (
                      <span className="inline-flex items-center gap-1 font-mono text-[10px] text-purple-300 font-bold">
                        <Lock className="w-3 h-3" /> {p.maskedKey}
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono opacity-60">No vault key stored</span>
                    )}
                  </div>
                </div>

                {/* Key Source Selection */}
                <div className="space-y-2">
                  <label className={`text-[11px] font-bold block ${g.heading}`}>
                    Active Credential Source (Global Tasks)
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => updateDraft(p.key, { keySource: "env" })}
                      className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-semibold cursor-pointer ${
                        d.keySource === "env" ? g.selectedRow : g.btnSecondary
                      }`}
                    >
                      Use .env Key
                    </button>
                    <button
                      type="button"
                      onClick={() => updateDraft(p.key, { keySource: "superadmin_vault" })}
                      className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-semibold cursor-pointer ${
                        d.keySource === "superadmin_vault" ? g.selectedRow : g.btnSecondary
                      }`}
                    >
                      Encrypted Vault Key
                    </button>
                  </div>
                </div>

                {/* Encrypted Key Input */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className={`text-[11px] font-bold flex items-center gap-1 ${g.heading}`}>
                      <KeyRound className="w-3 h-3 text-amber-400" />
                      <span>{p.vaultConfigured ? "Rotate Encrypted Vault Key" : "Invoke & Encrypt API Key"}</span>
                    </label>
                    {p.vaultConfigured && (
                      <button
                        type="button"
                        onClick={() => handleRevoke(p.key)}
                        className="text-[10px] text-rose-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" /> Revoke
                      </button>
                    )}
                  </div>
                  <input
                    type="password"
                    autoComplete="new-password"
                    placeholder={p.vaultConfigured ? "Enter new key to replace stored vault key..." : `Paste ${p.name} key to AES-256 encrypt...`}
                    value={d.apiKeyInput || ""}
                    onChange={(e) => updateDraft(p.key, { apiKeyInput: e.target.value })}
                    className={`w-full rounded-xl px-3 py-2 text-xs border font-mono focus:outline-none ${g.input}`}
                  />
                </div>

                {/* Active Model Picker */}
                <div className="space-y-1.5">
                  <label className={`text-[11px] font-bold block ${g.heading}`}>
                    Default Model ({p.models.length} supported)
                  </label>
                  <select
                    value={d.defaultModel || ""}
                    onChange={(e) => updateDraft(p.key, { defaultModel: e.target.value })}
                    className={`w-full rounded-xl px-3 py-2 text-xs border font-semibold focus:outline-none ${g.input}`}
                  >
                    {p.models.map((m) => (
                      <option
                        key={m.id}
                        value={m.id}
                        className={isDark ? "bg-[#14151a] text-white" : "bg-white text-slate-900"}
                      >
                        {m.name} ({m.id}) — {m.category}
                      </option>
                    ))}
                  </select>
                  {selectedModelObj && (
                    <div className={`text-[10px] p-2 rounded-lg border ${g.subtleSurface} ${g.muted}`}>
                      <div className="flex justify-between font-mono">
                        <span>Ctx/Out: {selectedModelObj.context} / {selectedModelObj.maxOut}</span>
                        <span>{selectedModelObj.pricing}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Thinking Level (for Google Gemini 3.6+/4) */}
                {p.key === "google" && (
                  <div className="space-y-1">
                    <label className={`text-[11px] font-bold block ${g.heading}`}>
                      Gemini 3.6+/4 Thinking Level
                    </label>
                    <select
                      value={d.thinkingLevel || "low"}
                      onChange={(e) => updateDraft(p.key, { thinkingLevel: e.target.value })}
                      className={`w-full rounded-xl px-3 py-1.5 text-xs border focus:outline-none ${g.input}`}
                    >
                      {["minimal", "low", "medium", "high", "xhigh"].map((lvl) => (
                        <option key={lvl} value={lvl} className={isDark ? "bg-[#14151a] text-white" : "bg-white"}>
                          {lvl}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <p className={`text-[10px] leading-relaxed ${g.muted}`}>{p.endpointNote}</p>

                {/* Toggles */}
                <div className="flex items-center justify-between gap-3 pt-1">
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(d.enabled)}
                      onChange={(e) => updateDraft(p.key, { enabled: e.target.checked })}
                      className="accent-indigo-500"
                    />
                    <span>Enabled</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(d.isGlobalDefault)}
                      onChange={(e) => updateDraft(p.key, { isGlobalDefault: e.target.checked })}
                      className="accent-emerald-500"
                    />
                    <span className="font-semibold">Set Global Default</span>
                  </label>
                </div>

                {/* Last Test Result */}
                {p.lastTestResult?.message && (
                  <div
                    className={`p-2 rounded-xl border text-[10px] flex items-center gap-1.5 ${
                      p.lastTestResult.ok
                        ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-400"
                        : "bg-rose-500/10 border-rose-500/25 text-rose-400"
                    }`}
                  >
                    {p.lastTestResult.ok ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 shrink-0" />}
                    <span className="truncate">{p.lastTestResult.message}</span>
                  </div>
                )}
              </div>

              {/* Actions Footer */}
              <div className={`pt-3 border-t flex items-center gap-2 ${g.border}`}>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => handleTest(p.key)}
                  className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-40 ${g.btnSecondary}`}
                >
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span>{testingProvider === p.key ? "Testing..." : "Test"}</span>
                </button>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => handleSave(p.key)}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40 ${g.btnPrimary}`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{savingProvider === p.key ? "Encrypting..." : "Encrypt & Save"}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

