import type { ContentCommand } from "./content/operations";
import {
  isSafePublicHttpUrl,
  isSafeXiaohongshuNoteUrl,
  isSafeXiaohongshuSearchUrl,
  type BrowserCommand,
} from "./protocol";
import { cropScreenshot, type ViewportMetrics } from "./screenshot";

export type BrowserTab = {
  id: number;
  url?: string;
  windowId?: number;
};

export type BrowserPort = {
  createTab(url: string, active: boolean): Promise<BrowserTab>;
  closeAllTabs(): Promise<void>;
  removeTab(tabId: number): Promise<void>;
  releaseTab(tabId: number): void;
  sendContentCommand(tabId: number, command: ContentCommand): Promise<unknown>;
  captureTab(tabId: number): Promise<string>;
  getTab(tabId: number): Promise<BrowserTab>;
};

type Delay = (milliseconds: number) => Promise<void>;
type ScreenshotCropper = (
  dataUrl: string,
  region: { x: number; y: number; width: number; height: number },
  viewport: ViewportMetrics,
) => Promise<string>;

const XIAOHONGSHU_SESSION_RECHECK_ATTEMPTS = 20;
const XIAOHONGSHU_SESSION_RECHECK_DELAY_MS = 1_000;
const XIAOHONGSHU_NOTE_READY_ATTEMPTS = 5;
const XIAOHONGSHU_NOTE_READY_DELAY_MS = 1_000;

export class BrowserCommandExecutor {
  private readonly managedTabIds = new Set<number>();
  private lifecycleGeneration = 0;

  constructor(
    private readonly browser: BrowserPort,
    private readonly delay: Delay = defaultDelay,
    private readonly screenshotCropper: ScreenshotCropper = cropScreenshot,
  ) {}

  async execute(command: BrowserCommand): Promise<unknown> {
    switch (command.action) {
      case "open_url": {
        const lifecycleGeneration = this.lifecycleGeneration;
        const tab = await this.browser.createTab(
          command.payload.url,
          isSafeXiaohongshuSearchUrl(command.payload.url),
        );
        if (lifecycleGeneration !== this.lifecycleGeneration) {
          await this.browser.removeTab(tab.id).catch(() => undefined);
          throw new Error("Browser research session ended while opening the tab");
        }
        this.managedTabIds.add(tab.id);
        try {
          requireSafePublicTab(await this.browser.getTab(tab.id));
          if (lifecycleGeneration !== this.lifecycleGeneration) {
            throw new Error("Browser research session ended while opening the tab");
          }
        } catch (error) {
          this.managedTabIds.delete(tab.id);
          await this.browser.removeTab(tab.id).catch(() => undefined);
          throw error;
        }
        return { tab_id: tab.id, url: tab.url ?? command.payload.url };
      }
      case "open_xiaohongshu_note":
        return this.openXiaohongshuNote(command.payload);
      case "wait":
        await this.delay(command.payload.milliseconds);
        return { waited_ms: command.payload.milliseconds };
      case "page_metadata":
        return this.executeInManagedTab(command.payload.tab_id, {
          action: "page_metadata",
        });
      case "page_snapshot":
        return this.executeInManagedTab(command.payload.tab_id, {
          action: "page_snapshot",
        });
      case "xiaohongshu_session_status":
        return this.executeXiaohongshuSessionCheck(command.payload.tab_id);
      case "enumerate_media":
        return this.executeInManagedTab(command.payload.tab_id, {
          action: "enumerate_media",
        });
      case "scroll":
        return this.executeInManagedTab(command.payload.tab_id, {
          action: "scroll",
          direction: command.payload.direction,
          distance: command.payload.distance,
        });
      case "safe_click":
        return this.executeInManagedTab(command.payload.tab_id, {
          action: "safe_click",
          target: command.payload.target,
        });
      case "type_search_query":
        return this.executeInManagedTab(command.payload.tab_id, {
          action: "type_search_query",
          query: command.payload.query,
        });
      case "capture_region":
        return this.captureRegion(
          command.payload.tab_id,
          command.payload.region,
        );
      case "close_tab":
        this.requireManagedTab(command.payload.tab_id);
        await this.browser.removeTab(command.payload.tab_id);
        this.managedTabIds.delete(command.payload.tab_id);
        return { closed: true };
    }
  }

  releaseTab(tabId: number): void {
    this.managedTabIds.delete(tabId);
    this.browser.releaseTab(tabId);
  }

