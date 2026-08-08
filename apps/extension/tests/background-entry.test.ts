import { describe, expect, it, vi } from "vitest";

import { startBackground } from "../src/background";

function makeChromeApi() {
  return {
    storage: {
      local: {
        get: vi.fn().mockResolvedValue({}),
        set: vi.fn().mockResolvedValue(undefined),
        remove: vi.fn().mockResolvedValue(undefined),
      },
      session: {
        get: vi.fn().mockResolvedValue({}),
        set: vi.fn().mockResolvedValue(undefined),
        remove: vi.fn().mockResolvedValue(undefined),
      },
    },
    permissions: {
      request: vi.fn().mockResolvedValue(true),
      remove: vi.fn().mockResolvedValue(true),
      contains: vi.fn().mockResolvedValue(false),
    },
    alarms: {
      create: vi.fn(),
      onAlarm: { addListener: vi.fn() },
    },
    windows: {
      get: vi.fn(),
      update: vi.fn(),
    },
    tabs: {
      create: vi.fn(),
      remove: vi.fn(),
      sendMessage: vi.fn(),
      captureVisibleTab: vi.fn(),
      get: vi.fn(),
      query: vi.fn(),
      update: vi.fn(),
      onUpdated: { addListener: vi.fn(), removeListener: vi.fn() },
      onRemoved: { addListener: vi.fn() },
    },
    scripting: {
      executeScript: vi.fn(),
      getRegisteredContentScripts: vi.fn().mockResolvedValue([]),
      registerContentScripts: vi.fn().mockResolvedValue(undefined),
      unregisterContentScripts: vi.fn().mockResolvedValue(undefined),
    },
    runtime: { onMessage: { addListener: vi.fn() } },
  };
}

describe("service-worker entry point", () => {
  it("registers fixed listeners and restores local pairing state", async () => {
    const api = makeChromeApi();

    startBackground(api, vi.fn());

    expect(api.runtime.onMessage.addListener).toHaveBeenCalledOnce();
    expect(api.tabs.onRemoved.addListener).toHaveBeenCalledOnce();
    expect(api.alarms.create).toHaveBeenCalledWith("archresearch.reconnect", {
      periodInMinutes: 1,
    });
    expect(api.alarms.onAlarm.addListener).toHaveBeenCalledOnce();
    await vi.waitFor(() => expect(api.storage.local.get).toHaveBeenCalledOnce());
  });

  it("cleans orphaned managed tabs before restoring the saved pairing", async () => {
    const api = makeChromeApi();
    api.storage.session.get.mockResolvedValue({
      "archresearch.managed_tabs": [41, 42],
    });
    api.tabs.remove.mockResolvedValue(undefined);

    startBackground(api, vi.fn());

    await vi.waitFor(() => expect(api.storage.local.get).toHaveBeenCalledOnce());
    expect(api.tabs.remove).toHaveBeenCalledWith(41);
    expect(api.tabs.remove).toHaveBeenCalledWith(42);
    expect(
      api.tabs.remove.mock.invocationCallOrder.at(-1),
    ).toBeLessThan(api.storage.local.get.mock.invocationCallOrder[0]!);
  });
});
