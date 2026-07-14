export const APPROVED_BROWSER_ACTIONS = [
  "open_url",
  "wait",
  "page_metadata",
  "page_snapshot",
  "enumerate_media",
  "scroll",
  "safe_click",
  "capture_region",
  "type_search_query",
  "close_tab",
] as const;

export type BrowserAction = (typeof APPROVED_BROWSER_ACTIONS)[number];
export type SafeClickTarget =
  | "expand"
  | "next_media"
  | "previous_media"
  | "load_more";

export type BrowserCommand =
  | Command<"open_url", { url: string }>
  | Command<"wait", { milliseconds: number }>
  | Command<"page_metadata", { tab_id: number }>
  | Command<"page_snapshot", { tab_id: number }>
  | Command<"enumerate_media", { tab_id: number }>
  | Command<
      "scroll",
      { tab_id: number; direction: "up" | "down"; distance: number }
    >
  | Command<"safe_click", { tab_id: number; target: SafeClickTarget }>
  | Command<
      "capture_region",
      {
        tab_id: number;
        region: { x: number; y: number; width: number; height: number };
      }
    >
  | Command<"type_search_query", { tab_id: number; query: string }>
  | Command<"close_tab", { tab_id: number }>;

type Command<Action extends BrowserAction, Payload> = {
  type: "browser.command";
  protocol_version: 1;
  id: string;
  action: Action;
  payload: Payload;
};

export class ProtocolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProtocolError";
  }
}

const COMMAND_KEYS = ["type", "protocol_version", "id", "action", "payload"];
const TAB_KEYS = ["tab_id"];
const SAFE_CLICK_TARGETS = [
  "expand",
  "next_media",
  "previous_media",
  "load_more",
] as const;

export function parseBrowserCommand(value: unknown): BrowserCommand {
  const message = requireObject(value, "command");
  requireExactKeys(message, COMMAND_KEYS);
  if (message.type !== "browser.command" || message.protocol_version !== 1) {
    throw new ProtocolError("Unsupported browser protocol envelope");
  }
  if (!isBoundedString(message.id, 1, 128)) {
    throw new ProtocolError("Command id must be a non-empty string");
  }
  if (
    typeof message.action !== "string" ||
    !APPROVED_BROWSER_ACTIONS.includes(message.action as BrowserAction)
  ) {
    throw new ProtocolError("Unapproved browser action");
  }

  const payload = requireObject(message.payload, "payload");
  switch (message.action as BrowserAction) {
    case "open_url": {
      requireExactKeys(payload, ["url"]);
      if (typeof payload.url !== "string" || !isSafePublicHttpUrl(payload.url)) {
        throw new ProtocolError("Navigation requires a safe public HTTP URL");
      }
      return buildCommand(message, "open_url", { url: payload.url });
    }
    case "wait": {
      requireExactKeys(payload, ["milliseconds"]);
      if (!isIntegerInRange(payload.milliseconds, 0, 10_000)) {
        throw new ProtocolError("Wait must be between 0 and 10000 milliseconds");
      }
      return buildCommand(message, "wait", {
        milliseconds: payload.milliseconds,
      });
    }
    case "page_metadata": {
      requireExactKeys(payload, TAB_KEYS);
      return buildCommand(message, "page_metadata", {
        tab_id: requireTabId(payload.tab_id),
      });
    }
    case "page_snapshot": {
      requireExactKeys(payload, ["tab_id"]);
      return buildCommand(message, "page_snapshot", {
        tab_id: requireTabId(payload.tab_id),
      });
    }
    case "enumerate_media": {
      requireExactKeys(payload, TAB_KEYS);
      return buildCommand(message, "enumerate_media", {
        tab_id: requireTabId(payload.tab_id),
      });
    }
    case "close_tab": {
      requireExactKeys(payload, TAB_KEYS);
      return buildCommand(message, "close_tab", {
        tab_id: requireTabId(payload.tab_id),
      });
    }
    case "scroll": {
      requireExactKeys(payload, ["tab_id", "direction", "distance"]);
      if (payload.direction !== "up" && payload.direction !== "down") {
        throw new ProtocolError("Scroll direction must be up or down");
      }
      if (!isIntegerInRange(payload.distance, 1, 2_000)) {
        throw new ProtocolError("Scroll distance must be between 1 and 2000");
      }
      const direction = payload.direction as "up" | "down";
      return buildCommand(message, "scroll", {
        tab_id: requireTabId(payload.tab_id),
        direction,
        distance: payload.distance,
      });
    }
    case "safe_click": {
      requireExactKeys(payload, ["tab_id", "target"]);
      if (
        typeof payload.target !== "string" ||
        !SAFE_CLICK_TARGETS.includes(payload.target as SafeClickTarget)
      ) {
        throw new ProtocolError("Unapproved safe click target");
      }
      return buildCommand(message, "safe_click", {
        tab_id: requireTabId(payload.tab_id),
        target: payload.target as SafeClickTarget,
      });
    }
    case "capture_region": {
      requireExactKeys(payload, ["tab_id", "region"]);
      const region = requireObject(payload.region, "capture region");
      requireExactKeys(region, ["x", "y", "width", "height"]);
      if (
        !isFiniteInRange(region.x, 0, 100_000) ||
        !isFiniteInRange(region.y, 0, 100_000) ||
        !isFiniteInRange(region.width, 1, 8_192) ||
        !isFiniteInRange(region.height, 1, 8_192) ||
        region.width * region.height > 16_777_216
      ) {
        throw new ProtocolError("Capture region is outside allowed bounds");
      }
      return buildCommand(message, "capture_region", {
        tab_id: requireTabId(payload.tab_id),
        region: {
          x: region.x,
          y: region.y,
          width: region.width,
          height: region.height,
        },
      });
    }
    case "type_search_query": {
      requireExactKeys(payload, ["tab_id", "query"]);
      if (
        !isBoundedString(payload.query, 1, 500) ||
        // eslint-disable-next-line no-control-regex -- C0 controls are explicitly forbidden by the protocol.
        /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/u.test(payload.query)
      ) {
        throw new ProtocolError("Search query must be 1 to 500 safe characters");
      }
      return buildCommand(message, "type_search_query", {
        tab_id: requireTabId(payload.tab_id),
        query: payload.query,
      });
    }
  }
}

