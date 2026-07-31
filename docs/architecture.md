# ArchResearch Web Edition 架构

> 当前对外产品只有 Cloudflare Web Edition。本文后半部分保留 FastAPI/SQLite 和本地浏览器适配器的源码边界，供维护者运行离线测试或迁移旧数据；这些组件不属于公开安装路径，也不代表普通用户需要安装或配置本地服务。

## 产品边界

ArchResearch Web Edition 面向建筑学生与青年设计师。用户打开项目方提供的 HTTPS 地址，输入具体设计问题和可选的图片、PDF、URL，在限定轮数、查询数、页面数与时间内研究公开网页，识别建筑图纸并把来源证据编排成参考板。工作区、Run、结果、收藏与备份长期保存在当前浏览器，云端只保留有界执行所需的短期检查点。

系统不建设平台案例库，不维护跨项目图片索引，不把收藏或拒绝记录变成公共语料，也不引入 PostgreSQL、Redis、S3、Qdrant、Celery、Docker、LangGraph 或多 Agent 运行时。

## 运行组件

```mermaid
flowchart LR
    U["用户"] --> B["React 完整工作台<br/>apps/board"]
    B <-->|"PublicApiClient + IndexedDB"| W["Cloudflare Web Edition<br/>apps/web + apps/edge"]
    W -->|"有界 HTTPS 读取 / Workflow"| O["项目方 Provider Secret"]
    B <-->|"严格公共 bridge"| E["ArchResearch Chrome 扩展<br/>apps/extension"]
    E -->|"用户授权的可见页与登录态"| X["小红书公开笔记"]
```

| 组件 | 职责 | 不负责 |
|---|---|---|
| 参考板 | 工作区输入、后台运行状态、答案优先的案例阅读、个人收藏、2–6 项案例策略对照、表达规范与导出 | 自行抓网页、决定来源可信度 |
| Cloudflare Edge | Turnstile、配额、预算、七阶段 Workflow、公开页读取、Provider 调用和短期 checkpoint | 保存跨用户长期历史、接收浏览器 Cookie |
| Chrome 扩展 | 在用户动作授权后打开页面、读取受限语义快照与元数据、枚举媒体、滚动、裁取候选区域 | 读取 Cookie/LocalStorage/密码/私信，发布、点赞、购买或提交普通表单 |
| 公共网页读取 | 在 Edge 中按子问题读取受限 HTTPS 正文、链接、图片 URL 与图注 | 用户 Chrome 登录态、任意交互、来源/版权升级、批量站点爬取 |
| Chrome 扩展 | 使用用户已登录的小红书页面完成有界只读搜索、逐帖逐图读取与预览 | 读取 Cookie/密码/私信，点赞、评论、发布或提交普通表单 |
| IndexedDB / OPFS | 保存当前浏览器的 workspace、Run、收藏、结果、备份与较大附件 | 跨用户召回或平台级案例库 |

公共页面只接受 HTTPS 同源、版本化且字段严格的扩展消息。扩展首次由用户在工具栏点击“连接当前 ArchResearch 网页”，动态注册当前页面 origin；不使用本地端点或一次性配对码，Cookie、账号和密码始终留在 Chrome。

## Evidence-Grounded Plan-and-Execute Agent

Cloudflare Edge Workflow 内只有一个七阶段 orchestrator，不运行自主多 Agent 网络。Evidence-Grounded Plan-and-Execute 的四个职责边界由共享 Python 模块与 Edge adapter 对齐；模型负责适合语言推理的规划、页面分析、视觉分类与综合，确定性代码负责状态、预算、工具权限、证据准入和终态判断。

```mermaid
flowchart TB
    U["问题 / 任务书 / 深度"] --> P["Plan<br/>拆题、查询、可信站点轮换"]
    P --> E["Execute<br/>预算、工具、checkpoint、恢复"]
    E --> V["Verify<br/>逐题 coverage + enrichment"]
    V -->|"缺口存在且预算允许"| E
    V -->|"双门槛通过或预算结束"| S["Synthesize<br/>只消费证据绑定材料"]
    S --> R["案例答案 / 对照 / 收藏 / 灵感板"]
```

