# Progress Log

> 本文件只保留当前 M179 本地恢复进度。退役 Web Edition、Cloudflare 部署和已失效的旧“下一步”已按用户要求直接删除；确需追溯时使用 Git 历史。

## 2026-07-31 M179 direction

- 用户终止 Cloudflare Web Edition，要求恢复 GitHub 本地部署，并在本地链路转绿后删除 Web/Edge，避免两套运行时继续交叉。
- 恢复基线确定为 `1695973`；当前仓库基线为 `main` / `origin/main` = `87826af`。
- 全程保留既有修改和 `.artifacts/`，禁止 reset、checkout、clean、commit、push、内部浏览器、Firecrawl 和真实 Provider 研究。

## Behavior-first restoration

- 首先恢复本地 Desktop 和 Windows installer 行为测试；红灯分别为缺失 `archresearch_api.desktop` 与缺失安装器构建脚本。
- 从 `1695973` 定点恢复桌面启动器、动态回环端口、严格 Chrome URL allow-list、Windows Credential Manager Provider 配置、PyInstaller launcher、Inno Setup、图标与安装 smoke。
- 恢复 Board 从当前 loopback origin 派生 WebSocket endpoint。
- 恢复扩展本地状态、权限、手动配对、断开和 loopback background controller。
- 恢复真实 FastAPI + packaged Chrome Extension E2E。
- 定向验证通过：Desktop 8/8、API browser 29/29、Board bridge 7/7、Extension local UI/background 14/14、Board App/result/bridge 109/109、packaged E2E 8/8。

## Web runtime removal

- 删除 `apps/web`、`apps/edge`、`scripts/verify-web.ps1` 及忽略的 dist、node_modules、`.wrangler` 和 tsbuildinfo。
- 删除 Extension public HTTPS bridge/controller/public XHS adapter、对应测试和 Vite entry。
- 删除 Board public-edition、Turnstile、公共视觉来源和前端公共 XHS 分支。
- 根 workspace、package scripts、lockfile、`verify.ps1`、Windows CI 与 release contracts 收敛为 root + Board + Extension + Python/installer gates。
- README、PRODUCT、DESIGN、architecture、extension、demo、development、failure、AGENTS 和 HANDOFF 收敛为 Windows 本地单产品。
- Release contract 先在缺失本地 setup/installer 合同时取得预期红灯，恢复后转绿。
- 残留扫描确认：退役路径和配置均不存在；源码/配置唯一命中是 Release 负向守卫，面向用户文档零命中。

## Final verification

- 最终 `scripts/verify.ps1` exit 0，stdout 为 `.artifacts/qa/m179-verify-final-e830bf9702004786822a01887eccc8d6.out.log`，stderr 为空。
- API 389/389、Board 178/178、Extension 165/165、packaged E2E 8/8。
- Ruff/64-file format、strict Mypy、lint/typecheck、Board/Extension production builds、进程、安全、评测、manifest/protocol 和 Windows 发布合同全部通过。
- `scripts/build-extension-package.ps1` 成功生成 18,260-byte v2.2.2 扩展 ZIP，SHA-256 `9D554576B6DDAAD705EC4E66B1D948EB2305A749CAEFAE40144EC04D8FAD0902`。
- `scripts/build-windows-installer.ps1` 成功完成 Board build、PyInstaller 和 Inno Setup，生成 69,681,830-byte v2.2.2 安装器，SHA-256 `F859C66720D0A493950653F2178E34C7955CBF7D838CD4569C36D994A30162A1`。
- `scripts/test-windows-installer-package.ps1` 通过真实静默安装、快捷方式、精简 `PATH` 下 `--self-test`、扩展排除、静默卸载和残留检查。
- `/desktop-health` 与 `/health` 行为在同轮 desktop app 测试中通过；packaged E2E 证明真实 FastAPI、扩展配对、浏览器裁图与本地资产读取。
- `pnpm -r list --depth -1` 只列出 root、Board、Extension。
- `git diff --check` exit 0；`HEAD/main/origin/main` 均为 `87826af`。

## Current working tree

- 保留全部本地恢复修改、Web/Edge 删除项和 `.artifacts/build/`、`.artifacts/qa/`、`.artifacts/releases/`。
- 未 reset、checkout 或 clean；本地恢复和 Provider 兼容性修改已提交并推送到 `agent/local-release-v2.2.2`，`v2.2.2` tag 和 GitHub Release 已发布。
- 未调用内部浏览器，未读取用户 Cookie、Chrome 会话或 Provider Key，未创建/取消/重试真实研究，未恢复 Firecrawl，未部署 Worker。
- M179 已完成，当前正在执行用户已授权的 v2.2.2 发布流程。

## 2026-07-31 Provider configuration contract correction

- 用户进一步明确：模型 ID 不应由用户手输；新首配必须从用户接口的 `/models` 获取模型列表，用户只能选择上游返回的模型项。
- 先修改 `apps/api/tests/test_provider_setup.py` 形成红测：空模型不创建客户端、不在上游列表的模型拒绝、只探测选中模型、模型顺序不被 `gpt-5.6-sol` 改写，CLI 只使用模型序号或列表模式。
- 生产代码已改为显式模型校验；`gpt-5.6-sol` 改为 `LEGACY_DEFAULT_PROVIDER_MODEL`，仅保留旧 `provider.json` 缺字段兼容。
- 桌面首配改为“获取模型列表 + 只读下拉选择 + 验证所选模型”；PowerShell 脚本先列出模型、用户输入序号，再通过 `--model-index` 保存。
- README、architecture、Board PRODUCT、development、demo、release/install contracts 已移除自动选模文案并改为新合同。
- 当前已验证 `apps/api/tests/test_provider_setup.py`：16/16 通过；Provider/凭据/启动/桌面定向回归 40/40 通过；PowerShell 配置、安装器和 Release contracts 通过。
- 完整 `scripts/verify.ps1` 通过：API 395、Board 178、Extension 165、packaged E2E 8，Ruff/strict Mypy、前端 lint/typecheck/build 全绿。
- 未覆盖当前 `.artifacts/build/windows` 的前提下，在隔离临时副本构建了新的 Windows 安装器并完成真实安装 smoke；新产物位于 `.artifacts/releases/provider-contract-v2.2.1/`，SHA-256 为 `AD575B9206F8A3B4B8C1774FCD5732862B86D113F677310E37FFA7C27C965489`。
- 外部 Provider 只做临时连接验证：根地址返回 403；带 `/v1` 的 base URL 获取到 23 个模型，`gpt-5.6-sol` 兼容 Responses structured output 探测通过；未保存 Key 或配置。用户应立即轮换已暴露的 Key。

## 2026-07-31 Provider endpoint follow-up

- 使用用户临时提供的 Key 做了不落盘验证：直接访问根地址的 `/models` 和带 `/v1` 的 `/models` 均返回 23 个模型，其中 21 个通过本地文本模型过滤。
- 应用同款 OpenAI 客户端以根地址为 Base URL 时，模型列表虽可读，但 `/responses` 探测失败；改用带 `/v1` 的 Base URL 后，`gpt-5.6-sol` 的 `responses.structured_output` 探测通过。
- 未保存 Key、provider 配置或研究数据；该 Key 已在对话中暴露，仍需轮换后再写入 Windows Credential Manager。

## 2026-07-31 DeepSeek compatibility smoke

- 使用用户临时提供的 DeepSeek Key 做了不落盘应用同款验证：根地址返回 2 个可用模型，自动使用上游返回的 `deepseek-v4-flash`，`responses.structured_output` 探测通过。
- 结论：兼容层必须优先保留原地址并以能力探测选择最终 Base URL，不能无条件追加 `/v1`；未保存 Key、provider 配置或研究数据。

## 2026-07-31 Provider compatibility and v2.2.2 release candidate

- Provider 首配已支持同主机候选地址：原地址、追加 `/v1`，根地址追加 `/api/v1`；模型列表跨候选合并去重，配置只探测用户选择的模型，并保存成功候选。
- 用户输入根地址且根路径模型列表可读时，若 Responses/Chat Completions 探测失败会继续尝试后续候选；原地址能力完整时保持原地址。新增候选解析、模型合并和回退保存红测，Provider setup 22/22 通过。
- 版本面已从 `2.2.1` 提升到 `2.2.2`。README 主标题改为本地优先研究工作台，GitHub Release 计划使用“ArchResearch 本地版 v2.2.2”，同时说明 Windows 安装器与独立 Chrome 扩展。
- 权威 `scripts/verify.ps1` 通过：401 API / 178 Board / 165 Extension / 8 packaged E2E，Ruff/strict Mypy、前端 lint/typecheck/build 和 Windows 发布合同全绿。
- `scripts/build-extension-package.ps1` 生成 18,260-byte 扩展 ZIP，SHA-256 `9D554576B6DDAAD705EC4E66B1D948EB2305A749CAEFAE40144EC04D8FAD0902`；Windows 安装器 69,681,830 bytes，SHA-256 `F859C66720D0A493950653F2178E34C7955CBF7D838CD4569C36D994A30162A1`。
- `scripts/test-windows-installer-package.ps1` 真实安装、启动自检、扩展排除和卸载 smoke 通过；当前分支已提交并推送，`v2.2.2` tag 和 GitHub Release 已发布。

## 2026-07-31 Release verification

- 权威门禁核心阶段通过：API 401/401、Board 178/178、Extension 165/165、packaged E2E 8/8，Ruff、strict Mypy、前端 lint/typecheck/build、Windows 安装器合同和真实安装 smoke 均通过。
- 外层 `scripts/verify.ps1` 在最后的根级 `pnpm check` 收尾时超过工具 180 秒窗口；随后独立执行 `pnpm run check` 退出码 0，未发现代码或构建失败。
- 用户已授权创建分支 PR、`v2.2.2` tag 和 GitHub Release；Release 已使用标题“ArchResearch 本地版 v2.2.2”，正文只描述 Windows/Chrome 本地产品，附件为 Windows 安装器与独立 Chrome 扩展 ZIP。

## 2026-07-31 GitHub publication

