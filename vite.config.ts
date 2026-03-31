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
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src/", import.meta.url)),
      "@mocks": fileURLToPath(new URL("./mocks/", import.meta.url)),
    },
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
