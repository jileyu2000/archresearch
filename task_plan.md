# ArchResearch V2.1 Implementation Plan

> 2026-07-27 整理：M0–M120 的逐阶段验收行、逐里程碑小结与完整 Errors Encountered 表已整体归档至 [docs/history/task-plan-archive-2026-07-27.md](docs/history/task-plan-archive-2026-07-27.md)。本文件只保留现行目标、当前阶段与仍然有效的计划/决策。

## Goal

Build the approved local-first architecture research agent: a Chrome MV3 extension, a local FastAPI research executor, and a visual research board. The runtime must use live web research without a platform case library or global vector index.

## Success Criteria

- A user can create a workspace, add text/PDF/URL inputs, and start a persisted research run; a project-brief PDF constrains the same run through the internal brief review.
- The run follows a deterministic state machine, streams progress, and preserves partial results; architectural runs reach `completed` only when coverage and enrichment targets both pass.
- The OpenAI-compatible provider and the OpenCLI Xiaohongshu adapter have real clients plus deterministic mock implementations.
- The Chrome extension pairs locally, requests/revokes optional host permissions, and executes only the approved browser action DSL.
- Results read as answer-first case answers with quiet provenance links; personal collections are durable additive snapshots; comparison, rights-gated exports and the visual expression spec work from the result page.
- API, board, and extension tests pass; lint/type checks/builds pass; README documents a local demo.

## Phases

历史阶段（全部已收口，详情见归档）：

| 阶段区间 | 主题 | 状态 |
|---|---|---|
| M0–M45 | 基础设施、状态机、扩展管线、参考板、首轮发布门禁与真实验收 | complete |
| M46–M65 | text-first 项目级逐字证据深度；三档验收（保留 Deep `76f52c79`） | complete |
| M66–M96 | 结果阅读结构、项目上下文、图纸灵感（XHS-only、48 槽位）、收藏体系 | complete |
| M97–M120 | 收藏细化、任务书流程（M107）、来源反查/TinEye 移除（M113）、历史命名、备份/清理/开机自启 | complete |
| M124–M145 | 严格完成语义、答案优先界面、保留期两次 P0 修复、基线提交、文案/版式收口（下表） | complete |

2026-07-26 起已落地（每项均通过红绿测试与当时门禁）：

- M124 覆盖+enrichment 双门槛才 `completed`；主页历史平铺、无项目分类。M125/M126 历史窗口收敛至 320px/45dvh。M127 登录自启。
- M128 答案优先的结果与收藏阅读面（建筑结果无来源检视器/核验文案/状态条）。
- 2026-07-26 保留期审计：全部验收 Run 标 `keep_forever`；M129 源码基线提交（`d772902` 产品 / `06f3424` WMI-free 启停）。
- M130 两种 goal 统一诚实完成标签；M131 经批准删除 5 条旧深度不足 Run。
- M132 单文档栏（`--layout-doc-max` 1180px）；M133 全触点白话文案 + `copy-glossary.test.ts` 源码级守卫；M134 章节结论不复读；M135 文案收口 + M121 观察工具包。
- M136 诚实标注的模拟 persona 走查（不是 M121 试点）；M137 用户《城市社区共享中心》任务书 8 问全部 completed 零缺口（含产品内"继续补齐研究"）。
- M138 案例"出处 · 域名"安静链接；M139 视觉效果轮（motion tokens、design-system 结构契约）；M140 打开应用永远落主页，研究是后台进程。
- M141 第二次保留期 P0：`keep_forever` 现在豁免 Run 子数据的 7/30 天独立时钟；`76f52c79` 从备份外科恢复。
- M142 中文名优先（`project_name_zh` 全链路 + 54 项目存量回填）；M143 移除图纸类型筛选器；M144 删除 4 条资产不可恢复的空壳 Run；M145 收藏改为纯累加保存并救回被同题替换吃掉的收藏。

当前与后续阶段：

