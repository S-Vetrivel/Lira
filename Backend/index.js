require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");
const passport = require("passport");
const { createServer } = require("http");
const path = require("path");
const fs = require("fs");

require("./config/passport")(passport);
const connectMongo = require("./config/connectMongo");
const { initSocket } = require("./config/socket");
const seedDatabase = require("./utils/seeder");

const app = express();
const server = createServer(app);

// -----------------
// INITIALIZE WEBSOCKET WITH REDIS ADAPTER
// -----------------
initSocket(server);

// -----------------
// MIDDLEWARE
// -----------------
app.use((req, res, next) => {
  res.setHeader("X-Backend-Hit", "true");
  if (req.method !== "GET" || !req.url.includes("/api/notifications")) {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  }
  next();
});

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
app.use(passport.initialize());

// -----------------
// STATIC UPLOADS DIRECTORY
// -----------------
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
app.use("/api/uploads", express.static(uploadDir));
app.use("/uploads", express.static(uploadDir));

// -----------------
// ROUTES
// -----------------
app.get("/api/ping", (req, res) => res.send("pong"));
app.get("/api/health", (req, res) => res.json({ status: "alive", pid: process.pid }));

// Main API Routes
app.use("/api", require("./routes/index"));

// 404 handler for API routes
app.use("/api", (req, res) => {
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
const port = process.env.PORT || 5000;

server.listen(port, "0.0.0.0", () => {
  console.log(`☑️ Lira Backend API listening on http://0.0.0.0:${port} (PID: ${process.pid})`);
});

// Connect to MongoDB & Seed initial office workspace
(async () => {
  try {
    await connectMongo();
    await seedDatabase();
  } catch (err) {
    console.error("❌ MONGODB / SEED INITIALIZATION FAILED:", err.message);
  }
})();
