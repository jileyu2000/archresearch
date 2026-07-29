import { describe, expect, it, vi } from 'vitest'

import { createStartResearchHandler } from './entrypoint'
import { createWorkerRouteHandler } from './worker-router'

describe('Worker API route shell', () => {
  it('does not fall through to static assets when /api/runs rejects a cost reservation', async () => {
    const assets = { fetch: vi.fn() }
    const workflows = { create: vi.fn() }
    const api = createStartResearchHandler({
      turnstile: { verify: vi.fn().mockResolvedValue(true) },
      quota: { consume: vi.fn().mockResolvedValue({ allowed: true }) },
      costGate: {
        reserve: vi.fn().mockResolvedValue({
          accepted: false,
          reason: 'service_paused',
        }),
      },
      workflows,
      createRunId: () => 'route-shell-budget-blocked',
    })
    const route = createWorkerRouteHandler({ assets, api })

    const response = await route(new Request('https://research.example/api/runs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        question: '社区图书馆如何用剖面组织安静与开放空间？',
        mode: 'balanced',
        clientSessionId: 'route-shell-device-1',
        turnstileToken: 'valid-token',
      }),
    }))

    expect(response.status).toBe(429)
    expect(await response.json()).toEqual({ error: 'service_paused' })
    expect(assets.fetch).not.toHaveBeenCalled()
    expect(workflows.create).not.toHaveBeenCalled()
  })
})
