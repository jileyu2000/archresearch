import type { Pairing } from "./pairing-store";
import { parseBrowserCommand } from "./protocol";

export type ConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

export type SocketLike = {
  readonly OPEN: number;
  readyState: number;
  onopen: (() => void) | null;
  onmessage: ((event: { data: string }) => void) | null;
  onclose: ((event?: { code?: number; reason?: string }) => void) | null;
  onerror: (() => void) | null;
  send(data: string): void;
  close(): void;
};

export type SocketFactory = (endpoint: string) => SocketLike;
type CommandExecutor = {
  execute(command: ReturnType<typeof parseBrowserCommand>): Promise<unknown>;
  releaseTab(tabId: number): void;
  closeAllManagedTabs(): Promise<void>;
};
type StatusListener = (status: ConnectionStatus) => void;
type PairingTokenListener = (token: string) => Promise<void> | void;
type ReconnectScheduler = (
  callback: () => void,
  milliseconds: number,
) => void;

const TERMINAL_STATES = [
  "completed",
  "partial",
  "blocked",
  "cancelled",
  "failed",
] as const;
const HEARTBEAT_INTERVAL_MS = 20_000;

export class BrowserSocketClient {
  private socket: SocketLike | null = null;
  private researchPermissionGranted = false;
  private status: ConnectionStatus = "disconnected";
  private connectionGeneration = 0;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly pairing: Pairing,
    private readonly socketFactory: SocketFactory,
    private readonly executor: CommandExecutor,
    private readonly onStatus: StatusListener = () => undefined,
    private readonly onPairingToken: PairingTokenListener = () => undefined,
    private readonly scheduleReconnect: ReconnectScheduler = defaultReconnectScheduler,
  ) {}

  connect(): void {
    this.disconnect(false);
    const generation = ++this.connectionGeneration;
    this.setStatus("connecting");
    const socket = this.socketFactory(this.pairing.endpoint);
    this.socket = socket;
    socket.onopen = () => {
      this.send({
        type: "browser.authenticate",
        protocol_version: 1,
        token: this.pairing.token,
      });
    };
    socket.onmessage = (event) => {
      void this.handleMessage(event.data, generation, socket);
    };
    socket.onerror = () => this.setStatus("error");
    socket.onclose = (event) => {
      this.stopHeartbeat();
      const authenticationRejected = event?.code === 1008;
      this.socket = null;
      this.setStatus(authenticationRejected ? "error" : "disconnected");
      void this.closeManagedTabs()
        .catch(() => undefined)
        .then(() => {
          if (this.connectionGeneration !== generation) {
            return;
          }
          if (authenticationRejected) return;
          this.scheduleReconnect(() => {
            if (
              this.connectionGeneration === generation &&
              this.socket === null
            ) {
              this.connect();
            }
          }, 1_000);
        });
    };
  }

  disconnect(clearResearchPermission = true): void {
    this.connectionGeneration += 1;
    this.stopHeartbeat();
    const hadSocket = this.socket !== null;
    if (this.socket) {
      const socket = this.socket;
      this.socket = null;
      socket.onclose = null;
      socket.close();
    }
    this.setStatus("disconnected");
    if (clearResearchPermission) {
      this.researchPermissionGranted = false;
    }
    if (hadSocket || clearResearchPermission) {
      void this.executor.closeAllManagedTabs();
    }
  }

  getStatus(): ConnectionStatus {
    return this.status;
  }

  async setResearchPermission(granted: boolean): Promise<void> {
    this.researchPermissionGranted = granted;
    if (!granted) {
      await this.executor.closeAllManagedTabs();
    }
  }

  private async handleMessage(
    rawMessage: string,
    generation: number,
    socket: SocketLike,
  ): Promise<void> {
    if (!this.isCurrentConnection(generation, socket)) return;
    let message: unknown;
    try {
      message = JSON.parse(rawMessage);
    } catch {
      this.sendProtocolError("unknown", generation, socket);
      return;
    }

    if (isTerminalSessionMessage(message)) {
      await this.closeManagedTabs();
      return;
    }
    if (isPairedMessage(message)) {
      await this.onPairingToken(message.token);
      if (!this.isCurrentConnection(generation, socket)) return;
      this.pairing.token = message.token;
      this.setStatus("connected");
      this.startHeartbeat();
      return;
    }
    if (isAuthenticationAcknowledgement(message)) {
      this.setStatus("connected");
      this.startHeartbeat();
      return;
    }
    if (isHeartbeatAcknowledgement(message)) {
      return;
    }

    let command: ReturnType<typeof parseBrowserCommand>;
    try {
      command = parseBrowserCommand(message);
    } catch {
      this.sendProtocolError(readSafeCommandId(message), generation, socket);
      return;
    }

    if (!this.researchPermissionGranted) {
      this.sendToConnection(generation, socket, {
        type: "browser.result",
        protocol_version: 1,
        id: command.id,
        ok: false,
        error: {
          code: "permission_required",
          message: "Research permission is required",
        },
      });
      return;
    }

    try {
      const result = await this.executor.execute(command);
      this.sendToConnection(generation, socket, {
        type: "browser.result",
        protocol_version: 1,
        id: command.id,
        ok: true,
        result,
      });
    } catch {
      this.sendToConnection(generation, socket, {
        type: "browser.result",
        protocol_version: 1,
        id: command.id,
        ok: false,
        error: { code: "execution_failed", message: "Command could not run" },
      });
    }
  }

  private sendProtocolError(
    id: string,
    generation: number,
    socket: SocketLike,
  ): void {
    this.sendToConnection(generation, socket, {
      type: "browser.result",
      protocol_version: 1,
      id,
      ok: false,
      error: { code: "invalid_command", message: "Command was rejected" },
    });
  }

  private send(message: unknown): void {
    const socket = this.socket;
    if (socket && socket.readyState === socket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  }

  private sendToConnection(
    generation: number,
    socket: SocketLike,
    message: unknown,
  ): void {
    if (
      this.isCurrentConnection(generation, socket) &&
      socket.readyState === socket.OPEN
    ) {
      socket.send(JSON.stringify(message));
    }
  }

  private isCurrentConnection(
    generation: number,
    socket: SocketLike,
  ): boolean {
    return this.connectionGeneration === generation && this.socket === socket;
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.send({ type: "browser.heartbeat", protocol_version: 1 });
    }, HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private async closeManagedTabs(): Promise<void> {
    await this.executor.closeAllManagedTabs();
  }

  private setStatus(status: ConnectionStatus): void {
    this.status = status;
    this.onStatus(status);
  }
}

