import {
  Check,
  ExternalLink,
  ImageOff,
  Plus,
} from 'lucide-react'

import type { ResearchSubquestion } from '../api/client'
import type { AssetType } from '../data/mock'
import {
  assetLabels,
  publicationTierLabels,
  questionRelevanceLabel,
  rightsStatusLabels,
  visualPlatformName,
} from '../lib/labels'
import {
  availablePreviewUrl,
  type WorkResult,
} from '../lib/workResult'

export type InspirationGroup = {
  subquestion: ResearchSubquestion
  assets: WorkResult[]
  typeGroups: Array<{
    assetType: AssetType
    assets: WorkResult[]
  }>
  noteGroups: Array<{
    sourceUrl: string
    assets: WorkResult[]
    primary: WorkResult
    observation: string
    relevance: number
  }>
}

type VisualInspirationBoardProps = {
  isVisualResearch: boolean
  postCount: number
  inspirationResults: WorkResult[]
  allResults: WorkResult[]
  groups: InspirationGroup[]
  selectedIds: string[]
  failedPreviewUrls: Record<string, string>
  onOpenResult: (trigger: HTMLElement, resultId: string, subquestionId: string) => void
  onPreviewFailed: (resultId: string, previewUrl: string) => void
  onToggleSelection: (resultId: string) => void | Promise<void>
}

export function VisualInspirationBoard({
  isVisualResearch,
  postCount,
  inspirationResults,
  allResults,
  groups,
  selectedIds,
  failedPreviewUrls,
  onOpenResult,
  onPreviewFailed,
  onToggleSelection,
}: VisualInspirationBoardProps) {
  return (
    <section className="visual-inspiration-board" aria-label="视觉灵感板">
      <header className="visual-inspiration-heading section-heading">
        <div>
          <h2>小红书制图灵感</h2>
          <p>{isVisualResearch
            ? '按灵感方向和帖子整理，每篇集中展示多张图；只比较画面表达，不用于确认项目事实或图纸权利。'
            : '只作视觉参考：按问题和图纸类型整理可见表达，帮助判断“图怎么出”，不用于确认项目事实或图纸权利。'}</p>
          {isVisualResearch && (
            <p className="visual-count-note">总数按不重复图片计算；同一张图可能出现在多个方向。</p>
          )}
        </div>
        <span>{postCount} 篇帖子 · {inspirationResults.length} 张灵感图</span>
      </header>

      <div className="inspiration-question-groups">
        {groups.map((group) => (
          <section
            className="inspiration-question"
            key={group.subquestion.id}
            aria-labelledby={`inspiration-question-${group.subquestion.id}`}
          >
            <header className="inspiration-question-heading">
              <div>
                <h3 id={`inspiration-question-${group.subquestion.id}`}>{group.subquestion.question}</h3>
                <p>{group.subquestion.rationale}</p>
              </div>
              <span>{group.noteGroups.length} 篇 · {group.assets.length} 张</span>
            </header>

            <div className="inspiration-type-index" aria-label="图纸类型">
              {group.typeGroups.map((typeGroup) => (
                <span key={typeGroup.assetType}>
                  {assetLabels[typeGroup.assetType]} · {typeGroup.assets.length} 张
                </span>
              ))}
            </div>
            <div className="inspiration-note-list">
              {group.noteGroups.map((note) => (
                <article
                  className="inspiration-note"
                  key={note.sourceUrl}
                  aria-label={`灵感帖子 ${note.primary.project}`}
                >
                  <header className="inspiration-note-heading">
                    <div>
                      <span>
                        {visualPlatformName(note.sourceUrl) ?? '视觉平台'} · {questionRelevanceLabel(note.relevance)}
                      </span>
                      <h4>{note.primary.project}</h4>
                      {note.observation && <p>{note.observation}</p>}
                    </div>
                    <span>{note.assets.length} 张</span>
                  </header>
                  <div className="inspiration-note-grid">
                    {note.assets.map((result) => {
                      const resultIndex = allResults.findIndex((item) => item.id === result.id)
                      const selectedForCollection = selectedIds.includes(result.id)
                      const collectionTarget = [
                        group.subquestion.question,
                        result.project,
                        assetLabels[result.assetType],
                        `第 ${resultIndex + 1} 张`,
                      ].join(' · ')
                      const previewUrl = availablePreviewUrl(result, failedPreviewUrls)
                      const previewLoadFailed = Boolean(
                        result.previewUrl && failedPreviewUrls[result.id] === result.previewUrl,
                      )
                      return (
                        <div className="inspiration-note-image" key={result.id}>
                          <button
                            className="inspiration-note-preview"
                            type="button"
                            aria-label={`查看制图灵感 ${result.project} ${assetLabels[result.assetType]}`}
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
                                    <strong>{previewLoadFailed ? '灵感图加载失败' : '未提取到灵感图'}</strong>
                                    <p>打开原笔记查看图片，并核对图片与文字的对应关系。</p>
                                  </div>
                                )}
                                <div className="evidence-image-labels">
                                  <span>{assetLabels[result.assetType]}</span>
                                </div>
                              </div>
                            </figure>
                          </button>
                          <button
                            className="inspiration-note-select"
                            type="button"
                            aria-label={selectedForCollection
                              ? `取消 ${collectionTarget}收藏选择`
                              : `选择 ${collectionTarget}用于收藏`}
                            title={selectedForCollection
                              ? `取消 ${collectionTarget}收藏选择`
                              : `选择 ${collectionTarget}用于收藏`}
                            aria-pressed={selectedForCollection}
                            disabled={selectedIds.length >= 6 && !selectedForCollection}
                            onClick={() => void onToggleSelection(result.id)}
                          >
                            {selectedForCollection ? <Check aria-hidden="true" /> : <Plus aria-hidden="true" />}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                  <footer className="inspiration-note-footer">
                    <p>
                      {publicationTierLabels[note.primary.publicationTier]} · 权利 {rightsStatusLabels[note.primary.rightsStatus]}
                    </p>
                    <a href={note.sourceUrl} target="_blank" rel="noreferrer">
                    <ExternalLink aria-hidden="true" />
                      打开原笔记
                    </a>
                  </footer>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  )
}
