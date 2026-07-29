import {
  ApiError,
  type ApiAssetCandidate,
  type ApiClient,
  type ApiReferenceBoard,
  type ApiStyleProfile,
  type BoardExport,
  type PersonalCollection,
  type ProjectBriefReview,
  type ResearchGoal,
  type ResearchMode,
  type ResearchRun,
  type ResearchSubquestion,
  type RunUserState,
  type StyleProfilePayload,
  type TraceEvent,
  type Workspace,
  type WorkspaceBackupPreflight,
  type WorkspaceCreateInput,
  type WorkspaceRestoreResult,
} from '../../../board/src/api/client'
import {
  requestXiaohongshuSearch,
  type BrowserVisualSource,
} from '../../../board/src/browserBridge'

interface PublicClientOptions {
  indexedDB: IDBFactory
  databaseName?: string
  fetch?: typeof fetch
  clientSessionId: string
  initialVerificationToken?: string | null
  onVerificationConsumed?: () => void
  xiaohongshuSearch?: (query: string) => Promise<BrowserVisualSource[]>
}

type StoreName =
  | 'workspaces'
  | 'runs'
  | 'results'
  | 'boards'
  | 'userStates'
  | 'collections'
  | 'events'
  | 'styles'
  | 'inputs'

interface StoredResult {
  id: string
  runId: string
  value: ApiAssetCandidate
}

interface StoredState<T> {
  id: string
  value: T
}

interface PublicFact {
  statement: string
  sourceUrl: string
  quote: string
  sourceTitle?: string
  imageUrl?: string | null
  assetType?: ApiAssetCandidate['asset_type']
}

interface PublicSnapshot {
  runId: string
  status: ResearchRun['status']
  workspaceId?: string
  question?: string
  goal?: ResearchGoal
  mode?: ResearchMode
  checkpointStage?: string | null
  subquestions?: ResearchSubquestion[]
  summary?: string
  sections?: Array<{
    id: string
    title: string
    rationale?: string
    facts: PublicFact[]
  }>
  coverage?: {
    coverageSatisfied: boolean
    enrichmentSatisfied: boolean
    gaps: string[]
  }
}

interface BackupPayload {
  format: 'archresearch-public-browser-backup'
  version: 1
  exportedAt: string
  stores: Record<StoreName, unknown[]>
}

interface PendingBrief {
  filename: string
  dataUrl: string
}

const storeNames: StoreName[] = [
  'workspaces',
  'runs',
  'results',
  'boards',
  'userStates',
  'collections',
  'events',
  'styles',
  'inputs',
]

const terminalRunStatuses = new Set<ResearchRun['status']>([
  'completed',
  'partial',
  'blocked',
  'cancelled',
  'failed',
])

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'))
  })
}

function transactionComplete(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(
      transaction.error ?? new Error('IndexedDB transaction failed.'),
    )
    transaction.onabort = () => reject(
      transaction.error ?? new Error('IndexedDB transaction was aborted.'),
    )
  })
}

function dateAfterDays(days: number) {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString()
}

function sourceTitle(fact: PublicFact) {
  if (fact.sourceTitle?.trim()) return fact.sourceTitle.trim()
  try {
    return new URL(fact.sourceUrl).hostname.replace(/^www\./, '')
  } catch {
    return '公开建筑来源'
  }
}

function assetTypeFor(fact: PublicFact, sectionTitle: string) {
  if (fact.assetType) return fact.assetType
  const value = `${sectionTitle} ${fact.statement}`.toLowerCase()
  if (/剖面|section/.test(value)) return 'section'
  if (/平面|plan/.test(value)) return 'plan'
  if (/立面|elevation|facade/.test(value)) return 'elevation'
  if (/轴测|axon/.test(value)) return 'axonometric'
  if (/流线|circulation/.test(value)) return 'circulation'
  if (/分析图|diagram/.test(value)) return 'analysis_diagram'
  if (/效果图|render/.test(value)) return 'render'
  return 'photograph'
}

