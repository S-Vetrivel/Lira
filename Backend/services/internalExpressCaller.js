const EventEmitter = require("events");
const { actionLoggerMiddleware } = require("../middleware/actionLogger");

// Non-serializable process-local symbol so external HTTP requests can NEVER spoof an internal actor
const INTERNAL_USER_SYMBOL = Symbol("lira_internal_copilot_actor");

let cachedPipeline = null;

function getInternalV3Pipeline() {
  if (cachedPipeline) return cachedPipeline;
  const express = require("express");
  const app = express();
  app.use(actionLoggerMiddleware);
  app.use("/v3", require("../routes/index"));
  // Final JSON error fallback
  app.use((err, _req, res, _next) => {
    const code = err?.status || err?.statusCode || 500;
    res.status(code).json({ success: false, message: err?.message || "Internal Workspace Action Error" });
  });
  cachedPipeline = app;
  return cachedPipeline;
}

/**
 * Invoke any `/v3/...` Express route in-process without opening a loopback TCP socket or signing a JWT.
 * Preserves identical Express routing, RBAC guards (`protect` / `requireSuperAdmin`), `ActionLog` audit trails,
 * mongoose validation, and real-time Socket.IO / Redis PubSub broadcasts.
 */
function callProtectedBackendAPI({ user, method = "GET", path = "/", data = undefined, params = undefined }) {
  return new Promise((resolve, reject) => {
    if (!user || !user._id) {
      return reject(new Error("Authenticated workspace actor is required"));
    }

    const app = getInternalV3Pipeline();
    const upperMethod = String(method || "GET").toUpperCase();
    const qs =
      params && typeof params === "object" && Object.keys(params).length > 0
        ? `?${new URLSearchParams(params).toString()}`
        : "";
    const fullPath = `/v3${path.startsWith("/") ? path : `/${path}`}${qs}`;

    const req = new EventEmitter();
    req.method = upperMethod;
    req.url = fullPath;
    req.originalUrl = fullPath;
    req.baseUrl = "";
    req.path = fullPath.split("?")[0];
    req.query = params && typeof params === "object" ? { ...params } : {};
    req.params = {};
    req.cookies = {};
    req.body = data && typeof data === "object" ? data : {};
    req.ip = "127.0.0.1";
    req.socket = { remoteAddress: "127.0.0.1" };
    req.connection = req.socket;
    req.headers = {
      "content-type": "application/json",
      "user-agent": "Lira-Internal-Copilot",
      "x-copilot-actor": "true",
    };
    req.get = (name) => req.headers[String(name || "").toLowerCase()];
    req.header = req.get;
    req[INTERNAL_USER_SYMBOL] = user;

    const res = new EventEmitter();
    res.statusCode = 200;
    res.headersSent = false;
    res._headers = {};
    res.locals = {};
    res.status = (code) => {
      res.statusCode = Number(code) || 200;
      return res;
    };
    res.set = (k, v) => {
      if (typeof k === "string") res._headers[k.toLowerCase()] = v;
      return res;
    };
    res.setHeader = res.set;
    res.getHeader = (k) => res._headers[String(k || "").toLowerCase()];
    res.removeHeader = (k) => {
      delete res._headers[String(k || "").toLowerCase()];
    };
    res.type = (val) => {
      res._headers["content-type"] = val;
      return res;
    };

    let settled = false;
    const finishResponse = (payload) => {
      if (settled) return;
      settled = true;
      res.headersSent = true;
      res.finished = true;
      try {
        res.emit("finish");
      } catch {
        // non-fatal audit emitter error
      }
      if (res.statusCode >= 400) {
        const msg =
          (payload && typeof payload === "object" && payload.message) ||
          (typeof payload === "string" ? payload : "Workspace action failed");
        console.warn(`[LIRA COPILOT] GUARD_REJECTED user=${user?.email} ${upperMethod} ${path} status=${res.statusCode} msg=${msg}`);
        return reject(new Error(msg));
      }
      resolve(payload);
    };

    res.json = (payload) => finishResponse(payload);
    res.send = (payload) => {
      if (typeof payload === "string") {
        try {
          return finishResponse(JSON.parse(payload));
        } catch {
          return finishResponse(payload);
        }
      }
      return finishResponse(payload);
    };
    res.end = (chunk) => finishResponse(chunk);

    app.handle(req, res, (err) => {
      if (err) return reject(err);
      if (!settled) {
        res.statusCode = 404;
        finishResponse({ success: false, message: `Internal route not found: ${fullPath}` });
      }
    });
  });
}

module.exports = {
  INTERNAL_USER_SYMBOL,
  callProtectedBackendAPI,
};

