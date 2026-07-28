import type {
  ApiAssetCandidate,
  ResearchGoal,
  ResearchMode,
} from '../api/client'
import type { AssetType, EvidenceResult } from '../data/mock'

export function questionRelevanceLabel(relevance: number) {
  if (relevance >= 4) return '直接支撑本题'
  if (relevance >= 3) return '与本题高度相关'
  if (relevance >= 2) return '可补充本题'
  if (relevance >= 1) return '与本题关联较弱'
  return '与本题无直接关系'
}

export const publicationTierLabels: Record<ApiAssetCandidate['publication_tier'], string> = {
  primary: '项目或设计方首发',
  trusted_secondary: '可信二手来源',
  aggregator: '转载合集（非首发）',
  unknown: '来源未知',
}

export const associationLabels: Record<ApiAssetCandidate['project_identity'], string> = {
  confirmed: '已确认',
  probable: '较可能',
  unknown: '未知',
  conflict: '存在冲突',
}

export const rightsStatusLabels: Record<ApiAssetCandidate['rights_status'], string> = {
  user_owned: '用户自有',
  open_license: '开放许可',
  permissioned: '已获授权',
  unknown: '未注明',
  restricted: '受限',
}

export function visualPlatformName(sourceUrl: string) {
  try {
    const hostname = new URL(sourceUrl).hostname.toLowerCase()
    if (hostname === 'xiaohongshu.com' || hostname.endsWith('.xiaohongshu.com')) return '小红书'
  } catch {
    return null
  }
  return null
}

export const modeLabels: Record<ResearchMode, string> = {
  quick: '快速找方向',
  balanced: '形成方案依据',
  deep: '做跨案例论证',
}

export const researchDepthOptions: Record<ResearchMode, { target: string }> = {
  quick: {
    target: '从少量高相关案例提炼做法，给出直接建议',
  },
  balanced: {
    target: '比较多个案例的条件、做法与结果，说明适用边界',
  },
  deep: {
    target: '综合更多案例，指出共识、冲突、不确定性和失效边界',
  },
}

export const goalLabels: Record<ResearchGoal, string> = {
  precedent_research: '建筑设计研究',
  visual_reference_search: '图纸灵感',
}

export const goalPlaceholders: Record<ResearchGoal, string> = {
  precedent_research: '例如：旧建筑植入新功能时，如何拆分公共流线与后勤流线？',
  visual_reference_search: '例如：我想出一张轴测图，帮我找几种风格。',
}

export const assetLabels: Record<AssetType, string> = {
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

export const comparisonFocusLabels: Record<AssetType, string> = {
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

export function drawingFor(assetType: AssetType): EvidenceResult['drawing'] {
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
