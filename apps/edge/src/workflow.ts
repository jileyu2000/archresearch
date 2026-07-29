export type ResearchMode = 'quick' | 'balanced' | 'deep'
export type ResearchGoal = 'precedent_research' | 'visual_reference_search'
export type ResearchSource = 'public_web' | 'xiaohongshu'
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
  workspaceId: string
  question: string
  goal: ResearchGoal
  mode: ResearchMode
  referenceUrl?: string
  researchSources: ResearchSource[]
  browserVisualSources?: BrowserVisualSource[]
  subquestions?: Array<PlannedSubquestion & { rationale: string }>
  briefFile?: {
    filename: string
    dataUrl: string
  }
  clientSessionId: string
}

export interface BrowserVisualSource {
  sourceUrl: string
  title: string
  imageUrl: string | null
  adjacentText: string
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
  providedText?: string
  imageUrl?: string | null
}

export interface InspectedSource extends SearchCandidate {
  text: string
  imageUrl?: string | null
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
  facts: Array<Pick<EvidenceFinding, 'statement' | 'sourceUrl' | 'quote'> & {
    sourceTitle?: string
    imageUrl?: string | null
  }>
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
  const plan = await stageRunner.do('planning', async () => (
    input.subquestions?.length && !input.briefFile
      ? input.subquestions.map(({ id, question }) => ({ id, question, searchQuery: question }))
      : await services.plan(input)
  ))
  await checkpoints.save('planning', {
    subquestionCount: plan.length,
    subquestions: plan,
  })

  const searchedCandidates = await stageRunner.do(
    'searching',
    async () => await services.search(input, plan),
  )
  const candidates = input.referenceUrl
    ? [{
        url: input.referenceUrl,
        title: '用户指定案例页',
        subquestionId: plan[0]?.id,
      }, ...searchedCandidates]
    : searchedCandidates
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
  await checkpoints.save('verifying', {
    verifiedFindingCount: verified.length,
    findings: verified,
  })

  const coverage = await stageRunner.do(
    'gap_check',
    async () => await services.checkCoverage(plan, verified),
  )
  await checkpoints.save('gap_check', {
    coverageSatisfied: coverage.coverageSatisfied,
    enrichmentSatisfied: coverage.enrichmentSatisfied,
    gapCount: coverage.gaps.length,
    coverage,
  })

  const composed = await stageRunner.do(
    'composing',
    async () => await services.compose(input, plan, verified, coverage),
  )
  const sourceByUrl = new Map(sources.map((source) => [source.url, source]))
  const enriched = {
    ...composed,
    sections: composed.sections.map((section) => ({
      ...section,
      rationale: input.subquestions?.find(({ id }) => id === section.id)?.rationale,
      facts: section.facts.map((fact) => {
        const source = sourceByUrl.get(fact.sourceUrl)
        return {
          ...fact,
          sourceTitle: source?.title,
          imageUrl: source?.imageUrl ?? null,
        }
      }),
    })),
  }
  const evidenceBound = enriched.sections.every(hasBoundEvidence)
  const completed = coverage.coverageSatisfied
    && coverage.enrichmentSatisfied
    && evidenceBound
  await checkpoints.save('composing', {
    sectionCount: enriched.sections.length,
    evidenceBound,
    composed: enriched,
  })

  return {
    runId: input.runId,
    workspaceId: input.workspaceId,
    question: input.question,
    goal: input.goal,
    mode: input.mode,
    subquestions: plan.map((subquestion) => ({
      ...subquestion,
      rationale: input.subquestions?.find(({ id }) => id === subquestion.id)?.rationale
        ?? '根据公开来源核对这一研究方向。',
    })),
    status: completed ? 'completed' as const : 'partial' as const,
    summary: enriched.summary,
    sections: enriched.sections,
    coverage: {
      ...coverage,
      gaps: evidenceBound
        ? coverage.gaps
        : [...coverage.gaps, '存在未绑定来源 URL 与逐字引文的事实'],
    },
  }
}
