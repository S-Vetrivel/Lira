/**
 * Complete Frontend-to-Backend Copilot Action & UI Element Registry
 * Parsed across every Lira page, modal, drawer, and Express API endpoint.
 * Used both for documentation and to inject strictly RBAC-filtered context into Lira Copilot.
 */

const PAGE_CATALOG = [
  {
    route: "/",
    aliases: ["/dashboard", "/analytics"],
    moduleKey: "dashboard",
    perm: "dashboard.view",
    label: "Dashboard & Overview",
    inputs: ["timeFilter(7d|30d|90d|all)", "velocityFilter", "selectedTaskType(all|task|bug)"],
    buttons: ["Refresh Dashboard", "Team Chat", "New Task ([data-ai-target='header-new-task-btn'])"],
  },
  {
    route: "/board",
    aliases: [],
    moduleKey: "board",
    perm: "board.view",
    label: "Sprint Board",
    inputs: ["CreateTaskModal(projectId, type, title, description, priority, dueDate, estimatedHours, subtasks)", "TaskDrawer(status, priority, type, dueDate, dueTime, assignees, assignedDepartments, newSubtaskTitle, commentText, logHours, logNote)"],
    buttons: ["Add Task", "Open Task", "Submit for Review", "Approve", "Request Redo", "Delete Task"],
  },
  {
    route: "/table",
    aliases: ["/grid"],
    moduleKey: "board",
    perm: "board.view",
    label: "Table Grid View",
    inputs: ["searchQuery", "statusFilter", "priorityFilter", "bulkSelectionCheckboxes", "inline row status/priority selects"],
    buttons: ["Refresh Grid", "Export CSV", "Add Task", "Mark Done", "Submit for Review", "Clear Selection", "Open Task"],
  },
  {
    route: "/calendar",
    aliases: [],
    moduleKey: "board",
    perm: "board.view",
    label: "Schedule Calendar",
    inputs: ["CreateTaskModal(projectId, title, dueDate YYYY-MM-DD, priority, type)"],
    buttons: ["Add Task ([data-ai-target='calendar-add-task-btn'])", "Today", "Previous Month", "Next Month", "Unscheduled Tasks", "Day Tile", "Schedule Task for Day", "Open Sidebar Details"],
  },
  {
    route: "/my-work",
    aliases: [],
    moduleKey: "tasks",
    perm: "tasks.view",
    label: "My Day & Assigned Tasks",
    inputs: ["TaskDrawer fields on selected personal task"],
    buttons: ["Refresh", "Open Task Drawer"],
  },
  {
    route: "/requests",
    aliases: [],
    moduleKey: "requests",
    perm: "requests.view",
    label: "Requests & Approvals",
    inputs: ["New Request(title, requestType, targetDepartment, targetProject, targetUsers, amount, urgency, description)", "actionNotes"],
    buttons: ["New Request ([data-ai-target='new-request-btn'])", "Approve Stage ([data-ai-target='request-approve-btn'])", "Reject ([data-ai-target='request-reject-btn'])", "Submit Request ([data-ai-target='save-request-btn'])"],
  },
  {
    route: "/projects",
    aliases: [],
    moduleKey: "projects",
    perm: "projects.view",
    label: "Workspaces & Departments (/projects)",
    description: "Top section 'PROJECT WORKSPACES' lists Project Workspaces (action: create_project) that contain tasks, boards, files, and project chat; bottom section 'DEPARTMENTS & STAFF MANAGEMENT' lists organizational staff Departments (action: create_department).",
    inputs: ["New Project Workspace(projName, projPrefix, projDesc, projDept)", "New Department(deptName, deptCode, deptColor, deptDesc, deptLead)", "Project Edit(editProjName, editProjDesc, editProjDept, editProjStatus)", "Add Member(projMemberId)", "Invoke Dept(invokeDeptId)", "Add URL(urlTitle, urlValue, urlCategory)", "Quick Task(quickTaskTitle)", "Project Chat(projChatInput)"],
    buttons: ["New Project ([data-ai-target='add-project-btn'])", "New Department ([data-ai-target='add-dept-btn'])", "Manage & Files", "Switch Board", "Chat", "Edit Details", "Create Project ([data-ai-target='save-project-btn'])", "Create Department ([data-ai-target='save-dept-btn'])"],
  },
  {
    route: "/team",
    aliases: ["/team?tab=join-requests"],
    moduleKey: "team",
    perm: "team.view",
    label: "Team Directory & Join Requests",
    inputs: ["search", "selectedDept", "Add Member(fullname, email, password, role, departmentId, jobTitle)", "Edit Member(editRole, editDeptId, editJobTitle, editStatus)", "Approve Join Request(approveDeptName, approveRole, approveJobTitle)", "Decline Reason(declineReason)"],
    buttons: ["Add Member ([data-ai-target='add-member-btn'])", "Active Team Members", "Pending Join Requests", "Details", "DM", "Deactivate", "Save Changes ([data-ai-target='save-member-btn'])", "Approve & Grant Access ([data-ai-target='join-approve-btn'])", "Decline"],
  },
  {
    route: "/roles",
    aliases: ["/roles?tab=departments"],
    moduleKey: "rbac",
    perm: "rbac.view",
    label: "Dynamic Roles & Departments",
    inputs: ["Role Editor(roleDisplayName [data-ai-target='role-name-input'], roleKey, roleDeptId, roleColor, roleDescription, roleIsDefault checkbox, modules/permissions checkboxes [data-ai-target='role-modules-box'])", "New Department(deptName, deptCode, deptDesc)"],
    buttons: ["Create Dynamic Role ([data-ai-target='new-role-btn'])", "Configure Modules", "Delete Role", "Save Role & Modules ([data-ai-target='save-role-btn'])", "New Department ([data-ai-target='new-dept-btn'])"],
  },
  {
    route: "/roles?tab=ai",
    aliases: [],
    moduleKey: "ai",
    perm: "ai.manage",
    label: "AI Models & Encrypted Vault",
    inputs: ["Provider Config(apiKeyInput, defaultModel, thinkingLevel, enabled checkbox, isGlobalDefault checkbox)", "Global Grants(targetType user|department|team, targetSearch, provider, note, allowedModules toggles)"],
    buttons: ["Provider Routing & Grants", "Global Key Ring", "Test Connection", "Encrypt & Save", "Revoke Key", "Grant Global Key Access ([data-ai-target='grant-ai-submit-btn'])", "Revoke Grant", "Restore Grant", "Delete Grant"],
  },
  {
    route: "/audit",
    aliases: [],
    moduleKey: "audit",
    perm: "audit.view",
    label: "Audit Logs & Live Sessions",
    inputs: ["search", "statusFilter", "actionFilter", "aiSearch", "aiProviderFilter", "aiScopeFilter", "aiStatusFilter"],
    buttons: ["Refresh", "User Action Trail", "AI Key Usage", "Online Users", "Teams & Workspaces", "Mutations Only Toggle"],
  },
  {
    route: "/broadcast",
    aliases: [],
    moduleKey: "broadcast",
    perm: "broadcast.view",
    label: "Push & Broadcast Console (/broadcast)",
    description: "Superadmin & broadcast console to send org-wide or targeted In-App Alerts, Browser Web Push notifications, and Email announcements with AI drafting.",
    inputs: ["title", "message", "category(info|announcement|urgent|maintenance|release_update)", "audienceType(all|online_only|offline_only|department|role|users)", "channels(inApp,webPush,email,offlineOnlyEmail)", "aiBrief"],
    buttons: ["Draft with AI", "Send Broadcast", "Target Audience", "Delivery History"],
  },
  {
    route: "/profile?tab=ai",
    aliases: ["/profile"],
    moduleKey: "ai",
    perm: "ai.use",
    label: "Profile & Personal AI Keys",
    inputs: ["fullname", "phone", "jobTitle", "status(active|away|on_leave)", "bio", "newPassword", "confirmPassword", "UserAIKeysPanel keys"],
    buttons: ["Save Profile Changes ([data-ai-target='save-profile-btn'])", "Change Photo", "My Profile & Workspaces Tab", "AI Keys & Vault Access Tab"],
  },
];

