const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const backendPkg = require("../package.json");

const FALLBACK_HARDCODED_VERSION = "1.0.1";
const SERVER_BOOT_BUILD_ID = `srv-${crypto.randomBytes(4).toString("hex")}`;
const SERVER_BOOT_AT = new Date().toISOString();

let cachedSnap = {
  checkedAt: 0,
  mtimeMs: -1,
  data: {
    version: process.env.APP_VERSION?.trim() || backendPkg.version || FALLBACK_HARDCODED_VERSION,
    buildId: process.env.APP_BUILD_ID?.trim() || SERVER_BOOT_BUILD_ID,
    builtAt: SERVER_BOOT_AT,
    source: process.env.APP_BUILD_ID?.trim() ? "env" : "server-boot",
  },
};

function resolveVersionFilePath() {
  const candidates = [
    process.env.WEB_DIST_DIR ? path.join(process.env.WEB_DIST_DIR, "version.json") : "",
    path.resolve(__dirname, "../../Web/dist/version.json"),
    "/app/Web/dist/version.json",
  ].filter(Boolean);

  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p;
    } catch {
      // ignore fs access errors
    }
  }
  return "";
}

/**
 * Returns the active deployed web build metadata (`version`, `buildId`, `builtAt`).
 * Priority: explicit `APP_VERSION`/`APP_BUILD_ID` env overrides -> `Web/dist/version.json` -> package.json/boot fallback.
 */
function getAppVersionInfo() {
  const now = Date.now();
  const envVersion = String(process.env.APP_VERSION || "").trim();
  const envBuildId = String(process.env.APP_BUILD_ID || "").trim();

  if (now - cachedSnap.checkedAt < 5000 && !envBuildId) {
    return envVersion ? { ...cachedSnap.data, version: envVersion } : cachedSnap.data;
  }

  const filePath = resolveVersionFilePath();
  if (!filePath) {
    cachedSnap = {
      checkedAt: now,
      mtimeMs: -1,
      data: {
        version: envVersion || backendPkg.version || FALLBACK_HARDCODED_VERSION,
        buildId: envBuildId || SERVER_BOOT_BUILD_ID,
        builtAt: SERVER_BOOT_AT,
        source: envBuildId ? "env" : "server-boot",
      },
    };
    return cachedSnap.data;
  }

  try {
    const stat = fs.statSync(filePath);
    if (stat.mtimeMs !== cachedSnap.mtimeMs || envBuildId || envVersion) {
      const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
      cachedSnap = {
        checkedAt: now,
        mtimeMs: stat.mtimeMs,
        data: {
          version: envVersion || String(raw?.version || backendPkg.version || FALLBACK_HARDCODED_VERSION),
          buildId: envBuildId || String(raw?.buildId || SERVER_BOOT_BUILD_ID),
          builtAt: String(raw?.builtAt || new Date(stat.mtimeMs).toISOString()),
          source: envBuildId ? "env" : "web-dist",
        },
      };
    } else {
      cachedSnap.checkedAt = now;
    }
  } catch {
    cachedSnap.checkedAt = now;
  }

  return cachedSnap.data;
}

function isUpdateAvailableForClient(clientInfo = {}, serverInfo = getAppVersionInfo()) {
  const clientBuildId = String(clientInfo?.buildId || clientInfo?.clientBuildId || "").trim();
  const clientVersion = String(clientInfo?.version || clientInfo?.clientVersion || "").trim();
  if (!clientBuildId || clientBuildId === "dev") return false;
  if (!serverInfo?.buildId || String(serverInfo.buildId).startsWith("srv-")) {
    return Boolean(clientVersion && serverInfo?.version && clientVersion !== String(serverInfo.version));
  }
  return (
    clientBuildId !== String(serverInfo.buildId) ||
    Boolean(clientVersion && serverInfo?.version && clientVersion !== String(serverInfo.version))
  );
}

module.exports = {
  FALLBACK_HARDCODED_VERSION,
  getAppVersionInfo,
  isUpdateAvailableForClient,
};
