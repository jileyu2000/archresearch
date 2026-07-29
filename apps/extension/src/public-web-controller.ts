import type {
  PublicVisualDirection,
  PublicVisualResearchResult,
} from "./public-xiaohongshu-search";

const PUBLIC_SCRIPT_ID = "archresearch-public-board";
const PUBLIC_SCRIPT_FILE = "assets/publicBoardBridge.js";

type PublicChromeApi = {
  tabs: {
    query(queryInfo: { active: boolean; currentWindow: boolean }): Promise<Array<{
      id?: number;
      url?: string;
    }>>;
  };
  scripting: {
    executeScript(injection: Record<string, unknown>): Promise<Array<{ result?: unknown }>>;
    getRegisteredContentScripts(filter: { ids: string[] }): Promise<Array<{
      id: string;
      matches?: string[];
    }>>;
    registerContentScripts(scripts: Array<Record<string, unknown>>): Promise<void>;
    unregisterContentScripts(filter: { ids: string[] }): Promise<void>;
  };
};

type PublicSender = {
  tab?: {
    id?: number;
    url?: string;
  };
};

type PublicPermission = {
  hasResearchAccess(): Promise<boolean>;
};

type PublicSearch = {
  run(directions: PublicVisualDirection[]): Promise<PublicVisualResearchResult>;
};

export function isPublicWebCommand(value: unknown): boolean {
  return isRecord(value)
    && typeof value.type === "string"
    && (value.type === "ui.public.connect" || value.type.startsWith("public."));
}

export class PublicWebController {
  constructor(
    private readonly api: PublicChromeApi,
    private readonly permissions: PublicPermission,
    private readonly search: PublicSearch,
  ) {}

  async handle(value: unknown, sender: unknown): Promise<Record<string, unknown>> {
    const command = parseCommand(value);
    if (command.type === "ui.public.connect") {
      return await this.connectCurrentPage();
    }
    await this.requireTrustedSender(isRecord(sender) ? sender as PublicSender : {});
    const granted = await this.permissions.hasResearchAccess();
    if (command.type === "public.status") return status(granted);
    if (!granted) throw new Error("Research permission is required");
    return await this.search.run(command.directions);
  }

  async statusForActivePage(): Promise<Record<string, unknown>> {
    const [tab] = await this.api.tabs.query({ active: true, currentWindow: true });
    await this.requireTrustedSender({ tab });
    return status(await this.permissions.hasResearchAccess());
  }

  private async connectCurrentPage(): Promise<Record<string, unknown>> {
    if (!await this.permissions.hasResearchAccess()) {
      throw new Error("Research permission is required");
    }
    const [tab] = await this.api.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !tab.url) throw new Error("No active browser tab");
    const origin = readSecureOrigin(tab.url);
    const marker = await this.api.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => Boolean(document.querySelector(
        'meta[name="archresearch-edition"][content="public"]',
      )),
    });
    if (marker[0]?.result !== true) {
      throw new Error("Current tab is not an ArchResearch public page");
    }
    const existing = await this.api.scripting.getRegisteredContentScripts({
      ids: [PUBLIC_SCRIPT_ID],
    });
    if (existing.length > 0) {
      await this.api.scripting.unregisterContentScripts({ ids: [PUBLIC_SCRIPT_ID] });
    }
    await this.api.scripting.registerContentScripts([{
      id: PUBLIC_SCRIPT_ID,
      js: [PUBLIC_SCRIPT_FILE],
      matches: [`${origin}/*`],
      persistAcrossSessions: true,
      runAt: "document_end",
    }]);
    await this.api.scripting.executeScript({
      target: { tabId: tab.id },
      files: [PUBLIC_SCRIPT_FILE],
    });
    return status(true);
  }

  private async requireTrustedSender(sender: PublicSender): Promise<void> {
    const senderUrl = sender.tab?.url;
    if (!sender.tab?.id || !senderUrl) throw new Error("Untrusted public page");
    const origin = readSecureOrigin(senderUrl);
    const scripts = await this.api.scripting.getRegisteredContentScripts({
      ids: [PUBLIC_SCRIPT_ID],
    });
    if (!scripts.some((script) => script.matches?.includes(`${origin}/*`))) {
      throw new Error("Untrusted public page");
    }
  }
}

type PublicCommand =
  | { type: "ui.public.connect" }
  | { type: "public.status" }
  | { type: "public.xiaohongshu.research"; directions: PublicVisualDirection[] };

function parseCommand(value: unknown): PublicCommand {
  if (!isRecord(value) || typeof value.type !== "string") {
    throw new Error("Unapproved public Web command");
  }
  if (
    (value.type === "ui.public.connect" || value.type === "public.status")
    && hasExactKeys(value, ["type"])
  ) {
    return { type: value.type };
  }
  if (
    value.type === "public.xiaohongshu.research"
    && hasExactKeys(value, ["type", "directions"])
    && isVisualDirections(value.directions)
  ) {
    return { type: value.type, directions: value.directions };
  }
  throw new Error("Unapproved public Web command");
}

function status(researchPermission: boolean): Record<string, unknown> {
  return {
    paired: true,
    connection: "connected",
    research_permission: researchPermission,
    visual_protocol: 2,
  };
}

function isVisualDirections(value: unknown): value is PublicVisualDirection[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 6) return false;
  const ids = new Set<string>();
  return value.every((item) => {
    if (
      !isRecord(item)
      || !hasExactKeys(item, ["id", "query"])
      || typeof item.id !== "string"
      || !/^[A-Za-z0-9_-]{1,80}$/u.test(item.id)
      || ids.has(item.id)
      || typeof item.query !== "string"
      || item.query.trim().length < 1
      || item.query.length > 500
    ) return false;
    ids.add(item.id);
    return true;
  });
}

function readSecureOrigin(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error("Current tab is not an ArchResearch public page");
  }
  return url.origin;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return (
    Object.keys(value).length === keys.length
    && keys.every((key) => Object.prototype.hasOwnProperty.call(value, key))
  );
}
