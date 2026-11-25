import React, { useState, useEffect } from "react";
import { useApp } from "../context/Appcontext";
import {
  getTeamMembers,
  createUser,
  updateUser,
  deleteUser,
  getPendingJoinRequests,
  approveJoinRequest,
  rejectJoinRequest,
} from "../services/api";
import { initSocketClient } from "../services/socket";
import {
  Users,
  UserPlus,
  Mail,
  Briefcase,
  Building,
  CheckCircle,
  AlertCircle,
  Search,
  Filter,
  Trash2,
  X,
  RefreshCw,
  Clock,
  Check,
  ShieldCheck,
  Copy,
  Sparkles,
  MessageSquare,
  SlidersHorizontal,
  Phone,
} from "lucide-react";
import toast from "react-hot-toast";
import UserAvatar from "../components/common/UserAvatar";
import SideDrawer from "../components/common/SideDrawer";

export default function Team() {
  const { user, departments, refreshDepartments, theme, openDirectChat } = useApp();
  const isDark = theme === "dark";

  const [activeTab, setActiveTab] = useState("directory"); // 'directory' | 'join-requests'
  const [members, setMembers] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedDept, setSelectedDept] = useState("all");

  // Create User Modal
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [fullname, setFullname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("employee");
  const [departmentId, setDepartmentId] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [actionId, setActionId] = useState(null);

  // Selected member SideDrawer
  const [selectedMember, setSelectedMember] = useState(null);
  const [editRole, setEditRole] = useState("employee");
  const [editDeptId, setEditDeptId] = useState("");
  const [editJobTitle, setEditJobTitle] = useState("");
  const [editStatus, setEditStatus] = useState("active");
  const [savingEdit, setSavingEdit] = useState(false);

  const openMemberDrawer = (member) => {
    setSelectedMember(member);
    setEditRole(member.role || "employee");
    setEditDeptId(member.department?._id || member.department || "");
    setEditJobTitle(member.jobTitle || "");
    setEditStatus(member.status || "active");
  };

  const handleSaveMemberUpdate = async (e) => {
    e.preventDefault();
    if (!selectedMember) return;
    setSavingEdit(true);
    const matchedDept = (departments || []).find((d) => d._id === editDeptId);
    const res = await updateUser(selectedMember._id, {
      role: editRole,
      department: editDeptId || null,
      departmentName: matchedDept ? matchedDept.name : "General",
      jobTitle: editJobTitle.trim(),
      status: editStatus,
    });
    setSavingEdit(false);
    if (res.success) {
      toast.success("Member details updated");
      setSelectedMember(res.user);
      fetchMembers();
      refreshDepartments?.();
    } else {
      toast.error(res.message || "Failed to update member");
    }
  };

  const fetchMembers = async () => {
    setLoading(true);
    const res = await getTeamMembers();
    if (res.success) {
      setMembers(res.members || res.users || []);
    }
    setLoading(false);
  };

  const fetchJoinRequests = async () => {
    if (user?.role === "admin" || user?.role === "manager") {
      const res = await getPendingJoinRequests();
      if (res.success) {
        setPendingRequests(res.requests || []);
      }
    }
  };

  useEffect(() => {
    fetchMembers();
    fetchJoinRequests();

    // Real-time WebSocket listener for new join requests & updates
    if (user?._id) {
      const socket = initSocketClient(user._id);

      const handleNewRequest = (data) => {
        toast((t) => (
          <div className="flex items-start gap-2.5">
            <span className="text-xl">👋</span>
            <div>
              <p className="font-bold text-xs text-white">New Team Join Request</p>
              <p className="text-[11px] text-slate-300">
                {data.user?.fullname} ({data.user?.publicId}) requested to join {data.user?.departmentName}.
              </p>
            </div>
          </div>
        ), { duration: 6000 });

        fetchJoinRequests();
      };

      const handleUpdatedRequest = () => {
        fetchJoinRequests();
        fetchMembers();
      };

      socket.on("join-request:new", handleNewRequest);
      socket.on("join-request:updated", handleUpdatedRequest);

      return () => {
        socket.off("join-request:new", handleNewRequest);
        socket.off("join-request:updated", handleUpdatedRequest);
      };
    }
  }, [user?._id, user?.role]);

  const handleApprove = async (candidate) => {
    setActionId(candidate._id);
    const res = await approveJoinRequest(candidate._id, {
      departmentName: candidate.joinRequest?.requestedDepartmentName || candidate.departmentName,
      jobTitle: candidate.joinRequest?.requestedJobTitle || candidate.jobTitle,
      role: candidate.joinRequest?.requestedRole || "employee",
    });
    setActionId(null);

    if (res.success) {
      fetchJoinRequests();
      fetchMembers();
    }
  };

  const handleReject = async (candidate) => {
    const reason = window.prompt(`Enter reason for declining ${candidate.fullname}'s request:`, "Position filled or information incomplete");
    if (reason === null) return;

    setActionId(candidate._id);
    const res = await rejectJoinRequest(candidate._id, reason);
    setActionId(null);

    if (res.success) {
      fetchJoinRequests();
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!fullname.trim() || !email.trim()) return;

    setSubmitting(true);
    const res = await createUser({
      fullname: fullname.trim(),
      email: email.trim(),
      password: password.trim() || "Lira@2026",
      role,
      department: departmentId || null,
      jobTitle: jobTitle.trim(),
    });
    setSubmitting(false);

    if (res.success) {
      setShowAddUserModal(false);
      setFullname("");
      setEmail("");
      setPassword("");
      setJobTitle("");
      fetchMembers();
    }
  };

  const handleDeactivateUser = async (userId, userName) => {
    if (!window.confirm(`Are you sure you want to deactivate ${userName}'s account?`)) return;
    const res = await deleteUser(userId);
    if (res.success) {
      toast.success(`${userName}'s account deactivated`);
      fetchMembers();
    }
  };

  const filteredMembers = (members || []).filter((m) => {
    const q = search.toLowerCase();
    const matchesSearch =
      m.fullname?.toLowerCase().includes(q) ||
      m.email?.toLowerCase().includes(q) ||
      m.jobTitle?.toLowerCase().includes(q) ||
      m.departmentName?.toLowerCase().includes(q);

    if (!matchesSearch) return false;
    if (selectedDept !== "all" && m.department?._id !== selectedDept && m.department !== selectedDept) {
      return false;
    }
    return true;
  });

  const canManage = user?.role === "admin" || user?.role === "manager";

  return (
    <div
      className={`flex-1 w-full h-full min-h-0 overflow-y-auto p-5 sm:p-7 space-y-6 transition-colors duration-150 ${
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
            Team Directory & Governance
          </h1>
          <p className={`text-xs sm:text-sm mt-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
            Manage verified team members, review public ID onboarding requests, and monitor assignments.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              fetchMembers();
              fetchJoinRequests();
            }}
            className={`p-2 rounded-full border transition-colors cursor-pointer ${
              isDark
                ? "bg-white/5 hover:bg-white/10 border-white/10 text-slate-300 hover:text-white"
                : "bg-white hover:bg-slate-100 border-slate-200 text-slate-700 shadow-xs"
            }`}
            title="Refresh list"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-indigo-400" : ""}`} />
          </button>

          {user?.role === "admin" && (
            <button
              onClick={() => setShowAddUserModal(true)}
              className={`flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-full transition-all cursor-pointer ${
                isDark ? "bg-white text-slate-950 hover:bg-slate-200" : "bg-slate-900 text-white hover:bg-slate-800"
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Add Member</span>
            </button>
          )}
        </div>
      </div>

      {/* Primary Tab Switcher */}
      {canManage && (
        <div className="flex items-center gap-2 border-b border-white/10 pb-2">
          <button
            onClick={() => setActiveTab("directory")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "directory"
                ? "bg-purple-600 text-white shadow-lg shadow-purple-500/20"
                : isDark
                ? "text-slate-400 hover:text-white hover:bg-white/5"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Active Team Members ({members.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("join-requests")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer relative ${
              activeTab === "join-requests"
                ? "bg-amber-600 text-white shadow-lg shadow-amber-500/20"
                : isDark
                ? "text-slate-400 hover:text-white hover:bg-white/5"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Pending Join Requests</span>
            {pendingRequests.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black text-[10px] animate-pulse">
                {pendingRequests.length}
              </span>
            )}
          </button>
        </div>
      )}

      {/* TAB 1: PENDING JOIN REQUESTS */}
      {activeTab === "join-requests" && canManage ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Incoming Onboarding & Google Sign-up Requests</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">
                  {pendingRequests.length} pending review
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Applicants must be approved by an Admin or Manager before accessing sprints, tasks, and files.
              </p>
            </div>
          </div>

          {pendingRequests.length === 0 ? (
            <div className="p-12 rounded-3xl border border-white/10 bg-[#14151f] text-center space-y-2">
              <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto" />
              <h3 className="text-sm font-bold text-white">All Clear! No Pending Requests</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Any candidate who signs up with Google or submits a request to join will appear here in real-time.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pendingRequests.map((candidate) => (
                <div
                  key={candidate._id}
                  className="p-5 rounded-3xl bg-[#14151f] border border-white/10 shadow-xl space-y-4 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    {/* Top Row: Avatar & Public ID */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <UserAvatar
                          user={candidate}
                          className="w-11 h-11 rounded-2xl border border-purple-500/30"
                          textClass="text-sm"
                        />
                        <div>
                          <h4 className="text-sm font-bold text-white">{candidate.fullname}</h4>
                          <p className="text-xs text-slate-400">{candidate.email}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#191a26] border border-purple-500/30 text-purple-300 font-mono text-xs font-bold">
                        <span>{candidate.publicId || "EMP-PENDING"}</span>
                      </div>
                    </div>

                    {/* Department & Role Badge */}
                    <div className="p-3 rounded-2xl bg-[#191a26] border border-white/5 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between text-slate-300">
                        <span className="text-[11px] text-slate-400">Target Department:</span>
                        <span className="font-bold text-purple-300">
                          {candidate.joinRequest?.requestedDepartmentName || candidate.departmentName || "Engineering"}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-slate-300">
                        <span className="text-[11px] text-slate-400">Requested Title:</span>
                        <span className="font-semibold text-white">
                          {candidate.joinRequest?.requestedJobTitle || candidate.jobTitle || "Team Member"}
                        </span>
                      </div>

                      {candidate.joinRequest?.reason && (
                        <div className="pt-1 border-t border-white/5">
                          <span className="text-[10px] text-slate-400 block">Note from candidate:</span>
                          <p className="text-xs text-slate-300 italic mt-0.5">
                            "{candidate.joinRequest.reason}"
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions Row */}
                  <div className="flex items-center gap-2 pt-2 border-t border-white/10">
                    <button
                      type="button"
                      onClick={() => handleReject(candidate)}
                      disabled={actionId === candidate._id}
                      className="w-1/3 py-2 px-3 rounded-xl text-xs font-bold text-rose-300 hover:text-white bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Decline</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleApprove(candidate)}
                      disabled={actionId === candidate._id}
                      className="w-2/3 py-2 px-3 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{actionId === candidate._id ? "Approving..." : "Approve & Grant Access"}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* TAB 2: ACTIVE TEAM DIRECTORY */
        <>
          {/* Search & Department Filters */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Department Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              <button
                onClick={() => setSelectedDept("all")}
                className={`text-xs font-semibold px-3.5 py-1.5 rounded-full transition-all cursor-pointer ${
                  selectedDept === "all"
                    ? isDark
                      ? "bg-white text-slate-950 font-bold shadow-xs"
                      : "bg-slate-900 text-white font-bold shadow-xs"
                    : isDark
                    ? "bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/10"
                    : "bg-white hover:bg-slate-100 text-slate-600 border border-slate-200"
                }`}
              >
                All Departments
              </button>
              {departments.map((d) => (
                <button
                  key={d._id}
                  onClick={() => setSelectedDept(d._id)}
                  className={`text-xs font-semibold px-3.5 py-1.5 rounded-full transition-all whitespace-nowrap cursor-pointer ${
                    selectedDept === d._id
                      ? "bg-indigo-600 text-white font-bold shadow-xs"
                      : isDark
                      ? "bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/10"
                      : "bg-white hover:bg-slate-100 text-slate-600 border border-slate-200"
                  }`}
                >
                  {d.name}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by name, role, email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={`border rounded-full pl-9 pr-4 py-1.5 text-xs focus:outline-none w-60 sm:w-72 ${
                  isDark
                    ? "bg-[#15161f] border-white/10 text-white placeholder-slate-400"
                    : "bg-white border-slate-200 text-slate-900 placeholder-slate-500 shadow-xs"
                }`}
              />
            </div>
          </div>

          {/* Directory Grid */}
          {loading ? (
            <div className="h-64 flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-slate-500 font-medium">Loading team members...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredMembers.map((member) => (
                <div
                  key={member._id}
                  className={`p-5 rounded-2xl border flex flex-col justify-between transition-all ${
                    isDark
                      ? "bg-[#15161f] border-white/10 shadow-sm"
                      : "bg-white border-slate-200 shadow-xs"
                  }`}
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3 mb-3.5">
                      <div className="flex items-center gap-3">
                        <UserAvatar
                          user={member}
                          className="w-11 h-11 rounded-2xl border border-purple-500/20"
                          textClass="text-sm"
                        />
                        <div>
                          <h3 className={`text-sm font-bold truncate ${isDark ? "text-white" : "text-slate-900"}`}>
                            {member.fullname}
                          </h3>
                          <p className="text-xs text-slate-400 truncate">{member.email}</p>
                        </div>
                      </div>

                      {member.publicId && (
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg bg-white/5 border border-white/10 text-slate-400">
                          {member.publicId}
                        </span>
                      )}
                    </div>

                    {/* Department & Job Title */}
                    <div className={`space-y-1.5 pt-2 border-t text-xs ${isDark ? "border-white/5" : "border-slate-100"}`}>
                      <div className={`flex items-center justify-between ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                        <span className="flex items-center gap-1.5">
                          <Building className="w-3.5 h-3.5 text-purple-400" />
                          <span>Department:</span>
                        </span>
                        <span className={`font-semibold ${isDark ? "text-slate-200" : "text-slate-800"}`}>
                          {member.department?.name || member.departmentName || "General"}
                        </span>
                      </div>

                      <div className={`flex items-center justify-between ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                        <span className="flex items-center gap-1.5">
                          <Briefcase className="w-3.5 h-3.5 text-blue-400" />
                          <span>Role / Title:</span>
                        </span>
                        <span className={`font-semibold ${isDark ? "text-slate-200" : "text-slate-800"}`}>
                          {member.jobTitle || "Team Member"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Footer & Controls */}
                  <div className={`pt-4 mt-3 border-t flex items-center justify-between gap-2 ${isDark ? "border-white/5" : "border-slate-100"}`}>
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                        member.role === "admin"
                          ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                          : member.role === "manager"
                          ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                          : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                      }`}
                    >
                      <span>{member.role === "admin" ? "Admin" : member.role === "manager" ? "Manager" : "Member"}</span>
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => openMemberDrawer(member)}
                        className={`text-xs font-semibold px-2.5 py-1 rounded-lg border flex items-center gap-1 transition-colors cursor-pointer ${
                          isDark
                            ? "bg-white/[0.03] border-white/10 text-slate-300 hover:bg-white/[0.08] hover:text-white"
                            : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                        }`}
                        title="View & manage profile"
                      >
                        <SlidersHorizontal className="w-3 h-3" />
                        <span>Details</span>
                      </button>

                      {member._id !== user?._id && (
                        <button
                          onClick={() => openDirectChat(member)}
                          className={`text-xs font-semibold px-2.5 py-1 rounded-lg border flex items-center gap-1 transition-colors cursor-pointer ${
                            isDark
                              ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-300 hover:bg-indigo-600 hover:text-white"
                              : "bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-600 hover:text-white"
                          }`}
                          title={`Message ${member.fullname}`}
                        >
                          <MessageSquare className="w-3 h-3" />
                          <span>DM</span>
                        </button>
                      )}

                      {user?.role === "admin" && member._id !== user._id && (
                        <button
                          onClick={() => handleDeactivateUser(member._id, member.fullname)}
                          className="text-xs text-rose-400 hover:text-rose-300 p-1.5 rounded-lg hover:bg-rose-500/10 transition-colors cursor-pointer"
                          title="Deactivate account"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Add User Side Drawer */}
      <SideDrawer
        isOpen={showAddUserModal}
        onClose={() => setShowAddUserModal(false)}
        title="Add Team Member"
        subtitle="Create a new workspace account directly"
        icon={UserPlus}
        widthClass="max-w-md"
      >
        <form onSubmit={handleCreateUser} className="space-y-4">
          <div>
            <label className="text-xs font-semibold block mb-1.5">Full Name *</label>
            <input
              type="text"
              placeholder="Rahul Sharma"
              value={fullname}
              onChange={(e) => setFullname(e.target.value)}
              className={`w-full border rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-indigo-500 ${
                isDark ? "bg-[#12131b] border-white/10 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
              }`}
              required
            />
          </div>

          <div>
            <label className="text-xs font-semibold block mb-1.5">Work Email *</label>
            <input
              type="email"
              placeholder="rahul@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`w-full border rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-indigo-500 ${
                isDark ? "bg-[#12131b] border-white/10 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
              }`}
              required
            />
          </div>

          <div>
            <label className="text-xs font-semibold block mb-1.5">Initial Password</label>
            <input
              type="password"
              placeholder="Default: Lira@2026"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`w-full border rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-indigo-500 ${
                isDark ? "bg-[#12131b] border-white/10 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
              }`}
            />
          </div>

          <div>
            <label className="text-xs font-semibold block mb-1.5">Job Title</label>
            <input
              type="text"
              placeholder="e.g. Senior Frontend Engineer"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              className={`w-full border rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-indigo-500 ${
                isDark ? "bg-[#12131b] border-white/10 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
              }`}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold block mb-1.5">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className={`w-full border rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:outline-none ${
                  isDark ? "bg-[#12131b] border-white/10 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                }`}
              >
                <option value="employee">Employee</option>
                <option value="manager">Manager / Lead</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold block mb-1.5">Department</label>
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                className={`w-full border rounded-xl px-3.5 py-2.5 text-xs focus:outline-none ${
                  isDark ? "bg-[#12131b] border-white/10 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                }`}
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

          <div className={`pt-4 flex justify-end gap-2 border-t ${isDark ? "border-white/10" : "border-slate-100"}`}>
            <button
              type="button"
              onClick={() => setShowAddUserModal(false)}
              className={`px-4 py-2 text-xs font-semibold rounded-xl cursor-pointer ${
                isDark ? "text-slate-400 hover:bg-white/5" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={`px-5 py-2 text-xs font-semibold rounded-xl cursor-pointer ${
                isDark ? "bg-white text-slate-950 hover:bg-slate-200" : "bg-slate-900 text-white hover:bg-slate-800"
              }`}
            >
              {submitting ? "Saving..." : "Create Account"}
            </button>
          </div>
        </form>
      </SideDrawer>

      {/* Member Details & Management Side Drawer */}
      <SideDrawer
        isOpen={Boolean(selectedMember)}
        onClose={() => setSelectedMember(null)}
        title={selectedMember?.fullname || "Team Member"}
        subtitle={selectedMember?.email}
        icon={Users}
        badge={
          selectedMember?.publicId && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              {selectedMember.publicId}
            </span>
          )
        }
        widthClass="max-w-lg"
      >
        {selectedMember && (
          <div className="space-y-5">
            <div
              className={`p-4 rounded-xl border flex items-center gap-4 ${
                isDark ? "bg-white/[0.02] border-white/[0.08]" : "bg-slate-50 border-slate-200"
              }`}
            >
              <UserAvatar
                user={selectedMember}
                className="w-16 h-16 rounded-2xl border border-white/10 shrink-0"
                textClass="text-lg"
              />
              <div className="min-w-0 flex-1 space-y-1">
                <h3 className="text-base font-bold truncate">{selectedMember.fullname}</h3>
                <p className={`text-xs truncate ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  {selectedMember.jobTitle || "Team Member"} · {selectedMember.department?.name || selectedMember.departmentName || "General"}
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span
                    className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                      selectedMember.status === "on_leave"
                        ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                        : selectedMember.status === "away"
                        ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        selectedMember.status === "on_leave"
                          ? "bg-rose-400"
                          : selectedMember.status === "away"
                          ? "bg-amber-400"
                          : "bg-emerald-400"
                      }`}
                    />
                    {selectedMember.status === "on_leave"
                      ? "On Leave"
                      : selectedMember.status === "away"
                      ? "Away"
                      : "Available"}
                  </span>
                  {selectedMember.phone && (
                    <span className={`text-[11px] flex items-center gap-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                      <Phone className="w-3 h-3" /> {selectedMember.phone}
                    </span>
                  )}
                </div>
              </div>
              {selectedMember._id !== user?._id && (
                <button
                  type="button"
                  onClick={() => {
                    openDirectChat(selectedMember);
                    setSelectedMember(null);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer shrink-0 ${
                    isDark ? "bg-white text-slate-950 hover:bg-slate-200" : "bg-slate-900 text-white hover:bg-slate-800"
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Message</span>
                </button>
              )}
            </div>

            {selectedMember.bio && (
              <div
                className={`p-3.5 rounded-xl border text-xs ${
                  isDark ? "bg-white/[0.02] border-white/[0.06] text-slate-300" : "bg-slate-50 border-slate-200 text-slate-600"
                }`}
              >
                {selectedMember.bio}
              </div>
            )}

            {canManage && (
              <form onSubmit={handleSaveMemberUpdate} className="space-y-3.5 pt-2 border-t border-white/[0.08]">
                <h4 className={`text-xs font-bold uppercase tracking-wider ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  Manage Assignment & Role
                </h4>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold block mb-1.5">Role</label>
                    <select
                      value={editRole}
                      onChange={(e) => setEditRole(e.target.value)}
                      disabled={user?.role !== "admin"}
                      className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none ${
                        isDark ? "bg-[#12131b] border-white/10 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                      }`}
                    >
                      <option value="employee">Employee</option>
                      <option value="manager">Manager</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold block mb-1.5">Department</label>
                    <select
                      value={editDeptId}
                      onChange={(e) => setEditDeptId(e.target.value)}
                      className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none ${
                        isDark ? "bg-[#12131b] border-white/10 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                      }`}
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
                    <label className="text-xs font-semibold block mb-1.5">Job Title</label>
                    <input
                      type="text"
                      value={editJobTitle}
                      onChange={(e) => setEditJobTitle(e.target.value)}
                      className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none ${
                        isDark ? "bg-[#12131b] border-white/10 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                      }`}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold block mb-1.5">Availability Status</label>
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value)}
                      className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none ${
                        isDark ? "bg-[#12131b] border-white/10 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                      }`}
                    >
                      <option value="active">Available</option>
                      <option value="away">Away</option>
                      <option value="on_leave">On Leave</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={savingEdit}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer ${
                      isDark ? "bg-white text-slate-950 hover:bg-slate-200" : "bg-slate-900 text-white hover:bg-slate-800"
                    }`}
                  >
                    {savingEdit ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </SideDrawer>
    </div>
  );
}
