require("dotenv").config();
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

    console.log("🚀 [Worker Engine] 5 Background Queue Workers active:");
    console.log("   ⚡ 1. WebSocket Broadcast Worker (concurrency: 10)");
    console.log("   🔔 2. Notification Processor Worker (concurrency: 5)");
    console.log("   📝 3. Audit Activity Log Worker (concurrency: 5)");
    console.log("   📊 4. Task Metrics & Analytics Worker (concurrency: 3)");
    console.log("   🧠 5. Google AI Task Worker (concurrency: 2)");

    // Graceful shutdown
    const shutdown = async () => {
      console.log("🛑 Stopping background workers...");
      await Promise.allSettled([
        websocketWorker.close(),
        notificationWorker.close(),
        activityWorker.close(),
        taskMetricsWorker.close(),
        aiWorker.close(),
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
