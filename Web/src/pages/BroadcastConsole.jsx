import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Megaphone,
  Send,
  Sparkles,
  Bell,
  Mail,
  Smartphone,
  Users,
  Wifi,
  WifiOff,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Loader2,
  Eye,
  Clock,
  ShieldCheck,
} from "lucide-react";
import { useApp } from "../context/Appcontext";
import { useModal } from "../context/ModalContext";
import {
  getBroadcastOverviewAPI,
  sendBroadcastNotificationAPI,
  draftBroadcastWithAIAPI,
} from "../services/api";
import { subscribeRealtimeEvents } from "../services/socket";
import { enableBrowserPush } from "../services/pushClient";
import { formatDateIN, formatTimeIN, formatNumberIN, getDisplayName } from "../utils/formatters";
import { getGlassTokens } from "../styles/glassTheme";
import toast from "react-hot-toast";

const CATEGORY_OPTIONS = [
  { key: "announcement", label: "Announcement", color: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30" },
  { key: "info", label: "General Info", color: "bg-sky-500/15 text-sky-300 border-sky-500/30" },
  { key: "release_update", label: "Release Update", color: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  { key: "maintenance", label: "Maintenance", color: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  { key: "urgent", label: "Urgent Alert", color: "bg-rose-500/15 text-rose-300 border-rose-500/30" },
];

const AUDIENCE_OPTIONS = [
  { key: "all", label: "All Active Users" },
  { key: "online_only", label: "Online Now" },
  { key: "offline_only", label: "Offline Users" },
  { key: "department", label: "By Department" },
  { key: "role", label: "By Role" },
  { key: "users", label: "Selected Users" },
];

const ACTION_ROUTES = [
  { value: "/", label: "Dashboard (/)" },
  { value: "/projects", label: "Workspaces & Departments (/projects)" },
  { value: "/board", label: "Sprint Board (/board)" },
  { value: "/requests", label: "Requests & Approvals (/requests)" },
  { value: "/my-work", label: "My Day (/my-work)" },
  { value: "/team", label: "Team Directory (/team)" },
  { value: "/audit", label: "Audit & Live Presence (/audit)" },
  { value: "/profile", label: "Profile & AI Keys (/profile)" },
];

export default function BroadcastConsole() {
  const { isSuperAdmin, hasPermission, theme, pushPermission, setPushPermission } = useApp();
  const { confirm } = useModal();
  const isDark = theme === "dark";
  const g = getGlassTokens(isDark);

  const canSend = isSuperAdmin || hasPermission("broadcast.send");
  const canUseAi = isSuperAdmin || hasPermission("broadcast.ai") || canSend;

  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState({
    capabilities: { isVapidConfigured: false, isSmtpConfigured: false },
    summary: { totalActiveUsers: 0, onlineCount: 0, offlineCount: 0, pushSubscribedCount: 0 },
    departments: [],
    roles: [],
    users: [],
    history: [],
  });

  // Composer Form State
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState("announcement");
  const [actionUrl, setActionUrl] = useState("/");
  const [audienceType, setAudienceType] = useState("all");
  const [selectedDepts, setSelectedDepts] = useState([]);
  const [selectedRoles, setSelectedRoles] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [channels, setChannels] = useState({
    inApp: true,
    webPush: true,
    email: false,
    offlineOnlyEmail: true,
  });
  const [sending, setSending] = useState(false);

  // AI Composer State
  const [aiBrief, setAiBrief] = useState("");
  const [aiTone, setAiTone] = useState("professional");
  const [draftingAi, setDraftingAi] = useState(false);
  const [aiGenerated, setAiGenerated] = useState(false);

  const loadOverview = useCallback(async ({ showSpinner = false } = {}) => {
    if (showSpinner) setLoading(true);
    const res = await getBroadcastOverviewAPI();
    if (res.success) {
      setOverview(res);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    getBroadcastOverviewAPI().then((res) => {
      if (!active) return;
      if (res.success) setOverview(res);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const unsub = subscribeRealtimeEvents(["broadcast:history-updated", "presence:update"], () => {
      loadOverview();
    });
    return unsub;
  }, [loadOverview]);

  const estimatedRecipients = useMemo(() => {
    const users = overview.users || [];
    if (audienceType === "all") return users.length;
    if (audienceType === "online_only") return users.filter((u) => u.isOnline).length;
    if (audienceType === "offline_only") return users.filter((u) => !u.isOnline).length;
    if (audienceType === "department") {
      if (selectedDepts.length === 0) return 0;
      const set = new Set(selectedDepts.map(String));
      return users.filter((u) => u.department && set.has(String(u.department))).length;
    }
    if (audienceType === "role") {
      if (selectedRoles.length === 0) return 0;
      const set = new Set(selectedRoles.map((r) => r.toLowerCase()));
      return users.filter((u) => set.has(String(u.role || "").toLowerCase())).length;
    }
    if (audienceType === "users") return selectedUsers.length;
    return 0;
  }, [overview.users, audienceType, selectedDepts, selectedRoles, selectedUsers]);

  const toggleItem = (setter, val) => {
    setter((prev) => (prev.includes(val) ? prev.filter((x) => x !== val) : [...prev, val]));
  };

  const handleAIDraft = async (e) => {
    e?.preventDefault();
    if (!aiBrief.trim() || draftingAi) return;
    setDraftingAi(true);
    const res = await draftBroadcastWithAIAPI({
      brief: aiBrief.trim(),
      tone: aiTone,
      category,
      audienceHint: audienceType,
    });
    setDraftingAi(false);

    if (res.success && res.draft) {
      setTitle(res.draft.title || "");
      setMessage(res.draft.message || "");
      if (res.draft.category) setCategory(res.draft.category);
      if (res.draft.suggestedActionUrl) setActionUrl(res.draft.suggestedActionUrl);
      if (res.draft.suggestedChannels) {
        setChannels((prev) => ({ ...prev, ...res.draft.suggestedChannels }));
      }
      setAiGenerated(true);
      toast.success(
        res.draft.source === "ai"
          ? `Drafted with ${res.draft.provider || "AI"} (${res.draft.model || "model"})`
          : "Draft composed with built-in template assistant"
      );
    }
  };

  const handleEnableOwnPush = async () => {
    const res = await enableBrowserPush({ interactive: true });
    if (res.permission) setPushPermission?.(res.permission);
    if (res.subscribed) {
      toast.success("This browser is subscribed to Web Push alerts!");
      loadOverview();
    } else if (res.reason === "denied") {
      toast.error("Browser push permission is blocked in Site Settings.");
    } else if (res.reason === "missing_vapid_key") {
      toast("VAPID key not configured — in-app & WebSocket banners remain live.");
    }
  };

  const handleSend = async (e) => {
    e?.preventDefault();
    if (!canSend || sending) return;
    if (!title.trim() || !message.trim()) {
      toast.error("Enter both a title and notification message.");
      return;
    }
    if (estimatedRecipients === 0) {
      toast.error("Select at least one recipient matching your target audience.");
      return;
    }
    if (!channels.inApp && !channels.webPush && !channels.email) {
      toast.error("Enable at least one delivery channel (In-App, Web Push, or Email).");
      return;
    }

    const ok = await confirm({
      title: "Send Broadcast Notification",
      message: `Deliver "${title.trim()}" to ${estimatedRecipients} user(s) via ${[
        channels.inApp && "In-App",
        channels.webPush && "Web Push",
        channels.email && (channels.offlineOnlyEmail ? "Email (Offline only)" : "Email"),
      ]
        .filter(Boolean)
        .join(", ")}?`,
      confirmLabel: "Send Broadcast",
      variant: category === "urgent" ? "danger" : "primary",
    });
    if (!ok) return;

    setSending(true);
    const res = await sendBroadcastNotificationAPI({
      title: title.trim(),
      message: message.trim(),
      category,
      actionUrl,
      audienceType,
      targetDepartments: selectedDepts,
      targetRoles: selectedRoles,
      targetUsers: selectedUsers,
      channels,
      aiGenerated,
      aiPrompt: aiBrief.trim(),
    });
    setSending(false);

    if (res.success) {
      setTitle("");
      setMessage("");
      setAiBrief("");
      setAiGenerated(false);
      loadOverview();
    }
  };

  return (
    <div className="flex-1 w-full h-full min-h-0 overflow-y-auto p-3.5 sm:p-7 space-y-6">
      {/* Header */}
      <div className={`flex flex-wrap items-center justify-between gap-4 pb-4 border-b ${g.border}`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-2xl border flex items-center justify-center ${g.badge}`}>
            <Megaphone className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h1 className={`text-xl sm:text-2xl font-extrabold tracking-tight ${g.heading}`}>
              Push & Broadcast Console
            </h1>
            <p className={`text-xs mt-0.5 ${g.muted}`}>
              Send org-wide or targeted In-App Alerts, Browser Web Push, and Email broadcasts with AI drafting.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
              overview.capabilities?.isVapidConfigured
                ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                : "bg-amber-500/15 text-amber-300 border-amber-500/30"
            }`}
          >
            WebPush: {overview.capabilities?.isVapidConfigured ? "VAPID Active" : "Log Simulation"}
          </span>
          <span
            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
              overview.capabilities?.isSmtpConfigured
                ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                : "bg-amber-500/15 text-amber-300 border-amber-500/30"
            }`}
          >
            Email: {overview.capabilities?.isSmtpConfigured ? "SMTP Ready" : "SMTP Unset"}
          </span>
          {pushPermission !== "granted" && (
            <button
              type="button"
              onClick={handleEnableOwnPush}
              className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${g.btnSecondary}`}
            >
              <Smartphone className="w-3.5 h-3.5 text-indigo-400" />
              <span>Subscribe This Browser</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => loadOverview({ showSpinner: true })}
            disabled={loading}
            className={`p-2 rounded-xl border text-xs cursor-pointer ${g.btnSecondary}`}
            title="Refresh Audience & Logs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Live Metrics Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className={`p-4 rounded-2xl border ${g.card}`}>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className={g.muted}>Active Staff</span>
            <Users className="w-4 h-4 text-indigo-400" />
          </div>
          <p className={`text-2xl font-extrabold font-mono ${g.heading}`}>
            {formatNumberIN(overview.summary?.totalActiveUsers || 0)}
          </p>
        </div>

        <div className={`p-4 rounded-2xl border ${g.card}`}>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className={g.muted}>Online Now (Live WS)</span>
            <Wifi className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-extrabold font-mono text-emerald-400">
            {formatNumberIN(overview.summary?.onlineCount || 0)}
          </p>
        </div>

        <div className={`p-4 rounded-2xl border ${g.card}`}>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className={g.muted}>Offline Users</span>
            <WifiOff className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-extrabold font-mono text-amber-400">
            {formatNumberIN(overview.summary?.offlineCount || 0)}
          </p>
        </div>

        <div className={`p-4 rounded-2xl border ${g.card}`}>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className={g.muted}>PWA / Push Subscribers</span>
            <Bell className="w-4 h-4 text-sky-400" />
          </div>
          <p className="text-2xl font-extrabold font-mono text-sky-400">
            {formatNumberIN(overview.summary?.pushSubscribedCount || 0)}
          </p>
        </div>
      </div>

      {/* Main Split Grid: Composer + History */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* LEFT: AI COMPOSER + BROADCAST FORM */}
        <div className="xl:col-span-7 space-y-5">
          {/* AI Composer Panel */}
          {canUseAi && (
            <form
              onSubmit={handleAIDraft}
              className={`p-4 sm:p-5 rounded-2xl border space-y-3 ${g.card}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  <h2 className={`text-sm font-bold ${g.heading}`}>AI Broadcast Composer</h2>
                </div>
                <div className="flex items-center gap-1.5">
                  {["professional", "urgent", "friendly"].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setAiTone(t)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase border cursor-pointer ${
                        aiTone === t ? g.pillActive : g.btnSecondary
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={aiBrief}
                  onChange={(e) => setAiBrief(e.target.value)}
                  placeholder="Describe what to announce (e.g. 'Deploying Lira v1.0.1 at 8 PM, please refresh workspace')..."
                  className={`flex-1 rounded-xl px-3.5 py-2 text-xs border focus:outline-none ${g.input}`}
                />
                <button
                  type="submit"
                  disabled={!aiBrief.trim() || draftingAi}
                  className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50 ${g.btnPrimary}`}
                >
                  {draftingAi ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  <span>{draftingAi ? "Drafting..." : "Draft with AI"}</span>
                </button>
              </div>
            </form>
          )}

          {/* Broadcast Composition Form */}
          <form onSubmit={handleSend} className={`p-4 sm:p-6 rounded-2xl border space-y-5 ${g.card}`}>
            <div className="flex items-center justify-between gap-2">
              <h2 className={`text-sm font-bold ${g.heading}`}>Compose & Target Broadcast</h2>
              <span className={`px-2.5 py-1 rounded-full text-[11px] font-mono font-bold border ${g.badge}`}>
                {estimatedRecipients} recipient{estimatedRecipients === 1 ? "" : "s"} matched
              </span>
            </div>

            {/* Category */}
            <div className="space-y-1.5">
              <label className={`text-[11px] font-bold uppercase tracking-wider ${g.muted}`}>Category</label>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORY_OPTIONS.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => setCategory(c.key)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border cursor-pointer transition-all ${
                      category === c.key ? `${c.color} ring-1 ring-current` : g.btnSecondary
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Audience Target */}
            <div className="space-y-2">
              <label className={`text-[11px] font-bold uppercase tracking-wider ${g.muted}`}>Target Audience</label>
              <div className="flex flex-wrap gap-1.5">
                {AUDIENCE_OPTIONS.map((a) => (
                  <button
                    key={a.key}
                    type="button"
                    onClick={() => setAudienceType(a.key)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border cursor-pointer ${
                      audienceType === a.key ? g.pillActive : g.btnSecondary
                    }`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>

              {audienceType === "department" && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {(overview.departments || []).map((d) => (
                    <button
                      key={d._id}
                      type="button"
                      onClick={() => toggleItem(setSelectedDepts, d._id)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border cursor-pointer ${
                        selectedDepts.includes(d._id) ? g.selectedRow : g.btnSecondary
                      }`}
                    >
                      {d.code} · {d.name}
                    </button>
                  ))}
                </div>
              )}

              {audienceType === "role" && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {(overview.roles || []).map((r) => (
                    <button
                      key={r._id || r.name}
                      type="button"
                      onClick={() => toggleItem(setSelectedRoles, r.name)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border cursor-pointer ${
                        selectedRoles.includes(r.name) ? g.selectedRow : g.btnSecondary
                      }`}
                    >
                      {r.displayName || r.name}
                    </button>
                  ))}
                </div>
              )}

              {audienceType === "users" && (
                <div className={`max-h-40 overflow-y-auto p-2 rounded-xl border grid grid-cols-1 sm:grid-cols-2 gap-1.5 ${g.subtleSurface}`}>
                  {(overview.users || []).map((u) => {
                    const checked = selectedUsers.includes(u._id);
                    return (
                      <label
                        key={u._id}
                        className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border text-[11px] cursor-pointer ${
                          checked ? g.selectedRow : g.border
                        }`}
                      >
                        <span className="flex items-center gap-2 min-w-0 truncate">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleItem(setSelectedUsers, u._id)}
                          />
                          <span className="truncate font-semibold">{u.fullname}</span>
                        </span>
                        <span className={`text-[9px] font-mono ${u.isOnline ? "text-emerald-400" : g.muted}`}>
                          {u.isOnline ? "Online" : "Offline"}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Title & Action Link */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2 space-y-1">
                <label className={`text-[11px] font-bold uppercase tracking-wider ${g.muted}`}>Title *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Headline for Push, Bell & Email..."
                  className={`w-full rounded-xl px-3.5 py-2 text-xs border focus:outline-none ${g.input}`}
                  required
                />
              </div>
              <div className="space-y-1">
                <label className={`text-[11px] font-bold uppercase tracking-wider ${g.muted}`}>Click Action Route</label>
                <select
                  value={actionUrl}
                  onChange={(e) => setActionUrl(e.target.value)}
                  className={`w-full rounded-xl px-3 py-2 text-xs border focus:outline-none ${g.input}`}
                >
                  {ACTION_ROUTES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Body Message */}
            <div className="space-y-1">
              <label className={`text-[11px] font-bold uppercase tracking-wider ${g.muted}`}>Message *</label>
              <textarea
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Write the message every target user should receive..."
                className={`w-full rounded-xl px-3.5 py-2.5 text-xs border focus:outline-none ${g.input}`}
                required
              />
            </div>

            {/* Delivery Channels */}
            <div className="space-y-2">
              <label className={`text-[11px] font-bold uppercase tracking-wider ${g.muted}`}>Delivery Channels</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <label className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs cursor-pointer ${channels.inApp ? g.selectedRow : g.subtleSurface}`}>
                  <input
                    type="checkbox"
                    checked={channels.inApp}
                    onChange={(e) => setChannels((c) => ({ ...c, inApp: e.target.checked }))}
                  />
                  <Bell className="w-3.5 h-3.5 text-amber-400" />
                  <span className="font-semibold">In-App & WS</span>
                </label>

                <label className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs cursor-pointer ${channels.webPush ? g.selectedRow : g.subtleSurface}`}>
                  <input
                    type="checkbox"
                    checked={channels.webPush}
                    onChange={(e) => setChannels((c) => ({ ...c, webPush: e.target.checked }))}
                  />
                  <Smartphone className="w-3.5 h-3.5 text-sky-400" />
                  <span className="font-semibold">PWA Web Push</span>
                </label>

                <label className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs cursor-pointer ${channels.email ? g.selectedRow : g.subtleSurface}`}>
                  <input
                    type="checkbox"
                    checked={channels.email}
                    onChange={(e) => setChannels((c) => ({ ...c, email: e.target.checked }))}
                  />
                  <Mail className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="font-semibold">Email Alert</span>
                </label>
              </div>

              {channels.email && (
                <label className={`flex items-center gap-2 text-[11px] pl-1 cursor-pointer ${g.muted}`}>
                  <input
                    type="checkbox"
                    checked={channels.offlineOnlyEmail}
                    onChange={(e) => setChannels((c) => ({ ...c, offlineOnlyEmail: e.target.checked }))}
                  />
                  <span>Only email users who are currently offline</span>
                </label>
              )}
            </div>

            {/* Live Preview */}
            {(title || message) && (
              <div className={`p-3.5 rounded-xl border space-y-1.5 ${g.subtleSurface}`}>
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider opacity-70">
                  <Eye className="w-3 h-3" /> Live Notification Preview
                </div>
                <p className={`text-xs font-bold ${g.heading}`}>{title || "Untitled Broadcast"}</p>
                <p className={`text-[11px] whitespace-pre-wrap ${g.muted}`}>{message}</p>
              </div>
            )}

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={!canSend || sending || estimatedRecipients === 0}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer disabled:opacity-50 ${g.btnPrimary}`}
              >
                {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>
                  {sending
                    ? "Dispatching Broadcast..."
                    : `Send to ${estimatedRecipients} User${estimatedRecipients === 1 ? "" : "s"}`}
                </span>
              </button>
            </div>
          </form>
        </div>

        {/* RIGHT: DELIVERY HISTORY */}
        <div className={`xl:col-span-5 p-4 sm:p-5 rounded-2xl border flex flex-col gap-4 ${g.card}`}>
          <div className="flex items-center justify-between">
            <h2 className={`text-sm font-bold ${g.heading}`}>Broadcast Delivery History</h2>
            <span className={`text-[11px] font-mono ${g.muted}`}>{(overview.history || []).length} sent</span>
          </div>

          <div className="space-y-3 max-h-[680px] overflow-y-auto pr-1">
            {(overview.history || []).map((item) => {
              const catMeta = CATEGORY_OPTIONS.find((c) => c.key === item.category) || CATEGORY_OPTIONS[0];
              return (
                <div key={item._id} className={`p-3.5 rounded-xl border space-y-2 ${g.subtleSurface}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 mb-1">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border ${catMeta.color}`}>
                          {catMeta.label}
                        </span>
                        {item.aiGenerated && (
                          <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 flex items-center gap-0.5">
                            <Sparkles className="w-2.5 h-2.5" /> AI
                          </span>
                        )}
                      </div>
                      <h3 className={`text-xs font-bold ${g.heading}`}>{item.title}</h3>
                    </div>
                    <span className={`text-[10px] font-mono shrink-0 flex items-center gap-1 ${g.muted}`}>
                      <Clock className="w-3 h-3" />
                      {formatDateIN(item.createdAt)} {formatTimeIN(item.createdAt)}
                    </span>
                  </div>

                  <p className={`text-[11px] line-clamp-3 leading-relaxed ${g.muted}`}>{item.message}</p>

                  <div className={`pt-2 border-t flex flex-wrap items-center justify-between gap-2 text-[10px] ${g.border}`}>
                    <span className={`flex items-center gap-1 ${g.muted}`}>
                      <ShieldCheck className="w-3 h-3 text-indigo-400" />
                      {getDisplayName(item.sentBy, "Admin")} · {item.audienceType.replace(/_/g, " ")}
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5 font-mono">
                      <span className={`px-1.5 py-0.5 rounded border ${g.badge}`}>
                        In-App: {item.stats?.inAppDelivered || 0}
                      </span>
                      <span className="px-1.5 py-0.5 rounded border border-sky-500/30 bg-sky-500/10 text-sky-400">
                        Push: {item.stats?.webPushSent || 0}
                      </span>
                      <span className="px-1.5 py-0.5 rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                        Email: {item.stats?.emailsQueued || 0}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}

            {!loading && (overview.history || []).length === 0 && (
              <div className={`py-12 text-center space-y-2 text-xs ${g.muted}`}>
                <CheckCircle2 className="w-7 h-7 mx-auto opacity-50" />
                <p>No broadcasts dispatched yet. Use the composer to notify your team.</p>
              </div>
            )}

            {!overview.capabilities?.isVapidConfigured && (
              <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-[11px] text-amber-200 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                <span>Set `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` in Backend `.env` and `VITE_VAPID_PUBLIC_KEY` in Web `.env` for live browser Web Push delivery.</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
