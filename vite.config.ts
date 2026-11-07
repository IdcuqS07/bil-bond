import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.join(projectRoot, "client");

export default defineConfig({
  root: clientRoot,
  envDir: projectRoot,
  publicDir: path.join(projectRoot, "public"),
  plugins: [
    react(),
    nodePolyfills({
      include: ["buffer", "process", "util"],
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.join(clientRoot, "src"),
      "@shared": path.join(projectRoot, "shared"),
    },
  },
  build: {
    outDir: path.join(projectRoot, "dist"),
    emptyOutDir: true,
    sourcemap: true,
  },
  server: {
    host: "127.0.0.1",
    port: 3000,
    strictPort: true,
  },
});
