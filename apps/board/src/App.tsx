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
  ExternalLink,
  FolderPlus,
  ImageOff,
  LayoutGrid,
  MonitorUp,
  Palette,
  Paperclip,
  Plus,
  RefreshCw,
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
  type BoardExport,
  type ResearchGoal,
  type ResearchMode,
  type ResearchRun,
  type ResearchSource,
  type ResearchSubquestion,
  type RunStatus,
  type TraceEvent,
  type Workspace,
} from './api/client'
import {
  BrowserBridgeError,
  requestBrowserBridge,
  type BrowserBridgeStatus,
} from './browserBridge'
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
  previewSource: 'public' | 'chrome' | null
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

const publicationTierLabels: Record<ApiAssetCandidate['publication_tier'], string> = {
  primary: '项目或设计方首发',
  trusted_secondary: '可信二手来源',
  aggregator: '聚合来源',
  unknown: '来源未知',
}

const associationLabels: Record<ApiAssetCandidate['project_identity'], string> = {
  confirmed: '已确认',
  probable: '较可能',
  unknown: '未知',
  conflict: '存在冲突',
}

const rightsStatusLabels: Record<ApiAssetCandidate['rights_status'], string> = {
  user_owned: '用户自有',
  open_license: '开放许可',
  permissioned: '已获授权',
  unknown: '权利未知',
  restricted: '受限',
}

const chineseCharacterPattern = /[\u3400-\u9fff]/

function chineseText(value: string | undefined, fallback: string) {
  const trimmed = value?.trim() ?? ''
  return chineseCharacterPattern.test(trimmed) ? trimmed : fallback
}

function chineseItems(values: string[] | undefined) {
  return (values ?? []).map((item) => item.trim()).filter((item) => chineseCharacterPattern.test(item))
}

const modeLabels: Record<ResearchMode, string> = {
  quick: '概览',
  balanced: '标准',
  deep: '深入',
}

const researchDepthOptions: Record<ResearchMode, { coverage: string; target: string }> = {
  quick: {
    coverage: '3 个子问题 · 每题 2 轮',
    target: '目标：每题 2 张证据图 · 观察与方法',
  },
  balanced: {
    coverage: '4 个子问题 · 每题 3 轮',
    target: '目标：每题 3 张证据图 · 方法、转译与边界',
  },
  deep: {
    coverage: '6 个子问题 · 每题 4 轮',
    target: '目标：每题 3 张证据图 · 多来源核验与跨案例比较',
  },
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

const deepDemoSubquestions = [
  ...demoSubquestions,
  {
    id: 'structure',
    question: '新增构件怎样与旧结构脱开，并保留未来调整的可能？',
    rationale: '比较独立基础、轻型连接和可逆节点，核对空间策略是否真的能落到构造关系。',
  },
  {
    id: 'environment',
    question: '采光、通风与旧建筑围护怎样共同支持新的公共空间？',
    rationale: '把剖面中的光、热和空气路径与空间层次一起研究，避免只讨论形式高差。',
  },
]

function demoDepthFromSearch(search: string): ResearchMode | null {
  const value = new URLSearchParams(search).get('demo')
  if (value === '1') return 'balanced'
  return value === 'quick' || value === 'balanced' || value === 'deep' ? value : null
}

function demoSubquestionsFor(depth: ResearchMode) {
  if (depth === 'quick') return demoSubquestions.slice(0, 3)
  if (depth === 'deep') return deepDemoSubquestions
  return demoSubquestions
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

const activeStageDescriptions: Partial<Record<RunStatus, string>> = {
  created: '任务已经进入队列，正在准备研究计划',
  planning: '正在拆解问题并生成可检索的证据方向',
  searching: '正在从公开网页中寻找项目与图纸',
  inspecting: '正在读取候选项目页面并定位图纸',
  analyzing: '正在区分平面、剖面、分析图与效果图',
  verifying: '正在核对图片、项目与发布来源的关系',
  gap_check: '正在检查案例、图纸类型和证据缺口',
  composing: '正在去重、排序并编排图纸参考板',
}

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
    blocked: '研究尚未完成，已有证据已保留',
    cancelled: '已取消',
    failed: '研究失败，已有结果已保留',
  }
  return labels[run.status]
}

function needsCompletionContinuation(run: ResearchRun) {
  return run.goal === 'precedent_research'
    && (run.coverageReport?.gaps ?? []).includes('uncovered_subquestions')
}

function retryActionLabel(run: ResearchRun) {
  return needsCompletionContinuation(run) ? '继续补齐研究' : '重试研究'
}

function partialReasonTitle(stopReason?: string | null) {
  if (stopReason === 'budget_exhausted') return '本轮检索额度已用完'
  if (stopReason === 'time_budget_exhausted') return '本轮研究达到时间上限'
  if (stopReason === 'no_new_assets') return '连续检索没有找到新的有效图纸'
  if (stopReason === 'unverified_visual_leads') return '已找到图纸，但来源证据还不够'
  if (stopReason === 'browser_inspection_incomplete') return 'Chrome 图纸检查未完成'
  if (stopReason === 'no_usable_assets') return '暂未找到能直接使用的图纸'
  if (stopReason?.startsWith('provider_error:')) return '部分网页研究服务暂时不可用'
  if (stopReason?.startsWith('source_lookup_error:')) return '图片来源反查暂时未完成'
  return '本次研究先交付当前可用结果'
}

