// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";

import {
  createContentMessageHandler,
  installContentScript,
} from "../src/content/index";

describe("content-script entry point", () => {
  it("executes only a valid packaged content command", () => {
    const sendResponse = vi.fn();
    const listener = createContentMessageHandler(document, window);

    const keepChannelOpen = listener(
      {
        type: "archresearch.content",
        protocol_version: 1,
        command: { action: "viewport_metrics" },
      },
      sendResponse,
    );

    expect(keepChannelOpen).toBe(false);
    expect(sendResponse).toHaveBeenCalledWith({
      ok: true,
      result: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
    });
  });

  it("returns a generic error for an escape-hatch command", () => {
    const sendResponse = vi.fn();
    const listener = createContentMessageHandler(document, window);

    listener(
      {
        type: "archresearch.content",
        protocol_version: 1,
        command: { action: "execute_script", code: "document.cookie" },
      },
      sendResponse,
    );

    expect(sendResponse).toHaveBeenCalledWith({
      ok: false,
      error: { code: "invalid_content_command", message: "Command was rejected" },
    });
    expect(JSON.stringify(sendResponse.mock.calls[0]![0])).not.toContain(
      "document.cookie",
    );
  });

  it("registers only one listener when the bundled script is injected again", () => {
    const addListener = vi.fn();
    const runtime = { onMessage: { addListener } };
    const pageState: { archresearchContentInstalled?: boolean } = {};

    installContentScript(runtime, document, window, pageState);
    installContentScript(runtime, document, window, pageState);

    expect(addListener).toHaveBeenCalledOnce();
    expect(pageState.archresearchContentInstalled).toBe(true);
  });
});
