import { describe, expect, it, vi } from 'vitest'

import { createPublicConfig, createStartResearchHandler } from './entrypoint'

function researchRequest(turnstileToken = 'valid-token') {
  return new Request('https://research.example/api/runs', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'cf-connecting-ip': '203.0.113.8',
    },
    body: JSON.stringify({
      workspaceId: 'workspace-studio',
      question: '社区图书馆如何用剖面组织安静与开放空间？',
      goal: 'precedent_research',
      mode: 'balanced',
      referenceUrl: 'https://www.archdaily.com/reference-project',
      researchSources: [],
      subquestions: [{
        id: 'section',
        question: '剖面如何组织开放与安静空间？',
        rationale: '核对高差与距离',
      }],
      clientSessionId: 'device-session-1',
      turnstileToken,
    }),
  })
}

describe('public research entrypoint', () => {
  it('rejects failed Turnstile validation before quota, cost, or workflow creation', async () => {
    const quota = { consume: vi.fn() }
    const costGate = { reserve: vi.fn() }
    const workflows = { create: vi.fn() }
    const handler = createStartResearchHandler({
      turnstile: { verify: vi.fn().mockResolvedValue(false) },
      quota,
      costGate,
      workflows,
      createRunId: () => 'run-blocked',
    })

    const response = await handler(researchRequest('invalid-token'))

    expect(response.status).toBe(403)
    expect(quota.consume).not.toHaveBeenCalled()
    expect(costGate.reserve).not.toHaveBeenCalled()
    expect(workflows.create).not.toHaveBeenCalled()
  })

  it('requires quota and exact cost reservation before creating a workflow', async () => {
    const workflows = { create: vi.fn() }
    const handler = createStartResearchHandler({
      turnstile: { verify: vi.fn().mockResolvedValue(true) },
      quota: { consume: vi.fn().mockResolvedValue({ allowed: true }) },
      costGate: {
        reserve: vi.fn().mockResolvedValue({
          accepted: false,
          reason: 'service_paused',
        }),
      },
      workflows,
      createRunId: () => 'run-budget-blocked',
    })

    const response = await handler(researchRequest())

    expect(response.status).toBe(429)
    expect(workflows.create).not.toHaveBeenCalled()
  })

  it('returns only public run metadata and never forwards server secrets to the workflow', async () => {
    const workflows = { create: vi.fn().mockResolvedValue(undefined) }
    const handler = createStartResearchHandler({
      turnstile: { verify: vi.fn().mockResolvedValue(true) },
      quota: { consume: vi.fn().mockResolvedValue({ allowed: true }) },
      costGate: {
        reserve: vi.fn().mockResolvedValue({ accepted: true, reservedUsd: 0.6 }),
      },
      workflows,
      createRunId: () => 'run-accepted',
    })

    const response = await handler(researchRequest())
    const text = await response.text()

    expect(response.status).toBe(202)
    expect(JSON.parse(text)).toEqual({
      runId: 'run-accepted',
      status: 'created',
    })
    expect(text).not.toContain('owner-provider-secret')
    expect(workflows.create).toHaveBeenCalledWith({
      id: 'run-accepted',
      params: {
        runId: 'run-accepted',
        workspaceId: 'workspace-studio',
        question: '社区图书馆如何用剖面组织安静与开放空间？',
        goal: 'precedent_research',
        mode: 'balanced',
        referenceUrl: 'https://www.archdaily.com/reference-project',
        researchSources: [],
        subquestions: [{
          id: 'section',
          question: '剖面如何组织开放与安静空间？',
          rationale: '核对高差与距离',
        }],
        clientSessionId: 'device-session-1',
      },
    })
    expect(JSON.stringify(workflows.create.mock.calls)).not.toContain('valid-token')
  })

  it('exposes the public Turnstile site key but no provider or verification secret', () => {
    const config = createPublicConfig({
      TURNSTILE_SITE_KEY: 'public-site-key',
      TURNSTILE_SECRET_KEY: 'turnstile-secret',
      PROVIDER_API_KEY: 'owner-provider-secret',
    })

    expect(config).toEqual({ turnstileSiteKey: 'public-site-key' })
    expect(JSON.stringify(config)).not.toMatch(/secret|provider/i)
  })
})
