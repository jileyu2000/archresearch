import type { ResearchRun, RunStatus } from '../api/client'
import { modeLabels } from './labels'

export const terminalStatuses = new Set<RunStatus>([
  'completed',
  'partial',
  'blocked',
  'cancelled',
  'failed',
])

export const stageLabels: Array<{ status: RunStatus; label: string }> = [
  { status: 'planning', label: '规划' },
  { status: 'searching', label: '搜索' },
  { status: 'inspecting', label: '读取项目' },
  { status: 'analyzing', label: '分析正文' },
  { status: 'verifying', label: '核验来源' },
  { status: 'gap_check', label: '检查缺口' },
  { status: 'composing', label: '整理结论' },
  { status: 'completed', label: '完成' },
]

export const visualStageLabels: Array<{ status: RunStatus; label: string }> = [
  { status: 'planning', label: '确定方向' },
  { status: 'searching', label: '搜索灵感' },
  { status: 'inspecting', label: '读取图纸' },
  { status: 'analyzing', label: '分析画面' },
  { status: 'verifying', label: '核对来源' },
  { status: 'gap_check', label: '检查方向' },
  { status: 'composing', label: '整理灵感' },
  { status: 'completed', label: '完成' },
]

export const activeStageDescriptions: Partial<Record<RunStatus, string>> = {
  created: '任务已经进入队列，正在准备研究计划',
  planning: '正在把问题拆成几个可研究的小问题',
  searching: '正在从公开网页中寻找相关项目与原始来源',
  inspecting: '正在读取项目介绍和设计背景',
  analyzing: '正在整理项目做法和可借鉴步骤',
  verifying: '正在确认项目信息和出处',
  gap_check: '正在检查每个研究问题是否都有可用案例',
  composing: '正在比较案例并整理设计结论',
}

export const visualActiveStageDescriptions: Partial<Record<RunStatus, string>> = {
  created: '任务已经进入队列，正在准备灵感检索',
  planning: '正在把需求整理成不同的图纸风格方向',
  searching: '正在按图纸类型和表达风格寻找参考',
  inspecting: '正在读取笔记图片并判断图纸类型与风格',
  analyzing: '正在提取线型、配色、材质和构图特征',
  verifying: '正在核对原笔记来源和可见图像内容',
  gap_check: '正在检查每个灵感方向是否已有可用参考',
  composing: '正在按风格方向整理图纸灵感',
}

export function runAnnouncement(run: ResearchRun) {
  if (
    run.status === 'completed'
    && (run.coverageReport?.enrichment_gaps?.length ?? 0) > 0
  ) {
    return run.goal === 'visual_reference_search' ? '已完成 · 图纸较少' : '已完成 · 案例不足'
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

export function needsCompletionContinuation(run: ResearchRun) {
  const completionGaps = new Set([
    'uncovered_subquestions',
    'article_analysis_incomplete',
    'research_synthesis_incomplete',
  ])
  return run.goal === 'precedent_research'
    && (run.coverageReport?.gaps ?? []).some((gap) => completionGaps.has(gap))
}

export function retryActionLabel(run: ResearchRun) {
  return needsCompletionContinuation(run) ? '继续补齐研究' : '重试研究'
}

export function partialReasonTitle(stopReason?: string | null) {
  if (stopReason === 'budget_exhausted') return '本轮自动检索次数已用完，先交付当前可用结果'
  if (stopReason === 'time_budget_exhausted') return '本轮研究达到时间上限'
  if (stopReason === 'visual_budget_exhausted') return '本轮可检查的图纸数量已达上限'
  if (stopReason === 'no_new_assets') return '这轮没有找到更多可用案例'
  if (stopReason === 'unverified_visual_leads') return '已找到图片，但还不能用它确认项目事实'
  if (stopReason === 'browser_inspection_incomplete') return 'Chrome 图纸检查未完成'
  if (stopReason === 'no_usable_assets') return '暂未找到能回答问题的项目案例'
  if (stopReason?.startsWith('provider_error:')) return '部分网页研究服务暂时不可用'
  return '本次研究先交付当前可用结果'
}

export function partialDiagnosis(run: ResearchRun) {
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
    insufficient_usable_assets: `“${modeLabels[run.mode]}”需要更多可用项目案例`,
    fewer_than_six_usable_assets: `“${modeLabels[run.mode]}”需要更多可用项目案例`,
    insufficient_project_diversity: '具体项目数量还不足，案例覆盖不够多样',
    insufficient_verified_or_partial: '已经确认出处的项目案例还不够',
    uncovered_subquestions: '仍有研究问题没有足够的可用案例',
    article_analysis_incomplete: '部分项目还没有同时说明项目条件、设计做法和可借鉴步骤',
    research_synthesis_incomplete: '案例已经保留，但所选研究方式需要的结论还没整理完成',
    browser_inspection_incomplete: 'Chrome 未能完成候选页面的图纸检查，现有网页结果已保留',
    insufficient_multi_asset_projects: '部分项目还缺少平面、剖面等互补图纸',
  }
  const gaps = [...new Set((coverage?.gaps ?? []).map(
    (gap) => gapLabels[gap] ?? '仍有研究内容未达到当前研究深度的目标',
  ))]
  const continuationRequired = needsCompletionContinuation(run)
  return {
    title: continuationRequired ? '仍有子问题等待补齐' : partialReasonTitle(run.stopReason),
    summary: `已保留 ${usable} 条可用案例内容，覆盖 ${projects} 个项目，其中 ${supported} 条已经确认出处。`,
    gaps,
    nextStep: continuationRequired
      ? '目前是中途保存的进度，还不是完整结果；点“继续补齐研究”会保留已有证据，只补齐仍空白的子问题。'
      : '可以继续查看现有结果；重试会开启新一轮研究，补找项目案例与出处。',
  }
}

export function recentRunAnnouncement(run: ResearchRun) {
  return run.status === 'partial'
    ? `部分结果 · ${partialReasonTitle(run.stopReason)}`
    : runAnnouncement(run)
}

export const announcementExplanations: Record<string, string> = {
  '已完成 · 案例不足': '已回答全部研究问题，但案例数量或深度未达完整标准，可先使用已有结果',
  '已完成 · 图纸较少': '已覆盖全部灵感方向，但可用图纸数量未达完整标准，可先使用已有结果',
}
