const PAIRING_KEY = "archresearch.pairing";

export type Pairing = {
  endpoint: string;
  token: string;
};

type LocalStoragePort = {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(key: string): Promise<void>;
};

export class PairingStore {
  constructor(private readonly storage: LocalStoragePort) {}

  async save(pairing: Pairing): Promise<void> {
    const validated = validatePairing(pairing);
    await this.storage.set({ [PAIRING_KEY]: validated });
  }

  async load(): Promise<Pairing | null> {
    const stored = await this.storage.get(PAIRING_KEY);
    const value = stored[PAIRING_KEY];
    if (value === undefined) {
      return null;
    }
    try {
      return validatePairing(value);
    } catch {
      return null;
    }
  }

  clear(): Promise<void> {
    return this.storage.remove(PAIRING_KEY);
  }
}

function validatePairing(value: unknown): Pairing {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Pairing must contain a loopback WebSocket endpoint and token");
  }
  const candidate = value as Partial<Pairing>;
  if (
    typeof candidate.endpoint !== "string" ||
    typeof candidate.token !== "string" ||
    candidate.token.trim() === "" ||
    candidate.token.length > 512
  ) {
    throw new Error("Pairing must contain a loopback WebSocket endpoint and token");
  }

  let endpoint: URL;
  try {
    endpoint = new URL(candidate.endpoint);
  } catch {
    throw new Error("Pairing endpoint must be a loopback WebSocket URL");
  }
  const host = endpoint.hostname.replace(/^\[|\]$/gu, "").toLowerCase();
  if (
    endpoint.protocol !== "ws:" ||
    !["127.0.0.1", "localhost", "::1"].includes(host) ||
    endpoint.username !== "" ||
    endpoint.password !== ""
  ) {
    throw new Error("Pairing endpoint must be a loopback WebSocket URL");
  }

  return { endpoint: endpoint.toString(), token: candidate.token };
}
