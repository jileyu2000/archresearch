import type {
  ApiAssetCandidate,
  ApiEvidenceClaim,
  ArchitectureAssetType,
  ResearchSubquestion,
} from '../api/client'
import type { EvidenceResult } from '../data/mock'
import {
  assetLabels,
  drawingFor,
  publicationTierLabels,
} from './labels'
import {
  chineseCharacterPattern,
  chineseItems,
  chineseText,
  firstUserFacingBoundary,
} from './text'

export type WorkResult = EvidenceResult & {
  analysisReady: boolean
  evidenceClaims: ApiEvidenceClaim[]
  previewUrl: string | null
  previewSource: 'public' | 'chrome' | null
  subquestionAnalysis: Record<string, ResultAnalysis>
  visualReference?: boolean
}

export type ResultAnalysis = {
  projectNameZh: string
  projectContext: string
  designMechanism: string
  transferStrategy: string[]
  observations: string[]
  limitations: string[]
}

function trustedProjectNameZh(translatedName: string, originalName: string, sourceUrl: string) {
  const translated = translatedName.trim()
  if (!translated) return ''
  const explicitLocation = originalName.match(
    /\b(?:in|at|near)\s+(?:the\s+)?([a-z][a-z'’-]{2,})\b/iu,
  )?.[1]?.toLowerCase()
  if (!explicitLocation || translated.toLowerCase().includes(explicitLocation)) return translated
  try {
    const sourcePath = decodeURIComponent(new URL(sourceUrl).pathname).toLowerCase()
    return sourcePath.includes(explicitLocation) ? '' : translated
  } catch {
    return translated
  }
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

export function toWorkResult(candidate: ApiAssetCandidate): WorkResult {
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
    visualReference: candidate.visual_reference === true,
    analysisReady,
    subquestionAnalysis: Object.fromEntries(
      Object.entries(candidate.subquestion_analysis ?? {}).map(([id, analysis]) => [
        id,
        {
          projectNameZh: trustedProjectNameZh(
            analysis.project_name_zh ?? '',
            candidate.project_name,
            candidate.source_url,
          ),
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

export function fallbackSubquestions(
  results: WorkResult[],
  question: string,
): ResearchSubquestion[] {
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

export function supportsSubquestion(
  result: WorkResult,
  subquestionId: string,
  subquestions: ResearchSubquestion[],
) {
  const knownAssociations = result.subquestionIds.filter((id) =>
    subquestions.some((item) => item.id === id),
  )
  return knownAssociations.includes(subquestionId)
}

export function analysisFor(result: WorkResult, subquestionId: string) {
  const scoped = result.subquestionAnalysis[subquestionId]
  const limitations = scoped?.limitations.length ? scoped.limitations : [result.limitation]
  return {
    projectNameZh: scoped?.projectNameZh?.trim() ?? '',
    projectContext: scoped?.projectContext.trim() || result.projectContext,
    designMechanism: scoped?.designMechanism.trim() || result.designMechanism,
    transferStrategy: scoped?.transferStrategy.length
      ? scoped.transferStrategy
      : result.transferStrategy,
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

export function projectPreviewCopy(
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

export function availablePreviewUrl(
  result: WorkResult,
  failedPreviewUrls: Record<string, string>,
) {
  if (!result.previewUrl || failedPreviewUrls[result.id] === result.previewUrl) return null
  return result.previewUrl
}
