export type BrowserBridgeStatus = {
  paired: boolean
  connection: 'disconnected' | 'connecting' | 'connected' | 'error'
  researchPermission: boolean
  visualProtocol?: 2
}

export type BrowserBridgeCommand =
  | { type: 'status' }
  | { type: 'pair'; endpoint: string; token: string }

export type BrowserVisualSource = {
  sourceUrl: string
  title: string
  imageUrl: string | null
  adjacentText: string
}

export type BrowserVisualDirection = {
  id: string
  query: string
}

export type BrowserVisualObservation = BrowserVisualSource & {
  directionId: string
  previewDataUrl: string | null
}

export class BrowserBridgeError extends Error {
  constructor(
    readonly code: 'unavailable' | 'rejected' | 'invalid_response',
    message: string,
  ) {
    super(message)
    this.name = 'BrowserBridgeError'
  }
}

export function resolveBrowserEndpoint(
  configuredEndpoint = import.meta.env.VITE_ARCHRESEARCH_BROWSER_ENDPOINT,
): string {
  return configuredEndpoint || 'ws://127.0.0.1:8000/v1/browser'
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

export function requestXiaohongshuSearch(
  query: string,
  timeoutMs = 12_000,
): Promise<BrowserVisualSource[]> {
  const id = crypto.randomUUID()
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      window.removeEventListener('message', receive)
      reject(new BrowserBridgeError('unavailable', 'ArchResearch extension bridge timed out'))
    }, timeoutMs)

    function receive(event: MessageEvent<unknown>) {
      if (event.source !== window || event.origin !== window.location.origin) return
      const response = readVisualResponse(event.data, id)
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
      action: 'xiaohongshu_search',
      payload: { query: query.trim().slice(0, 500) },
    }, window.location.origin)
  })
}

export function requestPublicBrowserBridgeStatus(
  timeoutMs = 2_000,
): Promise<BrowserBridgeStatus> {
  const id = crypto.randomUUID()
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      window.removeEventListener('message', receive)
      reject(new BrowserBridgeError('unavailable', 'ArchResearch extension bridge timed out'))
    }, timeoutMs)

    function receive(event: MessageEvent<unknown>) {
      if (event.source !== window || event.origin !== window.location.origin) return
      const response = readPublicStatusResponse(event.data, id)
      if (!response) return
      window.clearTimeout(timeout)
      window.removeEventListener('message', receive)
      if (response instanceof BrowserBridgeError) reject(response)
      else resolve(response)
    }

    window.addEventListener('message', receive)
    window.postMessage({
      channel: 'archresearch.board',
      protocol_version: 2,
      id,
      action: 'status',
      payload: {},
    }, window.location.origin)
  })
}

export function subscribePublicBrowserBridgeReady(
  listener: () => void,
): () => void {
  function receive(event: MessageEvent<unknown>) {
    if (event.source !== window || event.origin !== window.location.origin) return
    if (
      !isRecord(event.data)
      || !hasExactKeys(event.data, ['channel', 'protocol_version', 'action'])
      || event.data.channel !== 'archresearch.extension'
      || event.data.protocol_version !== 2
      || event.data.action !== 'ready'
    ) return
    listener()
  }

  window.addEventListener('message', receive)
  return () => window.removeEventListener('message', receive)
}

