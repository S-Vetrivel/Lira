const Role = require("../models/roleModel");
const User = require("../models/userModel");
const Department = require("../models/departmentModel");
const { MODULES_CATALOG } = require("../config/modulesCatalog");
const {
  ensureSystemRolesExist,
  resolveUserAccess,
  getCachedRoles,
  invalidateRolesCache,
} = require("../utils/roles");
const { enqueueWebSocketEvent } = require("../services/queue");

const ts = () => new Date().toISOString();

// 1. Get complete modular catalog of modules and actions
exports.getModulesCatalog = async (req, res) => {
  res.status(200).json({
    success: true,
    modules: MODULES_CATALOG,
  });
};

// 2. List all roles from Redis cache (+ live user counts & department metadata)
exports.listRoles = async (req, res) => {
  try {
    let { roles, source } = await getCachedRoles();
    if (!roles || roles.length === 0) {
      await ensureSystemRolesExist();
      const refreshed = await getCachedRoles();
      roles = refreshed.roles;
      source = refreshed.source;
    }

    const userCounts = await User.aggregate([
      { $match: { isActive: true, status: { $ne: "rejected" } } },
      { $group: { _id: { $toLower: "$role" }, count: { $sum: 1 } } },
    ]);
    const countMap = {};
    userCounts.forEach((c) => {
      if (c._id) countMap[c._id] = c.count;
    });

    const enriched = roles.map((r) => ({
      ...r,
      userCount: countMap[r.name] || 0,
    }));

    res.status(200).json({ success: true, source, roles: enriched });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 3. Superadmin: Create custom dynamic role mapped to modules & actions
exports.createRole = async (req, res) => {
  try {
    const {
      name,
      displayName,
      description,
      color,
      modules = [],
      permissions = [],
      department,
      isDefault = false,
    } = req.body;

    const rawName = (name || displayName || "").trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_");
    if (!rawName) {
      return res.status(400).json({ success: false, message: "Role name is required" });
    }

    if (rawName === "superadmin" || rawName === "super_admin") {
      return res.status(403).json({
        success: false,
        message: "superadmin is a hardcoded system role and cannot be created dynamically",
      });
    }

    const exists = await Role.findOne({ name: rawName });
    if (exists) {
      return res.status(409).json({ success: false, message: `Role '${rawName}' already exists` });
    }

    if (isDefault) {
      await Role.updateMany({}, { $set: { isDefault: false } });
    }

    const created = await Role.create({
      name: rawName,
      displayName: displayName?.trim() || rawName.replace(/_/g, " "),
      description: description || "",
      color: color || "#6366F1",
      isSystem: false,
      isDefault: Boolean(isDefault),
      modules: Array.isArray(modules) ? modules : [],
      permissions: Array.isArray(permissions) ? permissions : [],
      department: department || null,
      createdBy: req.user._id,
    });

    const populated = await Role.findById(created._id).populate("department", "name code color").lean();
    await invalidateRolesCache();

    console.log(`[${ts()}] [RBAC] Superadmin ${req.user.email} created role=${rawName} modules=${modules.length} perms=${permissions.length} (Redis cache refreshed)`);

    enqueueWebSocketEvent({
      target: "all",
      event: "rbac:updated",
      data: { action: "role_created", role: populated },
    });

    res.status(201).json({ success: true, role: { ...populated, userCount: 0 } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 4. Superadmin: Update dynamic role modules, permissions, or department
exports.updateRole = async (req, res) => {
  try {
    const { id } = req.params;
    const roleDoc = await Role.findById(id);
    if (!roleDoc) {
      return res.status(404).json({ success: false, message: "Role not found" });
    }

    if (roleDoc.name === "superadmin" || roleDoc.isSystem) {
      return res.status(403).json({
        success: false,
        message: "Hardcoded superadmin role cannot be modified",
      });
    }

    const { displayName, description, color, modules, permissions, department, isDefault } = req.body;

    if (typeof isDefault === "boolean" && isDefault) {
      await Role.updateMany({ _id: { $ne: id } }, { $set: { isDefault: false } });
    }

    if (displayName !== undefined) roleDoc.displayName = displayName.trim();
    if (description !== undefined) roleDoc.description = description;
    if (color !== undefined) roleDoc.color = color;
    if (Array.isArray(modules)) roleDoc.modules = modules;
    if (Array.isArray(permissions)) roleDoc.permissions = permissions;
    if (department !== undefined) roleDoc.department = department || null;
    if (typeof isDefault === "boolean") roleDoc.isDefault = isDefault;

    await roleDoc.save();
    const populated = await Role.findById(roleDoc._id).populate("department", "name code color").lean();
    await invalidateRolesCache();

    console.log(`[${ts()}] [RBAC] Superadmin ${req.user.email} updated role=${roleDoc.name} modules=${roleDoc.modules.length} perms=${roleDoc.permissions.length} (Redis cache refreshed)`);

    enqueueWebSocketEvent({
      target: "all",
      event: "rbac:updated",
      data: { action: "role_updated", role: populated },
    });

    res.status(200).json({ success: true, role: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 5. Superadmin: Delete custom dynamic role
exports.deleteRole = async (req, res) => {
  try {
    const { id } = req.params;
    const roleDoc = await Role.findById(id);
    if (!roleDoc) {
      return res.status(404).json({ success: false, message: "Role not found" });
    }

    if (roleDoc.name === "superadmin" || roleDoc.isSystem) {
      return res.status(403).json({
        success: false,
        message: "Hardcoded superadmin system role cannot be deleted",
      });
    }

    const inUse = await User.countDocuments({ role: roleDoc.name, isActive: true });
    if (inUse > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete role '${roleDoc.displayName}' because ${inUse} active user(s) still hold it.`,
      });
    }

    await Role.findByIdAndDelete(id);
    await invalidateRolesCache();

    console.log(`[${ts()}] [RBAC] Superadmin ${req.user.email} deleted role=${roleDoc.name} (Redis cache refreshed)`);

    enqueueWebSocketEvent({
      target: "all",
      event: "rbac:updated",
      data: { action: "role_deleted", roleName: roleDoc.name },
    });

    res.status(200).json({ success: true, message: `Role '${roleDoc.displayName}' deleted` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 6. Assign dynamic role, department, and custom permission overrides to a user
exports.assignUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { roleName, departmentId, customPermissions } = req.body;

    const target = await User.findById(userId);
    if (!target) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (roleName) {
      const normalized = roleName.trim().toLowerCase();
      if (normalized === "superadmin" && !req.user?.isSuperAdmin) {
        return res.status(403).json({
          success: false,
          message: "Only a Superadmin can assign the superadmin role.",
        });
      }
      const roleDoc = await Role.findOne({ name: normalized });
      if (!roleDoc) {
        return res.status(404).json({ success: false, message: `Role '${normalized}' not found` });
      }
      target.role = roleDoc.name;
      target.roleRef = roleDoc._id;
    }

    if (departmentId !== undefined) {
      if (departmentId) {
        const dept = await Department.findById(departmentId);
        if (dept) {
          target.department = dept._id;
          target.departmentName = dept.name;
        }
      } else {
        target.department = null;
        target.departmentName = "General";
      }
    }

    if (Array.isArray(customPermissions)) {
      target.customPermissions = customPermissions;
    }

    await target.save();
    const resolvedAccess = await resolveUserAccess(target);

    console.log(`[${ts()}] [RBAC] ${req.user.email} assigned role=${target.role} dept=${target.departmentName} to user=${target.email}`);

    enqueueWebSocketEvent({
      target: "user",
      room: target._id.toString(),
      event: "rbac:user-updated",
      data: { userId: target._id, ...resolvedAccess },
    });

    res.status(200).json({
      success: true,
      message: `Updated access for ${target.fullname}`,
      access: resolvedAccess,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

