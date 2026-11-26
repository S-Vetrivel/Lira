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
    label: "Workspaces & Projects",
    inputs: ["New Project(projName, projPrefix, projDesc, projDept)", "New Department(deptName, deptCode, deptColor, deptDesc, deptLead)", "Project Edit(editProjName, editProjDesc, editProjDept, editProjStatus)", "Add Member(projMemberId)", "Invoke Dept(invokeDeptId)", "Add URL(urlTitle, urlValue, urlCategory)", "Quick Task(quickTaskTitle)", "Project Chat(projChatInput)"],
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
    route: "/profile?tab=ai",
    aliases: ["/profile"],
    moduleKey: "ai",
    perm: "ai.use",
    label: "Profile & Personal AI Keys",
    inputs: ["fullname", "phone", "jobTitle", "status(active|away|on_leave)", "bio", "newPassword", "confirmPassword", "UserAIKeysPanel keys"],
    buttons: ["Save Profile Changes ([data-ai-target='save-profile-btn'])", "Change Photo", "My Profile & Workspaces Tab", "AI Keys & Vault Access Tab"],
  },
];

const COPILOT_ACTION_SCHEMAS = {
  create_task: { method: "POST", endpoint: "/v3/tasks", body: { projectId: "ObjectId", title: "string*", description: "string", type: "task|bug|client_request|approval", priority: "low|medium|high|urgent", dueDate: "YYYY-MM-DD", assignees: ["userId"], subtasks: [{ title: "string" }] } },
  update_task: { method: "PUT", endpoint: "/v3/tasks/:id", body: { taskKey: "PROJ-1", title: "string", description: "string", priority: "low|medium|high|urgent", status: "todo|in_progress|review|submitted_for_review|redo_requested|done", dueDate: "YYYY-MM-DD" } },
  update_task_status: { method: "PATCH", endpoint: "/v3/tasks/:id/status", body: { taskKey: "PROJ-1", status: "todo|in_progress|review|submitted_for_review|redo_requested|done" } },
  assign_task: { method: "PUT", endpoint: "/v3/tasks/:id", body: { taskKey: "PROJ-1", assignees: ["userId"], assignedDepartments: ["deptId"] } },
  submit_task_review: { method: "POST", endpoint: "/v3/tasks/:id/submit-for-review", body: { taskKey: "PROJ-1" } },
  approve_task: { method: "POST", endpoint: "/v3/tasks/:id/approve", body: { taskKey: "PROJ-1" } },
  redo_task: { method: "POST", endpoint: "/v3/tasks/:id/redo", body: { taskKey: "PROJ-1", reason: "string*" } },
  add_subtask: { method: "POST", endpoint: "/v3/tasks/:id/subtasks", body: { taskKey: "PROJ-1", title: "string*" } },
  toggle_subtask: { method: "PATCH", endpoint: "/v3/tasks/:id/subtasks/:subId/toggle", body: { taskKey: "PROJ-1", subtaskId: "ObjectId*" } },
  add_task_comment: { method: "POST", endpoint: "/v3/comments/:taskId", body: { taskKey: "PROJ-1", text: "string*" } },
  add_worklog: { method: "POST", endpoint: "/v3/tasks/:id/worklog", body: { taskKey: "PROJ-1", hours: "number*", note: "string" } },
  bulk_update_tasks: { method: "POST", endpoint: "/v3/tasks/bulk-update", body: { taskIds: ["ObjectId*"], status: "string", priority: "string" } },
  delete_task: { method: "DELETE", endpoint: "/v3/tasks/:id", body: { taskKey: "PROJ-1" } },
  open_task: { method: "UI", endpoint: "TaskDrawer", body: { taskKey: "PROJ-1" } },
  send_project_chat: { method: "POST", endpoint: "/v3/chat/messages", body: { projectId: "ObjectId", roomId: "project_<id>|dept_general", message: "string*" } },
  send_dm: { method: "POST", endpoint: "/v3/chat/messages", body: { recipientId: "userId*", message: "string*" } },
  toggle_pin_chat_message: { method: "PATCH", endpoint: "/v3/chat/messages/:id/pin", body: { messageId: "ObjectId*" } },
  open_chat: { method: "UI", endpoint: "OfficeChatDrawer", body: { roomId: "string", recipientId: "userId" } },
  create_request: { method: "POST", endpoint: "/v3/requests", body: { title: "string*", requestType: "budget_approval|general_signoff|procurement|access_request|hiring", description: "string", targetDepartmentId: "deptId", amount: "number", priority: "low|medium|high|urgent" } },
  approve_request: { method: "POST", endpoint: "/v3/requests/:id/approve", body: { requestId: "ObjectId", title: "string", note: "string" } },
  reject_request: { method: "POST", endpoint: "/v3/requests/:id/reject", body: { requestId: "ObjectId", title: "string", note: "string" } },
  create_project: { method: "POST", endpoint: "/v3/projects", body: { name: "string*", prefix: "ABC", description: "string", department: "deptId" } },
  update_project: { method: "PUT", endpoint: "/v3/projects/:id", body: { projectId: "ObjectId", prefix: "ABC", newName: "string", description: "string", status: "active|completed|archived" } },
  delete_project: { method: "DELETE", endpoint: "/v3/projects/:id", body: { projectId: "ObjectId", prefix: "ABC" } },
  add_project_member: { method: "POST", endpoint: "/v3/projects/:id/members", body: { projectId: "ObjectId*", userId: "userId*" } },
  remove_project_member: { method: "DELETE", endpoint: "/v3/projects/:id/members/:userId", body: { projectId: "ObjectId*", userId: "userId*" } },
  invoke_project_department: { method: "POST", endpoint: "/v3/projects/:id/departments", body: { projectId: "ObjectId*", departmentId: "deptId*" } },
  remove_project_department: { method: "DELETE", endpoint: "/v3/projects/:id/departments/:deptId", body: { projectId: "ObjectId*", departmentId: "deptId*" } },
  add_project_url: { method: "POST", endpoint: "/v3/projects/:id/urls", body: { projectId: "ObjectId*", label: "string*", url: "https://...*" } },
  create_department: { method: "POST", endpoint: "/v3/departments", body: { name: "string*", code: "DEP", description: "string", color: "#6366f1" } },
  update_department: { method: "PUT", endpoint: "/v3/departments/:id", body: { departmentId: "ObjectId", name: "string", code: "string", description: "string" } },
  delete_department: { method: "DELETE", endpoint: "/v3/departments/:id", body: { departmentId: "ObjectId", name: "string" } },
  add_department_member: { method: "POST", endpoint: "/v3/departments/:id/members", body: { departmentId: "ObjectId*", userId: "userId*" } },
  remove_department_member: { method: "DELETE", endpoint: "/v3/departments/:id/members/:userId", body: { departmentId: "ObjectId*", userId: "userId*" } },
  create_user: { method: "POST", endpoint: "/v3/users", body: { fullname: "string*", email: "string*", password: "string", role: "roleName", jobTitle: "string", departmentId: "deptId" } },
  update_user: { method: "PUT", endpoint: "/v3/users/:id", body: { userId: "ObjectId*", role: "roleName", jobTitle: "string", department: "deptId", status: "active|away|on_leave" } },
  update_user_role: { method: "PUT", endpoint: "/v3/roles/assign/:userId", body: { userId: "ObjectId*", role: "roleName*" } },
  delete_user: { method: "DELETE", endpoint: "/v3/users/:id", body: { userId: "ObjectId*", targetName: "string" } },
  approve_join_request: { method: "PUT", endpoint: "/v3/users/join-requests/:id/approve", body: { requestId: "ObjectId*", role: "roleName", departmentName: "string", jobTitle: "string" } },
  reject_join_request: { method: "PUT", endpoint: "/v3/users/join-requests/:id/reject", body: { requestId: "ObjectId*", reason: "string" } },
  remove_non_superadmins: { method: "POST", endpoint: "/v3/users/bulk-remove-non-superadmins", body: { excludeRoles: ["superadmin"] } },
  create_role: { method: "POST", endpoint: "/v3/roles", body: { name: "string*", displayName: "string", description: "string", modules: ["dashboard|board|tasks|requests|projects|departments|team|chat|ai|rbac|audit"], isDefault: "boolean" } },
  update_role: { method: "PUT", endpoint: "/v3/roles/:id", body: { roleId: "ObjectId", name: "string", displayName: "string", description: "string", modules: ["moduleKey"], isDefault: "boolean" } },
  delete_role: { method: "DELETE", endpoint: "/v3/roles/:id", body: { roleId: "ObjectId", name: "string" } },
  grant_ai_access: { method: "POST", endpoint: "/v3/ai/grants", body: { targetType: "user|department|team", targetId: "ObjectId*", targetName: "string", provider: "all|openai|anthropic|google", allowedModules: ["*"] } },
  revoke_ai_access: { method: "PUT", endpoint: "/v3/ai/grants/:grantId/revoke", body: { grantId: "ObjectId*" } },
  restore_ai_access: { method: "PUT", endpoint: "/v3/ai/grants/:grantId/restore", body: { grantId: "ObjectId*" } },
  delete_ai_grant: { method: "DELETE", endpoint: "/v3/ai/grants/:grantId", body: { grantId: "ObjectId*" } },
  update_ai_config: { method: "PUT", endpoint: "/v3/ai/config/:provider", body: { provider: "openai|anthropic|google", enabled: "boolean", defaultModel: "string", thinkingLevel: "minimal|low|medium|high" } },
  mark_notifications_read: { method: "POST", endpoint: "/v3/notifications/read-all", body: {} },
  open_notifications: { method: "UI", endpoint: "HeaderNotifications", body: {} },
  update_profile: { method: "PUT", endpoint: "/v3/profile/info", body: { fullname: "string", jobTitle: "string", status: "active|away|on_leave", bio: "string" } },
  toggle_theme: { method: "UI", endpoint: "ThemeToggle", body: {} },
  navigate: { method: "UI", endpoint: "Router", body: { route: "string" } },
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
  COPILOT_ACTION_SCHEMAS,
  getScopedRoutesCatalog,
  getScopedActionSchemas,
};

