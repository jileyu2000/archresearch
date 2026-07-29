import { describe, expect, it, vi } from 'vitest'

import { createWebApiClient } from './client'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('Web Edition API client', () => {
  it('starts, polls, and cancels a bounded public research run', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ turnstileSiteKey: 'public-site-key' }))
      .mockResolvedValueOnce(jsonResponse({ runId: 'run-1', status: 'created' }, 202))
      .mockResolvedValueOnce(jsonResponse({
        runId: 'run-1',
        status: 'completed',
        summary: '用连续剖面组织开放与安静空间。',
        sections: [],
        coverage: {
          coverageSatisfied: true,
          enrichmentSatisfied: true,
          gaps: [],
        },
      }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)
    const client = createWebApiClient('/api')

    await expect(client.getConfig()).resolves.toEqual({
      turnstileSiteKey: 'public-site-key',
    })
    await expect(client.startResearch({
      question: '社区图书馆如何用剖面组织安静与开放空间？',
      mode: 'balanced',
      clientSessionId: 'device-session-1',
      turnstileToken: 'one-time-token',
    })).resolves.toEqual({ runId: 'run-1', status: 'created' })
    await expect(client.getRun('run-1')).resolves.toMatchObject({
      status: 'completed',
      coverage: { coverageSatisfied: true, enrichmentSatisfied: true },
    })
    await expect(client.cancelRun('run-1')).resolves.toBeUndefined()

    expect(fetchMock.mock.calls.map(([path, request]) => [
      path,
      (request as RequestInit | undefined)?.method,
    ])).toEqual([
      ['/api/config', undefined],
      ['/api/runs', 'POST'],
      ['/api/runs/run-1', undefined],
      ['/api/runs/run-1', 'DELETE'],
    ])
    const serializedCalls = JSON.stringify(fetchMock.mock.calls)
    expect(serializedCalls).toContain('one-time-token')
    expect(serializedCalls).not.toMatch(/provider[_-]?api[_-]?key|owner-provider-secret/i)
  })

  it('returns a typed public error without leaking an upstream response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ error: 'service_paused' }, 429)),
    )
    const client = createWebApiClient('/api')

    await expect(client.startResearch({
      question: '旧厂房如何组织新旧结构关系？',
      mode: 'quick',
      clientSessionId: 'device-session-2',
      turnstileToken: 'one-time-token',
    })).rejects.toEqual(expect.objectContaining({
      name: 'WebApiError',
      code: 'service_paused',
      status: 429,
    }))
  })
})
