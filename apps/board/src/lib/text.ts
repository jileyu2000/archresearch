export const chineseCharacterPattern = /[\u3400-\u9fff]/
export const localSynthesisPrefix = '【本地证据汇总】'

const synthesisHeadlineCharacterLimit = 84
const auditBoundaryPattern = /原文|正文|来源|源网站|证据|核对|核验|图片像素|未给出|未说明|未记录|待确认|仍需确认|不详|证明|断言|实证|drawing_ids|研究子问题|页面仅支持|页面不是|页面没有|页面未|页面不涉及|本页没有/

export function synthesisSegment(statement: string, label: string) {
  const prefix = `${label}：`
  const segment = statement
    .split('；')
    .map((item) => item.trim())
    .find((item) => item.startsWith(prefix))
  return segment?.slice(prefix.length).trim() ?? ''
}

export function conciseSynthesisHeadline(statement: string) {
  const trimmed = statement.trim()
  if (trimmed.length <= synthesisHeadlineCharacterLimit) return trimmed
  const firstSentence = trimmed.match(/^.{16,84}?[。！？]/u)?.[0]
  if (firstSentence) return firstSentence
  return `${trimmed.slice(0, synthesisHeadlineCharacterLimit - 1).trim()}…`
}

export function fallbackAnswerMechanism(statement: string) {
  const firstFinding = statement
    .replace(localSynthesisPrefix, '')
    .replace(/^[；：:\s]+/u, '')
    .split('；')
    .map((item) => item.trim())
    .find(Boolean) ?? statement
  return firstFinding.replace(/^[^：]{1,80}：/u, '').trim()
}

export function userFacingRecommendation(statement: string) {
  return statement
    .replace(/^【(?:转译建议|建议|操作)[^】]*】\s*/u, '')
    .replace(/^转译步骤[（(][^）)]+[）)]\s*[：:]\s*/u, '')
    .replace(/^(?:转译建议|转译步骤|建议|操作)\s*[：:]\s*/u, '')
    .replace(/(?:该建议转译自|后半部分属于)[^。！？]*[。！？]?/gu, '')
    .replace(/[，,]\s*(?:不能|不可)[^。！？]*(?:推定|证明|断言)[^。！？]*[。！？]?/gu, '。')
    .trim()
}

export function sourceHostLabel(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./u, '')
  } catch {
    return '源网页'
  }
}

export function userFacingProjectName(projectName: string) {
  return projectName
    .replace(/\s*\|\s*(?:ArchDaily(?:\s+China)?|Dezeen|Designboom|Divisare)\s*$/iu, '')
    .trim()
}

export function chineseText(value: string | undefined, fallback: string) {
  const trimmed = value?.trim() ?? ''
  return chineseCharacterPattern.test(trimmed) ? trimmed : fallback
}

export function chineseItems(values: string[] | undefined) {
  return (values ?? []).map((item) => item.trim()).filter((item) => chineseCharacterPattern.test(item))
}

export function uniqueSummaryItems(items: string[], limit: number) {
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

export function userFacingBoundary(statement: string) {
  return statement.replace(/^(?:适用边界|适用条件|适用时注意|边界)\s*[：:]\s*/u, '').trim()
}

export function firstUserFacingBoundary(items: string[]) {
  const boundary = uniqueSummaryItems(items, items.length)
    .find((item) => !auditBoundaryPattern.test(item)) ?? ''
  return userFacingBoundary(boundary)
}
