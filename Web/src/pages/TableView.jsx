import React, { useState, useEffect, useMemo } from "react";
import {
  Table as TableIcon,
  Search,
  CheckSquare,
  Clock,
  Shield,
  RotateCcw,
  Download,
  ArrowUpDown,
  Plus,
  RefreshCw,
} from "lucide-react";
import { useApp } from "../context/Appcontext";
import {
  getTasks,
  updateTaskStatus,
  updateTask,
  bulkUpdateTasks,
} from "../services/api";
import TaskDrawer from "../components/task/TaskDrawer";
import UserAvatar from "../components/common/UserAvatar";
import { getDisplayName, getInitials, formatDateIN } from "../utils/formatters";
import toast from "react-hot-toast";

export default function TableView() {
  const { activeProject, theme, setIsCreateTaskModalOpen } = useApp();
  const isDark = theme === "dark";

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [selectedTaskIds, setSelectedTaskIds] = useState(new Set());
  const [activeTaskKey, setActiveTaskKey] = useState(null);
  const [sortField, setSortField] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState("desc");

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

  // Filtering & Sorting
  const filteredTasks = useMemo(() => {
    return tasks
      .filter((t) => {
        const assigneeName = getDisplayName(t.assignee, "");
        const q = searchQuery.toLowerCase();
        const matchesSearch =
          !q ||
          t.title?.toLowerCase().includes(q) ||
          t.key?.toLowerCase().includes(q) ||
          assigneeName.toLowerCase().includes(q);

        const matchesStatus = statusFilter === "all" || t.status === statusFilter;
        const matchesPriority = priorityFilter === "all" || t.priority === priorityFilter;

        return matchesSearch && matchesStatus && matchesPriority;
      })
      .sort((a, b) => {
        let valA = a[sortField];
        let valB = b[sortField];
        if (sortField === "assignee") {
          valA = getDisplayName(a.assignee, "");
          valB = getDisplayName(b.assignee, "");
        }
        if ((valA || "") < (valB || "")) return sortOrder === "asc" ? -1 : 1;
        if ((valA || "") > (valB || "")) return sortOrder === "asc" ? 1 : -1;
        return 0;
      });
  }, [tasks, searchQuery, statusFilter, priorityFilter, sortField, sortOrder]);

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

  const handleQuickStatusChange = async (taskId, newStatus) => {
    const res = await updateTaskStatus(taskId, newStatus);
    if (res.success) {
      setTasks((prev) =>
        prev.map((t) => (t._id === taskId ? { ...t, status: newStatus } : t))
      );
      toast.success("Status updated");
    } else {
      toast.error("Failed to update status");
    }
  };

  const handleQuickPriorityChange = async (taskId, newPriority) => {
    const res = await updateTask(taskId, { priority: newPriority });
    if (res.success) {
      setTasks((prev) =>
        prev.map((t) => (t._id === taskId ? { ...t, priority: newPriority } : t))
      );
      toast.success("Priority updated");
    } else {
      toast.error("Failed to update priority");
    }
  };

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

  const handleExportCSV = () => {
    const headers = ["Key", "Title", "Status", "Priority", "Assignee", "Due Date", "Due Time"];
    const rows = filteredTasks.map((t) => [
      t.key,
      `"${(t.title || "").replace(/"/g, '""')}"`,
      t.status,
      t.priority,
      getDisplayName(t.assignee, "Unassigned"),
      t.dueDate ? formatDateIN(t.dueDate) : "None",
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
            <TableIcon className="w-4 h-4" />
          </div>
          <div>
            <h1 className={`text-sm sm:text-base font-bold tracking-tight flex items-center gap-2 ${isDark ? "text-white" : "text-slate-900"}`}>
              <span>Operational Grid View</span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-mono border ${
                  isDark ? "bg-white/5 border-white/10 text-slate-300" : "bg-slate-100 border-slate-200 text-slate-700"
                }`}
              >
                {filteredTasks.length} tasks
              </span>
            </h1>
            <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              {activeProject ? `[${activeProject.prefix}] ${activeProject.name}` : "All Workspaces"} • Task register & CSV export
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadTasks}
            className={`p-2 rounded-full border transition-colors cursor-pointer ${
              isDark
                ? "bg-white/5 hover:bg-white/10 border-white/10 text-slate-300"
                : "bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700"
            }`}
            title="Refresh Grid"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-indigo-400" : ""}`} />
          </button>

          <button
            onClick={handleExportCSV}
            className={`px-3.5 py-2 rounded-full font-semibold text-xs border transition-colors flex items-center gap-1.5 cursor-pointer ${
              isDark
                ? "bg-white/5 hover:bg-white/10 border-white/10 text-slate-200"
                : "bg-white hover:bg-slate-100 border-slate-200 text-slate-700 shadow-xs"
            }`}
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>

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

      {/* Filter & Bulk Actions Bar */}
      <div
        className={`px-6 py-2.5 border-b flex flex-wrap items-center justify-between gap-3 shrink-0 ${
          isDark ? "bg-[#12131a] border-white/10" : "bg-white/70 border-slate-200"
        }`}
      >
        <div className="flex items-center gap-2 flex-1 min-w-[240px] flex-wrap">
          <div className="relative flex-1 max-w-xs min-w-[180px]">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search tasks, keys, owners..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-8 pr-3 py-1.5 rounded-full border text-xs focus:outline-none focus:border-indigo-500 ${
                isDark
                  ? "bg-[#181924] border-white/10 text-white placeholder-slate-500"
                  : "bg-white border-slate-200 text-slate-900 placeholder-slate-400"
              }`}
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={`px-3 py-1.5 rounded-full border text-xs font-medium focus:outline-none cursor-pointer ${
              isDark
                ? "bg-[#181924] border-white/10 text-slate-300"
                : "bg-white border-slate-200 text-slate-700"
            }`}
          >
            <option value="all">All Statuses</option>
            <option value="todo">To Do</option>
            <option value="in_progress">In Progress</option>
            <option value="review">In Review</option>
            <option value="submitted_for_review">Submitted for Review</option>
            <option value="redo_requested">Revision Requested</option>
            <option value="done">Completed</option>
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className={`px-3 py-1.5 rounded-full border text-xs font-medium focus:outline-none cursor-pointer ${
              isDark
                ? "bg-[#181924] border-white/10 text-slate-300"
                : "bg-white border-slate-200 text-slate-700"
            }`}
          >
            <option value="all">All Priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>

        {selectedTaskIds.size > 0 && (
          <div className="flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/30 px-3 py-1 rounded-full text-xs">
            <span className="font-semibold text-indigo-400">{selectedTaskIds.size} selected</span>
            <button
              onClick={() => handleBulkStatusChange("done")}
              className="px-2.5 py-0.5 bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-400 rounded-full text-[11px] font-semibold cursor-pointer"
            >
              Mark Done
            </button>
            <button
              onClick={() => handleBulkStatusChange("submitted_for_review")}
              className="px-2.5 py-0.5 bg-amber-600/30 hover:bg-amber-600/50 text-amber-400 rounded-full text-[11px] font-semibold cursor-pointer"
            >
              Submit for Review
            </button>
            <button
              onClick={() => setSelectedTaskIds(new Set())}
              className="text-slate-400 hover:text-white text-[11px] cursor-pointer"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Grid Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead
            className={`sticky top-0 border-b font-bold uppercase tracking-wider text-[10px] z-10 ${
              isDark
                ? "bg-[#14151c] border-white/10 text-slate-400"
                : "bg-slate-100 border-slate-200 text-slate-600"
            }`}
          >
            <tr>
              <th className="p-3.5 w-10 text-center">
                <input
                  type="checkbox"
                  checked={selectedTaskIds.size === filteredTasks.length && filteredTasks.length > 0}
                  onChange={toggleSelectAll}
                  className="rounded accent-indigo-600 cursor-pointer"
                />
              </th>
              <th
                className="p-3.5 w-28 cursor-pointer hover:text-indigo-400"
                onClick={() => {
                  setSortField("key");
                  setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                }}
              >
                <div className="flex items-center gap-1">
                  <span>Task ID</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th
                className="p-3.5 cursor-pointer hover:text-indigo-400"
                onClick={() => {
                  setSortField("title");
                  setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                }}
              >
                <div className="flex items-center gap-1">
                  <span>Task Summary</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="p-3.5 w-44">Status</th>
              <th className="p-3.5 w-32">Priority</th>
              <th
                className="p-3.5 w-44 cursor-pointer hover:text-indigo-400"
                onClick={() => {
                  setSortField("assignee");
                  setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                }}
              >
                <div className="flex items-center gap-1">
                  <span>Primary Owner</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="p-3.5 w-40">Due Date</th>
              <th className="p-3.5 w-24 text-center">Actions</th>
            </tr>
          </thead>

          <tbody className={`divide-y font-medium ${isDark ? "divide-white/5" : "divide-slate-200"}`}>
            {filteredTasks.map((t) => {
              const isSelected = selectedTaskIds.has(t._id);
              const ownerName = getDisplayName(t.assignee, "Unassigned");
              return (
                <tr
                  key={t._id}
                  className={`transition-colors ${
                    isSelected
                      ? "bg-indigo-500/10"
                      : isDark
                      ? "hover:bg-white/[0.03]"
                      : "hover:bg-slate-100/70 bg-white"
                  }`}
                >
                  <td className="p-3.5 text-center">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelectTask(t._id)}
                      className="rounded accent-indigo-600 cursor-pointer"
                    />
                  </td>
                  <td className="p-3.5 font-mono font-bold text-indigo-400 whitespace-nowrap">
                    <button
                      onClick={() => setActiveTaskKey(t.key || t._id)}
                      className="hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      {t.key}
                      {t.isConfidential && (
                        <Shield className="w-3 h-3 text-rose-400" title="Confidential Task" />
                      )}
                    </button>
                  </td>
                  <td className={`p-3.5 font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                    <div
                      className="cursor-pointer hover:text-indigo-400 transition-colors truncate max-w-md"
                      onClick={() => setActiveTaskKey(t.key || t._id)}
                    >
                      {t.title}
                    </div>
                    {t.subtasks?.length > 0 && (
                      <span className="text-[10px] text-slate-400 block font-normal mt-0.5">
                        Checklist: {t.subtasks.filter((s) => s.completed).length}/{t.subtasks.length} items complete
                      </span>
                    )}
                  </td>
                  <td className="p-3.5">
                    <select
                      value={t.status}
                      onChange={(e) => handleQuickStatusChange(t._id, e.target.value)}
                      className={`border rounded-xl px-2.5 py-1 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer ${
                        isDark
                          ? "bg-[#181924] border-white/10 text-slate-200"
                          : "bg-slate-50 border-slate-200 text-slate-800"
                      }`}
                    >
                      <option value="todo">To Do</option>
                      <option value="in_progress">In Progress</option>
                      <option value="review">In Review</option>
                      <option value="submitted_for_review">Submitted for Review</option>
                      <option value="redo_requested">Revision Requested</option>
                      <option value="done">Completed</option>
                    </select>
                  </td>
                  <td className="p-3.5">
                    <select
                      value={t.priority}
                      onChange={(e) => handleQuickPriorityChange(t._id, e.target.value)}
                      className={`border rounded-xl px-2.5 py-1 text-xs focus:outline-none cursor-pointer ${
                        isDark ? "bg-[#181924] border-white/10" : "bg-slate-50 border-slate-200"
                      } ${
                        t.priority === "urgent"
                          ? "text-rose-500 font-bold"
                          : t.priority === "high"
                          ? "text-amber-500 font-bold"
                          : isDark
                          ? "text-slate-300"
                          : "text-slate-700"
                      }`}
                    >
                      <option value="urgent">Urgent</option>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </td>
                  <td className="p-3.5">
                    <div className="flex items-center gap-2">
                      {t.assignee ? (
                        <UserAvatar
                          user={t.assignee}
                          className="w-6 h-6 rounded-full border border-white/10"
                          textClass="text-[10px]"
                        />
                      ) : (
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                            isDark ? "bg-white/10 text-slate-300" : "bg-slate-200 text-slate-700"
                          }`}
                        >
                          ?
                        </div>
                      )}
                      <span className={`truncate max-w-[130px] ${isDark ? "text-slate-200" : "text-slate-800"}`}>
                        {ownerName}
                      </span>
                    </div>
                  </td>
                  <td className="p-3.5 text-slate-400 font-mono text-[11px]">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                      <span>{t.dueDate ? formatDateIN(t.dueDate, { day: "2-digit", month: "short" }) : "No date"}</span>
                      {t.dueTime && <span className="opacity-75">{t.dueTime}</span>}
                    </div>
                  </td>
                  <td className="p-3.5 text-center">
                    <button
                      onClick={() => setActiveTaskKey(t.key || t._id)}
                      className={`px-3 py-1 rounded-xl text-[11px] font-semibold transition-colors cursor-pointer ${
                        isDark
                          ? "bg-white/5 hover:bg-indigo-600 text-slate-300 hover:text-white"
                          : "bg-slate-100 hover:bg-indigo-600 text-slate-700 hover:text-white"
                      }`}
                    >
                      Open
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filteredTasks.length === 0 && !loading && (
          <div className="text-center py-16 text-slate-500 space-y-2">
            <CheckSquare className="w-8 h-8 mx-auto opacity-60" />
            <p className="text-xs font-semibold">No tasks found matching your filters</p>
          </div>
        )}
      </div>

      {/* Task Drawer */}
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