function resultFromFact(
  snapshot: PublicSnapshot,
  section: NonNullable<PublicSnapshot['sections']>[number],
  fact: PublicFact,
  index: number,
): ApiAssetCandidate {
  const id = `${snapshot.runId}:${section.id}:${index}`
  const visual = snapshot.goal === 'visual_reference_search'
  const project = sourceTitle(fact)
  const limitation = '请回到原始来源核对项目条件、图纸权利与当前方案的适用边界。'
  return {
    id,
    run_id: snapshot.runId,
    project_name: project,
    asset_type: assetTypeFor(fact, section.title),
    source_url: fact.sourceUrl,
    image_url: fact.imageUrl ?? null,
    visual_reference: visual,
    publication_tier: 'trusted_secondary',
    project_identity: 'probable',
    asset_association: fact.imageUrl ? 'probable' : 'unknown',
    primary_source: 'candidate',
    rights_status: 'unknown',
    result_tier: visual ? 'visual_lead' : 'verified',
    relevance: 4,
    subquestion_ids: [section.id],
    project_context: fact.statement,
    design_mechanism: fact.statement,
    transfer_strategy: [`把“${fact.statement}”转译为当前方案的可检验设计动作。`],
    subquestion_analysis: {
      [section.id]: {
        project_context: fact.statement,
        design_mechanism: fact.statement,
        transfer_strategy: [`用原始来源中的做法回应“${section.title}”。`],
        observations: visual ? [fact.statement] : [],
        limitations: [limitation],
      },
    },
    facts: [fact.statement],
    observations: visual ? [fact.statement] : [],
    inferences: [fact.statement],
    limitations: [limitation],
    rank_index: index,
    evidence_claims: [{
      id: `claim:${id}`,
      asset_candidate_id: id,
      claim_type: 'fact',
      statement: fact.statement,
      source_url: fact.sourceUrl,
      pdf_page: null,
      text_excerpt: fact.quote,
      image_region: null,
    }],
  }
}

function parseBackup(value: unknown): BackupPayload {
  if (
    typeof value !== 'object'
    || value === null
    || !('format' in value)
    || value.format !== 'archresearch-public-browser-backup'
    || !('version' in value)
    || value.version !== 1
    || !('stores' in value)
    || typeof value.stores !== 'object'
    || value.stores === null
  ) {
    throw new ApiError('这不是可识别的 ArchResearch 网页备份。', 400)
  }
  return value as BackupPayload
}

