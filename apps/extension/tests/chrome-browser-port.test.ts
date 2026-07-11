import { describe, expect, it, vi } from "vitest";

import { ChromeBrowserPort } from "../src/chrome-browser-port";

function makeChromeApi() {
  return {
    tabs: {
      create: vi.fn().mockResolvedValue({
        id: 12,
        url: "https://example.com/project",
        windowId: 3,
      }),
      remove: vi.fn().mockResolvedValue(undefined),
      sendMessage: vi
        .fn()
        .mockResolvedValue({ ok: true, result: { media: [] } }),
      captureVisibleTab: vi
        .fn()
        .mockResolvedValue("data:image/png;base64,screenshot"),
      get: vi.fn().mockResolvedValue({ id: 12, windowId: 3 }),
      query: vi
        .fn()
        .mockResolvedValueOnce([{ id: 90, windowId: 3, active: true }])
        .mockResolvedValue([{ id: 12, windowId: 3, active: true }]),
      update: vi.fn().mockResolvedValue({ id: 12, windowId: 3, active: true }),
    },
    scripting: {
      executeScript: vi.fn().mockResolvedValue([]),
    },
  };
}

describe("Chrome browser adapter", () => {
  it("uses Chrome's pending URL while a new tab is still navigating", async () => {
    const api = makeChromeApi();
    api.tabs.create.mockResolvedValue({
      id: 12,
      pendingUrl: "https://example.com/pending-project",
      windowId: 3,
    });
    api.tabs.get.mockResolvedValue({
      id: 12,
      pendingUrl: "https://example.com/pending-project",
      windowId: 3,
    });
    const port = new ChromeBrowserPort(api);

    await expect(
      port.createTab("https://example.com/pending-project", false),
    ).resolves.toMatchObject({
      url: "https://example.com/pending-project",
    });
    await expect(port.getTab(12)).resolves.toMatchObject({
      url: "https://example.com/pending-project",
    });
  });

  it("injects only the locally bundled content script", async () => {
    const api = makeChromeApi();
    const port = new ChromeBrowserPort(api);

    await port.injectContentScript(12);

    expect(api.scripting.executeScript).toHaveBeenCalledWith({
      target: { tabId: 12 },
      files: ["assets/content.js"],
    });
  });

  it("wraps page operations in the fixed internal protocol", async () => {
    const api = makeChromeApi();
    const port = new ChromeBrowserPort(api);

    await expect(
      port.sendContentCommand(12, { action: "enumerate_media" }),
    ).resolves.toEqual({ media: [] });
    expect(api.tabs.sendMessage).toHaveBeenCalledWith(12, {
      type: "archresearch.content",
      protocol_version: 1,
      command: { action: "enumerate_media" },
    });
  });

  it("captures the managed tab and restores the previously active tab", async () => {
    const api = makeChromeApi();
    const port = new ChromeBrowserPort(api);

    await expect(port.captureTab(12)).resolves.toBe(
      "data:image/png;base64,screenshot",
    );
    expect(api.tabs.query).toHaveBeenCalledWith({ active: true, windowId: 3 });
    expect(api.tabs.update).toHaveBeenNthCalledWith(1, 12, { active: true });
    expect(api.tabs.captureVisibleTab).toHaveBeenCalledWith(3, {
      format: "png",
    });
    expect(api.tabs.update).toHaveBeenNthCalledWith(2, 90, { active: true });
  });

  it("does not capture if the managed tab is not active immediately before capture", async () => {
    const api = makeChromeApi();
    api.tabs.query
      .mockReset()
      .mockResolvedValueOnce([{ id: 90, windowId: 3, active: true }])
      .mockResolvedValueOnce([{ id: 91, windowId: 3, active: true }]);
    const port = new ChromeBrowserPort(api);

    await expect(port.captureTab(12)).rejects.toThrow(/active managed tab/i);
    expect(api.tabs.captureVisibleTab).not.toHaveBeenCalled();
    expect(api.tabs.update).toHaveBeenLastCalledWith(90, { active: true });
  });

  it("discards a screenshot if another tab becomes active during capture", async () => {
    const api = makeChromeApi();
    api.tabs.query
      .mockReset()
      .mockResolvedValueOnce([{ id: 90, windowId: 3, active: true }])
      .mockResolvedValueOnce([{ id: 12, windowId: 3, active: true }])
      .mockResolvedValueOnce([{ id: 91, windowId: 3, active: true }]);
    const port = new ChromeBrowserPort(api);

    await expect(port.captureTab(12)).rejects.toThrow(/active managed tab/i);
    expect(api.tabs.captureVisibleTab).toHaveBeenCalledOnce();
    expect(api.tabs.update).toHaveBeenLastCalledWith(90, { active: true });
  });
});
