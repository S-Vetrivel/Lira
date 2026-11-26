import React, { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Sparkles,
  Send,
  ShieldAlert,
  Navigation,
  CheckCircle2,
  Loader2,
  Trash2,
  Zap,
  Eye,
  ArrowRight,
  KeyRound,
  ListChecks,
  Square,
} from "lucide-react";
import { useApp } from "../../context/Appcontext";
import {
  getAIAssistantSessionAPI,
  sendAIAssistantChatAPI,
  stopAIAssistantAPI,
  setAIAssistantModeAPI,
  confirmAIAssistantActionAPI,
  clearAIAssistantSessionAPI,
} from "../../services/api";
import { getSocket } from "../../services/socket";
import SideDrawer from "../common/SideDrawer";
import LiraLogo from "../common/LiraLogo";
import { getGlassTokens } from "../../styles/glassTheme";

function inferModuleFromPath(pathname) {
  if (pathname.startsWith("/board") || pathname.startsWith("/grid") || pathname.startsWith("/calendar")) return "board";
  if (pathname.startsWith("/my-work")) return "tasks";
  if (pathname.startsWith("/requests")) return "requests";
  if (pathname.startsWith("/projects")) return "projects";
  if (pathname.startsWith("/team")) return "team";
  if (pathname.startsWith("/roles")) return "roles";
  if (pathname.startsWith("/audit")) return "dashboard";
  if (pathname.startsWith("/profile")) return "ai";
  return "dashboard";
}

