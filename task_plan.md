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

## Phase 14: Xiaohongshu first-login preflight

**Status:** complete

**Goal:** 图纸研究只能在受限、只读的小红书登录预检成功后创建 Run；未登录用户可以直接打开小红书登录页并在登录后重新检测。

1. **红测与合同** `completed`
   - 覆盖 OpenCLI 存在但未登录、扩展已连接但小红书未登录、登录已就绪和建筑研究不受影响。
2. **受限登录预检实现** `completed`
   - 不读取或保存 Cookie、账号、密码或浏览器存储；后端返回经验证的状态，Board 不再以“搜索后端存在”代替“已登录”。
3. **首次使用交互** `completed`
   - 未登录时不创建 Run，显示明确信息和“打开小红书登录”操作；登录后刷新状态才允许研究。
4. **回归与真实 smoke** `completed`
   - 运行 Python/Board/Extension 定向与相关回归，用项目 Playwright 验证未登录阻断和已登录解锁，不重做已完成的研究 Run。

### Phase 14 completion evidence

- 权威 `scripts/verify.ps1` 完整通过：API 485、Board 181、Extension 182、packaged E2E 8；Ruff、strict Mypy、ESLint、TypeScript、生产构建、发布与安装器合同全部通过。
- 真实本地端点返回 `logged_in/local_search`；只输出登录状态和通道，不输出 Cookie、账号、命令原文或 Provider Key。
- 项目 Playwright 在桌面和移动端验证真实登录态显示“研究环境已就绪”；模拟未登录态在提交前再次预检，Run POST 为 0，并显示固定登录链接和“重新检测”。
- 四张 UI smoke 截图保存在 `.artifacts/qa/xhs-login-preflight/`；本阶段没有创建或重跑真实研究 Run。

### Phase 14 errors encountered

| Error | Attempt | Resolution |
|---|---:|---|
| `session-catchup.py` 调用系统 `python.exe` 命中 Microsoft Store 占位符 | 1 | 改用 Codex 工作区捆绑 Python，catchup 成功 |
| 首次更新计划时上下文误写为 `## Errors encountered` | 1 | 读取文件尾部后改为追加独立 Phase 14 |
| 并行读取用 `Promise.all` 包含可返回 1 的 `rg`，导致输出被丢弃 | 1 | 改用 `Promise.allSettled`，后续检索均保留独立结果 |
| 读取不存在的 `HomeComponents.tsx` | 1 | 用 `rg --files` 确认真实文件名后再读取；同一并行调用的其他结果已保留 |

## Phase 15: Six-run stability qualification and v2.2.4 release

**Status:** in_progress

**Goal:** 用 3 条全新建筑问题和 3 条全新 XHS-only 图纸问题验证当前研究链路的跨题型稳定性；六条全部通过后，将现有未发布修改统一发布为 `v2.2.4` Windows 本地版。

1. **恢复与发布前提** `completed`
   - API/Board 健康，Provider 为 `openai/gpt-5.6-sol`，小红书会话为 `logged_in/local_search`，活动 Run 为 0；GitHub CLI 已认证。
2. **三条建筑稳定性验收** `completed`
   - 三条宽泛概念初期建筑题已顺序单活通过；每条均为 `completed/coverage_satisfied`，有真实 URL、逐字 EvidenceClaim，且 `search_query_planning`、`candidate_reranking`、`public_page_analysis`、`research_synthesis` 均由 Provider 成功完成、fallback=0。
3. **三条 XHS-only 图纸验收** `completed`
   - 顺序执行三条修改后才确定的全新图纸问题；每条必须 `completed/coverage_satisfied`、每方向 3 篇 usable、结果均为 XHS URL 且有本地文件、普通网页事件为 0、fallback=0。
4. **Board 与稳定性汇总** `completed`
   - 用项目 Playwright 打开六条结果，验证逐题/逐方向内容和图片实际显示；保存 QA 截图，不调用 Codex 内置浏览器。
5. **`v2.2.4` 发布验证** `completed`
   - 同步版本面，运行完整 Python/TypeScript/Extension 门禁，构建独立扩展 ZIP 和自包含 Windows 安装器，完成真实安装/启动/自检/健康/卸载 smoke，并记录大小与 SHA-256。
6. **GitHub 发布** `in_progress`
   - 明确审计并暂存跟踪修改，不暂存 `.artifacts/` 或真实研究数据；提交、推送、创建 PR、等待 Hosted CI、合并并创建正式 `v2.2.4` Release。

### Phase 15 errors encountered

| Error | Attempt | Resolution |
|---|---:|---|
| 并行审计把可能返回 1 的 `rg` 与 Run 详情放进同一聚合调用，导致首轮输出被丢弃 | 1 | 改用 `Promise.allSettled` 后完整取得路由和 Run 数据；没有修改研究数据 |
| 相关回归中 `gallery` 被误当成建筑类型，覆盖了工业厂房改文化中心 | 1 | 收窄为只识别明确的 `art gallery`；保留 `gallery` 作为空间/功能词 |
| 项目 Playwright 搜索结果输出包含 GBK 无法编码的特殊字符 | 1 | 改用 UTF-8 控制台输出后重放成功；浏览器结果未落盘 |

### Phase 15 strategy correction

