import React, { useState, useEffect } from "react";
import { useApp } from "../context/Appcontext";
import { getMyTasks } from "../services/api";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  ArrowRight,
  CheckSquare,
  Bug,
  HelpCircle,
  FileCheck2,
  RefreshCw,
  CheckCheck,
} from "lucide-react";

export default function MyWork() {
  const { user, setSelectedTaskKeyOrId, theme } = useApp();
  const isDark = theme === "dark";

  const [stats, setStats] = useState({});
  const [grouped, setGrouped] = useState({});
  const [loading, setLoading] = useState(true);

  const fetchWork = async () => {
    setLoading(true);
    const res = await getMyTasks();
    if (res.success) {
      setStats(res.stats || {});
      setGrouped(res.grouped || {});
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchWork();
  }, []);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  const renderTaskRow = (task, alertType = null) => {
    const typeIcon = {
      task: <CheckSquare className={`w-3.5 h-3.5 ${isDark ? "text-blue-400" : "text-blue-600"}`} />,
      bug: <Bug className={`w-3.5 h-3.5 ${isDark ? "text-rose-400" : "text-rose-600"}`} />,
      client_request: <HelpCircle className={`w-3.5 h-3.5 ${isDark ? "text-teal-400" : "text-teal-600"}`} />,
      approval: <FileCheck2 className={`w-3.5 h-3.5 ${isDark ? "text-indigo-400" : "text-indigo-600"}`} />,
    }[task.type || "task"];

    const priorityBadge = {
      urgent: isDark ? "bg-rose-500/15 text-rose-300 border-rose-500/30" : "bg-rose-50 text-rose-700 border-rose-200",
      high: isDark ? "bg-amber-500/15 text-amber-300 border-amber-500/30" : "bg-amber-50 text-amber-700 border-amber-200",
      medium: isDark ? "bg-indigo-500/15 text-indigo-300 border-indigo-500/30" : "bg-indigo-50 text-indigo-700 border-indigo-200",
      low: isDark ? "bg-slate-500/15 text-slate-300 border-slate-500/30" : "bg-slate-100 text-slate-700 border-slate-200",
    }[task.priority || "medium"];

    return (
      <div
        key={task._id}
        onClick={() => setSelectedTaskKeyOrId(task.key || task._id)}
        className={`flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer group ${
          isDark
            ? "bg-[#15161f] border-white/10 hover:border-indigo-500/40 hover:shadow-lg text-white"
            : "bg-white border-slate-200 hover:border-indigo-400 hover:shadow-md text-slate-900 shadow-xs"
        }`}
      >
        <div className="flex items-center gap-3.5 min-w-0">
          <div
            className={`shrink-0 p-2 rounded-xl transition-colors ${
              isDark ? "bg-white/5 group-hover:bg-indigo-500/15" : "bg-slate-100 group-hover:bg-indigo-50"
            }`}
          >
            {typeIcon}
          </div>
          <span
            className={`font-mono text-xs font-bold transition-colors shrink-0 ${
              isDark ? "text-slate-300 group-hover:text-indigo-400" : "text-slate-700 group-hover:text-indigo-600"
            }`}
          >
            {task.key}
          </span>
          <span className={`text-xs sm:text-sm font-semibold truncate ${isDark ? "text-white" : "text-slate-900"}`}>
            {task.title}
          </span>
        </div>

        <div className="flex items-center gap-3 shrink-0 ml-4">
          <span
            className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border uppercase tracking-wider ${priorityBadge}`}
          >
            {task.priority}
          </span>

          <span
            className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
              {
                todo: isDark ? "bg-slate-500/15 text-slate-300" : "bg-slate-100 text-slate-700",
                in_progress: isDark ? "bg-blue-500/15 text-blue-300" : "bg-blue-50 text-blue-700",
                review: isDark ? "bg-purple-500/15 text-purple-300" : "bg-purple-50 text-purple-700",
                done: isDark ? "bg-emerald-500/15 text-emerald-300" : "bg-emerald-50 text-emerald-700",
              }[task.status]
            }`}
          >
            {task.status?.replace("_", " ")}
          </span>

          {task.dueDate && (
            <span
              className={`text-xs font-medium flex items-center gap-1.5 px-2.5 py-0.5 rounded-md border text-[11px] ${
                alertType === "overdue"
                  ? isDark
                    ? "bg-rose-500/15 text-rose-300 border-rose-500/30 font-bold"
                    : "bg-rose-50 text-rose-700 border-rose-200 font-bold"
                  : alertType === "today"
                  ? isDark
                    ? "bg-amber-500/15 text-amber-300 border-amber-500/30 font-bold"
                    : "bg-amber-50 text-amber-700 border-amber-200 font-bold"
                  : isDark
                  ? "bg-white/5 text-slate-400 border-white/5"
                  : "bg-slate-100 text-slate-500 border-slate-200"
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>
                {new Date(task.dueDate).toLocaleDateString([], {
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </span>
          )}

          <ArrowRight
            className={`w-4 h-4 group-hover:translate-x-1 transition-all ${
              isDark ? "text-slate-500 group-hover:text-indigo-400" : "text-slate-400 group-hover:text-indigo-600"
            }`}
          />
        </div>
      </div>
    );
  };

  return (
    <div
      className={`flex-1 w-full h-full min-h-0 overflow-y-auto p-5 sm:p-7 space-y-6 transition-colors duration-150 ${
        isDark ? "bg-[#0c0d12]" : "bg-slate-50"
      }`}
    >
      {/* Header Banner */}
      <div
        className={`flex flex-wrap items-center justify-between gap-4 pb-4 border-b ${
          isDark ? "border-white/10" : "border-slate-200"
        }`}
      >
        <div>
          <h1
            className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${
              isDark ? "text-white" : "text-slate-900"
            }`}
          >
            {getGreeting()}, {user?.fullname} 👋
          </h1>
          <p className={`text-xs sm:text-sm mt-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
            Your assigned tasks, upcoming deadlines, and deliverables.
          </p>
        </div>

        <button
          onClick={fetchWork}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-full border text-xs font-semibold transition-all cursor-pointer ${
            isDark
              ? "bg-white/5 hover:bg-white/10 border-white/10 text-slate-300 hover:text-white"
              : "bg-white hover:bg-slate-100 border-slate-200 text-slate-700 shadow-xs"
          }`}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-indigo-400" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <div
          className={`p-4 rounded-2xl border ${
            isDark ? "bg-[#15161f] border-white/10 shadow-sm" : "bg-white border-slate-200 shadow-xs"
          }`}
        >
          <span className={`text-[11px] font-bold uppercase tracking-wider block mb-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
            Assigned
          </span>
          <span className={`text-2xl font-black ${isDark ? "text-white" : "text-slate-900"}`}>
            {stats.total || 0}
          </span>
        </div>

        <div
          className={`p-4 rounded-2xl border ${
            isDark ? "bg-[#15161f] border-blue-500/20 shadow-sm" : "bg-white border-blue-200 shadow-xs"
          }`}
        >
          <span className="text-[11px] font-bold text-blue-500 uppercase tracking-wider block mb-1">
            In Progress
          </span>
          <span className="text-2xl font-black text-blue-500">
            {stats.inProgress || 0}
          </span>
        </div>

        <div
          className={`p-4 rounded-2xl border ${
            isDark ? "bg-[#15161f] border-indigo-500/20 shadow-sm" : "bg-white border-indigo-200 shadow-xs"
          }`}
        >
          <span className="text-[11px] font-bold text-indigo-500 uppercase tracking-wider block mb-1">
            In Review
          </span>
          <span className="text-2xl font-black text-indigo-500">
            {stats.review || 0}
          </span>
        </div>

        <div
          className={`p-4 rounded-2xl border ${
            isDark ? "bg-[#15161f] border-emerald-500/20 shadow-sm" : "bg-white border-emerald-200 shadow-xs"
          }`}
        >
          <span className="text-[11px] font-bold text-emerald-500 uppercase tracking-wider block mb-1">
            Completed
          </span>
          <span className="text-2xl font-black text-emerald-500">
            {stats.done || 0}
          </span>
        </div>

        <div
          className={`p-4 rounded-2xl border ${
            isDark ? "bg-[#15161f] border-rose-500/30 shadow-sm" : "bg-white border-rose-200 shadow-xs"
          }`}
        >
          <span className="text-[11px] font-bold text-rose-500 uppercase tracking-wider block mb-1">
            Overdue
          </span>
          <span className="text-2xl font-black text-rose-500">
            {stats.overdueCount || 0}
          </span>
        </div>

        <div
          className={`p-4 rounded-2xl border ${
            isDark ? "bg-[#15161f] border-amber-500/30 shadow-sm" : "bg-white border-amber-200 shadow-xs"
          }`}
        >
          <span className="text-[11px] font-bold text-amber-500 uppercase tracking-wider block mb-1">
            Due Today
          </span>
          <span className="text-2xl font-black text-amber-500">
            {stats.dueTodayCount || 0}
          </span>
        </div>
      </div>

      {/* Task Queues */}
      {loading ? (
        <div className="h-64 flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-500 font-medium">Loading your tasks...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Overdue */}
          {grouped.overdue?.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-rose-500 font-bold text-sm">
                <AlertCircle className="w-4 h-4" />
                <span>Overdue ({grouped.overdue.length}) — Action Needed</span>
              </div>
              <div className="space-y-2.5">
                {grouped.overdue.map((t) => renderTaskRow(t, "overdue"))}
              </div>
            </div>
          )}

          {/* Due Today */}
          {grouped.dueToday?.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-amber-500 font-bold text-sm">
                <Calendar className="w-4 h-4" />
                <span>Due Today ({grouped.dueToday.length})</span>
              </div>
              <div className="space-y-2.5">
                {grouped.dueToday.map((t) => renderTaskRow(t, "today"))}
              </div>
            </div>
          )}

          {/* Upcoming & In Progress */}
          <div className="space-y-3">
            <div className={`flex items-center gap-2 font-bold text-sm ${isDark ? "text-white" : "text-slate-900"}`}>
              <Clock className="w-4 h-4 text-indigo-500" />
              <span>Upcoming & In Progress ({grouped.upcoming?.length || 0})</span>
            </div>
            {grouped.upcoming?.length > 0 ? (
              <div className="space-y-2.5">
                {grouped.upcoming.map((t) => renderTaskRow(t))}
              </div>
            ) : (
              <div
                className={`p-8 rounded-2xl border text-center ${
                  isDark ? "bg-[#15161f] border-white/10" : "bg-white border-slate-200 shadow-xs"
                }`}
              >
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                <p className={`text-sm font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
                  You're all caught up!
                </p>
                <p className={`text-xs mt-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  No pending tasks assigned to you right now.
                </p>
              </div>
            )}
          </div>

          {/* Recently Finished */}
          {grouped.completedRecently?.length > 0 && (
            <div className={`space-y-3 pt-4 border-t ${isDark ? "border-white/10" : "border-slate-200"}`}>
              <div className="flex items-center gap-2 text-emerald-500 font-bold text-sm">
                <CheckCheck className="w-4 h-4" />
                <span>Recently Finished ({grouped.completedRecently.length})</span>
              </div>
              <div className="space-y-2.5 opacity-80">
                {grouped.completedRecently.map((t) => renderTaskRow(t))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
