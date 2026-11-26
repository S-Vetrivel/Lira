const { Worker } = require("bullmq");
const { redisConfig, enqueueWebSocketEvent } = require("../services/queue");
const ActivityLog = require("../models/activityLogModel");

const ts = () => new Date().toISOString();

const activityWorker = new Worker(
  "activity-log-queue",
  async (job) => {
    const { taskId, projectId, userId, action, details } = job.data || {};
    if (!projectId || !action) {
      return { skipped: true, reason: "Missing projectId or action" };
    }

    const logEntry = await ActivityLog.create({
      task: taskId || undefined,
      project: projectId,
      user: userId || undefined,
      action,
      details: details || {},
    });

    const populated = await ActivityLog.findById(logEntry._id)
      .populate("user", "fullname email avatar role publicId")
      .populate("task", "key title status");

    await enqueueWebSocketEvent({
      target: "project",
      room: projectId.toString(),
      event: "activity:new",
      data: populated,
    });

    console.log(
      `[${ts()}] [ActivityWorker] Recorded action=${action} project=${projectId} job=${job.id}`
    );

    return { logged: true, logId: logEntry._id };
  },
  {
    connection: redisConfig,
    concurrency: 5,
  }
);

activityWorker.on("failed", (job, err) => {
  console.error(`[${ts()}] [ActivityWorker] Job ${job?.id} failed:`, err.message);
});

module.exports = activityWorker;
