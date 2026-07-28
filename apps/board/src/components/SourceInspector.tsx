import { ExternalLink, ImageOff } from 'lucide-react'

import {
  assetLabels,
  associationLabels,
  publicationTierLabels,
  rightsStatusLabels,
} from '../lib/labels'
import {
  availablePreviewUrl,
  type WorkResult,
} from '../lib/workResult'

interface SourceInspectorProps {
  result: WorkResult
  failedPreviewUrls: Record<string, string>
  saved: boolean
  rejected: boolean
  note: string
  onPreviewFailed: (resultId: string, previewUrl: string) => void
  onToggleSaved: () => void | Promise<void>
  onToggleRejected: () => void | Promise<void>
  onNoteChange: (note: string) => void
  onNoteSave: (note: string) => void | Promise<void>
  onClose: () => void
}

export function SourceInspector({
  result,
  failedPreviewUrls,
  saved,
  rejected,
  note,
  onPreviewFailed,
  onToggleSaved,
  onToggleRejected,
  onNoteChange,
  onNoteSave,
  onClose,
}: SourceInspectorProps) {
  const previewUrl = availablePreviewUrl(result, failedPreviewUrls)
  const previewLoadFailed = Boolean(
    result.previewUrl && failedPreviewUrls[result.id] === result.previewUrl,
  )

  return (
    <>
      <button className="drawer-backdrop" type="button" tabIndex={-1} aria-hidden="true" onClick={onClose} />
      <aside className="source-inspector" role="dialog" aria-modal="true" aria-label="来源检视器">
        <header className="inspector-heading">
          <div><span>来源检视器</span><h2>核对原文证据</h2></div>
          <button type="button" autoFocus onClick={onClose}>关闭</button>
        </header>
        <div className="inspector-content">
          <section className="inspector-preview-pane" aria-label="项目预览">
            <figure aria-label={`${result.project} 项目预览`}>
              <div className="inspector-preview" data-drawing={result.drawing}>
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt={`${result.project} ${assetLabels[result.assetType]}`}
                    onError={() => onPreviewFailed(result.id, previewUrl)}
                  />
                ) : (
                  <div className="preview-unavailable">
                    <ImageOff aria-hidden="true" />
                    <strong>{previewLoadFailed ? '项目预览加载失败' : '暂无项目预览'}</strong>
                    <p>打开原始来源查看完整项目；设计机制以正文引文为准。</p>
                  </div>
                )}
                <div className="evidence-image-labels">
                  <span>{assetLabels[result.assetType]}</span>
                  {previewUrl && result.previewSource && (
                    <span>{result.previewSource === 'chrome' ? 'Chrome 项目预览' : '公开网页预览'}</span>
                  )}
                </div>
              </div>
              <figcaption>
                <strong>{result.project}</strong>
                <span>{result.location} · {result.year}</span>
              </figcaption>
            </figure>
            <a className="source-link" href={result.sourceUrl} target="_blank" rel="noreferrer">
              打开原始来源 <ExternalLink aria-hidden="true" />
            </a>
          </section>

          <section className="inspector-analysis-pane" aria-label="来源证据">
            <strong className="inspector-project">{result.project}</strong>
            <p className="inspector-location">{result.location} · {result.year}</p>
            <section
              className="inspector-source-evidence"
              aria-labelledby={`source-evidence-${result.id}`}
            >
              <header>
                <h3 id={`source-evidence-${result.id}`}>逐字原文证据</h3>
                <span>{result.evidenceClaims.length} 条</span>
              </header>
              {result.evidenceClaims.map((claim) => (
                <section className="evidence-locator" key={claim.id}>
                  <h4>{claim.claim_type === 'fact' ? '来源事实' : '补充来源'}</h4>
                  <p>{claim.statement}</p>
                  {claim.text_excerpt && <blockquote>{claim.text_excerpt}</blockquote>}
                  {claim.pdf_page && <p>PDF 第 {claim.pdf_page} 页</p>}
                  {claim.source_url && <a href={claim.source_url} target="_blank" rel="noreferrer">打开证据定位</a>}
                </section>
              ))}
            </section>
            <section
              className="inspector-verification"
              aria-labelledby={`source-verification-${result.id}`}
            >
              <h3 id={`source-verification-${result.id}`}>核验与权利</h3>
              <dl className="evidence-matrix">
                <div><dt>发布来源</dt><dd>{publicationTierLabels[result.publicationTier]}</dd></div>
                <div><dt>项目身份</dt><dd>{associationLabels[result.projectIdentity]}</dd></div>
                <div><dt>图片归属</dt><dd>{associationLabels[result.assetAssociation]}</dd></div>
                <div><dt>权利状态</dt><dd>{rightsStatusLabels[result.rightsStatus]}</dd></div>
              </dl>
            </section>
            <div className="inspector-actions">
              <button type="button" aria-pressed={saved} onClick={() => void onToggleSaved()}>{saved ? '取消收藏' : '收藏参考'}</button>
              <button type="button" aria-pressed={rejected} onClick={() => void onToggleRejected()}>{rejected ? '撤销拒绝' : '拒绝参考'}</button>
            </div>
            <label htmlFor={`note-${result.id}`}>研究备注</label>
            <textarea
              id={`note-${result.id}`}
              value={note}
              onChange={(event) => onNoteChange(event.target.value)}
              onBlur={(event) => void onNoteSave(event.target.value)}
              placeholder="记录为何有用、还要核验什么。"
            />
          </section>
        </div>
      </aside>
    </>
  )
}