function defaultReconnectScheduler(
  callback: () => void,
  milliseconds: number,
): void {
  setTimeout(callback, milliseconds);
}

function isPairedMessage(
  message: unknown,
): message is { type: "browser.paired"; protocol_version: 1; token: string } {
  if (message === null || typeof message !== "object" || Array.isArray(message)) {
    return false;
  }
  const candidate = message as Record<string, unknown>;
  return (
    Object.keys(candidate).length === 3 &&
    candidate.type === "browser.paired" &&
    candidate.protocol_version === 1 &&
    typeof candidate.token === "string" &&
    candidate.token.trim() !== "" &&
    candidate.token.length <= 512
  );
}

function isAuthenticationAcknowledgement(message: unknown): boolean {
  if (message === null || typeof message !== "object" || Array.isArray(message)) {
    return false;
  }
  const candidate = message as Record<string, unknown>;
  return (
    Object.keys(candidate).length === 2 &&
    candidate.type === "browser.authenticated" &&
    candidate.protocol_version === 1
  );
}

function isHeartbeatAcknowledgement(message: unknown): boolean {
  if (message === null || typeof message !== "object" || Array.isArray(message)) {
    return false;
  }
  const candidate = message as Record<string, unknown>;
  return (
    Object.keys(candidate).length === 2 &&
    candidate.type === "browser.heartbeat_ack" &&
    candidate.protocol_version === 1
  );
}

function readSafeCommandId(message: unknown): string {
  if (
    message !== null &&
    typeof message === "object" &&
    "id" in message &&
    typeof message.id === "string" &&
    message.id.length >= 1 &&
    message.id.length <= 128
  ) {
    return message.id;
  }
  return "unknown";
}

function isTerminalSessionMessage(
  message: unknown,
): message is { type: "research.session"; protocol_version: 1; state: string } {
  if (message === null || typeof message !== "object" || Array.isArray(message)) {
    return false;
  }
  const candidate = message as Record<string, unknown>;
  return (
    Object.keys(candidate).length === 3 &&
    candidate.type === "research.session" &&
    candidate.protocol_version === 1 &&
    typeof candidate.state === "string" &&
    TERMINAL_STATES.includes(candidate.state as (typeof TERMINAL_STATES)[number])
  );
}
