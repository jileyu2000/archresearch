import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { build } from "vite";

describe("packaged content-script bundle", () => {
  let outputDirectory: string;
  let contentBundle: string;

  beforeAll(async () => {
    outputDirectory = await mkdtemp(join(tmpdir(), "archresearch-content-"));
    await build({
      configFile: resolve(import.meta.dirname, "../vite.config.ts"),
      build: {
        emptyOutDir: true,
        outDir: outputDirectory,
      },
    });
    contentBundle = await readFile(
      join(outputDirectory, "assets/content.js"),
      "utf8",
    );
  });

  afterAll(async () => {
    if (outputDirectory) {
      await rm(outputDirectory, { recursive: true, force: true });
    }
  });

  it("is self-contained for chrome.scripting.executeScript file injection", () => {
    expect(contentBundle).not.toMatch(/^\s*import\b/mu);
    expect(contentBundle).not.toMatch(/^\s*export\b/mu);
  });
});
