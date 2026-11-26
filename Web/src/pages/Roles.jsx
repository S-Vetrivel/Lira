import React, { useState, useEffect, useMemo } from "react";
import {
  Shield,
  ShieldCheck,
  Plus,
  Edit2,
  Trash2,
  Lock,
  Layers,
  Building,
  Check,
  Minus,
  ChevronDown,
  ChevronRight,
  Users,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { useApp } from "../context/Appcontext";
import {
  getModulesCatalog,
  getRoles,
  createRole,
  updateRole,
  deleteRole,
  createDepartment,
} from "../services/api";
import SideDrawer from "../components/common/SideDrawer";
import toast from "react-hot-toast";

const ROLE_COLORS = [
  "#A855F7",
  "#3B82F6",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#EC4899",
  "#06B6D4",
  "#6366F1",
];

export default function Roles() {
  const {
    user,
    isSuperAdmin,
    hasPermission,
    theme,
    departments,
    refreshDepartments,
    refreshRoles: syncContextRoles,
  } = useApp();
  const isDark = theme === "dark";

  const [activeTab, setActiveTab] = useState("roles"); // 'roles' | 'departments'
  const [roles, setRoles] = useState([]);
  const [modulesCatalog, setModulesCatalog] = useState([]);
  const [loading, setLoading] = useState(true);

  // Role Editor SideDrawer
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [roleDisplayName, setRoleDisplayName] = useState("");
  const [roleKey, setRoleKey] = useState("");
  const [roleDescription, setRoleDescription] = useState("");
  const [roleColor, setRoleColor] = useState("#6366F1");
  const [roleDeptId, setRoleDeptId] = useState("");
  const [roleIsDefault, setRoleIsDefault] = useState(false);
  const [selectedModules, setSelectedModules] = useState(new Set());
  const [selectedPerms, setSelectedPerms] = useState(new Set());
  const [expandedModules, setExpandedModules] = useState({});
  const [savingRole, setSavingRole] = useState(false);

  // Department Setup Drawer (Superadmin quick department creation)
  const [deptDrawerOpen, setDeptDrawerOpen] = useState(false);
  const [deptName, setDeptName] = useState("");
  const [deptCode, setDeptCode] = useState("");
  const [deptDesc, setDeptDesc] = useState("");
  const [deptColor, setDeptColor] = useState("#3B82F6");
  const [savingDept, setSavingDept] = useState(false);

  const canManageRoles = isSuperAdmin;
  const canViewRoles = isSuperAdmin || hasPermission("rbac.view") || hasPermission("rbac.manage");

  const loadData = async () => {
    setLoading(true);
    const [catRes, rolesRes] = await Promise.all([getModulesCatalog(), getRoles()]);
    if (catRes.success) setModulesCatalog(catRes.modules || []);
    if (rolesRes.success) setRoles(rolesRes.roles || []);
    setLoading(false);
  };

  useEffect(() => {
    if (canViewRoles) {
      loadData();
    } else {
      setLoading(false);
    }
  }, [canViewRoles]);

  const openCreateRole = () => {
    setEditingRole(null);
    setRoleDisplayName("");
    setRoleKey("");
    setRoleDescription("");
    setRoleColor("#6366F1");
    setRoleDeptId("");
    setRoleIsDefault(false);
    setSelectedModules(new Set(["dashboard", "board", "tasks", "chat"]));
    setSelectedPerms(new Set(["dashboard.view", "board.view", "tasks.view", "chat.view", "chat.send"]));
    setExpandedModules({ tasks: true });
    setEditorOpen(true);
  };

  const openEditRole = (role) => {
    if (role.isSystem || role.name === "superadmin") {
      toast("Superadmin is a hardcoded system role with full access by default.", { icon: "🔒" });
      return;
    }
    setEditingRole(role);
    setRoleDisplayName(role.displayName || role.name);
    setRoleKey(role.name);
    setRoleDescription(role.description || "");
    setRoleColor(role.color || "#6366F1");
    setRoleDeptId(role.department?._id || role.department || "");
    setRoleIsDefault(Boolean(role.isDefault));

    // Expand wildcard perms into discrete action slugs for clean checkbox toggling
    const resolvedPerms = new Set();
    const rawPerms = Array.isArray(role.permissions) ? role.permissions : [];
    const rawMods = Array.isArray(role.modules) ? role.modules : [];
    modulesCatalog.forEach((mod) => {
      const hasGroupWildcard = rawPerms.includes(`${mod.key}.*`) || rawPerms.includes("*");
      mod.actions.forEach((act) => {
        if (hasGroupWildcard || rawPerms.includes(act.slug)) {
          resolvedPerms.add(act.slug);
        }
      });
    });

    setSelectedModules(new Set(rawMods));
    setSelectedPerms(resolvedPerms);
    setExpandedModules({});
    setEditorOpen(true);
  };

  const toggleModuleAll = (mod) => {
    const modActionSlugs = mod.actions.map((a) => a.slug);
    const allChecked = modActionSlugs.every((s) => selectedPerms.has(s));

    const nextPerms = new Set(selectedPerms);
    const nextMods = new Set(selectedModules);

    if (allChecked) {
      modActionSlugs.forEach((s) => nextPerms.delete(s));
      nextMods.delete(mod.key);
    } else {
      modActionSlugs.forEach((s) => nextPerms.add(s));
      nextMods.add(mod.key);
    }

    setSelectedPerms(nextPerms);
    setSelectedModules(nextMods);
  };

  const toggleActionPerm = (modKey, slug) => {
    const nextPerms = new Set(selectedPerms);
    if (nextPerms.has(slug)) {
      nextPerms.delete(slug);
    } else {
      nextPerms.add(slug);
    }

    const mod = modulesCatalog.find((m) => m.key === modKey);
    const nextMods = new Set(selectedModules);
    const anyInMod = mod?.actions.some((a) => nextPerms.has(a.slug));
    if (anyInMod) nextMods.add(modKey);
    else nextMods.delete(modKey);

    setSelectedPerms(nextPerms);
    setSelectedModules(nextMods);
  };

  const handleSaveRole = async (e) => {
    e.preventDefault();
    if (!roleDisplayName.trim()) return;

    setSavingRole(true);
    const payload = {
      name: editingRole ? editingRole.name : (roleKey || roleDisplayName).trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_"),
      displayName: roleDisplayName.trim(),
      description: roleDescription.trim(),
      color: roleColor,
      department: roleDeptId || null,
      isDefault: roleIsDefault,
      modules: Array.from(selectedModules),
      permissions: Array.from(selectedPerms),
    };

    const res = editingRole
      ? await updateRole(editingRole._id, payload)
      : await createRole(payload);
    setSavingRole(false);

    if (res.success) {
      setEditorOpen(false);
      await loadData();
      syncContextRoles?.();
    }
  };

  const handleDeleteRole = async (role) => {
    if (role.isSystem || role.name === "superadmin") {
      return toast.error("Superadmin cannot be deleted");
    }
    if (!window.confirm(`Delete role '${role.displayName}'?`)) return;
    const res = await deleteRole(role._id);
    if (res.success) {
      await loadData();
      syncContextRoles?.();
    }
  };

  const handleCreateDept = async (e) => {
    e.preventDefault();
    if (!deptName.trim() || !deptCode.trim()) return;
    setSavingDept(true);
    const res = await createDepartment({
      name: deptName.trim(),
      code: deptCode.trim().toUpperCase(),
      description: deptDesc.trim(),
      color: deptColor,
    });
    setSavingDept(false);
    if (res.success) {
      setDeptDrawerOpen(false);
      setDeptName("");
      setDeptCode("");
      setDeptDesc("");
      refreshDepartments?.();
    }
  };

  if (!canViewRoles) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-center">
        <div className="max-w-md space-y-2">
          <Lock className="w-10 h-10 mx-auto text-rose-400" />
          <h2 className="text-lg font-bold">Restricted Access</h2>
          <p className="text-xs text-slate-400">
            Dynamic Roles & Module Governance is restricted to Superadmin and authorized Governance viewers.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex-1 w-full h-full min-h-0 overflow-y-auto p-5 sm:p-7 space-y-6 ${
        isDark ? "text-slate-100" : "text-slate-900"
      }`}
    >
      {/* Page Header */}
      <div
        className={`flex flex-wrap items-center justify-between gap-4 pb-4 border-b ${
          isDark ? "border-white/[0.08]" : "border-slate-900/[0.08]"
        }`}
      >
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/15 text-purple-300 border border-purple-500/25">
              <ShieldCheck className="w-3 h-3" />
              {isSuperAdmin ? "Superadmin Control Plane" : "RBAC Viewer"}
            </span>
          </div>
          <h1 className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${isDark ? "text-white" : "text-slate-950"}`}>
            Roles, Modules & Department Setup
          </h1>
          <p className={`text-xs sm:text-sm mt-1 ${isDark ? "text-zinc-400" : "text-slate-500"}`}>
            Superadmin is the only hardcoded root role. Configure dynamic roles, departments, and modular permissions below.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={loadData}
            className={`p-2 rounded-full border transition-colors cursor-pointer ${
              isDark
                ? "bg-white/[0.05] hover:bg-white/[0.10] border-white/[0.09] text-zinc-300"
                : "bg-white hover:bg-slate-100 border-slate-200 text-slate-700"
            }`}
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>

          {canManageRoles && activeTab === "roles" && (
            <button
              type="button"
              onClick={openCreateRole}
              className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-full lira-btn-primary cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Dynamic Role</span>
            </button>
          )}

          {(isSuperAdmin || hasPermission("departments.create")) && activeTab === "departments" && (
            <button
              type="button"
              onClick={() => setDeptDrawerOpen(true)}
              className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-full lira-btn-primary cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Department</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className={`flex items-center gap-2 border-b pb-2 ${isDark ? "border-white/[0.08]" : "border-slate-900/[0.08]"}`}>
        <button
          type="button"
          onClick={() => setActiveTab("roles")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === "roles"
              ? "lira-btn-primary"
              : isDark
              ? "text-zinc-400 hover:text-white hover:bg-white/[0.06]"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <Shield className="w-3.5 h-3.5" />
          <span>Dynamic Roles & Modules ({roles.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("departments")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === "departments"
              ? "lira-btn-primary"
              : isDark
              ? "text-zinc-400 hover:text-white hover:bg-white/[0.06]"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <Building className="w-3.5 h-3.5" />
          <span>Departments Setup ({departments.length})</span>
        </button>
      </div>

      {/* TAB 1: ROLES & MODULES */}
      {activeTab === "roles" && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {roles.map((r) => {
            const isSystemSuper = r.isSystem || r.name === "superadmin";
            return (
              <div
                key={r._id || r.name}
                className={`p-5 rounded-2xl border flex flex-col justify-between gap-4 transition-all ${
                  isSystemSuper
                    ? isDark
                      ? "bg-purple-500/[0.06] border-purple-500/30"
                      : "bg-purple-50 border-purple-200"
                    : isDark
                    ? "bg-[#14151f] border-white/10"
                    : "bg-white border-slate-200"
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: r.color || "#6366F1" }}
                      />
                      <div>
                        <h3 className={`text-sm font-bold flex items-center gap-1.5 ${isDark ? "text-white" : "text-slate-900"}`}>
                          <span>{r.displayName || r.name}</span>
                          {isSystemSuper && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[9px] font-bold">
                              <Lock className="w-2.5 h-2.5" /> SYSTEM ROOT
                            </span>
                          )}
                          {r.isDefault && (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[9px] font-bold">
                              DEFAULT JOINER
                            </span>
                          )}
                        </h3>
                        <span className="text-[10px] font-mono opacity-60">{r.name}</span>
                      </div>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                        isDark ? "bg-white/5 border-white/10 text-slate-300" : "bg-slate-100 border-slate-200 text-slate-700"
                      }`}
                    >
                      {r.userCount ?? 0} users
                    </span>
                  </div>

                  <p className={`text-xs leading-relaxed ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                    {r.description || "Dynamic custom role"}
                  </p>

                  {/* Assigned Modules Pills */}
                  <div className="flex flex-wrap gap-1.5">
                    {isSystemSuper ? (
                      <span className="px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-200 text-[10px] font-semibold border border-purple-500/30">
                        * All Modules & Unconditional Access
                      </span>
                    ) : (
                      (r.modules || []).map((modKey) => (
                        <span
                          key={modKey}
                          className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${
                            isDark
                              ? "bg-white/[0.04] border-white/10 text-slate-200"
                              : "bg-slate-100 border-slate-200 text-slate-700"
                          }`}
                        >
                          {modKey}
                        </span>
                      ))
                    )}
                    {!isSystemSuper && (!r.modules || r.modules.length === 0) && (
                      <span className="text-[10px] italic opacity-50">No modules assigned</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-white/10">
                  <span className="text-[10px] font-mono opacity-60">
                    {isSystemSuper ? "Immutable" : `${(r.permissions || []).length} permission rule(s)`}
                  </span>

                  {!isSystemSuper && canManageRoles && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => openEditRole(r)}
                        className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold flex items-center gap-1 cursor-pointer ${
                          isDark ? "bg-white/10 hover:bg-white/15 text-white" : "bg-slate-100 hover:bg-slate-200 text-slate-800"
                        }`}
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>Configure Modules</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteRole(r)}
                        className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/15 cursor-pointer"
                        title="Delete Role"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 2: DEPARTMENTS SETUP */}
      {activeTab === "departments" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {departments.map((d) => (
            <div
              key={d._id}
              className={`p-5 rounded-2xl border space-y-2.5 ${
                isDark ? "bg-[#14151f] border-white/10" : "bg-white border-slate-200"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color || "#3B82F6" }} />
                  <h3 className="text-sm font-bold">{d.name}</h3>
                </div>
                <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 font-mono text-[10px] font-bold">
                  {d.code}
                </span>
              </div>
              <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                {d.description || "Department unit"}
              </p>
              <div className="text-[11px] opacity-70 pt-1">
                Lead: {d.lead?.fullname || "Unassigned"}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Role & Module Mapping SideDrawer */}
      <SideDrawer
        isOpen={editorOpen}
        onClose={() => setEditorOpen(false)}
        title={editingRole ? `Configure Role: ${editingRole.displayName}` : "Create Dynamic Role"}
        subtitle="Map Modules & Granular Actions to this Role"
        width="max-w-2xl"
      >
        <form onSubmit={handleSaveRole} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold block mb-1">Display Name</label>
              <input
                type="text"
                required
                value={roleDisplayName}
                onChange={(e) => setRoleDisplayName(e.target.value)}
                placeholder="e.g. QA Reviewer"
                className={`w-full border rounded-xl px-3.5 py-2 text-xs focus:outline-none ${
                  isDark ? "bg-[#12131b] border-white/15 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                }`}
              />
            </div>

            <div>
              <label className="text-xs font-semibold block mb-1">Role Slug Key</label>
              <input
                type="text"
                disabled={Boolean(editingRole)}
                value={
                  editingRole
                    ? roleKey
                    : (roleKey || roleDisplayName).toLowerCase().replace(/[^a-z0-9_]+/g, "_")
                }
                onChange={(e) => setRoleKey(e.target.value)}
                placeholder="auto-generated e.g. qa_reviewer"
                className={`w-full border rounded-xl px-3.5 py-2 text-xs font-mono focus:outline-none disabled:opacity-60 ${
                  isDark ? "bg-[#12131b] border-white/15 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                }`}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold block mb-1">Default Department (Optional)</label>
              <select
                value={roleDeptId}
                onChange={(e) => setRoleDeptId(e.target.value)}
                className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none ${
                  isDark ? "bg-[#12131b] border-white/15 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                }`}
              >
                <option value="">Any Department</option>
                {departments.map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold block mb-1">Badge Accent Color</label>
              <div className="flex items-center gap-1.5 pt-1">
                {ROLE_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setRoleColor(c)}
                    className={`w-6 h-6 rounded-full cursor-pointer transition-transform ${
                      roleColor === c ? "ring-2 ring-white scale-110" : "opacity-60 hover:opacity-100"
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold block mb-1">Description</label>
            <input
              type="text"
              value={roleDescription}
              onChange={(e) => setRoleDescription(e.target.value)}
              placeholder="Summary of responsibilities..."
              className={`w-full border rounded-xl px-3.5 py-2 text-xs focus:outline-none ${
                isDark ? "bg-[#12131b] border-white/15 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
              }`}
            />
          </div>

          <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
            <input
              type="checkbox"
              checked={roleIsDefault}
              onChange={(e) => setRoleIsDefault(e.target.checked)}
              className="rounded"
            />
            <span>Assign automatically to new joiners by default</span>
          </label>

          {/* Modular Permissions Matrix */}
          <div className="space-y-2 pt-2 border-t border-white/10">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider opacity-75">
                Modules & Actions Matrix ({selectedPerms.size} active actions)
              </h4>
            </div>

            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
              {modulesCatalog.map((mod) => {
                const modActionSlugs = mod.actions.map((a) => a.slug);
                const checkedCount = modActionSlugs.filter((s) => selectedPerms.has(s)).length;
                const allChecked = checkedCount === modActionSlugs.length && modActionSlugs.length > 0;
                const partial = checkedCount > 0 && !allChecked;
                const isExpanded = Boolean(expandedModules[mod.key]);

                return (
                  <div
                    key={mod.key}
                    className={`rounded-xl border transition-all ${
                      allChecked
                        ? isDark
                          ? "bg-indigo-500/[0.08] border-indigo-500/35"
                          : "bg-indigo-50 border-indigo-300"
                        : isDark
                        ? "bg-white/[0.02] border-white/10"
                        : "bg-slate-50 border-slate-200"
                    }`}
                  >
                    <div
                      onClick={() =>
                        setExpandedModules((prev) => ({ ...prev, [mod.key]: !prev[mod.key] }))
                      }
                      className="flex items-center justify-between p-3 cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleModuleAll(mod);
                          }}
                          className={`w-5 h-5 rounded flex items-center justify-center border cursor-pointer shrink-0 ${
                            allChecked || partial
                              ? "bg-indigo-600 border-indigo-500 text-white"
                              : "border-white/25"
                          }`}
                        >
                          {allChecked && <Check className="w-3 h-3" />}
                          {partial && <Minus className="w-3 h-3" />}
                        </button>
                        {isExpanded ? <ChevronDown className="w-4 h-4 opacity-60" /> : <ChevronRight className="w-4 h-4 opacity-60" />}
                        <div className="min-w-0">
                          <span className="text-xs font-bold block">{mod.name}</span>
                          <span className="text-[10px] opacity-60 truncate block">{mod.description}</span>
                        </div>
                      </div>

                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-white/5 border border-white/10 shrink-0">
                        {checkedCount}/{modActionSlugs.length}
                      </span>
                    </div>

                    {isExpanded && (
                      <div className="px-3 pb-3 pt-1 border-t border-white/10 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {mod.actions.map((act) => {
                          const checked = selectedPerms.has(act.slug);
                          return (
                            <label
                              key={act.slug}
                              className={`p-2 rounded-lg border flex items-start gap-2 cursor-pointer transition-colors ${
                                checked
                                  ? "bg-indigo-500/15 border-indigo-500/40"
                                  : "bg-black/15 border-white/5 hover:border-white/15"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleActionPerm(mod.key, act.slug)}
                                className="mt-0.5"
                              />
                              <div className="min-w-0">
                                <span className="text-[11px] font-semibold block">{act.label}</span>
                                <span className="text-[9px] font-mono opacity-60 block">{act.slug}</span>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
            <button
              type="button"
              onClick={() => setEditorOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingRole}
              className="px-4 py-2 rounded-xl text-xs font-bold lira-btn-primary cursor-pointer"
            >
              {savingRole ? "Saving..." : editingRole ? "Save Role & Modules" : "Create Role"}
            </button>
          </div>
        </form>
      </SideDrawer>

      {/* New Department SideDrawer */}
      <SideDrawer
        isOpen={deptDrawerOpen}
        onClose={() => setDeptDrawerOpen(false)}
        title="Setup New Department"
        subtitle="Add an organizational department unit"
        width="max-w-md"
      >
        <form onSubmit={handleCreateDept} className="space-y-4">
          <div>
            <label className="text-xs font-semibold block mb-1">Department Name</label>
            <input
              type="text"
              required
              value={deptName}
              onChange={(e) => setDeptName(e.target.value)}
              placeholder="e.g. Security Operations"
              className={`w-full border rounded-xl px-3.5 py-2 text-xs focus:outline-none ${
                isDark ? "bg-[#12131b] border-white/15 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
              }`}
            />
          </div>
          <div>
            <label className="text-xs font-semibold block mb-1">Department Code</label>
            <input
              type="text"
              required
              value={deptCode}
              onChange={(e) => setDeptCode(e.target.value.toUpperCase())}
              placeholder="e.g. SEC"
              className={`w-full border rounded-xl px-3.5 py-2 text-xs font-mono uppercase focus:outline-none ${
                isDark ? "bg-[#12131b] border-white/15 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
              }`}
            />
          </div>
          <div>
            <label className="text-xs font-semibold block mb-1">Description</label>
            <textarea
              rows={3}
              value={deptDesc}
              onChange={(e) => setDeptDesc(e.target.value)}
              placeholder="Department focus..."
              className={`w-full border rounded-xl px-3.5 py-2 text-xs focus:outline-none ${
                isDark ? "bg-[#12131b] border-white/15 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
              }`}
            />
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
            <button
              type="button"
              onClick={() => setDeptDrawerOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingDept}
              className="px-4 py-2 rounded-xl text-xs font-bold lira-btn-primary cursor-pointer"
            >
              {savingDept ? "Creating..." : "Create Department"}
            </button>
          </div>
        </form>
      </SideDrawer>
    </div>
  );
}

