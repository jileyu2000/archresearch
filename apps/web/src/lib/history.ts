export type ResearchMode = 'quick' | 'balanced' | 'deep'
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

export interface BrowserRunRecord {
  schemaVersion: 1
  id: string
  question: string
  mode: ResearchMode
  status: RunStatus
  checkpointStage: string | null
  createdAt: string
  updatedAt: string
}

export interface EvidenceFact {
  statement: string
  sourceUrl: string
  quote: string
}

export interface BrowserResultRecord {
  schemaVersion: 1
  id: string
  runId: string
  title: string
  facts: EvidenceFact[]
}

export interface BrowserCollectionRecord {
  schemaVersion: 1
  id: string
  runId: string
  resultId: string
  question: string
  savedAt: string
}

interface BrowserBackup {
  format: 'archresearch-web-backup'
  version: 1
  exportedAt: string
  runs: BrowserRunRecord[]
  results: BrowserResultRecord[]
  collections: BrowserCollectionRecord[]
}

interface BrowserHistoryOptions {
  indexedDB: IDBFactory
  databaseName?: string
}

const databaseVersion = 1
const defaultDatabaseName = 'archresearch-web'

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

function sanitizeRun(run: BrowserRunRecord): BrowserRunRecord {
  return {
    schemaVersion: 1,
    id: run.id,
    question: run.question,
    mode: run.mode,
    status: run.status,
    checkpointStage: run.checkpointStage,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
  }
}

function sanitizeResult(result: BrowserResultRecord): BrowserResultRecord {
  return {
    schemaVersion: 1,
    id: result.id,
    runId: result.runId,
    title: result.title,
    facts: result.facts.map((fact) => ({
      statement: fact.statement,
      sourceUrl: fact.sourceUrl,
      quote: fact.quote,
    })),
  }
}

function sanitizeCollection(collection: BrowserCollectionRecord): BrowserCollectionRecord {
  return {
    schemaVersion: 1,
    id: collection.id,
    runId: collection.runId,
    resultId: collection.resultId,
    question: collection.question,
    savedAt: collection.savedAt,
  }
}

function parseBackup(value: unknown): BrowserBackup {
  if (
    typeof value !== 'object'
    || value === null
    || !('format' in value)
    || value.format !== 'archresearch-web-backup'
    || !('version' in value)
    || value.version !== 1
    || !('runs' in value)
    || !Array.isArray(value.runs)
    || !('results' in value)
    || !Array.isArray(value.results)
    || !('collections' in value)
    || !Array.isArray(value.collections)
  ) {
    throw new Error('这不是可识别的 ArchResearch 网页版备份。')
  }
  return value as BrowserBackup
}

export function createBrowserHistoryStore(options: BrowserHistoryOptions) {
  let database: IDBDatabase | null = null

  const open = async () => {
    if (database) return database
    const request = options.indexedDB.open(
      options.databaseName ?? defaultDatabaseName,
      databaseVersion,
    )
    request.onupgradeneeded = () => {
      const nextDatabase = request.result
      if (!nextDatabase.objectStoreNames.contains('runs')) {
        nextDatabase.createObjectStore('runs', { keyPath: 'id' })
      }
      if (!nextDatabase.objectStoreNames.contains('results')) {
        const results = nextDatabase.createObjectStore('results', { keyPath: 'id' })
        results.createIndex('runId', 'runId')
      }
      if (!nextDatabase.objectStoreNames.contains('collections')) {
        nextDatabase.createObjectStore('collections', { keyPath: 'id' })
      }
    }
    database = await requestResult(request)
    return database
  }

  const put = async (
    storeName: 'runs' | 'results' | 'collections',
    value: BrowserRunRecord | BrowserResultRecord | BrowserCollectionRecord,
  ) => {
    const currentDatabase = await open()
    const transaction = currentDatabase.transaction(storeName, 'readwrite')
    transaction.objectStore(storeName).put(value)
    await transactionComplete(transaction)
  }

  const getAll = async <T>(storeName: 'runs' | 'results' | 'collections') => {
    const currentDatabase = await open()
    const transaction = currentDatabase.transaction(storeName, 'readonly')
    const records = await requestResult(transaction.objectStore(storeName).getAll()) as T[]
    await transactionComplete(transaction)
    return records
  }

  return {
    saveRun(run: BrowserRunRecord) {
      return put('runs', sanitizeRun(run))
    },

    saveResult(result: BrowserResultRecord) {
      return put('results', sanitizeResult(result))
    },

    saveCollection(collection: BrowserCollectionRecord) {
      return put('collections', sanitizeCollection(collection))
    },

    async getRun(runId: string) {
      const currentDatabase = await open()
      const transaction = currentDatabase.transaction('runs', 'readonly')
      const run = await requestResult(
        transaction.objectStore('runs').get(runId),
      ) as BrowserRunRecord | undefined
      await transactionComplete(transaction)
      return run
    },

    async listRuns() {
      const runs = await getAll<BrowserRunRecord>('runs')
      return runs.sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    },

    async getResults(runId: string) {
      const currentDatabase = await open()
      const transaction = currentDatabase.transaction('results', 'readonly')
      const results = await requestResult(
        transaction.objectStore('results').index('runId').getAll(runId),
      ) as BrowserResultRecord[]
      await transactionComplete(transaction)
      return results
    },

    listCollections() {
      return getAll<BrowserCollectionRecord>('collections')
    },

    async exportBackup() {
      const [runs, results, collections] = await Promise.all([
        getAll<BrowserRunRecord>('runs'),
        getAll<BrowserResultRecord>('results'),
        getAll<BrowserCollectionRecord>('collections'),
      ])
      const backup: BrowserBackup = {
        format: 'archresearch-web-backup',
        version: 1,
        exportedAt: new Date().toISOString(),
        runs,
        results,
        collections,
      }
      return new Blob([JSON.stringify(backup)], { type: 'application/json' })
    },

    async importBackup(file: Blob) {
      const backup = parseBackup(JSON.parse(await file.text()) as unknown)
      const currentDatabase = await open()
      const transaction = currentDatabase.transaction(
        ['runs', 'results', 'collections'],
        'readwrite',
      )
      const runs = transaction.objectStore('runs')
      const results = transaction.objectStore('results')
      const collections = transaction.objectStore('collections')
      runs.clear()
      results.clear()
      collections.clear()
      backup.runs.map(sanitizeRun).forEach((run) => runs.put(run))
      backup.results.map(sanitizeResult).forEach((result) => results.put(result))
      backup.collections.map(sanitizeCollection).forEach((collection) => {
        collections.put(collection)
      })
      await transactionComplete(transaction)
    },

    close() {
      database?.close()
      database = null
    },
  }
}

export type BrowserHistoryStore = ReturnType<typeof createBrowserHistoryStore>
