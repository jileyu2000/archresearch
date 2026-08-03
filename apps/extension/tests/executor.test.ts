import { describe, expect, it, vi } from "vitest";

import { BrowserCommandExecutor } from "../src/browser-command-executor";
import type { BrowserCommand } from "../src/protocol";

const command = <T extends BrowserCommand["action"]>(
  action: T,
  payload: Extract<BrowserCommand, { action: T }>["payload"],
): Extract<BrowserCommand, { action: T }> =>
  ({
    type: "browser.command",
    protocol_version: 1,
    id: "cmd-1",
    action,
    payload,
  }) as Extract<BrowserCommand, { action: T }>;

function makeBrowserPort() {
  return {
    createTab: vi.fn().mockResolvedValue({ id: 42, url: "https://example.com" }),
    closeAllTabs: vi.fn().mockResolvedValue(undefined),
    removeTab: vi.fn().mockResolvedValue(undefined),
    releaseTab: vi.fn(),
    injectContentScript: vi.fn().mockResolvedValue(undefined),
    sendContentCommand: vi.fn().mockResolvedValue({ title: "Project" }),
    captureTab: vi
      .fn()
      .mockResolvedValue("data:image/png;base64,full-viewport"),
    getTab: vi.fn().mockResolvedValue({
      id: 42,
      url: "https://example.com/project",
      windowId: 7,
    }),
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, reject, resolve };
}

