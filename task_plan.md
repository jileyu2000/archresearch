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
| M149 pilot P1 repairs | proposed | 五项：结论栏与证据脱节（先工程根因诊断疑似绑定错位）；保存入口可发现性（结果页直接给"加入个人收藏"动作）；等待期"可用参考"计数全程为 0 的失灵；保留策略提醒与说明（到期提醒/起算日/一学期诉求的产品决策）；案例供给与匹配质量（含中英名不一致核查）。每项独立红绿。 |
| M150 pilot repeated-P2 batch | proposed | 六项：三档双命名统一为一套词；术语语域清理（初步依据缩略态、连续检索、未读取图片像素、证据方向等）；研究进行中保留全局入口（主页不被进度视图整页接管）；保存成功反馈就近化 + 选中态清空的语义说明；记录/收藏标题的可辨认性；顶栏"查看上次结果/个人收藏"职责梳理。 |
| M122 behavior characterization and bounded modularization | proposed（表征已启动） | 表征产出见 `docs/m122-extraction-map.md`：API 覆盖率基线 91%（逐模块不下降阈值），三份拆分地图（`App.tsx` 4,013 行 8 步、`workflow.py` 4,977 行 10+1 步、`styles.css` 5,430 行 14 文件且**测试契约先行**）。Board/Extension 覆盖率待装插件。拆分执行沿既有产品边界，每个切片后完整门禁不变绿不继续。 |
| M123 repeatable release closure | proposed | 干净 Windows/Chrome 环境证明 setup/start/update 与备份预检；为既有门禁加 CI；把发布证据刷新到最终源码状态（一并处置 M131/M144 后失效的 `docs/release-evidence-2026-07-16.md` 与 8 张旧 PNG）。stage/commit 已单独授权过的除外，push 仍需显式授权。 |

## External acceptance gates

代码交付内不伪造的外部验收（需要用户资源或真人参与）：

- ~~M121 真实用户试点~~：2026-07-27 用户决定改为多 agent 模拟验收并已完成（见 `docs/m121-simulated-pilot-2026-07-27.md`）；真人观察不再是门槛，工具包条款保留备查。
- 30 条版本化任务的真实网页批量执行与人工标注：主动启用、会产生费用。
- 100+ 独立来源、权利清晰的真实图纸样本（当前 108 张为确定性合成夹具）。

2026-07-16 的三档真实验收与 XHS/OpenCLI 登录态验收已完成并留作历史证据；其中部分底层 Run 数据已按用户要求删除，证据刷新归 M123。

## Completion roadmap

当前持久基线：**4 workspaces / 15 Runs（13 permanent + 2 条 14 天保留的模拟试点 Run）/ active 0 / 11 条收藏（8 + 3 条模拟产物）/ 1 份任务书**。当前权威门禁：**342 API / 135 Board / 165 Extension / 8 packaged E2E** 加 Ruff/format、strict Mypy、两端 lint/typecheck/build、进程/安全/评测检查（`scripts/verify.ps1`）。

| Delivery target | Estimated completion | Remaining gate |
|---|---:|---|
| Local single-user V2.1 | 95% | 目标用户验证（M121）、可维护性表征（M122）。 |
| Portfolio / supervised demonstration | 90% | 把发布证据刷新到最终源码状态（M123）。 |
| Small closed beta | 90% | 落实 M149/M150 试点修复；补测图纸灵感线与任务书路径。 |
| Public repeatable release | 70% | CI、干净机器安装/更新证明、授权后的版本化发布（M123）。 |

执行顺序：M149（五项 P1）→ M150（六项重复 P2）→ 图纸灵感线与任务书路径的定向补充模拟 → M122 → M123。任何修复先定义单独的 behavior-first 里程碑再动代码。

### M121 试点执行计划（已完成，2026-07-27 模拟验收）

任务脚本、判据、记录表与 P0–P3 分级以 `docs/m121-pilot-kit.md` 为准；本轮执行方式、评分矩阵、缺陷清单与模拟局限见 `docs/m121-simulated-pilot-2026-07-27.md` 及逐字 JSON。后续任何补充模拟轮沿用同一套判据与"persona 与评审分离"的方法。

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
- Retention: Runs default to 14-day retention with per-record permanent toggle; assets/claims 7 days, sources/query metadata/trace 30 days. `keep_forever` protects the Run **and all its child evidence** from every expiry clock (M141). Personal collections are snapshots that survive Run expiry; saving is additive and never deletes an existing collection (M145).
- Research depth is a semantic contract (decomposition, per-subquestion coverage, analysis obligations); query/page/time values are bounded execution ceilings. All depths owe a complete answer across planned subquestions; depth changes rigor, never permission to deliver a knowingly incomplete answer as complete.
- Deterministic replay fixtures remain the zero-cost development and regression path. Firecrawl was fully removed in M41 and must not return; TinEye/source lookup was removed in M113; Pinterest was removed in M94 and unexpected Pinterest results are discarded before persistence. Release-evidence refresh (including any new captures) is deferred to M123.
- Xiaohongshu support uses only the user's visible, signed-in Chrome pages after explicit one-time permission; read-only `search`/`download` commands, no password/cookie/DM access, revocable anytime. Authoritative architecture/project sources establish case facts; Xiaohongshu is the sole visual-inspiration source and cannot alone prove a project case.
