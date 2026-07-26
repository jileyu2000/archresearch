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

  closeFromServer(event: { code: number; reason: string }): void {
    (
      this.onclose as unknown as
        | ((closeEvent: { code: number; reason: string }) => void)
        | null
    )?.(event);
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

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, reject, resolve };
}

describe("local browser WebSocket client", () => {
  it("keeps the authenticated MV3 service worker active every 20 seconds", () => {
    vi.useFakeTimers();
    try {
      const socket = new FakeSocket();
      const client = new BrowserSocketClient(
        { endpoint: "ws://127.0.0.1:8000/v1/browser", token: "pairing-token" },
        vi.fn(() => socket),
        makeExecutor(),
      );
      client.connect();
      socket.open();
      socket.receive({ type: "browser.authenticated", protocol_version: 1 });
      socket.send.mockClear();

      vi.advanceTimersByTime(20_000);

      expect(socket.send).toHaveBeenCalledOnce();
      expect(JSON.parse(socket.send.mock.calls[0]![0])).toEqual({
        type: "browser.heartbeat",
        protocol_version: 1,
      });

      client.disconnect(false);
      vi.advanceTimersByTime(20_000);
      expect(socket.send).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });

  it("reports connected only after the server authenticates the saved token", () => {
    const socket = new FakeSocket();
    const onStatus = vi.fn();
    const client = new BrowserSocketClient(
      { endpoint: "ws://127.0.0.1:8000/v1/browser", token: "pairing-token" },
      vi.fn(() => socket),
      makeExecutor(),
      onStatus,
    );

    client.connect();
    socket.open();
    expect(client.getStatus()).toBe("connecting");

    socket.receive({ type: "browser.authenticated", protocol_version: 1 });
    expect(client.getStatus()).toBe("connected");
    expect(onStatus).toHaveBeenLastCalledWith("connected");
  });

  it("stops retrying when the local service rejects an expired pairing code", async () => {
    const socket = new FakeSocket();
    const onStatus = vi.fn();
    const scheduleReconnect = vi.fn();
    const client = new BrowserSocketClient(
      { endpoint: "ws://127.0.0.1:8000/v1/browser", token: "expired-code" },
      vi.fn(() => socket),
      makeExecutor(),
      onStatus,
      undefined,
      scheduleReconnect,
    );

    client.connect();
    socket.open();
    socket.closeFromServer({ code: 1008, reason: "Authentication failed" });
    await Promise.resolve();

    expect(client.getStatus()).toBe("error");
    expect(onStatus).toHaveBeenLastCalledWith("error");
    expect(scheduleReconnect).not.toHaveBeenCalled();
  });

  it("authenticates with the locally stored token after connecting", () => {
    const socket = new FakeSocket();
    const client = new BrowserSocketClient(
      { endpoint: "ws://127.0.0.1:8000/v1/browser", token: "pairing-token" },
      vi.fn(() => socket),
      makeExecutor(),
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

  it("reconnects with the server-issued persistent token", async () => {
    const firstSocket = new FakeSocket();
    const secondSocket = new FakeSocket();
    const sockets = [firstSocket, secondSocket];
    const scheduleReconnect = vi.fn((callback: () => void) => callback());
    const client = new BrowserSocketClient(
      { endpoint: "ws://127.0.0.1:8000/v1/browser", token: "one-time-code" },
      vi.fn(() => sockets.shift()!),
      makeExecutor(),
      undefined,
      vi.fn().mockResolvedValue(undefined),
      scheduleReconnect,
    );
    client.connect();
    firstSocket.open();
    firstSocket.receive({
      type: "browser.paired",
      protocol_version: 1,
      token: "persistent-local-token",
    });
    await vi.waitFor(() => expect(client.getStatus()).toBe("connected"));

    firstSocket.onclose?.();
    await vi.waitFor(() => expect(secondSocket.onopen).not.toBeNull());
    secondSocket.open();

    expect(JSON.parse(secondSocket.send.mock.calls[0]![0])).toEqual({
      type: "browser.authenticate",
      protocol_version: 1,
      token: "persistent-local-token",
    });
  });

  it("returns a generic protocol error without echoing hostile input", async () => {
    const socket = new FakeSocket();
    const executor = makeExecutor();
    const client = new BrowserSocketClient(
      { endpoint: "ws://127.0.0.1:8000/v1/browser", token: "pairing-token" },
      vi.fn(() => socket),
      executor,
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
    "closes managed tabs but keeps approved host access when a research session is %s",
    async (state) => {
      const socket = new FakeSocket();
      const executor = makeExecutor();
      const client = new BrowserSocketClient(
        { endpoint: "ws://127.0.0.1:8000/v1/browser", token: "pairing-token" },
        vi.fn(() => socket),
        executor,
      );
      client.connect();
      socket.open();
      client.setResearchPermission(true);

      socket.receive({
        type: "research.session",
        protocol_version: 1,
        state,
      });
      await vi.waitFor(() =>
        expect(executor.closeAllManagedTabs).toHaveBeenCalledOnce(),
      );
      socket.receive(validCommand);
      await vi.waitFor(() => expect(executor.execute).toHaveBeenCalledOnce());
    },
  );

  it("keeps approved host access if the local connection closes unexpectedly", async () => {
    const socket = new FakeSocket();
    const executor = makeExecutor();
    const client = new BrowserSocketClient(
      { endpoint: "ws://127.0.0.1:8000/v1/browser", token: "pairing-token" },
      vi.fn(() => socket),
      executor,
    );
    client.connect();
    socket.open();
    client.setResearchPermission(true);

    socket.onclose?.();
    await vi.waitFor(() =>
      expect(executor.closeAllManagedTabs).toHaveBeenCalledOnce(),
    );
  });

  it("reconnects only after an unexpected close has cleaned up the session", async () => {
    const firstSocket = new FakeSocket();
    const secondSocket = new FakeSocket();
    const sockets = [firstSocket, secondSocket];
    const executor = makeExecutor();
    const scheduleReconnect = vi.fn((callback: () => void) => callback());
    const client = new BrowserSocketClient(
      { endpoint: "ws://127.0.0.1:8000/v1/browser", token: "pairing-token" },
      vi.fn(() => sockets.shift()!),
      executor,
      undefined,
      undefined,
      scheduleReconnect,
    );
    client.connect();
    firstSocket.open();
    client.setResearchPermission(true);

    firstSocket.onclose?.();
    await vi.waitFor(() => expect(secondSocket.onopen).not.toBeNull());
    secondSocket.open();
    secondSocket.receive({
      type: "browser.authenticated",
      protocol_version: 1,
    });
    secondSocket.receive(validCommand);

    expect(executor.closeAllManagedTabs).toHaveBeenCalledOnce();
    await vi.waitFor(() => expect(executor.execute).toHaveBeenCalledOnce());
    expect(scheduleReconnect).toHaveBeenCalledWith(expect.any(Function), 1_000);
    expect(secondSocket.send).toHaveBeenCalledWith(
      JSON.stringify({
        type: "browser.authenticate",
        protocol_version: 1,
        token: "pairing-token",
      }),
    );
  });

  it("does not send a late command result through a replacement connection", async () => {
    const firstSocket = new FakeSocket();
    const secondSocket = new FakeSocket();
    const sockets = [firstSocket, secondSocket];
    const executor = makeExecutor();
    const pendingResult = deferred<unknown>();
    executor.execute.mockReturnValueOnce(pendingResult.promise);
    const scheduleReconnect = vi.fn((callback: () => void) => callback());
    const client = new BrowserSocketClient(
      { endpoint: "ws://127.0.0.1:8000/v1/browser", token: "pairing-token" },
      vi.fn(() => sockets.shift()!),
      executor,
      undefined,
      undefined,
      scheduleReconnect,
    );
    client.connect();
    firstSocket.open();
    await client.setResearchPermission(true);
    firstSocket.receive(validCommand);
    await vi.waitFor(() => expect(executor.execute).toHaveBeenCalledOnce());

    firstSocket.onclose?.();
    await vi.waitFor(() => expect(secondSocket.onopen).not.toBeNull());
    secondSocket.open();
    secondSocket.send.mockClear();
    pendingResult.resolve({ waited_ms: 0 });
    await Promise.resolve();
    await Promise.resolve();

    expect(secondSocket.send).not.toHaveBeenCalled();
  });

  it("does not reconnect after an explicit disconnect", async () => {
    const socket = new FakeSocket();
    const scheduleReconnect = vi.fn();
    const client = new BrowserSocketClient(
      { endpoint: "ws://127.0.0.1:8000/v1/browser", token: "pairing-token" },
      vi.fn(() => socket),
      makeExecutor(),
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

  it("keeps commands available after terminal cleanup until access is explicitly reset", async () => {
    const socket = new FakeSocket();
    const executor = makeExecutor();
    const client = new BrowserSocketClient(
      { endpoint: "ws://127.0.0.1:8000/v1/browser", token: "pairing-token" },
      vi.fn(() => socket),
      executor,
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
    await vi.waitFor(() => expect(executor.execute).toHaveBeenCalledOnce());

    client.setResearchPermission(false);
    socket.receive(validCommand);
    await vi.waitFor(() => expect(socket.send).toHaveBeenCalledTimes(3));
    expect(executor.execute).toHaveBeenCalledOnce();
    expect(JSON.parse(socket.send.mock.calls.at(-1)![0])).toMatchObject({
      error: { code: "permission_required" },
    });
  });

  it("closes managed tabs immediately when research permission is revoked", async () => {
    const socket = new FakeSocket();
    const executor = makeExecutor();
    const client = new BrowserSocketClient(
      { endpoint: "ws://127.0.0.1:8000/v1/browser", token: "pairing-token" },
      vi.fn(() => socket),
      executor,
    );
    client.connect();
    socket.open();
    client.setResearchPermission(true);
    executor.closeAllManagedTabs.mockClear();

    client.setResearchPermission(false);

    await vi.waitFor(() =>
      expect(executor.closeAllManagedTabs).toHaveBeenCalledOnce(),
    );
  });
});
