require("dotenv").config();
const cluster = require("cluster");
const os = require("os");
const path = require("path");

const NUM_WORKERS = process.env.CLUSTER_WORKERS
  ? parseInt(process.env.CLUSTER_WORKERS, 10)
  : Math.min(os.cpus().length, 4);

if (cluster.isMaster || cluster.isPrimary) {
  console.log(`=======================================================`);
  console.log(`⚡ [Cluster Master] Process PID ${process.pid} is running`);
  console.log(`⚡ [Cluster Master] Forking ${NUM_WORKERS} Node API & WebSocket Cluster Workers`);
  console.log(`=======================================================`);

  // Fork API & WebSocket cluster workers
  for (let i = 0; i < NUM_WORKERS; i++) {
    const worker = cluster.fork({ WORKER_ROLE: "api", WORKER_INDEX: i + 1 });
    console.log(`🚀 [Cluster Master] Forked Worker #${i + 1} (PID: ${worker.process.pid})`);
  }

  // Handle worker exit & auto-restart (fault tolerance)
  cluster.on("exit", (worker, code, signal) => {
    console.warn(`⚠️ [Cluster Master] Worker PID ${worker.process.pid} died (code: ${code}, signal: ${signal}). Spawning replacement...`);
    const newWorker = cluster.fork();
    console.log(`🔄 [Cluster Master] Replacement Worker PID ${newWorker.process.pid} spawned`);
  });

  // Start background queue workers in a separate dedicated process
  const { spawn } = require("child_process");
  const workerProcess = spawn("node", [path.join(__dirname, "workers/index.js")], {
    stdio: "inherit",
    env: process.env,
  });

  workerProcess.on("exit", (code) => {
    console.warn(`⚠️ [Cluster Master] Queue Worker engine exited with code ${code}`);
  });

} else {
  // Cluster worker process: runs the Express + Socket.IO server with Redis adapter
  console.log(`🔧 [Cluster Worker] Worker #${process.env.WORKER_INDEX} online (PID: ${process.pid})`);
  require("./index.js");
}
