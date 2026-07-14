import { describe, expect, it, vi } from "vitest";

import { forwardBoardBridgeRequest } from "../src/board-bridge";

const pairRequest = {
  channel: "archresearch.board",
  protocol_version: 1,
  id: "request-1",
  action: "pair",
  payload: {
    endpoint: "ws://127.0.0.1:8000/v1/browser",
    token: "one-time-code",
  },
};

describe("loopback Board bridge", () => {
  it("forwards one exact pairing command and correlates the safe response", async () => {
    const runtime = {
      sendMessage: vi.fn().mockResolvedValue({
        ok: true,
        result: {
          paired: true,
          connection: "connecting",
          research_permission: false,
        },
      }),
    };

    await expect(
      forwardBoardBridgeRequest(
        pairRequest,
        "http://127.0.0.1:5173",
        runtime,
      ),
    ).resolves.toEqual({
      channel: "archresearch.extension",
      protocol_version: 1,
      id: "request-1",
      ok: true,
      result: {
        paired: true,
        connection: "connecting",
        research_permission: false,
      },
    });
    expect(runtime.sendMessage).toHaveBeenCalledWith({
      type: "ui.pair",
      endpoint: "ws://127.0.0.1:8000/v1/browser",
      token: "one-time-code",
    });
  });

  it.each([
    ["https://example.com", pairRequest],
    ["http://127.0.0.1:5173", { ...pairRequest, script: "document.cookie" }],
    ["http://127.0.0.1:5173", { ...pairRequest, action: "execute_script" }],
  ])("rejects non-loopback or non-enumerated page messages", async (origin, request) => {
    const runtime = { sendMessage: vi.fn() };

    await expect(
      forwardBoardBridgeRequest(request, origin, runtime),
    ).resolves.toBeNull();
    expect(runtime.sendMessage).not.toHaveBeenCalled();
  });
});