  async closeAllManagedTabs(): Promise<void> {
    this.lifecycleGeneration += 1;
    this.managedTabIds.clear();
    await this.browser.closeAllTabs();
  }

  private async executeInManagedTab(
    tabId: number,
    command: ContentCommand,
  ): Promise<unknown> {
    this.requireManagedTab(tabId);
    await this.requireSafeManagedTab(tabId);
    const result = await this.browser.sendContentCommand(tabId, command);
    await this.requireSafeManagedTab(tabId);
    return result;
  }

  private async openXiaohongshuNote(payload: {
    search_url: string;
    note_url: string;
  }): Promise<{ tab_id: number; url: string }> {
    if (
      !isSafeXiaohongshuSearchUrl(payload.search_url) ||
      !isSafeXiaohongshuNoteUrl(payload.note_url)
    ) {
      throw new Error("Xiaohongshu note navigation requires approved URLs");
    }
    const lifecycleGeneration = this.lifecycleGeneration;
    const tab = await this.browser.createTab(payload.search_url, true);
    if (lifecycleGeneration !== this.lifecycleGeneration) {
      await this.browser.removeTab(tab.id).catch(() => undefined);
      throw new Error("Browser research session ended while opening the tab");
    }
    this.managedTabIds.add(tab.id);
    try {
      await this.requireXiaohongshuSearchTab(tab.id);
      let result: unknown;
      for (let attempt = 0; attempt < XIAOHONGSHU_NOTE_READY_ATTEMPTS; attempt += 1) {
        result = await this.browser.sendContentCommand(tab.id, {
          action: "open_xiaohongshu_note",
          note_url: payload.note_url,
        });
        if (isOpenedNoteResult(result)) break;
        if (attempt < XIAOHONGSHU_NOTE_READY_ATTEMPTS - 1) {
          await this.delay(XIAOHONGSHU_NOTE_READY_DELAY_MS);
          await this.requireXiaohongshuSearchTab(tab.id);
        }
      }
      if (!isOpenedNoteResult(result)) {
        throw new Error("Target Xiaohongshu note was not found in search results");
      }
      const opened = await this.waitForXiaohongshuNote(
        tab.id,
        payload.note_url,
        lifecycleGeneration,
      );
      return { tab_id: opened.id, url: opened.url! };
    } catch (error) {
      this.managedTabIds.delete(tab.id);
      await this.browser.removeTab(tab.id).catch(() => undefined);
      throw error;
    }
  }

  private async requireXiaohongshuSearchTab(tabId: number): Promise<void> {
    const tab = await this.browser.getTab(tabId);
    requireSafePublicTab(tab);
    if (!tab.url || !isSafeXiaohongshuSearchUrl(tab.url)) {
      throw new Error("Xiaohongshu note navigation requires a search result tab");
    }
  }

  private async waitForXiaohongshuNote(
    tabId: number,
    noteUrl: string,
    lifecycleGeneration: number,
  ): Promise<BrowserTab> {
    for (let attempt = 0; attempt < 50; attempt += 1) {
      if (lifecycleGeneration !== this.lifecycleGeneration) {
        throw new Error("Browser research session ended while opening the note");
      }
      const tab = await this.browser.getTab(tabId);
      if (tab.url && isSameXiaohongshuNote(tab.url, noteUrl)) {
        return tab;
      }
      if (attempt < 49) await this.delay(100);
    }
    throw new Error("Xiaohongshu note navigation did not reach the requested note");
  }

  private async executeXiaohongshuSessionCheck(
    tabId: number,
  ): Promise<unknown> {
    this.requireManagedTab(tabId);
    let tab = await this.requireXiaohongshuTab(tabId);
    if (isXiaohongshuVerificationUrl(tab.url)) {
      return { status: "verification_required" };
    }
    let result: unknown = { status: "unknown" };
    let commandError: unknown;
    let commandFailed = false;
    for (
      let attempt = 0;
      attempt <= XIAOHONGSHU_SESSION_RECHECK_ATTEMPTS;
      attempt += 1
    ) {
      try {
        result = await this.browser.sendContentCommand(tabId, {
          action: "xiaohongshu_session_status",
        });
        commandFailed = false;
      } catch (error) {
        commandError = error;
        commandFailed = true;
      }
      if (!commandFailed && !hasRetryableSessionStatus(result)) break;
      if (attempt < XIAOHONGSHU_SESSION_RECHECK_ATTEMPTS) {
        await this.delay(XIAOHONGSHU_SESSION_RECHECK_DELAY_MS);
        tab = await this.requireXiaohongshuTab(tabId);
        if (isXiaohongshuVerificationUrl(tab.url)) {
          return { status: "verification_required" };
        }
      }
    }
    tab = await this.requireXiaohongshuTab(tabId);
    if (isXiaohongshuVerificationUrl(tab.url)) {
      return { status: "verification_required" };
    }
    if (commandFailed) throw commandError;
    return result;
  }

