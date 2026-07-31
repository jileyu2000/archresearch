# ArchResearch 新会话交接

> 2026-07-27 整理：本文件曾累积 M42–M145 的逐里程碑叙事，多处已互相矛盾（收藏替换语义、来源检视器、旧 Run 计数、"当前唯一下一步"多次残留）。历史叙事已整体归档至 `docs/history/`（task-plan 归档含旧版全文），本文件只保留当前为真的状态与规则。

## 新会话启动顺序

1. 先完整阅读本文件。
2. 阅读 `task_plan.md` 中状态为 `in_progress` 或 `proposed` 的阶段。
3. 阅读 `findings.md` 和 `progress.md` 的末尾；追溯更早根因时查 `docs/history/` 归档。
4. 运行 `git status --short --branch`，保留所有既有修改和未跟踪文件，不得 reset、checkout 或批量清理。
5. 开始动作前，用两三句话复述“当前状态、下一步、验证标准”。

## 产品与不可逆决策

- 产品是面向建筑学生与青年设计师的本地优先实时研究 Agent，不建设案例库或全局向量索引。产品行为的权威描述在 `apps/board/PRODUCT.md` 与 `DESIGN.md`；用户文案词汇由 `apps/board/src/copy-glossary.test.ts` 源码级守卫，版式结构由 `apps/board/src/design-system.test.ts` 按单一 860px/620px 媒体块切片守卫。
- M158 起新增 Cloudflare Web Edition；2026-07-31 用户决定停止本地部署与本地版公开发布，Web Edition 现在是唯一用户-facing 产品。网页端由项目方承担模型费用，Key 只在 Cloudflare Secret。M162 起网页端直接复用共享 Board 的同一套页面、样式、导航和结果工作台，差异只限公开来源、Turnstile、云端有界执行与浏览器本地持久化。工作区、Run、结果、收藏、表达规范、任务书和备份都在当前浏览器 IndexedDB；云端只保留短期 Workflow 检查点与费用预留，不建立平台级长期历史。Web URL 只私下交付，禁止写入 GitHub。
- 公开建筑网站由 Web Edition Edge 的有界 HTTPS 读取处理；源码兼容层仍可使用进程内 Direct Playwright。登录态小红书由用户单独安装并连接的 ArchResearch Chrome 扩展承担。**不再使用 Firecrawl**（M41 移除）、**无 Pinterest**（M94 移除）、**无来源反查/TinEye**（M113 移除），三者都不得恢复。
- 本地 Provider 配置、Windows Credential Manager、桌面启动器和安装器均属于已退休的本地发行层，不再进入 GitHub 发布合同。Web Edition 的 Provider 地址与 Key 只存在独立 Cloudflare 部署配置，不向用户暴露，也不得写入浏览器或 GitHub。
- ArchDaily、Designboom、Dezeen、Divisare、ArchDaily China 与项目官网负责落地案例与方案证据，按查询轮换站点；小红书只负责制图/配色/形体/分析图灵感，始终 `aggregator / visual_lead`，不能单独证明项目事实。图纸灵感 XHS-only fail-closed：源码环境可先用 OpenCLI 再回退扩展，Windows 安装版直接使用扩展；可用路径全部失败时诚实终止，绝不降级为通用网页素材。固定 48 个逐图检查槽位 / 48 MiB，每方向按 rank 最多试 4 帖、累计 3 篇 usable。
- 正式方案案例按项目组织：每条事实绑定自己的 URL 与逐字引文；同项目可合并，一次定向补查最多两个可信文字页；`transfer` 是明确标注的设计转译；模型 relevance 只排序。正文分析还必须确认案例在可比较尺度上直接回答当前子问题，纯类比不进入正式案例；Quick 至少需要 3 个正式项目。图片只是可选预览与出处入口，不证明机制、不参与准入。
- 深度是语义合同（拆解规模、逐题覆盖、分析义务），不是许可交浅答案：M124 起 coverage 与 enrichment 同时达标才 `completed`，有用但不足的结果诚实 `partial`。对外三档为“快速找方向 / 形成方案依据 / 做跨案例论证”，内部请求值 `quick/balanced/deep` 不变。
- 保留语义（M149 更新）：新 Run 从创建日起默认保留一学期（180 天）、可逐条永久；取消永久后从操作日起重新获得 180 天，既有记录不静默迁移。**`keep_forever` 同时豁免 Run 行与其全部子数据**（资产/证据 7 天、来源 30 天的独立时钟，M141）。个人收藏是独立快照，Run 过期不删收藏；**保存是纯累加动作**，新批次绝不删除任何既有收藏（M145 废除了 M93 的同题替换）。结果页每个案例有直接收藏动作，多选仍用于批量收藏与对照；删除永远只由用户显式执行。
- 单活研究租约：已有活动 Run 时新建/重试返回 409。打开应用永远落主页，运行中的研究是后台进程，不得劫持首屏（M140）。
- 最近研究列表独自承担打开历史 Run，顶栏不再提供重复的“查看上次结果”；所有结果视图（包括运行中）都可返回主页。直接收藏在原按钮确认，批量收藏明确说明选择已清空；收藏目录以用户原问题为主标题、系统研究方向为副标题（M150）。
- 封存 Run 绝不 retry：`10d31b4c-94dd-4442-b24a-fc1b241e658e` 及所有标注“永久封存”的 Run。任何失败先离线合并诊断，不连续 POST；不得未经批准自动创建 Live Run。
- 产品界面不得展示供应商余额、额度或内部核验术语；建筑结果与收藏每案例只保留一个“出处 · 域名”安静链接（M138），无来源检视器/核验状态/收藏来源动作（检视器只存在于图纸灵感）。
- 修改生产代码前先写失败的行为测试；契约被取代时迁移测试而不是叠加。

