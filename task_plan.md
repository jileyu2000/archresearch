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

执行顺序：M155/M156 已完成并通过本地与 Hosted CI；当前无剩余发布动作，后续仅按用户提出的新目标立项。

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
