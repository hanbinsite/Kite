import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
    include: ["src/**/*.test.{ts,tsx}", "../../packages/core/src/**/*.test.{ts,tsx}"],
  },
  resolve: {
    alias: [
      { find: /^@api-client\/core/, replacement: path.resolve(__dirname, "../../packages/core/src") },
      { find: /^@api-client\/types/, replacement: path.resolve(__dirname, "../../packages/types/src") },
      { find: /^@api-client\/ui/, replacement: path.resolve(__dirname, "../../packages/ui/src") },
    ],
  },
});