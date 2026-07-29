import type { PublicVisualSource } from "./public-xiaohongshu-search";

const BOARD_CHANNEL = "archresearch.board";
const EXTENSION_CHANNEL = "archresearch.extension";

type RuntimePort = {
  sendMessage(message: unknown): Promise<unknown>;
};

type ParsedRequest = {
  action: "status" | "xiaohongshu_search";
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
    protocol_version: 1,
    id: request.id,
    ...response,
  };
}

export function startPublicBoardBridge(scope: Window, runtime: RuntimePort): void {
  const marker = "__archresearchPublicBridgeStarted";
  const state = scope as unknown as Record<string, unknown>;
  if (
    state[marker] === true
    ||
    !isSecureOrigin(scope.location.origin)
    || !scope.document.querySelector('meta[name="archresearch-edition"][content="public"]')
  ) return;
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
}

function parseRequest(value: unknown, origin: string): ParsedRequest | null {
  if (!isSecureOrigin(origin) || !isRecord(value)) return null;
  if (!hasExactKeys(value, ["channel", "protocol_version", "id", "action", "payload"])) {
    return null;
  }
  if (
    value.channel !== BOARD_CHANNEL
    || value.protocol_version !== 1
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
    value.action === "xiaohongshu_search"
    && hasExactKeys(value.payload, ["query"])
    && typeof value.payload.query === "string"
    && value.payload.query.trim().length > 0
    && value.payload.query.length <= 500
  ) {
    return {
      action: "xiaohongshu_search",
      id: value.id,
      command: {
        type: "public.xiaohongshu.search",
        query: value.payload.query,
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
    hasExactKeys(value.result, ["sources"])
    && Array.isArray(value.result.sources)
    && value.result.sources.length <= 8
    && value.result.sources.every(isVisualSource)
  );
}

function isStatus(value: Record<string, unknown>): boolean {
  return (
    hasExactKeys(value, ["paired", "connection", "research_permission"])
    && value.paired === true
    && value.connection === "connected"
    && typeof value.research_permission === "boolean"
  );
}

function isVisualSource(value: unknown): value is PublicVisualSource {
  return (
    isRecord(value)
    && hasExactKeys(value, ["source_url", "title", "image_url", "adjacent_text"])
    && typeof value.source_url === "string"
    && value.source_url.length <= 2_048
    && typeof value.title === "string"
    && value.title.length <= 240
    && (typeof value.image_url === "string" || value.image_url === null)
    && typeof value.adjacent_text === "string"
    && value.adjacent_text.length <= 1_000
  );
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
    protocol_version: 1,
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
