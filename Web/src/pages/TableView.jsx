import React, { useState, useEffect, useMemo } from "react";
import {
  Table as TableIcon,
  Search,
  Filter,
  CheckSquare,
  Clock,
  Shield,
  RotateCcw,
  CheckCircle2,
  ChevronDown,
  Download,
  AlertCircle,
  Sparkles,
  ArrowUpDown,
  User,
  Plus,
} from "lucide-react";
import { useApp } from "../context/Appcontext";
import {
  getTasks,
  updateTaskStatus,
  updateTask,
  bulkUpdateTasks,
  submitTaskForReview,
  approveTask,
  requestTaskRevision,
} from "../services/api";
import TaskDrawer from "../components/task/TaskDrawer";
import toast from "react-hot-toast";

export default function TableView() {
  const { user, activeProject } = useApp();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [selectedTaskIds, setSelectedTaskIds] = useState(new Set());
  const [activeTaskKey, setActiveTaskKey] = useState(null);
  const [isTaskDrawerOpen, setIsTaskDrawerOpen] = useState(false);
  const [sortField, setSortField] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState("desc");

  // Load tasks
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

  // Filtering & Sorting
  const filteredTasks = useMemo(() => {
    return tasks
      .filter((t) => {
        const matchesSearch =
          t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.assignee?.name?.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesStatus = statusFilter === "all" || t.status === statusFilter;
        const matchesPriority = priorityFilter === "all" || t.priority === priorityFilter;

        return matchesSearch && matchesStatus && matchesPriority;
      })
      .sort((a, b) => {
        let valA = a[sortField];
        let valB = b[sortField];
        if (sortField === "assignee") {
          valA = a.assignee?.name || "";
          valB = b.assignee?.name || "";
        }
        if (valA < valB) return sortOrder === "asc" ? -1 : 1;
        if (valA > valB) return sortOrder === "asc" ? 1 : -1;
        return 0;
      });
  }, [tasks, searchQuery, statusFilter, priorityFilter, sortField, sortOrder]);

  // Bulk Selection Handlers
  const toggleSelectAll = () => {
    if (selectedTaskIds.size === filteredTasks.length) {
      setSelectedTaskIds(new Set());
    } else {
      setSelectedTaskIds(new Set(filteredTasks.map((t) => t._id)));
    }
  };

  const toggleSelectTask = (id) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Status & Priority Quick In-Place Updates
  const handleQuickStatusChange = async (taskId, newStatus) => {
    try {
      await updateTaskStatus(taskId, newStatus);
      setTasks((prev) =>
        prev.map((t) => (t._id === taskId ? { ...t, status: newStatus } : t))
      );
      toast.success("Status updated");
    } catch (err) {
      toast.error("Failed to update status");
    }
  };

  const handleQuickPriorityChange = async (taskId, newPriority) => {
    try {
      await updateTask(taskId, { priority: newPriority });
      setTasks((prev) =>
        prev.map((t) => (t._id === taskId ? { ...t, priority: newPriority } : t))
      );
      toast.success("Priority updated");
    } catch (err) {
      toast.error("Failed to update priority");
    }
  };

  // Bulk Action Execution
  const handleBulkStatusChange = async (newStatus) => {
    if (selectedTaskIds.size === 0) return;
    const ids = Array.from(selectedTaskIds);
    const res = await bulkUpdateTasks(ids, { status: newStatus });
    if (res.success) {
      setTasks((prev) =>
        prev.map((t) => (selectedTaskIds.has(t._id) ? { ...t, status: newStatus } : t))
      );
      setSelectedTaskIds(new Set());
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    const headers = ["Key", "Title", "Status", "Priority", "Assignee", "Due Date", "Due Time"];
    const rows = filteredTasks.map((t) => [
      t.key,
      `"${t.title.replace(/"/g, '""')}"`,
      t.status,
      t.priority,
      t.assignee?.name || "Unassigned",
      t.dueDate ? new Date(t.dueDate).toLocaleDateString() : "None",
      t.dueTime || "None",
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Lira_Tasks_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Spreadsheet CSV exported");
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "submitted_for_review":
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-1 w-max">
            <RotateCcw className="w-2.5 h-2.5" /> For Review
          </span>
        );
      case "redo_requested":
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30 flex items-center gap-1 w-max">
            <AlertCircle className="w-2.5 h-2.5" /> Revision Needed
          </span>
        );
      case "in_progress":
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/30 flex items-center gap-1 w-max">
            In Progress
          </span>
        );
      case "done":
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 w-max">
            <CheckCircle2 className="w-2.5 h-2.5" /> Completed
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700 w-max">
            To Do
          </span>
        );
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950 text-slate-200">
      {/* Top Bar / Toolbar */}
      <div className="p-4 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <TableIcon className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <span>Operational Grid View</span>
              <span className="text-xs px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 font-mono">
                {filteredTasks.length} tasks
              </span>
            </h1>
            <p className="text-xs text-slate-400">High-density Excel-style task register with inline actions</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" /> Export CSV
          </button>
        </div>
      </div>

      {/* Filter and Bulk Actions Bar */}
      <div className="p-3 bg-slate-900/40 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <div className="relative flex-1 max-w-xs">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search tasks, IDs, owners..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-blue-500"
          >
            <option value="all">All Statuses</option>
            <option value="todo">To Do</option>
            <option value="in_progress">In Progress</option>
            <option value="submitted_for_review">Submitted for Review</option>
            <option value="redo_requested">Revision Requested</option>
            <option value="done">Completed</option>
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-blue-500"
          >
            <option value="all">All Priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>

        {/* Bulk Action Controls */}
        {selectedTaskIds.size > 0 && (
          <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/30 px-3 py-1 rounded-xl text-xs">
            <span className="font-semibold text-blue-400">{selectedTaskIds.size} selected</span>
            <span className="text-slate-600">|</span>
            <button
              onClick={() => handleBulkStatusChange("done")}
              className="px-2 py-0.5 bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 rounded text-[11px] font-semibold transition-colors"
            >
              Mark Done
            </button>
            <button
              onClick={() => handleBulkStatusChange("submitted_for_review")}
              className="px-2 py-0.5 bg-amber-600/30 hover:bg-amber-600/50 text-amber-300 rounded text-[11px] font-semibold transition-colors"
            >
              Submit for Review
            </button>
            <button
              onClick={() => setSelectedTaskIds(new Set())}
              className="text-slate-400 hover:text-white text-[11px]"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Grid Content */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="sticky top-0 bg-slate-900 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px] z-10">
            <tr>
              <th className="p-3 w-10 text-center">
                <input
                  type="checkbox"
                  checked={selectedTaskIds.size === filteredTasks.length && filteredTasks.length > 0}
                  onChange={toggleSelectAll}
                  className="rounded border-slate-700 bg-slate-950 text-blue-600 focus:ring-0 cursor-pointer"
                />
              </th>
              <th className="p-3 w-28 cursor-pointer hover:text-white" onClick={() => {
                setSortField("key");
                setSortOrder(sortOrder === "asc" ? "desc" : "asc");
              }}>
                <div className="flex items-center gap-1">
                  <span>Task ID</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="p-3 cursor-pointer hover:text-white" onClick={() => {
                setSortField("title");
                setSortOrder(sortOrder === "asc" ? "desc" : "asc");
              }}>
                <div className="flex items-center gap-1">
                  <span>Task Summary & SOPs</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="p-3 w-36">Status</th>
              <th className="p-3 w-28">Priority</th>
              <th className="p-3 w-40">Primary Owner</th>
              <th className="p-3 w-36">Strict Due Time</th>
              <th className="p-3 w-24 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-medium">
            {filteredTasks.map((t) => {
              const isSelected = selectedTaskIds.has(t._id);
              return (
                <tr
                  key={t._id}
                  className={`hover:bg-slate-900/60 transition-colors ${
                    isSelected ? "bg-blue-500/5" : ""
                  }`}
                >
                  <td className="p-3 text-center">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelectTask(t._id)}
                      className="rounded border-slate-700 bg-slate-950 text-blue-600 focus:ring-0 cursor-pointer"
                    />
                  </td>
                  <td className="p-3 font-mono font-bold text-blue-400 whitespace-nowrap">
                    <button
                      onClick={() => {
                        setActiveTaskKey(t.key);
                        setIsTaskDrawerOpen(true);
                      }}
                      className="hover:underline flex items-center gap-1"
                    >
                      {t.key}
                      {t.isConfidential && (
                        <Shield className="w-3 h-3 text-rose-400" title="Confidential Task" />
                      )}
                    </button>
                  </td>
                  <td className="p-3 text-white font-semibold">
                    <div
                      className="cursor-pointer hover:text-blue-400 transition-colors truncate max-w-md"
                      onClick={() => {
                        setActiveTaskKey(t.key);
                        setIsTaskDrawerOpen(true);
                      }}
                    >
                      {t.title}
                    </div>
                    {t.subtasks?.length > 0 && (
                      <span className="text-[10px] text-slate-500 block font-normal">
                        SOP Checklist: {t.subtasks.filter((s) => s.completed).length}/
                        {t.subtasks.length} items complete
                      </span>
                    )}
                  </td>
                  <td className="p-3">
                    <select
                      value={t.status}
                      onChange={(e) => handleQuickStatusChange(t._id, e.target.value)}
                      className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
                    >
                      <option value="todo">To Do</option>
                      <option value="in_progress">In Progress</option>
                      <option value="submitted_for_review">Submitted for Review</option>
                      <option value="redo_requested">Revision Requested</option>
                      <option value="done">Completed</option>
                    </select>
                  </td>
                  <td className="p-3">
                    <select
                      value={t.priority}
                      onChange={(e) => handleQuickPriorityChange(t._id, e.target.value)}
                      className={`bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs focus:outline-none cursor-pointer ${
                        t.priority === "urgent"
                          ? "text-rose-400 font-bold"
                          : t.priority === "high"
                          ? "text-amber-400 font-bold"
                          : "text-slate-300"
                      }`}
                    >
                      <option value="urgent">Urgent</option>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </td>
                  <td className="p-3 text-slate-300">
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] text-slate-300 font-bold">
                        {t.assignee?.name?.[0] || "?"}
                      </div>
                      <span className="truncate max-w-[120px]">{t.assignee?.name || "Unassigned"}</span>
                    </div>
                  </td>
                  <td className="p-3 text-slate-400 font-mono text-[11px]">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-500" />
                      <span>{t.dueTime || "End of Day"}</span>
                      {t.dueDate && (
                        <span className="text-slate-500">
                          ({new Date(t.dueDate).toLocaleDateString([], { month: "short", day: "numeric" })})
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-3 text-center">
                    <button
                      onClick={() => {
                        setActiveTaskKey(t.key);
                        setIsTaskDrawerOpen(true);
                      }}
                      className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] transition-colors"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filteredTasks.length === 0 && !loading && (
          <div className="text-center py-16 text-slate-500 space-y-2">
            <CheckSquare className="w-8 h-8 mx-auto text-slate-600" />
            <p className="text-xs">No tasks found matching your filters</p>
          </div>
        )}
      </div>

      {/* Task Drawer */}
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
