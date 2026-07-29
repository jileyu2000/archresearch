import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        background: resolve(import.meta.dirname, "src/background.ts"),
        boardBridge: resolve(import.meta.dirname, "src/board-bridge.ts"),
        publicBoardBridge: resolve(import.meta.dirname, "src/public-board-bridge.ts"),
        content: resolve(import.meta.dirname, "src/content/index.ts"),
        popup: resolve(import.meta.dirname, "popup.html"),
        sidepanel: resolve(import.meta.dirname, "sidepanel.html"),
      },
      output: {
        entryFileNames: "assets/[name].js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/[name][extname]",
      },
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    restoreMocks: true,
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      reporter: ["text", "json-summary"],
      reportsDirectory: "../../.artifacts/coverage/extension",
      thresholds: {
        statements: 82.69,
        branches: 76.52,
        functions: 83.96,
        lines: 84.73,
      },
    },
  },
});
