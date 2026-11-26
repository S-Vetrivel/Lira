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
import { getGlassTokens } from "../../styles/glassTheme";
import AssignmentSelector from "./AssignmentSelector";

export default function CreateTaskModal({ isOpen, onClose, onCreated }) {
  const {
    user,
    projects,
    activeProject,
    teamMembers,
    departments,
    isSuperAdmin,
    hasPermission,
    aiPrefillDraft,
    setAiPrefillDraft,
    theme,
  } = useApp();
  const isDark = theme === "dark";
  const g = getGlassTokens(isDark);
  const canAssignTask = isSuperAdmin || hasPermission("tasks.assign");

  const [projectId, setProjectId] = useState(activeProject?._id || "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("task");
  const [priority, setPriority] = useState("medium");
  const [assignees, setAssignees] = useState([]);
  const [assignedDepartments, setAssignedDepartments] = useState([]);
  const [dueDate, setDueDate] = useState("");
  const [estimatedHours, setEstimatedHours] = useState("");
  const [subtasks, setSubtasks] = useState([]);
  const [newSubtask, setNewSubtask] = useState("");

  const [loadingAI, setLoadingAI] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [prefilledByAI, setPrefilledByAI] = useState(false);

  useEffect(() => {
    if (!isOpen) setPrefilledByAI(false);
    else if (activeProject?._id && !prefilledByAI) {
      setProjectId(activeProject._id);
    }
  }, [isOpen, activeProject?._id, prefilledByAI]);

  useEffect(() => {
    const onOtherSidebar = (e) => {
      if (isOpen && e?.detail?.id && e.detail.id !== "create-task") onClose?.();
    };
    const onCloseAll = () => onClose?.();
    window.addEventListener("lira:sidebar-opened", onOtherSidebar);
    window.addEventListener("lira:close-all-sidebars", onCloseAll);
    return () => {
      window.removeEventListener("lira:sidebar-opened", onOtherSidebar);
      window.removeEventListener("lira:close-all-sidebars", onCloseAll);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    window.dispatchEvent(new CustomEvent("lira:sidebar-opened", { detail: { id: "create-task" } }));
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    let typeTimer = null;
    if (aiPrefillDraft?.type === "create_task" && aiPrefillDraft?.data) {
      const d = aiPrefillDraft.data;
      if (d.projectId) setProjectId(d.projectId);
      if (d.description) setDescription(d.description);
      if (d.type) setType(d.type);
      if (d.priority) setPriority(d.priority);
      if (d.dueDate) setDueDate(String(d.dueDate).slice(0, 10));
      if (Array.isArray(d.assignees)) setAssignees(d.assignees);
      if (Array.isArray(d.assignedDepartments)) setAssignedDepartments(d.assignedDepartments);
      if (Array.isArray(d.subtasks)) {
        setSubtasks(d.subtasks.map((s) => ({ title: typeof s === "string" ? s : s.title || "" })).filter((s) => s.title));
      }

      if (d.title) {
        if (d.cursorWalkthrough) {
          setTitle("");
          const targetTitle = String(d.title);
          let idx = 0;
          typeTimer = setInterval(() => {
            idx += 1;
            setTitle(targetTitle.slice(0, idx));
            if (idx >= targetTitle.length && typeTimer) {
              clearInterval(typeTimer);
              typeTimer = null;
            }
          }, 28);
        } else {
          setTitle(d.title);
        }
      }
      setPrefilledByAI(true);
      setAiPrefillDraft(null);
    }
    return () => {
      if (typeTimer) clearInterval(typeTimer);
    };
  }, [aiPrefillDraft, setAiPrefillDraft]);

  if (!isOpen) return null;

  // Smart Task Breakdown
  const handleAIBreakdown = async () => {
    if (!title.trim()) {
      toast.error("Please enter a task title first to generate a breakdown.");
      return;
    }

    setLoadingAI(true);
    const toastId = toast.loading("Generating task breakdown...");
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
      assignee: canAssignTask ? assignees[0] || null : null,
      assignees: canAssignTask ? assignees : [],
      assignedDepartments: canAssignTask ? assignedDepartments : [],
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
      setAssignees([]);
      setAssignedDepartments([]);
      setDueDate("");
      setEstimatedHours("");
    }
  };

  return (
    <div className="fixed inset-0 z-[70] overflow-hidden flex justify-end">
      {/* Subtle Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/45 backdrop-blur-[2px] transition-opacity animate-in fade-in duration-150"
      />

      {/* Slide-over Side Drawer */}
      <div
        className={`relative w-full max-w-xl h-full flex flex-col z-10 border-l lira-glass-drawer animate-in slide-in-from-right duration-200 ${
          isDark ? "text-slate-100" : "text-slate-900"
        }`}
      >
        {/* Header */}
        <div
          className={`px-6 py-4 border-b flex items-center justify-between shrink-0 ${g.subHeader}`}
        >
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl border flex items-center justify-center ${g.badge}`}>
              <Plus className="w-4 h-4" />
            </div>
            <div>
              <h2 className={`text-sm sm:text-base font-bold leading-tight ${g.heading}`}>
                Create New Task
              </h2>
              <p className={`text-xs mt-0.5 ${g.muted}`}>
                Create and assign a new task to your workspace
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${g.iconBtn}`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4.5">
          {prefilledByAI && (
            <div className="p-3 rounded-xl border border-purple-500/35 bg-purple-500/10 text-purple-300 text-xs flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
              <span>Pre-filled by <strong>Lira AI</strong> (Review Mode) — verify fields and submit when ready.</span>
            </div>
          )}
          {/* Project & Task Type row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className={`text-xs font-bold block mb-1.5 ${g.heading}`}>
                Project Workspace *
              </label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className={`w-full text-xs font-semibold rounded-xl px-3.5 py-2.5 border focus:outline-none ${g.input}`}
              >
                {projects.map((p) => (
                  <option key={p._id} value={p._id} className={isDark ? "bg-[#14151a] text-white" : "bg-white text-slate-900"}>
                    [{p.prefix}] {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={`text-xs font-bold block mb-1.5 ${g.heading}`}>
                Task Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className={`w-full text-xs font-semibold rounded-xl px-3.5 py-2.5 border focus:outline-none ${g.input}`}
              >
                <option value="task" className={isDark ? "bg-[#14151a] text-white" : "bg-white text-slate-900"}>Regular Task</option>
                <option value="bug" className={isDark ? "bg-[#14151a] text-white" : "bg-white text-slate-900"}>Bug / Issue</option>
                <option value="client_request" className={isDark ? "bg-[#14151a] text-white" : "bg-white text-slate-900"}>Client Request</option>
                <option value="approval" className={isDark ? "bg-[#14151a] text-white" : "bg-white text-slate-900"}>Office Approval</option>
              </select>
            </div>
          </div>

          {/* Title with Gemini AI button */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className={`text-xs font-bold ${g.heading}`}>
                Task Title *
              </label>

              {/* AI Breakdown Button — gated by ai.use module action */}
              {(isSuperAdmin || hasPermission("ai.use")) && (
                <button
                  type="button"
                  onClick={handleAIBreakdown}
                  disabled={loadingAI}
                  className={`flex items-center gap-1.5 text-xs px-3 py-1 rounded-xl transition-all cursor-pointer ${g.btnSecondary}`}
                  title="Auto-generate description and subtask checklist via active AI provider"
                >
                  <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                  <span>{loadingAI ? "Generating..." : "Smart Breakdown"}</span>
                </button>
              )}
            </div>
            <input
              type="text"
              data-ai-target="task-title-input"
              placeholder="e.g. Migrate payment gateway or Refactor auth flow"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={`w-full rounded-xl px-3.5 py-2.5 text-sm font-medium border focus:outline-none ${g.input}`}
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className={`text-xs font-bold block mb-1.5 ${g.heading}`}>
              Description & Specifications
            </label>
            <textarea
              rows={4}
              placeholder="What needs to be done? Acceptance criteria, links, or notes..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={`w-full rounded-xl p-3.5 text-xs sm:text-sm border focus:outline-none ${g.input}`}
            />
          </div>

          {/* Priority row */}
          <div>
            <label className={`text-xs font-bold block mb-1.5 ${g.heading}`}>
              Priority
            </label>
            <select
              data-ai-target="task-priority-select"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className={`w-full text-xs font-semibold rounded-xl px-3.5 py-2.5 border focus:outline-none cursor-pointer ${g.input}`}
            >
              <option value="low" className={isDark ? "bg-[#14151a] text-white" : "bg-white text-slate-900"}>Low</option>
              <option value="medium" className={isDark ? "bg-[#14151a] text-white" : "bg-white text-slate-900"}>Medium</option>
              <option value="high" className={isDark ? "bg-[#14151a] text-white" : "bg-white text-slate-900"}>High</option>
              <option value="urgent" className={isDark ? "bg-[#14151a] text-white" : "bg-white text-slate-900"}>Urgent</option>
            </select>
          </div>

          {/* Multi-User / Team Assignment */}
          <AssignmentSelector
            teamMembers={teamMembers}
            departments={departments}
            project={projects.find((p) => p._id === (projectId || activeProject?._id))}
            selectedAssignees={assignees}
            selectedDepartments={assignedDepartments}
            onChangeAssignees={setAssignees}
            onChangeDepartments={setAssignedDepartments}
            canAssign={canAssignTask}
            isDark={isDark}
          />

          {/* Due Date & Estimated Hours row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className={`text-xs font-bold block mb-1.5 ${g.heading}`}>
                Due Date
              </label>
              <input
                type="date"
                data-ai-target="task-duedate-input"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className={`w-full text-xs font-semibold rounded-xl px-3.5 py-2.5 border focus:outline-none ${g.input}`}
              />
            </div>

            <div>
              <label className={`text-xs font-bold block mb-1.5 ${g.heading}`}>
                Estimated Hours
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                placeholder="e.g. 8"
                value={estimatedHours}
                onChange={(e) => setEstimatedHours(e.target.value)}
                className={`w-full text-xs font-semibold rounded-xl px-3.5 py-2.5 border focus:outline-none ${g.input}`}
              />
            </div>
          </div>

          {/* Subtasks Builder */}
          <div>
            <label className={`text-xs font-bold block mb-2 ${g.heading}`}>
              Subtasks Checklist ({subtasks.length})
            </label>

            {subtasks.length > 0 && (
              <div className="space-y-2 mb-3">
                {subtasks.map((st, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center justify-between p-2.5 rounded-xl border text-xs ${g.subtleSurface}`}
                  >
                    <span className="font-medium">• {st.title}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveSubtask(idx)}
                      className="text-zinc-400 hover:text-rose-500 p-1 rounded transition-colors cursor-pointer"
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
                className={`flex-1 rounded-xl px-3.5 py-2 text-xs border focus:outline-none ${g.input}`}
              />
              <button
                type="button"
                onClick={handleAddSubtask}
                className={`px-4 py-2 text-xs font-semibold rounded-xl transition-colors cursor-pointer ${g.btnSecondary}`}
              >
                Add
              </button>
            </div>
          </div>

          {/* Action Footer */}
          <div className={`pt-4 border-t flex items-center justify-end gap-3 ${g.border}`}>
            <button
              type="button"
              onClick={onClose}
              className={`px-4 py-2.5 text-xs font-semibold rounded-xl transition-colors cursor-pointer ${g.btnSecondary}`}
            >
              Cancel
            </button>
            <button
              type="submit"
              data-ai-target="task-submit-btn"
              disabled={submitting}
              className={`px-6 py-2.5 text-xs font-semibold rounded-xl transition-all cursor-pointer ${g.btnPrimary}`}
            >
              {submitting ? "Creating..." : "Create Task"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
