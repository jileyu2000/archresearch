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
