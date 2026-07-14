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
  removeTab(tabId: number): Promise<void>;
  injectContentScript(tabId: number): Promise<void>;
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

  constructor(
    private readonly browser: BrowserPort,
    private readonly delay: Delay = defaultDelay,
    private readonly screenshotCropper: ScreenshotCropper = cropScreenshot,
  ) {}

  async execute(command: BrowserCommand): Promise<unknown> {
    switch (command.action) {
      case "open_url": {
        const tab = await this.browser.createTab(command.payload.url, false);
        try {
          requireSafePublicTab(await this.browser.getTab(tab.id));
        } catch (error) {
          await this.browser.removeTab(tab.id).catch(() => undefined);
          throw error;
        }
        this.managedTabIds.add(tab.id);
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
  }

  async closeAllManagedTabs(): Promise<void> {
    const tabIds = [...this.managedTabIds];
    this.managedTabIds.clear();
    await Promise.allSettled(tabIds.map((tabId) => this.browser.removeTab(tabId)));
  }

  private async executeInManagedTab(
    tabId: number,
    command: ContentCommand,
  ): Promise<unknown> {
    this.requireManagedTab(tabId);
    await this.requireSafeManagedTab(tabId);
    await this.browser.injectContentScript(tabId);
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
    await this.requireSafeManagedTab(tabId);
    const screenshot = await this.browser.captureTab(tabId);
    await this.requireSafeManagedTab(tabId);
    const cropped = await this.screenshotCropper(screenshot, region, viewport);
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

function requireSafePublicTab(tab: BrowserTab): void {
  if (!tab.url || !isSafePublicHttpUrl(tab.url)) {
    throw new Error("Managed tab is not at a safe public HTTP URL");
  }
}

function defaultDelay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
