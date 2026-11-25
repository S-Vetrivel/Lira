import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useApp } from "../../context/Appcontext";
import TaskCard from "./TaskCard";
import { getTasks, updateTaskStatus } from "../../services/api";
import { getSocket } from "../../services/socket";
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
  const { user, activeProject, teamMembers, setIsCreateTaskModalOpen, theme } = useApp();
  const isDark = theme === "dark";

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters state
  const [filterMyTasks, setFilterMyTasks] = useState(false);
  const [filterDueToday, setFilterDueToday] = useState(false);
  const [filterOverdue, setFilterOverdue] = useState(false);
  const [selectedAssignee, setSelectedAssignee] = useState("");
  const [selectedPriority, setSelectedPriority] = useState("");
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

  // Real-time WebSocket subscriptions
  useEffect(() => {
    const socket = getSocket();
    if (!socket || !activeProject?._id) return;

    const handleTaskCreated = (newTask) => {
      if (newTask.project?._id === activeProject._id || newTask.project === activeProject._id) {
        setTasks((prev) => [newTask, ...prev.filter((t) => t._id !== newTask._id)]);
      }
    };

    const handleTaskUpdated = (updatedTask) => {
      setTasks((prev) =>
        prev.map((t) => (t._id === updatedTask._id ? updatedTask : t))
      );
    };

    const handleStatusChanged = ({ taskId, newStatus, task }) => {
      setTasks((prev) =>
        prev.map((t) => {
          if (t._id === taskId) {
            return task || { ...t, status: newStatus };
          }
          return t;
        })
      );
    };

    const handleTaskDeleted = ({ taskId }) => {
      setTasks((prev) => prev.filter((t) => t._id !== taskId));
    };

    socket.on("task:created", handleTaskCreated);
    socket.on("task:updated", handleTaskUpdated);
    socket.on("task:status_changed", handleStatusChanged);
    socket.on("task:deleted", handleTaskDeleted);

    return () => {
      socket.off("task:created", handleTaskCreated);
      socket.off("task:updated", handleTaskUpdated);
      socket.off("task:status_changed", handleStatusChanged);
      socket.off("task:deleted", handleTaskDeleted);
    };
  }, [activeProject?._id]);

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

    return tasks.filter((t) => {
      if (filterMyTasks && t.assignee?._id !== user?._id) return false;
      if (selectedAssignee && t.assignee?._id !== selectedAssignee) return false;
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
      className={`flex-1 w-full h-full min-h-0 flex flex-col overflow-hidden transition-colors duration-150 ${
        isDark ? "bg-[#0c0d12]" : "bg-slate-50"
      }`}
    >
      {/* 1. Sub-Header Toolbar: Sprint Info & Quick Filter Pills */}
      <div
        className={`w-full px-6 py-3 border-b flex flex-wrap items-center justify-between gap-3 shrink-0 select-none transition-colors duration-150 ${
          isDark
            ? "bg-[#0e0f16] border-white/10 text-white"
            : "bg-white border-slate-200 text-slate-900"
        }`}
      >
        {/* Left: Project title & count */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span
              className={`font-mono text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                isDark
                  ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                  : "bg-blue-50 text-blue-700 border-blue-200"
              }`}
            >
              {activeProject?.prefix || "ENG"}
            </span>
            <h2
              className={`text-sm font-bold tracking-tight ${
                isDark ? "text-white" : "text-slate-900"
              }`}
            >
              {activeProject?.name || "Sprint Board"}
            </h2>
            <span className="text-xs text-slate-400 font-medium">
              ({filteredTasks.length} {filteredTasks.length === 1 ? "task" : "tasks"})
            </span>
          </div>

          <button
            onClick={fetchTasks}
            className={`p-1.5 rounded-lg transition-colors ${
              isDark ? "text-slate-400 hover:text-white hover:bg-white/5" : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
            }`}
            title="Refresh Board"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-indigo-400" : ""}`} />
          </button>
        </div>

        {/* Right: Filter Pills */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          {/* Quick Filter: My Tasks */}
          <button
            onClick={() => setFilterMyTasks(!filterMyTasks)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all ${
              filterMyTasks
                ? "bg-indigo-600 text-white font-bold shadow-xs"
                : isDark
                ? "bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10"
                : "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200"
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>My Tasks</span>
          </button>

          {/* Quick Filter: Due Today */}
          <button
            onClick={() => setFilterDueToday(!filterDueToday)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all ${
              filterDueToday
                ? "bg-amber-600 text-white font-bold shadow-xs"
                : isDark
                ? "bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10"
                : "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200"
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Due Today</span>
          </button>

          {/* Quick Filter: Overdue */}
          <button
            onClick={() => setFilterOverdue(!filterOverdue)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all ${
              filterOverdue
                ? "bg-rose-600 text-white font-bold shadow-xs"
                : isDark
                ? "bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10"
                : "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200"
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
            className={`text-xs font-medium rounded-full px-3 py-1 focus:outline-none cursor-pointer border ${
              isDark
                ? "bg-white/5 border-white/10 text-slate-300"
                : "bg-slate-100 border-slate-200 text-slate-700"
            }`}
          >
            <option value="" className={isDark ? "bg-[#191a24] text-white" : "bg-white text-slate-900"}>
              All Assignees
            </option>
            {teamMembers.map((m) => (
              <option
                key={m._id}
                value={m._id}
                className={isDark ? "bg-[#191a24] text-white" : "bg-white text-slate-900"}
              >
                {m.fullname}
              </option>
            ))}
          </select>

          {/* Priority Filter */}
          <select
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value)}
            className={`text-xs font-medium rounded-full px-3 py-1 focus:outline-none cursor-pointer border ${
              isDark
                ? "bg-white/5 border-white/10 text-slate-300"
                : "bg-slate-100 border-slate-200 text-slate-700"
            }`}
          >
            <option value="" className={isDark ? "bg-[#191a24] text-white" : "bg-white text-slate-900"}>
              All Priorities
            </option>
            <option value="urgent" className={isDark ? "bg-[#191a24] text-white" : "bg-white text-slate-900"}>Urgent</option>
            <option value="high" className={isDark ? "bg-[#191a24] text-white" : "bg-white text-slate-900"}>High</option>
            <option value="medium" className={isDark ? "bg-[#191a24] text-white" : "bg-white text-slate-900"}>Medium</option>
            <option value="low" className={isDark ? "bg-[#191a24] text-white" : "bg-white text-slate-900"}>Low</option>
          </select>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className={`text-xs font-semibold px-2 py-1 rounded flex items-center gap-1 ${
                isDark ? "text-indigo-400 hover:text-indigo-300" : "text-indigo-600 hover:text-indigo-800"
              }`}
            >
              <X className="w-3 h-3" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Full-Height 4-Column Kanban Grid (Stretches from top to bottom) */}
      <div className="flex-1 w-full min-h-0 p-5 sm:p-6 overflow-x-auto overflow-y-hidden">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 min-w-[900px] h-full">
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

            return (
              <div
                key={column.id}
                onDragOver={(e) => handleDragOver(e, column.id)}
                onDragLeave={() => setDragOverColumn(null)}
                onDrop={(e) => handleDrop(e, column.id)}
                className={`flex flex-col h-full rounded-2xl border transition-all duration-150 overflow-hidden ${
                  isTargeted
                    ? "border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-500/10"
                    : isDark
                    ? "bg-[#12131a] border-white/10"
                    : "bg-slate-100/90 border-slate-200"
                }`}
              >
                {/* Column Header */}
                <div
                  className={`px-4 py-3 border-b flex items-center justify-between shrink-0 ${
                    isDark
                      ? "bg-[#161722] border-white/5 text-slate-200"
                      : "bg-white/80 border-slate-200 text-slate-800"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${column.dot}`} />
                    <h3 className="text-xs font-bold uppercase tracking-wider">
                      {column.title}
                    </h3>
                  </div>
                  <span
                    className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                      isDark
                        ? "text-slate-400 bg-white/5 border-white/10"
                        : "text-slate-600 bg-slate-100 border-slate-200"
                    }`}
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
                        isDark ? "border-white/10 text-slate-500" : "border-slate-300 text-slate-400"
                      }`}
                    >
                      <p className="text-xs font-medium">No tasks in {column.title}</p>
                      <button
                        onClick={() => setIsCreateTaskModalOpen(true)}
                        className={`mt-2 text-xs font-semibold flex items-center gap-1 ${
                          isDark ? "text-indigo-400 hover:text-indigo-300" : "text-indigo-600 hover:text-indigo-800"
                        }`}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add task</span>
                      </button>
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
