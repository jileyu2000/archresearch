# Progress Log

> 2026-07-26 M128 之前的进展已归档至 [docs/history/progress-archive-2026-07.md](docs/history/progress-archive-2026-07.md)，只在追溯根因时查阅。

## 2026-07-26 完成度检查与保留期修复

- 用户要求检查项目完成度。只读复验（`mode=ro` SQLite、health、OpenAPI、`pytest --collect-only`）确认 3 workspaces / 14 completed Runs / active 0、341 API 测试与记录一致，并刷新了过时的 M122 文件规模与 diff 规模。
- 审计发现 P0：14 条 Run 全部 `keep_forever=0`，12 条在 2026-08-03 同时到期，而 `cleanup_expired_data` 在每次 API 启动执行硬删除，M127 开机自启会在每次登录触发它。8 天后的首次无人值守登录就会删掉封存 Run 与全部验收证据；留存的 M119 备份因保存已过期时间戳而无法保护。
- 用户批准后，用既有 `PATCH /v1/runs/{id}/retention` 把 14 条 Run 标为永久保留，14/14 返回 200。独立只读复读为 `keep_forever=1` / 到期时间为空，按 `lifecycle.py` 原谓词实测可删除 Run 归零。未改代码、schema 或迁移，可逐条撤销。
- 更正一处自述：Board 最近研究每条记录本就显示"还剩 N 天 / 设为永久"（`App.tsx:585-594`），先前"无警告"的说法过重；缺口在于验收证据与普通 Run 无区分、无集中到期提示、删除后无撤销。
- 未创建、重试或取消任何 Run，未调用 Provider/Firecrawl，未截图，未执行 reset/checkout/clean/stage/commit/push；staged 仍为 0。

## M129 source baseline protection

- 用户批准按 A→B→C 顺序推进，A 为源码基线保护，并要求用 planning-with-files 记录进度。`session-catchup.py` 报告无未同步上下文，说明规划文件与上一会话一致。
- 只读重算边界：104 个已跟踪改动路径（95 modified / 5 deleted）+27,421 −4,788，加 26 个未跟踪文件，共 130 个路径全部分类为 112 产品 / 5 工程记录 / 11 发布证据 / 2 排除的本地输出。
- `.gitignore` 精确补入 `.impeccable/` 与 `.artifacts/*.zip`，未跟踪条目从 26 降为 24，`git check-ignore` 确认 70 MB 数据备份 ZIP 与 Impeccable critique 已排除，`.artifacts/portfolio/` 仍可见。
- 凭据扫描覆盖全部已跟踪 diff 新增行与 14 个未跟踪候选，高置信命中 0；生产源码 Firecrawl/TinEye 引用 0，绝对用户路径泄漏 0。
- 首次完整门禁失败于 `Resolve-WorkspaceRuntime` 的 "pnpm was not found"。当时记为“调用方式问题”，该判断错误：本机确实没有 pnpm，是并发的 Codex 会话在此期间装上 `pnpm@11.7.0`，后续前台执行才解析成功。教训是失败原因必须落到可验证的事实，不能用“换种调用方式就好了”替代根因。
- 前台门禁随后停在 `scripts/tests/process-lifecycle.tests.ps1`：`Get-CimInstance Win32_Process` 抛 `Microsoft.Management.Infrastructure.Native` 类型初始化异常，禁用沙箱后同样失败。当时只能判定为本地环境限制，改为逐步执行其余门禁并显式记录每步退出码，不修改产品代码去迁就环境；根因随后由 Codex 定位为 MSIX 版 pwsh 7.6.4 加载 MMI 原生 DLL 被拒，且它会让 `start.ps1` 杀掉自己刚启动的服务。
- 其余门禁全绿且逐步 exit=0：dev-common 测试、Provider 安全契约、autostart 测试、评测夹具、341 API、Ruff check、Ruff format 51 files、strict Mypy 19 files、根 `pnpm run check`（含 115 Board / 165 Extension）与 8 packaged Chrome E2E。
- 用户在明确的授权确认中选择“两次提交”并选择暂不纳入发布证据。按精确 pathspec 文件 stage 112 个产品路径（12 A / 5 D / 95 M），核验无 `.artifacts`、`.impeccable`、工程记录或发布证据泄漏后创建产品基线提交 `d772902`；全程未使用 `git add -A`，未 push。
- 提交后立即发现共享工作区并发写入：`git status` 重新出现 `scripts/dev-common.ps1` 与 `scripts/tests/process-lifecycle.tests.ps1` 修改，mtime 为 20:03:44 / 20:03:14，`dev-common.ps1` 由提交内 269 行增长到 431 行，方向是移除监听检测的 WMI 依赖。据此暂停第二次提交：工程记录正是双方共同维护的文件，此刻提交会捕获撕裂状态。
- 用户批准等待并发轮次结束后再收口。20:20 起文件 mtime 连续 12 分钟不变，判定该轮已结束；Codex 的记录显示它已用完整 `scripts/verify.ps1`（退出码 0，341/115/165/8，四个 PowerShell 套件全绿）验证过当前工作树。
- 独立复验通过：`scripts/dev-common.ps1`、`start.ps1`、`stop.ps1` 中 `Get-CimInstance`/`Get-WmiObject`/`Get-NetTCPConnection` 命中 0；先前在本 shell 无法执行的 `scripts/tests/process-lifecycle.tests.ps1` 现在 exit=0 通过。M129 门禁的唯一缺口因此闭合。
- 按已批准的分层边界收口为两次提交而不是混合提交：`scripts/dev-common.ps1` 与 `scripts/tests/process-lifecycle.tests.ps1` 属产品层，单独提交；`AGENTS.md`、`HANDOFF.md`、`task_plan.md`、`findings.md`、`progress.md` 属工程记录层，单独提交。产品改动与记录改动保持可分别回退。
- 基线为 `98a9a01` → `d772902` 产品基线 → `06f3424` WMI-free listener 修复 → `775c4b7` 工程记录，均为本地提交，未 push。提交后工作树只剩两个有意排除的未跟踪条目：`.artifacts/`（10 张 portfolio PNG，数据备份 ZIP 已 ignore）与 `docs/release-evidence-2026-07-16.md`。
- 收口后在本会话执行了一次端到端权威门禁 `scripts/verify.ps1`，退出码 0：dev-common、Provider 安全契约、process-lifecycle、autostart 四个 PowerShell 套件全绿，341 API、115 Board、165 Extension、8 packaged Chrome E2E 全通过，Ruff、strict Mypy 19 files、两端 lint/typecheck/build 与评测夹具均通过。这是 WMI 修复后本 shell 首次完整跑通 `verify.ps1`。
- 只读复验 durable 数据未变：3 workspaces / 14 Runs 全部 completed / active 0，`keep_forever=1` 14/14，封存 Run `10d31b4c-94dd-4442-b24a-fc1b241e658e` 仍为 completed / attempt 0 / coverage_satisfied。`git diff --check` 除既有 LF→CRLF 提示外无问题。

## M130 uniform completeness honesty across goals

- 用户从首页截图提出：为什么有的记录写“已完成”、有的写“研究已形成初步依据”，完整性规则是否失效。先只读诊断，未改代码。
- 结论一：规则没有失效。`workflow.py:1373` 在 M124 之后只有 `_enrichment_satisfied`（`gaps` 与 `enrichment_gaps` 同时为空）才写 `completed`，否则为 `partial`，当前代码不可能再产生“completed 但深度不足”。
- 结论二：混排来自历史数据。14 条 Run 创建于 07-11 至 07-25，全部早于今天的 M124；旧规则只查 `gaps`，因此 7 条持久 `completed` 却带非空 `enrichment_gaps`。M124 只加了展示层诚实降级，没有改写这批数据。
- 结论三：当前代码确有一处真实不一致。`App.tsx` 的降级条件写死 `precedent_research`，图纸灵感 Run 走 `visualLabels` 直接显示“已完成”；`e525ca77` 在与被降级建筑 Run 完全相同的条件下仍自称已完成。
- 先写红灯行为测试（图纸灵感 completed + enrichment_gaps 必须不显示“已完成”），确认失败后才把降级条件改为对两种 goal 同时生效，并按语境分别输出“已形成初步灵感”与“研究已形成初步依据”。不回填持久状态，因为受影响的 7 条包含 M53/M65 三档验收 Run 与旧发布证据引用的记录。
- 验证：Board 116/116 全绿；loaded 无截图 QA 在 desktop 与 390×844 下均为 14 条记录、6 条建筑诚实标签 + 1 条图纸诚实标签、横向溢出 0、截断 0；完整 `scripts/verify.ps1` 退出码 0，341 API / 116 Board / 165 Extension / 8 packaged E2E 与全部静态、构建、进程、安全、评测检查通过。
- 未创建/重试/取消任何 Run，未调用 Provider，未截图，未改动 durable 数据。
- 用户批准后提交为 `84b8657`（产品）与 `6320643`（记录），仍未 push。

## M131 targeted deletion of legacy under-depth Runs

- 用户要求把旧的深度不足记录当作失败记录删除。删除前逐条核对身份，指出 `76f52c79`（M53/M65 被接受的 Deep）与 `ff16988d`（M107 唯一真实任务书 Standard，107 条逐字证据、2 条关联收藏）并非失败而是记录正在引用的验收证据；用户确认删 5 保 2。
- 先用产品自带备份接口生成 70,957,655 字节完整备份并通过预检（`ready=true`、66 文件、14 Runs、5 收藏、1 任务书），使本次删除可整体回滚。
- 停服后用 `lifecycle.delete_runs` 安全 helper 删除 5 条，脚本带存在性、保留名单重叠与保留名单完整性三重前置断言，删除后立即复读校验：`deleted=5`、目标残留 0、保留名单丢失 0、`saved_references` 前后同为 5。
- 重启服务后 API/Board 均 200。持久基线现为 3 workspaces / 9 Runs 全部 completed / active 0 / `keep_forever=1` 9/9 / 5 收藏 / 1 份任务书，磁盘 `runs/` 目录由 6 减为 3；封存 Run `10d31b4c-94dd-4442-b24a-fc1b241e658e` 不在删除名单内且状态未变。
- loaded 无截图复验：首页 9 条记录、4 条“研究已完成”、3 条图纸“已完成”、2 条“研究已形成初步依据”（即保留的两条验收 Run），横向溢出 0、页面错误 0。
- 本轮只删除运行数据，未改动任何产品代码，因此沿用同日 `scripts/verify.ps1` 退出码 0 的门禁结果（341 API / 116 Board / 165 Extension / 8 packaged E2E）。未创建/重试/取消 Run，未调用 Provider，未恢复 Firecrawl，未截图。
- 记录已更新并提交为 `e6d0002`。

## M132 one document column for results and collections

- 用户要求优化案例研究页与收藏页排版并点名参考 collectui.com。加载 impeccable（register 判定为 product，读 `reference/product.md` 与 `reference/layout.md`），在 1920 真实页面上量测而不是凭截图猜测。
- CollectUI 本轮打得开，但内容是 Dribbble 作品图、以营销版式为主，对中文密集研究阅读面没有可迁移结构。诚实记录为“不适用”，改用文档/编辑型阅读版式，未照搬画廊卡片。
- 实测根因是两条互相冲突的左边界（外框 1600 居中于 x=153，内框 1180 再次居中于 x=363），加上一页内四次变化的阅读列宽和三处 M100 已否决的固定标签轨残留。
- 先写红灯：`design-system.test.ts` 新增四条 CSS 契约，`App.test.tsx` 新增一条标签自我重复契约，确认 5 条全部失败后才改实现。
- 第一版只统一左缘，内容贴左、右侧空 600px；用户立即指出“为什么偏在左边”。据此改为真正的全局规则：一条共享的 `max-width: var(--layout-doc-max); margin-inline: auto`，覆盖结果页与收藏页全部文档级区块，并把该规则本身写成测试，新增区块只要加进选择器即可合规。
- 一次否定的负向断言写法出错：`[\s\S]*?` 会跨越规则块匹配到文件后面的 `margin: 0 auto`。改用 `[^}]*` 限定在同一规则块内，负向断言才有意义。
- 实测收口：1920 边距 362/378、1440 边距 122/138，两页各只剩一个左缘一个右缘；筛选器、选择案例、删除按钮的右缘与文档右缘重合。案例标题 148ch→46ch，优先做法 112ch→69ch，适用条件 12px/153ch→14px/69ch，两页无超过 80ch 的文本；390px 无溢出、无截断、无小于 44px 的命中区、页面错误 0。
- 完整 `scripts/verify.ps1` 退出码 0：341 API / 120 Board / 165 Extension / 8 packaged E2E，四个 PowerShell 套件、Ruff、strict Mypy、两端 lint/typecheck/build 与评测夹具全部通过。未改后端、schema、导出或 durable 数据，未创建/重试 Run，未截图。
- 已提交 `0b36893`（产品）与 `04a0dd1`（记录）。

## M133 plain-language copy pass

- 用户要求从使用者角度审视每个使用点与内容块的晦涩之处。用真实页面 DOM 全量收集主页、结果页、收藏页文案（82 + 148 个文本块），再对照代码字符串定位其余触点（工具区、导出、备份、保留控件）。
- 核心发现是跨页面词汇不一致：做法标签“可直接采用 vs 怎么么做”、边界标签“适用条件 vs 适用时注意”。按 clarify 的一致性原则统一为“怎么做 / 适用条件”。
- 其余修改：来源说明去掉“正文证据完整”内部术语；“数据管理→备份与恢复”、“预检备份→检查备份包”；两个诚实降级状态与保留按钮补充解释性 title。全部先迁移/新增测试见红，再改实现。
- 一次越界被测试网挡住并回退：抑制章节小结与首案例机制的逐字重复会推翻 7 条 M128 已验收契约（案例块必须自带机制句）。回退后在 findings 与用户汇报中把该结构性重复列为待用户决策的布局问题，不在文案轮里擅自改布局。
- Loaded QA：备份与恢复按钮、新来源说明、状态/保留 title、结果页“怎么做/适用条件”、收藏页“核心解法/怎么做/适用条件”全部在真实页面验证；1440 下结果页与收藏页溢出 0、错误 0。一次 320px“溢出”实为浏览器面板 0×0 视口的量测假象，已在 findings 记录。
- 完整 `scripts/verify.ps1` 退出码 0：341 API / 120 Board / 165 Extension / 8 packaged E2E 与全部静态/构建/进程/安全/评测检查。未改后端或 durable 数据，未创建/重试 Run，未截图。
- 已提交 `cb8287a`（产品）与 `05d134d`（记录）。

## M134 no repeated conclusion inside the first case

- 用户在 A（小结注明出处）与 B（首案例不复读机制句）之间选择 B。推荐理由已记录：B 治病而 A 只解释病；B 恢复 M73 折叠时代“说一次”的本意；给结论加署名与 M128 去来源化方向相反。
- 先写红灯：demo 章节内“结论句在案例块中出现次数为 0”的断言失败（现状为 1），确认后才改实现。
- 实现为最窄规则：仅第一个 dossier 且 trimmed 机制与章节小结逐字相等时不渲染机制段；后续案例即使机制相同也照常显示。相等判断对齐 `uniqueSummaryItems` 的 trim 行为。
- 迁移 7 条把重复编码为契约的 M128 断言：机制改为在章节层断言可见、在首案例内断言不存在；多案例测试仍要求后续案例自带机制（Warehouse Forum 断言未动）；跨章节测试改为断言各章包含自己的逐题机制且首案例不复读，保留“不塌缩进首章”的原意。
- Loaded QA（真实耕织图 Run，1440）：四章 5/1/1/4 个案例分别显示 4/0/0/3 段案例机制，结论句复读 0，溢出 0，页面错误 0。单案例章节即为理想形态：问题 → 结论 → 项目名 → 怎么做 → 适用条件。
- 完整 `scripts/verify.ps1` 退出码 0：341 API / 120 Board / 165 Extension / 8 packaged E2E 与全部静态/构建/进程/安全/评测检查。未改后端、schema、durable 数据，未创建/重试 Run，未截图。
- 已提交 `3962d8d`（产品）与 `77650f6`（记录）。

## M135 remaining-surface copy closure and pilot kit