export default function LiraAssistantWidget() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    user,
    isSuperAdmin,
    hasPermission,
    activeProject,
    isAIAssistantOpen,
    setIsAIAssistantOpen,
    setAiPrefillDraft,
    aiExternalPrompt,
    setAiExternalPrompt,
    setIsCreateTaskModalOpen,
    setSelectedTaskKeyOrId,
    refreshProjects,
    refreshDepartments,
    refreshTeam,
    theme,
  } = useApp();

  const isDark = theme === "dark";
  const g = getGlassTokens(isDark);
  const canUseAI = Boolean(user && (isSuperAdmin || hasPermission("ai.use")));

  const [session, setSession] = useState(null);
  const [availableModels, setAvailableModels] = useState([]);
  const [hasExternalAccess, setHasExternalAccess] = useState(false);
  const [selectedModelKey, setSelectedModelKey] = useState("auto");
  const [mode, setMode] = useState("review"); // "review" | "auto"
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [confirmingMsgId, setConfirmingMsgId] = useState("");

  const messagesEndRef = useRef(null);

  const getHandledJobs = () => {
    try {
      return new Set(JSON.parse(sessionStorage.getItem("lira_ai_handled_jobs") || "[]"));
    } catch {
      return new Set();
    }
  };

  const markJobHandled = (jobId) => {
    if (!jobId) return;
    const set = getHandledJobs();
    set.add(jobId);
    const trimmed = Array.from(set).slice(-40);
    sessionStorage.setItem("lira_ai_handled_jobs", JSON.stringify(trimmed));
  };

  const applyCompletedMessageEffects = (msg, sourceMode) => {
    if (!msg || msg.status !== "completed" || !msg.jobId) return;
    const handled = getHandledJobs();
    if (handled.has(msg.jobId)) return;
    markJobHandled(msg.jobId);

    if (msg.navigateTo) {
      navigate(msg.navigateTo);
    }

    if (sourceMode === "auto" || msg.actionApplied) {
      refreshProjects?.();
      refreshDepartments?.();
      refreshTeam?.();
      if (msg.executedResult?.taskKey) {
        setSelectedTaskKeyOrId?.(msg.executedResult.taskKey);
      }
      if (msg.intent?.type === "open_task" && msg.intent?.prefill?.taskKey) {
        setSelectedTaskKeyOrId?.(msg.intent.prefill.taskKey);
      }
      return;
    }

    // REVIEW MODE: open relevant form & fill draft for user confirmation
    const targetIntent = msg.steps?.[0] || msg.intent;
    if (targetIntent?.type && targetIntent.type !== "navigate") {
      if (targetIntent.type === "open_task" && targetIntent.prefill?.taskKey) {
        setSelectedTaskKeyOrId?.(targetIntent.prefill.taskKey);
        return;
      }
      if (targetIntent.type === "create_task") {
        setAiPrefillDraft({ type: "create_task", data: targetIntent.prefill || {}, nonce: Date.now() });
        setIsCreateTaskModalOpen?.(true);
        return;
      }
      if (["create_request", "create_project", "create_department"].includes(targetIntent.type)) {
        setAiPrefillDraft({ type: targetIntent.type, data: targetIntent.prefill || {}, nonce: Date.now() });
      }
    }
  };

  const syncSession = async (triggerEffectsOnLatest = false) => {
    if (!canUseAI) return;
    const res = await getAIAssistantSessionAPI();
    if (res.success && res.session) {
      setSession(res.session);
      setMode(res.session.mode || "review");
      if (Array.isArray(res.options)) {
        setAvailableModels(res.options);
        setHasExternalAccess(Boolean(res.hasExternalAccess));
        if (res.session.selectedModelKey && res.session.selectedModelKey !== "auto") {
          setSelectedModelKey(res.session.selectedModelKey);
        } else if (!res.hasExternalAccess && res.options.length > 0) {
          setSelectedModelKey(res.options[0].id);
        }
      }
      if (triggerEffectsOnLatest && Array.isArray(res.session.messages) && res.session.messages.length > 0) {
        const last = res.session.messages[res.session.messages.length - 1];
        applyCompletedMessageEffects(last, last.mode || res.session.mode);
      }
    }
  };

  useEffect(() => {
    if (!canUseAI) return;
    syncSession(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canUseAI, user?._id]);

  // Listen to real-time AI job updates via Socket.IO
  useEffect(() => {
    if (!canUseAI) return;
    const socket = getSocket();
    if (!socket) return;
    const onAssistantUpdate = ({ session: updatedSession, jobId }) => {
      if (!updatedSession) return;
      setSession(updatedSession);
      const targetMsg = (updatedSession.messages || []).find((m) => m.jobId === jobId);
      if (targetMsg && targetMsg.status === "completed") {
        applyCompletedMessageEffects(targetMsg, targetMsg.mode || updatedSession.mode);
      }
    };
    socket.on("ai:assistant-update", onAssistantUpdate);
    return () => socket.off("ai:assistant-update", onAssistantUpdate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canUseAI]);

  const dispatchPrompt = async (promptText) => {
    const clean = String(promptText || "").trim();
    if (!clean || sending) return;
    setInput("");
    setSending(true);
    const res = await sendAIAssistantChatAPI({
      prompt: clean,
      mode,
      moduleKey: inferModuleFromPath(location.pathname),
      selectedModelKey,
      currentRoute: location.pathname,
      activeProjectId: activeProject?._id || null,
    });
    setSending(false);
    if (res.success && res.session) {
      setSession(res.session);
    }
  };

  // Trigger from CommandPalette "Ask AI"
  useEffect(() => {
    if (aiExternalPrompt?.text && canUseAI) {
      const txt = aiExternalPrompt.text;
      setAiExternalPrompt(null);
      dispatchPrompt(txt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiExternalPrompt]);

  const hasProcessing = useMemo(
    () => Boolean(session?.activeJobId || (session?.messages || []).some((m) => m.status === "processing")),
    [session]
  );

  // Fallback poll while background work runs so page reloads recover seamlessly
  useEffect(() => {
    if (!canUseAI || !hasProcessing) return;
    const iv = setInterval(() => {
      syncSession(true);
    }, 1800);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canUseAI, hasProcessing]);

  useEffect(() => {
    if (isAIAssistantOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [session?.messages, isAIAssistantOpen]);

  const quickPrompts = useMemo(() => {
    const prompts = [];
    if (isSuperAdmin || hasPermission("tasks.create")) {
      prompts.push({
        label: "Create & Assign + Notify",
        text: "Create a high priority task to review mobile release, assign it to Arun, post in project chat, and DM Arun",
      });
    }
    if (isSuperAdmin || hasPermission("requests.create")) {
      prompts.push({
        label: "Draft Request",
        text: "Help me submit an approval request for cloud testing tools worth 12000 INR",
      });
    }
    if (isSuperAdmin || hasPermission("projects.create")) {
      prompts.push({
        label: "New Project",
        text: "Create a new project workspace called Design System v2 with prefix DS2",
      });
    }
    prompts.push({
      label: "Open My Day",
      text: "Take me to My Day to review my assigned tasks",
    });
    return prompts;
  }, [isSuperAdmin, hasPermission]);

  if (!canUseAI) return null;

  const handleModeChange = async (nextMode) => {
    setMode(nextMode);
    await setAIAssistantModeAPI(nextMode);
  };

  const handleStopGeneration = async () => {
    setStopping(true);
    const res = await stopAIAssistantAPI(session?.activeJobId || "");
    setStopping(false);
    if (res.success && res.session) {
      setSession(res.session);
    }
  };

  const handleReviewOrApply = (msg) => {
    if (msg.navigateTo) navigate(msg.navigateTo);
    const targetIntent = msg.steps?.[0] || msg.intent;
    if (targetIntent?.type === "create_task") {
      setAiPrefillDraft({ type: "create_task", data: targetIntent.prefill || {}, nonce: Date.now() });
      setIsCreateTaskModalOpen?.(true);
      return;
    }
    if (targetIntent?.type === "open_task" && targetIntent.prefill?.taskKey) {
      setSelectedTaskKeyOrId?.(targetIntent.prefill.taskKey);
      return;
    }
    if (["create_request", "create_project", "create_department"].includes(targetIntent?.type)) {
      setAiPrefillDraft({ type: targetIntent.type, data: targetIntent.prefill || {}, nonce: Date.now() });
    }
  };

  const handleConfirmServerExecute = async (msg) => {
    setConfirmingMsgId(msg._id);
    const res = await confirmAIAssistantActionAPI(msg._id);
    setConfirmingMsgId("");
    if (res.success) {
      if (res.session) setSession(res.session);
      refreshProjects?.();
      refreshDepartments?.();
      refreshTeam?.();
      if (res.executedResult?.taskKey) {
        navigate(`/board?task=${res.executedResult.taskKey}`);
        setSelectedTaskKeyOrId?.(res.executedResult.taskKey);
      }
    }
  };

  const messages = session?.messages || [];

  return (
    <>
      {/* Bottom-Right Glass Pebble Circle Orb with Lira Logo */}
      {!isAIAssistantOpen && (
        <motion.button
          type="button"
          whileHover={{ scale: 1.07, y: -2 }}
          whileTap={{ scale: 0.94 }}
          onClick={() => setIsAIAssistantOpen(true)}
          title="Open Lira Workspace Assistant (Cmd+J)"
          aria-label="Open Lira Workspace Assistant"
          className="fixed bottom-5 right-5 z-[60] w-14 h-14 rounded-full flex items-center justify-center cursor-pointer backdrop-blur-2xl border transition-shadow"
          style={{
            background: isDark
              ? "radial-gradient(135% 135% at 30% 20%, rgba(255,255,255,0.28) 0%, rgba(168,85,247,0.18) 38%, rgba(20,22,30,0.82) 100%)"
              : "radial-gradient(135% 135% at 30% 20%, rgba(255,255,255,0.95) 0%, rgba(226,232,240,0.8) 50%, rgba(148,163,184,0.45) 100%)",
            borderColor: isDark ? "rgba(255,255,255,0.26)" : "rgba(255,255,255,0.85)",
            boxShadow: isDark
              ? "inset 0 2px 3px rgba(255,255,255,0.38), inset 0 -5px 12px rgba(0,0,0,0.55), 0 14px 34px rgba(0,0,0,0.55), 0 0 22px rgba(168,85,247,0.22)"
              : "inset 0 2px 4px rgba(255,255,255,0.95), inset 0 -5px 12px rgba(15,23,42,0.16), 0 14px 30px rgba(15,23,42,0.18)",
          }}
        >
          {/* Specular top glass glint */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-1.5 left-3 right-3 h-3 rounded-full opacity-60"
            style={{
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.65) 0%, rgba(255,255,255,0) 100%)",
            }}
          />
          <LiraLogo size="sm" showWordmark={false} isDark={isDark} className="relative z-10 pointer-events-none" />
          {hasProcessing && (
            <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-[#0e1017] animate-pulse" />
          )}
        </motion.button>
      )}

      <SideDrawer
        isOpen={isAIAssistantOpen}
        onClose={() => setIsAIAssistantOpen(false)}
        title="Lira Assistant"
        subtitle="Your workspace helper for tasks, project chat, messages, and quick navigation"
        icon={Sparkles}
        widthClass="max-w-xl"
        headerActions={
          <div className="flex items-center gap-1.5">
            {messages.length > 0 && (
              <button
                type="button"
                onClick={async () => {
                  const res = await clearAIAssistantSessionAPI();
                  if (res.success && res.session) setSession(res.session);
                }}
                className={`p-1.5 rounded-lg cursor-pointer ${g.iconBtn}`}
                title="Clear conversation"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        }
        footer={
          <form
            onSubmit={(e) => {
              e.preventDefault();
              dispatchPrompt(input);
            }}
            className="space-y-2.5"
          >
            {/* Mode Switcher + Accessible AI Model Picker */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleModeChange("review")}
                  className={`px-2.5 py-1 rounded-lg border font-semibold flex items-center gap-1 cursor-pointer transition-all ${
                    mode === "review" ? g.selectedRow : `${g.btnSecondary} opacity-50 hover:opacity-85`
                  }`}
                >
                  <Eye className="w-3 h-3 text-purple-400" />
                  <span>Review</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleModeChange("auto")}
                  className={`px-2.5 py-1 rounded-lg border font-semibold flex items-center gap-1 cursor-pointer transition-all ${
                    mode === "auto"
                      ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                      : `${g.btnSecondary} opacity-50 hover:opacity-85`
                  }`}
                >
                  <Zap className="w-3 h-3 text-emerald-400" />
                  <span>Auto</span>
                </button>
              </div>

              <select
                value={selectedModelKey}
                onChange={(e) => setSelectedModelKey(e.target.value)}
                className={`max-w-[230px] rounded-lg px-2.5 py-1 text-[11px] border focus:outline-none truncate ${g.input}`}
                title="Choose your available AI model or key"
              >
                {hasExternalAccess && (
                  <option value="auto" className={isDark ? "bg-[#14151a]" : "bg-white"}>
                    Auto (Best Available Key)
                  </option>
                )}
                {availableModels.map((opt) => (
                  <option key={opt.id} value={opt.id} className={isDark ? "bg-[#14151a]" : "bg-white"}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {!hasExternalAccess && (
              <div className={`px-3 py-2 rounded-xl border flex items-center justify-between gap-2 text-[11px] ${g.subtleSurface}`}>
                <span className={g.muted}>No external AI key added yet — using Quick Engine.</span>
                <button
                  type="button"
                  onClick={() => {
                    setIsAIAssistantOpen(false);
                    navigate("/profile?tab=ai");
                  }}
                  className="text-purple-400 font-bold hover:underline flex items-center gap-1 shrink-0 cursor-pointer"
                >
                  <KeyRound className="w-3 h-3" />
                  <span>Add Key</span>
                </button>
              </div>
            )}

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  hasProcessing
                    ? "Send a new message to redirect, or click Stop..."
                    : mode === "auto"
                    ? "Tell Lira what to create, assign, message, or open..."
                    : "Ask Lira to prepare tasks, messages, or navigate..."
                }
                className={`flex-1 rounded-xl px-3.5 py-2.5 text-xs border focus:outline-none ${g.input}`}
              />
              {hasProcessing && (
                <button
                  type="button"
                  disabled={stopping}
                  onClick={handleStopGeneration}
                  className="px-3 py-2.5 rounded-xl border border-rose-500/40 bg-rose-500/15 text-rose-300 text-xs font-bold flex items-center gap-1.5 hover:bg-rose-500/25 cursor-pointer disabled:opacity-50"
                  title="Stop current generation (keeps prompt in context)"
                >
                  <Square className="w-3 h-3 fill-current" />
                  <span>{stopping ? "Stopping..." : "Stop"}</span>
                </button>
              )}
              <button
                type="submit"
                disabled={!input.trim() || sending}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-40 ${g.btnPrimary}`}
              >
                {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>Send</span>
              </button>
            </div>
          </form>
        }
      >
        <div className="space-y-4">
          {messages.length === 0 ? (
            <div className={`p-5 rounded-2xl border space-y-4 ${g.subtleSurface}`}>
              <div className="flex items-start gap-3">
                <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${g.badge}`}>
                  <Sparkles className="w-4 h-4 text-purple-400" />
                </div>
                <div>
                  <h4 className={`text-xs font-bold ${g.heading}`}>How can I help across your workspace?</h4>
                  <p className={`text-[11px] mt-1 leading-relaxed ${g.muted}`}>
                    Ask me to create and assign tasks, post team updates, DM colleagues, submit requests, or jump between pages in a single flow.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {quickPrompts.map((qp) => (
                  <button
                    key={qp.label}
                    type="button"
                    onClick={() => setInput(qp.text)}
                    className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-semibold cursor-pointer ${g.btnSecondary}`}
                  >
                    {qp.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg, idx) => {
              const isUser = msg.role === "user";
              const isNeedsKey = msg.status === "no_key" || msg.needsKey;
              const isWarning = msg.role === "system_warning" || msg.status === "blocked" || msg.status === "denied";

              if (isUser) {
                return (
                  <div key={msg._id || idx} className="flex justify-end">
                    <div className={`max-w-[85%] p-3.5 rounded-2xl rounded-br-sm border text-xs ${g.selectedRow}`}>
                      <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                );
              }

              if (isNeedsKey) {
                return (
                  <div
                    key={msg._id || idx}
                    className="p-4 rounded-2xl border border-amber-500/35 bg-amber-500/10 space-y-3 text-xs text-amber-200"
                  >
                    <div className="flex items-center gap-2 font-bold">
                      <KeyRound className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>Personal AI Key Needed</span>
                    </div>
                    <p className="leading-relaxed">{msg.content}</p>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAIAssistantOpen(false);
                        navigate("/profile?tab=ai");
                      }}
                      className={`px-3 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1.5 cursor-pointer ${g.btnPrimary}`}
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>Enter My AI Key</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                );
              }

              if (isWarning) {
                return (
                  <div
                    key={msg._id || idx}
                    className="p-3.5 rounded-2xl border border-rose-500/35 bg-rose-500/10 space-y-1.5 text-xs text-rose-300"
                  >
                    <div className="flex items-center gap-2 font-bold">
                      <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>
                        {msg.status === "blocked" ? "Request Not Allowed" : "Access Unavailable"}
                      </span>
                    </div>
                    <p className="leading-relaxed">{msg.warning || msg.content}</p>
                  </div>
                );
              }

              const hasSteps = Array.isArray(msg.steps) && msg.steps.length > 0;

              return (
                <div
                  key={msg._id || idx}
                  className={`p-4 rounded-2xl border space-y-3 text-xs ${
                    msg.status === "stopped" ? `${g.subtleSurface} opacity-75 border-amber-500/25` : g.card
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 font-bold">
                      {msg.status === "processing" ? (
                        <Loader2 className="w-3.5 h-3.5 text-purple-400 animate-spin" />
                      ) : msg.status === "stopped" ? (
                        <Square className="w-3 h-3 text-amber-400 fill-current" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                      )}
                      <span className={g.heading}>Lira</span>
                    </div>
                    {msg.status === "processing" && (
                      <span className={`text-[10px] ${g.muted}`}>Working...</span>
                    )}
                    {msg.status === "stopped" && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 text-[10px] font-semibold">
                        Stopped
                      </span>
                    )}
                  </div>

                  <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>

                  {hasSteps && msg.status === "completed" && !msg.actionApplied && (
                    <div className={`p-3 rounded-xl border space-y-1.5 ${g.subtleSurface}`}>
                      <div className={`text-[10px] font-semibold flex items-center gap-1.5 ${g.muted}`}>
                        <ListChecks className="w-3.5 h-3.5 text-purple-400" />
                        <span>Planned Steps ({msg.steps.length})</span>
                      </div>
                      {msg.steps.map((st, sIdx) => (
                        <div key={sIdx} className="flex items-center gap-2 text-[11px]">
                          <span className="w-4 h-4 rounded-full bg-purple-500/20 text-purple-300 text-[10px] font-bold flex items-center justify-center shrink-0">
                            {sIdx + 1}
                          </span>
                          <span className="truncate">{st.label || st.type}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {msg.executedResult?.executed && (
                    <div className="p-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span className="font-semibold truncate">{msg.executedResult.summary}</span>
                      </div>
                      {msg.executedResult.taskKey && (
                        <button
                          type="button"
                          onClick={() => {
                            navigate(`/board?task=${msg.executedResult.taskKey}`);
                            setSelectedTaskKeyOrId?.(msg.executedResult.taskKey);
                          }}
                          className="px-2 py-1 rounded-lg bg-emerald-500/20 text-[10px] font-bold shrink-0 cursor-pointer"
                        >
                          Open {msg.executedResult.taskKey}
                        </button>
                      )}
                    </div>
                  )}

                  {msg.status === "completed" && (msg.navigateTo || msg.intent || hasSteps) && (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {msg.navigateTo && (
                        <button
                          type="button"
                          onClick={() => navigate(msg.navigateTo)}
                          className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold flex items-center gap-1 cursor-pointer ${g.btnSecondary}`}
                        >
                          <Navigation className="w-3 h-3 text-sky-400" />
                          <span>Open Page</span>
                        </button>
                      )}

                      {(msg.intent || hasSteps) && (msg.intent?.type !== "navigate") && !msg.actionApplied && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleReviewOrApply(msg)}
                            className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold flex items-center gap-1 cursor-pointer ${g.btnSecondary}`}
                          >
                            <Eye className="w-3 h-3 text-purple-400" />
                            <span>Review in Form</span>
                          </button>

                          {msg.intent?.type !== "open_task" && (
                            <button
                              type="button"
                              disabled={confirmingMsgId === msg._id}
                              onClick={() => handleConfirmServerExecute(msg)}
                              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50 ${g.btnPrimary}`}
                            >
                              {confirmingMsgId === msg._id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <ArrowRight className="w-3 h-3" />
                              )}
                              <span>{msg.steps?.length > 1 ? "Run All Steps" : "Confirm & Run"}</span>
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>
      </SideDrawer>
    </>
  );
}
