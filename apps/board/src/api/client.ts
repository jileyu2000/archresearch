export type ResearchGoal = 'precedent_research' | 'visual_reference_search'
export type ResearchMode = 'quick' | 'balanced' | 'deep'
export type ResearchSource = 'xiaohongshu' | 'public_web'
export type RunStatus =
  | 'created'
  | 'planning'
  | 'searching'
  | 'inspecting'
  | 'analyzing'
  | 'verifying'
  | 'gap_check'
  | 'composing'
  | 'completed'
  | 'partial'
  | 'blocked'
  | 'cancelled'
  | 'failed'

export type ArchitectureAssetType =
  | 'plan'
  | 'section'
  | 'elevation'
  | 'site_plan'
  | 'axonometric'
  | 'circulation'
  | 'analysis_diagram'
  | 'render'
  | 'photograph'

export interface Workspace {
  id: string
  name: string
  brief?: string
  constraints?: string[]
  archived_at?: string | null
  created_at?: string
  updated_at?: string
}

export interface WorkspaceCreateInput {
  name: string
  brief?: string
  constraints?: string[]
}

export interface StartResearchInput {
  workspaceId: string
  question: string
  referenceUrl?: string
  files?: File[]
  goal: ResearchGoal
  mode: ResearchMode
  researchSources?: ResearchSource[]
  subquestions?: ResearchSubquestion[]
}

export interface ProjectBriefReviewInput {
  workspaceId: string
  question: string
  mode: ResearchMode
  file: File
}

export interface ProjectBriefReview {
  filename: string
  page_count: number
  project_summary: string
  project_boundaries: string[]
  subquestions: ResearchSubquestion[]
}

export interface CoverageReport {
  usable_assets?: number
  project_count?: number
  verified_or_partial?: number
  subquestion_count?: number
  covered_subquestions?: number
  multi_asset_projects?: number
  subquestion_passes?: Record<string, number>
  gaps?: string[]
  enrichment_gaps?: string[]
  synthesis?: ResearchSynthesis
}

export interface ResearchSynthesisFinding {
  statement: string
  evidence_asset_ids: string[]
}

export interface ResearchSynthesis {
  answer: ResearchSynthesisFinding
  causal_chains: ResearchSynthesisFinding[]
  comparisons: ResearchSynthesisFinding[]
  conflicts: ResearchSynthesisFinding[]
  applicability_boundaries: ResearchSynthesisFinding[]
  recommendations: ResearchSynthesisFinding[]
  generation_mode?: string
}

export interface ResearchSubquestion {
  id: string
  question: string
  rationale: string
}

export interface ResearchRun {
  id: string
  workspaceId?: string
  question: string
  title?: string
  goal: ResearchGoal
  status: RunStatus
  mode: ResearchMode
  researchSources?: ResearchSource[]
  subquestions: ResearchSubquestion[]
  budget?: Record<string, number>
  checkpointStage?: string | null
  coverageReport?: CoverageReport
  stopReason?: string | null
  attempt?: number
  keepForever?: boolean
  retentionExpiresAt?: string | null
  createdAt?: string
  updatedAt?: string
}

interface ApiResearchRun {
  id: string
  workspace_id?: string
  question: string
  title?: string
  goal: ResearchGoal
  status: RunStatus
  budget_mode: ResearchMode
  research_sources?: ResearchSource[]
  subquestions?: ResearchSubquestion[]
  budget?: Record<string, number>
  checkpoint_stage?: string | null
  coverage_report?: CoverageReport
  stop_reason?: string | null
  attempt?: number
  keep_forever?: boolean
  retention_expires_at?: string | null
  created_at?: string
  updated_at?: string
}

export interface ApiEvidenceClaim {
  id: string
  asset_candidate_id: string
  claim_type: 'fact' | 'observation' | 'inference' | 'limitation'
  statement: string
  source_url: string | null
  pdf_page: number | null
  text_excerpt: string | null
  image_region: Record<string, number> | null
  created_at?: string
}

export interface ApiSubquestionAnalysis {
  project_name_zh?: string
  project_context?: string
  design_mechanism?: string
  transfer_strategy?: string[]
  observations?: string[]
  limitations?: string[]
}

