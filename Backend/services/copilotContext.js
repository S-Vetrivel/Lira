const Project = require("../models/projectModel");
const Department = require("../models/departmentModel");
const User = require("../models/userModel");
const Task = require("../models/taskModel");
const Request = require("../models/requestModel");
const Role = require("../models/roleModel");
const AIGlobalGrant = require("../models/aiGlobalGrantModel");
const { MODULES_CATALOG } = require("../config/modulesCatalog");
const {
  getScopedRoutesCatalog,
  getScopedActionSchemas,
} = require("../config/copilotActionRegistry");
const { isSuperAdminUser } = require("../utils/roles");
const { hasPerm, escapeRegex } = require("./copilotSecurity");

const ROUTE_MODULE_MAP = [
  { route: "/", moduleKey: "dashboard", perm: "dashboard.view", label: "Dashboard & Overview" },
  { route: "/board", moduleKey: "board", perm: "board.view", label: "Sprint Board" },
  { route: "/table", moduleKey: "board", perm: "board.view", label: "Table Grid View" },
  { route: "/calendar", moduleKey: "board", perm: "board.view", label: "Schedule Calendar" },
  { route: "/my-work", moduleKey: "tasks", perm: "tasks.view", label: "My Day & Assigned Tasks" },
  { route: "/requests", moduleKey: "requests", perm: "requests.view", label: "Requests & Approvals" },
  { route: "/projects", moduleKey: "projects", perm: "projects.view", label: "Workspaces & Projects" },
  { route: "/team", moduleKey: "team", perm: "team.view", label: "Team Directory" },
  { route: "/profile?tab=ai", moduleKey: "ai", perm: "ai.use", label: "Personal AI Keys & Profile" },
  { route: "/roles", moduleKey: "rbac", perm: "rbac.view", label: "Roles & Departments" },
  { route: "/roles?tab=ai", moduleKey: "ai", perm: "ai.manage", label: "AI Models & Vault" },
  { route: "/audit", moduleKey: "audit", perm: "audit.view", label: "Audit Logs & Live Sessions" },
];

function expandModulesToPermissions(moduleKeys = []) {
  const requested = new Set(
    (Array.isArray(moduleKeys) ? moduleKeys : [])
      .map((m) => String(m || "").trim().toLowerCase())
      .filter(Boolean)
  );
  if (requested.has("roles")) requested.add("rbac");
  if (requested.has("calendar") || requested.has("grid") || requested.has("table")) requested.add("board");

  const validModules = [];
  const expandedPerms = new Set();
  for (const mod of MODULES_CATALOG) {
    if (requested.has(mod.key) || requested.has(mod.name.toLowerCase())) {
      validModules.push(mod.key);
      mod.actions.forEach((a) => expandedPerms.add(a.slug));
    }
  }
  return {
    modules: validModules,
    permissions: Array.from(expandedPerms),
  };
}

/**
 * Assemble strictly RBAC-scoped live workspace context for a single user.
 * Independent collection reads are executed concurrently with Promise.all.
 */
