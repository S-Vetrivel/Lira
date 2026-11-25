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
import { formatDateIN } from "../utils/formatters";
import { getGlassTokens } from "../styles/glassTheme";

export default function MyWork() {
  const { user, setSelectedTaskKeyOrId, theme } = useApp();
  const isDark = theme === "dark";
  const g = getGlassTokens(isDark);

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
      task: <CheckSquare className={`w-3.5 h-3.5 ${g.accentIcon}`} />,
      bug: <Bug className={`w-3.5 h-3.5 ${isDark ? "text-rose-400" : "text-rose-600"}`} />,
      client_request: <HelpCircle className={`w-3.5 h-3.5 ${isDark ? "text-teal-400" : "text-teal-600"}`} />,
      approval: <FileCheck2 className={`w-3.5 h-3.5 ${isDark ? "text-amber-400" : "text-amber-600"}`} />,
    }[task.type || "task"];

    const priorityBadge = {
      urgent: isDark ? "bg-rose-500/15 text-rose-300 border-rose-500/30" : "bg-rose-50 text-rose-700 border-rose-200",
      high: isDark ? "bg-amber-500/15 text-amber-300 border-amber-500/30" : "bg-amber-50 text-amber-700 border-amber-200",
      medium: g.badge,
      low: isDark ? "bg-white/[0.04] text-zinc-400 border-white/[0.08]" : "bg-slate-100 text-slate-600 border-slate-200",
    }[task.priority || "medium"];

    return (
      <div
        key={task._id}
        onClick={() => setSelectedTaskKeyOrId(task.key || task._id)}
        className={`flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer group ${g.card} ${g.rowHover}`}
      >
        <div className="flex items-center gap-3.5 min-w-0">
          <div className={`shrink-0 p-2 rounded-xl border ${g.badge}`}>
            {typeIcon}
          </div>
          <span className={`font-mono text-xs font-bold shrink-0 ${g.heading}`}>
            {task.key}
          </span>
          <span className={`text-xs sm:text-sm font-semibold truncate ${g.heading}`}>
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
            className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
              {
                todo: g.badge,
                in_progress: isDark ? "bg-zinc-200/15 text-zinc-100 border-zinc-400/25" : "bg-zinc-900/10 text-zinc-800 border-zinc-300",
                redo_requested: isDark ? "bg-rose-500/15 text-rose-300 border-rose-500/25" : "bg-rose-50 text-rose-700 border-rose-200",
                review: isDark ? "bg-amber-500/15 text-amber-300 border-amber-500/25" : "bg-amber-50 text-amber-700 border-amber-200",
                submitted_for_review: isDark ? "bg-amber-500/15 text-amber-300 border-amber-500/25" : "bg-amber-50 text-amber-700 border-amber-200",
                done: isDark ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/25" : "bg-emerald-50 text-emerald-700 border-emerald-200",
              }[task.status] || g.badge
            }`}
          >
            {task.status?.replace("_", " ")}
          </span>

          {task.dueDate && (
            <span
              className={`font-medium flex items-center gap-1.5 px-2.5 py-0.5 rounded-md border text-[11px] ${
                alertType === "overdue"
                  ? isDark
                    ? "bg-rose-500/15 text-rose-300 border-rose-500/30 font-bold"
                    : "bg-rose-50 text-rose-700 border-rose-200 font-bold"
                  : alertType === "today"
                  ? isDark
                    ? "bg-amber-500/15 text-amber-300 border-amber-500/30 font-bold"
                    : "bg-amber-50 text-amber-700 border-amber-200 font-bold"
                  : g.badge
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>
                {formatDateIN(task.dueDate, {
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </span>
          )}

          <ArrowRight className={`w-4 h-4 group-hover:translate-x-1 transition-all ${g.muted}`} />
        </div>
      </div>
    );
  };

  return (
    <div
      className={`flex-1 w-full h-full min-h-0 overflow-y-auto p-5 sm:p-7 space-y-6 transition-colors duration-150 ${g.heading}`}
    >
      {/* Header Banner */}
      <div className={`flex flex-wrap items-center justify-between gap-4 pb-4 border-b ${g.border}`}>
        <div>
          <h1 className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${g.heading}`}>
            {getGreeting()}, {user?.fullname}
          </h1>
          <p className={`text-xs sm:text-sm mt-1 ${g.muted}`}>
            Your assigned tasks, upcoming deadlines, and deliverables.
          </p>
        </div>

        <button
          onClick={fetchWork}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-full border text-xs font-semibold transition-all cursor-pointer ${g.btnSecondary}`}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <div className="p-4 rounded-2xl lira-glass">
          <span className={`text-[11px] font-bold uppercase tracking-wider block mb-1 ${g.muted}`}>
            Assigned
          </span>
          <span className={`text-2xl font-display font-bold tabular-nums ${g.heading}`}>
            {stats.total || 0}
          </span>
        </div>

        <div className="p-4 rounded-2xl lira-glass-glow">
          <span className={`text-[11px] font-bold uppercase tracking-wider block mb-1 ${g.muted}`}>
            In Progress
          </span>
          <span className={`text-2xl font-display font-bold tabular-nums ${g.heading}`}>
            {stats.inProgress || 0}
          </span>
        </div>

        <div className="p-4 rounded-2xl lira-glass">
          <span className={`text-[11px] font-bold uppercase tracking-wider block mb-1 ${g.muted}`}>
            In Review
          </span>
          <span className={`text-2xl font-display font-bold tabular-nums ${g.heading}`}>
            {stats.review || 0}
          </span>
        </div>

        <div className="p-4 rounded-2xl lira-glass">
          <span className="text-[11px] font-bold text-emerald-500 uppercase tracking-wider block mb-1">
            Completed
          </span>
          <span className="text-2xl font-display font-bold tabular-nums text-emerald-500">
            {stats.done || 0}
          </span>
        </div>

        <div className="p-4 rounded-2xl lira-glass">
          <span className="text-[11px] font-bold text-rose-500 uppercase tracking-wider block mb-1">
            Overdue
          </span>
          <span className="text-2xl font-display font-bold tabular-nums text-rose-500">
            {stats.overdueCount || 0}
          </span>
        </div>

        <div className="p-4 rounded-2xl lira-glass">
          <span className="text-[11px] font-bold text-amber-500 uppercase tracking-wider block mb-1">
            Due Today
          </span>
          <span className="text-2xl font-display font-bold tabular-nums text-amber-500">
            {stats.dueTodayCount || 0}
          </span>
        </div>
      </div>

      {/* Task Queues */}
      {loading ? (
        <div className="h-64 flex flex-col items-center justify-center gap-3">
          <div className={`w-8 h-8 border-2 border-t-transparent rounded-full animate-spin ${isDark ? "border-zinc-300" : "border-zinc-700"}`} />
          <p className={`text-xs font-medium ${g.muted}`}>Loading your tasks...</p>
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
            <div className={`flex items-center gap-2 font-bold text-sm ${g.heading}`}>
              <Clock className={`w-4 h-4 ${g.accentIcon}`} />
              <span>Upcoming & In Progress ({grouped.upcoming?.length || 0})</span>
            </div>
            {grouped.upcoming?.length > 0 ? (
              <div className="space-y-2.5">
                {grouped.upcoming.map((t) => renderTaskRow(t))}
              </div>
            ) : (
              <div className="p-8 rounded-2xl lira-glass text-center">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                <p className={`text-sm font-bold ${g.heading}`}>
                  You're all caught up!
                </p>
                <p className={`text-xs mt-1 ${g.muted}`}>
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
