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

export default function TaskCard({ task, onClick, onDragStart }) {
  const { theme } = useApp();
  const isDark = theme === "dark";

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
      bg: isDark ? "bg-purple-500/15 text-purple-300 border-purple-500/30" : "bg-purple-50 text-purple-700 border-purple-200",
      dot: "bg-purple-500",
      label: "Medium",
    },
    low: {
      bg: isDark ? "bg-slate-500/15 text-slate-300 border-slate-500/30" : "bg-slate-100 text-slate-700 border-slate-200",
      dot: "bg-slate-400",
      label: "Low",
    },
  }[task.priority || "medium"];

  const typeConfig = {
    task: { icon: CheckSquare, color: isDark ? "text-blue-400" : "text-blue-600", label: "Task" },
    bug: { icon: Bug, color: isDark ? "text-rose-400" : "text-rose-600", label: "Bug" },
    client_request: { icon: HelpCircle, color: isDark ? "text-teal-400" : "text-teal-600", label: "Request" },
    approval: { icon: FileCheck2, color: isDark ? "text-purple-400" : "text-purple-600", label: "Approval" },
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
      className={`rounded-2xl p-4 border transition-all duration-150 cursor-grab active:cursor-grabbing select-none space-y-3 group ${
        isDark
          ? "bg-[#191a24] border-white/10 hover:border-purple-500/40 hover:shadow-xl hover:-translate-y-0.5 text-white shadow-sm"
          : "bg-white border-slate-200/90 hover:border-indigo-400 hover:shadow-lg hover:-translate-y-0.5 text-slate-900 shadow-xs"
      }`}
    >
      {/* Top row: Key + Priority badge */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <TypeIcon className={`w-3.5 h-3.5 ${typeConfig.color} shrink-0`} />
          <span
            className={`font-mono text-xs font-bold transition-colors ${
              isDark
                ? "text-slate-200 group-hover:text-purple-400"
                : "text-slate-700 group-hover:text-indigo-600"
            }`}
          >
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
        className={`text-xs sm:text-sm font-bold leading-snug line-clamp-2 ${
          isDark ? "text-white" : "text-slate-900"
        }`}
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
          <div className="flex items-center justify-between text-[10px] text-slate-400">
            <span className="flex items-center gap-1">
              <ListTodo className={`w-3 h-3 ${isDark ? "text-purple-400" : "text-indigo-600"}`} />
              <span className={isDark ? "text-slate-400" : "text-slate-600"}>Subtasks</span>
            </span>
            <span className={`font-mono font-semibold ${isDark ? "text-slate-300" : "text-slate-700"}`}>
              {completedSubtasks}/{totalSubtasks}
            </span>
          </div>
          <div className={`w-full rounded-full h-1 overflow-hidden ${isDark ? "bg-white/10" : "bg-slate-200"}`}>
            <div
              className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full rounded-full transition-all"
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

        {/* Assignee Avatar */}
        <div className="flex items-center">
          {task.assignee ? (
            <UserAvatar
              user={task.assignee}
              className={`w-5 h-5 rounded-full border ${
                isDark ? "border-white/20" : "border-slate-300"
              }`}
              textClass="text-[9px]"
            />
          ) : (
            <span
              className={`text-[10px] italic px-1.5 py-0.5 rounded ${
                isDark ? "text-slate-500 bg-white/5" : "text-slate-400 bg-slate-100"
              }`}
            >
              Unassigned
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
