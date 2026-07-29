import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe.each([
  ["popup", "../popup.html", "/src/popup.ts"],
  ["side panel", "../sidepanel.html", "/src/sidepanel.ts"],
])("%s shell", (_label, file, entry) => {
  it("exposes only the local pairing and persistent permission controls", () => {
    const html = readFileSync(resolve(import.meta.dirname, file), "utf8");

    expect(html).toContain(`src="${entry}"`);
    expect(html).toContain("<title>ArchResearch Chrome 扩展</title>");
    expect(html).toContain("ArchResearch Chrome 扩展");
    expect(html).toContain('data-role="pair-form"');
    expect(html).toContain('data-command="permissions.request"');
    expect(html).toContain('data-command="permissions.revoke"');
    expect(html).toContain('data-command="disconnect"');
    expect(html).toContain('data-role="manual-pairing"');
    expect(html).toContain('data-role="permission-guidance"');
    expect(html).toMatch(/data-role="permission-guidance"[^>]+role="status"/u);
    expect(html).toContain('lang="zh-CN"');
    expect(html).toContain("连接有问题？手动配对");
    expect(html).toContain("允许网页读取");
    expect(html).toContain("网页读取权限");
    expect(html).toContain("授权会保留，直到你主动撤销或卸载扩展");
    expect(html).toContain("不读取 Cookie");
    expect(html).not.toMatch(/document\.cookie|execute_script|submit_form/iu);
  });
});
