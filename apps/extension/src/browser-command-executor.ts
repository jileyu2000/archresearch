import type { ContentCommand } from "./content/operations";
import { isSafePublicHttpUrl, type BrowserCommand } from "./protocol";
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
        const tab = await this.browser.createTab(command.payload.url, false);
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

function defaultDelay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
