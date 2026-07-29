import {
  DurableObject,
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
} from 'cloudflare:workers'

import type { CostGate, CostReservation, ReserveCostInput, SettleCostInput } from './cost-gate'
import { estimatedCostByMode } from './entrypoint'
import { ResponsesProvider } from './provider'
import {
  createLiveResearchServices,
  createMockResearchServices,
  PublicPageReader,
} from './research-services'
import {
  runResearchWorkflow,
  type ResearchWorkflowInput,
  type WorkflowStage,
  type WorkflowStageRunner,
} from './workflow'
import { SqlCostLedger } from './sql-cost-ledger'
import {
  cleanupVisualPreviews,
  readVisualPreview,
} from './visual-preview-store'

export interface CloudflareEnvironment {
  ASSETS: Fetcher
  COST_GUARD: DurableObjectNamespace<CostGuardDurableObject>
  RESEARCH_WORKFLOW: Workflow<ResearchWorkflowInput>
  VISUAL_PREVIEWS: R2Bucket
  START_RATE_LIMITER: RateLimit
  PROVIDER_API_KEY: string
  PROVIDER_BASE_URL: string
  PROVIDER_MODEL: string
  PROVIDER_INPUT_USD_PER_MILLION: string
  PROVIDER_OUTPUT_USD_PER_MILLION: string
  WEB_SEARCH_CALL_USD: string
  TURNSTILE_SITE_KEY: string
  TURNSTILE_SECRET_KEY: string
  ADMIN_CONTROL_TOKEN: string
  SERVICE_ENABLED: string
  MOCK_MODE: string
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

export class CostGuardDurableObject extends DurableObject<CloudflareEnvironment> {
  private get ledger() {
    return new SqlCostLedger(this.ctx.storage.sql as never, {
      enabled: this.env.SERVICE_ENABLED !== 'false',
    })
  }

  async fetch(request: Request) {
    const path = new URL(request.url).pathname
    const checkpointRunId = path.match(/^\/checkpoints\/([^/]+)$/)?.[1]
    if (request.method === 'GET' && checkpointRunId) {
      const checkpoint = await this.ctx.storage.get<{
        stage: WorkflowStage
        summary: Record<string, unknown>
        updatedAt: string
        expiresAt: number
      }>(`checkpoint:${checkpointRunId}`)
      if (!checkpoint) return json({ error: 'not_found' }, 404)
      if (checkpoint.expiresAt <= Date.now()) {
        await this.ctx.storage.delete(`checkpoint:${checkpointRunId}`)
        return json({ error: 'not_found' }, 404)
      }
      return json(checkpoint)
    }
    if (request.method === 'GET' && path === '/snapshot') {
      return json(this.ledger.snapshot())
    }

    if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

    if (path === '/reserve') {
      const input = await request.json() as ReserveCostInput
      return json(this.ledger.reserve(input))
    }

    if (path === '/settle') {
      const input = await request.json() as Partial<SettleCostInput> & { runId: string }
      this.ledger.settle(input)
      return new Response(null, { status: 204 })
    }

    if (path === '/release') {
      const input = await request.json() as { runId: string }
      this.ledger.release(input.runId)
      return new Response(null, { status: 204 })
    }

    if (path === '/enabled') {
      const input = await request.json() as { enabled: boolean }
      if (typeof input.enabled !== 'boolean') return json({ error: 'invalid_request' }, 400)
      return json(this.ledger.setEnabled(input.enabled))
    }

    if (path === '/checkpoints') {
      const input = await request.json() as {
        runId?: unknown
        stage?: unknown
        summary?: unknown
      }
      if (
        typeof input.runId !== 'string'
        || ![
          'planning',
          'searching',
          'inspecting',
          'analyzing',
          'verifying',
          'gap_check',
          'composing',
        ].includes(String(input.stage))
        || typeof input.summary !== 'object'
        || input.summary === null
      ) {
        return json({ error: 'invalid_request' }, 400)
      }
      await this.ctx.storage.put(`checkpoint:${input.runId}`, {
        stage: input.stage as WorkflowStage,
        summary: input.summary as Record<string, unknown>,
        updatedAt: new Date().toISOString(),
        expiresAt: Date.now() + 3 * 86_400_000,
      })
      return new Response(null, { status: 204 })
    }

    return json({ error: 'not_found' }, 404)
  }
}

export class DurableCostGateClient implements CostGate {
  private readonly stub: DurableObjectStub<CostGuardDurableObject>

  constructor(namespace: DurableObjectNamespace<CostGuardDurableObject>) {
    this.stub = namespace.getByName('global-cost-guard')
  }

  async reserve(input: ReserveCostInput) {
    const response = await this.stub.fetch('https://cost-guard/reserve', {
      method: 'POST',
      body: JSON.stringify(input),
    })
    return await response.json() as CostReservation
  }

