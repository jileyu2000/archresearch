import { describe, expect, it, vi } from "vitest";

import {
  createManagedTabRemovalHandler,
  createUiMessageHandler,
} from "../src/background-runtime";

describe("background runtime bridge", () => {
  it("returns a correlated response for an approved UI command", async () => {
    const handle = vi.fn().mockResolvedValue({ connection: "connected" });
    const sendResponse = vi.fn();
    const listener = createUiMessageHandler({ handle });

    const sender = { id: "popup" };
    expect(listener({ type: "ui.status" }, sender, sendResponse)).toBe(true);
    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledOnce());

    expect(handle).toHaveBeenCalledWith({ type: "ui.status" }, sender);
    expect(sendResponse).toHaveBeenCalledWith({
      ok: true,
      result: { connection: "connected" },
    });
  });

  it("does not echo rejected UI payloads", async () => {
    const handle = vi.fn().mockRejectedValue(new Error("document.cookie"));
    const sendResponse = vi.fn();
    const listener = createUiMessageHandler({ handle });

    listener(
      { type: "ui.execute", script: "document.cookie" },
      { id: "popup" },
      sendResponse,
    );
    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledOnce());

    const response = sendResponse.mock.calls[0]![0];
    expect(response).toEqual({
      ok: false,
      error: { code: "invalid_ui_command", message: "Command was rejected" },
    });
    expect(JSON.stringify(response)).not.toContain("document.cookie");
  });

  it("releases externally closed tabs from the managed set", () => {
    const releaseTab = vi.fn();
    const listener = createManagedTabRemovalHandler({ releaseTab });

    listener(19);

    expect(releaseTab).toHaveBeenCalledWith(19);
  });
});