| Phase | Status | Verification |
|---|---|---|
| M121 simulated-user pilot | complete | 2026-07-27 用户将验收改为多 agent 模拟测试后，本轮即验收轮：3 个盲测 persona 按工具包脚本驱动真实应用，独立评审按判据打分。2/3 全程跑通，核心链路判据全过；"怎么做+出处链接"被一致列为最信任资产。产出：5 项 P1（M149）、6 项重复 P2（M150）、当轮修复项（M148）、环境事件复核（零反馈/冻结最可能为自动化 ref 伪影，产品侧真缺口单列）。记录：`docs/m121-simulated-pilot-2026-07-27.md` + 逐字 JSON。图纸灵感线与任务书路径本轮零覆盖，修复后需补定向模拟。 |
| M148 submit feedback hardening | complete | 提交后按钮立即进入"正在创建研究…"禁用态；启动与任务书失败的报错以 role=alert 就近渲染在提交按钮旁（.research-submit-error），切换入口清空。红绿 2 条新测试；门禁 342 API / 135 Board / 165 Extension / 8 packaged E2E 全绿。 |
| M149 pilot P1 repairs | complete | 五项均独立红绿：deterministic fallback 以证据绑定的转译而非首案例简介作结论，旧 Run 的 Board 投影同步兼容；每案例直接提供“加入个人收藏”并保留原多选/对照；`gap_check` 检查点实时写回覆盖计数；新 Run 从创建日起默认保留一学期（180 天），逐条显示准确日期与 14 天内到期提醒，既有记录不迁移；Quick 至少 3 个正式项目，正文分析新增直接匹配闸门，尺度类比不再进入正式案例，地点译名不能核实时回退原名。权威门禁 344 API / 139 Board / 165 Extension / 8 packaged E2E，exit 0。 |
| M150 pilot repeated-P2 batch | complete | 六项按行为合同红绿收口：只显示“快速找方向 / 形成方案依据 / 做跨案例论证”一套研究方式；替换试点复现的内部语域并过滤“未读取图片像素”类审计边界；运行中结果可返回主页；直接收藏按钮原位确认，批量保存明确“选择已清空”；记录标题兼容多问句/长单问句并最多显示两行，收藏目录以原问题为主标题；顶栏删除重复“查看上次结果”。1280×720 与 390×844 loaded QA 无溢出/console error。权威门禁 346 API / 140 Board / 165 Extension / 8 packaged E2E，exit 0。 |
| M151 backup page copy and layout distillation | complete | 参考 Apple / Microsoft 的动作式备份表达收敛为“备份数据 / 恢复数据、下载备份、替换当前数据并恢复”；状态只保留“当前数据 / 最近备份”，风险说明贴近相关动作。桌面恢复区双列、≤720px 单列，自动检查/替换式恢复/最终确认/失败回滚语义不变。App/glossary/design 契约红绿闭合；1440×900 与 390×844 loaded QA 均无溢出和 console error，移动控件 44px；完整门禁随 M149 通过。 |
| M152 targeted visual/task-brief simulation | complete | 4 个 persona 在隔离 loaded UI 上完成图纸灵感与任务书路径。V1、B1、B2 全部核心判据通过；V2 能找到收藏图但不能解释与原问题/方向的关系，核心 T7 失败。两条任务书有效 Run 均 `completed/coverage_satisfied / 12 usable / 4 projects / 4/4`；浏览器 error 0；M152 未写 durable 数据。归档：`docs/m152-targeted-simulation-2026-07-27.md` + 逐字 JSON。产出 3 项 P1 与 4 项 2/2 重复 P2，进入 M153。 |
| M153 targeted-simulation repair batch | complete | 3 项 P1 + 4 项重复 P2 均按行为红灯后最小实现收口：独立幂等 default-workspace 入口保留普通同名创建；默认 Mock 为 context/mechanism 写确定性逐字摘录且 live provider 不自证；视觉收藏新存/旧快照都投影原问题与方向；结果解释 5 张去重图与 7 次方向关联；XHS/Chrome 职责、唯一图片 accessible name、任务书文件名均完成。desktop/390px loaded QA 无溢出、error 0；权威门禁 348 API / 141 Board / 165 Extension / 8 packaged E2E 全绿，durable 基线不变。 |
| M122 behavior characterization and bounded modularization | complete | 8/8 片全部完成：coverage 基线与硬阈值、8 个纯模块、11 个视图组件、`useBrowserReadiness()`、Run payload reducer、`useRunHydration()` 与 `useRunPolling()` 均按红绿合同抽出。`App.tsx` 4,089→1,752 行；Board 177 tests、覆盖率 80.01/75.75/84.77/83.80，完整门禁 348/177/165/8；请求世代、后台轮询、终态水合、页面行为及 durable 基线不变。 |
| M123 repeatable release closure | complete | CI 合同已补手动触发、只读权限与根 coverage；API / Board / Extension / manifest 统一为 2.1.0。隔离 fresh setup/start/update、备份只读预检与 8001/5174 HTTP 200 均通过；当前发布证据已刷新，旧清单与 10 张旧 PNG 全部归档保留。最终门禁 348/177/165/8、coverage 80.01/75.75/84.77/83.80 与 82.69/76.52/83.96/84.73；durable 基线未变。当时尚待授权的 Hosted CI、tag 与公开发布已由 M154 完成。 |
| M154 publish V2.1.0 | complete | 公开仓库 `jileyu2000/archresearch`、README/About/topics 与发布素材已就绪，备份 ZIP/数据库/Key 均未入库。CI 环境差异已逐项红绿修复；Windows Hosted CI 对最终 tag 落点 `2a92539` 通过 Chromium 安装、coverage、348 API / 177 Board / 165 Extension / 8 packaged E2E 及完整静态/类型/构建门禁。annotated tag `v2.1.0` 已推送，面向访客的正式 GitHub Release 已发布且无本地附件。 |
| M155 evidence-grounded agent boundaries | complete | `agent/planning.py`、`execution.py`、`verification.py` 与 `synthesis.py` 已按红绿合同形成明确边界；七阶段 orchestrator、API/schema、checkpoint、取消/恢复、查询预算、gap 补查、失败保留与 evidence-bound 双门槛不变。完整门禁 360 API / 177 Board / 165 Extension / 8 packaged E2E 全绿；durable 为 4/15/13 permanent/0 active/14 collections/2 inputs。 |
| M156 competition GitHub presentation and publish | complete | GitHub 访客页覆盖场景价值、Agent 架构、工作流/工具、创新、完成度、访问方式、3 个测试问题和人机协同边界；architecture/demo 文档同步四模块、双门槛和现行三档。公开产品提交 `010eceb` 已推送 `main`；本地完整门禁与 Hosted CI `30362938145` 均通过 360/177/165/8，durable 仍为 4/15/13 permanent/0 active/14 collections/2 inputs。 |
| M157 project-first GitHub presentation | complete | README 已恢复为 ArchResearch 的长期通用项目主页，竞赛要求仅作为信息组织参考；参赛、投稿和评审专属定位已删除，真实建筑竞赛使用场景与目标用户、痛点、场景价值、Agent 架构、人机协同、完成度、截图、安装、演示和验证入口均保留。完整本地门禁与 Hosted CI `30368067949` 通过 360/177/165/8，项目主页提交为 `cdb97f0`。 |
| M158 Cloudflare Web Edition contract and foundation | in_progress | 双版本范围合同、`apps/web`/`apps/edge` 基础与首轮离线测试已完成：网页工作台不要求用户 Key，浏览器 IndexedDB 保存 Run/result/collection 并支持版本化 JSON 导入导出；Worker 路由、Turnstile、设备/IP 配额、CostGuard DO、七阶段 Workflow、Provider client 与 `fetch` + `HTMLRewriter` 公开页读取已就位。未部署、未创建 Secret/资源、未调用真实模型或真实研究流程。 |
| M159 browser-local history and public research UX | complete | 公开页第一屏、三档研究、开始/轮询/取消、结果与最近记录均完成；IndexedDB 记录、版本化备份、OPFS 附件 adapter 及其离线测试完成。桌面与 390px loaded QA 无横向溢出；清站点数据、无痕模式和换设备丢失边界已在界面明确。 |
| M160 edge research orchestration and bounded execution | complete | typed 七阶段 plan/execute/verify/synthesize、短期 Workflow 状态、取消/恢复、逐字引文核验、coverage + enrichment 双门槛、Turnstile、入口配额、有界查询/页面/Token/时间与 kill switch 已完成。用户取消每日/单次美元金额拒绝后，CostGuard SQLite 只记录预留与实际用量；Edge 7 files / 16 tests 及根级完整门禁全绿。实际部署核验归 M161。 |
| M161 public deployment and dual-edition release | in_progress | `archresearch-web` 已用当前非 mock 源码重新部署为版本 `c17dc24c-28ce-44c3-9c0f-b52a9f4fd95e`；主页/API/安全头、生产 Turnstile、缺 token 拒绝及桌面/390px loaded QA 已通过。Web Edition 源码、Chrome-only README 边界和 fresh build 顺序修复已推送 `main`，Hosted CI `30424872745` 全绿。剩余是由真人完成 Turnstile 后执行一次 Quick 真实研究验收，再决定新版本 tag/Release；URL 只私下交付，不进入 GitHub README、Release、About 或仓库文档。 |
| M162 Web Edition full local-product transfer | complete | 公共入口直接复用本地 Board 的同一套 React 页面、样式、导航和结果工作台，只通过 `PublicApiClient` 替换持久化与云端执行；工作区、两类研究、PDF/URL、进度/诊断、完整结果、收藏、对照/导出/分享、表达规范、保留期和 JSON 备份矩阵全部闭合。提交 `896945a` 已推送 `main`，Hosted CI `30433096343` 全绿；生产 Worker 版本 `051c4e0c-4e9f-45c8-be0c-99194b16cf7b` 的桌面/390px smoke、完整结果对照与静态素材均通过，正式 `v2.1.1` Release 已发布。 |
| M163 public Web Xiaohongshu bridge | complete | 严格协议、动态公共页连接、扩展内有界小红书搜索、Web/Edge 输入与主页面安装提醒均已发布；根级 coverage 与完整门禁通过 360 API / 183 Board / 186 Extension / 11 Web / 18 Edge / 8 packaged E2E。提交 `c74571f` 的 Hosted CI `30438474678` success；生产 Worker 版本 `dc0eb528-a8c3-4ca2-88fa-c6131f866d3c` 的主页/API/安全头/Turnstile/1440/390 smoke 全绿；annotated `v2.1.2` tag、正式 Release 与扩展 ZIP 已发布。 |
| M164 Web/local user-visible parity and extension-only release naming | complete | 用户可见功能、同源界面、多方向逐帖逐图、共享 48 图/48 MiB、R2 对象键事件、IndexedDB 本地预览、扩展专属命名、PR #1、两套 Hosted CI 与 `v2.1.3` 扩展专属 Release 均已闭合。私有 R2 桶与三日生命周期已启用，生产 Worker 已部署为 `c7144317-8daa-4e8f-ae57-5ccf79fc8a41`；HTTP、安全头、正式 Turnstile 配置和系统 Chrome 1440×1000 / 390×844 线上 smoke 全部通过。 |
| M165 extension installation and connection onboarding | complete | 首动作已改为同弹窗“查看安装方法”，四步安装流程和 extension-only 下载边界完整；公共桥用严格 v2 ready 通知当前页，同 origin 重复连接不再注销重注册。PR #2 两套 fresh Windows CI、`v2.1.4` annotated tag/正式 Release、22,312-byte 扩展 ZIP、生产 Worker `06b96723-281c-4375-b816-32f21b8f2e40` 与线上 HTTP/安全头/正式 Turnstile/下载 smoke 均已闭合；系统 Chrome 本地视觉 QA 通过，线上 Chrome DOM 控制连续超时后按既定禁用内部浏览器规则停止重试。 |

