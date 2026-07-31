import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { WorkResult } from '../lib/workResult'
import { analysisFor, projectPreviewCopy } from '../lib/workResult'
import { CaseAnalysis } from './CaseAnalysis'
import { VisualInspirationBoard } from './VisualInspirationBoard'

function workResult(overrides: Partial<WorkResult> = {}): WorkResult {
  return {
    id: 'asset-1',
    title: '保留结构中的公共层',
    project: 'Live Mill Conversion',
    location: '上海',
    year: '2026',
    assetType: 'section',
    tier: 'verified',
    relevance: 4,
    publicationTier: 'primary',
    projectIdentity: 'confirmed',
    assetAssociation: 'confirmed',
    primarySource: 'confirmed',
    rightsStatus: 'open_license',
    sourceName: 'Example',
    sourceUrl: 'https://example.com/project',
    imageUrl: 'https://example.com/image.jpg',
    subquestionIds: ['structure'],
    projectContext: '旧结构被保留。',
    designMechanism: '新增公共层穿过旧框架。',
    transferStrategy: ['先确认保留边界。'],
    fact: '项目页确认旧结构被保留。',
    observation: '图中看到新增楼板与旧墙脱开。',
    inference: '可把新增公共层作为独立系统植入。',
    limitation: '适用于旧结构承载能力有限的项目。',
    accent: '#315cf4',
    drawing: 'section-steps',
    analysisReady: true,
    evidenceClaims: [],
    previewUrl: 'https://example.com/preview.jpg',
    previewSource: 'public',
    subquestionAnalysis: {
      structure: {
        projectNameZh: '织造厂再生中心',
        projectContext: '旧砖壳完整保留。',
        designMechanism: '新增公共层穿过旧框架。',
        transferStrategy: ['先确认保留边界。', '再把公共层作为独立结构植入。'],
        observations: ['新增楼板与旧墙脱开。'],
        limitations: ['适用于旧结构承载能力有限的项目。'],
      },
    },
    ...overrides,
  }
}