async function buildScopedWebsiteContext({ user, currentRoute = "/", activeProjectId = null }) {
  const isSuper = isSuperAdminUser(user);
  const allowedRoutes = ROUTE_MODULE_MAP.filter((r) => isSuper || hasPerm(user, r.perm)).map(
    ({ route, moduleKey, label }) => ({ route, moduleKey, label })
  );

  const allowedActions = ["navigate", "toggle_theme", "open_notifications", "mark_notifications_read", "update_profile"];
  if (hasPerm(user, "tasks.create")) allowedActions.push("create_task");
  if (hasPerm(user, "tasks.edit")) {
    allowedActions.push(
      "update_task",
      "update_task_status",
      "add_subtask",
      "toggle_subtask",
      "add_task_comment",
      "add_worklog",
      "bulk_update_tasks"
    );
  }
  if (hasPerm(user, "tasks.assign")) allowedActions.push("assign_task");
  if (hasPerm(user, "tasks.review")) allowedActions.push("submit_task_review");
  if (hasPerm(user, "tasks.approve")) allowedActions.push("approve_task", "redo_task");
  if (hasPerm(user, "tasks.delete")) allowedActions.push("delete_task");
  if (hasPerm(user, "tasks.view") || hasPerm(user, "board.view")) allowedActions.push("open_task");
  if (hasPerm(user, "chat.view")) allowedActions.push("open_chat");
  if (hasPerm(user, "chat.send")) allowedActions.push("send_project_chat", "send_dm");
  if (hasPerm(user, "chat.pin")) allowedActions.push("toggle_pin_chat_message");
  if (hasPerm(user, "requests.create")) allowedActions.push("create_request");
  if (hasPerm(user, "requests.approve")) allowedActions.push("approve_request", "reject_request");
  if (hasPerm(user, "projects.create")) allowedActions.push("create_project");
  if (hasPerm(user, "projects.edit")) allowedActions.push("update_project");
  if (hasPerm(user, "projects.members")) {
    allowedActions.push(
      "add_project_member",
      "remove_project_member",
      "invoke_project_department",
      "remove_project_department"
    );
  }
  if (hasPerm(user, "projects.urls")) allowedActions.push("add_project_url");
  if (hasPerm(user, "projects.delete")) allowedActions.push("delete_project");
  if (hasPerm(user, "departments.create")) allowedActions.push("create_department");
  if (hasPerm(user, "departments.edit")) {
    allowedActions.push("update_department", "add_department_member", "remove_department_member");
  }
  if (hasPerm(user, "departments.delete")) allowedActions.push("delete_department");
  if (hasPerm(user, "team.create")) allowedActions.push("create_user");
  if (hasPerm(user, "team.edit")) allowedActions.push("update_user", "update_user_role");
  if (hasPerm(user, "team.delete")) allowedActions.push("delete_user");
  if (hasPerm(user, "team.join_requests")) allowedActions.push("approve_join_request", "reject_join_request");
  if (hasPerm(user, "ai.manage")) {
    allowedActions.push("grant_ai_access", "revoke_ai_access", "restore_ai_access", "delete_ai_grant", "update_ai_config");
  }
  if (isSuper) {
    allowedActions.push("remove_non_superadmins", "create_role", "update_role", "delete_role");
  }

  const projectFilter =
    isSuper || hasPerm(user, "projects.view")
      ? { status: { $ne: "archived" } }
      : { members: user._id, status: { $ne: "archived" } };
  const accessibleProjects = await Project.find(projectFilter)
    .select("_id name prefix description department")
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();
  const accessibleProjIds = accessibleProjects.map((p) => p._id);

  const canDepts = isSuper || hasPerm(user, "departments.view") || hasPerm(user, "tasks.create") || hasPerm(user, "requests.create");
  const canTeam = isSuper || hasPerm(user, "team.view") || hasPerm(user, "tasks.assign") || hasPerm(user, "projects.members") || hasPerm(user, "chat.send");
  const canTasks = (isSuper || hasPerm(user, "tasks.view") || hasPerm(user, "board.view")) && accessibleProjIds.length > 0;
  const canReqs = isSuper || hasPerm(user, "requests.approve") || hasPerm(user, "requests.view");
  const canRoles = isSuper || hasPerm(user, "rbac.view");
  const canJoinReqs = isSuper || hasPerm(user, "team.join_requests");
  const canAiManage = isSuper || hasPerm(user, "ai.manage");

  const [departments, teammates, recentTasks, pendingRequests, rolesSummary, pendingJoinRequests, aiGrantsSummary] =
    await Promise.all([
      canDepts ? Department.find({}).select("_id name code description").limit(20).lean() : Promise.resolve([]),
      canTeam
        ? User.find({
            isActive: { $ne: false },
            status: { $nin: ["pending_approval", "rejected"] },
          })
            .select("_id fullname publicId role departmentName jobTitle avatar profilePicture")
            .limit(35)
            .lean()
        : Promise.resolve([]),
      canTasks
        ? Task.find(activeProjectId ? { project: activeProjectId } : { project: { $in: accessibleProjIds } })
            .select("_id key title status priority type project dueDate")
            .sort({ updatedAt: -1 })
            .limit(15)
            .lean()
        : Promise.resolve([]),
      canReqs
        ? Request.find(isSuper || hasPerm(user, "requests.approve") ? {} : { requester: user._id })
            .select("_id title status requestType priority amount")
            .sort({ createdAt: -1 })
            .limit(10)
            .lean()
        : Promise.resolve([]),
      canRoles
        ? Role.find({}).select("_id name displayName description modules isDefault isSystem").limit(20).lean()
        : Promise.resolve([]),
      canJoinReqs
        ? User.find({ status: "pending_approval" }).select("_id fullname email publicId requestedDepartment role").limit(15).lean()
        : Promise.resolve([]),
      canAiManage
        ? AIGlobalGrant.find({}).select("_id targetType targetId targetName provider isActive").limit(20).lean()
        : Promise.resolve([]),
    ]);

  return {
    currentUser: {
      id: String(user._id),
      name: user.fullname,
      publicId: user.publicId || "",
      role: user.role,
      departmentName: user.departmentName || "General",
      isSuperAdmin: isSuper,
    },
    currentRoute,
    activeProjectId: activeProjectId || (accessibleProjects[0]?._id ? String(accessibleProjects[0]._id) : null),
    allowedRoutes,
    allowedActions,
    modulesCatalog: MODULES_CATALOG.map((m) => ({
      key: m.key,
      name: m.name,
      description: m.description,
      route: m.route,
    })),
    projects: accessibleProjects.map((p) => ({
      id: String(p._id),
      prefix: p.prefix,
      name: p.name,
      description: p.description || "",
    })),
    departments: departments.map((d) => ({
      id: String(d._id),
      name: d.name,
      code: d.code,
    })),
    teammates: teammates
      .filter((u) => Boolean(u.fullname && u.fullname.trim()))
      .map((u) => ({
        id: String(u._id),
        name: u.fullname,
        publicId: u.publicId,
        role: u.role,
        jobTitle: u.jobTitle || u.role || "Team Member",
        dept: u.departmentName || "General",
        avatar: u.profilePicture || u.avatar || "",
      })),
    recentTasks: recentTasks.map((t) => ({
      id: String(t._id),
      key: t.key,
      title: t.title,
      status: t.status,
      priority: t.priority,
      dueDate: t.dueDate ? new Date(t.dueDate).toISOString().slice(0, 10) : null,
    })),
    requests: pendingRequests.map((r) => ({
      id: String(r._id),
      title: r.title,
      status: r.status,
      type: r.requestType,
    })),
    ...(rolesSummary.length > 0
      ? {
          roles: rolesSummary.map((r) => ({
            id: String(r._id),
            name: r.name,
            displayName: r.displayName,
            modules: r.modules || [],
            isDefault: Boolean(r.isDefault),
            isSystem: Boolean(r.isSystem),
          })),
        }
      : {}),
    ...(pendingJoinRequests.length > 0
      ? {
          pendingJoinRequests: pendingJoinRequests.map((jr) => ({
            id: String(jr._id),
            name: jr.fullname,
            email: jr.email,
            publicId: jr.publicId,
          })),
        }
      : {}),
    ...(aiGrantsSummary.length > 0
      ? {
          aiGrants: aiGrantsSummary.map((g) => ({
            id: String(g._id),
            targetName: g.targetName,
            targetType: g.targetType,
            provider: g.provider,
            isActive: g.isActive,
          })),
        }
      : {}),
    pageCatalog: getScopedRoutesCatalog(isSuper, (p) => hasPerm(user, p)),
    actionSchemas: getScopedActionSchemas(allowedActions),
  };
}

