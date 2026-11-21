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
  updateSubtaskProof,
} from "../../services/api";
import { getSocket } from "../../services/socket";
import {
  X,
  CheckSquare,
  Bug,
  HelpCircle,
  FileCheck2,
  Clock,
  Calendar,
  Paperclip,
  MessageSquare,
  History,
  Send,
  Trash2,
  Copy,
  Check,
  Upload,
  UserPlus,
  PlayCircle,
  Timer,
  ChevronRight,
  Sparkles,
  Layers,
  Activity,
  Shield,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  FileText,
  Repeat,
} from "lucide-react";
import toast from "react-hot-toast";

export default function TaskDrawer({ taskKeyOrId, onClose, onTaskUpdated }) {
  const { user, teamMembers, theme } = useApp();
  const isDark = theme === "dark";

  const [task, setTask] = useState(null);
  const [comments, setComments] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  // Active Tab: 'comments' or 'history'
  const [activeTab, setActiveTab] = useState("comments");

  // New comment text
  const [commentText, setCommentText] = useState("");
  const [mentionSuggestions, setMentionSuggestions] = useState([]);

  // Work log input
  const [showLogWork, setShowLogWork] = useState(false);
  const [logHours, setLogHours] = useState("");
  const [logNote, setLogNote] = useState("");

  // Subtask input
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");

  // Copy key feedback
  const [copiedKey, setCopiedKey] = useState(false);
  const [showRedoModal, setShowRedoModal] = useState(false);
  const [redoFeedback, setRedoFeedback] = useState("");

  // File upload input ref
  const fileInputRef = useRef(null);

  // Fetch full task data
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

  // Real-time updates via Socket
  useEffect(() => {
    const socket = getSocket();
    if (!socket || !task?._id) return;

    const handleTaskUpdated = (updated) => {
      if (updated._id === task._id) {
        setTask(updated);
      }
    };

    const handleCommentNew = ({ taskId, comment }) => {
      if (taskId === task._id) {
        setComments((prev) => [...prev, comment]);
      }
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

  // Handlers
  const handleCopyKey = () => {
    if (!task) return;
    navigator.clipboard.writeText(task.key);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
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
      toast.error("Please enter revision instructions for the assignee");
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

  const handleAssigneeChange = async (newAssigneeId) => {
    const res = await updateTask(task._id, { assignee: newAssigneeId || null });
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

  // Add work log
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
      toast.success("Work logged successfully!");
    }
  };

  // Subtasks
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

  // File Attachment
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const toastId = toast.loading("Uploading attachment...");
    const res = await uploadTaskAttachment(task._id, file);
    if (res.success) {
      setTask((prev) => ({ ...prev, attachments: res.attachments }));
      toast.success("Attachment uploaded!", { id: toastId });
    } else {
      toast.error("Failed to upload file", { id: toastId });
    }
  };

  // Comments
  const handleCommentChange = (e) => {
    const text = e.target.value;
    setCommentText(text);

    // Check for @mention trigger
    const words = text.split(" ");
    const lastWord = words[words.length - 1];
    if (lastWord.startsWith("@") && lastWord.length > 1) {
      const query = lastWord.slice(1).toLowerCase();
      const matches = teamMembers.filter((m) =>
        m.fullname?.toLowerCase().includes(query)
      );
      setMentionSuggestions(matches);
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

  // Delete Task
  const handleDeleteTask = async () => {
    if (!window.confirm(`Delete task ${task.key}? This action cannot be undone.`)) return;
    const res = await deleteTask(task._id);
    if (res.success) {
      toast.success("Task deleted");
      onClose();
      onTaskUpdated?.();
    }
  };

  const totalSubtasks = task?.subtasks?.length || 0;
  const completedSubtasks = task?.subtasks?.filter((s) => s.completed).length || 0;
  const subtaskProgress = totalSubtasks > 0 ? Math.round((completedSubtasks / totalSubtasks) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
      {/* Frosted Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
      />

      {/* Slide-over Drawer */}
      <div
        className={`relative w-full max-w-3xl shadow-2xl h-full flex flex-col z-10 animate-in slide-in-from-right duration-300 border-l ${
          isDark
            ? "bg-[#13141d] border-white/10 text-slate-100"
            : "bg-white border-slate-200 text-slate-900"
        }`}
      >
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 gap-3">
            <div className="w-10 h-10 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <p className={`text-xs font-medium ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              Loading task details...
            </p>
          </div>
        ) : !task ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <p className={`font-medium ${isDark ? "text-slate-300" : "text-slate-600"}`}>
              Task could not be found.
            </p>
            <button
              onClick={onClose}
              className={`mt-4 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                isDark ? "bg-white/10 hover:bg-white/15 text-slate-200" : "bg-slate-100 hover:bg-slate-200 text-slate-700"
              }`}
            >
              Close
            </button>
          </div>
        ) : (
          <>
            {/* Drawer Header */}
            <div
              className={`px-6 py-4.5 border-b flex items-center justify-between shrink-0 ${
                isDark ? "bg-[#181926]/90 border-white/10" : "bg-slate-50/80 border-slate-200"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className={`font-mono text-xs font-bold px-3 py-1 rounded-lg border shadow-2xs ${
                    isDark
                      ? "text-indigo-400 bg-indigo-500/10 border-indigo-500/30"
                      : "text-indigo-600 bg-indigo-50 border-indigo-200"
                  }`}
                >
                  {task.key}
                </span>

                <button
                  onClick={handleCopyKey}
                  className={`p-1.5 rounded-lg transition-colors ${
                    isDark
                      ? "text-slate-400 hover:text-slate-200 hover:bg-white/10"
                      : "text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                  }`}
                  title="Copy Task Key"
                >
                  {copiedKey ? (
                    <Check className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>

                <div className={`h-4 w-px mx-1 ${isDark ? "bg-white/10" : "bg-slate-200"}`} />

                {/* Status Selector */}
                <select
                  value={task.status}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  className={`text-xs font-bold uppercase rounded-xl px-3 py-1.5 border cursor-pointer focus:outline-none transition-all shadow-2xs ${
                    isDark
                      ? {
                          todo: "bg-[#1d1f2b] text-slate-300 border-white/10",
                          in_progress: "bg-blue-500/15 text-blue-300 border-blue-500/30",
                          submitted_for_review: "bg-amber-500/15 text-amber-300 border-amber-500/30",
                          review: "bg-amber-500/15 text-amber-300 border-amber-500/30",
                          redo_requested: "bg-rose-500/15 text-rose-300 border-rose-500/30",
                          done: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
                        }[task.status] || "bg-[#1d1f2b] text-slate-300 border-white/10"
                      : {
                          todo: "bg-slate-100 text-slate-700 border-slate-300",
                          in_progress: "bg-blue-50 text-blue-700 border-blue-300",
                          submitted_for_review: "bg-amber-50 text-amber-700 border-amber-300",
                          review: "bg-amber-50 text-amber-700 border-amber-300",
                          redo_requested: "bg-rose-50 text-rose-700 border-rose-300",
                          done: "bg-emerald-50 text-emerald-700 border-emerald-300",
                        }[task.status] || "bg-slate-100 text-slate-700 border-slate-300"
                  }`}
                >
                  <option value="todo">To Do</option>
                  <option value="in_progress">In Progress</option>
                  <option value="submitted_for_review">Submitted for Review</option>
                  <option value="redo_requested">Revision Requested</option>
                  <option value="done">Done / Completed</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                {(user?.role === "admin" ||
                  user?.role === "manager" ||
                  task.reporter?._id === user?._id) && (
                  <button
                    onClick={handleDeleteTask}
                    className="p-2 text-slate-400 hover:text-rose-500 rounded-xl hover:bg-rose-500/10 transition-colors"
                    title="Delete Task"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}

                <button
                  onClick={onClose}
                  className={`p-2 rounded-xl transition-colors ${
                    isDark ? "text-slate-400 hover:text-white hover:bg-white/10" : "text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Redo Modal / Prompt */}
            {showRedoModal && (
              <div className="p-4 bg-rose-950/60 border-b border-rose-500/30 text-rose-200 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold flex items-center gap-1 text-rose-300">
                    <RotateCcw className="w-4 h-4" /> Request Revision / Redo Feedback
                  </span>
                  <button onClick={() => setShowRedoModal(false)} className="text-rose-400 hover:text-white">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <textarea
                  rows={2}
                  value={redoFeedback}
                  onChange={(e) => setRedoFeedback(e.target.value)}
                  placeholder="Explain exactly what needs to be changed or corrected..."
                  className="w-full bg-slate-900 border border-rose-500/30 rounded-xl p-2 text-white text-xs focus:outline-none"
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setShowRedoModal(false)}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRequestRedo}
                    className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold shadow-sm"
                  >
                    Send Revision Request
                  </button>
                </div>
              </div>
            )}

            {/* Drawer Body: 2 Columns */}
            <div
              className={`flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x ${
                isDark ? "divide-white/10" : "divide-slate-200"
              }`}
            >
              {/* Left Column (Content, Subtasks, Attachments, Comments, History) */}
              <div className="md:col-span-2 p-6 space-y-6">
                {/* Office Verification / Redo Loop Banners */}
                {task.status === "redo_requested" && (
                  <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-rose-400">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>Revision Requested by Manager</span>
                    </div>
                    <p className="text-rose-200/90 pl-5 whitespace-pre-wrap">{task.reviewFeedback || "Please review deliverables and resubmit."}</p>
                  </div>
                )}

                {task.status === "submitted_for_review" && (
                  <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-amber-300 font-bold">
                      <RotateCcw className="w-4 h-4 shrink-0" />
                      <span>Submitted for Manager Verification & Sign-Off</span>
                    </div>
                    {(user?.role === "admin" || user?.role === "manager") && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleApprove}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Approve & Complete
                        </button>
                        <button
                          onClick={() => setShowRedoModal(true)}
                          className="px-3 py-1.5 bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white rounded-xl font-semibold border border-rose-500/30 flex items-center gap-1.5 transition-colors"
                        >
                          <RotateCcw className="w-3.5 h-3.5" /> Request Redo
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {(task.status === "in_progress" || task.status === "todo" || task.status === "redo_requested") && (
                  <button
                    onClick={handleSubmitForReview}
                    className="px-3.5 py-2 bg-blue-600/15 hover:bg-blue-600 text-blue-300 hover:text-white border border-blue-500/30 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Submit for Manager Verification
                  </button>
                )}

                {/* Title */}
                <div>
                  <h2 className="text-xl font-bold leading-snug tracking-tight">
                    {task.title}
                  </h2>
                </div>

                {/* Description */}
                <div>
                  <h3 className={`text-xs font-bold uppercase tracking-wider mb-2 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                    Description
                  </h3>
                  <div
                    className={`rounded-2xl p-4 text-xs sm:text-sm whitespace-pre-wrap leading-relaxed border ${
                      isDark
                        ? "bg-[#181926] border-white/10 text-slate-200"
                        : "bg-slate-50 border-slate-200 text-slate-800"
                    }`}
                  >
                    {task.description || (
                      <span className={`italic ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                        No description provided.
                      </span>
                    )}
                  </div>
                </div>

                {/* Subtasks Checklist */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className={`text-xs font-bold uppercase tracking-wider ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                      Subtasks ({completedSubtasks}/{totalSubtasks})
                    </h3>
                    {totalSubtasks > 0 && (
                      <span className={`text-xs font-bold ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                        {subtaskProgress}%
                      </span>
                    )}
                  </div>

                  {totalSubtasks > 0 && (
                    <div className={`w-full rounded-full h-1.5 mb-3 overflow-hidden ${isDark ? "bg-white/10" : "bg-slate-200"}`}>
                      <div
                        className="bg-gradient-to-r from-indigo-500 to-emerald-400 h-full transition-all duration-300 rounded-full"
                        style={{ width: `${subtaskProgress}%` }}
                      />
                    </div>
                  )}

                  <div className="space-y-2 mb-3">
                    {task.subtasks?.map((st) => (
                      <div
                        key={st._id}
                        className={`flex items-center justify-between p-2.5 rounded-xl border text-xs transition-colors group ${
                          isDark
                            ? "bg-[#181926] border-white/10 hover:bg-[#1f2030]"
                            : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        <label className="flex items-center gap-3 cursor-pointer flex-1">
                          <input
                            type="checkbox"
                            checked={st.completed}
                            onChange={() => handleToggleSubtask(st._id)}
                            className="w-4 h-4 rounded text-indigo-600 focus:ring-0 cursor-pointer accent-indigo-600"
                          />
                          <span
                            className={
                              st.completed
                                ? `line-through ${isDark ? "text-slate-500" : "text-slate-400"}`
                                : `font-medium ${isDark ? "text-slate-200" : "text-slate-800"}`
                            }
                          >
                            {st.title}
                          </span>
                        </label>
                        <button
                          onClick={() => handleDeleteSubtask(st._id)}
                          className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-500 transition-opacity p-1 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Add Subtask Input */}
                  <form onSubmit={handleAddSubtask} className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Add subtask and press enter..."
                      value={newSubtaskTitle}
                      onChange={(e) => setNewSubtaskTitle(e.target.value)}
                      className={`flex-1 rounded-xl px-3.5 py-2 text-xs border focus:outline-none focus:ring-2 focus:ring-indigo-500/30 ${
                        isDark
                          ? "bg-[#181926] border-white/10 text-slate-100 placeholder-slate-500"
                          : "bg-white border-slate-200 text-slate-800 placeholder-slate-400"
                      }`}
                    />
                    <button
                      type="submit"
                      className={`px-4 py-2 text-xs font-semibold rounded-xl transition-colors ${
                        isDark
                          ? "bg-white text-slate-900 hover:bg-slate-200"
                          : "bg-slate-900 text-white hover:bg-slate-800"
                      }`}
                    >
                      Add
                    </button>
                  </form>
                </div>

                {/* Attachments */}
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <h3 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                      <Paperclip className="w-3.5 h-3.5" />
                      <span>Attachments ({task.attachments?.length || 0})</span>
                    </h3>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1 hover:underline"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload File</span>
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {task.attachments?.map((att) => (
                      <a
                        key={att._id}
                        href={att.url}
                        target="_blank"
                        rel="noreferrer"
                        className={`flex items-center gap-3 p-3 rounded-xl border text-xs group transition-all ${
                          isDark
                            ? "border-white/10 bg-[#181926] hover:border-indigo-500/40 hover:bg-[#1f2030]"
                            : "border-slate-200 bg-white hover:border-indigo-400 hover:bg-indigo-50/20"
                        }`}
                      >
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 font-bold text-xs ${
                            isDark ? "bg-indigo-500/20 text-indigo-300" : "bg-indigo-100 text-indigo-600"
                          }`}
                        >
                          📎
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={`font-semibold truncate group-hover:text-indigo-400 ${isDark ? "text-slate-200" : "text-slate-800"}`}>
                            {att.originalName}
                          </p>
                          <span className={`text-[10px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                            {(att.size / 1024).toFixed(1)} KB • {att.uploadedBy?.fullname || "Staff"}
                          </span>
                        </div>
                      </a>
                    ))}

                    {(!task.attachments || task.attachments.length === 0) && (
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className={`col-span-full border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition-colors ${
                          isDark
                            ? "border-white/10 hover:border-white/20 hover:bg-white/5 text-slate-400"
                            : "border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-500"
                        }`}
                      >
                        <p className="text-xs font-medium">
                          Click to upload screenshots, PDFs or documents
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Tabs: Comments & Activity Feed */}
                <div className={`pt-4 border-t ${isDark ? "border-white/10" : "border-slate-200"}`}>
                  <div className={`flex items-center gap-4 border-b pb-2 mb-4 ${isDark ? "border-white/10" : "border-slate-200"}`}>
                    <button
                      onClick={() => setActiveTab("comments")}
                      className={`text-xs font-bold uppercase tracking-wider pb-2 -mb-2.5 flex items-center gap-1.5 transition-colors border-b-2 ${
                        activeTab === "comments"
                          ? "border-indigo-500 text-indigo-400 font-bold"
                          : isDark
                          ? "border-transparent text-slate-400 hover:text-slate-200"
                          : "border-transparent text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Comments ({comments.length})</span>
                    </button>

                    <button
                      onClick={() => setActiveTab("history")}
                      className={`text-xs font-bold uppercase tracking-wider pb-2 -mb-2.5 flex items-center gap-1.5 transition-colors border-b-2 ${
                        activeTab === "history"
                          ? "border-indigo-500 text-indigo-400 font-bold"
                          : isDark
                          ? "border-transparent text-slate-400 hover:text-slate-200"
                          : "border-transparent text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      <History className="w-3.5 h-3.5" />
                      <span>Activity Log ({history.length})</span>
                    </button>
                  </div>

                  {activeTab === "comments" ? (
                    <div className="space-y-4">
                      {/* Comments Feed */}
                      <div className="space-y-3">
                        {comments.map((c) => (
                          <div
                            key={c._id}
                            className={`flex items-start gap-3 p-3.5 rounded-2xl border ${
                              isDark
                                ? "bg-[#181926] border-white/10"
                                : "bg-slate-50 border-slate-200"
                            }`}
                          >
                            <img
                              src={
                                c.author?.avatar ||
                                `https://api.dicebear.com/7.x/initials/svg?seed=${c.author?.fullname}`
                              }
                              alt={c.author?.fullname}
                              className="w-8 h-8 rounded-full border border-white/10 object-cover shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <span className={`text-xs font-bold ${isDark ? "text-slate-200" : "text-slate-900"}`}>
                                  {c.author?.fullname}
                                </span>
                                <span className={`text-[10px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                                  {new Date(c.createdAt).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              </div>
                              <p className={`text-xs whitespace-pre-wrap leading-relaxed ${isDark ? "text-slate-300" : "text-slate-800"}`}>
                                {c.text}
                              </p>
                            </div>
                          </div>
                        ))}

                        {comments.length === 0 && (
                          <p className={`text-xs italic py-2 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                            No comments yet. Start the conversation!
                          </p>
                        )}
                      </div>

                      {/* Mention Autocomplete suggestions */}
                      {mentionSuggestions.length > 0 && (
                        <div
                          className={`rounded-xl p-1.5 space-y-1 shadow-lg border ${
                            isDark ? "bg-[#1f2030] border-white/10" : "bg-white border-slate-200"
                          }`}
                        >
                          <span className={`text-[10px] font-bold px-2 py-0.5 block uppercase ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                            Mention Teammate:
                          </span>
                          {mentionSuggestions.map((m) => (
                            <button
                              key={m._id}
                              type="button"
                              onClick={() => handleSelectMention(m)}
                              className={`w-full text-left px-2.5 py-1.5 text-xs rounded-lg flex items-center gap-2 transition-colors ${
                                isDark ? "hover:bg-white/10 text-slate-200" : "hover:bg-indigo-50 text-slate-800"
                              }`}
                            >
                              <span className="font-semibold">{m.fullname}</span>
                              <span className={`text-[10px] font-mono ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                                @{m.departmentName || "Staff"}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Post Comment Input */}
                      <form onSubmit={handlePostComment} className="flex gap-2">
                        <textarea
                          rows={2}
                          placeholder="Type comment or @mention a teammate..."
                          value={commentText}
                          onChange={handleCommentChange}
                          className={`flex-1 rounded-2xl p-3 text-xs border focus:outline-none focus:ring-2 focus:ring-indigo-500/30 ${
                            isDark
                              ? "bg-[#181926] border-white/10 text-slate-100 placeholder-slate-500"
                              : "bg-white border-slate-200 text-slate-800 placeholder-slate-400"
                          }`}
                        />
                        <button
                          type="submit"
                          className="self-end px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-md shadow-indigo-500/20 transition-all"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Send</span>
                        </button>
                      </form>
                    </div>
                  ) : (
                    /* Activity Log */
                    <div className="space-y-3">
                      {history.map((h) => (
                        <div
                          key={h._id}
                          className={`flex items-start gap-3 text-xs p-2.5 rounded-xl border ${
                            isDark ? "bg-[#181926] border-white/5" : "bg-slate-50 border-slate-100"
                          }`}
                        >
                          <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 mt-1 shrink-0 shadow-xs" />
                          <div>
                            <span className={`font-semibold ${isDark ? "text-slate-200" : "text-slate-800"}`}>
                              {h.details?.message}
                            </span>
                            <span className={`text-[10px] block mt-0.5 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                              {new Date(h.createdAt).toLocaleString([], {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                        </div>
                      ))}

                      {history.length === 0 && (
                        <p className={`text-xs italic py-2 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                          No activity recorded yet.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Meta Attributes & Work Log */}
              <div
                className={`p-6 space-y-5 ${
                  isDark ? "bg-[#11121a]/80" : "bg-slate-50/70"
                }`}
              >
                {/* Assignee */}
                <div>
                  <label className={`text-[11px] font-bold uppercase tracking-wider block mb-1.5 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                    Assignee
                  </label>
                  <select
                    value={task.assignee?._id || ""}
                    onChange={(e) => handleAssigneeChange(e.target.value)}
                    className={`w-full text-xs font-semibold rounded-xl px-3 py-2 cursor-pointer border focus:outline-none focus:ring-2 focus:ring-indigo-500/30 ${
                      isDark
                        ? "bg-[#181926] border-white/10 text-slate-200"
                        : "bg-white border-slate-200 text-slate-800"
                    }`}
                  >
                    <option value="">Unassigned</option>
                    {teamMembers.map((m) => (
                      <option key={m._id} value={m._id}>
                        {m.fullname} ({m.departmentName || "General"})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Reporter */}
                <div>
                  <label className={`text-[11px] font-bold uppercase tracking-wider block mb-1.5 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                    Reporter
                  </label>
                  <div
                    className={`flex items-center gap-2.5 p-2 rounded-xl border ${
                      isDark ? "bg-[#181926] border-white/10" : "bg-white border-slate-200"
                    }`}
                  >
                    <img
                      src={
                        task.reporter?.avatar ||
                        `https://api.dicebear.com/7.x/initials/svg?seed=${task.reporter?.fullname}`
                      }
                      alt={task.reporter?.fullname}
                      className="w-6 h-6 rounded-full object-cover"
                    />
                    <span className={`text-xs font-semibold ${isDark ? "text-slate-200" : "text-slate-800"}`}>
                      {task.reporter?.fullname || "Unknown"}
                    </span>
                  </div>
                </div>

                {/* Priority */}
                <div>
                  <label className={`text-[11px] font-bold uppercase tracking-wider block mb-1.5 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                    Priority
                  </label>
                  <select
                    value={task.priority}
                    onChange={(e) => handlePriorityChange(e.target.value)}
                    className={`w-full text-xs font-semibold rounded-xl px-3 py-2 cursor-pointer border focus:outline-none focus:ring-2 focus:ring-indigo-500/30 ${
                      isDark
                        ? "bg-[#181926] border-white/10 text-slate-200"
                        : "bg-white border-slate-200 text-slate-800"
                    }`}
                  >
                    <option value="urgent">🔴 Urgent</option>
                    <option value="high">🟠 High</option>
                    <option value="medium">🟡 Medium</option>
                    <option value="low">⚪ Low</option>
                  </select>
                </div>

                {/* Task Type */}
                <div>
                  <label className={`text-[11px] font-bold uppercase tracking-wider block mb-1.5 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                    Task Type
                  </label>
                  <select
                    value={task.type}
                    onChange={async (e) => {
                      const res = await updateTask(task._id, { type: e.target.value });
                      if (res.success) setTask(res.task);
                    }}
                    className={`w-full text-xs font-semibold rounded-xl px-3 py-2 cursor-pointer border focus:outline-none focus:ring-2 focus:ring-indigo-500/30 ${
                      isDark
                        ? "bg-[#181926] border-white/10 text-slate-200"
                        : "bg-white border-slate-200 text-slate-800"
                    }`}
                  >
                    <option value="task">Regular Task</option>
                    <option value="bug">Bug / Issue</option>
                    <option value="client_request">Client Request</option>
                    <option value="approval">Office Approval</option>
                  </select>
                </div>

                {/* Due Date */}
                <div>
                  <label className={`text-[11px] font-bold uppercase tracking-wider block mb-1.5 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={task.dueDate ? new Date(task.dueDate).toISOString().split("T")[0] : ""}
                    onChange={(e) => handleDueDateChange(e.target.value)}
                    className={`w-full text-xs font-semibold rounded-xl px-3 py-2 cursor-pointer border focus:outline-none focus:ring-2 focus:ring-indigo-500/30 ${
                      isDark
                        ? "bg-[#181926] border-white/10 text-slate-200"
                        : "bg-white border-slate-200 text-slate-800"
                    }`}
                  />
                </div>

                {/* Strict Clock Due Time */}
                <div>
                  <label className={`text-[11px] font-bold uppercase tracking-wider block mb-1.5 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                    Strict Clock Time
                  </label>
                  <input
                    type="time"
                    value={task.dueTime || ""}
                    onChange={async (e) => {
                      const res = await updateTask(task._id, { dueTime: e.target.value });
                      if (res.success) setTask(res.task);
                    }}
                    className={`w-full text-xs font-semibold rounded-xl px-3 py-2 cursor-pointer border focus:outline-none focus:ring-2 focus:ring-indigo-500/30 ${
                      isDark
                        ? "bg-[#181926] border-white/10 text-slate-200"
                        : "bg-white border-slate-200 text-slate-800"
                    }`}
                  />
                </div>

                {/* Confidentiality Toggle */}
                <div className={`flex items-center justify-between p-2.5 rounded-xl border ${isDark ? "bg-white/5 border-white/10" : "bg-slate-100 border-slate-200"}`}>
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-rose-400" />
                    <div>
                      <span className={`text-xs font-bold block ${isDark ? "text-slate-200" : "text-slate-800"}`}>Confidential Task</span>
                      <span className="text-[10px] text-slate-400">Strict office privacy</span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={Boolean(task.isConfidential)}
                    onChange={async (e) => {
                      const res = await updateTask(task._id, { isConfidential: e.target.checked });
                      if (res.success) setTask(res.task);
                    }}
                    className="rounded border-slate-700 bg-slate-900 text-rose-500 focus:ring-0 cursor-pointer h-4 w-4"
                  />
                </div>

                {/* Recurring Routine Engine */}
                <div className={`p-2.5 rounded-xl border space-y-2 ${isDark ? "bg-white/5 border-white/10" : "bg-slate-100 border-slate-200"}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold">
                      <Repeat className="w-3.5 h-3.5 text-blue-400" />
                      <span className={isDark ? "text-slate-200" : "text-slate-800"}>Recurring Routine</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={Boolean(task.isRecurring)}
                      onChange={async (e) => {
                        const res = await updateTask(task._id, { isRecurring: e.target.checked });
                        if (res.success) setTask(res.task);
                      }}
                      className="rounded border-slate-700 bg-slate-900 text-blue-500 focus:ring-0 cursor-pointer h-4 w-4"
                    />
                  </div>
                  {task.isRecurring && (
                    <select
                      value={task.recurrence?.frequency || "daily"}
                      onChange={async (e) => {
                        const res = await updateTask(task._id, {
                          recurrence: { ...(task.recurrence || {}), frequency: e.target.value },
                        });
                        if (res.success) setTask(res.task);
                      }}
                      className={`w-full text-xs font-semibold rounded-lg px-2.5 py-1.5 border focus:outline-none ${
                        isDark ? "bg-[#181926] border-white/10 text-slate-200" : "bg-white border-slate-200 text-slate-800"
                      }`}
                    >
                      <option value="daily">Daily Schedule</option>
                      <option value="weekdays">Every Weekday (Mon-Fri)</option>
                      <option value="weekly">Weekly Routine</option>
                      <option value="monthly">Monthly Routine</option>
                    </select>
                  )}
                </div>

                {/* Estimated Hours */}
                <div>
                  <label className={`text-[11px] font-bold uppercase tracking-wider block mb-1.5 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                    Estimated Effort
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={task.estimatedHours || ""}
                      onChange={(e) => handleEstimatedHoursChange(e.target.value)}
                      placeholder="0"
                      className={`w-full text-xs font-semibold rounded-xl pl-3 pr-12 py-2 border focus:outline-none focus:ring-2 focus:ring-indigo-500/30 ${
                        isDark
                          ? "bg-[#181926] border-white/10 text-slate-200"
                          : "bg-white border-slate-200 text-slate-800"
                      }`}
                    />
                    <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                      hours
                    </span>
                  </div>
                </div>

                {/* Work Log Section */}
                <div className={`pt-4 border-t ${isDark ? "border-white/10" : "border-slate-200"}`}>
                  <div className="flex items-center justify-between mb-2">
                    <label className={`text-[11px] font-bold uppercase tracking-wider ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                      Work Logged
                    </label>
                    <button
                      onClick={() => setShowLogWork(!showLogWork)}
                      className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold hover:underline"
                    >
                      {showLogWork ? "Cancel" : "+ Log Work"}
                    </button>
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                      <span className={isDark ? "text-slate-200" : "text-slate-800"}>
                        {task.loggedHours || 0}h logged
                      </span>
                      <span className={isDark ? "text-slate-400" : "text-slate-500"}>
                        of {task.estimatedHours || 0}h
                      </span>
                    </div>
                    <div className={`w-full rounded-full h-2 overflow-hidden ${isDark ? "bg-white/10" : "bg-slate-200"}`}>
                      <div
                        className={`h-full transition-all duration-300 rounded-full ${
                          (task.loggedHours || 0) > (task.estimatedHours || 0) && task.estimatedHours > 0
                            ? "bg-amber-500"
                            : "bg-indigo-500"
                        }`}
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

                  {/* Log Work Form */}
                  {showLogWork && (
                    <form
                      onSubmit={handleLogWorkSubmit}
                      className={`p-3.5 rounded-2xl border space-y-2.5 mb-3 shadow-xs ${
                        isDark ? "bg-[#181926] border-white/10" : "bg-white border-slate-200"
                      }`}
                    >
                      <div>
                        <label className={`text-[10px] font-bold block mb-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                          Hours Worked:
                        </label>
                        <input
                          type="number"
                          step="0.25"
                          min="0.25"
                          placeholder="e.g. 2.5"
                          value={logHours}
                          onChange={(e) => setLogHours(e.target.value)}
                          className={`w-full rounded-xl px-3 py-1.5 text-xs border focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                            isDark
                              ? "bg-[#13141d] border-white/10 text-slate-100"
                              : "bg-slate-50 border-slate-200 text-slate-800"
                          }`}
                          required
                        />
                      </div>
                      <div>
                        <label className={`text-[10px] font-bold block mb-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                          Work Note:
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Implemented responsive layout..."
                          value={logNote}
                          onChange={(e) => setLogNote(e.target.value)}
                          className={`w-full rounded-xl px-3 py-1.5 text-xs border focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                            isDark
                              ? "bg-[#13141d] border-white/10 text-slate-100"
                              : "bg-slate-50 border-slate-200 text-slate-800"
                          }`}
                        />
                      </div>
                      <button
                        type="submit"
                        className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors"
                      >
                        Submit Log
                      </button>
                    </form>
                  )}

                  {/* Logged Work History */}
                  <div className="space-y-2 max-h-44 overflow-y-auto">
                    {task.workLogs?.map((log) => (
                      <div
                        key={log._id}
                        className={`p-2.5 rounded-xl border text-[11px] ${
                          isDark ? "bg-[#181926] border-white/10" : "bg-white border-slate-200"
                        }`}
                      >
                        <div className="flex items-center justify-between font-semibold">
                          <span className={isDark ? "text-slate-200" : "text-slate-800"}>
                            {log.user?.fullname || "Staff"}
                          </span>
                          <span className="text-indigo-400 font-bold">{log.hours}h</span>
                        </div>
                        {log.note && (
                          <p className={`mt-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                            {log.note}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
