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
    },
    permissions: {
      request: vi.fn().mockResolvedValue(true),
      remove: vi.fn().mockResolvedValue(true),
      contains: vi.fn().mockResolvedValue(false),
    },
    tabs: {
      create: vi.fn(),
      remove: vi.fn(),
      sendMessage: vi.fn(),
      captureVisibleTab: vi.fn(),
      get: vi.fn(),
      query: vi.fn(),
      update: vi.fn(),
      onRemoved: { addListener: vi.fn() },
    },
    scripting: { executeScript: vi.fn() },
    runtime: { onMessage: { addListener: vi.fn() } },
  };
}

describe("service-worker entry point", () => {
  it("registers fixed listeners and restores local pairing state", async () => {
    const api = makeChromeApi();

    startBackground(api, vi.fn());

    expect(api.runtime.onMessage.addListener).toHaveBeenCalledOnce();
    expect(api.tabs.onRemoved.addListener).toHaveBeenCalledOnce();
    await vi.waitFor(() => expect(api.storage.local.get).toHaveBeenCalledOnce());
  });
});
