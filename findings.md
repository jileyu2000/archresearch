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
