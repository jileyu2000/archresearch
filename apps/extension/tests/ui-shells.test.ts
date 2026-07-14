import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe.each([
  ["popup", "../popup.html", "/src/popup.ts"],
  ["side panel", "../sidepanel.html", "/src/sidepanel.ts"],
])("%s shell", (_label, file, entry) => {
  it("exposes only the local pairing and temporary permission controls", () => {
    const html = readFileSync(resolve(import.meta.dirname, file), "utf8");

    expect(html).toContain(`src="${entry}"`);
    expect(html).toContain('data-role="pair-form"');
    expect(html).toContain('data-command="permissions.request"');
    expect(html).toContain('data-command="permissions.revoke"');
    expect(html).toContain('data-command="disconnect"');
    expect(html).toContain('lang="zh-CN"');
    expect(html).toContain("手动配对");
    expect(html).toContain("临时网页读取权限");
    expect(html).not.toMatch(/cookie|password|execute_script|submit_form/iu);
  });
});
