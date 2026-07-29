export type CostRejectionReason = 'service_paused'

export type CostReservation =
  | { accepted: true; reservedUsd: number }
  | { accepted: false; reason: CostRejectionReason }

export interface ReserveCostInput {
  runId: string
  reservedCostUsd: number
}

export interface SettleCostInput {
  runId: string
  actualCostUsd: number
}

export interface CostGate {
  reserve(input: ReserveCostInput): Promise<CostReservation>
  settle(input: SettleCostInput): Promise<void>
  release(runId: string): Promise<void>
}

interface InMemoryCostGateOptions {
  enabled: boolean
  now?: () => Date
}

interface Reservation {
  reservedMicros: number
}

const microsPerUsd = 1_000_000

function toMicros(value: number) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error('Cost values must be finite and non-negative.')
  }
  return Math.round(value * microsPerUsd)
}

function toUsd(value: number) {
  return value / microsPerUsd
}

function utcDay(date: Date) {
  return date.toISOString().slice(0, 10)
}

export class InMemoryCostGate implements CostGate {
  private enabled: boolean
  private readonly now: () => Date
  private day: string
  private spentMicros = 0
  private reservations = new Map<string, Reservation>()

  constructor(options: InMemoryCostGateOptions) {
    this.enabled = options.enabled
    this.now = options.now ?? (() => new Date())
    this.day = utcDay(this.now())
  }

  async reserve(input: ReserveCostInput): Promise<CostReservation> {
    this.rollDay()
    if (!this.enabled) return { accepted: false, reason: 'service_paused' }

    const reservedMicros = toMicros(input.reservedCostUsd)

    const existing = this.reservations.get(input.runId)
    if (existing) {
      return { accepted: true, reservedUsd: toUsd(existing.reservedMicros) }
    }

    this.reservations.set(input.runId, { reservedMicros })
    return { accepted: true, reservedUsd: toUsd(reservedMicros) }
  }

  async settle(input: SettleCostInput) {
    this.rollDay()
    if (!this.reservations.has(input.runId)) {
      throw new Error(`No cost reservation exists for ${input.runId}.`)
    }
    this.reservations.delete(input.runId)
    this.spentMicros += toMicros(input.actualCostUsd)
  }

  async release(runId: string) {
    this.rollDay()
    this.reservations.delete(runId)
  }

  async snapshot() {
    this.rollDay()
    const reservedMicros = [...this.reservations.values()].reduce(
      (total, reservation) => total + reservation.reservedMicros,
      0,
    )
    return {
      day: this.day,
      enabled: this.enabled,
      spentUsd: toUsd(this.spentMicros),
      reservedUsd: toUsd(reservedMicros),
    }
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled
  }

  private rollDay() {
    const nextDay = utcDay(this.now())
    if (nextDay === this.day) return
    this.day = nextDay
    this.spentMicros = 0
    this.reservations = new Map()
  }
}
