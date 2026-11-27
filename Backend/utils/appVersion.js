const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const backendPkg = require("../package.json");

const SERVER_BOOT_BUILD_ID = `srv-${crypto.randomBytes(4).toString("hex")}`;
const SERVER_BOOT_AT = new Date().toISOString();

let cachedSnap = {
  checkedAt: 0,
  mtimeMs: -1,
  data: {
    version: backendPkg.version || "1.0.0",
    buildId: SERVER_BOOT_BUILD_ID,
    builtAt: SERVER_BOOT_AT,
    source: "server-boot",
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
 * Returns the active deployed web build metadata (`version`, `buildId`, `builtAt`),
 * re-checking `Web/dist/version.json` at most every 5 seconds so rebuilds propagate live.
 */
function getAppVersionInfo() {
  const now = Date.now();
  if (now - cachedSnap.checkedAt < 5000) {
    return cachedSnap.data;
  }

  const filePath = resolveVersionFilePath();
  if (!filePath) {
    cachedSnap = {
      checkedAt: now,
      mtimeMs: -1,
      data: {
        version: backendPkg.version || "1.0.0",
        buildId: SERVER_BOOT_BUILD_ID,
        builtAt: SERVER_BOOT_AT,
        source: "server-boot",
      },
    };
    return cachedSnap.data;
  }

  try {
    const stat = fs.statSync(filePath);
    if (stat.mtimeMs !== cachedSnap.mtimeMs) {
      const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
      cachedSnap = {
        checkedAt: now,
        mtimeMs: stat.mtimeMs,
        data: {
          version: String(raw?.version || backendPkg.version || "1.0.0"),
          buildId: String(raw?.buildId || SERVER_BOOT_BUILD_ID),
          builtAt: String(raw?.builtAt || new Date(stat.mtimeMs).toISOString()),
          source: "web-dist",
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
  if (!clientBuildId || clientBuildId === "dev") return false;
  if (!serverInfo?.buildId || String(serverInfo.buildId).startsWith("srv-")) {
    return false;
  }
  return clientBuildId !== String(serverInfo.buildId);
}

module.exports = {
  getAppVersionInfo,
  isUpdateAvailableForClient,
};

