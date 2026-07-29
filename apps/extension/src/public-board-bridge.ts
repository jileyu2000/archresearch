import type { PublicVisualObservation } from "./public-xiaohongshu-search";

const BOARD_CHANNEL = "archresearch.board";
const EXTENSION_CHANNEL = "archresearch.extension";

type RuntimePort = {
  sendMessage(message: unknown): Promise<unknown>;
};

type ParsedRequest = {
  action: "status" | "xiaohongshu_research";
  id: string;
  command: Record<string, unknown>;
};

export async function forwardPublicBoardBridgeRequest(
  value: unknown,
  origin: string,
  runtime: RuntimePort,
): Promise<Record<string, unknown> | null> {
  const request = parseRequest(value, origin);
  if (!request) return null;
  const response = await runtime.sendMessage(request.command);
  if (!isSafeRuntimeResponse(response, request.action)) {
    return bridgeError(request.id);
  }
  return {
    channel: EXTENSION_CHANNEL,
    protocol_version: 2,
    id: request.id,
    ...response,
  };
}

export function startPublicBoardBridge(scope: Window, runtime: RuntimePort): void {
  const marker = "__archresearchPublicBridgeStarted";
  const state = scope as unknown as Record<string, unknown>;
  if (!isSecureOrigin(scope.location.origin)
    || !scope.document.querySelector('meta[name="archresearch-edition"][content="public"]')
  ) return;
  if (state[marker] === true) {
    announceReady(scope);
    return;
  }
  state[marker] = true;
  scope.addEventListener("message", (event) => {
    if (event.source !== scope || event.origin !== scope.location.origin) return;
    void forwardPublicBoardBridgeRequest(event.data, event.origin, runtime).then(
      (response) => {
        if (response) scope.postMessage(response, event.origin);
      },
      () => scope.postMessage(bridgeError(readRequestId(event.data)), event.origin),
    );
  });
  announceReady(scope);
}

function announceReady(scope: Window): void {
  scope.postMessage({
    channel: EXTENSION_CHANNEL,
    protocol_version: 2,
    action: "ready",
  }, scope.location.origin);
}

function parseRequest(value: unknown, origin: string): ParsedRequest | null {
  if (!isSecureOrigin(origin) || !isRecord(value)) return null;
  if (!hasExactKeys(value, ["channel", "protocol_version", "id", "action", "payload"])) {
    return null;
  }
  if (
    value.channel !== BOARD_CHANNEL
    || value.protocol_version !== 2
    || typeof value.id !== "string"
    || value.id.length < 1
    || value.id.length > 128
    || !isRecord(value.payload)
  ) return null;
  if (value.action === "status" && hasExactKeys(value.payload, [])) {
    return {
      action: "status",
      id: value.id,
      command: { type: "public.status" },
    };
  }
  if (
    value.action === "xiaohongshu_research"
    && hasExactKeys(value.payload, ["directions"])
    && isVisualDirections(value.payload.directions)
  ) {
    return {
      action: "xiaohongshu_research",
      id: value.id,
      command: {
        type: "public.xiaohongshu.research",
        directions: value.payload.directions,
      },
    };
  }
  return null;
}

function isSafeRuntimeResponse(
  value: unknown,
  action: ParsedRequest["action"],
): value is Record<string, unknown> {
  if (!isRecord(value) || typeof value.ok !== "boolean") return false;
  if (value.ok === false) {
    return hasExactKeys(value, ["ok", "error"]) && isRecord(value.error);
  }
  if (!hasExactKeys(value, ["ok", "result"]) || !isRecord(value.result)) return false;
  if (action === "status") return isStatus(value.result);
  return (
    hasExactKeys(value.result, ["sources", "budget"])
    && Array.isArray(value.result.sources)
    && value.result.sources.length <= 48
    && value.result.sources.every(isVisualSource)
    && isVisualBudget(value.result.budget)
    && totalPreviewBytes(value.result.sources) <= 48 * 1024 * 1024
  );
}

function isStatus(value: Record<string, unknown>): boolean {
  return (
    hasExactKeys(value, ["paired", "connection", "research_permission", "visual_protocol"])
    && value.paired === true
    && value.connection === "connected"
    && typeof value.research_permission === "boolean"
    && value.visual_protocol === 2
  );
}

function isVisualSource(value: unknown): value is PublicVisualObservation {
  return (
    isRecord(value)
    && hasExactKeys(value, [
      "direction_id",
      "source_url",
      "title",
      "image_url",
      "preview_data_url",
      "adjacent_text",
    ])
    && typeof value.direction_id === "string"
    && /^[A-Za-z0-9_-]{1,80}$/u.test(value.direction_id)
    && typeof value.source_url === "string"
    && value.source_url.length <= 2_048
    && typeof value.title === "string"
    && value.title.length <= 240
    && typeof value.image_url === "string"
    && value.image_url.length <= 2_048
    && (value.preview_data_url === null || (
      typeof value.preview_data_url === "string"
      && value.preview_data_url.startsWith("data:image/png;base64,")
      && value.preview_data_url.length <= 3_000_000
    ))
    && typeof value.adjacent_text === "string"
    && value.adjacent_text.length <= 1_000
  );
}

function isVisualDirections(value: unknown): boolean {
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

function isVisualBudget(value: unknown): boolean {
  return isRecord(value)
    && hasExactKeys(value, ["image_count", "preview_bytes", "exhausted"])
    && Number.isInteger(value.image_count)
    && Number(value.image_count) >= 0
    && Number(value.image_count) <= 48
    && Number.isInteger(value.preview_bytes)
    && Number(value.preview_bytes) >= 0
    && Number(value.preview_bytes) <= 48 * 1024 * 1024
    && typeof value.exhausted === "boolean";
}

function totalPreviewBytes(sources: unknown[]): number {
  return sources.reduce<number>((total, source) => (
    total + (
      isRecord(source) && typeof source.preview_data_url === "string"
        ? source.preview_data_url.length
        : 0
    )
  ), 0);
}

function isSecureOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

function bridgeError(id: string): Record<string, unknown> {
  return {
    channel: EXTENSION_CHANNEL,
    protocol_version: 2,
    id,
    ok: false,
    error: { code: "bridge_error", message: "Extension command failed" },
  };
}

function readRequestId(value: unknown): string {
  return isRecord(value) && typeof value.id === "string" && value.id.length <= 128
    ? value.id
    : "unknown";
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

if (typeof window !== "undefined" && typeof chrome !== "undefined") {
  startPublicBoardBridge(window, chrome.runtime);
}