### M164 验收合同

1. 功能矩阵 → 验证：逐项对照所有 `publicEdition` 分支、完整 `ApiClient` 操作、两类研究入口、历史/收藏/结果/对照/导出/表达规范/保留期/备份；每项要么行为等价，要么仅记录不可避免且不降低用户能力的基础设施差异。
2. 小红书研究深度 → 验证：网页端先形成多个视觉方向，再按方向搜索并逐帖检查；每方向最多尝试 4 帖、目标 3 篇 usable，每帖最多 4 图，全任务共享 48 个图像槽位与 48 MiB 上限，部分结果和每阶段检查点可保留。
3. 浏览器安全 → 验证：桥接协议继续严格枚举，不接受脚本、任意 selector、凭据、社交动作或通用表单；Cookie、账号和小红书登录态始终留在用户 Chrome。
4. 扩展专属命名 → 验证：Release 标题、正文、手工附件名与网页安装动作均明确这是 Chrome 扩展组件；网页安装按钮直达扩展附件，不能把 GitHub 自动 Source code ZIP/TAR 描述成安装包；Release 正文不提及或链接私有网页。
5. 红绿与回归 → 验证：生产代码前先写失败行为测试；完成后通过 Extension/Board/Web/Edge 定向测试、coverage、`scripts/verify.ps1`、打包 MV3 E2E、桌面/移动 Playwright QA、敏感 URL 扫描、Hosted CI、生产部署与线上 smoke。
6. 版本发布 → 验证：不移动或重写已发布的 `v2.1.2` tag；完整等价改动使用新版本，显式 stage/commit/push，Release 只附版本化的 extension-only ZIP。

