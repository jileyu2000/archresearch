import { describe, expect, it, vi } from "vitest";

import { BrowserSocketClient } from "../src/browser-socket-client";

class FakeSocket {
  readyState = 0;
  readonly OPEN = 1;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  send = vi.fn();
  close = vi.fn();

  open(): void {
    this.readyState = this.OPEN;
    this.onopen?.();
  }

  receive(message: unknown): void {
    this.onmessage?.({ data: JSON.stringify(message) });
  }
}

const validCommand = {
  type: "browser.command",
  protocol_version: 1,
  id: "cmd-7",
  action: "wait",
  payload: { milliseconds: 0 },
};

function makeExecutor() {
  return {
    execute: vi.fn().mockResolvedValue({ waited_ms: 0 }),
    releaseTab: vi.fn(),
    closeAllManagedTabs: vi.fn().mockResolvedValue(undefined),
  };
}

describe("local browser WebSocket client", () => {
  it("authenticates with the locally stored token after connecting", () => {
    const socket = new FakeSocket();
    const client = new BrowserSocketClient(
      { endpoint: "ws://127.0.0.1:8000/v1/browser", token: "pairing-token" },
      vi.fn(() => socket),
      makeExecutor(),
      { revokeAfterResearch: vi.fn() },
    );

    client.connect();
    socket.open();

    expect(socket.send).toHaveBeenCalledWith(
      JSON.stringify({
        type: "browser.authenticate",
        protocol_version: 1,
        token: "pairing-token",
      }),
    );
  });

  it("executes a valid command and returns a correlated result", async () => {
    const socket = new FakeSocket();
    const executor = makeExecutor();
    const client = new BrowserSocketClient(
      { endpoint: "ws://127.0.0.1:8000/v1/browser", token: "pairing-token" },
      vi.fn(() => socket),
      executor,
      { revokeAfterResearch: vi.fn() },
    );
    client.connect();
    socket.open();
    client.setResearchPermission(true);

    socket.receive(validCommand);
    await vi.waitFor(() => expect(executor.execute).toHaveBeenCalledOnce());

    expect(JSON.parse(socket.send.mock.calls.at(-1)![0])).toEqual({
      type: "browser.result",
      protocol_version: 1,
      id: "cmd-7",
      ok: true,
      result: { waited_ms: 0 },
    });
  });

  it("replaces a one-time pairing code with the server-issued local token", async () => {
    const socket = new FakeSocket();
    const saveRotatedToken = vi.fn().mockResolvedValue(undefined);
    const client = new BrowserSocketClient(
      { endpoint: "ws://127.0.0.1:8000/v1/browser", token: "one-time-code" },
      vi.fn(() => socket),
      makeExecutor(),
      { revokeAfterResearch: vi.fn() },
      undefined,
      saveRotatedToken,
    );
    client.connect();
    socket.open();

    socket.receive({
      type: "browser.paired",
      protocol_version: 1,
      token: "persistent-local-token",
    });

    await vi.waitFor(() =>
      expect(saveRotatedToken).toHaveBeenCalledWith("persistent-local-token"),
    );
  });

  it("returns a generic protocol error without echoing hostile input", async () => {
    const socket = new FakeSocket();
    const executor = makeExecutor();
    const client = new BrowserSocketClient(
      { endpoint: "ws://127.0.0.1:8000/v1/browser", token: "pairing-token" },
      vi.fn(() => socket),
      executor,
      { revokeAfterResearch: vi.fn() },
    );
    client.connect();
    socket.open();

    socket.receive({
      ...validCommand,
      action: "execute_script",
      payload: { code: "document.cookie" },
    });
    await vi.waitFor(() => expect(socket.send).toHaveBeenCalledTimes(2));

    expect(JSON.parse(socket.send.mock.calls.at(-1)![0])).toEqual({
      type: "browser.result",
      protocol_version: 1,
      id: "cmd-7",
      ok: false,
      error: { code: "invalid_command", message: "Command was rejected" },
    });
    expect(executor.execute).not.toHaveBeenCalled();
    expect(socket.send.mock.calls.at(-1)![0]).not.toContain("document.cookie");
  });

  it.each(["completed", "partial", "blocked", "cancelled", "failed"])(
    "revokes host permissions when a research session is %s",
    async (state) => {
      const socket = new FakeSocket();
      const revokeAfterResearch = vi.fn().mockResolvedValue(true);
      const client = new BrowserSocketClient(
        { endpoint: "ws://127.0.0.1:8000/v1/browser", token: "pairing-token" },
        vi.fn(() => socket),
        makeExecutor(),
        { revokeAfterResearch },
      );
      client.connect();
      socket.open();

      socket.receive({
        type: "research.session",
        protocol_version: 1,
        state,
      });
      await vi.waitFor(() => expect(revokeAfterResearch).toHaveBeenCalledOnce());
    },
  );

  it("revokes host permissions if the local connection closes unexpectedly", async () => {
    const socket = new FakeSocket();
    const revokeAfterResearch = vi.fn().mockResolvedValue(true);
    const client = new BrowserSocketClient(
      { endpoint: "ws://127.0.0.1:8000/v1/browser", token: "pairing-token" },
      vi.fn(() => socket),
      makeExecutor(),
      { revokeAfterResearch },
    );
    client.connect();
    socket.open();

    socket.onclose?.();
    await vi.waitFor(() => expect(revokeAfterResearch).toHaveBeenCalledOnce());
  });

  it("reconnects only after an unexpected close has cleaned up the session", async () => {
    const firstSocket = new FakeSocket();
    const secondSocket = new FakeSocket();
    const sockets = [firstSocket, secondSocket];
    const executor = makeExecutor();
    const revokeAfterResearch = vi.fn().mockResolvedValue(true);
    const scheduleReconnect = vi.fn((callback: () => void) => callback());
    const client = new BrowserSocketClient(
      { endpoint: "ws://127.0.0.1:8000/v1/browser", token: "pairing-token" },
      vi.fn(() => sockets.shift()!),
      executor,
      { revokeAfterResearch },
      undefined,
      undefined,
      scheduleReconnect,
    );
    client.connect();
    firstSocket.open();

    firstSocket.onclose?.();
    await vi.waitFor(() => expect(secondSocket.onopen).not.toBeNull());
    secondSocket.open();

    expect(executor.closeAllManagedTabs).toHaveBeenCalledOnce();
    expect(revokeAfterResearch).toHaveBeenCalledOnce();
    expect(scheduleReconnect).toHaveBeenCalledWith(expect.any(Function), 1_000);
    expect(secondSocket.send).toHaveBeenCalledWith(
      JSON.stringify({
        type: "browser.authenticate",
        protocol_version: 1,
        token: "pairing-token",
      }),
    );
  });

  it("does not reconnect after an explicit disconnect", async () => {
    const socket = new FakeSocket();
    const scheduleReconnect = vi.fn();
    const client = new BrowserSocketClient(
      { endpoint: "ws://127.0.0.1:8000/v1/browser", token: "pairing-token" },
      vi.fn(() => socket),
      makeExecutor(),
      { revokeAfterResearch: vi.fn().mockResolvedValue(true) },
      undefined,
      undefined,
      scheduleReconnect,
    );
    client.connect();
    socket.open();

    client.disconnect();
    await Promise.resolve();

    expect(scheduleReconnect).not.toHaveBeenCalled();
  });

  it("rejects research commands until permission is explicitly granted", async () => {
    const socket = new FakeSocket();
    const executor = makeExecutor();
    const client = new BrowserSocketClient(
      { endpoint: "ws://127.0.0.1:8000/v1/browser", token: "pairing-token" },
      vi.fn(() => socket),
      executor,
      { revokeAfterResearch: vi.fn() },
    );
    client.connect();
    socket.open();

    socket.receive(validCommand);
    await vi.waitFor(() => expect(socket.send).toHaveBeenCalledTimes(2));

    expect(executor.execute).not.toHaveBeenCalled();
    expect(JSON.parse(socket.send.mock.calls.at(-1)![0])).toMatchObject({
      id: "cmd-7",
      ok: false,
      error: { code: "permission_required" },
    });
  });

  it("closes managed tabs and locks commands after a terminal state", async () => {
    const socket = new FakeSocket();
    const executor = makeExecutor();
    const client = new BrowserSocketClient(
      { endpoint: "ws://127.0.0.1:8000/v1/browser", token: "pairing-token" },
      vi.fn(() => socket),
      executor,
      { revokeAfterResearch: vi.fn().mockResolvedValue(true) },
    );
    client.connect();
    socket.open();
    client.setResearchPermission(true);

    socket.receive({
      type: "research.session",
      protocol_version: 1,
      state: "completed",
    });
    await vi.waitFor(() => expect(executor.closeAllManagedTabs).toHaveBeenCalledOnce());

    socket.receive(validCommand);
    await vi.waitFor(() => expect(socket.send).toHaveBeenCalledTimes(2));
    expect(executor.execute).not.toHaveBeenCalled();

    client.setResearchPermission(true);
    socket.receive(validCommand);
    await vi.waitFor(() => expect(executor.execute).toHaveBeenCalledOnce());
  });

  it("retries permission revocation when Chrome reports failure", async () => {
    const socket = new FakeSocket();
    const revokeAfterResearch = vi
      .fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const client = new BrowserSocketClient(
      { endpoint: "ws://127.0.0.1:8000/v1/browser", token: "pairing-token" },
      vi.fn(() => socket),
      makeExecutor(),
      { revokeAfterResearch },
    );
    client.connect();
    socket.open();

    const terminal = {
      type: "research.session",
      protocol_version: 1,
      state: "failed",
    };
    socket.receive(terminal);
    await vi.waitFor(() => expect(revokeAfterResearch).toHaveBeenCalledOnce());
    socket.receive(terminal);
    await vi.waitFor(() => expect(revokeAfterResearch).toHaveBeenCalledTimes(2));
  });
});
