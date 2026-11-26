import React, { useState, useRef, useEffect } from "react";
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
  invokeProjectDepartment,
  removeProjectDepartment,
  uploadProjectFile,
  deleteProjectFile,
  addProjectUrl,
  deleteProjectUrl,
  getTasks,
  createTask,
  getChatMessages,
  sendChatMessage,
  togglePinChatMessage,
} from "../services/api";
import {
  getSocket,
  joinChatRoom,
  leaveChatRoom,
  sendSocketChatMessage,
} from "../services/socket";
import { encryptText, decryptText } from "../services/crypto";
import SideDrawer from "../components/common/SideDrawer";
import UserAvatar from "../components/common/UserAvatar";
import MessageSenderPopover from "../components/chat/MessageSenderPopover";
import { formatDateIN, formatFileSize, formatTimeIN, getDisplayName } from "../utils/formatters";
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
  Link2,
  ExternalLink,
  CheckSquare,
  Send,
  Edit2,
  Pin,
  PinOff,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import { getGlassTokens } from "../styles/glassTheme";

export default function Projects() {
  const {
    user,
    isSuperAdmin,
    hasModule,
    hasPermission,
    projects,
    activeProject,
    setActiveProject,
    departments,
    teamMembers,
    refreshProjects,
    refreshDepartments,
    refreshTeam,
    setSelectedTaskKeyOrId,
    openDirectChat,
    openRoomChat,
    theme,
  } = useApp();
  const isDark = theme === "dark";
  const canViewProjects = isSuperAdmin || hasModule("projects");
  const canViewDepts = isSuperAdmin || hasModule("departments");
  const canCreateProject = isSuperAdmin || hasPermission("projects.create");
  const canEditProject = isSuperAdmin || hasPermission("projects.edit");
  const canManageProjMembers = isSuperAdmin || hasPermission("projects.members") || hasPermission("projects.edit");
  const canManageProjUrls = isSuperAdmin || hasPermission("projects.urls") || hasPermission("projects.edit");
  const canManageProjFiles = isSuperAdmin || hasPermission("projects.files") || hasPermission("projects.edit");
  const canCreateDept = isSuperAdmin || hasPermission("departments.create");
  const canEditDept = isSuperAdmin || hasPermission("departments.edit");
  const canUseChat = isSuperAdmin || hasModule("chat");
  const canSendChat = isSuperAdmin || hasPermission("chat.send");
  const canPinChat = isSuperAdmin || hasPermission("chat.pin") || hasPermission("chat.send");
  const canViewTasks = isSuperAdmin || hasModule("tasks") || hasModule("board");
  const canCreateTask = isSuperAdmin || hasPermission("tasks.create");
  const canAssignTask = isSuperAdmin || hasPermission("tasks.assign");
  const canManage = canCreateProject || canEditProject || canCreateDept || canEditDept;

  // Side drawer states (instead of popup modals)
  const [showAddProjectDrawer, setShowAddProjectDrawer] = useState(false);
  const [showAddDeptDrawer, setShowAddDeptDrawer] = useState(false);
  const [selectedDept, setSelectedDept] = useState(null);
  const [selectedProj, setSelectedProj] = useState(null);
  const [projDrawerTab, setProjDrawerTab] = useState("overview"); // overview | tasks | urls | chat | files

  // New Project Form
  const [projName, setProjName] = useState("");
  const [projPrefix, setProjPrefix] = useState("");
  const [projDesc, setProjDesc] = useState("");
  const [projDept, setProjDept] = useState("");
  const [projInvokedDepts, setProjInvokedDepts] = useState([]);
  const [projInitialMembers, setProjInitialMembers] = useState([]);
  const [submittingProj, setSubmittingProj] = useState(false);

  // New Department Form
  const [deptName, setDeptName] = useState("");
  const [deptCode, setDeptCode] = useState("");
  const [deptDesc, setDeptDesc] = useState("");
  const [deptColor, setDeptColor] = useState("#6366f1");
  const [deptLead, setDeptLead] = useState("");
  const [deptInitialMembers, setDeptInitialMembers] = useState([]);
  const [submittingDept, setSubmittingDept] = useState(false);

  // Edit Department Form
  const [isEditingDept, setIsEditingDept] = useState(false);
  const [editDeptName, setEditDeptName] = useState("");
  const [editDeptCode, setEditDeptCode] = useState("");
  const [editDeptDesc, setEditDeptDesc] = useState("");
  const [editDeptColor, setEditDeptColor] = useState("#6366f1");
  const [savingDeptEdit, setSavingDeptEdit] = useState(false);

  // Department Staff assignment state
  const [assignUserId, setAssignUserId] = useState("");
  const [assignJobTitle, setAssignJobTitle] = useState("");

  // Project member, team invoke, file, URLs, edit, tasks & sidebar chat states
  const [projMemberId, setProjMemberId] = useState("");
  const [invokeDeptId, setInvokeDeptId] = useState("");
  const [invokingDept, setInvokingDept] = useState(false);
  const [uploadingProjFile, setUploadingProjFile] = useState(false);
  const projFileInputRef = useRef(null);

  const [isEditingProj, setIsEditingProj] = useState(false);
  const [editProjName, setEditProjName] = useState("");
  const [editProjDesc, setEditProjDesc] = useState("");
  const [editProjDept, setEditProjDept] = useState("");
  const [editProjStatus, setEditProjStatus] = useState("active");
  const [savingProjEdit, setSavingProjEdit] = useState(false);

  const [urlTitle, setUrlTitle] = useState("");
  const [urlValue, setUrlValue] = useState("");
  const [urlCategory, setUrlCategory] = useState("Resource");
  const [addingUrl, setAddingUrl] = useState(false);

  const [projTasks, setProjTasks] = useState([]);
  const [loadingProjTasks, setLoadingProjTasks] = useState(false);
  const [quickTaskTitle, setQuickTaskTitle] = useState("");
  const [quickTaskAssignees, setQuickTaskAssignees] = useState([]);
  const [quickTaskDepts, setQuickTaskDepts] = useState([]);
  const [showQuickAssignOptions, setShowQuickAssignOptions] = useState(false);
  const [creatingQuickTask, setCreatingQuickTask] = useState(false);

  const [projChatMessages, setProjChatMessages] = useState([]);
  const [projChatInput, setProjChatInput] = useState("");
  const [sendingProjChat, setSendingProjChat] = useState(false);
  const [inspectedChatSender, setInspectedChatSender] = useState(null);
  const [showPinnedProjChat, setShowPinnedProjChat] = useState(false);
  const projChatEndRef = useRef(null);

  const g = getGlassTokens(isDark);
  const borderCol = g.border;
  const cardBg = g.card;
  const subtleBg = g.subtleSurface;
  const mutedText = g.muted;
  const inputClass = `w-full rounded-xl px-3.5 py-2 text-xs border focus:outline-none ${g.input}`;

  const toggleArrItem = (setter, id) => {
    setter((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!projName.trim() || !projPrefix.trim()) return;

    const allDepts = Array.from(
      new Set([...(projDept ? [projDept] : []), ...projInvokedDepts])
    );

    setSubmittingProj(true);
    const res = await createProject({
      name: projName.trim(),
      prefix: projPrefix.trim().toUpperCase(),
      description: projDesc.trim(),
      department: projDept || allDepts[0] || null,
      departments: allDepts,
      members: projInitialMembers,
      lead: user._id,
    });
    setSubmittingProj(false);

    if (res.success) {
      setShowAddProjectDrawer(false);
      setProjName("");
      setProjPrefix("");
      setProjDesc("");
      setProjDept("");
      setProjInvokedDepts([]);
      setProjInitialMembers([]);
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
      lead: deptLead || user._id,
      members: deptInitialMembers,
    });
    setSubmittingDept(false);

    if (res.success) {
      setShowAddDeptDrawer(false);
      setDeptName("");
      setDeptCode("");
      setDeptDesc("");
      setDeptLead("");
      setDeptInitialMembers([]);
      await Promise.all([refreshDepartments(), refreshTeam()]);
    }
  };

  // Sync live selectedDept from refreshed departments list
  const liveDept = selectedDept
    ? departments.find((d) => d._id === selectedDept._id) || selectedDept
    : null;

  useEffect(() => {
    if (liveDept) {
      setEditDeptName(liveDept.name || "");
      setEditDeptCode(liveDept.code || "");
      setEditDeptDesc(liveDept.description || "");
      setEditDeptColor(liveDept.color || "#6366f1");
      setIsEditingDept(false);
    }
  }, [liveDept?._id]);

  const handleSaveDeptEdit = async (e) => {
    e.preventDefault();
    if (!liveDept || !editDeptName.trim()) return;
    setSavingDeptEdit(true);
    const res = await updateDepartment(liveDept._id, {
      name: editDeptName.trim(),
      code: editDeptCode.trim().toUpperCase(),
      description: editDeptDesc.trim(),
      color: editDeptColor,
    });
    setSavingDeptEdit(false);
    if (res.success) {
      setIsEditingDept(false);
      setSelectedDept(res.department);
      await Promise.all([refreshDepartments(), refreshProjects(), refreshTeam()]);
    }
  };

  const liveProj = selectedProj
    ? projects.find((p) => p._id === selectedProj._id) || selectedProj
    : null;

  // Sync project edit fields when selecting a project
  useEffect(() => {
    if (liveProj) {
      setEditProjName(liveProj.name || "");
      setEditProjDesc(liveProj.description || "");
      setEditProjDept(liveProj.department?._id || liveProj.department || "");
      setEditProjStatus(liveProj.status || "active");
      setIsEditingProj(false);
    }
  }, [liveProj?._id]);

  // Load project tasks when tasks tab is active
  useEffect(() => {
    if (!liveProj?._id || projDrawerTab !== "tasks") return;
    setLoadingProjTasks(true);
    getTasks({ project: liveProj._id }).then((res) => {
      if (res.success) setProjTasks(res.tasks || []);
      setLoadingProjTasks(false);
    });
  }, [liveProj?._id, projDrawerTab]);

  // Live WebSocket project chat inside sidebar when chat tab is active
  useEffect(() => {
    if (!liveProj?._id || projDrawerTab !== "chat") return;
    const roomId = `proj_${liveProj._id}`;
    joinChatRoom(roomId);

    let mounted = true;
    getChatMessages(roomId, 60).then(async (res) => {
      if (res.success && mounted) {
        const dec = await Promise.all(
          res.messages.map(async (m) => ({
            ...m,
            decryptedText: await decryptText(m.encryptedPayload, m.iv, m.salt),
          }))
        );
        setProjChatMessages(dec);
      }
    });

    const socket = getSocket();
    const onMsg = async (msg) => {
      if (msg.roomId === roomId) {
        const text = await decryptText(msg.encryptedPayload, msg.iv, msg.salt);
        setProjChatMessages((prev) => {
          if (msg._id && prev.some((m) => m._id === msg._id)) return prev;
          return [...prev, { ...msg, decryptedText: text }];
        });
      }
    };
    const onPinned = (payload) => {
      const targetId = payload?.messageId || payload?._id;
      const nextPinned = payload?.isPinned ?? payload?.message?.isPinned;
      const msgObj = payload?.message || payload;
      if (payload?.roomId === roomId && targetId) {
        setProjChatMessages((prev) =>
          prev.map((m) =>
            String(m._id) === String(targetId)
              ? {
                  ...m,
                  isPinned: nextPinned,
                  pinnedBy: msgObj?.pinnedBy || null,
                  pinnedAt: msgObj?.pinnedAt || null,
                }
              : m
          )
        );
      }
    };
    socket?.on("chat:message", onMsg);
    socket?.on("chat:pinned", onPinned);

    return () => {
      mounted = false;
      leaveChatRoom(roomId);
      socket?.off("chat:message", onMsg);
      socket?.off("chat:pinned", onPinned);
    };
  }, [liveProj?._id, projDrawerTab]);

  useEffect(() => {
    if (projDrawerTab === "chat") {
      projChatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [projChatMessages, projDrawerTab]);

  const handleSaveProjEdit = async (e) => {
    e.preventDefault();
    if (!liveProj || !editProjName.trim()) return;
    setSavingProjEdit(true);
    const res = await updateProject(liveProj._id, {
      name: editProjName.trim(),
      description: editProjDesc.trim(),
      department: editProjDept || null,
      status: editProjStatus,
    });
    setSavingProjEdit(false);
    if (res.success) {
      setIsEditingProj(false);
      setSelectedProj(res.project);
      refreshProjects();
    }
  };

  const handleAddProjUrl = async (e) => {
    e.preventDefault();
    if (!liveProj || !urlTitle.trim() || !urlValue.trim()) return;
    setAddingUrl(true);
    const res = await addProjectUrl(liveProj._id, {
      title: urlTitle.trim(),
      url: urlValue.trim(),
      category: urlCategory,
    });
    setAddingUrl(false);
    if (res.success) {
      setUrlTitle("");
      setUrlValue("");
      setSelectedProj(res.project);
      refreshProjects();
    }
  };

  const handleDeleteProjUrl = async (urlId) => {
    if (!liveProj) return;
    const res = await deleteProjectUrl(liveProj._id, urlId);
    if (res.success) {
      setSelectedProj(res.project);
      refreshProjects();
    }
  };

  const handleCreateQuickTask = async (e) => {
    e.preventDefault();
    if (!liveProj || !quickTaskTitle.trim()) return;
    setCreatingQuickTask(true);
    const res = await createTask({
      project: liveProj._id,
      title: quickTaskTitle.trim(),
      status: "todo",
      priority: "medium",
      ...(canAssignTask
        ? {
            assignees: quickTaskAssignees,
            assignedDepartments: quickTaskDepts,
          }
        : {}),
    });
    setCreatingQuickTask(false);
    if (res.success && res.task) {
      setQuickTaskTitle("");
      setQuickTaskAssignees([]);
      setQuickTaskDepts([]);
      setShowQuickAssignOptions(false);
      setProjTasks((prev) => [res.task, ...prev]);
      refreshProjects();
    }
  };

  const handleTogglePinProjChat = async (messageId) => {
    if (!messageId) return;
    const res = await togglePinChatMessage(messageId);
    if (res.success) {
      setProjChatMessages((prev) =>
        prev.map((m) =>
          m._id === messageId
            ? {
                ...m,
                isPinned: res.isPinned,
                pinnedBy: res.message?.pinnedBy || null,
                pinnedAt: res.message?.pinnedAt || null,
              }
            : m
        )
      );
      toast.success(res.isPinned ? "Message pinned" : "Message unpinned");
    }
  };

  const handleInvokeProjDept = async (e) => {
    e.preventDefault();
    if (!liveProj || !invokeDeptId || invokingDept) return;
    setInvokingDept(true);
    const res = await invokeProjectDepartment(liveProj._id, invokeDeptId);
    setInvokingDept(false);
    if (res.success) {
      setInvokeDeptId("");
      setSelectedProj(res.project);
      refreshProjects();
    }
  };

  const handleRemoveProjDept = async (deptId) => {
    if (!liveProj) return;
    const res = await removeProjectDepartment(liveProj._id, deptId);
    if (res.success) {
      setSelectedProj(res.project);
      refreshProjects();
    }
  };

  const handleSendProjChat = async (e) => {
    e.preventDefault();
    if (!liveProj || !projChatInput.trim() || sendingProjChat) return;
    const text = projChatInput.trim();
    const roomId = `proj_${liveProj._id}`;
    setProjChatInput("");
    setSendingProjChat(true);
    try {
      const enc = await encryptText(text);
      const payload = {
        chatType: "department",
        roomId,
        senderId: user?._id,
        encryptedPayload: enc.ciphertext,
        iv: enc.iv,
        salt: enc.salt,
        keyId: "lira-aes-gcm-256",
      };
      let delivered = false;
      try {
        const wsRes = await sendSocketChatMessage(payload);
        if (wsRes?.success && wsRes?.message) {
          setProjChatMessages((prev) =>
            prev.some((m) => m._id === wsRes.message._id)
              ? prev
              : [...prev, { ...wsRes.message, decryptedText: text }]
          );
          delivered = true;
        }
      } catch {
        // REST fallback
      }
      if (!delivered) {
        const res = await sendChatMessage(payload);
        if (res.success && res.message) {
          setProjChatMessages((prev) =>
            prev.some((m) => m._id === res.message._id)
              ? prev
              : [...prev, { ...res.message, decryptedText: text }]
          );
        }
      }
    } finally {
      setSendingProjChat(false);
    }
  };

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
      className={`flex-1 w-full h-full min-h-0 overflow-y-auto p-5 sm:p-7 space-y-8 transition-colors duration-150 ${isDark ? "text-slate-100" : "text-slate-900"
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

        {(canCreateDept || canCreateProject) && (
          <div className="flex items-center gap-2.5">
            {canCreateDept && (
              <button
                onClick={() => setShowAddDeptDrawer(true)}
                className={`flex items-center gap-1.5 border text-xs font-semibold px-4 py-2 rounded-full transition-colors cursor-pointer ${g.btnSecondary}`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Department</span>
              </button>
            )}
            {canCreateProject && (
              <button
                onClick={() => setShowAddProjectDrawer(true)}
                className={`flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-full cursor-pointer ${g.btnPrimary}`}
              >
                <Plus className="w-4 h-4" />
                <span>New Project</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* 1. Projects Section */}
      {canViewProjects && (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderTree className={`w-4 h-4 ${g.accentIcon}`} />
            <h2 className={`text-sm font-bold uppercase tracking-wider ${g.heading}`}>
              Project Workspaces
            </h2>
          </div>
          <span className={`text-xs ${mutedText}`}>Manage members, shared files & team chat</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {projects.map((proj) => {
            const isActive = activeProject?._id === proj._id;
            const invokedDeptsList =
              Array.isArray(proj.departments) && proj.departments.length > 0
                ? proj.departments
                : proj.department
                  ? [proj.department]
                  : [];
            return (
              <div
                key={proj._id}
                className={`p-5 rounded-2xl border transition-all flex flex-col justify-between gap-4 ${
                  isActive ? g.cardActive : `${cardBg} ${borderCol}`
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className={`font-mono text-xs font-bold px-2.5 py-0.5 rounded-full border ${g.badge}`}>
                      {proj.prefix}
                    </span>

                    <div className="flex items-center gap-1.5">
                      {isActive ? (
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${g.selectedRow}`}>
                          Active Board
                        </span>
                      ) : (
                        <button
                          onClick={() => {
                            setActiveProject(proj);
                            toast.success(`Switched active board to ${proj.name}`);
                          }}
                          className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border transition-colors cursor-pointer ${g.btnSecondary}`}
                        >
                          Switch Board
                        </button>
                      )}
                    </div>
                  </div>

                  <h3 className={`font-bold text-base mb-1 leading-snug ${g.heading}`}>
                    {proj.name}
                  </h3>
                  <p className={`text-xs line-clamp-2 mb-3 leading-relaxed ${mutedText}`}>
                    {proj.description || "Team workspace for tracking tasks, deliverables, and shared files."}
                  </p>
                  {invokedDeptsList.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {invokedDeptsList.slice(0, 3).map((d) => (
                        <span
                          key={d._id || d}
                          className={`px-2 py-0.5 rounded-md border text-[10px] font-semibold ${g.subtleSurface}`}
                        >
                          {d.code || d.name || "Team"}
                        </span>
                      ))}
                      {invokedDeptsList.length > 3 && (
                        <span className={`text-[10px] font-mono ${mutedText}`}>
                          +{invokedDeptsList.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Members preview + stats */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center -space-x-2">
                      {(proj.members || []).slice(0, 5).map((m) => (
                        <UserAvatar
                          key={m._id}
                          user={m}
                          className={`w-6 h-6 rounded-full border-2 ${isDark ? "border-[#14151c]" : "border-white"}`}
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

                  <div className={`w-full rounded-full h-1.5 overflow-hidden ${g.progressTrack}`}>
                    <div
                      className={`h-full rounded-full transition-all ${g.progressFill}`}
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
                      className={`flex-1 py-1.5 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${g.btnSecondary}`}
                    >
                      <Settings2 className={`w-3.5 h-3.5 ${g.accentIcon}`} />
                      <span>Manage & Files</span>
                    </button>
                    {canUseChat && (
                      <button
                        onClick={() => handleOpenProjectChat(proj)}
                        className={`py-1.5 px-3 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${g.btnSecondary}`}
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Chat</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      )}

      {/* 2. Departments Section (Click to open Staff Management Side Drawer) */}
      {canViewDepts && (
      <div className={`space-y-4 pt-4 border-t ${borderCol}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Building className={`w-4 h-4 ${g.accentIcon}`} />
            <h2 className={`text-sm font-bold uppercase tracking-wider ${g.heading}`}>
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
              className={`p-5 rounded-2xl border space-y-3 transition-all cursor-pointer group ${cardBg} ${borderCol}`}
            >
              <div className="flex items-center justify-between">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: dept.color || "#a1a1aa" }}
                />
                <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded-md border ${g.badge}`}>
                  {dept.code}
                </span>
              </div>

              <div>
                <h3 className={`font-bold text-sm transition-colors ${g.heading}`}>
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
                      className={`w-6 h-6 rounded-full border-2 ${isDark ? "border-[#14151c]" : "border-white"}`}
                      textClass="text-[9px]"
                    />
                  ))}
                </div>
                <span className={`text-[11px] font-semibold flex items-center gap-1 ${g.accentIcon}`}>
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
      )}

      {/* SIDE DRAWER 1: DEPARTMENT STAFF MANAGEMENT */}
      <SideDrawer
        isOpen={Boolean(liveDept)}
        onClose={() => setSelectedDept(null)}
        title={liveDept?.name || "Department"}
        subtitle={`${liveDept?.code || ""} • ${liveDept?.membersCount || 0} Staff • ${liveDept?.projectsCount || 0} Projects`}
        icon={Building}
        widthClass="max-w-xl"
        headerActions={
          liveDept && canUseChat && (
            <button
              onClick={() => handleOpenDepartmentChat(liveDept)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${isDark
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
            {/* Description & Department Lead (+ Inline Edit Details) */}
            {!isEditingDept ? (
              <div className={`p-4 rounded-2xl border space-y-3 ${subtleBg} ${borderCol}`}>
                <div className="flex items-start justify-between gap-2">
                  <p className={`text-xs leading-relaxed ${mutedText}`}>
                    {liveDept.description || "Department operations and team coordination."}
                  </p>
                  {canEditDept && (
                    <button
                      type="button"
                      onClick={() => setIsEditingDept(true)}
                      className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold flex items-center gap-1 shrink-0 cursor-pointer ${
                        isDark ? "border-white/15 hover:bg-white/10" : "border-slate-200 hover:bg-slate-200"
                      }`}
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>Edit Details</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-between gap-3 pt-2 border-t border-white/[0.06]">
                  <span className={`text-xs font-semibold ${mutedText}`}>Department Lead</span>
                  {canEditDept ? (
                    <select
                      value={liveDept.lead?._id || liveDept.lead || ""}
                      onChange={(e) => handleDeptLeadChange(e.target.value)}
                      className={`rounded-lg px-2.5 py-1.5 text-xs border focus:outline-none ${isDark ? "bg-[#0f1016] border-white/10 text-white" : "bg-white border-slate-200 text-slate-900"
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
            ) : (
              <form onSubmit={handleSaveDeptEdit} className={`p-4 rounded-2xl border space-y-3 ${subtleBg} ${borderCol}`}>
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold">Edit Department Details</h4>
                  <button
                    type="button"
                    onClick={() => setIsEditingDept(false)}
                    className="text-[11px] opacity-60 hover:opacity-100 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="col-span-2">
                    <label className="text-[11px] font-semibold block mb-1">Department Name</label>
                    <input
                      type="text"
                      required
                      value={editDeptName}
                      onChange={(e) => setEditDeptName(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold block mb-1">Code</label>
                    <input
                      type="text"
                      required
                      maxLength={5}
                      value={editDeptCode}
                      onChange={(e) => setEditDeptCode(e.target.value.toUpperCase())}
                      className={`${inputClass} font-mono font-bold uppercase`}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-semibold block mb-1">Description</label>
                  <textarea
                    rows={3}
                    value={editDeptDesc}
                    onChange={(e) => setEditDeptDesc(e.target.value)}
                    placeholder="Department responsibilities and mission..."
                    className={inputClass}
                  />
                </div>
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold">Accent</span>
                    <input
                      type="color"
                      value={editDeptColor}
                      onChange={(e) => setEditDeptColor(e.target.value)}
                      className="w-8 h-7 rounded-lg border border-white/10 bg-transparent cursor-pointer"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={savingDeptEdit}
                    className={`px-4 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                      isDark ? "bg-white text-slate-950" : "bg-slate-900 text-white"
                    }`}
                  >
                    {savingDeptEdit ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </form>
            )}

            {/* Assign Staff to Department */}
            {canEditDept && (
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
                  className={`px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer disabled:opacity-40 ${isDark ? "bg-white text-slate-950 hover:bg-slate-200" : "bg-slate-900 text-white hover:bg-slate-800"
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
                            className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold cursor-pointer ${isDark
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

      {/* SIDE DRAWER 2: PROJECT WORKSPACE SIDEBAR (Team, Edit, Tasks, URLs, Chat, Files) */}
      <SideDrawer
        isOpen={Boolean(liveProj)}
        onClose={() => setSelectedProj(null)}
        title={liveProj ? `[${liveProj.prefix}] ${liveProj.name}` : "Project"}
        subtitle={`${liveProj?.members?.length || 0} members • ${liveProj?.stats?.total || 0} tasks • ${liveProj?.links?.length || 0} URLs • ${liveProj?.files?.length || 0} files`}
        icon={FolderKanban}
        widthClass="max-w-2xl"
        headerActions={
          liveProj && (
            <button
              onClick={() => handleOpenProjectChat(liveProj)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${isDark
                ? "bg-white/[0.05] hover:bg-white/10 border-white/10 text-slate-200"
                : "bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-800"
                }`}
            >
              <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
              <span>Full Chat Drawer</span>
            </button>
          )
        }
      >
        {liveProj && (
          <div className="space-y-5">
            {/* Drawer Tabs — dynamically filtered by user's modules */}
            <div className={`flex items-center gap-4 border-b overflow-x-auto no-scrollbar ${borderCol}`}>
              {[
                { id: "overview", label: `Team & Edit (${liveProj.members?.length || 0})`, show: true },
                { id: "tasks", label: `Tasks (${liveProj.stats?.total || projTasks.length})`, show: canViewTasks },
                { id: "urls", label: `URLs (${liveProj.links?.length || 0})`, show: true },
                { id: "chat", label: "Chat", show: canUseChat },
                { id: "files", label: `Files (${liveProj.files?.length || 0})`, show: true },
              ]
                .filter((tab) => tab.show)
                .map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setProjDrawerTab(tab.id)}
                    className={`text-xs font-semibold pb-2.5 -mb-px border-b-2 whitespace-nowrap cursor-pointer ${
                      projDrawerTab === tab.id
                        ? `border-current ${g.heading}`
                        : `border-transparent ${mutedText}`
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
            </div>

            {projDrawerTab === "overview" && (
              <div className="space-y-5">
                {!isEditingProj ? (
                  <div className={`p-4 rounded-2xl border space-y-2 ${subtleBg} ${borderCol}`}>
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-xs leading-relaxed ${mutedText}`}>
                        {liveProj.description || "Project workspace."}
                      </p>
                      {canEditProject && (
                        <button
                          type="button"
                          onClick={() => setIsEditingProj(true)}
                          className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold flex items-center gap-1 shrink-0 cursor-pointer ${
                            isDark ? "border-white/15 hover:bg-white/10" : "border-slate-200 hover:bg-slate-200"
                          }`}
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>Edit Details</span>
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-4 pt-2 text-xs">
                      <span>
                        Lead: <strong>{getDisplayName(liveProj.lead)}</strong>
                      </span>
                      <span>
                        Department: <strong>{liveProj.department?.name || "General"}</strong>
                      </span>
                      <span>
                        Status: <strong className="uppercase text-[11px]">{liveProj.status || "active"}</strong>
                      </span>
                      <span>
                        Completion: <strong>{liveProj.stats?.progressPercent || 0}%</strong>
                      </span>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleSaveProjEdit} className={`p-4 rounded-2xl border space-y-3 ${subtleBg} ${borderCol}`}>
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold">Edit Project Details</h4>
                      <button
                        type="button"
                        onClick={() => setIsEditingProj(false)}
                        className="text-[11px] opacity-60 hover:opacity-100 cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold block mb-1">Project Name</label>
                      <input
                        type="text"
                        required
                        value={editProjName}
                        onChange={(e) => setEditProjName(e.target.value)}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold block mb-1">Description</label>
                      <textarea
                        rows={3}
                        value={editProjDesc}
                        onChange={(e) => setEditProjDesc(e.target.value)}
                        className={inputClass}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-semibold block mb-1">Department</label>
                        <select
                          value={editProjDept}
                          onChange={(e) => setEditProjDept(e.target.value)}
                          className={inputClass}
                        >
                          <option value="">General</option>
                          {departments.map((d) => (
                            <option key={d._id} value={d._id}>
                              {d.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold block mb-1">Status</label>
                        <select
                          value={editProjStatus}
                          onChange={(e) => setEditProjStatus(e.target.value)}
                          className={inputClass}
                        >
                          <option value="active">Active</option>
                          <option value="completed">Completed</option>
                          <option value="archived">Archived</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex justify-end pt-1">
                      <button
                        type="submit"
                        disabled={savingProjEdit}
                        className={`px-4 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                          isDark ? "bg-white text-slate-950" : "bg-slate-900 text-white"
                        }`}
                      >
                        {savingProjEdit ? "Saving..." : "Save Changes"}
                      </button>
                    </div>
                  </form>
                )}

                {/* Invoked Teams / Departments Section */}
                {(() => {
                  const invokedDepts =
                    Array.isArray(liveProj.departments) && liveProj.departments.length > 0
                      ? liveProj.departments
                      : liveProj.department
                        ? [liveProj.department]
                        : [];
                  const invokedIds = new Set(invokedDepts.map((d) => String(d._id || d)));
                  const availableDeptsToInvoke = departments.filter((d) => !invokedIds.has(String(d._id)));

                  return (
                    <div className={`p-3.5 rounded-2xl border space-y-2.5 ${subtleBg} ${borderCol}`}>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                          <Building className="w-3.5 h-3.5 text-indigo-400" />
                          <span>Invoked Teams ({invokedDepts.length})</span>
                        </span>
                      </div>

                      {invokedDepts.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {invokedDepts.map((deptObj) => {
                            const dId = deptObj._id || deptObj;
                            const fullDept =
                              typeof deptObj === "object" && deptObj.name
                                ? deptObj
                                : departments.find((d) => String(d._id) === String(dId));
                            if (!fullDept) return null;
                            return (
                              <span
                                key={dId}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-semibold ${g.badge}`}
                              >
                                <span
                                  className="w-2 h-2 rounded-full shrink-0"
                                  style={{ backgroundColor: fullDept.color || "#6366f1" }}
                                />
                                <span>{fullDept.code} · {fullDept.name}</span>
                                {canManageProjMembers && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveProjDept(fullDept._id)}
                                    className="hover:text-rose-400 cursor-pointer ml-0.5"
                                    title="Remove team from project"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                )}
                              </span>
                            );
                          })}
                        </div>
                      ) : (
                        <p className={`text-[11px] italic ${mutedText}`}>No teams invoked into this project yet.</p>
                      )}

                      {canManageProjMembers && availableDeptsToInvoke.length > 0 && (
                        <form onSubmit={handleInvokeProjDept} className="flex gap-2 pt-1">
                          <select
                            value={invokeDeptId}
                            onChange={(e) => setInvokeDeptId(e.target.value)}
                            className={inputClass}
                          >
                            <option value="">Invoke whole team / department...</option>
                            {availableDeptsToInvoke.map((d) => (
                              <option key={d._id} value={d._id}>
                                [{d.code}] {d.name} ({d.membersCount || d.members?.length || 0} staff)
                              </option>
                            ))}
                          </select>
                          <button
                            type="submit"
                            disabled={!invokeDeptId || invokingDept}
                            className={`px-3.5 py-2 rounded-xl text-xs font-semibold shrink-0 cursor-pointer disabled:opacity-40 ${
                              isDark ? "bg-indigo-600 text-white hover:bg-indigo-500" : "bg-slate-900 text-white"
                            }`}
                          >
                            {invokingDept ? "..." : "Invoke"}
                          </button>
                        </form>
                      )}
                    </div>
                  );
                })()}

                {canManageProjMembers && (
                  <form onSubmit={handleAddProjMember} className="flex gap-2">
                    <select
                      value={projMemberId}
                      onChange={(e) => setProjMemberId(e.target.value)}
                      className={inputClass}
                    >
                      <option value="">Add individual member to project...</option>
                      {nonProjectMembers.map((m) => (
                        <option key={m._id} value={m._id}>
                          {m.fullname} ({m.departmentName || "General"})
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      disabled={!projMemberId}
                      className={`px-4 py-2 rounded-xl text-xs font-semibold shrink-0 cursor-pointer disabled:opacity-40 ${isDark ? "bg-white text-slate-950" : "bg-slate-900 text-white"
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
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs font-bold truncate">{getDisplayName(m)}</p>
                            {m.publicId && (
                              <span className="text-[9px] font-mono opacity-60">{m.publicId}</span>
                            )}
                          </div>
                          <p className={`text-[10px] truncate ${mutedText}`}>
                            {m.jobTitle || m.role} • {m.departmentName || "General"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {m._id !== user?._id && canUseChat && (
                          <button
                            onClick={() => openDirectChat(m)}
                            className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold cursor-pointer ${isDark ? "border-white/10 hover:bg-white/10" : "border-slate-200 hover:bg-slate-200"
                              }`}
                          >
                            DM
                          </button>
                        )}
                        {canManageProjMembers && (
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
            )}

            {projDrawerTab === "tasks" && canViewTasks && (
              <div className="space-y-4">
                {canCreateTask && (
                  <form onSubmit={handleCreateQuickTask} className={`p-3 rounded-2xl border space-y-2.5 ${subtleBg} ${borderCol}`}>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={quickTaskTitle}
                        onChange={(e) => setQuickTaskTitle(e.target.value)}
                        placeholder={`Add a task to ${liveProj.prefix}...`}
                        className={inputClass}
                      />
                      {canAssignTask && (
                        <button
                          type="button"
                          onClick={() => setShowQuickAssignOptions((v) => !v)}
                          className={`px-2.5 py-2 rounded-xl border text-[11px] font-semibold shrink-0 cursor-pointer ${
                            showQuickAssignOptions || quickTaskAssignees.length > 0 || quickTaskDepts.length > 0
                              ? g.selectedRow
                              : g.btnSecondary
                          }`}
                          title="Assign to users or teams"
                        >
                          Assign ({quickTaskAssignees.length + quickTaskDepts.length})
                        </button>
                      )}
                      <button
                        type="submit"
                        disabled={creatingQuickTask || !quickTaskTitle.trim()}
                        className={`px-4 py-2 rounded-xl text-xs font-semibold shrink-0 cursor-pointer disabled:opacity-40 ${
                          isDark ? "bg-white text-slate-950" : "bg-slate-900 text-white"
                        }`}
                      >
                        {creatingQuickTask ? "Adding..." : "+ Task"}
                      </button>
                    </div>

                    {canAssignTask && showQuickAssignOptions && (
                      <div className="space-y-2 pt-1.5 border-t border-white/10">
                        <div>
                          <span className={`text-[10px] font-bold uppercase tracking-wider block mb-1 ${mutedText}`}>
                            Assign Teams / Invoked Departments
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {departments.map((d) => {
                              const isInvokedOnProj =
                                (liveProj.departments || []).some((pd) => String(pd._id || pd) === String(d._id)) ||
                                String(liveProj.department?._id || liveProj.department) === String(d._id);
                              const active = quickTaskDepts.includes(d._id);
                              return (
                                <button
                                  key={d._id}
                                  type="button"
                                  onClick={() => toggleArrItem(setQuickTaskDepts, d._id)}
                                  className={`px-2 py-0.5 rounded-lg border text-[10px] font-semibold cursor-pointer ${
                                    active
                                      ? "bg-indigo-600 border-indigo-500 text-white"
                                      : `${g.btnSecondary}`
                                  }`}
                                >
                                  {d.code}{isInvokedOnProj ? " ★" : ""}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div>
                          <span className={`text-[10px] font-bold uppercase tracking-wider block mb-1 ${mutedText}`}>
                            Assign User or Group
                          </span>
                          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                            {teamMembers.map((m) => {
                              const active = quickTaskAssignees.includes(m._id);
                              return (
                                <button
                                  key={m._id}
                                  type="button"
                                  onClick={() => toggleArrItem(setQuickTaskAssignees, m._id)}
                                  className={`px-2 py-0.5 rounded-lg border text-[10px] font-semibold cursor-pointer ${
                                    active
                                      ? "bg-emerald-600 border-emerald-500 text-white"
                                      : `${g.btnSecondary}`
                                  }`}
                                >
                                  {getDisplayName(m)}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </form>
                )}

                {loadingProjTasks ? (
                  <p className={`text-xs py-6 text-center ${mutedText}`}>Loading project tasks...</p>
                ) : projTasks.length === 0 ? (
                  <div className={`p-8 rounded-2xl border border-dashed text-center space-y-2 ${borderCol} ${mutedText}`}>
                    <CheckSquare className="w-6 h-6 mx-auto opacity-60" />
                    <p className="text-xs">No tasks in this project yet.</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                    {projTasks.map((t) => {
                      const taskAssignees =
                        Array.isArray(t.assignees) && t.assignees.length > 0
                          ? t.assignees
                          : t.assignee
                            ? [t.assignee]
                            : [];
                      const taskDepts = Array.isArray(t.assignedDepartments) ? t.assignedDepartments : [];
                      return (
                        <div
                          key={t._id}
                          onClick={() => setSelectedTaskKeyOrId(t.key || t._id)}
                          className={`p-3 rounded-xl border flex items-center justify-between gap-3 cursor-pointer hover:border-indigo-500/40 ${subtleBg} ${borderCol}`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                              <span className="text-[10px] font-mono font-bold text-indigo-400">{t.key}</span>
                              <span className="text-[10px] uppercase opacity-60">{t.priority}</span>
                              {taskDepts.map((d) => (
                                <span
                                  key={d._id || d}
                                  className="px-1.5 py-0.2 rounded bg-indigo-500/15 border border-indigo-500/30 text-[9px] font-mono font-bold text-indigo-300"
                                >
                                  {d.code || d.name}
                                </span>
                              ))}
                            </div>
                            <p className="text-xs font-semibold truncate">{t.title}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {taskAssignees.length > 0 && (
                              <div className="flex items-center -space-x-1.5">
                                {taskAssignees.slice(0, 3).map((u) => (
                                  <UserAvatar
                                    key={u._id || u}
                                    user={u}
                                    className="w-5 h-5 rounded-full border border-white/20"
                                    textClass="text-[8px]"
                                  />
                                ))}
                                {taskAssignees.length > 3 && (
                                  <span className="pl-2 text-[9px] font-mono opacity-70">
                                    +{taskAssignees.length - 3}
                                  </span>
                                )}
                              </div>
                            )}
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/5 border border-white/10 uppercase shrink-0">
                              {t.status?.replace("_", " ")}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {projDrawerTab === "urls" && (
              <div className="space-y-4">
                {canManageProjUrls && (
                  <form onSubmit={handleAddProjUrl} className={`p-3.5 rounded-2xl border space-y-2.5 ${subtleBg} ${borderCol}`}>
                    <span className="text-xs font-bold block">Store URL / External Link</span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input
                        type="text"
                        required
                        placeholder="Title (e.g. GitHub Repo)"
                        value={urlTitle}
                        onChange={(e) => setUrlTitle(e.target.value)}
                        className={inputClass}
                      />
                      <input
                        type="text"
                        required
                        placeholder="https://github.com/..."
                        value={urlValue}
                        onChange={(e) => setUrlValue(e.target.value)}
                        className={inputClass}
                      />
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Category"
                          value={urlCategory}
                          onChange={(e) => setUrlCategory(e.target.value)}
                          className={inputClass}
                        />
                        <button
                          type="submit"
                          disabled={addingUrl}
                          className={`px-3.5 py-2 rounded-xl text-xs font-bold shrink-0 cursor-pointer ${
                            isDark ? "bg-white text-slate-950" : "bg-slate-900 text-white"
                          }`}
                        >
                          {addingUrl ? "..." : "Add"}
                        </button>
                      </div>
                    </div>
                  </form>
                )}

                {(liveProj.links || []).length === 0 ? (
                  <div className={`p-8 rounded-2xl border border-dashed text-center space-y-2 ${borderCol} ${mutedText}`}>
                    <Link2 className="w-6 h-6 mx-auto opacity-60" />
                    <p className="text-xs">No URLs stored yet. Save GitHub repos, Figma links, docs, or staging URLs here.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {liveProj.links.map((lk) => (
                      <div
                        key={lk._id}
                        className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${subtleBg} ${borderCol}`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Link2 className="w-4 h-4 text-indigo-400 shrink-0" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <a
                                href={lk.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs font-bold hover:underline flex items-center gap-1 truncate"
                              >
                                <span>{lk.title}</span>
                                <ExternalLink className="w-3 h-3 shrink-0 opacity-70" />
                              </a>
                              <span className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[9px] font-mono">
                                {lk.category}
                              </span>
                            </div>
                            <p className={`text-[10px] truncate ${mutedText}`}>{lk.url}</p>
                          </div>
                        </div>
                        {canManageProjUrls && (
                          <button
                            type="button"
                            onClick={() => handleDeleteProjUrl(lk._id)}
                            className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10 cursor-pointer shrink-0"
                            title="Delete URL"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {projDrawerTab === "chat" && canUseChat && (() => {
              const pinnedProjMsgs = projChatMessages.filter((m) => m.isPinned);
              return (
                <div className={`flex flex-col h-[460px] rounded-2xl border overflow-hidden ${borderCol}`}>
                  {/* Pinned Messages Strip */}
                  {pinnedProjMsgs.length > 0 && (
                    <div className={`px-3 py-2 border-b text-xs ${subtleBg} ${borderCol}`}>
                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => setShowPinnedProjChat((v) => !v)}
                          className="flex items-center gap-1.5 font-semibold text-amber-400 hover:underline cursor-pointer truncate"
                        >
                          <Pin className="w-3 h-3 shrink-0" />
                          <span>{pinnedProjMsgs.length} Pinned:</span>
                          <span className={`font-normal truncate ${mutedText}`}>
                            {pinnedProjMsgs[pinnedProjMsgs.length - 1]?.decryptedText}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowPinnedProjChat((v) => !v)}
                          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border cursor-pointer ${g.btnSecondary}`}
                        >
                          {showPinnedProjChat ? "Hide" : "View"}
                        </button>
                      </div>
                      {showPinnedProjChat && (
                        <div className="mt-2 pt-2 border-t border-white/10 space-y-1.5 max-h-28 overflow-y-auto">
                          {pinnedProjMsgs.map((pm) => (
                            <div key={pm._id} className="flex items-center justify-between gap-2 text-[11px]">
                              <span className="truncate">
                                <strong className="mr-1">{getDisplayName(pm.sender)}:</strong>
                                {pm.decryptedText}
                              </span>
                              {canPinChat && (
                                <button
                                  type="button"
                                  onClick={() => handleTogglePinProjChat(pm._id)}
                                  className="text-rose-400 hover:underline shrink-0 text-[10px] cursor-pointer"
                                >
                                  Unpin
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex-1 p-3.5 overflow-y-auto space-y-3">
                    {projChatMessages.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center opacity-50 space-y-1.5">
                        <MessageSquare className="w-6 h-6" />
                        <p className="text-xs">No project chat messages yet. Say hello to #{liveProj.prefix}!</p>
                      </div>
                    ) : (
                      projChatMessages.map((msg, idx) => {
                        const senderObj = typeof msg.sender === "object" ? msg.sender : null;
                        const senderId = senderObj?._id || msg.sender;
                        const isMe = String(senderId) === String(user?._id);
                        return (
                          <div key={msg._id || idx} className={`group flex items-end gap-2 ${isMe ? "justify-end" : "justify-start"}`}>
                            {!isMe && (
                              <button
                                type="button"
                                onClick={() => setInspectedChatSender(msg.sender)}
                                className="shrink-0 cursor-pointer hover:opacity-85"
                                title="View sender profile"
                              >
                                <UserAvatar
                                  user={msg.sender}
                                  className="w-7 h-7 rounded-xl border border-white/10"
                                  textClass="text-[10px]"
                                />
                              </button>
                            )}
                            <div className={`flex flex-col max-w-[80%] ${isMe ? "items-end" : "items-start"}`}>
                              <div className="flex items-center gap-1.5 px-1 mb-0.5">
                                <button
                                  type="button"
                                  onClick={() => setInspectedChatSender(msg.sender)}
                                  className="text-[10px] font-bold opacity-80 hover:underline cursor-pointer"
                                >
                                  {isMe ? "You" : getDisplayName(msg.sender)}
                                </button>
                                {senderObj?.publicId && !isMe && (
                                  <span className="text-[9px] font-mono px-1 rounded bg-white/5 border border-white/10 opacity-70">
                                    {senderObj.publicId}
                                  </span>
                                )}
                                <span className="text-[9px] font-mono opacity-50">
                                  {formatTimeIN(msg.createdAt)}
                                </span>
                                {msg.isPinned && (
                                  <Pin className="w-2.5 h-2.5 text-amber-400 shrink-0" title="Pinned" />
                                )}
                              </div>
                              <div className="flex items-center gap-1.5">
                                <div
                                  className={`px-3 py-2 rounded-2xl text-xs leading-relaxed ${
                                    msg.isPinned ? "ring-1 ring-amber-400/50 " : ""
                                  }${
                                    isMe ? "bg-indigo-600 text-white" : `${subtleBg} border ${borderCol}`
                                  }`}
                                >
                                  {msg.decryptedText}
                                </div>
                                {canPinChat && msg._id && (
                                  <button
                                    type="button"
                                    onClick={() => handleTogglePinProjChat(msg._id)}
                                    className={`p-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer ${
                                      msg.isPinned ? "opacity-100 text-amber-400" : "opacity-60 hover:bg-white/10"
                                    }`}
                                    title={msg.isPinned ? "Unpin message" : "Pin message"}
                                  >
                                    {msg.isPinned ? <PinOff className="w-3 h-3" /> : <Pin className="w-3 h-3" />}
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={projChatEndRef} />
                  </div>

                  {canSendChat ? (
                    <form onSubmit={handleSendProjChat} className={`p-2.5 border-t flex gap-2 ${borderCol}`}>
                      <input
                        type="text"
                        value={projChatInput}
                        onChange={(e) => setProjChatInput(e.target.value)}
                        placeholder={`Message #${liveProj.prefix} over WebSocket...`}
                        className={inputClass}
                      />
                      <button
                        type="submit"
                        disabled={!projChatInput.trim() || sendingProjChat}
                        className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer disabled:opacity-40"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </form>
                  ) : (
                    <div className={`p-2.5 border-t text-center text-[11px] ${borderCol} ${mutedText}`}>
                      Read-only chat view (sending disabled for your role)
                    </div>
                  )}
                </div>
              );
            })()}

            {projDrawerTab === "files" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className={`text-xs ${mutedText}`}>
                    Files shared here are accessible to everyone in {liveProj.name}.
                  </p>
                  {canManageProjFiles && (
                    <>
                      <button
                        onClick={() => projFileInputRef.current?.click()}
                        disabled={uploadingProjFile}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${isDark ? "bg-white text-slate-950 hover:bg-slate-200" : "bg-slate-900 text-white hover:bg-slate-800"
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
                    </>
                  )}
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
                            className={`p-1.5 rounded-lg border ${isDark ? "border-white/10 hover:bg-white/10" : "border-slate-200 hover:bg-slate-200"
                              }`}
                            title="Download"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>
                          {canManageProjFiles && (
                            <button
                              onClick={() => handleDeleteProjFile(f._id)}
                              className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                              title="Remove file"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
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
            <label className="text-xs font-semibold block mb-1">Primary Department</label>
            <select value={projDept} onChange={(e) => setProjDept(e.target.value)} className={inputClass}>
              <option value="">None / General</option>
              {departments.map((d) => (
                <option key={d._id} value={d._id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold block mb-1.5">
              Invoke Teams / Departments ({projInvokedDepts.length})
            </label>
            <div className="flex flex-wrap gap-1.5">
              {departments.map((d) => {
                const selected = projInvokedDepts.includes(d._id);
                return (
                  <button
                    key={d._id}
                    type="button"
                    onClick={() => toggleArrItem(setProjInvokedDepts, d._id)}
                    className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold cursor-pointer transition-all ${
                      selected ? "bg-indigo-600 border-indigo-500 text-white" : g.btnSecondary
                    }`}
                  >
                    {d.code} · {d.name}
                  </button>
                );
              })}
            </div>
            <p className={`text-[10px] mt-1 ${mutedText}`}>
              Invoking teams automatically grants active team members workspace membership.
            </p>
          </div>

          <div>
            <label className="text-xs font-semibold block mb-1.5">
              Add Individual Members ({projInitialMembers.length})
            </label>
            <div className={`max-h-36 overflow-y-auto rounded-xl border p-2 space-y-1 ${subtleBg} ${borderCol}`}>
              {teamMembers.map((m) => {
                const checked = projInitialMembers.includes(m._id);
                return (
                  <label
                    key={m._id}
                    className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg text-xs cursor-pointer ${g.rowHover}`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleArrItem(setProjInitialMembers, m._id)}
                        className="accent-indigo-500"
                      />
                      <UserAvatar user={m} className="w-5 h-5 rounded-full" textClass="text-[8px]" />
                      <span className="truncate font-medium">{getDisplayName(m)}</span>
                    </div>
                    <span className={`text-[10px] truncate ${mutedText}`}>{m.departmentName || "General"}</span>
                  </label>
                );
              })}
            </div>
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
              className={`px-5 py-2 text-xs font-semibold rounded-xl cursor-pointer ${isDark ? "bg-white text-slate-950 hover:bg-slate-200" : "bg-slate-900 text-white hover:bg-slate-800"
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

          <div>
            <label className="text-xs font-semibold block mb-1">Department Lead</label>
            <select value={deptLead} onChange={(e) => setDeptLead(e.target.value)} className={inputClass}>
              <option value="">Current User ({getDisplayName(user)})</option>
              {teamMembers.map((m) => (
                <option key={m._id} value={m._id}>
                  {getDisplayName(m)} ({m.departmentName || "General"})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold block mb-1.5">
              Add Initial Members ({deptInitialMembers.length})
            </label>
            <div className={`max-h-36 overflow-y-auto rounded-xl border p-2 space-y-1 ${subtleBg} ${borderCol}`}>
              {teamMembers.map((m) => {
                const checked = deptInitialMembers.includes(m._id);
                return (
                  <label
                    key={m._id}
                    className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg text-xs cursor-pointer ${g.rowHover}`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleArrItem(setDeptInitialMembers, m._id)}
                        className="accent-indigo-500"
                      />
                      <UserAvatar user={m} className="w-5 h-5 rounded-full" textClass="text-[8px]" />
                      <span className="truncate font-medium">{getDisplayName(m)}</span>
                    </div>
                    <span className={`text-[10px] truncate ${mutedText}`}>{m.departmentName || "General"}</span>
                  </label>
                );
              })}
            </div>
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
              className={`px-5 py-2 text-xs font-semibold rounded-xl cursor-pointer ${isDark ? "bg-white text-slate-950 hover:bg-slate-200" : "bg-slate-900 text-white hover:bg-slate-800"
                }`}
            >
              {submittingDept ? "Creating..." : "Create Department"}
            </button>
          </div>
        </form>
      </SideDrawer>

      {inspectedChatSender && (
        <MessageSenderPopover
          sender={inspectedChatSender}
          currentUserId={user?._id}
          teamMembers={teamMembers}
          isDark={isDark}
          onClose={() => setInspectedChatSender(null)}
          onStartDM={openDirectChat}
        />
      )}
    </div>
  );
}
