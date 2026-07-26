import { describe, expect, it, vi } from "vitest";

import {
  ALL_HOST_ORIGINS,
  BrowserPermissionService,
  requestResearchAccess,
} from "../src/permissions";
import { PairingStore } from "../src/pairing-store";

describe("browser permissions", () => {
  it("requests only the declared web origins from the direct UI gesture", async () => {
    const request = vi.fn().mockResolvedValue(true);

    await expect(requestResearchAccess({ request })).resolves.toBe(true);
    expect(request).toHaveBeenCalledWith({ origins: ALL_HOST_ORIGINS });
  });

  it("revokes all web origins only after an explicit user action", async () => {
    const request = vi.fn().mockResolvedValue(true);
    const remove = vi.fn().mockResolvedValue(true);
    const contains = vi.fn().mockResolvedValue(false);
    const service = new BrowserPermissionService({ request, remove, contains });

    await expect(service.revokeAfterResearch()).resolves.toBe(true);
    expect(remove).toHaveBeenCalledWith({ origins: ALL_HOST_ORIGINS });
  });

  it("reports whether temporary web origins are currently granted", async () => {
    const contains = vi.fn().mockResolvedValue(true);
    const service = new BrowserPermissionService({
      request: vi.fn(),
      remove: vi.fn(),
      contains,
    });

    await expect(service.hasResearchAccess()).resolves.toBe(true);
    expect(contains).toHaveBeenCalledWith({ origins: ALL_HOST_ORIGINS });
  });
});

describe("pairing storage", () => {
  it("stores the local endpoint and token in extension-local storage", async () => {
    const values = new Map<string, unknown>();
    const storage = {
      get: vi.fn(async (key: string) => ({ [key]: values.get(key) })),
      set: vi.fn(async (items: Record<string, unknown>) => {
        Object.entries(items).forEach(([key, value]) => values.set(key, value));
      }),
      remove: vi.fn(async (key: string) => {
        values.delete(key);
      }),
    };
    const store = new PairingStore(storage);

    await store.save({
      endpoint: "ws://127.0.0.1:8000/v1/browser",
      token: "one-time-pairing-token",
    });

    await expect(store.load()).resolves.toEqual({
      endpoint: "ws://127.0.0.1:8000/v1/browser",
      token: "one-time-pairing-token",
    });
  });

  it("rejects non-loopback pairing endpoints", async () => {
    const storage = {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
    };
    const store = new PairingStore(storage);

    await expect(
      store.save({ endpoint: "wss://remote.example/v1/browser", token: "token" }),
    ).rejects.toThrow(/loopback websocket/i);
    expect(storage.set).not.toHaveBeenCalled();
  });
});
