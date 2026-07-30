import {
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  ArrowLeft,
  Bookmark,
  Check,
  CircleDashed,
  Columns3,
  Download,
  ExternalLink,
  HardDriveDownload,
  LayoutGrid,
  MonitorUp,
  Palette,
  RefreshCw,
  Share2,
  SlidersHorizontal,
} from 'lucide-react'

import {
  ApiError,
  apiClient,
  type BoardExport,
  type PersonalCollection,
  type ResearchGoal,
  type ResearchMode,
  type ResearchRun,
  type ResearchSynthesis,
  type ResearchSynthesisFinding,
  type ResearchSource,
  type ResearchSubquestion,
  type TraceEvent,
  type Workspace,
} from './api/client'
import type { AssetType } from './data/mock'
import { CaseAnalysis } from './components/CaseAnalysis'
import { ComparisonDialog } from './components/ComparisonDialog'
import { DataManagementPage } from './components/DataManagementPage'
import { HomeSections } from './components/HomeSections'
import {
  PersonalCollectionsPage,
  type CollectionSubquestionSelection,
  type CollectionView,
} from './components/PersonalCollectionsPage'
import { ResearchComposer } from './components/ResearchComposer'
import { SharePanel } from './components/SharePanel'
import { SourceInspector } from './components/SourceInspector'
import { StudioBackdrop } from './components/StudioBackdrop'
import {
  StylePanel,
} from './components/StylePanel'
import { VisualInspirationBoard } from './components/VisualInspirationBoard'
import { useBrowserReadiness } from './hooks/useBrowserReadiness'
import { useRunHydration } from './hooks/useRunHydration'
import { useRunPolling } from './hooks/useRunPolling'
import { collectionSelectionKey } from './lib/collections'
import {
  demoDepthFromSearch,
  demoResearchQuestion,
  demoResults,
  demoSubquestionsFor,
} from './lib/demo'
import {
  modeLabels,
  researchDepthOptions,
  visualPlatformName,
} from './lib/labels'
import {
  activeStageDescriptions,
  partialDiagnosis,
  retryActionLabel,
  runAnnouncement,
  stageLabels,
  terminalStatuses,
  visualActiveStageDescriptions,
  visualStageLabels,
} from './lib/run'
import { defaultRunPayload, defaultStyle } from './lib/runPayload'
import { activeWorkspaceStorageKey } from './lib/storage'
import {
  conciseSynthesisHeadline,
  fallbackAnswerMechanism,
  firstUserFacingBoundary,
  localSynthesisPrefix,
  synthesisSegment,
  uniqueSummaryItems,
  userFacingRecommendation,
} from './lib/text'
import {
  analysisFor,
  availablePreviewUrl,
  fallbackSubquestions,
  projectPreviewCopy,
  supportsSubquestion,
  type WorkResult,
} from './lib/workResult'

type CollectionSelection = {
  key: string
  resultId: string
  subquestionId?: string
}

function researchSynthesisOverview(synthesis: ResearchSynthesis) {
  const rawStatement = synthesis.answer.statement.trim()
  const isFallback = synthesis.generation_mode === 'deterministic_fallback'
    || rawStatement.startsWith(localSynthesisPrefix)
  const isMachineShaped = isFallback || rawStatement.length > 96
  const transfer = synthesis.causal_chains
    .map((finding) => synthesisSegment(finding.statement, '转译'))
    .find(Boolean)
  const mechanism = synthesis.causal_chains
    .map((finding) => synthesisSegment(finding.statement, '机制'))
    .find(Boolean)
  const headline = isMachineShaped
    ? conciseSynthesisHeadline(transfer || mechanism || fallbackAnswerMechanism(rawStatement))
    : rawStatement
  const seenActions = new Set<string>()
  const actions: ResearchSynthesisFinding[] = []
  for (const finding of synthesis.recommendations) {
    const statement = userFacingRecommendation(finding.statement)
    if (!statement || seenActions.has(statement)) continue
    seenActions.add(statement)
    actions.push({ ...finding, statement })
    if (actions.length === 3) break
  }
  return {
    actions,
    headline,
    isFallback,
    isProjected: headline !== rawStatement,
    rawStatement,
  }
}

function apiMessage(error: unknown) {
  return error instanceof ApiError || error instanceof Error ? error.message : '操作未完成，请重试；若反复失败，请重启 ArchResearch。'
}

function browserWasUnavailableForSource(events: TraceEvent[], sourceUrl: string) {
  return events.some((event) => {
    if (event.tool !== 'browser') return false
    const summary = event.summary as unknown
    if (typeof summary === 'string') {
      return summary.includes('BrowserUnavailableError')
        || summary.includes('Browser extension is not connected')
    }
    if (!summary || typeof summary !== 'object') return false
    const details = summary as { error_type?: unknown; source_url?: unknown }
    if (details.error_type !== 'BrowserUnavailableError') return false
    return typeof details.source_url !== 'string' || details.source_url === sourceUrl
  })
}

type AppProps = {
  edition?: 'local' | 'public'
  verificationControl?: ReactNode
  verificationReady?: boolean
  extensionInstallUrl?: string
}

