import type { CostGate } from './cost-gate'
import type { BrowserVisualSource } from './workflow'

type ResearchMode = 'quick' | 'balanced' | 'deep'
type ResearchGoal = 'precedent_research' | 'visual_reference_search'
type ResearchSource = 'public_web' | 'xiaohongshu'

interface ResearchSubquestion {
  id: string
  question: string
  rationale: string
}

interface BriefFile {
  filename: string
  dataUrl: string
}

export interface BrowserVisualUploadSource {
  directionId: string
  sourceUrl: string
  title: string
  imageUrl: string
  previewDataUrl: string | null
  adjacentText: string
}

interface StartResearchPayload {
  workspaceId: string
  question: string
  goal: ResearchGoal
  mode: ResearchMode
  referenceUrl?: string
  researchSources: ResearchSource[]
  subquestions?: ResearchSubquestion[]
  briefFile?: BriefFile
  clientSessionId: string
  turnstileToken: string
}

interface TurnstileVerifier {
  verify(input: {
    token: string
    remoteIp: string | null
    action: 'start_research'
  }): Promise<boolean>
}

interface QuotaLimiter {
  consume(input: {
    clientSessionId: string
    remoteIp: string | null
    resource: 'start_research'
  }): Promise<{ allowed: boolean }>
}

interface WorkflowBinding {
  create(input: {
    id: string
    params: Omit<StartResearchPayload, 'turnstileToken'> & { runId: string }
  }): Promise<void>
}

interface StartResearchDependencies {
  turnstile: TurnstileVerifier
  quota: QuotaLimiter
  costGate: Pick<CostGate, 'reserve'>
  workflows: WorkflowBinding
  issueVisualUploadToken?: (input: {
    runId: string
    clientSessionId: string
  }) => Promise<string>
  createRunId?: () => string
}

interface VisualSourcesDependencies {
  authorize(input: {
    runId: string
    clientSessionId: string
    uploadToken: string
  }): Promise<boolean>
  storeSources(input: {
    runId: string
    sources: BrowserVisualUploadSource[]
  }): Promise<BrowserVisualSource[]>
  discardSources(input: {
    runId: string
    sources: BrowserVisualSource[]
  }): Promise<void>
  sendEvent(input: {
    runId: string
    type: 'xiaohongshu_visual_sources'
    payload: { sources: BrowserVisualSource[] }
  }): Promise<void>
}

interface PublicEnvironment {
  TURNSTILE_SITE_KEY: string
  TURNSTILE_SECRET_KEY?: string
  PROVIDER_API_KEY?: string
}

export const estimatedCostByMode: Record<ResearchMode, number> = {
  quick: 0.2,
  balanced: 0.6,
  deep: 1.2,
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}