- 常见建筑类型词表只能提升已知题型，不能作为正式稳定性方案；停止继续追加类型条目。
- 正式模型路径改用经 Pydantic 校验的结构化搜索锚点，把建筑类型、项目条件、当前机制、证据类型和可选项目名一直传递到本地站点搜索。
- 站点首查和宽化都必须保留全部锚点；任意未见建筑类型不得替换成 `public building`。确定性模板只在 Provider 查询规划失败时兜底，六条正式验收不允许使用。
- 通用结构化路径已用 `courthouse`、`crematorium`、`aquarium` 三种未登记类型和 `new-build`、`renovation`、`extension` 三种条件验证；workflow 会调用 `search_structured` 并记录 `structured_query=true`，无锚点旧 mock 仍走兼容入口。
- 站点宽化不再把 `new-build` 缩成 `new`，也不把 `renovation` 改写成 `adaptive reuse`；宽化只移除模型查询中的非锚点冗余，五类锚点原样保留。
- 相关四文件 263/263、Ruff、55 文件格式检查、strict Mypy 26 个源文件和 `git diff --check` 全绿。正式稳定性验收仍为 0/6；下一步重启并用未参与单元测试的新建筑类型执行单活 Run。
- 新类型 Run `792ab5f7-a923-4918-badc-da6ca150df14` 的 15/15 结构化搜索成功但最终 0/3；查询准确，Designboom 偏题候选被正确拒绝，ArchDaily 已读页正文不能支持题目机制，不能降低证据门槛。
- 通用补查反馈现区分本地无候选、排除后无新候选、模型全拒和正文分析不完整；模型只在候选不足时生成语义等价类型名称，禁止泛化类型。相关四文件 265/265 和静态门禁全绿；正式验收仍为 0/6。
- 游泳馆 A/B Run 首次模型计划实际包含全部锚点，但机制 anchor 与 query 的连接词位置不同，被旧连续子串校验误拒；Run 已取消且不计验收。混合词项/中文子串校验红测、真实隔离规划、相关四文件 266/266 和静态门禁均通过。
- 铁路客运站 Run `4670f769-c795-41c4-bdc2-c201fd8c4516` 为 `partial/budget_exhausted`、1/3；13 次模型规划和筛选、12 次正文分析及综合全部成功且 fallback=0。真实正文复核确认未覆盖页面确实缺少城市空间连续连接或四类流线分离的逐字证据，不能降低 EvidenceClaim 门槛。
- 通用补查不再尝试当前环境中不可用的 Bing/Google 等通用搜索引擎；正式链路继续轮换可靠建筑站点。对“项目相关但当前页面正文不足”的具体可信项目，按项目名逐站点补查最多两个其他来源，并把所有逐字事实绑定回各自实际读取 URL。
- 主搜索与跨来源补证共享 Run 的总查询额度；补证不会绕过 `max_queries + completion_recovery_rounds × 子问题数`。正文分析焦点保持项目条件中性，确定性未知类型不得默认 `public building` 或 `adaptive reuse`，Trace 记录直接匹配、支持事实数与逐字证据链状态。
- 任意建筑类型正式路径只依赖 Pydantic 结构化锚点，不依赖学校、体育馆、车站等词表。完整 API 500/500 与首轮静态门禁已通过；正式稳定性验收仍为 0/6。
- 新建城市消防站 Run `4a6f582b-67c3-49b1-abb9-362fbe316254` 为 `blocked/research_synthesis_incomplete`、0/3，不计验收。15 次本地搜索正好达到共享总额度，其中 4 次为同项目补证；11 次模型规划有 3 次因 query/anchor 偶发不自洽进入 fallback，跨站搜索结果又因标题顺序不同未进入正文读取。
- 通用修复保持严格 Pydantic 合同，对无效模型查询计划最多纠正重试一次；同项目标题允许完整短语或保守长标题词项匹配，短名称近邻不会合并。相关五文件 310/310、strict Mypy、Ruff 和 `git diff --check` 全绿。
- 市政档案馆 Run `17bd42b6-7793-45ea-b8af-973b7a855abb` 为 `blocked/research_synthesis_incomplete`、0/3，不计验收且不 retry。13/13 次模型查询规划成功且 fallback=0，15 次本地搜索和 13 次模型候选筛选只保留 1 个候选；唯一读取页的 3 次正文分析均 `direct_match=false`。
- 项目 Playwright 诊断证明这个失败是“稀有建筑类型在当前站点集合的召回不足”，不是 EvidenceClaim 或候选门槛过严。档案馆只作为失败样本，不往生产代码增加 `records center`、`Stadtarchiv` 等类型专用词表。
- 全局策略门槛调整为：正式主路径不按建筑类型分支；模型以结构化策略轮换精确类型词、命名案例、机制与证据角度；站点调度根据无候选、全拒绝和正文不足的实际产出轮换；任一修复必须同时通过未见类型参数化红测、全回归和修改后才生成的盲测题。
- 当前活动 Run 为 0；正式稳定性验收仍为 0/6。当前唯一下一步：先写“无类型词表的模型查询策略轮换 + 按候选产出自适应站点调度”通用红测，再做最小生产修复；红测和全回归收口前不创建新 Run。
- 通用红测和最小实现已完成：`SearchQuery` 由 Pydantic 枚举四类搜索策略；恢复轮在总额度允许时最多生成两条不同策略；低产出站点在其他支持站点尝试前不重复；结构化站内类型判断直接使用模型 building-type 锚点，不再调用三类硬编码判断。
- 完整 API 509/509、Ruff 全范围、64 文件 format check、strict Mypy 26 个源文件与 `git diff --check` 全绿；新增生产差异扫描未出现任何验收题或盲测题建筑类型名。
- 真实 SearchQueryPlan 隔离调用成功后，修改后才选定的新建城市渡轮客运码头 Run `34626a55-dbdb-46c6-920d-dc394ecb2651` 自然终止为 `partial/time_budget_exhausted`：1/3、5 个可用资产、1 个正式项目、1 个多图纸项目，fallback=0，不计验收且不 retry。
- 15 次本地搜索中 8 次为跨来源补证；多个页面的正文分析已明确 `direct_match=false`，workflow 仍为这些无关火车站/机场项目补证，耗尽共享预算。模型拆题还把用户声明的建筑类型扩大为相邻的交通或滨水公共建筑。
- 当前活动 Run 为 0，正式验收仍为 0/6。当前唯一下一步：先写通用红测约束正文直匹配补证门控与拆题类型边界，再做最小实现和全回归；收口前不创建新 Run。
- 通用红测与最小实现已完成：正文分析通过内部 outcome 把 `direct_match/evidence_chain_status` 传回调度层；无关、分析失败或证据已完整的项目不再补证，直接匹配但证据不完整的项目仍可在原预算内补证。建筑拆题提示明确要求每个子问题原样保留用户声明类型与项目条件。
- 三项目标测试和精准搜索相关五文件全集通过；Ruff、55 文件格式检查、strict Mypy 26 个源文件和 `git diff --check` 全绿。当前唯一下一步：运行完整 API 回归；通过后重启源码服务并做真实规划隔离验证，仍不创建 Run。
- 完整 API 511/511 通过。当前唯一下一步：确认活动 Run 为 0，重启源码 API 加载通用门控，并用真实 Provider 做一个未见类型的拆题与 SearchQueryPlan 隔离验证；不创建研究 Run。
- 服务重启后 API/Board 健康、活动 Run 为 0。真实 `gpt-5.6-sol / responses` 隔离验证使用未预设的“新建高山植物种质资源保存库”：3 个子问题全部保留用户类型和新建条件，2 条查询策略为 `exact_typology + professional_equivalent`，anchors 完整且未请求原生 `web_search`。
- 当前唯一下一步：选择修改后才决定的另一条全新建筑题，创建唯一单活 quick Run；终态前只轮询，不创建并发 Run。
- 已创建唯一活动盲测 Run `0452cfd2-8142-4e09-b483-8e86bddf573a`：新建湿地生态研究中心，`quick/precedent_research/research_sources=[]`。当前唯一下一步：只轮询该 Run 到终态并完整审计，不创建并发 Run。
- 该 Run 已自然终止为 `partial/time_budget_exhausted`：1/3、4 个资产、1 个页面，不 retry、不计验收。新补证门控真实生效，15 次本地搜索中补证为 0；但查询 fallback 丢失原题范围、恢复策略未跨轮升级、确定性正文 fallback 误升无关泛化原句、建筑计划题外引入 XHS。
- 当前活动 Run 为 0、正式验收 0/6。当前唯一下一步：写四类通用红测并修复上述合同，完成相关与全局回归前不创建新 Run。
- 四类通用红测与最小实现已完成并转绿：恢复策略升级、未知中文类型 fallback 范围保留、确定性正文机制支持门槛、建筑规划来源隔离。当前唯一下一步：运行相关全集和静态门禁；收口前不创建新 Run。
- 精准搜索相关五文件全集全绿；旧“Provider 失败仍靠不相关 fallback 完成”的测试已按严格证据合同改为 partial，已知类型英文 fallback 仍保持简洁。当前唯一下一步：运行静态门禁和完整 API；收口前不创建新 Run。
- Ruff、55 文件格式检查、strict Mypy 26 个源文件和 `git diff --check` 全绿。当前唯一下一步：运行完整 API；通过后重启并真实隔离重放失败轮次合同，不创建 Run。
- 完整 API 514/514 通过。当前唯一下一步：确认活动 Run 为 0，重启源码服务，并用失败题上下文纯内存重放建筑拆题与第 3 轮候选短缺规划；不创建 Run。
- 真实纯内存重放确认拆题范围与来源隔离成功，但第 3 轮 `exact_typology + evidence_angle` 被早期 shortage 规则错误拒绝，纠正后仍为 `ValueError`；未创建 Run。当前唯一下一步：按轮次拆分候选短缺策略约束并回归，再做同一纯内存重放。
- 分阶段 shortage 红测与实现已转绿，相关全集和静态门禁全绿。当前唯一下一步：重启服务并做同一真实纯内存重放；不创建 Run。
- 同一真实重放已成功：拆题范围与来源隔离正确，第 3 轮 `exact_typology + evidence_angle`、anchors 完整、无 fallback。当前唯一下一步：补跑完整 API；通过后创建修改后才决定的下一条单活建筑盲测。
- 最终完整 API 514/514 通过；已创建唯一活动盲测 Run `5f740202-37ff-4f20-88f6-fe459223803a`：新建儿童科学馆，`quick/precedent_research/research_sources=[]`。当前唯一下一步：只轮询到终态并审计，不创建并发 Run。
- 该 Run 已终止为 `blocked/research_synthesis_incomplete`、0/3，不计验收。全部模型阶段 fallback=0，补证=0；晚期恢复只用了 `exact_typology + evidence_angle`，没有命名先例，3 个上位类型页面均被正确判为 `direct_match=false`。
- 当前活动 Run 为 0、正式验收 0/6。当前唯一下一步：写两槽位晚期恢复必须同时使用 `named_precedent + evidence_angle` 的通用红测并修复；不创建新 Run。
- 两槽晚期恢复红测与实现已转绿，相关全集和静态门禁全绿。当前唯一下一步：重启服务并做真实两槽位查询规划；不创建 Run。
- 真实两槽位规划已成功返回 `named_precedent + evidence_angle` 且 anchors 完整。当前唯一下一步：创建修改后才决定的新建自然历史博物馆单活 Run，终态前不创建其他 Run。
- 已创建唯一活动盲测 Run `383b7203-f330-4afc-8784-9f1bfe59f0f6`：新建自然历史博物馆，`quick/precedent_research/research_sources=[]`。当前唯一下一步：只轮询和审计该 Run。
- 自然历史博物馆 Run 自然终止为 `partial/no_new_assets`、2/3、fallback=0，不计验收。高级策略真实执行，但第 5 轮重复第 3 轮已判无关的命名项目；正式结构化路径还残留按项目后缀猜身份的旧解析。
- 通用红测和最小实现已转绿：已尝试项目进入后续规划硬排除；重复命名先例在搜索前有界纠正；结构化 `project_name` 直接约束候选，旧正则只留给无锚点兼容路径。当前唯一下一步：运行精准搜索相关全集和静态门禁；收口前不创建新 Run。
- 相关 324 项、完整 API 516 项及全部静态门禁通过；真实排除项目规划返回不同命名先例和完整锚点。已创建唯一公共市场大厅盲测 Run `8308a18e-1898-4e4b-a352-4014dd612d4d`，当前唯一下一步：只轮询和审计该 Run。
- 公共市场 Run 因第 2 轮查询规划 fallback 提前取消；审计发现建筑拆题仍可能夹带题外 XHS/登录态。通用来源隔离和查询语义纠正红测已转绿，真实同题纯内存重放无 XHS、无规划错误、无排除项目别名重复。当前唯一下一步：运行相关全集和静态门禁；收口前不创建新 Run。
- 相关 325 项、完整 API 517 项和静态门禁全绿；已创建唯一新建城市音乐厅盲测 Run `6cac2ab8-0532-407a-9981-9e99c8f25b69`。当前唯一下一步：只轮询和审计该 Run。
- 音乐厅 Run 已终止为 `partial/time_budget_exhausted`：1/3、5 个资产、1 个正式项目，不计验收。正式 Trace 含 reranker `APIConnectionError` fallback 和正文 `APITimeoutError` fallback。
- 同一 attempt 在服务恢复后重复执行前两个已完成分支。根因是 resume key 错把可变 `language` 作为身份：初始 deterministic 查询为 `zh`，普通 Responses 查询规划成功后 QueryAttempt 被更新为 `en`，恢复时无法命中 completed key。
- reranker 暂时失败时 deterministic fallback 放行 4/4 候选，随后 1 个 `Exception`、3 个 `AttributeError` 全部解析失败，进一步浪费页面和时间预算。
- 用户同意在修复上述浪费后有限提高建筑 quick 预算；EvidenceClaim、正文相关性、完成门槛和 XHS 固定限制保持不变。当前活动 Run 为 0、正式验收 0/6。当前唯一下一步：先写不可变恢复键和严格候选降级红测，不创建 Run。
- 不可变恢复键红测先复现 `program=2`，修复后同 attempt/跨 attempt/零覆盖 retry 相关 6 项全绿；QueryAttempt language 继续用于展示，不再参与执行身份。
- 结构化 reranker fallback 红测以未登记 `planetarium` 复现泛化页面放行；修复后正式模型路径只保留命中 building-type anchor 且确定性相关的前 2 页，旧 mock/provider 兼容不变。相关目标组 5/5 通过。
- 用户授权三档增配后，quick / balanced / deep 新预算的有效公开搜索上限为 18 / 28 / 48，基础页面为 16 / 40 / 72，时限为 40 / 60 / 90 分钟，每子问题恢复页为 3。XHS 固定帖子、usable、视觉调用和字节上限不变。
- 完整 workflow 44/44 与 schema 24/24 通过。当前唯一下一步：运行精准搜索相关全集、完整 API 和静态门禁；通过前不创建 Run。
- 精准搜索相关六文件 351/351、完整 API 519/519、Ruff lint/63 文件格式、strict Mypy 26 文件和 diff check 全绿；服务重启后 Responses structured-output probe 成功。
- 修改后才选定的新建大学学生中心题在生产/测试扫描为 0 命中；唯一 Run `4bcbd249-8701-48a6-b0d4-69beb2f83c58` 已创建并实际取得新 quick budget。当前唯一下一步：只轮询和审计，不并发或 retry。
- 建筑学院 Run `15c4d0d2-5643-43af-98d0-7566488682b0` 自然终止为 `partial/time_budget_exhausted`，但实际为 18 次公开搜索额度耗尽：3/3 正文覆盖、1 个正式项目、综合成功、fallback=0，不计验收且不 retry。
- 用户要求避免把候选类型卡得过死；新的通用红测要求在总数 4 以内、同类型不足时最多保留 2 个可信强机制类比，部分命中一个当前机制即可进入正文分析，弱机制和仅视觉相似仍拒绝。
- 目标红测已转绿；查询额度耗尽现记录 `query_budget_exhausted`，不再误报真实时间耗尽。当前唯一下一步：运行相关全集、完整 API 和静态门禁；收口前不创建新 Run。
- 相关六文件全集、完整 API 和全部静态门禁通过；真实普通 Responses reranker 返回 1 个直接候选、2 个强机制类比和 1 个明确拒绝的弱候选，证明新边界在真实模型生效。当前唯一下一步：扫描并创建修改后才决定的全新建筑类型单活 Run。
- 新建大学工程创新中心题型扫描为 0 命中；唯一单活 Run `f64e3b16-740a-4948-9da1-064acce13ae4` 已创建，拆题与首条模型查询规划成功。当前唯一下一步：只轮询和审计，终态前不创建其他 Run。
- 工程创新中心 Run 在 0/3、fallback=0 时取消并保留；QueryAttempt 证明恢复查询仍机械重述完整子问题，类比准入没有足够召回入口，不计验收且不 retry。
- 过载机制红测先失败后转绿：`spatial_mechanism` 只允许一个机制切片，英文 12 词/中文 32 字上限；两条查询分别选择不同切片，其他结构化锚点保持。当前唯一下一步：相关全集、完整 API、静态门禁和真实规划隔离重放；收口前不创建 Run。
- Provider 全集、完整 API 和静态门禁全绿；真实 Responses 对三个工程中心子问题均生成两条 6-9 词的独立机制查询，范围与 anchors 完整、fallback=0。当前唯一下一步：扫描并创建另一种全新建筑类型单活 Run。
- 新建大学医学教育中心题型扫描为 0 命中；唯一 Run `363c9289-eae9-4767-be79-1da6d0918d94` 已创建，拆题与首条短查询成功，2 个同类型候选正在正文读取。当前唯一下一步：只轮询审计。
- 医学教育中心 Run 已自然终止为 `blocked/research_synthesis_incomplete`：0/3、6 个 partial 图纸资产、0 个正式项目，正式模型阶段 fallback=0；保留、不 retry、不计验收。两个同类型医学教育页面的正文分析均没有形成支持当前机制的逐字事实。
- 用户再次明确案例不必与题型严丝合缝，正式研究应优先提取可迁移机制和参考方法。当前唯一下一步：联合审计该 Run 的查询、候选和正文输入，先写任意建筑类型红测约束“一个有逐字正文支持的可迁移机制足以形成受限分析”，但不放宽 URL、EvidenceClaim、适用边界或运行级完成门槛；回归收口前不创建新 Run。
- 联合审计确认 11 条查询始终锁定目标建筑类型，所有 reranker 的 `analogical_retained_count=0`；适度类比只存在于筛选层，尚无恢复查询负责召回强机制跨类型候选。当前唯一下一步：先写“同类型恢复不足后有界启用机制类比搜索、主路径仍保持精确且总预算不增加”的任意类型红测，再做最小实现；不降低正文或 EvidenceClaim 门槛。
- 机制类比恢复的目标合同：早期/默认查询不变；晚期两个槽位最多一个 `mechanism_analogy`，另一个保留同类型证据搜索；模型选择可比较来源类型且禁止泛化公共建筑，结构化本地搜索按该类型召回，后续候选、正文、EvidenceClaim 和总预算门禁不变。下一步先补红测。
- 红测已先失败并转绿：Pydantic 增加 `mechanism_analogy` 与 `target_building_type`；早期类比会纠正，第 4 轮后两个槽位严格为一个机制类比加一个目标类型证据查询；具体来源类型不得与目标相同或泛化为公共建筑。本地搜索集成测试确认只执行来源类型查询。Provider 64/64 通过。
- 当前唯一下一步：运行浏览 workflow、workflow/schema 相关全集和静态门禁；收口前不创建新 Run。
- Provider 64/64、浏览 workflow 133/133、workflow/schema 68/68、完整 API 526/526 全绿；Ruff、55 文件格式、strict Mypy 26 个源文件和 diff check 通过。
- 当前唯一下一步：确认无活动 Run，重启源码服务并真实隔离验证第 4 轮机制类比计划；不创建研究 Run。
- 真实第 4 轮规划结构成功且无 web_search，但模型选择的航天器装配测试设施在 4 个现有建筑站点没有可用召回，只有无关页面。当前唯一下一步：红测约束类比来源类型的建筑媒体可发现性，再做最小提示修复和真实重放；不降低 reranker。

