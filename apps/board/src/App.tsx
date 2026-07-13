import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity,
  ArrowRight,
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
  type ResearchSubquestion,
  type RunStatus,
  type TraceEvent,
  type Workspace,
} from './api/client'
import {
  demoSubquestions,
  evidenceResults,
  traceItems,
  workspaces as demoWorkspaces,
  type AssetType,
  type EvidenceResult,
  type ResultTier,
} from './data/mock'
import { ClickSpark } from './components/ClickSpark'
import { StudioBackdrop } from './components/StudioBackdrop'

type WorkResult = EvidenceResult & {
  evidenceClaims: ApiEvidenceClaim[]
  previewUrl: string | null
  subquestionAnalysis: Record<string, ResultAnalysis>
}

type ResultAnalysis = {
  projectContext: string
  designMechanism: string
  transferStrategy: string[]
  observations: string[]
  limitations: string[]
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

const goalLabels: Record<ResearchGoal, string> = {
  precedent_research: '设计策略',
  source_lookup: '来源反查',
  visual_reference_search: '视觉参考',
}

const goalPlaceholders: Record<ResearchGoal, string> = {
  precedent_research: '例如：旧建筑植入新功能时，如何拆分公共流线与后勤流线？',
  source_lookup: '上传截图或粘贴网页链接，说明你想确认的项目或原始出处。',
  visual_reference_search: '例如：寻找浅色轴测图、蓝灰配色和留白版式的相似表达。',
}

const problemStarters: Array<{
  label: string
  prompt: string
  goal: ResearchGoal
}> = [
  {
    label: '旧建更新',
    prompt: '原有结构不动，怎样植入新的公共功能？',
    goal: 'precedent_research',
  },
  {
    label: '流线组织',
    prompt: '人车在入口冲突，如何重组落客和步行路径？',
    goal: 'precedent_research',
  },
  {
    label: '剖面空间',
    prompt: '层高固定，怎样建立连续的空间层次？',
    goal: 'precedent_research',
  },
  {
    label: '图纸表达',
    prompt: '如何统一整套图纸的线型、配色和版式？',
    goal: 'visual_reference_search',
  },
]

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

const comparisonFocusLabels: Record<AssetType, string> = {
  plan: '平面组织与功能关系',
  section: '剖面层次与竖向联系',
  elevation: '立面节奏与新旧界面',
  site_plan: '场地关系与总体组织',
  axonometric: '构成层次与空间关系',
  circulation: '公共、后勤与人车流线',
  analysis_diagram: '设计逻辑与策略表达',
  render: '空间氛围与材料感受',
  photograph: '建成状态与使用方式',
  diagram: '设计逻辑与策略表达',
}

const demoResearchQuestion = '旧建筑更新中，如何植入新功能，并组织公共与后勤流线和剖面层次？'

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

function formatRunDate(value?: string) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric' }).format(date)
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
    subquestionIds: candidate.subquestion_ids ?? [],
    subquestionAnalysis: Object.fromEntries(
      Object.entries(candidate.subquestion_analysis ?? {}).map(([id, analysis]) => [
        id,
        {
          projectContext: analysis.project_context ?? '',
          designMechanism: analysis.design_mechanism ?? '',
          transferStrategy: analysis.transfer_strategy ?? [],
          observations: analysis.observations ?? [],
          limitations: analysis.limitations ?? [],
        },
      ]),
    ),
    projectContext:
      candidate.project_context
      || candidate.facts.join(' ')
      || '当前来源尚未提供足够的项目条件。',
    designMechanism:
      candidate.design_mechanism
      || candidate.observations.join(' ')
      || '当前图纸尚未形成稳定的空间机制判断。',
    transferStrategy:
      candidate.transfer_strategy?.length
        ? candidate.transfer_strategy
        : candidate.inferences.length
          ? candidate.inferences
          : ['回到原始来源，补齐条件后再判断怎样转译。'],
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
    subquestionAnalysis: {},
  }))
}