function parsePayload(value: unknown): StartResearchPayload | null {
  if (typeof value !== 'object' || value === null) return null
  const candidate = value as Record<string, unknown>
  const workspaceId = candidate.workspaceId
  const question = typeof candidate.question === 'string' ? candidate.question.trim() : ''
  const goal = candidate.goal
  const mode = candidate.mode
  const referenceUrl = candidate.referenceUrl
  const researchSources = candidate.researchSources
  const subquestions = candidate.subquestions
  const briefFile = candidate.briefFile
  const clientSessionId = candidate.clientSessionId
  const turnstileToken = candidate.turnstileToken
  if (
    typeof workspaceId !== 'string'
    || !/^workspace-[A-Za-z0-9_-]{1,120}$/.test(workspaceId)
    || (goal !== 'precedent_research' && goal !== 'visual_reference_search')
    || question.length < 8
    || question.length > 1200
    || (mode !== 'quick' && mode !== 'balanced' && mode !== 'deep')
    || typeof clientSessionId !== 'string'
    || !/^[A-Za-z0-9_-]{12,128}$/.test(clientSessionId)
    || typeof turnstileToken !== 'string'
    || turnstileToken.length < 1
    || turnstileToken.length > 2048
    || Object.prototype.hasOwnProperty.call(candidate, 'browserVisualSources')
  ) {
    return null
  }
  let normalizedReferenceUrl: string | undefined
  if (referenceUrl !== undefined) {
    if (typeof referenceUrl !== 'string' || referenceUrl.length > 2048) return null
    try {
      const url = new URL(referenceUrl)
      if (url.protocol !== 'https:' || url.username || url.password) return null
      normalizedReferenceUrl = url.toString()
    } catch {
      return null
    }
  }
  if (
    !Array.isArray(researchSources)
    || researchSources.some((source) => source !== 'public_web' && source !== 'xiaohongshu')
    || researchSources.length > 1
  ) {
    return null
  }
  if (
    (goal === 'visual_reference_search'
      && researchSources[0] !== 'xiaohongshu')
    || (goal !== 'visual_reference_search'
      && researchSources.includes('xiaohongshu'))
  ) return null
  let normalizedSubquestions: ResearchSubquestion[] | undefined
  if (subquestions !== undefined) {
    if (!Array.isArray(subquestions) || subquestions.length < 1 || subquestions.length > 6) {
      return null
    }
    normalizedSubquestions = []
    for (const value of subquestions) {
      if (typeof value !== 'object' || value === null) return null
      const item = value as Record<string, unknown>
      if (
        typeof item.id !== 'string'
        || !/^[A-Za-z0-9_-]{1,80}$/.test(item.id)
        || typeof item.question !== 'string'
        || item.question.trim().length < 2
        || item.question.length > 400
        || typeof item.rationale !== 'string'
        || item.rationale.length > 600
      ) {
        return null
      }
      normalizedSubquestions.push({
        id: item.id,
        question: item.question.trim(),
        rationale: item.rationale.trim(),
      })
    }
  }
  let normalizedBriefFile: BriefFile | undefined
  if (briefFile !== undefined) {
    if (typeof briefFile !== 'object' || briefFile === null) return null
    const file = briefFile as Record<string, unknown>
    if (
      typeof file.filename !== 'string'
      || !file.filename.toLowerCase().endsWith('.pdf')
      || file.filename.length > 240
      || typeof file.dataUrl !== 'string'
      || !file.dataUrl.startsWith('data:application/pdf;base64,JVBER')
      || file.dataUrl.length > 5_700_000
    ) {
      return null
    }
    normalizedBriefFile = {
      filename: file.filename,
      dataUrl: file.dataUrl,
    }
  }
  return {
    workspaceId,
    question,
    goal,
    mode,
    referenceUrl: normalizedReferenceUrl,
    researchSources,
    subquestions: normalizedSubquestions,
    briefFile: normalizedBriefFile,
    clientSessionId,
    turnstileToken,
  }
}

export function createStartResearchHandler(dependencies: StartResearchDependencies) {
  return async (request: Request) => {
    if (request.method !== 'POST') {
      return json({ error: 'method_not_allowed' }, 405)
    }

    let payload: StartResearchPayload | null
    try {
      payload = parsePayload(await request.json())
    } catch {
      return json({ error: 'invalid_request' }, 400)
    }
    if (!payload) return json({ error: 'invalid_request' }, 400)

    const remoteIp = request.headers.get('cf-connecting-ip')
    const human = await dependencies.turnstile.verify({
      token: payload.turnstileToken,
      remoteIp,
      action: 'start_research',
    })
    if (!human) return json({ error: 'human_verification_failed' }, 403)

    const quota = await dependencies.quota.consume({
      clientSessionId: payload.clientSessionId,
      remoteIp,
      resource: 'start_research',
    })
    if (!quota.allowed) return json({ error: 'request_limit_reached' }, 429)

    const runId = dependencies.createRunId?.() ?? crypto.randomUUID()
    const visualUploadToken = payload.goal === 'visual_reference_search'
      ? await dependencies.issueVisualUploadToken?.({
          runId,
          clientSessionId: payload.clientSessionId,
        })
      : undefined
    if (payload.goal === 'visual_reference_search' && !visualUploadToken) {
      return json({ error: 'visual_upload_unavailable' }, 503)
    }

    const reservation = await dependencies.costGate.reserve({
      runId,
      reservedCostUsd: estimatedCostByMode[payload.mode],
    })
    if (!reservation.accepted) {
      return json({ error: reservation.reason }, 429)
    }

    await dependencies.workflows.create({
      id: runId,
      params: {
        runId,
        workspaceId: payload.workspaceId,
        question: payload.question,
        goal: payload.goal,
        mode: payload.mode,
        referenceUrl: payload.referenceUrl,
        researchSources: payload.researchSources,
        subquestions: payload.subquestions,
        ...(payload.briefFile ? { briefFile: payload.briefFile } : {}),
        clientSessionId: payload.clientSessionId,
      },
    })
    return json({
      runId,
      status: 'created',
      ...(visualUploadToken ? { visualUploadToken } : {}),
    }, 202)
  }
}

