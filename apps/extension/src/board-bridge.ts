import type { UiCommand } from "./ui-protocol";

const BOARD_CHANNEL = "archresearch.board";
const EXTENSION_CHANNEL = "archresearch.extension";

type RuntimePort = {
  sendMessage(message: unknown): Promise<unknown>;
};

type BoardRequest = {
  channel: typeof BOARD_CHANNEL;
  protocol_version: 1;
  id: string;
  action: "pair" | "status";
  payload: Record<string, unknown>;
};

type ParsedRequest = {
  id: string;
  command: UiCommand;
};

export async function forwardBoardBridgeRequest(
  value: unknown,
  origin: string,
  runtime: RuntimePort,
): Promise<Record<string, unknown> | null> {
  const request = parseBoardRequest(value, origin);
  if (!request) return null;
  const response = await runtime.sendMessage(request.command);
  if (!isSafeRuntimeResponse(response)) {
    return bridgeError(request.id);
  }
  return {
    channel: EXTENSION_CHANNEL,
    protocol_version: 1,
    id: request.id,
    ...response,
  };
}

export function startBoardBridge(
  scope: Window,
  runtime: RuntimePort,
): void {
  if (!isLoopbackOrigin(scope.location.origin)) return;
  scope.addEventListener("message", (event) => {
    if (event.source !== scope || event.origin !== scope.location.origin) return;
    void forwardBoardBridgeRequest(event.data, event.origin, runtime).then(
      (response) => {
        if (response) scope.postMessage(response, event.origin);
      },
      () => scope.postMessage(bridgeError(readRequestId(event.data)), event.origin),
    );
  });
}

function parseBoardRequest(value: unknown, origin: string): ParsedRequest | null {
  if (!isLoopbackOrigin(origin) || !isRecord(value)) return null;
  if (!hasExactKeys(value, ["channel", "protocol_version", "id", "action", "payload"])) {
    return null;
  }
  if (
    value.channel !== BOARD_CHANNEL ||
    value.protocol_version !== 1 ||
    typeof value.id !== "string" ||
    value.id.length < 1 ||
    value.id.length > 128 ||
    !isRecord(value.payload)
  ) {
    return null;
  }
  const request = value as BoardRequest;
  if (request.action === "status") {
    if (!hasExactKeys(request.payload, [])) return null;
    return {
      id: request.id,
      command: { type: "ui.status" },
    };
  }
  if (request.action !== "pair" || !hasExactKeys(request.payload, ["endpoint", "token"])) {
    return null;
  }
  try {
    const pairing = readLoopbackPairing(request.payload);
    return {
      id: request.id,
      command: { type: "ui.pair", ...pairing },
    };
  } catch {
    return null;
  }
}

// Keep this validation local so the manifest content script builds as one
// classic script; Chrome content scripts cannot load an ES module import.
function readLoopbackPairing(value: Record<string, unknown>): {
  endpoint: string;
  token: string;
} {
  if (
    typeof value.endpoint !== "string" ||
    typeof value.token !== "string" ||
    value.token.trim() === "" ||
    value.token.length > 512
  ) {
    throw new Error("Invalid pairing");
  }
  const endpoint = new URL(value.endpoint);
  const host = endpoint.hostname.replace(/^\[|\]$/gu, "").toLowerCase();
  if (
    endpoint.protocol !== "ws:" ||
    !["127.0.0.1", "localhost", "::1"].includes(host) ||
    endpoint.username !== "" ||
    endpoint.password !== ""
  ) {
    throw new Error("Invalid pairing endpoint");
  }
  return { endpoint: endpoint.toString(), token: value.token };
}

function isLoopbackOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return (
      url.protocol === "http:" &&
      ["127.0.0.1", "localhost", "::1"].includes(
        url.hostname.replace(/^\[|\]$/gu, "").toLowerCase(),
      ) &&
      url.username === "" &&
      url.password === ""
    );
  } catch {
    return false;
  }
}

function isSafeRuntimeResponse(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value) || typeof value.ok !== "boolean") return false;
  if (value.ok === false) {
    return hasExactKeys(value, ["ok", "error"]) && isRecord(value.error);
  }
  if (!hasExactKeys(value, ["ok", "result"]) || !isRecord(value.result)) return false;
  const result = value.result;
  return (
    hasExactKeys(result, ["paired", "connection", "research_permission"]) &&
    typeof result.paired === "boolean" &&
    ["disconnected", "connecting", "connected", "error"].includes(
      String(result.connection),
    ) &&
    typeof result.research_permission === "boolean"
  );
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
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.prototype.hasOwnProperty.call(value, key))
  );
}

if (typeof window !== "undefined" && typeof chrome !== "undefined") {
  startBoardBridge(window, chrome.runtime);
}