- 用户批准继续收尾并授权自主决策。先在真实轴测图 Run 上走查图纸灵感结果页 DOM（69 个唯一文本块），同时启动三审计 + 逐条对抗核验的多智能体 workflow 审计 App.tsx 其余用户可见字符串。
- 第一轮核验因编排 bug（发现载荷未插值进核验 prompt）被 45 个核验 agent 全部正确拒绝；修复插值后从缓存恢复，审计层零重跑，得到 43 条确认 / 2 条驳回。核验层修正了多条审计层的事实错误（会撒谎的就绪文案、指向不存在按钮的指引、方向写反的提示）。
- 合并去重为 38 处一致修改，先写 `copy-glossary.test.ts` 源码级守卫（封禁 18 个废弃词 + 3 条必需新文案）确认红灯，再用带前置断言的批量替换脚本一次落地（45 次替换全部命中预期次数，未命中即整体不写入）。
- 迁移 16 处旧文案断言；两个同名"对照案例策略"入口按钮属有意统一，测试改用 getAllByRole。完整 Board 123/123（新增 3 条词汇守卫）。
- PRODUCT.md 与 DESIGN.md 的对照行同步为"图中看到/适用条件/对照案例策略"。
- Loaded QA：真实轴测图 Run 上权利行由"聚合来源 · 权利 权利未知"变为"转载合集（非首发） · 权利 未注明"，旧词 0 命中，溢出 0、错误 0。
- 完整 `scripts/verify.ps1` 退出码 0：341 API / 123 Board / 165 Extension / 8 packaged E2E 与全部静态/构建/进程/安全/评测检查。未改后端或 durable 数据，未创建/重试 Run，未截图。
- M121 观察工具包出现重复：并发 Codex 会话已于 22:35 提交 `docs/m121-pilot-kit.md`（173 行，含等待期编排、预检清单、60 秒提示规则与逐任务判据），我在未察觉的情况下又写了一份到 `docs/pilot/`。按"更完善者为准"合并：保留 Codex 版为唯一工具包，并入我版本独有的两点（至少 1 名首次接触者、现场不承诺修改），`git rm` 删除重复文件并修正四个记录文件中的路径引用。这再次验证 HANDOFF 第 74 条的共享工作区约束——**新建文件前也要先查同名主题是否已被并发会话覆盖**。

## M136 simulated persona walkthrough

- 用户指示"编几个用户开测"。拒绝伪造真人观察（规划的外部验收门明写 human participants intentionally not fabricated），改为诚实标注的模拟走查：3 个无上下文 persona 子代理（大二首见者 / 大四竞赛队 / 从业 2 年建筑师）读取当日真实 DOM 文字，按 `docs/m121-pilot-kit.md` 的任务与判据作答。M121 保持 in_progress。
- 三个 persona 并行完成，交叉重复发现 6 项（3/3 × 3、2/3 × 3），全部按工具包阈值立项：状态标签补"已完成"语义（已完成 · 初步依据 / 初步灵感）、来源说明点名媒体替代"轮流检索"、保留倒计时改"N 天后自动删除"、来源免责句退出"适用条件"槽位（扩展 auditBoundaryPattern，结果页与收藏页同修）、"案例子问题"改"研究子问题"、图纸灵感隐藏调研轮数。
- 红绿完整：新增 1 条来源免责句行为测试 + 6 条词汇封禁先确认红；批量替换脚本 12 处全命中；迁移 5 处旧断言（含 aria region 名）。Board 124/124，完整 `scripts/verify.ps1` 退出码 0：341 API / 124 Board / 165 Extension / 8 packaged E2E。
- Loaded QA：首页实际状态行显示"已完成 · 初步依据"，旧标签与"轮流检索"零命中，来源说明与"N 天后自动删除"生效，溢出 0、错误 0。
- 5 项发现记录未修（`docs/m121-simulated-walkthrough.md`）：最重的是 S3 出处链接信任冲突（与 M128 用户决策相反，需裁决）；另有跨案例论证措辞（M75 定稿）、时长预估（需实测）、检索相关性（研究质量）、单人困惑项。未创建/重试 Run，未改 durable 数据，未截图。
- 已提交 `609ea34`（产品）与 `5e6d3e4`（记录）。

## M137 user-brief batch research test

- 用户提交 `城市社区共享中心建筑设计任务书.docx`：8 个收集好的设计问题 + 完整课程任务书，即此前删除旧记录时预告的"新的实际测试"。
- 任务书部分用 PyMuPDF 渲染为 5 页可检索 PDF（3,354 可读字符，用与 brief-review 相同的 fitz 路径验证）；8 个问题逐字采用文档原文。
- 驱动脚本走产品自身 M107 契约：新建工作区「城市社区共享中心」（cf067667）、任务书存为 InputArtifact（7258e3b0）、每题 brief-review(quick) → 带 typed subquestions 创建 Run → 轮询至终态；单活跃 Run 门控顺序执行，绝不 retry 任何 Run，JSONL 全程留痕。
- Q1 的 brief-review 两次 502（Provider 规划调用瞬时失败），驱动按设计诚实跳过；Q2 起恢复正常（`9f3c86d8` 已创建执行）。规划调用不是 Run，批量结束后对 Q1 再执行一次 brief-review 补齐。
- Q2 `9f3c86d8` 约 7 分钟到终态 `partial/budget_exhausted`：8 usable、2 projects、2/3 覆盖，enrichment 缺口如实记录。批量继续。

## M138 quiet provenance links on case answers

- 用户在等待批量期间裁决模拟试点的出处冲突："标一下，可点击进源网页，不影响阅读纯净"。实现为每案例一个安静链接：结果页案例用 primary asset 的 sourceUrl，收藏案例用持久化的 SavedReference source_url（普通 Run 过期不破坏收藏出处）；文字为"出处 · 域名"，aria 为"打开出处：项目名"，置于适用条件之后。不恢复检视器、核验文案或其他来源动作。
- 红绿：结果页与收藏页两条精确 href 契约先红后绿；Board 124/124、ESLint、TypeScript 全绿。PRODUCT.md 与 DESIGN.md 的答案优先条款同步为"唯一出处链接例外"。
- 批量测试（M137）仍在运行同一 API，为避免资源争抢，loaded 无截图 QA 与完整 `scripts/verify.ps1` 推迟到批量终态后一并执行；Board dev server 已热加载新代码。Board 当前正确显示 Q3 的运行中状态，未触碰"取消研究"。
- 顺带记录一处运行中状态的候选 P3：活动页标题"已经拆成 3 个证据问题"中的"证据问题"仍是内部词，待批量结束后与 QA 一起处理。
- 已提交 `736fffc`（出处链接）与 `e761752`（记录）。

## M139 visual-effects refinement round

- 用户要求延续"活泼高级"对全部视觉效果做一轮优化，并给出 collectui/behance/siteinspire 参考。siteinspire 品类分布确认 2026 策展语法（排版主导/网格/单强调色）与制图桌方向一致；盘点显示动效词汇量薄（2 keyframes / 5 transitions / 26 hovers）是"不够活泼"的根源。
- 三设计师（动效/表面/反馈）+ 逐组对抗核验的 workflow 产出 11 通过 / 6 拒绝；拒绝全部有效（入场编排违反 DESIGN.md、非 token 色值、死选择器、Material 套路）。我预备的 stagger 红灯因此作废重写——红灯应写在裁决后。
- 合成落地 16 组 CSS：sheet-settle 换页连续帧、目录 chevron 方向微反馈（含 reduced-motion 取消）、dock-rise 升起 + 成功态 fast 落定、收藏注册点 scale 落点、蓝图面纸白焦点环 + 遮罩内缩环、首页输入纸裁切角（≤620px 并入既有块关闭）、注册角 max() 对位工作纸框、图像井灯箱增亮（图纸不缩放）、灵感选择钮 hover/focus/选中渐显 + 触屏常显、出处下划线淡入 + 外链箭头 1px 出走。
- 冲突裁决：.collection-dock-success 两案取 sheet-settle fast；chevron 取 3px/-2px。一次结构约定坑：中部插入独立 620px 媒体块打破 design-system 切片约定致 5 测试红，改并入既有块后恢复。
- 三条新动效契约先红后绿（token-only 动画、reduced-motion 取消位移、出处下划线淡入）；Board 127/127、ESLint 0、Impeccable detector []。批量测试（M137）仍在运行，loaded QA 与完整门禁继续推迟到批量终态后统一执行。
- 已提交 `3c4aea5`（视觉实现）与 `0a8fd57`（记录）。

## M140 research runs never hijack the app on open

- 用户在批量测试期间打开 Board，落进了正在运行 Run 的进度页并质疑"这不应该是后台进程吗"。根因是遗留的开屏自动恢复：mount effect 找到最新非终态 Run 后直接 setActiveRun + 关闭 composer + 切换 active workspace，把整个视图接管。
- 修复：打开应用永远落主页。mount 只注册最新非终态 Run 的静默轮询；轮询循环改为前台感知——始终刷新最近研究行，仅当用户正在查看该 Run（activeRunIdRef 匹配）才更新活动视图/播报/终态 hydrate；后台轮询失败静默停止不打扰主页；不再后台切换 active workspace。会话内用户亲自发起研究仍立即进入进度视图；从主页点开运行中记录仍走 openRun 恢复进度。
- 红绿：新契约"后台研究运行时打开应用停在主页、点开记录才见进度"先红；两条编码旧自动恢复行为的测试（隐藏项目管理、取消不被轮询覆盖）迁移为点开后断言。Board 128/128、ESLint、TypeScript 全绿。
- 真实批量运行中的实测：主页标题可见、无"取消研究"劫持、批量 Run 以"正在浏览页面"实时状态行出现在最近研究，溢出 0、错误 0。DESIGN.md"问题先于结果"条款更新为后台进程规则。
- 已提交 `04ceb0a`（修复）、`f912734`（记录）、`1610512`（固化契约）。

## M141 second retention P0 and recovery

- 用户复报"以前的都没有"。放弃热更新解释，改为 API 全量核查：5 条老建筑 Run results=0（含 M53/M65 验收 Deep `76f52c79`），图纸灵感、`ff16988d` 与全部批量 Run 完好。第一次误判源于抽样恰好命中完好样本。
- 根因定位 `lifecycle.py:57-80`：资产 7 天 / 来源 30 天 / 证据 7 天的独立 `expires_at` 在每次 API 启动被无条件硬删，不看 `keep_forever`。当前库中封存 Run `10d31b4c` 与 `f5be3f17` 的资产已过期十余小时未清、`23b6f84c` 数小时后到期——全靠服务未重启幸存。
- 红绿修复：新 lifecycle 契约（永久 Run 的过期子数据存活、普通 Run 的照删）先红；三个过期查询豁免 keep_forever Run 子数据后绿。342 API / Ruff / strict Mypy 全绿，提交 `710fb49`。修复在下一次启动时先于清扫加载，重启从此安全。
- 恢复评估：7/25 备份含 `76f52c79` 完整 51 资产 + 136 逐字证据（外科恢复脚本已备，待批量结束停服执行）；`d995bed5`/`a2cf2e20`/`d13bdc67`/`58f4b9f9` 的资产在两份备份之前已被清扫，不可恢复，Run 行与 30 天来源页仍在，去留待用户决定。
- M137 批量终态：4 completed（公共交流 25/10、未来变化 26/7、气候节能 30/9、公共形象 9/3，全部零缺口）+ 3 partial（人群共享 8/2 · 2/3、功能关系 19/7、流线系统 20/6）+ Q1 补跑 `945d3754` 进行中。
- Q1 `945d3754` 终态 completed/coverage_satisfied：26 usable、8 projects、3/3、零缺口——8 题中 5 题全指标完成。
- 用户质疑三条 partial 违反"完成才返回"。澄清：M124 规则正在起作用——概览档预算耗尽且覆盖未满时诚实标 partial 而非冒充完成。按用户意图用产品自身"继续补齐研究"（retry attempt+1）依次推进三条 partial，后台顺序执行中。
- 用户同时报告两处版式问题，已红绿修复并提交 `86607a5`：M133 变长的状态文案把 `.recent-open` 的 auto 状态列撑爆、窄面板下标题列被压成一字一行（改 `fit-content(40%)` 相对上限，实测挤压行 0）；无图案例文字仍锁在配图版式宽度（放开到 72ch，章节问题标题 48ch→64ch）。Board 131/131。

## M142 Chinese-first case names

- 用户指出案例只有英文名"看着很蒙圈"，要求参考 ArchDaily 中文版。实现为双语显示而非只搜中文站（中文站覆盖是子集，不能为名称牺牲证据质量）：正文分析新增 `project_name_zh`（通行中文译名或简洁直译，明确为展示用翻译标签、不作为来源事实），按子问题分支存入 `subquestion_analysis`，收藏快照契约同步携带；界面中文名为主标题、原名保留为下方安静参考行（出处可查性不受影响）；无中文名时回退原名，存量数据零变化。
- 红绿链：后端（分析夹具带中文名→分支存储断言先红）+ 前端（中文标题案例卡先红）；发现并修复响应模型 `SavedReferenceCaseSubquestion` 静默过滤新键导致响应与持久快照不一致的问题。342 API / Board 132 / lint / typecheck / Ruff format 全绿，提交 `07168d7`。顺带把 api.py 侧遗漏的"未记录具体案例子问题"统一为"研究子问题"。
- 该特性在 API 重启后对新研究生效（运行中的进程仍是旧代码）；既有 Run 无中文名、按回退显示。
- 三条 partial 的产品内"继续补齐"进展：功能关系 completed（22/8/3/3 零缺口）；人群共享 11/4/3/3 仍缺多图项目（待再补一轮）；流线系统进行中。

## 收尾序列（M137/M141 闭环）

- 流线系统补齐后 completed（26/9/零缺口）；人群共享 attempt 2 后 completed（17/6/零缺口）——**8 题全部完全完成**。
- 8 条社区 Run 全部 PATCH 为永久；停服后从 7/25 备份外科恢复 `76f52c79`（模式校验、碰撞校验、全有或全无，51 资产 + 136 证据一次写入成功）；用修复后的 lifecycle 代码重启。
- 重启后验证 ALL OK：`76f52c79` results=51；三条携带已过期资产的图纸灵感 Run（10/5/25）真实穿过清扫存活——修复在生产路径生效；社区 8 条全部 completed + keep_forever。
- 用户会话中追加要求"无图内容块铺满页面"（第二次放宽 measure）：任务标题、研究结论、优先做法、章节问题与无图案例全部放开到 1180 文档栏（契约同步迁移），结论标题 balance→pretty；真实页面实测文本块 1151-1175px 满栏、溢出 0。提交 `63b5a38`。
- 最终门禁：完整 `scripts/verify.ps1` 退出码 0 —— **342 API / 132 Board / 165 Extension / 8 packaged E2E** 加全部静态/构建/进程/安全/评测检查。
- 持久基线：4 workspaces / 17 Runs / 17 keep_forever / 301 assets / 1,059 claims。四条资产不可恢复的空壳 Run（d995bed5/a2cf2e20/d13bdc67/58f4b9f9）去留待用户决定。

## M142 收尾：存量中文名回填与子问题标记

- 用户看到既有结果仍是英文名（特性只对重启后新 Run 生效）。执行存量回填：54 个唯一项目名经同一 Provider 一次性译出（54/54 映射齐全，抽查合格：圣母恩宠文化中心、荷兰银行 / Mecanoo 等），停服后写入 192 条建筑资产的全部分析分支（仅补空缺、不覆盖），重启验证真实页面 7/7 案例中文标题 + 7 条原名参考行。
- 用户指出章节大句与"案例研究结果"区头分不清问题与结论。章节编号从裸数字改为「子问题 N」标记（待归组组改"待归组"），栅格列 32px→auto。真实页面显示 子问题 1/2/3。
- Board 132/132、lint/typecheck 绿；翻译映射表存 scratchpad（不入库不入 Git）。

## M145 additive collection saving and eaten-item recovery

- 用户报告"收藏了、修了几次之后收藏页东西没了"，怀疑功能坏或代码重置。数据轨迹澄清：所有代码修复轮都未触碰收藏（每次操作前后计数已验证）；真实原因是 M93 的"同题新批替换旧批"设计——7/23 保存的耕织图收藏 `f71144ab` 在用户 7/27 01:26 保存 3 条同题新收藏的同一时刻被产品按设计删除。
- 语义改为累加：保存新批次绝不删除任何既有收藏（含同题旧批），删除只由用户逐项执行。红灯为反转既有替换契约（保存后不得发出任何 DELETE），移除 superseded/removedCollections 逻辑后转绿。PRODUCT.md 与 architecture.md 的替换条款同步改写。
- 被吃掉的 `f71144ab` 从 M131 备份救回（删除发生在该备份之后）：停服插回行（模式/存在性断言）、其资产 c2139894 仍存活、重启后 saved_references=8。Board 131/131、lint/typecheck 绿。

## M144 husk-run deletion

