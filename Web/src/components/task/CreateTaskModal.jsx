import React, { useState, useEffect } from "react";
import { useApp } from "../../context/Appcontext";
import { createTask, getAITaskBreakdown } from "../../services/api";
import {
  X,
  Sparkles,
  Plus,
  Trash2,
  Calendar,
  Clock,
  UserCheck,
  CheckCircle2,
  Layers,
  FolderKanban,
  AlertCircle,
  Tag,
  ListTodo,
} from "lucide-react";
import toast from "react-hot-toast";

export default function CreateTaskModal({ isOpen, onClose, onCreated }) {
  const { user, projects, activeProject, teamMembers, theme } = useApp();
  const isDark = theme === "dark";

  const [projectId, setProjectId] = useState(activeProject?._id || "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("task");
  const [priority, setPriority] = useState("medium");
  const [assignee, setAssignee] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [estimatedHours, setEstimatedHours] = useState("");
  const [subtasks, setSubtasks] = useState([]);
  const [newSubtask, setNewSubtask] = useState("");

  const [loadingAI, setLoadingAI] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && activeProject?._id) {
      setProjectId(activeProject._id);
    }
  }, [isOpen, activeProject?._id]);

  if (!isOpen) return null;

  // AI Breakdown with Google Gemini
  const handleAIBreakdown = async () => {
    if (!title.trim()) {
      toast.error("Please enter a task title first so Gemini AI can analyze it!");
      return;
    }

    setLoadingAI(true);
    const toastId = toast.loading("Analyzing task with Gemini...");
    try {
      const res = await getAITaskBreakdown(title, description);
      if (res.success && res.aiSuggestion) {
        const {
          description: aiDesc,
          subtasks: aiSubtasks,
          priority: aiPriority,
          estimatedHours: aiHours,
          type: aiType,
        } = res.aiSuggestion;
        if (aiDesc && !description) setDescription(aiDesc);
        if (aiSubtasks && Array.isArray(aiSubtasks)) {
          setSubtasks((prev) => [
            ...prev,
            ...aiSubtasks.map((s) => ({ title: typeof s === "string" ? s : s.title })),
          ]);
        }
        if (aiPriority) setPriority(aiPriority);
        if (aiHours) setEstimatedHours(aiHours.toString());
        if (aiType) setType(aiType);

        toast.success("AI generated task breakdown & subtasks!", { id: toastId });
      } else {
        toast.dismiss(toastId);
      }
    } catch (err) {
      toast.dismiss(toastId);
    } finally {
      setLoadingAI(false);
    }
  };

  const handleAddSubtask = (e) => {
    e.preventDefault();
    if (!newSubtask.trim()) return;
    setSubtasks([...subtasks, { title: newSubtask.trim() }]);
    setNewSubtask("");
  };

  const handleRemoveSubtask = (index) => {
    setSubtasks(subtasks.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }

    const targetProject = projectId || activeProject?._id || projects[0]?._id;
    if (!targetProject) {
      toast.error("Please select a project");
      return;
    }

    setSubmitting(true);
    const res = await createTask({
      projectId: targetProject,
      title: title.trim(),
      description: description.trim(),
      type,
      priority,
      assignee: assignee || null,
      dueDate: dueDate || null,
      estimatedHours: Number(estimatedHours) || 0,
      subtasks: subtasks.map((s) => ({ title: s.title })),
    });

    setSubmitting(false);

    if (res.success) {
      toast.success(`Task ${res.task?.key || "created"} successfully!`);
      onCreated?.(res.task);
      onClose();
      // Reset form
      setTitle("");
      setDescription("");
      setSubtasks([]);
      setAssignee("");
      setDueDate("");
      setEstimatedHours("");
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
      {/* Frosted Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity animate-in fade-in"
      />

      {/* Modal Dialog */}
      <div
        className={`relative w-full max-w-2xl rounded-3xl shadow-2xl border overflow-hidden z-10 animate-in zoom-in-95 duration-200 ${
          isDark
            ? "bg-[#161722] border-white/10 text-slate-100"
            : "bg-white border-slate-200 text-slate-900"
        }`}
      >
        {/* Header */}
        <div
          className={`px-6 py-4.5 border-b flex items-center justify-between ${
            isDark ? "bg-[#181926]/90 border-white/10" : "bg-slate-50/80 border-slate-200"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold text-lg shadow-md shadow-indigo-500/20">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold leading-tight">
                Create New Task
              </h2>
              <p className={`text-xs mt-0.5 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                Auto-numbered in project sequence (e.g. ENG-105, OPS-16)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className={`p-2 rounded-xl transition-colors ${
              isDark ? "text-slate-400 hover:text-white hover:bg-white/10" : "text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4.5 max-h-[calc(85vh-8rem)] overflow-y-auto">
          {/* Project & Task Type row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className={`text-xs font-bold block mb-1.5 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                Project Workspace *
              </label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className={`w-full text-xs font-semibold rounded-xl px-3.5 py-2.5 border focus:outline-none focus:ring-2 focus:ring-indigo-500/30 ${
                  isDark
                    ? "bg-[#12131c] border-white/10 text-slate-200"
                    : "bg-slate-50 border-slate-200 text-slate-800"
                }`}
              >
                {projects.map((p) => (
                  <option key={p._id} value={p._id}>
                    [{p.prefix}] {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={`text-xs font-bold block mb-1.5 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                Task Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className={`w-full text-xs font-semibold rounded-xl px-3.5 py-2.5 border focus:outline-none focus:ring-2 focus:ring-indigo-500/30 ${
                  isDark
                    ? "bg-[#12131c] border-white/10 text-slate-200"
                    : "bg-slate-50 border-slate-200 text-slate-800"
                }`}
              >
                <option value="task">Regular Task</option>
                <option value="bug">Bug / Issue</option>
                <option value="client_request">Client Request</option>
                <option value="approval">Office Approval</option>
              </select>
            </div>
          </div>

          {/* Title with Gemini AI button */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className={`text-xs font-bold ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                Task Title *
              </label>

              {/* Gemini AI Breakdown Button */}
              <button
                type="button"
                onClick={handleAIBreakdown}
                disabled={loadingAI}
                className="flex items-center gap-1.5 text-xs text-white font-semibold bg-gradient-to-r from-indigo-500 to-purple-600 hover:opacity-95 px-3 py-1 rounded-xl shadow-md shadow-indigo-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                title="Use Gemini AI to analyze title, draft description and generate subtask checklist"
              >
                <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                <span>{loadingAI ? "Analyzing..." : "AI Breakdown"}</span>
              </button>
            </div>
            <input
              type="text"
              placeholder="e.g. Migrate payment gateway to Stripe or Refactor user auth flow"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={`w-full rounded-xl px-3.5 py-2.5 text-sm font-medium border focus:outline-none focus:ring-2 focus:ring-indigo-500/30 ${
                isDark
                  ? "bg-[#12131c] border-white/10 text-slate-100 placeholder-slate-500 focus:bg-[#181926]"
                  : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:bg-white"
              }`}
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className={`text-xs font-bold block mb-1.5 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
              Description & Specifications
            </label>
            <textarea
              rows={4}
              placeholder="What needs to be done? Acceptance criteria, links, or notes..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={`w-full rounded-xl p-3.5 text-xs sm:text-sm border focus:outline-none focus:ring-2 focus:ring-indigo-500/30 ${
                isDark
                  ? "bg-[#12131c] border-white/10 text-slate-100 placeholder-slate-500 focus:bg-[#181926]"
                  : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:bg-white"
              }`}
            />
          </div>

          {/* Assignee & Priority row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className={`text-xs font-bold block mb-1.5 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                Assignee
              </label>
              <select
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                className={`w-full text-xs font-semibold rounded-xl px-3.5 py-2.5 border focus:outline-none focus:ring-2 focus:ring-indigo-500/30 cursor-pointer ${
                  isDark
                    ? "bg-[#12131c] border-white/10 text-slate-200"
                    : "bg-slate-50 border-slate-200 text-slate-800"
                }`}
              >
                <option value="">Leave Unassigned (Backlog)</option>
                {teamMembers.map((m) => (
                  <option key={m._id} value={m._id}>
                    {m.fullname} ({m.departmentName || "General"})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={`text-xs font-bold block mb-1.5 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className={`w-full text-xs font-semibold rounded-xl px-3.5 py-2.5 border focus:outline-none focus:ring-2 focus:ring-indigo-500/30 cursor-pointer ${
                  isDark
                    ? "bg-[#12131c] border-white/10 text-slate-200"
                    : "bg-slate-50 border-slate-200 text-slate-800"
                }`}
              >
                <option value="low">⚪ Low</option>
                <option value="medium">🟡 Medium</option>
                <option value="high">🟠 High</option>
                <option value="urgent">🔴 Urgent</option>
              </select>
            </div>
          </div>

          {/* Due Date & Estimated Hours row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className={`text-xs font-bold block mb-1.5 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                Due Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className={`w-full text-xs font-semibold rounded-xl px-3.5 py-2.5 border focus:outline-none focus:ring-2 focus:ring-indigo-500/30 ${
                  isDark
                    ? "bg-[#12131c] border-white/10 text-slate-200"
                    : "bg-slate-50 border-slate-200 text-slate-800"
                }`}
              />
            </div>

            <div>
              <label className={`text-xs font-bold block mb-1.5 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                Estimated Hours
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                placeholder="e.g. 8"
                value={estimatedHours}
                onChange={(e) => setEstimatedHours(e.target.value)}
                className={`w-full text-xs font-semibold rounded-xl px-3.5 py-2.5 border focus:outline-none focus:ring-2 focus:ring-indigo-500/30 ${
                  isDark
                    ? "bg-[#12131c] border-white/10 text-slate-200"
                    : "bg-slate-50 border-slate-200 text-slate-800"
                }`}
              />
            </div>
          </div>

          {/* Subtasks Builder */}
          <div>
            <label className={`text-xs font-bold block mb-2 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
              Subtasks Checklist ({subtasks.length})
            </label>

            {subtasks.length > 0 && (
              <div className="space-y-2 mb-3">
                {subtasks.map((st, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center justify-between p-2.5 rounded-xl border text-xs ${
                      isDark
                        ? "bg-[#12131c] border-white/10 text-slate-200"
                        : "bg-slate-50 border-slate-200 text-slate-800"
                    }`}
                  >
                    <span className="font-medium">• {st.title}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveSubtask(idx)}
                      className="text-slate-400 hover:text-rose-500 p-1 rounded transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Type subtask and press enter..."
                value={newSubtask}
                onChange={(e) => setNewSubtask(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddSubtask(e);
                  }
                }}
                className={`flex-1 rounded-xl px-3.5 py-2 text-xs border focus:outline-none focus:ring-2 focus:ring-indigo-500/30 ${
                  isDark
                    ? "bg-[#12131c] border-white/10 text-slate-100 placeholder-slate-500"
                    : "bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400"
                }`}
              />
              <button
                type="button"
                onClick={handleAddSubtask}
                className={`px-4 py-2 text-xs font-semibold rounded-xl transition-colors ${
                  isDark
                    ? "bg-white/10 hover:bg-white/15 text-slate-200"
                    : "bg-slate-200 hover:bg-slate-300 text-slate-800"
                }`}
              >
                Add
              </button>
            </div>
          </div>

          {/* Action Footer */}
          <div className={`pt-4 border-t flex items-center justify-end gap-3 ${isDark ? "border-white/10" : "border-slate-200"}`}>
            <button
              type="button"
              onClick={onClose}
              className={`px-4.5 py-2.5 text-xs font-semibold rounded-xl transition-colors ${
                isDark ? "text-slate-400 hover:bg-white/5" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-md shadow-indigo-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              {submitting ? "Creating..." : "Create Task"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
