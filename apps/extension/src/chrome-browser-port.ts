import type {
  BrowserPort,
  BrowserTab,
} from "./browser-command-executor";
import type { ContentCommand } from "./content/operations";
import { isSafePublicHttpUrl } from "./protocol";

type TabUpdateListener = (
  tabId: number,
  changeInfo: { status?: string; url?: string },
  tab: chrome.tabs.Tab,
) => void;

type LoadingRegistration = {
  listener: TabUpdateListener;
  dispose(error?: unknown): void;
  waitUntilReady(): Promise<string | undefined>;
};

const CONTENT_READY_TIMEOUT_MILLISECONDS = 5_000;
const CONTENT_READY_RETRY_MILLISECONDS = 50;
const CONTENT_COMMAND_TIMEOUT_MILLISECONDS = 3_000;
export const MANAGED_TAB_STORAGE_KEY = "archresearch.managed_tabs";

type ChromeApiPort = {
  storage: {
    session: {
      get(key: string): Promise<Record<string, unknown>>;
      set(items: Record<string, unknown>): Promise<void>;
      remove(key: string): Promise<void>;
    };
  };
  windows: {
    get(windowId: number): Promise<chrome.windows.Window>;
    update(
      windowId: number,
      updateInfo: { focused?: boolean; state?: chrome.windows.WindowState },
    ): Promise<chrome.windows.Window>;
  };
  tabs: {
    create(properties: { url: string; active: boolean }): Promise<chrome.tabs.Tab>;
    remove(tabId: number): Promise<void>;
    sendMessage(
      tabId: number,
      message: unknown,
      options?: { documentId?: string },
    ): Promise<unknown>;
    captureVisibleTab(
      windowId: number,
      options: { format: "png" },
    ): Promise<string>;
    get(tabId: number): Promise<chrome.tabs.Tab>;
    query(queryInfo: { active: boolean; windowId: number }): Promise<chrome.tabs.Tab[]>;
    update(
      tabId: number,
      updateProperties: { active?: boolean; url?: string },
    ): Promise<chrome.tabs.Tab | undefined>;
    onUpdated: {
      addListener(listener: TabUpdateListener): void;
      removeListener(listener: TabUpdateListener): void;
    };
  };
  scripting: {
    executeScript(options: {
      target: { tabId: number };
      files: string[];
      injectImmediately: boolean;
    }): Promise<Array<{ documentId?: string; frameId?: number }>>;
  };
};

export class ChromeBrowserPort implements BrowserPort {
  private readonly loadingListeners = new Map<number, LoadingRegistration>();
  private readonly managedTabIds = new Set<number>();
  private persistence = Promise.resolve();

  constructor(private readonly api: ChromeApiPort) {}

  async createTab(url: string, active: boolean): Promise<BrowserTab> {
    const blankTab = await this.api.tabs.create({ url: "about:blank", active });
    const tabId = requireTabId(blankTab);
    this.managedTabIds.add(tabId);
    try {
      if (active) {
        await this.restoreAndFocusWindow(requireWindowId(blankTab));
      }
      await this.persistManagedTabs();
      const contentReady = this.installLoadingListener(tabId, url);
      const navigation = Promise.resolve().then(() =>
        this.api.tabs.update(tabId, { url }),
      );
      const [navigated] = await Promise.all([navigation, contentReady]);
      return mapTab(
        navigated ?? { ...blankTab, url: undefined, pendingUrl: url },
      );
    } catch (error) {
      this.releaseLoadingListener(tabId, error);
      await this.api.tabs.remove(tabId).catch(() => undefined);
      this.managedTabIds.delete(tabId);
      await this.persistManagedTabs().catch(() => undefined);
      throw error;
    }
  }

  async removeTab(tabId: number): Promise<void> {
    this.releaseLoadingListener(tabId);
    try {
      await this.api.tabs.remove(tabId);
    } finally {
      this.managedTabIds.delete(tabId);
      await this.persistManagedTabs();
    }
  }

