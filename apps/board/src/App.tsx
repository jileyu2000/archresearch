import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity,
  ArrowUp,
  Check,
  CircleDashed,
  Columns3,
  Download,
  Eye,
  FolderPlus,
  LayoutGrid,
  Palette,
  Paperclip,
  Plus,
  Search,
  Share2,
  ShieldCheck,
  SlidersHorizontal,
  X,
} from 'lucide-react'

import {
  ApiError,
  apiClient,
  type ApiAssetCandidate,
  type ApiEvidenceClaim,
  type ArchitectureAssetType,
  type ResearchGoal,
  type ResearchMode,
  type ResearchRun,
  type RunStatus,
  type TraceEvent,
  type Workspace,
} from './api/client'
import {
  evidenceResults,
  traceItems,
  workspaces as demoWorkspaces,
  type AssetType,
  type EvidenceResult,
  type ResultTier,
} from './data/mock'

type WorkResult = EvidenceResult & {
  evidenceClaims: ApiEvidenceClaim[]
  previewUrl: string | null
}

type StyleDraft = {
  primaryColor: string
  lineHierarchy: 'relative' | 'contrast' | 'uniform'
  fontCategory: 'sans' | 'serif' | 'mono'
}

const terminalStatuses = new Set<RunStatus>([
  'completed',
  'partial',
  'blocked',
  'cancelled',
  'failed',
])

const tierLabels: Record<ResultTier, string> = {
  verified: '已核验参考',
  partial: '部分核验参考',
  visual_lead: '视觉线索参考',
}

const modeLabels: Record<ResearchMode, string> = {
  quick: 'Quick',
  balanced: 'Balanced',
  deep: 'Deep',
}

const assetLabels: Record<AssetType, string> = {
  plan: '平面图',
  section: '剖面图',
  elevation: '立面图',
  site_plan: '总平面图',
  axonometric: '轴测图',
  circulation: '流线图',
  analysis_diagram: '分析图',
  render: '效果图',
  photograph: '项目照片',
  diagram: '分析图',
}

const filterAssetTypes = (Object.keys(assetLabels) as AssetType[]).filter(
  (assetType) => assetType !== 'diagram',
)

const stageLabels: Array<{ status: RunStatus; label: string }> = [
  { status: 'planning', label: '规划' },
  { status: 'searching', label: '搜索' },
  { status: 'inspecting', label: '浏览页面' },
  { status: 'analyzing', label: '识别图纸' },
  { status: 'verifying', label: '核验来源' },
  { status: 'gap_check', label: '检查缺口' },
  { status: 'composing', label: '编排结果' },
  { status: 'completed', label: '完成' },
]

const defaultStyle: StyleDraft = {
  primaryColor: '#315cf4',
  lineHierarchy: 'relative',
  fontCategory: 'sans',
}

function apiMessage(error: unknown) {
  return error instanceof ApiError || error instanceof Error ? error.message : '操作失败。'
}

function runAnnouncement(run: ResearchRun) {
  const labels: Record<RunStatus, string> = {
    created: '已创建',
    planning: '正在规划',
    searching: '正在搜索',
    inspecting: '正在浏览页面',
    analyzing: '正在识别图纸',
    verifying: '正在核验来源',
    gap_check: '正在检查证据缺口',
    composing: '正在编排参考板',
    completed: '研究已完成',
    partial: '已交付部分结果',
    blocked: '研究受阻，已有结果已保留',
    cancelled: '已取消',
    failed: '研究失败，已有结果已保留',
  }
  return labels[run.status]
}

function drawingFor(assetType: AssetType): EvidenceResult['drawing'] {
  const drawings: Partial<Record<AssetType, EvidenceResult['drawing']>> = {
    plan: 'courtyard',
    section: 'section-steps',
    elevation: 'facade',
    site_plan: 'grid',
    axonometric: 'axon',
    circulation: 'circulation',
    analysis_diagram: 'circulation',
    diagram: 'circulation',
    render: 'landscape',
    photograph: 'landscape',
  }
  return drawings[assetType] ?? 'grid'
}

function toWorkResult(candidate: ApiAssetCandidate): WorkResult {
  const assetType = candidate.asset_type as ArchitectureAssetType
  return {
    id: candidate.id,
    title: candidate.inferences[0] ?? `${assetLabels[assetType]}研究线索`,
    project: candidate.project_name,
    location: '实时网页研究',
    year: '待核验',
    assetType,
    tier: candidate.result_tier,
    relevance: Math.max(0, Math.min(4, candidate.relevance)) as EvidenceResult['relevance'],
    publicationTier: candidate.publication_tier,
    projectIdentity: candidate.project_identity,
    assetAssociation: candidate.asset_association,
    primarySource: candidate.primary_source,
    rightsStatus: candidate.rights_status,
    sourceName: candidate.publication_tier,
    sourceUrl: candidate.source_url,
    imageUrl: candidate.image_url,
    previewUrl:
      candidate.image_url ??
      (candidate.has_local_content ? `/v1/assets/${candidate.id}/content` : null),
    fact: candidate.facts[0] ?? '当前来源没有可绑定的正式事实。',
    observation: candidate.observations[0] ?? '当前图块尚未形成可靠的视觉观察。',
    inference: candidate.inferences[0] ?? '尚未形成可转译的设计方法推断。',
    limitation: candidate.limitations[0] ?? '需要回到原始页面继续核对适用条件。',
    accent:
      candidate.result_tier === 'verified'
        ? '#2D846B'
        : candidate.result_tier === 'partial'
          ? '#315CF4'
          : '#7D817E',
    drawing: drawingFor(assetType),
    evidenceClaims: candidate.evidence_claims,
  }
}