| 代码边界 | 职责 |
|---|---|
| `agent/planning.py` | 规范化 typed plan、确定性 fallback、查询生成和公开建筑站点轮换 |
| `agent/execution.py` | 取消检查、checkpoint、研究上下文、查询恢复键、页面预算和运行计数 |
| `agent/verification.py` | 逐题覆盖统计、正式项目/资产门槛、正文分析丰富度和双层完成判定 |
| `agent/synthesis.py` | 证据约束的确定性综合、finding 去重、case/branch 纯函数和可恢复 fallback |
| `workflow.py` | 唯一 orchestrator；保留 Provider、浏览器和持久化编排，固定七阶段顺序 |

Provider 调用继续封装在小型具体客户端之后，默认使用确定性 mock。架构不依赖 LangChain、LangGraph、OpenAI Agents SDK 或多 Agent 运行时；缺口循环只发生在 `gap_check`，并受查询、页面、轮次与时间预算共同约束。

## 研究状态机

```mermaid
stateDiagram-v2
    [*] --> created
    created --> planning
    planning --> searching
    searching --> inspecting
    inspecting --> analyzing
    analyzing --> verifying
    verifying --> gap_check
    gap_check --> searching: "存在证据缺口且预算允许"
    gap_check --> composing: "覆盖达标、无新增或预算耗尽"
    composing --> completed: "覆盖与正文丰富度达标"
    composing --> partial: "已有可用资产"
    composing --> blocked: "没有可用资产"
    created --> cancelled: "用户取消"
    searching --> cancelled: "用户取消"
    inspecting --> partial: "后续失败且已有资产"
    inspecting --> failed: "失败且没有资产"
```

每个阶段向短期 Workflow checkpoint 提交最小状态并写入脱敏 `TraceEvent`；进入 `gap_check` 时还把当前覆盖计数写回 Run，Board 轮询期间即可显示已取得的可用参考数。新建 Run 从创建日起默认保留一学期（180 天），可由用户单独改为永久保留；长期 Run/result/collection/history 仍由当前浏览器 IndexedDB 保存。`partial`、`blocked`、`cancelled` 和 `failed` 可重试；重试增加 `attempt`，保留已有资产与证据。

默认预算：

| 模式 | 轮次 | 查询 | 页面 | 时间 |
|---|---:|---:|---:|---:|
| 快速找方向 (`quick`) | 2 | 6 | 12 | 30 分钟 |
| 形成方案依据 (`balanced`) | 3 | 12 | 30 | 30 分钟 |
| 做跨案例论证 (`deep`) | 4 | 24 | 60 | 30 分钟 |

建筑研究的完成目标按 `quick / balanced / deep` 分别为 3 / 4 / 6 个研究问题、6 / 12 / 18 张可用资产、3 / 4 / 6 个正式项目以及 4 / 6 / 9 张 `verified` 或 `partial` 资产；覆盖与正文分析丰富度必须同时达标。页面正文即使证据链完整，也只有在可比较尺度上直接回答当前子问题时才进入正式案例；纯类比页面保留为线索而不抬升。连续两批无新增资产仍会停止并交付已有结果。

## 数据与证据

```mermaid
erDiagram
    Workspace ||--o{ InputArtifact : contains
    Workspace ||--o{ ResearchRun : starts
    ResearchRun ||--o{ QueryAttempt : records
    ResearchRun ||--o{ SourcePage : visits
    ResearchRun ||--o{ AssetCandidate : finds
    AssetCandidate ||--o{ EvidenceClaim : supports
    Workspace ||--o{ SavedReference : keeps
    ResearchRun ||--|| ReferenceBoard : composes
    ReferenceBoard ||--o| StyleProfile : derives
    ResearchRun ||--o{ TraceEvent : traces
```

每张候选图分别记录发布来源等级、项目身份、图片—项目归属、首发来源、权利状态和结果等级。来源可信度与使用权利是两个独立维度。

