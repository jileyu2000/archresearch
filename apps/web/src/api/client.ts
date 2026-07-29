export type ResearchMode = 'quick' | 'balanced' | 'deep'
export type PublicRunStatus =
  | 'created'
  | 'planning'
  | 'searching'
  | 'inspecting'
  | 'analyzing'
  | 'verifying'
  | 'gap_check'
  | 'composing'
  | 'completed'
  | 'partial'
  | 'blocked'
  | 'cancelled'
  | 'failed'

export interface PublicConfig {
  turnstileSiteKey: string
  mockVerificationToken?: string
}

export interface StartResearchInput {
  question: string
  mode: ResearchMode
  clientSessionId: string
  turnstileToken: string
}

export interface StartedRun {
  runId: string
  status: 'created'
}

export interface EvidenceFact {
  statement: string
  sourceUrl: string
  quote: string
}

export interface ResearchSection {
  id: string
  title: string
  facts: EvidenceFact[]
}

export interface ResearchRunSnapshot {
  runId: string
  status: PublicRunStatus
  checkpointStage?: string | null
  summary?: string
  sections?: ResearchSection[]
  coverage?: {
    coverageSatisfied: boolean
    enrichmentSatisfied: boolean
    gaps: string[]
  }
}

export class WebApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(code: string, status: number) {
    super(code)
    this.name = 'WebApiError'
    this.status = status
    this.code = code
  }
}

async function readError(response: Response) {
  try {
    const body = await response.json() as { error?: unknown }
    return typeof body.error === 'string' ? body.error : 'request_failed'
  } catch {
    return 'request_failed'
  }
}

export function createWebApiClient(baseUrl = '/api') {
  const request = async <T>(path: string, options?: RequestInit) => {
    const response = await fetch(`${baseUrl}${path}`, {
      ...options,
      cache: 'no-store',
      credentials: 'same-origin',
    })
    if (!response.ok) throw new WebApiError(await readError(response), response.status)
    if (response.status === 204) return undefined as T
    return await response.json() as T
  }

  return {
    getConfig() {
      return request<PublicConfig>('/config')
    },

    startResearch(input: StartResearchInput) {
      return request<StartedRun>('/runs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      })
    },

    getRun(runId: string) {
      return request<ResearchRunSnapshot>(`/runs/${encodeURIComponent(runId)}`)
    },

    cancelRun(runId: string) {
      return request<void>(`/runs/${encodeURIComponent(runId)}`, { method: 'DELETE' })
    },
  }
}

export type WebApiClient = ReturnType<typeof createWebApiClient>
