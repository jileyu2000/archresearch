import {
  Bookmark,
  Check,
  ExternalLink,
  ImageOff,
  Plus,
} from 'lucide-react'

import type {
  ResearchGoal,
  ResearchSubquestion,
} from '../api/client'
import { collectionSelectionKey } from '../lib/collections'
import {
  assetLabels,
  publicationTierLabels,
  questionRelevanceLabel,
  rightsStatusLabels,
} from '../lib/labels'
import {
  sourceHostLabel,
  uniqueSummaryItems,
  userFacingProjectName,
} from '../lib/text'
import {
  availablePreviewUrl,
  analysisFor,
  projectPreviewCopy,
  type WorkResult,
} from '../lib/workResult'

export type CaseGroup = {
  index: number
  subquestion: ResearchSubquestion
  assets: WorkResult[]
  dossiers: Array<{
    project: string
    assets: WorkResult[]
    primary: WorkResult
    analysis: ReturnType<typeof analysisFor>
    previewCopy: ReturnType<typeof projectPreviewCopy>
  }>
  questionSummary: {
    statement: string | undefined
  } | null
  unassigned: boolean
}

type CaseAnalysisProps = {
  groups: CaseGroup[]
  allResults: WorkResult[]
  isVisualResearch: boolean
  researchGoal: ResearchGoal | undefined
  failedPreviewUrls: Record<string, string>
  selectedCollectionKeys: string[]
  selectionCount: number
  savedIds: string[]
  rejectedIds: string[]
  collectionSaving: boolean
  inspectorOpen: boolean
  selectedResultId: string
  selectedSubquestionId: string
  onAddCase: (resultId: string, subquestionId?: string) => void | Promise<void>
  onToggleCaseSelection: (resultId: string, subquestionId?: string) => void | Promise<void>
  onOpenResult: (trigger: HTMLElement, resultId: string, subquestionId: string) => void
  onPreviewFailed: (resultId: string, previewUrl: string) => void
  isBrowserUnavailable: (sourceUrl: string) => boolean
}

