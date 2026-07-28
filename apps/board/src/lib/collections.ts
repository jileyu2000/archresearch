import type { PersonalCollection } from '../api/client'

export type CollectionCaseSubquestion = NonNullable<
  PersonalCollection['snapshot']['case_subquestions']
>[number]

export type CollectionCaseImage = NonNullable<
  PersonalCollection['snapshot']['case_images']
>[number]

export function collectionSelectionKey(resultId: string, subquestionId?: string) {
  return subquestionId ? `${subquestionId}:${resultId}` : `asset:${resultId}`
}

export function collectionCaseImages(item: PersonalCollection): CollectionCaseImage[] {
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

export function collectionCaseImageUrl(item: PersonalCollection, image: CollectionCaseImage) {
  if (image.asset_id === item.asset_candidate_id && item.snapshot.collection_file) {
    return `/v1/collections/${item.id}/content`
  }
  return image.image_url
}

export function collectionCaseSubquestions(item: PersonalCollection): CollectionCaseSubquestion[] {
  const stored = item.snapshot.case_subquestions?.filter((subquestion) => (
    subquestion.question.trim()
  )) ?? []
  if (stored.length > 0) return stored
  return [{
    id: 'legacy',
    question: '未记录具体研究子问题',
    project_context: item.snapshot.project_context?.trim() ?? '',
    design_mechanism: item.snapshot.design_mechanism?.trim() || item.note.trim(),
    transfer_strategy: item.snapshot.transfer_strategy ?? [],
    limitations: item.snapshot.limitations ?? [],
  }]
}

export function collectionCaseGroups(items: PersonalCollection[]) {
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
