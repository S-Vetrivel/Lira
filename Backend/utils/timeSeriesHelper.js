/**
 * Time-bucketing utility supporting granular telemetry windows from 1 hour up to 30 days.
 */
const RANGE_PRESETS = {
  "1h": { buckets: 12, stepMs: 5 * 60 * 1000, mode: "minute", label: "Last 1 Hour (5m)" },
  "6h": { buckets: 12, stepMs: 30 * 60 * 1000, mode: "minute", label: "Last 6 Hours (30m)" },
  "24h": { buckets: 24, stepMs: 60 * 60 * 1000, mode: "hour", label: "Last 24 Hours (Hourly)" },
  "7d": { buckets: 7, stepMs: 24 * 60 * 60 * 1000, mode: "day", label: "Last 7 Days (Daily)" },
  "14d": { buckets: 14, stepMs: 24 * 60 * 60 * 1000, mode: "day", label: "Last 14 Days (Daily)" },
  "30d": { buckets: 30, stepMs: 24 * 60 * 60 * 1000, mode: "day", label: "Last 30 Days (Daily)" },
};

function normalizeTelemetryRange(rawRange = "24h") {
  const key = String(rawRange || "24h").trim().toLowerCase();
  if (key === "hour" || key === "hourly") return "24h";
  if (key === "day") return "24h";
  if (key === "week") return "7d";
  if (key === "month") return "30d";
  return RANGE_PRESETS[key] ? key : "24h";
}

function formatBucketLabel(date, mode) {
  if (mode === "minute" || mode === "hour") {
    return date.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Kolkata",
    });
  }
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    timeZone: "Asia/Kolkata",
  });
}

function formatBucketFullLabel(date, mode) {
  if (mode === "day") {
    return date.toLocaleDateString("en-IN", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "Asia/Kolkata",
    });
  }
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Kolkata",
  });
}

/**
 * Align and build N contiguous time buckets ending at the current time window.
 */
function buildTimeBuckets(rawRange = "24h", nowDate = new Date()) {
  const rangeKey = normalizeTelemetryRange(rawRange);
  const cfg = RANGE_PRESETS[rangeKey];
  const nowMs = nowDate.getTime();
  const alignedEndMs = Math.floor(nowMs / cfg.stepMs) * cfg.stepMs + cfg.stepMs;
  const startMs = alignedEndMs - cfg.buckets * cfg.stepMs;

  const buckets = [];
  for (let i = 0; i < cfg.buckets; i++) {
    const bStart = startMs + i * cfg.stepMs;
    const bEnd = bStart + cfg.stepMs;
    const d = new Date(bStart);
    buckets.push({
      index: i,
      startMs: bStart,
      endMs: bEnd,
      iso: d.toISOString(),
      label: formatBucketLabel(d, cfg.mode),
      fullLabel: formatBucketFullLabel(d, cfg.mode),
    });
  }

  return {
    range: rangeKey,
    rangeLabel: cfg.label,
    stepMs: cfg.stepMs,
    windowStart: new Date(startMs),
    windowEnd: new Date(alignedEndMs),
    buckets,
  };
}

function findBucketIndex(dateValue, startMs, stepMs, bucketCount) {
  const ms = new Date(dateValue).getTime();
  if (Number.isNaN(ms) || ms < startMs) return -1;
  const idx = Math.floor((ms - startMs) / stepMs);
  if (idx < 0 || idx >= bucketCount) return -1;
  return idx;
}

module.exports = {
  RANGE_PRESETS,
  normalizeTelemetryRange,
  buildTimeBuckets,
  findBucketIndex,
};

