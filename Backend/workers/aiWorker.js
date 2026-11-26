const { Worker } = require("bullmq");
const { redisConfig, enqueueWebSocketEvent } = require("../services/queue");
const { queryAI } = require("../services/aiService");

const aiWorker = new Worker(
  "ai-processing-queue",
  async (job) => {
    const { taskId, title, description, userId, provider, model } = job.data;

    const prompt = `Analyze task: "${title}".
Description: "${description || "None"}"
Provide 3 concise subtask strings in JSON: {"subtasks": ["string1", "string2", "string3"]}`;

    try {
      const aiRes = await queryAI({
        prompt,
        provider,
        model,
        taskType: "global_task",
        moduleKey: "tasks",
        maxOutputTokens: 300,
      });

      let text = (aiRes.text || "{}").trim();
      text = text.replace(/^```json/i, "").replace(/^```/, "").replace(/```$/, "").trim();
      const parsed = JSON.parse(text);

      if (userId) {
        await enqueueWebSocketEvent({
          target: "user",
          room: userId.toString(),
          event: "ai:task_breakdown_ready",
          data: {
            taskId,
            suggestions: parsed.subtasks || [],
            provider: aiRes.provider,
            model: aiRes.model,
          },
        });
      }

      return { processed: true, taskId, suggestions: parsed.subtasks, provider: aiRes.provider };
    } catch (err) {
      console.warn("[AI Worker] Warning:", err.message);
      return { fallback: true, reason: err.message };
    }
  },
  {
    connection: redisConfig,
    concurrency: 2,
  }
);

aiWorker.on("failed", (job, err) => {
  console.error(`[AI Worker] Job ${job?.id} failed:`, err.message);
});

module.exports = aiWorker;