function fallbackSubquestions(results: WorkResult[], question: string): ResearchSubquestion[] {
  const labels: Record<string, { question: string; rationale: string }> = {
    program: {
      question: '新增功能怎样进入现有空间与结构？',
      rationale: '核对保留边界、植入方式和新旧系统之间的关系。',
    },
    circulation: {
      question: '公共、后勤或人车流线怎样减少冲突？',
      rationale: '追踪每套路径的连续段，并定位不可避免的交叉节点。',
    },
    section: {
      question: '剖面怎样建立连续的空间层次？',
      rationale: '同时比较平台、竖核、采光和视线，而不是只看楼板高差。',
    },
    expression: {
      question: '怎样把设计关系表达得更清楚？',
      rationale: '检查图纸中的线型、图层和图形角色能否相互对应。',
    },
  }
  const ids = [...new Set(results.flatMap((result) => result.subquestionIds))]
  if (ids.length === 0) {
    return [{ id: 'general', question, rationale: '先从当前证据中识别可迁移的方法和适用边界。' }]
  }
  return ids.map((id) => ({
    id,
    question: labels[id]?.question ?? question,
    rationale: labels[id]?.rationale ?? '该分支来自已保存的研究结果，下面的项目图纸用于支撑判断。',
  }))
}

function supportsSubquestion(
  result: WorkResult,
  subquestionId: string,
  subquestions: ResearchSubquestion[],
) {
  const knownAssociations = result.subquestionIds.filter((id) =>
    subquestions.some((item) => item.id === id),
  )
  return knownAssociations.length > 0
    ? knownAssociations.includes(subquestionId)
    : subquestionId === subquestions[0]?.id
}

