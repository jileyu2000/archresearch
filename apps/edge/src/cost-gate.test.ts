import { describe, expect, it } from 'vitest'

import { InMemoryCostGate } from './cost-gate'

describe('owner-funded model cost gate', () => {
  it('records reservations idempotently without a monetary ceiling', async () => {
    const gate = new InMemoryCostGate({
      enabled: true,
    })

    await expect(gate.reserve({ runId: 'run-a', reservedCostUsd: 0.65 })).resolves.toMatchObject({
      accepted: true,
      reservedUsd: 0.65,
    })
    await expect(gate.reserve({ runId: 'run-a', reservedCostUsd: 0.65 })).resolves.toMatchObject({
      accepted: true,
      reservedUsd: 0.65,
    })
    await expect(gate.reserve({ runId: 'run-b', reservedCostUsd: 4 })).resolves.toMatchObject({
      accepted: true,
      reservedUsd: 4,
    })

    await gate.settle({ runId: 'run-a', actualCostUsd: 0.2 })
    await expect(gate.reserve({ runId: 'run-c', reservedCostUsd: 0.4 })).resolves.toMatchObject({
      accepted: true,
      reservedUsd: 0.4,
    })
    await expect(gate.snapshot()).resolves.toMatchObject({
      spentUsd: 0.2,
      reservedUsd: 4.4,
    })
  })

  it('fails closed before a run only when the service is disabled', async () => {
    const disabled = new InMemoryCostGate({
      enabled: false,
    })
    await expect(disabled.reserve({ runId: 'run-disabled', reservedCostUsd: 0.1 }))
      .resolves.toMatchObject({ accepted: false, reason: 'service_paused' })
  })
})
