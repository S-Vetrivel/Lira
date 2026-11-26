import React, { useState, useEffect, useMemo } from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Plus,
  Clock,
  Inbox,
  CheckCircle2,
  ArrowUpRight,
} from "lucide-react";
import { useApp } from "../context/Appcontext";
import { subscribeRealtimeEvents } from "../services/socket";
import { getTasks } from "../services/api";
import TaskDrawer from "../components/task/TaskDrawer";
import SideDrawer from "../components/common/SideDrawer";
import UserAvatar from "../components/common/UserAvatar";
import { getGlassTokens } from "../styles/glassTheme";
import { getDisplayName } from "../utils/formatters";

function extractLocalYMD(dateVal) {
  if (!dateVal) return null;
  const s = String(dateVal).trim();
  const isoPrefix = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoPrefix) {
    return { year: Number(isoPrefix[1]), month: Number(isoPrefix[2]) - 1, day: Number(isoPrefix[3]) };
  }
  const d = new Date(dateVal);
  if (Number.isNaN(d.getTime())) return null;
  return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() };
}

function toYMD(year, monthIndex, day) {
  const mm = String(monthIndex + 1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

export default function CalendarView() {
  const {
    activeProject,
    theme,
    setIsCreateTaskModalOpen,
    setAiPrefillDraft,
  } = useApp();
  const isDark = theme === "dark";
  const g = getGlassTokens(isDark);

  const [currentDate, setCurrentDate] = useState(new Date());
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTaskKey, setActiveTaskKey] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null); // day number in active month/year
  const [showUnscheduledDrawer, setShowUnscheduledDrawer] = useState(false);

  const loadTasks = async () => {
    setLoading(true);
    const filters = activeProject ? { projectId: activeProject._id } : {};
    const res = await getTasks(filters);
    if (res.success) {
      setTasks(res.tasks || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadTasks();
    return subscribeRealtimeEvents(
      ["task:created", "task:created_global", "task:updated", "task:status_changed", "task:deleted", "project:updated"],
      () => loadTasks()
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProject?._id]);

  // Close calendar drawers when ANY other sidebar opens or Copilot navigates via "Open"
  useEffect(() => {
    const onCloseAll = (e) => {
      if (e?.detail?.except !== "task" && e?.detail?.except !== "task-drawer") setActiveTaskKey(null);
      setSelectedDay(null);
      setShowUnscheduledDrawer(false);
    };
    const onOtherSidebar = (e) => {
      const id = e?.detail?.id;
      if (!id) return;
      if (id !== "task-drawer") setActiveTaskKey(null);
      if (id !== "calendar-day") setSelectedDay(null);
      if (id !== "calendar-unscheduled") setShowUnscheduledDrawer(false);
    };
    window.addEventListener("lira:close-all-sidebars", onCloseAll);
    window.addEventListener("lira:sidebar-opened", onOtherSidebar);
    return () => {
      window.removeEventListener("lira:close-all-sidebars", onCloseAll);
      window.removeEventListener("lira:sidebar-opened", onOtherSidebar);
    };
  }, []);

  // Calendar calculations
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay();

  const totalCells = firstDayIndex + daysInMonth;
  const trailingBlankCells = (7 - (totalCells % 7)) % 7;

  const prevMonth = () => {
    setSelectedDay(null);
    setCurrentDate(new Date(year, month - 1, 1));
  };
  const nextMonth = () => {
    setSelectedDay(null);
    setCurrentDate(new Date(year, month + 1, 1));
  };
  const goToToday = () => {
    const d = new Date();
    setCurrentDate(d);
    setSelectedDay(d.getDate());
  };

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  const { tasksByDay, unscheduledTasks } = useMemo(() => {
    const map = {};
    const unsched = [];
    tasks.forEach((task) => {
      const ymd = extractLocalYMD(task.dueDate);
      if (!ymd) {
        unsched.push(task);
        return;
      }
      if (ymd.year === year && ymd.month === month) {
        if (!map[ymd.day]) map[ymd.day] = [];
        map[ymd.day].push(task);
      }
    });
    return { tasksByDay: map, unscheduledTasks: unsched };
  }, [tasks, year, month]);

  const now = new Date();
  const selectedDayTasks = selectedDay ? tasksByDay[selectedDay] || [] : [];

  const handleScheduleForDate = (dayNum) => {
    const targetDateStr = toYMD(year, month, dayNum);
    setSelectedDay(null);
    setShowUnscheduledDrawer(false);
    setAiPrefillDraft({
      type: "create_task",
      data: { dueDate: targetDateStr },
      nonce: Date.now(),
    });
    setIsCreateTaskModalOpen(true);
  };

  return (
    <div
      className={`flex-1 w-full h-full min-h-0 flex flex-col overflow-hidden transition-colors duration-150 ${
        isDark ? "text-slate-200" : "text-slate-800"
      }`}
    >
      {/* Top Sub-Header */}
      <div
        className={`px-6 py-3.5 border-b flex flex-wrap items-center justify-between gap-3 shrink-0 ${g.subHeader}`}
      >
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl border flex items-center justify-center ${g.badge}`}>
            <CalendarIcon className="w-4 h-4" />
          </div>
          <div>
            <h1 className={`text-sm sm:text-base font-bold tracking-tight ${g.heading}`}>
              Operational Schedule & Deadlines
            </h1>
            <p className={`text-xs ${g.muted}`}>
              {activeProject ? `[${activeProject.prefix}] ${activeProject.name}` : "All Workspaces"} • Click any date or task title to inspect details
            </p>
          </div>
        </div>

        {/* Month Navigation + Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {unscheduledTasks.length > 0 && (
            <button
              type="button"
              onClick={() => setShowUnscheduledDrawer(true)}
              className={`px-3 py-1.5 rounded-full border text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${g.btnSecondary}`}
              title="Tasks without a due date"
            >
              <Inbox className="w-3.5 h-3.5 text-amber-400" />
              <span>Unscheduled ({unscheduledTasks.length})</span>
            </button>
          )}

          <button
            type="button"
            onClick={loadTasks}
            className={`p-2 rounded-full border transition-colors cursor-pointer ${g.iconBtn}`}
            title="Refresh Calendar"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>

          <button
            type="button"
            onClick={goToToday}
            className={`px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors cursor-pointer ${g.btnSecondary}`}
          >
            Today
          </button>

          <div className={`flex items-center gap-1 border p-1 rounded-full ${g.subtleSurface}`}>
            <button
              type="button"
              onClick={prevMonth}
              className={`p-1.5 rounded-full transition-colors cursor-pointer ${g.muted} hover:text-current`}
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className={`text-xs font-bold px-3 font-mono min-w-[125px] text-center ${g.heading}`}>
              {monthNames[month]} {year}
            </span>
            <button
              type="button"
              onClick={nextMonth}
              className={`p-1.5 rounded-full transition-colors cursor-pointer ${g.muted} hover:text-current`}
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            data-ai-target="calendar-add-task-btn"
            onClick={() => {
              setAiPrefillDraft({
                type: "create_task",
                data: { dueDate: toYMD(year, month, selectedDay || now.getDate()) },
                nonce: Date.now(),
              });
              setIsCreateTaskModalOpen(true);
            }}
            className={`px-3.5 py-2 rounded-full font-semibold text-xs flex items-center gap-1.5 cursor-pointer ${g.btnPrimary}`}
          >
            <Plus className="w-3.5 h-3.5" /> Add Task
          </button>
        </div>
      </div>

      {/* Calendar Wrapper */}
      <div className="flex-1 min-h-0 flex flex-col overflow-auto">
        <div className="min-w-[720px] flex-1 flex flex-col">
          {/* Weekday Labels */}
          <div
            className={`grid grid-cols-7 border-b text-center py-2 text-[10px] font-bold uppercase tracking-wider shrink-0 ${g.subHeader} ${g.muted}`}
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
            className={`flex-1 grid grid-cols-7 auto-rows-fr border-l backdrop-blur-xl ${
              isDark ? "border-white/[0.08] bg-white/[0.015]" : "border-slate-900/[0.08] bg-white/55"
            }`}
          >
            {Array.from({ length: firstDayIndex }).map((_, i) => (
              <div
                key={`empty-start-${i}`}
                className={`p-2 min-h-[100px] border-r border-b ${
                  isDark ? "bg-black/20 border-white/[0.06]" : "bg-slate-50/70 border-slate-200"
                }`}
              />
            ))}

            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dayTasks = tasksByDay[day] || [];
              const isToday =
                day === now.getDate() &&
                month === now.getMonth() &&
                year === now.getFullYear();
              const isSelected = selectedDay === day;

              return (
                <div
                  key={`day-${day}`}
                  onClick={() => setSelectedDay(day)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedDay(day);
                    }
                  }}
                  className={`p-2 min-h-[108px] border-r border-b flex flex-col justify-between transition-colors cursor-pointer text-left ${g.border} ${
                    isSelected
                      ? "ring-1 ring-inset ring-purple-400/55 bg-purple-500/[0.08]"
                      : isToday
                      ? g.selectedRow
                      : g.rowHover
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-xs font-bold font-mono px-1.5 py-0.5 rounded-md ${
                        isToday ? g.pillActive : g.heading
                      }`}
                    >
                      {day}
                    </span>
                    {dayTasks.length > 0 && (
                      <span className={`text-[9px] font-mono ${g.muted}`}>
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
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveTaskKey(t.key || t._id);
                        }}
                        className={`w-full text-left p-1.5 rounded-lg border text-[10px] cursor-pointer hover:scale-[1.01] transition-transform truncate block ${
                          t.status === "done"
                            ? isDark
                              ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
                              : "bg-emerald-50 border-emerald-200 text-emerald-800"
                            : t.status === "submitted_for_review" || t.status === "review"
                            ? isDark
                              ? "bg-amber-500/15 border-amber-500/30 text-amber-300"
                              : "bg-amber-50 border-amber-200 text-amber-800"
                            : `${g.subtleSurface} ${g.heading}`
                        }`}
                        title={`${t.key}: ${t.title} — click to open details sidebar`}
                      >
                        <div className="flex items-center gap-1 font-semibold truncate">
                          <span className={`text-[9px] font-mono shrink-0 ${g.muted}`}>
                            {t.key}
                          </span>
                          <span className="truncate">{t.title}</span>
                        </div>
                      </button>
                    ))}
                    {dayTasks.length > 3 && (
                      <span className={`text-[9px] block text-center font-mono font-bold text-purple-400`}>
                        +{dayTasks.length - 3} more — click day
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {Array.from({ length: trailingBlankCells }).map((_, i) => (
              <div
                key={`empty-end-${i}`}
                className={`p-2 min-h-[100px] border-r border-b ${
                  isDark ? "bg-black/20 border-white/[0.06]" : "bg-slate-50/70 border-slate-200"
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Selected Calendar Day Schedule Sidebar */}
      <SideDrawer
        sidebarId="calendar-day"
        isOpen={selectedDay !== null}
        onClose={() => setSelectedDay(null)}
        title={selectedDay ? `${monthNames[month]} ${selectedDay}, ${year}` : "Schedule"}
        subtitle={`${selectedDayTasks.length} scheduled task${selectedDayTasks.length === 1 ? "" : "s"}`}
        icon={CalendarIcon}
        widthClass="max-w-lg"
        footer={
          selectedDay && (
            <button
              type="button"
              onClick={() => handleScheduleForDate(selectedDay)}
              className={`w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${g.btnPrimary}`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Schedule Task for {monthNames[month]} {selectedDay}</span>
            </button>
          )
        }
      >
        <div className="space-y-3">
          {selectedDayTasks.length === 0 ? (
            <div className={`p-6 rounded-2xl border text-center space-y-2 ${g.subtleSurface}`}>
              <Clock className="w-6 h-6 mx-auto opacity-50" />
              <p className={`text-xs font-semibold ${g.heading}`}>No tasks scheduled on this date</p>
              <p className={`text-[11px] ${g.muted}`}>
                Click below to add a task with its deadline set to {monthNames[month]} {selectedDay}, {year}.
              </p>
            </div>
          ) : (
            selectedDayTasks.map((task) => {
              const assigneeList = Array.isArray(task.assignees) && task.assignees.length > 0
                ? task.assignees
                : task.assignee
                ? [task.assignee]
                : [];
              return (
                <div
                  key={task._id}
                  onClick={() => {
                    setSelectedDay(null);
                    setActiveTaskKey(task.key || task._id);
                  }}
                  className={`p-4 rounded-2xl border space-y-2.5 cursor-pointer transition-all ${g.card} ${g.rowHover}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-bold border ${g.badge}`}>
                          {task.key}
                        </span>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase ${g.subtleSurface}`}>
                          {String(task.status || "todo").replace(/_/g, " ")}
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase bg-purple-500/15 text-purple-300">
                          {task.priority || "medium"}
                        </span>
                      </div>
                      <h3 className={`text-sm font-bold mt-2 ${g.heading}`}>{task.title}</h3>
                    </div>
                    <ArrowUpRight className="w-4 h-4 shrink-0 opacity-60" />
                  </div>

                  {task.description && (
                    <p className={`text-xs line-clamp-2 ${g.muted}`}>{task.description}</p>
                  )}

                  <div className="flex items-center justify-between pt-1 border-t border-white/[0.06] text-[11px]">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {assigneeList.slice(0, 3).map((a) => (
                        <div key={a._id || a} className="flex items-center gap-1">
                          <UserAvatar user={a} className="w-5 h-5 rounded-full" textClass="text-[8px]" />
                          <span className={`truncate max-w-[90px] ${g.muted}`}>{getDisplayName(a)}</span>
                        </div>
                      ))}
                      {assigneeList.length === 0 && <span className={g.muted}>Unassigned</span>}
                    </div>
                    <span className="text-[10px] font-semibold text-purple-400">Open Sidebar Details →</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </SideDrawer>

      {/* Unscheduled Tasks Drawer */}
      <SideDrawer
        sidebarId="calendar-unscheduled"
        isOpen={showUnscheduledDrawer}
        onClose={() => setShowUnscheduledDrawer(false)}
        title="Unscheduled Workspace Tasks"
        subtitle={`${unscheduledTasks.length} task(s) with no due date set`}
        icon={Inbox}
        widthClass="max-w-lg"
      >
        <div className="space-y-2.5">
          {unscheduledTasks.map((t) => (
            <button
              key={t._id}
              type="button"
              onClick={() => {
                setShowUnscheduledDrawer(false);
                setActiveTaskKey(t.key || t._id);
              }}
              className={`w-full text-left p-3.5 rounded-2xl border flex items-center justify-between gap-3 cursor-pointer ${g.card} ${g.rowHover}`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`px-1.5 py-0.5 rounded font-mono text-[10px] font-bold border ${g.badge}`}>{t.key}</span>
                  <span className={`text-xs font-bold truncate ${g.heading}`}>{t.title}</span>
                </div>
                <p className={`text-[11px] mt-1 ${g.muted}`}>
                  Click to open task sidebar and assign a due date
                </p>
              </div>
              <CheckCircle2 className="w-4 h-4 opacity-50 shrink-0" />
            </button>
          ))}
        </div>
      </SideDrawer>

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