/**
 * Execute read-only grounded database queries requested by the LLM when tasks/users/items
 * fall outside the initial compact context window (Two-Step Read-Before-Write).
 */
async function runReadQueryTools(queries = [], user, scopedCtx = {}) {
  if (!Array.isArray(queries) || queries.length === 0) return [];
  const isSuper = isSuperAdminUser(user);
  const projIds = (scopedCtx.projects || []).map((p) => p.id);
  const results = [];

  for (const q of queries.slice(0, 4)) {
    const tool = String(q?.tool || "").trim();
    const args = q?.args || {};
    if (tool === "search_tasks" && (isSuper || hasPerm(user, "tasks.view") || hasPerm(user, "board.view"))) {
      const filter = { project: { $in: projIds } };
      if (args.taskKey) filter.key = String(args.taskKey).trim().toUpperCase();
      if (args.status) filter.status = String(args.status).trim();
      if (args.priority) filter.priority = String(args.priority).trim();
      if (args.type) filter.type = String(args.type).trim();
      if (args.overdue) {
        filter.dueDate = { $lt: new Date() };
        filter.status = { $ne: "done" };
      }
      if (args.assigneeId) filter.assignees = args.assigneeId;
      if (args.query) {
        const rx = new RegExp(escapeRegex(String(args.query).slice(0, 50)), "i");
        filter.$or = [{ key: rx }, { title: rx }];
      }
      const docs = await Task.find(filter)
        .select("_id key title status priority type dueDate project assignees")
        .populate("assignees", "fullname")
        .sort({ updatedAt: -1 })
        .limit(25)
        .lean();
      results.push({
        tool,
        count: docs.length,
        items: docs.map((t) => ({
          id: String(t._id),
          key: t.key,
          title: t.title,
          status: t.status,
          priority: t.priority,
          type: t.type,
          dueDate: t.dueDate ? new Date(t.dueDate).toISOString().slice(0, 10) : null,
          assignees: (t.assignees || []).map((a) => a.fullname).filter(Boolean),
        })),
      });
    } else if (tool === "search_users" && (isSuper || hasPerm(user, "team.view"))) {
      const rx = args.query ? new RegExp(escapeRegex(String(args.query).slice(0, 40)), "i") : null;
      const filter = {
        isActive: { $ne: false },
        ...(rx ? { $or: [{ fullname: rx }, { email: rx }, { publicId: rx }, { departmentName: rx }] } : {}),
      };
      const users = await User.find(filter).select("_id fullname publicId role departmentName jobTitle").limit(25).lean();
      results.push({
        tool,
        count: users.length,
        items: users.map((u) => ({
          id: String(u._id),
          name: u.fullname,
          publicId: u.publicId,
          role: u.role,
          dept: u.departmentName,
          jobTitle: u.jobTitle,
        })),
      });
    } else if (tool === "search_requests" && (isSuper || hasPerm(user, "requests.view") || hasPerm(user, "requests.approve"))) {
      const filter = isSuper || hasPerm(user, "requests.approve") ? {} : { requester: user._id };
      if (args.status) filter.status = String(args.status).trim();
      const reqs = await Request.find(filter).select("_id title status requestType priority amount").sort({ createdAt: -1 }).limit(20).lean();
      results.push({ tool, count: reqs.length, items: reqs });
    }
  }
  return results;
}