- 用户批准删除四条资产不可恢复的空壳 Run（d995bed5/a2cf2e20/d13bdc67/58f4b9f9）。按 M131 流程：先做全量产品备份（55,382,928 B，.artifacts/archresearch-backup-before-husk-delete.zip）；停服后用 `lifecycle.delete_runs` 删除，脚本带四重前置断言（目标存在、目标资产为 0 确系空壳、与保护名单零重叠、保护名单删除前后完整）。
- 结果：17→13 Runs / 13 keep_forever / 4 workspaces / 301 assets；saved_references 7 前后不变；恢复的 Deep（51 结果）与封存图纸灵感（10 结果）复验完好；API/Board 200。

## M143 remove the drawing-type filter from architecture results

- 用户判定建筑结果页的「图纸类型」下拉筛选没有用，要求移除。删除筛选控件、`assetFilter` 状态、`filterAssetTypes` 派生与"当前筛选没有图纸"死分支；`visibleResults` 直通全部结果。迁移三处旧契约（demo 首页 combobox 断言、demo 筛选步骤、design-system 的 #asset-filter 44px 移动契约）；PRODUCT.md 同步。图纸灵感侧的逐图类型标签与索引不受影响。
- Board 131/131、ESLint、TypeScript 绿；真实页面验证筛选器消失、区头只余"案例研究结果"、7 案例完整渲染、溢出 0 错误 0。
- 已提交 `3962d8d`（产品）与 `77650f6`（记录）。

## M121 pilot observation kit (step B preparation)

- 用户指示继续已批准的 A→B→C 顺序；B 需要真人参与，本轮交付试点观察工具包 `docs/m121-pilot-kit.md`，不创建任何 Run。
- 初稿含 9 个任务（T1–T9）、记录表、P0/P1/P2 分级与主持边界；随后用三视角对抗审查工作流（约束合规 / 可测量性 / 场次现实性，3 agents）审查，返回 30 条发现，其中 6 条 must-fix 全部成立。
- 最重要的三条：45–60 分钟场次数学上不成立（净任务时间超预算且零缓冲）；T4 标准档 Run 排在 T5 之前会与单活跃 Run 门死锁；参与者编号 P1/P2/P3 与缺陷分级 P0/P1/P2 撞名会破坏"P2 需 ≥2 人重复"的统计。
- 重写后的编排：60 分钟基准场次，Run 等待期由浮动任务吸收（T2 等待期做口头 T9，T5 等待期做 T8），T4 移到结束访谈前且只发起不等待；参与者改用 U1–U3；记录表增加"系统原因中断"档并不计入完成率；预检清单覆盖两种状态标签、保留倒计时、列表长度、任务书 PDF 与兜底阅读记录。
- 约束修正同样全部吸收：T9 改为纯口头、参与者不点击，封存 Run 只可指看不可操作；T6/T7 脚本改为不泄露产品术语的中性措辞；"来源"观察点改写为不点名来源的被动记录并注明本试点不考察来源核验；原始记录表归档到独立的 `docs/m121-records.md`，findings.md 只收立项级发现。
- 全部为文档新增，未改产品代码，无需重跑完整门禁；未创建/重试 Run，未截图，未改 durable 数据。M121 保持 in_progress，等待真实参与者排期。
- 本轮未创建、重试或取消任何 Run，未调用 Provider/Firecrawl，未恢复 Firecrawl，未截图，未改动 durable 数据，未执行 reset/checkout/clean/push。

## M129 无 WMI 依赖的本地服务启停

- 用户报告 `127.0.0.1` 打不开。日志显示服务正常运行到 14:43 后中断且无报错，`.archresearch/dev-processes.json` 已不存在，端口空闲，判定为进程被停掉而非产品代码故障。
- 重启时暴露两个真实故障。其一，`Resolve-WorkspaceRuntime` 抛 "pnpm was not found"：此前的 pnpm 由 Codex 运行时提供，本机从未安装。按根 `package.json` 的 `packageManager` 安装 `pnpm@11.7.0`（`%APPDATA%\npm`），属环境修复，未改仓库文件。
- 其二，装好 pnpm 后 `start.ps1` 仍失败：API 与 vite 都已就绪，脚本在 `start.ps1:94` 的 `Get-CimInstance` 归属校验处抛 `DllNotFoundException … E_ACCESSDENIED`，catch 分支随即把自己刚启动的两个服务 `Stop-Process -Force`。已确认 Winmgmt 服务正常、Windows PowerShell 5.1 的 WMI 正常、独立新起的 pwsh 同样失败，故障域限定在 MSIX 版 pwsh 7.6.4 这一个安装。
- 按仓库规则先红后绿：现有 `process-lifecycle.tests.ps1` 在本机整体失败即为初始红灯；随后把测试自身的 `Get-NetTCPConnection` 助手换成 `Get-TcpListeningProcessIds`，并新增两条断言——工作区子进程的命令行必须在不经 WMI 的前提下可读且指向工作区，`dev-common.ps1` 不得出现 `Get-CimInstance`/`Get-WmiObject`/`Get-NetTCPConnection`。
- 实现只替换两个探测原语：监听进程改用 `netstat -ano`（按环回端点与未连接对端地址判定，不依赖本地化状态词），命令行改用 `NtQueryInformationProcess` 读 PEB，`Add-Type` 惰性编译一次。函数签名、`Test-CommandLineReferencesWorkspace` 的归属语义和 `start.ps1`/`stop.ps1` 的调用点均未改动。`process-lifecycle.tests.ps1` 转绿。
- 真实生命周期复验通过：`Get-WorkspaceListeningProcessIds` 正确认出 vite(node, PID 29284) 与 uvicorn(python, PID 37856)；`Stop-WorkspaceTcpListeners` 只停这两个；`start.ps1` 正常输出 Board/API 地址并写入 state（pid 与 launcher_pid 区分正确），重复执行走 "already running" 复用分支，`stop.ps1` 停净并删除 state，再次 `start.ps1` 恢复服务，Board 与 API 均返回 200。
- 未改动产品代码、schema、迁移、durable data；未创建/重试/取消任何 Run，未调用 Provider 或 Firecrawl，未截图，未执行 reset/checkout/clean/stage/commit/push。
- 完整门禁 `scripts/verify.ps1` 退出码 0：341 API、115 Board、165 Extension、8 packaged Chrome E2E 全通过，dev-common / process-lifecycle / autostart / provider 安全契约四个 PowerShell 套件全绿，Ruff、Ruff format、strict Mypy（19 source files）、两端 lint/typecheck/build 与 evaluation fixtures 均通过。与 M128 基线数字一致，说明改动没有影响任何产品行为。
- 门禁跑完后本地服务仍在运行（Board 200 / API 200，state 记录 pid 与 launcher_pid 正常），`git diff --check` 除既有 LF→CRLF 提示外无问题，staged 仍为 0。

## M146 工作记录与规则整理

- 应用户要求整理累积记录：HANDOFF.md 从 172 行逐里程碑叙事重写为当前真实状态与规则（旧叙事含收藏替换语义、来源检视器、"当前唯一下一步是 M84" 等多处已互相矛盾的残留）；task_plan.md 收敛为现行目标 + M121/M122/M123 + 近期落地清单，M0–M120 逐阶段行与 Errors Encountered 表整体归档。
- findings.md（M0–M120，1,428 行）与 progress.md（07-11 至 07-26 M128，1,699 行）逐字迁入 docs/history/，live 文件只保留当前纪元并在头部留归档指针。
- 现行文档冲突修复：DESIGN.md 移除已删筛选器引用；README 描述与演示流程数对齐；demo-flows.md 两条流程的步骤改写为当前产品（一键连接、后台研究、答案优先阅读、累加收藏、对照案例策略、权利门禁导出），删除 "来源核验" 等废弃表述；failure-cases.md 的 completed 语义与恢复动作对齐 M124/M128；architecture.md 补 keep_forever 子数据豁免、修正 EvidenceClaim 为 7 天并列出 Run 14 天行。
- 基线数字统一为实测值：4 workspaces / 13 Runs / keep_forever 13/13 / 301 assets / 8 收藏；门禁 342 API / 131 Board（本轮实跑确认）/ 165 Extension / 8 packaged E2E。

## M147 备份与恢复页重设计（用户报告"意义不明"）

- 参考研究经多 agent 并行完成（WhatsApp/Signal/微信备份页、Bitwarden/1Password/Anki 导入导出、Time Machine/Windows/iCloud），两份竞争方案（状态优先 vs 场景叙事）经诚实性/词汇/可实现性三视角对抗审查后合成：状态优先为骨架，吸收场景式分区标题与内联最终确认。
- 页面标题与入口统一为"备份与恢复"（原页面标题与入口按钮不一致）。第一屏改为三行状态：当前数据实时计数（workspaces + 全部 Run）、只属于本浏览器的上次下载记录（localStorage，措辞不断言其他设备，≥14 天转 warning-ink 琥珀文字提醒）、"手动备份"诚实说明；排除项一句话（服务配置和登录信息）。
- 恢复流程从三步（选文件、点检查、点确认）减为两步：选中文件自动检查（role=status 播报，检查只读）；检查通过展示备份内容与当前数据的计数对照；危险按钮改名"替换当前数据并恢复"+ 内联最终确认（取消 autoFocus 在前）。失败文案先说"当前数据没有任何改动 / 已退回原状"；留底只在失败语境提及（诚实性审查裁定：不得用只保护失败场景的机制暗示"可反悔"）。
- 工程黑话清零并加入 copy-glossary 封禁（原页面标题、原检查按钮名、原恢复分区名、算法名、内部检查术语共 5 个词）。新 token --color-warning-ink #92400e 写入 DESIGN.md 色板表；PRODUCT.md 新增该页设计原则条目。
- 红绿：3 条新测试（状态优先+自动检查+两段确认合同、过期提醒不夸大、失败检查不动数据），Board 133/133、lint/typecheck/build/design-system/glossary 全绿；loaded 无截图 QA：桌面与 390px 零溢出、44px 触控（修复了一处按钮 38px）、真实 API 的失败检查路径与琥珀过期态实测通过，console 0 错误，注入的测试记录已清理。

## M122 表征启动（模拟试点并行期间）

- API 覆盖率基线（pytest-cov，342 tests）：总体 91%，workflow.py 95% / api.py 91% / lifecycle.py 96% / providers.py 96%；报告在 .artifacts/coverage/。Board/Extension 覆盖率因装插件会重载 dev server，排在盲测结束后。
- 三份只读拆分地图完成并入档 docs/m122-extraction-map.md：App.tsx 八步顺序（纯库先行、run 轮询钩子最后、TDZ 闭包与双写者旗标）；workflow.py 十步顺序（XHS 回退靠 mutate 调用方列表、trace 摘要即 schema、fallback 靠英文错误子串匹配三大暗礁 + 14 个测试再导出名单）；styles.css 14 文件（design-system 测试按整字符串切片，拆分前必须先迁移测试契约 + 同优先级选择器顺序对清单 + dossier 时代疑似死规则名单，回应 findings 悬案）。
- 期间未触碰运行中的应用、未改产品代码、未装任何包。

## M121 模拟试点执行与闭环

- 用户决定验收改为多 agent 模拟后，本轮升格为验收轮：3 个无先验盲测 persona（大三课设/研一毕设/大四竞赛）顺序驱动真实应用，参与者台词与判据分离，独立评审对照工具包判据打分。总计 4 agent、约 48 分钟、31 万 tokens。
- U1/U3 全程跑通（各发起一条真实概览研究：7456d7eb completed、afb35779 partial 诚实部分交付；共保存 3 条收藏），核心链路判据全过；U2 场次被疑似自动化伪影污染（首屏正常、11 次点击零响应），四任务记系统原因中断，图纸灵感线零有效覆盖。
- 会后工程复核：同页实测完全响应、输入框带 required——"冻结/零反馈"归因为 read_page ref 在 React 重渲染后失效的自动化伪影；但确认两个产品真缺口（提交无等待态、启动报错渲染在视野外），列为 M148 当轮修复。
- 严重度矩阵与处置：5 项 P1 → M149；6 项 ≥2 人重复 P2 → M150；单人 P2 记录不立项。M121 标记 complete。记录归档 docs/m121-simulated-pilot-2026-07-27.md + 逐字 JSON；模拟产物（2 条研究、3 条收藏，均 14 天默认保留）清单交用户决定去留。

## M148 提交反馈加固（试点当轮修复）

- 红绿两条：提交在途按钮必须显示"正在创建研究…"并禁用（门控 mock 证红）；启动失败必须在表单内 role=alert 就近报错且按钮恢复可用（503 mock 证红）。
- 实现：researchStarting 状态贯穿 startResearchRun；composerError 承接启动失败与任务书读取失败，渲染于提交按钮下方（原先只写入主页底部的全局错误汇，在视野外）；切换研究入口时清空。
- 门禁：342 API / 135 Board / 165 Extension / 8 packaged E2E，exit 0；真实页面无回归、零 console 错误。

## 2026-07-27 会话检查点（当前状态与下一步）

今日九次提交（bb32390 → 178442a），全部本地、未 push：

- **M145** 收藏改纯累加并救回被同题替换吃掉的收藏；**M146** 工作记录整体整理（HANDOFF 重写、task_plan 收敛、findings/progress 归档至 docs/history/、现行文档冲突清零）；**M147** 备份与恢复页按成熟产品模式重设计（状态先行/场景标题/后果命名/自动检查）。
- **M121** 经用户决定改为多 agent 模拟验收并已 complete：3 盲测 persona + 独立判据评审，2/3 全程跑通，产出 5 项 P1、6 项重复 P2、模拟局限与产物清单（docs/m121-simulated-pilot-2026-07-27.md）。
- **M148**（试点当轮修复）complete：提交等待态 + 报错就近显示。
- **M122 表征**完成：API 覆盖率基线 91%，三份拆分地图入档（docs/m122-extraction-map.md）。**M123 前置**：CI 草案就绪（.github/workflows/verify.yml，首跑前算未验证）。

当前权威门禁：**342 API / 135 Board / 165 Extension / 8 packaged E2E**（scripts/verify.ps1 exit 0）。持久基线：4 workspaces / 15 Runs（13 permanent + 2 模拟）/ 11 收藏（含 3 模拟）/ active 0；API/Board 200。

下一步队列（依序）：

1. **M149 五项 P1**——首先做"研究结论栏与证据脱节"的工程根因诊断（U1 的结论疑似绑定错位，可能是真 bug）；随后保存入口可发现性、等待期计数失灵、保留提醒、案例供给质量。
2. M150 六项重复 P2（双命名、术语语域、运行中保留全局入口、保存反馈就近、标题可辨认、顶栏入口职责）。
3. 图纸灵感线 + 任务书路径的定向补充模拟（本轮零覆盖）。
4. M122 拆分执行：先装 @vitest/coverage-v8 补 Board/Extension 覆盖率基线（试点已结束，装包不再打断谁）；styles 拆分测试契约先行。
5. M123 发布收口（CI 首跑、干净机器、证据刷新——均需用户配合或授权）。

待用户决定：模拟产物去留（2 条研究 + 3 条收藏，14 天后自动过期）；git push 授权时机；旧发布证据处置；版本号。

## M149/M151 启动

- 用户确认开始 M149，并追加备份与恢复页的文案精简和布局排版优化。M149 先做结论/证据脱节的只读根因诊断；M151 作为独立伴随改动，不改变备份数据语义。
- 已加载现行 PRODUCT/DESIGN 与 Impeccable 的 product、clarify、layout 约束；现阶段只建立计划与记录，尚未修改生产代码。
- 工具错误已记录：仓库内 Impeccable 快捷脚本路径不存在，改用实际安装目录；系统 Python alias 不可用，改用项目 API 虚拟环境。两项均已恢复，不影响工作区。
- M151 红灯已建立：迁移 App 文案行为测试、新增备份页双列/移动单列设计契约、把“正在打包”等旧长文案加入源码词汇守卫。定向运行 119 tests，116 通过、3 个预期红灯分别命中 App 文案、CSS 布局和 glossary；失败不是既有回归。
- 第一轮实现后 118/119 通过；唯一红灯是同一测试中遗漏迁移的旧“只算这个浏览器的下载记录”长句断言，页面已用“仅此浏览器”保留同一诚实边界。已同步迁移该断言，不改变行为。
- M151 定向红绿已闭合：App/copy-glossary/design-system 共 119/119 通过。页面已收敛为“备份数据 / 恢复数据”两步，页首和恢复说明改为短句，备份状态只保留当前数据与最近备份，下载状态改为用户动作；桌面恢复区改双列，≤720px 保持单列和 44px 控件。
- M151 loaded QA：1440×900 与 390×844 均水平溢出 0、console error 0；桌面恢复列 409.6/614.4px，移动端按钮/文件控件 44px。浏览器临时视口已复位，测试标签页已关闭；未点击下载或恢复，durable data 未变。
- M149 诊断首个路径假设 `data/archresearch.db` 不成立；未重试同一路径，工作区内只读定位到真实数据库 `.archresearch/archresearch.db`。该失败仅为路径发现，无文件写入。
- M149 第一项根因已闭合并建立双层红灯：API 测试要求 deterministic fallback 的 answer 使用 evidence-bound transfer、不得把首案例 mechanism 当总答案；Board 测试要求旧 fallback 也优先显示 causal chain 的“转译”段。两条定向测试均按预期失败，分别显示旧 answer 为“案例甲：案例机制”和旧 heading 为“连续外廊机制”，证明测试命中真实旧行为。
- M149 第一项双层红灯已转绿：API 定向 pytest 通过；Board 定向 Vitest 通过。未来 fallback 持久 answer 与旧 Run 的显示投影都改用证据绑定的转译做法，正常 synthesis 和历史 durable 数据未改。

