const { Worker } = require("bullmq");
const { redisConfig, enqueueWebSocketEvent } = require("../services/queue");
const axios = require("axios");

const aiWorker = new Worker(
  "ai-processing-queue",
  async (job) => {
    const { taskId, title, description, userId } = job.data;
    const apiKey = process.env.GOOGLE_AI_API_KEY;

    if (!apiKey) return { skipped: true, reason: "No API key" };

    const prompt = `Analyze task: "${title}".
Description: "${description || "None"}"
Provide 3 concise subtask strings in JSON: {"subtasks": ["string1", "string2", "string3"]}`;

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
      const response = await axios.post(
        url,
        {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 300 },
        },
        { timeout: 8000 }
      );

      let text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
      text = text.trim().replace(/^```json/i, "").replace(/^```/, "").replace(/```$/, "").trim();
      const parsed = JSON.parse(text);

      if (userId) {
        await enqueueWebSocketEvent({
          target: "user",
          room: userId.toString(),
          event: "ai:task_breakdown_ready",
          data: { taskId, suggestions: parsed.subtasks || [] },
        });
      }

      return { processed: true, taskId, suggestions: parsed.subtasks };
    } catch (err) {
      console.warn("[AI Worker] Warning:", err.message);
      return { fallback: true };
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
