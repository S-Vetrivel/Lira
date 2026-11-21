const { Queue } = require("bullmq");
const Redis = require("ioredis");

const redisConfig = {
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: Number(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
};

const connection = new Redis(redisConfig);

connection.on("connect", () => {
  console.log("🔗 Redis queue connection established");
});

connection.on("error", (err) => {
  console.warn("⚠️ Redis connection warning:", err.message);
});

// 1. WebSocket Broadcast Queue (Decoupled real-time updates)
const websocketQueue = new Queue("websocket-events-queue", { connection });

// 2. Notification Processing Queue
const notificationQueue = new Queue("notification-queue", { connection });

// 3. Activity Logging Queue
const activityQueue = new Queue("activity-log-queue", { connection });

// 4. Task Metrics & Analytics Queue
const taskMetricsQueue = new Queue("task-metrics-queue", { connection });

// 5. AI Task Generation Queue
const aiProcessingQueue = new Queue("ai-processing-queue", { connection });

// 6. File Sharing & Verification Queue
const fileSharingQueue = new Queue("file-sharing-queue", { connection });

// 7. Recurring Task Routine & Deadline Escalation Queue
const routineQueue = new Queue("routine-scheduler-queue", { connection });

// Helper function to safely enqueue jobs with automatic retry options
const enqueueWebSocketEvent = async ({ room, event, data, target = "project" }) => {
  try {
    return await websocketQueue.add(
      "broadcast",
      { room, event, data, target, timestamp: Date.now() },
      {
        removeOnComplete: 100,
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

module.exports = {
  connection,
  redisConfig,
  websocketQueue,
  notificationQueue,
  activityQueue,
  taskMetricsQueue,
  aiProcessingQueue,
  fileSharingQueue,
  routineQueue,
  enqueueWebSocketEvent,
  enqueueNotification,
  enqueueActivityLog,
  enqueueTaskMetrics,
  enqueueFileJob,
  enqueueRoutineJob,
};
