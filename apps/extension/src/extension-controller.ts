import type { BrowserPermissionService } from "./permissions";
import type { Pairing, PairingStore } from "./pairing-store";
import type { ConnectionStatus } from "./browser-socket-client";
import { parseUiCommand, type UiCommand } from "./ui-protocol";

type SocketClient = {
  connect(): void;
  disconnect(): void;
  getStatus(): ConnectionStatus;
  setResearchPermission(granted: boolean): Promise<void> | void;
};

type SocketClientFactory = (
  pairing: Pairing,
  onPairingToken: (token: string) => Promise<void>,
) => SocketClient;

export class ExtensionController {
  private pairing: Pairing | null = null;
  private client: SocketClient | null = null;
  private restoration: Promise<void> | null = null;

  constructor(
    private readonly store: Pick<PairingStore, "load" | "save">,
    private readonly permissions: Pick<
      BrowserPermissionService,
      "revokeAfterResearch" | "hasResearchAccess"
    >,
    private readonly clientFactory: SocketClientFactory,
    private readonly startup: Promise<void> = Promise.resolve(),
  ) {}

  restore(): Promise<void> {
    this.restoration ??= this.restoreSavedPairing();
    return this.restoration;
  }

  private async restoreSavedPairing(): Promise<void> {
    await this.startup;
    const pairing = await this.store.load();
    if (pairing) {
      this.connect(pairing, await this.permissions.hasResearchAccess());
    }
  }

  async handle(value: unknown): Promise<Record<string, unknown>> {
    await this.restore();
    const command = parseUiCommand(value);
    switch (command.type) {
      case "ui.status":
        return this.status();
      case "ui.pair":
        return this.pair(command);
      case "ui.disconnect":
        await this.client?.setResearchPermission(false);
        this.client?.disconnect();
        return this.status();
      case "ui.permissions.request": {
        if (
          this.pairing === null ||
          this.client === null ||
          this.client.getStatus() !== "connected"
        ) {
          throw new Error("Research permission requires a paired and connected client");
        }
        const granted = await this.permissions.hasResearchAccess();
        await this.client.setResearchPermission(granted);
        return this.status();
      }
      case "ui.permissions.revoke":
        await this.client?.setResearchPermission(false);
        await this.permissions.revokeAfterResearch();
        return this.status();
    }
  }

  private async pair(
    command: Extract<UiCommand, { type: "ui.pair" }>,
  ): Promise<Record<string, unknown>> {
    const pairing = { endpoint: command.endpoint, token: command.token };
    await this.store.save(pairing);
    if (this.client) {
      await this.client.setResearchPermission(false);
      this.client.disconnect();
    }
    this.connect(pairing, await this.permissions.hasResearchAccess());
    return this.status();
  }

  private connect(pairing: Pairing, researchPermissionGranted: boolean): void {
    this.pairing = pairing;
    this.client = this.clientFactory(pairing, async (token) => {
      const rotated = { ...pairing, token };
      await this.store.save(rotated);
      this.pairing = rotated;
    });
    this.client.connect();
    void this.client.setResearchPermission(researchPermissionGranted);
  }

  private async status(): Promise<Record<string, unknown>> {
    return {
      paired: this.pairing !== null,
      connection: this.client?.getStatus() ?? "disconnected",
      research_permission: await this.permissions.hasResearchAccess(),
    };
  }
}
