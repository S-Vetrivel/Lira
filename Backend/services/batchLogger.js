const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const mongoose = require("mongoose");
const ActionLog = require("../models/actionLogModel");

class BatchedLogger {
  constructor(options = {}) {
    this.batchSize = options.batchSize || 50;
    this.flushIntervalMs = options.flushIntervalMs || 3000; // Flush at least every 3 seconds
    this.maxBufferSize = options.maxBufferSize || 5000;
    this.retentionDays = options.retentionDays || 30; // Timed logs preservation retention
    this.logsDir = path.resolve(__dirname, "../.logs");

    this.buffer = [];
    this.isFlushing = false;
    this.flushTimer = null;
    this.preservationTimer = null;

    // Statistics & Metrics
    this.stats = {
      totalLogged: 0,
      batchesFlushed: 0,
      failedFlushes: 0,
      lastFlushTime: null,
      lastPreservationTime: null,
      startedAt: new Date().toISOString(),
    };

    this.ensureDirectory();
    this.startTimedFlush();
    this.startTimedPreservation();
    this.registerProcessHooks();
  }

  ensureDirectory() {
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }
  }

  startTimedFlush() {
    if (this.flushTimer) clearInterval(this.flushTimer);
    this.flushTimer = setInterval(() => {
      if (this.buffer.length > 0 && !this.isFlushing) {
        this.flush().catch((err) => {
          console.error("⚠️ [BatchedLogger] Timed flush error:", err.message);
        });
      }
    }, this.flushIntervalMs);

    if (this.flushTimer.unref) {
      this.flushTimer.unref();
    }
  }

  startTimedPreservation() {
    if (this.preservationTimer) clearInterval(this.preservationTimer);
    this.preservationTimer = setInterval(() => {
      this.runPreservationCycle().catch((err) => {
        console.error("⚠️ [BatchedLogger] Hourly preservation cycle error:", err.message);
      });
    }, 60 * 60 * 1000);

    if (this.preservationTimer.unref) {
      this.preservationTimer.unref();
    }
  }

  /**
   * Enqueue action log entry into the batch buffer
   */
  log(entry) {
    if (!entry) return;

    const formattedEntry = {
      actionId: entry.actionId || crypto.randomUUID(),
      action: entry.action || "HTTP_ACTION",
      method: entry.method || "GET",
      url: entry.url || "/",
      path: entry.path || "/",
      statusCode: Number(entry.statusCode) || 200,
      durationMs: Number(entry.durationMs) || 0,
      ip: entry.ip || "127.0.0.1",
      userAgent: entry.userAgent || "Unknown",
      user: entry.user || null,
      userEmail: entry.userEmail || null,
      userRole: entry.userRole || "guest",
      status: entry.status || (entry.statusCode >= 400 ? "FAILURE" : "SUCCESS"),
      details: entry.details || {},
      error: entry.error || null,
      timestamp: entry.timestamp || new Date(),
    };

    if (this.buffer.length >= this.maxBufferSize) {
      // Force flush if buffer hits high watermark
      console.warn("⚠️ [BatchedLogger] Buffer threshold reached, forcing sync flush");
      this.flushSync();
    }

    this.buffer.push(formattedEntry);
    this.stats.totalLogged++;

    // Immediate flush trigger if batch size reached
    if (this.buffer.length >= this.batchSize && !this.isFlushing) {
      this.flush().catch((err) => {
        console.error("⚠️ [BatchedLogger] Batch threshold flush error:", err.message);
      });
    }
  }

  /**
   * Asynchronous batch flush with disk preservation and DB persistence
   */
  async flush() {
    if (this.isFlushing || this.buffer.length === 0) return;

    this.isFlushing = true;
    const batch = this.buffer.splice(0, this.buffer.length);

    try {
      const today = new Date().toISOString().slice(0, 10);
      const actionLogPath = path.join(this.logsDir, `actions-${today}.log`);
      const errorLogPath = path.join(this.logsDir, `errors-${today}.log`);

      const actionLines = batch.map((item) => JSON.stringify(item)).join("\n") + "\n";
      await fs.promises.appendFile(actionLogPath, actionLines, "utf8");

      const errors = batch.filter((item) => item.statusCode >= 400 || item.error);
      if (errors.length > 0) {
        const errorLines = errors.map((item) => JSON.stringify(item)).join("\n") + "\n";
        await fs.promises.appendFile(errorLogPath, errorLines, "utf8");
      }

      // Persist to MongoDB when database connection is ready
      if (mongoose.connection && mongoose.connection.readyState === 1) {
        try {
          await ActionLog.insertMany(batch, { ordered: false });
        } catch (dbErr) {
          // Tolerant if duplicate keys or DB is temporarily reconnecting
          if (!dbErr.message.includes("E11000")) {
            console.warn("⚠️ [BatchedLogger] DB batch insert note:", dbErr.message);
          }
        }
      }

      this.stats.batchesFlushed++;
      this.stats.lastFlushTime = new Date().toISOString();
    } catch (err) {
      this.stats.failedFlushes++;
      console.error("❌ [BatchedLogger] Flush failed:", err.message);
      // Re-queue items that failed disk write so they aren't lost
      this.buffer.unshift(...batch);
    } finally {
      this.isFlushing = false;
    }
  }

  /**
   * Synchronous emergency flush used on process termination (SIGINT, SIGTERM, beforeExit)
   */
  flushSync() {
    if (this.buffer.length === 0) return;
    const batch = this.buffer.splice(0, this.buffer.length);

    try {
      this.ensureDirectory();
      const today = new Date().toISOString().slice(0, 10);
      const actionLogPath = path.join(this.logsDir, `actions-${today}.log`);
      const errorLogPath = path.join(this.logsDir, `errors-${today}.log`);

      const actionLines = batch.map((item) => JSON.stringify(item)).join("\n") + "\n";
      fs.appendFileSync(actionLogPath, actionLines, "utf8");

      const errors = batch.filter((item) => item.statusCode >= 400 || item.error);
      if (errors.length > 0) {
        const errorLines = errors.map((item) => JSON.stringify(item)).join("\n") + "\n";
        fs.appendFileSync(errorLogPath, errorLines, "utf8");
      }

      this.stats.batchesFlushed++;
      this.stats.lastFlushTime = new Date().toISOString();
      console.log(`💾 [BatchedLogger] Synced emergency flush of ${batch.length} logs to disk`);
    } catch (err) {
      console.error("❌ [BatchedLogger] Emergency sync flush failed:", err.message);
    }
  }

  /**
   * Timed logs preservation cycle: manages retention, verifies log manifests & files
   */
  async runPreservationCycle() {
    try {
      this.ensureDirectory();
      const files = await fs.promises.readdir(this.logsDir);
      const now = Date.now();
      const retentionMs = this.retentionDays * 24 * 60 * 60 * 1000;

      const manifest = {
        updatedAt: new Date().toISOString(),
        retentionDays: this.retentionDays,
        preservedFiles: [],
        purgedFiles: [],
        totalBytesPreserved: 0,
      };

      for (const file of files) {
        if (!file.endsWith(".log")) continue;

        const filePath = path.join(this.logsDir, file);
        const stats = await fs.promises.stat(filePath);

        // Check age of log file
        const ageMs = now - stats.mtimeMs;
        if (ageMs > retentionMs) {
          await fs.promises.unlink(filePath);
          manifest.purgedFiles.push(file);
          console.log(`🧹 [BatchedLogger] Preserved retention cutoff: Purged expired log ${file}`);
        } else {
          manifest.preservedFiles.push({
            name: file,
            sizeBytes: stats.size,
            lastModified: stats.mtime.toISOString(),
          });
          manifest.totalBytesPreserved += stats.size;
        }
      }

      const manifestPath = path.join(this.logsDir, "preservation-manifest.json");
      await fs.promises.writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");

      this.stats.lastPreservationTime = new Date().toISOString();
    } catch (err) {
      console.error("⚠️ [BatchedLogger] Timed preservation cycle error:", err.message);
    }
  }

  registerProcessHooks() {
    const handleExit = (signal) => {
      console.log(`🛑 [BatchedLogger] Process received ${signal}. Flushing remaining logs...`);
      this.flushSync();
    };

    process.once("beforeExit", () => handleExit("beforeExit"));
    process.once("SIGINT", () => handleExit("SIGINT"));
    process.once("SIGTERM", () => handleExit("SIGTERM"));
  }

  getMetrics() {
    return {
      ...this.stats,
      bufferedCount: this.buffer.length,
      batchSize: this.batchSize,
      flushIntervalMs: this.flushIntervalMs,
      retentionDays: this.retentionDays,
    };
  }
}

// Global Singleton Instance
const batchLogger = new BatchedLogger({
  batchSize: 50,
  flushIntervalMs: 3000,
  retentionDays: 30,
});

module.exports = batchLogger;
