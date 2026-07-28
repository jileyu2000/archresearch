import type { ResearchMode } from '../api/client'
import { demoSubquestions, evidenceResults } from '../data/mock'
import type { WorkResult } from './workResult'

export const demoResearchQuestion = '旧建筑更新中，如何植入新功能，并组织公共与后勤流线和剖面层次？'

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

export function demoDepthFromSearch(search: string): ResearchMode | null {
  const value = new URLSearchParams(search).get('demo')
  if (value === '1') return 'balanced'
  return value === 'quick' || value === 'balanced' || value === 'deep' ? value : null
}

export function demoSubquestionsFor(depth: ResearchMode) {
  if (depth === 'quick') return demoSubquestions.slice(0, 3)
  if (depth === 'deep') return deepDemoSubquestions
  return demoSubquestions
}

export function demoResults(depth: ResearchMode): WorkResult[] {
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
