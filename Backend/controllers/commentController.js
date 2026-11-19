const Comment = require("../models/commentModel");
const Task = require("../models/taskModel");
const User = require("../models/userModel");
const { logActivity } = require("../utils/activityLogger");
const { createNotification } = require("../utils/notificationHelper");
const { emitToProject } = require("../config/socket");

// Get comments for a task
exports.getComments = async (req, res) => {
  try {
    const { taskId } = req.params;
    const comments = await Comment.find({ task: taskId })
      .populate("author", "fullname email avatar profilePicture role")
      .populate("mentions", "fullname email avatar")
      .sort({ createdAt: 1 })
      .lean();

    res.status(200).json({ success: true, count: comments.length, comments });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Add comment to task
exports.addComment = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, message: "Comment text cannot be empty" });
    }

    const task = await Task.findById(taskId).populate("project");
    if (!task) {
      return res.status(404).json({ success: false, message: "Task not found" });
    }

    // Detect @mentions in text (e.g., @Rahul or @[Rahul Sharma](userId))
    const mentionedUserIds = [];
    const mentionRegex = /@([a-zA-Z0-9_.\s]+?)(?=\s|$|[,.!?])/g;
    let match;
    const potentialNames = [];

    while ((match = mentionRegex.exec(text)) !== null) {
      if (match[1] && match[1].trim().length > 1) {
        potentialNames.push(match[1].trim());
      }
    }

    if (potentialNames.length > 0) {
      const users = await User.find({
        $or: potentialNames.map((n) => ({
          fullname: { $regex: new RegExp("^" + n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") },
        })),
      });
      users.forEach((u) => {
        if (!mentionedUserIds.includes(u._id.toString())) {
          mentionedUserIds.push(u._id);
        }
      });
    }

    const comment = await Comment.create({
      task: task._id,
      author: req.user._id,
      text: text.trim(),
      mentions: mentionedUserIds,
    });

    const populated = await Comment.findById(comment._id)
      .populate("author", "fullname email avatar profilePicture role")
      .populate("mentions", "fullname email avatar");

    // Log Activity
    const snippet = text.length > 60 ? text.substring(0, 60) + "..." : text;
    await logActivity({
      task: task._id,
      project: task.project?._id || task.project,
      user: req.user._id,
      action: "commented",
      details: {
        field: "comments",
        message: `${req.user.fullname} commented: "${snippet}"`,
      },
    });

    // Notify mentioned users
    for (const menteeId of mentionedUserIds) {
      if (menteeId.toString() !== req.user._id.toString()) {
        await createNotification({
          recipient: menteeId,
          sender: req.user._id,
          task: task._id,
          type: "mention",
          message: `${req.user.fullname} mentioned you in a comment on ${task.key}: "${snippet}"`,
        });
      }
    }

    // Also notify assignee if different from author and not already mentioned
    if (
      task.assignee &&
      task.assignee.toString() !== req.user._id.toString() &&
      !mentionedUserIds.some((m) => m.toString() === task.assignee.toString())
    ) {
      await createNotification({
        recipient: task.assignee,
        sender: req.user._id,
        task: task._id,
        type: "comment",
        message: `${req.user.fullname} commented on your task ${task.key}`,
      });
    }

    const projId = (task.project?._id || task.project).toString();
    emitToProject(projId, "comment:new", { taskId: task._id, comment: populated });

    res.status(201).json({ success: true, comment: populated });
  } catch (error) {
    console.error("Add comment error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
