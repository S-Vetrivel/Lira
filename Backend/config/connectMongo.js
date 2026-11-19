const mongoose = require("mongoose");
const { spawn } = require("child_process");
const fs = require("fs");

let mongodProcess = null;

const startLocalMongo = async () => {
  return new Promise((resolve) => {
    const mongoScript = "/home/v3/Documents/Lira/start-mongo.sh";
    if (fs.existsSync(mongoScript)) {
      console.log("Starting local mongod daemon...");
      mongodProcess = spawn("/bin/bash", [mongoScript], {
        detached: true,
        stdio: "ignore",
      });
      mongodProcess.unref();
      setTimeout(resolve, 1500);
    } else {
      resolve();
    }
  });
};

const connectMongo = async () => {
  const uri = process.env.MONGO_DB?.trim() || "mongodb://127.0.0.1:27017/sass";

  const tryConnect = async (attempts = 3) => {
    for (let i = 0; i < attempts; i++) {
      try {
        await mongoose.connect(uri, {
          family: 4,
          maxPoolSize: 50,
          minPoolSize: 5,
          serverSelectionTimeoutMS: 4000,
          socketTimeoutMS: 45000,
        });
        console.log("✅ MongoDB connected successfully to", uri);
        return;
      } catch (err) {
        console.warn(`Connection attempt ${i + 1} failed: ${err.message}`);
        if (i === 0) {
          await startLocalMongo();
        }
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
    throw new Error("Could not connect to MongoDB after multiple attempts");
  };

  await tryConnect();

  mongoose.connection.on("disconnected", () => console.warn("⚠️ MongoDB disconnected"));
  mongoose.connection.on("error", (err) => console.error("❌ MongoDB connection error:", err));
};

module.exports = connectMongo;
