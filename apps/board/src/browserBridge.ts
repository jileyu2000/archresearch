export type BrowserBridgeStatus = {
  paired: boolean
  connection: 'disconnected' | 'connecting' | 'connected' | 'error'
  researchPermission: boolean
}

export type BrowserBridgeCommand =
  | { type: 'status' }
  | { type: 'permissions.request' }
  | { type: 'pair'; endpoint: string; token: string }

export class BrowserBridgeError extends Error {
  constructor(
    readonly code: 'unavailable' | 'rejected' | 'invalid_response',
    message: string,
  ) {
    super(message)
    this.name = 'BrowserBridgeError'
  }
}

export function requestBrowserBridge(
  command: BrowserBridgeCommand,
  timeoutMs = 2_000,
): Promise<BrowserBridgeStatus> {
  const id = crypto.randomUUID()
  const action = command.type
  const payload = command.type === 'pair'
    ? { endpoint: command.endpoint, token: command.token }
    : {}

  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      window.removeEventListener('message', receive)
      reject(new BrowserBridgeError('unavailable', 'ArchResearch extension bridge timed out'))
    }, timeoutMs)

    function receive(event: MessageEvent<unknown>) {
      if (event.source !== window || event.origin !== window.location.origin) return
      const response = readResponse(event.data, id)
      if (!response) return
      window.clearTimeout(timeout)
      window.removeEventListener('message', receive)
      if (response instanceof BrowserBridgeError) reject(response)
      else resolve(response)
    }

    window.addEventListener('message', receive)
    window.postMessage({
      channel: 'archresearch.board',
      protocol_version: 1,
      id,
      action,
      payload,
    }, window.location.origin)
  })
}

function readResponse(
  value: unknown,
  id: string,
): BrowserBridgeStatus | BrowserBridgeError | null {
  if (!isRecord(value)) return null
  if (
    value.channel !== 'archresearch.extension'
    || value.protocol_version !== 1
    || value.id !== id
    || typeof value.ok !== 'boolean'
  ) return null
  if (value.ok === false) {
    return new BrowserBridgeError('rejected', 'ArchResearch extension rejected the command')
  }
  if (!isRecord(value.result)) {
    return new BrowserBridgeError('invalid_response', 'ArchResearch extension returned invalid status')
  }
  const result = value.result
  if (
    typeof result.paired !== 'boolean'
    || !isConnection(result.connection)
    || typeof result.research_permission !== 'boolean'
  ) {
    return new BrowserBridgeError('invalid_response', 'ArchResearch extension returned invalid status')
  }
  return {
    paired: result.paired,
    connection: result.connection,
    researchPermission: result.research_permission,
  }
}

function isConnection(value: unknown): value is BrowserBridgeStatus['connection'] {
  return value === 'disconnected'
    || value === 'connecting'
    || value === 'connected'
    || value === 'error'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
