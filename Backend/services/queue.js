const { Queue } = require("bullmq");
const Redis = require("ioredis");

// -----------------
// UNIFIED REDIS CONNECTION CONFIGURATION
// -----------------
const redisConfig = process.env.REDIS_URL
  ? process.env.REDIS_URL
  : {
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: Number(process.env.REDIS_PORT) || 6379,
    db: Number(process.env.REDIS_DB) || 0,
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  };

const connection = new Redis(redisConfig, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  retryStrategy(times) {
    const delay = Math.min(times * 200, 2000);
    return delay;
  },
});

connection.on("connect", () => {
  console.log("🔗 Unified Redis connection established");
});

connection.on("error", (err) => {
  console.warn("⚠️ Redis connection warning:", err.message);
});

// -----------------
// CENTRALIZED QUEUE DEFINITIONS
// -----------------
const defaultQueueOpts = {
  connection,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 3,
    backoff: { type: "exponential", delay: 1000 },
  },
};

// 1. WebSocket Broadcast Queue (Real-time socket broadcasts)
const websocketQueue = new Queue("websocket-events-queue", defaultQueueOpts);

// 2. Notification Processing Queue (Push & in-app alerts)
const notificationQueue = new Queue("notification-queue", defaultQueueOpts);

// 3. Activity Logging Queue (Audit trails)
const activityQueue = new Queue("activity-log-queue", defaultQueueOpts);

// 4. Task Metrics & Analytics Queue (Velocity, burndown, workload)
const taskMetricsQueue = new Queue("task-metrics-queue", defaultQueueOpts);

// 5. AI Task Generation Queue (Gemini Task Breakdown & Summaries)
const aiProcessingQueue = new Queue("ai-processing-queue", defaultQueueOpts);

// 6. File Sharing & Verification Queue (Storage checks & checksums)
const fileSharingQueue = new Queue("file-sharing-queue", defaultQueueOpts);

// 7. Recurring Task Routine & Deadline Escalation Queue
const routineQueue = new Queue("routine-scheduler-queue", defaultQueueOpts);

// 8. Media Processing Queue (Sharp, WebP conversion, MinIO upload)
const mediaQueue = new Queue("media-processing", defaultQueueOpts);

// 9. SMTP Email Notification Queue (Offline chat & task approval emails)
const emailQueue = new Queue("email-notification-queue", defaultQueueOpts);

// Multi-node Redis Pub/Sub channel for real-time Copilot cancellation
const AI_ABORT_CHANNEL = "lira:ai:abort";

// -----------------
// UNIFIED ENQUEUE HELPERS
// -----------------
const enqueueWebSocketEvent = async ({ room, event, data, target = "project" }) => {
  try {
    return await websocketQueue.add(
      "broadcast",
      { room, event, data, target, timestamp: Date.now() },
      {
        removeOnComplete: 200,
        removeOnFail: 50,
        attempts: 3,
        backoff: { type: "exponential", delay: 500 },
      }
    );
  } catch (error) {
    console.error("Failed to enqueue websocket event:", error.message);
  }
};

const enqueueNotification = async (payload) => {
  try {
    return await notificationQueue.add("create-notification", payload, {
      removeOnComplete: 100,
      removeOnFail: 50,
      attempts: 3,
    });
  } catch (error) {
    console.error("Failed to enqueue notification:", error.message);
  }
};

const enqueueActivityLog = async (payload) => {
  try {
    return await activityQueue.add("log-activity", payload, {
      removeOnComplete: 100,
      removeOnFail: 50,
      attempts: 3,
    });
  } catch (error) {
    console.error("Failed to enqueue activity log:", error.message);
  }
};

const enqueueTaskMetrics = async (payload) => {
  try {
    return await taskMetricsQueue.add("compute-metrics", payload, {
      removeOnComplete: 50,
      attempts: 2,
    });
  } catch (error) {
    console.error("Failed to enqueue task metrics:", error.message);
  }
};

const enqueueFileJob = async (payload) => {
  try {
    return await fileSharingQueue.add("process-file", payload, {
      removeOnComplete: 100,
      removeOnFail: 50,
      attempts: 3,
    });
  } catch (error) {
    console.error("Failed to enqueue file job:", error.message);
  }
};

const enqueueRoutineJob = async (payload = {}) => {
  try {
    return await routineQueue.add("process-routines", payload, {
      removeOnComplete: 50,
      removeOnFail: 20,
      attempts: 2,
    });
  } catch (error) {
    console.error("Failed to enqueue routine job:", error.message);
  }
};

const enqueueMediaJob = async (payload) => {
  try {
    return await mediaQueue.add("process-media", payload, {
      removeOnComplete: 100,
      removeOnFail: 50,
      attempts: 3,
    });
  } catch (error) {
    console.error("Failed to enqueue media job:", error.message);
  }
};

const enqueueAIJob = async (jobName, payload, opts = {}) => {
  try {
    return await aiProcessingQueue.add(jobName, payload, {
      removeOnComplete: 100,
      removeOnFail: 50,
      attempts: opts.attempts ?? 1,
      ...opts,
    });
  } catch (error) {
    console.error("Failed to enqueue AI job:", error.message);
  }
};

const publishAIAbort = async (jobId) => {
  if (!jobId) return;
  try {
    await connection.publish(AI_ABORT_CHANNEL, String(jobId));
  } catch (error) {
    console.warn("Failed to publish AI abort signal:", error.message);
  }
};

const enqueueEmailJob = async (payload) => {
  try {
    return await emailQueue.add("send-email", payload, {
      removeOnComplete: 100,
      removeOnFail: 50,
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
    });
  } catch (error) {
    console.error("Failed to enqueue email job:", error.message);
  }
};

/**
 * Diagnostic health check returning queue status across all unified queues
 */
const getQueueHealth = async () => {
  const queues = [
    { name: "websocket", queue: websocketQueue },
    { name: "notifications", queue: notificationQueue },
    { name: "activity", queue: activityQueue },
    { name: "taskMetrics", queue: taskMetricsQueue },
    { name: "aiProcessing", queue: aiProcessingQueue },
    { name: "fileSharing", queue: fileSharingQueue },
    { name: "routines", queue: routineQueue },
    { name: "media", queue: mediaQueue },
    { name: "email", queue: emailQueue },
  ];

  const results = {};
  for (const { name, queue } of queues) {
    try {
      const [waiting, active, completed, failed] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getCompletedCount(),
        queue.getFailedCount(),
      ]);
      results[name] = { waiting, active, completed, failed, healthy: true };
    } catch (err) {
      results[name] = { error: err.message, healthy: false };
    }
  }
  return results;
};

module.exports = {
  connection,
  redisConfig,
  AI_ABORT_CHANNEL,
  websocketQueue,
  notificationQueue,
  activityQueue,
  taskMetricsQueue,
  aiProcessingQueue,
  fileSharingQueue,
  routineQueue,
  mediaQueue,
  emailQueue,
  enqueueWebSocketEvent,
  enqueueNotification,
  enqueueActivityLog,
  enqueueTaskMetrics,
  enqueueFileJob,
  enqueueRoutineJob,
  enqueueMediaJob,
  enqueueAIJob,
  publishAIAbort,
  enqueueEmailJob,
  getQueueHealth,
};
