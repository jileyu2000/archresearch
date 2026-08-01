# ArchResearch 本地产品计划

> 本文件只保留当前可执行计划。退役 Web Edition、Cloudflare 和 M158–M178 的过程记录已删除；如确需追溯，使用 Git 历史。M0–M120 的早期本地阶段仍见 `docs/history/task-plan-archive-2026-07-27.md`。

## Goal

交付唯一的 Windows/Chrome 本地优先 ArchResearch：FastAPI 执行研究流程，SQLite 与本地文件保存数据，用户提供 OpenAI-compatible API 地址和 Key，Chrome 扩展只处理经用户授权的浏览器能力。

## Product contract

- 唯一运行时是 Windows/Chrome + FastAPI + Python workflow + SQLite + 本地文件。
- 普通用户使用自包含 Windows 安装器；不要求安装 Python、Node.js、pnpm 或 PowerShell。
- Chrome 扩展作为独立 ZIP 安装，不能捆绑进 Windows 安装器。
- 首次配置明确要求 API 接口地址、模型名称和 API Key；程序从上游 `/models` 获取只读模型列表，用户选择一项后只探测该模型，不能手输模型 ID，也不能自动选列表第一项。
- `gpt-5.6-sol` 只作为旧 `provider.json` 缺少模型字段时的兼容默认，不得成为新配置的隐含模型。
- Provider 地址与模型配置只存本地 `provider.json`；Key 只存 Windows Credential Manager。
- 桌面启动器优先使用 `127.0.0.1:8000`，冲突时自动选择空闲回环端口；Board、API、健康检查、Chrome URL 与扩展 endpoint 必须使用同一端口。
- 正式建筑研究由本地 FastAPI workflow 与 Direct Playwright 执行；登录态小红书由单独安装并配对的 Chrome 扩展执行。
- 浏览器协议只接受枚举 JSON 命令，不接受脚本、任意 selector、凭据、社交动作或通用表单提交。
- 正式建筑事实必须绑定 URL 与逐字引文；coverage 与 enrichment 同时达标才可标记 `completed`。
- 新 Run 默认保留 180 天，可逐条永久；收藏是独立累加快照，删除只能由用户显式执行。
- 不恢复 Firecrawl、Pinterest、TinEye/来源反查、通用视觉网页降级、平台案例库、全局向量索引或多 Agent runtime。
- 不恢复 `apps/web`、`apps/edge`、Cloudflare Worker/Workflow、Wrangler、Turnstile、公共 HTTPS 扩展桥或公共 XHS adapter。
- 退役生产 Web URL 不得进入仓库、Release 或 repository metadata。

## Success criteria

- 用户可创建工作区，添加文字、PDF 或 URL，并启动可持久化、可取消、可恢复的研究。
- 建筑研究按子问题执行有界搜索、读取、分析、核验、补查与综合，并保留阶段检查点和部分结果。
- 图纸灵感严格使用用户已登录 Chrome 中的小红书来源，按方向和帖子保留原笔记出处。
- Board 提供主页、研究进度、完整结果、历史、收藏、对照、导出、备份与恢复。
- Windows 安装器可安装、启动、自检和卸载；安装包不包含扩展。
- Python、Board、Extension、packaged E2E、发布合同与安装 smoke 全部通过，默认测试不需要真实 Provider Key。

## M179 GitHub local-deployment restoration

Status: **complete**

1. **恢复本地运行时**：从 `1695973` 定点恢复桌面启动器、动态回环端口、Windows Credential Manager 配置、Board loopback bridge、本地扩展配对与 Windows 打包链。
2. **保留现行本地行为**：未 reset、checkout 或 clean；通过最小补丁恢复本地路径并保留所有无关用户修改与 `.artifacts/`。
3. **删除退役 Web Edition**：物理删除 `apps/web`、`apps/edge`、`scripts/verify-web.ps1`、Wrangler/Worker 输出、公共 HTTPS bridge/controller、公共 XHS adapter 及其专属测试和 UI 分支。
4. **收敛工程合同**：workspace、lockfile、根脚本、Windows CI、release contracts、README、PRODUCT、DESIGN、architecture、extension、demo、development、failure、AGENTS 与 HANDOFF 均改为本地单产品。
5. **完成权威验证**：完整门禁、独立扩展构建、Windows 安装器构建、真实安装 smoke、冻结程序 `--self-test`、健康端点行为和 packaged E2E 全部通过。

## Verified baseline

- 远端 `main`：`9196119`（已用 `git ls-remote` 核实）；本地 checkout：`agent/local-release-v2.2.2` / `HEAD=2429277`；本地 `origin/main` tracking ref 仍为 `87826af`，因为未 fetch/pull。
- 恢复基线：`1695973`
- API：389 tests passed
- Board：178 tests passed
- Extension：165 tests passed
- Packaged Extension E2E：8 tests passed
- Ruff/format、strict Mypy、Board/Extension lint/typecheck/build、进程、安全、评测与 Windows 发布合同：passed
- Windows 安装器真实安装 smoke：passed
- `git diff --check`：passed
- 可执行代码、配置和面向用户文档的 Web/Edge/Cloudflare 残留扫描：passed

## Provider configuration contract correction

Status: **complete**

1. **显式模型来源**：从上游 `/models` 获取可用列表；低层配置函数只接受已经从该列表选择的模型，并在保存前重新校验。
2. **无手输模型 ID**：桌面首配使用只读下拉列表；PowerShell 配置脚本显示上游列表，用户只输入模型序号。
3. **旧配置兼容**：保留 `gpt-5.6-sol` 作为缺字段旧配置的默认，不用于新配置的自动选择。
4. **验证**：Provider、凭据、启动、脚本合同和完整本地门禁已通过；API 395、Board 178、Extension 165、packaged E2E 8，另完成隔离 Windows 安装器构建与 smoke。

## Local release candidate

