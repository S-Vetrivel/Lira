# Lira Workspace Copilot — Full UI, Route & Backend API Action Map

Auto-generated reference mapping every frontend route, UI inputs/buttons, Copilot step action, Backend Express API endpoint, RBAC guard, and JSON request body.

## 1. Frontend Routes, Page Inputs & Action Controls

| Route | Module / Guard | Form Inputs & Fields | Primary Buttons & Targets |
|---|---|---|---|
| `/`, `/dashboard`, `/analytics` | `dashboard.view` | `timeFilter`, `velocityFilter`, `selectedTaskType` | `Refresh Dashboard`, `Team Chat`, `New Task` (`[data-ai-target="header-new-task-btn"]`) |
| `/board` | `board.view` | `CreateTaskModal` (`projectId`, `type`, `title`, `description`, `priority`, `dueDate`, `estimatedHours`, `assignees`, `subtasks`), `TaskDrawer` (`status`, `priority`, `dueDate`, `commentText`, checklist) | `New Task`, `Submit for Review` (`[data-ai-target="task-submit-review-btn"]`), `Approve` (`[data-ai-target="task-approve-btn"]`), `Request Redo` (`[data-ai-target="task-redo-btn"]`), `Delete Task` (`[data-ai-target="task-delete-btn"]`) |
| `/table` | `board.view` | `searchQuery`, `statusFilter`, `priorityFilter`, multi-select checkboxes, inline status/priority selects | `Refresh Grid`, `Export CSV`, `Add Task`, `Mark Done`, `Submit for Review`, `Clear` |
| `/calendar` | `board.view` | `CreateTaskModal` (`dueDate` YYYY-MM-DD, `projectId`, `title`, `priority`) | `Add Task` (`[data-ai-target="calendar-add-task-btn"]`), `Today`, `Unscheduled`, Day Tile -> `Open Sidebar Details`, `Schedule Task for Day` |
| `/my-work` | `tasks.view` | `TaskDrawer` on personal queue items | `Refresh`, Open Task card |
| `/requests` | `requests.view` | `title`, `requestType`, `targetDepartment`, `targetProject`, `targetUsers`, `amount`, `urgency`, `description`, `actionNotes` | `New Request` (`[data-ai-target="new-request-btn"]`), `Approve Stage` (`[data-ai-target="request-approve-btn"]`), `Reject` (`[data-ai-target="request-reject-btn"]`), `Submit Request` (`[data-ai-target="save-request-btn"]`) |
| `/projects` | `projects.view` | Project create/edit (`projName`, `projPrefix`, `projDesc`, `projDept`, `status`), Dept create/edit (`deptName`, `deptCode`, `deptColor`, `deptDesc`, `lead`), Member/Dept assignment, Resource URLs, Quick Task, Project Chat | `New Project` (`[data-ai-target="add-project-btn"]`), `New Department` (`[data-ai-target="add-dept-btn"]`), `Switch Board`, `Manage & Files`, `Chat`, `Create Project` (`[data-ai-target="save-project-btn"]`), `Create Department` (`[data-ai-target="save-dept-btn"]`) |
| `/team`, `/team?tab=join-requests` | `team.view` | `search`, `selectedDept`, Add Member (`fullname`, `email`, `password`, `role`, `departmentId`, `jobTitle`), Edit Member (`editRole`, `editDeptId`, `editJobTitle`, `editStatus`), Join Approval/Decline fields | `Add Member` (`[data-ai-target="add-member-btn"]`), `Save Changes` (`[data-ai-target="save-member-btn"]`), `Approve & Grant Access` (`[data-ai-target="join-approve-btn"]`), `Decline`, `DM`, `Deactivate` |
| `/roles`, `/roles?tab=departments`, `/roles?tab=ai` | `rbac.view` / `ai.manage` | Role Editor (`roleDisplayName` `[data-ai-target="role-name-input"]`, `roleKey`, `roleDeptId`, `roleDescription`, `roleIsDefault` checkbox, `[data-ai-target="role-modules-box"]`), Dept Drawer, AI Provider config & Global Key Grants (`targetType`, `targetSearch`, `provider`, `note`, module pills) | `Create Dynamic Role` (`[data-ai-target="new-role-btn"]`), `Save Role & Modules` (`[data-ai-target="save-role-btn"]`), `Configure Modules`, `Delete Role`, `Grant Global Key Access` (`[data-ai-target="grant-ai-submit-btn"]`) |
| `/audit` | `audit.view` | `search`, `statusFilter`, `actionFilter`, `aiSearch`, `aiProviderFilter`, `aiScopeFilter`, `aiStatusFilter` | `User Action Trail`, `AI Key Usage`, `Online Users`, `Teams & Workspaces`, `Mutations Only` |
| `/profile`, `/profile?tab=ai` | Authenticated / `ai.use` | `fullname`, `phone`, `jobTitle`, `status`, `bio`, password fields, Personal BYOK key manager | `Save Profile Changes` (`[data-ai-target="save-profile-btn"]`), `Change Photo`, `AI Keys & Vault Access` tab |

## 2. Copilot Modes

