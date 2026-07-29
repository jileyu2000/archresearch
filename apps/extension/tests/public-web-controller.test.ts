import { describe, expect, it, vi } from "vitest";

import {
  isPublicWebCommand,
  PublicWebController,
} from "../src/public-web-controller";

function chromeApi() {
  return {
    tabs: {
      query: vi.fn().mockResolvedValue([{
        id: 41,
        url: "https://research.example.com/workspace",
      }]),
    },
    scripting: {
      executeScript: vi.fn()
        .mockResolvedValueOnce([{ result: true }])
        .mockResolvedValueOnce([]),
      getRegisteredContentScripts: vi.fn().mockResolvedValue([]),
      registerContentScripts: vi.fn().mockResolvedValue(undefined),
      unregisterContentScripts: vi.fn().mockResolvedValue(undefined),
    },
  };
}

describe("public Web extension controller", () => {
  it("connects only an explicitly selected ArchResearch HTTPS page", async () => {
    const api = chromeApi();
    api.scripting.getRegisteredContentScripts.mockResolvedValue([{
      id: "archresearch-public-board",
      matches: ["https://old.example.com/*"],
    }]);
    const permissions = { hasResearchAccess: vi.fn().mockResolvedValue(true) };
    const search = { run: vi.fn() };
    const controller = new PublicWebController(api, permissions, search);

    await expect(controller.handle({ type: "ui.public.connect" }, {})).resolves.toEqual({
      paired: true,
      connection: "connected",
      research_permission: true,
      visual_protocol: 2,
    });
    expect(api.scripting.registerContentScripts).toHaveBeenCalledWith([{
      id: "archresearch-public-board",
      js: ["assets/publicBoardBridge.js"],
      matches: ["https://research.example.com/*"],
      persistAcrossSessions: true,
      runAt: "document_end",
    }]);
    expect(api.scripting.executeScript).toHaveBeenLastCalledWith({
      target: { tabId: 41 },
      files: ["assets/publicBoardBridge.js"],
    });
    expect(api.scripting.unregisterContentScripts).toHaveBeenCalledWith({
      ids: ["archresearch-public-board"],
    });
  });

  it("reports the registered public page instead of an unrelated local pairing", async () => {
    const api = chromeApi();
    api.scripting.getRegisteredContentScripts.mockResolvedValue([{
      id: "archresearch-public-board",
      matches: ["https://research.example.com/*"],
    }]);
    const controller = new PublicWebController(
      api,
      { hasResearchAccess: vi.fn().mockResolvedValue(true) },
      { run: vi.fn() },
    );

    await expect(controller.statusForActivePage()).resolves.toEqual({
      paired: true,
      connection: "connected",
      research_permission: true,
      visual_protocol: 2,
    });
  });

  it("rejects a page without the public ArchResearch marker", async () => {
    const api = chromeApi();
    api.scripting.executeScript.mockReset().mockResolvedValue([{ result: false }]);
    const controller = new PublicWebController(
      api,
      { hasResearchAccess: vi.fn().mockResolvedValue(true) },
      { run: vi.fn() },
    );

    await expect(
      controller.handle({ type: "ui.public.connect" }, {}),
    ).rejects.toThrow("not an ArchResearch public page");
    expect(api.scripting.registerContentScripts).not.toHaveBeenCalled();
  });

  it("runs a bounded Xiaohongshu search only for the registered sender origin", async () => {
    const api = chromeApi();
    api.scripting.getRegisteredContentScripts.mockResolvedValue([{
      id: "archresearch-public-board",
      matches: ["https://research.example.com/*"],
    }]);
    const sources = {
      sources: [{
        direction_id: "section",
        source_url: "https://www.xiaohongshu.com/explore/note-1",
        title: "剖面表达",
        image_url: "https://sns-webpic-qc.xhscdn.com/note-1.webp",
        preview_data_url: "data:image/png;base64,aW1hZ2U=",
        adjacent_text: "剖面表达",
      }],
      budget: {
        image_count: 1,
        preview_bytes: 30,
        exhausted: false,
      },
    };
    const search = { run: vi.fn().mockResolvedValue(sources) };
    const controller = new PublicWebController(
      api,
      { hasResearchAccess: vi.fn().mockResolvedValue(true) },
      search,
    );

    await expect(controller.handle({
      type: "public.xiaohongshu.research",
      directions: [{ id: "section", query: "社区中心剖面表达" }],
    }, {
      tab: { id: 41, url: "https://research.example.com/workspace" },
    })).resolves.toEqual(sources);
    expect(search.run).toHaveBeenCalledWith([
      { id: "section", query: "社区中心剖面表达" },
    ]);

    await expect(controller.handle({ type: "public.status" }, {
      tab: { id: 42, url: "https://attacker.example.com/" },
    })).rejects.toThrow("Untrusted public page");
  });

  it("rejects extra fields and missing research permission", async () => {
    const api = chromeApi();
    api.scripting.getRegisteredContentScripts.mockResolvedValue([{
      id: "archresearch-public-board",
      matches: ["https://research.example.com/*"],
    }]);
    const controller = new PublicWebController(
      api,
      { hasResearchAccess: vi.fn().mockResolvedValue(false) },
      { run: vi.fn() },
    );

    await expect(controller.handle({
      type: "public.xiaohongshu.research",
      directions: [{ id: "section", query: "剖面" }],
      url: "https://example.com",
    }, {
      tab: { id: 41, url: "https://research.example.com/" },
    })).rejects.toThrow("Unapproved public Web command");
    await expect(controller.handle({ type: "public.status" }, {
      tab: { id: 41, url: "https://research.example.com/" },
    })).resolves.toMatchObject({ research_permission: false });
  });

  it("rejects connection without permission, an active tab, or HTTPS", async () => {
    const api = chromeApi();
    const denied = new PublicWebController(
      api,
      { hasResearchAccess: vi.fn().mockResolvedValue(false) },
      { run: vi.fn() },
    );
    await expect(denied.handle({ type: "ui.public.connect" }, {}))
      .rejects.toThrow("Research permission is required");

    api.tabs.query.mockResolvedValueOnce([]);
    const missingTab = new PublicWebController(
      api,
      { hasResearchAccess: vi.fn().mockResolvedValue(true) },
      { run: vi.fn() },
    );
    await expect(missingTab.handle({ type: "ui.public.connect" }, {}))
      .rejects.toThrow("No active browser tab");

    api.tabs.query.mockResolvedValueOnce([{ id: 41, url: "http://research.example.com/" }]);
    await expect(missingTab.handle({ type: "ui.public.connect" }, {}))
      .rejects.toThrow("not an ArchResearch public page");
  });

  it("recognizes only the public command namespace before strict parsing", () => {
    expect(isPublicWebCommand({ type: "ui.public.connect" })).toBe(true);
    expect(isPublicWebCommand({ type: "public.status" })).toBe(true);
    expect(isPublicWebCommand({ type: "ui.status" })).toBe(false);
    expect(isPublicWebCommand(null)).toBe(false);
  });
});
