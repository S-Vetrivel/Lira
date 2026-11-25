import React, { useState, useEffect, useMemo } from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Plus,
} from "lucide-react";
import { useApp } from "../context/Appcontext";
import { getTasks } from "../services/api";
import TaskDrawer from "../components/task/TaskDrawer";

export default function CalendarView() {
  const { activeProject, theme, setIsCreateTaskModalOpen } = useApp();
  const isDark = theme === "dark";

  const [currentDate, setCurrentDate] = useState(new Date());
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTaskKey, setActiveTaskKey] = useState(null);

  const loadTasks = async () => {
    setLoading(true);
    const filters = activeProject ? { projectId: activeProject._id } : {};
    const res = await getTasks(filters);
    if (res.success) {
      setTasks(res.tasks);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadTasks();
  }, [activeProject?._id]);

  // Calendar calculations
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay(); // 0=Sun .. 6=Sat

  const totalCells = firstDayIndex + daysInMonth;
  const trailingBlankCells = (7 - (totalCells % 7)) % 7;

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToToday = () => setCurrentDate(new Date());

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  // Map tasks to dates in current month/year
  const tasksByDay = useMemo(() => {
    const map = {};
    tasks.forEach((task) => {
      if (!task.dueDate) return;
      const d = new Date(task.dueDate);
      if (d.getFullYear() === year && d.getMonth() === month) {
        const dayNum = d.getDate();
        if (!map[dayNum]) map[dayNum] = [];
        map[dayNum].push(task);
      }
    });
    return map;
  }, [tasks, year, month]);

  const now = new Date();

  return (
    <div
      className={`flex-1 w-full h-full min-h-0 flex flex-col overflow-hidden transition-colors duration-150 ${
        isDark ? "bg-[#0c0d12] text-slate-200" : "bg-slate-50 text-slate-800"
      }`}
    >
      {/* Top Sub-Header */}
      <div
        className={`px-6 py-3.5 border-b flex flex-wrap items-center justify-between gap-3 shrink-0 ${
          isDark ? "bg-[#0e0f16] border-white/10 text-white" : "bg-white border-slate-200 text-slate-900"
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-9 h-9 rounded-xl border flex items-center justify-center ${
              isDark
                ? "bg-indigo-500/15 border-indigo-500/30 text-indigo-400"
                : "bg-indigo-50 border-indigo-200 text-indigo-600"
            }`}
          >
            <CalendarIcon className="w-4 h-4" />
          </div>
          <div>
            <h1 className={`text-sm sm:text-base font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
              Operational Schedule & Deadlines
            </h1>
            <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              {activeProject ? `[${activeProject.prefix}] ${activeProject.name}` : "All Workspaces"} • Scheduled tasks & upcoming deadlines
            </p>
          </div>
        </div>

        {/* Month Navigation + Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={loadTasks}
            className={`p-2 rounded-full border transition-colors cursor-pointer ${
              isDark
                ? "bg-white/5 hover:bg-white/10 border-white/10 text-slate-300"
                : "bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700"
            }`}
            title="Refresh Calendar"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-indigo-400" : ""}`} />
          </button>

          <button
            onClick={goToToday}
            className={`px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors cursor-pointer ${
              isDark
                ? "bg-white/5 hover:bg-white/10 border-white/10 text-slate-200"
                : "bg-white hover:bg-slate-100 border-slate-200 text-slate-700"
            }`}
          >
            Today
          </button>

          <div
            className={`flex items-center gap-1 border p-1 rounded-full ${
              isDark ? "bg-[#181924] border-white/10" : "bg-slate-100 border-slate-200"
            }`}
          >
            <button
              onClick={prevMonth}
              className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                isDark ? "text-slate-400 hover:text-white hover:bg-white/10" : "text-slate-600 hover:text-slate-900 hover:bg-white"
              }`}
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className={`text-xs font-bold px-3 font-mono min-w-[125px] text-center ${isDark ? "text-white" : "text-slate-900"}`}>
              {monthNames[month]} {year}
            </span>
            <button
              onClick={nextMonth}
              className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                isDark ? "text-slate-400 hover:text-white hover:bg-white/10" : "text-slate-600 hover:text-slate-900 hover:bg-white"
              }`}
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => setIsCreateTaskModalOpen(true)}
            className={`px-3.5 py-2 rounded-full font-semibold text-xs flex items-center gap-1.5 cursor-pointer transition-colors ${
              isDark ? "bg-white text-slate-950 hover:bg-slate-200" : "bg-slate-900 text-white hover:bg-slate-800"
            }`}
          >
            <Plus className="w-3.5 h-3.5" /> Add Task
          </button>
        </div>
      </div>

      {/* Calendar Wrapper (Scrolls cleanly if viewport is narrow, fits 7 cols properly) */}
      <div className="flex-1 min-h-0 flex flex-col overflow-auto">
        <div className="min-w-[720px] flex-1 flex flex-col">
          {/* Weekday Labels */}
          <div
            className={`grid grid-cols-7 border-b text-center py-2 text-[10px] font-bold uppercase tracking-wider shrink-0 ${
              isDark
                ? "bg-[#12131a] border-white/10 text-slate-400"
                : "bg-slate-100 border-slate-200 text-slate-600"
            }`}
          >
            <span>Sun</span>
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span>Thu</span>
            <span>Fri</span>
            <span>Sat</span>
          </div>

          {/* Calendar Grid */}
          <div
            className={`flex-1 grid grid-cols-7 auto-rows-fr border-l ${
              isDark ? "border-white/5 bg-[#0c0d12]" : "border-slate-200 bg-white"
            }`}
          >
            {/* Blank days before month start */}
            {Array.from({ length: firstDayIndex }).map((_, i) => (
              <div
                key={`empty-start-${i}`}
                className={`p-2 min-h-[100px] border-r border-b ${
                  isDark ? "bg-[#0a0b10] border-white/5" : "bg-slate-50/70 border-slate-200"
                }`}
              />
            ))}

            {/* Days of Month */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dayTasks = tasksByDay[day] || [];
              const isToday =
                day === now.getDate() &&
                month === now.getMonth() &&
                year === now.getFullYear();

              return (
                <div
                  key={`day-${day}`}
                  className={`p-2 min-h-[100px] border-r border-b flex flex-col justify-between transition-colors ${
                    isDark ? "border-white/10" : "border-slate-200"
                  } ${
                    isToday
                      ? isDark
                        ? "bg-indigo-500/10 ring-1 ring-inset ring-indigo-500/40"
                        : "bg-indigo-50/70 ring-1 ring-inset ring-indigo-400"
                      : isDark
                      ? "hover:bg-white/[0.02]"
                      : "hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-xs font-bold font-mono px-1.5 py-0.5 rounded-md ${
                        isToday
                          ? "bg-indigo-600 text-white shadow-sm"
                          : isDark
                          ? "text-slate-400"
                          : "text-slate-600"
                      }`}
                    >
                      {day}
                    </span>
                    {dayTasks.length > 0 && (
                      <span className="text-[9px] text-slate-400 font-mono">
                        {dayTasks.length} due
                      </span>
                    )}
                  </div>

                  {/* Tasks List in this Day */}
                  <div className="space-y-1 flex-1 overflow-y-auto">
                    {dayTasks.slice(0, 3).map((t) => (
                      <button
                        key={t._id}
                        type="button"
                        onClick={() => setActiveTaskKey(t.key || t._id)}
                        className={`w-full text-left p-1.5 rounded-lg border text-[10px] cursor-pointer hover:scale-[1.01] transition-transform truncate block ${
                          t.status === "done"
                            ? isDark
                              ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
                              : "bg-emerald-50 border-emerald-200 text-emerald-800"
                            : t.status === "submitted_for_review" || t.status === "review"
                            ? isDark
                              ? "bg-amber-500/15 border-amber-500/30 text-amber-300"
                              : "bg-amber-50 border-amber-200 text-amber-800"
                            : isDark
                            ? "bg-[#181924] border-white/10 text-slate-200 hover:border-indigo-500/40"
                            : "bg-slate-100 border-slate-200 text-slate-800 hover:border-indigo-300"
                        }`}
                      >
                        <div className="flex items-center gap-1 font-semibold truncate">
                          <span className="text-[9px] text-indigo-400 font-mono shrink-0">
                            {t.key}
                          </span>
                          <span className="truncate">{t.title}</span>
                        </div>
                      </button>
                    ))}
                    {dayTasks.length > 3 && (
                      <span className="text-[9px] text-slate-400 block text-center font-mono">
                        +{dayTasks.length - 3} more
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Trailing blank cells */}
            {Array.from({ length: trailingBlankCells }).map((_, i) => (
              <div
                key={`empty-end-${i}`}
                className={`p-2 min-h-[100px] border-r border-b ${
                  isDark ? "bg-[#0a0b10] border-white/5" : "bg-slate-50/70 border-slate-200"
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Task Details Drawer */}
      {activeTaskKey && (
        <TaskDrawer
          taskKeyOrId={activeTaskKey}
          onClose={() => setActiveTaskKey(null)}
          onTaskUpdated={loadTasks}
        />
      )}
    </div>
  );
}
