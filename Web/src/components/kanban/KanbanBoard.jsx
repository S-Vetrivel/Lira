import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useApp } from "../../context/Appcontext";
import TaskCard from "./TaskCard";
import { getTasks, updateTaskStatus } from "../../services/api";
import { subscribeRealtimeEvents } from "../../services/socket";
import { getGlassTokens } from "../../styles/glassTheme";
import {
  Filter,
  UserCheck,
  AlertTriangle,
  Calendar,
  RefreshCw,
  Plus,
  X,
  Layers,
} from "lucide-react";

const COLUMNS = [
  {
    id: "todo",
    title: "To Do",
    dot: "bg-slate-400",
  },
  {
    id: "in_progress",
    title: "In Progress",
    dot: "bg-blue-500",
  },
  {
    id: "review",
    title: "In Review",
    dot: "bg-purple-500",
  },
  {
    id: "done",
    title: "Done",
    dot: "bg-emerald-500",
  },
];

export default function KanbanBoard({ onSelectTask }) {
  const { user, isSuperAdmin, hasPermission, activeProject, teamMembers, setIsCreateTaskModalOpen, theme } = useApp();
  const isDark = theme === "dark";
  const g = getGlassTokens(isDark);
  const canCreateTask = isSuperAdmin || hasPermission("tasks.create");

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters state
  const [filterMyTasks, setFilterMyTasks] = useState(false);
  const [filterDueToday, setFilterDueToday] = useState(false);
  const [filterOverdue, setFilterOverdue] = useState(false);
  const [selectedAssignee, setSelectedAssignee] = useState("");
  const [selectedPriority, setSelectedPriority] = useState("");
  const [mobileColumn, setMobileColumn] = useState("todo");
  const [selectedType, setSelectedType] = useState("");

  // Dragging state
  const [draggingTaskId, setDraggingTaskId] = useState(null);
  const [dragOverColumn, setDragOverColumn] = useState(null);

  // Fetch tasks
  const fetchTasks = useCallback(async () => {
    if (!activeProject?._id) return;
    setLoading(true);
    const res = await getTasks({ projectId: activeProject._id });
    if (res.success) {
      setTasks(res.tasks);
    }
    setLoading(false);
  }, [activeProject?._id]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Real-time WebSocket subscriptions (never dropped even if socket connects after initial mount)
  useEffect(() => {
    if (!activeProject?._id) return;

    return subscribeRealtimeEvents(
      ["task:created", "task:created_global", "task:updated", "task:status_changed", "task:deleted"],
      (payload, evt) => {
        if (evt === "task:created") {
          if (payload.project?._id === activeProject._id || payload.project === activeProject._id) {
            setTasks((prev) => [payload, ...prev.filter((t) => t._id !== payload._id)]);
          }
          return;
        }
        if (evt === "task:updated") {
          if (payload?.bulk) {
            fetchTasks();
            return;
          }
          if (payload?._id) {
            setTasks((prev) => prev.map((t) => (t._id === payload._id ? payload : t)));
          } else {
            fetchTasks();
          }
          return;
        }
        if (evt === "task:status_changed") {
          const { taskId, newStatus, task } = payload;
          setTasks((prev) =>
            prev.map((t) => (t._id === taskId ? task || { ...t, status: newStatus } : t))
          );
          return;
        }
        if (evt === "task:deleted") {
          setTasks((prev) => prev.filter((t) => t._id !== payload.taskId));
          return;
        }
        fetchTasks();
      }
    );
  }, [activeProject?._id, fetchTasks]);

  // Drag & drop handlers
  const handleDragStart = (e, task) => {
    e.dataTransfer.setData("taskId", task._id);
    e.dataTransfer.setData("oldStatus", task.status);
    setDraggingTaskId(task._id);
  };

  const handleDragOver = (e, columnId) => {
    e.preventDefault();
    if (dragOverColumn !== columnId) {
      setDragOverColumn(columnId);
    }
  };

  const handleDrop = async (e, targetColumnId) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("taskId");
    const oldStatus = e.dataTransfer.getData("oldStatus");

    setDraggingTaskId(null);
    setDragOverColumn(null);

    if (!taskId || oldStatus === targetColumnId) return;

    // Optimistic UI update
    setTasks((prev) =>
      prev.map((t) => (t._id === taskId ? { ...t, status: targetColumnId } : t))
    );

    const res = await updateTaskStatus(taskId, targetColumnId);
    if (!res.success) {
      setTasks((prev) =>
        prev.map((t) => (t._id === taskId ? { ...t, status: oldStatus } : t))
      );
    }
  };

  // Filter tasks
  const filteredTasks = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const matchesUser = (t, uid) => {
      if (!uid) return true;
      const sid = String(uid);
      if (String(t.assignee?._id || t.assignee) === sid) return true;
      if ((t.assignees || []).some((a) => String(a._id || a) === sid)) return true;
      return false;
    };

    return tasks.filter((t) => {
      const userDeptId = String(user?.department?._id || user?.department || "");
      const inMyDept =
        userDeptId &&
        (t.assignedDepartments || []).some((d) => String(d._id || d) === userDeptId);
      if (filterMyTasks && !matchesUser(t, user?._id) && !inMyDept) return false;
      if (selectedAssignee && !matchesUser(t, selectedAssignee)) return false;
      if (selectedPriority && t.priority !== selectedPriority) return false;
      if (selectedType && t.type !== selectedType) return false;

      if (filterDueToday) {
        if (!t.dueDate) return false;
        const due = new Date(t.dueDate);
        if (due < startOfToday || due > endOfToday) return false;
      }

      if (filterOverdue) {
        if (!t.dueDate || t.status === "done") return false;
        const due = new Date(t.dueDate);
        if (due >= startOfToday) return false;
      }

      return true;
    });
  }, [
    tasks,
    filterMyTasks,
    filterDueToday,
    filterOverdue,
    selectedAssignee,
    selectedPriority,
    selectedType,
    user?._id,
  ]);

  const hasActiveFilters =
    filterMyTasks ||
    filterDueToday ||
    filterOverdue ||
    selectedAssignee ||
    selectedPriority ||
    selectedType;

  const resetFilters = () => {
    setFilterMyTasks(false);
    setFilterDueToday(false);
    setFilterOverdue(false);
    setSelectedAssignee("");
    setSelectedPriority("");
    setSelectedType("");
  };

  return (
    <div
      className={`flex-1 w-full h-full min-h-0 flex flex-col overflow-hidden transition-colors duration-150 ${g.canvas}`}
    >
      {/* 1. Sub-Header Toolbar: Sprint Info & Quick Filter Pills */}
      <div
        className={`w-full px-3.5 sm:px-6 py-2.5 sm:py-3 border-b flex flex-wrap items-center justify-between gap-2.5 sm:gap-3 shrink-0 select-none transition-colors duration-150 ${g.subHeader}`}
      >
        {/* Left: Project title & count */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span
              className={`font-mono text-xs font-bold px-2.5 py-0.5 rounded-full border ${g.badge}`}
            >
              {activeProject?.prefix || "ENG"}
            </span>
            <h2 className={`text-sm font-bold tracking-tight ${g.heading}`}>
              {activeProject?.name || "Sprint Board"}
            </h2>
            <span className={`text-xs font-medium ${g.muted}`}>
              ({filteredTasks.length} {filteredTasks.length === 1 ? "task" : "tasks"})
            </span>
          </div>

          <button
            onClick={fetchTasks}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${g.iconBtn}`}
            title="Refresh Board"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Right: Filter Pills */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          {/* Quick Filter: My Tasks */}
          <button
            onClick={() => setFilterMyTasks(!filterMyTasks)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer ${
              filterMyTasks ? g.pillActive : g.pillInactive
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>My Tasks</span>
          </button>

          {/* Quick Filter: Due Today */}
          <button
            onClick={() => setFilterDueToday(!filterDueToday)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer ${
              filterDueToday
                ? "bg-amber-500 text-zinc-950 font-bold shadow-xs"
                : g.pillInactive
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Due Today</span>
          </button>

          {/* Quick Filter: Overdue */}
          <button
            onClick={() => setFilterOverdue(!filterOverdue)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer ${
              filterOverdue
                ? "bg-rose-500 text-white font-bold shadow-xs"
                : g.pillInactive
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Overdue</span>
          </button>

          <div className={`h-4 w-px mx-1 hidden sm:block ${isDark ? "bg-white/10" : "bg-slate-200"}`} />

          {/* Assignee Filter */}
          <select
            value={selectedAssignee}
            onChange={(e) => setSelectedAssignee(e.target.value)}
            className={`text-xs font-medium rounded-full px-3 py-1 focus:outline-none cursor-pointer border ${g.input}`}
          >
            <option value="" className={isDark ? "bg-[#14151a] text-white" : "bg-white text-slate-900"}>
              All Assignees
            </option>
            {teamMembers.map((m) => (
              <option
                key={m._id}
                value={m._id}
                className={isDark ? "bg-[#14151a] text-white" : "bg-white text-slate-900"}
              >
                {m.fullname}
              </option>
            ))}
          </select>

          {/* Priority Filter */}
          <select
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value)}
            className={`text-xs font-medium rounded-full px-3 py-1 focus:outline-none cursor-pointer border ${g.input}`}
          >
            <option value="" className={isDark ? "bg-[#14151a] text-white" : "bg-white text-slate-900"}>
              All Priorities
            </option>
            <option value="urgent" className={isDark ? "bg-[#14151a] text-white" : "bg-white text-slate-900"}>Urgent</option>
            <option value="high" className={isDark ? "bg-[#14151a] text-white" : "bg-white text-slate-900"}>High</option>
            <option value="medium" className={isDark ? "bg-[#14151a] text-white" : "bg-white text-slate-900"}>Medium</option>
            <option value="low" className={isDark ? "bg-[#14151a] text-white" : "bg-white text-slate-900"}>Low</option>
          </select>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className={`text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 cursor-pointer ${g.btnSecondary}`}
            >
              <X className="w-3 h-3" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Mobile Portrait Column Tabs (< md) */}
      <div className={`md:hidden px-3 py-2 border-b flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0 ${g.subtleSurface}`}>
        {COLUMNS.map((col) => {
          const count = filteredTasks.filter((t) => {
            if (col.id === "in_progress") return t.status === "in_progress" || t.status === "redo_requested";
            if (col.id === "review") return t.status === "review" || t.status === "submitted_for_review";
            return t.status === col.id;
          }).length;
          const active = mobileColumn === col.id;
          return (
            <button
              key={`mob-col-${col.id}`}
              type="button"
              onClick={() => setMobileColumn(col.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                active ? g.pillActive : g.pillInactive
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${col.dot}`} />
              <span>{col.title}</span>
              <span className="font-mono text-[10px] opacity-80">({count})</span>
            </button>
          );
        })}
      </div>

      {/* 2. Full-Height 4-Column Kanban Grid (Single active column on mobile portrait, multi-column on md+) */}
      <div className="flex-1 w-full min-h-0 p-3 sm:p-5 md:p-6 overflow-hidden md:overflow-x-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-5 h-full">
          {COLUMNS.map((column) => {
            const columnTasks = filteredTasks.filter((t) => {
              if (column.id === "in_progress") {
                return t.status === "in_progress" || t.status === "redo_requested";
              }
              if (column.id === "review") {
                return t.status === "review" || t.status === "submitted_for_review";
              }
              return t.status === column.id;
            });
            const isTargeted = dragOverColumn === column.id;
            const isMobileVisible = mobileColumn === column.id;

            return (
              <div
                key={column.id}
                onDragOver={(e) => handleDragOver(e, column.id)}
                onDragLeave={() => setDragOverColumn(null)}
                onDrop={(e) => handleDrop(e, column.id)}
                className={`${isMobileVisible ? "flex" : "hidden md:flex"} flex-col h-full min-h-0 rounded-2xl transition-all duration-150 overflow-hidden ${
                  isTargeted ? g.cardActive : g.card
                }`}
              >
                {/* Column Header */}
                <div
                  className={`px-4 py-3 border-b flex items-center justify-between shrink-0 ${g.subHeader}`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${column.dot}`} />
                    <h3 className="text-xs font-bold uppercase tracking-wider">
                      {column.title}
                    </h3>
                  </div>
                  <span
                    className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-full border ${g.badge}`}
                  >
                    {columnTasks.length}
                  </span>
                </div>

                {/* Cards Container (Scrolls vertically inside the full-height column) */}
                <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
                  {columnTasks.map((task) => (
                    <TaskCard
                      key={task._id}
                      task={task}
                      onClick={onSelectTask}
                      onDragStart={handleDragStart}
                    />
                  ))}

                  {/* Empty state drop area */}
                  {columnTasks.length === 0 && (
                    <div
                      className={`h-44 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-center p-4 ${
                        isDark ? "border-white/10 text-zinc-500" : "border-slate-300 text-slate-400"
                      }`}
                    >
                      <p className="text-xs font-medium">No tasks in {column.title}</p>
                      {canCreateTask && (
                        <button
                          onClick={() => setIsCreateTaskModalOpen(true)}
                          className={`mt-2 text-xs font-semibold flex items-center gap-1 cursor-pointer ${g.heading} hover:underline`}
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add task</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
