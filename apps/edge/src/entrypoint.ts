import type { CostGate } from './cost-gate'

type ResearchMode = 'quick' | 'balanced' | 'deep'
type ResearchGoal = 'precedent_research' | 'visual_reference_search'
type ResearchSource = 'public_web'

interface ResearchSubquestion {
  id: string
  question: string
  rationale: string
}

interface BriefFile {
  filename: string
  dataUrl: string
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
  createRunId?: () => string
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
    || researchSources.some((source) => source !== 'public_web')
    || researchSources.length > 1
  ) {
    return null
  }
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
    return json({ runId, status: 'created' }, 202)
  }
}

export function createPublicConfig(environment: PublicEnvironment) {
  return {
    turnstileSiteKey: environment.TURNSTILE_SITE_KEY,
  }
}
