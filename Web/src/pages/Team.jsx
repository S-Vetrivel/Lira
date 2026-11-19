import React, { useState, useEffect } from "react";
import { useApp } from "../context/Appcontext";
import { getTeamMembers, createUser, deleteUser } from "../services/api";
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
} from "lucide-react";
import toast from "react-hot-toast";

export default function Team() {
  const { user, departments, refreshDepartments, theme } = useApp();
  const isDark = theme === "dark";

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedDept, setSelectedDept] = useState("all");

  // Create User Modal
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [fullname, setFullname] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("employee");
  const [departmentId, setDepartmentId] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchMembers = async () => {
    setLoading(true);
    const res = await getTeamMembers();
    if (res.success) {
      setMembers(res.members || res.users || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!fullname.trim() || !email.trim()) return;

    setSubmitting(true);
    const res = await createUser({
      fullname: fullname.trim(),
      email: email.trim(),
      role,
      departmentId: departmentId || null,
      jobTitle: jobTitle.trim(),
    });
    setSubmitting(false);

    if (res.success) {
      toast.success(`Account for ${fullname} created! (Default password: password123)`);
      setShowAddUserModal(false);
      setFullname("");
      setEmail("");
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
            Team Directory
          </h1>
          <p className={`text-xs sm:text-sm mt-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
            {members.length} team members across departments and active assignments.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchMembers}
            className={`p-2 rounded-full border transition-colors ${
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
              className="flex items-center gap-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold px-4 py-2 rounded-full shadow-md shadow-blue-500/20 transition-all cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Add Member</span>
            </button>
          )}
        </div>
      </div>

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
                    <div className="relative">
                      <img
                        src={
                          member.avatar ||
                          `https://api.dicebear.com/7.x/initials/svg?seed=${member.fullname}`
                        }
                        alt={member.fullname}
                        className="w-11 h-11 rounded-2xl border border-white/10 object-cover"
                      />
                      <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full" />
                    </div>
                    <div>
                      <h3
                        className={`font-bold text-sm leading-snug ${
                          isDark ? "text-white" : "text-slate-900"
                        }`}
                      >
                        {member.fullname}
                      </h3>
                      <p className={`text-xs flex items-center gap-1 mt-0.5 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                        <Briefcase className="w-3 h-3 text-slate-400" />
                        <span>{member.jobTitle || "Member"}</span>
                      </p>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${
                      {
                        admin: isDark ? "bg-purple-500/15 text-purple-300 border-purple-500/30" : "bg-purple-50 text-purple-700 border-purple-200",
                        manager: isDark ? "bg-blue-500/15 text-blue-300 border-blue-500/30" : "bg-blue-50 text-blue-700 border-blue-200",
                        employee: isDark ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" : "bg-emerald-50 text-emerald-700 border-emerald-200",
                      }[member.role || "employee"]
                    }`}
                  >
                    {member.role}
                  </span>
                </div>

                {/* Info */}
                <div
                  className={`space-y-1.5 text-xs mb-4 pt-3 border-t ${
                    isDark ? "border-white/5 text-slate-400" : "border-slate-100 text-slate-600"
                  }`}
                >
                  <p className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{member.email}</span>
                  </p>
                  <p className="flex items-center gap-2">
                    <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{member.department?.name || member.departmentName || "General"}</span>
                  </p>
                </div>
              </div>

              {/* Workload footer */}
              <div
                className={`flex items-center justify-between pt-3 border-t ${
                  isDark ? "border-white/5" : "border-slate-100"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                      member.openTasksCount >= 5
                        ? "bg-rose-500/20 text-rose-500 border border-rose-500/30"
                        : member.openTasksCount >= 2
                        ? "bg-blue-500/20 text-blue-500 border border-blue-500/30"
                        : isDark
                        ? "bg-white/5 text-slate-300 border border-white/10"
                        : "bg-slate-100 text-slate-700 border border-slate-200"
                    }`}
                  >
                    {member.openTasksCount || 0} Open
                  </span>
                  <span className="text-[11px] text-slate-400">
                    ({member.completedTasksCount || 0} done)
                  </span>
                </div>

                {user?.role === "admin" && member._id !== user._id && (
                  <button
                    onClick={() => handleDeactivateUser(member._id, member.fullname)}
                    className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-500/10 transition-colors"
                    title="Deactivate account"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add User Modal */}
      {showAddUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => setShowAddUserModal(false)}
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
                Create Team Account
              </h3>
              <button
                onClick={() => setShowAddUserModal(false)}
                className={`p-1 rounded-lg ${isDark ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-900"}`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-3.5">
              <div>
                <label className={`text-xs font-semibold block mb-1 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                  Full Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Arun Kumar"
                  value={fullname}
                  onChange={(e) => setFullname(e.target.value)}
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
                  Email Address *
                </label>
                <input
                  type="email"
                  placeholder="e.g. arun@incuman.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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
                  Job Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Frontend Engineer"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  className={`w-full border rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-indigo-500 ${
                    isDark
                      ? "bg-[#12131b] border-white/10 text-white placeholder-slate-500"
                      : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400"
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`text-xs font-semibold block mb-1 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                    Role
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className={`w-full border rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none ${
                      isDark
                        ? "bg-[#12131b] border-white/10 text-white"
                        : "bg-slate-50 border-slate-200 text-slate-900"
                    }`}
                  >
                    <option value="employee">Employee</option>
                    <option value="manager">Manager / Lead</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div>
                  <label className={`text-xs font-semibold block mb-1 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                    Department
                  </label>
                  <select
                    value={departmentId}
                    onChange={(e) => setDepartmentId(e.target.value)}
                    className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none ${
                      isDark
                        ? "bg-[#12131b] border-white/10 text-white"
                        : "bg-slate-50 border-slate-200 text-slate-900"
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

              <div
                className={`pt-3 flex justify-end gap-2 border-t ${
                  isDark ? "border-white/10" : "border-slate-100"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className={`px-4 py-2 text-xs font-semibold rounded-xl ${
                    isDark ? "text-slate-400 hover:text-white" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-500/20"
                >
                  {submitting ? "Saving..." : "Create Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