const ENTITY_DEFINITIONS = {
  projectWorkspace: {
    model: "Project",
    uiLabel: "Project Workspaces (top section of /projects & top-navbar Workspace Switcher)",
    createAction: "create_project",
    keyField: "prefix (unique 2-6 uppercase alphanumeric key, e.g. ENG, MKT)",
    description:
      "A Project Workspace is a full work container holding tasks/tickets (KEY-101), Sprint Kanban Board (/board), Table Grid (/table), Schedule Calendar (/calendar), shared files, URLs, members, invoked departments, and a dedicated project chat room. Whenever a user says 'workspace', 'project workspace', 'project', or 'board', this is the entity to create or update.",
  },
  department: {
    model: "Department",
    uiLabel: "Departments & Staff Management (bottom section of /projects & /roles?tab=departments)",
    createAction: "create_department",
    keyField: "code (unique short department code, e.g. ENG, HR, OPS, MKT)",
    description:
      "An organizational staff Department (e.g. Engineering, HR, Marketing, Operations) that groups teammates/employees and assigns a Department Lead. Departments do NOT have their own Kanban board or tasks unless invoked into a Project Workspace. Only use create_department when the user explicitly asks to create a department or staff unit (NEVER instead of a workspace/project).",
  },
  task: {
    model: "Task",
    uiLabel: "Kanban Board (/board), Table Grid (/table), Calendar (/calendar), My Day (/my-work)",
    createAction: "create_task",
    keyField: "key (auto-generated <PROJECT_PREFIX>-<number>, e.g. ENG-101)",
    description:
      "A trackable work item belonging to one Project Workspace (projectId) with type (task|bug|client_request|approval|compliance|routine), priority (low|medium|high|urgent), status, dueDate, subtasks, worklogs, comments, assignees, and assignedDepartments.",
  },
  request: {
    model: "Request",
    uiLabel: "Requests & Approvals (/requests)",
    createAction: "create_request",
    keyField: "requestCode",
    description:
      "A formal multi-stage approval workflow item for budget approvals, travel requests, asset requisitions, leave, vendor payments, or compliance signoffs.",
  },
  role: {
    model: "Role",
    uiLabel: "Roles & Access Control (/roles)",
    createAction: "create_role",
    keyField: "name (lowercase slug) + displayName",
    description:
      "An RBAC role defining which Lira modules (dashboard, board, tasks, requests, projects, departments, team, chat, ai, rbac, audit) and granular permissions assigned users hold.",
  },
  teammate: {
    model: "User",
    uiLabel: "Team Directory (/team)",
    createAction: "create_user",
    keyField: "publicId (EMP-*) & email",
    description:
      "An active platform staff account with a role, jobTitle, and organizational department membership.",
  },
};