### M165 验收合同

1. 诚实动作 → 验证：主提醒不再把站外 ZIP 描述成“一键安装”；首次主动作只展开安装方法，不触发下载或新页面。
2. 完整步骤 → 验证：下载前可读到“下载并解压 → 打开 `chrome://extensions` → 开启开发者模式并加载已解压目录 → 连接当前网页”，并明确选择直接包含 `manifest.json` 的文件夹。
3. 渐进披露 → 验证：熟悉流程的用户可从步骤页下载，已安装用户可直接检查连接，暂不安装仍能退出；不新增第二层弹窗。
4. 视觉与无障碍 → 验证：沿用现有绘图桌弹窗和按钮词汇；键盘可操作，1440×1000 与 390×844 无横向溢出，关键控件至少 44px。
5. 发布闭环 → 验证：Board/Web 行为测试先红后绿，lint/typecheck/build 与相关完整门禁通过；显式提交推送、部署 Worker，并用系统 Chrome 复核线上流程。内部浏览器继续禁用。
6. 立即连接 → 验证：用户在已经打开的公共页点击扩展“连接当前 ArchResearch 网页”后，桥接脚本无需刷新即可注入当前标签，网页状态切换为已连接并自动关闭安装提醒。
7. 幂等与诚实错误 → 验证：对已经连接的同一公共页重复点击连接仍返回成功；只有页面缺少公共版标记、权限被拒或脚本真实失败时才显示对应错误，不能把已连接状态误报为“不是公共版”。

