import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  checkAuth,
  getProjects,
  getDepartments,
  getTeamMembers,
  getNotifications,
  getPendingJoinRequests,
  getRequests,
  getMyTasks,
  getTasks,
  getRoles,
  markNotificationRead,
  getChatConversations,
  logoutUser,
} from "../services/api";
import { initSocketClient, joinProjectRoom, leaveProjectRoom, emitLocalRealtimeEvent } from "../services/socket";

const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const navigate = useNavigate();
  // Theme state: 'dark' (default as per design) or 'light'
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("lira_theme") || "dark";
  });

  useEffect(() => {
    localStorage.setItem("lira_theme", theme);
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
      document.documentElement.classList.remove("light");
      document.body.classList.add("dark");
      document.body.classList.remove("light");
      document.body.style.backgroundColor = "#090a0d";
      document.body.style.color = "#f4f4f5";
    } else {
      document.documentElement.classList.remove("dark");
      document.documentElement.classList.add("light");
      document.body.classList.remove("dark");
      document.body.classList.add("light");
      document.body.style.backgroundColor = "#f2f4f7";
      document.body.style.color = "#0f172a";
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  }, []);

  // Current logged in user
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("lira_user");
    return saved ? JSON.parse(saved) : null;
  });
  const [isValidating, setIsValidating] = useState(true);

  // Projects & active workspace
  const [projects, setProjects] = useState([]);
  const [activeProject, setActiveProject] = useState(null);

  // Departments, Roles & staff directory
  const [departments, setDepartments] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [roles, setRoles] = useState([]);

  // Notifications & Chat Unread / Presence
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [pendingJoinCount, setPendingJoinCount] = useState(0);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [myPendingCount, setMyPendingCount] = useState(0);
  const [pendingReviewCount, setPendingReviewCount] = useState(0);
  const [onlineUserIds, setOnlineUserIds] = useState([]);
  const [pushPermission, setPushPermission] = useState(() =>
    typeof Notification !== "undefined" ? Notification.permission : "unsupported"
  );

  // Task drawer & modal states
  const [selectedTaskKeyOrId, setSelectedTaskKeyOrId] = useState(null);
  const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatTargetUser, setChatTargetUser] = useState(null);
  const [chatTargetRoom, setChatTargetRoom] = useState(null);
  const [isAIAssistantOpen, setIsAIAssistantOpen] = useState(() => localStorage.getItem("lira_ai_open") === "1");
  const [aiPrefillDraft, setAiPrefillDraft] = useState(null);
  const [aiExternalPrompt, setAiExternalPrompt] = useState(null);
  const [aiCursorTarget, setAiCursorTarget] = useState(null);

  const triggerAICursor = useCallback(({ selector = null, label = "Lira Copilot", x = null, y = null, sequence = null } = {}) => {
    setAiCursorTarget({ selector, label, x, y, sequence, nonce: Date.now() });
  }, []);

  const playAICursorSequence = useCallback((sequence = []) => {
    if (!Array.isArray(sequence) || sequence.length === 0) return;
    setAiCursorTarget({ sequence, nonce: Date.now() });
  }, []);

  const closeAllSidebars = useCallback((except = null) => {
    setIsAIAssistantOpen(false);
    setIsChatOpen(false);
    setIsCommandPaletteOpen(false);
    setIsCreateTaskModalOpen(false);
    if (except !== "task" && except !== "task-drawer") {
      setSelectedTaskKeyOrId(null);
    }
    window.dispatchEvent(new CustomEvent("lira:close-all-sidebars", { detail: { except } }));
  }, []);

  // Ensure only ONE sidebar/drawer stays open globally: keep latest opened, close others cleanly
  useEffect(() => {
    const onSidebarOpened = (e) => {
      const openedId = e?.detail?.id;
      if (!openedId) return;
      if (openedId !== "copilot") setIsAIAssistantOpen(false);
      if (openedId !== "chat") setIsChatOpen(false);
      if (openedId !== "create-task") setIsCreateTaskModalOpen(false);
      if (openedId !== "task-drawer") setSelectedTaskKeyOrId(null);
    };
    window.addEventListener("lira:sidebar-opened", onSidebarOpened);
    return () => window.removeEventListener("lira:sidebar-opened", onSidebarOpened);
  }, []);

  const askLiraAI = useCallback((promptText) => {
    setIsAIAssistantOpen(true);
    if (promptText && String(promptText).trim()) {
      setAiExternalPrompt({ text: String(promptText).trim(), nonce: Date.now() });
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("lira_ai_open", isAIAssistantOpen ? "1" : "0");
  }, [isAIAssistantOpen]);

  const openDirectChat = useCallback((colleague) => {
    setChatTargetRoom(null);
    setChatTargetUser(colleague || null);
    setIsChatOpen(true);
  }, []);

  const openRoomChat = useCallback((room) => {
    setChatTargetUser(null);
    setChatTargetRoom(room || null);
    setIsChatOpen(true);
  }, []);

  // Global hotkey for Command Palette (Cmd+K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setIsAIAssistantOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Save user to localStorage
  useEffect(() => {
    if (user) {
      localStorage.setItem("lira_user", JSON.stringify(user));
    } else {
      localStorage.removeItem("lira_user");
    }
  }, [user]);

  const isSuperAdmin = Boolean(
    user?.isSuperAdmin ||
      user?.role === "superadmin" ||
      user?.role === "super_admin" ||
      (Array.isArray(user?.permissions) && user.permissions.includes("*"))
  );

  const hasPermission = useCallback(
    (requiredPerm) => {
      if (!user) return false;
      if (isSuperAdmin) return true;
      if (!requiredPerm) return true;
      const perms = Array.isArray(user.permissions) ? user.permissions : [];
      if (perms.includes(`!${requiredPerm}`)) return false;
      const [group] = String(requiredPerm).split(".");
      if (group && perms.includes(`!${group}.*`)) return false;
      if (perms.includes("*") || perms.includes("root")) return true;
      if (perms.includes(requiredPerm)) return true;
      if (group && perms.includes(`${group}.*`)) return true;
      // Fallback for legacy role checks if permissions array empty
      if (perms.length === 0 && (user.role === "admin" || user.role === "manager")) return true;
      return false;
    },
    [user, isSuperAdmin]
  );

  const hasModule = useCallback(
    (moduleKey) => {
      if (!user) return false;
      if (isSuperAdmin) return true;
      if (!moduleKey) return true;
      const mods = Array.isArray(user.modules) ? user.modules : [];
      if (mods.includes("*") || mods.includes(moduleKey)) return true;
      const perms = Array.isArray(user.permissions) ? user.permissions : [];
      return perms.some((p) => p === "*" || p.startsWith(`${moduleKey}.`));
    },
    [user, isSuperAdmin]
  );

  // Refresh data functions (strictly gated by active user permissions to avoid unauthorized 403 bursts)
  const refreshProjects = useCallback(async () => {
    if (!user || (!isSuperAdmin && !hasPermission("projects.view"))) {
      setProjects([]);
      setActiveProject(null);
      return;
    }
    const res = await getProjects();
    if (res.success) {
      setProjects(res.projects);
      setActiveProject((prev) => {
        if (!prev && res.projects.length > 0) return res.projects[0];
        const match = res.projects.find((p) => p._id === prev?._id);
        return match || res.projects[0] || null;
      });
    }
  }, [user, isSuperAdmin, hasPermission]);

  const refreshDepartments = useCallback(async () => {
    if (!user || (!isSuperAdmin && !hasPermission("departments.view"))) {
      setDepartments([]);
      return;
    }
    const res = await getDepartments();
    if (res.success) setDepartments(res.departments);
  }, [user, isSuperAdmin, hasPermission]);

  const refreshTeam = useCallback(async () => {
    if (!user || (!isSuperAdmin && !hasPermission("team.view"))) {
      setTeamMembers([]);
      return;
    }
    const res = await getTeamMembers();
    if (res.success) setTeamMembers(res.members);
  }, [user, isSuperAdmin, hasPermission]);

  const refreshRoles = useCallback(async () => {
    if (!user) return;
    const res = await getRoles();
    if (res.success && Array.isArray(res.roles)) {
      setRoles(res.roles);
    }
  }, [user]);

  const refreshNotifications = useCallback(async () => {
    if (!user) return;
    const res = await getNotifications();
    if (res.success) {
      setNotifications(res.notifications);
      setUnreadCount(res.unreadCount);
    }
  }, [user]);

  const refreshChatUnread = useCallback(async () => {
    if (!user || (!isSuperAdmin && !hasPermission("chat.view"))) {
      setUnreadChatCount(0);
      return;
    }
    try {
      const res = await getChatConversations();
      if (res.success && typeof res.totalUnread === "number") {
        setUnreadChatCount(res.totalUnread);
      }
    } catch {
      // ignore
    }
  }, [user, isSuperAdmin, hasPermission]);

  const refreshPendingJoinCount = useCallback(async () => {
    if (!user || (!isSuperAdmin && !hasPermission("team.join_requests") && user.role !== "admin" && user.role !== "manager")) {
      setPendingJoinCount(0);
      return;
    }
    try {
      const res = await getPendingJoinRequests();
      if (res.success) {
        setPendingJoinCount(res.count ?? res.requests?.length ?? 0);
      }
    } catch {
      // ignore
    }
  }, [user, isSuperAdmin, hasPermission]);

  const refreshTabPendingCounts = useCallback(async () => {
    if (!user || user.status !== "active") return;
    try {
      const canReq = isSuperAdmin || hasPermission("requests.view");
      const canTasks = isSuperAdmin || hasPermission("tasks.view");
      const [reqsRes, myRes, reviewRes] = await Promise.allSettled([
        canReq ? getRequests() : Promise.resolve({ success: false }),
        canTasks ? getMyTasks() : Promise.resolve({ success: false }),
        canTasks ? getTasks({ status: "review" }) : Promise.resolve({ success: false }),
      ]);
      if (reqsRes.status === "fulfilled" && reqsRes.value?.success) {
        const canApproveReqs = isSuperAdmin || hasPermission("requests.approve");
        const myActionableReqs = canApproveReqs
          ? (reqsRes.value.requests || []).filter((r) => {
              if (r.status !== "submitted" && r.status !== "in_review") return false;
              const stage = r.stages?.[r.currentStageIndex];
              return Boolean(stage && stage.status === "pending");
            })
          : [];
        setPendingRequestsCount(myActionableReqs.length);
      }
      if (myRes.status === "fulfilled" && myRes.value?.success) {
        const uid = user._id?.toString();
        const uDept = (user.department?._id || user.department)?.toString();
        const openMy = (myRes.value.tasks || []).filter((t) => {
          if (t.status === "done") return false;
          const inSingle = (t.assignee?._id || t.assignee)?.toString() === uid;
          const inMulti = (t.assignees || []).some((a) => (a._id || a)?.toString() === uid);
          const inDept = uDept && (t.assignedDepartments || []).some((d) => (d._id || d)?.toString() === uDept);
          return inSingle || inMulti || inDept;
        });
        setMyPendingCount(openMy.length);
      }
      if (reviewRes.status === "fulfilled" && reviewRes.value?.success) {
        const myReviews = (reviewRes.value.tasks || []).filter((t) => {
          const reporterId = t.reporter?._id || t.reporter;
          return t.status === "review" && reporterId?.toString() === user._id?.toString();
        });
        setPendingReviewCount(myReviews.length);
      }
    } catch {
      // ignore
    }
  }, [user, isSuperAdmin, hasPermission]);

  const navigateFromNotification = useCallback(
    async (notif) => {
      if (!notif) return;
      if (notif._id && !notif.isRead) {
        try {
          await markNotificationRead(notif._id);
          refreshNotifications();
        } catch {
          // ignore
        }
      }

      if (notif.task?.key || notif.task?._id) {
        setSelectedTaskKeyOrId(notif.task.key || notif.task._id);
        return;
      }

      const text = `${notif.title || ""} ${notif.message || ""}`.toLowerCase();
      if (notif.type === "chat_message" || notif.type === "file_shared") {
        setIsChatOpen(true);
      } else if (
        notif.type === "approval_request" ||
        notif.publicId ||
        text.includes("join request") ||
        text.includes("application")
      ) {
        navigate("/team?tab=join-requests");
      } else if (text.includes("req-") || text.includes("request") || text.includes("approv")) {
        navigate("/requests");
      } else if (notif.type === "project_update") {
        navigate("/projects");
      } else if (notif.type === "department_update") {
        navigate("/team");
      } else {
        navigate("/board");
      }
    },
    [navigate, refreshNotifications]
  );

  // Initial Auth verification
  useEffect(() => {
    let mounted = true;
    const verify = async () => {
      // 1. Check for token passed in URL query param (Google OAuth callback redirect)
      const params = new URLSearchParams(window.location.search);
      const urlToken = params.get("token");
      if (urlToken) {
        localStorage.setItem("lira_token", urlToken);
        // Clean the address bar of the token parameter
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
      }

      try {
        const res = await checkAuth();
        if (mounted) {
          if (res.isAuthenticated) {
            setUser(res.user);
          } else {
            setUser(null);
            localStorage.removeItem("lira_token");
            localStorage.removeItem("lira_user");
          }
        }
      } catch (err) {
        if (mounted) {
          setUser(null);
          localStorage.removeItem("lira_token");
          localStorage.removeItem("lira_user");
        }
      } finally {
        if (mounted) setIsValidating(false);
      }
    };
    verify();
    return () => {
      mounted = false;
    };
  }, []);

  // Fetch workspace data when user is authenticated and active
  useEffect(() => {
    if (user && user.status !== "pending_approval" && user.status !== "rejected") {
      refreshProjects();
      refreshDepartments();
      refreshTeam();
      refreshRoles();
      refreshNotifications();
      refreshChatUnread();
      refreshPendingJoinCount();
      refreshTabPendingCounts();

      // Initialize Socket connection
      const socket = initSocketClient(user._id);

      // Listen for real-time notifications
      const handleNotification = (notif) => {
        toast((t) => (
          <div
            onClick={() => {
              toast.dismiss(t.id);
              navigateFromNotification(notif);
            }}
            className="flex items-start gap-3 cursor-pointer"
          >
            <span className="text-xl">🔔</span>
            <div>
              <div className="flex items-center gap-1.5">
                <p className="font-semibold text-sm text-zinc-100">{notif.title || "Notification"}</p>
                {notif.publicId && (
                  <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono text-[10px] font-bold">
                    {notif.publicId}
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-300">{notif.message}</p>
              <p className="text-[10px] text-zinc-500 mt-0.5">Click to view</p>
            </div>
          </div>
        ), { id: notif?._id || `notif-${notif?.message}`, duration: 5000 });

        setNotifications((prev) => {
          if (notif?._id && prev.some((n) => n._id === notif._id)) return prev;
          return [notif, ...prev];
        });
        setUnreadCount((c) => c + 1);
      };

      const handleNewJoinRequest = ({ user: applicant }) => {
        if (!applicant || (!isSuperAdmin && !hasPermission("team.join_requests"))) return;
        setPendingJoinCount((c) => c + 1);
        toast(
          (t) => (
            <div
              onClick={() => {
                toast.dismiss(t.id);
                navigate("/team?tab=join-requests");
              }}
              className="flex items-start gap-2.5 cursor-pointer"
            >
              <span className="text-lg">🛡️</span>
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="font-semibold text-xs text-zinc-100">New Join Request</p>
                  {applicant.publicId && (
                    <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono text-[10px] font-bold">
                      {applicant.publicId}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-zinc-300">
                  {applicant.fullname || applicant.email} requested access. Click to review.
                </p>
              </div>
            </div>
          ),
          { id: `join-req-${applicant._id || applicant.publicId}`, duration: 6000 }
        );
        refreshNotifications();
        refreshPendingJoinCount();
      };

      const handleUpdatedJoinRequest = () => {
        refreshPendingJoinCount();
      };

      const handleRequestEvent = () => {
        refreshTabPendingCounts();
      };

      const handleTaskEvent = () => {
        refreshTabPendingCounts();
      };

      const handleChatNotification = (payload) => {
        setUnreadChatCount((c) => c + 1);
        toast((t) => (
          <div
            onClick={() => {
              toast.dismiss(t.id);
              setIsChatOpen(true);
            }}
            className="flex items-start gap-2.5 cursor-pointer"
          >
            <span className="text-lg">💬</span>
            <div>
              <p className="font-semibold text-xs text-zinc-100">
                {payload?.sender || "Teammate"} sent a message
              </p>
              <p className="text-[11px] text-zinc-400">Click to open Office Chat</p>
            </div>
          </div>
        ), { duration: 4000 });
      };

      const handlePresenceUpdate = ({ onlineUserIds: ids }) => {
        if (Array.isArray(ids)) {
          setOnlineUserIds(ids);
        }
      };

      const handleRbacUpdated = () => {
        refreshRoles();
        checkAuth().then((res) => {
          if (res.isAuthenticated) setUser(res.user);
        });
      };

      const handleRbacUserUpdated = () => {
        checkAuth().then((res) => {
          if (res.isAuthenticated) {
            setUser(res.user);
            toast("Your workspace role & permissions were updated", {
              id: "rbac-user-updated",
              icon: "🛡️",
            });
          }
        });
      };

      const handleAIMisuseWarning = ({ warning }) => {
        toast.error(warning || "AI Security Policy Warning: request blocked and logged.", {
          duration: 6000,
          id: "ai-misuse-alert",
        });
      };

      socket.on("notification:new", handleNotification);
      socket.on("join-request:new", handleNewJoinRequest);
      socket.on("join-request:updated", handleUpdatedJoinRequest);
      socket.on("request:created", handleRequestEvent);
      socket.on("request:updated", handleRequestEvent);
      socket.on("department:updated", refreshDepartments);
      socket.on("project:updated", refreshProjects);
      socket.on("team:updated", refreshTeam);
      socket.on("task:created_global", handleTaskEvent);
      socket.on("task:updated", handleTaskEvent);
      socket.on("task:status_changed", handleTaskEvent);
      socket.on("chat:notification", handleChatNotification);
      socket.on("presence:update", handlePresenceUpdate);
      socket.on("rbac:updated", handleRbacUpdated);
      socket.on("rbac:user-updated", handleRbacUserUpdated);
      socket.on("ai:misuse-warning", handleAIMisuseWarning);

      const FORWARDED_REALTIME_EVENTS = [
        "rbac:updated",
        "rbac:user-updated",
        "department:updated",
        "project:updated",
        "team:updated",
        "join-request:new",
        "join-request:updated",
        "request:created",
        "request:updated",
        "task:created",
        "task:created_global",
        "task:updated",
        "task:status_changed",
        "task:deleted",
        "ai:config-updated",
        "ai:grants-updated",
        "ai:assistant-update",
        "notification:new",
        "presence:update",
        "comment:new",
        "activity:new",
      ];
      const forwarders = FORWARDED_REALTIME_EVENTS.map((evtName) => {
        const fn = (payload) => emitLocalRealtimeEvent(evtName, payload || {});
        socket.on(evtName, fn);
        return [evtName, fn];
      });

      return () => {
        socket.off("notification:new", handleNotification);
        socket.off("join-request:new", handleNewJoinRequest);
        socket.off("join-request:updated", handleUpdatedJoinRequest);
        socket.off("request:created", handleRequestEvent);
        socket.off("request:updated", handleRequestEvent);
        socket.off("department:updated", refreshDepartments);
        socket.off("project:updated", refreshProjects);
        socket.off("team:updated", refreshTeam);
        socket.off("task:created_global", handleTaskEvent);
        socket.off("task:updated", handleTaskEvent);
        socket.off("task:status_changed", handleTaskEvent);
        socket.off("chat:notification", handleChatNotification);
        socket.off("presence:update", handlePresenceUpdate);
        socket.off("rbac:updated", handleRbacUpdated);
        socket.off("rbac:user-updated", handleRbacUserUpdated);
        socket.off("ai:misuse-warning", handleAIMisuseWarning);
        forwarders.forEach(([evtName, fn]) => socket.off(evtName, fn));
      };
    }
  }, [user, refreshProjects, refreshDepartments, refreshTeam, refreshRoles, refreshNotifications, refreshChatUnread, refreshPendingJoinCount, refreshTabPendingCounts, navigate, navigateFromNotification]);

  // Join active project socket room when activeProject changes
  useEffect(() => {
    if (activeProject?._id) {
      joinProjectRoom(activeProject._id);
      return () => {
        leaveProjectRoom(activeProject._id);
      };
    }
  }, [activeProject?._id]);

  // Logout Handler
  const handleLogout = async () => {
    await logoutUser();
    setUser(null);
    setProjects([]);
    setActiveProject(null);
    window.location.href = "/login";
  };

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      toggleTheme,
      user,
      setUser,
      isValidating,
      projects,
      activeProject,
      setActiveProject,
      departments,
      teamMembers,
      roles,
      isSuperAdmin,
      hasPermission,
      hasModule,
      notifications,
      unreadCount,
      unreadChatCount,
      setUnreadChatCount,
      pendingJoinCount,
      pendingRequestsCount,
      myPendingCount,
      pendingReviewCount,
      refreshPendingJoinCount,
      refreshTabPendingCounts,
      onlineUserIds,
      pushPermission,
      setPushPermission,
      navigateFromNotification,
      selectedTaskKeyOrId,
      setSelectedTaskKeyOrId,
      isCreateTaskModalOpen,
      setIsCreateTaskModalOpen,
      isCommandPaletteOpen,
      setIsCommandPaletteOpen,
      isChatOpen,
      setIsChatOpen,
      chatTargetUser,
      setChatTargetUser,
      chatTargetRoom,
      setChatTargetRoom,
      isAIAssistantOpen,
      setIsAIAssistantOpen,
      aiPrefillDraft,
      setAiPrefillDraft,
      aiExternalPrompt,
      setAiExternalPrompt,
      aiCursorTarget,
      triggerAICursor,
      playAICursorSequence,
      closeAllSidebars,
      askLiraAI,
      openDirectChat,
      openRoomChat,
      refreshProjects,
      refreshDepartments,
      refreshTeam,
      refreshRoles,
      refreshNotifications,
      refreshChatUnread,
      handleLogout,
    }),
    [
      theme,
      toggleTheme,
      user,
      isValidating,
      projects,
      activeProject,
      departments,
      teamMembers,
      roles,
      isSuperAdmin,
      hasPermission,
      hasModule,
      notifications,
      unreadCount,
      unreadChatCount,
      setUnreadChatCount,
      pendingJoinCount,
      pendingRequestsCount,
      myPendingCount,
      pendingReviewCount,
      refreshPendingJoinCount,
      refreshTabPendingCounts,
      onlineUserIds,
      pushPermission,
      setPushPermission,
      navigateFromNotification,
      selectedTaskKeyOrId,
      isCreateTaskModalOpen,
      isCommandPaletteOpen,
      isChatOpen,
      chatTargetUser,
      chatTargetRoom,
      isAIAssistantOpen,
      aiPrefillDraft,
      aiExternalPrompt,
      aiCursorTarget,
      triggerAICursor,
      playAICursorSequence,
      closeAllSidebars,
      askLiraAI,
      openDirectChat,
      openRoomChat,
      refreshProjects,
      refreshDepartments,
      refreshTeam,
      refreshRoles,
      refreshNotifications,
      refreshChatUnread,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => useContext(AppContext);
