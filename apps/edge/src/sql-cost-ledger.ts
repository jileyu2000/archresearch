import type { CostReservation, ReserveCostInput, SettleCostInput } from './cost-gate'

interface SqlExecutor {
  exec(query: string, ...bindings: unknown[]): Iterable<Record<string, unknown>>
}

interface LedgerOptions {
  enabled: boolean
  now?: () => Date
}

interface LedgerState {
  day: string
  enabled: boolean
  spentMicros: number
}

const microsPerUsd = 1_000_000

function first(rows: Iterable<Record<string, unknown>>) {
  return rows[Symbol.iterator]().next().value as Record<string, unknown> | undefined
}

function toMicros(value: number) {
  return Math.round(Math.max(0, value) * microsPerUsd)
}

function toUsd(value: number) {
  return value / microsPerUsd
}

function dayFor(date: Date) {
  return date.toISOString().slice(0, 10)
}

export class SqlCostLedger {
  private readonly now: () => Date

  constructor(
    private readonly sql: SqlExecutor,
    private readonly options: LedgerOptions,
  ) {
    this.now = options.now ?? (() => new Date())
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS cost_guard_ledger (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        day TEXT NOT NULL,
        enabled INTEGER NOT NULL,
        spent_micros INTEGER NOT NULL
      )
    `)
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS cost_guard_reservations (
        run_id TEXT PRIMARY KEY,
        maximum_micros INTEGER NOT NULL
      )
    `)
  }

  reserve(input: ReserveCostInput): CostReservation {
    const state = this.currentState()
    if (!state.enabled) return { accepted: false, reason: 'service_paused' }

    const reservedMicros = toMicros(input.reservedCostUsd)

    const existing = first(this.sql.exec(
      'SELECT maximum_micros FROM cost_guard_reservations WHERE run_id = ?',
      input.runId,
    ))
    if (existing) {
      return { accepted: true, reservedUsd: toUsd(existing.maximum_micros as number) }
    }

    this.sql.exec(
      'INSERT INTO cost_guard_reservations (run_id, maximum_micros) VALUES (?, ?)',
      input.runId,
      reservedMicros,
    )
    return { accepted: true, reservedUsd: toUsd(reservedMicros) }
  }

  settle(input: Partial<SettleCostInput> & { runId: string }) {
    const state = this.currentState()
    const existing = first(this.sql.exec(
      'SELECT maximum_micros FROM cost_guard_reservations WHERE run_id = ?',
      input.runId,
    ))
    if (!existing) return

    this.sql.exec('DELETE FROM cost_guard_reservations WHERE run_id = ?', input.runId)
    state.spentMicros += input.actualCostUsd === undefined
      ? existing.maximum_micros as number
      : toMicros(input.actualCostUsd)
    this.writeState(state)
  }

  release(runId: string) {
    this.currentState()
    this.sql.exec('DELETE FROM cost_guard_reservations WHERE run_id = ?', runId)
  }

  setEnabled(enabled: boolean) {
    const state = this.currentState()
    state.enabled = enabled
    this.writeState(state)
    return { enabled }
  }

  snapshot() {
    const state = this.currentState()
    const reserved = first(this.sql.exec(
      'SELECT COALESCE(SUM(maximum_micros), 0) AS reserved_micros FROM cost_guard_reservations',
    ))
    return {
      day: state.day,
      enabled: state.enabled,
      spentUsd: toUsd(state.spentMicros),
      reservedUsd: toUsd(reserved?.reserved_micros as number ?? 0),
    }
  }

  private currentState(): LedgerState {
    const stored = first(this.sql.exec(
      'SELECT day, enabled, spent_micros FROM cost_guard_ledger WHERE id = 1',
    ))
    const currentDay = dayFor(this.now())
    if (!stored) {
      const state = {
        day: currentDay,
        enabled: this.options.enabled,
        spentMicros: 0,
      }
      this.writeState(state)
      return state
    }

    const state = {
      day: stored.day as string,
      enabled: stored.enabled === 1,
      spentMicros: stored.spent_micros as number,
    }
    if (state.day === currentDay) return state

    state.day = currentDay
    state.spentMicros = 0
    this.sql.exec('DELETE FROM cost_guard_reservations')
    this.writeState(state)
    return state
  }

  private writeState(state: LedgerState) {
    this.sql.exec(`
      INSERT INTO cost_guard_ledger (id, day, enabled, spent_micros)
      VALUES (1, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        day = excluded.day,
        enabled = excluded.enabled,
        spent_micros = excluded.spent_micros
    `, state.day, state.enabled ? 1 : 0, state.spentMicros)
  }
}