## External acceptance gates

代码交付内不伪造的外部验收（需要用户资源或真人参与）：

- ~~M121 真实用户试点~~：2026-07-27 用户决定改为多 agent 模拟验收并已完成（见 `docs/m121-simulated-pilot-2026-07-27.md`）；真人观察不再是门槛，工具包条款保留备查。
- 30 条版本化任务的真实网页批量执行与人工标注：主动启用、会产生费用。
- 100+ 独立来源、权利清晰的真实图纸样本（当前 108 张为确定性合成夹具）。

2026-07-16 的三档真实验收与 XHS/OpenCLI 登录态验收已完成并归档为历史证据；其中底层 Run 已按用户要求删除。当前发布证明见 `docs/release-evidence-2026-07-28.md`。

## Completion roadmap

当前持久基线：**4 workspaces / 15 Runs（13 permanent + 2 条仍沿用既有到期日的模拟试点 Run）/ active 0 / 14 条收藏 / 2 条 input artifacts**。其中 2026-07-27 12:04 新增的 3 条收藏属于既有“城市社区共享中心”Run，与 M152 隔离问题不同，是并发外部变化，已保留。新建 Run 默认 180 天，既有记录未迁移。当前权威门禁：**348 API / 177 Board / 165 Extension / 8 packaged E2E** 加 Ruff/format、strict Mypy、两端 lint/typecheck/build、进程/安全/评测检查（`scripts/verify.ps1`）。

