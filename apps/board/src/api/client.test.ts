import { describe, expect, it, vi } from 'vitest'

import { ApiError, createApiClient } from './client'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('local API client', () => {
  it('lists and creates workspaces without inventing demo data', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([{ id: 'workspace-1', name: 'Studio' }]))
      .mockResolvedValueOnce(jsonResponse({ id: 'workspace-2', name: '竞赛工作区' }, 201))
    vi.stubGlobal('fetch', fetchMock)
    const client = createApiClient('/v1')

    expect(await client.listWorkspaces()).toEqual([{ id: 'workspace-1', name: 'Studio' }])
    expect(await client.createWorkspace({ name: '竞赛工作区', brief: '场馆更新' })).toEqual({
      id: 'workspace-2',
      name: '竞赛工作区',
    })
    expect(fetchMock.mock.calls[1]).toEqual([
      '/v1/workspaces',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: '竞赛工作区', brief: '场馆更新' }),
      }),
    ])
  })

  it('registers URL and file inputs before starting a run', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ id: 'url-input' }, 201))
      .mockResolvedValueOnce(jsonResponse({ id: 'file-input' }, 201))
      .mockResolvedValueOnce(
        jsonResponse({ id: 'run-2', status: 'created', budget_mode: 'balanced' }, 201),
      )
    vi.stubGlobal('fetch', fetchMock)
    const client = createApiClient('/v1')
    const file = new File(['drawing'], 'section.pdf', { type: 'application/pdf' })

    const run = await client.startResearch({
      workspaceId: 'workspace-live',
      question: '如何形成剖面层次？',
      referenceUrl: 'https://example.com/project',
      files: [file],
      goal: 'source_lookup',
      mode: 'balanced',
    })

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/v1/workspaces/workspace-live/inputs')
    expect(JSON.parse(String((fetchMock.mock.calls[0]?.[1] as RequestInit).body))).toEqual({
      url: 'https://example.com/project',
    })
    expect((fetchMock.mock.calls[1]?.[1] as RequestInit).body).toBeInstanceOf(FormData)
    expect(JSON.parse(String((fetchMock.mock.calls[2]?.[1] as RequestInit).body))).toEqual({
      question: '如何形成剖面层次？',
      goal: 'source_lookup',
      budget_mode: 'balanced',
    })
    expect(run).toMatchObject({ id: 'run-2', status: 'created', mode: 'balanced' })
  })

  it('throws a typed error instead of silently returning mock results', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ detail: 'Provider unavailable' }, 503)),
    )
    const client = createApiClient('/v1')

    await expect(client.listWorkspaces()).rejects.toEqual(
      expect.objectContaining<ApiError>({
        name: 'ApiError',
        status: 503,
        message: 'Provider unavailable',
      }),
    )
  })

  it('gets, cancels, and retries an existing run', async () => {
    const run = { id: 'run-1', status: 'searching', budget_mode: 'quick' }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(run))
      .mockResolvedValueOnce(jsonResponse({ ...run, status: 'cancelled' }))
      .mockResolvedValueOnce(jsonResponse({ ...run, status: 'created' }))
    vi.stubGlobal('fetch', fetchMock)
    const client = createApiClient('/v1')

    expect((await client.getRun('run-1')).status).toBe('searching')
    expect((await client.cancelRun('run-1')).status).toBe('cancelled')
    expect((await client.retryRun('run-1')).status).toBe('created')
    expect(fetchMock.mock.calls.map(([path]) => path)).toEqual([
      '/v1/runs/run-1',
      '/v1/runs/run-1/cancel',
      '/v1/runs/run-1/retry',
    ])
  })

  it('lists persisted workspace runs and normalizes their API fields', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse([
        {
          id: 'run-latest',
          workspace_id: 'workspace-live',
          question: '旧厂房如何植入新的公共功能？',
          goal: 'precedent_research',
          status: 'completed',
          budget_mode: 'quick',
          checkpoint_stage: 'composing',
        },
      ]),
    )
    vi.stubGlobal('fetch', fetchMock)
    const client = createApiClient('/v1')

    expect(await client.listRuns('workspace-live')).toEqual([
      expect.objectContaining({
        id: 'run-latest',
        workspaceId: 'workspace-live',
        question: '旧厂房如何植入新的公共功能？',
        goal: 'precedent_research',
        status: 'completed',
        mode: 'quick',
        checkpointStage: 'composing',
      }),
    ])
    expect(fetchMock).toHaveBeenCalledWith('/v1/workspaces/workspace-live/runs', undefined)
  })

  it('parses trace SSE history and run-scoped user state', async () => {
    const event = {
      id: 'trace-1',
      sequence: 1,
      stage: 'searching',
      tool: 'web_search',
      duration_ms: 120,
      cost_usd: 0.02,
      retry_count: 0,
      summary: '已完成第一批查询',
    }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(`event: trace\ndata: ${JSON.stringify(event)}\n\n`, {
          headers: { 'content-type': 'text/event-stream' },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          saved: [{ asset_candidate_id: 'asset-1', note: '保留剖面' }],
          rejected: [{ asset_candidate_id: 'asset-2', reason: '尺度不符' }],
        }),
      )
    vi.stubGlobal('fetch', fetchMock)
    const client = createApiClient('/v1')

    expect(await client.getEvents('run-1')).toEqual([event])
    expect(await client.getUserState('run-1')).toEqual({
      saved: [{ asset_candidate_id: 'asset-1', note: '保留剖面' }],
      rejected: [{ asset_candidate_id: 'asset-2', reason: '尺度不符' }],
    })
  })

  it('uses deterministic save, reject, undo, and board update endpoints', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse({ ok: true })))
    vi.stubGlobal('fetch', fetchMock)
    const client = createApiClient('/v1')

    await client.saveResult('asset-1', '重点比较首层')
    await client.unsaveResult('asset-1')
    await client.rejectResult('asset-1', '与当前尺度不符')
    await client.unrejectResult('asset-1')
    await client.updateBoard('run-1', ['asset-1', 'asset-2'])

    expect(fetchMock.mock.calls.map(([path, request]) => [path, (request as RequestInit).method])).toEqual([
      ['/v1/results/asset-1/save', 'POST'],
      ['/v1/results/asset-1/save', 'DELETE'],
      ['/v1/results/asset-1/reject', 'POST'],
      ['/v1/results/asset-1/reject', 'DELETE'],
      ['/v1/runs/run-1/board', 'PATCH'],
    ])
    expect(JSON.parse(String((fetchMock.mock.calls[0]?.[1] as RequestInit).body))).toEqual({
      note: '重点比较首层',
    })
    expect(JSON.parse(String((fetchMock.mock.calls[4]?.[1] as RequestInit).body))).toEqual({
      selected_asset_ids: ['asset-1', 'asset-2'],
    })
  })

  it('loads a style profile and returns null when it does not exist', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          id: 'style-1',
          board_id: 'board-1',
          palette: ['#315cf4'],
          line_weights: { primary: 1 },
          texture: 'none',
          font_category: 'sans',
          layout_notes: '',
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ detail: 'Style profile not found' }, 404))
    vi.stubGlobal('fetch', fetchMock)
    const client = createApiClient('/v1')

    expect((await client.getStyleProfile('board-1'))?.id).toBe('style-1')
    expect(await client.getStyleProfile('board-2')).toBeNull()
  })

  it('creates a style profile after a missing PATCH and returns export metadata', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ detail: 'Style profile not found' }, 404))
      .mockResolvedValueOnce(jsonResponse({ id: 'style-1', board_id: 'board-1' }, 201))
      .mockResolvedValueOnce(
        jsonResponse({
          id: 'export-1',
          board_id: 'board-1',
          mode: 'private',
          path: 'C:/exports/board.json',
          item_count: 2,
        }, 201),
      )
    vi.stubGlobal('fetch', fetchMock)
    const client = createApiClient('/v1')
    const profile = {
      palette: ['#315cf4'],
      line_weights: { primary: 1, secondary: 0.35 },
      texture: 'none',
      font_category: 'sans',
      layout_notes: '证据栏固定在图纸右侧',
    }

    expect(await client.saveStyleProfile('board-1', profile)).toMatchObject({ id: 'style-1' })
    expect(await client.exportBoard('board-1', 'private')).toMatchObject({
      path: 'C:/exports/board.json',
      item_count: 2,
    })
  })
})
