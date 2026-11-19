const Task = require("../models/taskModel");
const Project = require("../models/projectModel");
const Comment = require("../models/commentModel");
const ActivityLog = require("../models/activityLogModel");
const { logActivity } = require("../utils/activityLogger");
const { createNotification } = require("../utils/notificationHelper");
const { enqueueWebSocketEvent, enqueueTaskMetrics } = require("../services/queue");

// Get tasks with filtering
exports.getTasks = async (req, res) => {
  try {
    const { projectId, status, assignee, priority, type, search, overdue } = req.query;
    const filter = {};

    if (projectId) filter.project = projectId;
    if (status) filter.status = status;
    if (assignee) {
      if (assignee === "unassigned") filter.assignee = null;
      else filter.assignee = assignee;
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
      .populate("assignee", "fullname email avatar profilePicture jobTitle role")
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

    const allMyTasks = await Task.find({ assignee: userId })
      .populate("reporter", "fullname email avatar")
      .populate("project", "name prefix color")
      .populate("assignee", "fullname email avatar jobTitle role")
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
        inProgress: allMyTasks.filter((t) => t.status === "in_progress").length,
        review: allMyTasks.filter((t) => t.status === "review").length,
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
      .populate("assignee", "fullname email avatar profilePicture jobTitle role")
      .populate("reporter", "fullname email avatar profilePicture jobTitle role")
      .populate("project", "name prefix color lead department")
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

    const task = await Task.create({
      key,
      project: project._id,
      title: title.trim(),
      description: description || "",
      type: type || "task",
      status: "todo",
      priority: priority || "medium",
      assignee: assignee || null,
      reporter: req.user._id,
      dueDate: dueDate || null,
      estimatedHours: Number(estimatedHours) || 0,
      subtasks: formattedSubtasks,
    });

    const populated = await Task.findById(task._id)
      .populate("assignee", "fullname email avatar profilePicture jobTitle role")
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

    // Notify assignee if assigned
    if (assignee && assignee.toString() !== req.user._id.toString()) {
      await createNotification({
        recipient: assignee,
        sender: req.user._id,
        task: task._id,
        type: "assigned",
        message: `${req.user.fullname} assigned you task ${key}: "${task.title}"`,
      });
    }

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

    const previousAssignee = task.assignee?.toString();
    const previousPriority = task.priority;
    const previousTitle = task.title;

    if (updates.title !== undefined) task.title = updates.title;
    if (updates.description !== undefined) task.description = updates.description;
    if (updates.type !== undefined) task.type = updates.type;
    if (updates.priority !== undefined) task.priority = updates.priority;
    if (updates.dueDate !== undefined) task.dueDate = updates.dueDate;
    if (updates.estimatedHours !== undefined) task.estimatedHours = Number(updates.estimatedHours) || 0;
    if (updates.assignee !== undefined) {
      task.assignee = updates.assignee ? updates.assignee : null;
    }

    await task.save();

    const populated = await Task.findById(task._id)
      .populate("assignee", "fullname email avatar profilePicture jobTitle role")
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

    if (previousAssignee !== task.assignee?.toString()) {
      const isNowUnassigned = !task.assignee;
      await logActivity({
        task: task._id,
        project: task.project,
        user: req.user._id,
        action: isNowUnassigned ? "unassigned" : "assigned",
        details: {
          field: "assignee",
          oldValue: previousAssignee,
          newValue: task.assignee,
          message: isNowUnassigned
            ? `${req.user.fullname} unassigned this task`
            : `${req.user.fullname} assigned this task to ${populated.assignee?.fullname || "a team member"}`,
        },
      });

      if (task.assignee && task.assignee.toString() !== req.user._id.toString()) {
        await createNotification({
          recipient: task.assignee,
          sender: req.user._id,
          task: task._id,
          type: "assigned",
          message: `${req.user.fullname} assigned you task ${task.key}: "${task.title}"`,
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
      .populate("assignee", "fullname email avatar profilePicture jobTitle role")
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
      .populate("assignee", "fullname email avatar profilePicture jobTitle role")
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
