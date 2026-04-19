import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
  resolve: {
    alias: [
      { find: "@api-client/core/http", replacement: path.resolve(__dirname, "../../packages/core/src/http/index.ts") },
      { find: "@api-client/core", replacement: path.resolve(__dirname, "../../packages/core/src/index.ts") },
      { find: "@api-client/types", replacement: path.resolve(__dirname, "../../packages/types/src/index.ts") },
      { find: "@api-client/ui", replacement: path.resolve(__dirname, "../../packages/ui/src/index.ts") },
    ],
  },
});