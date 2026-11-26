const {
  MODULES_CATALOG,
  ALL_MODULE_KEYS,
  ALL_ACTION_SLUGS,
} = require("../config/modulesCatalog");

/**
 * Superadmin & Dynamic Module RBAC Helper
 *
 * `superadmin` is the ONLY hardcoded system role in Lira.
 * Users matching SUPERADMIN_EMAILS / DEFAULT_SUPERADMIN_EMAIL or role === "superadmin"
 * automatically possess all modules and permissions (`*`) across the entire system.
 */

function getSuperAdminEmails() {
  const emailSet = new Set();

  const addParsed = (val) => {
    if (!val) return;
    let str = String(val).trim();
    if (!str) return;
    if (
      (str.startsWith('"') && str.endsWith('"')) ||
      (str.startsWith("'") && str.endsWith("'"))
    ) {
      str = str.slice(1, -1).trim();
    }
    str.split(/[,;\s\n\r]+/).forEach((item) => {
      const clean = item.replace(/[\[\]'"\\]/g, "").trim().toLowerCase();
      if (clean && clean.includes("@")) {
        emailSet.add(clean);
      }
    });
  };

  addParsed(process.env.SUPERADMIN_EMAILS);
  addParsed(process.env.DEFAULT_SUPERADMIN_EMAIL);

  return Array.from(emailSet);
}

const isSuperAdminEmail = (email) => {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  const list = getSuperAdminEmails();

  if (list.includes(normalized)) return true;

  return list.some((pattern) => {
    if (pattern.includes("*")) {
      const regex = new RegExp(
        "^" +
          pattern
            .split("*")
            .map((s) => s.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&"))
            .join(".*") +
          "$",
        "i"
      );
      return regex.test(normalized);
    }
    return false;
  });
};

const isSuperAdminUser = (user) => {
  if (!user) return false;
  if (user.email && isSuperAdminEmail(user.email)) return true;
  const roleStr = String(user.role || "").trim().toLowerCase();
  if (roleStr === "superadmin" || roleStr === "super_admin") return true;
  if (Array.isArray(user.customPermissions) && user.customPermissions.includes("*")) return true;
  if (Array.isArray(user.permissions) && user.permissions.includes("*")) return true;
  return false;
};

const getSuperAdminPermissions = () => {
  const set = new Set(["*", "root", ...ALL_ACTION_SLUGS]);
  ALL_MODULE_KEYS.forEach((mod) => set.add(`${mod}.*`));
  return Array.from(set);
};

const getSuperAdminModules = () => ["*", ...ALL_MODULE_KEYS];

/**
 * Universal wildcard permission evaluator:
 * - Supports explicit revocation (`!tasks.delete`, `!tasks.*`)
 * - Supports `*` / `root` god-mode
 * - Supports exact slug (`tasks.create`) and module wildcard (`tasks.*`)
 */
const hasWildcardPermission = (userPermissions = [], requiredPermission) => {
  if (!requiredPermission) return true;
  if (!Array.isArray(userPermissions)) return false;

  if (userPermissions.includes(`!${requiredPermission}`)) return false;

  const [group] = String(requiredPermission).split(".");
  if (group && userPermissions.includes(`!${group}.*`)) return false;

  if (userPermissions.includes("*") || userPermissions.includes("root")) return true;
  if (userPermissions.includes(requiredPermission)) return true;
  if (group && userPermissions.includes(`${group}.*`)) return true;

  return false;
};

/**
 * Resolve effective role, modules, and permissions for any User document from MongoDB `Role`.
 */
async function resolveUserAccess(user) {
  if (!user) {
    return {
      role: "employee",
      roleDisplayName: "Employee",
      isSuperAdmin: false,
      modules: [],
      permissions: [],
    };
  }

  if (isSuperAdminUser(user)) {
    return {
      role: "superadmin",
      roleDisplayName: "Superadmin",
      isSuperAdmin: true,
      modules: getSuperAdminModules(),
      permissions: getSuperAdminPermissions(),
    };
  }

  const Role = require("../models/roleModel");
  const roleName = String(user.role || "employee").trim().toLowerCase();
  let roleDoc = await Role.findOne({ name: roleName }).lean();
  if (!roleDoc && user.roleRef) {
    roleDoc = await Role.findById(user.roleRef).lean();
  }

  const baseModules = Array.isArray(roleDoc?.modules) ? roleDoc.modules : [];
  const basePerms = Array.isArray(roleDoc?.permissions) ? roleDoc.permissions : [];
  const customPerms = Array.isArray(user.customPermissions) ? user.customPermissions : [];

  // Merge base permissions + custom grants, minus explicit revocations
  const merged = new Set([...basePerms, ...customPerms.filter((p) => !p.startsWith("!"))]);
  customPerms
    .filter((p) => p.startsWith("!"))
    .forEach((revoked) => {
      merged.add(revoked);
      merged.delete(revoked.slice(1));
    });

  // Derive modules from permissions if any permission slug belongs to a module
  const moduleSet = new Set(baseModules);
  for (const mod of MODULES_CATALOG) {
    if (
      merged.has("*") ||
      merged.has(`${mod.key}.*`) ||
      mod.actions.some((a) => merged.has(a.slug))
    ) {
      moduleSet.add(mod.key);
    }
  }

  return {
    role: roleDoc?.name || roleName,
    roleDisplayName: roleDoc?.displayName || roleName.replace(/_/g, " "),
    isSuperAdmin: false,
    modules: Array.from(moduleSet),
    permissions: Array.from(merged),
  };
}

/**
 * Self-healing Role Seeder: Ensures hardcoded `superadmin` system role and default
 * editable dynamic roles (`admin`, `manager`, `employee`) exist in MongoDB.
 */
async function ensureSystemRolesExist() {
  const Role = require("../models/roleModel");

  // 1. Hardcoded Superadmin role — always synced to full modules/actions
  await Role.findOneAndUpdate(
    { name: "superadmin" },
    {
      $set: {
        name: "superadmin",
        displayName: "Superadmin",
        description: "Hardcoded root system role with unrestricted access to all modules and actions.",
        color: "#A855F7",
        isSystem: true,
        isDefault: false,
        modules: getSuperAdminModules(),
        permissions: getSuperAdminPermissions(),
      },
    },
    { upsert: true, new: true }
  );

  // 2. Seed initial dynamic roles ONLY if no non-system roles exist yet
  const customCount = await Role.countDocuments({ name: { $ne: "superadmin" } });
  if (customCount === 0) {
    const defaultDynamicRoles = [
      {
        name: "admin",
        displayName: "Administrator",
        description: "Workspace governance across departments, team, projects, and approvals.",
        color: "#3B82F6",
        isSystem: false,
        isDefault: false,
        modules: [
          "dashboard",
          "board",
          "tasks",
          "requests",
          "projects",
          "departments",
          "team",
          "chat",
          "ai",
          "rbac",
        ],
        permissions: [
          "dashboard.*",
          "board.*",
          "tasks.*",
          "requests.*",
          "projects.*",
          "departments.*",
          "team.*",
          "chat.*",
          "ai.*",
          "rbac.view",
        ],
      },
      {
        name: "manager",
        displayName: "Manager",
        description: "Department & project lead with task/request approval and team onboarding rights.",
        color: "#F59E0B",
        isSystem: false,
        isDefault: false,
        modules: ["dashboard", "board", "tasks", "requests", "projects", "departments", "team", "chat", "ai"],
        permissions: [
          "dashboard.view",
          "board.*",
          "tasks.*",
          "requests.*",
          "projects.view",
          "projects.edit",
          "departments.view",
          "team.view",
          "team.join_requests",
          "chat.*",
          "ai.*",
        ],
      },
      {
        name: "employee",
        displayName: "Employee",
        description: "Standard contributor with Kanban, My Day, requests submission, and chat access.",
        color: "#10B981",
        isSystem: false,
        isDefault: true,
        modules: ["dashboard", "board", "tasks", "requests", "projects", "departments", "team", "chat", "ai"],
        permissions: [
          "dashboard.view",
          "board.view",
          "tasks.view",
          "tasks.create",
          "tasks.edit",
          "tasks.review",
          "requests.view",
          "requests.create",
          "projects.view",
          "departments.view",
          "team.view",
          "chat.*",
          "ai.*",
        ],
      },
    ];

    await Role.insertMany(defaultDynamicRoles);
    console.log("🛡️ Seeded dynamic RBAC roles: admin, manager, employee (+ hardcoded superadmin)");
  }
}

module.exports = {
  getSuperAdminEmails,
  isSuperAdminEmail,
  isSuperAdminUser,
  getSuperAdminPermissions,
  getSuperAdminModules,
  hasWildcardPermission,
  resolveUserAccess,
  ensureSystemRolesExist,
};
