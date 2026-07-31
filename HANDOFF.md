# ArchResearch 新会话交接

> 本文件只保留当前为真的状态、保护规则和单一下一步。旧里程碑叙事在 `docs/history/`、`findings.md` 与 `progress.md`。

## 新会话启动顺序

1. 完整阅读本文件。
2. 阅读 `AGENTS.md`。
3. 阅读 `task_plan.md` 中状态为 `in_progress` 或 `proposed` 的阶段。
4. 阅读 `findings.md` 和 `progress.md` 末尾；需要旧根因时再查历史归档。
5. 运行 `git status --short --branch`，保留全部既有修改和未跟踪文件。
6. 开始动作前复述当前状态、下一步和验证标准。

## 当前产品决策

- Cloudflare Web Edition 已由用户在 M179 正式终止。当前唯一产品是 Windows/Chrome 本地优先 ArchResearch：FastAPI、Python workflow、SQLite、本地文件、用户自己的 OpenAI-compatible API 地址和 Key，以及单独安装的 Chrome 扩展。
- `apps/web`、`apps/edge`、Wrangler/Worker 配置、Web-only 验证脚本、公共 HTTPS 扩展桥和公共 XHS adapter 已删除，不得恢复。
- 普通用户通过 Windows 安装器获得自包含本地服务与生产 Board，不需要 Python、Node.js、pnpm 或 PowerShell。安装器不捆绑扩展；扩展作为独立 ZIP 发布。
- 首次配置明确要求 API 接口地址、模型名称和 API Key；模型名称从上游 `/models` 获取，桌面只读下拉框和脚本序号选择都不允许手输模型 ID。只探测用户选中的模型，先 Responses 再 Chat Completions；成功后保存地址、模型和协议。`gpt-5.6-sol` 仅用于旧配置缺字段兼容，不是新配置默认。Key 只进入 Windows Credential Manager，不进入仓库、日志、默认测试或备份。
- 桌面启动器优先使用回环端口 8000；冲突时自动选择空闲端口。生产 Board、API、健康检查、Chrome URL 和扩展 endpoint 必须使用同一端口。
- 公开建筑网站由本地 FastAPI workflow 与 Direct Playwright 处理。登录态小红书由单独安装并配对的 Chrome 扩展处理；源码环境可先使用 OpenCLI 再回退扩展。
- 不恢复 Firecrawl、Pinterest、TinEye/来源反查、通用视觉网页降级、平台案例库、全局向量索引或多 Agent runtime。
- 图纸灵感 XHS-only fail-closed：每方向按 rank 最多 4 帖，累计 3 篇 usable；每帖最多 4 图；全任务 48 个图像槽位 / 48 MiB。全部路径失败时诚实终止。
- 正式建筑事实必须绑定自己的 URL 与逐字引文。图片只作可选预览和出处入口，不证明机制。coverage 与 enrichment 同时达标才 `completed`。
- 新 Run 默认保留 180 天，可逐条永久；`keep_forever` 同时豁免 Run 和子数据。收藏是独立累加快照，删除只能由用户显式执行。
- 单活研究租约：已有活动 Run 时新建或重试返回 409。打开应用永远落主页，后台研究不劫持首屏。

## 仓库与保护规则

- 仓库：`https://github.com/jileyu2000/archresearch`
- 当前分支与远端基线：`main` / `origin/main` = `87826af`
- 本轮恢复基线：`1695973`，它是最后一个经过 Hosted CI、完整本地门禁、真实安装升级、`--self-test`、`/desktop-health` 和 `/health` 验证的本地发行提交。
- 恢复通过 `git show 1695973:<path>` 和定点补丁完成，不得使用 reset、checkout 或 clean。
- 当前工作树包含有意的本地恢复、Web/Edge 删除、文档和计划修改；`.artifacts/build/`、`.artifacts/qa/`、`.artifacts/releases/` 保留。
- 不执行 `git add -A`、提交、推送、tag、Release 修改或 Worker 部署，除非用户另行明确授权。
- 不调用会导致桌面应用闪退的内部浏览器。默认验证不得读取用户 Cookie、账号会话、Provider Key 或创建真实研究。
- 旧生产 Web URL 不得进入仓库、Release 或 repository metadata。

## M179 完成状态

已从 `1695973` 非破坏性恢复并完成定向验证：

- `apps/api/src/archresearch_api/desktop.py`
- 动态回环端口和严格 Chrome URL allow-list
- Windows Credential Manager 首次 Provider 配置
- PyInstaller launcher、Inno 安装器、图标生成器
- 安装器构建与真实安装 smoke 脚本
- 本地扩展状态、权限、手动配对和断开
- Board 从当前 loopback origin 派生 WebSocket endpoint
- 真实 FastAPI + packaged Chrome Extension E2E

最终已通过：