## 当前已验证基线

- 公开仓库为 `https://github.com/jileyu2000/archresearch`。`v2.1.0`–`v2.1.4` 的历史扩展/本地版本记录保留为历史；`v2.2.0`/`v2.2.1` 的 Windows 安装器属于已退休资产，必须从公开 Release 删除，仅保留明确命名的 Chrome 扩展 ZIP。当前 Web-only 修改尚未提交，后续仍按显式路径 stage，备份 ZIP 与构建产物不得入库。
- Web-only 权威门禁 `scripts/verify-web.ps1` 最近通过：**190 Board / 186 Extension / 7 packaged E2E / 12 Web / 29 Edge**；coverage 为 Board `79.01/76.42/84.28/83.18`、Extension `83.40/78.55/85.29/85.74`，并通过 release contracts、lint、typecheck、生产构建和 Wrangler dry-run。旧的 `scripts/verify.ps1` 与 FastAPI/SQLite 测试只作为维护者兼容层，不属于 Web 发布门禁；PowerShell 脚本末行成功文案不能单独作为证明。
- 进程脚本必须保持无 WMI/CIM（MSIX pwsh 加载 MMI 失败会杀掉自己拉起的服务）：监听发现用 `netstat -ano`，命令行读 PEB。
- 持久数据基线：**4 workspaces / 15 Runs（13 条 permanent + 2 条仍沿用既有到期日的模拟试点 Run）/ active 0 / 14 条收藏 / 2 条 input artifacts**。2026-07-27 12:04 新增的 3 条收藏属于既有“城市社区共享中心”Run，与 M152 的隔离图纸/《耕织图》问题不同，是并发外部变化，已按工作区保护规则保留。新建 Run 默认 180 天；M152 未创建或改写 durable Run。《城市社区共享中心》8 问全部 completed 零缺口（M137）；`76f52c79`（三档验收 Deep）与 `ff16988d`（任务书 Standard）是现行验收声明的底层证据，不是失败记录。模拟产物去留待用户决定。
- 维护者兼容服务：`scripts/start.ps1` 仍可幂等启动 API 8000 / Board 5173，登录自启配置仅供离线测试，不属于普通用户路径。
- M123 本地发布基线已闭合：API / Board / Extension / manifest 均为 2.1.0；fresh setup/start/update、隔离备份预检与当前发布证据均完成。当前清单为 `docs/release-evidence-2026-07-28.md`，旧清单与 10 张旧 PNG 仅保留为历史材料。最终 tag 落点 `2a92539` 的 Hosted CI run `30334270656` 已在 Windows fresh runner 通过 Chromium 安装、coverage 与完整 348/177/165/8 门禁。
- M155/M156 公开产品架构提交为 `010eceb`：Evidence-Grounded Plan-and-Execute 四模块边界、行为合同、README 信息维度、architecture/demo 文档已推送 `main`。Hosted CI run `30362938145` 在 fresh Windows runner 通过 coverage、360/177/165/8 与完整门禁。
- M157 项目主页提交为 `cdb97f0`：README 已改为长期通用的 ArchResearch 项目主页，竞赛要求只作为信息组织参考，不再出现参赛、投稿或评审专属定位；目标用户、痛点、场景价值、架构、人机协同、完成度、截图、安装和演示入口均保留。Hosted CI run `30368067949` 通过 fresh coverage、360/177/165/8 与完整门禁。
- M162 完整迁移已发布：Web 不再维护简化 UI，而是直接渲染本地 Board；`PublicApiClient` 用 IndexedDB 完成本地 `ApiClient` 合同，Edge 承担 Turnstile、设备/IP 近似配额、CostGuard Durable Object、七阶段 Workflow、Provider Responses API client、公开 HTTPS 页读取和 evidence/coverage/enrichment 双门槛。无 R2 或 Browser Rendering 默认依赖。
- M163 公共小红书桥接已发布：公共页只可发送 `status` 与 `xiaohongshu_search` 两个严格动作，扩展以用户手势为当前 HTTPS 公共 origin 动态注册 content script，并用用户已登录的小红书页面做有界只读搜索；Cookie、账号和密码不上传。主页缺少扩展时立即提醒，检测到桥后不再弹出。
- M164 将公共小红书桥升级为与本地版等深的两阶段流程：Workflow 先规划最多 6 个视觉方向，扩展每方向最多尝试 4 帖、目标 3 篇 usable、每帖最多 4 图，全任务共享 48 图/48 MiB。截图不进入 1 MiB 上限的 Workflow 事件；Worker 临时写私有 R2、事件只传对象键，模型分析后清理，浏览器 IndexedDB v2 按 `candidateId` 保留本地预览并写入终态结果。私有 R2 桶、三日生命周期与生产 Worker 版本 `c7144317-8daa-4e8f-ae57-5ccf79fc8a41` 已部署；HTTP、安全头和正式 Turnstile 配置通过。
- 最新完整验证：M165 的 `scripts/verify.ps1` exit 0，通过 360 API / 190 Board / 189 Extension / 12 Web / 28 Edge / 8 packaged E2E；coverage 为 Board 79.01/76.42/84.28/83.18、Extension 83.43/78.54/85.40/85.73。系统 Chrome 本地生产界面已展开四步安装说明，2048×983 横向溢出 0、三个操作控件均为 44px；PR #2 的两套 fresh Windows Hosted CI（`30487265492`、`30487306820`）均成功。`v2.1.4` 正式 Release 已发布 22,312-byte extension-only ZIP，生产 Worker 已部署为 `06b96723-281c-4375-b816-32f21b8f2e40`，线上 HTTP、安全头、正式 Turnstile、bundle 与附件 smoke 全绿。线上系统 Chrome DOM 控制连续超时后按禁用内部浏览器规则停止，测试标签已清理。
- M166 已正式发布：版本面统一 `2.2.0`；本地 `scripts/verify.ps1` 通过 365 API / 190 Board / 189 Extension / 12 Web / 28 Edge / 8 packaged E2E，coverage 与 M165 基线一致。PR #3 push/PR CI `30516069001` / `30516103148` 与 main CI `30517007300` 全绿。Release 的 69,723,372-byte Windows 安装器 SHA-256 为 `5E34FB6A3C7A7B63449AEF87639F14ECA8295E8E34D21AAC2FB531ACE3422782`；22,331-byte extension-only ZIP SHA-256 为 `58522E4076BC0AF8522E5C4DFAC74526110927248C784275B66B421FE331032B`。安装器未签名，Release 已明确 SmartScreen/未知发布者边界。
- M170/M171/M172 已正式收口：提交 `1695973` 的 Hosted Run `30572135856` 成功；`v2.2.1` Windows 安装器为 69,689,547 bytes、SHA-256 `FEC335DB8BE9F7E2943BE40F264EBDBD64AE673F1F37CA34051747EDC4661A68`，独立扩展 ZIP 为 22,317 bytes、SHA-256 `9327F89BD3B4CEB149F4FA28F2A986B39A88E18DB91FCDD833B8EF1CEA4D60AD`。安装器覆盖升级、`--self-test`、`/desktop-health`、`/health` 和扩展排除 smoke 均通过；Worker 版本 `7784b800-0135-461f-a506-d2be1b34f2e0` 已部署，主页/API/bundle/安全头 smoke 全绿。重复 Hosted Run `30572207240` 因无进展已取消。
- 本工作区由多个 agent 会话并发写入（长期约束）：提交前后必须重读 `git status`，另一会话仍在写同名文件时暂停提交。

