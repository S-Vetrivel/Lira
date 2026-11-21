const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const connectMongo = require("../config/connectMongo");
const { connection } = require("../services/queue");

const startWorkers = async () => {
  try {
    console.log("🔄 [Worker Engine] Connecting to MongoDB and Redis...");
    await connectMongo();
    console.log("✅ [Worker Engine] MongoDB ready");

    // Initialize all background BullMQ workers
    const websocketWorker = require("./websocketWorker");
    const notificationWorker = require("./notificationWorker");
    const activityWorker = require("./activityWorker");
    const taskMetricsWorker = require("./taskMetricsWorker");
    const aiWorker = require("./aiWorker");
    const fileSharingWorker = require("./fileSharingWorker");
    const routineSchedulerWorker = require("./routineSchedulerWorker");
    const { enqueueRoutineJob } = require("../services/queue");

    console.log("🚀 [Worker Engine] 7 Background Queue Workers active:");
    console.log("   ⚡ 1. WebSocket Broadcast Worker (concurrency: 10)");
    console.log("   🔔 2. Notification Processor Worker (concurrency: 5)");
    console.log("   📝 3. Audit Activity Log Worker (concurrency: 5)");
    console.log("   📊 4. Task Metrics & Analytics Worker (concurrency: 3)");
    console.log("   🧠 5. Google AI Task Worker (concurrency: 2)");
    console.log("   📁 6. File Sharing & Verification Worker (concurrency: 5)");
    console.log("   ⏰ 7. Routine Scheduler & Escalation Worker (concurrency: 2)");

    // Schedule recurring routine trigger every 60 seconds
    const routineInterval = setInterval(() => {
      enqueueRoutineJob();
    }, 60000);
    enqueueRoutineJob(); // trigger immediate initial check

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
        connection.quit(),
      ]);
      console.log("✅ All background workers gracefully closed");
      process.exit(0);
    };

    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
  } catch (error) {
    console.error("❌ Worker startup failed:", error);
    process.exit(1);
  }
};

startWorkers();