来源检查采用任务意图优先，而不是固定的 publication tier 排序。`precedent_research` 在同轮不同查询间轮换 ArchDaily、Designboom、Dezeen、Divisare、ArchDaily China，再读取项目官网与可信建筑媒体正文；轮换只扩大候选面，不降低证据准入。事实声明逐条绑定 URL 与逐字引文，项目档案可把同一项目的主文章与一次定向补查所得的最多两个可信文字页合并，项目身份不一致时拒绝合并。`transfer_strategy` 是基于已取证机制的研究转译，模型 relevance 只参与排序。已有引用答案但局部分支仍空缺时终态为 `partial`，不会因未达到全覆盖而整体 `blocked`。图片只是文字覆盖完成后的可选预览与跳转入口，不证明机制；缺图或配图不精准不会阻止案例证据。`visual_reference_search` 先把“我想出一张轴测图，帮我找风格”“效果图怎么出”等宽泛需求规划为互不重复的表达风格方向；用户点名图纸类型时所有方向固定该类型，只有未点名时才选择合适类型。随后检查用户授权的小红书可见页面，逐图提取配色、线型、版式、形体推演和分析图语言。每个方向一次 ranked search，按 rank 最多尝试四篇笔记，累计三篇产生可用资产的帖子后停止；每帖最多四图，整条 Run 共享 48 个逐图检查槽位 / 48 MiB 预览预算。OpenCLI 失败或空结果时只回退 ArchResearch 扩展，两条小红书路径都不可用时诚实终止，绝不把 XHS-only 任务降级成通用网页研究；容量耗尽返回 `visual_budget_exhausted`，真实运行截止时间才使用 `time_budget_exhausted`。小红书资产始终保持 `visual_lead`、未知项目归属与未知权利，并在 Board 中按灵感方向进入独立视觉灵感板，不进入项目档案或项目数量。

正式事实必须绑定 `EvidenceClaim` 的 URL 或 PDF 页码。结果卡把以下内容分开：

- 来源支持的事实；
- 图像中直接可见的观察；
- 设计方法推断；
- 与用户项目不同的条件和适用边界。

模型输出不能自行把项目归属、首发来源或版权提升为已确认状态。分享导出只完整嵌入 `user_owned`、`open_license` 或 `permissioned` 图片；其他图片确定性降级为来源卡、署名和链接。

## 浏览器协议与不可信网页

扩展只接受版本化、字段严格的动作：`open_url`、`wait`、`page_metadata`、`page_snapshot`、`enumerate_media`、`scroll`、`safe_click`、`capture_region`、`type_search_query`、`close_tab`。`page_snapshot` 最多返回 40 个可见标题、正文段落和图注，总计不超过 6000 字符，并沿用敏感页面禁读规则。协议拒绝额外字段、任意选择器、JavaScript、凭据和私网 URL。

网页标题、正文、图注和隐藏文字全部是数据，不能修改工具权限、系统指令、预算或停止条件。API 和扩展都检查导航 URL；API 还解析 DNS，阻止回环、私网、链路本地、保留地址和 IPv4 映射地址。云端模型只接收候选裁图、相邻图注和必要项目文字，不接收完整登录页面。

Chrome 的 `captureVisibleTab` 要求 `activeTab` 或 `<all_urls>`；Agent 的连续页面检查无法让用户逐页触发 `activeTab`。扩展因此只从自身弹窗或侧栏的直接用户手势申请可选 `<all_urls>`，授权会保留到用户主动撤销或卸载扩展。运行完成、取消、失败或断线仍会关闭扩展打开的研究标签页。这个平台权限只负责截图授权：`OpenUrlPayload`、API DNS 检查、扩展最终 URL 复核和脚本注入仍只接受公网 HTTP/HTTPS，`file:`、扩展页、回环、私网、保留地址和 IPv4 映射私网地址均被拒绝。

持续加载页面不再等到第一条研究命令才注入。`open_url` 先创建并在 `chrome.storage.session` 登记一个空白受管 tab，随后为该 tab 安装短生命周期 `tabs.onUpdated` loading 监听，导航到已校验的公共 URL，并用 `injectImmediately` 注入固定的 `assets/content.js`；最新导航的注入成功才返回 tab id。导航代次防止旧文档的迟到结果冒充新文档就绪，生命周期代次会拒绝研究终态后才完成的开页，释放注册时同步取消超时和重试。任何显式私网跳转都会立即失效并关闭该 tab，旧 WebSocket 的迟到命令结果也不能写入新连接。后续命令只发送枚举 DSL，避免重复后加载。该方案刻意不使用 origin 级动态内容脚本，因为 Chrome 动态注册不能按 tab 隔离。显式关闭、五种研究终态、断线、撤权、外部关 tab 与工作线程恢复都会释放监听并清理会话记录；重启恢复在重新配对前先关闭遗留受管 tab。