### Phase 15 concept-stage research correction

- 用户纠正产品方向：ArchResearch 服务于建筑概念初期灵感，默认输入应是宽泛设计任务，不应先指定中庭、环形流线、设备带、可变隔断等答案再让搜索证明。
- 默认拆题改为开放研究维度；模型应从真实候选正文和图纸中发现空间机制，再说明可借鉴做法、适用条件和失效边界。
- 搜索优先级改为“空间对象与关系 > 使用体验与环境问题 > 建筑类型背景”。建筑类型用于保留尺度、项目条件和语境，但不得把每条查询锁死在同类型；展厅、教育空间、中庭等空间问题可以从其他可信建筑类型中寻找可迁移案例。
- 只有用户明确要求同类型案例，或题目本身依赖强类型规范时，才提高建筑类型匹配权重；URL、逐字正文、EvidenceClaim、候选白名单和总预算门槛不变。
- 后续正式 3+3 验收题全部使用概念初期宽问题，不再使用预埋具体形式、构件、材料、结构体系或流线答案的问题。
- 当前唯一下一步：运行已写入的概念初期红测，补充空间优先/类型软约束红测；最小修改通用 fallback、Provider 拆题和查询规划合同，完成全回归前不创建新 Run。

#### Conflict audit and revised implementation

