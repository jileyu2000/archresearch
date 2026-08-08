import { createRef } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { ResearchRun } from '../api/client'
import { HomeSections } from './HomeSections'
import { ResearchComposer } from './ResearchComposer'

function composerProps(
  overrides: Partial<React.ComponentProps<typeof ResearchComposer>> = {},
) {
  return {
    questionInputRef: createRef<HTMLTextAreaElement>(),
    goal: 'precedent_research' as const,
    mode: 'balanced' as const,
    question: '旧建筑怎样植入公共功能？',
    files: [] as File[],
    referenceUrl: '',
    demoMode: false,
    activeWorkspaceId: 'workspace-1',
    briefReviewLoading: false,
    researchStarting: false,
    isRunActive: false,
    loading: false,
    researchOptionsOpen: false,
    composerError: '',
    researchEnvironmentReady: false,
    researchEnvironmentTitle: '研究环境待连接',
    researchEnvironmentDetail: '连接 Chrome 后可搜索小红书，并读取当前页面高清图',
    showBrowserConnectAction: true,
    showXiaohongshuLoginAction: false,
    xiaohongshuLoginFlow: 'idle' as const,
    browserConnecting: false,
    browserReadinessLoading: false,
    browserReadinessError: '',
    browserPairingStatus: '',
    activeRun: null,
    onSubmit: vi.fn(),
    onGoalChange: vi.fn(),
    onQuestionChange: vi.fn(),
    onModeChange: vi.fn(),
    onToggleOptions: vi.fn(),
    onFilesChange: vi.fn(),
    onReferenceUrlChange: vi.fn(),
    onConnectBrowser: vi.fn(),
    onOpenXiaohongshuLogin: vi.fn(),
    onOpenVisualUsage: vi.fn(),
    onRefreshBrowserReadiness: vi.fn(),
    onCancel: vi.fn(),
    onRetry: vi.fn(),
    ...overrides,
  }
}

