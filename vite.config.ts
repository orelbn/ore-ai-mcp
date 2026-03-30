import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite-plus";

const ignorePatterns = [
  ".agents/**",
  ".codex/**",
  ".prompts/**",
  ".vscode/**",
  "migrations/**",
  "skills-lock.json",
  "src/routeTree.gen.ts",
];

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src/", import.meta.url)),
      "@mocks": fileURLToPath(new URL("./mocks/", import.meta.url)),
    },
  },
  server: {
    host: "127.0.0.1",
    port: 4318,
    fs: {
      allow: [".."],
    },
    proxy: {
      "/api": {
        target: "http://127.0.0.1:4317",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "../internal/local-mcp-dev/ui/dist",
  },
  lint: {
    ignorePatterns,
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  fmt: {
    ignorePatterns,
  },
});
