import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/Appcontext";
import {
  updateProfileInfo,
  uploadProfileImage,
  getTeamMembers,
  createUser,
  updateUser,
  deleteUser,
  getPendingJoinRequests,
  approveJoinRequest,
  rejectJoinRequest,
  getActionLogs,
} from "../services/api";
import UserAvatar from "../components/common/UserAvatar";
import SideDrawer from "../components/common/SideDrawer";
import { formatDateIN, formatTimeIN, formatNumberIN } from "../utils/formatters";
import {
  Camera,
  User,
  Phone,
  Briefcase,
  Mail,
  Building2,
  Lock,
  Save,
  Eye,
  EyeOff,
  Loader2,
  FileText,
  FolderKanban,
  Users,
  ShieldCheck,
  History,
  Search,
  Plus,
  RefreshCw,
  CheckCircle2,
  XCircle,
  MessageSquare,
  SlidersHorizontal,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  UserX,
  Clock,
  Activity,
} from "lucide-react";
import toast from "react-hot-toast";
import { getGlassTokens } from "../styles/glassTheme";

const STATUS_OPTIONS = [
  {
    value: "active",
    label: "Available",
    dot: "bg-emerald-400",
    pillDark: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300",
    pillLight: "bg-emerald-50 border-emerald-200 text-emerald-700",
  },
  {
    value: "away",
    label: "Away",
    dot: "bg-amber-400",
    pillDark: "bg-amber-500/10 border-amber-500/30 text-amber-300",
    pillLight: "bg-amber-50 border-amber-200 text-amber-700",
  },
  {
    value: "on_leave",
    label: "On Leave",
    dot: "bg-rose-400",
    pillDark: "bg-rose-500/10 border-rose-500/30 text-rose-300",
    pillLight: "bg-rose-50 border-rose-200 text-rose-700",
  },
];

