import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tanstackRouter({ target: "react", autoCodeSplitting: true }), react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
  optimizeDeps: {
    // Routes are code-split, so the default scan misses their imports; without this, the first
    // page load re-optimizes deps mid-load and briefly runs two React copies ("Invalid hook call").
    entries: ["src/**/*.{ts,tsx}"],
  },
  server: {
    port: 5330,
    strictPort: true,
    proxy: {
      // Same origin for the browser: no CORS, and the session cookie just works (ADR-0026).
      "/api": "http://localhost:3330",
    },
  },
});