function demoResults(): WorkResult[] {
  return evidenceResults.map((result) => ({
    ...result,
    previewUrl: result.imageUrl ?? null,
    evidenceClaims: [],
  }))
}

function traceSummary(summary: unknown) {
  return typeof summary === 'string' ? summary : JSON.stringify(summary)
}

export default function App() {
  const demoMode = useMemo(() => new URLSearchParams(window.location.search).get('demo') === '1', [])
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [activeWorkspaceId, setActiveWorkspaceId] = useState('')
  const [newWorkspaceName, setNewWorkspaceName] = useState('')
  const [results, setResults] = useState<WorkResult[]>(demoMode ? demoResults() : [])
  const [selectedResultId, setSelectedResultId] = useState(
    demoMode ? (evidenceResults[0]?.id ?? '') : '',
  )
  const [question, setQuestion] = useState('')
  const [referenceUrl, setReferenceUrl] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [goal, setGoal] = useState<ResearchGoal>('precedent_research')
  const [mode, setMode] = useState<ResearchMode>('balanced')
  const [activeRun, setActiveRun] = useState<ResearchRun | null>(null)
  const [pollingRunId, setPollingRunId] = useState('')
  const [announcement, setAnnouncement] = useState('')
  const [actionError, setActionError] = useState('')
  const [loading, setLoading] = useState(!demoMode)
  const [assetFilter, setAssetFilter] = useState<'all' | AssetType>('all')
  const [savedIds, setSavedIds] = useState<string[]>([])
  const [rejectedIds, setRejectedIds] = useState<string[]>([])
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [comparisonIds, setComparisonIds] = useState<string[]>([])
  const [comparisonOpen, setComparisonOpen] = useState(false)
  const [shareSummaryOpen, setShareSummaryOpen] = useState(false)
  const [styleProfileOpen, setStyleProfileOpen] = useState(false)
  const [traceOpen, setTraceOpen] = useState(false)
  const [boardId, setBoardId] = useState(demoMode ? 'mock-board-active' : '')
  const [styleProfile, setStyleProfile] = useState<StyleDraft>(defaultStyle)
  const [styleStatus, setStyleStatus] = useState('')
  const [traceEvents, setTraceEvents] = useState<TraceEvent[]>([])
  const [composerOpen, setComposerOpen] = useState(!demoMode)
  const [researchOptionsOpen, setResearchOptionsOpen] = useState(false)
  const [workspaceCreateOpen, setWorkspaceCreateOpen] = useState(false)
  const [inspectorOpen, setInspectorOpen] = useState(false)
  const overlayTriggerRef = useRef<HTMLElement | null>(null)

  const selectedResult = results.find((result) => result.id === selectedResultId)
  const overlayOpen = inspectorOpen || traceOpen || comparisonOpen || shareSummaryOpen || styleProfileOpen

  const closeOverlays = useCallback(() => {
    const trigger = overlayTriggerRef.current
    setInspectorOpen(false)
    setTraceOpen(false)
    setComparisonOpen(false)
    setShareSummaryOpen(false)
    setStyleProfileOpen(false)
    trigger?.focus()
  }, [])

  useEffect(() => {
    if (!overlayOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeOverlays()
        return
      }
      if (event.key !== 'Tab') return
      const dialog = document.querySelector<HTMLElement>('[role="dialog"][aria-modal="true"]')
      if (!dialog) return
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary'))
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [closeOverlays, overlayOpen])

  const resetWorkspaceView = useCallback(() => {
    setPollingRunId('')
    setActiveRun(null)
    setAnnouncement('')
    setResults([])
    setSelectedResultId('')
    setBoardId('')
    setComparisonIds([])
    setSavedIds([])
    setRejectedIds([])
    setNotes({})
    setTraceEvents([])
    setStyleProfile(defaultStyle)
    setComposerOpen(true)
    setResearchOptionsOpen(false)
    setInspectorOpen(false)
  }, [])

  useEffect(() => {
    if (demoMode) return
    let active = true
    void apiClient
      .listWorkspaces()
      .then(async (items) => {
        let next = items
        if (next.length === 0) {
          next = [
            await apiClient.createWorkspace({
              name: '建筑研究工作区',
              brief: '记录当前设计任务、约束和实时研究结果。',
            }),
          ]
        }
        if (!active) return
        setWorkspaces(next)
        setActiveWorkspaceId(next[0].id)
      })
      .catch((error) => {
        if (active) {
          setActionError(apiMessage(error))
          setLoading(false)
        }
      })
    return () => {
      active = false
    }
  }, [demoMode])

  const hydrateRun = useCallback(async (runId: string, shouldApply: () => boolean = () => true) => {
    const [apiResults, board, userState, events] = await Promise.all([
      apiClient.getResults(runId),
      apiClient.getBoard(runId),
      apiClient.getUserState(runId),
      apiClient.getEvents(runId),
    ])
    if (!shouldApply()) return
    const nextResults = apiResults.map(toWorkResult)
    setResults(nextResults)
    setSelectedResultId(nextResults[0]?.id ?? '')
    setComposerOpen(nextResults.length === 0)
    setInspectorOpen(false)
    setBoardId(board.id)
    setComparisonIds(board.selected_asset_ids)
    setSavedIds(userState.saved.map((item) => item.asset_candidate_id))
    setRejectedIds(userState.rejected.map((item) => item.asset_candidate_id))
    setNotes(
      Object.fromEntries(userState.saved.map((item) => [item.asset_candidate_id, item.note])),
    )
    setTraceEvents(events)
    const profile = await apiClient.getStyleProfile(board.id)
    if (!shouldApply()) return
    if (profile) {
      const primary = profile.line_weights.primary ?? 1
      const secondary = profile.line_weights.secondary ?? 0.35
      setStyleProfile({
        primaryColor: profile.palette[0] ?? defaultStyle.primaryColor,
        lineHierarchy:
          primary === secondary ? 'uniform' : primary >= 1.1 ? 'contrast' : 'relative',
        fontCategory:
          profile.font_category === 'serif' || profile.font_category === 'mono'
            ? profile.font_category
            : 'sans',
      })
    } else {
      setStyleProfile(defaultStyle)
    }
  }, [])

  useEffect(() => {
    if (demoMode || !activeWorkspaceId) return
    let active = true
    void apiClient
      .listRuns(activeWorkspaceId)
      .then(async (runs) => {
        if (!active) return
        const latest = runs[0]
        if (!latest) return
        setActiveRun(latest)
        setAnnouncement(runAnnouncement(latest))
        await hydrateRun(latest.id, () => active)
        if (active && !terminalStatuses.has(latest.status)) setPollingRunId(latest.id)
      })
      .catch((error) => {
        if (active) setActionError(apiMessage(error))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [activeWorkspaceId, demoMode, hydrateRun])

  useEffect(() => {
    if (demoMode || !pollingRunId) return
    let busy = false
    const timer = window.setInterval(() => {
      if (busy) return
      busy = true
      void apiClient
        .getRun(pollingRunId)
        .then(async (nextRun) => {
          setActiveRun(nextRun)
          setAnnouncement(runAnnouncement(nextRun))
          if (terminalStatuses.has(nextRun.status)) {
            setPollingRunId('')
            await hydrateRun(nextRun.id)
          }
        })
        .catch((error) => {
          setPollingRunId('')
          setActionError(apiMessage(error))
        })
        .finally(() => {
          busy = false
        })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [demoMode, hydrateRun, pollingRunId])

  async function handleCreateWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = newWorkspaceName.trim()
    if (!name) return
    try {
      const created = await apiClient.createWorkspace({ name })
      setWorkspaces((current) => [...current, created])
      resetWorkspaceView()
      setLoading(true)
      setActiveWorkspaceId(created.id)
      setNewWorkspaceName('')
      setWorkspaceCreateOpen(false)
    } catch (error) {
      setActionError(apiMessage(error))
    }
  }

  function handleWorkspaceChange(workspaceId: string) {
    if (demoMode || workspaceId === activeWorkspaceId) return
    resetWorkspaceView()
    setLoading(true)
    setActiveWorkspaceId(workspaceId)
  }

  async function handleResearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setActionError('')
    if (demoMode) {
      setAnnouncement(`${modeLabels[mode]} 模式研究已开始（本地演示）`)
      setComposerOpen(false)
      return
    }
    try {
      const run = await apiClient.startResearch({
        workspaceId: activeWorkspaceId,
        question,
        referenceUrl,
        files,
        goal,
        mode,
      })
      if (terminalStatuses.has(run.status)) {
        setActiveRun(run)
        setAnnouncement(runAnnouncement(run))
        if (run.status !== 'cancelled') await hydrateRun(run.id)
      } else {
        setActiveRun(run)
        setAnnouncement(runAnnouncement(run))
        setPollingRunId(run.id)
      }
      setComposerOpen(false)
      setResearchOptionsOpen(false)
    } catch (error) {
      setActionError(apiMessage(error))
    }
  }

  async function handleCancel() {
    if (!activeRun) return
    try {
      const run = await apiClient.cancelRun(activeRun.id)
      setPollingRunId('')
      setActiveRun(run)
      setAnnouncement(runAnnouncement(run))
    } catch (error) {
      setActionError(apiMessage(error))
    }
  }

  async function handleRetry() {
    if (!activeRun) return
    try {
      const run = await apiClient.retryRun(activeRun.id)
      setActiveRun(run)
      setAnnouncement(runAnnouncement(run))
      if (!terminalStatuses.has(run.status)) setPollingRunId(run.id)
    } catch (error) {
      setActionError(apiMessage(error))
    }
  }

  async function toggleSaved(resultId: string) {
    const isSaved = savedIds.includes(resultId)
    setActionError('')
    try {
      if (isSaved) {
        await apiClient.unsaveResult(resultId)
        setSavedIds((current) => current.filter((id) => id !== resultId))
        return
      }
      if (rejectedIds.includes(resultId)) {
        await apiClient.unrejectResult(resultId)
        setRejectedIds((current) => current.filter((id) => id !== resultId))
      }
      await apiClient.saveResult(resultId, notes[resultId] ?? '')
      setSavedIds((current) => [...new Set([...current, resultId])])
    } catch (error) {
      setActionError(`收藏状态未保存：${apiMessage(error)}`)
    }
  }

  async function toggleRejected(resultId: string) {
    const isRejected = rejectedIds.includes(resultId)
    setActionError('')
    try {
      if (isRejected) {
        await apiClient.unrejectResult(resultId)
        setRejectedIds((current) => current.filter((id) => id !== resultId))
        return
      }
      if (savedIds.includes(resultId)) {
        await apiClient.unsaveResult(resultId)
        setSavedIds((current) => current.filter((id) => id !== resultId))
      }
      await apiClient.rejectResult(resultId, 'not_useful_for_current_problem')
      setRejectedIds((current) => [...new Set([...current, resultId])])
    } catch (error) {
      setActionError(`拒绝状态未保存：${apiMessage(error)}`)
    }
  }

  async function saveNote(resultId: string, note: string) {
    if (demoMode) return
    try {
      await apiClient.saveResult(resultId, note)
      setSavedIds((current) => [...new Set([...current, resultId])])
    } catch (error) {
      setActionError(`备注未保存：${apiMessage(error)}`)
    }
  }

  async function toggleComparison(resultId: string) {
    const next = comparisonIds.includes(resultId)
      ? comparisonIds.filter((id) => id !== resultId)
      : comparisonIds.length < 6
        ? [...comparisonIds, resultId]
        : comparisonIds
    if (next === comparisonIds) return
    const previous = comparisonIds
    setComparisonIds(next)
    if (demoMode || !activeRun) return
    try {
      await apiClient.updateBoard(activeRun.id, next)
    } catch (error) {
      setComparisonIds(previous)
      setActionError(`对比选择未保存：${apiMessage(error)}`)
    }
  }

  async function handleExport(exportMode: 'private' | 'share') {
    if (!boardId || comparisonIds.length === 0) return
    try {
      const exported = await apiClient.exportBoard(boardId, exportMode)
      setAnnouncement(`导出已生成：${exported.path}`)
      setShareSummaryOpen(false)
    } catch (error) {
      setActionError(`导出失败：${apiMessage(error)}`)
    }
  }

  async function handleStyleSave() {
    if (!boardId) return
    const lineWeights = {
      relative: { primary: 1, secondary: 0.35 },
      contrast: { primary: 1.2, secondary: 0.25 },
      uniform: { primary: 0.5, secondary: 0.5 },
    }[styleProfile.lineHierarchy]
    try {
      await apiClient.saveStyleProfile(boardId, {
        palette: [styleProfile.primaryColor],
        line_weights: lineWeights,
        texture: 'none',
        font_category: styleProfile.fontCategory,
        layout_notes: '证据栏保持在图纸侧边，并与来源链对应。',
      })
      setStyleStatus('表达规范已保存')
    } catch (error) {
      setStyleStatus('')
      setActionError(`表达规范未保存：${apiMessage(error)}`)
    }
  }

  const shareableCount = comparisonIds.filter((id) => {
    const result = results.find((item) => item.id === id)
    return result && ['user_owned', 'open_license', 'permissioned'].includes(result.rightsStatus)
  }).length
  const visibleResults = results.filter((result) =>
    assetFilter === 'all'
    || result.assetType === assetFilter
    || (assetFilter === 'analysis_diagram' && result.assetType === 'diagram'),
  )
  const activeStatus = activeRun?.status
  const isRunActive = activeStatus ? !terminalStatuses.has(activeStatus) : false
  const workspaceItems = demoMode ? demoWorkspaces : workspaces
  const currentWorkspaceId = demoMode ? (demoWorkspaces[0]?.id ?? '') : activeWorkspaceId

  return (
    <main className="research-desk" aria-label="建筑研究画板">
      <header className="app-header">
        <div className="app-brand">
          <span className="brand-mark" aria-hidden="true"><LayoutGrid /></span>
          <div><strong>ArchResearch</strong><span>{demoMode ? '演示数据' : '本地研究工具'}</span></div>
        </div>
        <div className="workspace-switcher">
          <label htmlFor="workspace-switcher">
            <span>工作区</span>
            <select
              id="workspace-switcher"
              value={currentWorkspaceId}
              disabled={demoMode}
              onChange={(event) => handleWorkspaceChange(event.target.value)}
            >
              {workspaceItems.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>
                  {'title' in workspace ? workspace.title : workspace.name}
                </option>
              ))}
            </select>
          </label>
          {!demoMode && (
            <button className="icon-text-button" type="button" onClick={() => setWorkspaceCreateOpen((current) => !current)}>
              {workspaceCreateOpen ? <X aria-hidden="true" /> : <FolderPlus aria-hidden="true" />}
              {workspaceCreateOpen ? '取消' : '新建'}
            </button>
          )}
          {workspaceCreateOpen && !demoMode && (
            <form className="workspace-create" onSubmit={(event) => void handleCreateWorkspace(event)}>
              <label htmlFor="workspace-name">工作区名称</label>
              <input
                id="workspace-name"
                value={newWorkspaceName}
                onChange={(event) => setNewWorkspaceName(event.target.value)}
                placeholder="例如：毕业设计 / 城市更新"
                autoFocus
              />
              <button type="submit" disabled={!newWorkspaceName.trim()}>创建</button>
            </form>
          )}
        </div>
        <div className="header-actions">
          {results.length > 0 && !composerOpen && (
            <button className="button-primary" type="button" onClick={() => setComposerOpen(true)}>
              <Plus aria-hidden="true" />发起新研究
            </button>
          )}
          <details className="tools-menu">
            <summary><SlidersHorizontal aria-hidden="true" /><span>工具</span></summary>
            <div>
              <button type="button" disabled={comparisonIds.length < 2} onClick={(event) => { overlayTriggerRef.current = event.currentTarget; setComparisonOpen(true) }}>
                <Columns3 aria-hidden="true" />打开对比
              </button>
              <button type="button" disabled={results.length === 0} onClick={(event) => { overlayTriggerRef.current = event.currentTarget; setStyleProfileOpen(true) }}>
                <Palette aria-hidden="true" />打开表达规范
              </button>
              <button type="button" disabled={comparisonIds.length === 0} onClick={() => void handleExport('private')}>
                <Download aria-hidden="true" />导出私有研究板
              </button>
              <button type="button" disabled={comparisonIds.length === 0} onClick={(event) => { overlayTriggerRef.current = event.currentTarget; setShareSummaryOpen(true) }}>
                <Share2 aria-hidden="true" />生成分享版
              </button>
              <button type="button" onClick={(event) => { overlayTriggerRef.current = event.currentTarget; setTraceOpen((current) => !current) }}>
                <Activity aria-hidden="true" />{traceOpen ? '关闭研究 Trace' : '打开研究 Trace'}
              </button>
            </div>
          </details>
        </div>
      </header>

      <section className="board-workspace" aria-label="图纸参考板">
        {composerOpen && (
          <section className="research-composer" aria-label="新建研究">
            <header>
              <div>
                <h1>{results.length > 0 ? '继续研究一个问题' : '你现在想解决什么设计问题？'}</h1>
                <p>描述空间、流线、更新或图纸表达问题，其余设置可以保持默认。</p>
              </div>
              {results.length > 0 && (
                <button type="button" onClick={() => setComposerOpen(false)}>收起</button>
              )}
            </header>
            <form className="research-form" onSubmit={(event) => void handleResearchSubmit(event)}>
              <div className="research-prompt">
                <Search className="research-prompt-icon" aria-hidden="true" />
                <label htmlFor="research-question">研究问题</label>
                <textarea
                  id="research-question"
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  placeholder="例如：旧建筑植入新功能时，如何拆分公共流线与后勤流线？"
                  required
                />
                <button className="research-submit" type="submit" disabled={isRunActive || loading || (!demoMode && !activeWorkspaceId)}>
                  {isRunActive ? '研究进行中…' : <><span>开始研究</span><ArrowUp aria-hidden="true" /></>}
                </button>
              </div>
              <div className="research-quick-actions">
                <button
                  type="button"
                  aria-expanded={researchOptionsOpen}
                  onClick={() => setResearchOptionsOpen((current) => !current)}
                >
                  <Paperclip aria-hidden="true" />添加资料和研究设置
                </button>
                {files.length > 0 && <span>{files.length} 个文件待上传</span>}
              </div>
              {researchOptionsOpen && (
                <div className="research-options">
                  <div className="research-field">
                    <label htmlFor="reference-url">参考网页</label>
                    <input
                      id="reference-url"
                      type="url"
                      value={referenceUrl}
                      onChange={(event) => setReferenceUrl(event.target.value)}
                      placeholder="https://"
                    />
                  </div>
                  <div className="research-field">
                    <label htmlFor="research-files">上传草图、图片或 PDF</label>
                    <input
                      id="research-files"
                      type="file"
                      accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
                      multiple
                      onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
                    />
                    {files.length > 0 && (
                      <ul className="pending-files" aria-label="待上传文件">
                        {files.map((file) => <li key={`${file.name}-${file.size}`}>{file.name}</li>)}
                      </ul>
                    )}
                  </div>
                  <fieldset className="segmented-control">
                    <legend>研究目标</legend>
                    {([
                      ['precedent_research', '设计策略'],
                      ['source_lookup', '来源反查'],
                      ['visual_reference_search', '视觉参考'],
                    ] as Array<[ResearchGoal, string]>).map(([value, label]) => (
                      <label key={value}>
                        <input type="radio" name="goal" value={value} checked={goal === value} onChange={() => setGoal(value)} />
                        {label}
                      </label>
                    ))}
                  </fieldset>
                  <fieldset className="segmented-control">
                    <legend>研究深度</legend>
                    {(Object.keys(modeLabels) as ResearchMode[]).map((value) => (
                      <label key={value}>
                        <input type="radio" name="mode" value={value} checked={mode === value} onChange={() => setMode(value)} />
                        {modeLabels[value]}
                      </label>
                    ))}
                  </fieldset>
                </div>
              )}
              <div className="research-run-actions">
                {isRunActive && <button className="research-cancel" type="button" onClick={() => void handleCancel()}>取消研究</button>}
                {activeRun && ['partial', 'blocked', 'failed', 'cancelled'].includes(activeRun.status) && (
                  <button className="research-retry" type="button" onClick={() => void handleRetry()}>重试研究</button>
                )}
              </div>
            </form>
          </section>
        )}

        {(announcement || activeRun) && (
          <section className="run-status-strip" role="status">
            <div>
              <span className="status-dot" data-active={isRunActive || undefined} aria-hidden="true" />
              <strong>{announcement || '研究已准备就绪'}</strong>
              <small>{results.length} 项参考</small>
            </div>
            <div className="run-status-actions">
              {isRunActive && <button className="research-cancel" type="button" onClick={() => void handleCancel()}>取消研究</button>}
              {activeRun && ['partial', 'blocked', 'failed', 'cancelled'].includes(activeRun.status) && (
                <button className="research-retry" type="button" onClick={() => void handleRetry()}>重试研究</button>
              )}
              <details>
                <summary>查看研究进度</summary>
                <ol className="stage-list">
                  {stageLabels.map((stage) => (
                    <li key={stage.status} aria-current={activeStatus === stage.status ? 'step' : undefined}>{stage.label}</li>
                  ))}
                </ol>
              </details>
            </div>
          </section>
        )}

        {actionError && <p className="workbench-error" role="alert">{actionError}</p>}

        {activeRun?.status === 'partial' && (
          <details className="coverage-summary">
            <summary>
              已返回部分结果 · {activeRun.coverageReport?.usable_assets ?? 0} 张图纸，{activeRun.coverageReport?.project_count ?? 0} 个项目
            </summary>
            <p>{activeRun.stopReason}</p>
            {(activeRun.coverageReport?.gaps ?? []).map((gap) => <span key={gap}>{gap}</span>)}
          </details>
        )}

        {loading && <section className="board-loading" aria-label="正在加载工作区"><p>正在读取本地工作区…</p></section>}
        {!loading && !demoMode && results.length === 0 && !actionError && (
          <section className="board-empty" aria-label="尚无研究结果">
            <h2>从一个具体设计问题开始</h2>
            <p>描述需要解决的空间、流线、更新或图纸表达问题，研究结果会按证据等级进入这里。</p>
          </section>
        )}

        {results.length > 0 && (
          <section className="results-section" aria-label="研究结果">
            <header className="results-header">
              <div>
                <h2>参考图纸</h2>
                <p>{visibleResults.length} 项结果，按证据完整度和问题相关性排序</p>
              </div>
              <label htmlFor="asset-filter">
                <span>图纸类型</span>
                <select id="asset-filter" value={assetFilter} onChange={(event) => setAssetFilter(event.target.value as 'all' | AssetType)}>
                  <option value="all">全部类型</option>
                  {filterAssetTypes.map((assetType) => (
                    <option key={assetType} value={assetType}>{assetLabels[assetType]}</option>
                  ))}
                </select>
              </label>
            </header>
            <section className="reference-grid" aria-label="图纸参考墙">
              {visibleResults.map((result, index) => (
                <article
                  className="reference-card"
                  data-selected={inspectorOpen && selectedResultId === result.id || undefined}
                  data-saved={savedIds.includes(result.id) || undefined}
                  data-rejected={rejectedIds.includes(result.id) || undefined}
                  key={result.id}
                >
                  <button
                    className="reference-main"
                    type="button"
                    aria-label={`查看 ${result.project} 证据`}
                    onClick={(event) => {
                      overlayTriggerRef.current = event.currentTarget
                      setSelectedResultId(result.id)
                      setInspectorOpen(true)
                    }}
                  >
                    <figure className="drawing-preview" data-drawing={result.drawing}>
                      {result.previewUrl ? (
                        <img
                          src={result.previewUrl}
                          alt={`${result.project} ${assetLabels[result.assetType]}`}
                          loading={index < 8 ? 'eager' : 'lazy'}
                          decoding="async"
                          fetchPriority={index < 4 ? 'high' : 'auto'}
                        />
                      ) : (
                        <div className="preview-unavailable" role="img" aria-label={`${result.project} 暂无预览`}>预览不可用</div>
                      )}
                      <figcaption>
                        <span>{assetLabels[result.assetType]}</span>
                        <span data-tier={result.tier}>
                          {result.tier === 'verified' && <ShieldCheck aria-hidden="true" />}
                          {result.tier === 'partial' && <CircleDashed aria-hidden="true" />}
                          {result.tier === 'visual_lead' && <Eye aria-hidden="true" />}
                          {tierLabels[result.tier]}
                        </span>
                      </figcaption>
                    </figure>
                    <div className="reference-copy">
                      <p className="reference-project">{result.project}</p>
                      <h3>{result.title}</h3>
                      <p>{result.observation}</p>
                    </div>
                  </button>
                  <footer className="reference-actions">
                    <span>{rejectedIds.includes(result.id) ? '已拒绝 · ' : ''}相关度 {result.relevance} / 4</span>
                    <button
                      type="button"
                      aria-pressed={comparisonIds.includes(result.id)}
                      aria-label={`${comparisonIds.includes(result.id) ? '移出对比' : '加入对比'} ${result.project}`}
                      title={comparisonIds.includes(result.id) ? '移出对比' : '加入对比'}
                      disabled={comparisonIds.length >= 6 && !comparisonIds.includes(result.id)}
                      onClick={() => void toggleComparison(result.id)}
                    >
                      {comparisonIds.includes(result.id) ? <Check aria-hidden="true" /> : <Plus aria-hidden="true" />}
                      <span className="visually-hidden">{comparisonIds.includes(result.id) ? '移出对比' : '加入对比'}</span>
                    </button>
                  </footer>
                </article>
              ))}
            </section>
          </section>
        )}

        {results.length > 0 && visibleResults.length === 0 && (
          <section className="empty-filter"><h2>当前筛选没有图纸</h2><p>切换图纸类型，或继续研究补齐这个证据缺口。</p></section>
        )}

        {comparisonIds.length > 0 && (
          <section className="comparison-dock" aria-label="对比选择">
            <p>{comparisonIds.length} / 6 项已选择</p>
            <button type="button" disabled={comparisonIds.length < 2} onClick={(event) => { overlayTriggerRef.current = event.currentTarget; setComparisonOpen(true) }}>打开 {comparisonIds.length} 项对比</button>
          </section>
        )}

        {styleProfileOpen && (
          <section className="floating-panel style-panel" role="dialog" aria-modal="true" aria-label="表达规范">
            <header className="panel-heading"><h2>表达规范</h2><button type="button" autoFocus onClick={closeOverlays}>关闭表达规范</button></header>
            <label htmlFor="style-primary-color">主色</label>
            <input id="style-primary-color" type="color" value={styleProfile.primaryColor} onChange={(event) => setStyleProfile((current) => ({ ...current, primaryColor: event.target.value }))} />
            <label htmlFor="style-line-hierarchy">线型层级</label>
            <select id="style-line-hierarchy" value={styleProfile.lineHierarchy} onChange={(event) => setStyleProfile((current) => ({ ...current, lineHierarchy: event.target.value as StyleDraft['lineHierarchy'] }))}>
              <option value="relative">相对层级</option><option value="contrast">强对比层级</option><option value="uniform">均一层级</option>
            </select>
            <label htmlFor="style-font-category">字体类别</label>
            <select id="style-font-category" value={styleProfile.fontCategory} onChange={(event) => setStyleProfile((current) => ({ ...current, fontCategory: event.target.value as StyleDraft['fontCategory'] }))}>
              <option value="sans">无衬线</option><option value="serif">衬线</option><option value="mono">等宽</option>
            </select>
            <button type="button" onClick={() => void handleStyleSave()}>保存表达规范</button>
            {styleStatus && <p role="status">{styleStatus}</p>}
          </section>
        )}

        {comparisonOpen && (
          <section className="floating-panel comparison-panel" role="dialog" aria-modal="true" aria-label="对比视图">
            <header className="panel-heading"><h2>图纸对比</h2><button type="button" autoFocus onClick={closeOverlays}>关闭对比</button></header>
            <div className="comparison-grid">
              {comparisonIds.map((resultId) => {
                const result = results.find((item) => item.id === resultId)
                if (!result) return null
                return <section className="comparison-item" key={result.id}><h3>{result.project}</h3><p>{assetLabels[result.assetType]}</p><p>{result.observation}</p><p>{result.inference}</p></section>
              })}
            </div>
          </section>
        )}

        {shareSummaryOpen && (
          <section className="floating-panel share-panel" role="dialog" aria-modal="true" aria-label="分享版导出摘要">
            <h2>分享版权利检查</h2>
            <p>{shareableCount} 张图片可嵌入</p>
            <p>{comparisonIds.length - shareableCount} 项将改为来源卡</p>
            <p>来源卡保留项目、发布者、署名和原始链接，不复制受限图片。</p>
            <button type="button" onClick={() => void handleExport('share')}>确认生成分享版</button>
            <button type="button" autoFocus onClick={closeOverlays}>返回画板</button>
          </section>
        )}
      </section>

      {inspectorOpen && selectedResult && (
        <>
          <button className="drawer-backdrop" type="button" tabIndex={-1} aria-hidden="true" onClick={closeOverlays} />
          <aside className="source-inspector" role="dialog" aria-modal="true" aria-label="来源检视器">
            <header className="inspector-heading">
              <div><span>来源与证据</span><h2>{assetLabels[selectedResult.assetType]}</h2></div>
              <button type="button" autoFocus onClick={closeOverlays}>关闭</button>
            </header>
            <div className="inspector-content">
              <strong className="inspector-project">{selectedResult.project}</strong>
              <p className="inspector-location">{selectedResult.location} · {selectedResult.year}</p>
              <section className="inspector-highlight">
                <h3>为什么值得看</h3>
                <p>{selectedResult.inference}</p>
              </section>
              <section className="inspector-observation">
                <h3>图中直接可见</h3>
                <p>{selectedResult.observation}</p>
              </section>
              <details className="inspector-details" open>
                <summary>来源与核验</summary>
                <dl className="evidence-matrix">
                  <div><dt>发布来源</dt><dd>{selectedResult.publicationTier}</dd></div>
                  <div><dt>项目身份</dt><dd>{selectedResult.projectIdentity}</dd></div>
                  <div><dt>图纸归属</dt><dd>{selectedResult.assetAssociation}</dd></div>
                  <div><dt>权利状态</dt><dd>{selectedResult.rightsStatus}</dd></div>
                </dl>
                <section className="claim-block"><h3>来源支持的事实</h3><p>{selectedResult.fact}</p></section>
                {selectedResult.evidenceClaims.map((claim) => (
                  <section className="evidence-locator" key={claim.id}>
                    <h3>{claim.claim_type === 'fact' ? '事实证据定位' : '补充证据定位'}</h3>
                    <p>{claim.statement}</p>
                    {claim.pdf_page && <p>PDF 第 {claim.pdf_page} 页</p>}
                    {claim.text_excerpt && <blockquote>{claim.text_excerpt}</blockquote>}
                    {claim.source_url && <a href={claim.source_url} target="_blank" rel="noreferrer">打开证据定位</a>}
                  </section>
                ))}
                <a className="source-link" href={selectedResult.sourceUrl} target="_blank" rel="noreferrer">打开原始来源</a>
              </details>
              <details className="inspector-details">
                <summary>适用边界</summary>
                <p>{selectedResult.limitation}</p>
              </details>
              <div className="inspector-actions">
                <button type="button" aria-pressed={savedIds.includes(selectedResult.id)} onClick={() => void toggleSaved(selectedResult.id)}>{savedIds.includes(selectedResult.id) ? '取消收藏' : '收藏参考'}</button>
                <button type="button" aria-pressed={rejectedIds.includes(selectedResult.id)} onClick={() => void toggleRejected(selectedResult.id)}>{rejectedIds.includes(selectedResult.id) ? '撤销拒绝' : '拒绝参考'}</button>
              </div>
              <label htmlFor={`note-${selectedResult.id}`}>研究备注</label>
              <textarea
                id={`note-${selectedResult.id}`}
                value={notes[selectedResult.id] ?? ''}
                onChange={(event) => setNotes((current) => ({ ...current, [selectedResult.id]: event.target.value }))}
                onBlur={(event) => void saveNote(selectedResult.id, event.target.value)}
                placeholder="记录为何有用、还要核验什么。"
              />
            </div>
          </aside>
        </>
      )}

      {traceOpen && (
        <>
          <button className="drawer-backdrop" type="button" tabIndex={-1} aria-hidden="true" onClick={closeOverlays} />
          <section className="trace-panel" role="dialog" aria-modal="true" aria-label="研究 Trace">
            <header><div><span>运行记录</span><h3>研究 Trace</h3></div><button type="button" autoFocus onClick={closeOverlays}>关闭</button></header>
            <ol className="trace-list">
              {(demoMode ? traceItems : traceEvents).map((item) => (
                <li key={item.id}>
                  <strong>{item.tool}</strong><span>{item.stage}</span>
                  <p>{'duration' in item ? item.summary : traceSummary(item.summary)}</p>
                  <small>{'duration' in item ? `${item.duration} · ${item.cost}` : `${item.duration_ms} ms · $${item.cost_usd.toFixed(4)}`}</small>
                </li>
              ))}
            </ol>
          </section>
        </>
      )}
    </main>
  )
}
