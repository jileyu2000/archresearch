import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import App from './App'
import { BrowserBridgeError, requestBrowserBridge } from './browserBridge'

vi.mock('./browserBridge', async (importOriginal) => ({
  ...await importOriginal<typeof import('./browserBridge')>(),
  requestBrowserBridge: vi.fn(),
}))

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

const workspace = {
  id: 'workspace-live',
  name: '真实工作区',
  brief: '旧建筑更新',
  constraints: [],
}

const candidate = {
  id: 'asset-live',
  run_id: 'run-live',
  project_name: 'Live Mill Conversion',
  asset_type: 'section',
  source_url: 'https://example.com/live-mill',
  image_url: null,
  publication_tier: 'primary',
  project_identity: 'confirmed',
  asset_association: 'confirmed',
  primary_source: 'confirmed',
  rights_status: 'open_license',
  result_tier: 'verified',
  relevance: 4,
  subquestion_ids: ['program'],
  project_context: '旧厂房保留主结构，并植入新的公共使用层。',
  design_mechanism: '新公共层穿过原有框架，通过竖向交通核连接首层与上部空间。',
  transfer_strategy: ['先标出现有结构不可改动范围', '再将公共层与服务核作为独立系统植入'],
  facts: ['事务所项目页确认了改造范围。'],
  observations: ['剖面显示公共层从旧结构中穿过。'],
  inferences: ['可把公共层作为人车分流的垂直缓冲。'],
  limitations: ['需要核对现有结构承载力。'],
  rank_index: 0,
  evidence_claims: [
    {
      id: 'claim-1',
      asset_candidate_id: 'asset-live',
      claim_type: 'fact',
      statement: '事务所项目页确认了改造范围。',
      source_url: 'https://example.com/live-mill#drawing',
      pdf_page: 12,
      text_excerpt: 'Existing structure retained and adapted.',
      image_region: { x: 0.1, y: 0.2, width: 0.4, height: 0.3 },
    },
  ],
}

interface LiveFetchOptions {
  initialStatus?: string
  pollStatuses?: string[]
  hasLocalContent?: boolean
  selectedIds?: string[]
  saved?: Array<{ asset_candidate_id: string; note: string }>
  rejected?: Array<{ asset_candidate_id: string; reason: string }>
  saveFails?: boolean
  styleProfile?: Record<string, unknown> | null
  existingRunStatus?: string | null
  subquestions?: typeof liveSubquestions
  candidateOverrides?: Record<string, unknown>
  candidates?: Array<Record<string, unknown>>
  goal?: 'precedent_research' | 'visual_reference_search'
  eventSummary?: unknown
  eventTool?: string
  browserConnected?: boolean
  xiaohongshuSearchAvailable?: boolean
  browserStatuses?: boolean[]
  pollCoverageReport?: Record<string, unknown>
  pairingCode?: string
  coverageReport?: Record<string, unknown>
  stopReason?: string
  existingRuns?: Array<Record<string, unknown>>
  runsByWorkspace?: Record<string, Array<Record<string, unknown>>>
  collections?: Array<Record<string, unknown>>
  briefReview?: Record<string, unknown>
  workspaces?: Array<Record<string, unknown>>
}

const liveQuestion = '旧厂房如何植入新的公共功能？'
const liveSubquestions = [
  { id: 'program', question: '新功能怎样进入旧结构？', rationale: '识别保留与植入的空间关系' },
]
const visualDirectionSubquestions = [
  { id: 'linework-style', question: '精细线稿剖面图', rationale: '比较线宽、虚实和留白' },
  { id: 'collage-style', question: '拼贴叙事剖面图', rationale: '比较色块、人物和材质层次' },
  { id: 'rendered-style', question: '材质渲染剖面图', rationale: '比较光影、纹理和空间深度' },
]
const visualCandidateOverrides = {
  source_url: 'https://www.xiaohongshu.com/explore/note-tools',
  result_tier: 'visual_lead' as const,
  asset_type: 'section' as const,
  subquestion_ids: ['linework-style'],
  publication_tier: 'aggregator' as const,
  rights_status: 'unknown' as const,
}

function createLiveFetch(options: LiveFetchOptions = {}) {
  let pollIndex = 0
  let browserStatusIndex = 0
  const initialStatus = options.initialStatus ?? 'completed'
  const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input)
    const method = init?.method ?? 'GET'

    if (path === '/v1/browser/status' && method === 'GET') {
      const statuses = options.browserStatuses
      const connected = statuses && statuses.length > 0
        ? statuses[Math.min(browserStatusIndex++, statuses.length - 1)]
        : options.browserConnected ?? true
      return Promise.resolve(jsonResponse({
        connected,
        xiaohongshu_search_available: options.xiaohongshuSearchAvailable ?? false,
      }))
    }
    if (path === '/v1/browser/pairing-code' && method === 'POST') {
      return Promise.resolve(jsonResponse({
        code: options.pairingCode ?? '482917',
        expires_in_seconds: 300,
      }, 201))
    }
    if (path === '/v1/browser/open-chrome' && method === 'POST') {
      return Promise.resolve(jsonResponse({ opened: true }))
    }
    if (path === '/v1/data-backups' && method === 'POST') {
      return Promise.resolve(new Response(new Blob(['backup']), {
        headers: {
          'content-type': 'application/zip',
          'content-disposition': 'attachment; filename="archresearch-backup.zip"',
        },
      }))
    }
    if (path === '/v1/data-backups/preflight' && method === 'POST') {
      return Promise.resolve(jsonResponse({
        ready: true,
        format_version: 1,
        schema_revision: 'd0f1a2b3c4d5',
        file_count: 5,
        total_bytes: 4096,
        categories: { database: 1, runs: 1, collections: 1, workspaces: 1, exports: 1 },
        workspace_count: 1,
        run_count: 2,
        collection_count: 3,
        input_artifact_count: 1,
      }))
    }
    if (path === '/v1/data-backups/restore' && method === 'POST') {
      return Promise.resolve(jsonResponse({
        ready: true,
        restored: true,
        format_version: 1,
        schema_revision: 'd0f1a2b3c4d5',
        file_count: 5,
        total_bytes: 4096,
        categories: { database: 1, runs: 1, collections: 1, workspaces: 1, exports: 1 },
        workspace_count: 1,
        run_count: 2,
        collection_count: 3,
        input_artifact_count: 1,
        rollback_backup: 'archresearch-rollback.zip',
      }))
    }
    if (path === '/v1/workspaces' && method === 'GET') {
      return Promise.resolve(jsonResponse(options.workspaces ?? [workspace]))
    }
    if (path === '/v1/workspaces' && method === 'POST') {
      return Promise.resolve(jsonResponse({ ...workspace, id: 'workspace-new', name: '新工作区' }, 201))
    }
    if (path === '/v1/workspaces/default' && method === 'POST') {
      return Promise.resolve(jsonResponse({
        ...workspace,
        id: 'workspace-default',
        name: '建筑研究工作区',
      }))
    }
    if (path.startsWith('/v1/workspaces/') && path.endsWith('/archive') && method === 'POST') {
      const workspaceId = path.split('/')[3]
      const current = (options.workspaces ?? [workspace]).find((item) => item.id === workspaceId) ?? workspace
      return Promise.resolve(jsonResponse({ ...current, archived_at: '2026-07-24T08:00:00Z' }))
    }
    if (path.startsWith('/v1/workspaces/') && path.endsWith('/restore') && method === 'POST') {
      const workspaceId = path.split('/')[3]
      const current = (options.workspaces ?? [workspace]).find((item) => item.id === workspaceId) ?? workspace
      return Promise.resolve(jsonResponse({ ...current, archived_at: null }))
    }
    if (path === '/v1/workspaces/workspace-live/collections' && method === 'GET') {
      return Promise.resolve(jsonResponse(options.collections ?? []))
    }
    if (path === '/v1/workspaces/workspace-live/brief-review' && method === 'POST') {
      return Promise.resolve(jsonResponse(options.briefReview ?? {
        filename: '2024 研一概念设计-窦平平.pdf',
        page_count: 3,
        project_summary: '苏州科技馆蚕桑丝织文化智慧博物馆概念设计',
        project_boundaries: [
          '以《耕织图》为载体研究蚕桑丝织文化',
          '分析二维—三维—四维关系',
          '结合虚实空间、感知与交互方式',
        ],
        subquestions: [
          { id: 'process_sequence', question: '工序如何成为参观序列？', rationale: '把劳动流程转成空间顺序。' },
          { id: 'gallery_syntax', question: '长廊如何成为空间语法？', rationale: '提取长廊与分段关系。' },
          { id: 'actor_tool_space', question: '人物、器具与场所如何形成互动节点？', rationale: '提取行为关系。' },
          { id: 'four_dimensional', question: '二维叙事如何形成四维体验？', rationale: '加入时间与交互。' },
        ],
      }))
    }
    if (path === '/v1/workspaces/workspace-live/inputs' && method === 'POST') {
      return Promise.resolve(jsonResponse({ id: 'input-live' }, 201))
    }
    if (path.startsWith('/v1/collections/') && method === 'DELETE') {
      return Promise.resolve(new Response(null, { status: 204 }))
    }
    if (path === '/v1/workspaces/workspace-live/runs' && method === 'POST') {
      return Promise.resolve(
        jsonResponse(
          {
            id: 'run-live',
            workspace_id: 'workspace-live',
            question: liveQuestion,
            subquestions: options.subquestions ?? liveSubquestions,
            goal: options.goal ?? 'precedent_research',
            status: initialStatus,
            budget_mode: 'balanced',
            coverage_report: options.coverageReport ?? (
              initialStatus === 'partial'
                ? {
                    usable_assets: 1,
                    project_count: 1,
                    verified_or_partial: 1,
                    gaps: ['fewer_than_six_usable_assets'],
                  }
                : {}),
            stop_reason: initialStatus === 'partial' ? options.stopReason ?? 'budget_exhausted' : null,
          },
          201,
        ),
      )
    }
    if (path === '/v1/workspaces/workspace-live/runs' && method === 'GET') {
      return Promise.resolve(
        jsonResponse(
          options.runsByWorkspace?.['workspace-live'] ?? options.existingRuns ?? (options.existingRunStatus
            ? [
                {
                  id: 'run-live',
                  workspace_id: 'workspace-live',
                  question: liveQuestion,
                  subquestions: options.subquestions ?? liveSubquestions,
                  goal: options.goal ?? 'precedent_research',
                  status: options.existingRunStatus,
                  budget_mode: 'balanced',
                  checkpoint_stage: options.existingRunStatus,
                  coverage_report: options.coverageReport ?? (
                    options.existingRunStatus === 'partial'
                      ? {
                          usable_assets: 1,
                          project_count: 1,
                          verified_or_partial: 1,
                          gaps: ['insufficient_usable_assets'],
                        }
                      : {}),
                  stop_reason: options.existingRunStatus === 'partial'
                    ? options.stopReason ?? 'budget_exhausted'
                    : null,
                  created_at: '2026-07-13T08:30:00Z',
                },
              ]
            : []),
        ),
      )
    }
    if (path === '/v1/workspaces/workspace-history/runs' && method === 'GET') {
      return Promise.resolve(jsonResponse(options.runsByWorkspace?.['workspace-history'] ?? []))
    }
    if (path.startsWith('/v1/workspaces/') && path.endsWith('/runs') && method === 'GET') {
      const workspaceId = path.split('/')[3]
      return Promise.resolve(jsonResponse(options.runsByWorkspace?.[workspaceId] ?? []))
    }
    if (path.startsWith('/v1/runs/run-history-') && path.endsWith('/retention') && method === 'PATCH') {
      const runId = path.split('/')[3]
      const current = options.existingRuns?.find((run) => run.id === runId)
      const permanent = Boolean(JSON.parse(String(init?.body)).permanent)
      return Promise.resolve(jsonResponse({
        ...current,
        keep_forever: permanent,
        retention_expires_at: permanent ? null : '2026-08-04T08:30:00Z',
      }))
    }
    if (path === '/v1/runs/run-live' && method === 'GET') {
      const statuses = options.pollStatuses ?? [initialStatus]
      const status = statuses[Math.min(pollIndex, statuses.length - 1)]
      pollIndex += 1
      return Promise.resolve(
        jsonResponse({
          id: 'run-live',
          workspace_id: 'workspace-live',
          question: liveQuestion,
          subquestions: options.subquestions ?? liveSubquestions,
          goal: options.goal ?? 'precedent_research',
          status,
          budget_mode: 'balanced',
          coverage_report: options.pollCoverageReport ?? options.coverageReport ?? (
            status === 'partial'
              ? {
                  usable_assets: 1,
                  project_count: 1,
                  verified_or_partial: 1,
                  gaps: ['fewer_than_six_usable_assets'],
                }
              : {}),
          stop_reason: status === 'partial' ? options.stopReason ?? 'budget_exhausted' : null,
        }),
      )
    }
    if (path === '/v1/runs/run-live/cancel' && method === 'POST') {
      return Promise.resolve(
        jsonResponse({
          id: 'run-live',
          workspace_id: 'workspace-live',
          question: liveQuestion,
          subquestions: options.subquestions ?? liveSubquestions,
          goal: 'precedent_research',
          status: 'cancelled',
          budget_mode: 'balanced',
        }),
      )
    }
    if (path === '/v1/runs/run-live/retry' && method === 'POST') {
      return Promise.resolve(jsonResponse({
        id: 'run-live',
        workspace_id: 'workspace-live',
        question: liveQuestion,
        goal: 'precedent_research',
        status: 'created',
        budget_mode: 'balanced',
      }))
    }
    if (path === '/v1/runs/run-live/results') {
      return Promise.resolve(
        jsonResponse(options.candidates ?? [{
            ...candidate,
            ...options.candidateOverrides,
            has_local_content: options.hasLocalContent ?? false,
          }]),
      )
    }
    if (path === '/v1/runs/run-live/board' && method === 'GET') {
      return Promise.resolve(
        jsonResponse({
          id: 'board-live',
          run_id: 'run-live',
          selected_asset_ids: options.selectedIds ?? [],
          layout: 'grid',
          notes: '',
        }),
      )
    }
    if (path === '/v1/runs/run-live/board' && method === 'PATCH') {
      const body = JSON.parse(String(init?.body)) as { selected_asset_ids: string[] }
      return Promise.resolve(
        jsonResponse({ id: 'board-live', run_id: 'run-live', ...body, layout: 'grid', notes: '' }),
      )
    }
    if (path === '/v1/runs/run-live/user-state') {
      return Promise.resolve(
        jsonResponse({ saved: options.saved ?? [], rejected: options.rejected ?? [] }),
      )
    }
    if (path === '/v1/runs/run-live/events') {
      return Promise.resolve(
        new Response(
          `event: trace\ndata: ${JSON.stringify({
            id: 'trace-live',
            sequence: 1,
            stage: 'searching',
            tool: options.eventTool ?? 'web_search',
            duration_ms: 120,
            cost_usd: 0.02,
            retry_count: 0,
            summary: options.eventSummary ?? '已完成实时网页查询',
          })}\n\n`,
          { headers: { 'content-type': 'text/event-stream' } },
        ),
      )
    }
    if (path === '/v1/boards/board-live/style-profile' && method === 'GET') {
      if (options.styleProfile) return Promise.resolve(jsonResponse(options.styleProfile))
      return Promise.resolve(jsonResponse({ detail: 'Style profile not found' }, 404))
    }
    if (path === '/v1/boards/board-live/style-profile' && method === 'PATCH') {
      return Promise.resolve(jsonResponse({ id: 'style-live', board_id: 'board-live' }))
    }
    if (path.startsWith('/v1/results/') && path.endsWith('/save') && method === 'POST') {
      if (options.saveFails) return Promise.resolve(jsonResponse({ detail: '保存失败' }, 503))
      const assetId = path.split('/')[3]
      const savedCandidate = (options.candidates ?? [candidate]).find((item) => item.id === assetId) ?? candidate
      return Promise.resolve(jsonResponse({
        id: `collection-${assetId}`,
        workspace_id: 'workspace-live',
        asset_candidate_id: assetId,
        source_url: savedCandidate.source_url,
        note: '',
        snapshot: {
          question: liveQuestion,
          goal: options.goal ?? 'precedent_research',
          project_name: savedCandidate.project_name,
          asset_type: savedCandidate.asset_type,
        },
        created_at: '2026-07-21T08:00:00Z',
      }, 201))
    }
    if (path === '/v1/results/asset-live/save' && method === 'DELETE') {
      return Promise.resolve(new Response(null, { status: 204 }))
    }
    if (path === '/v1/results/asset-live/reject' && method === 'POST') {
      return Promise.resolve(jsonResponse({ asset_candidate_id: 'asset-live' }, 201))
    }
    if (path === '/v1/results/asset-live/reject' && method === 'DELETE') {
      return Promise.resolve(new Response(null, { status: 204 }))
    }
    if (path === '/v1/boards/board-live/exports' && method === 'POST') {
      const body = JSON.parse(String(init?.body)) as { mode: string }
      return Promise.resolve(
        jsonResponse(
          {
            id: 'export-live',
            board_id: 'board-live',
            mode: body.mode,
            path: `C:/exports/board-${body.mode}.html`,
            browser_url: `http://127.0.0.1:8000/v1/boards/board-live/exports/export-live/${body.mode}`,
            manifest_path: `C:/exports/board-${body.mode}-sources.json`,
            item_count: 1,
          },
          201,
        ),
      )
    }
    return Promise.reject(new TypeError(`Unexpected request: ${method} ${path}`))
  })
  return fetchMock
}

function createWorkspaceRaceFetch() {
  let releaseHydration = () => {}
  const hydrationGate = new Promise<void>((resolve) => {
    releaseHydration = resolve
  })
  const secondWorkspace = { ...workspace, id: 'workspace-two', name: '第二工作区' }
  const latestRun = {
    id: 'run-latest',
    workspace_id: 'workspace-live',
    question: '已完成的新任务',
    goal: 'precedent_research',
    status: 'completed',
    budget_mode: 'balanced',
  }
  const oldRun = {
    id: 'run-old',
    workspace_id: 'workspace-live',
    question: '仍在运行的旧任务',
    goal: 'precedent_research',
    status: 'searching',
    budget_mode: 'quick',
  }
  const delayed = (response: Response) => hydrationGate.then(() => response)
  const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
    const path = String(input)
    if (path === '/v1/workspaces') return Promise.resolve(jsonResponse([workspace, secondWorkspace]))
    if (path === '/v1/workspaces/workspace-live/runs') {
      return Promise.resolve(jsonResponse([latestRun, oldRun]))
    }
    if (path === '/v1/workspaces/workspace-two/runs') return Promise.resolve(jsonResponse([]))
    if (path === '/v1/runs/run-old/results') return delayed(jsonResponse([]))
    if (path === '/v1/runs/run-old/board') {
      return delayed(jsonResponse({ id: 'board-old', run_id: 'run-old', selected_asset_ids: [] }))
    }
    if (path === '/v1/runs/run-old/user-state') {
      return delayed(jsonResponse({ saved: [], rejected: [] }))
    }
    if (path === '/v1/runs/run-old/events') {
      return delayed(new Response('', { headers: { 'content-type': 'text/event-stream' } }))
    }
    if (path === '/v1/runs/run-old') {
      return Promise.resolve(jsonResponse({ ...oldRun, status: 'completed' }))
    }
    return Promise.reject(new TypeError(`Unexpected request: GET ${path}`))
  })
  return { fetchMock, releaseHydration }
}

function createSubmitRaceFetch(fail = false) {
  let releaseStart = () => {}
  const startGate = new Promise<void>((resolve) => {
    releaseStart = resolve
  })
  const secondWorkspace = { ...workspace, id: 'workspace-two', name: '第二工作区' }
  const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input)
    const method = init?.method ?? 'GET'
    if (path === '/v1/browser/status' && method === 'GET') {
      return Promise.resolve(jsonResponse({ connected: true }))
    }
    if (path === '/v1/workspaces' && method === 'GET') {
      return Promise.resolve(jsonResponse([workspace]))
    }
    if (path === '/v1/workspaces' && method === 'POST') {
      return Promise.resolve(jsonResponse(secondWorkspace, 201))
    }
    if (path === '/v1/workspaces/workspace-live/runs' && method === 'GET') {
      return Promise.resolve(jsonResponse([]))
    }
    if (path === '/v1/workspaces/workspace-two/runs' && method === 'GET') {
      return Promise.resolve(jsonResponse([]))
    }
    if (path === '/v1/workspaces/workspace-live/runs' && method === 'POST') {
      return startGate.then(() => {
        if (fail) throw new TypeError('旧工作区请求失败')
        return jsonResponse({
          id: 'run-old-workspace',
          workspace_id: 'workspace-live',
          question: '来自旧工作区的请求',
          goal: 'precedent_research',
          status: 'searching',
          budget_mode: 'balanced',
        }, 201)
      })
    }
    return Promise.reject(new TypeError(`Unexpected request: ${method} ${path}`))
  })
  return { fetchMock, releaseStart, startGate }
}

