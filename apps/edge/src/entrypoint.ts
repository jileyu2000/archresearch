import type { CostGate } from './cost-gate'

type ResearchMode = 'quick' | 'balanced' | 'deep'

interface StartResearchPayload {
  question: string
  mode: ResearchMode
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
  const question = typeof candidate.question === 'string' ? candidate.question.trim() : ''
  const mode = candidate.mode
  const clientSessionId = candidate.clientSessionId
  const turnstileToken = candidate.turnstileToken
  if (
    question.length < 8
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
  return { question, mode, clientSessionId, turnstileToken }
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
        question: payload.question,
        mode: payload.mode,
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