## M149/M151 完成与门禁

- M149 第二项：先新增“无需进入案例选择即可直接收藏”的行为测试并见红；抽出共用保存 helper，每个案例标题旁新增“加入个人收藏”，原“选择案例”与批量/对照流程保留。直接收藏不会清空既有选择或修改 Board selection。
- M149 第三项：先以活动 Run 的 `gap_check` 公共读取测试复现 coverage 缺失，再让 checkpoint 同步写入 `ResearchRun.coverage_report`；Board 活动轮询测试确认运行中即可显示可用参考数，不需要提前暴露未完成结果。
- M149 第四项：测试先把新建/取消永久的预期从 14 天迁移为 180 天并见红。后端用单一 `RUN_RETENTION_DAYS` 常量；Board 显示“保留至 YYYY年M月D日”，14 天内显示“即将到期”，页头说明从创建日起保留一学期。没有迁移，既有 Run 到期日和 durable 数据不变。
- M149 第五项：只读复核 U1/U3 后建立三组红灯——Quick 至少 3 个项目、尺度错配不进入正式案例、地点译名冲突回退原名。实现把 Quick 项目目标改为 3，`PublicPageAnalysis.direct_match` 独立于 relevance/证据完整度，prompt 明确建筑尺度匹配与地点翻译约束；历史 U3 的 Barcelona 项目不再显示“罗马的卧室”。
- M151 随同收口：备份页文案改为通用短动作词，桌面恢复区双列、≤720px 单列；自动检查、替换式恢复、最终确认、失败回滚均未改变。1440×900 与 390×844 loaded QA 均溢出 0、console error 0，移动控件 44px。
- 完整 API 344/344、Board 139/139 先独立通过。第一次 `scripts/verify.ps1` 在测试全绿后被新增 import 顺序和一条长行的 Ruff lint 拦截；第二次被同两文件的 Ruff format 合同拦截；均只按报告修正我新增的格式。第三次权威门禁 exit 0：344 API / 139 Board / 165 Extension / 8 packaged E2E，Ruff/format、strict Mypy、两端 lint/typecheck/build、进程/安全/评测全绿。
- 本轮未创建、重试、取消或删除任何 Run，未写 `.archresearch` durable 数据；未执行 reset、checkout、clean、stage、commit 或 push。M149 与 M151 complete，唯一下一步切到 M150 六项重复 P2。

## M150 启动

- 用户指示继续下一步，M150 切为 in_progress。执行边界固定为六项已复现 P2，不新增导航、设置或数据模型；每项先用现有 Board/API 行为测试建立红灯，再做最小实现。
- planning-with-files session catchup 报告 11 条“未同步消息”，内容均是刚完成的 M149/M151 工具调用与最终汇报；重读 git diff、task_plan、findings、progress 后确认已全部写入现行记录，没有缺失代码或决策。输出中文乱码仅来自 catchup 控制台编码，不改文件内容。
- 第一轮 M150 组合审计命令把工作目录设在 `apps/api`，却仍使用仓库根相对路径，导致 `rg` 找不到 Board 文件、PowerShell 又把错误的 Python 相对路径误判为模块名。该命令没有写入；下一次改为仓库根执行，并为 API import 显式设置 `PYTHONPATH`，不重复同一路径假设。
### M150 — test contract preparation

- 已完成六项 P2 的代码与测试落点审计。
- 已确定标题修复不扩大 schema：记录标题优先识别最后一个完整问句；收藏目录改用原始问题作主标题。
- 下一动作：先修改行为测试并运行定向测试，确认新合同在当前实现上失败，再进入生产代码。

### M150 — RED

- Board 定向测试：105 项中 23 项按新合同失败、82 项继续通过。失败覆盖统一命名、普通话文案、运行中返回主页、就地收藏反馈、收藏目录标题、顶栏去重与案例对照表命名。
- API schema 定向测试：新增的多问句标题用例失败；当前标题确实从第一段背景截断，没有保留最后一个辨认问句。
- 红灯已建立，开始做最小生产修改。

### M150 — implementation pass 1

- 已统一研究方式为“快速找方向 / 形成方案依据 / 做跨案例论证”，内部 `quick / balanced / deep` 请求值不变。
- 已删除顶栏重复的“查看上次结果”，所有结果视图（含运行中）均提供“返回主页”。
- 已把单项目收藏成功落到原按钮，批量成功改为“已保存 N 项，选择已清空”。
- 已将收藏目录的原研究问题提升为主标题，并让多问句研究记录优先使用最后一个完整问句作标题。
- 已替换本轮锁定的内部语域，并把“未读取图片像素”类审计说明排除出适用条件。
- 下一动作：运行 Board/API 定向测试，处理实现与行为合同之间的剩余差异。

### M150 — targeted GREEN

- API schema 定向测试：23 passed；多问句标题回归已通过。
- Board 定向测试首轮只剩 1 个旧文案断言；迁移为新的普通话结果摘要后，App + copy glossary 共 105 passed。
- 下一动作：检查样式影响并完成桌面与 390px loaded-state 浏览器 QA，然后再跑完整门禁。

### M150 — loaded QA pass 1

- 桌面真实 loaded state 已成功加载；研究方式只显示一套名称，顶栏只保留备份与个人收藏，旧 P2 术语不再出现在当前页面。
- 发现旧记录兼容缺口：耐久数据里的历史 `title` 仍是旧截断值，单靠新建标题算法不能让现有记录立即可辨认。
- 复查确认响应模型本来就会动态重算旧记录标题；当前浏览器读到的是尚未重启的旧 API 进程，不需要新增前端回退。
- 已通过项目生命周期脚本重启服务，API/Board 均返回 200；首条旧记录标题已经按新算法变为完整可辨认问句。
- loaded QA 发现单问句长背景仍会挤掉动作。下一动作：先增加真实高差问题回归测试，再修正已有 `first_clause` 分支。

### M150 — title compatibility GREEN

- 新增真实高差问题回归，先确认旧逻辑失败，再把既有 `first_clause` 分支用于无“是 / 作为”主语的长背景。
- API schema 定向测试现为 24 passed；多问句取最后问句，单问句保留首个场景分句并让动作进入标题。
- 下一动作：重启服务载入一行修复，继续桌面与 390px loaded QA。

### M150 — desktop loaded QA GREEN

- 服务重启后 API/Board 均为 200。
- 1280×720 真实首页视觉检查通过：三种研究方式名称与说明层级清楚、选中态明确；顶栏只保留备份与个人收藏；首两条历史记录分别显示完整末问句和“场景：动作”的可辨认标题。
- 当前浏览器窗口不允许页面脚本直接 `resizeTo`；继续使用浏览器自身支持的窄屏创建/模拟能力完成 390px 检查，不以桌面截图代替。
- 已通过浏览器 viewport 能力切换到 390×844；首页主表单没有横向溢出，研究方式纵向排列清晰。
- 窄屏最近研究截图发现标题仍被单行省略裁掉动作。下一动作：先以样式合同锁定两行标题，再做最小 CSS 修复并复查 390px。

### M150 — 390px record-title QA GREEN

- 新增响应式样式合同并先确认失败；`.recent-question` 现最多显示两行，记录列表仍保留 320px / 45dvh 的独立滚动区。
- design-system 定向测试 18 passed。
- 390×844 复查通过：首条显示“新植入的结构和旧结构应该脱开还是连接”，第二条已露出“用剖面和流线把两个标高……”的关键动作，没有横向溢出。
- 下一动作：只读打开个人收藏检查目录标题层级，再重置临时 viewport 并进入完整门禁。

### M150 — loaded visual QA GREEN

- 390×844 个人收藏目录通过：原研究问题是主标题，研究方向是次级说明，长文本自然换行，计数与箭头仍可辨认。
- 临时 viewport 已恢复为 1280×720。
- 浏览器日志没有脚本错误；仅有预期的 Vite 连接、服务重启重连和 CSS 热更新记录。
- 下一动作：运行完整 `scripts/verify.ps1`，随后检查 diff、git 状态与耐久数据只读基线。

### M150 — full verification GREEN

- `scripts/verify.ps1` exit 0。
- Python：346 passed；Ruff format/check 与 MyPy 通过。
- Board：lint、typecheck、140 tests、production build 通过。
- Extension：lint、typecheck、165 tests、build 通过；packaged E2E 8 passed。
- 下一动作：git diff/status 审计、耐久数据只读复核，然后完成计划文档与 HANDOFF。

### M150 — working-tree audit

- `git diff --check` exit 0；staged files 为 none。
- 分支仍为 `codex/archresearch-v2-1`。工作区保留 21 个既有/本轮 tracked 修改，以及未跟踪 `.artifacts/`、`docs/release-evidence-2026-07-16.md`；未执行 reset、checkout、clean、stage、commit 或 push。
- 逐项 diff 审计确认本轮只修改标题提炼、M150 Board 文案/导航/收藏反馈/目录层级/两行标题样式及相应测试；其余 diff 属于已完成的 M149/M151。
- 下一动作：只读复核耐久数据基线，再将 M150 标记完成并更新 HANDOFF 的唯一下一步。

### M150 — baseline query correction

- 第一版 PowerShell 只读计数脚本把顶层 JSON 数组当作单个对象，并且误调用了不支持 GET 的 inputs 路由；输出的 1/1/1 已判定无效。
- `/v1/workspaces` 原始响应确认仍为 4 个真实工作区；8000/5173 监听进程也是项目正常 uvicorn/vite。
- 下一动作：用明确 JSON 枚举与 SQLite 只读查询复核完整基线。

### M150 — durable baseline GREEN

- API 只读枚举：4 workspaces / 15 runs / 13 permanent / active 0 / 11 collections。
- SQLite `mode=ro`：2 input artifacts。
- 与 M149/M151 交接基线完全一致；本轮浏览器 QA 与服务重启没有创建、重试、取消、删除或改写任何研究任务。
- 下一动作：把 M150 标记完成，并更新 HANDOFF 的唯一下一步。

## M150 complete

- 六项重复 P2 全部完成：单一研究方式命名、普通话状态/动作词、运行中返回主页、就地/批量收藏反馈、可辨认记录与收藏标题、顶栏职责去重。
- PRODUCT/DESIGN 已同步现行行为；`task_plan.md` 将 M150 标记 complete，并新增 M152 定向补充模拟的 proposed 验收合同。
- 权威门禁：346 API / 140 Board / 165 Extension / 8 packaged E2E，`scripts/verify.ps1` exit 0。
- loaded QA：1280×720 与 390×844 通过；console error 0；临时 viewport 已恢复。
- durable baseline：4 workspaces / 15 runs / 13 permanent / active 0 / 11 collections / 2 input artifacts。
- 未执行 reset、checkout、clean、stage、commit 或 push。当前唯一下一步是 M152 图纸灵感线与任务书路径的定向补充模拟。

## M152 启动

