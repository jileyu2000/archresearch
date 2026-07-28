import { useEffect, useRef } from 'react'

import { apiClient, type ResearchRun } from '../api/client'
import { terminalStatuses } from '../lib/run'

type UseRunPollingOptions = {
  activeRunId: string
  currentRunRequest: () => number
  demoMode: boolean
  hydrateRun: (runId: string, requestId: number) => Promise<boolean>
  isRunRequestCurrent: (requestId: number) => boolean
  onError: (error: unknown) => void
  onPollingStopped: () => void
  onRecentRunUpdated: (run: ResearchRun) => void
  onWatchingRunUpdated: (run: ResearchRun) => void
  pollingRunId: string
}

export function useRunPolling({
  activeRunId,
  currentRunRequest,
  demoMode,
  hydrateRun,
  isRunRequestCurrent,
  onError,
  onPollingStopped,
  onRecentRunUpdated,
  onWatchingRunUpdated,
  pollingRunId,
}: UseRunPollingOptions) {
  const activeRunIdRef = useRef(activeRunId)

  useEffect(() => {
    activeRunIdRef.current = activeRunId
  }, [activeRunId])

  useEffect(() => {
    if (demoMode || !pollingRunId) return
    const requestId = currentRunRequest()
    let busy = false
    const timer = window.setInterval(() => {
      if (busy) return
      busy = true
      void apiClient
        .getRun(pollingRunId)
        .then(async (nextRun) => {
          if (!isRunRequestCurrent(requestId)) return
          const watching = activeRunIdRef.current === nextRun.id
          onRecentRunUpdated(nextRun)
          if (watching) onWatchingRunUpdated(nextRun)
          if (terminalStatuses.has(nextRun.status)) {
            onPollingStopped()
            if (watching) await hydrateRun(nextRun.id, requestId)
          }
        })
        .catch((error) => {
          if (!isRunRequestCurrent(requestId)) return
          onPollingStopped()
          if (activeRunIdRef.current === pollingRunId) onError(error)
        })
        .finally(() => {
          busy = false
        })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [
    currentRunRequest,
    demoMode,
    hydrateRun,
    isRunRequestCurrent,
    onError,
    onPollingStopped,
    onRecentRunUpdated,
    onWatchingRunUpdated,
    pollingRunId,
  ])
}
