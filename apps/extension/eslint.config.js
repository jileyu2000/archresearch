import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ["dist/**", "node_modules/**"],
  },
  {
    files: ["**/*.ts"],
    languageOptions: {
      globals: {
        chrome: "readonly",
        document: "readonly",
        window: "readonly",
        WebSocket: "readonly",
        URL: "readonly",
        Blob: "readonly",
        OffscreenCanvas: "readonly",
        createImageBitmap: "readonly",
        fetch: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
      },
    },
  },
);