| Artifact | Size | SHA-256 |
|---|---:|---|
| `.artifacts/releases/archresearch-chrome-extension-only-v2.2.2.zip` | 18,260 bytes | `9D554576B6DDAAD705EC4E66B1D948EB2305A749CAEFAE40144EC04D8FAD0902` |
| `.artifacts/releases/ArchResearch-Windows-x64-Setup-v2.2.2.exe` | 69,681,830 bytes | `F859C66720D0A493950653F2178E34C7955CBF7D838CD4569C36D994A30162A1` |

## Provider endpoint compatibility

Status: **complete**

目标：允许用户输入同一 Provider 的根地址或常见 API 前缀，由程序自动解析到同时支持模型列表和结构化请求的有效 OpenAI-compatible Base URL，并保存探测成功的地址。

1. **先写红测**：已覆盖根地址回退 `/v1`、常见 `/api/v1` 候选、已带 `/v1` 不重复，以及根地址模型列表可读但能力探测失败时继续尝试后续候选。
2. **最小实现**：已在 Provider 首配层生成同主机候选地址；模型列表按候选合并去重；配置时只探测已选模型并保存成功候选的地址。
3. **验证收口**：已通过 Provider/凭据/启动定向测试、完整 API 门禁、Ruff/strict Mypy、Board/Extension 构建和 packaged E2E；未使用默认真实 Key，未创建研究，未改扩展协议。

## Current user task: research completion after provider failure

Status: **complete**

目标：修复图纸灵感和建筑设计 Run 在 Provider 认证/连接失败时无法完成的问题；不新增 token、费用或用量统计。

1. **图纸失败诊断与红测**：用现有确定性夹具覆盖视觉 Run 的 Provider 认证失败；验证已下载 XHS 图片仍可完成研究，不会被错误丢弃。
2. **图纸失败最小实现**：视觉 Provider 不可用时使用受限的本地确定性分类，保留 XHS 来源与视觉线索边界，并写入 fallback Trace；不调用真实 Provider 或浏览器。
3. **建筑研究失败最小实现**：网页正文分析 Provider 失败时，只复用已读取正文原句生成有证据绑定的案例；远程综合失败时复用已有确定性综合。
4. **真实失败路径验证**：重启本地 API，重试已有失败 Run，确认图纸和建筑研究最终完成，不覆盖用户已有数据。
5. **回归验证与交接**：通过 API 定向测试、Ruff、严格 Mypy 和 `git diff --check`；完成全部修改后再统一提交，不 push。

### Completed in this phase

- 新增视觉 Provider 失败红测：规划认证失败、三方向 XHS 搜索、12 张图的 Run 最终 `completed/coverage_satisfied`。
- `DeterministicFallbackVisualClassifier` 只捕获认证、连接、超时、限流、服务端和请求格式类 Provider 错误；正常远程视觉分类路径不变。
- fallback 只做图片类型/可见特征整理，不提升 XHS 为事实证据；Trace 记录 `deterministic_local_visual` 与错误类型。
- 网页正文分析回退只复用页面原句，并保留逐字 `EvidenceClaim`；远程综合认证/连接失败进入已有确定性综合。
- 视觉/XHS/网页分析/综合回归与 Ruff 已通过。
- 新增零覆盖 retry 红测：重试执行前刷新视觉调用、视觉字节、字节上限和浏览页计数；已有覆盖的部分结果不刷新。
- 新增零覆盖查询恢复红测：不继承上次失败执行中未产出证据的 completed 查询；已有证据的断点续跑仍跳过 completed 查询。
- 图纸真实 Run attempt 2 已完成：34 个结果、3/3 方向覆盖、9 个来源项目，最终 `completed/coverage_satisfied`。
- 建筑真实 Run attempt 2 已完成：36 个结果、4/4 正文覆盖、6 个项目、79 条 EvidenceClaim，最终 `completed/coverage_satisfied`。
- 完整 API 测试套件、Ruff lint/format、strict Mypy 与 `git diff --check` 全部通过；API/Board 已重启并保持健康。

### Current evidence

- 图纸 Run `06843b31-d478-4b82-959f-49c1f15e65be` 的失败 Trace 为 `planner_error_type=AuthenticationError`；修复后 attempt 2 的 XHS 下载和本地分类均完成。
- 当前 Provider 配置是本地 `梭子蟹 API` / `https://suoxie.codes/v1` / `gpt-5.6-sol`；Key 只在 Windows Credential Manager，不读取、不写入计划或日志。
- 建筑 Run 的公开搜索由 `local_browser` 完成，正文回退建立 79 条 EvidenceClaim；本次修复不改变 Provider 用量记录，用户继续以梭子蟹后台为准。

### Errors encountered

| Error | Attempt | Resolution |
|---|---:|---|
| 图纸 Run 将 Provider `AuthenticationError` 吞成 `no_usable_assets` | 1 | 已下载图片改走受限本地分类并完成 Run |
| 建筑 Run 的正文分析 Provider 失败后没有案例可供综合 | 1 | 复用页面正文原句建立证据绑定案例，并让综合认证失败进入确定性综合 |
| retry 原样继承耗尽的视觉/浏览预算并跳过零覆盖查询 | 1 | 零覆盖 retry 刷新本次有界预算，并重新执行未产出证据的旧查询 |

## External gates

- 30 条版本化任务的真实网页批量执行与人工标注需要用户主动启用，并可能产生 Provider 费用。
- 100+ 独立来源、权利清晰的真实图纸样本仍是外部数据门槛；当前 108 张为确定性合成夹具。
- GitHub Hosted CI run `30636022102` 已于 `2026-07-31 14:09:09 UTC` 成功；coverage、完整本地门禁、安装器构建和 smoke 均通过。
- PR #11 已于 `2026-07-31 14:34:44 UTC` 合并到远端 `main`，merge commit 为 `9196119`；不重新发布已有 `v2.2.2` Release。

## Session note

- 规划 skill 的 `session-catchup.py` 首次调用系统 `python` 时命中 Microsoft Store 别名并失败；随后改用 `apps/api/.venv/Scripts/python.exe` 成功，报告 75 条未同步上下文。过程未写入仓库。