| Delivery target | Estimated completion | Remaining gate |
|---|---:|---|
| Local single-user V2.1 | 100% | 当前本地功能与门禁已收口。 |
| Portfolio / supervised demonstration | 100% | 当前源码、三条可核对 Run 与 desktop/mobile loaded QA 已形成发布证据。 |
| Small closed beta | 100% | 当前本地基线无剩余 M153 行为门槛。 |
| Public repeatable release | 100% | `v2.1.0` tag、GitHub Release、公开源码与 Hosted CI 均已闭合。 |

执行顺序：M155/M156/M157 已完成并通过本地与 Hosted CI；当前无剩余发布动作，后续仅按用户提出的新目标立项。

### M155 验收合同

1. 架构边界 → 验证：规划、执行支撑、核验/coverage 与综合职责具有小型明确模块；`workflow.py` 只保留运行编排和阶段顺序，不引入框架或多智能体运行时。
2. 行为保持 → 验证：七阶段 checkpoint 顺序、查询预算、恢复去重、取消、失败保留、gap 补查与终态判定不变。
3. 证据合同 → 验证：事实仍绑定 URL 与逐字引文，模型 relevance 只排序，coverage 与 enrichment 同时达标才 `completed`。
4. 红绿迁移 → 验证：每片先新增因缺少目标边界而失败的测试，再做最小搬移；不借重构改变用户文案、API 或 durable schema。
5. 回归 → 验证：API 定向测试、lint/format、strict Mypy、`scripts/verify.ps1` 全绿；durable 数据不改写。

### M156 验收合同

1. 竞赛对齐 → 验证：逐项核对公告和提交模板，只写可由当前源码、测试或发布证据支持的能力，不夸大部署形态、模型自主性或真实用户验证。
2. GitHub 访客页 → 验证：首屏能回答“解决什么问题、谁使用、怎样运行”；架构与七阶段 evidence-grounded 工作流、截图、安装/演示、数据与安全边界均可从目录直接到达。
3. 发布安全 → 验证：公开 diff 不含 Key、数据库、备份 ZIP 或本地路径泄露；链接与图片有效，Markdown 可读。
4. 发布门禁 → 验证：M155 独立审查无功能回归，`scripts/verify.ps1` 全绿，durable 基线不变；仅显式 stage 本轮文件，提交、推送后 Hosted CI 通过。

### M157 验收合同

1. 长期项目定位 → 验证：README 不再把仓库或展示页描述为参赛、投稿、评审或专门为竞赛准备；“建筑竞赛”仅可作为真实用户使用场景出现。
2. 信息完整 → 验证：目标用户、真实痛点、使用场景、实际价值、Evidence-Grounded Plan-and-Execute 架构、人机协同、完成度、截图、安装、演示和测试入口继续保留。
3. 外科范围 → 验证：不改生产代码、测试合同、架构或 durable 数据；公开差异不含凭据、数据库、备份 ZIP 或无关文件。
4. 发布门禁 → 验证：Markdown 链接与图片有效，`git diff --check` 和独立 diff 审查通过；完整离线门禁通过后显式 stage，推送 `main` 并等待 Hosted CI 成功。

### M158 验收合同

1. 双版本边界 → 验证：现有 Windows/Chrome 本地版继续 BYOK、本机 SQLite 与完整浏览器能力；Cloudflare Web Edition 是独立部署目标，不改变本地 API、数据库或扩展默认行为。
2. 密钥与费用 → 验证：网页 bundle、浏览器存储、响应和 Trace 中均无项目方 Key；只有通过 Turnstile、配额、单次预算和全局费用熔断的请求才能到达服务端 Provider client。
3. 数据驻留 → 验证：当前长期 Run/result/collection/history 默认只写 IndexedDB，并提供版本化导出/导入；OPFS 附件 adapter 作为后续边界单独验收。Cloudflare 只持有有明确 retention 的 Workflow 状态和费用预留，不建立平台级长期历史。
4. 真实研究语义 → 验证：官方 Cloudflare 能力能够支持有界长任务、公开 HTTPS 页直接读取和逐阶段恢复；默认路径使用 `fetch` + `HTMLRewriter`，不依赖 R2/Browser Rendering。无法在边缘安全复现的本地浏览器/XHS 能力必须明确降级，不能用静态演示冒充实时研究。
5. 测试先行 → 验证：生产代码前先见缺少 Web Edition 边界/模块的红灯；默认测试只使用 mock/fixture，不调用真实模型、Cloudflare 账户或公开网页。
6. 第一阶段交付 → 验证：Cloudflare 配置、typed contracts、IndexedDB adapter、费用闸门、实际 Worker 路由壳与 mock Workflow 骨架可在离线测试中运行；Web/Edge lint/typecheck/unit/build 与既有本地版定向回归全绿。OPFS、浏览器 QA、根级门禁与安全审查在基础测试闭合后继续执行。
7. 链接隔离 → 验证：仓库公开内容、构建产物源码映射、Release 与 About 均不包含 Web Edition URL；该地址只出现在私下提交材料。

