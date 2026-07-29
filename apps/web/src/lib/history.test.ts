import { afterEach, describe, expect, it } from 'vitest'

import { createBrowserHistoryStore } from './history'

const databaseNames: string[] = []

function databaseName(label: string) {
  const name = `archresearch-web-${label}-${crypto.randomUUID()}`
  databaseNames.push(name)
  return name
}

afterEach(async () => {
  await Promise.all(databaseNames.splice(0).map(
    (name) => new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(name)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
      request.onblocked = () => resolve()
    }),
  ))
})

describe('browser-local research history', () => {
  it('persists runs, evidence-bound results, and collections in IndexedDB', async () => {
    const store = createBrowserHistoryStore({ indexedDB, databaseName: databaseName('persist') })
    await store.saveRun({
      schemaVersion: 1,
      id: 'run-1',
      question: '旧厂房如何植入新的公共功能？',
      mode: 'balanced',
      status: 'completed',
      checkpointStage: 'composing',
      createdAt: '2026-07-29T01:00:00.000Z',
      updatedAt: '2026-07-29T01:05:00.000Z',
    })
    await store.saveResult({
      schemaVersion: 1,
      id: 'result-1',
      runId: 'run-1',
      title: '保留结构网格并嵌入独立公共盒子',
      facts: [{
        statement: '新体量与旧结构保持可读的构造间隙。',
        sourceUrl: 'https://example.com/project',
        quote: 'The new volume is set apart from the existing frame.',
      }],
    })
    await store.saveCollection({
      schemaVersion: 1,
      id: 'collection-1',
      runId: 'run-1',
      resultId: 'result-1',
      question: '旧厂房如何植入新的公共功能？',
      savedAt: '2026-07-29T01:06:00.000Z',
    })

    await expect(store.listRuns()).resolves.toEqual([
      expect.objectContaining({ id: 'run-1', status: 'completed' }),
    ])
    await expect(store.getResults('run-1')).resolves.toEqual([
      expect.objectContaining({
        id: 'result-1',
        facts: [expect.objectContaining({
          sourceUrl: 'https://example.com/project',
          quote: expect.stringContaining('existing frame'),
        })],
      }),
    ])
    await expect(store.listCollections()).resolves.toEqual([
      expect.objectContaining({ id: 'collection-1', resultId: 'result-1' }),
    ])
    store.close()
  })

  it('exports a versioned backup and imports it into another browser database', async () => {
    const source = createBrowserHistoryStore({ indexedDB, databaseName: databaseName('source') })
    await source.saveRun({
      schemaVersion: 1,
      id: 'run-export',
      question: '高差场地如何组织公共流线？',
      mode: 'quick',
      status: 'partial',
      checkpointStage: 'gap_check',
      createdAt: '2026-07-29T02:00:00.000Z',
      updatedAt: '2026-07-29T02:03:00.000Z',
    })

    const backup = await source.exportBackup()
    const payload = JSON.parse(await backup.text()) as Record<string, unknown>
    expect(payload).toMatchObject({
      format: 'archresearch-web-backup',
      version: 1,
    })
    expect(JSON.stringify(payload)).not.toMatch(/api[_-]?key|provider[_-]?key|turnstile[_-]?secret/i)

    const target = createBrowserHistoryStore({ indexedDB, databaseName: databaseName('target') })
    await target.importBackup(backup)
    await expect(target.getRun('run-export')).resolves.toEqual(
      expect.objectContaining({
        question: '高差场地如何组织公共流线？',
        checkpointStage: 'gap_check',
      }),
    )
    source.close()
    target.close()
  })
})
