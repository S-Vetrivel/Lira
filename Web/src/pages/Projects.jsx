import React, { useState } from "react";
import { useApp } from "../context/Appcontext";
import { createProject, createDepartment } from "../services/api";
import {
  FolderTree,
  Building,
  Plus,
  ArrowRight,
  X,
  FolderKanban,
} from "lucide-react";
import toast from "react-hot-toast";

export default function Projects() {
  const {
    user,
    projects,
    activeProject,
    setActiveProject,
    departments,
    teamMembers,
    refreshProjects,
    refreshDepartments,
    theme,
  } = useApp();
  const isDark = theme === "dark";

  const [showAddProjectModal, setShowAddProjectModal] = useState(false);
  const [showAddDeptModal, setShowAddDeptModal] = useState(false);

  // New Project Form
  const [projName, setProjName] = useState("");
  const [projPrefix, setProjPrefix] = useState("");
  const [projDesc, setProjDesc] = useState("");
  const [projDept, setProjDept] = useState("");
  const [projLead, setProjLead] = useState("");
  const [submittingProj, setSubmittingProj] = useState(false);

  // New Department Form
  const [deptName, setDeptName] = useState("");
  const [deptCode, setDeptCode] = useState("");
  const [deptDesc, setDeptDesc] = useState("");
  const [submittingDept, setSubmittingDept] = useState(false);

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!projName.trim() || !projPrefix.trim()) return;

    setSubmittingProj(true);
    const res = await createProject({
      name: projName.trim(),
      prefix: projPrefix.trim().toUpperCase(),
      description: projDesc.trim(),
      department: projDept || null,
      lead: projLead || user._id,
    });
    setSubmittingProj(false);

    if (res.success) {
      toast.success(`Project ${projPrefix} created successfully!`);
      setShowAddProjectModal(false);
      setProjName("");
      setProjPrefix("");
      setProjDesc("");
      refreshProjects();
    }
  };

  const handleCreateDept = async (e) => {
    e.preventDefault();
    if (!deptName.trim() || !deptCode.trim()) return;

    setSubmittingDept(true);
    const res = await createDepartment({
      name: deptName.trim(),
      code: deptCode.trim().toUpperCase(),
      description: deptDesc.trim(),
    });
    setSubmittingDept(false);

    if (res.success) {
      toast.success(`Department ${deptName} created successfully!`);
      setShowAddDeptModal(false);
      setDeptName("");
      setDeptCode("");
      setDeptDesc("");
      refreshDepartments();
    }
  };

  return (
    <div
      className={`flex-1 w-full h-full min-h-0 overflow-y-auto p-5 sm:p-7 space-y-8 transition-colors duration-150 ${
        isDark ? "bg-[#0c0d12]" : "bg-slate-50"
      }`}
    >
      {/* Header Banner */}
      <div
        className={`flex flex-wrap items-center justify-between gap-4 pb-4 border-b ${
          isDark ? "border-white/10" : "border-slate-200"
        }`}
      >
        <div>
          <h1
            className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${
              isDark ? "text-white" : "text-slate-900"
            }`}
          >
            Workspaces & Departments
          </h1>
          <p className={`text-xs sm:text-sm mt-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
            {projects.length} project workspaces and {departments.length} departments.
          </p>
        </div>

        {(user?.role === "admin" || user?.role === "manager") && (
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setShowAddProjectModal(true)}
              className={`flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-full transition-all cursor-pointer ${
                isDark ? "bg-white text-slate-950 hover:bg-slate-200" : "bg-slate-900 text-white hover:bg-slate-800"
              }`}
            >
              <Plus className="w-4 h-4" />
              <span>New Project</span>
            </button>
          </div>
        )}
      </div>

      {/* 1. Projects Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderTree className="w-4 h-4 text-indigo-500" />
            <h2
              className={`text-sm font-bold uppercase tracking-wider ${
                isDark ? "text-white" : "text-slate-900"
              }`}
            >
              Project Boards
            </h2>
          </div>
          <span className="text-xs text-slate-400">Click a card to switch board</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {projects.map((proj) => {
            const isActive = activeProject?._id === proj._id;
            return (
              <div
                key={proj._id}
                onClick={() => {
                  setActiveProject(proj);
                  toast.success(`Switched active board to ${proj.name}`);
                }}
                className={`p-6 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                  isActive
                    ? "border-indigo-500 ring-2 ring-indigo-500/20 shadow-lg bg-indigo-500/5"
                    : isDark
                    ? "bg-[#15161f] border-white/10 hover:border-white/20"
                    : "bg-white border-slate-200 hover:border-indigo-300 shadow-xs"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span
                      className={`font-mono text-xs font-bold px-2.5 py-1 rounded-full border ${
                        isDark
                          ? "bg-blue-500/15 text-blue-400 border-blue-500/30"
                          : "bg-blue-50 text-blue-700 border-blue-200"
                      }`}
                    >
                      {proj.prefix}
                    </span>
                    {isActive ? (
                      <span className="text-[10px] font-bold text-indigo-500 bg-indigo-500/10 px-2.5 py-0.5 rounded-full border border-indigo-500/20">
                        Active Board
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400 group-hover:text-slate-300">
                        Select →
                      </span>
                    )}
                  </div>

                  <h3
                    className={`font-bold text-base mb-1 leading-snug ${
                      isDark ? "text-white" : "text-slate-900"
                    }`}
                  >
                    {proj.name}
                  </h3>
                  <p className={`text-xs line-clamp-2 mb-4 leading-relaxed ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                    {proj.description || "Agile team workspace for tracking deliverables and issues."}
                  </p>
                </div>

                <div
                  className={`pt-3 border-t space-y-2 text-xs ${
                    isDark ? "border-white/5" : "border-slate-100"
                  }`}
                >
                  <div className={`flex items-center justify-between ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                    <span>Progress</span>
                    <span className={`font-mono font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
                      {proj.stats?.done || 0}/{proj.stats?.total || 0} tasks
                    </span>
                  </div>

                  <div className={`w-full rounded-full h-1.5 overflow-hidden ${isDark ? "bg-white/10" : "bg-slate-200"}`}>
                    <div
                      className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full rounded-full transition-all"
                      style={{ width: `${proj.stats?.progressPercent || 0}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Departments Section */}
      <div className={`space-y-4 pt-4 border-t ${isDark ? "border-white/10" : "border-slate-200"}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Building className="w-4 h-4 text-indigo-500" />
            <h2
              className={`text-sm font-bold uppercase tracking-wider ${
                isDark ? "text-white" : "text-slate-900"
              }`}
            >
              Departments
            </h2>
          </div>

          {user?.role === "admin" && (
            <button
              onClick={() => setShowAddDeptModal(true)}
              className={`flex items-center gap-1.5 border text-xs font-semibold px-3 py-1.5 rounded-full transition-colors cursor-pointer ${
                isDark
                  ? "bg-white/5 hover:bg-white/10 border-white/10 text-slate-200"
                  : "bg-white hover:bg-slate-100 border-slate-200 text-slate-700 shadow-xs"
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Department</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {departments.map((dept) => (
            <div
              key={dept._id}
              className={`p-5 rounded-2xl border space-y-2.5 transition-all ${
                isDark
                  ? "bg-[#15161f] border-white/10 shadow-sm"
                  : "bg-white border-slate-200 shadow-xs"
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: dept.color || "#3B82F6" }}
                />
                <span
                  className={`font-mono text-xs font-bold px-2 py-0.5 rounded-md ${
                    isDark ? "text-slate-400 bg-white/5" : "text-slate-600 bg-slate-100"
                  }`}
                >
                  {dept.code}
                </span>
              </div>
              <h3
                className={`font-bold text-sm ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
              >
                {dept.name}
              </h3>
              <p className={`text-xs line-clamp-2 leading-relaxed ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                {dept.description}
              </p>
              <div
                className={`pt-2 text-[11px] border-t flex justify-between ${
                  isDark ? "border-white/5 text-slate-500" : "border-slate-100 text-slate-500"
                }`}
              >
                <span>{dept.membersCount || 0} Staff</span>
                <span>{dept.projectsCount || 0} Projects</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add Project Modal */}
      {showAddProjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => setShowAddProjectModal(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
          />
          <div
            className={`relative w-full max-w-md rounded-3xl shadow-2xl border p-6 space-y-4 z-10 animate-in zoom-in-95 ${
              isDark
                ? "bg-[#181924] border-white/10 text-white"
                : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <div
              className={`flex items-center justify-between pb-3 border-b ${
                isDark ? "border-white/10" : "border-slate-100"
              }`}
            >
              <h3 className="font-bold text-base">
                Create Project Workspace
              </h3>
              <button
                onClick={() => setShowAddProjectModal(false)}
                className={`p-1 rounded-lg ${isDark ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-900"}`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateProject} className="space-y-3.5">
              <div>
                <label className={`text-xs font-semibold block mb-1 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                  Project Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Mobile App"
                  value={projName}
                  onChange={(e) => setProjName(e.target.value)}
                  className={`w-full border rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-indigo-500 ${
                    isDark
                      ? "bg-[#12131b] border-white/10 text-white placeholder-slate-500"
                      : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400"
                  }`}
                  required
                />
              </div>

              <div>
                <label className={`text-xs font-semibold block mb-1 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                  Ticket Prefix * (2-4 uppercase letters)
                </label>
                <input
                  type="text"
                  placeholder="e.g. MOB"
                  maxLength={5}
                  value={projPrefix}
                  onChange={(e) => setProjPrefix(e.target.value.toUpperCase())}
                  className={`w-full border rounded-xl px-3.5 py-2 font-mono font-bold text-xs uppercase focus:outline-none focus:border-indigo-500 ${
                    isDark
                      ? "bg-[#12131b] border-white/10 text-white placeholder-slate-500"
                      : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400"
                  }`}
                  required
                />
                <span className={`text-[10px] mt-1 block ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                  Tasks will be numbered like {projPrefix || "MOB"}-101, {projPrefix || "MOB"}-102
                </span>
              </div>

              <div>
                <label className={`text-xs font-semibold block mb-1 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Workspace scope..."
                  value={projDesc}
                  onChange={(e) => setProjDesc(e.target.value)}
                  className={`w-full border rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-indigo-500 ${
                    isDark
                      ? "bg-[#12131b] border-white/10 text-white placeholder-slate-500"
                      : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400"
                  }`}
                />
              </div>

              <div>
                <label className={`text-xs font-semibold block mb-1 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                  Department
                </label>
                <select
                  value={projDept}
                  onChange={(e) => setProjDept(e.target.value)}
                  className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none ${
                    isDark
                      ? "bg-[#12131b] border-white/10 text-white"
                      : "bg-slate-50 border-slate-200 text-slate-900"
                  }`}
                >
                  <option value="">None / General</option>
                  {departments.map((d) => (
                    <option key={d._id} value={d._id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div
                className={`pt-3 flex justify-end gap-2 border-t ${
                  isDark ? "border-white/10" : "border-slate-100"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setShowAddProjectModal(false)}
                  className={`px-4 py-2 text-xs font-semibold rounded-xl ${
                    isDark ? "text-slate-400 hover:text-white" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingProj}
                  className="px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-500/20"
                >
                  {submittingProj ? "Creating..." : "Create Project"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Department Modal */}
      {showAddDeptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => setShowAddDeptModal(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
          />
          <div
            className={`relative w-full max-w-md rounded-3xl shadow-2xl border p-6 space-y-4 z-10 animate-in zoom-in-95 ${
              isDark
                ? "bg-[#181924] border-white/10 text-white"
                : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <div
              className={`flex items-center justify-between pb-3 border-b ${
                isDark ? "border-white/10" : "border-slate-100"
              }`}
            >
              <h3 className="font-bold text-base">
                Create Department
              </h3>
              <button
                onClick={() => setShowAddDeptModal(false)}
                className={`p-1 rounded-lg ${isDark ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-900"}`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateDept} className="space-y-3.5">
              <div>
                <label className={`text-xs font-semibold block mb-1 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                  Department Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Design"
                  value={deptName}
                  onChange={(e) => setDeptName(e.target.value)}
                  className={`w-full border rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-indigo-500 ${
                    isDark
                      ? "bg-[#12131b] border-white/10 text-white placeholder-slate-500"
                      : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400"
                  }`}
                  required
                />
              </div>

              <div>
                <label className={`text-xs font-semibold block mb-1 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                  Department Code *
                </label>
                <input
                  type="text"
                  placeholder="e.g. DES"
                  maxLength={4}
                  value={deptCode}
                  onChange={(e) => setDeptCode(e.target.value.toUpperCase())}
                  className={`w-full border rounded-xl px-3.5 py-2 font-mono font-bold text-xs uppercase focus:outline-none focus:border-indigo-500 ${
                    isDark
                      ? "bg-[#12131b] border-white/10 text-white placeholder-slate-500"
                      : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400"
                  }`}
                  required
                />
              </div>

              <div
                className={`pt-3 flex justify-end gap-2 border-t ${
                  isDark ? "border-white/10" : "border-slate-100"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setShowAddDeptModal(false)}
                  className={`px-4 py-2 text-xs font-semibold rounded-xl ${
                    isDark ? "text-slate-400 hover:text-white" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingDept}
                  className="px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-500/20"
                >
                  {submittingDept ? "Creating..." : "Create Department"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
