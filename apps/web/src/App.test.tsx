import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createApiClient,
  type ApiClient,
  type ResearchRun,
} from '../../board/src/api/client'
import { requestBrowserBridge } from '../../board/src/browserBridge'
import { App } from './App'

vi.mock('../../board/src/browserBridge', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../board/src/browserBridge')>(),
  requestBrowserBridge: vi.fn(),
}))

const workspace = {
  id: 'workspace-studio',
  name: '毕业设计',
  constraints: [],
  created_at: '2026-07-29T00:00:00.000Z',
  updated_at: '2026-07-29T00:00:00.000Z',
}

function mockClient(overrides: Partial<ApiClient> = {}): ApiClient {
  return {
    ...createApiClient('/unused'),
    getBrowserStatus: vi.fn().mockResolvedValue({
      connected: true,
      xiaohongshu_search_available: false,
    }),
    listWorkspaces: vi.fn().mockResolvedValue([workspace]),
    ensureDefaultWorkspace: vi.fn().mockResolvedValue(workspace),
    createWorkspace: vi.fn().mockImplementation(async ({ name }) => ({
      ...workspace,
      id: 'workspace-created',
      name,
    })),
    listRuns: vi.fn().mockResolvedValue([]),
    listPersonalCollections: vi.fn().mockResolvedValue([]),
    getResults: vi.fn().mockResolvedValue([]),
    getBoard: vi.fn().mockResolvedValue({
      id: 'board-empty',
      run_id: 'run-empty',
      selected_asset_ids: [],
    }),
    getUserState: vi.fn().mockResolvedValue({ saved: [], rejected: [] }),
    getEvents: vi.fn().mockResolvedValue([]),
    getStyleProfile: vi.fn().mockResolvedValue(null),
    ...overrides,
  }
}

