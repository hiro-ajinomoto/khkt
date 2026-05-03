import react from "@vitejs/plugin-react";
import { existsSync, readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vite";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Ưu tiên env khi dev; nếu không có thì đọc PORT từ be/.env (trùng cổng backend đang chạy). */
function apiProxyTarget() {
  const fromEnv = process.env.VITE_API_PROXY_TARGET;
  if (fromEnv) return fromEnv;
  const envPath = resolve(__dirname, "../be/.env");
  if (existsSync(envPath)) {
    const portLine = readFileSync(envPath, "utf8")
      .split(/\r?\n/)
      .find((line) => /^\s*PORT=\d+\s*$/.test(line));
    if (portLine) {
      const port = portLine.split("=")[1]?.trim();
      if (port) return `http://127.0.0.1:${port}`;
    }
  }
  return "http://127.0.0.1:8010";
}

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    proxy: {
      "/api": {
        target: apiProxyTarget(),
        changeOrigin: true,
      },
    },
  },
});
