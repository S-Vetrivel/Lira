/**
 * Lira Workspace Modular Actions Catalog
 *
 * Every action in the platform is organized into a Module and discrete action slugs.
 * Superadmin is the ONLY hardcoded role and automatically holds `["*"]` (all modules & actions).
 * Every other role is dynamically created and mapped to modules & action slugs in MongoDB.
 */

const MODULES_CATALOG = [
  {
    key: "dashboard",
    name: "Dashboard & Analytics",
    description: "Organization overview, throughput metrics, burnup velocity, and audit logs",
    route: "/",
    actions: [
      { slug: "dashboard.view", label: "View Dashboard", description: "Access workspace overview & metrics" },
      { slug: "dashboard.logs", label: "View Audit Logs", description: "Inspect system-wide activity logs" },
    ],
  },
  {
    key: "board",
    name: "Board & Calendar Views",
    description: "Kanban sprint board, table grid, and schedule calendar",
    route: "/board",
    actions: [
      { slug: "board.view", label: "View Board & Grid", description: "Access Kanban board, grid table, and calendar" },
    ],
  },
  {
    key: "tasks",
    name: "Task Lifecycle",
    description: "Create, edit, transition, review, approve, and remove workspace tasks",
    route: "/my-work",
    actions: [
      { slug: "tasks.view", label: "View Tasks & My Day", description: "Read tasks and personal queue" },
      { slug: "tasks.create", label: "Create Tasks", description: "Create new tickets and subtasks" },
      { slug: "tasks.edit", label: "Edit & Transition Tasks", description: "Update fields, log effort, drag columns, comment" },
      { slug: "tasks.assign", label: "Assign Users & Teams", description: "Assign tasks to individual users, groups, or teams" },
      { slug: "tasks.review", label: "Submit for Review", description: "Submit completed work for QA/Lead approval" },
      { slug: "tasks.approve", label: "Approve / Request Redo", description: "Approve tasks in review or request revisions" },
      { slug: "tasks.delete", label: "Delete Tasks", description: "Permanently remove tasks" },
    ],
  },
  {
    key: "requests",
    name: "Requests & Approvals",
    description: "Multi-stage operational and procurement request workflows",
    route: "/requests",
    actions: [
      { slug: "requests.view", label: "View Requests", description: "View submitted approval requests" },
      { slug: "requests.create", label: "Submit Requests", description: "Create new multi-stage approval requests" },
      { slug: "requests.approve", label: "Approve / Decline Requests", description: "Sign off or reject pending approval stages" },
    ],
  },
  {
    key: "projects",
    name: "Workspaces & Projects",
    description: "Manage project containers, keys, members, and shared project files",
    route: "/projects",
    actions: [
      { slug: "projects.view", label: "View Workspaces", description: "Access projects and download workspace files" },
      { slug: "projects.create", label: "Create Workspaces", description: "Create new project workspaces & invoke teams" },
      { slug: "projects.edit", label: "Edit Workspace Details", description: "Update project name, description, status" },
      { slug: "projects.members", label: "Manage Project Teams & Members", description: "Invoke teams/departments or add/remove individuals" },
      { slug: "projects.urls", label: "Manage Project URLs", description: "Add and remove project links and external resources" },
      { slug: "projects.files", label: "Manage Project Files", description: "Upload and remove project shared files" },
      { slug: "projects.delete", label: "Delete Workspaces", description: "Delete workspaces and archives" },
    ],
  },
  {
    key: "departments",
    name: "Departments Governance",
    description: "Configure company departments, leads, and departmental structure",
    route: "/team",
    actions: [
      { slug: "departments.view", label: "View Departments", description: "Inspect department list and capacity" },
      { slug: "departments.create", label: "Create Departments", description: "Add new organizational departments" },
      { slug: "departments.edit", label: "Edit Departments", description: "Update department leads and membership" },
      { slug: "departments.delete", label: "Delete Departments", description: "Remove unused departments" },
    ],
  },
  {
    key: "team",
    name: "Team & Join Requests",
    description: "Staff directory management, role assignment, and Public ID onboarding",
    route: "/team",
    actions: [
      { slug: "team.view", label: "View Team Directory", description: "Browse active staff directory" },
      { slug: "team.create", label: "Add Members", description: "Directly create team member accounts" },
      { slug: "team.edit", label: "Manage Members", description: "Update staff roles, departments, and status" },
      { slug: "team.delete", label: "Deactivate Members", description: "Deactivate or remove user accounts" },
      { slug: "team.join_requests", label: "Review Join Requests", description: "Approve or decline onboarding applications" },
    ],
  },
  {
    key: "chat",
    name: "Office Chat & File Hub",
    description: "Real-time WebSocket E2EE rooms, DMs, and MinIO file sharing",
    route: "#chat",
    actions: [
      { slug: "chat.view", label: "Access Chat & Files", description: "Read channels, DMs, and download shared files" },
      { slug: "chat.send", label: "Send Messages & Upload", description: "Post encrypted messages and upload chunks" },
      { slug: "chat.pin", label: "Pin Messages", description: "Pin or unpin important messages in channels & projects" },
    ],
  },
  {
    key: "ai",
    name: "AI Task Assistant",
    description: "Gemini-powered task breakdown and effort estimation",
    route: "#ai",
    actions: [
      { slug: "ai.use", label: "Use AI Breakdown", description: "Generate subtasks and estimates using Gemini AI" },
    ],
  },
  {
    key: "rbac",
    name: "Roles & Access Control",
    description: "Dynamic role creation, module mapping, and permission governance",
    route: "/roles",
    actions: [
      { slug: "rbac.view", label: "View Roles & Modules", description: "Inspect configured dynamic roles and module permissions" },
      { slug: "rbac.manage", label: "Manage Roles & Modules", description: "Create/edit roles, departments, and assign modules" },
    ],
  },
];

const ALL_MODULE_KEYS = MODULES_CATALOG.map((m) => m.key);
const ALL_ACTION_SLUGS = MODULES_CATALOG.flatMap((m) => m.actions.map((a) => a.slug));

module.exports = {
  MODULES_CATALOG,
  ALL_MODULE_KEYS,
  ALL_ACTION_SLUGS,
};

