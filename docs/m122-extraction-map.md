# M122 拆分地图（表征阶段产出，2026-07-27）

## 执行状态

- 第 1/8 片已完成：加入 Board/Extension coverage-v8、根级 `pnpm test:coverage` 与硬阈值；以缺模块红灯钉住边界后，抽出 `lib/text.ts`、`labels.ts`、`storage.ts`、`backup.ts`、`run.ts`、`demo.ts`、`collections.ts`、`workResult.ts`。
- `App.tsx` 从 M153 后的 4,089 行降至 3,241 行；React 状态、组件和 JSX 未拆。Board 总覆盖率从 78.17/72.39/80.50/81.78 变为 78.36/72.59/80.50/81.84，新 lib 组为 88.67/81.41/97.01/91.92。
- 第 2/8 片已完成：以缺组件红灯钉住 `<DataManagementPage>`，再等价搬移备份/恢复状态、API 操作与 JSX；组件关闭时保持挂载，保留原有跨页面状态语义。App 只保留页面开关、操作提示和恢复后的工作区刷新回调。
- `App.tsx` 继续从 3,241 行降至 3,132 行；Board 151 tests，覆盖率为 78.44/72.73/80.63/81.91，新组件函数覆盖率 100%。
- 第 3/8 片已完成：以缺组件红灯钉住 SharePanel / StylePanel / ComparisonDialog / SourceInspector，再等价搬移四个叶子覆盖层；统一关闭、trigger ref、body scroll lock、Escape 与 Tab 焦点循环全部继续留 App。
- `App.tsx` 继续从 3,132 行降至 2,977 行；Board 155 tests，覆盖率为 78.79/73.68/81.94/82.23；ComparisonDialog、SharePanel、SourceInspector 的 statements/functions 均为 100%。
- 第 4/8 片已完成：以缺组件红灯钉住 `<PersonalCollectionsPage>` 后，等价搬移建筑/图纸切换、加载/空态、目录/详情和视觉上下文；删除 API、`savedIds` 同步、打开加载与页面开关仍留 App。
- `App.tsx` 继续从 2,977 行降至 2,701 行；Board 158 tests，覆盖率为 78.94/73.78/82.47/82.39，新组件 statements/functions/lines 均为 100%；完整门禁 348/158/165/8。下一片是 `<VisualInspirationBoard>` → `<CaseAnalysis>`。
- 第 5/8 片已完成：以缺组件红灯钉住 `<VisualInspirationBoard>` / `<CaseAnalysis>` 后，依次等价搬移图纸方向/帖子/图片和建筑子问题/代表案例答案；group 派生、选择持久化、overlay trigger 与浏览器不可用判断继续留 App。
- `App.tsx` 继续从 2,701 行降至 2,349 行；Board 161 tests，覆盖率为 79.42/75.42/83.11/82.87，四项均高于第四片；完整门禁 348/161/165/8。下一片是 `<ResearchComposer>` + HomeSections。
- 第 6/8 片已完成：以缺组件红灯钉住 `<ResearchComposer>` / `<HomeSections>` 后，等价搬移受控研究表单、环境展示、问题起点、工作区新建表单和最近研究；输入/提交/工作区/API 副作用与跨组件 question ref 继续留 App。
- `App.tsx` 继续从 2,349 行降至 2,024 行；Board 164 tests，覆盖率为 79.45/75.55/83.18/82.89，四项均高于第五片；完整门禁 348/164/165/8。下一片是 `useBrowserReadiness()`，先解决 `hydrateRun` 与环境检查双写浏览器状态。
- 第 7/8 片已完成：以缺 hook 红灯钉住首次检查、手动刷新、权限/错误投影和后发检查优先语义，再集中配对、自动连接、权限确认、服务刷新及环境文案。请求序号丢弃陈旧结果，`hydrateRun` 只通过 hook 刷新环境。
- `App.tsx` 继续从 2,024 行降至 1,818 行；Board 172 tests，覆盖率为 79.81/75.55/83.66/83.76，四项均不低于第六片；完整门禁 348/172/165/8。下一片是 run payload reducer + `useRunPolling()` / `useRunHydration()`。
- 第 8/8 片已完成：以缺模块红灯钉住 payload 原子 hydrate/reset、陈旧请求失效和终态轮询顺序；Run payload 已收敛到 reducer，请求世代归 `useRunHydration()`，1 秒 polling/busy/当前 Run 终态水合归 `useRunPolling()`。
- `App.tsx` 最终从 1,818 行降至 1,752 行；Board 177 tests，覆盖率为 80.01/75.75/84.77/83.80，四项均不低于第七片；完整门禁 348/177/165/8，durable 与服务基线不变。M122 8/8 全部完成。

## 覆盖率基线