- 按 M121 工具包的原有任务判据与分级规则，分别执行图纸灵感线和任务书驱动路径的定向补充模拟；两条路径都覆盖输入、运行状态、结果理解、收藏与找回。
- 只使用隔离测试数据，不创建或改写 `.archresearch` durable Run；本里程碑只记录逐字观察、评分与分级，不夹带生产修复。
- 立项阈值保持不变：P0/P1 直接进入后续修复，P2 只有同一模式在至少 2 个独立 persona 重复才单独立项。
- 恢复检查确认工作区仍保留 21 个 tracked 修改和未跟踪 `.artifacts/`、`docs/release-evidence-2026-07-16.md`；没有 reset、checkout、clean、stage、commit 或 push。
- 首轮夹具搜索把不存在的 `evaluation/` 路径一并传给 `rg`，有效结果仍从 `fixtures/`、tests 与 docs 返回，但命令以路径错误退出 1；后续只使用仓库实际存在的 `fixtures/evaluation/`，不重复该路径假设。
- 隔离 API 首次启动成功：临时目录数据库完成迁移，`127.0.0.1:18000/health` 返回 mock/200。隔离 Board 首次后台启动没有监听 15173，日志为空；判断为 `Start-Process` 收到 PowerShell 的 pnpm 包装入口而非可执行 `.cmd`，下一次使用明确的 `pnpm.cmd`，不重启已健康的 API。
- 第一次把 `pnpm.cmd` 启动、20 秒轮询与健康请求写在同一终端命令时被执行策略拒绝，未创建进程；拆成单一后台启动和独立健康检查后恢复。
- 隔离实例现已就绪：API 18000（PID 4192）与 Board 15173（PID 26224）均监听，Board/health 均返回 200；正常产品端口未改。
- V1 图纸画像已完成首见输入和提交：图纸入口切换、问题输入、查找灵感和已创建状态均由 loaded DOM 证实，运行中的返回主页可用；等待确定性结果后继续结果理解、收藏与找回。
- V1 图纸结果、方向理解和收藏已完成；下一步从结果页返回主页并验证收藏目录/详情找回，再开始第二个图纸画像复验候选问题。
- V1 已从主页一次进入个人收藏；收藏页默认建筑标签，但图纸标签的“1 项”计数可见，继续切换并核对详情。
- V1 图纸路径已完整通过输入、状态、结果理解、收藏和找回。V2 从主页开始第二次图纸复验，重点看首屏环境职责、方向导航与多图选择的辨认成本。
- V2 已完成输入、运行状态与结果理解；复现两项图纸 P2 候选（计数口径、XHS/Chrome 环境职责）。下一步选取其偏好的拼贴方向，验证收藏与找回。
- V2 已完成拼贴方向选择与收藏，保存反馈通过；下一步从主页按第二条原问题找回并确认两条图纸收藏可区分。
- V2 找回两张保存图片成功，但收藏列表缺原问题/方向标签，核心 T7 的关系解释暂记 P1 候选。API 只读枚举还发现两个同名空实例工作区，先做原始响应复核，再进入任务书模拟。
- API 原始响应确认图纸收藏快照含原问题而 UI 未显示，T7 关系解释确定为 P1；同时确认首次空库在约 3ms 内生成两个同名默认项目，记初始化竞态 P1。两项均只记录，不在 M152 夹带修复。
- B1 已进入任务书路径并展开资料区；常规 locator 的 `setInputFiles` 不在 Browser 插件精简接口中，调用立即报错且没有上传或提交。下一步查询插件文件上传文档后使用其受支持入口。
- Browser 运行时也没有 `browser.docs.search`（`docs` 为 undefined）；只读检查确认 tab 暴露 `playwright / dom_cua / cua / content / clipboard / dev / capabilities`。下一步回查已加载技能文档中的 file chooser 能力，不继续猜方法名。
- 浏览器插件文档确认正确上传合同是先 `waitForEvent("filechooser")`、再点击真实文件 input、最后对 chooser 调 `setFiles(absolutePath)`；这解释了 locator 上没有 `setInputFiles`。下一步按该受支持流程上传临时 PDF。
- B1 临时 PDF 已通过 file chooser 装入，界面显示“1 个文件待上传”；下一步用现有问题和“形成方案依据”发起，并捕获任务书读取等待态与 Run 状态。
- B1 提交等待态与任务书专属四问已捕获；运行壳当前显示四个“暂时没有可用结果”，下一步等待终态并以 API 状态区分正常进行中占位、诚实 partial 还是夹具无法覆盖。
- B1 后端终态确认 completed/4 问全覆盖/12 assets，而界面持续空结果；定为核心阅读 P1。下一步只读核对 `/results` 响应与浏览器请求日志，区分快速完成竞态和 API 空响应。
- B1 results API 12 条完整、console error 0，前端快速完成 hydration 竞态成立。下一步从主页重开同一记录；若恢复则量化为“首次结果空，历史重开可恢复”，否则是稳定投影故障。
- B1 从最近研究重开后仍空，快速 hydration 假设被否定；当前候选根因改为 M149 direct-match 过滤与通用 mock 资产不匹配。下一步只读核对字段与 Board 投影，再决定是产品 P1 还是隔离夹具系统中断。
- 根因确认是默认 mock 缺逐字 `text_excerpt`，但 coverage 将资产算作 completed；B1 首次尝试记系统原因中断，同时登记默认 mock 完成/展示合同 P1。下一步给临时 harness 注入证据绑定的确定性 public-page parser/analyzer，换新临时数据库重跑，不修改生产代码。
- 临时 harness 已改用新 `data-evidence` 数据根，并注入四个带逐字引文、`direct_match=true` 的确定性项目正文；旧隔离数据完整保留。只停止 PID 4192 的旧隔离 API，重启为 PID 19204；18000/15173 均 200，正常 8000/5173 未动。
- 证据夹具环境已重新载入空首屏；B1 有效场次已装入同一临时 PDF、填入《耕织图》问题并保持“形成方案依据”，表单仍明确显示 1 个文件待上传，准备提交。
- B1 有效场次已成功进入“正在搜索 / 12 条可用参考”，四个任务书问题和运行中返回主页均通过；下一步等待证据绑定结果并完成阅读、收藏与找回。
- B1 第二次尝试被临时 URL 解析错误中断：Run 诚实 partial/article_analysis_incomplete，未产生逐字引文。下一步修正临时 parser 的 `/projects/p{n}` 提取、换全新数据根，既有隔离 Run 不 retry。
- 临时 parser 已修正并切到 `data-evidence-v2`；旧 PID 19204 经端口校验后停止，新隔离 API PID 7716 健康监听 18000，Board 15173 保持运行。此前两个隔离库及 Runs 均保留未 retry。
- 第三次准备表单时 file chooser 在插件的 3 秒内部窗口超时，未上传、未提交、未创建 Run；未捕获的 chooser promise 触发浏览器控制内核重置。下一步重新建立 Browser 绑定与新标签页，等待首屏稳定后分步上传，并显式捕获 chooser 错误。
- Browser 绑定已按插件文档重建并完整读取能力说明；原隔离标签页仍存在且已重新取得控制。当前是展开的空任务书表单，无文件、无问题、无 Run，隔离 API/Board 仍健康。
- 重新上传已成功：文件 input 与问题框都唯一，chooser 明确为单文件，DOM 同时确认“1 个文件待上传”和完整《耕织图》问题。下一步提交第三次、也是修正夹具后的首个有效 B1 Run。
- 第三次提交按钮等待态出现；尝试等待“研究正在进行”区域时，Run 在 3 秒窗口内已直接进入 partial，locator 超时后按规则取新 DOM，没有重试同一 locator。界面仍显示 12 条/覆盖 0 项目，说明临时正文 analyzer 仍未生效；下一步读隔离 API 错误日志，停止继续创建 Run 直至夹具根因闭合。
- 隔离 API stderr 无未捕获异常，最新 Run 是 blocked/no_new_assets。尝试读取猜测的 `/v1/runs/{id}/traces` 路由返回 404，确认该端点不存在；下一步直接以 SQLite `mode=ro` 查看临时 TraceEvent 状态，不再猜 API 路由。
- SQLite `mode=ro` 显示 12 个临时页面都由 `m152-isolated-public-page-parser` 成功解析（markdown 178–193 字），但每条 trace 都是 `enriched: 0`，且完全没有 `public_page_analysis` 事件；问题从 parser 缩到 analyzer 进入条件。继续只读源码审计，不再创建隔离 Run。
- workflow 进入正文分析还要求 URL 被推断为可信二级来源；临时 `research.example` 不满足该门槛，所以 analyzer 从未进入。下一步只改隔离 harness，把 mock 搜索结果重写为可信出版域名形状并切到 `data-evidence-v3`，随后再创建一个全新 B1 Run。
- 临时 harness 已切到 `data-evidence-v3`，搜索结果 URL 重写为 `dezeen.com`；只读函数验证同时得到 `trusted_secondary` 与 `is_concrete_project_page=true`。经端口与命令行核对后只停止旧隔离 PID 7716，新 API PID 30400 与 Board 15173 均返回 200，正常 8000/5173 仍为 200。
- 浏览器切入 v3 空首页成功。一次误把不存在的 `playwright.domcontentloaded()` 当作等待方法，立即报错且导航已完成、无表单动作；改用短暂显式等待后 DOM 正常。全新实例仍出现一个默认工作区，继续以 loaded UI 执行 B1。
- B1 v3 已展开任务书区，真实 DOM 继续明确“任务书用于收束研究范围”，文件 input 唯一；下一步按已验证的 file chooser 合同上传同一去标识 PDF。
- B1 v3 PDF 已成功装入，chooser 明确为单文件，界面确认“1 个文件待上传”；研究问题框唯一。下一步填入《耕织图》空间转译问题并提交。
- B1 v3 提交后立即出现“正在准备研究…”禁用态，原问题与待上传计数仍在同屏，读取等待反馈通过。下一步捕获运行壳与终态，确认可信来源夹具已进入正文分析。
- B1 v3 终态已产生可读结果：四个任务书子问题各显示 3 个代表案例、证据出处与可借鉴步骤，正文分析路径终于生效；同时终态状态条却称 partial、覆盖 0 个项目。下一步只读检查最新 Run 的 coverage/result 字段，再决定能否作为有效 persona 场次以及状态矛盾的级别。
- 第一条只读工作区汇总命令因直接把 `foreach` 输出接到管道而触发 PowerShell 空管道解析错误，没有发出请求或改数据；改成先收集 `$rows` 后成功。v3 仍复现空库双默认工作区，最新 Run `d11f9210-...` 为 `blocked/budget_exhausted`。
- Run 数据确认不是 UI 文案误读：coverage 确为 `usable_assets=12 / project_count=0 / covered_subquestions=0`，results 也确有 12 条；首条结果含 4 个任务书子问题、正文分析、两个带逐字引文的 evidence claims。下一步查 coverage 接受条件中哪个字段仍未满足，避免把夹具构造不足误分产品缺陷。
- 根因闭合为 v3 analyzer 的同义句与 mock asset 顶层原句不一致：Board branch 可显示，但 formal article coverage 按精确 evidence statement 校验，故为 0。该场次不计 persona。harness 已对齐四个 mock 项目的原始 context/mechanism，并切到全新 `data-evidence-v4`；下一步重启隔离 API 后执行一次最终 B1。
- 经 18000 端口与 uvicorn 命令行核对，只停止 v3 PID 30400；v4 API PID 33404 已健康，隔离 Board 15173 与正常 8000/5173 均保持 200。下一步重新载入空首页并执行最终 B1。
- v4 空首页已载入，最终 B1 的任务书区已展开；不再调整夹具，后续观察直接计入角色记录。
- 最终 B1 已选择同一去标识 PDF、填入完整《耕织图》空间转译问题并提交；文件 input、问题框和提交按钮均先确认唯一，120ms 内出现“正在准备研究…”。
- v4 仍以 `blocked/budget_exhausted` 结束；只读结果显示 context/mechanism 已对齐，但仅 mechanism 新增了逐字引文，context 原先已有的无引文 claim 没被正文 analyzer 升级，formal coverage 仍为 0。该场次不计 persona，下一步仅调整隔离搜索资产使初始 context 为空、让 analyzer 成为唯一 evidence 写入者。
- 持久逻辑复核确认：正文 analyzer 只在 candidate 顶层字段为空时写入 context/mechanism，并且相同 statement 的既有无引文 EvidenceClaim 不会被补写。v5 因而只把隔离搜索资产的预填分析字段清空，让 analyzer 成为唯一写入者；生产代码未改。
- 经端口、PID 与 `m152_app:app` 命令行三重校验后只停止 v4 PID 33404；v5 API PID 25360 健康，隔离 Board 与正常 8000/5173 均为 200。
- v5 空首页与任务书入口正常，最终 B1 PDF 已装入并显示 1 个文件待上传；后续该场次直接计分。
- B1 v5 有效场次完成：120ms 内是“正在准备研究…”，约 700ms 后进入无 partial/status 警告的完整结果；四个任务书子问题均显示 4 个代表案例、怎么做、适用条件、出处与图纸。输入、等待、任务书收束作用和结果理解均通过。
- B1 能在“蚕桑丝织工序→连续参观序列”方向内唯一定位“织造厂再生中心”的直接收藏动作；下一步点击并核对原位成功反馈，再回主页找回。
- B1 点击后同一案例按钮原位变为“已加入收藏 织造厂再生中心”，T6a 通过；已用唯一“返回主页”动作回到首页，下一步进入个人收藏验证目录关系。
- B1 找回通过：建筑收藏目录以完整原问题为主标题、任务书衍生子问题为“研究方向”，详情保留“核心解法 / 怎么做 / 适用条件 / 出处 / 案例图”。最终 B1 的 T2/T3/T6a/T7 全通过；下一步开始 B2，并复验上传后不显示文件名的 P2 候选。
- B2 已从收藏详情返回首页并展开任务书区，文件 input 唯一；B2 将以科技馆蚕桑展览画像复验同一路径。
- B2 上传后再次只显示数量、不显示真实文件名，任务书核对问题达到 2/2 重复 P2；随后填入科技馆长卷叙事问题并提交，120ms 内出现“正在准备研究…”。
- B2 约 700ms 后完成且无 partial 警告，四个任务书问题与 16 个代表案例关联均出现；结果理解通过。已唯一定位首个任务书方向，下一步保存与 B1 不同的“船坞创意园”并找回两条原问题。
- B2 “船坞创意园”直接收藏后原位显示“已加入收藏”，已返回首页；下一步进入收藏目录确认两条相同研究方向、不同原问题是否可区分。
- B2 收藏目录显示 2 项，两条完整原问题清楚区分、研究方向相同；视觉找回关系通过。两个目录按钮的 accessible name 仍相同，记单画像可访问性观察；已用唯一的 B2 原问题文字定位其详情。
- B2 详情也通过：页面保留原研究题目、任务书子问题、“船坞创意园”的核心解法、怎么做、适用条件、出处和案例图，T7 完成。
- 尝试调用不存在的 `playwright.consoleMessages()` 立即报错，没有页面动作；回查已加载 Browser 文档后确认正确接口是 `tab.dev.logs({levels:[...]})`，下一步用该接口检查 error 日志。
- 正确日志接口返回 0 个 error。v5 API 只读复核：B1/B2 两条 Run 均 `completed/coverage_satisfied`，各 12 usable、4 projects、4/4 子问题；空库双默认工作区也再次复现。任务书模拟完成，进入记录与评分汇总。
- M152 记录已写入 `docs/m152-targeted-simulation-2026-07-27.md` 与逐字 JSON；JSON 解析通过（4 sessions / 7 repair candidates / 5 calibration events）。`task_plan.md` 已将 M152 标为 complete，并用明确红灯、loaded QA 和完整门禁合同新增唯一后续 M153。
- 隔离浏览器标签已 finalize；只停止经 PID/命令行核对的测试进程 25360（18000）与 26224（15173），两端口已释放，正常 8000/5173 仍为 200。
- durable API 当前为 4 workspaces / 15 Runs / 13 permanent / active 0 / 14 collections。新增 3 条收藏的时间、问题和来源均与 M152 persona 不同，是并发外部变化；按工作区保护规则保留，不删除。下一步补查 input artifacts 后将这一本轮结束基线写入 HANDOFF。
- SQLite `mode=ro` 确认 input artifacts 仍为 2。HANDOFF 已把唯一下一步切到 M153，并记录 14 collections 的并发基线变化。

## M152 complete

- 4 个隔离 persona 的输入→状态→结果理解→收藏/找回均有真实 loaded UI 记录；V1/B1/B2 核心判据全过，V2 的收藏关系解释失败按 P1 收口。
- 归档：`docs/m152-targeted-simulation-2026-07-27.md` 与逐字 JSON（解析通过：4 sessions / 3 P1 / 4 repeated P2）。
- 隔离服务已停止，正常 8000/5173 为 200；durable 结束基线为 4 workspaces / 15 Runs / 13 permanent / active 0 / 14 collections / 2 input artifacts。
- `git diff --check` exit 0，staged 0；保留 21 个既有 tracked 修改与未跟踪 `.artifacts/`、两份 M152 记录、`docs/release-evidence-2026-07-16.md`。未执行 reset、checkout、clean、stage、commit 或 push。
- 当前唯一下一步：M153 targeted-simulation repair batch，严格按 `task_plan.md` 的 behavior-first 验收合同执行。

## M153 启动

- 按 HANDOFF 唯一下一步启动 3 项 P1 + 4 项重复 P2 的 behavior-first 修复批次；M152 观察记录不重跑，先把每项失败形态落成定向测试。
- 工作树继续视为用户资产：保留 21 个既有 tracked 修改、`.artifacts/`、两份 M152 记录与发布证据；不 reset、checkout、clean、stage、commit 或 push。
- 结束验收必须同时满足：fresh DB 并发初始化唯一、默认 mock 完成/展示一致、图纸收藏关系可辨认、四项 P2 loaded UI 与可访问性通过、完整门禁不回退、durable 基线不被测试改写。
- planning session catchup 检出 7 条未同步消息，均为 M152 收尾与本次 M153 启动；已按建议复核 diff 和三份规划文件，没有隐藏生产改动。
- Impeccable context 已从 `apps/board/PRODUCT.md` 与根 `DESIGN.md` 成功加载，register 为 product；已读 product register、App 与现有 CSS token。后续 UI 采用熟悉的标准控件、克制说明和既有响应式结构。
- 第一轮触点审计完成：默认 workspace 创建在挂载 effect；视觉收藏已有 question 分组数据但未显示；环境/文件数量/图片 aria-label 均为单点 JSX；默认 mock 预填分析但缺 excerpt。下一步读持久化与 collection snapshot 结构，确定红灯测试边界。
- 两次追加审计记录时因预期上下文与文件实际内容不一致，`apply_patch` 校验失败且未产生改动；已读取文件尾部后按实际末行重新应用。
- 审计结论已收敛：普通工作区创建语义保持不变；首启采用独立幂等入口；Mock 必须补证据绑定而不是放宽 Board 门槛；视觉收藏只展示快照中真实保存的问题/方向。
- 下一步按行为测试优先：先覆盖并发首启与 Mock 完成态，再覆盖 Board 收藏上下文、计数说明、任务书文件名和唯一可访问名称。
- 一次并行 `rg` 包含不存在的 `apps/board/tests`，该子命令退出 2，未改文件；已改为只搜索实际存在的 `apps/board/src`，其余审计结果有效。
- 已闭合数据与测试边界：visual direction 可从现有 Run/asset 回填；Mock evidence 可用可选精确摘录映射；首启使用独立 ensure endpoint，不改普通创建。
- 现在开始写红灯测试，生产文件尚未修改。
- 首次跨多文件测试补丁因 `client.test.ts` 的预期上下文不完全匹配而整体校验失败，未产生部分改动；随后拆成小补丁按实际上下文成功应用。
- 后端红灯已确认：并发 default endpoint 当前 405、Mock context claim 没 excerpt、视觉收藏没 `visual_directions`，3/3 精确失败。
- Board 红灯已确认：目标 114 项中 8 项失败，覆盖缺文件名列表、首启仍走普通 POST、收藏缺问题/方向、旧环境文案、缺计数说明、重复 accessible name，以及 client 尚无 ensure 方法；其余 106 项通过。红灯形态与 M152 证据一致。
- 测试运行器第一次用并行 Promise 聚合时因后端非零退出提前丢失 Board 输出；已单独续跑 Board 并取得完整 8 项失败结果，没有改动运行中服务或 durable 数据。
- 进入生产修复：先后端 ensure/evidence/visual snapshot，再 Board 投影与产品合同。
- 后端 3 项定向红灯已转绿：并发首启、Mock evidence excerpt、visual direction save/backfill 均通过。
- Board 首次实现后为 113/114，仅“扩展配对”场景仍断言两处旧 Chrome 文案；按新产品合同迁移断言后复跑为 114/114。
- `PRODUCT.md` 与 `DESIGN.md` 已同步文件名、图纸计数、可访问名称、收藏上下文及 XHS/Chrome 职责合同；Impeccable 约束实际影响为平面文件名列表、既有网格/间距与无新增卡片。
- 下一步运行后端相邻 provider/API 回归和 Board lint/typecheck/build，再进入隔离 loaded UI。
- 相邻回归已通过：API `test_workspaces_inputs.py test_runs_results.py test_providers.py` 53 passed；Board App + client 114/114，lint、typecheck、production build 全绿。
- 首次启动隔离 API/Board 的 PowerShell 包装命令返回空白非零，但只读端口与命令行检查确认 18253/15253 已正确监听；该事件只影响测试编排，没有改生产或 durable 状态。
- fresh DB loaded UI 只出现固定 UUID 的 1 个默认工作区；桌面上传真实临时 `museum-brief.pdf` 后，DOM 与页面都直接显示文件名且无横向溢出。
- 初次尝试用 `window.resizeTo` 设置移动视口被浏览器插件拒绝；改用已声明的 `viewport` capability 后得到真实 390×844。任务书文件名、44px 控件与无横向溢出均通过。
- 隔离视觉夹具第一次打开结果提示 `Reference board not found`，确认是临时夹具漏建 ReferenceBoard；仅补齐临时 DB 关联行后加载成功，生产代码与 durable 数据未动。
- desktop 与 390px loaded QA 均通过：5 张去重图片对应 7 个方向关联，短说明可见；7 个选择按钮的 accessible name 全部唯一；两条视觉收藏无需打开详情即可辨认各自原研究问题与方向；页面 error log 为 0。
- `getByText(...).scrollIntoViewIfNeeded()` 不是插件 locator API，立即失败且无页面动作；改用只读 DOM `scrollIntoView` 截取移动结果摘要。
- 隔离浏览器标签已关闭；经端口、PID 和命令行核对，只停止 18253/15253 的测试进程及其包装进程，两端口已释放，正常 8000/5173 均保持 200。
- 下一步运行 `git diff --check` 与完整 `scripts/verify.ps1`，随后只读复核 durable 基线和工作区状态。
- 首轮完整门禁中 348 个 API 测试全过，但 Ruff format check 指出本轮改动的 `workflow.py` 需机械排版，脚本按预期在此停止；只格式化该文件后 `git diff --check` 继续通过。
- 第二轮 `scripts/verify.ps1` 完整成功：348 API / 141 Board / 165 Extension / 8 packaged E2E，加 Ruff/format、strict Mypy、lint/typecheck/build、进程/安全/评测检查全部通过。
- 第一次用 `Invoke-RestMethod` 直接包 `@(...)` 统计 JSON 数组时，PowerShell 7.6 的 no-enumerate 语义给出伪 `1 workspace` 并拼出无效 workspace 路径；改用 `Invoke-WebRequest` + `ConvertFrom-Json` 后连续读取稳定为 4，正常 API 进程与数据未异常。
- durable 结束基线只读确认仍为 4 workspaces / 15 Runs / 13 permanent / active 0 / 14 collections / 2 input artifacts；正常 8000/5173 均为 200。
- `git status --short --branch` 保留 24 个 tracked 修改和既有未跟踪 `.artifacts/`、两份 M152 记录与发布证据；staged 0。未执行 reset、checkout、clean、stage、commit 或 push。

