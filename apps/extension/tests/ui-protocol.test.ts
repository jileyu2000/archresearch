import { describe, expect, it } from "vitest";

import { parseUiCommand } from "../src/ui-protocol";

describe("extension UI protocol", () => {
  it.each([
    { type: "ui.status" },
    { type: "ui.disconnect" },
    { type: "ui.permissions.request" },
    { type: "ui.permissions.revoke" },
    {
      type: "ui.pair",
      endpoint: "ws://127.0.0.1:8000/v1/browser",
      token: "pairing-code",
    },
  ])("accepts fixed UI command $type", (command) => {
    expect(parseUiCommand(command)).toEqual(command);
  });

  it.each([
    { type: "ui.status", include_cookies: true },
    { type: "ui.pair", endpoint: "ws://127.0.0.1:8000", token: "x", script: "x" },
    { type: "ui.execute", action: "arbitrary" },
  ])("rejects unexpected UI fields or actions", (command) => {
    expect(() => parseUiCommand(command)).toThrow();
  });
});
