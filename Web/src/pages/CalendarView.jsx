import React, { useState, useEffect, useMemo } from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  RotateCcw,
  Shield,
  CheckCircle2,
  AlertCircle,
  Plus,
} from "lucide-react";
import { useApp } from "../context/Appcontext";
import { getTasks } from "../services/api";
import TaskDrawer from "../components/task/TaskDrawer";

export default function CalendarView() {
  const { activeProject } = useApp();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTaskKey, setActiveTaskKey] = useState(null);
  const [isTaskDrawerOpen, setIsTaskDrawerOpen] = useState(false);

  const loadTasks = async () => {
    setLoading(true);
    const filters = activeProject ? { project: activeProject._id } : {};
    const res = await getTasks(filters);
    if (res.success) {
      setTasks(res.tasks);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadTasks();
  }, [activeProject]);

  // Calendar calculations
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay();

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  // Map tasks to dates
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

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950 text-slate-200">
      {/* Top Header */}
      <div className="p-4 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <CalendarIcon className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-tight">
              Operational Schedule & Clock Deadlines
            </h1>
            <p className="text-xs text-slate-400">
              Compliance dates, recurring office routines, and strict time limits
            </p>
          </div>
        </div>

        {/* Month Navigation */}
        <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 p-1 rounded-xl">
          <button
            onClick={prevMonth}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-bold text-white px-3 font-mono">
            {monthNames[month]} {year}
          </span>
          <button
            onClick={nextMonth}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Weekday Labels */}
      <div className="grid grid-cols-7 border-b border-slate-800 bg-slate-900/40 text-center py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
        <span>Sun</span>
        <span>Mon</span>
        <span>Tue</span>
        <span>Wed</span>
        <span>Thu</span>
        <span>Fri</span>
        <span>Sat</span>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 grid grid-cols-7 grid-rows-5 overflow-y-auto divide-x divide-y divide-slate-800/60 bg-slate-950">
        {/* Blank days before month start */}
        {Array.from({ length: firstDayIndex }).map((_, i) => (
          <div key={`empty-${i}`} className="bg-slate-950/40 p-2 min-h-[90px]" />
        ))}

        {/* Days of Month */}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const dayTasks = tasksByDay[day] || [];
          const isToday =
            day === new Date().getDate() &&
            month === new Date().getMonth() &&
            year === new Date().getFullYear();

          return (
            <div
              key={`day-${day}`}
              className={`p-2 min-h-[100px] flex flex-col justify-between hover:bg-slate-900/40 transition-colors ${
                isToday ? "bg-blue-500/5 ring-1 ring-inset ring-blue-500/30" : ""
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span
                  className={`text-xs font-bold font-mono px-1.5 py-0.5 rounded ${
                    isToday ? "bg-blue-600 text-white shadow-sm" : "text-slate-400"
                  }`}
                >
                  {day}
                </span>
                {dayTasks.length > 0 && (
                  <span className="text-[9px] text-slate-500 font-mono">
                    {dayTasks.length} due
                  </span>
                )}
              </div>

              {/* Tasks List in this Day */}
              <div className="space-y-1 flex-1 overflow-y-auto no-scrollbar">
                {dayTasks.slice(0, 3).map((t) => (
                  <div
                    key={t._id}
                    onClick={() => {
                      setActiveTaskKey(t.key);
                      setIsTaskDrawerOpen(true);
                    }}
                    className={`p-1.5 rounded-lg border text-[10px] cursor-pointer hover:scale-[1.02] transition-transform truncate ${
                      t.status === "done"
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                        : t.status === "submitted_for_review"
                        ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                        : "bg-slate-900 border-slate-800 text-slate-200"
                    }`}
                  >
                    <div className="flex items-center gap-1 font-semibold truncate">
                      {t.dueTime && (
                        <span className="text-[9px] text-blue-400 font-mono">
                          {t.dueTime}
                        </span>
                      )}
                      <span className="truncate">{t.title}</span>
                    </div>
                  </div>
                ))}
                {dayTasks.length > 3 && (
                  <span className="text-[9px] text-slate-500 block text-center font-mono">
                    +{dayTasks.length - 3} more
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Task Details Drawer */}
      <TaskDrawer
        taskKey={activeTaskKey}
        isOpen={isTaskDrawerOpen}
        onClose={() => {
          setIsTaskDrawerOpen(false);
          setActiveTaskKey(null);
        }}
        onTaskUpdated={loadTasks}
      />
    </div>
  );
}
