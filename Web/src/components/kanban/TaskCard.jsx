import React from "react";
import { useApp } from "../../context/Appcontext";
import {
  CheckSquare,
  Bug,
  FileCheck2,
  HelpCircle,
  Clock,
  Calendar,
  AlertCircle,
  ListTodo,
} from "lucide-react";
import { formatDateIN, getDisplayName } from "../../utils/formatters";
import UserAvatar from "../common/UserAvatar";
import { getGlassTokens } from "../../styles/glassTheme";

export default function TaskCard({ task, onClick, onDragStart }) {
  const { theme } = useApp();
  const isDark = theme === "dark";
  const g = getGlassTokens(isDark);

  const priorityConfig = {
    urgent: {
      bg: isDark ? "bg-rose-500/15 text-rose-300 border-rose-500/30" : "bg-rose-50 text-rose-700 border-rose-200",
      dot: "bg-rose-500",
      label: "Urgent",
    },
    high: {
      bg: isDark ? "bg-amber-500/15 text-amber-300 border-amber-500/30" : "bg-amber-50 text-amber-700 border-amber-200",
      dot: "bg-amber-500",
      label: "High",
    },
    medium: {
      bg: g.badge,
      dot: isDark ? "bg-zinc-300" : "bg-zinc-600",
      label: "Medium",
    },
    low: {
      bg: isDark ? "bg-white/[0.04] text-zinc-400 border-white/[0.08]" : "bg-slate-100 text-slate-600 border-slate-200",
      dot: "bg-zinc-400",
      label: "Low",
    },
  }[task.priority || "medium"];

  const typeConfig = {
    task: { icon: CheckSquare, color: g.accentIcon, label: "Task" },
    bug: { icon: Bug, color: isDark ? "text-rose-400" : "text-rose-600", label: "Bug" },
    client_request: { icon: HelpCircle, color: isDark ? "text-teal-400" : "text-teal-600", label: "Request" },
    approval: { icon: FileCheck2, color: isDark ? "text-amber-400" : "text-amber-600", label: "Approval" },
  }[task.type || "task"];

  const TypeIcon = typeConfig.icon;

  const totalSubtasks = task.subtasks?.length || 0;
  const completedSubtasks = task.subtasks?.filter((s) => s.completed).length || 0;

  // Due date status
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  let dueDateStatus = "normal";
  if (task.dueDate && task.status !== "done") {
    const due = new Date(task.dueDate);
    if (due < startOfToday) dueDateStatus = "overdue";
    else if (due >= startOfToday && due <= endOfToday) dueDateStatus = "today";
  }

  const dueDateClass = {
    overdue: isDark
      ? "text-rose-400 bg-rose-500/10 border-rose-500/20 font-bold"
      : "text-rose-700 bg-rose-50 border-rose-200 font-bold",
    today: isDark
      ? "text-amber-400 bg-amber-500/10 border-amber-500/20 font-bold"
      : "text-amber-700 bg-amber-50 border-amber-200 font-bold",
    normal: isDark
      ? "text-slate-400 bg-white/5 border-white/5"
      : "text-slate-500 bg-slate-100 border-slate-200",
  }[dueDateStatus];

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, task)}
      onClick={() => onClick(task)}
      className={`rounded-2xl p-4 lira-glass-glow transition-all duration-150 cursor-grab active:cursor-grabbing select-none space-y-3 group hover:-translate-y-0.5 ${
        isDark ? "text-white" : "text-slate-900"
      }`}
    >
      {/* Top row: Key + Priority badge */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <TypeIcon className={`w-3.5 h-3.5 ${typeConfig.color} shrink-0`} />
          <span className={`font-mono text-xs font-bold transition-colors ${g.heading}`}>
            {task.key}
          </span>
        </div>

        <span
          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${priorityConfig.bg}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${priorityConfig.dot}`} />
          <span>{priorityConfig.label}</span>
        </span>
      </div>

      {/* Task Title */}
      <h4
        className={`text-xs sm:text-sm font-bold leading-snug line-clamp-2 ${g.heading}`}
      >
        {task.title}
      </h4>

      {(task.status === "submitted_for_review" || task.status === "redo_requested") && (
        <span
          className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border ${
            task.status === "redo_requested"
              ? "bg-rose-500/15 text-rose-400 border-rose-500/30"
              : "bg-amber-500/15 text-amber-400 border-amber-500/30"
          }`}
        >
          {task.status === "redo_requested" ? "Revision Requested" : "Awaiting Sign-Off"}
        </span>
      )}

      {/* Subtasks Progress */}
      {totalSubtasks > 0 && (
        <div className="space-y-1 pt-1">
          <div className={`flex items-center justify-between text-[10px] ${g.muted}`}>
            <span className="flex items-center gap-1">
              <ListTodo className={`w-3 h-3 ${g.accentIcon}`} />
              <span>Subtasks</span>
            </span>
            <span className={`font-mono font-semibold ${g.heading}`}>
              {completedSubtasks}/{totalSubtasks}
            </span>
          </div>
          <div className={`w-full rounded-full h-1 overflow-hidden ${g.progressTrack}`}>
            <div
              className={`h-full rounded-full transition-all ${g.progressFill}`}
              style={{ width: `${(completedSubtasks / totalSubtasks) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Footer: Due date + Logged hours + Assignee */}
      <div
        className={`flex items-center justify-between pt-2 border-t text-[11px] ${
          isDark ? "border-white/5" : "border-slate-100"
        }`}
      >
        <div className="flex items-center gap-2">
          {task.dueDate && (
            <span className={`flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] ${dueDateClass}`}>
              <Calendar className="w-3 h-3" />
              <span>
                {formatDateIN(task.dueDate, {
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </span>
          )}

          {(task.loggedHours > 0 || task.estimatedHours > 0) && (
            <span className={`flex items-center gap-1 text-[10px] font-medium ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              <Clock className="w-3 h-3 text-slate-400" />
              <span>
                {task.loggedHours || 0}h
                {task.estimatedHours > 0 ? ` / ${task.estimatedHours}h` : ""}
              </span>
            </span>
          )}
        </div>

        {/* Assignee Group & Team Badges */}
        <div className="flex items-center gap-1.5">
          {Array.isArray(task.assignedDepartments) && task.assignedDepartments.length > 0 && (
            <span className="px-1.5 py-0.2 rounded bg-indigo-500/15 border border-indigo-500/30 text-[9px] font-mono font-bold text-indigo-300">
              {task.assignedDepartments[0].code || task.assignedDepartments[0].name}
              {task.assignedDepartments.length > 1 ? ` +${task.assignedDepartments.length - 1}` : ""}
            </span>
          )}
          {(() => {
            const list =
              Array.isArray(task.assignees) && task.assignees.length > 0
                ? task.assignees
                : task.assignee
                  ? [task.assignee]
                  : [];
            if (list.length > 0) {
              return (
                <div className="flex items-center -space-x-1.5">
                  {list.slice(0, 3).map((u) => (
                    <UserAvatar
                      key={u._id || u}
                      user={u}
                      className={`w-5 h-5 rounded-full border ${
                        isDark ? "border-white/20" : "border-slate-300"
                      }`}
                      textClass="text-[9px]"
                    />
                  ))}
                  {list.length > 3 && (
                    <span className="pl-2 text-[9px] font-mono opacity-75">+{list.length - 3}</span>
                  )}
                </div>
              );
            }
            if (!task.assignedDepartments?.length) {
              return (
                <span
                  className={`text-[10px] italic px-1.5 py-0.5 rounded ${
                    isDark ? "text-slate-500 bg-white/5" : "text-slate-400 bg-slate-100"
                  }`}
                >
                  Unassigned
                </span>
              );
            }
            return null;
          })()}
        </div>
      </div>
    </div>
  );
}