function buildConversationHistoryContext(sessionMessages = [], maxTurns = 8) {
  return (sessionMessages || [])
    .filter((m) => m.status !== "processing" && m.status !== "stopped" && m.status !== "blocked" && (m.role === "user" || m.role === "assistant"))
    .slice(-maxTurns)
    .map((m) => ({
      role: m.role,
      status: m.status,
      content: m.content,
      navigateTo: m.navigateTo || null,
      taskKey: m.executedResult?.taskKey || m.intent?.prefill?.taskKey || null,
      executedSummary: m.executedResult?.summary || null,
      ...(m.status === "clarify" && !m.actionApplied && Array.isArray(m.steps) && m.steps.length > 0
        ? { pendingSteps: m.steps }
        : {}),
      ...(m.status === "clarify" && !m.actionApplied && Array.isArray(m.choices) && m.choices.length > 0
        ? { pendingChoices: m.choices.map((c) => ({ label: c.label, step: c.step || null })) }
        : {}),
    }));
}

function compactContextForLLM(scopedCtx, mode = "review", promptText = "") {
  const isReview = mode === "review" || /\b(cursor|walk\s*through|guide|review)\b/i.test(String(promptText || ""));
  const wantsModules = /\b(roles?|modules?|permissions?|rbac)\b/i.test(String(promptText || ""));

  const compactSchemas = {};
  for (const [act, meta] of Object.entries(scopedCtx.actionSchemas || {})) {
    const keys = meta?.body && typeof meta.body === "object" ? Object.keys(meta.body) : [];
    compactSchemas[act] = keys.join(",") || "none";
  }

  return {
    currentUser: scopedCtx.currentUser,
    currentRoute: scopedCtx.currentRoute,
    activeProjectId: scopedCtx.activeProjectId,
    allowedRoutes: (scopedCtx.allowedRoutes || []).map((r) => `${r.route} (${r.label})`),
    allowedActions: scopedCtx.allowedActions,
    ...(wantsModules
      ? { modulesCatalog: (scopedCtx.modulesCatalog || []).map((m) => `${m.key}: ${m.name}`) }
      : {}),
    projects: (scopedCtx.projects || []).map((p) => ({
      id: p.id,
      prefix: p.prefix,
      name: p.name,
    })),
    departments: (scopedCtx.departments || []).map((d) => ({
      id: d.id,
      name: d.name,
      code: d.code,
    })),
    teammates: (scopedCtx.teammates || []).map((u) => ({
      id: u.id,
      name: u.name,
      publicId: u.publicId,
      role: u.role,
      jobTitle: u.jobTitle,
      dept: u.dept,
      ...(u.avatar && !String(u.avatar).startsWith("data:") ? { avatar: u.avatar } : {}),
    })),
    recentTasks: scopedCtx.recentTasks,
    requests: scopedCtx.requests,
    ...(scopedCtx.roles ? { roles: scopedCtx.roles } : {}),
    ...(scopedCtx.pendingJoinRequests ? { pendingJoinRequests: scopedCtx.pendingJoinRequests } : {}),
    ...(scopedCtx.aiGrants ? { aiGrants: scopedCtx.aiGrants } : {}),
    ...(isReview
      ? {
          pageCatalog: (scopedCtx.pageCatalog || []).map((pg) => ({
            route: pg.route,
            inputs: pg.inputs,
            buttons: pg.buttons,
          })),
        }
      : {}),
    actionFields: compactSchemas,
  };
}

module.exports = {
  ROUTE_MODULE_MAP,
  expandModulesToPermissions,
  buildScopedWebsiteContext,
  runReadQueryTools,
  buildConversationHistoryContext,
  compactContextForLLM,
};