## Next action

Provider 失败与结果可见性修复均已完成；下一步由用户在当前 Board 查看两条完成结果。不新增用量统计，不调用 Codex 内置浏览器，不 push。

## Result visibility after externally completed retry

Status: **complete**

目标：确保 Provider 失败后的确定性正文回退结果能按子问题展示案例，不能让后端已完成且有逐题证据的 Run 被 Board 的中文分析门槛全部过滤为空。

1. **复现与红测**：覆盖确定性回退保留英文来源原句、中文转译动作、逐题分析和逐字证据时，完成页仍应显示案例；普通旧英文图片线索继续不得升级为案例。
2. **最小修复**：只放行有逐题分析、中文回退边界且正文原句已绑定 EvidenceClaim 的确定性回退，并以明确的中文“来源原文”标签展示原句；不放宽一般图片线索门槛。
3. **用户可见验证**：重新打开真实 Board 数据并确认四个子问题都显示案例，不再显示四个空状态。
4. **回归与提交**：通过 Board 定向测试、lint、typecheck、build 和 `git diff --check`；单独提交本次可见性修复，不 push。

### Current evidence

- 用户截图中的建筑 Run 已显示研究结论，但四个子问题都显示“这一问题暂时没有可用结果”。
- 同一 Run 的 `/results` 当前返回 36 条结果，其中 22 条有逐题正文分析；program/circulation/section/structure 分别有 12/12/6/4 条逐题分析。
- `toWorkResult()` 当前只在顶层 `project_context` 和 `design_mechanism` 含中文时设置 `analysisReady=true`；这 36 条均不满足，导致 `caseResults` 为 0。
- 确定性正文回退有英文来源原句、中文转译动作、中文回退边界和逐字 EvidenceClaim；根因不是 API 空结果或页面旧缓存，而是 Board 没有识别这种受限但已绑定证据的回退合同。

### Completed in this phase

- 新增 Board 行为测试，覆盖有逐题正文证据的确定性回退必须显示为案例；保留一般旧英文图片线索不得升级为案例的既有保护。
- `toWorkResult()` 只识别逐题关联一致、中文回退动作与边界存在、条件和机制均精确绑定 EvidenceClaim 的确定性回退；来源句以“来源原文：”明确展示。
- 真实 36 条结果 Run 在四个章节分别显示 3/3/2/1 个案例，四章空状态均为 0。
- Board 179 tests、lint、typecheck、production build 与 `git diff --check` 全部通过。

### Errors encountered

| Error | Attempt | Resolution |
|---|---:|---|
| Windows 下把 `**/*.test.tsx` glob 直接作为 `rg` 路径参数，返回路径语法错误 | 1 | 改用 `rg ... apps/board/src -g '*.test.ts' -g '*.test.tsx'`，只读搜索成功 |
| Playwright 按问题前缀定位到两条同名历史 Run，strict mode 拒绝点击 | 1 | 使用当前 Run 可见的“36 张参考”信息精确定位，真实页面验证成功 |

## v2.2.3 real-provider release qualification

Status: **complete**

目标：用当前 Windows Credential Manager 中的 Provider 凭据执行多条全新真实研究，确认建筑与图纸两条产品路径都完成且确实成功调用 Provider；随后整理两个未发布修复，构建、实装验证并正式发布最新本地部署包。

1. **真实 Provider 验收**：依次创建 2 条建筑快速研究和 2 条图纸灵感研究；每条都必须达到可交付终态、有逐题/逐方向结果，并在 Trace 中出现成功的 Provider 规划、分析、视觉或综合调用，不能只靠 deterministic fallback。
2. **版本与发布合同**：真实验收通过后把补丁版本统一提升为 `2.2.3`，同步 Release/安装器合同和面向用户的修复说明，不恢复退役运行时。
3. **完整本地门禁**：运行权威验证、独立扩展打包、Windows 安装器构建、真实安装/卸载 smoke、冻结程序自检与健康端点；记录产物大小和 SHA-256。
4. **GitHub 发布**：显式暂存并提交版本变更，推送当前分支，建立并合并 PR，等待 Hosted CI 成功后创建 `v2.2.3` tag 与正式 Release，上传 Windows 安装器和独立扩展 ZIP。
5. **发布核验与交接**：核对 GitHub Release 标题、附件大小、SHA-256、非草稿/非预发布状态和远端 `main`；不发布 Provider Key、真实研究数据或退役 Web URL。

### Success criteria

- 四条新 Run 覆盖建筑与图纸，各自完整展示结果；任何 Provider 认证/连接失败或纯本地回退都阻止发布。
- API Key 只由运行时从 Windows Credential Manager 使用，不读取、不打印、不写入仓库或 Release。
- `v2.2.3` Windows 安装器自包含本地 API + Board，且不捆绑扩展；扩展仍为独立 ZIP。
- 本地门禁、真实安装 smoke、Hosted CI 和 Release 附件核验全部通过。

### Model-assisted local search correction

Status: **complete**

默认建筑研究链路固定为：模型拆题与生成独立搜索词 -> 本地 Playwright 搜索候选 -> 模型只从候选集中结构化筛选 -> 本地浏览器读取正文与图纸 -> 模型分析 -> 程序绑定 URL 和逐字 EvidenceClaim。

1. **结构化合同红测**：用 Pydantic 锁定逐子问题搜索词计划和候选筛选；覆盖图书馆、旧厂房、候选 ID 白名单、重复/低相关排除、差异化补查、Provider 降级、预算和 XHS 隔离。
2. **普通 Responses 辅助**：Provider 仅用普通 `responses.parse` 生成查询和筛选候选；默认禁止原生 `web_search`，不要求兼容 API 支持工具调用。
3. **本地搜索闭环**：每个子问题每轮最多 2 条中英文适配查询；候选 URL、标题、摘要由本地搜索产生，模型不得编造 URL；已访问、重复项目和已判无关页面进入排除集合。
4. **补查与降级**：覆盖不足时把缺失子问题、失败原因和排除摘要交给模型生成不同补查词；规划或筛选失败时使用改进后的确定性模板，未知类型默认 `public building` 而非旧建筑改造。
5. **Trace 与验收**：记录 `search_query_planning`、`candidate_reranking` 的 Provider 状态、子问题/候选/保留数量和 fallback 错误；建筑发布验收不得依赖确定性查询或筛选 fallback。