export function createPublicApiClient(options: PublicClientOptions) {
  const requestFetch = options.fetch ?? globalThis.fetch
  let database: IDBDatabase | null = null
  let verificationToken = options.initialVerificationToken ?? null
  const pendingBriefs = new Map<string, PendingBrief>()

  const open = async () => {
    if (database) return database
    const request = options.indexedDB.open(
      options.databaseName ?? 'archresearch-public-product',
      1,
    )
    request.onupgradeneeded = () => {
      for (const name of storeNames) {
        if (!request.result.objectStoreNames.contains(name)) {
          request.result.createObjectStore(name, { keyPath: 'id' })
        }
      }
    }
    database = await requestResult(request)
    return database
  }

  const getAll = async <T>(storeName: StoreName) => {
    const current = await open()
    const transaction = current.transaction(storeName, 'readonly')
    const records = await requestResult(transaction.objectStore(storeName).getAll()) as T[]
    await transactionComplete(transaction)
    return records
  }

  const get = async <T>(storeName: StoreName, id: string) => {
    const current = await open()
    const transaction = current.transaction(storeName, 'readonly')
    const record = await requestResult(transaction.objectStore(storeName).get(id)) as T | undefined
    await transactionComplete(transaction)
    return record
  }

  const put = async (storeName: StoreName, value: object) => {
    const current = await open()
    const transaction = current.transaction(storeName, 'readwrite')
    transaction.objectStore(storeName).put(value)
    await transactionComplete(transaction)
  }

  const remove = async (storeName: StoreName, id: string) => {
    const current = await open()
    const transaction = current.transaction(storeName, 'readwrite')
    transaction.objectStore(storeName).delete(id)
    await transactionComplete(transaction)
  }

  const cloudRequest = async <T>(path: string, init?: RequestInit) => {
    const response = await requestFetch(path, {
      ...init,
      cache: 'no-store',
      credentials: 'same-origin',
    })
    if (!response.ok) {
      let message = `公开研究服务返回 ${response.status}`
      try {
        const body = await response.json() as { error?: unknown }
        if (typeof body.error === 'string') message = body.error
      } catch {
        // Keep the status-based message when the response is not JSON.
      }
      throw new ApiError(message, response.status)
    }
    if (response.status === 204) return undefined as T
    return await response.json() as T
  }

  const fileAsDataUrl = async (file: File) => {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      throw new ApiError('任务书必须是 PDF 文件。', 400)
    }
    if (file.size > 4 * 1024 * 1024) {
      throw new ApiError('公开版单个任务书暂时不能超过 4 MB。', 413)
    }
    const bytes = new Uint8Array(await file.arrayBuffer())
    const signature = new TextDecoder('ascii').decode(bytes.slice(0, 5))
    if (signature !== '%PDF-') throw new ApiError('文件不是可识别的 PDF。', 400)
    let binary = ''
    for (let index = 0; index < bytes.length; index += 0x8000) {
      binary += String.fromCharCode(...bytes.slice(index, index + 0x8000))
    }
    return `data:application/pdf;base64,${btoa(binary)}`
  }

  const saveRun = async (run: ResearchRun) => {
    await put('runs', run)
    return run
  }

  const ensureBoard = async (runId: string) => {
    const existing = await get<ApiReferenceBoard>('boards', runId)
    if (existing) return existing
    const board: ApiReferenceBoard = {
      id: runId,
      run_id: runId,
      selected_asset_ids: [],
    }
    await put('boards', board)
    return board
  }

  const ensureUserState = async (runId: string) => {
    const existing = await get<StoredState<RunUserState>>('userStates', runId)
    if (existing) return existing.value
    const state: RunUserState = { saved: [], rejected: [] }
    await put('userStates', { id: runId, value: state })
    return state
  }

  const runFromSnapshot = async (snapshot: PublicSnapshot) => {
    const existing = await get<ResearchRun>('runs', snapshot.runId)
    const goal = snapshot.goal ?? existing?.goal ?? 'precedent_research'
    const rawSubquestions = snapshot.subquestions
      ?? snapshot.sections?.map((section) => ({
        id: section.id,
        question: section.title,
        rationale: section.rationale ?? '根据公开来源核对这一研究方向。',
      }))
      ?? existing?.subquestions
      ?? []
    const subquestions = goal === 'visual_reference_search'
      ? rawSubquestions.map((subquestion, index) => ({
          ...subquestion,
          question: /^(哪些|如何|怎样|什么|是否|能否)|[?？]$/.test(subquestion.question.trim())
            ? `方向 ${index + 1}：${subquestion.question.trim().replace(/[?？]+$/, '')}`
            : subquestion.question,
        }))
      : rawSubquestions
    const facts = snapshot.sections?.flatMap((section) => section.facts) ?? []
    const covered = snapshot.sections?.filter((section) => section.facts.length > 0).length ?? 0
    const evidenceIds = snapshot.sections?.flatMap((section) => (
      section.facts.map((_fact, factIndex) => `${snapshot.runId}:${section.id}:${factIndex}`)
    )) ?? []
    const now = new Date().toISOString()
    const run: ResearchRun = {
      id: snapshot.runId,
      workspaceId: snapshot.workspaceId ?? existing?.workspaceId,
      question: snapshot.question ?? existing?.question ?? '',
      title: snapshot.question ?? existing?.title ?? existing?.question ?? '',
      goal,
      status: snapshot.status,
      mode: snapshot.mode ?? existing?.mode ?? 'balanced',
      researchSources: goal === 'visual_reference_search'
        ? ['xiaohongshu']
        : existing?.researchSources ?? [],
      subquestions,
      checkpointStage: snapshot.checkpointStage ?? existing?.checkpointStage ?? null,
      coverageReport: snapshot.coverage
        ? {
            usable_assets: facts.length,
            project_count: new Set(facts.map(sourceTitle)).size,
            verified_or_partial: facts.length,
            subquestion_count: subquestions.length,
            covered_subquestions: covered,
            multi_asset_projects: 0,
            subquestion_passes: Object.fromEntries(subquestions.map(({ id }) => [id, 1])),
            gaps: snapshot.coverage.gaps,
            enrichment_gaps: snapshot.coverage.enrichmentSatisfied
              ? []
              : snapshot.coverage.gaps,
            synthesis: snapshot.summary
              ? {
                  answer: { statement: snapshot.summary, evidence_asset_ids: evidenceIds },
                  causal_chains: [],
                  comparisons: [],
                  conflicts: [],
                  applicability_boundaries: snapshot.coverage.gaps.map((statement) => ({
                    statement,
                    evidence_asset_ids: [],
                  })),
                  recommendations: facts.slice(0, 3).map((fact, index) => ({
                    statement: fact.statement,
                    evidence_asset_ids: evidenceIds[index] ? [evidenceIds[index]] : [],
                  })),
                  generation_mode: 'public_cloud',
                }
              : undefined,
          }
        : existing?.coverageReport,
      stopReason: snapshot.status === 'partial' ? 'coverage_gap' : null,
      attempt: existing?.attempt ?? 1,
      keepForever: existing?.keepForever ?? false,
      retentionExpiresAt: existing?.retentionExpiresAt ?? dateAfterDays(180),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    }
    await saveRun(run)

    if (snapshot.sections) {
      const existingResults = await getAll<StoredResult>('results')
      for (const record of existingResults.filter(({ runId }) => runId === snapshot.runId)) {
        await remove('results', record.id)
      }
      for (const section of snapshot.sections) {
        for (const [index, fact] of section.facts.entries()) {
          const value = resultFromFact(snapshot, section, fact, index)
          await put('results', { id: value.id, runId: snapshot.runId, value })
        }
      }
      await ensureBoard(snapshot.runId)
      await ensureUserState(snapshot.runId)
      const events: TraceEvent[] = [
        'planning',
        'searching',
        'inspecting',
        'analyzing',
        'verifying',
        'gap_check',
        'composing',
      ].map((stage, index) => ({
        id: `${snapshot.runId}:${stage}`,
        sequence: index + 1,
        stage,
        tool: 'public_cloud',
        duration_ms: 0,
        cost_usd: 0,
        retry_count: 0,
        summary: `${stage} checkpoint completed`,
      }))
      await put('events', { id: snapshot.runId, value: events })
    }
    return run
  }

  const client: ApiClient = {
    async getBrowserStatus() {
      return { connected: true, xiaohongshu_search_available: false }
    },

    async createBrowserPairingCode() {
      return { code: '', expires_in_seconds: 0 }
    },

    async openChromeBoard() {
      return { opened: false }
    },

    async downloadWorkspaceBackup() {
      const stores = {} as Record<StoreName, unknown[]>
      for (const name of storeNames) stores[name] = await getAll(name)
      const payload: BackupPayload = {
        format: 'archresearch-public-browser-backup',
        version: 1,
        exportedAt: new Date().toISOString(),
        stores,
      }
      return {
        blob: new Blob([JSON.stringify(payload)], { type: 'application/json' }),
        filename: `archresearch-browser-backup-${new Date().toISOString().slice(0, 10)}.json`,
      }
    },

    async preflightWorkspaceBackup(file: File): Promise<WorkspaceBackupPreflight> {
      const backup = parseBackup(JSON.parse(await file.text()) as unknown)
      const workspaces = backup.stores.workspaces ?? []
      const runs = backup.stores.runs ?? []
      const collections = backup.stores.collections ?? []
      return {
        ready: true,
        format_version: backup.version,
        schema_revision: 'public-browser-v1',
        file_count: storeNames.length,
        total_bytes: file.size,
        categories: Object.fromEntries(
          storeNames.map((name) => [name, backup.stores[name]?.length ?? 0]),
        ),
        workspace_count: workspaces.length,
        run_count: runs.length,
        collection_count: collections.length,
        input_artifact_count: backup.stores.inputs?.length ?? 0,
      }
    },

    async restoreWorkspaceBackup(file: File): Promise<WorkspaceRestoreResult> {
      const backup = parseBackup(JSON.parse(await file.text()) as unknown)
      const current = await open()
      const transaction = current.transaction(storeNames, 'readwrite')
      for (const name of storeNames) {
        const store = transaction.objectStore(name)
        store.clear()
        for (const value of backup.stores[name] ?? []) store.put(value)
      }
      await transactionComplete(transaction)
      const preflight = await client.preflightWorkspaceBackup(file)
      return {
        ...preflight,
        restored: true,
        rollback_backup: '',
      }
    },

    async listWorkspaces() {
      return (await getAll<Workspace>('workspaces'))
        .sort((left, right) => (left.created_at ?? '').localeCompare(right.created_at ?? ''))
    },

    async createWorkspace(input: WorkspaceCreateInput) {
      const now = new Date().toISOString()
      const workspace: Workspace = {
        id: `workspace-${crypto.randomUUID()}`,
        name: input.name,
        brief: input.brief,
        constraints: input.constraints ?? [],
        created_at: now,
        updated_at: now,
      }
      await put('workspaces', workspace)
      return workspace
    },

    async ensureDefaultWorkspace() {
      const existing: Workspace[] = await client.listWorkspaces()
      if (existing.length > 0) return existing[0]
      return await client.createWorkspace({ name: '建筑研究工作区' })
    },

    async listRuns(workspaceId: string) {
      return (await getAll<ResearchRun>('runs'))
        .filter((run) => run.workspaceId === workspaceId)
        .sort((left, right) => (
          (right.updatedAt ?? '').localeCompare(left.updatedAt ?? '')
        ))
    },

    async startResearch(input: Parameters<ApiClient['startResearch']>[0]) {
      const turnstileToken = verificationToken
      if (!turnstileToken) throw new ApiError('请先完成人机校验。', 403)
      const browserVisualSources = input.goal === 'visual_reference_search'
        ? await (options.xiaohongshuSearch ?? requestXiaohongshuSearch)(input.question)
        : undefined
      if (input.goal === 'visual_reference_search' && browserVisualSources?.length === 0) {
        throw new ApiError('没有从小红书读取到可用笔记。请确认 Chrome 已登录小红书并允许扩展读取网页。', 422)
      }
      const researchSources = input.goal === 'visual_reference_search'
        ? ['xiaohongshu'] as const
        : input.researchSources ?? []
      const created = await cloudRequest<{ runId: string; status: 'created' }>('/api/runs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          workspaceId: input.workspaceId,
          question: input.question,
          ...(input.referenceUrl?.trim()
            ? { referenceUrl: input.referenceUrl.trim() }
            : {}),
          goal: input.goal,
          mode: input.mode,
          researchSources,
          ...(browserVisualSources ? { browserVisualSources } : {}),
          subquestions: input.subquestions,
          briefFile: pendingBriefs.get(input.workspaceId),
          clientSessionId: options.clientSessionId,
          turnstileToken,
        }),
      })
      options.onVerificationConsumed?.()
      pendingBriefs.delete(input.workspaceId)
      const now = new Date().toISOString()
      return await saveRun({
        id: created.runId,
        workspaceId: input.workspaceId,
        question: input.question,
        title: input.question,
        goal: input.goal,
        status: created.status,
        mode: input.mode,
        researchSources: [...researchSources],
        subquestions: input.subquestions ?? [],
        checkpointStage: null,
        attempt: 1,
        keepForever: false,
        retentionExpiresAt: dateAfterDays(180),
        createdAt: now,
        updatedAt: now,
      })
    },

    async reviewProjectBrief(input: Parameters<ApiClient['reviewProjectBrief']>[0]) {
      const dataUrl = await fileAsDataUrl(input.file)
      pendingBriefs.set(input.workspaceId, {
        filename: input.file.name,
        dataUrl,
      })
      await put('inputs', {
        id: input.workspaceId,
        workspaceId: input.workspaceId,
        filename: input.file.name,
        dataUrl,
        savedAt: new Date().toISOString(),
      })
      const count = { quick: 3, balanced: 4, deep: 6 }[input.mode]
      const directions = [
        ['brief-site', '任务书中的场地、现状与周边条件如何限制设计？', '先核对场地边界与不可改变条件'],
        ['brief-program', '任务书中的功能、面积与开放关系如何组织？', '把功能要求转成可比较的空间关系'],
        ['brief-circulation', '公共、后勤与消防流线有哪些必须满足的约束？', '核对入口、连续路径与冲突节点'],
        ['brief-structure', '结构、层高或保留条件怎样影响空间策略？', '识别需要由案例回答的技术边界'],
        ['brief-climate', '气候、采光与通风要求怎样进入剖面？', '把环境要求转成可观察的设计动作'],
        ['brief-expression', '最终图纸需要清楚证明哪些设计关系？', '让案例研究直接服务于成果表达'],
      ]
      return {
        filename: input.file.name,
        page_count: 0,
        project_summary: '任务书会随本次研究发送到云端流程，用于收束问题拆解与案例检索。',
        project_boundaries: [
          `文件：${input.file.name}`,
          `大小：${Math.max(1, Math.ceil(input.file.size / 1024))} KB`,
        ],
        subquestions: directions.slice(0, count).map(([id, question, rationale]) => ({
          id,
          question: `${question}（${input.question}）`,
          rationale,
        })),
      } satisfies ProjectBriefReview
    },

    async getRun(runId: string) {
      const local = await get<ResearchRun>('runs', runId)
      if (local && terminalRunStatuses.has(local.status)) return local
      try {
        const snapshot = await cloudRequest<PublicSnapshot>(
          `/api/runs/${encodeURIComponent(runId)}`,
        )
        return await runFromSnapshot(snapshot)
      } catch (error) {
        if (local && error instanceof ApiError && error.status === 404) return local
        throw error
      }
    },

    async updateRunRetention(runId: string, permanent: boolean) {
      const run = await get<ResearchRun>('runs', runId)
      if (!run) throw new ApiError('研究记录不存在。', 404)
      return await saveRun({
        ...run,
        keepForever: permanent,
        retentionExpiresAt: permanent ? null : dateAfterDays(180),
        updatedAt: new Date().toISOString(),
      })
    },

    async cancelRun(runId: string) {
      await cloudRequest<void>(`/api/runs/${encodeURIComponent(runId)}`, {
        method: 'DELETE',
      })
      const run = await get<ResearchRun>('runs', runId)
      if (!run) throw new ApiError('研究记录不存在。', 404)
      return await saveRun({
        ...run,
        status: 'cancelled',
        updatedAt: new Date().toISOString(),
      })
    },

    async retryRun(runId: string) {
      const run = await get<ResearchRun>('runs', runId)
      if (!run?.workspaceId) throw new ApiError('研究记录不存在。', 404)
      return await client.startResearch({
        workspaceId: run.workspaceId,
        question: run.question,
        goal: run.goal,
        mode: run.mode,
        researchSources: run.researchSources,
        subquestions: run.subquestions,
      })
    },

    async getResults(runId: string) {
      return (await getAll<StoredResult>('results'))
        .filter((record) => record.runId === runId)
        .map((record) => record.value)
        .sort((left, right) => left.rank_index - right.rank_index)
    },

    async getBoard(runId: string) {
      return await ensureBoard(runId)
    },

    async updateBoard(runId: string, selectedAssetIds: string[]) {
      const board = {
        ...await ensureBoard(runId),
        selected_asset_ids: selectedAssetIds,
      }
      await put('boards', board)
      return board
    },

    async getEvents(runId: string) {
      return (await get<StoredState<TraceEvent[]>>('events', runId))?.value ?? []
    },

    async getUserState(runId: string) {
      return await ensureUserState(runId)
    },

    async listPersonalCollections(workspaceId: string) {
      return (await getAll<PersonalCollection>('collections'))
        .filter((collection) => collection.workspace_id === workspaceId)
        .sort((left, right) => right.created_at.localeCompare(left.created_at))
    },

    async saveResult(resultId: string, note: string, subquestionIds?: string[]) {
      const record = await get<StoredResult>('results', resultId)
      if (!record) throw new ApiError('研究结果不存在。', 404)
      const run = await get<ResearchRun>('runs', record.runId)
      if (!run?.workspaceId) throw new ApiError('研究记录不存在。', 404)
      const result = record.value
      const existingCollection = (await getAll<PersonalCollection>('collections')).find(
        (item) => item.workspace_id === run.workspaceId
          && item.asset_candidate_id === result.id,
      )
      const collection: PersonalCollection = {
        id: existingCollection?.id ?? `collection-${crypto.randomUUID()}`,
        workspace_id: run.workspaceId,
        asset_candidate_id: result.id,
        source_url: result.source_url,
        note,
        snapshot: {
          question: run.question,
          goal: run.goal,
          project_name: result.project_name,
          asset_type: result.asset_type,
          image_url: result.image_url,
          result_tier: result.result_tier,
          visual_observation: result.observations[0],
          project_context: result.project_context,
          design_mechanism: result.design_mechanism,
          transfer_strategy: result.transfer_strategy,
          limitations: result.limitations,
          visual_directions: run.goal === 'visual_reference_search'
            ? result.transfer_strategy
            : [],
          case_images: result.image_url
            ? [{
                asset_id: result.id,
                asset_type: result.asset_type,
                image_url: result.image_url,
                source_url: result.source_url,
              }]
            : [],
          rights_status: result.rights_status,
          case_subquestions: (subquestionIds ?? result.subquestion_ids ?? []).map((id) => {
            const subquestion = run.subquestions.find((item) => item.id === id)
            const analysis = result.subquestion_analysis?.[id]
            return {
              id,
              question: subquestion?.question ?? id,
              project_context: analysis?.project_context ?? result.project_context ?? '',
              design_mechanism: analysis?.design_mechanism ?? result.design_mechanism ?? '',
              transfer_strategy: analysis?.transfer_strategy ?? result.transfer_strategy ?? [],
              limitations: analysis?.limitations ?? result.limitations,
              evidence: result.evidence_claims[0]
                ? {
                    statement: result.evidence_claims[0].statement,
                    text_excerpt: result.evidence_claims[0].text_excerpt ?? '',
                    source_url: result.evidence_claims[0].source_url,
                  }
                : undefined,
            }
          }),
        },
        created_at: existingCollection?.created_at ?? new Date().toISOString(),
      }
      await put('collections', collection)
      const state = await ensureUserState(run.id)
      await put('userStates', {
        id: run.id,
        value: {
          ...state,
          saved: [
            ...state.saved.filter((item) => item.asset_candidate_id !== resultId),
            { asset_candidate_id: resultId, note },
          ],
        },
      })
      return collection
    },

    async unsaveResult(resultId: string) {
      const collections = await getAll<PersonalCollection>('collections')
      for (const item of collections.filter(({ asset_candidate_id }) => (
        asset_candidate_id === resultId
      ))) {
        await remove('collections', item.id)
      }
      const record = await get<StoredResult>('results', resultId)
      if (!record) return
      const state = await ensureUserState(record.runId)
      await put('userStates', {
        id: record.runId,
        value: {
          ...state,
          saved: state.saved.filter((item) => item.asset_candidate_id !== resultId),
        },
      })
    },

    async deletePersonalCollection(collectionId: string) {
      const collection = await get<PersonalCollection>('collections', collectionId)
      await remove('collections', collectionId)
      if (!collection) return
      const record = await get<StoredResult>('results', collection.asset_candidate_id)
      if (!record) return
      const state = await ensureUserState(record.runId)
      await put('userStates', {
        id: record.runId,
        value: {
          ...state,
          saved: state.saved.filter((item) => (
            item.asset_candidate_id !== collection.asset_candidate_id
          )),
        },
      })
    },

    async rejectResult(resultId: string, reason: string) {
      const record = await get<StoredResult>('results', resultId)
      if (!record) throw new ApiError('研究结果不存在。', 404)
      const state = await ensureUserState(record.runId)
      const value = {
        ...state,
        rejected: [
          ...state.rejected.filter((item) => item.asset_candidate_id !== resultId),
          { asset_candidate_id: resultId, reason },
        ],
      }
      await put('userStates', { id: record.runId, value })
      return value
    },

    async unrejectResult(resultId: string) {
      const record = await get<StoredResult>('results', resultId)
      if (!record) return
      const state = await ensureUserState(record.runId)
      await put('userStates', {
        id: record.runId,
        value: {
          ...state,
          rejected: state.rejected.filter((item) => item.asset_candidate_id !== resultId),
        },
      })
    },

    async exportBoard(boardId: string, mode: 'private' | 'share'): Promise<BoardExport> {
      const board = await ensureBoard(boardId)
      const results = await client.getResults(board.run_id)
      const selected = results.filter(({ id }) => board.selected_asset_ids.includes(id))
      const blob = new Blob([JSON.stringify({
        product: 'ArchResearch',
        mode,
        exportedAt: new Date().toISOString(),
        results: selected,
      }, null, 2)], { type: 'application/json' })
      return {
        id: `export-${crypto.randomUUID()}`,
        board_id: board.id,
        mode,
        path: `archresearch-${mode}.json`,
        browser_url: URL.createObjectURL(blob),
        manifest_path: '',
        item_count: selected.length,
      }
    },

    async getStyleProfile(boardId: string) {
      return (await get<StoredState<ApiStyleProfile>>('styles', boardId))?.value ?? null
    },

    async saveStyleProfile(boardId: string, profile: StyleProfilePayload) {
      const value: ApiStyleProfile = {
        id: `style-${boardId}`,
        board_id: boardId,
        ...profile,
        updated_at: new Date().toISOString(),
      }
      await put('styles', { id: boardId, value })
      return value
    },
  } satisfies ApiClient

  return {
    ...client,
    setVerificationToken(token: string | null) {
      verificationToken = token
    },
    close() {
      database?.close()
      database = null
    },
  }
}

export type PublicApiClient = ReturnType<typeof createPublicApiClient>
