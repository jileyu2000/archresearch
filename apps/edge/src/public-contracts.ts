export interface ResearchRunSnapshot {
  runId: string
  workspaceId: string
  question: string
  goal: 'precedent_research' | 'visual_reference_search'
  mode: 'quick' | 'balanced' | 'deep'
  status: 'completed' | 'partial'
  subquestions: Array<{
    id: string
    question: string
    rationale: string
  }>
  summary: string
  sections: Array<{
    id: string
    title: string
    rationale?: string
    facts: Array<{
      statement: string
      sourceUrl: string
      quote: string
      sourceTitle?: string
      imageUrl?: string | null
      assetType?:
        | 'plan'
        | 'section'
        | 'elevation'
        | 'site_plan'
        | 'axonometric'
        | 'circulation'
        | 'analysis_diagram'
        | 'render'
        | 'photograph'
    }>
  }>
  coverage: {
    coverageSatisfied: boolean
    enrichmentSatisfied: boolean
    gaps: string[]
  }
}