describe('home view components', () => {
  it('keeps the architecture composer controlled and forwards optional-material actions', async () => {
    const user = userEvent.setup()
    const props = composerProps({
      researchOptionsOpen: true,
      composerError: '任务书读取失败：文件损坏',
    })
    render(<ResearchComposer {...props} />)

    const composer = screen.getByRole('region', { name: '新建研究' })
    expect(within(composer).getByRole('radio', { name: /形成方案依据/ })).toBeChecked()
    expect(within(composer).getByRole('alert')).toHaveTextContent('任务书读取失败：文件损坏')

    fireEvent.change(within(composer).getByRole('textbox', { name: '研究问题' }), {
      target: { value: '更新后的问题' },
    })
    expect(props.onQuestionChange).toHaveBeenCalledWith('更新后的问题')

    await user.click(within(composer).getByRole('radio', { name: /快速找方向/ }))
    expect(props.onModeChange).toHaveBeenCalledWith('quick')

    await user.click(within(composer).getByRole('button', {
      name: '添加任务书或案例页（可选）',
    }))
    expect(props.onToggleOptions).toHaveBeenCalledOnce()

    const brief = new File(['brief'], 'museum-brief.pdf', { type: 'application/pdf' })
    await user.upload(within(composer).getByLabelText('项目任务书（PDF）'), brief)
    expect(props.onFilesChange).toHaveBeenCalledWith([brief])

    fireEvent.change(within(composer).getByRole('textbox', { name: '指定案例或项目网页' }), {
      target: { value: 'https://example.com/case' },
    })
    expect(props.onReferenceUrlChange).toHaveBeenCalledWith('https://example.com/case')

    await user.click(within(composer).getByRole('button', { name: '开始研究' }))
    expect(props.onSubmit).toHaveBeenCalledOnce()

    await user.click(within(composer).getByRole('button', { name: /图纸灵感/ }))
    expect(props.onGoalChange).toHaveBeenCalledWith('visual_reference_search')
  })

  it('renders the visual research environment and delegates connection controls', async () => {
    const user = userEvent.setup()
    const props = composerProps({
      goal: 'visual_reference_search',
      mode: 'quick',
      researchEnvironmentTitle: '研究环境已就绪',
      researchEnvironmentDetail: '小红书负责查找灵感 · Chrome 可读取当前页面高清图',
      researchEnvironmentReady: true,
      showXiaohongshuLoginAction: true,
      browserPairingStatus: '图纸提取扩展已连接',
    })
    render(<ResearchComposer {...props} />)

    expect(screen.getByRole('heading', { name: '找图纸视觉方向' })).toBeVisible()
    expect(screen.getByText('剖面图、爆炸图等图纸类型，与分割、构图、线型、配色或版式等视觉方向。')).toBeVisible()
    expect(screen.queryByText(/空间、流线、剖面或表达/)).not.toBeInTheDocument()
    const environment = screen.getByRole('region', { name: '研究环境' })
    expect(within(environment).getByText('研究环境已就绪')).toBeVisible()
    expect(within(environment).getByText('图纸提取扩展已连接')).toBeVisible()
    expect(screen.queryByRole('group', { name: '研究方式' })).not.toBeInTheDocument()
    await user.click(within(environment).getByRole('button', { name: '使用方法' }))
    await user.click(within(environment).getByRole('button', { name: '打开小红书登录' }))

    await user.click(within(environment).getByRole('button', { name: '连接 Chrome 读取高清图纸' }))
    await user.click(within(environment).getByRole('button', { name: '重新检测' }))
    expect(props.onConnectBrowser).toHaveBeenCalledOnce()
    expect(props.onOpenXiaohongshuLogin).toHaveBeenCalledOnce()
    expect(props.onOpenVisualUsage).toHaveBeenCalledOnce()
    expect(props.onRefreshBrowserReadiness).toHaveBeenCalledOnce()
  })

  it('renders starters, controlled workspace creation, and recent-run actions', async () => {
    const user = userEvent.setup()
    const run: ResearchRun = {
      id: 'run-1',
      question: '旧厂房如何植入新的公共功能？',
      title: '旧厂房公共功能植入',
      goal: 'precedent_research',
      status: 'completed',
      mode: 'balanced',
      subquestions: [],
      keepForever: false,
      retentionExpiresAt: '2027-01-20T00:00:00Z',
      coverageReport: { usable_assets: 4 },
      updatedAt: '2026-07-28T00:00:00Z',
    }
    const props: React.ComponentProps<typeof HomeSections> = {
      demoMode: false,
      currentWorkspaceName: '城市更新',
      workspaceCreateOpen: true,
      newWorkspaceName: '毕业设计',
      recentRuns: [run],
      retentionUpdatingId: '',
      loading: false,
      onApplyStarter: vi.fn(),
      onToggleWorkspaceCreate: vi.fn(),
      onWorkspaceNameChange: vi.fn(),
      onCreateWorkspace: vi.fn(),
      onOpenRun: vi.fn(),
      onRetentionChange: vi.fn(),
    }
    render(<HomeSections {...props} />)

    const home = screen.getByRole('region', { name: '研究起点与最近任务' })
    await user.click(within(home).getByRole('button', {
      name: '填入问题：旧建更新，原有结构不动，怎样植入新的公共功能？',
    }))
    expect(props.onApplyStarter).toHaveBeenCalledWith(
      '原有结构不动，怎样植入新的公共功能？',
      'precedent_research',
    )

    fireEvent.change(within(home).getByRole('textbox', { name: '项目名称' }), {
      target: { value: '社区中心' },
    })
    expect(props.onWorkspaceNameChange).toHaveBeenCalledWith('社区中心')
    await user.click(within(home).getByRole('button', { name: '创建项目' }))
    expect(props.onCreateWorkspace).toHaveBeenCalledOnce()

    await user.click(within(home).getByRole('button', { name: '打开研究：旧厂房公共功能植入' }))
    expect(props.onOpenRun).toHaveBeenCalledWith(run)
    await user.click(within(home).getByRole('button', {
      name: '永久保留：旧厂房公共功能植入',
    }))
    expect(props.onRetentionChange).toHaveBeenCalledWith(run)
  })
})