  async closeAllTabs(): Promise<void> {
    const tabIds = [...this.managedTabIds];
    this.managedTabIds.clear();
    for (const tabId of tabIds) {
      this.releaseLoadingListener(tabId);
    }
    await Promise.allSettled(tabIds.map((tabId) => this.api.tabs.remove(tabId)));
    await this.persistManagedTabs();
  }

  releaseTab(tabId: number): void {
    this.releaseLoadingListener(tabId);
    if (this.managedTabIds.delete(tabId)) {
      void this.persistManagedTabs().catch(() => undefined);
    }
  }

  async recoverOrphanedTabs(): Promise<void> {
    const stored = await this.api.storage.session.get(MANAGED_TAB_STORAGE_KEY);
    const candidates = stored[MANAGED_TAB_STORAGE_KEY];
    const tabIds = Array.isArray(candidates)
      ? candidates.filter(
          (value): value is number =>
            typeof value === "number" &&
            Number.isInteger(value) &&
            value > 0,
        )
      : [];
    await Promise.allSettled(tabIds.map((tabId) => this.api.tabs.remove(tabId)));
    this.managedTabIds.clear();
    await this.api.storage.session.remove(MANAGED_TAB_STORAGE_KEY);
  }

  private releaseLoadingListener(tabId: number, error?: unknown): void {
    const registration = this.loadingListeners.get(tabId);
    if (!registration) return;
    this.loadingListeners.delete(tabId);
    this.api.tabs.onUpdated.removeListener(registration.listener);
    registration.dispose(error);
  }

  async injectContentScript(tabId: number): Promise<string | undefined> {
    const results = await this.api.scripting.executeScript({
      target: { tabId },
      files: ["assets/content.js"],
      injectImmediately: true,
    });
    const mainFrame = results.find((result) => result.frameId === 0) ?? results[0];
    return mainFrame?.documentId;
  }

  async sendContentCommand(
    tabId: number,
    command: ContentCommand,
  ): Promise<unknown> {
    const registration = this.loadingListeners.get(tabId);
    const documentId = await registration?.waitUntilReady();
    let response: unknown;
    try {
      response = await this.sendContentMessage(tabId, command, documentId);
    } catch (error) {
      if (!isReadOnlyContentCommand(command) || isContentTimeout(error)) {
        throw classifyContentMessageError(error);
      }
      let recoveredDocumentId: string | undefined;
      try {
        recoveredDocumentId = await withTimeout(
          this.injectContentScript(tabId),
          CONTENT_READY_TIMEOUT_MILLISECONDS,
          new ContentCommandTimeoutError(
            "Managed page content listener was not ready in time",
          ),
        );
      } catch (injectionError) {
        if (isContentTimeout(injectionError)) throw injectionError;
        throw new ContentScriptInjectionError();
      }
      try {
        response = await this.sendContentMessage(
          tabId,
          command,
          recoveredDocumentId,
        );
      } catch (recoveredError) {
        throw classifyContentMessageError(recoveredError);
      }
    }
    if (
      response === null ||
      typeof response !== "object" ||
      !("ok" in response) ||
      response.ok !== true ||
      !("result" in response)
    ) {
      throw new ContentOperationRejectedError();
    }
    return response.result;
  }

