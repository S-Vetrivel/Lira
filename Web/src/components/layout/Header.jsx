import React, { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useApp } from "../../context/Appcontext";
import {
  Bell,
  Search,
  Plus,
  ChevronDown,
  LogOut,
  Sun,
  Moon,
  Check,
  MessageSquare,
  User as UserIcon,
  LayoutDashboard,
  Kanban,
  Table2,
  CalendarDays,
  FileCheck2,
  CheckSquare,
  Users,
  Layers,
  FolderKanban,
  Shield,
  Activity,
  KeyRound,
  Maximize2,
  Menu,
  X,
  RefreshCw,
  Megaphone,
} from "lucide-react";
import { markNotificationRead, markAllNotificationsRead } from "../../services/api";
import { enableBrowserPush } from "../../services/pushClient";
import { subscribeAppUpdater, getAppUpdaterSnapshot, reopenAppUpdateModal } from "../../services/appUpdater";
import UserAvatar from "../common/UserAvatar";
import LiraLogo from "../common/LiraLogo";
import SideDrawer from "../common/SideDrawer";
import { getGlassTokens } from "../../styles/glassTheme";
import { getDisplayName } from "../../utils/formatters";

export default function Header() {
  const location = useLocation();
  const {
    theme,
    toggleTheme,
    user,
    isSuperAdmin,
    hasModule,
    hasPermission,
    projects,
    activeProject,
    setActiveProject,
    notifications,
    unreadCount,
    unreadChatCount,
    pendingJoinCount,
    pendingRequestsCount,
    myPendingCount,
    pendingReviewCount,
    pushPermission,
    setPushPermission,
    refreshNotifications,
    navigateFromNotification,
    setIsCreateTaskModalOpen,
    setIsCommandPaletteOpen,
    setSelectedTaskKeyOrId,
    isChatOpen,
    setIsChatOpen,
    handleLogout,
  } = useApp();

  const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showNotificationsSidebar, setShowNotificationsSidebar] = useState(false);
  const [notifFilter, setNotifFilter] = useState("all");
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showMobileNav, setShowMobileNav] = useState(false);
  const [appUpdateSnap, setAppUpdateSnap] = useState(getAppUpdaterSnapshot);

  useEffect(() => subscribeAppUpdater(setAppUpdateSnap), []);

  const headerRef = useRef(null);

  useEffect(() => {
    const handleOutside = (e) => {
      if (headerRef.current && !headerRef.current.contains(e.target)) {
        setShowWorkspaceMenu(false);
        setShowNotifications(false);
        setShowProfileMenu(false);
      }
    };
    const onCloseAll = () => {
      setShowWorkspaceMenu(false);
      setShowNotifications(false);
      setShowNotificationsSidebar(false);
      setShowProfileMenu(false);
      setShowMobileNav(false);
    };
    const onSidebarOpened = (e) => {
      if (e?.detail?.id && e.detail.id !== "notifications") {
        setShowNotificationsSidebar(false);
      }
      if (e?.detail?.id && e.detail.id !== "mobile-nav") {
        setShowMobileNav(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    window.addEventListener("lira:close-all-sidebars", onCloseAll);
    window.addEventListener("lira:sidebar-opened", onSidebarOpened);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      window.removeEventListener("lira:close-all-sidebars", onCloseAll);
      window.removeEventListener("lira:sidebar-opened", onSidebarOpened);
    };
  }, []);

  const navItems = [
    { label: "Dashboard", path: "/", icon: LayoutDashboard, aliases: ["/analytics", "/dashboard"], moduleKey: "dashboard" },
    { label: "Board", path: "/board", icon: Kanban, pendingCount: pendingReviewCount, moduleKey: "board" },
    { label: "Grid", path: "/table", icon: Table2, moduleKey: "board" },
    { label: "Calendar", path: "/calendar", icon: CalendarDays, moduleKey: "board" },
    { label: "Requests", path: "/requests", icon: FileCheck2, pendingCount: pendingRequestsCount, moduleKey: "requests" },
    { label: "My Day", path: "/my-work", icon: CheckSquare, pendingCount: myPendingCount, moduleKey: "tasks" },
    { label: "Team", path: "/team", icon: Users, pendingCount: pendingJoinCount, moduleKey: "team" },
    { label: "Workspaces", path: "/projects", icon: Layers, moduleKeys: ["projects", "departments"] },
    ...(isSuperAdmin || hasPermission("rbac.view") || hasPermission("rbac.manage")
      ? [{ label: "Roles", path: "/roles", icon: Shield, moduleKey: "rbac" }]
      : []),
    ...(isSuperAdmin || hasPermission("audit.view") || hasPermission("dashboard.logs")
      ? [{ label: "Audit", path: "/audit", icon: Activity, moduleKey: "audit" }]
      : []),
    ...(isSuperAdmin || hasPermission("broadcast.view") || hasPermission("broadcast.send")
      ? [{ label: "Broadcast", path: "/broadcast", icon: Megaphone, moduleKey: "broadcast" }]
      : []),
  ].filter((item) => {
    if (isSuperAdmin) return true;
    if (Array.isArray(item.moduleKeys)) {
      return item.moduleKeys.some((k) => hasModule(k));
    }
    return !item.moduleKey || hasModule(item.moduleKey);
  });

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead();
    refreshNotifications();
  };

  const handleNotificationClick = async (notif) => {
    setShowNotifications(false);
    await navigateFromNotification(notif);
  };

  const isDark = theme === "dark";
  const g = getGlassTokens(isDark);
  const displayName = getDisplayName(user, "Member");

  return (
    <div ref={headerRef} className="w-full relative z-40 shrink-0 select-none">
    <header
      className={`w-full relative z-50 h-14 md:h-[68px] border-b px-2.5 sm:px-5 xl:px-6 flex items-center justify-between gap-1.5 sm:gap-2 xl:gap-3 transition-colors duration-150 ${g.header}`}
    >
      {/* 1. Left: Mobile Menu + Brand + Modern Frosted Workspace Switcher Tray */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0 min-w-0">
        <button
          type="button"
          data-testid="mobile-nav-menu-btn"
          onClick={() => {
            setShowWorkspaceMenu(false);
            setShowNotifications(false);
            setShowProfileMenu(false);
            setShowMobileNav(true);
          }}
          className={`md:hidden w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 transition-colors cursor-pointer ${g.btnSecondary}`}
          title="Open Navigation Menu"
          aria-label="Open Navigation Menu"
        >
          <Menu className="w-4 h-4" />
        </button>

        <Link to="/" className="flex items-center group shrink-0" title="Go to Dashboard Home">
          <span className="sm:hidden inline-flex items-center">
            <LiraLogo size="sm" isDark={isDark} />
          </span>
          <span className="hidden sm:inline-flex items-center">
            <LiraLogo size="md" isDark={isDark} />
          </span>
        </Link>

        <div className={`hidden sm:block h-5 w-px shrink-0 ${isDark ? "bg-white/12" : "bg-slate-900/12"}`} />

        {/* Interactive Glass Workspace Switcher */}
        {projects.length > 0 && (isSuperAdmin || hasModule("projects") || hasModule("board") || hasModule("tasks")) && (
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowWorkspaceMenu((prev) => !prev);
                setShowNotifications(false);
                setShowProfileMenu(false);
              }}
              className={`h-8 sm:h-10 flex items-center gap-1 sm:gap-2 px-1.5 sm:px-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${g.btnSecondary}`}
              title="Switch active project workspace"
            >
              <span
                className={`px-1.5 sm:px-2 py-0.5 rounded-md text-[10px] font-mono font-bold tracking-wide border ${g.badge}`}
              >
                {activeProject?.prefix || "ALL"}
              </span>
              <span className={`hidden 2xl:inline truncate max-w-[165px] ${g.heading}`}>
                {activeProject?.name || "Select Workspace"}
              </span>
              <ChevronDown
                className={`hidden sm:block w-3.5 h-3.5 shrink-0 transition-transform duration-150 ${g.muted} ${showWorkspaceMenu ? "rotate-180" : ""
                  }`}
              />
            </button>

            <AnimatePresence>
              {showWorkspaceMenu && (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1, pointerEvents: "auto" }}
                  exit={{ opacity: 0, y: 4, scale: 0.98, pointerEvents: "none" }}
                  transition={{ duration: 0.14 }}
                  className={`fixed left-2.5 right-2.5 top-[60px] max-h-[calc(100dvh-76px)] overflow-y-auto sm:max-h-none sm:overflow-visible sm:top-auto sm:right-auto sm:absolute sm:left-0 sm:mt-2.5 sm:w-72 rounded-2xl border p-2 z-50 ${g.dropdown}`}
                >
                  <div className={`px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-widest ${g.muted}`}>
                    Project Workspaces ({projects.length})
                  </div>
                  <div className="space-y-1 max-h-64 overflow-y-auto mt-1">
                    {projects.map((proj) => {
                      const selected = activeProject?._id === proj._id;
                      return (
                        <button
                          key={proj._id}
                          type="button"
                          onClick={() => {
                            setActiveProject(proj);
                            setShowWorkspaceMenu(false);
                          }}
                          className={`w-full flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-xl text-left text-xs transition-all cursor-pointer border ${selected
                            ? g.selectedRow
                            : `border-transparent ${g.rowHover} ${isDark ? "text-zinc-300" : "text-slate-700"}`
                            }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span
                              className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold border shrink-0 ${g.badge}`}
                            >
                              {proj.prefix}
                            </span>
                            <div className="min-w-0">
                              <span className="font-semibold block truncate">{proj.name}</span>
                              {proj.description && (
                                <span className={`text-[10px] block truncate ${g.muted}`}>
                                  {proj.description}
                                </span>
                              )}
                            </div>
                          </div>
                          {selected && <Check className="w-3.5 h-3.5 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                  {(isSuperAdmin || hasModule("projects") || hasModule("departments")) && (
                    <div className={`mt-2 pt-2 border-t ${g.border}`}>
                      <Link
                        to="/projects"
                        onClick={() => setShowWorkspaceMenu(false)}
                        className={`flex items-center justify-center gap-1.5 w-full py-1.5 rounded-xl text-[11px] font-semibold transition-colors ${g.btnSecondary}`}
                      >
                        <FolderKanban className="w-3.5 h-3.5" />
                        <span>Manage All Workspaces</span>
                      </Link>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* 2. Center: Spacious Modern Floating Glass Navigation Tray */}
      <nav
        className={`hidden md:flex items-center p-1 rounded-2xl border relative gap-0.5 min-w-0 flex-1 max-w-fit overflow-x-auto no-scrollbar ${g.navRail}`}
      >
        {navItems.map((item) => {
          const isActive =
            location.pathname === item.path ||
            (item.aliases && item.aliases.includes(location.pathname));
          const Icon = item.icon;

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`relative flex items-center gap-1.5 px-2 xl:px-2.5 py-2 rounded-xl text-[11px] xl:text-xs font-medium tracking-tight transition-colors duration-150 select-none whitespace-nowrap shrink-0 ${isActive
                ? isDark
                  ? "text-white font-semibold"
                  : "text-slate-950 font-semibold"
                : isDark
                  ? "text-zinc-400 hover:text-zinc-100"
                  : "text-slate-600 hover:text-slate-950"
                }`}
            >
              {isActive && (
                <motion.div
                  layoutId="activeNavPill"
                  transition={{
                    type: "spring",
                    stiffness: 480,
                    damping: 38,
                    mass: 0.8,
                  }}
                  className={`absolute inset-0 rounded-xl ${g.navActivePill}`}
                  style={{ zIndex: 0 }}
                />
              )}
              <Icon
                className={`w-3.5 h-3.5 relative z-10 shrink-0 ${isActive ? "opacity-100" : "opacity-65"
                  }`}
              />
              <span className="relative z-10">{item.label}</span>
              {item.pendingCount > 0 && (
                <span
                  className="relative z-10 w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0"
                  title={`${item.pendingCount} action(s) required`}
                />
              )}
            </Link>
          );
        })}
      </nav>

      {/* 3. Right: Modern Spacious Action & System Tray */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {appUpdateSnap.available && !appUpdateSnap.modalOpen && (
          <button
            type="button"
            onClick={reopenAppUpdateModal}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-semibold border transition-colors cursor-pointer shrink-0 ${
              isDark
                ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
                : "border-emerald-600/35 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20"
            }`}
            title="New workspace update available — click to update & refresh"
          >
            <RefreshCw className="w-3 h-3" />
            <span className="hidden sm:inline">Update Ready</span>
          </button>
        )}

        {/* Grouped Frosted System Utility Tray */}
        <div className={`flex items-center gap-0.5 sm:gap-1 p-0.5 sm:p-1 rounded-xl sm:rounded-2xl border ${g.utilityTray}`}>
          {/* Spotlight Search Trigger */}
          <button
            type="button"
            onClick={() => setIsCommandPaletteOpen(true)}
            className={`group h-8 w-8 sm:w-auto sm:h-9 flex items-center justify-center sm:gap-1.5 sm:px-2.5 rounded-lg sm:rounded-xl text-xs font-medium transition-all duration-150 cursor-pointer border border-transparent ${isDark
              ? "text-zinc-300 hover:text-white hover:bg-white/[0.08]"
              : "text-slate-600 hover:text-slate-950 hover:bg-white/90"
              }`}
            title="Quick Search (⌘K or Ctrl+K)"
            aria-label="Quick Search"
          >
            <Search className="w-4 h-4 opacity-80 group-hover:opacity-100" />
            <kbd
              className={`hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono font-semibold rounded-md border ${g.badge}`}
            >
              ⌘K
            </kbd>
          </button>

          <div className={`hidden sm:block h-5 w-px ${isDark ? "bg-white/[0.09]" : "bg-slate-900/[0.09]"}`} />

          {/* Icon-Only Office Chat Trigger */}
          {(isSuperAdmin || hasModule("chat")) && (
          <button
            type="button"
            onClick={() => setIsChatOpen(true)}
            className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl flex items-center justify-center transition-all cursor-pointer relative ${isChatOpen
              ? g.selectedRow
              : isDark
                ? "text-zinc-300 hover:text-white hover:bg-white/[0.09]"
                : "text-slate-700 hover:text-slate-950 hover:bg-white"
              }`}
            title="Office Chat & File Sharing"
            aria-label="Office Chat"
          >
            <MessageSquare className="w-[16px] h-[16px] sm:w-[17px] sm:h-[17px]" />
            {unreadChatCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-emerald-500 text-white text-[9px] font-mono font-bold flex items-center justify-center shadow-sm">
                {unreadChatCount > 9 ? "9+" : unreadChatCount}
              </span>
            )}
          </button>
          )}

          {/* Theme Toggle (desktop header + available in mobile drawer) */}
          <button
            type="button"
            data-ai-target="theme-toggle-btn"
            onClick={toggleTheme}
            className={`hidden sm:flex w-9 h-9 rounded-xl items-center justify-center transition-all cursor-pointer ${isDark
              ? "text-zinc-300 hover:text-white hover:bg-white/[0.09]"
              : "text-slate-700 hover:text-slate-950 hover:bg-white"
              }`}
            title={isDark ? "Switch to Light Theme" : "Switch to Dark Theme"}
            aria-label="Toggle Theme"
          >
            {isDark ? (
              <Sun className="w-[17px] h-[17px] text-amber-300" />
            ) : (
              <Moon className="w-[17px] h-[17px] text-slate-700" />
            )}
          </button>

          {/* Notifications Tray Trigger */}
          <div className="relative">
            <button
              type="button"
              data-ai-target="notifications-bell-btn"
              onClick={() => {
                setShowNotifications((prev) => !prev);
                setShowProfileMenu(false);
                setShowWorkspaceMenu(false);
              }}
              className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl flex items-center justify-center transition-all cursor-pointer relative ${showNotifications
                ? g.selectedRow
                : isDark
                  ? "text-zinc-300 hover:text-white hover:bg-white/[0.09]"
                  : "text-slate-700 hover:text-slate-950 hover:bg-white"
                }`}
              title="Notifications"
              aria-label="Notifications"
            >
              <Bell className="w-[16px] h-[16px] sm:w-[17px] sm:h-[17px]" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-rose-500 text-white text-[9px] font-mono font-bold flex items-center justify-center shadow-sm">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>

            <AnimatePresence>
              {showNotifications && (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1, pointerEvents: "auto" }}
                  exit={{ opacity: 0, y: 4, scale: 0.98, pointerEvents: "none" }}
                  transition={{ duration: 0.14 }}
                  className={`fixed left-2.5 right-2.5 top-[60px] max-h-[calc(100dvh-76px)] overflow-y-auto sm:max-h-none sm:overflow-visible sm:top-auto sm:left-auto sm:absolute sm:right-0 sm:mt-3 sm:w-96 rounded-2xl border p-3.5 z-50 ${g.dropdown}`}
                >
                  <div className={`flex items-center justify-between pb-2.5 border-b mb-2.5 ${g.border}`}>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold ${g.heading}`}>Notifications</span>
                      {unreadCount > 0 && (
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${g.badge}`}>
                          {unreadCount} new
                        </span>
                      )}
                      {pushPermission === "granted" ? (
                        <span className="px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                          Push Active
                        </span>
                      ) : pushPermission === "denied" ? (
                        <span className="px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/25">
                          Blocked
                        </span>
                      ) : pushPermission === "default" ? (
                        <button
                          type="button"
                          onClick={async () => {
                            const res = await enableBrowserPush({ interactive: true });
                            if (res?.permission) setPushPermission?.(res.permission);
                          }}
                          className="px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/25 hover:bg-amber-500/25 cursor-pointer"
                        >
                          Enable Push
                        </button>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {unreadCount > 0 && (
                        <button
                          type="button"
                          data-ai-target="notifications-mark-read-btn"
                          onClick={handleMarkAllRead}
                          className={`text-[11px] font-semibold px-2 py-1 rounded-lg transition-colors cursor-pointer ${g.btnSecondary}`}
                        >
                          Mark all read
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setShowNotifications(false);
                          setShowNotificationsSidebar(true);
                        }}
                        className={`p-1.5 rounded-lg transition-colors cursor-pointer ${g.btnSecondary}`}
                        title="Expand Notifications Sidebar"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5 max-h-72 overflow-y-auto pr-0.5">
                    {notifications.map((n) => (
                      <div
                        key={n._id}
                        onClick={() => handleNotificationClick(n)}
                        className={`p-3 rounded-xl text-xs transition-all cursor-pointer border ${n.isRead
                          ? `${g.subtleSurface} opacity-75 hover:opacity-100`
                          : `${g.selectedRow} font-medium`
                          }`}
                      >
                        {(n.title || n.publicId) && (
                          <div className="flex items-center justify-between gap-2 mb-1">
                            {n.title && (
                              <span className="text-[11px] font-bold truncate">{n.title}</span>
                            )}
                            {n.publicId && (
                              <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono text-[9px] font-bold shrink-0">
                                {n.publicId}
                              </span>
                            )}
                          </div>
                        )}
                        <p className="line-clamp-2 leading-relaxed">{n.message}</p>
                        <span className={`text-[10px] font-mono block mt-1 ${g.muted}`}>
                          {new Date(n.createdAt).toLocaleTimeString("en-IN", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    ))}
                    {notifications.length === 0 && (
                      <p className={`text-xs italic text-center py-6 ${g.muted}`}>
                        You're all caught up — no notifications
                      </p>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Prominent New Task CTA — visible only if user holds tasks.create permission */}
        {(isSuperAdmin || hasPermission("tasks.create")) && (
          <button
            type="button"
            data-ai-target="header-new-task-btn"
            onClick={() => setIsCreateTaskModalOpen(true)}
            className={`h-8 w-8 sm:h-10 sm:w-auto flex items-center justify-center gap-1.5 text-xs sm:px-3 xl:px-3.5 rounded-xl transition-all active:scale-95 cursor-pointer ${g.btnPrimary}`}
            title="Create New Task"
            aria-label="Create New Task"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span className="hidden 2xl:inline">New Task</span>
            <span className="hidden sm:inline 2xl:hidden">Task</span>
          </button>
        )}

        {/* Larger Profile & Session Tray */}
        <div className="relative">
          <button
            type="button"
            data-testid="header-profile-btn"
            onClick={() => {
              setShowProfileMenu((prev) => !prev);
              setShowNotifications(false);
              setShowWorkspaceMenu(false);
            }}
            className={`h-8 sm:h-10 flex items-center gap-1.5 sm:gap-2 p-1 sm:pl-1.5 sm:pr-2.5 rounded-xl transition-all cursor-pointer ${g.btnSecondary}`}
            title={displayName}
          >
            <UserAvatar
              user={user}
              className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg border border-white/15"
              textClass="text-[11px] sm:text-xs"
            />
            <div className="hidden 2xl:block text-left leading-tight">
              <span className={`text-xs font-semibold block truncate max-w-[96px] ${g.heading}`}>
                {displayName}
              </span>
              <span className={`text-[10px] capitalize block ${g.muted}`}>
                {user?.role || "employee"}
              </span>
            </div>
            <ChevronDown
              className={`hidden sm:block w-3.5 h-3.5 shrink-0 transition-transform duration-150 ${g.muted} ${showProfileMenu ? "rotate-180" : ""
                }`}
            />
          </button>

          <AnimatePresence>
            {showProfileMenu && (
              <motion.div
                initial={{ opacity: 0, y: 6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1, pointerEvents: "auto" }}
                exit={{ opacity: 0, y: 4, scale: 0.98, pointerEvents: "none" }}
                transition={{ duration: 0.14 }}
                className={`fixed left-2.5 right-2.5 top-[60px] max-h-[calc(100dvh-76px)] overflow-y-auto sm:max-h-none sm:overflow-visible sm:top-auto sm:left-auto sm:absolute sm:right-0 sm:mt-2.5 sm:w-64 rounded-2xl border p-3.5 z-50 space-y-2.5 ${g.dropdown}`}
              >
                <div className={`flex items-center gap-3 pb-3 border-b ${g.border}`}>
                  <UserAvatar
                    user={user}
                    className="w-10 h-10 rounded-xl border border-white/20"
                    textClass="text-sm"
                  />
                  <div className="min-w-0 flex-1">
                    <p className={`text-xs font-bold truncate ${g.heading}`}>{displayName}</p>
                    <p className={`text-[10px] truncate ${g.muted}`}>{user?.email}</p>
                    {user?.publicId && (
                      <span
                        className={`inline-block mt-1 text-[10px] font-mono font-bold border px-2 py-0.5 rounded-md ${g.badge}`}
                      >
                        {user?.publicId}
                      </span>
                    )}
                  </div>
                </div>

                {/* Profile & Account Link */}
                <Link
                  to="/profile"
                  onClick={() => setShowProfileMenu(false)}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors ${g.btnSecondary}`}
                >
                  <UserIcon className={`w-4 h-4 ${g.accentIcon}`} />
                  <span>Profile & Account Settings</span>
                </Link>

                {(isSuperAdmin || hasPermission("ai.use")) && (
                  <Link
                    to="/profile?tab=ai"
                    onClick={() => setShowProfileMenu(false)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${g.btnSecondary}`}
                  >
                    <KeyRound className="w-4 h-4 text-purple-400" />
                    <span>My AI Keys (BYOK)</span>
                  </Link>
                )}

                {(isSuperAdmin || hasPermission("ai.manage")) && (
                  <Link
                    to="/roles?tab=ai"
                    onClick={() => setShowProfileMenu(false)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${g.btnSecondary}`}
                  >
                    <Shield className="w-4 h-4 text-emerald-400" />
                    <span>Superadmin AI Vault & Keys</span>
                  </Link>
                )}

                {/* Mobile quick theme toggle inside Profile menu */}
                <button
                  type="button"
                  onClick={toggleTheme}
                  className={`sm:hidden w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${g.btnSecondary}`}
                >
                  {isDark ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4" />}
                  <span>{isDark ? "Switch to Light Theme" : "Switch to Dark Theme"}</span>
                </button>

                <div className={`pt-2 border-t ${g.border}`}>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold text-rose-400 hover:bg-rose-500/15 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <SideDrawer
        sidebarId="notifications"
        isOpen={showNotificationsSidebar}
        onClose={() => setShowNotificationsSidebar(false)}
        title={`Notifications (${unreadCount} unread)`}
        subtitle="Real-time WebSocket & Push notifications across your workspaces."
        icon={Bell}
        widthClass="max-w-lg"
      >
        <div className="space-y-4">
          <div className={`flex flex-wrap items-center justify-between gap-2 pb-3 border-b ${g.border}`}>
            <div className="flex items-center gap-1.5">
              {[
                { key: "all", label: `All (${notifications.length})` },
                { key: "unread", label: `Unread (${unreadCount})` },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setNotifFilter(tab.key)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
                    notifFilter === tab.key ? g.pillActive : g.pillInactive
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              {pushPermission === "granted" ? (
                <span className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                  Push Active
                </span>
              ) : pushPermission === "default" ? (
                <button
                  type="button"
                  onClick={async () => {
                    if (typeof Notification !== "undefined") {
                      const perm = await Notification.requestPermission();
                      setPushPermission?.(perm);
                    }
                  }}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/25 hover:bg-amber-500/25 cursor-pointer"
                >
                  Enable Push
                </button>
              ) : null}

              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 cursor-pointer ${g.btnSecondary}`}
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Mark all read</span>
                </button>
              )}
            </div>
          </div>

          <div className="space-y-2.5">
            {notifications
              .filter((n) => (notifFilter === "unread" ? !n.isRead : true))
              .map((n) => (
                <div
                  key={n._id}
                  onClick={() => {
                    setShowNotificationsSidebar(false);
                    handleNotificationClick(n);
                  }}
                  className={`p-3.5 rounded-2xl text-xs transition-all cursor-pointer border ${
                    n.isRead
                      ? `${g.subtleSurface} opacity-75 hover:opacity-100`
                      : `${g.selectedRow} font-medium`
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      {!n.isRead && <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />}
                      <span className={`text-xs font-bold truncate ${g.heading}`}>
                        {n.title || "Workspace Activity"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {n.publicId && (
                        <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono text-[10px] font-bold">
                          {n.publicId}
                        </span>
                      )}
                      <span className={`text-[10px] font-mono ${g.muted}`}>
                        {new Date(n.createdAt).toLocaleString("en-IN", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                  <p className="leading-relaxed text-xs">{n.message}</p>
                </div>
              ))}

            {notifications.filter((n) => (notifFilter === "unread" ? !n.isRead : true)).length === 0 && (
              <div className={`py-14 text-center text-xs italic ${g.muted}`}>
                {notifFilter === "unread"
                  ? "No unread notifications."
                  : "You're all caught up — no notifications."}
              </div>
            )}
          </div>
        </div>
      </SideDrawer>
    </header>

    {/* Mobile / Portrait Horizontally Scrollable Primary Route Bar (always accessible below header < md) */}
    <nav
      aria-label="Mobile Navigation"
      data-testid="mobile-route-bar"
      className={`md:hidden relative z-30 w-full border-b px-2.5 py-1.5 flex items-center gap-1 overflow-x-auto no-scrollbar ${g.header}`}
    >
      {navItems.map((item) => {
        const isActive =
          location.pathname === item.path ||
          (item.aliases && item.aliases.includes(location.pathname));
        const Icon = item.icon;
        return (
          <Link
            key={item.path}
            to={item.path}
            onClick={() => {
              setShowWorkspaceMenu(false);
              setShowNotifications(false);
              setShowProfileMenu(false);
            }}
            className={`relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold whitespace-nowrap shrink-0 transition-colors border ${
              isActive
                ? `${g.navActivePill} ${isDark ? "text-white border-white/15" : "text-slate-950 border-slate-900/15"}`
                : `border-transparent ${isDark ? "text-zinc-400 hover:text-zinc-100" : "text-slate-600 hover:text-slate-950"}`
            }`}
          >
            <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? "opacity-100" : "opacity-70"}`} />
            <span>{item.label}</span>
            {item.pendingCount > 0 && (
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
            )}
          </Link>
        );
      })}
    </nav>

    {/* Mobile Left Navigation & Workspace Drawer */}
    <SideDrawer
      sidebarId="mobile-nav"
      position="left"
      isOpen={showMobileNav}
      onClose={() => setShowMobileNav(false)}
      title="Navigation"
      subtitle={activeProject ? `[${activeProject.prefix}] ${activeProject.name}` : "Lira Workspace"}
      headerIcon={<LiraLogo size="sm" showWordmark={false} isDark={isDark} />}
      widthClass="max-w-xs"
      footer={
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl border text-xs font-semibold cursor-pointer ${g.btnSecondary}`}
            >
              {isDark ? <Sun className="w-3.5 h-3.5 text-amber-300" /> : <Moon className="w-3.5 h-3.5" />}
              <span>{isDark ? "Light Theme" : "Dark Theme"}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setShowMobileNav(false);
                handleLogout();
              }}
              className="px-3.5 py-2 rounded-xl border border-rose-500/25 bg-rose-500/10 text-rose-400 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        {/* All Accessible Navigation Routes */}
        <div className="space-y-1">
          <p className={`px-2 text-[10px] font-bold uppercase tracking-widest mb-2 ${g.muted}`}>
            Workspace Routes ({navItems.length})
          </p>
          {navItems.map((item) => {
            const isActive =
              location.pathname === item.path ||
              (item.aliases && item.aliases.includes(location.pathname));
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setShowMobileNav(false)}
                className={`flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
                  isActive
                    ? g.selectedRow
                    : `border-transparent ${g.rowHover} ${isDark ? "text-zinc-200" : "text-slate-800"}`
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <Icon className="w-4 h-4 shrink-0 opacity-80" />
                  <span className="truncate">{item.label}</span>
                </span>
                {item.pendingCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    {item.pendingCount}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {/* Workspace Switcher List */}
        {projects.length > 0 && (
          <div className={`pt-4 border-t space-y-1.5 ${g.border}`}>
            <p className={`px-2 text-[10px] font-bold uppercase tracking-widest mb-1.5 ${g.muted}`}>
              Active Workspace
            </p>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {projects.map((proj) => {
                const selected = activeProject?._id === proj._id;
                return (
                  <button
                    key={proj._id}
                    type="button"
                    onClick={() => {
                      setActiveProject(proj);
                      setShowMobileNav(false);
                    }}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-left text-xs border cursor-pointer ${
                      selected
                        ? g.selectedRow
                        : `border-transparent ${g.rowHover} ${isDark ? "text-zinc-300" : "text-slate-700"}`
                    }`}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border shrink-0 ${g.badge}`}>
                        {proj.prefix}
                      </span>
                      <span className="truncate font-semibold">{proj.name}</span>
                    </span>
                    {selected && <Check className="w-3.5 h-3.5 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Quick Account & AI Shortcuts */}
        <div className={`pt-4 border-t space-y-1 ${g.border}`}>
          <p className={`px-2 text-[10px] font-bold uppercase tracking-widest mb-1.5 ${g.muted}`}>
            Account & Shortcuts
          </p>
          <Link
            to="/profile"
            onClick={() => setShowMobileNav(false)}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold ${g.rowHover}`}
          >
            <UserIcon className="w-4 h-4 opacity-75" />
            <span>Profile & Settings</span>
          </Link>
          {(isSuperAdmin || hasPermission("ai.use")) && (
            <Link
              to="/profile?tab=ai"
              onClick={() => setShowMobileNav(false)}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold ${g.rowHover}`}
            >
              <KeyRound className="w-4 h-4 text-purple-400" />
              <span>My AI Keys (BYOK)</span>
            </Link>
          )}
          {(isSuperAdmin || hasPermission("ai.manage")) && (
            <Link
              to="/roles?tab=ai"
              onClick={() => setShowMobileNav(false)}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold ${g.rowHover}`}
            >
              <Shield className="w-4 h-4 text-emerald-400" />
              <span>Superadmin AI Vault</span>
            </Link>
          )}
        </div>
      </div>
    </SideDrawer>
    </div>
  );
}