#### Search success criteria

- 社区图书馆查询包含 library、atrium、stepped reading、circulation、daylight、structure，且不出现无关改造模板词。
- 旧工业厂房改造保留 adaptive reuse、industrial building、retained structure 等条件词。
- 候选筛选只返回本地候选 ID；重复 URL、重复项目、低相关项和已排除项不进入完整页面分析。
- 查询数、Provider 调用、页面读取均受现有 Run 预算约束；XHS 图纸研究不进入普通网页路径。
- 2 条建筑真实 Run 均为 `completed/coverage_satisfied`，Trace 含成功搜索词规划、候选筛选、正文分析和综合；2 条图纸真实 Run 保持 XHS-only 并完成三方向结果。

### Current qualification evidence

- 新 Provider 配置的模型列表读取成功：返回 8 个模型，所选 `gpt-5.6-sol` 存在。
- 所选模型的 `responses.structured_output` 真实能力探测成功；Key 仅由 Windows Credential Manager 提供，未读取或输出。
- 模型辅助本地搜索核心工作流、旧 Provider 可控时钟兼容、零覆盖 retry 重检、完整 API、Ruff lint/format、strict Mypy 和 `git diff --check` 已通过。
- 候选 fallback 已区分新旧 Provider：支持 reranker 的真实模型路径在调用失败或时间不足时执行严格类型/相关性过滤；未实现新协议的旧 Provider/mock 保留原确定性排序。先前 8 个兼容失败与新增低相关 fallback 测试均通过，随后完整 API、Ruff、strict Mypy 和 `git diff --check` 全绿。
- 真实候选诊断后补齐召回合同：确定性补查从总题继承新建/改造条件与类型，非新建站点压缩仍优先保留 library，同类型可信项目即使搜索摘要为空也由模型保留一次正文核查机会；完整 API 与静态门禁通过。
- API/Board 已重启并加载稳定子问题域名槽位修复；当前只运行建筑 Run `ca3c9228-272e-4ec7-8144-76b97906bb2e`，等待终态后按完整 Provider Trace 与 EvidenceClaim 门槛判定，期间不创建并发 Run。
- 该 Run 已以 `partial/budget_exhausted` 终止，仅 1/3 覆盖；新增红测锁定中庭功能查询被 `section` 误判、缓存页抢占新候选唯一分析名额，以及后期强页无法补早期分支。最小实现、相关 245 项、完整 API 426 项、Ruff、64 文件格式检查、strict Mypy 和 `git diff --check` 均通过，待重启后创建全新 Run。
- 恢复缓存修复后的 Run `cb2eb4a3-6c9f-4a62-b740-f28836698642` 自然终止为 `partial/budget_exhausted`、1/3 覆盖；Calgary New Central Library 为跨层流线形成逐字 EvidenceClaim，15 次查询规划、15 次候选筛选、10 次正文分析和综合均由 Provider 成功，fallback/XHS 均为 0。该 Run 保留且不 retry。
- 从该 Run 的真实查询新增 5 条站点压缩红测：公共楼梯/坡道/步行廊道必须保留 `atrium circulation`，阅览平台/多功能房/公共客厅必须保留 `atrium program layout`，`purpose-built` 必须识别为新建。最小同义词和新建条件修复后参数化测试 10/10、完整 API 435/435、Ruff、64 文件 format check、strict Mypy 26 个源文件和 `git diff --check` 全绿。
- 工业改造 Run `dfadd8a8-4f45-42cf-99dd-8d2401f0eaa5` 最终用 Rotterdam 仓库同一页的 Provider 正文证据覆盖 3/3，但仅 1 个项目、2 个资产，终态仍为 `partial/budget_exhausted`，不计入验收且不 retry。15 轮中 5 次本地搜索超时、1 次一般错误、3 次零结果，只有 6 轮形成候选。
- 审计确认模型原始查询准确，但站点压缩把功能与采光查询都改成公众/后勤流线；弱类型候选又阻止同站点宽化，工业宽化词还丢失文化中心条件。新增 6 条行为红测后，功能/采光机制、弱候选宽化和 `industrial adaptive reuse cultural center program` 均已锁定；公开页面 60/60 通过，真实项目 Playwright 已召回文化枢纽、改造舞蹈中心、画廊和旧茶仓候选，待扩大回归。
- 相关五文件 242/242、完整 API 441/441、Ruff、64 文件 format check、strict Mypy 26 个源文件和 `git diff --check` 已通过；最新 Run `07a2ca39-ce70-4b6c-8989-98b3f207c4a9` 达到 3/3 覆盖、12 个资产、3 个项目，但因 `multi_asset_projects=0` 终止为 `partial/no_new_assets`，不计入验收且不 retry。
- 只读审计确认 Deichman 已缓存同页 `analysis_diagram`、`axonometric`、`section` 三类资产，但均未进入正文分析；综合第一次 `APITimeoutError` 后直接使用确定性回退。下一步以这两个真实缺口补红测，不增加查询、页面读取或 Provider 最坏调用预算。
- 两条红测已转绿：覆盖完成且仅缺多资产类型时，工作流从已缓存、至少含两种图纸类型的项目页选择一个未分析分支，最多补一次正文分析，不新增搜索或页面解析；综合 `APITimeoutError` 复用原两次循环的第二次机会，最坏调用预算不变。
- 相关四文件 198/198、完整 API 443/443、Ruff lint/64 文件 format check、strict Mypy 26 个源文件和 `git diff --check` 全绿。下一步重启并创建第一条全新建筑验收 Run。
- 第一条修复后建筑 Run `5a8dd293-f844-4bb0-ab1b-4ca1a2f63e00` 为 partial，不计入验收；比较型 Run `87b31259-2182-485d-b592-7291d592c3cc` 暴露命名项目被站点压缩删除，在无正式结果时取消。
- 命名项目查询红测与最小修复已完成：每条模型查询至多保留一个显式项目锚点，站点压缩不再删除该名称。相关 222 项、完整 API 445 项和静态门禁全绿。
- Run `7525616f-1864-44ea-9644-044857bb45f2` 验证 15 条真实查询均保留单项目锚点，但因页面分析首次 `APITimeoutError` 直接 fallback 且仅 1 个正式项目而不计入验收。页面分析现可在原两次总调用预算内重试一次瞬时超时；相关 200 项、完整 API 446 项、Ruff、strict Mypy 和 `git diff --check` 全绿，待重启后创建全新 Run。
- Run `3bec22da-8484-4f9b-9053-24a0231b565f` 无 fallback 且 Calgary 覆盖 2/3，但 Daegu 未召回，终态 partial。命名项目第二次站内宽化现继续保留项目名、条件、类型、机制和证据类型；项目 Playwright 已真实召回 Daegu 首位，相关 224 项、完整 API 447 项与静态门禁全绿，待重启后创建全新 Run。
- Run `e2c64da9-9e0a-4c60-9336-501fab671561` 因查询规划/候选筛选 `APIConnectionError` fallback 在 0 资产时取消；随后项目 Provider capability probe 成功。
- Run `11a62e85-81ed-40e5-93c7-9aeca58eec70` 暴露单项目查询候选漂移：Daegu 查询中模型保留 Calgary，页面扩展又进入住宅和 podcast；无正式证据且后续出现 fallback，已取消并保留。
- 当前修复步骤：先用红测要求单个命名项目锚点在模型筛选前过滤候选，支持每轮最多 2 条独立查询且不改变无命名查询；随后跑完整门禁并创建全新单活建筑 Run。
- 候选锚点修复已完成：单项目漂移、双项目独立锚点和无命名兼容测试通过；相关四文件 226 项、完整 API 449 项、Ruff、64 文件格式、strict Mypy 和 `git diff --check` 全绿。下一步重启并开始第一条建筑真实验收。
- 修复后 Run `edf2aae3-60dc-479f-92b8-ae1a2b4c18fe` 验证 Daegu 锚点与正文链路正确，但因候选筛选/正文连接 fallback、最终综合超时 fallback 和 rooflight 正文证据不足，以 `partial/no_new_assets` 结束；不计入验收且不 retry。
- 当前真实验收仍为 0/4；下一步先运行不暴露 Key 的项目 Provider capability probe，成功后创建一条不机械重复 rooflight、改用已知正文可证实机制的全新单活建筑 Run。
- capability probe 成功后的 Run `e7b143e9-9ef1-4bf5-9dde-b6d9d137396f` 达到 3/3 正文覆盖但只形成 Hunters Point 一个正式项目，且含 Provider fallback，不计入验收。
- 新根因已定位为命名项目身份未传递到 Designboom 页面扩展：Daegu 父项目页被正确读取后，程序转而分析侧栏 podcast/住宅。下一步强化现有命名候选红测，使相关链接也不得被读取，再做最小扩展过滤修复。
- 命名页面扩展和瞬时 Provider 有界重试均已完成；相关四文件 230 项、完整 API 453 项与全部静态门禁通过。下一步重启后用同一命名比较题创建全新 Run，验证 Daegu 父页直接分析、项目多样性和 fallback=0。
- 修复后命名 Run `259efb0e-a0ed-4258-b4e3-caa9572b030d` 无 Provider fallback，父页直读正确，但因 Hunters/Calgary 对应站点没有召回匹配项目，以 2/3 partial 结束。下一步改用不强制项目名、机制仍可逐字证明的普通新建社区图书馆问题创建全新 Run。
- 普通图书馆 Run `104aa378-ce28-4238-9a96-ddfd7edd70c3` 达到 3/3、16 个资产和 3 个项目，但正文/查询规划/综合均有 Provider fallback，且 `multi_asset_projects=0`，终态 partial，不计入验收且不 retry。
- 针对该 Run 新增三项红测驱动修复：多图纸 recovery 优先正文意图匹配的子问题；quick 综合首次保持 medium、瞬时错误第二次改用 low；完整语义 article 优先并移除 Designboom `architecture connections` 推荐区。真实 Constitución 页面复核无两条污染句；相关 228 项、完整 API 455 项、Ruff、55 文件格式、strict Mypy 26 个源文件和 `git diff --check` 全绿。下一步重启、probe 并创建全新单活建筑 Run。
- 后续 Run `d0f41d2d-923c-45c8-ac15-9cf0ddfd9514` 仍为 partial；新增具体父页直读和 quick 综合 shared deadline 红测已局部通过，但扩大回归有 4 个 remote-visual 兼容失败，当前阶段未收口，必须先修复再创建新 Run。
- remote-visual 兼容失败已定位为合法 `Courtyard Archive` 项目名被过宽标题守卫误判，修复后定点 8/8、相关四文件 229 项和完整 API 456 项通过；待静态门禁后重启验证。
- 静态门禁已完成：Ruff、55 文件格式、strict Mypy 26 个源文件与 `git diff --check` 全绿。下一步重启、probe，并用同题新 Run 验证父页直读与综合 shared deadline。

