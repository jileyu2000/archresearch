export type ResearchMode = 'quick' | 'balanced' | 'deep'
export type WorkflowStage =
  | 'planning'
  | 'searching'
  | 'inspecting'
  | 'analyzing'
  | 'verifying'
  | 'gap_check'
  | 'composing'

export interface ResearchWorkflowInput {
  runId: string
  question: string
  mode: ResearchMode
  clientSessionId: string
}

export interface PlannedSubquestion {
  id: string
  question: string
  searchQuery?: string
}

export interface SearchCandidate {
  url: string
  title: string
  subquestionId?: string
}

export interface InspectedSource extends SearchCandidate {
  text: string
}

export interface EvidenceFinding {
  subquestionId: string
  statement: string
  sourceUrl: string
  quote: string
}

export interface CoverageReport {
  coverageSatisfied: boolean
  enrichmentSatisfied: boolean
  gaps: string[]
}

export interface ResearchSection {
  id: string
  title: string
  facts: Array<Pick<EvidenceFinding, 'statement' | 'sourceUrl' | 'quote'>>
}

export interface ComposedResearch {
  summary: string
  sections: ResearchSection[]
}

export interface ResearchServices {
  plan(input: ResearchWorkflowInput): Promise<PlannedSubquestion[]>
  search(
    input: ResearchWorkflowInput,
    plan: PlannedSubquestion[],
  ): Promise<SearchCandidate[]>
  inspect(
    input: ResearchWorkflowInput,
    candidates: SearchCandidate[],
  ): Promise<InspectedSource[]>
  analyze(
    input: ResearchWorkflowInput,
    plan: PlannedSubquestion[],
    sources: InspectedSource[],
  ): Promise<EvidenceFinding[]>
  verify(
    findings: EvidenceFinding[],
    sources: InspectedSource[],
  ): Promise<EvidenceFinding[]>
  checkCoverage(
    plan: PlannedSubquestion[],
    findings: EvidenceFinding[],
  ): Promise<CoverageReport>
  compose(
    input: ResearchWorkflowInput,
    plan: PlannedSubquestion[],
    findings: EvidenceFinding[],
    coverage: CoverageReport,
  ): Promise<ComposedResearch>
}

export interface CheckpointStore {
  save(stage: WorkflowStage, summary: Record<string, unknown>): Promise<void>
}

export interface WorkflowStageRunner {
  do<T extends Rpc.Serializable<T>>(
    stage: WorkflowStage,
    callback: () => Promise<T>,
  ): Promise<T>
}

const immediateStageRunner: WorkflowStageRunner = {
  do: async (_stage, callback) => await callback(),
}

function hasBoundEvidence(section: ResearchSection) {
  return section.facts.every((fact) => {
    if (!fact.statement.trim() || !fact.quote.trim()) return false
    try {
      const url = new URL(fact.sourceUrl)
      return url.protocol === 'https:' || url.protocol === 'http:'
    } catch {
      return false
    }
  })
}

export async function runResearchWorkflow(
  input: ResearchWorkflowInput,
  services: ResearchServices,
  checkpoints: CheckpointStore,
  stageRunner: WorkflowStageRunner = immediateStageRunner,
) {
  const plan = await stageRunner.do('planning', async () => await services.plan(input))
  await checkpoints.save('planning', { subquestionCount: plan.length })

  const candidates = await stageRunner.do(
    'searching',
    async () => await services.search(input, plan),
  )
  await checkpoints.save('searching', { candidateCount: candidates.length })

  const sources = await stageRunner.do(
    'inspecting',
    async () => await services.inspect(input, candidates),
  )
  await checkpoints.save('inspecting', { sourceCount: sources.length })

  const analyzed = await stageRunner.do(
    'analyzing',
    async () => await services.analyze(input, plan, sources),
  )
  await checkpoints.save('analyzing', { findingCount: analyzed.length })

  const verified = await stageRunner.do(
    'verifying',
    async () => await services.verify(analyzed, sources),
  )
  await checkpoints.save('verifying', { verifiedFindingCount: verified.length })

  const coverage = await stageRunner.do(
    'gap_check',
    async () => await services.checkCoverage(plan, verified),
  )
  await checkpoints.save('gap_check', {
    coverageSatisfied: coverage.coverageSatisfied,
    enrichmentSatisfied: coverage.enrichmentSatisfied,
    gapCount: coverage.gaps.length,
  })

  const composed = await stageRunner.do(
    'composing',
    async () => await services.compose(input, plan, verified, coverage),
  )
  const evidenceBound = composed.sections.every(hasBoundEvidence)
  const completed = coverage.coverageSatisfied
    && coverage.enrichmentSatisfied
    && evidenceBound
  await checkpoints.save('composing', {
    sectionCount: composed.sections.length,
    evidenceBound,
  })

  return {
    runId: input.runId,
    status: completed ? 'completed' as const : 'partial' as const,
    summary: composed.summary,
    sections: composed.sections,
    coverage: {
      ...coverage,
      gaps: evidenceBound
        ? coverage.gaps
        : [...coverage.gaps, '存在未绑定来源 URL 与逐字引文的事实'],
    },
  }
}
