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

- `HEAD` / `main` / `origin/main`: `87826af`
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

## External gates

- 30 条版本化任务的真实网页批量执行与人工标注需要用户主动启用，并可能产生 Provider 费用。
- 100+ 独立来源、权利清晰的真实图纸样本仍是外部数据门槛；当前 108 张为确定性合成夹具。
- GitHub Hosted CI run `30636022102` 已于 `2026-07-31 14:09:09 UTC` 成功；coverage、完整本地门禁、安装器构建和 smoke 均通过。
- PR #11 已标记 Ready 但尚未合并；不自动合并 PR、不重新发布已有 `v2.2.2` Release。

## Session note

- 规划 skill 的 `session-catchup.py` 在本机未能运行：系统 `python` 命令指向 Microsoft Store 别名，随后仓库虚拟环境调用又发生 Windows 路径解析错误；未写入仓库，已按恢复顺序直接读取规划文件并继续。

## Next action

本阶段验证和管理记录同步已完成；PR #11 的 CI 已转绿并标记 Ready，下一步等待用户审查后明确决定是否合并。
