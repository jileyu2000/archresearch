import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { WorkResult } from '../lib/workResult'
import { ComparisonDialog } from './ComparisonDialog'
import { SharePanel } from './SharePanel'
import { SourceInspector } from './SourceInspector'
import { StylePanel, type StyleDraft } from './StylePanel'

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
    transferStrategy: ['先确认保留边界'],
    fact: '项目页确认旧结构被保留。',
    observation: '图中看到新增楼板与旧墙脱开。',
    inference: '可把新增公共层作为独立系统植入。',
    limitation: '需要核对旧结构承载力。',
    accent: '#315cf4',
    drawing: 'section-steps',
    analysisReady: true,
    evidenceClaims: [{
      id: 'claim-1',
      asset_candidate_id: 'asset-1',
      claim_type: 'fact',
      statement: '项目页确认旧结构被保留。',
      source_url: 'https://example.com/project#evidence',
      pdf_page: 12,
      text_excerpt: 'Existing structure retained.',
      image_region: null,
    }],
    previewUrl: 'https://example.com/preview.jpg',
    previewSource: 'public',
    subquestionAnalysis: {},
    ...overrides,
  }
}

describe('leaf overlay panels', () => {
  it('keeps SharePanel as a confirmation-only view', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    const onClose = vi.fn()
    render(
      <SharePanel
        isVisualResearch={false}
        selectedCount={3}
        shareableCount={2}
        onConfirm={onConfirm}
        onClose={onClose}
      />,
    )

    expect(screen.getByRole('dialog', { name: '分享版导出摘要' })).toHaveTextContent(
      '1 项因图片授权受限，分享版中只保留研究文字与来源',
    )
    await user.click(screen.getByRole('button', { name: '确认生成分享版' }))
    await user.click(screen.getByRole('button', { name: '暂不生成，返回结果' }))
    expect(onConfirm).toHaveBeenCalledOnce()
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('keeps StylePanel controlled by App and forwards save and close actions', async () => {
    const user = userEvent.setup()
    const profile: StyleDraft = {
      primaryColor: '#315cf4',
      lineHierarchy: 'relative',
      fontCategory: 'sans',
      texture: 'none',
      layoutNotes: '',
    }
    const onChange = vi.fn()
    const onSave = vi.fn()
    const onClose = vi.fn()
    render(
      <StylePanel
        profile={profile}
        status="表达规范已保存"
        onChange={onChange}
        onSave={onSave}
        onClose={onClose}
      />,
    )

    await user.selectOptions(screen.getByRole('combobox', { name: '线宽层级' }), 'uniform')
    expect(onChange).toHaveBeenCalledWith({ ...profile, lineHierarchy: 'uniform' })
    expect(screen.getByRole('status')).toHaveTextContent('表达规范已保存')
    await user.click(screen.getByRole('button', { name: '保存表达规范' }))
    await user.click(screen.getByRole('button', { name: '关闭表达规范' }))
    expect(onSave).toHaveBeenCalledOnce()
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('derives the comparison guide and forwards failed previews', () => {
    const first = workResult()
    const second = workResult({
      id: 'asset-2',
      title: '独立交通核',
      project: 'Courtyard Mill',
      previewUrl: 'https://example.com/preview-2.jpg',
      inference: '可用独立交通核串联各层。',
    })
    const onPreviewFailed = vi.fn()
    const onClose = vi.fn()
    render(
      <ComparisonDialog
        results={[first, second]}
        failedPreviewUrls={{}}
        onPreviewFailed={onPreviewFailed}
        onClose={onClose}
      />,
    )

    const dialog = screen.getByRole('dialog', { name: '对照案例策略' })
    expect(within(dialog).getByText(/这 2 项都在回答/)).toBeVisible()
    expect(within(dialog).getByRole('table', { name: '案例策略对照表' })).toBeVisible()
    fireEvent.error(dialog.querySelector('img') as HTMLImageElement)
    expect(onPreviewFailed).toHaveBeenCalledWith(first.id, first.previewUrl)
    fireEvent.click(within(dialog).getByRole('button', { name: '关闭案例策略对照' }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('renders SourceInspector evidence and forwards result actions without owning state', async () => {
    const user = userEvent.setup()
    const result = workResult()
    const onPreviewFailed = vi.fn()
    const onToggleSaved = vi.fn()
    const onToggleRejected = vi.fn()
    const onNoteChange = vi.fn()
    const onNoteSave = vi.fn()
    const onClose = vi.fn()
    render(
      <SourceInspector
        result={result}
        failedPreviewUrls={{}}
        saved={false}
        rejected
        note="需要核对节点"
        onPreviewFailed={onPreviewFailed}
        onToggleSaved={onToggleSaved}
        onToggleRejected={onToggleRejected}
        onNoteChange={onNoteChange}
        onNoteSave={onNoteSave}
        onClose={onClose}
      />,
    )

    const inspector = screen.getByRole('dialog', { name: '来源检视器' })
    expect(within(inspector).getByText('Existing structure retained.')).toBeVisible()
    expect(within(inspector).getByText('PDF 第 12 页')).toBeVisible()
    fireEvent.error(within(inspector).getByRole('img', { name: 'Live Mill Conversion 剖面图' }))
    expect(onPreviewFailed).toHaveBeenCalledWith(result.id, result.previewUrl)
    await user.click(within(inspector).getByRole('button', { name: '收藏参考' }))
    await user.click(within(inspector).getByRole('button', { name: '撤销拒绝' }))
    expect(onToggleSaved).toHaveBeenCalledOnce()
    expect(onToggleRejected).toHaveBeenCalledOnce()

    const note = within(inspector).getByRole('textbox', { name: '研究备注' })
    fireEvent.change(note, { target: { value: '补查结构节点' } })
    fireEvent.blur(note, { target: { value: '补查结构节点' } })
    expect(onNoteChange).toHaveBeenCalledWith('补查结构节点')
    expect(onNoteSave).toHaveBeenCalledWith('补查结构节点')

    fireEvent.click(document.querySelector('.drawer-backdrop') as HTMLButtonElement)
    expect(onClose).toHaveBeenCalledOnce()
  })
})