- **保留**：普通 Responses 结构化输出、本地 Playwright 搜索与读取、候选 ID 白名单、URL/项目/无关页排除集合、既有预算、XHS-only 隔离、正文逐字 EvidenceClaim、适用边界和综合 Trace。
- **替换**：旧 fallback 的新旧分区/消防分流/核心筒/空间高潮/结构穿越预设；每条查询必须包含建筑类型的合同；以 `exact_typology` 为主、到晚期才准入 `mechanism_analogy` 的类型中心恢复顺序。
- **改写**：结构化站内查询当前按“项目名 -> 条件 -> 类型 -> 空间机制 -> 证据”拼接，导致召回被类型锁死；候选降级仍按类型硬过滤；reranker 虽支持跨类型机制，但只作为最多两个晚期例外，和空间优先目标冲突。
- **两路检索合同**：每个子问题在既有每轮最多两条预算内使用“空间优先路 + 项目语境路”。空间优先路以空间对象、空间关系、使用体验或环境议题和证据类型为主要查询，不强制目标类型进入搜索；项目语境路保留目标类型与新建/改造/扩建条件，补充同类案例和适用性校验。
- **候选准入合同**：空间相关性、可迁移性、图纸/正文可用性和来源可信度优先；类型匹配是加分项和适用性信息，不是默认硬门槛。同类型摘要不足的可信项目页仍可读取，跨类型页面也必须明确命中当前空间议题才可读取。
- **证据合同不变**：跨类型候选进入正文读取不等于正式结论；只有本地读取正文支持设计操作与空间结果、程序绑定真实 URL 和逐字引文、分析写明适用条件与差异时才能进入结果。
- **开发顺序**：先补概念初期、显式空间关系跨类型搜索、旧工业改造条件保留、预算和 XHS 隔离红测；再重构 Pydantic 查询语义、Provider prompt、本地结构化搜索和 reranker；目标/相关/完整回归与静态门禁通过后才做真实内存验证和新 Run。
- **首轮实现完成**：`space_first` 与 `project_context` 双路查询、空间优先 reranker、本地搜索 scope 和 Trace 已通过 10 个核心合同；正式可执行策略不再包含 `exact_typology`、`professional_equivalent` 或 `mechanism_analogy`。
- **确定性 fallback 收口**：显式空间、活动、流线、环境和建造词按通用词汇映射保留；没有明确机制时只补空间关系、使用体验、环境回应等中性维度。旧的动静分区、连续环流、工作坊、柱网/桁架自动扩写已删除。
- **当前验证**：精准搜索相关组合 366/366、完整 API 534/534、Provider 67/67、Ruff、64 文件格式、strict Mypy 26 个源文件与 diff check 通过。当前活动 Run 为 0、正式验收 0/6。
- **真实 Provider 内存验证**：普通 Responses 在 57 秒内完成开放拆题、`space_first + project_context` 查询和候选筛选；保留强空间相关的跨类型/同类型候选并拒绝无关候选，fallback=0，无原生 `web_search`。
- **真实盲测发现与修复**：青年交流与文化中心 Run 在规划阶段出现题外展览、工作坊、后勤、中庭和采光前提，已立即取消。新增通用计划输出门控和一次有界纠正；相关 367、完整 API 535 与静态门禁通过，真实同题重放已开放化。
- **后续真实 Run 审计**：专用空白 workspace 中的公共艺术与社区学习中心 Run `abc168c5-2b31-49c5-a6d5-206b93bf8aea` 拆题开放，但首轮 `user_experience` 查询规划出现 `ValidationError / deterministic_template`；已取消并保留，不 retry、不计验收。其余轮次的双路查询、跨类型候选和一条完整正文证据链成功，说明失败集中在查询语义与校验合同。
- **残留冲突**：`spatial_mechanism` 和 `mechanism_transferability` 仍在正文读取前要求模型先猜设计机制；`building_type` 仍是每条查询必填；英文空间优先查询错误要求仅作结构化语境的中文类型/条件也为 ASCII；deterministic reranker 的空间优先分支仍回落到类型过滤。
- **第二轮通用合同**：查询锚点改为中性的空间研究焦点，具体 `design_mechanism` 只由正文分析产生；建筑类型只在用户明确给出时保留，否则为空；候选按空间相关性、完整项目页/图纸潜力和来源可信度优先，类型只作加分；第二次结构化纠正接收有界校验反馈，一槽首轮明确只返回 `space_first`。
- **保持不变**：普通 Responses、本地 Playwright、候选 ID 白名单、URL/项目/无关页排除、预算、XHS-only、正文逐字 EvidenceClaim、适用边界、Trace 和运行级完成门槛。
- **当前唯一下一步**：先写上述通用红测并取得准确红灯，再做最小生产修改；相关与完整回归收口前不创建真实 Run。
- **第二轮通用修复完成**：五个新增红测先 5/5 准确失败，分别覆盖可选类型语境、中文 context-only anchors、具体校验反馈、空间相关性候选准入和 deterministic fallback 类型回退；生产修改后全部转绿。
- **结构语义**：查询前字段统一为 `spatial_focus`，只描述要研究的空间对象、关系、使用或环境议题；正文后的 `design_mechanism`、逐字事实和转译步骤保持不变。`building_type` 可为空，英文 `space_first` 只校验 query-visible anchors 的 ASCII 与逐词包含。
- **候选语义**：模型输出 `spatial_relevance`，正式准入全局要求可信来源，类型仅作补充；空间优先 deterministic fallback 在已有文本相关性后不再调用旧 typology gate。
- **当前验证**：Provider/公共页面/浏览 workflow 286/286，规划/Provider/公共页面/浏览 workflow/workflow/schema 372/372，完整 API 540/540；Ruff、63 文件 format check、strict Mypy 26 个源文件和 `git diff --check` 全绿。
- **当前唯一下一步**：重启源码服务加载新 Pydantic schema，确认活动 Run=0；用真实普通 Responses 纯内存验证“无建筑类型空间题 + 中文项目语境英文查询 + 候选空间优先”，不创建 Run。
- **真实空间优先验收结果**：普通 Responses 内存验证通过后，唯一概念初期 Run `2a45daa0-52e9-4d35-860f-17a023292a83` 达到 3/3 正文覆盖、3 个正式项目、18 个可用资产和完整综合，四个 Provider 阶段成功且 fallback=0；终态仍为 `partial/budget_exhausted`，仅剩 `insufficient_multi_asset_projects`，不计验收且不 retry。
- **覆盖聚合红测与修复**：同一正文已验证来源页的 `verified/partial` 图纸可共同证明项目图纸丰富度；仅项目名相同但来源页不同的图纸不得混算。红测先得到 0 而失败，最小修复后转绿；真实数据库只读重算得到 `multi_asset_projects=1`、`enrichment_gaps=[]`，未降低正文、URL、EvidenceClaim、来源或子问题覆盖门槛。
- **当前唯一下一步**：运行 workflow/verification 相关全集、完整 API 和静态门禁；全部通过后重启源码服务并创建下一条全新概念初期建筑题做唯一单活验收。
- **门禁与运行时收口**：workflow/verification 47/47、精准搜索相关联合 376/376、完整 API、Ruff、55 文件格式、strict Mypy 26 个源文件和 diff check 全绿。项目脚本重启后 API `openai/gpt-5.6-sol` 与 Board 200，活动 Run 为 0。
- **当前唯一下一步**：扫描修改后才决定的宽泛概念初期建筑题；确认 production/tests 无命中后创建唯一单活 quick Run，并只轮询审计。
- **第二条概念初期 Run**：`22fb1bee-201b-4753-85c2-2ce75ffa48bd` 为 `partial/query_budget_exhausted`，3/3、11 个资产、2 个正式项目、完整综合、fallback=0，不 retry、不计验收。空间优先跨类型召回和严格正文拒绝均正常，失败只剩旧 quick 的 3 项目/多图纸硬丰富度。
- **quick 深度重新校准**：概念初期 quick 改为 2 个正式项目、0 个强制多图纸项目；每题 2 资产、总计 6 资产、4 个 verified/partial、正文、URL、EvidenceClaim、3/3 和综合不变。balanced/deep 原目标不变。
- **红测与能力边界**：schema 红测先失败后转绿；retry 与多图纸恢复测试在夹具内显式启用强丰富度，确认通用恢复能力仍保留。目标三项 3/3 通过。
- **当前唯一下一步**：运行相关全集、完整 API 和静态门禁；通过后重启并创建下一条全新概念初期建筑题单活验收。
- **校准回归收口**：相关 206/206、完整 API、Ruff、55 文件格式、strict Mypy 26 个源文件和 diff check 全绿；源码 API/Board 重启健康，活动 Run 为 0。
- **当前唯一下一步**：扫描并创建“新建城市街角阅读与邻里活动场所”的唯一单活 quick Run，终态前不创建或 retry 其他 Run。
- **建筑验收 1/3**：Run `cc7eee8a-bc70-4f9c-867a-d975567a1c4b` 为 `completed/coverage_satisfied`，3/3、10 个资产、2 项目、18 条逐字 EvidenceClaim；四个 Provider 阶段成功，本地搜索/读取成功，无原生 `web_search`，fallback=0。
- **建筑验收 2/3 失败样本**：Run `e665999e-a7a9-4d79-b4e9-c69fbf5ada85` 自然终止为 `blocked/research_synthesis_incomplete`，0/3、0 usable assets、0 正式项目，Provider fallback=0；保留、不 retry、不计验收。
- **初步信号**：一个共享工作室正文读取超时，两个候选正文为 `direct_match=false`，后续多轮本地搜索返回 0 候选。当前活动 Run 为 0，正式验收仍为建筑 1/3、总计 1/6。
- **当前唯一下一步**：完整审计该 Run 的 QueryAttempt、站点轮换、候选批次与正文输入，先定位跨题型的改造语境召回缺口并写红测；全回归收口前不创建或 retry 新 Run。
- **审计结论**：真实站点存在可发现候选；失败主因是项目语境锚点复制过多 brief 内容、实际站内拼接仍把条件/类型排在空间焦点前，以及已选页面一次读取超时后被永久排除。只翻译查询或单纯加预算不能解决。
- **拟定通用合同**：空间焦点先行；building type/project condition 为简洁软语境；查询语言匹配当前站点；执行词数有界；已选页面瞬时读取最多重试一次。候选白名单、低相关排除、总搜索/页面预算、正文逐字证据和 XHS-only 均不变。
- **首轮最小实现**：项目条件简洁度、站点语言一致、空间焦点优先词序、正文超时单次重读、reranker 拒绝后排除和已选未读候选延后排除共 6 个红测已转绿；搜索、页面和 Provider 预算未增加。
- **恢复语义残留**：同一进程内未读候选可留到后续轮次，但 `_persist_sources()` 会在实际读取前写入 `SourcePage`；服务重启时当前初始化仍把全部 `SourcePage.url` 视为已访问，可能永久排除已持久化但未读的候选。旧 structured-site 测试还保留条件/类型优先词序断言，与空间优先合同冲突。
- **当前唯一下一步**：先写服务重启/继续执行时未读候选仍可恢复的红测并取得准确红灯；最小修复持久化候选状态，同时保证已访问、重复项目和已判无关页面继续排除。随后更新旧词序断言并运行相关全集、完整 API 和静态门禁；收口前不创建真实 Run。
- **恢复状态修复完成**：新增行为红测先准确失败，证明 `pending` SourcePage 在恢复时被误排除；最小实现后 `pending` 可重读、实际读取后转为 `available`、reranker 拒绝项持久化为 `irrelevant`。读取失败不再缓存为本轮永久失败，后续重试仍受既有页面预算限制。
- **相关回归**：规划 18、Provider 75、公共页面 82、浏览 workflow 137、核心 workflow 45、schema 24、XHS/浏览协议 46，共 427 项全绿。旧测试已同步为 40 秒最坏正文读取窗口和空间焦点优先词序，生产逻辑未回退。
- **当前唯一下一步**：运行完整 API、Ruff lint/format check、strict Mypy 和 `git diff --check`；全绿后更新 HANDOFF、重启源码服务并做真实普通 Responses + 本地搜索纯内存验证，仍不创建 Run。
- **完整收口**：完整 API 549/549、Ruff lint、55 文件 format check、strict Mypy 26 个源文件和 diff check 全绿；源码 API/Board 已重启，活动 Run=0。
- **真实内存验证**：Credential Manager 的 `gpt-5.6-sol / responses` 返回 `space_first + project_context`；本地 ArchDaily 4 候选，模型保留白名单内 2 个跨类型空间案例，原生 web_search=0，未创建 Run、未输出或保存 Key。
- **当前唯一下一步**：扫描一条修改后才确定且 production/tests 未出现的宽泛概念初期建筑题；确认无命中后创建唯一单活 quick Run 并只轮询审计。建筑正式验收当前 1/3，总计 1/6。
- **建筑验收 2/3**：Run `60993e17-a7fc-4af9-9f80-1eda31d1ccca` 为 `completed/coverage_satisfied`，3/3、7 资产、2 项目、25 条有效 EvidenceClaim；四类 Provider 阶段成功、本地搜索/读取真实执行、fallback=0、原生 web_search=0。
- **当前唯一下一步**：扫描另一条修改后才确定、production/tests 未出现的宽泛概念初期建筑题；创建第三条唯一单活 quick Run 并审计到终态。当前建筑 2/3、总计 2/6。