function partialDiagnosis(run: ResearchRun) {
  const coverage = run.coverageReport
  const usable = coverage?.usable_assets ?? 0
  const projects = coverage?.project_count ?? 0
  const supported = coverage?.verified_or_partial ?? 0
  const gapLabels: Record<string, string> = {
    insufficient_usable_assets: `可用图纸数量未达到“${modeLabels[run.mode]}”深度目标`,
    fewer_than_six_usable_assets: `可用图纸数量未达到“${modeLabels[run.mode]}”深度目标`,
    insufficient_project_diversity: '具体项目数量还不足，案例覆盖不够多样',
    insufficient_verified_or_partial: '达到部分核验或以上的图纸还不够',
    uncovered_subquestions: '仍有子问题没有足够图纸支撑',
    browser_inspection_incomplete: 'Chrome 未能完成候选页面的图纸检查，现有网页结果已保留',
    insufficient_multi_asset_projects: '部分项目还缺少平面、剖面等互补图纸',
  }
  const gaps = [...new Set((coverage?.gaps ?? []).map(
    (gap) => gapLabels[gap] ?? '仍有研究覆盖项未达到当前深度目标',
  ))]
  const continuationRequired = needsCompletionContinuation(run)
  return {
    title: continuationRequired ? '仍有子问题等待补齐' : partialReasonTitle(run.stopReason),
    summary: `已保留 ${usable} 张可用图纸，覆盖 ${projects} 个项目，其中 ${supported} 张达到部分核验或以上。`,
    gaps,
    nextStep: continuationRequired
      ? '当前内容是续研检查点，不是完整交付；继续补齐会保留已有证据，只研究仍为空白的分支。'
      : '可以继续查看现有结果；重试会开启新一轮研究，补找图纸与来源证据。',
  }
}

function recentRunAnnouncement(run: ResearchRun) {
  return run.status === 'partial'
    ? `部分结果 · ${partialReasonTitle(run.stopReason)}`
    : runAnnouncement(run)
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
  const facts = chineseItems(candidate.facts)
  const observations = chineseItems(candidate.observations)
  const inferences = chineseItems(candidate.inferences)
  const limitations = chineseItems(candidate.limitations)
  const transferStrategy = chineseItems(candidate.transfer_strategy)
  return {
    id: candidate.id,
    title: chineseText(candidate.inferences[0], `${assetLabels[assetType]}研究线索`),
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
    sourceName: publicationTierLabels[candidate.publication_tier],
    sourceUrl: candidate.source_url,
    imageUrl: candidate.image_url,
    subquestionIds: candidate.subquestion_ids ?? [],
    subquestionAnalysis: Object.fromEntries(
      Object.entries(candidate.subquestion_analysis ?? {}).map(([id, analysis]) => [
        id,
        {
          projectContext: chineseText(
            analysis.project_context,
            '此历史结果的项目条件为外文；重新研究后可生成中文分析。',
          ),
          designMechanism: chineseText(
            analysis.design_mechanism,
            '此历史结果的空间机制为外文；重新研究后可生成中文分析。',
          ),
          transferStrategy: chineseItems(analysis.transfer_strategy).length
            ? chineseItems(analysis.transfer_strategy)
            : ['连接扩展并重新研究，生成中文转译步骤。'],
          observations: chineseItems(analysis.observations).length
            ? chineseItems(analysis.observations)
            : ['尚未生成中文视觉观察。'],
          limitations: chineseItems(analysis.limitations).length
            ? chineseItems(analysis.limitations)
            : ['尚未生成中文适用边界。'],
        },
      ]),
    ),
    projectContext:
      chineseCharacterPattern.test(candidate.project_context ?? '')
        ? candidate.project_context ?? ''
        : facts.join(' ') || '此历史结果的项目条件为外文；重新研究后可生成中文分析。',
    designMechanism:
      chineseCharacterPattern.test(candidate.design_mechanism ?? '')
        ? candidate.design_mechanism ?? ''
        : observations.join(' ') || '此历史结果的空间机制为外文；重新研究后可生成中文分析。',
    transferStrategy:
      transferStrategy.length
        ? transferStrategy
        : inferences.length
          ? inferences
          : ['连接扩展并重新研究，生成中文转译步骤。'],
    previewUrl: candidate.has_local_content
      ? `/v1/assets/${candidate.id}/content`
      : candidate.image_url,
    previewSource: candidate.has_local_content
      ? 'chrome'
      : candidate.image_url
        ? 'public'
        : null,
    fact: facts[0] ?? '此历史结果的来源事实为外文，请打开原始页面核对。',
    observation: observations[0] ?? '尚未生成中文视觉观察。',
    inference: inferences[0] ?? '尚未生成中文设计方法推断。',
    limitation: limitations[0] ?? '尚未生成中文适用边界。',
    accent:
      candidate.result_tier === 'verified'
        ? '#2D846B'
        : candidate.result_tier === 'partial'
          ? '#315CF4'
          : '#7D817E',
    drawing: drawingFor(assetType),
    evidenceClaims: candidate.evidence_claims.map((claim) => ({
      ...claim,
      statement: chineseText(claim.statement, '该证据原文为外文，请通过来源定位核对。'),
    })),
  }
}

