import type { MediaCandidate } from "./content/operations";
import type { BrowserCommandExecutor } from "./browser-command-executor";
import type { BrowserCommand } from "./protocol";

const SEARCH_WAIT_MILLISECONDS = 3_500;
const SCROLL_WAIT_MILLISECONDS = 1_000;
const NOTE_WAIT_MILLISECONDS = 2_000;
const NOTE_SCROLL_WAIT_MILLISECONDS = 500;
const SCROLL_DISTANCE = 1_200;
const MAX_SOURCES = 8;
const MAX_DIRECTIONS = 6;
const MAX_NOTES_PER_DIRECTION = 4;
const TARGET_USABLE_NOTES_PER_DIRECTION = 3;
const MAX_IMAGES_PER_NOTE = 4;
const MAX_VISUAL_IMAGES = 48;
const MAX_PREVIEW_BYTES = 48 * 1024 * 1024;

export type PublicVisualSource = {
  source_url: string;
  title: string;
  image_url: string | null;
  adjacent_text: string;
};

export type PublicVisualDirection = {
  id: string;
  query: string;
};

export type PublicVisualObservation = PublicVisualSource & {
  direction_id: string;
  preview_data_url: string | null;
};

export type PublicVisualResearchResult = {
  sources: PublicVisualObservation[];
  budget: {
    image_count: number;
    preview_bytes: number;
    exhausted: boolean;
  };
};

type Executor = Pick<BrowserCommandExecutor, "execute">;

export class PublicXiaohongshuSearch {
  constructor(private readonly executor: Executor) {}

  async run(rawQuery: string): Promise<{ sources: PublicVisualSource[] }>;
  async run(directions: PublicVisualDirection[]): Promise<PublicVisualResearchResult>;
  async run(
    input: string | PublicVisualDirection[],
  ): Promise<{ sources: PublicVisualSource[] } | PublicVisualResearchResult> {
    if (typeof input === "string") return await this.runSingleSearch(input);
    return await this.runDirections(input);
  }

  private async runSingleSearch(rawQuery: string): Promise<{ sources: PublicVisualSource[] }> {
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

  private async runDirections(
    rawDirections: PublicVisualDirection[],
  ): Promise<PublicVisualResearchResult> {
    const directions = normalizeDirections(rawDirections);
    const budget = {
      image_count: 0,
      preview_bytes: 0,
      exhausted: false,
    };
    const previewByImageUrl = new Map<string, string | null>();
    const sources: PublicVisualObservation[] = [];

    for (const direction of directions) {
      if (budget.exhausted) break;
      const notes = (await this.runSingleSearch(direction.query)).sources
        .slice(0, MAX_NOTES_PER_DIRECTION);
      let usableNotes = 0;
      for (const note of notes) {
        if (
          budget.exhausted
          || usableNotes >= TARGET_USABLE_NOTES_PER_DIRECTION
          || sources.length >= MAX_VISUAL_IMAGES
        ) break;
        const inspected = await this.inspectNote(
          direction.id,
          note,
          budget,
          previewByImageUrl,
        );
        if (inspected.length > 0) usableNotes += 1;
        sources.push(...inspected.slice(0, MAX_VISUAL_IMAGES - sources.length));
      }
    }

    return { sources, budget };
  }

  private async inspectNote(
    directionId: string,
    note: PublicVisualSource,
    budget: PublicVisualResearchResult["budget"],
    previewByImageUrl: Map<string, string | null>,
  ): Promise<PublicVisualObservation[]> {
    const opened = await this.executor.execute(command("open_url", {
      url: note.source_url,
    }));
    const tabId = readTabId(opened);
    const media: MediaCandidate[] = [];
    try {
      await this.executor.execute(command("wait", {
        milliseconds: NOTE_WAIT_MILLISECONDS,
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
        milliseconds: NOTE_SCROLL_WAIT_MILLISECONDS,
      }));
      media.push(...readMedia(await this.executor.execute(command("enumerate_media", {
        tab_id: tabId,
      }))));

      const inspected: PublicVisualObservation[] = [];
      const seen = new Set<string>();
      for (const candidate of media) {
        const imageUrl = normalizeImageUrl(candidate.url);
        const region = normalizeRegion(candidate.region);
        if (!imageUrl || !region || seen.has(imageUrl)) continue;
        seen.add(imageUrl);
        if (inspected.length >= MAX_IMAGES_PER_NOTE) break;

        let previewDataUrl = previewByImageUrl.get(imageUrl);
        if (previewDataUrl === undefined) {
          if (budget.image_count >= MAX_VISUAL_IMAGES) {
            budget.exhausted = true;
            break;
          }
          budget.image_count += 1;
          previewDataUrl = await this.capturePreview(tabId, region);
          if (previewDataUrl !== null) {
            if (budget.preview_bytes + previewDataUrl.length > MAX_PREVIEW_BYTES) {
              budget.exhausted = true;
              break;
            }
            budget.preview_bytes += previewDataUrl.length;
          }
          previewByImageUrl.set(imageUrl, previewDataUrl);
        }
        inspected.push({
          direction_id: directionId,
          source_url: note.source_url,
          title: note.title,
          image_url: imageUrl,
          preview_data_url: previewDataUrl,
          adjacent_text: normalizeText(candidate.adjacent_text, 1_000)
            || normalizeText(candidate.alt, 1_000)
            || note.adjacent_text,
        });
      }
      return inspected;
    } finally {
      await this.executor.execute(command("close_tab", { tab_id: tabId }))
        .catch(() => undefined);
    }
  }

  private async capturePreview(
    tabId: number,
    region: { x: number; y: number; width: number; height: number },
  ): Promise<string | null> {
    try {
      const captured = await this.executor.execute(command("capture_region", {
        tab_id: tabId,
        region,
      }));
      if (
        !isRecord(captured)
        || captured.media_type !== "image/png"
        || typeof captured.image_data_url !== "string"
        || !captured.image_data_url.startsWith("data:image/png;base64,")
        || captured.image_data_url.length > 3_000_000
      ) return null;
      return captured.image_data_url;
    } catch {
      return null;
    }
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

function normalizeDirections(value: PublicVisualDirection[]): PublicVisualDirection[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_DIRECTIONS) {
    throw new Error("Xiaohongshu research requires 1 to 6 visual directions");
  }
  const directions: PublicVisualDirection[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (
      !isRecord(item)
      || Object.keys(item).length !== 2
      || typeof item.id !== "string"
      || !/^[A-Za-z0-9_-]{1,80}$/u.test(item.id)
      || typeof item.query !== "string"
    ) {
      throw new Error("Invalid Xiaohongshu visual direction");
    }
    const query = normalizeText(item.query, 500);
    if (!query || seen.has(item.id)) {
      throw new Error("Invalid Xiaohongshu visual direction");
    }
    seen.add(item.id);
    directions.push({ id: item.id, query });
  }
  return directions;
}

function normalizeRegion(
  value: MediaCandidate["region"],
): { x: number; y: number; width: number; height: number } | null {
  const { x, y, width, height } = value;
  if (![x, y, width, height].every(Number.isFinite)) return null;
  if (
    x < 0
    || y < 0
    || width < 1
    || height < 1
    || width > 8_192
    || height > 8_192
    || width * height > 16_777_216
  ) return null;
  return { x, y, width, height };
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
