import React, { useState, useEffect, useRef } from "react";
import { useApp } from "../../context/Appcontext";
import {
  getTaskDetails,
  updateTask,
  updateTaskStatus,
  addWorkLog,
  addSubtask,
  toggleSubtask,
  deleteSubtask,
  uploadTaskAttachment,
  addComment,
  deleteTask,
  submitTaskForReview,
  approveTask,
  requestTaskRevision,
} from "../../services/api";
import { getSocket } from "../../services/socket";
import UserAvatar from "../common/UserAvatar";
import { getGlassTokens } from "../../styles/glassTheme";
import { formatDateIN, formatTimeIN, formatFileSize, getDisplayName } from "../../utils/formatters";
import {
  X,
  Paperclip,
  MessageSquare,
  History,
  Send,
  Trash2,
  Copy,
  Check,
  Upload,
  Shield,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  FileText,
  Repeat,
  Download,
  Plus,
} from "lucide-react";
import toast from "react-hot-toast";
import AssignmentSelector from "./AssignmentSelector";

export default function TaskDrawer({ taskKeyOrId, onClose, onTaskUpdated }) {
  const { user, teamMembers, departments, projects, isSuperAdmin, hasPermission, theme } = useApp();
  const isDark = theme === "dark";
  const canAssignTask = isSuperAdmin || hasPermission("tasks.assign");

  const [task, setTask] = useState(null);
  const [comments, setComments] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState("comments");
  const [commentText, setCommentText] = useState("");
  const [mentionSuggestions, setMentionSuggestions] = useState([]);

  const [showLogWork, setShowLogWork] = useState(false);
  const [logHours, setLogHours] = useState("");
  const [logNote, setLogNote] = useState("");

  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [copiedKey, setCopiedKey] = useState(false);
  const [showRedoModal, setShowRedoModal] = useState(false);
  const [redoFeedback, setRedoFeedback] = useState("");

  const fileInputRef = useRef(null);

  useEffect(() => {
    const onEscape = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    const onCloseAll = (e) => {
      if (e?.detail?.except !== "task") onClose?.();
    };
    window.addEventListener("keydown", onEscape);
    window.addEventListener("lira:close-all-sidebars", onCloseAll);
    return () => {
      window.removeEventListener("keydown", onEscape);
      window.removeEventListener("lira:close-all-sidebars", onCloseAll);
    };
  }, [onClose]);

  useEffect(() => {
    if (!taskKeyOrId) return;
    setLoading(true);
    const loadTask = async () => {
      const res = await getTaskDetails(taskKeyOrId);
      if (res.success) {
        setTask(res.task);
        setComments(res.comments);
        setHistory(res.history);
      }
      setLoading(false);
    };
    loadTask();
  }, [taskKeyOrId]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket || !task?._id) return;

    const handleTaskUpdated = (updated) => {
      if (updated._id === task._id) setTask(updated);
    };
    const handleCommentNew = ({ taskId, comment }) => {
      if (taskId === task._id) setComments((prev) => [...prev, comment]);
    };
    const handleActivityNew = (activity) => {
      if (activity.task === task._id || activity.task?._id === task._id) {
        setHistory((prev) => [activity, ...prev]);
      }
    };

    socket.on("task:updated", handleTaskUpdated);
    socket.on("comment:new", handleCommentNew);
    socket.on("activity:new", handleActivityNew);

    return () => {
      socket.off("task:updated", handleTaskUpdated);
      socket.off("comment:new", handleCommentNew);
      socket.off("activity:new", handleActivityNew);
    };
  }, [task?._id]);

  if (!taskKeyOrId) return null;

  const handleCopyKey = () => {
    if (!task) return;
    navigator.clipboard.writeText(task.key);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 1800);
  };

  const handleSubmitForReview = async () => {
    const res = await submitTaskForReview(task._id);
    if (res.success) {
      setTask(res.task);
      onTaskUpdated?.(res.task);
    }
  };

  const handleApprove = async () => {
    const res = await approveTask(task._id);
    if (res.success) {
      setTask(res.task);
      onTaskUpdated?.(res.task);
    }
  };

  const handleRequestRedo = async () => {
    if (!redoFeedback.trim()) {
      toast.error("Please enter revision notes for the assignee");
      return;
    }
    const res = await requestTaskRevision(task._id, redoFeedback);
    if (res.success) {
      setTask(res.task);
      setShowRedoModal(false);
      setRedoFeedback("");
      onTaskUpdated?.(res.task);
    }
  };

  const handleStatusChange = async (newStatus) => {
    const res = await updateTaskStatus(task._id, newStatus);
    if (res.success) {
      setTask(res.task);
      onTaskUpdated?.(res.task);
    }
  };

  const handleAssigneesChange = async (newAssignees) => {
    const res = await updateTask(task._id, {
      assignee: newAssignees[0] || null,
      assignees: newAssignees,
    });
    if (res.success) {
      setTask(res.task);
      onTaskUpdated?.(res.task);
    }
  };

  const handleAssignedDepartmentsChange = async (newDeptIds) => {
    const res = await updateTask(task._id, { assignedDepartments: newDeptIds });
    if (res.success) {
      setTask(res.task);
      onTaskUpdated?.(res.task);
    }
  };

  const handlePriorityChange = async (newPriority) => {
    const res = await updateTask(task._id, { priority: newPriority });
    if (res.success) {
      setTask(res.task);
      onTaskUpdated?.(res.task);
    }
  };

  const handleDueDateChange = async (newDate) => {
    const res = await updateTask(task._id, { dueDate: newDate || null });
    if (res.success) {
      setTask(res.task);
      onTaskUpdated?.(res.task);
    }
  };

  const handleEstimatedHoursChange = async (hours) => {
    const res = await updateTask(task._id, { estimatedHours: Number(hours) || 0 });
    if (res.success) {
      setTask(res.task);
      onTaskUpdated?.(res.task);
    }
  };

  const handleLogWorkSubmit = async (e) => {
    e.preventDefault();
    if (!logHours || parseFloat(logHours) <= 0) {
      toast.error("Please enter valid hours");
      return;
    }
    const res = await addWorkLog(task._id, logHours, logNote);
    if (res.success) {
      setTask(res.task);
      setLogHours("");
      setLogNote("");
      setShowLogWork(false);
      onTaskUpdated?.(res.task);
    }
  };

  const handleAddSubtask = async (e) => {
    e.preventDefault();
    if (!newSubtaskTitle.trim()) return;
    const res = await addSubtask(task._id, newSubtaskTitle.trim());
    if (res.success) {
      setTask((prev) => ({ ...prev, subtasks: res.subtasks }));
      setNewSubtaskTitle("");
    }
  };

  const handleToggleSubtask = async (subtaskId) => {
    const res = await toggleSubtask(task._id, subtaskId);
    if (res.success) {
      setTask((prev) => ({ ...prev, subtasks: res.subtasks }));
    }
  };

  const handleDeleteSubtask = async (subtaskId) => {
    const res = await deleteSubtask(task._id, subtaskId);
    if (res.success) {
      setTask((prev) => ({ ...prev, subtasks: res.subtasks }));
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const toastId = toast.loading("Uploading attachment...");
    const res = await uploadTaskAttachment(task._id, file);
    if (res.success) {
      setTask((prev) => ({ ...prev, attachments: res.attachments }));
      toast.success("Attachment added", { id: toastId });
    } else {
      toast.error("Failed to upload file", { id: toastId });
    }
    e.target.value = "";
  };

  const handleCommentChange = (e) => {
    const text = e.target.value;
    setCommentText(text);
    const words = text.split(" ");
    const lastWord = words[words.length - 1];
    if (lastWord.startsWith("@") && lastWord.length > 1) {
      const query = lastWord.slice(1).toLowerCase();
      setMentionSuggestions(
        teamMembers.filter((m) => m.fullname?.toLowerCase().includes(query))
      );
    } else {
      setMentionSuggestions([]);
    }
  };

  const handleSelectMention = (member) => {
    const words = commentText.split(" ");
    words[words.length - 1] = `@${member.fullname} `;
    setCommentText(words.join(" "));
    setMentionSuggestions([]);
  };

  const handlePostComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    const res = await addComment(task._id, commentText);
    if (res.success) {
      setComments((prev) => [...prev, res.comment]);
      setCommentText("");
    }
  };

  const handleDeleteTask = async () => {
    if (!window.confirm(`Delete task ${task.key}? This action cannot be undone.`)) return;
    const res = await deleteTask(task._id);
    if (res.success) {
      onClose();
      onTaskUpdated?.();
    }
  };

  const totalSubtasks = task?.subtasks?.length || 0;
  const completedSubtasks = task?.subtasks?.filter((s) => s.completed).length || 0;
  const subtaskProgress =
    totalSubtasks > 0 ? Math.round((completedSubtasks / totalSubtasks) * 100) : 0;

  const g = getGlassTokens(isDark);
  const surfaceBg = g.drawer;
  const subtleBg = g.subtleSurface;
  const borderCol = g.border;
  const mutedText = g.muted;
  const inputBase = `w-full text-xs font-medium rounded-lg px-2.5 py-1.5 border focus:outline-none transition-colors ${g.input}`;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
      {/* Subtle Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/45 backdrop-blur-[2px] transition-opacity animate-in fade-in duration-150"
      />

      {/* Minimal Slide-over Drawer */}
      <div
        className={`relative w-full max-w-3xl shadow-2xl h-full flex flex-col z-10 animate-in slide-in-from-right duration-200 border-l ${surfaceBg} ${borderCol} ${
          isDark ? "text-slate-100" : "text-slate-900"
        }`}
      >
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 gap-3">
            <div className="w-7 h-7 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <p className={`text-xs ${mutedText}`}>Loading task...</p>
          </div>
        ) : !task ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <p className={`text-sm font-medium ${mutedText}`}>Task not found.</p>
            <button
              onClick={onClose}
              className={`mt-4 px-4 py-1.5 rounded-lg text-xs font-medium border ${borderCol}`}
            >
              Close
            </button>
          </div>
        ) : (
          <>
            {/* Minimal Header */}
            <div className={`px-6 py-3.5 border-b flex items-center justify-between shrink-0 ${borderCol}`}>
              <div className="flex items-center gap-2">
                <span
                  className={`font-mono text-xs font-semibold px-2.5 py-1 rounded-md border ${
                    isDark
                      ? "bg-white/[0.04] border-white/[0.08] text-slate-200"
                      : "bg-slate-100 border-slate-200 text-slate-800"
                  }`}
                >
                  {task.key}
                </span>

                <button
                  onClick={handleCopyKey}
                  className={`p-1.5 rounded-md transition-colors cursor-pointer ${mutedText} hover:text-indigo-400`}
                  title="Copy Task Key"
                >
                  {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>

                <div className={`h-4 w-px mx-1 ${isDark ? "bg-white/10" : "bg-slate-200"}`} />

                <select
                  value={task.status}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  className={`text-xs font-semibold rounded-lg px-2.5 py-1 border cursor-pointer focus:outline-none ${
                    isDark
                      ? "bg-[#151720] border-white/[0.08] text-slate-200"
                      : "bg-slate-50 border-slate-200 text-slate-800"
                  }`}
                >
                  <option value="todo">To Do</option>
                  <option value="in_progress">In Progress</option>
                  <option value="review">In Review</option>
                  <option value="submitted_for_review">Submitted for Review</option>
                  <option value="redo_requested">Revision Requested</option>
                  <option value="done">Done</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                {(task.status === "in_progress" ||
                  task.status === "todo" ||
                  task.status === "redo_requested") && (
                  <button
                    onClick={handleSubmitForReview}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                      isDark
                        ? "bg-white text-slate-950 border-white hover:bg-slate-200"
                        : "bg-slate-900 text-white border-slate-900 hover:bg-slate-800"
                    }`}
                  >
                    Submit for Review
                  </button>
                )}

                {(isSuperAdmin ||
                  hasPermission("tasks.delete") ||
                  task.reporter?._id === user?._id) && (
                  <button
                    onClick={handleDeleteTask}
                    className={`p-1.5 rounded-lg transition-colors cursor-pointer ${mutedText} hover:text-rose-500`}
                    title="Delete Task"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}

                <button
                  onClick={onClose}
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${mutedText} hover:text-white`}
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Redo Modal */}
            {showRedoModal && (
              <div
                className={`p-4 border-b text-xs space-y-2.5 ${
                  isDark ? "bg-rose-950/30 border-rose-500/20" : "bg-rose-50 border-rose-200"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-rose-400 flex items-center gap-1.5">
                    <RotateCcw className="w-3.5 h-3.5" /> Revision Feedback
                  </span>
                  <button onClick={() => setShowRedoModal(false)} className={mutedText}>
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <textarea
                  rows={2}
                  value={redoFeedback}
                  onChange={(e) => setRedoFeedback(e.target.value)}
                  placeholder="Describe what needs to be updated..."
                  className={inputBase}
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setShowRedoModal(false)}
                    className={`px-3 py-1 rounded-lg ${mutedText}`}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRequestRedo}
                    className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold"
                  >
                    Send Feedback
                  </button>
                </div>
              </div>
            )}

            {/* Main 2-Column Body */}
            <div className={`flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x ${borderCol}`}>
              {/* Left Canvas */}
              <div className="md:col-span-8 p-6 space-y-6">
                {/* Status Callouts */}
                {task.status === "redo_requested" && (
                  <div
                    className={`p-3 rounded-xl border text-xs space-y-1 ${
                      isDark ? "bg-rose-500/10 border-rose-500/20" : "bg-rose-50 border-rose-200"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-semibold text-rose-500">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>Revision Requested</span>
                    </div>
                    <p className={`pl-5 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                      {task.reviewFeedback || "Please review and resubmit."}
                    </p>
                  </div>
                )}

                {task.status === "submitted_for_review" && (
                  <div
                    className={`p-3 rounded-xl border text-xs flex flex-wrap items-center justify-between gap-2 ${
                      isDark ? "bg-amber-500/10 border-amber-500/20" : "bg-amber-50 border-amber-200"
                    }`}
                  >
                    <span className="font-semibold text-amber-500 flex items-center gap-1.5">
                      <RotateCcw className="w-3.5 h-3.5" />
                      Pending Manager Verification
                    </span>
                    {(isSuperAdmin || hasPermission("tasks.approve")) && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleApprove}
                          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <CheckCircle2 className="w-3 h-3" /> Approve
                        </button>
                        <button
                          onClick={() => setShowRedoModal(true)}
                          className={`px-3 py-1 rounded-lg font-semibold border cursor-pointer ${
                            isDark
                              ? "border-rose-500/30 text-rose-400 hover:bg-rose-500/15"
                              : "border-rose-200 text-rose-600 hover:bg-rose-100"
                          }`}
                        >
                          Request Redo
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Title */}
                <h2 className="text-lg sm:text-xl font-bold leading-snug tracking-tight">
                  {task.title}
                </h2>

                {/* Description */}
                <div className="space-y-1.5">
                  <h3 className={`text-[11px] font-semibold uppercase tracking-wider ${mutedText}`}>
                    Description
                  </h3>
                  <div
                    className={`rounded-xl p-3.5 text-xs sm:text-sm whitespace-pre-wrap leading-relaxed border ${subtleBg} ${borderCol}`}
                  >
                    {task.description || (
                      <span className={`italic ${mutedText}`}>No description provided.</span>
                    )}
                  </div>
                </div>

                {/* Checklist / Subtasks */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h3 className={`text-[11px] font-semibold uppercase tracking-wider ${mutedText}`}>
                      Subtasks ({completedSubtasks}/{totalSubtasks})
                    </h3>
                    {totalSubtasks > 0 && (
                      <span className={`text-xs font-mono ${mutedText}`}>{subtaskProgress}%</span>
                    )}
                  </div>

                  {totalSubtasks > 0 && (
                    <div className={`w-full rounded-full h-1 overflow-hidden ${g.progressTrack}`}>
                      <div
                        className={`h-full transition-all duration-300 ${g.progressFill}`}
                        style={{ width: `${subtaskProgress}%` }}
                      />
                    </div>
                  )}

                  <div className={`divide-y rounded-xl border overflow-hidden ${borderCol} ${isDark ? "divide-white/[0.06]" : "divide-slate-100"}`}>
                    {task.subtasks?.map((st) => (
                      <div
                        key={st._id}
                        className={`flex items-center justify-between px-3 py-2 text-xs group transition-colors ${
                          isDark ? "hover:bg-white/[0.02]" : "hover:bg-slate-50"
                        }`}
                      >
                        <label className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0">
                          <input
                            type="checkbox"
                            checked={st.completed}
                            onChange={() => handleToggleSubtask(st._id)}
                            className="w-3.5 h-3.5 rounded accent-indigo-600 cursor-pointer shrink-0"
                          />
                          <span
                            className={`truncate ${
                              st.completed
                                ? `line-through ${mutedText}`
                                : isDark
                                ? "text-slate-200"
                                : "text-slate-800"
                            }`}
                          >
                            {st.title}
                          </span>
                        </label>
                        <button
                          onClick={() => handleDeleteSubtask(st._id)}
                          className={`opacity-0 group-hover:opacity-100 p-1 rounded transition-opacity cursor-pointer ${mutedText} hover:text-rose-500`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <form onSubmit={handleAddSubtask} className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Add a subtask..."
                      value={newSubtaskTitle}
                      onChange={(e) => setNewSubtaskTitle(e.target.value)}
                      className={inputBase}
                    />
                    <button
                      type="submit"
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer shrink-0 ${
                        isDark
                          ? "bg-white/[0.06] hover:bg-white/10 border-white/10 text-white"
                          : "bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-900"
                      }`}
                    >
                      Add
                    </button>
                  </form>
                </div>

                {/* Attachments */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h3 className={`text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1.5 ${mutedText}`}>
                      <Paperclip className="w-3.5 h-3.5" />
                      <span>Attachments ({task.attachments?.length || 0})</span>
                    </h3>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className={`text-xs font-medium flex items-center gap-1 hover:underline cursor-pointer ${
                        isDark ? "text-indigo-400" : "text-indigo-600"
                      }`}
                    >
                      <Upload className="w-3 h-3" />
                      <span>Upload</span>
                    </button>
                    <input ref={fileInputRef} type="file" onChange={handleFileUpload} className="hidden" />
                  </div>

                  {task.attachments?.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {task.attachments.map((att) => (
                        <a
                          key={att._id}
                          href={att.url}
                          download={att.originalName}
                          target="_blank"
                          rel="noreferrer"
                          className={`flex items-center justify-between gap-2.5 p-2.5 rounded-xl border text-xs group transition-colors ${subtleBg} ${borderCol} hover:border-indigo-500/40`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <FileText className="w-4 h-4 text-indigo-400 shrink-0" />
                            <div className="min-w-0">
                              <p className="font-medium truncate">{att.originalName}</p>
                              <span className={`text-[10px] ${mutedText}`}>
                                {formatFileSize(att.size)} • {getDisplayName(att.uploadedBy, "Staff")}
                              </span>
                            </div>
                          </div>
                          <Download className={`w-3.5 h-3.5 shrink-0 ${mutedText} group-hover:text-indigo-400`} />
                        </a>
                      ))}
                    </div>
                  ) : (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className={`border border-dashed rounded-xl p-3.5 text-center cursor-pointer transition-colors text-xs ${borderCol} ${mutedText} hover:border-indigo-500/40`}
                    >
                      Drop or click to attach files
                    </div>
                  )}
                </div>

                {/* Comments & Activity */}
                <div className={`pt-4 border-t ${borderCol}`}>
                  <div className={`flex items-center gap-5 border-b mb-4 ${borderCol}`}>
                      <button
                        onClick={() => setActiveTab("comments")}
                        className={`text-xs font-semibold pb-2.5 -mb-px flex items-center gap-1.5 border-b-2 transition-colors cursor-pointer ${
                          activeTab === "comments"
                            ? `border-current ${g.heading}`
                            : `border-transparent ${mutedText}`
                        }`}
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Comments ({comments.length})</span>
                      </button>

                      <button
                        onClick={() => setActiveTab("history")}
                        className={`text-xs font-semibold pb-2.5 -mb-px flex items-center gap-1.5 border-b-2 transition-colors cursor-pointer ${
                          activeTab === "history"
                            ? `border-current ${g.heading}`
                            : `border-transparent ${mutedText}`
                        }`}
                      >
                        <History className="w-3.5 h-3.5" />
                        <span>Activity ({history.length})</span>
                      </button>
                  </div>

                  {activeTab === "comments" ? (
                    <div className="space-y-3">
                      {comments.map((c) => (
                        <div key={c._id} className={`flex items-start gap-2.5 p-3 rounded-xl border ${subtleBg} ${borderCol}`}>
                          <UserAvatar user={c.author} className="w-7 h-7 rounded-full" textClass="text-[10px]" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-0.5">
                              <span className="text-xs font-semibold">{getDisplayName(c.author)}</span>
                              <span className={`text-[10px] font-mono ${mutedText}`}>{formatTimeIN(c.createdAt)}</span>
                            </div>
                            <p className={`text-xs whitespace-pre-wrap ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                              {c.text}
                            </p>
                          </div>
                        </div>
                      ))}

                      {comments.length === 0 && (
                        <p className={`text-xs italic py-1 ${mutedText}`}>No comments yet.</p>
                      )}

                      {mentionSuggestions.length > 0 && (
                        <div className={`rounded-xl p-1.5 space-y-0.5 border ${surfaceBg} ${borderCol}`}>
                          {mentionSuggestions.map((m) => (
                            <button
                              key={m._id}
                              type="button"
                              onClick={() => handleSelectMention(m)}
                              className={`w-full text-left px-2.5 py-1.5 text-xs rounded-lg flex items-center justify-between ${
                                isDark ? "hover:bg-white/5" : "hover:bg-slate-100"
                              }`}
                            >
                              <span className="font-medium">{m.fullname}</span>
                              <span className={`text-[10px] ${mutedText}`}>{m.departmentName || "Staff"}</span>
                            </button>
                          ))}
                        </div>
                      )}

                      <form onSubmit={handlePostComment} className="flex gap-2 pt-1">
                        <input
                          type="text"
                          placeholder="Write a comment or @mention..."
                          value={commentText}
                          onChange={handleCommentChange}
                          className={inputBase}
                        />
                        <button
                          type="submit"
                          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer shrink-0 ${
                            isDark
                              ? "bg-white text-slate-950 hover:bg-slate-200"
                              : "bg-slate-900 text-white hover:bg-slate-800"
                          }`}
                        >
                          <Send className="w-3 h-3" />
                          <span>Send</span>
                        </button>
                      </form>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {history.map((h) => (
                        <div key={h._id} className={`flex items-start gap-2.5 text-xs p-2.5 rounded-xl border ${subtleBg} ${borderCol}`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                          <div>
                            <p className="font-medium">{h.details?.message}</p>
                            <span className={`text-[10px] ${mutedText}`}>
                              {formatDateIN(h.createdAt)} • {formatTimeIN(h.createdAt)}
                            </span>
                          </div>
                        </div>
                      ))}
                      {history.length === 0 && <p className={`text-xs italic ${mutedText}`}>No activity recorded yet.</p>}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Minimal Properties Inspector */}
              <div className={`md:col-span-4 p-5 space-y-4 ${g.subtleSurface}`}>
                <AssignmentSelector
                  teamMembers={teamMembers}
                  departments={departments}
                  project={
                    projects.find((p) => String(p._id) === String(task.project?._id || task.project)) ||
                    task.project
                  }
                  selectedAssignees={
                    Array.isArray(task.assignees) && task.assignees.length > 0
                      ? task.assignees.map((u) => String(u._id || u))
                      : task.assignee
                        ? [String(task.assignee._id || task.assignee)]
                        : []
                  }
                  selectedDepartments={(task.assignedDepartments || []).map((d) => String(d._id || d))}
                  onChangeAssignees={handleAssigneesChange}
                  onChangeDepartments={handleAssignedDepartmentsChange}
                  canAssign={canAssignTask}
                  isDark={isDark}
                />

                <div className="space-y-1">
                  <label className={`text-[10px] font-semibold uppercase tracking-wider block ${mutedText}`}>
                    Reporter
                  </label>
                  <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border ${subtleBg} ${borderCol}`}>
                    <UserAvatar user={task.reporter} className="w-5 h-5 rounded-full" textClass="text-[9px]" />
                    <span className="text-xs font-medium truncate">{getDisplayName(task.reporter)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label className={`text-[10px] font-semibold uppercase tracking-wider block ${mutedText}`}>
                      Priority
                    </label>
                    <select
                      value={task.priority}
                      onChange={(e) => handlePriorityChange(e.target.value)}
                      className={inputBase}
                    >
                      <option value="urgent">Urgent</option>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className={`text-[10px] font-semibold uppercase tracking-wider block ${mutedText}`}>
                      Type
                    </label>
                    <select
                      value={task.type}
                      onChange={async (e) => {
                        const res = await updateTask(task._id, { type: e.target.value });
                        if (res.success) setTask(res.task);
                      }}
                      className={inputBase}
                    >
                      <option value="task">Task</option>
                      <option value="bug">Bug</option>
                      <option value="client_request">Request</option>
                      <option value="approval">Approval</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label className={`text-[10px] font-semibold uppercase tracking-wider block ${mutedText}`}>
                      Due Date
                    </label>
                    <input
                      type="date"
                      value={task.dueDate ? new Date(task.dueDate).toISOString().split("T")[0] : ""}
                      onChange={(e) => handleDueDateChange(e.target.value)}
                      className={inputBase}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className={`text-[10px] font-semibold uppercase tracking-wider block ${mutedText}`}>
                      Due Time
                    </label>
                    <input
                      type="time"
                      value={task.dueTime || ""}
                      onChange={async (e) => {
                        const res = await updateTask(task._id, { dueTime: e.target.value });
                        if (res.success) setTask(res.task);
                      }}
                      className={inputBase}
                    />
                  </div>
                </div>

                {/* Minimal Inline Flags */}
                <div className={`pt-2 border-t space-y-2 ${borderCol}`}>
                  <label className="flex items-center justify-between text-xs cursor-pointer py-1">
                    <span className="flex items-center gap-2">
                      <Shield className="w-3.5 h-3.5 text-rose-400" />
                      <span>Confidential</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={Boolean(task.isConfidential)}
                      onChange={async (e) => {
                        const res = await updateTask(task._id, { isConfidential: e.target.checked });
                        if (res.success) setTask(res.task);
                      }}
                      className="rounded accent-rose-500 cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between text-xs cursor-pointer py-1">
                    <span className="flex items-center gap-2">
                      <Repeat className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Recurring</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={Boolean(task.isRecurring)}
                      onChange={async (e) => {
                        const res = await updateTask(task._id, { isRecurring: e.target.checked });
                        if (res.success) setTask(res.task);
                      }}
                      className="rounded accent-indigo-500 cursor-pointer"
                    />
                  </label>

                  {task.isRecurring && (
                    <select
                      value={task.recurrence?.frequency || "daily"}
                      onChange={async (e) => {
                        const res = await updateTask(task._id, {
                          recurrence: { ...(task.recurrence || {}), frequency: e.target.value },
                        });
                        if (res.success) setTask(res.task);
                      }}
                      className={inputBase}
                    >
                      <option value="daily">Daily</option>
                      <option value="weekdays">Weekdays</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  )}
                </div>

                {/* Effort & Work Log */}
                <div className={`pt-3 border-t space-y-3 ${borderCol}`}>
                  <div className="space-y-1">
                    <label className={`text-[10px] font-semibold uppercase tracking-wider block ${mutedText}`}>
                      Estimated Hours
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={task.estimatedHours || ""}
                      onChange={(e) => handleEstimatedHoursChange(e.target.value)}
                      placeholder="0"
                      className={inputBase}
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className={mutedText}>
                        Logged <strong className={isDark ? "text-white" : "text-slate-900"}>{task.loggedHours || 0}h</strong> / {task.estimatedHours || 0}h
                      </span>
                      <button
                        onClick={() => setShowLogWork(!showLogWork)}
                        className="text-xs font-medium text-indigo-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        <span>{showLogWork ? "Cancel" : "Log"}</span>
                      </button>
                    </div>

                    <div className={`w-full rounded-full h-1.5 overflow-hidden ${isDark ? "bg-white/10" : "bg-slate-200"}`}>
                      <div
                        className="h-full bg-indigo-500 transition-all duration-300"
                        style={{
                          width: `${Math.min(
                            100,
                            task.estimatedHours > 0
                              ? ((task.loggedHours || 0) / task.estimatedHours) * 100
                              : 0
                          )}%`,
                        }}
                      />
                    </div>
                  </div>

                  {showLogWork && (
                    <form onSubmit={handleLogWorkSubmit} className={`p-3 rounded-xl border space-y-2 ${subtleBg} ${borderCol}`}>
                      <input
                        type="number"
                        step="0.25"
                        min="0.25"
                        placeholder="Hours (e.g. 1.5)"
                        value={logHours}
                        onChange={(e) => setLogHours(e.target.value)}
                        className={inputBase}
                        required
                      />
                      <input
                        type="text"
                        placeholder="Work note..."
                        value={logNote}
                        onChange={(e) => setLogNote(e.target.value)}
                        className={inputBase}
                      />
                      <button
                        type="submit"
                        className={`w-full py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                          isDark
                            ? "bg-white text-slate-950 hover:bg-slate-200"
                            : "bg-slate-900 text-white hover:bg-slate-800"
                        }`}
                      >
                        Save Log
                      </button>
                    </form>
                  )}

                  {task.workLogs?.length > 0 && (
                    <div className="space-y-1.5 max-h-36 overflow-y-auto">
                      {task.workLogs.map((log) => (
                        <div key={log._id} className={`p-2 rounded-lg border text-[11px] ${subtleBg} ${borderCol}`}>
                          <div className="flex items-center justify-between font-medium">
                            <span className="truncate">{getDisplayName(log.user, "Staff")}</span>
                            <span className="text-indigo-400 font-mono font-semibold">{log.hours}h</span>
                          </div>
                          {log.note && <p className={`mt-0.5 truncate ${mutedText}`}>{log.note}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