export default function App({
  edition = 'local',
  verificationControl,
  verificationReady = true,
  extensionInstallUrl = 'https://github.com/jileyu2000/archresearch/releases/download/v2.2.0/archresearch-chrome-extension-only-v2.2.0.zip',
}: AppProps) {
  const publicEdition = edition === 'public'
  const demoDepth = useMemo(() => demoDepthFromSearch(window.location.search), [])
  const demoMode = demoDepth !== null
  const demoProfile = useMemo(() => (
    demoDepth === null
      ? null
      : { results: demoResults(demoDepth), subquestions: demoSubquestionsFor(demoDepth) }
  ), [demoDepth])
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [activeWorkspaceId, setActiveWorkspaceId] = useState('')
  const [newWorkspaceName, setNewWorkspaceName] = useState('')
  const [failedPreviewUrls, setFailedPreviewUrls] = useState<Record<string, string>>({})
  const [question, setQuestion] = useState('')
  const [referenceUrl, setReferenceUrl] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [goal, setGoal] = useState<ResearchGoal>('precedent_research')
  const [mode, setMode] = useState<ResearchMode>(demoDepth ?? 'balanced')
  const [activeRun, setActiveRun] = useState<ResearchRun | null>(null)
  const [recentRuns, setRecentRuns] = useState<ResearchRun[]>([])
  const [collectionOpen, setCollectionOpen] = useState(false)
  const [dataManagementOpen, setDataManagementOpen] = useState(false)
  const [dataStatus, setDataStatus] = useState('')
  const [collectionView, setCollectionView] = useState<CollectionView>('precedent')
  const [selectedCollectionSubquestion, setSelectedCollectionSubquestion] =
    useState<CollectionSubquestionSelection>(null)
  const [personalCollections, setPersonalCollections] = useState<PersonalCollection[]>([])
  const [collectionsLoading, setCollectionsLoading] = useState(false)
  const [collectionSaving, setCollectionSaving] = useState(false)
  const [collectionSaveSucceeded, setCollectionSaveSucceeded] = useState(false)
  const [retentionUpdatingId, setRetentionUpdatingId] = useState('')
  const [pollingRunId, setPollingRunId] = useState('')
  const [announcement, setAnnouncement] = useState('')
  const [lastExport, setLastExport] = useState<BoardExport | null>(null)
  const [actionError, setActionError] = useState('')
  const [loading, setLoading] = useState(!demoMode)
  const [collectionSelections, setCollectionSelections] = useState<CollectionSelection[]>([])
  const [comparisonOpen, setComparisonOpen] = useState(false)
  const [shareSummaryOpen, setShareSummaryOpen] = useState(false)
  const [styleProfileOpen, setStyleProfileOpen] = useState(false)
  const [styleStatus, setStyleStatus] = useState('')
  const {
    browserConnected,
    browserConnecting,
    browserPairingStatus,
    browserReadinessError,
    browserReadinessLoading,
    extensionDetected,
    ensureBrowserResearchAccess,
    handleConnectBrowser,
    loadBrowserReadiness,
    refreshBrowserConnection,
    refreshBrowserReadiness,
    researchEnvironmentDetail,
    researchEnvironmentReady,
    researchEnvironmentTitle,
    showBrowserConnectAction,
  } = useBrowserReadiness({
    demoMode,
    publicEdition,
    onAnnouncement: setAnnouncement,
    onError: setActionError,
  })
  const initialRunPayload = useMemo(() => ({
    ...defaultRunPayload,
    results: demoProfile?.results ?? [],
    selectedResultId: demoProfile?.results[0]?.id ?? '',
    selectedSubquestionId: demoProfile?.subquestions[0]?.id ?? '',
    boardId: demoMode ? 'mock-board-active' : '',
    styleProfile: { ...defaultStyle },
  }), [demoMode, demoProfile])
  const [rerunStarting, setRerunStarting] = useState(false)
  const [researchStarting, setResearchStarting] = useState(false)
  const [composerError, setComposerError] = useState('')
  const [composerOpen, setComposerOpen] = useState(!demoMode)
  const [researchOptionsOpen, setResearchOptionsOpen] = useState(false)
  const [briefReviewLoading, setBriefReviewLoading] = useState(false)
  const [extensionNoticeDismissed, setExtensionNoticeDismissed] = useState(false)
  const [workspaceCreateOpen, setWorkspaceCreateOpen] = useState(false)
  const [inspectorOpen, setInspectorOpen] = useState(false)
  const closeInspectorAfterHydration = useCallback(() => setInspectorOpen(false), [])
  const {
    beginRunRequest,
    currentRunRequest,
    hydrateRun,
    invalidateRunRequests,
    isRunRequestCurrent,
    resetRunPayload,
    runPayload: {
      boardId,
      comparisonIds,
      notes,
      rejectedIds,
      results,
      savedIds,
      selectedResultId,
      selectedSubquestionId,
      styleProfile,
      traceEvents,
    },
    setComparisonIds,
    setNotes,
    setRejectedIds,
    setSavedIds,
    setSelectedResultId,
    setSelectedSubquestionId,
    setStyleProfile,
  } = useRunHydration({
    initialPayload: initialRunPayload,
    loadBrowserReadiness,
    onHydrated: closeInspectorAfterHydration,
  })
  const overlayTriggerRef = useRef<HTMLElement | null>(null)
  const questionInputRef = useRef<HTMLTextAreaElement | null>(null)
  const selectedResult = results.find((result) => result.id === selectedResultId)
  const extensionInstallNoticeOpen = !demoMode
    && !browserReadinessLoading
    && !extensionDetected
    && !extensionNoticeDismissed
  const overlayOpen = inspectorOpen
    || comparisonOpen
    || shareSummaryOpen
    || styleProfileOpen
    || extensionInstallNoticeOpen

  const closeOverlays = useCallback(() => {
    const trigger = overlayTriggerRef.current
    setInspectorOpen(false)
    setComparisonOpen(false)
    setShareSummaryOpen(false)
    setStyleProfileOpen(false)
    setExtensionNoticeDismissed(true)
    trigger?.focus()
  }, [])

  const markPreviewFailed = useCallback((resultId: string, previewUrl: string | null) => {
    if (!previewUrl) return
    setFailedPreviewUrls((current) => (
      current[resultId] === previewUrl
        ? current
        : { ...current, [resultId]: previewUrl }
    ))
  }, [])

  useEffect(() => {
    if (!overlayOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeOverlays()
        return
      }
      if (event.key !== 'Tab') return
      const dialog = document.querySelector<HTMLElement>('[role="dialog"][aria-modal="true"]')
      if (!dialog) return
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary'))
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [closeOverlays, overlayOpen])

  const resetWorkspaceView = useCallback(() => {
    invalidateRunRequests()
    setPollingRunId('')
    setActiveRun(null)
    setRecentRuns([])
    setCollectionOpen(false)
    setCollectionView('precedent')
    setSelectedCollectionSubquestion(null)
    setCollectionSaveSucceeded(false)
    setPersonalCollections([])
    setRetentionUpdatingId('')
    setAnnouncement('')
    setLastExport(null)
    resetRunPayload()
    setFailedPreviewUrls({})
    setComposerOpen(true)
    setResearchOptionsOpen(false)
    setInspectorOpen(false)
  }, [invalidateRunRequests, resetRunPayload])

  const updateRecentRun = useCallback((nextRun: ResearchRun) => {
    setRecentRuns((current) => [
      nextRun,
      ...current.filter((run) => run.id !== nextRun.id),
    ])
  }, [])

  const handleRunRetention = useCallback(async (run: ResearchRun) => {
    setRetentionUpdatingId(run.id)
    setActionError('')
    try {
      const updated = await apiClient.updateRunRetention(run.id, !run.keepForever)
      setRecentRuns((current) => current.map((item) => (
        item.id === updated.id ? updated : item
      )))
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '无法更新历史保留设置。')
    } finally {
      setRetentionUpdatingId('')
    }
  }, [])

  async function openPersonalCollections(trigger: HTMLElement) {
    overlayTriggerRef.current = trigger
    setCollectionOpen(true)
    setCollectionView('precedent')
    setSelectedCollectionSubquestion(null)
    setComposerOpen(false)
    setCollectionSaveSucceeded(false)
    if (demoMode || !activeWorkspaceId) {
      setPersonalCollections([])
      return
    }
    setCollectionsLoading(true)
    setActionError('')
    try {
      setPersonalCollections(await apiClient.listPersonalCollections(activeWorkspaceId))
    } catch (error) {
      setActionError(`个人收藏未读取：${apiMessage(error)}`)
    } finally {
      setCollectionsLoading(false)
    }
  }

  async function deletePersonalCollection(collectionId: string) {
    setActionError('')
    try {
      await apiClient.deletePersonalCollection(collectionId)
      setPersonalCollections((current) => current.filter((item) => item.id !== collectionId))
      setSavedIds((current) => current.filter((id) => (
        personalCollections.find((item) => item.id === collectionId)?.asset_candidate_id !== id
      )))
    } catch (error) {
      setActionError(`收藏未删除：${apiMessage(error)}`)
    }
  }

  async function saveCollectionSelections(
    pendingSelections: CollectionSelection[],
    clearSelectionsAfterSave: boolean,
  ) {
    const pendingIds = [...new Set(pendingSelections.map((item) => item.resultId))]
    if (pendingIds.length === 0) return
    if (demoMode) {
      setSavedIds((current) => [...new Set([...current, ...pendingIds])])
      if (clearSelectionsAfterSave) {
        setCollectionSelections([])
        setComparisonIds([])
      }
      setAnnouncement(clearSelectionsAfterSave
        ? `已保存 ${pendingSelections.length} 项，选择已清空`
        : '已加入收藏')
      setCollectionSaveSucceeded(clearSelectionsAfterSave)
      return
    }
    setCollectionSaving(true)
    setActionError('')
    try {
      // Saving is additive: a new batch never deletes earlier saved items,
      // even for the same question. Removal is always the user's own action.
      const savedItems: PersonalCollection[] = []
      for (const resultId of pendingIds) {
        if (rejectedIds.includes(resultId)) {
          await apiClient.unrejectResult(resultId)
          setRejectedIds((current) => current.filter((id) => id !== resultId))
        }
        const subquestionIds = pendingSelections
          .filter((item) => item.resultId === resultId)
          .map((item) => item.subquestionId)
          .filter((item): item is string => Boolean(item))
        savedItems.push(await apiClient.saveResult(
          resultId,
          notes[resultId] ?? '',
          subquestionIds.length > 0 ? subquestionIds : undefined,
        ))
      }
      setSavedIds((current) => [...new Set([...current, ...pendingIds])])
      setPersonalCollections((current) => [
        ...savedItems,
        ...current.filter((item) => !savedItems.some((saved) => saved.id === item.id)),
      ])
      if (clearSelectionsAfterSave) {
        setCollectionSelections([])
        setComparisonIds([])
        if (activeRun) await apiClient.updateBoard(activeRun.id, [])
      }
      setAnnouncement(clearSelectionsAfterSave
        ? `已保存 ${pendingSelections.length} 项，选择已清空`
        : '已加入收藏')
      setCollectionSaveSucceeded(clearSelectionsAfterSave)
    } catch (error) {
      setActionError(`收藏未保存：${apiMessage(error)}`)
    } finally {
      setCollectionSaving(false)
    }
  }

  async function addSelectionToCollection() {
    const pendingSelections: CollectionSelection[] = isVisualResearch
      ? comparisonIds.filter((id) => !savedIds.includes(id)).map((resultId) => ({
          key: collectionSelectionKey(resultId),
          resultId,
        }))
      : collectionSelections
    await saveCollectionSelections(pendingSelections, true)
  }

  async function addCaseToCollection(resultId: string, subquestionId?: string) {
    await saveCollectionSelections([{
      key: collectionSelectionKey(resultId, subquestionId),
      resultId,
      subquestionId,
    }], false)
  }

  async function clearResultSelection() {
    const previous = comparisonIds
    const previousCollectionSelections = collectionSelections
    setComparisonIds([])
    setCollectionSelections([])
    setCollectionSaveSucceeded(false)
    setLastExport(null)
    if (demoMode || !activeRun) return
    try {
      await apiClient.updateBoard(activeRun.id, [])
    } catch (error) {
      setComparisonIds(previous)
      setCollectionSelections(previousCollectionSelections)
      setActionError(`选择未清空：${apiMessage(error)}`)
    }
  }

  const clearRunView = useCallback(() => {
    resetRunPayload()
    setFailedPreviewUrls({})
    setCollectionSelections([])
    setCollectionSaveSucceeded(false)
    setLastExport(null)
    setInspectorOpen(false)
  }, [resetRunPayload])

  useEffect(() => {
    if (demoMode) return
    let active = true
    void apiClient
      .listWorkspaces()
      .then(async (items) => {
        let next = items
        if (next.length === 0) {
          next = [await apiClient.ensureDefaultWorkspace()]
        }
        if (!active) return
        const rememberedWorkspaceId = window.localStorage.getItem(activeWorkspaceStorageKey)
        const initialWorkspace = next.find((workspace) => workspace.id === rememberedWorkspaceId) ?? next[0]
        setWorkspaces(next)
        setActiveWorkspaceId(initialWorkspace.id)
      })
      .catch((error) => {
        if (active) {
          setActionError(apiMessage(error))
          setLoading(false)
        }
      })
    return () => {
      active = false
    }
  }, [demoMode])

  const openRun = useCallback(async (run: ResearchRun) => {
    const requestId = beginRunRequest()
    setPollingRunId('')
    setActionError('')
    setActiveRun(run)
    setAnnouncement(runAnnouncement(run))
    setComposerOpen(false)
    setWorkspaceCreateOpen(false)
    setResearchOptionsOpen(false)
    clearRunView()
    if (!demoMode && run.workspaceId && run.workspaceId !== activeWorkspaceId) {
      window.localStorage.setItem(activeWorkspaceStorageKey, run.workspaceId)
      setActiveWorkspaceId(run.workspaceId)
    }
    try {
      if (terminalStatuses.has(run.status)) {
        await hydrateRun(run.id, requestId)
      } else if (isRunRequestCurrent(requestId)) {
        setPollingRunId(run.id)
      }
    } catch (error) {
      if (isRunRequestCurrent(requestId)) setActionError(apiMessage(error))
    }
  }, [
    activeWorkspaceId,
    beginRunRequest,
    clearRunView,
    demoMode,
    hydrateRun,
    isRunRequestCurrent,
  ])

  useEffect(() => {
    if (demoMode || workspaces.length === 0) return
    let active = true
    void Promise.all(workspaces.map((workspace) => apiClient.listRuns(workspace.id)))
      .then(async (workspaceRuns) => {
        if (!active) return
        const runs = workspaceRuns.flat().sort((first, second) => (
          Date.parse(second.updatedAt ?? second.createdAt ?? '')
          - Date.parse(first.updatedAt ?? first.createdAt ?? '')
        ))
        setRecentRuns(runs)
        // Research is a background process: opening the app never hijacks the
        // view into a running run. The run stays a live row in 最近研究 and is
        // polled quietly so its status keeps moving; opening it is a click.
        const latest = runs.find((run) => !terminalStatuses.has(run.status))
        if (latest && active) setPollingRunId(latest.id)
      })
      .catch((error) => {
        if (active) setActionError(apiMessage(error))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [activeWorkspaceId, demoMode, workspaces])

  const handleWatchingRunUpdated = useCallback((nextRun: ResearchRun) => {
    setActiveRun(nextRun)
    setAnnouncement(runAnnouncement(nextRun))
  }, [])
  const stopRunPolling = useCallback(() => setPollingRunId(''), [])
  const handleRunPollingError = useCallback((error: unknown) => {
    setActionError(`进度更新已中断，研究可能仍在后台进行。请刷新页面或从“最近研究”重新打开查看。（${apiMessage(error)}）`)
  }, [])

  useRunPolling({
    activeRunId: activeRun?.id ?? '',
    currentRunRequest,
    demoMode,
    hydrateRun,
    isRunRequestCurrent,
    onError: handleRunPollingError,
    onPollingStopped: stopRunPolling,
    onRecentRunUpdated: updateRecentRun,
    onWatchingRunUpdated: handleWatchingRunUpdated,
    pollingRunId,
  })

  async function handleCreateWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = newWorkspaceName.trim()
    if (!name) return
    try {
      const created = await apiClient.createWorkspace({ name })
      setWorkspaces((current) => [...current, created])
      resetWorkspaceView()
      setLoading(true)
      window.localStorage.setItem(activeWorkspaceStorageKey, created.id)
      setActiveWorkspaceId(created.id)
      setNewWorkspaceName('')
      setWorkspaceCreateOpen(false)
    } catch (error) {
      setActionError(apiMessage(error))
    }
  }

  function handleDataRestored(restoredWorkspaces: Workspace[]) {
    setWorkspaces(restoredWorkspaces)
    const restoredWorkspace = restoredWorkspaces.find(({ id }) => id === activeWorkspaceId)
      ?? restoredWorkspaces[0]
    if (restoredWorkspace) {
      setActiveWorkspaceId(restoredWorkspace.id)
      window.localStorage.setItem(activeWorkspaceStorageKey, restoredWorkspace.id)
    }
    resetWorkspaceView()
  }

  async function startResearchRun(subquestions?: ResearchSubquestion[]) {
    const researchSources: ResearchSource[] = goal === 'visual_reference_search'
      ? ['xiaohongshu']
      : []
    if (
      goal === 'visual_reference_search'
      && !(await ensureBrowserResearchAccess(true))
    ) return
    const requestId = beginRunRequest()
    setResearchStarting(true)
    try {
      const run = await apiClient.startResearch({
        workspaceId: activeWorkspaceId,
        question,
        referenceUrl,
        files,
        goal,
        mode: goal === 'visual_reference_search' ? 'quick' : mode,
        researchSources,
        subquestions,
      })
      if (!isRunRequestCurrent(requestId)) return
      updateRecentRun(run)
      clearRunView()
      if (terminalStatuses.has(run.status)) {
        setActiveRun(run)
        setAnnouncement(runAnnouncement(run))
        if (run.status !== 'cancelled') {
          await hydrateRun(run.id, requestId)
        }
      } else {
        setActiveRun(run)
        setAnnouncement(runAnnouncement(run))
        setPollingRunId(run.id)
      }
      if (!isRunRequestCurrent(requestId)) return
      setComposerOpen(false)
      setWorkspaceCreateOpen(false)
      setResearchOptionsOpen(false)
    } catch (error) {
      // Launch failures surface beside the submit button, not only in the
      // page-level error sink far below the fold.
      if (isRunRequestCurrent(requestId)) setComposerError(apiMessage(error))
    } finally {
      setResearchStarting(false)
    }
  }

  async function handleResearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setActionError('')
    setComposerError('')
    if (demoMode) {
      setAnnouncement(
        goal === 'visual_reference_search'
          ? '图纸灵感检索已开始（本地演示）'
          : `${modeLabels[mode]}研究已开始（本地演示）`,
      )
      setComposerOpen(false)
      return
    }
    const projectBrief = goal === 'precedent_research'
      ? files.find((file) => file.name.toLowerCase().endsWith('.pdf'))
      : undefined
    if (projectBrief) {
      setBriefReviewLoading(true)
      try {
        const review = await apiClient.reviewProjectBrief({
          workspaceId: activeWorkspaceId,
          question,
          mode,
          file: projectBrief,
        })
        await startResearchRun(review.subquestions)
      } catch (error) {
        setComposerError(`任务书读取失败：${apiMessage(error)}`)
      } finally {
        setBriefReviewLoading(false)
      }
      return
    }
    await startResearchRun()
  }

  async function handleCancel() {
    if (!activeRun) return
    const requestId = currentRunRequest()
    try {
      const run = await apiClient.cancelRun(activeRun.id)
      if (!isRunRequestCurrent(requestId)) return
      invalidateRunRequests()
      setPollingRunId('')
      setActiveRun(run)
      updateRecentRun(run)
      setAnnouncement(runAnnouncement(run))
    } catch (error) {
      if (isRunRequestCurrent(requestId)) setActionError(apiMessage(error))
    }
  }

  async function handleRetry() {
    if (!activeRun) return
    setActionError('')
    if (!(await ensureBrowserResearchAccess(
      activeRun.researchSources?.includes('xiaohongshu') ?? false,
    ))) return
    const requestId = currentRunRequest()
    try {
      const run = await apiClient.retryRun(activeRun.id)
      if (!isRunRequestCurrent(requestId)) return
      invalidateRunRequests()
      setActiveRun(run)
      updateRecentRun(run)
      setAnnouncement(runAnnouncement(run))
      if (!terminalStatuses.has(run.status)) setPollingRunId(run.id)
    } catch (error) {
      if (isRunRequestCurrent(requestId)) setActionError(apiMessage(error))
    }
  }

  async function handleRerunWithBrowser() {
    if (!activeRun || !activeWorkspaceId || browserConnected !== true) return
    if (!(await ensureBrowserResearchAccess(
      activeRun.researchSources?.includes('xiaohongshu') ?? false,
    ))) return
    const requestId = beginRunRequest()
    setRerunStarting(true)
    setActionError('')
    try {
      const run = await apiClient.startResearch({
        workspaceId: activeWorkspaceId,
        question: activeRun.question,
        goal: activeRun.goal,
        mode: activeRun.mode,
        researchSources: activeRun.researchSources,
      })
      if (!isRunRequestCurrent(requestId)) return
      updateRecentRun(run)
      clearRunView()
      setActiveRun(run)
      setAnnouncement(runAnnouncement(run))
      setComposerOpen(false)
      if (terminalStatuses.has(run.status)) {
        if (run.status !== 'cancelled') {
          await hydrateRun(run.id, requestId)
        }
      } else {
        setPollingRunId(run.id)
      }
    } catch (error) {
      if (isRunRequestCurrent(requestId)) setActionError(apiMessage(error))
    } finally {
      if (isRunRequestCurrent(requestId)) setRerunStarting(false)
    }
  }

  async function toggleSaved(resultId: string) {
    const isSaved = savedIds.includes(resultId)
    setActionError('')
    try {
      if (isSaved) {
        await apiClient.unsaveResult(resultId)
        setSavedIds((current) => current.filter((id) => id !== resultId))
        return
      }
      if (rejectedIds.includes(resultId)) {
        await apiClient.unrejectResult(resultId)
        setRejectedIds((current) => current.filter((id) => id !== resultId))
      }
      await apiClient.saveResult(resultId, notes[resultId] ?? '')
      setSavedIds((current) => [...new Set([...current, resultId])])
    } catch (error) {
      setActionError(`收藏状态未保存：${apiMessage(error)}`)
    }
  }

  async function toggleRejected(resultId: string) {
    const isRejected = rejectedIds.includes(resultId)
    const previousComparison = comparisonIds
    const nextComparison = comparisonIds.filter((id) => id !== resultId)
    let boardSelectionUpdated = false
    setActionError('')
    try {
      if (isRejected) {
        await apiClient.unrejectResult(resultId)
        setRejectedIds((current) => current.filter((id) => id !== resultId))
        return
      }
      if (savedIds.includes(resultId)) {
        await apiClient.unsaveResult(resultId)
        setSavedIds((current) => current.filter((id) => id !== resultId))
      }
      if (nextComparison.length !== previousComparison.length && activeRun && !demoMode) {
        await apiClient.updateBoard(activeRun.id, nextComparison)
        boardSelectionUpdated = true
        setComparisonIds(nextComparison)
        setLastExport(null)
      }
      await apiClient.rejectResult(resultId, 'not_useful_for_current_problem')
      setCollectionSelections((current) => current.filter((item) => item.resultId !== resultId))
      setRejectedIds((current) => [...new Set([...current, resultId])])
    } catch (error) {
      if (boardSelectionUpdated && activeRun) {
        await apiClient.updateBoard(activeRun.id, previousComparison).catch(() => undefined)
        setComparisonIds(previousComparison)
      }
      setActionError(`拒绝状态未保存：${apiMessage(error)}`)
    }
  }

  async function saveNote(resultId: string, note: string) {
    if (demoMode) return
    try {
      await apiClient.saveResult(resultId, note)
      setSavedIds((current) => [...new Set([...current, resultId])])
    } catch (error) {
      setActionError(`备注未保存：${apiMessage(error)}`)
    }
  }

  async function toggleComparison(resultId: string) {
    const previousCollectionSaveSucceeded = collectionSaveSucceeded
    const addsUnsavedResult = !comparisonIds.includes(resultId) && !savedIds.includes(resultId)
    const next = comparisonIds.includes(resultId)
      ? comparisonIds.filter((id) => id !== resultId)
      : comparisonIds.length < 6
        ? [...comparisonIds, resultId]
        : comparisonIds
    if (next === comparisonIds) return
    const previous = comparisonIds
    setComparisonIds(next)
    if (addsUnsavedResult) setCollectionSaveSucceeded(false)
    setLastExport(null)
    if (demoMode || !activeRun) return
    try {
      await apiClient.updateBoard(activeRun.id, next)
    } catch (error) {
      setComparisonIds(previous)
      setCollectionSaveSucceeded(previousCollectionSaveSucceeded)
      setActionError(`对比选择未保存：${apiMessage(error)}`)
    }
  }

  async function toggleCaseCollection(resultId: string, subquestionId?: string) {
    const key = collectionSelectionKey(resultId, subquestionId)
    const isSelected = collectionSelections.some((item) => item.key === key)
    const nextSelections = isSelected
      ? collectionSelections.filter((item) => item.key !== key)
      : collectionSelections.length < 6
        ? [...collectionSelections, { key, resultId, subquestionId }]
        : collectionSelections
    if (nextSelections === collectionSelections) return
    const previousSelections = collectionSelections
    const previousComparison = comparisonIds
    const nextComparison = isSelected && !nextSelections.some((item) => item.resultId === resultId)
      ? comparisonIds.filter((id) => id !== resultId)
      : comparisonIds.includes(resultId)
        ? comparisonIds
        : [...comparisonIds, resultId]
    const previousCollectionSaveSucceeded = collectionSaveSucceeded
    setCollectionSelections(nextSelections)
    setComparisonIds(nextComparison)
    if (!isSelected) setCollectionSaveSucceeded(false)
    setLastExport(null)
    if (demoMode || !activeRun) return
    try {
      await apiClient.updateBoard(activeRun.id, nextComparison)
    } catch (error) {
      setCollectionSelections(previousSelections)
      setComparisonIds(previousComparison)
      setCollectionSaveSucceeded(previousCollectionSaveSucceeded)
      setActionError(`选择未保存：${apiMessage(error)}`)
    }
  }

  async function handleExport(exportMode: 'private' | 'share') {
    if (!boardId || comparisonIds.length === 0) return
    try {
      const exported = await apiClient.exportBoard(boardId, exportMode)
      setLastExport(exported)
      setAnnouncement(exportMode === 'private'
        ? `${isVisualResearch ? '图纸整理版' : '案例对照表'}已生成`
        : `${isVisualResearch ? '分享来源板' : '分享结果板'}已生成`)
      setShareSummaryOpen(false)
    } catch (error) {
      setActionError(`导出失败：${apiMessage(error)}`)
    }
  }

  async function handleStyleSave() {
    if (!boardId) return
    const lineWeights = {
      relative: { primary: 1, secondary: 0.35 },
      contrast: { primary: 1.2, secondary: 0.25 },
      uniform: { primary: 0.5, secondary: 0.5 },
    }[styleProfile.lineHierarchy]
    try {
      await apiClient.saveStyleProfile(boardId, {
        palette: [styleProfile.primaryColor],
        line_weights: lineWeights,
        texture: styleProfile.texture,
        font_category: styleProfile.fontCategory,
        layout_notes: styleProfile.layoutNotes,
      })
      setStyleStatus('表达规范已保存')
    } catch (error) {
      setStyleStatus('')
      setActionError(`表达规范未保存：${apiMessage(error)}`)
    }
  }

  function selectResearchGoal(nextGoal: ResearchGoal) {
    if (nextGoal !== goal) {
      setReferenceUrl('')
      setFiles([])
      setResearchOptionsOpen(false)
      setComposerError('')
    }
    setGoal(nextGoal)
  }

  function applyProblemStarter(prompt: string, starterGoal: ResearchGoal) {
    setQuestion(prompt)
    selectResearchGoal(starterGoal)
    questionInputRef.current?.focus()
  }

  function returnHome() {
    invalidateRunRequests()
    setPollingRunId('')
    setActiveRun(null)
    setAnnouncement('')
    setLastExport(null)
    if (!collectionOpen) {
      setQuestion('')
      setReferenceUrl('')
      setFiles([])
    }
    setCollectionOpen(false)
    setDataManagementOpen(false)
    setCollectionView('precedent')
    setSelectedCollectionSubquestion(null)
    setCollectionSaveSucceeded(false)
    setComposerOpen(true)
    setResearchOptionsOpen(false)
    setWorkspaceCreateOpen(false)
  }

  const shareableCount = comparisonIds.filter((id) => {
    const result = results.find((item) => item.id === id)
    return result && ['user_owned', 'open_license', 'permissioned'].includes(result.rightsStatus)
  }).length
  const visibleResults = results
  const researchQuestion = activeRun?.question ?? (demoMode ? demoResearchQuestion : question)
  const isVisualResearch = activeRun?.goal === 'visual_reference_search'
  const currentStageLabels = isVisualResearch ? visualStageLabels : stageLabels
  const currentStageDescriptions = isVisualResearch
    ? visualActiveStageDescriptions
    : activeStageDescriptions
  const researchSubquestions = demoMode
    ? (demoProfile?.subquestions ?? [])
    : activeRun?.subquestions.length
      ? activeRun.subquestions
      : fallbackSubquestions(results, researchQuestion)
  const displayResearchSubquestions = isVisualResearch
    ? researchSubquestions.map((subquestion, index) => {
        const legacyQuestionShape = /^(哪些|如何|怎样|什么|是否|能否)|[?？]$/.test(
          subquestion.question.trim(),
        )
        if (!legacyQuestionShape) return subquestion
        return {
          ...subquestion,
          question: `旧版灵感分组 ${index + 1}`,
          rationale: '这条历史任务按旧规则生成；重新查找会围绕你指定的图纸类型比较不同风格。',
        }
      })
    : researchSubquestions
  const visualInspirationResults = visibleResults.filter((result) => (
    result.visualReference || visualPlatformName(result.sourceUrl)
  ))
  const visualInspirationNoteCount = new Set(
    visualInspirationResults.map((result) => result.sourceUrl),
  ).size
  const caseResults = visibleResults.filter(
    (result) => !result.visualReference
      && !visualPlatformName(result.sourceUrl)
      && result.analysisReady,
  )
  const subquestionSummaries = displayResearchSubquestions.map((subquestion) => {
    const assets = results.filter(
      (result) => supportsSubquestion(result, subquestion.id, researchSubquestions),
    )
    const caseAssets = assets.filter((result) => (
      !result.visualReference && !visualPlatformName(result.sourceUrl)
    ))
    const inspirationAssets = assets.filter((result) => (
      result.visualReference || visualPlatformName(result.sourceUrl)
    ))
    return {
      ...subquestion,
      caseAssetCount: caseAssets.length,
      inspirationCount: inspirationAssets.length,
      projectCount: new Set(caseAssets.map((result) => result.project)).size,
      passCount: activeRun?.coverageReport?.subquestion_passes?.[subquestion.id],
    }
  })
  const unassignedResults = caseResults.filter((result) => (
    !researchSubquestions.some((subquestion) => (
      supportsSubquestion(result, subquestion.id, researchSubquestions)
    ))
  ))
  const groupingSubquestions = [
    ...displayResearchSubquestions,
    ...(unassignedResults.length > 0
      ? [{
          id: 'unassigned',
          question: '待归组的图纸线索',
          rationale: '这些图纸已有来源线索，但尚未确认它具体回答哪个子问题。',
        }]
      : []),
  ]
  const caseGroups = groupingSubquestions.map((subquestion, index) => {
    const unassigned = subquestion.id === 'unassigned'
    const assets = unassigned
      ? unassignedResults
      : caseResults.filter(
          (result) => supportsSubquestion(result, subquestion.id, researchSubquestions),
        )
    const dossiers = [...assets.reduce((projects, result) => {
      const current = projects.get(result.project) ?? []
      current.push(result)
      projects.set(result.project, current)
      return projects
    }, new Map<string, WorkResult[]>()).entries()].map(([project, projectAssets]) => {
      const primary = projectAssets.find((result) => result.subquestionAnalysis[subquestion.id])
        ?? projectAssets[0]
      const analysis = analysisFor(primary, subquestion.id)
      return {
        project,
        assets: projectAssets,
        primary,
        analysis,
        previewCopy: projectPreviewCopy(projectAssets, analysis, subquestion.id),
      }
    })
    const questionSummary = unassigned || dossiers.length === 0
      ? null
      : {
          statement: uniqueSummaryItems(
            dossiers.map((dossier) => dossier.analysis.designMechanism),
            1,
          )[0],
        }
    return {
      index,
      subquestion,
      assets,
      dossiers,
      questionSummary,
      unassigned,
    }
  })
  const unassignedInspiration = visualInspirationResults.filter((result) => (
    !researchSubquestions.some((subquestion) => (
      supportsSubquestion(result, subquestion.id, researchSubquestions)
    ))
  ))
  const inspirationGroups = [
    ...displayResearchSubquestions,
    ...(unassignedInspiration.length > 0
      ? [{
          id: 'unassigned-inspiration',
          question: '待归组的制图灵感',
          rationale: '这些图片已完成图纸识别，但还没有确认它对应哪个灵感方向。',
        }]
      : []),
  ].map((subquestion) => {
    const assets = subquestion.id === 'unassigned-inspiration'
      ? unassignedInspiration
      : visualInspirationResults.filter(
          (result) => supportsSubquestion(result, subquestion.id, researchSubquestions),
        )
    const typeGroups = [...assets.reduce((types, result) => {
      const current = types.get(result.assetType) ?? []
      current.push(result)
      types.set(result.assetType, current)
      return types
    }, new Map<AssetType, WorkResult[]>()).entries()].map(([assetType, typeAssets]) => ({
      assetType,
      assets: typeAssets,
    }))
    const noteGroups = [...assets.reduce((notes, result) => {
      const current = notes.get(result.sourceUrl) ?? []
      current.push(result)
      notes.set(result.sourceUrl, current)
      return notes
    }, new Map<string, WorkResult[]>()).entries()].map(([sourceUrl, noteAssets]) => ({
      sourceUrl,
      assets: noteAssets,
      primary: noteAssets[0],
      observation: uniqueSummaryItems(
        noteAssets.map((result) => analysisFor(result, subquestion.id).observation),
        1,
      )[0] ?? '',
      relevance: Math.max(...noteAssets.map((result) => result.relevance)),
    }))
    return { subquestion, assets, typeGroups, noteGroups }
  }).filter((group) => group.assets.length > 0)
  const selectedComparisonResults = results.filter((result) => comparisonIds.includes(result.id))
  const selectedPendingCollectionCount = isVisualResearch
    ? comparisonIds.filter((id) => !savedIds.includes(id)).length
    : collectionSelections.length
  const selectedProjectCount = new Set(
    selectedComparisonResults.map((result) => result.project.trim().toLocaleLowerCase()),
  ).size
  const privateExportDisabled = isVisualResearch
    ? comparisonIds.length === 0
    : selectedProjectCount < 2
  const activeStatus = activeRun?.status
  const isRunActive = activeStatus ? !terminalStatuses.has(activeStatus) : false
  const activeStageIndex = activeStatus
    ? currentStageLabels.findIndex((stage) => stage.status === activeStatus)
    : -1
  const resultViewOpen = !composerOpen && !collectionOpen && !dataManagementOpen
  const homeViewOpen = composerOpen && !collectionOpen && !dataManagementOpen
  const activePartialDiagnosis = activeRun && ['partial', 'blocked'].includes(activeRun.status)
    ? partialDiagnosis(activeRun)
    : null
  const activeSynthesis = activeRun?.coverageReport?.synthesis
  const synthesisOverview = activeSynthesis ? researchSynthesisOverview(activeSynthesis) : null
  const synthesisBoundary = activeSynthesis
    ? firstUserFacingBoundary(activeSynthesis.applicability_boundaries.map((item) => item.statement))
    : ''
  const allResultsMissingPreviews = results.length > 0 && results.every(
    (result) => !availablePreviewUrl(result, failedPreviewUrls),
  )
  const anyPreviewLoadFailed = results.some(
    (result) => Boolean(result.previewUrl && failedPreviewUrls[result.id] === result.previewUrl),
  )
  const runHadBrowserUnavailable = results.some((result) => (
    browserWasUnavailableForSource(traceEvents, result.sourceUrl)
  ))
  const usableResultCount = activeRun?.coverageReport?.usable_assets ?? results.filter(
    (result) => result.relevance >= 2 && result.tier !== 'visual_lead',
  ).length
  const pendingLeadCount = Math.max(0, results.length - usableResultCount)
  const resultCountLabel = pendingLeadCount > 0
    ? `${usableResultCount} 条可用参考 · ${pendingLeadCount} 条只作线索`
    : `${usableResultCount} 条可用参考`
  const currentWorkspaceName = workspaces.find(({ id }) => id === activeWorkspaceId)?.name
    ?? '未选择项目'
  return (
    <main className="research-desk" data-view={dataManagementOpen ? 'data' : collectionOpen ? 'collection' : resultViewOpen ? 'results' : 'home'} aria-label="建筑研究画板">
      <StudioBackdrop view={resultViewOpen ? 'results' : 'home'} />
      <header className="app-header">
        <div className="app-brand">
          <span className="brand-mark" aria-hidden="true"><LayoutGrid /></span>
          <div><strong>ArchResearch</strong><span>{demoMode
            ? `演示数据 · ${modeLabels[mode]}`
            : '建筑研究工具'}</span></div>
        </div>
        <div className="header-actions">
          {homeViewOpen && !demoMode && (
            <button
              className="icon-text-button"
              type="button"
              onClick={() => {
                setActionError('')
                setDataStatus('')
                setDataManagementOpen(true)
              }}
            >
              <HardDriveDownload aria-hidden="true" />备份与恢复
            </button>
          )}
          {homeViewOpen && !demoMode && (
            <button
              className="icon-text-button"
              type="button"
              disabled={!activeWorkspaceId}
              onClick={(event) => void openPersonalCollections(event.currentTarget)}
            >
              <Bookmark aria-hidden="true" />个人收藏
            </button>
          )}
          {(dataManagementOpen || collectionOpen || resultViewOpen) && (
            <button className="result-new-research" type="button" onClick={returnHome}>
              <ArrowLeft aria-hidden="true" />返回主页
            </button>
          )}
        </div>
      </header>

      <section className="board-workspace" aria-label="研究工作区">
        <DataManagementPage
          open={dataManagementOpen}
          publicEdition={publicEdition}
          workspaceCount={workspaces.length}
          runCount={recentRuns.length}
          isRunActive={isRunActive}
          dataStatus={dataStatus}
          onError={setActionError}
          onStatus={setDataStatus}
          onRestored={handleDataRestored}
        />

        {homeViewOpen && (
          <ResearchComposer
            questionInputRef={questionInputRef}
            goal={goal}
            mode={mode}
            question={question}
            files={files}
            referenceUrl={referenceUrl}
            demoMode={demoMode}
            publicEdition={publicEdition}
            verificationControl={verificationControl}
            verificationReady={verificationReady}
            extensionInstallNoticeOpen={extensionInstallNoticeOpen}
            extensionInstallUrl={extensionInstallUrl}
            activeWorkspaceId={activeWorkspaceId}
            briefReviewLoading={briefReviewLoading}
            researchStarting={researchStarting}
            isRunActive={isRunActive}
            loading={loading}
            researchOptionsOpen={researchOptionsOpen}
            composerError={composerError}
            researchEnvironmentReady={researchEnvironmentReady}
            researchEnvironmentTitle={researchEnvironmentTitle}
            researchEnvironmentDetail={researchEnvironmentDetail}
            showBrowserConnectAction={showBrowserConnectAction}
            browserConnecting={browserConnecting}
            browserReadinessLoading={browserReadinessLoading}
            browserReadinessError={browserReadinessError}
            browserPairingStatus={browserPairingStatus}
            activeRun={activeRun}
            onSubmit={handleResearchSubmit}
            onGoalChange={selectResearchGoal}
            onQuestionChange={setQuestion}
            onModeChange={setMode}
            onToggleOptions={() => setResearchOptionsOpen((current) => !current)}
            onFilesChange={setFiles}
            onReferenceUrlChange={setReferenceUrl}
            onConnectBrowser={handleConnectBrowser}
            onRefreshBrowserReadiness={refreshBrowserReadiness}
            onCancel={handleCancel}
            onRetry={handleRetry}
            onDismissExtensionInstallNotice={() => setExtensionNoticeDismissed(true)}
            onCheckExtensionInstall={refreshBrowserReadiness}
          />
        )}

        {homeViewOpen && (
          <HomeSections
            demoMode={demoMode}
            currentWorkspaceName={currentWorkspaceName}
            workspaceCreateOpen={workspaceCreateOpen}
            newWorkspaceName={newWorkspaceName}
            recentRuns={recentRuns}
            retentionUpdatingId={retentionUpdatingId}
            loading={loading}
            onApplyStarter={applyProblemStarter}
            onToggleWorkspaceCreate={() => setWorkspaceCreateOpen((current) => !current)}
            onWorkspaceNameChange={setNewWorkspaceName}
            onCreateWorkspace={handleCreateWorkspace}
            onOpenRun={openRun}
            onRetentionChange={handleRunRetention}
          />
        )}

        {resultViewOpen && (announcement || activeRun) && (
          isVisualResearch || isRunActive || activeRun?.status !== 'completed'
        ) && (
          <section className="run-status-strip" role="status">
            <div>
              <span className="status-dot" data-active={isRunActive || undefined} aria-hidden="true" />
              <strong>{announcement || '研究已准备就绪'}</strong>
              <small>{resultCountLabel}</small>
            </div>
            <div className="run-status-actions">
              {isRunActive && <button className="research-cancel" type="button" onClick={() => void handleCancel()}>取消研究</button>}
              {activeRun && ['partial', 'blocked', 'failed', 'cancelled'].includes(activeRun.status) && (
                <button
                  className="research-retry"
                  type="button"
                  disabled={publicEdition && !verificationReady}
                  onClick={() => void handleRetry()}
                >
                  {retryActionLabel(activeRun)}
                </button>
              )}
              {isRunActive && <details>
                <summary>查看研究进度</summary>
                <ol className="stage-list">
                  {currentStageLabels.map((stage) => (
                    <li key={stage.status} aria-current={activeStatus === stage.status ? 'step' : undefined}>{stage.label}</li>
                  ))}
                </ol>
              </details>}
            </div>
          </section>
        )}

        {publicEdition
          && resultViewOpen
          && !verificationReady
          && activeRun
          && ['partial', 'blocked', 'failed', 'cancelled'].includes(activeRun.status) && (
          <section className="public-verification public-verification--result" aria-label="重试人机校验">
            <div>
              <CircleDashed aria-hidden="true" />
              <span>继续研究前请重新完成人机校验</span>
            </div>
            {verificationControl}
          </section>
        )}

        {actionError && <p className="workbench-error" role="alert">{actionError}</p>}

        {resultViewOpen && activePartialDiagnosis && (
          <section className="coverage-summary" aria-labelledby="coverage-summary-title">
            <CircleDashed aria-hidden="true" />
            <div>
              <h2 id="coverage-summary-title">{activePartialDiagnosis.title}</h2>
              <p>{activePartialDiagnosis.summary}</p>
              {activePartialDiagnosis.gaps.length > 0 && (
                <ul>
                  {activePartialDiagnosis.gaps.map((gap) => <li key={gap}>{gap}</li>)}
                </ul>
              )}
              <p className="coverage-next-step">{activePartialDiagnosis.nextStep}</p>
            </div>
          </section>
        )}

        {!demoMode && resultViewOpen && isVisualResearch && allResultsMissingPreviews && (
          <section className="drawing-recovery" aria-labelledby="drawing-recovery-title">
            <MonitorUp aria-hidden="true" />
            <div className="drawing-recovery-copy">
              <h2 id="drawing-recovery-title">这次研究暂时没有可显示的图纸</h2>
              <p>
                {anyPreviewLoadFailed
                  ? '来源图片链接无法加载；可打开原始页面查看，或重新研究获取新的预览。'
                  : runHadBrowserUnavailable
                  ? browserConnected === true
                    ? '扩展现已连接，重新研究后可提取网页中的图纸。'
                    : '研究时浏览器扩展未连接，因此只保留了网页文字和来源。'
                  : '来源页没有返回可展示图片；可先打开原始页面核对，再重新研究。'}
              </p>
              {browserPairingStatus && <small className="browser-pairing-status" aria-live="polite">{browserPairingStatus}</small>}
            </div>
            <div className="drawing-recovery-actions">
              {!publicEdition && browserConnected !== true && (
                <button type="button" disabled={browserConnecting} onClick={() => void handleConnectBrowser()}>
                  <MonitorUp aria-hidden="true" />{browserConnecting ? '正在打开 Chrome…' : '在 Chrome 中连接图纸提取扩展'}
                </button>
              )}
              {!publicEdition && <button type="button" onClick={() => void refreshBrowserConnection()}>
                <RefreshCw aria-hidden="true" />检查连接
              </button>}
              <button
                className="button-primary"
                type="button"
                disabled={(publicEdition && !verificationReady)
                  || (!publicEdition && browserConnected !== true)
                  || rerunStarting}
                onClick={() => void (publicEdition ? handleRetry() : handleRerunWithBrowser())}
              >
                {rerunStarting ? '正在重新研究…' : '重新研究'}
              </button>
            </div>
          </section>
        )}

        {loading && <section className="board-loading" aria-label="正在加载工作区"><p>正在读取本地工作区…</p></section>}
        {!loading && resultViewOpen && !demoMode && results.length === 0 && !actionError && (
          activeRun && isRunActive ? (
            <section className="active-research-canvas" aria-label="研究正在进行">
              <header>
                <span>{isVisualResearch ? '正在寻找图纸灵感 · 完成后结果会自动显示在这里' : '正在研究这个问题 · 完成后结果会自动显示在这里'}</span>
                <h1>{activeRun.question}</h1>
                <p>{activeStatus ? currentStageDescriptions[activeStatus] : isVisualResearch ? '正在准备灵感检索' : '正在准备研究任务'}</p>
              </header>
              <ol className="active-stage-track" aria-label="研究阶段">
                {currentStageLabels.slice(0, -1).map((stage, index) => (
                  <li
                    key={stage.status}
                    data-state={index < activeStageIndex ? 'complete' : index === activeStageIndex ? 'active' : 'upcoming'}
                    aria-current={index === activeStageIndex ? 'step' : undefined}
                  >
                    <span aria-hidden="true">{index + 1}</span>
                    {stage.label}
                  </li>
                ))}
              </ol>
              {activeRun.subquestions.length > 0 && (
                <section className="active-subquestions" aria-labelledby="active-subquestions-title">
                  <h2 id="active-subquestions-title">
                    {isVisualResearch
                      ? `正在探索 ${activeRun.subquestions.length} 个灵感方向`
                      : `已经拆成 ${activeRun.subquestions.length} 个研究问题`}
                  </h2>
                  <ol>
                    {activeRun.subquestions.map((subquestion) => (
                      <li key={subquestion.id}>{subquestion.question}</li>
                    ))}
                  </ol>
                </section>
              )}
            </section>
          ) : (
            <section className="board-empty" aria-label="尚无研究结果">
              <h2>{isVisualResearch ? '换一种图纸类型或风格描述再找' : '从一个具体设计问题开始'}</h2>
              <p>{isVisualResearch
                ? '可以写“剖面图风格”“效果图怎么出”，也可以补充线稿、拼贴、材质或配色偏好。'
                : '描述需要解决的空间、流线、更新或图纸表达问题，研究结果会按来源依据整理到这里。'}</p>
            </section>
          )
        )}

        {resultViewOpen && results.length > 0 && (
          <section className="results-section" aria-label="研究结果">
            <header className="result-task-heading">
              <span>{demoMode ? `${modeLabels[mode]}演示` : '本次研究任务'}</span>
              <h1>{researchQuestion}</h1>
              {isVisualResearch && (
                <p>这次只比较图纸的画面表达，并保留每张图的原笔记来源。</p>
              )}
              {demoMode && (
                <div className="demo-depth-contract" role="group" aria-label={`${modeLabels[mode]}说明`}>
                  <strong>{modeLabels[mode]}</strong>
                  <span>{researchDepthOptions[mode].target}</span>
                  <small>固定回放 · 展示完整结果结构</small>
                </div>
              )}
            </header>

            {activeSynthesis && (
              <section className="research-synthesis" aria-label="研究结论">
                <header>
                  <span>{isVisualResearch ? `${modeLabels[activeRun?.mode ?? mode]}研究结论` : '研究结论'}</span>
                  <h2 id="research-synthesis-title">{synthesisOverview?.headline}</h2>
                  {isVisualResearch && <small>
                    {synthesisOverview?.isFallback && '已核对原文的本地整理 · '}
                    {!synthesisOverview?.isFallback && synthesisOverview?.isProjected && '已从完整综合中提炼主要结论 · '}
                    {activeSynthesis.answer.evidence_asset_ids.length} 条原文引文直接支撑
                  </small>}
                </header>
                <div className="synthesis-primary" data-answer-only={!isVisualResearch || undefined}>
                  {isVisualResearch && <section>
                    <h3>关键推演</h3>
                    <ul>
                      {activeSynthesis.causal_chains.map((finding) => (
                        <li key={finding.statement}>
                          <span>{finding.statement}</span>
                          <small>{finding.evidence_asset_ids.length} 条证据</small>
                        </li>
                      ))}
                    </ul>
                  </section>}
                  <section>
                    <h3>{isVisualResearch ? '落地建议' : '优先做法'}</h3>
                    <ol>
                      {synthesisOverview?.actions.map((finding) => (
                        <li key={finding.statement}>
                          <span>{finding.statement}</span>
                          {isVisualResearch && <small>{finding.evidence_asset_ids.length} 条证据</small>}
                        </li>
                      ))}
                    </ol>
                  </section>
                  {!isVisualResearch && synthesisBoundary && (
                    <p className="synthesis-boundary">
                      <strong>适用条件</strong>
                      <span>{synthesisBoundary}</span>
                    </p>
                  )}
                </div>
                {isVisualResearch && (synthesisOverview?.isProjected
                  || activeSynthesis.comparisons.length > 0
                  || activeSynthesis.conflicts.length > 0
                  || activeSynthesis.applicability_boundaries.length > 0) && (
                  <details className="synthesis-audit">
                    <summary>
                      {synthesisOverview?.isProjected
                        ? '查看完整综合、比较与适用边界'
                        : '查看比较、冲突与适用边界'}
                    </summary>
                    <div>
                      {synthesisOverview?.isProjected && (
                        <section className="synthesis-original">
                          <h3>完整综合原文</h3>
                          <p>{synthesisOverview.rawStatement}</p>
                        </section>
                      )}
                      {activeSynthesis.comparisons.length > 0 && (
                        <section>
                          <h3>跨案例比较</h3>
                          <ul>{activeSynthesis.comparisons.map((item) => <li key={item.statement}>{item.statement}</li>)}</ul>
                        </section>
                      )}
                      {activeSynthesis.conflicts.length > 0 && (
                        <section>
                          <h3>冲突与不确定性</h3>
                          <ul>{activeSynthesis.conflicts.map((item) => <li key={item.statement}>{item.statement}</li>)}</ul>
                        </section>
                      )}
                      {activeSynthesis.applicability_boundaries.length > 0 && (
                        <section>
                          <h3>适用与失效边界</h3>
                          <ul>{activeSynthesis.applicability_boundaries.map((item) => <li key={item.statement}>{item.statement}</li>)}</ul>
                        </section>
                      )}
                    </div>
                  </details>
                )}
              </section>
            )}

            {isVisualResearch && <section className="question-decomposition" aria-label="灵感方向">
              <h2 className="visually-hidden">{isVisualResearch ? '图纸灵感方向' : '研究给出的方向'}</h2>
              <header className="section-heading">
                <div>
                  <h2>{isVisualResearch ? '灵感方向' : '问题拆解'}</h2>
                  <p>{isVisualResearch
                    ? '围绕你指定的图纸类型整理不同风格，方便比较哪种画法更适合当前任务。'
                    : subquestionSummaries.every((item) => item.caseAssetCount + item.inspirationCount > 0)
                      ? '每个子问题都已找到方案证据或制图灵感；两类结果分开整理，按当前任务选择使用。'
                      : '完整结果会覆盖每个子问题；当前没有证据的分支会明确保留，方便继续补研。'}</p>
                </div>
                <span>{researchSubquestions.length} 个{isVisualResearch ? '方向' : '子问题'}</span>
              </header>
              <ol className="subquestion-list">
                {subquestionSummaries.map((subquestion, index) => (
                  <li key={subquestion.id}>
                    <span className="subquestion-number" aria-hidden="true">{index + 1}</span>
                    <div>
                      <h3>{subquestion.question}</h3>
                      <p>{subquestion.rationale}</p>
                    </div>
                    <span className="subquestion-coverage">
                      {!isVisualResearch && subquestion.passCount !== undefined && `已调研 ${subquestion.passCount} 轮 · `}
                      {isVisualResearch
                        ? subquestion.inspirationCount > 0
                          ? `${subquestion.inspirationCount} 张灵感图`
                          : '暂未找到可用灵感'
                        : <>
                            {subquestion.projectCount} 个方案项目
                            {subquestion.caseAssetCount > 0 && ` · ${subquestion.caseAssetCount} 条案例证据`}
                            {subquestion.inspirationCount > 0 && ` · ${subquestion.inspirationCount} 张灵感图`}
                          </>}
                    </span>
                  </li>
                ))}
              </ol>
            </section>}

            {visualInspirationResults.length > 0 && (
              <VisualInspirationBoard
                isVisualResearch={isVisualResearch}
                postCount={visualInspirationNoteCount}
                inspirationResults={visualInspirationResults}
                allResults={results}
                groups={inspirationGroups}
                selectedIds={comparisonIds}
                failedPreviewUrls={failedPreviewUrls}
                onOpenResult={(trigger, resultId, subquestionId) => {
                  overlayTriggerRef.current = trigger
                  setSelectedResultId(resultId)
                  setSelectedSubquestionId(subquestionId)
                  setInspectorOpen(true)
                }}
                onPreviewFailed={markPreviewFailed}
                onToggleSelection={toggleComparison}
              />
            )}

            {(caseResults.length > 0 || activeRun?.goal === 'precedent_research' || demoMode) && (
              <CaseAnalysis
                groups={caseGroups}
                allResults={results}
                isVisualResearch={isVisualResearch}
                researchGoal={activeRun?.goal}
                failedPreviewUrls={failedPreviewUrls}
                selectedCollectionKeys={collectionSelections.map((item) => item.key)}
                selectionCount={collectionSelections.length}
                savedIds={savedIds}
                rejectedIds={rejectedIds}
                collectionSaving={collectionSaving}
                inspectorOpen={inspectorOpen}
                selectedResultId={selectedResultId}
                selectedSubquestionId={selectedSubquestionId}
                onAddCase={addCaseToCollection}
                onToggleCaseSelection={toggleCaseCollection}
                onOpenResult={(trigger, resultId, subquestionId) => {
                  overlayTriggerRef.current = trigger
                  setSelectedResultId(resultId)
                  setSelectedSubquestionId(subquestionId)
                  setInspectorOpen(true)
                }}
                onPreviewFailed={markPreviewFailed}
                isBrowserUnavailable={(sourceUrl) => (
                  browserWasUnavailableForSource(traceEvents, sourceUrl)
                )}
              />
            )}
          </section>
        )}

        {resultViewOpen && results.length > 0 && (
          <section className="result-workbench" aria-label="结果工作台">
            <div className="result-workbench-intro">
              <SlidersHorizontal aria-hidden="true" />
              <div>
                <h2 id="result-workbench-title">{isVisualResearch ? '把图纸灵感带回表达' : '把案例研究带回方案'}</h2>
                <p>{isVisualResearch
                  ? '整理图纸的画面语言与自己的表达规范，把真正能用的图纸加入收藏。'
                  : '比较案例的设计策略，整理方案依据，或导出结果继续使用。'}</p>
              </div>
            </div>
            <div className={`result-workbench-actions result-workbench-actions--${isVisualResearch ? 'visual' : 'precedent'}`}>
              {!isVisualResearch && <button aria-label="对照案例策略" aria-describedby="tool-compare-help" type="button" disabled={selectedProjectCount < 2} onClick={(event) => { overlayTriggerRef.current = event.currentTarget; setComparisonOpen(true) }}>
                <Columns3 aria-hidden="true" />
                <span><strong>对照案例策略</strong><small id="tool-compare-help">{selectedProjectCount < 2 ? `已选 ${selectedProjectCount} 个案例，还需选择 ${2 - selectedProjectCount} 个不同案例` : `对照 ${selectedProjectCount} 个案例的策略与适用条件`}</small></span>
              </button>}
              {isVisualResearch && <button aria-label="编辑图纸表达规范" aria-describedby="tool-style-help" type="button" onClick={(event) => { overlayTriggerRef.current = event.currentTarget; setStyleProfileOpen(true) }}>
                <Palette aria-hidden="true" />
                <span><strong>编辑图纸表达规范</strong><small id="tool-style-help">手动设定配色、线宽与字体，保存到本研究板</small></span>
              </button>}
              {isVisualResearch ? (
                <button aria-label="查看个人收藏" aria-describedby="tool-collection-help" type="button" onClick={(event) => void openPersonalCollections(event.currentTarget)}>
                  <Bookmark aria-hidden="true" />
                  <span><strong>查看个人收藏</strong><small id="tool-collection-help">按题目整理已收藏的图纸灵感</small></span>
                </button>
              ) : (
                <button aria-label="导出案例对照表" aria-describedby="tool-private-export-help" type="button" disabled={privateExportDisabled} onClick={() => void handleExport('private')}>
                  <Download aria-hidden="true" />
                  <span><strong>导出案例对照表</strong><small id="tool-private-export-help">{selectedProjectCount < 2 ? `已选 ${selectedProjectCount} 个案例，还需选择 ${2 - selectedProjectCount} 个不同案例` : `把 ${selectedProjectCount} 个案例的核心解法与适用条件整理成一张对照表`}</small></span>
                </button>
              )}
              <button aria-label={isVisualResearch ? '生成可分享来源板' : '生成可分享结果板'} aria-describedby="tool-share-export-help" type="button" disabled={comparisonIds.length === 0} onClick={(event) => { overlayTriggerRef.current = event.currentTarget; setShareSummaryOpen(true) }}>
                <Share2 aria-hidden="true" />
                <span><strong>{isVisualResearch ? '生成可分享来源板' : '生成可分享结果板'}</strong><small id="tool-share-export-help">{comparisonIds.length === 0 ? '先在上方结果中选中至少 1 项参考' : isVisualResearch ? '受限图片只保留署名、来源与链接' : '整理已选案例的核心解法与怎么做'}</small></span>
              </button>
            </div>
            {lastExport && (
              <div className="result-export-ready">
                <Check aria-hidden="true" />
                <span>{lastExport.mode === 'private'
                  ? `${isVisualResearch ? '图纸整理版' : '案例对照表'}已生成`
                  : `${isVisualResearch ? '分享来源板' : '分享结果板'}已生成`}</span>
                <a href={lastExport.browser_url} target="_blank" rel="noreferrer">
                  {lastExport.mode === 'private'
                    ? `打开${isVisualResearch ? '图纸整理版' : '案例对照表'}`
                    : `打开${isVisualResearch ? '分享来源板' : '分享结果板'}`}
                  <ExternalLink aria-hidden="true" />
                </a>
              </div>
            )}
          </section>
        )}

        {resultViewOpen
          && (selectedPendingCollectionCount > 0 || collectionSaveSucceeded) && (
          <section className="collection-dock" aria-label="收藏选择">
            {collectionSaveSucceeded && selectedPendingCollectionCount === 0 ? (
              <div className="collection-dock-success" role="status">
                <Check aria-hidden="true" /><strong>{announcement}</strong>
              </div>
            ) : (
              <>
                <div className="collection-dock-summary">
                  <strong>{isVisualResearch ? `已选 ${selectedPendingCollectionCount} 张图纸（最多 6 张）` : `已选 ${selectedPendingCollectionCount} 个项目案例（最多 6 个）`}</strong>
                  <span>把真正能用的参考加入个人收藏，之后可在主页回看</span>
                </div>
                <div className="collection-dock-actions">
                  <button type="button" onClick={() => void clearResultSelection()}>清空选择</button>
                  {!isVisualResearch && (
                    <button type="button" disabled={selectedProjectCount < 2} onClick={(event) => { overlayTriggerRef.current = event.currentTarget; setComparisonOpen(true) }}>对照案例策略</button>
                  )}
                  <button
                    className="collection-add"
                    type="button"
                    aria-label={`添加 ${selectedPendingCollectionCount} 项到个人收藏`}
                    disabled={collectionSaving}
                    onClick={() => void addSelectionToCollection()}
                  >
                    <Bookmark aria-hidden="true" />{collectionSaving ? '正在添加…' : '添加到个人收藏'}
                  </button>
                </div>
              </>
            )}
          </section>
        )}

        {styleProfileOpen && (
          <StylePanel
            profile={styleProfile}
            status={styleStatus}
            onChange={setStyleProfile}
            onSave={handleStyleSave}
            onClose={closeOverlays}
          />
        )}

        {!isVisualResearch && comparisonOpen && (
          <ComparisonDialog
            results={selectedComparisonResults}
            failedPreviewUrls={failedPreviewUrls}
            onPreviewFailed={markPreviewFailed}
            onClose={closeOverlays}
          />
        )}

        {shareSummaryOpen && (
          <SharePanel
            isVisualResearch={isVisualResearch}
            selectedCount={comparisonIds.length}
            shareableCount={shareableCount}
            onConfirm={() => handleExport('share')}
            onClose={closeOverlays}
          />
        )}

        {collectionOpen && (
          <PersonalCollectionsPage
            loading={collectionsLoading}
            collections={personalCollections}
            view={collectionView}
            selectedSubquestion={selectedCollectionSubquestion}
            onViewChange={(nextView) => {
              setCollectionView(nextView)
              setSelectedCollectionSubquestion(null)
            }}
            onSelectedSubquestionChange={setSelectedCollectionSubquestion}
            onDelete={deletePersonalCollection}
          />
        )}

      </section>

      {inspectorOpen && selectedResult && (
        <SourceInspector
          result={selectedResult}
          failedPreviewUrls={failedPreviewUrls}
          saved={savedIds.includes(selectedResult.id)}
          rejected={rejectedIds.includes(selectedResult.id)}
          note={notes[selectedResult.id] ?? ''}
          onPreviewFailed={markPreviewFailed}
          onToggleSaved={() => toggleSaved(selectedResult.id)}
          onToggleRejected={() => toggleRejected(selectedResult.id)}
          onNoteChange={(note) => setNotes((current) => ({ ...current, [selectedResult.id]: note }))}
          onNoteSave={(note) => saveNote(selectedResult.id, note)}
          onClose={closeOverlays}
        />
      )}

    </main>
  )
}