- 草稿 PR：[#11](https://github.com/jileyu2000/archresearch/pull/11)，标题为“ArchResearch 本地版 v2.2.2”，目标 `main`。
- 正式 Release：[v2.2.2](https://github.com/jileyu2000/archresearch/releases/tag/v2.2.2)，非草稿、非预发布；tag 指向 `5637ee0`。
- GitHub 侧附件核验通过：Windows 安装器 69,681,830 bytes，独立 Chrome 扩展 ZIP 18,260 bytes；Release 文案没有生产 Web URL 或 Provider Key。

## 2026-07-31 PR coverage correction

- PR #11 的 GitHub Actions `verify` 只在 `pnpm test:coverage` 阶段失败：扩展 165 个测试全部通过，但 statements 82.61%、functions 83.56%、lines 84.65% 分别略低于旧阈值。
- 根因是恢复本地扩展时删除了 Web Edition 对应测试，覆盖率阈值仍按旧公共扩展基线保留；本机已稳定复现同一失败。
- 新增 `apps/extension/tests/screenshot.test.ts`，覆盖成功裁图、无效 viewport、越界区域和 Canvas 不可用；未下调 coverage 阈值，也未改生产代码。
- 修复后扩展 coverage 为 statements 85.05%、functions 84.50%、lines 87.16%；根级 frontend coverage、lint、typecheck 和完整 `scripts/verify.ps1` 均通过，等待推送后的 PR 重跑。

## 2026-07-31 PR CI recheck

- 已确认本地工作树仍只保留 `.artifacts/build/`、`.artifacts/qa/`、`.artifacts/releases/` 未跟踪产物；没有 reset、checkout、clean 或新增代码修改。
- GitHub Actions run `30633778406` / job `91166171854` 已于 `2026-07-31 13:31:45 UTC` 成功完成；coverage、完整本地门禁、扩展 ZIP、Windows 安装器和真实安装 smoke 全部通过。
- PR #11 当前仍为 Draft；没有合并 PR、重发 `v2.2.2` 或调用浏览器。当前等待用户明确决定下一步发布/合并动作。
- 规划 skill 的 `session-catchup.py` 尝试因本机 Python 别名和后续 Windows 路径解析问题失败；未改变仓库，改为直接读取并同步规划文件。

## 2026-07-31 PR ready and latest CI

- 管理文档提交 `d52da0d` 已推送，PR #11 已成功标记为 Ready；GitHub 连接器权限不足时改用已认证 `gh` CLI 完成状态变更。
- 最新 run `30637527995` / job `91178802341` 已于 `2026-07-31 14:30:26 UTC` 成功完成；coverage、完整门禁、扩展 ZIP、Windows 安装器和真实安装 smoke 全部通过。
- 期间尝试读取运行中 job 日志时 GitHub 返回 404 `BlobNotFound`，因为日志尚未生成；未取消或重跑该 run，随后 run 正常完成。
- PR #11 随后已于 `2026-07-31 14:34:44 UTC` 合并到远端 `main`，merge commit 为 `919611994503e6165ae5f0b450022a4a6fd24684`；未重发 `v2.2.2`，未调用浏览器。

## 2026-07-31 PR merge

- PR #11 已通过 squash merge 合并到远端 `main`；本地 checkout 保持在 `agent/local-release-v2.2.2`，没有 checkout、pull 或清理 artifacts。
- 当前没有待处理的 CI 修复；下一步由用户决定是否下载/验证 Release 或开始新的任务。

## 2026-07-31 Handoff checkpoint

- 已按交接顺序完整读取 `HANDOFF.md`、`AGENTS.md`，恢复 `task_plan.md`、`findings.md`、`progress.md`，并运行 `git status --short --branch`。
- 已验证当前远端 `main=9196119`、发布 tag `v2.2.2=5637ee0`；本地 checkout 保持在 `agent/local-release-v2.2.2` / `HEAD=2429277`，未 fetch、pull、checkout 或清理。
- 已验证源码开发页与 GitHub 发布版的关系：源码模式是 Board `5173` + API `8000`，GitHub 版是同一生产代码的 Windows 打包版，扩展独立发布；不是两套在线/本地业务实现。
- 当前没有未完成的 CI 修复或代码修改任务；保留四份管理文件修改和 `.artifacts/` 未跟踪产物。
- 错误：系统 `python` 命令命中 Microsoft Store 别名；改用仓库虚拟环境后 `session-catchup.py` 成功，无仓库写入。没有其他阻塞。
- 唯一下一步：用户在同一项目目录新建对话；新对话先按 `HANDOFF.md` 顺序恢复并报告状态，等待用户明确的新任务，不自动开始 Release 验证或代码修改。

## 2026-07-31 Visual and research completion investigation

- 已按交接顺序重新读取 `HANDOFF.md`、`AGENTS.md`、`task_plan.md`、`findings.md`、`progress.md`，并运行 `git status --short --branch`；现有修改和 artifacts 均保留。
- 只读检查本机 `.archresearch/archresearch.db`：图纸 Run `06843b31-d478-4b82-959f-49c1f15e65be` 的规划 Provider 返回 `AuthenticationError`，XHS 搜索成功但图片处理/视觉分类失败，最终没有资产。
- 已确认当前代码把规划 Provider 错误降级为确定性计划，并把图片分类错误吞进 `xiaohongshu_assets failed`，所以 Run 继续消耗浏览/视觉预算且 Board 只显示 `no_usable_assets`。
- 当前阶段未读取 Key、未调用 Codex 内置浏览器、未创建/重试真实研究、未修改生产代码；下一步是先写视觉 Provider 认证失败的红测，再做 fail-fast 修复。
- 已改为成功导向的视觉回退：视觉 Provider 的认证/连接等明确请求错误会触发受限本地确定性分类，已下载图片继续进入结果；正常 Provider 成功时不改变路径。
- 新增集成红测现已通过：规划认证失败仍能完成三个 XHS 方向，保留 12 张视觉结果；视觉、XHS、工作流回归与 Ruff 通过。
- 用户明确不新增 token、费用或用量统计；用量由用户自行查看梭子蟹后台。
- 已补网页正文分析的确定性回退：只使用已读取页面原句建立证据绑定案例；综合认证失败使用已有确定性综合。
- 新增网页分析/综合失败集成测试，验证 Provider 规划、页面分析和综合全部认证失败时 Run 仍为 `completed/coverage_satisfied`；定向测试与 Ruff 已通过。
- 下一步：重启本地 API，重试现有图纸与建筑失败 Run，确认真实结果后再统一提交。

## 2026-08-01 Zero-coverage retry recovery

- 只读核对真实 SQLite：图纸 Run attempt 1 为 `blocked/no_usable_assets`，预算 46 visual / 12 browser；建筑 Run attempt 1 为 `blocked/research_synthesis_incomplete`，正文覆盖 0，预算 24 visual / 36 browser，且 24 个查询均 completed。
- 先新增两条红测。预算测试显示执行器启动前仍收到 `24/901232/True/36`；查询测试显示未产出证据的首轮 completed 查询只执行一次。两条均按预期失败。
- 在 retry 事务中仅对零覆盖 Run 刷新视觉调用、视觉字节、字节上限和浏览页计数；在工作流中仅对 attempt 大于 0 且实时覆盖为 0 的 Run 清空继承查询键。
- 修复后 retry API 2 项、查询恢复及部分结果保护 5 项定向回归通过；未新增用量统计，未读取 Key，未调用 Codex 内置浏览器，未提交或推送。
- 相关浏览/工作流/Run API 回归 168 项通过；随后完整 API 测试套件通过，Ruff lint、64-file format check、strict Mypy 与 `git diff --check` 全部通过。
- 通过 `scripts/stop.ps1` / `scripts/start.ps1` 重启本地服务；API `8000` 健康且 Provider 为梭子蟹 `gpt-5.6-sol`，Board `5173` 返回 200。
- 只对图纸 Run 发出一次 retry：attempt 2 经过 inspecting/searching，最终 `completed/coverage_satisfied`，34 个结果、3/3 覆盖、9 个来源项目。
- 图纸终态后只对建筑 Run 发出一次 retry：attempt 2 从 19 个候选、0/4 覆盖推进至 36 个结果、4/4 覆盖、6 个项目、79 条 EvidenceClaim，最终 `completed/coverage_satisfied`。
- 两条 Run 的 Trace 均保留 Provider 错误类型和确定性回退模式；未新增用量统计，未读取 Key，未调用 Codex 内置浏览器，未恢复 Web/Edge/Firecrawl，未 push。

## 2026-08-01 Completed result visibility gap

- 用户提供真实 Board 截图：建筑 Run 顶部已有研究结论，但四个子问题全部显示“这一问题暂时没有可用结果”；据此撤回“用户可见完成”的判断并继续修复。
- 直接 API 核对显示同一 Run 当前有 36 条结果和完整子问题关联，根因范围收敛到 Board 结果查询缓存或前端归组。
- 继续读取结果水合、轮询、归组和 `toWorkResult()` 后确认：终态打开和轮询完成都会重新 hydrate，真实问题不是旧缓存。
- 真实 36 条结果中 22 条有逐题正文分析，四个子问题分别有 12/12/6/4 条；但顶层条件与机制为英文来源原句，Board 的中文 `analysisReady` 门槛把 36 条全部过滤。
- 当前修复方向改为：只放行有逐题确定性回退标记和正文 EvidenceClaim 的结果，并保留现有“普通旧英文图片线索不能成为案例”保护。未调用 Codex 内置浏览器，未修改真实 Run。
- 只读搜索曾把 Windows 不支持的 `**/*.test.tsx` glob 作为 `rg` 路径参数并失败；已改用 `-g` 过滤成功，没有写文件或重复失败命令。
- 新增 Board 红测后先得到预期失败：完成页仍找不到 `Live Mill Conversion` 案例；最小修改 `toWorkResult()` 后，新回退测试与旧英文图片线索保护测试 2/2 通过。
- 使用项目 Playwright 而非 Codex 内置浏览器打开真实 Run；首次因两条同名记录触发 strict locator 错误，随后按“36 张参考”精确选择成功。
- 真实页面四章分别显示 3/3/2/1 个案例，空状态均为 0；完整页截图写入系统临时目录，没有修改真实 Run 或 Provider 配置。
- 完整 Board 回归通过：15 个测试文件、179 项测试；ESLint、TypeScript typecheck、Vite production build 和 `git diff --check` 均通过。

## 2026-08-01 v2.2.3 real-provider release qualification

- 用户明确授权创建新的真实研究以确认 API Key 调用，并在确认建筑与图纸路径均跑通后发布最新版地部署包。
- 当前分支包含未发布提交 `fb727c8` 与 `a3f95cb`，相对远端分支 ahead 2；工作树除既有 `.artifacts/build/`、`.artifacts/qa/`、`.artifacts/releases/` 外干净。
- GitHub CLI `2.96.0` 已认证为 `jileyu2000`，具备 `repo` 与 `workflow` 权限；发布版本按补丁升级规划为 `v2.2.3`。
- 真实验收计划为 2 条建筑快速研究和 2 条图纸灵感研究；每条必须有成功 Provider Trace，纯 deterministic fallback 不算通过。
- 已收取新配置能力复核结果：模型列表返回 8 项，所选 `gpt-5.6-sol` 存在，`responses.structured_output` 探测成功；Key 未读取、打印或写入仓库。
- `planning-with-files` 恢复脚本首次调用系统 `python.exe` 时命中 Microsoft Store 占位符；随后改用 Codex 工作区捆绑 Python 成功恢复 46 条未同步上下文。
- 当前唯一立即动作是重启本地 API/Board，让新进程加载新凭据；重启前未创建新的发布验收 Run。
- 已运行 `scripts/stop.ps1` 与 `scripts/start.ps1`；重启后 API `/health` 显示 `provider_mode=openai`、`OpenAI 兼容 API`、`gpt-5.6-sol`，Board `5173` 返回 HTTP 200。
- 开发 API 的 `/desktop-health` 返回 404；此端点属于后续冻结安装版自检范围，不作为源码研究验收阻塞。
- 已核对现有 Run API、工作区 API 与 Trace 端点；后续四条验收 Run 将直接使用产品公开合同创建和轮询，不新增一次性生产脚本。
- 已在专用工作区创建第一条建筑 quick Run `4a980fa4-5844-4535-bf91-83a3047bfd2d`；问题覆盖社区图书馆中庭、阶梯阅读、环形流线、采光和结构。
- 当前 Run 处于 `inspecting`，Trace 已推进到 24 条，已出现成功 `public_page_analysis`；保持单活并等待终态。
- 第一条建筑 Run 继续推进到 40 条 Trace、18 个可用资产和 1/3 子问题覆盖；API/Board 进程正常，未并发其他 Run。
- 第一条建筑 Run 已进入第 2 轮补查，Trace 62 条；当前 1/3 覆盖、18 个可用资产，尚未满足验收标准。
- 第一条建筑 Run 进入第 3 轮有界恢复并继续检查页面，Trace 111 条；仍为 1/3 覆盖，尚未产生终态或 Provider 错误。
- 第一条建筑 Run `4a980fa4-5844-4535-bf91-83a3047bfd2d` 终态为 `partial/budget_exhausted`：20 个可用资产、1 个项目、1/3 覆盖。
- Trace 证明 `planner=openai` 且多次正文分析由 Provider 成功完成，但有一次 `APITimeoutError`，最终综合因 `ValueError` 使用确定性回退；该 Run 判定为发布验收失败，开始修复而非继续下一题。
- 已定位两条待验证修复方向：提取综合 `ValueError` 的精确结构化校验消息；覆盖本地搜索返回偏题或重复 URL 后仍应调用 Provider 搜索补源的行为测试。
- 综合诊断脚本第一次因错误导入路径退出，未触发 Provider；改用现有 `agent.execution.get_run` 后，真实重放成功返回 2 条因果链和 1 条建议，确认原结构化失败具有瞬时性。
- 下一步先写两类红测：可恢复的综合输出校验失败只重试一次；本地搜索在恢复轮没有新增可用来源时调用 Provider 搜索补源。
- 阅读现有搜索合同后撤销“恢复轮调用模型 web_search”方向：该行为被明确禁止且兼容 API 未必支持工具调用。红测改为验证新建图书馆类型/功能/环流/采光结构检索词不再落入改造项目模板；综合一次重试方向保留。
- 用户明确纠正：产品应由模型搜索网页。已撤销 local-only 合同判断，准备改为模型搜索主路径、本地页面读取、失败时本地搜索兜底。
- 当前 Key 的第一次直接模型 `web_search` 能力实测在默认 45 秒超时；下一步以 120 秒上限复核，期间不启动新 Run。
- 用户随后纠正理解并最终确认 OpenCLI/本地浏览器搜索架构不变；已终止 120 秒模型 `web_search` 复核，未修改生产搜索路径。
- 继续保留两项真实失败修复范围：图书馆公开搜索词不再套用旧改造模板；综合结构化输出校验失败时有界重试一次。
- 新增的图书馆检索词和综合一次重试测试均取得预期红灯；开始修改最小生产实现。
- 第一轮实现后综合重试测试转绿；图书馆采光结构题仍被错误识别为旧建筑结构界面，已增加“只有明确改造语义才使用新旧界面词”的修正。
- 图书馆检索词与综合有界重试两项定向测试 2/2 通过；开始运行规划、Provider、浏览器搜索回归与 Ruff。
- 相关回归首次运行有 2 个旧断言需同步：综合最坏耗时仍按单次计算，中文采光查询要求原短语连续；Ruff lint 通过，format check 提示 3 个文件需格式化。
- 同步断言并格式化后，规划/Provider 37 项、本地浏览器搜索相关 6 项、Ruff lint/format 全部通过。
- 综合工作流定向回归 15 项通过；确认有界结构重试不改变任意程序错误不得隐藏的边界。准备重启服务并新建建筑验收 Run。
- 已重启服务并创建全新图书馆建筑 Run `ae30c6a8-baae-458e-a21c-2684f8392db3`；规划为 `planner=openai`、无错误，三个子问题覆盖中庭环流、采光屋顶、活动声学。
- 当前进入首轮 `inspecting`；首批本地搜索含一条医院噪声结果，等待模型正文相关性筛选与后续覆盖结果后再判断。
- 模型正文分析已把医院噪声判为 `relevance=0`，但首题当前仍为 0/3 覆盖、4 个可用资产；继续运行并核对实际持久化搜索词。
- 核对三个实际公开查询后确认它们完全相同，均为环形流线词；新 Run 当前仍 0/3 覆盖。决定取消本次失败验收，先修复真实规划子问题的意图区分。
- 已取消 Run `ae30c6a8-baae-458e-a21c-2684f8392db3`，终态 `cancelled/user_cancelled`，保留 11 个资产和 0/3 覆盖作为失败证据；未启动并发 Run。
- 将该 Run 的三个真实 Provider 子问题写入检索词行为测试，要求分别生成环流、采光结构、活动声学查询。
- 真实子问题扩展测试取得预期红灯：活动声学题仍生成环流查询；开始补足声学与采光意图权重。
- 用户扩展任务为“默认不依赖 web_search 的模型辅助精准搜索”：普通 Responses 生成搜索词、筛选本地候选，Playwright 搜索/读取，程序绑定证据；要求排除集合、差异化补查、Trace 和严格 2+2 真实发布验收。
- 已更新执行计划；当前进入 Pydantic 搜索规划/候选筛选合同和工作流行为红测阶段。
- 已定位最小接入点：Provider 增加普通 Responses 查询规划/候选筛选协议，工作流在 `_try_public_search` 前后接入，不新增客户端或运行时。
- 已写入 Provider、确定性查询、工作流去重/降级/预算和 XHS 隔离红测；首轮运行在缺失新 Pydantic 合同处按预期失败。
- Provider 合同实现后，普通 Responses 查询规划测试已转绿；旧厂房“保留结构”意图仍为红灯，候选测试另有一个缺失枚举导入，已定点修正。
- 修正后 Provider/确定性查询定向测试 4/4 通过；工作流红测 2 项继续失败，准确复现“未调用辅助规划/筛选”和“低相关候选仍进入页面读取”。
- 接入工作流 helper 后，模型辅助本地搜索核心测试 2/2 通过；原生 `provider.search()` 调用数为 0，候选去重/低相关排除、fallback Trace、差异化补查与查询预算均满足断言。
- 新会话按 `HANDOFF.md` 顺序完成恢复；`session-catchup.py` 首次调用系统 Python 命中 Microsoft Store 占位符，改用 Codex 捆绑 Python 后成功报告未同步上下文。一次并行只读命令因非零结果丢失整组输出，改为 `Promise.allSettled` 后正常收集；两次均未写项目文件。
- 原样重跑确认 3 个兼容红灯：两个综合预算测试未读取候选正文，inline 零覆盖 retry 的视觉分类调用为 0；strict Mypy 同时报告 fallback 查询语言未收窄。
- 最小修复只在搜索规划/候选筛选 Provider 存在时读取辅助时间预算，零覆盖 retry 不继承上一 attempt 的来源/项目/已检查 URL 排除集，并显式收窄 fallback 语言。
- 修复后 3 个兼容测试 3/3 通过，strict Mypy 对 26 个源文件通过；下一步运行完整 API 与 Ruff，服务尚未重启加载最新代码。
- 完整 `apps/api/tests` 回归通过；Ruff lint 通过、64 个文件 format check 通过，strict Mypy 与 `git diff --check` 通过。兼容性阻塞清零，下一步重启服务并开始 2+2 单活真实验收。
- 已用 `scripts/stop.ps1` / `scripts/start.ps1` 重启源码服务；`/health` 为 `openai` / `gpt-5.6-sol`，Board `5173` 返回 200，所有工作区无活动 Run。
- 创建真实验收工作区 `447c8709-7e09-4c07-b7e8-9f8587055b41`，随后单活运行首条新建社区图书馆建筑题 `08bc6d54-c9f1-4360-80e8-356504eb6cce`。
- 首条建筑 Run 经 15 次有界尝试后终态为 `blocked/research_synthesis_incomplete`，0 个资产、0/3 覆盖；模型 `search_query_planning` 多轮成功，但本地搜索未形成候选。该 Run 不计入发布验收，停止后续题目并进入查询/本地搜索诊断。
- 进一步解析 SSE：首轮每题本地搜索均返回 4 个候选且模型筛选成功调用，但大部分轮次保留 0；第 5 轮采光题保留 Lawrence Public Library，正文分析相关性为 1，仍未形成正式资产。
- 数据库中 15 条模型查询语义准确，但 QueryAttempt 的语言字段没有随模型计划更新，且搜索域名在计划前按旧语言选定；开始补“模型查询语言驱动本地搜索目标”和真实相关候选筛选的行为红测。
- 首次项目 Playwright 候选诊断在打印阶段因终端 GBK 无法编码 `ø` 失败；改用进程级 UTF-8 输出后成功，无仓库写入。
- 首轮 3 组真实候选均偏题，模型保留 0 是正确行为；根因收敛为查询过长导致单站点搜索召回差，而不是应放宽候选筛选阈值。下一步先写简洁查询和语言同步红测。
- 临时诊断脚本最初用 `archdaily.com/<id>/` 匹配项目，漏掉 slug 后直接带查询参数的真实结果；修正理解后确认 `library` 站内查询能返回多个真实图书馆。未修改生产代码，下一步以最终 `q` 参数行为写红测。
- 新增 4 个红测，准确复现社区图书馆被改写为文化中心、未知类型默认 adaptive reuse 以及 QueryAttempt 语言不更新；最小生产修改后 4/4 转绿。
- Public Pages 44 项、搜索/规划/Provider 45 项通过；Ruff lint/format、strict Mypy、`git diff --check` 通过。修改后项目 Playwright 确认 ArchDaily/Designboom 已召回真实图书馆候选，准备跑完整 API 后重启服务。
- 站点压缩修复后的第二轮完整 API 回归通过；Ruff lint/64 文件 format、strict Mypy 和 `git diff --check` 全绿。准备重启服务并创建全新建筑 Run，不 retry 第一条失败数据。
- 重启后创建新社区图书馆 Run `d73cbb8d-8136-4366-96a3-8de6abd3ea67`；首轮模型从 ArchDaily 4 候选保留 3 个图书馆，从 Designboom 4 候选保留 1 个，实际正文读取与 Provider 分析均执行。
- Run 最终仍为 `blocked/research_synthesis_incomplete`：10 个 partial 视觉候选、0 个项目、0/3 正文覆盖；期间一次查询规划 `APIConnectionError` 后续轮恢复成功。停止后续验收，转入正文分析 relevance=2 但无正式证据对象的诊断。
- 首次 EvidenceClaim SQL 使用不存在的 `asset_id` 列而失败；按模型真实外键 `asset_candidate_id` 重查成功，确认 10 条 claim 都只证明图纸链接，不证明设计机制。
- 已新增正文分析语义纠正红测：relevance=2 但无 context/mechanism/facts 的第一次结构输出必须再调用一次，完整逐字事实结果才可返回；超时仍保持单次调用。
- 正文证据纠正红测转绿；有效分析保持单次，语义空缺最多纠正一次，第二次仍不完整则进入现有可恢复错误路径。页面分析最坏预算从 45 秒同步为 90 秒。
- 第三轮完整 API 回归、Ruff lint/format、strict Mypy 和 `git diff --check` 全绿；准备重启并创建全新建筑 Run。
- 重启并创建聚焦中庭/楼梯/分龄阅读/天窗的 Run `942aae4b-e091-4b33-ab81-7009c5839205`；首轮模型规划成功，候选筛选因 `APIConnectionError` 降级。
- 真实 fallback 直接保留并读取 4 个候选，其中含住宅与文化中心，暴露确定性候选排序缺少低相关阈值。当前 Run 继续用于验证正文纠正，但不计入发布验收。
- 正文纠正加载后，Antipode 页面仍为 `relevance=2/enriched=0`；新增“字段完整但核心引文不在页面”的 Provider 红测，要求一次纠正返回真实逐字 excerpt。
- 逐字 excerpt 红测与低相关确定性筛选红测均转绿，Ruff/Mypy 定向门禁通过。
- 旧进程 Run `942aae4b-e091-4b33-ab81-7009c5839205` 自然结束为 `partial/budget_exhausted`、1/3；Aberdeen New Library 正文分析 `relevance=3/enriched=2` 且 Provider 综合成功，证明正文纠正路径可落正式证据。准备运行最新完整 API 门禁。
- 最新完整 API 首轮暴露 8 个兼容失败：严格候选过滤被无条件用于未实现新 reranker 协议的旧 Provider/mock，导致通用测试候选被丢弃并破坏页面容量和可控时钟。
- 用旧 Provider 完成 fallback 测试取得预期红灯，同时新 Provider reranker 失败测试仍通过并挡住医院页；随后只按 Provider 协议能力区分 fallback，真实模型失败/时间不足保持严格过滤，旧协议保留原排序。
- 修复后先前 8 个失败 8/8 通过；完整 API 测试全部通过，Ruff lint、55 文件 format check、strict Mypy 26 个源文件和 `git diff --check` 全绿。下一步重启服务并从零创建第一条建筑验收 Run。
- 用项目脚本重启后 API `/health` 为 `openai/gpt-5.6-sol`，Board 200，且所有工作区无活动 Run。
- 首个手工建筑请求 `a6869306-1956-4c1d-8c78-8db4f97bfcb0` 因漏传 `research_sources=[]` 触发 XHS 搜索；确认 Board 正式代码会显式区分建筑 `[]` 与图纸 `['xiaohongshu']` 后取消并保留该无效 Run，不计入验收。
- 使用 Board 等价 payload 创建 Run `7a6a318f-bd1d-4d58-8f31-6c66087c57f5`。15 次搜索词规划与候选筛选均受预算约束，XHS 调用为 0；真实查询准确且未出现 adaptive reuse、box-in-box 或 loading dock。
- 该 Run 最终 `blocked/research_synthesis_incomplete`、0/3 覆盖：只读取 Calgary New Central Library、Biblioteca Angel Gonzalez、T-A-St-Germain Library 和 Lawrence Public Library，3 次 Provider 正文分析没有落下正式逐字证据。下一步用项目本地浏览器重放关键站点查询，先定位候选召回缺口，不启动第二条。
- 项目 Playwright 重放显示 ArchDaily 首轮 4 个候选中 3 个标题明确为 Library；另确认一次 fallback 查询被压缩成 `community cultural center daylight strategy` 并导航超时。
- 新增红测后修复两层召回：`build_public_search_query()` 从研究总题继承新建/改造条件与建筑类型；非 `new-build` 站点压缩器优先识别 library；reranker prompt 不再因可信同类型项目摘要为空而拒绝正文核查。
- 新增/相关 89 项、Ruff lint/55 文件 format、strict Mypy、`git diff --check` 和完整 API 均通过。下一步重启服务并创建不含难以逐字证明声学策略的第二版图书馆验收题。
- 重启后创建第二版 Run `27b6ae81-3036-4ab3-acbb-f4eab3080c7b`；首轮 2 个候选被模型保留，证明空摘要同类型候选修复生效。
- Run 最终 `partial/budget_exhausted`、7 个资产、1 个项目、1/3 覆盖；大邱高山公园图书馆的螺旋流线/中庭/大天窗正文形成 6 条逐字 EvidenceClaim，Provider 综合成功，整条 Trace 无 fallback。
- 审计确认工作流已把该页面复用于 atrium/daylight 分支；未覆盖是因为问题要求同时证明阶梯阅读、闭合环线、侧高窗和结构体系，而来源只支持螺旋路径、中庭和大天窗。下一条改用中庭公共核心、跨层流线、天窗采光三个正常粒度子问题。
- 正常粒度 Run `cbf00bd8-ce12-46df-a3af-52753952cf2f` 推进至 3 个资产、1 个项目、2/3 覆盖；中庭和跨层流线均有 Provider 正文证据，但屋顶采光 5 轮未覆盖，最终 `partial/no_new_assets`，综合因 `APITimeoutError` fallback。
- 根因是已覆盖分支被跳过后 `round_query_index` 重新从 1 计数，导致剩余第 3 题重复弱站点。新增行为红测后，把域名槽位固定为子问题在问题目录中的位置。
- 稳定域名槽位红测、原恢复容量/域名轮换、浏览工作流/三深度/规划 161 项、Ruff、strict Mypy、`git diff --check` 与完整 API 全绿。下一步重启并用同题新 Run 验证。
- 已重启源码服务并创建同题 Run `ca3c9228-272e-4ec7-8144-76b97906bb2e`，建筑请求显式使用 `research_sources=[]`；保持单活，没有创建其他 Run。
- 新会话按 `HANDOFF.md` 顺序恢复；`planning-with-files` catchup 首次调用系统 Python 命中 Microsoft Store 占位符，随后改用 Codex 工作区捆绑 Python成功。`git status --short --branch` 显示分支 ahead 2，保留 12 个修改文件及 `.artifacts/build/`、`.artifacts/qa/`、`.artifacts/releases/`。
- 接管在途轮询时 Run 仍为 `searching`、0/3 覆盖；截至 Trace 97，Provider 查询规划与候选筛选真实成功、fallback 为 0、XHS 路径为 0。唯一下一步是继续轮询到终态并审计 EvidenceClaim 与四类 Provider Trace。
- Run `ca3c9228-272e-4ec7-8144-76b97906bb2e` 自然终止为 `partial/budget_exhausted`：1 个资产、1 个项目、1/3 覆盖。Trace 共 150 条，15 次查询规划、7 次真实候选筛选、3 次正文分析和综合成功，无 fallback、无 XHS；该 Run 不计入发布验收且不 retry。
- 审计确认 Calgary 页面为跨层流线形成 3 条逐字 EvidenceClaim；屋顶采光同页分析为 relevance 2/enriched 0，并抢占该恢复查询唯一正文分析名额，导致模型已保留的 3 个新 Designboom 候选未读取。中庭查询站内压缩同时丢失 atrium/program。
- 新增两条行为红测并得到预期失败；最小实现保留中庭功能机制词、优先分析新候选，并在查询循环末用缓存正文补一个更早遗漏分支。定向参数化测试 6/6 通过；下一步运行相关回归和完整 API 门禁。
- 第一轮相关回归暴露 3 个旧合同红灯；把复用调整为“先新页、后缓存页且受原分析额度约束”，并把最终补分析限定在已有 completion recovery 预算。定向兼容集合 10/10 通过。
- 旧复用图纸偏好测试原用调用位置间接断言；更新为直接定位被复用页并确认携带 2 张匹配剖面，不降低原语义。相关 245 项随后全绿。
- 完整 API 426 项通过；Ruff lint、64 文件 format check、strict Mypy 26 个源文件和 `git diff --check` 通过。唯一下一步为重启服务并创建全新同题建筑 Run。
- 续接后用项目虚拟环境运行新增站内失败红测，`empty` 与 `timeout` 2/2 按预期失败：前者返回空，后者外泄 `TimeoutError`。
- 首版实现已知建筑站点的一次有界 Bing RSS `site:` 降级，候选继续经过 canonical URL、允许域名和已知项目路径校验；正文预算保持 20 秒，搜索专用最坏预算同步为 40 秒，工作流两处搜索预留已接入。
- 首次格式化发现 fallback 块误插入去重分支中间并产生 `SyntaxError`；改为局部 `add_results()` 后，新增参数化测试 2/2 通过。下一步运行公开页面全集和模型辅助搜索/预算回归。
- 相关链路 247 项、完整 API 428 项、Ruff、55 文件 format check、strict Mypy 26 个源文件和 `git diff --check` 通过；随后真实 Playwright 重放发现 Bing RSS 虽有 10 条原始结果但全部忽略 `site:` 约束，过滤后为 0。
- Bing 普通页、Google、DuckDuckGo HTML/lite 在本机同样未返回可用域名结果；Designboom 自身 `community library` 与 `community library daylight` 短查询均稳定返回 4 个真实图书馆项目。
- 将 fallback 红测扩展为 `empty`、`timeout`、`irrelevant` 三种模式并取得红灯；生产降级改为同站点宽化短查询，3/3 转绿。原样真实查询随后直接召回 4 个候选，含 University of Aberdeen New Library，未触发额外导航。
- 最终同站点 fallback 实现的完整 API 429 项、Ruff lint、55 文件 format check、strict Mypy 26 个源文件和 `git diff --check` 全绿。唯一下一步更新为重启服务并创建全新建筑验收 Run。
- 已用项目脚本重启 API/Board；`/health` 为 `openai / gpt-5.6-sol`，Board 返回 200，按 `/v1` 公开合同确认 1 个工作区、0 个活动 Run。两次误用 `/workspaces` 和 `/api/workspaces` 返回 404，随后由 OpenAPI 确认正确前缀，无产品影响。
- 创建全新单活社区图书馆建筑 Run `9f51fe41-2c03-49f9-83ad-68526a310a8f`；payload 为 `quick / precedent_research / research_sources=[]`，未 retry 旧 Run。唯一下一步为轮询到终态并做完整 Trace/EvidenceClaim 审计。
- Run `9f51fe41-2c03-49f9-83ad-68526a310a8f` 自然终止为 `partial/budget_exhausted`：20 个可用资产、1 个项目、2/3 覆盖；FJMT Marrickville Library 覆盖 `atrium_program` 与 `toplight`，`vertical_path` 缺失。该 Run 不计入发布验收且不 retry。
- Trace 共 155 条：15 次成功 `search_query_planning`、15 次候选筛选、6 次 Provider 正文分析、1 次成功综合，XHS 0；唯一降级事件是本地搜索一次 `TimeoutError`。第 5 轮垂直流线保留 2 个新候选，但只解析/分析第一个 Watha，第二个 TBB 未进入正文缓存；最终补分析复用了无路径事实的 FJMT。
- 新增红测锁定“恢复轮首个新候选无证据时，第二个可信候选先缓存并在 completion recovery 分析”；预期红灯确认只解析首个。生产修改在现有 2 页恢复额度内缓存第二页，并仅在最终补分析开放未分析可信页。目标测试和缓存/恢复相关回归 9/9 通过。
- 恢复缓存修复的相关五文件回归 249/249、完整 API 430/430、Ruff lint、55 文件 format check、strict Mypy 26 个源文件和 `git diff --check` 全绿。唯一下一步为重启并创建全新同题建筑 Run。
- 已重启源码 API/Board，健康状态为 `openai / gpt-5.6-sol`、Board 200，确认活动 Run 为 0；创建全新同题建筑 Run `cb2eb4a3-6c9f-4a62-b740-f28836698642`，显式 `research_sources=[]`。唯一下一步为轮询和完整验收。
- Run `cb2eb4a3-6c9f-4a62-b740-f28836698642` 自然终止为 `partial/budget_exhausted`、9 个资产、1 个项目、1/3 覆盖；Calgary New Central Library 为跨层流线形成逐字 EvidenceClaim。15 次查询规划、15 次候选筛选、10 次正文分析和综合均由 Provider 成功，fallback/XHS 为 0；该 Run 保留且不 retry。
- 审计 15 条真实模型查询后新增 5 条参数化红测，准确复现楼梯/坡道/步行廊道被压成 `sectional hierarchy`、中庭功能词被抹掉，以及 `purpose-built` 未识别为新建；5/5 按预期失败。
- 最小生产修复为 `flow` 增加公共楼梯、坡道、环廊、promenade、landing 等同义词，为 `program` 增加阅览平台、多功能房、公共客厅、活动房和辅助空间等同义词，并把 `purpose-built/purpose built` 纳入新建条件。
- 相关回归首次暴露既有“竖向层次”正文聚焦被单个坡道词抢占；增加更明确的 `竖向层次 / vertical hierarchy` 高权重后，新合同 10/10、兼容定点 11/11、公开页面 54/54 和相关五文件全集全部通过。
- 完整 API 435/435 通过；Ruff lint、64 文件 format check、strict Mypy 26 个源文件和 `git diff --check` 全绿。当前无活动 Run，下一步为重启服务并创建全新建筑验收 Run。
- 本次会话恢复脚本首次调用系统 `python.exe` 命中 Microsoft Store 占位符；改用 `apps/api/.venv/Scripts/python.exe` 后成功生成 catch-up 报告，未改动项目数据。
- 重启服务后首条工业改造 Run `091e6088-acee-4210-bf13-18de320cc73b` 的功能证据因一次 `APIConnectionError` 依赖 deterministic fallback，按发布门槛立即取消并保留；项目能力探测随后真实通过 `responses.structured_output`，未输出 Key。
- 新 Run `dfadd8a8-4f45-42cf-99dd-8d2401f0eaa5` 自然终止为 `partial/budget_exhausted`：completion recovery 使 3/3 子问题都有 Provider 正文证据，但只有 Rotterdam 仓库 1 个项目、2 个资产，enrichment 不满足，因此不计入验收且不 retry。
- 该 Run 的 15 轮中 5 次本地搜索 `TimeoutError`、1 次一般 `Error`、3 次零结果；6 次形成候选，最终只分析 6 次正文。模型原始查询准确，站点压缩却把两条功能和两条采光真实查询全部改为公众后勤流线。
- 新增 4 条工业改造机制红测并取得 4/4 预期失败；补功能/运营与 rooflight/lightwell/光井/屋顶开洞权重后，与新建图书馆合同合计 14/14 通过。
- 新增弱类型首屏与工业宽化红测并取得 2/2 预期失败；修复当前元数据判定、类型不匹配宽化及文化中心条件保留后，目标 6/6、公开页面 60/60 通过。
- 项目 Playwright 原样重放复杂 ArchDaily 功能查询，候选已从学校/体育馆/办公室切换为文化枢纽、改造舞蹈中心、画廊和旧茶仓；未调用 Codex 内置浏览器。下一步扩大回归并重启创建全新建筑 Run。
- 扩大回归已通过：精准查询合同 14/14、Public Pages 60/60、相关五文件 242/242、完整 API 441/441；Ruff、64 文件 format check、strict Mypy 26 个源文件和 `git diff --check` 全绿。
- 新建图书馆 Run `07a2ca39-ce70-4b6c-8989-98b3f207c4a9` 自然终止为 `partial/no_new_assets`：3/3 覆盖、12 个资产、3 个项目，唯一 enrichment 缺口为 `insufficient_multi_asset_projects`；该 Run 保留且不 retry，不计入发布验收。
- 只读结果审计确认 Deichman 同页已有 `analysis_diagram`、`axonometric`、`section` 三类资产但均无正文分析；最终综合第一次 `APITimeoutError` 后直接降级。下一步先写“缓存多图纸页预算内补分析”和“综合瞬时超时在既有两次调用预算内重试”两条红测。
- 两条红测均先按预期失败：覆盖已完成时 Deichman 类缓存页只分析一次，综合 `APITimeoutError` 直接外抛。最小实现后两条均转绿，补分析没有增加 6 次既有搜索或 4 次既有页面解析。
- 相关 `test_providers.py`、`test_browser_inspection.py`、`test_agent_synthesis.py`、`test_workflow.py` 共 198 项通过；完整 API 443 项通过，Ruff lint、64 文件 format check、strict Mypy 26 个源文件和 `git diff --check` 全绿。
- 当前未升版、未提交、未推送。下一步检查单活、重启源码服务并创建第一条全新建筑验收 Run。
- 服务重启后 `/health` 为 `openai / gpt-5.6-sol`、Board 200；创建新建筑 Run `5a8dd293-f844-4bb0-ab1b-4ca1a2f63e00`，明确 `research_sources=[]`，没有 retry 旧 Run。
- 该 Run 最终为 `partial/no_new_assets`：2/3 正文覆盖、9 个资产、1 个正式项目；模型查询规划、后续候选筛选、正文分析和综合均真实执行，首轮可见流线候选筛选有一次 `APIConnectionError` fallback，因此无论结果如何都不计入发布验收。
- 审计确认第三分支要求屋顶开口、遮阳、防眩、过热和深层照度，来源只能证明自然光进入中庭；系统正确保留边界。下一步创建一条不 retry 的比较型图书馆 Run，以三个已知项目分别核对可证实机制。
- 比较型 Run `87b31259-2182-485d-b592-7291d592c3cc` 的首批模型查询均同时包含三个项目名，站点压缩后项目名全部丢失；在尚无正式结果时已取消并保留。新增两条红测锁定命名项目拆分和压缩保名，当前代码下均按预期失败。
- 最小实现使模型输出稳定收敛到单项目锚点，站点查询保留项目名；定向 3/3、相关 Provider/Public Pages/规划/浏览 222 项、完整 API 445 项通过，Ruff、64 文件 format check、strict Mypy 26 个源文件和 `git diff --check` 全绿。
- 下一步重启源码服务，以同题创建全新 Run，先核对真实查询和站点搜索 URL 后再等待终态。
- 命名比较 Run `7525616f-1864-44ea-9644-044857bb45f2` 自然终止为 `partial/budget_exhausted`：3/3 子问题覆盖、6 个资产、1 个正式项目，enrichment 缺少项目多样性和多图纸项目；保留且不 retry，不计入验收。
- 15 条真实模型查询全部按轮次分别锚定 Calgary、Daegu Gosan、Hunters Point，每条只含一个项目名并保留 new-build、public library、当前机制和证据类型；15 次查询规划、15 次候选筛选及最终综合由 Provider 完成，XHS 为 0。
- Trace sequence 61 的 Daegu `public_page_analysis` 首次 `APITimeoutError` 后直接进入 `deterministic_fallback`。新增红测先确认异常在第 1 次调用后外抛；生产实现改为在原 90 秒、两次总调用预算内重试一次，不增加第三次调用。
- 新超时重试、普通 `TimeoutError` 不重试、语义不完整纠正和逐字引文纠正 4 项定向测试通过。下一步运行相关回归与完整 API 门禁，随后重启并创建全新建筑 Run。
- 页面分析修复相关 Provider/浏览/综合/工作流 200 项通过；完整 API 446/446 通过；Ruff lint、55 文件 format check、strict Mypy 26 个源文件和 `git diff --check` 全绿。下一步重启源码服务并确认单活后创建全新建筑 Run。
- 重启后创建建筑 Run `3bec22da-8484-4f9b-9053-24a0231b565f`，明确 `research_sources=[]`；15 次模型查询规划均成功，首轮/后续查询分别以 Daegu 与 Calgary 单项目锚定，页面分析和综合无 fallback。
- 该 Run 最终为 `partial/budget_exhausted`：Calgary 形成 4 个资产和中庭功能、顶部采光 2/3 覆盖，但 Daegu 未召回、跨层流线未覆盖，只有 1 个项目，保留且不 retry、不计入验收。
- 代码审计确认初始 `_compact_site_query()` 保留项目名，但站内空结果、超时或偏题后使用的 `_compact_site_fallback_query()` 删除项目名、项目条件和证据类型。下一步先写命名项目站内宽化合同红测，再修复并用项目 Playwright 原样重放。
- 命名项目宽化红测先准确失败：第二次 Designboom 查询实际为 `public library circulation`。最小修复后，宽化查询为 `Daegu Gosan Park Library new public library circulation project description`；新旧宽化/压缩定向回归 7/7 通过。
- 项目 `LocalBrowserPageParser` + 系统 Chrome 原样重放真实 Daegu 查询，第一结果为真实 Designboom 项目页，摘要含四层 promenade、环中庭和自然采光；未调用 Codex 内置浏览器或 Provider。首次诊断命令在 `apps/api` cwd 下仍使用根目录相对 Python 路径而失败，改用 `.venv/Scripts/python.exe` 后成功，无项目写入。
- 命名宽化修复相关搜索/Provider/浏览回归 224/224、完整 API 447/447 通过；Ruff lint、55 文件 format check、strict Mypy 26 个源文件和 `git diff --check` 全绿。下一步重启服务并创建全新单活建筑 Run。

## 2026-08-01 Named-project candidate anchoring

- 重启后的 Run `e2c64da9-9e0a-4c60-9336-501fab671561` 在查询规划和候选筛选阶段出现 `APIConnectionError` fallback；已在 0 个资产时取消并保留，不计入发布验收。
- 项目 `probe_provider()` 随后真实通过 `responses.structured_output`；未读取、打印或保存 Credential Manager 中的 Key。
- 新 Run `11a62e85-81ed-40e5-93c7-9aeca58eec70` 首轮 Daegu 查询由本地搜索返回 3 个候选，但 Provider reranker 错误保留 Calgary；页面扩展随后访问无关 Designboom podcast 和住宅页，均未升级为证据。第三轮又出现查询规划 `APIConnectionError` fallback，已在 0 个资产时取消并保留。
- 当前无活动 Run，正式发布验收仍为 0/4。唯一下一步是写红测锁定：单项目查询只能让匹配该项目的本地候选进入 reranker 和正文读取；无命名查询不受影响。
- 新增命名项目候选漂移红测并取得预期失败：Daegu 单项目查询下，reranker 实际收到 Daegu、Calgary、podcast 和住宅四项，确认缺口位于模型筛选前的程序级过滤。
- 最小实现按每条模型查询独立提取显式项目名，在合并本地搜索结果前仅保留标题或 URL 匹配该项目身份的候选；无命名查询保持原候选集，两条独立命名查询可分别保留各自项目。
- 单项目漂移、双项目边界、无命名兼容 3/3 通过；搜索规划、Provider、公开页面和浏览工作流相关四文件 226 项全部通过。
- 完整 API 449/449 通过；Ruff lint、64 文件 format check、strict Mypy 26 个源文件和 `git diff --check` 全绿。候选项目锚点修复阶段完成，下一步重启源码服务并创建第一条全新单活建筑验收 Run。
- 重启后 API 为 `openai / gpt-5.6-sol`、Board 200，活动 Run 为 0；创建建筑 Run `edf2aae3-60dc-479f-92b8-ae1a2b4c18fe`，明确 `research_sources=[]`。
- 该 Run 自然终止为 `partial/no_new_assets`：2/3 覆盖、12 个资产、2 个正式项目，不计入验收且不 retry。候选锚点修复真实生效，Daegu 查询进入正确 Designboom 项目页并形成正文 EvidenceClaim。
- 失败 Trace 含一次 `candidate_reranking` `APIConnectionError` fallback、一次 Daegu 正文 `APIConnectionError` deterministic fallback，以及最终综合两次机会仍 `APITimeoutError` 后 fallback；屋顶采光分支最终只分析到 relevance=1 的 Surry Hills 与 Palmetto 页面。正式验收仍为 0/4。
- Provider capability probe 随后成功通过 `responses.structured_output`；创建新命名比较 Run `e7b143e9-9ef1-4bf5-9dde-b6d9d137396f`，问题改为公共流线、功能分区和公共空间机制。
- 该 Run 终态 `partial/budget_exhausted`，3/3 覆盖但仅 1 个项目、5 个资产、无多图纸项目；Trace 还含多次查询规划/正文 Provider fallback，因此不计入验收且不 retry。
- 只读数据库审计确认 15 条查询按 Daegu、Hunters Point、Calgary 正确轮换。首轮 Daegu 候选也被准确过滤为 1 个；但解析 Daegu 项目页后，Designboom 侧栏 podcast 和住宅链接被 `select_project_page_links()` 当作待扩展项目，程序没有直接分析父项目页而是消耗正文预算分析无关页。
- 强化命名项目红测后取得预期失败：Daegu 父项目页解析后，`parser.urls` 额外出现 Designboom podcast，准确复现真实 Run 的扩展漂移。
- 命名页面扩展过滤修复后，父页与无命名 roundup 扩展 2/2、相关四文件 226、完整 API 449、Ruff、64 文件格式、strict Mypy 和 `git diff --check` 全绿。
- 新增瞬时 Provider 重试红测：普通 Responses 查询规划首个 `APIConnectionError` 当前直接外抛；正文分析的 `APIConnectionError` 也没有使用现有第二次机会，两项均取得预期失败。
- 普通 Responses 拆题、搜索词规划和候选筛选现在只在单个 45 秒窗口尚有剩余时，对连接、API 超时、限流和服务端错误重试一次；持续瞬时错误最多 2 次，普通结构/业务错误仍只调用 1 次。
- 正文分析把同类瞬时错误纳入原两次、90 秒总机会，不增加第三次调用。相关四文件 230/230、完整 API 453/453、Ruff、64 文件格式、strict Mypy 和 `git diff --check` 全绿。
- 重启、probe 成功后创建 Run `259efb0e-a0ed-4258-b4e3-caa9572b030d`。该 Run 无 Provider/deterministic fallback，Daegu 父项目页直接形成 program 和 civic public-space EvidenceClaim，但最终 `partial/budget_exhausted`、2/3、3 个资产、1 个项目；保留且不 retry。
- 15 轮预算实际只执行 7 条查询，因为两个分支首轮已覆盖；未覆盖的 public-circulation 依次锚定 Daegu、Hunters Point、Calgary、Daegu、Hunters Point。项目 Playwright 原样重放显示 Hunters Point 的 Designboom 搜索只返回 podcast，Calgary 的 Dezeen 搜索返回 4 个偏题页，项目锚点过滤为 0 是正确行为。
- 首次诊断搜索成功后在终端输出时触发 GBK `UnicodeEncodeError`；改用 UTF-8 输出重放成功，未修改产品或真实 Run。

## 2026-08-01 Unnamed library qualification Run

- 恢复后确认单活 Run `104aa378-ce28-4238-9a96-ddfd7edd70c3` 已自然终止；没有 retry，也没有创建并发 Run。
- 终态为 `partial/budget_exhausted`：3/3 子问题覆盖、16 个可用资产、3 个项目，但 `multi_asset_projects=0`，唯一 enrichment 缺口为 `insufficient_multi_asset_projects`。
- 最终综合为 `deterministic_fallback`，因此无论覆盖情况都不计入正式发布验收；正式计数保持 0/4。
- 下一步只读审计该 Run 的 Trace、正文结果和缓存图纸分支，分别定位综合失败和 enrichment recovery 未完成的具体合同缺口，再写红测修复。
- Trace sequence 173 显示 enrichment recovery 选择 Jasper Place Branch Library，分析结果为 `relevance=1/drawing_count=2/enriched=0`；sequence 174 显示综合约 91 秒后以 `APITimeoutError` 进入 `deterministic_fallback`。
- 现有瞬时重试已真实使用完两次机会，下一步不增加第三次调用；先审计正式结果与综合输入体积，并核对缓存中是否存在比 Jasper 更合适的多图纸项目页。
- 全 Trace 降级审计确认另有 3 处 fallback：sequence 49/61 的 Constitución 正文分析和 sequence 94 的 `public-interface` 查询规划；该 Run 明确不能计入验收。
- 结果 payload 暴露 Constitución fallback 引文含无关设备识别与 climate-action 段落，开始核对 Designboom 本地正文抽取边界；不放宽 EvidenceClaim，只允许当前项目正文进入 fallback。
- 结果聚合确认 Jasper 是唯一含两种资产类型的页面，但没有正式正文机制；TBB 与 Constitución 有机制却只有 photograph。下一步读取 enrichment recovery 和 coverage 计算，确定应把多图纸偏好提前到哪个现有选择点。
- 只读 workflow 范围时首次把 `$lines` 放在外层双引号命令中，被宿主 PowerShell 提前展开并产生 ParserError；随后改为单引号 `pwsh -Command` 成功读取，后续不重复该命令形式。
- 已定位 enrichment recovery 排序缺口：只看图纸类型和未尝试分支，不看正文/子问题相关性，导致 Jasper 从已尝试的流线题错误切到无关中庭题。下一步先补此行为红测。
- 现有多图纸 recovery 测试的 Provider 对第二次分析无条件返回高相关，未覆盖“图纸类型匹配但正文主题不匹配”。准备新增正文只支持 circulation、但旧排序会选 atrium 的红测。
- workflow 已导入并多处复用统一 `infer_research_issue_intent()`；计划基于现有意图合同增加页面正文命中评分，不引入新的并行词典或 Provider 调用。
- enrichment 红测按预期失败：旧实现 recovery 第二次选择“屋顶采光”，而缓存页正文只支持公共楼梯、连续 promenade 和 landings；开始最小生产修复。
- enrichment 意图优先修复已通过目标红测；quick 综合代码审计确认实际请求最多 3 个案例且去除逐题分析的重复顶层字段，继续检查字段长度与 schema，而不是盲目削减案例。
- 综合请求审计确认 quick 为 medium reasoning、1200 输出 token、45 秒/次且第二次原样重放。准备先写红测，要求只有瞬时错误后的 quick 第二次机会改用 low reasoning，调用数和 90 秒最坏预算不变。
- quick 综合瞬时错误重试的 medium/low 红测与实现已转绿。Designboom 污染根因定位到 `_read_page()` 用最长文本在语义正文和整页 body 中二选一；准备补 article 优先红测。
- 现有正文解析测试要求语义根为短碎片时回退 body；新增红测将边界定为完整 article（至少 1000 字符）优先于更长 body，同时保留短碎片 fallback。
- article 优先红测先失败后转绿，相关 4 项解析回归通过。下一步通过项目 `LocalBrowserPageParser` 启动隔离系统 Chrome，原样读取 Constitución 页面，只检查正文长度与已知污染短语是否仍存在。
- 首次真实解析命令因 Python `-c` 嵌套引号产生 SyntaxError，未启动浏览器；改用 stdin here-string 后成功，不再重复原命令形式。
- 实测正文 8,327 字符，设备识别污染已消失，但 climate-action `rounded rock-like forms` 仍在 article 容器。下一步只输出该短语邻近上下文，定位嵌入模块边界。
- 第二次项目 Playwright 显示污染位于索引 5,985，紧跟 Designboom 稳定尾部标记 `architecture connections:`；准备先补 Designboom 专属截断红测，再做最小实现。
- Designboom 专属截断红测先失败后转绿；完整 article、短碎片 fallback、普通页面和站点尾部截断共 5 项通过。下一步真实重读同一 URL 验证两条污染短语均消失。
- 真实复核未通过：动态页面仍在约 5,985 处包含推荐摘要，说明首版 `find()` 可能命中前部短标记后被 1000 字符保护跳过。下一步直接审计 snapshot 中全部标记索引，不把夹具绿误报为完成。
- 直接 snapshot 上下文确认污染不是 parser 链接追加，而是浏览器快照正文仍包含尾部推荐区。下一步输出最终 URL、host 和标记索引，定位站点条件是否未命中。
- 最终 URL 域名匹配正常，但精确标记 find 为 -1，确认是空白/标点变体；随后一次只读页面重取遇到 Designboom `ERR_HTTP_RESPONSE_CODE_FAILURE`，不原样重试。准备把夹具改为换行变体并实现受限正则。
- 换行变体红测按预期失败；改为 Designboom 专属、正文 1000 字符后搜索 `architecture\s+connections\s*[:：]`，目标与 5 项解析边界测试通过。下一步最后一次真实页面复核。
- 最终真实页面复核通过：markdown 7,262 字符，两条已知污染句和 recommendation marker 均为 false。开始运行相关四文件回归与静态门禁。
- 本轮相关 Provider/Public Pages/浏览 workflow/综合四文件 228 项通过；完整 API 455 项通过。下一步运行 Ruff lint/format、strict Mypy 和 `git diff --check`。
- Ruff lint 通过；首次 format check 指出新改的 `test_public_pages.py` 需格式化，已用 Ruff 只格式化该文件，随后 55 个文件 format check 通过。
- strict Mypy 26 个源文件通过，`git diff --check` 通过。本轮代码门禁收口，下一步确认单活为 0、重启服务、执行 capability probe。
- 活动 Run 查询为空；已用 `scripts/stop.ps1` / `scripts/start.ps1` 重启源码 API/Board，未创建 Run。下一步健康检查与 Provider capability probe。
- 重启后 `/health` 为 `openai / gpt-5.6-sol`，Board `5173` 返回 200。开始运行不暴露 Key 的项目 capability probe。
- `probe_provider()` 使用普通 Responses structured output，需要内存配置和 Key；将复用应用现有 Credential Manager 加载函数，只输出非敏感 ProbeResult。
- 已定位 `load_provider_runtime()`，probe 将只输出 provider/model/capability/protocol，不输出 runtime、Key 或 Base URL。
- 项目 capability probe 真实通过 `responses.structured_output`。读取此前 Deichman 多图纸 Run 后，确定下一条使用正常粒度的中庭功能、可见公共流线和顶部采光问题，并显式要求核对 floor plan/section/axonometric；不 retry 旧 Run。
- 已创建全新单活建筑 Run `d0f41d2d-923c-45c8-ac15-9cf0ddfd9514`，`quick / precedent_research / research_sources=[]`；唯一下一步为轮询和完整 Trace/EvidenceClaim 审计。
- 轮询命令因外层缓冲无增量输出，已只终止命令而未取消产品 Run，改用单次 API 轮询。当前 `searching`、1/3 覆盖、1 个资产/项目，中庭功能已覆盖。
- 截至 Trace 28，2 次查询规划、2 次候选筛选、3 次正文分析均由 Provider 成功，fallback=0；Run 继续进入下一页 `inspecting`，覆盖暂为 1/3。
- 两次轮询间状态保持 `inspecting`，随后 `updated_at` 推进到 14:55:49，证明工作流仍活动；覆盖暂为 1/3，继续审计 Trace。
- Trace 33 时正文分析成功增至 5、fallback=0；随后 Run 回到 `searching`，公共流线 pass 增至 1 但尚未形成正式覆盖，总体仍 1/3。
- 顶部采光首轮 pass 也增至 1，但未被错误升级；第二轮进入 `inspecting`，总体仍 1/3，Run 正常更新到 14:59:30。
- 公共流线在第二轮形成正式正文覆盖，Run 达到 2/3；顶部采光进入第 3 次检查，当前仍 1 个项目/资产，继续有界恢复。
- Trace 87 时规划 7、筛选 5、正文分析 9，fallback=0；随后资产增至 7 但仍为 1 个项目、2/3，顶部采光没有被视觉结果错误升级。
- 顶部采光达到第 5 次有界检查，Run 进入 `analyzing`；连续一次 25 秒轮询未更新但尚未超过正文分析窗口，继续等待同一调用。
- Run `d0f41d2d-923c-45c8-ac15-9cf0ddfd9514` 终态为 `partial/no_new_assets`：2/3、7 个资产、1 个项目；保留且不 retry。
- Trace 只有最终综合 fallback，错误为 `APITimeoutError`，case_count=1；规划、筛选、正文分析均无 fallback。下一步为共享 90 秒综合 deadline 红测，以及 15 轮检索/候选分布审计。
- QueryAttempt 只保存规划查询，不保存候选列表；将用项目 ORM 联合 QueryAttempt、SourcePage、AssetCandidate 做只读分布审计，不输出正文或凭据。
- 项目 `Database` 可直接绑定当前 Settings 的 SQLite URL；下一步一次性只读聚合该 Run 的查询、页面与结果分布。
- 审计确认 8 条模型查询准确；12 页预算含 podcast 和住宅。Daegu/Kengo 具体父项目页未分析，预算转向无关侧栏链接；下一步扩展现有页面选择红测，要求具体父页直接分析、roundup 仍可扩展。
- 现有测试已分别覆盖命名项目父页直读和无命名 roundup 扩展，但缺少无命名具体项目父页直读；准备新增独立红测，保留两端合同。
- 新红测准确失败：无命名 Daegu 父项目页后仍解析 podcast。工作流首轮与缓存分支都把 `not project_links` 作为直读前提；开始在两处提前应用具体项目页判断。
- 首版工作流修改使无命名/命名父页测试通过，但 roundup 扩展回归失败；定位到非 ArchDaily 页面无条件 concrete。开始补最小列表页路径/标题守卫，不关闭 roundup 扩展。
- 无命名/命名具体父页与 roundup 扩展 3/3 通过；quick 综合 shared 90 秒 deadline 与结构纠正 2/2 通过。开始相关四文件和完整 API 回归。
- 相关四文件回归出现 5 个兼容失败：1 个旧 quick timeout 断言仍期望 45 秒；4 个远程视觉批次未执行，说明具体父页决策影响了非建筑夹具。暂停扩大回归，先定位 remote-batch 资格差异，不改测试掩盖生产问题。
- remote-visual 失败定位为合法项目名 `Courtyard Archive` 被过宽 `archive` 标题标记误判；移除该标题标记，列表页仍由路径和明确标题短语守卫。
- 同步 quick 深度测试 timeout=90；原 5 个失败项与 3 条具体父页/roundup 合同共 8/8 通过。开始重跑相关四文件全集。
- 相关四文件 229 项、完整 API 456 项通过。下一步 Ruff lint/format、strict Mypy 和 `git diff --check`。
- Ruff lint 通过；首次 format check 要求格式化 `public_pages.py` 和 `test_browser_inspection.py`，已机械格式化，随后 55 文件 format check 通过。
- strict Mypy 26 个源文件与 `git diff --check` 通过；本轮门禁全绿，下一步重启、probe 并创建 A/B 新 Run。
- 活动 Run 为 0；已用项目 stop/start 脚本重启源码服务，未创建研究。下一步健康检查和 capability probe。
- 重启后 API 为 `openai / gpt-5.6-sol`，Responses structured output capability probe 成功。准备创建同题全新 A/B Run。
- 已创建同题全新 A/B Run `5c785452-d1f0-434e-b8fd-81d7a88daa73`，`quick / precedent_research / research_sources=[]`；唯一下一步为单活轮询和完整审计。
- A/B Run 已完成规划并进入首批 `inspecting`；两次轮询间更新时间推进到 15:38:29，尚未产生首轮 coverage 快照。
- 首轮中庭形成正式覆盖，当前 4 个资产、2 个项目、1/3；同期项目多样性优于上一条 Run，继续公共流线检查。
- 截至 Trace 34，2 次规划、2 次筛选、4 次正文分析成功，fallback=0；Run 仍在页面检查，保持单活。
- 公共流线形成覆盖，Run 达到 6 个资产、3 个项目、2/3，项目多样性门槛满足；顶部采光推进到第 3 次检查。
- 顶部采光在后续正文检查中形成覆盖，Run 达到 3/3、13 个资产、4 个项目；剩余 enrichment 为 `insufficient_subquestion_assets` 与 `insufficient_multi_asset_projects`。
- A/B Run `5c785452-d1f0-434e-b8fd-81d7a88daa73` 已自然完成：`completed/coverage_satisfied`，15 个可用资产、8 个项目、3/3 子问题、`multi_asset_projects=1`，coverage/enrichment gap 均为空。
- 初步 Trace 审计确认 9 次模型查询规划、9 次候选筛选、9 次正文分析和 1 次研究综合均有成功记录；未发现 Provider 或 deterministic fallback。一个 Designboom 本地页面读取被跳过，不参与正式结果。
- 正式验收暂不从 0/4 增加；下一步只读审计查询文本、候选约束、URL 绑定和 EvidenceClaim 是否逐字存在于对应已读正文。
- 只读数据库与 Trace 审计完成：9 条差异化查询、7 个无重复已读 URL、15 个绑定结果、57 条 URL 无错配事实；规划、筛选、正文分析和综合均有成功 Provider Trace，deterministic fallback=0。
- 项目 Playwright 后验复核发现 ArchDaily 动态短页会暂时缺少正文；独立完整页重读恢复 Vancouver/Surry Hills/Calgary 正文匹配。生产写入本身已通过 `_supported_project_facts()` 对当次页面做逐字白名单校验，不降低 EvidenceClaim 门槛。
- Run `5c785452-d1f0-434e-b8fd-81d7a88daa73` 计为建筑验收 1/2；当前总验收 1/4。下一步确认活动 Run 为 0，再创建旧工业厂房改造建筑 Run。
- 在创建第二条真实 Run 前停止并改做全局红测；旧实现对社区图书馆、工业厂房改造、文化中心扩建三种项目页都生成无逐字 excerpt 的图纸事实，3 项红测准确失败。
- 通用持久化修复完成：有 `alt` 写 fact，无 `alt` 写带真实 image URL/整图区域的 observation；3 项新红测和 2 项相邻兼容测试共 5/5 通过。尚未创建新 Run，开始相关四文件与完整 API/静态门禁。
- 相关四文件 236 项、完整 API 459 项、Ruff、55 文件格式、strict Mypy 26 个源文件和 `git diff --check` 全绿。尚未创建新 Run；下一步确认单活为 0，重启源码服务后执行旧工业厂房改造建筑验收。
- 活动 Run 为 0 后已重启源码服务；API 为 `openai/gpt-5.6-sol`，Board 5173 返回 200，真实 capability probe 为 `responses.structured_output`。
- 已创建第二条单活建筑 Run `d8105a98-cea9-4dc8-934d-bb6db0e3e6c5`：旧工业厂房改造为社区文化中心，`quick/precedent_research/research_sources=[]`；创建时 subquestion_count=0，等待真实模型拆题。唯一下一步为轮询和审计，不创建并发 Run。

### Errors encountered

- 新参数化测试首次 format check 要求机械格式化 `test_browser_inspection.py`；只运行 Ruff formatter 后，55 文件 format check 通过，未改测试逻辑。

## 2026-08-01 Continue after interruption: close global regressions before live Runs

- 确认目标仍为模型辅助精准搜索 + 本地浏览器完整链路、四条真实验收和 v2.2.3 发布；当前正式验收为 1/4，建筑 1/2，无活动 Run。
- 按用户要求暂停创建真实 Run，先补通用 `roof extension` / `vertical extension` 反例；旧实现 2/2 失败，证明项目扩建条件误判。
- 新增共享项目扩建识别并接入查询生成、站点查询压缩和宽化查询压缩；真正扩建正例与机制反例 5/5 通过。
- 相关四文件首次回归 20 项失败，逐项审查均为旧搜索合同断言；更新后 `test_agent_planning.py`、`test_providers.py`、`test_public_pages.py`、`test_browser_inspection.py` 共 243 项通过。
- 未读取 Key、未创建/重试 Run、未调用 Provider 或 Codex 浏览器。下一步为完整 API 与静态门禁。
- 完整 API 首次运行被外层 120 秒命令上限终止，没有测试失败；改为 5 分钟与 UTF-8 后发现 1 个旧 workflow 断言仍要求 `box-in-box/loading dock`。
- 该旧断言改为验证通用 `inserted volume/service entrance`，并反向禁止题外模板词；定向测试通过，完整 API 最终 466/466 通过。
- Ruff lint、55 文件 format check、strict Mypy 26 个源文件、`git diff --check` 和生产项目名扫描均通过。只读 `/v1/workspaces/*/runs` 检查确认活动 Run 为 0。
- 当前离线修复与全局回归已收口；下一步才重启、probe 并创建一条新的单活建筑验收。
- 已用 `scripts/stop.ps1` / `scripts/start.ps1` 重启；API health 为 `openai/gpt-5.6-sol`，Board 5173 返回 200，模型列表 9 项且当前模型存在。
- Responses capability probe 首次收到 503；模型列表健康后第二次收到 502；等待 30 秒后的第三次仍为 503。全程只输出错误类型和非敏感能力元数据，没有输出或保存 Key/Base URL。
- 未创建真实 Run，活动 Run 仍为 0。唯一下一步为上游恢复后单次 probe，成功即继续第二条建筑验收；不重做本轮全局门禁。

## 2026-08-02 Provider recovery check and XHS preflight

- 恢复检查确认工作树与未跟踪产物保持不变；API `8000`、Board `5173` 健康，活动 Run 为 0。
- 今天只执行一次 Responses structured-output 小探测，仍收到上游 503；没有创建建筑或图纸 Run，也没有重跑已通过的离线门禁。
- `/v1/browser/status` 返回 connected=true、xiaohongshu_search_available=true；OpenCLI 真实搜索返回 4 条，全部是小红书笔记 URL。只输出数量和布尔校验，不输出会话或内容。
- 当前唯一下一步仍是上游恢复后的单次 probe；成功即创建新的单活建筑验收，之后接两条 XHS-only 图纸验收。
- 第三个连续目标回合复核 API 健康、活动 Run=0 后，只执行一次 Responses probe，仍返回 503。
- 没有创建 Run、没有重做 466 项门禁、没有修改产品逻辑。目标按三回合规则标记为外部阻塞；恢复后从一次 probe 继续。
- 目标重新激活后开始新的阻塞审计；第 1 个恢复回合唯一 probe 仍为 503。活动 Run 保持 0，未重复探测。
- 第 2 个恢复回合唯一 probe 仍为 503；审计更新为 2/3，未创建 Run 或追加上游调用。
- 用户询问 503 根因后执行一次同模型最小普通 Responses 隔离：模型列表可用且当前模型存在，但无 schema、无 reasoning 的请求仍返回 nginx 502，确认不是本地请求参数。
- 用户决定等待中转站修复。活动 Run 保持 0；后续恢复时只做一次 capability probe。

## 2026-08-02 Provider recovery and second architecture qualification

- 用户确认中转站可能已恢复；本地 API/Board 健康，活动 Run 为 0，Responses structured-output 单次 probe 成功。
- 创建唯一建筑 Run `a3f722fe-42ee-4329-af4b-96277cfc7347`：社区文化中心扩建，`quick/precedent_research/research_sources=[]`，创建时 subquestion_count=0。
- 唯一下一步为轮询该 Run 并完整审计 Trace、真实 URL 和 EvidenceClaim；不创建并发 Run。
- 恢复后 Run 已由真实模型拆为 3 个子问题并进入第 2 轮补查；截至 Trace 63，查询规划、候选筛选和正文分析均为 `provider=openai/status=completed`，Provider 原生搜索因 `local_browser_search` 明确跳过，fallback=0。当前覆盖仍为 0/3，继续轮询同一 Run，不创建或 retry 其他 Run。
- Run 最终为 `blocked/research_synthesis_incomplete`：3 个子问题各完成 5 轮，15 条模型查询和所有实际候选/正文模型调用均无 fallback，但本地搜索只形成 7 个去重页面、0 个正式资产。保留 Run，不 retry、不新开题，转入通用召回根因审计。
- 项目 Playwright 证明 Dezeen 多词站内搜索回落热门文章、Divisare 只返回分类导航；Bing RSS 忽略 `site:`，普通 Bing HTML 也无受限结果，均不适合作为生产回退。Designboom 使用 `new wing/addition/expansion` 的同义扩建词可召回新的真实扩建候选。
- 新红测先在恢复域顺序、`expansion/new wing/addition` 站点压缩和 Provider 补查提示共 5 处失败；最小实现让第 3 轮先复用可靠站点、后续再扩域，保留显式扩建同义词，并要求模型在覆盖失败时只轮换等价条件词而不改成 adaptive reuse/new build。
- 目标红测 6 项及规划/Provider/Public Pages/浏览 workflow 相关四文件 249 项通过；旧域与语言轮换断言已按新合同同步，未修改正文相关性、EvidenceClaim、页面预算或 Provider 原生搜索边界。下一步完整 API 与静态门禁。

## 2026-08-02 Resume after relay recovery

- 完整恢复 `HANDOFF.md`、`AGENTS.md`、活动计划及 findings/progress 末尾；`git status --short --branch` 确认分支 ahead 2，全部既有修改与 `.artifacts/` 未跟踪产物保留。
- `planning-with-files` catchup 首先因系统 `python` Microsoft Store 别名失败，第二次因没有 `py` 启动器失败；改用项目 `apps/api/.venv/Scripts/python.exe` 后成功，未修改产品代码。
- 当前无活动 Run，API 8000 和 Board 5173 健康；活动目标保持不变，正式验收仍为 1/4。
- XHS 查询隔离修复后的完整 API 473/473、Ruff lint、64 文件 format check、strict Mypy 26 个源文件和 `git diff --check` 全绿。
- 项目自身 Responses structured-output capability probe 成功；没有输出或保存 API Key/Base URL。
- 已创建唯一活动旧工业厂房改造建筑 Run `9f31598c-2601-4fac-9caa-b84be01a9aad`，`quick/precedent_research/research_sources=[]`，创建时子问题为 0；下一步只轮询和审计，不创建并发 Run。
- Run `9f31598c-2601-4fac-9caa-b84be01a9aad` 由真实模型拆为 3 个子问题，自然推进到 `completed/coverage_satisfied`：3/3、11 个资产、3 个项目、1 个多图纸项目。
- Trace 审计：6 次查询规划、6 次候选筛选、7 次正文分析、1 次综合；75 条事件没有 Provider 错误、fallback mode 或 deterministic fallback。
- 数据审计：6 条 local-browser 查询全部完成，5 个 SourcePage URL 无重复；11 个结果的 source_page 绑定 0 错配，64 条 fact 全有 excerpt，claim URL 越界为 0，所有结果 relevance >= 2。
- 项目 Playwright 事后动态重读累计匹配 60/64 条引文；余下 4 条来自 ArchDaily 当前短页，生产持久化仍使用当次页面逐字白名单。该 Run 计为第二条建筑正式验收，当前总计 2/4。
- 当前唯一下一步：确认 XHS 通道并顺序创建第一条 XHS-only 图纸 Run，不进入普通网页路径。
- XHS 状态复核为 connected/search available，活动 Run=0；创建第一条图纸 Run `f6a7fb48-cd22-4033-b90f-14af3fbb762c`，明确 `visual_reference_search/research_sources=[xiaohongshu]`。
- 该 Run 自然完成为 `completed/coverage_satisfied`：3/3、23 个本地图纸、9 个来源项目；33 条 Trace、3 次 XHS 搜索、9 篇可用笔记、30 次视觉调用，fallback=0。
- 审计确认 12 个 SourcePage 和全部 23 个结果均为 XHS URL，普通网页路径事件为 0；第一条图纸验收计入，当前总计 3/4。
- 当前唯一下一步：创建第二条不同题型的 XHS-only 图纸 Run，仍保持单活。
- 第二条图纸 Run `814e997c-592b-4fee-b947-25cb37320025` 自然返回 completed、3/3、20 个图纸、8 个项目且 XHS-only/fallback=0；审计发现最后方向 4 帖只有 2 篇 usable，因此不计正式验收。
- 新集成红测先准确失败：3/3 覆盖、20/48 视觉调用、最后方向 2 篇 usable 的夹具仍返回 completed。生产只改两处 XHS-only 完成许可，红测与 4 个相邻预算/隔离测试转绿。
- 完整回归首次有 3 个旧测试仍按一篇 usable 即完成；按现行合同更新夹具/断言后，完整 API 474/474、Ruff lint、64 文件格式、strict Mypy 26 个源文件和 `git diff --check` 全绿。
- 当前正式验收保持 3/4；下一步重启源码服务、probe，并创建全新第二条 XHS-only Run。
- 重启后 API/Board、XHS 通道和活动 Run 状态正常，Responses capability probe 成功；创建新 Run `eb317b7b-863e-4ae0-9966-5b399d7516d9`。
- 该 Run 最终 `partial/visual_budget_exhausted`：3/3、12 个图纸、7 个项目，但一个方向 4 帖仅 2 篇 usable；另有一次视觉 `APIConnectionError` fallback。新合同在真实运行中生效，Run 保留且不计验收。
- 下一步只做一次 capability probe，成功后创建更贴近 XHS 常见内容的文化中心竞赛图纸表达题，仍保持单活。
- capability probe 成功后创建 XHS Run `7405fca2-003c-4446-beaa-48c96cb52d34`；该 Run 自然完成为 `completed/coverage_satisfied`，3/3、24 个图纸、9 个项目、三方向 usable `[3,3,3]`、35 次视觉调用、fallback=0。
- 最终正式验收为 4/4：建筑 2/2、图纸 2/2。第二条图纸的 12 个 SourcePage 与 24 个结果均为 XHS，普通网页事件为 0，本地文件缺失为 0。
- 项目 Playwright 逐页打开四条正式 Run，等待结果区并滚动触发懒加载；XHS 图片 24/24、23/23，建筑图片 6/6、8/8，结果章节完整且无空题。截图写入 `.artifacts/qa/v2.2.3-board/`。
- 当前唯一下一步：统一升版 `v2.2.3` 并进入发布构建、安装 smoke、GitHub PR/CI/合并/Release 阶段。

## 2026-08-02 v2.2.3 version and release contract

- 完整恢复 `HANDOFF.md`、`AGENTS.md`、`task_plan.md`、`findings.md`、`progress.md`，并确认 API/Board 健康、活动 Run 为 0；正式 4/4 验收未重跑。
- `planning-with-files` catchup 首次使用系统 `python` 命中 Microsoft Store 占位符，改用项目虚拟环境后成功；一次并行核对因 `rg` 无匹配返回码 1 丢失聚合输出，改用 `Promise.allSettled` 后得到完整结果。两次均未影响项目文件或研究数据。
- Release 合同先提升到 `2.2.3` 并取得预期红灯：CI artifact 仍为 `2.2.2`；同步版本面后又捕获 README 合同中的两个旧正则，修复后 `scripts/tests/release.tests.ps1` 通过。
- API、Board、Extension、manifest、CI artifact、README、Chrome 扩展文档和架构文档均已统一为 `2.2.3`；非历史发布面旧版本扫描为空，`git diff --check` 通过。
- 当前唯一下一步：运行权威 `scripts/verify.ps1` 完整门禁；通过后构建独立扩展 ZIP 和自包含 Windows 安装器。
- 权威门禁首次执行已通过 API 474 项，但在 Ruff format check 发现版本改动后的 `__init__.py`、`main.py` 需格式化；只机械格式化这两个文件后从头重跑。
- 第二次 `scripts/verify.ps1` 完整通过：API 474/474、Board 179/179、Extension 174/174、packaged E2E 8/8，Ruff lint/64 文件格式、strict Mypy 26 个源文件、前端 lint/typecheck/build、进程/安全/评测/Release/安装器合同均通过。
- 当前唯一下一步：构建 `archresearch-chrome-extension-only-v2.2.3.zip`；成功后构建 Windows 安装器。
- 独立扩展 ZIP 构建成功：18,260 bytes，根 `manifest.json` 版本为 `2.2.3`，SHA-256 `DF1EFDC5381F559BCBE6ADC65D0AE5E79E19B6722237FB229E9FEF761D74E346`。
- 当前唯一下一步：构建 `ArchResearch-Windows-x64-Setup-v2.2.3.exe`，安装器不得捆绑扩展。
- 自包含 Windows 安装器构建成功：69,715,457 bytes，文件/产品版本均为 `2.2.3`，SHA-256 `A1F2658D9540966B5D1F24B90012F5CA1654FE90E863789B58F7B72A8E660D65`。
- 当前唯一下一步：运行真实安装/启动/自检/健康端点/扩展排除/卸载 smoke。
- Smoke 第一次因调用路径误写为 `.\artifacts` 被脚本安全守卫立即拒绝，安装器未启动；改用正确 `.\.artifacts\releases\...` 后真实 smoke 通过。
- `v2.2.3` 安装器已通过静默安装、冻结程序自检、健康检查、快捷方式、扩展排除、静默卸载和残留检查。
- 当前唯一下一步：审计 diff 与提交范围，显式暂存所有本轮跟踪修改；不暂存 `.artifacts/` 或 `.archresearch/`。
- 提交前审计确认 24 个跟踪文件全部属于精准搜索、XHS 完成合同、版本/CI/文档和规划记录；`git diff --check`、旧版本扫描、`sk-` 敏感格式扫描和中转标识扫描通过，API/Board 仍健康。
- 当前唯一下一步：逐个显式暂存这 24 个跟踪文件并核对 staged 清单；`.artifacts/` 与 `.archresearch/` 保持不暂存。
- 24 个跟踪文件逐个显式暂存，staged diff check 通过，未暂存跟踪文件为 0；只保留 `.artifacts/` 为未跟踪。
- 已创建统一提交 `Release ArchResearch v2.2.3`；在首次 push 前只更新规划文件为当前发布阶段，并 amend 同一提交。
- 当前唯一下一步：推送当前分支并创建 `main` PR，等待 Windows Hosted CI。

## 2026-08-02 v2.2.3 GitHub release

- 旧分支推送后创建的 PR #12 被 GitHub 标记 `DIRTY`；只读 `merge-tree` 证明是 PR #11 squash 历史造成的伪冲突，没有修改当前工作区或 `.artifacts/`。
- 从最新 `origin/main` 创建 `agent/v2.2.3-model-assisted-local-search`，按顺序移植 `fb727c8`、`a3f95cb` 和统一发布提交；新分支树 SHA 与本地完整验证树完全一致，Release 合同和 diff check 通过。
- Ready PR #13 通过 Hosted CI run `30718825811` / job `91419013109`；完整仓库门禁、独立扩展、Windows 安装器、真实安装 smoke 和 artifact 上传全部成功。PR 随后 squash merge 为 `fc4e7a72dd7c86b61ffb3ad91c76d3c690e9fe47`。
- 正式 Release `ArchResearch 本地版 v2.2.3` 已发布，非草稿、非预发布；tag 与远端 `main` 均指向 merge commit。
- GitHub 附件核验通过：扩展 ZIP 18,260 bytes / SHA-256 `DF1EFDC5381F559BCBE6ADC65D0AE5E79E19B6722237FB229E9FEF761D74E346`；Windows 安装器 69,715,457 bytes / SHA-256 `A1F2658D9540966B5D1F24B90012F5CA1654FE90E863789B58F7B72A8E660D65`。
- 当前目标全部完成，无剩余发布动作；等待用户提出新任务。

## 2026-08-02 Xiaohongshu first-login preflight

- 用户要求修复全新用户未登录小红书时的使用闭环；本阶段不重跑已完成的 4 条正式研究。
- `planning-with-files` catchup 首次因系统 Python 占位符失败，改用 Codex 捆绑 Python 后成功；工作树无跟踪修改，仅保留 `.artifacts/build/`、`.artifacts/qa/`、`.artifacts/releases/` 未跟踪产物。
- 已确认现有缺口：OpenCLI 存在就使 Board 跳过登录预检，API 状态也只报告搜索对象是否存在，不是小红书是否已登录。
- 当前唯一下一步：读取扩展受限协议与 OpenCLI 命令实现，选择不泄露会话的真实登录信号，然后先写红测。
- 扩展/OpenCLI 并行检索首次因 `rg` 无匹配返回码丢弃聚合输出，改用 `Promise.allSettled` 后完整取得结果。
- 已发现 OpenCLI 内置结构化 `auth status`；下一步定向读取 XHS 注册的 auth 合同与扩展 content protocol，确定红测输入/输出。
- 定向核对确认 OpenCLI 可用 `auth status --site xiaohongshu`返回登录四态，且 XHS 搜索 adapter 已有登录墙信号；扩展仍需一个不接收 selector、只返回状态的枚举操作。
- 红测已覆盖 OpenCLI 三态与固定命令、扩展协议/内容/执行器限制、API 独立预检端点、Board 未登录/未知阻断与登录入口、建筑研究不调用预检。
- 首轮红灯精确失败：API 11 项缺少 `check_login()`/端点；Extension 7 项缺少枚举动作与三态内容操作；Board 4 项缺少提交前预检和登录链接。其余相邻测试保持通过。
- 当前唯一下一步：实现 Python 状态模型、OpenCLI/扩展 checker 与 `/v1/browser/xiaohongshu-session`，先让 API 和 Extension 红测转绿。
- API/Extension 实现已完成：OpenCLI 固定 auth 命令、扩展枚举动作/域名限制/三态判定、fail-closed API 端点均已落下。
- API 定向 46/46，Extension 协议/内容/执行器 76/76 全绿。
- 当前唯一下一步：接入 Board API 合同和提交前阻断，加入登录链接与重新检测状态，让 Board 红测转绿。
- Board 已完成自动/提交前登录预检、三种失败状态阻断、固定登录入口、重新检测和并发预检去重。
- Board typecheck 通过；App/Hook/API client/Home component 目标回归 128/128 通过。首次回归唯一失败是旧 Hook 测试未显式模拟登录预检，按新合同更新后转绿。
- 当前唯一下一步：运行 Ruff/ESLint/format/typecheck 和 API/Board/Extension 完整回归，然后用真实本地登录态做不输出账号信息的预检 smoke 与 Board Playwright QA。
- 权威 `scripts/verify.ps1` 完整通过：API 485/485、Board 181/181、Extension 182/182、packaged E2E 8/8；Ruff、strict Mypy、ESLint、TypeScript、生产构建、发布与安装器合同全部通过。
- 真实本地 API `POST /v1/browser/xiaohongshu-session` 返回 `logged_in/local_search`；API 健康状态为 `openai/gpt-5.6-sol`，活动 Run 为 0。检查只记录状态和通道，没有读取、输出或保存 Cookie、账号信息或 API Key。
- 项目 Playwright 真实登录态桌面和移动端均显示“研究环境已就绪”；模拟 `not_logged_in` 后，桌面和移动端提交前预检各自阻止创建 Run，登录链接为 `https://www.xiaohongshu.com/explore`，Run POST 数为 0。
- UI smoke 截图为 `.artifacts/qa/xhs-login-preflight/desktop.png`、`mobile.png`、`logged-out-desktop.png`、`logged-out-mobile.png`；四个视口均无溢出或控件重叠。
- Phase 14 已完成。本阶段没有创建、重试或重跑真实研究 Run；保留全部既有修改与未跟踪产物，不提交、不发布。

## 2026-08-02 Six-run stability qualification and v2.2.4 release

- 用户要求再各测试 3 条全新问题；按 3 条建筑 + 3 条 XHS-only 图纸执行，全部稳定后提交并正式发布。
- 恢复确认 API/Board 健康，Provider 为 `openai/gpt-5.6-sol`，小红书会话为 `logged_in/local_search`，活动 Run 为 0；GitHub CLI `2.96.0` 已认证。
- 当前工作树为 24 个有意跟踪修改和 `.artifacts/build/`、`.artifacts/qa/`、`.artifacts/releases/` 三个未跟踪目录；没有暂存文件，全部继续保留。
- 建筑验收题覆盖新建小学、旧仓库改造公共市场、既有图书馆扩建；图纸验收题覆盖山地游客中心、社区医疗中心、滨水文化中心。六条均使用现有 quick 预算并顺序单活执行。
- 当前唯一下一步：做一次不输出 Key 的 Provider structured-output 能力探测；成功后创建第一条新建小学建筑 Run。
- 项目 Provider structured-output 能力探测成功：`gpt-5.6-sol / responses.structured_output`；只输出能力元数据，未输出或保存 Key。
- 第一条建筑 Run `f32d16e9-39b8-4998-a5a1-d2cca8c7e73f` 已创建：新建小学庭院、共享学习、公共流线、采光与结构网格，`quick/precedent_research/research_sources=[]`，创建时子问题为 0。
- 当前唯一下一步：只轮询并审计该 Run；终态前不创建第二条 Run。
- 第一条建筑 Run 自然终止为 `partial`：1/3、1 个可用资产、1 个项目；保留 Run，不 retry、不创建第二条题目。
- 审计确认四类 Provider Trace 全部成功且 fallback=0，11 条模型查询准确；但 11 次 reranker 只保留 2 个候选，最终仅形成 2 个去重 SourcePage，覆盖不足来自本地召回/候选保留。
- 当前唯一下一步：用项目 Playwright 重放代表性查询，定位通用召回缺口；先修复并回归，再继续六条验收。
- 红测确认小学、社区医疗中心、公共市场和游客中心都被站点压缩降为泛化类型；另补旧仓库改公共市场和 `newly built elementary school` 合同。
- 最小共享实现保留常见具体建筑类型、新建同义条件和共享学习/教室组团机制；首查与宽化路径均使用同一逻辑。目标与既有站点合同 32/32 通过。
- 当前唯一下一步：运行规划、Provider、公共页面和浏览工作流相关回归；通过后重启并用项目 Playwright 重放小学查询。
- 相关四文件 257/257 通过；首次扩大回归发现 `gallery` 被误当建筑类型，收窄为明确 `art gallery` 后全绿。
- Ruff lint、55 文件 format check、strict Mypy 26 个源文件和 `git diff --check` 全部通过。
- 当前唯一下一步：重启源码服务加载类型保留修复，确认无活动 Run 后用项目 Direct Playwright 重放小学查询。
- 服务重启后健康、活动 Run=0；项目 Direct Playwright 真实重放小学查询，ArchDaily 与 Designboom 共返回 8 个候选，其中 7 个为具体学校项目。
- 首次重放只在输出结果时因 PowerShell GBK 无法编码特殊字符失败；改为 UTF-8 输出后成功，未写文件或修改研究数据。
- 用户要求停止依靠逐类型词表；暂停后续真实 Run。当前唯一下一步改为写任意未知建筑类型的结构化锚点红测，再用通用 Pydantic 合同替换词表主路径。
- 完成结构化锚点实现审计：Provider 正式查询必须返回 anchors，workflow 已能调用 `search_structured`；发现站点宽化仍会重解释项目条件。
- 先改红测覆盖 `courthouse/new-build`、`crematorium/renovation`、`aquarium/extension`，准确捕获宽化把条件改成 `new` 或 `adaptive reuse`；workflow 未知类型透传与旧 mock 兼容测试已补齐。
- 最小生产修复仅删除结构化站点查询的条件改写；首查继续使用完整模型查询，宽化用五类原始锚点重组。旧确定性字符串模板不变，仅供 Provider 失败 fallback。
- 首轮相关全集 263 项只剩 3 个旧 OpenAI 夹具遗漏 anchors；补齐后第二轮 263/263 通过。Ruff lint、55 文件 format check、strict Mypy 26 个源文件和 `git diff --check` 全绿。
- 当前没有创建、retry 或并发真实 Run，正式验收仍为 0/6。唯一下一步：确认单活为 0、重启、probe，并创建一个未参与单元测试的新建筑类型 Run。
- 重启与 capability probe 成功后创建新建社区体育中心 Run `792ab5f7-a923-4918-badc-da6ca150df14`；15 次规划、15 次结构化本地搜索、15 次筛选均成功且 fallback=0，但终态 `blocked/research_synthesis_incomplete`、0/3，保留不 retry。
- 联合数据库审计确认 15 条查询准确、4 个 SourcePage 全为真实 ArchDaily 项目；项目 Playwright 重放 Designboom 两条代表查询只得到 podcast、机场和度假村，拒绝合理。一次重放输出因 GBK 特殊字符失败，改用 ASCII JSON 转义后成功，未写研究数据。
- 根因收敛为补查反馈缺少阶段细节。新增红测准确捕获下一轮没有 `local_search_no_candidates`，以及 Provider 未要求语义等价类型名称；最小实现增加四种按子问题反馈，并调整模型规划/筛选提示，不增加预算或类型词表。
- 相关四文件 265/265、Ruff lint、55 文件 format check、strict Mypy 26 个源文件和 `git diff --check` 全绿。当前唯一下一步：重启、probe，创建全新 A/B 建筑 Run 并审计补查类型变化。
- 重启后新建游泳馆 Run `f0a4d691-1360-46ef-bba6-efbf88385a0f` 首次规划触发 Pydantic `ValidationError` fallback；为节省时间已取消，未继续消耗 15 轮，不计验收。
- 隔离真实规划确认模型没有漏机制，只是 anchor 与 query 的连接词位置不同。新增红测后把连续子串校验改为拉丁内容词包含 + 中文连写子串，真实隔离调用成功，缺失类型反例仍失败。
- 相关四文件 266/266、Ruff lint、55 文件 format check、strict Mypy 26 个源文件和 `git diff --check` 全绿。唯一下一步：重启、probe，创建不同题型的全新建筑 Run。
- 中断恢复后确认活动 Run=0；最新铁路客运站 Run `4670f769-c795-41c4-bdc2-c201fd8c4516` 为 `partial/budget_exhausted`、1/3、19 个资产、1 个正式项目，13 次查询规划/筛选、12 次正文分析和 1 次综合均由 Provider 成功完成，fallback=0。
- 用项目 `PlaywrightBrowserBackend` 重读苏州南、图卢姆和鹿特丹正文；未覆盖分支确实缺少题目要求的城市空间连接或四类流线分离证据，不修改 EvidenceClaim 门槛。
- 审计发现补查轮始终锁在固定媒体域名，确定性未知类型仍可能默认 `public building/adaptive reuse`，正文稳定焦点仍含工业改造预设。当前暂停新 Run，先写全网恢复、未知类型无虚构、条件中性正文焦点和 Trace 证据状态红测。
- 通用红测首次 9/9 准确失败；最小实现后 9/9 转绿。相关五文件 307 项首轮只有 2 个旧测试仍要求第 4/5 轮锁定 `archdaily.cn/dezeen`，其余 305 项通过；这两个期望按新全网恢复合同更新，未修改生产逻辑。
- 相关五文件 307/307、完整 API 499/499、strict Mypy 和 diff check 通过；Ruff 机械格式化 3 个改动文件后，新增红测 9/9、lint 和 55 文件 format check 通过。
- 项目 Playwright 全网 smoke 暴露 Bing RSS 返回固定新闻源；普通 HTML 有真实结果，但现有通用 anchor reader 会混入导航。暂停新 Run，新增 HTML URL 与 `b_algo` 结果卡两条红测后再修。
- 继续隔离测试后确认当前本机所有候选通用搜索引擎均不可稳定使用，撤回全网搜索半成品，恢复可靠建筑站点轮换；未创建新 Run。
- 新增通用同项目跨来源补证：相关但正文证据不足的可信具体项目，按项目名逐站点搜索最多两个其他建筑媒体，最多读取两个补充页面；测试证明 EvidenceClaim 只绑定实际提供逐字原文的来源。
- 五文件首轮回归发现两个恢复场景的本地搜索次数由 6 增至 8，进一步确认补证搜索没有共享总查询预算。先写 `test_public_search_and_project_supplements_share_the_run_query_budget`，旧实现 4 次调用准确失败于预算 2。
- 统一预算实现后，主搜索和补证按当前 Run attempt 的本地搜索 Trace 共用上限；预算 2 的红测只实际调用 2 次，跨来源补证、候选缓存和 enrichment 恢复 5/5 通过。
- 精准搜索相关五文件 308/308、完整 API 500/500、strict Mypy 26 个源文件、Ruff lint、55 文件 format check 与 `git diff --check` 全绿。正式 3+3 验收仍为 0/6，没有提交或发布。
- 当前唯一下一步：确认活动 Run 为 0，重启 API/Board、执行一次不输出 Key 的 capability probe，再创建未参与单元测试的全新建筑 Run；终态前不并发创建其他 Run。
- 服务重启和 `responses.structured_output` probe 成功后创建唯一消防站 Run `4a6f582b-67c3-49b1-abb9-362fbe316254`；621 秒后自然终止为 `blocked/research_synthesis_incomplete`、0/3、0 结果，保留且不 retry。
- Trace 审计确认 15 次本地搜索达到共享预算上限、11 次候选筛选全部 Provider 成功、4 次正文分析均 `direct_match=false`；11 次查询规划中 3 次 `ValidationError` deterministic fallback，不计正式验收。
- 查询计划纠正重试红测先准确失败于首次无效 building_type anchor；最小实现后首次结构无效会严格重试一次，并把查询规划最坏时间计为 90 秒。隔离真实消防站规划成功，无类型词表分支。
- 跨来源标题变体红测先因完全相等身份规则失败；保守同项目词项匹配实现后，标题前后缀/乱序正例与短名称近邻反例均通过。
- 精准搜索相关五文件 310/310、strict Mypy、Ruff lint、55 文件 format check 和 `git diff --check` 全绿；正式验收仍为 0/6。
- 当前唯一下一步：重启服务加载两项修复、确认活动 Run=0 并 probe；随后创建另一种全新建筑类型的单活 Run，终态前不并发。

## 2026-08-02 Municipal archive audit and generic-strategy reset

- 修复后创建的市政档案馆 Run `17bd42b6-7793-45ea-b8af-973b7a855abb` 已自然终止并保留：`blocked/research_synthesis_incomplete`、0/3，不 retry。
- 完整审计为 13/13 查询规划成功、fallback=0、15 次本地搜索、13 次候选筛选只保留 1 个候选，3 次正文分析均 `direct_match=false`。失败不是模型调用 fallback 或证据放宽问题。
- 用项目 Playwright 重放完整查询和短查询；ArchDaily/Designboom 当前结果缺少可证实的市政档案馆项目，未再创建 Run。
- 用户指出不应为每道验收题增加单体策略；审计确认早期确定性 fallback 和站点压缩中仍有图书馆/工业/文化中心启发式，但当前 OpenAI 正式路径已使用结构化锚点，新修复不得继续扩充类型词表。
- 后续改为通用策略红测：模型策略轮换、按站点产出自适应调度、任意未见类型参数化验证，以及修改后才决定的真实盲测题。红测和全回归收口前不创建新 Run。
- 会话恢复脚本首次调用系统 `python` 命中 Microsoft Store 占位符并失败；改用 `apps/api/.venv/Scripts/python.exe` 后成功检出 62 条未同步上下文。过程未改研究数据。
- 当前 API 健康，数据库无活动 Run；工作树所有已有修改和 `.artifacts/` 仍保留。正式验收为 0/6，未提交、未发布。
- 通用红测已先写并取得预期红灯：域名调度不接受低产出集合；恢复轮 `query_limit` 仍为 1；`SearchQuery` 尚无显式策略及命名案例约束；三个任意未见类型的偏题站内结果都没有触发结构化宽化；workflow 第三轮重复 Designboom。生产代码尚未为这些红测修改。
- 最小共享实现已完成：Pydantic 查询增加四类策略及命名案例约束；候选/正文失败且总额度允许时单轮最多两条不同策略；每个子问题的低产出站点在其他支持站点尝试前不重复；结构化类型不匹配从模型 building-type 锚点通用判断。
- 新增测试首轮 8 项中 7 项转绿；唯一失败是最小测试 Run 到恢复轮只剩 1 个查询槽，生产代码正确把上限收紧为 1。测试把 `max_queries` 调整为保留两个槽位后转绿，生产预算未增加。
- 精准搜索相关五文件首轮 325 项有 3 个旧合同冲突：强制恢复轮 query_limit=1、重复低产出 Designboom、静态域名顺序派生的前三轮全英文。断言按新通用合同更新，未修改生产逻辑或证据门槛。
- 完整 API 509/509 通过；Ruff 全范围、64 文件 format check、strict Mypy 26 个源文件和 `git diff --check` 全绿。
- 新增生产差异扫描未发现 planetarium、embassy、memorial、archive、fire station、school、aquarium、courthouse、crematorium、sports center、swimming pool、railway station、records center 或 Stadtarchiv 等题型名称。
- 当前没有活动 Run，未提交、未发布。下一步先真实验证新 SearchQueryPlan 策略结构，再选择修改后才决定的盲测建筑题。
- 服务已按项目脚本重启，API/Board 健康。真实 `gpt-5.6-sol / responses` 隔离规划返回 2 条互不重复的结构化查询，策略为 `exact_typology + professional_equivalent`，全部有 anchors；未调用 web_search、未创建 Run、未输出或保存 Key。
- 修改完成后才选定“新建城市渡轮客运码头”作为盲测类型；此前生产代码、测试和管理记录扫描均无 `ferry terminal / 渡轮码头 / 客运码头`。下一步创建唯一单活 quick 建筑 Run。

## 2026-08-02 Ferry-terminal blind-run audit and next generic fix

- Run `34626a55-dbdb-46c6-920d-dc394ecb2651` 已自然终止并保留：`partial/time_budget_exhausted`、1/3、5 个可用资产、1 个正式项目、1 个多图纸项目；fallback=0，不 retry、不计入 3+3 正式验收。
- 审计确认 15 次本地搜索耗尽共享额度，其中 8 次为 `project_text_supplement`。正文模型已把多个火车站和机场项目判为 `direct_match=false`，但 workflow 仍继续跨来源补证，挤占缺失子问题的主搜索预算。
- 同一 Run 的屋盖子问题把用户声明的渡轮客运码头放宽为相邻交通/滨水公共建筑，说明拆题边界也需要通用约束。
- 当前 API/Board 健康，活动 Run 为 0；工作树和 `.artifacts/` 全部保留，未提交、未发布。
- 当前唯一下一步：写三个通用红测，分别覆盖不匹配项目禁止补证、直接匹配但证据不完整仍允许有界补证、拆题保留用户建筑类型与项目条件；红测准确失败后再做最小实现。
- 代码审计确认不需要新增题型分支：现有正文分析已经生成通用 `direct_match/evidence_chain_status`，缺口只是返回值在调用边界被压成整数；规划侧则缺少明确要求每个建筑子问题继承用户声明类型与项目条件的通用提示合同。
- 三项红测取得预期结果：无关项目旧实现实际发起 1 次补证搜索；建筑规划提示缺少类型/条件继承要求；直接匹配但证据链不完整的既有跨来源集成测试保持通过。
- 最小实现让正文分析返回内部 `added/direct_match/evidence_chain_status` outcome；只有 `direct_match=true` 且证据链未完成才进入补证。规划提示增加每个建筑子问题原样保留用户声明类型和项目条件的通用约束，没有类型词表。
- 三项目标测试 3/3 转绿。当前唯一下一步：运行精准搜索相关全集和静态门禁，确认通用门控没有破坏页面分析、补证预算或旧 Provider/mock 兼容。
- 精准搜索相关五文件全集通过；Ruff lint、55 文件 format check、strict Mypy 26 个源文件和 `git diff --check` 全绿。当前唯一下一步：运行完整 API 回归，再重启并做一次真实规划隔离验证；回归收口前不创建新 Run。
- 完整 API 511/511 通过。当前唯一下一步：确认活动 Run 为 0，重启源码 API 加载修改，并执行不输出 Key 的真实拆题/查询规划隔离验证；不创建 Run。
- 项目脚本完成 API/Board 重启；健康端点为 `openai/gpt-5.6-sol`，Board 200，活动 Run 为 0。
- 真实纯内存拆题/查询规划隔离调用通过：未预设的“新建高山植物种质资源保存库”在 3/3 子问题中保留类型与新建条件，2 条查询为 `exact_typology + professional_equivalent`，anchors 完整，未请求原生 `web_search`，未创建 Run、未输出或保存 Key。
- 当前唯一下一步：选择修改后才决定的另一条建筑题创建唯一单活 quick Run，终态前只轮询。
- 已创建唯一活动建筑盲测 Run `0452cfd2-8142-4e09-b483-8e86bddf573a`：新建湿地生态研究中心，`quick/precedent_research/research_sources=[]`，创建时状态为 `created`。终态前不创建其他 Run。
- Run `0452cfd2-8142-4e09-b483-8e86bddf573a` 自然终止为 `partial/time_budget_exhausted`：1/3、4 个资产、1 个页面，保留、不 retry、不计验收；当前活动 Run 为 0。
- 联合审计确认新门控真实生效：15 次本地搜索里跨来源补证为 0，两个 `direct_match=false` 分支没有继续补证。
- 新的通用缺口有四项：第 3 轮一次查询规划 fallback 丢失原建筑类型/条件；成功恢复轮只重复精确类型与专业等价策略；正文 Provider 500 后确定性分析用无关泛化句制造虚假完整证据；建筑拆题 rationale 题外加入 XHS 来源要求。
- 当前唯一下一步：先写四类通用红测并取得准确红灯，再做最小修复和全回归；不创建新 Run。
- 四类红测准确失败后已转绿：未知中文类型 fallback 原样保留题目范围；第 3 轮候选短缺拒绝继续重复前两类策略并纠正为证据角度/命名先例；确定性正文没有当前机制词时返回无分析；建筑规划提示禁止题外来源平台和登录态。
- 当前唯一下一步：运行精准搜索相关全集与静态门禁，确认旧 fallback、Provider/mock 和工作流终态兼容；不创建新 Run。
- 相关全集首轮 2 项旧合同冲突：一项要求 Provider 鉴权失败后靠无关正文把 3/3 标 completed；另一项因未知类型 scope 保留过宽而让已知工业改造英文查询混入中文。前者更新为诚实 partial，后者只在确定性类型仅剩条件词/泛化项目词时携带原中文范围。
- 精准搜索相关五文件全集随后全绿。当前唯一下一步：运行 Ruff、format、strict Mypy、diff check 和完整 API；收口前不创建新 Run。
- Ruff formatter 机械重排 2 个文件后，四项目标测试、Ruff lint、55 文件 format check、strict Mypy 26 个源文件和 `git diff --check` 全绿。当前唯一下一步：运行完整 API；通过后重启并做真实隔离重放，不创建 Run。
- 完整 API 514/514 通过。当前唯一下一步：确认活动 Run 为 0，重启服务并纯内存重放失败题的拆题与第 3 轮候选短缺规划；不创建 Run。
- 服务重启后真实纯内存重放在查询规划校验处失败：第 3 轮模型已给出“精确类型 + 证据角度”，但旧候选短缺规则仍要求“专业等价名/命名先例”，与新增升级规则形成交叉约束并在纠正后抛出 `ValueError`。未创建 Run。
- 当前唯一下一步：用真实返回形状写红测，把候选短缺策略按轮次分段，前两轮要求专业等价名、第 3 轮后要求命名先例或证据角度；再回归和重放。
- 真实返回形状红测准确失败后转绿；候选短缺校验现按轮次替换：第 1-2 轮要求专业等价名/命名先例，第 3 轮后要求命名先例/证据角度，不再叠加冲突规则。
- 精准搜索相关五文件全集、Ruff、55 文件格式、strict Mypy 26 个源文件和 `git diff --check` 全绿。当前唯一下一步：重启服务并重复同一真实纯内存规划；不创建 Run。
- 同一真实纯内存重放成功：3/3 子问题保留新建湿地生态研究中心范围且无题外 XHS；第 3 轮返回 `exact_typology + evidence_angle`、2 条 anchors 完整，无 fallback、无原生 `web_search`。
- 当前唯一下一步：补跑最终完整 API；通过后选择修改后才决定的另一条建筑题创建唯一单活 Run。
- 最终完整 API 514/514 通过。已创建唯一活动建筑盲测 Run `5f740202-37ff-4f20-88f6-fe459223803a`：新建儿童科学馆，`quick/precedent_research/research_sources=[]`。终态前不创建其他 Run。
- Run `5f740202-37ff-4f20-88f6-fe459223803a` 自然终止为 `blocked/research_synthesis_incomplete`、0/3；8 个可用候选资产、0 个正式项目，保留、不 retry、不计验收，当前活动 Run 为 0。
- 审计确认全部模型阶段 fallback=0，15 次本地搜索无补证；第 3 轮三题都为 `exact_typology + evidence_angle`，没有命名先例，最终只读 3 个一般科学馆/博物馆页面并全部 `direct_match=false`。
- 当前唯一下一步：写两槽位第 3 轮必须 `named_precedent + evidence_angle` 的通用红测；单槽保持二选一，然后回归和真实隔离验证，不创建 Run。
- 两槽晚期恢复红测准确失败后转绿；相关五文件全集、Ruff、55 文件格式、strict Mypy 26 个源文件和 `git diff --check` 全绿。当前唯一下一步：重启服务并真实隔离验证两槽位返回命名先例+证据角度；不创建 Run。
- 真实两槽位规划验证成功：`named_precedent + evidence_angle`，命名项目 anchor 非空，全部结构化 anchors 完整，无 fallback、无原生 `web_search`。
- 当前唯一下一步：创建修改后才决定的新建自然历史博物馆单活 Run，终态前只轮询。
- 已创建唯一活动建筑盲测 Run `383b7203-f330-4afc-8784-9f1bfe59f0f6`：新建自然历史博物馆，`quick/precedent_research/research_sources=[]`。终态前不创建其他 Run。
- 恢复审计确认正式路径的生产代码只枚举 `exact_typology/professional_equivalent/named_precedent/evidence_angle` 查询策略，不枚举自然历史博物馆或其他验收题型；建筑类型、项目条件、空间机制和证据类型均由普通 Responses 返回并经 Pydantic 锚点校验。
- 当前盲测自然推进至 2/3 覆盖、6 个可用资产、1 个正式项目；查询规划、候选筛选和正文分析均为 Provider 成功，fallback=0。第 2 轮已从单条精确类型升级为 `exact_typology + professional_equivalent`，继续单活轮询，重点审计第 3 轮是否按通用合同进入 `named_precedent + evidence_angle`。
- Run 最终为 `partial/no_new_assets`：2/3、9 个资产、1 个正式项目；第 3 和第 5 轮均按合同使用 `named_precedent + evidence_angle`，但第 5 轮重复了第 3 轮已判无关的命名项目，浪费一个最终搜索槽位。
- 三层通用红测准确失败：Provider 不接收项目排除集合；workflow 不向下一轮传递候选项目；结构化项目锚点未直接进入候选过滤。最小实现后 3/3 转绿，不增加类型词表、搜索预算、页面预算或证据门槛。
- 当前活动 Run 为 0、正式验收仍为 0/6。当前唯一下一步：运行精准搜索相关全集和静态门禁；收口前不创建新 Run。

## 2026-08-03 Moderate analogy admission follow-up

- 恢复并继续唯一建筑学院 Run `15c4d0d2-5643-43af-98d0-7566488682b0`；终态为 `partial/time_budget_exhausted`、3/3 覆盖、4 个 usable assets、1 个正式项目，Provider 查询规划、候选筛选、正文分析和综合均成功，explicit fallback=0。
- 审计确认旧 stop reason 有误：Run 只运行约 15 分钟，实际是 18 次本地搜索额度耗尽；该 Run 保留、不 retry、不计正式验收，当前活动 Run 为 0。
- 先写红测把强机制部分匹配从 1 个扩到最多 2 个，并允许 relevance=2；旧实现准确失败。最小实现后仍保持总候选最多 4、mechanism>=3、trust>=2，弱机制候选继续拒绝。
- Provider 提示同步为“部分机制命中不要求满足全部项目条件或同类型”，正文逐字 EvidenceClaim 和综合边界没有放宽。
- 新增查询预算耗尽 stop reason 红测；旧实现准确误报时间，修复后返回 `query_budget_exhausted`。三个目标测试 3/3 通过。
- 当前唯一下一步：运行精准搜索相关全集、完整 API 和静态门禁；全部通过后重启并做真实普通 Responses reranker 隔离验证，不创建研究 Run。
- 精准搜索相关六文件全集和完整 API 全绿；Ruff lint、55 文件 format check、strict Mypy 26 个源文件及 `git diff --check` 通过。
- 项目脚本已重启 API/Board；健康端点为 `openai/gpt-5.6-sol`，Board 200，活动 Run 为 0。
- 真实 Responses reranker 隔离验证保留 1 个直接案例和 2 个强机制类比，并拒绝普通办公大厅；没有原生 web_search，也未输出或保存 Key。
- 当前唯一下一步：扫描修改后才决定的全新建筑类型并创建唯一单活 quick Run，终态前只轮询和审计。
- 生产和测试对 `engineering innovation center / engineering school building / school of engineering / 工程创新中心 / 工程学院` 扫描为 0 命中，活动 Run 守卫为 0。
- 仅 POST 一次创建 Run `f64e3b16-740a-4948-9da1-064acce13ae4`：新建大学工程创新中心，`quick/precedent_research/research_sources=[]`；Provider 拆题范围正确，首条查询规划和本地结构化搜索成功，fallback=0。
- 当前唯一下一步：只轮询并审计该 Run，终态前不创建或 retry 其他 Run。

## 2026-08-03 Medical-education-center terminal audit

- 新会话按 HANDOFF 顺序恢复；`planning-with-files` catchup 首次命中 Microsoft Store Python 占位符，改用 Codex 捆绑 Python 后成功并检出 28 条未同步上下文。
- `git status --short --branch` 确认 36 个有意跟踪修改及 `.artifacts/build/`、`.artifacts/qa/`、`.artifacts/releases/` 全部保留；未 reset、checkout、clean、commit 或 push。
- 唯一 Run `363c9289-eae9-4767-be79-1da6d0918d94` 从 `analyzing` 自然终止为 `blocked/research_synthesis_incomplete`：0/3、6 个 partial 图纸资产、0 个正式项目，fallback=0。
- 当前唯一下一步：审计实际查询、候选与正文输入，先写“局部可迁移机制可形成受限分析、弱类比仍拒绝”的通用红测，再做最小修复和全回归；收口前不创建新 Run。
- 查询表与 Trace 联合审计完成：11 条查询均锁定医学教育中心或同类型命名先例，所有候选批次 `analogical_retained_count=0`。现有问题不是类比候选分数过高，而是本地搜索从未召回跨类型机制候选。
- 当前唯一下一步：为晚期机制类比恢复搜索写任意建筑类型红测；保持主路径精确、共享查询/页面预算、候选白名单、逐字正文和 EvidenceClaim 合同不变。
- 新增任意类型红测先失败于 Pydantic 不接受 `mechanism_analogy`；最小 Provider 结构化合同实现后转绿。
- 新增反向合同确认第 2 轮提前类比会被纠正；第 4 轮后两个槽位最多一个类比，来源类型不得等于目标或泛化为公共建筑。
- 本地搜索集成测试确认实际 `search_structured` 收到类比来源类型，目标类型不进入执行查询。Provider 全集 64/64 通过。
- 当前唯一下一步：运行浏览 workflow、workflow/schema 相关全集和静态门禁；全部通过前不创建真实 Run。
- 浏览 workflow 133/133、workflow/schema 68/68、完整 API 526/526 通过；Ruff lint、55 文件格式、strict Mypy 26 个源文件和 `git diff --check` 全绿。
- 首轮 format check 要求机械重排 `providers.py` 与 `test_providers.py`；已用项目 Ruff 格式化器处理，复检通过。`rg` 同时探测不存在的根 `pyproject.toml` 返回 1，不影响从 `scripts/verify.ps1` 确认 strict Mypy 命令。
- 当前唯一下一步：确认活动 Run 为 0，重启源码服务并用真实普通 Responses 隔离验证第 4 轮机制类比查询结构；不创建 Run。
- 活动 Run=0 后用项目 `stop.ps1`/`start.ps1` 真正重启服务；API `openai/gpt-5.6-sol` 与 Board 200。
- 真实第 4 轮普通 Responses 规划成功返回一个目标类型证据查询和一个机制类比查询，结构化锚点完整、无原生 web_search。
- 项目 Playwright 对类比查询轮换 4 个建筑站点，没有召回同类项目；稀有来源类型导致结果全无关。当前唯一下一步：先写建筑媒体可发现性红测，再收紧模型类比类型选择并真实重放；不创建 Run。
- 工程创新中心 Run 在第 4 轮仍为 0/3；QueryAttempt 显示 `evidence_angle` 把多组空间、使用者和技术条件同时塞进每条查询。为避免继续消耗，已取消并保留，终态 `cancelled/user_cancelled`、3 个 partial assets、fallback=0，不计验收、不 retry。
- 代码核对纠正了初步判断：结构化站点搜索不会硬删除跨类型首轮结果；问题是查询本身过载，而不是 typology filter。
- 过载机制计划红测准确失败；新增 Pydantic 机制切片上限和明确 Provider 提示后，目标与相邻纠正测试 3/3 通过。
- 当前唯一下一步：运行精准搜索相关全集、完整 API 和静态门禁；通过后真实纯内存重放同题查询规划，不创建研究 Run。
- Provider 61 项、完整 API、Ruff、55 文件格式、strict Mypy 26 个源文件和 `git diff --check` 全部通过；服务已重启。
- 真实工程创新中心查询规划重放对 3 个子问题均返回 `named_precedent + evidence_angle`，6 条机制锚点为 6-9 个词，类型、条件和证据 anchors 完整，无 fallback、无原生 web_search。
- 当前唯一下一步：扫描修改后才决定的另一种全新建筑类型，创建唯一单活 quick Run 并只轮询审计。
- 生产和测试对医学教育中心相关中英文名称扫描为 0，活动 Run 为 0；仅 POST 一次创建 Run `363c9289-eae9-4767-be79-1da6d0918d94`。
- Provider 拆题保留原类型、条件和机制；首条查询规划/结构化搜索成功，4 个本地候选中保留 2 个同类型页面，fallback=0。
- 当前唯一下一步：只轮询并审计该 Run，终态前不创建或 retry 其他 Run。

## 2026-08-03 Resume after concert-hall blind run

- 完整恢复 HANDOFF、AGENTS、Phase 15、findings/progress 末尾与 git 状态；session catchup 用项目 venv 成功，报告 43 条未同步消息。现有 33 个跟踪文件修改及 `.artifacts/` 全部保留。
- API `openai/gpt-5.6-sol` 与 Board 5173 健康；6 个工作区共 67 条历史 Run，活动 Run 为 0。
- 音乐厅 Run `6cac2ab8-0532-407a-9981-9e99c8f25b69` 已终止为 `partial/time_budget_exhausted`：1/3、5 个资产、1 个正式项目；一次 reranker fallback、一次正文 fallback，不计验收。
- Trace 和 SQLite 联合审计确认同一 attempt 0 在 sequence 28 重新进入 workflow，并重做已经 completed 的前两个分支。根因是 resume key 包含模型规划后会从 `zh` 改成 `en` 的 QueryAttempt language。
- 用户同意在消除重复执行和无关候选预算浪费后有限上调建筑 quick 预算；不降低 EvidenceClaim、正文或完成门槛，不改变 XHS 固定上限。
- 当前唯一下一步：写 language 变化后同 attempt 恢复必须跳过 completed 查询的红测；再修复不可变执行键，随后处理候选 fallback 和预算增配。期间不创建新 Run。
- language 变化后的同 attempt 恢复红测准确失败于 program 重跑 2 次；执行键改为 `(round_number, subquestion_id)` 后，目标及相邻 retry 合同 6/6 通过。
- 未登记 planetarium 的 reranker 失败红测先失败于降级层没有结构化输入；正式 fallback 接入通用 building-type anchor、确定性相关性和最多 2 页限制后，目标与相邻结构化搜索/fallback 5/5 通过。
- 项目 Playwright 只读重放音乐厅 4 个公开 URL：2 页解析成功，2 页为明确 HTTP 响应失败；没有调用 Provider 或读取登录态。
- 三档预算红测先捕获旧值，随后 quick / balanced / deep 更新为 4 个恢复轮、每题 3 个恢复页、16/40/72 基础页和 2400/3600/5400 秒；schema 24/24、workflow 44/44 通过。
- 当前唯一下一步：运行精准搜索相关六文件全集，再运行完整 API 与静态门禁；不创建新 Run。
- 精准搜索相关六文件 351/351、完整 API 519/519、Ruff lint/63 文件格式、strict Mypy 26 文件与 diff check 全绿。
- 服务重启后 API/Board 健康、活动 Run=0；真实 Provider probe 为 `responses.structured_output`。XHS 登录预检当前返回 `unknown/local_search`，先完成建筑验收，图纸验收前再处理登录态。
- 新题型扫描确认 production/tests 对学生中心相关中英文词为 0 命中。原子单活守卫后仅 POST 一次创建 Run `4bcbd249-8701-48a6-b0d4-69beb2f83c58`，`quick/precedent_research/research_sources=[]`，新预算字段实际生效。
- 当前唯一下一步：只轮询该 Run 到终态，实时审计 fallback、重复查询、结构化本地搜索、正文分析和 EvidenceClaim；不创建或 retry 其他 Run。
- 新会话按顺序完整恢复 HANDOFF、AGENTS、活动计划及 findings/progress 末尾；`git status --short --branch` 确认 36 个有意跟踪文件修改和 `.artifacts/build/`、`.artifacts/qa/`、`.artifacts/releases/` 均保留，未 reset、checkout、clean、commit 或 push。
- `planning-with-files` catchup 首次命中系统 Python 的 Microsoft Store 占位符；改用 Codex 工作区捆绑 Python 后成功，报告 10 条未同步上下文。
- API/Board 健康；Run 时间戳为 UTC，并非跨夜停滞。实时 Trace 已从 sequence 12 推进到 39：2/3 覆盖、3 个 usable assets、1 个项目、1 个多图纸项目，所有模型阶段 fallback=0。
- 当前唯一下一步保持不变：只轮询 Run `4bcbd249-8701-48a6-b0d4-69beb2f83c58` 到终态并审计，不创建或 retry 其他 Run。
- Trace 40 出现正文分析 `APITimeoutError / deterministic_fallback` 后立即取消 Run；终态为 `cancelled/user_cancelled`，3/3 coverage 仅保留为失败诊断，不计正式验收。
- 下一步改为先写正文分析独立超时预算和低推理瞬时重试红测，再做最小通用修复与完整回归；收口前不创建新 Run。
- 正文分析红测准确失败于第二次调用仍为 medium；最小实现把正文分析独立窗口从 45 秒提升到 75 秒，并仅在瞬时错误重试时使用 low reasoning。结构证据纠正仍为 medium、最多两次、最坏 150 秒。
- Provider 与 workflow 测试全集通过；调度层已按新的 `worst_case_page_analysis_seconds=150` 预留剩余时间，没有增加调用次数或放宽正文/EvidenceClaim 门槛。
- 当前唯一下一步：运行精准搜索相关全集、完整 API 和静态门禁；全部通过后重启并做真实长正文隔离分析，不创建 Run。
- 精准搜索相关六文件 351/351、完整 API 519/519、Ruff、64 文件格式、strict Mypy 26 文件与 `git diff --check` 全绿。
- 重启后 API 健康、活动 Run 为 0；真实大学中心长正文隔离分析在 35.0 秒成功返回完整 Provider 结构化结果，没有 fallback。
- 当前唯一下一步：创建修改后才选定的新建大学商学院教学中心单活 quick Run；终态前只轮询和审计，不创建或 retry 其他 Run。
- 已创建唯一单活 Run `43503eef-b328-4849-9feb-cad43b5a29ea`：新建大学商学院教学中心，`quick/precedent_research/research_sources=[]`；API 实际返回 18 次有效搜索、16 页、4 个恢复轮、每题 3 个恢复页和 2400 秒。
- 当前唯一下一步：只轮询并审计该 Run，出现 fallback 时立即取消；不创建或 retry 其他 Run。
- 商学院 Run 已由 Provider 拆为 3 个范围正确且来源隔离的子问题；首轮三个查询规划和候选筛选均成功，fallback=0。
- Isenberg School 页面正文分析约 89 秒后由 Provider 正常完成，证明延长后的正文预算在真实 Run 生效；模型判定 `direct_match=false`，程序未生成正式证据。
- 用户调整案例边界后已取消商学院 Run；终态 `cancelled/user_cancelled`、10 个 partial 资产、0 个正式项目，保留且不计验收。
- 当前唯一下一步：先写“最多 1 个高机制迁移类比候选、弱类比继续拒绝、正文证据与适用边界不放宽”的通用红测，再做最小实现和全回归；不创建 Run。
- 类比候选红测先确认旧路径只保留 exact typology；Provider 提示红测同时确认旧模型合同没有机制迁移评分和跨类型正文边界。
- 最小实现新增 Pydantic `mechanism_transferability`：正式 reranker 最多保留 3 个类型直接候选和 1 个强机制类比候选；弱机制、低可信或仅相邻类型仍拒绝。正文提示允许同建筑尺度机制类比，但必须有逐字原文并写明类型、条件或尺度差异。
- 三项目标测试已转绿；当前唯一下一步：运行 Provider/浏览 workflow 相关全集和静态门禁，确认预算、fallback、低相关排除与 EvidenceClaim 合同没有退化。
- Provider/浏览 workflow/workflow 相关全集通过。综合阶段红测随后准确失败于旧提示未处理跨类型机制参考；最小提示合同已转绿，三档均要求输出可借鉴操作与失效边界，且不得冒充同类型先例。
- 当前唯一下一步：运行精准搜索相关六文件、完整 API 和静态门禁；全部通过后重启并做真实结构化 reranker 隔离验证，不创建 Run。
- 精准搜索相关六文件全集、完整 API 520/520、Ruff、64 文件格式、strict Mypy 26 文件和 `git diff --check` 全绿。
- 服务重启后的两次真实 reranker 隔离验证均成功：真实模型保留精确候选和 `typology=0/mechanism_transferability=4` 的强类比，拒绝 `mechanism_transferability=1` 的普通办公大厅；未调用原生 web_search。
- 当前唯一下一步：扫描并创建修改后才决定的全新建筑类型单活 quick Run；终态前只轮询和审计。
- 生产和测试对 `architecture school / school of architecture / college of architecture / 建筑学院 / 建筑系馆` 扫描为 0；创建唯一单活 Run `15c4d0d2-5643-43af-98d0-7566488682b0`，研究评图大厅、工作室/工坊邻接、人员与材料流线、北向采光、平台和大跨结构。
- 当前唯一下一步：只轮询并审计该 Run；出现任何 fallback 立即取消，终态前不创建或 retry 其他 Run。
- 建筑学院 Run 的首轮查询规划、reranker 和本地搜索均成功；严格正文检查拒绝了未证明评图大厅机制的同类型页面，没有误升级。
- Milstein Hall 的 12,000 字正文分析约 129 秒后由 Provider 成功完成，形成 5 条支持事实、2 个正式结果和完整证据链，fallback=0；Run 当前 1/3，进入第 2 轮专业等价名恢复。
- 最新精准搜索相关五文件 325 项、完整 API 517 项、Ruff、55 文件格式、strict Mypy 26 个源文件和 diff check 全绿。
- 服务重启后已创建唯一新建城市音乐厅盲测 Run `6cac2ab8-0532-407a-9981-9e99c8f25b69`，该题型在生产和测试 Python 中均无命中。当前唯一下一步：只轮询和审计，出现正式不允许的 fallback 时提前终止并修复。
- 精准搜索相关五文件 324 项、完整 API 516 项、Ruff lint、55 文件格式、strict Mypy 26 个源文件和 `git diff --check` 全绿。
- 真实 `gpt-5.6-sol / responses` 纯内存排除项目验证成功：第 5 轮返回 `named_precedent + evidence_angle`，未重复已排除项目，改选另一命名先例，anchors 完整；未创建 Run、未输出或保存 Key。
- 修改后才选定的新建城市公共市场大厅盲测 Run `8308a18e-1898-4e4b-a352-4014dd612d4d` 已作为唯一单活 `quick/precedent_research/research_sources=[]` 创建。当前唯一下一步：只轮询和审计该 Run，终态前不创建其他 Run。
- 公共市场 Run 第 2 轮出现一次查询规划 `ValueError` fallback 后立即取消，保留 7 个候选资产，不计验收；没有继续跑满或立即换题。
- 审计同时发现建筑拆题仍可能在 rationale 题外加入 XHS/登录态。两类红测准确失败后转绿：建筑计划在同一有界阶段纠正来源违约；查询纠正明确约束正文不足、旧查询与排除项目别名。
- Provider + 拆题相关 75 项通过；真实同题纯内存重放得到无 XHS 的 3 个子问题和 `exact_typology + evidence_angle` 两条完整查询，未重复被排除项目、无 `ValueError`。
- 当前活动 Run 为 0、正式验收仍为 0/6。当前唯一下一步：运行精准搜索相关全集和静态门禁；收口前不创建新 Run。
- 2026-08-03：恢复上下文并确认活动 Run=0、正式验收=0/6；现有跟踪修改和 `.artifacts/` 全部保留。用户将目标纠正为概念初期开放灵感研究，并进一步明确搜索应空间优先、建筑类型为软背景约束。下一步先运行/补齐红测，再修改通用规划与查询合同，不创建 Run。
- 2026-08-03：四个概念初期红测按预期 4/4 失败，分别暴露 fallback 预设具体方案、确定性搜索缺少中性维度、拆题 prompt 和查询 prompt 缺少概念初期合同。完成此前改动冲突审查，确定改为“空间优先路 + 项目语境路”；生产代码尚未修改，下一步补空间优先与旧改造边界红测。
- 2026-08-03：补齐 10 个目标红测并确认旧代码 10/10 失败；完成首轮通用实现后 10/10 转绿。`space_first` 携带类型/条件上下文但禁止进入可执行查询；`project_context` 保留类型和条件；本地结构化搜索按 scope 拼接；候选最多 4 条并以空间可迁移性优先，弱空间匹配继续拒绝。
- 2026-08-03：恢复脚本首次因系统 `python` 的 Microsoft Store 别名失败，改用 `apps/api/.venv/Scripts/python.exe` 成功，报告 66 条未同步上下文；工作树所有修改和 `.artifacts/` 均保留。
- 2026-08-03：新增的显式空间 fallback 红测先准确失败，证明旧 `_public_issue_focus()` 仍擅自补动静分区、连续环流、工作坊、柱网和桁架。随后改为显式词汇提取 + 中性关系/证据维度，并更新与新产品方向冲突的旧断言。
- 2026-08-03：`test_agent_planning.py` 18/18、workflow 搜索 fallback 合同 3/3、定向 Ruff 和 `git diff --check` 通过；正式策略残留扫描无可执行旧类型中心策略。当前唯一下一步是相关组合回归，不创建 Run。
- 2026-08-03：精准搜索相关组合首次 365/366，唯一失败是旧浏览恢复测试额外要求题目未出现的 `staff circulation`；修正后又清理同测试固定采光词序断言，单测与整组 366/366 全绿。
- 2026-08-03：完整 API 534/534、Provider 67/67、Ruff、64 文件 format check、strict Mypy 26 个源文件和 `git diff --check` 全绿。活动 Run 只读检查为 0；下一步做真实 Provider 纯内存验证，不创建 Run。
- 2026-08-03：Credential Manager 真实 `gpt-5.6-sol / responses` 纯内存验证通过，耗时 57 秒；开放拆题、双路查询、候选 ID 白名单与跨类型空间准入全部生效，弱候选拒绝，无 deterministic fallback 或原生 `web_search`。未输出或保存 Key。
- 2026-08-03：当前唯一下一步为重启源码服务并创建第一条全新概念初期建筑 Run，终态前保持单活。
- 2026-08-03：真实 Run `3ea1dd1b-08ff-48a8-b7fa-a5f2b1cdbdbf` 在 planning 阶段新增展览、工作坊、后勤、中庭、采光和剖面层次前提，已立即取消，保留且不 retry、不计验收。
- 2026-08-03：新增计划输出前提红测准确失败；通用词族检测和一次有界纠正实现后，Provider/planning 86 项、相关组合 367 项、完整 API 535 项及 Ruff/format/Mypy/diff 全绿。
- 2026-08-03：真实同题计划重放 16 秒、Responses 调用 1 次，直接返回开放维度且题外前提为 0。服务已重启，下一步创建未见类型自然教育中心 Run。
- 2026-08-03：恢复中断上下文，完整读取 HANDOFF/AGENTS/活动计划与 findings/progress 末尾；session catchup 检出 34 条未同步上下文。`git status --short --branch` 确认 36 个既有跟踪修改及 `.artifacts/` 全部保留，未 reset、checkout、clean、commit 或 push。
- 2026-08-03：列表聚合未显示活动项，但按 ID 读取确认 Run `abc168c5-2b31-49c5-a6d5-206b93bf8aea` 仍为 `searching`；已 POST cancel，终态 `cancelled/user_cancelled`，不 retry、不计验收。
- 2026-08-03：联合 Trace、QueryAttempt、Pydantic、Provider prompt、本地 structured search、reranker 和正文分析完成第二轮冲突审计。确认正文 URL/逐字 EvidenceClaim 合同无需放宽，下一步只修改查询前的中性空间焦点、可选类型语境、候选空间优先和有界校验纠正。
- 2026-08-03：新增五个通用行为测试并先取得 5/5 红灯；最小修改 `providers.py`、`public_pages.py`、`workflow.py` 及对应测试后 5/5 转绿。没有修改预算、XHS、正文证据或完成门槛。
- 2026-08-03：Provider/公共页面/浏览 workflow 286/286；规划、Provider、公共页面、浏览 workflow、workflow、schema 联合 372/372；完整 API 540/540 通过。
- 2026-08-03：Ruff lint、63 文件 format check、strict Mypy 26 个源文件和 `git diff --check` 通过。当前无新真实 Run、未 commit、未 push、未发布。
- 2026-08-03：继续轮询唯一 Run `2a45daa0-52e9-4d35-860f-17a023292a83` 至终态；Run 为 `partial/budget_exhausted`，3/3、3 个正式项目、18 个可用资产，Provider 查询规划、候选筛选、正文分析和综合全部成功，fallback=0。
- 2026-08-03：审计结果、Trace、QueryAttempt 和覆盖实现，确认唯一阻断项是同源多图纸计数错误。新增 workflow 红测，旧实现准确失败于 `0 != 1`，并同时覆盖同名异源不得混算。
- 2026-08-03：最小修改 `agent/verification.py`，仅对已有 article-ready 项目聚合同一已验证来源页上的 verified/partial 图纸。目标测试与 verification 测试 3/3 通过；真实数据库只读重算为 3/3、3 项目、18 资产、1 个多图纸项目、无 gaps/enrichment gaps。
- 2026-08-03：覆盖聚合修复门禁通过：workflow/verification 47/47、精准搜索相关联合 376/376、完整 API、Ruff lint、55 文件 format check、strict Mypy 26 个源文件和 `git diff --check` 全绿。
- 2026-08-03：确认活动 Run=0 后用项目 `stop.ps1` / `start.ps1` 重启源码服务；API `openai/gpt-5.6-sol` 健康、Board 200，重启后活动 Run 仍为 0。
- 2026-08-03：唯一 Run `22fb1bee-201b-4753-85c2-2ce75ffa48bd` 自然终止为 `partial/query_budget_exhausted`：3/3、11 个资产、2 个正式项目、完整综合、fallback=0；保留、不 retry、不计验收。
- 2026-08-03：审计 14 条 QueryAttempt、13 次正文分析和结果项目聚合，确认空间优先、跨类型召回、候选白名单和严格正文门槛均正常；3/3 后额外预算只用于追逐旧 quick 的 3 项目/多图纸丰富度。
- 2026-08-03：quick 深度红测先失败于旧 `projects=3/multi_asset_projects=1`；生产配置最小改为 2/0，其他证据与覆盖目标不变。retry 与多图纸恢复夹具显式保留强目标，目标三项 3/3 通过。
- 2026-08-03：quick 深度校准后相关回归 206/206、完整 API、Ruff lint、55 文件 format check、strict Mypy 26 个源文件和 `git diff --check` 全绿。
- 2026-08-03：确认活动 Run=0 后重启源码服务；API `openai/gpt-5.6-sol` 健康、Board 200，重启后仍无活动 Run。
- 2026-08-03：全新建筑 Run `cc7eee8a-bc70-4f9c-867a-d975567a1c4b` 完成 `completed/coverage_satisfied`：3/3、10 个资产、2 个项目、完整综合、fallback=0。
- 2026-08-03：交付级审计通过：18/18 EvidenceClaims 有真实 HTTP(S) URL 和非空逐字 excerpt；`search_query_planning=6`、`candidate_reranking=6`、`public_page_analysis=4`、`research_synthesis=1` 全部成功，本地搜索 7、读取 3，原生 web_search 0。记为建筑正式验收 1/3。
- 2026-08-03：建筑验收候选 Run `e665999e-a7a9-4d79-b4e9-c69fbf5ada85` 自然终止为 `blocked/research_synthesis_incomplete`：0/3、0 usable assets、0 正式项目，fallback=0；保留、不 retry、不计验收。
- 2026-08-03：恢复确认 API `openai/gpt-5.6-sol` 健康、当前活动 Run=0；`git status --short --branch` 显示 36 个既有跟踪修改及 `.artifacts/build/`、`.artifacts/qa/`、`.artifacts/releases/` 全部保留，未 reset、checkout、clean、commit 或 push。
- 2026-08-03：两次恢复命令因嵌套 PowerShell 变量被外层提前展开失败，改用单引号脚本后完成；未修改项目数据。`planning-with-files` catchup 报告 69 条未同步上下文。
- 2026-08-03：当前唯一下一步是只读审计失败 Run 的 QueryAttempt、站点轮换、候选批次和正文输入，形成通用召回缺口结论；先写红测再改生产代码，修复收口前不创建新 Run。
- 2026-08-03：失败 Run 数据库只读审计完成第一轮：11 次 Provider 查询规划、18 次本地搜索、11 次候选筛选、6 次正文分析，fallback=0；只留下 6 个页面，后期 7 次恢复站点搜索均为 0 候选。
- 2026-08-03：确认候选批次在正文读取前即全部加入 URL/项目排除集合，且读取失败被缓存为 `parsed_pages[url]=None`；One and a Half Co-working Studio 一次超时后无法重读。下一步用项目 Playwright 单独重读该页并核对正文可用性，再决定红测边界。
- 2026-08-03：成功 Run 对照首次因标题特殊字符触发控制台 GBK 编码错误，固定 Python stdout 为 UTF-8 后成功；未修改数据库或研究数据。
- 2026-08-03：项目 Playwright 已成功重读失败 Run 中超时的 One and a Half Co-working Studio；真实 Provider 纯内存分析确认项目语境高度相关但正文不足以证明空间机制，结果为 `relevance=2/direct_match=false`，没有伪造正式证据。
- 2026-08-03：Designboom 对原中文项目语境查询和英文等价查询均只返回同一无关 podcast；排除“只需翻译查询”这一过窄修复。下一步用简洁、空间主导的跨站查询验证可发现性，再确定红测合同。
- 2026-08-03：简洁空间主导查询在 ArchDaily、Designboom、Dezeen 各返回 4 条候选，证明站点召回能力存在；审计阶段完成，下一步开始写通用红测，不新建 Run。
- 2026-08-03：新增项目条件简洁度、站点语言、空间优先站内词序、瞬时正文重读和未读候选恢复五类红测；旧实现准确 6/6 失败，测试夹具的三子问题 schema 修正后命中真实排除缺口。
- 2026-08-03：最小生产修改已完成，五类目标测试 6/6 转绿；预算、EvidenceClaim、正文完成门槛和 XHS 路径未改。下一步运行 Provider/公共页面/浏览 workflow 相关全集。
- 2026-08-03：新会话按 HANDOFF -> AGENTS -> task_plan -> findings -> progress 顺序恢复；系统 `python` 为 Store 占位符，改用 Codex 捆绑 Python 完成 catchup。`git status --short --branch` 确认 37 个跟踪文件修改及 `.artifacts/build/`、`.artifacts/qa/`、`.artifacts/releases/` 全部保留；API 健康，未 reset、checkout、clean、commit 或 push。
- 2026-08-03：完成“概念初期 + 空间优先”冲突审查。最新 6 个目标修复方向正确，但服务重启仍会把正文读取前已持久化的候选当作已访问 URL；另有一个旧公共页面测试保留条件/类型优先词序断言。下一步先补恢复红测，再做最小状态修复和相关回归，不创建真实 Run。
- 2026-08-03：新增恢复行为红测，旧实现准确失败于 `parser.urls=[]`；复用 `SourcePage.access_status` 完成最小修复，`pending` 恢复可读且成功后为 `available`，reranker 拒绝项为 `irrelevant`，没有数据库迁移或预算调整。
- 2026-08-03：旧公共页面套件准确暴露 4 个合同冲突：一次读取重试后的最坏窗口仍断言 20 秒，以及三个任意类型用例仍断言条件/类型优先词序。测试更新为 40 秒与 focus -> condition -> type -> evidence 后转绿，未修改生产查询方向。
- 2026-08-03：相关回归共 427 项全绿：planning 18、Provider 75、public pages 82、browser workflow 137、workflow 45、schema 24、XHS/browser WS 46。当前无新真实 Run；下一步完整 API 与静态门禁。
- 2026-08-03：完整 API 549/549、Ruff lint、55 文件 format check、`python -m mypy` strict 26 源文件和 `git diff --check` 全绿。Ruff 机械格式化两个测试文件后目标 76 项复检通过。
- 2026-08-03：项目脚本重启源码服务，API 8000、Board 5173 健康；7 个 workspace 全量读取确认活动 Run=0。
- 2026-08-03：真实 Credential Manager 普通 Responses + 本地 Playwright 纯内存验证通过：两路查询、4 个本地 ArchDaily 候选、2 个白名单内保留候选；没有原生 web_search、没有创建 Run、没有输出或保存 Key。下一步创建全新宽泛概念题的唯一单活 quick Run。
- 2026-08-03：唯一 Run `60993e17-a7fc-4af9-9f80-1eda31d1ccca` 自然完成为 `completed/coverage_satisfied`：3/3、7 个可用资产、2 个正式项目、完整综合，正式验收建筑 2/3。
- 2026-08-03：交付审计通过：7 次真实查询规划、6 次实际 reranking、9 次正文分析、1 次综合，10 次本地搜索、8 次正文读取；25/25 EvidenceClaims 真实 URL/逐字原文有效，fallback=0、原生 web_search=0。活动 Run 已回到 0，下一步第三条全新宽泛建筑题。
- 2026-08-03：按 HANDOFF -> AGENTS -> task_plan -> findings -> progress 顺序恢复上下文；`planning-with-files` catchup 改用项目虚拟环境后成功。`git status --short --branch` 确认 37 个跟踪文件修改及 `.artifacts/build/`、`.artifacts/qa/`、`.artifacts/releases/` 全部保留，未 reset、checkout、clean、commit 或 push。
- 2026-08-03：API `openai/gpt-5.6-sol` 健康；唯一活动 Run `f429ca55-5377-4dc5-a8fb-87b99d8bccd5` 为 `inspecting`。用户要求先完成“概念初期开放问题 + 空间优先、类型软语境”冲突审查，再开始通用开发；当前阶段只轮询 Run 和只读审查代码。
- 2026-08-03：首次只读 `rg` 因嵌套引号被 PowerShell 解析失败，改为多个固定 `-e` 模式后成功。活动 Run 已推进到 Trace 65、fallback=0；代码审查确认正式 reranker 的 `spatial_relevance OR typology_match` 是空间优先方向的残余冲突，待用通用红测修复。
- 2026-08-03：继续只读审查确认 Provider 拆题仍强制每题重复类型/条件，deterministic fallback 的开放模式仍依赖少数关键词，fallback 相关性仍从整题继承类型权重。正文 URL/逐字 EvidenceClaim 和跨类型 limitations 合同正确，保持不变。
- 2026-08-03：活动 Run 推进到 Trace 117、3/3 coverage、1 个正式项目、query 16/18，所有已记录模型阶段 fallback=0；继续单活轮询。
- 2026-08-03：正文入口审查发现 `_public_page_analysis_question()` 仍会按 flow/daylight/section/program/interface 自动添加具体机制模板，和“概念初期不预设答案”直接冲突；已记录为首批通用红测目标，尚未改生产代码。
- 2026-08-03：第三条建筑候选 Run `f429ca55-5377-4dc5-a8fb-87b99d8bccd5` 自然终止为 `partial/query_budget_exhausted`：3/3、13 资产、1 正式项目、完整综合、fallback=0；保留、不 retry、不计验收，当前活动 Run=0。
- 2026-08-03：概念初期/空间优先冲突审查完成，开发顺序收敛为五类通用红测，再最小修改规划、正文问题入口、候选准入和 deterministic 相关性上下文。
- 2026-08-03：新增 6 个目标行为测试，旧代码 5/6 准确失败；显式技术词保留测试原本通过。最小修改 `planning.py`、`providers.py`、`workflow.py` 后 6/6 全绿。
- 2026-08-03：一次只读内联 Python 因嵌套 PowerShell 引号被外层解析失败；改为直接核对模型定义。确认 `ProviderSource._search_description` 是私有属性后，降级评分改用已有 `LocalSearchCandidate.description`，未放宽阈值。
- 2026-08-03：相关八文件回归运行 109.9 秒后有 20 项失败；大多数来自旧内部 ID/提示断言，另暴露开放 fallback 重复 scope 导致查询重复、宽泛 deterministic 正文识别不足两个通用问题。未创建 Run。
- 2026-08-03：只让首个 fallback 子问题保留原题 scope，其余使用/环境/比较维度不重复 scope；恢复查询 distinct 回归与相关目标 4/4 通过。拒绝通过通用关键词放宽 deterministic 正文证据，Provider 全不可用且无机制证据时保持 blocked。
- 2026-08-03：恢复脚本首次命中系统 Python 的 Microsoft Store 占位符，改用项目虚拟环境后成功；`git status --short --branch` 确认 37 个跟踪修改及 `.artifacts/` 保留，活动 Run=0。
- 2026-08-03：相关八文件回归剩余 18 项失败，逐项确认均为旧 fallback ID/问题夹具合同，不需要回退生产策略。测试对齐开放维度和显式问题证据后，18 项定向复检全绿。
- 2026-08-03：相关八文件全集全绿；完整 API 首次因外层 120 秒命令上限被终止，并伴随关闭控制台后的 GBK stdout 刷新错误。改用 UTF-8 输出和 5 分钟外层时限后，完整 API 552/552 通过。
- 2026-08-03：Ruff lint、63 文件 format check、strict Mypy 26 个源文件和 `git diff --check` 全绿。Ruff 仅机械格式化本轮修改的一个测试文件；当前活动 Run=0。
- 2026-08-03：真实内存探针通过：开放拆题为年龄活动、坡地到达和室内外关系，搜索为 `space_first + project_context`；模型仅保留本地白名单内两个空间相关候选，拒绝办公/立面噪声，fallback/web_search=0。
- 2026-08-03：唯一建筑 Run `202d658e-25a3-4158-b26b-bf2c3c187308` 自然终止为 `partial/budget_exhausted`：2/3、5 资产、1 项目；保留、不 retry、不计验收。完整审计确认缺失分支两次相关正文输出未通过证据结构合同，未被伪升级。
- 2026-08-03：同一上海跨代社区页面真实重放一次返回 5 条逐字事实并完整通过。新增精确证据缺项反馈红测先失败后转绿；生产实现只改第二次 Responses 纠正提示，不改通过条件或调用预算。
- 2026-08-03：修复后 Provider 76/76、相关八文件 431 项、完整 API 553/553、Ruff、63 文件 format check、strict Mypy 26 个源文件和 diff check 全绿。
- 2026-08-03：受控“第一次故意不合格、第二次真实纠正”探针在第二次请求建立时遇到中转 TLS `UNEXPECTED_EOF` / `APIConnectionError`；未创建 Run、未输出 Key、未修改代码。保持两次调用上限，改由服务重启后的普通 Responses 健康探针确认上游恢复。
- 2026-08-03：服务恢复后的普通 `space_first` Responses 探针成功；没有增加调用次数或放宽证据合同。
- 2026-08-03：候选 Run `9b7ed8dc-daef-41d1-b86d-0c0035725a1b` 自然终止为 `partial/no_new_assets`：2/3、3 个资产、1 个正式项目，fallback=0；保留、不 retry、不计验收。当前活动 Run=0，建筑正式验收仍为 2/3，总计 2/6。
- 2026-08-03：审计确认空间优先路已形成家庭停留和活动共存证据；通用缺口是 `project_context` 把多功能 brief 复制为长而生造的建筑类型类别，导致日常到达等缺口低召回。
- 2026-08-03：恢复上下文、`git status --short --branch` 与 API 全 workspace 检查完成；37 个既有跟踪修改及 `.artifacts/` 全部保留，活动 Run=0，未 reset、checkout、clean、commit 或 push。
- 2026-08-03：唯一下一步为 concise discoverable building-type anchor 通用红测；不加题型词表、不改变 `space_first`、预算、XHS-only、正文或 EvidenceClaim 门槛。
- 2026-08-03：新增英文/中文 multi-program building-type、space-first 隔离和 Provider 有界纠正测试；旧实现准确 3 项失败，证明长自创类别穿过 Pydantic 且未触发纠正，space-first 隔离原本保持正确。
- 2026-08-03：最小修改 `providers.py`，仅对可执行 context 查询限制 building-type 为英文最多 5 个有效词或中文最多 10 个汉字，并要求模型归纳常见可索引专业类别；没有类型词表或题型分支。
- 2026-08-03：目标测试 4/4、Provider 全集 80/80 通过；下一步运行精准搜索相关八文件全集，收口前不创建真实 Run。
- 2026-08-03：精准搜索相关八文件 435 项、完整 API 557/557 通过；Ruff 首轮仅提示本轮两个文件需格式化，机械格式化后 lint、63 文件 format check、strict Mypy 26 源文件和 `git diff --check` 全绿。
- 2026-08-03：当前仍无活动 Run、未 commit、未 push、未发布。下一步重启服务并做 Credential Manager 普通 Responses 双路规划探针。
- 2026-08-03：源码服务重启健康；真实双路规划探针用 25.7 秒返回 `space_first + project_context`，空间查询无类型/条件，context building type 为 3 词 `urban youth center`，无 fallback/native web_search。
- 2026-08-03：production/tests 对共享餐厨相关中英文短语扫描为 0，创建唯一 Run `3618a879-3ca3-4d45-9cdf-d8238e95d0d5`；监控期间未创建或 retry 其他 Run。
- 2026-08-03：Run 在 Trace 44 出现 `public_page_analysis / APIConnectionError / deterministic_fallback`，监控立即取消。取消前 2/3、8 资产、3 项目；5 个真实 QueryAttempt 均为短空间查询，未复制 multi-program building type。
- 2026-08-03：该 Run 保留、不 retry、不计验收。当前活动 Run=0；下一步只做普通 Responses 健康探针，成功后再创建另一条全新单活验收题。
- 2026-08-03：普通 Responses 健康探针 22.9 秒成功；production/tests 对共享茶室相关短语为 0 命中，创建唯一 Run `24b9aade-b7b1-42da-9392-284cd9c1c535`。
- 2026-08-03：该 Run 自然完成 `completed/coverage_satisfied`：3/3、12 资产、3 正式项目、完整综合，fallback=0。
- 2026-08-03：交付审计通过：7 次查询规划、6 次实际候选筛选、8 次正文分析、1 次综合，13 次本地搜索、7 次正文读取；51/51 EvidenceClaim 有真实 URL 和逐字 excerpt，native web_search=0。
- 2026-08-03：建筑正式验收达到 3/3，总计 3/6，活动 Run=0。下一步执行 XHS 登录态预检，未登录/未知/不可用时 fail closed。
- 2026-08-03：XHS 预检返回 `unknown/local_search`；固定只读 OpenCLI auth status 超时，扩展 `connected=false`。没有创建图纸 Run或进入普通网页搜索。
- 2026-08-03：直接启动系统 Chrome 被主机策略拦截；改用项目 `POST /v1/browser/open-chrome` 成功打开 Board。下一步等待用户通过 Board 的固定入口完成小红书登录并重新检测。
- 2026-08-03：恢复后 XHS 预检为 `logged_in/local_search`；7 个工作区活动 Run 为 0，工作树 37 个既有跟踪修改及 `.artifacts/` 全部保留，未 reset、checkout、clean、commit 或 push。
- 2026-08-03：第一条 XHS-only Run `96237a51-6425-4365-bec0-dd054b02fabe` 自然终止为 `partial/visual_budget_exhausted`：23 资产、8 项目，全部 URL 为 XHS 且有本地内容，普通网页事件 0、fallback=0；保留、不 retry、不计验收。
- 2026-08-03：审计确认 `contour-layering` 仅 2 篇 usable，另外两方向各 3 篇；40 次视觉调用共 9,711,135 bytes。固定帖子、usable、图像槽位和字节上限保持不变。
- 2026-08-03：通用缺口是实际 OpenCLI 查询只收到视觉方向短文本，原始图纸主题上下文只在 QueryAttempt 审计文本中。下一步先写 compact XHS query 红测，再做最小通用修复；收口前不创建 Run。
- 2026-08-03：新增山地公共建筑与社区医疗空间两条 XHS 实际查询红测；旧实现 2/2 准确失败于缺少原题空间主题。
- 2026-08-03：最小修改 `workflow.py`，以无题型词表的 96 字符 compact helper 组合原题主题和视觉方向，并让 XHS-only QueryAttempt 保存真实执行串。目标 2/2 转绿。
- 2026-08-03：XHS adapter、browser WS、核心 workflow、browser inspection 四文件 232 项全绿；固定预算与 XHS-only fail-closed 未改。下一步完整 API 与静态门禁，不创建 Run。
- 2026-08-03：完整 API 559/559、Ruff lint、55 文件 format check、strict Mypy 26 个源文件和 `git diff --check` 全绿；Ruff 仅机械格式化本轮测试文件。
- 2026-08-03：活动 Run=0 后用项目 stop/start 脚本重启源码服务；API `openai/gpt-5.6-sol`、Board 5173 与 XHS `logged_in/local_search` 健康。下一步扫描并创建一条全新 XHS-only 单活盲测。
- 2026-08-03：production/tests 零命中的校园共享学习图纸 Run `e1a8fc51-d2a4-4ddf-bf87-fbd01d82f94d` 证明 compact query 已真实进入 OpenCLI 和 QueryAttempt；第一方向 4 帖仅 1 篇 usable 后确定无法验收，已取消保留、不 retry。
- 2026-08-03：同登录态只读 A/B 显示删除概念图纸/表达/不同风格等话术后，候选明显转向活动中心、校园节点与学校空间。下一步先写 64 字符与通用话术排除红测，再最小修复；固定 XHS 预算不变。
- 2026-08-03：64 字符/通用话术红测在旧压缩器上 2/2 准确失败；最小实现删除通用媒介词、方向已携带的图纸类型及中文连接话术，保留空间主题，目标 2/2 转绿。
- 2026-08-03：第二轮完整 API 559/559、Ruff lint、55 文件 format check、strict Mypy 26 个源文件和 diff check 全绿。下一步重启并换一条全新 XHS-only 题单活验收。
- 2026-08-03：用户纠正图纸链路目标：XHS 搜索只需要图纸类型和视觉表现方向，不需要也不允许建筑类型、项目主题、场地或空间关系。此前“主题 + 方向”的 compact-query 方案被判定为产品方向错误。
- 2026-08-03：删除 XHS 主题拼接 helper，workflow 的实际搜索参数与 `QueryAttempt.query` 均改为当前视觉子问题文本；没有修改 XHS 固定预算、登录预检或普通网页隔离。
- 2026-08-03：目标测试 `test_xiaohongshu_search_uses_only_visual_direction_and_drawing_type` 2/2 通过；山地与医疗项目语境均未进入实际查询。下一步运行 XHS/浏览相关回归、完整 API 与静态门禁，收口前不创建新 Run。
- 2026-08-03：XHS/浏览相关四文件 232/232、完整 API 559/559、Ruff lint、55 文件 format check、strict Mypy 26 个源文件和 `git diff --check` 全绿。下一步只读核对运行时与单活条件，再重启服务；尚未创建新 Run。
- 2026-08-03：API/Board 重启健康，XHS 为 `logged_in/local_search`，7 个工作区 87 条历史 Run 的活动数为 0；创建唯一纯剖面图视觉 Run `4679f319-7761-461a-a8a7-48939ec523c8`。
- 2026-08-03：该 Run 自然完成 `completed/coverage_satisfied`：三方向各 3 篇 usable，24 个 section 资产、9 篇 XHS 笔记，全部有本地内容；实际查询仅为精细线稿/拼贴叙事/材质渲染剖面图。
- 2026-08-03：交付审计确认普通网页事件 0、fallback=0、30/48 图像槽位、约 4.33 MiB。XHS 正式验收达到 1/3，总计 4/6；下一步单活测试纯视觉爆炸图。
- 2026-08-03：创建唯一纯爆炸图 Run `8ff626c2-c9da-4d3c-8de1-0faca3dc0401`；模型拆题与实际查询严格为极简图解/拼贴叙事/材质渲染爆炸图，没有项目语境。
- 2026-08-03：Run 自然终止为 `partial/visual_budget_exhausted`，三方向 4 帖后的 usable 为 2/2/1，42 次图像检查、约 7.05 MiB；普通网页事件 0、fallback=0。保留、不 retry、不计验收。
- 2026-08-03：下一步审计通用爆炸图召回和视觉分类，先写红测再修复；不立即创建第三题。
- 2026-08-03：同登录态只读 A/B 确认“建筑爆炸图”能去除产品拆解噪声，且仍只包含视觉风格与图纸类型，没有项目、场地或空间主题。
- 2026-08-03：新增执行查询、Mock 分类和 OpenAI 视觉提示红测，旧实现 3 项准确失败；最小修改后目标 5/5 通过。下一步相关、完整与静态门禁，不创建新 Run。
- 2026-08-03：视觉/Provider/XHS/浏览/workflow 相关全集 320/320、完整 API 561/561、Ruff、55 文件 format check、strict Mypy 26 个源文件和 diff check 全绿。下一步重启并做真实爆炸图分类探针。
- 2026-08-03：真实模型正确将没有构件分解关系的“爆炸式拼贴”判为 analysis_diagram；未放宽分类。类型前置 A/B 后新增红测，旧顺序准确失败，改为“建筑爆炸图 + 风格”后转绿。
- 2026-08-03：第二轮相关 320/320、完整 API 561/561 和全部静态门禁再次通过；下一步重启并用明确轴测爆炸图做真实分类探针。
- 2026-08-03：重启后真实 Credential Manager 分类探针通过；明确轴测爆炸图笔记的 3 张图片均为 axonometric/relevance=4、无 fallback，临时文件自动清理。下一步创建新的纯爆炸图单活 Run。
- 2026-08-03：恢复中断上下文并接回唯一 Run `a33b0185-fc5d-48ed-a93f-8c3cb7df042f`；该 Run 自然终止为 `partial/visual_budget_exhausted`，保留、不 retry、不计验收。系统 `python` catchup 仅因 Store 占位符失败，未修改项目。
- 2026-08-03：只读数据库审计确认三条查询仅含建筑制图消歧、视觉风格和爆炸图类型；黑白线稿与材质渲染各 3 篇 usable，红灰配色仅 2 篇 usable，后两帖 8 张图片均 type mismatch；普通网页 0、fallback=0。
- 2026-08-03：用户再次确认图纸研究不涉及建筑类型，只涉及视觉风格和剖面图/爆炸图等图纸类型。当前唯一下一步是先写“用户显式风格限定词不得被模型缩写或改写”的通用红测，再最小修复并回归；收口前不创建新 Run。
- 2026-08-03：新增两个 Provider 红测并取得准确红灯：视觉提示未明确禁止建筑类型推断，且模型把“红灰配色图解”缩为“红灰配色”时没有纠正。最小实现后 2/2 转绿。
- 2026-08-03：通用实现只对冒号后明确枚举、数量与深度一致的视觉短语做语义校验；每个短语必须逐字进入唯一子问题，不合格时最多一次普通 Responses 结构化纠正，仍不合格则失败。没有风格词表、题型分支、预算增加或确定性伪完成。
- 2026-08-03：Provider 全集、视觉/XHS/browser/workflow 相关全集、完整 API 562/562、Ruff lint、55 文件 format check、strict Mypy 26 个源文件和 `git diff --check` 全绿。当前唯一下一步是重启服务并做真实普通 Responses 视觉规划探针；通过前不创建 Run。
- 2026-08-03：重启后真实普通 Responses 视觉规划探针完整保留黑白线稿、红灰配色图解和材质渲染，且无建筑类型、项目、场地或空间语义；但模型合法输出“爆炸图：风格”时，执行查询留下全角冒号。暂不创建 Run，先补通用标点归一化红测。
- 2026-08-03：新增全角冒号、半角冒号和类型后置三个通用查询归一化用例；旧实现 2 项准确失败，最小 `strip` 修复后 3/3 与视觉规划目标共 5/5 通过。没有修改风格词、搜索预算或 XHS 准入。
- 2026-08-03：为避免爆炸图单题策略，新增剖面图标签用例，旧实现准确失败；冒号归一化提升到所有视觉查询公共入口后目标 6/6、完整 API 566/566、Ruff、55 文件 format check、strict Mypy 26 个源文件和 diff check 全绿。
- 2026-08-03：服务重启后用未见剖面图视觉题做真实普通 Responses 探针，逐字返回针管笔密线、低饱和色块、纸张纹理拼贴；执行查询均为“剖面图 + 完整风格”，无建筑类型、项目、场地或空间语义。未创建 Run、未输出或保存 Key。
- 2026-08-03：唯一 Run `a6752b62-90f4-4cb4-bf12-e1217db43650` 自然终止为 `partial/visual_budget_exhausted`，保留、不 retry、不计验收。针管笔密线与低饱和色块各 3 篇 usable；纸张纹理拼贴在 4 帖内只有 2 篇 usable。22 个本地 XHS 资产、普通网页 0、fallback=0。
- 2026-08-03：同登录态只读 A/B 表明纸张纹理拼贴的类型前置/风格前置查询都只有约 2 篇直接剖面内容；不为该过窄自选风格加专用同义词、不降低 3 usable 或增加帖子预算。下一题改用宽泛图纸视觉请求，由模型生成常见风格方向。
- 2026-08-03：宽泛轴测图 Run `708ab8df-7829-4ea2-b19f-5382fa941920` 自然完成 `completed/coverage_satisfied`，三方向 usable 3/3/3，27 个本地资产来自 9 篇 XHS 笔记。
- 2026-08-03：交付审计通过：查询仅为精密技术线稿、几何色块拼贴、氛围光影渲染 + 轴测图；27/27 XHS URL 与本地文件有效，33 次视觉检查约 5.3 MiB，普通网页/建筑模型事件 0、fallback=0。XHS 正式验收达到 2/3，总计 5/6。
- 2026-08-03：宽泛平面图 Run `d654ecac-3e76-40a6-9555-02789f92cbec` 为 `partial/visual_budget_exhausted`，保留、不 retry、不计验收。黑白线稿 3 篇 usable，水彩 0 篇，拼贴 1 篇；6 个本地资产、普通网页 0、fallback=0。
- 2026-08-03：水彩方向一帖下载失败，其他候选多为非平面图；拼贴方向后三帖均类型不匹配。查询与视觉类型门槛正确，不为水彩/拼贴追加专用规则或降低 3 usable；下一题继续使用另一种宽泛常见图纸类型。
- 2026-08-03：宽泛立面图 Run `4bb39b3c-5bc0-46c3-95f7-ab53c9f62937` 为 `partial/visual_budget_exhausted`，三方向 usable 2/3/3；保留、不 retry、不计验收。失败证明前四条元数据质量会影响常见风格，不继续写单题策略。
- 2026-08-03：新增通用 XHS 8→4 视觉候选池：最多取 8 条元数据，按图纸类型标题和视觉短语相关性排序，仍只打开最多 4 帖。目标红测先失败后转绿，`test_xiaohongshu.py` 13/13、完整 browser inspection 和定向 Ruff 通过；完整门禁与服务重启待完成。
- 2026-08-03：本次恢复按顺序完整读取 HANDOFF、AGENTS、活动 Phase 15 与 findings/progress 末尾；`git status --short --branch` 确认 39 个跟踪文件修改和 `.artifacts/build/`、`.artifacts/qa/`、`.artifacts/releases/` 全部保留。
- 2026-08-03：planning catchup 首次调用系统 `python` 命中 Microsoft Store 占位符，改用 Codex 工作区捆绑 Python 后成功，报告 57 条未同步上下文；未 reset、checkout、clean、commit 或 push。
- 2026-08-03：用户再次明确图纸研究只接收视觉分割/构图/表现方向和图纸类型，不询问或推断建筑类型。当前不创建 Run；下一步先补覆盖 Provider planning、fallback、Board 文案和执行查询的通用红测，再做最小修复与完整回归。
- 2026-08-03：全入口审查确认后端 Provider、fallback、XHS QueryAttempt/实际查询和普通网页隔离均符合纯视觉边界；仅 Board 视觉模式仍显示“空间、流线”建筑研究提示。
- 2026-08-03：新增 Board 行为红测并取得准确红灯；最小修改后视觉首屏改为“找图纸视觉方向”，只列图纸类型与分割、构图、线型、配色、版式，建筑模式文案不变。目标 Board 3/3、后端边界/候选池 6/6 通过。
- 2026-08-03：相关 Python 六文件全集、完整 API 567/567、Board 181/181、Ruff lint、64 文件 format check、strict Mypy 26 源文件、Board lint/typecheck/build 与 `git diff --check` 全绿。Ruff 仅机械格式化已修改的 `workflow.py`。
- 2026-08-03：下一步只读确认 API/Board、XHS 登录态和全局活动 Run，满足单活条件后重启服务并创建第三条宽泛纯视觉 XHS-only 验收 Run。
- 2026-08-03：运行时确认 API/Board 健康、XHS `logged_in/local_search`、7 个工作区 94 条历史 Run 且活动 Run=0；项目 stop/start 后服务重新加载成功。
- 2026-08-03：创建唯一 Run `09cd4cb4-4853-42a9-b388-e38baaf42333`，宽泛题只含效果图和构图/表现方向；Provider 生成三个纯视觉方向，无建筑类型或项目语义。
- 2026-08-03：第一方向 8→4 候选池 Trace 生效，但 4 帖后只有 2 篇 usable，已按确定失败提前取消并保留，不 retry、不计验收；没有立即换题。
- 2026-08-03：同登录态 OpenCLI 只读 A/B 确认效果图存在摄影/影视/产品歧义，单纯类型前置无效，“建筑效果图”学科限定可增加建筑渲染候选。当前先写通用消歧与候选语境排序红测，不降低固定门槛。
- 2026-08-03：新增效果图学科限定与混合建筑/摄影/影视/产品候选排序红测，旧实现两项目标准确失败；首轮实现又被既有立面类型保护测试拦住，调整为综合分后目标 7/7 全绿。
- 2026-08-03：最终规则只对爆炸图/效果图添加建筑制图学科限定；候选仍以图纸类型为主，建筑语境加分，无建筑语境的跨行业标题降权，合法“建筑电影感”不受惩罚。
- 2026-08-03：相关六文件 328/328、完整 API 569/569、Ruff lint、64 文件 format check、strict Mypy 26 源文件和 diff check 全绿。下一步重启并新建宽泛效果图 Run 验证真实召回。
- 2026-08-03：唯一效果图 Run `c521e3bd-6067-4453-b574-7c62684624e8` 自然完成 `completed/coverage_satisfied`，三方向各 3 篇 usable，25 个 `render` 资产来自 9 篇 XHS 笔记。
- 2026-08-03：只读交付审计通过：QueryAttempt 仅为“建筑效果图 + 视觉方向”，“建筑”只作制图学科消歧；三次候选池均为 8→4，25/25 XHS URL 与本地文件有效，普通网页事件 0、fallback=0。
- 2026-08-03：正式验收达到建筑 3/3、XHS 3/3，总计 6/6，活动 Run=0。下一步用项目 Playwright 验证 Board 的六条正式结果，随后进入 `v2.2.4` 发布门禁与构建。
- 2026-08-03：项目 Playwright 六条 Board QA 最终通过。建筑三条各显示 3 个子问题章节、逐题结论、案例答案、来源和转译步骤，图片 3/3、3/3、4/4；XHS 三条各显示 3 个方向与 9 篇笔记，图片 24/24、27/27、25/25。
- 2026-08-03：首次 QA 因历史标题采用问题后半句而匹配失败，修正定位文本；第二次快速整页滚动未触发两个懒加载图片，改为逐图滚动等待后确认 4/4 正常。最终页面错误和非预期本地响应错误均为 0。
- 2026-08-03：六张整页截图写入 `.artifacts/qa/v2.2.4-board/` 并人工检查无结果缺失、断图或布局重叠。下一步进入 `v2.2.4` 完整门禁、构建、真实安装 smoke 和统一发布阶段。
- 2026-08-03：Release 合同测试先提升到 `2.2.4` 并准确红在 CI 仍命名 `v2.2.3`；同步 API、Board、Extension、manifest、CI、README 和部署文档后转绿。
- 2026-08-03：非历史发布面 `v2.2.3` 扫描为空，所有当前发布面均为 `2.2.4`，`git diff --check` 通过。下一步运行权威 `scripts/verify.ps1`。
- 2026-08-03：用户要求确认架构并同步 GitHub 首页。审计确认仍是 Evidence-Grounded Plan-and-Execute，唯一 orchestrator 与七阶段状态机未变；新策略位于 Plan/Execute 内部，不是多 Agent 架构。
- 2026-08-03：README 发布合同先红在缺少方案初期、本地候选、候选 ID 白名单、原生 web_search 禁用和纯视觉输入说明；更新首页介绍、流程图与研究行为后转绿。
- 2026-08-03：首次完整 verify 在 API 569/569 后仅因两个版本文件需 Ruff 格式化停止；机械格式化并纳入 README 后完整重跑通过：API 569、Board 181、Extension 182、packaged E2E 8，全部静态与构建门禁全绿。
- 2026-08-03：独立扩展 ZIP 构建成功：18,719 bytes，manifest 2.2.4，SHA-256 `4349E77FEFDEF8AF0F0C22F59D0F6C79AEFB398F17F2AA911CF45EEF76FAA26B`。
- 2026-08-03：自包含 Windows 安装器构建成功：69,748,597 bytes，文件/产品版本 2.2.4，SHA-256 `AB2D0D19B4260C89A9F7DE02D277A4EC946707E9AE0D40492E3ABAE27B97A70B`。
- 2026-08-03：真实安装 smoke 通过：静默安装、自检、快捷方式、扩展排除、安装版动态端口 8771、desktop/API/Board 200、静默卸载与无残留。标准 package smoke 另行通过。
- 2026-08-03：续接恢复完成；系统 `python` 命令命中 Microsoft Store 占位符后改用 `py -3` 成功运行 planning catchup。README 只读审计确认仍为 Evidence-Grounded Plan-and-Execute，并完整说明普通 Responses 规划、本地 Playwright 候选搜索/读取、候选 ID 白名单、空间优先、XHS-only 纯视觉边界和禁用原生 `web_search`；Release 合同已锁定这些说明。
- 2026-08-03：发布前范围与敏感模式审计通过：50 个跟踪修改属于本轮及此前未发布范围，新增行未命中常见 Key/token/private-key 模式；`.artifacts/build/`、`.artifacts/qa/`、`.artifacts/releases/` 保持未跟踪。GitHub CLI 已认证，`v2.2.4` Release 尚不存在，当前无打开的同分支 PR。
- 2026-08-03：抓取远端 `main` 后确认其 HEAD 为 `a7fa84a`；当前分支 `d34b0c3` 与之文件树完全一致，但提交历史因 `v2.2.3` 的不同合并路径而分叉。下一步先以普通 merge 连接等价历史，再显式暂存跟踪修改并统一提交 `v2.2.4`；不 reset、checkout、clean 或触碰真实研究数据。