export interface ApiAssetCandidate {
  id: string
  run_id: string
  project_name: string
  asset_type: ArchitectureAssetType
  source_url: string
  image_url: string | null
  visual_reference?: boolean
  has_local_content?: boolean
  publication_tier: 'primary' | 'trusted_secondary' | 'aggregator' | 'unknown'
  project_identity: 'confirmed' | 'probable' | 'unknown' | 'conflict'
  asset_association: 'confirmed' | 'probable' | 'unknown' | 'conflict'
  primary_source: 'confirmed' | 'candidate' | 'unknown'
  rights_status: 'user_owned' | 'open_license' | 'permissioned' | 'unknown' | 'restricted'
  result_tier: 'verified' | 'partial' | 'visual_lead'
  relevance: number
  subquestion_ids?: string[]
  project_context?: string
  design_mechanism?: string
  transfer_strategy?: string[]
  subquestion_analysis?: Record<string, ApiSubquestionAnalysis>
  facts: string[]
  observations: string[]
  inferences: string[]
  limitations: string[]
  rank_index: number
  evidence_claims: ApiEvidenceClaim[]
}

export interface ApiReferenceBoard {
  id: string
  run_id: string
  selected_asset_ids: string[]
  layout?: 'grid' | 'columns' | 'sequence'
  notes?: string
}

export interface SavedReferenceState {
  asset_candidate_id: string
  note: string
}

export interface RejectedReferenceState {
  asset_candidate_id: string
  reason: string
}

export interface RunUserState {
  saved: SavedReferenceState[]
  rejected: RejectedReferenceState[]
}

export interface PersonalCollectionSnapshot {
  question?: string
  goal?: ResearchGoal
  project_name?: string
  asset_type?: ArchitectureAssetType
  image_url?: string | null
  collection_file?: string
  result_tier?: ApiAssetCandidate['result_tier']
  visual_observation?: string
  project_context?: string
  design_mechanism?: string
  transfer_strategy?: string[]
  limitations?: string[]
  visual_directions?: string[]
  case_images?: PersonalCollectionCaseImage[]
  case_subquestions?: PersonalCollectionCaseSubquestion[]
  rights_status?: ApiAssetCandidate['rights_status']
}

export interface PersonalCollectionCaseImage {
  asset_id: string
  asset_type: ArchitectureAssetType
  image_url: string
  source_url: string
}

export interface PersonalCollectionCaseEvidence {
  statement: string
  text_excerpt: string
  source_url: string | null
}

export interface PersonalCollectionCaseSubquestion {
  id: string
  question: string
  project_name_zh?: string
  project_context: string
  design_mechanism: string
  transfer_strategy: string[]
  limitations: string[]
  evidence?: PersonalCollectionCaseEvidence
}

export interface PersonalCollection {
  id: string
  workspace_id: string
  asset_candidate_id: string
  source_url: string
  note: string
  snapshot: PersonalCollectionSnapshot
  created_at: string
}

export interface TraceEvent {
  id: string
  sequence: number
  stage: string
  tool: string
  duration_ms: number
  cost_usd: number
  retry_count: number
  summary: string
  created_at?: string
}

export interface StyleProfilePayload {
  palette: string[]
  line_weights: Record<string, number>
  texture: string
  font_category: string
  layout_notes: string
}

export interface ApiStyleProfile extends StyleProfilePayload {
  id: string
  board_id: string
  created_at?: string
  updated_at?: string
}

export interface BoardExport {
  id: string
  board_id: string
  mode: 'private' | 'share'
  path: string
  browser_url: string
  manifest_path: string
  item_count: number
}

export interface WorkspaceBackupPreflight {
  ready: boolean
  format_version: number
  schema_revision: string
  file_count: number
  total_bytes: number
  categories: Record<string, number>
  workspace_count: number
  run_count: number
  collection_count: number
  input_artifact_count: number
}

export interface WorkspaceRestoreResult extends WorkspaceBackupPreflight {
  restored: boolean
  rollback_backup: string
}

export interface BrowserStatus {
  connected: boolean
  xiaohongshu_search_available: boolean
}

export interface BrowserPairingCode {
  code: string
  expires_in_seconds: number
}

export interface ChromeLaunchResult {
  opened: boolean
}

export class ApiError extends Error {
  readonly status: number | null

  constructor(message: string, status: number | null, options?: ErrorOptions) {
    super(message, options)
    this.name = 'ApiError'
    this.status = status
  }
}

