# Findings

> 本文件只保留当前产品仍有效的发现。退役 Web Edition、Cloudflare、Worker 版本和 M158–M178 排障记录已按用户要求直接删除，不再作为实现依据；确需追溯时使用 Git 历史。

## Current architecture

- ArchResearch 当前只有一个产品运行时：Windows/Chrome 本地应用。
- FastAPI 和 Python workflow 是唯一研究执行实现；SQLite 与本地文件是唯一持久化实现。
- Board 由安装版 FastAPI 在同一动态 loopback origin 提供，避免固定端口冲突和跨源配置漂移。
- Chrome 扩展只连接 loopback Board/API，负责用户明确授权的浏览器页面读取、裁图和登录态小红书能力。
- Provider 地址、用户从上游 `/models` 只读列表选择的模型和协商协议保存在本地配置；API Key 只进入 Windows Credential Manager。
- 建筑研究的事实必须绑定 URL 与逐字引文。图片只作预览和来源入口，不能单独证明建筑机制。
- 图纸灵感保持 XHS-only fail-closed，不使用普通网页图片代替失败的小红书路径。

## M179 restoration findings

- Web-only 迁移删除的不只是安装脚本，还影响 API 动态端口、Board WebSocket endpoint、扩展本地配对、packaged FastAPI E2E、CI、README 与发布合同；恢复必须覆盖完整本地链路。
- `1695973` 是最后一个已验证本地发行基线。恢复通过 `git show 1695973:<path>` 与定点补丁完成，没有 reset、checkout 或 clean。
- 本地恢复红灯先由缺失 `archresearch_api.desktop` 和 Windows 安装器脚本复现；恢复生产文件后，Desktop、API browser、Board bridge、Extension UI 和 packaged E2E 转绿。
- 本地 packaged E2E 的第 8 项真实启动 FastAPI、配对打包扩展、执行浏览器裁图并从本地资产端点读取 PNG，证明 Board/API/Extension 不是只通过 mock 拼接。
- Windows 安装器、独立扩展 ZIP、动态端口、Provider 首次配置和本地配对 UI 均已恢复。

## Retired runtime removal

- `apps/web`、`apps/edge`、`scripts/verify-web.ps1`、Wrangler 配置、`.wrangler`、旧 dist/node_modules/tsbuildinfo 已物理删除。
- Extension 公共 HTTPS bridge/controller、公共 XHS adapter、对应测试和 Vite entry 已删除；后台只分派本地 `ExtensionController`。
- Board 的 public-edition、Turnstile、公共视觉来源和前端直连公共 XHS 分支已删除。
- pnpm workspace 和 lockfile 只保留 root、Board、Extension；Wrangler、workerd 与 Cloudflare packages 已移除。
- 可执行代码、配置和面向用户文档扫描没有发现退役 runtime 残留。唯一命中是 `release.tests.ps1` 对这些路径不得返回的负向守卫。

## Provider configuration contract correction

- 新配置的三个字段是 API 接口地址、模型名称和 API Key；模型名称由同一接口的 `/models` 返回，桌面下拉框和 PowerShell 脚本都不接受手输模型 ID。
- 用户选择模型后，保存流程再次读取 `/models` 校验该模型存在，只对这一模型按 Responses、再 Chat Completions 顺序探测；不再把 `gpt-5.6-sol` 置顶，也不探测候选列表中的其他模型。
- `gpt-5.6-sol` 已重命名为语义明确的 legacy default，仅由 `ProviderConfig` 读取缺少模型字段的旧 JSON 时使用；新配置路径在没有模型选择时会在创建客户端前失败。
- CLI 的安全流程通过 stdin 接收 Key，先输出上游模型序号，再按序号完成配置；Key 不出现在参数、日志或输出中。
- 外部兼容 smoke 未保存配置：最新验证中服务根地址和带 `/v1` 的 `/models` 都返回 23 个模型；但根地址作为应用同款 OpenAI 客户端的 Base URL 时，`/responses` 探测失败，带 `/v1` 的 base URL 返回 23 个模型，列表中明确存在 `gpt-5.6-sol`，该模型的 Responses structured output 探测通过。正式新配置仍必须填写正确路径后缀并由用户从上游列表选择模型。

## Provider endpoint compatibility

- OpenAI 客户端把 `base_url` 当作 API 路径前缀；同一主机可能让根地址的 `/models` 可用，却只在 `/v1/responses` 提供生成能力。模型列表成功不能单独证明 Base URL 可用。
- 兼容层应只在用户输入的同一主机上尝试有限候选：原地址、追加 `/v1`，根地址再追加 `/api/v1`；每个候选先取模型列表，配置时只探测用户选中的模型，并保存能力探测成功的候选。
- DeepSeek 根地址是另一种有效形态：根地址模型列表和 Responses structured output 都可用，不能一律把用户输入改写成 `/v1`；候选顺序必须优先保留原地址，并以能力探测结果决定最终保存值。

## Verification

- 权威 `scripts/verify.ps1`：389 API / 178 Board / 165 Extension / 8 packaged E2E。
- Ruff/64-file format、strict Mypy、Board/Extension lint/typecheck/build、进程生命周期、安全、评测、manifest/protocol 与 Windows 发布合同全部通过。
- Windows 安装 smoke 验证真实 per-user 安装、桌面/开始菜单快捷方式、精简 `PATH` 下冻结程序 `--self-test`、安装包不含扩展，以及卸载后无程序残留。
- `/desktop-health` 与 `/health` 由冻结入口使用的同一 FastAPI desktop app 行为测试覆盖。
- `git diff --check` exit 0；远端 `main` 已为 `9196119`，本地 checkout 为 `agent/local-release-v2.2.2` / `HEAD=2429277`；本地 `origin/main` tracking ref 仍为 `87826af`，因为未 fetch/pull。

## Release candidate

- 扩展 ZIP：18,260 bytes，SHA-256 `9D554576B6DDAAD705EC4E66B1D948EB2305A749CAEFAE40144EC04D8FAD0902`。
- Windows 安装器：69,681,830 bytes，SHA-256 `F859C66720D0A493950653F2178E34C7955CBF7D838CD4569C36D994A30162A1`。
- 两个文件都只存在 `.artifacts/releases/` 并已上传到 [v2.2.2 Release](https://github.com/jileyu2000/archresearch/releases/tag/v2.2.2)；tag 指向 `5637ee0`，PR #11 已合并但没有重发 Release。

## Constraints

- 不恢复 Firecrawl、Web/Edge、Cloudflare 或公共 HTTPS 扩展桥。
- 不调用会导致桌面应用闪退的内部浏览器。
- 默认验证不读取用户 Cookie、Chrome 会话或 Provider Key，不创建或重试真实研究。
- 不 reset、checkout、clean、commit 或 push；不修改已发布的 `v2.2.2` Release，不调用内部浏览器，不恢复 Web/Edge 或 Firecrawl。
- 本轮只读复核曾假设根级 `tests` 和 `provider_runtime.py` 存在；实际路径分别是 `apps/api/tests`，Provider runtime 定义位于现有 credential 模块。错误命令未写文件，也未重复。

## GitHub Hosted CI coverage correction

- 推送 `367064b` 后，GitHub Actions run `30633778406` 的 coverage 步骤和完整 `verify` job 均成功；job `91166171854` 于 `2026-07-31 13:31:45 UTC` 完成。
- Hosted runner 还成功完成独立 Chrome 扩展 ZIP、Windows 安装器构建、安装 smoke 和附件上传；没有发现新的代码或发布合同问题。
- `v2.2.2` Release 仍使用 tag `5637ee0` 和原附件；coverage 测试只收口 PR 门禁，不需要重建或重发 Release。

## GitHub PR ready state

- 管理记录提交 `d52da0d` 已推送；PR #11 曾从 Draft 标记为 Ready，随后完成 squash merge，详见下方合并记录。
- 最新 Hosted CI run `30636022102` / job `91173717123` 于 `2026-07-31 14:09:09 UTC` 成功；文档状态同步没有引入代码或发布合同变化。

## GitHub PR merge

- PR #11 的最新 head `2429277` 通过 `verify` run `30637527995` 后，于 `2026-07-31 14:34:44 UTC` squash merge 到远端 `main`，merge commit 为 `9196119`。
- `v2.2.2` tag 和 Release 附件保持不变；本地 checkout 未自动切换到 `main`。

## Current user task: visual Run failure

- 本地数据库中的图纸 Run `06843b31-d478-4b82-959f-49c1f15e65be` 在规划阶段记录了 `planner_error_type=AuthenticationError`，随后三轮 `opencli-xiaohongshu` 搜索各返回 4 个帖子。
- 该 Run 的 12 次帖子图片处理全部失败：Trace 只记录了 `AuthenticationError` 或 `APIConnectionError`，并继续尝试 Chrome 读取；最终 `candidate_count=0`、`stop_reason=no_usable_assets`。因此“没有可用图纸”掩盖了 Provider 认证/视觉分析失败。
- 旧成功图纸 Run 使用同样的 OpenCLI 搜索与 `/search_result/<id>` 来源格式并能完成下载、分类；当前故障更符合 Provider 运行时认证/连接失效，而不是 XHS 搜索结果为空。
- 当前 `ResearchRun`、`QueryAttempt`、`TraceEvent` 只有 `cost_usd=0.0`，没有 input/output/total token 或请求计数；Trace 中 `openai` 被跳过只代表该阶段走了本地浏览搜索，不能代表整条 Run 没有 Provider 请求。
- 为保证图纸研究能完成，视觉 Provider 出现认证、连接、超时、限流、服务端或请求格式错误时，已增加受限本地确定性分类；它只处理已下载图片的类型/可见特征，不把图片升级为正式建筑事实。正常远程分类仍优先使用。
- 建筑 Run 的失败还包括网页正文分析与最后综合阶段的 Provider 认证/连接错误；已增加正文原句回退和综合确定性回退，二者都保留来源边界，不生成未出现在正文中的建筑事实。
- 本任务不增加 token、费用或 Provider 用量字段；用量仍由用户自行查看梭子蟹后台。

## Local development page and GitHub release

- `scripts/start.ps1` 的源码开发模式已在 Chrome 中验证：Board 页面为 `http://127.0.0.1:5173/`，API 为 `http://127.0.0.1:8000/`，标题为 `ArchResearch Board`。
- 当前 GitHub Release 是源码/安装包分发，不是在线 Web Edition：Windows 安装器运行生产 API + Board，独立 Chrome 扩展 ZIP 只提供浏览器能力。
- 发布提交 `5637ee0` 与当前 HEAD `2429277` 的差异不包含 `apps/api`、`apps/board`、`apps/extension` 生产代码；只有扩展截图测试和 Windows 安装器元信息变化。
- 当前工作树只有 `HANDOFF.md`、`task_plan.md`、`findings.md`、`progress.md` 修改，以及 `.artifacts/build/`、`.artifacts/qa/`、`.artifacts/releases/` 未跟踪产物。

## 2026-08-01 Zero-coverage retry recovery

- 修复前，图纸 Run `06843b31-d478-4b82-959f-49c1f15e65be` 的 attempt 1 仍为零覆盖，持久化预算为 46 次视觉调用、9,521,874 bytes 和 12 次浏览页；该 attempt 只有 planning/composing Trace，没有新 QueryAttempt。
- 修复前，建筑 Run `4e304e27-68e2-4beb-8fb2-88a858c676c8` 的 attempt 1 有 19 个候选但正文覆盖为 0，持久化预算为 24 次视觉调用和 36 次浏览页；attempt 1 的 24 个 QueryAttempt 全部 completed。
- 显式 retry 原先只递增 attempt，不刷新运行预算；因此零覆盖 Run 会在搜索前因旧上限退出。查询恢复还会在上一执行同时有 completed/started 状态时继承 completed 键，即使这些查询没有形成任何证据。
- 最小修复只针对 `covered_subquestions == 0`：retry 事务刷新本次视觉/浏览预算；工作流 attempt 大于 0 且实时覆盖为 0 时不继承 completed 查询。已有覆盖的部分结果仍沿用原断点续跑语义。
- 真实验证中，图纸 Run attempt 2 在 84.7 秒内从 0/3 推进至 34 个结果和 3/3 覆盖；建筑 Run attempt 2 在 160.8 秒内从 19 个候选、0/4 覆盖推进至 36 个结果、4/4 覆盖、6 个项目和 79 条 EvidenceClaim。两条都以 `completed/coverage_satisfied` 结束。

## 2026-08-01 Completed result visibility gap

- 用户截图证明建筑 Run 的现有结果页仍把四个子问题全部显示为空，尽管页面顶部已显示研究结论。
- 直接读取同一 Run 的 `/v1/runs/{id}/results` 返回 36 条结果；program、circulation、section、structure 均有可归组 `subquestion_ids`，多条结果还有逐题 `subquestion_analysis`。
- 量化结果：36 条中 22 条有逐题正文分析，program/circulation/section/structure 分别有 12/12/6/4 条；但按 Board 当前 `analysisReady` 判定，36 条全部为 false。
- 根因是 Board 只接受顶层 `project_context`、`design_mechanism` 均含中文的案例。确定性正文回退刻意保留英文来源原句，把中文动作和边界写入逐题分析，因此被前端全部过滤。
- 这不是单纯的外部 retry 缓存问题。修复必须只识别有逐题分析、中文回退边界且原句已绑定 EvidenceClaim 的确定性回退，不能把一般旧英文图片线索升级为正式案例。
- 最小修复后用项目 Playwright 打开真实 36 条结果 Run：program/circulation/section/structure 分别显示 3/3/2/1 个项目案例，四章空状态均为 0。
- 视觉检查确认来源句以“来源原文：”明确标注，中文转译动作和出处保持可见；没有把英文原句伪装为中文模型分析，也没有恢复来源检视器或改变现有结果布局。

## 2026-08-01 v2.2.3 release qualification constraints

- 用户本轮明确允许创建真实研究并产生 Provider 调用；这覆盖此前“默认验证不创建真实研究”的限制，但不授权读取、打印或导出 Key。
- 发布前不能只检查 Run 为 `completed`：必须同时核对逐题/逐方向结果和 Trace 中的成功 Provider 调用，避免确定性回退掩盖认证失败。
- 当前正式 Release 为 `v2.2.2`；两个未发布修复属于补丁级行为修正，下一版本按 `v2.2.3` 整理。
- 新 Provider 配置通过应用自身能力校验：模型列表共 8 项，`gpt-5.6-sol` 存在，`responses.structured_output` 探测成功；这证明 Credential Manager 中的新 Key 被应用真实用于 Provider 请求，但不暴露 Key 内容。
- 运行中的 API 在配置更新前已加载旧凭据；必须先停止并重新启动本地服务，之后创建的 Run 才能作为 `v2.2.3` 真实 Provider 发布证据。
- 重启后 `/health` 返回 `provider_mode=openai`、Provider 为 `OpenAI 兼容 API`、模型为 `gpt-5.6-sol`；Board 开发服务返回 HTTP 200。源码开发 API 不提供安装启动器的 `/desktop-health` 路由，该项应由后续安装器 smoke 覆盖。
- 真实验收沿用产品 API：`POST /v1/workspaces/{id}/runs` 创建异步 Run，建筑目标为 `precedent_research`，图纸目标为 `visual_reference_search` 且来源为 `xiaohongshu`；`GET /v1/runs/{id}/events` 提供按序 Trace，足以核对 Provider 成功与确定性回退。
- 第一条建筑验收 Run `4a980fa4-5844-4535-bf91-83a3047bfd2d` 已进入网页检查；`public_page_analysis` 至少有一条 `status=completed`，当前未见 `planner_error_type`，但必须等终态后再判定通过。
- 第一条建筑验收 Run 最终为 `partial/budget_exhausted`：20 个可用资产但仅 1 个项目、1/3 子问题覆盖，不能作为发布证据。
- 该 Run 的规划明确为 `planner=openai`，多数 `public_page_analysis` 真实调用成功，证明新 Credential Manager Key 确实被运行时使用；其中一次正文分析出现 `APITimeoutError`，最终 `research_synthesis` 因 `ValueError` 进入 `deterministic_fallback`。
- 失败同时暴露检索恢复质量问题：补查多次复用同一来源或命中无关 Dezeen 页面，后续查询甚至返回 0 个新来源；覆盖未能随 15 次有界查询提升。
- 综合 Provider 的 `ValueError` 只有在结构化响应为空、引用了输入外资产 ID、或未满足 quick/balanced/deep 输出深度时才会被识别为可恢复并进入确定性回退；需要复现精确消息后做最小合同修正。
- 当前搜索合同只要 `local_browser_search` 保留了 URL 就记录 OpenAI search 为 `skipped`；它在网页相关性分析之前决策，因此本地搜索返回偏题/重复 URL 时，后续恢复没有 Provider 搜索补偿路径。
- 使用同一 Run 的 2 个正文证据案例独立重放真实综合调用，25 秒内成功返回 2 条因果链和 1 条建议；原 `ValueError` 是一次结构化输出未满足合同的瞬时失败，现有流程缺少一次有界重试。
- 现有行为测试明确要求有 `LocalBrowserPageParser` 时不调用模型 `web_search`；这是 Provider 兼容性边界，不能为补源直接推翻。第一条题的可修复根因是公开搜索词生成器默认把未知类型写成 `adaptive reuse`，并把一般功能/环流问题固定写成 `box-in-box`、后勤入口和装卸区，导致新建社区图书馆检索偏题。
- 最小修复范围确定为：补社区图书馆类型词；非改造项目的功能分区与环形流线使用通用新建建筑词；采光问题同时保留明确结构关键词；综合结构校验失败最多重试一次并同步最坏耗时预算。
- 用户最终确认既有架构正确：OpenCLI/本地浏览器负责网页搜索与读取，模型负责规划、正文分析、视觉分类和综合；模型 `web_search` 不属于发布条件。一次 45 秒模型工具诊断超时不代表产品失败，后续 120 秒复核已主动终止。
- 两条行为红测已确认真实缺口：图书馆查询当前输出 `community cultural center` 且缺少图书馆词；综合第一次返回缺少因果链/建议的合法结构对象时立即抛出 `quick synthesis requires...`，没有第二次机会。
- 最小实现已使两条红测转绿：新建图书馆查询保留 `public library/community library`、一般环流与新建结构词；明确旧建筑/改造语义继续使用 adaptive-reuse、新旧界面和后勤分流词。综合只对结构化 `ValueError` 最多重试一次，最坏综合耗时同步按两次调用预留。
- 相关回归通过：规划/Provider 37 项、本地浏览器搜索与恢复 6 项；Ruff lint/format 通过。旧工业厂房的 adaptive-reuse、社区文化中心、公众/后勤分流和装卸区查询词保持原合同。
- 新图书馆 Run 暴露第二个检索缺口：三个 Provider 规划子问题最终生成完全相同的 `continuous circulation loop` 公开查询。采光题中的“自然光/眩光/侧高窗”未命中 daylight 权重，声学题中的“噪声/动静分区/安静阅览”未命中 program 权重，二者都被文本中的“流线”覆盖。
- 使用真实三个子问题的扩展红测按预期失败：活动声学题仍输出环流查询，确认缺口位于意图词权重而非查询模板。
- 用户给出最终搜索架构：Provider 普通 Responses 负责逐子问题查询规划和本地候选结构化筛选，OpenCLI/Playwright 负责实际搜索与页面读取；原生 Provider `web_search` 默认不得调用。现有确定性查询构造器降级为 Provider 失败时的 fallback。
- 发布新增硬门槛：建筑真实 Trace 必须同时有成功 `search_query_planning`、`candidate_reranking`、正文分析和综合，纯确定性搜索辅助不算通过；图纸继续 XHS-only。
- 现有接入边界可直接复用：`OpenAIResearchProvider` 已集中承载普通 Responses 结构化调用；工作流 `_try_public_search` 当前把本地 `PublicSearchLead` 直接转为 `ProviderSource`。新增查询规划和候选筛选协议即可，不需要新客户端或新运行时。
- 原 `ResearchProvider.search()` 使用 Provider 原生搜索，但默认存在 `LocalBrowserPageParser` 时已被跳过；新实现保持该兼容分支，不在默认本地链路调用原生 `web_search`。
- 新红测当前在导入缺失的 `CandidateAssessment` 等合同处失败，证明生产代码尚无模型辅助本地搜索结构；下一步先补 Provider 层，不提前改工作流。
- Provider/确定性查询合同 4 项已通过：普通 Responses 请求不含 `tools`，候选白名单拒绝编造 ID，图书馆和旧厂房模板词满足边界。工作流红测仍显示重复项目和医院页被打开、辅助规划调用为 0。
- 工作流核心红测已转绿：重复 URL/项目在模型前去重，模型候选筛选只保留本地图书馆 ID，医院未进入页面读取；查询规划/筛选失败时分别记录确定性 fallback，补查词保持差异且查询调用受预算限制。
- 完整浏览器回归暴露两个兼容边界：未实现新规划/筛选协议的旧 Provider 不能消耗额外 `clock()` 读数；零覆盖 retry 的排除集合只能约束当前 attempt，不能把上一 attempt 的全部 `SourcePage`、项目和已检查 URL 永久封死。
- 定点修复后，两个可控时钟综合测试和 inline retry 浏览/视觉依赖测试 3/3 通过；fallback 查询语言显式收窄为 `Literal["en", "zh"]`，strict Mypy 通过。
- 全绿后重启并创建的首条真实建筑 Run `08bc6d54-c9f1-4360-80e8-356504eb6cce` 证明模型查询规划确实成功执行，但 15 次有界子问题尝试最终没有形成任何本地候选或资产；终态为 `blocked/research_synthesis_incomplete`、0/3 覆盖。
- 这次失败不是确定性查询 fallback，也不是运行线程卡死：Trace 中多轮 `search_query_planning` 为 `provider=openai/status=completed`，覆盖尝试计数按预算推进到每题 5 次。下一步需核对 QueryAttempt 文本、域名轮换和 Direct Playwright 搜索返回。
- 15 条真实模型查询的语义满足本轮目标：包含社区图书馆、新建条件、中庭/阶梯阅读/环流、屋顶采光/防眩光/热舒适、连续结构及 floor plan/section/project description 等证据类型，未出现 adaptive reuse、box-in-box 或 loading dock。
- `_update_query_attempt_text()` 只替换了 QueryAttempt 文本，没有同步模型 `SearchQuery.language`；真实数据出现 ASCII 英文查询标记为 `zh`、中文查询标记为 `en`。域名集合在模型计划前又由旧 `language` 选择，实际查询语言和搜索目标可能脱节。
- 用项目 `LocalBrowserPageParser`/Playwright 原样复跑首轮候选：ArchDaily 返回医院、故居改造、规划馆和办公楼；Designboom 返回亭子、艺术中心与社区中心；Dezeen 仅有一条图书馆新闻。模型把这些低相关项全部拒绝符合筛选合同。
- 查询包含全部必需语义但过长并堆叠过多结构术语，单站点搜索召回被稀释。修复应在保留“建筑类型 + 项目条件 + 当前机制 + 证据类型”前提下限制词数/长度，并按模型输出语言同步持久化；不能通过降低低相关候选阈值掩盖召回问题。
- 先前判断“ArchDaily 短查询无项目”是诊断脚本的 URL 正则过严：项目 slug 后可直接接查询参数。直接搜索 `library` 实际返回 Calgary Central Library、Spiez Library、Khalifeyah Library 等真实项目，证明站点搜索可用；确定根因仍是 `_compact_site_query()` 把 library 类型改没。
- 新建项目站点压缩改为“条件 + 类型 + 主机制 + 一个证据类型”后，项目 Playwright 实测 ArchDaily 前 4 条中 3 条是图书馆，Designboom 命中 University of Aberdeen New Library，摘要直接含 central atrium 贯穿至 roof；Dezeen 仍偏题，但可由候选筛选拒绝。
- 修复不降低候选筛选阈值，也不增加页面预算。新建未知类型输出 `new public building ...`；旧工业改造分支和既有站点语言测试保持通过。
- 修复后新 Run `d73cbb8d-8136-4366-96a3-8de6abd3ea67` 的首题真实链路为：模型规划成功 -> 本地 4 候选 -> 模型保留 3 个图书馆 -> 本地正文读取 -> Provider 正文分析；证明搜索与候选筛选闭环已恢复。
- 该 Run 最终仍为 `blocked/research_synthesis_incomplete`、10 个 partial 视觉候选、0/3 正文覆盖。多条 `public_page_analysis` 事件报告 relevance=2，但当前结果的 `project_context`、`design_mechanism` 为空，项目计数为 0；下一阻塞收敛到正文分析输出/持久化合同，而非搜索召回。
- 数据库确认 10 条 EvidenceClaim 全是“项目页列出某张平面/剖面图”的图片元数据引文；10 个资产的 `project_context`、`design_mechanism`、`transfer_strategy`、`subquestion_analysis` 均为空，没有一条机制正文 EvidenceClaim。
- `PublicPageAnalysis` 当前允许 `relevance>=2`、选中 drawing_ids 但正文事实字段全空；持久化因此保留 partial 视觉候选，却无法形成正式项目覆盖。Provider 需要对这种语义无效结构结果做一次有界纠正，不能降低证据门槛。
- 新 Run `942aae4b-e091-4b33-ab81-7009c5839205` 首次候选筛选遇到 `APIConnectionError` 后，确定性 fallback 直接保留 4 个候选并打开住宅、文化中心等偏题页。当前 fallback 只排序取前 4，没有相关性下限，违反低相关候选不得进入完整页面分析的合同。
- 同一 Run 的 Antipode 页面仍出现 `relevance=2/enriched=0`。字段完整性纠正已执行，但工作流逐字绑定后没有事实落库，说明核心 `text_excerpt` 不在 page_text；Provider 语义校验还必须验证条件/机制对应引文逐字存在。
- 该旧进程 Run 最终为 `partial/budget_exhausted`、1/3 覆盖，不计入验收；但 Aberdeen New Library 的正文分析达到 `relevance=3/enriched=2`，正式覆盖采光题，随后 `research_synthesis` Provider 成功，证明有界纠正可以形成正文 EvidenceClaim 而非只能降级。
- deterministic 候选 fallback 存在两种不同合同：真实 Provider 支持 reranker 但调用失败或时间不足时，必须用类型和文本相关性门槛挡住偏题页；旧 Provider/mock 完全不实现新协议时，必须保留原确定性排序以维持兼容、页面容量和可控时钟。分支修正后 8 个兼容回归与低相关 fallback 保护同时通过。
- 手工创建的 Run `a6869306-1956-4c1d-8c78-8db4f97bfcb0` 因遗漏 `research_sources` 命中 schema 的旧 XHS 默认，已取消且不计入验收；Board 正式代码对建筑明确传 `[]`、对图纸传 `['xiaohongshu']`，产品路径本身正确。
- 使用正式 Board 等价 payload 的 Run `7a6a318f-bd1d-4d58-8f31-6c66087c57f5` 为 `blocked/research_synthesis_incomplete`、0/3 覆盖。15 条普通 Responses 查询准确且无 adaptive-reuse 模板污染，15 次候选筛选中 14 次 Provider 成功、1 次查询规划连接失败 fallback；最终仅 4 个项目页被读取、3 次正文分析均未形成 EvidenceClaim。当前根因转向站点候选召回和正文可证实性。
- 项目 Playwright 重放确认 ArchDaily 首轮可返回 3 个明确标注 `LIBRARY` 的项目，但空摘要使真实 reranker 全拒绝；第 5 轮 deterministic 补查虽含 `public library community library`，因漏掉 `new-build` 又被站点压缩为 `community cultural center daylight strategy`。两处均已用红测锁定并修复，不降低医院/学校等类型不匹配门槛。
- 修复后的 Run `27b6ae81-3036-4ab3-acbb-f4eab3080c7b` 召回与筛选明显改善：首轮保留 2 个同类型项目，最终 7 个资产、1/3 覆盖，Provider 规划/筛选/正文/综合全部成功且无 fallback。大邱高山公园图书馆形成 6 条逐字 EvidenceClaim；同页也确实复用于另外两题，但正文不能证明阶梯阅读、闭合环线、侧高窗与结构跨度的复合要求，因此未被错误升级。后续真实验收题应保持正常设计研究粒度。
- 正常粒度 Run `cbf00bd8-ce12-46df-a3af-52753952cf2f` 达到中庭与跨层流线 2/3 覆盖后，唯一未覆盖的屋顶采光题在恢复轮因 `round_query_index` 按本轮实际查询重置，重复 Dezeen/Divisare 并未轮到 ArchDaily/Designboom。域名槽位现固定为问题目录位置；第 3 题 5 轮稳定为 Dezeen、Divisare、ArchDaily.cn、ArchDaily、Designboom。
- 稳定槽位修复加载后的同题 Run `ca3c9228-272e-4ec7-8144-76b97906bb2e` 已单活推进；截至 Trace 97，普通 Responses 查询规划和候选筛选持续成功且无 fallback，只有 Watha T. Daniel/Shaw Library 进入正文分析但未形成正式证据，当前仍为 0/3 覆盖。必须等终态后再决定是否补红测，不能并发启动下一条。
- Designboom 的同一站内搜索可能返回空、15 秒导航超时或仅返回零相关页；这类失败发生在本地 Playwright 层。Bing RSS/普通页、Google 和 DuckDuckGo 在当前本机环境均未返回受域名约束的可用结果，不能作为发布版 fallback。
- Designboom 同站点短查询实测可用：`community library` 和 `community library daylight` 均返回 4 个真实图书馆项目。因此 fallback 改为同站点“建筑类型 + 当前机制”宽化查询；模型完整查询、候选筛选、域名和项目 URL 校验保持不变。
- 本地解析器的正文读取最坏时间仍是 20 秒；只有已知站点搜索可能执行两次导航，因此新增独立 `worst_case_search_seconds=40`。工作流搜索预留优先使用该字段，避免把正文解析预算也错误翻倍。
- 新建筑 Run `9f51fe41-2c03-49f9-83ad-68526a310a8f` 最终为 `partial/budget_exhausted`、1 个项目、2/3 覆盖；FJMT Marrickville Library 为中庭功能和屋顶采光形成逐字 EvidenceClaim，垂直流线未覆盖。15 次查询规划、15 次候选筛选、6 次正文分析和综合均由 Provider 成功执行，XHS 为 0；只有一次本地导航 `TimeoutError`。
- 垂直流线第 5 轮从 4 个候选保留 2 个；Watha T. Daniel-Shaw Library 先分析但 `relevance=2/enriched=0`，第二个 TBB Libraries 仅做视觉检查，未被正文解析。循环末补分析只能遍历已有正式综合案例，因此复用了无垂直路径事实的 FJMT，而不是未分析的新 TBB 页。
- 修复保持现有预算：恢复轮在 `completion_recovery_pages_per_subquestion=2` 内缓存第二个可信项目页，当轮 Provider 分析仍限 1 次；循环末原有每个缺失子问题 1 次补分析可选择未分析缓存页。查询数、页面上限和 Provider 最坏调用数不增加。
- 该 Run 最终为 `partial/budget_exhausted`、1 个资产、1 个项目、1/3 覆盖。15 次查询规划与 7 次实际候选筛选、3 次正文分析和综合均由 Provider 成功完成，fallback 与 XHS 调用均为 0；Calgary New Central Library 为跨层流线形成 3 条逐字 EvidenceClaim。
- 真实失败包含两个确定性调度缺口：中庭功能查询的 `shared reading/community activities` 被低权重证据词 `section` 误判，站内压缩丢失 atrium/program；屋顶采光最后一轮已有 3 个新候选，但工作流先复用 Calgary 页并消耗唯一 followup 分析名额，新候选未读取正文。Calgary 又在中庭最后一次查询之后才发现，早期中庭分支没有补分析机会。
- 红测驱动修复后，站内压缩保留 `atrium program layout`；有新候选时不提前复用缓存页；查询循环结束后每个仍缺失分支最多使用一个已读正文案例补分析，不增加搜索查询数或页面读取数，并继续预留综合调用时间。
- 兼容回归要求新候选与缓存复用不是互斥关系：正常轮先分析新页，再用剩余分析额度复用最匹配缓存页；恢复轮只有一个额度时新页优先。最终缓存补分析只在预算显式包含 completion recovery 时启用，避免突破旧 Run 的 Provider 调用上限。
- 修复后相关公开页面/规划/Provider/工作流/浏览研究 245 项、完整 API 426 项、Ruff lint、64 文件 format check、strict Mypy 26 个源文件和 `git diff --check` 全部通过。
- 恢复缓存修复后的 Run `cb2eb4a3-6c9f-4a62-b740-f28836698642` 最终仍为 `partial/budget_exhausted`、1/3 覆盖。Calgary New Central Library 的跨层流线形成逐字 EvidenceClaim；15 次查询规划、15 次候选筛选、10 次正文分析和综合均由 Provider 成功，fallback 与 XHS 均为 0。该 Run 证明模型辅助本地链路在运行，但不计入发布验收且不 retry。
- 真实模型会用 `public stair`、`ramp`、`promenade`、`inhabited staircase`、`landings`、`环廊`、`公共楼梯`、`坡道` 和 `停留` 表达跨层流线；只识别 `circulation/流线` 会让低权重 `section/剖面` 错误胜出。
- 中庭功能查询还会用 `reading terraces`、`multipurpose rooms`、`civic living room`、`reading commons`、`event rooms` 和 `support spaces`；这些词必须归入 program，而不是因证据类型 `section` 被压成 `sectional hierarchy`。
- `purpose-built` 与 `purpose built` 都是明确的新建条件。将这些同义词加入现有权重后，5 条真实查询均保留正确机制；显式 `竖向层次 / vertical hierarchy` 继续优先于单个坡道词，避免破坏正文聚焦合同。
- 工业改造 Run `dfadd8a8-4f45-42cf-99dd-8d2401f0eaa5` 在 completion recovery 后达到 3/3 正文覆盖，但只有 Rotterdam 仓库 1 个项目和 2 个资产，因 enrichment 不足仍为 `partial/budget_exhausted`。前三个 `relevance=2/enriched=0` 页面经项目 Playwright 复核确实只有历史背景与保留价值，没有新增体量连接事实，证据门槛无需放宽。
- 15 条模型原始查询准确且彼此不同；问题发生在站点压缩：包含 incidental `circulation/环廊` 的 program、rooflight/lightwell、光井/屋顶开洞查询全部被改成公众后勤流线。扩充功能运营与采光构造词后，压缩分别保留 `program insertion` 与 `daylight strategy`。
- ArchDaily 结果卡先出现空链接、后出现标题时，初始元数据语义必须只用于保持引擎顺序；是否需要宽化应读取当前合并后的标题。首屏有文本但建筑类型不匹配时，应使用既有第二次导航执行同站点宽化。
- 工业宽化原先因 `if/elif` 只保留 `industrial adaptive reuse`，丢掉 `cultural center`。保留两层类型和当前机制后，真实项目 Playwright 从学校/体育馆/办公室候选转为文化枢纽、改造舞蹈中心、画廊与旧茶仓，且仍只使用最多两次本地导航。
- 最新真实 Run `07a2ca39-ce70-4b6c-8989-98b3f207c4a9` 达到 3/3 正文覆盖、12 个资产和 3 个项目，但 `multi_asset_projects=0`，唯一 enrichment 缺口为 `insufficient_multi_asset_projects`。Deichman 同一缓存页面已有 `analysis_diagram`、`axonometric`、`section` 三类 partial 资产，三项都没有 `subquestion_analysis`，证明无需新增搜索或页面读取，只需在现有时间预算内补一次正文分析。
- 同一 Run 的最终 `research_synthesis` 只有一次调用，因 `APITimeoutError` 立即进入 `deterministic_fallback`。Provider 已把综合最坏预算按两次调用预留，但当前重试循环只捕获结构化 `ValueError`；瞬时超时可在同一两次调用上限内复用第二次机会，不扩大预算。
- 最小修复把 enrichment recovery 限定为 `gaps=[]` 且唯一 enrichment 缺口是 `insufficient_multi_asset_projects`：仅扫描 `parsed_pages` 中已缓存的可信具体项目页，要求至少两种图纸类型，并从所有未分析子问题组合中选一次最匹配分析；不传搜索/解析依赖，因此不会补搜或打开新页。
- 综合重试仍只有两次总调用：第一次是结构校验 `ValueError` 或 `APITimeoutError` 时使用第二次机会，第二次失败才由工作流进入既有确定性 fallback。Quick 最坏综合预留仍为 90 秒。
- 修复后第一条新建筑 Run `5a8dd293-f844-4bb0-ab1b-4ca1a2f63e00` 为 `partial/no_new_assets`、2/3 覆盖、9 个资产、1 个正式项目；中庭功能和可见跨层流线有 Provider 正文证据，综合由 Provider 成功，屋顶采光未覆盖。该 Run 不计入发布验收且不 retry。
- 9 条真实搜索词准确且差异化，第三分支逐轮包含 skylight、glare、overheating、deep-plan illumination、solar shading、daylight simulation 和 light well 等条件；公开正文只支持自然光进入中庭，不能同时逐字证明屋顶开口和环境控制，拒绝升级是正确证据边界。下一条使用三个已知有正文证据的项目做比较型问题，继续验证完整搜索链路而不人为放宽证据门槛。
- 比较型 Run `87b31259-2182-485d-b592-7291d592c3cc` 的模型查询把 Calgary、Daegu Gosan、Hunters Point 三个项目名同时放进每条查询；站点压缩又删除全部项目名，只剩通用 `new public library + mechanism`，导致前四轮没有候选。该 Run 在无正式结果时取消并保留，不计入验收。
- 修复后的普通 Responses 提示要求命名比较题每条查询至多一个显式项目；若兼容模型仍返回多个英文项目名，程序按子问题 ID 和轮次稳定选择一个锚点并保留类型、条件、机制和证据词。站点压缩在原简洁查询前保留单个项目名，不改变无项目名查询。
- 命名修复加载后的 Run `7525616f-1864-44ea-9644-044857bb45f2` 证明查询合同已生效：五轮分别按 Calgary、Daegu Gosan、Hunters Point、Calgary、Daegu Gosan 锚定，15 条查询无多项目名混写；但本地搜索 6 次超时，最终只读取 Calgary 与 Daegu 两页，并仅由 Daegu 形成正式证据。
- 该 Run 的 4 次正文分析中，Daegu 第三个子问题首次 `APITimeoutError` 后直接走确定性回退，导致正式结果含 fallback，按发布门槛必须排除。`OpenAIResearchProvider` 已为正文语义纠正预留两次调用和 90 秒最坏预算，但旧实现没有把瞬时超时纳入这两次机会。
- 页面分析现在共享同一个两次总调用循环：第一次 `APITimeoutError` 可重试原请求；第一次返回语义不完整时，第二次仍用于逐字证据纠正；第一次超时后第二次不完整或再次失败都会外抛并进入既有工作流边界，不会产生第三次 Provider 调用。
- Run `3bec22da-8484-4f9b-9053-24a0231b565f` 的 15 次搜索词规划、实际正文分析和综合全部由 Provider 成功执行且无 fallback；Calgary 的 Designboom 页为中庭功能与顶部采光形成逐字 EvidenceClaim，但 Daegu 在五轮中没有进入正文读取，证明页面超时修复有效而命名召回仍未稳定。
- 本地站内搜索包含两层压缩：首次 `_compact_site_query()` 已保留显式项目名；若首次结果为空、超时、整体低相关或类型不匹配，第二次 `_compact_site_fallback_query()` 只保留通用建筑类型与机制，删除项目锚点、新建/改造条件和证据类型。这违反命名案例的站点压缩合同，也是 Daegu 精确查询退化为通用结果的当前根因。
- 命名项目的第二次站内查询现在保持五项合同并有意更换证据角度：项目名 + 已有新建/改造条件 + 建筑类型 + 一个机制 + 一个证据类型。无项目名的通用宽化查询保持原行为，因此不影响既有社区图书馆与工业改造召回。
- 修复后用项目 Playwright 原样搜索 Daegu 的真实模型查询，Designboom 第一结果即 `dellekamp-arquitectos-daegu-gosan-park-library`，摘要直接包含四层 promenade、环中庭和自然采光；证明本地浏览器路径当前可召回该命名案例，低相关第二结果仍需经过模型候选筛选。
- Run `e2c64da9-9e0a-4c60-9336-501fab671561` 在查询规划和候选筛选阶段出现 `APIConnectionError` fallback；为避免把降级结果误作发布验收，已在 0 个资产时取消并保留。
- 随后通过项目自身 `probe_provider()` 验证 `responses.structured_output` 成功；Key 仍只由 Windows Credential Manager 提供，未读取、打印或保存。
- Run `11a62e85-81ed-40e5-93c7-9aeca58eec70` 首轮 Daegu 查询返回 3 个本地候选，Provider reranker 却保留 Calgary；后续页面扩展继续进入无关 Designboom podcast 和住宅页，均未升级为正式证据。第三轮查询规划再次出现 `APIConnectionError` fallback，因此该 Run 已在 0 个资产时取消并保留。
- 当前根因不是查询规划或本地搜索召回，而是候选筛选前没有按当前查询的单个显式项目锚点做程序级过滤。查询只锚定 `Daegu Gosan Park Library` 时，Calgary、住宅和 podcast 不得进入正文读取；无命名查询继续沿用现有候选合同。
- 过滤必须作用于每条本地搜索结果再合并：这样同轮存在 Daegu 与 Calgary 两条独立查询时，两者都能保留自己的项目；若先合并后按单一锚点过滤，会错误删除另一个有效项目。
- 当前实现只用候选标题和 URL 匹配项目身份，不用摘要放行；这能阻止仅在摘要中提及图书馆的 podcast、住宅或相关文章进入 reranker，同时保留标题带事务所前缀或 URL slug 含完整项目名的真实项目页。
- 修复后的真实 Run `edf2aae3-60dc-479f-92b8-ae1a2b4c18fe` 首轮可见流线查询只读取 Daegu Gosan Park Library 和 Hunters Point Community Library；Daegu 正文分析 `relevance=3/enriched=3`，证明项目锚点过滤没有误删真实页面。
- 该 Run 的 12 个资产中，Daegu 4 个和 Hunters Point 2 个正式结果都只有 photograph 类型；Palmetto 6 个 partial 资产有 analysis diagram、elevation、render、section 四种类型但正文分析 relevance=1，因此不能靠图纸数量升级。
- Run 失败同时包含外部瞬时故障与题目证据缺口：第 3 轮候选筛选和紧接的正文分析出现 `APIConnectionError`，最终综合两次机会仍超时；屋顶采光问题的后期页面没有逐字正文支持。下一条应先做 Provider capability probe，再改用现有来源可直接证明的公共流线、功能分区和公共空间机制，不机械重复 rooflight 查询。
- 命名比较 Run `e7b143e9-9ef1-4bf5-9dde-b6d9d137396f` 的 15 条 QueryAttempt 已正确按 Daegu、Hunters Point、Calgary 轮换；项目多样性失败不是项目名调度仍固定在一个锚点。
- 首轮 Daegu program 查询的真实链路是：本地搜索 4 项 -> 项目锚点过滤后 1 项 -> reranker 保留 Daegu -> 本地解析 Daegu 正文 -> `select_project_page_links()` 返回 Designboom 侧栏相关链接 -> 正文分析改为 podcast 和住宅。候选锚点合同没有继续传到页面扩展层。
- 对命名项目搜索，页面扩展必须继承当前查询项目身份：父页面若已是该项目的可信具体项目页，侧栏链接不匹配项目名或 URL slug 时不得读取；过滤后没有子页时应直接分析父页面。无命名 roundup -> project 扩展保持现有合同。
- 真实 Provider 的 `APIConnectionError` 和 `InternalServerError` 多在 3–5 秒内快速返回；直接 fallback 会让 15 轮无 fallback 验收概率过低。重试实现使用同一 45 秒 deadline：第一次若耗满窗口不会产生第二次，只有快速失败时才重试，因此最坏时间预算不变。
- 页面分析本来就有两次、90 秒总调用预算；把 `APIConnectionError`、`InternalServerError` 和 `RateLimitError` 与 `APITimeoutError` 一样纳入第二次机会，不改变语义纠正最多两次和普通 `TimeoutError` 不重试的合同。
- Run `259efb0e-a0ed-4258-b4e3-caa9572b030d` 的 search planning、candidate reranking、三次正文分析和综合均由 Provider 成功，只有一次本地搜索引擎 `Error`；这证明同一 45 秒窗口内重试已显著减少 Provider fallback。
- 未覆盖的公共流线不是证据门槛误判：Designboom 对 Hunters Point 精确长查询真实只返回一个无关 podcast；Dezeen 对 Calgary 精确查询只返回 MVRDV 竞赛、播客、产品和 Roosevelt Library 页面。过滤为 0 符合模型候选白名单和项目锚点合同。
- 命名比较把每个项目与特定站点/轮次组合，当前站点召回波动会阻碍 enrichment。下一条验收应使用普通新建社区图书馆问题，让模型从各站点真实相关候选中筛选多个项目；不降低门槛、不硬编码 URL。
- 普通新建社区图书馆 Run `104aa378-ce28-4238-9a96-ddfd7edd70c3` 达到 3/3 正文覆盖、16 个资产和 3 个项目，但 `multi_asset_projects=0`，最终仍为 `partial/budget_exhausted`，不计入验收且不 retry。
- 该 Run 的 enrichment recovery 在最终 gap check 后只补分析 Jasper Place Branch Library；该页有 2 个 drawing candidates，但 Provider 返回 `relevance=1/enriched=0`，因此没有形成多图纸正式项目。需要继续核对是否选错了缓存页，而不是放宽 relevance 或图纸门槛。
- 最终 `research_synthesis` 在 Jasper recovery 后约 91 秒才返回 `APITimeoutError` 并进入 `deterministic_fallback`，表明原有两次、90 秒总机会均已用尽；不能再靠相同瞬时重试修复，下一步应核对发送给综合 Provider 的案例数量与文本负载是否有可收敛的冗余。
- 该 Run 还有三处更早的 Provider 降级：Constitución 页的 `atrium-program` 分析因 `APITimeoutError` fallback、同页 `public-circulation` 分析因 `APIConnectionError` fallback，第三轮 `public-interface` 查询规划因 `APIConnectionError` 使用确定性模板。正式结果因此包含 fallback 正文，不能只修最终综合后计入验收。
- fallback 结果中出现 `Identify devices based on information actively requested` 和 climate-action `rounded rock-like forms` 等与 Constitución 图书馆不相干的逐字片段；这表明无命名 Designboom 项目页的本地正文可能混入侧栏/推荐卡文本。程序虽逐字绑定了当前 URL，但 URL 内正文边界仍可能污染，需要用页面解析红测阻止无关模块进入 fallback EvidenceClaim。
- 16 个结果按 URL 聚合后，只有 Jasper 同时包含 `photograph` 和 `section` 两类资产，但 4 个资产均没有正式 `project_context + design_mechanism`；能形成正文机制的 TBB 与 Constitución 都只有 photograph。当前缓存中不存在同时满足正文相关性和多图纸类型的项目，Jasper recovery 失败不是单纯排序选错。
- 若仍要求 quick Run 达到 `multi_asset_projects=1`，调度必须在查询/候选/页面分析阶段更早识别并优先保留“正文相关且有两类图纸”的项目；最终单次 recovery 无法把正文不相关的 Jasper 变成合格项目，也不能通过降低门槛实现。
- `_try_cached_multi_drawing_page_enrichment()` 当前只按“首选图纸类型交集、不同图纸类型数量、页面顺序、子问题顺序”排序，并排除已尝试 `(URL, subquestion)`；它完全不检查页面正文与未尝试子问题的相关性。Jasper 的 public-circulation 已尝试后，函数机械改选 atrium-program，准确解释了真实 `relevance=1`。
- recovery 修复应先过滤/排序页面与子问题的确定性文本相关性，再决定是否消耗唯一 Provider 分析机会；若没有相关未尝试组合，应诚实不调用，而不是把不相关页送给模型。该修复不能凭空满足 Jasper 的多图纸门槛，但会避免浪费 45 秒并为综合保留时间。
- quick 综合已有 `_bounded_research_synthesis_cases()`：按子问题最多选择一个未重复资产，3 个子问题最多发送 3 个案例；若案例已有逐题分析，payload 还会删除重复的顶层条件、机制、转译、边界和证据字段。Trace 的 `case_count=4` 是 workflow 原始输入计数，不代表把 16 个资产全发给 Provider。
- 因此本次两次综合超时不能直接通过再压缩案例数解决；需要核对每个逐题字段本身的长度、请求超时设置和兼容 Provider 对结构化 schema 的响应行为，再决定是否存在不改变研究深度的最小负载修复。
- quick 综合当前每次请求使用 `reasoning=medium`、`max_output_tokens=1200`、45 秒超时；第一次瞬时错误后的第二次机会原样重复 medium 请求。真实 Run 两次都超时说明简单重放不足。
- 可在不增加调用、时间或放宽输出合同的前提下，仅让 quick 综合的瞬时错误重试使用 `reasoning=low`；首次仍为 medium，`ResearchSynthesis` schema、Evidence asset ID 白名单及 quick 至少 1 条因果链/1 条建议的校验保持不变。结构 `ValueError` 的纠正重试仍使用 medium。
- `DirectPlaywrightBackend._read_page()` 同时读取 `article/main/[role=main]` 与整个 body，却用文本长度 `max()` 选择最终正文；Designboom body 含侧栏、推荐卡和站点模块，通常必然长于真实项目 article，解释了 fallback EvidenceClaim 的跨项目污染。
- 正确边界应优先选择足够长的语义正文容器，仅在没有可用 article/main 时回退 body；图片提取已经有相似的 article 优先逻辑。该修复会收窄正文来源，不会丢失逐字校验或伪造 URL。
- 项目 Playwright 原样重读 Constitución 后，`ParsedPublicPage.markdown` 为 8,327 字符；`Identify devices based on information actively requested` 已消失，但 `rounded rock-like forms` 仍存在。article 优先已去除一类 body 污染，但 Designboom 的语义 article DOM 内仍嵌有至少一个无关推荐模块。
- 第二次项目 Playwright 定位到污染索引 5,985：真实项目正文结束后出现稳定的 `architecture connections:`，随后是 PLAY、school architecture、MVRDV 竞赛等推荐卡及其摘要。该标记适合作为 Designboom 专属尾部边界，但只能在标记前已有完整正文时截断，不能全局处理其他站点。
- 首版站点截断夹具通过，但真实重读仍在约 5,985 处看到同一污染；页面正文长度在两次动态读取中为 8,327/8,014。当前实现用 `find()` 取第一个标记，若 Designboom 前部导航也有同名短标记且索引 <1000，保护条件会跳过整个截断。需读取所有标记索引后选择正文之后的边界。
- 直接 `BrowserPageSnapshot.text` 仍在索引约 5,985 处包含推荐区完整上下文和两个 `architecture connections:` 标记；这排除了仅由 parser 追加链接文本导致污染的假设。下一步需核对实际 `snapshot.url` 是否仍匹配 `designboom.com`，因为夹具中的域名条件可用而真实页面未进入截断。
- snapshot 最终 URL 为 canonical Designboom URL，域名匹配为 true；但精确 `find("architecture connections:")` 返回 -1，而肉眼上下文存在该标记，说明 innerText 在单词/冒号间保留了换行、Unicode 空白或全角冒号。边界匹配应使用受限正则 `architecture\s+connections\s*[:：]`，并从正文 1000 字符之后搜索。
- 最终项目 Playwright 真实复核通过：Constitución 的 `ParsedPublicPage.markdown` 为 7,262 字符，设备识别句、MVRDV `rounded rock-like forms` 摘要和 recommendation marker 均不存在；真实项目正文与图纸链接仍保留。
- 修复后 Run `d0f41d2d-923c-45c8-ac15-9cf0ddfd9514` 自然终止为 `partial/no_new_assets`：2/3、7 个资产、1 个项目，顶部采光未覆盖；不计入验收且不 retry。
- 该 Run 的查询规划、候选筛选和正文分析均无 fallback，唯一降级是 sequence 103 的 `research_synthesis APITimeoutError`。综合原始 case_count 仅 1，medium 首次和 low 重试仍各在 45 秒超时，进一步排除输入体积问题。
- quick 综合可在不增加 90 秒最坏预算和 2 次最大调用数的前提下使用共享 deadline：首次传入完整剩余时间，只有快速瞬时错误才在剩余时间内发起第二次；这避免两个需要 45 秒以上的有效响应都被固定分段截断。
- 该 Run 实际只执行 8 条差异化模型查询，因为中庭和流线覆盖后停止对应分支；查询本身准确，无模板词污染。12 个 SourcePage 中却包含 Designboom podcast 和越南住宅，页面上限被无关扩展消耗。
- Trace 显示 Daegu/Kengo 等真实 Designboom 项目父页被读取但没有直接分析，正文调用转去 podcast（relevance 0）、越南住宅（relevance 2/enriched 0）和 Helsinki 竞赛提案（relevance 2/enriched 0）。这与先前命名项目漂移同源，但当前无命名查询没有父项目锚点保护。
- 正确的通用合同不是为无命名查询关闭 roundup 扩展，而是：若候选父页本身已由 `is_concrete_project_page()` 判定为可信具体项目页，就直接分析父页；只有非具体的 roundup/search/list 页面才扩展到项目链接。这样可释放至少 2 个页面预算并保留无命名 roundup 行为。
- 首版父页直读修改使无命名/命名具体项目测试通过，但 roundup 回归失败；根因是 `is_concrete_project_page()` 对所有非 ArchDaily URL无条件返回 true。需要先识别 tag/category/search/topic/archive 路径和 roundup/search-results/archive 标题，再让其他非 ArchDaily 文章保持 concrete。
- 无命名具体项目父页、命名父页和 roundup 扩展三条合同现已同时通过：非 ArchDaily 列表页由路径/标题守卫判定，具体项目页不再扩展侧栏；工作流首轮和缓存复用分支均使用相同决策。
- quick 综合 shared deadline 红测已通过：首次请求获得约 90 秒，快速瞬时错误的第二次 low 请求只使用剩余时间；deadline 已耗尽时不发起第二次。最大调用数仍为 2，最坏时间仍为 90 秒。
- 4 个 remote-visual 回归失败不是父页直读本身，而是列表页标题守卫包含过宽的 `archive`：合法项目名 `Courtyard Archive` 被判成列表页，失去 exact-project 视觉批次资格。URL 路径已能识别 `/archive/`；标题守卫应移除单独 `archive`，保留更明确的 roundup/search-result/tag-page。
- A/B Run `5c785452-d1f0-434e-b8fd-81d7a88daa73` 已自然完成为 `completed/coverage_satisfied`：15 个可用资产、8 个项目、3/3 coverage、`multi_asset_projects=1`，`gaps=[]` 且 `enrichment_gaps=[]`。
- Trace 共 116 条；查询规划 9 次、候选筛选 9 次、正文分析 9 次、研究综合 1 次。四类关键工具都存在成功记录；已扫描到的唯一错误字段是一个 Designboom 页面 `local_browser skipped/Error`，未看到 Provider/deterministic fallback。
- 当前综合明确引用 Calgary Central Library 与 Palmetto Library 的真实 URL 和逐字英文 EvidenceClaim，并保留采光与平面/剖面证据边界；是否正式通过仍取决于数据库逐字匹配和候选白名单审计。
- 数据库审计确认 9 条真实查询全部由本地浏览器执行、无重复、无 `adaptive reuse`/`box-in-box`/`loading dock` 题外词；7 个已读 URL 无重复，15 个正式结果的 URL 全部存在于 `SourcePage`，57 条事实没有 URL 错配。
- 其中 51 条正文事实有逐字 excerpt；生产写入路径 `_supported_project_facts()` 只保留当次 Playwright 正文中标准化后精确出现的 excerpt。6 条无 excerpt 的事实只声明项目页图纸归属，均有真实 image URL，且结果限制明确写明不据此补充构造事实。
- 后验动态复核发现 ArchDaily 偶尔返回 4.7k-5.4k 的短页面版本，独立重读可返回 7.3k-9.9k 完整正文并恢复匹配；Calgary 的 5 条目标正文引文在完整版本全部出现。这是网页动态加载波动，不是持久化绕过逐字校验。
- Run `5c785452-d1f0-434e-b8fd-81d7a88daa73` 正式计为建筑验收 1/2；当前总验收 1/4。
- 用户要求先修完再测，并确认修改全局适用。创建第二条 Run 前已停止真实调用；参数化红测覆盖社区图书馆、工业厂房改造、文化中心扩建，三者在旧实现中都错误生成无 excerpt 的图纸 `fact`。
- `_persist_expanded_project_page()` 现按证据类型统一分流：非空图片 `alt` 是可逐字保存的事实；空 `alt` 只能成为图片观察，EvidenceClaim 的 source URL 指向真实图片并使用全图归一化区域，限制中声明图纸类型仅来自 URL 线索。没有建筑类型或题目专用分支。
- 通用修复通过相关 236 项和完整 API 459 项；Ruff、55 文件格式、strict Mypy 26 个源文件与 `git diff --check` 同时通过。全局回归覆盖拆题、模型搜索规划、候选筛选、公共页面解析、正文/图纸持久化和研究工作流，不依赖真实社区图书馆问题。

## 2026-08-01 Global search-contract regression closure

- 用户要求停止把真实 Provider Run 当作逐次调试器；当前先完成已知通用缺口和全局回归，再恢复单活验收。
- `roof extension` 与 `vertical extension` 原先会被三个独立的宽泛 substring 判断误升为项目扩建条件；红测在两种机制上均准确失败。
- 查询生成、首次站点压缩和宽化压缩现在共享 `has_project_extension_condition()`：真正的 building/cultural-center extension、new wing、expanded building 与中文扩建仍保留，屋顶/竖向扩展机制不再升级为项目条件。
- 相关回归最初剩余 20 项失败：17 项是旧断言要求删除明确的 floor plan/section/剖面图，2 项是旧全局域名顺序，1 项仍要求题外 `loading dock`；逐项审查后均确认与当前精准搜索合同冲突。
- 旧断言现改为验证证据类型保留、每个子问题前两轮覆盖 ArchDaily/Designboom，以及题外 `loading dock` 被排除；相关四文件 243 项全绿。
- 源码服务重启后 API/Board 健康，模型目录返回 9 项且包含当前模型；Responses 生成端三次有间隔的小探测依次返回上游 503、502、503。当前不是本地代码、配置、模型选择或 Key 缺失，不能在此状态创建真实 Run。
- 2026-08-02 恢复后 API/Board 与单活状态正常，今天唯一一次 Responses 探测仍返回 503；同一上游阻塞已连续出现两个目标回合。
- XHS 路径不依赖普通网页搜索的预检通过：`/v1/browser/status` 为 connected/search available，OpenCLI 实际搜索返回 4 条且全部通过小红书笔记 URL 校验；未输出账号、Cookie、标题或 URL。
- 第三个连续目标回合的唯一 Responses probe 再次返回 503。由于四条真实 Run 是 Board/发布的前置门槛，而本地和 XHS 可执行预检均已完成，剩余工作真实依赖上游状态变化，符合目标阻塞条件。
- 目标随后重新激活；按规则开始新的阻塞审计。恢复后的第 1 个回合复核本地健康与活动 Run=0 后，唯一 probe 仍返回 503，当前计数 1/3。
- 恢复后的第 2 个回合唯一 probe 仍返回同一 503；本地健康、活动 Run=0，阻塞审计更新为 2/3。
- 进一步用同一配置做最小隔离：`/models` 返回 7 项且当前模型存在；去掉 structured schema 与 reasoning 参数的普通 Responses 请求仍由 nginx 返回 502。请求形状已被排除，根因是中转推理上游不可用。
- 用户确认等待中转站修复；停止探测、停止创建 Run，不对本地产品代码做伪修复。
- 用户确认中转可能恢复后，单次 Responses structured-output probe 成功；随后创建社区文化中心扩建的全新单活 Run `a3f722fe-42ee-4329-af4b-96277cfc7347`，用于第二条建筑正式验收。
- 该 Run 最终 `blocked/research_synthesis_incomplete`：15 条真实模型查询均准确保留文化中心、扩建条件、子问题机制和证据类型，查询规划/候选筛选/正文分析无 fallback，但 15 轮只形成 7 个去重来源页且 0 个正式资产。正文分析没有绕过 `direct_match` 与逐字 EvidenceClaim 门槛。
- 项目 Playwright 隔离复核显示，Dezeen 多词站内搜索无命中时混入热门文章，Divisare 多词站内搜索只返回分类导航；现有“broader site query”仍调用同一失效站内搜索，因此恢复轮次无法增加项目多样性。
- 直接把回退改成 Bing RSS 不可行：实测 `site:dezeen.com` 与 `site:divisare.com` 约束被忽略，结果转向词典与百科站。下一步验证普通 Bing HTML 的受限查询，只有真实召回可用后才写红测与生产修复。

## 2026-08-02 Provider restored and industrial adaptive-reuse qualification

- 上一条修复验证 Run `322028c8-003b-4422-ae77-f4ac48bb891b` 第 2 轮出现一次 `APIConnectionError` 并触发 deterministic query fallback，因此无论终态都不能计入正式验收；后续轮次已真实使用可靠站点和 `expansion/addition/new wing/extension` 等价条件词。
- 普通公共网页查询中的 `小红书/Xiaohongshu/XHS/登录态` 来源词现被剔除；这只防止公共搜索上下文污染，没有改变登录态 XHS-only 搜索路径。
- 修复后完整 API 473/473、Ruff lint、64 文件 format check、strict Mypy 26 个源文件和 `git diff --check` 全绿。
- 项目自身 `responses.structured_output` capability probe 成功；Key 只由运行时从 Windows Credential Manager 传给客户端，没有读取、打印或保存。
- 新建唯一活动建筑 Run `9f31598c-2601-4fac-9caa-b84be01a9aad`，题目为旧工业厂房改造社区文化中心，明确 `research_sources=[]`；用于验证改造条件、保留结构、公共功能和公众流线在不同建筑类型上的全局搜索合同。
- 该 Run 自然完成为 `completed/coverage_satisfied`：3/3、11 个资产、3 个正式项目、1 个多图纸项目，coverage/enrichment gap 均为空。
- 6 条模型查询每题每轮 1 条，均为本地浏览器执行；准确包含工业厂房、改造、社区文化中心、当前空间机制和 floor plan/section/axonometric/project description，没有题外 `box-in-box` 或 `loading dock`。
- 75 条 Trace 中查询规划、候选筛选、正文分析和综合均有成功记录，Provider/deterministic fallback 为 0；一个无本地候选的轮次明确记录 reranker `not_called`，其他 5 次均由模型从本地候选中筛选。
- 5 个 SourcePage URL 无重复；11 个结果全部通过 `source_page_id` 绑定已读 URL，64 条 fact 全有 `text_excerpt`，claim URL 没有越出 SourcePage 集合。每个子问题分别有 3/6/9 个正式正文资产。
- 项目 Playwright 事后重读累计匹配 60/64 条引文；Vapor Cortes 第二次读取从瞬时浏览器错误恢复为 24/24，另一 Designboom 页面 12/12。余下 4 条在 ArchDaily 当前短页版本中暂不可见，但生产写入当次已经过精确正文白名单，和首条建筑 Run 的动态短页现象一致。
- 第一条 XHS 图纸 Run `f6a7fb48-cd22-4033-b90f-14af3fbb762c` 自然完成：3/3、23 个 visual lead、9 个来源项目，所有结果都已保存本地文件。
- 规划 Trace 明确 `planner=openai`；三方向各执行一次 `opencli-xiaohongshu` 搜索，每方向累计 3 篇 usable 笔记，视觉分类累计使用 30 次真实调用。没有 `deterministic_local_visual` 或其他 fallback。
- 12 个 SourcePage、23 个结果全部通过小红书 `/search_result/` URL 校验；普通网页的查询规划、候选筛选、页面读取和正文分析事件均为 0，证明 XHS-only fail-closed 路径没有泄漏到公共搜索。
- 第二条图纸 Run `814e997c-592b-4fee-b947-25cb37320025` 的最后方向按 rank 检查 4 帖，只有第 2、4 帖 usable，共 4 个图纸；全局视觉调用仅 35/48，因此旧 `visual_completion_allowed` 没有阻止 completed。
- 根因是完成许可只在 `inspection_budget.exhausted` 时检查 usable-note target；单方向已经达到 4 帖上限但全局图像额度仍剩余时，会错误绕过每方向 3 篇 usable 合同。
- 修复后 XHS-only 无条件要求全部方向达到 3 篇 usable 才能 completed；非 XHS 路径的 target 恒为 true。搜索、分类、4 帖/48 槽/48 MiB 数值和建筑 workflow 均未改变。
- 修复后的真实 Run `eb317b7b-863e-4ae0-9966-5b399d7516d9` 达到 3/3 和 12 个本地图纸，但中间方向 4 帖只有 2 篇 usable；新代码正确返回 `partial/visual_budget_exhausted`，证明不是只改测试。
- 同一 Run 的 sequence 29 记录一次视觉 `APIConnectionError` 并使用 `deterministic_local_visual`，即使 note target 满足也不能作为正式 Provider 验收。
- 最终 XHS Run `7405fca2-003c-4446-beaa-48c96cb52d34` 三方向依次达到 3 篇 usable；最后方向在第 4 帖达到目标。24 个结果全部有本地文件，12 个 SourcePage 与所有结果均为 XHS URL，35 次视觉调用无 fallback。
- 四条正式验收最终为建筑 2/2、图纸 2/2；所有正式 Run 都是 `completed/coverage_satisfied`。建筑四类 Provider Trace 成功且 fallback=0；图纸保持 XHS-only、真实规划和视觉调用且 fallback=0。
- Board 异步 hydration 约需 1.9 秒；只等待 network idle 会短暂看到空态。项目 Playwright 改为等待 `.results-section` 可见并滚动触发懒加载后，四页均完整显示。
- Board QA：XHS 24/24 与 23/23 图片加载，均 9 篇帖子；工业改造建筑 6 个案例/6 张图，新建图书馆 8 个案例/8 张图，均无空子问题。
- `v2.2.3` 升版需同步 11 个发布面：API 三处、Board package、Extension package/manifest、CI 两个 artifact、Release 合同测试、README 和两份部署文档；`pnpm-lock.yaml` 不保存 workspace package version，无需修改。
- Release 合同测试先按 `2.2.3` 失败于旧 CI artifact，再失败于旧 README 正则，全部发布面同步后转绿；这避免构建出版本名不一致的安装器或扩展 ZIP。
- PR #12 因复用 PR #11 squash 前分支历史而出现 GitHub 合并冲突；从 `origin/main` 新建分支并按原顺序移植 3 个未发布提交后，最终文件树与本地已验证树 SHA 完全一致，PR #13 可正常合并。
- Hosted CI run `30718825811` / job `91419013109` 用时 17 分 10 秒并成功完成完整门禁、独立扩展、Windows 安装器、真实安装 smoke 和 artifact 上传。
- `v2.2.3` tag 与远端 `main` 均为 `fc4e7a72dd7c86b61ffb3ad91c76d3c690e9fe47`；Release 非草稿、非预发布。扩展为 18,260 bytes / `DF1EFDC5381F559BCBE6ADC65D0AE5E79E19B6722237FB229E9FEF761D74E346`，安装器为 69,715,457 bytes / `A1F2658D9540966B5D1F24B90012F5CA1654FE90E863789B58F7B72A8E660D65`，GitHub digest 全部匹配。

## 2026-08-02 Xiaohongshu first-login gap

- Board 目前在没有扩展连接且没有 OpenCLI 时会阻止图纸 Run，但提示把“Chrome 已连接”与“小红书已登录”合并了。
- `/v1/browser/status` 的 `xiaohongshu_search_available` 只表示 `app.state.xiaohongshu_search` 存在，没有执行登录态验证。
- Board 在 `xiaohongshu_search_available=true` 时直接跳过 `ensureBrowserResearchAccess(true)`；现有测试也明确要求 OpenCLI 存在时可以无扩展创建 Run。
- 因此全新未登录用户可能先看到“研究环境已就绪”，后在运行期因无可用笔记返回 `no_usable_assets`；这是需要修复的首次使用合同缺口。
- OpenCLI 已提供 `auth status` 命名空间，结构化状态包含 `logged_in/not_logged_in/unknown/error`；优先复用它，无需通过搜索结果数量猜测登录。
- 扩展现有浏览器命令仅允许枚举的 `open_url/page_metadata/page_snapshot/enumerate_media/capture_region/scroll/wait/close_tab`；登录预检必须作为新的受限操作或由后端组合现有元数据，不能加任意 selector/脚本。
- OpenCLI 的 XHS auth adapter 快速检查只读取 `creator.xiaohongshu.com` 的 `web_session` Cookie 名称是否存在，`auth status --site xiaohongshu -f json` 可在不导航、不输出账号详情到产品日志的情况下返回结构化状态。
- OpenCLI 还提供 `xiaohongshu login`，但它是最长 300 秒的交互命令，不适合直接阻塞 API 请求。
- OpenCLI 搜索 adapter 已有受限登录墙判定：`/login`、`website-login/error`、指定错误码和“登录后查看搜索结果”。扩展预检可复用这类布尔信号，但只返回状态，不返回 DOM 或账号数据。
- 最终 API 合同为 `POST /v1/browser/xiaohongshu-session`，只返回 `status` 和通道类型；OpenCLI 输出在子进程内验证后丢弃，扩展仅在受管且最终域名为 `xiaohongshu.com` 的标签页执行。
- 扩展三态判定只使用登录路径/错误码、登录墙布尔文本和搜索结果卡片是否存在；返回中不包含笔记、DOM、账号或会话值。
- Board 进入图纸模式后在通道可用时自动预检，开始研究时再执行提交前确认；同一时刻的重复请求共用一个 in-flight Promise，不并发打开多个预检页。
- `not_logged_in/unknown/unavailable` 均 fail closed，不调用 Run API；只有 `logged_in` 允许继续。未登录状态显示固定 `https://www.xiaohongshu.com/explore` 登录链接和“重新检测”。

## 2026-08-02 Six-run stability findings

- 第一条新建小学 Run `f32d16e9-39b8-4998-a5a1-d2cca8c7e73f` 终态为 `partial`：1/3、1 个可用资产、1 个项目。它不能计入稳定性验收。
- 11 次模型查询规划、11 次候选筛选、5 次正文分析和 1 次综合全部是 `provider=openai/status=completed`，Provider fallback/error 为 0；只有一次本地搜索 `skipped/Error`。
- 11 条查询准确保留 new-build primary/elementary school、庭院/共享学习/流线/采光/结构机制和 plan/section/axonometric/project description，没有模板词污染。
- 本地搜索多轮虽返回候选摘要，但 reranker 总计只保留 2 个候选，最终只有 2 个去重 SourcePage：深圳南山外国语学校与悉尼学校扩建。前者相关性不足，后者仅覆盖公共流线分支。
- 当前根因范围是本地站点召回或候选保留，而不是 Provider 可用性、查询规划、正文 EvidenceClaim 或综合。下一步用项目 Playwright 重放代表性查询并核对站点压缩后的真实结果。
- 生产代码根因已定位：`_compact_new_build_site_query()` 只认识图书馆、工业、文化和社区类型，`primary school/elementary school` 等其他类型会被降为 `public building`；`newly built` 也未被识别为新建条件。
- 共享修复增加新建同义条件和常见具体类型保留，并允许源类型与目标类型同时存在；学习公区、教室组团等进入 program 机制。首查与站点宽化均复用同一类型提取，不改候选白名单、证据门槛或预算。
- 小学、医疗中心、公共市场、游客中心、旧仓库改市场及既有合同共 32 个目标测试通过。
- 项目 Playwright 重放小学查询后，ArchDaily 与 Designboom 已召回 Xianlin School、Skovbakke School、Xiaoquan Elementary School 等真实项目，证明当前补丁能修这一类型，但不能证明未见类型。
- 用户指出类型词表仍是单体策略；该判断成立。正式模型路径应把建筑类型、项目条件、当前机制和证据类型作为 Pydantic 结构化锚点传到本地搜索，站点查询从锚点重组，不再靠枚举类型猜测。
- 下一版设计：模型输出原查询及结构化锚点；Pydantic 验证锚点逐项存在于原查询且总长度受限；本地站点首查使用经验证的完整模型查询，宽化只使用全部锚点；任意未见类型也必须原样保留。旧确定性解析仅作为 Provider 失败兜底，正式验收不得依赖它。
- 结构化实现审计发现，首查虽已使用完整模型查询，但站点宽化仍把 `new-build` 改为 `new`、把 `renovation`/conversion 改成 `adaptive reuse`；这会篡改项目条件，仍不是通用传递合同。
- 新红测同时覆盖任意建筑类型和不同项目条件；生产修复删除结构化路径的条件重解释。现在宽化查询只由可选项目名、原始项目条件、原始建筑类型、当前机制和证据类型去重重组。
- workflow 集成测试确认带锚点的未知 `aquarium` 查询只调用 parser 的 `search_structured`，五类字段逐项透传且 Trace 为 `structured_query=true`；无锚点旧 Provider/mock 继续调用 `search(str)` 并记录 `false`。
- 与正式 OpenAI 合同冲突的 4 个旧 Provider 夹具已补齐结构化 anchors；它们原本验证的扩建同义补查、XHS 词剔除、瞬时重试和多命名项目拆分均保持通过。
- 相关四文件最终 263/263，全局覆盖拆题、Provider 结构化输出、本地候选、页面读取、补查预算、正文证据和 XHS 隔离；Ruff、55 文件格式、strict Mypy 26 个源文件和 `git diff --check` 全绿。
- 新类型 Run `792ab5f7-a923-4918-badc-da6ca150df14` 证明结构化入口真实生效：15 条模型查询均保留社区体育中心、新建条件、分支机制和证据类型，15 次本地搜索 Trace 均为 `structured_query=true`，规划/筛选/正文无 Provider fallback。
- 该 Run 仍为 0/3：15 轮只形成 4 个去重 SourcePage 和 7 次正文分析。Designboom 重放返回 podcast、机场和度假村，reranker 拒绝正确；Tongxiang National Fitness Center 正文只证明体育中心与公园整合及城市客厅，不证明共享大厅，正文未升级也正确。
- 真正通用缺口是补查失败原因过粗：每轮只收到 coverage/enrichment gap，不知道上一轮属于无候选、候选全拒或正文不支持，因此 5 轮始终复用 `community sports center`，无法适应国际站点的 `recreation/fitness/leisure centre` 等不同专业命名。
- workflow 新增按子问题的阶段反馈枚举；Provider prompt 只在候选不足时要求模型选择语义等价、国际站点常用的类型名称，并明确禁止泛化为 `public building` 或改成相邻类型。候选筛选同样按语义等价而非字面相等判断。
- 新红测先覆盖 prompt 与 workflow 反馈失败，再转绿；相关四文件最终 265/265，Ruff、55 文件格式、strict Mypy 26 个源文件与 `git diff --check` 全绿。
- 游泳馆 Run `f0a4d691-1360-46ef-bba6-efbf88385a0f` 首次查询规划模型输出为：anchor 含 `central public hall and spectator stands...`，query 含相同全部内容词但第一个 `and` 位置不同；旧校验要求整段连续子串，错误降级到 deterministic template。
- 为避免无资格 Run 继续消耗预算，该 Run 在第二个子问题刚开始时取消。修复不是放宽字段缺失：拉丁 anchor 的规范化内容词必须逐项出现在 query，中文 anchor 允许在连写查询中作为连续子串；缺少 `aquarium` 的反例仍被拒绝。
- 同一真实游泳馆子问题隔离规划随后成功返回 `public swimming center/new-build/central hall and grandstand/floor plan section` 完整 anchors。相关四文件 266/266 与全部静态门禁通过。
- 铁路客运站 Run `4670f769-c795-41c4-bdc2-c201fd8c4516` 的 13 条模型查询已经按轮变化并保留类型、条件、机制和证据类型；8 个 SourcePage 仍主要来自固定媒体站，只有图卢姆屋盖分支形成正式证据链。
- 项目 Playwright 重读确认苏州南正文只说明多层枢纽和线路同处地下，未说明与广场/街道的连续路径；图卢姆正文说明功能叠在站台上方和层间连接，但未证明城市公共空间连续连接或进出站/换乘/后勤分离。`relevance=2/enriched=0` 不应通过降低门槛修成覆盖。
- 通用架构残留有两处：`select_public_search_domains()` 把全部恢复轮锁在固定媒体站；确定性查询的未知类型末路仍会生成 `public building` / `adaptive reuse precedent`。正文“稳定焦点”还带 `原有/新旧/保留` 等改造预设，会干扰新建题型。
- 修复方向不增加类型词表：建筑媒体优先后转本地全网候选，由模型仍只从本地候选中筛选；fallback 保留原题英文词而不虚构类型条件；正文焦点改为项目条件中性；Trace 记录 direct match 与逐字证据链状态。
- 全网恢复的首次真实 Playwright smoke 发现 Bing `format=rss` 在当前地区忽略建筑查询，铁路站和天文馆两条不同查询都返回 NYT/NPR 等固定新闻首页；普通 Bing HTML 页面包含真实搜索结果，但旧 reader 会先收集页面全部导航链接。全网恢复必须改为 HTML URL 并只解析 `#b_results .b_algo h2 a` 结果卡。
- 后续隔离验证确认 Bing HTML、Google、Brave、Baidu、Yandex、DuckDuckGo、Mojeek 和 Yahoo 在当前本地 Playwright 环境中均不能稳定提供可用建筑结果；已撤回全网搜索方案，不能把验证码、固定新闻或导航链接当候选。
- 通用替代方案是同项目跨来源补证：可信且具体的项目页即使尚未形成正式候选，只要正文分析确认相关但证据链不完整，就按规范化项目名在最多两个其他可靠建筑站点逐站搜索；候选仍需同项目身份、可信来源、具体项目页和本地正文读取校验。
- 跨来源补证首次完整回归暴露额外搜索绕过总查询额度。新增统一预算门禁后，主搜索与补证都由同一个本地搜索 Trace 计数，当前 attempt 最多执行 `max_queries + completion_recovery_rounds × 子问题数` 次；额度耗尽后在模型查询规划前停止该公共搜索轮次。
- 该修复不增加建筑类型词表、Provider 调用额度、页面额度或 EvidenceClaim 门槛。任意类型由 `SearchQueryAnchors` 原样透传；跨来源补证只以模型/页面识别出的具体项目名为键。
- 新建城市消防站真实 Run `4a6f582b-67c3-49b1-abb9-362fbe316254` 最终 0/3。15 次本地搜索恰好等于 quick 的 `6 + 3×3` 共享上限，其中 4 次为同项目补证，证明预算门禁在真实运行中生效。
- 11 次查询规划中 8 次结构化成功、3 次 `ValidationError` fallback；fallback 查询丢失消防站类型，正式验收因此必然不合格。隔离重放同一子问题立即成功，说明模型偶发 query/anchors 不自洽，不能靠放宽锚点解决。
- 查询规划现在保持原严格校验，并在首次结构无效时最多发起一次固定纠正请求，要求每个非空 anchor 的词原样存在于 query；第二次仍失败才进入 deterministic fallback。工作流为该两次最坏调用预留 90 秒。
- 两个可信消防站页均未形成逐字证据；跨来源搜索分别返回 1、2、2 个结果，但同项目标题的语序/前后缀变化被旧完全相等规则拒绝。新身份规则只接受相等、完整短语包含，或双方较短标题至少 5 词且共享不少于 3 词、覆盖率至少 60%；短名称近邻反例保持拒绝。

## 2026-08-02 Generic stability correction after municipal archive run

- 市政档案馆 Run `17bd42b6-7793-45ea-b8af-973b7a855abb` 终态为 `blocked/research_synthesis_incomplete`、0/3。13 次查询规划全部 Provider 成功且 fallback=0，但 15 次本地搜索、13 次候选筛选仅保留 1 页，3 次正文分析均 `direct_match=false`。
- 项目 Playwright 重放显示 ArchDaily/Designboom 对长查询与 `archive` / `municipal archive` 短查询都主要返回博物馆、文化中心、办公园区和文章页；候选拒绝和正文不升级是正确行为。
- 这说明当前稳定性瓶颈是稀有类型的跨站召回，不是查询长度、Provider 可用性或 EvidenceClaim 门槛。不能把 art depot 等相邻类型冒充档案馆。
- 继续追加档案馆、学校、消防站等代码词表只会修复已知题。正式方向改为模型输出可校验的查询策略（精确类型、专业等价名、命名先例、证据角度），程序只验证锚点、去重、候选白名单、预算和证据绑定。
- 站点选择应基于本 Run 的召回产出：某站无候选或候选全拒绝后不机械重复；有同类型项目但正文不足时才进入命名项目跨来源补证。这是跨任意建筑类型的调度合同。
- 新验证标准是：类型名不进入生产分支；用多个任意未见类型做参数化/变形测试；全回归保持不退化；最后用修复后才决定的盲测题验证。
- 正式结构化路径的两个通用残留已修复：`LocalBrowserPageParser` 的站内类型不匹配判断改为从任意 building-type 锚点提取通用显著词项；workflow 按子问题累计无候选、全拒绝和正文不足站点，在其他支持站点尝试前不重复。
- 查询计划现在显式输出 `exact_typology | professional_equivalent | named_precedent | evidence_angle`。命名案例策略必须有同查询内 project-name 锚点；候选不足和正文不足分别要求不同恢复策略，重复策略会严格纠正或 fallback。
- 恢复轮只有在总搜索额度至少剩余两个槽位时才请求最多两条策略；否则自动收紧为 1。每个本地搜索仍由共享 Trace 预算门禁计数，未增加 Run 总查询、页面或 Provider 最坏调用上限。
- 参数化测试覆盖 planetarium、embassy chancery、memorial hall 等任意未见类型只存在于测试；新增生产差异扫描对这些及所有既有验收类型为 0 命中。
- 完整 API 509/509、Ruff、64 文件格式检查、strict Mypy 26 个源文件和 diff check 全绿。

## 2026-08-02 Ferry-terminal blind-run diagnosis

- 修改完成后才选定的新建城市渡轮客运码头 Run `34626a55-dbdb-46c6-920d-dc394ecb2651` 自然终止为 `partial/time_budget_exhausted`：1/3 子问题、5 个可用资产、1 个正式项目、1 个多图纸项目；Provider/deterministic fallback 为 0。
- 横滨国际客运码头形成了真实 URL 与逐字 EvidenceClaim，证明结构化查询、候选筛选、本地正文读取和证据绑定主链路真实运行；失败不能归因于 Provider fallback 或证据门槛。
- 共享的 15 次本地搜索全部耗尽，其中 8 次为 `project_text_supplement`。多个火车站、机场页面的正文分析已经返回 `direct_match=false`，workflow 仍为这些无关具体项目执行跨来源补证。
- 这是跨题型的预算调度缺陷：跨来源补证只能服务“项目与题目直接匹配但当前证据链不完整”的页面；正文已判定不直接匹配时必须停止该项目后续消耗。
- 模型拆出的屋盖子问题还把“新建城市渡轮客运码头”扩大为“交通或滨水公共建筑”。拆题必须继承用户声明的建筑类型与新建/改造/扩建条件，不能用相邻类型放宽候选边界。
- 下一修复不增加渡轮、火车站或机场词表。先以参数化行为测试约束分析结果门控和计划类型边界，再做最小生产修改。
- 生产代码已经计算并记录 `direct_match`、`supported_fact_count` 和 `evidence_chain_status`，但 `_try_public_page_analysis()` 只返回 `added: int`；上层因此无法区分 `not_direct_match` 与 `partial/no_verbatim_facts`，并无条件进入补证函数。
- 现有跨来源测试把主页面返回为 `direct_match=false` 后仍期待补证，这一旧夹具正好固化了错误合同；应改为“直接匹配且只有项目 context 逐字事实”，并另加任意项目的 `direct_match=false` 反例。
- 修复后调用层只在 `direct_match=true` 且 `evidence_chain_status != complete` 时补证；分析失败、正文明确不匹配和已完整证据链都会停止该项目后续搜索。直接匹配但仅有 context 逐字事实的项目仍按原两站点/两页面上限补证。
- 建筑规划提示现在要求每个子问题明确、原样保留用户声明的建筑类型和项目条件，并禁止扩大为相邻类型、泛化公共建筑或更宽松条件；该规则不包含任何具体建筑类型。
- 真实隔离调用用未预设的“新建高山植物种质资源保存库”验证通用规划：3/3 子问题都保留类型和新建条件；SearchQueryPlan 返回 `exact_typology + professional_equivalent` 两种策略，全部结构化 anchors 完整。调用为普通 Responses structured output，没有原生 `web_search`。

## 2026-08-02 Wetland-research-center blind-run audit

- 修改收口后才选定的新建湿地生态研究中心 Run `0452cfd2-8142-4e09-b483-8e86bddf573a` 自然终止为 `partial/time_budget_exhausted`：1/3、4 个资产、1 个页面，不 retry、不计验收；当前活动 Run 为 0。
- 新补证门控真实生效：15 次 `local_browser_search` 中 `project_text_supplement=0`；同一 NATURA 页面在共享中庭与访客/样本流线分支均为 `direct_match=false`，没有继续跨来源补证。
- 10 次查询规划中 9 次 Provider 成功；访客/样本流线第 3 轮一次 `ValueError` 后进入确定性 fallback，查询丢失湿地生态研究中心和新建条件，退化成连续环流/无障碍/疏散楼梯旧模板。这违反未知类型 fallback 保留原题范围的通用合同。
- 成功的恢复计划前三轮只使用 `exact_typology + professional_equivalent`，没有进入 `named_precedent` 或 `evidence_angle`；策略枚举存在，但跨轮升级尚未被约束，模型仍会机械复用前两类策略。
- 天窗/木结构分支的正文 Provider 返回 `InternalServerError` 后，确定性分析把 NATURA 页的建成年份和“开放空间建筑”两句泛化原文误判为完整机制证据，生成 4 个 partial 资产并造成虚假 1/3 coverage；综合模型随后明确指出这些引文不能证明天窗或木结构网格。
- 拆题问题本身保留了“新建湿地生态研究中心”，但 rationale 题外加入“小红书登录态下的可见图纸或照片”；建筑规划必须禁止引入用户未要求的来源通道，XHS-only 仍只属于图纸路径。
- 下一步先写通用红测：恢复轮策略升级、查询 fallback 原题范围保留、确定性正文机制支持门槛、建筑规划不得引入题外来源；全部收口前不创建新 Run。
- 四项最小实现均不依赖题型：混合语言 fallback 带回原 research question/subquestion；第 3 轮候选短缺至少要求 `named_precedent/evidence_angle`；确定性正文机制句至少命中当前研究意图词；建筑规划提示禁止题外来源平台和登录态。
- 相关回归证明更严格的确定性正文门槛会把旧“认证失败仍 3/3 completed”夹具降为 1/4 partial；这是防止伪完成的预期行为。未知中文 scope 只在类型解析结果没有具体类型、仅剩项目条件或 `architecture project` 时加入英文站点 fallback，已知工业/图书馆等英文查询保持简洁 ASCII。
- 真实第 3 轮重放暴露策略校验交叉冲突：模型返回 `exact_typology + evidence_angle` 已脱离前两轮组合，但现有 shortage 校验仍要求 `professional_equivalent/named_precedent`，导致两次结构化调用后抛 `ValueError`。通用规则应按阶段替换而不是累加：前两轮改类型称谓，后续改命名项目或证据角度。
- 分阶段修复后的同一真实重放返回 `exact_typology + evidence_angle` 并通过全部结构校验；建筑拆题 3/3 保留用户类型/新建条件，rationale 不再引入 XHS 或登录态。该调用只使用普通 Responses structured output。

## 2026-08-02 Children's-science-museum blind-run audit

- 修改后才选定的新建儿童科学馆 Run `5f740202-37ff-4f20-88f6-fe459223803a` 自然终止为 `blocked/research_synthesis_incomplete`、0/3；8 个可用候选资产但 0 个正式项目，保留、不 retry、不计验收，当前活动 Run 为 0。
- 10 次查询规划、10 次候选筛选和 5 次正文分析全部 Provider 成功，fallback=0；15 次本地搜索没有跨来源补证。严格门控没有再制造虚假覆盖。
- 第 3 轮三题均使用 `exact_typology + evidence_angle`，但没有任何 `named_precedent`。15 次搜索最终只读取 Moscow Polytechnic Museum、Hainan Science Museum、Perot Museum 三个上位类型页面。
- 五次正文分析全部 `direct_match=false/not_direct_match`，程序没有把一般科学馆冒充儿童科学馆，也没有生成正式机制 EvidenceClaim；失败是召回仍停留在泛化结果，不是正文阈值过严。
- 两槽位的晚期候选短缺应同时使用 `named_precedent + evidence_angle`，停止保留重复精确类型；只剩一个槽位时才允许二选一。这是跨类型的阶段调度，不包含儿童馆或具体项目词表。
- 真实儿童科学馆第 3 轮上下文重放已返回 `named_precedent + evidence_angle`，命名项目 anchor 非空；证明新规则通过普通 Responses 真实生效，不依赖测试夹具。

## 2026-08-02 Natural-history-museum blind-run audit

- Run `383b7203-f330-4afc-8784-9f1bfe59f0f6` 自然终止为 `partial/no_new_assets`：2/3、9 个可用资产、1 个正式项目，不 retry、不计验收；当前活动 Run 为 0。
- 查询策略真实逐轮升级：精确类型 -> 专业等价名 -> 两槽 `named_precedent + evidence_angle` -> 单槽证据角度 -> 两槽高级策略。全部查询规划、实际候选筛选、正文分析和综合由 Provider 成功完成，fallback=0。
- Gilder Center 为中庭连接和参观流线建立真实 URL 与逐字 EvidenceClaim；上海、英良石材和深圳自然历史博物馆页面均因不能逐字支持采光顶、大跨屋盖和剖面层次而保持 `direct_match=false`，没有伪完成。
- 第 3 轮命名先例已尝试 `Shanghai Natural History Museum` 并判不匹配，第 5 轮模型又生成同一项目；候选过滤虽阻止重复页面再次升级，但重复本地搜索已经占用最终查询额度。
- 通用根因是查询规划只接收排除 URL，没有接收已尝试项目；同时 workflow 仍用旧 `Library/Museum/Centre...` 后缀正则从查询猜项目名，结构化 `project_name` 在未登记项目类型上可能失效。
- 红测与最小实现已完成：workflow 向后续规划传递已访问、已候选和已命名的项目；Provider 拒绝重复命名先例并在既有两次结构纠正上限内换项目；正式结构化路径直接使用 Pydantic `project_name` 过滤候选，旧字符串解析只保留给无锚点兼容路径。

## 2026-08-02 Public-market blind-run early-stop audit

- Run `8308a18e-1898-4e4b-a352-4014dd612d4d` 在第 2 轮出现一次 `search_query_planning / ValueError / deterministic_template` 后立即取消，以免不合格 Run 继续消耗预算；终态 `cancelled/user_cancelled`、0/3、7 个候选资产，不 retry、不计验收。
- 建筑主搜索始终没有实际进入 XHS，但模型拆题的两个 rationale 题外加入“登录态小红书核对”，证明只靠提示词不能锁定建筑/XHS 来源隔离。
- 查询规划的第二次纠正提示只强调锚点和第 3 轮策略，没有明确重申正文不足时的 `named_precedent/evidence_angle`、旧查询排除和项目别名排除，可能让两次结构输出重复同一错误。
- 通用红测与最小实现已转绿：建筑拆题检测到用户未要求的 XHS、social platform 或登录态后，在同一有界规划阶段纠正；第二次查询纠正明确处理正文不足、旧查询及排除项目的别名、译名、缩写和不同拼写。
- 真实纯内存重放同一题成功：3 个建筑子问题均无题外来源；第 2 轮返回两条完整结构化查询、策略为 `exact_typology + evidence_angle`，无 `ValueError`，也没有重复 Rotterdam 项目别名。

## 2026-08-03 Concert-hall resume and budget audit

- 新建城市音乐厅 Run `6cac2ab8-0532-407a-9981-9e99c8f25b69` 最终为 `partial/time_budget_exhausted`：1/3、5 个可用资产、1 个正式项目，不计入 3+3 验收。
- sequence 17 的候选筛选遇到 `APIConnectionError` 后 deterministic fallback 保留 4/4；随后 4 个页面解析分别为 1 个 `Exception` 和 3 个 `AttributeError`，没有产生正文证据。另有一次 Limoges 正文分析 `APITimeoutError` 后 deterministic fallback，正式 fallback 不为 0。
- sequence 27 开始第 3 子问题后，sequence 28 再次进入 workflow planning；同一 attempt 0 随后重新执行第 1、2 子问题。数据库确认前两条 QueryAttempt 在恢复前已是 `completed`。
- 根因不是 completed 状态丢失，而是恢复身份包含可变语言：`build_queries()` 的 round 1 固定生成 `zh` key，模型规划后 `_update_query_attempt_text()` 将已完成 QueryAttempt 的语言改为 `en`；恢复时 `(round, zh, subquestion)` 无法匹配 `(round, en, subquestion)`。
- 每轮每个子问题只有一个 QueryAttempt，模型最多两条查询合并在该 attempt 内，因此不可变执行身份应为 `(round_number, subquestion_id)`；language 只用于描述和 Trace。显式 retry 的 attempt 代际与零覆盖重跑规则继续由 `run_attempt` 和现有分支控制。
- 多条盲测都精确耗尽当前 quick 的 15 次网页搜索总额度。用户同意在修复重复恢复与无关候选放行后有限增配，但不得通过降低证据门槛或无限重试制造完成。
- 恢复红测使用 `BaseException` 模拟进程退出：首个空结果 QueryAttempt 已 completed，第二个 started；把首个 language 从 `zh` 改为 `en` 后，同 attempt 恢复的旧实现确实重复 program。改用 `(round_number, subquestion_id)` 后，program/circulation/section 计数为 `1/2/1`，且 5 项旧 retry 合同继续通过。
- reranker fallback 的通用缺口不是音乐厅词表：正式结构化计划已经有 building-type anchor，降级层却丢弃该字段并退回少数硬编码类型判断。新实现复用本地结构化搜索的任意类型匹配；未登记 planetarium 正例保留，arts campus/library 泛化反例排除。
- 音乐厅 4 个 Designboom URL 当前项目 Playwright 重读为 2 页成功、2 页 `ERR_HTTP_RESPONSE_CODE_FAILURE`；旧 AttributeError 不稳定复现。`start.ps1` 没有 watcher/自动重启，旧启动日志已被后续启动覆盖，因此不猜测外部重启触发；产品可验证修复聚焦断点恢复幂等。
- 新预算按深度有限增长：有效搜索 15/24/42 -> 18/28/48，基础页面 12/30/60 -> 16/40/72，时间 30/30/30 -> 40/60/90 分钟；恢复页每题 2 -> 3。严格完成与证据合同不变。

## 2026-08-03 Student-center live-run recovery

- 会话恢复确认三档预算增配已经落地并通过 351 项精准搜索相关测试、519 项完整 API 回归、Ruff、format、strict Mypy 和 `git diff --check`；本轮不重做这些门禁。
- 唯一活动 Run `4bcbd249-8701-48a6-b0d4-69beb2f83c58` 不是跨夜停滞：API/Board 于本地 01:09 启动，Run 时间戳为 UTC，启动恢复任务仍在执行。
- 截至 Trace 39，Run 为 `searching`、2/3 子问题覆盖、3 个 usable assets、1 个正式项目和 1 个多图纸项目；`search_query_planning`、`candidate_reranking` 与 `public_page_analysis` 均为 Provider 成功，fallback=0。
- 唯一缺失分支为 `atrium_program`；当前 gaps 为 `uncovered_subquestions/article_analysis_incomplete`，enrichment 还缺资产数、项目多样性、verified/partial 数和子问题资产数。继续轮询同一 Run，不创建或 retry 其他 Run。
- Trace 40 随后出现 `public_page_analysis / APITimeoutError / deterministic_fallback`；Run 虽达到 3/3 coverage，但不满足正式 fallback=0 门槛，已立即取消并保留，不计验收、不 retry。
- 失败页已由本地浏览器读取且 `direct_match=true`；问题集中在正文结构化分析的两次 45 秒 medium 调用均超时。修复应只增加正文分析窗口并降低瞬时错误重试的 reasoning effort，不延长查询规划或候选筛选，也不放宽 EvidenceClaim。
- 正文分析现在使用独立 75 秒单次窗口；第一次瞬时错误后的第二次调用改为 low reasoning，语义/逐字证据纠正仍保持 medium。最大调用数仍为 2，调度公布的最坏预算从 90 秒同步为 150 秒。
- 修复加载后的真实隔离验证使用同一 Designboom 大学中心页面：项目 Playwright 读取 10,373 字符正文，Provider 在 35.0 秒返回 `relevance=3/direct_match=true`、4 条事实、完整项目条件/机制和 4 条转译步骤，没有 fallback。
- 生产和测试代码对 `business school / management school / school of business / 商学院` 扫描为 0 命中；下一条盲测使用新建大学商学院教学中心，不复用学生中心 Run。
- 用户明确要求案例准入不要过度追求题型严丝合缝，应把重点放在后续可迁移机制、参考方法和适用边界。新的通用边界是：事实与逐字 EvidenceClaim 不放宽；候选层最多加入 1 个同建筑尺度、当前机制高度可迁移的类比案例，弱机制、仅视觉相似或一般相邻类型继续拒绝。
- 商学院 Run 在旧门槛下推进到 10 个 partial 资产、0 个正式项目后已取消，不计验收、不 retry。Trace 仍为 fallback=0；Isenberg 页面由 Provider 判 `direct_match=false` 且没有支持事实，按新规则也不会自动升级。
- 综合模型现在明确把证据充分的跨类型案例作为类比参考：保留可借鉴操作和转译步骤，同时依据 limitations 输出失效边界；禁止把类比案例写成同类型直接先例。该规则适用于 quick、balanced、deep 三档。
- 真实普通 Responses reranker 隔离验证两次成功。商学院精确候选为 relevance/typology/mechanism `4/4/4`；大学学习中心为 `3/2/4` 并保留；跨类型社区文化中心为 `3/0/4` 并保留为强机制类比；普通办公大厅仅 `0/0/1` 或 `1/0/1`，均拒绝。
- 隔离调用只使用提供的本地候选 ID，没有原生 web_search；新 Pydantic 字段由真实 Provider 正常返回。类比候选仍需后续本地正文读取和完整逐字 EvidenceClaim 才能进入结果。
- 建筑学院 Run 最终形成 3/3 正文覆盖和成功综合，但只有 Milstein Hall 一个正式项目；综合本身已能给出剖面叠合、模型运输、北向采光和大跨结构的转译操作与失效边界。它不能计验收，因为 quick 丰富目标仍缺项目多样性和多图纸项目。
- Trace 与查询表联合审计确认 40 分钟没有耗尽；18 次有效本地搜索额度已在第 13 个 QueryAttempt 中耗尽，旧 workflow 把“没有可用搜索通道”统一写成 `time_budget_exhausted`。现已区分为 `query_budget_exhausted`。
- 原“最多 1 个类比且 relevance>=3”仍可能漏掉只回答一个关键机制的可靠案例。新边界为：总候选最多 4；强机制类比最多 2；relevance>=2、mechanism_transferability>=3、source_trust>=2；是否形成正式结果继续交给本地正文逐字证据分析。
- Provider 提示明确：类比不必满足题目所有项目条件或同建筑类型，但候选标题/摘要必须指出至少一个当前空间机制，且处于可比较的建筑决策尺度。没有机制的一般相邻类型、视觉相似和普通中庭/楼梯继续拒绝。
- 真实 `gpt-5.6-sol / responses` 隔离结果符合边界：建筑学院直接候选 `relevance/typology/mechanism=4/4/4`；文化论坛类比为 `3/1/4`；大学学习共享空间类比为 `2/1/3`；普通办公大厅为 `0/0/0`。前三个 retain=true，弱候选 retain=false。
- 工程创新中心真实 Run 证明候选准入不是唯一入口：后期查询仍出现“中庭 + 教学实验室 + 工坊 + 工作室 + 展示 + 北向采光”等过载机制串，即便 reranker 接受部分机制类比，本地站点也很难召回这类页面。
- `LocalBrowserPageParser` 对结构化首轮中的跨类型结果不会硬删除；类型不匹配时会保留首轮结果并追加宽化搜索。Run 中 `candidate_count=0` 来自 URL/项目排除集合，不是类型过滤。
- 新合同把空间机制锚点限制为一个切片：英文最多 12 个词，中文最多 32 个汉字。它不移除建筑类型、项目条件或证据类型锚点，只阻止模型把整道子问题复制进查询；过载返回会在普通 Responses 内纠正一次。
- 真实重放证实模型会在该合同下拆开机制：中庭分支分别查询“多层协作中庭连接功能”和“北向采光教学核心”；流线分支分别查询“三类流线分离”和“服务/公共/教学路径”；结构分支分别查询“可见框架与可扩展楼板”和“模块楼板与可接近设备”。最长机制锚点 9 词。

## 2026-08-03 Medical-education-center analogy boundary audit

- 唯一 Run `363c9289-eae9-4767-be79-1da6d0918d94` 已自然终止为 `blocked/research_synthesis_incomplete`：0/3、6 个 partial 图纸资产、0 个正式项目，Provider/deterministic fallback=0，不 retry、不计验收。
- Run 完成了 4 轮结构化查询；后期真实使用 `named_precedent + evidence_angle`。本地搜索与候选筛选均运行，两个同类型医学教育页面进入正文分析。
- 三次最新正文分析均为 Provider 成功，但返回 `relevance=1/direct_match=false/supported_fact_count=0`；失败点已从候选准入转到正文是否能提取“只覆盖一个机制”的受限参考。
- 用户边界不允许把案例题型卡死，但仍要求后续分析说明如何参考。下一步不降低逐字证据要求，而是验证正文分析是否仍因长子问题整体匹配而清空局部可迁移机制；红测必须使用任意未见建筑类型，避免为医学教育中心写单体策略。
- 查询表与 Trace 联合审计进一步定位到更早的召回缺口：11 个 QueryAttempt 全部把目标建筑类型锁在查询中，后期命名先例也仍是同类型；所有候选筛选的 `analogical_retained_count` 均为 0。现有适度类比只在 reranker 准入层生效，没有恢复查询负责召回跨类型强机制案例。
- 因此不应继续降低 reranker 分数或正文 `direct_match`。通用修复方向是：精确/专业等价/命名同类搜索不足后，在总查询预算内使用一个明确的机制类比恢复策略，让本地浏览器召回可比较建筑决策尺度的案例；后续仍由模型筛选、本地正文和逐字 EvidenceClaim 决定是否可用。
- 拟定的有界合同：默认及早期恢复仍使用精确类型、专业等价类型、同类命名先例与证据角度；只有这些路径连续不足后的晚期恢复，两个查询槽中的一个才能使用 `mechanism_analogy`，另一个继续保留同类型证据搜索。类比查询由模型选择一个非泛化、建筑决策尺度可比的来源类型，并继续携带项目条件、单一机制切片和证据类型；不新增调用或页面预算。
- 本地结构化搜索必须按类比来源类型召回，随后 reranker 仍以目标问题打分且最多保留 2 个强机制类比。正文层已有“只需支持一个机制、类型差异写入 limitations”的严格提示；正式持久化仍要求两条核心事实、逐字 excerpt、转译步骤和可比较尺度。
- 红测先准确失败于 `mechanism_analogy` 不在 Pydantic 枚举。最小实现增加 `target_building_type` 审计字段：类比查询的 `building_type` 是实际要检索的具体来源类型，目标类型只保存为结构化上下文，不塞进执行查询；来源类型与目标相同或为 `public building/architecture project` 等泛化值会校验失败。
- Provider 调度只允许第 4 轮后且存在候选全拒或正文不足时使用类比。两个槽位必须恰好一个类比和一个目标类型的命名先例/证据角度；一个槽位才单独用类比。第 1-3 轮提前返回类比会在同一两次结构纠正上限内换回专业等价或其他目标类型策略。
- 工作流集成测试确认模型计划中的类比来源类型原样传给本地 `search_structured`，没有改用 Provider 原生 web_search，也没有把目标类型重新拼回站内搜索。Provider 全集 64/64 通过。
- 完整回归收口：浏览 workflow 133/133、workflow/schema 68/68、完整 API 526/526；Ruff lint、55 文件格式、strict Mypy 26 个源文件与 diff check 全绿。现有 XHS-only 分流、预算门禁、重复排除和证据持久化均未回退。
- 服务重启后的真实普通 Responses 规划在 24 秒返回 `evidence_angle + mechanism_analogy`；类比来源类型为 `spacecraft assembly and testing facility`，目标类型为 `marine robotics testing center`，查询没有原生 web_search。
- 项目 Playwright 用同一结构化查询轮换 4 个生产站点耗时约 98 秒：ArchDaily 返回 Museu Paulista、Pina、Sanxingdui 和 Arena Zagreb，Designboom 返回 podcast，Dezeen 返回产品/桥梁/竞赛，Divisare 为 0；没有一个航天器设施候选。
- 这不是 reranker 过严，而是类比规划只优化机制相似度，没有优化现有建筑媒体的可发现性。下一合同应要求选择有较多完整建成项目页、通常会发布平剖面和项目正文的常见建筑来源类型，拒绝只因技术名称相似而选取稀有设施。
- 2026-08-03 产品方向纠正：此前盲测题把概念初期研究误写成了具体方案验证，导致拆题和搜索越来越窄。正确链路是宽泛任务 -> 开放研究维度 -> 空间优先搜索 -> 从证据发现机制 -> 输出参考方式与边界。
- 2026-08-03 搜索权重纠正：建筑类型不是默认首要检索对象。对于“互动展厅、教育空间与中庭关系”一类议题，查询应优先覆盖这些空间及其关系，并允许其他建筑类型的可信案例进入候选；类型只提供尺度、条件和语境约束。
- 2026-08-03 冲突审查：此前新增的 Pydantic 查询锚点要求每条 query 包含 `building_type`，Provider 恢复策略以 `exact_typology/professional_equivalent/named_precedent/evidence_angle` 为主，`mechanism_analogy` 只在第 4 轮后出现；这与“空间优先”直接冲突。
- 2026-08-03 冲突审查：本地 `search_structured` 会把项目条件和建筑类型排在空间机制之前拼接，并在 deterministic reranker fallback 中按结构化 building type 过滤候选。正式 reranker 和正文分析已具备跨类型机制判断，后两者可保留并改成常规空间相关性准入，不必重写证据层。
- 2026-08-03 设计决定：采用同一预算内的两路检索。空间优先路负责跨类型发现，项目语境路负责同类条件和适用性校验；不新增搜索调用、页面调用或 Provider 调用预算。
- 2026-08-03 首轮实现验证：概念初期 fallback、Provider 拆题、空间优先 Pydantic 查询、工业改造语境查询、本地 structured search scope、跨类型候选排序和 workflow 参数传递共 10 项已通过。空间候选按机制可迁移性排序，因此更强的跨类型空间案例会排在较弱候选之前。
- 2026-08-03 fallback 冲突复核：`_public_issue_focus()` 仍按旧 intent 自动扩写动静分区、连续环流、工作坊、柱网和桁架，这是双路检索主体之外最后一个明确的方案预设冲突。
- 2026-08-03 fallback 最小修复：改为通用显式词汇提取和中性关系维度。用户明确写出的互动展厅、教育空间、中庭、阶梯阅读、流线、采光、结构或改造界面会被保留；未出现的形式、构件和功能不会由模板补入。明确技术问题仍可逐词保留，不需要回退到类型专用分支。
- 2026-08-03 残留扫描：正式 `SearchQueryStrategy` 只含 `space_first/project_context/named_precedent/evidence_angle`。`mechanism_analogy/exact_typology/professional_equivalent` 仅出现在反向测试和纠正提示的禁用文本中，不可执行。
- 2026-08-03 定向验证：planning 18/18、相邻 workflow 搜索 fallback 3/3、Ruff 和 diff check 通过。当前无活动 Run，下一步进入 Provider/Public Pages/browser workflow 组合回归。
- 2026-08-03 回归收口：精准搜索相关组合 366/366、完整 API 534/534、Provider 67/67 全绿；Ruff、64 文件格式、strict Mypy 26 个源文件和 `git diff --check` 通过。唯一相关失败来自旧测试要求题外 `staff circulation` 和固定采光词序，按显式词合同修正后整组通过。
- 2026-08-03 真实 Provider 纯内存验证：宽泛概念题生成 `program_relations/user_journeys/coastal_response` 三个开放维度，没有预设形式、材料、结构或流线答案。两条查询分别为 `space_first` 和 `project_context`；空间优先路省略类型与新建条件。reranker 将跨类型图书馆和同类文化中心均判为强空间机制候选，拒绝无关办公立面。
- 2026-08-03 第一条真实概念盲测在计划阶段证明，仅靠 prompt 不能保证开放拆题：模型把宽泛青年文化中心题具体化为展览、工作坊、后勤、中庭、自然采光和剖面层次。Run `3ea1dd1b-08ff-48a8-b7fa-a5f2b1cdbdbf` 已立即取消。
- 2026-08-03 通用修复不是建筑类型规则，而是“具体方案前提必须已由用户声明”的输出门控。它覆盖空间形式、程序房间、流线模式、环境手段、材料和结构词族；只有检测到新增前提才调用一次纠正，显式技术题继续保留原词。
- 2026-08-03 修复后相关 367/367、完整 API 535/535 和全部静态门禁通过。真实同题重放只调用一次 Responses，直接得到空间组织、使用体验、城市/气候/公共空间回应三类开放维度，无题外具体前提。
- 2026-08-03 专用空白 workspace 的 Run `abc168c5-2b31-49c5-a6d5-206b93bf8aea` 在首轮 `user_experience` 查询规划产生 `ValidationError / deterministic_template`，现已取消并保留。其他轮次真实执行了 `space_first + project_context`，跨类型候选可进入正文读取，其中一页形成完整逐字证据链；双路方向有效，失败集中在查询结构校验。
- 该 Run 的失败 fallback 查询退化为 `architecture project drawings: user experience activity relationships spatial connections...`。QueryAttempt 不保存失败的模型原始结构，这是正确的敏感面控制，但现有第二次纠正提示也没有收到具体校验原因，只能机械重申所有规则。
- 冲突审计发现 `SearchQueryAnchors.spatial_mechanism` 强制模型在证据读取前给出“机制切片”，真实成功查询也出现 `shared threshold`、`activity overlap` 等预设关系；这和“机制从证据中发现”不一致。查询阶段应表达中性 `spatial_focus`，正文阶段的 `design_mechanism` 证据合同保留。
- `building_type` 当前必填，无法处理用户只问展厅、教育空间、中庭等空间关系且未给建筑类型的概念题；类型应为可选结构化语境，题目未声明时不得由空间词反推。
- 英文 `space_first` 查询目前要求全部 anchors 为 ASCII，即使中文 building type/project condition 只作上下文、不进入执行查询；这与“保留用户项目语境”冲突，也是最新真实 `ValidationError` 的高概率通用触发条件。ASCII 与逐词包含校验应只作用于 query-visible anchors。
- 正式 reranker 仍以 `mechanism_transferability` 为首排序信号，且同类型候选可绕过来源可信度；deterministic reranker 在已有 `space_first` 时仍调用旧 typology matcher。候选层应改为空间相关性、正文/图纸可读潜力和可信来源优先，类型只作补充。
- 五个通用红测在旧实现上全部准确失败：空 building type 与 `spatial_focus` 被 Pydantic 拒绝；中文 context-only anchors 被英文 ASCII 合同拒绝；第二次纠正没有校验路径；跨类型强空间候选因旧 mechanism 分数被拒；低可信同类型候选反而被放行；空间优先 deterministic fallback 重新按文化中心类型排除了图书馆空间案例。
- 最小修复后，`SearchQueryAnchors` 只在用户声明时保存 building type，并用 `spatial_focus` 表示中性研究主题。space-first 的类型/条件只作结构化语境，可保留中文；真正进入英文 query 的 focus/evidence/project name 仍必须 ASCII 且逐词存在。
- 查询规划首轮一槽明确要求唯一 `space_first`；首次 `ValidationError` 的字段路径、类型和消息经 `errors(include_input=False)` 限为最多四项/1000 字符，只发送给第二次普通 Responses 纠正，不写 Trace、数据库或日志。
- CandidateAssessment 改为 `spatial_relevance`。代码准入要求 `relevance>=2`、`source_trust>=2`，并满足空间相关或可信同类型项目页；排序以空间相关性优先。页面正文仍必须产生两个逐字核心事实、project context、证据支持的 design mechanism 和 transfer strategy。
- 联合回归唯一旧冲突是共享 mock 把 Designboom 固定打成低可信，但同一测试又期望读取其项目页；夹具现按生产可信建筑媒体集合修正，没有放松正式来源门槛。
- 2026-08-03：概念初期 Run `2a45daa0-52e9-4d35-860f-17a023292a83` 的搜索和分析链路本身成功：3/3 子问题正文覆盖、3 个正式项目、18 个可用资产、完整综合、四个 Provider Trace 阶段成功、fallback=0。终态 `partial/budget_exhausted` 只由 `insufficient_multi_asset_projects` 引起。
- 覆盖计数旧实现对 precedent + article analysis 使用 `article_ready` 资产同时计算项目图纸类型；这错误地要求每张同页图纸都复制项目正文分析与 EvidenceClaims。真实蒙特卡洛案例同一项目页已有 section 与 axonometric，但只有 section 承载分析字段，所以被误计为 0。
- 正确边界是：项目仍必须先有严格的 article-ready 正文证据；丰富度可统计该项目同一已验证来源 URL 下相关且为 verified/partial 的不同图纸类型。项目名相同但来源 URL 不同不能聚合。修复后真实数据重算为 `multi_asset_projects=1`、无 enrichment gaps，正文和 EvidenceClaim 门槛不变。
- 2026-08-03：新 Run `22fb1bee-201b-4753-85c2-2ce75ffa48bd` 的 14 条模型查询均为空间关系、使用体验或场地环境证据词，没有类型中心锁死；模型读取 13 个正文分支，严格拒绝 7 个证据不足页面，并从 StreetMekka 与 Vilkaviškis 公交站形成 3/3 逐字证据覆盖和完整综合，fallback=0。
- 该 Run 达到核心答案后仍因 quick 强制 3 个正式项目和 1 个多图纸项目继续耗尽查询。对概念初期 quick，这两个指标属于研究丰富度，不应凌驾于 3/3 正文证据与分析价值；2 个独立项目已经支持跨案例机制和清晰适用边界。
- quick 现只校准项目数 3→2、多图纸项目 1→0；assets_per_subquestion=2、assets=6、verified_or_partial=4、分析要求、EvidenceClaim 和综合均不变。balanced/deep 的 4/6 项目与 2/3 多图纸项目不变。
- 2026-08-03：quick 校准后的首条全新题 `cc7eee8a-bc70-4f9c-867a-d975567a1c4b` 在第 3 轮自然完成，而不是跑满 18 个搜索槽。它从 Castor Place 与 Calgary Central Library 两种不同类型提取内部空间编排和街角抵达机制，3/3、10 资产、18 条逐字 EvidenceClaim、fallback=0。
- 该 Run 的 Trace 含 6 次成功查询规划、6 次成功 reranking、4 次成功正文分析、1 次成功综合、7 次本地浏览器搜索和 3 次本地正文读取；原生 web_search 事件为 0。说明 quick 调整只移除了非核心尾部追逐，没有绕过模型或本地浏览器链路。

## 2026-08-03 Small-building renovation qualification audit

- 建筑验收候选 Run `e665999e-a7a9-4d79-b4e9-c69fbf5ada85` 自然终止为 `blocked/research_synthesis_incomplete`：0/3、0 usable assets、0 正式项目，保留、不 retry、不计验收；当前活动 Run 为 0。
- 空间关系与使用体验各运行 4 轮，街区联系运行 3 轮；全部模型阶段没有 deterministic fallback，因此不能用 Provider 降级解释失败。
- 已知失败信号是：One and a Half Co-working Studio 本地正文读取超时；Project Ulsoor Office 与 Vertical Village 的正文分析为 `direct_match=false`；后续多轮站内搜索返回 0 候选。
- 下一步必须联合审计完整查询、站点调度、候选去重/排除和正文输入，判断是改造条件、空间焦点、查询语言、站点可发现性还是项目排除过早造成通用低召回；不得添加手工工坊、共享办公或旧城改造的题型专用词表。
- 数据库对齐结果：11 个 QueryAttempt 全部由 Provider 成功规划，共执行 18 次本地搜索，最终只持久化 6 个 SourcePage。第 3-4 轮在 `divisare.com` 与 `archdaily.cn` 的 7 次结构化搜索全部返回 0，查询预算因此耗尽在低产出恢复站点。
- 第 2 轮使用体验分支从 ArchDaily 的 8 个本地候选中保留 4 个可信候选，但 One and a Half Co-working Studio 正文读取超时，Project Ulsoor Office 正文为 `direct_match=false`；其余两个保留页没有进入正文分析。
- workflow 在候选筛选后、正文读取前就把本批全部候选 URL 和项目键加入全局排除集合；`parsed_pages[source.url] = None` 还会缓存读取失败。因此瞬时超时页面既不会在后续查询重新出现，也不会在当前 Run 重读。
- 正文分析预算在首轮每子问题最多 3 页、后续每个 QueryAttempt 最多 1 页。该边界本身控制成本，但与“读取失败仍永久排除”组合后，会把一次浏览器超时放大为整条证据分支丢失。
- 成功对照 Run `cc7eee8a-bc70-4f9c-867a-d975567a1c4b` 同样存在无候选、超时和 `direct_match=false` 页面，但 Calgary Central Library 与 Castor Place 在前两轮形成可复用完整证据链，故能在 7 次本地搜索后完成。失败 Run 没有任何首个成功页面，恢复轮便只能继续消耗低召回站点。
- 项目 Playwright 重新读取 One and a Half Co-working Studio 成功，正文只有一段核心项目说明：原摄影代理办公室被改造为联合办公、maker workshop 与咖啡空间，服务东伦敦创意社区。真实 Provider 纯内存分析返回 `relevance=2/direct_match=false`、2 条同源事实；它与目标语境高度相关，但正文没有可核验的空间邻接、边界、动线或体验机制，因此不能单页升级为正式结果。
- 这证明“读取失败重试”可以避免丢掉相关候选和补证入口，但不能单独保证覆盖；正式 EvidenceClaim 门槛不应降低。
- 同一 Designboom 项目语境搜索的中英文 A/B 都只返回同一条无关 podcast，说明该站对长结构化查询的低召回不是单纯语言问题。当前 `_structured_site_query()` 仍按“项目条件 -> 建筑类型 -> 空间焦点 -> 证据类型”执行，与已批准的空间优先设计冲突；Provider 只把 `preferred_language` 当建议，也尚未强制国际站点查询语言一致。
- 项目 Playwright 用简洁诊断查询 `workshop coworking shared space adaptive reuse floor plan` 轮询 ArchDaily、Designboom、Dezeen，三个站点均返回 4 条候选；其中包括 SALT Workspace、Punto Luce、Second Home 与新的 co-working 项目。这证明现有站点有可发现案例，主要召回缺口是结构化项目语境查询过载，而非预算绝对不足或站点无数据。
- 通用修复边界应同时约束：国际/中文站点语言与 `preferred_language` 一致；building type 与 project condition 只保留简洁项目语境，不复制整段 brief；实际站内项目语境查询以 `spatial_focus` 为首要词；最终执行词数有界。不能为 maker、coworking 或 renovation 增加题型专用生产词表。
- 另需独立红测：本地正文瞬时读取失败不得把已选候选永久标为已访问/无关；最多一次有界重读，成功或明确不相关后才进入永久排除。该修复不增加搜索调用预算，也不放宽 EvidenceClaim。
- 五类通用行为测试在旧实现上准确得到 6 个失败：英文/中文过载条件均未拒绝、国际站点语言未纠正、项目语境 fallback 仍以条件/类型开头、正文超时不重试、已选但未读候选无法进入恢复轮。
- 最小实现后 6/6 转绿：`project_condition` 限为 6 个拉丁词或 12 个汉字；普通 Responses 结果必须匹配当前站点 `preferred_language`，否则在既有一次纠正内重试；项目语境站内 fallback 改为“项目名 -> 空间焦点 -> 条件 -> 类型 -> 证据”；本地正文仅对超时重读一次；被 reranker 拒绝的候选立即排除，已选候选则在实际读取/检查后才排除。
- 这些修改不增加本地搜索调用、Provider 调用、候选数或页面槽位，不放宽正文两条核心事实、URL、逐字 EvidenceClaim、limitations 或 XHS-only 合同。
- 恢复路径仍有独立冲突：选中的本地候选会在正文读取前通过 `_persist_sources()` 写入 `SourcePage(access_status="available")`，而新进程初始化把该 Run 的全部 `SourcePage.url/title` 都加入排除集合。因 `SourcePage` 当前没有区分“待读取、已访问、已判无关”，同进程延后排除修复不能覆盖服务中断后的恢复。
- `SourcePage.access_status` 目前只有写入默认值且没有其他生产读取者，可在不改数据库结构的前提下承载最小状态机：`pending` 不进入恢复排除，`available` 表示已实际读取/检查，`irrelevant` 表示模型已拒绝或明确无关。旧数据保持 `available`，兼容既有恢复行为。
- `test_structured_site_search_preserves_arbitrary_query_anchors` 仍期望 fallback 顺序为 condition -> type -> focus -> evidence；生产代码与批准合同已经是 focus -> condition -> type -> evidence。该断言应在恢复红测转绿后更新，不应让生产逻辑退回类型中心。
- 恢复红测准确复现 `pending` URL 完全不进入 parser。状态修复后，恢复排除只读取非 `pending` SourcePage；实际本地 parse/inspection 成功后才持久化为 `available`。解析失败不再把 `None` 放进 `parsed_pages`，因此不会在同一 Run 内永久屏蔽，最多重试次数仍由现有页面预算控制。
- reranker 明确拒绝的候选现在持久化为 `irrelevant`，服务重启后仍进入排除集合；`available` 和旧数据保持原排除语义。实现复用既有字符串字段，没有 schema migration 或新产品状态面。
- Provider、public pages、browser workflow、planning、workflow/schema 与 XHS/browser protocol 共 427 项通过；空间优先词序、40 秒最坏本地读取预算、候选白名单与 XHS-only 隔离同时成立。
- 完整 API 549/549 通过；Ruff lint、55 文件 format check、strict Mypy 26 个源文件和 diff check 全绿。直接调用 `mypy.exe` 在当前 Unicode workspace 空输出退出 1，项目权威 `python -m mypy apps/api/src` 正常通过，不是类型错误。
- 源码服务重启后，真实普通 Responses + 本地 Playwright 内存验证生成 `space_first + project_context`。空间优先查询为 `informal learning and chance encounters floor plan architecture`，没有项目类型或新建/滨水条件；项目语境查询单独保留新建、河岸、学习与停留语境。
- ArchDaily 本地搜索返回 4 个候选，reranker 只保留本地 ID `candidate-2` 与 `candidate-3`，分别为图书馆广场与教育中心；联合办公和普通学院候选被拒绝。白名单有效、原生 web_search=0，说明空间优先允许跨类型但不是无差别放行。
- 修复后的真实 Run `60993e17-a7fc-4af9-9f80-1eda31d1ccca` 证明概念初期问题可稳定完成：模型拆为 `spatial_relations/daily_experience/site_connections` 三个开放维度；7 个 QueryAttempt 均为英文 Provider 计划，查询从空间优先切换到 evidence/project context 且无重复。
- 正式案例来自木匠之家与 Bentway，分别支持实践学习/社区共享/分时等候关系和步行骑行通道/社区串联/公共聚集关系。综合明确两者都是跨类型机制类比，不冒充同类型新建先例，并逐项写明乡村更新、线性基础设施尺度与缺少评后证据等边界。
- 该 Run 为 3/3、7 资产、2 项目。7 次 query planning、6 次 Provider reranking、9 次 page analysis、1 次 synthesis 成功；另一次 reranking 因本地零候选正确不调用。10 次本地搜索、8 次正文读取，25/25 EvidenceClaims URL 与逐字 excerpt 有效，fallback/native web_search 均为 0。

## 2026-08-03 概念初期 / 空间优先再审查

- 当前产品判断不变：默认输入是概念初期的开放任务，拆题只能展开研究维度，不能在读取案例前预设具体形式、构件、材料、结构或流线答案。
- 搜索排序应为：空间对象、活动与关系，使用体验和场地/环境议题，最后才是建筑类型与新建/改造/扩建语境。类型用于尺度和适用性校验，不是默认准入门槛。
- 已有实现并非从零开始：`space_first + project_context`、可选 `building_type`、`spatial_focus`、`spatial_relevance` 和严格 URL/逐字 EvidenceClaim 均已完成并通过此前完整回归。
- 本轮必须重点检查残余冲突是否仍存在于恢复查询、Provider 纠正提示、deterministic fallback、候选降级、正文 `direct_match` 语义和综合措辞中；不得用建筑类型专用词补丁提高个别题完成率。
- 恢复时唯一活动 Run 为 `f429ca55-5377-4dc5-a8fb-87b99d8bccd5`，状态 `inspecting`；在其终态前不得新建或 retry Run，也不得重启服务。
- 首个确认的生产冲突位于候选准入：Provider 成功路径允许 `spatial_relevance >= 2` **或** `typology_match >= 2`，因此同类型但没有命中当前空间议题的候选仍可占用正文页面预算。空间优先合同应要求空间相关性本身达标，类型匹配只参与排序、语境和适用性说明。
- 活动 Run 的 Trace 提供真实旁证：第 3 轮 8 个候选保留 4 个，全部计为 typology direct、空间类比计数为 0；后续首个正文页即被判 `relevance=1/direct_match=false`。这不是类型专用召回问题，而是全局候选门控仍残留类型替代空间相关性的语义。
- 第二处冲突在 Provider 拆题提示：它虽然要求开放研究维度，却仍强制每个子问题把用户建筑类型和项目条件原样写进 `question`。这会让同一类型在三条子问题及后续查询规划输入中重复增权；类型应保留在主问题/项目边界中供适用性判断，子问题正文应优先写空间对象、活动、关系、体验或环境议题。
- 第三处冲突在 deterministic fallback：`_is_broad_early_inspiration()` 只识别有限的“概念初期/灵感”等词，未命中时 `fallback_plan()` 回到固定 `program/circulation/section/structure/envelope` 分栏，`build_public_search_query()` 又启用类型词表。当前产品将概念初期视为默认，因此 fallback 也应默认开放；用户明确给出的空间或技术机制要保留，但不能据此自动补齐其他方案维度。
- 现有正文分析合同方向正确：建筑类型不同本身不能判 `direct_match=false`；只要正文逐字支持当前空间问题的一项可迁移机制且尺度可比，就可形成受限分析，并必须写明类型、条件和尺度差异。该层不应因本轮方向调整而放宽 URL、逐字引文或证据链要求。
- 测试层存在与新产品合同直接冲突的旧断言：`test_openai_precedent_planner_keeps_declared_scope_in_every_subquestion` 要求每个子问题重复类型/条件；reranker 测试与 mock 允许 `typology_match=4`、`spatial_relevance=0` 的候选进入。开发时需要先写替代红测，再只更新这些冲突断言；其余 URL 白名单、来源可信度、正文与 XHS 隔离测试保持不变。
- 候选准入不宜从“类型可替代空间”骤变成“类型完全无效”。合适的通用边界是：优先保留空间相关候选；在摘要不足但来源可信、类型精确且仍值得探查时，最多允许 1 个类型语境探查候选，不能像当前实现一样最多 4 个类型候选挤占页面预算。类型只用于补充召回和后续适用性校验，不计作空间直接命中。
- deterministic reranker 的输入 `public_relevance_context` 由整题和旧 fallback 查询生成，而不是由当前 `space_first` 计划的 `spatial_focus` 生成；其相关性评分还对工业/改造和若干旧机制词额外加权。因此 Provider 暂时失败时，空间优先路径可能再次被类型/条件权重覆盖。降级相关性应优先使用当前结构化查询的空间焦点与证据类型，项目语境只作次级排序。
- 推荐的代码边界是双输入而非一句话重复：`ResearchSubquestion.question` 表达空间研究焦点；主问题/brief 保存 target project context。查询规划和候选 reranker 已同时收到两者，正文分析目前只收到子问题，需评估增加独立、只用于转译和 limitations 的项目语境参数，避免为了边界说明而把类型重新塞回每个子问题。
- 活动 Run 在 09:58 本地时间推进到 Trace 117、round 6/query 16 of 18：3/3 子问题已有正文覆盖，fallback=0，但仍只有 1 个正式项目，正在追补 quick 的第二项目。Run 正常推进，未并发或重启。
- 第四处且优先级最高的冲突位于 `_public_page_analysis_question()`：它在本地正文读取后、模型分析前，按粗略 intent 自动追加具体机制模板。`flow` 自动加入公众/员工/后勤/消防与核心筒，`daylight` 自动加入天窗/高侧窗/庭院/挑空，`section` 自动加入夹层/屋盖/竖向交通，`program/interface` 也追加构造做法。这会让正文模型去证明用户没有提出的答案，必须改为原样保留空间研究焦点；用户显式提出的机制已在原问题中，无需程序补写。
- `test_public_page_analysis_question_stabilizes_program_intent_wording` 等旧测试直接固化了上述模板，属于需替换的冲突测试。正文逐字校验、两条核心事实和 limitations 测试不受影响。
- 五类新行为测试已先取得 5 个准确红灯；“用户显式技术词原样保留”本来就通过。最小实现后 6/6 全绿：fallback 默认开放拆题、Provider 提示前景化空间、正文问题不再注入模板、type-only 候选最多 1 个、降级筛选使用当前空间焦点与标准化候选摘要。
- type-only 候选仍只在 `typology_match >= 3`、`source_trust >= 3` 且空间候选未占满 4 个时补 1 个；空间候选按 `spatial_relevance` 优先排序。Trace 新增 `type_context_probe_count`，未更改总候选/页面预算。
- 首轮相关回归 20 个失败。多数是旧测试/mock 写死 fallback ID `program/circulation/section`，不代表生产退化；不能为通过它们把开放维度改回预设维度。
- 两个真实通用问题：当前 exploratory fallback 的每个子问题都重复完整 `scope`，确定性公开查询会把同一显式词复制到三题并产生重复；应只让第一条保留原题范围，其余题前景化使用体验、场地/环境等独立维度。其次，Provider 完全不可用时，宽泛问题的 deterministic page analysis 没有中性空间证据词，可能丢弃正文中真实的保留空间/功能植入/路径关系；需要中性的正文证据识别，而不是重新向问题注入模板答案。
- 对第二点重新校准：不能为了保留 `partial` 给 deterministic 正文分析追加宽泛关键词，否则会放宽事实准入。Provider 完全不可用且正文不能按用户问题证明机制时应诚实 `blocked`；保留页面/图片诊断即可。只修复第一点：第一条 fallback 子问题保留原题范围，后续题只表达独立开放维度。
- 查询去重修复后，宽泛 fallback、默认开放 fallback、type-only Provider 提示和恢复查询 distinct 四项目标测试全绿。
- 相关八文件在最新生产实现上剩余 18 个失败：15 个来自默认 fallback 的旧 `program/circulation/section` 内部 ID，两个夹具仍用旧模板问题文本识别首分支，一个部分结果夹具没有在用户问题中明确给出可由正文证明的机制；没有发现新的生产策略回归。
- 夹具已按当前开放维度 `spatial_options/use_experience/environment_system` 对齐；部分结果测试把可验证的空间关系显式写入问题，不依赖程序预设答案。18 个失败项定向复检全部通过，URL、逐字 EvidenceClaim、候选和完成门槛均未修改。
- 第三条建筑验收候选 Run `202d658e-25a3-4158-b26b-bf2c3c187308` 自然终止为 `partial/budget_exhausted`：2/3、5 个 usable assets、1 个正式项目，保留、不 retry、不计验收。11 次查询规划、18 次本地搜索、11 次候选筛选和最终综合均走 Provider 正式路径；没有 deterministic fallback 或原生 web_search。
- Run 的缺失分支 `shared_independent` 实际召回了上海跨代社区与已覆盖另外两题的小学项目页，但两次相关正文输出因 `OpenAI relevant page analysis did not satisfy the evidence contract` 被严格拒绝。相同上海页面随后用项目 Playwright 重读，真实 Responses 一次返回 5 条逐字事实并完整通过，说明候选和正文可用，失败属于结构化输出偶发不自洽。
- 通用修复保持两次调用上限和全部证据门槛不变：第一次相关输出不完整时，第二次请求接收最多 8 项/500 字符的精确缺项标签，如 `project_context_excerpt_not_verbatim`、`design_mechanism_missing_supported_fact`、`transfer_strategy_missing`；不传网页正文、URL 或其他数据到反馈字段。
- 精确反馈红测先准确失败后转绿；Provider 76/76、相关八文件 431 项、完整 API 553/553、Ruff、63 文件格式、strict Mypy 26 个源文件和 diff check 全绿。

## 2026-08-03 Concise project-context typology audit

- 服务恢复后普通 `space_first` Responses 探针成功；没有因为先前外部 TLS `UNEXPECTED_EOF` 增加调用次数。
- 候选 Run `9b7ed8dc-daef-41d1-b86d-0c0035725a1b` 自然终止为 `partial/no_new_assets`：2/3、3 个资产、1 个正式项目，Provider/deterministic fallback=0，保留、不 retry、不计验收；当前活动 Run=0。
- 正式空间优先查询能够召回游乐公园等跨类型项目，并为 `family_stay` 与 `activity_coexistence` 建立逐字证据；`daily_arrival` 连续六轮没有形成证据，说明空间优先准入本身不是这次失败的主因。
- 项目语境查询使用了 `children's care and family community venue`；前一个宽泛社区题使用过 `urban community shared learning and daily service facility`。两者都把多个活动和服务拼成自创类别，不是建筑网站常用索引词。
- 正确的通用边界不是继续扩充类型字典。`space_first` 应继续不携带目标类型；只有辅助 `project_context` 使用简短的 building-type anchor，而且该值必须是一个常见专业类别，不能复制整段 multi-program brief。
- Pydantic 应限制 building-type anchor 的结构和长度，Provider prompt 应要求选择常见可检索类别；具体中英文类别由模型根据用户语境生成。未知类型不得默认成 `adaptive reuse`、`public building` 或任意旧模板。
- 低产出站点调度暂不先改。先验证简洁类型能否恢复 project-context 召回；若仍失败，再依据新的真实 Trace 判断站点调度，而不是同时引入第二个变量。
- 红测确认旧 Pydantic 同时放过英文和中文 multi-program label，Provider 因此不会进入既有结构化纠正。问题位于通用输出合同，不是某个建筑类型映射。
- 最小修复只校验会进入本地站点查询的 context 类策略：英文 building type 最多 5 个有效词，中文最多 10 个汉字；`space_first` 可继续保存较完整的用户语境，但执行查询仍严格排除类型和条件。
- “常见专业类别”无法由纯长度校验可靠判断，因此由普通 Responses prompt 明确要求；Pydantic 只负责可验证的单一短类别边界。这样避免引入有限字典，同时确保不再复制长 brief。
- 目标 4/4 与 Provider 80/80 通过；既有任意建筑类型、显式工业改造、命名案例和恢复策略未被误伤。
- 真实内存探针将明确的多活动青年中心 brief 规划为 `daily arrival routes floor plan` 的 `space_first` 和使用 `urban youth center` 的 context 查询；类型是 3 个词，活动关系仍在 `spatial_focus`，普通 Responses 无 fallback。
- Run `3618a879-3ca3-4d45-9cdf-d8238e95d0d5` 的 5 个 QueryAttempt 都是短空间查询。第二轮 context 槽分别使用 `short stays near communal dining` 和 `new build visual connections between gathering spaces`，没有再出现自创复合类别。
- 该 Run 在 2/3、8 个资产、3 个项目时，Space Model Shenzhen Biennale 正文分析因 `APIConnectionError` 进入 deterministic fallback；监控在下一轮开始前取消。它不能计验收，但已经证明 concise context 修复通过真实 workflow。
- 不应为这次外部连接错误增加 Provider 调用次数。先用普通 Responses 健康探针确认上游；恢复后换一条全新题，不 retry 该 Run。
- 上游健康探针随后成功；共享茶室概念题 Run `24b9aade-b7b1-42da-9392-284cd9c1c535` 自然完成 3/3。模型拆题为社交强度、街道界面和时段适应性，均为开放空间研究维度。
- 最终案例跨越养老社区、零售/艺术中心和静修亭馆；综合明确它们是空间机制类比，不冒充社区茶室同类型先例，并逐项写明尺度、运营、声学、街道使用和活动证据边界。
- 7 条 QueryAttempt 全部是 6-11 个词左右的空间/证据查询，没有目标类型锁死或长复合类别。Divisare 第 4 轮返回 0，但 workflow 用已有同源项目的跨子问题正文证据补齐最后缺口，没有额外放宽门槛。
- 交付审计为 3/3、12 资产、3 正式项目、51 条 URL 绑定逐字 EvidenceClaim、7 次查询规划、6 次实际 reranking、8 次正文分析和 1 次综合；fallback/native web_search 均为 0。建筑正式验收达到 3/3。
- XHS 会话预检当前为 `unknown/local_search`。受限 OpenCLI auth status 没有返回明确未登录，而是在进程预算内超时；扩展 broker 为 `connected=false`，因此没有第二条可验证登录态通道。
- 现有产品行为正确 fail closed：图纸 Run 未创建，普通网页链路未执行。Board 已提供固定小红书登录入口和重新检测按钮；必须由用户在 Chrome 完成交互式登录。

## 2026-08-03 First XHS qualification audit

- 登录恢复后预检为 `logged_in/local_search`；第一条 XHS-only Run `96237a51-6425-4365-bec0-dd054b02fabe` 自然终止为 `partial/visual_budget_exhausted`，保留、不 retry、不计验收。
- Run 产生 23 个资产、8 个项目；全部结果 URL 为小红书且 `has_local_content=true`，普通网页搜索/读取事件为 0，Provider/deterministic fallback=0。
- XHS 专用终态门槛工作正确：`sectional-collage` 与 `diagrammatic-axon` 各从 3 篇 usable 笔记形成结果；`contour-layering` 的 4 个排序帖子只有 2 篇 usable，因此即使通用 coverage report 为 3/3，最终仍诚实返回 partial。
- 失败不是视觉字节上限：40 次视觉调用共 9,711,135 bytes，没有 byte-limit 标记。固定每方向最多 4 帖、累计 3 篇 usable、每帖最多 4 图、48 图像槽位 / 48 MiB 不应放宽。
- 模型/确定性方向为 `精细线稿分析图`、`拼贴叙事分析图`、`材质渲染分析图`。实际 `_try_xiaohongshu_search()` 只接收 `subquestion_text[subquestion_id]`，没有携带原问题中的山地场地、到达或内外关系等图纸主题。
- QueryAttempt 中出现完整原题只是审计文本，不是 OpenCLI 实际查询。通用修复应组合原题中简洁的图纸/场地/空间上下文与当前视觉方向，同时剔除 rationale、Provider 指令、公共网页 evidence 词和登录态说明；不能添加山地游客中心等题型专用词表。
- 两个跨主题行为测试在旧实现上准确失败：真实 search 参数只有视觉方向，缺失山地/医疗空间主题。最小实现不做中文分词或题型词典，只归一化标点、删除请求话术与执行控制词，并在 96 字符总长内把原题主题放在视觉方向前。
- QueryAttempt 在 XHS-only 路径同步记录 compact query，因此数据库审计值与传入 OpenCLI/扩展搜索器的参数相同；Trace 仍单独记录实际 backend 和是否发生通道 fallback。
- XHS/browser 相关四文件 232 项通过，证明固定 4 帖/3 usable/48 图/48 MiB、XHS-only、登录预检和 fail-closed 合同未变化。
- 修改后首个盲测 Run `e1a8fc51-d2a4-4ddf-bf87-fbd01d82f94d` 的实际查询已正确携带校园共享学习主题与模型视觉方向，但仍保留“概念图纸、表达、不同的剖面图表达”等请求/媒介话术；第一方向 4 个排序帖子仅 1 篇 usable，已在结论确定后取消并保留，不 retry、不计验收。
- 用同一登录态做一次只读搜索 A/B：将查询缩为主题名词、空间关系和视觉方向后，前四条候选从泛校园/论文内容转向学生活动中心、校园节点和学校空间。说明应进一步压缩通用话术，而不是移除主题上下文或提高 XHS 固定预算。
- 下一步合同收紧为总长最多 64 字符；从原题上下文删除概念图纸、表现/表达、参考/比较、不同、配色、线型、版式、风格及已由视觉方向携带的图纸类型。空间、活动、场地与关系词原样保留，不做题型词表。

## 2026-08-03 XHS drawing-intent boundary correction

- 最新产品判断推翻了上述 compact-query 方向：XHS 图纸研究的检索对象不是项目案例，而是图纸视觉方向。搜索词只应包含表现方式和图纸类型，例如精细线稿剖面图、拼贴叙事爆炸图。
- 建筑类型、项目主题、场地条件和空间关系即使出现在原始用户问题中，也不得进入 XHS 实际查询；这些维度属于建筑案例研究链路，不属于纯图纸视觉参考链路。
- 因此继续压缩“原题主题 + 视觉方向”无法解决问题，正确修复是删除主题拼接。生产 workflow 现在把当前视觉子问题文本原样归一化后同时传给 OpenCLI/扩展搜索器和 `QueryAttempt.query`。
- 通用行为测试覆盖两个不同项目语境，旧主题拼接实现 2/2 失败；删除 helper 后 2/2 转绿。山地题查询严格为“精细线稿分析图”，医疗题严格为“精细线稿剖面图”，建筑与空间主题均未出现。
- 后续 XHS 验收题必须是纯视觉请求，不能再用山地游客中心、校园共享学习或医疗空间等项目 brief。固定每方向 4 帖、累计 3 篇 usable、每帖 4 图、48 图像槽位 / 48 MiB 和 XHS-only fail-closed 合同不变。
- 纯视觉方向修复的相关回归为 232/232，完整 API 为 559/559；Ruff、55 文件 format check、strict Mypy 26 个源文件和 diff check 全绿。删除 compact helper 没有破坏 XHS 登录预检、固定预算、普通网页隔离或运行完成合同。
- 第一条真实纯视觉 Run 的 Provider 拆题和执行查询完全一致：`fine-linework=精细线稿剖面图`、`collage-narrative=拼贴叙事剖面图`、`atmospheric-rendering=材质渲染剖面图`。三条均由 `local_browser` 完成，没有附加任何项目语境。
- 三方向分别在第 3 篇笔记达到 3 篇 usable，workflow 没有继续消耗各方向第 4 帖。最终 24 个资产全部为 section、XHS URL 且有本地内容，来源笔记 9 篇；图像槽位 30/48、约 4.33 MiB，普通网页与 fallback 事件均为 0。
- 爆炸图真实 Run 的三条查询同样保持纯视觉边界，但三个风格都低于每方向 3 篇 usable，说明问题跨风格存在。多条 `xiaohongshu_assets` 事件是图片已下载后 `candidate_count=0`，另有部分 `accepted_type_count=0/type_mismatch>0`。
- 该失败不是视觉字节上限：42 次调用仅约 7.05 MiB；也不是普通网页或 Provider fallback。下一步应检查爆炸图在本地视觉分类中的通用语义边界，以及搜索返回的真实内容，不应降低 3 篇 usable 或扩大 4 帖上限。
- 同登录态只读 A/B 证明图纸学科限定有效：`极简图解建筑爆炸图` 返回建筑爆炸图教程/线稿，`材质渲染建筑爆炸图` 返回城市设计/渲染爆炸图，避免原查询中的产品外壳、振膜等拆解图。该限定不是建筑类型或项目主题。
- 视觉 schema 没有独立 exploded 类型，workflow 将爆炸图映射为 `axonometric`；旧 OpenAI 提示未说明拼贴/渲染爆炸图仍属 axonometric，Mock 也不识别爆炸/分解关键词。三处最小修复后目标 5/5 转绿。
- 爆炸图修复后的相关全集 320/320、完整 API 561/561 和全部静态门禁通过；没有修改固定 XHS 预算、登录 fail-closed、普通网页隔离或可见 observations/relevance 准入。
- 真实模型探针没有被提示诱导：标题含“爆炸式拼贴”但图中无明确构件分解关系时，模型仍输出 `analysis_diagram` 并说明缺失爆炸关系。这证明证据门槛仍有效。
- 第二轮类型前置 A/B 的结果比风格前置稳定：极简、拼贴和材质渲染查询均出现明确建筑爆炸图；实现改为 `建筑爆炸图 + 风格`。相关/完整/静态门禁第二次全绿。
- 标题明确的真实轴测爆炸图探针验证了分类合同：3 张图片全部为 axonometric/relevance=4，观察中逐张识别楼层、框架、屋面、楼板和场地的分解关系。与前一普通拼贴的正确拒绝共同证明分类不是按标题或提示盲目放行。
- 第二条爆炸图 Run `a33b0185-fc5d-48ed-a93f-8c3cb7df042f` 的实际 QueryAttempt 为 `建筑爆炸图 黑白线稿`、`建筑爆炸图 红灰配色`、`建筑爆炸图 材质渲染`，不存在住宅、学校、场馆等建筑类型，也没有项目、场地或空间语义。
- 该 Run 的黑白线稿与材质渲染各用 3 篇笔记达到 3 篇 usable；红灰配色前两篇 usable，后两篇共 8 张图片全部 type mismatch，因此专用 XHS 门槛正确返回 `partial/visual_budget_exhausted`。通用 coverage 3/3 不能替代每方向 3 篇 usable。
- 用户原题明确写了“红灰配色图解”，模型拆题却生成“红灰配色建筑爆炸图”，执行查询因而丢失“图解”限定。通用修复应要求明确列出的视觉风格逐项原样保留，不应增加红灰专用词表、帖子预算或放宽视觉类型门槛。
- 最新产品边界进一步明确：图纸搜索的语义维度只有视觉风格与图纸类型。`建筑爆炸图`只用于将爆炸图限定为建筑制图、排除产品拆解噪声，不代表某种建筑类型；不得向用户追问或推断项目类型。
- 视觉规划语义校验采用可证明且通用的窄边界：仅当用户在冒号后明确枚举出与深度目标数量一致的视觉短语时，逐字检查每个短语是否进入唯一子问题。没有明确枚举时依靠强化后的模型合同，不用脆弱中文分词猜测用户风格。
- 纠正仍走同一普通 Responses + `ResearchPlan` Pydantic 结构化输出；只在首次计划违反显式短语合同后调用一次。查询执行继续由 `visual_reference_search_query()` 保留完整风格短语并规范图纸类型位置。
- 真实 Provider 返回 `爆炸图：黑白线稿`、`爆炸图：红灰配色图解`、`爆炸图：材质渲染`，证明显式风格保真合同生效。执行 helper 删除“爆炸图”后没有同步删除相邻冒号，产生 `建筑爆炸图 ：风格`；这是与具体风格无关的查询规范化缺口。
- 查询归一化只删除图纸类型移除后残留在风格两端的空白、冒号和连接横线；不会删除或改写任何视觉短语。真实三条计划因此规范为 `建筑爆炸图 黑白线稿`、`建筑爆炸图 红灰配色图解`、`建筑爆炸图 材质渲染`。
- 未见剖面图 Run 的规划和查询合同全部生效，但“纸张纹理拼贴”方向在 4 帖内只有 2 篇 usable。类型前置查询返回两篇直接剖面内容，风格前置查询也没有更好；这是人为验收题过窄造成的稀疏召回，不应驱动生产代码增加该风格专用词或放宽门槛。
- 稳定性验收题也必须符合产品真实使用场景：用户在概念初期更可能只指定图纸类型并请求视觉方向，而不是预先规定针管笔密度、纸张纹理等细节。下一条应使用宽泛纯视觉请求，仍由 Provider 生成风格方向并由本地 XHS 搜索验证。
- 宽泛轴测图问题证明真实使用方式可稳定完成：Provider 生成三种常见可见风格，本地查询只含风格和轴测图，三方向均达到 3 篇 usable。第一方向用了 4 帖，另外两方向各 3 帖，固定上限有效且无需新增预算。
- 该 Run 的 27 个资产全部来自 9 篇 XHS 笔记并有本地文件；没有普通网页搜索、候选 reranking、公共正文分析或研究综合事件。这里的 `openai` 事件只表示每方向已选择 XHS 笔记后跳过普通模型搜索，fallback 均为 0。
- 宽泛平面图问题未通过并不说明建筑类型污染：三条查询仍仅含风格和平面图。失败来自水彩/高对比拼贴搜索结果偏向插画或非平面图，40 次视觉检查正确拒绝类型不符图片；不能为达到验收数字误升 asset type。
- 这类来源稀疏属于 XHS 严格 3 usable 合同允许的诚实 partial。既然用户要求的是视觉方向而非保证每个任意混合媒介都有三篇，生产代码不应根据该单题加入水彩或拼贴词表。

## 2026-08-03 XHS visual candidate pool and input boundary

- 宽泛立面图 Run `4bb39b3c-5bc0-46c3-95f7-ab53c9f62937` 的技术线稿、氛围拼贴、水墨晕染分别达到 2/3/3 篇 usable。常见线稿仍可能因为 OpenCLI 前四条中后两条为空内容或错图纸类型而失败，说明继续增加单风格同义词不是通用修复。
- XHS adapter 现在只为视觉研究扩大“元数据候选池”，最多取 8 条；workflow 按目标图纸类型标题命中和当前风格文本的 CJK bigram 相关性排序后，仍最多打开/下载 4 帖。这样增加的是选择质量，不是页面、图片、Provider 或字节预算。
- 非视觉 XHS 搜索仍为 4 条；每帖最多 4 图、每方向累计 3 篇 usable、全 Run 48 图像槽位/48 MiB 均不变。Trace `xiaohongshu_candidate_pool` 可审计池大小、保留数和类型命中数。
- 用户最终输入边界不是“建筑类型 + 图纸”，而是“视觉分割/构图/表现方向 + 图纸类型”。剖面图、爆炸图、轴测图描述的是制图类别；建筑类型、项目主题、场地和空间关系都不应成为图纸研究的输入要求或搜索条件。
- 现有 Provider 提示已经禁止推断建筑类型，但需要覆盖 UI、fallback 和执行入口的行为测试，避免某个兼容路径重新提出建筑类型问题。只有这个全入口合同转绿后，才可重启并创建第三条 XHS 验收 Run。
- 全入口审查确认后端无需再加建筑类型词表或语义猜测器：Provider 提示明确禁止建筑类型，deterministic visual plan 只按请求图纸类型生成风格，XHS-only QueryAttempt 与实际搜索参数相同，且公共网页/模型搜索在执行前关闭。
- 真正的用户可见冲突是共享 Composer 标题没有按 goal 分流。视觉模式仍出现“空间、流线”，会让用户误以为必须描述建筑问题；红测准确复现后，只将视觉模式标题和说明改为图纸类型与分割/构图等视觉方向。
- 候选池和 UI 修改后的完整 API 567、Board 181、Python/TypeScript 静态门禁与 production build 全部通过。下一次真实 Run 应验证服务重启后 Trace 出现 `xiaohongshu_candidate_pool`，且普通网页事件仍为 0。
- 效果图候选 Run 的 Provider 规划完全符合最新输入合同，但“电影感纵深构图效果图”在 OpenCLI 8 条结果中大多变成摄影、影视分镜和 AI 生图内容；这证明纯视觉语义正确不等于来源域消歧充分。
- 8→4 Trace 正常出现，首方向 `source_pool_count=8/retained=4/drawing_type_match=1`。四帖分别为 4 张 render 可用、3 张类型不匹配、1 张 render 可用和 0 候选，最终 2 篇 usable；候选池机制生效但排序信息不足。
- 仅把效果图前置没有改善；使用“建筑效果图”学科限定后，候选出现建筑渲染和空间设计内容。这里的“建筑”表示制图领域，不是社区中心、学校、住宅等建筑类型，与用户输入边界不冲突。
- 通用排序不能只看类型字符串，因为“产品效果图”“影视效果图”同样命中。应结合建筑/图纸/空间设计/渲染等制图语境，并对摄影、电影、影视、产品等明显跨行业标题降权；风格 bigram 和原始 rank 继续作为次级信号。
- 首轮排序实现把建筑语境放在类型命中之前，旧立面测试正确发现“技术制图课程”会挤掉明确立面图。最终改为综合分：明确图纸类型仍是主信号；建筑制图语境加分；没有建筑语境时摄影/影视/产品强降权；风格重合封顶为次级信号。
- “空间设计电影感渲染”同时命中建筑语境和“电影”噪声词。第二次红测失败促使规则只在缺少建筑语境时施加跨行业惩罚，避免把合法的建筑电影感表现误杀。
- 相关 328、完整 API 569 和静态门禁全绿，证明消歧逻辑没有破坏立面类型优先、剖面/轴测查询、爆炸图分类或 XHS-only 隔离。
- 修改后的宽泛效果图 Run `c521e3bd-6067-4453-b574-7c62684624e8` 真实完成，证明通用学科消歧与 8→4 综合候选排序可以处理效果图的摄影、影视和产品噪声，不需要具体建筑类型词表。
- 三条实际查询严格为“建筑效果图 电影感写实”“建筑效果图 拼贴图形化”“建筑效果图 氛围水彩”；25 个结果全部分类为 `render`，来自 9 篇 XHS 笔记且本地文件存在。普通网页事件与 fallback 均为 0。
- 图纸搜索合同最终收敛为：用户只提供图纸类型和视觉分割/构图/表现方向；仅在图纸类型跨行业歧义时添加建筑制图学科限定，不询问或推断住宅、学校、场馆等建筑类型。
- Board 的六条正式 Run 真实展示完整：建筑页面每个子问题都有结论、案例正文、转译步骤和来源；视觉页面每个方向都有 3 篇 XHS 笔记及本地图像。项目 Playwright 共验证 86/86 张界面图片实际加载。
- Board 会为未手动创建的表达规范请求 `/style-profile` 并收到预期 404，然后使用默认空规范；QA 只豁免这一明确可选资源，其他本地 4xx/5xx、页面错误、缺图和空章节仍会失败。
- 整页截图人工检查未发现文字、图片、工具区相互遮挡；长页面截图中的固定页头重复是 Playwright full-page 拼接表现，不是实际页面重叠。
- 架构没有从 plan-and-execute 迁移到多 Agent 或工具调用模型。变化发生在 Plan/Execute 内部合同：Plan 增加空间优先结构化查询与纯视觉方向，Execute 增加本地候选集、候选 ID 白名单筛选、排除集合和按缺口补查；唯一 orchestrator 与七阶段状态机保持不变。
- README 原流程图只写“生成有界查询 → Direct Playwright”，不足以解释当前模型辅助本地搜索。新版首页把建筑与 XHS 两条执行支路分开，并明确默认不调用 Provider 原生 `web_search`；Release 测试持续约束这些公开说明。
- `v2.2.4` 自包含安装版能在源码服务占用默认端口时正确选择动态端口 `8771`，并从安装版路径返回版本正确的 desktop health、API health 和生产 Board。说明安装器包含的新 API/Board 不是只通过静态自检。
- 安装 smoke 仅复制不含 Key 的 Provider 配置，Key 仍从 Windows Credential Manager 读取；安装包内没有 Chrome manifest，证明扩展保持独立交付。smoke 前本机无安装版数据，结束后程序、快捷方式和本次数据目录均无残留。

## 2026-08-03 v2.2.4 release closeout

- ArchResearch 继续采用 Evidence-Grounded Plan-and-Execute；空间优先和 XHS-only 纯视觉策略属于 Plan/Execute 内部合同变化，不是多 Agent 架构迁移。
- PR #15 的 Hosted CI 完整通过并 squash 合并为 `d80f715d88781810eda7624d9f1d65b3754228fb`；正式 `v2.2.4` tag 与 Release 均指向该提交。
- GitHub 远端 README 已实际显示普通 Responses 规划、本地 Playwright 候选搜索/读取、候选 ID 白名单、空间优先、默认禁用原生 `web_search` 和图纸类型/视觉方向边界。
- GitHub 附件 size/digest 与本地安装 smoke 候选一致；安装器与扩展仍为两个独立发布附件。
- 本地 `.artifacts/build/`、`.artifacts/qa/`、`.artifacts/releases/` 合计约 1.1 GB，包含可再生构建、验证截图和已发布产物。为同时满足数据保留和干净工作区，采用精确 `.gitignore` 规则，不删除目录，也不扩大到已跟踪的 `.artifacts/portfolio/`。

## 2026-08-03 new-conversation handoff audit

- 当前没有活动开发阶段、待发布产品修改或 GitHub 操作；新对话的目标应由用户下一项需求确定，不能把已完成的 `v2.2.4` 重新列为待办。
- `.archresearch/archresearch.db` 只读统计为 96 条历史 Run：27 `completed`、38 `partial`、13 `blocked`、18 `cancelled`；非终态 Run 为 0。交接审计没有创建、重试、取消或写入任何 Run。
- 交接前 Git 工作树干净。按用户要求，交接后仅四个管理文件保留未提交修改；本地产物、真实研究数据和 `.archresearch/` 不变。
- PR #16（`fc69f44`）只更新 `.gitignore` 与四个既有管理文件，不包含产品行为修改，也不改变 `v2.2.4` tag。产品修改由 PR #15 合并；`task_plan.md`、`findings.md`、`progress.md` 自 2026-07-11 已跟踪，`HANDOFF.md` 自 2026-07-26 已跟踪。
- 本次没有产品代码变化，因此没有重跑完整门禁。新对话应继续信任已记录的 API 569/569、Board 181/181、Extension 182/182、packaged E2E 8/8、6/6 真实验收、Board QA 和安装 smoke 基线，直到下一项产品修改使其需要重新验证。

## 2026-08-03 Xiaohongshu login detection UX report

- 用户截图显示图纸灵感研究环境停在红色提示：“无法确认小红书登录状态。请打开小红书登录后重新检测。”当前界面没有直接登录动作、等待状态或自动复检，用户即使已登录也只能重复触发同一检测。
- 目标体验是两条路径共用同一真实登录态：首次无法确认时从产品打开系统 Chrome 的小红书登录入口并有限轮询；Chrome 已有有效登录态时首次检测直接通过。
- 登录恢复只能通过枚举本地协议和状态结果完成。Cookie、账号、密码与浏览器存储不得进入 FastAPI、Board、日志、SQLite 或导出；检测失败继续 fail closed。
- `impeccable` 的产品界面准则要求错误态给出具体下一步，并覆盖 loading/error/retry；本轮不做视觉重设计，只把当前死胡同变成可完成的内联流程。
- 第一轮代码审计确认截图为何没有登录入口：`showXiaohongshuLoginAction` 只在状态精确为 `not_logged_in` 时为真，`unknown` 会隐藏“打开小红书登录”，只剩无法行动的错误提示。
- `useBrowserReadiness` 自身首次只读取浏览器环境，但 `App.tsx` 在用户进入图纸灵感、检测通道可用且状态仍为 `unchecked` 时会主动调用 `/browser/xiaohongshu-session`。因此首次检测已经存在；缺口是 `unknown` 后没有自动打开登录页、自动复检或通道恢复。
- FastAPI `/browser/xiaohongshu-session` 只要发现 `xiaohongshu_search`（通常为 OpenCLI）就直接返回该通道结果；它返回 `unknown` 或抛错时不会尝试已连接的 Chrome 扩展，因此既有 Chrome 登录态可能被一个不稳定的优先通道遮蔽。
- 扩展检测本身不读取 Cookie：它在受控小红书搜索页上只根据登录页路径、密码输入框/登录提示文本或可见搜索结果 DOM 返回三态，符合凭据边界；后续需要核对当前页面 DOM 与等待时长。
- 当前源码服务只读实测：`/v1/browser/status` 返回 `connected=false / xiaohongshu_search_available=true`；`/v1/browser/xiaohongshu-session` 约 13 秒后返回 `unknown / local_search`。这与截图完全一致，并证明普通 Chrome 的既有登录态当前没有进入 OpenCLI 优先通道，扩展也没有连接可供回退。
- OpenCLI `auth status` 的实现使用 `siteSession: ephemeral`、`keepTab: false` 和后台窗口；ArchResearch 没有传入用户的持久 profile。它是独立快速探针，不等同于当前普通 Chrome 会话，因此不能作为识别“之前已登录过”的唯一权威通道。
- 当前 Chrome 启动器只允许固定本地 Board `?connect=chrome` URL，并为每次启动追加随机 attempt。新增小红书登录打开能力应继续使用固定常量白名单，不能把任意 URL 暴露为 API 参数。
- 通道合并的安全规则应是：任一可用通道明确 `logged_in` 即通过；明确 `not_logged_in` 只有在没有其他通道确认登录时成立；全部未知/失败时返回 `unknown`，没有通道才返回 `unavailable`。这样不会因 fallback 放宽 fail-closed。
- `App.tsx` 已在进入图纸灵感时自动触发首次 session check；测试应围绕状态序列而不是再增加第二套初检。当前 fetch mock 只支持固定 session status，需要最小扩展为可按调用推进的状态数组。
- 现有 `open_board_in_chrome()` 只接受本地 Board URL并追加 pairing attempt，且被桌面启动器复用。应保留该合同，新增独立 `open_xiaohongshu_in_chrome()`，只接受代码内固定小红书 URL，避免放宽桌面启动器的 URL 白名单。
- Board 现有 `.research-preflight-login` 已是标准次按钮样式和移动端 44px 命中区；可把静态 `<a>` 改为 button 并复用该类，只补 loading/waiting 文案，不需要新视觉容器。
- API 两条行为红测在旧实现上准确失败：本地探针 `unknown` 时端点仍返回 `unknown/local_search` 且没有发出任何扩展命令；固定小红书登录端点当前为 404。测试夹具正常完成数据库初始化，没有非预期失败。
- Board 红测中，“既有登录态首次检测不打开登录页”在旧实现上已通过；“unknown 时自动打开并复检”准确失败，页面未进入“研究环境已就绪”。这证明新实现可以只增加异常恢复，不改动正常已登录路径。
- 后端最小实现采用 Chrome 已连接时优先、OpenCLI 次级的顺序；Chrome 明确 `logged_in` 会立即返回，其他情况下仍保留 OpenCLI 的独立可用性。固定登录端点没有请求体或 URL 参数，只能打开代码内的小红书 URL。
- 后端目标测试 3/3 通过，同时覆盖原 Board Chrome 启动 URL，证明没有放宽桌面本地 URL 合同。
- Board 最小实现将静态登录链接替换为状态按钮，并增加 `opening / waiting / timed_out` 内联反馈；自动恢复每次页面会话最多触发一次，内部轮询最多 8 次、间隔 1.5 秒，登录确认后立即停止。
- 恢复开始时若 Chrome 扩展尚未连接，先复用现有枚举 pairing 流程，再打开固定小红书页，使“普通 Chrome 已登录”可以通过新后端的扩展优先检测被识别；扩展不可用时仍保留 OpenCLI 探针并最终 fail closed。
- Board 两条目标测试已转绿：unknown 自动打开/复检完成，已有登录首次直接就绪且登录端点调用为 0。
- 首轮 Board 相关回归 115 通过、4 失败。两个失败只是旧测试仍要求 `<a href>`；另两个显示登录恢复与既有 `?connect=chrome` / 手动 pairing 会争用同一 readiness request id。生产修复应等待 `browserConnecting=false` 再启动恢复，测试则分别隔离“登录已确认但扩展未连”的手动 pairing 场景。
- 当前 async 轮询的 `setTimeout` 在组件卸载后仍需等一次才返回，失败测试因此拖长。应保存 timer 与 resolver，在 cleanup 时清除并唤醒 promise，使页面退出立即停止恢复。
- 第二轮回归证明 `browserConnected` 只表示后台 broker 存在，不代表当前 Board 页面已取得研究授权；把它作为页面 check availability 会让权限拒绝与 bridge 隔离场景错误显示“研究环境已就绪”。前端恢复原有 `xiaohongshuSearchAvailable || browserReadinessState === 'ready'` 边界，后端仍可在端点内部优先使用已连接 Chrome，因此不会牺牲既有登录态识别。
- “未登录时禁止创建 Run”与“首次自动打开登录页”是两个独立行为合同。前者不应抢跑断言异步恢复动作；打开一次、自动复检和既有登录不重复打开由新增的专用测试覆盖。
- `browserConnecting` 是 React state，自动配对 effect 调用连接函数后、state 提交前仍存在一个同批次窗口；登录恢复会在该窗口再次调用连接函数，递增 readiness request id 并取消原配对。连接操作需要 single-flight Promise，而不是仅靠渲染态 guard；这样第二个调用会等待同一结果，也不会重复配对。
- 上述竞态推断经 single-flight 实验被否定：测试仍以同样方式失败。真实路径是自动配对已经成功并写入“图纸提取扩展已连接”，随后进入图纸模式触发 XHS session 成功，新登录恢复代码又清空了 `browserPairingStatus`。XHS 登录成功不应删除独立的 Chrome 连接结果，因此撤回 single-flight，只移除跨职责清空。
- 定向行为回归已通过：Board 119/119、API XHS/浏览器协议 48/48。Ruff lint 无代码问题，只有 `browser.py` 需要项目标准机械格式化。
- 最终完整门禁通过：API 571/571、Board 183/183、Extension 182/182；Board lint/typecheck/production build、Ruff check/format、strict Mypy 26 源文件和 diff check 全绿。已发布 `v2.2.4` 基线保持独立，本轮修复尚未发布。
- 源码服务在活动 Run=0 时通过项目脚本重载；API health=ok、Board=200、新固定登录端点已注册。重载后 SQLite `mode=ro` 仍为 96 条历史 Run、活动 Run=0，证明验证与重载没有创建研究。
- 本轮没有真实触发 Chrome 登录页，避免在用户桌面制造意外导航；真实账号验收应由用户刷新本地 Board 后进入图纸灵感完成。代码与 mock 已覆盖“既有登录不重复打开”和“unknown 打开后自动识别”两条路径。
- Phase 18 真实验收边界：使用用户系统 Chrome 的可见页面状态，不使用 ambient in-app browser，不读取 Cookie、local storage、浏览器 profile、密码或账号字段；若登录页要求凭据，必须让用户本人完成。
- 系统 Chrome 控制连接成功；验收基线只有一个可见标签 `ArchResearch Board`，URL 为 `http://127.0.0.1:5173/`，没有已打开的小红书标签。已接管并刷新该用户标签，标题和 URL 正常。
- 在真实系统 Chrome 点击唯一“图纸灵感”入口后，Board 立即显示“研究环境已就绪”和“小红书负责查找灵感 · Chrome 可读取当前页面高清图”；没有出现 opening、waiting、timed_out、错误提示或登录按钮。这是已有 Chrome 登录态首次直接识别的可见通过信号。
- 就绪后再次读取系统 Chrome 可见标签，仍只有原 Board 标签，没有新增或重复打开小红书。FastAPI 只读实测同时返回 `connected=true`、`xiaohongshu_search_available=true`、`session_status=logged_in`、`session_channel=chrome_extension`，确认此次命中的是用户当前 Chrome 会话，不是 OpenCLI ephemeral 探针。
- 当前真实账号已登录，若要现场制造“未登录→自动打开→登录后复检”路径必须登出或破坏现有会话；这超出无破坏验收边界。该路径保持由已通过的 Board 状态序列行为测试覆盖，不应为补一条现场路径而改动用户账号状态。
- Board 标签的页面错误日志为 0；验收后 SQLite `mode=ro` 仍为 96 条历史 Run、活动 Run=0，且 `git diff --check` 通过。真实点击只切换模式，没有触发研究提交或改变研究数据。
- 用户退出后的系统 Chrome 基线有 3 个可见标签：Board、一个用户已打开的固定 XHS explore 页、一个 Google 搜索页。产品恢复测试开始前已记录 XHS explore 基线数量为 1，避免把用户已有标签误算为自动打开结果；Board 已刷新以重置单次自动恢复状态。
- 未登录真实续测暴露通道权威问题：用户已退出系统 Chrome，Board 刷新后进入图纸灵感仍显示“研究环境已就绪”；直接 API 返回 `logged_in/local_search`。说明扩展明确未登录没有成为权威结果，被 OpenCLI 独立登录覆盖。
- 对系统 Chrome 登录 UX，正确合并规则应是：扩展明确 `logged_in` 或 `not_logged_in` 时立即采用；扩展仅为 `unknown` 时才询问/采用 local search。没有连接扩展时 local search 仍可独立使用，保持现有本地搜索能力。
- 扩展不是版本根因：同一真实扩展在用户登录时已返回 `logged_in/chrome_extension`，证明支持当前协议；本轮也没有修改 extension 代码。新 API 红测在旧实现上准确得到现场同样的错误结果 `logged_in/local_search`。
- 后端最小修改后两条 Chrome 权威目标测试转绿，完整 API 增至 572/572 全绿；Ruff lint 无问题，仅需对 `browser.py` 做一次机械格式化。
- Ruff format/check 与 strict Mypy 26 源文件全绿；活动 Run=0 时重启源码服务。重启后真实 API 已返回 `not_logged_in/chrome_extension`，证明当前扩展正确报告退出状态且后端不再被 local search 覆盖。
- 修复后的未登录现场流程已真实进入“等待小红书登录”，提示“请在新打开的 Chrome 完成登录，本页会自动检测”；固定 XHS explore 标签由用户基线 1 个增至 2 个，证明首次检测已调用固定登录入口。没有点击“查找灵感”。
- 自动打开后还出现了一个可见 XHS 搜索结果标签；产品端点自身仍只接受固定 explore URL，不把任意 URL 作为输入。后续只需用户本人完成登录，再观察 Board 有限轮询是否自动转为就绪；不得代填凭据或检查浏览器存储。
- 用户本人完成登录时旧 8 次轮询已经进入 timed_out；手动“重新检测”后 Board 正确转为“研究环境已就绪”，API 为 `logged_in/local_search`。这说明登录可以被确认，但旧窗口不足以覆盖实际扫码/登录耗时。
- 最终晚登录行为测试使用 9 个 `unknown` 后再返回 `logged_in`：旧 8 次常量准确失败，20 次常量转绿。修改只延长既有轮询，不增加接口、状态或凭据访问，也仍只打开一次固定登录页。
- 完整 Board 回归更新为 184/184，lint、typecheck 和 production build 全绿。用户已登录后的真实冷启动直接就绪，XHS explore 标签维持 2 个不再增加，Board error 日志为 0。

## 2026-08-03 v2.2.5 README and release

- 用户认为当前 GitHub 仓库首页过多描述开发测试、技术取舍和“使用/未使用什么”，不能快速说明产品本身。新版 README 的主线应是产品功能、用户操作和系统运作流程，开发验证细节移出首页。
- 本次发布明确为 `v2.2.5`；Chrome 扩展代码未改，登录修复发生在本地 API/Board，但 Release 仍须保持安装器与扩展两个独立附件的既有合同。
- 当前 README 的问题集中在后半部：`Agent 架构`、组件清单、模型协议协商、研究行为、验证命令、完成度与边界、设计与计划占据大量篇幅；其中测试数字、内部文件路径、退役技术和“默认不用什么”适合开发文档，不适合仓库首页。
- README 已有可保留的用户内容：一句话定位、下载安装、首次 Provider 配置、Chrome 扩展单独安装、三类核心任务、三张产品截图、本地数据与凭据边界。新版应把这些内容前置，再用一张简洁流程图解释“提出问题 → 拆题 → 搜索/阅读 → 证据核对 → 研究板”。
- Git 工作区当前 12 个已跟踪修改全部属于 Phase 17–19：登录恢复 API/Board/测试与四个管理文件；没有未跟踪文件，也没有 README 既有用户修改。当前分支 `agent/local-release-v2.2.2` 跟踪同名远端，可继续使用但发布前需先与 `main` 核对差异。
- GitHub CLI 2.96.0 已安装并以 `jileyu2000` 登录，远端为 `jileyu2000/archresearch`，默认分支 `main`；具备提交、推送和 PR 前置条件。
- 版本号分布集中且可控：API `pyproject/__init__/main`、Board/Extension package、extension manifest、Release/installer 合同测试、README 与两份用户文档。`v2.2.5` 应一致更新这些位置；Chrome 扩展虽无行为修改，独立 Release ZIP 的 manifest/package 仍应与发布版本一致。
- 当前分支相对 `origin/main` 显示 `behind 1 / ahead 12`，但三点 diff 只有 `.gitignore` 和四个管理文件，说明远端 main 很可能通过 squash/merge吸收了同一批历史后形成不同提交图。提交前必须先核对 PR/提交关系，避免用旧发布分支制造冗余历史。
- `docs/development.md` 已承接源码环境、Provider 协议、测试命令和维护脚本，README 可以直接链接它，不必重复组件版本、内部 orchestrator 路径、测试矩阵或技术选型辩护。
- PR #16 已把旧发布分支的 12 个提交 squash 为 `fc69f44` 合入 main；当前分支仍停在原始历史，因此不能直接再次用同一旧分支开 PR。安全策略是在所有本地验证完成后，从 `origin/main` 创建新的 `codex/v2.2.5` worktree，只复制本次产品/README/版本 diff，再提交和推送；原工作区的用户交接修改不 reset、不 checkout、不清理。
- README 新骨架确定为：首屏一句话定位与下载 → 三类核心能力 → 简化运作流程 → 两种研究模式 → 一次研究会得到什么 → 五步使用 → 本地数据与安全 → 文档入口。开发架构、测试命令、退役技术和内部文件清单从首页删除。
- 新 README 已落实上述骨架，并增加用户可理解的流程图；产品事实保持原边界：Windows/Chrome、本地数据、BYOK、建筑案例证据、小红书图纸灵感、单活研究和独立扩展。
- Release 合同现在不仅校验 `2.2.5` 各版本面，还要求 README 包含功能、运作流程、结果、使用步骤和本地安全，并明确禁止 `Agent 架构/验证/完成度与边界/设计与计划` 等开发者章节及内部脚本/退役技术叙述回到首页。
- 新 Release/README 合同先在旧 workflow 上准确失败，版本面与文档同步后转绿，证明版本更新与首页改写都有自动合同保护。
- 完整覆盖率门禁通过：Board 184/184、Extension 182/182，覆盖率继续高于项目阈值。
- 权威 `verify.ps1` 首轮只发现两个版本文件需 Ruff 机械格式化；格式化后完整重跑全绿：API 572/572、Ruff、strict Mypy 26 源文件、Board 184/184、Extension 182/182、两端 lint/typecheck/build、packaged Extension E2E 8/8 与全部 Windows/Release/Provider/process 合同通过。
- 本地 `v2.2.5` 两个发布附件已成功生成：自包含 Windows 安装器与独立 Chrome 扩展 ZIP；安装器约 69.75 MB，扩展 ZIP 18,719 bytes。
- `test-windows-installer-package.ps1` 对新安装器真实静默安装、启动与卸载 smoke 通过；现有源码服务占用默认端口时安装版仍能走安全启动路径，安装器不捆绑扩展，结束后不留程序/快捷方式残留。
- 最终本地产物候选：安装器 69,750,435 bytes，SHA-256 `9CE2FCA801673224B0DD8D35CD6E8DF3944BA21BA37C918327904102665777D2`；扩展 ZIP 18,719 bytes，SHA-256 `0C61CA88F054B7406126FA7C536A80ECA2533D89BE7CE4C9185E4A423CB1A334`。
- 安装 smoke 后活动 Run 仍为 0，程序目录与桌面/开始菜单快捷方式残留为 0；原 `.archresearch` 真实研究数据未写入、迁移或删除。
- 已从最新 `origin/main` (`fc69f44`) 创建新分支/worktree `codex/v2.2.5`，没有切换、重置或清理原工作区。19 个待发布文件只包含登录修复、行为测试、README、版本面、用户文档与 Release 合同；四个本地管理文件不进入产品 PR。
- 新 worktree 相对 main 的 diff 为 575 additions / 188 deletions，README 的大量删除主要来自移走开发架构与验证说明；`git diff --check` 通过，无未跟踪文件。
- 原工作区与干净发布 worktree 的 19 个候选文件在统一 CRLF/LF 后全部完全一致；干净 worktree 的 `release.tests.ps1` 也已独立通过，可进入显式暂存和提交。
- 干净分支提交 `4d40cbb` 只包含确认的 19 个文件；已推送 `codex/v2.2.5` 并创建 PR #17，原工作区的四个交接文件没有进入产品提交。
- PR #17 的 push 与 pull_request 两套 Hosted CI 均成功，run `30822883086` 为 18 分 6 秒，run `30822911922` 为 18 分 53 秒；PR 随后 squash 合并为 `a691a0e141d9863672886b8c868cee03da0a818c`。
- 正式 annotated tag `v2.2.5` 解引用后精确指向上述合并提交；Release 非草稿、非预发布，GitHub README 已显示新版产品功能与 v2.2.5 下载入口。
- GitHub 附件复核与本地候选完全一致：安装器 69,750,435 bytes / SHA-256 `9CE2FCA801673224B0DD8D35CD6E8DF3944BA21BA37C918327904102665777D2`；扩展 18,719 bytes / SHA-256 `0C61CA88F054B7406126FA7C536A80ECA2533D89BE7CE4C9185E4A423CB1A334`。
- 发布后 SQLite `mode=ro` 仍为 96 条历史 Run、活动 Run=0。原工作区保留的 19 个同内容产品修改是旧分支工作树状态，不是未发布产品差异；不得自行 reset、checkout、clean。

## 2026-08-03 installed Xiaohongshu launcher regression

- 用户在疑似 v2.2.5 Windows 安装版中看到“登录状态未确认 / 图纸提取扩展已连接”；首次自动恢复和点击“再次打开小红书登录”都会新开另一个 Board，而没有打开小红书。
- 截图证明前端状态机与按钮渲染正常，缺陷发生在登录打开动作之后；高概率边界是安装版冻结进程复用了“打开 Board”的桌面启动器并丢弃固定 XHS 目标 URL。源码环境此前真实打开 XHS 通过，因此必须专门审计安装版路径，不能重做已通过的源码链路修复。
- 安装版正确合同是直接依赖 ArchResearch Chrome 扩展，不要求用户安装 OpenCLI；因此这个缺陷会阻断普通用户的 XHS 登录恢复，必须由安装版行为测试覆盖。
- 系统 Chrome 只读基线真实复现：安装版 Board 为 `http://127.0.0.1:3630/`；最近两次错误动作分别新增 `http://127.0.0.1:3630/?connect=chrome&attempt=<uuid>` Board 标签。该形状精确对应桌面配对启动 URL，证明登录动作被错误路由到“打开/配对 Board”。
- Chrome 中已有两个更早的 `https://www.xiaohongshu.com/explore` 标签，但最近两次动作没有新增 XHS 标签；因此不能把历史 XHS 页面误判为当前按钮成功。
- 根因位于 `create_desktop_app()`：它把传给 browser router 的 launcher 包成 `lambda _development_url: resolved_chrome_launcher(board_url)`，显式丢弃调用方 URL。于是 `/open-chrome` 与 `/open-xiaohongshu-login` 在安装版中都会调用 `open_board_in_chrome(installed_board_url)`；源码 `create_app()` 默认走 `open_known_url_in_chrome()`，所以此前源码真实验收没有暴露安装版专属回归。
- 最小正确映射应仅把开发常量 `CHROME_BOARD_URL` 替换为安装版动态 Board URL；固定 `XIAOHONGSHU_LOGIN_URL` 必须原样交给支持两类已知 URL 的 launcher。默认 launcher 也不能继续是只接受 Board 的 `open_board_in_chrome`。
- 安装版红测已在 v2.2.5 旧实现上准确失败：同一个桌面 app 依次 POST `/open-chrome` 与 `/open-xiaohongshu-login`，记录到的两个 URL 都是动态 Board；第二项期望固定 XHS explore。测试只用临时 SQLite 和 fake launcher，没有操作真实 Chrome 或研究数据。
- 最小实现后 desktop/browser 定向回归 45/45，通过 Ruff check/format 和 strict Mypy 26 源文件；修复没有触及 Board、扩展或 workflow。
- 独立 worktree 首次完整 verify 的 571/572 失败不是代码回归：临时 junction 复用的原 `.venv` 含 editable 安装路径，未显式 `PYTHONPATH` 时 pytest 收集了 worktree 测试却导入原工作区旧生产代码。应在重跑时把 `PYTHONPATH` 固定为 worktree `apps/api/src`。
- 修正导入后完整 API 572/572、Ruff 64 文件与 strict Mypy 26 源文件通过；verify 只在 pnpm 试图重建无 TTY 的临时 junction `node_modules` 时停止。前端未报告产品失败，且本轮没有修改前端；最终整仓门禁改在原工作区现成依赖上运行。
- 原工作区权威 `verify.ps1` 完整通过：API 572/572、Board 184/184、Extension 182/182、packaged E2E 8/8，Ruff、Mypy、lint、typecheck、production builds、Windows/Release/Provider/process 合同全部绿。
- 修复后真实 Chrome 启动验证使用临时 mock desktop app，只 POST 固定登录端点一次：总标签 8→9、Board 3→3、XHS 2→3，唯一新增标签为 `https://www.xiaohongshu.com/explore`。这证明实际 `_open_chrome_tab` 收到并打开了 XHS URL，不只是 fake launcher 单测通过。
- 真实用户安装版 v2.2.5 仍包含旧 lambda，源码修复不会热更新已安装二进制。要让用户获得修复，必须制作新补丁安装器；不得用同版本覆盖正式 v2.2.5 Release，应在得到发布授权后进入 v2.2.6。
- 用户已于 2026-08-04 明确授权正式发布 v2.2.6；发布仍保持 Windows 安装器与独立扩展 ZIP 两个附件，绝不覆盖 v2.2.5 tag/Release。
- v2.2.6 Release 合同在旧 workflow 上准确失败于 v2.2.5 安装器名；版本同步范围与 v2.2.5 一致，另包含本轮 `desktop.py` 与 `test_desktop.py` 两个修复文件。
- Release 合同还暴露了 3 个 README 正则转义旧版本遗漏；同步后合同与普通/转义残留扫描全部通过，当前非历史发布面统一为 2.2.6。
- v2.2.6 最终本地门禁全绿；独立扩展 ZIP SHA-256 为 `00A63870C80EE9F661761788E56E21344CB16F57483EBE4F199E50FAF4303442`。Windows 构建应在新 worktree 执行，避免其固定清理逻辑重建原工作区 `.artifacts/build/windows`。
- 最新 `origin/main` 已确认包含完整 v2.2.5 基线；v2.2.6 干净 worktree 只需带入桌面 launcher 红绿修复、版本/Release 合同与用户下载链接，不应把原旧分支的既有 21 文件工作树整体当作新提交。
- 干净 worktree 的 13 个首轮发布文件在统一换行后与原工作区已验证版本完全一致；独立安装器构建成功，冻结程序 `--self-test` 为 0，安装器 payload 中扩展文件数为 0。
- 首轮 Hosted CI 唯一失败是既有测试对单调时钟剩余预算做严格浮点相等：实际 `89.99999999999989`、期望 `90.0`。这是测试精度问题，不是 Provider 行为回归；改为 `pytest.approx` 后目标测试连续 10 次通过，生产代码未改。
- 最终提交 `4814fc6` 的 push/PR 两套 Hosted CI run `30833250631`、`30833258563` 均全绿；PR #18 squash 合并为 `7512a45bfec010cde8a701c910afbd43af813137`。
- annotated tag `v2.2.6` 解引用后精确指向合并提交；正式 Release 非草稿、非预发布。最终采用通过 GitHub Windows 安装 smoke 的 CI 产物，而不是本地时间戳不同的候选 ZIP。
- GitHub Release 附件：安装器 70,087,718 bytes / SHA-256 `4BDC30F5E3D17143D88FB68E25B68C33D5B7586CF3AEEDDCB798FAC19B6916B2`；独立扩展 ZIP 18,697 bytes / SHA-256 `40634B85FD98250185811F9E3B84B1CB9F9139C610FA9DDB2DF689F44EDA30FA`。远端 asset digest 与本地下载的 CI 产物一致。
- v2.2.6 的行为修复位于 Windows 桌面程序；v2.2.5 用户必须安装新 Windows 安装器，但现有扩展无需为该修复重装。普通用户也不需要单独安装 OpenCLI。
- 发布后 SQLite `mode=ro` 再查为 96 条历史 Run、活动 Run=0；没有创建、取消或修改研究数据，也没有读取凭据。

## 2026-08-04 v2.2.6 installed login still undetected

- 用户安装 v2.2.6 后确认固定小红书入口已经能正确打开，证明 Phase 20 桌面 URL 调度修复生效。
- 用户在系统 Chrome 完成登录，甚至退出后重新登录，Board 仍显示未检测到登录；这与“无法打开登录页”是不同缺陷，必须先读取 API 的状态/通道与扩展可见页面判定，不能继续假设等待窗口不足。
- 本阶段只允许读取可见标签、页面状态和枚举 API 返回，不检查 Cookie、local storage、浏览器 profile、账号或密码。
- 现场安装进程为 `C:\Users\76384\AppData\Local\Programs\ArchResearch\ArchResearch.exe`，监听 `127.0.0.1:3824`；`/desktop-health` 明确返回版本 `2.2.6`，排除安装仍停在旧版。
- `/v1/browser/status` 返回 `connected=true`、`xiaohongshu_search_available=false`；安装版 ArchResearch 扩展已连接，但没有 OpenCLI/local search 回退。登录检测返回 `unknown/chrome_extension`，因此真实故障已收敛为扩展枚举会话状态无法确认，而不是 Board 轮询或 v2.2.6 启动器版本未生效。
- SQLite `mode=ro` 仍为 96 条历史 Run、活动 Run=0。
- Codex 的系统 Chrome 控制连接与 ArchResearch 扩展是两条独立通道；前者旧会话已断开。Chrome 进程、Codex Chrome 扩展和 native host 的只读诊断均正常，但 browser-client 重连仍不可用；这不解释 ArchResearch API 已连接却返回 `unknown`，下一步继续审计 ArchResearch 自身扩展检测实现。
- ArchResearch 扩展登录检查每次新开 `https://www.xiaohongshu.com/search_result?keyword=建筑图纸&source=web_search_result_notes`，等待固定初始时间，再执行枚举动作并关闭临时标签；不是在用户手动登录的 explore 标签上直接读状态。
- 当前扩展只有三类 DOM 判定：login/error 路径、密码框或“请先登录”文本为未登录；仅当路径以 `/search_result` 开头且命中 `section.note-item` 下的 note link 才算已登录；其他页面结构、加载中、验证码或内容脚本异常都退化为 `unknown`。
- API 把扩展检查中的所有异常也无区分地吞并为 `unknown`，所以当前还不能判断是“小红书搜索页 DOM 已变化/加载不足”还是扩展命令异常；下一步先查现有日志与安装扩展版本，再设计不会读取账号数据的可观测红测。
- 现有运行日志没有记录浏览器命令失败原因，扩展 WebSocket 也不传版本；当前无法从日志区分 `unknown` 结果与 `permission_required/execution_failed` 异常。
- 临时搜索页已等待 3.5 秒，内容脚本准备另有 5 秒窗口；单纯“等待只有一瞬间”不是首要嫌疑。测试 fixture 仍只覆盖旧 `section.note-item` 结构，没有覆盖新版结果卡 DOM。
- 另一个高优先级假设是扩展 WebSocket 虽已连接，但重启/升级后 `researchPermissionGranted` 内存态未恢复；这种情况下任何登录检查命令都会被扩展以 `permission_required` 拒绝，API 同样只显示 `unknown`。下一步先审计 permission 消息链，避免在没有证据时直接放宽 DOM 选择器。
- Board 只有在页面桥状态 `research_permission=true` 时才把 XHS session check 标为可用并显示“登录状态未确认”；如果当前文案确为该状态，Chrome optional host permission 在持久层是已授予的。
- 扩展恢复配对时会从 `chrome.permissions.contains(<all_urls>)` 读取持久授权，并写入 WebSocket client 的内存布尔值；正常路径不需要每次重新授权。但 API 的一次现场 session 请求总耗时不到 1 秒，远短于成功打开临时页后必经的 3.5 秒 `wait`，强烈暗示命令在 `open_url` 或权限门禁处立即失败，而不是 DOM 最终判定 `unknown`。
- 下一步用单次精确计时确认快失败，再围绕“已连接但命令被拒绝/旧配对权限内存不同步”写红测；DOM 放宽暂不实施。
- 单次精确计时确认 session API 仅 196 ms 就返回 `unknown/chrome_extension`，不可能经过扩展 `open_url → wait 3500 ms → DOM status` 正常链路；DOM 选择器不是当前第一故障点。
- `BrowserBroker` 在把 `open_url` 发给扩展前会先做 DNS 公网地址校验；扩展返回错误时只保留通用 message，错误 code（包括 `permission_required`）被丢失，API 又统一吞成 unknown。即时失败可能发生在 DNS 校验或扩展权限门禁，下一步先复用生产解析器检查 XHS DNS。
- 生产解析器对 `www.xiaohongshu.com` 得到 3 个公网 IPv4 与 1 个公网 IPv6，`ALL_GLOBAL=True`；排除 Broker 的 DNS/SSRF 门禁即时拒绝。
- 扩展 `open_url` 正常创建后台 about:blank、安装加载监听、导航到 XHS 并等待内容脚本；如果是内容脚本/DOM问题，通常至少经过 5 秒准备窗口。196 ms 结果进一步锁定为 WebSocket client 在 executor 前直接拒绝，最符合 `research_permission` 内存态为 false。
- 产品级最小修复候选不是放宽 XHS DOM，而是让扩展每次处理 `ui.status` 时把持久的 `<all_urls>` 授权重新同步给当前 WebSocket client；Board 的每次“刷新/重新检测”都先请求该 status，再调用 session API，因此可在不弹新权限、不读取页面数据的情况下修复失同步。
## Phase 21 reconnect and permission-gate inspection (2026-08-04)

- `BrowserSocketClient.connect()` calls `disconnect(false)`, so an ordinary WebSocket reconnect preserves its in-memory `researchPermissionGranted` flag; the earlier theory that every reconnect unconditionally resets the gate is not supported by the source.
- Commands are nevertheless rejected immediately with `permission_required` whenever that in-memory flag is false, before the executor or page DOM is reached.
- `ExtensionController.status()` reads the persisted Chrome host-permission state for the UI but does not synchronize that value back into the active socket client. Therefore the UI can report permission as granted while the command gate remains stale/false; a status-time synchronization test is the next RED candidate.
- The loaded unpacked extension at `C:\Users\76384\Desktop\archresearch-chrome-extension-only-v2.2.6` is manifest version `2.2.6`; its compiled background bundle hash matches the repository `dist` bundle exactly, and Chrome records `<all_urls>` as both active and granted. The issue is not an outdated v2.2.6 package or missing host permission.
- Chrome also retains a second unpacked extension registration pointing at the now-missing older project path `C:\Users\76384\Documents\Codex\2026-07-11\agent-pdf-gpt\apps\extension\dist`. Both registrations have previously started service workers and can race for the single backend broker connection until the obsolete copy is disabled/reloaded away.
- RED confirmed: a connected controller with persisted Chrome access did not call `setResearchPermission(true)` on `ui.status` (0 calls). The minimal fix now repairs the active command gate only for an explicit connected `ui.status`; it does not re-grant on disconnect/revoke result reporting.
- Full extension verification is green: ESLint, TypeScript, 183/183 unit tests, production build, and 8/8 packaged-browser E2E. The first implementation exposed a revoke-test double-cleanup; scoping repair to explicit `ui.status` removed that side effect.
- The candidate background bundle was installed in place only after backing up the byte-identical official v2.2.6 bundle under `.artifacts/qa/phase21-extension-backup/`. A post-copy production API probe still returned `unknown` in 219 ms, proving Chrome has not reloaded the changed service worker yet.
- After the user reloaded and paired the candidate extension, the broker became connected and the same API call took 3.779 seconds. Permission-gate repair is therefore working; the result remained `unknown`, so execution now reaches the page/DOM phase.
- Two further checks remained `unknown` at 3.914 and 3.708 seconds. This is deterministic, not a one-off slow first navigation.
- Current public OpenCLI XHS code documents that some renders drop the `note-item` class (issue #1506) and waits on the same tab for up to 5 seconds using a MutationObserver, resolving on either a note-card signal or `登录后查看搜索结果`. ArchResearch already has the same classless-section fallback but closes the tab after one fixed 3.5-second observation; Board retries create fresh tabs and therefore cannot help a slow render finish. The next RED should require bounded rechecks on the same managed tab.
- Second RED confirmed: an initial `{status: "unknown"}` was returned immediately even when the same managed tab would report `logged_in` on the next observation. The executor now waits 1 second and rechecks up to 5 times on that same tab, validating the XHS public host before and after reads; exhaustion remains `unknown`.
- Updated extension verification is green: 18/18 focused executor tests, ESLint, TypeScript, 185/185 full unit tests, production build, and 8/8 packaged-browser E2E. The second candidate bundle hash is `FF92BCC49662997866C8321A9F49E6EDD36DFDCA2794526680BEA4834D1A2AA0` and has been copied to the loaded desktop folder with the first candidate backed up.
- Real check after the same-tab retry reload still returned `unknown/chrome_extension` after 8.816 seconds, proving the page exposes neither the existing login-wall text nor section-based note-card signals even after the bounded window.
- Added RED fixtures for an exact visible login control and an early user-avatar shell; both failed as unknown before implementation and passed after login-first visible-shell detection. Full gates then passed at 187 unit tests and 8 packaged E2E, but the real page remained unknown after reload.
- Added RED fixtures for a profile entry without avatar classes and a classless bare `/explore/{note}` link, matching current public adapter patterns; both failed before implementation and passed after widening only the bounded visible signals. Full gates passed at 189 unit tests and 8 packaged E2E. The real page still returned unknown after 8.824 seconds.
- Permission, pairing, fixed wait, same-tab retry, avatar/profile entry, section/classless note links, and common login controls are now excluded. The next diagnostic must inspect the visible result of the exact fixed search URL; continuing to guess selectors would risk false login detection.
- After explicit user authorization, opened a new controlled Chrome Default-profile window and directly visited the exact fixed search URL. The authoritative result was a redirect to `/website-login/captcha?...verifyType=124&verifyBiz=461` with page title `安全验证`.
- The account session may exist, but XHS blocks this browser profile behind CAPTCHA/safety verification before search results render. This explains why every DOM probe remained unknown: the old detector handled `website-login/error` but not `website-login/captcha`.
- Added a RED fixture for the real captcha route; it failed as `unknown`, then passed after treating the safety-verification redirect as not ready (`not_logged_in`). Final extension gates are green: 190/190 unit tests, lint, typecheck, production build, and 8/8 packaged E2E. The updated content bundle was copied to the desktop candidate with backup.
- After the user completed XHS safety verification, the installed production API returned `logged_in/chrome_extension` in 3.910 seconds with the extension still connected. This is the first authoritative end-to-end success on the reported machine.
- Final read-only database checks: project research DB has 96 historical Runs and 0 active; installed-app DB has 0 Runs and 0 active. No research workflow was started.
# 2026-08-04 — Phase 22 drawing-inspiration usage dialog

- Current Board readiness checks still exist, but `selectResearchGoal()` only changes the goal; switching to “图纸灵感” does not explicitly refresh readiness or open an installation/login dialog.
- `useBrowserReadiness()` already exposes all required state and actions: extension/bridge readiness, XHS session status, connect, open-login recovery, refresh, and loading labels. The new UI should reuse these contracts rather than add browser or backend behavior.
- Start submission already calls `ensureBrowserResearchAccess(true)` before creating a visual Run. That guard must remain authoritative after the dialog is dismissed.
- Existing `.extension-install-*` CSS is orphaned; there is no rendered install-dialog component in current Board source. Reusing or replacing these styles is acceptable only for the new scoped dialog.
- Impeccable product-register guidance favors one standard task dialog, explicit text+icon status, restrained color, one primary action, keyboard/focus behavior, and no nested decorative cards.
- Git history confirms the old local UI once had an extension-only dialog with a release download link and unpacked-extension instructions; it was removed during the local runtime consolidation while its CSS remained. The new dialog should restore only the useful local install guidance and combine it with live XHS login state—never restore Web Edition branches.
- Existing App overlay infrastructure already provides body scroll locking, Escape close, focus return, and a Tab focus loop. The preparation dialog should join that infrastructure instead of inventing a second modal controller.
- Phase 22 RED is confirmed: both new App behaviors fail only because no `图纸灵感使用准备` dialog exists. The failure occurs after the goal switch and current readiness rendering, so the tests exercise the intended user boundary rather than a setup error.
- User narrowed the requested UX after RED: the modal is now static usage guidance only. Existing extension/login status and actions must remain in the inline research-environment area. The automatic notice appears once, then a visual-mode-only “使用方法” button reopens it.
- CSS self-review found two draft references to undefined tokens (`--leading-heading`, `--icon-xs`) and an unnecessarily complex `calc()` expression. They were replaced with committed `--leading-tight`, `--icon-sm`, and `--space-7` tokens before final verification.

## 2026-08-04 — v2.2.7 release

- v2.2.7 scope was isolated to the Phase 21 extension login fix, Phase 22 Board usage guide, their behavior tests/product contract, and required version/release surfaces. The unrelated local `test_providers.py` difference and all four planning files were excluded from the product commit.
- Release contract RED failed accurately on the old v2.2.6 workflow artifact name; after version synchronization it passed, with no active v2.2.6 references left in release surfaces.
- The 13 Phase 21/22 source and test files in the clean worktree matched the previously accepted original-worktree content when line endings were normalized.
- The final local gate passed: API 572/572, Board 185/185, Extension 190/190, packaged E2E 8/8, Ruff, strict Mypy, ESLint, TypeScript, production builds, and Windows/Release contracts.
- Local artifacts built successfully; the frozen executable self-test passed and the installer payload contained zero extension manifests. The existing user installation was not removed for local smoke; clean GitHub Windows runners performed the authoritative install/start/uninstall smoke.
- GitHub App lacked PR-write permission (403), so the authenticated `gh` fallback created draft PR #19. Commit `931b4eb` was squash-merged as `256c70dc52fcb5b0cd0fbfaf7382ba2834d087ef`.
- PR CI run `30843780159` and final main push run `30845419827` both passed the full gate, Windows build, real installation smoke, and two artifact uploads.
- Annotated tag `v2.2.7` peels to the merge commit. The formal Release is neither draft nor prerelease.
- GitHub assets match the final main CI files exactly: installer 70,082,901 bytes / `DB3B135DF4A6A87690FCAE3B16B13F01E3BA6C7095BA28B89718B445C78FD1C7`; extension ZIP 18,862 bytes / `EB27455944BEC200ECE8809CB8B9389EFFD76A82FBD17D3A38BC9ECA2530BD31`.
- Post-release read-only SQLite check remains project 96 total/0 active and installed 0 total/0 active. No research data or credentials were read or changed.

## 2026-08-04 — Phase 24 safety-verification loop report

- 用户观察到的不是单次“无法确认登录”，而是安全验证页面在可操作前被关闭，同时持续出现新的小红书页面；因此 v2.2.7 对 captcha 路由的识别虽然让状态 fail closed，却没有解决验证码页面的交互生命周期。
- 当前首要假设是两个既有行为叠加：扩展会话检查把搜索页作为临时受管标签并在检查结束后关闭；Board 收到未就绪状态后再次触发登录入口或复检。必须通过调用链和行为测试确认，不能仅继续增加 DOM 选择器或轮询次数。
- 正确产品边界应是：验证码未完成时保留一个用户可操作页面、停止自动重复开页并继续 fail closed；用户完成验证后再复检为 `logged_in`。该修复不需要读取 Cookie、浏览器存储或账号信息。
- 初步链路证据：扩展内容层把 `/website-login/captcha` 立即归类为 `not_logged_in`；扩展同标签 5 次等待只针对 `unknown`，因此一跳到 captcha 就立刻结束本次状态检查。Board 的登录恢复流程随后最多执行 20 次检查，每次都调用 session API；需要继续确认 API 是否每次新建并关闭临时标签，以及 App 是否在状态变化后重复启动恢复流程。
- 根因已由源码确认：`XiaohongshuBrowserSearch.check_login()` 每次调用都 `open_url` 新建搜索标签，并在 `finally` 中无条件 `close_tab`；Board 登录恢复循环对任何非 `logged_in` 状态继续最多 20 次检查。captcha 当前与普通退出登录共用 `not_logged_in`，所以每轮都快速结束并关闭安全验证页，再由下一轮创建新标签。
- App 的自动恢复入口本身只在一次视觉模式会话中启动一次，真正的重复标签来自该恢复流程内部的 20 次 session API 轮询。修复应给安全验证一个独立枚举状态，让 API 保留并复用同一受管验证标签，让 Board 遇到该状态立即暂停自动轮询；普通登录路径仍可保留既有自动检测。
- 实现后的生命周期为：首次 session 检查创建受管搜索标签；captcha 返回 `verification_required` 时不关闭并记录 tab ID；Board 不再启动/继续自动恢复循环，也隐藏重复开登录按钮；用户点“重新检测”时同一 checker 对原 tab 再读状态，仍在验证则继续保留，已登录则关闭并清空 ID。
- checker 在路由创建时缓存，并用线程锁串行化并发 session 请求；普通 `logged_in/not_logged_in/unknown` 仍按原合同关闭临时标签。若用户手动关闭保留页或扩展断连，命令异常会清空缓存并 fail closed，后续重试才允许新建，不会伪报登录。
- 完整门禁证明新状态没有破坏普通登录、OpenCLI 回退、Chrome 通道权威规则、搜索执行或浏览器枚举协议：API 574、Board 186、Extension 190、packaged E2E 8 全绿。
- 该修复同时涉及 FastAPI/Board 与 Chrome 扩展，已安装的 v2.2.7 二进制和扩展不会自动获得本地源码改动。若用户要求正式交付，应提升到新的补丁版本，并继续发布独立 Windows 安装器与扩展 ZIP；不能只更新其中一个附件。

## 2026-08-04 — v2.2.8 release preparation

- 发布基线为远端 main `256c70dc52fcb5b0cd0fbfaf7382ba2834d087ef`，与 v2.2.7 正式合并提交一致；Phase 24 可作为其上的单一补丁，不需要带入旧分支的全部脏工作树。
- 目标 branch/tag/Release/worktree 均无冲突。发布仍必须使用隔离 worktree，并显式复制 Phase 24 的 10 个源码/测试文件和必要版本面，不能提交四个本地交接文件。
- 原工作区当前版本合同是未同步回来的 v2.2.6，而正式 main 已是 v2.2.7；发布隔离流程必须以 `origin/main` 为内容基线，只从原工作区提取 Phase 24 行为补丁和明确更新到 v2.2.8 的版本面。
# 2026-08-04 — v2.2.8 release findings

- v2.2.8 的关键运行时合同是三层专属状态：Extension 把 captcha 枚举为 `verification_required`，API 以跨请求 checker 和锁保留/复用一个验证标签，Board 收到该状态立即暂停自动轮询并等待用户手动重新检测。普通未登录和 fail-closed 行为不变。
- 原工作区的发布版本面仍停在 v2.2.6，因为 v2.2.7 曾从隔离 worktree 发布；因此本次必须从 `origin/main=256c70dc` 建立 v2.2.8 worktree，不能把原脏分支直接当作正式基线。
- 发布提交 `66c37cc` 精确包含 21 个白名单文件，四个交接文件、`.artifacts/`、`.archresearch/` 和研究数据均未进入提交；PR #20 squash merge 为 `b5223649`。
- PR CI 首轮唯一失败是既有 lazy-media packaged E2E 首次枚举偶发为空；本次扩展 diff 不涉及媒体枚举，按真实顺序本地 E2E 复验 8/8，通过后只重跑失败 job。attempt 2 与最终 main CI 均完成全门禁和真实 Windows smoke。
- 正式 Release 使用最终 main run `30881344666` 的两个文件；annotated tag 解引用到 `b5223649`，Release 非草稿、非预发布，GitHub 服务器 asset digest 与下载文件 SHA-256 一致。
- 正式安装器为 70,089,863 bytes / SHA-256 `B091208BF13B7E12D7A21770B7D56CE77EC1625266C2CC46DD55F6642209CBAD`；独立扩展 ZIP 为 18,878 bytes / SHA-256 `5BDD32F7C67C75641F56DE6756FF2631979063CEDC1474DE76A6F5356E817130`。
- 用户要获得本次修复必须同时更新 Windows 应用和 Chrome 扩展；安装器仍不捆绑扩展，普通用户不需要单独安装 OpenCLI。
- 发布后项目库仍为 96 条历史 Run/活动 0，安装版库 0/活动 0；未读取凭据、未创建或修改研究 Run。

## 2026-08-06 — Phase 26 drawing login navigation timing

- 安装版失败 Run `2c142ad3-59dc-4069-a326-db52b305dcc6` 为 `blocked / visual_budget_exhausted`；三个方向两轮小红书搜索均 `completed / result_count=0`，候选、页面读取和图像分析调用均为 0。失败发生在小红书搜索结果获取，不是 API Key、模型或视觉分析。
- 最可能的现场原因仍是小红书搜索页未加载真实卡片（登录、风控、安全验证或页面异常），或当前小红书 DOM/媒体加载方式已超出扩展枚举规则；需以手动打开同一搜索页是否能看到卡片来区分。
- 根因确认在 Board：`App.tsx` 原有视觉模式初始化 effect 将 `not_logged_in`、`unknown`、`unavailable` 和未确认状态统一视为需要登录恢复，并立即调用 `startXiaohongshuLoginRecovery()`。
- 未连接时该恢复函数先调用 `handleConnectBrowser()`；连接检测失败会通过 `/browser/open-chrome` 打开带 `?connect=chrome` 的 Board，再继续调用 `/browser/open-xiaohongshu-login`，形成用户看到的 Board 主页面与小红书登录页并发跳转。
- 修复边界：进入图纸灵感只加载研究环境状态，不自动启动外部页面；Chrome 扩展未连接且没有本地小红书搜索回退时，登录入口不显示，恢复函数直接提示“请先安装并连接 Chrome 扩展”。本地搜索回退路径仍可手动打开登录页。
- 行为测试覆盖了进入图纸灵感不调用两个打开页面接口、未连接时隐藏登录入口；原有自动登录测试已改为显式点击登录后继续验证轮询。
- 完整 Board 门禁为 188/188，lint、typecheck、生产 build 和 diff check 全绿；本次只改 Board 源码与测试，v2.2.8 正式安装器尚未包含该修复。

## 2026-08-06 — Phase 27 drawing inspiration zero-result diagnosis

- 失败 Run `2c142ad3-59dc-4069-a326-db52b305dcc6` 的六次搜索均由 `archresearch-extension-xiaohongshu` 在约 4.9 秒内返回 0；候选池、页面检查和图像分析均未开始。
- 当前安装版端口 13065 显示扩展已连接，session API 返回 `logged_in/chrome_extension`；同一 Chrome 中手动打开“剖面图 精细线稿”可见 20 个结果链接和 11 张满足尺寸门槛的可见封面，不存在登录墙或安全验证。
- 当前小红书结果卡仍是 `section.note-item`，封面直接位于 `/search_result/...` 锚点内；现有 `findSourceLink()`、同源限制和后端 `_is_xiaohongshu_note_url()` 均能接受该结构，因此不是新版 DOM 关联失效。
- 应用使用的 `source=web_search_result_notes` 地址会正常落到带 `type=51` 的结果页，排除查询参数问题。
- 扩展 `open_url` 在内容脚本于页面 loading 阶段注入成功后即可返回；API 搜索仅固定等待 3.5 秒、枚举一次、滚动后再等待 1 秒并枚举一次。动态卡片稍晚渲染时，两次空结果会被当成真实零结果并立即关闭标签，这是与现场耗时和既有 lazy-media 偶发证据一致的根因。
- 最小修复位于 `XiaohongshuBrowserSearch.search()`：首轮等待后最多检查 5 次，每次间隔 1 秒；发现有效小红书笔记链接立即停止等待，始终为空时到上限后仍执行原有一次滚动补充。
- 新增行为测试已先红后绿：延迟到第三次枚举的笔记卡被返回，持续空结果固定为 5 次首轮检查加 1 次滚动后检查；原有已就绪搜索合同保持不变。
- 定向小红书测试 16/16、完整 API 测试全绿、Ruff 与 strict Mypy 全绿；扩展 `content.test.ts` 25/25 全绿。正式 v2.2.8 尚未重新构建发布。

## 2026-08-07 — Phase 28 v2.2.9 release

- PR [#21](https://github.com/jileyu2000/archresearch/pull/21) 已合并，主分支提交为 `97669e0b28b13260197628c08a29113317b964da`；PR CI `31115430369` 与手动主分支验证 `31121126690` 均通过。
- v2.2.9 发布前门禁为 API 576/576、Board 188/188、Extension 190/190、packaged E2E 8/8，包含 Windows 安装/启动/卸载 smoke；安装器和扩展保持分离。
- annotated tag `v2.2.9` 已推送并解引用到 `97669e0b`；正式 Release 非草稿、非预发布，地址为 https://github.com/jileyu2000/archresearch/releases/tag/v2.2.9。
- Windows 安装器为 70,137,821 bytes / SHA-256 `FA7DFE24CC8CD67E0DA3B46972148836D778FDAF9989C2CDE9199B264FF31AA`；独立扩展 ZIP 为 18,878 bytes / SHA-256 `958FDCC09655181F096A40C712BD1069EF4915DE075CD4B6FD8B7B307B454715`；GitHub asset digest 与本地计算值一致。
- 发布过程中未读取凭据，未创建、重试、取消或修改 Research Run；原始工作区、真实研究数据和临时附件均保留。

## 2026-08-07 — Phase 29 v2.2.9 zero-result recurrence

- 用户提供的 v2.2.9 结果页截图显示：研究已结束但未形成可用结果，顶部为“研究尚未完成，暂未找到可用图纸”，可用参考为 0，三个图纸方向均为 0/3。
- 该证据否定了“只要等待最多 5 秒即可覆盖现场渲染”的假设；本轮必须检查扩展枚举、受管标签页面形态和 API 过滤三层的真实输入输出。
- 截图没有显示 Provider、模型、登录或扩展错误，因此暂不能把失败归因于凭据或模型；需要以最新 Run Trace 和当前 Chrome 页面为准。
- 当前 Chrome 保留了与失败查询一致的搜索页：`/search_result?keyword=剖面图+精细线稿&source=web_search_result_notes&type=51`；首页标签此前可见多个 `section.note-item`、笔记链接和封面，搜索页的自动 DOM/截图读取连续超时，暂不能把该工具超时当作页面内容证据。
- 代码链路核对：扩展注入或 `sendContentCommand` 失败会经 WebSocket 返回 `execution_failed`，API 会将该次搜索记为 `skipped`/失败；现场 Trace 却是 `completed/result_count=0`，因此当前更可能是内容脚本成功返回 `{media: []}` 后被 API 当作真实空结果。
- `collectMedia()` 只接受可见的 `img/canvas/svg`，显示尺寸至少 `120x80`、intrinsic 尺寸至少 `240x160`，并要求通过同源 `<a>` 或有限卡片祖先找到小红书笔记链接；尚未取得失败受管页的实际候选数组，不能先扩大过滤规则。
- 当前唯一可由历史真实边界稳定复现的解析缺口是：卡片超过 8 个辅助链接时，现实现直接丢弃该卡片的全部来源关联；新增红测将笔记链接放在第 9 个位置，修复只优先保留明确笔记路径。
- 红测在撤回本次实现时准确失败：媒体仍被枚举但 `link_url=null`；恢复实现后内容层 26/26、Extension 全量 191/191、ESLint 和 TypeScript 全部通过。
- Chrome 搜索页的接管、截图、Playwright evaluate 和可见 DOM 四条只读路径均在同一受管标签超时；该环境暂时无法提供失败页面的实时候选数组，因此不能声称已完成现场复测。
- 安装版只读 SQLite 核对：失败 Run `e0a1f833-3c98-409f-b1dd-a8930c55dcef` 为 `blocked/composing`，三次 `archresearch-extension-xiaohongshu` 均 `completed/result_count=0`；候选池、source page、asset candidate 均为 0。正式 v2.2.9 发布扩展 content 哈希为 `D0BCF35F6E39ED229FE12E70B2387F1D3875B13732D5123A9DD5797542964AD5`，本地修复 content 哈希为 `E164E26D3DDBFFAC763AAEB72A8F43A5317A8A2D327032982641C1CAEE1E57BD`。
- 候选目录 manifest 原为旧版本标识，已只更新为 `2.2.10`；生成独立 ZIP `C:\Users\76384\Desktop\Archsearch\archresearch-chrome-extension-only-v2.2.10-candidate.zip`，SHA-256 为 `E62059828CD0A348138B7B02A72F6BD36DF25E66AAE4285719F08C897EA0CDD7`，未提交或发布。

# 2026-08-07 — Phase 29 live run after service recovery

- 隔离 Board `15172` 与 API `18072` 已恢复；Chrome 原有隔离标签刷新后页面正常加载，API `/v1/browser/status` 返回 `connected=true`、`xiaohongshu_search_available=true`，会话检测返回 `logged_in/chrome_extension`。
- 真实提交“比较剖面图的精细线稿、低饱和色块和拼贴叙事”创建 Run `f49ef969-2e7a-4a8a-9e5f-3efcbcd933cd`，规划正常，第一轮小红书搜索返回 3 条，候选池保留 3 条且绘图类型匹配 1 条。
- 当前真实失败层级已收敛到笔记读取/媒体提取：3 次 `browser` inspecting 均 `status=completed` 但 `candidate_count=0`、`visual_calls_used=0`；第二个方向后续搜索出现 `BrowserCommandError`，Run 最终 `blocked/no_usable_assets`。因此结果不再是搜索枚举为空，下一步检查 note 页面读取命令与内容脚本返回。

# 2026-08-07 — Board connection-refused screenshot

- 用户截图显示 `http://127.0.0.1:15172/` 返回 `ERR_CONNECTION_REFUSED`，说明截图时隔离 Board 进程没有监听端口。
- 复核时 `15172`、`18072` 均已监听；Board 首页、API `/health` 和 `/v1/browser/status` 分别返回 200，API 状态为 `connected=true`、`xiaohongshu_search_available=true`。该截图不能作为前端打不开或扩展协议失败的证据，但暴露了隔离服务生命周期不稳定的问题。
- 代码修复仍应优先处理已确认的详情页直达安全限制：搜索结果页能枚举笔记链接，详情读取直接 `open_url` 后被重定向到安全限制页，最终媒体为空。
# 2026-08-07 — Phase 29 isolated live acceptance setup

- 修复后隔离 API 已在 `127.0.0.1:18072` 启动，隔离 Board 已在 `127.0.0.1:15172` 启动；正式安装版 `127.0.0.1:9872` 保持运行且未停止、未覆盖。
- 隔离 API 显式使用 `MockResearchProvider`、`MockVisualClassifier` 与修复后的 `XiaohongshuBrowserSearch(BrowserBroker)`，因此无需 API Key，但小红书搜索、页面枚举与素材读取仍必须经过真实 Chrome 扩展。
- 当前 Chrome 可打开隔离 Board；但扩展桥在自动配对和显式“连接 Chrome 读取高清图纸”两条路径均未响应。只读 API 状态显示正式 `9872` 与隔离 `18072` 都是 `connected=false`，因此尚未创建新的 Research Run，不能把当前状态解释为修复失败。
- 静态回归已完成：完整 API `577 passed`；定向 API/浏览器协议 `54 passed`；扩展相关 `54 passed`；Ruff、strict Mypy、ESLint、TypeScript 和扩展生产构建均通过。
- 使用系统 Chrome 的正常启动标签验证：扩展曾能连接正式 `9872`，但当前隔离 `15172` 页面没有桥响应；尝试打开 `chrome-extension://` 扩展页面被浏览器 URL 策略拒绝，未使用其他浏览器控制方式绕过，也未读取 Cookie、storage、账号、密码或 API Key。
- 真实流程验收仍未完成。用户只需重新加载候选扩展并打开 `http://127.0.0.1:15172/?connect=chrome`；连接后由 Codex继续提交查询并检查 Run、Trace、结果与 Board。

## 2026-08-07 continuation

- 最新截图中的错误是 Chromium 对 `127.0.0.1:15172` 的连接拒绝，说明该端口在截图时没有监听进程；它不能证明 Board 前端或 Chrome 扩展协议本身失败。
- 需要区分两类问题：隔离 Board/API 进程退出导致的“打不开”，以及扩展连接后图纸研究在笔记详情读取阶段的真实失败。验证顺序必须先稳定本地服务，再进行一次新的真实 Run。

## 2026-08-07 detail timing diagnosis

- `XiaohongshuBrowserSearch.open_note()` 新增的 `open_xiaohongshu_note` 动作会创建新的搜索结果标签，但 `BrowserCommandExecutor.openXiaohongshuNote()` 原先在创建后立即发送点击命令；这比搜索阶段的结果就绪等待更早。
- 该时序可稳定用测试模拟：第一次内容命令返回 `{opened:false}`，第二次才返回 `{opened:true}`；旧实现红灯，加入同一安全搜索页的最多 5 次、1 秒间隔重试后转绿。
- 重试只接受枚举化的固定动作和已验证的小红书搜索/笔记 URL；重试期间若标签离开安全搜索页，或上限内仍没有精确链接，仍删除临时标签并 fail closed。

## 2026-08-07 final verification

- 隔离服务当前由 `run-board.ps1`/Vite 和独立 Uvicorn 进程监听；当前连续 30 秒健康检查稳定。截图中的 `ERR_CONNECTION_REFUSED` 发生在这些进程退出后的窗口，不是当前 Board 代码路由错误。
- 最新候选 ZIP 已包含详情执行器修复；正式 v2.2.9 和 GitHub Release 均未覆盖或发布。
- Chrome 现场仍受小红书安全限制页阻断，session 状态为 `unknown/chrome_extension`。在用户完成安全验证、重新加载候选扩展并重新配对前，无法诚实地宣称真实图纸 Run 已跑通。

## 2026-08-07 — repeated Xiaohongshu login recovery

- Board 的显式登录恢复每 1.5 秒调用一次 `/v1/browser/xiaohongshu-session`，最多 20 次；API 的扩展会话检查对非 `verification_required` 状态关闭临时标签并清空标签 ID。
- 因此现场安全限制页被扩展判为 `unknown` 时，每次轮询都会再次 `open_url` 一个小红书搜索标签；这就是“重复检测、重复打开”的直接原因。
- 自动恢复可以继续，但重查必须发生在同一个受管标签内；不能把每次重查实现成新的 `open_url`。安全验证仍应保留专属状态并暂停外层流程。
- 当前 Board 每轮只发起一次恢复检测请求；扩展在同一受管标签内对 `unknown`/`not_logged_in` 最多重查 20 次，完成后才回收临时标签，恢复入口的并发 Promise 去重仍保留。
# 2026-08-07 — login regression live evidence

- 当前 Chrome 控制连接只发现一个小红书搜索标签：`https://www.xiaohongshu.com/search_result/?keyword=剖面图%20精细线稿&source=web_search_result_notes&type=51`；没有 Board 标签。
- 因此目前不能把用户看到的新 Board 页面归因于当前隔离 Board 源码；下一步先核对所有本地监听端口、进程命令行和实际页面 URL，再复现点击链路。
- `chrome.user.openTabs()` 随后确认当前 Chrome 中有两个 Board 标签：基础入口 `http://127.0.0.1:15172/?connect=chrome` 与带 `attempt=6dbaf6b713bb4d3bb26e3b31363e2119` 的同端口 Board 标签；另有扩展管理页和小红书搜索页。用户报告的“新开 Board”已在现场复现为真实标签状态。
- 隔离 Board `15172` 是 Vite 源码服务，隔离 API `18072` 状态 `connected=true`、`xiaohongshu_search_available=true`；正式安装端口 `9872` 未监听。下一步检查 Board 组件实际按钮回调与 API 代理/请求日志。
- 源码中的 `ResearchComposer` 登录按钮回调为 `onOpenXiaohongshuLogin`，Hook 调用 `apiClient.openXiaohongshuLogin()`，API 路由为 `/v1/browser/open-xiaohongshu-login`；当前源码路径本身没有把该按钮映射到 `/browser/open-chrome`。
- Chrome 控制对象可读取指定 Board 标签，下一步用实际标签读取页面加载来源和请求结果，区分 Vite 当前源码与旧缓存/旧安装页面。
- 已接管带 `attempt` 的 Board 标签并读取 DOM：它加载的是当前图纸灵感界面，状态为“登录状态未确认”，按钮为“再次打开小红书登录”；该页可执行真实按钮复现。
- `chrome.tabs.get()` 不能直接使用 `user.openTabs()` 的 ID，必须先用 `chrome.user.claimTab()` 接管用户标签；此前“Tab not found”是控制接口使用方式错误，不是产品行为。
- 真实复现：在当前 Board 的“再次打开小红书登录”按钮上单击一次，1 秒后新增标签为 `http://127.0.0.1:15172/?connect=chrome&attempt=16175fd5d0a44419b34ff20603c39275`；登录按钮实际导致了 Board launcher 行为。
- 该现象与当前源码中 `/browser/open-xiaohongshu-login` 的固定小红书 URL 分流不一致，优先核对隔离 API 进程的命令行/加载路径与直接 POST 路由响应。
- 根因已确认：`.artifacts/qa/live_xiaohongshu_harness.py` 的 `launch_isolated_board(_url)` 无条件调用 `open_board_in_chrome("http://127.0.0.1:15172/?connect=chrome")`，丢弃了登录路由传入的 URL；因此只有隔离验收环境会把“打开小红书登录”变成新增 Board。
- 已将 harness 改为：收到固定小红书登录 URL 时调用 `open_xiaohongshu_in_chrome`，其他 URL 仍映射到隔离 Board；使用 `apps/api/.venv` 重启 API `18072` 后，`/health` 与 `/v1/browser/status` 均恢复 200，`connected=true`。
- 重启过程中的两次启动问题：第一条嵌套 PowerShell 命令解析失败；第二次用 Codex runtime Python 启动时缺少 `uvicorn`；改用项目 `apps/api/.venv/Scripts/python.exe` 后服务正常。正式 `9872` 未监听。
- 修复后的真实按钮复测：再次单击“再次打开小红书登录”后新增两个小红书标签（`https://www.xiaohongshu.com/explore` 与 `https://www.xiaohongshu.com/search_result?keyword=建筑图纸...`），没有新增 Board 标签；登录 URL 分流已生效。
- 当前 session API 返回 `unknown/chrome_extension`；这不是明确的 `not_logged_in`，需要检查检测页是否实际注入扩展、是否处于安全验证页或当前 DOM 登录结构未被识别。
- 检测标签在 API 返回前已被正常回收，无法通过旧标签继续读取其 DOM；随后读取用户打开的 `https://www.xiaohongshu.com/explore` 可见页面，DOM 包含“我”入口与大量 `/user/profile/`、`/explore/` 链接，证明当前 Chrome 会话实际有登录态。
- `readXiaohongshuSessionStatus()` 已包含 `a[href*="/user/profile/"]` 的已登录识别；因此当前红测边界应覆盖“新建搜索标签实际已登录但内容命令返回 unknown”，重点检查受管标签创建后的内容脚本注入/就绪时序。
- 手动新建并加载同一搜索 URL 后，页面可见 DOM 明确包含“我”入口、多个 `/user/profile/` 和 `/search_result/` 链接；随后再次调用 API 检测仍为 `unknown/chrome_extension`。登录态是稳定可见的，问题不在页面结构选择器。
- 当前需要从扩展实时受管标签/命令响应定位：API 检测标签会在完成后回收，因此不能直接从已关闭标签读取 DOM。
- 当前 API session 检查实测约 8.6 秒返回 `unknown`；这与旧扩展“3.5 秒初始等待 + 5 次 1 秒重查”的时序相符，不是当前源码已配置的 20 次同标签重查。因此 Chrome 当前加载的不是桌面候选 `v2.2.10` 扩展包。
- `ChromeBrowserPort.sendContentCommand()` 的只读重注入白名单漏掉了 `xiaohongshu_session_status`；新建小红书标签的首轮内容脚本注入/连接异常时，状态检查不会走重注入恢复。

# 2026-08-07 — current live recheck

- 当前隔离 Board `15172` 可正常加载，API `18072` 健康且 `connected=true`；正式安装端口 `9872` 未监听。
- Chrome 当前小红书页的可见 DOM 含“我”入口、用户 profile 链接和笔记链接，实际会话为已登录；同一隔离 API 的 session 接口仍在约 8 秒后返回 `unknown/chrome_extension`。
- 对当前 Board 的“再次打开小红书登录”按钮做一次真实点击，点击前后标签列表完全一致：没有新增 Board，也没有新增小红书标签。隔离 harness 的 URL 分流修复当前生效。
- 候选扩展目录 manifest 为 `2.2.10`，工作区源码 manifest 仍为 `2.2.8`；仅凭源码测试不能证明当前 Chrome 已加载候选包。登录检测当前剩余问题是浏览器实际加载包/受管标签注入状态，需要先核实 Chrome 扩展版本与通信日志。
- 完整 `chrome.user.openTabs()` 复核显示，本次点击后新增的是 `https://www.xiaohongshu.com/explore`，不是 Board；当前两个 Board 标签中，带 `attempt` 的标签来自此前错误调度历史。受控标签列表未自动包含新建页，不能据此误判为“没有打开”。

# 2026-08-07 — safety verification page lost

- 用户明确报告：小红书出现安全验证后，当前流程立即刷新，未留出人工验证时间。
- 现场只读检查时 Chrome 只剩 `http://127.0.0.1:15172/` Board，验证码标签已不存在；Board 显示“登录状态未确认 / 暂未检测到登录”，而不是 `verification_required`。
- 这证明仅有静态 `verification_required` 分支不够；必须覆盖“检测开始时还是搜索页，检测过程中导航到验证码页”的时序，并保证该标签不关闭、不重载、不再次导航。
- 现场复现的时序为：一次“重新检测”先打开验证码标签 `1497398055`，约 3.75 秒后又打开第二个验证码标签 `1497398059`；两者随后都被关闭，Board 回到 `unknown`。
- API 的 `create_browser_router()` 每次创建一个独立的 `extension_session_checker`；当它返回 `unknown` 时，又对 `app.state.xiaohongshu_search` 再做一次 `check_login()`。隔离 harness 同时注入了第二个 `XiaohongshuBrowserSearch`，因此同一请求产生两次验证码标签。
- 扩展执行器当前只依据内容脚本结果判断验证状态；如果内容脚本仍返回 `unknown`，它无法在发送第二次命令前依据当前标签 URL 识别 `/website-login/captcha`，这正是需要增加的 fail-closed 边界。
- 修复后扩展在内容命令前、每轮重查前和返回前都检查受管标签 URL；captcha 路径不再依赖内容脚本注入是否及时。
- API 在 extension status 已产生且配置后端也是 `XiaohongshuBrowserSearch` 时直接返回扩展状态，不再调用第二个 browser checker。
- 最新候选 ZIP 已验证 manifest `2.2.10`、12 个文件，SHA-256 `1126A1C73F9D8FF7A534A368D579D43CDE9FD92662E84EE03E085E984179E1AE`。

# 2026-08-07 — foreground Xiaohongshu rendering diagnosis

- 最新候选重载后的唯一 session 探针返回 `unknown/chrome_extension`，约 24.8 秒结束；期间只新增一个小红书搜索标签，没有验证码或 Board 重复打开。
- 根因边界已收窄：小红书搜索与详情入口使用后台标签，页面 URL/title 已加载但登录壳和异步结果卡可能不渲染；普通网页仍保持后台打开。
- 红测先失败后转绿：小红书搜索和笔记详情改为前台打开。Extension `206/206`、Board `190/190`、API 浏览器/小红书 `56/56`、lint、typecheck、生产构建和 diff check 全部通过。
- 新候选 `C:\Users\76384\Desktop\Archsearch\archresearch-chrome-extension-only-v2.2.10-candidate.zip` 已同步，12 文件、20,479 bytes，SHA-256 `A49AB175C11401070D8FA5723650CB83214B8D8D2EA815E0DF30A65DD138D2F5`，background SHA-256 `29579B7D5F4AF4BDD0A8FAE3FE3ACD8FEF6CDC57B48FA1D4D140D32F9DA8C2E9`。
- 正式 `v2.2.9` 未覆盖或发布；新候选尚未现场重载验收，下一步是一次 session 检测，成功后再跑一条隔离图纸研究。

# 2026-08-07 — post-captcha login remains undetected

- 用户重新加载候选扩展后，Codex 在外部 Chrome 对 Board 只点击一次“重新检测”：约 2.5 秒后只出现一个 `/website-login/captcha` 标签，约 6 秒后 Board 稳定显示“需要完成小红书安全验证”。
- 验证标签在观察期间未刷新、未关闭，也未产生第二个 captcha 标签；前一轮的重复 checker 与验证码页丢失问题已通过真实现场验收。
- 用户完成扫码后反馈仍无法连接，Board 一直检测不到登录。新的失败边界位于 captcha 完成后的会话恢复，而不是验证码保留阶段。
- 下一步只读证据顺序：扫码后的实际 Chrome URL/可见状态 -> Board 当前状态 -> `18072` session API 响应与耗时 -> 隔离 API/扩展日志。不得重复点击检测或读取 Cookie、storage、账号、密码。
- 扫码后外部 Chrome 只有 Board 与 `https://www.xiaohongshu.com/explore`；验证码页已正常导航完成，不是停留或扫码失败。
- 小红书可见 DOM 明确包含“我”入口、`/user/profile/...` 链接和正常首页内容流，足以依据产品现有可见 DOM 合同判定已登录；Board 同时仍为“登录状态未确认”。失败已收敛到扩展内容命令/重注入/受管标签恢复或 API 响应链路。
- 隔离 API `POST /v1/browser/xiaohongshu-session` 在 3838 ms 后返回 `unknown/chrome_extension`。这不是 Board 显示缓存，后端本身收到/转换成了 unknown。
- Board 控制台无 error/warn；小红书页只有站点自身 APM/hydration 错误，没有 ArchResearch 内容脚本错误证据。
- 现场 captcha 标签的外部 Chrome id 为 `1497398064`，扫码后 explore 标签为 `1497398076`。这支持“小红书完成验证时关闭原 captcha 标签并新开 explore，API 仍保存旧受管 tab id”的假设；需要用行为测试验证旧 tab 消失后的恢复合同。
- 一次受控 session 探针的标签时序：约 455 ms 创建 `about:blank`；674 ms 成为小红书“建筑图纸”搜索页；1542 ms 同 tab 导航到 `type=51` 搜索 URL；4089 ms API 返回 `unknown/chrome_extension`；4279 ms 该受管标签被关闭。已有 explore 登录页始终保留。
- 新搜索标签没有跳验证码、没有被替换，且正常位于白名单小红书 URL。扩展执行器对真实 `{status:"unknown"}` 会再检查 20 秒；本次约 4 秒结束说明 `xiaohongshu_session_status` 命令抛异常，API `except Exception` 将异常吞成 unknown，然后 `XiaohongshuBrowserSearch` 关闭标签。
- 当前最可能层级是内容脚本未注入/消息接收端不可用/站点读取权限不足，而不是登录 DOM 选择器；下一步取得浏览器命令的安全错误类别，并为“命令异常不可伪装成会话 unknown”与实际恢复边界补红测。
- `ChromeBrowserPort` 红测已准确复现：首条 session 消息无接收端后，补注入若第一次遇到 `Document is not ready`，旧实现立即抛错；这与现场约 4 秒结束而未进入 20 秒 unknown 复检一致。
- 最小修复仅将只读命令的补注入改为在既有 5 秒上限内、每 50 ms 重试；首次成功行为不变，命令超时策略、验证码 URL 判定、协议白名单和标签回收均未修改。
- 修复后 ChromeBrowserPort 30/30、Extension 全量 204/204、Board 全量 190/190、API 浏览器/小红书定向 56/56 通过；Extension ESLint、TypeScript typecheck 和 production build 通过。
- 用户重载该候选后的唯一一次真实 session 检测仍在 3966 ms 返回 `unknown/chrome_extension`；搜索标签正常经历 about:blank -> 搜索页 -> `type=51`，约 4180 ms 被关闭，时序与修复前一致。说明“补注入第一次失败”红测虽是真实代码缺口，但不是本次现场根因，不能保留为本轮修复依据。
- 现场已确定的更窄事实是：session 命令抛异常后，`executeXiaohongshuSessionCheck()` 没有进入既有 20 次复检；异常直接穿透到 API，被吞成 unknown。下一步撤销未通过现场的适配层重试，建立“首次 session 内容命令异常、下一次已登录”的执行器红测。
- 两条执行器红测均在旧实现准确失败：首次 session 命令异常后下一次返回 logged_in；首次异常后标签进入 captcha。最小实现仅把 `sendContentCommand` 异常纳入原有 20 次/每次 1 秒循环，并继续在每次下一轮前及最终返回前检查 captcha URL。
- 新实现定向 Executor 26/26、Extension 全量 205/205、Board 全量 190/190、API 浏览器/小红书 56/56 通过；Extension ESLint、TypeScript typecheck 与 production build 通过。前一候选 ZIP `5DF577...` 已现场否定，必须作废并由新构建替换。

# 2026-08-07 — content command failure classification

- 用户重载候选后的 session 仍为 `unknown/chrome_extension`。QA 记录器取得确定命令序列：固定 `explore` 页打开成功、3500ms 等待成功，随后 `xiaohongshu_session_status` 在扩展既有有限重试结束后失败，最后正常关闭标签。
- 因此当前失败不在 Board 缓存、登录 URL 或 DOM 登录选择器；扩展 WebSocket 原先把内容脚本所有失败统一压成 `execution_failed`，API 又统一转成 `BrowserCommandError`，导致无法区分注入、消息、内容操作与超时。
- 已新增有限且不含页面数据的分类：`content_script_injection_failed`、`content_message_unavailable`、`content_operation_rejected`、`content_command_timeout`；未知错误仍为 `execution_failed`，对用户文案仍统一为 `Command could not run`。
- QA broker 在交给 API 通用异常前额外记录扩展错误码。3 个红测旧实现准确失败，修复后定向 52/52、Extension 全量 209/209、ESLint、TypeScript、QA 脚本语法和 diff check 全绿。
- 下一次用户重载后只允许一次 session 探针；真实错误类别将决定后续最小修复。前台打开小红书标签的猜测尚未通过现场，应在最终交付前撤销，除非后续证据证明必要。

# 2026-08-07 — live diagnostic result

- 用户重载诊断候选后，隔离 API 最初仍为 `connected=false`；系统 Chrome 只读检查发现 Board 停在不带连接参数的 `http://127.0.0.1:15172/`。将同一现有标签导航回 `?connect=chrome` 后扩展恢复 `connected=true`，没有新增 Board。
- 清空 QA 事件后只执行一次 session 探针：24,337ms，最终 `unknown/chrome_extension`。命令序列为 `open_url(explore)` 成功、`wait(3500)` 成功、`xiaohongshu_session_status` 失败、`close_tab` 成功。
- 扩展返回的安全错误码为 `content_message_unavailable`。这证明内容脚本注入调用没有被分类为失败，但首次消息和单次补注入后的消息均找不到接收端；当前根因属于监听器注册、注入目标文档或 documentId 生命周期，不属于登录 DOM、验证码、权限门禁、内容操作拒绝或 Board 缓存。
- 本轮未重复 session 检测、未创建 Research Run，也未读取 Cookie、storage、账号、密码或 API Key。

# 2026-08-07 — root cause and packaged fix

- `apps/extension/dist/assets/content.js` 现场构建产物以 `import ... from "./protocol.js"` 开头。原因是内容详情协议从 background 共用的 `protocol.ts` 引入 URL 校验器，Rollup 为两个入口抽出了共享 chunk。
- `chrome.scripting.executeScript({files:["assets/content.js"]})` 注入的是普通内容脚本入口，不会按扩展页面模块图加载该静态 import；因此注入调用之后没有 `chrome.runtime.onMessage` 接收端，真实诊断稳定表现为 `content_message_unavailable`。此前 packaged E2E 的 `page_metadata` 失败与现场登录失败是同一根因。
- 新增 production bundle 行为红测，旧实现准确读取到静态 import 并失败。修复将 URL 白名单移到仅由 content 入口引用的 `content/url-policy.ts`，构建后 `content.js` 自包含且仍只使用固定枚举协议。
- 撤销小红书搜索和详情标签 `active=true` 的未证实改动；普通网页和小红书受管标签重新统一后台打开，验证码单标签保留逻辑不变。
- 验证：相关测试 122/122、Extension 全量 210/210、ESLint、TypeScript、production build、`git diff --check` 通过；packaged MV3 E2E 8/8 通过，覆盖真实注入、硬导航、懒加载、敏感页边界、重连和 FastAPI 图像工作流。
- 最新候选 ZIP 为 22,329 bytes / SHA-256 `71FF6FFEC100C150C0858F77A9AA5B9C2B5E11590E7EA69FD21D9484FE9E2A9B`；background SHA-256 `15A9C22488F34E02B349E471786CA1B5FA37C4C759DD7F213497BD94BDD891B4`；content SHA-256 `97825543F22687BD570539BF0AD0715A27DD5EA113546CD9FDE6C2B9427A77B3`。

# 2026-08-07 — post-injection drawing run

- 新候选重载后的唯一 session 探针在 4,243ms 返回 `logged_in/chrome_extension`；命令序列完整成功，证明静态 import 根因修复已在真实 Chrome 生效。
- 隔离图纸 Run `b9bb962a-67e1-4d8a-afec-0efdea37f373` 使用 mock Provider 和真实小红书扩展链路，最终 `blocked/composing`，`stop_reason=visual_budget_exhausted`，三个方向均执行但可用参考为 0。
- Trace 显示所有搜索命令成功返回，没有 `BrowserCommandError`；每个方向多次 `enumerate_media` 后 `result_count=0`，候选池、详情读取和视觉调用均为 0。剩余失败位于搜索页媒体/笔记链接枚举，不在登录、消息注入、详情或视觉分类。
- QA recorder 当前会把 enumerate 结果显示为 `{}`，因为只保留 status/tab/url 等键，无法区分 `media=[]` 与“媒体存在但 link_url 为空或被 URL 过滤”。下一步增加不含页面文本的安全计数，再做一次单独搜索探针。
- 系统 Chrome 中打开一个精细线稿剖面图搜索页后，Playwright DOM snapshot 与 visible DOM 两种只读读取均超时；已停止重复浏览器接管，页面保持不刷新。
# 2026-08-07 — Phase 32 single-search media probe

- 用户重载 `v2.2.10` 候选后，隔离 API `18072` 健康，浏览器桥 `connected=true`、`xiaohongshu_search_available=true`。
- 只执行一次 `精细线稿剖面图` 搜索探针，`source_count=0`；搜索标签创建、滚动、会话确认和关闭均成功，没有 `BrowserCommandError`。
- 同一搜索标签共记录 10 次 `enumerate_media`，每次均为 `media_count=0`、`linked_media_count=0`，图片、canvas、svg 统计全部为 0。
- 因此当前失败层不是 API URL 过滤或笔记链接关联，而是扩展内容脚本没有枚举出新版搜索页使用的媒体表示、懒加载属性或背景图结果卡。
- Chrome 官方控制通道的 DOM 统计与截图各超时一次；按三击规则停止该路径，不再重复页面接管。
- 旧现场记录已证明同一搜索地址在前台可见 20 个笔记链接和 11 张满足门槛的封面；当前执行器却将研究搜索和详情搜索页均以后台标签创建，符合后台动态结果卡不渲染时 `media_count=0` 的现场表现。
- 行为红测将研究搜索与详情搜索页改为前台，旧实现准确 2 项失败；新增小红书登录入口仍后台的保护测试通过。最小实现只修改这两个研究打开点，定向 Executor 28/28 转绿。
- 完整 Extension 回归 211/211，ESLint、TypeScript、production build 与 packaged MV3 E2E 8/8 通过。
- 同一 `v2.2.10-candidate` 已覆盖；清除了旧构建残留的 `assets/protocol.js`，候选目录与本次 dist 均为 11 个文件。ZIP 为 20,131 bytes，SHA-256 `64ED320256FEC5D777748D8C1AAC9DF7570DBA193BB755A5AF57456B92B21FD5`；background SHA-256 `6CCE126F96A4FAD7406DAB9C6613CE53AE9A1C562C16E38882F504ECE0AB2039`，content SHA-256 仍为 `97825543F22687BD570539BF0AD0715A27DD5EA113546CD9FDE6C2B9427A77B3`。
- 用户重载后单次真实搜索探针通过：约 5.0 秒返回 3 个来源；首轮枚举 12 张图片且 12 张均关联笔记，滚动后为 15/15。搜索、滚动和关闭标签均成功，证明前台渲染修复已在真实 Chrome 生效。
- 唯一完整隔离 Run `e45719b0-5d05-4815-99db-17e262666e6b` 在约 71 秒内完成，终态 `partial/composing`、`visual_budget_exhausted`；3/3 视觉方向覆盖，9 个可用资产来自 4 个帖子/项目来源，无 coverage gap。
- 9 个结果全部 `has_local_content=true`，`/v1/assets/{id}/content` 逐项返回 HTTP 200 `image/png`，单文件约 30 KB–317 KB。Trace 共 39 个事件，浏览器失败 0；12 次详情检视实际产生候选并将视觉调用推进到 24 次 quick 上限。
- Board 刷新后最新 Run 卡显示 9 张参考；实际结果页显示“4 篇帖子 · 9 张灵感图”、三个方向和 6 个帖子分组。DOM 有 11 个跨方向展示图片节点、10 个当前视口即时加载、0 个失败占位；9/9 唯一文件已由内容端点独立验证，控制台错误为 0。
- 因此图纸灵感完整链路已经跑通：Board → API → Extension → 小红书搜索 → 笔记点击 → 媒体读取 → 视觉分类 → 本地 PNG → Board 渲染。`partial` 仅表示 quick 视觉预算用完，不代表功能失败。

# 2026-08-07 — Phase 32 visual acceptance invalidated

- 用户截图与本地候选文件证明，Run `e45719b0-5d05-4815-99db-17e262666e6b` 的“9 张灵感图”不是有效图纸研究结果。
- 已逐张查看 `.artifacts/qa/phase29-live/runs/e45719b0-5d05-4815-99db-17e262666e6b/candidates` 下 9 个 PNG：
  - `0e3d5048...` 与 `bec6e005...` 近乎全白，只保留轮播圆点或“可能含 AI 生成内容”。
  - `3a2417b4...`、`6f65c6e7...`、`dfc7a544...` 是巨大标题、灰色占位或同一帖子局部，图纸主体不完整。
  - `3b87ba4d...` 与 `ca47d35e...` 只截到拼贴/景观剖面的局部，其中一张还带大面积灰色遮罩。
  - `e8cf76fa...` 包含完整小红书左侧导航与页面壳，只在右侧露出局部图纸。
  - `860f9636...` 主要是帖子正文、评论、关注按钮和遮罩，不是图纸素材。
- 0/9 图片达到“干净、完整、可用于图纸研究”的标准。此前只验证 HTTP 200、PNG 可读、资产数量和 Board 渲染，遗漏了内容质量验收。
- 当前 `MockVisualClassifier` 不具备拒绝空白、网页 UI、遮罩和错误裁剪的能力，因此使用它跑通完整 Run 只能验证流程，不能作为视觉质量验收。
- 优先根因假设：媒体坐标在标签激活/布局变化后失效；轮播图片未加载即截图；详情页把页面壳、正文或遮罩当作媒体；viewport、DPR 或缩放坐标换算不一致。需要先用行为红测区分，不直接扩大选择器或反复改时序。
- `v2.2.10-candidate` 仅证明搜索枚举已从 0 恢复为非零；详情媒体提取仍失败，不能发布。
- 代码链路确认：`collectMedia()` 在所有页面统一枚举可见 `img/canvas/svg`，详情页没有专属媒体容器约束，也没有排除页面级 SVG、导航壳、正文/评论面板、模态遮罩或占位轮播。
- `capture_region` 接收的是此前枚举出的裸 region；截图前只重新读取 viewport，不会重新枚举或按媒体 URL/稳定 ID 定位当前元素。若标签激活、轮播加载或模态布局改变，旧坐标会继续用于新页面状态。
- `ChromeBrowserPort.captureTab()` 为截图会激活目标标签；若该标签此前不活动，这一动作本身可能触发布局或渲染变化，但执行器没有等待布局稳定或刷新 region。
- API `_capture_candidates()` 对每个媒体直接截图并交给 classifier；当前 mock classifier 会接受空白/页面 UI，因此所有坏图均可被保存。结果记录中的 `image_url` 是具体 XHS CDN URL，但本地 `storage_path` 保存的是 region 截图，不是该 URL 对应的原始图片字节。
- 9 个本地 PNG 已按资产内容 SHA-256 与结果记录一一映射；空白与页面 UI 文件仍携带正常的 XHS CDN `image_url`，进一步说明来源 URL 找到了，但 region 截图没有稳定对应同一媒体内容。
- 不带 Cookie、账号或浏览器存储的 XHS CDN 直链探针成功下载全部 9 张原始 WebP。逐张检查后分成两类：
  - rank 1、2、5、8 的直链是完整建筑图纸，但对应本地结果为空白或包含页面 UI，证明 region 截图损坏了正确媒体。
  - rank 0、3、4、6、7 的直链是招聘进度、Codex 截图、面试回复、邮件和聊天，证明详情页枚举还抓到了当前笔记弹层之外的可见/被遮挡页面图片。
- 因此不能只把截图替换为直链下载；必须先保证详情页只枚举当前笔记媒体，再对通过该边界的 XHS CDN 图片保存原始字节。
- Chrome 控制层对现有搜索标签的 DOM snapshot 与可见 DOM 各尝试一次均超时，已停止重复该路径。当前不依赖猜测具体小红书 class 名，优先采用通用的实际遮挡检测与 note-detail 页面媒体约束。
- 最小实现采用两道 fail-closed 边界：内容脚本在 XHS note-detail 仅接受 `img` 且用 `elementFromPoint` 多点采样确认媒体未被其他页面层遮挡；API 仅对 HTTPS `*.xhscdn.com` 且来源为 XHS note URL 的图片进行无凭据原图下载。
- CDN 下载不跟随重定向、要求 `image/*`、流式限制 20 MiB、无 Cookie；下载失败不回退为页面截图，以避免重新引入空白、侧栏或遮罩结果。
- 普通网页、非 XHS 页面、canvas/svg 和非批准媒体主机继续使用原 `capture_region` 路径，未扩大浏览器协议或通用下载范围。
- 真实 CDN 下载器已对本轮 URL 验证成功；Extension/API 全量与 packaged E2E 均通过。剩余唯一未验证项是候选重载后的真实 Chrome 新 Run 逐张内容验收。

# 2026-08-07 — Phase 33 post-reload live acceptance

- 用户已确认手动重载最新 Phase 33 候选扩展。
- 系统 Chrome 现有标签包括扩展管理页、一个旧的小红书搜索页和唯一一个隔离 Board；没有新建 Board 标签。
- 已接管并复用现有 Board，将其导航到 `http://127.0.0.1:15172/?connect=chrome`；页面正常显示历史研究记录。
- 隔离 API `18072` 健康状态为 `ok/mock`，浏览器状态为 `connected=true`、`xiaohongshu_search_available=true`；正式端口未触碰。
- 下一步必须只 POST 一次小红书 session 检测；若返回 `verification_required`，保留同一验证页并停止；若为 `logged_in/chrome_extension`，才创建唯一新 Run。
- 唯一一次 session POST 已在 4,779 ms 返回 `logged_in/chrome_extension`；登录与扩展通信均通过，没有触发验证码或重复开页。
- OpenAPI 确认图纸研究创建合同为默认工作区 `00000000-0000-4000-8000-000000000001` 下的 `ResearchSpec`，使用 `goal=visual_reference_search`、`research_sources=[xiaohongshu]`。
- 创建前列出的近期 Run 均已终止，没有 `queued/running` 单活研究占用；可以安全创建唯一新 Run。
- 唯一新 Run 为 `6e9ef544-b8af-4086-abd9-f392bf2c76ed`，创建响应 HTTP 201，初始状态 `created`，保留期至 2027-02-03。
- 新 Run 约 76 秒自然结束为 `partial/visual_budget_exhausted`，保留 6 个本地候选，4 个子方向全部至少覆盖 1 次。
- Trace 共 50 个事件：4 次 XHS 搜索均返回 8 个结果；16 次详情检视中 6 次得到候选、10 次被 fail-closed 拒绝，浏览器事件均为 `completed`，没有命令失败。
- 6 个结果均提供具体 XHS CDN `image_url`，但仍必须查看本地 PNG 内容；`has_local_content=true`、数量 6 或覆盖完成不能替代质量验收。
- 6 个新 Run PNG 已定位在 `.artifacts/qa/phase29-live/data/runs/6e9ef544-b8af-4086-abd9-f392bf2c76ed/candidates/`；将按内容哈希映射结果记录并分批逐张查看。
- Rank 0 `6403a6e7...png`：完整展示剖面线稿与材质渲染剖面对比，主体边界完整；无导航、正文、评论、遮罩或页面壳。存在原帖蓝色箭头与水印，但属于图内标注，判定合格。
- Rank 1 `a72687a1...png`：完整展示同一建筑剖面的 AI 前后两版，线稿与绿色低饱和表达均清晰；无网页 UI 或错误裁切。存在“我给ai的/ai给我的”原帖文字，仍可作为表达对比参考，判定合格。
- Rank 2 `24831717...png`：由三张完整的功能剖面/空间关系图组成，绿色、青色低饱和信息编码清晰；无网页 UI、遮罩或错误局部。底部有来源声明，判定合格。
- Rank 3 `3abd98d3...png`：四宫格完整拼贴剖面，分别呈现粉彩、线框、蓝色线稿和低饱和材质表达；主体均完整，无页面壳或遮罩，判定合格。
- Rank 4 `50a56e36...png`：纵向完整构造剖面，红砖、蓝灰结构线、人物和植被层次清晰；主体完整，无网页 UI 或遮罩，判定合格。
- Rank 5 `e809db07...png`：黑白室内效果图与项目封面文字，虽然原图完整且没有页面 UI，但不是剖面/图纸表达；结果记录也已标为 `asset_type=photograph`，却被归入 `linework_style`。判定不合格。
- 本轮逐张结论为 5/6 合格。新 CDN 原图路径已解决空白、导航、正文、遮罩和错误裁切，但工作流仍允许 photograph 进入图纸研究结果，剩余根因从媒体提取收敛为图纸类型筛选/视觉分类边界。
- `workflow.py` 只有 `XiaohongshuAssetDownloader` 分支计算 `requested_asset_type`、删除 `type_mismatches` 并只持久化匹配类型；真实 Chrome/browser 分支直接把 `inspect_source_page()` 返回项传给 `_persist_inspected_assets()`。
- 这与现场完全吻合：Rank 5 已被 classifier 标成 `photograph`，仍持久化并覆盖 `linework_style`。无需改媒体提取或猜测视觉内容，只需让 browser 分支复用现有 requested drawing type 边界。
- 新测试强制确认 XHS 搜索、browser 打开/截图和 classifier 调用均真实发生；旧实现最终留下 6 个 `photograph`，准确复现缺少类型过滤的行为。
- 最小修复未修改 classifier、媒体提取或浏览器协议；只在持久化前按当前子问题的 requested drawing type 过滤 browser 结果，并复用同一辅助函数保持下载/browser 两条路径一致。
- 精确相关回归 8/8 通过；曾被宽泛补丁误改的两个既有测试预算已恢复为原值，未留下无关测试改动。
- API 新基线为 583/583；Ruff、格式检查、strict Mypy 和 diff check 全绿。无需重建或重载 Chrome 扩展，因为本次修复仅位于 API `workflow.py`。
- 隔离 API 已加载新源码并在 PID 5196 / 端口 18072 返回 `ok/mock`；Board 15172 保持，正式 9872 未触碰。
- API 重启后，Board 的普通 reload 会被前端规范化到根 URL；显式导航回 `?connect=chrome` 后扩展桥恢复为 `connected=true`。没有新建 Board 标签。
- 重启后的唯一 session 检测再次通过 `logged_in/chrome_extension`；复验 Run ID 为 `ad270123-244e-4295-98c7-cef6c7bd7f86`。
- 复验 Run 0 结果的直接原因不是 photograph 过滤：4 个方向的 XHS 搜索均 `result_count=0`，QA 记录的各搜索标签每轮 `enumerate_media` 都为 0，根本未进入详情分类/持久化。
- Chrome 仍有旧的“精细线稿剖面图”搜索标签和唯一 Board，没有验证码页；尝试截图该旧标签超时，停止继续使用已知不稳定的 XHS DOM/截图诊断路径。
- 独立搜索探针同样在 13 秒后返回 0，QA events 显示新 tab `1497398330` 的首次、滚动后和重查枚举全部为 0，最后正常关闭。
- 当前成功遗留标签 URL 为 `...&type=51`；搜索器创建 URL 仅含 `source=web_search_result_notes`，依赖站点客户端后续切换。需要观察失败标签实际 URL/标题，不能直接猜测加参数。
- 2026-08-07 本次诊断开始前的 Chrome 基线只有 3 个标签：既有 XHS 搜索标签 `1497398151` 已稳定在 `search_result?...&source=web_search_result_notes&type=51`、扩展管理页和唯一 Board。后续探针必须按新标签 ID 区分，不能把这个旧 `type=51` 标签误当成新探针成功。
- 单次时序探针创建的新标签为 `1497398334`：约 1.03 秒出现 `about:blank`，1.25 秒进入无 `type` 的搜索 URL，1.88 秒自动稳定为同一查询的 `type=51`，随后持续到约 14.00 秒关闭。API 总耗时 13,050 ms，仍返回 `source_count=0`。
- 时序中未出现验证码、安全限制 URL、登录页或额外 Board；因此“未进入 `type=51`”假设已排除，不能通过盲加 URL 参数修复。剩余诊断应聚焦已进入正常笔记搜索 URL 后为何媒体枚举仍为 0，例如前台/可见性、实际页面壳或渲染状态；在取得证据前不改选择器。
- QA events 精确记录新标签 10 次 `enumerate_media` 全部为 0，之后正常 `close_tab`；没有浏览器命令错误。执行器源码同时确认安全的小红书搜索 URL 会以 `active=true` 创建，因此“仍按后台标签打开”的旧根因也不成立。
- 当前内容层有两个无法从空数组区分的分支：`isSensitivePage()` 会直接返回空；否则页面可能确实没有任何通过可见性/尺寸边界的媒体。为避免猜测，隔离 QA harness 新增只返回安全状态的 `/qa/xiaohongshu-page-state`：复用现有 `xiaohongshu_session_status`、`page_metadata`、`viewport_metrics` 和 `enumerate_media`，不返回页面正文、账号或凭据，也不修改产品代码。
- 修正诊断端点后，真实标签 `1497398342` 在 3.5 秒时返回 `logged_in`，`page_metadata` 成功且 URL 已是 `type=51`，同时 `media_count=0`。这明确排除了 `isSensitivePage()` 整页拦截。
- 加入只返回计数与布尔信号的 `page_snapshot` 后，标签 `1497398346` 仍为正常标题/URL和 `logged_in`，但可见 heading/paragraph/caption 块为 0、媒体为 0，且没有登录、验证码、空状态或网络错误文本信号。
- 由于 Chrome 官方控制对 XHS 标签的 claim/DOM/screenshot 继续超时，隔离 QA 最终保留标签 `1497398350` 给用户直接目视；该标签同样为 `logged_in`、正常 `type=51` 标题/URL、snapshot 0、media 0。下一判断依赖它实际显示正常瀑布流还是空白/异常壳。
- 用户截图证明保留标签实际已经完整显示正常图片瀑布流：首屏至少 12 个图纸卡片可见，URL/标题正常，没有空壳、错误提示、登录墙或验证码。
- 在用户实际切到 Chrome 查看页面后，同一 API 会话新建标签 `1497398354`，首次 3.5 秒状态探针立即返回 `media_count=12`；继续等待 30 秒仍为 `12`，且 `linked_media_count=12`。因此问题不是现有 13 秒等待不足，也不是媒体结构/过滤器无法识别当前页面。
- 前后唯一关键环境变化是 Chrome 窗口被用户实际打开/恢复；扩展源码和候选包未变。现有 `active=true` 只激活窗口内标签，不保证 Chrome 窗口从未聚焦/最小化状态恢复。当前最强根因为研究标签没有保证宿主 Chrome 窗口进入可渲染状态。
- 窗口恢复红测在旧实现准确失败：创建 `active=true` 的 XHS 研究标签时，`chrome.windows.get/update` 调用均为 0。后台普通网页保护测试保持通过。
- 最小实现位于 `ChromeBrowserPort.createTab()`：仅当调用方要求 `active=true` 时读取宿主窗口状态；若为 minimized，先恢复为 normal，再聚焦该窗口，然后才导航研究标签。`active=false` 的普通网页和小红书登录入口不调用 windows API。
- 定向 63/63、Extension 全量 214/214、ESLint、TypeScript、production build、packaged MV3 E2E 8/8 与 `git diff --check` 全部通过。
- 桌面同一候选目录只更新 `assets/background.js`，SHA-256 `8FD231947F4B6DBD337074C52CFA267DC78B9F030085607C08BC0A95CD8BBCBD`；`content.js` 保持 `BAA18814...A083`。新 ZIP 20,459 bytes、SHA-256 `6A22C9F48A5650FCBF07306A2FF474DA9447E2CE6E958E75916F6BE632084C6E`，manifest `2.2.10`、11 文件。

# 2026-08-07 — Phase 33 window-focus live run

- 用户重载候选后，Chrome 未人工切到小红书时的单次探针在 4,996 ms 返回 3 个来源；首次媒体枚举 11/11，滚动后 16/16，证明扩展能够自行恢复并聚焦宿主窗口。
- 唯一完整 Run `50f90fc6-dae0-4d80-bc4f-0f1f72e65b87` 自然结束为 `partial/visual_budget_exhausted`，但 7 个项目和 4/4 子方向均有覆盖，最终 `gaps=[]`、`enrichment_gaps=[]`。
- Trace 共 51 个事件；4 次 `xiaohongshu_search` 均为 `completed`、各返回 8 个结果，浏览器详情检视没有失败。7 个结果均为 `asset_type=section` 且有本地内容。
- 7 个候选 PNG 已定位在 `.artifacts/qa/phase29-live/data/runs/50f90fc6-dae0-4d80-bc4f-0f1f72e65b87/candidates/`。数量、分类和 Trace 仍不能代替视觉验收；下一步必须按 rank 逐张查看原图。
- Rank 0 `6403a6e7...png`：上下对照展示完整的黑白剖面线稿与材质渲染剖面，建筑主体、空间层次和转换关系清晰；无网页导航、正文/评论面板、遮罩或错误截图，符合 `rendered_style`，判定合格。
- Rank 1 `598c7211...png`：内容确为高精度建筑剖面线稿，线型、填充和构造标注清晰，符合 `linework_style`；但图纸在右侧和底部边界处明显截断，部分 A-3 构造说明也被裁掉。是否属于可接受的“局部详图”仍需与本轮完整性门槛统一判断，暂不计最终通过。
- Rank 2 `24831717...png`：完整包含三组功能/空间关系图解，场地高差、垂直交通、视觉关系和功能文字编码清晰；无网页 UI、遮罩或错误裁切，符合 `diagrammatic_style`，判定合格。
- Rank 3 `3abd98d3...png`：四宫格呈现多种拼贴式剖面与剖透视，人物、材质、背景和重点色层次明确，四个画面边界完整；无网页 UI、正文面板或遮罩，符合 `collage_style`，判定合格。
- Rank 4 `5ecf2093...png`：完整展示多组功能分区剖面/流线图解，公共—私密、停车、交通和功能文字编码明确；无网页 UI、遮罩或错误裁切，符合 `diagrammatic_style`，判定合格。
- Rank 5 `4f6edf42...png`：同一剖面的“处理前/处理后”完整对照，上部为基础线稿，下部为低饱和水彩材质表达，建筑主体与标高完整；大标题属于原图说明而非网页 UI，符合 `rendered_style`，判定合格。
- Rank 6 `a4622960...png`：上部为基础建筑表达，下部为带环境、植被、雨水路径和地下构造的完整景观剖面拼贴；“拼贴剖面技巧”是原图标题，不是网页 UI，符合 `collage_style`，判定合格。
- 用户最后提供的小红书搜索页截图显示 Rank 1 对应搜索卡片本身就是当前局部构图；API 保存内容与原始 CDN 字节哈希一致，因此右/下边缘不是 ArchResearch 的二次截图裁切。作为精细线稿局部研究，其线型、构造层级和标注清晰，最终判定合格。
- 最新 Run 最终人工验收为 7/7 合格。窗口恢复、XHS 原图保存、遮挡过滤和 requested drawing type 过滤共同通过现场验证；Phase 33 可以完成。

# 2026-08-07 — 建筑研究影响边界复核

- `_filter_inspected_visuals_by_requested_type()` 对非 `visual_reference_search` 直接原样返回，Phase 33 的 photograph/图纸类型过滤不会改写 `precedent_research` 结果。
- XHS 原图保存仅匹配 HTTPS 小红书详情来源与 `*.xhscdn.com` 图片；普通建筑项目网页仍使用原正文解析和受控截图路径。
- 扩展只有安全的小红书搜索/详情标签以 `active=true` 打开并恢复聚焦；普通网页和登录入口仍为后台标签。
- 补跑建筑研究专项自动回归 5/5、扩展标签/窗口行为 61/61，均通过。用户已要求再创建一条真实建筑研究 Run 完成现场确认。
- 隔离 API `18072` 当前 `ok/mock`，活动 Run 数为 0；该隔离数据集只有最新图纸 Run，没有历史 `precedent_research` 可直接复用。
- 保留的正式本地研究库位于 `.archresearch/archresearch.db`，将只读查询已验收建筑 Run 的原问题，不修改正式研究数据。
- 本机无 `sqlite3` CLI，随后两种内联 Python 查询写法均在执行前被 shell/工具解析拒绝；正式数据库没有被打开或修改。
- 不再为复用旧题继续追查数据库。现场回归采用代表性问题：“分析工业建筑更新项目中，如何通过保留原有结构、重新组织公共动线并引入自然采光改善空间体验；比较至少三个案例，并给出可迁移的设计策略。”
- 创建接口使用 `ResearchSpec`；本轮将显式设置 `goal=precedent_research`、`budget_mode=balanced`，并省略 `research_sources`。该枚举当前只含 `xiaohongshu`，建筑研究不应误选 XHS-only 来源。
- 隔离服务明确注入 `MockResearchProvider`，不是用户真实 BYOK Provider。它会为建筑研究生成既有结构、功能植入、动线、剖面等子问题，并提供 4 个确定性工业建筑更新案例；本轮验证的是完整建筑研究工作流回归，不等同于线上 Provider/真实互联网质量验收。
- 唯一 Run `6d540f6f-d54d-4ada-86e5-d40bd9bcddd7` 创建成功。请求未传 `research_sources`，响应仍显示 `[xiaohongshu]`，说明当前 Pydantic 默认包含该可选来源；需要结合 Trace 检查它是否只是发现线索，而没有替代建筑正式来源与证据。
- Run 在约 0.28 秒内以 Mock Provider 自然结束为 `completed/coverage_satisfied`：4 个工业更新项目、12 个资产、4/4 子问题覆盖、无 gaps。
- 12/12 结果均有 2 个 facts 与 3 个 EvidenceClaims，证据陈述、逐字摘录和 source URL 绑定完整；2 个结果为 verified/primary，其余为 partial/trusted-secondary。
- Trace 共 24 个事件。可选 `xiaohongshu_search` 因 `BrowserUnavailableError` 记为 skipped，但建筑研究继续使用 Mock Provider 正常完成；没有 requested drawing type 过滤、XHS 图片下载或 photograph 筛选进入正式结果。
- Board 无头浏览器能在主页找到唯一匹配该标题的研究卡片并点击；结果页出现“返回主页”，证明已进入某个详情视图，但主体只显示“从一个具体设计问题开始”的空状态。
- Board 截图保存在 `.artifacts/qa/phase34-architecture-board.png`；console error 和 pageerror 均为 0。API Results 已确认 12 条，因此不能把空页面归因于 Run 没有结果。
- 复查点击目标确认是正确的 `recent-open` 按钮；首次空状态仅因点击后等待 700 ms，早于 Results 异步加载完成。
- 等待 2.5 秒/明确等待“织造厂再生中心”可见后，Board 正常展示本次研究任务、4 个子问题、4 个不同项目、每项来源域名和两条迁移策略；Results/Board/user-state/events 请求均为 200。
- 最终截图 `.artifacts/qa/phase34-architecture-board-loaded.png` 已保存。唯一 404 为 `/v1/boards/{board_id}/style-profile`，需确认这是未生成风格档案时的预期可选状态，而不是建筑结果回归。
- `getStyleProfile()` 明确捕获 404 并返回 `null`，hydration 随后继续使用 `defaultStyle`；API 和 Board 测试均把“未创建 style profile 时 GET 404”作为正常合同。因此浏览器的 failed-resource 日志是预期缺省请求，不影响结果页。
- 最终截图视觉验收通过：Board 清楚展示研究问题、4 个子问题、织造厂再生中心/铁路仓库公共大厅/船坞创意园/铸造车间社区中心、来源域名和两条迁移策略；没有空页、错模态或图纸灵感 UI 混入。
- Phase 34 结论：Phase 33 的窗口聚焦、XHS 原图和图纸类型过滤没有破坏建筑研究功能。唯一范围限制是本轮 provider 为 Mock，不能替代真实 BYOK/公网来源质量验收。

# 2026-08-07 — Phase 35 state semantics and budget scope

- 用户明确要求同时修复建筑研究和图纸灵感的状态判定与文案，并适度提高两类预算。
- 已确认图纸 Run `50f90fc6-dae0-4d80-bc4f-0f1f72e65b87` 为 4/4 方向覆盖、7 个合格结果、`gaps=[]`，但仍被误标 `partial/visual_budget_exhausted`；实际视觉检查仅 11/48、约 2.15/48 MiB，并未耗尽。
- 当前设计约束：基础覆盖完成与富集数量目标必须分离；富集目标可以驱动继续搜索，但不能单独把完整覆盖降级为 partial，也不能伪装成预算耗尽。
- 下一步先审计两类预算与状态测试，确定约 15%–25% 的精确增幅并建立行为红测；尚未修改生产代码。
- 首轮代码搜索确认预算源在 `schemas.py` 的 `BUDGETS`，现有 schema 测试逐字段锁定 quick/balanced/deep 数值；视觉额外预算与完成门槛位于 `workflow.py`。
- Board 的 `partialReasonTitle()` 当前把 `visual_budget_exhausted` 无条件翻译为“本轮可检查的图纸数量已达上限”；该文案只有在后端保证 stop reason 真实时才准确。
- 现有 `agent_verification` 合同已经把 `completion_satisfied()` 与 `enrichment_satisfied()` 分开，但 workflow 最终状态仍额外受视觉富集门槛控制，说明修复应复用既有语义而不是新增一套完成概念。
- 用户进一步明确：提高预算的目的就是尽量让研究内容更丰富。实现上应保留富集目标作为继续搜索的驱动力，但预算是上限而非必须耗尽的任务；基础覆盖已完成时，富集未满不能令任务失败。
- `workflow.py` 目前有三层相关限制：通用 `BUDGETS`（查询/页面/时间）、普通视觉 `VISUAL_INSPECTION_LIMITS`、图纸灵感专用 `VISUAL_REFERENCE_INSPECTION_LIMIT=(48, 48 MiB)`；还存在每方向 3 篇帖子的富集目标。
- 最终状态附近明确存在无条件覆盖 stop reason 的代码：只要 `visual_completion_allowed` 为 false 就写入 `visual_budget_exhausted`，没有检查视觉调用数或字节数是否真实达到上限。
- 当前通用预算为 quick `2 rounds/6 queries/16 pages/2400s`、balanced `3/12/40/3600s`、deep `4/24/72/5400s`；建筑研究还会追加 4 个 completion recovery rounds 和每个未覆盖子问题 3 页恢复预算。
- 普通视觉检查预算为 quick `12 calls/24 MiB`、balanced `36/72 MiB`、deep `72/144 MiB`；图纸灵感使用独立统一上限 `48 calls/48 MiB`，不随 quick/balanced/deep 变化。
- 查询循环中已经能在 `inspection_budget.exhausted` 时准确设置 `visual_budget_exhausted`；真正的 bug 是最终收尾又因每方向 3 篇帖子未达标而无条件改写该原因。
- 提高通用 `max_queries` 时需结合 `max_rounds`/恢复轮次理解实际可达查询数，不能只改一个不会被执行路径使用到的数字；图纸丰富度还受每方向帖子检查上限和来源池上限共同约束。
- workflow 的运行中停止条件本身合理：只有 `enrichment_satisfied(coverage)` 且每方向帖子富集目标满足时才提前结束，因此富集目标仍能推动搜索继续；需要改的是最终终态判定，不是取消富集过程。
- 现有验证模块已经把硬完成定义为 `not coverage["gaps"]`，富集完成定义为硬完成且 `enrichment_gaps` 为空。最终终态应使用 `completion_satisfied()`，而运行中提前停止仍可使用 `enrichment_satisfied()`。
- 建筑研究也受同一个最终 `enrichment_satisfied()` 终态门槛影响：即使全部子问题覆盖，只要案例数量、多图项目或已核验数量未达富集目标，仍会进入 partial。用户要求两类一起修，最终 completed 条件必须统一改为硬覆盖完成。
- 图纸真实预算耗尽在循环 565–567 行已有准确检测；最终 1833–1835 行的“富集帖子不足即覆写为视觉预算耗尽”应移除或改成只依据 `inspection_budget.exhausted`。
- 现有测试中已经有两个可直接改成红测的真实边界：建筑 quick Run 全部 3 个子问题覆盖但仍有 enrichment gaps，目前断言 `partial`；图纸 Run 全方向覆盖、`gaps=[]` 且视觉调用仅 20，目前也断言 `partial/visual_budget_exhausted`。
- 同时已有真实视觉额度预占测试：把 `visual_calls_used` 预设为固定上限后，要求不再搜索并返回 `visual_budget_exhausted`。提高上限后应改用常量值，继续证明“真实耗尽”路径不被破坏。
- Board 已有真实视觉耗尽文案测试，但当前文案只描述“图纸数量上限”，无法覆盖字节额度耗尽；更准确的用户文案应描述“图纸检查预算/额度已用完”。
- 预算 schema 测试逐字段固定全部模式，适合作为提高预算的红测；无需新增运行时配置或新抽象。
- `build_queries()` 生成 `max_rounds × 子问题数` 后再由 `max_queries` 截断，因此只增加 `max_queries` 可能没有实际效果。建筑检索预算应同步增加 completion recovery rounds，才能保证真实多出一轮补查。
- 为保持小幅增幅，拟定建筑预算：基础 max_queries 约 +25%，completion recovery rounds `4→5`，全局页面与时间约 +20%–25%；不提高普通 max_rounds，避免 quick/balanced 因整数跳变直接增加 33%–50%。
- 图纸测试已有“每方向仅一/两篇可用帖子但全部方向已覆盖”的稳定夹具，适合把旧 partial 断言改为 completed；另保留预占满视觉槽位的真实耗尽测试作为反例。
- Board 已预留 `completed + enrichment_gaps` 的正确展示：建筑为“已完成 · 案例不足”，图纸为“已完成 · 图纸较少”，并有解释文案。因此后端改为硬覆盖完成不会丢失富集不足提示，反而正好启用既有 UI 合同。
- 第一条图纸夹具每方向检查 2 篇、其中每方向只有 1 篇通过，但覆盖与现有总量富集均满足；第二条夹具最终方向不足 3 篇且只使用 20 次视觉调用。两者都未真实耗尽视觉额度，均应 completed。
- Board 的完整测试命令为 `pnpm test`，生产构建会同时执行 TypeScript project build 与 Vite build；API 继续使用项目 `.venv` 的 pytest、Ruff 与 strict Mypy。当前版本字段的既有工作树状态不属于 Phase 35，不在本轮调整。
- 完整 API 首轮 20 个失败均来自合同变化：XHS 来源池 `8→10`、视觉调用上限 `quick 12→15`/图纸 `48→60`、补查轮次增加，以及 enrichment-only Run 从 partial 改为 completed。尚未发现与新实现无关的新异常。
- 隔离现场仍使用 `.artifacts/qa/live_xiaohongshu_harness.py`：MockResearchProvider + MockVisualClassifier、SQLite 隔离库、本地 data 目录、真实 Chrome broker；正式端口 9872 未监听。
- 当前 Board 15172 由 PID 39772 正常监听；隔离 API 18072 为旧 PID 49136，健康 `ok/mock`，但扩展桥当前 `connected=false`。现场验收前必须精确重启该 API 加载新源码，再通过既有 Board `?connect=chrome` 恢复连接。
- Phase 35 隔离 API 已由 PID 43784 加载新源码并保持 `ok/mock`；Board 15172 仍由 PID 39772 监听，正式端口 9872 未监听。当前唯一外部阻塞是系统 Chrome 未运行，因此 ArchResearch 扩展桥为 `connected=false`。
- Chrome 只读诊断确认 Google Chrome 安装于 `C:\Program Files\Google\Chrome\Application\chrome.exe`；ChatGPT 浏览器扩展已安装并启用，native-host manifest 与注册表均正确。无需修复或重装浏览器插件，只需在用户授权后启动 Chrome 并恢复既有 Board 连接。
- Phase 35 首条建筑 Run `2669dd7d-1a99-4adf-ac02-244e700ed8c1` 使用新 balanced 预算 `15 queries / 5 recovery rounds / 4 pages / 48 pages / 4320s`，生成 12 条结果并覆盖 4/4 子问题，但终态为 `blocked/browser_inspection_incomplete`。
- Trace 与 QA browser events 精确显示 12 个正式 Mock 来源均为 `https://research.example/...`，在 `BrowserBroker._require_public_resolution()` 中因无法解析而抛出 `BrowserNavigationError`；这是隔离 fixture 与真实已连接 Chrome 的冲突，不是预算、完成状态或扩展协议回归。
- Phase 34 成功时扩展桥不可用，Mock 假页未进入真实导航，因此没有暴露该 harness 缺陷。Phase 35 需要同时保持 XHS 真实桥连接，隔离 harness 必须把 Mock 来源映射到可公开解析的安全测试页，不能放宽产品的公网地址安全策略。
- 修正 QA 假域名后的建筑 Run `9bc42dff-7d45-4fa3-857c-e789fed6b6cb` 虽为 `completed/coverage_satisfied`，但 Trace 含 4 次 `xiaohongshu_search`，17 个结果中 12 个来自 Mock 建筑来源、5 个来自 XHS，因此该 Run 被用户准确指出并判定作废。
- 根因有两层：手动 API 验收请求省略了 `research_sources`；`ResearchSpec` 默认又错误设为 `[ResearchSource.xiaohongshu]`。Board 的真实创建路径已经按 goal 分流：建筑显式发送 `[]`，图纸显式发送 `[xiaohongshu]`。
- 为防止 CLI、第三方调用或未来测试再次误触发，API schema 默认来源也应改为空；图纸 XHS-only 继续由调用端显式选择和现有 fail-closed workflow 保证，不把小红书重新设成全局默认。
- schema 红测准确失败：旧实现把默认 `ResearchSpec.research_sources` 返回为 `[xiaohongshu]`。生产修复仅将该字段的 `default_factory` 改为 `list`；显式 `[xiaohongshu]`、显式 `[]` 和拒绝已移除平台的合同保持不变。
- API 集成测试现进一步锁定：省略来源创建建筑 Run 时，响应与数据库中的 `research_sources` 必须为 `[]`。Board 仍按 goal 显式传值，因此图纸 XHS-only 行为不受影响。
- 旧 workflow 的交叉点不只在 schema：它直接从数据库读取 `run.research_sources`，只要含 XHS 就创建搜索器；因此历史建筑 Run、重试或直接写库仍会进入小红书。Provider 若返回 XHS URL，统一 `_constrain_sparse_visual_platform_result()` 还会把它降级为 visual lead 后继续持久化。
- 最小安全分离不复制整个 workflow，而是在目标入口归一化来源，并在 Provider 结果持久化前按 goal 过滤：建筑彻底移除 XHS，图纸原有 XHS-only 分支不改。这样每个改动都可由独立行为测试追踪。
- 两条 workflow 红测准确失败：旧建筑 Run 的遗留 XHS 标记触发了 3 次搜索；Provider 混入的 3 个 XHS 资产全部被持久化。证明交叉影响是真实执行路径，不只是请求层问题。
- 最小实现现只对 `precedent_research` 生效：运行入口将来源归一为空；公共搜索候选和 Provider 结果在持久化前过滤 XHS。`visual_reference_search` 的 XHS searcher、帖子下载、分类与预算代码未改。
- 定向 5/5 已通过，包含建筑遗留标记、建筑 Provider 混入、API/schema 路由，以及既有图纸 XHS-only 完整流程；后者仍断言 Provider 搜索次数为 0。
- 首次全量回归的 2 个失败进一步暴露测试层历史耦合：`test_workflow_uses_opencli_xiaohongshu_multi_image_path_without_extension` 和原“模型超时后继续 XHS”测试都没有设置 visual goal，却要求建筑路径使用 XHS。
- 两个测试现已归位到 `visual_reference_search`：OpenCLI 多图使用图纸专用来源池上限；浏览器回退明确断言建筑 Provider 查询为 0。失败 OpenCLI 搜索器只尝试一次后被移出来源链，后续 3 个方向由 Chrome XHS 搜索完成，这是既有容错合同。
- 第二轮完整 API 门禁 585/585 通过；Ruff、55 文件 format、strict Mypy 和 `git diff --check` 全绿。路径分离没有引入新的数据库、证据链、视觉分类或状态回归。
- 分离后建筑现场 Run `71b77948-d3cf-4665-b344-70d5bf063858` 为 `completed/coverage_satisfied`：12 个结果、4 个项目、4/4 子问题、`gaps=[]`、`enrichment_gaps=[]`，balanced 新预算字段全部正确。
- 建筑 Trace 35 个事件中 `xiaohongshu_search=0`、`xiaohongshu_assets=0`；12 次公开页面浏览全部 completed、0 skipped。Results 12/12 有 facts 和 EvidenceClaims，XHS 来源数为 0。
- Board 实际渲染通过：4 个子问题章节、4 个案例、4 个来源，结果区域无“小红书”文案、无 alert、无页面错误或本地响应错误；截图人工查看布局与内容完整。
- 图纸现场 Run `3fa69853-1b6a-41be-b9fa-7fca388fa4f4` 严格使用 `[xiaohongshu]`，Trace 中 Mock Provider 明确 skipped，没有公共网页或建筑 Provider 降级；说明路径分离没有把图纸导向建筑流程。
- 该 Run 失败于真实 Chrome 枚举：第一搜索标签连续 10 次媒体数均为 0；第二搜索标签再次为 0，随后 `enumerate_media` 与 `close_tab` 返回 `execution_failed`。终态 `blocked/no_usable_assets`，0 结果，不是预算或完成状态误判。
- 当前扩展桥仍 `connected=true`，Chrome 进程存在。尚不能区分安全验证、窗口渲染状态或内容脚本失效；必须先运行一次会识别 `verification_required` 的页面状态探针，遇验证时保留原页且不刷新。
- 唯一安全页面状态探针随后通过：`logged_in`、正确 `type=51` 搜索 URL、标题可读、无验证码/登录/空状态/网络错误信号，snapshot 1 块/280 字符，媒体枚举 11 张。失败 Run 属于扩展命令的瞬时执行异常，不是路径分离、登录或预算问题。

# 2026-08-07 — Phase 35 drawing retry strategy root cause

- 第二条图纸 XHS-only Run `3bc25c99-604f-4329-a66b-5ff02be9cbfb` 已从当前隔离 API 只读复核：`partial/time_budget_exhausted`，3 个结果、3 个项目，只覆盖 `rendered_style` 与 `diagrammatic_style`，`linework_style`、`collage_style` 仍缺失。
- Run 从 14:56:22 到 14:57:53，实际约 91 秒；balanced `max_seconds=4320`。Trace 最终仅使用 10 次视觉检查、约 1,771,921 bytes，明显未耗尽图纸视觉调用/字节预算。
- Trace 显示四个方向各完成一次 XHS 搜索，每次 8 个来源、保留 5 个候选；Mock Provider 每轮均为 `skipped/selected_xiaohongshu_note`，没有公共网页或建筑 Provider 降级。
- 源码交叉点位于统一搜索循环：`xiaohongshu_searched_subquestions` 是集合，`can_search_xiaohongshu` 要求方向不在集合中，首次搜索后立即加入。四个方向均进入集合后，XHS-only 又令 `can_search_publicly=false`、`can_search_with_model=false`。
- 当三种搜索能力都为 false 时，统一分支只为建筑区分 `query_budget_exhausted`，其余情况直接写 `time_budget_exhausted`。因此图纸的停止原因是“策略没有后续动作”，并非时间真实耗尽。
- 用户要求旧代码也分开。安全的最小方向不是复制整个 workflow，而是把 goal-specific 搜索资格、补查次数和无分支停止原因分成明确策略；共享的数据库、Trace、预算计数、证据持久化和浏览器协议可以继续复用。
- 图纸后续补查仍必须受 `max_queries`、正常/恢复轮次、页面、视觉调用、字节和真实时间预算约束；建筑路径继续保持 XHS 调用为 0。
- `build_queries()` 已经为图纸按 `max_rounds` 生成每轮每方向一条查询；当前 balanced 是 3 轮、最多 15 条，现场 Trace 只执行了首轮 4 条。无需再提高或另造查询预算，只需解除旧集合对后续轮次的错误封锁。
- `QueryAttempt` 和 `completed_query_keys_for_resume()` 已按 `(round_number, subquestion_id)` 提供持久化去重与恢复语义。因此图纸不需要 `xiaohongshu_searched_subquestions` 这种仅按方向去重的第二套状态；它既重复又丢失轮次信息。
- 为优先补齐覆盖，图纸可复用“覆盖未完成时跳过已覆盖方向”的选择规则；建筑仍保留自己的 completion continuation 行为。覆盖补齐后，剩余轮次才用于富集，不会让已覆盖方向挤占缺口方向的补查机会。
- 最小策略分离已实现：建筑 goal 明确令 `can_search_xiaohongshu=false`；图纸 goal 明确令公共搜索和模型搜索为 false，并只依据 XHS 可用性及自身页面/视觉/时间预算决定是否继续。
- 图纸查询不再维护仅按方向去重的集合，直接使用现有 `(round_number, subquestion_id)` QueryAttempt 合同；第 2 轮补查词追加“作品集”，后续轮次使用构图细节/版式参考/表达教程，首轮精确查询合同保持不变。
- 新行为测试旧实现准确失败、修复后通过：搜索顺序为 `linework/collage/rendered/collage`，第 2 次 collage 查询与首轮不同且以“作品集”结尾；建筑 Provider 搜索为 0，最终 3/3 覆盖 completed。
- 11 项定向回归通过：建筑遗留 XHS 标记与 Provider 混入过滤、真实时间耗尽、图纸首轮查询纯净性、后续补查、完整覆盖、真实视觉耗尽，以及 XHS-only 失败不降级到公共/模型搜索。
- 首次 API 全量 579/585，通过之外有 6 个失败；没有数据库、证据或生产异常。4 个来自 `test_board_exports` 的 helper 把 visual goal 与 `research_sources=[]` 绑定，1 个公共网页 remote visual test 也把 visual goal 当普通网页路径，均属于旧测试耦合。
- 导出测试的目标是验证 Board/HTML，不应重新运行某种检索后端。正确做法是先用确定性建筑路径生成本地结果，再在测试夹具中把 Run 标记为 visual board；这样导出合同与研究来源策略互不依赖。
- `test_local_browser_remote_visual_batch_classifies_untyped_images_once_per_run` 实际验证公共项目页图片批分类，应保留默认 `precedent_research`，不应为了调用普通网页而设置 visual goal。
- XHS 浏览器回退测试实际得到 quick 两轮 × 3 方向 = 6 次搜索，OpenCLI 仍只失败 1 次且 Provider 为 0；旧 3 次断言正是已删除的“每方向只搜一次”行为。
- 导出 4 项和 XHS 两轮回退项已转绿。剩余公共网页批分类测试在可信项目页上已经正确调用分类器一次，但建筑路径会把该远程图记为 `partial/trusted_secondary/probable project/confirmed asset association`，而不是 visual goal 下的 `visual_lead/unknown`。
- 相邻 `test_precedent_remote_visual_batch_does_not_spend_on_an_unknown_page` 继续锁定未知来源不得花视觉预算，因此不能把来源降回 unknown 来保留旧断言。
- 六个旧测试失败均已按真实边界修正并转绿。第二次 API 全量 586/586 通过；Ruff check、55 文件 format check、strict Mypy 26 个源文件和 `git diff --check` 全部通过。
- 导出测试现在显式把“结果准备”和“图纸灵感板导出”解耦；公共网页 remote visual 测试锁定建筑可信来源的 `partial` 证据合同；未知来源不分类测试保持不变。
- 现场服务盘点：Board `15172` 为 PID 39772 的 Vite；隔离 API `18072` 为 PID 48840 的 `live_xiaohongshu_harness:app`；`/health=ok/mock`，扩展桥 `connected=true`、XHS search available。正式 `9872` 未监听。
- QA harness 依赖 `ARCHRESEARCH_LIVE_DATA_DIR` 与 `ARCHRESEARCH_LIVE_DATABASE_PATH` 环境变量；重启前需从现有隔离目录和 Run 数据精确确认路径，不能凭记忆猜测。
- QA API 已使用项目 venv 和原隔离数据库/数据目录重启健康；重启时数据库活动 Run 为 0，正式 9872 未监听。
- ChatGPT Chrome 控制通道不可用，但 ArchResearch 自身 `POST /v1/browser/open-chrome` 单次返回 opened=true，随后项目扩展桥恢复 `connected=true`、XHS search available；没有循环开 Board。
- 现场建筑 Run `178890fd-80e6-45fc-955b-99a801d3a23b` 已真实通过：`completed/coverage_satisfied`，12 个结果、4 个项目、4/4 子问题；12/12 有 facts 与 EvidenceClaims，XHS search events=0、XHS results=0，公开页面检查 12 completed/0 skipped。
- 现场图纸 Run `cb66cf77-a426-4a97-ae18-1f60838d60e7` 已自然完成为 `completed/coverage_satisfied`：6 个结果、6 个帖子、4/4 方向、无 gaps。Trace 为 3 轮共 12 次 XHS 搜索，公共网页 0，Mock Provider 全部 skipped；视觉仅 8 calls/1,265,555 bytes。
- 图纸逐张验收 Rank 0–1：Rank 0 混入大幅建筑照片和巨型营销标题，虽下半有完整淡彩剖面仍判不合格；Rank 1 为清晰完整功能分区剖面图，无网页 UI/遮罩，匹配 diagrammatic_style，判合格。
- 图纸逐张验收 Rank 2–3：Rank 2 是灰模/绿色线稿风格转换对照，无网页 UI 或错误裁切，但作为 collage_style 匹配度偏弱，暂记方向存疑；Rank 3 为完整红灰低饱和剖面拼贴，线稿与环境底图清楚，无遮罩/错误裁切，判合格。
- Rank 4 为两组完整的功能/关系剖面分析图，配色和信息层级清楚，无网页 UI、遮罩或错误裁切；底部来源声明不影响图纸主体，判定合格。
- Rank 5 为完整的低饱和材质剖面，人物、植物、砖材和结构表达清晰，无网页 UI、正文评论或错误裁切，判定合格。
- 用户要求把既有代码也物理分开。当前主执行循环仍曾同时承载两类目标；本轮新增 `research_paths/precedent.py` 与 `research_paths/drawing.py`，把来源许可、补查轮次、搜索能力、查询文本、终态规则和图纸类型过滤迁出，数据库/证据/checkpoint/持久化骨架继续共享。
- 新图纸 Run `bb20e775-6a03-4c6d-a6dd-165692e602e4` Rank 0 仍为“建筑照片 + 巨型营销标题 + 下方剖面图”的复合封面，图纸主体占比不足，判不合格；Rank 1 为完整但属于外立面效果图/照片的宽幅渲染，带原帖水印，不是图纸研究素材，亦判不合格。现有“按 asset_type=section 过滤”不足以保证内容质量。
- 同一 Run Rank 2 为两组完整的功能/空间关系剖面分析图，信息编码清晰、无网页 UI/遮罩/错误裁切，判合格；Rank 3 为完整的灰模剖面与绿色线稿表达对照，主体完整且可用于表达风格研究，虽有原帖“我给ai的/ai给我的”标题，仍判合格。
- 同一 Run Rank 4 是线稿剖面局部，右侧主体和构造说明被截断，不能作为完整图纸研究结果，判不合格；Rank 5 上下各有一张线稿剖面，但中部被巨型“5步丰富线稿风剖面图”宣传标题占据，图纸主体占比不足，按复合封面标准判不合格。
- 同一 Run Rank 6 包含三张完整的功能/关系剖面与空间程序分析图，虽留白较多并带来源声明，但图纸主体清楚完整，判合格；Rank 7 为四宫格完整剖面拼贴，色彩、线型、材质和构图差异明确，无网页 UI/错误裁切，判合格。
- 同一 Run Rank 8 是完整的总平面/剖面表达，主体清晰、无网页 UI，但被归入 `rendered_style` 时方向不匹配，严格验收判不合格；Rank 9 为完整的构造剖面与节点细节线稿，表达清楚、无错误裁切，符合 `linework_style`，判合格。
- 同一 Run Rank 10 是完整的景观/雨水策略拼贴，但中部有巨型“拼贴剖面技巧”宣传标题，且主体偏效果图与景观展示，不符合严格 `collage_style` 图纸研究标准，判不合格。
- 本次 11 张 PNG 严格人工验收暂为 5/11 合格（Rank 2、3、6、7、9）；问题已从路径分流收敛到视觉质量门禁：仅依据 classifier 的 `asset_type=section` 仍会放过照片、复合封面、巨型标题、方向错配和局部裁切。

# 2026-08-07 — goal-specific execution split red test

- 只读审计确认 `research_paths/precedent.py` 与 `drawing.py` 目前只是策略模块；真正的搜索、候选处理、页面/图纸检视仍位于 `workflow.py` 的同一 `execute_research_run` 大循环。
- 新增结构红测 `test_search_and_inspection_execution_is_split_into_goal_specific_runners`，要求存在独立 `precedent_runner.py` 与 `drawing_runner.py`，建筑 runner 不含小红书路径，图纸 runner 不含公共检索/建筑 Provider，workflow 入口只做两条 runner 的分发。
- 红测按预期失败：两个 runner 文件尚不存在；这确认当前物理拆分仍未完成，未修改现场服务或研究数据。
- 首次 runner 回归发现旧的 OpenCLI 图纸测试夹具使用了被新质量门禁识别为照片/高方差素材的合成 PNG，导致 `quality_rejected_count=1`；将该测试夹具改为现有的低方差线稿合成图，未放宽生产质量门禁。
- runner 分流后的建筑/图纸核心回归已转绿：路径分离测试 7/7、workflow 53/53、browser inspection 168/168、XHS 相关 24/24。

# 2026-08-08 — Phase 35 isolated end-to-end verification

- QA API 已用项目 venv 从最新工作树重启在 `18072`，Board 以 `15172` 运行并代理到该 API；`/health=ok/mock`、扩展桥 `connected=true`、`xiaohongshu_search_available=true`，正式 `9872` 未监听。
- 建筑 Run `18c6edd1-3361-4e66-9869-c6305c3d759d` 由 Board 真实创建并自然完成为 `completed/coverage_satisfied`：12 个结果、4 个项目、4/4 子问题覆盖，`gaps=[]`、`enrichment_gaps=[]`；12/12 有 facts 和 EvidenceClaims，公开页面检查 12/12 completed。
- 建筑 Run 的 35 条 Trace 中 `xiaohongshu` 相关事件为 0，结果中的小红书 URL 为 0；Board 真实渲染 4 个案例、4 个来源，无小红书文案。建筑路径端到端通过。
- 小红书会话只读检测返回 `logged_in/chrome_extension`；未读取 Cookie、账号、密码或 API Key。
- 图纸 Run `f09b3e6c-695a-4076-9d9a-81e501b81c00` 由 Board 真实创建，严格走 `visual_reference_search`，Trace 共执行 6 次 `xiaohongshu_search`；公共页面与 Mock Provider 均 skipped，路径隔离成立。
- 该图纸 Run 自然终止为 `blocked/no_usable_assets`：6 次 XHS 搜索均 `result_count=0`，搜索标签均成功打开并等待/滚动，但媒体枚举始终为 0，结果数和 PNG 数均为 0。Board 显示“研究尚未完成，暂未找到可用图纸”。
- 当前工作区扩展源 `manifest.json`/`package.json` 仍为 `2.2.8`；桌面另有 `v2.2.10` candidate ZIP。只读证据不能直接证明 Chrome 当前加载的扩展版本，但“桥已连接、登录检测成功、搜索页媒体始终为 0”与未加载最新候选扩展的现象一致。
- 本次未修改生产代码、未重试图纸 Run、未触碰正式端口、未发布版本。唯一下一步是先在 Chrome 加载/重载 `v2.2.10-phase33-windowfocus-candidate.zip`，再只创建一条新的图纸 Run；若仍为 0，再进入扩展命令层修复。

# 2026-08-08 — v2.2.10 release preparation

- 用户已明确要求先发布 `v2.2.10`，再以发布版扩展复验图纸灵感；因此当前 `blocked/no_usable_assets` 现场 Run 作为已知隔离环境证据保留，不重复创建。
- 远端 `main` 当前为 v2.2.9，`gh` 已认证，远端不存在 v2.2.10 tag/release。当前工作树的产品修复范围与测试/发布合同均保留，交接计划和 QA/竞赛资料不进入提交。
- 版本红测先准确拦截旧 CI artifact 名，随后 API/Board/Extension/manifest、CI artifact、README、Chrome 安装说明、架构附件名和 Release 测试同步为 v2.2.10 并转绿。
- 首次完整门禁在 API 594/594 后只因版本同步造成的两个 Python 文件格式检查失败；Ruff 机械格式化后重跑全量门禁通过，Board/Extension 和 packaged E2E 也全绿。
- 扩展 ZIP 为 20,459 bytes、SHA-256 `9A8EEB5D18B47742040F48706DA5264572944504E4C73D31253E3CC5EDDCDB6E`，11 entries、manifest `2.2.10`；Windows 安装器为 69,759,127 bytes、SHA-256 `5C1D73C36F296AB0C284084F3CF851A9D2A5B93C38B52D4681BCD970598787B5`。真实安装/启动/卸载 smoke 通过。
- PR #22 已 squash 合并，主线提交为 `a2ff995bfed696980df61962ca592f2a2b56d5d6`；主线 CI run `31245075246` 成功。
- 已创建并推送 annotated tag `v2.2.10`，正式 Release 非草稿、非预发布；发布附件来自主线 CI，而非本地候选包：扩展 ZIP 20,438 bytes / SHA-256 `3ADD848F3A094410B2C2295B5F5CA88B6FD924C9F64F4F00CB6763DB0F1C7624`，Windows 安装器 70,255,649 bytes / SHA-256 `B01936155FC6692CABD0124DB9FDB97137DCE34D4A31BEEC425E5D868466AE7F`。
- 发布前图纸 Run `f09b3e6c-695a-4076-9d9a-81e501b81c00` 仍保留为 `blocked/no_usable_assets` 证据，不重试、不取消；下一步必须用正式 `v2.2.10` 扩展只创建一条新图纸现场 Run。

# 2026-08-08 — thread handoff closeout

- GitHub Release `v2.2.10` 的说明已改为真正的多行 Markdown，已通过 `gh api ... --jq .body` 复核；没有重新上传附件或改变 tag。
- 产品代码提交、PR 合并、主线 CI、tag、Release 和附件核验均已完成；当前不需要再提交产品代码。
- 本地交接文件、`.artifacts/ci/` 和 `.planning/submission-pack-2026-08-06/` 仅用于恢复上下文和保存证据，下一线程继续保留，不纳入产品提交。
- 下一线程从正式 `v2.2.10` 扩展加载确认开始；图纸失败 Run 不重试，新的现场 Run 最多只创建一条。

# 2026-08-08 — installed release verification

- 验收目标已明确为用户实际安装版，不使用 QA `18072` 作为结论来源。运行进程路径为 `C:\Users\76384\AppData\Local\Programs\ArchResearch\ArchResearch.exe`，安装版 `/desktop-health` 返回版本 `2.2.10`、端口 `9325`；`/health` 返回 `ok`，Provider 为 OpenAI-compatible，模型为 `gpt-5.6-sol`。
- 安装版 Run `d1c0f6f9-1933-47a2-a0df-08e00c3eb836` 的 12 次 XHS 搜索均完成并各返回 8 个候选；20 个 `browser` 检视事件全部为 `skipped`，错误类型均为 `ValidationError`。最终 `blocked/no_usable_assets`，`usable_assets=0`、覆盖 `0/4`、无 PNG。
- 安装版登录态探针返回 `logged_in/chrome_extension`，说明安装版桥的连接、打开页面、等待、会话状态链路可用；结合 Run 的搜索成功，`OpenPageResult` 和 `PageMetadata` 不是当前首要嫌疑，剩余重点是 `MediaEnumeration` 校验或活动扩展实例版本/来源。
- 桌面正式扩展目录与主线 CI `v2.2.10` ZIP 逐文件比较为 11/11 匹配，ZIP SHA-256 `3ADD848F3A094410B2C2295B5F5CA88B6FD924C9F64F4F00CB6763DB0F1C7624`。浏览器控制策略阻止直接访问 `chrome://extensions`，不能用绕过方式确认活动扩展路径；一次 XHS DOM 探针超时，未重复。
- 未修改生产代码、未重试或取消已有 Run、未读取 Cookie/账号/密码/API Key。下一步只做安装版协议层只读诊断；若需要暴露具体 Pydantic 字段，先写红测并等待明确进入修复阶段。

# 2026-08-08 — sanitized browser validation diagnostics

- 红测证明现有 Trace 仅保存 `error_type=ValidationError`，无法区分 `OpenPageResult`、`PageMetadata`、`MediaEnumeration` 或其他协议模型。
- Pydantic `ValidationError.errors(include_input=False, include_url=False)` 可以安全取得首个错误的模型标题、`loc` 和稳定错误类别，而不序列化非法输入；测试确认注入值 `private-page-value` 不进入 Trace。
- 当前实现仅在浏览器检视异常捕获点附加三个字段：`validation_model`、`validation_path`、`validation_error`。没有记录异常消息、上下文、页面正文、媒体 URL 或扩展响应原文。
- 定向红测、完整浏览器检视回归、API 全量、Ruff、格式、strict Mypy 和 diff check 均通过。要取得安装现场的真实字段，必须先让实际安装版加载该补丁；QA 服务不能替代安装版结论。

# 2026-08-08 — installed protocol root cause

- 诊断安装版 Run `99670d73-73fd-4e5a-8d80-c3ff4818cdd2` 产生 15 个浏览器跳过事件；白名单摘要一致为 `BrowserCommand` / `action` / `literal_error`，不是媒体响应模型校验。

## 2026-08-08 — installed retry exposed XHS detail-path validation bug

- 协议修复安装版对同一 Run 的唯一 retry 产生 Trace 序号 59–116；15 个 browser 事件中 `BrowserCommand.action/literal_error` 已为 0，证明动作枚举补齐已在实际安装进程生效。
- 15/15 browser 事件改为 `BrowserCommand` 根级 `value_error`，15 个 `source_url` 均为真实小红书详情形态 `https://www.xiaohongshu.com/search_result/<note-id>`。
- 新增的 `_is_safe_xiaohongshu_url()` 对 `path_prefix == "/search_result"` 无条件要求路径完全等于 `/search_result`。该规则适合搜索页 `search_url`，但也被复用于详情 `note_url`，导致已列入批准前缀的 `/search_result/<note-id>` 永远无法通过。
- 下一修复应继续保持搜索页仅允许精确 `/search_result`，同时只对批准的详情前缀允许非空详情 ID；不得放宽主机、HTTPS、凭据、任意导航、selector、脚本或表单边界。
- API 红绿修复现已按扩展既有协议语义拆开搜索页与详情页校验；API 全量和静态门禁通过，实际安装 EXE 与该源码构建哈希一致。
- 产品安装版没有暴露可直接发送 `open_xiaohongshu_note` 的 QA 路由；`/qa/xiaohongshu-page-state` 只存在于 `.artifacts/qa/live_xiaohongshu_harness.py`。使用该隔离 harness 不能作为实际安装版验收证据。
- 因目标 Run 已按约束只 retry 一次且没有创建第三条 Run，当前可证明“安装版已包含修复、健康、桥连接、登录态正常”，但不能在不增加 Run/attempt 的前提下再次触发真实详情打开与媒体枚举链。

## 2026-08-08 — extension safe note-link matching fix

- 按 Trace 中的真实 `/search_result/<note-id>` 形态新增内容脚本红测：搜索卡片链接带 `?xsec_token=visible`，命令目标为同一路径无查询参数；旧实现准确返回 `{opened: false}`。
- 最小修复让候选链接先通过既有 `isSafeXiaohongshuNoteUrl` 白名单，再比较同源 `origin + pathname`，忽略查询参数和尾部斜杠；没有增加跨域、任意导航、selector、脚本、表单、凭据或存储能力。
- Extension 全量 215/215、ESLint、TypeScript typecheck、production build、packaged E2E 8/8 全部通过。
- 候选独立扩展 ZIP：`.artifacts/qa/phase35-extension-note-link-fix/archresearch-chrome-extension-only-v2.2.10.zip`，SHA-256 `9CB91FCFF8DD04B41C8FF676006482790DF1031D1A272EADDDA29CC319F6D455`。
- 候选 ZIP 尚未加载到用户 Chrome；当前安装版服务仍运行，但不得把未加载候选的安装版或既有 Run 当作该扩展修复的现场验收证据。

## 2026-08-08 — installed attempt 2 final trace

- 用户完成安全验证后，安装版唯一一次状态确认返回 `logged_in/chrome_extension`；未刷新、重复开页、读取 Cookie/账号/密码或浏览器存储。
- 同一 Run 的 `attempt=2` 自然终止为 `blocked/no_usable_assets`。Trace 序号 117–148 中，API `BrowserCommand` 校验错误为 0；首轮搜索返回 8 个候选并保留 5 个，但 5 个详情打开均为扩展 `BrowserCommandError`，没有进入页面元数据、媒体枚举或 PNG 结果。
- 现有扩展详情打开实现会在受管搜索页中按完整 `candidate.href === target.href` 查找目标链接；当前 Trace 只能安全记录 `BrowserCommandError` 类型，不能证明具体是链接未匹配、页面时序或验证页，因此不继续猜测或擅自修改扩展。
- `XiaohongshuBrowserSearch.open_note()` 通过 `BrowserCommandClient` 发出 `open_xiaohongshu_note`，扩展 `protocol.ts` 与 `browser-command-executor.ts` 已支持该固定动作及 `search_url`/`note_url` 白名单；API `browser.py` 遗漏了对应 `BrowserAction` 字面量和 Pydantic payload adapter。
- 最小修复只补 API 协议枚举和 HTTPS 小红书 URL 校验；没有恢复通用导航、任意 selector、脚本执行或凭据能力。
- 协议红测先红后绿；API 全量、`test_browser_ws.py`/`test_xiaohongshu.py` 回归、Ruff、format、strict Mypy 和 `git diff --check` 均通过。
- 安装版验证尚未完成：当前安装目录仍是只含诊断字段、不含协议修复的构建；必须先覆盖安装，再对同一诊断 Run retry 一次。

## 2026-08-08 — installed final XHS-only run created

- 用户明确授权创建一次新的安装版现场 Run；创建前工作区活动 Run=0，安装版 `/health` 正常。
- 新 Run `0633b2a4-b76a-458d-bf00-6beab6a19458` 使用 `visual_reference_search`、`quick`、`research_sources=[xiaohongshu]`，未复用或 retry 旧 Run。
- Run 已从 `created` 进入 `inspecting`，规划出 `technical_linework`、`collage_color`、`atmospheric_render` 三个方向。当前尚无终态或结果，继续自然轮询。

## 2026-08-08 — installed final XHS-only run blocked

- Run `0633b2a4-b76a-458d-bf00-6beab6a19458` 自然终止为 `blocked/no_usable_assets`，没有结果或 PNG；搜索方向通过计数为 2、2、1，但 `usable_assets=0`。
- 58 条 Trace 中包含 5 次 XHS 搜索、20 次搜索/流程事件和 15 次 `browser` 检视；15/15 均为 `skipped / BrowserCommandError`，没有 `validation_model`，说明不是安装版 BrowserCommand Pydantic 校验错误。
- 详情执行失败发生在扩展命令层，未进入详情页元数据、媒体枚举或视觉分类。不得继续创建或 retry Run；下一步只能做扩展详情命令的只读定位或先取得新的修复授权。

## 2026-08-08 — canonical detail path diagnosis and fix

- 15 个 `BrowserCommandError` 详情事件之间约 8 秒；扩展执行器的 `waitForXiaohongshuNote()` 会在点击后等待 URL 到达，因此失败形态指向 canonical route mismatch，而非 API payload 校验。
- 新增红测使用目标 `https://www.xiaohongshu.com/search_result/note-42`、实际 `https://www.xiaohongshu.com/explore/note-42?xsec_token=visible`；旧执行器准确在 5,012 ms 超时。
- 生产修复提取受批准详情路径的 note ID，要求实际 URL 与目标 URL 同源且 ID 相同；查询参数和三个批准前缀之间的合法 canonical 切换均可接受，其他路径仍拒绝。
- Extension 全量 `216/216`、ESLint、typecheck、build、packaged E2E `8/8` 全绿。
- 新 ZIP 为 `.artifacts/qa/phase35-extension-canonical-note-path-fix/archresearch-chrome-extension-only-v2.2.10.zip`，SHA-256 `59B625E44296E4F6356E6F4F24D941FEBCAC485B542F42F6EC9C96A7F2D211B4`。尚未加载，不能作为实际安装版现场验收；不得创建新 Run。

## 2026-08-08 — canonical candidate loaded and new run authorized

- 用户重载候选后，安装版 `7016` 一次正确 session POST 返回 `logged_in/chrome_extension`；扩展桥和登录态正常。
- 初次 GET 404 只是方法误用，未触发浏览器命令。用户随后明确授权一条新 Run。
- 创建前活动 Run=0；新 Run `e41c3560-ead1-42e4-8960-f3791abdd42d` 使用 quick XHS-only，现已进入 `inspecting`，未出现 `verification_required`。

## 2026-08-08 — canonical candidate field run reached terminal state

- 安装版 Run `e41c3560-ead1-42e4-8960-f3791abdd42d` 已自然完成为 `completed/coverage_satisfied`，`attempt=0`；覆盖报告为 18 个可用资产、9 个来源项目、3/3 方向，`gaps=[]`、`enrichment_gaps=[]`。
- Events 共 37 条，最终序号 37；最后一个详情检视为 `completed`，累计 `visual_calls_used=28`、`preview_bytes_used=5,082,606`。Run 未取消、未 retry，也未创建并行 Run。
- Results API 当前返回 20 条记录，与覆盖报告的 18 个可用资产存在 2 条差异；在解释结果类型并逐张检查本地 PNG 前，不能仅凭完成状态结束 Phase 35。
- 完整 Trace 为 10 次 browser 详情检视，10/10 均 `completed`；`BrowserCommandError=0`、Pydantic 校验错误=0、`verification_required=0`。3 条 `openai/skipped` 的原因均为 `selected_xiaohongshu_note`，属于 XHS-only 预期分流。
- 10 次详情事件的 `added` 合计 18，3 个方向各新增 6；质量门禁拒绝 3 个候选。最终累计 28 次视觉调用、5,082,606 bytes 预览。
- 安装版实际数据目录由 `installed_data_dir()` 固定为 `%LOCALAPPDATA%\ArchResearch\data`；当前进程 PID 46888 的路径仍是正式安装目录，端口 7016。Results 本地内容通过 `/v1/results/{asset_id}/content` 只读返回 `data\runs` 下的 `storage_path`。
- 目标 Run 的 `candidates` 目录实际包含 20 个不同文件名的 PNG，Results 也有 20 个不同 `image_url`；因此 Results=20 不是重复序列化，18 与 20 的差异需从覆盖统计或持久化语义解释。
- 统计差异已解释：Results 返回全部 20 个持久化候选；`calculate_coverage()` 只计 `relevance >= 2` 且有图像内容的候选。Rank 0–17 共 18 条达到阈值，Rank 18–19 的 relevance=0，因此覆盖报告正确为 18。

### Visual audit — Rank 0–3

- Rank 0：完整多层建筑剖面，绿色线型、人物/植物和顶部局部节点构成清晰的氛围化图解；无网页 UI、遮罩、评论面板或 photograph，合格。
- Rank 1：上下对照的技术/绿色表现剖面，文字是图内的风格比较标题，不是网页 UI；主体完整且可用于风格参考，合格。
- Rank 2：完整的竖向技术剖面细节，材料、家具、人物和节点标注清楚；底部文字贴近原始构图边界，但未见应用侧错误裁切，合格。
- Rank 3：完整多层建筑剖面，尺寸、空间标签、结构和设备区清晰；无网页 UI、遮罩、评论面板或 photograph，合格。

### Visual audit — Rank 4–7

- Rank 4：完整低饱和拼贴剖面，地上建筑、地下停车与环境底图连续；无网页 UI、遮罩或错误裁切，合格。
- Rank 5：室内绿化、楼板和人物关系的完整构造细节剖面；虽为局部细节，但边界自然且不是应用侧裁切，合格。
- Rank 6：上部景观渲染与下部雨洪/土层剖面一体化表达，箭头和标注构成完整技术图解；不是孤立 photograph，无网页 UI，合格。
- Rank 7：完整黑白线重建筑剖面，人物、楼梯、地坪与植物衬景清楚；无 UI、遮罩或错误裁切，合格。

### Visual audit — Rank 8–11

- Rank 8：完整水彩拼贴剖面，室内、树木、人物与土层连续表达；无网页 UI、遮罩或 photograph，合格。
- Rank 9：上下两版同一剖面的线稿/绿色风格对照，标题为图内说明；主体完整，无应用 UI 或错误裁切，合格。
- Rank 10：完整紫灰技术剖面，楼梯、空间、节点和底部构造说明清楚；边缘文字属于原始版面，无应用侧裁切，合格。
- Rank 11：完整剖面排版页，虽然四周留白较大，但主体和标注清晰，不是空白轮播；无网页 UI、遮罩或 photograph，合格。

### Visual audit — Rank 12–15

- Rank 12：四宫格剖面风格对照，四个图面均完整可读；无网页 UI、遮罩、错误裁切或 photograph，合格。
- Rank 13：完整竖向构造剖面，楼层、植物、人物、地下空间和结构构件连续；无 UI 或错误裁切，合格。
- Rank 14：完整黑白线重剖面，建筑主体、人物、树木与地层清楚；无网页 UI、遮罩或 photograph，合格。
- Rank 15：完整粉灰拼贴剖面，交通、空间和结构关系连续；无网页 UI、遮罩或错误裁切，合格。

### Visual audit — Rank 16–19

- Rank 16：竖向构造剖面细节，楼层、室内植物、人物和构造连续；右侧留白来自原始版面，不是应用错误裁切，合格。
- Rank 17：黑白作品集跨页，剖面系列和一个空间透视/模型板块构成完整排版；不是孤立 photograph，无网页 UI 或遮罩，作为剖面版式参考合格。
- Rank 18：绿色剖面仅占上部，下面大段提示词正文占据近半画面；不适合作为单张剖面视觉结果，不合格。该条 relevance=0，未进入 18 个 usable assets。
- Rank 19：四页作品集拼图混合大幅外观渲染、平面、正文和少量剖面；不适合作为单张剖面风格结果，不合格。该条 relevance=0，未进入 usable assets。
- 最终逐张结论：18 个 usable assets 为 18/18 合格；20 个本地 PNG 中另外 2 个低相关候选不合格。必须确认 Board/导出不会把 relevance=0 候选展示为正式结果。
- 实际安装版 Board 首页将目标 Run 显示为“图纸灵感 · 18 张参考 · 已完成”，与 coverage 的 usable count 一致，没有把 20 个持久化候选计入首页结果数；详情页是否渲染 relevance=0 卡片仍需继续确认。
- 实际安装版 Board 详情加载完成后显示“已完成 · 18 条可用参考 · 2 条只作线索”，灵感板为 9 篇帖子、20 张灵感图；三个方向显示 6、7、7 张。两条 relevance=0 候选确实作为线索卡片渲染，但未被计入 usable。
- Board 控制台 error/warn 为 0；初次 1.2 秒快照短暂显示空态，继续等待 3 秒后结果完整水合，不是持久回归。

## 2026-08-08 — relevance=0 lead-retention contract decision

- `App.tsx` 有意保留 `visibleResults = results`，用 `pendingLeadCount = results.length - usableResultCount` 明确区分可用参考与只作线索；视觉灵感板再按帖子显示每条记录的自然语言相关度。当前 Board 行为不是本轮扩展修复引入的偶发结果。
- Git 历史确认该分层来自 2026-07-15 的 completion-first 产品合同；2026-07-26 又主动把“待核验线索”改为“只作线索”，但没有删除线索展示。
- 当前产品规范要求小红书 `visual_lead` 进入独立灵感板，帖子显示自然语言相关度、来源和权利边界；`verified/partial/visual_lead` 与 relevance 继续用于后台排序、持久化及导出边界。
- Results API 返回全部持久化候选；覆盖计算只把 `relevance >= 2` 且有图像的记录计为 usable。视觉导出不自动包含 Results，而只读取用户明确选择的 `board.selected_asset_ids`，所以展示线索不等于把它自动发布为正式结果。
- 因此 Rank 18-19 的继续显示属于批准的线索保留语义。Phase 35 的内容验收应按 18 个 usable assets 计算，结论为 18/18 合格；不需要新增 Board 过滤或生产代码改动。

## 2026-08-08 — Phase 36 screenshot baseline

- 用户截图中的建筑研究问题是“入口人车冲突时，游客、步行和后勤流线怎样重组？”。结果页显示“已交付部分结果”、6 条可用参考、2 个项目，其中 6 条已确认出处。
- Board 同时报告两个完成缺口：“仍有研究问题没有足够的可用案例”和“部分项目还没有同时说明项目条件、设计做法和可借鉴步骤”。这说明问题可能同时存在于分支覆盖与正式文章分析准入，不能只看总资产数。
- 用户明确要求面向方案前期适当放宽。初始边界是允许跨类型、相近尺度和机制类比；来源真实性、项目正文、逐字证据、建筑尺度和禁止视觉平台冒充案例的合同不放宽。

## 2026-08-08 — Phase 36 installed Run baseline

- 截图对应的实际安装版 Run 为 `3ad135af-85c2-4706-a922-2d7a1c09f616`：`precedent_research`、`balanced`、`attempt=1`，自然终止为 `partial/budget_exhausted`。问题原文是“入口人车冲突时，落客、步行和后勤流线怎样重组？”。
- 该 Run 保留 6 个 usable assets、2 个正式项目，覆盖 4 个子问题中的 3 个；`gaps=[uncovered_subquestions, article_analysis_incomplete]`，`enrichment_gaps=[insufficient_usable_assets, insufficient_project_diversity, insufficient_subquestion_assets, insufficient_multi_asset_projects]`。
- 已覆盖分支是 `arrival-interface`、`movement-sequence`、`threshold-operations`；唯一空白分支是 `time-sharing`。分支查询轮次分别为 2、1、1、8，因此空白不能归因于查询次数不足。
- 6 条正式结果只来自两个 Designboom 项目：KAAN Amsterdam courthouse 与 Snøhetta Charles Library。所有结果都有项目语境、设计机制、迁移步骤和 EvidenceClaims，但均为 `partial`、relevance 2–3；没有资产覆盖 `time-sharing`。
- Events 共 218 条：`local_browser_search/searching=32`；候选 rerank、OpenAI、查询规划及各 workflow 阶段各 20；`public_page_analysis/analyzing=7`；browser/local_browser inspect 合计 11；synthesis 2。20 个工作流批次只形成 7 次公共页面分析和 2 个正式项目，首要嫌疑是候选保留、可信建筑页面召回或文章 direct-match/完整证据提升，而不是总查询轮次。
- 该 Run 只作诊断证据，不 retry、不取消、不修改。下一步逐事件统计每轮 query、候选数、retain/reject、page relevance/direct match 和实际耗尽的预算项，再与三个成功分支比较首个系统性损失层。

## 2026-08-08 — Phase 36 SSE and branch-loss analysis

- `/v1/runs/{id}/events` 是 `text/event-stream`，每条 Trace 位于 `data:` 行；按 SSE 正确解析后仍是 218 条、sequence 1–218。直接把整个响应交给 `Invoke-RestMethod` 会得到一个字符串对象，不能用其数组长度判断事件数。
- 218 条 Trace 包含两次执行：sequence 1–138 是初次执行，先跑四个分支，再对 `arrival-interface` 补 1 轮、对 `time-sharing` 补至第 8 轮；sequence 139–218 是 retry，只恢复唯一未覆盖的 `time-sharing`，又跑第 1–8 轮。空白分支因此总共经历两组 8 轮，不是单次偶发漏查。
- 初次 `time-sharing` 有候选的轮次为：round 1 的 4 个候选全部拒绝；round 2 的 4 个候选保留 2 个；round 4 的 4 个候选全部拒绝；round 8 的 4 个候选全部拒绝。round 2 的 Busan Opera House 经正文分析后为 `relevance=2`，但 `direct_match=false`、`supported_fact_count=0`、`evidence_chain_status=not_direct_match`。
- 初次执行还把已存在的 Amsterdam Courthouse 与 Charles Library 分别按 `time-sharing` 重做文章分析；两者同样都是 `relevance=2`，但 `direct_match=false`、0 个 supported facts、`not_direct_match`。因此正式分析门不是因 relevance 过低失败，而是因为“时段共享”没有直接正文证据。
- retry 的 `time-sharing` round 1 有 4 个候选、保留 0；round 2 两次搜索共返回 8 条、去重后 6 个候选、保留 0；round 4 首次搜索返回 4 条但第二次超时，进入 rerank 时 candidate_count 已为 0；round 8 两次搜索各返回 4 条，但进入 rerank 时 candidate_count 仍为 0，表明重复/已见候选在 rerank 前已被滤掉。
- 所有模型完成的候选 rerank 中，`analogical_retained_count=0`、`spatial_retained_count=0`、`type_context_probe_count=0`。成功分支只出现 direct retained；这与“前期允许跨类型、空间机制类比”的产品目标不一致，是当前最强的过严信号。
- Provider 稳定性也造成损失：初次 arrival rerank 超时并回退后 4→0；movement rerank 超时但确定性回退 4→2；多个 query planning 调用因 `InternalServerError` 或 `APITimeoutError` 回退模板；retry 的 time-sharing round 4 第二次本地搜索为 `TimeoutError`。因此根因不是单一阈值，最小修复还需判断现有 deterministic fallback 是否同样排除了空间类比。

## 2026-08-08 — Phase 36 budget semantics

- `balanced` 预算是 `max_rounds=3`、`completion_recovery_rounds=5`。建筑 workflow 用两者之和构造最多 8 轮；四个子问题理论队列为 32 个 `(round, subquestion)` 条目，Trace 中的 `query_index=1,2,3...31` 是该完整队列的位置，不是已执行查询的连续计数。
- workflow 每轮先按当前覆盖跳过已覆盖分支。初次执行覆盖三个分支后，只有 `time-sharing` 继续至 round 8；retry 从 checkpoint 恢复，继续跳过三个已覆盖分支，只执行 `time-sharing` round 1–8。
- `stop_reason` 在循环前初始化为 `budget_exhausted`；只有实际时间不足、视觉预算耗尽或搜索能力不可用时才改成更具体原因。该 Run 两次执行都是完整走完构造出的公平轮次队列后自然退出，因此保留泛化的 `budget_exhausted`。
- 初次执行约 22.5 分钟、retry 约 10.8 分钟，均明显低于单次 `max_seconds=4320`（72 分钟）；公共正文分析总计 7 次，也远低于 `max_pages=48`。真实耗尽项是每分支 3+5 的轮次上限，不是时间、页面或视觉预算。
- 因此本轮不应通过继续增加总轮次解决。`time-sharing` 已在两次执行各获 8 轮，问题是查询/候选策略没有把可迁移的跨类型空间机制带到正文分析，且页面 direct-match 只接受对“运营时段”有直接事实的案例。

## 2026-08-08 — Phase 36 persisted query audit

- 通过 SQLite read-only URI 查询目标 Run 的 `query_attempts`，共 20 条：attempt 0 为 12 条，attempt 1 为 8 条；记录数与 SSE 重建的 workflow 批次完全一致。
- `time-sharing` 查询高度字面化，反复要求 `hourly entrance flow patterns`、`delivery windows`、`operating hours`、`operational records`、`use by time`、`visitor peaks` 等。它没有系统扩展到能回答前期空间重组的机制词，如独立后勤入口、服务庭院、落客湾、共享前场、可切换门厅、前后场分离或门槛缓冲。
- 可信建筑项目正文通常描述空间组织、入口序列和服务流线，但很少发布逐小时客流、配送窗口或运营记录。把“时段事实 + 图纸 + 项目说明”同时放进搜索查询，会在召回层提前排除大量可迁移建筑案例。
- Provider 规划失败后的确定性模板质量也偏低：可见重复的 `circulation circulation circulation`，把整段中文总问题和子问题塞进英文查询，并附加固定 `site:`。这解释了 ArchDaily CN、Divisare 多轮返回 0，且不是增加轮次能修复的。
- 应区分两种产出：正文明确有时段/配送事实的案例可以直接回答 `time-sharing`；正文只有空间分离或可切换机制的建筑案例可以作为“机制类比/待运营校核”，但不得声称已证明分时运营效果。查询和候选层应允许后者进入文章分析，事实绑定门继续保持。

## 2026-08-08 — Phase 36 persisted candidate audit

- 目标 Run 共持久化 42 个 `source_pages`。正式可用/待分析来源只有 6 个，其余在 rerank 后标为 `irrelevant`；所有来源均来自受信建筑媒体域名，没有小红书或通用视觉平台。
- `time-sharing` 初轮 4 个 ArchDaily 候选包括 Qingpu Vehicle Inspection Station、Montréal Casino、Planchette Sheltered Housing 和一项住宅改造，模型 4→0。前两项至少在建筑类型和标题层面与车辆、公共到达或运营有明显关系，不应在没有正文阅读的情况下与住宅噪声一起全部丢弃。
- 后续/retry 候选还出现 Busan Opera House、Southern Model Institute、Inkstone Cultural Center、Yeonam Mixed Use Building、跨境缆车站、上海 marketplace、研究站等建筑尺度页面。Busan Opera House 和 Southern Model Institute 被保留进入检视；只有前者形成正文，最终因无时段直接证据未提升。其余多数在正文前被拒。
- 同时存在应继续拒绝的明显噪声：办公室室内、住宅/公寓、家具合集、可自修复菌丝裙、影视布景、播客、房屋等。放宽必须是“建筑尺度 + 空间机制可迁移”的结构化分层，不能简单提高 retained 数或关闭类型边界。
- 这批真实候选提供了行为红测样本方向：车辆检测站/赌场/交通站等跨类型建筑若摘要明确描述公共入口、车辆或后勤流线的空间分离，应作为 spatial/analogical 候选进入正文分析；室内、家具、产品和只有类型词没有空间机制的页面仍拒绝。

## 2026-08-08 — Phase 36 admission-contract audit, first pass

- `analyze_public_page()` 的现有合同已经允许跨建筑类型：只要正文逐字支持当前子问题需要的建筑尺度空间机制，即可 `direct_match=true`，并在 limitations 写明类型/条件/尺度差异；也明确允许单页只回答子问题的一部分。这个门不应降低。
- `direct_match=false` 的三个 `time-sharing` 页面没有任何 supported facts，说明它们确实缺少时段机制正文证据。把这些页面强行提升会制造未取证事实，不符合用户要求；正确做法是更早召回真正描述服务/公共流线机制的页面，或把机制类比明确标记为仍需运营校核。
- 候选准入的硬条件是模型 assessment 同时满足 `retain=true`、`relevance>=2`、`source_trust>=2`，随后 spatial 列表还要求 `spatial_relevance>=2`。正文阅读只发生在这之后，因此标题/搜索摘要稀疏时，真实项目无法用正文证明自己。
- 唯一允许 `spatial_relevance<2` 的 context probe 还要求 `typology_match>=3`、`source_trust>=3`，且仍须模型先给 `retain=true` 与 relevance>=2。目标问题没有用户指定建筑类型，因而这条探针无法为跨类型空间机制候选提供补救；真实 Trace 的 `type_context_probe_count=0` 与代码一致。
- rerank 提示虽然写了“spatial primary”和“strong cross-type qualifies”，但查询规划提示同时规定只有用户明确提供具体机制时才能使用机制词，并显式禁止凭空加入 `loading dock`。对“落客、步行、后勤重组”这类活动关系问题，这会阻止用行业常见的 service entrance、loading bay、service court、forecourt 等检索同义机制扩展。
- 最小修改方向应优先放在两层：查询恢复阶段允许从用户明确活动关系推导中性、非结论性的建筑机制检索词；候选层允许最多一个受信建筑项目的“机制上下文探针”进入全文读取，即使摘要尚不足以给 spatial relevance 2。文章正文、EvidenceClaim、建筑尺度和最终 direct-match 语义保持不变。

## 2026-08-08 — Phase 36 existing-test boundary

- 现有 `test_candidate_reranking_prioritizes_strong_spatial_matches_across_building_types` 已锁定摘要明确描述共享论坛/楼梯等机制时，跨类型候选可以进入前四名；`test_candidate_reranking_limits_type_only_context_probes` 只允许一个同类型但低 spatial 候选补读正文。
- 当前缺口不是“跨类型永远被拒”，而是“无用户建筑类型 + 受信建筑项目摘要稀疏 + 标题/摘要只显示相邻活动”时，没有任何有限探针。真实车辆检测站、赌场、交通站等候选正落在这个空档。
- 直接放宽现有 `type_context_assessments` 会让受信建筑媒体上的室内、家具、产品和临时装置也可能进入。CandidateAssessment 目前没有建筑/场地尺度字段，无法程序化保持这条边界。
- 最小可验证扩展是增加一个默认 false 的 `architectural_scale`（或等价布尔字段），由 reranker 只对完整建筑/场地项目设 true；允许 relevance>=2、source trust>=3、spatial relevance=1 的该类候选作为最多一个 mechanism context probe。spatial relevance=0、非建筑尺度或模型明确不 retain 的候选继续拒绝。
- 查询回退已有测试明确保护：不能在用户未提出时随意加入 `loading dock` 等具体方案词。新查询放宽必须只把用户已经提出的落客/后勤活动映射为中性行业检索同义词，不能把某个空间解法写成既定答案。

## 2026-08-08 — Phase 36 deterministic query root cause

- `agent/planning.py` 的 `_EXPLICIT_PUBLIC_ISSUE_VOCABULARY` 支持公众/后勤/工作人员流线、服务廊道和独立入口，但不识别目标问题中的“落客、步行、装卸、等候、核验、配送、峰值”等入口运营活动。
- 对目标 `time-sharing` 子问题，显式词表只命中 `后勤` 与通用 `流线`，随后 `_neutral_relationship_focus()` 又追加 `circulation relationships`，形成真实 QueryAttempt 中的 `back-of-house circulation circulation circulation relationships`。当前 `dict.fromkeys` 只按完整短语去重，不能去掉短语内部或短语之间的重复词。
- 缺失词汇使确定性回退无法生成 `passenger drop-off`、`pedestrian access`、`service access`、`deliveries`、`waiting/queuing` 等中性检索信号；这些词描述用户已提出的活动，不等于预设 loading dock、service court 等具体空间答案。
- `build_public_search_query()` 在 round 5 以后只重复“替代案例与可核验图纸”的来源角度，没有改变活动机制检索词；Provider 规划失败时，新增轮次因此重复同一低质量语义。
- 最小查询修复可以补齐用户显式活动到专业检索词的映射，并让 flow 关系后缀在已有 circulation 词时不再重复。具体设计解法词仍只有用户明确提出时才能加入，既有 `loading dock not in query` 合同保持。

## 2026-08-08 — Phase 36 minimal implementation

- 查询回退新增入口运营活动的中性专业词：落客→`passenger drop-off`、步行→`pedestrian access`、车辆流线、配送装卸、等候排队、入口核验和时段变化；已有具体 circulation 词时不再追加重复 generic circulation/relationship。
- 仅对 flow 类子问题继承父问题中的到达/人车/后勤活动词，且使用固定活动白名单；不会把父问题中的采光、结构、材料或其他分支词灌入流线查询。
- Provider query planning 提示现在允许把用户已陈述活动转换为中性专业检索同义词，同时明确这些词不是设计答案，不能在正文取证前声称案例采用了某机制，也不能凭空发明具体物理设施。
- CandidateAssessment 新增默认 false 的 `architectural_scale`。Provider 只应对完整建筑、基础设施、景观或场地项目设 true；室内、房间、家具、产品、临时装置、编辑合集和纯视觉内容均 false。
- workflow 保留原有最多 4 个强 spatial 候选和最多 1 个同类型 context probe；仅在仍有空位时，再从 `retain=true`、relevance>=2、source trust>=3、`architectural_scale=true`、spatial relevance=1 的候选中补 1 个 mechanism context probe。spatial=0、非建筑尺度和模型明确拒绝项不会进入。
- 文章页面 `direct_match`、项目正文、supported facts、逐字 EvidenceClaim、`relevance>=2` 和建筑尺度事实边界未修改。机制探针只是获得一次全文证明或淘汰自己的机会。

## 2026-08-08 — Phase 36 verification build

- 验收安装器：`.artifacts/qa/phase36-precedent-recall/ArchResearch-Windows-x64-Setup-v2.2.10.exe`，69,766,759 bytes，SHA-256 `F86B7A95A286886D52AC2F0676C3C1A8EC8787FCB19BDED367CFF037D5416A1A`。
- 冻结程序：`.artifacts/build/windows/dist/ArchResearch/ArchResearch.exe`，17,996,026 bytes，SHA-256 `1EE22E423489BF93217C857449E18F92E7079A46B2D03FE1CD096576FECCB038`。
- 构建脚本已完成 Board production build、PyInstaller onedir、自包含资源 `--self-test` 与 Inno Setup 编译；扩展仍是独立产物，没有进入安装器。

## 2026-08-08 — Phase 36 installed build integrity

- 覆盖安装前，Python 逐项展开安装版 API，确认 1 个工作区、5 条历史 Run、活动 Run=0；唯一安装路径进程为 PID `46888`，旧 EXE SHA-256 `F69D9463BC9A165102359C7E29C253CC63BF16E260FA3BD61741F4A7D951D6CC`。
- 精确停止该进程后，数据库稳定为单个 `archresearch.db`，823,296 bytes、SHA-256 `77509C4F338556801897EC51BEEA97BAAB04F1E7613E0FA9FD37EFA5397A8EEC`，无 WAL/SHM。
- 候选安装器静默覆盖退出码 0。安装后 EXE 为 17,996,026 bytes、SHA-256 `1EE22E423489BF93217C857449E18F92E7079A46B2D03FE1CD096576FECCB038`，与冻结构建完全一致。
- 安装后数据库主文件大小和 SHA-256 与安装前完全一致，仍无 WAL/SHM；历史 Run 和用户数据没有被安装过程改写。

## 2026-08-08 — Phase 36 installed mechanism-probe evidence

- 新 Run `55dcb0ad-cce2-4ecb-b79c-25302f63e72b` 首轮 `conflict_nodes` 在 ArchDaily 搜到 4 个候选，rerank 保留 1 个：`direct=0`、`analogical=1`、`spatial=1`、`type_context_probe=0`、`mechanism_context_probe=1`。
- 被保留并完成 browser 检视的是 Dongchang Elevated Passage，属于建筑/基础设施尺度页面，不是室内、家具、产品或视觉图集。这是真实安装版对旧 Run `analogical/spatial/probe` 始终为 0 的直接行为改善。
- 该候选暂时产生 2 个持久化 usable assets，但当前 `project_count=0`、`covered_subquestions=0`，说明机制探针没有绕过全文文章分析/正式项目提升门；它仍需正文 direct-match 与逐字 EvidenceClaim 才能覆盖分支。
- round 2 `arrival_sequence` 召回 ArchDaily 的大庆西综合公路客运站；正文分析后成功提升为正式项目。现场覆盖跃升为 7 usable assets、1 project、1/4 分支，`multi_asset_projects=1`。这证明新增入口活动词和有限探针不仅增加浏览量，也能把真实交通建筑正文带入正式证据链。

## 2026-08-08 — Phase 36 installed Run final audit

- Run `55dcb0ad-cce2-4ecb-b79c-25302f63e72b` 自然终止为 `partial/query_budget_exhausted`；Trace 222 条，搜索恢复轮次完整跑到 round 8，没有小红书调用、retry、取消或并行 Run。
- 最终覆盖为 10 个 usable assets、10 个 verified/partial、2 个正式项目、1 个 multi-asset project；`arrival_sequence` 与 `conflict_nodes` 覆盖，`service_access` 与 `temporal_adaptation` 仍在 `gaps=[uncovered_subquestions, article_analysis_incomplete]` 中。query budget 到达上限，不是时间或页面预算耗尽。
- Trace 包含 20 次候选 rerank、20 次 query planning、35 次本地浏览器搜索和 10 次公共页面分析；2 次 `mechanism_context_probe` 均进入建筑/基础设施尺度页面。全文分析中只有 Lourosa-Fiães Transport Interface 和 Daqing West Integrated Highway Passenger Station 达到 `direct_match=true` 与完整 evidence chain，分别产生 5 条和 2 条 supported facts；其余页面保持 `direct_match=false`，没有降低证据门。
- Results API 返回 10 条资产，来自 3 个可信 ArchDaily 页面：Lourosa 3 条/15 claims，大庆西 5 条/13 claims，Dongchang 2 条/2 claims。全部 EvidenceClaim 都有 text excerpt；Dongchang 仅有建筑尺度线索，无正文事实与迁移策略。
- Board 代码的 `caseResults` 只保留非视觉平台且 `analysisReady=true` 的结果；Lourosa 与大庆西满足中文项目分析、迁移策略和逐字证据条件，Dongchang 两条不会进入正式案例分组，只作为可追溯线索。安装版根页面返回 HTTP 200、title=`ArchResearch Board`，结果接口正常。
- 本 Phase 的行为结论：前期建筑搜索应从用户已陈述的活动关系扩展中性专业词，并允许有限建筑尺度机制探针；不应放宽来源可信度、`relevance >= 2`、正文 direct-match、EvidenceClaim 或分支覆盖要求。

## 2026-08-08 — Phase 36 coverage follow-up diagnosis

- 两个未覆盖分支不是没有执行搜索：`service_access` 实际执行 8 次、`temporal_adaptation` 执行 7 次；但这些 pass 只表示完成了一轮检索/分析，不代表获得了 direct-match 证据。
- `arrival_sequence` 的有效词集中在 `passenger drop-off pedestrian arrival sequence floor plan`；`conflict_nodes` 使用 `entrance circulation conflict points passenger drop-off pedestrian service access floor plan`，这类词能命中建筑媒体常见的平面、入口和流线描述。
- `service_access` 后续查询过度收紧到 `freight delivery`、`service vehicle operating range`、`loading operations`、`delivery vehicle swept path`、`goods receiving route`；`temporal_adaptation` 过度收紧到 `post-occupancy evaluation`、`use observation`、`event scheduling`、`management rules` 和 `daily/event states`。这些是运营/技术核验词，不是大多数建筑案例页面的稳定索引词。
- 当前搜索把“先找到空间机制案例”和“同一篇文章证明后勤作业或分时运营事实”放在同一个发现查询中，导致候选召回不足；即使找到相关建筑，正文也常只说明空间关系，无法支持 `service_access` 或 `temporal_adaptation` 的 direct-match。
- 后续正确方向不是简单删除证据门，而是拆成两层：第一层用 `service entrance/public entrance/site circulation/loading bay/arrival plaza/reconfigurable forecourt` 等空间机制词扩大建筑案例召回；第二层再用正文、官方资料或运营资料核验后勤/分时事实。缺少第二层证据时可作为机制类比或未验证线索，不应伪装成正式覆盖。

## 2026-08-09 — Phase 37 关键词拆解结论

- 召回不足的直接原因是把空间发现和运营事实核验写进同一条长查询。建筑媒体更稳定地索引入口、前场、到达序列、公共/后勤关系和弹性流线，而很少在项目页标题或摘要中出现 `post-occupancy`、管理规则或车辆作业记录。
- 现在首轮只承担“找到有空间机制的建筑案例”：
  - service：`service entrance`、`public entrance`、`site circulation`，后续轮换 `service access`、`visitor arrival`、`entrance sequence`、`back-of-house`、`forecourt`。
  - temporal：`arrival space`、`flexible circulation`、`peak event`，后续轮换 `shared forecourt`、`pedestrian arrival`、`changing use`、`multi-use entrance`。
- 首轮过滤的是证据词，不是问题中的空间对象。配送、排队、入口核验、运营时段等词后置；访客/后勤流线、独立入口、服务廊道、公共楼梯等明确空间关系保留。这样扩大召回而不丢失子问题语义。
- 项目条件是独立维度，不能因为使用空间发现 lane 就丢失 `adaptive reuse`、`industrial building` 或用户声明的建筑类型；没有明确条件时也不再额外拼接泛化类型词造成重复。
- 图纸研究不共用这套建筑 fallback 语义：`visual_reference_search` 仍使用图纸类型/视觉表达查询，回归断言确认不会继承 `service entrance` 或 `flexible circulation`。因此本阶段只影响建筑研究。

## 2026-08-09 — Phase 37 实际安装版建筑 Run 审计

- 按用户授权已覆盖安装当前建筑关键词逻辑，实际安装版为 `C:\Users\76384\AppData\Local\Programs\ArchResearch\ArchResearch.exe`，PID `34308`，端口 `4849`；`/health` 为 `ok/openai/gpt-5.6-sol`。安装 EXE SHA-256 为 `FE09A116584D5E972966A33CEAF6C6616B207567A7086BD5A9C8B9B18FDFD7B9`。
- 只创建建筑 Run `ea8c5c8d-915c-4d83-80c3-942046d88eb5`，配置为 `precedent_research`、`balanced`、`research_sources=[]`。Run 自然终止为 `partial/budget_exhausted`，不是错误或取消；最终 7 个 usable/verified/partial 资产、3 个正式项目，覆盖 `arrival_sequence`、`service_access`、`temporal_adaptation`，未覆盖 `conflict_nodes`。
- Trace 共 156 条，XHS 调用 0。发现 2 次 `BrowserCommandError`，但正文分析继续完成；没有 retry、取消或并行 Run。
- 只读 SQLite 核验到 12 条 `query_attempts` 和 32 个 `source_pages`（13 `available`、19 `irrelevant`）。新关键词已在安装版生效：
  - `service_access` 首轮：`service entrance public entrance site circulation floor plan architecture`。
  - `temporal_adaptation` 首轮包含 `arrival space flexible circulation peak event passenger drop-off pedestrian access`。
  - 后续查询才加入 `project description`、`operational`、`peak event` 等证据角度；没有把 `loading dock`、`service court` 作为默认解法。
- Results 逐项审计：
  - Madrid-Barajas Airport Terminal 4 / Estudio Lamela & Rogers Stirk Harbour + Partners | ArchDaily：1 张轴测图，`arrival_sequence`，分析事件 `direct_match=true`、4 个 supported facts、5 条 EvidenceClaim；证据摘录包括 forecourts 作为交通换乘空间、不同标高道路/上下客区和连接性步行廊道。
  - The Flinders Street Station Winning Proposal：2 张图，`temporal_adaptation`，`direct_match=true`、5 个 supported facts、每张 5 条 EvidenceClaim；证据摘录包括两端大厅、高架河岸步道、步行瓶颈、乘客增长和出租车候客区迁移。
  - wahag studio: busan opera house：4 张图，`service_access`，`direct_match=true`、2 个 supported facts、每张 2 条 EvidenceClaim；证据摘录包括 public/VIP/service entrance、loading area 和围合公共前场。该页正文 Provider 分析走 deterministic fallback，但证据仍绑定到 Designboom URL 和逐字 excerpt。
- 7 个资产合计 23 条 EvidenceClaim，全部带来源 URL 与逐字 `text_excerpt`；没有因为关键词放宽而降低建筑尺度、正文 direct-match、来源可信度或证据定位门。`conflict_nodes` 的 8 次搜索虽执行完，仍没有可证实的正式案例，因此覆盖报告保留该缺口。
- 图纸研究没有参与该 Run；`drawing.py`、图纸查询函数和图纸现场数据未修改。

## 2026-08-09 — Phase 38 全局 conflict_nodes 检索逻辑

- Phase 37 Run 的 `conflict_nodes` 空白不是某个案例质量问题：8 轮都执行了搜索，但到达/扩容案例正文不能证明访客、车辆、工作人员冲突节点的空间缓解；后续查询还过早混入稀疏的运营证据词。
- 生产改动按子问题语义触发，不匹配任何项目名或来源 URL。首轮通用 discovery lane 使用 `arrival forecourt`、`entrance threshold`、`pedestrian vehicle separation`、`front-of-house/back-of-house`、`crossing points`、`wayfinding` 等中性建筑检索词；后续轮次才加入 `operational`、`project description` 和 `conflict management`。
- Provider 提示同步规定：冲突节点检索同义词只用于召回，不等于案例事实；正文读取、建筑尺度、`direct_match`、EvidenceClaim 和来源门槛不变。图纸 fallback 不继承这些词。
- 自动验证全部通过：planner 24/24、Provider 查询/候选 12/12、browser 6/6、API 576/576、strict Mypy 32 个源文件、Ruff lint/format、diff check 全绿。当前没有构建、安装或创建 Phase 38 现场 Run。
- 2026-08-09 Phase 39 设计结论：三次建筑 Run 的共同损失不是“缺少某个问题的几个专业词”。现有流程把每个子问题压成一条长查询，首轮默认只请求一个 query slot；当 rerank/规划不可用时 deterministic fallback 还把候选限制为 2 条。正文页面的逐字证据门应继续保留，检索层应改为通用语义拆槽（对象/参与者/空间、关系、状态/条件、证据类型）和轮次 lane（space discovery、relationship/organization、project/evidence）。
- 2026-08-09 Phase 39 约束：通用同义词只能由用户文本中的实体、参与者、空间和关系触发，不能以 `conflict_nodes` 等子问题 ID 触发固定词表，也不能把前场、入口阈值等设计答案作为默认词。图纸路径不共享本次建筑检索 lane。
- 2026-08-09 Phase 39 红测修正：首次候选数量测试误用了 `provider=None`，该分支旧实现本来就保留 4 条；真实数量损失发生在 Provider 对象存在但 rerank 调用异常时，旧回退才限制为 2 条。测试已改到该失败路径。
- 2026-08-09 Phase 39 调度红测：加入 Run 级 query fingerprint 后，发现 deterministic fallback 的历史查询比较忽略了 `SearchQuery` 的空白规范化，导致不同子问题仍可重复同一文本。比较前统一折叠空白，并保留原有按子问题的失败反馈。

## 2026-08-09 — Phase 39 全局检索调度完成

- 本轮优化对象是建筑研究检索流程，不是某个案例的词表。查询先保留用户明确的对象/参与者/空间、关系、状态/条件和证据类型，再由通用 lane 轮换召回角度；前场、入口、后勤等词只有在用户问题明确出现时才作为中性检索同义词，不作为默认设计答案。
- 首轮建筑公共检索在剩余查询和时间预算允许时使用两个不同槽位：`space_first` 做宽空间发现，`project_context`/`evidence_angle` 做项目或证据核验。后续轮次改换空间关系、空间组织、使用/场地和项目说明角度，避免把空间发现和稀疏运营记录压成一条长 query。
- Run 级 query fingerprint 与 `SearchQuery` 的空白归一化一致，跨子问题和恢复轮次不重复消耗相同检索文本；预算裁剪仍在每次公共搜索前执行，双槽不会透支 recovery 额度。
- Provider rerank 异常时，确定性回退从固定 2 条放宽为最多 4 条，但仍要求正相关、可信来源和建筑路径准入。正文读取、建筑尺度、direct-match、EvidenceClaim 与图纸路径合同未放宽。
- 自动验证通过：建筑 planner 22/22、Provider query/candidate 12/12、browser/workflow 定向回归通过，API 全量通过，Ruff、62 文件格式检查、strict Mypy 32 个源文件和 diff check 全绿。图纸 `drawing.py` 未修改。
- 现场验证尚未开始；当前安装版仍是 Phase 37 版本，不能用本轮静态结果替代实际安装版建筑 Run。

## 2026-08-09 — Phase 40 安装版建筑检索现场结论

- Phase 39 源码已构建并覆盖安装。安装器不含扩展，SQLite 安装前后 SHA-256 均为 `354E53402B7E80850ABEAC788CCDF56AFA7CD8D0DBC856B52C170D4DA49CAE66`；新安装版 PID `40596`、端口 `6158`，健康检查为 `ok/openai/gpt-5.6-sol` 与 `ArchResearch 2.2.10`。
- 唯一新 Run `94c7d473-3f0d-41b1-9ad1-dcaec089c75e` 为 `completed/coverage_satisfied`：11 个 usable assets、4 个正式项目、10 个 verified/partial、2 个 multi-asset projects，4/4 子问题覆盖，`gaps=[]`。相对旧 Run 的 7 个资产、3 个项目、3/4 覆盖，召回和覆盖均明显提高。
- 11 条 QueryAttempt 产生 15 条实际查询，15/15 去重；四个首轮子问题全部执行 `space_first + evidence_angle`，随后 7 轮只对未覆盖分支做单槽换词。8 个来源页 available、26 个 irrelevant，Provider fallback=0，XHS/图纸事件=0。
- 11 次正文分析中 6 次 `direct_match=true/complete`、5 次严格拒绝；43 条 EvidenceClaim 全部有 URL 和逐字 excerpt。数量提升来自召回与调度，不是正文证据门放松。
- Board 首页显示最新 Run 为“11 张参考 · 8/8 · 已完成 · 案例不足”，详情页四个子问题均有案例。首页控制台无错误；详情页有一个预览资源 404，但页面主体正常。

## 2026-08-09 — Phase 41 项目身份误合并根因

- 两个不同来源页在 browser visual lead 阶段都使用顶层占位名 `待核验项目`；正文分析随后分别给出了非空 `project_name_zh`，且都达到 `direct_match=true`，但顶层 `project_name` 没有随正文提升更新。
- Board 按顶层 `project_name` 组织正式案例，因此不同 URL 会因共享占位名被合并，一个已经核验的真实项目会被另一个项目的标题和详情遮蔽。用户看到的案例数量由此低于后端实际 `project_count`。
- 这不是检索词不合适，也不应通过继续增加某类建筑或空间词解决。正确的全局边界是：visual lead 未核验前允许占位名；正文 direct match 成功后，用该页面的稳定项目身份回写顶层字段；同页多资产继续共享身份，不同页不得仅靠占位名合并。
- 修复不能匹配 Las Rocas、Rocco、Designboom 或任何具体 URL；正文证据、建筑尺度、来源可信度、EvidenceClaim 与图纸路径合同保持不变。
- 生产修复落在 `_persist_public_page_analysis()`：只有候选仍为产品状态占位名 `待核验项目`，且正文已通过原有 `direct_match`、逐字事实和相关性门时，才使用 `_project_display_name(page.title/source.title/project_name_zh)` 更新顶层身份。已有明确项目名不会被页面标题覆盖。
- 项目名已加入持久化前后差异比较，因此仅发生身份升级时也会计入变更并触发现有 rerank；未核验 visual lead 不经过该函数，继续保留占位名。无需修改 Board、导出或收藏分组逻辑。

## 2026-08-09 — 逐子问题案例数量诊断

- Board 对上一条 Run 的实际渲染不是“每个子问题展示全部项目”：子问题 1/3/4 各 1 个正式案例，子问题 2 有 2 个可见案例。Board 只展示 `subquestion_analysis` 对该分支具备完整正文机制与证据的项目，这个关联边界应保留，不能把其他分支案例复制过来充数。
- 旧 Run 的占位身份碰撞会进一步隐藏同一子问题内的真实项目：多个已核验来源共享 `待核验项目` 时，Board 只形成一个 dossier。Phase 41 修复后，现场新 Run 已出现 Tammela 与 Adelaide 两个独立项目分组，4 张分析就绪资产占位名为 0。
- 数量目标还有独立的全局缺口：`calculate_coverage()` 的 `assets_per_subquestion` 统计资产 ID，不统计不同项目；同一项目的多张图可以满足分支 enrichment。`DEPTH_TARGETS` 只定义总项目数，没有逐子问题项目多样性目标。
- 查询循环只在 `enrichment_satisfied()` 时提前停止，但最终 `completion_satisfied()` 只检查 `gaps`，不检查 `enrichment_gaps`；因此所有子问题各有至少一个案例后，即使仍有 `insufficient_subquestion_assets` 或项目分布不均，终态也会显示 `completed/coverage_satisfied`。
- 不增加“每个子问题必须达到固定案例数”的硬门槛。若后续继续优化，逐子问题不同项目数只能作为软诊断与补查优先级：找到并通过正文证据的项目全部展示，只有一个时允许完成；不能通过 Board 重复展示无正文关联的案例，也不能用同项目多图冒充多个案例。图纸研究不共享该指标。

## 2026-08-09 — Phase 41 首次安装版终态与后续根因

- Run `699ff718-a17b-44ef-8b1b-cd4ce233ab29` 自然终止为 `completed/coverage_satisfied`：16 个 usable assets、15 个 verified/partial、4/4 子问题、332 条 Trace。终态保留 `insufficient_subquestion_assets`，因此逐子问题数量不是完成硬门槛。
- 终态 Results 的 8 个 analysis-ready assets 顶层占位名为 0，50 条正式 EvidenceClaim 缺 URL/excerpt 均为 0；15 次正文分析中 7 次接受、8 次拒绝，query-planning fallback=0、page-analysis deterministic fallback=1，XHS/图纸事件为 0。
- 覆盖报告中的 4 个项目并非 4 个不同来源项目：同一 Adelaide Zoo 来源页的一张资产保留明确全标题，另一张由占位名升级为短标题，Board 因精确字符串分组在子问题 1 与 3 各显示两个重复 dossier，并把全局项目数从真实 3 个虚增到 4 个。
- 通用修复不是合并相似案例名：正文核验同一来源页时，若该来源已有非占位项目名，所有新提升的占位资产复用该明确名称；只有该来源全是占位名时才从页面/来源标题派生名称。不同来源仍独立，未核验资产仍保留占位名。
- 唯一 deterministic page-analysis fallback 把 `service industry` 的裸 `service` 命中为 flow 机制，导致 Zaiwan Village 以与后勤界面无关的村民就业句进入正式案例。修复移除歧义裸词，只保留 `service access`、`service entrance`、`service circulation`、`service route` 等建筑复合语义；没有案例名、URL 或建筑类型特例。
- 新增两个红测后，完整 `test_browser_inspection.py`、`test_providers.py`、API 全量、Ruff、format、strict Mypy 32 个源文件和 `git diff --check` 全绿；`research_paths/drawing.py` 与所有图纸文件不在差异中。
- 第二次安装版候选为 `.artifacts/qa/phase41-source-identity-followup/ArchResearch-Windows-x64-Setup-v2.2.10.exe`，SHA-256 `DC99EB2B1F95C8353C6FC879590EEF7BBE1994DCF79EA5D61941AA72D6FC783D`；SQLite 覆盖安装前后 SHA-256 均为 `F62ABB35223C024DBCED25E236792D1B3991007A8B7B6502EF3EB1C477A468B2`，安装 EXE 与冻结构建均为 `4340E6918CB8663937FB762D81A31703FE4F5B96336CD45A7915AF66D5D8FA4D`。安装器仍不含扩展。

## 2026-08-09 — Phase 41 第二次安装版 Board 结论

- Run `bef8d1a4-5d09-4624-85e4-6cfff4979b23` 为 `completed/coverage_satisfied`、`attempt=0`：23 个 usable/verified-partial assets、8 个正式项目、4/4 子问题，`gaps=[]`；终态仍带 `insufficient_subquestion_assets`，证明逐子问题数量只保留为 enrichment 软提示。
- 23 个正式资产来自 8 个 URL；每个 URL 的顶层 `project_name` 去重后都只有一个值，同源名称分裂为 0。按每个来源支持的 `subquestion_ids` 去重后，API 恰好预期 12 个 Board 展示位。
- 安装版 Board 实际四问分别显示 1、3、6、2 个案例，合计 12，与 API 完全一致；8 个不同项目全部至少出现一次，同一来源在同一子问题内没有重复 dossier。因此“某一问只有一个”不是显示遗漏，而是当前只有一个来源项目具备该分支的正式正文证据。
- 不应把 8 个项目全部复制到四个子问题。新加坡体育城支持四个分支，徐州东站东广场支持两个分支，其余六个项目各支持一个分支；Board 按证据关系重复出现同一项目属于正确行为，跨分支展示名称不影响顶层项目身份归组。
- Jahad Metro Plaza 的确定性正文回退只显示来源原句和“待核验假设”转译，没有伪装成完整机制；Board 正文和 23 个正式结果中均无 `service industry`。flow 回退修复在安装版生效。
- 本轮没有降低正文 direct-match、来源、建筑尺度、EvidenceClaim 或覆盖门，也没有增加逐子问题硬配额。结果数量提升来自检索与调度；正式展示仍严格绑定当前子问题证据。

## 2026-08-09 — Phase 42 初始调度假设

- Phase 41 的 `1/3/6/2` 不是 Board 丢案例，而是 8 个正式来源项目真实支持分支的分布；因此下一步不能改 Board，也不能把所有项目复制到每个子问题。
- 当前 coverage 已知按 `assets_per_subquestion` 判断 enrichment，同一项目多张资产可能让分支看似充足；总 `project_count` 又不表达项目在各子问题的分布。这两个指标无法告诉调度器“哪个已覆盖分支最缺不同案例”。
- 最小可行方向是增加按正式顶层 `project_name` 去重的 `projects_per_subquestion` 诊断，并只用它排序后续 enrichment 查询。该字段是调度信号，不是完成合同。
- 需要先确认 workflow 在核心覆盖完成后是否仍会选择 enrichment 分支、当前顺序由 `subquestion_passes`、查询次数还是固定列表决定，以及 retry/resume 是否依赖相同顺序；未确认前不修改代码。
- 只读源码确认：`calculate_coverage()` 只构造 `subquestion_asset_ids`，enrichment 用资产 ID 数量比较 `assets_per_subquestion`；没有按分支去重的项目集合或项目数量字段。
- `precedent.should_skip_subquestion()` 在仍有未覆盖分支时跳过已覆盖分支，这是正确的 coverage-first 行为；当核心覆盖完整后，它不再区分各分支，所有剩余查询按 `build_queries()` 预生成的固定顺序继续执行。
- 主循环在每条 query 前重新计算 coverage，但只读取 `covered_subquestion_ids` 和总覆盖数；因此即使此时能看到某分支项目更少，也没有可用字段或排序入口。`enrichment_satisfied()` 仍只决定提前停止，最终 `completion_satisfied()` 仍只看硬 `gaps`。
- 初步结论：停止合同不需要改。Phase 42 应先增加 `projects_per_subquestion` 只读诊断，再让核心覆盖完成后的查询选择参考该字段；coverage 尚未完整时继续严格优先未覆盖分支。
- `build_queries()` 明确按 `round_number -> subquestions` 生成固定列表，并在末尾按 `max_queries` 截断；主循环直接枚举该列表，所以预算越紧，计划顺序靠前的已富集分支越可能先消耗查询。
- 现有 `test_precedent_normal_rounds_prioritize_coverage_before_enrichment` 覆盖了正确的 coverage-first 行为，但其 enrichment 参数化把完整覆盖后的下一次搜索固定预期为 `branch-a`，本质上锁定了旧的列表顺序，而不是业务要求。
- 新红测应保留第一组“C 未覆盖则继续 C”，并把第二组改成：三分支都覆盖后，若 `projects_per_subquestion` 为 A=3、B=2、C=1，则下一次 enrichment 必须是 C；若数量相同，则仍按原计划顺序稳定选择 A。
- 为兼容大量测试中的手写 coverage stub，新字段可先作为 `CoverageData` 的 `NotRequired[dict[str, int]]`，workflow 通过 `.get()` 使用；真实 `calculate_coverage()` 必须始终返回完整映射。Pydantic `CoverageReport` 当前没有该字段，但运行 API 直接暴露 `dict[str, Any]`，无需为只读调度先扩大公共模型。
- 直接在主循环跳过项目较多的分支会产生新风险：若最少项目的分支持续没有新结果，它会在所有后续轮次独占查询，软提示等价变成硬阻塞。该方案否决。
- 选择更小且公平的实现：在每个 query round 开始时读取当时 coverage；仅当核心覆盖完整且存在不同项目数映射时，按 `(projects_per_subquestion, 原轮内位置)` 稳定重排该轮查询。该轮所有查询仍保留，只有在时间/查询预算中途耗尽时，项目较少的分支先获得机会。
- 这种 round-local 排序不修改 `build_queries()`、query key、已完成查询恢复语义或总查询数；coverage 不完整时完全沿用原顺序和既有 skip 规则。项目数相同时稳定排序自然保持原计划顺序。
- `query_index` 在主循环中只用于进度 Trace 和判断轮次结束；公共搜索域轮换另用稳定的 `subquestion_domain_slots`，不会因执行顺序变化而改变某个子问题对应的域槽。主循环可安全改为“外层 round、内层已排序 query”的两层枚举，并用累计索引继续报告总进度。
- 最小实现没有引入嵌套循环，而是把原单层 `for` 改为保持单一 break 语义的索引 `while`：在 round 边界读取当前 coverage、稳定排序当前轮切片，再按原逻辑逐条执行。`query_offset` 在任何 `continue` 前已递增，避免 resume/skip 死循环。
- 真实 precedent coverage 现在返回所有计划子问题的 `projects_per_subquestion`，值由通过既有正文分支证据门的资产按顶层 `project_name` 集合去重得到；visual reference coverage 不返回该字段，图纸路径不会参与排序。
- 两个目标测试共 4 个参数组已通过：同项目重复已核验资产不增加项目数；未覆盖分支仍优先；3/2/1 分布时第二轮先执行 1 项目分支；1/1/1 时保持 A/B/C 原顺序。
- 第一轮回归 `test_agent_verification.py + test_workflow.py + test_research_path_separation.py` 全绿，覆盖 completion/enrichment 边界、预算停止、query persistence、resume/recovery 和 precedent/drawing 路径分派。while-loop 重写未改变这些合同。
- 完整 `test_browser_inspection.py` 156/156 通过，覆盖公共搜索、query planning、候选 rerank、正文分析、公平轮转、恢复预算、缓存 enrichment 和应用依赖注入；没有发现轮次重排副作用。
- 静态检查结果：Ruff lint 通过；机械格式化唯一报告文件后，62 文件 format check 通过；strict Mypy 对 32 个源文件无问题。
- 格式化后目标行为 4/4 再次通过；API 全量 605/605 通过。现有 Pydantic/SQLAlchemy 警告均为测试环境既有弃用警告，没有新增失败。
- 最终源码检查通过：`git diff --check` 无错误，`research_paths/drawing.py` 差异计数为 0。当前安装版健康为 `ok/openai/gpt-5.6-sol`、版本 `2.2.10`、端口 `11561`，活动 Run=0；它尚未包含 Phase 42 改动。
- Phase 42 不应在未获授权时自行构建或创建 Run。现场成功标准是：新建筑 Run 保持原证据门和正常完成状态，Trace 显示核心覆盖后每轮优先处理不同项目较少的分支；不要求最终每问达到相同或固定数量。
- 用户已用“运行”明确授权 Phase 42 的构建、保护性覆盖安装和恰好一条新建筑 Run；授权不包含重试/改写旧 Run，也不扩大到图纸研究。
- Phase 42 安装版 Run `9fab66b8-feec-40fd-b4ae-feecc17124e0` 自然终止为 `partial/no_new_assets`、attempt 0：13 usable、3 项目、11 verified/partial，覆盖 `arrival-sequence`、`flow-interface`、`state-change`，`service-integration` 保持 0 项目。因为核心 coverage 从未达到 4/4，现场 Trace 没有进入覆盖完成后的软多样性排序分支；只能证明新统计进入安装版与 coverage-first 边界未变，不能宣称现场重排已触发。
- API 有 11 条 formal partial 与 2 条同源 visual lead；3 个正式来源各自只有一个顶层项目名，同源名称分裂为 0。50 条 formal fact claims 缺 URL=0、缺 excerpt=0；3 条 observation claims 使用 image region 而无文本摘录，符合证据类型合同。正式结果无 `service industry`，Trace 与结果均无 XHS/图纸路径。
- Board 四问实际 dossier 为 `2/1/2/0`：其中 flow 的第 2 个 dossier 是 Designboom 同源的两张 visual lead 合并为一个项目，正文有 4 条逐字事实与分支分析；其余正式来源×分支预期 4 个 dossier 全部显示。后勤分支明确显示“暂时没有可用结果”，没有跨分支复制案例；页面无 `service industry`，控制台错误为 0。
- 对照 Phase 41 成功 Run 后确认新的全局缺口：两次同类后勤分支首轮都落在 Designboom 域槽，但成功 Run 的 query plan 是 `space_first + evidence_angle`，返回 4+2 个候选并保留 Casino du Lac；本 Run 漂移为 `space_first + project_context`，只返回 1+2 个候选且保留 0。后续 5 轮 recovery 使用 `delivery stopping`、`service vehicle stopping`、`waste collection` 等过度字面表达，出现 0 结果或超时。
- 因此本次 3/4 不是逐子问题数量门槛、Board 截断或证据门过严；Phase 42 软排序也无法帮助仍未覆盖的分支。后续应在全局 architecture query-planning 合同中稳定互补 lane，并让 recovery 轮换语义层，而不是为 Casino、SportsHub 或当前问题写检索词。

## 2026-08-09 — Phase 43 源码边界定位

- 当前 deterministic 建筑 fallback 已按 round 轮换 `spatial relationships`、`spatial organization`、`use patterns`、`project description technical case study`，方向本身是通用语义层，不需要新增任何具体案例词表。
- 当前 Provider 提示、校验器和既有测试仍允许首轮第二槽为 `project_context`、`named_precedent` 或 `evidence_angle`；这使同样的双槽预算可能从“空间发现 + 正文证据”漂移成“空间发现 + 泛项目上下文”，与 Phase 41/42 现场差异一致。修复边界应放在查询计划合同，而不是候选或正文证据门。
- 当前 fallback 在第 4 轮会扩大从完整 research context 提取的显式词数量；需要用抽象行为测试确认 recovery 的核心表达由语义 lane 轮换，而不是让用户枚举成为唯一或主导查询表达。
- `plan_search_queries()` 当前只校验双槽包含一个 `space_first` 和任意一个 context strategy；因此 `space_first + project_context` 会一次通过，不会触发已有的结构化纠错重试。该校验器是首轮漂移的最小可控修复点。
- Workflow 只在首轮或少数恢复条件下给两个 query slots；普通 recovery 是单槽。Provider 不可用时 `_try_search_query_plan()` 当前无论 `query_limit` 都只返回一个、且因模型默认值被标作 `project_context` 的无 anchors query，首轮 deterministic fallback 也没有真正保持双 lane 角色。
- Workflow 的正文读取、候选重排和证据判定都位于查询计划之后；收紧 query plan 策略不会要求改这些门，也不涉及图纸路径。
- 用抽象英文问题只读运行当前 deterministic builder 后，round 1–8 每条查询都会再次拼入完整英文子问题；round 4–8 的 lane 还被钳制为同一个 `project description technical case study`。这会让用户枚举长期占据可执行查询，并使后期恢复缺少角色轮换，属于可复现的全局问题。
- 最小修复应同时覆盖三处行为：首轮 Provider 双槽严格为发现 + 证据；Provider 不可用时首轮 deterministic 也尊重双槽；deterministic recovery 去掉已提取语义后的完整问题复写，并循环通用关系/运营证据/项目说明 lane。
- Phase 43 RED→GREEN 已完成：新增共享 architecture retrieval lane 合同，round 1 为 spatial discovery，round 2 起按 spatial relationships / operational evidence / project description 循环；对应单槽策略为 `space_first / evidence_angle / evidence_angle`。
- Provider 双槽校验现在禁止成对的 `project_context`；首轮必须为 `space_first + evidence_angle`，后续双槽允许 `space_first + evidence_angle` 或带明确项目锚的 `named_precedent`。不满足时使用既有一次结构化纠错，连续不满足则由 workflow 保留 deterministic fallback。
- Deterministic fallback 保持每个 query attempt 只执行一条预算保护查询，但不再默认为 `project_context`，而是使用当前 round 的共享 lane strategy；Trace 同时记录 fallback strategy。正常 Provider 路径才使用首轮双槽，避免模型/时间故障让单个分支额外消耗其他子问题的搜索预算。
- 中英文 deterministic builder 在已经提取到显式语义维度时不再追加完整 subquestion；具体对象仍来自用户文本，未增加项目、URL、建筑类型或问题 ID 特例。
- 邻近回归发现“完全删除 source focus”会误删不在内置类型表中的用户声明范围。当前改为只保留结构上可判定为简短范围的片段（最多 5 个英文词或 14 个中文字符、无枚举标点），例如用户明确的未知建筑类别；包含逗号的完整问题和活动枚举仍不会回灌。
- Deterministic `space_first` 没有结构化 anchors，不能沿用 Provider space-first 的候选宽放规则；candidate fallback 现在只在 `space_first` 且 anchors 存在时使用宽空间相关性，否则继续保留既有类型/问题相关性保护，避免无关建筑因摘要里的泛词进入正文读取。
- 首次让 deterministic fallback 也执行双槽后，browser 全回归出现 11 个失败：搜索次数翻倍导致跨子问题域槽、页面容量、恢复顺序和综合时间预留改变。这证明 fallback 双槽与既有公平预算合同冲突；撤回额外调用后 browser 157/157 恢复通过。
- 修正后的抽象 7 轮只读探针为 7/7 唯一查询，完整 subquestion 复写为 false；但 round 4 起仍会同时放入多项用户显式维度。为完整满足“语义拆解而非枚举拼接”，deterministic 每条查询还需对显式维度做有界轮换。
- 有界轮换只应用于包含运营核验/状态维度的长枚举；首次对所有显式词统一限 3 会误删用户明确给出的天窗、高侧窗、夹层、构件等建筑对象，已根据 3 个全量失败收窄。空间、构造和图纸对象继续完整保留，运营枚举则每条最多 3 个并跨轮次换组。

## 2026-08-09 — Phase 43 安装验证基线

- 用户已授权构建、保护性覆盖安装与恰好一条新建筑 Run；旧 Run 不 retry，图纸研究不参与。
- 安装前只读复核为 11 条历史 Run、活动 Run=0；当前安装进程 PID `11140`、端口 `14523`，可执行文件为用户安装目录中的 `ArchResearch.exe`。
- 数据库为 `C:\Users\76384\AppData\Local\ArchResearch\data\archresearch.db`；保护安装将精确停止当前 PID，并比较覆盖安装前后 SQLite SHA-256，不删除 runs 或本地资源。
- 已完整复读 `build-windows-installer.ps1` 与安装器 smoke 脚本。候选输出限定在工作区 `.artifacts/qa/phase43-query-lane-stability`；安装器继续不捆绑 Chrome 扩展，构建包含 Board、PyInstaller 自检与 Inno Setup。
- Phase 43 候选安装器已生成：`.artifacts/qa/phase43-query-lane-stability/ArchResearch-Windows-x64-Setup-v2.2.10.exe`，69,772,830 bytes，SHA-256 `FA6CFDABDF9D3DB260329941FC79F67BA01A8824D24959559E0D9ED0E20DB1A0`。
- 冻结 EXE 为 18,000,318 bytes，SHA-256 `CE47B35AA558DF6116245FBBB6C68219C625AF3360BE805B1ACE97FE7BD759B1`；嵌入式 `--self-test` 退出码 0，Windows 安装器契约通过。
- 冻结目录 `manifest.json` 数量为 0，`apps/extension`/`chrome-extension` 专属路径数量为 0；当前安装进程 PID `11140` 在整个构建和候选审计期间保持运行，构建没有覆盖现场。
- 覆盖前最终确认 API 有 11 条历史 Run、活动 Run=0，健康为 `ok/openai/gpt-5.6-sol`。在线 SQLite 哈希因服务独占文件而只读失败，精确停止已校验路径的 PID `11140` 后成功读取安装前哈希 `9B7D9C3DC084827F7E5BCBA27F2D6DBD767B151933D8678D77B37B2D21EA26DF`（2,985,984 bytes）。
- 静默覆盖安装退出码 0；SQLite 安装后 SHA-256 仍为 `9B7D9C3DC084827F7E5BCBA27F2D6DBD767B151933D8678D77B37B2D21EA26DF`，历史数据未被覆盖。实际安装 EXE SHA-256 为 `CE47B35AA558DF6116245FBBB6C68219C625AF3360BE805B1ACE97FE7BD759B1`，与候选冻结 EXE 相同，安装版 `--self-test` 退出码 0。
- 新安装版启动为 PID `43912`、端口 `3303`；`/health=ok/openai/gpt-5.6-sol`、`/desktop-health=2.2.10`，扩展桥 `connected=true`。安装目录 `manifest.json=0`、扩展专属路径=0。
- 创建前门禁为 11 条历史 Run、活动 Run=0、扩展桥 connected；只发送一次创建请求，得到 Phase 43 建筑 Run `3d85f4f0-1988-41b9-9e83-47e11e3bb4b9`，初始 `created`、`attempt=0`。问题、goal、balanced 预算和空显式来源与前两次建筑现场对照一致；后续只读等待自然终态。
- Run 约 55 秒后由 `planning` 自然进入 `searching`，Provider 生成 4 个建筑子问题。首个 `spatial_relations` 的首轮 query planning 为严格互补的 `space_first + evidence_angle`，第一个结构化 ArchDaily 搜索返回 4 个候选；未触发 deterministic fallback。
- `spatial_relations` 的两次首轮搜索共返回 8 个候选、重排保留 1 个来源；该 ArchDaily 正文 `direct_match=false`，未成为正式项目，但浏览生成 3 个 verified/partial visual leads，coverage 仍为 0/4，说明正文门没有因召回放宽而降低。
- 第二个 `user_experience` 首轮同样实际记录为 `space_first + evidence_angle`；Run 继续自然执行，attempt 0、无停止原因或 Browser error。
- 第三个 `state_change` 首轮也是 `space_first + evidence_angle`，两次 ArchDaily 搜索共 8 个候选、重排保留 3 个；2 个来源为 direct-match（6+3 条 supported facts、证据链 complete），第 3 个按原正文门拒绝。
- 首轮前三问结束时 coverage 为 11 usable、2 个正式项目、1/4 分支，`projects_per_subquestion.state_change=2`；第四个 `site_conditions` 已开始。该数量来自两个不同来源项目，不是同项目多图或跨分支复制。
- 四问首轮 query plan 全部为 `space_first + evidence_angle`。首轮结束 coverage 为 15 usable、4 个正式项目、2/4 分支；`site_conditions=3`、`state_change=2`，同一 Nanterre 项目有正文证据支持两个分支，因此不重复计入顶层项目总数。
- 第二轮 recovery 对 `spatial_relations` 与 `user_experience` 均使用单槽 `space_first`，符合 spatial relationships lane；前者搜索超时后从缓存正文以确定性 page-analysis fallback 增加 2 条来源事实，后者 4 个结果保留 2 个并以 5 条 supported facts 得到 direct-match。
- 第二轮中途 coverage 已达到 25 usable、5 个正式项目、4/4，`gaps=[]`；`projects_per_subquestion={site_conditions:3, spatial_relations:1, state_change:2, user_experience:1}`。`insufficient_subquestion_assets` 仍只是软 enrichment 提示，Run 继续用剩余预算补查，不构成完成硬门槛。
- 第三轮先按项目数 `1/1/2/5` 处理 `spatial_relations`、`user_experience`，并切换到单槽 `evidence_angle`；前者无新增，后者以 Tribut Stadium 缓存正文增加 4 条 supported facts 后项目数变为 2，`enrichment_gaps` 清空，Run 未跑满 32 个查询即自然停止。
- 唯一 Run 终态为 `completed/coverage_satisfied`、attempt 0：33 usable、32 verified/partial、7 个 coverage 项目、4/4、`gaps=[]`、`enrichment_gaps=[]`，逐问项目数 `site=5/spatial=1/state=2/user=2`。没有逐问硬配额，也没有第二条 Run。
- Trace 共 133 条：10 次 Provider query planning、0 次 deterministic query-planning fallback；14 次实际搜索中 12 次有结果、2 次超时；14 次正文分析为 10 direct-match、4 rejected，2 次 deterministic page-analysis fallback；browser failures=0、XHS=0。
- Results API 持久化 39 条（32 partial、7 visual lead）。简单把全部 partial 当 coverage 项目会误算 Legacy/Plaine 两个正文拒绝来源；以存在正式 `subquestion_analysis` 的分支证据门重算为 7 个项目、10 个“来源项目 × 受支持子问题”展示位，与 coverage 一致。
- 执行 Trace 的 `search_scope=project_context` 不是 query strategy 回退：`workflow.py` 的结构化搜索层只枚举 `space_first/project_context`，明确把任何非 `space_first`（包括 `evidence_angle`）映射为 `project_context`；策略身份仍以 query-planning 的 `evidence_angle` 为准。
- Board-ready 审计为 19 个带非空正式分支分析的资产、7 个来源、7 个顶层项目；同源多项目名 0、正式占位名 0。97 条 fact claims 缺 URL=0、缺逐字 excerpt=0；5 条 observation claims 均有 image region；正式内容与页面 `service industry` 命中均为 0。
- 实际安装版 Board 程序化计数为 10 个 dossier，四问分布 `1/2/2/5`，每问内来源 URL 均唯一；Nanterre 与 Tribut 只在各自有正文支持的多个问题下出现，没有同问重复或跨问无证据复制。Legacy 与 Plaine 未出现在 Board。
- 两个 deterministic page-analysis fallback 在 Board 都明确显示“来源原文”和“把来源机制作为待核验假设”，没有展示为完整正常策略。Board 页面无 `service industry`；Run Trace 的 XHS tool events=0、drawing/visual-reference tool events=0。
- 最终门禁通过：`git diff --check` 无错误，`research_paths/drawing.py` 差异 0；安装版 PID `43912`、端口 `3303`，`health=ok/openai/gpt-5.6-sol`、版本 `2.2.10`、扩展 connected、12 条历史 Run、活动 Run=0。安装 EXE SHA-256 仍为 `CE47B35AA558DF6116245FBBB6C68219C625AF3360BE805B1ACE97FE7BD759B1`，安装目录 `manifest.json=0`、扩展专属路径=0。

## 2026-08-09 — Phase 44 v2.3.0 发布基线

- 用户明确授权整理工作区、提交并正式发布 `v2.3.0`；发布主题为建筑研究/图纸灵感执行路径拆分、建筑检索全局优化和图纸 bug 修复。
- GitHub `latest` 仍是已发布的 `v2.2.10`，tag 指向主线提交 `a2ff995`；本轮不能覆盖旧版本，必须统一升为新版本 `2.3.0`。
- 当前工作树有 18 个 tracked 修改文件，均来自 Phase 35–43 的 API/Extension 实现、行为测试和项目交接记录；另有 `.artifacts/ci/` 与 `.planning/` 未跟踪目录，发布提交必须排除这些本地缓存/技能状态。
- 当前 API、Board、Extension、manifest、README、GitHub workflow 和 `release.tests.ps1` 仍固定 `2.2.10`。Phase 43 只生成了现场候选安装器；正式发布必须从同一最终提交重新生成 `2.3.0` 安装器和独立扩展 ZIP。
- 现有发布合同要求 Windows latest、Python 3.12、Node 24、Board/Extension coverage、Extension packaged E2E、完整 `scripts/verify.ps1`、Windows install smoke，并分别上传安装器和扩展 ZIP。
## 2026-08-09 — Phase 44 分支与发布范围审计

- GitHub CLI 已认证为 `jileyu2000`，具备 `repo` 与 `workflow` 权限；远端仓库为 `jileyu2000/archresearch`，默认分支 `main`。
- 当前工作分支 `agent/local-release-v2.2.2` 与 `origin/main` 已分叉：当前侧 14 个历史提交，主线侧 1 个 `v2.2.10` squash 发布提交。为避免把旧提交历史带入新 PR，`v2.3.0` 发布分支必须直接基于最新 `origin/main`，再承载本轮最终差异。
- 相对 `origin/main` 的正式范围为 18 个已跟踪文件：建筑规划/验证/浏览/Provider/workflow、对应 API 与 Extension 测试、Extension 命令执行与内容操作，以及四个持续规划记录文件；图纸研究实现文件不在差异中。
- `.artifacts/ci/` 与 `.planning/` 是本地缓存/技能状态，不属于发布内容；应通过 `.gitignore` 排除，保留本地文件而不删除。
