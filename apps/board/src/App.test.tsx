import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import App from './App'

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
}

const liveQuestion = '旧厂房如何植入新的公共功能？'

function createLiveFetch(options: LiveFetchOptions = {}) {
  let pollIndex = 0
  const initialStatus = options.initialStatus ?? 'completed'
  const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input)
    const method = init?.method ?? 'GET'

    if (path === '/v1/workspaces' && method === 'GET') return Promise.resolve(jsonResponse([workspace]))
    if (path === '/v1/workspaces' && method === 'POST') {
      return Promise.resolve(jsonResponse({ ...workspace, id: 'workspace-new', name: '新工作区' }, 201))
    }
    if (path === '/v1/workspaces/workspace-live/runs' && method === 'POST') {
      return Promise.resolve(
        jsonResponse(
          {
            id: 'run-live',
            workspace_id: 'workspace-live',
            question: liveQuestion,
            goal: 'precedent_research',
            status: initialStatus,
            budget_mode: 'balanced',
            coverage_report:
              initialStatus === 'partial'
                ? {
                    usable_assets: 1,
                    project_count: 1,
                    verified_or_partial: 1,
                    gaps: ['fewer_than_six_usable_assets'],
                  }
                : {},
            stop_reason: initialStatus === 'partial' ? 'budget_exhausted' : null,
          },
          201,
        ),
      )
    }
    if (path === '/v1/workspaces/workspace-live/runs' && method === 'GET') {
      return Promise.resolve(
        jsonResponse(
          options.existingRunStatus
            ? [
                {
                  id: 'run-live',
                  workspace_id: 'workspace-live',
                  question: liveQuestion,
                  goal: 'precedent_research',
                  status: options.existingRunStatus,
                  budget_mode: 'balanced',
                  checkpoint_stage: options.existingRunStatus,
                  coverage_report: {},
                  created_at: '2026-07-13T08:30:00Z',
                },
              ]
            : [],
        ),
      )
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
          goal: 'precedent_research',
          status,
          budget_mode: 'balanced',
          coverage_report:
            status === 'partial'
              ? {
                  usable_assets: 1,
                  project_count: 1,
                  verified_or_partial: 1,
                  gaps: ['fewer_than_six_usable_assets'],
                }
              : {},
          stop_reason: status === 'partial' ? 'budget_exhausted' : null,
        }),
      )
    }
    if (path === '/v1/runs/run-live/cancel' && method === 'POST') {
      return Promise.resolve(
        jsonResponse({
          id: 'run-live',
          workspace_id: 'workspace-live',
          question: liveQuestion,
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
        jsonResponse([{ ...candidate, has_local_content: options.hasLocalContent ?? false }]),
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
            tool: 'web_search',
            duration_ms: 120,
            cost_usd: 0.02,
            retry_count: 0,
            summary: '已完成实时网页查询',
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
    if (path === '/v1/results/asset-live/save' && method === 'POST') {
      if (options.saveFails) return Promise.resolve(jsonResponse({ detail: '保存失败' }, 503))
      return Promise.resolve(jsonResponse({ asset_candidate_id: 'asset-live' }, 201))
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
            path: `C:/exports/board-${body.mode}.json`,
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
    if (path === '/v1/workspaces' && method === 'GET') {
      return Promise.resolve(jsonResponse([workspace, secondWorkspace]))
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
    if (path === '/v1/workspaces') return Promise.resolve(jsonResponse([workspace, secondWorkspace]))
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

function createCancelWorkspaceRaceFetch() {
  let releaseCancel = () => {}
  const cancelGate = new Promise<void>((resolve) => {
    releaseCancel = resolve
  })
  const secondWorkspace = { ...workspace, id: 'workspace-two', name: '第二工作区' }
  const activeRun = {
    id: 'run-cancel-race',
    workspace_id: 'workspace-live',
    question: '等待取消的旧工作区任务',
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
    if (path === '/v1/runs/run-cancel-race/results') return Promise.resolve(jsonResponse([]))
    if (path === '/v1/runs/run-cancel-race/board') {
      return Promise.resolve(jsonResponse({ id: 'board-cancel-race', run_id: 'run-cancel-race', selected_asset_ids: [] }))
    }
    if (path === '/v1/runs/run-cancel-race/user-state') {
      return Promise.resolve(jsonResponse({ saved: [], rejected: [] }))
    }
    if (path === '/v1/runs/run-cancel-race/events') {
      return Promise.resolve(new Response('', { headers: { 'content-type': 'text/event-stream' } }))
    }
    if (path === '/v1/boards/board-cancel-race/style-profile') {
      return Promise.resolve(jsonResponse({ detail: 'Style profile not found' }, 404))
    }
    if (path === '/v1/runs/run-cancel-race/cancel' && method === 'POST') {
      return cancelGate.then(() => jsonResponse({ ...activeRun, status: 'cancelled' }))
    }
    if (path === '/v1/runs/run-cancel-race') return Promise.resolve(jsonResponse(activeRun))
    return Promise.reject(new TypeError(`Unexpected request: ${method} ${path}`))
  })
  return { fetchMock, releaseCancel, cancelGate }
}

function renderBoard(search = '') {
  window.history.replaceState({}, '', `/${search}`)
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>,
  )
}

async function startLiveResearch(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByText('真实工作区')
  await user.type(screen.getByRole('textbox', { name: '研究问题' }), '旧厂房如何植入展厅？')
  await user.click(screen.getByRole('button', { name: '开始研究' }))
}

describe('research board', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')))
  })

  afterEach(() => {
    vi.useRealTimers()
    window.history.replaceState({}, '', '/')
    vi.restoreAllMocks()
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

    expect(await screen.findByText('Kamala Narayana Temple Survey')).toBeVisible()
    expect(screen.getByRole('img', { name: 'Kamala Narayana Temple Survey 平面图' })).toHaveAttribute(
      'src',
      '/demo/kamala-plan.jpg',
    )
    expect(screen.queryByText('预览不可用')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '查看 Kamala Narayana Temple Survey 证据' }))
    expect(screen.getByRole('dialog', { name: '来源检视器' })).toHaveTextContent('Kamala Narayana Temple Survey')
    expect(screen.getByText('演示数据')).toBeVisible()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('keeps the result canvas simple until the user asks for details', async () => {
    const user = userEvent.setup()
    renderBoard('?demo=1')

    expect(await screen.findByRole('heading', { name: '研究给出的方向' })).toBeVisible()
    expect(screen.getByText('旧建筑更新中，如何植入新功能，并组织公共与后勤流线和剖面层次？')).toBeVisible()
    expect(screen.getByRole('heading', { name: '支撑这些方向的图纸' })).toBeVisible()
    expect(screen.getByRole('combobox', { name: '图纸类型' })).toHaveValue('all')
    expect(screen.getByRole('button', { name: '发起新研究' })).toBeVisible()
    expect(screen.getByRole('region', { name: '图纸证据列表' })).toBeVisible()
    const firstReference = screen.getByRole('button', { name: '查看 Kamala Narayana Temple Survey 证据' }).closest('article')
    expect(firstReference).not.toHaveAttribute('data-selected')
    expect(screen.getByRole('button', { name: '加入方法对照 Kamala Narayana Temple Survey' })).toHaveAttribute('title', '加入方法对照')
    expect(screen.queryByRole('dialog', { name: '来源检视器' })).not.toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: '研究阶段' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '查看 Kamala Narayana Temple Survey 证据' }))
    expect(firstReference).toHaveAttribute('data-selected', 'true')
    expect(screen.getByRole('dialog', { name: '来源检视器' })).toBeVisible()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: '来源检视器' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '查看 Kamala Narayana Temple Survey 证据' })).toHaveFocus()
  })

  it('loads a useful research-workbench home without exposing result cards', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', createLiveFetch())
    renderBoard()

    expect(await screen.findByText('真实工作区')).toBeVisible()
    expect(screen.getByRole('heading', { name: '从一个卡住你的地方开始' })).toBeVisible()
    const questionInput = screen.getByRole('textbox', { name: '研究问题' })
    expect(questionInput).toBeVisible()
    expect(screen.getByRole('button', { name: '设计策略' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '来源反查' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: '视觉参考' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('heading', { name: '不知道怎么描述？' })).toBeVisible()
    expect(screen.getByRole('heading', { name: '最近研究' })).toBeVisible()
    const startButton = screen.getByRole('button', { name: '开始研究' })
    const starterButton = screen.getByRole('button', { name: '填入问题：流线组织，人车在入口冲突，如何重组落客和步行路径？' })
    expect(startButton.closest('.research-submit-spark')).not.toBeNull()
    expect(starterButton.closest('.click-spark')).toBeNull()
    await user.click(starterButton)
    expect(questionInput).toHaveValue('人车在入口冲突，如何重组落客和步行路径？')
    expect(questionInput).toHaveFocus()
    await user.click(screen.getByRole('button', { name: '来源反查' }))
    expect(screen.getByRole('button', { name: '来源反查' })).toHaveAttribute('aria-pressed', 'true')
    expect(questionInput).toHaveAttribute(
      'placeholder',
      '上传截图或粘贴网页链接，说明你想确认的项目或原始出处。',
    )
    expect(screen.queryByRole('textbox', { name: '参考网页' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '添加资料和研究设置' }))
    expect(screen.getByRole('textbox', { name: '参考网页' })).toBeVisible()
    expect(screen.queryByRole('group', { name: '研究目标' })).not.toBeInTheDocument()
    expect(screen.queryByText('Kamala Narayana Temple Survey')).not.toBeInTheDocument()
  })

  it('keeps restored results behind an explicit action on the problem-first home', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', createLiveFetch({ existingRunStatus: 'completed' }))
    renderBoard()

    expect(await screen.findByRole('textbox', { name: '研究问题' })).toBeVisible()
    expect(await screen.findByText(liveQuestion)).toBeVisible()
    expect(await screen.findByRole('button', { name: '查看上次结果' })).toBeVisible()
    expect(screen.queryByRole('heading', { name: '研究给出的方向' })).not.toBeInTheDocument()
    expect(
      (fetch as ReturnType<typeof vi.fn>).mock.calls.some(([path]) => path === '/v1/runs/run-live/results'),
    ).toBe(false)

    await user.click(screen.getByRole('button', { name: '查看上次结果' }))
    expect(await screen.findByRole('heading', { name: '研究给出的方向' })).toBeVisible()
    expect(screen.queryByRole('textbox', { name: '研究问题' })).not.toBeInTheDocument()
  })

  it('restores the latest persisted run after the user opens it', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', createLiveFetch({ existingRunStatus: 'completed' }))
    renderBoard()

    await user.click(await screen.findByRole('button', { name: `打开研究：${liveQuestion}` }))
    expect(await screen.findByText('Live Mill Conversion')).toBeVisible()
    expect(screen.getByRole('img', { name: 'Live Mill Conversion 暂无预览' })).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent('研究已完成')
    expect(screen.queryByRole('dialog', { name: '来源检视器' })).not.toBeInTheDocument()
  })

  it('does not flash the previous run results after a new run starts', async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      createLiveFetch({ existingRunStatus: 'completed', initialStatus: 'searching' }),
    )
    renderBoard()

    await user.click(await screen.findByRole('button', { name: `打开研究：${liveQuestion}` }))
    expect(await screen.findByText('Live Mill Conversion')).toBeVisible()
    await user.click(screen.getByRole('button', { name: '发起新研究' }))
    await user.type(screen.getByRole('textbox', { name: '研究问题' }), '开始另一个研究任务')
    await user.click(screen.getByRole('button', { name: '开始研究' }))

    expect(screen.queryByText('Live Mill Conversion')).not.toBeInTheDocument()
  })

  it('does not resume polling a historical run after switching workspaces', async () => {
    const user = userEvent.setup()
    const { fetchMock, releaseHydration } = createWorkspaceRaceFetch()
    const intervalSpy = vi.spyOn(window, 'setInterval')
    vi.stubGlobal('fetch', fetchMock)
    renderBoard()

    await user.click(await screen.findByRole('button', { name: '打开研究：仍在运行的旧任务' }))
    await user.selectOptions(screen.getByRole('combobox', { name: '工作区' }), 'workspace-two')
    await screen.findByText('第二工作区')
    await act(async () => {
      releaseHydration()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(intervalSpy.mock.calls.some(([, delay]) => delay === 1000)).toBe(false)
    expect(screen.queryByText('仍在运行的旧任务')).not.toBeInTheDocument()
  })

  it('ignores a new-run response after the user switches workspaces', async () => {
    const user = userEvent.setup()
    const { fetchMock, releaseStart, startGate } = createSubmitRaceFetch()
    vi.stubGlobal('fetch', fetchMock)
    renderBoard()

    await screen.findByText('真实工作区')
    await user.type(screen.getByRole('textbox', { name: '研究问题' }), '来自旧工作区的请求')
    await user.click(screen.getByRole('button', { name: '开始研究' }))
    await user.selectOptions(screen.getByRole('combobox', { name: '工作区' }), 'workspace-two')
    expect(screen.getByRole('combobox', { name: '工作区' })).toHaveValue('workspace-two')
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
    await user.selectOptions(screen.getByRole('combobox', { name: '工作区' }), 'workspace-two')
    await act(async () => {
      releaseStart()
      await startGate
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(screen.getByRole('combobox', { name: '工作区' })).toHaveValue('workspace-two')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('ignores an in-flight poll after the user switches workspaces', async () => {
    const user = userEvent.setup()
    const { fetchMock, releasePoll, pollGate } = createPollingWorkspaceRaceFetch()
    vi.stubGlobal('fetch', fetchMock)
    renderBoard()

    expect(await screen.findByRole('status')).toHaveTextContent('正在搜索')
    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([input]) => String(input) === '/v1/runs/run-polling')).toBe(true)
    }, { timeout: 2_000 })
    await user.selectOptions(screen.getByRole('combobox', { name: '工作区' }), 'workspace-two')
    await act(async () => {
      releasePoll()
      await pollGate
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(screen.getByRole('combobox', { name: '工作区' })).toHaveValue('workspace-two')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.queryByText('旧工作区正在研究的任务')).not.toBeInTheDocument()
  }, 4_000)

  it('does not let an in-flight poll overwrite a successful cancellation', async () => {
    const user = userEvent.setup()
    const { fetchMock, releasePoll, pollGate } = createPollingWorkspaceRaceFetch()
    vi.stubGlobal('fetch', fetchMock)
    renderBoard()

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
    await user.selectOptions(screen.getByRole('combobox', { name: '工作区' }), 'workspace-two')
    await act(async () => {
      releaseHydration()
      await hydrationGate
      await new Promise<void>((resolve) => setTimeout(resolve, 0))
    })

    expect(screen.getByRole('heading', { name: '从一个卡住你的地方开始' })).toBeVisible()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('ignores a cancellation response after the user switches workspaces', async () => {
    const user = userEvent.setup()
    const { fetchMock, releaseCancel, cancelGate } = createCancelWorkspaceRaceFetch()
    vi.stubGlobal('fetch', fetchMock)
    renderBoard()

    expect(await screen.findByRole('status')).toHaveTextContent('正在搜索')
    await user.click(screen.getByRole('button', { name: '取消研究' }))
    await user.selectOptions(screen.getByRole('combobox', { name: '工作区' }), 'workspace-two')
    await act(async () => {
      releaseCancel()
      await cancelGate
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(screen.getByRole('heading', { name: '从一个卡住你的地方开始' })).toBeVisible()
    expect(screen.queryByRole('button', { name: '打开研究：等待取消的旧工作区任务' })).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
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

    expect(screen.getByRole('status')).toHaveTextContent('已创建')
    expect(await screen.findByText('正在搜索', {}, { timeout: 2_000 })).toBeVisible()

    expect(await screen.findByText('Live Mill Conversion', {}, { timeout: 3_000 })).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent('研究已完成')
  }, 8_000)

  it('preserves partial results, coverage gaps, and a retry action', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', createLiveFetch({ initialStatus: 'partial' }))
    renderBoard()
    await startLiveResearch(user)

    expect(await screen.findByText('已交付部分结果')).toBeVisible()
    await user.click(screen.getByText(/1 张图纸，1 个项目/))
    expect(screen.getByText(/budget_exhausted/)).toBeVisible()
    await user.click(screen.getByRole('button', { name: '重试研究' }))
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

  it('hydrates saved notes and renders precise evidence locators with an asset fallback', async () => {
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

    await screen.findByText('Live Mill Conversion')
    await user.click(screen.getByRole('button', { name: '查看 Live Mill Conversion 证据' }))
    const inspector = screen.getByRole('dialog', { name: '来源检视器' })
    expect(within(inspector).getByRole('button', { name: '取消收藏' })).toBePressed()
    expect(within(inspector).getByRole('textbox', { name: '研究备注' })).toHaveValue('重点比较旧结构')
    expect(within(inspector).getByText('PDF 第 12 页')).toBeVisible()
    expect(within(inspector).getByText('Existing structure retained and adapted.')).toBeVisible()
    expect(within(inspector).getByRole('link', { name: '打开证据定位' })).toHaveAttribute(
      'href',
      'https://example.com/live-mill#drawing',
    )
    expect(screen.getByRole('img', { name: 'Live Mill Conversion 剖面图' })).toHaveAttribute(
      'src',
      '/v1/assets/asset-live/content',
    )
  })

  it('keeps save and reject mutually exclusive and persists undo actions', async () => {
    const user = userEvent.setup()
    const fetchMock = createLiveFetch()
    vi.stubGlobal('fetch', fetchMock)
    renderBoard()
    await startLiveResearch(user)
    await screen.findByText('Live Mill Conversion')
    await user.click(screen.getByRole('button', { name: '查看 Live Mill Conversion 证据' }))

    await user.click(screen.getByRole('button', { name: '收藏参考' }))
    expect(screen.getByRole('button', { name: '取消收藏' })).toBePressed()
    await user.click(screen.getByRole('button', { name: '拒绝参考' }))
    expect(screen.getByRole('button', { name: '撤销拒绝' })).toBePressed()
    expect(screen.getByRole('button', { name: '收藏参考' })).not.toBePressed()
    await user.click(screen.getByRole('button', { name: '撤销拒绝' }))

    const actionCalls = fetchMock.mock.calls
      .filter(([path]) => String(path).includes('/results/asset-live/'))
      .map(([path, init]) => [path, (init as RequestInit).method])
    expect(actionCalls).toEqual([
      ['/v1/results/asset-live/save', 'POST'],
      ['/v1/results/asset-live/save', 'DELETE'],
      ['/v1/results/asset-live/reject', 'POST'],
      ['/v1/results/asset-live/reject', 'DELETE'],
    ])
  })

  it('keeps an edited note visible and reports a persistence failure', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', createLiveFetch({ saveFails: true }))
    renderBoard()
    await startLiveResearch(user)
    await screen.findByText('Live Mill Conversion')
    await user.click(screen.getByRole('button', { name: '查看 Live Mill Conversion 证据' }))

    const note = screen.getByRole('textbox', { name: '研究备注' })
    await user.type(note, '这条备注暂时未保存')
    await user.tab()

    expect(await screen.findByRole('alert')).toHaveTextContent('备注未保存')
    expect(note).toHaveValue('这条备注暂时未保存')
  })

  it('syncs comparison selections and exports only the selected board', async () => {
    const user = userEvent.setup()
    const fetchMock = createLiveFetch()
    vi.stubGlobal('fetch', fetchMock)
    renderBoard()
    await startLiveResearch(user)
    await screen.findByText('Live Mill Conversion')

    await user.click(screen.getByText('工具'))
    expect(screen.getByRole('button', { name: '导出私有研究板' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: '加入方法对照 Live Mill Conversion' }))
    await user.click(screen.getByRole('button', { name: '导出私有研究板' }))

    expect(await screen.findByRole('status')).toHaveTextContent('C:/exports/board-private.json')
    const boardPatch = fetchMock.mock.calls.find(
      ([path, init]) =>
        path === '/v1/runs/run-live/board' && (init as RequestInit | undefined)?.method === 'PATCH',
    )
    expect(JSON.parse(String((boardPatch?.[1] as RequestInit).body))).toEqual({
      selected_asset_ids: ['asset-live'],
    })
  })

  it('previews share rights for selected items before creating the export', async () => {
    const user = userEvent.setup()
    const fetchMock = createLiveFetch()
    vi.stubGlobal('fetch', fetchMock)
    renderBoard()
    await startLiveResearch(user)
    await screen.findByText('Live Mill Conversion')

    await user.click(screen.getByRole('button', { name: '加入方法对照 Live Mill Conversion' }))
    await user.click(screen.getByText('工具'))
    await user.click(screen.getByRole('button', { name: '生成分享版' }))
    expect(screen.getByText('1 张图片可嵌入')).toBeVisible()
    expect(
      fetchMock.mock.calls.filter(([path]) => path === '/v1/boards/board-live/exports'),
    ).toHaveLength(0)
    await user.click(screen.getByRole('button', { name: '确认生成分享版' }))
    expect(await screen.findByRole('status')).toHaveTextContent('C:/exports/board-share.json')
  })

  it('loads and explicitly saves an editable style profile', async () => {
    const user = userEvent.setup()
    const fetchMock = createLiveFetch({
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
    await startLiveResearch(user)
    await screen.findByText('Live Mill Conversion')

    await user.click(screen.getByText('工具'))
    await user.click(screen.getByRole('button', { name: '打开表达规范' }))
    const stylePanel = screen.getByRole('dialog', { name: '表达规范' })
    expect(within(stylePanel).getByLabelText('主色')).toHaveValue('#2d846b')
    expect(within(stylePanel).getByRole('combobox', { name: '字体类别' })).toHaveValue('serif')
    await user.selectOptions(within(stylePanel).getByRole('combobox', { name: '线型层级' }), 'uniform')
    await user.click(within(stylePanel).getByRole('button', { name: '保存表达规范' }))
    expect(within(stylePanel).getByRole('status')).toHaveTextContent('表达规范已保存')
  })

  it('filters the flat result grid and compares selected references in demo mode', async () => {
    const user = userEvent.setup()
    renderBoard('?demo=1')

    await screen.findByRole('heading', { name: '研究给出的方向' })
    expect(screen.getAllByRole('option', { name: '分析图' })).toHaveLength(1)
    await user.selectOptions(screen.getByRole('combobox', { name: '图纸类型' }), 'section')
    expect(screen.getAllByRole('article')).toHaveLength(1)
    await user.selectOptions(screen.getByRole('combobox', { name: '图纸类型' }), 'all')
    await user.click(screen.getByRole('button', { name: '加入方法对照 Section Layers Replay' }))
    await user.click(screen.getByRole('button', { name: '加入方法对照 Layered Axon Replay' }))
    await user.click(screen.getByRole('button', { name: '对照方法与边界' }))
    const comparison = screen.getByRole('dialog', { name: '方法对照' })
    expect(comparison).toBeVisible()
    expect(within(comparison).getByRole('heading', { name: '这组对照怎么看' })).toBeVisible()
    expect(within(comparison).getByRole('table', { name: '方法对照表' })).toBeVisible()
    expect(within(comparison).getByRole('rowheader', { name: '解决什么' })).toBeVisible()
    expect(within(comparison).getByRole('rowheader', { name: '可借鉴方法' })).toBeVisible()
    expect(within(comparison).getByRole('rowheader', { name: '图中看到' })).toBeVisible()
    expect(within(comparison).getByRole('rowheader', { name: '使用边界' })).toBeVisible()
  })
})
