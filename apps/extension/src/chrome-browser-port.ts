import type {
  BrowserPort,
  BrowserTab,
} from "./browser-command-executor";
import type { ContentCommand } from "./content/operations";

type ChromeApiPort = {
  tabs: {
    create(properties: { url: string; active: boolean }): Promise<chrome.tabs.Tab>;
    remove(tabId: number): Promise<void>;
    sendMessage(tabId: number, message: unknown): Promise<unknown>;
    captureVisibleTab(
      windowId: number,
      options: { format: "png" },
    ): Promise<string>;
    get(tabId: number): Promise<chrome.tabs.Tab>;
    query(queryInfo: { active: boolean; windowId: number }): Promise<chrome.tabs.Tab[]>;
    update(
      tabId: number,
      updateProperties: { active: boolean },
    ): Promise<chrome.tabs.Tab | undefined>;
  };
  scripting: {
    executeScript(options: {
      target: { tabId: number };
      files: string[];
    }): Promise<unknown>;
  };
};

export class ChromeBrowserPort implements BrowserPort {
  constructor(private readonly api: ChromeApiPort) {}

  async createTab(url: string, active: boolean): Promise<BrowserTab> {
    return mapTab(await this.api.tabs.create({ url, active }));
  }

  removeTab(tabId: number): Promise<void> {
    return this.api.tabs.remove(tabId);
  }

  async injectContentScript(tabId: number): Promise<void> {
    await this.api.scripting.executeScript({
      target: { tabId },
      files: ["assets/content.js"],
    });
  }

  async sendContentCommand(
    tabId: number,
    command: ContentCommand,
  ): Promise<unknown> {
    const response = await this.api.tabs.sendMessage(tabId, {
      type: "archresearch.content",
      protocol_version: 1,
      command,
    });
    if (
      response === null ||
      typeof response !== "object" ||
      !("ok" in response) ||
      response.ok !== true ||
      !("result" in response)
    ) {
      throw new Error("Packaged content operation failed");
    }
    return response.result;
  }

  async captureTab(tabId: number): Promise<string> {
    const tab = await this.api.tabs.get(tabId);
    if (tab.windowId === undefined) {
      throw new Error("Managed tab has no browser window");
    }
    const [previouslyActive] = await this.api.tabs.query({
      active: true,
      windowId: tab.windowId,
    });
    const shouldRestore = previouslyActive?.id !== tabId;
    if (shouldRestore) {
      await this.api.tabs.update(tabId, { active: true });
    }
    try {
      await this.requireActiveTab(tab.windowId, tabId);
      const screenshot = await this.api.tabs.captureVisibleTab(tab.windowId, {
        format: "png",
      });
      await this.requireActiveTab(tab.windowId, tabId);
      return screenshot;
    } finally {
      if (shouldRestore && previouslyActive?.id !== undefined) {
        await this.api.tabs.update(previouslyActive.id, { active: true });
      }
    }
  }

  async getTab(tabId: number): Promise<BrowserTab> {
    return mapTab(await this.api.tabs.get(tabId));
  }

  private async requireActiveTab(windowId: number, tabId: number): Promise<void> {
    const activeTabs = await this.api.tabs.query({ active: true, windowId });
    if (activeTabs.length !== 1 || activeTabs[0]?.id !== tabId) {
      throw new Error("Screenshot requires the active managed tab");
    }
  }
}

function mapTab(tab: chrome.tabs.Tab): BrowserTab {
  if (tab.id === undefined) {
    throw new Error("Chrome did not assign a tab id");
  }
  return {
    id: tab.id,
    url: tab.pendingUrl ?? tab.url,
    windowId: tab.windowId,
  };
}
