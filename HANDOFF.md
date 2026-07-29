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
- M158 起新增独立 Cloudflare Web Edition：本地版继续 Windows/Chrome、BYOK、SQLite 与本机文件；网页端由项目方承担模型费用，Key 只在 Cloudflare Secret。M162 起网页端直接复用本地 Board 的同一套页面、样式、导航和结果工作台，Edition 差异只限公开来源、Turnstile、云端有界执行与浏览器本地持久化。工作区、Run、结果、收藏、Board、表达规范、任务书和备份都在当前浏览器 IndexedDB；云端只保留三日短期 Workflow 检查点与费用预留，不建立平台级长期历史。Web URL 只私下交给评委，禁止写入 GitHub。
- 公开建筑网站使用进程内 Direct Playwright；登录态小红书默认使用 `@jackwener/opencli@1.8.6` Browser Bridge。**不再使用 Firecrawl**（M41 移除）、**无 Pinterest**（M94 移除）、**无来源反查/TinEye**（M113 移除），三者都不得恢复。
- 所有模型统一为 `gpt-5.6-sol`，推理强度 `medium`，base `https://suoxie.codes/v1`。API Key 只在 Windows 凭据管理器（`ArchResearch/suoxie` / `api-key`），不得打印或迁移。
- ArchDaily、Designboom、Dezeen、Divisare、ArchDaily China 与项目官网负责落地案例与方案证据，按查询轮换站点；小红书只负责制图/配色/形体/分析图灵感，始终 `aggregator / visual_lead`，不能单独证明项目事实。图纸灵感 XHS-only fail-closed：OpenCLI 失败才回退扩展，两条路径都不可用时诚实终止，绝不降级为通用网页素材；固定 48 个逐图检查槽位 / 48 MiB，每方向按 rank 最多试 4 帖、累计 3 篇 usable。
- 正式方案案例按项目组织：每条事实绑定自己的 URL 与逐字引文；同项目可合并，一次定向补查最多两个可信文字页；`transfer` 是明确标注的设计转译；模型 relevance 只排序。正文分析还必须确认案例在可比较尺度上直接回答当前子问题，纯类比不进入正式案例；Quick 至少需要 3 个正式项目。图片只是可选预览与出处入口，不证明机制、不参与准入。
- 深度是语义合同（拆解规模、逐题覆盖、分析义务），不是许可交浅答案：M124 起 coverage 与 enrichment 同时达标才 `completed`，有用但不足的结果诚实 `partial`。对外三档为“快速找方向 / 形成方案依据 / 做跨案例论证”，内部请求值 `quick/balanced/deep` 不变。
- 保留语义（M149 更新）：新 Run 从创建日起默认保留一学期（180 天）、可逐条永久；取消永久后从操作日起重新获得 180 天，既有记录不静默迁移。**`keep_forever` 同时豁免 Run 行与其全部子数据**（资产/证据 7 天、来源 30 天的独立时钟，M141）。个人收藏是独立快照，Run 过期不删收藏；**保存是纯累加动作**，新批次绝不删除任何既有收藏（M145 废除了 M93 的同题替换）。结果页每个案例有直接收藏动作，多选仍用于批量收藏与对照；删除永远只由用户显式执行。
- 单活研究租约：已有活动 Run 时新建/重试返回 409。打开应用永远落主页，运行中的研究是后台进程，不得劫持首屏（M140）。
- 最近研究列表独自承担打开历史 Run，顶栏不再提供重复的“查看上次结果”；所有结果视图（包括运行中）都可返回主页。直接收藏在原按钮确认，批量收藏明确说明选择已清空；收藏目录以用户原问题为主标题、系统研究方向为副标题（M150）。
- 封存 Run 绝不 retry：`10d31b4c-94dd-4442-b24a-fc1b241e658e` 及所有标注“永久封存”的 Run。任何失败先离线合并诊断，不连续 POST；不得未经批准自动创建 Live Run。
- 产品界面不得展示供应商余额、额度或内部核验术语；建筑结果与收藏每案例只保留一个“出处 · 域名”安静链接（M138），无来源检视器/核验状态/收藏来源动作（检视器只存在于图纸灵感）。
- 修改生产代码前先写失败的行为测试；契约被取代时迁移测试而不是叠加。

## 当前已验证基线