  private sendContentMessage(
    tabId: number,
    command: ContentCommand,
    documentId: string | undefined,
  ): Promise<unknown> {
    const message = {
      type: "archresearch.content",
      protocol_version: 1,
      command,
    };
    const response = documentId
      ? this.api.tabs.sendMessage(tabId, message, { documentId })
      : this.api.tabs.sendMessage(tabId, message);
    return withTimeout(
      response,
      CONTENT_COMMAND_TIMEOUT_MILLISECONDS,
      new ContentCommandTimeoutError("Managed page content command timed out"),
    );
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

  private async restoreAndFocusWindow(windowId: number): Promise<void> {
    const browserWindow = await this.api.windows.get(windowId);
    if (browserWindow.state === "minimized") {
      await this.api.windows.update(windowId, {
        state: "normal" as chrome.windows.WindowState,
      });
    }
    await this.api.windows.update(windowId, { focused: true });
  }

  private installLoadingListener(tabId: number, targetUrl: string): Promise<void> {
    this.releaseLoadingListener(tabId);
    let disposed = false;
    let firstListenerReady = false;
    let injectionInFlight = false;
    let navigationGeneration = 0;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let readinessTimer: ReturnType<typeof setTimeout> | null = null;
    let retryDeadline = 0;
    let currentUrl: string | null = targetUrl;
    let targetNavigationObserved = false;
    let readinessState: "pending" | "resolved" | "rejected" = "pending";
    let resolveReady!: (documentId: string | undefined) => void;
    let rejectReady!: (error: unknown) => void;
    let ready!: Promise<string | undefined>;
    const settleReady = (
      error?: unknown,
      documentId?: string,
    ): void => {
      if (readinessState !== "pending") return;
      if (readinessTimer !== null) {
        clearTimeout(readinessTimer);
        readinessTimer = null;
      }
      if (error === undefined) {
        readinessState = "resolved";
        firstListenerReady = true;
        resolveReady(documentId);
      } else {
        readinessState = "rejected";
        rejectReady(error);
      }
    };
    const resetReadiness = (): void => {
      if (readinessTimer !== null) {
        clearTimeout(readinessTimer);
      }
      readinessState = "pending";
      ready = new Promise<string | undefined>((resolve, reject) => {
        resolveReady = resolve;
        rejectReady = reject;
      });
      void ready.catch(() => undefined);
      readinessTimer = setTimeout(() => {
        settleReady(
          new Error("Managed page content listener was not ready in time"),
        );
      }, CONTENT_READY_TIMEOUT_MILLISECONDS);
    };
    resetReadiness();
    const initialReady = ready;
    const dispose = (error?: unknown): void => {
      if (disposed) return;
      disposed = true;
      if (readinessTimer !== null) {
        clearTimeout(readinessTimer);
        readinessTimer = null;
      }
      if (retryTimer !== null) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
      settleReady(error ?? new Error("Managed page inspection was cancelled"));
    };
    const attemptInjection = (): void => {
      if (disposed || injectionInFlight || navigationGeneration === 0) return;
      if (retryTimer !== null) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
      const attemptGeneration = navigationGeneration;
      injectionInFlight = true;
      void this.injectContentScript(tabId).then(
        (documentId) => {
          injectionInFlight = false;
          if (disposed) return;
          if (attemptGeneration !== navigationGeneration) {
            attemptInjection();
            return;
          }
          settleReady(undefined, documentId);
        },
        () => {
          injectionInFlight = false;
          if (disposed) return;
          if (attemptGeneration !== navigationGeneration) {
            attemptInjection();
            return;
          }
          if (Date.now() >= retryDeadline) return;
          retryTimer = setTimeout(() => {
            retryTimer = null;
            if (
              !disposed &&
              attemptGeneration === navigationGeneration &&
              Date.now() < retryDeadline
            ) {
              attemptInjection();
            }
          }, CONTENT_READY_RETRY_MILLISECONDS);
        },
      );
    };
    const invalidateUnsafeNavigation = (): void => {
      currentUrl = null;
      targetNavigationObserved = false;
      const unsafeError = new Error(
        "Managed tab left the safe public HTTP boundary",
      );
      this.releaseLoadingListener(tabId, unsafeError);
      if (firstListenerReady) {
        void this.removeTab(tabId).catch(() => undefined);
      }
    };
    const listener: TabUpdateListener = (
      updatedTabId,
      changeInfo,
      tab,
    ) => {
      if (updatedTabId !== tabId || disposed) return;
      if (changeInfo.url) {
        if (!isSafePublicHttpUrl(changeInfo.url)) {
          if (
            changeInfo.url === "about:blank" &&
            !targetNavigationObserved
          ) {
            return;
          }
          invalidateUnsafeNavigation();
          return;
        }
        currentUrl = changeInfo.url;
        targetNavigationObserved = true;
      } else {
        const observedUrl = tab.pendingUrl ?? tab.url;
        if (observedUrl && isSafePublicHttpUrl(observedUrl)) {
          currentUrl = observedUrl;
          targetNavigationObserved = true;
        } else if (observedUrl && observedUrl !== "about:blank") {
          invalidateUnsafeNavigation();
          return;
        }
      }
      if (changeInfo.status !== "loading" || !targetNavigationObserved) return;
      if (!currentUrl || !isSafePublicHttpUrl(currentUrl)) return;
      if (readinessState !== "pending") {
        resetReadiness();
      }
      navigationGeneration += 1;
      retryDeadline = Date.now() + CONTENT_READY_TIMEOUT_MILLISECONDS;
      attemptInjection();
    };
    this.loadingListeners.set(tabId, {
      dispose,
      listener,
      waitUntilReady: () => ready,
    });
    this.api.tabs.onUpdated.addListener(listener);
    return initialReady.then(() => undefined);
  }

  private persistManagedTabs(): Promise<void> {
    const tabIds = [...this.managedTabIds].sort((left, right) => left - right);
    const operation = this.persistence.then(() =>
      tabIds.length > 0
        ? this.api.storage.session.set({
            [MANAGED_TAB_STORAGE_KEY]: tabIds,
          })
        : this.api.storage.session.remove(MANAGED_TAB_STORAGE_KEY),
    );
    this.persistence = operation.catch(() => undefined);
    return operation;
  }

  private async requireActiveTab(windowId: number, tabId: number): Promise<void> {
    const activeTabs = await this.api.tabs.query({ active: true, windowId });
    if (activeTabs.length !== 1 || activeTabs[0]?.id !== tabId) {
      throw new Error("Screenshot requires the active managed tab");
    }
  }
}

class ContentScriptInjectionError extends Error {
  constructor() {
    super("Packaged content listener could not be installed");
    this.name = "ContentScriptInjectionError";
  }
}

class ContentMessageUnavailableError extends Error {
  constructor() {
    super("Packaged content listener did not receive the command");
    this.name = "ContentMessageUnavailableError";
  }
}

class ContentOperationRejectedError extends Error {
  constructor() {
    super("Packaged content operation was rejected");
    this.name = "ContentOperationRejectedError";
  }
}

class ContentCommandTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContentCommandTimeoutError";
  }
}