  async settle(input: SettleCostInput) {
    await this.stub.fetch('https://cost-guard/settle', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  }

  async settleReserved(runId: string) {
    await this.stub.fetch('https://cost-guard/settle', {
      method: 'POST',
      body: JSON.stringify({ runId }),
    })
  }

  async release(runId: string) {
    await this.stub.fetch('https://cost-guard/release', {
      method: 'POST',
      body: JSON.stringify({ runId }),
    })
  }

  async setEnabled(enabled: boolean) {
    const response = await this.stub.fetch('https://cost-guard/enabled', {
      method: 'POST',
      body: JSON.stringify({ enabled }),
    })
    return await response.json() as { enabled: boolean }
  }

  async saveCheckpoint(
    runId: string,
    stage: WorkflowStage,
    summary: Record<string, unknown>,
  ) {
    await this.stub.fetch('https://cost-guard/checkpoints', {
      method: 'POST',
      body: JSON.stringify({ runId, stage, summary }),
    })
  }

  async getCheckpoint(runId: string) {
    const response = await this.stub.fetch(
      `https://cost-guard/checkpoints/${encodeURIComponent(runId)}`,
    )
    if (response.status === 404) return null
    if (!response.ok) throw new Error('Checkpoint lookup failed.')
    return await response.json() as {
      stage: WorkflowStage
      summary: Record<string, unknown>
      updatedAt: string
    }
  }
}

export class TurnstileVerifier {
  constructor(
    private readonly environment: CloudflareEnvironment,
    private readonly expectedHostname: string,
  ) {}

  async verify(input: {
    token: string
    remoteIp: string | null
    action: 'start_research'
  }) {
    if (this.environment.MOCK_MODE === 'true') {
      return input.token === 'local-mock-token'
    }
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        secret: this.environment.TURNSTILE_SECRET_KEY,
        response: input.token,
        remoteip: input.remoteIp,
        idempotency_key: crypto.randomUUID(),
      }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) return false
    const result = await response.json() as {
      success?: unknown
      action?: unknown
      hostname?: unknown
    }
    return result.success === true
      && result.action === input.action
      && result.hostname === this.expectedHostname
  }
}

async function sha256(value: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(bytes)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export class PublicQuotaLimiter {
  constructor(private readonly environment: CloudflareEnvironment) {}

  async consume(input: {
    clientSessionId: string
    remoteIp: string | null
    resource: 'start_research'
  }) {
    if (this.environment.MOCK_MODE === 'true') return { allowed: true }
    const device = await this.environment.START_RATE_LIMITER.limit({
      key: `${input.resource}:device:${input.clientSessionId}`,
    })
    if (!device.success) return { allowed: false }
    if (!input.remoteIp) return { allowed: true }
    const network = await this.environment.START_RATE_LIMITER.limit({
      key: `${input.resource}:network:${await sha256(input.remoteIp)}`,
    })
    return { allowed: network.success }
  }
}

export class ResearchWorkflow extends WorkflowEntrypoint<
  CloudflareEnvironment,
  ResearchWorkflowInput
> {
  async run(event: Readonly<WorkflowEvent<ResearchWorkflowInput>>, step: WorkflowStep) {
    const input = event.payload
    const costGate = new DurableCostGateClient(this.env.COST_GUARD)
    const checkpoints = {
      save: async (stage: WorkflowStage, summary: Record<string, unknown>) => {
        await costGate.saveCheckpoint(input.runId, stage, summary)
      },
    }
    const services = this.env.MOCK_MODE === 'true'
      ? createMockResearchServices()
      : createLiveResearchServices(
          new ResponsesProvider({
            apiKey: this.env.PROVIDER_API_KEY,
            baseUrl: this.env.PROVIDER_BASE_URL,
            model: this.env.PROVIDER_MODEL,
            inputUsdPerMillionTokens: Number(this.env.PROVIDER_INPUT_USD_PER_MILLION),
            outputUsdPerMillionTokens: Number(this.env.PROVIDER_OUTPUT_USD_PER_MILLION),
          }),
          new PublicPageReader(),
          Number(this.env.WEB_SEARCH_CALL_USD),
          async (objectKey) => await readVisualPreview(
            this.env.VISUAL_PREVIEWS,
            input.runId,
            objectKey,
          ),
        ).services
    const stageRunner: WorkflowStageRunner = {
      do: async (stage, callback) => await step.do(stage, {
        retries: { limit: 2, delay: '5 seconds', backoff: 'exponential' },
        timeout: '5 minutes',
        sensitive: 'output',
      }, callback),
      waitForEvent: async (name, options) => await step.waitForEvent(name, options),
    }

    try {
      return await runResearchWorkflow(input, services, checkpoints, stageRunner)
    } finally {
      await cleanupVisualPreviews(this.env.VISUAL_PREVIEWS, input.runId)
        .catch(() => undefined)
      await costGate.settle({
        runId: input.runId,
        actualCostUsd: estimatedCostByMode[input.mode],
      })
    }
  }
}
