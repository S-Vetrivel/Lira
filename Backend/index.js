const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, ".env") });
const { assertRequiredSecrets } = require("./utils/envSecrets");
assertRequiredSecrets();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");
const passport = require("passport");
const { createServer } = require("http");
const fs = require("fs");

require("./config/passport")(passport);
const connectMongo = require("./config/connectMongo");
const { initSocket } = require("./config/socket");
const seedDatabase = require("./utils/seeder");
const { actionLoggerMiddleware } = require("./middleware/actionLogger");

const app = express();
const server = createServer(app);

// -----------------
// INITIALIZE WEBSOCKET WITH REDIS ADAPTER
// -----------------
initSocket(server);

// -----------------
// CORS & SECURITY HEADERS
// -----------------
const allowedOrigins = [
  process.env.CLIENT_URL,
  process.env.FRONTEND_URL,
  "http://localhost:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or same-origin)
      if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== "production") {
        return callback(null, true);
      }
      return callback(null, true); // Permissive in development
    },
    credentials: true,
  })
);

app.use(cookieParser());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(bodyParser.json({ limit: "50mb" }));
app.use((req, _res, next) => {
  if (req.body === undefined) req.body = {};
  next();
});
app.use(passport.initialize());

// -----------------
// BATCHED ACTION LOGGER MIDDLEWARE (Logs all requests & actions)
// -----------------
app.use(actionLoggerMiddleware);

// -----------------
// STATIC UPLOADS DIRECTORY
// -----------------
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
app.use("/api/uploads", express.static(uploadDir));
app.use("/uploads", express.static(uploadDir));

const mongoose = require("mongoose");
const minioService = require("./services/minioService");
const { getQueueHealth, closeQueues } = require("./services/queue");
const { getIO } = require("./config/socket");
const { getAppVersionInfo } = require("./utils/appVersion");
const { startWorkers } = require("./workers/index");
const { resumePendingAssistantJobs } = require("./services/aiAssistantService");

// -----------------
// ROUTES
// -----------------
app.get("/v3/ping", (req, res) => res.send("pong"));
app.get(["/v3/app-version", "/api/app-version"], (req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.json({ success: true, ...getAppVersionInfo() });
});
app.get("/v3/health", async (req, res) => {
  const queueHealth = await getQueueHealth();
  const minioHealth = await minioService.checkHealth();
  res.json({
    status: "alive",
    pid: process.pid,
    port,
    minio: minioHealth,
    queues: queueHealth,
  });
});
app.get("/api/ping", (req, res) => res.send("pong"));
app.get("/api/health", (req, res) => res.json({ status: "alive", pid: process.pid }));

// Static uploads directory with MinIO storage streaming fallback
app.use("/v3/uploads", express.static(uploadDir));
app.use("/api/uploads", express.static(uploadDir));
app.use("/uploads", express.static(uploadDir));

const streamFromMinio = async (req, res, next) => {
  const objectKey = req.path.replace(/^\//, "");
  if (!objectKey) return next();
  try {
    const stream = await minioService.getFileStream(objectKey);
    if (stream) {
      return stream.pipe(res);
    }
  } catch (err) {
    // pass through to next
  }
  next();
};
app.use("/v3/uploads", streamFromMinio);
app.use("/api/uploads", streamFromMinio);
app.use("/uploads", streamFromMinio);

// Direct /v3/auth and /auth route mounts to support standard OAuth redirects
app.use("/v3/auth", require("./routes/authRoutes"));
app.use("/auth", require("./routes/authRoutes"));

// Main API Routes: Primary /v3 endpoint & legacy aliases
app.use("/v3", require("./routes/index"));
app.use("/api", require("./routes/index"));
app.use("/v3/api", require("./routes/index"));

// 404 handler for API routes
app.use(["/v3", "/api"], (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found on this server`,
  });
});

// -----------------
// GLOBAL ERROR HANDLER
// -----------------
app.use((err, req, res, next) => {
  console.error(`[Global Error] ${err.stack}`);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    success: false,
    message: err.message || "Internal Server Error",
    error: err.code || "UNKNOWN_ERROR",
  });
});

// -----------------
// STARTUP & DB INITIALIZATION
// -----------------
const port = process.env.PORT || 4000;

server.listen(port, "0.0.0.0", () => {
  console.log(`☑️ Lira Backend API listening on http://0.0.0.0:${port} (PID: ${process.pid})`);
});

let workerHandle = null;
let isShuttingDown = false;

async function gracefulShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`🛑 Received ${signal}, shutting down Lira Backend cleanly...`);

  const forceExitTimer = setTimeout(() => {
    process.exit(0);
  }, 5000);
  forceExitTimer.unref?.();

  try {
    await Promise.allSettled([
      new Promise((resolve) => server.close(() => resolve())),
      Promise.resolve().then(() => getIO()?.close?.()),
      workerHandle?.shutdown ? workerHandle.shutdown({ closeRedis: false, exit: false }) : Promise.resolve(),
    ]);
    await Promise.allSettled([
      mongoose.connection.readyState !== 0 ? mongoose.disconnect() : Promise.resolve(),
      closeQueues(),
    ]);
  } catch (err) {
    console.warn("⚠️ Graceful shutdown warning:", err.message);
  }
  console.log("✅ Lira Backend shutdown complete");
  if (signal === "SIGUSR2") {
    process.kill(process.pid, "SIGUSR2");
  } else {
    process.exit(0);
  }
}

process.once("SIGINT", () => gracefulShutdown("SIGINT"));
process.once("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.once("SIGUSR2", () => gracefulShutdown("SIGUSR2"));

// Connect to MongoDB, ensure MinIO bucket, seed workspace, and start unified queue workers
(async () => {
  try {
    await connectMongo();
    await seedDatabase();
    await minioService.ensureBucket();
    if (!process.env.WORKER_ROLE) {
      workerHandle = await startWorkers();
      await resumePendingAssistantJobs();
    }
  } catch (err) {
    console.error("❌ INITIALIZATION FAILED:", err.message);
  }
})();
