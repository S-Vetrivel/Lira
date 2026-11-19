module.exports = {
  apps: [
    {
      name: "lira-cluster-api",
      script: "index.js",
      instances: "max",
      exec_mode: "cluster",
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "production",
      },
    },
    {
      name: "lira-queue-workers",
      script: "./workers/index.js",
      instances: 2,
      exec_mode: "cluster",
      max_memory_restart: "600M",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