  private async requireXiaohongshuTab(tabId: number): Promise<BrowserTab> {
    const tab = await this.browser.getTab(tabId);
    requireSafePublicTab(tab);
    const hostname = new URL(tab.url!).hostname.toLowerCase();
    if (
      hostname !== "xiaohongshu.com" &&
      !hostname.endsWith(".xiaohongshu.com")
    ) {
      throw new Error("Xiaohongshu session checks require a Xiaohongshu tab");
    }
    return tab;
  }

  private async captureRegion(
    tabId: number,
    region: { x: number; y: number; width: number; height: number },
  ): Promise<{ image_data_url: string; media_type: "image/png" }> {
    this.requireManagedTab(tabId);
    const viewport = (await this.executeInManagedTab(tabId, {
      action: "viewport_metrics",
    })) as ViewportMetrics;
    const visibleRegion = clipToViewport(region, viewport);
    await this.requireSafeManagedTab(tabId);
    const screenshot = await this.browser.captureTab(tabId);
    await this.requireSafeManagedTab(tabId);
    const cropped = await this.screenshotCropper(
      screenshot,
      visibleRegion,
      viewport,
    );
    return { image_data_url: cropped, media_type: "image/png" };
  }

  private requireManagedTab(tabId: number): void {
    if (!this.managedTabIds.has(tabId)) {
      throw new Error("Tab is not managed by this research session");
    }
  }

  private async requireSafeManagedTab(tabId: number): Promise<void> {
    try {
      requireSafePublicTab(await this.browser.getTab(tabId));
    } catch (error) {
      this.managedTabIds.delete(tabId);
      await this.browser.removeTab(tabId).catch(() => undefined);
      throw error;
    }
  }
}

function clipToViewport(
  region: { x: number; y: number; width: number; height: number },
  viewport: ViewportMetrics,
): { x: number; y: number; width: number; height: number } {
  const x = Math.max(0, region.x);
  const y = Math.max(0, region.y);
  const right = Math.min(viewport.width, region.x + region.width);
  const bottom = Math.min(viewport.height, region.y + region.height);
  if (right - x < 1 || bottom - y < 1) {
    throw new Error("Capture region falls outside the visible viewport");
  }
  return { x, y, width: right - x, height: bottom - y };
}

function requireSafePublicTab(tab: BrowserTab): void {
  if (!tab.url || !isSafePublicHttpUrl(tab.url)) {
    throw new Error("Managed tab is not at a safe public HTTP URL");
  }
}

function hasRetryableSessionStatus(value: unknown): boolean {
  return (
    value !== null &&
    typeof value === "object" &&
    "status" in value &&
    (value.status === "unknown" || value.status === "not_logged_in")
  );
}

function isXiaohongshuVerificationUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return (
      (parsed.hostname === "xiaohongshu.com" ||
        parsed.hostname.endsWith(".xiaohongshu.com")) &&
      /^\/website-login\/captcha(?:[/?#]|$)/iu.test(parsed.pathname)
    );
  } catch {
    return false;
  }
}

function isOpenedNoteResult(value: unknown): value is { opened: true } {
  return (
    value !== null &&
    typeof value === "object" &&
    "opened" in value &&
    value.opened === true
  );
}

function isSameXiaohongshuNote(actualUrl: string, targetUrl: string): boolean {
  try {
    const actual = new URL(actualUrl);
    const target = new URL(targetUrl);
    const actualNoteId = xiaohongshuNoteId(actual);
    const targetNoteId = xiaohongshuNoteId(target);
    return (
      actual.origin === target.origin &&
      actualNoteId !== null &&
      actualNoteId === targetNoteId
    );
  } catch {
    return false;
  }
}

function xiaohongshuNoteId(url: URL): string | null {
  const match = /^\/(?:explore|discovery\/item|search_result)\/([^/]+)\/?$/u.exec(
    url.pathname,
  );
  return match?.[1] ?? null;
}

function defaultDelay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
