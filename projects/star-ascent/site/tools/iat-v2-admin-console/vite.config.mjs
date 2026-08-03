import { fileURLToPath } from "node:url";
import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const root = fileURLToPath(new URL(".", import.meta.url));
const repositoryRoot = path.resolve(root, "../..");

export default defineConfig({
  root,
  base: "/",
  plugins: [react()],
  resolve: {
    alias: {
      crypto: path.join(root, "crypto-browser-shim.mjs"),
      https: path.join(root, "https-browser-shim.mjs"),
      util: path.join(root, "util-browser-shim.mjs"),
    },
  },
  server: {
    host: "127.0.0.1",
    port: 4175,
    strictPort: true,
    fs: {
      allow: [repositoryRoot],
    },
  },
  preview: {
    host: "127.0.0.1",
    port: 4175,
    strictPort: true,
  },
  build: {
    outDir: path.join(root, "dist"),
    emptyOutDir: true,
  },
});
