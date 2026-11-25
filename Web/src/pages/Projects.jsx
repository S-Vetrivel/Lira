import React, { useState, useRef } from "react";
import { useApp } from "../context/Appcontext";
import {
  createProject,
  updateProject,
  createDepartment,
  updateDepartment,
  addDepartmentMember,
  removeDepartmentMember,
  addProjectMember,
  removeProjectMember,
  uploadProjectFile,
  deleteProjectFile,
} from "../services/api";
import SideDrawer from "../components/common/SideDrawer";
import UserAvatar from "../components/common/UserAvatar";
import { formatDateIN, formatFileSize, getDisplayName } from "../utils/formatters";
import {
  FolderTree,
  Building,
  Plus,
  Users,
  FileText,
  Upload,
  Download,
  Trash2,
  MessageSquare,
  UserPlus,
  UserMinus,
  CheckCircle2,
  FolderKanban,
  ArrowRight,
  Settings2,
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
    refreshTeam,
    openDirectChat,
    openRoomChat,
    theme,
  } = useApp();
  const isDark = theme === "dark";
  const canManage = user?.role === "admin" || user?.role === "manager";

  // Side drawer states (instead of popup modals)
  const [showAddProjectDrawer, setShowAddProjectDrawer] = useState(false);
  const [showAddDeptDrawer, setShowAddDeptDrawer] = useState(false);
  const [selectedDept, setSelectedDept] = useState(null);
  const [selectedProj, setSelectedProj] = useState(null);
  const [projDrawerTab, setProjDrawerTab] = useState("overview"); // overview | files

  // New Project Form
  const [projName, setProjName] = useState("");
  const [projPrefix, setProjPrefix] = useState("");
  const [projDesc, setProjDesc] = useState("");
  const [projDept, setProjDept] = useState("");
  const [submittingProj, setSubmittingProj] = useState(false);

  // New Department Form
  const [deptName, setDeptName] = useState("");
  const [deptCode, setDeptCode] = useState("");
  const [deptDesc, setDeptDesc] = useState("");
  const [deptColor, setDeptColor] = useState("#6366f1");
  const [submittingDept, setSubmittingDept] = useState(false);

  // Department Staff assignment state
  const [assignUserId, setAssignUserId] = useState("");
  const [assignJobTitle, setAssignJobTitle] = useState("");

  // Project member & file state
  const [projMemberId, setProjMemberId] = useState("");
  const [uploadingProjFile, setUploadingProjFile] = useState(false);
  const projFileInputRef = useRef(null);

  const borderCol = isDark ? "border-white/[0.08]" : "border-slate-200";
  const cardBg = isDark ? "bg-[#14151c]" : "bg-white";
  const subtleBg = isDark ? "bg-[#191a24]" : "bg-slate-50";
  const mutedText = isDark ? "text-slate-400" : "text-slate-500";
  const inputClass = `w-full rounded-xl px-3.5 py-2 text-xs border focus:outline-none focus:border-indigo-500 ${
    isDark
      ? "bg-[#151720] border-white/[0.08] text-white placeholder-slate-500"
      : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400"
  }`;

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!projName.trim() || !projPrefix.trim()) return;

    setSubmittingProj(true);
    const res = await createProject({
      name: projName.trim(),
      prefix: projPrefix.trim().toUpperCase(),
      description: projDesc.trim(),
      department: projDept || null,
      lead: user._id,
    });
    setSubmittingProj(false);

    if (res.success) {
      setShowAddProjectDrawer(false);
      setProjName("");
      setProjPrefix("");
      setProjDesc("");
      setProjDept("");
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
      color: deptColor,
    });
    setSubmittingDept(false);

    if (res.success) {
      setShowAddDeptDrawer(false);
      setDeptName("");
      setDeptCode("");
      setDeptDesc("");
      refreshDepartments();
    }
  };

  // Sync live selectedDept from refreshed departments list
  const liveDept = selectedDept
    ? departments.find((d) => d._id === selectedDept._id) || selectedDept
    : null;

  const liveProj = selectedProj
    ? projects.find((p) => p._id === selectedProj._id) || selectedProj
    : null;

  const handleAssignDeptMember = async (e) => {
    e.preventDefault();
    if (!liveDept || !assignUserId) return;
    const res = await addDepartmentMember(liveDept._id, assignUserId, assignJobTitle);
    if (res.success) {
      setAssignUserId("");
      setAssignJobTitle("");
      await Promise.all([refreshDepartments(), refreshTeam()]);
    }
  };

  const handleRemoveDeptMember = async (userId) => {
    if (!liveDept) return;
    const res = await removeDepartmentMember(liveDept._id, userId);
    if (res.success) {
      await Promise.all([refreshDepartments(), refreshTeam()]);
    }
  };

  const handleDeptLeadChange = async (leadId) => {
    if (!liveDept) return;
    const res = await updateDepartment(liveDept._id, { lead: leadId || null });
    if (res.success) refreshDepartments();
  };

  const handleAddProjMember = async (e) => {
    e.preventDefault();
    if (!liveProj || !projMemberId) return;
    const res = await addProjectMember(liveProj._id, projMemberId);
    if (res.success) {
      setProjMemberId("");
      setSelectedProj(res.project);
      refreshProjects();
    }
  };

  const handleRemoveProjMember = async (userId) => {
    if (!liveProj) return;
    const res = await removeProjectMember(liveProj._id, userId);
    if (res.success) {
      setSelectedProj(res.project);
      refreshProjects();
    }
  };

  const handleUploadProjFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !liveProj) return;
    setUploadingProjFile(true);
    const res = await uploadProjectFile(liveProj._id, file);
    setUploadingProjFile(false);
    if (res.success) {
      setSelectedProj(res.project);
      refreshProjects();
    }
    e.target.value = "";
  };

  const handleDeleteProjFile = async (fileId) => {
    if (!liveProj) return;
    const res = await deleteProjectFile(liveProj._id, fileId);
    if (res.success) {
      setSelectedProj(res.project);
      refreshProjects();
    }
  };

  const handleOpenProjectChat = (proj) => {
    openRoomChat({
      id: `proj_${proj._id}`,
      name: proj.prefix,
      label: proj.name,
      type: "department",
    });
  };

  const handleOpenDepartmentChat = (dept) => {
    const deptKey = dept.name.toLowerCase().includes("engineer")
      ? "dept_engineering"
      : dept.name.toLowerCase().includes("human") || dept.name.toLowerCase().includes("hr")
      ? "dept_hr"
      : dept.name.toLowerCase().includes("finance")
      ? "dept_finance"
      : "dept_general";

    openRoomChat({
      id: deptKey,
      name: dept.name.toLowerCase().replace(/\s+/g, "-"),
      label: dept.name,
      type: "department",
    });
  };

  const unassignedToDept = liveDept
    ? teamMembers.filter(
        (m) =>
          m.department?._id !== liveDept._id &&
          m.department !== liveDept._id &&
          m.departmentName !== liveDept.name
      )
    : [];

  const nonProjectMembers = liveProj
    ? teamMembers.filter(
        (m) => !(liveProj.members || []).some((pm) => (pm._id || pm) === m._id)
      )
    : [];

  return (
    <div
      className={`flex-1 w-full h-full min-h-0 overflow-y-auto p-5 sm:p-7 space-y-8 transition-colors duration-150 ${
        isDark ? "bg-[#0c0d12]" : "bg-slate-50"
      }`}
    >
      {/* Header Banner */}
      <div className={`flex flex-wrap items-center justify-between gap-4 pb-4 border-b ${borderCol}`}>
        <div>
          <h1 className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
            Workspaces & Departments
          </h1>
          <p className={`text-xs sm:text-sm mt-1 ${mutedText}`}>
            {projects.length} project workspaces and {departments.length} departments. Click any card to manage staff, files, and team chat.
          </p>
        </div>

        {canManage && (
          <div className="flex items-center gap-2.5">
            {user?.role === "admin" && (
              <button
                onClick={() => setShowAddDeptDrawer(true)}
                className={`flex items-center gap-1.5 border text-xs font-semibold px-4 py-2 rounded-full transition-colors cursor-pointer ${
                  isDark
                    ? "bg-white/5 hover:bg-white/10 border-white/10 text-slate-200"
                    : "bg-white hover:bg-slate-100 border-slate-200 text-slate-800"
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Department</span>
              </button>
            )}
            <button
              onClick={() => setShowAddProjectDrawer(true)}
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
            <h2 className={`text-sm font-bold uppercase tracking-wider ${isDark ? "text-white" : "text-slate-900"}`}>
              Project Workspaces
            </h2>
          </div>
          <span className={`text-xs ${mutedText}`}>Manage members, shared files & team chat</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {projects.map((proj) => {
            const isActive = activeProject?._id === proj._id;
            return (
              <div
                key={proj._id}
                className={`p-5 rounded-2xl border transition-all flex flex-col justify-between gap-4 ${
                  isActive
                    ? "border-indigo-500 ring-1 ring-indigo-500/30 bg-indigo-500/[0.04]"
                    : `${cardBg} ${borderCol} hover:border-indigo-500/40`
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span
                      className={`font-mono text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                        isDark
                          ? "bg-indigo-500/15 text-indigo-300 border-indigo-500/30"
                          : "bg-indigo-50 text-indigo-700 border-indigo-200"
                      }`}
                    >
                      {proj.prefix}
                    </span>

                    <div className="flex items-center gap-1.5">
                      {isActive ? (
                        <span className="text-[10px] font-bold text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded-full border border-indigo-500/20">
                          Active Board
                        </span>
                      ) : (
                        <button
                          onClick={() => {
                            setActiveProject(proj);
                            toast.success(`Switched active board to ${proj.name}`);
                          }}
                          className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border transition-colors cursor-pointer ${
                            isDark
                              ? "border-white/10 text-slate-300 hover:bg-white/10"
                              : "border-slate-200 text-slate-700 hover:bg-slate-100"
                          }`}
                        >
                          Switch Board
                        </button>
                      )}
                    </div>
                  </div>

                  <h3 className={`font-bold text-base mb-1 leading-snug ${isDark ? "text-white" : "text-slate-900"}`}>
                    {proj.name}
                  </h3>
                  <p className={`text-xs line-clamp-2 mb-4 leading-relaxed ${mutedText}`}>
                    {proj.description || "Team workspace for tracking tasks, deliverables, and shared files."}
                  </p>
                </div>

                {/* Members preview + stats */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center -space-x-2">
                      {(proj.members || []).slice(0, 5).map((m) => (
                        <UserAvatar
                          key={m._id}
                          user={m}
                          className={`w-6 h-6 rounded-full border-2 ${
                            isDark ? "border-[#14151c]" : "border-white"
                          }`}
                          textClass="text-[9px]"
                        />
                      ))}
                      {(proj.members?.length || 0) > 5 && (
                        <span className={`pl-3 text-[10px] font-mono ${mutedText}`}>
                          +{proj.members.length - 5}
                        </span>
                      )}
                    </div>
                    <span className={`text-[11px] font-mono ${mutedText}`}>
                      {proj.files?.length || 0} files • {proj.stats?.done || 0}/{proj.stats?.total || 0} tasks
                    </span>
                  </div>

                  <div className={`w-full rounded-full h-1.5 overflow-hidden ${isDark ? "bg-white/10" : "bg-slate-200"}`}>
                    <div
                      className="bg-indigo-500 h-full rounded-full transition-all"
                      style={{ width: `${proj.stats?.progressPercent || 0}%` }}
                    />
                  </div>

                  {/* Quick Actions Footer */}
                  <div className={`pt-3 border-t flex items-center justify-between gap-2 ${borderCol}`}>
                    <button
                      onClick={() => {
                        setSelectedProj(proj);
                        setProjDrawerTab("overview");
                      }}
                      className={`flex-1 py-1.5 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                        isDark
                          ? "bg-white/[0.04] hover:bg-white/10 border-white/10 text-slate-200"
                          : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800"
                      }`}
                    >
                      <Settings2 className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Manage & Files</span>
                    </button>
                    <button
                      onClick={() => handleOpenProjectChat(proj)}
                      className={`py-1.5 px-3 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                        isDark
                          ? "bg-indigo-500/10 hover:bg-indigo-600 border-indigo-500/30 text-indigo-300 hover:text-white"
                          : "bg-indigo-50 hover:bg-indigo-600 border-indigo-200 text-indigo-700 hover:text-white"
                      }`}
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Chat</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Departments Section (Click to open Staff Management Side Drawer) */}
      <div className={`space-y-4 pt-4 border-t ${borderCol}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Building className="w-4 h-4 text-indigo-500" />
            <h2 className={`text-sm font-bold uppercase tracking-wider ${isDark ? "text-white" : "text-slate-900"}`}>
              Departments & Staff Management
            </h2>
          </div>
          <span className={`text-xs ${mutedText}`}>Click any department to assign or manage staff</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {departments.map((dept) => (
            <div
              key={dept._id}
              onClick={() => setSelectedDept(dept)}
              className={`p-5 rounded-2xl border space-y-3 transition-all cursor-pointer group ${cardBg} ${borderCol} hover:border-indigo-500/50`}
            >
              <div className="flex items-center justify-between">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: dept.color || "#6366f1" }}
                />
                <span
                  className={`font-mono text-xs font-bold px-2 py-0.5 rounded-md ${
                    isDark ? "text-slate-300 bg-white/5" : "text-slate-700 bg-slate-100"
                  }`}
                >
                  {dept.code}
                </span>
              </div>

              <div>
                <h3 className={`font-bold text-sm group-hover:text-indigo-400 transition-colors ${isDark ? "text-white" : "text-slate-900"}`}>
                  {dept.name}
                </h3>
                <p className={`text-xs line-clamp-2 mt-1 leading-relaxed ${mutedText}`}>
                  {dept.description}
                </p>
              </div>

              {/* Staff avatars preview */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center -space-x-1.5">
                  {(dept.members || []).slice(0, 4).map((m) => (
                    <UserAvatar
                      key={m._id}
                      user={m}
                      className={`w-6 h-6 rounded-full border-2 ${
                        isDark ? "border-[#14151c]" : "border-white"
                      }`}
                      textClass="text-[9px]"
                    />
                  ))}
                </div>
                <span className="text-[11px] font-semibold text-indigo-400 flex items-center gap-1">
                  Manage <ArrowRight className="w-3 h-3" />
                </span>
              </div>

              <div className={`pt-2.5 text-[11px] border-t flex justify-between ${borderCol} ${mutedText}`}>
                <span>{dept.membersCount || 0} Staff</span>
                <span>{dept.projectsCount || 0} Projects</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SIDE DRAWER 1: DEPARTMENT STAFF MANAGEMENT */}
      <SideDrawer
        isOpen={Boolean(liveDept)}
        onClose={() => setSelectedDept(null)}
        title={liveDept?.name || "Department"}
        subtitle={`${liveDept?.code || ""} • ${liveDept?.membersCount || 0} Staff • ${liveDept?.projectsCount || 0} Projects`}
        icon={Building}
        widthClass="max-w-xl"
        headerActions={
          liveDept && (
            <button
              onClick={() => handleOpenDepartmentChat(liveDept)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${
                isDark
                  ? "bg-white/[0.05] hover:bg-white/10 border-white/10 text-slate-200"
                  : "bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-800"
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
              <span>Dept Chat</span>
            </button>
          )
        }
      >
        {liveDept && (
          <div className="space-y-6">
            {/* Description & Department Lead */}
            <div className={`p-4 rounded-2xl border space-y-3 ${subtleBg} ${borderCol}`}>
              <p className={`text-xs leading-relaxed ${mutedText}`}>
                {liveDept.description || "Department operations and team coordination."}
              </p>

              <div className="flex items-center justify-between gap-3 pt-2 border-t border-white/[0.06]">
                <span className={`text-xs font-semibold ${mutedText}`}>Department Lead</span>
                {canManage ? (
                  <select
                    value={liveDept.lead?._id || liveDept.lead || ""}
                    onChange={(e) => handleDeptLeadChange(e.target.value)}
                    className={`rounded-lg px-2.5 py-1.5 text-xs border focus:outline-none ${
                      isDark ? "bg-[#0f1016] border-white/10 text-white" : "bg-white border-slate-200 text-slate-900"
                    }`}
                  >
                    <option value="">Unassigned</option>
                    {teamMembers.map((m) => (
                      <option key={m._id} value={m._id}>
                        {m.fullname}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-xs font-semibold">{getDisplayName(liveDept.lead, "Unassigned")}</span>
                )}
              </div>
            </div>

            {/* Assign Staff to Department */}
            {canManage && (
              <form onSubmit={handleAssignDeptMember} className={`p-4 rounded-2xl border space-y-3 ${cardBg} ${borderCol}`}>
                <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <UserPlus className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Assign Staff to {liveDept.name}</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <select
                    value={assignUserId}
                    onChange={(e) => setAssignUserId(e.target.value)}
                    className={inputClass}
                    required
                  >
                    <option value="">Select team member...</option>
                    {unassignedToDept.map((m) => (
                      <option key={m._id} value={m._id}>
                        {m.fullname} ({m.departmentName || "General"})
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={assignJobTitle}
                    onChange={(e) => setAssignJobTitle(e.target.value)}
                    placeholder="Optional job title update..."
                    className={inputClass}
                  />
                </div>
                <button
                  type="submit"
                  disabled={!assignUserId}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer disabled:opacity-40 ${
                    isDark ? "bg-white text-slate-950 hover:bg-slate-200" : "bg-slate-900 text-white hover:bg-slate-800"
                  }`}
                >
                  Assign to Department
                </button>
              </form>
            )}

            {/* Current Department Staff List */}
            <div className="space-y-2.5">
              <h4 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${mutedText}`}>
                <Users className="w-3.5 h-3.5" />
                <span>Department Staff ({liveDept.members?.length || 0})</span>
              </h4>

              {(liveDept.members || []).length === 0 ? (
                <div className={`p-6 rounded-2xl border border-dashed text-center text-xs ${borderCol} ${mutedText}`}>
                  No staff assigned to this department yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {liveDept.members.map((m) => (
                    <div
                      key={m._id}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${subtleBg} ${borderCol}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <UserAvatar user={m} className="w-9 h-9 rounded-xl" textClass="text-xs" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-bold truncate">{m.fullname}</p>
                            {m.publicId && (
                              <span className="text-[10px] font-mono text-indigo-400">{m.publicId}</span>
                            )}
                          </div>
                          <p className={`text-[11px] truncate ${mutedText}`}>
                            {m.jobTitle || "Staff"} • {m.role}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {m._id !== user?._id && (
                          <button
                            onClick={() => openDirectChat(m)}
                            className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold cursor-pointer ${
                              isDark
                                ? "border-white/10 hover:bg-white/10 text-slate-200"
                                : "border-slate-200 hover:bg-slate-200 text-slate-700"
                            }`}
                          >
                            DM
                          </button>
                        )}
                        {canManage && (
                          <button
                            onClick={() => handleRemoveDeptMember(m._id)}
                            className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                            title="Remove from department"
                          >
                            <UserMinus className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </SideDrawer>

      {/* SIDE DRAWER 2: PROJECT TEAM & FILE SHARING */}
      <SideDrawer
        isOpen={Boolean(liveProj)}
        onClose={() => setSelectedProj(null)}
        title={liveProj ? `[${liveProj.prefix}] ${liveProj.name}` : "Project"}
        subtitle={`${liveProj?.members?.length || 0} members • ${liveProj?.files?.length || 0} shared files`}
        icon={FolderKanban}
        widthClass="max-w-2xl"
        headerActions={
          liveProj && (
            <button
              onClick={() => handleOpenProjectChat(liveProj)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${
                isDark
                  ? "bg-white/[0.05] hover:bg-white/10 border-white/10 text-slate-200"
                  : "bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-800"
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
              <span>Project Chat</span>
            </button>
          )
        }
      >
        {liveProj && (
          <div className="space-y-5">
            {/* Drawer Tabs */}
            <div className={`flex items-center gap-4 border-b ${borderCol}`}>
              <button
                onClick={() => setProjDrawerTab("overview")}
                className={`text-xs font-semibold pb-2.5 -mb-px border-b-2 cursor-pointer ${
                  projDrawerTab === "overview"
                    ? "border-indigo-500 text-indigo-400"
                    : `border-transparent ${mutedText}`
                }`}
              >
                Team & Details ({liveProj.members?.length || 0})
              </button>
              <button
                onClick={() => setProjDrawerTab("files")}
                className={`text-xs font-semibold pb-2.5 -mb-px border-b-2 cursor-pointer ${
                  projDrawerTab === "files"
                    ? "border-indigo-500 text-indigo-400"
                    : `border-transparent ${mutedText}`
                }`}
              >
                Shared Files ({liveProj.files?.length || 0})
              </button>
            </div>

            {projDrawerTab === "overview" ? (
              <div className="space-y-5">
                <div className={`p-4 rounded-2xl border space-y-2 ${subtleBg} ${borderCol}`}>
                  <p className={`text-xs leading-relaxed ${mutedText}`}>
                    {liveProj.description || "Project workspace."}
                  </p>
                  <div className="flex flex-wrap items-center gap-4 pt-2 text-xs">
                    <span>
                      Lead: <strong>{getDisplayName(liveProj.lead)}</strong>
                    </span>
                    <span>
                      Department: <strong>{liveProj.department?.name || "General"}</strong>
                    </span>
                    <span>
                      Completion: <strong>{liveProj.stats?.progressPercent || 0}%</strong>
                    </span>
                  </div>
                </div>

                {canManage && (
                  <form onSubmit={handleAddProjMember} className="flex gap-2">
                    <select
                      value={projMemberId}
                      onChange={(e) => setProjMemberId(e.target.value)}
                      className={inputClass}
                    >
                      <option value="">Add member to project...</option>
                      {nonProjectMembers.map((m) => (
                        <option key={m._id} value={m._id}>
                          {m.fullname} ({m.departmentName || "General"})
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      disabled={!projMemberId}
                      className={`px-4 py-2 rounded-xl text-xs font-semibold shrink-0 cursor-pointer disabled:opacity-40 ${
                        isDark ? "bg-white text-slate-950" : "bg-slate-900 text-white"
                      }`}
                    >
                      Add
                    </button>
                  </form>
                )}

                <div className="space-y-2">
                  {(liveProj.members || []).map((m) => (
                    <div
                      key={m._id}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${subtleBg} ${borderCol}`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <UserAvatar user={m} className="w-8 h-8 rounded-xl" textClass="text-xs" />
                        <div className="min-w-0">
                          <p className="text-xs font-bold truncate">{getDisplayName(m)}</p>
                          <p className={`text-[10px] truncate ${mutedText}`}>
                            {m.jobTitle || m.role} • {m.departmentName || "General"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {m._id !== user?._id && (
                          <button
                            onClick={() => openDirectChat(m)}
                            className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold cursor-pointer ${
                              isDark ? "border-white/10 hover:bg-white/10" : "border-slate-200 hover:bg-slate-200"
                            }`}
                          >
                            DM
                          </button>
                        )}
                        {canManage && (
                          <button
                            onClick={() => handleRemoveProjMember(m._id)}
                            className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                            title="Remove from project"
                          >
                            <UserMinus className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className={`text-xs ${mutedText}`}>
                    Files shared here are accessible to everyone in {liveProj.name}.
                  </p>
                  <button
                    onClick={() => projFileInputRef.current?.click()}
                    disabled={uploadingProjFile}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${
                      isDark ? "bg-white text-slate-950 hover:bg-slate-200" : "bg-slate-900 text-white hover:bg-slate-800"
                    }`}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{uploadingProjFile ? "Uploading..." : "Upload File"}</span>
                  </button>
                  <input
                    ref={projFileInputRef}
                    type="file"
                    onChange={handleUploadProjFile}
                    className="hidden"
                  />
                </div>

                {(liveProj.files || []).length === 0 ? (
                  <div
                    onClick={() => projFileInputRef.current?.click()}
                    className={`p-10 rounded-2xl border border-dashed text-center cursor-pointer space-y-2 ${borderCol} ${mutedText}`}
                  >
                    <FileText className="w-7 h-7 mx-auto opacity-60" />
                    <p className="text-xs font-medium">Click to share a file with the project team</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {liveProj.files.map((f) => (
                      <div
                        key={f._id}
                        className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${subtleBg} ${borderCol}`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <FileText className="w-4 h-4 text-indigo-400 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs font-semibold truncate">{f.originalName}</p>
                            <p className={`text-[10px] ${mutedText}`}>
                              {formatFileSize(f.size)} • {getDisplayName(f.uploadedBy, "Team")} • {formatDateIN(f.uploadedAt)}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <a
                            href={f.url}
                            download={f.originalName}
                            target="_blank"
                            rel="noreferrer"
                            className={`p-1.5 rounded-lg border ${
                              isDark ? "border-white/10 hover:bg-white/10" : "border-slate-200 hover:bg-slate-200"
                            }`}
                            title="Download"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>
                          <button
                            onClick={() => handleDeleteProjFile(f._id)}
                            className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                            title="Remove file"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </SideDrawer>

      {/* SIDE DRAWER 3: CREATE PROJECT */}
      <SideDrawer
        isOpen={showAddProjectDrawer}
        onClose={() => setShowAddProjectDrawer(false)}
        title="New Project Workspace"
        subtitle="Create a dedicated project board, shared files hub, and team chat"
        icon={FolderTree}
        widthClass="max-w-md"
      >
        <form onSubmit={handleCreateProject} className="space-y-4">
          <div>
            <label className="text-xs font-semibold block mb-1">Project Name *</label>
            <input
              type="text"
              placeholder="e.g. Mobile App"
              value={projName}
              onChange={(e) => setProjName(e.target.value)}
              className={inputClass}
              required
            />
          </div>

          <div>
            <label className="text-xs font-semibold block mb-1">Ticket Prefix *</label>
            <input
              type="text"
              placeholder="e.g. MOB"
              maxLength={5}
              value={projPrefix}
              onChange={(e) => setProjPrefix(e.target.value.toUpperCase())}
              className={`${inputClass} font-mono font-bold uppercase`}
              required
            />
          </div>

          <div>
            <label className="text-xs font-semibold block mb-1">Description</label>
            <textarea
              rows={3}
              placeholder="Workspace scope..."
              value={projDesc}
              onChange={(e) => setProjDesc(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className="text-xs font-semibold block mb-1">Department</label>
            <select value={projDept} onChange={(e) => setProjDept(e.target.value)} className={inputClass}>
              <option value="">None / General</option>
              {departments.map((d) => (
                <option key={d._id} value={d._id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div className={`pt-4 flex justify-end gap-2 border-t ${borderCol}`}>
            <button
              type="button"
              onClick={() => setShowAddProjectDrawer(false)}
              className={`px-4 py-2 text-xs font-semibold rounded-xl ${mutedText}`}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submittingProj}
              className={`px-5 py-2 text-xs font-semibold rounded-xl cursor-pointer ${
                isDark ? "bg-white text-slate-950 hover:bg-slate-200" : "bg-slate-900 text-white hover:bg-slate-800"
              }`}
            >
              {submittingProj ? "Creating..." : "Create Project"}
            </button>
          </div>
        </form>
      </SideDrawer>

      {/* SIDE DRAWER 4: CREATE DEPARTMENT */}
      <SideDrawer
        isOpen={showAddDeptDrawer}
        onClose={() => setShowAddDeptDrawer(false)}
        title="New Department"
        subtitle="Create a department to organize staff and projects"
        icon={Building}
        widthClass="max-w-md"
      >
        <form onSubmit={handleCreateDept} className="space-y-4">
          <div>
            <label className="text-xs font-semibold block mb-1">Department Name *</label>
            <input
              type="text"
              placeholder="e.g. Design"
              value={deptName}
              onChange={(e) => setDeptName(e.target.value)}
              className={inputClass}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold block mb-1">Department Code *</label>
              <input
                type="text"
                placeholder="e.g. DES"
                maxLength={4}
                value={deptCode}
                onChange={(e) => setDeptCode(e.target.value.toUpperCase())}
                className={`${inputClass} font-mono font-bold uppercase`}
                required
              />
            </div>

            <div>
              <label className="text-xs font-semibold block mb-1">Accent Color</label>
              <input
                type="color"
                value={deptColor}
                onChange={(e) => setDeptColor(e.target.value)}
                className="w-full h-9 rounded-xl border border-white/10 bg-transparent cursor-pointer"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold block mb-1">Description</label>
            <textarea
              rows={3}
              placeholder="Department responsibilities..."
              value={deptDesc}
              onChange={(e) => setDeptDesc(e.target.value)}
              className={inputClass}
            />
          </div>

          <div className={`pt-4 flex justify-end gap-2 border-t ${borderCol}`}>
            <button
              type="button"
              onClick={() => setShowAddDeptDrawer(false)}
              className={`px-4 py-2 text-xs font-semibold rounded-xl ${mutedText}`}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submittingDept}
              className={`px-5 py-2 text-xs font-semibold rounded-xl cursor-pointer ${
                isDark ? "bg-white text-slate-950 hover:bg-slate-200" : "bg-slate-900 text-white hover:bg-slate-800"
              }`}
            >
              {submittingDept ? "Creating..." : "Create Department"}
            </button>
          </div>
        </form>
      </SideDrawer>
    </div>
  );
}
