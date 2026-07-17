import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";
import pkg from "./package.json" with { type: "json" };

export default defineConfig(({ mode }) => {
  const isAndroid = mode === "android";

  return {
    plugins: [
      react(),
      tailwindcss(),

      {
        name: "android-html-rename",
        enforce: "post",
        generateBundle(_, bundle) {
          if (isAndroid && bundle["index.android.html"]) {
            bundle["index.html"] = bundle["index.android.html"];
            bundle["index.html"].fileName = "index.html";
            delete bundle["index.android.html"];
          }
        },
      },
    ],

    build: {
      // I hate this but its the only way to get the android build to work with tauri
      outDir: isAndroid
        ? resolve(
            __dirname,
            "src-tauri/gen/android/app/src/main/assets"
          )
        : resolve(__dirname, "dist"),

      emptyOutDir: !isAndroid,

      rollupOptions: {
        input: isAndroid
          ? resolve(__dirname, "index.android.html")
          : resolve(__dirname, "index.html"),

        output: {
          entryFileNames: "assets/[name]-[hash].js",
          chunkFileNames: "assets/[name]-[hash].js",
          assetFileNames: "assets/[name]-[hash][extname]",
        },
      },
    },

    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
    },

    resolve: {
      alias: {
        "@": isAndroid
          ? resolve(__dirname, "src-android")
          : resolve(__dirname, "src"),
      },
    },
  };
});