Chrome broker、终态消息和受管标签在 V2.1 中是单连接资源，因此 API 明确采用全局单活研究租约。新建或重试会同时检查 SQLite 中的活动状态和进程内租约；冲突立即返回 409，不排队也不抢占。崩溃恢复按顺序继续未完成运行，终态通知在工作线程中等待扩展接收完成后才释放租约，避免上一轮终态清理下一轮标签。

## 留存

| 数据 | 默认留存 |
|---|---|
| 未收藏候选图块、临时 DOM、EvidenceClaim | 7 天 |
| 查询、来源元数据、Trace | 30 天 |
| Run 行 | 新建记录 180 天，可逐条设为永久；既有记录沿用已存日期 |
| 用户上传、SavedReference、ReferenceBoard、StyleProfile | 用户删除前 |

`keep_forever=1` 的 Run 连同其全部子数据豁免以上所有时钟（M141 修复）。

`InputArtifact` 属于 workspace，不只属于一次 Run。建筑研究没有 PDF 时，Board 继续在开始研究前保存当前场景提交的 URL/文件并直接创建 Run；URL 仅以研究线索字符串进入 planner/query，持久 PDF 最多抽取 2,000 字正文进入同一 research context。有 PDF 时，同一次“开始研究”先把文件、主问题和档位 multipart POST 到非持久化 `/v1/workspaces/{id}/brief-review`：API 在内存中校验大小与 PDF、最多读取 12,000 字，调用同一 typed planning provider 返回 `project_summary`、最多六条 `project_boundaries` 和与档位一致的 `ResearchSubquestion`。该内部请求不写 `InputArtifact`、不占用单活 Run gate，也不产生 ResearchRun；成功后 Board 立即调用现有 input upload 和 Run POST，并把 3/4/6 条 subquestions 放入 `ResearchSpec`。API 校验数量与唯一 id 后写入 `ResearchRun.subquestions`，workflow 的 checkpoint-first planner 直接使用它们而不重新规划。Board 不渲染 review 响应为新的用户界面；失败时保留表单并停止创建 Run，避免静默丢失任务书边界。建筑研究接受可选任务书 PDF 和案例 URL；`visual_reference_search` 不显示这组输入。切换 goal 清空尚未提交的 Board 表单，不删除既有 workspace artifacts。界面不得把 URL 描述为保证优先访问，也不得声称普通建筑研究或图纸灵感会视觉理解用户上传图片；建筑研究不添加 artifact 仍可仅凭问题开始。

`SavedReference` 是用户主动策展的个人收藏，不是记忆层。保存时把研究题目、研究目标和结果摘要写入 snapshot；建筑结果额外写入自包含的 `case_subquestions`，逐项保存子问题题目、项目条件、设计机制、转译步骤、适用边界及与条件/机制 statement 精确匹配的逐字原文，并写入最多三项 typed `case_images`。案例图片只从同一 Run、同一项目且已有 `image_url` 的正式 `AssetCandidate` 中选择：当前收藏资产优先，再优先补足不同资产类型，最后按既有顺序填满并按 URL 去重；它们是项目识别索引，不提升或替代逐题证据。Pydantic `SavedReferenceSnapshot` 是该响应结构的来源，Board TypeScript contract 与之对齐。既有 snapshot 在首次 workspace 收藏读取时，若原 AssetCandidate/Run 尚在，会分别只追加缺失的逐题包和案例图片并持久化兼容升级；没有精确 EvidenceClaim 时保持无原文，而不借用同项目其他分支。受控本地图仍复制到独立 `collections/` 目录，因此普通 Run 过期清理可以删除 checkpoint、候选和导出，同时保留可按收藏 ID 管理的收藏项、逐题研究内容和案例图片索引。一次前端提交完整保存新批次；保存是累加动作，不删除任何既有收藏（含同题旧批），删除只由用户对单项显式执行。Board 仍从同一个 workspace 聚合端点读取完整快照，并在内存中把建筑收藏展平为“原研究题目 + 案例子问题”目录项；选择状态只存在于当前 Board 页面，不写入 URL、数据库或新增 API。目录初始不渲染项目内容；点入后只把所选子问题映射为命名 region，项目保持独立 article，h2–h5 保留语义层级。界面只投影逐题设计机制和去重后的前三条转译步骤，并在其后显示紧凑案例图带。项目条件、完整边界和逐字证据仍在 snapshot 中，不因界面精简而删除。收藏类型切换、离开与重开会清除目录选择。收藏页可原位切换到只消费本地图或 image URL 的图纸视图。图纸灵感高清链接复用同一个安全 collection-content handler，本地副本缺失时才回退 snapshot image URL，原帖来源仍保持独立。该界面精简不新增表、列或 Alembic 迁移。