export default function Profile() {
  const navigate = useNavigate();
  const {
    user,
    setUser,
    theme,
    projects,
    departments,
    roles,
    isSuperAdmin,
    hasPermission,
    setActiveProject,
    refreshDepartments,
    refreshTeam,
    openDirectChat,
    openRoomChat,
  } = useApp();
  const isDark = theme === "dark";
  const g = getGlassTokens(isDark);

  const isAdmin = isSuperAdmin || user?.role === "admin" || hasPermission("team.edit");
  const isManager = user?.role === "manager";
  const canManageUsers = isAdmin || isManager;

  const [activeTab, setActiveTab] = useState("profile"); // 'profile' | 'users' | 'audit'

  // Personal Profile State
  const [fullname, setFullname] = useState(user?.fullname || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [jobTitle, setJobTitle] = useState(user?.jobTitle || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [status, setStatus] = useState(user?.status || "active");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef(null);

  // Admin User Management State
  const [managedUsers, setManagedUsers] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [userDeptFilter, setUserDeptFilter] = useState("all");
  const [userStatusFilter, setUserStatusFilter] = useState("all");

  // Drawers for User Management
  const [showCreateUserDrawer, setShowCreateUserDrawer] = useState(false);
  const [createForm, setCreateForm] = useState({
    fullname: "",
    email: "",
    password: "",
    role: "employee",
    department: "",
    jobTitle: "",
  });
  const [creatingUser, setCreatingUser] = useState(false);

  const [selectedUserDrawer, setSelectedUserDrawer] = useState(null);
  const [editUserForm, setEditUserForm] = useState({
    fullname: "",
    role: "employee",
    department: "",
    jobTitle: "",
    phone: "",
    bio: "",
    status: "active",
    isActive: true,
  });
  const [savingUserEdit, setSavingUserEdit] = useState(false);

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotalPages, setAuditTotalPages] = useState(1);
  const [auditSearch, setAuditSearch] = useState("");
  const [auditStatusFilter, setAuditStatusFilter] = useState("");
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [selectedAuditLog, setSelectedAuditLog] = useState(null);

  useEffect(() => {
    if (user) {
      setFullname(user.fullname || "");
      setPhone(user.phone || "");
      setJobTitle(user.jobTitle || "");
      setBio(user.bio || "");
      setStatus(user.status || "active");
    }
  }, [user]);

  const loadUserManagementData = async () => {
    if (!canManageUsers) return;
    setLoadingUsers(true);
    const [teamRes, reqRes] = await Promise.all([
      getTeamMembers(isAdmin),
      getPendingJoinRequests(),
    ]);
    if (teamRes.success) setManagedUsers(teamRes.members || []);
    if (reqRes.success) setPendingRequests(reqRes.requests || []);
    setLoadingUsers(false);
  };

  const loadAuditLogsData = async (pageToLoad = auditPage) => {
    if (!isAdmin) return;
    setLoadingAudit(true);
    const res = await getActionLogs({
      page: pageToLoad,
      limit: 20,
      ...(auditStatusFilter ? { status: auditStatusFilter } : {}),
      ...(auditSearch.trim() ? { search: auditSearch.trim() } : {}),
    });
    if (res.success) {
      setAuditLogs(res.logs || []);
      setAuditTotal(res.total || 0);
      setAuditPage(res.page || 1);
      setAuditTotalPages(res.totalPages || 1);
    }
    setLoadingAudit(false);
  };

  useEffect(() => {
    if (activeTab === "users" && canManageUsers) {
      loadUserManagementData();
    } else if (activeTab === "audit" && isAdmin) {
      loadAuditLogsData(1);
    }
  }, [activeTab]);

  // Personal Profile Handlers
  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file (PNG, JPG, WEBP)");
      return;
    }

    setUploadingPhoto(true);
    const res = await uploadProfileImage(file);
    setUploadingPhoto(false);
    if (res.success && res.user) {
      setUser(res.user);
    } else if (!res.success) {
      toast.error(res.message || "Failed to upload photo");
    }
    e.target.value = "";
  };

  const handleQuickStatusChange = async (newStatus) => {
    setStatus(newStatus);
    const res = await updateProfileInfo({
      fullname: (fullname || user?.fullname || "").trim(),
      status: newStatus,
    });
    if (res.success && res.user) {
      setUser(res.user);
    }
  };

  const handleSaveDetails = async (e) => {
    e.preventDefault();
    if (!fullname.trim()) {
      toast.error("Full name is required");
      return;
    }
    if (newPassword && newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setSavingProfile(true);
    const payload = {
      fullname: fullname.trim(),
      phone: phone.trim(),
      jobTitle: jobTitle.trim(),
      bio: bio.trim(),
      status,
    };
    if (newPassword.trim()) payload.password = newPassword.trim();

    const res = await updateProfileInfo(payload);
    setSavingProfile(false);
    if (res.success && res.user) {
      setUser(res.user);
      setNewPassword("");
      setConfirmPassword("");
    } else if (!res.success) {
      toast.error(res.message || "Failed to update profile");
    }
  };

  // User Management Handlers
  const openEditUserDrawer = (member) => {
    setSelectedUserDrawer(member);
    setEditUserForm({
      fullname: member.fullname || "",
      role: member.role || "employee",
      department: member.department?._id || member.department || "",
      jobTitle: member.jobTitle || "",
      phone: member.phone || "",
      bio: member.bio || "",
      status: member.status || "active",
      isActive: member.isActive !== false,
    });
  };

  const handleSaveUserEdit = async (e) => {
    e.preventDefault();
    if (!selectedUserDrawer) return;
    setSavingUserEdit(true);
    const matchedDept = (departments || []).find((d) => d._id === editUserForm.department);
    const res = await updateUser(selectedUserDrawer._id, {
      fullname: editUserForm.fullname.trim(),
      role: editUserForm.role,
      department: editUserForm.department || null,
      departmentName: matchedDept ? matchedDept.name : "General",
      jobTitle: editUserForm.jobTitle.trim(),
      phone: editUserForm.phone.trim(),
      bio: editUserForm.bio.trim(),
      status: editUserForm.status,
      isActive: editUserForm.isActive,
    });
    setSavingUserEdit(false);
    if (res.success) {
      setSelectedUserDrawer(res.user);
      loadUserManagementData();
      refreshDepartments?.();
      refreshTeam?.();
    } else {
      toast.error(res.message || "Update failed");
    }
  };

  const handleToggleAccountActive = async (member) => {
    if (member._id === user?._id) return;
    if (member.isActive === false) {
      const res = await updateUser(member._id, { isActive: true });
      if (res.success) {
        loadUserManagementData();
        refreshTeam?.();
      }
    } else {
      const res = await deleteUser(member._id);
      if (res.success) {
        loadUserManagementData();
        refreshTeam?.();
      }
    }
  };

  const handleCreateUserSubmit = async (e) => {
    e.preventDefault();
    if (!createForm.fullname.trim() || !createForm.email.trim()) return;
    setCreatingUser(true);
    const res = await createUser({
      fullname: createForm.fullname.trim(),
      email: createForm.email.trim(),
      password: createForm.password.trim() || "Lira@2026",
      role: createForm.role,
      department: createForm.department || null,
      jobTitle: createForm.jobTitle.trim(),
    });
    setCreatingUser(false);
    if (res.success) {
      setShowCreateUserDrawer(false);
      setCreateForm({
        fullname: "",
        email: "",
        password: "",
        role: "employee",
        department: "",
        jobTitle: "",
      });
      loadUserManagementData();
      refreshTeam?.();
    }
  };

  const handleApproveCandidate = async (candidate) => {
    const res = await approveJoinRequest(candidate._id, {
      departmentName: candidate.joinRequest?.requestedDepartmentName || candidate.departmentName,
      jobTitle: candidate.joinRequest?.requestedJobTitle || candidate.jobTitle,
      role: candidate.joinRequest?.requestedRole || "employee",
    });
    if (res.success) {
      loadUserManagementData();
      refreshTeam?.();
    }
  };

  const handleRejectCandidate = async (candidate) => {
    const res = await rejectJoinRequest(candidate._id, "Application declined by administrator");
    if (res.success) loadUserManagementData();
  };

  // Derived data for Profile Overview
  const myDepartment = (departments || []).find(
    (d) =>
      d._id === (user?.department?._id || user?.department) ||
      d.name?.toLowerCase() === (user?.department?.name || user?.departmentName || "").toLowerCase()
  );

  const myProjects = (projects || []).filter((p) => {
    if (isAdmin) return true;
    const isLead = p.lead?._id === user?._id || p.lead === user?._id;
    const isMember = (p.members || []).some((m) => (m?._id || m) === user?._id);
    return isLead || isMember;
  });

  const filteredManagedUsers = (managedUsers || []).filter((m) => {
    const q = userSearch.trim().toLowerCase();
    const matchesSearch =
      !q ||
      m.fullname?.toLowerCase().includes(q) ||
      m.email?.toLowerCase().includes(q) ||
      m.publicId?.toLowerCase().includes(q) ||
      m.jobTitle?.toLowerCase().includes(q);
    if (!matchesSearch) return false;

    if (
      userDeptFilter !== "all" &&
      (m.department?._id || m.department) !== userDeptFilter
    ) {
      return false;
    }

    if (userStatusFilter === "inactive") return m.isActive === false;
    if (userStatusFilter !== "all") {
      return m.isActive !== false && (m.status || "active") === userStatusFilter;
    }
    return true;
  });

  const inputClass = `w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none transition-colors ${g.input}`;

  const cardClass = `rounded-2xl ${g.card}`;

  const currentStatusMeta =
    STATUS_OPTIONS.find((s) => s.value === status) || STATUS_OPTIONS[0];

  return (
    <div
      className={`flex-1 w-full h-full min-h-0 overflow-y-auto p-5 sm:p-7 space-y-6 transition-colors duration-150 ${
        isDark ? "text-slate-100" : "text-slate-900"
      }`}
    >
      {/* Full-width Profile Hero */}
      <div className={`${cardClass} p-5 sm:p-6`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="flex items-start sm:items-center gap-4 sm:gap-5">
            <div className="relative group shrink-0">
              <UserAvatar
                user={user}
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl border border-white/10"
                textClass="text-2xl"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPhoto}
                className={`absolute -bottom-1.5 -right-1.5 p-2 rounded-xl border shadow-md transition-all cursor-pointer ${
                  isDark
                    ? "bg-white text-slate-950 border-slate-800 hover:bg-slate-200"
                    : "bg-slate-900 text-white border-white hover:bg-slate-800"
                }`}
                title="Change profile photo"
              >
                {uploadingPhoto ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Camera className="w-3.5 h-3.5" />
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={handlePhotoUpload}
                className="hidden"
              />
            </div>

            <div className="min-w-0 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className={`text-xl sm:text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
                  {user?.fullname}
                </h1>
                <span
                  className={`text-[10px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${g.badge}`}
                >
                  {user?.role || "member"}
                </span>
                {user?.publicId && (
                  <span
                    className={`font-mono text-[10px] font-semibold px-2.5 py-0.5 rounded-full border ${
                      isDark ? "bg-white/[0.04] border-white/[0.08] text-slate-300" : "bg-slate-100 border-slate-200 text-slate-700"
                    }`}
                  >
                    {user.publicId}
                  </span>
                )}
                <span
                  className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                    isDark ? currentStatusMeta.pillDark : currentStatusMeta.pillLight
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${currentStatusMeta.dot}`} />
                  {currentStatusMeta.label}
                </span>
              </div>

              <div className={`flex flex-wrap items-center gap-x-5 gap-y-1 text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                <span className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5" />
                  {user?.email}
                </span>
                <span className="flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5" />
                  {myDepartment?.name || user?.department?.name || user?.departmentName || "General"}
                </span>
                {user?.jobTitle && (
                  <span className="flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5" />
                    {user.jobTitle}
                  </span>
                )}
                {user?.phone && (
                  <span className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5" />
                    {user.phone}
                  </span>
                )}
              </div>

              <div className="pt-1 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                    isDark
                      ? "bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.08] text-slate-200"
                      : "bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700"
                  }`}
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>{uploadingPhoto ? "Uploading..." : "Upload Photo"}</span>
                </button>
                <span className={`text-[11px] ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                  JPG, PNG, WEBP up to 5 MB
                </span>
              </div>
            </div>
          </div>

          {/* Personal Availability Quick Switcher */}
          <div className="flex flex-col sm:items-end gap-2 shrink-0">
            <span className={`text-[11px] font-semibold uppercase tracking-wider ${g.muted}`}>
              Personal Status
            </span>
            <div className={`inline-flex p-1 rounded-xl border ${g.subtleSurface}`}>
              {STATUS_OPTIONS.map((opt) => {
                const active = status === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleQuickStatusChange(opt.value)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      active ? g.navActivePill : g.muted
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${opt.dot}`} />
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        {canManageUsers && (
          <div className={`mt-5 pt-4 border-t flex flex-wrap items-center gap-2 ${isDark ? "border-white/[0.06]" : "border-slate-200"}`}>
            <button
              type="button"
              onClick={() => setActiveTab("profile")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === "profile"
                  ? isDark
                    ? "bg-white text-slate-950"
                    : "bg-slate-900 text-white"
                  : isDark
                  ? "text-slate-400 hover:text-white hover:bg-white/[0.05]"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>My Profile & Workspaces</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("users")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === "users"
                  ? isDark
                    ? "bg-white text-slate-950"
                    : "bg-slate-900 text-white"
                  : isDark
                  ? "text-slate-400 hover:text-white hover:bg-white/[0.05]"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>User Management</span>
              {pendingRequests.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500 text-slate-950">
                  {pendingRequests.length}
                </span>
              )}
            </button>

            {isAdmin && (
              <button
                type="button"
                onClick={() => setActiveTab("audit")}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                  activeTab === "audit"
                    ? isDark
                      ? "bg-white text-slate-950"
                      : "bg-slate-900 text-white"
                    : isDark
                    ? "text-slate-400 hover:text-white hover:bg-white/[0.05]"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>Audit Logs</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* TAB 1: MY PROFILE & WORKSPACES */}
      {activeTab === "profile" && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* Left Column: Account Details & Security */}
          <form onSubmit={handleSaveDetails} className={`xl:col-span-7 ${cardClass} p-6 space-y-5`}>
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
              <div>
                <h2 className="text-sm font-bold">Personal Information & Security</h2>
                <p className={`text-xs mt-0.5 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  Keep your contact details, bio, availability, and password up to date.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={`flex items-center gap-1.5 text-xs font-semibold mb-1.5 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                  <User className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Full Name *</span>
                </label>
                <input
                  type="text"
                  required
                  value={fullname}
                  onChange={(e) => setFullname(e.target.value)}
                  placeholder="Your full name"
                  className={inputClass}
                />
              </div>

              <div>
                <label className={`flex items-center gap-1.5 text-xs font-semibold mb-1.5 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                  <Briefcase className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Job Title</span>
                </label>
                <input
                  type="text"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="e.g. Senior Systems Engineer"
                  className={inputClass}
                />
              </div>

              <div>
                <label className={`flex items-center gap-1.5 text-xs font-semibold mb-1.5 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                  <Phone className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Mobile Number (+91 India)</span>
                </label>
                <div className="relative">
                  <span className={`absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-mono ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                    +91
                  </span>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="9876543210"
                    className={`${inputClass} pl-11 font-mono`}
                  />
                </div>
              </div>

              <div>
                <label className={`flex items-center gap-1.5 text-xs font-semibold mb-1.5 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                  <Activity className="w-3.5 h-3.5 text-amber-400" />
                  <span>Availability Status</span>
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className={inputClass}
                >
                  <option value="active">Available</option>
                  <option value="away">Away</option>
                  <option value="on_leave">On Leave</option>
                </select>
              </div>
            </div>

            <div>
              <label className={`flex items-center gap-1.5 text-xs font-semibold mb-1.5 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                <FileText className="w-3.5 h-3.5 text-indigo-400" />
                <span>About / Bio</span>
              </label>
              <textarea
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Short description of your role or focus areas..."
                className={`${inputClass} resize-none`}
              />
            </div>

            <div className={`pt-4 border-t ${isDark ? "border-white/[0.06]" : "border-slate-200"}`}>
              <h3 className={`text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-1.5 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>Change Password (Optional)</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="New password (min 6 chars)"
                    minLength={newPassword ? 6 : undefined}
                    className={`${inputClass} pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className={inputClass}
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={savingProfile}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer disabled:opacity-60 ${g.btnPrimary}`}
              >
                {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>{savingProfile ? "Saving..." : "Save Profile Changes"}</span>
              </button>
            </div>
          </form>

          {/* Right Column: My Department & Assigned Projects */}
          <div className="xl:col-span-5 space-y-6">
            {/* Department Card */}
            <div className={`${cardClass} p-6 space-y-4`}>
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold flex items-center gap-2">
                  <Building2 className={`w-4 h-4 ${g.accentIcon}`} />
                  <span>My Department</span>
                </h2>
                <button
                  type="button"
                  onClick={() => navigate("/projects")}
                  className={`text-xs font-medium flex items-center gap-1 cursor-pointer ${g.muted} hover:text-current`}
                >
                  <span>Manage</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {myDepartment ? (
                <div className={`p-4 rounded-xl border space-y-3 ${g.subtleSurface}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: myDepartment.color || "#a1a1aa" }}
                      />
                      <span className="text-sm font-bold">{myDepartment.name}</span>
                    </div>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${g.badge}`}>
                      {myDepartment.code || myDepartment.prefix}
                    </span>
                  </div>
                  {myDepartment.description && (
                    <p className={`text-xs ${g.muted}`}>
                      {myDepartment.description}
                    </p>
                  )}
                  <div className={`flex items-center justify-between pt-2 border-t text-xs ${g.border}`}>
                    <span className={g.muted}>
                      {myDepartment.membersCount ?? myDepartment.members?.length ?? 0} Staff ·{" "}
                      {myDepartment.projectsCount ?? 0} Projects
                    </span>
                    <button
                      type="button"
                      onClick={() => openRoomChat?.("operations")}
                      className={`font-semibold flex items-center gap-1 cursor-pointer hover:underline ${g.heading}`}
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Open Chat</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className={`p-4 rounded-xl border text-xs ${g.subtleSurface} ${g.muted}`}>
                  Assigned to {user?.departmentName || "General Workspace"}.
                </div>
              )}

              {/* All Workspace Departments Overview */}
              {departments?.length > 0 && (
                <div className="space-y-2 pt-1">
                  <p className={`text-[11px] font-semibold uppercase tracking-wider ${g.muted}`}>
                    Organization Departments ({departments.length})
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {departments.map((dept) => (
                      <div
                        key={dept._id}
                        onClick={() => navigate("/projects")}
                        className={`p-2.5 rounded-xl border text-xs flex items-center justify-between cursor-pointer transition-colors ${g.subtleSurface} ${g.rowHover}`}
                      >
                        <span className="truncate font-medium">{dept.name}</span>
                        <span className={`text-[10px] font-mono shrink-0 ml-1 ${g.muted}`}>
                          {dept.membersCount ?? dept.members?.length ?? 0}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Projects Card */}
            <div className={`${cardClass} p-6 space-y-4`}>
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold flex items-center gap-2">
                  <FolderKanban className={`w-4 h-4 ${g.accentIcon}`} />
                  <span>My Projects ({myProjects.length})</span>
                </h2>
                <button
                  type="button"
                  onClick={() => navigate("/projects")}
                  className={`text-xs font-medium flex items-center gap-1 cursor-pointer ${g.muted} hover:text-current`}
                >
                  <span>All Workspaces</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-2.5">
                {myProjects.map((proj) => {
                  const total = proj.stats?.total ?? proj.totalTasks ?? 0;
                  const done = proj.stats?.done ?? proj.completedTasks ?? 0;
                  const pct =
                    proj.stats?.progressPercent ??
                    (total > 0 ? Math.round((done / total) * 100) : 0);
                  return (
                    <div
                      key={proj._id}
                      className={`p-3.5 rounded-xl border space-y-2.5 ${g.subtleSurface}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border shrink-0 ${g.badge}`}>
                            {proj.prefix}
                          </span>
                          <span className="text-xs font-bold truncate">{proj.name}</span>
                        </div>
                        <span className={`text-[11px] font-mono shrink-0 ${g.muted}`}>
                          {done}/{total}
                        </span>
                      </div>

                      <div className={`h-1.5 rounded-full overflow-hidden ${g.progressTrack}`}>
                        <div className={`h-full rounded-full ${g.progressFill}`} style={{ width: `${pct}%` }} />
                      </div>

                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <span className={g.muted}>
                          {proj.members?.length || 0} members · {proj.files?.length || 0} shared files
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openRoomChat?.(`proj_${proj._id}`)}
                            className={`font-semibold cursor-pointer hover:underline ${g.accentIcon}`}
                          >
                            Chat
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveProject?.(proj);
                              navigate("/board");
                            }}
                            className={`font-semibold cursor-pointer hover:underline ${g.heading}`}
                          >
                            Open Board →
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {myProjects.length === 0 && (
                  <p className={`text-xs py-4 text-center ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                    No project workspaces assigned yet.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ADMIN USER MANAGEMENT */}
      {activeTab === "users" && canManageUsers && (
        <div className="space-y-5">
          {/* Pending Join Requests */}
          {pendingRequests.length > 0 && (
            <div className={`${cardClass} p-5 space-y-3`}>
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-400" />
                  <span>Pending Join Requests ({pendingRequests.length})</span>
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {pendingRequests.map((req) => (
                  <div
                    key={req._id}
                    className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 ${
                      isDark ? "bg-white/[0.02] border-amber-500/20" : "bg-amber-50/50 border-amber-200"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <UserAvatar user={req} className="w-10 h-10 rounded-xl shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-bold truncate">{req.fullname}</p>
                        <p className={`text-[11px] truncate ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                          {req.email}
                        </p>
                        <p className="text-[10px] text-indigo-400 truncate">
                          {req.joinRequest?.requestedDepartmentName || "General"} ·{" "}
                          {req.joinRequest?.requestedJobTitle || "Team Member"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleApproveCandidate(req)}
                        className="p-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
                        title="Approve"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRejectCandidate(req)}
                        className="p-2 rounded-lg bg-rose-500/15 hover:bg-rose-600 text-rose-400 hover:text-white cursor-pointer"
                        title="Decline"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Filter & Action Toolbar */}
          <div className={`${cardClass} p-4 flex flex-wrap items-center justify-between gap-3`}>
            <div className="flex flex-wrap items-center gap-2.5 flex-1">
              <div className="relative min-w-[220px] flex-1 max-w-sm">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Search name, email, ID, job title..."
                  className={`${inputClass} pl-9 py-2 text-xs`}
                />
              </div>

              <select
                value={userDeptFilter}
                onChange={(e) => setUserDeptFilter(e.target.value)}
                className={`rounded-xl border px-3 py-2 text-xs outline-none ${
                  isDark ? "bg-[#12131b] border-white/[0.08] text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                }`}
              >
                <option value="all">All Departments</option>
                {departments.map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.name}
                  </option>
                ))}
              </select>

              <select
                value={userStatusFilter}
                onChange={(e) => setUserStatusFilter(e.target.value)}
                className={`rounded-xl border px-3 py-2 text-xs outline-none ${
                  isDark ? "bg-[#12131b] border-white/[0.08] text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                }`}
              >
                <option value="all">All Statuses</option>
                <option value="active">Available</option>
                <option value="away">Away</option>
                <option value="on_leave">On Leave</option>
                {isAdmin && <option value="inactive">Deactivated</option>}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={loadUserManagementData}
                className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                  isDark
                    ? "bg-white/[0.03] border-white/[0.08] text-slate-300 hover:bg-white/[0.08]"
                    : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                }`}
                title="Refresh users"
              >
                <RefreshCw className={`w-4 h-4 ${loadingUsers ? "animate-spin" : ""}`} />
              </button>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setShowCreateUserDrawer(true)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer ${
                    isDark
                      ? "bg-white text-slate-950 hover:bg-slate-200"
                      : "bg-slate-900 text-white hover:bg-slate-800"
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add User</span>
                </button>
              )}
            </div>
          </div>

          {/* Full-Width Users Table */}
          <div className={`${cardClass} overflow-hidden`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr
                    className={`border-b text-[11px] uppercase tracking-wider ${
                      isDark ? "border-white/[0.08] bg-white/[0.02] text-slate-400" : "border-slate-200 bg-slate-50 text-slate-500"
                    }`}
                  >
                    <th className="py-3 px-4 font-semibold">Member</th>
                    <th className="py-3 px-4 font-semibold">Contact</th>
                    <th className="py-3 px-4 font-semibold">Department & Title</th>
                    <th className="py-3 px-4 font-semibold">Role</th>
                    <th className="py-3 px-4 font-semibold">Status</th>
                    <th className="py-3 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDark ? "divide-white/[0.05]" : "divide-slate-100"}`}>
                  {filteredManagedUsers.map((member) => {
                    const statusObj =
                      STATUS_OPTIONS.find((s) => s.value === member.status) || STATUS_OPTIONS[0];
                    return (
                      <tr
                        key={member._id}
                        className={`transition-colors ${
                          isDark ? "hover:bg-white/[0.02]" : "hover:bg-slate-50"
                        }`}
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <UserAvatar user={member} className="w-9 h-9 rounded-xl shrink-0" />
                            <div className="min-w-0">
                              <p className="font-semibold truncate">{member.fullname}</p>
                              <p className={`text-[10px] font-mono ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                                {member.publicId || "—"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <p className="truncate">{member.email}</p>
                          <p className={`text-[11px] font-mono ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                            {member.phone || "No phone"}
                          </p>
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-medium">
                            {member.department?.name || member.departmentName || "General"}
                          </p>
                          <p className={`text-[11px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                            {member.jobTitle || "Team Member"}
                          </p>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full border ${
                              member.role === "admin"
                                ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
                                : member.role === "manager"
                                ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                                : "bg-white/[0.04] text-slate-400 border-white/[0.08]"
                            }`}
                          >
                            {member.role}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {member.isActive === false ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-500/15 text-slate-400 border border-slate-500/20">
                              Deactivated
                            </span>
                          ) : (
                            <span
                              className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                                isDark ? statusObj.pillDark : statusObj.pillLight
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${statusObj.dot}`} />
                              {statusObj.label}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => openEditUserDrawer(member)}
                              className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold flex items-center gap-1 cursor-pointer ${
                                isDark
                                  ? "bg-white/[0.03] border-white/[0.08] hover:bg-white/[0.08] text-slate-200"
                                  : "bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700"
                              }`}
                            >
                              <SlidersHorizontal className="w-3 h-3" />
                              <span>Manage</span>
                            </button>
                            {member._id !== user?._id && (
                              <button
                                type="button"
                                onClick={() => openDirectChat?.(member)}
                                className={`p-1.5 rounded-lg border cursor-pointer ${
                                  isDark
                                    ? "bg-white/[0.03] border-white/[0.08] text-indigo-300 hover:bg-white/[0.08]"
                                    : "bg-slate-50 border-slate-200 text-indigo-600 hover:bg-slate-100"
                                }`}
                                title="Send Direct Message"
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {isAdmin && member._id !== user?._id && (
                              <button
                                type="button"
                                onClick={() => handleToggleAccountActive(member)}
                                className={`p-1.5 rounded-lg border cursor-pointer ${
                                  member.isActive === false
                                    ? "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                                    : "border-rose-500/30 text-rose-400 hover:bg-rose-500/10"
                                }`}
                                title={member.isActive === false ? "Reactivate account" : "Deactivate account"}
                              >
                                {member.isActive === false ? (
                                  <UserCheck className="w-3.5 h-3.5" />
                                ) : (
                                  <UserX className="w-3.5 h-3.5" />
                                )}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredManagedUsers.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-slate-400">
                        {loadingUsers ? "Loading users..." : "No matching users found."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: ADMIN AUDIT LOGS */}
      {activeTab === "audit" && isAdmin && (
        <div className="space-y-4">
          <div className={`${cardClass} p-4 flex flex-wrap items-center justify-between gap-3`}>
            <div className="flex flex-wrap items-center gap-2.5 flex-1">
              <div className="relative min-w-[240px] flex-1 max-w-md">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && loadAuditLogsData(1)}
                  placeholder="Search user email, endpoint, action ID..."
                  className={`${inputClass} pl-9 py-2 text-xs`}
                />
              </div>

              <select
                value={auditStatusFilter}
                onChange={(e) => {
                  setAuditStatusFilter(e.target.value);
                }}
                className={`rounded-xl border px-3 py-2 text-xs outline-none ${
                  isDark ? "bg-[#12131b] border-white/[0.08] text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                }`}
              >
                <option value="">All Outcomes</option>
                <option value="SUCCESS">Success Only</option>
                <option value="FAILURE">Failures Only</option>
              </select>

              <button
                type="button"
                onClick={() => loadAuditLogsData(1)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer ${
                  isDark ? "bg-white text-slate-950 hover:bg-slate-200" : "bg-slate-900 text-white hover:bg-slate-800"
                }`}
              >
                Apply Filter
              </button>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <span className={isDark ? "text-slate-400" : "text-slate-500"}>
                {formatNumberIN(auditTotal)} logged events
              </span>
              <button
                type="button"
                onClick={() => loadAuditLogsData(auditPage)}
                className={`p-2 rounded-xl border cursor-pointer ${
                  isDark ? "bg-white/[0.03] border-white/[0.08] text-slate-300" : "bg-slate-50 border-slate-200 text-slate-600"
                }`}
                title="Refresh audit logs"
              >
                <RefreshCw className={`w-4 h-4 ${loadingAudit ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          <div className={`${cardClass} overflow-hidden`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr
                    className={`border-b text-[11px] uppercase tracking-wider ${
                      isDark ? "border-white/[0.08] bg-white/[0.02] text-slate-400" : "border-slate-200 bg-slate-50 text-slate-500"
                    }`}
                  >
                    <th className="py-3 px-4 font-semibold">Timestamp</th>
                    <th className="py-3 px-4 font-semibold">Actor</th>
                    <th className="py-3 px-4 font-semibold">Action & Endpoint</th>
                    <th className="py-3 px-4 font-semibold">Outcome</th>
                    <th className="py-3 px-4 font-semibold text-right">Duration</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDark ? "divide-white/[0.05]" : "divide-slate-100"}`}>
                  {auditLogs.map((log) => (
                    <tr
                      key={log._id}
                      onClick={() => setSelectedAuditLog(log)}
                      className={`cursor-pointer transition-colors ${
                        isDark ? "hover:bg-white/[0.03]" : "hover:bg-slate-50"
                      }`}
                    >
                      <td className="py-3 px-4 font-mono text-[11px] whitespace-nowrap">
                        <p>{formatDateIN(log.timestamp)}</p>
                        <p className={isDark ? "text-slate-500" : "text-slate-400"}>
                          {formatTimeIN(log.timestamp)}
                        </p>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <UserAvatar
                            user={log.user}
                            name={log.user?.fullname || log.userEmail || "System"}
                            className="w-7 h-7 rounded-lg shrink-0"
                            textClass="text-[10px]"
                          />
                          <div className="min-w-0">
                            <p className="font-semibold truncate">
                              {log.user?.fullname || log.userEmail || "System"}
                            </p>
                            <p className={`text-[10px] truncate ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                              {log.userRole || log.user?.role || "guest"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-semibold truncate max-w-md">{log.action}</p>
                        <p className={`text-[11px] font-mono truncate max-w-md ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                          {log.method} {log.path || log.url}
                        </p>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            log.status === "FAILURE"
                              ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                              : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          }`}
                        >
                          {log.statusCode || (log.status === "FAILURE" ? 400 : 200)} · {log.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-[11px] whitespace-nowrap">
                        {log.durationMs ?? 0} ms
                      </td>
                    </tr>
                  ))}
                  {auditLogs.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-slate-400">
                        {loadingAudit ? "Loading audit logs..." : "No audit entries found."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            {auditTotalPages > 1 && (
              <div className={`px-4 py-3 border-t flex items-center justify-between text-xs ${isDark ? "border-white/[0.06]" : "border-slate-200"}`}>
                <span className={isDark ? "text-slate-400" : "text-slate-500"}>
                  Page {auditPage} of {auditTotalPages}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={auditPage <= 1}
                    onClick={() => loadAuditLogsData(auditPage - 1)}
                    className={`p-1.5 rounded-lg border disabled:opacity-40 cursor-pointer ${
                      isDark ? "border-white/[0.08] hover:bg-white/[0.06]" : "border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    disabled={auditPage >= auditTotalPages}
                    onClick={() => loadAuditLogsData(auditPage + 1)}
                    className={`p-1.5 rounded-lg border disabled:opacity-40 cursor-pointer ${
                      isDark ? "border-white/[0.08] hover:bg-white/[0.06]" : "border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SIDE DRAWER: CREATE USER */}
      <SideDrawer
        isOpen={showCreateUserDrawer}
        onClose={() => setShowCreateUserDrawer(false)}
        title="Add Workspace User"
        subtitle="Create a direct member account with role & department assignment"
        icon={Plus}
        widthClass="max-w-md"
      >
        <form onSubmit={handleCreateUserSubmit} className="space-y-4 text-xs">
          <div>
            <label className="font-semibold block mb-1.5">Full Name *</label>
            <input
              type="text"
              required
              value={createForm.fullname}
              onChange={(e) => setCreateForm({ ...createForm, fullname: e.target.value })}
              placeholder="e.g. Ananya Iyer"
              className={inputClass}
            />
          </div>
          <div>
            <label className="font-semibold block mb-1.5">Work Email *</label>
            <input
              type="email"
              required
              value={createForm.email}
              onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
              placeholder="ananya@company.in"
              className={inputClass}
            />
          </div>
          <div>
            <label className="font-semibold block mb-1.5">Initial Password</label>
            <input
              type="password"
              value={createForm.password}
              onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
              placeholder="Default: Lira@2026"
              className={inputClass}
            />
          </div>
          <div>
            <label className="font-semibold block mb-1.5">Job Title</label>
            <input
              type="text"
              value={createForm.jobTitle}
              onChange={(e) => setCreateForm({ ...createForm, jobTitle: e.target.value })}
              placeholder="e.g. Product Manager"
              className={inputClass}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold block mb-1.5">Role</label>
              <select
                value={createForm.role}
                onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
                className={inputClass}
              >
                {(roles && roles.length > 0
                  ? roles.filter((r) => isSuperAdmin || (!r.isSystem && r.name !== "superadmin"))
                  : [
                      { name: "employee", displayName: "Employee" },
                      { name: "manager", displayName: "Manager" },
                      { name: "admin", displayName: "Admin" },
                    ]
                ).map((r) => (
                  <option key={r.name} value={r.name}>
                    {r.displayName || r.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="font-semibold block mb-1.5">Department</label>
              <select
                value={createForm.department}
                onChange={(e) => setCreateForm({ ...createForm, department: e.target.value })}
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
          </div>

          <div className={`pt-4 border-t flex justify-end gap-2 ${isDark ? "border-white/[0.08]" : "border-slate-200"}`}>
            <button
              type="button"
              onClick={() => setShowCreateUserDrawer(false)}
              className="px-4 py-2 rounded-xl font-semibold text-slate-400 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creatingUser}
              className={`px-5 py-2 rounded-xl font-semibold cursor-pointer ${
                isDark ? "bg-white text-slate-950 hover:bg-slate-200" : "bg-slate-900 text-white hover:bg-slate-800"
              }`}
            >
              {creatingUser ? "Creating..." : "Create User"}
            </button>
          </div>
        </form>
      </SideDrawer>

      {/* SIDE DRAWER: INSPECT & EDIT USER DETAILS */}
      <SideDrawer
        isOpen={Boolean(selectedUserDrawer)}
        onClose={() => setSelectedUserDrawer(null)}
        title={selectedUserDrawer?.fullname || "User Details"}
        subtitle={selectedUserDrawer?.email}
        icon={ShieldCheck}
        badge={
          selectedUserDrawer?.publicId && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              {selectedUserDrawer.publicId}
            </span>
          )
        }
        widthClass="max-w-lg"
      >
        {selectedUserDrawer && (
          <form onSubmit={handleSaveUserEdit} className="space-y-4 text-xs">
            <div
              className={`p-4 rounded-xl border flex items-center gap-3.5 ${
                isDark ? "bg-white/[0.02] border-white/[0.08]" : "bg-slate-50 border-slate-200"
              }`}
            >
              <UserAvatar user={selectedUserDrawer} className="w-14 h-14 rounded-2xl shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold truncate">{selectedUserDrawer.fullname}</p>
                <p className={`text-xs truncate ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  Joined {selectedUserDrawer.createdAt ? formatDateIN(selectedUserDrawer.createdAt) : "—"}
                </p>
              </div>
              {selectedUserDrawer._id !== user?._id && (
                <button
                  type="button"
                  onClick={() => {
                    openDirectChat?.(selectedUserDrawer);
                    setSelectedUserDrawer(null);
                  }}
                  className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1 cursor-pointer ${
                    isDark ? "bg-white text-slate-950" : "bg-slate-900 text-white"
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>DM</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold block mb-1.5">Full Name</label>
                <input
                  type="text"
                  required
                  value={editUserForm.fullname}
                  onChange={(e) => setEditUserForm({ ...editUserForm, fullname: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="font-semibold block mb-1.5">Phone</label>
                <input
                  type="text"
                  value={editUserForm.phone}
                  onChange={(e) => setEditUserForm({ ...editUserForm, phone: e.target.value })}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold block mb-1.5">Role</label>
                <select
                  value={editUserForm.role}
                  disabled={!isAdmin}
                  onChange={(e) => setEditUserForm({ ...editUserForm, role: e.target.value })}
                  className={inputClass}
                >
                  {(roles && roles.length > 0
                    ? roles.filter((r) => isSuperAdmin || (!r.isSystem && r.name !== "superadmin"))
                    : [
                        { name: "employee", displayName: "Employee" },
                        { name: "manager", displayName: "Manager" },
                        { name: "admin", displayName: "Admin" },
                      ]
                  ).map((r) => (
                    <option key={r.name} value={r.name}>
                      {r.displayName || r.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="font-semibold block mb-1.5">Department</label>
                <select
                  value={editUserForm.department}
                  onChange={(e) => setEditUserForm({ ...editUserForm, department: e.target.value })}
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
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold block mb-1.5">Job Title</label>
                <input
                  type="text"
                  value={editUserForm.jobTitle}
                  onChange={(e) => setEditUserForm({ ...editUserForm, jobTitle: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="font-semibold block mb-1.5">Availability</label>
                <select
                  value={editUserForm.status}
                  onChange={(e) => setEditUserForm({ ...editUserForm, status: e.target.value })}
                  className={inputClass}
                >
                  <option value="active">Available</option>
                  <option value="away">Away</option>
                  <option value="on_leave">On Leave</option>
                </select>
              </div>
            </div>

            <div>
              <label className="font-semibold block mb-1.5">Bio / Role Notes</label>
              <textarea
                rows={3}
                value={editUserForm.bio}
                onChange={(e) => setEditUserForm({ ...editUserForm, bio: e.target.value })}
                className={`${inputClass} resize-none`}
              />
            </div>

            {isAdmin && selectedUserDrawer._id !== user?._id && (
              <label className="flex items-center gap-2 pt-1 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={editUserForm.isActive}
                  onChange={(e) => setEditUserForm({ ...editUserForm, isActive: e.target.checked })}
                />
                <span>Account active (can sign in and access workspace)</span>
              </label>
            )}

            <div className={`pt-4 border-t flex justify-end gap-2 ${isDark ? "border-white/[0.08]" : "border-slate-200"}`}>
              <button
                type="button"
                onClick={() => setSelectedUserDrawer(null)}
                className="px-4 py-2 rounded-xl font-semibold text-slate-400 cursor-pointer"
              >
                Close
              </button>
              <button
                type="submit"
                disabled={savingUserEdit}
                className={`px-5 py-2 rounded-xl font-semibold cursor-pointer ${
                  isDark ? "bg-white text-slate-950 hover:bg-slate-200" : "bg-slate-900 text-white hover:bg-slate-800"
                }`}
              >
                {savingUserEdit ? "Saving..." : "Save User Changes"}
              </button>
            </div>
          </form>
        )}
      </SideDrawer>

      {/* SIDE DRAWER: AUDIT LOG DETAILS */}
      <SideDrawer
        isOpen={Boolean(selectedAuditLog)}
        onClose={() => setSelectedAuditLog(null)}
        title={selectedAuditLog?.action || "Audit Log Details"}
        subtitle={selectedAuditLog ? `${formatDateIN(selectedAuditLog.timestamp)} · ${formatTimeIN(selectedAuditLog.timestamp)}` : ""}
        icon={History}
        widthClass="max-w-lg"
      >
        {selectedAuditLog && (
          <div className="space-y-4 text-xs">
            <div className={`p-4 rounded-xl border space-y-2.5 ${isDark ? "bg-white/[0.02] border-white/[0.08]" : "bg-slate-50 border-slate-200"}`}>
              <div className="flex justify-between gap-2">
                <span className={isDark ? "text-slate-400" : "text-slate-500"}>Action ID</span>
                <span className="font-mono">{selectedAuditLog.actionId || selectedAuditLog._id}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className={isDark ? "text-slate-400" : "text-slate-500"}>Actor</span>
                <span>{selectedAuditLog.user?.fullname || selectedAuditLog.userEmail || "System"}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className={isDark ? "text-slate-400" : "text-slate-500"}>Role</span>
                <span className="uppercase font-semibold">{selectedAuditLog.userRole || "—"}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className={isDark ? "text-slate-400" : "text-slate-500"}>Endpoint</span>
                <span className="font-mono break-all text-right">
                  {selectedAuditLog.method} {selectedAuditLog.url || selectedAuditLog.path}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className={isDark ? "text-slate-400" : "text-slate-500"}>HTTP Outcome</span>
                <span className="font-mono">
                  {selectedAuditLog.statusCode} ({selectedAuditLog.status}) · {selectedAuditLog.durationMs} ms
                </span>
              </div>
              {selectedAuditLog.ip && (
                <div className="flex justify-between gap-2">
                  <span className={isDark ? "text-slate-400" : "text-slate-500"}>IP Address</span>
                  <span className="font-mono">{selectedAuditLog.ip}</span>
                </div>
              )}
            </div>

            {selectedAuditLog.details && (
              <div className="space-y-1.5">
                <span className={`font-semibold uppercase tracking-wider text-[11px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  Event Payload
                </span>
                <pre
                  className={`p-3.5 rounded-xl border text-[11px] font-mono overflow-x-auto ${
                    isDark ? "bg-[#12131b] border-white/[0.08] text-slate-300" : "bg-slate-50 border-slate-200 text-slate-800"
                  }`}
                >
                  {JSON.stringify(selectedAuditLog.details, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </SideDrawer>
    </div>
  );
}
