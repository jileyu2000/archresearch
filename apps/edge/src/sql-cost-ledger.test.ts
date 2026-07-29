import { describe, expect, it } from 'vitest'

import { SqlCostLedger } from './sql-cost-ledger'

class SqliteLedgerFixture {
  ledger: {
    day: string
    enabled: number
    spentMicros: number
  } | null = null
  readonly reservations = new Map<string, number>()

  exec(query: string, ...bindings: unknown[]) {
    const normalized = query.replace(/\s+/g, ' ').trim().toUpperCase()
    if (normalized.startsWith('CREATE TABLE')) return []
    if (normalized.startsWith('SELECT DAY, ENABLED, SPENT_MICROS')) {
      return this.ledger === null ? [] : [{
        day: this.ledger.day,
        enabled: this.ledger.enabled,
        spent_micros: this.ledger.spentMicros,
      }]
    }
    if (normalized.startsWith('INSERT INTO COST_GUARD_LEDGER')) {
      this.ledger = {
        day: bindings[0] as string,
        enabled: bindings[1] as number,
        spentMicros: bindings[2] as number,
      }
      return []
    }
    if (normalized.startsWith('SELECT MAXIMUM_MICROS FROM COST_GUARD_RESERVATIONS')) {
      const maximumMicros = this.reservations.get(bindings[0] as string)
      return maximumMicros === undefined ? [] : [{ maximum_micros: maximumMicros }]
    }
    if (normalized.startsWith('SELECT COALESCE(SUM(MAXIMUM_MICROS), 0) AS RESERVED_MICROS')) {
      return [{
        reserved_micros: [...this.reservations.values()]
          .reduce((total, value) => total + value, 0),
      }]
    }
    if (normalized.startsWith('INSERT INTO COST_GUARD_RESERVATIONS')) {
      this.reservations.set(bindings[0] as string, bindings[1] as number)
      return []
    }
    if (normalized.startsWith('DELETE FROM COST_GUARD_RESERVATIONS')) {
      this.reservations.delete(bindings[0] as string)
      return []
    }
    throw new Error(`Unexpected SQL: ${query}`)
  }
}

describe('CostGuard Durable Object SQLite ledger', () => {
  it('persists reservations across object reconstruction without a monetary ceiling', () => {
    const sql = new SqliteLedgerFixture()
    const firstObject = new SqlCostLedger(sql, {
      enabled: true,
    })

    expect(firstObject.reserve({ runId: 'run-before-restart', reservedCostUsd: 0.7 }))
      .toEqual({ accepted: true, reservedUsd: 0.7 })

    const reconstructedObject = new SqlCostLedger(sql, {
      enabled: true,
    })

    expect(reconstructedObject.reserve({ runId: 'run-after-restart', reservedCostUsd: 0.4 }))
      .toEqual({ accepted: true, reservedUsd: 0.4 })

    expect(reconstructedObject.reserve({ runId: 'run-over-former-ceiling', reservedCostUsd: 2.5 }))
      .toEqual({ accepted: true, reservedUsd: 2.5 })
  })

  it('settles a terminal run once, charging its reservation when no actual cost is available', () => {
    const sql = new SqliteLedgerFixture()
    const ledger = new SqlCostLedger(sql, {
      enabled: true,
    })

    expect(ledger.reserve({ runId: 'run-cancelled', reservedCostUsd: 0.6 }))
      .toEqual({ accepted: true, reservedUsd: 0.6 })

    ledger.settle({ runId: 'run-cancelled' })
    ledger.settle({ runId: 'run-cancelled' })

    expect(ledger.snapshot()).toMatchObject({
      spentUsd: 0.6,
      reservedUsd: 0,
    })
    expect(ledger.reserve({ runId: 'run-after-cancel', reservedCostUsd: 0.5 }))
      .toEqual({ accepted: true, reservedUsd: 0.5 })
  })
})
