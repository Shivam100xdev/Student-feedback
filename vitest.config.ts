import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Tests import app modules through the "@/..." alias, which Vite does not read
// from tsconfig.json on its own.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
  },
});
