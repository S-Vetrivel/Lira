const crypto = require("crypto");
const batchLogger = require("../services/batchLogger");

/**
 * Mask sensitive credentials and tokens in request payload before logging
 */
function sanitizePayload(obj) {
  if (!obj || typeof obj !== "object") return obj;

  const sensitiveKeys = new Set([
    "password",
    "confirmpassword",
    "secret",
    "token",
    "jwt",
    "authorization",
    "cookie",
    "refreshtoken",
    "accesstoken",
    "apikey",
    "api_key",
    "secretkey",
    "encryptedkey",
    "openaikey",
    "anthropickey",
    "geminikey",
    "key",
  ]);

  if (Array.isArray(obj)) {
    return obj.slice(0, 20).map(sanitizePayload);
  }

  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.has(lowerKey)) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = sanitizePayload(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

/**
 * Derives a human-readable action name from route and HTTP method
 */
function inferActionName(req) {
  const method = req.method.toUpperCase();
  const path = req.path || req.originalUrl || "/";

  // Auth actions
  if (path.includes("/auth/login")) return "AUTH_LOGIN";
  if (path.includes("/auth/signup")) return "AUTH_SIGNUP";
  if (path.includes("/auth/logout")) return "AUTH_LOGOUT";
  if (path.includes("/auth/google/onetap")) return "AUTH_GOOGLE_ONETAP";
  if (path.includes("/auth/google")) return "AUTH_GOOGLE_OAUTH";
  if (path.includes("/auth/demo-login")) return "AUTH_DEMO_LOGIN";
  if (path.includes("/auth/reset-password")) return "AUTH_RESET_PASSWORD";

  // Task actions
  if (path.includes("/tasks")) {
    if (method === "POST") return "TASK_CREATE";
    if (method === "PUT" || method === "PATCH") return "TASK_UPDATE";
    if (method === "DELETE") return "TASK_DELETE";
    return "TASK_READ";
  }

  // Project actions
  if (path.includes("/projects")) {
    if (method === "POST") return "PROJECT_CREATE";
    if (method === "PUT" || method === "PATCH") return "PROJECT_UPDATE";
    if (method === "DELETE") return "PROJECT_DELETE";
    return "PROJECT_READ";
  }

  // File actions
  if (path.includes("/files") || path.includes("/media")) {
    if (method === "POST") return "FILE_UPLOAD";
    if (method === "DELETE") return "FILE_DELETE";
    return "FILE_READ";
  }

  // Requests, Departments, Roles, Audit
  if (path.includes("/requests")) {
    if (path.includes("/approve")) return "REQUEST_APPROVE";
    if (path.includes("/reject")) return "REQUEST_REJECT";
    if (method === "POST") return "REQUEST_CREATE";
    return "REQUEST_READ";
  }
  if (path.includes("/departments")) {
    if (path.includes("/members")) return method === "DELETE" ? "DEPT_MEMBER_REMOVE" : "DEPT_MEMBER_ADD";
    if (method === "POST") return "DEPT_CREATE";
    if (method === "PUT" || method === "PATCH") return "DEPT_UPDATE";
    if (method === "DELETE") return "DEPT_DELETE";
    return "DEPT_READ";
  }
  if (path.includes("/roles")) {
    if (path.includes("/assign")) return "ROLE_ASSIGN_USER";
    if (method === "POST") return "ROLE_CREATE";
    if (method === "PUT" || method === "PATCH") return "ROLE_UPDATE";
    if (method === "DELETE") return "ROLE_DELETE";
    return "ROLE_READ";
  }
  if (path.includes("/audit")) return "AUDIT_QUERY";

  // Comments & Chat
  if (path.includes("/comments")) return `COMMENT_${method}`;
  if (path.includes("/chat/messages") && path.includes("/pin")) return "CHAT_PIN_TOGGLE";
  if (path.includes("/chat")) return `CHAT_${method}`;

  // Users & Admin
  if (path.includes("/users/join-requests") && path.includes("/approve")) return "JOIN_REQUEST_APPROVE";
  if (path.includes("/users/join-requests") && path.includes("/reject")) return "JOIN_REQUEST_REJECT";
  if (path.includes("/users")) return `USER_${method}`;
  if (path.includes("/admin")) return `ADMIN_${method}`;
  if (path.includes("/analytics")) return "ANALYTICS_QUERY";

  return `${method}_${path.split("/").filter(Boolean).slice(0, 2).join("_").toUpperCase() || "ROOT"}`;
}

/**
 * Action Logger Middleware:
 * Non-blocking, tracks all backend requests and operations, measures execution time,
 * and passes enriched action data to the batched logger for timed disk and DB preservation.
 */
function actionLoggerMiddleware(req, res, next) {
  const pathUrl = req.path || req.originalUrl || "/";
  // Skip high-frequency health/polling read endpoints to keep audit log high-signal
  if (
    pathUrl.endsWith("/ping") ||
    pathUrl.endsWith("/health") ||
    (req.method === "GET" && (pathUrl.includes("/notifications") || pathUrl.includes("/chat/conversations") || pathUrl.includes("/audit")))
  ) {
    return next();
  }

  const startTime = process.hrtime.bigint();
  const actionId = crypto.randomUUID();

  // Attach actionId to request and response headers for correlation
  req.actionId = actionId;
  res.setHeader("X-Action-Id", actionId);

  // Hook into response completion
  res.on("finish", () => {
    try {
      const endTime = process.hrtime.bigint();
      const durationMs = Number((endTime - startTime) / 1000000n);

      const clientIp =
        req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
        req.socket?.remoteAddress ||
        req.ip ||
        "127.0.0.1";

      const userAgent = req.headers["user-agent"] || "Unknown";
      const actionName = inferActionName(req);

      const user = req.user?._id || req.user?.id || null;
      const userEmail = req.user?.email || null;
      const userName = req.user?.fullname || null;
      const userPublicId = req.user?.publicId || null;
      const userRole = req.user?.role || "guest";

      const statusCode = res.statusCode;
      const status = statusCode >= 400 ? "FAILURE" : "SUCCESS";

      // Build clean sanitized details
      const details = {
        query: req.query && Object.keys(req.query).length > 0 ? req.query : undefined,
        params: req.params && Object.keys(req.params).length > 0 ? req.params : undefined,
        body: req.body && Object.keys(req.body).length > 0 ? sanitizePayload(req.body) : undefined,
      };

      const logEntry = {
        actionId,
        action: actionName,
        method: req.method,
        url: req.originalUrl || req.url,
        path: req.path,
        statusCode,
        durationMs,
        ip: clientIp,
        userAgent,
        user,
        userEmail,
        userName,
        userPublicId,
        userRole,
        status,
        details,
        timestamp: new Date(),
      };

      // Submit to Batched Logger
      batchLogger.log(logEntry);
    } catch (err) {
      console.error("⚠️ [ActionLoggerMiddleware] Error recording log:", err.message);
    }
  });

  next();
}

module.exports = {
  actionLoggerMiddleware,
  sanitizePayload,
  inferActionName,
};

