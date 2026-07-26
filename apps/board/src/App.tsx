import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Bookmark,
  Check,
  ChevronRight,
  CircleDashed,
  Columns3,
  Download,
  Eye,
  ExternalLink,
  FolderPlus,
  HardDriveDownload,
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
  Trash2,
  Upload,
  X,
} from 'lucide-react'

import {
  ApiError,
  apiClient,
  type ApiAssetCandidate,
  type ApiEvidenceClaim,
  type ArchitectureAssetType,
  type BoardExport,
  type PersonalCollection,
  type ResearchGoal,
  type ResearchMode,
  type ResearchRun,
  type ResearchSynthesis,
  type ResearchSynthesisFinding,
  type ResearchSource,
  type ResearchSubquestion,
  type RunStatus,
  type TraceEvent,
  type Workspace,
  type WorkspaceBackupPreflight,
} from './api/client'
import {
  BrowserBridgeError,
  requestBrowserBridge,
  resolveBrowserEndpoint,
  type BrowserBridgeStatus,
} from './browserBridge'
import {
  demoSubquestions,
  evidenceResults,
  type AssetType,
  type EvidenceResult,
} from './data/mock'
import { ClickSpark } from './components/ClickSpark'
import { StudioBackdrop } from './components/StudioBackdrop'

type WorkResult = EvidenceResult & {
  analysisReady: boolean
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
  texture: 'none' | 'vellum' | 'grain'
  layoutNotes: string
}

type CollectionSelection = {
  key: string
  resultId: string
  subquestionId?: string
}

function collectionSelectionKey(resultId: string, subquestionId?: string) {
  return subquestionId ? `${subquestionId}:${resultId}` : `asset:${resultId}`
}

const terminalStatuses = new Set<RunStatus>([
  'completed',
  'partial',
  'blocked',
  'cancelled',
  'failed',
])

function questionRelevanceLabel(relevance: number) {
  if (relevance >= 4) return '直接支撑本题'
  if (relevance >= 3) return '与本题高度相关'
  if (relevance >= 2) return '可补充本题'
  if (relevance >= 1) return '与本题关联较弱'
  return '与本题无直接关系'
}

const publicationTierLabels: Record<ApiAssetCandidate['publication_tier'], string> = {
  primary: '项目或设计方首发',
  trusted_secondary: '可信二手来源',
  aggregator: '转载合集（非首发）',
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
  unknown: '未注明',
  restricted: '受限',
}

const chineseCharacterPattern = /[\u3400-\u9fff]/
const localSynthesisPrefix = '【本地证据汇总】'
const synthesisHeadlineCharacterLimit = 84

function synthesisSegment(statement: string, label: string) {
  const prefix = `${label}：`
  const segment = statement
    .split('；')
    .map((item) => item.trim())
    .find((item) => item.startsWith(prefix))
  return segment?.slice(prefix.length).trim() ?? ''
}

function conciseSynthesisHeadline(statement: string) {
  const trimmed = statement.trim()
  if (trimmed.length <= synthesisHeadlineCharacterLimit) return trimmed
  const firstSentence = trimmed.match(/^.{16,84}?[。！？]/u)?.[0]
  if (firstSentence) return firstSentence
  return `${trimmed.slice(0, synthesisHeadlineCharacterLimit - 1).trim()}…`
}

function fallbackAnswerMechanism(statement: string) {
  const firstFinding = statement
    .replace(localSynthesisPrefix, '')
    .replace(/^[；：:\s]+/u, '')
    .split('；')
    .map((item) => item.trim())
    .find(Boolean) ?? statement
  return firstFinding.replace(/^[^：]{1,80}：/u, '').trim()
}

function userFacingRecommendation(statement: string) {
  return statement
    .replace(/^【(?:转译建议|建议|操作)[^】]*】\s*/u, '')
    .replace(/^转译步骤[（(][^）)]+[）)]\s*[：:]\s*/u, '')
    .replace(/^(?:转译建议|转译步骤|建议|操作)\s*[：:]\s*/u, '')
    .replace(/(?:该建议转译自|后半部分属于)[^。！？]*[。！？]?/gu, '')
    .replace(/[，,]\s*(?:不能|不可)[^。！？]*(?:推定|证明|断言)[^。！？]*[。！？]?/gu, '。')
    .trim()
}

function userFacingProjectName(projectName: string) {
  return projectName
    .replace(/\s*\|\s*(?:ArchDaily(?:\s+China)?|Dezeen|Designboom|Divisare)\s*$/iu, '')
    .trim()
}

function researchSynthesisOverview(synthesis: ResearchSynthesis) {
  const rawStatement = synthesis.answer.statement.trim()
  const isFallback = synthesis.generation_mode === 'deterministic_fallback'
    || rawStatement.startsWith(localSynthesisPrefix)
  const isMachineShaped = isFallback || rawStatement.length > 96
  const mechanism = synthesis.causal_chains
    .map((finding) => synthesisSegment(finding.statement, '机制'))
    .find(Boolean)
  const headline = isMachineShaped
    ? conciseSynthesisHeadline(mechanism || fallbackAnswerMechanism(rawStatement))
    : rawStatement
  const seenActions = new Set<string>()
  const actions: ResearchSynthesisFinding[] = []
  for (const finding of synthesis.recommendations) {
    const statement = userFacingRecommendation(finding.statement)
    if (!statement || seenActions.has(statement)) continue
    seenActions.add(statement)
    actions.push({ ...finding, statement })
    if (actions.length === 3) break
  }
  return {
    actions,
    headline,
    isFallback,
    isProjected: headline !== rawStatement,
    rawStatement,
  }
}

function chineseText(value: string | undefined, fallback: string) {
  const trimmed = value?.trim() ?? ''
  return chineseCharacterPattern.test(trimmed) ? trimmed : fallback
}

function chineseItems(values: string[] | undefined) {
  return (values ?? []).map((item) => item.trim()).filter((item) => chineseCharacterPattern.test(item))
}

function visualPlatformName(sourceUrl: string) {
  try {
    const hostname = new URL(sourceUrl).hostname.toLowerCase()
    if (hostname === 'xiaohongshu.com' || hostname.endsWith('.xiaohongshu.com')) return '小红书'
  } catch {
    return null
  }
  return null
}

const modeLabels: Record<ResearchMode, string> = {
  quick: '概览',
  balanced: '标准',
  deep: '深入',
}

const researchDepthOptions: Record<ResearchMode, { coverage: string; target: string }> = {
  quick: {
    coverage: '快速找方向',
    target: '从少量高相关案例提炼做法，给出直接建议',
  },
  balanced: {
    coverage: '形成方案依据',
    target: '比较多个案例的条件、做法与结果，说明适用边界',
  },
  deep: {
    coverage: '做跨案例论证',
    target: '综合更多案例，指出共识、冲突、不确定性和失效边界',
  },
}

const goalLabels: Record<ResearchGoal, string> = {
  precedent_research: '建筑设计研究',
  visual_reference_search: '图纸灵感',
}

const goalPlaceholders: Record<ResearchGoal, string> = {
  precedent_research: '例如：旧建筑植入新功能时，如何拆分公共流线与后勤流线？',
  visual_reference_search: '例如：我想出一张轴测图，帮我找几种风格。',
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
const activeWorkspaceStorageKey = 'archresearch.activeWorkspaceId'

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
  { status: 'inspecting', label: '读取项目' },
  { status: 'analyzing', label: '分析正文' },
  { status: 'verifying', label: '核验来源' },
  { status: 'gap_check', label: '检查缺口' },
  { status: 'composing', label: '综合方法' },
  { status: 'completed', label: '完成' },
]

const visualStageLabels: Array<{ status: RunStatus; label: string }> = [
  { status: 'planning', label: '确定方向' },
  { status: 'searching', label: '搜索灵感' },
  { status: 'inspecting', label: '读取图纸' },
  { status: 'analyzing', label: '分析画面' },
  { status: 'verifying', label: '核对来源' },
  { status: 'gap_check', label: '检查方向' },
  { status: 'composing', label: '整理灵感' },
  { status: 'completed', label: '完成' },
]

const activeStageDescriptions: Partial<Record<RunStatus, string>> = {
  created: '任务已经进入队列，正在准备研究计划',
  planning: '正在拆解问题并生成可检索的证据方向',
  searching: '正在从公开网页中寻找相关项目与原始来源',
  inspecting: '正在读取候选项目正文与项目背景',
  analyzing: '正在提取逐字引文、设计机制与转译步骤',
  verifying: '正在核对正文事实、项目身份与发布来源',
  gap_check: '正在检查案例正文和子问题证据缺口',
  composing: '正在比较案例并综合可转译的设计方法',
}

const visualActiveStageDescriptions: Partial<Record<RunStatus, string>> = {
  created: '任务已经进入队列，正在准备灵感检索',
  planning: '正在把需求整理成不同的图纸风格方向',
  searching: '正在按图纸类型和表达风格寻找参考',
  inspecting: '正在读取笔记图片并判断图纸类型与风格',
  analyzing: '正在提取线型、配色、材质和构图特征',
  verifying: '正在核对原笔记来源和可见图像内容',
  gap_check: '正在检查每个灵感方向是否已有可用参考',
  composing: '正在按风格方向整理图纸灵感',
}

const defaultStyle: StyleDraft = {
  primaryColor: '#315cf4',
  lineHierarchy: 'relative',
  fontCategory: 'sans',
  texture: 'none',
  layoutNotes: '',
}

function apiMessage(error: unknown) {
  return error instanceof ApiError || error instanceof Error ? error.message : '操作未完成，请重试；若反复失败，请重启 ArchResearch。'
}

function runAnnouncement(run: ResearchRun) {
  if (
    run.status === 'completed'
    && (run.coverageReport?.enrichment_gaps?.length ?? 0) > 0
  ) {
    return run.goal === 'visual_reference_search' ? '已形成初步灵感' : '研究已形成初步依据'
  }
  if (run.goal === 'visual_reference_search') {
    const visualLabels: Record<RunStatus, string> = {
      created: '已创建',
      planning: '正在确定方向',
      searching: '正在搜索灵感',
      inspecting: '正在读取图纸',
      analyzing: '正在分析画面',
      verifying: '正在核对来源',
      gap_check: '正在检查方向',
      composing: '正在整理灵感',
      completed: '已完成',
      partial: '已保留部分灵感',
      blocked: '研究尚未完成，暂未找到可用图纸',
      cancelled: '已取消',
      failed: '搜索失败，已找到的图纸已保留',
    }
    return visualLabels[run.status]
  }
  const labels: Record<RunStatus, string> = {
    created: '已创建',
    planning: '正在规划',
    searching: '正在搜索',
    inspecting: '正在浏览页面',
    analyzing: '正在分析项目正文',
    verifying: '正在核验来源',
    gap_check: '正在检查证据缺口',
    composing: '正在综合设计方法',
    completed: '研究已完成',
    partial: '已交付部分结果',
    blocked: '研究尚未完成，已有证据已保留',
    cancelled: '已取消',
    failed: '研究失败，已有证据已保留，可重新发起研究补齐',
  }
  return labels[run.status]
}

function needsCompletionContinuation(run: ResearchRun) {
  const completionGaps = new Set([
    'uncovered_subquestions',
    'article_analysis_incomplete',
    'research_synthesis_incomplete',
  ])
  return run.goal === 'precedent_research'
    && (run.coverageReport?.gaps ?? []).some((gap) => completionGaps.has(gap))
}

function retryActionLabel(run: ResearchRun) {
  return needsCompletionContinuation(run) ? '继续补齐研究' : '重试研究'
}

function partialReasonTitle(stopReason?: string | null) {
  if (stopReason === 'budget_exhausted') return '本轮自动检索次数已用完，先交付当前可用结果'
  if (stopReason === 'time_budget_exhausted') return '本轮研究达到时间上限'
  if (stopReason === 'visual_budget_exhausted') return '本轮可检查的图纸数量已达上限'
  if (stopReason === 'no_new_assets') return '连续检索没有找到新的有效项目证据'
  if (stopReason === 'unverified_visual_leads') return '已找到图片，但还不能用它确认项目事实'
  if (stopReason === 'browser_inspection_incomplete') return 'Chrome 图纸检查未完成'
  if (stopReason === 'no_usable_assets') return '暂未找到能支撑结论的项目证据'
  if (stopReason?.startsWith('provider_error:')) return '部分网页研究服务暂时不可用'
  return '本次研究先交付当前可用结果'
}

function partialDiagnosis(run: ResearchRun) {
  const coverage = run.coverageReport
  const usable = coverage?.usable_assets ?? 0
  if (run.goal === 'visual_reference_search') {
    const totalDirections = coverage?.subquestion_count ?? run.subquestions.length
    const coveredDirections = coverage?.covered_subquestions ?? 0
    const visualGapLabels: Record<string, string> = {
      insufficient_usable_assets: '可用图纸参考还不够',
      fewer_than_six_usable_assets: '可用图纸参考还不够',
      insufficient_project_diversity: '不同风格的参考还不够多样',
      insufficient_verified_or_partial: '部分图片还没有整理出可用的图面观察',
      uncovered_subquestions: '仍有灵感方向没有可用图纸参考',
      browser_inspection_incomplete: '部分笔记图片未能完成读取',
    }
    const gaps = (coverage?.gaps ?? []).map(
      (gap) => visualGapLabels[gap] ?? gap.replaceAll('_', ' '),
    )
    return {
      title: usable > 0 ? '还有灵感方向待补充' : '暂未找到可用图纸灵感',
      summary: `已保留 ${usable} 张可用灵感图，覆盖 ${coveredDirections}/${totalDirections} 个方向。`,
      gaps,
      nextStep: usable > 0
        ? '可以先使用已有灵感；重新查找会保留当前结果，只补未覆盖的方向。'
        : '换一种图纸类型、风格词或画面特征后再查找。',
    }
  }
  const projects = coverage?.project_count ?? 0
  const supported = coverage?.verified_or_partial ?? 0
  const gapLabels: Record<string, string> = {
    insufficient_usable_assets: `“${modeLabels[run.mode]}”研究需要更多可用项目证据`,
    fewer_than_six_usable_assets: `“${modeLabels[run.mode]}”研究需要更多可用项目证据`,
    insufficient_project_diversity: '具体项目数量还不足，案例覆盖不够多样',
    insufficient_verified_or_partial: '已有来源依据的项目证据还不够',
    uncovered_subquestions: '仍有子问题没有足够的项目原文支撑',
    article_analysis_incomplete: '部分来源还没有同时说明项目条件、设计做法和可借鉴步骤',
    research_synthesis_incomplete: '案例依据已经保留，但当前研究深度要求的结论还没整理完成',
    browser_inspection_incomplete: 'Chrome 未能完成候选页面的图纸检查，现有网页结果已保留',
    insufficient_multi_asset_projects: '部分项目还缺少平面、剖面等互补图纸',
  }
  const gaps = [...new Set((coverage?.gaps ?? []).map(
    (gap) => gapLabels[gap] ?? '仍有研究内容未达到当前研究深度的目标',
  ))]
  const continuationRequired = needsCompletionContinuation(run)
  return {
    title: continuationRequired ? '仍有子问题等待补齐' : partialReasonTitle(run.stopReason),
    summary: `已保留 ${usable} 条可用项目证据，覆盖 ${projects} 个项目，其中 ${supported} 条已有来源依据。`,
    gaps,
    nextStep: continuationRequired
      ? '目前是中途保存的进度，还不是完整结果；点“继续补齐研究”会保留已有证据，只补齐仍空白的子问题。'
      : '可以继续查看现有结果；重试会开启新一轮研究，补找项目原文与来源依据。',
  }
}