### M162 验收合同

1. 产品边界 → 验证：`apps/web/PRODUCT.md` 明确 Web Edition 是现有本地产品的公共部署，不是独立设计或简化演示版；本地版的页面、导航、命名和工作流是唯一产品基线，Edition 差异只能来自已验证的基础设施限制。
2. 个人收藏 → 验证：首页和结果页均可进入独立“个人收藏”页面；页面具有建筑方案/图纸灵感标签、空状态、按原研究问题整理的建筑结果及删除动作。
3. 收藏持久性 → 验证：终态结果可直接或批量加入收藏；收藏保存标题、事实、来源和原问题快照，不依赖临时 Workflow；IndexedDB 关闭重开及 JSON 导入导出后仍可回看，旧版收藏记录继续可读。
4. 完整迁移矩阵 → 验证：首页头部与工作区、建筑设计研究/图纸灵感、任务书与案例页、最近研究、进度/重试/覆盖诊断、建筑/视觉结果、对照/导出/分享/表达工具、收藏与备份逐项对齐本地版；不能以“Web Edition”名义删除功能。
5. 同源界面 → 验证：公共入口直接渲染本地 Board 产品代码与设计系统，不维护第二套近似 UI；Edition 分支只处理公开来源、Turnstile、云端执行和浏览器本地数据。
6. 长期历史 → 验证：Run、结果、收藏、表达规范、任务书和备份保存在当前浏览器；云端三日检查点消失后，终态研究仍能从浏览器本地重新打开。

### M163 验收合同

1. 登录态边界 → 验证：小红书登录、Cookie 和凭据始终留在用户 Chrome；网页、Worker、Workflow 和 Provider 不接收凭据。
2. 受限协议 → 验证：公共网页只能调用版本化、枚举式 bridge 动作，不能下发脚本、任意 selector、社交动作、通用表单或凭据读取。
3. 明确连接 → 验证：进入主页面即检查扩展，未检测到时显示安装/连接提醒；检测成功后不再弹出。图纸灵感入口继续显示未连接、未登录、已就绪和读取失败状态；只有用户明确点击扩展按钮才注册当前公共 origin、授予权限或开始读取。
4. 同源产品 → 验证：本地版现有 Chrome/XHS 行为不回归；公共版复用同一研究环境组件，把 XHS 结果并入现有视觉结果、收藏和备份链路。
5. 视觉与无障碍 → 验证：沿用根 `DESIGN.md` 的绘图桌/网格、品牌、排版和交互语义；键盘焦点可见，状态不只依赖颜色，390px 无横向溢出并尊重 reduced motion。
6. 发布门禁 → 验证：manifest/动态 origin、消息来源校验、协议测试、Board/Web/Extension suites、production builds、打包 MV3 E2E、1440/390px QA 和敏感信息扫描全部通过；部署后复核主页/API/安全头/Turnstile。URL 仍只私下交付。

### M121 试点执行计划（已完成，2026-07-27 模拟验收）

任务脚本、判据、记录表与 P0–P3 分级以 `docs/m121-pilot-kit.md` 为准；本轮执行方式、评分矩阵、缺陷清单与模拟局限见 `docs/m121-simulated-pilot-2026-07-27.md` 及逐字 JSON。后续任何补充模拟轮沿用同一套判据与"persona 与评审分离"的方法。

### M153 验收合同