describe('result view components', () => {
  it('renders visual directions, posts, image selection, and inspector callbacks', async () => {
    const user = userEvent.setup()
    const result = workResult({
      id: 'visual-1',
      project: '精细线稿轴测图',
      assetType: 'axonometric',
      tier: 'visual_lead',
      publicationTier: 'aggregator',
      rightsStatus: 'unknown',
      sourceUrl: 'https://www.xiaohongshu.com/explore/note-1',
      subquestionIds: ['linework'],
      observation: '蓝灰线稿配少量黄色节点。',
      previewUrl: 'https://example.com/axonometric.jpg',
      drawing: 'axon',
    })
    const onOpenResult = vi.fn()
    const onPreviewFailed = vi.fn()
    const onToggleSelection = vi.fn()
    render(
      <VisualInspirationBoard
        isVisualResearch
        postCount={1}
        inspirationResults={[result]}
        allResults={[result]}
        groups={[{
          subquestion: {
            id: 'linework',
            question: '精细线稿轴测图',
            rationale: '比较线型层次与重点标注。',
          },
          assets: [result],
          typeGroups: [{ assetType: 'axonometric', assets: [result] }],
          noteGroups: [{
            sourceUrl: result.sourceUrl,
            assets: [result],
            primary: result,
            observation: '蓝灰线稿配少量黄色节点。',
            relevance: 4,
          }],
        }]}
        selectedIds={[]}
        failedPreviewUrls={{}}
        onOpenResult={onOpenResult}
        onPreviewFailed={onPreviewFailed}
        onToggleSelection={onToggleSelection}
      />,
    )

    const board = screen.getByRole('region', { name: '视觉灵感板' })
    expect(within(board).getByText('1 篇帖子 · 1 张灵感图')).toBeVisible()
    expect(within(board).getByText('轴测图 · 1 张')).toBeVisible()
    expect(within(board).getByText('蓝灰线稿配少量黄色节点。')).toBeVisible()

    const preview = within(board).getByRole('button', {
      name: '查看制图灵感 精细线稿轴测图 轴测图',
    })
    await user.click(preview)
    expect(onOpenResult).toHaveBeenCalledWith(preview, 'visual-1', 'linework')

    await user.click(within(board).getByRole('button', {
      name: '选择 精细线稿轴测图 · 精细线稿轴测图 · 轴测图 · 第 1 张用于收藏',
    }))
    expect(onToggleSelection).toHaveBeenCalledWith('visual-1')

    fireEvent.error(within(board).getByRole('img', { name: '精细线稿轴测图 轴测图' }))
    expect(onPreviewFailed).toHaveBeenCalledWith('visual-1', result.previewUrl)
  })

  it('renders answer-first case chapters and delegates direct-save and selection actions', async () => {
    const user = userEvent.setup()
    const result = workResult()
    const analysis = analysisFor(result, 'structure')
    const onAddCase = vi.fn()
    const onToggleCaseSelection = vi.fn()
    const onPreviewFailed = vi.fn()
    render(
      <CaseAnalysis
        groups={[{
          index: 0,
          subquestion: {
            id: 'structure',
            question: '公共功能怎样与保留结构形成清晰层次？',
            rationale: '比较新旧结构关系。',
          },
          assets: [result],
          dossiers: [{
            project: result.project,
            assets: [result],
            primary: result,
            analysis,
            previewCopy: projectPreviewCopy([result], analysis, 'structure'),
          }],
          questionSummary: { statement: analysis.designMechanism },
          unassigned: false,
        }]}
        allResults={[result]}
        isVisualResearch={false}
        researchGoal="precedent_research"
        failedPreviewUrls={{}}
        selectedCollectionKeys={[]}
        selectionCount={0}
        savedIds={[]}
        rejectedIds={[]}
        collectionSaving={false}
        inspectorOpen={false}
        selectedResultId=""
        selectedSubquestionId=""
        onAddCase={onAddCase}
        onToggleCaseSelection={onToggleCaseSelection}
        onOpenResult={vi.fn()}
        onPreviewFailed={onPreviewFailed}
        isBrowserUnavailable={() => false}
      />,
    )

    const results = screen.getByRole('region', { name: '案例研究结果' })
    expect(within(results).getAllByText('新增公共层穿过旧框架。')).toHaveLength(1)
    const dossier = within(results).getByRole('article', { name: '代表案例 织造厂再生中心' })
    expect(within(dossier).getByText('Live Mill Conversion')).toBeVisible()
    expect(within(dossier).getByText('再把公共层作为独立结构植入。')).toBeVisible()
    expect(within(dossier).getByText('适用于旧结构承载能力有限的项目。')).toBeVisible()
    expect(within(dossier).getByRole('link', { name: '打开出处：织造厂再生中心' }))
      .toHaveAttribute('href', result.sourceUrl)

    await user.click(within(dossier).getByRole('button', {
      name: '加入个人收藏 织造厂再生中心',
    }))
    expect(onAddCase).toHaveBeenCalledWith('asset-1', 'structure')

    await user.click(within(dossier).getByRole('button', {
      name: '选择案例 织造厂再生中心',
    }))
    expect(onToggleCaseSelection).toHaveBeenCalledWith('asset-1', 'structure')

    fireEvent.error(within(dossier).getByRole('img', { name: '织造厂再生中心 剖面图' }))
    expect(onPreviewFailed).toHaveBeenCalledWith('asset-1', result.previewUrl)
  })

  it('keeps empty chapters and visual browser-unavailable previews explicit', async () => {
    const user = userEvent.setup()
    const result = workResult({
      previewUrl: null,
      previewSource: null,
    })
    const analysis = analysisFor(result, 'structure')
    const onOpenResult = vi.fn()
    render(
      <CaseAnalysis
        groups={[
          {
            index: 0,
            subquestion: {
              id: 'empty',
              question: '入口流线怎样分开？',
              rationale: '比较访客与后勤路径。',
            },
            assets: [],
            dossiers: [],
            questionSummary: null,
            unassigned: false,
          },
          {
            index: 1,
            subquestion: {
              id: 'structure',
              question: '公共功能怎样与保留结构形成清晰层次？',
              rationale: '比较新旧结构关系。',
            },
            assets: [result],
            dossiers: [{
              project: result.project,
              assets: [result],
              primary: result,
              analysis,
              previewCopy: projectPreviewCopy([result], analysis, 'structure'),
            }],
            questionSummary: { statement: analysis.designMechanism },
            unassigned: false,
          },
        ]}
        allResults={[result]}
        isVisualResearch
        researchGoal="visual_reference_search"
        failedPreviewUrls={{}}
        selectedCollectionKeys={[]}
        selectionCount={0}
        savedIds={[]}
        rejectedIds={[]}
        collectionSaving={false}
        inspectorOpen={false}
        selectedResultId=""
        selectedSubquestionId=""
        onAddCase={vi.fn()}
        onToggleCaseSelection={vi.fn()}
        onOpenResult={onOpenResult}
        onPreviewFailed={vi.fn()}
        isBrowserUnavailable={() => true}
      />,
    )

    expect(screen.getByRole('region', { name: '入口流线怎样分开？' }))
      .toHaveTextContent('这一问题暂时没有可用结果')
    expect(screen.getByText('此次未连接浏览器扩展，暂无项目预览')).toBeVisible()

    const evidence = screen.getByRole('button', { name: '查看 Live Mill Conversion 剖面图证据' })
    await user.click(evidence)
    expect(onOpenResult).toHaveBeenCalledWith(evidence, 'asset-1', 'structure')
  })
})