function recentRunAnnouncement(run: ResearchRun) {
  return run.status === 'partial'
    ? `部分结果 · ${partialReasonTitle(run.stopReason)}`
    : runAnnouncement(run)
}

const announcementExplanations: Record<string, string> = {
  研究已形成初步依据: '已回答全部研究问题，但案例数量或深度未达完整标准，可作初步参考',
  已形成初步灵感: '已覆盖全部灵感方向，但可用图纸数量未达完整标准，可作初步参考',
}

function formatRunDate(value?: string) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric' }).format(date)
}

function retentionDays(value?: string | null) {
  if (!value) return null
  const expiry = new Date(value)
  if (Number.isNaN(expiry.getTime())) return null
  return Math.max(0, Math.ceil((expiry.getTime() - Date.now()) / 86_400_000))
}

function RunHistoryList({
  runs,
  onOpen,
  onRetentionChange,
  retentionUpdatingId,
}: {
  runs: ResearchRun[]
  onOpen: (run: ResearchRun) => void
  onRetentionChange?: (run: ResearchRun) => void
  retentionUpdatingId?: string
}) {
  return (
    <ul className="recent-list">
      {runs.map((run) => {
        const recordTitle = run.title?.trim() || run.question
        const runDate = formatRunDate(run.updatedAt ?? run.createdAt)
        const usableAssets = run.coverageReport?.usable_assets
        const daysRemaining = retentionDays(run.retentionExpiresAt)
        const announcement = recentRunAnnouncement(run)
        return (
          <li key={run.id}>
            <div className="recent-run-row">
              <button className="recent-open" type="button" aria-label={`打开研究：${recordTitle}`} onClick={() => onOpen(run)}>
                <span className="recent-question">{recordTitle}</span>
                <span className="recent-meta">
                  {[
                    goalLabels[run.goal] ?? '研究任务',
                    run.goal === 'visual_reference_search' ? null : modeLabels[run.mode],
                    usableAssets === undefined ? null : `${usableAssets} 张参考`,
                    runDate || null,
                  ].filter(Boolean).join(' · ')}
                </span>
                <span className="recent-status" title={announcementExplanations[announcement]}>{announcement}</span>
                <ArrowRight aria-hidden="true" />
              </button>
              {onRetentionChange && (
                <div className="retention-control">
                  <span>{run.keepForever ? '永久保留' : `还剩 ${daysRemaining ?? 14} 天`}</span>
                  <button
                    type="button"
                    aria-label={`${run.keepForever ? '取消永久保留' : '永久保留'}：${recordTitle}`}
                    title={run.keepForever
                      ? '取消后改为保留 14 天，到期自动删除'
                      : '设为永久后，这条记录不再自动删除'}
                    disabled={retentionUpdatingId === run.id}
                    onClick={() => onRetentionChange(run)}
                  >
                    {retentionUpdatingId === run.id ? '保存中…' : (run.keepForever ? '取消永久' : '设为永久')}
                  </button>
                </div>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
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

function legacyChineseAnalysis(candidate: ApiAssetCandidate, assetType: ArchitectureAssetType) {
  const assetLabel = assetLabels[assetType]
  return {
    projectContext: `${candidate.project_name} 的来源页收录了这张${assetLabel}，可作为当前子问题的图片线索，项目原文仍需核对。`,
    designMechanism: '现有记录只确认图纸类型与来源关系，不足以断言更具体的空间机制。',
    transferStrategy: [
      `先用这张${assetLabel}核对与当前子问题直接相关的空间关系。`,
      '再回到原始来源确认图纸归属、尺度和适用边界。',
    ],
    observation: `当前记录未保留这张${assetLabel}的中文图面观察，请结合图纸和原始来源核对。`,
    limitation: '当前记录只保留了来源与图纸类型，具体机制、尺度和适用条件仍需核对。',
  }
}

function toWorkResult(candidate: ApiAssetCandidate): WorkResult {
  const assetType = candidate.asset_type as ArchitectureAssetType
  const facts = chineseItems(candidate.facts)
  const observations = chineseItems(candidate.observations)
  const inferences = chineseItems(candidate.inferences)
  const limitations = chineseItems(candidate.limitations)
  const transferStrategy = chineseItems(candidate.transfer_strategy)
  const analysisReady = Boolean(
    chineseCharacterPattern.test(candidate.project_context ?? '')
    && chineseCharacterPattern.test(candidate.design_mechanism ?? '')
    && transferStrategy.length
    && candidate.evidence_claims.some((claim) => Boolean(claim.text_excerpt?.trim())),
  )
  const legacyAnalysis = legacyChineseAnalysis(candidate, assetType)
  return {
    id: candidate.id,
    title: chineseText(candidate.inferences[0], `${assetLabels[assetType]}研究线索`),
    project: candidate.project_name,
    location: '实时网页研究',
    year: '年份待核对',
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
    analysisReady,
    subquestionAnalysis: Object.fromEntries(
      Object.entries(candidate.subquestion_analysis ?? {}).map(([id, analysis]) => [
        id,
        {
          projectContext: chineseText(
            analysis.project_context,
            legacyAnalysis.projectContext,
          ),
          designMechanism: chineseText(
            analysis.design_mechanism,
            legacyAnalysis.designMechanism,
          ),
          transferStrategy: chineseItems(analysis.transfer_strategy).length
            ? chineseItems(analysis.transfer_strategy)
            : legacyAnalysis.transferStrategy,
          observations: chineseItems(analysis.observations).length
            ? chineseItems(analysis.observations)
            : [legacyAnalysis.observation],
          limitations: chineseItems(analysis.limitations).length
            ? chineseItems(analysis.limitations)
            : [legacyAnalysis.limitation],
        },
      ]),
    ),
    projectContext:
      chineseCharacterPattern.test(candidate.project_context ?? '')
        ? candidate.project_context ?? ''
        : facts.join(' ') || legacyAnalysis.projectContext,
    designMechanism:
      chineseCharacterPattern.test(candidate.design_mechanism ?? '')
        ? candidate.design_mechanism ?? ''
        : observations.join(' ') || legacyAnalysis.designMechanism,
    transferStrategy:
      transferStrategy.length
        ? transferStrategy
        : inferences.length
          ? inferences
          : legacyAnalysis.transferStrategy,
    previewUrl: candidate.has_local_content
      ? `/v1/assets/${candidate.id}/content`
      : candidate.image_url,
    previewSource: candidate.has_local_content
      ? 'chrome'
      : candidate.image_url
        ? 'public'
        : null,
    fact: facts[0] ?? legacyAnalysis.projectContext,
    observation: observations[0] ?? legacyAnalysis.observation,
    inference: inferences[0] ?? legacyAnalysis.designMechanism,
    limitation: limitations[0] ?? legacyAnalysis.limitation,
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
        analysisReady: true,
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

type CollectionCaseSubquestion = NonNullable<
  PersonalCollection['snapshot']['case_subquestions']
>[number]

type CollectionCaseImage = NonNullable<
  PersonalCollection['snapshot']['case_images']
>[number]

function collectionCaseImages(item: PersonalCollection): CollectionCaseImage[] {
  const stored = item.snapshot.case_images?.filter((image) => image.image_url.trim()).slice(0, 3) ?? []
  if (stored.length > 0) return stored
  if (!item.snapshot.image_url) return []
  return [{
    asset_id: item.asset_candidate_id,
    asset_type: item.snapshot.asset_type ?? 'photograph',
    image_url: item.snapshot.image_url,
    source_url: item.source_url,
  }]
}

function collectionCaseImageUrl(item: PersonalCollection, image: CollectionCaseImage) {
  if (image.asset_id === item.asset_candidate_id && item.snapshot.collection_file) {
    return `/v1/collections/${item.id}/content`
  }
  return image.image_url
}

function collectionCaseSubquestions(item: PersonalCollection): CollectionCaseSubquestion[] {
  const stored = item.snapshot.case_subquestions?.filter((subquestion) => (
    subquestion.question.trim()
  )) ?? []
  if (stored.length > 0) return stored
  return [{
    id: 'legacy',
    question: '未记录具体案例子问题',
    project_context: item.snapshot.project_context?.trim() ?? '',
    design_mechanism: item.snapshot.design_mechanism?.trim() || item.note.trim(),
    transfer_strategy: item.snapshot.transfer_strategy ?? [],
    limitations: item.snapshot.limitations ?? [],
  }]
}

function collectionCaseGroups(items: PersonalCollection[]) {
  const groups = new Map<string, {
    id: string
    question: string
    entries: Array<{ item: PersonalCollection; analysis: CollectionCaseSubquestion }>
  }>()
  for (const item of items) {
    for (const analysis of collectionCaseSubquestions(item)) {
      const current = groups.get(analysis.id) ?? {
        id: analysis.id,
        question: analysis.question,
        entries: [],
      }
      current.entries.push({ item, analysis })
      groups.set(analysis.id, current)
    }
  }
  return [...groups.values()]
}

function analysisFor(result: WorkResult, subquestionId: string) {
  const scoped = result.subquestionAnalysis[subquestionId]
  const limitations = scoped?.limitations.length ? scoped.limitations : [result.limitation]
  return {
    projectContext: scoped?.projectContext.trim() || result.projectContext,
    designMechanism: scoped?.designMechanism.trim() || result.designMechanism,
    transferStrategy: scoped?.transferStrategy.length ? scoped.transferStrategy : result.transferStrategy,
    observation: scoped?.observations.find((item) => item.trim()) || result.observation,
    limitation: firstUserFacingBoundary(limitations),
  }
}

function normalizedCopy(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLowerCase()
}

function isLegacyObservationFallback(value: string) {
  return /^当前记录未保留这张.+的中文图面观察，请结合图纸和原始来源核对。$/.test(value.trim())
}

function projectPreviewCopy(
  assets: WorkResult[],
  projectAnalysis: ReturnType<typeof analysisFor>,
  subquestionId: string,
) {
  const assetCopy = new Map<string, { title?: string; observation?: string }>()
  if (assets.length === 1) {
    const result = assets[0]
    assetCopy.set(result.id, {
      title: result.title,
      observation: analysisFor(result, subquestionId).observation,
    })
    return { shared: [] as string[], assetCopy }
  }

  const analysisKeys = new Set([
    projectAnalysis.projectContext,
    projectAnalysis.designMechanism,
    ...projectAnalysis.transferStrategy,
    projectAnalysis.limitation,
  ].map(normalizedCopy))
  const titles = assets.map((result) => result.title)
  const observations = assets.map((result) => analysisFor(result, subquestionId).observation)
  const titleCounts = new Map<string, number>()
  const observationCounts = new Map<string, number>()
  for (const title of titles) {
    const key = normalizedCopy(title)
    titleCounts.set(key, (titleCounts.get(key) ?? 0) + 1)
  }
  for (const observation of observations) {
    const key = isLegacyObservationFallback(observation) ? 'legacy-fallback' : normalizedCopy(observation)
    observationCounts.set(key, (observationCounts.get(key) ?? 0) + 1)
  }

  const shared: string[] = []
  const sharedKeys = new Set<string>()
  for (const title of titles) {
    const key = normalizedCopy(title)
    if (analysisKeys.has(key) || (titleCounts.get(key) ?? 0) < 2 || sharedKeys.has(key)) continue
    shared.push(title)
    sharedKeys.add(key)
  }
  for (const observation of observations) {
    const key = isLegacyObservationFallback(observation) ? 'legacy-fallback' : normalizedCopy(observation)
    if (analysisKeys.has(normalizedCopy(observation)) || (observationCounts.get(key) ?? 0) < 2 || sharedKeys.has(key)) continue
    shared.push(key === 'legacy-fallback'
      ? '当前记录未保留这些图的中文图面观察，请结合图纸和原始来源核对。'
      : observation)
    sharedKeys.add(key)
  }

  assets.forEach((result, index) => {
    const titleKey = normalizedCopy(result.title)
    const observation = observations[index]
    const observationKey = isLegacyObservationFallback(observation)
      ? 'legacy-fallback'
      : normalizedCopy(observation)
    const uniqueTitle = !analysisKeys.has(titleKey) && titleCounts.get(titleKey) === 1
    const uniqueObservation = !analysisKeys.has(normalizedCopy(observation))
      && observationCounts.get(observationKey) === 1
    assetCopy.set(result.id, {
      title: uniqueTitle ? result.title : undefined,
      observation: uniqueObservation ? observation : undefined,
    })
  })
  return { shared, assetCopy }
}

function uniqueSummaryItems(items: string[], limit: number) {
  const seen = new Set<string>()
  const unique: string[] = []
  for (const item of items) {
    const value = item.trim()
    const key = value.replace(/\s+/g, ' ').toLowerCase()
    if (!value || seen.has(key)) continue
    seen.add(key)
    unique.push(value)
    if (unique.length === limit) break
  }
  return unique
}

const auditBoundaryPattern = /原文|正文|来源|源网站|证据|核对|核验|未给出|未说明|未记录|待确认|仍需确认|不详|证明|断言|实证|drawing_ids|研究子问题|页面仅支持/

function userFacingBoundary(statement: string) {
  return statement.replace(/^(?:适用边界|适用条件|适用时注意|边界)\s*[：:]\s*/u, '').trim()
}

function firstUserFacingBoundary(items: string[]) {
  const boundary = uniqueSummaryItems(items, items.length)
    .find((item) => !auditBoundaryPattern.test(item)) ?? ''
  return userFacingBoundary(boundary)
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
  const [activeRun, setActiveRun] = useState<ResearchRun | null>(null)
  const [recentRuns, setRecentRuns] = useState<ResearchRun[]>([])
  const [collectionOpen, setCollectionOpen] = useState(false)
  const [dataManagementOpen, setDataManagementOpen] = useState(false)
  const [backupFile, setBackupFile] = useState<File | null>(null)
  const [backupPreflight, setBackupPreflight] = useState<WorkspaceBackupPreflight | null>(null)
  const [dataOperation, setDataOperation] = useState<'backup' | 'preflight' | 'restore' | ''>('')
  const [dataStatus, setDataStatus] = useState('')
  const [collectionView, setCollectionView] = useState<'precedent' | 'visual'>('precedent')
  const [selectedCollectionSubquestion, setSelectedCollectionSubquestion] = useState<{
    collectionQuestion: string
    subquestionId: string
  } | null>(null)
  const [personalCollections, setPersonalCollections] = useState<PersonalCollection[]>([])
  const [collectionsLoading, setCollectionsLoading] = useState(false)
  const [collectionSaving, setCollectionSaving] = useState(false)
  const [collectionSaveSucceeded, setCollectionSaveSucceeded] = useState(false)
  const [retentionUpdatingId, setRetentionUpdatingId] = useState('')
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
  const [collectionSelections, setCollectionSelections] = useState<CollectionSelection[]>([])
  const [comparisonOpen, setComparisonOpen] = useState(false)
  const [shareSummaryOpen, setShareSummaryOpen] = useState(false)
  const [styleProfileOpen, setStyleProfileOpen] = useState(false)
  const [boardId, setBoardId] = useState(demoMode ? 'mock-board-active' : '')
  const [styleProfile, setStyleProfile] = useState<StyleDraft>(defaultStyle)
  const [styleStatus, setStyleStatus] = useState('')
  const [traceEvents, setTraceEvents] = useState<TraceEvent[]>([])
  const [browserConnected, setBrowserConnected] = useState<boolean | null>(null)
  const [xiaohongshuSearchAvailable, setXiaohongshuSearchAvailable] = useState(false)
  const [browserReadinessLoading, setBrowserReadinessLoading] = useState(!demoMode)
  const [browserReadinessError, setBrowserReadinessError] = useState('')
  const [preflightBridgeStatus, setPreflightBridgeStatus] = useState<BrowserBridgeStatus | null>(null)
  const [browserPairingStatus, setBrowserPairingStatus] = useState('')
  const [browserConnecting, setBrowserConnecting] = useState(false)
  const [rerunStarting, setRerunStarting] = useState(false)
  const [composerOpen, setComposerOpen] = useState(!demoMode)
  const [researchOptionsOpen, setResearchOptionsOpen] = useState(false)
  const [briefReviewLoading, setBriefReviewLoading] = useState(false)
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
  const overlayOpen = inspectorOpen || comparisonOpen || shareSummaryOpen || styleProfileOpen

  const closeOverlays = useCallback(() => {
    const trigger = overlayTriggerRef.current
    setInspectorOpen(false)
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
    setCollectionOpen(false)
    setCollectionView('precedent')
    setSelectedCollectionSubquestion(null)
    setCollectionSaveSucceeded(false)
    setPersonalCollections([])
    setRetentionUpdatingId('')
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
    setComposerOpen(true)
    setResearchOptionsOpen(false)
    setInspectorOpen(false)
  }, [])

  const updateRecentRun = useCallback((nextRun: ResearchRun) => {
    setRecentRuns((current) => [
      nextRun,
      ...current.filter((run) => run.id !== nextRun.id),
    ])
  }, [])

  const handleRunRetention = useCallback(async (run: ResearchRun) => {
    setRetentionUpdatingId(run.id)
    setActionError('')
    try {
      const updated = await apiClient.updateRunRetention(run.id, !run.keepForever)
      setRecentRuns((current) => current.map((item) => (
        item.id === updated.id ? updated : item
      )))
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '无法更新历史保留设置。')
    } finally {
      setRetentionUpdatingId('')
    }
  }, [])

  async function openPersonalCollections(trigger: HTMLElement) {
    overlayTriggerRef.current = trigger
    setCollectionOpen(true)
    setCollectionView('precedent')
    setSelectedCollectionSubquestion(null)
    setComposerOpen(false)
    setCollectionSaveSucceeded(false)
    if (demoMode || !activeWorkspaceId) {
      setPersonalCollections([])
      return
    }
    setCollectionsLoading(true)
    setActionError('')
    try {
      setPersonalCollections(await apiClient.listPersonalCollections(activeWorkspaceId))
    } catch (error) {
      setActionError(`个人收藏未读取：${apiMessage(error)}`)
    } finally {
      setCollectionsLoading(false)
    }
  }

  async function deletePersonalCollection(collectionId: string) {
    setActionError('')
    try {
      await apiClient.deletePersonalCollection(collectionId)
      setPersonalCollections((current) => current.filter((item) => item.id !== collectionId))
      setSavedIds((current) => current.filter((id) => (
        personalCollections.find((item) => item.id === collectionId)?.asset_candidate_id !== id
      )))
    } catch (error) {
      setActionError(`收藏未删除：${apiMessage(error)}`)
    }
  }

  async function addSelectionToCollection() {
    const pendingSelections: CollectionSelection[] = isVisualResearch
      ? comparisonIds.filter((id) => !savedIds.includes(id)).map((resultId) => ({
          key: collectionSelectionKey(resultId),
          resultId,
        }))
      : collectionSelections
    const pendingIds = [...new Set(pendingSelections.map((item) => item.resultId))]
    if (pendingIds.length === 0) return
    if (demoMode) {
      setSavedIds((current) => [...new Set([...current, ...pendingIds])])
      setCollectionSelections([])
      setComparisonIds([])
      setCollectionSaveSucceeded(true)
      return
    }
    setCollectionSaving(true)
    setActionError('')
    try {
      const currentCollections = activeWorkspaceId
        ? await apiClient.listPersonalCollections(activeWorkspaceId)
        : personalCollections
      const currentQuestion = activeRun?.question.trim()
      const superseded = currentQuestion
        ? currentCollections.filter((item) => (
            item.snapshot.question?.trim() === currentQuestion
            && item.snapshot.goal === activeRun?.goal
          ))
        : []
      const savedItems: PersonalCollection[] = []
      for (const resultId of pendingIds) {
        if (rejectedIds.includes(resultId)) {
          await apiClient.unrejectResult(resultId)
          setRejectedIds((current) => current.filter((id) => id !== resultId))
        }
        const subquestionIds = pendingSelections
          .filter((item) => item.resultId === resultId)
          .map((item) => item.subquestionId)
          .filter((item): item is string => Boolean(item))
        savedItems.push(await apiClient.saveResult(
          resultId,
          notes[resultId] ?? '',
          subquestionIds.length > 0 ? subquestionIds : undefined,
        ))
      }
      const savedItemIds = new Set(savedItems.map((item) => item.id))
      const removedCollections = superseded.filter((item) => !savedItemIds.has(item.id))
      await Promise.all(removedCollections.map((item) => apiClient.deletePersonalCollection(item.id)))
      const supersededAssetIds = new Set(superseded.map((item) => item.asset_candidate_id))
      setSavedIds((current) => [
        ...new Set([
          ...current.filter((id) => !supersededAssetIds.has(id)),
          ...pendingIds,
        ]),
      ])
      setPersonalCollections((current) => [
        ...savedItems,
        ...current.filter((item) => (
          !removedCollections.some((oldItem) => oldItem.id === item.id)
          && !savedItems.some((saved) => saved.id === item.id)
        )),
      ])
      setCollectionSelections([])
      setComparisonIds([])
      if (activeRun) await apiClient.updateBoard(activeRun.id, [])
      setAnnouncement(`${pendingSelections.length} 项已加入个人收藏`)
      setCollectionSaveSucceeded(true)
    } catch (error) {
      setActionError(`收藏未保存：${apiMessage(error)}`)
    } finally {
      setCollectionSaving(false)
    }
  }

  async function clearResultSelection() {
    const previous = comparisonIds
    const previousCollectionSelections = collectionSelections
    setComparisonIds([])
    setCollectionSelections([])
    setCollectionSaveSucceeded(false)
    setLastExport(null)
    if (demoMode || !activeRun) return
    try {
      await apiClient.updateBoard(activeRun.id, [])
    } catch (error) {
      setComparisonIds(previous)
      setCollectionSelections(previousCollectionSelections)
      setActionError(`选择未清空：${apiMessage(error)}`)
    }
  }

  const clearRunView = useCallback(() => {
    setResults([])
    setSelectedResultId('')
    setSelectedSubquestionId('')
    setFailedPreviewUrls({})
    setBoardId('')
    setComparisonIds([])
    setCollectionSelections([])
    setCollectionSaveSucceeded(false)
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
        const rememberedWorkspaceId = window.localStorage.getItem(activeWorkspaceStorageKey)
        const initialWorkspace = next.find((workspace) => workspace.id === rememberedWorkspaceId) ?? next[0]
        setWorkspaces(next)
        setActiveWorkspaceId(initialWorkspace.id)
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
      setXiaohongshuSearchAvailable(apiResult.value.xiaohongshu_search_available)
    } else {
      setBrowserReadinessError(apiMessage(apiResult.reason))
      setBrowserConnected(null)
      setXiaohongshuSearchAvailable(false)
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
    setXiaohongshuSearchAvailable(browserStatus?.xiaohongshu_search_available ?? false)
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
        texture: profile.texture === 'vellum' || profile.texture === 'grain' ? profile.texture : 'none',
        layoutNotes: profile.layout_notes ?? '',
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
    setWorkspaceCreateOpen(false)
    setResearchOptionsOpen(false)
    clearRunView()
    if (!demoMode && run.workspaceId && run.workspaceId !== activeWorkspaceId) {
      window.localStorage.setItem(activeWorkspaceStorageKey, run.workspaceId)
      setActiveWorkspaceId(run.workspaceId)
    }
    try {
      if (terminalStatuses.has(run.status)) {
        await hydrateRun(run.id, () => hydrateRequestRef.current === requestId)
      } else if (hydrateRequestRef.current === requestId) {
        setPollingRunId(run.id)
      }
    } catch (error) {
      if (hydrateRequestRef.current === requestId) setActionError(apiMessage(error))
    }
  }, [activeWorkspaceId, clearRunView, demoMode, hydrateRun])

  useEffect(() => {
    if (demoMode || workspaces.length === 0) return
    let active = true
    void Promise.all(workspaces.map((workspace) => apiClient.listRuns(workspace.id)))
      .then(async (workspaceRuns) => {
        if (!active) return
        const runs = workspaceRuns.flat().sort((first, second) => (
          Date.parse(second.updatedAt ?? second.createdAt ?? '')
          - Date.parse(first.updatedAt ?? first.createdAt ?? '')
        ))
        setRecentRuns(runs)
        const latest = runs.find((run) => !terminalStatuses.has(run.status))
        if (!latest) return
        if (latest.workspaceId && latest.workspaceId !== activeWorkspaceId) {
          window.localStorage.setItem(activeWorkspaceStorageKey, latest.workspaceId)
          setActiveWorkspaceId(latest.workspaceId)
        }
        setActiveRun(latest)
        setAnnouncement(runAnnouncement(latest))
        setComposerOpen(false)
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
  }, [activeWorkspaceId, demoMode, workspaces])

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
          setActionError(`进度更新已中断，研究可能仍在后台进行。请刷新页面或从“最近研究”重新打开查看。（${apiMessage(error)}）`)
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
      window.localStorage.setItem(activeWorkspaceStorageKey, created.id)
      setActiveWorkspaceId(created.id)
      setNewWorkspaceName('')
      setWorkspaceCreateOpen(false)
    } catch (error) {
      setActionError(apiMessage(error))
    }
  }

  async function handleDownloadBackup() {
    setActionError('')
    setDataStatus('')
    setDataOperation('backup')
    try {
      const { blob, filename } = await apiClient.downloadWorkspaceBackup()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      link.click()
      URL.revokeObjectURL(url)
      setDataStatus('完整备份已下载')
    } catch (error) {
      setActionError(apiMessage(error))
    } finally {
      setDataOperation('')
    }
  }

  async function handleBackupPreflight() {
    if (!backupFile) return
    setActionError('')
    setDataStatus('')
    setDataOperation('preflight')
    try {
      setBackupPreflight(await apiClient.preflightWorkspaceBackup(backupFile))
    } catch (error) {
      setBackupPreflight(null)
      setActionError(apiMessage(error))
    } finally {
      setDataOperation('')
    }
  }

  async function handleRestoreBackup() {
    if (!backupFile || !backupPreflight?.ready) return
    setActionError('')
    setDataStatus('')
    setDataOperation('restore')
    try {
      await apiClient.restoreWorkspaceBackup(backupFile)
      const restoredWorkspaces = await apiClient.listWorkspaces()
      setWorkspaces(restoredWorkspaces)
      const restoredWorkspace = restoredWorkspaces.find(({ id }) => id === activeWorkspaceId)
        ?? restoredWorkspaces[0]
      if (restoredWorkspace) {
        setActiveWorkspaceId(restoredWorkspace.id)
        window.localStorage.setItem(activeWorkspaceStorageKey, restoredWorkspace.id)
      }
      resetWorkspaceView()
      setBackupPreflight(null)
      setBackupFile(null)
      setDataStatus('工作区已恢复')
    } catch (error) {
      setActionError(apiMessage(error))
    } finally {
      setDataOperation('')
    }
  }

  async function startResearchRun(subquestions?: ResearchSubquestion[]) {
    const researchSources: ResearchSource[] = goal === 'visual_reference_search'
      ? ['xiaohongshu']
      : []
    if (
      goal === 'visual_reference_search'
      && !(await ensureBrowserResearchAccess(true))
    ) return
    const requestId = hydrateRequestRef.current + 1
    hydrateRequestRef.current = requestId
    try {
      const run = await apiClient.startResearch({
        workspaceId: activeWorkspaceId,
        question,
        referenceUrl,
        files,
        goal,
        mode: goal === 'visual_reference_search' ? 'quick' : mode,
        researchSources,
        subquestions,
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
      setWorkspaceCreateOpen(false)
      setResearchOptionsOpen(false)
    } catch (error) {
      if (hydrateRequestRef.current === requestId) setActionError(apiMessage(error))
    }
  }

  async function handleResearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setActionError('')
    if (demoMode) {
      setAnnouncement(
        goal === 'visual_reference_search'
          ? '图纸灵感检索已开始（本地演示）'
          : `${modeLabels[mode]} 模式研究已开始（本地演示）`,
      )
      setComposerOpen(false)
      return
    }
    const projectBrief = goal === 'precedent_research'
      ? files.find((file) => file.name.toLowerCase().endsWith('.pdf'))
      : undefined
    if (projectBrief) {
      setBriefReviewLoading(true)
      try {
        const review = await apiClient.reviewProjectBrief({
          workspaceId: activeWorkspaceId,
          question,
          mode,
          file: projectBrief,
        })
        await startResearchRun(review.subquestions)
      } catch (error) {
        setActionError(`任务书读取失败：${apiMessage(error)}`)
      } finally {
        setBriefReviewLoading(false)
      }
      return
    }
    await startResearchRun()
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
        endpoint: resolveBrowserEndpoint(),
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
            : '与 Chrome 的连接没有完成。请点击“连接 Chrome 读取高清图纸”重新连接。',
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
    url.searchParams.delete('attempt')
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
    void handleConnectBrowser(false)
  }, [browserConnected, browserConnecting, chromeConnectRequested, demoMode, handleConnectBrowser])

  async function ensureBrowserResearchAccess(requireConnected = false) {
    if (requireConnected && xiaohongshuSearchAvailable) {
      setBrowserPairingStatus('')
      return true
    }
    if (browserConnected !== true) {
      if (requireConnected) {
        setActionError('小红书研究需要已登录的小红书账号。请先在 Chrome 登录小红书并连接 ArchResearch，再开始研究。')
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
          setActionError('小红书研究需要已登录的小红书账号。请先在 Chrome 登录小红书并连接 ArchResearch，再开始研究。')
          return false
        }
        setBrowserPairingStatus('当前页面未检测到 Chrome 扩展；本次将继续研究公开网页，并跳过登录页面和当前页面的高清图纸读取。')
        return true
      }
      setActionError('无法向扩展确认网页读取权限。请在已安装扩展的 Chrome 中打开本页。')
      return false
    }
    setActionError('Chrome 首次使用需要你确认网页读取权限。连接会自动完成，无需输入任何代码；请点击浏览器工具栏的 ArchResearch，选择“允许网页读取”，再回来开始研究。授权后不会每次重复询问。')
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
      setCollectionSelections((current) => current.filter((item) => item.resultId !== resultId))
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
    const previousCollectionSaveSucceeded = collectionSaveSucceeded
    const addsUnsavedResult = !comparisonIds.includes(resultId) && !savedIds.includes(resultId)
    const next = comparisonIds.includes(resultId)
      ? comparisonIds.filter((id) => id !== resultId)
      : comparisonIds.length < 6
        ? [...comparisonIds, resultId]
        : comparisonIds
    if (next === comparisonIds) return
    const previous = comparisonIds
    setComparisonIds(next)
    if (addsUnsavedResult) setCollectionSaveSucceeded(false)
    setLastExport(null)
    if (demoMode || !activeRun) return
    try {
      await apiClient.updateBoard(activeRun.id, next)
    } catch (error) {
      setComparisonIds(previous)
      setCollectionSaveSucceeded(previousCollectionSaveSucceeded)
      setActionError(`对比选择未保存：${apiMessage(error)}`)
    }
  }

  async function toggleCaseCollection(resultId: string, subquestionId?: string) {
    const key = collectionSelectionKey(resultId, subquestionId)
    const isSelected = collectionSelections.some((item) => item.key === key)
    const nextSelections = isSelected
      ? collectionSelections.filter((item) => item.key !== key)
      : collectionSelections.length < 6
        ? [...collectionSelections, { key, resultId, subquestionId }]
        : collectionSelections
    if (nextSelections === collectionSelections) return
    const previousSelections = collectionSelections
    const previousComparison = comparisonIds
    const nextComparison = isSelected && !nextSelections.some((item) => item.resultId === resultId)
      ? comparisonIds.filter((id) => id !== resultId)
      : comparisonIds.includes(resultId)
        ? comparisonIds
        : [...comparisonIds, resultId]
    const previousCollectionSaveSucceeded = collectionSaveSucceeded
    setCollectionSelections(nextSelections)
    setComparisonIds(nextComparison)
    if (!isSelected) setCollectionSaveSucceeded(false)
    setLastExport(null)
    if (demoMode || !activeRun) return
    try {
      await apiClient.updateBoard(activeRun.id, nextComparison)
    } catch (error) {
      setCollectionSelections(previousSelections)
      setComparisonIds(previousComparison)
      setCollectionSaveSucceeded(previousCollectionSaveSucceeded)
      setActionError(`选择未保存：${apiMessage(error)}`)
    }
  }

  async function handleExport(exportMode: 'private' | 'share') {
    if (!boardId || comparisonIds.length === 0) return
    try {
      const exported = await apiClient.exportBoard(boardId, exportMode)
      setLastExport(exported)
      setAnnouncement(exportMode === 'private'
        ? `${isVisualResearch ? '图纸整理版' : '策略矩阵'}已生成`
        : `${isVisualResearch ? '分享来源板' : '分享结果板'}已生成`)
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
        texture: styleProfile.texture,
        font_category: styleProfile.fontCategory,
        layout_notes: styleProfile.layoutNotes,
      })
      setStyleStatus('表达规范已保存')
    } catch (error) {
      setStyleStatus('')
      setActionError(`表达规范未保存：${apiMessage(error)}`)
    }
  }

  function selectResearchGoal(nextGoal: ResearchGoal) {
    if (nextGoal !== goal) {
      setReferenceUrl('')
      setFiles([])
      setResearchOptionsOpen(false)
    }
    setGoal(nextGoal)
  }

  function applyProblemStarter(prompt: string, starterGoal: ResearchGoal) {
    setQuestion(prompt)
    selectResearchGoal(starterGoal)
    questionInputRef.current?.focus()
  }

  function returnHome() {
    hydrateRequestRef.current += 1
    setPollingRunId('')
    setActiveRun(null)
    setAnnouncement('')
    setLastExport(null)
    if (!collectionOpen) {
      setQuestion('')
      setReferenceUrl('')
      setFiles([])
    }
    setCollectionOpen(false)
    setDataManagementOpen(false)
    setCollectionView('precedent')
    setSelectedCollectionSubquestion(null)
    setCollectionSaveSucceeded(false)
    setComposerOpen(true)
    setResearchOptionsOpen(false)
    setWorkspaceCreateOpen(false)
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
  const isVisualResearch = activeRun?.goal === 'visual_reference_search'
  const currentStageLabels = isVisualResearch ? visualStageLabels : stageLabels
  const currentStageDescriptions = isVisualResearch
    ? visualActiveStageDescriptions
    : activeStageDescriptions
  const researchSubquestions = demoMode
    ? (demoProfile?.subquestions ?? [])
    : activeRun?.subquestions.length
      ? activeRun.subquestions
      : fallbackSubquestions(results, researchQuestion)
  const displayResearchSubquestions = isVisualResearch
    ? researchSubquestions.map((subquestion, index) => {
        const legacyQuestionShape = /^(哪些|如何|怎样|什么|是否|能否)|[?？]$/.test(
          subquestion.question.trim(),
        )
        if (!legacyQuestionShape) return subquestion
        return {
          ...subquestion,
          question: `旧版灵感分组 ${index + 1}`,
          rationale: '这条历史任务按旧规则生成；重新查找会围绕你指定的图纸类型比较不同风格。',
        }
      })
    : researchSubquestions
  const visualInspirationResults = visibleResults.filter((result) => visualPlatformName(result.sourceUrl))
  const visualInspirationNoteCount = new Set(
    visualInspirationResults.map((result) => result.sourceUrl),
  ).size
  const caseResults = visibleResults.filter(
    (result) => !visualPlatformName(result.sourceUrl) && result.analysisReady,
  )
  const subquestionSummaries = displayResearchSubquestions.map((subquestion) => {
    const assets = results.filter(
      (result) => supportsSubquestion(result, subquestion.id, researchSubquestions),
    )
    const caseAssets = assets.filter((result) => !visualPlatformName(result.sourceUrl))
    const inspirationAssets = assets.filter((result) => visualPlatformName(result.sourceUrl))
    return {
      ...subquestion,
      caseAssetCount: caseAssets.length,
      inspirationCount: inspirationAssets.length,
      projectCount: new Set(caseAssets.map((result) => result.project)).size,
      passCount: activeRun?.coverageReport?.subquestion_passes?.[subquestion.id],
    }
  })
  const unassignedResults = caseResults.filter((result) => (
    !researchSubquestions.some((subquestion) => (
      supportsSubquestion(result, subquestion.id, researchSubquestions)
    ))
  ))
  const groupingSubquestions = [
    ...displayResearchSubquestions,
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
      : caseResults.filter(
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
      const analysis = analysisFor(primary, subquestion.id)
      return {
        project,
        assets: projectAssets,
        primary,
        analysis,
        previewCopy: projectPreviewCopy(projectAssets, analysis, subquestion.id),
      }
    })
    const questionSummary = unassigned || dossiers.length === 0
      ? null
      : {
          statement: uniqueSummaryItems(
            dossiers.map((dossier) => dossier.analysis.designMechanism),
            1,
          )[0],
        }
    return {
      index,
      subquestion,
      assets,
      dossiers,
      questionSummary,
      unassigned,
    }
  })
  const unassignedInspiration = visualInspirationResults.filter((result) => (
    !researchSubquestions.some((subquestion) => (
      supportsSubquestion(result, subquestion.id, researchSubquestions)
    ))
  ))
  const inspirationGroups = [
    ...displayResearchSubquestions,
    ...(unassignedInspiration.length > 0
      ? [{
          id: 'unassigned-inspiration',
          question: '待归组的制图灵感',
          rationale: '这些图片已完成图纸识别，但还没有确认它对应哪个灵感方向。',
        }]
      : []),
  ].map((subquestion) => {
    const assets = subquestion.id === 'unassigned-inspiration'
      ? unassignedInspiration
      : visualInspirationResults.filter(
          (result) => supportsSubquestion(result, subquestion.id, researchSubquestions),
        )
    const typeGroups = [...assets.reduce((types, result) => {
      const current = types.get(result.assetType) ?? []
      current.push(result)
      types.set(result.assetType, current)
      return types
    }, new Map<AssetType, WorkResult[]>()).entries()].map(([assetType, typeAssets]) => ({
      assetType,
      assets: typeAssets,
    }))
    const noteGroups = [...assets.reduce((notes, result) => {
      const current = notes.get(result.sourceUrl) ?? []
      current.push(result)
      notes.set(result.sourceUrl, current)
      return notes
    }, new Map<string, WorkResult[]>()).entries()].map(([sourceUrl, noteAssets]) => ({
      sourceUrl,
      assets: noteAssets,
      primary: noteAssets[0],
      observation: uniqueSummaryItems(
        noteAssets.map((result) => analysisFor(result, subquestion.id).observation),
        1,
      )[0] ?? '',
      relevance: Math.max(...noteAssets.map((result) => result.relevance)),
    }))
    return { subquestion, assets, typeGroups, noteGroups }
  }).filter((group) => group.assets.length > 0)
  const selectedComparisonResults = results.filter((result) => comparisonIds.includes(result.id))
  const selectedPendingCollectionCount = isVisualResearch
    ? comparisonIds.filter((id) => !savedIds.includes(id)).length
    : collectionSelections.length
  const collectionSections = [
    {
      key: 'precedent',
      title: '建筑方案',
      items: personalCollections.filter((item) => item.snapshot.goal !== 'visual_reference_search'),
    },
    {
      key: 'visual',
      title: '图纸灵感',
      items: personalCollections.filter((item) => item.snapshot.goal === 'visual_reference_search'),
    },
  ].map((section) => ({
    ...section,
    groups: [...section.items.reduce((groups, item) => {
      const question = item.snapshot.question?.trim() || '未归类的历史收藏'
      const current = groups.get(question) ?? []
      current.push(item)
      groups.set(question, current)
      return groups
    }, new Map<string, PersonalCollection[]>()).entries()],
  }))
  const activeCollectionSection = collectionSections.find((section) => section.key === collectionView)
  const collectionQuestionDirectory = activeCollectionSection?.key === 'precedent'
    ? activeCollectionSection.groups.flatMap(([collectionQuestion, items]) => (
        collectionCaseGroups(items).map((group) => ({ collectionQuestion, group }))
      ))
    : []
  const activeCollectionSubquestion = selectedCollectionSubquestion
    ? collectionQuestionDirectory.find(({ collectionQuestion, group }) => (
        collectionQuestion === selectedCollectionSubquestion.collectionQuestion
        && group.id === selectedCollectionSubquestion.subquestionId
      ))
    : null
  const selectedProjectCount = new Set(
    selectedComparisonResults.map((result) => result.project.trim().toLocaleLowerCase()),
  ).size
  const privateExportDisabled = isVisualResearch
    ? comparisonIds.length === 0
    : selectedProjectCount < 2
  const selectedPreviewUrl = selectedResult
    ? availablePreviewUrl(selectedResult, failedPreviewUrls)
    : null
  const selectedPreviewLoadFailed = Boolean(
    selectedResult?.previewUrl && failedPreviewUrls[selectedResult.id] === selectedResult.previewUrl,
  )
  const comparisonFocuses = [...new Set(selectedComparisonResults.map((result) => comparisonFocusLabels[result.assetType]))]
  const comparisonOverview = comparisonFocuses.length === 1
    ? `这 ${selectedComparisonResults.length} 项都在回答“${comparisonFocuses[0]}”，重点比较“可借鉴方法”“图中看到”和“适用条件”这几行。`
    : `这 ${selectedComparisonResults.length} 项分别覆盖“${comparisonFocuses.join('、')}”。它们更适合组合使用，而不是选一个“赢家”。`
  const recommendedComparisonResult = selectedComparisonResults[0]
  const activeStatus = activeRun?.status
  const isRunActive = activeStatus ? !terminalStatuses.has(activeStatus) : false
  const activeStageIndex = activeStatus
    ? currentStageLabels.findIndex((stage) => stage.status === activeStatus)
    : -1
  const resultViewOpen = !composerOpen && !collectionOpen && !dataManagementOpen
  const homeViewOpen = composerOpen && !collectionOpen && !dataManagementOpen
  const activePartialDiagnosis = activeRun && ['partial', 'blocked'].includes(activeRun.status)
    ? partialDiagnosis(activeRun)
    : null
  const activeSynthesis = activeRun?.coverageReport?.synthesis
  const synthesisOverview = activeSynthesis ? researchSynthesisOverview(activeSynthesis) : null
  const synthesisBoundary = activeSynthesis
    ? firstUserFacingBoundary(activeSynthesis.applicability_boundaries.map((item) => item.statement))
    : ''
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
    ? `${usableResultCount} 条可用参考 · ${pendingLeadCount} 条只作线索`
    : `${usableResultCount} 条可用参考`
  const currentWorkspaceName = workspaces.find(({ id }) => id === activeWorkspaceId)?.name
    ?? '未选择项目'
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
  const researchEnvironmentReady = xiaohongshuSearchAvailable || browserReadinessState === 'ready'
  const researchEnvironmentTitle = browserReadinessState === 'loading'
    ? '正在检查研究环境'
    : researchEnvironmentReady
      ? '研究环境已就绪'
      : browserReadinessState === 'unknown'
        ? '研究环境状态未知'
        : '研究环境待连接'
  const researchEnvironmentDetail = xiaohongshuSearchAvailable
    ? browserReadinessState === 'ready'
      ? '小红书可用 · 可读取当前页面高清图纸'
      : browserReadinessState === 'permission'
        ? '小红书可用 · 读取页面高清图纸需授权'
        : browserReadinessState === 'loading'
          ? '小红书可用 · 正在检查页面图纸读取'
          : '小红书可用 · 未启用页面高清图纸读取'
    : {
    loading: '正在检查 Chrome 与网页权限',
    unknown: '连接状态未读取，请稍后刷新',
    disconnected: '连接 Chrome 后可读取小红书和当前页面高清图纸',
    'surface-missing': '当前页面未检测到扩展',
    'surface-disconnected': '当前页面扩展未连通',
    permission: '读取页面高清图纸需授权：点击浏览器工具栏的 ArchResearch，选择“允许网页读取”，再点“刷新”',
    ready: '可读取当前页面高清图纸 · 在 Chrome 登录小红书后可搜索笔记',
  }[browserReadinessState]
  const showBrowserConnectAction = !browserReadinessLoading
    && (browserConnected !== true || !browserBridgeAvailable)

  return (
    <main className="research-desk" data-view={dataManagementOpen ? 'data' : collectionOpen ? 'collection' : resultViewOpen ? 'results' : 'home'} aria-label="建筑研究画板">
      <StudioBackdrop view={resultViewOpen ? 'results' : 'home'} />
      <header className="app-header">
        <div className="app-brand">
          <span className="brand-mark" aria-hidden="true"><LayoutGrid /></span>
          <div><strong>ArchResearch</strong><span>{demoMode ? `演示数据 · ${modeLabels[mode]}研究` : '本地研究工具'}</span></div>
        </div>
        <div className="header-actions">
          {homeViewOpen && !demoMode && (
            <button
              className="icon-text-button"
              type="button"
              onClick={() => {
                setActionError('')
                setDataStatus('')
                setDataManagementOpen(true)
              }}
            >
              <HardDriveDownload aria-hidden="true" />备份与恢复
            </button>
          )}
          {homeViewOpen && !demoMode && (
            <button
              className="icon-text-button"
              type="button"
              disabled={!activeWorkspaceId}
              onClick={(event) => void openPersonalCollections(event.currentTarget)}
            >
              <Bookmark aria-hidden="true" />个人收藏
            </button>
          )}
          {(recentRuns.length > 0 || (demoMode && results.length > 0)) && homeViewOpen && (
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
          {(dataManagementOpen || collectionOpen || (resultViewOpen && !isRunActive)) && (
            <button className="result-new-research" type="button" onClick={returnHome}>
              <ArrowLeft aria-hidden="true" />返回主页
            </button>
          )}
        </div>
      </header>

      <section className="board-workspace" aria-label="研究工作区">
        {dataManagementOpen && (
          <section className="data-management-page" aria-labelledby="data-management-title">
            <header className="data-management-heading">
              <div>
                <h1 id="data-management-title">工作区数据</h1>
                <p>备份项目、研究记录、收藏图片、任务书和导出文件。服务配置与登录凭据不会进入备份。</p>
              </div>
              <ShieldCheck aria-hidden="true" />
            </header>

            <section className="data-management-section" aria-labelledby="backup-heading">
              <div className="data-management-copy">
                <h2 id="backup-heading">完整备份</h2>
                <p>生成一个带文件清单和 SHA-256 校验的 ZIP，可用于迁移或故障恢复。</p>
              </div>
              <button
                className="primary-action"
                type="button"
                disabled={Boolean(dataOperation) || isRunActive}
                onClick={() => void handleDownloadBackup()}
              >
                <HardDriveDownload aria-hidden="true" />
                {dataOperation === 'backup' ? '正在生成…' : '下载完整备份'}
              </button>
            </section>

            <section className="data-management-section data-restore-section" aria-labelledby="restore-heading">
              <div className="data-management-copy">
                <h2 id="restore-heading">校验并恢复</h2>
                <p>先检查格式、版本、路径、文件哈希和 SQLite；预检失败不会修改当前数据。</p>
              </div>
              <div className="data-restore-controls">
                <label htmlFor="workspace-backup-file">选择 ArchResearch 备份包</label>
                <input
                  id="workspace-backup-file"
                  type="file"
                  accept=".zip,application/zip"
                  disabled={Boolean(dataOperation)}
                  onChange={(event) => {
                    setBackupFile(event.target.files?.[0] ?? null)
                    setBackupPreflight(null)
                    setDataStatus('')
                    setActionError('')
                  }}
                />
                <button
                  type="button"
                  disabled={!backupFile || Boolean(dataOperation) || isRunActive}
                  onClick={() => void handleBackupPreflight()}
                >
                  <Upload aria-hidden="true" />
                  {dataOperation === 'preflight' ? '正在检查…' : '检查备份包'}
                </button>
              </div>

              {backupPreflight?.ready && (
                <section className="backup-preflight-result" aria-label="备份预检通过">
                  <header><Check aria-hidden="true" /><strong>备份完整，可以恢复</strong></header>
                  <ul>
                    <li><strong>{backupPreflight.workspace_count} 个项目</strong></li>
                    <li><strong>{backupPreflight.run_count} 条研究记录</strong></li>
                    <li><strong>{backupPreflight.collection_count} 项个人收藏</strong></li>
                    <li><strong>{backupPreflight.input_artifact_count} 份任务书或附件</strong></li>
                  </ul>
                  <p>恢复时会先为当前数据生成回滚备份；只有全部文件交换成功后才会启用新数据。</p>
                  <button
                    className="danger-action"
                    type="button"
                    disabled={Boolean(dataOperation) || isRunActive}
                    onClick={() => void handleRestoreBackup()}
                  >
                    <Upload aria-hidden="true" />
                    {dataOperation === 'restore' ? '正在恢复…' : '确认恢复'}
                  </button>
                </section>
              )}
            </section>

            {dataStatus && <p className="data-operation-status" aria-live="polite"><Check aria-hidden="true" />{dataStatus}</p>}
          </section>
        )}

        {homeViewOpen && (
          <section className="research-composer" aria-label="新建研究">
            <header>
              <div>
                <h1>从一个卡住你的地方开始</h1>
                <p>空间、流线、剖面或表达，说具体一点就够了。也可以直接附上草图、图纸、PDF 或网页。</p>
              </div>
            </header>
            <form className="research-form" onSubmit={(event) => void handleResearchSubmit(event)}>
              <div className="research-entry-switch" role="group" aria-label="功能入口">
                <button
                  type="button"
                  aria-pressed={goal !== 'visual_reference_search'}
                  onClick={() => selectResearchGoal('precedent_research')}
                >
                  <LayoutGrid aria-hidden="true" />
                  <span><strong>建筑设计研究</strong><small>项目案例与设计策略</small></span>
                </button>
                <button
                  type="button"
                  aria-pressed={goal === 'visual_reference_search'}
                  onClick={() => selectResearchGoal('visual_reference_search')}
                >
                  <Eye aria-hidden="true" />
                  <span><strong>图纸灵感</strong><small>配色、线型、版式与分析图</small></span>
                </button>
              </div>
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
              {goal === 'precedent_research' && (
                <div className="research-method">
                  <fieldset className="segmented-control research-depth-options">
                    <legend>研究方式</legend>
                    <p className="research-source-note">案例来自多家建筑媒体的轮流检索，只收录文章内容完整的项目。</p>
                    {(Object.keys(modeLabels) as ResearchMode[]).map((value) => (
                      <label key={value}>
                        <input
                          type="radio"
                          name="mode"
                          value={value}
                          checked={mode === value}
                          onChange={() => setMode(value)}
                        />
                        <strong>{modeLabels[value]}</strong>
                        <span>{researchDepthOptions[value].coverage}</span>
                      </label>
                    ))}
                  </fieldset>
                  <p className="research-depth-selection-note" aria-live="polite">
                    {researchDepthOptions[mode].target}
                  </p>
                </div>
              )}
              <div className="research-form-footer">
                <div className="research-quick-actions">
                  {goal === 'precedent_research' && (
                    <button
                      type="button"
                      aria-expanded={researchOptionsOpen}
                      onClick={() => setResearchOptionsOpen((current) => !current)}
                    >
                      <Paperclip aria-hidden="true" />添加任务书或案例页（可选）
                    </button>
                  )}
                  {goal !== 'visual_reference_search' && files.length > 0 && (
                    <span>{files.length} 个文件待上传</span>
                  )}
                  <ClickSpark className="research-submit-spark" duration={300} sparkRadius={12} sparkSize={6}>
                    <button
                      className="research-submit"
                      type="submit"
                      disabled={briefReviewLoading || isRunActive || loading || (!demoMode && !activeWorkspaceId)}
                    >
                      {isRunActive
                        ? '研究进行中…'
                        : briefReviewLoading
                          ? '正在准备研究…'
                        : <><span>{goal === 'visual_reference_search'
                          ? '查找灵感'
                          : '开始研究'}</span><ArrowUp aria-hidden="true" /></>}
                    </button>
                  </ClickSpark>
                </div>
              </div>
              {goal === 'precedent_research' && researchOptionsOpen && (
                <section className="research-options" aria-label="可选项目资料">
                  <p className="research-options-intro">
                    任务书用于收束研究范围，案例页用于补充参考线索；都不填也可以继续。
                  </p>
                  <div className="research-field">
                    <label htmlFor="project-brief-files">项目任务书（PDF）</label>
                    <p className="research-field-help" id="project-brief-files-help">
                      系统会先读取场地、功能与限制，把它们作为问题拆解和案例检索的边界。
                    </p>
                    <input
                      id="project-brief-files"
                      type="file"
                      aria-describedby="project-brief-files-help"
                      accept=".pdf,application/pdf"
                      onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
                    />
                  </div>
                  <div className="research-field">
                    <label htmlFor="project-reference-url">指定案例或项目网页</label>
                    <p className="research-field-help" id="project-reference-url-help">
                      把已有页面作为研究线索；系统仍会继续检索其他案例。
                    </p>
                    <input
                      id="project-reference-url"
                      type="url"
                      aria-describedby="project-reference-url-help"
                      value={referenceUrl}
                      onChange={(event) => setReferenceUrl(event.target.value)}
                      placeholder="https://"
                    />
                  </div>
                </section>
              )}
              {!demoMode && goal === 'visual_reference_search' && (
                <section className="research-preflight" aria-label="研究环境">
                  <header className="research-preflight-header">
                    <div className="research-preflight-title">
                      {researchEnvironmentReady ? <Check aria-hidden="true" /> : <CircleDashed aria-hidden="true" />}
                      <div>
                        <strong>{researchEnvironmentTitle}</strong>
                        <span aria-live="polite">{researchEnvironmentDetail}</span>
                      </div>
                    </div>
                    <div className="research-preflight-actions">
                      {showBrowserConnectAction && (
                        <button type="button" disabled={browserConnecting} onClick={() => void handleConnectBrowser()}>
                          <MonitorUp aria-hidden="true" />{browserConnecting ? '正在连接 Chrome…' : '连接 Chrome 读取高清图纸'}
                        </button>
                      )}
                      <button
                        className="research-preflight-refresh"
                        type="button"
                        aria-label="刷新环境状态"
                        disabled={browserReadinessLoading}
                        onClick={() => void refreshBrowserReadiness()}
                      >
                        <RefreshCw aria-hidden="true" /><span aria-hidden="true">{browserReadinessLoading ? '检查中…' : '刷新'}</span>
                      </button>
                    </div>
                  </header>
                  {(browserReadinessError || browserPairingStatus) && (
                    <p className="research-preflight-message" aria-live="polite">
                      {browserReadinessError ? '连接状态没有读取到。请点“刷新”重试；如果反复失败，请关闭并重新打开 ArchResearch。' : browserPairingStatus}
                    </p>
                  )}
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

        {homeViewOpen && (
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
                  <p>{demoMode ? '继续尚未结束或已经完成的任务。' : '按问题查看尚未结束或已经完成的研究记录。'}</p>
                </div>
                {!demoMode && (
                  <div className="workspace-actions">
                    <span className="visually-hidden" aria-hidden="true">{currentWorkspaceName}</span>
                    <button className="icon-text-button" type="button" onClick={() => {
                      setWorkspaceCreateOpen((current) => !current)
                    }}>
                      {workspaceCreateOpen ? <X aria-hidden="true" /> : <FolderPlus aria-hidden="true" />}
                      {workspaceCreateOpen ? '取消新建' : '新建项目'}
                    </button>
                    {workspaceCreateOpen && (
                      <form className="workspace-create" onSubmit={(event) => void handleCreateWorkspace(event)}>
                        <label htmlFor="workspace-name">项目名称</label>
                        <input
                          id="workspace-name"
                          value={newWorkspaceName}
                          onChange={(event) => setNewWorkspaceName(event.target.value)}
                          placeholder="例如：毕业设计 / 城市更新"
                          autoFocus
                        />
                        <button type="submit" disabled={!newWorkspaceName.trim()}>创建项目</button>
                      </form>
                    )}
                  </div>
                )}
              </header>
              {recentRuns.length > 0 ? (
                <div className="recent-history" role="region" aria-label="研究记录" tabIndex={0}>
                  <RunHistoryList
                    runs={recentRuns}
                    onOpen={(run) => void openRun(run)}
                    onRetentionChange={(run) => void handleRunRetention(run)}
                    retentionUpdatingId={retentionUpdatingId}
                  />
                </div>
              ) : (
                <p className="recent-empty">{loading ? '正在读取最近任务…' : '完成第一次研究后，最近任务会保留在这里。'}</p>
              )}
            </section>
          </section>
        )}

        {resultViewOpen && (announcement || activeRun) && (
          isVisualResearch || isRunActive || activeRun?.status !== 'completed'
        ) && (
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
              {isRunActive && <details>
                <summary>查看研究进度</summary>
                <ol className="stage-list">
                  {currentStageLabels.map((stage) => (
                    <li key={stage.status} aria-current={activeStatus === stage.status ? 'step' : undefined}>{stage.label}</li>
                  ))}
                </ol>
              </details>}
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

        {!demoMode && resultViewOpen && isVisualResearch && allResultsMissingPreviews && (
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
                  <MonitorUp aria-hidden="true" />{browserConnecting ? '正在打开 Chrome…' : '在 Chrome 中连接图纸提取扩展'}
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
                <span>{isVisualResearch ? '正在寻找图纸灵感 · 完成后结果会自动显示在这里' : '正在研究这个问题 · 完成后结果会自动显示在这里'}</span>
                <h1>{activeRun.question}</h1>
                <p>{activeStatus ? currentStageDescriptions[activeStatus] : isVisualResearch ? '正在准备灵感检索' : '正在准备研究任务'}</p>
              </header>
              <ol className="active-stage-track" aria-label="研究阶段">
                {currentStageLabels.slice(0, -1).map((stage, index) => (
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
                  <h2 id="active-subquestions-title">
                    {isVisualResearch
                      ? `正在探索 ${activeRun.subquestions.length} 个灵感方向`
                      : `已经拆成 ${activeRun.subquestions.length} 个证据问题`}
                  </h2>
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
              <h2>{isVisualResearch ? '换一种图纸类型或风格描述再找' : '从一个具体设计问题开始'}</h2>
              <p>{isVisualResearch
                ? '可以写“剖面图风格”“效果图怎么出”，也可以补充线稿、拼贴、材质或配色偏好。'
                : '描述需要解决的空间、流线、更新或图纸表达问题，研究结果会按来源依据整理到这里。'}</p>
            </section>
          )
        )}

        {resultViewOpen && results.length > 0 && (
          <section className="results-section" aria-label="研究结果">
            <header className="result-task-heading">
              <span>{demoMode ? `${modeLabels[mode]}研究演示` : '本次研究任务'}</span>
              <h1>{researchQuestion}</h1>
              {isVisualResearch && <p>这次只比较图纸的画面表达，并保留每张图的原笔记来源。</p>}
              {demoMode && (
                <div className="demo-depth-contract" role="group" aria-label={`${modeLabels[mode]}研究深度说明`}>
                  <strong>{modeLabels[mode]}研究</strong>
                  <span>{researchDepthOptions[mode].coverage}</span>
                  <span>{researchDepthOptions[mode].target}</span>
                  <small>固定回放 · 展示完整结果结构</small>
                </div>
              )}
            </header>

            {activeSynthesis && (
              <section className="research-synthesis" aria-label="研究结论">
                <header>
                  <span>{isVisualResearch ? `${modeLabels[activeRun?.mode ?? mode]}研究结论` : '研究结论'}</span>
                  <h2 id="research-synthesis-title">{synthesisOverview?.headline}</h2>
                  {isVisualResearch && <small>
                    {synthesisOverview?.isFallback && '已核对原文的本地整理 · '}
                    {!synthesisOverview?.isFallback && synthesisOverview?.isProjected && '已从完整综合中提炼主要结论 · '}
                    {activeSynthesis.answer.evidence_asset_ids.length} 条原文引文直接支撑
                  </small>}
                </header>
                <div className="synthesis-primary" data-answer-only={!isVisualResearch || undefined}>
                  {isVisualResearch && <section>
                    <h3>关键推演</h3>
                    <ul>
                      {activeSynthesis.causal_chains.map((finding) => (
                        <li key={finding.statement}>
                          <span>{finding.statement}</span>
                          <small>{finding.evidence_asset_ids.length} 条证据</small>
                        </li>
                      ))}
                    </ul>
                  </section>}
                  <section>
                    <h3>{isVisualResearch ? '落地建议' : '优先做法'}</h3>
                    <ol>
                      {synthesisOverview?.actions.map((finding) => (
                        <li key={finding.statement}>
                          <span>{finding.statement}</span>
                          {isVisualResearch && <small>{finding.evidence_asset_ids.length} 条证据</small>}
                        </li>
                      ))}
                    </ol>
                  </section>
                  {!isVisualResearch && synthesisBoundary && (
                    <p className="synthesis-boundary">
                      <strong>适用条件</strong>
                      <span>{synthesisBoundary}</span>
                    </p>
                  )}
                </div>
                {isVisualResearch && (synthesisOverview?.isProjected
                  || activeSynthesis.comparisons.length > 0
                  || activeSynthesis.conflicts.length > 0
                  || activeSynthesis.applicability_boundaries.length > 0) && (
                  <details className="synthesis-audit">
                    <summary>
                      {synthesisOverview?.isProjected
                        ? '查看完整综合、比较与适用边界'
                        : '查看比较、冲突与适用边界'}
                    </summary>
                    <div>
                      {synthesisOverview?.isProjected && (
                        <section className="synthesis-original">
                          <h3>完整综合原文</h3>
                          <p>{synthesisOverview.rawStatement}</p>
                        </section>
                      )}
                      {activeSynthesis.comparisons.length > 0 && (
                        <section>
                          <h3>跨案例比较</h3>
                          <ul>{activeSynthesis.comparisons.map((item) => <li key={item.statement}>{item.statement}</li>)}</ul>
                        </section>
                      )}
                      {activeSynthesis.conflicts.length > 0 && (
                        <section>
                          <h3>冲突与不确定性</h3>
                          <ul>{activeSynthesis.conflicts.map((item) => <li key={item.statement}>{item.statement}</li>)}</ul>
                        </section>
                      )}
                      {activeSynthesis.applicability_boundaries.length > 0 && (
                        <section>
                          <h3>适用与失效边界</h3>
                          <ul>{activeSynthesis.applicability_boundaries.map((item) => <li key={item.statement}>{item.statement}</li>)}</ul>
                        </section>
                      )}
                    </div>
                  </details>
                )}
              </section>
            )}

            {isVisualResearch && <section className="question-decomposition" aria-label="灵感方向">
              <h2 className="visually-hidden">{isVisualResearch ? '图纸灵感方向' : '研究给出的方向'}</h2>
              <header className="section-heading">
                <div>
                  <h2>{isVisualResearch ? '灵感方向' : '问题拆解'}</h2>
                  <p>{isVisualResearch
                    ? '围绕你指定的图纸类型整理不同风格，方便比较哪种画法更适合当前任务。'
                    : subquestionSummaries.every((item) => item.caseAssetCount + item.inspirationCount > 0)
                      ? '每个子问题都已找到方案证据或制图灵感；两类结果分开整理，按当前任务选择使用。'
                      : '完整结果会覆盖每个子问题；当前没有证据的分支会明确保留，方便继续补研。'}</p>
                </div>
                <span>{researchSubquestions.length} 个{isVisualResearch ? '方向' : '子问题'}</span>
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
                      {isVisualResearch
                        ? subquestion.inspirationCount > 0
                          ? `${subquestion.inspirationCount} 张灵感图`
                          : '暂未找到可用灵感'
                        : <>
                            {subquestion.projectCount} 个方案项目
                            {subquestion.caseAssetCount > 0 && ` · ${subquestion.caseAssetCount} 条案例证据`}
                            {subquestion.inspirationCount > 0 && ` · ${subquestion.inspirationCount} 张灵感图`}
                          </>}
                    </span>
                  </li>
                ))}
              </ol>
            </section>}

            {visualInspirationResults.length > 0 && (
              <section className="visual-inspiration-board" aria-label="视觉灵感板">
                <header className="visual-inspiration-heading section-heading">
                  <div>
                    <h2>小红书制图灵感</h2>
                    <p>{isVisualResearch
                      ? '按灵感方向和帖子整理，每篇集中展示多张图；只比较画面表达，不用于确认项目事实或图纸权利。'
                      : '只作视觉参考：按问题和图纸类型整理可见表达，帮助判断“图怎么出”，不用于确认项目事实或图纸权利。'}</p>
                  </div>
                  <span>{visualInspirationNoteCount} 篇帖子 · {visualInspirationResults.length} 张灵感图</span>
                </header>

                <div className="inspiration-question-groups">
                  {inspirationGroups.map((group) => (
                    <section
                      className="inspiration-question"
                      key={group.subquestion.id}
                      aria-labelledby={`inspiration-question-${group.subquestion.id}`}
                    >
                      <header className="inspiration-question-heading">
                        <div>
                          <h3 id={`inspiration-question-${group.subquestion.id}`}>{group.subquestion.question}</h3>
                          <p>{group.subquestion.rationale}</p>
                        </div>
                        <span>{group.noteGroups.length} 篇 · {group.assets.length} 张</span>
                      </header>

                      <div className="inspiration-type-index" aria-label="图纸类型">
                        {group.typeGroups.map((typeGroup) => (
                          <span key={typeGroup.assetType}>
                            {assetLabels[typeGroup.assetType]} · {typeGroup.assets.length} 张
                          </span>
                        ))}
                      </div>
                      <div className="inspiration-note-list">
                        {group.noteGroups.map((note) => (
                          <article
                            className="inspiration-note"
                            key={note.sourceUrl}
                            aria-label={`灵感帖子 ${note.primary.project}`}
                          >
                            <header className="inspiration-note-heading">
                              <div>
                                <span>
                                  {visualPlatformName(note.sourceUrl) ?? '视觉平台'} · {questionRelevanceLabel(note.relevance)}
                                </span>
                                <h4>{note.primary.project}</h4>
                                {note.observation && <p>{note.observation}</p>}
                              </div>
                              <span>{note.assets.length} 张</span>
                            </header>
                            <div className="inspiration-note-grid">
                              {note.assets.map((result) => {
                                const resultIndex = results.findIndex((item) => item.id === result.id)
                                const selectedForCollection = comparisonIds.includes(result.id)
                                const previewUrl = availablePreviewUrl(result, failedPreviewUrls)
                                const previewLoadFailed = Boolean(
                                  result.previewUrl && failedPreviewUrls[result.id] === result.previewUrl,
                                )
                                return (
                                  <div className="inspiration-note-image" key={result.id}>
                                    <button
                                      className="inspiration-note-preview"
                                      type="button"
                                      aria-label={`查看制图灵感 ${result.project} ${assetLabels[result.assetType]}`}
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
                                              <strong>{previewLoadFailed ? '灵感图加载失败' : '未提取到灵感图'}</strong>
                                              <p>打开原笔记查看图片，并核对图片与文字的对应关系。</p>
                                            </div>
                                          )}
                                          <div className="evidence-image-labels">
                                            <span>{assetLabels[result.assetType]}</span>
                                          </div>
                                        </div>
                                      </figure>
                                    </button>
                                    <button
                                      className="inspiration-note-select"
                                      type="button"
                                      aria-label={selectedForCollection ? '取消收藏选择' : '选择此图用于收藏'}
                                      title={`${selectedForCollection ? '取消收藏选择' : '选择此图用于收藏'} · ${assetLabels[result.assetType]}`}
                                      aria-pressed={selectedForCollection}
                                      disabled={comparisonIds.length >= 6 && !selectedForCollection}
                                      onClick={() => void toggleComparison(result.id)}
                                    >
                                      {selectedForCollection ? <Check aria-hidden="true" /> : <Plus aria-hidden="true" />}
                                    </button>
                                  </div>
                                )
                              })}
                            </div>
                            <footer className="inspiration-note-footer">
                              <p>
                                {publicationTierLabels[note.primary.publicationTier]} · 权利 {rightsStatusLabels[note.primary.rightsStatus]}
                              </p>
                              <a href={note.sourceUrl} target="_blank" rel="noreferrer">
                                <ExternalLink aria-hidden="true" />
                                打开原笔记
                              </a>
                            </footer>
                          </article>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              </section>
            )}

            {(caseResults.length > 0 || activeRun?.goal === 'precedent_research' || demoMode) && (
            <section className="case-analysis" aria-label="案例研究结果">
              <header className="results-header section-heading">
                <div>
                  <h2>案例研究结果</h2>
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
                {caseGroups.filter((group) => !group.unassigned).map((group) => (
                  <section className="case-chapter" key={group.subquestion.id} aria-labelledby={`case-chapter-${group.subquestion.id}`}>
                    <header className="case-chapter-heading">
                      <span aria-hidden="true">{group.unassigned ? '?' : group.index + 1}</span>
                      <div>
                        <h3 id={`case-chapter-${group.subquestion.id}`}>{group.subquestion.question}</h3>
                        {group.questionSummary && (
                          <p className="case-chapter-conclusion">{group.questionSummary.statement}</p>
                        )}
                      </div>
                    </header>

                    {group.assets.length === 0 ? (
                      <div className="case-chapter-empty">
                        <strong>这一问题暂时没有可用结果</strong>
                        <p>可以换一个更具体的空间条件后重新研究。</p>
                      </div>
                    ) : <>
                      <ol className="case-answer-list" aria-label={`${group.subquestion.question}的案例结论`}>
                      {group.dossiers.map((dossier, dossierIndex) => {
                        const caseSubquestionId = group.unassigned ? undefined : group.subquestion.id
                        // The chapter conclusion is the first case's mechanism verbatim,
                        // so that one case does not read the same sentence twice in a row.
                        const mechanismIsChapterConclusion = dossierIndex === 0
                          && dossier.analysis.designMechanism.trim() === group.questionSummary?.statement
                        const selectionKey = collectionSelectionKey(dossier.primary.id, caseSubquestionId)
                        const caseSelected = collectionSelections.some((item) => item.key === selectionKey)
                        const displayProject = userFacingProjectName(dossier.project)
                        const actions = uniqueSummaryItems(dossier.analysis.transferStrategy, 3)
                        const previewResult = dossier.assets.find((result) => (
                          Boolean(availablePreviewUrl(result, failedPreviewUrls))
                        ))
                        const previewUrl = previewResult
                          ? availablePreviewUrl(previewResult, failedPreviewUrls)
                          : null
                        const identityLine = [dossier.primary.location, dossier.primary.year]
                          .filter((item) => item && !/实时网页研究|待核对|未知|未记录/.test(item))
                          .join(' · ')
                        return (
                        <li className="case-answer-item" key={dossier.project}>
                        <article className="project-dossier case-answer" aria-label={`代表案例 ${displayProject}`}>
                          <header className="dossier-heading case-answer-heading">
                            <div>
                              <h4 className="case-answer-title">{displayProject}</h4>
                              {identityLine && <p>{identityLine}</p>}
                            </div>
                            <button
                              className="dossier-select"
                              type="button"
                              aria-pressed={caseSelected}
                              aria-label={`${caseSelected ? '取消选择案例' : '选择案例'} ${displayProject}`}
                              disabled={collectionSelections.length >= 6 && !caseSelected}
                              onClick={() => void toggleCaseCollection(dossier.primary.id, caseSubquestionId)}
                            >
                              {caseSelected ? <Check aria-hidden="true" /> : <Plus aria-hidden="true" />}
                              <span>{caseSelected ? '已选择案例' : '选择案例'}</span>
                            </button>
                          </header>

                          <div className="case-answer-layout" data-has-image={Boolean(previewUrl) || undefined}>
                            <section className="case-answer-copy" aria-label={`${displayProject} 的研究结果`}>
                              {!mechanismIsChapterConclusion && (
                                <p className="case-answer-mechanism">{dossier.analysis.designMechanism}</p>
                              )}
                              {actions.length > 0 && <div className="case-answer-actions">
                                <h5>怎么做</h5>
                                <ol>{actions.map((step) => <li key={step}>{step}</li>)}</ol>
                              </div>}
                              {dossier.analysis.limitation && (
                                <p className="case-answer-boundary">
                                  <strong>适用条件</strong>
                                  <span>{dossier.analysis.limitation}</span>
                                </p>
                              )}
                            </section>
                            {previewResult && previewUrl && (
                              <figure className="case-answer-image">
                                <img
                                  src={previewUrl}
                                alt={`${displayProject} ${assetLabels[previewResult.assetType]}`}
                                  loading="lazy"
                                  decoding="async"
                                  onError={() => markPreviewFailed(previewResult.id, previewUrl)}
                                />
                                <figcaption>{assetLabels[previewResult.assetType]}</figcaption>
                              </figure>
                            )}
                          </div>

                          {isVisualResearch && <section className="dossier-evidence-set" aria-label={`${dossier.project} 项目预览`}>
                            <header>
                              <h5>项目预览</h5>
                              <span>{dossier.assets.length} 项 · 图片仅用于定位来源，机制以正文引文为准</span>
                            </header>
                            {dossier.previewCopy.shared.length > 0 && (
                              <div className="dossier-preview-copy">
                                <span>共同图面说明</span>
                                {dossier.previewCopy.shared.map((item) => <p key={item}>{item}</p>)}
                              </div>
                            )}
                            <div
                              className="dossier-gallery"
                              data-layout={dossier.assets.length === 1 ? 'single' : 'grid'}
                            >
                              {dossier.assets.map((result) => {
                                const resultIndex = results.findIndex((item) => item.id === result.id)
                                const previewCopy = dossier.previewCopy.assetCopy.get(result.id)
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
                                                {activeRun?.goal === 'precedent_research'
                                                  ? '暂无项目预览'
                                                  : previewLoadFailed
                                                  ? '项目预览加载失败'
                                                  : browserWasUnavailable
                                                  ? '此次未连接浏览器扩展，暂无项目预览'
                                                  : '暂无项目预览'}
                                              </strong>
                                              <p>打开原始来源查看完整项目；设计机制以正文引文为准。</p>
                                            </div>
                                          )}
                                          <div className="evidence-image-labels">
                                            <span>{assetLabels[result.assetType]}</span>
                                            {previewUrl && result.previewSource && (
                                              <span>{result.previewSource === 'chrome' ? 'Chrome 项目预览' : '公开网页预览'}</span>
                                            )}
                                            {previewLoadFailed && <span>来源链接</span>}
                                          </div>
                                        </div>
                                        {(previewCopy?.title || previewCopy?.observation) && (
                                          <figcaption>
                                            {previewCopy.title && <strong>{previewCopy.title}</strong>}
                                            {previewCopy.observation && <p>{previewCopy.observation}</p>}
                                          </figcaption>
                                        )}
                                      </figure>
                                    </button>
                                    <footer className="evidence-sheet-actions">
                                      <span>{questionRelevanceLabel(result.relevance)}</span>
                                      {!previewUrl && (
                                        <a
                                          className="evidence-source-action"
                                          href={result.sourceUrl}
                                          target="_blank"
                                          rel="noreferrer"
                                        >
                                          <ExternalLink aria-hidden="true" />
                                          <span>打开原始来源</span>
                                        </a>
                                      )}
                                    </footer>
                                  </div>
                                )
                              })}
                            </div>
                          </section>}

                          {isVisualResearch && <footer className="dossier-source">
                            <span>来源与权利分开记录</span>
                            <p>{publicationTierLabels[dossier.primary.publicationTier]} · 权利 {rightsStatusLabels[dossier.primary.rightsStatus]}</p>
                            <a href={dossier.primary.sourceUrl} target="_blank" rel="noreferrer">打开项目来源</a>
                          </footer>}
                        </article>
                        </li>
                        )
                      })}
                      </ol>
                    </>}
                  </section>
                ))}
              </div>
            </section>
            )}
          </section>
        )}

        {resultViewOpen && results.length > 0 && visibleResults.length === 0 && (
          <section className="empty-filter"><h2>当前筛选没有图纸</h2><p>切换图纸类型查看其他结果。</p></section>
        )}

        {resultViewOpen && results.length > 0 && (
          <section className="result-workbench" aria-label="结果工作台">
            <div className="result-workbench-intro">
              <SlidersHorizontal aria-hidden="true" />
              <div>
                <h2 id="result-workbench-title">{isVisualResearch ? '把图纸灵感带回表达' : '把案例研究带回方案'}</h2>
                <p>{isVisualResearch
                  ? '整理图纸的画面语言与自己的表达规范，把真正能用的图纸加入收藏。'
                  : '比较案例的设计策略，整理方案依据，或导出结果继续使用。'}</p>
              </div>
            </div>
            <div className={`result-workbench-actions result-workbench-actions--${isVisualResearch ? 'visual' : 'precedent'}`}>
              {!isVisualResearch && <button aria-label="对照案例策略" aria-describedby="tool-compare-help" type="button" disabled={selectedProjectCount < 2} onClick={(event) => { overlayTriggerRef.current = event.currentTarget; setComparisonOpen(true) }}>
                <Columns3 aria-hidden="true" />
                <span><strong>对照案例策略</strong><small id="tool-compare-help">{selectedProjectCount < 2 ? `已选 ${selectedProjectCount} 个案例，还需选择 ${2 - selectedProjectCount} 个不同案例` : `对照 ${selectedProjectCount} 个案例的策略与适用条件`}</small></span>
              </button>}
              {isVisualResearch && <button aria-label="编辑图纸表达规范" aria-describedby="tool-style-help" type="button" onClick={(event) => { overlayTriggerRef.current = event.currentTarget; setStyleProfileOpen(true) }}>
                <Palette aria-hidden="true" />
                <span><strong>编辑图纸表达规范</strong><small id="tool-style-help">手动设定配色、线宽与字体，保存到本研究板</small></span>
              </button>}
              {isVisualResearch ? (
                <button aria-label="查看个人收藏" aria-describedby="tool-collection-help" type="button" onClick={(event) => void openPersonalCollections(event.currentTarget)}>
                  <Bookmark aria-hidden="true" />
                  <span><strong>查看个人收藏</strong><small id="tool-collection-help">按题目整理已收藏的图纸灵感</small></span>
                </button>
              ) : (
                <button aria-label="导出策略矩阵" aria-describedby="tool-private-export-help" type="button" disabled={privateExportDisabled} onClick={() => void handleExport('private')}>
                  <Download aria-hidden="true" />
                  <span><strong>导出策略矩阵</strong><small id="tool-private-export-help">{selectedProjectCount < 2 ? `已选 ${selectedProjectCount} 个案例，还需选择 ${2 - selectedProjectCount} 个不同案例` : `把 ${selectedProjectCount} 个案例的核心解法与适用条件整理成一张对照表`}</small></span>
                </button>
              )}
              <button aria-label={isVisualResearch ? '生成可分享来源板' : '生成可分享结果板'} aria-describedby="tool-share-export-help" type="button" disabled={comparisonIds.length === 0} onClick={(event) => { overlayTriggerRef.current = event.currentTarget; setShareSummaryOpen(true) }}>
                <Share2 aria-hidden="true" />
                <span><strong>{isVisualResearch ? '生成可分享来源板' : '生成可分享结果板'}</strong><small id="tool-share-export-help">{comparisonIds.length === 0 ? '先在上方结果中选中至少 1 项参考' : isVisualResearch ? '受限图片只保留署名、来源与链接' : '整理已选案例的核心解法与怎么做'}</small></span>
              </button>
            </div>
            {lastExport && (
              <div className="result-export-ready">
                <Check aria-hidden="true" />
                <span>{lastExport.mode === 'private'
                  ? `${isVisualResearch ? '图纸整理版' : '策略矩阵'}已生成`
                  : `${isVisualResearch ? '分享来源板' : '分享结果板'}已生成`}</span>
                <a href={lastExport.browser_url} target="_blank" rel="noreferrer">
                  {lastExport.mode === 'private'
                    ? `打开${isVisualResearch ? '图纸整理版' : '策略矩阵'}`
                    : `打开${isVisualResearch ? '分享来源板' : '分享结果板'}`}
                  <ExternalLink aria-hidden="true" />
                </a>
              </div>
            )}
          </section>
        )}

        {resultViewOpen
          && (selectedPendingCollectionCount > 0 || collectionSaveSucceeded) && (
          <section className="collection-dock" aria-label="收藏选择">
            {collectionSaveSucceeded && selectedPendingCollectionCount === 0 ? (
              <div className="collection-dock-success" role="status">
                <Check aria-hidden="true" /><strong>已加入个人收藏，可回到主页打开“个人收藏”查看</strong>
              </div>
            ) : (
              <>
                <div className="collection-dock-summary">
                  <strong>{isVisualResearch ? `已选 ${selectedPendingCollectionCount} 张图纸（最多 6 张）` : `已选 ${selectedPendingCollectionCount} 个项目案例（最多 6 个）`}</strong>
                  <span>把真正能用的参考加入个人收藏，之后可在主页回看</span>
                </div>
                <div className="collection-dock-actions">
                  <button type="button" onClick={() => void clearResultSelection()}>清空选择</button>
                  {!isVisualResearch && (
                    <button type="button" disabled={selectedProjectCount < 2} onClick={(event) => { overlayTriggerRef.current = event.currentTarget; setComparisonOpen(true) }}>对照案例策略</button>
                  )}
                  <button
                    className="collection-add"
                    type="button"
                    aria-label={`添加 ${selectedPendingCollectionCount} 项到个人收藏`}
                    disabled={collectionSaving}
                    onClick={() => void addSelectionToCollection()}
                  >
                    <Bookmark aria-hidden="true" />{collectionSaving ? '正在添加…' : '添加到个人收藏'}
                  </button>
                </div>
              </>
            )}
          </section>
        )}

        {styleProfileOpen && (
          <section className="floating-panel style-panel" role="dialog" aria-modal="true" aria-label="表达规范">
            <header className="panel-heading"><h2>表达规范</h2><button type="button" autoFocus onClick={closeOverlays}>关闭表达规范</button></header>
            <label htmlFor="style-primary-color">主色</label>
            <input id="style-primary-color" type="color" value={styleProfile.primaryColor} onChange={(event) => setStyleProfile((current) => ({ ...current, primaryColor: event.target.value }))} />
            <label htmlFor="style-line-hierarchy">线宽层级</label>
            <select id="style-line-hierarchy" value={styleProfile.lineHierarchy} onChange={(event) => setStyleProfile((current) => ({ ...current, lineHierarchy: event.target.value as StyleDraft['lineHierarchy'] }))}>
              <option value="relative">相对层级</option><option value="contrast">强对比层级</option><option value="uniform">均一层级</option>
            </select>
            <label htmlFor="style-font-category">字体类别</label>
            <select id="style-font-category" value={styleProfile.fontCategory} onChange={(event) => setStyleProfile((current) => ({ ...current, fontCategory: event.target.value as StyleDraft['fontCategory'] }))}>
              <option value="sans">无衬线</option><option value="serif">衬线</option><option value="mono">等宽</option>
            </select>
            <label htmlFor="style-texture">纹理</label>
            <select id="style-texture" value={styleProfile.texture} onChange={(event) => setStyleProfile((current) => ({ ...current, texture: event.target.value as StyleDraft['texture'] }))}>
              <option value="none">无纹理</option><option value="vellum">硫酸纸颗粒</option><option value="grain">细颗粒纸张</option>
            </select>
            <label htmlFor="style-layout-notes">版式备注</label>
            <textarea id="style-layout-notes" value={styleProfile.layoutNotes} onChange={(event) => setStyleProfile((current) => ({ ...current, layoutNotes: event.target.value }))} placeholder="例如：证据栏靠右，图组留白更大" />
            <button type="button" onClick={() => void handleStyleSave()}>保存表达规范</button>
            {styleStatus && <p role="status">{styleStatus}</p>}
          </section>
        )}

        {!isVisualResearch && comparisonOpen && (
          <section className="floating-panel comparison-panel" role="dialog" aria-modal="true" aria-label="对照案例策略">
            <header className="panel-heading">
              <div><h2>对照案例策略</h2><p>比较这些参考怎样回答你的设计问题</p></div>
              <button type="button" autoFocus onClick={closeOverlays}>关闭案例策略对照</button>
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
                  <p>先用它处理{comparisonFocusLabels[recommendedComparisonResult.assetType]}，再用其他参考补上它没覆盖的方面，并对照各自的适用条件。</p>
                </div>
              )}
            </section>
            <p className="comparison-scroll-hint">横向滑动查看各项参考 →</p>
            <div className="comparison-table-wrap">
              <table className="comparison-table" aria-label="案例策略对照表">
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
                          <span className="comparison-column-meta">{assetLabels[result.assetType]}</span>
                          <strong>{result.title}</strong>
                          <small>{userFacingProjectName(result.project)}</small>
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  <tr><th scope="row">解决什么</th>{selectedComparisonResults.map((result) => <td key={result.id}>{comparisonFocusLabels[result.assetType]}</td>)}</tr>
                  <tr><th scope="row">可借鉴方法</th>{selectedComparisonResults.map((result) => <td key={result.id}>{result.inference}</td>)}</tr>
                  <tr><th scope="row">图中看到</th>{selectedComparisonResults.map((result) => <td key={result.id}>{result.observation}</td>)}</tr>
                  <tr><th scope="row">适用条件</th>{selectedComparisonResults.map((result) => <td key={result.id}>{firstUserFacingBoundary([result.limitation]) || '未列出'}</td>)}</tr>
                </tbody>
              </table>
            </div>
          </section>
        )}

        {shareSummaryOpen && (
          <section className="floating-panel share-panel" role="dialog" aria-modal="true" aria-label="分享版导出摘要">
            <h2>{isVisualResearch ? '分享前的图片授权检查' : '生成分享结果'}</h2>
            <p>{shareableCount} 张图片将直接放进分享版</p>
            {isVisualResearch ? <>
              <p>{comparisonIds.length - shareableCount} 项将改为来源卡</p>
              <p>来源卡保留项目、发布者、署名和原始链接，不复制受限图片。</p>
            </> : (
              <p>{comparisonIds.length - shareableCount} 项因图片授权受限，分享版中只保留研究文字与来源</p>
            )}
            <button type="button" onClick={() => void handleExport('share')}>确认生成分享版</button>
            <button type="button" autoFocus onClick={closeOverlays}>暂不生成，返回结果</button>
          </section>
        )}

        {collectionOpen && (
          <section className="collection-page" aria-label="个人收藏">
            <header className="panel-heading">
              <div>
                <h1>个人收藏</h1>
                <p>当前项目 · 按类型回看</p>
              </div>
            </header>
            {collectionsLoading ? (
              <p className="collection-empty" role="status">正在读取收藏…</p>
            ) : (
              <>
                <div className="research-entry-switch collection-entry-switch" role="group" aria-label="收藏类型">
                  {collectionSections.map((section) => (
                    <button
                      type="button"
                      key={section.key}
                      aria-pressed={collectionView === section.key}
                      onClick={() => {
                        setCollectionView(section.key === 'visual' ? 'visual' : 'precedent')
                        setSelectedCollectionSubquestion(null)
                      }}
                    >
                      {section.key === 'visual' ? <Eye aria-hidden="true" /> : <LayoutGrid aria-hidden="true" />}
                      <span>
                        <strong>{section.title}</strong>
                        <small>{section.items.length} 项 · {section.key === 'visual' ? '收藏图片' : '项目与研究文字'}</small>
                      </span>
                    </button>
                  ))}
                </div>
                {!activeCollectionSection || activeCollectionSection.items.length === 0 ? (
                  <p className="collection-mode-empty">
                    {collectionView === 'visual'
                      ? '还没有图纸灵感收藏。去图纸灵感结果中选择图片。'
                      : '还没有建筑方案收藏。去建筑研究结果中选择案例。'}
                  </p>
                ) : collectionView === 'precedent' ? (
                  <div className="collection-architecture">
                    {!activeCollectionSubquestion ? (
                      <section className="collection-question-directory" aria-label="建筑问题目录">
                        <header className="collection-directory-heading">
                          <span>建筑方案</span>
                          <h2>问题目录</h2>
                          <p>按具体设计问题查看收藏案例，以及它们如何解决问题。</p>
                        </header>
                        <ul className="collection-directory-list">
                          {collectionQuestionDirectory.map(({ collectionQuestion, group }) => (
                            <li key={`${collectionQuestion}:${group.id}`}>
                              <button
                                type="button"
                                aria-label={`查看子问题：${group.question}`}
                                onClick={() => setSelectedCollectionSubquestion({
                                  collectionQuestion,
                                  subquestionId: group.id,
                                })}
                              >
                                <span className="collection-directory-copy">
                                  <small>案例子问题</small>
                                  <strong>{group.question}</strong>
                                  <span>{collectionQuestion}</span>
                                </span>
                                <span className="collection-directory-count">{group.entries.length} 个已收藏案例</span>
                                <ChevronRight aria-hidden="true" />
                              </button>
                            </li>
                          ))}
                        </ul>
                      </section>
                    ) : (
                      <>
                        <button
                          className="collection-directory-back"
                          type="button"
                          onClick={() => setSelectedCollectionSubquestion(null)}
                        >
                          <ArrowLeft aria-hidden="true" />返回问题目录
                        </button>
                    {activeCollectionSection.groups
                      .filter(([collectionQuestion]) => (
                        collectionQuestion === activeCollectionSubquestion.collectionQuestion
                      ))
                      .map(([collectionQuestion, items]) => (
                      <section
                        className="collection-question"
                        key={collectionQuestion}
                        aria-label={`原研究题目：${collectionQuestion}`}
                      >
                        <div className="collection-subquestions">
                          {collectionCaseGroups(items)
                            .filter((group) => group.id === activeCollectionSubquestion.group.id)
                            .map((group) => (
                            <section
                              className="collection-subquestion"
                              key={group.id}
                              aria-label={`案例子问题：${group.question}`}
                            >
                              <header className="collection-subquestion-heading">
                                <span>案例子问题</span>
                                <h3>{group.question}</h3>
                                <small>{group.entries.length} 个已收藏案例</small>
                              </header>
                              <ul className="collection-architecture-list">
                                {group.entries.map(({ item, analysis }) => {
                                  const snapshot = item.snapshot
                                  const projectName = userFacingProjectName(snapshot.project_name || '未命名项目')
                                  const designMechanism = analysis.design_mechanism.trim()
                                  const solutionSteps = uniqueSummaryItems(analysis.transfer_strategy, 3)
                                  const boundary = firstUserFacingBoundary(analysis.limitations)
                                  const caseImages = collectionCaseImages(item)
                                  const hasSolution = Boolean(designMechanism || solutionSteps.length)
                                  return (
                                    <li className="collection-architecture-item" key={`${item.id}:${analysis.id}`}>
                                      <article className="collection-case" aria-label={`收藏案例 ${projectName}`}>
                                        <header className="collection-case-heading">
                                          <div className="collection-case-title">
                                            <h4>{projectName}</h4>
                                          </div>
                                          <div className="collection-text-actions">
                                            <button type="button" aria-label={`删除收藏：${projectName}`} title="删除收藏" onClick={() => void deletePersonalCollection(item.id)}>
                                              <Trash2 aria-hidden="true" />
                                            </button>
                                          </div>
                                        </header>
                                        <div className="collection-case-layout">
                                          {hasSolution ? (
                                            <section
                                              className="collection-case-solution"
                                              aria-label={`${projectName} 的解法`}
                                            >
                                              {designMechanism && <div className="collection-case-core">
                                                <h5>核心解法</h5>
                                                <p>{designMechanism}</p>
                                              </div>}
                                              {solutionSteps.length > 0 && <div className="collection-case-steps">
                                                <h5>怎么做</h5>
                                                <ol>{solutionSteps.map((step) => <li key={step}>{step}</li>)}</ol>
                                              </div>}
                                              {boundary && (
                                                <p className="collection-case-boundary">
                                                  <strong>适用条件</strong>
                                                  <span>{boundary}</span>
                                                </p>
                                              )}
                                            </section>
                                          ) : (
                                            <p className="collection-case-missing">这条收藏还没有形成可复用解法。</p>
                                          )}
                                          {caseImages.length > 0 && (
                                            <div
                                              className="collection-case-media"
                                              role="group"
                                              aria-label={`${projectName} 案例图片`}
                                            >
                                              <div className="collection-case-image-grid">
                                                {caseImages.map((image) => {
                                                  const imageType = assetLabels[image.asset_type]
                                                  const previewUrl = collectionCaseImageUrl(item, image)
                                                  return (
                                                    <figure className="collection-case-image" key={image.asset_id}>
                                                      <a
                                                        aria-label={`打开案例图片：${projectName} · ${imageType}`}
                                                        href={previewUrl}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                      >
                                                        <img src={previewUrl} alt={`${projectName} · ${imageType}`} />
                                                      </a>
                                                      <figcaption>{imageType}</figcaption>
                                                    </figure>
                                                  )
                                                })}
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      </article>
                                    </li>
                                  )
                                })}
                              </ul>
                            </section>
                          ))}
                        </div>
                      </section>
                    ))}
                      </>
                    )}
                  </div>
                ) : (
                  <ul className="collection-visual-grid" aria-label="图纸灵感收藏">
                    {activeCollectionSection.items.map((item) => {
                      const snapshot = item.snapshot
                      const itemName = snapshot.project_name || '收藏图纸'
                      const previewUrl = snapshot.collection_file
                        ? `/v1/collections/${item.id}/content`
                        : snapshot.image_url
                      return (
                        <li className="collection-visual-item" key={item.id}>
                          <div className="collection-visual-media">
                            {previewUrl ? (
                              <a
                                className="collection-visual-open"
                                aria-label={`打开高清图片：${itemName}`}
                                title="打开高清图片"
                                href={previewUrl}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <img src={previewUrl} alt={itemName} loading="lazy" />
                              </a>
                            ) : (
                              <span className="collection-visual-placeholder" role="img" aria-label={`${itemName} 图片不可用`}>
                                <ImageOff aria-hidden="true" />
                              </span>
                            )}
                            <div className="collection-visual-actions">
                              <a aria-label={`打开来源：${itemName}`} title="打开来源" href={item.source_url} target="_blank" rel="noreferrer">
                                <ExternalLink aria-hidden="true" />
                              </a>
                              <button type="button" aria-label={`删除收藏：${itemName}`} title="删除收藏" onClick={() => void deletePersonalCollection(item.id)}>
                                <Trash2 aria-hidden="true" />
                              </button>
                            </div>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </>
            )}
          </section>
        )}

      </section>

      {inspectorOpen && selectedResult && (
        <>
          <button className="drawer-backdrop" type="button" tabIndex={-1} aria-hidden="true" onClick={closeOverlays} />
          <aside className="source-inspector" role="dialog" aria-modal="true" aria-label="来源检视器">
            <header className="inspector-heading">
              <div><span>来源检视器</span><h2>核对原文证据</h2></div>
              <button type="button" autoFocus onClick={closeOverlays}>关闭</button>
            </header>
            <div className="inspector-content">
              <section className="inspector-preview-pane" aria-label="项目预览">
                <figure aria-label={`${selectedResult.project} 项目预览`}>
                  <div className="inspector-preview" data-drawing={selectedResult.drawing}>
                    {selectedPreviewUrl ? (
                      <img
                        src={selectedPreviewUrl}
                        alt={`${selectedResult.project} ${assetLabels[selectedResult.assetType]}`}
                        onError={() => markPreviewFailed(selectedResult.id, selectedPreviewUrl)}
                      />
                    ) : (
                      <div className="preview-unavailable">
                        <ImageOff aria-hidden="true" />
                        <strong>{selectedPreviewLoadFailed ? '项目预览加载失败' : '暂无项目预览'}</strong>
                        <p>打开原始来源查看完整项目；设计机制以正文引文为准。</p>
                      </div>
                    )}
                    <div className="evidence-image-labels">
                      <span>{assetLabels[selectedResult.assetType]}</span>
                      {selectedPreviewUrl && selectedResult.previewSource && (
                        <span>{selectedResult.previewSource === 'chrome' ? 'Chrome 项目预览' : '公开网页预览'}</span>
                      )}
                    </div>
                  </div>
                  <figcaption>
                    <strong>{selectedResult.project}</strong>
                    <span>{selectedResult.location} · {selectedResult.year}</span>
                  </figcaption>
                </figure>
                <a className="source-link" href={selectedResult.sourceUrl} target="_blank" rel="noreferrer">
                  打开原始来源 <ExternalLink aria-hidden="true" />
                </a>
              </section>

              <section className="inspector-analysis-pane" aria-label="来源证据">
                <strong className="inspector-project">{selectedResult.project}</strong>
                <p className="inspector-location">{selectedResult.location} · {selectedResult.year}</p>
                <section
                  className="inspector-source-evidence"
                  aria-labelledby={`source-evidence-${selectedResult.id}`}
                >
                  <header>
                    <h3 id={`source-evidence-${selectedResult.id}`}>逐字原文证据</h3>
                    <span>{selectedResult.evidenceClaims.length} 条</span>
                  </header>
                  {selectedResult.evidenceClaims.map((claim) => (
                    <section className="evidence-locator" key={claim.id}>
                      <h4>{claim.claim_type === 'fact' ? '来源事实' : '补充来源'}</h4>
                      <p>{claim.statement}</p>
                      {claim.text_excerpt && <blockquote>{claim.text_excerpt}</blockquote>}
                      {claim.pdf_page && <p>PDF 第 {claim.pdf_page} 页</p>}
                      {claim.source_url && <a href={claim.source_url} target="_blank" rel="noreferrer">打开证据定位</a>}
                    </section>
                  ))}
                </section>
                <section
                  className="inspector-verification"
                  aria-labelledby={`source-verification-${selectedResult.id}`}
                >
                  <h3 id={`source-verification-${selectedResult.id}`}>核验与权利</h3>
                  <dl className="evidence-matrix">
                    <div><dt>发布来源</dt><dd>{publicationTierLabels[selectedResult.publicationTier]}</dd></div>
                    <div><dt>项目身份</dt><dd>{associationLabels[selectedResult.projectIdentity]}</dd></div>
                    <div><dt>图片归属</dt><dd>{associationLabels[selectedResult.assetAssociation]}</dd></div>
                    <div><dt>权利状态</dt><dd>{rightsStatusLabels[selectedResult.rightsStatus]}</dd></div>
                  </dl>
                </section>
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
              </section>
            </div>
          </aside>
        </>
      )}

    </main>
  )
}