- API（pytest-cov 6.3.0，342 tests，exit 0）：**总体 91%**（5735 语句 / 497 未覆盖）；workflow.py 95%、api.py 91%、lifecycle.py 96%、providers.py 96%。报告存于 `.artifacts/coverage/api-coverage.xml`。M122 阈值定为"逐模块不下降"。
- Board / Extension：coverage-v8 已安装并设硬阈值；根命令 `pnpm test:coverage`。Board 最低阈值为 statements 78.17 / branches 72.39 / functions 80.50 / lines 81.78；Extension 为 82.69 / 76.52 / 83.96 / 84.73。

> 只读分析产出，未改任何代码。三个大文件各一节：候选模块、依赖、风险与推荐拆分顺序。
> 拆分执行时以本文件为起点，每一片先迁移/补行为测试，再动实现，完整门禁全绿才进入下一片。

## App.tsx（4013 行）

### 顶层清单（按产品边界分组）

- **纯文本/格式助手 →`lib/text.ts`**：`synthesisSegment` 144–151、`conciseSynthesisHeadline` 153–159、`fallbackAnswerMechanism` 161–169、`userFacingRecommendation` 171–179、`sourceHostLabel` 181–187、`userFacingProjectName` 189–193、`chineseText/chineseItems` 224–231、`normalizedCopy` 916、`uniqueSummaryItems` 992–1004、`auditBoundaryPattern/userFacingBoundary/firstUserFacingBoundary` 1006–1016。
- **词汇/标签 →`lib/labels.ts`**：`questionRelevanceLabel` 110、`publicationTierLabels` 118、`associationLabels` 125、`rightsStatusLabels` 132、`modeLabels` 243、`researchDepthOptions` 249、`goalLabels/goalPlaceholders` 264–272、`assetLabels` 301、`comparisonFocusLabels` 314、`visualPlatformName` 233、`drawingFor` 647。
- **Run 域 →`lib/run.ts`**：`terminalStatuses` 102、stage 标签 385–427、`runAnnouncement` 441–482、`needsCompletionContinuation` 484、`partialReasonTitle/partialDiagnosis` 498–561、`announcementExplanations` 569。
- **结果投影 →`lib/workResult.ts`**：`WorkResult/ResultAnalysis` 67–82、`toWorkResult` 677–773、`analysisFor` 903、`projectPreviewCopy` 924–990、`supportsSubquestion` 830、`fallbackSubquestions` 800、`availablePreviewUrl` 1018。
- **收藏 →`lib/collections.ts`**：`collectionSelectionKey` 98、case helpers 841–901。
- **备份 →`lib/backup.ts`**：storage key 329、`readLastBackupRecord` 336、`formatBackupSize/Time` 348–357。注意 `activeWorkspaceStorageKey`（328）另被 workspace 引导 1381、`openRun` 1494、建项目 1586、恢复 1649 使用 → 放中立的 `lib/storage.ts`。
- **Demo →`lib/demo.ts`**：359–383、775–798。
- 已抽出的唯一组件：`RunHistoryList` 588–645。

### App() 状态簇（1046–1126）

Workspace / Composer 输入 / Run 生命周期（含 `hydrateRequestRef`、`activeRunIdRef`）/ **Run payload**（results、selected*、savedIds、rejectedIds、notes、traceEvents、styleProfile——由 `hydrateRun` 1437–1480 一起写、`clearRunView` 1347–1363 一起清）/ 选择与画板（comparisonIds、collectionSelections——与 run payload 不可分）/ 收藏页 / 数据管理（**完全自含**，只依赖 workspaces、recentRuns 计数与 `resetWorkspaceView`）/ 浏览器就绪（7 个状态）/ 覆盖层（4 个对话框共用一个焦点陷阱 1158–1188）/ 全局单例（`actionError`、`announcement`、`loading`、`demoMode`）。

### 推荐拆分顺序（每片保持行为不变、全量编译通过）

1. **纯库**：text、labels、storage(keys)、backup、run、demo、collections、workResult——无 React、无状态，机械搬移。
2. **`<DataManagementPage>`** 2469–2604——最孤立视图，只需 `workspaceCount/runCount/isRunActive/onRestored/onError`。
3. **叶子覆盖层**：SharePanel 3651、StylePanel 3573、ComparisonDialog 3597、SourceInspector 3918——`closeOverlays`/焦点陷阱留在 App，传 `onClose`。
4. **`<PersonalCollectionsPage>`** 3666–3914——`deletePersonalCollection`（1263，另写 savedIds）留 App 传入。
5. **`<VisualInspirationBoard>`** 3114 → **`<CaseAnalysis>`** 3243——`inspirationGroups/caseGroups` 派生先留 App 以 props 传入。
6. **`<ResearchComposer>`** 2606 + HomeSections 2778。
7. **`useBrowserReadiness()`**——先解决双写者问题（`hydrateRun` 1459 也写 browserConnected）。
8. **`useRunPolling()/useRunHydration()`**——最后做；`hydrateRequestRef` 在 7 处递增（1191、1483、1671、1751、1771、1909、2112），需先把 run-payload setters 合并成 reducer。