const COPILOT_ACTION_SCHEMAS = {
  create_task: { entity: "Task", description: "Create a new task/bug/ticket inside a Project Workspace", method: "POST", endpoint: "/v3/tasks", body: { projectId: "ObjectId", title: "string*", description: "string", type: "task|bug|client_request|approval", priority: "low|medium|high|urgent", dueDate: "YYYY-MM-DD", assignees: ["userId"], subtasks: [{ title: "string" }] } },
  update_task: { entity: "Task", description: "Edit task title, description, priority, status, or dueDate", method: "PUT", endpoint: "/v3/tasks/:id", body: { taskKey: "PROJ-1", title: "string", description: "string", priority: "low|medium|high|urgent", status: "todo|in_progress|review|submitted_for_review|redo_requested|done", dueDate: "YYYY-MM-DD" } },
  update_task_status: { entity: "Task", description: "Move a task across workflow columns", method: "PATCH", endpoint: "/v3/tasks/:id/status", body: { taskKey: "PROJ-1", status: "todo|in_progress|review|submitted_for_review|redo_requested|done" } },
  assign_task: { entity: "Task", description: "Assign users or departments to a task", method: "PUT", endpoint: "/v3/tasks/:id", body: { taskKey: "PROJ-1", assignees: ["userId"], assignedDepartments: ["deptId"] } },
  submit_task_review: { entity: "Task", description: "Submit a task for QA/lead review", method: "POST", endpoint: "/v3/tasks/:id/submit-for-review", body: { taskKey: "PROJ-1" } },
  approve_task: { entity: "Task", description: "Approve a reviewed task and mark done", method: "POST", endpoint: "/v3/tasks/:id/approve", body: { taskKey: "PROJ-1" } },
  redo_task: { entity: "Task", description: "Request revisions on a task with reason", method: "POST", endpoint: "/v3/tasks/:id/redo", body: { taskKey: "PROJ-1", reason: "string*" } },
  add_subtask: { entity: "Task", description: "Add a checklist subtask under an existing task", method: "POST", endpoint: "/v3/tasks/:id/subtasks", body: { taskKey: "PROJ-1", title: "string*" } },
  toggle_subtask: { entity: "Task", description: "Toggle completion on a task subtask", method: "PATCH", endpoint: "/v3/tasks/:id/subtasks/:subId/toggle", body: { taskKey: "PROJ-1", subtaskId: "ObjectId*" } },
  add_task_comment: { entity: "Task", description: "Post a comment on a task thread", method: "POST", endpoint: "/v3/comments/:taskId", body: { taskKey: "PROJ-1", text: "string*" } },
  add_worklog: { entity: "Task", description: "Log time/hours worked on a task", method: "POST", endpoint: "/v3/tasks/:id/worklog", body: { taskKey: "PROJ-1", hours: "number*", note: "string" } },
  bulk_update_tasks: { entity: "Task", description: "Bulk update status or priority across tasks", method: "POST", endpoint: "/v3/tasks/bulk-update", body: { taskIds: ["ObjectId*"], status: "string", priority: "string" } },
  delete_task: { entity: "Task", description: "Permanently delete a task", method: "DELETE", endpoint: "/v3/tasks/:id", body: { taskKey: "PROJ-1" } },
  open_task: { entity: "Task", description: "Open the Task Drawer for a specific task key", method: "UI", endpoint: "TaskDrawer", body: { taskKey: "PROJ-1" } },
  send_project_chat: { entity: "Chat", description: "Post a message into a workspace project chat channel", method: "POST", endpoint: "/v3/chat/messages", body: { projectId: "ObjectId", roomId: "project_<id>|dept_general", message: "string*" } },
  send_dm: { entity: "Chat", description: "Send a direct message to a teammate", method: "POST", endpoint: "/v3/chat/messages", body: { recipientId: "userId*", message: "string*" } },
  toggle_pin_chat_message: { entity: "Chat", description: "Pin or unpin a chat message", method: "PATCH", endpoint: "/v3/chat/messages/:id/pin", body: { messageId: "ObjectId*" } },
  open_chat: { entity: "Chat", description: "Open the Office Chat drawer", method: "UI", endpoint: "OfficeChatDrawer", body: { roomId: "string", recipientId: "userId" } },
  create_request: { entity: "Request", description: "Submit a multi-stage operational/budget/leave approval request", method: "POST", endpoint: "/v3/requests", body: { title: "string*", requestType: "budget_approval|travel_request|asset_requisition|leave_approval|vendor_payment|compliance_signoff|general_request", description: "string", targetDepartmentId: "deptId", amount: "number", priority: "low|medium|high|urgent" } },
  approve_request: { entity: "Request", description: "Approve the active stage of a pending request", method: "POST", endpoint: "/v3/requests/:id/approve", body: { requestId: "ObjectId", title: "string", note: "string" } },
  reject_request: { entity: "Request", description: "Decline/reject a pending request", method: "POST", endpoint: "/v3/requests/:id/reject", body: { requestId: "ObjectId", title: "string", note: "string" } },
  create_project: { entity: "ProjectWorkspace", description: "Create a Project Workspace (shown in PROJECT WORKSPACES on /projects & navbar switcher; owns boards, tasks, files, URLs, and chat). Use this whenever user asks for a workspace or project.", method: "POST", endpoint: "/v3/projects", body: { name: "string*", prefix: "UNIQUE_2_6_CHAR_KEY*", description: "string", department: "deptId", departments: ["deptId"], members: ["userId"], color: "#4F46E5" } },
  update_project: { entity: "ProjectWorkspace", description: "Rename or update description/status of a Project Workspace", method: "PUT", endpoint: "/v3/projects/:id", body: { projectId: "ObjectId", prefix: "ABC", newName: "string", description: "string", status: "active|completed|archived" } },
  delete_project: { entity: "ProjectWorkspace", description: "Delete a Project Workspace", method: "DELETE", endpoint: "/v3/projects/:id", body: { projectId: "ObjectId", prefix: "ABC" } },
  add_project_member: { entity: "ProjectWorkspace", description: "Add a user to a Project Workspace", method: "POST", endpoint: "/v3/projects/:id/members", body: { projectId: "ObjectId*", userId: "userId*" } },
  remove_project_member: { entity: "ProjectWorkspace", description: "Remove a user from a Project Workspace", method: "DELETE", endpoint: "/v3/projects/:id/members/:userId", body: { projectId: "ObjectId*", userId: "userId*" } },
  invoke_project_department: { entity: "ProjectWorkspace", description: "Link an organizational Department into a Project Workspace", method: "POST", endpoint: "/v3/projects/:id/departments", body: { projectId: "ObjectId*", departmentId: "deptId*" } },
  remove_project_department: { entity: "ProjectWorkspace", description: "Unlink a Department from a Project Workspace", method: "DELETE", endpoint: "/v3/projects/:id/departments/:deptId", body: { projectId: "ObjectId*", departmentId: "deptId*" } },
  add_project_url: { entity: "ProjectWorkspace", description: "Attach an external resource link to a Project Workspace", method: "POST", endpoint: "/v3/projects/:id/urls", body: { projectId: "ObjectId*", label: "string*", url: "https://...*" } },
  create_department: { entity: "Department", description: "Create an organizational staff Department (shown under DEPARTMENTS & STAFF MANAGEMENT). Only use when explicitly creating a staff department, NOT a workspace/project.", method: "POST", endpoint: "/v3/departments", body: { name: "string*", code: "DEP*", description: "string", color: "#6366f1", lead: "userId" } },
  update_department: { entity: "Department", description: "Edit an organizational Department's name, code, description, or lead", method: "PUT", endpoint: "/v3/departments/:id", body: { departmentId: "ObjectId", name: "string", code: "string", description: "string" } },
  delete_department: { entity: "Department", description: "Delete an organizational Department", method: "DELETE", endpoint: "/v3/departments/:id", body: { departmentId: "ObjectId", name: "string" } },
  add_department_member: { entity: "Department", description: "Assign a staff member to a Department", method: "POST", endpoint: "/v3/departments/:id/members", body: { departmentId: "ObjectId*", userId: "userId*" } },
  remove_department_member: { entity: "Department", description: "Remove a staff member from a Department", method: "DELETE", endpoint: "/v3/departments/:id/members/:userId", body: { departmentId: "ObjectId*", userId: "userId*" } },
  create_user: { entity: "User", description: "Create a new staff member account in Team Directory", method: "POST", endpoint: "/v3/users", body: { fullname: "string*", email: "string*", password: "string", role: "roleName", jobTitle: "string", departmentId: "deptId" } },
  update_user: { entity: "User", description: "Update a teammate's role, jobTitle, department, or status", method: "PUT", endpoint: "/v3/users/:id", body: { userId: "ObjectId*", role: "roleName", jobTitle: "string", department: "deptId", status: "active|away|on_leave" } },
  update_user_role: { entity: "User", description: "Assign an RBAC role to a team member", method: "PUT", endpoint: "/v3/roles/assign/:userId", body: { userId: "ObjectId*", role: "roleName*" } },
  delete_user: { entity: "User", description: "Deactivate/remove a team member", method: "DELETE", endpoint: "/v3/users/:id", body: { userId: "ObjectId*", targetName: "string" } },
  approve_join_request: { entity: "User", description: "Approve a pending onboarding join request", method: "PUT", endpoint: "/v3/users/join-requests/:id/approve", body: { requestId: "ObjectId*", role: "roleName", departmentName: "string", jobTitle: "string" } },
  reject_join_request: { entity: "User", description: "Reject a pending onboarding join request", method: "PUT", endpoint: "/v3/users/join-requests/:id/reject", body: { requestId: "ObjectId*", reason: "string" } },
  remove_non_superadmins: { entity: "User", description: "Superadmin-only bulk removal of non-superadmin users", method: "POST", endpoint: "/v3/users/bulk-remove-non-superadmins", body: { excludeRoles: ["superadmin"] } },
  create_role: { entity: "Role", description: "Create a dynamic RBAC role with module permissions", method: "POST", endpoint: "/v3/roles", body: { name: "string*", displayName: "string", description: "string", modules: ["dashboard|board|tasks|requests|projects|departments|team|chat|ai|rbac|audit"], isDefault: "boolean" } },
  update_role: { entity: "Role", description: "Update role modules, description, displayName, or default flag", method: "PUT", endpoint: "/v3/roles/:id", body: { roleId: "ObjectId", name: "string", displayName: "string", description: "string", modules: ["moduleKey"], isDefault: "boolean" } },
  delete_role: { entity: "Role", description: "Delete a custom role", method: "DELETE", endpoint: "/v3/roles/:id", body: { roleId: "ObjectId", name: "string" } },
  grant_ai_access: { entity: "AIGlobalGrant", description: "Grant AI model access to a user, department, or team", method: "POST", endpoint: "/v3/ai/grants", body: { targetType: "user|department|team", targetId: "ObjectId*", targetName: "string", provider: "all|openai|anthropic|google", allowedModules: ["*"] } },
  revoke_ai_access: { entity: "AIGlobalGrant", description: "Revoke an existing AI access grant", method: "PUT", endpoint: "/v3/ai/grants/:grantId/revoke", body: { grantId: "ObjectId*" } },
  restore_ai_access: { entity: "AIGlobalGrant", description: "Restore a revoked AI access grant", method: "PUT", endpoint: "/v3/ai/grants/:grantId/restore", body: { grantId: "ObjectId*" } },
  delete_ai_grant: { entity: "AIGlobalGrant", description: "Permanently delete an AI access grant", method: "DELETE", endpoint: "/v3/ai/grants/:grantId", body: { grantId: "ObjectId*" } },
  update_ai_config: { entity: "AIConfig", description: "Update global AI provider model/thinking/enabled config", method: "PUT", endpoint: "/v3/ai/config/:provider", body: { provider: "openai|anthropic|google", enabled: "boolean", defaultModel: "string", thinkingLevel: "minimal|low|medium|high" } },
  mark_notifications_read: { entity: "Notification", description: "Mark all unread notifications as read", method: "POST", endpoint: "/v3/notifications/read-all", body: {} },
  send_broadcast_notification: { entity: "BroadcastNotification", description: "Send a workspace broadcast push/in-app/email alert to all users or specific departments/roles/users via Push Console", method: "POST", endpoint: "/v3/broadcast/send", body: { title: "string*", message: "string*", category: "info|announcement|urgent|maintenance|release_update", audienceType: "all|online_only|offline_only|department|role|users", actionUrl: "string", channels: { inApp: "boolean", webPush: "boolean", email: "boolean", offlineOnlyEmail: "boolean" } } },
  open_notifications: { entity: "Notification", description: "Open header notifications panel", method: "UI", endpoint: "HeaderNotifications", body: {} },
  update_profile: { entity: "User", description: "Update current user's profile info and availability status", method: "PUT", endpoint: "/v3/profile/info", body: { fullname: "string", jobTitle: "string", status: "active|away|on_leave", bio: "string" } },
  toggle_theme: { entity: "UI", description: "Toggle between dark and light theme", method: "UI", endpoint: "ThemeToggle", body: {} },
  navigate: { entity: "UI", description: "Navigate to a permitted platform route", method: "UI", endpoint: "Router", body: { route: "string" } },
};

function getScopedRoutesCatalog(isSuper, hasPermFn) {
  return PAGE_CATALOG.filter((p) => isSuper || hasPermFn(p.perm));
}

function getScopedActionSchemas(allowedActions = []) {
  const out = {};
  for (const act of allowedActions) {
    if (COPILOT_ACTION_SCHEMAS[act]) {
      out[act] = COPILOT_ACTION_SCHEMAS[act];
    }
  }
  return out;
}

module.exports = {
  PAGE_CATALOG,
  ENTITY_DEFINITIONS,
  COPILOT_ACTION_SCHEMAS,
  getScopedRoutesCatalog,
  getScopedActionSchemas,
};

