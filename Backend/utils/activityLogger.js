const ActivityLog = require("../models/activityLogModel");
const { enqueueWebSocketEvent, enqueueActivityLog } = require("../services/queue");

const logActivity = async ({ task, project, user, action, details }) => {
  try {
    const taskId = task?._id || task;
    const projId = project?._id || project;
    const userId = user?._id || user;

    // Immediately create in DB
    const activity = await ActivityLog.create({
      task: taskId,
      project: projId,
      user: userId,
      action,
      details,
    });

    const populated = await ActivityLog.findById(activity._id)
      .populate("user", "fullname email avatar profilePicture role")
      .lean();

    // Enqueue real-time WebSocket update through BullMQ & Redis
    if (projId) {
      await enqueueWebSocketEvent({
        target: "project",
        room: projId.toString(),
        event: "activity:new",
        data: populated,
      });
    }

    return populated;
  } catch (error) {
    console.error("Activity logging error:", error.message);
  }
};

module.exports = { logActivity };
