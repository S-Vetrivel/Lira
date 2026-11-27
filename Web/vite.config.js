import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, "package.json"), "utf8"));

function liraPwaVersionPlugin({ version, buildId, builtAt }) {
  let outDir = path.resolve(__dirname, "dist");
  return {
    name: "lira-pwa-version",
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir || "dist");
    },
    closeBundle() {
      if (!fs.existsSync(outDir)) return;
      fs.writeFileSync(
        path.join(outDir, "version.json"),
        JSON.stringify({ version, buildId, builtAt }, null, 2)
      );
      const swPath = path.join(outDir, "sw.js");
      if (fs.existsSync(swPath)) {
        const rawSw = fs.readFileSync(swPath, "utf8");
        fs.writeFileSync(swPath, rawSw.replace(/__LIRA_SW_VERSION__/g, buildId));
      }
    },
  };
}

export default defineConfig(({ command, mode }) => {
  const fileEnv = loadEnv(mode, __dirname, "");
  const isBuild = command === "build";
  const builtAt = new Date().toISOString();
  const rawBuildId = fileEnv.VITE_APP_BUILD_ID?.trim() || process.env.VITE_APP_BUILD_ID?.trim() || "";
  const buildId =
    rawBuildId ||
    (isBuild ? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}` : "dev");
  const appVersion =
    fileEnv.VITE_APP_VERSION?.trim() ||
    process.env.VITE_APP_VERSION?.trim() ||
    (pkg.version && pkg.version !== "0.0.0" ? pkg.version : "1.0.1");

  process.env.VITE_APP_VERSION = appVersion;
  process.env.VITE_APP_BUILD_ID = buildId;
  process.env.VITE_APP_BUILT_AT = builtAt;

  return {
    plugins: [
      react(),
      tailwindcss(),
      ...(isBuild ? [liraPwaVersionPlugin({ version: appVersion, buildId, builtAt })] : []),
    ],
    server: {
      port: 5173,
      host: "0.0.0.0",
      proxy: {
        "/v3": {
          target: "http://127.0.0.1:4000",
          changeOrigin: true,
        },
        "/api": {
          target: "http://127.0.0.1:4000",
          changeOrigin: true,
        },
        "/uploads": {
          target: "http://127.0.0.1:4000",
          changeOrigin: true,
        },
        "/socket.io": {
          target: "http://127.0.0.1:4000",
          ws: true,
          changeOrigin: true,
        },
      },
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
        "@components": path.resolve(__dirname, "src/components"),
        "@context": path.resolve(__dirname, "src/context"),
        "@pages": path.resolve(__dirname, "src/pages"),
      },
    },
  };
});