长期业务数据都在当前浏览器工作区内，不建立全局索引；云端只保存有 TTL 的执行 checkpoint 和临时素材。

## 供应商、隐私与维护者 mock

Web Edition 的 Provider 地址与 Key 由项目方部署配置，Key 只存在 Cloudflare Secret，不进入浏览器 bundle、IndexedDB、响应或 Trace。默认测试使用确定性 mock，不调用真实模型或公开网页；维护者可按 `docs/development.md` 运行源码测试和本地兼容层，但这不是普通用户安装路径。公开建筑网页由 Edge 的有界 HTTPS 读取完成；登录态小红书由 ArchResearch Chrome 扩展读取。

版本化评测夹具位于：

- `fixtures/queries/research_tasks.jsonl`：25 条人工研究任务，只是数据，不会自行联网；
- `fixtures/evaluation/classification`：108 张 CC0 合成 SVG 和九类标签；
- `fixtures/evaluation/project_brief_cases.json`：用户提供的真实任务书场景摘要、主问题和预期边界/问题术语，用于零成本验证内部任务书整理；
- `scripts/validate-evaluation-fixtures.ps1`：离线检查数量、枚举、文件哈希与确定性重生成。

## 参考实现取舍

架构借鉴成熟开源项目的可迁移模式，但没有直接引入它们的云基础设施或通用画布运行时：

| 项目 | 借鉴 | 明确不引入 |
|---|---|---|
| [Open Deep Research](https://github.com/langchain-ai/open_deep_research)、[GPT Researcher](https://github.com/assafelovic/gpt-researcher)、[STORM](https://github.com/stanford-oval/storm) | 有界研究阶段、覆盖缺口、可评测 Trace | LangGraph、多 Agent 自主循环 |
| [Karakeep](https://github.com/karakeep-app/karakeep)、[Linkwarden](https://github.com/linkwarden/linkwarden) | 混合资产加载、筛选、持久用户状态 | 全局书签库、跨任务语料 |
| [Zotero](https://github.com/zotero/zotero) | 资产、注释与来源定位保持绑定 | 通用文献管理功能 |
| [Excalidraw](https://github.com/excalidraw/excalidraw) | 持久画板状态与临时选择分离 | 无限画布依赖 |
| [Browsertrix Crawler](https://github.com/webrecorder/browsertrix-crawler) | 浏览器任务可恢复、失败显式 | 云端爬虫和批量抓取基础设施 |
| [Playwright](https://github.com/microsoft/playwright-python) | 系统 Chrome、隔离上下文、固定只读 DOM 提取 | 用户配置、任意脚本或第二个 MCP 浏览器服务 |
| [Playwright MCP](https://github.com/microsoft/playwright-mcp) | 有界语义快照、确定性工具 | 宽泛 MCP 工具面 |
| [Stagehand](https://github.com/browserbase/stagehand) | observe-before-act、动作可预览 | 第二套 AI 浏览器与自愈执行器 |
| [Browser Use](https://github.com/browser-use/browser-use) / Browser Harness、[Crawl4AI](https://github.com/unclecode/crawl4ai) | 长连接浏览器、结构化输出、内容过滤与可恢复会话 | 自主 Agent 循环、云端 profile 同步、自动验证码解题和大依赖面；同题实测后由更小的直接 Playwright 取代 |
| [Microsoft Playwright CLI](https://github.com/microsoft/playwright-cli)、[OpenCLI](https://github.com/jackwener/opencli) | 实测后采用 OpenCLI 的小红书结构化搜索、登录态 Chrome Bridge 与整组媒体下载 | Playwright CLI 的通用快照进程开销；OpenCLI 写操作与非小红书命令不进入产品工具面 |
| [BrowserAct](https://github.com/browser-act/browser-act) | 人工接管与失败显式化 | API Key 前置、不可完整审计的编译运行时、Cookie/代理/自动验证码能力 |
| [Steel Browser](https://github.com/steel-dev/steel-browser)、[Lightpanda](https://github.com/lightpanda-io/browser) | 会话隔离、生命周期清理 | Docker/云浏览器、WSL/Linux 浏览器、另一套 CDP 所有权 |
