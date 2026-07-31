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
