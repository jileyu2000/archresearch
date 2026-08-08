import type { ContentCommand } from "./operations";
import { isSafeXiaohongshuNoteUrl } from "./url-policy";

const SAFE_CLICK_TARGETS = [
  "expand",
  "next_media",
  "previous_media",
  "load_more",
] as const;

export function parseContentMessage(value: unknown): ContentCommand {
  const envelope = requireObject(value);
  requireExactKeys(envelope, ["type", "protocol_version", "command"]);
  if (
    envelope.type !== "archresearch.content" ||
    envelope.protocol_version !== 1
  ) {
    throw new Error("Unsupported content protocol");
  }
  const command = requireObject(envelope.command);
  if (typeof command.action !== "string") {
    throw new Error("Content action is required");
  }
  switch (command.action) {
    case "page_metadata":
    case "page_snapshot":
    case "xiaohongshu_session_status":
    case "enumerate_media":
    case "viewport_metrics":
      requireExactKeys(command, ["action"]);
      return { action: command.action };
    case "open_xiaohongshu_note":
      requireExactKeys(command, ["action", "note_url"]);
      if (
        typeof command.note_url !== "string" ||
        !isSafeXiaohongshuNoteUrl(command.note_url)
      ) {
        throw new Error("Invalid Xiaohongshu note URL");
      }
      return { action: "open_xiaohongshu_note", note_url: command.note_url };
    case "scroll":
      requireExactKeys(command, ["action", "direction", "distance"]);
      if (command.direction !== "up" && command.direction !== "down") {
        throw new Error("Invalid scroll direction");
      }
      if (
        typeof command.distance !== "number" ||
        !Number.isInteger(command.distance) ||
        command.distance < 1 ||
        command.distance > 2_000
      ) {
        throw new Error("Invalid scroll distance");
      }
      return {
        action: "scroll",
        direction: command.direction,
        distance: command.distance,
      };
    case "safe_click":
      requireExactKeys(command, ["action", "target"]);
      if (
        typeof command.target !== "string" ||
        !SAFE_CLICK_TARGETS.includes(
          command.target as (typeof SAFE_CLICK_TARGETS)[number],
        )
      ) {
        throw new Error("Invalid safe click target");
      }
      return {
        action: "safe_click",
        target: command.target as (typeof SAFE_CLICK_TARGETS)[number],
      };
    case "type_search_query":
      requireExactKeys(command, ["action", "query"]);
      if (
        typeof command.query !== "string" ||
        command.query.trim() === "" ||
        command.query.length > 500 ||
        // eslint-disable-next-line no-control-regex -- C0 controls are explicitly forbidden by the protocol.
        /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/u.test(command.query)
      ) {
        throw new Error("Invalid search query");
      }
      return { action: "type_search_query", query: command.query };
    default:
      throw new Error("Unapproved content action");
  }
}

function requireObject(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Content protocol value must be an object");
  }
  return value as Record<string, unknown>;
}

function requireExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
): void {
  if (
    Object.keys(value).length !== expected.length ||
    expected.some((key) => !Object.prototype.hasOwnProperty.call(value, key))
  ) {
    throw new Error("Unexpected content protocol field");
  }
}