## 当前唯一主线

1. **M121 / M148 / M149 / M150 / M151 / M152 / M153 已 complete**。M153 已按红绿合同收口 3 项 P1 + 4 项重复 P2：视觉收藏投影原问题/方向；fresh DB 并发初始化唯一且普通同名工作区仍合法；Mock 完成态有 evidence-bound 结果；图纸计数、XHS/Chrome 职责、唯一图片 accessible name、任务书文件名均完成。desktop/390px loaded QA 无溢出、error 0；完整门禁全绿，durable 基线未变。
2. **M122 8/8 已 complete**：Board/Extension coverage-v8 基线与硬阈值、8 个纯模块、11 个视图组件、`useBrowserReadiness()`、Run payload reducer、`useRunHydration()` 与 `useRunPolling()` 均按红绿合同抽出。请求世代、后台轮询、打开历史 Run、取消/重试、终态水合与页面导航顺序保持；`App.tsx` 4,089→1,752 行，文案、DOM class 与 CSS 不变。
3. **M123 已 complete**：CI 合同、版本面、fresh setup/start/update、备份预检、历史证据归档、当前发布清单、coverage 与最终完整门禁均已收口，durable 基线未变。
4. **M154 已 complete**：发布前目录清理、公开仓库、README/About/topics、显式范围提交与 Hosted CI 均已完成；CI 的 CRLF、Corepack shim 和 Playwright Chromium 三个环境差异均以合同修复，产品代码与门槛未降低。annotated tag `v2.1.0` 与正式 GitHub Release 已发布，Release 无本地附件。
5. **M155 已 complete**：`agent/planning.py`、`execution.py`、`verification.py`、`synthesis.py` 与唯一 `workflow.py` orchestrator 形成明确 Evidence-Grounded Plan-and-Execute 边界；27 个迁出函数、2 个类型类、2 个常量和 53 个保留定义经 AST 对比均为零函数体差异，运行语义不变。
6. **M156 已 complete**：GitHub README 已按完整项目说明维度覆盖场景价值、Agent 架构、人机协同/纠偏、完成度、边界、访问步骤、3 个测试问题和真实截图；本地与 Hosted CI 全绿，durable 基线未变。
7. **M157 已 complete**：README 已从竞赛投稿语境修正为长期通用项目主页，只保留“建筑竞赛”作为真实用户使用场景；项目主页提交 `cdb97f0` 的本地完整门禁与 Hosted CI `30368067949` 全绿。
8. **M158/M159/M160 当前状态**：Cloudflare 官方审计、双版本范围合同、Edge 有界执行、浏览器本地长期数据、离线测试和既有生产部署均已完成。CostGuard SQLite 保留预留/实际用量记录和停机开关，不按金额拒绝；公开页读取默认采用 Worker `fetch` + `HTMLRewriter`，不使用 R2 或 Browser Rendering。
9. **M162 已 complete**：公共入口直接复用本地 Board，个人收藏、完整结果工具、任务书、历史、表达规范和备份均已接通。提交 `896945a`、Hosted CI `30433096343`、生产 Worker 版本 `051c4e0c-4e9f-45c8-be0c-99194b16cf7b` 和 `v2.1.1` Release 均已闭合；生产桌面/390px、完整案例对照和静态素材 smoke 通过。网页 URL 继续禁止写入 GitHub。M161 唯一剩余是由真人完成正式 Turnstile 后跑一次 Quick 真实研究，自动化不得绕过。
10. **M163 已 complete**：公共 Web 与 GitHub 本地版共用主页安装提醒、扩展连接状态和小红书视觉读取协议；严格消息/来源校验、动态 exact-origin 注册、有界搜索、Web/Edge 接入、coverage、全量门禁、打包 E2E、1440/390px QA 与 `2.1.2` ZIP 全部完成。提交 `c74571f` 的 Hosted CI `30438474678` success，生产 Worker 版本 `dc0eb528-a8c3-4ca2-88fa-c6131f866d3c` smoke 全绿，annotated tag 与正式 `v2.1.2` Release 已发布。站外 ZIP 仍需开发者模式加载；真正一键安装是后续 Chrome Web Store 外部审核事项。
11. **M164 已 complete**：网页与本地版的用户可见功能继续共用同一 Board；公共小红书已实现规划后逐方向、逐帖、逐图深读，Cloudflare 事件载荷改为 R2 对象键，IndexedDB 保留最终可显示预览。`37be809` 的两套 Hosted CI、annotated `v2.1.3` tag、扩展专属正式 Release、R2 桶、三日生命周期和生产 Worker 版本 `c7144317-8daa-4e8f-ae57-5ccf79fc8a41` 均已上线。系统 Chrome 1440×1000 / 390×844 线上安装提醒、主页、个人收藏、备份恢复与 console smoke 全绿；未调用内部浏览器。
12. **M165 已 complete**：主页不再用“立即安装”误导站外 ZIP 为一键安装，同弹窗先展示完整四步方法再下载；公共桥在当前页注入后发送严格 v2 ready，Board 自动关闭提醒，同 origin 重复连接保持幂等。PR #2、两套 Hosted CI、annotated `v2.1.4`、扩展专属 Release 和生产 Worker `06b96723-281c-4375-b816-32f21b8f2e40` 均已上线。唯一跨阶段未完成项仍是 M161 的真人 Turnstile Quick 研究验收。
13. **M166 complete**：GitHub Windows x64 一键安装程序与独立扩展 ZIP 已通过本地/Hosted CI、真实安装/升级/卸载并正式发布 `v2.2.0`。安装包自带本地运行时、API 与生产 Board；扩展不放进安装包，本地页面复用网页版的缺失提醒和独立安装说明。生产 Worker 已部署为 `0d94ed1e-7807-49fd-b2fc-73c2f00bc1c9`，主页 200、CSP/noindex/frame deny、正式 Turnstile、v2.2.0 bundle 链接和 22,331-byte GitHub 附件均通过。当前代码交付外唯一保留项仍是 M161 的真人 Turnstile Quick 研究验收，自动化不得绕过。
14. **M168/M169 local implementation complete**：当前本地提交 `7486c75` 已完成安装版动态回环端口恢复、首次配置按钮可读性与图标重做；本地 Provider 已从固定梭子蟹 Key-only 改为用户填写接口地址 + Key，并在保存前进行能力探测。此前完整门禁 exit 0：379 API / 191 Board / 189 Extension / 12 Web / 28 Edge / 8 packaged E2E；提交尚未推送、未创建 PR、未合并/tag/Release 或部署 Worker。
15. **M170/M171 in progress**：用户实机通过连接测试后，PyInstaller windowed 启动器因 Uvicorn 默认控制台 formatter 读取空 `stderr` 崩溃；修复已用红绿测试加入 `log_config=None`。兼容层现从上游 `/models` 自动取得候选，不要求用户填写模型名；最多探测 6 个非 embedding/音频候选，先 Responses 后 Chat Completions，成功模型与协议写本地 JSON，Key 仍只在凭据管理器。完整门禁 exit 0：388 API / 191 Board / 189 Extension / 12 Web / 28 Edge / 8 packaged E2E。重建安装器 SHA-256 `3C55C55AF66052EA7A05F041BD9506392317836010785BDB78D234FC7E1385FB`，扩展 ZIP SHA-256 `9327F89BD3B4CEB149F4FA28F2A986B39A88E18DB91FCDD833B8EF1CEA4D60AD`；新 onedir 自检通过且不含扩展。当前改动未提交；本机已有安装，需用户明确授权升级后才能完成 package/真实启动 smoke。

