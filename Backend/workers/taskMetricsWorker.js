const { Worker } = require("bullmq");
const { redisConfig, enqueueWebSocketEvent } = require("../services/queue");
const Task = require("../models/taskModel");

const taskMetricsWorker = new Worker(
  "task-metrics-queue",
  async (job) => {
    const { projectId } = job.data;
    if (!projectId) return { skipped: true };

    const total = await Task.countDocuments({ project: projectId });
    const done = await Task.countDocuments({ project: projectId, status: "done" });
    const inProgress = await Task.countDocuments({ project: projectId, status: "in_progress" });
    const review = await Task.countDocuments({ project: projectId, status: "review" });
    const todo = await Task.countDocuments({ project: projectId, status: "todo" });

    const stats = {
      projectId,
      total,
      done,
      inProgress,
      review,
      todo,
      progressPercent: total > 0 ? Math.round((done / total) * 100) : 0,
    };

    // Broadcast updated project statistics across all cluster nodes
    await enqueueWebSocketEvent({
      target: "project",
      room: projectId.toString(),
      event: "project:stats_updated",
      data: stats,
    });

    return stats;
  },
  {
    connection: redisConfig,
    concurrency: 3,
  }
);

taskMetricsWorker.on("failed", (job, err) => {
  console.error(`[Metrics Worker] Job ${job?.id} failed:`, err.message);
});

module.exports = taskMetricsWorker;
