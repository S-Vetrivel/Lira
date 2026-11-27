import React, { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import {
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
  Paperclip,
  X,
  FileText,
} from "lucide-react";
import { useApp } from "../../context/Appcontext";
import { useModal } from "../../context/ModalContext";
import {
  getAIAssistantSessionAPI,
  sendAIAssistantChatAPI,
  uploadAIAssistantFilesAPI,
  deleteAIAssistantUploadAPI,
  executeAIAssistantCardStepAPI,
  stopAIAssistantAPI,
  setAIAssistantModeAPI,
  confirmAIAssistantActionAPI,
  clearAIAssistantSessionAPI,
} from "../../services/api";
import { initSocketClient, subscribeRealtimeEvents, emitLocalRealtimeEvent } from "../../services/socket";
import SideDrawer from "../common/SideDrawer";
import LiraLogo, { LiraLogoMark } from "../common/LiraLogo";
import { SanitizedCopilotHtml, CopilotArtifactsList } from "./CopilotRichContent";
import { getGlassTokens } from "../../styles/glassTheme";

function inferModuleFromPath(pathname) {
  if (pathname.startsWith("/board") || pathname.startsWith("/grid") || pathname.startsWith("/table") || pathname.startsWith("/calendar")) return "board";
  if (pathname.startsWith("/my-work")) return "tasks";
  if (pathname.startsWith("/requests")) return "requests";
  if (pathname.startsWith("/projects")) return "projects";
  if (pathname.startsWith("/team")) return "team";
  if (pathname.startsWith("/roles")) return "rbac";
  if (pathname.startsWith("/audit")) return "audit";
  if (pathname.startsWith("/broadcast")) return "broadcast";
  if (pathname.startsWith("/profile")) return "ai";
  return "dashboard";
}

async function computeFileFingerprint(file) {
  try {
    const slice = file.slice(0, 256 * 1024);
    const buf = await slice.arrayBuffer();
    if (typeof crypto !== "undefined" && crypto.subtle) {
      const digest = await crypto.subtle.digest("SHA-256", buf);
      const hex = Array.from(new Uint8Array(digest))
        .slice(0, 12)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      return `${file.size}:${file.type}:${hex}`;
    }
    return `${file.name}:${file.size}:${file.type}:${file.lastModified}`;
  } catch {
    return `${file.name}:${file.size}:${file.type}:${file.lastModified}`;
  }
}

function formatPlainCopilotText(rawContent, prevPrompt = "") {
  const txt = String(rawContent || "").trim();
  const wantsStructured = /\b(in|as|show|format|output|return)\s+(raw\s+)?(json|yaml|csv|table)\b/i.test(
    String(prevPrompt || "")
  );
  if (wantsStructured || !txt.startsWith("{")) return txt;
  const cleaned = txt.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (parsed && typeof parsed === "object" && (parsed.reply || parsed.message)) {
      return String(parsed.reply || parsed.message).trim();
    }
  } catch {
    const m = cleaned.match(/"reply"\s*:\s*"((?:[^"\\]|\\.)*)(?:"|$)/);
    if (m?.[1]) return m[1].replace(/\\n/g, "\n").replace(/\\"/g, '"').trim();
  }
  return txt;
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
    triggerAICursor,
    playAICursorSequence,
    closeAllSidebars,
    setIsCreateTaskModalOpen,
    setSelectedTaskKeyOrId,
    refreshProjects,
    refreshDepartments,
    refreshTeam,
    refreshRoles,
    refreshNotifications,
    toggleTheme,
    openDirectChat,
    openRoomChat,
    teamMembers,
    theme,
  } = useApp();

  const isDark = theme === "dark";
  const g = getGlassTokens(isDark);
  const { confirm } = useModal();
  const canUseAI = Boolean(user && (isSuperAdmin || hasPermission("ai.use")));

  const [session, setSession] = useState(null);
  const [availableModels, setAvailableModels] = useState([]);
  const [hasExternalAccess, setHasExternalAccess] = useState(false);
  const [selectedModelKey, setSelectedModelKey] = useState("auto");
  const [mode, setMode] = useState("review"); // "review" | "auto"
  const [input, setInput] = useState("");
  const [pendingAttachments, setPendingAttachments] = useState([]);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [sending, setSending] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [confirmingMsgId, setConfirmingMsgId] = useState("");
  const [streamingChunks, setStreamingChunks] = useState({});
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const dragCounterRef = useRef(0);
  const recentFileHashesRef = useRef(new Map());
  const hasHydratedPrefsRef = useRef(false);
  const myTabJobsRef = useRef(new Set());
  const isOpenRef = useRef(isAIAssistantOpen);
  useEffect(() => {
    isOpenRef.current = isAIAssistantOpen;
  }, [isAIAssistantOpen]);
  const uploadingCount = useMemo(
    () => pendingAttachments.filter((a) => a.status === "uploading").length,
    [pendingAttachments]
  );
  const uploadingFiles = uploadingCount > 0;

  // 4-corner Glass Pebble position (numeric pixel transform for slow silky pull & drop animation; resets to "bottom-right" on reload)
  const [corner, setCorner] = useState("bottom-right");
  const [dragPos, setDragPos] = useState(null);
  const [isDraggingPebble, setIsDraggingPebble] = useState(false);
  const [viewport, setViewport] = useState(() =>
    typeof window !== "undefined"
      ? { w: window.innerWidth, h: window.innerHeight }
      : { w: 1280, h: 800 }
  );
  const pebbleRef = useRef(null);

  useEffect(() => {
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

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

  const runCursorWalkthroughForMessage = (msg) => {
    const step0 = msg?.steps?.[0] || msg?.intent;
    const type = step0?.type || "";
    const pf = { ...(step0?.prefill || {}) };

    if (type === "toggle_theme") {
      closeAllSidebars?.();
      playAICursorSequence?.([
        { selector: '[data-ai-target="theme-toggle-btn"], button[aria-label="Toggle Theme"]', label: "1. Switching Theme", delayMs: 650 },
      ]);
      setTimeout(() => toggleTheme?.(), 500);
      return;
    }

    if (type === "open_notifications" || type === "mark_notifications_read") {
      closeAllSidebars?.();
      playAICursorSequence?.([
        { selector: '[data-ai-target="notifications-bell-btn"]', label: "1. Opening Notifications", delayMs: 700 },
      ]);
      setTimeout(() => {
        document.querySelector('[data-ai-target="notifications-bell-btn"]')?.click();
        if (type === "mark_notifications_read") {
          playAICursorSequence?.([
            { selector: '[data-ai-target="notifications-mark-read-btn"]', label: "2. Click Mark All Read", delayMs: 900 },
          ]);
        }
      }, 650);
      return;
    }

    if (["send_dm", "send_project_chat", "open_chat"].includes(type)) {
      closeAllSidebars?.("chat");
      if (type === "send_dm" && pf.recipientId) {
        const target = (teamMembers || []).find((m) => String(m._id) === String(pf.recipientId)) || { _id: pf.recipientId };
        openDirectChat?.(target);
      } else {
        const rid = pf.roomId || (pf.projectId ? `project_${pf.projectId}` : "dept_general");
        openRoomChat?.({ roomId: rid });
      }
      if (pf.message) {
        setTimeout(() => {
          setAiPrefillDraft({ type: "chat_draft", data: { text: pf.message }, nonce: Date.now() });
        }, 120);
      }
      setTimeout(() => {
        playAICursorSequence?.([
          { selector: '[data-ai-target="chat-message-input"]', label: "1. Drafting Message", delayMs: 800 },
          { selector: '[data-ai-target="chat-send-btn"]', label: "2. Review & Send", delayMs: 1000 },
        ]);
      }, 300);
      return;
    }

    const keepTaskOpen = [
      "open_task",
      "update_task",
      "update_task_status",
      "assign_task",
      "submit_task_review",
      "approve_task",
      "redo_task",
      "add_subtask",
      "toggle_subtask",
      "add_task_comment",
      "add_worklog",
      "delete_task",
    ].includes(type);

    closeAllSidebars?.(keepTaskOpen ? "task" : null);
    if (msg?.navigateTo) navigate(msg.navigateTo);

    if (type === "create_task") {
      if (!pf.dueDate && (window.location.pathname.startsWith("/calendar") || msg.navigateTo?.startsWith("/calendar"))) {
        pf.dueDate = new Date().toISOString().slice(0, 10);
      }
      setTimeout(() => {
        playAICursorSequence?.([
          { selector: '[data-ai-target="calendar-add-task-btn"], [data-ai-target="header-new-task-btn"], button[title*="New Task"]', label: "1. Opening Task Creator", delayMs: 800 },
        ]);
        setTimeout(() => {
          setAiPrefillDraft({ type: "create_task", data: { ...pf, cursorWalkthrough: true }, nonce: Date.now() });
          setIsCreateTaskModalOpen?.(true);
          playAICursorSequence?.([
            { selector: '[data-ai-target="task-title-input"]', label: "2. Typing Title", delayMs: 900 },
            { selector: '[data-ai-target="task-duedate-input"]', label: "3. Setting Schedule Date", delayMs: 850 },
            { selector: '[data-ai-target="task-priority-select"]', label: "4. Picking Priority", delayMs: 750 },
            { selector: '[data-ai-target="task-submit-btn"]', label: "5. Ready — Click Create Task", delayMs: 1100 },
          ]);
        }, 800);
      }, 220);
      return;
    }

    if (keepTaskOpen) {
      const targetKey = pf.taskId || pf.taskKey;
      setTimeout(() => {
        if (targetKey) setSelectedTaskKeyOrId?.(targetKey);
        const taskSeq = [
          { selector: '[data-ai-target="task-status-select"]', label: "1. Inspecting Task", delayMs: 750 },
        ];
        if (type === "submit_task_review") {
          taskSeq.push({ selector: '[data-ai-target="task-submit-review-btn"]', label: "2. Click Submit for Review", delayMs: 1000 });
        } else if (type === "approve_task") {
          taskSeq.push({ selector: '[data-ai-target="task-approve-btn"]', label: "2. Click Approve Task", delayMs: 1000 });
        } else if (type === "redo_task") {
          taskSeq.push({ selector: '[data-ai-target="task-redo-btn"]', label: "2. Click Request Revision", delayMs: 1000 });
        } else if (type === "add_task_comment") {
          taskSeq.push({ selector: '[data-ai-target="task-comment-input"]', label: "2. Write Comment", delayMs: 1000 });
        } else if (type === "delete_task") {
          taskSeq.push({ selector: '[data-ai-target="task-delete-btn"]', label: "2. Confirm Delete Task", delayMs: 1000 });
        }
        setTimeout(() => playAICursorSequence?.(taskSeq), 450);
      }, 260);
      return;
    }

    if (["create_role", "update_role", "delete_role", "grant_ai_access", "revoke_ai_access", "update_ai_config"].includes(type)) {
      if (!window.location.pathname.startsWith("/roles")) navigate(type.includes("ai") ? "/roles?tab=ai" : "/roles");
      setTimeout(() => {
        if (type === "create_role" || type === "update_role") {
          playAICursorSequence?.([
            { selector: '[data-ai-target="new-role-btn"]', label: "1. Opening Role Editor", delayMs: 700 },
          ]);
          setTimeout(() => {
            setAiPrefillDraft({ type, data: pf, nonce: Date.now() });
            playAICursorSequence?.([
              { selector: '[data-ai-target="role-name-input"]', label: "2. Prefilling Role Details", delayMs: 800 },
              { selector: '[data-ai-target="role-modules-box"]', label: "3. Select Modules & Permissions", delayMs: 900 },
              { selector: '[data-ai-target="save-role-btn"]', label: "4. Review & Save Role", delayMs: 1100 },
            ]);
          }, 650);
        } else {
          setAiPrefillDraft({ type, data: pf, nonce: Date.now() });
          playAICursorSequence?.([
            { selector: '[data-ai-target="grant-ai-submit-btn"], [data-ai-target="new-role-btn"]', label: "Review Settings Here", delayMs: 1000 },
          ]);
        }
      }, 250);
      return;
    }

    if (["create_project", "update_project", "add_project_member", "invoke_project_department", "add_project_url", "create_department", "update_department", "add_department_member"].includes(type)) {
      if (!window.location.pathname.startsWith("/projects")) navigate("/projects");
      setTimeout(() => {
        const isDept = type.includes("department") && !type.includes("project");
        playAICursorSequence?.([
          { selector: isDept ? '[data-ai-target="add-dept-btn"]' : '[data-ai-target="add-project-btn"]', label: isDept ? "1. Opening Department Form" : "1. Opening Project Form", delayMs: 700 },
        ]);
        setTimeout(() => {
          setAiPrefillDraft({ type, data: pf, nonce: Date.now() });
          playAICursorSequence?.([
            { selector: "form input, form textarea", label: "2. Prefilled Details", delayMs: 850 },
            { selector: '[data-ai-target="save-project-btn"], [data-ai-target="save-dept-btn"], form button[type="submit"]', label: "3. Review & Submit", delayMs: 1000 },
          ]);
        }, 650);
      }, 250);
      return;
    }

    if (["create_request", "approve_request", "reject_request"].includes(type)) {
      if (!window.location.pathname.startsWith("/requests")) navigate("/requests");
      setTimeout(() => {
        if (type === "create_request") {
          playAICursorSequence?.([
            { selector: '[data-ai-target="new-request-btn"]', label: "1. Opening Request Form", delayMs: 700 },
          ]);
          setTimeout(() => {
            setAiPrefillDraft({ type, data: pf, nonce: Date.now() });
            playAICursorSequence?.([
              { selector: "form input, form textarea", label: "2. Prefilling Request", delayMs: 850 },
              { selector: '[data-ai-target="save-request-btn"], form button[type="submit"]', label: "3. Review & Submit Request", delayMs: 1000 },
            ]);
          }, 650);
        } else {
          setAiPrefillDraft({ type, data: pf, nonce: Date.now() });
          playAICursorSequence?.([
            {
              selector: type === "approve_request" ? '[data-ai-target="request-approve-btn"]' : '[data-ai-target="request-reject-btn"]',
              label: type === "approve_request" ? "Review & Approve Stage" : "Review & Reject Request",
              delayMs: 1100,
            },
          ]);
        }
      }, 250);
      return;
    }

    if (["create_user", "update_user", "update_user_role", "delete_user", "approve_join_request", "reject_join_request"].includes(type)) {
      const targetTab = type.includes("join_request") ? "/team?tab=join-requests" : "/team";
      if (!window.location.pathname.startsWith("/team")) navigate(targetTab);
      setTimeout(() => {
        setAiPrefillDraft({ type, data: pf, nonce: Date.now() });
        playAICursorSequence?.([
          {
            selector:
              type === "create_user"
                ? '[data-ai-target="add-member-btn"]'
                : type.includes("join_request")
                ? '[data-ai-target="join-approve-btn"]'
                : '[data-ai-target="save-member-btn"], [data-ai-target="add-member-btn"]',
            label: "Copilot Highlighted Action",
            delayMs: 950,
          },
        ]);
      }, 300);
      return;
    }

    if (type === "update_profile") {
      if (!window.location.pathname.startsWith("/profile")) navigate("/profile");
      setTimeout(() => {
        setAiPrefillDraft({ type, data: pf, nonce: Date.now() });
        playAICursorSequence?.([
          { selector: '[data-ai-target="save-profile-btn"]', label: "Review Profile Changes", delayMs: 1000 },
        ]);
      }, 300);
      return;
    }

    if (msg?.navigateTo) {
      triggerAICursor?.({ label: `Navigated to ${msg.navigateTo}` });
    }
  };

  const refreshAllWorkspaceStores = () => {
    refreshProjects?.();
    refreshDepartments?.();
    refreshTeam?.();
    refreshRoles?.();
    refreshNotifications?.();
    ["rbac:updated", "department:updated", "project:updated", "team:updated", "task:updated", "request:updated"].forEach(
      (evt) => emitLocalRealtimeEvent(evt, { source: "copilot" })
    );
  };

  const applyCompletedMessageEffects = (msg, sourceMode) => {
    if (!msg || msg.status !== "completed" || !msg.jobId) return;
    const handled = getHandledJobs();
    if (handled.has(msg.jobId)) return;
    markJobHandled(msg.jobId);

    if (sourceMode === "auto" || msg.actionApplied) {
      refreshAllWorkspaceStores();
    }

    // Only drive UI navigation, modals, or cursor walkthrough in the active tab that owns/opened Copilot
    const tabOwnsEffect = myTabJobsRef.current.has(msg.jobId) || isOpenRef.current;
    if (!tabOwnsEffect) return;

    if (sourceMode === "auto" || msg.actionApplied) {
      if (msg.navigateTo && !msg.uiHtml) {
        if (msg.intent?.type === "navigate") navigate(msg.navigateTo);
      }
      if (msg.intent?.type === "open_task" && msg.intent?.prefill?.taskKey) {
        closeAllSidebars?.("task");
        setSelectedTaskKeyOrId?.(msg.intent.prefill.taskKey);
      }
      return;
    }

    if (msg.cursorGuide || (sourceMode === "review" && msg.status !== "clarify")) {
      runCursorWalkthroughForMessage(msg);
      return;
    }
  };

  const syncSession = async (triggerEffectsOnLatest = false) => {
    if (!canUseAI) return;
    const res = await getAIAssistantSessionAPI();
    if (res.success && res.session) {
      setSession(res.session);
      if (!hasHydratedPrefsRef.current) {
        hasHydratedPrefsRef.current = true;
        setMode(res.session.mode || "review");
        if (Array.isArray(res.options)) {
          if (res.session.selectedModelKey && res.session.selectedModelKey !== "auto") {
            setSelectedModelKey(res.session.selectedModelKey);
          } else if (!res.hasExternalAccess && res.options.length > 0) {
            setSelectedModelKey(res.options[0].id);
          }
        }
      }
      if (Array.isArray(res.options)) {
        setAvailableModels(res.options);
        setHasExternalAccess(Boolean(res.hasExternalAccess));
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

  // Listen to real-time AI job updates & token chunks via Socket.IO
  useEffect(() => {
    if (!canUseAI || !user?._id) return;
    initSocketClient(user._id);
    const unsubUpdate = subscribeRealtimeEvents(["ai:assistant-update"], ({ session: updatedSession, jobId }) => {
      if (!updatedSession) return;
      setSession(updatedSession);
      if (jobId) {
        setStreamingChunks((prev) => {
          if (!prev[jobId]) return prev;
          const next = { ...prev };
          delete next[jobId];
          return next;
        });
      }
      const targetMsg = (updatedSession.messages || []).find((m) => m.jobId === jobId);
      if (targetMsg && targetMsg.status === "completed") {
        applyCompletedMessageEffects(targetMsg, targetMsg.mode || updatedSession.mode);
      }
    });
    const unsubChunk = subscribeRealtimeEvents(["ai:assistant-chunk"], ({ jobId, chunkText }) => {
      if (!jobId || !chunkText) return;
      setStreamingChunks((prev) => ({ ...prev, [jobId]: chunkText }));
    });
    return () => {
      unsubUpdate?.();
      unsubChunk?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canUseAI, user?._id]);

  // Refresh session state cleanly whenever user opens the Copilot sidebar
  useEffect(() => {
    if (canUseAI && isAIAssistantOpen) {
      syncSession(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canUseAI, isAIAssistantOpen]);

  const uploadAndAttachFiles = async (fileList) => {
    const incoming = Array.from(fileList || []).filter(Boolean);
    if (incoming.length === 0) return;

    const existingHashes = new Set(pendingAttachments.map((a) => a.hash).filter(Boolean));
    const now = Date.now();
    const accepted = [];

    for (const file of incoming) {
      if (pendingAttachments.length + accepted.length >= 5) break;
      const hash = await computeFileFingerprint(file);
      const lastSeen = recentFileHashesRef.current.get(hash) || 0;
      // Ignore duplicate invocations of identical file within 1500ms or already queued
      if (existingHashes.has(hash) || now - lastSeen < 1500) {
        continue;
      }
      recentFileHashesRef.current.set(hash, now);
      existingHashes.add(hash);

      const isImg = String(file.type || "").startsWith("image/");
      const tempId = `att-${now}-${Math.random().toString(36).slice(2, 8)}`;
      const localUrl = isImg ? URL.createObjectURL(file) : "";
      accepted.push({
        file,
        tempId,
        hash,
        placeholder: {
          tempId,
          hash,
          name: file.name || `attachment-${now}`,
          kind: isImg ? "image" : "document",
          size: file.size || 0,
          url: localUrl,
          localUrl,
          status: "uploading",
        },
      });
    }

    if (accepted.length === 0) return;
    setPendingAttachments((prev) => [...prev, ...accepted.map((a) => a.placeholder)].slice(0, 5));

    await Promise.all(
      accepted.map(async (item) => {
        const res = await uploadAIAssistantFilesAPI([item.file]);
        const uploaded = res.success && Array.isArray(res.attachments) ? res.attachments[0] : null;
        if (item.placeholder.localUrl) URL.revokeObjectURL(item.placeholder.localUrl);

        if (uploaded) {
          setPendingAttachments((prev) =>
            prev.map((att) =>
              att.tempId === item.tempId
                ? { ...uploaded, tempId: item.tempId, hash: item.hash, status: "ready" }
                : att
            )
          );
        } else {
          setPendingAttachments((prev) => prev.filter((att) => att.tempId !== item.tempId));
        }
      })
    );
  };

  const handleAttachFiles = async (e) => {
    const picked = Array.from(e.target.files || []);
    if (fileInputRef.current) fileInputRef.current.value = "";
    await uploadAndAttachFiles(picked);
  };

  const handleRemovePendingAttachment = (attToRemove) => {
    if (attToRemove.localUrl) URL.revokeObjectURL(attToRemove.localUrl);
    setPendingAttachments((prev) =>
      prev.filter((att) => (attToRemove.tempId ? att.tempId !== attToRemove.tempId : att.url !== attToRemove.url))
    );
    if (attToRemove.filename || attToRemove.filePath) {
      deleteAIAssistantUploadAPI(attToRemove.filename || attToRemove.filePath);
    }
  };

  const handleClipboardPaste = async (e) => {
    const cd = e.clipboardData;
    if (!cd) return;
    const files = [];
    if (cd.files && cd.files.length > 0) {
      files.push(...Array.from(cd.files));
    } else if (cd.items) {
      for (const item of Array.from(cd.items)) {
        if (item.kind === "file") {
          const blob = item.getAsFile();
          if (blob) {
            const ext = (blob.type || "image/png").split("/")[1] || "png";
            const named =
              blob.name && blob.name !== "image.png"
                ? blob
                : new File([blob], `clipboard-${Date.now()}.${ext}`, {
                    type: blob.type || "image/png",
                  });
            files.push(named);
          }
        }
      }
    }
    if (files.length > 0) {
      e.preventDefault();
      e.stopPropagation();
      await uploadAndAttachFiles(files);
    }
  };

  const handleDrawerDragEnter = (e) => {
    if (e.dataTransfer?.types?.includes("Files")) {
      e.preventDefault();
      dragCounterRef.current += 1;
      setIsDraggingFiles(true);
    }
  };

  const handleDrawerDragOver = (e) => {
    if (e.dataTransfer?.types?.includes("Files")) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    }
  };

  const handleDrawerDragLeave = () => {
    dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
    if (dragCounterRef.current === 0) {
      setIsDraggingFiles(false);
    }
  };

  const handleDrawerDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDraggingFiles(false);
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      await uploadAndAttachFiles(files);
    }
  };

  const dispatchPrompt = async (promptText) => {
    const clean = String(promptText || "").trim();
    const readyAtts = pendingAttachments.filter((a) => a.status !== "uploading");
    if ((!clean && readyAtts.length === 0) || uploadingFiles || sending) return;
    const attachmentsToSend = [...readyAtts];
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setPendingAttachments([]);
    setSending(true);
    const res = await sendAIAssistantChatAPI({
      prompt: clean || `Analyze attached file(s): ${attachmentsToSend.map((a) => a.name).join(", ")}`,
      mode,
      moduleKey: inferModuleFromPath(location.pathname),
      selectedModelKey,
      currentRoute: location.pathname,
      activeProjectId: activeProject?._id || null,
      attachments: attachmentsToSend,
    });
    setSending(false);
    if (res.success && res.session) {
      const dispatchedId = res.jobId || res.session?.activeJobId;
      if (dispatchedId) myTabJobsRef.current.add(dispatchedId);
      setSession(res.session);
    }
  };

  const handleCardStepClick = async (step, msgId) => {
    if (step?.type === "navigate" && step?.prefill?.route) {
      closeAllSidebars?.();
      navigate(step.prefill.route);
      triggerAICursor?.({ label: `Opened ${step.prefill.route}` });
      return;
    }
    const res = await executeAIAssistantCardStepAPI({ step, messageId: msgId });
    if (res.success) {
      if (res.session) setSession(res.session);
      refreshAllWorkspaceStores();
      if (res.executedResult?.taskKey) {
        closeAllSidebars?.("task");
        navigate(`/board?task=${res.executedResult.taskKey}`);
        setSelectedTaskKeyOrId?.(res.executedResult.taskKey);
      }
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

  const pebbleXY = useMemo(() => {
    if (dragPos) return dragPos;
    const isMobile = viewport.w < 640;
    const orbSize = isMobile ? 48 : 56;
    const margin = isMobile ? 14 : 20;
    const topSafe = isMobile ? 106 : 82;
    const maxX = Math.max(margin, viewport.w - orbSize - margin);
    const maxY = Math.max(topSafe, viewport.h - orbSize - margin);
    switch (corner) {
      case "top-left":
        return { x: margin, y: topSafe };
      case "top-right":
        return { x: maxX, y: topSafe };
      case "bottom-left":
        return { x: margin, y: maxY };
      case "bottom-right":
      default:
        return { x: maxX, y: maxY };
    }
  }, [corner, dragPos, viewport]);

  if (!canUseAI) return null;

  const handleModeChange = async (nextMode) => {
    hasHydratedPrefsRef.current = true;
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
    runCursorWalkthroughForMessage(msg);
  };

  const handleConfirmServerExecute = async (msg) => {
    setConfirmingMsgId(msg._id);
    const res = await confirmAIAssistantActionAPI(msg._id);
    setConfirmingMsgId("");
    if (res.success) {
      if (res.session) setSession(res.session);
      refreshAllWorkspaceStores();
      if (res.executedResult?.taskKey) {
        closeAllSidebars?.("task");
        navigate(`/board?task=${res.executedResult.taskKey}`);
        setSelectedTaskKeyOrId?.(res.executedResult.taskKey);
        triggerAICursor?.({ label: `Opened ${res.executedResult.taskKey}` });
      }
    }
  };

  const handlePebblePointerDown = (e) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    const rect = pebbleRef.current?.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const origLeft = rect ? rect.left : viewport.w - 76;
    const origTop = rect ? rect.top : viewport.h - 76;
    let moved = false;
    let latestPos = null;

    const onMove = (ev) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (!moved && Math.hypot(dx, dy) > 7) {
        moved = true;
        setIsDraggingPebble(true);
      }
      if (moved) {
        const clampedX = Math.max(12, Math.min(window.innerWidth - 68, origLeft + dx));
        const clampedY = Math.max(76, Math.min(window.innerHeight - 68, origTop + dy));
        latestPos = { x: clampedX, y: clampedY };
        setDragPos(latestPos);
      }
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      setIsDraggingPebble(false);
      if (moved && latestPos) {
        const cx = latestPos.x + 28;
        const cy = latestPos.y + 28;
        const vert = cy < window.innerHeight / 2 ? "top" : "bottom";
        const horiz = cx < window.innerWidth / 2 ? "left" : "right";
        setCorner(`${vert}-${horiz}`);
        setDragPos(null);
      } else {
        setDragPos(null);
        setIsAIAssistantOpen(true);
      }
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  const messages = session?.messages || [];

  return (
    <>
      {/* 4-Corner Draggable Glass Pebble Orb with smooth slow spring physics (resets to bottom-right on reload; sits cleanly behind sidebars at z-30) */}
      {!isAIAssistantOpen && (
        <motion.button
          ref={pebbleRef}
          type="button"
          data-testid="lira-pebble-orb"
          data-corner={corner}
          initial={{ x: pebbleXY.x, y: pebbleXY.y, opacity: 0, scale: 0.88 }}
          animate={{
            x: pebbleXY.x,
            y: pebbleXY.y,
            opacity: 1,
            scale: isDraggingPebble ? 1.09 : 1,
          }}
          transition={
            isDraggingPebble
              ? { type: "spring", stiffness: 280, damping: 24, mass: 0.9 }
              : { type: "spring", stiffness: 88, damping: 18, mass: 1.25 }
          }
          whileHover={isDraggingPebble ? undefined : { scale: 1.07 }}
          whileTap={{ scale: 0.94 }}
          onPointerDown={handlePebblePointerDown}
          title="Open Lira Assistant (Cmd+J) — drag to any corner"
          aria-label="Open Lira Workspace Assistant"
          className="fixed top-0 left-0 z-30 w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing backdrop-blur-2xl border select-none touch-none transition-shadow overflow-hidden"
          style={{
            background: isDark
              ? "radial-gradient(135% 135% at 28% 18%, rgba(255,255,255,0.22) 0%, rgba(161,161,170,0.16) 44%, rgba(14,16,21,0.95) 100%)"
              : "radial-gradient(135% 135% at 28% 18%, rgba(255,255,255,0.98) 0%, rgba(228,228,231,0.92) 52%, rgba(212,212,216,0.78) 100%)",
            borderColor: isDark ? "rgba(255,255,255,0.24)" : "rgba(24,24,27,0.18)",
            boxShadow: isDark
              ? "inset 0 2px 4px rgba(255,255,255,0.34), inset 0 -6px 14px rgba(0,0,0,0.65), 0 14px 34px rgba(0,0,0,0.58)"
              : "inset 0 2px 4px rgba(255,255,255,0.98), inset 0 -6px 14px rgba(24,24,27,0.12), 0 14px 28px rgba(15,23,42,0.16)",
          }}
        >
          {/* Specular top glass glint */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-1.5 left-3 right-3 h-3.5 rounded-full opacity-60"
            style={{
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.65) 0%, rgba(255,255,255,0) 100%)",
            }}
          />
          <LiraLogoMark
            className="w-8 h-8 relative z-10 pointer-events-none"
            primaryColor={isDark ? "#fafafa" : "#18181b"}
            secondaryColor={isDark ? "#a1a1aa" : "#71717a"}
            dotColor={isDark ? "#ffffff" : "#18181b"}
            strokeWidth={2.4}
          />
          {hasProcessing && (
            <span className="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-[#0e1017] animate-pulse" />
          )}
        </motion.button>
      )}

      <SideDrawer
        sidebarId="copilot"
        isOpen={isAIAssistantOpen}
        onClose={() => setIsAIAssistantOpen(false)}
        title="Lira Assistant"
        subtitle="Workspace copilot • tasks, calendar cursor guide, charts & exports"
        headerIcon={<LiraLogo size="sm" shape="circle" showWordmark={false} isDark={isDark} />}
        widthClass="max-w-3xl"
        drawerProps={{
          onDragEnter: handleDrawerDragEnter,
          onDragOver: handleDrawerDragOver,
          onDragLeave: handleDrawerDragLeave,
          onDrop: handleDrawerDrop,
        }}
        headerActions={
          <div className="flex items-center gap-1.5">
            {messages.length > 0 && (
              <button
                type="button"
                onClick={async () => {
                  const confirmed = await confirm({
                    title: "Clear Copilot conversation?",
                    message: "This will clear your current Lira Assistant message history in this sidebar.",
                    confirmLabel: "Clear Chat",
                    variant: "warning",
                    icon: Trash2,
                  });
                  if (!confirmed) return;
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
            className="space-y-2"
          >
            {!hasExternalAccess && (
              <div className={`px-3 py-1.5 rounded-xl border flex items-center justify-between gap-2 text-[11px] ${g.subtleSurface}`}>
                <span className={g.muted}>No external AI key added yet — using Quick Engine.</span>
                <button
                  type="button"
                  onClick={() => {
                    closeAllSidebars?.();
                    navigate("/profile?tab=ai");
                  }}
                  className="text-purple-400 font-bold hover:underline flex items-center gap-1 shrink-0 cursor-pointer"
                >
                  <KeyRound className="w-3 h-3" />
                  <span>Add Key</span>
                </button>
              </div>
            )}

            <div className={`rounded-2xl border p-2.5 space-y-2 ${g.subtleSurface}`}>
              {pendingAttachments.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {pendingAttachments.map((att, aIdx) => (
                    <div
                      key={att.tempId || `${att.url}-${aIdx}`}
                      className={`flex items-center gap-1.5 pl-2 pr-1.5 py-1 rounded-lg border text-[10px] ${g.subtleSurface}`}
                    >
                      {att.status === "uploading" ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-400 shrink-0" />
                      ) : att.kind === "image" && att.url ? (
                        <img src={att.url} alt={att.name} className="w-4 h-4 rounded object-cover" />
                      ) : (
                        <FileText className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                      )}
                      <span className="max-w-[160px] truncate font-medium">
                        {att.status === "uploading" ? `Uploading ${att.name}...` : att.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemovePendingAttachment(att)}
                        className="p-0.5 rounded hover:text-rose-400 cursor-pointer"
                        aria-label={`Remove ${att.name}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <textarea
                ref={textareaRef}
                rows={2}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = `${Math.min(160, Math.max(48, e.target.scrollHeight))}px`;
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    dispatchPrompt(input);
                  }
                }}
                onPaste={handleClipboardPaste}
                placeholder={
                  hasProcessing
                    ? "Send a new message to redirect, or click Stop..."
                    : mode === "auto"
                    ? "Tell Lira what to create, chart, export, or open... (Shift+Enter newline)"
                    : "Ask Lira to prepare actions across any screen... (Shift+Enter newline)"
                }
                className={`w-full block rounded-xl px-3.5 py-2.5 text-xs border focus:outline-none resize-none whitespace-pre-wrap break-words leading-relaxed min-h-[48px] max-h-[160px] overflow-y-auto ${g.input}`}
              />

              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <div className="flex flex-wrap items-center gap-1.5">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*,.pdf,.txt,.csv,.md,.json,.log,.tsv"
                    onChange={handleAttachFiles}
                    className="hidden"
                  />
                  <button
                    type="button"
                    disabled={uploadingFiles}
                    onClick={() => fileInputRef.current?.click()}
                    className={`p-2 rounded-lg border cursor-pointer disabled:opacity-40 shrink-0 ${g.btnSecondary}`}
                    title="Attach images or documents (PNG, JPG, PDF, CSV, TXT, JSON)"
                    aria-label="Attach files to Lira Copilot"
                  >
                    {uploadingFiles ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Paperclip className="w-3.5 h-3.5" />
                    )}
                  </button>
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
                  <select
                    value={selectedModelKey}
                    onChange={(e) => {
                      hasHydratedPrefsRef.current = true;
                      setSelectedModelKey(e.target.value);
                    }}
                    className={`flex-1 min-w-0 max-w-full sm:max-w-[230px] rounded-lg px-2.5 py-1 text-[11px] border focus:outline-none truncate ${g.input}`}
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

                <div className="flex items-center gap-1.5 ml-auto">
                  {hasProcessing && (
                    <button
                      type="button"
                      disabled={stopping}
                      onClick={handleStopGeneration}
                      className="px-3 py-2 rounded-xl border border-rose-500/40 bg-rose-500/15 text-rose-300 text-xs font-bold flex items-center gap-1.5 hover:bg-rose-500/25 cursor-pointer disabled:opacity-50 shrink-0"
                      title="Stop current generation (keeps prompt in context)"
                    >
                      <Square className="w-3 h-3 fill-current" />
                      <span>{stopping ? "Stopping..." : "Stop"}</span>
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={(!input.trim() && pendingAttachments.filter((a) => a.status !== "uploading").length === 0) || uploadingFiles || sending}
                    className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-40 shrink-0 ${g.btnPrimary}`}
                  >
                    {sending || uploadingFiles ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    <span>{uploadingFiles ? "Uploading..." : "Send"}</span>
                  </button>
                </div>
              </div>
            </div>
          </form>
        }
      >
        <div className="space-y-4 relative min-h-full">
          {isDraggingFiles && (
            <div className="sticky top-2 z-20 p-5 rounded-2xl border-2 border-dashed border-purple-400/70 bg-purple-500/15 backdrop-blur-xl text-center space-y-1.5 shadow-xl pointer-events-none">
              <Paperclip className="w-5 h-5 mx-auto text-purple-300" />
              <p className={`text-xs font-bold ${g.heading}`}>
                Drop image, screenshot, or document to attach
              </p>
              <p className={`text-[10px] ${g.muted}`}>
                Supports PNG, JPG, WEBP, GIF, PDF, CSV, TXT, MD, JSON
              </p>
            </div>
          )}
          {messages.length === 0 ? (
            <div className={`p-5 rounded-2xl border space-y-4 ${g.subtleSurface}`}>
              <div className="flex items-start gap-3">
                <LiraLogo size="md" showWordmark={false} isDark={isDark} />
                <div>
                  <h4 className={`text-xs font-bold ${g.heading}`}>How can I help across your workspace?</h4>
                  <p className={`text-[11px] mt-1 leading-relaxed ${g.muted}`}>
                    Attach images or PDFs, ask me to create or schedule tasks, build charts, export CSV/PDF/PPT reports, or walk you through pages with the cursor.
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
                    <div className={`max-w-[85%] p-3.5 rounded-2xl rounded-br-sm border text-xs space-y-2 ${g.selectedRow}`}>
                      <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                      {Array.isArray(msg.attachments) && msg.attachments.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {msg.attachments.map((att, aIdx) =>
                            att.kind === "image" ? (
                              <a
                                key={aIdx}
                                href={att.url}
                                target="_blank"
                                rel="noreferrer"
                                className="block rounded-lg overflow-hidden border border-white/15"
                              >
                                <img src={att.url} alt={att.name} className="w-20 h-16 object-cover" />
                              </a>
                            ) : (
                              <span
                                key={aIdx}
                                className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] ${g.subtleSurface}`}
                              >
                                <FileText className="w-3 h-3 text-sky-400" />
                                <span className="max-w-[130px] truncate">{att.name}</span>
                              </span>
                            )
                          )}
                        </div>
                      )}
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
                        closeAllSidebars?.();
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
                const policyBadgeMap = {
                  audit_tampering: "Audit Tampering",
                  destructive_wipe: "Destructive Wipe",
                  privilege_escalation: "Privilege Escalation",
                  credential_exfiltration: "Credential Exfiltration",
                  architecture_probe: "Architecture Probe",
                  off_topic_code_or_image: "Unsafe / Off-Topic",
                  unauthorized_module: "Access Denied",
                };
                const policyBadge = policyBadgeMap[msg.misuseCategory] || "";
                return (
                  <div
                    key={msg._id || idx}
                    className="p-3.5 rounded-2xl border border-rose-500/35 bg-rose-500/10 space-y-1.5 text-xs text-rose-300"
                  >
                    <div className="flex items-center justify-between gap-2 font-bold">
                      <div className="flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                        <span>
                          {msg.status === "blocked" ? "Blocked by Security Policy" : "Access Unavailable"}
                        </span>
                      </div>
                      {policyBadge && (
                        <span className="px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-400/30 text-[10px] font-semibold uppercase tracking-wide">
                          {policyBadge}
                        </span>
                      )}
                    </div>
                    <p className="leading-relaxed">{msg.warning || msg.content}</p>
                    {msg.uiHtml && (
                      <SanitizedCopilotHtml
                        html={msg.uiHtml}
                        isDark={isDark}
                        onStepClick={(step) => handleCardStepClick(step, msg._id)}
                        onReplyClick={(txt) => dispatchPrompt(txt)}
                        onConfirmClick={() => handleConfirmServerExecute(msg)}
                      />
                    )}
                    {!msg.uiHtml && Array.isArray(msg.choices) && msg.choices.length > 0 && (
                      <div className="space-y-1.5 pt-1 w-full">
                        {msg.choices.map((ch, cIdx) => (
                          <button
                            key={cIdx}
                            type="button"
                            onClick={() =>
                              ch.step
                                ? handleCardStepClick(ch.step, msg._id)
                                : ch.replyText && dispatchPrompt(ch.replyText)
                            }
                            className={`w-full p-2.5 rounded-xl border flex items-center justify-between gap-3 text-left cursor-pointer ${g.subtleSurface} ${g.rowHover}`}
                          >
                            <div className="min-w-0">
                              <div className={`font-bold text-[11px] truncate ${g.heading}`}>{ch.label}</div>
                              {ch.sublabel && <div className={`text-[10px] truncate ${g.muted}`}>{ch.sublabel}</div>}
                            </div>
                            <ArrowRight className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                          </button>
                        ))}
                      </div>
                    )}
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
                        <LiraLogo size="sm" showWordmark={false} isDark={isDark} />
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

                  <p className="leading-relaxed whitespace-pre-wrap">
                    {msg.status === "processing" && msg.jobId && streamingChunks[msg.jobId]
                      ? streamingChunks[msg.jobId]
                      : formatPlainCopilotText(
                          msg.content,
                          idx > 0 ? messages[idx - 1]?.content : ""
                        )}
                  </p>

                  {msg.uiHtml && (!msg.actionApplied || String(msg.uiHtml).includes("data-lira-submit-form") || msg.status === "clarify") && (
                    <SanitizedCopilotHtml
                      html={msg.uiHtml}
                      isDark={isDark}
                      onStepClick={(step) => handleCardStepClick(step, msg._id)}
                      onReplyClick={(txt) => dispatchPrompt(txt)}
                      onConfirmClick={() => handleConfirmServerExecute(msg)}
                    />
                  )}

                  {!msg.uiHtml && Array.isArray(msg.choices) && msg.choices.length > 0 && !msg.actionApplied && (
                    <div className="space-y-2 w-full">
                      {msg.choices.map((ch, cIdx) => (
                        <button
                          key={cIdx}
                          type="button"
                          onClick={() =>
                            ch.step
                              ? handleCardStepClick(ch.step, msg._id)
                              : ch.replyText && dispatchPrompt(ch.replyText)
                          }
                          className={`w-full p-2.5 rounded-xl border flex items-center justify-between gap-3 text-left cursor-pointer ${g.subtleSurface} ${g.rowHover}`}
                        >
                          <div className="min-w-0">
                            <div className={`font-bold text-xs truncate ${g.heading}`}>{ch.label}</div>
                            {ch.sublabel && <div className={`text-[10px] truncate ${g.muted}`}>{ch.sublabel}</div>}
                          </div>
                          <ArrowRight className="w-3.5 h-3.5 shrink-0 text-purple-400" />
                        </button>
                      ))}
                    </div>
                  )}

                  {Array.isArray(msg.artifacts) && msg.artifacts.length > 0 && (
                    <CopilotArtifactsList artifacts={msg.artifacts} isDark={isDark} />
                  )}

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
                            closeAllSidebars?.("task");
                            navigate(`/board?task=${msg.executedResult.taskKey}`);
                            setSelectedTaskKeyOrId?.(msg.executedResult.taskKey);
                            triggerAICursor?.({ label: `Opened ${msg.executedResult.taskKey}` });
                          }}
                          className="px-2 py-1 rounded-lg bg-emerald-500/20 text-[10px] font-bold shrink-0 cursor-pointer"
                        >
                          Open {msg.executedResult.taskKey}
                        </button>
                      )}
                    </div>
                  )}

                  {msg.executedResult?.error && (
                    <div className="p-2.5 rounded-xl border border-amber-500/35 bg-amber-500/10 text-amber-300 flex items-start gap-2 text-[11px]">
                      <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <span className="leading-relaxed">
                        {msg.executedResult.executed ? "Partial failure: " : "Execution failed: "}
                        {msg.executedResult.error}
                      </span>
                    </div>
                  )}

                  {msg.status === "completed" && (msg.navigateTo || ((msg.intent || hasSteps) && msg.intent?.type !== "navigate" && !msg.actionApplied)) && (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {msg.navigateTo && (
                        <button
                          type="button"
                          onClick={() => {
                            closeAllSidebars?.();
                            navigate(msg.navigateTo);
                            triggerAICursor?.({ label: `Opened ${msg.navigateTo}` });
                          }}
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
