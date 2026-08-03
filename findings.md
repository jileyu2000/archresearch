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
