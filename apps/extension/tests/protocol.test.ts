import { describe, expect, it } from "vitest";

import {
  APPROVED_BROWSER_ACTIONS,
  ProtocolError,
  parseBrowserCommand,
} from "../src/protocol";

const command = (action: string, payload: unknown) => ({
  type: "browser.command",
  protocol_version: 1,
  id: "cmd-1",
  action,
  payload,
});

describe("browser command protocol", () => {
  it("accepts every approved action with its exact payload", () => {
    const messages = [
      command("open_url", { url: "https://example.com/project" }),
      command("wait", { milliseconds: 250 }),
      command("page_metadata", { tab_id: 1 }),
      command("enumerate_media", { tab_id: 1 }),
      command("scroll", { tab_id: 1, direction: "down", distance: 600 }),
      command("safe_click", { tab_id: 1, target: "next_media" }),
      command("capture_region", {
        tab_id: 1,
        region: { x: 0, y: 0, width: 800, height: 600 },
      }),
      command("type_search_query", { tab_id: 1, query: "museum section" }),
      command("close_tab", { tab_id: 1 }),
    ];

    expect(messages.map(parseBrowserCommand).map((item) => item.action)).toEqual(
      APPROVED_BROWSER_ACTIONS,
    );
  });

  it.each([
    command("execute_script", { code: "document.cookie" }),
    command("read_cookie", {}),
    command("submit_form", { selector: "form" }),
    command("social_action", { action: "like" }),
  ])("rejects unapproved action $action", (message) => {
    expect(() => parseBrowserCommand(message)).toThrow(ProtocolError);
  });

  it.each(["selector", "script", "javascript", "cookie", "password"])(
    "rejects injected %s fields even on approved actions",
    (field) => {
      expect(() =>
        parseBrowserCommand(
          command("page_metadata", { tab_id: 1, [field]: "unexpected" }),
        ),
      ).toThrow(/unexpected field/i);
    },
  );

  it.each([
    "javascript:alert(1)",
    "file:///C:/secrets.txt",
    "ftp://example.com/project",
    "chrome://settings/",
    "https://user:secret@example.com/",
    "http://127.0.0.1/admin",
    "http://192.168.1.10/",
    "http://localhost:3000/",
    "http://[::1]/",
    "http://[::ffff:127.0.0.1]/",
    "http://[::ffff:7f00:1]/",
    "http://[0:0:0:0:0:ffff:c0a8:101]/",
    "http://2130706433/",
    "http://0x7f000001/",
    "http://0177.0.0.1/",
  ])("rejects unsafe navigation URL %s", (url) => {
    expect(() => parseBrowserCommand(command("open_url", { url }))).toThrow(
      /safe public http/i,
    );
  });

  it("allows only fixed safe-click targets", () => {
    expect(() =>
      parseBrowserCommand(
        command("safe_click", { tab_id: 1, target: "comment" }),
      ),
    ).toThrow(/safe click target/i);
  });
});
