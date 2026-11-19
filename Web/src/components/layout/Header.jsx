import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useApp } from "../../context/Appcontext";
import {
  Bell,
  Search,
  Plus,
  ChevronDown,
  LogOut,
  Sun,
  Moon,
  X,
  Check,
} from "lucide-react";
import { markNotificationRead, markAllNotificationsRead } from "../../services/api";

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
    handleDemoLogin,
    handleLogout,
  } = useApp();

  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const navItems = [
    { label: "Board", path: "/" },
    { label: "Analytics", path: "/analytics" },
    { label: "My Work", path: "/my-work" },
    { label: "Team", path: "/team" },
    { label: "Projects", path: "/projects" },
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

  return (
    <header
      className={`w-full h-16 border-b px-5 sm:px-6 flex items-center justify-between z-30 shrink-0 select-none transition-colors duration-150 ${
        isDark
          ? "bg-[#0e0f16] border-white/10 text-white"
          : "bg-white border-slate-200 text-slate-900"
      }`}
    >
      {/* 1. Left: Brand & Active Project Selector */}
      <div className="flex items-center gap-3 shrink-0">
        <Link to="/" className="flex items-center gap-2 group">
          <span
            className={`text-xl font-black tracking-tight flex items-center ${
              isDark ? "text-white" : "text-slate-900"
            }`}
          >
            lira
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500 ml-0.5" />
          </span>
        </Link>

        {/* Project Selector Pill */}
        {projects.length > 0 && (
          <div className="relative group ml-1">
            <select
              value={activeProject?._id || ""}
              onChange={(e) => {
                const selected = projects.find((p) => p._id === e.target.value);
                if (selected) setActiveProject(selected);
              }}
              className={`appearance-none text-xs font-semibold rounded-full pl-3.5 pr-8 py-1.5 cursor-pointer focus:outline-none transition-all border ${
                isDark
                  ? "bg-[#191a24] border-white/10 text-slate-200 hover:border-white/20"
                  : "bg-slate-100 border-slate-200 text-slate-800 hover:border-slate-300"
              }`}
            >
              {projects.map((proj) => (
                <option
                  key={proj._id}
                  value={proj._id}
                  className={isDark ? "bg-[#191a24] text-white" : "bg-white text-slate-900"}
                >
                  [{proj.prefix}] {proj.name}
                </option>
              ))}
            </select>
            <ChevronDown
              className={`w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none ${
                isDark ? "text-slate-400" : "text-slate-500"
              }`}
            />
          </div>
        )}
      </div>

      {/* 2. Center: Pill Navigation Tabs */}
      <nav
        className={`hidden md:flex items-center p-1 rounded-full border shadow-sm ${
          isDark
            ? "bg-[#191a24] border-white/10"
            : "bg-slate-100 border-slate-200"
        }`}
      >
        {navItems.map((item) => {
          const isActive =
            location.pathname === item.path ||
            (item.path === "/" && location.pathname === "/board");

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`px-5 py-1.5 rounded-full text-xs font-semibold tracking-tight transition-all duration-150 ${
                isActive
                  ? isDark
                    ? "bg-white text-slate-950 font-bold shadow-md shadow-white/10"
                    : "bg-slate-900 text-white font-bold shadow-md shadow-slate-900/15"
                  : isDark
                  ? "text-slate-400 hover:text-white"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* 3. Right: Search, Theme Toggle, New Task, Notifications, Profile */}
      <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
        {/* Spotlight Quick Search Pill */}
        <button
          onClick={() => setIsCommandPaletteOpen(true)}
          className={`group flex items-center gap-2 pl-3 pr-2.5 py-1.5 rounded-full border text-xs font-medium transition-all duration-150 cursor-pointer shadow-xs ${
            isDark
              ? "bg-[#191a24] border-white/10 text-slate-300 hover:text-white hover:border-white/20 hover:bg-[#20222f]"
              : "bg-slate-100 border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300 hover:bg-slate-200/80"
          }`}
          title="Search anything (⌘K or Ctrl+K)"
        >
          <Search className={`w-3.5 h-3.5 transition-transform group-hover:scale-110 ${
            isDark ? "text-slate-400 group-hover:text-blue-400" : "text-slate-500 group-hover:text-blue-600"
          }`} />
          <span className="hidden md:inline text-xs font-normal opacity-80">
            Search...
          </span>
          <kbd
            className={`hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono font-semibold rounded border ${
              isDark
                ? "bg-white/5 border-white/15 text-slate-400"
                : "bg-white border-slate-300 text-slate-600 shadow-xs"
            }`}
          >
            ⌘K
          </kbd>
        </button>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className={`w-9 h-9 rounded-full border flex items-center justify-center transition-all cursor-pointer ${
            isDark
              ? "bg-[#191a24] border-white/10 text-slate-300 hover:text-white hover:border-white/20"
              : "bg-slate-100 border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-200"
          }`}
          title={isDark ? "Switch to Light Theme" : "Switch to Dark Theme"}
        >
          {isDark ? (
            <Sun className="w-4 h-4 text-amber-300" />
          ) : (
            <Moon className="w-4 h-4 text-slate-700" />
          )}
        </button>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className={`w-9 h-9 rounded-full border flex items-center justify-center transition-all cursor-pointer relative ${
              isDark
                ? "bg-[#191a24] border-white/10 text-slate-300 hover:text-white hover:border-white/20"
                : "bg-slate-100 border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-200"
            }`}
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            )}
          </button>

          {showNotifications && (
            <div
              className={`absolute right-0 mt-2 w-80 rounded-2xl border shadow-2xl p-3 z-50 ${
                isDark
                  ? "bg-[#191a24] border-white/15 text-white"
                  : "bg-white border-slate-200 text-slate-900"
              }`}
            >
              <div
                className={`flex items-center justify-between pb-2 border-b mb-2 ${
                  isDark ? "border-white/10" : "border-slate-100"
                }`}
              >
                <span className={`text-xs font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
                  Notifications ({unreadCount})
                </span>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-[10px] text-blue-500 hover:underline font-semibold"
                  >
                    Mark all read
                  </button>
                )}
              </div>
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {notifications.map((n) => (
                  <div
                    key={n._id}
                    onClick={() => handleNotificationClick(n)}
                    className={`p-2.5 rounded-xl text-xs transition-all cursor-pointer ${
                      n.isRead
                        ? isDark
                          ? "bg-white/5 text-slate-400 hover:bg-white/10"
                          : "bg-slate-50 text-slate-500 hover:bg-slate-100"
                        : isDark
                        ? "bg-blue-600/20 text-white font-medium hover:bg-blue-600/30 border border-blue-500/30"
                        : "bg-blue-50 text-blue-900 font-medium hover:bg-blue-100 border border-blue-200"
                    }`}
                  >
                    <p className="line-clamp-2">{n.message}</p>
                    <span className="text-[10px] text-slate-400 block mt-1">
                      {new Date(n.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                ))}
                {notifications.length === 0 && (
                  <p className="text-xs text-slate-400 italic text-center py-4">No notifications</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Create Task Button */}
        <button
          onClick={() => setIsCreateTaskModalOpen(true)}
          className="flex items-center gap-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold px-3.5 py-1.5 rounded-full shadow-md shadow-blue-500/20 transition-all active:scale-95 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Task</span>
        </button>

        {/* User Profile Chip */}
        <div className="relative">
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className={`flex items-center gap-2 pl-1.5 pr-2.5 py-1 rounded-full border transition-all cursor-pointer ${
              isDark
                ? "bg-[#191a24] border-white/10 hover:border-white/25 text-white"
                : "bg-slate-100 border-slate-200 hover:border-slate-300 text-slate-900"
            }`}
          >
            <img
              src={user?.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${user?.fullname || "U"}`}
              alt={user?.fullname}
              className="w-7 h-7 rounded-full object-cover border border-white/20"
            />
            <div className="hidden lg:block text-left leading-tight">
              <span className={`text-xs font-bold block truncate max-w-[100px] ${isDark ? "text-white" : "text-slate-900"}`}>
                {user?.fullname || "Guest"}
              </span>
              <span className="text-[10px] text-slate-400 capitalize block">
                {user?.role || "employee"}
              </span>
            </div>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {showProfileMenu && (
            <div
              className={`absolute right-0 mt-2 w-60 rounded-2xl border shadow-2xl p-3 z-50 space-y-3 ${
                isDark
                  ? "bg-[#191a24] border-white/15 text-white"
                  : "bg-white border-slate-200 text-slate-900"
              }`}
            >
              <div
                className={`flex items-center gap-2.5 pb-2 border-b ${
                  isDark ? "border-white/10" : "border-slate-100"
                }`}
              >
                <img
                  src={user?.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${user?.fullname || "U"}`}
                  alt={user?.fullname}
                  className="w-8 h-8 rounded-full object-cover border border-white/20"
                />
                <div className="min-w-0 flex-1">
                  <p className={`text-xs font-bold truncate ${isDark ? "text-white" : "text-slate-900"}`}>
                    {user?.fullname}
                  </p>
                  <p className="text-[10px] text-slate-400 truncate">{user?.email}</p>
                </div>
              </div>

              {/* Fast Role Switcher */}
              <div>
                <span className={`text-[10px] font-bold uppercase tracking-wider block mb-1.5 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  Demo Role Switch:
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    onClick={() => {
                      handleDemoLogin("admin");
                      setShowProfileMenu(false);
                    }}
                    className={`py-1 px-2 rounded-xl text-[10px] font-bold transition-all text-center ${
                      isDark
                        ? "bg-purple-950/60 hover:bg-purple-900 text-purple-300 border border-purple-500/30"
                        : "bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200"
                    }`}
                  >
                    👑 Admin
                  </button>
                  <button
                    onClick={() => {
                      handleDemoLogin("manager");
                      setShowProfileMenu(false);
                    }}
                    className={`py-1 px-2 rounded-xl text-[10px] font-bold transition-all text-center ${
                      isDark
                        ? "bg-blue-950/60 hover:bg-blue-900 text-blue-300 border border-blue-500/30"
                        : "bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200"
                    }`}
                  >
                    👔 Lead
                  </button>
                  <button
                    onClick={() => {
                      handleDemoLogin("employee");
                      setShowProfileMenu(false);
                    }}
                    className={`py-1 px-2 rounded-xl text-[10px] font-bold transition-all text-center ${
                      isDark
                        ? "bg-emerald-950/60 hover:bg-emerald-900 text-emerald-300 border border-emerald-500/30"
                        : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200"
                    }`}
                  >
                    👨‍💻 Dev
                  </button>
                </div>
              </div>

              {/* Mobile Navigation Links */}
              <div className={`md:hidden pt-2 border-t space-y-1 ${isDark ? "border-white/10" : "border-slate-100"}`}>
                {navItems.map((n) => (
                  <Link
                    key={n.path}
                    to={n.path}
                    onClick={() => setShowProfileMenu(false)}
                    className={`block px-3 py-1.5 rounded-lg text-xs font-medium ${
                      isDark ? "text-slate-300 hover:text-white" : "text-slate-700 hover:text-slate-900"
                    }`}
                  >
                    {n.label}
                  </Link>
                ))}
              </div>

              <div className={`pt-2 border-t ${isDark ? "border-white/10" : "border-slate-100"}`}>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-2 py-1.5 rounded-xl text-xs font-bold text-rose-500 hover:bg-rose-500/10 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
