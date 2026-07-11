export type UiCommand =
  | { type: "ui.status" }
  | { type: "ui.disconnect" }
  | { type: "ui.permissions.request" }
  | { type: "ui.permissions.revoke" }
  | { type: "ui.pair"; endpoint: string; token: string };

const SIMPLE_COMMANDS = [
  "ui.status",
  "ui.disconnect",
  "ui.permissions.request",
  "ui.permissions.revoke",
] as const;

export function parseUiCommand(value: unknown): UiCommand {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid extension UI command");
  }
  const command = value as Record<string, unknown>;
  if (
    typeof command.type === "string" &&
    SIMPLE_COMMANDS.includes(command.type as (typeof SIMPLE_COMMANDS)[number])
  ) {
    requireExactKeys(command, ["type"]);
    return { type: command.type as (typeof SIMPLE_COMMANDS)[number] };
  }
  if (command.type === "ui.pair") {
    requireExactKeys(command, ["type", "endpoint", "token"]);
    if (
      typeof command.endpoint !== "string" ||
      typeof command.token !== "string" ||
      command.token.trim() === "" ||
      command.token.length > 512
    ) {
      throw new Error("Pairing endpoint and code are required");
    }
    return {
      type: "ui.pair",
      endpoint: command.endpoint,
      token: command.token,
    };
  }
  throw new Error("Unapproved extension UI command");
}

function requireExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
): void {
  if (
    Object.keys(value).length !== expected.length ||
    expected.some((key) => !Object.prototype.hasOwnProperty.call(value, key))
  ) {
    throw new Error("Unexpected extension UI command field");
  }
}
