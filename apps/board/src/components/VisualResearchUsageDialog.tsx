import { ExternalLink } from 'lucide-react'

interface VisualResearchUsageDialogProps {
  onClose: () => void
}

const extensionDownloadUrl = 'https://github.com/jileyu2000/archresearch/releases/latest'

export function VisualResearchUsageDialog({ onClose }: VisualResearchUsageDialogProps) {
  return (
    <div className="visual-usage-backdrop">
      <section
        className="visual-usage-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="图纸灵感使用方法"
        aria-describedby="visual-usage-intro visual-usage-boundary"
      >
        <header>
          <p>图纸灵感使用方法</p>
          <h2>图纸灵感怎么用</h2>
        </header>
        <p className="visual-usage-intro" id="visual-usage-intro">
          图纸灵感通过 Chrome 扩展读取你已登录的小红书页面。第一次使用按下面步骤准备即可。
        </p>
        <ol className="visual-usage-steps">
          <li>
            <span aria-hidden="true">1</span>
            <div>
              <h3>安装 Chrome 扩展</h3>
              <p>下载名称含 chrome-extension-only 的 ZIP，解压后在 Chrome 扩展管理页加载包含 manifest.json 的文件夹。</p>
              <a href={extensionDownloadUrl} target="_blank" rel="noreferrer">
                下载 Chrome 扩展<ExternalLink aria-hidden="true" />
              </a>
            </div>
          </li>
          <li>
            <span aria-hidden="true">2</span>
            <div>
              <h3>连接 ArchResearch</h3>
              <p>回到图纸灵感，在研究环境中点击“连接 Chrome 读取高清图纸”，并按浏览器提示允许网页读取。</p>
            </div>
          </li>
          <li>
            <span aria-hidden="true">3</span>
            <div>
              <h3>登录小红书</h3>
              <p>在新打开的 Chrome 页面完成登录；如果遇到安全验证，请先完成验证再返回。</p>
            </div>
          </li>
          <li>
            <span aria-hidden="true">4</span>
            <div>
              <h3>回到 ArchResearch 开始查找</h3>
              <p>点击“重新检测”，看到研究环境已就绪后，就可以输入图纸类型和风格方向。</p>
            </div>
          </li>
        </ol>
        <p className="visual-usage-boundary" id="visual-usage-boundary">
          Cookie、账号、密码和浏览器存储不会进入 ArchResearch API、日志或导出。
        </p>
        <footer>
          <button className="visual-usage-primary" type="button" autoFocus onClick={onClose}>
            我知道了
          </button>
        </footer>
      </section>
    </div>
  )
}
