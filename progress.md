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