function createPollingWorkspaceRaceFetch() {
  let releasePoll = () => {}
  const pollGate = new Promise<void>((resolve) => {
    releasePoll = resolve
  })
  const secondWorkspace = { ...workspace, id: 'workspace-two', name: '第二工作区' }
  const activeRun = {
    id: 'run-polling',
    workspace_id: 'workspace-live',
    question: '旧工作区正在研究的任务',
    goal: 'precedent_research',
    status: 'searching',
    budget_mode: 'balanced',
  }
  const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input)
    const method = init?.method ?? 'GET'
    if (path === '/v1/workspaces') return Promise.resolve(jsonResponse([workspace, secondWorkspace]))
    if (path === '/v1/workspaces/workspace-live/runs') return Promise.resolve(jsonResponse([activeRun]))
    if (path === '/v1/workspaces/workspace-two/runs') return Promise.resolve(jsonResponse([]))
    if (path === '/v1/runs/run-polling/results') return Promise.resolve(jsonResponse([]))
    if (path === '/v1/runs/run-polling/board') {
      return Promise.resolve(jsonResponse({ id: 'board-polling', run_id: 'run-polling', selected_asset_ids: [] }))
    }
    if (path === '/v1/runs/run-polling/user-state') {
      return Promise.resolve(jsonResponse({ saved: [], rejected: [] }))
    }
    if (path === '/v1/runs/run-polling/events') {
      return Promise.resolve(new Response('', { headers: { 'content-type': 'text/event-stream' } }))
    }
    if (path === '/v1/boards/board-polling/style-profile') {
      return Promise.resolve(jsonResponse({ detail: 'Style profile not found' }, 404))
    }
    if (path === '/v1/runs/run-polling/cancel' && method === 'POST') {
      return Promise.resolve(jsonResponse({ ...activeRun, status: 'cancelled' }))
    }
    if (path === '/v1/runs/run-polling') {
      return pollGate.then(() => jsonResponse({ ...activeRun, status: 'completed' }))
    }
    return Promise.reject(new TypeError(`Unexpected request: GET ${path}`))
  })
  return { fetchMock, releasePoll, pollGate }
}

function createTerminalSubmitHydrationRaceFetch() {
  let releaseHydration = () => {}
  const hydrationGate = new Promise<void>((resolve) => {
    releaseHydration = resolve
  })
  const secondWorkspace = { ...workspace, id: 'workspace-two', name: '第二工作区' }
  const completedRun = {
    id: 'run-terminal-submit',
    workspace_id: 'workspace-live',
    question: '即时完成的旧工作区任务',
    goal: 'precedent_research',
    status: 'completed',
    budget_mode: 'balanced',
  }
  const delayed = (response: Response) => hydrationGate.then(() => response)
  const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input)
    const method = init?.method ?? 'GET'
    if (path === '/v1/browser/status' && method === 'GET') {
      return Promise.resolve(jsonResponse({ connected: true }))
    }
    if (path === '/v1/workspaces' && method === 'GET') return Promise.resolve(jsonResponse([workspace]))
    if (path === '/v1/workspaces' && method === 'POST') {
      return Promise.resolve(jsonResponse(secondWorkspace, 201))
    }
    if (path === '/v1/workspaces/workspace-live/runs' && method === 'GET') return Promise.resolve(jsonResponse([]))
    if (path === '/v1/workspaces/workspace-two/runs' && method === 'GET') return Promise.resolve(jsonResponse([]))
    if (path === '/v1/workspaces/workspace-live/runs' && method === 'POST') {
      return Promise.resolve(jsonResponse(completedRun, 201))
    }
    if (path === '/v1/runs/run-terminal-submit/results') return delayed(jsonResponse([]))
    if (path === '/v1/runs/run-terminal-submit/board') {
      return delayed(jsonResponse({ id: 'board-terminal-submit', run_id: 'run-terminal-submit', selected_asset_ids: [] }))
    }
    if (path === '/v1/runs/run-terminal-submit/user-state') {
      return delayed(jsonResponse({ saved: [], rejected: [] }))
    }
    if (path === '/v1/runs/run-terminal-submit/events') {
      return delayed(new Response('', { headers: { 'content-type': 'text/event-stream' } }))
    }
    return Promise.reject(new TypeError(`Unexpected request: ${method} ${path}`))
  })
  return { fetchMock, releaseHydration, hydrationGate }
}

function renderBoard(search = '', edition: 'local' | 'public' = 'local') {
  window.history.replaceState({}, '', `/${search}`)
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <App edition={edition} />
    </QueryClientProvider>,
  )
}

async function startLiveResearch(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByText('真实工作区')
  await user.type(screen.getByRole('textbox', { name: '研究问题' }), '旧厂房如何植入展厅？')
  await user.click(screen.getByRole('button', { name: '开始研究' }))
}

async function startVisualResearch(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByText('真实工作区')
  await user.click(screen.getByRole('button', { name: /图纸灵感.*配色、线型、版式与分析图/ }))
  await user.type(screen.getByRole('textbox', { name: '研究问题' }), '帮我找几种剖面图风格')
  await user.click(screen.getByRole('button', { name: '查找灵感' }))
}

async function createProjectFromHome(
  user: ReturnType<typeof userEvent.setup>,
  name = '第二工作区',
) {
  await user.click(screen.getByRole('button', { name: '新建项目' }))
  await user.type(screen.getByRole('textbox', { name: '项目名称' }), name)
  await user.click(screen.getByRole('button', { name: '创建项目' }))
  await waitFor(() => {
    expect(window.localStorage.getItem('archresearch.activeWorkspaceId')).toBe('workspace-two')
  })
}

async function openCaseInventories(
  user: ReturnType<typeof userEvent.setup>,
  root: ParentNode = document,
) {
  const inventories = [...root.querySelectorAll<HTMLDetailsElement>('details.case-inventory')]
  for (const inventory of inventories) {
    if (inventory.open) continue
    const summary = inventory.querySelector('summary')
    if (summary) await user.click(summary)
  }
}