function demoResults(depth: ResearchMode): WorkResult[] {
  const includedSubquestions = new Set(demoSubquestionsFor(depth).map((item) => item.id))
  return evidenceResults
    .filter((result) => result.subquestionIds.some((id) => includedSubquestions.has(id)))
    .map((result) => {
      const extraAssociations = depth === 'deep'
        ? {
            'result-foundry-section': ['structure'],
            'result-foundry-axon': ['structure'],
            'result-section-daylight': ['environment'],
            'result-facade-replay': ['environment'],
          }[result.id] ?? []
        : []
      return {
        ...result,
        subquestionIds: [...result.subquestionIds, ...extraAssociations],
        previewUrl: result.imageUrl ?? null,
        previewSource: null,
        evidenceClaims: [],
        subquestionAnalysis: {},
      }
    })
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
  return knownAssociations.includes(subquestionId)
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

function availablePreviewUrl(result: WorkResult, failedPreviewUrls: Record<string, string>) {
  if (!result.previewUrl || failedPreviewUrls[result.id] === result.previewUrl) return null
  return result.previewUrl
}

function browserWasUnavailableForSource(events: TraceEvent[], sourceUrl: string) {
  return events.some((event) => {
    if (event.tool !== 'browser') return false
    const summary = event.summary as unknown
    if (typeof summary === 'string') {
      return summary.includes('BrowserUnavailableError')
        || summary.includes('Browser extension is not connected')
    }
    if (!summary || typeof summary !== 'object') return false
    const details = summary as { error_type?: unknown; source_url?: unknown }
    if (details.error_type !== 'BrowserUnavailableError') return false
    return typeof details.source_url !== 'string' || details.source_url === sourceUrl
  })
}

export default function App() {
  const demoDepth = useMemo(() => demoDepthFromSearch(window.location.search), [])
  const demoMode = demoDepth !== null
  const demoProfile = useMemo(() => (
    demoDepth === null
      ? null
      : { results: demoResults(demoDepth), subquestions: demoSubquestionsFor(demoDepth) }
  ), [demoDepth])
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [activeWorkspaceId, setActiveWorkspaceId] = useState('')
  const [newWorkspaceName, setNewWorkspaceName] = useState('')
  const [results, setResults] = useState<WorkResult[]>(demoProfile?.results ?? [])
  const [selectedResultId, setSelectedResultId] = useState(
    demoProfile?.results[0]?.id ?? '',
  )
  const [selectedSubquestionId, setSelectedSubquestionId] = useState(
    demoProfile?.subquestions[0]?.id ?? '',
  )
  const [failedPreviewUrls, setFailedPreviewUrls] = useState<Record<string, string>>({})
  const [question, setQuestion] = useState('')
  const [referenceUrl, setReferenceUrl] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [goal, setGoal] = useState<ResearchGoal>('precedent_research')
  const [mode, setMode] = useState<ResearchMode>(demoDepth ?? 'balanced')
  const [researchSources, setResearchSources] = useState<ResearchSource[]>(['xiaohongshu'])
  const [activeRun, setActiveRun] = useState<ResearchRun | null>(null)
  const [recentRuns, setRecentRuns] = useState<ResearchRun[]>([])
  const [pollingRunId, setPollingRunId] = useState('')
  const [announcement, setAnnouncement] = useState('')
  const [lastExport, setLastExport] = useState<BoardExport | null>(null)
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
  const [browserConnected, setBrowserConnected] = useState<boolean | null>(null)
  const [browserReadinessLoading, setBrowserReadinessLoading] = useState(!demoMode)
  const [browserReadinessError, setBrowserReadinessError] = useState('')
  const [preflightBridgeStatus, setPreflightBridgeStatus] = useState<BrowserBridgeStatus | null>(null)
  const [browserPairingStatus, setBrowserPairingStatus] = useState('')
  const [browserConnecting, setBrowserConnecting] = useState(false)
  const [rerunStarting, setRerunStarting] = useState(false)
  const [composerOpen, setComposerOpen] = useState(!demoMode)
  const [researchOptionsOpen, setResearchOptionsOpen] = useState(false)
  const [workspaceCreateOpen, setWorkspaceCreateOpen] = useState(false)
  const [inspectorOpen, setInspectorOpen] = useState(false)
  const overlayTriggerRef = useRef<HTMLElement | null>(null)
  const questionInputRef = useRef<HTMLTextAreaElement | null>(null)
  const hydrateRequestRef = useRef(0)
  const chromeConnectRequested = useMemo(
    () => new URLSearchParams(window.location.search).get('connect') === 'chrome',
    [],
  )
  const chromeConnectAttemptedRef = useRef(false)

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

  const markPreviewFailed = useCallback((resultId: string, previewUrl: string | null) => {
    if (!previewUrl) return
    setFailedPreviewUrls((current) => (
      current[resultId] === previewUrl
        ? current
        : { ...current, [resultId]: previewUrl }
    ))
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
    setLastExport(null)
    setResults([])
    setSelectedResultId('')
    setSelectedSubquestionId('')
    setFailedPreviewUrls({})
    setBoardId('')
    setComparisonIds([])
    setSavedIds([])
    setRejectedIds([])
    setNotes({})
    setTraceEvents([])
    setStyleProfile(defaultStyle)
    setResearchSources(['xiaohongshu'])
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
    setFailedPreviewUrls({})
    setBoardId('')
    setComparisonIds([])
    setSavedIds([])
    setRejectedIds([])
    setNotes({})
    setTraceEvents([])
    setLastExport(null)
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

  const loadBrowserReadiness = useCallback(async (shouldApply: () => boolean = () => true) => {
    if (demoMode) return
    const [apiResult, bridgeResult] = await Promise.allSettled([
      apiClient.getBrowserStatus(),
      requestBrowserBridge({ type: 'status' }),
    ])
    if (!shouldApply()) return
    if (apiResult.status === 'fulfilled') {
      setBrowserReadinessError('')
      setBrowserConnected(apiResult.value.connected)
    } else {
      setBrowserReadinessError(apiMessage(apiResult.reason))
      setBrowserConnected(null)
    }
    setPreflightBridgeStatus(
      bridgeResult.status === 'fulfilled' ? bridgeResult.value : null,
    )
    setBrowserReadinessLoading(false)
  }, [demoMode])

  const refreshBrowserReadiness = useCallback(async () => {
    if (demoMode) return
    setBrowserReadinessLoading(true)
    setBrowserReadinessError('')
    await loadBrowserReadiness()
  }, [demoMode, loadBrowserReadiness])

  useEffect(() => {
    let active = true
    const timeout = window.setTimeout(() => {
      void loadBrowserReadiness(() => active)
    }, 0)
    return () => {
      active = false
      window.clearTimeout(timeout)
    }
  }, [loadBrowserReadiness])

  const hydrateRun = useCallback(async (runId: string, shouldApply: () => boolean = () => true) => {
    const [apiResults, board, userState, events, browserStatus] = await Promise.all([
      apiClient.getResults(runId),
      apiClient.getBoard(runId),
      apiClient.getUserState(runId),
      apiClient.getEvents(runId),
      apiClient.getBrowserStatus().catch(() => null),
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
    setBrowserConnected(browserStatus?.connected ?? null)
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

  const syncProvisionalResults = useCallback(async (runId: string, shouldApply: () => boolean) => {
    try {
      const apiResults = await apiClient.getResults(runId)
      if (!shouldApply()) return
      const nextResults = apiResults.map(toWorkResult)
      setResults(nextResults)
      setSelectedResultId((current) => (
        current && nextResults.some((result) => result.id === current)
          ? current
          : nextResults[0]?.id ?? ''
      ))
      setSelectedSubquestionId((current) => (
        current && nextResults.some((result) => result.subquestionIds.includes(current))
          ? current
          : nextResults[0]?.subquestionIds[0] ?? ''
      ))
    } catch {
      // A provisional read must not stop the run-status poll; terminal hydration retries it.
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
          } else {
            await syncProvisionalResults(
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
  }, [demoMode, hydrateRun, pollingRunId, syncProvisionalResults, updateRecentRun])

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
    if (!(await ensureBrowserResearchAccess(researchSources.includes('xiaohongshu')))) return
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
        researchSources,
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
    setActionError('')
    if (!(await ensureBrowserResearchAccess(
      activeRun.researchSources?.includes('xiaohongshu') ?? false,
    ))) return
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

  async function refreshBrowserConnection() {
    setBrowserPairingStatus('正在检查连接…')
    try {
      const status = await apiClient.getBrowserStatus()
      setBrowserConnected(status.connected)
      setBrowserPairingStatus(status.connected ? '图纸提取扩展已连接' : '扩展尚未连接')
    } catch (error) {
      setBrowserConnected(null)
      setBrowserPairingStatus(apiMessage(error))
    }
  }

  const handleConnectBrowser = useCallback(async (launchChromeOnUnavailable = true) => {
    setBrowserConnecting(true)
    setBrowserPairingStatus('正在检查当前页面的 Chrome 扩展…')
    try {
      const bridgeStatus = await requestBrowserBridge({ type: 'status' })
      setPreflightBridgeStatus(bridgeStatus)
      if (bridgeStatus.connection === 'connected') {
        const status = await apiClient.getBrowserStatus()
        if (status.connected) {
          setBrowserConnected(true)
          setBrowserPairingStatus('图纸提取扩展已连接')
          return
        }
      }
      const pairing = await apiClient.createBrowserPairingCode()
      const pairedStatus = await requestBrowserBridge({
        type: 'pair',
        endpoint: 'ws://127.0.0.1:8000/v1/browser',
        token: pairing.code,
      })
      setPreflightBridgeStatus(pairedStatus)
      for (let attempt = 0; attempt < 20; attempt += 1) {
        const status = await apiClient.getBrowserStatus()
        if (status.connected) {
          setBrowserConnected(true)
          setBrowserPairingStatus('图纸提取扩展已连接')
          setAnnouncement('图纸提取扩展已连接')
          return
        }
        await new Promise((resolve) => window.setTimeout(resolve, 250))
      }
      throw new BrowserBridgeError('rejected', 'Pairing authentication timed out')
    } catch (error) {
      setBrowserConnected(false)
      setPreflightBridgeStatus(null)
      if (
        error instanceof BrowserBridgeError
        && error.code === 'unavailable'
        && launchChromeOnUnavailable
      ) {
        try {
          await apiClient.openChromeBoard()
          setBrowserPairingStatus('已在 Chrome 打开本页；新页面会自动连接扩展。当前公开网页研究不受影响。')
        } catch (launchError) {
          setBrowserPairingStatus(`无法自动打开 Chrome：${apiMessage(launchError)}`)
        }
      } else {
        setBrowserPairingStatus(
          error instanceof BrowserBridgeError && error.code === 'unavailable'
            ? '当前 Chrome 页面没有检测到 ArchResearch 扩展；公开网页研究仍可继续。'
            : '浏览器配对未完成，可能是配对码已过期。请重新连接。',
        )
      }
    } finally {
      setBrowserConnecting(false)
    }
  }, [])

  useEffect(() => {
    if (
      demoMode
      || !chromeConnectRequested
      || browserConnected !== false
      || browserConnecting
      || chromeConnectAttemptedRef.current
    ) return
    chromeConnectAttemptedRef.current = true
    const url = new URL(window.location.href)
    url.searchParams.delete('connect')
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
    void handleConnectBrowser(false)
  }, [browserConnected, browserConnecting, chromeConnectRequested, demoMode, handleConnectBrowser])

  async function ensureBrowserResearchAccess(requireConnected = false) {
    if (browserConnected !== true) {
      if (requireConnected) {
        setActionError('小红书研究需要登录页面。请先在 Chrome 登录小红书并连接 ArchResearch，再开始研究。')
        return false
      }
      return true
    }
    try {
      const status = await requestBrowserBridge({ type: 'status' })
      setPreflightBridgeStatus(status)
      if (status.researchPermission) {
        setBrowserPairingStatus('')
        return true
      }
    } catch (error) {
      if (error instanceof BrowserBridgeError && error.code === 'unavailable') {
        setBrowserConnected(false)
        setPreflightBridgeStatus(null)
        if (requireConnected) {
          setActionError('小红书研究需要登录页面。请先在 Chrome 登录小红书并连接 ArchResearch，再开始研究。')
          return false
        }
        setBrowserPairingStatus('当前页面未检测到 Chrome 扩展；本次将继续研究公开网页，并跳过登录页面与精确裁图。')
        return true
      }
      setActionError('无法向扩展确认网页读取权限。请在已安装扩展的 Chrome 中打开本页。')
      return false
    }
    setActionError('Chrome 为保护全站读取权限，需要在扩展中确认本次研究。请点击浏览器工具栏的 ArchResearch，选择“授予网页读取权限”，再回来开始研究。')
    return false
  }

  async function handleRerunWithBrowser() {
    if (!activeRun || !activeWorkspaceId || browserConnected !== true) return
    if (!(await ensureBrowserResearchAccess(
      activeRun.researchSources?.includes('xiaohongshu') ?? false,
    ))) return
    const requestId = hydrateRequestRef.current + 1
    hydrateRequestRef.current = requestId
    setRerunStarting(true)
    setActionError('')
    try {
      const run = await apiClient.startResearch({
        workspaceId: activeWorkspaceId,
        question: activeRun.question,
        goal: activeRun.goal,
        mode: activeRun.mode,
        researchSources: activeRun.researchSources,
      })
      if (hydrateRequestRef.current !== requestId) return
      updateRecentRun(run)
      clearRunView()
      setActiveRun(run)
      setAnnouncement(runAnnouncement(run))
      setComposerOpen(false)
      if (terminalStatuses.has(run.status)) {
        if (run.status !== 'cancelled') {
          await hydrateRun(run.id, () => hydrateRequestRef.current === requestId)
        }
      } else {
        setPollingRunId(run.id)
      }
    } catch (error) {
      if (hydrateRequestRef.current === requestId) setActionError(apiMessage(error))
    } finally {
      if (hydrateRequestRef.current === requestId) setRerunStarting(false)
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
    const previousComparison = comparisonIds
    const nextComparison = comparisonIds.filter((id) => id !== resultId)
    let boardSelectionUpdated = false
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
      if (nextComparison.length !== previousComparison.length && activeRun && !demoMode) {
        await apiClient.updateBoard(activeRun.id, nextComparison)
        boardSelectionUpdated = true
        setComparisonIds(nextComparison)
        setLastExport(null)
      }
      await apiClient.rejectResult(resultId, 'not_useful_for_current_problem')
      setRejectedIds((current) => [...new Set([...current, resultId])])
    } catch (error) {
      if (boardSelectionUpdated && activeRun) {
        await apiClient.updateBoard(activeRun.id, previousComparison).catch(() => undefined)
        setComparisonIds(previousComparison)
      }
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
    setLastExport(null)
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
      setLastExport(exported)
      setAnnouncement(exportMode === 'private' ? '个人研究板已生成' : '分享来源板已生成')
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
    setLastExport(null)
    setQuestion('')
    setReferenceUrl('')
    setFiles([])
    setResearchSources(['xiaohongshu'])
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
    ? (demoProfile?.subquestions ?? [])
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
      passCount: activeRun?.coverageReport?.subquestion_passes?.[subquestion.id],
    }
  })
  const unassignedResults = visibleResults.filter((result) => (
    !researchSubquestions.some((subquestion) => (
      supportsSubquestion(result, subquestion.id, researchSubquestions)
    ))
  ))
  const groupingSubquestions = [
    ...researchSubquestions,
    ...(unassignedResults.length > 0
      ? [{
          id: 'unassigned',
          question: '待归组的图纸线索',
          rationale: '这些图纸已有来源线索，但尚未确认它具体回答哪个子问题。',
        }]
      : []),
  ]
  const caseGroups = groupingSubquestions.map((subquestion, index) => {
    const unassigned = subquestion.id === 'unassigned'
    const assets = unassigned
      ? unassignedResults
      : visibleResults.filter(
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
    return { index, subquestion, assets, dossiers, unassigned }
  })
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
  const activeStageIndex = activeStatus
    ? stageLabels.findIndex((stage) => stage.status === activeStatus)
    : -1
  const resultViewOpen = !composerOpen
  const activePartialDiagnosis = activeRun && ['partial', 'blocked'].includes(activeRun.status)
    ? partialDiagnosis(activeRun)
    : null
  const allResultsMissingPreviews = results.length > 0 && results.every(
    (result) => !availablePreviewUrl(result, failedPreviewUrls),
  )
  const anyPreviewLoadFailed = results.some(
    (result) => Boolean(result.previewUrl && failedPreviewUrls[result.id] === result.previewUrl),
  )
  const runHadBrowserUnavailable = results.some((result) => (
    browserWasUnavailableForSource(traceEvents, result.sourceUrl)
  ))
  const usableResultCount = activeRun?.coverageReport?.usable_assets ?? results.filter(
    (result) => result.relevance >= 2 && result.tier !== 'visual_lead',
  ).length
  const pendingLeadCount = Math.max(0, results.length - usableResultCount)
  const resultCountLabel = pendingLeadCount > 0
    ? `${usableResultCount} 张可用 · ${pendingLeadCount} 条待核验线索`
    : `${usableResultCount} 张可用参考`
  const workspaceItems = demoMode ? demoWorkspaces : workspaces
  const currentWorkspaceId = demoMode ? (demoWorkspaces[0]?.id ?? '') : activeWorkspaceId
  const browserBridgeAvailable = preflightBridgeStatus?.connection === 'connected'
    || (preflightBridgeStatus?.paired === true && preflightBridgeStatus.connection === 'connecting')
  const browserReadinessState = browserReadinessLoading
    ? 'loading'
    : browserReadinessError
      ? 'unknown'
      : browserConnected !== true
        ? 'disconnected'
        : !preflightBridgeStatus
          ? 'surface-missing'
          : !browserBridgeAvailable
            ? 'surface-disconnected'
            : preflightBridgeStatus.researchPermission
              ? 'ready'
              : 'permission'
  const browserReadinessSummary = {
    loading: '正在检查 Chrome 连接与临时权限…',
    unknown: '暂时无法读取 Chrome 连接状态',
    disconnected: '开始默认小红书研究前需要连接 Chrome',
    'surface-missing': '本地服务已连接；请在 Chrome 打开本页',
    'surface-disconnected': '本地服务已连接；当前页面扩展尚未连通',
    permission: 'Chrome 已连接；开始研究时确认临时网页权限',
    ready: 'Chrome 已连接；本次网页读取已授权',
  }[browserReadinessState]
  const browserReadinessDetail = {
    loading: '正在读取连接状态',
    unknown: '连接状态未读取 · 请检查本地服务后重试',
    disconnected: '未连接 · 默认小红书研究暂不可用',
    'surface-missing': '服务已连接 · 当前页面未检测到扩展',
    'surface-disconnected': '服务已连接 · 当前页面扩展未连通',
    permission: '已连接 · 开始前需在 Chrome 扩展中确认临时权限',
    ready: '已连接 · 本次网页读取已授权',
  }[browserReadinessState]
  const xiaohongshuReadiness = {
    loading: '等待 Chrome 检查完成',
    unknown: '连接状态恢复后再验证登录态',
    disconnected: '连接 Chrome 后验证登录态',
    'surface-missing': '请在 Chrome 打开本页后验证登录态',
    'surface-disconnected': '请等待当前页面扩展连通后验证登录态',
    permission: '登录态待可见页面验证',
    ready: '登录态待可见页面验证',
  }[browserReadinessState]
  const showBrowserConnectAction = !browserReadinessLoading
    && (browserConnected !== true || !browserBridgeAvailable)

  return (
    <main className="research-desk" data-view={resultViewOpen ? 'results' : 'home'} aria-label="建筑研究画板">
      <StudioBackdrop view={resultViewOpen ? 'results' : 'home'} />
      <header className="app-header">
        <div className="app-brand">
          <span className="brand-mark" aria-hidden="true"><LayoutGrid /></span>
          <div><strong>ArchResearch</strong><span>{demoMode ? `演示数据 · ${modeLabels[mode]}研究` : '本地研究工具'}</span></div>
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
            <button className="result-new-research" type="button" onClick={showNewResearch}>
              <Plus aria-hidden="true" />发起新研究
            </button>
          )}
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
                  <fieldset className="research-source-options">
                    <legend>灵感来源（可选）</legend>
                    <label>
                      <input
                        type="checkbox"
                        checked={researchSources.includes('xiaohongshu')}
                        onChange={(event) => setResearchSources((current) => (
                          event.target.checked
                            ? [...current, 'xiaohongshu']
                            : current.filter((source) => source !== 'xiaohongshu')
                        ))}
                      />
                      <span>
                        <strong>小红书灵感</strong>
                        <small>图纸风格、形体与分析图；需在 Chrome 登录</small>
                      </span>
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={researchSources.includes('pinterest')}
                        onChange={(event) => setResearchSources((current) => (
                          event.target.checked
                            ? [...current, 'pinterest']
                            : current.filter((source) => source !== 'pinterest')
                        ))}
                      />
                      <span>
                        <strong>Pinterest 图像线索</strong>
                        <small>通过网页搜索保留原 Pin 链接，不直接抓取</small>
                      </span>
                    </label>
                  </fieldset>
                  <fieldset className="segmented-control research-depth-options">
                    <legend>研究深度</legend>
                    {(Object.keys(modeLabels) as ResearchMode[]).map((value) => (
                      <label key={value}>
                        <input type="radio" name="mode" value={value} checked={mode === value} onChange={() => setMode(value)} />
                        <strong>{modeLabels[value]}</strong>
                        <span>{researchDepthOptions[value].coverage}</span>
                        <small>{researchDepthOptions[value].target}</small>
                      </label>
                    ))}
                  </fieldset>
                </div>
              )}
              {!demoMode && (
                <section className="research-preflight" aria-label="运行前检查">
                  <header className="research-preflight-header">
                    <div className="research-preflight-title">
                      <ShieldCheck aria-hidden="true" />
                      <div>
                        <strong>运行前检查</strong>
                        <span aria-live="polite">{browserReadinessSummary}</span>
                      </div>
                    </div>
                    <div className="research-preflight-actions">
                      {showBrowserConnectAction && (
                        <button type="button" disabled={browserConnecting} onClick={() => void handleConnectBrowser()}>
                          <MonitorUp aria-hidden="true" />{browserConnecting ? '正在打开 Chrome…' : '在 Chrome 中启用精确提取'}
                        </button>
                      )}
                      <button type="button" disabled={browserReadinessLoading} onClick={() => void refreshBrowserReadiness()}>
                        <RefreshCw aria-hidden="true" />{browserReadinessLoading ? '检查中…' : '检查连接'}
                      </button>
                    </div>
                  </header>
                  <div className="research-preflight-list">
                    <div className="research-preflight-row" data-state={browserReadinessState}>
                      {browserReadinessState === 'ready' ? <Check aria-hidden="true" /> : <CircleDashed aria-hidden="true" />}
                      <strong>Chrome 图纸提取</strong>
                      <span>{browserReadinessDetail}</span>
                    </div>
                    <div className="research-preflight-row" data-state="pending">
                      <CircleDashed aria-hidden="true" />
                      <strong>小红书</strong>
                      <span>{xiaohongshuReadiness}</span>
                    </div>
                  </div>
                  <footer className="research-preflight-footer">
                    <span>这里只检查 Chrome 连接与临时权限，不会开始研究。</span>
                    {(browserReadinessError || browserPairingStatus) && (
                      <span aria-live="polite">
                        {browserReadinessError ? '连接状态未读取，请检查本地服务后重试。' : browserPairingStatus}
                      </span>
                    )}
                  </footer>
                </section>
              )}
              <div className="research-run-actions">
                {isRunActive && <button className="research-cancel" type="button" onClick={() => void handleCancel()}>取消研究</button>}
                {activeRun && ['partial', 'blocked', 'failed', 'cancelled'].includes(activeRun.status) && (
                  <button className="research-retry" type="button" onClick={() => void handleRetry()}>{retryActionLabel(activeRun)}</button>
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
                          <span className="recent-status">{recentRunAnnouncement(run)}</span>
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
              <small>{resultCountLabel}</small>
            </div>
            <div className="run-status-actions">
              {isRunActive && <button className="research-cancel" type="button" onClick={() => void handleCancel()}>取消研究</button>}
              {activeRun && ['partial', 'blocked', 'failed', 'cancelled'].includes(activeRun.status) && (
                <button className="research-retry" type="button" onClick={() => void handleRetry()}>{retryActionLabel(activeRun)}</button>
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

        {resultViewOpen && activePartialDiagnosis && (
          <section className="coverage-summary" aria-labelledby="coverage-summary-title">
            <CircleDashed aria-hidden="true" />
            <div>
              <h2 id="coverage-summary-title">{activePartialDiagnosis.title}</h2>
              <p>{activePartialDiagnosis.summary}</p>
              {activePartialDiagnosis.gaps.length > 0 && (
                <ul>
                  {activePartialDiagnosis.gaps.map((gap) => <li key={gap}>{gap}</li>)}
                </ul>
              )}
              <p className="coverage-next-step">{activePartialDiagnosis.nextStep}</p>
            </div>
          </section>
        )}

        {!demoMode && resultViewOpen && allResultsMissingPreviews && (
          <section className="drawing-recovery" aria-labelledby="drawing-recovery-title">
            <MonitorUp aria-hidden="true" />
            <div className="drawing-recovery-copy">
              <h2 id="drawing-recovery-title">这次研究暂时没有可显示的图纸</h2>
              <p>
                {anyPreviewLoadFailed
                  ? '来源图片链接无法加载；可打开原始页面查看，或重新研究获取新的预览。'
                  : runHadBrowserUnavailable
                  ? browserConnected === true
                    ? '扩展现已连接，重新研究后可提取网页中的图纸。'
                    : '研究时浏览器扩展未连接，因此只保留了网页文字和来源。'
                  : '来源页没有返回可展示图片；可先打开原始页面核对，再重新研究。'}
              </p>
              {browserPairingStatus && <small className="browser-pairing-status" aria-live="polite">{browserPairingStatus}</small>}
            </div>
            <div className="drawing-recovery-actions">
              {browserConnected !== true && (
                <button type="button" disabled={browserConnecting} onClick={() => void handleConnectBrowser()}>
                  <MonitorUp aria-hidden="true" />{browserConnecting ? '正在打开 Chrome…' : '在 Chrome 中启用精确提取'}
                </button>
              )}
              <button type="button" onClick={() => void refreshBrowserConnection()}>
                <RefreshCw aria-hidden="true" />检查连接
              </button>
              <button
                className="button-primary"
                type="button"
                disabled={browserConnected !== true || rerunStarting}
                onClick={() => void handleRerunWithBrowser()}
              >
                {rerunStarting ? '正在重新研究…' : '重新研究'}
              </button>
            </div>
          </section>
        )}

        {loading && <section className="board-loading" aria-label="正在加载工作区"><p>正在读取本地工作区…</p></section>}
        {!loading && resultViewOpen && !demoMode && results.length === 0 && !actionError && (
          activeRun && isRunActive ? (
            <section className="active-research-canvas" aria-label="研究正在进行">
              <header>
                <span>正在研究这个问题</span>
                <h1>{activeRun.question}</h1>
                <p>{activeStatus ? activeStageDescriptions[activeStatus] : '正在准备研究任务'}</p>
              </header>
              <ol className="active-stage-track" aria-label="研究阶段">
                {stageLabels.slice(0, -1).map((stage, index) => (
                  <li
                    key={stage.status}
                    data-state={index < activeStageIndex ? 'complete' : index === activeStageIndex ? 'active' : 'upcoming'}
                    aria-current={index === activeStageIndex ? 'step' : undefined}
                  >
                    <span aria-hidden="true">{index + 1}</span>
                    {stage.label}
                  </li>
                ))}
              </ol>
              {activeRun.subquestions.length > 0 && (
                <section className="active-subquestions" aria-labelledby="active-subquestions-title">
                  <h2 id="active-subquestions-title">已经拆成 {activeRun.subquestions.length} 个证据问题</h2>
                  <ol>
                    {activeRun.subquestions.map((subquestion) => (
                      <li key={subquestion.id}>{subquestion.question}</li>
                    ))}
                  </ol>
                </section>
              )}
            </section>
          ) : (
            <section className="board-empty" aria-label="尚无研究结果">
              <h2>从一个具体设计问题开始</h2>
              <p>描述需要解决的空间、流线、更新或图纸表达问题，研究结果会按证据等级进入这里。</p>
            </section>
          )
        )}

        {resultViewOpen && results.length > 0 && (
          <section className="result-workbench" aria-label="结果工作台">
            <div className="result-workbench-intro">
              <SlidersHorizontal aria-hidden="true" />
              <div>
                <h2 id="result-workbench-title">把研究结果继续变成设计材料</h2>
                <p>选中图纸后，对照设计方法、整理表达规范，或导出继续使用。</p>
              </div>
              <button aria-label={traceOpen ? '关闭研究过程' : '查看研究过程'} aria-describedby="tool-trace-help" type="button" onClick={(event) => { overlayTriggerRef.current = event.currentTarget; setTraceOpen((current) => !current) }}>
                <Activity aria-hidden="true" />
                <span><strong>{traceOpen ? '关闭研究过程' : '查看研究过程'}</strong><small id="tool-trace-help">查看搜索、网页读取、图纸识别与来源核验记录</small></span>
              </button>
            </div>
            <div className="result-workbench-actions">
              <button aria-label="对照设计方法" aria-describedby="tool-compare-help" type="button" disabled={comparisonIds.length < 2} onClick={(event) => { overlayTriggerRef.current = event.currentTarget; setComparisonOpen(true) }}>
                <Columns3 aria-hidden="true" />
                <span><strong>对照设计方法</strong><small id="tool-compare-help">{comparisonIds.length < 2 ? `已选 ${comparisonIds.length} 张，还需选择 ${2 - comparisonIds.length} 张图纸` : `已选 ${comparisonIds.length} 张，按方法、观察与边界逐项比较`}</small></span>
              </button>
              <button aria-label="编辑图纸表达规范" aria-describedby="tool-style-help" type="button" onClick={(event) => { overlayTriggerRef.current = event.currentTarget; setStyleProfileOpen(true) }}>
                <Palette aria-hidden="true" />
                <span><strong>编辑图纸表达规范</strong><small id="tool-style-help">手动设定配色、线型与字体，保存到本研究板</small></span>
              </button>
              <button aria-label="导出个人研究板" aria-describedby="tool-private-export-help" type="button" disabled={comparisonIds.length === 0} onClick={() => void handleExport('private')}>
                <Download aria-hidden="true" />
                <span><strong>导出个人研究板</strong><small id="tool-private-export-help">{comparisonIds.length === 0 ? '选择图纸后，可导出包含完整图片的个人研究板' : `导出已选 ${comparisonIds.length} 张图纸，包含完整图片`}</small></span>
              </button>
              <button aria-label="生成可分享来源板" aria-describedby="tool-share-export-help" type="button" disabled={comparisonIds.length === 0} onClick={(event) => { overlayTriggerRef.current = event.currentTarget; setShareSummaryOpen(true) }}>
                <Share2 aria-hidden="true" />
                <span><strong>生成可分享来源板</strong><small id="tool-share-export-help">受限图片只保留署名、来源与链接</small></span>
              </button>
            </div>
            {lastExport && (
              <div className="result-export-ready">
                <Check aria-hidden="true" />
                <span>{lastExport.mode === 'private' ? '个人研究板已生成' : '分享来源板已生成'}</span>
                <a href={lastExport.browser_url} target="_blank" rel="noreferrer">
                  {lastExport.mode === 'private' ? '打开个人研究板' : '打开分享来源板'}
                  <ExternalLink aria-hidden="true" />
                </a>
              </div>
            )}
          </section>
        )}

        {resultViewOpen && results.length > 0 && (
          <section className="results-section" aria-label="研究结果">
            <header className="result-task-heading">
              <span>{demoMode ? `${modeLabels[mode]}研究演示` : '本次研究任务'}</span>
              <h1>{researchQuestion}</h1>
              <p>Agent 先把总问题拆成可检索的证据问题，再用具体项目的多张图纸回答。结论和来源不会混在一起。</p>
              {demoMode && (
                <div className="demo-depth-contract" role="group" aria-label={`${modeLabels[mode]}研究深度说明`}>
                  <strong>{modeLabels[mode]}研究</strong>
                  <span>{researchDepthOptions[mode].coverage}</span>
                  <span>{researchDepthOptions[mode].target}</span>
                  <small>固定回放 · 不消耗网页研究额度</small>
                </div>
              )}
            </header>

            <section className="question-decomposition" aria-label="子问题清单">
              <h2 className="visually-hidden">研究给出的方向</h2>
              <header className="section-heading">
                <div>
                  <h2>问题拆解</h2>
                  <p>{subquestionSummaries.every((item) => item.assetCount > 0)
                    ? '每个子问题都有自己的项目和图纸证据；先判断哪一项最接近你当前卡住的地方。'
                    : '完整结果会覆盖每个子问题；当前没有证据的分支会明确保留，方便继续补研。'}</p>
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
                      {subquestion.passCount !== undefined && `已调研 ${subquestion.passCount} 轮 · `}
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
                      <span aria-hidden="true">{group.unassigned ? '?' : group.index + 1}</span>
                      <div>
                        <h3 id={`case-chapter-${group.subquestion.id}`}>{group.subquestion.question}</h3>
                        <p>{group.unassigned
                          ? group.subquestion.rationale
                          : `${group.dossiers.length} 个项目 · ${group.assets.length} 张支撑图纸`}</p>
                      </div>
                    </header>

                    {group.assets.length === 0 ? (
                      <div className="case-chapter-empty">
                        <strong>这一分支还没有完整证据</strong>
                        <p>已经完成检索，但还没有找到可用且有来源证据的图纸。</p>
                      </div>
                    ) : <div className="dossier-list">
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
                                const previewUrl = availablePreviewUrl(result, failedPreviewUrls)
                                const previewLoadFailed = Boolean(
                                  result.previewUrl && failedPreviewUrls[result.id] === result.previewUrl,
                                )
                                const browserWasUnavailable = browserWasUnavailableForSource(
                                  traceEvents,
                                  result.sourceUrl,
                                )
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
                                          {previewUrl ? (
                                            <img
                                              src={previewUrl}
                                              alt={`${result.project} ${assetLabels[result.assetType]}`}
                                              loading={resultIndex < 6 ? 'eager' : 'lazy'}
                                              decoding="async"
                                              fetchPriority={resultIndex < 3 ? 'high' : 'auto'}
                                              onError={() => markPreviewFailed(result.id, previewUrl)}
                                            />
                                          ) : (
                                            <div className="preview-unavailable">
                                              <ImageOff aria-hidden="true" />
                                              <strong>
                                                {previewLoadFailed
                                                  ? '图纸预览加载失败'
                                                  : browserWasUnavailable
                                                  ? '此次未连接浏览器扩展，未能提取图纸'
                                                  : '未提取到图纸'}
                                              </strong>
                                              <p>打开原始页面查看图纸，并核对图纸与项目的对应关系。</p>
                                            </div>
                                          )}
                                          <div className="evidence-image-labels">
                                            <span>{assetLabels[result.assetType]}</span>
                                            {previewUrl && result.previewSource && (
                                              <span>{result.previewSource === 'chrome' ? 'Chrome 精确裁图' : '公开网页图片'}</span>
                                            )}
                                            {previewLoadFailed && <span>来源链接</span>}
                                          </div>
                                        </div>
                                        <figcaption>
                                          <strong>{result.title}</strong>
                                          <p>{resultAnalysis.observation}</p>
                                        </figcaption>
                                      </figure>
                                    </button>
                                    <footer className="evidence-sheet-actions">
                                      <span>问题匹配 {result.relevance} / 4</span>
                                      {!previewUrl && (
                                        <a
                                          className="evidence-source-action"
                                          href={result.sourceUrl}
                                          target="_blank"
                                          rel="noreferrer"
                                        >
                                          <ExternalLink aria-hidden="true" />
                                          <span>打开原始图纸页</span>
                                        </a>
                                      )}
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
                            <p>{publicationTierLabels[dossier.primary.publicationTier]} · 权利 {rightsStatusLabels[dossier.primary.rightsStatus]}</p>
                            <a href={dossier.primary.sourceUrl} target="_blank" rel="noreferrer">打开项目来源</a>
                          </footer>
                        </article>
                      ))}
                    </div>}
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
                    {selectedComparisonResults.map((result) => {
                      const previewUrl = availablePreviewUrl(result, failedPreviewUrls)
                      return (
                        <th scope="col" key={result.id}>
                          <div className="comparison-thumb">
                            {previewUrl
                              ? <img src={previewUrl} alt="" onError={() => markPreviewFailed(result.id, previewUrl)} />
                              : <span>预览不可用</span>}
                          </div>
                          <span className="comparison-column-meta">{assetLabels[result.assetType]} · {tierLabels[result.tier]}</span>
                          <strong>{result.title}</strong>
                          <small>{result.project} · 问题匹配 {result.relevance} / 4</small>
                        </th>
                      )
                    })}
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
                  <div><dt>发布来源</dt><dd>{publicationTierLabels[selectedResult.publicationTier]}</dd></div>
                  <div><dt>项目身份</dt><dd>{associationLabels[selectedResult.projectIdentity]}</dd></div>
                  <div><dt>图纸归属</dt><dd>{associationLabels[selectedResult.assetAssociation]}</dd></div>
                  <div><dt>权利状态</dt><dd>{rightsStatusLabels[selectedResult.rightsStatus]}</dd></div>
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
          <section className="trace-panel" role="dialog" aria-modal="true" aria-label="研究过程记录">
            <header><div><span>运行记录</span><h3>研究过程记录</h3></div><button type="button" autoFocus onClick={closeOverlays}>关闭</button></header>
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
