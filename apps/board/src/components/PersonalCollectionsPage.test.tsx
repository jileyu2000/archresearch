import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { PersonalCollection } from '../api/client'
import { PersonalCollectionsPage } from './PersonalCollectionsPage'

const architectureCollection: PersonalCollection = {
  id: 'collection-case',
  workspace_id: 'workspace-1',
  asset_candidate_id: 'case-asset',
  source_url: 'https://example.com/case',
  note: '',
  snapshot: {
    question: '旧厂房怎样植入公共功能？',
    goal: 'precedent_research',
    project_name: 'Live Mill Conversion',
    case_subquestions: [{
      id: 'program',
      question: '公共功能怎样与保留结构形成清晰层次？',
      project_name_zh: '织造厂再生中心',
      project_context: '旧砖壳完整保留。',
      design_mechanism: '新增公共层穿过保留框架。',
      transfer_strategy: ['先把公共功能放在独立结构层。'],
      limitations: ['适用于旧结构承载能力有限的项目。'],
    }],
    case_images: [{
      asset_id: 'case-image',
      asset_type: 'section',
      image_url: 'https://example.com/case-section.jpg',
      source_url: 'https://example.com/case',
    }],
  },
  created_at: '2026-07-27T08:00:00Z',
}

const visualCollection: PersonalCollection = {
  id: 'collection-visual',
  workspace_id: 'workspace-1',
  asset_candidate_id: 'visual-asset',
  source_url: 'https://example.com/drawing',
  note: '',
  snapshot: {
    question: '社区中心轴测图怎样表达公共路径？',
    goal: 'visual_reference_search',
    project_name: '轴测图参考',
    asset_type: 'axonometric',
    collection_file: 'collections/visual.png',
    visual_directions: ['精细线稿轴测图'],
  },
  created_at: '2026-07-27T08:01:00Z',
}

function pageProps(
  overrides: Partial<React.ComponentProps<typeof PersonalCollectionsPage>> = {},
) {
  return {
    loading: false,
    collections: [architectureCollection, visualCollection],
    view: 'precedent' as const,
    selectedSubquestion: null,
    onViewChange: vi.fn(),
    onSelectedSubquestionChange: vi.fn(),
    onDelete: vi.fn(),
    ...overrides,
  }
}

describe('PersonalCollectionsPage', () => {
  it('renders loading and view-specific empty states', () => {
    const { rerender } = render(<PersonalCollectionsPage {...pageProps({ loading: true })} />)

    expect(screen.getByRole('status')).toHaveTextContent('正在读取收藏…')

    rerender(<PersonalCollectionsPage {...pageProps({ collections: [] })} />)
    expect(screen.getByText('还没有建筑方案收藏。去建筑研究结果中选择案例。')).toBeVisible()

    rerender(<PersonalCollectionsPage {...pageProps({
      collections: [],
      view: 'visual',
    })} />)
    expect(screen.getByText('还没有图纸灵感收藏。去图纸灵感结果中选择图片。')).toBeVisible()
  })

  it('exposes the architecture directory, selected detail, back action, and delete callback', async () => {
    const user = userEvent.setup()
    const props = pageProps()
    const { rerender } = render(<PersonalCollectionsPage {...props} />)

    const directory = screen.getByRole('region', { name: '建筑问题目录' })
    const target = within(directory).getByRole('button', {
      name: '查看子问题：公共功能怎样与保留结构形成清晰层次？',
    })
    expect(target.querySelector('strong')).toHaveTextContent('旧厂房怎样植入公共功能？')

    await user.click(target)
    expect(props.onSelectedSubquestionChange).toHaveBeenCalledWith({
      collectionQuestion: '旧厂房怎样植入公共功能？',
      subquestionId: 'program',
    })

    rerender(<PersonalCollectionsPage {...pageProps({
      selectedSubquestion: {
        collectionQuestion: '旧厂房怎样植入公共功能？',
        subquestionId: 'program',
      },
      onSelectedSubquestionChange: props.onSelectedSubquestionChange,
      onDelete: props.onDelete,
    })} />)

    const savedCase = screen.getByRole('article', { name: '收藏案例 织造厂再生中心' })
    expect(within(savedCase).getByText('Live Mill Conversion')).toBeVisible()
    expect(within(savedCase).getByText('新增公共层穿过保留框架。')).toBeVisible()
    expect(within(savedCase).getByRole('link', { name: '打开出处：织造厂再生中心' }))
      .toHaveAttribute('href', 'https://example.com/case')

    await user.click(within(savedCase).getByRole('button', { name: '删除收藏：织造厂再生中心' }))
    expect(props.onDelete).toHaveBeenCalledWith('collection-case')

    await user.click(screen.getByRole('button', { name: '返回问题目录' }))
    expect(props.onSelectedSubquestionChange).toHaveBeenLastCalledWith(null)
  })

  it('renders visual context and delegates view changes and deletion', async () => {
    const user = userEvent.setup()
    const props = pageProps({ view: 'visual' })
    render(<PersonalCollectionsPage {...props} />)

    expect(screen.getByRole('img', { name: '轴测图参考' }))
      .toHaveAttribute('src', '/v1/collections/collection-visual/content')
    expect(screen.getByText('原研究问题：社区中心轴测图怎样表达公共路径？')).toBeVisible()
    expect(screen.getByText('灵感方向：精细线稿轴测图')).toBeVisible()

    await user.click(screen.getByRole('button', { name: /建筑方案.*1 项.*项目与研究文字/ }))
    expect(props.onViewChange).toHaveBeenCalledWith('precedent')

    await user.click(screen.getByRole('button', { name: '删除收藏：轴测图参考' }))
    expect(props.onDelete).toHaveBeenCalledWith('collection-visual')
  })
})
