const { Worker } = require("bullmq");
const { redisConfig, enqueueWebSocketEvent } = require("../services/queue");
const ActivityLog = require("../models/activityLogModel");

const activityWorker = new Worker(
  "activity-log-queue",
  async (job) => {
    const { task, project, user, action, details } = job.data;
    if (!task || !user) return { skipped: true };

    const activity = await ActivityLog.create({
      task,
      project,
      user,
      action,
      details,
    });

    const populated = await ActivityLog.findById(activity._id)
      .populate("user", "fullname email avatar profilePicture role")
      .lean();

    if (project) {
      await enqueueWebSocketEvent({
        target: "project",
        room: project.toString(),
        event: "activity:new",
        data: populated,
      });
    }

    return { created: true, id: activity._id };
  },
  {
    connection: redisConfig,
    concurrency: 5,
  }
);

activityWorker.on("failed", (job, err) => {
  console.error(`[Activity Worker] Job ${job?.id} failed:`, err.message);
});

module.exports = activityWorker;