function normalizeRun(run: ApiResearchRun): ResearchRun {
  return {
    id: run.id,
    workspaceId: run.workspace_id,
    question: run.question,
    title: run.title?.trim() || run.question,
    goal: run.goal,
    status: run.status,
    mode: run.budget_mode,
    researchSources: run.research_sources ?? [],
    subquestions: run.subquestions ?? [],
    budget: run.budget,
    checkpointStage: run.checkpoint_stage,
    coverageReport: run.coverage_report,
    stopReason: run.stop_reason,
    attempt: run.attempt,
    keepForever: run.keep_forever ?? false,
    retentionExpiresAt: run.retention_expires_at,
    createdAt: run.created_at,
    updatedAt: run.updated_at,
  }
}

async function errorFromResponse(response: Response) {
  let message = `Local API returned ${response.status}`
  try {
    const body = (await response.json()) as { detail?: unknown }
    if (typeof body.detail === 'string' && body.detail) message = body.detail
  } catch {
    // The status code remains the useful diagnostic when the body is not JSON.
  }
  return new ApiError(message, response.status)
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await requestResponse(path, init)
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

async function requestResponse(path: string, init?: RequestInit): Promise<Response> {
  let response: Response
  try {
    response = await fetch(path, init)
  } catch (error) {
    throw new ApiError('无法连接本地 ArchResearch 服务。', null, { cause: error })
  }
  if (!response.ok) throw await errorFromResponse(response)
  return response
}

export function createApiClient(baseUrl = '/v1') {
  return {
    getBrowserStatus() {
      return request<BrowserStatus>(`${baseUrl}/browser/status`)
    },

    createBrowserPairingCode() {
      return request<BrowserPairingCode>(`${baseUrl}/browser/pairing-code`, {
        method: 'POST',
      })
    },

    openChromeBoard() {
      return request<ChromeLaunchResult>(`${baseUrl}/browser/open-chrome`, {
        method: 'POST',
      })
    },

    async downloadWorkspaceBackup() {
      const response = await requestResponse(`${baseUrl}/data-backups`, { method: 'POST' })
      const disposition = response.headers.get('content-disposition') ?? ''
      const filename = disposition.match(/filename="?([^";]+)"?/i)?.[1]
        ?? 'archresearch-backup.zip'
      return { blob: await response.blob(), filename }
    },

    preflightWorkspaceBackup(file: File) {
      const body = new FormData()
      body.append('file', file)
      return request<WorkspaceBackupPreflight>(`${baseUrl}/data-backups/preflight`, {
        method: 'POST',
        body,
      })
    },

    restoreWorkspaceBackup(file: File) {
      const body = new FormData()
      body.append('file', file)
      body.append('confirmation', 'restore-verified-backup')
      return request<WorkspaceRestoreResult>(`${baseUrl}/data-backups/restore`, {
        method: 'POST',
        body,
      })
    },

    listWorkspaces() {
      return request<Workspace[]>(`${baseUrl}/workspaces`)
    },

    createWorkspace(input: WorkspaceCreateInput) {
      return request<Workspace>(`${baseUrl}/workspaces`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      })
    },

    ensureDefaultWorkspace() {
      return request<Workspace>(`${baseUrl}/workspaces/default`, {
        method: 'POST',
      })
    },

    async listRuns(workspaceId: string): Promise<ResearchRun[]> {
      const runs = await request<ApiResearchRun[]>(`${baseUrl}/workspaces/${workspaceId}/runs`)
      return runs.map(normalizeRun)
    },

    async startResearch(input: StartResearchInput): Promise<ResearchRun> {
      if (input.referenceUrl) {
        await request(`${baseUrl}/workspaces/${input.workspaceId}/inputs`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ url: input.referenceUrl }),
        })
      }

      for (const file of input.files ?? []) {
        const form = new FormData()
        form.append('file', file)
        await request(`${baseUrl}/workspaces/${input.workspaceId}/inputs`, {
          method: 'POST',
          body: form,
        })
      }

      const run = await request<ApiResearchRun>(
        `${baseUrl}/workspaces/${input.workspaceId}/runs`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            question: input.question,
            goal: input.goal,
            budget_mode: input.mode,
            research_sources: input.researchSources ?? [],
            subquestions: input.subquestions,
          }),
        },
      )
      return normalizeRun(run)
    },

    reviewProjectBrief(input: ProjectBriefReviewInput) {
      const form = new FormData()
      form.append('question', input.question)
      form.append('budget_mode', input.mode)
      form.append('file', input.file)
      return request<ProjectBriefReview>(
        `${baseUrl}/workspaces/${input.workspaceId}/brief-review`,
        {
          method: 'POST',
          body: form,
        },
      )
    },

    async getRun(runId: string) {
      return normalizeRun(await request<ApiResearchRun>(`${baseUrl}/runs/${runId}`))
    },

    async updateRunRetention(runId: string, permanent: boolean) {
      return normalizeRun(
        await request<ApiResearchRun>(`${baseUrl}/runs/${runId}/retention`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ permanent }),
        }),
      )
    },

    async cancelRun(runId: string) {
      return normalizeRun(
        await request<ApiResearchRun>(`${baseUrl}/runs/${runId}/cancel`, { method: 'POST' }),
      )
    },

    async retryRun(runId: string) {
      return normalizeRun(
        await request<ApiResearchRun>(`${baseUrl}/runs/${runId}/retry`, { method: 'POST' }),
      )
    },

    getResults(runId: string) {
      return request<ApiAssetCandidate[]>(`${baseUrl}/runs/${runId}/results`)
    },

    getBoard(runId: string) {
      return request<ApiReferenceBoard>(`${baseUrl}/runs/${runId}/board`)
    },

    updateBoard(runId: string, selectedAssetIds: string[]) {
      return request<ApiReferenceBoard>(`${baseUrl}/runs/${runId}/board`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ selected_asset_ids: selectedAssetIds }),
      })
    },

    async getEvents(runId: string): Promise<TraceEvent[]> {
      let response: Response
      try {
        response = await fetch(`${baseUrl}/runs/${runId}/events`)
      } catch (error) {
        throw new ApiError('无法读取研究过程记录。', null, { cause: error })
      }
      if (!response.ok) throw await errorFromResponse(response)
      const text = await response.text()
      return text
        .split(/\r?\n/)
        .filter((line) => line.startsWith('data: '))
        .map((line) => JSON.parse(line.slice(6)) as TraceEvent)
    },

    getUserState(runId: string) {
      return request<RunUserState>(`${baseUrl}/runs/${runId}/user-state`)
    },

    listPersonalCollections(workspaceId: string) {
      return request<PersonalCollection[]>(`${baseUrl}/workspaces/${workspaceId}/collections`)
    },

    saveResult(resultId: string, note: string, subquestionIds?: string[]) {
      return request<PersonalCollection>(`${baseUrl}/results/${resultId}/save`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          note,
          ...(subquestionIds ? { subquestion_ids: subquestionIds } : {}),
        }),
      })
    },

    unsaveResult(resultId: string) {
      return request<void>(`${baseUrl}/results/${resultId}/save`, { method: 'DELETE' })
    },

    deletePersonalCollection(collectionId: string) {
      return request<void>(`${baseUrl}/collections/${collectionId}`, { method: 'DELETE' })
    },

    rejectResult(resultId: string, reason: string) {
      return request(`${baseUrl}/results/${resultId}/reject`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reason }),
      })
    },

    unrejectResult(resultId: string) {
      return request<void>(`${baseUrl}/results/${resultId}/reject`, { method: 'DELETE' })
    },

    exportBoard(boardId: string, mode: 'private' | 'share') {
      return request<BoardExport>(`${baseUrl}/boards/${boardId}/exports`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mode }),
      })
    },

    async getStyleProfile(boardId: string): Promise<ApiStyleProfile | null> {
      try {
        return await request<ApiStyleProfile>(`${baseUrl}/boards/${boardId}/style-profile`)
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) return null
        throw error
      }
    },

    async saveStyleProfile(boardId: string, profile: StyleProfilePayload) {
      const path = `${baseUrl}/boards/${boardId}/style-profile`
      try {
        return await request<ApiStyleProfile>(path, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(profile),
        })
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 404) throw error
        return request<ApiStyleProfile>(path, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(profile),
        })
      }
    },
  }
}

export type ApiClient = ReturnType<typeof createApiClient>

export let apiClient: ApiClient = createApiClient()

export function configureApiClient(client: ApiClient) {
  apiClient = client
}
