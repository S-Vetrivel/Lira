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
} from "lucide-react";
import { markNotificationRead, markAllNotificationsRead } from "../../services/api";
import UserAvatar from "../common/UserAvatar";
import LiraLogo from "../common/LiraLogo";
import { getGlassTokens } from "../../styles/glassTheme";
import { getDisplayName } from "../../utils/formatters";

export default function Header() {
  const location = useLocation();
  const {
    theme,
    toggleTheme,
    user,
    projects,
    activeProject,
    setActiveProject,
    notifications,
    unreadCount,
    refreshNotifications,
    setIsCreateTaskModalOpen,
    setIsCommandPaletteOpen,
    setSelectedTaskKeyOrId,
    isChatOpen,
    setIsChatOpen,
    handleLogout,
  } = useApp();

  const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const headerRef = useRef(null);

  useEffect(() => {
    const handleOutside = (e) => {
      if (headerRef.current && !headerRef.current.contains(e.target)) {
        setShowWorkspaceMenu(false);
        setShowNotifications(false);
        setShowProfileMenu(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const navItems = [
    { label: "Dashboard", path: "/", icon: LayoutDashboard, aliases: ["/analytics", "/dashboard"] },
    { label: "Board", path: "/board", icon: Kanban },
    { label: "Grid", path: "/table", icon: Table2 },
    { label: "Calendar", path: "/calendar", icon: CalendarDays },
    { label: "Requests", path: "/requests", icon: FileCheck2 },
    { label: "My Day", path: "/my-work", icon: CheckSquare },
    { label: "Team", path: "/team", icon: Users },
    { label: "Workspaces", path: "/projects", icon: Layers },
  ];

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead();
    refreshNotifications();
  };

  const handleNotificationClick = async (notif) => {
    if (!notif.isRead) {
      await markNotificationRead(notif._id);
      refreshNotifications();
    }
    if (notif.task?.key || notif.task?._id) {
      setSelectedTaskKeyOrId(notif.task.key || notif.task._id);
      setShowNotifications(false);
    }
  };

  const isDark = theme === "dark";
  const g = getGlassTokens(isDark);
  const displayName = getDisplayName(user, "Member");

  return (
    <header
      ref={headerRef}
      className={`w-full h-[68px] border-b px-3 sm:px-5 xl:px-6 flex items-center justify-between gap-2 xl:gap-3 z-40 shrink-0 select-none transition-colors duration-150 ${g.header}`}
    >
      {/* 1. Left: Brand + Modern Frosted Workspace Switcher Tray */}
      <div className="flex items-center gap-2.5 shrink-0 min-w-0">
        <Link to="/" className="flex items-center group shrink-0" title="Go to Dashboard Home">
          <LiraLogo size="md" isDark={isDark} />
        </Link>

        <div className={`hidden sm:block h-5 w-px shrink-0 ${isDark ? "bg-white/12" : "bg-slate-900/12"}`} />

        {/* Interactive Glass Workspace Switcher */}
        {projects.length > 0 && (
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowWorkspaceMenu((prev) => !prev);
                setShowNotifications(false);
                setShowProfileMenu(false);
              }}
              className={`h-10 flex items-center gap-2 px-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${g.btnSecondary}`}
              title="Switch active project workspace"
            >
              <span
                className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold tracking-wide border ${g.badge}`}
              >
                {activeProject?.prefix || "ALL"}
              </span>
              <span className={`hidden 2xl:inline truncate max-w-[165px] ${g.heading}`}>
                {activeProject?.name || "Select Workspace"}
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 shrink-0 transition-transform duration-150 ${g.muted} ${
                  showWorkspaceMenu ? "rotate-180" : ""
                }`}
              />
            </button>

            <AnimatePresence>
              {showWorkspaceMenu && (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 4, scale: 0.98 }}
                  transition={{ duration: 0.14 }}
                  className={`absolute left-0 mt-2.5 w-72 rounded-2xl border p-2 z-50 ${g.dropdown}`}
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
                          className={`w-full flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-xl text-left text-xs transition-all cursor-pointer border ${
                            selected
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
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* 2. Center: Spacious Modern Floating Glass Navigation Tray */}
      <nav
        className={`hidden md:flex items-center p-1 rounded-2xl border relative gap-0.5 min-w-0 ${g.navRail}`}
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
              className={`relative flex items-center gap-1.5 px-2.5 xl:px-3 py-2 rounded-xl text-[11px] xl:text-xs font-medium tracking-tight transition-colors duration-150 select-none whitespace-nowrap ${
                isActive
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
                className={`w-3.5 h-3.5 relative z-10 shrink-0 ${
                  isActive ? "opacity-100" : "opacity-65"
                }`}
              />
              <span className="relative z-10">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* 3. Right: Modern Spacious Action & System Tray */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Grouped Frosted System Utility Tray */}
        <div className={`flex items-center gap-1 p-1 rounded-2xl border ${g.utilityTray}`}>
          {/* Spotlight Search Trigger */}
          <button
            type="button"
            onClick={() => setIsCommandPaletteOpen(true)}
            className={`group h-9 flex items-center gap-1.5 px-2.5 rounded-xl text-xs font-medium transition-all duration-150 cursor-pointer border border-transparent ${
              isDark
                ? "text-zinc-300 hover:text-white hover:bg-white/[0.08]"
                : "text-slate-600 hover:text-slate-950 hover:bg-white/90"
            }`}
            title="Quick Search (⌘K or Ctrl+K)"
          >
            <Search className="w-4 h-4 opacity-80 group-hover:opacity-100" />
            <kbd
              className={`hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono font-semibold rounded-md border ${g.badge}`}
            >
              ⌘K
            </kbd>
          </button>

          <div className={`h-5 w-px ${isDark ? "bg-white/[0.09]" : "bg-slate-900/[0.09]"}`} />

          {/* Icon-Only Office Chat Trigger */}
          <button
            type="button"
            onClick={() => setIsChatOpen(true)}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer relative ${
              isChatOpen
                ? g.selectedRow
                : isDark
                ? "text-zinc-300 hover:text-white hover:bg-white/[0.09]"
                : "text-slate-700 hover:text-slate-950 hover:bg-white"
            }`}
            title="Office Chat & File Sharing"
            aria-label="Office Chat"
          >
            <MessageSquare className="w-[17px] h-[17px]" />
            <span
              className={`absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-400 ring-2 ${
                isDark ? "ring-[#14161d]" : "ring-white"
              }`}
            />
          </button>

          {/* Theme Toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
              isDark
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
              onClick={() => {
                setShowNotifications((prev) => !prev);
                setShowProfileMenu(false);
                setShowWorkspaceMenu(false);
              }}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer relative ${
                showNotifications
                  ? g.selectedRow
                  : isDark
                  ? "text-zinc-300 hover:text-white hover:bg-white/[0.09]"
                  : "text-slate-700 hover:text-slate-950 hover:bg-white"
              }`}
              title="Notifications"
              aria-label="Notifications"
            >
              <Bell className="w-[17px] h-[17px]" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[17px] h-[17px] px-1 rounded-full bg-rose-500 text-white text-[9px] font-mono font-bold flex items-center justify-center shadow-sm">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>

            <AnimatePresence>
              {showNotifications && (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 4, scale: 0.98 }}
                  transition={{ duration: 0.14 }}
                  className={`absolute right-0 mt-3 w-80 sm:w-96 rounded-2xl border p-3.5 z-50 ${g.dropdown}`}
                >
                  <div className={`flex items-center justify-between pb-2.5 border-b mb-2.5 ${g.border}`}>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold ${g.heading}`}>Notifications</span>
                      {unreadCount > 0 && (
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${g.badge}`}>
                          {unreadCount} new
                        </span>
                      )}
                    </div>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={handleMarkAllRead}
                        className={`text-[11px] font-semibold px-2 py-1 rounded-lg transition-colors cursor-pointer ${g.btnSecondary}`}
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="space-y-1.5 max-h-72 overflow-y-auto pr-0.5">
                    {notifications.map((n) => (
                      <div
                        key={n._id}
                        onClick={() => handleNotificationClick(n)}
                        className={`p-3 rounded-xl text-xs transition-all cursor-pointer border ${
                          n.isRead
                            ? `${g.subtleSurface} opacity-75 hover:opacity-100`
                            : `${g.selectedRow} font-medium`
                        }`}
                      >
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

        {/* Prominent New Task CTA */}
        <button
          type="button"
          onClick={() => setIsCreateTaskModalOpen(true)}
          className={`h-10 flex items-center gap-1.5 text-xs px-3 xl:px-3.5 rounded-xl transition-all active:scale-95 cursor-pointer ${g.btnPrimary}`}
          title="Create New Task"
        >
          <Plus className="w-4 h-4 shrink-0" />
          <span className="hidden 2xl:inline">New Task</span>
          <span className="hidden sm:inline 2xl:hidden">Task</span>
        </button>

        {/* Larger Profile & Session Tray */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setShowProfileMenu((prev) => !prev);
              setShowNotifications(false);
              setShowWorkspaceMenu(false);
            }}
            className={`h-10 flex items-center gap-2 pl-1.5 pr-2.5 rounded-xl transition-all cursor-pointer ${g.btnSecondary}`}
            title={displayName}
          >
            <UserAvatar
              user={user}
              className="w-7 h-7 rounded-lg border border-white/15"
              textClass="text-xs"
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
              className={`w-3.5 h-3.5 shrink-0 transition-transform duration-150 ${g.muted} ${
                showProfileMenu ? "rotate-180" : ""
              }`}
            />
          </button>

          <AnimatePresence>
            {showProfileMenu && (
              <motion.div
                initial={{ opacity: 0, y: 6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 4, scale: 0.98 }}
                transition={{ duration: 0.14 }}
                className={`absolute right-0 mt-2.5 w-64 rounded-2xl border p-3.5 z-50 space-y-3 ${g.dropdown}`}
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

                {/* Mobile Navigation Links */}
                <div className={`md:hidden pt-2 border-t space-y-1 ${g.border}`}>
                  {navItems.map((n) => {
                    const NavIcon = n.icon;
                    return (
                      <Link
                        key={n.path}
                        to={n.path}
                        onClick={() => setShowProfileMenu(false)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium ${g.rowHover} ${
                          isDark ? "text-zinc-200" : "text-slate-700"
                        }`}
                      >
                        <NavIcon className="w-3.5 h-3.5 opacity-70" />
                        <span>{n.label}</span>
                      </Link>
                    );
                  })}
                </div>

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
    </header>
  );
}
