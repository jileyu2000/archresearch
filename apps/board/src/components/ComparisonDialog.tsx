import {
  assetLabels,
  comparisonFocusLabels,
} from '../lib/labels'
import {
  firstUserFacingBoundary,
  userFacingProjectName,
} from '../lib/text'
import {
  availablePreviewUrl,
  type WorkResult,
} from '../lib/workResult'

interface ComparisonDialogProps {
  results: WorkResult[]
  failedPreviewUrls: Record<string, string>
  onPreviewFailed: (resultId: string, previewUrl: string) => void
  onClose: () => void
}

export function ComparisonDialog({
  results,
  failedPreviewUrls,
  onPreviewFailed,
  onClose,
}: ComparisonDialogProps) {
  const focuses = [...new Set(results.map((result) => comparisonFocusLabels[result.assetType]))]
  const overview = focuses.length === 1
    ? `这 ${results.length} 项都在回答“${focuses[0]}”，重点比较“可借鉴方法”“图中看到”和“适用条件”这几行。`
    : `这 ${results.length} 项分别覆盖“${focuses.join('、')}”。它们更适合组合使用，而不是选一个“赢家”。`
  const recommendedResult = results[0]

  return (
    <section className="floating-panel comparison-panel" role="dialog" aria-modal="true" aria-label="对照案例策略">
      <header className="panel-heading">
        <div><h2>对照案例策略</h2><p>比较这些参考怎样回答你的设计问题</p></div>
        <button type="button" autoFocus onClick={onClose}>关闭案例策略对照</button>
      </header>
      <section className="comparison-guide" aria-labelledby="comparison-guide-title">
        <div>
          <span>阅读提示</span>
          <h3 id="comparison-guide-title">这组对照怎么看</h3>
          <p>{overview}</p>
        </div>
        {recommendedResult && (
          <div>
            <span>建议先带回方案</span>
            <h3>{recommendedResult.title}</h3>
            <p>先用它处理{comparisonFocusLabels[recommendedResult.assetType]}，再用其他参考补上它没覆盖的方面，并对照各自的适用条件。</p>
          </div>
        )}
      </section>
      <p className="comparison-scroll-hint">横向滑动查看各项参考 →</p>
      <div className="comparison-table-wrap">
        <table className="comparison-table" aria-label="案例策略对照表">
          <thead>
            <tr>
              <th scope="col">对照维度</th>
              {results.map((result) => {
                const previewUrl = availablePreviewUrl(result, failedPreviewUrls)
                return (
                  <th scope="col" key={result.id}>
                    <div className="comparison-thumb">
                      {previewUrl
                        ? <img src={previewUrl} alt="" onError={() => onPreviewFailed(result.id, previewUrl)} />
                        : <span>预览不可用</span>}
                    </div>
                    <span className="comparison-column-meta">{assetLabels[result.assetType]}</span>
                    <strong>{result.title}</strong>
                    <small>{userFacingProjectName(result.project)}</small>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            <tr><th scope="row">解决什么</th>{results.map((result) => <td key={result.id}>{comparisonFocusLabels[result.assetType]}</td>)}</tr>
            <tr><th scope="row">可借鉴方法</th>{results.map((result) => <td key={result.id}>{result.inference}</td>)}</tr>
            <tr><th scope="row">图中看到</th>{results.map((result) => <td key={result.id}>{result.observation}</td>)}</tr>
            <tr><th scope="row">适用条件</th>{results.map((result) => <td key={result.id}>{firstUserFacingBoundary([result.limitation]) || '未列出'}</td>)}</tr>
          </tbody>
        </table>
      </div>
    </section>
  )
}
