import { describe, expect, it, vi } from 'vitest'

import {
  createPublicConfig,
  createStartResearchHandler,
  createVisualSourcesHandler,
} from './entrypoint'

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

  it('rejects Chrome observations on the start endpoint so workflow input stays bounded', async () => {
    const workflows = { create: vi.fn().mockResolvedValue(undefined) }
    const handler = createStartResearchHandler({
      turnstile: { verify: vi.fn().mockResolvedValue(true) },
      quota: { consume: vi.fn().mockResolvedValue({ allowed: true }) },
      costGate: {
        reserve: vi.fn().mockResolvedValue({ accepted: true, reservedUsd: 0.2 }),
      },
      workflows,
      createRunId: () => 'run-xiaohongshu',
    })
    const payload = {
      workspaceId: 'workspace-studio',
      question: '社区图书馆如何用蓝色轴测图表达公共流线？',
      goal: 'visual_reference_search',
      mode: 'quick',
      researchSources: ['xiaohongshu'],
      browserVisualSources: [{
        directionId: 'linework',
        sourceUrl: 'https://www.xiaohongshu.com/explore/note-1',
        title: '蓝色轴测图',
        imageUrl: 'https://sns-webpic-qc.xhscdn.com/note-1.webp',
        previewDataUrl: 'data:image/png;base64,aW1hZ2U=',
        adjacentText: '蓝色轴测图，使用细线与编号组织信息。',
      }],
      clientSessionId: 'device-session-1',
      turnstileToken: 'valid-token',
    }
    const response = await handler(new Request('https://research.example/api/runs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    }))

    expect(response.status).toBe(400)
    expect(workflows.create).not.toHaveBeenCalled()
  })

  it('starts visual planning before Chrome observations and returns only a scoped upload token', async () => {
    const workflows = { create: vi.fn().mockResolvedValue(undefined) }
    const issueVisualUploadToken = vi.fn().mockResolvedValue('scoped-upload-token')
    const handler = createStartResearchHandler({
      turnstile: { verify: vi.fn().mockResolvedValue(true) },
      quota: { consume: vi.fn().mockResolvedValue({ allowed: true }) },
      costGate: {
        reserve: vi.fn().mockResolvedValue({ accepted: true, reservedUsd: 0.6 }),
      },
      workflows,
      issueVisualUploadToken,
      createRunId: () => 'run-visual-planning',
    })
    const response = await handler(new Request('https://research.example/api/runs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        workspaceId: 'workspace-studio',
        question: '社区图书馆如何用轴测图表达公共流线？',
        goal: 'visual_reference_search',
        mode: 'balanced',
        researchSources: ['xiaohongshu'],
        clientSessionId: 'device-session-1',
        turnstileToken: 'valid-token',
      }),
    }))

    expect(response.status).toBe(202)
    await expect(response.json()).resolves.toEqual({
      runId: 'run-visual-planning',
      status: 'created',
      visualUploadToken: 'scoped-upload-token',
    })
    expect(issueVisualUploadToken).toHaveBeenCalledWith({
      runId: 'run-visual-planning',
      clientSessionId: 'device-session-1',
    })
    expect(workflows.create).toHaveBeenCalledWith(expect.objectContaining({
      params: expect.not.objectContaining({ browserVisualSources: expect.anything() }),
    }))
  })

  it('sends only authorized bounded visual observations to the waiting workflow', async () => {
    const sendEvent = vi.fn().mockResolvedValue(undefined)
    const authorize = vi.fn().mockResolvedValue(true)
    const storeSources = vi.fn().mockResolvedValue([{
      directionId: 'linework',
      sourceUrl: 'https://www.xiaohongshu.com/explore/note-1',
      title: '蓝色轴测图',
      imageUrl: 'https://sns-webpic-qc.xhscdn.com/note-1.webp',
      previewObjectKey: 'visual-previews/11111111-1111-4111-8111-111111111111/1.png',
      adjacentText: '蓝色轴测图，使用细线与编号组织信息。',
    }])
    const discardSources = vi.fn().mockResolvedValue(undefined)
    const handler = createVisualSourcesHandler({
      authorize,
      storeSources,
      discardSources,
      sendEvent,
    })
    const source = {
      directionId: 'linework',
      sourceUrl: 'https://www.xiaohongshu.com/explore/note-1',
      title: '蓝色轴测图',
      imageUrl: 'https://sns-webpic-qc.xhscdn.com/note-1.webp',
      previewDataUrl: 'data:image/png;base64,aW1hZ2U=',
      adjacentText: '蓝色轴测图，使用细线与编号组织信息。',
    }
    const visualRequest = () => new Request(
        'https://research.example/api/runs/11111111-1111-4111-8111-111111111111/visual-sources',
        {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          clientSessionId: 'device-session-1',
          uploadToken: 'scoped-upload-token',
          sources: [source],
        }),
        },
      )

    const response = await handler(
      '11111111-1111-4111-8111-111111111111',
      visualRequest(),
    )

    expect(response.status).toBe(204)
    expect(authorize).toHaveBeenCalledWith({
      runId: '11111111-1111-4111-8111-111111111111',
      clientSessionId: 'device-session-1',
      uploadToken: 'scoped-upload-token',
    })
    expect(storeSources).toHaveBeenCalledWith({
      runId: '11111111-1111-4111-8111-111111111111',
      sources: [source],
    })
    const event = sendEvent.mock.calls[0]?.[0]
    expect(event).toEqual({
      runId: '11111111-1111-4111-8111-111111111111',
      type: 'xiaohongshu_visual_sources',
      payload: {
        sources: [{
          directionId: 'linework',
          sourceUrl: 'https://www.xiaohongshu.com/explore/note-1',
          title: '蓝色轴测图',
          imageUrl: 'https://sns-webpic-qc.xhscdn.com/note-1.webp',
          previewObjectKey: 'visual-previews/11111111-1111-4111-8111-111111111111/1.png',
          adjacentText: '蓝色轴测图，使用细线与编号组织信息。',
        }],
      },
    })
    expect(JSON.stringify(event)).not.toContain('data:image/')
    expect(JSON.stringify(event).length).toBeLessThan(1024 * 1024)
    expect(discardSources).not.toHaveBeenCalled()

    authorize.mockResolvedValue(false)
    const rejected = await handler(
      '11111111-1111-4111-8111-111111111111',
      visualRequest(),
    )
    expect(rejected.status).toBe(403)
  })

  it('discards temporary previews when the workflow event cannot be delivered', async () => {
    const stored = [{
      directionId: 'linework',
      sourceUrl: 'https://www.xiaohongshu.com/explore/note-1',
      title: '蓝色轴测图',
      imageUrl: 'https://sns-webpic-qc.xhscdn.com/note-1.webp',
      previewObjectKey: 'visual-previews/11111111-1111-4111-8111-111111111111/1.png',
      adjacentText: '蓝色轴测图，使用细线与编号组织信息。',
    }]
    const discardSources = vi.fn().mockResolvedValue(undefined)
    const handler = createVisualSourcesHandler({
      authorize: vi.fn().mockResolvedValue(true),
      storeSources: vi.fn().mockResolvedValue(stored),
      discardSources,
      sendEvent: vi.fn().mockRejectedValue(new Error('workflow unavailable')),
    })
    const request = new Request(
      'https://research.example/api/runs/11111111-1111-4111-8111-111111111111/visual-sources',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          clientSessionId: 'device-session-1',
          uploadToken: 'scoped-upload-token',
          sources: [{
            directionId: 'linework',
            sourceUrl: 'https://www.xiaohongshu.com/explore/note-1',
            title: '蓝色轴测图',
            imageUrl: 'https://sns-webpic-qc.xhscdn.com/note-1.webp',
            previewDataUrl: 'data:image/png;base64,aW1hZ2U=',
            adjacentText: '蓝色轴测图，使用细线与编号组织信息。',
          }],
        }),
      },
    )

    await expect(handler(
      '11111111-1111-4111-8111-111111111111',
      request,
    )).rejects.toThrow('workflow unavailable')
    expect(discardSources).toHaveBeenCalledWith({
      runId: '11111111-1111-4111-8111-111111111111',
      sources: stored,
    })
  })
})
