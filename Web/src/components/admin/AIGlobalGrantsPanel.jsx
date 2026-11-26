import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  ShieldCheck,
  UserCheck,
  Building2,
  FolderKanban,
  Plus,
  Ban,
  RotateCcw,
  Trash2,
  Loader2,
  KeyRound,
  Search,
  ChevronDown,
  Check,
} from "lucide-react";
import {
  getAIGlobalGrants,
  createAIGlobalGrant,
  revokeAIGlobalGrant,
  restoreAIGlobalGrant,
  deleteAIGlobalGrant,
} from "../../services/api";
import { getGlassTokens } from "../../styles/glassTheme";

const TARGET_TYPES = [
  { key: "user", label: "Specific User", icon: UserCheck },
  { key: "department", label: "Department", icon: Building2 },
  { key: "project", label: "Project / Team", icon: FolderKanban },
];

export default function AIGlobalGrantsPanel({ isDark = true }) {
  const g = getGlassTokens(isDark);
  const [grants, setGrants] = useState([]);
  const [targets, setTargets] = useState({ users: [], departments: [], projects: [] });
  const [moduleOptions, setModuleOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Grant Form State
  const [targetType, setTargetType] = useState("user");
  const [targetId, setTargetId] = useState("");
  const [targetSearch, setTargetSearch] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [provider, setProvider] = useState("all");
  const [selectedModules, setSelectedModules] = useState(["*"]);
  const [note, setNote] = useState("");
  const [grantSearch, setGrantSearch] = useState("");

  const dropdownRef = useRef(null);

  const loadGrants = async () => {
    setLoading(true);
    const res = await getAIGlobalGrants();
    if (res.success) {
      setGrants(res.grants || []);
      setTargets(res.targets || { users: [], departments: [], projects: [] });
      setModuleOptions(res.moduleOptions || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadGrants();
  }, []);

  useEffect(() => {
    const onOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  const currentTargetList = useMemo(() => {
    return targetType === "user"
      ? targets.users || []
      : targetType === "department"
      ? targets.departments || []
      : targets.projects || [];
  }, [targetType, targets]);

  const filteredTargets = useMemo(() => {
    const q = targetSearch.trim().toLowerCase();
    if (!q) return currentTargetList;
    return currentTargetList.filter((item) => {
      const hay = [
        item.fullname,
        item.name,
        item.email,
        item.publicId,
        item.code,
        item.prefix,
        item.role,
        item.departmentName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [currentTargetList, targetSearch]);

  const selectedTargetObj = useMemo(
    () => currentTargetList.find((item) => String(item._id) === String(targetId)),
    [currentTargetList, targetId]
  );

  const toggleModule = (modKey) => {
    if (modKey === "*") {
      setSelectedModules(["*"]);
      return;
    }
    setSelectedModules((prev) => {
      const withoutStar = prev.filter((k) => k !== "*");
      const next = withoutStar.includes(modKey)
        ? withoutStar.filter((k) => k !== modKey)
        : [...withoutStar, modKey];
      return next.length === 0 ? ["*"] : next;
    });
  };

  const handleGrantSubmit = async (e) => {
    e.preventDefault();
    if (!targetId) return;
    setSubmitting(true);
    const res = await createAIGlobalGrant({
      targetType,
      targetId,
      provider,
      allowedModules: selectedModules,
      note,
    });
    setSubmitting(false);
    if (res.success) {
      setTargetId("");
      setTargetSearch("");
      setNote("");
      await loadGrants();
    }
  };

  const filteredGrants = useMemo(() => {
    const q = grantSearch.trim().toLowerCase();
    if (!q) return grants;
    return grants.filter((gr) =>
      [gr.targetName, gr.targetType, gr.provider, ...(gr.allowedModules || []), gr.note]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [grants, grantSearch]);

  return (
    <div className={`p-5 rounded-2xl border space-y-5 ${g.card}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/[0.06]">
        <div className="flex items-start gap-3">
          <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${g.badge}`}>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <h3 className={`text-sm font-bold flex items-center gap-2 ${g.heading}`}>
              <span>Global Key Access Grants & Module Permissions</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono">
                {grants.filter((x) => x.isActive).length} active
              </span>
            </h3>
            <p className={`text-xs mt-0.5 ${g.muted}`}>
              Allow specific users, departments, or project teams to execute AI modules using Superadmin's Global Key — and revoke anytime.
            </p>
          </div>
        </div>
      </div>

      {/* Create Grant Form */}
      <form onSubmit={handleGrantSubmit} className={`p-4 rounded-xl border space-y-4 ${g.subtleSurface}`}>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className={`text-[11px] font-bold block mb-1.5 ${g.heading}`}>Entity Type</label>
            <div className="grid grid-cols-3 gap-1">
              {TARGET_TYPES.map((t) => {
                const Icon = t.icon;
                const active = targetType === t.key;
                const count =
                  t.key === "user"
                    ? (targets.users || []).length
                    : t.key === "department"
                    ? (targets.departments || []).length
                    : (targets.projects || []).length;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => {
                      setTargetType(t.key);
                      setTargetId("");
                      setTargetSearch("");
                      setDropdownOpen(false);
                    }}
                    className={`px-2 py-1.5 rounded-lg border text-[10px] font-semibold flex items-center justify-center gap-1 cursor-pointer transition-all ${
                      active ? g.selectedRow : `${g.btnSecondary} opacity-50 hover:opacity-90`
                    }`}
                    title={`${t.label} (${count})`}
                  >
                    <Icon className="w-3 h-3 shrink-0" />
                    <span className="truncate">{t.key === "project" ? "Team" : t.key} ({count})</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Searchable Target Selector Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <label className={`text-[11px] font-bold block mb-1.5 ${g.heading}`}>
              Select {targetType === "user" ? "User" : targetType === "department" ? "Department" : "Project / Team"} *
            </label>
            <button
              type="button"
              onClick={() => setDropdownOpen((o) => !o)}
              className={`w-full rounded-xl px-3 py-2 text-xs border flex items-center justify-between gap-2 text-left cursor-pointer ${g.input}`}
            >
              <span className="truncate">
                {selectedTargetObj
                  ? `${selectedTargetObj.fullname || selectedTargetObj.name}${
                      selectedTargetObj.publicId
                        ? ` (${selectedTargetObj.publicId})`
                        : selectedTargetObj.code
                        ? ` (${selectedTargetObj.code})`
                        : selectedTargetObj.prefix
                        ? ` [${selectedTargetObj.prefix}]`
                        : ""
                    }`
                  : `Search & choose ${targetType}... (${currentTargetList.length})`}
              </span>
              <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
            </button>

            {dropdownOpen && (
              <div
                className={`absolute left-0 right-0 mt-1.5 rounded-xl border shadow-2xl z-40 overflow-hidden ${g.dropdown}`}
              >
                <div className={`p-2 border-b ${g.border}`}>
                  <div className="relative">
                    <Search className={`w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 ${g.muted}`} />
                    <input
                      type="text"
                      autoFocus
                      value={targetSearch}
                      onChange={(e) => setTargetSearch(e.target.value)}
                      placeholder={`Search ${targetType} by name, email, ID...`}
                      className={`w-full rounded-lg pl-8 pr-2.5 py-1.5 text-xs border focus:outline-none ${g.input}`}
                    />
                  </div>
                </div>
                <div className="max-h-56 overflow-y-auto p-1 space-y-0.5">
                  {filteredTargets.length === 0 ? (
                    <div className={`p-3 text-center text-xs italic ${g.muted}`}>
                      No matching {targetType} found.
                    </div>
                  ) : (
                    filteredTargets.map((item) => {
                      const isSel = String(item._id) === String(targetId);
                      return (
                        <button
                          key={item._id}
                          type="button"
                          onClick={() => {
                            setTargetId(item._id);
                            setDropdownOpen(false);
                          }}
                          className={`w-full px-2.5 py-2 rounded-lg text-left text-xs flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                            isSel ? g.selectedRow : g.rowHover
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="font-semibold truncate">
                              {item.fullname || item.name}
                            </div>
                            <div className={`text-[10px] font-mono truncate ${g.muted}`}>
                              {item.email || item.description || ""}
                              {item.publicId ? ` · ${item.publicId}` : ""}
                              {item.role ? ` · ${item.role}` : ""}
                              {item.departmentName ? ` · ${item.departmentName}` : ""}
                              {item.code ? `Code: ${item.code}` : ""}
                              {item.prefix ? `Key: ${item.prefix}` : ""}
                            </div>
                          </div>
                          {isSel && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          <div>
            <label className={`text-[11px] font-bold block mb-1.5 ${g.heading}`}>Allowed AI Provider</label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              className={`w-full rounded-xl px-3 py-2 text-xs border focus:outline-none ${g.input}`}
            >
              <option value="all" className={isDark ? "bg-[#14151a]" : "bg-white"}>All Providers (*)</option>
              <option value="google" className={isDark ? "bg-[#14151a]" : "bg-white"}>Google Gemini Only</option>
              <option value="openai" className={isDark ? "bg-[#14151a]" : "bg-white"}>OpenAI GPT-6 Only</option>
              <option value="anthropic" className={isDark ? "bg-[#14151a]" : "bg-white"}>Anthropic Claude 5 Only</option>
            </select>
          </div>

          <div>
            <label className={`text-[11px] font-bold block mb-1.5 ${g.heading}`}>Note (Optional)</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Q4 Sprint AI Access"
              className={`w-full rounded-xl px-3 py-2 text-xs border focus:outline-none ${g.input}`}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`text-[11px] font-bold mr-1 ${g.muted}`}>Modules:</span>
            {moduleOptions.map((mod) => {
              const checked = selectedModules.includes(mod.key);
              return (
                <button
                  key={mod.key}
                  type="button"
                  onClick={() => toggleModule(mod.key)}
                  className={`px-2.5 py-1 rounded-full border text-[10px] font-semibold cursor-pointer transition-all ${
                    checked ? g.pillActive : `${g.pillInactive} opacity-55 hover:opacity-100`
                  }`}
                >
                  {mod.key === "*" ? "* All Modules" : mod.label}
                </button>
              );
            })}
          </div>

          <button
            type="submit"
            disabled={!targetId || submitting}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-40 ${g.btnPrimary}`}
          >
            {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            <span>Grant Global Key Access</span>
          </button>
        </div>
      </form>

      {/* Filter existing grants */}
      {grants.length > 0 && (
        <div className="relative max-w-sm">
          <Search className={`w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 ${g.muted}`} />
          <input
            type="text"
            value={grantSearch}
            onChange={(e) => setGrantSearch(e.target.value)}
            placeholder="Filter granted users, teams, or modules..."
            className={`w-full rounded-xl pl-8 pr-3 py-1.5 text-xs border focus:outline-none ${g.input}`}
          />
        </div>
      )}

      {/* Active & Revoked Grants Table */}
      {loading ? (
        <div className={`py-6 flex items-center justify-center gap-2 text-xs ${g.muted}`}>
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Loading Global Key Grants...</span>
        </div>
      ) : filteredGrants.length === 0 ? (
        <div className={`py-8 text-center rounded-xl border text-xs italic ${g.subtleSurface} ${g.muted}`}>
          No Global Key grants match. By default, only Superadmin can use Global Vault / .env keys; other users require their own BYOK key or a grant above.
        </div>
      ) : (
        <div className="space-y-2">
          {filteredGrants.map((gr) => (
            <div
              key={gr._id}
              className={`p-3.5 rounded-xl border flex flex-wrap items-center justify-between gap-3 transition-opacity ${
                gr.isActive ? g.selectedRow : `${g.subtleSurface} opacity-50`
              }`}
            >
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-md border text-[10px] font-mono uppercase font-bold ${g.badge}`}>
                    {gr.targetType}
                  </span>
                  <span className={`text-xs font-bold ${g.heading}`}>{gr.targetName}</span>
                  <span className="px-2 py-0.5 rounded-md bg-indigo-500/15 text-indigo-300 text-[10px] font-mono">
                    provider: {gr.provider}
                  </span>
                  {gr.isActive ? (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-[10px] font-bold">
                      ACTIVE
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-400 text-[10px] font-bold">
                      REVOKED
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                  <KeyRound className="w-3 h-3 text-purple-400 shrink-0" />
                  <span className={g.muted}>Modules:</span>
                  {(gr.allowedModules || []).map((m) => (
                    <span key={m} className={`px-1.5 py-0.2 rounded border font-mono ${g.badge}`}>
                      {m === "*" ? "ALL (*)" : m}
                    </span>
                  ))}
                  {gr.note && <span className={`ml-2 italic ${g.muted}`}>— "{gr.note}"</span>}
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {gr.isActive ? (
                  <button
                    type="button"
                    onClick={async () => {
                      await revokeAIGlobalGrant(gr._id);
                      await loadGrants();
                    }}
                    className="px-2.5 py-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-300 text-[11px] font-semibold flex items-center gap-1 hover:bg-amber-500/20 cursor-pointer"
                  >
                    <Ban className="w-3 h-3" />
                    <span>Revoke</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={async () => {
                      await restoreAIGlobalGrant(gr._id);
                      await loadGrants();
                    }}
                    className="px-2.5 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-[11px] font-semibold flex items-center gap-1 hover:bg-emerald-500/20 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Restore</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={async () => {
                    await deleteAIGlobalGrant(gr._id);
                    await loadGrants();
                  }}
                  className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/15 cursor-pointer"
                  title="Delete grant"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