### Errors encountered

| Error | Attempt | Resolution |
|---|---:|---|
| `session-catchup.py` 调用系统 `python.exe` 命中 Microsoft Store 占位符 | 1 | 改用 Codex 工作区捆绑 Python，恢复报告成功生成 |
| 开发 API 的 `/desktop-health` 返回 404 | 1 | 当前源码服务以 `/health` 和 Board 200 验证；安装版 `/desktop-health` 留到安装 smoke 验证 |
| 第一条建筑验收 Run 终态为 `partial/budget_exhausted`，仅覆盖 1/3，综合因 `ValueError` 使用确定性回退 | 1 | 正在定位结构化综合校验和低相关重复检索的具体合同缺口；该 Run 不计入发布验收 |
| 综合诊断脚本首次导入不存在的 `archresearch_api.repository` | 1 | 改用 `agent.execution.get_run`；未触发 Provider 请求，第二次脚本成功执行 |
| 相关回归仍断言单次综合最坏耗时，中文采光查询要求旧短语连续 | 1 | 同步预期为两次有界综合；结构词移到原中文短语之后，保留旧查询合同 |
| 新图书馆 Run 的三个不同子问题生成了相同“环形流线”公开搜索词 | 1 | 用真实规划子问题补红测；为自然光/眩光/侧高窗和声学/噪声/动静分区增加明确意图权重 |
| 模型辅助搜索红测在缺失新 Pydantic 合同处无法收集 | 1 | 预期红灯；开始实现查询计划、候选评估模型和普通 Responses 方法 |
| 新搜索辅助无条件读取可控 `clock()`，并让零覆盖 retry 继承旧来源排除集 | 1 | 仅在规划/筛选 Provider 存在时读取时间；零覆盖 retry 清空跨 attempt URL、项目和已检查页面排除，3 个兼容红测与 strict Mypy 转绿 |
| 首条新模型辅助建筑 Run 的 15 次规划成功但本地搜索形成 0 个候选，终态 `blocked/research_synthesis_incomplete` | 1 | 保留失败 Run，不启动第二条；正在核对真实查询文本、搜索域名轮换和 Direct Playwright 返回合同 |
| 站点召回修复后的建筑 Run 已读取并分析相关图书馆，但 relevance=2 的正文分析未形成正式项目证据，终态仍为 0/3 | 1 | 保留失败 Run；正在核对 PublicPageAnalysis 字段、持久化资产和 EvidenceClaim，先补正文证据合同红测 |
| 证据纠正后的 Run 只覆盖采光 1/3，且候选 fallback 打开偏题页 | 1 | 已补逐字 excerpt 校验和 deterministic fallback 类型/文本相关性门槛；待完整回归与重启后用新 Run 验证 |
| deterministic 候选过滤破坏 8 个旧 Provider/mock 兼容测试 | 1 | 仅对支持新 reranker 协议的 Provider fallback 启用严格过滤；旧协议路径保留原排序，8/8 回归和完整 API 均通过 |
| 正式 Board payload 的新建社区图书馆 Run 经过 15 次模型规划/筛选仍为 0/3 覆盖 | 1 | 查询语义和模板边界均正确；只形成 4 个可读项目页，下一步重放关键站点查询定位候选召回与正文可证实性缺口 |
| 不含 `new-build` 的确定性补查把 library 压缩为 cultural center，空摘要同类型项目被 reranker 全拒绝 | 1 | 补查继承总题项目条件；站点压缩优先识别 library；prompt 允许可信同类型项目进入正文核查，相关 89 项和完整 API 全绿 |
| 第二版图书馆 Run 已形成真实 EvidenceClaim 但仅 1/3 覆盖 | 1 | 已确认同页跨题复用正常；问题把阶梯阅读/闭合环线/侧高窗/结构跨度设成复合硬条件，下一条改用正常粒度验证产品链路 |
| 正常粒度图书馆 Run 达到 2/3 后，唯一未覆盖题重复弱站点且未轮到 ArchDaily/Designboom | 1 | 域名选择改用固定子问题目录槽位，不再随已覆盖分支跳过而漂移；新增红测、相关 161 项与完整 API 通过 |
| 稳定槽位 Run 最终仅 1/3；中庭功能查询被证据词 `section` 压缩掉机制，缓存 Calgary 页又占用屋顶采光分支唯一分析名额 | 1 | 增加共享阅览/社区活动功能意图；新页先于缓存页分析；有恢复轮时循环末仅用已读缓存页补一个仍缺失分支。相关 245 项和完整 API 426 项全绿 |
| 已知建筑站点搜索空结果、导航超时或仅返回零相关页面后没有本地补源 | 1 | 红测覆盖三种模式；外部搜索引擎实测不可用后改为同站点宽化短查询，并新增 40 秒搜索专用最坏预算，定向测试 3/3 通过 |
| 首次降级实现把 fallback 块插入候选去重 `if/elif` 中间，产生 `SyntaxError` | 1 | 将候选校验/归并收敛为局部 `add_results()`，格式化后定向测试通过 |
| 短查询诊断脚本误导入不存在的 `PlaywrightBrowserPageParser` | 1 | 删除错误导入后重跑；尚未发起浏览器请求，未影响产品或真实数据 |
| 重启后检查工作区时先后误用 `/workspaces` 与 `/api/workspaces` | 1 | 两者均只读 404；读取 router/OpenAPI 后改用正确 `/v1/workspaces`，确认 1 个工作区、0 个活动 Run |
| 新建筑 Run 最终仅 2/3；恢复轮第二个模型保留候选未解析，最终补分析只能复用旧正式案例 | 1 | 在既有 2 页恢复额度内缓存第二个可信候选，仅 final completion recovery 可选择未分析页；红测与相关 9 项通过 |
| 恢复红测编辑时两次相似 `parse()` 上下文误匹配，分别污染旧测试和造成目标 `NameError` | 1 | 用类名精确定位，移除旧测试污染并在目标 parser 声明变量；Ruff 与目标测试通过 |