describe('research board', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')))
    vi.mocked(requestBrowserBridge).mockReset().mockResolvedValue({
      paired: true,
      connection: 'connected',
      researchPermission: true,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    window.history.replaceState({}, '', '/')
    vi.restoreAllMocks()
  })

  it('answers backup status first, checks a chosen file automatically, and restores only after an explicit replace confirmation', async () => {
    const user = userEvent.setup()
    const fetchMock = createLiveFetch()
    vi.stubGlobal('fetch', fetchMock)
    const createObjectURL = vi.fn(() => 'blob:workspace-backup')
    const revokeObjectURL = vi.fn()
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL })
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    renderBoard()

    await user.click(await screen.findByRole('button', { name: '备份与恢复' }))
    expect(screen.getByRole('heading', { name: '备份与恢复' })).toBeInTheDocument()
    expect(screen.getByText('数据保存在这台电脑上。定期下载备份，需要时可恢复到备份时的状态。')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '备份数据' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '恢复数据' })).toBeInTheDocument()
    expect(screen.queryByText(/换电脑或重装之前/)).not.toBeInTheDocument()
    expect(screen.queryByText(/在新电脑上，或者出事之后/)).not.toBeInTheDocument()

    // Status precedes actions: current data, this-browser download record, honest manual mode.
    expect(screen.getByText('最近备份')).toBeInTheDocument()
    expect(screen.getByText(/这个浏览器里还没有下载记录/)).toBeInTheDocument()
    expect(screen.getByText(/手动备份；包含项目、研究记录、收藏和任务书/)).toBeInTheDocument()
    expect(screen.getByText(/服务配置和登录信息/)).toBeInTheDocument()
    expect(screen.getByText('恢复会替换当前全部数据，不会合并。')).toBeInTheDocument()
    expect(screen.getByText('选择文件后会先检查，不会修改当前数据。')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '下载备份' }))
    await waitFor(() => expect(createObjectURL).toHaveBeenCalledTimes(1))
    expect(await screen.findByText(/已下载。记得把文件挪到移动硬盘或网盘/)).toBeInTheDocument()
    const record = JSON.parse(window.localStorage.getItem('archresearch.lastBackupDownload') ?? 'null') as { at: string; bytes: number }
    expect(record.bytes).toBeGreaterThan(0)
    expect(Date.parse(record.at)).not.toBeNaN()
    expect(screen.getByText(/仅此浏览器/)).toBeInTheDocument()

    // Choosing a file starts the check automatically — no separate check button, no jargon.
    expect(screen.queryByRole('button', { name: '检查备份包' })).not.toBeInTheDocument()
    const file = new File(['backup'], 'workspace.zip', { type: 'application/zip' })
    await user.upload(screen.getByLabelText('选择备份文件（.zip）'), file)

    expect(await screen.findByText('检查通过，可以恢复')).toBeInTheDocument()
    expect(screen.getByText('1 个项目')).toBeInTheDocument()
    expect(screen.getByText('2 条研究记录')).toBeInTheDocument()
    expect(screen.getByText('3 项个人收藏')).toBeInTheDocument()
    expect(screen.getByText(/恢复后，现在的 1 个项目、0 条研究记录会换成这份备份里的内容/)).toBeInTheDocument()

    // The danger action names its consequence and still requires one inline confirmation.
    await user.click(screen.getByRole('button', { name: '替换当前数据并恢复' }))
    expect(screen.getByText(/真的要替换吗/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '取消' }))
    expect(screen.queryByText(/真的要替换吗/)).not.toBeInTheDocument()
    expect(fetchMock.mock.calls.some(([input]) => String(input).includes('/data-backups/restore'))).toBe(false)

    await user.click(screen.getByRole('button', { name: '替换当前数据并恢复' }))
    await user.click(screen.getByRole('button', { name: '确定替换' }))
    expect(await screen.findByText(/恢复完成，现在的数据就是这份备份里的内容/)).toBeInTheDocument()

    const dataCalls = fetchMock.mock.calls.filter(([input]) => String(input).includes('/data-backups'))
    expect(dataCalls.map(([input]) => String(input))).toEqual([
      '/v1/data-backups',
      '/v1/data-backups/preflight',
      '/v1/data-backups/restore',
    ])
  })

  it('flags an overdue this-browser backup record without overclaiming other machines', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', createLiveFetch())
    const twentyDaysAgo = new Date(Date.now() - 20 * 86400000).toISOString()
    window.localStorage.setItem(
      'archresearch.lastBackupDownload',
      JSON.stringify({ at: twentyDaysAgo, bytes: 48234496 }),
    )
    renderBoard()

    await user.click(await screen.findByRole('button', { name: '备份与恢复' }))
    expect(screen.getByText(/此浏览器已有 20 天未下载/)).toBeInTheDocument()
    expect(screen.getByText(/若未在别处备份/)).toBeInTheDocument()
    expect(screen.getByText(/46\.0 MB/)).toBeInTheDocument()
  })

  it('shows a pending submit state while the research run is being created', async () => {
    const user = userEvent.setup()
    const fetchMock = createLiveFetch()
    const passThrough = fetchMock.getMockImplementation()!
    let releaseStart!: () => void
    const startGate = new Promise<void>((resolve) => { releaseStart = resolve })
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === '/v1/workspaces/workspace-live/runs' && init?.method === 'POST') {
        return startGate.then(() => passThrough(input, init))
      }
      return passThrough(input, init)
    })
    vi.stubGlobal('fetch', fetchMock)
    renderBoard()

    await screen.findByText('真实工作区')
    await user.type(screen.getByRole('textbox', { name: '研究问题' }), '旧厂房如何植入展厅？')
    await user.click(screen.getByRole('button', { name: '开始研究' }))

    const pending = await screen.findByRole('button', { name: '正在创建研究…' })
    expect(pending).toBeDisabled()

    releaseStart()
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: '正在创建研究…' })).not.toBeInTheDocument()
    })
  })

  it('surfaces a research start failure next to the submit button', async () => {
    const user = userEvent.setup()
    const fetchMock = createLiveFetch()
    const passThrough = fetchMock.getMockImplementation()!
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === '/v1/workspaces/workspace-live/runs' && init?.method === 'POST') {
        return Promise.resolve(new Response(JSON.stringify({ detail: '本地服务暂时不可用' }), {
          status: 503,
          headers: { 'content-type': 'application/json' },
        }))
      }
      return passThrough(input, init)
    })
    vi.stubGlobal('fetch', fetchMock)
    renderBoard()

    await screen.findByText('真实工作区')
    await user.type(screen.getByRole('textbox', { name: '研究问题' }), '旧厂房如何植入展厅？')
    await user.click(screen.getByRole('button', { name: '开始研究' }))

    const formError = await screen.findByRole('alert')
    expect(formError).toHaveTextContent('本地服务暂时不可用')
    expect(formError.closest('form')).not.toBeNull()
    expect(screen.getByRole('button', { name: '开始研究' })).toBeEnabled()
  })

  it('reports a failed backup check without touching current data or exposing a restore action', async () => {
    const user = userEvent.setup()
    const fetchMock = createLiveFetch()
    const passThrough = fetchMock.getMockImplementation()!
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === '/v1/data-backups/preflight') {
        return Promise.resolve(new Response(JSON.stringify({ detail: '备份包缺少必需文件' }), {
          status: 422,
          headers: { 'content-type': 'application/json' },
        }))
      }
      return passThrough(input, init)
    })
    vi.stubGlobal('fetch', fetchMock)
    renderBoard()

    await user.click(await screen.findByRole('button', { name: '备份与恢复' }))
    const file = new File(['broken'], 'broken.zip', { type: 'application/zip' })
    await user.upload(screen.getByLabelText('选择备份文件（.zip）'), file)

    const failure = await screen.findByRole('alert')
    expect(failure).toHaveTextContent('这份文件没有通过检查')
    expect(failure).toHaveTextContent('当前数据没有任何改动')
    expect(screen.queryByRole('button', { name: '替换当前数据并恢复' })).not.toBeInTheDocument()
  })

  it('keeps one decorative studio canvas behind both home and result routes', () => {
    const home = renderBoard()
    const homeBackdrop = screen.getByTestId('studio-backdrop')
    expect(homeBackdrop).toHaveAttribute('aria-hidden', 'true')
    expect(homeBackdrop).toHaveAttribute('data-view', 'home')
    expect(homeBackdrop.querySelectorAll('svg')).toHaveLength(2)

    home.unmount()
    renderBoard('?demo=1')
    const resultBackdrop = screen.getByTestId('studio-backdrop')
    expect(resultBackdrop).toHaveAttribute('aria-hidden', 'true')
    expect(resultBackdrop).toHaveAttribute('data-view', 'results')
    expect(resultBackdrop.querySelectorAll('svg')).toHaveLength(2)
  })

  it('uses fixed references only in explicit demo mode', async () => {
    renderBoard('?demo=1')

    expect(await screen.findByRole('article', {
      name: '代表案例 Kamala Narayana Temple Survey',
    })).toBeVisible()
    expect(screen.getByRole('img', { name: 'Kamala Narayana Temple Survey 平面图' })).toHaveAttribute(
      'src',
      '/demo/kamala-plan.jpg',
    )
    expect(screen.queryByText('预览不可用')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /查看 Kamala Narayana Temple Survey .*证据/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: '来源检视器' })).not.toBeInTheDocument()
    expect(screen.getByText(/演示数据 · 形成方案依据/)).toBeVisible()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('organizes complete case answers directly under their design questions', async () => {
    renderBoard('?demo=1')

    expect(await screen.findByRole('heading', { name: '案例研究结果' })).toBeVisible()
    expect(screen.getByText('旧建筑更新中，如何植入新功能，并组织公共与后勤流线和剖面层次？')).toBeVisible()
    expect(screen.queryByRole('region', { name: '子问题清单' })).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: '案例研究结果' })).toBeVisible()
    const programChapter = screen.getByRole('region', {
      name: '新增功能怎样进入旧结构，同时减少对原构件的改动？',
    })
    expect(within(programChapter).getByText(/^子问题 \d$/)).toBeVisible()
    const foundryDossier = within(programChapter).getByRole('article', { name: '代表案例 Foundry Commons Replay' })
    expect(within(foundryDossier).getByRole('heading', { name: '怎么做' })).toBeVisible()
    expect(within(foundryDossier).queryByRole('heading', { name: '可直接采用' })).not.toBeInTheDocument()
    expect(within(foundryDossier).getByText('适用条件')).toBeVisible()
    const chapterConclusion = programChapter.querySelector('.case-chapter-conclusion')
    expect(chapterConclusion).not.toBeNull()
    const conclusionText = chapterConclusion?.textContent?.trim()
    const repeatedMechanisms = [...programChapter.querySelectorAll('.case-answer-mechanism')]
      .filter((element) => element.textContent?.trim() === conclusionText)
    expect(repeatedMechanisms).toHaveLength(0)
    expect(foundryDossier.querySelectorAll('img')).toHaveLength(1)
    expect(screen.getByRole('button', { name: '返回主页' })).toBeVisible()
    expect(screen.getByRole('button', { name: '选择案例 Kamala Narayana Temple Survey' })).toBeVisible()
    expect(screen.queryByRole('dialog', { name: '来源检视器' })).not.toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: '研究阶段' })).not.toBeInTheDocument()
    expect(screen.queryByText(/打开来源|原文引文|来源与内容已核对/)).not.toBeInTheDocument()
  })

  it('loads a useful research-workbench home without exposing result cards', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', createLiveFetch())
    renderBoard()

    expect(await screen.findByText('真实工作区')).toBeVisible()
    expect(screen.getByRole('heading', { name: '从一个卡住你的地方开始' })).toBeVisible()
    const questionInput = screen.getByRole('textbox', { name: '研究问题' })
    expect(questionInput).toBeVisible()
    expect(screen.getByRole('group', { name: '功能入口' })).toBeVisible()
    expect(screen.getByRole('button', { name: /建筑设计研究.*项目案例与设计策略/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /图纸灵感.*配色、线型、版式与分析图/ })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.queryByRole('button', { name: '来源反查' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '不知道怎么描述？' })).toBeVisible()
    expect(screen.getByRole('heading', { name: '最近研究' })).toBeVisible()
    expect(screen.getByRole('group', { name: '研究方式' })).toBeVisible()
    expect(screen.getByRole('radio', { name: /^形成方案依据.*比较多个案例/ })).toBeChecked()
    expect(screen.getByText('案例来自 ArchDaily、Dezeen、Designboom 等建筑媒体，只收录文章内容完整的项目。')).toBeVisible()
    const startButton = screen.getByRole('button', { name: '开始研究' })
    const starterButton = screen.getByRole('button', { name: '填入问题：流线组织，人车在入口冲突，如何重组落客和步行路径？' })
    expect(startButton.closest('.research-submit-spark')).not.toBeNull()
    expect(starterButton.closest('.click-spark')).toBeNull()
    await user.click(starterButton)
    expect(questionInput).toHaveValue('人车在入口冲突，如何重组落客和步行路径？')
    expect(questionInput).toHaveFocus()
    expect(screen.getByRole('button', { name: '添加任务书或案例页（可选）' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
    expect(screen.queryByRole('region', { name: '来源反查材料' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '添加任务书或案例页（可选）' }))
    const projectInputs = screen.getByRole('region', { name: '可选项目资料' })
    expect(within(projectInputs).getByText(
      '任务书用于收束研究范围，案例页用于补充参考线索；都不填也可以继续。',
    )).toBeVisible()
    const projectFileInput = within(projectInputs).getByLabelText('项目任务书（PDF）')
    expect(projectFileInput).toHaveAttribute('accept', '.pdf,application/pdf')
    expect(projectFileInput).toHaveAccessibleDescription(
      '系统会先读取场地、功能与限制，把它们作为问题拆解和案例检索的边界。',
    )
    const projectUrlInput = within(projectInputs).getByRole('textbox', {
      name: '指定案例或项目网页',
    })
    expect(projectUrlInput).toHaveAccessibleDescription(
      '把已有页面作为研究线索；系统仍会继续检索其他案例。',
    )
    await user.upload(
      projectFileInput,
      new File(['brief'], 'project-brief.pdf', { type: 'application/pdf' }),
    )
    expect(within(screen.getByRole('list', { name: '待上传文件' })).getByText(
      'project-brief.pdf',
    )).toBeVisible()
    await user.type(projectUrlInput, 'https://example.com/project')

    await user.click(screen.getByRole('button', { name: /图纸灵感.*配色、线型、版式与分析图/ }))
    await user.click(screen.getByRole('button', { name: /建筑设计研究.*项目案例与设计策略/ }))
    expect(screen.getByRole('button', { name: '添加任务书或案例页（可选）' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
    expect(screen.queryByRole('region', { name: '来源反查材料' })).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: '指定案例或项目网页' })).not.toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: /小红书灵感/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: /Pinterest 图像线索/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: '研究环境' })).not.toBeInTheDocument()
    expect(screen.queryByText('Chrome 图纸提取')).not.toBeInTheDocument()
    expect(screen.queryByText('这里只检查 Chrome 连接与网页读取权限，不会开始研究。')).not.toBeInTheDocument()
    expect(screen.queryByRole('group', { name: '研究目标' })).not.toBeInTheDocument()
    expect(screen.queryByText('Kamala Narayana Temple Survey')).not.toBeInTheDocument()
  })

  it('keeps the same product surface in public while using the connected extension for Xiaohongshu', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', createLiveFetch({
      browserConnected: false,
      xiaohongshuSearchAvailable: false,
    }))
    renderBoard('', 'public')

    expect(await screen.findByText('公共研究工具')).toBeVisible()
    await user.click(screen.getByRole('button', {
      name: /图纸灵感.*配色、线型、版式与分析图/,
    }))

    expect(screen.getByRole('region', { name: '研究环境' })).toHaveTextContent(
      '小红书图纸检索已就绪',
    )
    expect(screen.getByRole('region', { name: '研究环境' })).toHaveTextContent(
      '使用你已登录的小红书查找公开笔记',
    )
    expect(screen.queryByRole('dialog', { name: '安装 Chrome 扩展' })).not.toBeInTheDocument()
  })

  it('uses the idempotent default-workspace initializer on a fresh install', async () => {
    const fetchMock = createLiveFetch({ workspaces: [] })
    vi.stubGlobal('fetch', fetchMock)
    renderBoard()

    expect(await screen.findByText('建筑研究工作区')).toBeVisible()
    expect(fetchMock).toHaveBeenCalledWith(
      '/v1/workspaces/default',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(fetchMock).not.toHaveBeenCalledWith(
      '/v1/workspaces',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('uses the real task brief as an internal boundary and starts standard research directly', async () => {
    const user = userEvent.setup()
    const fetchMock = createLiveFetch({ initialStatus: 'searching' })
    vi.stubGlobal('fetch', fetchMock)
    renderBoard()

    await screen.findByText('真实工作区')
    await user.type(
      screen.getByRole('textbox', { name: '研究问题' }),
      '耕织图是一份图案画作，建筑是立体的三维的，该如何转译提取元素呢。',
    )
    await user.click(screen.getByRole('button', { name: '添加任务书或案例页（可选）' }))
    await user.upload(
      screen.getByLabelText('项目任务书（PDF）'),
      new File(
        ['真实任务书固定测试内容'],
        '2024 研一概念设计-窦平平.pdf',
        { type: 'application/pdf' },
      ),
    )
    expect(within(screen.getByRole('list', { name: '待上传文件' })).getByText(
      '2024 研一概念设计-窦平平.pdf',
    )).toBeVisible()
    expect(screen.getByRole('radio', { name: /^形成方案依据.*比较多个案例/ })).toBeChecked()

    await user.click(screen.getByRole('button', { name: '开始研究' }))

    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([path, init]) => (
        path === '/v1/workspaces/workspace-live/runs'
        && (init as RequestInit | undefined)?.method === 'POST'
      ))).toBe(true)
    })
    expect(screen.queryByRole('region', { name: '任务书研究边界' })).not.toBeInTheDocument()
    const reviewIndex = fetchMock.mock.calls.findIndex(([path, init]) => (
      path === '/v1/workspaces/workspace-live/brief-review'
      && (init as RequestInit | undefined)?.method === 'POST'
    ))
    const inputIndex = fetchMock.mock.calls.findIndex(([path, init]) => (
      path === '/v1/workspaces/workspace-live/inputs'
      && (init as RequestInit | undefined)?.method === 'POST'
    ))
    const runIndex = fetchMock.mock.calls.findIndex(([path, init]) => (
      path === '/v1/workspaces/workspace-live/runs'
      && (init as RequestInit | undefined)?.method === 'POST'
    ))
    expect(reviewIndex).toBeGreaterThan(-1)
    expect(inputIndex).toBeGreaterThan(reviewIndex)
    expect(runIndex).toBeGreaterThan(inputIndex)
    const startCall = fetchMock.mock.calls.find(([path, init]) => (
      path === '/v1/workspaces/workspace-live/runs'
      && (init as RequestInit | undefined)?.method === 'POST'
    ))
    const startBody = JSON.parse(String((startCall?.[1] as RequestInit).body))
    expect(startBody.subquestions).toHaveLength(4)
    expect(startBody.subquestions[0].question).toBe('工序如何成为参观序列？')
    expect(startBody.subquestions[3].question).toBe('二维叙事如何形成四维体验？')
    expect(startBody.budget_mode).toBe('balanced')
  })

  it('opens personal collections on architecture and switches in place to image-only inspiration', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', createLiveFetch({
      collections: [
        {
          id: 'collection-case',
          workspace_id: 'workspace-live',
          asset_candidate_id: 'asset-case',
          source_url: 'https://example.com/case',
          note: '',
          snapshot: {
            question: '旧厂房如何植入新的公共功能？',
            goal: 'precedent_research',
            project_name: 'Live Mill Conversion',
            asset_type: 'section',
            design_mechanism: '独立公共层穿过旧结构。',
            case_images: [
              {
                asset_id: 'asset-case',
                asset_type: 'section',
                image_url: 'https://example.com/case-section.jpg',
                source_url: 'https://example.com/case',
              },
              {
                asset_id: 'asset-case-elevation',
                asset_type: 'elevation',
                image_url: 'https://example.com/case-elevation.jpg',
                source_url: 'https://example.com/case',
              },
              {
                asset_id: 'asset-case-site-plan',
                asset_type: 'site_plan',
                image_url: 'https://example.com/case-site-plan.jpg',
                source_url: 'https://example.com/case',
              },
            ],
            case_subquestions: [
              {
                id: 'program-zoning',
                question: '公共功能怎样与保留结构形成清晰层次？',
                project_context: '旧砖壳完整保留，新增公共使用发生在独立结构层。',
                design_mechanism: '独立公共层穿过旧结构，并在中庭边缘连接不同标高。',
                transfer_strategy: [
                  '先把高频公共功能放在可独立开放的结构层。',
                  '再用中庭与楼梯串联上下层视线和路径。',
                  '最后校核新旧结构之间的变形与防火分隔。',
                ],
                limitations: [
                  '原文没有给出独立结构层的节点详图，连接方式仍需核对。',
                  '若旧结构承载不足，应让新增结构独立落地。',
                ],
                evidence: {
                  statement: '新增公共层以独立结构穿过保留砖壳。',
                  text_excerpt: 'A new independent public floor threads through the retained brick shell.',
                  source_url: 'https://example.com/case',
                },
              },
              {
                id: 'circulation',
                question: '新旧流线怎样在入口处完成分流？',
                project_context: '公共入口与后勤入口共享旧厂房前场。',
                design_mechanism: '用独立门厅先分开公众与后勤流线。',
                transfer_strategy: [
                  '先在旧结构外侧设置共享到达前场。',
                  '再用门厅把公众和后勤分别导向各自入口。',
                ],
                limitations: [],
              },
            ],
            collection_file: 'collections/collection-case.png',
          },
          created_at: '2026-07-21T08:00:00Z',
        },
        {
          id: 'collection-drawing',
          workspace_id: 'workspace-live',
          asset_candidate_id: 'asset-drawing',
          source_url: 'https://example.com/drawing',
          note: '',
          snapshot: {
            question: '我想出一张轴测图，帮我找风格',
            goal: 'visual_reference_search',
            project_name: '轴测图参考',
            asset_type: 'axonometric',
            visual_directions: ['精细线稿轴测图'],
            visual_observation: '蓝灰线稿配少量黄色节点。',
            collection_file: 'collections/collection-drawing.png',
          },
          created_at: '2026-07-21T08:05:00Z',
        },
        {
          id: 'collection-drawing-collage',
          workspace_id: 'workspace-live',
          asset_candidate_id: 'asset-drawing-collage',
          source_url: 'https://example.com/drawing-collage',
          note: '',
          snapshot: {
            question: '旧厂房竞赛轴测图怎样比较拼贴叙事？',
            goal: 'visual_reference_search',
            project_name: '拼贴轴测参考',
            asset_type: 'axonometric',
            visual_directions: ['拼贴叙事轴测图'],
            collection_file: 'collections/collection-drawing-collage.png',
          },
          created_at: '2026-07-21T08:06:00Z',
        },
      ],
    }))
    renderBoard()

    await screen.findByText('真实工作区')
    const trigger = screen.getByRole('button', { name: '个人收藏' })
    await user.click(trigger)
    const collectionPage = screen.getByRole('region', { name: '个人收藏' })
    expect(screen.queryByRole('dialog', { name: '个人收藏' })).not.toBeInTheDocument()
    const collectionTypes = within(collectionPage).getByRole('group', { name: '收藏类型' })
    const architectureSwitch = within(collectionTypes).getByRole('button', { name: /建筑方案.*1 项.*项目与研究文字/ })
    const inspirationSwitch = within(collectionTypes).getByRole('button', { name: /图纸灵感.*2 项.*收藏图片/ })
    expect(architectureSwitch).toHaveAttribute('aria-pressed', 'true')
    expect(inspirationSwitch).toHaveAttribute('aria-pressed', 'false')
    const questionDirectory = within(collectionPage).getByRole('region', { name: '建筑问题目录' })
    expect(within(questionDirectory).getByRole('heading', { name: '问题目录' })).toBeVisible()
    const programQuestionLink = within(questionDirectory).getByRole('button', {
      name: '查看子问题：公共功能怎样与保留结构形成清晰层次？',
    })
    expect(programQuestionLink).toBeVisible()
    expect(programQuestionLink.querySelector('strong')).toHaveTextContent('旧厂房如何植入新的公共功能？')
    expect(within(programQuestionLink).getByText('研究方向：公共功能怎样与保留结构形成清晰层次？')).toBeVisible()
    expect(within(programQuestionLink).getByText('1 个已收藏案例')).toBeVisible()
    expect(within(questionDirectory).getByRole('button', {
      name: '查看子问题：新旧流线怎样在入口处完成分流？',
    })).toBeVisible()
    expect(within(collectionPage).queryByText('Live Mill Conversion')).not.toBeInTheDocument()
    expect(within(collectionPage).queryByRole('img')).not.toBeInTheDocument()

    await user.click(programQuestionLink)
    expect(within(collectionPage).getByRole('button', { name: '返回问题目录' })).toBeVisible()
    const caseSubquestion = within(collectionPage).getByRole('region', {
      name: '研究子问题：公共功能怎样与保留结构形成清晰层次？',
    })
    expect(within(caseSubquestion).getByRole('heading', {
      level: 3,
      name: '公共功能怎样与保留结构形成清晰层次？',
    })).toBeVisible()
    const savedCase = within(caseSubquestion).getByRole('article', { name: '收藏案例 Live Mill Conversion' })
    expect(within(savedCase).queryByText('项目案例')).not.toBeInTheDocument()
    expect(within(savedCase).getByRole('heading', { level: 4, name: 'Live Mill Conversion' })).toBeVisible()
    const solution = within(savedCase).getByRole('region', { name: 'Live Mill Conversion 的解法' })
    expect(within(solution).getByRole('heading', { name: '核心解法' })).toBeVisible()
    expect(within(solution).getByText('独立公共层穿过旧结构，并在中庭边缘连接不同标高。')).toBeVisible()
    expect(within(solution).getByRole('heading', { name: '怎么做' })).toBeVisible()
    expect(within(solution).getByText('先把高频公共功能放在可独立开放的结构层。')).toBeVisible()
    expect(within(solution).getByText('再用中庭与楼梯串联上下层视线和路径。')).toBeVisible()
    expect(within(solution).getByText('最后校核新旧结构之间的变形与防火分隔。')).toBeVisible()
    expect(within(savedCase).queryByRole('heading', { name: '项目条件' })).not.toBeInTheDocument()
    expect(within(savedCase).queryByText('旧砖壳完整保留，新增公共使用发生在独立结构层。')).not.toBeInTheDocument()
    expect(within(savedCase).queryByRole('heading', { name: '适用边界' })).not.toBeInTheDocument()
    expect(within(savedCase).queryByText('原文没有给出独立结构层的节点详图，连接方式仍需核对。')).not.toBeInTheDocument()
    expect(within(savedCase).getByText('若旧结构承载不足，应让新增结构独立落地。')).toBeVisible()
    expect(within(savedCase).getByText('适用条件')).toBeVisible()
    expect(within(savedCase).queryByText('适用时注意')).not.toBeInTheDocument()
    expect(within(savedCase).queryByText('A new independent public floor threads through the retained brick shell.')).not.toBeInTheDocument()
    expect(within(savedCase).queryByRole('link', { name: '打开证据来源：Live Mill Conversion' })).not.toBeInTheDocument()
    expect(within(savedCase).queryByRole('link', { name: '打开来源：Live Mill Conversion' })).not.toBeInTheDocument()
    const savedSourceLink = within(savedCase).getByRole('link', { name: '打开出处：Live Mill Conversion' })
    expect(savedSourceLink).toHaveAttribute('href', 'https://example.com/case')
    expect(within(savedCase).getByText('出处 · example.com')).toBeVisible()
    expect(within(savedCase).getByRole('button', { name: '删除收藏：Live Mill Conversion' })).toBeVisible()
    expect(savedCase.querySelector('details')).toBeNull()
    expect(within(savedCase).queryByText('查看完整相关内容')).not.toBeInTheDocument()
    expect(within(savedCase).queryByRole('heading', { name: '其余转译步骤' })).not.toBeInTheDocument()
    expect(within(savedCase).queryByRole('heading', { name: '更多适用边界' })).not.toBeInTheDocument()
    const caseImages = within(savedCase).getAllByRole('img')
    expect(caseImages).toHaveLength(3)
    expect(caseImages[0]).toHaveAttribute('src', '/v1/collections/collection-case/content')
    expect(caseImages[1]).toHaveAttribute('src', 'https://example.com/case-elevation.jpg')
    expect(caseImages[2]).toHaveAttribute('src', 'https://example.com/case-site-plan.jpg')
    const caseImageLinks = within(savedCase).getAllByRole('link', { name: /打开案例图片/ })
    expect(caseImageLinks).toHaveLength(3)
    expect(caseImageLinks[0]).toHaveAttribute('href', '/v1/collections/collection-case/content')
    const caseMedia = within(savedCase).getByRole('group', { name: 'Live Mill Conversion 案例图片' })
    expect(solution.compareDocumentPosition(caseMedia) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(within(collectionPage).queryByRole('heading', { name: '旧厂房如何植入新的公共功能？' })).not.toBeInTheDocument()
    expect(within(collectionPage).getAllByRole('img')).toHaveLength(3)
    expect(within(collectionPage).queryByText('蓝灰线稿配少量黄色节点。')).not.toBeInTheDocument()
    expect(within(collectionPage).queryByText('新旧流线怎样在入口处完成分流？')).not.toBeInTheDocument()

    await user.click(within(collectionPage).getByRole('button', { name: '返回问题目录' }))
    expect(within(collectionPage).getByRole('region', { name: '建筑问题目录' })).toBeVisible()
    expect(within(collectionPage).queryByRole('region', {
      name: '研究子问题：公共功能怎样与保留结构形成清晰层次？',
    })).not.toBeInTheDocument()

    await user.click(within(collectionPage).getByRole('button', {
      name: '查看子问题：公共功能怎样与保留结构形成清晰层次？',
    }))

    await user.click(inspirationSwitch)
    expect(within(collectionTypes).getByRole('button', { name: /建筑方案/ })).toHaveAttribute('aria-pressed', 'false')
    expect(within(collectionTypes).getByRole('button', { name: /图纸灵感/ })).toHaveAttribute('aria-pressed', 'true')
    expect(within(collectionPage).getByRole('img', { name: '轴测图参考' })).toHaveAttribute(
      'src',
      '/v1/collections/collection-drawing/content',
    )
    const highResolutionLink = within(collectionPage).getByRole('link', { name: '打开高清图片：轴测图参考' })
    expect(highResolutionLink).toHaveAttribute('href', '/v1/collections/collection-drawing/content')
    expect(highResolutionLink).toHaveAttribute('target', '_blank')
    expect(highResolutionLink).toHaveAttribute('rel', 'noreferrer')
    expect(within(collectionPage).getByRole('link', { name: '打开来源：轴测图参考' })).toBeVisible()
    expect(within(collectionPage).getByRole('button', { name: '删除收藏：轴测图参考' })).toBeVisible()
    expect(within(collectionPage).getByText('原研究问题：我想出一张轴测图，帮我找风格')).toBeVisible()
    expect(within(collectionPage).getByText('灵感方向：精细线稿轴测图')).toBeVisible()
    expect(within(collectionPage).getByText('原研究问题：旧厂房竞赛轴测图怎样比较拼贴叙事？')).toBeVisible()
    expect(within(collectionPage).getByText('灵感方向：拼贴叙事轴测图')).toBeVisible()
    expect(within(collectionPage).queryByText('蓝灰线稿配少量黄色节点。')).not.toBeInTheDocument()

    await user.click(within(collectionTypes).getByRole('button', { name: /建筑方案/ }))
    expect(within(collectionPage).getByRole('region', { name: '建筑问题目录' })).toBeVisible()
    expect(within(collectionPage).queryByText('Live Mill Conversion')).not.toBeInTheDocument()
    expect(within(collectionPage).queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: '返回主页' })).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: '返回主页' }))
    expect(screen.queryByRole('region', { name: '个人收藏' })).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: '新建研究' })).toBeVisible()
    expect(screen.getByRole('button', { name: '个人收藏' })).toBeVisible()

    await user.click(screen.getByRole('button', { name: '个人收藏' }))
    const reopenedCollection = await screen.findByRole('region', { name: '个人收藏' })
    expect(within(reopenedCollection).getByRole('region', { name: '建筑问题目录' })).toBeVisible()
    expect(within(reopenedCollection).queryByText('Live Mill Conversion')).not.toBeInTheDocument()
  })

  it('returns from a research result to the problem-first home', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', createLiveFetch())
    renderBoard()
    await startLiveResearch(user)
    await screen.findByRole('region', { name: '研究结果' })
    expect(screen.getAllByRole('button', { name: '返回主页' })).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: '返回主页' }))

    expect(screen.queryByRole('region', { name: '研究结果' })).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: '新建研究' })).toBeVisible()
    expect(screen.getByRole('button', { name: '个人收藏' })).toBeVisible()
  })

  it('shows complete retained question history inline', async () => {
    const user = userEvent.setup()
    const gengzhiQuestion = '我想问的问题是：耕织图是一份图案画作，建筑是立体的三维的，该如何转译提取元素呢。'
    const existingRuns = Array.from({ length: 12 }, (_, index) => ({
      id: `run-history-${index + 1}`,
      workspace_id: 'workspace-live',
      title: index === 0 ? '耕织图：转译提取元素' : `历史研究 ${index + 1}`,
      question: index === 0 ? gengzhiQuestion : `历史研究 ${index + 1}`,
      subquestions: liveSubquestions,
      goal: 'precedent_research',
      status: 'completed',
      budget_mode: 'balanced',
      checkpoint_stage: 'composing',
      coverage_report: { usable_assets: index + 1 },
      stop_reason: 'coverage_satisfied',
      created_at: `2026-07-${String(20 - index).padStart(2, '0')}T08:30:00Z`,
      keep_forever: index === 0,
      retention_expires_at: index === 0 ? null : '2026-08-04T08:30:00Z',
    }))
    vi.stubGlobal('fetch', createLiveFetch({
      existingRuns,
      workspaces: [
        workspace,
        {
          ...workspace,
          id: 'workspace-history',
          name: '旧厂房更新 · 历史研究',
          archived_at: '2026-07-24T08:00:00Z',
        },
        { ...workspace, id: 'workspace-structure', name: '旧工业建筑 · 结构与功能植入' },
      ],
    }))
    renderBoard()

    const recentResearch = await screen.findByRole('region', { name: '最近研究' })
    const historyViewport = await within(recentResearch).findByRole('region', { name: '研究记录' })
    expect(historyViewport).toHaveAttribute('tabindex', '0')
    expect(within(recentResearch).queryByRole('combobox', { name: '研究项目' })).not.toBeInTheDocument()
    expect(within(recentResearch).queryByRole('button', { name: /切换研究项目/ })).not.toBeInTheDocument()
    expect(within(recentResearch).queryByRole('menu', { name: '研究项目' })).not.toBeInTheDocument()
    expect(within(recentResearch).queryByText('当前项目')).not.toBeInTheDocument()
    expect(within(recentResearch).queryByText('历史归档')).not.toBeInTheDocument()
    expect(await within(recentResearch).findByText('耕织图：转译提取元素')).toBeVisible()
    expect(within(recentResearch).queryByText(gengzhiQuestion)).not.toBeInTheDocument()
    expect(within(recentResearch).getByRole('button', {
      name: '打开研究：耕织图：转译提取元素',
    })).toBeVisible()
    expect(await within(historyViewport).findAllByRole('button', { name: /打开研究：历史研究/ })).toHaveLength(11)
    expect(within(recentResearch).queryByText(/完整历史不会自动过期/)).not.toBeInTheDocument()
    expect(within(recentResearch).queryByRole('button', { name: /查看全部历史/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: '全部历史' })).not.toBeInTheDocument()
    expect(within(recentResearch).getByText('新研究从创建日起保留一学期（180 天），到期前可设为永久。')).toBeVisible()
    expect(within(recentResearch).getByText('永久保留')).toBeVisible()
    expect(within(recentResearch).getAllByText('即将到期 · 2026年8月4日删除')).toHaveLength(11)

    await user.click(within(recentResearch).getByRole('button', { name: '永久保留：历史研究 2' }))
    expect(fetch).toHaveBeenCalledWith('/v1/runs/run-history-2/retention', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ permanent: true }),
    })
    expect(within(recentResearch).getAllByText('永久保留')).toHaveLength(2)
  })

  it('shows archived workspace runs as flat question records without workspace categories', async () => {
    const archivedRun = {
      id: 'run-archived-question',
      workspace_id: 'workspace-history',
      question: '旧厂房屋架如何保留并植入公共功能？',
      title: '旧厂房屋架：保留与功能植入',
      subquestions: liveSubquestions,
      goal: 'precedent_research',
      status: 'completed',
      budget_mode: 'balanced',
      coverage_report: { usable_assets: 12 },
      stop_reason: 'coverage_satisfied',
      created_at: '2026-07-18T08:30:00Z',
    }
    window.localStorage.setItem('archresearch.activeWorkspaceId', 'workspace-history')
    vi.stubGlobal('fetch', createLiveFetch({
      workspaces: [
        workspace,
        {
          ...workspace,
          id: 'workspace-history',
          name: '历史研究归档',
          archived_at: '2026-07-24T08:00:00Z',
        },
      ],
      runsByWorkspace: {
        'workspace-live': [],
        'workspace-history': [archivedRun],
      },
    }))
    renderBoard()

    const recentResearch = await screen.findByRole('region', { name: '最近研究' })
    expect(await within(recentResearch).findByRole('button', {
      name: '打开研究：旧厂房屋架：保留与功能植入',
    })).toBeVisible()
    expect(within(recentResearch).queryByText('当前项目')).not.toBeInTheDocument()
    expect(within(recentResearch).queryByText('历史归档')).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: '历史研究归档' })).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: '新建研究' })).toBeVisible()
    expect(screen.getByRole('button', { name: '新建项目' })).toBeVisible()
  })

  it('does not present a historical completed run with enrichment gaps as fully complete', async () => {
    vi.stubGlobal('fetch', createLiveFetch({
      existingRuns: [{
        id: 'run-legacy-enrichment-gap',
        workspace_id: 'workspace-live',
        question: '既有建筑高差之间如何用连廊改善公共流线？',
        title: '高差连廊：改善公共流线',
        subquestions: liveSubquestions,
        goal: 'precedent_research',
        status: 'completed',
        budget_mode: 'quick',
        coverage_report: {
          usable_assets: 26,
          covered_subquestions: 3,
          subquestion_count: 3,
          gaps: [],
          enrichment_gaps: ['insufficient_project_diversity'],
        },
        stop_reason: 'completion_satisfied',
        created_at: '2026-07-25T08:30:00Z',
      }],
    }))
    renderBoard()

    const recentResearch = await screen.findByRole('region', { name: '最近研究' })
    const provisionalStatus = await within(recentResearch).findByText('已完成 · 案例不足')
    expect(provisionalStatus).toBeVisible()
    expect(provisionalStatus).toHaveAttribute('title', '已回答全部研究问题，但案例数量或深度未达完整标准，可先使用已有结果')
    expect(within(recentResearch).queryByText('研究已完成')).not.toBeInTheDocument()
    const retentionButton = within(recentResearch).getByRole('button', { name: /永久保留：高差连廊/ })
    expect(retentionButton).toHaveAttribute('title', '设为永久后，这条记录不再自动删除')
  })

  it('holds drawing inspiration to the same completeness honesty as architectural research', async () => {
    vi.stubGlobal('fetch', createLiveFetch({
      existingRuns: [{
        id: 'run-legacy-visual-enrichment-gap',
        workspace_id: 'workspace-live',
        question: '想要一组轴测图，帮我找不同表达风格的参考',
        title: '轴测图：不同表达风格',
        subquestions: liveSubquestions,
        goal: 'visual_reference_search',
        status: 'completed',
        budget_mode: 'quick',
        coverage_report: {
          usable_assets: 9,
          covered_subquestions: 3,
          subquestion_count: 3,
          gaps: [],
          enrichment_gaps: ['insufficient_verified_or_partial'],
        },
        stop_reason: 'completion_satisfied',
        created_at: '2026-07-19T16:33:00Z',
      }],
    }))
    renderBoard()

    const recentResearch = await screen.findByRole('region', { name: '最近研究' })
    expect(await within(recentResearch).findByText('已完成 · 图纸较少')).toBeVisible()
    expect(within(recentResearch).queryByText('已完成')).not.toBeInTheDocument()
  })

  it('separates drawing inspiration from architectural research and hides depth controls', async () => {
    const user = userEvent.setup()
    const fetchMock = createLiveFetch({ initialStatus: 'searching' })
    vi.stubGlobal('fetch', fetchMock)
    renderBoard()

    await screen.findByText('真实工作区')
    await user.click(screen.getByRole('button', { name: '添加任务书或案例页（可选）' }))
    const projectInputs = screen.getByRole('region', { name: '可选项目资料' })
    await user.upload(
      within(projectInputs).getByLabelText('项目任务书（PDF）'),
      new File(['brief'], 'project-brief.pdf', { type: 'application/pdf' }),
    )
    await user.type(
      within(projectInputs).getByRole('textbox', { name: '指定案例或项目网页' }),
      'https://example.com/project',
    )
    const inspirationEntry = screen.getByRole('button', {
      name: /图纸灵感.*配色、线型、版式与分析图/,
    })
    await user.click(inspirationEntry)
    expect(inspirationEntry).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('textbox', { name: '研究问题' })).toHaveAttribute(
      'placeholder',
      '例如：我想出一张轴测图，帮我找几种风格。',
    )
    expect(screen.getByRole('button', { name: '查找灵感' })).toBeVisible()
    expect(screen.queryByRole('group', { name: '研究方式' })).not.toBeInTheDocument()
    expect(await screen.findByRole('region', { name: '研究环境' })).toBeVisible()
    expect(screen.queryByRole('button', {
      name: '添加任务书或案例页（可选）',
    })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: '可选项目资料' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: '来源反查材料' })).not.toBeInTheDocument()
    expect(screen.queryByText('1 个文件待上传')).not.toBeInTheDocument()
    expect(screen.queryByText('研究方式')).not.toBeInTheDocument()
    expect(screen.queryByRole('radio', { name: /概览/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('radio', { name: /标准/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('radio', { name: /深入/ })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /建筑设计研究.*项目案例与设计策略/ }))
    expect(screen.getByText('研究方式')).toBeVisible()
    expect(screen.getByRole('radio', { name: /^形成方案依据.*比较多个案例/ })).toBeChecked()
    expect(screen.queryByRole('region', { name: '研究环境' })).not.toBeInTheDocument()
    await user.click(inspirationEntry)

    await user.type(
      screen.getByRole('textbox', { name: '研究问题' }),
      '寻找蓝灰轴测、分层剖面和流线分析图的统一表达。',
    )
    await user.click(screen.getByRole('button', { name: '查找灵感' }))

    const startCall = fetchMock.mock.calls.find(([path, init]) => (
      path === '/v1/workspaces/workspace-live/runs'
      && (init as RequestInit | undefined)?.method === 'POST'
    ))
    expect(JSON.parse(String((startCall?.[1] as RequestInit).body))).toMatchObject({
      goal: 'visual_reference_search',
      budget_mode: 'quick',
      research_sources: ['xiaohongshu'],
    })
    expect(fetchMock.mock.calls.some(([path]) => (
      path === '/v1/workspaces/workspace-live/inputs'
    ))).toBe(false)
  })

  it.each([
    ['quick', '快速找方向', '从少量高相关案例提炼做法，给出直接建议'],
    ['balanced', '形成方案依据', '比较多个案例的条件、做法与结果，说明适用边界'],
    ['deep', '做跨案例论证', '综合更多案例，指出共识、冲突、不确定性和失效边界'],
  ])('explains the %s depth as a case-based outcome without changing its request value', async (
    budgetMode,
    label,
    description,
  ) => {
    const user = userEvent.setup()
    const fetchMock = createLiveFetch({ initialStatus: 'searching' })
    vi.stubGlobal('fetch', fetchMock)
    renderBoard()

    await screen.findByText('真实工作区')
    expect(screen.getByText('案例来自 ArchDaily、Dezeen、Designboom 等建筑媒体，只收录文章内容完整的项目。')).toBeVisible()
    const depthOption = screen.getByRole('radio', { name: new RegExp(`^${label}.*${description}$`) })
    await user.click(depthOption)
    expect(screen.getByText(description)).toBeVisible()
    await user.type(screen.getByRole('textbox', { name: '研究问题' }), '旧厂房如何植入展厅？')
    await user.click(screen.getByRole('button', { name: '开始研究' }))

    const startCall = fetchMock.mock.calls.find(([path, init]) => (
      path === '/v1/workspaces/workspace-live/runs'
      && (init as RequestInit | undefined)?.method === 'POST'
    ))
    expect(JSON.parse(String((startCall?.[1] as RequestInit).body))).toMatchObject({
      budget_mode: budgetMode,
    })
  })

  it('presents completed case results without research, verification, or source metadata', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', createLiveFetch({
      existingRunStatus: 'completed',
      candidates: [
        {
          ...candidate,
          project_name: 'Live Mill Conversion | ArchDaily',
          limitations: [
            '所选 drawing_ids 仅作为源网站入口，不用于证明空间机制事实。',
            '仅适用于新增结构能够独立落地的项目。',
          ],
        },
        {
          ...candidate,
          id: 'asset-partial',
          project_name: 'Second Mill Conversion',
          source_url: 'https://example.com/second-mill',
          result_tier: 'partial',
          relevance: 3,
          rank_index: 1,
          evidence_claims: candidate.evidence_claims.map((claim) => ({
            ...claim,
            id: 'claim-partial',
            asset_candidate_id: 'asset-partial',
            source_url: 'https://example.com/second-mill#evidence',
          })),
        },
      ],
    }))
    renderBoard()

    await user.click(await screen.findByRole('button', { name: `打开研究：${liveQuestion}` }))
    const resultsRegion = await screen.findByRole('region', { name: '研究结果' })
    expect(within(resultsRegion).getByRole('heading', { name: '案例研究结果' })).toBeVisible()
    expect(within(resultsRegion).getByRole('article', { name: '代表案例 Live Mill Conversion' })).toBeVisible()
    expect(within(resultsRegion).getByRole('article', { name: '代表案例 Second Mill Conversion' })).toBeVisible()
    expect(resultsRegion.querySelector('details.case-inventory')).toBeNull()
    expect(within(resultsRegion).queryByText(/来源|原文|证据|核对|核验|正文|证明|研究进度/)).not.toBeInTheDocument()
    expect(within(resultsRegion).queryByRole('link', { name: /来源/ })).not.toBeInTheDocument()
    expect(screen.queryByText(/问题匹配|正文案例|部分核验/)).not.toBeInTheDocument()
    expect(within(resultsRegion).queryByText(/ArchDaily/)).not.toBeInTheDocument()
    expect(document.querySelector('.run-status-strip')).toBeNull()
  })

  it('keeps restored results behind an explicit action on the problem-first home', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', createLiveFetch({ existingRunStatus: 'completed' }))
    renderBoard()

    expect(await screen.findByRole('textbox', { name: '研究问题' })).toBeVisible()
    expect(await screen.findByText(liveQuestion)).toBeVisible()
    expect(screen.queryByRole('button', { name: '查看上次结果' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '研究给出的方向' })).not.toBeInTheDocument()
    expect(
      (fetch as ReturnType<typeof vi.fn>).mock.calls.some(([path]) => path === '/v1/runs/run-live/results'),
    ).toBe(false)

    await user.click(screen.getByRole('button', { name: `打开研究：${liveQuestion}` }))
    expect(await screen.findByRole('heading', { name: '案例研究结果' })).toBeVisible()
    expect(screen.queryByRole('heading', { name: '研究给出的方向' })).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: '研究问题' })).not.toBeInTheDocument()
  })

  it('keeps visual-source routing out of architectural design submissions', async () => {
    const user = userEvent.setup()
    const fetchMock = createLiveFetch({ browserConnected: true, initialStatus: 'searching' })
    vi.stubGlobal('fetch', fetchMock)
    renderBoard()

    await screen.findByText('真实工作区')
    await user.type(screen.getByRole('textbox', { name: '研究问题' }), '比较不同案例的公共流线组织')
    await user.click(screen.getByRole('button', { name: '开始研究' }))

    const startCall = fetchMock.mock.calls.find(([path, init]) => (
      path === '/v1/workspaces/workspace-live/runs'
      && (init as RequestInit | undefined)?.method === 'POST'
    ))
    expect(JSON.parse(String((startCall?.[1] as RequestInit).body))).toMatchObject({
      research_sources: [],
    })
  })

  it('refreshes readiness without creating a research run', async () => {
    const user = userEvent.setup()
    const fetchMock = createLiveFetch({ browserConnected: true })
    vi.stubGlobal('fetch', fetchMock)
    renderBoard()

    await screen.findByText('真实工作区')
    await user.click(screen.getByRole('button', { name: /图纸灵感.*配色、线型、版式与分析图/ }))
    await screen.findByText('研究环境已就绪')
    await user.click(screen.getByRole('button', { name: '刷新环境状态' }))
    await waitFor(() => {
      expect(fetchMock.mock.calls.filter(([path]) => path === '/v1/browser/status')).toHaveLength(2)
    })
    expect(fetchMock).not.toHaveBeenCalledWith(
      '/v1/workspaces/workspace-live/runs',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('distinguishes the local browser connection from the extension on this page', async () => {
    const user = userEvent.setup()
    vi.mocked(requestBrowserBridge).mockRejectedValue(
      new BrowserBridgeError('unavailable', 'bridge unavailable on this surface'),
    )
    vi.stubGlobal('fetch', createLiveFetch({ browserConnected: true }))
    renderBoard()

    await screen.findByText('真实工作区')
    await user.click(screen.getByRole('button', { name: /图纸灵感.*配色、线型、版式与分析图/ }))
    const preflight = await screen.findByRole('region', { name: '研究环境' })
    expect(await within(preflight).findByText('研究环境待连接')).toBeVisible()
    expect(within(preflight).getByText('当前页面未检测到扩展')).toBeVisible()
    expect(within(preflight).getByRole('button', { name: '连接 Chrome 读取高清图纸' })).toBeVisible()
    expect(within(preflight).queryByText('Chrome 图纸提取')).not.toBeInTheDocument()
  })

  it('does not report a disconnected bridge as authorized', async () => {
    const user = userEvent.setup()
    vi.mocked(requestBrowserBridge).mockResolvedValue({
      paired: true,
      connection: 'disconnected',
      researchPermission: true,
    })
    vi.stubGlobal('fetch', createLiveFetch({ browserConnected: true }))
    renderBoard()

    await screen.findByText('真实工作区')
    await user.click(screen.getByRole('button', { name: /图纸灵感.*配色、线型、版式与分析图/ }))
    const preflight = await screen.findByRole('region', { name: '研究环境' })
    expect(await within(preflight).findByText('研究环境待连接')).toBeVisible()
    expect(within(preflight).getByText('当前页面扩展未连通')).toBeVisible()
    expect(within(preflight).queryByText('可读取当前页面高清图纸 · 可检查小红书登录页面')).not.toBeInTheDocument()
  })

  it('explains a partial recent run without exposing internal reason codes', async () => {
    vi.stubGlobal('fetch', createLiveFetch({ existingRunStatus: 'partial' }))
    renderBoard()

    const recentRun = await screen.findByRole('button', { name: `打开研究：${liveQuestion}` })
    expect(within(recentRun).getByText('部分结果 · 本轮自动检索次数已用完，先交付当前可用结果')).toBeVisible()
    expect(screen.queryByText('budget_exhausted')).not.toBeInTheDocument()
    expect(screen.queryByText('insufficient_usable_assets')).not.toBeInTheDocument()
  })

  it('labels exhausted visual inspection capacity without calling it a time limit', async () => {
    vi.stubGlobal('fetch', createLiveFetch({
      existingRunStatus: 'partial',
      goal: 'visual_reference_search',
      subquestions: visualDirectionSubquestions,
      stopReason: 'visual_budget_exhausted',
      coverageReport: {
        usable_assets: 12,
        project_count: 4,
        verified_or_partial: 12,
        covered_subquestions: 2,
        subquestion_count: 3,
        gaps: ['uncovered_subquestions'],
      },
    }))
    renderBoard()

    const recentRun = await screen.findByRole('button', { name: `打开研究：${liveQuestion}` })
    expect(within(recentRun).getByText('部分结果 · 本轮可检查的图纸数量已达上限')).toBeVisible()
    expect(within(recentRun).queryByText('本轮研究达到时间上限')).not.toBeInTheDocument()
    expect(screen.queryByText('visual_budget_exhausted')).not.toBeInTheDocument()
  })

  it('opens on the home page while background research keeps running', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', createLiveFetch({ existingRunStatus: 'searching' }))
    renderBoard()

    expect(await screen.findByRole('heading', { name: '从一个卡住你的地方开始' })).toBeVisible()
    expect(screen.queryByRole('button', { name: '取消研究' })).not.toBeInTheDocument()
    const recentResearch = await screen.findByRole('region', { name: '最近研究' })
    expect(await within(recentResearch).findByText('正在搜索')).toBeVisible()

    await user.click(within(recentResearch).getByRole('button', { name: `打开研究：${liveQuestion}` }))
    expect(await screen.findByRole('button', { name: '取消研究' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: '返回主页' }))
    expect(await screen.findByRole('heading', { name: '从一个卡住你的地方开始' })).toBeVisible()
    expect(screen.getByRole('button', { name: '备份与恢复' })).toBeVisible()
    expect(screen.getByRole('button', { name: '个人收藏' })).toBeVisible()
  })

  it('leads cases with a Chinese project name and keeps the original as reference', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', createLiveFetch({
      existingRunStatus: 'completed',
      candidateOverrides: {
        subquestion_analysis: {
          program: {
            project_name_zh: '利物浦磨坊改造',
            project_context: '旧厂房保留主结构。',
            design_mechanism: '新公共层穿过原有框架，通过竖向交通核连接首层与上部空间。',
            transfer_strategy: ['先标出现有结构不可改动范围'],
            observations: [],
            limitations: ['需要核对现有结构承载力。'],
          },
        },
      },
    }))
    renderBoard()

    await user.click(await screen.findByRole('button', { name: `打开研究：${liveQuestion}` }))
    const dossier = await screen.findByRole('article', { name: '代表案例 利物浦磨坊改造' })
    expect(within(dossier).getByRole('heading', { level: 4, name: '利物浦磨坊改造' })).toBeVisible()
    expect(within(dossier).getByText('Live Mill Conversion')).toBeVisible()
  })

  it('falls back to the original project name when a translated location is not trustworthy', async () => {
    const user = userEvent.setup()
    const originalName = "TAKK crafts climate-responsive children's bedroom in barcelona from reclaimed materials"
    vi.stubGlobal('fetch', createLiveFetch({
      existingRunStatus: 'completed',
      candidateOverrides: {
        project_name: originalName,
        source_url: 'https://www.designboom.com/architecture/takk-children-bedroom-barcelona-07-20-2026/',
        subquestion_analysis: {
          program: {
            project_name_zh: '罗马的卧室',
            project_context: '旧工业空间被改造为住宅。',
            design_mechanism: '卧室设置在可移动的平台上。',
            transfer_strategy: ['把小尺度介入作为可逆构件处理'],
            observations: [],
            limitations: ['仅为房间尺度类比。'],
          },
        },
      },
    }))
    renderBoard()

    await user.click(await screen.findByRole('button', { name: `打开研究：${liveQuestion}` }))
    const dossier = await screen.findByRole('article', { name: `代表案例 ${originalName}` })
    expect(within(dossier).getByRole('heading', { level: 4, name: originalName })).toBeVisible()
    expect(screen.queryByText('罗马的卧室')).not.toBeInTheDocument()
  })

  it('opens a completed record normally while background research is running', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', createLiveFetch({
      existingRuns: [
        {
          id: 'run-background',
          workspace_id: 'workspace-live',
          question: '后台批量研究任务',
          goal: 'precedent_research',
          status: 'searching',
          budget_mode: 'quick',
          subquestions: liveSubquestions,
          created_at: '2026-07-27T00:30:00Z',
          updated_at: '2026-07-27T00:40:00Z',
        },
        {
          id: 'run-live',
          workspace_id: 'workspace-live',
          question: liveQuestion,
          subquestions: liveSubquestions,
          goal: 'precedent_research',
          status: 'completed',
          budget_mode: 'balanced',
          coverage_report: {},
          created_at: '2026-07-13T08:30:00Z',
        },
      ],
    }))
    renderBoard()

    const recentResearch = await screen.findByRole('region', { name: '最近研究' })
    await user.click(await within(recentResearch).findByRole('button', { name: `打开研究：${liveQuestion}` }))
    expect(await screen.findByRole('article', { name: '代表案例 Live Mill Conversion' })).toBeVisible()
    expect(screen.queryByText('从一个具体设计问题开始')).not.toBeInTheDocument()
  })

  it('restores the latest persisted run after the user opens it', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', createLiveFetch({ existingRunStatus: 'completed' }))
    renderBoard()

    await user.click(await screen.findByRole('button', { name: `打开研究：${liveQuestion}` }))
    expect(await screen.findByRole('article', { name: '代表案例 Live Mill Conversion' })).toBeVisible()
    expect(screen.getByText(candidate.design_mechanism)).toBeVisible()
    expect(screen.queryByText('暂无项目预览')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /来源/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: '来源检视器' })).not.toBeInTheDocument()
  })

  it('shows a text-grounded project case without requiring image observations', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', createLiveFetch({
      existingRunStatus: 'completed',
      candidateOverrides: { observations: [] },
    }))
    renderBoard()

    await user.click(await screen.findByRole('button', { name: `打开研究：${liveQuestion}` }))
    await screen.findByRole('article', { name: '代表案例 Live Mill Conversion' })
    expect(screen.getByRole('heading', { name: '案例研究结果' })).toBeVisible()
    expect(screen.getByRole('article', { name: '代表案例 Live Mill Conversion' })).toBeVisible()
  })

  it('lays out each case as one continuous answer without the old evidence ledger', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', createLiveFetch({ existingRunStatus: 'completed' }))
    renderBoard()

    await user.click(await screen.findByRole('button', { name: `打开研究：${liveQuestion}` }))
    await screen.findByRole('article', { name: '代表案例 Live Mill Conversion' })
    const dossier = await screen.findByRole('article', { name: '代表案例 Live Mill Conversion' })
    expect(dossier.querySelector('.dossier-analysis-grid')).not.toBeInTheDocument()
    expect(dossier.querySelector('.dossier-analysis-column')).not.toBeInTheDocument()
    expect(dossier.querySelector('.dossier-analysis')).not.toBeInTheDocument()
    expect(dossier.querySelector('.case-answer-copy')).toBeInTheDocument()
    expect(screen.getByText(candidate.design_mechanism)).toBeVisible()
    expect(within(dossier).queryByText(candidate.design_mechanism)).not.toBeInTheDocument()
    expect(within(dossier).getByRole('heading', { name: '怎么做' })).toBeVisible()
    expect(within(dossier).queryByText(candidate.limitations[0])).not.toBeInTheDocument()
    const sourceLink = within(dossier).getByRole('link', { name: '打开出处：Live Mill Conversion' })
    expect(sourceLink).toHaveAttribute('href', 'https://example.com/live-mill')
    expect(within(dossier).getByText('出处 · example.com')).toBeVisible()
  })

  it('omits an unavailable recognition image without replacing the answer with a placeholder', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', createLiveFetch({ existingRunStatus: 'completed' }))
    renderBoard()

    await user.click(await screen.findByRole('button', { name: `打开研究：${liveQuestion}` }))
    await screen.findByRole('article', { name: '代表案例 Live Mill Conversion' })
    const dossier = await screen.findByRole('article', { name: '代表案例 Live Mill Conversion' })
    expect(dossier.querySelector('.case-answer-image')).not.toBeInTheDocument()
    expect(screen.getByText(candidate.design_mechanism)).toBeVisible()
    expect(within(dossier).queryByText(/来源|预览不可用|暂无项目预览/)).not.toBeInTheDocument()
  })

  it('uses only one recognition image and omits image observations and evidence actions', async () => {
    const user = userEvent.setup()
    const sharedInference = '连续的空间骨架把不同使用阶段组织成统一序列。'
    const uniqueObservation = '轴测图单独显示了屋顶下方的连续步行路径。'
    vi.stubGlobal('fetch', createLiveFetch({
      existingRunStatus: 'completed',
      candidates: [
        {
          ...candidate,
          id: 'asset-live-section',
          image_url: 'https://example.com/live-mill-section.jpg',
          observations: [],
          inferences: [sharedInference],
        },
        {
          ...candidate,
          id: 'asset-live-plan',
          asset_type: 'plan',
          image_url: 'https://example.com/live-mill-plan.jpg',
          observations: [],
          inferences: [sharedInference],
          rank_index: 1,
        },
        {
          ...candidate,
          id: 'asset-live-axon',
          asset_type: 'axonometric',
          image_url: 'https://example.com/live-mill-axon.jpg',
          observations: [uniqueObservation],
          inferences: [sharedInference],
          rank_index: 2,
        },
      ],
    }))
    renderBoard()

    await user.click(await screen.findByRole('button', { name: `打开研究：${liveQuestion}` }))
    await screen.findByRole('article', { name: '代表案例 Live Mill Conversion' })
    const dossier = await screen.findByRole('article', { name: '代表案例 Live Mill Conversion' })
    expect(within(dossier).getAllByRole('img')).toHaveLength(1)
    expect(within(dossier).queryByText(sharedInference)).not.toBeInTheDocument()
    expect(within(dossier).queryByText(uniqueObservation)).not.toBeInTheDocument()
    expect(within(dossier).queryByRole('button', { name: /查看 .*证据/ })).not.toBeInTheDocument()
  })

  it('selects one architectural project case instead of selecting its individual drawings', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', createLiveFetch({
      existingRunStatus: 'completed',
      candidates: [
        candidate,
        {
          ...candidate,
          id: 'asset-live-plan',
          asset_type: 'plan',
          image_url: 'https://example.com/live-mill-plan.jpg',
          rank_index: 1,
        },
      ],
    }))
    renderBoard()

    await user.click(await screen.findByRole('button', { name: `打开研究：${liveQuestion}` }))
    await screen.findByRole('article', { name: '代表案例 Live Mill Conversion' })
    const dossier = screen.getByRole('article', { name: '代表案例 Live Mill Conversion' })
    expect(within(dossier).getByRole('button', { name: '选择案例 Live Mill Conversion' })).toBeVisible()
    expect(within(dossier).queryByRole('button', { name: /加入方法对照/ })).not.toBeInTheDocument()
    expect(within(dossier).getAllByRole('img')).toHaveLength(1)

    await user.click(within(dossier).getByRole('button', { name: '选择案例 Live Mill Conversion' }))
    expect(within(dossier).getByRole('button', { name: '取消选择案例 Live Mill Conversion' })).toBePressed()
    const collectionDock = screen.getByRole('region', { name: '收藏选择' })
    expect(within(collectionDock).getByText('已选 1 个项目案例（最多 6 个）')).toBeVisible()
  })

  it('saves an architectural project directly without entering case selection', async () => {
    const user = userEvent.setup()
    const fetchMock = createLiveFetch({ existingRunStatus: 'completed' })
    vi.stubGlobal('fetch', fetchMock)
    renderBoard()

    await user.click(await screen.findByRole('button', { name: `打开研究：${liveQuestion}` }))
    const dossier = await screen.findByRole('article', { name: '代表案例 Live Mill Conversion' })
    const selectButton = within(dossier).getByRole('button', { name: '选择案例 Live Mill Conversion' })
    expect(within(dossier).getByRole('button', { name: '加入个人收藏 Live Mill Conversion' })).toBeVisible()
    expect(selectButton).not.toBePressed()
    expect(screen.queryByRole('region', { name: '收藏选择' })).not.toBeInTheDocument()

    await user.click(within(dossier).getByRole('button', { name: '加入个人收藏 Live Mill Conversion' }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/v1/results/asset-live/save', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ note: '', subquestion_ids: ['program'] }),
      })
    })
    expect(selectButton).not.toBePressed()
    expect(within(dossier).getByRole('button', { name: '已加入收藏 Live Mill Conversion' })).toBeDisabled()
    expect(screen.queryByRole('region', { name: '收藏选择' })).not.toBeInTheDocument()
  })

  it('selects the same case independently per subquestion and clears every selection after saving', async () => {
    const user = userEvent.setup()
    const subquestions = [
      liveSubquestions[0],
      { id: 'circulation', question: '新旧流线怎样避免冲突？', rationale: '核对路径分流方式' },
    ]
    const fetchMock = createLiveFetch({
      existingRunStatus: 'completed',
      subquestions,
      candidates: [{
        ...candidate,
        subquestion_ids: ['program', 'circulation'],
        subquestion_analysis: {
          program: {
            project_context: candidate.project_context,
            design_mechanism: candidate.design_mechanism,
            transfer_strategy: candidate.transfer_strategy,
            observations: candidate.observations,
            limitations: candidate.limitations,
          },
          circulation: {
            project_context: candidate.project_context,
            design_mechanism: '独立交通核把公众路径与后勤路径分开。',
            transfer_strategy: ['先画出两套连续路径', '再把交叉点集中到可控门厅'],
            observations: candidate.observations,
            limitations: candidate.limitations,
          },
        },
      }],
    })
    vi.stubGlobal('fetch', fetchMock)
    renderBoard()

    await user.click(await screen.findByRole('button', { name: `打开研究：${liveQuestion}` }))
    await screen.findAllByRole('article', { name: '代表案例 Live Mill Conversion' })
    const dossiers = screen.getAllByRole('article', { name: '代表案例 Live Mill Conversion' })
    expect(dossiers).toHaveLength(2)
    const firstButton = within(dossiers[0]).getByRole('button', { name: '选择案例 Live Mill Conversion' })
    const secondButton = within(dossiers[1]).getByRole('button', { name: '选择案例 Live Mill Conversion' })
    expect(firstButton).not.toBePressed()
    expect(secondButton).not.toBePressed()

    await user.click(firstButton)
    expect(firstButton).toBePressed()
    expect(secondButton).not.toBePressed()

    await user.click(secondButton)
    expect(firstButton).toBePressed()
    expect(secondButton).toBePressed()
    const collectionDock = screen.getByRole('region', { name: '收藏选择' })
    expect(within(collectionDock).getByText('已选 2 个项目案例（最多 6 个）')).toBeVisible()
    await user.click(within(collectionDock).getByRole('button', { name: '添加 2 项到个人收藏' }))

    await waitFor(() => {
      expect(within(dossiers[0]).getByRole('button', { name: '选择案例 Live Mill Conversion' })).not.toBePressed()
      expect(within(dossiers[1]).getByRole('button', { name: '选择案例 Live Mill Conversion' })).not.toBePressed()
    })
    const saveCalls = fetchMock.mock.calls.filter(
      ([path, init]) => path === '/v1/results/asset-live/save' && (init as RequestInit).method === 'POST',
    )
    expect(saveCalls).toHaveLength(1)
    expect(JSON.parse(String((saveCalls[0][1] as RequestInit).body))).toEqual({
      note: '',
      subquestion_ids: ['program', 'circulation'],
    })
    const finalBoardPatch = fetchMock.mock.calls.filter(
      ([path, init]) => path === '/v1/runs/run-live/board' && (init as RequestInit | undefined)?.method === 'PATCH',
    ).at(-1)
    expect(JSON.parse(String((finalBoardPatch?.[1] as RequestInit).body))).toEqual({
      selected_asset_ids: [],
    })
    expect(within(screen.getByRole('region', { name: '收藏选择' })).getByText('已保存 2 项，选择已清空')).toBeVisible()
    await user.click(within(dossiers[0]).getByRole('button', { name: '选择案例 Live Mill Conversion' }))
    expect(within(screen.getByRole('region', { name: '收藏选择' })).getByText('已选 1 个项目案例（最多 6 个）')).toBeVisible()
  })

  it('shows a question judgment and two representative cases before the full evidence inventory', async () => {
    const user = userEvent.setup()
    const courtyardMechanism = '连续内院把分散的公共房间串成可识别的到达序列。'
    const warehouseMechanism = '独立服务核把后勤运输与公共到达分开。'
    vi.stubGlobal('fetch', createLiveFetch({
      existingRunStatus: 'completed',
      candidates: [
        candidate,
        {
          ...candidate,
          id: 'asset-live-courtyard',
          project_name: 'Courtyard Mill',
          source_url: 'https://example.com/courtyard-mill',
          rank_index: 1,
          design_mechanism: courtyardMechanism,
          transfer_strategy: ['把主要公共节点串成一条连续路径', '再补充次要停留节点'],
          limitations: ['需要场地具备可连续打开的首层界面。'],
          evidence_claims: [{
            ...candidate.evidence_claims[0],
            id: 'claim-courtyard',
            asset_candidate_id: 'asset-live-courtyard',
            source_url: 'https://example.com/courtyard-mill#evidence',
          }],
        },
        {
          ...candidate,
          id: 'asset-live-warehouse',
          project_name: 'Warehouse Forum',
          source_url: 'https://example.com/warehouse-forum',
          rank_index: 2,
          design_mechanism: warehouseMechanism,
          transfer_strategy: ['把装卸、电梯和设备维护集中到独立服务核'],
          limitations: ['需要预留独立后勤入口和防火分区。'],
          evidence_claims: [{
            ...candidate.evidence_claims[0],
            id: 'claim-warehouse',
            asset_candidate_id: 'asset-live-warehouse',
            source_url: 'https://example.com/warehouse-forum#evidence',
          }],
        },
      ],
    }))
    renderBoard()

    await user.click(await screen.findByRole('button', { name: `打开研究：${liveQuestion}` }))
    const chapter = screen.getByRole('region', { name: liveSubquestions[0].question })
    const chapterHeading = chapter.querySelector('.case-chapter-heading')
    expect(chapterHeading).toHaveTextContent(candidate.design_mechanism)
    expect(chapterHeading).not.toHaveTextContent(courtyardMechanism)

    const mill = within(chapter).getByRole('article', { name: '代表案例 Live Mill Conversion' })
    expect(mill).not.toHaveTextContent(candidate.design_mechanism)
    expect(mill).toHaveTextContent(candidate.transfer_strategy[0])
    expect(mill).toHaveTextContent(candidate.transfer_strategy[1])
    expect(mill).not.toHaveTextContent(candidate.limitations[0])
    expect(within(chapter).getByRole('article', { name: '代表案例 Courtyard Mill' })).toBeVisible()
    const warehouse = within(chapter).getByRole('article', { name: '代表案例 Warehouse Forum' })
    expect(warehouse).toBeVisible()
    expect(warehouse).toHaveTextContent(warehouseMechanism)
    expect(chapter.querySelector('details')).toBeNull()
    expect([...chapter.querySelectorAll('.case-answer-title')].map((item) => item.textContent)).toEqual([
      'Live Mill Conversion',
      'Courtyard Mill',
      'Warehouse Forum',
    ])
    expect(within(chapter).queryByText(/来源|原文|证据|核验/)).not.toBeInTheDocument()
  })

  it('leads each subquestion with one conclusion before its complete case answers', async () => {
    const user = userEvent.setup()
    const courtyardMechanism = '连续内院把分散的公共房间串成可识别的到达序列。'
    const courtyardTransfer = '把主要公共节点串成一条连续路径'
    const courtyardLimitation = '需要场地具备可连续打开的首层界面。'
    const courtyardObservation = '鸟瞰图里可以看到三个内院。'
    vi.stubGlobal('fetch', createLiveFetch({
      existingRunStatus: 'completed',
      candidates: [
        candidate,
        {
          ...candidate,
          id: 'asset-live-courtyard',
          project_name: 'Courtyard Mill',
          source_url: 'https://example.com/courtyard-mill',
          project_context: '旧建筑由数个分散厂房组成。',
          design_mechanism: courtyardMechanism,
          transfer_strategy: [courtyardTransfer],
          observations: [courtyardObservation],
          limitations: [courtyardLimitation],
          evidence_claims: [{
            ...candidate.evidence_claims[0],
            id: 'claim-courtyard',
            asset_candidate_id: 'asset-live-courtyard',
          }],
        },
      ],
    }))
    renderBoard()

    await user.click(await screen.findByRole('button', { name: `打开研究：${liveQuestion}` }))
    await screen.findByRole('article', { name: '代表案例 Courtyard Mill' })

    const chapter = document.getElementById('case-chapter-program')?.closest('.case-chapter')
    expect(chapter).not.toBeNull()
    const heading = chapter?.querySelector('.case-chapter-heading')
    expect(heading).toHaveTextContent(candidate.design_mechanism)
    expect(heading).not.toHaveTextContent(courtyardMechanism)
    expect(heading).not.toHaveTextContent(candidate.transfer_strategy[0])
    expect(heading).not.toHaveTextContent(candidate.limitations[0])
    expect(heading).not.toHaveTextContent(candidate.observations[0])
    expect(heading).not.toHaveTextContent(courtyardObservation)
    expect(heading?.nextElementSibling).toHaveClass('case-answer-list')
    expect(within(chapter as HTMLElement).queryByRole('heading', { name: '问题小结' })).not.toBeInTheDocument()

    const courtyard = within(chapter as HTMLElement).getByRole('article', {
      name: '代表案例 Courtyard Mill',
    })
    expect(courtyard).toHaveTextContent(courtyardMechanism)
    expect(courtyard).toHaveTextContent(courtyardTransfer)
    expect(courtyard).toHaveTextContent(courtyardLimitation)
    expect(courtyard).not.toHaveTextContent(courtyardObservation)
  })

  it('counts text-grounded projects once when they have multiple result assets', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', createLiveFetch({
      existingRunStatus: 'completed',
      candidates: [
        { ...candidate, has_local_content: false },
        {
          ...candidate,
          id: 'asset-live-plan',
          asset_type: 'plan',
          evidence_claims: [{
            ...candidate.evidence_claims[0],
            id: 'claim-plan',
            asset_candidate_id: 'asset-live-plan',
          }],
          has_local_content: false,
        },
      ],
    }))
    renderBoard()

    await user.click(await screen.findByRole('button', { name: `打开研究：${liveQuestion}` }))
    await screen.findByRole('article', { name: '代表案例 Live Mill Conversion' })
    expect(await screen.findByRole('heading', { name: '案例研究结果' })).toBeVisible()
    const dossier = screen.getByRole('article', { name: '代表案例 Live Mill Conversion' })
    expect(dossier).toBeVisible()
    expect(screen.getAllByRole('article', { name: '代表案例 Live Mill Conversion' })).toHaveLength(1)
  })

  it('does not promote a legacy image lead into a project case without article-grounded analysis', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', createLiveFetch({
      existingRunStatus: 'completed',
      candidateOverrides: {
        project_context: 'The project retains the original factory frame.',
        design_mechanism: 'A new public route crosses the old hall.',
        transfer_strategy: ['Separate public and service circulation.'],
        facts: ['The project page identifies the retained structure.'],
        observations: ['The section shows a new inserted floor.'],
        inferences: ['Use the inserted floor as a circulation buffer.'],
        limitations: ['The structural span must be checked.'],
        publication_tier: 'trusted_secondary',
        rights_status: 'restricted',
      },
    }))
    renderBoard()

    await user.click(await screen.findByRole('button', { name: `打开研究：${liveQuestion}` }))
    expect(await screen.findByRole('heading', { name: '案例研究结果' })).toBeVisible()
    expect(screen.queryByRole('article', { name: '代表案例 Live Mill Conversion' })).not.toBeInTheDocument()
    expect(screen.queryByText('现有记录只确认图纸类型与来源关系，不足以断言更具体的空间机制。')).not.toBeInTheDocument()
    expect(screen.queryByText('先用这张剖面图核对与当前子问题直接相关的空间关系。')).not.toBeInTheDocument()
    expect(screen.queryByText('此历史结果的项目条件为外文；重新研究后可生成中文分析。')).not.toBeInTheDocument()
    expect(screen.queryByText('连接扩展并重新研究，生成中文转译步骤。')).not.toBeInTheDocument()
    expect(screen.queryByText('尚未生成中文视觉观察。')).not.toBeInTheDocument()
    expect(screen.queryByText('The project retains the original factory frame.')).not.toBeInTheDocument()
    expect(screen.queryByText('A new public route crosses the old hall.')).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: /问题小结/ })).not.toBeInTheDocument()
  })

  it('keeps a text-grounded case usable when the browser extension was disconnected', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', createLiveFetch({
      existingRunStatus: 'completed',
      browserConnected: false,
      eventTool: 'browser',
      eventSummary: {
        source_url: 'https://example.com/live-mill',
        status: 'skipped',
        error_type: 'BrowserUnavailableError',
      },
    }))
    renderBoard()

    await user.click(await screen.findByRole('button', { name: `打开研究：${liveQuestion}` }))
    await screen.findByRole('article', { name: '代表案例 Live Mill Conversion' })
    expect(screen.getByText(candidate.design_mechanism)).toBeVisible()
    expect(screen.queryByText(/暂无项目预览|打开原始来源/)).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /来源/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '重新研究' })).not.toBeInTheDocument()
  })

  it('pairs the installed extension without asking the user to copy a code', async () => {
    const user = userEvent.setup()
    vi.mocked(requestBrowserBridge).mockResolvedValue({
      paired: true,
      connection: 'connecting',
      researchPermission: false,
    })
    vi.stubGlobal('fetch', createLiveFetch({
      browserStatuses: [false, true],
      pairingCode: '731904',
    }))
    renderBoard()

    await screen.findByText('真实工作区')
    await user.click(screen.getByRole('button', { name: /图纸灵感.*配色、线型、版式与分析图/ }))
    expect(await screen.findByText('研究环境待连接')).toBeVisible()
    expect(screen.getByText('连接 Chrome 后可搜索小红书，并读取当前页面高清图')).toBeVisible()
    expect(screen.queryByText('图纸提取未连接')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '连接 Chrome 读取高清图纸' }))

    expect(requestBrowserBridge).toHaveBeenNthCalledWith(2, { type: 'status' })
    expect(requestBrowserBridge).toHaveBeenNthCalledWith(3, {
      type: 'pair',
      endpoint: 'ws://127.0.0.1:8000/v1/browser',
      token: '731904',
    })
    expect(await screen.findByText('图纸提取扩展已连接', {}, { timeout: 2_000 })).toBeVisible()
    expect(within(await screen.findByRole('region', { name: '研究环境' })).getByText(
      'Chrome 读取当前页面需授权：点击浏览器工具栏的 ArchResearch，选择“允许网页读取”，再点“刷新”',
    )).toBeVisible()
    expect(screen.queryByText('731904')).not.toBeInTheDocument()
  })

  it('opens the fixed board URL in Chrome when the current page cannot host the extension', async () => {
    const user = userEvent.setup()
    vi.mocked(requestBrowserBridge).mockRejectedValue(
      new BrowserBridgeError('unavailable', 'bridge unavailable'),
    )
    const fetchMock = createLiveFetch({ browserConnected: false })
    vi.stubGlobal('fetch', fetchMock)
    renderBoard()

    await screen.findByText('真实工作区')
    await user.click(screen.getByRole('button', { name: /图纸灵感.*配色、线型、版式与分析图/ }))
    await user.click(await screen.findByRole('button', { name: '连接 Chrome 读取高清图纸' }))

    expect(await screen.findByText(
      '已在 Chrome 打开本页；新页面会自动连接扩展。当前公开网页研究不受影响。',
    )).toBeVisible()
    expect(requestBrowserBridge).toHaveBeenCalledWith({ type: 'status' })
    expect(fetchMock).toHaveBeenCalledWith('/v1/browser/open-chrome', { method: 'POST' })
    expect(fetchMock).not.toHaveBeenCalledWith(
      '/v1/browser/pairing-code',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('automatically pairs after the local service opens the board in Chrome', async () => {
    const user = userEvent.setup()
    vi.mocked(requestBrowserBridge)
      .mockResolvedValueOnce({ paired: false, connection: 'disconnected', researchPermission: false })
      .mockResolvedValue({ paired: true, connection: 'connecting', researchPermission: false })
    vi.stubGlobal('fetch', createLiveFetch({ browserStatuses: [false, true], pairingCode: '731904' }))
    renderBoard('?connect=chrome&attempt=acceptance-2')

    await waitFor(() => {
      expect(requestBrowserBridge).toHaveBeenCalledWith({
        type: 'pair',
        endpoint: 'ws://127.0.0.1:8000/v1/browser',
        token: '731904',
      })
    })
    await screen.findByText('真实工作区')
    await user.click(screen.getByRole('button', { name: /图纸灵感.*配色、线型、版式与分析图/ }))
    expect(await screen.findByText('图纸提取扩展已连接')).toBeVisible()
    expect(window.location.search).toBe('')
  })

  it('shows a remote recognition image without source metadata', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', createLiveFetch({
      existingRunStatus: 'completed',
      candidateOverrides: { image_url: 'https://images.example.org/section.jpg' },
    }))
    renderBoard()

    await user.click(await screen.findByRole('button', { name: `打开研究：${liveQuestion}` }))
    await screen.findByRole('article', { name: '代表案例 Live Mill Conversion' })
    const remoteImage = await screen.findByRole('img', { name: 'Live Mill Conversion 剖面图' })
    expect(remoteImage).toHaveAttribute('src', 'https://images.example.org/section.jpg')
    expect(screen.queryByText('公开网页预览')).not.toBeInTheDocument()
  })

  it('removes a broken recognition image while preserving the case answer', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', createLiveFetch({
      candidateOverrides: { image_url: 'https://images.example.org/broken-section.jpg' },
    }))
    renderBoard()

    await startLiveResearch(user)
    await screen.findByRole('article', { name: '代表案例 Live Mill Conversion' })
    const remoteImage = await screen.findByRole('img', { name: 'Live Mill Conversion 剖面图' })
    fireEvent.error(remoteImage)

    expect(screen.queryByRole('img', { name: 'Live Mill Conversion 剖面图' })).not.toBeInTheDocument()
    expect(screen.getByText(candidate.design_mechanism)).toBeVisible()
    expect(screen.queryByText(/暂无项目预览|来源链接/)).not.toBeInTheDocument()
  })

  it('prefers a local recognition image without exposing extraction metadata', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', createLiveFetch({
      existingRunStatus: 'completed',
      hasLocalContent: true,
      candidateOverrides: { image_url: 'https://images.example.org/section.jpg' },
    }))
    renderBoard()

    await user.click(await screen.findByRole('button', { name: `打开研究：${liveQuestion}` }))
    await screen.findByRole('article', { name: '代表案例 Live Mill Conversion' })
    const localImage = await screen.findByRole('img', { name: 'Live Mill Conversion 剖面图' })
    expect(localImage).toHaveAttribute('src', '/v1/assets/asset-live/content')
    expect(screen.queryByText('Chrome 项目预览')).not.toBeInTheDocument()
  })

  it('starts architectural research without checking optional Chrome access', async () => {
    const user = userEvent.setup()
    const fetchMock = createLiveFetch({ browserConnected: true, initialStatus: 'searching' })
    vi.stubGlobal('fetch', fetchMock)
    renderBoard()

    await screen.findByText('真实工作区')
    const bridgeCallsBeforeStart = vi.mocked(requestBrowserBridge).mock.calls.length
    await startLiveResearch(user)

    expect(vi.mocked(requestBrowserBridge).mock.calls).toHaveLength(bridgeCallsBeforeStart)
    expect(fetchMock).toHaveBeenCalledWith(
      '/v1/workspaces/workspace-live/runs',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(await screen.findByRole('heading', { name: liveQuestion })).toBeVisible()
    expect(screen.getByText('正在从公开网页中寻找相关项目与原始来源')).toBeVisible()
    expect(screen.queryByRole('heading', { name: '从一个具体设计问题开始' })).not.toBeInTheDocument()
  })

  it('does not block architectural research when optional Chrome access is absent', async () => {
    const user = userEvent.setup()
    const fetchMock = createLiveFetch({ browserConnected: true })
    vi.mocked(requestBrowserBridge).mockResolvedValue({
      paired: true,
      connection: 'connected',
      researchPermission: false,
    })
    vi.stubGlobal('fetch', fetchMock)
    renderBoard()

    await startLiveResearch(user)

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      '/v1/workspaces/workspace-live/runs',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('requires a connected Chrome session before starting Xiaohongshu research', async () => {
    const user = userEvent.setup()
    const fetchMock = createLiveFetch({ browserConnected: false })
    vi.stubGlobal('fetch', fetchMock)
    renderBoard()

    await startVisualResearch(user)

    expect(screen.getByRole('alert')).toHaveTextContent('请先在 Chrome 登录小红书并连接 ArchResearch')
    expect(fetchMock).not.toHaveBeenCalledWith(
      '/v1/workspaces/workspace-live/runs',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('starts Xiaohongshu research through the configured OpenCLI backend without the extension', async () => {
    const user = userEvent.setup()
    const fetchMock = createLiveFetch({
      browserConnected: false,
      xiaohongshuSearchAvailable: true,
      initialStatus: 'searching',
    })
    vi.stubGlobal('fetch', fetchMock)
    renderBoard()

    await screen.findByText('真实工作区')
    await user.click(screen.getByRole('button', { name: /图纸灵感.*配色、线型、版式与分析图/ }))
    expect(await screen.findByText('研究环境已就绪')).toBeVisible()
    expect(screen.getByText('小红书负责查找灵感 · 连接 Chrome 可读取当前页面高清图')).toBeVisible()
    expect(screen.queryByText('OpenCLI 已配置 · 运行时验证登录态')).not.toBeInTheDocument()
    await user.type(screen.getByRole('textbox', { name: '研究问题' }), '从小红书寻找旧建筑剖面灵感')
    await user.click(screen.getByRole('button', { name: '查找灵感' }))

    expect(fetchMock).toHaveBeenCalledWith(
      '/v1/workspaces/workspace-live/runs',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(screen.queryByText('请先在 Chrome 登录小红书并连接 ArchResearch')).not.toBeInTheDocument()
  })

  it('sends Xiaohongshu as an explicit research source after Chrome authorization', async () => {
    const user = userEvent.setup()
    const fetchMock = createLiveFetch({ browserConnected: true, initialStatus: 'searching' })
    vi.stubGlobal('fetch', fetchMock)
    renderBoard()

    await startVisualResearch(user)

    const startCall = fetchMock.mock.calls.find(([path, init]) => (
      path === '/v1/workspaces/workspace-live/runs'
      && (init as RequestInit | undefined)?.method === 'POST'
    ))
    expect(JSON.parse(String((startCall?.[1] as RequestInit).body))).toMatchObject({
      research_sources: ['xiaohongshu'],
    })
  })

  it('does not silently skip drawing inspiration when the extension belongs to another surface', async () => {
    const user = userEvent.setup()
    const fetchMock = createLiveFetch({ browserConnected: true, initialStatus: 'searching' })
    vi.mocked(requestBrowserBridge).mockRejectedValue(
      new BrowserBridgeError('unavailable', 'bridge unavailable on this surface'),
    )
    vi.stubGlobal('fetch', fetchMock)
    renderBoard()

    await startVisualResearch(user)

    expect(requestBrowserBridge).toHaveBeenCalledWith({ type: 'status' })
    expect(fetchMock).not.toHaveBeenCalledWith(
      '/v1/workspaces/workspace-live/runs',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(screen.getByRole('alert')).toHaveTextContent('请先在 Chrome 登录小红书并连接 ArchResearch')
  })

  it('does not rerun completed precedent research just to add an image', async () => {
    const user = userEvent.setup()
    const fetchMock = createLiveFetch({
      existingRunStatus: 'completed',
      initialStatus: 'searching',
      browserConnected: true,
      eventTool: 'browser',
      eventSummary: {
        source_url: 'https://example.com/live-mill',
        status: 'skipped',
        error_type: 'BrowserUnavailableError',
      },
    })
    vi.stubGlobal('fetch', fetchMock)
    renderBoard()

    await user.click(await screen.findByRole('button', { name: `打开研究：${liveQuestion}` }))
    await screen.findByRole('article', { name: '代表案例 Live Mill Conversion' })
    expect(screen.queryByText('暂无项目预览')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /来源/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '重新研究' })).not.toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalledWith(
      '/v1/workspaces/workspace-live/runs',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('does not flash the previous run results after a new run starts', async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      createLiveFetch({ existingRunStatus: 'completed', initialStatus: 'searching' }),
    )
    renderBoard()

    await user.click(await screen.findByRole('button', { name: `打开研究：${liveQuestion}` }))
    expect(await screen.findByRole('article', { name: '代表案例 Live Mill Conversion' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: '返回主页' }))
    expect(screen.getByRole('textbox', { name: '研究问题' })).toHaveValue('')
    await user.type(screen.getByRole('textbox', { name: '研究问题' }), '开始另一个研究任务')
    await user.click(screen.getByRole('button', { name: '开始研究' }))

    expect(screen.queryByText('Live Mill Conversion')).not.toBeInTheDocument()
  })

  it('names project creation explicitly', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', createLiveFetch())
    renderBoard()

    const createToggle = await screen.findByRole('button', { name: '新建项目' })
    expect(screen.queryByRole('button', { name: '新建' })).not.toBeInTheDocument()
    await user.click(createToggle)

    expect(screen.getByRole('button', { name: '创建项目' })).toBeDisabled()
  })

  it('keeps only project creation beside the flat question history', async () => {
    vi.stubGlobal('fetch', createLiveFetch())
    const { container } = renderBoard()

    const recentResearch = await screen.findByRole('region', { name: '最近研究' })
    const appHeader = container.querySelector('.app-header')

    expect(appHeader).not.toBeNull()
    expect(within(recentResearch).getByRole('button', { name: '新建项目' })).toBeVisible()
    expect(within(recentResearch).queryByRole('button', { name: /切换研究项目/ })).not.toBeInTheDocument()
    expect(within(recentResearch).queryByText('当前项目')).not.toBeInTheDocument()
    expect(within(recentResearch).queryByText('历史归档')).not.toBeInTheDocument()
    expect(within(appHeader as HTMLElement).queryByRole('button', { name: /切换研究项目/ })).not.toBeInTheDocument()
    expect(within(appHeader as HTMLElement).queryByRole('button', { name: '新建项目' })).not.toBeInTheDocument()
  })

  it('hides project management while reading a research result', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', createLiveFetch({ existingRunStatus: 'completed' }))
    renderBoard()

    await user.click(await screen.findByRole('button', { name: `打开研究：${liveQuestion}` }))
    expect(await screen.findByRole('heading', { name: '案例研究结果' })).toBeVisible()

    expect(screen.queryByRole('button', { name: /切换研究项目/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '新建项目' })).not.toBeInTheDocument()
  })

  it('updates the background workspace when a question record is opened', async () => {
    const user = userEvent.setup()
    window.localStorage.setItem('archresearch.activeWorkspaceId', 'workspace-two')
    vi.stubGlobal('fetch', createLiveFetch({
      existingRunStatus: 'completed',
      workspaces: [workspace, { ...workspace, id: 'workspace-two', name: '第二工作区' }],
    }))
    renderBoard()

    await user.click(await screen.findByRole('button', { name: `打开研究：${liveQuestion}` }))

    expect(window.localStorage.getItem('archresearch.activeWorkspaceId')).toBe('workspace-live')
  })

  it('hides project management while a historical run is active', async () => {
    const user = userEvent.setup()
    const { fetchMock, releaseHydration } = createWorkspaceRaceFetch()
    vi.stubGlobal('fetch', fetchMock)
    renderBoard()

    const recentResearch = await screen.findByRole('region', { name: '最近研究' })
    await user.click(await within(recentResearch).findByRole('button', { name: '打开研究：仍在运行的旧任务' }))
    expect(await screen.findByRole('status')).toHaveTextContent('正在搜索')
    expect(screen.queryByRole('button', { name: /切换研究项目/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '新建项目' })).not.toBeInTheDocument()
    await act(async () => {
      releaseHydration()
      await Promise.resolve()
      await Promise.resolve()
    })
  })

  it('ignores a new-run response after the user switches workspaces', async () => {
    const user = userEvent.setup()
    const { fetchMock, releaseStart, startGate } = createSubmitRaceFetch()
    vi.stubGlobal('fetch', fetchMock)
    renderBoard()

    await screen.findByText('真实工作区')
    await user.type(screen.getByRole('textbox', { name: '研究问题' }), '来自旧工作区的请求')
    await user.click(screen.getByRole('button', { name: '开始研究' }))
    await createProjectFromHome(user)
    await act(async () => {
      releaseStart()
      await startGate
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '打开研究：来自旧工作区的请求' })).not.toBeInTheDocument()
  })

  it('ignores a new-run failure after the user switches workspaces', async () => {
    const user = userEvent.setup()
    const { fetchMock, releaseStart, startGate } = createSubmitRaceFetch(true)
    vi.stubGlobal('fetch', fetchMock)
    renderBoard()

    await screen.findByText('真实工作区')
    await user.type(screen.getByRole('textbox', { name: '研究问题' }), '来自旧工作区的请求')
    await user.click(screen.getByRole('button', { name: '开始研究' }))
    await createProjectFromHome(user)
    await act(async () => {
      releaseStart()
      await startGate
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(screen.getByRole('button', { name: '新建项目' })).toBeVisible()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('does not let an in-flight poll overwrite a successful cancellation', async () => {
    const user = userEvent.setup()
    const { fetchMock, releasePoll, pollGate } = createPollingWorkspaceRaceFetch()
    vi.stubGlobal('fetch', fetchMock)
    renderBoard()

    const recentResearch = await screen.findByRole('region', { name: '最近研究' })
    await user.click(await within(recentResearch).findByRole('button', { name: '打开研究：旧工作区正在研究的任务' }))
    expect(await screen.findByRole('status')).toHaveTextContent('正在搜索')
    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([input]) => String(input) === '/v1/runs/run-polling')).toBe(true)
    }, { timeout: 2_000 })
    await user.click(screen.getByRole('button', { name: '取消研究' }))
    expect(screen.getByRole('status')).toHaveTextContent('已取消')
    await act(async () => {
      releasePoll()
      await pollGate
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(screen.getByRole('status')).toHaveTextContent('已取消')
  }, 4_000)

  it('keeps the new workspace home open when terminal hydration finishes late', async () => {
    const user = userEvent.setup()
    const { fetchMock, releaseHydration, hydrationGate } = createTerminalSubmitHydrationRaceFetch()
    vi.stubGlobal('fetch', fetchMock)
    renderBoard()

    await screen.findByText('真实工作区')
    await user.type(screen.getByRole('textbox', { name: '研究问题' }), '即时完成的旧工作区任务')
    await user.click(screen.getByRole('button', { name: '开始研究' }))
    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([input]) => String(input) === '/v1/runs/run-terminal-submit/results')).toBe(true)
    })
    await createProjectFromHome(user)
    await act(async () => {
      releaseHydration()
      await hydrationGate
      await new Promise<void>((resolve) => setTimeout(resolve, 0))
    })

    expect(screen.getByRole('heading', { name: '从一个卡住你的地方开始' })).toBeVisible()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('shows a real bootstrap error instead of substituting mock projects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ detail: '数据库不可用' }, 503)))
    renderBoard()

    expect(await screen.findByRole('alert')).toHaveTextContent('数据库不可用')
    expect(screen.queryByText('Kamala Narayana Temple Survey')).not.toBeInTheDocument()
  })

  it('polls a background run through real stages before loading results', async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      createLiveFetch({ initialStatus: 'created', pollStatuses: ['searching', 'completed'] }),
    )
    renderBoard()
    await startLiveResearch(user)

    expect(await screen.findByText('正在搜索', {}, { timeout: 2_000 })).toBeVisible()

    expect(await screen.findByRole(
      'article',
      { name: '代表案例 Live Mill Conversion' },
      { timeout: 3_000 },
    )).toBeVisible()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  }, 8_000)

  it('shows usable reference count from an active gap-check checkpoint', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', createLiveFetch({
      initialStatus: 'created',
      pollStatuses: ['gap_check'],
      pollCoverageReport: {
        usable_assets: 3,
        project_count: 2,
        verified_or_partial: 2,
        subquestion_count: 3,
        covered_subquestions: 1,
        gaps: ['uncovered_subquestions'],
      },
    }))
    renderBoard()
    await startLiveResearch(user)

    expect(await screen.findByText('3 条可用参考', {}, { timeout: 2_000 })).toBeVisible()
    expect(screen.getByRole('status')).not.toHaveTextContent('0 条可用参考')
  })

  it('shows an answer-first synthesis without evidence counts or audit disclosure', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', createLiveFetch({
      initialStatus: 'completed',
      coverageReport: {
        usable_assets: 1,
        project_count: 1,
        verified_or_partial: 1,
        gaps: [],
        synthesis: {
          answer: {
            statement: '先划定旧结构不可触碰区，再以独立系统植入公共功能。',
            evidence_asset_ids: ['asset-live'],
          },
          causal_chains: [{
            statement: '结构保留约束促使新增体量脱开布置，从而降低对原构件的干预。',
            evidence_asset_ids: ['asset-live'],
          }],
          comparisons: [{
            statement: '独立植入比贴附改造更容易保持新旧系统可辨。',
            evidence_asset_ids: ['asset-live'],
          }],
          conflicts: [{
            statement: '来源未给出结构复核结果，承载可行性仍不确定。',
            evidence_asset_ids: ['asset-live'],
          }],
          applicability_boundaries: [
            {
              statement: '【证据边界】正文没有说明节点承载力，不能直接证明结构可行。',
              evidence_asset_ids: ['asset-live'],
            },
            {
              statement: '只有在净高与结构余量足够时，独立植入才成立。',
              evidence_asset_ids: ['asset-live'],
            },
          ],
          recommendations: [{
            statement: '【转译建议｜结构植入】先在现状图上标出结构禁改区，再布置独立公共层与服务核。该建议转译自现有来源。',
            evidence_asset_ids: ['asset-live'],
          }],
        },
      },
    }))
    renderBoard()
    await startLiveResearch(user)

    const synthesis = await screen.findByRole('region', { name: '研究结论' })
    expect(within(synthesis).getByRole('heading', {
      name: '先划定旧结构不可触碰区，再以独立系统植入公共功能。',
    })).toBeVisible()
    expect(within(synthesis).queryByText('结构保留约束促使新增体量脱开布置，从而降低对原构件的干预。')).not.toBeInTheDocument()
    expect(within(synthesis).getByText('先在现状图上标出结构禁改区，再布置独立公共层与服务核。')).toBeVisible()
    expect(within(synthesis).getByText('只有在净高与结构余量足够时，独立植入才成立。')).toBeVisible()
    expect(within(synthesis).queryByText(/证据边界|正文没有说明|不能直接证明|该建议转译自/)).not.toBeInTheDocument()
    expect(within(synthesis).queryByText('来源未给出结构复核结果，承载可行性仍不确定。')).not.toBeInTheDocument()
    expect(synthesis.querySelector('details')).toBeNull()
    expect(within(synthesis).queryByText(/原文|证据|来源/)).not.toBeInTheDocument()
  })

  it('does not restate the section label inside the action and applicability text', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', createLiveFetch({
      initialStatus: 'completed',
      coverageReport: {
        usable_assets: 1,
        project_count: 1,
        verified_or_partial: 1,
        gaps: [],
        synthesis: {
          answer: {
            statement: '先划定旧结构不可触碰区，再以独立系统植入公共功能。',
            evidence_asset_ids: ['asset-live'],
          },
          causal_chains: [{
            statement: '结构保留约束促使新增体量脱开布置。',
            evidence_asset_ids: ['asset-live'],
          }],
          comparisons: [],
          conflicts: [],
          applicability_boundaries: [{
            statement: '适用边界：仅当净高与结构余量足够时，独立植入才成立。',
            evidence_asset_ids: ['asset-live'],
          }],
          recommendations: [{
            statement: '转译建议：按柱网、屋架、围护分层，再布置独立公共层。',
            evidence_asset_ids: ['asset-live'],
          }],
        },
      },
    }))
    renderBoard()
    await startLiveResearch(user)

    const synthesis = await screen.findByRole('region', { name: '研究结论' })
    expect(within(synthesis).getByText('按柱网、屋架、围护分层，再布置独立公共层。')).toBeVisible()
    expect(within(synthesis).getByText('仅当净高与结构余量足够时，独立植入才成立。')).toBeVisible()
    expect(within(synthesis).queryByText(/转译建议[：:]/)).not.toBeInTheDocument()
    expect(within(synthesis).queryByText(/适用边界[：:]/)).not.toBeInTheDocument()
  })

  it('does not present a source disclaimer as an applicability condition', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', createLiveFetch({
      existingRunStatus: 'completed',
      candidateOverrides: {
        limitations: ['页面没有提供透视校正方法、构件分层规则或恢复尺度的技术流程。'],
      },
    }))
    renderBoard()

    await user.click(await screen.findByRole('button', { name: `打开研究：${liveQuestion}` }))
    const dossier = await screen.findByRole('article', { name: '代表案例 Live Mill Conversion' })
    expect(within(dossier).queryByText('适用条件')).not.toBeInTheDocument()
    expect(within(dossier).queryByText(/页面没有提供/)).not.toBeInTheDocument()
  })

  it('turns machine-shaped fallback synthesis into a concise result without exposing raw text', async () => {
    const user = userEvent.setup()
    const rawStatement = '【本地证据汇总】；Instituto Moreira Salles：连续外廊组织公共到达与展厅入口；SESC 24 de Maio：竖向公共路径串联多层活动。'
    vi.stubGlobal('fetch', createLiveFetch({
      initialStatus: 'completed',
      coverageReport: {
        usable_assets: 4,
        project_count: 2,
        verified_or_partial: 4,
        gaps: [],
        synthesis: {
          generation_mode: 'deterministic_fallback',
          answer: {
            statement: rawStatement,
            evidence_asset_ids: ['asset-live'],
          },
          causal_chains: [{
            statement: '条件：入口分散且公共活动跨越多层；机制：连续外廊把公共到达、展厅入口与竖向交通串成清晰环路；转译：先画出不交叉的公共环线。',
            evidence_asset_ids: ['asset-live'],
          }],
          comparisons: [],
          conflicts: [],
          applicability_boundaries: [],
          recommendations: [
            {
              statement: '转译步骤（Instituto Moreira Salles）：先在首层标出连续公共环线。',
              evidence_asset_ids: ['asset-live'],
            },
            {
              statement: '转译步骤（SESC 24 de Maio）：再用竖向节点串联主要公共楼层。',
              evidence_asset_ids: ['asset-live'],
            },
            {
              statement: '转译步骤（SESC Pompeia）：最后校核后勤路径是否与公共路径交叉。',
              evidence_asset_ids: ['asset-live'],
            },
            {
              statement: '转译步骤（Museum of Art）：第四步不应进入首屏概览。',
              evidence_asset_ids: ['asset-live'],
            },
          ],
        },
      },
    }))
    renderBoard()
    await startLiveResearch(user)

    const synthesis = await screen.findByRole('region', { name: '研究结论' })
    expect(within(synthesis).getByRole('heading', {
      name: '先画出不交叉的公共环线。',
    })).toBeVisible()
    expect(within(synthesis).queryByRole('heading', {
      name: '连续外廊把公共到达、展厅入口与竖向交通串成清晰环路',
    })).not.toBeInTheDocument()
    expect(within(synthesis).queryByText(/已核对原文|原文引文/)).not.toBeInTheDocument()
    expect(within(synthesis).getByText('先在首层标出连续公共环线。')).toBeVisible()
    expect(within(synthesis).getByText('再用竖向节点串联主要公共楼层。')).toBeVisible()
    expect(within(synthesis).getByText('最后校核后勤路径是否与公共路径交叉。')).toBeVisible()
    expect(within(synthesis).queryByText('第四步不应进入首屏概览。')).not.toBeInTheDocument()

    expect(within(synthesis).queryByText(rawStatement)).not.toBeInTheDocument()
    expect(synthesis.querySelector('details')).toBeNull()
  })

  it('withholds result content until the run reaches a terminal state', async () => {
    const user = userEvent.setup()
    const fetchMock = createLiveFetch({
      initialStatus: 'searching',
      pollStatuses: ['searching'],
    })
    vi.stubGlobal('fetch', fetchMock)
    renderBoard()
    await startLiveResearch(user)

    expect(screen.getByRole('status')).toHaveTextContent('正在搜索')
    await waitFor(() => {
      expect(fetchMock.mock.calls.some(
        ([path]) => path === '/v1/runs/run-live',
      )).toBe(true)
    }, { timeout: 2_500 })
    expect(screen.queryByRole('article', { name: '代表案例 Live Mill Conversion' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: '研究结论' })).not.toBeInTheDocument()
    expect(screen.getByRole('status')).not.toHaveTextContent('研究已完成')

    const runPollCount = fetchMock.mock.calls.filter(
      ([path, init]) => path === '/v1/runs/run-live' && (init as RequestInit | undefined)?.method === undefined,
    ).length
    const resultPollCount = fetchMock.mock.calls.filter(
      ([path, init]) => path === '/v1/runs/run-live/results' && (init as RequestInit | undefined)?.method === undefined,
    ).length
    expect(runPollCount).toBeGreaterThan(0)
    expect(resultPollCount).toBe(0)
  }, 6_000)

  it('preserves partial results, coverage gaps, and a retry action', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', createLiveFetch({ initialStatus: 'partial' }))
    renderBoard()
    await startLiveResearch(user)

    expect(await screen.findByText('已交付部分结果')).toBeVisible()
    expect(screen.getByRole('heading', { name: '本轮自动检索次数已用完，先交付当前可用结果' })).toBeVisible()
    expect(screen.getByText('已保留 1 条可用案例内容，覆盖 1 个项目，其中 1 条已经确认出处。')).toBeVisible()
    expect(screen.getByText('“形成方案依据”需要更多可用项目案例')).toBeVisible()
    expect(screen.getByText('可以继续查看现有结果；重试会开启新一轮研究，补找项目案例与出处。')).toBeVisible()
    expect(screen.queryByText('budget_exhausted')).not.toBeInTheDocument()
    expect(screen.queryByText('fewer_than_six_usable_assets')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '重试研究' }))
    expect(screen.getByRole('status')).toHaveTextContent('已创建')
  })

  it('keeps incomplete precedent research blocked and offers continuation instead of delivery', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', createLiveFetch({
      initialStatus: 'blocked',
      coverageReport: {
        usable_assets: 1,
        project_count: 1,
        verified_or_partial: 1,
        gaps: ['uncovered_subquestions'],
      },
    }))
    renderBoard()
    await startLiveResearch(user)

    expect(await screen.findByText('研究尚未完成，已有证据已保留')).toBeVisible()
    expect(screen.getByRole('heading', { name: '仍有子问题等待补齐' })).toBeVisible()
    expect(screen.queryByText('已交付部分结果')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '继续补齐研究' }))
    expect(screen.getByRole('status')).toHaveTextContent('已创建')
  })

  it('requests fresh temporary page access before retrying a partial run', async () => {
    const user = userEvent.setup()
    const fetchMock = createLiveFetch({
      browserConnected: true,
      existingRunStatus: 'partial',
    })
    vi.stubGlobal('fetch', fetchMock)
    renderBoard()

    await user.click(await screen.findByRole('button', { name: `打开研究：${liveQuestion}` }))
    await user.click(screen.getByRole('button', { name: '重试研究' }))

    expect(requestBrowserBridge).toHaveBeenCalledWith({ type: 'status' })
    const retryCallIndex = fetchMock.mock.calls.findIndex(
      ([path, init]) => path === '/v1/runs/run-live/retry' && (init as RequestInit | undefined)?.method === 'POST',
    )
    expect(retryCallIndex).toBeGreaterThanOrEqual(0)
    expect(vi.mocked(requestBrowserBridge).mock.invocationCallOrder[0]).toBeLessThan(
      fetchMock.mock.invocationCallOrder[retryCallIndex],
    )
  })

  it('retries with public pages when the connected extension belongs to another surface', async () => {
    const user = userEvent.setup()
    const fetchMock = createLiveFetch({
      browserConnected: true,
      existingRunStatus: 'partial',
    })
    vi.mocked(requestBrowserBridge).mockRejectedValue(
      new BrowserBridgeError('unavailable', 'bridge unavailable on this surface'),
    )
    vi.stubGlobal('fetch', fetchMock)
    renderBoard()

    await user.click(await screen.findByRole('button', { name: `打开研究：${liveQuestion}` }))
    await user.click(screen.getByRole('button', { name: '重试研究' }))

    expect(fetchMock).toHaveBeenCalledWith('/v1/runs/run-live/retry', { method: 'POST' })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('已创建')
  })

  it('lets the user cancel an active run without losing the work surface', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', createLiveFetch({ initialStatus: 'searching' }))
    renderBoard()
    await startLiveResearch(user)

    await user.click(screen.getByRole('button', { name: '取消研究' }))
    expect(screen.getByRole('status')).toHaveTextContent('已取消')
    expect(screen.getByRole('region', { name: '研究工作区' })).toBeVisible()
  })

  it('keeps source evidence and saved notes out of the architectural reading surface', async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      createLiveFetch({
        hasLocalContent: true,
        saved: [{ asset_candidate_id: 'asset-live', note: '重点比较旧结构' }],
      }),
    )
    renderBoard()
    await startLiveResearch(user)

    const answer = await screen.findByRole('article', { name: '代表案例 Live Mill Conversion' })
    expect(within(answer).getByRole('img', { name: 'Live Mill Conversion 剖面图' })).toHaveAttribute(
      'src',
      '/v1/assets/asset-live/content',
    )
    expect(screen.queryByRole('dialog', { name: '来源检视器' })).not.toBeInTheDocument()
    expect(screen.queryByText('重点比较旧结构')).not.toBeInTheDocument()
    expect(screen.queryByText('Existing structure retained and adapted.')).not.toBeInTheDocument()
    expect(screen.queryByText('PDF 第 12 页')).not.toBeInTheDocument()
  })

  it('organizes Xiaohongshu drawings as a typed inspiration board instead of project cases', async () => {
    const user = userEvent.setup()
    const visualCandidate = {
      ...candidate,
      project_name: '旧厂房剖面与蓝灰分析图',
      source_url: 'https://www.xiaohongshu.com/explore/note-84',
      publication_tier: 'aggregator',
      project_identity: 'unknown',
      asset_association: 'unknown',
      primary_source: 'unknown',
      rights_status: 'unknown',
      result_tier: 'visual_lead',
      facts: [],
      project_context: '',
      design_mechanism: '',
      transfer_strategy: [],
      inferences: [],
      limitations: ['视觉平台帖子只支持可见图像观察。'],
      has_local_content: true,
    }
    vi.stubGlobal('fetch', createLiveFetch({
      goal: 'visual_reference_search',
      subquestions: visualDirectionSubquestions,
      candidateOverrides: visualCandidateOverrides,
      candidates: [
        {
          ...visualCandidate,
          id: 'xhs-plan',
          asset_type: 'plan',
          subquestion_ids: ['linework-style'],
          observations: ['平面以灰底和蓝色路径突出公共空间序列。'],
        },
        {
          ...visualCandidate,
          id: 'xhs-plan-2',
          asset_type: 'plan',
          subquestion_ids: ['linework-style'],
          observations: ['平面以灰底和蓝色路径突出公共空间序列。'],
        },
        {
          ...visualCandidate,
          id: 'xhs-plan-3',
          asset_type: 'plan',
          subquestion_ids: ['linework-style'],
          observations: ['平面以灰底和蓝色路径突出公共空间序列。'],
        },
        {
          ...visualCandidate,
          id: 'xhs-section',
          asset_type: 'section',
          subquestion_ids: ['collage-style'],
          observations: ['剖面用连续色块表达新旧空间的竖向咬合。'],
        },
        {
          ...visualCandidate,
          id: 'xhs-diagram',
          asset_type: 'analysis_diagram',
          subquestion_ids: ['rendered-style'],
          observations: ['分析图用三步拆解建筑形体，并保持统一视角。'],
        },
      ],
    }))
    renderBoard()

    await startVisualResearch(user)

    expect(await screen.findByRole('heading', { name: '灵感方向' })).toBeVisible()
    expect(screen.queryByRole('heading', { name: '问题拆解' })).not.toBeInTheDocument()
    expect(screen.getByText('围绕你指定的图纸类型整理不同风格，方便比较哪种画法更适合当前任务。')).toBeVisible()
    expect(screen.getByText('3 个方向')).toBeVisible()
    expect(screen.getByText('3 张灵感图')).toBeVisible()
    expect(screen.getAllByText('1 张灵感图')).toHaveLength(2)
    expect(screen.queryByText(/0 个方案项目/)).not.toBeInTheDocument()
    expect(screen.queryByText(/^Agent 会把问题拆开/)).not.toBeInTheDocument()
    expect(screen.getByText('这次只比较图纸的画面表达，并保留每张图的原笔记来源。')).toBeVisible()
    const inspirationBoard = await screen.findByRole('region', { name: '视觉灵感板' })
    expect(within(inspirationBoard).getByRole('heading', { name: '小红书制图灵感' })).toBeVisible()
    expect(within(inspirationBoard).getByText('按灵感方向和帖子整理，每篇集中展示多张图；只比较画面表达，不用于确认项目事实或图纸权利。')).toBeVisible()
    expect(within(inspirationBoard).getByText('平面图 · 3 张')).toBeVisible()
    expect(within(inspirationBoard).getByText('剖面图 · 1 张')).toBeVisible()
    expect(within(inspirationBoard).getByText('分析图 · 1 张')).toBeVisible()
    expect(within(inspirationBoard).getAllByRole('article', {
      name: '灵感帖子 旧厂房剖面与蓝灰分析图',
    })).toHaveLength(3)
    expect(within(inspirationBoard).getAllByText('平面以灰底和蓝色路径突出公共空间序列。')).toHaveLength(1)
    expect(within(inspirationBoard).getAllByRole('link', { name: '打开原笔记' })).toHaveLength(3)
    expect(within(inspirationBoard).getByText(
      '总数按不重复图片计算；同一张图可能出现在多个方向。',
    )).toBeVisible()
    const selectionButtons = within(inspirationBoard).getAllByRole('button', { name: /用于收藏$/ })
    expect(selectionButtons).toHaveLength(5)
    expect(new Set(selectionButtons.map((button) => button.getAttribute('aria-label'))).size).toBe(5)
    expect(selectionButtons[0]).toHaveAccessibleName(
      '选择 精细线稿剖面图 · 旧厂房剖面与蓝灰分析图 · 平面图 · 第 1 张用于收藏',
    )
    expect(screen.queryByRole('article', { name: '案例分析 旧厂房剖面与蓝灰分析图' })).not.toBeInTheDocument()
  })

  it('labels legacy visual question branches honestly instead of inventing style directions', async () => {
    const user = userEvent.setup()
    const legacyDirections = [
      {
        id: 'exploded-grid',
        question: '哪些旧厂房案例能清晰呈现保留结构网格的爆炸轴测？',
        rationale: '需要核对项目条件与结构关系。',
      },
      {
        id: 'ground-circulation',
        question: '哪些案例能在首层平面中区分公共与后勤流线？',
        rationale: '需要核对功能与流线组织。',
      },
    ]
    const legacyVisualCandidate = {
      ...candidate,
      source_url: 'https://www.xiaohongshu.com/explore/legacy-note',
      publication_tier: 'aggregator',
      project_identity: 'unknown',
      asset_association: 'unknown',
      primary_source: 'unknown',
      rights_status: 'unknown',
      result_tier: 'visual_lead',
      facts: [],
      project_context: '',
      design_mechanism: '',
      transfer_strategy: [],
      inferences: [],
      limitations: ['视觉平台帖子只支持可见图像观察。'],
      has_local_content: true,
    }
    vi.stubGlobal('fetch', createLiveFetch({
      goal: 'visual_reference_search',
      subquestions: legacyDirections,
      candidates: [
        {
          ...legacyVisualCandidate,
          id: 'legacy-axon',
          asset_type: 'axonometric',
          subquestion_ids: ['exploded-grid'],
          observations: ['轴测图以细线和分层错位展示结构关系。'],
        },
        {
          ...legacyVisualCandidate,
          id: 'legacy-plan',
          asset_type: 'plan',
          subquestion_ids: ['ground-circulation'],
          observations: ['平面图以两种颜色区分公共与后勤路径。'],
        },
      ],
    }))
    renderBoard()

    await startVisualResearch(user)

    const directions = await screen.findByRole('region', { name: '灵感方向' })
    expect(within(directions).getByRole('heading', { name: '旧版灵感分组 1' })).toBeVisible()
    expect(within(directions).getByRole('heading', { name: '旧版灵感分组 2' })).toBeVisible()
    expect(within(directions).getAllByText(
      '这条历史任务按旧规则生成；重新查找会围绕你指定的图纸类型比较不同风格。',
    )).toHaveLength(2)
    expect(screen.queryByText('轴测图表达参考')).not.toBeInTheDocument()
    expect(screen.queryByText('平面图表达参考')).not.toBeInTheDocument()
    expect(screen.queryByText(legacyDirections[0].question)).not.toBeInTheDocument()
    expect(screen.queryByText(legacyDirections[1].question)).not.toBeInTheDocument()
  })

  it('describes an active visual run as inspiration directions instead of evidence questions', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', createLiveFetch({
      initialStatus: 'searching',
      goal: 'visual_reference_search',
      subquestions: visualDirectionSubquestions,
      candidates: [],
    }))
    renderBoard()

    await startVisualResearch(user)

    expect(await screen.findByText('正在寻找图纸灵感 · 完成后结果会自动显示在这里')).toBeVisible()
    expect(screen.getByRole('heading', { name: '正在探索 3 个灵感方向' })).toBeVisible()
    expect(screen.queryByText(/证据问题/)).not.toBeInTheDocument()
    const progressDetails = screen.getByText('查看研究进度').closest('details')
    expect(progressDetails).not.toBeNull()
    expect(within(progressDetails as HTMLElement).getByText('读取图纸')).toBeInTheDocument()
    expect(within(progressDetails as HTMLElement).getByText('分析画面')).toBeInTheDocument()
    expect(within(progressDetails as HTMLElement).queryByText('读取项目')).not.toBeInTheDocument()
    expect(within(progressDetails as HTMLElement).queryByText('分析正文')).not.toBeInTheDocument()
  })

  it('explains a partial visual run with inspiration coverage instead of project evidence', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', createLiveFetch({
      initialStatus: 'partial',
      goal: 'visual_reference_search',
      subquestions: visualDirectionSubquestions,
      candidates: [],
      coverageReport: {
        usable_assets: 1,
        subquestion_count: 3,
        covered_subquestions: 1,
        gaps: ['uncovered_subquestions'],
      },
    }))
    renderBoard()

    await startVisualResearch(user)

    const diagnosisTitle = await screen.findByRole('heading', { name: '还有灵感方向待补充' })
    const diagnosis = diagnosisTitle.closest('section')
    expect(diagnosis).not.toBeNull()
    expect(within(diagnosis as HTMLElement).getByText('已保留 1 张可用灵感图，覆盖 1/3 个方向。')).toBeVisible()
    expect(within(diagnosis as HTMLElement).getByText('仍有灵感方向没有可用图纸参考')).toBeVisible()
    expect(within(diagnosis as HTMLElement).getByText('可以先使用已有灵感；重新查找会保留当前结果，只补未覆盖的方向。')).toBeVisible()
    expect(within(diagnosis as HTMLElement).queryByText(/项目原文|方案项目|子问题/)).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '换一种图纸类型或风格描述再找' })).toBeVisible()
  })

  it('keeps one asset associated with each subquestion analysis instead of collapsing it into the first chapter', async () => {
    const user = userEvent.setup()
    const circulationQuestion = '公共路径怎样避免和后勤路径反复冲突？'
    vi.stubGlobal('fetch', createLiveFetch({
      subquestions: [
        ...liveSubquestions,
        { id: 'circulation', question: circulationQuestion, rationale: '分别追踪两套连续路径' },
      ],
      candidateOverrides: {
        subquestion_ids: ['program', 'circulation'],
        subquestion_analysis: {
          program: {
            project_context: candidate.project_context,
            design_mechanism: candidate.design_mechanism,
            transfer_strategy: candidate.transfer_strategy,
            observations: candidate.observations,
            limitations: candidate.limitations,
          },
          circulation: {
            project_context: '旧厂房只有一个公共门厅，后勤入口位于场地背面。',
            design_mechanism: '公共路径与后勤路径各自连续，只在门厅的受控节点交叉。',
            transfer_strategy: ['先分别画出公共与后勤路径', '再把交叉压缩到可管理的门厅节点'],
            observations: ['剖面中的两条路径在门厅相遇后立即分开。'],
            limitations: ['单一门厅需要复核高峰期容量。'],
          },
        },
      },
    }))
    renderBoard()
    await startLiveResearch(user)

    expect(await screen.findAllByRole('article', {
      name: '代表案例 Live Mill Conversion',
    })).toHaveLength(2)
    const circulationChapter = screen.getByRole('region', { name: circulationQuestion })
    const circulationDossier = within(circulationChapter).getByRole('article', {
      name: '代表案例 Live Mill Conversion',
    })
    expect(circulationChapter).toHaveTextContent('公共路径与后勤路径各自连续，只在门厅的受控节点交叉。')
    expect(within(circulationDossier).queryByText('公共路径与后勤路径各自连续，只在门厅的受控节点交叉。')).not.toBeInTheDocument()
    expect(within(circulationDossier).queryByRole('button', { name: /查看 .*证据/ })).not.toBeInTheDocument()
  })

  it('shows completed research passes when a subquestion returned no usable drawings', async () => {
    const user = userEvent.setup()
    const subquestions = [
      { id: 'program', question: '新功能怎样进入旧结构？', rationale: '研究植入方式' },
      { id: 'circulation', question: '访客与后勤怎样分开？', rationale: '研究流线组织' },
      { id: 'section', question: '剖面怎样形成层次？', rationale: '研究竖向空间' },
    ]
    vi.stubGlobal('fetch', createLiveFetch({
      existingRunStatus: 'completed',
      subquestions,
      coverageReport: {
        subquestion_passes: { program: 2, circulation: 2, section: 2 },
      },
    }))
    renderBoard()

    await user.click(await screen.findByRole('button', { name: `打开研究：${liveQuestion}` }))

    expect(screen.getByRole('region', { name: '新功能怎样进入旧结构？' })).toHaveTextContent(candidate.design_mechanism)
    expect(screen.getByRole('region', { name: '访客与后勤怎样分开？' })).toHaveTextContent('这一问题暂时没有可用结果')
    expect(screen.getByRole('region', { name: '剖面怎样形成层次？' })).toHaveTextContent('这一问题暂时没有可用结果')
    expect(screen.queryByText(/已调研 .*轮|案例证据/)).not.toBeInTheDocument()
  })

  it('keeps every promised subquestion visible when a partial run has no evidence for a branch', async () => {
    const user = userEvent.setup()
    const subquestions = [
      { id: 'program', question: '新功能怎样进入旧结构？', rationale: '研究植入方式' },
      { id: 'circulation', question: '访客与后勤怎样分开？', rationale: '研究流线组织' },
      { id: 'section', question: '剖面怎样形成层次？', rationale: '研究竖向空间' },
    ]
    vi.stubGlobal('fetch', createLiveFetch({
      existingRunStatus: 'partial',
      subquestions,
      coverageReport: {
        subquestion_passes: { program: 2, circulation: 2, section: 2 },
      },
    }))
    renderBoard()

    await user.click(await screen.findByRole('button', { name: `打开研究：${liveQuestion}` }))

    expect(screen.getByRole('region', { name: '访客与后勤怎样分开？' })).toHaveTextContent(
      '这一问题暂时没有可用结果',
    )
    expect(screen.getByRole('region', { name: '剖面怎样形成层次？' })).toHaveTextContent(
      '这一问题暂时没有可用结果',
    )
  })

  it('does not pretend an unassigned drawing answers the first subquestion', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', createLiveFetch({
      existingRunStatus: 'partial',
      candidateOverrides: { subquestion_ids: [], subquestion_analysis: {} },
    }))
    renderBoard()

    await user.click(await screen.findByRole('button', { name: `打开研究：${liveQuestion}` }))

    expect(screen.getByRole('region', { name: liveSubquestions[0].question })).toHaveTextContent(
      '这一问题暂时没有可用结果',
    )
    expect(screen.queryByRole('region', { name: '待归组的图纸线索' })).not.toBeInTheDocument()
  })

  it('keeps source save and reject actions out of case selection', async () => {
    const user = userEvent.setup()
    const fetchMock = createLiveFetch()
    vi.stubGlobal('fetch', fetchMock)
    renderBoard()
    await startLiveResearch(user)
    await screen.findByRole('article', { name: '代表案例 Live Mill Conversion' })
    await user.click(screen.getByRole('button', { name: '选择案例 Live Mill Conversion' }))
    expect(screen.getByRole('button', { name: '导出案例对照表' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: /收藏参考|拒绝参考|撤销拒绝/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: '来源检视器' })).not.toBeInTheDocument()

    const actionCalls = fetchMock.mock.calls
      .filter(([path]) => String(path).includes('/results/asset-live/'))
      .map(([path, init]) => [path, (init as RequestInit).method])
    expect(actionCalls).toEqual([])
    const boardSelections = fetchMock.mock.calls
      .filter(([path, init]) => path === '/v1/runs/run-live/board' && (init as RequestInit | undefined)?.method === 'PATCH')
      .map(([, init]) => JSON.parse(String((init as RequestInit).body)))
    expect(boardSelections).toEqual([
      { selected_asset_ids: ['asset-live'] },
    ])
  })

  it('does not expose research notes on the answer-first case surface', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', createLiveFetch({ saveFails: true }))
    renderBoard()
    await startLiveResearch(user)
    await screen.findByRole('article', { name: '代表案例 Live Mill Conversion' })
    expect(screen.queryByRole('textbox', { name: '研究备注' })).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: '来源检视器' })).not.toBeInTheDocument()
  })

  it('syncs comparison selections and exports only the selected board', async () => {
    const user = userEvent.setup()
    const secondCandidate = {
      ...candidate,
      id: 'asset-live-second',
      project_name: 'Courtyard Mill',
      asset_type: 'plan',
      source_url: 'https://example.com/courtyard-mill',
      rank_index: 1,
      evidence_claims: candidate.evidence_claims.map((claim) => ({
        ...claim,
        id: 'claim-live-second',
        asset_candidate_id: 'asset-live-second',
        source_url: 'https://example.com/courtyard-mill#drawing',
      })),
    }
    const fetchMock = createLiveFetch({ candidates: [candidate, secondCandidate] })
    vi.stubGlobal('fetch', fetchMock)
    renderBoard()
    await startLiveResearch(user)
    await screen.findByRole('article', { name: '代表案例 Live Mill Conversion' })
    await openCaseInventories(user)

    expect(screen.getByRole('button', { name: '导出案例对照表' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: '选择案例 Live Mill Conversion' }))
    expect(screen.getByRole('button', { name: '导出案例对照表' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: '选择案例 Courtyard Mill' }))
    await user.click(screen.getByRole('button', { name: '导出案例对照表' }))

    expect(await screen.findByRole('link', { name: '打开案例对照表' })).toHaveAttribute(
      'href',
      'http://127.0.0.1:8000/v1/boards/board-live/exports/export-live/private',
    )
    const boardPatch = fetchMock.mock.calls.filter(
      ([path, init]) =>
        path === '/v1/runs/run-live/board' && (init as RequestInit | undefined)?.method === 'PATCH',
    ).at(-1)
    expect(JSON.parse(String((boardPatch?.[1] as RequestInit).body))).toEqual({
      selected_asset_ids: ['asset-live', 'asset-live-second'],
    })
  })

  it('shows a success confirmation until another unsaved reference is selected', async () => {
    const user = userEvent.setup()
    const secondCandidate = {
      ...candidate,
      id: 'asset-live-second',
      project_name: 'Courtyard Mill',
      asset_type: 'plan',
      source_url: 'https://example.com/courtyard-mill',
      rank_index: 1,
      evidence_claims: candidate.evidence_claims.map((claim) => ({
        ...claim,
        id: 'claim-live-second',
        asset_candidate_id: 'asset-live-second',
        source_url: 'https://example.com/courtyard-mill#drawing',
      })),
    }
    const oldCollection = {
      id: 'collection-old',
      workspace_id: 'workspace-live',
      asset_candidate_id: 'asset-old',
      source_url: 'https://example.com/old-reference',
      note: '',
      snapshot: {
        question: liveQuestion,
        goal: 'precedent_research',
        project_name: 'Old Mill Reference',
        asset_type: 'section',
      },
      created_at: '2026-07-20T08:00:00Z',
    }
    const fetchMock = createLiveFetch({
      candidates: [candidate, secondCandidate],
      collections: [oldCollection],
    })
    vi.stubGlobal('fetch', fetchMock)
    renderBoard()
    await startLiveResearch(user)
    await screen.findByRole('article', { name: '代表案例 Live Mill Conversion' })
    await openCaseInventories(user)

    await user.click(screen.getByRole('button', { name: '选择案例 Live Mill Conversion' }))
    const collectionDock = screen.getByRole('region', { name: '收藏选择' })
    expect(within(collectionDock).getByText('已选 1 个项目案例（最多 6 个）')).toBeVisible()
    await user.click(within(collectionDock).getByRole('button', { name: '添加 1 项到个人收藏' }))

    expect(fetchMock).toHaveBeenCalledWith('/v1/results/asset-live/save', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ note: '', subquestion_ids: ['program'] }),
    })
    expect(fetchMock).not.toHaveBeenCalledWith('/v1/collections/collection-old', { method: 'DELETE' })
    expect(
      fetchMock.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === 'DELETE'),
    ).toBe(false)
    expect(within(collectionDock).getByText('已保存 1 项，选择已清空')).toBeVisible()
    expect(within(collectionDock).queryByText('已选 1 个项目案例（最多 6 个）')).not.toBeInTheDocument()
    expect(within(collectionDock).queryByRole('button')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '选择案例 Courtyard Mill' }))
    expect(within(collectionDock).getByText('已选 1 个项目案例（最多 6 个）')).toBeVisible()
    expect(within(collectionDock).getByRole('button', { name: '添加 1 项到个人收藏' })).toBeEnabled()
  })

  it('shows only architectural-design tools after a precedent answer and hides research trace', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', createLiveFetch())
    renderBoard()
    await startLiveResearch(user)
    await screen.findByRole('article', { name: '代表案例 Live Mill Conversion' })

    const researchResults = screen.getByRole('region', { name: '研究结果' })
    const resultWorkbench = screen.getByRole('region', { name: '结果工作台' })
    expect(
      researchResults.compareDocumentPosition(resultWorkbench) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(resultWorkbench).toBeVisible()
    expect(within(resultWorkbench).getAllByRole('button')).toHaveLength(3)
    expect(within(resultWorkbench).getByRole('heading', { name: '把案例研究带回方案' })).toBeVisible()
    expect(screen.getByRole('button', { name: '返回主页' })).toHaveClass('result-new-research')
    expect(screen.queryByRole('button', { name: '整理与导出：对照、规范与导出' })).not.toBeInTheDocument()

    expect(within(resultWorkbench).getByRole('button', { name: '对照案例策略' })).toBeDisabled()
    expect(within(resultWorkbench).getByRole('button', { name: '导出案例对照表' })).toBeDisabled()
    expect(within(resultWorkbench).getByRole('button', { name: '生成可分享结果板' })).toBeDisabled()
    expect(within(resultWorkbench).getAllByText('已选 0 个案例，还需选择 2 个不同案例')).toHaveLength(2)
    expect(within(resultWorkbench).getByText('先在上方结果中选中至少 1 项参考')).toBeVisible()
    expect(within(resultWorkbench).queryByRole('button', { name: '对照图纸表达' })).not.toBeInTheDocument()
    expect(within(resultWorkbench).queryByRole('button', { name: '编辑图纸表达规范' })).not.toBeInTheDocument()
    expect(within(resultWorkbench).queryByRole('button', { name: '导出个人灵感板' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '查看研究过程' })).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: '研究过程记录' })).not.toBeInTheDocument()
  })

  it('shows drawing-inspiration tools and makes selected drawings explicitly collectable', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', createLiveFetch({
      goal: 'visual_reference_search',
      subquestions: visualDirectionSubquestions,
      candidateOverrides: visualCandidateOverrides,
    }))
    renderBoard()
    await startVisualResearch(user)
    await screen.findByRole('region', { name: '视觉灵感板' })

    const resultWorkbench = screen.getByRole('region', { name: '结果工作台' })
    expect(within(resultWorkbench).getAllByRole('button')).toHaveLength(3)
    expect(resultWorkbench.querySelector('.result-workbench-actions--visual')).toBeInTheDocument()
    expect(within(resultWorkbench).getByRole('heading', { name: '把图纸灵感带回表达' })).toBeVisible()
    expect(within(resultWorkbench).getByRole('button', { name: '编辑图纸表达规范' })).toBeEnabled()
    expect(within(resultWorkbench).getByRole('button', { name: '查看个人收藏' })).toBeEnabled()
    expect(within(resultWorkbench).getByRole('button', { name: '生成可分享来源板' })).toBeDisabled()
    expect(within(resultWorkbench).queryByRole('button', { name: '对照图纸表达' })).not.toBeInTheDocument()
    expect(within(resultWorkbench).queryByRole('button', { name: '对照案例策略' })).not.toBeInTheDocument()
    expect(within(resultWorkbench).queryByRole('button', { name: '导出案例对照表' })).not.toBeInTheDocument()
    expect(within(resultWorkbench).queryByRole('button', { name: '生成可分享证据板' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: '对照案例策略选择' })).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: '对照案例策略' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '加入对照' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /选择 .*用于收藏/ }))
    expect(screen.getByRole('button', { name: /取消 .*收藏选择/ })).toBePressed()
    expect(within(resultWorkbench).getByRole('button', { name: '生成可分享来源板' })).toBeEnabled()
    const collectionDock = screen.getByRole('region', { name: '收藏选择' })
    expect(within(collectionDock).getByText('已选 1 张图纸（最多 6 张）')).toBeVisible()
    await user.click(within(collectionDock).getByRole('button', { name: '添加 1 项到个人收藏' }))
    expect(fetch).toHaveBeenCalledWith('/v1/results/asset-live/save', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ note: '' }),
    })
    expect(within(collectionDock).getByText('已保存 1 项，选择已清空')).toBeVisible()
    expect(screen.getByRole('button', { name: /选择 .*用于收藏/ })).not.toBePressed()
    expect(screen.queryByRole('region', { name: '对照案例策略选择' })).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: '对照案例策略' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '查看研究过程' })).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: '研究过程记录' })).not.toBeInTheDocument()
  })

  it('previews share rights for selected items before creating the export', async () => {
    const user = userEvent.setup()
    const fetchMock = createLiveFetch()
    vi.stubGlobal('fetch', fetchMock)
    renderBoard()
    await startLiveResearch(user)
    await screen.findByRole('article', { name: '代表案例 Live Mill Conversion' })
    await openCaseInventories(user)

    await user.click(screen.getByRole('button', { name: '选择案例 Live Mill Conversion' }))
    await user.click(screen.getByRole('button', { name: '生成可分享结果板' }))
    expect(screen.getByText('1 张图片将直接放进分享版')).toBeVisible()
    expect(
      fetchMock.mock.calls.filter(([path]) => path === '/v1/boards/board-live/exports'),
    ).toHaveLength(0)
    await user.click(screen.getByRole('button', { name: '确认生成分享版' }))
    expect(await screen.findByRole('link', { name: '打开分享结果板' })).toHaveAttribute(
      'href',
      'http://127.0.0.1:8000/v1/boards/board-live/exports/export-live/share',
    )
  })

  it('loads and explicitly saves an editable style profile', async () => {
    const user = userEvent.setup()
    const fetchMock = createLiveFetch({
      goal: 'visual_reference_search',
      subquestions: visualDirectionSubquestions,
      candidateOverrides: visualCandidateOverrides,
      styleProfile: {
        id: 'style-live',
        board_id: 'board-live',
        palette: ['#2d846b'],
        line_weights: { primary: 1.2, secondary: 0.25 },
        texture: 'none',
        font_category: 'serif',
        layout_notes: '',
      },
    })
    vi.stubGlobal('fetch', fetchMock)
    renderBoard()
    await startVisualResearch(user)
    await screen.findByRole('region', { name: '视觉灵感板' })

    await user.click(screen.getByRole('button', { name: '编辑图纸表达规范' }))
    const stylePanel = screen.getByRole('dialog', { name: '表达规范' })
    expect(within(stylePanel).getByLabelText('主色')).toHaveValue('#2d846b')
    expect(within(stylePanel).getByRole('combobox', { name: '字体类别' })).toHaveValue('serif')
    expect(within(stylePanel).getByRole('combobox', { name: '纹理' })).toHaveValue('none')
    expect(within(stylePanel).getByRole('textbox', { name: '版式备注' })).toHaveValue('')
    await user.selectOptions(within(stylePanel).getByRole('combobox', { name: '线宽层级' }), 'uniform')
    await user.selectOptions(within(stylePanel).getByRole('combobox', { name: '纹理' }), 'vellum')
    await user.type(within(stylePanel).getByRole('textbox', { name: '版式备注' }), '证据栏靠右，图组留白更大')
    await user.click(within(stylePanel).getByRole('button', { name: '保存表达规范' }))
    expect(within(stylePanel).getByRole('status')).toHaveTextContent('表达规范已保存')
    expect(fetchMock).toHaveBeenCalledWith('/v1/boards/board-live/style-profile', expect.objectContaining({
      body: expect.stringContaining('vellum'),
    }))
  })

  it('filters the flat result grid and compares selected references in demo mode', async () => {
    const user = userEvent.setup()
    renderBoard('?demo=1')

    await screen.findByRole('heading', { name: '案例研究结果' })
    await user.click(screen.getByRole('button', { name: '选择案例 Section Layers Replay' }))
    await user.click(screen.getByRole('button', { name: '选择案例 Layered Axon Replay' }))
    await user.click(screen.getAllByRole('button', { name: '对照案例策略' })[0])
    const comparison = screen.getByRole('dialog', { name: '对照案例策略' })
    expect(comparison).toBeVisible()
    expect(within(comparison).getByRole('heading', { name: '这组对照怎么看' })).toBeVisible()
    expect(within(comparison).getByRole('table', { name: '案例策略对照表' })).toBeVisible()
    expect(within(comparison).getByRole('rowheader', { name: '解决什么' })).toBeVisible()
    expect(within(comparison).getByRole('rowheader', { name: '可借鉴方法' })).toBeVisible()
    expect(within(comparison).getByRole('rowheader', { name: '图中看到' })).toBeVisible()
    expect(within(comparison).getByRole('rowheader', { name: '适用条件' })).toBeVisible()
    expect(within(comparison).queryByText(/来源|证据|核对|核验|正文|证明/)).not.toBeInTheDocument()
  })

  it.each([
    ['quick', '快速找方向', '从少量高相关案例提炼做法，给出直接建议', 3],
    ['balanced', '形成方案依据', '比较多个案例的条件、做法与结果，说明适用边界', 4],
    ['deep', '做跨案例论证', '综合更多案例，指出共识、冲突、不确定性和失效边界', 6],
  ])('renders the no-cost %s portfolio demo with its own complete decomposition', async (depth, label, description, count) => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    renderBoard(`?demo=${depth}`)

    expect(await screen.findByText(`演示数据 · ${label}`)).toBeVisible()
    expect(screen.getByRole('group', { name: `${label}说明` })).toHaveTextContent(description)
    const caseResults = screen.getByRole('region', { name: '案例研究结果' })
    expect(within(caseResults).getAllByRole('heading', { level: 3 })).toHaveLength(count)
    expect(screen.queryByRole('region', { name: '子问题清单' })).not.toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