describe('public ArchResearch product', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.mocked(requestBrowserBridge).mockResolvedValue({
      paired: true,
      connection: 'connected',
      researchPermission: true,
    })
  })

  it('uses the same local-product home, project directory, collections, and data tools', async () => {
    const client = mockClient()
    render(
      <App
        client={client}
        clientSessionId="device-session-test"
        verificationToken="verified-token"
      />,
    )

    expect(await screen.findByText('公共研究工具')).toBeVisible()
    expect(screen.getByRole('heading', { name: '从一个卡住你的地方开始' })).toBeVisible()
    expect(screen.getByText('毕业设计')).toBeVisible()
    expect(screen.getByRole('button', {
      name: /建筑设计研究.*项目案例与设计策略/,
    })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', {
      name: /图纸灵感.*配色、线型、版式与分析图/,
    })).toBeEnabled()
    expect(screen.getByRole('button', { name: '新建项目' })).toBeVisible()
    expect(screen.getByRole('button', { name: '个人收藏' })).toBeVisible()
    expect(screen.getByRole('button', { name: '备份与恢复' })).toBeVisible()
    expect(screen.queryByText(/API Key/i)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '个人收藏' }))
    expect(await screen.findByRole('heading', { name: '个人收藏' })).toBeVisible()
    expect(screen.getByRole('button', { name: /建筑方案/ })).toBeVisible()
    expect(screen.getByRole('button', { name: /图纸灵感/ })).toBeVisible()
  })

  it('uses the connected Chrome extension for public Xiaohongshu research', async () => {
    render(
      <App
        client={mockClient()}
        clientSessionId="device-session-test"
        verificationToken="verified-token"
      />,
    )
    const visual = await screen.findByRole('button', {
      name: /图纸灵感.*配色、线型、版式与分析图/,
    })
    fireEvent.click(visual)

    expect(visual).toHaveAttribute('aria-pressed', 'true')
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '查找灵感' })).toBeEnabled()
    })
    expect(screen.getByRole('region', { name: '研究环境' })).toHaveTextContent(
      '小红书图纸检索已就绪',
    )
    expect(screen.getByRole('region', { name: '研究环境' })).toHaveTextContent(
      '使用你已登录的小红书查找公开笔记',
    )
    expect(screen.queryByRole('dialog', { name: '安装 Chrome 扩展' })).not.toBeInTheDocument()
  })

  it('shows the install reminder on the public main page while the extension is missing', async () => {
    vi.mocked(requestBrowserBridge).mockRejectedValue(new Error('bridge missing'))
    render(
      <App
        client={mockClient()}
        clientSessionId="device-session-test"
        verificationToken="verified-token"
        extensionInstallUrl="https://chromewebstore.google.com/detail/archresearch/example"
      />,
    )

    const dialog = await screen.findByRole('dialog', { name: '安装 Chrome 扩展' })
    expect(dialog).toHaveTextContent('读取小红书图纸灵感需要 Chrome 扩展')
    expect(screen.getByRole('link', { name: '立即安装 Chrome 扩展' })).toHaveAttribute(
      'href',
      'https://chromewebstore.google.com/detail/archresearch/example',
    )
  })

  it('shows the complete local result workbench on a public architecture result', async () => {
    const run: ResearchRun = {
      id: 'run-complete',
      workspaceId: workspace.id,
      question: '旧厂房如何植入新的公共功能？',
      title: '旧厂房公共功能更新',
      goal: 'precedent_research',
      status: 'completed',
      mode: 'balanced',
      researchSources: [],
      subquestions: [{
        id: 'program',
        question: '新功能怎样进入旧结构？',
        rationale: '核对保留与植入的空间关系',
      }],
      coverageReport: {
        usable_assets: 1,
        project_count: 1,
        verified_or_partial: 1,
        subquestion_count: 1,
        covered_subquestions: 1,
        gaps: [],
        enrichment_gaps: [],
        synthesis: {
          answer: {
            statement: '用独立结构把新功能嵌入旧框架。',
            evidence_asset_ids: ['asset-live'],
          },
          causal_chains: [],
          comparisons: [],
          conflicts: [],
          applicability_boundaries: [],
          recommendations: [{
            statement: '先标出不可改动的旧结构，再布置独立新体量。',
            evidence_asset_ids: ['asset-live'],
          }],
        },
      },
      createdAt: '2026-07-29T00:00:00.000Z',
      updatedAt: '2026-07-29T00:05:00.000Z',
    }
    const client = mockClient({
      listRuns: vi.fn().mockResolvedValue([run]),
      getResults: vi.fn().mockResolvedValue([{
        id: 'asset-live',
        run_id: run.id,
        project_name: 'Foundry Commons',
        asset_type: 'section',
        source_url: 'https://example.com/foundry',
        image_url: 'https://example.com/foundry.jpg',
        publication_tier: 'trusted_secondary',
        project_identity: 'confirmed',
        asset_association: 'probable',
        primary_source: 'candidate',
        rights_status: 'unknown',
        result_tier: 'verified',
        relevance: 4,
        subquestion_ids: ['program'],
        project_context: '旧厂房保留主框架并植入新的公共层。',
        design_mechanism: '独立公共层穿过旧框架并由竖向核心连接。',
        transfer_strategy: ['标出保留框架', '把新公共层作为独立系统植入'],
        subquestion_analysis: {
          program: {
            project_name_zh: '铸造厂公共空间更新',
            project_context: '旧厂房保留主框架并植入新的公共层。',
            design_mechanism: '独立公共层穿过旧框架并由竖向核心连接。',
            transfer_strategy: ['标出保留框架', '把新公共层作为独立系统植入'],
            observations: [],
            limitations: ['需要复核旧结构承载力。'],
          },
        },
        facts: ['项目正文确认保留旧框架。'],
        observations: [],
        inferences: ['独立系统能保持新旧关系可读。'],
        limitations: ['需要复核旧结构承载力。'],
        rank_index: 0,
        evidence_claims: [{
          id: 'claim-live',
          asset_candidate_id: 'asset-live',
          claim_type: 'fact',
          statement: '项目正文确认保留旧框架。',
          source_url: 'https://example.com/foundry',
          pdf_page: null,
          text_excerpt: 'The existing frame is retained.',
          image_region: null,
        }],
      }]),
      getBoard: vi.fn().mockResolvedValue({
        id: run.id,
        run_id: run.id,
        selected_asset_ids: [],
      }),
    })
    render(
      <App
        client={client}
        clientSessionId="device-session-test"
        verificationToken="verified-token"
      />,
    )

    fireEvent.click(await screen.findByRole('button', {
      name: '打开研究：旧厂房公共功能更新',
    }))

    expect(await screen.findByRole('region', { name: '案例研究结果' })).toBeVisible()
    expect(screen.getByRole('heading', { name: '把案例研究带回方案' })).toBeVisible()
    expect(screen.getByRole('button', { name: '对照案例策略' })).toBeVisible()
    expect(screen.getByRole('button', { name: '导出案例对照表' })).toBeVisible()
    expect(screen.getByRole('button', { name: '生成可分享结果板' })).toBeVisible()
    await waitFor(() => expect(client.getResults).toHaveBeenCalledWith(run.id))
  })
})