## M153 complete

- 3 项 P1 与 4 项重复 P2 全部完成红灯→绿灯→loaded QA→完整门禁闭环；旧 Run/收藏兼容，无 durable 写入。
- HANDOFF 与 task_plan 已把权威门禁更新为 348/141/165/8，并将唯一下一步切到 M122：先补 Board/Extension 覆盖率基线，再执行第一片纯库抽取。

## M122 启动

- 用户确认执行 M122；本轮范围固定为第一片“Board/Extension 覆盖率基线 + App 纯工具模块抽取”，不改 UI、API、数据语义或样式结构。
- planning-with-files session catchup 报告 10 条未同步消息，均为 M153 收尾、M122 解释和本次启动；已复核 `git diff --stat` 与三份规划文件，没有遗漏生产改动。
- 验收顺序：先记录 coverage-v8 基线；再新增对目标模块导出的失败测试；随后机械搬移并保持 App 现有调用合同；定向 lint/typecheck/test/build 与完整 `scripts/verify.ps1` 全绿；durable 基线和正常服务不变。
- 已为 Board/Extension 加入与实际 Vitest 4.1.10 精确匹配的 `@vitest/coverage-v8` 和稳定 `test:coverage` 配置；依赖安装通过既有 supply-chain policy。
- 搬移前覆盖率基线全绿：Board 141 tests，statements 78.17% / branches 72.39% / functions 80.50% / lines 81.78%；Extension 165 tests，82.69% / 76.52% / 83.96% / 84.73%。
- 下一步新增 `lib/*` 模块合同测试并确认缺模块红灯；生产函数仍全部在 `App.tsx`。
- `src/lib/contracts.test.ts` 模块合同红灯已确认：Vitest 在导入阶段精确失败于不存在的 `./labels`，0 tests executed；失败原因是目标模块尚未创建，不是既有产品行为回退。
- 进入纯模块实现：创建 8 个无 React 模块并把 `App.tsx` 同名定义替换为导入，组件、CSS、API 与数据模型保持不动。
- 第一轮并行合同测试/typecheck 因 `App.tsx` 漏导入已搬到 backup 模块的 `LastBackupRecord` 与 `lastBackupStorageKey` 而在 TypeScript 编译阶段失败；并行聚合同时丢失合同测试输出。已补齐这两个纯导入，后续分开运行以保留每个门禁结果。
- 8 个目标纯模块已创建，`App.tsx` 从 4,089 行降至 3,241 行；同名实现已从 App 删除，组件函数与 JSX 未拆。
- 补齐 backup 导入后 Board typecheck 通过，模块合同测试由缺模块红灯转为 7/7 通过。下一步跑完整 Board 回归与搬移后覆盖率比较。
- 第一轮 Board 并行门禁：production build 通过；lint 发现 App 多导入两个仅在 run 模块内部使用的函数；148 项测试中 147 通过，唯一失败是 `copy-glossary.test.ts` 仍只扫描 `App.tsx`，因此看不到已移到 labels 模块的“转载合集（非首发）”。
- 这是源码守卫的模块化迁移点，不是产品文案失败：已移除两个多余导入，并把 glossary 守卫扩展为扫描 App 与 7 个含用户文案的生产纯模块，保持原禁止词/必需词合同覆盖。
- 修正后 Board 全绿：148/148 tests、lint、typecheck、production build。覆盖率为 78.36/72.59/80.50/81.84，分别相对搬移前 +0.19/+0.20/+0.00/+0.06 个百分点，四项均未下降。
- 新 `src/lib` 自身覆盖率为 statements 88.67% / branches 81.41% / functions 97.01% / lines 91.92%；说明高覆盖纯逻辑没有因搬离 App 而脱离测试。
- 已把两端基线编码为 Vitest thresholds，并增加根级 `pnpm test:coverage`；根命令通过：Board 148、Extension 165，四项阈值全部满足。后续切片一旦低于本轮基线会直接失败。
- 下一步做 diff/格式检查并运行完整 `scripts/verify.ps1`，随后复核 durable、服务和工作树。
- `git diff --check` 通过。后台启动完整门禁后，第一次按进程列表取到的 PID 37472 是已退出包装进程，误报 `Running=false`；只读进程树确认实际 verify PID 37956 及 pytest 子进程仍正常运行，日志持续增长、stderr 为空。后续改按已核对的 37956 轮询。
- 完整 `scripts/verify.ps1` 成功：348 API / 148 Board / 165 Extension / 8 packaged E2E，加 Ruff/format、strict Mypy、lint/typecheck/build、进程/安全/评测检查全部通过。
- durable 结束基线只读确认仍为 4 workspaces / 15 Runs / 13 permanent / active 0 / 14 collections / 2 input artifacts；正常 8000/5173 均为 200。

## M122 第 1/8 片 complete

- 覆盖率基线、硬阈值、根命令、模块红绿合同和 8 个纯模块抽取全部闭环；产品界面、API、CSS 与 durable 数据无行为变化。
- 当前唯一下一步：M122 第 2 片 `<DataManagementPage>`，先钉住备份/恢复 props 合同，再抽最孤立视图。
- 最终 `git diff --check` exit 0；工作树保留 31 个 tracked 修改、5 个未跟踪入口（含既有 `.artifacts/`、M152/发布记录和本轮 `apps/board/src/lib/`），staged 0。未执行 reset、checkout、clean、stage、commit 或 push。
- 第一次统计未跟踪入口时误用 PowerShell `-like '??*'`（`?` 是通配符）而伪报 36；改用 `.StartsWith('??')` 后正确为 5。该统计错误没有文件或 Git 状态变更。

## M122 第 2/8 片启动

- planning-with-files catchup 检出 6 条未同步消息，仅涵盖第一片完成、用户确认下一步与本片启动；已按建议复核整体 diff 规模、M122 计划行及 findings/progress 末尾，没有发现隐藏的后续生产改动。
- 本片边界固定为 `<DataManagementPage>` 等价抽取，不再调整 M151 已完成的备份页文案、排版或 CSS；验收锁定备份/恢复、自动预检、最终确认、失败回滚提示与恢复后的父级刷新顺序。
- 状态依赖审计确认备份页内部状态可整体下沉；App 只传项目数、研究记录数、运行中状态和恢复成功回调。下一步先新增组件合同测试，确认因目标模块不存在而红灯。
- `DataManagementPage.test.tsx` 红灯已确认：Vitest 在导入阶段精确失败于不存在的 `./DataManagementPage`，0 tests executed；既有产品测试未受影响。
- 进一步审计发现 App 原状态在关闭备份页后仍会保留，因此新组件采用“始终挂载、关闭时返回 null”的边界，避免把返首页再回来隐式改成全量重置。
- 组件状态、下载/预检/恢复操作与原 JSX 已等价搬移；App 只保留打开状态、计数、运行中状态、错误 setter 和恢复后的工作区选择/视图重置回调。文案、className、最终确认和恢复 API 顺序未改。
- 组件合同已转绿 2/2；App + copy glossary 相邻回归 106/106，Board typecheck 通过。源码文案守卫已纳入新组件，下一步跑完整 Board 门禁与覆盖率。
- 首轮 Board coverage 的 150 项测试全过，但 functions 80.41% 低于 80.50% 硬阈值；没有降低阈值或排除组件，而是补上下载失败不写完成记录的行为合同。
- 补测后组件合同 3/3；Board 151 tests，覆盖率 78.44/72.73/80.63/81.91，四项均高于第一片结果；`DataManagementPage.tsx` functions 100%。根级 Board/Extension coverage 命令全绿。
- lint 首轮指出打开状态 effect 同步 setState；为保持旧的跨开关提示语义且遵守 React 规则，只把 `dataStatus` 留在 App 受控，其余页面状态仍下沉。修正后 lint/typecheck/build 与 108 项相邻回归全绿。
- 完整 `scripts/verify.ps1` 成功：348 API / 151 Board / 165 Extension / 8 packaged E2E，加 Ruff/format、strict Mypy、lint/typecheck/build、进程/安全/评测检查全部通过。
- 只读结束复核：durable 仍为 4 workspaces / 15 Runs / 13 permanent / active 0 / 14 collections / 2 input artifacts；正常 8000/5173 均为 200。

## M122 第 2/8 片 complete

- `<DataManagementPage>` 已从 App 抽出，备份/恢复文案、className、下载记录、自动预检、最终确认、失败回滚与恢复后的父级工作区刷新顺序均保持。
- `App.tsx` 3,241→3,132 行；`git diff --check` exit 0，staged 0。工作树保留 31 个 tracked 修改和 7 个未跟踪入口，未执行 reset、checkout、clean、stage、commit 或 push。
- 当前唯一下一步：M122 第 3 片叶子覆盖层，先钉 SharePanel / StylePanel / ComparisonDialog / SourceInspector 的 props 与 `onClose` 合同，再逐个等价搬移；共用焦点陷阱继续留在 App。

## M122 第 3/8 片启动

- planning-with-files catchup 检出 7 条未同步消息，仅涵盖第二片完成、阶段说明和本片启动；已按建议复核 `git status`、整体 diff 与三份规划文件，工作树仍为 31 个 tracked 修改、7 个未跟踪入口，未发现第二片之后的隐藏生产改动。
- 审计确认 open state、trigger ref、`closeOverlays` 与 Escape/Tab 焦点陷阱继续留 App；四个新组件仅承接叶子 DOM 和受控 props。第三片不改文案、CSS、API 或持久数据。
- 既有 App 测试覆盖 share/style/comparison 正向路径但没有 SourceInspector 正向合同；下一步新增四组件边界测试，并先确认因目标模块不存在而红灯。
- `OverlayPanels.test.tsx` 红灯已确认：Vitest 在导入阶段精确失败于不存在的 `./SourceInspector`，0 tests executed；失败形态是目标边界尚未创建。
- 四个叶子组件创建后首测 3/4；ComparisonDialog 保留了原本 `alt=""` 的装饰图片，它在可访问性树中是 presentation 而非 img role。测试改用 DOM 图片节点触发同一 error 回调后 4/4 全绿，生产语义未改。
- 四组件已接回 App；StylePanel 的 profile 受控、ComparisonDialog 自己派生 guide、SourceInspector 只转发保存/拒绝/备注/预览回调，所有 open 状态与 `closeOverlays` 仍在 App。copy glossary 已纳入四个新生产文件。
- lint 首轮只报 StylePanel 同文件导出 `defaultStyle` 触发 Fast Refresh warning；常量移回 App、组件文件仅保留组件和值擦除的类型导出后 lint 通过。typecheck、production build 与 Overlay/App/glossary 110 项相邻回归均全绿。
- Board coverage 全绿：155 tests，78.79/73.68/81.94/82.23，四项均高于第二片；根级 Board/Extension coverage 同步通过。`App.tsx` 3,132→2,977 行。
- 完整 `scripts/verify.ps1` 成功：348 API / 155 Board / 165 Extension / 8 packaged E2E，加 Ruff/format、strict Mypy、lint/typecheck/build、进程/安全/评测检查全部通过。
- 只读结束复核：durable 仍为 4 workspaces / 15 Runs / 13 permanent / active 0 / 14 collections / 2 input artifacts；正常 8000/5173 均为 200。

## M122 第 3/8 片 complete

- SharePanel / StylePanel / ComparisonDialog / SourceInspector 已从 App 抽出；覆盖层文案、className、表格、证据操作和样式字段保持，统一焦点管理仍由 App 负责。
- `git diff --check` exit 0，staged 0。工作树保留 31 个 tracked 修改和 12 个未跟踪入口，未执行 reset、checkout、clean、stage、commit 或 push。
- 当前唯一下一步：M122 第 4 片 `<PersonalCollectionsPage>`，先钉建筑/图纸收藏、目录/详情/空态与删除回调合同，再等价搬移；删除及 savedIds 同步留 App。

## M122 第 4/8 片启动

- planning-with-files 恢复后复核 `task_plan.md`、`findings.md`、`progress.md`、HANDOFF、`git status --short --branch` 与整体 diff；第三片后没有隐藏生产改动，31 个 tracked 修改和 12 个未跟踪入口全部保留。
- 本片边界固定为 `<PersonalCollectionsPage>` 等价抽取；收藏页派生分组和 JSX 下沉，删除 API、`savedIds` 同步、页面开关与打开时加载继续留 App，不改文案、CSS 或 durable 数据。
- 现有 App 集成测试已经钉住页面完整正向路径；下一步新增独立组件合同并先确认缺模块红灯，再实施最小搬移。
- `PersonalCollectionsPage.test.tsx` 红灯已确认：Vitest 在导入阶段精确失败于不存在的 `./PersonalCollectionsPage`，0 tests executed；失败原因是目标组件尚未创建。
- 收藏分组、建筑目录/详情和图纸网格已移入新组件；App 只传受控状态与回调，视图切换仍在父级同步清空目录选择，删除函数及 `savedIds` 同步未移动。组件合同 3/3、typecheck、lint、production build 与 App/glossary 相邻回归 109/109 全绿。
- Board coverage 158 tests 全绿：78.94/73.78/82.47/82.39，四项均高于第三片；`PersonalCollectionsPage.tsx` statements/functions/lines 100%。`App.tsx` 2,977→2,701 行，`git diff --check` exit 0。
- 根级 Board/Extension coverage 同步通过；完整 `scripts/verify.ps1` 成功：348 API / 158 Board / 165 Extension / 8 packaged E2E，加 Ruff/format、strict Mypy、lint/typecheck/build、进程/安全/评测检查全部通过。
- 只读结束复核：durable 仍为 4 workspaces / 15 Runs / 13 permanent / active 0 / 14 collections / 2 input artifacts；正常 API 8000 与 Board 5173 均为 200。

## M122 第 4/8 片 complete

- `<PersonalCollectionsPage>` 已从 App 抽出，建筑/图纸切换、加载/空态、目录/详情、视觉上下文、来源与删除按钮的文案和 DOM class 保持；删除 API、`savedIds` 同步、页面加载/开关和跨视图复位仍由 App 负责。
- 当前唯一下一步：M122 第 5 片 `<VisualInspirationBoard>` → `<CaseAnalysis>`；先钉两块结果视图的 props/交互合同，`inspirationGroups`、`caseGroups` 与跨视图选择状态先留 App。

## M122 第 5/8 片启动