### 跨切关注点（留 App 或进共享模块）

- `apiClient`/`apiMessage`：25+ 调用点，模块内直接 import，不穿 props。
- `actionError`（唯一错误汇，渲染于 2877）与 `announcement`（唯一 live region）：留 App，向下传 `onError`。
- `overlayTriggerRef` + 焦点陷阱：一个陷阱服务 4 个对话框，留 App。
- **TDZ 闭包陷阱**：`isVisualResearch`（2138）被更早声明的 `addSelectionToCollection`（1277）、`handleExport`（2066）闭包引用——任何一个移出去都必须显式传参。
- `clearRunView`/`resetWorkspaceView`：跨 10–18 个状态的链式重置；拆出的模块必须暴露同序 reset。

## workflow.py（4977 行）

外部消费面很窄：`api.py:90` 只 import `ACTIVE_STAGES` 与 `execute_research_run`；但测试按名字 monkeypatch/import 14 个 `_` 前缀符号（见下"再导出名单"）。

### 候选模块与风险（按边界）

- **`workflow/urls.py`**（零风险，纯函数）：XHS/稀疏平台/已移除来源 URL 判定、`_redacted_trace_url`、`_inferred_publication_tier`、`_project_display_name/_identity_key`、`_asset_type_label`（穷举字典，新资产类型会 KeyError）、`_relevance_tokens`。
- **`workflow/budget.py`**：`_page_budget_available`（1424）+ 两个 persist 助手 + 视觉上限常量。**check 与 increment 分离在调用点**（808/854/1040 后自增）——顺序敏感，不得合并。
- **`workflow/checkpoints.py`**：`_checkpoint`（1439，取消态静默 no-op 是被依赖的行为）、`_get_run`、`_raise_if_cancelled`、query-attempt 系列、`_preserve_failure`。注意 `_remote_visual_batch_started` 靠回放 TraceEvent.summary 去重——**trace 摘要是事实 schema**，不只是日志。
- **`workflow/planning.py`**：`_research_plan/_normalize_plan/_fallback_plan/_queries_for/_research_context/_extract_pdf_text`。`_fallback_plan` 按 goal 索引，第三种 goal 会 KeyError；`_queries_for` 的截断与恢复轮数学（243–260）联动。
- **`workflow/coverage.py`**：`_coverage`（4764）/`_completion_satisfied`/`_enrichment_satisfied`。test_browser_inspection.py 在 12 处按 `workflow._coverage` monkeypatch——必须保留再导出。
- **`workflow/persistence.py`**：五个 `_persist_*` + `_rerank_assets`。**`_rerank_assets` 收 live Session、必须在调用方事务内提交前调用**——全文件唯一契约不同的函数。`PUBLICATION_TIER_STRENGTH` 对入库用 `[...]`（未知即抛）、对存量用 `.get(...,0)`——刻意的不对称。
- **`workflow/public_search.py`**：搜索/轮换/排序系列。**`_try_xiaohongshu_search` 故意 mutate 调用方的 searches 列表（`searches.pop(0)`，2013/2041）——这是 OpenCLI→扩展 fallback 的机制本体，不得"修"成拷贝**。`_search_description` 走 pydantic PrivateAttr 的隐通道（1962 写 → 3830 读）。
- **`workflow/synthesis.py`**：综合 + 确定性 fallback。`_is_recoverable_research_synthesis_error` 按**英文错误消息子串**匹配（4382–4387）——providers.py 改措辞会静默禁用 fallback；`"｜原文："` 是跨函数字符串契约（4428/4642）。**先于 page_analysis 抽出**（3068 处被反向依赖）。
- **`workflow/visual.py`**：远程视觉分类系列。48 槽位预算与逐图类型过滤**内联在 orchestrator（712–731），不在这组里**——是单独更险的一片。
- **`workflow/page_analysis.py`**（耦合最高，最后抽）：正文分析/逐字证据门/项目补查/article-ready 复用。逐字门（`_supported_project_facts` 3163–3174 空白归一后子串匹配）是产品级不变量；`_persist_public_page_analysis` 四级候选回退（3305–3438）顺序不可动。mutate 四个调用方缓存。

### 推荐顺序

urls → budget → checkpoints → planning → coverage → persistence → public_search → synthesis → visual → page_analysis →（可选、最险）orchestrator 内部分解（657–1214 逐源检查体、683–783 XHS 下载+类型过滤块、1355–1399 终态处置块，抽成显式 run-state dataclass 的具名函数）。

