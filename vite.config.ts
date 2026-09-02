import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { defineConfig, type ViteDevServer } from "vite";
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
        const code = readFileSync(file, "utf-8").replace(/\/\/#\s*sourceMappingURL=[^\n]*/g, "");
        return { code, map: null };
      }
      return null;
    },
  };
}

function servePublicMediapipe() {
  return {
    name: "serve-public-mediapipe",
    apply: "serve" as const,
    configureServer(server: ViteDevServer) {
      server.middlewares.use((req, res, next) => {
        const path = (req.url ?? "").split("?")[0];
        if (!path.startsWith("/mp-wasm/") || path.includes("..") || !path.endsWith(".js")) {
          next();
          return;
        }
        let body: Buffer;
        try {
          body = readFileSync(`${server.config.root}/public${path}`);
        } catch {
          next();
          return;
        }
        res.setHeader("Content-Type", "text/javascript; charset=utf-8");
        res.setHeader("Cache-Control", "no-cache");
        res.end(body);
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const android = mode === "android" || process.env.HARBOR_TARGET === "android";
  const devHost = process.env.TAURI_DEV_HOST;
  return {
    staged: { "*": "vp check --fix" },
    plugins: [react(), tailwindcss(), silenceMediapipeSourcemap(), servePublicMediapipe()],
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
    // Both entries ship. index-tv.html is what the TV window loads; index.html
    // exists only so web_server.rs has a page to hand the phone for /remote,
    // which the QR hand-off in onboarding depends on. Listing tv alone left the
    // phone staring at "web assets are not available in this build".
    // Vite 7 defaults to baseline-widely-available, a chrome107 floor. Android
    // TV sticks and Fire TV ship a System WebView well below that, and the
    // failure is a bare SyntaxError before React mounts, with no error surface
    // on a device you cannot open devtools on. Pin a floor the hardware meets.
    // This lowers syntax only; esbuild adds no API polyfills.
    ...(android
      ? {
          build: {
            target: "chrome87",
            rollupOptions: { input: { tv: "index-tv.html", main: "index.html" } },
          },
        }
      : {}),
    server: {
      host: devHost || "127.0.0.1",
      port: 1420,
      strictPort: true,
      ...(devHost ? { hmr: { protocol: "ws", host: devHost, port: 1421 } } : {}),
      watch: {
        ignored: [
          "**/src-tauri/**",
          "**/android-native/**",
          "**/android/**",
          "**/.gradle/**",
          "**/target/**",
        ],
      },
      proxy: Object.fromEntries(
        [
          "graphql.anilist.co",
          "openlibrary.org",
          "covers.openlibrary.org",
          "www.googleapis.com",
          "www.wikidata.org",
          "api.deepseek.com",
        ].map((host) => [
          `/api-proxy/${host}`,
          {
            target: `https://${host}`,
            changeOrigin: true,
            rewrite: (path: string) => path.replace(`/api-proxy/${host}`, ""),
          },
        ]),
      ),
    },
    resolve: {
      alias: { "@": "/src" },
    },
    assetsInclude: ["**/*.onnx", "**/*.tflite"],
    optimizeDeps: { exclude: ["onnxruntime-web", "@mediapipe/tasks-vision"] },
    worker: { format: "es" },
  };
});