- 分支 `codex/archresearch-v2-1` 跟踪 `origin/main`，公开仓库为 `https://github.com/jileyu2000/archresearch`。`v2.1.0` 指向已验证提交 `2a92539`；后续仍按显式路径 stage，备份 ZIP 不得入库。
- 权威门禁 `scripts/verify.ps1`：**360 API / 177 Board / 165 Extension / 8 packaged E2E**，加 Ruff/format、strict Mypy、两端 lint/typecheck/build、进程/安全/评测检查。PowerShell 5 会吞中间失败，脚本末行成功文案不能单独作为证明。另有根级 `pnpm test:coverage`：Board 78.17/72.39/80.50/81.78 与 Extension 82.69/76.52/83.96/84.73 为最低阈值；M122 完成后 Board 实测为 80.01/75.75/84.77/83.80。
- 进程脚本必须保持无 WMI/CIM（MSIX pwsh 加载 MMI 失败会杀掉自己拉起的服务）：监听发现用 `netstat -ano`，命令行读 PEB。
- 持久数据基线：**4 workspaces / 15 Runs（13 条 permanent + 2 条仍沿用既有到期日的模拟试点 Run）/ active 0 / 14 条收藏 / 2 条 input artifacts**。2026-07-27 12:04 新增的 3 条收藏属于既有“城市社区共享中心”Run，与 M152 的隔离图纸/《耕织图》问题不同，是并发外部变化，已按工作区保护规则保留。新建 Run 默认 180 天；M152 未创建或改写 durable Run。《城市社区共享中心》8 问全部 completed 零缺口（M137）；`76f52c79`（三档验收 Deep）与 `ff16988d`（任务书 Standard）是现行验收声明的底层证据，不是失败记录。模拟产物去留待用户决定。
- 服务：`scripts/start.ps1` 幂等启动 API 8000 / Board 5173，登录自启已配置（M127）。
- M123 本地发布基线已闭合：API / Board / Extension / manifest 均为 2.1.0；fresh setup/start/update、隔离备份预检与当前发布证据均完成。当前清单为 `docs/release-evidence-2026-07-28.md`，旧清单与 10 张旧 PNG 仅保留为历史材料。最终 tag 落点 `2a92539` 的 Hosted CI run `30334270656` 已在 Windows fresh runner 通过 Chromium 安装、coverage 与完整 348/177/165/8 门禁。
- M155/M156 公开产品架构提交为 `010eceb`：Evidence-Grounded Plan-and-Execute 四模块边界、行为合同、README 信息维度、architecture/demo 文档已推送 `main`。Hosted CI run `30362938145` 在 fresh Windows runner 通过 coverage、360/177/165/8 与完整门禁。
- M157 项目主页提交为 `cdb97f0`：README 已改为长期通用的 ArchResearch 项目主页，竞赛要求只作为信息组织参考，不再出现参赛、投稿或评审专属定位；目标用户、痛点、场景价值、架构、人机协同、完成度、截图、安装和演示入口均保留。Hosted CI run `30368067949` 通过 fresh coverage、360/177/165/8 与完整门禁。
- M162 当前未提交的完整迁移位于 `apps/board`、`apps/web` 与 `apps/edge`。Web 不再维护简化 UI，而是直接渲染本地 Board；`PublicApiClient` 用 IndexedDB 完成本地 `ApiClient` 合同，Edge 承担 Turnstile、设备/IP 近似配额、CostGuard Durable Object、七阶段 Workflow、Provider Responses API client、公开 HTTPS 页读取和 evidence/coverage/enrichment 双门槛。无 R2 或 Browser Rendering 默认依赖。
- 最新完整验证：根级 `scripts/verify.ps1` exit 0（197.7 秒），通过 360 API / 179 Board / 165 Extension / 9 Web / 16 Edge / 8 packaged E2E，以及 Ruff/format、strict Mypy、lint/typecheck/build、安全检查与 Wrangler dry-run。Wrangler mock 的 1440×1000 和 390×844 Chrome headless QA 覆盖首页、完整结果、收藏和备份，横向溢出 0、console/page error 0；20 个生产静态素材均进入构建。
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
9. **M162 当前状态**：完整本地产品迁移已在未提交工作树实现并通过仓库总门禁与 Worker 形态桌面/移动 QA；公共入口直接复用本地 Board，个人收藏、完整结果工具、任务书、历史、表达规范和备份均已接通。下一步是显式提交、推送、生产重部署和线上 smoke，之后创建修订版 tag/Release。当前生产仍是旧简化界面的版本 `c17dc24c-28ce-44c3-9c0f-b52a9f4fd95e`；网页 URL 继续禁止写入 GitHub。

## 工作区保护

- 工作树是用户资产。`.artifacts/` 中忽略的数据备份 ZIP、已版本化的当前/历史 PNG，以及版本化的当前/历史 release evidence 都是有意保留的，不要重置、覆盖或顺手清理。禁止 `git add -A`、reset、checkout、clean。
- 重要决策写 `findings.md`；阶段和验收写 `task_plan.md`；进展、错误和恢复点写 `progress.md`。不要写逐命令流水账；本文件只在架构、已验证基线或唯一下一步实质变化时更新。

## 给新对话的第一句话

> 继续 ArchResearch。先完整读取 HANDOFF.md，再读取 AGENTS.md；随后按 HANDOFF 顺序恢复 task_plan.md、findings.md、progress.md，并运行 `git status --short --branch`。不要重做已完成工作，不要恢复 Firecrawl。当前本地一键安装版与 Cloudflare Web Edition 源码、离线门禁和浏览器 QA 已完成；Web/Edge 离线测试分别为 7/16 通过。Cloudflare 账户已登录但尚无目标 Worker，唯一阻塞是取得独立 Provider Secret、Turnstile credentials 和最终 hostname；不要读取或迁移本地 Windows 凭据，不要用 mock 模式冒充公网实时版。保留所有修改和未跟踪文件；未经明确授权不得 stage、commit、push、reset、checkout 或 clean。
