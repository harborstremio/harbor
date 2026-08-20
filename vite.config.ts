import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import pkg from "./package.json" with { type: "json" };

declare const process: { env: Record<string, string | undefined> };

function silenceMediapipeSourcemap() {
  return {
    name: "silence-mediapipe-sourcemap",
    enforce: "pre" as const,
    load(id: string) {
      const file = id.split("?")[0];
      if (file.includes("@mediapipe") && file.endsWith(".mjs")) {
        const code = readFileSync(file, "utf-8").replace(
          /\/\/#\s*sourceMappingURL=[^\n]*/g,
          "",
        );
        return { code, map: null };
      }
      return null;
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), silenceMediapipeSourcemap()],
  clearScreen: false,
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __IS_BETA_BUILD__: JSON.stringify(process.env.HARBOR_CHANNEL !== "stable"),
    __BUILD_ID__: JSON.stringify(
      process.env.HARBOR_BUILD_ID ||
        (() => {
          try {
            return execSync("git rev-parse --short HEAD").toString().trim();
          } catch {
            return "local";
          }
        })(),
    ),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)),
  },
  server: {
    host: "127.0.0.1",
    port: 1420,
    strictPort: true,
    watch: { ignored: ["**/src-tauri/**"] },
  },
  resolve: {
    alias: { "@": "/src" },
  },
  assetsInclude: ["**/*.onnx", "**/*.tflite"],
  optimizeDeps: { exclude: ["onnxruntime-web", "@mediapipe/tasks-vision"] },
  worker: { format: "es" },
});