## 工作区保护

- 工作树是用户资产。`.artifacts/` 中忽略的数据备份 ZIP、已版本化的当前/历史 PNG，以及版本化的当前/历史 release evidence 都是有意保留的，不要重置、覆盖或顺手清理。禁止 `git add -A`、reset、checkout、clean。
- 重要决策写 `findings.md`；阶段和验收写 `task_plan.md`；进展、错误和恢复点写 `progress.md`。不要写逐命令流水账；本文件只在架构、已验证基线或唯一下一步实质变化时更新。

## 给新对话的第一句话

> 继续 ArchResearch。先完整读取 HANDOFF.md，再读取 AGENTS.md；随后按 HANDOFF 顺序恢复 `task_plan.md`、`findings.md`、`progress.md`，并运行 `git status --short --branch`。不要重做已完成工作，不要恢复 Firecrawl，也不要调用会导致桌面应用闪退的内部浏览器。当前产品已切换为 Web-only：GitHub 只保留源码和独立 Chrome 扩展 ZIP，Windows 安装器是退休资产；生产 Web URL 不得进入仓库或 Release。保留所有修改和未跟踪文件，不得 reset、checkout、clean 或 `git add -A`。

## 2026-07-31 Web-only retirement and alignment

- 用户最终决定停止本地部署与本地版公开发布；GitHub 只保留 Web Edition 源码和独立 Chrome 扩展下载页。对外产品不再要求用户安装 Python/Node/pnpm/PowerShell、填写端点或 Key；Provider 由项目方的 Cloudflare Secret 配置。
- 已删除 Windows 安装器、PyInstaller/Inno、桌面启动与安装器测试文件，CI 改为只验证 Web/Edge/Board/Extension 并上传独立扩展 ZIP。`README.md`、`apps/board/PRODUCT.md`、`apps/web/PRODUCT.md`、根 `PRODUCT.md`、`docs/architecture.md`、`docs/demo-flows.md` 与开发/扩展说明已改为 Web-only 语义；公开 Web URL 仍不得写入仓库、Release 或 metadata。
- 扩展 popup/sidepanel 已删除本地服务地址、一次性配对码、手动配对和断开本地连接 UI；连接文案统一为“当前网页连接”，聚焦 UI 合同 24/24 通过。Chrome 扩展的 `ChromeBrowserPort`、`BrowserCommandExecutor`、公共动态 origin bridge 和小红书只读协议继续保留，这是 Web 小红书研究的核心，不可回退。
- API 本地兼容层（FastAPI/SQLite、loopback pairing、Provider setup）暂保留给维护者离线测试，未纳入 Web gate 或公开用户路径；不要把它重新写回 README、Release 或 Web bundle。后续若继续清理，必须先迁移对应 E2E/覆盖率合同，再删除代码，不能机械 reset 共享 Board。
- 本轮 Web-only 迁移已通过 `scripts/tests/release.tests.ps1`、Extension lint/typecheck/E2E 和 `scripts/verify-web.ps1`；旧 FastAPI 浏览器 E2E 已迁出公开扩展门禁，兼容协议单测仍保留。下一步只需重读 `git status`，显式 stage 预期源码/文档/测试，提交并推送本轮 Web-only 修改；`.artifacts/` 不得入库。
