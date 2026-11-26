const Task = require("../models/taskModel");
const Project = require("../models/projectModel");
const User = require("../models/userModel");
const Comment = require("../models/commentModel");
const ActivityLog = require("../models/activityLogModel");
const { logActivity } = require("../utils/activityLogger");
const { createNotification } = require("../utils/notificationHelper");
const { enqueueWebSocketEvent, enqueueTaskMetrics, enqueueEmailJob } = require("../services/queue");
const { hasWildcardPermission, isSuperAdminUser } = require("../utils/roles");

const normalizeAssignmentInput = ({ assignee, assignees, assignedDepartments }) => {
  const uniqueAssignees = Array.from(
    new Set([
      ...(assignee ? [assignee.toString()] : []),
      ...(Array.isArray(assignees) ? assignees.filter(Boolean).map(String) : []),
    ])
  );
  const primaryAssignee = assignee || uniqueAssignees[0] || null;
  const uniqueDepts = Array.from(
    new Set(
      Array.isArray(assignedDepartments)
        ? assignedDepartments.filter(Boolean).map(String)
        : []
    )
  );
  return { primaryAssignee, uniqueAssignees, uniqueDepts };
};

const notifyAssignedRecipients = async ({
  userIds = [],
  departmentIds = [],
  excludeUserId,
  sender,
  task,
}) => {
  const recipientIdsSet = new Set(userIds.filter(Boolean).map(String));
  if (departmentIds.length > 0) {
    const deptUsers = await User.find({
      department: { $in: departmentIds },
      isActive: true,
      status: "active",
    })
      .select("_id")
      .lean();
    deptUsers.forEach((u) => recipientIdsSet.add(u._id.toString()));
  }
  if (excludeUserId) {
    recipientIdsSet.delete(excludeUserId.toString());
  }
  if (recipientIdsSet.size === 0) return;

  const recipientsArr = Array.from(recipientIdsSet);
  await Promise.all(
    recipientsArr.map((recId) =>
      createNotification({
        recipient: recId,
        sender: sender._id,
        task: task._id,
        type: "assigned",
        message: `${sender.fullname} assigned you task ${task.key}: "${task.title}"`,
      })
    )
  );
  const assignedUsers = await User.find({ _id: { $in: recipientsArr } })
    .select("email")
    .lean();
  assignedUsers.forEach((au) => {
    if (au.email) {
      enqueueEmailJob({
        to: au.email,
        type: "task_assigned",
        data: {
          key: task.key,
          title: task.title,
          assignerName: sender.fullname || sender.email,
        },
      });
    }
  });
};