export function requestXiaohongshuResearch(
  directions: BrowserVisualDirection[],
  timeoutMs = 8 * 60 * 1_000,
): Promise<BrowserVisualObservation[]> {
  const id = crypto.randomUUID()
  const directionIds = new Set(directions.map(({ id: directionId }) => directionId))
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      window.removeEventListener('message', receive)
      reject(new BrowserBridgeError('unavailable', 'ArchResearch extension research timed out'))
    }, timeoutMs)

    function receive(event: MessageEvent<unknown>) {
      if (event.source !== window || event.origin !== window.location.origin) return
      const response = readVisualResearchResponse(event.data, id, directionIds)
      if (!response) return
      window.clearTimeout(timeout)
      window.removeEventListener('message', receive)
      if (response instanceof BrowserBridgeError) reject(response)
      else resolve(response)
    }

    window.addEventListener('message', receive)
    window.postMessage({
      channel: 'archresearch.board',
      protocol_version: 2,
      id,
      action: 'xiaohongshu_research',
      payload: { directions },
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

function readVisualResponse(
  value: unknown,
  id: string,
): BrowserVisualSource[] | BrowserBridgeError | null {
  if (!isRecord(value)) return null
  if (
    value.channel !== 'archresearch.extension'
    || value.protocol_version !== 1
    || value.id !== id
    || typeof value.ok !== 'boolean'
  ) return null
  if (value.ok === false) {
    return new BrowserBridgeError('rejected', 'ArchResearch extension rejected the search')
  }
  if (
    !isRecord(value.result)
    || !Array.isArray(value.result.sources)
    || value.result.sources.length > 8
  ) {
    return new BrowserBridgeError('invalid_response', 'ArchResearch extension returned invalid sources')
  }
  const sources: BrowserVisualSource[] = []
  for (const source of value.result.sources) {
    if (!isRecord(source) || !hasExactKeys(
      source,
      ['source_url', 'title', 'image_url', 'adjacent_text'],
    )) {
      return new BrowserBridgeError('invalid_response', 'ArchResearch extension returned invalid sources')
    }
    if (
      !isXiaohongshuNoteUrl(source.source_url)
      || typeof source.title !== 'string'
      || source.title.length > 240
      || (source.image_url !== null && !isXiaohongshuImageUrl(source.image_url))
      || typeof source.adjacent_text !== 'string'
      || source.adjacent_text.length > 1_000
    ) {
      return new BrowserBridgeError('invalid_response', 'ArchResearch extension returned invalid sources')
    }
    sources.push({
      sourceUrl: source.source_url,
      title: source.title,
      imageUrl: source.image_url,
      adjacentText: source.adjacent_text,
    })
  }
  return sources
}

function readPublicStatusResponse(
  value: unknown,
  id: string,
): BrowserBridgeStatus | BrowserBridgeError | null {
  if (!isPublicResponseEnvelope(value, id)) return null
  if (value.ok === false) {
    return new BrowserBridgeError('rejected', 'ArchResearch extension rejected the command')
  }
  if (
    !isRecord(value.result)
    || !hasExactKeys(value.result, [
      'paired',
      'connection',
      'research_permission',
      'visual_protocol',
    ])
    || value.result.paired !== true
    || value.result.connection !== 'connected'
    || typeof value.result.research_permission !== 'boolean'
    || value.result.visual_protocol !== 2
  ) {
    return new BrowserBridgeError('invalid_response', 'ArchResearch extension returned invalid status')
  }
  return {
    paired: true,
    connection: 'connected',
    researchPermission: value.result.research_permission,
    visualProtocol: 2,
  }
}

function readVisualResearchResponse(
  value: unknown,
  id: string,
  directionIds: ReadonlySet<string>,
): BrowserVisualObservation[] | BrowserBridgeError | null {
  if (!isPublicResponseEnvelope(value, id)) return null
  if (value.ok === false) {
    return new BrowserBridgeError('rejected', 'ArchResearch extension rejected the research')
  }
  if (
    !isRecord(value.result)
    || !hasExactKeys(value.result, ['sources', 'budget'])
    || !Array.isArray(value.result.sources)
    || value.result.sources.length > 48
    || !isVisualBudget(value.result.budget)
  ) {
    return new BrowserBridgeError('invalid_response', 'ArchResearch extension returned invalid sources')
  }
  const sources: BrowserVisualObservation[] = []
  let previewBytes = 0
  for (const source of value.result.sources) {
    if (
      !isRecord(source)
      || !hasExactKeys(source, [
        'direction_id',
        'source_url',
        'title',
        'image_url',
        'preview_data_url',
        'adjacent_text',
      ])
      || typeof source.direction_id !== 'string'
      || !/^[A-Za-z0-9_-]{1,80}$/.test(source.direction_id)
      || !directionIds.has(source.direction_id)
      || !isXiaohongshuNoteUrl(source.source_url)
      || typeof source.title !== 'string'
      || source.title.length > 240
      || !isXiaohongshuImageUrl(source.image_url)
      || !isPreviewDataUrl(source.preview_data_url)
      || typeof source.adjacent_text !== 'string'
      || source.adjacent_text.length > 1_000
    ) {
      return new BrowserBridgeError('invalid_response', 'ArchResearch extension returned invalid sources')
    }
    previewBytes += source.preview_data_url?.length ?? 0
    if (previewBytes > 48 * 1024 * 1024) {
      return new BrowserBridgeError('invalid_response', 'ArchResearch extension returned invalid sources')
    }
    sources.push({
      directionId: source.direction_id,
      sourceUrl: source.source_url,
      title: source.title,
      imageUrl: source.image_url,
      previewDataUrl: source.preview_data_url,
      adjacentText: source.adjacent_text,
    })
  }
  return sources
}

function isPublicResponseEnvelope(
  value: unknown,
  id: string,
): value is Record<string, unknown> & { ok: boolean } {
  return isRecord(value)
    && value.channel === 'archresearch.extension'
    && value.protocol_version === 2
    && value.id === id
    && typeof value.ok === 'boolean'
}

function isVisualBudget(value: unknown) {
  return isRecord(value)
    && hasExactKeys(value, ['image_count', 'preview_bytes', 'exhausted'])
    && Number.isInteger(value.image_count)
    && Number(value.image_count) >= 0
    && Number(value.image_count) <= 48
    && Number.isInteger(value.preview_bytes)
    && Number(value.preview_bytes) >= 0
    && Number(value.preview_bytes) <= 48 * 1024 * 1024
    && typeof value.exhausted === 'boolean'
}

function isPreviewDataUrl(value: unknown): value is string | null {
  return value === null
    || (typeof value === 'string'
      && value.startsWith('data:image/png;base64,')
      && value.length <= 3_000_000)
}

function isXiaohongshuNoteUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2_048) return false
  try {
    const url = new URL(value)
    const host = url.hostname.toLowerCase().replace(/\.$/u, '')
    return (
      url.protocol === 'https:'
      && !url.username
      && !url.password
      && (host === 'xiaohongshu.com' || host.endsWith('.xiaohongshu.com'))
      && ['/explore/', '/discovery/item/', '/search_result/'].some(
        (prefix) => url.pathname.startsWith(prefix),
      )
    )
  } catch {
    return false
  }
}

function isXiaohongshuImageUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2_048) return false
  try {
    const url = new URL(value)
    const host = url.hostname.toLowerCase().replace(/\.$/u, '')
    return (
      url.protocol === 'https:'
      && !url.username
      && !url.password
      && (host === 'xhscdn.com' || host.endsWith('.xhscdn.com'))
    )
  } catch {
    return false
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]) {
  return (
    Object.keys(value).length === keys.length
    && keys.every((key) => Object.prototype.hasOwnProperty.call(value, key))
  )
}
