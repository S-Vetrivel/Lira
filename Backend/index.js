require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");
const passport = require("passport");
const { createServer } = require("http");

require("./config/passport")(passport);
const connectMongo = require("./config/connectMongo");

const app = express();
const server = createServer(app);

// -----------------
// FEATURE TOGGLE
// -----------------
const USE_MINIO = process.env.USE_MINIO === "true";

// -----------------
// CONDITIONAL MINIO LOAD
// -----------------
let minioClient, BUCKET_NAME;
if (USE_MINIO) {
  const minio = require("./config/minio");
  minioClient = minio;
  BUCKET_NAME = process.env.MINIO_BUCKET_NAME;
}

// -----------------
// DIAGNOSTIC MIDDLEWARE (TOP)
// -----------------
app.use((req, res, next) => {
  res.setHeader("X-Backend-Hit", "true");
  // Log all requests to console
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// -----------------
// MIDDLEWARE
// -----------------
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  })
);

app.use(cookieParser());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(bodyParser.json({ limit: "50mb" }));
app.use(passport.initialize());

// -----------------
// ROUTES
// -----------------

// 1. Minio Proxy for uploads
app.get(/^\/(?:api\/)?uploads\/(.+)$/, async (req, res) => {
  if (!USE_MINIO || !minioClient) {
    return res.status(404).send("Storage provider not enabled");
  }

  const objectName = req.params[0];
  try {
    const stream = await minioClient.getObject(BUCKET_NAME, objectName);
    stream.pipe(res);
  } catch (err) {
    res.status(404).send("File not found");
  }
});

// 2. Health & Ping (Bypass DB)
app.get("/api/ping", (req, res) => res.send("pong"));
app.get("/api/health", (req, res) => res.json({ status: "alive" }));

// 3. Main API Routes
app.use("/api", require("./routes/index"));

// 4. Catch-all for unmatched /api routes
app.use("/api", (req, res) => {
  console.log(`[404 DEBUG] Unmatched API path: ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found on this server`,
  });
});

// -----------------
// STARTUP
// -----------------
const port = 5000; // Forced to 5000 to match Nginx proxy_pass and avoid conflict with Nginx on 3000

// Listen IMMEDIATELY so we can debug connectivity
server.listen(port, "0.0.0.0", () => {
  console.log(`☑️ Backend server listening on port ${port}`);
  console.log(`>>> DIAGNOSTIC: Try visiting /api/ping <<<`);
});

// Background DB Connection (Don't let it crash the server)
(async () => {
  try {
    await connectMongo();
    console.log("✅ MongoDB initialization complete");
  } catch (err) {
    console.error("❌ MONGODB INITIALIZATION FAILED:", err.message);
    // We stay alive so the user can still hit /api/ping to verify Nginx
  }
})();

// -----------------
// GRACEFUL SHUTDOWN
// -----------------
const mongoose = require("mongoose");
mongoose.connection.on("disconnected", () => {
  console.warn("⚠️ MongoDB disconnected");
});