1. 默认工作区初始化 → 验证：对同一 fresh DB 并发触发初始化，最终只有一个默认 workspace，且既有数据库不被合并或改名。
2. 默认 mock 完成/展示一致 → 验证：若 Run 为 `completed/coverage_satisfied`，Board 至少显示与 coverage 对应的 evidence-bound 正式案例；否则 API 必须诚实保持 partial/blocked，不能出现“完成但四问全空”。
3. 图纸收藏关系 → 验证：保存来自两个不同原问题、两个不同方向的图片后，收藏列表无需打开详情即可辨认原问题与方向；旧 snapshot 继续可读。
4. 重复 P2 → 验证：结果页解释去重总数与方向关联数；环境文案区分小红书检索和 Chrome 页面高清读取；图片选择按钮名称包含可辨认目标；选择任务书后显示每个文件名。
5. 回归 → 验证：先见定向红灯，再做最小实现；运行 API/Board 定向测试、桌面与 390px loaded QA、`scripts/verify.ps1`，durable 基线与正常服务不被测试数据改写。

### M107 real-brief fixture (still the deterministic brief contract)

- Input: `2024 研一概念设计-窦平平.pdf`, a three-page Nanjing University graduate concept-design brief for a smart museum of sericulture and silk-weaving culture in the Suzhou Science and Technology Museum.
- User question: how can a two-dimensional pictorial work such as the *Gengzhi Tu* be translated into three-dimensional architecture and which elements should be extracted?
- Required internal boundary plan: preserve the brief's research sequence and design obligations; generated questions separate process/sequence, spatial syntax, actor-object-space relationships, multisensory interaction and prototype validation. The system must not collapse the task into decorative motif extraction.
- The fixture is covered by deterministic Provider, API, client and Board tests. The internal review persists neither an artifact nor a Run on its own; the same submit action proceeds to the ordinary Run only after review succeeds.

## Decisions

- React + Vite instead of Next.js: the board is a local SPA with no SSR requirement.
- FastAPI + SQLAlchemy + SQLite; no PostgreSQL, Redis, S3, Celery, Docker, Qdrant, LangGraph, or multi-agent runtime.
- Direct OpenAI Responses API with strict schemas; custom local trace to control sensitive data. Research and visual classification default to `gpt-5.6-sol` with `medium` reasoning; both remain environment-overridable.
- The `suoxie` relay key is accepted only through hidden PowerShell input and stored in Windows Credential Manager; provider JSON contains no secret. Never print or migrate the key.
- Project automation defaults to PowerShell 7 (`pwsh`); Windows PowerShell 5.1 only for explicit compatibility checks. Process scripts must stay WMI/CIM-free (MSIX pwsh cannot load MMI): listener discovery via `netstat -ano`, command lines via PEB.
- All browser commands are enumerated JSON messages; no arbitrary selectors, JavaScript, credentials, social actions, or general form submission.
- Retention: new Runs default to one semester (180 days) from creation with a per-record permanent toggle; cancelling permanent restarts 180 days from that action, while existing rows keep their stored expiry. Assets/claims use 7 days and sources/query metadata/trace 30 days unless their Run is permanent. `keep_forever` protects the Run **and all its child evidence** from every expiry clock (M141). Personal collections are snapshots that survive Run expiry; saving is additive and never deletes an existing collection (M145).
- Research depth is a semantic contract (decomposition, per-subquestion coverage, analysis obligations); query/page/time values are bounded execution ceilings. All depths owe a complete answer across planned subquestions; depth changes rigor, never permission to deliver a knowingly incomplete answer as complete.
- Deterministic replay fixtures remain the zero-cost development and regression path. Firecrawl was fully removed in M41 and must not return; TinEye/source lookup was removed in M113; Pinterest was removed in M94 and unexpected Pinterest results are discarded before persistence. Current release evidence is frozen in `docs/release-evidence-2026-07-28.md`; older captures remain historical only.
- Xiaohongshu support uses only the user's visible, signed-in Chrome pages after explicit one-time permission; read-only `search`/`download` commands, no password/cookie/DM access, revocable anytime. Authoritative architecture/project sources establish case facts; Xiaohongshu is the sole visual-inspiration source and cannot alone prove a project case.