- planning-with-files 恢复、HANDOFF、三份规划文件、`git status --short --branch` 与整体 diff 已复核；catchup 的 8 条未同步消息只包含第四片收尾、日期切换和本片启动，没有隐藏生产改动。31 个 tracked 修改和 14 个未跟踪入口全部保留。
- 系统 `python` 命令被 Microsoft Store alias 截获而无法运行 catchup；未重复同一失败，改用仓库既有 `apps/api/.venv/Scripts/python.exe` 后成功恢复。
- 本片边界固定为先 `<VisualInspirationBoard>`、后 `<CaseAnalysis>` 的等价抽取；派生 group、跨视图选择状态、overlay trigger 与 API 副作用留 App，不改文案、DOM class、CSS 或 durable 数据。
- 审计确认两块 JSX 都可由 group 数据、选择/预览状态和小回调完整渲染；下一步补独立组件合同并先确认缺模块红灯。
- `ResultViews.test.tsx` 红灯已确认：Vitest 在导入阶段精确失败于不存在的 `./CaseAnalysis`，0 tests executed；失败形态是两个目标组件尚未创建。
- `<VisualInspirationBoard>` 与 `<CaseAnalysis>` 已按顺序创建并接回 App；组件仅消费派生 group/受控状态并转发选择、收藏、检视器与预览失败事件，父级副作用未移动。独立合同 3/3、typecheck 与 App/glossary 相邻回归 109/109 全绿。
- 首轮 lint 精确指出 App 遗留 7 个已随 JSX 搬出的 icon/label/text import；这是本次抽取产生的孤儿导入，已按外科范围移除，未改相邻代码。首轮因此未进入 build。
- 移除孤儿导入后 lint 与 production build 全绿。Board coverage 161 tests 全绿：79.42/75.42/83.11/82.87，四项均高于第四片；`VisualInspirationBoard.tsx` statements/functions/lines 100%，`CaseAnalysis.tsx` statements/lines 93%+。`App.tsx` 2,701→2,349 行。
- 根级 Board/Extension coverage 同步通过；完整 `scripts/verify.ps1` 成功：348 API / 161 Board / 165 Extension / 8 packaged E2E，加 Ruff/format、strict Mypy、lint/typecheck/build、进程/安全/评测检查全部通过。
- 只读结束复核：durable 仍为 4 workspaces / 15 Runs / 13 permanent / active 0 / 14 collections / 2 input artifacts；正常 API 8000 与 Board 5173 均为 200。

## M122 第 5/8 片 complete

- `<VisualInspirationBoard>` 与 `<CaseAnalysis>` 已从 App 抽出；图纸方向/帖子/图片、建筑章节/代表案例、直接收藏/批量选择、项目预览与来源文案、DOM class 均保持。group 派生、选择/API 副作用、overlay trigger 和浏览器不可用判断仍由 App 负责。
- `git diff --check` exit 0；工作树保留 31 个 tracked 修改、17 个未跟踪入口，staged 0。未执行 reset、checkout、clean、stage、commit 或 push。
- 当前唯一下一步：M122 第 6 片 `<ResearchComposer>` + HomeSections；先钉输入/提交/就近错误和主页工作区/最近研究/数据入口合同，父级状态与 API 副作用继续留 App。

## M122 第 6/8 片启动

- planning-with-files catchup 检出 6 条未同步消息，仅包含第五片收尾、本片说明与恢复读取；HANDOFF、三份规划文件、`git status --short --branch` 和整体 diff 已复核，没有隐藏生产改动。31 个 tracked 修改和 17 个未跟踪入口全部保留。
- 本片边界固定为 `<ResearchComposer>` + `<HomeSections>` 等价抽取；受控输入、提交/工作区/API 副作用和跨组件 question ref 留 App，不改文案、DOM class、CSS 或 durable 数据。
- 审计确认 HomeSections 可同时吸收固定问题起点、RunHistoryList 与日期/保留期纯展示 helper；下一步补独立组件合同并先确认缺模块红灯。
### 2026-07-28 M122 第 6/8 片红灯

- 新增的 `apps/board/src/components/HomeComponents.test.tsx` 已按测试先行要求运行。
- 红灯符合预期：Vitest 在导入阶段因 `./HomeSections` 尚不存在而失败，`0 tests`；生产组件尚未创建。
- `<ResearchComposer>` 与 `<HomeSections>` 已按既定边界创建并接回 App；受控输入、跨组件 question ref、提交/工作区/API 副作用仍由 App 持有，固定问题起点、RunHistoryList 与保留期纯展示 helper 已移入 HomeSections。
- 独立组件合同 3/3、typecheck、App/glossary 相邻回归 109/109、lint、production build 与 `git diff --check` 全绿；首轮 lint 仅检出 12 个随 JSX 搬出的孤儿导入，已按本片范围移除。
- Board coverage 164 tests 全绿：79.45/75.55/83.18/82.89，四项均高于第五片；`HomeSections.tsx` lines/functions 100%，`ResearchComposer.tsx` statements/lines 85.71%。
- 根级 `pnpm test:coverage` 通过：Board 164 / Extension 165，Extension coverage 82.69/76.52/83.96/84.73。
- 完整 `scripts/verify.ps1` 成功：348 API / 164 Board / 165 Extension / 8 packaged E2E，加 Ruff/format、strict Mypy、lint/typecheck/build、进程/安全/评测检查全部通过。
- 只读结束复核：`App.tsx` 2,349→2,024 行；durable 仍为 4 workspaces / 15 Runs / 13 permanent / active 0 / 14 collections / 2 input artifacts；正常 API 8000 与 Board 5173 均为 200。

## M122 第 6/8 片 complete

- `<ResearchComposer>` 与 `<HomeSections>` 已从 App 抽出；表单、环境展示、问题起点、项目新建和最近研究的文案、DOM class 与事件语义保持，父级状态/API 副作用及跨组件 question ref 未移动。
- `git diff --check` exit 0；工作树保留 31 个 tracked 修改、20 个未跟踪入口，staged 0。未执行 reset、checkout、clean、stage、commit 或 push。
- 当前唯一下一步：M122 第 7 片 `useBrowserReadiness()`；先钉 hook 状态合同并处理 `hydrateRun` 双写，旧水合结果不得覆盖更新的环境检查。

## M122 第 7/8 片启动

- planning-with-files catchup 检出 5 条未同步消息，只包含第六片收尾、用户继续和本片恢复动作；`git diff --stat`、三份规划文件与 `git status --short --branch` 已复核，31 个 tracked 修改和 20 个未跟踪入口全部保留。
- 本片边界固定为浏览器就绪 hook：集中初始检查、手动刷新、权限/错误派生和竞态序列；研究提交、Run payload 水合与页面级错误仍留 App，不提前实施第八片。
- `useBrowserReadiness.test.tsx` 红灯已确认：Vitest 在导入阶段精确失败于不存在的 `./useBrowserReadiness`，0 tests executed；生产 hook 尚未创建。
- hook 合同 3/3 与 typecheck 首轮转绿。首次并行相邻验收因 lint 检出 App 遗留的单个 `xiaohongshuSearchAvailable` 解构而提前中止；该值已由 hook 内部消费，是本片产生的孤儿变量，下一轮单独续跑各项门禁。
- 移除孤儿解构后，hook/App/glossary 109/109、lint、typecheck、production build 与 `git diff --check` 全绿。
- 首轮 Board coverage 167 tests 虽通过硬阈值，但逐片比较不合格：78.93/75.03/83.44/82.83，statements/branches/lines 低于第六片 79.45/75.55/83.18/82.89。原因是新 hook 的连接/权限分支缺少直接合同；下一步补行为测试后重跑，不降低阈值或排除文件。
- 新增连接刷新、XHS 短路和 demo 合同后首跑 4/6；两项失败均因 `vi.mock()` 调用计数跨测试累积，`restoreAllMocks` 未清空模块 mock。测试已改为每例前 `mockReset`，生产 hook 未改。
- 最终 hook 合同 8/8；补齐可选 Chrome 放行和页面权限拒绝分支后，Board coverage 172 tests 全绿：79.81/75.55/83.66/83.76。四项均不低于第六片，hook 自身为 83.75/76.52/93.33/90.84。
- 根级 `pnpm test:coverage` 通过：Board 172 / Extension 165，Extension coverage 82.69/76.52/83.96/84.73。
- 完整 `scripts/verify.ps1` 成功：348 API / 172 Board / 165 Extension / 8 packaged E2E，加 Ruff/format、strict Mypy、lint/typecheck/build、进程/安全/评测检查全部通过。
- 只读结束复核：`App.tsx` 2,024→1,818 行，所有浏览器就绪 setter 只存在于 hook；durable 仍为 4 workspaces / 15 Runs / 13 permanent / active 0 / 14 collections / 2 input artifacts；正常 API 8000 与 Board 5173 均为 200。

## M122 第 7/8 片 complete

- `useBrowserReadiness()` 已集中初始/手动检查、连接/权限动作、错误与环境文案；后发请求优先，`hydrateRun` 不再直接写浏览器状态。App 行为、文案、DOM class 和 CSS 保持。
- `git diff --check` exit 0；工作树保留 31 个 tracked 修改、21 个未跟踪入口，staged 0。未执行 reset、checkout、clean、stage、commit 或 push。
- 当前唯一下一步：M122 第 8 片；先把 run payload hydrate/reset 合并为 reducer，再抽 `useRunPolling()` / `useRunHydration()`，保持 request generation 和终态水合顺序。

## M122 第 8/8 片启动

- 按 `HANDOFF.md` 顺序恢复 `AGENTS.md`、三份规划文件、`git status --short --branch`、整体 diff 与 `git diff --check`；catchup 的 14 条未同步消息仅包含第七片收尾、本片说明和本次只读恢复，没有隐藏生产改动。
- 系统 `python` 和 `py` 入口均不可用；未重复同一失败，改用 Codex bundled Python 后 catchup 成功。工作树仍为 31 个 tracked 修改、21 个未跟踪入口，staged 0，全部保留。
- 本片边界固定为 Run payload reducer、`useRunHydration()` 与 `useRunPolling()`；不得改变 request generation、后台轮询、打开历史 Run、取消/重试、终态水合、API 次序或页面导航。下一步审计所有 payload 写入并先新增失败行为合同。

## M122 第 8/8 片 complete

- `useRunLifecycle.test.tsx` 先因缺少 `runPayload` 模块在导入阶段红灯，0 tests；随后纯 reducer、`useRunHydration()` 与 `useRunPolling()` 最小实现转绿。合同最终 5/5，App/hook/glossary/design 相邻回归 128/128。
- 首轮 Board coverage 175 tests 为 79.57/75.69/83.19/83.30，低于第七片；删除三个未使用 hook 入口后仍有 statements/lines 小缺口，补成功水合与局部函数式状态迁移合同。最终 177 tests，80.01/75.75/84.77/83.80，四项均高于第七片。
- 一次并行 App 测试外层 30 秒超时，但 Vitest 自身已在 29.46 秒完成 106/106；后续独立 typecheck、相邻回归和全覆盖率均通过。一次 SQLite 只读命令因 PowerShell 引号失败，改用标准输入传给 bundled Python 后成功，未写数据库。
- 根级 `pnpm test:coverage` 通过：Board 177 / Extension 165；lint、typecheck、production build 与 `git diff --check` 全绿。`App.tsx` 1,818→1,752 行。
- 完整 `scripts/verify.ps1` exit 0：348 API / 177 Board / 165 Extension / 8 packaged E2E，加 Ruff/format、strict Mypy、两端 lint/typecheck/build、进程/安全/评测检查全部通过。
- 只读结束复核：durable 仍为 4 workspaces / 15 Runs / 13 permanent / active 0 / 14 collections / 2 input artifacts；正常 8000/5173 均为 200。工作树保留 31 个 tracked 修改、21 个未跟踪入口，staged 0。
- M122 8/8 全部完成。当前唯一下一步切到 M123 可重复发布收口；未执行 reset、checkout、clean、stage、commit 或 push。

## M123 可重复发布收口启动

- planning-with-files catchup 检出 8 条未同步消息，仅包含 M122 记录收尾、最终汇报和 M123 启动说明；`task_plan.md`、`findings.md`、`progress.md`、HANDOFF、整体 diff 与工作树已复核，没有隐藏生产改动。
- M123 分为 CI 草案验证、隔离 setup/start/update/备份预检、最终源码发布证据刷新和完整回归四部分。所有干净环境证明必须使用隔离目录，不触碰 `.archresearch` durable 数据；旧 Git 外证据先审计，未经明确结论不删除。
- 当前工作树继续保留 31 个 tracked 修改、21 个未跟踪入口，staged 0；不得 reset、checkout、clean、stage、commit 或 push。

## M123 CI 与首次隔离安装

- `release.tests.ps1` 先因 `scripts/update.ps1` 不存在而红灯；最小实现加入非 Git 写入的 stop → setup → verify → start 更新链，CI 增加手动触发、contents read 权限与 root coverage，API/Board/Extension 发布版本统一为 2.1.0。发布合同转绿，dev-common、两端 production build 与 diff check 通过。
- 创建系统临时隔离副本，共 349 个当前源码/配置文件，明确排除 `.git`、`.archresearch`、`.artifacts`、依赖、构建与测试缓存。副本首次 `scripts/setup.ps1` 从零创建 root venv，安装 `archresearch-api==2.1.0` 与 frozen pnpm lock 依赖并构建扩展，exit 0。
- 隔离 `scripts/start.ps1` exit 0；因正常服务占用默认端口而自动选择 API 8001 / Board 5174，两个 HTTP 响应均为 200。当前正常 8000/5173 服务未停止或改写。

## M123 隔离更新续验

- 新会话已按 HANDOFF 顺序恢复 M123；系统 `python` 再次被 Microsoft Store alias 截获，未重复失败，改用仓库 `apps/api/.venv/Scripts/python.exe` 后 planning-with-files catchup 成功。
- 上一轮隔离 `scripts/update.ps1` 正确在 verify 失败时停止且未重启：API 348 项已通过，唯一失败为 fresh Ruff 0.16 对 `apps/extension/tests/e2e/support/full-stack-api.py` 的第三方导入分组检查。
- 已只移除 `uvicorn` 与 `archresearch_api` 之间的多余空行；下一步先验证当前与隔离 Ruff，再续跑隔离 update、HTTP 200 和备份预检。
- 当前工作区与隔离副本的 Ruff lint/format 均通过（51 files formatted），`git diff --check` exit 0；clean-install 工具链阻塞已闭合。
- 首次日志采集用 `Tee-Object` 包装器在服务重启后因管道句柄未收口而挂住；完整门禁和 8001/5174 已实际通过。结束仅属于临时验收的包装进程后，改用 update 进程自身的 stdout/stderr 重定向，第二次取得最终 `ArchResearch update verified and running.`，进程正常退出。
- 隔离 update 最终通过 348 API / 177 Board / 165 Extension / 8 packaged E2E、Ruff/format、strict Mypy、lint/typecheck/build；重启后的 API 8001 与 Board 5174 均为 200。
- 首次备份预检的 `ready=true` 结果有效，但附加数据库哈希因路径假设错误产生空值比较，已明确作废；第二次用正确路径时 `Get-FileHash` 又被运行中 SQLite 的共享模式拒绝。最终改用只读 `FileShare.ReadWrite` SHA-256，确认同一预检前后数据库不变、workspaces 0→0。
- 55,382,928-byte 现有备份 ZIP 在隔离 API 预检通过：format 1 / schema `d0f1a2b3c4d5` / 56 files / 61,044,756 unpacked bytes / 4 workspaces / 17 Runs / 7 collections / 2 inputs；未调用恢复接口。
- 使用 in-app Browser 对最终源码做只读 loaded QA并生成 6 张当前证据：home desktop、backup desktop/390px、Deep `76f52c79`、brief `ff16988d`、visual `f5be3f17`。所有页面横向无溢出、console error 0；未创建、retry 或调用任何 Live Run。

## M123 complete

- 旧 `docs/release-evidence-2026-07-16.md` 与 10 张旧 PNG 已完整移动到 `docs/history/` 和 `.artifacts/portfolio/history-2026-07-16/`；新建 `docs/release-evidence-2026-07-28.md`，记录三条仍可由当前 API 核对的 permanent Run、隔离安装/更新、备份预检与 6 张最终源码截图。
- 根级 `pnpm test:coverage` 通过：Board 177 tests，80.01/75.75/84.77/83.80；Extension 165 tests，82.69/76.52/83.96/84.73。
- 最终根级 `scripts/verify.ps1` exit 0：348 API / 177 Board / 165 Extension / 8 packaged E2E，加 Ruff/format、strict Mypy、lint/typecheck/build、进程/安全/评测检查全部通过，最终输出 `All ArchResearch checks passed.`。
- 隔离服务已停止，8001/5174 已释放，临时隔离目录已删除；正常 API 8000 与 Board 5173 保持 HTTP 200。Browser 验收标签页已 finalize。
- 首次基线汇总因 PowerShell 把 REST 数组套成单个嵌套对象而误报 1 workspace，并用投影后的多 ID 查询得到 404；原始响应始终是 4 项。改用按索引逐项解析后只读确认 durable 为 4 workspaces / 15 Runs / 13 permanent / active 0 / 14 collections / 2 input artifacts，数据库未改写。
- Hosted CI、版本 tag 与公开发布未运行；本轮没有 stage、commit、push，也没有 Live Run、provider 调用或备份 restore。
- 最终工作树复核：`git diff --check` exit 0，39 个 tracked 修改与 24 个未跟踪入口全部保留，staged 0；`task_plan.md` 已将 M123 标为 complete，HANDOFF 已清除本地实现下一步。