function buildCommand<Action extends BrowserAction, Payload>(
  message: Record<string, unknown>,
  action: Action,
  payload: Payload,
): Command<Action, Payload> {
  return {
    type: "browser.command",
    protocol_version: 1,
    id: message.id as string,
    action,
    payload,
  };
}

function requireObject(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new ProtocolError(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function requireExactKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
): void {
  const unexpected = Object.keys(value).find((key) => !allowedKeys.includes(key));
  if (unexpected) {
    throw new ProtocolError(`Unexpected field: ${unexpected}`);
  }
  const missing = allowedKeys.find(
    (key) => !Object.prototype.hasOwnProperty.call(value, key),
  );
  if (missing) {
    throw new ProtocolError(`Missing field: ${missing}`);
  }
}

function requireTabId(value: unknown): number {
  if (!isIntegerInRange(value, 1, Number.MAX_SAFE_INTEGER)) {
    throw new ProtocolError("tab_id must be a positive integer");
  }
  return value;
}

function isIntegerInRange(
  value: unknown,
  minimum: number,
  maximum: number,
): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= minimum &&
    value <= maximum
  );
}

function isFiniteInRange(
  value: unknown,
  minimum: number,
  maximum: number,
): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= minimum &&
    value <= maximum
  );
}

function isBoundedString(
  value: unknown,
  minimum: number,
  maximum: number,
): value is string {
  return (
    typeof value === "string" &&
    value.trim().length >= minimum &&
    value.length <= maximum
  );
}

export function isSafePublicHttpUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    if (
      (url.protocol !== "http:" && url.protocol !== "https:") ||
      url.username !== "" ||
      url.password !== ""
    ) {
      return false;
    }
    return !isPrivateHostname(url.hostname);
  } catch {
    return false;
  }
}

function isPrivateHostname(rawHostname: string): boolean {
  const hostname = rawHostname.toLowerCase().replace(/^\[|\]$/gu, "");
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname === "::" ||
    hostname === "::1" ||
    /^(?:fc|fd|fe[89ab]|ff)/u.test(hostname)
  ) {
    return true;
  }

  const octets = hostname.split(".").map(Number);
  if (
    octets.length === 4 &&
    octets.every(
      (octet) => Number.isInteger(octet) && octet >= 0 && octet <= 255,
    )
  ) {
    return isPrivateIpv4(octets as [number, number, number, number]);
  }

  const ipv6 = parseIpv6(hostname);
  if (!ipv6) {
    return false;
  }
  const isMapped =
    ipv6.slice(0, 5).every((part) => part === 0) && ipv6[5] === 0xffff;
  const isCompatible = ipv6.slice(0, 6).every((part) => part === 0);
  if (!isMapped && !isCompatible) {
    return false;
  }
  const high = ipv6[6]!;
  const low = ipv6[7]!;
  return isPrivateIpv4([
    high >> 8,
    high & 0xff,
    low >> 8,
    low & 0xff,
  ]);
}

function isPrivateIpv4(
  octets: [number, number, number, number],
): boolean {
  const [first, second] = octets;
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 198 && (second === 18 || second === 19)) ||
    first >= 224
  );
}

function parseIpv6(hostname: string): number[] | null {
  if (!hostname.includes(":")) {
    return null;
  }
  const compressed = hostname.split("::");
  if (compressed.length > 2) {
    return null;
  }
  const left = compressed[0] ? compressed[0].split(":") : [];
  const right = compressed.length === 2 && compressed[1]
    ? compressed[1].split(":")
    : [];
  const missing = 8 - left.length - right.length;
  if ((compressed.length === 1 && missing !== 0) || missing < 0) {
    return null;
  }
  const parts = [
    ...left,
    ...Array.from({ length: missing }, () => "0"),
    ...right,
  ];
  if (
    parts.length !== 8 ||
    parts.some((part) => !/^[0-9a-f]{1,4}$/u.test(part))
  ) {
    return null;
  }
  return parts.map((part) => Number.parseInt(part, 16));
}
