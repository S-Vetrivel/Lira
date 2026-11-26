const crypto = require("crypto");
const mongoose = require("mongoose");
const Project = require("../models/projectModel");
const Department = require("../models/departmentModel");
const User = require("../models/userModel");
const Task = require("../models/taskModel");
const Request = require("../models/requestModel");
const Role = require("../models/roleModel");
const { isSuperAdminUser } = require("../utils/roles");
const { getChatE2eeSecret, escapeRegex } = require("../utils/envSecrets");
const { callProtectedBackendAPI } = require("./internalExpressCaller");
const { assertSafeWebUrl } = require("./copilotSecurity");
const { expandModulesToPermissions } = require("./copilotContext");
const {
  normalizeTaskType,
  normalizeTaskPriority,
  normalizeTaskStatus,
  normalizeRequestType,
  resolveDepartmentObjectIds,
  resolveDepartmentDoc,
  resolveProjectObjectId,
  resolveUserObjectIds,
} = require("../utils/entityResolvers");

/**
 * Encrypt plaintext into the WebCrypto-compatible AES-GCM-256 format used by Office & Project Chat.
 */
function encryptChatTextServer(plainText, secret = getChatE2eeSecret()) {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = crypto.pbkdf2Sync(secret, salt, 100000, 32, "sha256");
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(String(plainText), "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const combined = Buffer.concat([encrypted, authTag]);
  return {
    ciphertext: combined.toString("base64"),
    iv: iv.toString("base64"),
    salt: salt.toString("base64"),
  };
}

async function sendChatMessageServer({ senderUser, chatType, roomId, recipientId = null, messageText }) {
  const encrypted = encryptChatTextServer(messageText);
  const res = await callProtectedBackendAPI({
    user: senderUser,
    method: "POST",
    path: "/chat/messages",
    data: {
      chatType,
      roomId,
      recipientId: recipientId || undefined,
      encryptedPayload: encrypted.ciphertext,
      iv: encrypted.iv,
      salt: encrypted.salt,
      keyId: "lira-aes-gcm-256",
    },
  });
  return res.message;
}

/**
 * Execute a single permitted workspace step via in-process RBAC-protected Express handlers,
 * returning execution summary and inverse undo operation where reversible.
 */
async function executeSingleStep(step, user, chainState = {}) {
  if (!step || !step.type || step.type === "navigate" || step.type === "open_task") {
    return { executed: false, type: step?.type || "navigate", navigateTo: step?.navigateTo || null };
  }

  const rawPrefill = step.prefill || {};
  const interpolate = (val) => {
    if (typeof val !== "string") return val;
    return val
      .replace(/\{\{taskKey\}\}/g, chainState.taskKey || "")
      .replace(/\{\{taskTitle\}\}/g, chainState.taskTitle || "");
  };

  const resolveTargetTask = async (fields = "_id key title") => {
    const keyOrId = rawPrefill.taskId || rawPrefill.taskKey || chainState.taskKey;
    const str = String(keyOrId || "").trim();
    const t =
      str && mongoose.isValidObjectId(str)
        ? await Task.findById(str).select(fields).lean()
        : await Task.findOne({ key: str.toUpperCase() }).select(fields).lean();
    if (!t) throw new Error(`Task ${keyOrId || ""} not found`);
    return t;
  };

  if (step.type === "create_task") {
    const accessFilter = isSuperAdminUser(user) ? { status: { $ne: "archived" } } : { members: user._id };
    const rawProjInput = rawPrefill.projectId || rawPrefill.project || rawPrefill.projectPrefix || rawPrefill.projectName;

    let projectId = rawProjInput ? await resolveProjectObjectId(rawProjInput, accessFilter) : null;
    if (!projectId && chainState.projectId) {
      projectId = chainState.projectId;
    }
    if (!projectId) {
      const firstProj = await Project.findOne(accessFilter)
        .select("_id")
        .sort({ createdAt: -1 })
        .lean();
      projectId = firstProj?._id ? String(firstProj._id) : "";
    }
    if (!projectId) throw new Error("No workspace project available to create task");

    const [resolvedAssignees, resolvedDepts] = await Promise.all([
      resolveUserObjectIds(Array.isArray(rawPrefill.assignees) ? rawPrefill.assignees : []),
      resolveDepartmentObjectIds(Array.isArray(rawPrefill.assignedDepartments) ? rawPrefill.assignedDepartments : []),
    ]);

    const res = await callProtectedBackendAPI({
      user,
      method: "POST",
      path: "/tasks",
      data: {
        projectId: String(projectId),
        project: String(projectId),
        title: interpolate(rawPrefill.title) || "Workspace Task",
        description: interpolate(rawPrefill.description) || "",
        type: normalizeTaskType(rawPrefill.type),
        priority: normalizeTaskPriority(rawPrefill.priority),
        dueDate: rawPrefill.dueDate || undefined,
        assignees: resolvedAssignees,
        assignedDepartments: resolvedDepts,
        subtasks: Array.isArray(rawPrefill.subtasks)
          ? rawPrefill.subtasks.map((s) => ({ title: typeof s === "string" ? s : s.title }))
          : [],
      },
    });
    chainState.taskKey = res.task?.key || "";
    chainState.taskId = res.task?._id ? String(res.task._id) : "";
    chainState.taskTitle = res.task?.title || rawPrefill.title || "";
    chainState.projectId = String(projectId);
    return {
      executed: true,
      actionType: "create_task",
      summary: `Created task ${res.task?.key || ""}: "${res.task?.title || rawPrefill.title}"`,
      taskKey: chainState.taskKey,
      taskId: chainState.taskId,
      undoStep: chainState.taskId
        ? { type: "delete_task", label: `Undo: Delete ${chainState.taskKey}`, prefill: { taskId: chainState.taskId, taskKey: chainState.taskKey } }
        : null,
    };
  }

  if (step.type === "send_project_chat") {
    const targetProjId = rawPrefill.projectId || chainState.projectId;
    const roomId = rawPrefill.roomId || (targetProjId ? `project_${targetProjId}` : "dept_general");
    const chatType = roomId.startsWith("dm_") ? "direct" : "department";
    const msgText = interpolate(rawPrefill.message) || `Update: ${chainState.taskKey || ""} ${chainState.taskTitle || ""}`.trim();
    await sendChatMessageServer({ senderUser: user, chatType, roomId, messageText: msgText });
    return {
      executed: true,
      actionType: "send_project_chat",
      summary: `Posted chat message to ${roomId.startsWith("project_") ? "project channel" : roomId}`,
      roomId,
    };
  }

  if (step.type === "send_dm") {
    const resolvedRecipients = await resolveUserObjectIds([rawPrefill.recipientId || rawPrefill.userId || rawPrefill.recipient]);
    const rid = resolvedRecipients[0];
    if (!rid) throw new Error("Recipient missing for DM step");
    const recipientUser = await User.findById(rid).select("fullname").lean();
    if (!recipientUser) throw new Error("Target recipient user not found");
    const sorted = [String(user._id), String(rid)].sort();
    const roomId = `dm_${sorted[0]}_${sorted[1]}`;
    const msgText =
      interpolate(rawPrefill.message) ||
      `Hi ${recipientUser.fullname}, ${chainState.taskKey ? `assigned task ${chainState.taskKey} (${chainState.taskTitle}) to you.` : "please check this workspace update."}`;
    await sendChatMessageServer({ senderUser: user, chatType: "direct", roomId, recipientId: rid, messageText: msgText });
    return {
      executed: true,
      actionType: "send_dm",
      summary: `Sent DM to ${recipientUser.fullname}`,
      roomId,
    };
  }

  if (step.type === "update_task_status") {
    const targetTask = await resolveTargetTask("_id key status");
    const prevStatus = targetTask.status;
    const nextStatus = normalizeTaskStatus(rawPrefill.status || "in_progress");
    await callProtectedBackendAPI({
      user,
      method: "PATCH",
      path: `/tasks/${targetTask._id}/status`,
      data: { status: nextStatus },
    });
    return {
      executed: true,
      actionType: "update_task_status",
      summary: `Moved ${targetTask.key} to ${nextStatus}`,
      taskKey: targetTask.key,
      taskId: String(targetTask._id),
      undoStep: {
        type: "update_task_status",
        label: `Undo: Revert ${targetTask.key} status to ${prevStatus}`,
        prefill: { taskId: String(targetTask._id), taskKey: targetTask.key, status: prevStatus },
      },
    };
  }

  if (step.type === "create_request") {
    const rawDept = rawPrefill.targetDepartment || rawPrefill.targetDepartmentId || null;
    const rawProj = rawPrefill.targetProject || rawPrefill.targetProjectId || null;
    const [resolvedDepts, resolvedProjId] = await Promise.all([
      rawDept ? resolveDepartmentObjectIds([rawDept]) : Promise.resolve([]),
      rawProj ? resolveProjectObjectId(rawProj) : Promise.resolve(null),
    ]);
    const res = await callProtectedBackendAPI({
      user,
      method: "POST",
      path: "/requests",
      data: {
        title: interpolate(rawPrefill.title) || "Workspace Request",
        requestType: normalizeRequestType(rawPrefill.requestType),
        description: interpolate(rawPrefill.description) || "",
        targetDepartmentId: resolvedDepts[0] || null,
        targetProjectId: resolvedProjId || null,
        amount: rawPrefill.amount ? Number(rawPrefill.amount) : undefined,
        priority: normalizeTaskPriority(rawPrefill.urgency || rawPrefill.priority),
      },
    });
    return {
      executed: true,
      actionType: "create_request",
      summary: `Submitted request "${res.request?.title || rawPrefill.title}"`,
    };
  }

  if (step.type === "create_department") {
    const res = await callProtectedBackendAPI({
      user,
      method: "POST",
      path: "/departments",
      data: {
        name: rawPrefill.name,
        code: rawPrefill.code || String(rawPrefill.name || "DEP").slice(0, 4).toUpperCase(),
        description: rawPrefill.description || "",
        color: rawPrefill.color || "#6366f1",
      },
    });
    const deptId = res.department?._id ? String(res.department._id) : "";
    return {
      executed: true,
      actionType: "create_department",
      summary: `Created department "${res.department?.name || rawPrefill.name}"`,
      undoStep: deptId
        ? { type: "delete_department", label: `Undo: Delete department "${res.department?.name || rawPrefill.name}"`, prefill: { departmentId: deptId } }
        : null,
    };
  }

  if (step.type === "create_project") {
    const res = await callProtectedBackendAPI({
      user,
      method: "POST",
      path: "/projects",
      data: {
        name: rawPrefill.name,
        prefix: (rawPrefill.prefix || String(rawPrefill.name || "PRJ").slice(0, 4)).toUpperCase(),
        description: rawPrefill.description || "",
        department: rawPrefill.department || null,
      },
    });
    const createdProjId = res.project?._id ? String(res.project._id) : "";
    if (createdProjId) chainState.projectId = createdProjId;
    return {
      executed: true,
      actionType: "create_project",
      summary: `Created workspace "${res.project?.name || rawPrefill.name}" [${res.project?.prefix || ""}]`,
      undoStep: createdProjId
        ? { type: "delete_project", label: `Undo: Delete workspace "${res.project?.name || rawPrefill.name}"`, prefill: { projectId: createdProjId } }
        : null,
    };
  }

  if (step.type === "grant_ai_access") {
    const res = await callProtectedBackendAPI({
      user,
      method: "POST",
      path: "/ai/grants",
      data: {
        targetType: rawPrefill.targetType || "user",
        targetId: rawPrefill.targetId,
        targetName: rawPrefill.targetName || "Granted User",
        provider: rawPrefill.provider || "all",
        allowedModules: Array.isArray(rawPrefill.allowedModules) ? rawPrefill.allowedModules : ["*"],
        note: rawPrefill.note || "Granted via Lira Copilot",
      },
    });
    const gid = res.grant?._id ? String(res.grant._id) : "";
    return {
      executed: true,
      actionType: "grant_ai_access",
      summary: `Granted AI key access to ${res.grant?.targetName || rawPrefill.targetName || "user"}`,
      undoStep: gid ? { type: "delete_ai_grant", label: "Undo: Delete AI grant", prefill: { grantId: gid } } : null,
    };
  }

  if (step.type === "revoke_ai_access") {
    if (!rawPrefill.grantId) throw new Error("grantId is required to revoke access");
    const res = await callProtectedBackendAPI({
      user,
      method: "PUT",
      path: `/ai/grants/${rawPrefill.grantId}/revoke`,
    });
    return {
      executed: true,
      actionType: "revoke_ai_access",
      summary: `Revoked AI access for ${res.grant?.targetName || rawPrefill.grantId}`,
      undoStep: { type: "restore_ai_access", label: "Undo: Restore AI access", prefill: { grantId: rawPrefill.grantId } },
    };
  }

  if (step.type === "delete_task") {
    const bulkIds = Array.isArray(rawPrefill.taskIds)
      ? rawPrefill.taskIds
      : Array.isArray(rawPrefill.selectedIds)
      ? rawPrefill.selectedIds
      : null;
    if (bulkIds && bulkIds.length > 0) {
      const deletedKeys = [];
      for (const idOrKey of bulkIds) {
        const t = /^[a-f0-9]{24}$/i.test(String(idOrKey))
          ? await Task.findById(idOrKey).select("_id key").lean()
          : await Task.findOne({ key: String(idOrKey).toUpperCase() }).select("_id key").lean();
        if (t) {
          await callProtectedBackendAPI({ user, method: "DELETE", path: `/tasks/${t._id}` });
          deletedKeys.push(t.key);
        }
      }
      if (deletedKeys.length === 0) throw new Error("No matching tasks found to delete");
      return { executed: true, actionType: "delete_task", summary: `Deleted ${deletedKeys.length} task(s): ${deletedKeys.join(", ")}` };
    }
    const t = await resolveTargetTask("_id key");
    await callProtectedBackendAPI({ user, method: "DELETE", path: `/tasks/${t._id}` });
    return { executed: true, actionType: "delete_task", summary: `Deleted task ${t.key}` };
  }

  if (step.type === "approve_request" || step.type === "reject_request") {
    const safeTitlePattern = escapeRegex(String(rawPrefill.title || "").slice(0, 60));
    const reqRef = String(rawPrefill.requestId || "").trim();
    const targetReq =
      reqRef && mongoose.isValidObjectId(reqRef)
        ? await Request.findById(reqRef).select("_id title").lean()
        : reqRef
        ? await Request.findOne({ requestCode: reqRef.toUpperCase() }).select("_id title").lean()
        : safeTitlePattern
        ? await Request.findOne({ title: new RegExp(safeTitlePattern, "i") }).select("_id title").lean()
        : null;
    if (!targetReq) throw new Error("Target request not found");
    const endpoint = step.type === "approve_request" ? "approve" : "reject";
    await callProtectedBackendAPI({
      user,
      method: "POST",
      path: `/requests/${targetReq._id}/${endpoint}`,
      data: { note: rawPrefill.note || "Processed via Lira Copilot", reason: rawPrefill.note || "Processed via Lira Copilot" },
    });
    return {
      executed: true,
      actionType: step.type,
      summary: `${step.type === "approve_request" ? "Approved" : "Rejected"} request "${targetReq.title}"`,
    };
  }

  if (step.type === "delete_project") {
    const bulkIds = Array.isArray(rawPrefill.projectIds)
      ? rawPrefill.projectIds
      : Array.isArray(rawPrefill.selectedIds)
      ? rawPrefill.selectedIds
      : null;
    if (bulkIds && bulkIds.length > 0) {
      const deletedNames = [];
      for (const pid of bulkIds) {
        const resolvedId = await resolveProjectObjectId(pid, {});
        const p = resolvedId ? await Project.findById(resolvedId).select("_id name").lean() : null;
        if (p) {
          await callProtectedBackendAPI({ user, method: "DELETE", path: `/projects/${p._id}` });
          deletedNames.push(p.name);
        }
      }
      if (deletedNames.length === 0) throw new Error("No matching projects found to delete");
      return { executed: true, actionType: "delete_project", summary: `Deleted ${deletedNames.length} workspace(s): ${deletedNames.join(", ")}` };
    }
    const resolvedProjId = await resolveProjectObjectId(rawPrefill.projectId || rawPrefill.prefix || rawPrefill.name, {});
    const p = resolvedProjId ? await Project.findById(resolvedProjId).select("_id name").lean() : null;
    if (!p) throw new Error("Project not found");
    await callProtectedBackendAPI({ user, method: "DELETE", path: `/projects/${p._id}` });
    return { executed: true, actionType: "delete_project", summary: `Deleted workspace "${p.name}"` };
  }

  if (step.type === "delete_department") {
    const bulkIds = Array.isArray(rawPrefill.departmentIds)
      ? rawPrefill.departmentIds
      : Array.isArray(rawPrefill.selectedIds)
      ? rawPrefill.selectedIds
      : null;
    if (bulkIds && bulkIds.length > 0) {
      const deletedNames = [];
      for (const did of bulkIds) {
        const d = await resolveDepartmentDoc(did, "_id name");
        if (d) {
          await callProtectedBackendAPI({ user, method: "DELETE", path: `/departments/${d._id}` });
          deletedNames.push(d.name);
        }
      }
      if (deletedNames.length === 0) throw new Error("No matching departments found to delete");
      return { executed: true, actionType: "delete_department", summary: `Deleted ${deletedNames.length} department(s): ${deletedNames.join(", ")}` };
    }
    const d = await resolveDepartmentDoc(rawPrefill.departmentId || rawPrefill.code || rawPrefill.name, "_id name");
    if (!d) throw new Error("Department not found");
    await callProtectedBackendAPI({ user, method: "DELETE", path: `/departments/${d._id}` });
    return { executed: true, actionType: "delete_department", summary: `Deleted department "${d.name}"` };
  }

  if (step.type === "create_role") {
    const { modules: modList, permissions: permList } = expandModulesToPermissions(
      Array.isArray(rawPrefill.modules) && rawPrefill.modules.length > 0 ? rawPrefill.modules : ["dashboard"]
    );
    const finalPerms =
      Array.isArray(rawPrefill.permissions) && rawPrefill.permissions.length > 0
        ? rawPrefill.permissions
        : permList.length > 0
        ? permList
        : ["dashboard.view"];
    const res = await callProtectedBackendAPI({
      user,
      method: "POST",
      path: "/roles",
      data: {
        name: rawPrefill.name,
        displayName: rawPrefill.displayName || rawPrefill.name,
        description: rawPrefill.description || "Created via Lira Copilot",
        modules: modList.length > 0 ? modList : ["dashboard"],
        permissions: finalPerms,
        isDefault: Boolean(rawPrefill.isDefault),
      },
    });
    const createdRoleId = res.role?._id ? String(res.role._id) : "";
    if (createdRoleId) chainState.roleId = createdRoleId;
    if (res.role?.name) chainState.roleName = res.role.name;
    return {
      executed: true,
      actionType: "create_role",
      role: res.role || null,
      summary: `Created role "${res.role?.displayName || rawPrefill.displayName || rawPrefill.name}"${res.role?.isDefault ? " (default)" : ""}`,
      undoStep: createdRoleId
        ? { type: "delete_role", label: `Undo: Delete role "${res.role?.displayName || rawPrefill.name}"`, prefill: { roleId: createdRoleId } }
        : null,
    };
  }

  if (step.type === "update_role") {
    const rawName = String(rawPrefill.name || rawPrefill.roleName || "").trim();
    const cleanSlug = rawName.toLowerCase().replace(/[^a-z0-9_]+/g, "_");
    const safeDisplayRx = rawName ? new RegExp(`^${escapeRegex(rawName)}$`, "i") : null;
    const targetRole =
      rawPrefill.roleId && mongoose.isValidObjectId(String(rawPrefill.roleId))
        ? await Role.findById(rawPrefill.roleId).select("_id displayName name description modules permissions isDefault").lean()
        : await Role.findOne({
            $or: [
              { name: cleanSlug },
              { name: rawName.toLowerCase() },
              ...(safeDisplayRx ? [{ displayName: safeDisplayRx }] : []),
            ],
          })
            .select("_id displayName name description modules permissions isDefault")
            .lean();
    if (!targetRole) throw new Error(`Role "${rawName || rawPrefill.roleId || "unknown"}" not found`);

    const prevSnapshot = {
      roleId: String(targetRole._id),
      displayName: targetRole.displayName,
      description: targetRole.description,
      modules: targetRole.modules || [],
      permissions: targetRole.permissions || [],
      isDefault: Boolean(targetRole.isDefault),
    };

    const updatePayload = {};
    if (rawPrefill.displayName) updatePayload.displayName = rawPrefill.displayName;
    if (rawPrefill.description !== undefined) updatePayload.description = rawPrefill.description;
    if (typeof rawPrefill.isDefault === "boolean") updatePayload.isDefault = rawPrefill.isDefault;
    if (Array.isArray(rawPrefill.modules)) {
      const { modules, permissions } = expandModulesToPermissions(rawPrefill.modules);
      updatePayload.modules = modules;
      updatePayload.permissions =
        Array.isArray(rawPrefill.permissions) && rawPrefill.permissions.length > 0 ? rawPrefill.permissions : permissions;
    }

    const res = await callProtectedBackendAPI({
      user,
      method: "PUT",
      path: `/roles/${targetRole._id}`,
      data: updatePayload,
    });
    return {
      executed: true,
      actionType: "update_role",
      role: res.role || null,
      summary: `Updated role "${res.role?.displayName || targetRole.displayName}" (${(res.role?.modules || updatePayload.modules || []).length} modules)`,
      undoStep: {
        type: "update_role",
        label: `Undo: Revert role "${targetRole.displayName}"`,
        prefill: prevSnapshot,
      },
    };
  }

  if (step.type === "delete_role") {
    const bulkIds = Array.isArray(rawPrefill.roleIds)
      ? rawPrefill.roleIds
      : Array.isArray(rawPrefill.selectedIds)
      ? rawPrefill.selectedIds
      : null;
    if (bulkIds && bulkIds.length > 0) {
      const deletedNames = [];
      for (const rid of bulkIds) {
        const r = await Role.findById(rid).select("_id displayName name").lean();
        if (r) {
          await callProtectedBackendAPI({ user, method: "DELETE", path: `/roles/${r._id}` });
          deletedNames.push(r.displayName || r.name);
        }
      }
      if (deletedNames.length === 0) throw new Error("No matching roles found to delete");
      return { executed: true, actionType: "delete_role", summary: `Deleted ${deletedNames.length} role(s): ${deletedNames.join(", ")}` };
    }
    const targetRole =
      rawPrefill.roleId && mongoose.isValidObjectId(String(rawPrefill.roleId))
        ? await Role.findById(rawPrefill.roleId).select("_id displayName name").lean()
        : await Role.findOne({ name: String(rawPrefill.name || rawPrefill.roleId || "").toLowerCase() })
            .select("_id displayName name")
            .lean();
    if (!targetRole) throw new Error("Role not found");
    await callProtectedBackendAPI({ user, method: "DELETE", path: `/roles/${targetRole._id}` });
    return {
      executed: true,
      actionType: "delete_role",
      summary: `Deleted role "${targetRole.displayName || targetRole.name}"`,
    };
  }

  if (step.type === "delete_user") {
    const rawIds = Array.isArray(rawPrefill.userIds)
      ? rawPrefill.userIds
      : Array.isArray(rawPrefill.selectedIds)
      ? rawPrefill.selectedIds
      : rawPrefill.userId
      ? [rawPrefill.userId]
      : [];
    const resolvedUserIds = await resolveUserObjectIds(rawIds);
    const targetIds = resolvedUserIds.map(String).filter((id) => id && id !== String(user._id));
    if (targetIds.length === 0) {
      throw new Error("Cannot remove self or missing userId");
    }
    const removedNames = [];
    for (const targetId of targetIds) {
      const targetU = await User.findById(targetId).select("fullname email").lean();
      await callProtectedBackendAPI({ user, method: "DELETE", path: `/users/${targetId}` });
      removedNames.push(targetU?.fullname || targetU?.email || targetId);
    }
    return {
      executed: true,
      actionType: "delete_user",
      summary:
        removedNames.length === 1
          ? `Removed user ${removedNames[0]}`
          : `Removed ${removedNames.length} user(s): ${removedNames.join(", ")}`,
    };
  }

  if (step.type === "remove_non_superadmins") {
    if (!isSuperAdminUser(user)) {
      throw new Error("Only Superadmin may remove all non-Superadmin accounts");
    }
    const res = await callProtectedBackendAPI({
      user,
      method: "POST",
      path: "/users/bulk-remove-non-superadmins",
    });
    return {
      executed: true,
      actionType: "remove_non_superadmins",
      summary: res.message || `Removed ${res.deletedCount || 0} non-Superadmin user accounts`,
    };
  }

  if (step.type === "update_task" || step.type === "assign_task") {
    const t = await resolveTargetTask("_id key title description priority type status dueDate estimatedHours assignees assignedDepartments");
    const patch = {};
    const prevSnapshot = { taskId: String(t._id), taskKey: t.key };
    ["title", "description", "priority", "type", "status", "dueDate", "estimatedHours"].forEach((k) => {
      if (rawPrefill[k] !== undefined && rawPrefill[k] !== "") {
        let val = rawPrefill[k];
        if (k === "priority") val = normalizeTaskPriority(val);
        else if (k === "type") val = normalizeTaskType(val);
        else if (k === "status") val = normalizeTaskStatus(val);
        patch[k] = val;
        if (t[k] !== undefined) prevSnapshot[k] = t[k];
      }
    });
    if (Array.isArray(rawPrefill.assignees)) {
      patch.assignees = await resolveUserObjectIds(rawPrefill.assignees);
      prevSnapshot.assignees = t.assignees || [];
    }
    if (Array.isArray(rawPrefill.assignedDepartments)) {
      patch.assignedDepartments = await resolveDepartmentObjectIds(rawPrefill.assignedDepartments);
      prevSnapshot.assignedDepartments = t.assignedDepartments || [];
    }
    await callProtectedBackendAPI({ user, method: "PUT", path: `/tasks/${t._id}`, data: patch });
    return {
      executed: true,
      actionType: step.type,
      taskKey: t.key,
      taskId: String(t._id),
      summary: `Updated task ${t.key}`,
      undoStep: {
        type: "update_task",
        label: `Undo: Revert updates on ${t.key}`,
        prefill: prevSnapshot,
      },
    };
  }

  if (step.type === "submit_task_review") {
    const t = await resolveTargetTask();
    await callProtectedBackendAPI({ user, method: "POST", path: `/tasks/${t._id}/submit-for-review` });
    return { executed: true, actionType: step.type, taskKey: t.key, taskId: String(t._id), summary: `Submitted ${t.key} for review` };
  }

  if (step.type === "approve_task") {
    const t = await resolveTargetTask();
    await callProtectedBackendAPI({ user, method: "POST", path: `/tasks/${t._id}/approve` });
    return { executed: true, actionType: step.type, taskKey: t.key, taskId: String(t._id), summary: `Approved task ${t.key}` };
  }

  if (step.type === "redo_task") {
    const t = await resolveTargetTask();
    await callProtectedBackendAPI({
      user,
      method: "POST",
      path: `/tasks/${t._id}/redo`,
      data: { reason: rawPrefill.reason || rawPrefill.note || "Revision requested via Lira Copilot" },
    });
    return { executed: true, actionType: step.type, taskKey: t.key, taskId: String(t._id), summary: `Requested revision on ${t.key}` };
  }

  if (step.type === "add_subtask") {
    const t = await resolveTargetTask();
    await callProtectedBackendAPI({
      user,
      method: "POST",
      path: `/tasks/${t._id}/subtasks`,
      data: { title: rawPrefill.title || rawPrefill.subtaskTitle || "Action checklist item" },
    });
    return { executed: true, actionType: step.type, taskKey: t.key, taskId: String(t._id), summary: `Added subtask to ${t.key}` };
  }

  if (step.type === "toggle_subtask" && rawPrefill.subtaskId) {
    const t = await resolveTargetTask();
    await callProtectedBackendAPI({ user, method: "PATCH", path: `/tasks/${t._id}/subtasks/${rawPrefill.subtaskId}/toggle` });
    return {
      executed: true,
      actionType: step.type,
      taskKey: t.key,
      taskId: String(t._id),
      summary: `Toggled subtask on ${t.key}`,
      undoStep: { type: "toggle_subtask", label: `Undo: Toggle subtask on ${t.key}`, prefill: { taskId: String(t._id), subtaskId: rawPrefill.subtaskId } },
    };
  }

  if (step.type === "add_task_comment") {
    const t = await resolveTargetTask();
    await callProtectedBackendAPI({
      user,
      method: "POST",
      path: `/comments/${t._id}`,
      data: { text: rawPrefill.text || rawPrefill.comment || rawPrefill.content || "Updated via Lira Copilot" },
    });
    return { executed: true, actionType: step.type, taskKey: t.key, taskId: String(t._id), summary: `Commented on ${t.key}` };
  }

  if (step.type === "add_worklog") {
    const t = await resolveTargetTask();
    await callProtectedBackendAPI({
      user,
      method: "POST",
      path: `/tasks/${t._id}/worklog`,
      data: { hours: Number(rawPrefill.hours || 1), note: rawPrefill.note || "Logged via Lira Copilot" },
    });
    return { executed: true, actionType: step.type, taskKey: t.key, taskId: String(t._id), summary: `Logged ${rawPrefill.hours || 1}h on ${t.key}` };
  }

  if (step.type === "bulk_update_tasks" && Array.isArray(rawPrefill.taskIds)) {
    await callProtectedBackendAPI({
      user,
      method: "POST",
      path: "/tasks/bulk-update",
      data: { taskIds: rawPrefill.taskIds, status: rawPrefill.status, priority: rawPrefill.priority },
    });
    return { executed: true, actionType: step.type, summary: `Updated ${rawPrefill.taskIds.length} tasks` };
  }

  if (step.type === "update_project") {
    const resolvedProjId = await resolveProjectObjectId(rawPrefill.projectId || rawPrefill.prefix || rawPrefill.name, {});
    const p = resolvedProjId ? await Project.findById(resolvedProjId).select("_id name description status").lean() : null;
    if (!p) throw new Error("Project not found");
    const res = await callProtectedBackendAPI({
      user,
      method: "PUT",
      path: `/projects/${p._id}`,
      data: {
        ...(rawPrefill.newName || rawPrefill.name ? { name: rawPrefill.newName || rawPrefill.name } : {}),
        ...(rawPrefill.description !== undefined ? { description: rawPrefill.description } : {}),
        ...(rawPrefill.status ? { status: rawPrefill.status } : {}),
      },
    });
    return {
      executed: true,
      actionType: step.type,
      summary: `Updated project "${res.project?.name || p.name}"`,
      undoStep: {
        type: "update_project",
        label: `Undo: Revert "${p.name}"`,
        prefill: { projectId: String(p._id), newName: p.name, description: p.description, status: p.status },
      },
    };
  }

  if (step.type === "add_project_member" || step.type === "remove_project_member") {
    const projId = (await resolveProjectObjectId(rawPrefill.projectId || rawPrefill.prefix || rawPrefill.name)) || chainState.projectId;
    const uid = (await resolveUserObjectIds([rawPrefill.userId || rawPrefill.user || rawPrefill.email]))[0];
    if (!projId || !uid) throw new Error("projectId and userId are required");
    if (step.type === "add_project_member") {
      await callProtectedBackendAPI({ user, method: "POST", path: `/projects/${projId}/members`, data: { userId: uid } });
    } else {
      await callProtectedBackendAPI({ user, method: "DELETE", path: `/projects/${projId}/members/${uid}` });
    }
    return {
      executed: true,
      actionType: step.type,
      summary: `${step.type === "add_project_member" ? "Added" : "Removed"} project member`,
      undoStep: {
        type: step.type === "add_project_member" ? "remove_project_member" : "add_project_member",
        label: "Undo: Revert project membership",
        prefill: { projectId: projId, userId: uid },
      },
    };
  }

  if (step.type === "invoke_project_department" || step.type === "remove_project_department") {
    const projId = (await resolveProjectObjectId(rawPrefill.projectId || rawPrefill.prefix || rawPrefill.name)) || chainState.projectId;
    const deptId = (await resolveDepartmentObjectIds([rawPrefill.departmentId || rawPrefill.department]))[0];
    if (!projId || !deptId) throw new Error("projectId and departmentId are required");
    if (step.type === "invoke_project_department") {
      await callProtectedBackendAPI({ user, method: "POST", path: `/projects/${projId}/departments`, data: { departmentId: deptId } });
    } else {
      await callProtectedBackendAPI({ user, method: "DELETE", path: `/projects/${projId}/departments/${deptId}` });
    }
    return {
      executed: true,
      actionType: step.type,
      summary: "Updated project departments",
      undoStep: {
        type: step.type === "invoke_project_department" ? "remove_project_department" : "invoke_project_department",
        label: "Undo: Revert project department",
        prefill: { projectId: projId, departmentId: deptId },
      },
    };
  }

  if (step.type === "add_project_url") {
    const projId = (await resolveProjectObjectId(rawPrefill.projectId || rawPrefill.prefix || rawPrefill.name)) || chainState.projectId;
    if (!projId || !rawPrefill.url) throw new Error("projectId and url are required");
    const safeUrl = await assertSafeWebUrl(rawPrefill.url);
    await callProtectedBackendAPI({
      user,
      method: "POST",
      path: `/projects/${projId}/urls`,
      data: { label: rawPrefill.label || rawPrefill.title || safeUrl, title: rawPrefill.title || rawPrefill.label || safeUrl, url: safeUrl },
    });
    return { executed: true, actionType: step.type, summary: "Added link to project" };
  }

  if (step.type === "update_department") {
    const d = await resolveDepartmentDoc(rawPrefill.departmentId || rawPrefill.code || rawPrefill.name);
    if (!d) throw new Error("Department not found");
    await callProtectedBackendAPI({ user, method: "PUT", path: `/departments/${d._id}`, data: rawPrefill });
    return {
      executed: true,
      actionType: step.type,
      summary: `Updated department "${d.name}"`,
      undoStep: {
        type: "update_department",
        label: `Undo: Revert "${d.name}"`,
        prefill: { departmentId: String(d._id), name: d.name, description: d.description, color: d.color },
      },
    };
  }

  if (step.type === "add_department_member" || step.type === "remove_department_member") {
    const d = await resolveDepartmentDoc(rawPrefill.departmentId || rawPrefill.department || rawPrefill.code);
    const dId = d?._id ? String(d._id) : "";
    const uId = (await resolveUserObjectIds([rawPrefill.userId || rawPrefill.user || rawPrefill.email]))[0];
    if (!dId || !uId) throw new Error("departmentId and userId required");
    if (step.type === "add_department_member") {
      await callProtectedBackendAPI({ user, method: "POST", path: `/departments/${dId}/members`, data: { userId: uId } });
    } else {
      await callProtectedBackendAPI({ user, method: "DELETE", path: `/departments/${dId}/members/${uId}` });
    }
    return {
      executed: true,
      actionType: step.type,
      summary: "Updated department team member",
      undoStep: {
        type: step.type === "add_department_member" ? "remove_department_member" : "add_department_member",
        label: "Undo: Revert department member",
        prefill: { departmentId: dId, userId: uId },
      },
    };
  }

  if (step.type === "create_user") {
    const deptDoc = rawPrefill.departmentId || rawPrefill.department ? await resolveDepartmentDoc(rawPrefill.departmentId || rawPrefill.department, "_id name") : null;
    const res = await callProtectedBackendAPI({
      user,
      method: "POST",
      path: "/users",
      data: {
        fullname: rawPrefill.fullname || rawPrefill.name,
        email: rawPrefill.email,
        password: rawPrefill.password || crypto.randomBytes(6).toString("hex"),
        role: rawPrefill.role || "employee",
        jobTitle: rawPrefill.jobTitle || "",
        department: deptDoc?._id ? String(deptDoc._id) : undefined,
      },
    });
    const uid = res.user?._id ? String(res.user._id) : "";
    return {
      executed: true,
      actionType: step.type,
      summary: `Created team member ${res.user?.fullname || rawPrefill.email}`,
      undoStep: uid ? { type: "delete_user", label: `Undo: Remove ${res.user?.fullname || rawPrefill.email}`, prefill: { userId: uid } } : null,
    };
  }

  if (step.type === "update_user" || step.type === "update_user_role") {
    const uid = (await resolveUserObjectIds([rawPrefill.userId || rawPrefill.email || rawPrefill.targetName]))[0];
    if (!uid) throw new Error("userId required");
    const targetU = await User.findById(uid).select("role jobTitle status department").lean();
    if (step.type === "update_user_role" && rawPrefill.role) {
      await callProtectedBackendAPI({ user, method: "PUT", path: `/roles/assign/${uid}`, data: { roleName: rawPrefill.role } });
      return {
        executed: true,
        actionType: step.type,
        summary: `Assigned role "${rawPrefill.role}"`,
        undoStep: targetU ? { type: "update_user_role", label: `Undo: Revert role to ${targetU.role}`, prefill: { userId: uid, role: targetU.role } } : null,
      };
    }
    const resolvedDept = rawPrefill.department || rawPrefill.departmentId ? await resolveDepartmentDoc(rawPrefill.department || rawPrefill.departmentId, "_id") : null;
    await callProtectedBackendAPI({
      user,
      method: "PUT",
      path: `/users/${uid}`,
      data: {
        ...(rawPrefill.role ? { role: rawPrefill.role } : {}),
        ...(rawPrefill.jobTitle !== undefined ? { jobTitle: rawPrefill.jobTitle } : {}),
        ...(rawPrefill.status ? { status: rawPrefill.status } : {}),
        ...(resolvedDept?._id ? { department: String(resolvedDept._id) } : {}),
      },
    });
    return {
      executed: true,
      actionType: step.type,
      summary: "Updated team member profile",
      undoStep: targetU
        ? {
            type: "update_user",
            label: "Undo: Revert team member changes",
            prefill: { userId: uid, role: targetU.role, jobTitle: targetU.jobTitle, status: targetU.status },
          }
        : null,
    };
  }

  if (step.type === "approve_join_request" || step.type === "reject_join_request") {
    const rid = rawPrefill.requestId || rawPrefill.userId;
    if (!rid) throw new Error("Join request ID required");
    const ep = step.type === "approve_join_request" ? "approve" : "reject";
    await callProtectedBackendAPI({ user, method: "PUT", path: `/users/join-requests/${rid}/${ep}`, data: rawPrefill });
    return { executed: true, actionType: step.type, summary: `${ep === "approve" ? "Approved" : "Rejected"} join request` };
  }

  if (step.type === "restore_ai_access" && rawPrefill.grantId) {
    await callProtectedBackendAPI({ user, method: "PUT", path: `/ai/grants/${rawPrefill.grantId}/restore` });
    return {
      executed: true,
      actionType: step.type,
      summary: "Restored AI access grant",
      undoStep: { type: "revoke_ai_access", label: "Undo: Revoke AI access grant", prefill: { grantId: rawPrefill.grantId } },
    };
  }

  if (step.type === "delete_ai_grant" && rawPrefill.grantId) {
    await callProtectedBackendAPI({ user, method: "DELETE", path: `/ai/grants/${rawPrefill.grantId}` });
    return { executed: true, actionType: step.type, summary: "Deleted AI access grant" };
  }

  if (step.type === "update_ai_config" && rawPrefill.provider) {
    await callProtectedBackendAPI({ user, method: "PUT", path: `/ai/config/${rawPrefill.provider}`, data: rawPrefill });
    return { executed: true, actionType: step.type, summary: `Updated ${rawPrefill.provider} AI configuration` };
  }

  if (step.type === "toggle_pin_chat_message" && rawPrefill.messageId) {
    await callProtectedBackendAPI({ user, method: "PATCH", path: `/chat/messages/${rawPrefill.messageId}/pin` });
    return {
      executed: true,
      actionType: step.type,
      summary: "Toggled pinned chat message",
      undoStep: { type: "toggle_pin_chat_message", label: "Undo: Unpin/repin message", prefill: { messageId: rawPrefill.messageId } },
    };
  }

  if (step.type === "mark_notifications_read") {
    await callProtectedBackendAPI({ user, method: "POST", path: "/notifications/read-all" });
    return { executed: true, actionType: step.type, summary: "Marked all notifications read" };
  }

  if (step.type === "update_profile") {
    await callProtectedBackendAPI({
      user,
      method: "PUT",
      path: "/profile/info",
      data: {
        ...(rawPrefill.fullname ? { fullname: rawPrefill.fullname } : {}),
        ...(rawPrefill.jobTitle !== undefined ? { jobTitle: rawPrefill.jobTitle } : {}),
        ...(rawPrefill.status ? { status: rawPrefill.status } : {}),
        ...(rawPrefill.bio !== undefined ? { bio: rawPrefill.bio } : {}),
      },
    });
    return { executed: true, actionType: step.type, summary: "Updated profile settings" };
  }

  return { executed: false };
}

/**
 * Execute workflow steps sequentially in-process, capturing completed steps, inverse undo steps,
 * and partial errors cleanly.
 */
async function executeAssistantWorkflow({ steps = [], intent = null, user }) {
  const queue = Array.isArray(steps) && steps.length > 0 ? steps : intent ? [intent] : [];
  if (queue.length === 0) return { executed: false, stepResults: [], failedSteps: [], undoSteps: [] };

  const chainState = {};
  const stepResults = [];
  const failedSteps = [];
  for (const s of queue) {
    if (!s || !s.type) continue;
    console.log(`[LIRA COPILOT] STEP_EXEC user=${user.email} action=${s.type}`);
    try {
      const res = await executeSingleStep(s, user, chainState);
      if (res?.executed) {
        stepResults.push(res);
        console.log(`[LIRA COPILOT] STEP_DONE action=${s.type} summary="${res.summary}"`);
      }
    } catch (stepErr) {
      const msg = stepErr?.message || "Step failed";
      console.warn(`[LIRA COPILOT] STEP_FAIL action=${s.type} error="${msg}"`);
      failedSteps.push({ type: s.type, label: s.label || s.type, error: msg });
    }
  }

  const executed = stepResults.length > 0;
  const partialFailure = executed && failedSteps.length > 0;
  const errorText = failedSteps.length > 0 ? failedSteps.map((f) => `${f.type}: ${f.error}`).join("; ") : "";
  const undoSteps = stepResults
    .map((r) => r.undoStep)
    .filter(Boolean)
    .reverse();

  return {
    executed,
    partialFailure,
    completedCount: stepResults.length,
    failedCount: failedSteps.length,
    summary: stepResults.map((r) => r.summary).join(" → "),
    error: errorText || undefined,
    taskKey: chainState.taskKey || "",
    taskId: chainState.taskId || "",
    stepResults,
    failedSteps,
    undoSteps,
  };
}

module.exports = {
  encryptChatTextServer,
  sendChatMessageServer,
  executeSingleStep,
  executeAssistantWorkflow,
};
