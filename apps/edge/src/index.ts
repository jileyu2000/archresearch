import {
  DurableCostGateClient,
  PublicQuotaLimiter,
  TurnstileVerifier,
  type CloudflareEnvironment,
} from './cloudflare'
import { createPublicConfig, createStartResearchHandler } from './entrypoint'
import type { ResearchRunSnapshot } from './public-contracts'
import { createWorkerRouteHandler, withSecurityHeaders } from './worker-router'

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}

function sameOrigin(request: Request) {
  const origin = request.headers.get('origin')
  return origin === null || origin === new URL(request.url).origin
}

function runIdFromPath(pathname: string) {
  const match = /^\/api\/runs\/([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i
    .exec(pathname)
  return match?.[1] ?? null
}

function sanitizeWorkflowOutput(value: unknown): ResearchRunSnapshot | null {
  if (typeof value !== 'object' || value === null) return null
  const output = value as Record<string, unknown>
  if (
    typeof output.runId !== 'string'
    || (output.status !== 'completed' && output.status !== 'partial')
    || typeof output.summary !== 'string'
    || !Array.isArray(output.sections)
    || typeof output.coverage !== 'object'
    || output.coverage === null
  ) {
    return null
  }
  return {
    runId: output.runId,
    status: output.status,
    summary: output.summary,
    sections: output.sections as ResearchRunSnapshot['sections'],
    coverage: output.coverage as ResearchRunSnapshot['coverage'],
  }
}

async function handleApi(request: Request, environment: CloudflareEnvironment) {
  const url = new URL(request.url)
  if (url.pathname === '/api/config' && request.method === 'GET') {
    return json({
      ...createPublicConfig(environment),
      ...(environment.MOCK_MODE === 'true'
        ? { mockVerificationToken: 'local-mock-token' }
        : {}),
    })
  }

  if (url.pathname === '/api/runs' && request.method === 'POST') {
    if (!sameOrigin(request)) return json({ error: 'cross_origin_request' }, 403)
    const costGate = new DurableCostGateClient(environment.COST_GUARD)
    return await createStartResearchHandler({
      turnstile: new TurnstileVerifier(environment, url.hostname),
      quota: new PublicQuotaLimiter(environment),
      costGate,
      workflows: {
        create: async (input) => {
          await environment.RESEARCH_WORKFLOW.create({
            ...input,
            retention: {
              successRetention: '1 day',
              errorRetention: '3 days',
            },
          })
        },
      },
    })(request)
  }

  const runId = runIdFromPath(url.pathname)
  if (runId && request.method === 'GET') {
    try {
      const instance = await environment.RESEARCH_WORKFLOW.get(runId)
      const status = await instance.status()
      if (status.status === 'complete') {
        const output = sanitizeWorkflowOutput(status.output)
        return output ? json(output) : json({ runId, status: 'failed' })
      }
      if (status.status === 'errored') return json({ runId, status: 'failed' })
      if (status.status === 'terminated') return json({ runId, status: 'cancelled' })
      return json({
        runId,
        status: status.status === 'queued' ? 'created' : 'searching',
      })
    } catch {
      return json({ error: 'run_not_found' }, 404)
    }
  }

  if (runId && request.method === 'DELETE') {
    if (!sameOrigin(request)) return json({ error: 'cross_origin_request' }, 403)
    try {
      const instance = await environment.RESEARCH_WORKFLOW.get(runId)
      await instance.terminate({ rollback: false })
      await new DurableCostGateClient(environment.COST_GUARD).settleReserved(runId)
      return new Response(null, { status: 204 })
    } catch {
      return json({ error: 'run_not_found' }, 404)
    }
  }

  if (url.pathname === '/api/admin/service' && request.method === 'POST') {
    const authorization = request.headers.get('authorization')
    if (
      !sameOrigin(request)
      || !environment.ADMIN_CONTROL_TOKEN
      || authorization !== `Bearer ${environment.ADMIN_CONTROL_TOKEN}`
    ) {
      return json({ error: 'not_found' }, 404)
    }
    const input = await request.json() as { enabled?: unknown }
    if (typeof input.enabled !== 'boolean') return json({ error: 'invalid_request' }, 400)
    return json(
      await new DurableCostGateClient(environment.COST_GUARD).setEnabled(input.enabled),
    )
  }

  return json({ error: 'not_found' }, 404)
}

export default {
  async fetch(
    request: Request,
    environment: CloudflareEnvironment,
  ) {
    try {
      return await createWorkerRouteHandler({
        assets: environment.ASSETS,
        api: async (apiRequest) => await handleApi(apiRequest, environment),
      })(request)
    } catch {
      return withSecurityHeaders(json({ error: 'internal_error' }, 500))
    }
  },
} satisfies ExportedHandler<CloudflareEnvironment>

export { CostGuardDurableObject, ResearchWorkflow } from './cloudflare'
