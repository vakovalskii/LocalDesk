import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    include: ["tests/**/*.spec.{ts,tsx}"],
    testTimeout: 15000,
    setupFiles: ["./tests/setup.ts"]
  }
});
