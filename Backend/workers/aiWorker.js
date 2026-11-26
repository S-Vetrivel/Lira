const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const { Worker } = require("bullmq");
const Redis = require("ioredis");
const {
  redisConfig,
  AI_ABORT_CHANNEL,
  enqueueWebSocketEvent,
} = require("../services/queue");
const { queryAI } = require("../services/aiService");
const {
  processAssistantJob,
  abortAssistantController,
} = require("../services/aiAssistantService");

const ts = () => new Date().toISOString();
const concurrency = Math.max(2, Number(process.env.AI_WORKER_CONCURRENCY || 6));

// Dedicated Redis Pub/Sub subscriber for instant cross-node cancellation
const abortSubscriber = new Redis(redisConfig, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

abortSubscriber.subscribe(AI_ABORT_CHANNEL, (err) => {
  if (err) {
    console.warn(`[${ts()}] [AIWorker] Failed to subscribe to ${AI_ABORT_CHANNEL}:`, err.message);
  } else {
    console.log(`[${ts()}] [AIWorker] Subscribed to ${AI_ABORT_CHANNEL} (pid=${process.pid})`);
  }
});

abortSubscriber.on("message", (channel, message) => {
  if (channel === AI_ABORT_CHANNEL && message) {
    abortAssistantController(String(message));
  }
});

const aiWorker = new Worker(
  "ai-processing-queue",
  async (job) => {
    const jobName = job.name || "task-breakdown";

    if (jobName === "copilot-chat") {
      const { jobId, userDoc } = job.data || {};
      console.log(
        `[${ts()}] [AIWorker] Processing copilot-chat job=${job.id} copilotJobId=${jobId} user=${userDoc?.email || "unknown"} pid=${process.pid}`
      );
      await processAssistantJob(job.data);
      return { processed: true, jobId };
    }

    // Legacy / modular task-breakdown job
    const {
      userId,
      projectId,
      departmentId,
      taskTitle,
      description,
      provider,
      model,
      moduleKey = "board",
    } = job.data || {};

    console.log(`[${ts()}] [AIWorker] Processing AI Breakdown (${provider || "auto"}): ${taskTitle}`);

    const prompt = `Break down the workspace task into clear actionable subtasks (numbered 1..5, concise plain text).\nTitle: ${taskTitle}\nDescription: ${description || "No additional details"}`;
    const aiResult = await queryAI({
      prompt,
      provider,
      model,
      taskType: "task_breakdown",
      moduleKey,
      userId,
      projectId,
      departmentId,
      maxOutputTokens: 500,
    });

    const targetRoom = userId ? userId.toString() : projectId?.toString();
    if (targetRoom) {
      await enqueueWebSocketEvent({
        target: userId ? "user" : "project",
        room: targetRoom,
        event: "ai:breakdown_ready",
        data: {
          taskTitle,
          provider: aiResult.provider,
          model: aiResult.model,
          keySource: aiResult.keySource,
          breakdown: aiResult.text,
          latencyMs: aiResult.latencyMs,
        },
      });
    }

    return {
      processed: true,
      provider: aiResult.provider,
      model: aiResult.model,
      keySource: aiResult.keySource,
    };
  },
  {
    connection: redisConfig,
    concurrency,
  }
);

aiWorker.on("failed", (job, err) => {
  console.error(`[${ts()}] [AIWorker] Job ${job?.id} (${job?.name}) failed:`, err.message);
});

const originalClose = aiWorker.close.bind(aiWorker);
aiWorker.close = async () => {
  try {
    await abortSubscriber.quit();
  } catch {}
  return originalClose();
};

if (require.main === module) {
  const connectMongo = require("../config/connectMongo");
  connectMongo()
    .then(() => {
      console.log(`🚀 [AIWorker] Standalone multi-node worker listening on ai-processing-queue (concurrency=${concurrency}, pid=${process.pid})`);
    })
    .catch((err) => {
      console.error("[AIWorker] Mongo connection error:", err.message);
      process.exit(1);
    });

  const gracefulStop = async () => {
    await aiWorker.close().catch(() => {});
    process.exit(0);
  };
  process.on("SIGTERM", gracefulStop);
  process.on("SIGINT", gracefulStop);
}

module.exports = aiWorker;
