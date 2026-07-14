import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
    modulePreload: { polyfill: false },
  },
});