### Current acceptance checkpoint

- A/B Run `5c785452-d1f0-434e-b8fd-81d7a88daa73` 已自然终止为 `completed/coverage_satisfied`：15 个可用资产、8 个项目、3/3 子问题、`multi_asset_projects=1`，coverage 与 enrichment gap 均为空。
- 四类关键 Trace 均出现成功记录；当前只发现一个被跳过的本地页面读取错误，尚未发现 Provider 或 deterministic fallback。仍需完成查询来源、候选白名单和 EvidenceClaim 逐字审计后才能计为建筑 1/2。
- 唯一下一步：只读联合 `QueryAttempt`、`SourcePage`、`AssetCandidate`、`EvidenceClaim` 和 Trace；不创建新 Run。
- 只读审计完成：9 条查询不重复且没有题外模板词，7 个 SourcePage URL 不重复，15 个结果均绑定已读页面；四类 Provider Trace 成功且无 deterministic fallback。51 条正文事实都有 excerpt，并在写入前经过当次 Playwright 正文逐字校验；6 条无 excerpt 的图纸归属事实仅作图片索引，不承担机制证明。
- 该 Run 计为建筑验收 1/2；唯一下一步改为确认单活为 0，并创建旧工业厂房改造建筑 Run。
- 创建第二条真实 Run 前的全局证据审计发现：项目页图像 `alt` 为空时，统一持久化函数会生成没有逐字 excerpt 的 `fact`。已用社区图书馆、工业厂房改造、文化中心扩建三种项目名写红测，确认问题与题型无关。
- 通用修复只改 `_persist_expanded_project_page()`：有逐字 `alt` 继续生成事实；无 `alt` 改为绑定真实 image URL 和整图区域的 `observation`，并明确类型来自 URL 线索。5 项定向/兼容测试通过；下一步跑相关与完整全局门禁。
- 全局门禁完成：相关四文件 236 项、完整 API 459 项、Ruff、55 文件格式、strict Mypy 26 个源文件和 `git diff --check` 全部通过。下一步确认单活并重启后执行第二条真实建筑验收。
- 服务重启、API/Board 健康检查和真实 `responses.structured_output` probe 通过；已创建唯一活动旧工业厂房改造 Run `d8105a98-cea9-4dc8-934d-bb6db0e3e6c5`，创建时子问题为 0。唯一下一步为轮询和完整审计。
- 该 Run 已以 `blocked/research_synthesis_incomplete` 终止，不 retry、不计验收。按用户要求暂停新建真实 Run，先收口所有已知通用缺口与全局回归。
- 新增 `roof extension` / `vertical extension` 反例并修复共享项目扩建条件判断；查询生成、首次站点压缩和宽化压缩均使用同一规则，不含项目名分支。
- 审核并更新与新搜索合同冲突的旧断言：明确证据类型不再被压缩删除；每个子问题前两轮覆盖 ArchDaily/Designboom；不得默认生成 `box-in-box` 或 `loading dock`。
- 相关四文件 243 项、完整 API 466 项、扩建/模板词定向 8 项、Ruff、55 文件格式、strict Mypy 26 个源文件和 `git diff --check` 全绿；生产源代码验收项目名扫描为 0。
- 当前活动 Run 为 0。唯一下一步：重启源码服务、执行不暴露 Key 的 capability probe，然后创建一条新的单活建筑验收 Run。
- 2026-08-02 API/Board 与活动 Run 状态复核正常；今天唯一一次 Responses probe 仍为上游 503，不创建 Run。
- XHS 预检完成：browser connected、search available，OpenCLI 返回 4 条且全部为小红书笔记 URL。上游恢复后无需再次做 XHS 通道预检。
- 连续第三个目标回合的 Responses probe 仍返回 503；真实验收与发布无法在不伪造 Provider 成功的情况下继续，当前阶段正式标记为外部阻塞。恢复后唯一动作仍为单次 probe。
- 目标已重新激活；新阻塞审计第 1 个回合仍为 Responses 503。下一回合只探测一次，成功则立即恢复单活验收。
- 新阻塞审计第 2 个回合仍为 Responses 503，当前 2/3；下一回合成功则继续验收，失败则重新标记外部阻塞。
- 最小普通 Responses 隔离仍返回 nginx 502，而 `/models` 与当前模型正常，确认中转推理上游故障；用户要求等待修复，当前暂停探测和真实验收。
- 中转恢复后的单次 Responses structured-output probe 已成功；创建唯一活动建筑 Run `a3f722fe-42ee-4329-af4b-96277cfc7347`，社区文化中心扩建，未预填子问题。下一步只轮询和审计该 Run。
- 该 Run 已以 `blocked/research_synthesis_incomplete` 终止并保留：15 条模型查询与实际模型辅助 Trace 无 fallback，但恢复域只形成 7 个去重页面、0 个正式资产。项目 Playwright 证实 Dezeen/Divisare 多词站内恢复失效，Bing RSS/HTML 也不能提供受限结果。
- 通用候选召回修复先写红测：第 3 轮先回到 ArchDaily/Designboom，后续再扩域；Provider 覆盖失败时轮换 `extension/expansion/addition/new wing` 等价条件词；站点压缩保留所选同义词且不误加 adaptive reuse。目标 6 项、相关四文件 249 项、完整 API 472 项、Ruff、55 文件格式、strict Mypy 和 `git diff --check` 全绿。
- 服务重启后 API/Board 健康，真实 capability probe 调用成功；已创建唯一活动建筑 Run `322028c8-003b-4422-ae77-f4ac48bb891b`。唯一下一步为轮询和完整 Trace/EvidenceClaim 审计，不创建并发 Run。
- Run `322028c8-003b-4422-ae77-f4ac48bb891b` 终态仍为 `blocked/research_synthesis_incomplete`；第 2 轮一次 `APIConnectionError` 触发 deterministic query fallback，不计正式验收。第 3 轮可靠站点复用和扩建同义词轮换已真实生效，但该过度复合问题仍为 0/3，不能通过放宽 EvidenceClaim 或正文门槛制造完成。
- 普通网页查询现剔除 `小红书/Xiaohongshu/XHS/登录态` 来源词，XHS 运行路径未改。新增目标测试后，完整 API 473/473、Ruff、64 文件格式检查、strict Mypy 26 个源文件和 `git diff --check` 全绿。
- 中转恢复后的单次 `responses.structured_output` probe 成功；已创建唯一活动旧工业厂房改造 Run `9f31598c-2601-4fac-9caa-b84be01a9aad`，`quick/precedent_research/research_sources=[]`，创建时子问题为 0。唯一下一步为轮询和完整审计，不创建并发 Run。
- 第二条建筑 Run `9f31598c-2601-4fac-9caa-b84be01a9aad` 已完成并通过审计：`completed/coverage_satisfied`，3/3、11 个资产、3 个正式项目、1 个多图纸项目；75 条 Trace 无 Provider/deterministic fallback，四类关键模型阶段均成功。
- 6 条模型查询准确保留 industrial factory、adaptive reuse、community cultural center、当前机制和证据类型，没有 `box-in-box/loading dock`；5 个 SourcePage URL 无重复，11 个结果均绑定已读页面，64 条 fact 都有逐字 excerpt 且 URL 不越出白名单。
- 项目 Playwright 事后动态重读累计复核 60/64 条引文；余下 4 条对应 ArchDaily 当前 4.5k-5k 短页版本。生产写入仍由当次完整页面 `_supported_project_facts()` 精确验证，没有降低 EvidenceClaim 门槛。当前正式验收为 2/4；下一步顺序执行两条 XHS-only 图纸 Run。
- 第一条 XHS Run `f6a7fb48-cd22-4033-b90f-14af3fbb762c` 已通过：`completed/coverage_satisfied`，3/3、23 个本地图纸、9 个来源项目。规划记录 `planner=openai`，3 次 OpenCLI XHS 搜索、9 篇可用笔记和 30 次视觉调用均完成，fallback=0。
- 12 个 SourcePage 与 23 个结果全部是 XHS URL，23 个结果均有本地文件；Trace 中 `search_query_planning/candidate_reranking/public_page_analysis/local_browser` 事件均为 0。当前正式验收为 3/4，下一步创建第二条不同题型的 XHS-only Run。
- 第二条图纸 Run `814e997c-592b-4fee-b947-25cb37320025` 虽返回 `completed/coverage_satisfied`、3/3 和 20 个本地图纸，但最后方向达到 4 帖上限后仅 2 篇 usable。它违反既定每方向 3 篇 usable 合同，保留但不计验收。
- 新集成红测复现“图纸覆盖已满足、全局视觉额度未耗尽、单方向 4 帖仅 2 篇 usable”仍被误标 completed；最小生产修复让 XHS-only 完成许可直接取决于三方向 note target。
- 3 个冲突旧测试按现行合同更新：1 篇 usable 明确 partial；本地视觉回退和类型过滤在每方向 3 篇 usable 后仍 completed。完整 API 474/474、Ruff、64 文件格式、strict Mypy 和 `git diff --check` 全绿。
- 服务重启并 probe 成功后的新 Run `eb317b7b-863e-4ae0-9966-5b399d7516d9` 验证修复真实生效：尽管 3/3、12 个图纸和 coverage/enrichment gap 为空，因一个方向 4 帖仅 2 篇 usable，终态为 `partial/visual_budget_exhausted`。另有一次视觉 `APIConnectionError` fallback，明确不计验收。
- 新 XHS Run `7405fca2-003c-4446-beaa-48c96cb52d34` 达到严格完成合同：`completed/coverage_satisfied`，3/3、24 个本地图纸、9 个项目，每方向 usable 笔记 `[3,3,3]`，35 次真实视觉调用，fallback=0，普通网页路径事件为 0。当前正式验收 4/4。
- 项目 Playwright 打开四条正式 Run：两条 XHS 分别显示并实际加载 24/24、23/23 图片，各 9 篇帖子；两条建筑显示 6、8 个逐题案例，全部图片加载成功，均有研究结论、3 个子问题且没有空章节。
- QA 截图保存在 `.artifacts/qa/v2.2.3-board/`；下一阶段统一升版 `2.2.3`，执行完整发布门禁、独立扩展与自包含 Windows 安装器构建、真实安装 smoke、提交、CI、合并和正式 Release。
- `2.2.3` 版本面已统一：API、Board、Extension、manifest、Windows CI artifact、Release 合同测试、README 与部署文档一致；Release 合同红测先失败后转绿，非历史发布面不再引用 `2.2.2`。
- 权威 `scripts/verify.ps1` 已完整通过：API 474、Board 179、Extension 174、packaged E2E 8，Ruff、64 文件格式、strict Mypy、前端 lint/typecheck/build 和发布合同均为绿。
- 独立 Chrome 扩展 ZIP 已构建并核验：18,260 bytes，manifest `2.2.3`，SHA-256 `DF1EFDC5381F559BCBE6ADC65D0AE5E79E19B6722237FB229E9FEF761D74E346`。
- Windows 安装器已构建：69,715,457 bytes，文件/产品版本 `2.2.3`，SHA-256 `A1F2658D9540966B5D1F24B90012F5CA1654FE90E863789B58F7B72A8E660D65`。
- `v2.2.3` 安装器真实 smoke 已通过：静默安装、冻结程序自检、健康检查、快捷方式、扩展排除、静默卸载与残留检查均成功。
- 24 个跟踪文件已显式暂存并创建统一 `v2.2.3` 发布提交；`.artifacts/` 与 `.archresearch/` 未提交。
- 发布分支已推送并通过面向 `main` 的 Windows Hosted CI。
- 发布已完成：PR #13 通过 Windows Hosted CI run `30718825811` 后 squash merge，远端 `main` 与 `v2.2.3` tag 均指向 `fc4e7a72dd7c86b61ffb3ad91c76d3c690e9fe47`。
- 正式 Release 为 `ArchResearch 本地版 v2.2.3`，非草稿、非预发布；Windows 安装器与独立扩展 ZIP 的 GitHub 大小和 SHA-256 均与本地 smoke 产物一致。
- 当前计划无未完成阶段；等待用户提出下一项工作。