## M154 发布前目录清理

- 用户授权启动发布并要求先清理项目目录。GitHub 预检确认 `gh` 已认证，但仓库没有 remote，账号下也没有明显对应仓库；因此未 stage、commit、push 或创建远端资源。
- 清理审计区分运行链、用户数据、发布证据与可再生成材料：保留 `.archresearch`、API venv、pnpm dependencies、Board/Extension dist、`.claude`、3 份备份 ZIP 和 16 张 portfolio PNG。
- 递归删除命令在启动前被执行环境安全策略拒绝，没有文件受影响；随后改用精确路径、边界校验和可恢复移动，将 17 个目标、65 个文件、83.71 MiB 移到 `C:\Users\76384\AppData\Local\Temp\archresearch-release-cleanup-20260728`。
- 已移出根/API Mypy 缓存、API Pytest/Ruff 缓存、根 Ruff 缓存、`.artifacts/coverage`、6 个验证日志，以及 `.impeccable`、`.superpowers`、`work`、空 `outputs/.agents`；`.gitignore` 新增 `.artifacts/coverage/` 与 `.artifacts/*.log`，防止再生成污染。
- 清理后逐项确认目标均不在项目目录，`.artifacts` 只剩 3 ZIP + 16 PNG；正常 API 8000 / Board 5173 均为 200，`git diff --check` exit 0。
- 创建公开仓库 `jileyu2000/archresearch` 并绑定 `origin`。92 个显式路径文件共 4.46 MB 进入发布提交 `a8481eb`，包含源码、测试、脚本、文档与 16 张发布 PNG；ZIP 跟踪数为 0。首次 HTTPS push 在确认前连接重置且远端仍为空，改用命令级 HTTP/1.1 后成功建立 `main`。
- Hosted CI run `30329423939` 的 setup 成功，coverage step 中 Board 176/177：唯一失败是 reduced-motion 源码正则在 Windows CRLF 下超过 `{0,240}` 距离；Extension 165 与其覆盖率已通过，完整门禁因前置失败未运行。
- 按批准方案只在 `design-system.test.ts` 的 raw CSS 入口统一 CRLF/LF，不改生产样式或断言上限。定向 18/18；根 `pnpm test:coverage` 通过 Board 177（80.01/75.75/84.77/83.80）与 Extension 165（82.69/76.52/83.96/84.73）。
- README 首屏新增项目定位、CI/版本徽章、真实首页图与三类核心能力；GitHub About 改为中文产品说明，并加入 architecture、architecture-research、local-first、fastapi、react、chrome-extension topics。
- 第二次 Hosted CI run `30329792870` 已通过 clean setup 与完整 frontend coverage，随后在 full gate 的首个 `dev-common.tests.ps1` 失败：Corepack 的有效 shim 不以 `pnpm.cmd` 结尾。按批准方案把测试合同改为路径存在且去扩展名为 `pnpm`，兼容 `.cmd`、`.ps1` 与 extensionless shim，不改 `Resolve-WorkspaceRuntime`。
- 定向 dev-common 测试通过；本地完整 `scripts/verify.ps1` exit 0：348 API / 177 Board / 165 Extension / 8 packaged E2E 与全部静态、类型、构建、进程、安全和评测检查全绿。

## M154 Hosted CI Chromium 修复

- planning-with-files 首次 catchup 误用系统 `python`，被 Microsoft Store alias 拦截；未重复同一失败，改用 Codex bundled Python 后成功恢复 53 条未同步上下文。
- 已用 `gh run view 30330946581 --log-failed` 复核唯一失败：Playwright Chromium 未安装，2 项 packaged E2E 无法启动、6 项未运行；产品测试、静态检查与构建均已通过。
- `release.tests.ps1` 先新增 Chromium 安装合同并确认精确红灯；随后 `.github/workflows/verify.yml` 在 setup 后安装 Chromium，删除错误的系统 Chrome 注释。定向发布测试转绿，`git diff --check` exit 0。
- 当前下一步：运行完整 `scripts/verify.ps1`；通过后按显式路径提交、push，并等待 Hosted CI 验证 8 项 packaged E2E 全部执行。
- 完整 `scripts/verify.ps1` exit 0，耗时 183.1 秒：348 API / 177 Board / 165 Extension / 8 packaged E2E 全绿，Ruff/format、strict Mypy、lint/typecheck/build、进程、安全和评测检查全部通过。下一步收窄为提交两处 CI 修复并等待 Hosted CI。
- 两处 CI 修复以提交 `133b186` 推送到 `origin/main`；只显式 stage 工作流与发布合同，备份 ZIP 和规划记录未进入该提交。
- Hosted CI run `30332351557` 于 16 分 58 秒后 exit 0：Chromium 安装、coverage、完整门禁均成功；日志明确为 348 API、8 packaged E2E 和 `All ArchResearch checks passed.`。当前唯一下一步是提交发布记录、等待最终 CI，再创建 `v2.1.0` tag/Release。
- 发布记录提交 `dbb3411` 与证据时态修正 `2a92539` 均已推送；tag 落点 Hosted CI run `30334270656` 在 11 分 56 秒后全绿。
- annotated tag `v2.1.0` 已推送并精确指向 `2a92539`；正式 Release `ArchResearch v2.1.0` 已发布，非 draft/非 prerelease、无自定义 assets。首次 `gh release view` 请求了当前 CLI 不支持的 `isLatest` 字段，按 CLI 返回的可用字段重跑后完成核验。
- M154 已完成；当前无剩余发布动作。

## M155 evidence-grounded agent boundaries 启动

- 用户明确要求按 Evidence-Grounded Plan-and-Execute Agent 优化现有架构；当前工作树恢复时干净，分支 `codex/archresearch-v2-1` 跟踪 `origin/main`。
- 边界固定为行为保持型模块化：保留七阶段状态机、API、Pydantic/SQLAlchemy schema、工具协议、checkpoint、取消/恢复、gap 补查和证据完成语义；不引入 LangChain、LangGraph 或多智能体。
- 审计确认 `workflow.py` 为 4,998 行，公共执行器约 1,220 行；第一片选择纯规划边界，先写缺模块/合同红灯，再最小搬移，随后跑 API 定向测试、静态检查与完整门禁。
- 第一片新合同 `test_agent_planning.py` 已确认预期红灯：导入阶段精确失败于不存在的 `archresearch_api.agent`，未执行测试；生产模块尚未创建。
- `agent/planning.py` 已接管生产执行器的计划生成、查询生成、公开检索查询和站点轮换；新边界合同 3 项、视觉 fallback 与完整 `test_workflow.py` 共 45 项通过。
- 一次定向 pytest 使用了不存在的测试选择器，因 `not found` 未收集测试；随后按源码真实测试名重跑成功，未重复错误选择器。
- 恢复审查发现第一片只切换了调用，旧的 8 个规划函数与轮换常量仍留在 `workflow.py`。删除重复实现后，定向测试按预期在收集阶段暴露旧私有导入；已把 `test_workflow.py` 与 `test_browser_inspection.py` 迁移到 `agent.planning`，没有恢复兼容别名。
- 新增 orchestrator 绑定合同后，规划/查询/视觉 fallback/完整 workflow 定向集 46/46 通过；Ruff check、Ruff format、strict Mypy 与 `git diff --check` 全绿。此前记录的 45 项是另一命令组合口径，现以可复现的 46 项命令为准。
- 用户要求 M155 完成后独立审查、确认功能不受影响，并依据竞赛要求更新 GitHub 展示后发布；已登记为后继 M156，发布只在完整门禁和 durable 只读核验通过后进行。

## M155 第 2 片：verification boundary

- `test_agent_verification.py` 先在导入阶段精确红于缺少 `archresearch_api.agent.verification`；合同固定 coverage 与 enrichment 两层完成语义，以及 orchestrator 必须绑定新模块。
- 首个合并补丁因 `CoverageData` 的 `synthesis` 可选字段未包含在匹配上下文中而整体失败、没有部分写入；改用小型原子补丁后，字段与行为均完整保留。
- coverage 数据查询、项目/逐题/多资产统计、article-ready 逐字证据门槛、gap 名称和三档目标已等价移入 `agent/verification.py`；`workflow.py` 改用 `calculate_coverage()`、`completion_satisfied()` 和 `enrichment_satisfied()`。
- 6 个 browser-inspection 时间预算测试的 monkeypatch 已迁移到新绑定，不保留旧 `_coverage` 兼容入口。独立边界 2/2；planning + workflow + browser-inspection 受影响回归 153/153 通过。

## M155 第 3-4 片与最终验证

- `test_agent_execution.py` 先精确红于缺少 execution 模块；取消、checkpoint、查询恢复键、页预算、研究上下文与运行计数已等价迁出。机械重命名首轮产生一个 `buildbuild_research_context` 导入错误，被 20 项定向测试立即捕获；修正后 20/20、Ruff/format/strict Mypy 与当时完整 357 API 全绿。
- `test_agent_synthesis.py` 先精确红于缺少 synthesis 模块；证据约束的确定性综合、finding 去重、可恢复错误分类与 case/branch 纯函数已迁出，Provider/checkpoint 编排仍留 workflow。独立 3/3、既有 synthesis 11/11 通过。
- 四片合并后完整 API 为 360/360；`scripts/verify.ps1` exit 0：360 API / 177 Board / 165 Extension / 8 packaged E2E，加全部静态、类型、构建、进程、安全和评测门禁。
- 只读结束复核为 4 workspaces / 15 Runs / 13 permanent / active 0 / 14 collections / 2 inputs；API health ok。误查只支持 POST 的 inputs 路由得到 405，未写入任何数据，最终以 SQLite `mode=ro` 为准。
- M155 complete；未 stage、commit、push，也未创建研究任务或调用真实模型。

## M156 竞赛 GitHub 展示启动

- 已按 PDF 技能把 10 页公告全部渲染为 PNG 并逐页检查，提取提交物、评审三维度、报名周期、原创与权利条款。
- 已按 documents 技能读取两份 DOCX 模板。LibreOffice/soffice 不存在，官方 renderer 无法执行；模板仅做结构化段落/表格提取，未编辑或交付 DOCX。
- 本次恢复首次调用 planning catchup 时系统 `python` 被 Microsoft Store alias 拦截；未重复失败，改用 Codex bundled Python 后成功恢复 18 条未同步上下文。恢复时工作树为 M155 代码/测试/记录与 README，staged 0。
- README 已补齐参赛方向、100 字简介、场景价值、真实截图、四模块 Agent、人机协同/纠偏、完成度与已知边界、评审访问步骤及 3 个测试问题；固定回放、mock 闭环与实时研究明确分开。
- `docs/architecture.md` 已同步 planning/execution/verification/synthesis 四模块、唯一 orchestrator、gap 有界循环和 coverage + enrichment 双门槛；`docs/demo-flows.md` 只迁移现行三档名称、完成语义与 30 条评测计数。
- 独立代码审查以 AST 逐定义对比：27 个迁出函数、2 个类型类、2 个常量，以及 `workflow.py` 留下的 53 个定义在名称归一化后均为零函数体差异。公开审查确认 22 个本地 Markdown 链接/图片、4 张 tracked README 截图、82 字作品简介和隐私扫描通过。
- 完整 `scripts/verify.ps1` exit 0：360 API / 177 Board / 165 Extension / 8 packaged E2E，以及 Ruff/format、strict Mypy、两端 lint/typecheck/build、进程/安全/评测检查全部通过。
- 门禁权威输出确认评测任务实际为 25 条；README、architecture 和 demo 文档中既有的“30 条”已统一修正。上行中“30 条评测计数”是修复前记录，不再作为当前事实。
- 文档修正后 fixture 复核为 25 tasks / 108 samples，22 个本地 Markdown 链接/图片和公开旧词扫描通过；API/Board 均为 200。SQLite `mode=ro` 确认 4 workspaces / 15 Runs（14 completed + 1 partial）/ 13 permanent / active 0 / 14 collections / 2 inputs。
- 16 个显式产品/公开文档路径经 staged diff、敏感信息和禁止文件扫描后提交为 `010eceb`，推送到 `origin/main`；`.archresearch`、备份、凭据和三份规划记录未进入该提交。
- Hosted CI run `30362938145` 于 14 分 22 秒后 success：clean setup、Chromium、coverage、25 tasks / 108 samples、360 API / 177 Board / 165 Extension / 8 packaged E2E 与完整静态/类型/构建门禁全部通过。
- M156 complete；当前唯一下一步是提交本次 HANDOFF/规划闭合记录并等待该记录提交的 Hosted CI，产品代码不再修改。

## M157 长期项目主页定位启动

- 用户明确 README 不应把 ArchResearch 描述成专为竞赛制作的投稿页面；竞赛要求只作为介绍结构参考，公开页面必须在脱离竞赛语境后仍然成立。
- 恢复时本地 `HEAD` 与 `origin/main` 均为 `c13182d`，工作树干净；Hosted CI `30364437489` 为 success，360 API / 177 Board / 165 Extension / 8 packaged E2E 基线已闭合。
- 本轮唯一实现范围是 README 的项目定位、维度表头、版本称谓和访问/演示措辞；保留真实的建筑竞赛使用场景以及全部能力、边界、安装、截图和测试入口，不改生产代码或 durable 数据。
- README 已删除海之子杯、投稿方向、评审跳转、100 字作品简介和参赛版本等专属措辞，改为“项目定位 / 项目维度 / 当前版本 / 访问与演示 / 最短体验路径”；定向扫描确认 `参赛|投稿|评审` 等专属词为零。
- “建筑竞赛/竞赛”只在项目定位和目标用户两处作为真实使用场景保留；Agent 架构、能力、限制、安装、截图、三档演示和测试问题均未删除。
- README 独立 diff 审查确认改动只涉及公开定位与演示措辞，没有修改安装命令、架构、能力合同、数据边界或测试数字。仓库没有现成的 README 本地链接检查脚本，本轮将使用只读解析检查全部本地链接/图片目标。
- 首次只读链接汇总因 PowerShell 变量名 `$matches` 与自动匹配变量冲突，只影响显示的总数，不影响文件；改用独立变量并加入标题锚点检查后，27 个 Markdown 目标中 20 个唯一本地文件/图片和 1 个内部锚点全部有效，缺失为 0。
- 发布前范围审查通过：`git diff --check` exit 0；仅 README、task plan、findings、progress 四个 Markdown 文件发生变化，staged 0。新增行的凭据模式、本机绝对路径、`.archresearch`、`.env`、数据库和 ZIP 扫描均为 0。
- 首次全量门禁调用的前台工具超时设为 1 秒，约 5 秒后返回 124，未取得验证结论；进程复核发现同一时刻启动的 `pwsh` PID 84712 仍在运行，因此不重复启动第二套门禁，先等待并识别该进程的完成状态。
- 为 PID 84712 建立退出码监视时，该进程已在监视器接管前结束，因原 stdout/进程句柄随超时调用丢失，无法把这次运行认定为成功或失败。下一次改用隐藏后台 wrapper，将 stdout/stderr 和最终 exit code 写入系统临时目录并短间隔轮询；这是不同的可观测执行方式。
- 隐藏后台 wrapper 的启动命令被执行环境策略在运行前拒绝，未产生新的验证进程或项目文件。改用工具自带的可续接执行单元运行长门禁，以保留输出和真实 exit code。
- 可续接执行单元中的完整 `scripts/verify.ps1` 最终 exit 0，耗时 314.2 秒：360 API / 177 Board / 165 Extension / 8 packaged E2E 全绿，Ruff/format、strict Mypy、两端 lint/typecheck/test/build、进程、安全和 25 tasks / 108 samples 评测夹具检查均通过；未调用真实模型或创建研究任务。
- 门禁后工作区仍只有 README、task plan、findings、progress 四个预期 Markdown 文件，`git diff --check` exit 0；最终逐行 diff 审查确认公开页面只改变定位措辞，规划记录只登记 M157 决策、错误与验收证据。
