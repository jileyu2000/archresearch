import { afterEach, describe, expect, it, vi } from 'vitest'

import { createPublicApiClient } from './publicClient'

const databaseNames: string[] = []

function databaseName(label: string) {
  const name = `archresearch-public-${label}-${crypto.randomUUID()}`
  databaseNames.push(name)
  return name
}

afterEach(async () => {
  await Promise.all(databaseNames.splice(0).map(
    (name) => new Promise<void>((resolve) => {
      const request = indexedDB.deleteDatabase(name)
      request.onsuccess = () => resolve()
      request.onerror = () => resolve()
      request.onblocked = () => resolve()
    }),
  ))
})

describe('public product client', () => {
  it('keeps workspaces in browser-local storage', async () => {
    const name = databaseName('workspaces')
    const first = createPublicApiClient({
      indexedDB,
      databaseName: name,
      fetch: vi.fn(),
      clientSessionId: 'device-session-test',
      initialVerificationToken: 'verified-token',
    })
    const created = await first.createWorkspace({ name: '毕业设计' })
    first.close()

    const reopened = createPublicApiClient({
      indexedDB,
      databaseName: name,
      fetch: vi.fn(),
      clientSessionId: 'device-session-test',
      initialVerificationToken: 'verified-token',
    })
    await expect(reopened.listWorkspaces()).resolves.toEqual([
      expect.objectContaining({ id: created.id, name: '毕业设计' }),
    ])
    reopened.close()
  })

  it('starts the cloud workflow with the local product goal and checkpoints the run locally', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      runId: '11111111-1111-4111-8111-111111111111',
      status: 'created',
    }), {
      status: 202,
      headers: { 'content-type': 'application/json' },
    }))
    const client = createPublicApiClient({
      indexedDB,
      databaseName: databaseName('start'),
      fetch: fetchMock,
      clientSessionId: 'device-session-test',
      initialVerificationToken: 'verified-token',
    })
    const workspace = await client.createWorkspace({ name: '城市更新' })

    const run = await client.startResearch({
      workspaceId: workspace.id,
      question: '旧厂房如何植入新的公共功能？',
      referenceUrl: 'https://example.com/reference',
      goal: 'precedent_research',
      mode: 'balanced',
      researchSources: [],
      subquestions: [{
        id: 'program',
        question: '新功能怎样进入旧结构？',
        rationale: '核对保留与植入的关系',
      }],
    })

    expect(run).toMatchObject({
      id: '11111111-1111-4111-8111-111111111111',
      workspaceId: workspace.id,
      goal: 'precedent_research',
      status: 'created',
    })
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/runs')
    expect(JSON.parse(String(request.body))).toMatchObject({
      workspaceId: workspace.id,
      question: '旧厂房如何植入新的公共功能？',
      referenceUrl: 'https://example.com/reference',
      goal: 'precedent_research',
      mode: 'balanced',
      clientSessionId: 'device-session-test',
      turnstileToken: 'verified-token',
    })
    await expect(client.listRuns(workspace.id)).resolves.toEqual([
      expect.objectContaining({ id: run.id, status: 'created' }),
    ])
    client.close()
  })

  it('resumes a planned visual workflow with direction-bound Chrome observations', async () => {
    const runId = '55555555-5555-4555-8555-555555555555'
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        runId,
        status: 'created',
        visualUploadToken: 'scoped-upload-token',
      }), {
        status: 202,
        headers: { 'content-type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        runId,
        status: 'planning',
        checkpointStage: 'planning',
        visualDirections: [{
          id: 'linework',
          query: '社区图书馆 精细线稿 轴测图',
        }],
      }), {
        headers: { 'content-type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        runId,
        workspaceId: 'workspace-placeholder',
        question: '社区图书馆如何用蓝色轴测图表达公共流线？',
        goal: 'visual_reference_search',
        mode: 'quick',
        status: 'completed',
        subquestions: [{
          id: 'linework',
          question: '精细线稿轴测图',
          rationale: '比较线型与编号层级',
        }],
        summary: '细线和蓝色编号适合表达公共流线。',
        sections: [{
          id: 'linework',
          title: '精细线稿轴测图',
          facts: [{
            candidateId: 'visual-1',
            statement: '细线和蓝色编号强调公共流线。',
            sourceUrl: 'https://www.xiaohongshu.com/explore/note-1',
            quote: '蓝色轴测图，使用细线与编号组织信息。',
            sourceTitle: '蓝色轴测图',
            imageUrl: 'https://sns-webpic-qc.xhscdn.com/note-1.webp',
            assetType: 'axonometric',
          }],
        }],
        coverage: {
          coverageSatisfied: true,
          enrichmentSatisfied: true,
          gaps: [],
        },
      }), {
        headers: { 'content-type': 'application/json' },
      }))
    const xiaohongshuResearch = vi.fn().mockResolvedValue([{
      directionId: 'linework',
      sourceUrl: 'https://www.xiaohongshu.com/explore/note-1',
      title: '蓝色轴测图',
      imageUrl: 'https://sns-webpic-qc.xhscdn.com/note-1.webp',
      previewDataUrl: 'data:image/png;base64,aW1hZ2U=',
      adjacentText: '蓝色轴测图，使用细线与编号组织信息。',
    }])
    const client = createPublicApiClient({
      indexedDB,
      databaseName: databaseName('xiaohongshu-start'),
      fetch: fetchMock,
      clientSessionId: 'device-session-test',
      initialVerificationToken: 'verified-token',
      xiaohongshuResearch,
    })
    const workspace = await client.createWorkspace({ name: '图纸研究' })

    await client.startResearch({
      workspaceId: workspace.id,
      question: '社区图书馆如何用蓝色轴测图表达公共流线？',
      goal: 'visual_reference_search',
      mode: 'quick',
      researchSources: ['xiaohongshu'],
    })

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))
    expect(xiaohongshuResearch).toHaveBeenCalledWith([{
      id: 'linework',
      query: '社区图书馆 精细线稿 轴测图',
    }])
    const startRequest = fetchMock.mock.calls[0]?.[1] as RequestInit
    expect(JSON.parse(String(startRequest.body))).toMatchObject({
      goal: 'visual_reference_search',
      researchSources: ['xiaohongshu'],
    })
    expect(JSON.parse(String(startRequest.body))).not.toHaveProperty('browserVisualSources')
    expect(fetchMock.mock.calls[2]?.[0]).toBe(`/api/runs/${runId}/visual-sources`)
    const uploadRequest = fetchMock.mock.calls[2]?.[1] as RequestInit
    expect(JSON.parse(String(uploadRequest.body))).toEqual({
      clientSessionId: 'device-session-test',
      uploadToken: 'scoped-upload-token',
      sources: [{
        directionId: 'linework',
        sourceUrl: 'https://www.xiaohongshu.com/explore/note-1',
        title: '蓝色轴测图',
        imageUrl: 'https://sns-webpic-qc.xhscdn.com/note-1.webp',
        previewDataUrl: 'data:image/png;base64,aW1hZ2U=',
        adjacentText: '蓝色轴测图，使用细线与编号组织信息。',
      }],
    })
    await client.getRun(runId)
    await expect(client.getResults(runId)).resolves.toEqual([
      expect.objectContaining({
        image_url: 'data:image/png;base64,aW1hZ2U=',
      }),
    ])
    client.close()
  })

  it('keeps waiting beyond one minute for a valid visual planning checkpoint', async () => {
    const runId = '66666666-6666-4666-8666-666666666666'
    let statusRequests = 0
    let finishRequest!: (value: 'upload' | 'cancel') => void
    const finished = new Promise<'upload' | 'cancel'>((resolve) => {
      finishRequest = resolve
    })
    const timeout = vi.spyOn(window, 'setTimeout').mockImplementation((callback) => {
      queueMicrotask(() => {
        if (typeof callback === 'function') callback()
      })
      return 1 as unknown as ReturnType<typeof window.setTimeout>
    })
    const fetchMock = vi.fn().mockImplementation((
      input: RequestInfo | URL,
      init?: RequestInit,
    ) => {
      const path = String(input)
      if (path === '/api/runs') {
        return Promise.resolve(new Response(JSON.stringify({
          runId,
          status: 'created',
          visualUploadToken: 'scoped-upload-token',
        }), {
          status: 202,
          headers: { 'content-type': 'application/json' },
        }))
      }
      if (path === `/api/runs/${runId}`) {
        if (init?.method === 'DELETE') {
          finishRequest('cancel')
          return Promise.resolve(new Response(null, { status: 204 }))
        }
        statusRequests += 1
        return Promise.resolve(new Response(JSON.stringify({
          runId,
          status: 'planning',
          checkpointStage: 'planning',
          ...(statusRequests > 120
            ? { visualDirections: [{ id: 'linework', query: '社区图书馆 线稿轴测图' }] }
            : {}),
        }), {
          headers: { 'content-type': 'application/json' },
        }))
      }
      if (path === `/api/runs/${runId}/visual-sources`) {
        finishRequest('upload')
        return Promise.resolve(new Response(null, { status: 204 }))
      }
      return Promise.reject(new Error(`unexpected request ${path}`))
    })
    const client = createPublicApiClient({
      indexedDB,
      databaseName: databaseName('slow-visual-planning'),
      fetch: fetchMock,
      clientSessionId: 'device-session-test',
      initialVerificationToken: 'verified-token',
      xiaohongshuResearch: vi.fn().mockResolvedValue([]),
    })
    const workspace = await client.createWorkspace({ name: '图纸研究' })

    await client.startResearch({
      workspaceId: workspace.id,
      question: '社区图书馆如何用线稿轴测图表达公共流线？',
      goal: 'visual_reference_search',
      mode: 'quick',
      researchSources: ['xiaohongshu'],
    })

    await expect(finished).resolves.toBe('upload')
    expect(statusRequests).toBe(121)
    client.close()
    timeout.mockRestore()
  })

  it('hydrates a completed cloud run into the full local result contract', async () => {
    const runId = '22222222-2222-4222-8222-222222222222'
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      runId,
      status: 'completed',
      goal: 'visual_reference_search',
      mode: 'quick',
      question: '山地文化馆剖面图表达',
      subquestions: [{
        id: 'section-style',
        question: '剖面层次如何表达？',
        rationale: '比较线型与色块层级',
      }],
      summary: '用主线宽和低饱和色块区分空间层次。',
      sections: [{
        id: 'section-style',
        title: '剖面层次如何表达？',
        facts: [{
          statement: '粗线强调剖切构件，浅色块标注公共空间。',
          sourceUrl: 'https://example.com/project',
          quote: 'Thick lines mark cut elements and pale fills identify public space.',
          sourceTitle: 'Mountain Culture Hall',
          imageUrl: 'https://example.com/section.jpg',
        }],
      }],
      coverage: {
        coverageSatisfied: true,
        enrichmentSatisfied: true,
        gaps: [],
      },
    }), {
      headers: { 'content-type': 'application/json' },
    }))
    const client = createPublicApiClient({
      indexedDB,
      databaseName: databaseName('hydrate'),
      fetch: fetchMock,
      clientSessionId: 'device-session-test',
      initialVerificationToken: 'verified-token',
    })

    const run = await client.getRun(runId)
    expect(run).toMatchObject({
      id: runId,
      goal: 'visual_reference_search',
      status: 'completed',
      subquestions: [{
        id: 'section-style',
        question: '方向 1：剖面层次如何表达',
        rationale: '比较线型与色块层级',
      }],
      coverageReport: {
        usable_assets: 1,
        covered_subquestions: 1,
      },
    })
    await expect(client.getResults(runId)).resolves.toEqual([
      expect.objectContaining({
        run_id: runId,
        project_name: 'Mountain Culture Hall',
        image_url: 'https://example.com/section.jpg',
        visual_reference: true,
        subquestion_ids: ['section-style'],
        evidence_claims: [
          expect.objectContaining({
            text_excerpt: expect.stringContaining('Thick lines'),
          }),
        ],
      }),
    ])
    client.close()
  })

  it('reopens a completed browser-local run after its cloud checkpoint has expired', async () => {
    const runId = '44444444-4444-4444-8444-444444444444'
    const name = databaseName('expired-checkpoint')
    const snapshot = {
      runId,
      workspaceId: 'workspace-history',
      status: 'completed',
      goal: 'precedent_research',
      mode: 'quick',
      question: '旧建筑入口如何形成公共性？',
      subquestions: [{
        id: 'entrance',
        question: '入口怎样连接城市与内部公共空间？',
        rationale: '比较入口序列与开放边界',
      }],
      summary: '用连续门廊把城市界面引入室内公共空间。',
      sections: [{
        id: 'entrance',
        title: '入口怎样连接城市与内部公共空间？',
        facts: [{
          statement: '连续门廊连接街道与首层公共空间。',
          sourceUrl: 'https://example.com/entrance',
          quote: 'A continuous arcade links the street with public rooms.',
        }],
      }],
      coverage: {
        coverageSatisfied: true,
        enrichmentSatisfied: true,
        gaps: [],
      },
    }
    const first = createPublicApiClient({
      indexedDB,
      databaseName: name,
      fetch: vi.fn().mockResolvedValue(new Response(JSON.stringify(snapshot), {
        headers: { 'content-type': 'application/json' },
      })),
      clientSessionId: 'device-session-test',
      initialVerificationToken: 'verified-token',
    })
    await first.getRun(runId)
    first.close()

    const reopened = createPublicApiClient({
      indexedDB,
      databaseName: name,
      fetch: vi.fn().mockResolvedValue(new Response(JSON.stringify({
        error: 'run_not_found',
      }), {
        status: 404,
        headers: { 'content-type': 'application/json' },
      })),
      clientSessionId: 'device-session-test',
      initialVerificationToken: 'verified-token',
    })

    await expect(reopened.getRun(runId)).resolves.toMatchObject({
      id: runId,
      status: 'completed',
      question: snapshot.question,
    })
    await expect(reopened.getResults(runId)).resolves.toHaveLength(1)
    reopened.close()
  })

  it('carries an attached PDF into the verified workflow instead of requiring local software', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      runId: '33333333-3333-4333-8333-333333333333',
      status: 'created',
    }), {
      status: 202,
      headers: { 'content-type': 'application/json' },
    }))
    const client = createPublicApiClient({
      indexedDB,
      databaseName: databaseName('brief'),
      fetch: fetchMock,
      clientSessionId: 'device-session-test',
      initialVerificationToken: 'verified-token',
    })
    const workspace = await client.createWorkspace({ name: '课程设计' })
    const file = new File(
      ['%PDF-1.7\nproject brief'],
      'project-brief.pdf',
      { type: 'application/pdf' },
    )
    const review = await client.reviewProjectBrief({
      workspaceId: workspace.id,
      question: '社区文化中心如何组织公共与后勤流线？',
      mode: 'balanced',
      file,
    })
    await client.startResearch({
      workspaceId: workspace.id,
      question: '社区文化中心如何组织公共与后勤流线？',
      goal: 'precedent_research',
      mode: 'balanced',
      subquestions: review.subquestions,
    })

    expect(review.filename).toBe('project-brief.pdf')
    expect(review.subquestions.length).toBeGreaterThan(0)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit
    expect(JSON.parse(String(request.body))).toMatchObject({
      briefFile: {
        filename: 'project-brief.pdf',
        dataUrl: expect.stringMatching(/^data:application\/pdf;base64,JVBER/),
      },
    })
    client.close()
  })
})