- Desktop tests：8/8
- API browser tests：29/29
- Board bridge tests：7/7
- Extension local UI/background：14/14
- Board App/result/bridge focused tests：109/109
- 权威 `scripts/verify.ps1`：389 API / 178 Board / 165 Extension / 8 packaged E2E
- Ruff/format、strict Mypy、Board/Extension lint/typecheck/test/build、进程、安全、评测与 Windows 发布合同
- Packaged Extension E2E：8/8，包含真实 FastAPI、一次性配对、浏览器裁图和本地 PNG 资产读取
- Windows 安装器真实安装 smoke：快捷方式、精简 `PATH` 下 `--self-test`、不捆绑扩展、静默卸载清理
- 冻结入口所用 FastAPI desktop app 的 `/desktop-health` 与 `/health` 行为测试
- `git diff --check` 与 Web/Edge/Cloudflare 非历史残留扫描

已删除并完成共享层收口：

- `apps/web`
- `apps/edge`
- `scripts/verify-web.ps1`
- Extension public HTTPS bridge/controller/public XHS adapter 及其测试/build entry
- Board public-edition-only 协议、测试、视觉来源分支和 Turnstile 样式
- pnpm workspace/lockfile 中的 Web、Edge、Wrangler、workerd 与 Cloudflare package 条目

根 `package.json`、`pnpm-workspace.yaml`、`scripts/verify.ps1`、release contracts 与 `.github/workflows/verify.yml` 已恢复为本地 Windows 发布方向。README、PRODUCT、DESIGN、architecture、extension、demo、development、failure 与 AGENTS 已同步本地单入口。

本地发布候选：

- `.artifacts/releases/archresearch-chrome-extension-only-v2.2.2.zip`
  - 18,260 bytes
  - SHA-256 `9D554576B6DDAAD705EC4E66B1D948EB2305A749CAEFAE40144EC04D8FAD0902`
- `.artifacts/releases/ArchResearch-Windows-x64-Setup-v2.2.2.exe`
  - 69,681,830 bytes
  - SHA-256 `F859C66720D0A493950653F2178E34C7955CBF7D838CD4569C36D994A30162A1`

## Provider 配置合同修正已完成

- 新安装明确要求 API 接口地址、模型名称和 API Key；模型名称只从上游 `/models` 只读列表取得，桌面不允许手输模型 ID，脚本只输入序号。
- `gpt-5.6-sol` 只保留为旧配置缺字段的兼容默认；新配置不会自动选择列表第一项。
- 完整门禁：API 395 / Board 178 / Extension 165 / packaged E2E 8；Ruff、strict Mypy、前端 lint/typecheck/build、配置/安装器/Release contracts 全部通过。
- 隔离构建的 Windows 安装器已完成真实安装 smoke，产物位于 `.artifacts/releases/provider-contract-v2.2.1/`，SHA-256 `AD575B9206F8A3B4B8C1774FCD5732862B86D113F677310E37FFA7C27C965489`；旧 `.artifacts/` 内容未清理或覆盖。
- 外部兼容 smoke 只使用临时内存：最新验证中根地址和带 `/v1` 的 `/models` 都返回 23 个模型；但将根地址原样交给应用同款 OpenAI 客户端时，`/responses` 探测失败，带 `/v1` 的 base URL 返回 23 个模型，兼容模型的 Responses structured output 通过；没有保存 Key、配置或研究数据。

## Provider endpoint compatibility correction

- 用户可填写服务根地址或完整 API 路径；首配只在同一主机尝试原地址、`/v1` 和根地址的 `/api/v1`，先读取模型列表，再只探测用户选中的模型。
- 根地址模型列表可读但结构化请求失败时，程序会继续尝试后续候选，并把探测成功的 Base URL 保存到 `provider.json`；DeepSeek 根地址可直接通过时则保留根地址，不强行追加 `/v1`。
- 完整 `scripts/verify.ps1`：401 API / 178 Board / 165 Extension / 8 packaged E2E，Ruff/strict Mypy、前端 lint/typecheck/build、Windows 安装器合同和真实安装 smoke 全部通过。
- 当前版本面统一为 `2.2.2`；GitHub Release 标题和 README 主标题应使用本地 Windows/Chrome 产品文案，不得退回“仅 Chrome 扩展”。

## v2.2.2 GitHub 发布状态

- 分支 `agent/local-release-v2.2.2` 已推送；提交 `5637ee0` 已创建 `v2.2.2` tag。
- 草稿 PR [#11](https://github.com/jileyu2000/archresearch/pull/11) 已打开，目标为 `main`。
- 正式 Release [ArchResearch 本地版 v2.2.2](https://github.com/jileyu2000/archresearch/releases/tag/v2.2.2) 已发布，非草稿、非预发布。
- Release 附件为 Windows 安装器和独立 Chrome 扩展 ZIP；GitHub 侧名称、大小和本地 SHA-256 记录一致，文案未包含生产 Web URL 或 Provider Key。

## 当前唯一下一步

用户下一步从 `v2.2.2` Release 下载 Windows 安装器；需要图纸灵感时，再单独下载并加载 Chrome 扩展。当前不自动调用浏览器、不恢复 Web/Edge、不写入 Key 或生产 Web URL。