每片门禁：至少 `pytest test_workflow.py test_browser_inspection.py`，合入前完整门禁。**再导出名单**（workflow.py 必须保留这些名字）：`_inspection_source_sort_key、_persist_assets、_persist_inspected_assets、_persist_sources、_public_page_analysis_text、_public_search_query、_queries_for、_try_xiaohongshu_search、_persist_expanded_project_page、_research_plan、_research_synthesis_case_identity、_coverage、_research_synthesis_cases、inspect_source_page`。

### 表征旗标（拆分前先用测试钉住，不做定性）

- `_is_removed_visual_source_url` 3784：Pinterest 专用 blocklist（M94 遗产，保留即约束）。`_is_sparse_visual_platform_url` 3775 是 `_is_xiaohongshu_url` 纯别名 ×8 调用点。
- `_public_typology_focus` 1681：zh 分支算完即弃（1669 从不插值）。
- 1145–1214 缓存页复用分支与 925–1144 大量镜像但少三步——分歧是否有意，未知。
- 4374–4400 英文子串匹配的可恢复错误检测：与 providers.py 消息文本脆耦合。
- `_remote_public_image_batch` 2320：单图页早退绕过 REMOTE_VISUAL_BATCH_LIMIT。
- `NON_PRECEDENT_COVERAGE_TARGETS` 146：唯一使用处 4906，`target_multi_asset_projects=0` 使 4928 缺口检查在该路径恒假。
- 3483 `getattr(analysis, 'project_name_zh', '')` 防御式访问：字段已是 typed，疑似遗留。
- `_try_project_text_supplement` 2884–2887 的窄准入窗口。

## styles.css（5430 行）

### 最重要的发现：测试契约先行

`design-system.test.ts` 用 `import styles from './styles.css?raw'` 把整张表当**一个字符串**切片（按 `indexOf` 首次出现的 `@media (max-width: 1180px)` / 860 / 620 / prefers-reduced-motion 字面量）。因此：
- **任何文件拆分前必须先迁移测试**：改为按显式顺序读入并拼接各文件（或拼接产物），否则每条断言全灭；
- 拼接顺序必须保持 1380 → 1180 → 860 → 620 → reduced-motion；组件文件**禁止**自带这三个宽度的 media 块（indexOf 取首次出现，提前出现会重定义切片窗口）；
- 全文件扫描类断言（≥5 个 `animation:` 简写、`@keyframes sheet-settle|dock-rise|saved-dot-in` 等）要求拼接覆盖全部文件；
- 文档栏规则（3183–3194）必须保持**单条规则**承载全部 7 个选择器。

### 推荐拆分：14 个文件，严格 import 顺序

tokens(1–99) → base(100–211) → canvas(212–351) → shell(352–647) → data-management(648–925，自带 720px 块) → composer(927–1487，含 .style-panel 字段基础 1236–1252) → home(1488–1701 + 2259–2324) → collections(1702–2258) → run-states(2325–2649) → results(2650–3398，含灵感板与文档栏规则) → dossier(3399–4063) → overlays(4064–4657，含 keyframes) → responsive(4658–5406) → reduced-motion(5408–5430，永远最后)。

**钉死顺序的同优先级选择器对**（后者胜）：`.collection-case-image a` 2001 vs 3085（results 在 collections 后）；`.evidence-image` 3098 vs 3867（dossier 在 results 后）；`.collection-question-directory` 1717 vs 文档栏 3190；`.research-submit` 481 vs 1055（composer 在 shell 后）；`.drawing-recovery` 1371 vs 2339（run-states 在 composer 后）；`.style-panel textarea` 1239 vs `.style-panel` 4183（composer 在 overlays 前）等。同文件内多段定义（`.recent-open` ×3、`.coverage-summary` ×2、`.source-inspector` ×2 等）保持连续搬移。

### 表征旗标（疑似死代码，先测后判）

- `.reference-actions`（4884，仅存在于 860 块）：**源码无引用但被 design-system.test.ts:24 断言锁活**——绿测试养着的死规则。
- `.case-representatives/.representative-case*`（3579–3687 + 4735）、`.question-summary*`（3545 + 5319）、`.dossier-list`（3399/3714）、`.dossier-verification*`（3462）、`.empty-filter`（2497）与 `#asset-filter`（5314，M143 删筛选后疑似遗留）——均无 tsx 引用或仅历史路径引用，回应 findings 里"dossier 台账 CSS 死活"的悬案：**大概率死，拆分时先加表征测试再清**。
- 双定义同类名两种视觉（`.evidence-image` 3098 vs 3867）：一个类名两种含义，拆分时建议改名而非合并。