function classifyContentMessageError(error: unknown): Error {
  return isContentTimeout(error)
    ? error
    : new ContentMessageUnavailableError();
}

function isContentTimeout(error: unknown): error is ContentCommandTimeoutError {
  return error instanceof ContentCommandTimeoutError;
}

function isReadOnlyContentCommand(command: ContentCommand): boolean {
  return [
    "page_metadata",
    "page_snapshot",
    "xiaohongshu_session_status",
    "enumerate_media",
    "viewport_metrics",
  ].includes(command.action);
}

function withTimeout<T>(
  operation: Promise<T>,
  milliseconds: number,
  timeoutError: Error,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(timeoutError), milliseconds);
    operation.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function mapTab(tab: chrome.tabs.Tab): BrowserTab {
  const id = requireTabId(tab);
  return {
    id,
    url: tab.pendingUrl ?? tab.url,
    windowId: tab.windowId,
  };
}

function requireTabId(tab: chrome.tabs.Tab): number {
  if (tab.id === undefined) {
    throw new Error("Chrome did not assign a tab id");
  }
  return tab.id;
}

function requireWindowId(tab: chrome.tabs.Tab): number {
  if (tab.windowId === undefined) {
    throw new Error("Chrome did not assign a browser window");
  }
  return tab.windowId;
}