function analysisFor(result: WorkResult, subquestionId: string) {
  const scoped = result.subquestionAnalysis[subquestionId]
  return {
    projectContext: scoped?.projectContext.trim() || result.projectContext,
    designMechanism: scoped?.designMechanism.trim() || result.designMechanism,
    transferStrategy: scoped?.transferStrategy.length ? scoped.transferStrategy : result.transferStrategy,
    observation: scoped?.observations.find((item) => item.trim()) || result.observation,
    limitation: scoped?.limitations.find((item) => item.trim()) || result.limitation,
  }
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
  const [selectedSubquestionId, setSelectedSubquestionId] = useState(
    demoMode ? (demoSubquestions[0]?.id ?? '') : '',
  )
  const [question, setQuestion] = useState('')
  const [referenceUrl, setReferenceUrl] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [goal, setGoal] = useState<ResearchGoal>('precedent_research')
  const [mode, setMode] = useState<ResearchMode>('balanced')
  const [activeRun, setActiveRun] = useState<ResearchRun | null>(null)
  const [recentRuns, setRecentRuns] = useState<ResearchRun[]>([])
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
  const questionInputRef = useRef<HTMLTextAreaElement | null>(null)
  const hydrateRequestRef = useRef(0)

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
    hydrateRequestRef.current += 1
    setPollingRunId('')
    setActiveRun(null)
    setRecentRuns([])
    setAnnouncement('')
    setResults([])
    setSelectedResultId('')
    setSelectedSubquestionId('')
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

  const updateRecentRun = useCallback((nextRun: ResearchRun) => {
    setRecentRuns((current) => [
      nextRun,
      ...current.filter((run) => run.id !== nextRun.id),
    ].slice(0, 4))
  }, [])

  const clearRunView = useCallback(() => {
    setResults([])
    setSelectedResultId('')
    setSelectedSubquestionId('')
    setBoardId('')
    setComparisonIds([])
    setSavedIds([])
    setRejectedIds([])
    setNotes({})
    setTraceEvents([])
    setStyleProfile(defaultStyle)
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
    setSelectedSubquestionId(nextResults[0]?.subquestionIds[0] ?? '')
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

  const openRun = useCallback(async (run: ResearchRun) => {
    const requestId = hydrateRequestRef.current + 1
    hydrateRequestRef.current = requestId
    setPollingRunId('')
    setActionError('')
    setActiveRun(run)
    setAnnouncement(runAnnouncement(run))
    setComposerOpen(false)
    setResearchOptionsOpen(false)
    clearRunView()
    try {
      await hydrateRun(run.id, () => hydrateRequestRef.current === requestId)
      if (
        hydrateRequestRef.current === requestId
        && !terminalStatuses.has(run.status)
      ) setPollingRunId(run.id)
    } catch (error) {
      if (hydrateRequestRef.current === requestId) setActionError(apiMessage(error))
    }
  }, [clearRunView, hydrateRun])

  useEffect(() => {
    if (demoMode || !activeWorkspaceId) return
    let active = true
    void apiClient
      .listRuns(activeWorkspaceId)
      .then(async (runs) => {
        if (!active) return
        setRecentRuns(runs.slice(0, 4))
        const latest = runs[0]
        if (!latest || terminalStatuses.has(latest.status)) return
        setActiveRun(latest)
        setAnnouncement(runAnnouncement(latest))
        setComposerOpen(false)
        await hydrateRun(latest.id, () => active)
        if (active) setPollingRunId(latest.id)
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
    const requestId = hydrateRequestRef.current
    let busy = false
    const timer = window.setInterval(() => {
      if (busy) return
      busy = true
      void apiClient
        .getRun(pollingRunId)
        .then(async (nextRun) => {
          if (hydrateRequestRef.current !== requestId) return
          setActiveRun(nextRun)
          updateRecentRun(nextRun)
          setAnnouncement(runAnnouncement(nextRun))
          if (terminalStatuses.has(nextRun.status)) {
            setPollingRunId('')
            await hydrateRun(
              nextRun.id,
              () => hydrateRequestRef.current === requestId,
            )
          }
        })
        .catch((error) => {
          if (hydrateRequestRef.current !== requestId) return
          setPollingRunId('')
          setActionError(apiMessage(error))
        })
        .finally(() => {
          busy = false
        })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [demoMode, hydrateRun, pollingRunId, updateRecentRun])

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
    const requestId = hydrateRequestRef.current + 1
    hydrateRequestRef.current = requestId
    try {
      const run = await apiClient.startResearch({
        workspaceId: activeWorkspaceId,
        question,
        referenceUrl,
        files,
        goal,
        mode,
      })
      if (hydrateRequestRef.current !== requestId) return
      updateRecentRun(run)
      clearRunView()
      if (terminalStatuses.has(run.status)) {
        setActiveRun(run)
        setAnnouncement(runAnnouncement(run))
        if (run.status !== 'cancelled') {
          await hydrateRun(
            run.id,
            () => hydrateRequestRef.current === requestId,
          )
        }
      } else {
        setActiveRun(run)
        setAnnouncement(runAnnouncement(run))
        setPollingRunId(run.id)
      }
      if (hydrateRequestRef.current !== requestId) return
      setComposerOpen(false)
      setResearchOptionsOpen(false)
    } catch (error) {
      if (hydrateRequestRef.current === requestId) setActionError(apiMessage(error))
    }
  }

  async function handleCancel() {
    if (!activeRun) return
    const requestId = hydrateRequestRef.current
    try {
      const run = await apiClient.cancelRun(activeRun.id)
      if (hydrateRequestRef.current !== requestId) return
      hydrateRequestRef.current += 1
      setPollingRunId('')
      setActiveRun(run)
      updateRecentRun(run)
      setAnnouncement(runAnnouncement(run))
    } catch (error) {
      if (hydrateRequestRef.current === requestId) setActionError(apiMessage(error))
    }
  }

  async function handleRetry() {
    if (!activeRun) return
    const requestId = hydrateRequestRef.current
    try {
      const run = await apiClient.retryRun(activeRun.id)
      if (hydrateRequestRef.current !== requestId) return
      hydrateRequestRef.current += 1
      setActiveRun(run)
      updateRecentRun(run)
      setAnnouncement(runAnnouncement(run))
      if (!terminalStatuses.has(run.status)) setPollingRunId(run.id)
    } catch (error) {
      if (hydrateRequestRef.current === requestId) setActionError(apiMessage(error))
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

  function applyProblemStarter(prompt: string, starterGoal: ResearchGoal) {
    setQuestion(prompt)
    setGoal(starterGoal)
    questionInputRef.current?.focus()
  }

  function showNewResearch() {
    hydrateRequestRef.current += 1
    setPollingRunId('')
    setActiveRun(null)
    setAnnouncement('')
    setComposerOpen(true)
    setResearchOptionsOpen(false)
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
  const researchQuestion = activeRun?.question ?? (demoMode ? demoResearchQuestion : question)
  const researchSubquestions = demoMode
    ? demoSubquestions
    : activeRun?.subquestions.length
      ? activeRun.subquestions
      : fallbackSubquestions(results, researchQuestion)
  const subquestionSummaries = researchSubquestions.map((subquestion) => {
    const assets = results.filter(
      (result) => supportsSubquestion(result, subquestion.id, researchSubquestions),
    )
    return {
      ...subquestion,
      assetCount: assets.length,
      projectCount: new Set(assets.map((result) => result.project)).size,
    }
  })
  const caseGroups = researchSubquestions.map((subquestion, index) => {
    const assets = visibleResults.filter(
      (result) => supportsSubquestion(result, subquestion.id, researchSubquestions),
    )
    const dossiers = [...assets.reduce((projects, result) => {
      const current = projects.get(result.project) ?? []
      current.push(result)
      projects.set(result.project, current)
      return projects
    }, new Map<string, WorkResult[]>()).entries()].map(([project, projectAssets]) => {
      const primary = projectAssets.find((result) => result.subquestionAnalysis[subquestion.id])
        ?? projectAssets[0]
      return {
        project,
        assets: projectAssets,
        primary,
        analysis: analysisFor(primary, subquestion.id),
      }
    })
    return { index, subquestion, assets, dossiers }
  }).filter((group) => group.assets.length > 0)
  const selectedComparisonResults = results.filter((result) => comparisonIds.includes(result.id))
  const selectedAnalysis = selectedResult
    ? analysisFor(
        selectedResult,
        selectedSubquestionId || selectedResult.subquestionIds[0] || researchSubquestions[0]?.id || 'general',
      )
    : null
  const comparisonFocuses = [...new Set(selectedComparisonResults.map((result) => comparisonFocusLabels[result.assetType]))]
  const comparisonOverview = comparisonFocuses.length === 1
    ? `这 ${selectedComparisonResults.length} 项都在回答“${comparisonFocuses[0]}”，重点比较可借鉴方法、证据状态和使用边界。`
    : `这 ${selectedComparisonResults.length} 项分别覆盖“${comparisonFocuses.join('、')}”。它们更适合组合使用，而不是选一个“赢家”。`
  const recommendedComparisonResult = selectedComparisonResults[0]
  const activeStatus = activeRun?.status
  const isRunActive = activeStatus ? !terminalStatuses.has(activeStatus) : false
  const resultViewOpen = !composerOpen
  const workspaceItems = demoMode ? demoWorkspaces : workspaces
  const currentWorkspaceId = demoMode ? (demoWorkspaces[0]?.id ?? '') : activeWorkspaceId

  return (
    <main className="research-desk" data-view={resultViewOpen ? 'results' : 'home'} aria-label="建筑研究画板">
      <StudioBackdrop view={resultViewOpen ? 'results' : 'home'} />
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
          {(recentRuns.length > 0 || (demoMode && results.length > 0)) && composerOpen && (
            <button
              className="icon-text-button"
              type="button"
              onClick={() => {
                if (demoMode) setComposerOpen(false)
                else if (recentRuns[0]) void openRun(recentRuns[0])
              }}
            >
              <LayoutGrid aria-hidden="true" />查看上次结果
            </button>
          )}
          {!composerOpen && !isRunActive && (
            <button className="button-primary" type="button" onClick={showNewResearch}>
              <Plus aria-hidden="true" />发起新研究
            </button>
          )}
          {resultViewOpen && <details className="tools-menu">
            <summary><SlidersHorizontal aria-hidden="true" /><span>工具</span></summary>
            <div>
              <button type="button" disabled={comparisonIds.length < 2} onClick={(event) => { overlayTriggerRef.current = event.currentTarget; setComparisonOpen(true) }}>
                <Columns3 aria-hidden="true" />打开方法对照
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
          </details>}
        </div>
      </header>

      <section className="board-workspace" aria-label="研究工作区">
        {composerOpen && (
          <section className="research-composer" aria-label="新建研究">
            <header>
              <div>
                <h1>从一个卡住你的地方开始</h1>
                <p>空间、流线、剖面或表达，说具体一点就够了。也可以直接附上草图、图纸、PDF 或网页。</p>
              </div>
            </header>
            <form className="research-form" onSubmit={(event) => void handleResearchSubmit(event)}>
              <div className="research-prompt">
                <Search className="research-prompt-icon" aria-hidden="true" />
                <label htmlFor="research-question">研究问题</label>
                <textarea
                  id="research-question"
                  ref={questionInputRef}
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  placeholder={goalPlaceholders[goal]}
                  required
                />
              </div>
              <div className="research-form-footer">
                <div className="research-goals" role="group" aria-label="研究方式">
                  <button type="button" aria-label="设计策略" aria-pressed={goal === 'precedent_research'} onClick={() => setGoal('precedent_research')}>
                    <LayoutGrid aria-hidden="true" /><span>设计策略</span>
                  </button>
                  <button type="button" aria-label="来源反查" aria-pressed={goal === 'source_lookup'} onClick={() => setGoal('source_lookup')}>
                    <ShieldCheck aria-hidden="true" /><span>来源反查</span>
                  </button>
                  <button type="button" aria-label="视觉参考" aria-pressed={goal === 'visual_reference_search'} onClick={() => setGoal('visual_reference_search')}>
                    <Eye aria-hidden="true" /><span>视觉参考</span>
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
                  <ClickSpark className="research-submit-spark" duration={300} sparkRadius={12} sparkSize={6}>
                    <button className="research-submit" type="submit" disabled={isRunActive || loading || (!demoMode && !activeWorkspaceId)}>
                      {isRunActive ? '研究进行中…' : <><span>开始研究</span><ArrowUp aria-hidden="true" /></>}
                    </button>
                  </ClickSpark>
                </div>
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

        {composerOpen && (
          <section className="home-sections" aria-label="研究起点与最近任务">
            <section className="home-panel starter-panel" aria-labelledby="starter-heading">
              <header>
                <div>
                  <h2 id="starter-heading">不知道怎么描述？</h2>
                  <p>从常见的建筑设计问题开始，再改成你的项目条件。</p>
                </div>
              </header>
              <ul className="starter-list">
                {problemStarters.map((starter) => (
                  <li key={starter.label}>
                    <button
                      type="button"
                      aria-label={`填入问题：${starter.label}，${starter.prompt}`}
                      onClick={() => applyProblemStarter(starter.prompt, starter.goal)}
                    >
                      <span className="starter-label">{starter.label}</span>
                      <span className="starter-prompt">{starter.prompt}</span>
                      <Plus aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>

            <section className="home-panel recent-panel" aria-labelledby="recent-heading">
              <header>
                <div>
                  <h2 id="recent-heading">最近研究</h2>
                  <p>继续当前工作区里尚未结束或已经完成的任务。</p>
                </div>
              </header>
              {recentRuns.length > 0 ? (
                <ul className="recent-list">
                  {recentRuns.slice(0, 3).map((run) => {
                    const runDate = formatRunDate(run.updatedAt ?? run.createdAt)
                    const usableAssets = run.coverageReport?.usable_assets
                    return (
                      <li key={run.id}>
                        <button type="button" aria-label={`打开研究：${run.question}`} onClick={() => void openRun(run)}>
                          <span className="recent-question">{run.question}</span>
                          <span className="recent-meta">
                            {[
                              goalLabels[run.goal] ?? '研究任务',
                              modeLabels[run.mode],
                              usableAssets === undefined ? null : `${usableAssets} 张参考`,
                              runDate || null,
                            ].filter(Boolean).join(' · ')}
                          </span>
                          <span className="recent-status">{runAnnouncement(run)}</span>
                          <ArrowRight aria-hidden="true" />
                        </button>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p className="recent-empty">{loading ? '正在读取最近任务…' : '完成第一次研究后，最近任务会保留在这里。'}</p>
              )}
            </section>
          </section>
        )}

        {resultViewOpen && (announcement || activeRun) && (
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

        {resultViewOpen && activeRun?.status === 'partial' && (
          <details className="coverage-summary">
            <summary>
              已返回部分结果 · {activeRun.coverageReport?.usable_assets ?? 0} 张图纸，{activeRun.coverageReport?.project_count ?? 0} 个项目
            </summary>
            <p>{activeRun.stopReason}</p>
            {(activeRun.coverageReport?.gaps ?? []).map((gap) => <span key={gap}>{gap}</span>)}
          </details>
        )}

        {loading && <section className="board-loading" aria-label="正在加载工作区"><p>正在读取本地工作区…</p></section>}
        {!loading && resultViewOpen && !demoMode && results.length === 0 && !actionError && (
          <section className="board-empty" aria-label="尚无研究结果">
            <h2>从一个具体设计问题开始</h2>
            <p>描述需要解决的空间、流线、更新或图纸表达问题，研究结果会按证据等级进入这里。</p>
          </section>
        )}

        {resultViewOpen && results.length > 0 && (
          <section className="results-section" aria-label="研究结果">
            <header className="result-task-heading">
              <span>{demoMode ? '演示任务' : '本次研究任务'}</span>
              <h1>{researchQuestion}</h1>
              <p>Agent 先把总问题拆成可检索的证据问题，再用具体项目的多张图纸回答。结论和来源不会混在一起。</p>
            </header>

            <section className="question-decomposition" aria-label="子问题清单">
              <h2 className="visually-hidden">研究给出的方向</h2>
              <header className="section-heading">
                <div>
                  <h2>问题拆解</h2>
                  <p>每个子问题都有自己的项目和图纸证据；先判断哪一项最接近你当前卡住的地方。</p>
                </div>
                <span>{researchSubquestions.length} 个子问题</span>
              </header>
              <ol className="subquestion-list">
                {subquestionSummaries.map((subquestion, index) => (
                  <li key={subquestion.id}>
                    <span className="subquestion-number" aria-hidden="true">{index + 1}</span>
                    <div>
                      <h3>{subquestion.question}</h3>
                      <p>{subquestion.rationale}</p>
                    </div>
                    <span className="subquestion-coverage">
                      {subquestion.projectCount} 个项目 · {subquestion.assetCount} 张图纸
                    </span>
                  </li>
                ))}
              </ol>
            </section>

            <section className="case-analysis" aria-label="案例分析">
              <header className="results-header section-heading">
                <div>
                  <h2>案例分析</h2>
                  <p>{visibleResults.length} 张图纸按子问题和项目归组。每个项目先解释空间机制，再给出可转译步骤和使用边界。</p>
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

              <div className="case-chapters">
                {caseGroups.map((group) => (
                  <section className="case-chapter" key={group.subquestion.id} aria-labelledby={`case-chapter-${group.subquestion.id}`}>
                    <header className="case-chapter-heading">
                      <span aria-hidden="true">{group.index + 1}</span>
                      <div>
                        <h3 id={`case-chapter-${group.subquestion.id}`}>{group.subquestion.question}</h3>
                        <p>{group.dossiers.length} 个项目 · {group.assets.length} 张支撑图纸</p>
                      </div>
                    </header>

                    <div className="dossier-list">
                      {group.dossiers.map((dossier) => (
                        <article className="project-dossier" aria-label={`案例分析 ${dossier.project}`} key={dossier.project}>
                          <header className="dossier-heading">
                            <div>
                              <span>项目案例</span>
                              <h4>{dossier.project}</h4>
                              <p>{dossier.primary.location} · {dossier.primary.year}</p>
                            </div>
                            <div className="dossier-verification" data-tier={dossier.primary.tier}>
                              {dossier.primary.tier === 'verified' && <ShieldCheck aria-hidden="true" />}
                              {dossier.primary.tier === 'partial' && <CircleDashed aria-hidden="true" />}
                              {dossier.primary.tier === 'visual_lead' && <Eye aria-hidden="true" />}
                              <span>{tierLabels[dossier.primary.tier]}</span>
                            </div>
                          </header>

                          <div className="dossier-analysis-grid">
                            <section>
                              <h5>项目条件</h5>
                              <p>{dossier.analysis.projectContext}</p>
                            </section>
                            <section>
                              <h5>空间机制</h5>
                              <p>{dossier.analysis.designMechanism}</p>
                            </section>
                            <section>
                              <h5>怎么转译</h5>
                              <ol>
                                {dossier.analysis.transferStrategy.map((step) => <li key={step}>{step}</li>)}
                              </ol>
                            </section>
                            <section>
                              <h5>适用边界</h5>
                              <p>{dossier.analysis.limitation}</p>
                            </section>
                          </div>

                          <section className="dossier-evidence-set" aria-label={`${dossier.project} 图纸证据`}>
                            <header>
                              <h5>支撑图纸</h5>
                              <span>{dossier.assets.length} 张 · 点击图纸查看来源和证据定位</span>
                            </header>
                            <div className="dossier-gallery">
                              {dossier.assets.map((result) => {
                                const resultIndex = results.findIndex((item) => item.id === result.id)
                                const compared = comparisonIds.includes(result.id)
                                const resultAnalysis = analysisFor(result, group.subquestion.id)
                                return (
                                  <div
                                    className="evidence-sheet"
                                    data-selected={
                                      inspectorOpen
                                      && selectedResultId === result.id
                                      && selectedSubquestionId === group.subquestion.id
                                      || undefined
                                    }
                                    data-saved={savedIds.includes(result.id) || undefined}
                                    data-rejected={rejectedIds.includes(result.id) || undefined}
                                    key={result.id}
                                  >
                                    <button
                                      className="evidence-sheet-main"
                                      type="button"
                                      aria-label={`查看 ${result.project} ${assetLabels[result.assetType]}证据`}
                                      onClick={(event) => {
                                        overlayTriggerRef.current = event.currentTarget
                                        setSelectedResultId(result.id)
                                        setSelectedSubquestionId(group.subquestion.id)
                                        setInspectorOpen(true)
                                      }}
                                    >
                                      <figure>
                                        <div className="evidence-image" data-drawing={result.drawing}>
                                          {result.previewUrl ? (
                                            <img
                                              src={result.previewUrl}
                                              alt={`${result.project} ${assetLabels[result.assetType]}`}
                                              loading={resultIndex < 6 ? 'eager' : 'lazy'}
                                              decoding="async"
                                              fetchPriority={resultIndex < 3 ? 'high' : 'auto'}
                                            />
                                          ) : (
                                            <div className="preview-unavailable" role="img" aria-label={`${result.project} 暂无预览`}>预览不可用</div>
                                          )}
                                          <span>{assetLabels[result.assetType]}</span>
                                        </div>
                                        <figcaption>
                                          <strong>{result.title}</strong>
                                          <p>{resultAnalysis.observation}</p>
                                        </figcaption>
                                      </figure>
                                    </button>
                                    <footer className="evidence-sheet-actions">
                                      <span>问题匹配 {result.relevance} / 4</span>
                                      <button
                                        type="button"
                                        aria-pressed={compared}
                                        aria-label={`${compared ? '移出方法对照' : '加入方法对照'} ${result.project} ${assetLabels[result.assetType]}`}
                                        title={compared ? '移出方法对照' : '加入方法对照'}
                                        disabled={comparisonIds.length >= 6 && !compared}
                                        onClick={() => void toggleComparison(result.id)}
                                      >
                                        {compared ? <Check aria-hidden="true" /> : <Plus aria-hidden="true" />}
                                        <span>{compared ? '已加入对照' : '加入对照'}</span>
                                      </button>
                                    </footer>
                                  </div>
                                )
                              })}
                            </div>
                          </section>

                          <footer className="dossier-source">
                            <span>来源与权利分开记录</span>
                            <p>{dossier.primary.sourceName} · {dossier.primary.publicationTier} · 权利 {dossier.primary.rightsStatus}</p>
                            <a href={dossier.primary.sourceUrl} target="_blank" rel="noreferrer">打开项目来源</a>
                          </footer>
                        </article>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </section>
          </section>
        )}

        {resultViewOpen && results.length > 0 && visibleResults.length === 0 && (
          <section className="empty-filter"><h2>当前筛选没有图纸</h2><p>切换图纸类型，或继续研究补齐这个证据缺口。</p></section>
        )}

        {resultViewOpen && comparisonIds.length > 0 && (
          <section className="comparison-dock" aria-label="方法对照选择">
            <p>已选 {comparisonIds.length} 个参考</p>
            <button type="button" disabled={comparisonIds.length < 2} onClick={(event) => { overlayTriggerRef.current = event.currentTarget; setComparisonOpen(true) }}>对照方法与边界</button>
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
          <section className="floating-panel comparison-panel" role="dialog" aria-modal="true" aria-label="方法对照">
            <header className="panel-heading">
              <div><h2>方法对照</h2><p>比较这些参考怎样回答你的设计问题</p></div>
              <button type="button" autoFocus onClick={closeOverlays}>关闭方法对照</button>
            </header>
            <section className="comparison-guide" aria-labelledby="comparison-guide-title">
              <div>
                <span>阅读提示</span>
                <h3 id="comparison-guide-title">这组对照怎么看</h3>
                <p>{comparisonOverview}</p>
              </div>
              {recommendedComparisonResult && (
                <div>
                  <span>建议先带回方案</span>
                  <h3>{recommendedComparisonResult.title}</h3>
                  <p>先用它处理{comparisonFocusLabels[recommendedComparisonResult.assetType]}，再用其他参考校核相邻层级和使用边界。</p>
                </div>
              )}
            </section>
            <p className="comparison-scroll-hint">横向滑动查看各项参考 →</p>
            <div className="comparison-table-wrap">
              <table className="comparison-table" aria-label="方法对照表">
                <thead>
                  <tr>
                    <th scope="col">对照维度</th>
                    {selectedComparisonResults.map((result) => (
                      <th scope="col" key={result.id}>
                        <div className="comparison-thumb">
                          {result.previewUrl
                            ? <img src={result.previewUrl} alt="" />
                            : <span>预览不可用</span>}
                        </div>
                        <span className="comparison-column-meta">{assetLabels[result.assetType]} · {tierLabels[result.tier]}</span>
                        <strong>{result.title}</strong>
                        <small>{result.project} · 问题匹配 {result.relevance} / 4</small>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr><th scope="row">解决什么</th>{selectedComparisonResults.map((result) => <td key={result.id}>{comparisonFocusLabels[result.assetType]}</td>)}</tr>
                  <tr><th scope="row">可借鉴方法</th>{selectedComparisonResults.map((result) => <td key={result.id}>{result.inference}</td>)}</tr>
                  <tr><th scope="row">图中看到</th>{selectedComparisonResults.map((result) => <td key={result.id}>{result.observation}</td>)}</tr>
                  <tr><th scope="row">证据状态</th>{selectedComparisonResults.map((result) => <td key={result.id}>{tierLabels[result.tier]} · {result.sourceName}</td>)}</tr>
                  <tr><th scope="row">使用边界</th>{selectedComparisonResults.map((result) => <td key={result.id}>{result.limitation}</td>)}</tr>
                </tbody>
              </table>
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

      {inspectorOpen && selectedResult && selectedAnalysis && (
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
              <section className="inspector-project-context">
                <h3>项目条件</h3>
                <p>{selectedAnalysis.projectContext}</p>
              </section>
              <section className="inspector-mechanism">
                <h3>空间机制</h3>
                <p>{selectedAnalysis.designMechanism}</p>
              </section>
              <section className="inspector-highlight">
                <h3>怎么转译</h3>
                <ol>{selectedAnalysis.transferStrategy.map((step) => <li key={step}>{step}</li>)}</ol>
              </section>
              <section className="inspector-observation">
                <h3>图中直接可见</h3>
                <p>{selectedAnalysis.observation}</p>
              </section>
              <section className="inspector-inference">
                <h3>设计方法推断</h3>
                <p>{selectedResult.inference}</p>
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
                <p>{selectedAnalysis.limitation}</p>
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
