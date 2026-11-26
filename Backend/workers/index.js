const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const { assertRequiredSecrets } = require("../utils/envSecrets");
assertRequiredSecrets();
const connectMongo = require("../config/connectMongo");
const { connection } = require("../services/queue");

let workersStarted = false;

const startWorkers = async () => {
  if (workersStarted) return;
  workersStarted = true;

  try {
    console.log("🔄 [Worker Engine] Initializing Unified BullMQ Workers...");
    await connectMongo();

    // Initialize all background BullMQ workers
    const websocketWorker = require("./websocketWorker");
    const notificationWorker = require("./notificationWorker");
    const activityWorker = require("./activityWorker");
    const taskMetricsWorker = require("./taskMetricsWorker");
    const aiWorker = require("./aiWorker");
    const fileSharingWorker = require("./fileSharingWorker");
    const routineSchedulerWorker = require("./routineSchedulerWorker");
    const mediaWorker = require("./mediaWorker");
    const emailWorker = require("./emailWorker");
    const { enqueueRoutineJob } = require("../services/queue");

    console.log("🚀 [Worker Engine] 9 Unified Background Queue Workers active:");
    console.log("   ⚡ 1. WebSocket Broadcast Worker (concurrency: 10)");
    console.log("   🔔 2. Notification Processor Worker (concurrency: 5)");
    console.log("   📝 3. Audit Activity Log Worker (concurrency: 5)");
    console.log("   📊 4. Task Metrics & Analytics Worker (concurrency: 3)");
    console.log("   🧠 5. Distributed Lira AI Worker (concurrency: 6)");
    console.log("   📁 6. File Sharing & Verification Worker (concurrency: 5)");
    console.log("   ⏰ 7. Routine Scheduler & Escalation Worker (concurrency: 2)");
    console.log("   🖼️  8. Media Sharp & MinIO Worker (concurrency: 4)");
    console.log("   📧 9. SMTP Email Notification Worker (concurrency: 3)");

    // Schedule recurring routine trigger every 60 seconds
    const routineInterval = setInterval(() => {
      enqueueRoutineJob();
    }, 60000);

    // Graceful shutdown
    const shutdown = async () => {
      console.log("🛑 Stopping background workers...");
      clearInterval(routineInterval);
      await Promise.allSettled([
        websocketWorker.close(),
        notificationWorker.close(),
        activityWorker.close(),
        taskMetricsWorker.close(),
        aiWorker.close(),
        fileSharingWorker.close(),
        routineSchedulerWorker.close(),
        mediaWorker.close(),
        emailWorker.close(),
        connection.quit(),
      ]);
      console.log("✅ All unified background workers gracefully closed");
      if (require.main === module) process.exit(0);
    };

    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);

    return {
      websocketWorker,
      notificationWorker,
      activityWorker,
      taskMetricsWorker,
      aiWorker,
      fileSharingWorker,
      routineSchedulerWorker,
      mediaWorker,
      emailWorker,
      shutdown,
    };
  } catch (error) {
    console.error("❌ Unified worker startup failed:", error);
    if (require.main === module) process.exit(1);
    throw error;
  }
};

if (require.main === module) {
  (async () => {
    await startWorkers();
    try {
      const { resumePendingAssistantJobs } = require("../services/aiAssistantService");
      await resumePendingAssistantJobs();
    } catch (err) {
      console.warn("⚠️ [Worker Engine] Resume pending AI jobs skipped:", err.message);
    }
  })();
}

module.exports = { startWorkers };
