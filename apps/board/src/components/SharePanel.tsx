interface SharePanelProps {
  isVisualResearch: boolean
  selectedCount: number
  shareableCount: number
  onConfirm: () => void | Promise<void>
  onClose: () => void
}

export function SharePanel({
  isVisualResearch,
  selectedCount,
  shareableCount,
  onConfirm,
  onClose,
}: SharePanelProps) {
  return (
    <section className="floating-panel share-panel" role="dialog" aria-modal="true" aria-label="分享版导出摘要">
      <h2>{isVisualResearch ? '分享前的图片授权检查' : '生成分享结果'}</h2>
      <p>{shareableCount} 张图片将直接放进分享版</p>
      {isVisualResearch ? <>
        <p>{selectedCount - shareableCount} 项将改为来源卡</p>
        <p>来源卡保留项目、发布者、署名和原始链接，不复制受限图片。</p>
      </> : (
        <p>{selectedCount - shareableCount} 项因图片授权受限，分享版中只保留研究文字与来源</p>
      )}
      <button type="button" onClick={() => void onConfirm()}>确认生成分享版</button>
      <button type="button" autoFocus onClick={onClose}>暂不生成，返回结果</button>
    </section>
  )
}
