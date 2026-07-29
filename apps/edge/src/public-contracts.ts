export interface ResearchRunSnapshot {
  runId: string
  status: 'completed' | 'partial'
  summary: string
  sections: Array<{
    id: string
    title: string
    facts: Array<{
      statement: string
      sourceUrl: string
      quote: string
    }>
  }>
  coverage: {
    coverageSatisfied: boolean
    enrichmentSatisfied: boolean
    gaps: string[]
  }
}
