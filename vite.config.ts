import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

function stripCrossorigin(): Plugin {
  return {
    name: "strip-crossorigin",
    enforce: "post",
    transformIndexHtml(html) {
      return html.replace(/ crossorigin(?:="[^"]*")?/g, "");
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), stripCrossorigin()],
  clearScreen: false,
  base: "./",
  server: {
    port: 1420,
    strictPort: true,
    host: true,
  },
  resolve: {
    alias: { "@": "/src" },
  },
  build: {
    target: "es2015",
    modulePreload: false,
  },
  define: {
    __APP_VERSION__: JSON.stringify("0.1.0"),
    __IS_BETA_BUILD__: "true",
  },
});