### Phase 15 recovery command errors

| Error | Attempt | Resolution |
|---|---:|---|
| 分段读取和健康检查中的 PowerShell 变量被外层 shell 提前展开 | 1 | 改用单引号包裹 `pwsh -Command` 脚本后成功；未修改项目或研究数据 |

### Phase 15 concept-stage audit follow-up

- 第三条建筑候选 Run `f429ca55-5377-4dc5-a8fb-87b99d8bccd5` 自然终止为 `partial/query_budget_exhausted`：3/3、13 资产、1 正式项目、完整综合、fallback=0；保留、不 retry、不计验收。
- 代码冲突审查确认五个通用修复面：默认开放 fallback 拆题；空间焦点与类型语境分层；删除正文前模板机制；空间相关候选优先并限制 type-only 探查；降级相关性使用当前空间焦点。
- URL、逐字 EvidenceClaim、本地浏览器、候选 ID 白名单、排除集合、预算、XHS-only 和完成门槛保持不变。
- 五类行为红测和最小生产实现已完成；默认开放 fallback、空间前景化拆题、无模板机制注入、空间候选优先及空间焦点降级评分均已转绿。
- 相关八文件首轮剩余 18 个旧夹具失败，已对齐开放维度和显式问题证据，18 项定向复检通过；未修改生产证据或完成门槛。
- 当前唯一下一步：重跑相关八文件全集；通过后运行完整 API、Ruff、format、strict Mypy 和 `git diff --check`，再做真实普通 Responses 内存验证。回归收口前不创建真实 Run。
- 相关八文件全集与完整 API 552/552 已通过；Ruff lint/format、strict Mypy 和 diff check 全绿。
- 当前唯一下一步：重启源码服务并完成真实普通 Responses 纯内存验证；确认无 fallback、无原生 web_search、候选 ID 白名单和空间优先策略后，再创建第三条全新建筑验收 Run。
- 真实拆题、双路查询和候选筛选内存探针已通过。建筑候选 Run `202d658e-25a3-4158-b26b-bf2c3c187308` 为 2/3 partial，不 retry、不计验收；真实缺口是正文结构化纠正偶发不自洽。
- 精确证据缺项反馈已完成红测、最小实现、相关全集、完整 API 553/553 和静态门禁；证据与调用预算不变。
- 当前唯一下一步：重启源码服务并做普通 Responses 健康探针；成功后扫描并创建另一条修改后才决定的宽泛概念题作为唯一单活建筑验收 Run。
- **最新候选 Run**：`9b7ed8dc-daef-41d1-b86d-0c0035725a1b` 自然终止为 `partial/no_new_assets`，2/3、3 个资产、1 个正式项目，Provider 查询规划、候选筛选和正文分析 fallback=0；保留、不 retry、不计验收。当前活动 Run=0，建筑正式验收仍为 2/3，总计 2/6。
- **最新通用根因**：空间优先路能召回并形成证据，项目语境路却把多功能 brief 复制为长而生造的 building-type anchor，例如 `children's care and family community venue`，导致建筑媒体站内搜索无法命中常见专业类别。此前候选 Run 的 `urban community shared learning and daily service facility` 是同一类跨题型失败。
- **修复边界**：不添加题型词表，不把类型重新塞回 `space_first`，不降低正文、URL、EvidenceClaim 或完成门槛。只用通用 Pydantic 简洁度/结构约束和 Provider 提示，让 `project_context` 使用短、常见、可索引的专业建筑类别；未知类型不能默认改造或泛化为 `public building`。
- **当前唯一下一步**：写上述 building-type anchor 红测并取得准确红灯；最小修改后运行目标、相关全集、完整 API 和静态门禁，再做真实内存探针。回归收口前不创建 Run。
- **红测与最小实现完成**：英文/中文 multi-program brief 在旧实现中均未触发校验，Provider 也直接接受长类别；新增策略级 Pydantic 合同后，可执行 context 查询只接受英文最多 5 个有效词、中文最多 10 个汉字的单一类别，`space_first` 的 context-only 原始语境不受影响。
- **Provider 提示边界**：模型必须把项目语境归纳为一个常见、可索引的专业建筑类别，活动和空间关系留在 `spatial_focus`；没有新增任何建筑类型词表。目标 4/4、Provider 全集 80/80 通过。
- **当前唯一下一步**：运行精准搜索相关八文件全集；通过后运行完整 API 与 Ruff/format/Mypy/diff 静态门禁。收口前不创建 Run。
- **回归收口**：精准搜索相关八文件 435 项、完整 API 557/557、Ruff lint、63 文件格式、strict Mypy 26 个源文件和 `git diff --check` 全绿。
- **当前唯一下一步**：重启服务并使用 Credential Manager 做普通 Responses 不落盘双路规划探针；通过后扫描并创建一条全新宽泛概念题的唯一单活建筑验收 Run。
- **真实验证**：普通 Responses 双路探针成功，`space_first` 无类型执行词，context 使用 3 词 `urban youth center`。新 Run `3618a879-3ca3-4d45-9cdf-d8238e95d0d5` 在达到 2/3、8 资产、3 项目后出现正文分析 `APIConnectionError / deterministic_fallback`，已立即取消并保留，不 retry、不计验收。
- **真实查询审计**：首轮与第二轮全部为短空间查询；context 查询没有复制 multi-program brief 或生成长类别。本轮修复真实生效，取消原因属于外部 Provider 连接，不修改调用预算或证据门槛。
- **当前唯一下一步**：普通 Responses 健康探针确认上游恢复；成功后创建另一条全新单活建筑验收 Run。
- **建筑验收 3/3**：上游探针恢复后，Run `24b9aade-b7b1-42da-9392-284cd9c1c535` 自然完成 `completed/coverage_satisfied`，3/3、12 资产、3 正式项目、完整综合；7 查询规划、6 实际筛选、8 正文分析、1 综合成功，51/51 EvidenceClaim URL/逐字 excerpt 有效，fallback/native web_search=0。
- **当前验收计数**：建筑 3/3、XHS 0/3，总计 3/6，活动 Run=0。
- **当前唯一下一步**：执行小红书会话预检；仅 `logged_in` 时创建第一条全新 XHS-only Run，其他状态 fail closed。
- **XHS 预检结果**：`unknown/local_search`；固定只读 OpenCLI auth status 超时，Chrome 扩展未配对。Board 登录入口正确，项目 `open-chrome` 端点已打开 Board；未创建图纸 Run、未进入普通网页搜索。
- **当前唯一下一步**：等待用户在系统 Chrome 完成小红书登录并重新检测；预检为 `logged_in` 后开始第一条 XHS-only 验收。
- **XHS 登录恢复**：预检现为 `logged_in/local_search`；7 个工作区活动 Run 为 0。
- **第一条 XHS 失败样本**：Run `96237a51-6425-4365-bec0-dd054b02fabe` 为 `partial/visual_budget_exhausted`，23 资产、8 项目，全部结果为 XHS URL 且有本地内容；普通网页事件 0、fallback=0。`contour-layering` 仅 2 篇 usable，固定 3 篇门槛正确拒绝完成；保留、不 retry、不计验收。
- **通用根因**：实际 OpenCLI 搜索只收到当前视觉方向短文本，原始图纸主题上下文没有进入搜索；QueryAttempt 虽记录完整问题，但不等于实际查询。不得通过降低每方向 3 篇 usable、扩大每方向 4 帖、48 图或 48 MiB 上限制造完成。
- **当前唯一下一步**：先写“简洁原题主题上下文 + 当前视觉方向”的 XHS 实际查询红测；再实现不含 rationale、Provider 指令和公共网页词的通用 compact query，并运行 XHS/浏览 workflow、完整 API 与静态门禁。收口前不创建新 Run。
- **XHS compact query 红测与实现**：山地公共建筑、社区医疗空间两个未见主题在旧实现上 2/2 准确失败；通用 helper 只清除请求话术和执行/公共网页控制词，保留原题空间主题，在 96 字符内追加当前视觉方向。XHS-only QueryAttempt 现在记录真实执行串，不再保存与 OpenCLI 参数不一致的冗长 provider query。
- **相关回归**：XHS adapter、浏览协议、核心 workflow 与完整浏览检查四文件共 232 项全绿；每方向 4 帖/3 usable、每帖 4 图、48 图像槽位/48 MiB、登录 fail-closed 和普通网页隔离均保持。
- **当前唯一下一步**：运行完整 API、Ruff lint/format、strict Mypy 和 `git diff --check`；全绿后更新 HANDOFF 并重启源码服务，再创建修改后才确定的全新 XHS-only 单活盲测 Run。
- **首个修改后盲测**：Run `e1a8fc51-d2a4-4ddf-bf87-fbd01d82f94d` 的真实 OpenCLI/QueryAttempt 已包含主题和方向，但仍有通用请求/媒介话术；第一方向 4 帖仅 1 篇 usable 后确定无法验收，已取消保留、不 retry、不计验收。
- **第二轮通用压缩**：同登录态 A/B 证明主题名词 + 空间关系 + 方向可召回更直接的活动中心/校园空间候选。红测把总长收紧至 64，并删除概念图纸、表现/表达、参考/比较、不同、配色、线型、版式、风格和方向已携带的图纸类型；没有题型词表或预算变化。
- **第二轮门禁**：目标 2/2、完整 API 559/559、Ruff lint、55 文件 format check、strict Mypy 26 个源文件和 `git diff --check` 全绿。
- **当前唯一下一步**：确认活动 Run=0 后重启服务，扫描另一条 production/tests 未出现的宽泛图纸题，创建唯一 XHS-only quick Run 并先审计第一方向 4 帖；不得 retry 校园 Run。
- **XHS 产品边界再次纠正**：图纸研究只检索“视觉表现方向 + 图纸类型”；建筑类型、项目主题、场地和空间关系不得进入 XHS 查询。此前 96/64 字符 compact helper 的主题拼接方向已撤销，不能据此继续创建校园、山地、医疗等项目题。
- **目标验证**：生产 workflow 直接使用视觉子问题文本作为 XHS 查询，并让 `QueryAttempt.query` 与实际 OpenCLI/扩展参数一致；两个未见场景目标测试 2/2 通过，分别严格得到“精细线稿分析图”和“精细线稿剖面图”。
- **当前唯一下一步**：运行 XHS/浏览相关回归、完整 API 与静态门禁；全绿后确认活动 Run=0、重启服务，并以纯图纸类型/视觉风格问题创建第一条新的 XHS-only 单活验收 Run。两条既有 XHS 失败样本均不 retry。
- **回归收口**：XHS adapter、浏览协议、核心 workflow 与浏览检查 232/232，完整 API 559/559，Ruff lint、55 文件 format check、strict Mypy 26 个源文件和 `git diff --check` 全绿。
- **当前唯一下一步**：只读确认 API/Board、XHS 登录态和全局活动 Run；满足 `logged_in`、活动 Run=0 后重启源码服务，并创建一条纯图纸类型/视觉表现请求的唯一 XHS-only quick Run。
- **XHS 正式验收 1/3**：Run `4679f319-7761-461a-a8a7-48939ec523c8` 为 `completed/coverage_satisfied`，三方向各 3 篇 usable，24 个剖面图资产来自 9 篇 XHS 笔记，全部有本地内容。3 条 QueryAttempt 严格为纯视觉剖面图查询；普通网页事件 0、fallback=0。
- **只读审计命令纠正**：首次查询误用了不存在的 `query_attempts.provider_name` 列；读取表结构后改用实际 `provider` 列。SQLite 全程以只读模式打开，未修改研究数据。
- **当前唯一下一步**：扫描并创建一条纯“视觉方向 + 爆炸图”的唯一 XHS-only quick Run，终态前只轮询和审计。当前建筑 3/3、XHS 1/3、总计 4/6。
- **纯爆炸图失败样本**：Run `8ff626c2-c9da-4d3c-8de1-0faca3dc0401` 为 `partial/visual_budget_exhausted`，三方向在各 4 帖后仅有 2/2/1 篇 usable；42 次图像检查、约 7.05 MiB，查询仍为纯视觉爆炸图，普通网页事件 0、fallback=0。保留、不 retry、不计验收。
- **当前唯一下一步**：只读审计爆炸图召回与视觉类型识别，先写跨极简/拼贴/材质三风格的通用红测，再最小修复并跑相关、完整与静态门禁；收口前不创建新 Run。
- **爆炸图 A/B 与红测**：同登录态将图纸类型写为“建筑爆炸图”后，极简/拼贴/材质三组前四条结果均回到建筑图纸；三个生产缺口红测准确失败，分别覆盖执行查询、确定性分类和真实视觉提示。
- **最小实现**：只对跨行业歧义的爆炸图添加建筑图纸学科限定；Mock 与 OpenAI 视觉合同统一将建筑爆炸图/分解轴测图归为 `axonometric`，拼贴或渲染风格不改变图纸类型。目标 5/5 通过，相关性、3 usable、4 帖和视觉预算未放宽。
- **当前唯一下一步**：运行视觉/Provider/XHS/浏览/workflow 相关全集、完整 API 与静态门禁；全绿前不创建新 Run。
- **门禁收口**：视觉/Provider/XHS/浏览/workflow 相关全集 320/320，完整 API 561/561，Ruff、55 文件 format check、strict Mypy 26 个源文件和 `git diff --check` 全绿。
- **当前唯一下一步**：确认活动 Run=0、重启源码服务，并用真实 Credential Manager 模型对临时下载的建筑爆炸式拼贴图做内存分类探针；通过前不创建新 Run。
- **真实探针纠正**：模型正确将没有构件分解关系的“爆炸式拼贴”判为 `analysis_diagram`，没有被新提示误升。进一步 A/B 显示“建筑爆炸图 + 风格”比风格前置更稳定召回真正爆炸图。
- **类型前置修复**：行为红测准确失败后转绿；相关 320/320、完整 API 561/561 与全部静态门禁再次通过。
- **当前唯一下一步**：重启服务，用标题明确的真实轴测爆炸图笔记做一次内存分类探针；通过后创建新的纯视觉爆炸图单活 Run。
- **真实分类探针通过**：标题明确的轴测爆炸图笔记下载 3 张，Provider 全部返回 `axonometric/relevance=4`，观察逐张确认构件分解关系；无 fallback、无持久化临时文件。
- **第二条爆炸图验收失败样本**：Run `a33b0185-fc5d-48ed-a93f-8c3cb7df042f` 自然终止为 `partial/visual_budget_exhausted`。黑白线稿与材质渲染各达到 3 篇 usable；红灰配色在 4 帖上限内只有 2 篇 usable，后两帖 8 张图片均为类型不匹配。20 个结果全部为本地 XHS 内容，普通网页事件 0、fallback=0；保留、不 retry、不计验收。
- **图纸输入边界**：图纸研究只接收视觉风格和图纸类型，不询问或推断建筑类型、项目主题、场地或空间关系。查询中的“建筑爆炸图”仅是排除产品拆解图的制图学科消歧，不是建筑类型。
- **显式风格保真修复**：红测先准确失败后转绿；明确枚举的视觉短语必须逐项逐字进入独立子问题，违规时最多一次普通 Responses 结构化纠正。Provider/相关全集、完整 API 562/562 与全部静态门禁全绿；没有风格词表、预算变化或确定性伪完成。
- **跨图纸类型查询归一化**：真实模型输出的 `图纸类型：风格` 暴露冒号残留；爆炸图两个红测和剖面图一个跨类型红测均先失败后转绿。公共入口统一移除中英文冒号，完整 API 566/566 与静态门禁全绿。
- **真实跨类型探针**：未见剖面图视觉题由真实普通 Responses 逐字保留针管笔密线、低饱和色块和纸张纹理拼贴；查询规范为“剖面图 + 完整风格”，无项目语义、无确定性 fallback，未创建 Run。
- **未见剖面图失败样本**：Run `a6752b62-90f4-4cb4-bf12-e1217db43650` 为 `partial/visual_budget_exhausted`；前两方向各 3 篇 usable，过窄的纸张纹理拼贴仅 2 篇。22 个本地 XHS 资产、普通网页 0、fallback=0。A/B 未证明词序问题，保留、不 retry、不计验收。
- **XHS 正式验收 2/3**：宽泛轴测图 Run `708ab8df-7829-4ea2-b19f-5382fa941920` 为 `completed/coverage_satisfied`，三方向 usable 3/3/3，27 个本地资产、9 篇 XHS 笔记；实际查询仅含视觉风格和轴测图，普通网页 0、fallback=0。
- **平面图失败样本**：Run `d654ecac-3e76-40a6-9555-02789f92cbec` 为 `partial/visual_budget_exhausted`；黑白线稿 3 篇 usable，水彩 0 篇，拼贴 1 篇。类型识别正确、普通网页 0、fallback=0；不加单题词表、不 retry、不计验收。
- **宽泛立面图失败样本**：Run `4bb39b3c-5bc0-46c3-95f7-ab53c9f62937` 为 `partial/visual_budget_exhausted`；三方向 usable 为 2/3/3。失败来自前四条本地搜索元数据中存在空内容或错误图纸类型，不是建筑类型污染、普通网页或 fallback；保留、不 retry、不计验收。
- **通用候选池实现**：视觉 XHS 搜索先读取最多 8 条元数据，按图纸类型标题命中和视觉短语 CJK bigram 相关性排序，再保留最多 4 帖进入既有打开/下载/视觉检查。每帖 4 图、48 图/48 MiB、每方向 3 usable 不变；Trace 增加 `xiaohongshu_candidate_pool`。
- **定向验证**：候选池 8→4 排序红测先失败后转绿；`test_xiaohongshu.py` 13/13、完整 `test_browser_inspection.py` 和定向 Ruff 通过。该修改后的完整 API、format、strict Mypy、diff check 和服务重启尚未完成。
- **图纸输入合同再明确**：用户输入只包含视觉分割/构图/表现方向和剖面图、爆炸图、轴测图等图纸类型。图纸规划、fallback、Board 文案和执行查询不得询问、推断或要求建筑类型，也不得混入项目主题、场地或空间关系。
- **全入口审查与红测**：后端 Provider、fallback、QueryAttempt、实际 XHS 查询和普通网页隔离均已满足纯视觉边界；Board 视觉模式仍显示建筑研究总提示，新增行为测试在旧 UI 上准确失败。
- **最小 UI 修复**：视觉模式首屏只呈现图纸类型与分割/构图/线型/配色/版式方向；建筑模式文案不变。目标 Board 3/3、后端输入边界与候选池目标 6/6 通过。
- **完整门禁收口**：相关 Python 六文件全集、完整 API 567/567、Board 181/181、Ruff lint、64 文件 format、strict Mypy 26 源文件、Board lint/typecheck/build 与 diff check 全绿。
- **运行时加载**：确认 API/Board、`logged_in/local_search`、7 工作区 94 历史 Run 且活动 Run=0，已重启源码服务加载候选池。
- **第三条候选失败样本**：Run `09cd4cb4-4853-42a9-b388-e38baaf42333` 的 Provider 三方向保持纯视觉，但第一方向 8 条候选只有 1 条标题明确命中效果图；4 帖后 2 usable，已取消保留、不 retry、不计验收。
- **通用根因**：`效果图`存在摄影/影视/产品歧义，和爆炸图的产品拆解歧义同类；候选池现有类型命中优先级又会放大非建筑噪声。A/B 表明建筑制图学科限定能恢复建筑渲染候选，不需要也不允许具体建筑类型词表。
- **红测与最小实现**：效果图学科限定和混合标题候选排序在旧实现上准确失败；统一歧义类型消歧与综合候选分实现后，新旧目标 7/7 转绿。建筑语境会覆盖“电影感”等合法风格词的噪声命中。
- **回归收口**：视觉/XHS/浏览相关六文件 328/328、完整 API 569/569、Ruff lint、64 文件 format、strict Mypy 26 源文件与 diff check 全绿；固定 XHS/视觉预算和准入未改。
- **XHS 正式验收 3/3**：宽泛效果图 Run `c521e3bd-6067-4453-b574-7c62684624e8` 为 `completed/coverage_satisfied`，三方向各 3 篇 usable，共 25 个 `render` 资产来自 9 篇 XHS 笔记；全部 URL 与本地文件有效。
- **产品边界实测**：QueryAttempt 只有“建筑效果图 + 视觉方向”。“建筑”仅作制图学科消歧，不是建筑类型；无项目、场地或空间语义。三次候选池均为 8→4，普通网页事件 0、fallback=0。
- **当前验收计数**：建筑 3/3、XHS 3/3，总计 6/6，活动 Run=0。
- **Board 六条验收通过**：三条建筑均显示 3 个子问题章节、逐题结论、案例答案、来源和转译步骤，图片共 10/10 加载；三条 XHS 均显示 3 个方向与 9 篇来源笔记，图片 24/24、27/27、25/25 加载。页面错误和非预期本地响应错误为 0。
- **视觉检查**：六张整页截图保存在 `.artifacts/qa/v2.2.4-board/`，已检查无结果缺失、断图或布局重叠。未创建或 retry 任何 Run。
- **`v2.2.4` 版本合同**：API、Board、Extension、manifest、CI artifact、Release 测试、README 和部署文档已统一；历史发布记录保持不变。Release 合同先准确红在旧 CI artifact，同步后转绿，当前发布面旧版本扫描为空。
- **GitHub 首页更新**：README 明确仍为 Evidence-Grounded Plan-and-Execute，并展示模型结构化规划 → 本地候选搜索 → 候选 ID 白名单筛选 → 本地正文/图纸读取 → 模型分析 → 程序证据绑定；空间优先与纯视觉 XHS-only 边界写入发布合同。
- **完整门禁通过**：API 569/569、Board 181/181、Extension 182/182、packaged E2E 8/8；Ruff 64 文件、strict Mypy 26 源文件、TypeScript lint/typecheck/build 和 Windows 发布合同全绿。
- **发布产物**：扩展 ZIP 为 18,719 bytes，manifest `2.2.4`，SHA-256 `4349E77FEFDEF8AF0F0C22F59D0F6C79AEFB398F17F2AA911CF45EEF76FAA26B`；安装器为 69,748,597 bytes，文件/产品版本 `2.2.4`，SHA-256 `AB2D0D19B4260C89A9F7DE02D277A4EC946707E9AE0D40492E3ABAE27B97A70B`。
- **真实安装 smoke**：静默安装、自检、快捷方式、扩展排除、安装版启动、动态端口健康、API/Board 200、静默卸载与无残留全部通过；仓库标准 package smoke 另行通过。
- **当前唯一下一步**：审计并显式暂存全部跟踪修改，排除 `.artifacts/`、`.archresearch/` 与真实研究数据；提交、推送、PR、CI、合并并发布正式 `v2.2.4`。
- **发布前历史核对**：远端 `main` 与当前分支 HEAD 文件树一致，但 `v2.2.3` 由不同提交历史形成；发布提交前先以普通 merge 连接 `origin/main` 的等价历史，使新 PR 只显示本轮 `v2.2.4` 差异。不得 reset、checkout、clean 或重写历史。