// Get tasks with filtering
exports.getTasks = async (req, res) => {
  try {
    const { projectId, project, status, assignee, priority, type, search, overdue } = req.query;
    const filter = {};

    const targetProjectId = projectId || project;
    if (targetProjectId) filter.project = targetProjectId;
    if (status) filter.status = status;
    if (assignee) {
      if (assignee === "unassigned") {
        filter.$and = (filter.$and || []).concat([
          { assignee: null },
          { $or: [{ assignees: { $exists: false } }, { assignees: { $size: 0 } }] },
          { $or: [{ assignedDepartments: { $exists: false } }, { assignedDepartments: { $size: 0 } }] },
        ]);
      } else {
        filter.$and = (filter.$and || []).concat([
          { $or: [{ assignee }, { assignees: assignee }] },
        ]);
      }
    }
    if (priority) filter.priority = priority;
    if (type) filter.type = type;

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { key: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    if (overdue === "true") {
      filter.dueDate = { $lt: new Date() };
      filter.status = { $ne: "done" };
    }

    const tasks = await Task.find(filter)
      .populate("assignee", "fullname email avatar profilePicture jobTitle role publicId departmentName")
      .populate("assignees", "fullname email avatar profilePicture jobTitle role publicId departmentName")
      .populate("assignedDepartments", "name code color")
      .populate("reporter", "fullname email avatar profilePicture")
      .populate("project", "name prefix color")
      .populate("subtasks.assignee", "fullname email avatar")
      .sort({ order: 1, createdAt: -1 })
      .lean();

    res.status(200).json({ success: true, count: tasks.length, tasks });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// "My Work" Tasks for the logged-in user
exports.getMyTasks = async (req, res) => {
  try {
    const userId = req.user._id;
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const myOrConditions = [{ assignee: userId }, { assignees: userId }];
    if (req.user.department) {
      myOrConditions.push({ assignedDepartments: req.user.department });
    }

    const allMyTasks = await Task.find({ $or: myOrConditions })
      .populate("reporter", "fullname email avatar")
      .populate("project", "name prefix color")
      .populate("assignee", "fullname email avatar jobTitle role publicId departmentName")
      .populate("assignees", "fullname email avatar jobTitle role publicId departmentName")
      .populate("assignedDepartments", "name code color")
      .sort({ dueDate: 1, createdAt: -1 })
      .lean();

    const overdue = [];
    const dueToday = [];
    const upcoming = [];
    const completedRecently = [];

    allMyTasks.forEach((task) => {
      if (task.status === "done") {
        completedRecently.push(task);
        return;
      }

      if (!task.dueDate) {
        upcoming.push(task);
        return;
      }

      const due = new Date(task.dueDate);
      if (due < startOfToday) {
        overdue.push(task);
      } else if (due >= startOfToday && due <= endOfToday) {
        dueToday.push(task);
      } else {
        upcoming.push(task);
      }
    });

    res.status(200).json({
      success: true,
      stats: {
        total: allMyTasks.length,
        inProgress: allMyTasks.filter((t) => ["in_progress", "redo_requested"].includes(t.status)).length,
        review: allMyTasks.filter((t) => ["review", "submitted_for_review"].includes(t.status)).length,
        done: completedRecently.length,
        overdueCount: overdue.length,
        dueTodayCount: dueToday.length,
      },
      grouped: {
        overdue,
        dueToday,
        upcoming,
        completedRecently: completedRecently.slice(0, 10),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get single task by Key or ID
exports.getTaskByKeyOrId = async (req, res) => {
  try {
    const { keyOrId } = req.params;
    let query = {};

    if (keyOrId.includes("-")) {
      query = { key: keyOrId.toUpperCase().trim() };
    } else {
      query = { _id: keyOrId };
    }

    const task = await Task.findOne(query)
      .populate("assignee", "fullname email avatar profilePicture jobTitle role publicId departmentName")
      .populate("assignees", "fullname email avatar profilePicture jobTitle role publicId departmentName")
      .populate("assignedDepartments", "name code color")
      .populate("reporter", "fullname email avatar profilePicture jobTitle role")
      .populate("project", "name prefix color lead department departments")
      .populate("subtasks.assignee", "fullname email avatar")
      .populate("workLogs.user", "fullname email avatar")
      .populate("attachments.uploadedBy", "fullname email avatar");

    if (!task) {
      return res.status(404).json({ success: false, message: "Task not found" });
    }

    const comments = await Comment.find({ task: task._id })
      .populate("author", "fullname email avatar profilePicture role")
      .populate("mentions", "fullname email avatar")
      .sort({ createdAt: 1 });

    const history = await ActivityLog.find({ task: task._id })
      .populate("user", "fullname email avatar profilePicture role")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      task,
      comments,
      history,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Create a new task (Ticket) with Auto-Generated Key (ENG-101)
exports.createTask = async (req, res) => {
  try {
    const {
      projectId,
      title,
      description,
      type,
      priority,
      assignee,
      assignees = [],
      assignedDepartments = [],
      dueDate,
      estimatedHours,
      subtasks,
    } = req.body;

    if (!projectId || !title) {
      return res.status(400).json({ success: false, message: "Project and Title are required" });
    }

    const project = await Project.findByIdAndUpdate(
      projectId,
      { $inc: { taskSequence: 1 } },
      { new: true }
    );

    if (!project) {
      return res.status(404).json({ success: false, message: "Project not found" });
    }

    const key = `${project.prefix}-${project.taskSequence}`;

    const formattedSubtasks = Array.isArray(subtasks)
      ? subtasks.map((st) => ({
          title: typeof st === "string" ? st : st.title,
          completed: false,
          assignee: st.assignee || null,
        }))
      : [];

    const { primaryAssignee, uniqueAssignees, uniqueDepts } = normalizeAssignmentInput({
      assignee,
      assignees,
      assignedDepartments,
    });

    const canAssignTask =
      isSuperAdminUser(req.user) ||
      hasWildcardPermission(req.user.permissions, "tasks.assign");

    // Without `tasks.assign`, disallow assigning tasks to other users or departments on creation
    let finalAssignee = primaryAssignee;
    let finalAssignees = uniqueAssignees;
    let finalDepts = uniqueDepts;
    if (!canAssignTask) {
      const selfId = req.user._id.toString();
      const hasOthers =
        uniqueAssignees.some((uid) => uid !== selfId) || uniqueDepts.length > 0;
      if (hasOthers) {
        return res.status(403).json({
          success: false,
          message: "Permission denied: requires 'tasks.assign' to assign tasks to others or teams.",
        });
      }
      finalAssignees = uniqueAssignees.filter((uid) => uid === selfId);
      finalAssignee = finalAssignees[0] || null;
      finalDepts = [];
    }

    const task = await Task.create({
      key,
      project: project._id,
      title: title.trim(),
      description: description || "",
      type: type || "task",
      status: "todo",
      priority: priority || "medium",
      assignee: finalAssignee,
      assignees: finalAssignees,
      assignedDepartments: finalDepts,
      reporter: req.user._id,
      dueDate: dueDate || null,
      estimatedHours: Number(estimatedHours) || 0,
      subtasks: formattedSubtasks,
    });

    const populated = await Task.findById(task._id)
      .populate("assignee", "fullname email avatar profilePicture jobTitle role publicId departmentName")
      .populate("assignees", "fullname email avatar profilePicture jobTitle role publicId departmentName")
      .populate("assignedDepartments", "name code color")
      .populate("reporter", "fullname email avatar profilePicture")
      .populate("project", "name prefix color")
      .populate("subtasks.assignee", "fullname email avatar");

    // Log Activity
    await logActivity({
      task: task._id,
      project: project._id,
      user: req.user._id,
      action: "created",
      details: {
        field: "creation",
        message: `${req.user.fullname} created task ${key}: "${task.title}"`,
      },
    });

    await notifyAssignedRecipients({
      userIds: finalAssignees,
      departmentIds: finalDepts,
      excludeUserId: req.user._id,
      sender: req.user,
      task: { _id: task._id, key, title: task.title },
    });

    // Enqueue real-time WebSocket broadcast via BullMQ & Redis
    await enqueueWebSocketEvent({
      target: "project",
      room: project._id.toString(),
      event: "task:created",
      data: populated,
    });

    await enqueueWebSocketEvent({
      target: "all",
      room: "global",
      event: "task:created_global",
      data: populated,
    });

    await enqueueTaskMetrics({ projectId: project._id });

    res.status(201).json({ success: true, task: populated });
  } catch (error) {
    console.error("Create task error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update task details
exports.updateTask = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const task = await Task.findById(id);
    if (!task) return res.status(404).json({ success: false, message: "Task not found" });

    const prevAssigneesSet = new Set([
      ...(task.assignee ? [task.assignee.toString()] : []),
      ...(task.assignees || []).map((a) => a.toString()),
    ]);
    const prevDeptIdsSet = new Set(
      (task.assignedDepartments || []).map((d) => d.toString())
    );
    const previousPriority = task.priority;
    const previousTitle = task.title;

    if (updates.title !== undefined) task.title = updates.title;
    if (updates.description !== undefined) task.description = updates.description;
    if (updates.type !== undefined) task.type = updates.type;
    if (updates.priority !== undefined) task.priority = updates.priority;
    if (updates.dueDate !== undefined) task.dueDate = updates.dueDate;
    if (updates.estimatedHours !== undefined) task.estimatedHours = Number(updates.estimatedHours) || 0;

    const assignmentMutated =
      updates.assignee !== undefined ||
      updates.assignees !== undefined ||
      updates.assignedDepartments !== undefined;

    if (assignmentMutated) {
      const canAssignTask =
        isSuperAdminUser(req.user) ||
        hasWildcardPermission(req.user.permissions, "tasks.assign");

      if (!canAssignTask) {
        return res.status(403).json({
          success: false,
          message: "Permission denied: requires 'tasks.assign' to modify task assignees or teams.",
        });
      }

      if (updates.assignees !== undefined || updates.assignee !== undefined) {
        const nextSingle = updates.assignee !== undefined ? updates.assignee : null;
        const nextList =
          updates.assignees !== undefined
            ? updates.assignees
            : updates.assignee
              ? [updates.assignee]
              : [];
        const { primaryAssignee, uniqueAssignees } = normalizeAssignmentInput({
          assignee: nextSingle,
          assignees: nextList,
          assignedDepartments: [],
        });
        task.assignee = primaryAssignee;
        task.assignees = uniqueAssignees;
      }

      if (updates.assignedDepartments !== undefined) {
        task.assignedDepartments = Array.from(
          new Set(
            Array.isArray(updates.assignedDepartments)
              ? updates.assignedDepartments.filter(Boolean).map(String)
              : []
          )
        );
      }
    }

    await task.save();

    const populated = await Task.findById(task._id)
      .populate("assignee", "fullname email avatar profilePicture jobTitle role publicId departmentName")
      .populate("assignees", "fullname email avatar profilePicture jobTitle role publicId departmentName")
      .populate("assignedDepartments", "name code color")
      .populate("reporter", "fullname email avatar profilePicture")
      .populate("project", "name prefix color")
      .populate("subtasks.assignee", "fullname email avatar");

    if (previousTitle !== task.title) {
      await logActivity({
        task: task._id,
        project: task.project,
        user: req.user._id,
        action: "title_updated",
        details: {
          field: "title",
          oldValue: previousTitle,
          newValue: task.title,
          message: `${req.user.fullname} updated title to "${task.title}"`,
        },
      });
    }

    if (previousPriority !== task.priority) {
      await logActivity({
        task: task._id,
        project: task.project,
        user: req.user._id,
        action: "priority_changed",
        details: {
          field: "priority",
          oldValue: previousPriority,
          newValue: task.priority,
          message: `${req.user.fullname} changed priority from ${previousPriority} to ${task.priority}`,
        },
      });
    }

    const nextAssigneesArr = (task.assignees || []).map((a) => a.toString());
    const nextDeptsArr = (task.assignedDepartments || []).map((d) => d.toString());
    const addedUsers = nextAssigneesArr.filter((uid) => !prevAssigneesSet.has(uid));
    const addedDepts = nextDeptsArr.filter((did) => !prevDeptIdsSet.has(did));
    const assigneesChanged =
      addedUsers.length > 0 ||
      addedDepts.length > 0 ||
      nextAssigneesArr.length !== prevAssigneesSet.size ||
      nextDeptsArr.length !== prevDeptIdsSet.size;

    if (assigneesChanged) {
      const isNowUnassigned =
        !task.assignee && nextAssigneesArr.length === 0 && nextDeptsArr.length === 0;
      const summaryParts = [
        ...(populated.assignees || []).map((u) => u.fullname).filter(Boolean),
        ...(populated.assignedDepartments || []).map((d) => `Team ${d.name}`).filter(Boolean),
      ];
      await logActivity({
        task: task._id,
        project: task.project,
        user: req.user._id,
        action: isNowUnassigned ? "unassigned" : "assigned",
        details: {
          field: "assignee",
          oldValue: Array.from(prevAssigneesSet),
          newValue: nextAssigneesArr,
          message: isNowUnassigned
            ? `${req.user.fullname} unassigned this task`
            : `${req.user.fullname} updated assignment: ${summaryParts.join(", ") || populated.assignee?.fullname || "team"}`,
        },
      });

      if (addedUsers.length > 0 || addedDepts.length > 0) {
        await notifyAssignedRecipients({
          userIds: addedUsers,
          departmentIds: addedDepts,
          excludeUserId: req.user._id,
          sender: req.user,
          task: { _id: task._id, key: task.key, title: task.title },
        });
      }
    }

    // Queue-based WebSocket broadcast
    await enqueueWebSocketEvent({
      target: "project",
      room: task.project.toString(),
      event: "task:updated",
      data: populated,
    });

    res.status(200).json({ success: true, task: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update task status (Kanban Drag and Drop)
exports.updateTaskStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, order } = req.body;

    const validStatuses = ["todo", "in_progress", "review", "done"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }

    const task = await Task.findById(id);
    if (!task) return res.status(404).json({ success: false, message: "Task not found" });

    const oldStatus = task.status;
    task.status = status;
    if (order !== undefined) task.order = order;
    await task.save();

    const populated = await Task.findById(task._id)
      .populate("assignee", "fullname email avatar profilePicture jobTitle role publicId departmentName")
      .populate("assignees", "fullname email avatar profilePicture jobTitle role publicId departmentName")
      .populate("assignedDepartments", "name code color")
      .populate("reporter", "fullname email avatar profilePicture")
      .populate("project", "name prefix color")
      .populate("subtasks.assignee", "fullname email avatar");

    if (oldStatus !== status) {
      await logActivity({
        task: task._id,
        project: task.project,
        user: req.user._id,
        action: "status_changed",
        details: {
          field: "status",
          oldValue: oldStatus,
          newValue: status,
          message: `${req.user.fullname} moved status from ${oldStatus.replace("_", " ")} to ${status.replace("_", " ")}`,
        },
      });

      if (
        (status === "done" || status === "review") &&
        task.reporter?.toString() !== req.user._id.toString()
      ) {
        await createNotification({
          recipient: task.reporter,
          sender: req.user._id,
          task: task._id,
          type: "status_change",
          message: `${req.user.fullname} moved task ${task.key} to ${status.replace("_", " ")}`,
        });
        if (status === "review" && populated.reporter?.email) {
          enqueueEmailJob({
            to: populated.reporter.email,
            type: "task_approval_request",
            data: {
              code: task.key,
              title: task.title,
              requesterName: req.user.fullname || req.user.email,
              stageName: "In Review Sign-off",
            },
          });
        }
      }
    }

    // Queue-based WebSocket broadcast for live board update across all users
    await enqueueWebSocketEvent({
      target: "project",
      room: task.project.toString(),
      event: "task:updated",
      data: populated,
    });

    await enqueueWebSocketEvent({
      target: "project",
      room: task.project.toString(),
      event: "task:status_changed",
      data: {
        taskId: task._id,
        key: task.key,
        oldStatus,
        newStatus: status,
        task: populated,
      },
    });

    await enqueueTaskMetrics({ projectId: task.project });

    res.status(200).json({ success: true, task: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Add Work Log
exports.addWorkLog = async (req, res) => {
  try {
    const { id } = req.params;
    const { hours, note, date } = req.body;

    const numHours = parseFloat(hours);
    if (isNaN(numHours) || numHours <= 0) {
      return res.status(400).json({ success: false, message: "Hours must be greater than 0" });
    }

    const task = await Task.findById(id);
    if (!task) return res.status(404).json({ success: false, message: "Task not found" });

    task.workLogs.push({
      user: req.user._id,
      hours: numHours,
      note: note || "",
      date: date || new Date(),
    });

    task.recalculateLoggedHours();
    await task.save();

    const populated = await Task.findById(task._id)
      .populate("assignee", "fullname email avatar profilePicture jobTitle role publicId departmentName")
      .populate("assignees", "fullname email avatar profilePicture jobTitle role publicId departmentName")
      .populate("assignedDepartments", "name code color")
      .populate("reporter", "fullname email avatar profilePicture")
      .populate("project", "name prefix color")
      .populate("workLogs.user", "fullname email avatar");

    await logActivity({
      task: task._id,
      project: task.project,
      user: req.user._id,
      action: "logged_work",
      details: {
        field: "workLogs",
        newValue: numHours,
        message: `${req.user.fullname} logged ${numHours}h work: "${note || "No notes"}"`,
      },
    });

    await enqueueWebSocketEvent({
      target: "project",
      room: task.project.toString(),
      event: "task:updated",
      data: populated,
    });

    res.status(200).json({
      success: true,
      loggedHours: task.loggedHours,
      workLogs: populated.workLogs,
      task: populated,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Add Subtask
exports.addSubtask = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, assignee } = req.body;

    if (!title) return res.status(400).json({ success: false, message: "Subtask title is required" });

    const task = await Task.findById(id);
    if (!task) return res.status(404).json({ success: false, message: "Task not found" });

    task.subtasks.push({
      title: title.trim(),
      completed: false,
      assignee: assignee || null,
    });

    await task.save();

    const populated = await Task.findById(task._id)
      .populate("subtasks.assignee", "fullname email avatar");

    await logActivity({
      task: task._id,
      project: task.project,
      user: req.user._id,
      action: "subtask_added",
      details: {
        field: "subtasks",
        message: `${req.user.fullname} added subtask "${title.trim()}"`,
      },
    });

    await enqueueWebSocketEvent({
      target: "project",
      room: task.project.toString(),
      event: "task:updated",
      data: populated,
    });

    res.status(200).json({ success: true, subtasks: populated.subtasks });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Toggle Subtask
exports.toggleSubtask = async (req, res) => {
  try {
    const { id, subtaskId } = req.params;

    const task = await Task.findById(id);
    if (!task) return res.status(404).json({ success: false, message: "Task not found" });

    const subtask = task.subtasks.id(subtaskId);
    if (!subtask) return res.status(404).json({ success: false, message: "Subtask not found" });

    subtask.completed = !subtask.completed;
    await task.save();

    const populated = await Task.findById(task._id)
      .populate("subtasks.assignee", "fullname email avatar");

    await logActivity({
      task: task._id,
      project: task.project,
      user: req.user._id,
      action: "subtask_toggled",
      details: {
        field: "subtasks",
        message: `${req.user.fullname} marked subtask "${subtask.title}" as ${subtask.completed ? "done" : "incomplete"}`,
      },
    });

    await enqueueWebSocketEvent({
      target: "project",
      room: task.project.toString(),
      event: "task:updated",
      data: populated,
    });

    res.status(200).json({ success: true, subtasks: populated.subtasks });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete Subtask
exports.deleteSubtask = async (req, res) => {
  try {
    const { id, subtaskId } = req.params;

    const task = await Task.findById(id);
    if (!task) return res.status(404).json({ success: false, message: "Task not found" });

    task.subtasks.pull({ _id: subtaskId });
    await task.save();

    await enqueueWebSocketEvent({
      target: "project",
      room: task.project.toString(),
      event: "task:updated",
      data: task,
    });

    res.status(200).json({ success: true, subtasks: task.subtasks });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Upload Attachment to Task
exports.uploadAttachment = async (req, res) => {
  try {
    const { id } = req.params;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ success: false, message: "No file provided" });
    }

    const task = await Task.findById(id);
    if (!task) return res.status(404).json({ success: false, message: "Task not found" });

    const fileUrl = `/api/uploads/${file.filename}`;

    const attachmentItem = {
      filename: file.filename,
      originalName: file.originalname,
      url: fileUrl,
      size: file.size,
      mimetype: file.mimetype,
      uploadedBy: req.user._id,
      uploadedAt: new Date(),
    };

    task.attachments.push(attachmentItem);
    await task.save();

    const populated = await Task.findById(task._id)
      .populate("attachments.uploadedBy", "fullname email avatar");

    await logActivity({
      task: task._id,
      project: task.project,
      user: req.user._id,
      action: "attachment_uploaded",
      details: {
        field: "attachments",
        message: `${req.user.fullname} uploaded attachment "${file.originalname}"`,
      },
    });

    await enqueueWebSocketEvent({
      target: "project",
      room: task.project.toString(),
      event: "task:updated",
      data: populated,
    });

    res.status(200).json({ success: true, attachments: populated.attachments });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete Task
exports.deleteTask = async (req, res) => {
  try {
    const { id } = req.params;
    const task = await Task.findById(id);
    if (!task) return res.status(404).json({ success: false, message: "Task not found" });

    if (
      !req.user.isSuperAdmin &&
      req.user.role !== "admin" &&
      req.user.role !== "manager" &&
      task.reporter.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ success: false, message: "Not authorized to delete this task" });
    }

    const projectId = task.project.toString();
    await Task.findByIdAndDelete(id);
    await Comment.deleteMany({ task: id });
    await ActivityLog.deleteMany({ task: id });

    await enqueueWebSocketEvent({
      target: "project",
      room: projectId,
      event: "task:deleted",
      data: { taskId: id, key: task.key },
    });

    await enqueueTaskMetrics({ projectId });

    res.status(200).json({ success: true, message: `Task ${task.key} deleted` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ----------------------------------------------------------------------
// OFFICE GOVERNANCE: MANAGER REVIEW & REDO LOOP
// ----------------------------------------------------------------------

// 1. Submit for Review
exports.submitForReview = async (req, res) => {
  try {
    const { id } = req.params;
    const { note, proofAttachment } = req.body;
    const task = await Task.findById(id);
    if (!task) return res.status(404).json({ success: false, message: "Task not found" });

    // Proof enforcement check
    if (task.proofRequired) {
      const hasProofInTask = task.proofFiles && task.proofFiles.length > 0;
      const hasNewProof = proofAttachment && proofAttachment.url;
      if (!hasProofInTask && !hasNewProof) {
        return res.status(400).json({
          success: false,
          message: "Mandatory proof of work (receipt, document, or sign-off) is required before submitting.",
        });
      }
    }

    if (proofAttachment && proofAttachment.url) {
      task.proofFiles.push(proofAttachment);
      task.attachments.push({ ...proofAttachment, isProofOfWork: true });
    }

    task.status = "submitted_for_review";
    task.submittedForReviewAt = new Date();
    await task.save();

    await logActivity({
      task: task._id,
      user: req.user._id,
      action: "submitted_for_review",
      details: note || "Task submitted for manager verification",
    });

    await createNotification({
      recipient: task.reporter,
      sender: req.user._id,
      type: "task_updated",
      title: "Task Submitted for Review",
      message: `${req.user.fullname} submitted ${task.key} for your approval.`,
      task: task._id,
      project: task.project,
    });

    await enqueueWebSocketEvent({
      target: "project",
      room: task.project.toString(),
      event: "task:status_changed",
      data: { taskId: task._id, newStatus: "submitted_for_review", task },
    });

    res.status(200).json({ success: true, task });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 2. Manager Approve Task
exports.approveTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { note } = req.body;
    const task = await Task.findById(id);
    if (!task) return res.status(404).json({ success: false, message: "Task not found" });

    task.status = "done";
    task.reviewedBy = req.user._id;
    task.reviewedAt = new Date();
    task.reviewFeedback = note || "Approved";
    await task.save();

    await logActivity({
      task: task._id,
      user: req.user._id,
      action: "task_approved",
      details: note || "Manager verified and approved task completion",
    });

    if (task.assignee) {
      await createNotification({
        recipient: task.assignee,
        sender: req.user._id,
        type: "task_updated",
        title: "Work Approved ✅",
        message: `${task.key} has been reviewed and approved by ${req.user.fullname}.`,
        task: task._id,
        project: task.project,
      });
    }

    await enqueueWebSocketEvent({
      target: "project",
      room: task.project.toString(),
      event: "task:status_changed",
      data: { taskId: task._id, newStatus: "done", task },
    });

    res.status(200).json({ success: true, task });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 3. Manager Request Revision / Redo
exports.requestRevision = async (req, res) => {
  try {
    const { id } = req.params;
    const { feedback } = req.body;
    if (!feedback || !feedback.trim()) {
      return res.status(400).json({
        success: false,
        message: "Inline feedback is required when requesting a revision / redo.",
      });
    }

    const task = await Task.findById(id);
    if (!task) return res.status(404).json({ success: false, message: "Task not found" });

    task.status = "redo_requested";
    task.reviewedBy = req.user._id;
    task.reviewedAt = new Date();
    task.reviewFeedback = feedback.trim();
    task.revisionCount = (task.revisionCount || 0) + 1;
    await task.save();

    await logActivity({
      task: task._id,
      user: req.user._id,
      action: "revision_requested",
      details: `Revision requested: "${feedback.trim()}"`,
    });

    if (task.assignee) {
      await createNotification({
        recipient: task.assignee,
        sender: req.user._id,
        type: "task_updated",
        title: "Revision Requested 🔄",
        message: `${req.user.fullname} requested redo on ${task.key}: "${feedback.trim()}"`,
        task: task._id,
        project: task.project,
      });
    }

    await enqueueWebSocketEvent({
      target: "project",
      room: task.project.toString(),
      event: "task:status_changed",
      data: { taskId: task._id, newStatus: "redo_requested", task },
    });

    res.status(200).json({ success: true, task });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 4. Update Checklist Step with Proof Requirement
exports.updateSubtaskProof = async (req, res) => {
  try {
    const { id, subtaskId } = req.params;
    const { proofAttachment, completed } = req.body;

    const task = await Task.findById(id);
    if (!task) return res.status(404).json({ success: false, message: "Task not found" });

    const sub = task.subtasks.id(subtaskId);
    if (!sub) return res.status(404).json({ success: false, message: "Checklist step not found" });

    if (proofAttachment) {
      sub.proofAttachment = proofAttachment;
    }

    if (completed !== undefined) {
      if (completed && sub.requiresProof && (!sub.proofAttachment || !sub.proofAttachment.url)) {
        return res.status(400).json({
          success: false,
          message: "This procedural SOP step requires proof attachment before it can be marked complete.",
        });
      }
      sub.completed = Boolean(completed);
      if (sub.completed) {
        sub.completedAt = new Date();
        sub.completedBy = req.user._id;
      }
    }

    await task.save();

    await enqueueWebSocketEvent({
      target: "project",
      room: task.project.toString(),
      event: "task:updated",
      data: { taskId: task._id, task },
    });

    res.status(200).json({ success: true, task });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 5. High-Density Excel-Like Bulk Updates
exports.bulkUpdateTasks = async (req, res) => {
  try {
    const { taskIds, updates } = req.body;
    if (!Array.isArray(taskIds) || taskIds.length === 0) {
      return res.status(400).json({ success: false, message: "taskIds array is required" });
    }

    const allowedUpdates = {};
    if (updates.status) allowedUpdates.status = updates.status;
    if (updates.assignee !== undefined) allowedUpdates.assignee = updates.assignee || null;
    if (updates.priority) allowedUpdates.priority = updates.priority;
    if (updates.dueDate !== undefined) allowedUpdates.dueDate = updates.dueDate;
    if (updates.dueTime !== undefined) allowedUpdates.dueTime = updates.dueTime;
    if (updates.isConfidential !== undefined) allowedUpdates.isConfidential = updates.isConfidential;

    await Task.updateMany({ _id: { $in: taskIds } }, { $set: allowedUpdates });

    const updatedTasks = await Task.find({ _id: { $in: taskIds } })
      .populate("assignee", "fullname email avatar jobTitle role")
      .populate("project", "name prefix color")
      .lean();

    res.status(200).json({ success: true, count: updatedTasks.length, tasks: updatedTasks });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