- **Auto Mode (`mode: "auto"`)**: Executes actions immediately via authenticated internal REST calls (`/v3/...`) with `x-copilot-actor: "true"`, writing full `ActionLog` audits and broadcasting updates to all online browsers over Socket.IO. Ambiguous queries or interactive pickers (such as multi-match roles, multi-match users, or role module checkboxes) return `status: "clarify"` with theme-adaptive `DOMPurify`-sanitized HTML interactive cards.
- **Review Mode (`mode: "review"`)**: Closes Copilot, navigates to the exact screen, plays the animated Copilot Cursor across real DOM controls (`[data-ai-target=...]`), opens the drawer/modal, pre-fills form fields via `aiPrefillDraft`, and stops at the confirmation button for human sign-off.

## 3. Complete Backend Action & Request Body Reference

- `create_task` -> `POST /v3/tasks` (`tasks.create`): `{ projectId, title, description, type, priority, dueDate, assignees, assignedDepartments, subtasks }`
- `update_task` / `assign_task` -> `PUT /v3/tasks/:id` (`tasks.edit`, `tasks.assign`): `{ title?, description?, priority?, status?, dueDate?, assignees?, assignedDepartments? }`
- `update_task_status` -> `PATCH /v3/tasks/:id/status` (`tasks.edit`): `{ status }`
- `submit_task_review` -> `POST /v3/tasks/:id/submit-for-review` (`tasks.review`): `{}`
- `approve_task` -> `POST /v3/tasks/:id/approve` (`tasks.approve`): `{}`
- `redo_task` -> `POST /v3/tasks/:id/redo` (`tasks.approve`): `{ reason }`
- `add_subtask` -> `POST /v3/tasks/:id/subtasks` (`tasks.edit`): `{ title }`
- `toggle_subtask` -> `PATCH /v3/tasks/:id/subtasks/:subId/toggle` (`tasks.edit`): `{}`
- `add_task_comment` -> `POST /v3/comments/:taskId` (`protect`): `{ text }`
- `add_worklog` -> `POST /v3/tasks/:id/worklog` (`tasks.edit`): `{ hours, note }`
- `bulk_update_tasks` -> `POST /v3/tasks/bulk-update` (`tasks.edit`): `{ taskIds, status?, priority? }`
- `delete_task` -> `DELETE /v3/tasks/:id` (`tasks.delete`)
- `create_request` -> `POST /v3/requests` (`requests.create`): `{ title, requestType, description, targetDepartmentId, targetProjectId?, amount?, priority? }`
- `approve_request` / `reject_request` -> `POST /v3/requests/:id/approve|reject` (`requests.approve`): `{ note }`
- `create_project` -> `POST /v3/projects` (`projects.create`): `{ name, prefix, description?, department? }`
- `update_project` -> `PUT /v3/projects/:id` (`projects.edit`): `{ name?, description?, status? }`
- `delete_project` -> `DELETE /v3/projects/:id` (`projects.delete`)
- `add_project_member` / `remove_project_member` -> `POST|DELETE /v3/projects/:id/members` (`projects.members`): `{ userId }`
- `invoke_project_department` / `remove_project_department` -> `POST|DELETE /v3/projects/:id/departments` (`projects.members`): `{ departmentId }`
- `add_project_url` -> `POST /v3/projects/:id/urls` (`projects.urls`): `{ label, url }`
- `create_department` / `update_department` / `delete_department` -> `POST|PUT|DELETE /v3/departments` (`departments.*`)
- `add_department_member` / `remove_department_member` -> `POST|DELETE /v3/departments/:id/members` (`departments.edit`): `{ userId }`
- `create_user` / `update_user` / `delete_user` -> `POST|PUT|DELETE /v3/users` (`team.create|edit|delete`)
- `update_user_role` -> `PUT /v3/roles/assign/:userId` (`team.edit`, `rbac.manage`): `{ role }`
- `approve_join_request` / `reject_join_request` -> `PUT /v3/users/join-requests/:id/approve|reject` (`team.join_requests`)
- `remove_non_superadmins` -> `POST /v3/users/bulk-remove-non-superadmins` (`requireSuperAdmin`)
- `create_role` -> `POST /v3/roles` (`requireSuperAdmin`): `{ name, displayName, description?, modules, permissions, isDefault? }`
- `update_role` -> `PUT /v3/roles/:id` (`requireSuperAdmin`): `{ displayName?, description?, modules?, permissions?, isDefault? }`
- `delete_role` -> `DELETE /v3/roles/:id` (`requireSuperAdmin`)
- `grant_ai_access` / `revoke_ai_access` / `restore_ai_access` / `delete_ai_grant` / `update_ai_config` -> `/v3/ai/grants*`, `/v3/ai/config/:provider` (`ai.manage`)
- `send_project_chat` / `send_dm` -> `POST /v3/chat/messages` (`chat.send`): E2EE `{ chatType, roomId, recipientId?, encryptedPayload, iv, salt, keyId }`
- `toggle_pin_chat_message` -> `PATCH /v3/chat/messages/:id/pin` (`chat.pin`)
- `mark_notifications_read` -> `POST /v3/notifications/read-all` (`protect`)
- `update_profile` -> `PUT /v3/profile/info` (`protect`): `{ fullname?, phone?, jobTitle?, status?, bio? }`