describe("browser command executor", () => {
  it("asks the browser port to close provisional tabs when a session ends", async () => {
    const port = makeBrowserPort();
    const executor = new BrowserCommandExecutor(port);

    await executor.closeAllManagedTabs();

    expect(port.closeAllTabs).toHaveBeenCalledOnce();
  });

  it("opens a background tab and marks only that tab as managed", async () => {
    const port = makeBrowserPort();
    const executor = new BrowserCommandExecutor(port);

    await expect(
      executor.execute(
        command("open_url", { url: "https://example.com/project" }),
      ),
    ).resolves.toEqual({ tab_id: 42, url: "https://example.com" });
    expect(port.createTab).toHaveBeenCalledWith(
      "https://example.com/project",
      false,
    );

    await expect(
      executor.execute(command("page_metadata", { tab_id: 99 })),
    ).rejects.toThrow(/not managed/i);
    expect(port.injectContentScript).not.toHaveBeenCalled();
  });

  it("uses the content listener prepared during managed tab creation", async () => {
    const port = makeBrowserPort();
    const executor = new BrowserCommandExecutor(port);
    await executor.execute(
      command("open_url", { url: "https://example.com/project" }),
    );

    await expect(
      executor.execute(command("page_metadata", { tab_id: 42 })),
    ).resolves.toEqual({ title: "Project" });
    expect(port.injectContentScript).not.toHaveBeenCalled();
    expect(port.sendContentCommand).toHaveBeenCalledWith(42, {
      action: "page_metadata",
    });
  });

  it("releases tab-scoped browser listeners when Chrome closes a managed tab", async () => {
    const port = makeBrowserPort();
    const executor = new BrowserCommandExecutor(port);
    await executor.execute(
      command("open_url", { url: "https://example.com/project" }),
    );

    executor.releaseTab(42);

    expect(port.releaseTab).toHaveBeenCalledWith(42);
    await expect(
      executor.execute(command("page_metadata", { tab_id: 42 })),
    ).rejects.toThrow(/not managed/i);
  });

  it("forwards the fixed semantic snapshot command without selectors", async () => {
    const port = makeBrowserPort();
    const executor = new BrowserCommandExecutor(port);
    await executor.execute(command("open_url", { url: "https://example.com/project" }));

    await executor.execute(command("page_snapshot", { tab_id: 42 }));

    expect(port.sendContentCommand).toHaveBeenCalledWith(42, {
      action: "page_snapshot",
    });
  });

  it("checks Xiaohongshu session status only inside a managed Xiaohongshu tab", async () => {
    const port = makeBrowserPort();
    port.createTab.mockResolvedValue({
      id: 42,
      url: "https://www.xiaohongshu.com/search_result?keyword=architecture",
    });
    port.getTab.mockResolvedValue({
      id: 42,
      url: "https://www.xiaohongshu.com/search_result?keyword=architecture",
      windowId: 7,
    });
    port.sendContentCommand.mockResolvedValue({ status: "logged_in" });
    const executor = new BrowserCommandExecutor(port);
    await executor.execute(command("open_url", {
      url: "https://www.xiaohongshu.com/search_result?keyword=architecture",
    }));

    await expect(executor.execute(command("xiaohongshu_session_status", {
      tab_id: 42,
    }))).resolves.toEqual({ status: "logged_in" });
    expect(port.sendContentCommand).toHaveBeenCalledWith(42, {
      action: "xiaohongshu_session_status",
    });
  });

  it("rechecks an unknown Xiaohongshu session on the same managed tab", async () => {
    const port = makeBrowserPort();
    port.createTab.mockResolvedValue({
      id: 42,
      url: "https://www.xiaohongshu.com/search_result?keyword=architecture",
    });
    port.getTab.mockResolvedValue({
      id: 42,
      url: "https://www.xiaohongshu.com/search_result?keyword=architecture",
      windowId: 7,
    });
    port.sendContentCommand
      .mockResolvedValueOnce({ status: "unknown" })
      .mockResolvedValueOnce({ status: "logged_in" });
    const delay = vi.fn().mockResolvedValue(undefined);
    const executor = new BrowserCommandExecutor(port, delay);
    await executor.execute(
      command("open_url", {
        url: "https://www.xiaohongshu.com/search_result?keyword=architecture",
      }),
    );

    await expect(
      executor.execute(
        command("xiaohongshu_session_status", { tab_id: 42 }),
      ),
    ).resolves.toEqual({ status: "logged_in" });
    expect(delay).toHaveBeenCalledOnce();
    expect(delay).toHaveBeenCalledWith(1_000);
    expect(port.sendContentCommand).toHaveBeenCalledTimes(2);
  });

  it("keeps an unresolved Xiaohongshu session bounded and fail closed", async () => {
    const port = makeBrowserPort();
    port.createTab.mockResolvedValue({
      id: 42,
      url: "https://www.xiaohongshu.com/search_result?keyword=architecture",
    });
    port.getTab.mockResolvedValue({
      id: 42,
      url: "https://www.xiaohongshu.com/search_result?keyword=architecture",
      windowId: 7,
    });
    port.sendContentCommand.mockResolvedValue({ status: "unknown" });
    const delay = vi.fn().mockResolvedValue(undefined);
    const executor = new BrowserCommandExecutor(port, delay);
    await executor.execute(
      command("open_url", {
        url: "https://www.xiaohongshu.com/search_result?keyword=architecture",
      }),
    );

    await expect(
      executor.execute(
        command("xiaohongshu_session_status", { tab_id: 42 }),
      ),
    ).resolves.toEqual({ status: "unknown" });
    expect(delay).toHaveBeenCalledTimes(5);
    expect(port.sendContentCommand).toHaveBeenCalledTimes(6);
  });

  it("rejects Xiaohongshu session checks on other public sites", async () => {
    const port = makeBrowserPort();
    const executor = new BrowserCommandExecutor(port);
    await executor.execute(command("open_url", { url: "https://example.com/project" }));

    await expect(executor.execute(command("xiaohongshu_session_status", {
      tab_id: 42,
    }))).rejects.toThrow(/xiaohongshu/i);
    expect(port.sendContentCommand).not.toHaveBeenCalled();
  });

  it("rejects a managed tab that redirects to a private network URL", async () => {
    const port = makeBrowserPort();
    const executor = new BrowserCommandExecutor(port);
    await executor.execute(
      command("open_url", { url: "https://example.com/project" }),
    );
    port.getTab.mockResolvedValue({
      id: 42,
      url: "http://127.0.0.1/private",
      windowId: 7,
    });

    await expect(
      executor.execute(command("page_metadata", { tab_id: 42 })),
    ).rejects.toThrow(/safe public http/i);
    expect(port.injectContentScript).not.toHaveBeenCalled();
  });

  it("rejects and closes an open_url tab whose final URL is private", async () => {
    const port = makeBrowserPort();
    port.getTab.mockResolvedValue({
      id: 42,
      url: "http://[::ffff:7f00:1]/private",
      windowId: 7,
    });
    const executor = new BrowserCommandExecutor(port);

    await expect(
      executor.execute(
        command("open_url", { url: "https://example.com/redirect" }),
      ),
    ).rejects.toThrow(/safe public http/i);
    expect(port.removeTab).toHaveBeenCalledWith(42);
    await expect(
      executor.execute(command("page_metadata", { tab_id: 42 })),
    ).rejects.toThrow(/not managed/i);
  });

  it("rejects and closes an open_url tab whose final URL is not HTTP(S)", async () => {
    const port = makeBrowserPort();
    port.getTab.mockResolvedValue({
      id: 42,
      url: "file:///C:/secrets.txt",
      windowId: 7,
    });
    const executor = new BrowserCommandExecutor(port);

    await expect(
      executor.execute(
        command("open_url", { url: "https://example.com/redirect" }),
      ),
    ).rejects.toThrow(/safe public http/i);
    expect(port.removeTab).toHaveBeenCalledWith(42);
  });

  it("discards a page result if the tab redirects before the final URL check", async () => {
    const port = makeBrowserPort();
    const executor = new BrowserCommandExecutor(port);
    await executor.execute(
      command("open_url", { url: "https://example.com/project" }),
    );
    port.getTab
      .mockResolvedValueOnce({
        id: 42,
        url: "https://example.com/project",
        windowId: 7,
      })
      .mockResolvedValueOnce({
        id: 42,
        url: "http://192.168.1.20/private",
        windowId: 7,
      });

    await expect(
      executor.execute(command("page_metadata", { tab_id: 42 })),
    ).rejects.toThrow(/safe public http/i);
  });

  it("crops a visible-tab screenshot locally before returning it", async () => {
    const port = makeBrowserPort();
    port.sendContentCommand.mockResolvedValue({ width: 1200, height: 800 });
    const cropper = vi
      .fn()
      .mockResolvedValue("data:image/png;base64,cropped-region");
    const executor = new BrowserCommandExecutor(port, undefined, cropper);
    await executor.execute(
      command("open_url", { url: "https://example.com/project" }),
    );
    const region = { x: 10, y: 20, width: 300, height: 200 };

    await expect(
      executor.execute(command("capture_region", { tab_id: 42, region })),
    ).resolves.toEqual({
      image_data_url: "data:image/png;base64,cropped-region",
      media_type: "image/png",
    });
    expect(port.captureTab).toHaveBeenCalledWith(42);
    expect(cropper).toHaveBeenCalledWith(
      "data:image/png;base64,full-viewport",
      region,
      { width: 1200, height: 800 },
    );
  });

  it("clips a partially visible media region to the viewport before capture", async () => {
    const port = makeBrowserPort();
    port.sendContentCommand.mockResolvedValue({ width: 1200, height: 800 });
    const cropper = vi
      .fn()
      .mockResolvedValue("data:image/png;base64,clipped-region");
    const executor = new BrowserCommandExecutor(port, undefined, cropper);
    await executor.execute(
      command("open_url", { url: "https://example.com/project" }),
    );

    await expect(
      executor.execute(
        command("capture_region", {
          tab_id: 42,
          region: { x: 10, y: 700, width: 300, height: 200 },
        }),
      ),
    ).resolves.toEqual({
      image_data_url: "data:image/png;base64,clipped-region",
      media_type: "image/png",
    });
    expect(cropper).toHaveBeenCalledWith(
      "data:image/png;base64,full-viewport",
      { x: 10, y: 700, width: 300, height: 100 },
      { width: 1200, height: 800 },
    );
  });

  it("closes and releases a managed tab", async () => {
    const port = makeBrowserPort();
    const executor = new BrowserCommandExecutor(port);
    await executor.execute(
      command("open_url", { url: "https://example.com/project" }),
    );

    await expect(
      executor.execute(command("close_tab", { tab_id: 42 })),
    ).resolves.toEqual({ closed: true });
    await expect(
      executor.execute(command("enumerate_media", { tab_id: 42 })),
    ).rejects.toThrow(/not managed/i);
  });

  it("closes and releases every managed tab when the session ends", async () => {
    const port = makeBrowserPort();
    port.createTab
      .mockResolvedValueOnce({ id: 42, url: "https://example.com/one" })
      .mockResolvedValueOnce({ id: 43, url: "https://example.com/two" });
    port.getTab
      .mockResolvedValueOnce({ id: 42, url: "https://example.com/one" })
      .mockResolvedValueOnce({ id: 43, url: "https://example.com/two" });
    const executor = new BrowserCommandExecutor(port);
    await executor.execute(command("open_url", { url: "https://example.com/one" }));
    await executor.execute(command("open_url", { url: "https://example.com/two" }));

    await executor.closeAllManagedTabs();

    expect(port.closeAllTabs).toHaveBeenCalledOnce();
    await expect(
      executor.execute(command("enumerate_media", { tab_id: 42 })),
    ).rejects.toThrow(/not managed/i);
    await expect(
      executor.execute(command("enumerate_media", { tab_id: 43 })),
    ).rejects.toThrow(/not managed/i);
  });

  it("rejects and closes a tab that finishes opening after session cleanup", async () => {
    const port = makeBrowserPort();
    const pendingTab = deferred<{ id: number; url: string }>();
    port.createTab.mockReturnValueOnce(pendingTab.promise);
    const executor = new BrowserCommandExecutor(port);

    const opened = executor.execute(
      command("open_url", { url: "https://example.com/late" }),
    );
    await executor.closeAllManagedTabs();
    pendingTab.resolve({ id: 42, url: "https://example.com/late" });

    await expect(opened).rejects.toThrow(/session ended/i);
    expect(port.removeTab).toHaveBeenCalledWith(42);
    await expect(
      executor.execute(command("enumerate_media", { tab_id: 42 })),
    ).rejects.toThrow(/not managed/i);
  });
});