function normalizeBrowserVisualSources(
  value: unknown,
): BrowserVisualUploadSource[] | undefined {
  if (value === undefined) return undefined
  if (!Array.isArray(value) || value.length < 1 || value.length > 48) return undefined
  const sources: BrowserVisualUploadSource[] = []
  let previewBytes = 0
  for (const item of value) {
    if (typeof item !== 'object' || item === null) return undefined
    const source = item as Record<string, unknown>
    if (
      Object.keys(source).length !== 6
      || typeof source.directionId !== 'string'
      || !/^[A-Za-z0-9_-]{1,80}$/.test(source.directionId)
      || typeof source.sourceUrl !== 'string'
      || !isXiaohongshuNoteUrl(source.sourceUrl)
      || typeof source.title !== 'string'
      || source.title.trim().length < 1
      || source.title.length > 240
      || typeof source.imageUrl !== 'string'
      || !isXiaohongshuImageUrl(source.imageUrl)
      || !isPreviewDataUrl(source.previewDataUrl)
      || typeof source.adjacentText !== 'string'
      || source.adjacentText.trim().length < 1
      || source.adjacentText.length > 1_000
    ) return undefined
    previewBytes += typeof source.previewDataUrl === 'string'
      ? source.previewDataUrl.length
      : 0
    if (previewBytes > 48 * 1024 * 1024) return undefined
    sources.push({
      directionId: source.directionId,
      sourceUrl: source.sourceUrl,
      title: source.title.trim(),
      imageUrl: source.imageUrl,
      previewDataUrl: source.previewDataUrl as string | null,
      adjacentText: source.adjacentText.trim(),
    })
  }
  return sources
}

export function createVisualSourcesHandler(dependencies: VisualSourcesDependencies) {
  return async (runId: string, request: Request) => {
    if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
    let value: unknown
    try {
      value = await request.json()
    } catch {
      return json({ error: 'invalid_request' }, 400)
    }
    if (typeof value !== 'object' || value === null) {
      return json({ error: 'invalid_request' }, 400)
    }
    const body = value as Record<string, unknown>
    if (
      Object.keys(body).length !== 3
      || typeof body.clientSessionId !== 'string'
      || !/^[A-Za-z0-9_-]{12,128}$/.test(body.clientSessionId)
      || typeof body.uploadToken !== 'string'
      || body.uploadToken.length < 16
      || body.uploadToken.length > 256
      || !Array.isArray(body.sources)
      || body.sources.length > 48
    ) {
      return json({ error: 'invalid_request' }, 400)
    }
    const sources = body.sources.length === 0
      ? []
      : normalizeBrowserVisualSources(body.sources)
    if (!sources) return json({ error: 'invalid_request' }, 400)
    const authorized = await dependencies.authorize({
      runId,
      clientSessionId: body.clientSessionId,
      uploadToken: body.uploadToken,
    })
    if (!authorized) return json({ error: 'visual_upload_rejected' }, 403)
    const stored = await dependencies.storeSources({ runId, sources })
    try {
      await dependencies.sendEvent({
        runId,
        type: 'xiaohongshu_visual_sources',
        payload: { sources: stored },
      })
    } catch (error) {
      await dependencies.discardSources({ runId, sources: stored })
      throw error
    }
    return new Response(null, { status: 204 })
  }
}

function isPreviewDataUrl(value: unknown): value is string | null {
  return value === null
    || (typeof value === 'string'
      && value.startsWith('data:image/png;base64,')
      && value.length <= 3_000_000)
}

function isXiaohongshuNoteUrl(value: string) {
  return isBoundedHttpsUrl(value, (url) => {
    const host = url.hostname.toLowerCase().replace(/\.$/u, '')
    return (
      (host === 'xiaohongshu.com' || host.endsWith('.xiaohongshu.com'))
      && ['/explore/', '/discovery/item/', '/search_result/'].some(
        (prefix) => url.pathname.startsWith(prefix),
      )
    )
  })
}

function isXiaohongshuImageUrl(value: string) {
  return isBoundedHttpsUrl(value, (url) => {
    const host = url.hostname.toLowerCase().replace(/\.$/u, '')
    return host === 'xhscdn.com' || host.endsWith('.xhscdn.com')
  })
}

function isBoundedHttpsUrl(value: string, predicate: (url: URL) => boolean) {
  if (value.length > 2_048) return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password && predicate(url)
  } catch {
    return false
  }
}

export function createPublicConfig(environment: PublicEnvironment) {
  return {
    turnstileSiteKey: environment.TURNSTILE_SITE_KEY,
  }
}
