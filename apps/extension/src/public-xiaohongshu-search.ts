import type { MediaCandidate } from "./content/operations";
import type { BrowserCommandExecutor } from "./browser-command-executor";
import type { BrowserCommand } from "./protocol";

const SEARCH_WAIT_MILLISECONDS = 3_500;
const SCROLL_WAIT_MILLISECONDS = 1_000;
const SCROLL_DISTANCE = 1_200;
const MAX_SOURCES = 8;

export type PublicVisualSource = {
  source_url: string;
  title: string;
  image_url: string | null;
  adjacent_text: string;
};

type Executor = Pick<BrowserCommandExecutor, "execute">;

export class PublicXiaohongshuSearch {
  constructor(private readonly executor: Executor) {}

  async run(rawQuery: string): Promise<{ sources: PublicVisualSource[] }> {
    const query = normalizeText(rawQuery, 500);
    if (!query) throw new Error("Xiaohongshu search query is required");

    const opened = await this.executor.execute(command("open_url", {
      url: `https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(query)}&source=web_search_result_notes`,
    }));
    const tabId = readTabId(opened);
    const media: MediaCandidate[] = [];
    try {
      await this.executor.execute(command("wait", {
        milliseconds: SEARCH_WAIT_MILLISECONDS,
      }));
      media.push(...readMedia(await this.executor.execute(command("enumerate_media", {
        tab_id: tabId,
      }))));
      await this.executor.execute(command("scroll", {
        tab_id: tabId,
        direction: "down",
        distance: SCROLL_DISTANCE,
      }));
      await this.executor.execute(command("wait", {
        milliseconds: SCROLL_WAIT_MILLISECONDS,
      }));
      media.push(...readMedia(await this.executor.execute(command("enumerate_media", {
        tab_id: tabId,
      }))));
    } finally {
      await this.executor.execute(command("close_tab", { tab_id: tabId }))
        .catch(() => undefined);
    }
    return { sources: sanitizeSources(media) };
  }
}

function command<Action extends BrowserCommand["action"]>(
  action: Action,
  payload: Extract<BrowserCommand, { action: Action }>["payload"],
): Extract<BrowserCommand, { action: Action }> {
  return {
    type: "browser.command",
    protocol_version: 1,
    id: crypto.randomUUID(),
    action,
    payload,
  } as Extract<BrowserCommand, { action: Action }>;
}

function readTabId(value: unknown): number {
  if (!isRecord(value) || !Number.isSafeInteger(value.tab_id) || Number(value.tab_id) < 1) {
    throw new Error("Xiaohongshu search did not open a managed tab");
  }
  return Number(value.tab_id);
}

function readMedia(value: unknown): MediaCandidate[] {
  if (!isRecord(value) || !Array.isArray(value.media)) return [];
  return value.media.slice(0, 100).filter(isMediaCandidate);
}

function isMediaCandidate(value: unknown): value is MediaCandidate {
  if (!isRecord(value)) return false;
  return (
    (value.media_type === "image" || value.media_type === "canvas" || value.media_type === "svg")
    && (typeof value.url === "string" || value.url === null)
    && (typeof value.link_url === "string" || value.link_url === null)
    && typeof value.alt === "string"
    && typeof value.adjacent_text === "string"
  );
}

function sanitizeSources(media: MediaCandidate[]): PublicVisualSource[] {
  const sources: PublicVisualSource[] = [];
  const seen = new Set<string>();
  for (const candidate of media) {
    const sourceUrl = normalizeNoteUrl(candidate.link_url);
    if (!sourceUrl || seen.has(sourceUrl)) continue;
    seen.add(sourceUrl);
    const adjacentText = normalizeText(candidate.adjacent_text, 1_000);
    const title = normalizeText(candidate.alt, 240)
      || adjacentText.slice(0, 240)
      || "小红书视觉参考";
    sources.push({
      source_url: sourceUrl,
      title,
      image_url: normalizeImageUrl(candidate.url),
      adjacent_text: adjacentText || title,
    });
    if (sources.length === MAX_SOURCES) break;
  }
  return sources;
}

function normalizeNoteUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/\.$/u, "");
    if (
      url.protocol !== "https:"
      || (host !== "xiaohongshu.com" && !host.endsWith(".xiaohongshu.com"))
      || !["/explore/", "/discovery/item/", "/search_result/"].some(
        (prefix) => url.pathname.startsWith(prefix),
      )
    ) return null;
    return `${url.origin}${url.pathname}`;
  } catch {
    return null;
  }
}

function normalizeImageUrl(value: string | null): string | null {
  if (!value || value.length > 2_048) return null;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/\.$/u, "");
    if (
      url.protocol !== "https:"
      || (host !== "xhscdn.com" && !host.endsWith(".xhscdn.com"))
      || url.username
      || url.password
    ) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function normalizeText(value: string, limit: number): string {
  return value
    // eslint-disable-next-line no-control-regex -- browser text is explicitly sanitized.
    .replace(/[\u0000-\u001F\u007F]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, limit);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
