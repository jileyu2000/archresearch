import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Manifest V3 security boundary", () => {
  const manifest = JSON.parse(
    readFileSync(resolve(import.meta.dirname, "../public/manifest.json"), "utf8"),
  ) as Record<string, unknown>;

  it("declares temporary host access as optional", () => {
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.minimum_chrome_version).toBe("116");
    expect(manifest.optional_host_permissions).toEqual(["<all_urls>"]);
    expect(manifest).not.toHaveProperty("host_permissions");
    expect(manifest.content_scripts).toEqual([
      {
        matches: ["http://127.0.0.1/*", "http://localhost/*"],
        js: ["assets/boardBridge.js"],
        run_at: "document_start",
      },
    ]);
  });

  it("uses only bundled service-worker code", () => {
    expect(manifest.background).toEqual({
      service_worker: "assets/background.js",
      type: "module",
    });
    expect(manifest).not.toHaveProperty("content_security_policy.extension_pages");
  });

  it("does not request credential or browsing-history permissions", () => {
    const permissions = manifest.permissions as string[];
    expect(permissions).toEqual([
      "storage",
      "tabs",
      "scripting",
      "activeTab",
      "sidePanel",
    ]);
    expect(permissions).not.toEqual(
      expect.arrayContaining([
        "cookies",
        "history",
        "webRequest",
        "debugger",
        "passwordsPrivate",
      ]),
    );
  });
});