export function CaseAnalysis({
  groups,
  allResults,
  isVisualResearch,
  researchGoal,
  failedPreviewUrls,
  selectedCollectionKeys,
  selectionCount,
  savedIds,
  rejectedIds,
  collectionSaving,
  inspectorOpen,
  selectedResultId,
  selectedSubquestionId,
  onAddCase,
  onToggleCaseSelection,
  onOpenResult,
  onPreviewFailed,
  isBrowserUnavailable,
}: CaseAnalysisProps) {
  return (
    <section className="case-analysis" aria-label="案例研究结果">
      <header className="results-header section-heading">
        <div>
          <h2>案例研究结果</h2>
        </div>
      </header>

      <div className="case-chapters">
        {groups.filter((group) => !group.unassigned).map((group) => (
          <section
            className="case-chapter"
            key={group.subquestion.id}
            aria-labelledby={`case-chapter-${group.subquestion.id}`}
          >
            <header className="case-chapter-heading">
              <span aria-hidden="true">{group.unassigned ? '待归组' : `子问题 ${group.index + 1}`}</span>
              <div>
                <h3 id={`case-chapter-${group.subquestion.id}`}>{group.subquestion.question}</h3>
                {group.questionSummary && (
                  <p className="case-chapter-conclusion">{group.questionSummary.statement}</p>
                )}
              </div>
            </header>

            {group.assets.length === 0 ? (
              <div className="case-chapter-empty">
                <strong>这一问题暂时没有可用结果</strong>
                <p>可以换一个更具体的空间条件后重新研究。</p>
              </div>
            ) : (
              <>
                <ol className="case-answer-list" aria-label={`${group.subquestion.question}的案例结论`}>
                  {group.dossiers.map((dossier, dossierIndex) => {
                    const caseSubquestionId = group.unassigned ? undefined : group.subquestion.id
                    // The chapter conclusion is the first case's mechanism verbatim,
                    // so that one case does not read the same sentence twice in a row.
                    const mechanismIsChapterConclusion = dossierIndex === 0
                      && dossier.analysis.designMechanism.trim() === group.questionSummary?.statement
                    const originalProject = userFacingProjectName(dossier.project)
                    const chineseProject = dossier.analysis.projectNameZh
                    const selectionKey = collectionSelectionKey(dossier.primary.id, caseSubquestionId)
                    const caseSelected = selectedCollectionKeys.includes(selectionKey)
                    const caseSaved = savedIds.includes(dossier.primary.id)
                    const displayProject = chineseProject || originalProject
                    const actions = uniqueSummaryItems(dossier.analysis.transferStrategy, 3)
                    const previewResult = dossier.assets.find((result) => (
                      Boolean(availablePreviewUrl(result, failedPreviewUrls))
                    ))
                    const previewUrl = previewResult
                      ? availablePreviewUrl(previewResult, failedPreviewUrls)
                      : null
                    const identityLine = [dossier.primary.location, dossier.primary.year]
                      .filter((item) => item && !/实时网页研究|待核对|未知|未记录/.test(item))
                      .join(' · ')
                    return (
                      <li className="case-answer-item" key={dossier.project}>
                        <article className="project-dossier case-answer" aria-label={`代表案例 ${displayProject}`}>
                          <header className="dossier-heading case-answer-heading">
                            <div>
                              <h4 className="case-answer-title">{displayProject}</h4>
                              {chineseProject && chineseProject !== originalProject && (
                                <p className="case-answer-original-name">{originalProject}</p>
                              )}
                              {identityLine && <p>{identityLine}</p>}
                            </div>
                            <div className="dossier-actions">
                              <button
                                className="dossier-save"
                                type="button"
                                aria-label={`${caseSaved ? '已加入收藏' : '加入个人收藏'} ${displayProject}`}
                                disabled={collectionSaving || caseSaved}
                                onClick={() => void onAddCase(dossier.primary.id, caseSubquestionId)}
                              >
                                {caseSaved ? <Check aria-hidden="true" /> : <Bookmark aria-hidden="true" />}
                                <span>{caseSaved ? '已加入收藏' : collectionSaving ? '正在添加…' : '加入个人收藏'}</span>
                              </button>
                              <button
                                className="dossier-select"
                                type="button"
                                aria-pressed={caseSelected}
                                aria-label={`${caseSelected ? '取消选择案例' : '选择案例'} ${displayProject}`}
                                disabled={selectionCount >= 6 && !caseSelected}
                                onClick={() => void onToggleCaseSelection(
                                  dossier.primary.id,
                                  caseSubquestionId,
                                )}
                              >
                                {caseSelected ? <Check aria-hidden="true" /> : <Plus aria-hidden="true" />}
                                <span>{caseSelected ? '已选择案例' : '选择案例'}</span>
                              </button>
                            </div>
                          </header>

                          <div className="case-answer-layout" data-has-image={Boolean(previewUrl) || undefined}>
                            <section className="case-answer-copy" aria-label={`${displayProject} 的研究结果`}>
                              {!mechanismIsChapterConclusion && (
                                <p className="case-answer-mechanism">{dossier.analysis.designMechanism}</p>
                              )}
                              {actions.length > 0 && (
                                <div className="case-answer-actions">
                                  <h5>怎么做</h5>
                                  <ol>{actions.map((step) => <li key={step}>{step}</li>)}</ol>
                                </div>
                              )}
                              {dossier.analysis.limitation && (
                                <p className="case-answer-boundary">
                                  <strong>适用条件</strong>
                                  <span>{dossier.analysis.limitation}</span>
                                </p>
                              )}
                              <a
                                className="case-answer-source"
                                href={dossier.primary.sourceUrl}
                                target="_blank"
                                rel="noreferrer"
                                aria-label={`打开出处：${displayProject}`}
                              >
                                <ExternalLink aria-hidden="true" />
                                <span>出处 · {sourceHostLabel(dossier.primary.sourceUrl)}</span>
                              </a>
                            </section>
                            {previewResult && previewUrl && (
                              <figure className="case-answer-image">
                                <img
                                  src={previewUrl}
                                  alt={`${displayProject} ${assetLabels[previewResult.assetType]}`}
                                  loading="lazy"
                                  decoding="async"
                                  onError={() => onPreviewFailed(previewResult.id, previewUrl)}
                                />
                                <figcaption>{assetLabels[previewResult.assetType]}</figcaption>
                              </figure>
                            )}
                          </div>

                          {isVisualResearch && (
                            <section className="dossier-evidence-set" aria-label={`${dossier.project} 项目预览`}>
                              <header>
                                <h5>项目预览</h5>
                                <span>{dossier.assets.length} 项 · 图片仅用于定位来源，机制以正文引文为准</span>
                              </header>
                              {dossier.previewCopy.shared.length > 0 && (
                                <div className="dossier-preview-copy">
                                  <span>共同图面说明</span>
                                  {dossier.previewCopy.shared.map((item) => <p key={item}>{item}</p>)}
                                </div>
                              )}
                              <div
                                className="dossier-gallery"
                                data-layout={dossier.assets.length === 1 ? 'single' : 'grid'}
                              >
                                {dossier.assets.map((result) => {
                                  const resultIndex = allResults.findIndex((item) => item.id === result.id)
                                  const previewCopy = dossier.previewCopy.assetCopy.get(result.id)
                                  const previewUrl = availablePreviewUrl(result, failedPreviewUrls)
                                  const previewLoadFailed = Boolean(
                                    result.previewUrl && failedPreviewUrls[result.id] === result.previewUrl,
                                  )
                                  const browserWasUnavailable = isBrowserUnavailable(result.sourceUrl)
                                  return (
                                    <div
                                      className="evidence-sheet"
                                      data-selected={(
                                        inspectorOpen
                                        && selectedResultId === result.id
                                        && selectedSubquestionId === group.subquestion.id
                                      ) || undefined}
                                      data-saved={savedIds.includes(result.id) || undefined}
                                      data-rejected={rejectedIds.includes(result.id) || undefined}
                                      key={result.id}
                                    >
                                      <button
                                        className="evidence-sheet-main"
                                        type="button"
                                        aria-label={`查看 ${result.project} ${assetLabels[result.assetType]}证据`}
                                        onClick={(event) => onOpenResult(
                                          event.currentTarget,
                                          result.id,
                                          group.subquestion.id,
                                        )}
                                      >
                                        <figure>
                                          <div className="evidence-image" data-drawing={result.drawing}>
                                            {previewUrl ? (
                                              <img
                                                src={previewUrl}
                                                alt={`${result.project} ${assetLabels[result.assetType]}`}
                                                loading={resultIndex < 6 ? 'eager' : 'lazy'}
                                                decoding="async"
                                                fetchPriority={resultIndex < 3 ? 'high' : 'auto'}
                                                onError={() => onPreviewFailed(result.id, previewUrl)}
                                              />
                                            ) : (
                                              <div className="preview-unavailable">
                                                <ImageOff aria-hidden="true" />
                                                <strong>
                                                  {researchGoal === 'precedent_research'
                                                    ? '暂无项目预览'
                                                    : previewLoadFailed
                                                    ? '项目预览加载失败'
                                                    : browserWasUnavailable
                                                    ? '此次未连接浏览器扩展，暂无项目预览'
                                                    : '暂无项目预览'}
                                                </strong>
                                                <p>打开原始来源查看完整项目；设计机制以正文引文为准。</p>
                                              </div>
                                            )}
                                            <div className="evidence-image-labels">
                                              <span>{assetLabels[result.assetType]}</span>
                                              {previewUrl && result.previewSource && (
                                                <span>{result.previewSource === 'chrome' ? 'Chrome 项目预览' : '公开网页预览'}</span>
                                              )}
                                              {previewLoadFailed && <span>来源链接</span>}
                                            </div>
                                          </div>
                                          {(previewCopy?.title || previewCopy?.observation) && (
                                            <figcaption>
                                              {previewCopy.title && <strong>{previewCopy.title}</strong>}
                                              {previewCopy.observation && <p>{previewCopy.observation}</p>}
                                            </figcaption>
                                          )}
                                        </figure>
                                      </button>
                                      <footer className="evidence-sheet-actions">
                                        <span>{questionRelevanceLabel(result.relevance)}</span>
                                        {!previewUrl && (
                                          <a
                                            className="evidence-source-action"
                                            href={result.sourceUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                          >
                                            <ExternalLink aria-hidden="true" />
                                            <span>打开原始来源</span>
                                          </a>
                                        )}
                                      </footer>
                                    </div>
                                  )
                                })}
                              </div>
                            </section>
                          )}

                          {isVisualResearch && (
                            <footer className="dossier-source">
                              <span>来源与权利分开记录</span>
                              <p>{publicationTierLabels[dossier.primary.publicationTier]} · 权利 {rightsStatusLabels[dossier.primary.rightsStatus]}</p>
                              <a href={dossier.primary.sourceUrl} target="_blank" rel="noreferrer">打开项目来源</a>
                            </footer>
                          )}
                        </article>
                      </li>
                    )
                  })}
                </ol>
              </>
            )}
          </section>
        ))}
      </div>
    </section>
  )
}
