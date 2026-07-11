import { describe, expect, it, vi } from "vitest";

import { ExtensionController } from "../src/extension-controller";
import type { Pairing } from "../src/pairing-store";

function makeController(initialPairing: Pairing | null = null) {
  let pairing = initialPairing;
  const store = {
    load: vi.fn(async () => pairing),
    save: vi.fn(async (value: Pairing) => {
      pairing = value;
    }),
  };
  const permissions = {
    requestForResearch: vi.fn().mockResolvedValue(true),
    revokeAfterResearch: vi.fn().mockResolvedValue(true),
    hasResearchAccess: vi.fn().mockResolvedValue(false),
  };
  const client = {
    connect: vi.fn(),
    disconnect: vi.fn(),
    getStatus: vi.fn().mockReturnValue("connected"),
    setResearchPermission: vi.fn(),
  };
  const clientFactory = vi.fn<
    (
      pairing: Pairing,
      onPairingToken: (token: string) => Promise<void>
    ) => typeof client
  >(() => client);
  return {
    controller: new ExtensionController(store, permissions, clientFactory),
    store,
    permissions,
    client,
    clientFactory,
  };
}

describe("extension background controller", () => {
  it("restores a saved local pairing on service-worker startup", async () => {
    const pairing = {
      endpoint: "ws://127.0.0.1:8000/v1/browser",
      token: "saved-token",
    };
    const { controller, clientFactory, client } = makeController(pairing);

    await controller.restore();

    expect(clientFactory).toHaveBeenCalledWith(pairing, expect.any(Function));
    expect(client.connect).toHaveBeenCalledOnce();
  });

  it("restores the research gate when host access survived a worker restart", async () => {
    const pairing = {
      endpoint: "ws://127.0.0.1:8000/v1/browser",
      token: "saved-token",
    };
    const { controller, permissions, client } = makeController(pairing);
    permissions.hasResearchAccess.mockResolvedValue(true);

    await controller.restore();

    expect(client.connect).toHaveBeenCalledOnce();
    expect(client.setResearchPermission).toHaveBeenCalledWith(true);
  });

  it("pairs, connects, and reports permission state", async () => {
    const { controller, store, client, permissions } = makeController();
    permissions.hasResearchAccess.mockResolvedValue(true);

    await expect(
      controller.handle({
        type: "ui.pair",
        endpoint: "ws://127.0.0.1:8000/v1/browser",
        token: "one-time-code",
      }),
    ).resolves.toEqual({
      paired: true,
      connection: "connected",
      research_permission: true,
    });
    expect(store.save).toHaveBeenCalledWith({
      endpoint: "ws://127.0.0.1:8000/v1/browser",
      token: "one-time-code",
    });
    expect(client.connect).toHaveBeenCalledOnce();
  });

  it("requests broad web access only while paired and connected", async () => {
    const pairing = {
      endpoint: "ws://127.0.0.1:8000/v1/browser",
      token: "saved-token",
    };
    const { controller, permissions, client } = makeController(pairing);

    await controller.handle({ type: "ui.permissions.request" });

    expect(permissions.requestForResearch).toHaveBeenCalledOnce();
    expect(client.setResearchPermission).toHaveBeenCalledWith(true);
  });

  it("rejects a permission request before pairing", async () => {
    const { controller, permissions } = makeController();

    await expect(
      controller.handle({ type: "ui.permissions.request" }),
    ).rejects.toThrow(/paired and connected/i);
    expect(permissions.requestForResearch).not.toHaveBeenCalled();
  });

  it("rejects a permission request while the local connection is down", async () => {
    const pairing = {
      endpoint: "ws://127.0.0.1:8000/v1/browser",
      token: "saved-token",
    };
    const { controller, permissions, client } = makeController(pairing);
    client.getStatus.mockReturnValue("disconnected");

    await expect(
      controller.handle({ type: "ui.permissions.request" }),
    ).rejects.toThrow(/paired and connected/i);
    expect(permissions.requestForResearch).not.toHaveBeenCalled();
  });

  it("persists a server-rotated token after one-time pairing", async () => {
    const { controller, store, clientFactory } = makeController();
    await controller.handle({
      type: "ui.pair",
      endpoint: "ws://127.0.0.1:8000/v1/browser",
      token: "one-time-code",
    });
    const rotate = clientFactory.mock.calls[0]![1];

    await rotate("persistent-token");

    expect(store.save).toHaveBeenLastCalledWith({
      endpoint: "ws://127.0.0.1:8000/v1/browser",
      token: "persistent-token",
    });
  });

  it("waits for startup restoration before reporting UI status", async () => {
    let resolveLoad!: (pairing: Pairing | null) => void;
    const load = vi.fn(
      () =>
        new Promise<Pairing | null>((resolve) => {
          resolveLoad = resolve;
        }),
    );
    const store = { load, save: vi.fn() };
    const permissions = {
      requestForResearch: vi.fn(),
      revokeAfterResearch: vi.fn(),
      hasResearchAccess: vi.fn().mockResolvedValue(false),
    };
    const client = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      getStatus: vi.fn().mockReturnValue("connected" as const),
      setResearchPermission: vi.fn(),
    };
    const controller = new ExtensionController(
      store,
      permissions,
      vi.fn(() => client),
    );
    const restoredPairing = {
      endpoint: "ws://127.0.0.1:8000/v1/browser",
      token: "saved-token",
    };

    const restoring = controller.restore();
    const status = controller.handle({ type: "ui.status" });
    resolveLoad(restoredPairing);

    await restoring;
    await expect(status).resolves.toEqual({
      paired: true,
      connection: "connected",
      research_permission: false,
    });
    expect(load).toHaveBeenCalledOnce();
  });
});
