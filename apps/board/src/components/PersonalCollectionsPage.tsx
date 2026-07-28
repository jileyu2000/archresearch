import {
  ArrowLeft,
  ChevronRight,
  ExternalLink,
  Eye,
  ImageOff,
  LayoutGrid,
  Trash2,
} from 'lucide-react'

import type { PersonalCollection } from '../api/client'
import {
  collectionCaseGroups,
  collectionCaseImages,
  collectionCaseImageUrl,
} from '../lib/collections'
import { assetLabels } from '../lib/labels'
import {
  firstUserFacingBoundary,
  sourceHostLabel,
  uniqueSummaryItems,
  userFacingProjectName,
} from '../lib/text'

export type CollectionView = 'precedent' | 'visual'

export type CollectionSubquestionSelection = {
  collectionQuestion: string
  subquestionId: string
} | null

type PersonalCollectionsPageProps = {
  loading: boolean
  collections: PersonalCollection[]
  view: CollectionView
  selectedSubquestion: CollectionSubquestionSelection
  onViewChange: (view: CollectionView) => void
  onSelectedSubquestionChange: (selection: CollectionSubquestionSelection) => void
  onDelete: (collectionId: string) => void | Promise<void>
}

export function PersonalCollectionsPage({
  loading,
  collections,
  view,
  selectedSubquestion,
  onViewChange,
  onSelectedSubquestionChange,
  onDelete,
}: PersonalCollectionsPageProps) {
  const sections = [
    {
      key: 'precedent' as const,
      title: '建筑方案',
      items: collections.filter((item) => item.snapshot.goal !== 'visual_reference_search'),
    },
    {
      key: 'visual' as const,
      title: '图纸灵感',
      items: collections.filter((item) => item.snapshot.goal === 'visual_reference_search'),
    },
  ].map((section) => ({
    ...section,
    groups: [...section.items.reduce((groups, item) => {
      const question = item.snapshot.question?.trim() || '未归类的历史收藏'
      const current = groups.get(question) ?? []
      current.push(item)
      groups.set(question, current)
      return groups
    }, new Map<string, PersonalCollection[]>()).entries()],
  }))
  const activeSection = sections.find((section) => section.key === view)
  const questionDirectory = activeSection?.key === 'precedent'
    ? activeSection.groups.flatMap(([collectionQuestion, items]) => (
        collectionCaseGroups(items).map((group) => ({ collectionQuestion, group }))
      ))
    : []
  const activeSubquestion = selectedSubquestion
    ? questionDirectory.find(({ collectionQuestion, group }) => (
        collectionQuestion === selectedSubquestion.collectionQuestion
        && group.id === selectedSubquestion.subquestionId
      ))
    : null

  return (
    <section className="collection-page" aria-label="个人收藏">
      <header className="panel-heading">
        <div>
          <h1>个人收藏</h1>
          <p>当前项目 · 按类型回看</p>
        </div>
      </header>
      {loading ? (
        <p className="collection-empty" role="status">正在读取收藏…</p>
      ) : (
        <>
          <div className="research-entry-switch collection-entry-switch" role="group" aria-label="收藏类型">
            {sections.map((section) => (
              <button
                type="button"
                key={section.key}
                aria-pressed={view === section.key}
                onClick={() => onViewChange(section.key)}
              >
                {section.key === 'visual' ? <Eye aria-hidden="true" /> : <LayoutGrid aria-hidden="true" />}
                <span>
                  <strong>{section.title}</strong>
                  <small>{section.items.length} 项 · {section.key === 'visual' ? '收藏图片' : '项目与研究文字'}</small>
                </span>
              </button>
            ))}
          </div>
          {!activeSection || activeSection.items.length === 0 ? (
            <p className="collection-mode-empty">
              {view === 'visual'
                ? '还没有图纸灵感收藏。去图纸灵感结果中选择图片。'
                : '还没有建筑方案收藏。去建筑研究结果中选择案例。'}
            </p>
          ) : view === 'precedent' ? (
            <div className="collection-architecture">
              {!activeSubquestion ? (
                <section className="collection-question-directory" aria-label="建筑问题目录">
                  <header className="collection-directory-heading">
                    <span>建筑方案</span>
                    <h2>问题目录</h2>
                    <p>按具体设计问题查看收藏案例，以及它们如何解决问题。</p>
                  </header>
                  <ul className="collection-directory-list">
                    {questionDirectory.map(({ collectionQuestion, group }) => (
                      <li key={`${collectionQuestion}:${group.id}`}>
                        <button
                          type="button"
                          aria-label={`查看子问题：${group.question}`}
                          onClick={() => onSelectedSubquestionChange({
                            collectionQuestion,
                            subquestionId: group.id,
                          })}
                        >
                          <span className="collection-directory-copy">
                            <small>原研究问题</small>
                            <strong>{collectionQuestion}</strong>
                            <span>研究方向：{group.question}</span>
                          </span>
                          <span className="collection-directory-count">{group.entries.length} 个已收藏案例</span>
                          <ChevronRight aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : (
                <>
                  <button
                    className="collection-directory-back"
                    type="button"
                    onClick={() => onSelectedSubquestionChange(null)}
                  >
                    <ArrowLeft aria-hidden="true" />返回问题目录
                  </button>
                  {activeSection.groups
                    .filter(([collectionQuestion]) => (
                      collectionQuestion === activeSubquestion.collectionQuestion
                    ))
                    .map(([collectionQuestion, items]) => (
                      <section
                        className="collection-question"
                        key={collectionQuestion}
                        aria-label={`原研究题目：${collectionQuestion}`}
                      >
                        <div className="collection-subquestions">
                          {collectionCaseGroups(items)
                            .filter((group) => group.id === activeSubquestion.group.id)
                            .map((group) => (
                              <section
                                className="collection-subquestion"
                                key={group.id}
                                aria-label={`研究子问题：${group.question}`}
                              >
                                <header className="collection-subquestion-heading">
                                  <span>研究子问题</span>
                                  <h3>{group.question}</h3>
                                  <small>{group.entries.length} 个已收藏案例</small>
                                </header>
                                <ul className="collection-architecture-list">
                                  {group.entries.map(({ item, analysis }) => {
                                    const snapshot = item.snapshot
                                    const originalName = userFacingProjectName(snapshot.project_name || '未命名项目')
                                    const chineseName = (analysis.project_name_zh ?? '').trim()
                                    const projectName = chineseName || originalName
                                    const designMechanism = analysis.design_mechanism.trim()
                                    const solutionSteps = uniqueSummaryItems(analysis.transfer_strategy, 3)
                                    const boundary = firstUserFacingBoundary(analysis.limitations)
                                    const caseImages = collectionCaseImages(item)
                                    const hasSolution = Boolean(designMechanism || solutionSteps.length)
                                    return (
                                      <li className="collection-architecture-item" key={`${item.id}:${analysis.id}`}>
                                        <article className="collection-case" aria-label={`收藏案例 ${projectName}`}>
                                          <header className="collection-case-heading">
                                            <div className="collection-case-title">
                                              <h4>{projectName}</h4>
                                              {chineseName && chineseName !== originalName && (
                                                <p className="case-answer-original-name">{originalName}</p>
                                              )}
                                            </div>
                                            <div className="collection-text-actions">
                                              <button
                                                type="button"
                                                aria-label={`删除收藏：${projectName}`}
                                                title="删除收藏"
                                                onClick={() => void onDelete(item.id)}
                                              >
                                                <Trash2 aria-hidden="true" />
                                              </button>
                                            </div>
                                          </header>
                                          <div className="collection-case-layout">
                                            {hasSolution ? (
                                              <section
                                                className="collection-case-solution"
                                                aria-label={`${projectName} 的解法`}
                                              >
                                                {designMechanism && (
                                                  <div className="collection-case-core">
                                                    <h5>核心解法</h5>
                                                    <p>{designMechanism}</p>
                                                  </div>
                                                )}
                                                {solutionSteps.length > 0 && (
                                                  <div className="collection-case-steps">
                                                    <h5>怎么做</h5>
                                                    <ol>{solutionSteps.map((step) => <li key={step}>{step}</li>)}</ol>
                                                  </div>
                                                )}
                                                {boundary && (
                                                  <p className="collection-case-boundary">
                                                    <strong>适用条件</strong>
                                                    <span>{boundary}</span>
                                                  </p>
                                                )}
                                                <a
                                                  className="collection-case-source"
                                                  href={item.source_url}
                                                  target="_blank"
                                                  rel="noreferrer"
                                                  aria-label={`打开出处：${projectName}`}
                                                >
                                                  <ExternalLink aria-hidden="true" />
                                                  <span>出处 · {sourceHostLabel(item.source_url)}</span>
                                                </a>
                                              </section>
                                            ) : (
                                              <p className="collection-case-missing">这条收藏还没有形成可复用解法。</p>
                                            )}
                                            {caseImages.length > 0 && (
                                              <div
                                                className="collection-case-media"
                                                role="group"
                                                aria-label={`${projectName} 案例图片`}
                                              >
                                                <div className="collection-case-image-grid">
                                                  {caseImages.map((image) => {
                                                    const imageType = assetLabels[image.asset_type]
                                                    const previewUrl = collectionCaseImageUrl(item, image)
                                                    return (
                                                      <figure className="collection-case-image" key={image.asset_id}>
                                                        <a
                                                          aria-label={`打开案例图片：${projectName} · ${imageType}`}
                                                          href={previewUrl}
                                                          target="_blank"
                                                          rel="noreferrer"
                                                        >
                                                          <img src={previewUrl} alt={`${projectName} · ${imageType}`} />
                                                        </a>
                                                        <figcaption>{imageType}</figcaption>
                                                      </figure>
                                                    )
                                                  })}
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        </article>
                                      </li>
                                    )
                                  })}
                                </ul>
                              </section>
                            ))}
                        </div>
                      </section>
                    ))}
                </>
              )}
            </div>
          ) : (
            <ul className="collection-visual-grid" aria-label="图纸灵感收藏">
              {activeSection.items.map((item) => {
                const snapshot = item.snapshot
                const itemName = snapshot.project_name || '收藏图纸'
                const previewUrl = snapshot.collection_file
                  ? `/v1/collections/${item.id}/content`
                  : snapshot.image_url
                return (
                  <li className="collection-visual-item" key={item.id}>
                    <div className="collection-visual-media">
                      {previewUrl ? (
                        <a
                          className="collection-visual-open"
                          aria-label={`打开高清图片：${itemName}`}
                          title="打开高清图片"
                          href={previewUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <img src={previewUrl} alt={itemName} loading="lazy" />
                        </a>
                      ) : (
                        <span className="collection-visual-placeholder" role="img" aria-label={`${itemName} 图片不可用`}>
                          <ImageOff aria-hidden="true" />
                        </span>
                      )}
                      <div className="collection-visual-actions">
                        <a
                          aria-label={`打开来源：${itemName}`}
                          title="打开来源"
                          href={item.source_url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <ExternalLink aria-hidden="true" />
                        </a>
                        <button
                          type="button"
                          aria-label={`删除收藏：${itemName}`}
                          title="删除收藏"
                          onClick={() => void onDelete(item.id)}
                        >
                          <Trash2 aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                    <div className="collection-visual-context">
                      <p>原研究问题：{snapshot.question || '历史收藏未记录原问题'}</p>
                      <p>灵感方向：{snapshot.visual_directions?.join('、') || '历史收藏未记录方向'}</p>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}
    </section>
  )
}
