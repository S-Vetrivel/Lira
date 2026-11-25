import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import toast from "react-hot-toast";
import {
  checkAuth,
  getProjects,
  getDepartments,
  getTeamMembers,
  getNotifications,
  logoutUser,
} from "../services/api";
import { initSocketClient, joinProjectRoom, leaveProjectRoom } from "../services/socket";

const AppContext = createContext();

export const AppProvider = ({ children }) => {
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
      document.body.style.backgroundColor = "#0c0d12";
      document.body.style.color = "#f8fafc";
    } else {
      document.documentElement.classList.remove("dark");
      document.documentElement.classList.add("light");
      document.body.classList.remove("dark");
      document.body.classList.add("light");
      document.body.style.backgroundColor = "#f8fafc";
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

  // Departments & staff directory
  const [departments, setDepartments] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);

  // Notifications
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Task drawer & modal states
  const [selectedTaskKeyOrId, setSelectedTaskKeyOrId] = useState(null);
  const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  // Global hotkey for Command Palette (Cmd+K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
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

  // Refresh data functions
  const refreshProjects = useCallback(async () => {
    const res = await getProjects();
    if (res.success) {
      setProjects(res.projects);
      setActiveProject((prev) => {
        if (!prev && res.projects.length > 0) return res.projects[0];
        const match = res.projects.find((p) => p._id === prev?._id);
        return match || res.projects[0] || null;
      });
    }
  }, []);

  const refreshDepartments = useCallback(async () => {
    const res = await getDepartments();
    if (res.success) setDepartments(res.departments);
  }, []);

  const refreshTeam = useCallback(async () => {
    const res = await getTeamMembers();
    if (res.success) setTeamMembers(res.members);
  }, []);

  const refreshNotifications = useCallback(async () => {
    if (!user) return;
    const res = await getNotifications();
    if (res.success) {
      setNotifications(res.notifications);
      setUnreadCount(res.unreadCount);
    }
  }, [user]);

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

  // Fetch workspace data when user is authenticated
  useEffect(() => {
    if (user) {
      refreshProjects();
      refreshDepartments();
      refreshTeam();
      refreshNotifications();

      // Initialize Socket connection
      const socket = initSocketClient(user._id);

      // Listen for real-time notifications
      const handleNotification = (notif) => {
        toast((t) => (
          <div className="flex items-start gap-3">
            <span className="text-xl">🔔</span>
            <div>
              <p className="font-semibold text-sm text-slate-800">{notif.message}</p>
              <p className="text-xs text-slate-500">Just now</p>
            </div>
          </div>
        ), { duration: 5000 });

        setNotifications((prev) => [notif, ...prev]);
        setUnreadCount((c) => c + 1);
      };

      socket.on("notification:new", handleNotification);

      return () => {
        socket.off("notification:new", handleNotification);
      };
    }
  }, [user, refreshProjects, refreshDepartments, refreshTeam, refreshNotifications]);

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
      notifications,
      unreadCount,
      selectedTaskKeyOrId,
      setSelectedTaskKeyOrId,
      isCreateTaskModalOpen,
      setIsCreateTaskModalOpen,
      isCommandPaletteOpen,
      setIsCommandPaletteOpen,
      refreshProjects,
      refreshDepartments,
      refreshTeam,
      refreshNotifications,
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
      notifications,
      unreadCount,
      selectedTaskKeyOrId,
      isCreateTaskModalOpen,
      isCommandPaletteOpen,
      refreshProjects,
      refreshDepartments,
      refreshTeam,
      refreshNotifications,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => useContext(AppContext);
