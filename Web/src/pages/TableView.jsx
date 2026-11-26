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
import { subscribeRealtimeEvents } from "../services/socket";
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
import { getGlassTokens } from "../styles/glassTheme";

export default function TableView() {
  const { activeProject, theme, setIsCreateTaskModalOpen } = useApp();
  const isDark = theme === "dark";
  const g = getGlassTokens(isDark);

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
    return subscribeRealtimeEvents(
      ["task:created", "task:created_global", "task:updated", "task:status_changed", "task:deleted", "project:updated"],
      () => loadTasks()
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        isDark ? "text-slate-200" : "text-slate-800"
      }`}
    >
      {/* Top Sub-Header */}
      <div
        className={`px-6 py-3.5 border-b flex flex-wrap items-center justify-between gap-3 shrink-0 ${g.subHeader}`}
      >
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl border flex items-center justify-center ${g.badge}`}>
            <TableIcon className="w-4 h-4" />
          </div>
          <div>
            <h1 className={`text-sm sm:text-base font-bold tracking-tight flex items-center gap-2 ${g.heading}`}>
              <span>Operational Grid View</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-mono border ${g.badge}`}>
                {filteredTasks.length} tasks
              </span>
            </h1>
            <p className={`text-xs ${g.muted}`}>
              {activeProject ? `[${activeProject.prefix}] ${activeProject.name}` : "All Workspaces"} • Task register & CSV export
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadTasks}
            className={`p-2 rounded-full border transition-colors cursor-pointer ${g.iconBtn}`}
            title="Refresh Grid"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>

          <button
            onClick={handleExportCSV}
            className={`px-3.5 py-2 rounded-full font-semibold text-xs border transition-colors flex items-center gap-1.5 cursor-pointer ${g.btnSecondary}`}
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>

          <button
            onClick={() => setIsCreateTaskModalOpen(true)}
            className={`px-3.5 py-2 rounded-full font-semibold text-xs flex items-center gap-1.5 cursor-pointer ${g.btnPrimary}`}
          >
            <Plus className="w-3.5 h-3.5" /> Add Task
          </button>
        </div>
      </div>

      {/* Filter & Bulk Actions Bar */}
      <div
        className={`px-6 py-2.5 border-b flex flex-wrap items-center justify-between gap-3 shrink-0 ${g.subtleSurface}`}
      >
        <div className="flex items-center gap-2 flex-1 min-w-[240px] flex-wrap">
          <div className="relative flex-1 max-w-xs min-w-[180px]">
            <Search className={`w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 ${g.muted}`} />
            <input
              type="text"
              placeholder="Search tasks, keys, owners..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-8 pr-3 py-1.5 rounded-full border text-xs focus:outline-none ${g.input}`}
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={`px-3 py-1.5 rounded-full border text-xs font-medium focus:outline-none cursor-pointer ${g.input}`}
          >
            <option value="all" className={isDark ? "bg-[#14151a] text-white" : "bg-white text-slate-900"}>All Statuses</option>
            <option value="todo" className={isDark ? "bg-[#14151a] text-white" : "bg-white text-slate-900"}>To Do</option>
            <option value="in_progress" className={isDark ? "bg-[#14151a] text-white" : "bg-white text-slate-900"}>In Progress</option>
            <option value="review" className={isDark ? "bg-[#14151a] text-white" : "bg-white text-slate-900"}>In Review</option>
            <option value="submitted_for_review" className={isDark ? "bg-[#14151a] text-white" : "bg-white text-slate-900"}>Submitted for Review</option>
            <option value="redo_requested" className={isDark ? "bg-[#14151a] text-white" : "bg-white text-slate-900"}>Revision Requested</option>
            <option value="done" className={isDark ? "bg-[#14151a] text-white" : "bg-white text-slate-900"}>Completed</option>
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className={`px-3 py-1.5 rounded-full border text-xs font-medium focus:outline-none cursor-pointer ${g.input}`}
          >
            <option value="all" className={isDark ? "bg-[#14151a] text-white" : "bg-white text-slate-900"}>All Priorities</option>
            <option value="urgent" className={isDark ? "bg-[#14151a] text-white" : "bg-white text-slate-900"}>Urgent</option>
            <option value="high" className={isDark ? "bg-[#14151a] text-white" : "bg-white text-slate-900"}>High</option>
            <option value="medium" className={isDark ? "bg-[#14151a] text-white" : "bg-white text-slate-900"}>Medium</option>
            <option value="low" className={isDark ? "bg-[#14151a] text-white" : "bg-white text-slate-900"}>Low</option>
          </select>
        </div>

        {selectedTaskIds.size > 0 && (
          <div className={`flex items-center gap-2 border px-3 py-1 rounded-full text-xs ${g.badge}`}>
            <span className="font-semibold">{selectedTaskIds.size} selected</span>
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
              className={`${g.muted} hover:text-current text-[11px] cursor-pointer`}
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
            className={`sticky top-0 border-b font-bold uppercase tracking-wider text-[10px] z-10 ${g.subHeader} ${g.muted}`}
          >
            <tr>
              <th className="p-3.5 w-10 text-center">
                <input
                  type="checkbox"
                  checked={selectedTaskIds.size === filteredTasks.length && filteredTasks.length > 0}
                  onChange={toggleSelectAll}
                  className="rounded accent-zinc-500 cursor-pointer"
                />
              </th>
              <th
                className="p-3.5 w-28 cursor-pointer hover:text-current"
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
                className="p-3.5 cursor-pointer hover:text-current"
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
                className="p-3.5 w-44 cursor-pointer hover:text-current"
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
                    isSelected ? g.selectedRow : g.rowHover
                  }`}
                >
                  <td className="p-3.5 text-center">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelectTask(t._id)}
                      className="rounded accent-zinc-500 cursor-pointer"
                    />
                  </td>
                  <td className={`p-3.5 font-mono font-bold whitespace-nowrap ${g.heading}`}>
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
                  <td className={`p-3.5 font-semibold ${g.heading}`}>
                    <div
                      className="cursor-pointer hover:underline transition-colors truncate max-w-md"
                      onClick={() => setActiveTaskKey(t.key || t._id)}
                    >
                      {t.title}
                    </div>
                    {t.subtasks?.length > 0 && (
                      <span className={`text-[10px] block font-normal mt-0.5 ${g.muted}`}>
                        Checklist: {t.subtasks.filter((s) => s.completed).length}/{t.subtasks.length} items complete
                      </span>
                    )}
                  </td>
                  <td className="p-3.5">
                    <select
                      value={t.status}
                      onChange={(e) => handleQuickStatusChange(t._id, e.target.value)}
                      className={`border rounded-xl px-2.5 py-1 text-xs focus:outline-none cursor-pointer ${g.input}`}
                    >
                      <option value="todo" className={isDark ? "bg-[#14151a] text-white" : "bg-white text-slate-900"}>To Do</option>
                      <option value="in_progress" className={isDark ? "bg-[#14151a] text-white" : "bg-white text-slate-900"}>In Progress</option>
                      <option value="review" className={isDark ? "bg-[#14151a] text-white" : "bg-white text-slate-900"}>In Review</option>
                      <option value="submitted_for_review" className={isDark ? "bg-[#14151a] text-white" : "bg-white text-slate-900"}>Submitted for Review</option>
                      <option value="redo_requested" className={isDark ? "bg-[#14151a] text-white" : "bg-white text-slate-900"}>Revision Requested</option>
                      <option value="done" className={isDark ? "bg-[#14151a] text-white" : "bg-white text-slate-900"}>Completed</option>
                    </select>
                  </td>
                  <td className="p-3.5">
                    <select
                      value={t.priority}
                      onChange={(e) => handleQuickPriorityChange(t._id, e.target.value)}
                      className={`border rounded-xl px-2.5 py-1 text-xs focus:outline-none cursor-pointer ${g.input} ${
                        t.priority === "urgent"
                          ? "text-rose-500 font-bold"
                          : t.priority === "high"
                          ? "text-amber-500 font-bold"
                          : ""
                      }`}
                    >
                      <option value="urgent" className={isDark ? "bg-[#14151a] text-white" : "bg-white text-slate-900"}>Urgent</option>
                      <option value="high" className={isDark ? "bg-[#14151a] text-white" : "bg-white text-slate-900"}>High</option>
                      <option value="medium" className={isDark ? "bg-[#14151a] text-white" : "bg-white text-slate-900"}>Medium</option>
                      <option value="low" className={isDark ? "bg-[#14151a] text-white" : "bg-white text-slate-900"}>Low</option>
                    </select>
                  </td>
                  <td className="p-3.5">
                    {(() => {
                      const list =
                        Array.isArray(t.assignees) && t.assignees.length > 0
                          ? t.assignees
                          : t.assignee
                            ? [t.assignee]
                            : [];
                      const depts = Array.isArray(t.assignedDepartments) ? t.assignedDepartments : [];
                      if (list.length === 0 && depts.length === 0) {
                        return (
                          <div className="flex items-center gap-2">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${g.badge}`}>
                              ?
                            </div>
                            <span className={`truncate max-w-[130px] ${g.heading}`}>{ownerName}</span>
                          </div>
                        );
                      }
                      return (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {list.length > 0 && (
                            <div className="flex items-center -space-x-1.5">
                              {list.slice(0, 3).map((u) => (
                                <UserAvatar
                                  key={u._id || u}
                                  user={u}
                                  className="w-6 h-6 rounded-full border border-white/20"
                                  textClass="text-[9px]"
                                />
                              ))}
                              {list.length > 3 && (
                                <span className={`pl-2 text-[10px] font-mono ${g.muted}`}>+{list.length - 3}</span>
                              )}
                            </div>
                          )}
                          {list.length === 1 && (
                            <span className={`truncate max-w-[100px] ${g.heading}`}>{getDisplayName(list[0])}</span>
                          )}
                          {depts.map((d) => (
                            <span
                              key={d._id || d}
                              className={`px-1.5 py-0.5 rounded border text-[9px] font-mono font-bold ${g.badge}`}
                            >
                              {d.code || d.name}
                            </span>
                          ))}
                        </div>
                      );
                    })()}
                  </td>
                  <td className={`p-3.5 font-mono text-[11px] ${g.muted}`}>
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3 h-3 shrink-0" />
                      <span>{t.dueDate ? formatDateIN(t.dueDate, { day: "2-digit", month: "short" }) : "No date"}</span>
                      {t.dueTime && <span className="opacity-75">{t.dueTime}</span>}
                    </div>
                  </td>
                  <td className="p-3.5 text-center">
                    <button
                      onClick={() => setActiveTaskKey(t.key || t._id)}
                      className={`px-3 py-1 rounded-xl text-[11px] font-semibold transition-colors cursor-pointer ${g.btnSecondary}`}
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
