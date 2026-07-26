import { describe, expect, it, vi } from "vitest";

import {
  ChromeBrowserPort,
  MANAGED_TAB_STORAGE_KEY,
} from "../src/chrome-browser-port";

type UpdatedListener = (
  tabId: number,
  changeInfo: { status?: string; url?: string },
  tab: chrome.tabs.Tab,
) => void;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, reject, resolve };
}

function makeChromeApi() {
  const updatedListeners = new Set<UpdatedListener>();
  const api = {
    storage: {
      session: {
        get: vi.fn().mockResolvedValue({}),
        set: vi.fn().mockResolvedValue(undefined),
        remove: vi.fn().mockResolvedValue(undefined),
      },
    },
    tabs: {
      create: vi.fn().mockResolvedValue({
        id: 12,
        url: "about:blank",
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
      update: vi.fn(
        async (
          tabId: number,
          properties: { active?: boolean; url?: string },
        ) => {
          if (properties.url) {
            const tab = {
              id: tabId,
              pendingUrl: properties.url,
              windowId: 3,
            };
            for (const listener of updatedListeners) {
              listener(
                tabId,
                { status: "loading", url: properties.url },
                tab as chrome.tabs.Tab,
              );
            }
            return tab as chrome.tabs.Tab;
          }
          return {
            id: tabId,
            windowId: 3,
            active: properties.active,
          } as chrome.tabs.Tab;
        },
      ),
      onUpdated: {
        addListener: vi.fn((listener: UpdatedListener) => {
          updatedListeners.add(listener);
        }),
        removeListener: vi.fn((listener: UpdatedListener) => {
          updatedListeners.delete(listener);
        }),
      },
    },
    scripting: {
      executeScript: vi.fn().mockResolvedValue([]),
    },
  };
  return Object.assign(api, {
    emitUpdated(
      tabId: number,
      changeInfo: { status?: string; url?: string },
      tab: chrome.tabs.Tab,
    ) {
      for (const listener of updatedListeners) {
        listener(tabId, changeInfo, tab);
      }
    },
  });
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

  it("installs the packaged listener on the managed tab's first loading event", async () => {
    const api = makeChromeApi();
    const port = new ChromeBrowserPort(api);

    await expect(
      port.createTab("https://example.com/project", false),
    ).resolves.toMatchObject({
      id: 12,
      url: "https://example.com/project",
    });

    expect(api.tabs.create).toHaveBeenCalledWith({
      url: "about:blank",
      active: false,
    });
    expect(api.tabs.onUpdated.addListener).toHaveBeenCalledOnce();
    expect(api.tabs.update).toHaveBeenCalledWith(12, {
      url: "https://example.com/project",
    });
    expect(api.scripting.executeScript).toHaveBeenCalledWith({
      target: { tabId: 12 },
      files: ["assets/content.js"],
      injectImmediately: true,
    });
    expect(
      api.tabs.onUpdated.addListener.mock.invocationCallOrder[0],
    ).toBeLessThan(api.tabs.update.mock.invocationCallOrder[0]!);
  });

  it("tracks a safe target when Chrome reports URL and loading separately", async () => {
    const api = makeChromeApi();
    api.tabs.update.mockImplementation(
      async (tabId: number, properties: { active?: boolean; url?: string }) => {
        const targetUrl = properties.url!;
        api.emitUpdated(
          tabId,
          { url: targetUrl },
          { id: tabId, pendingUrl: targetUrl, windowId: 3 } as chrome.tabs.Tab,
        );
        api.emitUpdated(
          tabId,
          { status: "loading" },
          { id: tabId, url: "about:blank", windowId: 3 } as chrome.tabs.Tab,
        );
        return {
          id: tabId,
          pendingUrl: targetUrl,
          windowId: 3,
        } as chrome.tabs.Tab;
      },
    );
    const port = new ChromeBrowserPort(api);

    await expect(
      port.createTab("https://example.com/project", false),
    ).resolves.toMatchObject({ url: "https://example.com/project" });
    expect(api.scripting.executeScript).toHaveBeenCalledOnce();
  });

  it("ignores a late about:blank loading event before target navigation", async () => {
    const api = makeChromeApi();
    api.tabs.update.mockImplementation(
      async (tabId: number, properties: { active?: boolean; url?: string }) => {
        api.emitUpdated(
          tabId,
          { status: "loading", url: "about:blank" },
          { id: tabId, url: "about:blank", windowId: 3 } as chrome.tabs.Tab,
        );
        const targetUrl = properties.url!;
        api.emitUpdated(
          tabId,
          { status: "loading", url: targetUrl },
          { id: tabId, pendingUrl: targetUrl, windowId: 3 } as chrome.tabs.Tab,
        );
        return {
          id: tabId,
          pendingUrl: targetUrl,
          windowId: 3,
        } as chrome.tabs.Tab;
      },
    );
    const port = new ChromeBrowserPort(api);

    await expect(
      port.createTab("https://example.com/project", false),
    ).resolves.toMatchObject({ url: "https://example.com/project" });
    expect(api.scripting.executeScript).toHaveBeenCalledOnce();
  });

  it("waits for the managed document when the first early injection is too soon", async () => {
    vi.useFakeTimers();
    try {
      const api = makeChromeApi();
      api.scripting.executeScript
        .mockRejectedValueOnce(new Error("Document is not ready"))
        .mockResolvedValueOnce([]);
      const port = new ChromeBrowserPort(api);

      const opened = port.createTab("https://example.com/project", false);
      await vi.advanceTimersByTimeAsync(100);

      await expect(opened).resolves.toMatchObject({
        url: "https://example.com/project",
      });
      expect(api.scripting.executeScript).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("waits for the latest safe navigation when an earlier injection is still running", async () => {
    const api = makeChromeApi();
    const firstInjection = deferred<unknown>();
    const secondInjection = deferred<unknown>();
    api.scripting.executeScript
      .mockReturnValueOnce(firstInjection.promise)
      .mockReturnValueOnce(secondInjection.promise);
    const port = new ChromeBrowserPort(api);

    const opened = port.createTab("https://example.com/project", false);
    await vi.waitFor(() =>
      expect(api.scripting.executeScript).toHaveBeenCalledOnce(),
    );
    api.emitUpdated(
      12,
      { status: "loading", url: "https://example.com/redirected" },
      {
        id: 12,
        pendingUrl: "https://example.com/redirected",
        windowId: 3,
      } as chrome.tabs.Tab,
    );

    firstInjection.resolve([]);
    await vi.waitFor(() =>
      expect(api.scripting.executeScript).toHaveBeenCalledTimes(2),
    );
    secondInjection.resolve([]);

    await expect(opened).resolves.toMatchObject({ id: 12 });
  });

  it("stops readiness retries and clears the tab record after the deadline", async () => {
    vi.useFakeTimers();
    try {
      const api = makeChromeApi();
      api.scripting.executeScript.mockRejectedValue(
        new Error("Document is not ready"),
      );
      const port = new ChromeBrowserPort(api);

      const opened = port.createTab("https://example.com/project", false);
      const rejected = expect(opened).rejects.toThrow(/not ready in time/i);
      await vi.advanceTimersByTimeAsync(5_000);
      await rejected;
      const attemptsAtDeadline = api.scripting.executeScript.mock.calls.length;
      await vi.advanceTimersByTimeAsync(100);

      expect(api.scripting.executeScript).toHaveBeenCalledTimes(
        attemptsAtDeadline,
      );
      expect(api.tabs.remove).toHaveBeenCalledWith(12);
      expect(api.storage.session.remove).toHaveBeenCalledWith(
        MANAGED_TAB_STORAGE_KEY,
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("reinstalls the listener after a later safe redirect", async () => {
    vi.useFakeTimers();
    try {
      const api = makeChromeApi();
      const port = new ChromeBrowserPort(api);
      await port.createTab("https://example.com/project", false);
      api.scripting.executeScript.mockReset();
      api.scripting.executeScript
        .mockRejectedValueOnce(new Error("Redirect document is not ready"))
        .mockResolvedValueOnce([]);

      api.emitUpdated(
        12,
        { status: "loading", url: "https://example.com/redirected" },
        {
          id: 12,
          pendingUrl: "https://example.com/redirected",
          windowId: 3,
        } as chrome.tabs.Tab,
      );
      await vi.advanceTimersByTimeAsync(100);

      expect(api.scripting.executeScript).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("waits for the latest safe navigation listener before reading the page", async () => {
    const api = makeChromeApi();
    const port = new ChromeBrowserPort(api);
    await port.createTab("https://example.com/project", false);
    api.scripting.executeScript.mockReset();
    const redirectInjection = deferred<unknown>();
    api.scripting.executeScript.mockReturnValueOnce(
      redirectInjection.promise,
    );

    api.emitUpdated(
      12,
      { status: "loading", url: "https://example.com/redirected" },
      {
        id: 12,
        pendingUrl: "https://example.com/redirected",
        windowId: 3,
      } as chrome.tabs.Tab,
    );
    const result = port.sendContentCommand(12, {
      action: "enumerate_media",
    });
    await Promise.resolve();

    expect(api.tabs.sendMessage).not.toHaveBeenCalled();
    redirectInjection.resolve([]);
    await expect(result).resolves.toEqual({ media: [] });
    expect(api.tabs.sendMessage).toHaveBeenCalledOnce();
  });

  it("rejects a page read when the latest safe navigation never becomes ready", async () => {
    vi.useFakeTimers();
    try {
      const api = makeChromeApi();
      const port = new ChromeBrowserPort(api);
      await port.createTab("https://example.com/project", false);
      api.scripting.executeScript.mockReset();
      api.scripting.executeScript.mockRejectedValue(
        new Error("Redirect document is not ready"),
      );

      api.emitUpdated(
        12,
        { status: "loading", url: "https://example.com/redirected" },
        {
          id: 12,
          pendingUrl: "https://example.com/redirected",
          windowId: 3,
        } as chrome.tabs.Tab,
      );
      const result = port.sendContentCommand(12, {
        action: "enumerate_media",
      });
      const rejected = expect(result).rejects.toThrow(/not ready in time/i);
      await vi.advanceTimersByTimeAsync(5_000);
      await rejected;

      expect(api.tabs.sendMessage).not.toHaveBeenCalled();
    } finally {
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });

  it("invalidates and closes a managed tab after an unsafe redirect", async () => {
    const api = makeChromeApi();
    const port = new ChromeBrowserPort(api);
    await port.createTab("https://example.com/project", false);
    api.scripting.executeScript.mockClear();

    api.emitUpdated(
      12,
      { url: "http://127.0.0.1/private" },
      {
        id: 12,
        pendingUrl: "http://127.0.0.1/private",
        windowId: 3,
      } as chrome.tabs.Tab,
    );
    api.emitUpdated(
      12,
      { status: "loading" },
      {
        id: 12,
        url: "http://127.0.0.1/private",
        windowId: 3,
      } as chrome.tabs.Tab,
    );
    await vi.waitFor(() => expect(api.tabs.remove).toHaveBeenCalledWith(12));

    expect(api.scripting.executeScript).not.toHaveBeenCalled();
  });

  it("invalidates a private pending URL reported only with loading status", async () => {
    const api = makeChromeApi();
    const port = new ChromeBrowserPort(api);
    await port.createTab("https://example.com/project", false);
    api.scripting.executeScript.mockClear();

    api.emitUpdated(
      12,
      { status: "loading" },
      {
        id: 12,
        pendingUrl: "http://127.0.0.1/private",
        windowId: 3,
      } as chrome.tabs.Tab,
    );
    await vi.waitFor(() => expect(api.tabs.remove).toHaveBeenCalledWith(12));

    expect(api.scripting.executeScript).not.toHaveBeenCalled();
  });

  it("cancels redirect readiness retries when the tab is released", async () => {
    vi.useFakeTimers();
    try {
      const api = makeChromeApi();
      const port = new ChromeBrowserPort(api);
      await port.createTab("https://example.com/project", false);
      api.scripting.executeScript.mockReset();
      api.scripting.executeScript.mockRejectedValue(
        new Error("Redirect document is not ready"),
      );

      api.emitUpdated(
        12,
        { status: "loading", url: "https://example.com/redirected" },
        {
          id: 12,
          pendingUrl: "https://example.com/redirected",
          windowId: 3,
        } as chrome.tabs.Tab,
      );
      await Promise.resolve();
      port.releaseTab(12);
      const attemptsAtRelease = api.scripting.executeScript.mock.calls.length;
      await vi.advanceTimersByTimeAsync(100);

      expect(api.scripting.executeScript).toHaveBeenCalledTimes(
        attemptsAtRelease,
      );
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });

  it("disposes readiness work when navigation fails before it can be awaited", async () => {
    vi.useFakeTimers();
    try {
      const api = makeChromeApi();
      api.tabs.update.mockRejectedValueOnce(new Error("Navigation failed"));
      const port = new ChromeBrowserPort(api);

      await expect(
        port.createTab("https://example.com/project", false),
      ).rejects.toThrow(/navigation failed/i);

      expect(api.tabs.remove).toHaveBeenCalledWith(12);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });

  it("closes the provisional tab when its session record cannot be persisted", async () => {
    const api = makeChromeApi();
    api.storage.session.set.mockRejectedValueOnce(
      new Error("Session storage failed"),
    );
    const port = new ChromeBrowserPort(api);

    await expect(
      port.createTab("https://example.com/project", false),
    ).rejects.toThrow(/session storage failed/i);

    expect(api.tabs.remove).toHaveBeenCalledWith(12);
    expect(api.tabs.update).not.toHaveBeenCalled();
  });

  it("closes a provisional tab immediately when the research session ends", async () => {
    const api = makeChromeApi();
    const injection = deferred<unknown>();
    api.scripting.executeScript.mockReturnValueOnce(injection.promise);
    const port = new ChromeBrowserPort(api);

    const opened = port.createTab("https://example.com/project", false);
    const rejected = expect(opened).rejects.toThrow(/cancelled/i);
    await vi.waitFor(() =>
      expect(api.scripting.executeScript).toHaveBeenCalledOnce(),
    );

    await port.closeAllTabs();

    expect(api.tabs.remove).toHaveBeenCalledWith(12);
    await rejected;
  });

  it("keeps early injection scoped to the managed tab and releases its listener", async () => {
    const api = makeChromeApi();
    const port = new ChromeBrowserPort(api);
    await port.createTab("https://example.com/project", false);
    api.scripting.executeScript.mockClear();

    api.emitUpdated(
      99,
      { status: "loading", url: "https://example.com/unrelated" },
      {
        id: 99,
        pendingUrl: "https://example.com/unrelated",
        windowId: 3,
      } as chrome.tabs.Tab,
    );
    expect(api.scripting.executeScript).not.toHaveBeenCalled();

    port.releaseTab(12);
    expect(api.tabs.onUpdated.removeListener).toHaveBeenCalledOnce();
    api.emitUpdated(
      12,
      { status: "loading", url: "https://example.com/redirect" },
      {
        id: 12,
        pendingUrl: "https://example.com/redirect",
        windowId: 3,
      } as chrome.tabs.Tab,
    );
    expect(api.scripting.executeScript).not.toHaveBeenCalled();
  });

  it("records a managed tab before navigating away from about:blank", async () => {
    const api = makeChromeApi();
    const port = new ChromeBrowserPort(api);

    await port.createTab("https://example.com/project", false);

    expect(api.storage.session.set).toHaveBeenCalledWith({
      [MANAGED_TAB_STORAGE_KEY]: [12],
    });
    expect(
      api.storage.session.set.mock.invocationCallOrder[0],
    ).toBeLessThan(api.tabs.update.mock.invocationCallOrder[0]!);
  });

  it("clears the managed-tab record after closing the tab", async () => {
    const api = makeChromeApi();
    const port = new ChromeBrowserPort(api);
    await port.createTab("https://example.com/project", false);
    api.storage.session.remove.mockClear();

    await port.removeTab(12);

    expect(api.storage.session.remove).toHaveBeenCalledWith(
      MANAGED_TAB_STORAGE_KEY,
    );
  });

  it("closes orphaned managed tabs before a restarted worker resumes", async () => {
    const api = makeChromeApi();
    api.storage.session.get.mockResolvedValue({
      [MANAGED_TAB_STORAGE_KEY]: [31, 32, "invalid"],
    });
    const port = new ChromeBrowserPort(api);

    await port.recoverOrphanedTabs();

    expect(api.tabs.remove).toHaveBeenCalledWith(31);
    expect(api.tabs.remove).toHaveBeenCalledWith(32);
    expect(api.storage.session.remove).toHaveBeenCalledWith(
      MANAGED_TAB_STORAGE_KEY,
    );
  });

  it("injects only the locally bundled content script", async () => {
    const api = makeChromeApi();
    const port = new ChromeBrowserPort(api);

    await port.injectContentScript(12);

    expect(api.scripting.executeScript).toHaveBeenCalledWith({
      target: { tabId: 12 },
      files: ["assets/content.js"],
      injectImmediately: true,
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

  it("reinstalls the packaged listener once when a read command has no receiver", async () => {
    const api = makeChromeApi();
    api.tabs.sendMessage
      .mockRejectedValueOnce(new Error("No receiving end"))
      .mockResolvedValueOnce({ ok: true, result: { media: [] } });
    const port = new ChromeBrowserPort(api);

    await expect(
      port.sendContentCommand(12, { action: "enumerate_media" }),
    ).resolves.toEqual({ media: [] });
    expect(api.scripting.executeScript).toHaveBeenCalledOnce();
    expect(api.tabs.sendMessage).toHaveBeenCalledTimes(2);
  });

  it("does not replay a state-changing page command after its response times out", async () => {
    vi.useFakeTimers();
    try {
      const api = makeChromeApi();
      api.tabs.sendMessage.mockReturnValueOnce(
        new Promise(() => undefined),
      );
      const port = new ChromeBrowserPort(api);

      const result = port.sendContentCommand(12, {
        action: "scroll",
        direction: "down",
        distance: 1_200,
      });
      const rejected = expect(result).rejects.toThrow(/timed out/i);
      await vi.advanceTimersByTimeAsync(3_000);
      await rejected;

      expect(api.scripting.executeScript).not.toHaveBeenCalled();
      expect(api.tabs.sendMessage).toHaveBeenCalledOnce();
    } finally {
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });

  it("bounds a read command after its single listener recovery also stalls", async () => {
    vi.useFakeTimers();
    try {
      const api = makeChromeApi();
      api.tabs.sendMessage
        .mockRejectedValueOnce(new Error("No receiving end"))
        .mockReturnValueOnce(new Promise(() => undefined));
      const port = new ChromeBrowserPort(api);

      const result = port.sendContentCommand(12, {
        action: "enumerate_media",
      });
      const rejected = expect(result).rejects.toThrow(/timed out/i);
      await vi.advanceTimersByTimeAsync(3_000);
      await rejected;

      expect(api.scripting.executeScript).toHaveBeenCalledOnce();
      expect(api.tabs.sendMessage).toHaveBeenCalledTimes(2);
    } finally {
      vi.clearAllTimers();
      vi.useRealTimers();
    }
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
