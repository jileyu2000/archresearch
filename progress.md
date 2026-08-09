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
- 2026-08-03：以无冲突 merge 连接等价历史后，50 个跟踪修改统一提交为 `08b49bb` 并推送；`.artifacts/build/`、`.artifacts/qa/`、`.artifacts/releases/` 和真实研究数据未暂存。
- 2026-08-03：PR #15 创建为 Ready，GitHub 确认范围为 50 文件、7904 additions/628 deletions；Hosted CI run `30806486060` 的 `verify` job 在 17 分 16 秒后成功，PR 状态 `CLEAN / MERGEABLE`。
- 2026-08-03：PR #15 已 squash 合并为远端 `main` 提交 `d80f715d88781810eda7624d9f1d65b3754228fb`。正式 `v2.2.4` Release 已发布，非草稿、非预发布，tag 精确指向该合并提交。
- 2026-08-03：GitHub 附件复核通过：扩展 ZIP 18,719 bytes、SHA-256 `4349E77FEFDEF8AF0F0C22F59D0F6C79AEFB398F17F2AA911CF45EEF76FAA26B`；Windows 安装器 69,748,597 bytes、SHA-256 `AB2D0D19B4260C89A9F7DE02D277A4EC946707E9AE0D40492E3ABAE27B97A70B`。
- 2026-08-03：发布后项目管理收口：Phase 15 标记 complete，HANDOFF 仅保留当前合同与已验证基线；`.artifacts/build/`、`.artifacts/qa/`、`.artifacts/releases/` 改为精确忽略并继续保留，不删除约 1.1 GB 的构建、QA 和发布产物。
- 2026-08-03 20:39 +08:00：用户要求为同目录新对话准备无缝交接；使用 planning catch-up 恢复未同步上下文，只发现 PR #16 管理文件历史核对与交接请求，没有遗漏的产品开发。
- 2026-08-03 20:39 +08:00：planning catch-up 首次因系统 `python` 命中 Microsoft Store 占位符失败，改用 Codex 附带 Python 后成功；两组只读 PowerShell 命令因变量提前展开失败，改用单引号保护后完成核验。错误均未写产品或研究数据。
- 2026-08-03 20:39 +08:00：交接修改前 Git 工作树干净；SQLite `mode=ro` 统计 96 条历史 Run，27 completed、38 partial、13 blocked、18 cancelled，非终态 Run 为 0。
- 2026-08-03 20:39 +08:00：确认 `v2.2.4` 产品、6/6 真实验收、Board QA、完整门禁、安装 smoke、PR #15、CI、合并和 Release 全部完成；当前无未完成产品任务、无阻塞、无活动 Run。
- 2026-08-03 20:39 +08:00：仅更新 `HANDOFF.md`、`task_plan.md`、`findings.md`、`progress.md` 供新对话恢复；没有重跑已完成验收，没有修改产品代码、创建 Run、删除本地产物或提交。
- 2026-08-03 20:40 +08:00：交接补丁最终核对通过：`git diff --check` 无错误，Git 状态只包含上述四个管理文件的未提交修改；按用户要求不暂存、不提交、不推送。
- 2026-08-03：开始 Phase 17 小红书登录检测恢复。已检查用户截图并确认现状缺少登录入口、等待状态和自动复检；本阶段不创建 Run、不读取凭据、不使用 Codex 内置浏览器。
- 2026-08-03：加载 `planning-with-files` 与 `impeccable`，完成 session catch-up、Board PRODUCT/DESIGN 与产品界面准则恢复；首次管理文件补丁因旧上下文不精确而整体未应用，读取末尾后成功登记活动阶段。
- 2026-08-03：下一步只读定位 Board、API、扩展/OpenCLI 的登录检测链路，再写行为红测。
- 2026-08-03：第一轮链路审计完成：Board 的 `unknown` 状态隐藏登录入口、首次加载不查 XHS 会话、API 的 OpenCLI `unknown` 不回退已连接扩展。已记录为三项通用修复候选，尚未修改产品代码。
- 2026-08-03：首次本机状态探针因嵌套 PowerShell 提前展开 `$_` 而解析失败，未触达 API；下一次改用无变量的 `curl.exe` 请求。
- 2026-08-03：`curl.exe` 只读探针成功：浏览器扩展未连接、OpenCLI 可用；OpenCLI 登录检测约 13 秒后返回 `unknown/local_search`。确认首次检测已有触发，下一步审计 OpenCLI auth 实现和固定 Chrome 登录打开路径。
- 2026-08-03：OpenCLI 适配器检索因假定了不存在的编译目录失败；下一步先列出包内真实文件路径，不重复错误路径。
- 2026-08-03：确认 OpenCLI auth 使用独立 ephemeral 后台会话而非用户普通 Chrome profile；API 现有 fixed-URL Chrome launcher 可安全扩展为小红书固定登录页。下一步先写 API 通道回退与固定 URL 打开红测，再写 Board 自动打开/轮询红测。
- 2026-08-03：测试落点已收敛到 `test_browser_ws.py`、`App.test.tsx` 与现有 readiness hook；UI 复用当前 preflight 结构。现在进入红测阶段，生产代码仍未修改。
- 2026-08-03：API 红测 2/2 准确失败：OpenCLI `unknown` 遮蔽扩展登录态，新固定登录端点不存在。下一步运行 Board 自动打开/既有登录两条红测。
- 2026-08-03：Board 目标测试 1 红 1 绿：unknown 自动恢复准确失败，既有登录不重复开页保持通过。红测阶段完成，下一步最小实现 API 固定登录端点、Chrome 优先状态合并和 Board 单次自动恢复。
- 2026-08-03：完成后端最小实现；API 目标测试 3/3 转绿。新端点固定打开小红书 explore，扩展登录态不再被 OpenCLI unknown 遮蔽，原本 Board 固定 URL 启动测试保持通过。
- 2026-08-03：完成 Board 单次自动恢复、有限轮询和 opening/waiting/timed_out 文案；目标测试 2/2 转绿。下一步运行 App/readiness/component 回归并修正旧静态链接合同，再跑 lint/typecheck。
- 2026-08-03：首轮相关回归 Board 115 通过、4 失败；确认两项为链接→按钮合同更新，两项为 pairing 场景与真实自动连接竞态。下一步先修竞态和可取消 timer，再更新精确测试断言。
- 2026-08-03：第二轮相关回归仍有 4 个失败：3 个来自把后台 broker 连接误当当前页面授权，1 个来自旧 fail-closed 测试在异步恢复完成前断言登录页已打开。已恢复页面授权边界，并把打开行为留给新增专用测试；下一步重跑 Board/API 定向回归。
- 2026-08-03：第三轮 Board 相关回归 118/119，通过权限边界场景，仅 `?connect=chrome` 自动配对仍因同批次双连接取消失败。已把 Chrome 配对收敛为 single-flight Promise，使登录恢复等待既有连接；下一步重跑同一组 119 项。
- 2026-08-03：single-flight 后仍为 118/119，证明竞态推断不成立；实际是 XHS 登录成功清空了已成功的 Chrome 配对提示。已撤回无效连接改动，只让 XHS 恢复停止改写配对反馈；下一步再次运行 119 项。
- 2026-08-03：Board 相关回归 119/119、API XHS/浏览器协议回归 48/48 全绿，`git diff --check` 通过且旧静态登录链接断言为空。静态门禁首次仅发现 `browser.py` 需要 Ruff 机械排版；下一步格式化后分别重跑 Board/Python 门禁。
- 2026-08-03：完整回归 API 571/571、Board 183/183、Extension 182/182 全绿；Board lint/typecheck/build、Ruff check/format、strict Mypy 26 源文件也全绿。收口只读 Run 查询首次被 PowerShell 提前解析 SQL `*`，未连接数据库、未重启服务；下一步用安全 here-string 重查。
- 2026-08-03：安全 here-string 已以 SQLite `mode=ro` 打开数据库，但误用表名 `runs`，返回 `no such table`；没有写入，服务仍未重启。下一步只读取得真实表名后完成统计。
- 2026-08-03 21:30 +08:00：只读确认真实表为 `research_runs`，96 条历史 Run、活动 Run=0；项目 stop/start 重载源码服务成功，API 8000 health=ok、Board 5173=200、新小红书固定登录端点已注册。
- 2026-08-03 21:30 +08:00：服务重载后再以 SQLite `mode=ro` 核对，活动 Run 仍为 0；`git diff --check` 通过。Phase 17 标记 complete，本地修复未 commit、push、PR 或发布，唯一下一步为用户在自己的 Chrome 做真实登录验收。
- 2026-08-03：用户授权 Codex 代做真实验收。开始 Phase 18；加载 `planning-with-files` 与系统 Chrome 控制规范，session catch-up 只包含 Phase 17 收口和本次验收请求，Git 产品修改范围未变，活动 Run=0。
- 2026-08-03：系统 Chrome 连接成功并命名验收会话；只发现一个本地 Board 标签，无小红书标签。已接管并刷新 `http://127.0.0.1:5173/`，未使用内置浏览器。
- 2026-08-03：Board 首页 DOM 正常，唯一“图纸灵感 配色、线型、版式与分析图”入口可见；Chrome 控制层 Statsig 遥测超时但页面快照完整，记录为非产品噪声。下一步点击该入口并观察登录预检。
- 2026-08-03：真实点击图纸灵感后页面直接显示“研究环境已就绪”，详情为“小红书负责查找灵感 · Chrome 可读取当前页面高清图”；已有登录路径通过，未点击“查找灵感”。下一步核对没有新增登录标签、API 返回通道和活动 Run。
- 2026-08-03：就绪后 Chrome 仍只有 Board 标签，无重复小红书页；API 返回 `logged_in/chrome_extension`，浏览器连接与本地搜索均可用。已有登录真实路径通过；不通过登出用户账号来破坏性制造未登录路径。
- 2026-08-03 21:37 +08:00：Board 页面错误日志 0；验收后 SQLite 仍为 96 条历史 Run、活动 Run=0，diff check 通过。Phase 18 complete；只验证可安全执行的已有登录路径，未登录路径不以登出用户账号的方式强行制造。
- 2026-08-03 21:37 +08:00：首次 Phase 18 收口补丁因 Statsig 错误行此前误插到 Phase 14 而整体未应用；已移除误插行并用精确 Phase 18 上下文完成记录，没有修改产品代码或浏览器状态。
- 2026-08-03：用户确认已自行退出小红书；Phase 18 重新标记 in_progress。只读确认活动 Run=0，下一步复用系统 Chrome 补测未登录自动打开与自动复检，不触发研究。
- 2026-08-03：系统 Chrome 未登录验收基线为 Board + 1 个既有 XHS explore + 1 个 Google 搜索标签；已记录固定 XHS 标签基线数量 1，并刷新 Board 重置自动恢复。下一步进入图纸灵感观察状态与标签增量。
- 2026-08-03：刷新后的 Board 首页正常，唯一图纸灵感入口已点击；没有点击“查找灵感”。下一步读取研究环境状态并核对固定 XHS explore 标签是否从基线 1 增加。
- 2026-08-03：未登录真实路径首次失败：用户已退出系统 Chrome，但 Board 仍显示就绪；API 为 `logged_in/local_search`。定位为 OpenCLI 独立登录覆盖 Chrome 明确未登录。下一步先写 API 红测，再最小修复扩展明确状态优先级。
- 2026-08-03：新增“Chrome not_logged_in 覆盖 local logged_in”API 红测，旧实现准确失败为 `logged_in/local_search`。确认不是扩展未更新；下一步修改后端通道合并并运行相关回归。
- 2026-08-03：通道优先级最小修改完成，登录/退出两条目标测试 2/2，完整 API 572/572 全绿。静态门禁仅要求 Ruff 机械格式化 `browser.py`；下一步格式化、重跑静态门禁并重启现场复测。
- 2026-08-03：Ruff format/check、strict Mypy 26 源文件全绿；活动 Run=0 时重启服务。真实 API 现为 `not_logged_in/chrome_extension`、health=ok、活动 Run=0。下一步刷新 Board 验证自动打开与等待状态。
- 2026-08-03：重启后 Chrome 标签基线未变，仍有 1 个用户既有 XHS explore；Board 已刷新并加载新后端。下一步从首页进入图纸灵感，观察等待文案和 XHS 标签增量。
- 2026-08-03：修复后真实未登录路径已通过前半段：进入图纸灵感后 Board 显示“等待小红书登录”，固定 XHS explore 标签从 1 增至 2；未点击“查找灵感”。下一步暂停让用户本人登录，再验证 Board 自动转为就绪。
- 2026-08-03：用户本人登录后，旧 8 次轮询已超时；点击“重新检测”立即就绪，API 为 `logged_in/local_search`。确认扩展版本不是阻塞，但真人登录窗口仍偏短；下一步先写晚登录红测。
- 2026-08-03：晚登录行为测试最终在旧 8 次常量下准确失败，最小改为 20 次后转绿；登录页仍只打开一次。完整 Board 184/184、lint/typecheck/build 全绿。
- 2026-08-03：最终真实冷启动验收通过：刷新 Board 后首次进入图纸灵感直接就绪，固定 XHS explore 标签保持 2 个、Board error 日志 0；未点击“查找灵感”。下一步只读核对活动 Run 与 Git 后收口。
- 2026-08-03：收口只读确认 96 条历史 Run、活动 Run=0，`git diff --check` 通过；Phase 18 complete。本地修复继续保持未提交，未 push、PR 或发布。
- 2026-08-03：用户授权准备并发布 `v2.2.5`，同时要求把 GitHub README 从开发/测试说明改为产品功能、使用方式和运作流程。开始 Phase 19；已读取 planning-with-files、humanizer-zh（含深度改写模式）与 GitHub yeet 规范，下一步按 catch-up 建议审查 diff、规划文件和 README。
- 2026-08-03：完成 Phase 19 首轮审计：12 个现有修改均属登录修复与管理记录，无未跟踪文件；README 当前主要问题是开发架构、验证与技术取舍压过产品功能。GitHub CLI 已安装并登录，仓库 `jileyu2000/archresearch` 默认分支为 `main`。
- 2026-08-03：完成版本与发布链审计：`2.2.5` 需同步 API、Board、Extension manifest/package、Release/installer 合同、README 与用户文档；当前发布分支提交图相对 main 为 behind 1/ahead 12，下一步先核对 PR #16 与提交关系，再决定安全分支策略。
- 2026-08-03：确认 PR #16 已把旧分支 squash 合入 main。为避免旧分支冗余历史，发布时将从 `origin/main` 建立独立 `codex/v2.2.5` worktree并复制确认范围；原工作区保持原样。README 信息架构已收敛，进入重写。
- 2026-08-03：README 已重写为下载安装、三类功能、用户运作流程、两种研究方式、结果内容、使用步骤和本地安全；开发架构、验证矩阵、技术取舍与退役技术已移出首页。新增 `v2.2.5` 产品/README 合同后，旧 workflow 准确红灯在 `v2.2.4` 安装器名称。
- 2026-08-03：已同步 workflow、API、Board、Extension manifest/package、architecture 与 extension guide 到 `2.2.5`；Release/README 合同转绿。下一步做残留版本/README 自审，再进入完整门禁。
- 2026-08-03：残留 `2.2.4` 与 README 开发者章节扫描为 0，diff check 通过；coverage 门禁 Board 184/184、Extension 182/182。首轮权威 verify 的 API 572/572 通过，随后只因两个版本文件需要 Ruff 机械格式化而停止。
- 2026-08-03：机械格式化两个版本文件后完整重跑权威 verify，全绿：API 572/572、Board 184/184、Extension 182/182、Ruff/Mypy、lint/typecheck/build、Windows/Release 合同和 packaged E2E 8/8 全部通过。下一步构建两个 `v2.2.5` 发布附件并做真实安装 smoke。
- 2026-08-03：已生成 `ArchResearch-Windows-x64-Setup-v2.2.5.exe` 和独立 `archresearch-chrome-extension-only-v2.2.5.zip`；真实静默安装/启动/快捷方式/扩展排除/卸载 smoke 通过。下一步记录最终 digest、创建干净发布 worktree并复跑最小提交核验。
- 2026-08-03：记录发布候选 digest：安装器 69,750,435 bytes / `9CE2FCA...777D2`，扩展 18,719 bytes / `0C61CA...A334`；smoke 后活动 Run=0、安装残留=0。准备从 `origin/main` 创建 `codex/v2.2.5` worktree，只复制 19 个产品/测试/README/版本文件，四个本地交接文件继续留在原工作区。
- 2026-08-03：已创建 `codex/v2.2.5` worktree 于最新 `origin/main`，机械复制确认的 19 文件 diff；worktree 无额外文件且 diff check 通过。原工作区未切换分支、未 reset/checkout/clean，四个交接文件继续保持未提交。
- 2026-08-03：worktree 首次逐字节文件比较因 Git CRLF/LF 规范化报告 16 个文本哈希差异；未发现补丁失败或额外文件。下一步改用统一换行后的内容比较并运行 worktree Release 合同。
- 2026-08-03：统一 CRLF/LF 后 19/19 候选文件内容完全一致，干净 `codex/v2.2.5` worktree 的 Release/README 合同通过。下一步显式暂存这 19 个文件、提交并推送后创建 draft PR。
- 2026-08-03：19 个显式文件提交为 `4d40cbb` 并推送 `codex/v2.2.5`；draft PR #17 创建，原工作区及四个交接文件未进入提交。
- 2026-08-03：PR #17 两套 Hosted CI `verify` 全绿（18:06、18:53），转 Ready 后 squash 合并为 `a691a0e141d9863672886b8c868cee03da0a818c`。
- 2026-08-03：创建并推送 annotated tag `v2.2.5`，正式 Release 发布；GitHub README 已切换为产品功能、运作流程、研究结果、使用步骤与本地安全说明。
- 2026-08-03：远端附件名称、大小与 digest 复核通过：安装器 69,750,435 bytes / `9CE2FCA...777D2`，扩展 18,719 bytes / `0C61CA...A334`；tag 解引用精确命中合并提交。
- 2026-08-03：发布后只读确认 96 条历史 Run、活动 Run=0；Phase 19 complete。原工作区同内容修改和四个交接文件继续保留，未 reset、checkout、clean。
- 2026-08-03：用户发现 GitHub About 仍是旧的 Chrome 扩展/Web Edition 介绍；已只修改仓库 description 为本地优先建筑研究工作台及其两类核心产出，远端回读一致，代码、Release 与 Topics 未改。
- 2026-08-03：开始 Phase 20。用户报告 v2.2.5 安装版的小红书登录动作反复新开 Board；已加载 planning-with-files 与系统 Chrome 控制规范，恢复当前发布/工作树上下文。下一步先记录截图与真实标签基线，再审计安装版 URL 调度链，生产代码尚未修改。
- 2026-08-03：系统 Chrome 只读标签基线确认安装版端口 3630；最近两次点击均新增 `/?connect=chrome&attempt=...` Board 标签，没有新增小红书。真实缺陷已复现，未再次点击、未创建 Run；下一步定位安装版为何把固定 XHS 动作路由到 Board 配对启动器。
- 2026-08-03：定位安装版根因为 `create_desktop_app()` 的 launcher lambda 丢弃所有请求 URL 并恒定打开动态 Board URL；源码路径不受影响。下一步在最新 main 独立 worktree 先写安装版 Board 映射 + XHS 保留红测，再做最小实现。
- 2026-08-03：安装版行为红测准确失败：第二次请求应传 `https://www.xiaohongshu.com/explore`，实际仍为 `http://127.0.0.1:49152/?connect=chrome`。红测完成，进入桌面 URL 映射最小修复。
- 2026-08-03：桌面最小修复完成：只有 `CHROME_BOARD_URL` 被映射到安装版动态端口，固定 XHS URL 原样传给 `open_known_url_in_chrome`；目标红测转绿。下一步运行 desktop/browser 回归与 Python 静态门禁。
- 2026-08-03：首轮定向静态门禁中 Ruff check 通过，format check 要求机械重排两个已改文件；并行调用没有可靠返回 pytest/Mypy 输出。下一步先格式化，再独立重跑所有结果，不能沿用缺失输出。
- 2026-08-03：格式化后 desktop/browser 回归 45/45、Ruff check/format、strict Mypy 26 源文件全绿。下一步审计构建脚本，选择不覆盖 v2.2.5 正式产物、不破坏当前安装的冻结版验证路径。
- 2026-08-03：首次整仓 verify 在 571/572 停止，新红测再次得到旧 Board URL；定位为复用 editable venv 导入了原工作区源码，而测试来自 worktree。下一步显式设置 worktree `PYTHONPATH` 后完整重跑，不修改产品实现。
- 2026-08-03：修正 `PYTHONPATH` 后 API 572/572、Ruff 与 Mypy 全绿；verify 随后仅因 pnpm 不允许在无 TTY 下重建临时 junction node_modules 停止。决定不让 pnpm改临时依赖，把两文件补丁应用到原工作区未修改文件后完整重跑。
- 2026-08-03：原工作区权威完整门禁全绿：API 572、Board 184、Extension 182、packaged E2E 8，以及 Ruff/Mypy、lint/typecheck/build 与全部 Windows/Release 合同通过。
- 2026-08-03：真实启动验证通过：修复后的桌面端点返回 200/opened=true，Chrome Board 标签保持 3、XHS 由 2 增至 3，唯一新增页为固定 explore；没有创建 Run。
- 2026-08-03：SQLite `mode=ro` 收口为 96 条历史 Run、活动 Run=0，两个工作树 diff check 通过。当前等待用户明确授权是否继续 v2.2.6 版本、安装器、提交与发布；现有 v2.2.5 安装二进制不会自动获得源码修复。
- 2026-08-03：清理本轮临时 worktree 的 4 个依赖 junction 被安全策略拦截，未删除内容且未尝试绕过；它们均在临时 worktree 内、Git 忽略，可留待 v2.2.6 构建使用，原依赖与用户数据不受影响。
- 2026-08-04：用户明确授权发布 v2.2.6。重新加载 planning-with-files 与 GitHub yeet 规范，catch-up 仅补回授权与上一轮最终结论；GitHub CLI 2.96.0 已认证 `jileyu2000`，默认分支 main。下一步先做 v2.2.6 Release 合同红测。
- 2026-08-04：Release 合同先提升到 2.2.6，在旧 workflow 上准确红灯于 v2.2.5 安装器名；现已同步 API、Board、Extension manifest/package、workflow、README 与用户文档，下一步运行合同与残留版本扫描。
- 2026-08-04：首次同步后合同发现 3 个 README 正则仍转义写死 v2.2.5，普通扫描未命中；已同步为 v2.2.6，并将普通/转义旧版本一起扫描。
- 2026-08-04：v2.2.6 Release/README 合同转绿，普通与转义活动 v2.2.5 扫描均为 0，diff check 通过。下一步重跑权威整仓门禁。
- 2026-08-04：首轮 v2.2.6 权威 verify 的 API 572/572 与 Ruff check 通过，随后只因两个版本文件需要 Ruff 机械格式化停止；下一步格式化后从头完整重跑。
- 2026-08-04：格式化后权威 verify 全绿：API 572、Board 184、Extension 182、packaged E2E 8，Ruff/Mypy、lint/typecheck/build 与全部 Windows/Release 合同通过。独立扩展 ZIP 已生成；下一步在最新 main 的干净 v2.2.6 worktree 构建安装器，避免改写原 `.artifacts/build`。
- 2026-08-04：确认 `origin/main` 已是完整 v2.2.5 基线；在独立 `codex/v2.2.6` worktree 用 `apply_patch` 落入 13 个已验证发布文件，统一换行后 13/13 与原工作区一致，Release 合同通过。
- 2026-08-04：干净 worktree 独立安装依赖并构建两个附件；冻结程序 `--self-test` 退出码 0、desktop 测试 9/9、安装器 payload 扩展文件数 0。首个普通 PowerShell GUI EXE 调用因拿不到 `$LASTEXITCODE` 误判，改用等待进程读取真实退出码后通过。
- 2026-08-04：13 文件提交 `5701911` 推送并创建 draft PR #18。第一轮 PR CI 在既有 Provider 测试的浮点严格相等处失败 1/572：`89.99999999999989 != 90.0`；其余 571 项通过。
- 2026-08-04：只把该测试断言改为 `pytest.approx`，生产逻辑不变；目标测试连续 10 次与 Ruff 全绿，提交 `4814fc6` 推送重新触发 CI。
- 2026-08-04：最终 push/PR 两套 Hosted CI run `30833250631`、`30833258563` 全绿，均完成完整仓库门禁、Windows 安装器构建、真实安装/卸载 smoke 和两个附件上传。
- 2026-08-04：PR #18 转 Ready 后 squash 合并为 `7512a45bfec010cde8a701c910afbd43af813137`；创建并推送 annotated tag `v2.2.6`，tag 解引用精确命中该合并提交。
- 2026-08-04：正式 [ArchResearch 本地版 v2.2.6](https://github.com/jileyu2000/archresearch/releases/tag/v2.2.6) 已发布，非草稿、非预发布。CI 安装器 70,087,718 bytes / `4BDC30F5...B6916B2`，扩展 ZIP 18,697 bytes / `40634B85...EDA30FA`；GitHub asset digest 完全一致。
- 2026-08-04：发布后 SQLite `mode=ro` 为 96 条历史 Run、活动 Run=0。Phase 20 complete；原工作区 21 个已发布产品/测试/版本修改与四个管理文件继续保留，未 reset、checkout、clean、提交或覆盖。
- 2026-08-04：开始 Phase 21。用户确认 v2.2.6 已能打开小红书，但登录、退出重登后仍检测不到登录；已加载 planning-with-files 与系统 Chrome 控制规范。下一步只读确认安装版版本、动态端口、API 登录通道、扩展连接和系统 Chrome 可见状态，不立即改代码、不创建 Run。
- 2026-08-04：现场只读确认安装版为 v2.2.6、PID 48400、动态端口 3824；ArchResearch 扩展已连接，本地搜索不可用，登录 API 为 `unknown/chrome_extension`。SQLite 仍为 96 条历史 Run、活动 Run=0。
- 2026-08-04：Codex Chrome 控制旧会话断开；按规范等待重试并运行只读诊断，Chrome、Codex 扩展与 native host 均正常但控制连接仍不可用。该通道与已经连接的 ArchResearch 扩展独立，下一步直接审计 ArchResearch 扩展的 XHS 可见页面判定。
- 2026-08-04：扩展链路审计确认登录检查新开临时 XHS search_result，并只把旧 `section.note-item` 结构判为已登录；任何其他结构或异常都变成 `unknown`。下一步核对运行日志和安装扩展版本，区分 DOM/等待问题与命令异常。
- 2026-08-04：日志没有暴露命令错误、WebSocket 不传扩展版本；搜索页已有 3.5 秒等待。新增“扩展连接但研究权限未恢复”高优先级假设，下一步追踪 permission 消息链后再决定红测落点。
- 2026-08-04：权限链审计确认 Board 可区分持久 host 权限，但 API 把扩展命令异常吞成 unknown；现场请求远短于必经 3.5 秒等待，优先怀疑命令即时拒绝而非 DOM。下一步单次计时并审计 browser command 错误传播。
- 2026-08-04：单次现场计时为 196 ms，确认失败发生在临时页等待前；Broker 可能在 DNS 公网校验或扩展 `permission_required` 处即时失败，且当前错误 code 被丢失。下一步检查生产 DNS 解析结果。
- 2026-08-04：XHS DNS 全部为公网地址，排除 SSRF 门禁；扩展 open_url 正常失败应更慢，当前 196 ms 与 executor 前 permission 拒绝一致。下一步检查 WebSocket 重连是否会把内存权限清零，并写 status 重同步红测。
## 2026-08-04 — Phase 21 source narrowing

- Read `BrowserSocketClient` connection lifecycle and permission gate: reconnect uses `disconnect(false)` and preserves permission; command rejection occurs before execution when the in-memory gate is false.
- Read `ExtensionController` and its tests: startup/pair/request paths synchronize permission, while `ui.status` only reports persisted permission and does not repair a stale active client gate.
- Next: inspect the actually loaded extension version/declared permissions without accessing browser login data, then add a failing controller behavior test.

## 2026-08-04 — Phase 21 RED and minimal implementation

- Verified the loaded desktop extension is v2.2.6 and byte-identical to the repository build; Chrome host access is active/granted.
- Found a second obsolete unpacked extension registration whose source directory no longer exists, creating a possible single-socket race.
- Added RED test `repairs a stale command gate when status confirms web access`; it failed with zero synchronization calls.
- Implemented connected `ui.status` gate repair in `ExtensionController`; targeted controller suite is green (10/10).
- Next: run full extension gates, build a test artifact, and complete real-Chrome acceptance without touching research data.
- Full extension gates passed: lint, typecheck, 183 unit tests, build, and 8 packaged E2E tests.
- Backed up the official loaded background bundle, copied the verified candidate bundle into the current desktop extension directory, and confirmed source/target SHA-256 equality. Chrome still runs the old worker: the next API probe returned `unknown/chrome_extension` in 219 ms.
- Real acceptance now requires disabling the obsolete unpacked registration and reloading the current extension in `chrome://extensions`; no Run has been created.
- User loaded and paired the candidate. Production check now follows the full 3.5-second chain instead of failing immediately, confirming permission repair; three checks still returned DOM-level `unknown` at 3.7–3.9 seconds.
- Compared current public XHS adapter behavior: it waits for content/login-wall mutation on one tab, while ArchResearch performs one observation then closes the tab. Next: add an executor RED for unknown→logged_in on the same managed tab, then implement a bounded retry.
- Added and confirmed the second RED (`unknown` then `logged_in` on the same managed tab); implemented five 1-second bounded rechecks with host validation and explicit fail-closed exhaustion coverage.
- Updated gates passed: executor 18/18, full extension 185/185, lint, typecheck, build, and packaged E2E 8/8.
- Backed up the first candidate and copied the second verified background bundle into the current desktop extension folder. Next: user reloads the current extension once, then repeat production session check.
- Same-tab retry candidate reloaded successfully but real status stayed unknown after 8.816 seconds.
- Added and verified visible login-control/user-avatar REDs; 187 unit tests and 8 packaged E2E passed, candidate reloaded, real status still unknown.
- Added and verified profile-link/classless-note-link REDs; 189 unit tests and 8 packaged E2E passed, candidate reloaded, real status still unknown after 8.824 seconds.
- Next: inspect a screenshot of the exact fixed search URL in the same Chrome profile to distinguish login wall, risk/error page, empty shell, or delayed search results before any further code change.
- User authorized direct Chrome inspection. Recovered Chrome control, opened the exact fixed URL in Default profile, and observed an authoritative `/website-login/captcha` redirect titled `安全验证`; kept the verification tab open for handoff.
- Added RED coverage for the real captcha redirect and implemented bounded not-ready detection. Final extension verification passed: 190 unit tests, lint, typecheck, build, and 8 packaged E2E.
- Copied the final candidate content bundle to the loaded desktop extension folder. Next: obtain action-time CAPTCHA permission or let the user complete the safety verification, reload the extension, then rerun production session/API and Run-count acceptance.
- User completed the XHS safety verification. Production acceptance passed: connected=true and session=`logged_in/chrome_extension` in 3.910 seconds.
- SQLite mode=ro acceptance passed: project DB 96 Runs/0 active; installed DB 0 Runs/0 active. `git diff --check` passed. Phase 21 complete; no commit, push, PR, or release.
# 2026-08-04 — Phase 22

- User requested one modal that combines Chrome extension preparation and Xiaohongshu login when switching to drawing inspiration.
- Loaded `planning-with-files` and `impeccable`, ran session catch-up, read Board product/design guidance, and inspected current readiness behavior.
- Confirmed no product code has been changed for Phase 22 yet; worktree's existing modifications and research data remain preserved.
- Next: add failing Board behavior tests for the unified preparation dialog before implementation.
- Inspected current App overlay lifecycle, readiness state machine, ResearchComposer controls, orphaned install-dialog CSS, and the historical extension-only dialog. Chosen implementation: a dedicated preparation-dialog component rendered by App and driven entirely by existing readiness actions.
- Added two Phase 22 App behavior REDs. Targeted Vitest run failed 2/2 at the missing dialog while 109 unrelated tests were skipped, confirming the intended regression before production changes.
- User simplified the task before the first implementation was verified. Updating the RED and replacing the unverified stateful dialog draft with a static usage guide; no existing readiness behavior will be moved or removed.
- Revised RED passed after the minimal implementation: first visual-mode switch shows the static usage guide, closing stores the one-time acknowledgement, the visual-only “使用方法” button reopens it, and the existing environment-control component test still passes.
- Final Phase 22 verification passed: focused App/Home 113/113, full Board 185/185, ESLint, TypeScript, production build, and `git diff --check`.
- Read-only SQLite verification remains project DB 96 total/0 active and installed DB 0 total/0 active. No Research Run, commit, push, PR, tag, or release was created.

# 2026-08-04 — Phase 23

- User explicitly authorized publication. Planned v2.2.7 scope is limited to Phase 21 extension login detection, Phase 22 Board usage guidance, their behavior tests/product contract, and required version/release files.
- Release will use a clean worktree from current remote main; the original dirty worktree and all local research/build data remain untouched.
- Release contract RED failed on the old v2.2.6 Windows artifact name, then turned green after synchronizing the v2.2.7 workflow, API/Board/Extension versions, README, user docs, and contract.
- Created clean `agent/v2.2.7` worktree from `7512a45`; 13/13 Phase 21/22 files matched the accepted original-worktree content ignoring checkout line endings. The unrelated API provider test and planning files were excluded.
- First full verify passed API 572/572 but stopped on Ruff formatting for two version lines; formatted only those files and reran from the beginning.
- Final local verify passed API 572, Board 185, Extension 190, packaged E2E 8, all lint/typecheck/build checks, and Windows/Release contracts.
- Built local v2.2.7 extension ZIP and self-contained installer; frozen runtime self-test passed and installer payload contained no Chrome extension. The user's existing installation was preserved, so authoritative install/start/uninstall smoke was delegated to clean Hosted CI.
- Explicitly staged 24 files and committed `931b4eb`; pushed `agent/v2.2.7`. GitHub App PR creation returned 403, then authenticated `gh` created draft PR #19.
- PR run `30843780159` passed in 21m12s, including real Windows install/start/uninstall smoke and both artifact uploads. PR #19 was marked Ready and squash-merged as `256c70dc52fcb5b0cd0fbfaf7382ba2834d087ef`.
- Final main push run `30845419827` passed in 24m52s with the same complete gate and smoke. Downloaded its two artifacts and verified extension manifest version 2.2.7.
- Created/pushed annotated tag `v2.2.7` at `256c70d` and published [ArchResearch 本地版 v2.2.7](https://github.com/jileyu2000/archresearch/releases/tag/v2.2.7), non-draft and non-prerelease.
- Formal GitHub assets: installer 70,082,901 bytes / `DB3B135DF4A6A87690FCAE3B16B13F01E3BA6C7095BA28B89718B445C78FD1C7`; extension ZIP 18,862 bytes / `EB27455944BEC200ECE8809CB8B9389EFFD76A82FBD17D3A38BC9ECA2530BD31`. Remote digests match the main CI files.
- Post-release SQLite `mode=ro`: project 96 Runs/0 active; installed 0 Runs/0 active. Original worktree modifications, `.artifacts/`, `.archresearch/`, and research data remain preserved.

# 2026-08-04 — Phase 24

- 用户报告小红书登录检查遇到安全验证后进入循环：验证页在完成前消失，检测持续新建小红书页面，最终始终不能确认登录。
- 已按交接顺序完整读取 `HANDOFF.md`、`AGENTS.md`，读取当前计划与 findings/progress 末尾，运行 planning catch-up、`git status --short --branch` 和 `git diff --stat`；既有 33 个跟踪修改及未跟踪组件全部保留。
- SQLite URI `mode=ro` 复核：项目库 96 条历史 Run/活动 0，安装版库 0 条/活动 0；未创建、重试、取消或修改 Research Run。
- 恢复阶段三次环境错误均发生在读取/查询前或命令解析层：PowerShell 变量提前展开、系统缺少 `sqlite3`、编排环境缺少 `btoa`；均已换用安全只读方法，没有修改产品或数据库。
- 当前唯一下一步：只读审计 Board 自动检测、API 会话检查与扩展受管标签关闭链路，先建立“验证码页保留且不重复开页”的行为红测。
- 根因确认：API 的扩展检查每次新建搜索标签，captcha 被内容层立即归为 `not_logged_in`，随后 `finally` 无条件关闭；Board 对所有非登录状态继续最多 20 次轮询，形成重复新建/关闭循环。App 外层自动恢复只启动一次，不是主要重复源。
- 选定最小合同：新增不含凭据的枚举状态 `verification_required`；API 在该状态保留并复用同一受管标签，Board 立即暂停自动轮询并提示完成安全验证后重新检测，普通登录自动检测与 fail-closed 保持。
- 下一步先只修改测试，取得 Extension 内容判定、API 标签复用和 Board 停止轮询三层 RED；生产代码仍未修改。
- 已只修改测试：Extension captcha 期望 `verification_required`；API 期望第一次保留验证标签、第二次复用并在登录后关闭；路由两次请求期望共享同一检查器；Board 期望安全验证状态停止 30 秒自动轮询且手动重新检测可转为就绪。
- 下一步运行三组定向测试，确认它们在 v2.2.7 旧生产实现上按预期失败；红灯成立前不修改生产代码。
- 三层 RED 已准确失败：Extension 实际 `not_logged_in`；API Pydantic 拒绝新枚举且路由退化为 `unknown`；Board 找不到安全验证标题。其他定向用例未被这些红测误伤。
- 当前进入最小生产实现：不增加通用浏览器命令，不读取页面敏感数据；只传播专属状态、缓存一个扩展 checker、保留/复用一个验证标签并暂停 Board 自动轮询。
- 最小实现已落入：Extension 内容层返回 `verification_required`；API checker 用锁保留/复用一个验证标签，路由复用同一 checker；非验证状态恢复原关闭行为。Board 传播新状态、停止恢复轮询、隐藏重复开登录按钮，并提示完成后重新检测。
- 下一步先重跑四个定向 RED；若转绿，再运行受影响文件的完整回归与 lint/typecheck/format。
- 四个定向 RED 全部转绿：Extension content 25/25；API 新增 2/2；Board 新行为 1/1。测试证明第一次安全验证不关闭标签、30 秒内不继续 API 轮询、不额外调用系统登录入口，手动重新检测复用标签并转为登录后关闭。
- 下一步运行受影响的 API 两文件、Board App/Home 与 Extension 全量单测，并并行执行对应 lint、format、typecheck；发现回归时只修复本阶段改动。
- 模块回归通过：API 51/51、Board App/Home 114/114、Extension 全量 190/190；API Ruff lint、Board/Extension lint 与 typecheck 全绿。唯一失败是 Ruff 要求机械格式化两个已改 API 源文件。
- 下一步只格式化 `browser.py` 与 `xiaohongshu.py`，再重跑 API 目标全集、Ruff format/lint 和 strict Mypy。
- Ruff 已仅机械格式化上述两个 API 源文件；没有触碰邻近文件或改变行为。下一步重跑 API 51 项、Ruff lint/format 与项目 strict Mypy。
- 格式化后 API 51/51 再次通过；四个改动 API/测试文件的 Ruff lint/format 全绿，strict Mypy 对 26 个源文件无问题。
- 下一步审查本阶段精确 diff 与并发/断连边界，再运行 Board/Extension production build、全 Board 单测和必要的 API 完整回归。
- 代码审查确认路由 checker 跨请求复用且锁保护并发；异常会清空缓存并 fail closed。增强 API 行为测试为“连续两次仍在安全验证时 open=1/close=0，第三次登录后才 close=1”，直接覆盖用户重复点击重新检测的边界。
- 下一步重跑增强测试与 format check；通过后执行整仓权威 `scripts/verify.ps1`（含完整 API/Board/Extension、构建与 packaged E2E）。
- 增强测试行为已通过，Ruff lint 通过；format check 只要求机械重排该新增测试函数。下一步仅格式化该测试文件后启动整仓 verify。
- 新增 API 测试已机械格式化。现在启动权威 `scripts/verify.ps1`；该门禁使用 mock Provider，不读取真实 Key，不创建 Research Run。
- 权威 `scripts/verify.ps1` 用时 246.9 秒并全绿：API 574、Board 186、Extension 190、packaged E2E 8；Ruff、64 文件 format、strict Mypy 26 源文件、ESLint、TypeScript、production builds、Windows/Release/Provider/security/process 合同全部通过。
- 收口 `git diff --check` 通过；工作区全部既有修改、未跟踪组件、`.artifacts/`、`.archresearch/` 和研究数据保持原位。SQLite `mode=ro` 仍为项目 96/活动 0、安装版 0/活动 0。
- Phase 24 本地开发完成但未发布，正式版本仍为 v2.2.7。当前唯一下一步是等待用户明确是否发布下一补丁；未获授权不 commit、push、PR、安装或发布。
- 最终恢复文件已同步：Phase 24 标记 complete，`HANDOFF.md` 明确本地修复未发布且 Windows 应用/扩展需同时更新；计划中无 `in_progress` 或 `proposed` 阶段。最终工作区状态保留全部既有修改，未跟踪组件仍在。

# 2026-08-04 — Phase 25

- 用户明确授权正式发布；目标版本确定为 v2.2.8，Windows 应用和独立 Chrome 扩展必须同时更新。
- 已重新加载 `planning-with-files` 与 `github:yeet` 规范并运行 catch-up；原工作区仍保留全部既有修改与未跟踪组件，没有 reset、checkout、clean 或研究数据操作。
- 发布提交范围限定为 Phase 24 的 10 个 API/Board/Extension 源码/测试文件，以及 v2.2.8 必需版本、CI artifact、README/文档和 Release 合同；四个交接文件不提交。
- 当前唯一下一步：核对 `gh` 版本/认证、远端默认分支、最新 main 与 v2.2.8 tag/Release 不冲突，然后做 Release 合同红测。
- GitHub 前提通过：`gh` 2.96.0，已认证 `jileyu2000`；仓库 `jileyu2000/archresearch`，默认分支 `main`。`origin/main=256c70dc`，正是 v2.2.7 合并基线。
- `agent/v2.2.8` 远端分支、`v2.2.8` tag/Release 和目标 worktree 路径均不存在；既有 v2.2.5/v2.2.6/v2.2.7 worktree 全部保留不动。
- 当前唯一下一步：把 Release 合同测试期望先提升为 2.2.8，运行红测确认旧 workflow/版本面被准确拦截。
- 原脏工作区的版本/Release 合同仍停在 v2.2.6，因为 v2.2.7 曾从隔离 worktree 发布且没有覆盖回原工作区；远端 main 才是正式 v2.2.7 基线。此次必须直接把确认发布面提升到 v2.2.8，并在新 worktree 与 main 比较，不能把原工作区旧版本号误当成产品回退。
- 已只把 Release 测试期望提升到 v2.2.8，生产 workflow、包版本和 README 尚未同步；下一步运行合同红测，预期准确失败在旧 artifact/版本面。
- Release 合同红测准确失败在旧 CI Windows artifact 名；现已同步所有确认发布面到 v2.2.8。下一步运行 Release/README 合同、旧版本残留扫描与 `git diff --check`。
- v2.2.8 Release/README 合同已转绿；受控发布文件中不再残留 2.2.6/2.2.7，`git diff --check` 通过（仅既有 Windows 换行提示）。
- 当前唯一下一步：在原工作区从头运行完整 `scripts/verify.ps1`；通过后再创建干净发布 worktree，交接记录与本地研究数据不进入产品提交。
- 首轮完整 verify 通过 API 574/574 和发布前置合同，随后仅因 `__init__.py`、`main.py` 的版本号行需 Ruff 机械格式化而停止；已只格式化这两个已改文件。
- 当前唯一下一步：从头重跑完整 verify，不能复用首轮部分结果。
- 第二轮权威 `scripts/verify.ps1` 用时 230.3 秒并全绿：API 574/574、Board 186/186、Extension 190/190、packaged E2E 8/8；Ruff、strict Mypy、ESLint、TypeScript、production builds、Windows/Release/Provider/security/process 合同全部通过。
- 当前唯一下一步：从 `origin/main=256c70dc` 创建隔离 `agent/v2.2.8` worktree，只带入 Phase 24 十个文件与十一项版本/发布文件。
- 已创建 `C:\Users\76384\Documents\archresearch-v2.2.8-release` / `agent/v2.2.8`，基线为 `256c70d`；使用 `apply_patch` 只落入 21 个白名单文件。
- 原工作区混合行尾导致普通 diff 误报整段换行；首次补丁在写入前被拒绝。改用 `--ignore-cr-at-eol` 生成语义补丁后成功，21/21 文件逐项 `git diff --no-index --ignore-cr-at-eol` 一致，worktree `git diff --check` 通过。
- 当前唯一下一步：在隔离 worktree 运行 setup 与完整 verify；不复用原工作区的 editable Python 环境。
- 隔离 setup 成功并绑定自身 editable Python 环境；首轮 verify 通过 API 574/574，只因 `apply_patch` 后 6 个 Python 文件存在混合行尾而在 Ruff format check 停下。
- 当前唯一下一步：仅机械格式化 `__init__.py`、`main.py`、`browser.py`、`xiaohongshu.py` 及两个对应测试，再从头重跑完整 verify。
- 6 个 Python 文件 Ruff 格式化后与原工作区逐项一致，定向 Ruff lint/format 与 `git diff --check` 通过。
- 隔离 worktree 第二轮权威 verify 用时 241.3 秒并全绿：API 574/574、Board 186/186、Extension 190/190、packaged E2E 8/8，以及所有 lint/typecheck/build/Windows/Release 合同。
- 当前唯一下一步：构建两个 v2.2.8 独立附件并执行本地产物结构与冻结程序自检。
- 本地扩展 ZIP 与 Windows 安装器构建成功；冻结运行时 `--self-test` 退出 0，ZIP 根 manifest 为 2.2.8，安装器输入负载未发现 `manifest.json/background.js/content.js/sidepanel.html/popup.html`。
- 本地产物：安装器 72,536,012 bytes / `A1DCA547BBE1C40838A8CE9AD3A6FD3E1C8F2A2F06BAF854A7B424CD178B87F9`；扩展 ZIP 18,880 bytes / `0262CF42A9339097A8A227C836AE7CFBA1055187FD920F9652616F7204ADFBB9`。
- verify 生成的 108 个 SVG 与 `samples.jsonl` 因 worktree 行尾策略显示修改；它们不是产品改动，将不暂存、不清理并保留在隔离 worktree。
- 当前唯一下一步：显式暂存并核对恰好 21 个发布文件，然后提交、推送与创建 draft PR。
- 已显式暂存并核对恰好 21 个白名单文件（232 additions/56 deletions）；staged `git diff --check` 通过，fixture、交接记录、artifacts 和研究数据均未暂存。
- 当前唯一下一步：提交并推送 `agent/v2.2.8`，再创建 draft PR。
- 21 文件已提交为 `66c37cc` 并推送 `agent/v2.2.8`。GitHub App 创建 PR 因 integration 403 失败，已用认证 `gh` 回退创建 draft PR #20：https://github.com/jileyu2000/archresearch/pull/20 。
- 当前唯一下一步：等待 PR Hosted CI 全绿并确认真实 Windows 安装/启动/卸载 smoke，再转 Ready 与 squash merge。
- PR run `30879655088` 首轮在完整门禁末段失败：API 574、Board 186、Extension 190、lint/typecheck/build 均绿；唯一失败是既有 lazy-media packaged E2E 首次枚举偶发返回空数组，后续打包/smoke 因此未执行。
- 本次 `operations.ts` diff 只拆分 captcha 状态，不触碰媒体枚举；单独 `--grep` 因测试前序 socket 依赖而无效，按真实文件顺序重跑完整 E2E 已 8/8 通过。GitHub App 重跑仍 403，当前只用 `gh` 重跑失败 job，不改产品代码。
- PR run `30879655088` attempt 2 用时 15m19s 全绿：完整门禁、独立扩展/安装器构建、真实 Windows 安装/启动/卸载 smoke 与两个附件上传均成功。
- 当前唯一下一步：将 PR #20 转 Ready 并 squash merge，再等待最终 main push CI。
- PR #20 已 Ready 并 squash merge 为 `b5223649f03f152a4b96d159da65c743832f542c`；`origin/main` 已更新，最终 push run `30881344666` 正在运行。
- 当前唯一下一步：等待最终 main CI 全绿，下载其 Windows 安装器与扩展附件并核对 digest。
- 最终 main push run `30881344666` 用时 21m19s 全绿：完整门禁、Windows 安装器/扩展构建、真实安装/启动/卸载 smoke 和两个附件上传全部成功。
- 已下载 main CI 文件：安装器 70,089,863 bytes / `B091208BF13B7E12D7A21770B7D56CE77EC1625266C2CC46DD55F6642209CBAD`；扩展 ZIP 18,878 bytes / `5BDD32F7C67C75641F56DE6756FF2631979063CEDC1474DE76A6F5356E817130`。
- 当前唯一下一步：创建 annotated `v2.2.8` tag 并发布这两个 CI 文件。
- annotated `v2.2.8` tag 已创建并推送；tag object `42520558` 解引用到合并提交 `b5223649f03f152a4b96d159da65c743832f542c`。
- 正式 [ArchResearch 本地版 v2.2.8](https://github.com/jileyu2000/archresearch/releases/tag/v2.2.8) 已发布，非草稿、非预发布；GitHub asset 名称、大小和服务器 digest 与 main CI 下载文件一致。
- 正式安装器：70,089,863 bytes / SHA-256 `B091208BF13B7E12D7A21770B7D56CE77EC1625266C2CC46DD55F6642209CBAD`；独立扩展 ZIP：18,878 bytes / SHA-256 `5BDD32F7C67C75641F56DE6756FF2631979063CEDC1474DE76A6F5356E817130`。
- 发布后 SQLite URI `mode=ro`：项目库 96 条历史 Run/活动 0，安装版库 0/活动 0；未读取凭据，未创建、重试、取消或修改 Research Run。
- Phase 25 完成。原工作区全部既有修改与未跟踪组件保持；隔离 worktree 的 CI 下载件、本地产物及 108 个 SVG + `samples.jsonl` 行尾变化也保留未清理。当前唯一下一步是等待用户下一项明确任务，不重做 v2.2.8。
- 用户准备开启新对话进行交接；已将 `HANDOFF.md` 的唯一下一步更新为竞赛提交材料准备。产品开发与 v2.2.8 发布不重做、不回滚。
- 下一阶段需要比赛通知/提交模板、组别、截止时间、字数、视频时长和附件格式；材料重点是产品功能、运作流程、用户价值、演示脚本和安装说明，不堆开发过程说明。
- 2026-08-06 Phase 26：复核确认 `App.tsx` 的视觉模式初始化 effect 会在未连接时调用登录恢复，触发 `open-chrome` 与 `open-xiaohongshu-login`。
- 已先添加红测；旧行为下 Board 测试捕获了 `/browser/open-chrome`，Hook 测试暴露了未连接时启动 20 轮登录轮询的问题。
- 已移除视觉模式初始化自动登录；未连接 Chrome 扩展时隐藏小红书登录入口，登录恢复 fail closed，不再自动连接或打开 Board。
- 已更新两个旧自动登录测试为显式点击登录；Board/App 与 `useBrowserReadiness` 定向回归 121/121 通过。待运行 lint、typecheck、build 与完整 Board 测试。
- 首轮 Board lint 发现删除 effect 后遗留的 `xiaohongshuLoginRecoveryActive` 未使用；已只移除该解构变量。
- 最终 Board 门禁全绿：15 个测试文件、188/188；ESLint、TypeScript typecheck、Vite 生产构建和 `git diff --check` 均通过。
- 本地开发 Board `http://127.0.0.1:5173/` 与 API `/health` 均返回 200。Phase 26 完成；未修改数据库、扩展、API 或研究 Run，未 commit/push/release。
- 2026-08-06 Phase 27：现场确认当前小红书搜索页有 20 个笔记链接、11 张有效可见封面，现有 DOM/URL 规则可识别；根因收敛为受管页面 loading 阶段已可枚举，但 API 两次固定时点均可能早于结果卡渲染。
- 已建立 Phase 27；下一步先用“前两次空枚举、第三次出现笔记卡”的 API 行为红测锁定修复边界，再增加有上限的结果就绪轮询。
- Phase 27 红测已确认旧实现两次枚举后返回空列表；现已在小红书搜索层加入最多 5 次、每次 1 秒的有效笔记结果轮询，已就绪时不增加等待，始终为空时有固定上限。
- Phase 27 验证完成：小红书测试 16/16、完整 API 测试全绿、Ruff、strict Mypy、diff check 全绿；扩展内容协议测试 25/25 全绿。未创建或重试 Research Run，正式 v2.2.8 尚未包含该补丁。

# 2026-08-07 — Phase 28

- 用户明确授权发布 `v2.2.9`；产品改动范围为 Phase 26 登录跳转修复与 Phase 27 小红书结果就绪轮询，Windows 安装器和 Chrome 扩展继续作为两个独立交付物。
- PR [#21](https://github.com/jileyu2000/archresearch/pull/21) 已合并，主分支提交 `97669e0b28b13260197628c08a29113317b964da`；PR CI `31115430369` 与手动主分支验证 run `31121126690` 均全绿。
- 主分支验证包含 API 576/576、Board 188/188、Extension 190/190、packaged E2E 8/8、Ruff、strict Mypy、ESLint、TypeScript、生产构建、Windows 安装/启动/卸载 smoke，以及两个附件上传。
- 从 run `31121126690` 下载并核验最终附件：`ArchResearch-Windows-x64-Setup-v2.2.9.exe` 为 70,137,821 bytes / SHA-256 `FA7DFE24CC8CD67E0DA3B46972148836D778FDAF9989C2CDE9199B264FF31AA`；`archresearch-chrome-extension-only-v2.2.9.zip` 为 18,878 bytes / SHA-256 `958FDCC09655181F096A40C712BD1069EF4915DE075CD4B6FD8B7B307B454715`。扩展根 manifest 版本为 2.2.9。
- 已创建并推送 annotated tag `v2.2.9`，验证解引用到 `97669e0b28b13260197628c08a29113317b964da`；正式 Release 已发布为非草稿、非预发布，GitHub asset digest 与本地 SHA-256 一致。
- 当前唯一下一步：用户重新安装 v2.2.9 并验证图纸灵感流程，然后继续整理竞赛演示视频和提交包。原始工作区、临时附件、fixture 行尾变化和真实研究数据均未清理或加入产品提交。

# 2026-08-07 — Phase 29 continuation

- 已重新读取 `HANDOFF.md`、`AGENTS.md`、活动阶段计划和 findings/progress 末尾，运行 planning catch-up；原始工作区既有修改、未跟踪组件和研究数据均保留。
- Chrome 诊断技能已按要求读取并连接到当前 Chrome；搜索页 URL 与失败查询一致。尝试接管/截图该搜索页时浏览器读取连续超时，之后只成功读取标签列表，没有修改页面、账号或登录状态。
- 源码核对确认：扩展执行失败不会伪装为空媒体；`XiaohongshuBrowserSearch.search()` 会把成功的 `{media: []}` 过滤为 0 条并写入 `completed/result_count=0`。下一步读取失败 Run 的非敏感 Trace 统计并建立媒体过滤边界红测。
- 公开无会话 HTTP 请求无法提供可用搜索结构；已先添加扩展内容层红测，覆盖“卡片有 8 个辅助链接、笔记链接位于第 9 个”的真实边界，生产修复尚未验证。
- 已完成红绿闭环：旧实现对超限卡片返回 `link_url=null`，新实现只从超限卡片中优先取 `/explore/`、`/discovery/item/`、`/search_result/` 路径；Extension 191/191、lint、typecheck 通过，尚未构建或发布新包。
- 再次尝试可见 DOM 读取仍超时；不再调用 Chrome 控制。下一步执行权威 `scripts/verify.ps1`，然后保留一个独立本地候选包供用户验证，不覆盖正式 v2.2.9。

# 2026-08-07 — Phase 29

- 用户反馈 v2.2.9 现场复测仍失败，并提供结果页截图：0 条可用参考，三个方向均为 0/3。
- 已恢复 HANDOFF、计划、findings/progress 和工作区状态；原工作区全部既有修改保持，未 reset、checkout、clean 或读取凭据。
- 已建立 Phase 29，诊断顺序改为最新 Run Trace → 当前 Chrome 受管页面 → Extension 枚举 → API URL/媒体过滤；不再直接增加固定等待时间。
- 当前唯一下一步：只读定位安装版端口、最新失败 Run 与当前 Chrome 搜索页状态，不创建或重试 Research Run。

# 2026-08-07 — Phase 29 candidate package

- 安装版 SQLite 只读 trace 已确认失败发生在小红书扩展搜索返回空媒体之后：三次搜索均为 `completed/result_count=0`，候选池、页面读取和图像分析均为 0。
- 已更新独立候选目录 `C:\Users\76384\Desktop\Archsearch\archresearch-chrome-extension-only-v2.2.10-candidate` 的 manifest 为 `2.2.10`，并生成 ZIP；ZIP SHA-256 为 `E62059828CD0A348138B7B02A72F6BD36DF25E66AAE4285719F08C897EA0CDD7`。
- 候选未覆盖正式 v2.2.9，也未提交、推送或发布；下一步由用户停用旧扩展、加载候选目录后复测一次图纸研究。
# 2026-08-07 — Phase 29 isolated live acceptance

- 新增忽略目录下的 `.artifacts/qa/live_xiaohongshu_harness.py`，只作为本轮隔离验收入口，不改产品运行代码；它注入 mock Provider/视觉分类器和真实扩展小红书搜索器。
- 已启动隔离 API `18072` 和 Board `15172`，健康检查分别为 JSON `status=ok/provider_mode=mock` 与 HTTP 200；数据库位于 `.artifacts/qa/phase29-live/archresearch.db`。
- Chrome 已打开隔离 Board，但 ArchResearch 扩展桥当前未连接；正式/隔离 API 均报告 `connected=false`。本轮尚未提交查询或创建 Run，下一步只读确认现有扩展加载状态并恢复候选扩展连接。
- 定向 API `54/54`、扩展 `54/54` 通过；Ruff check/format、strict Mypy、Extension lint/typecheck/build 全部通过。
- 完整 API 回归正常完成：`577 passed, 65 warnings in 211.57s`。警告来自 FastAPI/httpx 与 Python 3.12 SQLite 适配器，不影响退出码。
- 浏览器策略拒绝直接访问 `chrome-extension://.../popup.html`，因此不能代替用户重载/授权扩展；真实 Board→扩展→小红书流程仍未提交 Run，不能宣称修复已完成。

# 2026-08-07 — Phase 29 service recovery

- 用户反馈隔离入口打不开；只读端口检查确认 `15172`、`18072`、`9872` 当前均无监听，符合 Board/API 进程退出的现象。
- 本轮仅恢复隔离 API `18072` 与 Board `15172`，继续使用 mock Provider、隔离 SQLite 和真实扩展桥；正式安装版端口与研究数据不触碰。

# 2026-08-07 — Phase 29 live run after service recovery

- 隔离 Board 页面已刷新为正常首页，扩展桥连接成功；API 状态为 `connected=true`，小红书会话为 `logged_in/chrome_extension`。
- 已按验收查询创建真实隔离 Run `f49ef969-2e7a-4a8a-9e5f-3efcbcd933cd`。第一轮搜索返回 3 条并进入候选池，但三次笔记 inspecting 都是 `candidate_count=0`，第二方向搜索出现 `BrowserCommandError`，最终 `blocked/no_usable_assets`。
- 端口恢复已完成，但真实结果链路仍未通过；下一步定位笔记页面媒体提取命令与扩展内容脚本返回。
# 2026-08-07 — Phase 29 screenshot and service check

- 已读取用户截图：隔离 Board 当时为 `127.0.0.1:15172` `ERR_CONNECTION_REFUSED`。
- 只读复核后隔离 Board/API 已恢复，`15172`、`18072` 均在监听；Board `/`、API `/health` 和浏览器状态接口均返回 200。未修改正式 `9872`，当前正式端口未监听。
- 继续进入 Phase 29 的代码修复：先为“按搜索结果卡点击笔记再读取详情”补红测，旧实现仍应直达笔记并失败。
- 已完成红测并实现最小修复：API 为浏览器搜索结果缓存来源搜索页，详情读取通过 `open_xiaohongshu_note` 让扩展在搜索页按完整白名单链接点击；通用网页仍使用原 `open_url`。
- 定向门禁：API 小红书 18/18、专用 inspection opener 1/1；Extension 协议/内容/执行器 89/89，ESLint、TypeScript、Ruff 和 strict Mypy 通过。
- 全量门禁：API 全量测试通过；Extension 17 个测试文件 196/196，生产构建通过。尚未完成候选包现场复测。
- 补充 fail-closed 覆盖后，Extension 定向协议/内容/执行器测试为 91/91；扩展 lint、typecheck、build 与 API Ruff/strict Mypy 均再次通过。候选 ZIP 已同步最新构建。
- 真实验收预检未创建 Run：隔离 Board/API 为 200，API `connected=true`，但 `/v1/browser/xiaohongshu-session` 返回 `unknown/chrome_extension`；外部 Chrome Board 接管连续超时，不能替用户重载扩展管理页或授权候选扩展。
- 当前需用户动作：重新加载 `C:\Users\76384\Desktop\Archsearch\archresearch-chrome-extension-only-v2.2.10-candidate`，打开 `http://127.0.0.1:15172/?connect=chrome` 并完成网页读取授权；完成后继续真实 Run 验收。

# 2026-08-07 continuation

- 已按交接要求恢复 `HANDOFF.md`、根 `task_plan.md`、`findings.md`、`progress.md` 和工作树状态；未执行 reset、checkout 或清理。
- 用户最新截图确认隔离 Board `127.0.0.1:15172` 再次出现 `ERR_CONNECTION_REFUSED`。当前任务回到“服务可用性复现 + 真实图纸流程验收”，未把截图当作新的前端代码证据。
- 已读取候选扩展、详情点击修复和既有真实 Run 的交接记录；下一步检查端口/进程/启动日志，再复现最小服务启动链路。

# 2026-08-07 detail timing fix

- Chrome 当前隔离 Board/API 进程持续监听；HTTP Board、API health、browser status 均返回 200，API `connected=true`，但 XHS session POST 返回 `unknown/chrome_extension`，当前标签仍是安全限制页。
- 详情执行器红测复现：目标卡片首轮未渲染时旧实现立即失败；修复后同页重试测试通过。
- 扩展回归完成：`199/199`、ESLint、TypeScript typecheck、production build 全部通过。下一步同步 `v2.2.10` 候选包并继续隔离现场验收。

# 2026-08-07 candidate refresh

- 已用最新生产构建同步桌面候选目录，并将候选 manifest 保持为 `2.2.10`；正式 `v2.2.9` 未覆盖、未发布。
- 候选 ZIP 为 20,304 bytes，SHA-256 `634022A1469BAA5AF6B7FD854397E458C30E7BDBC9F7C70BD0856076132561BF`；background bundle SHA-256 `07E912ADA0E5FBFC4F413FE95F2909ABB1A94A2B64CDE2F7258649942C37A5F5`。

# 2026-08-07 final verification notes

- 连续 30 秒服务稳定性检查：隔离 Board `15172` 与 API `18072` 各 6/6 次返回 200；正式端口 `9872` 未监听、未触碰。
- `git diff --check` 通过。候选 bundle 中可检索到详情动作与“目标笔记不存在”重试逻辑。
- 打包 E2E 串行复验仍失败于静态页 `page_metadata` 返回 `ok=false` 和 FastAPI fixture 没有本地结果；这两条不涉及本次详情重试，已记录为当前 E2E 基线缺口。
- XHS session POST 当前返回 `unknown/chrome_extension`，Chrome 页面为小红书安全限制页；没有绕过安全验证，也没有创建新的真实 Run。

# 2026-08-07 repeated login recovery diagnosis

- 新增 Board Hook 红测，旧实现准确复现：一次登录恢复在 30 秒内调用 20 次 `checkXiaohongshuSession()`。
- 已移除 Board 登录恢复的 20 次定时循环；显式打开登录页后只发起一次恢复检测请求，扩展在同一受管标签内对 `unknown`/`not_logged_in` 最多重查 20 次，仍保留自动检测。
- 定向恢复/登录/安全验证测试 5/5、Board 全量 190/190、Extension 全量 200/200，两端 lint/typecheck/build 和 diff check 全部通过。
- 正式 v2.2.9 未覆盖或发布；桌面 `v2.2.10` 候选扩展已同步，ZIP SHA-256 为 `80A3F3CA9246D142164956261FCD65B17A843839737030B007C836A834B690B8`；未创建、重试、取消或修改 Research Run。
# 2026-08-07 — login launcher and session recovery fix

- 从实际 Chrome 标签复现：点击 Board 的“再次打开小红书登录”一次后新增的是带 `attempt` 的 Board；根因不是 Board Hook，而是隔离 `.artifacts/qa/live_xiaohongshu_harness.py` 的 `launch_isolated_board(_url)` 无条件调用 Board launcher，已改为按固定小红书 URL 分流。
- 重启隔离 API `18072` 后，Board `15172` → API `18072` 真实单击复测通过：新增小红书登录页和检测页，没有新增 Board。正式 `9872` 未触碰。
- 读取当前 Chrome 可见页面确认小红书登录页和搜索页均有“我”入口与用户 profile 链接；旧扩展 session API 仍约 8.6 秒返回 `unknown`，证实当前加载的是旧包。
- 先补红测：`ChromeBrowserPort` 在小红书 session 状态命令首次无内容接收端时旧实现直接失败；修复为将 `xiaohongshu_session_status` 纳入只读重注入恢复。定向测试由失败转为 `29/29`。
- 扩展全量门禁：`201/201`、lint、typecheck、production build 全部通过。
- 已同步独立候选目录并重打包：`C:\Users\76384\Desktop\Archsearch\archresearch-chrome-extension-only-v2.2.10-candidate.zip`；manifest `2.2.10`，ZIP SHA-256 `BFE11B6D126779E602F7DA576105D54E3554BF29C8A2A2343A081A93B1E9A51`，background SHA-256 `C1E8D6AF5AF6E7D2057919A2654D60414779A4A18E2CACEF59A7776F755B5718`。
- 当前阻塞不是代码：Chrome 扩展管理页重载候选属于扩展安装/重载 UI 操作，未获得本轮明确确认，因此未代用户执行。候选重载并刷新隔离 Board 后，才能完成新扩展的真实 `logged_in/chrome_extension` 和图纸 Run 验收。
- 已清理本轮复现产生的手动搜索页和错误新增 Board，保留原有 Board、扩展管理页和小红书登录页供用户继续操作。

# 2026-08-07 — current live recheck

- 重新读取项目交接、计划、发现和进度文件；未 reset、checkout、clean 或覆盖用户既有修改。
- 现场检查：隔离 Board/API `15172/18072` 正常，`connected=true`；正式端口 `9872` 未监听。
- Chrome 页面证据显示小红书会话已登录，但 session API 仍返回 `unknown/chrome_extension`；真实单击“再次打开小红书登录”前后标签列表无变化，没有新增 Board。
- 发现候选扩展为 `2.2.10`，工作区源码 manifest 为 `2.2.8`；下一步核实实际加载的扩展包与通信恢复，再决定是否需要最小代码变更。
- 使用完整 Chrome 标签列表复核后，确认真实点击新增的是小红书登录页，不是 Board；旧 Board 标签是此前错误调度的遗留页。下一步只读检查已经打开的扩展管理页。
- 候选包静态核对通过：候选 `assets/background.js` 含 `xiaohongshu_session_status` 与重注入逻辑，SHA-256 与刚刚生产构建的 `apps/extension/dist/assets/background.js` 均为 `C1E8D6AF5AF6E7D2057919A2654D60414779A4A18E2CACEF59A7776F755B5718`。
- 回归验证通过：Extension `201/201`，lint、TypeScript typecheck、production build；API 浏览器/小红书定向测试全部通过，`git diff --check` 通过。
- 最终现场阻塞仍是 Chrome 扩展管理页未能由当前浏览器控制接口代为重载；当前 session API 仍为 `unknown/chrome_extension`，不能把它报告为代码修复后的失败。

# 2026-08-07 — safety verification regression

- 用户报告候选扩展遇到安全验证时直接刷新；恢复 Chrome 现场后只发现 Board，验证码页已丢失，Board 状态为 `unknown`。
- 本轮成功标准改为：验证码导航一旦出现，停止自动检测，保留同一标签供用户验证；验证完成后只由用户点击“重新检测”恢复。
- Chrome 控制模块首次使用了错误子目录，已定位插件根目录入口并成功恢复；未触碰页面数据或登录信息。
- 单次真实“重新检测”观察到两次验证码标签：第一次在约 250ms 出现，第二次约 3.75s 出现；约 20s 后两页都不在 Chrome 中，Board 为 `unknown`。证据确认存在重复 checker 与验证码 URL 未及时优先识别两层问题。
- 下一步先写 Extension 执行器与 API router 红测，旧实现必须失败；修复后再运行扩展/API/Board 回归并重启隔离服务验证验证页保留。
- 红测准确失败后已完成两层修复：扩展在每次 session 内容命令前优先识别 captcha URL；API 对同一 `XiaohongshuBrowserSearch` 不再重复执行第二轮检测。
- 定向红测转绿；Extension `203/203`、Board `190/190`、API 浏览器/小红书定向测试、两端 lint/typecheck/build、Ruff、strict Mypy 全部通过。
- API 全量测试最终 `580/580` 通过；格式化 `browser.py` 后定向 API、Ruff check/format、strict Mypy 与 diff check 再次通过。
- 隔离 API `18072` 已重启并由新源码监听，`/health` 正常、`connected=true`；正式安装端口未触碰。
- 最新 `v2.2.10` 候选 ZIP 已重建并读取 ZIP 内 manifest 复核，SHA-256 `1126A1C73F9D8FF7A534A368D579D43CDE9FD92662E84EE03E085E984179E1AE`。真实验证码保留验收等待用户重载扩展。

# 2026-08-07 — Phase 31 foreground Xiaohongshu candidate

- 用户已重载上一版 `v2.2.10` 候选后，唯一 session 现场仍返回 `unknown/chrome_extension`；标签时序显示小红书搜索页以后台标签打开并持续到超时回收，未新增 Board 或验证码。
- 红测先失败后转绿：普通网页仍 `active=false`；小红书搜索和笔记详情改为 `active=true`，以支持小红书前台渲染动态登录壳和结果卡。
- Extension `206/206`、Board `190/190`、API 浏览器/小红书 `56/56`、lint、typecheck、生产构建、diff check 全部通过。
- 已同步新候选：`C:\Users\76384\Desktop\Archsearch\archresearch-chrome-extension-only-v2.2.10-candidate.zip`；manifest `2.2.10`、12 文件、20,479 bytes、ZIP SHA-256 `A49AB175C11401070D8FA5723650CB83214B8D8D2EA815E0DF30A65DD138D2F5`，background SHA-256 `29579B7D5F4AF4BDD0A8FAE3FE3ACD8FEF6CDC57B48FA1D4D140D32F9DA8C2E9`。
- 当前未创建、重试、取消或修改 Research Run；正式 `v2.2.9` 未覆盖或发布。等待用户重载新候选后做一次登录检测，成功再做一次完整图纸研究。

# 2026-08-07 — live captcha hold passed, post-scan recovery failed

- 用户已重载候选扩展。外部 Chrome 现场只触发一次“重新检测”，只创建一个安全验证标签；Board 最终为 `verification_required`，没有重复打开、刷新或关闭验证码页。
- 未操作或尝试绕过验证码；Board 与验证码页均作为 handoff 保留给用户。
- 用户完成扫码后反馈“小红书连接不上，一直检测不到”。已停止继续点击检测，先恢复项目计划并转入扫码后会话恢复的只读诊断。
- 当前未修改生产代码、未创建或重试 Research Run、未读取凭据或浏览器存储。
- 只读接管扫码后的 Board 与小红书首页：小红书可见 DOM 有“我”和 profile 链接，登录真实成功；Board 仍为 unknown。下一步读取 session API 响应/耗时与隔离服务日志。
- Session API 只读探针耗时 3838 ms，返回 `unknown/chrome_extension`；Board 无页面日志错误。已停止继续触发现场检测，转为源码与行为测试审计。
- 完成唯一一次并发标签时序探针：搜索标签成功加载，约 4.1 秒 API 返回 unknown 并关闭；没有验证码或重复标签。结论转为内容命令异常被 API 吞并非 DOM 返回 unknown。
- 新增扩展适配层红测，旧实现 29/30：补注入第一次遇到导航中的 `Document is not ready` 时直接失败。已开始最小修复，仅在既有 5 秒上限内重试只读内容脚本注入。
- 最小修复后定向 30/30、Extension 204/204、Board 190/190、API 浏览器/小红书 56/56 全绿；Extension lint、typecheck、build 全绿。下一步同步独立 v2.2.10 候选并做真实登录复测。
- 已同步候选目录并重打 ZIP：manifest `2.2.10`、12 文件、20,500 bytes，ZIP SHA-256 `5DF577E2B942D54BA47528D385D2F8819CAD0F334F0AFAD31248B0E842F9E33D`；background SHA-256 `07D2B0E48FC4D8AE1BC126CBB8D4C1DFE8A9199FB29897B71B1E6F04318DD71C`。正式 v2.2.9 未覆盖或发布。
- 用户重载后唯一一次真实复测仍为 3966 ms `unknown/chrome_extension`；未创建验证码或 Board，搜索标签约 4.18 秒被关闭。适配层补注入重试未改变现场行为，将撤销而不继续叠加。
- 已撤销未通过现场的适配层补注入重试及其测试。新增执行器两条红测，旧实现 2 项准确失败；生产修复只把瞬时 session 内容命令异常纳入既有同标签有限复检，验证码 URL 优先检查保持。
- 新执行器修复门禁：Executor 26/26、Extension 205/205、Board 190/190、API 定向 56/56、Extension lint/typecheck/build 全绿。准备覆盖同一 v2.2.10 候选目录；旧 `5DF577...` ZIP 作废。
- 最新候选已覆盖：manifest `2.2.10`、12 文件、20,476 bytes；ZIP SHA-256 `B438562A5BDBFF97CCDC8A703AAAA9EC3DCF16EEB48E935A6A727015B74822B7`，background SHA-256 `61D960D004EBE620A5A2F291490058829003EDDC0E8E6EE3C30B5814A01C5601`，与 dist 完全一致。等待用户再次重载后做唯一 session 现场验收。

# 2026-08-07 — diagnostic candidate preparation

- 完整恢复 `HANDOFF.md`、`AGENTS.md`、活动计划、findings/progress 与工作区状态；未 reset、checkout、clean 或触碰正式 v2.2.9。
- 重跑错误分类红测确认旧实现为 3 failed / 49 passed；实现内容脚本注入、消息不可用、内容操作拒绝和命令超时的安全分类，并让 WebSocket 只返回有限错误码。
- 扩展定向测试 52/52、全量 209/209、ESLint、TypeScript、QA harness `py_compile` 与 `git diff --check` 通过。
- 首次 typecheck 因类型守卫不够具体失败一次；改为类型谓词后通过，未重复原失败实现。
- 下一步构建扩展并覆盖桌面同一 `v2.2.10-candidate`，重启隔离 QA API 以加载记录器；用户重载后只运行一次 session 探针。

- 扩展 production build 通过；桌面候选已覆盖并重打 ZIP：20,714 bytes、SHA-256 `AE70C064DB1931E05A5CD98049A193C843FFC0B71E3E5198FCD73510A6F3E4D7`，background SHA-256 `439A0A4491005EC00509E32DC4F07A7DD169AE8AC2C44A19C4B44A9305988A02`，content SHA-256 `9D3ED6DD1BC1D06008DF34E1A0556C017BFB272B9ADF3C7457FFF8E3A7525120`；ZIP 内 manifest `2.2.10`、12 文件。
- 隔离 QA API 精确停止 PID 41560 后，首次误用无 `uvicorn` 的 runtime Python，未能启动；随后按项目既有记录改用 `apps/api/.venv`，`18072 /health` 恢复 `ok/mock`。Board `15172` 仍为 200，正式 `9872` 未监听。
- API 重启后扩展当前 `connected=false`，这是新候选尚未重载/Board 尚未刷新时的预期阻塞；没有执行 session 探针或创建 Research Run。

- 用户确认重载后，系统 Chrome Board 实际停在无 `connect=chrome` 参数的根 URL；复用原标签恢复连接，API 状态转为 `connected=true`。
- 唯一一次诊断 session 已完成：24,337ms、`unknown/chrome_extension`，QA 精确记录 `error_code=content_message_unavailable`。没有第二次检测、验证码或新增 Board。
- 下一步为该错误建立内容监听器/documentId 生命周期红测，并撤销未获现场支持的小红书前台开页改动；成功标准仍是现场 `logged_in/chrome_extension` 后再跑完整图纸研究。

- 检查 production bundle 确认 `content.js` 含静态 `import "./protocol.js"`；新增真实 Vite build 红测，旧实现 1/1 准确失败。
- 将小红书 note URL 校验移到 content 专属模块，避免 background/content 共享 chunk；撤销两个 `active=true` 前台开页改动。构建红测及相关测试 122/122 转绿。
- Extension 全量 210/210、ESLint、TypeScript、production build、diff check 通过。packaged E2E 首轮 6 项通过、1 项仅因旧错误码断言失败；更新为安全分类后完整 8/8 通过。
- 同一桌面候选已覆盖：ZIP 22,329 bytes / SHA-256 `71FF6FFEC100C150C0858F77A9AA5B9C2B5E11590E7EA69FD21D9484FE9E2A9B`，manifest `2.2.10`、12 文件，content 自包含。
- 尝试接管已打开的 `chrome://extensions` 自动重载被 Chrome 内部页策略拒绝；保留现有 Board 作为 handoff。下一步仅需用户手动重载同一候选目录，随后做一次 session 真实验收。

- 用户重载根因修复候选后，session 真实验收通过：`logged_in/chrome_extension`，4,243ms，无验证码、重复标签或 Board。
- 创建隔离图纸 Run `b9bb962a-67e1-4d8a-afec-0efdea37f373`；Run 完整走过三个方向但最终 `blocked/visual_budget_exhausted`，结果、Board 选中项与候选均为 0。
- Trace 证明 3 个搜索动作都成功、无浏览器异常，但 `result_count=0`；失败进一步收敛到搜索页 enumerate/link association。
- 两种 Chrome DOM 读取均超时，未重复第三次。下一步扩展 QA recorder 的安全媒体计数并提供单次搜索探针，不创建新 Run。
# 2026-08-07 — Phase 32 media enumeration diagnosis

- 收到用户“已重载”后，仅运行一次隔离搜索探针；未创建 Research Run，未触碰正式 `v2.2.9` 或端口 `9872`。
- 探针确认扩展连接和小红书登录态正常，但搜索页连续媒体枚举均为 0。
- 下一步按 RED→GREEN：读取现有枚举合同，为新版结果卡媒体表示补失败测试，再实施最小生产修复。
- Chrome 只读 DOM 统计和截图均超时，已停止重复此路径并记录错误。
- Executor 红测准确得到 2 failed / 26 passed；最小修复后 28/28 通过。普通网页及小红书登录入口仍后台，只有图纸研究搜索和详情搜索页前台渲染。
- Extension 全量 211/211、lint、typecheck、生产构建、packaged E2E 8/8 全绿。
- 最新候选已覆盖并重打 ZIP：manifest `2.2.10`、11 文件、20,131 bytes、SHA-256 `64ED320256FEC5D777748D8C1AAC9DF7570DBA193BB755A5AF57456B92B21FD5`；正式 `v2.2.9` 未修改或发布。
- 当前唯一下一步：用户在 `chrome://extensions` 对同一候选目录点击一次“重新加载”，随后运行一次搜索探针；探针非零后再创建唯一完整图纸 Run。
- 用户重载后单次搜索探针通过：`source_count=3`，媒体统计由修复前连续 0 变为首轮 12/12、滚动后 15/15；下一步创建唯一隔离图纸 Run 并验证 Board。
- 已创建唯一隔离 Run `e45719b0-5d05-4815-99db-17e262666e6b`；约 71 秒后自然终止为 `partial/visual_budget_exhausted`，但 3/3 方向全部覆盖，保留 9 个可用参考和 4 个帖子来源。
- 9/9 本地 PNG 内容端点返回 200；Trace 39 个事件、浏览器失败 0，实际执行 3 次搜索、12 次详情检视和 24 次视觉检查。
- Board 刷新后打开最新同名 Run，实际显示“4 篇帖子 · 9 张灵感图”、三个方向、6 个帖子分组；0 个失败占位、0 个控制台错误。Phase 31/32 现场验收完成。
- 当前唯一下一步：等待用户明确是否正式发布 `v2.2.10`。正式 `v2.2.9` 未修改，未 commit、push、PR 或发布。

# 2026-08-07 — reopen visual quality acceptance

- 按项目恢复顺序完整读取 `HANDOFF.md`、`AGENTS.md`、活动计划与 findings/progress 末尾，并核对工作树；未 reset、checkout、clean 或覆盖用户修改。
- 查看用户截图和 Run `e45719b0-5d05-4815-99db-17e262666e6b` 的 9 个本地 PNG，确认 0/9 是可用图纸素材。
- 撤销“Phase 32 已完成、候选可发布”的计划结论，新增 Phase 33 作为活动阶段；成功标准改为逐张内容验收。
- 首次四文件规划补丁因 `findings.md` 锚点不匹配而整体未应用；已改为按文件实际末尾分别更新，未造成部分写入。
- 本轮尚未修改生产代码、测试、候选目录或正式 `v2.2.9`，未创建/重试 Research Run，未 commit、push、PR 或发布。
- 下一步：审计扩展媒体元素/region、截图激活与坐标链路、API 视觉分类输入；先写能稳定复现空白、页面 UI 和坐标失效的行为红测。
- 已完成首轮只读链路审计：`operations.ts`、`browser-command-executor.ts`、`chrome-browser-port.ts`、`inspection.py` 及相关内容/截图测试。
- 本地 API 只读查询确认 9 个结果均有具体 XHS CDN `image_url`，并通过内容 SHA-256 映射到 9 个坏截图；没有修改 Run 或下载外部凭据。
- 一次 PowerShell 资产映射命令因在 `foreach` 后直接接管道产生解析错误；改为先收集 `$rows` 再排序，第二种写法成功，未重复原失败命令。
- 当前最强根因组合：详情页候选范围过宽 + region 缺少稳定媒体身份 + 截图前页面状态可能变化。下一步先补扩展行为红测，不先改生产代码。
- 已将 9 个结果的 XHS CDN 直链无凭据下载到 `.artifacts/qa/phase33-direct-probe/` 并逐张检查；4 张是正确完整图纸，5 张是弹层外无关页面图片。
- 按 Chrome 控制 skill 复用现有搜索标签做只读 DOM 检查；DOM snapshot 与可见 DOM 各超时一次，未刷新、未重复开页、未点击帖子，已停止该诊断路径。
- 修复范围现已明确为两层：XHS note-detail 只保留实际未被遮挡的图片媒体；这些候选优先保存受限 `*.xhscdn.com` 原图，普通网页继续使用 region 截图。
- 新增内容层与 API 行为红测：旧实现 Extension 1 项准确失败；API 在修正测试 fixture 后 2 项准确失败。
- 完成最小实现并转绿：XHS note-detail 遮挡过滤 + 受限 CDN 原图下载；非批准主机保留原截图路径。
- 回归完成：Extension 212/212、lint、typecheck、production build；API 582/582、Ruff、format、strict Mypy；packaged E2E 8/8；diff check 通过。
- 生产下载器真实无凭据探针通过：24,612 bytes、WEBP、585×966。
- 桌面候选目录已只更新新 `content.js`，哈希 `BAA18814...A083`；另生成 phase33 ZIP，20,361 bytes、SHA-256 `79B60463...07536`，旧候选 ZIP 不作为本阶段产物。
- 首次合并停止/启动 QA API 的复杂命令被策略拒绝；随后精确停止 PID 25176，分步隐藏启动 18072，健康检查恢复 `ok/mock`，正式端口未触碰。
- 当前扩展桥在 API 重启后为 `connected=false`。下一步由用户手动重载同一候选目录并刷新 Board；随后只跑一次 session 与一条隔离 Run，逐张检查 PNG。

# 2026-08-07 — Phase 33 post-reload live acceptance

- 按恢复合同完整读取 `HANDOFF.md`、`AGENTS.md`、Phase 33、近期 `findings.md`/`progress.md`，并核对 `git status --short` 与 `git diff --stat`；保留全部用户工作树修改。
- 首个计划片段读取命令因 PowerShell 嵌套引号失败一次；改用单引号和精确行号完成只读恢复，未触碰生产代码。
- 使用 Chrome 控制复用现有 Board 标签，导航至 `http://127.0.0.1:15172/?connect=chrome`；未新建 Board、未触发小红书登录检测、未创建 Research Run。
- `GET /health` 返回 `ok/mock`；`GET /v1/browser/status` 返回 `connected=true`、`xiaohongshu_search_available=true`。
- 当前唯一下一步：执行一次 `POST /v1/browser/xiaohongshu-session`，按返回状态决定继续 Run、保留验证码页或停止诊断。
- 已执行且只执行一次 `POST /v1/browser/xiaohongshu-session`：4,779 ms 返回 `logged_in/chrome_extension`；未出现验证码、重复小红书页或新 Board。
- 当前唯一下一步：创建一条新的隔离图纸研究，等待自然终止并定位最终本地 PNG 做逐张内容验收。
- 已读取本地 OpenAPI 与工作区列表，确认创建参数和默认工作区；近期 Run 全部为 `partial/blocked/completed`，没有活动租约。
- 已创建且只创建一条新隔离 Run `6e9ef544-b8af-4086-abd9-f392bf2c76ed`；HTTP 201，初始状态 `created`。未重试、取消或创建并行任务。
- 等待该 Run 自然终止：最终为 `partial/visual_budget_exhausted`，6 个结果、4/4 子方向覆盖；未重试或取消。
- 已读取 Run、Results、Trace 与 Board：浏览器检视无异常，6 个候选均有本地内容。下一步定位并逐张打开实际 PNG，不以 API 数量判定通过。
- 已在隔离数据目录定位 6 个候选 PNG。首次默认 `rg --files` 因忽略规则无结果，改用 `--hidden --no-ignore` 成功；未写入或复制图片。
- 已完成 Rank 0–1 原图人工验收：2/2 为完整、清晰的剖面表达，没有小红书页面 UI、遮罩或错误局部裁剪；均判定合格。
- 已完成 Rank 2–3 原图人工验收：2/2 为完整的功能图/拼贴剖面合集，无网页 UI、遮罩或错误裁切；累计 4/4 合格。
- 已完成 Rank 4–5 原图人工验收：Rank 4 合格；Rank 5 为完整但不相关的黑白室内效果图/封面，不是图纸，判定失败。最终 5/6 合格，Phase 33 未完成。
- 下一步按 RED→GREEN 审计 visual classifier/结果接纳边界，为 `photograph` 不得进入图纸灵感结果建立行为红测，再做最小修复并重新跑完整现场验收。
- 已完成只读源码审计：类型 mismatch 过滤仅存在于 OpenCLI 下载分支，Chrome/browser 分支缺失。下一步先增加 browser 路径红测，旧实现应持久化 photograph 并准确失败。
- 首版红测因页面预算过小没有触发浏览器检视，属于无效假绿；已增加路径前置断言并调整为代表性预算。修正后测试准确失败：旧实现持久化 6 个 photograph。
- 下一步只修改 workflow 的已证实边界：让 Chrome/browser 分支在持久化前执行与 OpenCLI 分支一致的 requested drawing type 过滤，并删除被拒绝项的本地 PNG。
- 已实现共享 requested drawing type 过滤；新增 browser 行为测试由失败（持久化 6 个 photograph）转为通过（0 个资产、0 个残留 PNG）。
- 下一步运行相关类型过滤、XHS 原图保存、extension browser workflow 回归，再执行 API 全量测试、Ruff、format 与 strict Mypy。
- Ruff format check 首轮要求格式化 `workflow.py`，已机械格式化。检查时发现宽泛测试补丁误改两个既有预算，已精确恢复。
- 相关回归最终 8/8 通过。下一步重新运行 API 全量测试、Ruff check/format check、strict Mypy 和 `git diff --check`。
- API 全量 583/583、Ruff check、Ruff format check、strict Mypy、`git diff --check` 全部通过。
- 下一步精确识别并重启隔离 QA API `18072`，刷新既有 Board 恢复扩展桥；正式端口 `9872` 不触碰。
- 已核对 18072 原进程确为 `live_xiaohongshu_harness:app` 后精确停止 PID 28264；首次组合启动命令被策略拒绝，拆分后新 PID 5196 健康监听 18072。
- Board 15172 未中断，正式 9872 未监听。下一步刷新既有 `?connect=chrome` Board 恢复扩展桥，然后仅执行一次 session 检测和唯一一次新 Run。
- 已复用现有 Board 标签导航回 `?connect=chrome`；`GET /v1/browser/status` 返回 `connected=true`、`xiaohongshu_search_available=true`。未新建 Board 或登录标签。
- 已执行本轮唯一 session POST：5,266 ms 返回 `logged_in/chrome_extension`。
- 已创建唯一复验 Run `ad270123-244e-4295-98c7-cef6c7bd7f86`，HTTP 201，初始状态 `created`；未并行创建或重试。
- 复验 Run 自然结束为 `blocked/visual_budget_exhausted`、0 结果。Trace/QA events 显示 4 个搜索方向均枚举 0 个媒体，未进入详情分类；不归因于本轮类型过滤。
- Chrome 标签列表无验证码或新 Board；旧 XHS 搜索页截图调用超时并重置控制会话，已停止重复该路径。
- 下一步仅执行一次 `/qa/xiaohongshu-search` 探针；探针非零前不创建第三条 Run。
- 单次 `/qa/xiaohongshu-search` 探针返回 `source_count=0`；确认搜索枚举问题持续存在。
- 下一步做一次替代诊断：探针运行期间只读取 Chrome 标签 URL/标题时序，确认是否自动进入 `type=51`、安全限制或空搜索壳；不创建 Run。
- 用户重载后已完成且只完成一次带观察搜索探针：新标签 `1497398334` 由 `about:blank` → 无 `type` 搜索 URL → 约 1.88 秒稳定为 `type=51`，没有验证码、登录页或新 Board；13,050 ms 后仍为 `source_count=0` 并正常关闭。
- 当前已排除搜索 URL 未进入笔记模式。下一步只读核对该标签的 QA 命令事件与激活/枚举时序，继续区分前台渲染失败、空搜索壳或页面限制；不创建新 Run，不直接改 URL/选择器。
- QA events 已确认同一新标签 10 次媒体枚举均为 0 且无命令错误；源码确认该 URL 按 `active=true` 创建。Chrome 控制尝试取得该现有 XHS 标签绑定仍超时并重置控制内核，和历史失败一致，已停止重复页面接管。
- 仅修改忽略目录中的隔离 QA harness，新增安全页面状态探针；`py_compile` 通过。下一步精确重启 `18072` 加载该诊断端点，恢复扩展桥后只运行一次状态探针；正式 `9872` 和产品代码不触碰。
- 隔离 API 首次重启误用无 `uvicorn` 的 runtime Python而未启动；读取 stderr 后改用项目 `apps/api/.venv`，服务恢复 `ok/mock`、`connected=true`。正式端口未触碰。
- 首版状态探针因误用 API 未枚举的 `viewport_metrics` 返回 500；删除该诊断动作后完整通过。真实页面为 `logged_in`、正常 `type=51` URL/标题、metadata 可读，但 media 仍为 0，排除敏感页拦截。
- 第二次安全探针增加 `page_snapshot` 计数：0 个可见文本块、0 个媒体，未发现登录、验证码、空状态或网络错误文本信号。
- 最终通过 QA `preserve=true` 保留新标签 `1497398350`，供用户不刷新地目视确认实际页面。当前 API PID `37204`、18072 `ok/mock`、扩展桥已连接；不创建新 Run、不改产品代码。
- 用户截图确认保留页是正常完整的图片瀑布流。为区分加载时长与窗口状态，新建同会话受管标签 `1497398354`：3.5 秒首次枚举即为 12/12，等待 30 秒后仍为 12/12，并已自动关闭。
- 结论：不是 13 秒等待不足，也不是 `type=51`、登录、敏感页或媒体筛选问题；人工打开/恢复 Chrome 窗口后枚举立即恢复。下一步按 RED→GREEN 为 XHS 图纸研究标签补“恢复并聚焦宿主 Chrome 窗口”合同，普通网页和登录入口不变。
- 窗口恢复红测旧实现准确 1 项失败；最小修复只在 `active=true` 研究标签创建后恢复 minimized 窗口并聚焦，随后才导航。后台普通网页与小红书登录入口不触发窗口更新。
- 首轮并行静态检查暴露两个类型夹具问题：窗口状态需按 Chrome 枚举类型传入，背景入口测试桩缺少 `windows`；修正后定向 63/63、lint、typecheck 全绿。
- Extension 全量 214/214、production build、packaged MV3 E2E 8/8、diff check 全绿。
- 已更新同一候选目录的 `assets/background.js` 并生成 `archresearch-chrome-extension-only-v2.2.10-phase33-windowfocus-candidate.zip`：20,459 bytes、SHA-256 `6A22C9F48A5650FCBF07306A2FF474DA9447E2CE6E958E75916F6BE632084C6E`，ZIP/目录 manifest 均为 2.2.10、11 文件。当前 API PID 49136、Board PID 39772、扩展桥已连接，正式 9872 未监听。

# 2026-08-07 — Phase 33 final PNG acceptance continuation

- 用户重载后完成单次无人工前台干预的搜索探针：4,996 ms，`source_count=3`，首次枚举 11/11、滚动后 16/16，标签正常关闭。
- 已创建且只创建 Run `50f90fc6-dae0-4d80-bc4f-0f1f72e65b87`；自然终止为 `partial/visual_budget_exhausted`，7 个结果、7 个项目、4/4 方向覆盖，未重试、取消或创建并行任务。
- 恢复会话后重新读取 `HANDOFF.md`、`AGENTS.md`、Phase 33 与 planning 文件末尾，运行 session catchup、`git status --short` 和 `git diff --stat`；保留全部用户工作树状态。
- 隔离 API 当前为 `ok/mock`，扩展桥 `connected=true`；API Run、Results、Trace 与 Board 已只读复核，7 个 PNG 均已在最新 Run 候选目录定位。
- 当前只做 7 张 PNG 的 rank 映射和原图人工验收；不创建新 Run、不改代码、不触碰正式 `v2.2.9`、不发布 `v2.2.10`。
- 已完成 Rank 0–1 原图检查：Rank 0 合格；Rank 1 类型和清晰度正确，但右/下边界截断主体与说明文字，完整性暂存疑。继续检查剩余 5 张后统一作严格结论。
- 已完成 Rank 2–3 原图检查：两张均为清晰完整的图解/拼贴剖面集合，没有网页 UI、遮罩、正文评论面板或错误裁切，均合格。当前确定 3 张合格、1 张完整性待定。
- 已完成 Rank 4–5 原图检查：两张均为完整且方向匹配的图解/渲染剖面，未混入网页页面层或 photograph，均合格。当前确定 5 张合格、Rank 1 待最终完整性判断、Rank 6 尚未检查。
- 已完成 Rank 6 原图检查：为完整的景观剖面拼贴，方向匹配且无网页 UI、遮罩或错误裁切，判定合格。
- 结合用户小红书搜索页截图确认 Rank 1 的边缘构图来自原始帖子卡片，不是 ArchResearch 二次裁切；作为线稿细节研究清晰有效，最终判定合格。
- 最新 Run `50f90fc6-dae0-4d80-bc4f-0f1f72e65b87` 的 7 张 PNG 最终 7/7 合格；Phase 33 已完成。未创建额外 Run，未改生产代码，未 commit、push、PR 或发布。

# 2026-08-07 — Phase 34 architecture live regression

- 用户询问 Phase 33 是否影响建筑研究；只读检查确认三项修复均受图纸灵感/XHS 边界约束。
- 补跑建筑研究专项测试 5/5、扩展 `chrome-browser-port` 与 executor 回归 61/61，全部通过。
- 用户明确要求“跑一条”。已建立 Phase 34：下一步只创建一条隔离 `precedent_research` Run，等待自然终态并核验 Results、Trace、Evidence 与 Board。
- 已确认隔离 API 健康且没有活动租约；隔离库无历史建筑研究记录。下一步从 `.archresearch/archresearch.db` 只读取得一条既有验收问题，再在隔离环境创建唯一 Run。
- 本地正式库题目查询因缺少 sqlite CLI、两种内联脚本解析失败而停止；没有触碰数据库。改用覆盖结构保留、公共动线、自然采光和迁移策略的代表性工业建筑更新问题。
- 已读取本地 OpenAPI：创建参数明确，建筑研究将使用 `precedent_research/balanced` 并省略只适用于 XHS 的 `research_sources`。
- 已确认隔离 harness 使用确定性 `MockResearchProvider`；它适合验证建筑研究路径、证据和 Board 合同，但不会调用用户 API Key。继续创建唯一回归 Run。
- 已创建且只创建 Run `6d540f6f-d54d-4ada-86e5-d40bd9bcddd7`（HTTP 201，初始 `created`）。当前等待自然终态；不取消、不重试、不并行创建。
- Run 已自然完成：`completed/coverage_satisfied`，12 个结果、4 个项目、4/4 子问题覆盖。逐项 API 检查确认 12/12 均有 facts 和 EvidenceClaims。
- Trace 中可选 XHS 来源只发生一次 skipped，不影响正式建筑案例；下一步仅验证 Board 实际显示该 Run 与 12 个结果。
- Board 首次无头检查发现 `apps/board` 未直接安装 `playwright`；一次复杂正则依赖搜索又被 PowerShell 解析拒绝。未安装新依赖，改为定位仓库现有 Playwright 运行时。
- 已定位 Playwright 仅由 `apps/extension` 的 `@playwright/test` 声明；直接加载底层 `playwright` 仍失败。下一步使用声明包本身，不新增依赖。
- 使用 `@playwright/test` 成功打开 Board、找到并点击最新 Run；结果页未显示 12 个结果，而是空状态，且无浏览器错误。Phase 34 尚未完成，开始只读诊断 Board 状态衔接。
- 延长等待并记录网络后确认 Board 正常：4 个子问题、4 个项目、4 个出处、4 组策略全部可见；首次空页是假阴性。当前仅核对 style-profile 404 是否为设计内的可选缺省响应。
- 已确认 style-profile 404 为前后端明确支持的“尚未创建表达规范”状态，前端回退到默认样式；不构成建筑研究回归。
- 已查看最终 Board 全页截图：4 个子问题、4 个案例、来源、策略和后续操作区完整可见。Phase 34 完成，未改生产代码、未重试或新建第二条 Run，未 commit、push、PR 或发布。

# 2026-08-07 — Phase 35 started

- 按恢复规则完整读取 `HANDOFF.md`、`AGENTS.md`、计划与近期 findings/progress，运行 session catchup、`git status --short --branch` 和 `git diff --stat`；保留全部用户工作树修改与真实研究数据。
- 新增 Phase 35，范围为建筑/图纸两类状态判定、停止文案和默认预算；成功标准明确为先红后绿、完整门禁和两条隔离现场 Run。
- 首个四文件合并补丁因 `findings.md` 锚点不匹配而整体未应用；已改为按文件真实末尾分别更新，没有造成部分写入。
- 当前尚未修改生产代码或测试，未创建 Research Run，未触碰正式 `9872`，未 commit、push、PR 或发布。
- 完成状态与预算链路审计：运行中富集逻辑可保留，最终终态应改用 `completion_satisfied()`；视觉 stop reason 只能由 `inspection_budget.exhausted` 产生。Board 已有 completed+enrichment gaps 的“案例不足/图纸较少”展示。
- 已先修改行为测试：建筑与图纸完整覆盖但富集未满应 completed；真实视觉额度预占满仍 blocked/visual_budget_exhausted；预算合同提高；Board 增加 query/visual 预算准确文案。尚未修改生产代码，下一步运行定向红测。
- 首轮 API 红测为 5 failed/1 passed：预算合同、建筑状态和视觉预算常量准确失败；两条图纸状态测试因夹具把来源池先硬断言为新值而提前 blocked。已将状态夹具改为兼容当前/新来源池，保留独立预算常量红测，下一步重新确认图纸失败点落在终态语义。
- 修正夹具后 API 红测为 5 failed/1 passed：建筑完整覆盖仍为 partial；两条图纸完整覆盖分别在 24/48 与 20/48 调用下仍为 `partial/visual_budget_exhausted`；预算值仍为旧值。真实预占满额度测试继续通过。
- Board 红测为 2 failed/117 passed：旧实现未识别 `query_budget_exhausted`，且视觉额度文案仍错误限定为“图纸数量上限”。红灯现已覆盖全部目标，开始最小生产实现。
- 已完成第一版最小实现：终态 completed 改由硬覆盖 `completion_satisfied()` 决定；只有视觉预算真实 exhausted 且覆盖未完成时才设置 `visual_budget_exhausted`；运行中仍保留富集目标作为提前完成条件。
- 默认预算已提高：建筑/通用查询上限、补查轮次、每分支补页、总页面和时间提高约 15%–33%；普通视觉调用/字节与图纸专用视觉调用/字节、帖子检查/来源池提高 25%。Board 同步增加 query budget 文案并把视觉文案改为同时适用于调用数和字节额度。
- 第一轮生产实现定向测试：API 核心 6/6 通过，覆盖建筑完成、两种图纸完成、真实视觉耗尽和新预算合同；Board `App + contracts` 119/119 通过。
- 定向转绿过程中只调整了两类合法期望：新增补查轮次使 quick 恢复测试查询数从 15 增至 18；统一检索预算文案后更新两处旧 UI 文案断言。下一步运行更广回归并处理仅由新合同导致的旧断言。
- 第一轮完整回归：Board 190/190 全绿；API 564/584，通过 20 条失败。失败集中在旧来源池/视觉额度固定值和旧“`gaps=[]` 仍 partial”断言，没有运行异常、数据库错误或证据链失败。
- 已定位 6 处 `limit==8`、多处 48/12 视觉额度断言，以及 9 个建筑 enrichment-only partial 测试。下一步逐项核对 coverage gaps 后再更新，真实缺口测试不会改成 completed。
- 一次批量状态断言补丁因文本完全相同，误命中“仅执行 1 次查询、覆盖不全的真实时间耗尽”测试；核对后已精确恢复为 `partial/time_budget_exhausted`，并把 completed 更新移到实际 3/3 覆盖的 OpenAI 时间预算测试。生产代码未受影响。
- 复跑首轮 20 个 API 失败点后 19/20 通过；唯一剩余是扩展图纸路径因新预算从 8 篇/48 次提升到 9 篇/54 次，第三方向现在达到 3 篇富集目标并 completed。已按这一预期收益更新测试。
- 第二轮完整门禁全绿：API 584/584；Ruff check、55 文件 format check、strict Mypy；Board 190/190、lint、typecheck、production build；Extension 214/214、lint、typecheck、production build；`git diff --check` 通过（仅既有 CRLF 提示）。
- 当前自动化已证明更高预算未破坏 API、Board 或扩展协议。下一步补跑 packaged extension E2E，然后进入隔离环境建筑/图纸各一条现场验收。
- Packaged MV3 E2E 8/8 通过，覆盖连接、权限、媒体枚举、懒加载、协议边界、重连和 FastAPI 真实浏览器裁图。自动化门禁全部完成。
- 现场服务盘点首条 PowerShell 因 `foreach` 后直接接管道产生解析错误；命令未执行任何进程操作。下一步改用 `$rows` 收集后只读输出精确 PID/命令行。
- 已按恢复规则再次运行 session catchup、读取 Phase 35 与规划文件末尾并核对工作树；全部用户既有修改和真实研究数据保持不动。
- 当前隔离环境：Board `15172`/PID 39772、QA API `18072`/PID 43784，健康 `ok/mock`；正式 `9872` 未监听。API 已加载新预算与状态源码，但扩展桥为 `connected=false`。
- Chrome 控制首次连接和等待 2 秒后的唯一重试均返回不可用。只读诊断确认 Chrome、ChatGPT 浏览器扩展和 native host 均安装正确，唯一原因是 Chrome 进程当前未运行。
- 下一步需先取得用户授权启动系统 Chrome；启动后复用现有 Board `?connect=chrome` 恢复 ArchResearch 扩展桥，再只执行一次小红书 session 检测，并顺序跑建筑与图纸各唯一一条现场 Run。
- 用户授权后已启动系统 Chrome；ArchResearch 扩展桥恢复 `connected=true`。本轮唯一一次小红书 session 检测用时 4,291 ms，返回 `logged_in/chrome_extension`，未出现验证码或重复 Board。
- 已创建 Phase 35 首条建筑 Run `2669dd7d-1a99-4adf-ac02-244e700ed8c1`。新预算字段准确生效，Run 自然结束时已有 12 条结果、4 个项目、4/4 子问题覆盖，但被标为 `blocked/browser_inspection_incomplete`。
- 只读 Trace、Results 与 QA events 证明失败来自 QA fixture 的 `research.example` 无法解析；12/12 结果仍有 facts 和 EvidenceClaims。未重试、取消或并行创建任务。
- 已只修改忽略目录中的隔离 QA harness：新增 `PublicPageMockResearchProvider`，仅把 Mock 正文来源映射到 `https://example.com/`，不修改产品代码或 `BrowserBroker` 的公网地址安全限制。下一步先做语法检查并精确重启 18072，再跑一次建筑复验。
- QA harness 语法检查通过，`example.com` 解析为公网地址；精确停止旧 PID 43784 后，首次复杂启动命令被策略拒绝且未启动进程，改用简化分步命令成功启动 PID 29088。18072 恢复 `ok/mock`，扩展桥自动重连。
- 建筑复验 Run `9bc42dff-7d45-4fa3-857c-e789fed6b6cb` 自然结束为 `completed/coverage_satisfied`，新预算正确，17 个结果、4/4 覆盖；但用户指出建筑不应搜索小红书。Trace 证实执行了 4 次 XHS 搜索并混入 5 条候选，因此该 Run 作废。
- 已确认 Board 正常创建路径对建筑显式发送 `research_sources: []`、对图纸发送 `[xiaohongshu]`；本次手动请求漏传字段，同时后端 schema 默认值错误为 XHS。
- 已先将 schema 行为测试改为“默认来源必须为空”，尚未修改生产 schema。下一步运行定向红测，确认旧实现准确失败后再做一行最小修复。
- 定向 schema 红测准确失败；随后只把 `ResearchSpec.research_sources` 默认工厂改为空列表，并在既有 Run 集成测试增加 `research_sources == []` 断言。
- 定向 schema/Run 测试 42/42 通过；API 全量 584/584、Ruff check、55 文件 format check、strict Mypy 26 个源文件全部通过。
- 下一步精确重启隔离 API 加载来源默认修复；建筑现场请求将显式传 `research_sources: []`，验收 Trace 中 XHS 搜索次数必须为 0。
- 用户要求把既有代码路径也分开。已完成交叉点审计：历史建筑 Run 的旧 XHS 字段和 Provider 返回的 XHS URL 都能绕过 schema，说明仅改请求默认值不足。
- 已先把旧“建筑可选 XHS 失败不影响完成”测试改为“建筑必须完全不调用 XHS”，并新增 Provider 混入 XHS 时建筑只保留公开建筑来源的行为测试；尚未修改 workflow，下一步确认两项红测准确失败。
- 两项 workflow 红测准确失败：建筑旧标记调用 XHS 3 次，Provider 返回的 3 个 XHS 资产全部进入数据库。
- 已完成目标限定的最小实现：建筑入口忽略遗留 XHS 来源，公共搜索和 Provider 结果均过滤 XHS；图纸 workflow 代码未改。
- 建筑两项隔离测试、API/schema 路由测试和既有图纸 XHS-only 测试合计 5/5 通过。下一步运行 API 全量、Ruff、format、strict Mypy，再重启隔离 API 做两条现场验收。
- 首次 API 全量为 583/585，通过 2 条旧混合路径测试失败；Ruff 与 strict Mypy 通过，format 要求机械格式化 `workflow.py`。
- 已机械格式化并把两条旧 XHS 测试改为明确 visual goal；其中浏览器回退测试新增 `provider.queries == []`。定向 5/5 重新通过。
- 下一步再次运行完整 API 门禁；全绿后才重启隔离服务和创建新的建筑/图纸现场 Run。
- 第二轮 API 全量 585/585、Ruff check、55 文件 format check、strict Mypy、`git diff --check` 全部通过（仅既有 CRLF 提示）。
- 下一步精确重启隔离 API 加载 schema/workflow 路径隔离；新的建筑 Run 必须显式来源为空、Trace XHS 调用为 0，随后再单独创建图纸 XHS-only Run。
- 隔离 API 已精确重启并自动恢复扩展桥。建筑现场 Run `71b77948-d3cf-4665-b344-70d5bf063858` 显式使用 `research_sources: []`，自然完成为 `completed/coverage_satisfied`。
- API/Trace 验收：12 个结果、4 个项目、4/4 覆盖、12/12 facts/EvidenceClaims；XHS 搜索和资产事件均为 0，浏览器公开页 12 次 completed、0 skipped。
- Board 无头验收及截图人工查看通过：4 章节、4 案例、4 来源，无“小红书”文案、alert、pageerror 或本地响应错误。下一步只创建一条图纸 XHS-only Run并逐张验收 PNG。
- 已创建唯一图纸 XHS-only Run `3fa69853-1b6a-41be-b9fa-7fca388fa4f4`；它自然结束为 `blocked/no_usable_assets`，未取消或重试。
- Trace 确认图纸未调用公共网页或建筑 Provider；失败来自 Chrome 搜索页媒体枚举持续为 0，第二次搜索尾部出现扩展 `execution_failed`。扩展桥当前仍连接。
- 下一步只执行一次 `/qa/xiaohongshu-page-state` 安全状态探针；如为验证码则保留页面等待用户，不刷新；如非验证码再检查窗口/内容脚本状态。
- 唯一页面状态探针返回 `logged_in`、无验证码，正确 `type=51` 页面并枚举 11 张媒体；探针正常关闭标签。
- 已满足“探针非零后才允许复验”的门槛。下一步只再创建一条图纸 XHS-only Run；若仍失败则停止重复创建并回到扩展命令层诊断。
- 已创建第二条且最后一条诊断用图纸 Run `3bc25c99-604f-4329-a66b-5ff02be9cbfb`；自然结束为 `partial/time_budget_exhausted`，3 个结果、2/4 方向覆盖，未取消或并行创建。
- 恢复后按项目规则完整读取 `HANDOFF.md`、Phase 35 与 planning 文件末尾，运行 session catchup、`git status --short` 和 `git diff --stat`；保留全部用户修改和真实研究数据。
- 当前 API 只读复核确认该 Run 实际约 91 秒，balanced 时间预算 4320 秒；视觉仅 10 次、约 1.77 MiB，停止原因不是真实预算耗尽。
- 源码只读审计确认根因：统一 workflow 的 `xiaohongshu_searched_subquestions` 限制每方向只搜一次；四个方向首轮后，图纸 XHS-only 三种搜索能力都为 false，统一无分支逻辑错误写入 `time_budget_exhausted`。
- 用户进一步要求既有代码也要分开。下一步先写红测，要求图纸在覆盖缺口和预算充足时允许受限的后续 XHS 补查，同时锁定建筑不调用 XHS、图纸不调用建筑 Provider；红灯准确后再做最小策略分离。
- 首次只读 Run 查询因猜测不存在的 `/trace` 端点而整体 404；随后从 FastAPI 路由确认使用 `/events` SSE，并成功读取完整 Run、Results 与 55 条 Trace，未修改服务或数据。
- 继续审计查询构造与恢复状态：图纸 balanced 已生成 3 轮查询，`QueryAttempt` 按轮次+方向去重；旧 XHS 方向集合是多余且破坏补查的并行状态。
- 已确定红测目标：首轮某方向无结果、另一方向已覆盖时，第 2 轮必须跳过已覆盖方向并重新搜索缺口方向；整个过程中建筑 Provider 与公共搜索保持零调用，最终不得误报时间耗尽。
- 已新增图纸后续轮次行为测试。首次夹具仅含 2 个方向，被 `ResearchPlan(min_length=3)` 正确拒绝；修正为 3 个方向后，旧实现准确红灯：只执行 `linework/collage/rendered` 首轮 3 次搜索，没有第 2 轮 `collage` 补查。
- 红测同时锁定 Provider 搜索为 0；因此后续生产修复不能通过恢复建筑/通用搜索来“让测试通过”。
- 已完成最小生产策略分离：删除图纸每方向终身只搜一次的集合；建筑显式禁用 XHS；图纸显式禁用公共/Provider 搜索，覆盖未完成时跳过已覆盖方向并在后续轮次补查缺口。
- 图纸第 2–5 轮使用受控视觉补查词，避免重复搜索同一关键词；不引入建筑类型、用户主问题或 Provider 指令文本。
- 新红测已转绿；随后 11 项建筑/图纸边界回归全部通过。下一步检查差异和格式，再运行 API 全量、Ruff、format、strict Mypy 与 diff check。
- Ruff 首轮仅要求机械格式化 `workflow.py`；已只格式化该文件。并行 API/Mypy 因 Ruff 非零提前结束，未误报为完成。
- API 全量复跑为 579 passed / 6 failed。已逐项确认都是旧测试依赖已退役混合路径或固定单轮 XHS 次数；下一步只修测试边界，不修改生产策略。
- 6 个旧失败中 5 个已转绿。最后一项已确认生产行为正确：可信建筑项目页远程图片只分类一次；测试仍用 visual_lead 过滤导致取不到该 `partial` 资产，下一步只更新断言到建筑证据合同。
- 最后一项已更新为可信建筑项目页证据断言并转绿。第二次 API 全量 586/586 通过；Ruff、55 文件格式检查、strict Mypy 及 diff check 全绿。
- 自动化阶段完成。下一步只读盘点隔离 Board/API/正式端口和扩展桥，精确重启 QA API `18072` 加载策略分离代码，然后顺序做建筑与图纸现场验收。
- 已完成端口盘点：15172/PID 39772、18072/PID 48840；隔离 API 健康且扩展桥 connected，正式 9872 未监听。下一步只读确认 QA 数据库环境路径后精确重启 18072。
- 用户中断后只读确认旧 QA API 已退出、数据库无活动 Run；stderr 显示误用 runtime Python 缺少 uvicorn。改用项目 venv 分步启动后 18072 恢复 `ok/mock`。
- 重启后扩展桥 initially disconnected；只调用一次 ArchResearch `/v1/browser/open-chrome`，随后 `connected=true`、XHS search available。下一步先创建唯一建筑现场 Run。
- 建筑唯一现场 Run `178890fd-80e6-45fc-955b-99a801d3a23b` 已完成并通过路径隔离/证据验收。随后一次 XHS session 检测返回 logged_in/chrome_extension。
- 图纸唯一现场 Run `cb66cf77-a426-4a97-ae18-1f60838d60e7` 已 completed/coverage_satisfied，4/4 方向；Trace 证明 3 轮补查真实执行且 Provider/公共网页为 0。
- 开始 6 张 PNG 严格人工验收：Rank 0 因照片和巨大标题混入不合格，Rank 1 合格。当前 1/2 合格，继续 Rank 2–3。
- Rank 2–3 已检查：Rank 2 内容干净但 collage_style 方向存疑，Rank 3 合格。当前确定 Rank 0 不合格，Rank 1/3 合格，Rank 2 待最终方向判断；继续 Rank 4–5。
- 已补记 Rank 4–5 人工结论：两张均为完整且方向匹配的图解/剖面研究素材，无网页 UI、遮罩、正文评论或应用侧错误裁切，均合格；Rank 0 不合格，Rank 2 方向匹配仍存疑。
- 按用户要求开始物理路径拆分：先写结构/行为红测，旧代码准确因缺少 `research_paths` 模块而失败；随后新增建筑/图纸独立策略模块，共享入口只选择一次策略。
- 已将建筑来源归一化、公开/Provider/XHS 搜索许可、建筑恢复轮次和终态规则迁入 `research_paths/precedent.py`；将图纸 XHS-only、视觉补查查询、图纸类型过滤和视觉终态规则迁入 `research_paths/drawing.py`。
- API 定向 workflow 回归通过；Ruff、format、strict Mypy 通过；API 全量 591/591 通过。下一步补跑最终静态/差异检查，并重启隔离 API 进行建筑与图纸两条现场回归，随后继续处理 Rank 0 复合封面筛选。
- 物理拆分后建筑现场 Run `e5536a6f-00b5-45a1-bab0-fc106e4ade92` 通过：`completed/coverage_satisfied`，4/4 覆盖，12/12 facts 与 EvidenceClaims，XHS 搜索事件和 XHS URL 均为 0。
- 物理拆分后图纸现场 Run `bb20e775-6a03-4c6d-a6dd-165692e602e4` 通过流程/路径验收：`completed/coverage_satisfied`，4/4 方向，三轮 12 次 XHS 搜索，公共页面事件 0，Mock Provider 12 次均 skipped；但开始逐张 PNG 检查后，Rank 0 复合封面不合格，Rank 1 为外立面效果图/照片也不合格，尚不能宣告图纸内容验收通过。

## 2026-08-07 — execution runner split started

- 完成新会话只读恢复，确认现有工作树和 Phase 35 交接状态。
- 为“旧执行代码也要分开”先写结构红测；当前准确失败，因为 `research_paths/precedent_runner.py`、`drawing_runner.py` 尚不存在，且 `workflow.execute_research_run` 仍承载两条路径的执行分支。
- 下一步：把路径专属搜索/检视执行代码迁入两个 runner，保留共享数据库、证据、预算和 checkpoint 底座。
- 已新增 `precedent_runner.py` 与 `drawing_runner.py`，入口 `execute_research_run` 只按目标分发一次；建筑 runner 丢弃视觉搜索依赖，图纸 runner 丢弃公共页面解析器。
- 定向回归已通过：路径 7/7、workflow 53/53、browser inspection 168/168、XHS 24/24。
- 完整 API 门禁已通过；Ruff check、Ruff format check、strict Mypy 32 个源文件和 `git diff --check` 全部通过。Board/Extension 未改动，本轮未发布、未创建新现场 Run。

# 2026-08-08 — isolated E2E result

- 重启并核对隔离服务：API `18072` 加载最新源码且健康，Board `15172` 正常，扩展桥 connected，正式 `9872` 未监听。
- 通过 Board 创建建筑 Run `18c6edd1-3361-4e66-9869-c6305c3d759d`，自然终态 `completed/coverage_satisfied`；12 结果、4 项目、4/4 覆盖、12/12 facts/EvidenceClaims，XHS Trace/URL 均为 0。建筑路径通过。
- 通过 Board 创建图纸 Run `f09b3e6c-695a-4076-9d9a-81e501b81c00`，严格 XHS-only；6 次 XHS 搜索、公共/Provider 0 调用，但所有搜索媒体枚举均为 0，终态 `blocked/no_usable_assets`，0 结果/0 PNG。图纸路径当前未通过。
- 失败层级已从 workflow 收敛到 Chrome 扩展媒体枚举：搜索 URL 打开、等待、滚动和关闭均执行，未进入图纸质量门禁。
- 当前不继续创建 Run。先加载桌面已有 `C:\Users\76384\Desktop\Archsearch\archresearch-chrome-extension-only-v2.2.10-phase33-windowfocus-candidate.zip`，再进行唯一一次图纸复验；本轮无生产代码变更。

## 2026-08-08 — v2.2.10 release preparation

- 用户明确授权先发布 `v2.2.10`，再使用发布版扩展复验图纸灵感；现有隔离失败 Run 不重试、不取消、不并行创建。
- 发布范围审计确认当前产品改动、测试、用户文档和 CI/Release 合同属于本次发布；`.planning/`、QA 数据、桌面候选 ZIP、`HANDOFF.md`、`findings.md`、`progress.md` 和 `task_plan.md` 仅作本地交接，不纳入提交。
- GitHub CLI `2.96.0` 已认证，远端默认分支为 `main`；远端尚无 `v2.2.10` 标签或 Release。
- Release 合同红测先准确失败于旧 v2.2.8 CI artifact 名；已将 API、Board、Extension、manifest、CI artifact、README、Chrome 安装说明、架构附件名和 Release 测试统一为 `2.2.10`，合同测试已转绿。
- 当前分支为 `agent/local-release-v2.2.2`，不执行 reset、checkout、clean 或 rebase；下一步运行完整本地门禁并构建两个独立发布附件。
- 首次完整门禁在 API 594/594 后只因版本同步造成的 `__init__.py`、`main.py` 格式检查失败；Ruff 机械格式化后重跑全量门禁通过：API 594/594、Board 190/190、Extension 214/214、packaged E2E 8/8、lint/typecheck/build、strict Mypy 全部通过。
- 扩展 ZIP `archresearch-chrome-extension-only-v2.2.10.zip`：20,459 bytes，SHA-256 `9A8EEB5D18B47742040F48706DA5264572944504E4C73D31253E3CC5EDDCDB6E`，11 entries，manifest `2.2.10`。
- Windows 安装器 `ArchResearch-Windows-x64-Setup-v2.2.10.exe`：69,759,127 bytes，SHA-256 `5C1D73C36F296AB0C284084F3CF851A9D2A5B93C38B52D4681BCD970598787B5`；安装/启动/卸载 smoke 通过，安装器未捆绑扩展。
- 当前下一步：提交 staged 产品变更，推送分支并创建 draft PR；PR/主分支 CI 通过后再创建 v2.2.10 Release 并上传这两个独立附件。

# 2026-08-08 — v2.2.10 release completed

- 最新提交 `81087c4` 已推送，PR #22 已 squash 合并到 `main`，合并提交 `a2ff995bfed696980df61962ca592f2a2b56d5d6`。
- 主线 Hosted CI run `31245075246` 成功；完整门禁、扩展包、Windows 安装器、安装/启动/卸载 smoke 和两个附件上传全部通过。
- annotated tag `v2.2.10` 已推送，正式 Release 已发布且为非草稿、非预发布。
- Release 附件已从主线 CI 下载并核验：扩展 ZIP 20,438 bytes / SHA-256 `3ADD848F3A094410B2C2295B5F5CA88B6FD924C9F64F4F00CB6763DB0F1C7624`；Windows 安装器 70,255,649 bytes / SHA-256 `B01936155FC6692CABD0124DB9FDB97137DCE34D4A31BEEC425E5D868466AE7F`；GitHub digest 与本地文件一致。
- 当前下一步：确认 Chrome 实际加载正式 `v2.2.10` 独立扩展后，只创建一条图纸现场复验；发布前失败 Run 不重试、不取消。

# 2026-08-08 — thread handoff closeout

- 已修正 GitHub Release `v2.2.10` 说明中的字面量 `\\n`，现在页面显示为正常分段和项目符号；附件和版本 tag 未改变。
- 产品提交、PR #22、主线 CI `31245075246`、`v2.2.10` tag 和正式 Release 均已收口。
- 工作区只保留本地交接记录、CI 下载件和竞赛材料规划；不执行清理，不将这些文件加入产品提交。
- 换线程后的唯一下一步：加载并确认正式 `v2.2.10` 独立扩展，再创建一条图纸现场复验。

## 2026-08-08 — installed version is the acceptance target

- 按恢复规则重新读取 `HANDOFF.md`、`AGENTS.md`、Phase 35、`findings.md` 与 `progress.md` 末尾；未读取旧对话作为项目依据。
- 只读确认安装版进程为 `C:\Users\76384\AppData\Local\Programs\ArchResearch\ArchResearch.exe`，版本 `2.2.10`，动态端口 `9325`；安装版 Board 标签也位于 `http://127.0.0.1:9325/`。
- 读取安装版 Run `d1c0f6f9-1933-47a2-a0df-08e00c3eb836`：12/12 XHS 搜索成功、每次 8 个候选；20/20 浏览器检视为 `ValidationError`，终态 `blocked/no_usable_assets`，没有结果或 PNG。
- 运行安装版登录态只读探针，返回 `logged_in/chrome_extension`。未读取 Cookie、账号、密码或 API Key；未创建第二条 Run。
- 比较桌面扩展目录与正式 `v2.2.10` CI ZIP，11 个文件长度和 SHA-256 全部一致。浏览器管理页访问被安全策略阻止，未尝试绕过；XHS DOM 探针超时后停止重复。
- 当前状态：Phase 35 仍为 `in_progress`。下一步只读定位 `MediaEnumeration` 的具体 Pydantic 校验失败或取得活动扩展实例版本证据，不改生产代码、不重复现场 Run。

## 2026-08-08 — sanitized validation trace patch

- 新增浏览器响应校验诊断红测；旧实现准确失败于缺少 `validation_model`，既有 `error_type=ValidationError` 保持可见。
- 生产实现只在 Pydantic 校验异常时记录首个错误的模型名、字段路径和错误类型；使用 `include_input=False`、`include_url=False`，测试确认原始非法值未进入 Trace。
- 定向测试和完整 `test_browser_inspection.py` 回归通过；API 全量通过，Ruff check、70 文件 format check、strict Mypy 32 个源文件和 `git diff --check` 全绿。
- 首次 strict Mypy 因摘要字典被推断为 `dict[str, str]` 失败；只增加 `dict[str, object]` 类型注解后转绿，运行时行为未改。
- 当前下一步：构建并覆盖安装诊断版，确认实际安装进程加载新代码后继续协议诊断。重新安装前不创建新 Research Run。

## 2026-08-08 — installed protocol root cause and red-green fix

- 诊断安装版启动成功：`2.2.10`、动态端口 `11154`、Provider/model 保持 `openai/gpt-5.6-sol`；数据库安装前后 SHA-256 均为 `5F16017462324C8D0EE5BEEBEEABCFC82441B8FD158616BA2563D2EAD8313F29`。
- 安装版登录态探针返回 `logged_in/chrome_extension`。唯一诊断 Run `99670d73-73fd-4e5a-8d80-c3ff4818cdd2` 自然终止为 `blocked/no_usable_assets`，15/15 browser 事件均为 `BrowserCommand.action/literal_error`，没有结果或 PNG。
- 审计确认 API 漏枚举 `open_xiaohongshu_note`；扩展端已经支持该固定协议。新增协议红测先准确失败，生产补齐动作枚举和小红书搜索/详情 URL 校验后转绿。
- API 全量、browser/XHS 定向回归、Ruff、70 文件 format check、strict Mypy 32 个源文件和 diff check 全绿。
- 当前下一步：重新构建并覆盖安装包含协议修复的版本，确认安装版桥和登录态后只 retry 现有诊断 Run 一次；不创建第三条 Run。

## 2026-08-08 — installed protocol-fix acceptance retry

- 协议修复后的实际安装版 `2.2.10` 已启动在动态端口 `11100`；`/desktop-health`、`/health` 正常，Provider/model 保持 `openai/gpt-5.6-sol`，扩展桥 `connected=true`。
- 只调用一次 `/v1/browser/xiaohongshu-session`，4.3 秒返回 `logged_in/chrome_extension`；没有安全验证状态，也未读取 Cookie、账号、密码、浏览器存储或 API Key。
- 只对既有 Run `99670d73-73fd-4e5a-8d80-c3ff4818cdd2` 调用一次 `/retry`；返回 HTTP 200，同一 Run 进入 `created`、`attempt=1`，未创建第三条 Run。
- 当前下一步：等待该 Run 自然终止，不取消、不再次重试；终态后核对浏览器 Trace 是否已消除 `BrowserCommand.action/literal_error` 并进入页面元数据与媒体枚举。
- 同一 Run 在约 25 秒后自然终止为 `blocked/no_usable_assets`，0 个 Results/PNG；未取消、未再次重试。
- 本次 Trace 序号 59–116：15 个 browser 事件的旧 `action/literal_error` 为 0，但 15/15 均为 `BrowserCommand` 根级 `value_error`，目标全部是 `/search_result/<note-id>` 详情 URL。
- 根因是协议修复中的 URL helper 把搜索页“精确 `/search_result`”规则错误复用于详情 URL，因而拒绝真实候选链接。下一步先新增实际 `/search_result/<note-id>` 的协议红测，再做最小安全修复。
- 只读 Trace 首两次时间筛选误得 0：PowerShell 7 的 `ConvertFrom-Json` 已将 `created_at` 自动转为 `System.DateTime`，字符串比较失效；改按 `.Hour` 切分后得到正确 58 条 retry 事件。该错误未调用写接口，也未改变 Run 或数据。
- 按计划新增真实 `/search_result/<note-id>` 协议红测；旧实现准确失败于 `Xiaohongshu note navigation requires a safe note URL`。
- 生产修复将小红书搜索页的精确路径检查与详情 URL 前缀检查分开，仍限制 HTTPS、官方小红书主机、无凭据和固定详情前缀；同时拒绝空 `/search_result/` 详情路径。
- `test_browser_ws.py` + `test_xiaohongshu.py` 定向回归 57/57 通过。此前根目录 `.venv` 路径不存在，已改用 `apps/api/.venv/Scripts/python.exe`；缺失 README/pyproject 的并行查询未改文件或运行服务。
- API 全量回归 600/600 通过；Ruff check 通过；Ruff format check 71 文件通过；strict Mypy 32 个源文件通过；`git diff --check` 通过（仅既有 LF/CRLF 提示）。
- 当前源码验证完成。下一步重新构建包含详情路径修复的独立安装器，覆盖安装并保护当前 SQLite；启动后只做健康/桥/登录态核对，不再重试已用尽的现场 Run。
- 新安装器构建成功：`.artifacts/qa/phase35-installed-note-path-fix/ArchResearch-Windows-x64-Setup-v2.2.10.exe`，69,760,819 bytes，SHA-256 `2D8879868BA5836680C84D9CE0A91C0BBDC3B4F40645703F78A1873CDBE397E1`。
- 新冻结 EXE 为 17,994,165 bytes，SHA-256 `F69D9463BC9A165102359C7E29C253CC63BF16E260FA3BD61741F4A7D951D6CC`；当前安装 EXE 仍为上一包的 `1A4C2CD7C048A5FC913DC64C82C4998F41932FD75A0FCC75E9E19879D0545265`。
- 首次并行基线脚本因 PowerShell `foreach` 后直接管道导致 ParserError；命令在解析阶段终止，未停止进程、未安装、未写数据库。改为先收集数组再输出后成功。
- 已精确核验并停止安装路径完全匹配的 PID `44944`。进程关闭后 SQLite 只有主文件、无 WAL/SHM；安装前 SHA-256 `5CC8B0551390D36AE30330EEC2D9181D6CF09950FFDECAEF4D63195B5CE2D4E4`。
- 静默覆盖安装退出码 0；安装后 SQLite 哈希仍为 `5CC8B0551390D36AE30330EEC2D9181D6CF09950FFDECAEF4D63195B5CE2D4E4`，包含现有 Run/Trace 的用户数据未改变。
- 已安装 EXE 为 17,994,165 bytes，SHA-256 `F69D9463BC9A165102359C7E29C253CC63BF16E260FA3BD61741F4A7D951D6CC`，与本次冻结构建完全一致；安装器 ProductVersion 为 `2.2.10`。
- 新安装版只启动一个进程 PID `46888`，动态端口 `7016`；`/desktop-health` 返回 `ArchResearch/2.2.10`，扩展桥 `connected=true`。
- 首次组合健康轮询误用不存在的 `/v1/health`，导致把健康服务错误归为超时；正确端点是 `/health`。后续只读拆分检查确认进程与桌面健康正常，未启动第二个进程。
- 两次并行诊断编排分别因 PowerShell/JavaScript 转义语法在执行前失败；改为单条简单命令后取得结果，未改变应用或数据。
- 正确 `/health` 返回 `ok/openai/gpt-5.6-sol`；本次安装进程只调用一次 XHS session，3,973 ms 返回 `logged_in/chrome_extension`，未出现安全验证状态。
- 已安装 EXE `--self-test` 退出码 0，运行后 EXE 哈希仍为 `F69D9463BC9A165102359C7E29C253CC63BF16E260FA3BD61741F4A7D951D6CC`。
- 误用不存在的 `GET /v1/runs` 得到 404；PowerShell 非终止错误后输出的 `RunCount=0` 作废。改用目标 Run 真实端点确认 `99670d73-73fd-4e5a-8d80-c3ff4818cdd2` 仍为 `blocked/no_usable_assets`、`attempt=1`，安装过程未再次重试。
- 产品安装版没有详情页 QA 探针；隔离 harness 的 `/qa/xiaohongshu-page-state` 不能替代安装版。若要完成真实 `open_xiaohongshu_note` 到媒体枚举验收，必须明确允许一个额外 Run/attempt；当前不擅自消耗。
- 最终只读一致性检查通过：PID `46888` 路径为实际安装目录，端口 `7016` 的 desktop/health 正常，目标 Run 仍为 `blocked/no_usable_assets`、`attempt=1`；规划文件已同步，`git diff --check` 通过（仅既有换行提示）。

## 2026-08-08 — verification appeared during installed retry follow-up

- 用户报告刚刚出现小红书安全验证页；从该报告起未再调用安装版浏览器接口、session 检测、刷新、重试、取消或新建 Run。
- 当前必须保留验证页，等待用户本人完成验证；完成后再由用户明确通知，下一步只做一次状态确认。Phase 35 继续 `in_progress`。

## 2026-08-08 — attempt 2 and verification closeout

- 用户明确允许对同一 Run 再 retry 一次；未创建新 Run。`99670d73-73fd-4e5a-8d80-c3ff4818cdd2` 进入 `attempt=2` 后自然终止为 `blocked/no_usable_assets`。
- attempt 2 Trace 共 32 条（序号 117–148）：API `BrowserCommand` 校验错误 0；首轮 XHS 搜索完成并返回 8 个候选，保留 5 个；5 个详情检视均为扩展 `BrowserCommandError`。后续一次搜索返回 0，另一次搜索也因扩展命令错误跳过；0 Results、0 PNG。
- 用户随后报告出现安全验证页；已停止浏览器操作并等待用户完成。完成后唯一 session 确认返回 `logged_in/chrome_extension`；未刷新、重复开页、取消或再次 retry。
- 最终状态：协议层修复已在实际安装版生效，但扩展详情执行层仍未通过，Phase 35 保持 `in_progress`。当前不再创建或 retry Run；下一步需先有新的扩展层诊断方案或用户明确授权额外现场执行。

## 2026-08-08 — extension note-link matching red-green

- 只读审计确认扩展内容脚本 `openXiaohongshuNote()` 原先要求候选卡片 `candidate.href === target.href`；这会拒绝同一详情路径上由小红书卡片附加 `xsec_token` 等查询参数的链接。
- 新增内容脚本红测：目标为无查询参数的安全 `/search_result/note-42`，卡片链接带 `?xsec_token=visible`；旧实现准确返回 `{opened:false}`。
- 最小修复让候选 URL 先通过现有小红书详情白名单，再比较同源 `origin + pathname`，忽略查询参数和尾部斜杠；未增加任意导航或脚本能力。
- 红测转绿：目标测试 1/1 通过。尚未构建或安装扩展，也未触发新的 Research Run。

## 2026-08-08 — extension note-link fix packaged

- Extension 全量测试 `215/215` 通过；ESLint、TypeScript typecheck、生产 build 通过；packaged E2E `8/8` 通过。
- 独立候选 ZIP 已生成：`C:\Users\76384\Documents\灵感agent\.artifacts\qa\phase35-extension-note-link-fix\archresearch-chrome-extension-only-v2.2.10.zip`，SHA-256 `9CB91FCFF8DD04B41C8FF676006482790DF1031D1A272EADDDA29CC319F6D455`。
- 候选 ZIP 仍未加载到用户 Chrome；没有访问 `chrome://extensions`、刷新页面、读取 Cookie/账号/密码/浏览器存储，也没有创建或 retry 新 Run。
- 当前唯一下一步：用户加载/重载该候选扩展后，先做一次安装版 session 状态确认；真实详情/媒体链路是否再执行需单独确认现场执行授权。Phase 35 保持 `in_progress`。

## 2026-08-08 — extension candidate loaded

- 用户已加载/重载候选扩展 `phase35-extension-note-link-fix`。
- 安装版端口 `7016` 只做一次 session 确认，返回 `logged_in/chrome_extension`；未刷新、关闭或新开小红书页面。
- 现有 Run 已到 `attempt=2`，候选扩展修复尚未通过真实 Research Run 验收。下一步需要用户明确授权一次新的现场执行；未授权前不创建或 retry。

## 2026-08-08 — new installed run created

- 按用户“创建”授权，确认安装版 `7016` 健康且活动 Run=0。
- 只 POST 创建 Run `0633b2a4-b76a-458d-bf00-6beab6a19458`：`帮我找几种剖面图风格`、`visual_reference_search`、`quick`、`[xiaohongshu]`。
- 首轮轮询：Run 从 `created` 进入 `inspecting`，Provider 生成 3 个视觉方向；未取消、未 retry、未创建并行 Run。

## 2026-08-08 — new installed run audit

- Run `0633b2a4-b76a-458d-bf00-6beab6a19458` 约 2.5 分钟内自然终止：`blocked/no_usable_assets`，`usable_assets=0`、`covered_subquestions=0`、0 结果/0 PNG。
- 只读 Events 审计：58 条 Trace，`xiaohongshu_search=5`、`browser=15`、`openai=5`；15 次详情检视全部 `skipped / BrowserCommandError`，BrowserCommand 校验错误为 0，未进入 page metadata/media enumeration。
- 按约束停止现场消耗；未取消、未 retry、未创建第二条新 Run。下一步回到扩展详情命令层诊断。

## 2026-08-08 — canonical detail path fix

- 对 15 次详情 `BrowserCommandError` 做时间审计：每次约 8 秒，定位到扩展点击后等待 canonical 详情 URL 的边界。
- 先新增执行器红测，旧逻辑在 `/search_result/note-42` → `/explore/note-42?xsec_token=visible` 时 5,012 ms 超时；最小实现改为同源批准路径下相同 note ID 匹配。
- 定向测试 `29/29` 通过；扩展全量 `216/216`、ESLint、TypeScript、生产 build、packaged E2E `8/8` 通过。
- 打包候选：`.artifacts/qa/phase35-extension-canonical-note-path-fix/archresearch-chrome-extension-only-v2.2.10.zip`，20,530 bytes，SHA-256 `59B625E44296E4F6356E6F4F24D941FEBCAC485B542F42F6EC9C96A7F2D211B4`。
- 当前候选未加载；未改安装版、未重启服务、未创建或 retry Run。下一步等待用户加载/重载后只确认一次安装版 session。

## 2026-08-08 — candidate loaded and authorized run started

- 用户重载 canonical detail-path 候选；一次正确的安装版 session POST 返回 `logged_in/chrome_extension`。此前 GET 404 为方法误用，未触发浏览器状态变化。
- 用户明确授权后，确认活动 Run=0，只创建 `e41c3560-ead1-42e4-8960-f3791abdd42d`：`帮我找几种剖面图风格`、quick、XHS-only。
- 首轮轮询从 `planning` 进入 `searching`、`inspecting`；当前无安全验证，不取消、不 retry、不创建并行 Run。

## 2026-08-08 — canonical candidate run terminal audit started

- 只读确认安装版 `7016` 健康，Run `e41c3560-ead1-42e4-8960-f3791abdd42d` 已自然终止为 `completed/coverage_satisfied`、`attempt=0`。
- 覆盖报告为 18 个可用资产、9 个项目、3/3 方向；Events 37 条，终态 Trace 无待执行阶段。
- Results API 返回 20 条，先审计记录类型、浏览器/扩展错误、详情元数据和媒体枚举，再定位并逐张验收本地 PNG；Phase 35 暂不改为 complete。
- Trace 审计完成：10/10 browser 详情检视 completed，API 校验错误、扩展执行错误和安全验证均为 0；3 条 OpenAI skipped 是预期的 XHS-only 分流。
- 详情链路新增资产合计 18，质量拒绝 3，累计视觉调用 28 次、预览 5,082,606 bytes。下一步定位安装版数据库/本地内容映射并解释 Results=20。
- 已定位安装版 `data\runs` 文件根和 Results 内容路由；接下来只读核对 SQLite `asset_candidates.storage_path` 与实际 PNG，不读取 pairing token、Provider 配置或凭据。
- 文件清单确认目标 Run 有 20 个独立 PNG；系统无 `sqlite3` CLI，下一步用 Python 标准库的只读 SQLite URI 查询精确记录并对照覆盖统计实现。
- 已确认 20 条 Results 中 Rank 0–17 为 18 个 usable assets，Rank 18–19 relevance=0；Results=20 与 coverage=18 是合同允许的统计口径差异。开始按 Rank 0–19 逐张视觉验收。
- 视觉验收 Rank 0–3 完成，4/4 合格：均为完整剖面/技术图像；Rank 1 的文字和 Rank 2 的原始边缘贴字均非应用 UI 或错误裁切。继续 Rank 4–7。
- 视觉验收 Rank 4–7 完成，4/4 合格；Rank 6 是渲染景观与地下雨洪剖面的一体化图解，不是单独 photograph。累计 8/8，继续 Rank 8–11。
- 视觉验收 Rank 8–11 完成，4/4 合格；Rank 11 留白较大但图纸主体清晰，不是空白轮播。累计 12/12，继续 Rank 12–15。
- 视觉验收 Rank 12–15 完成，4/4 合格；四宫格、竖向构造、黑白线重和粉灰拼贴均为完整图纸。累计 16/16，继续 Rank 16–19。
- 视觉验收 Rank 16–19 完成：Rank 16–17 合格，Rank 18–19 因正文/混合渲染占比过大不合格；两条均为 relevance=0。18 个 usable assets 18/18 合格，20 个本地 PNG 总计 18/20 合格。
- 下一步核对安装版 Board/导出是否过滤 relevance=0 候选；未确认前 Phase 35 仍保持 in_progress。
- 安装版 Board 首页真实渲染目标 Run 为“18 张参考 · 已完成”；继续打开详情页检查实际灵感卡片。
- 安装版详情真实渲染为“18 条可用参考 · 2 条只作线索”，并展示 20 张图；低相关 Rank 18–19 保留为线索。控制台错误/警告为 0。
- 下一步审计 Board 现有测试和产品合同，确认“低相关候选继续展示但不计 usable”是既定行为还是应修复的回归。

## 2026-08-08 — Phase 35 completed

- 按恢复规则完整读取 `HANDOFF.md`、`AGENTS.md`、Phase 35、`findings.md` 与 `progress.md` 末尾，并执行 `git status --short --branch`；全部既有修改与本地产物保持原样。
- 只读审计 Board 当前实现、产品规范、Git 引入历史、覆盖统计和导出边界。确认 `relevance=0` 候选继续显示为“只作线索”是既有批准语义，不是应在本 Phase 隐藏的正式结果回归。
- 现场 Run `e41c3560-ead1-42e4-8960-f3791abdd42d` 的 18 个 usable assets 已逐张 18/18 合格；两条不合格持久化候选均为 `relevance=0`，未计入覆盖或首页结果数，且不会自动进入导出。
- Phase 35 已改为 `complete`。本轮未修改生产代码、安装版、扩展或 Run 数据，未创建、retry、取消任何 Run。
- 三个只读路径误判已记录到 Phase 35 错误表：不存在的 `apps/board/tests`、`ResultViews.tsx` 和 `exports.py`；均在执行阶段停止且无状态改动。
- 最终只读一致性检查确认 PID `46888` 仍指向实际安装目录；`/desktop-health` 返回 `ArchResearch 2.2.10 / 7016`，`/health` 返回 `ok`。未调用浏览器 session 或任何 Run 写接口。

## 2026-08-08 — Phase 36 started

- 用户要求改善建筑搜索经常只返回部分结果的问题，并明确方案前期不需要过严筛选。
- 已检查用户截图并建立 Phase 36：先诊断截图对应的实际安装版 Run，再决定放宽候选排序、正文分析准入或完成判定中的哪一层。
- 当前不预设“筛选太严格”为唯一根因；6 条参考/2 个项目与两个缺口表明召回和完整文章分析都需要用 Trace 量化。
- 尚未修改生产代码、安装版或 Run 数据；下一步只读定位目标 Run 及其 Events。
- 安装版仍在 `7016` 返回 `ArchResearch 2.2.10` 与 `/health=ok`。已确认只读列表路由为 `/v1/workspaces`、`/v1/workspaces/{id}/runs`，Events 为 `/v1/runs/{id}/events`。
- 首次路由正则因 PowerShell 双引号解析失败；已改用单引号分拆查询并记录到 Phase 36 错误表，没有访问或修改应用数据。

## 2026-08-08 — Phase 36 recovery and installed Run baseline

- 按仓库恢复流程完整读取 `HANDOFF.md`、`AGENTS.md`、Phase 36 以及 `findings.md`/`progress.md` 末尾，并运行 planning session catchup 与 `git diff --stat`；全部既有产品修改、规划记录和本地产物保持原样。
- Catchup 报告 10 条未同步上下文，已将目标安装版 Run `3ad135af-85c2-4706-a922-2d7a1c09f616`、3/4 覆盖、唯一空白分支 `time-sharing`、218 条 Events 与禁止 retry 的约束同步到 `findings.md`。
- `HANDOFF.md` 顶部仍称 Phase 35 为活动阶段，但文件末尾和 `task_plan.md` 均确认 Phase 35 已完成；当前权威活动阶段是 Phase 36。
- 恢复阶段的路径引号、错误标题层级和误触不可用工具均已记录到 Phase 36 错误表；这些失败没有调用应用写接口、没有改变 Run，也没有改生产代码。
- 下一步只读解析目标 Run 的 Events，并将 `time-sharing` 的 8 轮与三个成功分支逐层比较；定位真实过严条件后才开始行为红测。

## 2026-08-08 — Phase 36 first event-layer diagnosis

- 只读确认安装版仍为 `7016 / health=ok / openai / gpt-5.6-sol`，目标 Run 状态与覆盖未改变。
- 改按 SSE `data:` 行解析后取得完整 218 条 Trace；汇总各工具字段并按 `workflow/searching` 批次重建了初次执行与 retry 的分支流。
- `time-sharing` 在初次执行和 retry 中各跑 8 轮。正文分析过的 Courthouse、Busan Opera House、Charles Library 均为 relevance 2，但全部 `direct_match=false`、supported facts 0；模型 rerank 的 analogical/spatial retain 始终为 0。
- 已把候选数、保留数、重复候选在 rerank 前清除以及 Provider fallback/timeout 的实际损失写入 `findings.md`。未修改生产代码、安装版或 Run 数据。
- 下一步读取 gap-check/终止事件和预算实现，确认 `budget_exhausted` 对应 query/page/time 的哪项；随后定位查询文本持久化位置及 rerank/article-analysis 提示合同。

## 2026-08-08 — Phase 36 budget diagnosis completed

- 对照最终 gap-check、两次 composing 事件、`research_paths/precedent.py` 和 workflow 循环后，确认 `budget_exhausted` 是 3 个普通轮次加 5 个恢复轮次自然走完后的默认原因。
- 该 Run 未耗尽 72 分钟时间预算、48 页正文预算或视觉预算；不需要扩大总预算。真正需要审计的是查询生成、候选 rerank 与 article direct-match 的语义门。
- 只读源码与安装版 Events；未改生产代码或 Run。下一步读取 `QueryAttempt` 的实际文本和候选/页面提示实现，再把真实候选与当前合同逐条对照。

- 已确认实际安装版数据库为 `%LOCALAPPDATA%\ArchResearch\data\archresearch.db`；下一步仅通过 SQLite read-only URI 查询目标 Run 的 `query_attempts`，不读取同目录 Provider 配置、配对 token 或凭据文件。

## 2026-08-08 — Phase 36 query text audit completed

- 通过 SQLite read-only URI 读取目标 Run 的 20 条 `query_attempts`；未读取 Provider 配置、配对 token、Cookie、账号或 API Key。
- 查询审计确认 `time-sharing` 过度绑定运营时段/配送记录等罕见正文词，确定性回退模板还存在重复词和中英整段拼接。已将“直接时段事实”与“空间机制类比但需运营校核”分层原则写入 `findings.md`。
- 下一步只读列出本 Run 持久化的候选页面及 access status，确认哪些真实建筑页在 rerank 前后被拒；随后审计 provider prompts 和现有行为测试。

- 已通过 SQLite read-only URI 列出目标 Run 的 42 个 `source_pages`。候选同时包含可迁移的建筑尺度条目和应拒绝的室内/住宅/产品噪声，证明不能用无条件多保留解决。
- 下一步审计 rerank schema、Provider prompt、deterministic fallback 和文章 direct-match 合同，找出为何 spatial/analogical 计数始终为 0。

## 2026-08-08 — Phase 36 admission-contract audit started

- 已读取 CandidateAssessment schema、OpenAI 查询规划/rerank/公共页面分析提示，以及 workflow 候选选择实现。
- 确认文章 Evidence/direct-match 门已允许跨类型和部分回答，且目标 Run 的三个失败页面确实为 0 supported facts；不降低该门。
- 首个代码级过严点是正文前的候选准入与不可达的 type-only context probe；第二个是查询规划禁止从已知活动关系扩展行业机制词。下一步读取现有 cross-type、spatial、type-probe 和 direct-match 测试，确定最小红测应落在哪个既有合同上。

- 已审计现有 cross-type/spatial/type-only probe 测试。下一步读取 deterministic query builder 与 query-planning Provider 测试，确认搜索词放宽的最小位置；之后开始添加失败行为测试，仍先不改生产实现。

- 已定位 deterministic fallback query 的真实重复词和入口活动词汇缺口；该路径与目标 Run 中两个 Provider query-planning fallback 直接对应。
- 下一步读取 Provider/query-builder 现有断言并确定红测组合：入口活动专业词扩展、无重复 circulation、单个建筑尺度机制探针，以及非建筑反例继续拒绝。

## 2026-08-08 — Phase 36 behavior RED

- 新增三条目标行为测试并运行：3/3 按预期失败。
- 查询红测失败于缺少 `passenger drop-off`，旧结果准确复现真实 Run 的 `back-of-house circulation circulation circulation relationships`。
- 候选红测失败于只返回强 spatial 案例，没有返回受信的 Vehicle Inspection Station 建筑尺度机制探针；室内产品反例仍在同一测试中。
- Provider 提示红测失败于没有 `architectural_scale` 和机制探针合同。另已补充非回退 query-planning 提示断言，要求把用户已陈述活动转换为中性专业检索同义词，并明确这些词不是预设设计答案。
- 下一步只做最小生产实现：补入口活动词汇和重复关系词处理；增加默认 false 的建筑尺度 assessment；限额保留一个 spatial=1 的受信机制探针；文章分析与 EvidenceClaim 门不变。

## 2026-08-08 — Phase 36 target tests GREEN

- 首次生产补丁因 Provider 提示上下文不匹配而整体未应用；拆成按文件精确补丁后成功，错误已记录到 Phase 36 表。
- 首轮 GREEN 中 Candidate/Provider 3 条已通过，deterministic query 仍缺父问题中的落客/步行词；只对 flow 分支增加父问题活动白名单继承后，四条目标测试 4/4 通过。
- 生产修改涉及 `agent/planning.py`、`providers.py`、`workflow.py`；测试涉及 `test_agent_planning.py`、`test_providers.py`、`test_browser_inspection.py`。
- 当前进入自动回归：先规划/候选/Provider 相邻测试，再完整 API 与静态门禁。尚未构建、安装或创建现场 Run。

- 相邻回归第一组：`test_agent_planning.py` 20/20 通过；`test_providers.py -k "query_planning or candidate_reranking"` 12/12 通过。仅有既有 Starlette/httpx 弃用警告。
- 相邻回归第二组：`test_browser_inspection.py -k "candidate_reranking or public_recovery_changes_search_strategy_for_the_same_uncovered_branch"` 6/6 通过；Ruff check 通过。
- Ruff format check 报告 `agent/planning.py`、`workflow.py`、`test_agent_planning.py`、`test_providers.py` 需要机械格式化；下一步仅格式化这 4 个本轮文件并回归。
- 已仅格式化上述 4 个文件；目标测试再次 4/4 通过，Ruff format check 为 62 files already formatted。
- 完整高风险回归 `test_agent_planning.py + test_providers.py + test_browser_inspection.py` 全绿；仅有既有 Starlette/httpx 与 SQLite datetime 弃用警告。
- 下一步运行 API 全量测试，然后 strict Mypy、Ruff 复核和 diff check。
- API 全量测试通过；仅有既有 Starlette/httpx 与 SQLAlchemy/SQLite datetime 弃用警告。
- strict Mypy 通过：32 个源文件无问题。下一步复跑 Ruff lint/format、`git diff --check` 并审计本轮差异。
- Ruff check 通过；Ruff format check 为 62 files already formatted。
- `git diff --check` 通过，仅有既有 LF/CRLF 提示。差异审计确认 `workflow.py` 与 `test_browser_inspection.py` 还包含 Phase 35 已有的浏览器校验诊断改动，本轮未覆盖或回退；本轮产品差异仅叠加在查询、Provider assessment 与候选 probe 路径。
- Board 完整测试 190/190 通过，ESLint 通过；Vitest 输出两个既有 jsdom `requestSubmit()` not implemented 提示，但退出码为 0。
- Board TypeScript typecheck 与 production build 通过；Vite 成功产出生产 bundle。
- 缩短后的查询测试名已单独回归通过；最终 Ruff lint 与 62 文件 format check 再次全绿。
- 已读取现有 Windows 构建脚本，确认输出可限定在工作区 `.artifacts/qa`，安装器仍不捆绑扩展；下一步构建 Phase 36 验收安装器。
- Phase 36 安装器构建成功并通过冻结程序自检；安装器与冻结 EXE 的大小、SHA-256 已写入 `findings.md`。
- 下一步运行 Windows installer 合同测试；通过后再建立实际安装目录进程和 SQLite 哈希基线。
- Windows installer 合同测试通过。首次组合安装基线因运行中 SQLite 文件锁无法哈希而终止，无状态改动；改为先确认健康/活动 Run，再停止精确安装进程后取数据库哈希。
- 安装版 PID `46888`、精确安装路径、`7016`、desktop/health 正常；但 PowerShell 将 Runs 响应嵌套导致活动计数不可采用。下一步用 Python 逐项展开只读响应确认活动 Run。
- Python 逐项展开确认 5 条历史 Run 全部 terminal、活动 Run=0。精确停止 PID `46888` 后数据库仍被另一进程占用，安装未开始；下一步只读定位实际持锁进程。
- 后续确认没有残留安装进程或 `7016` listener；数据库锁为退出后的短暂释放延迟，重试哈希成功。
- Phase 36 安装器静默覆盖退出码 0；安装后 EXE 与冻结构建哈希一致，SQLite 安装前后哈希一致。下一步启动实际安装版并核对健康与活动租约。
- 实际安装版已启动为 PID `45652`、动态端口 `5202`；精确安装路径、`/desktop-health=2.2.10`、`/health=ok/openai/gpt-5.6-sol` 正常。
- 已安装 EXE `--self-test` 退出码 0；自检结束后仍只有 PID `45652` 的实际服务进程。下一步确认活动 Run=0 并创建唯一建筑验收 Run。
- 创建前再次确认活动 Run=0；只创建 Phase 36 唯一现场 Run `55dcb0ad-cce2-4ecb-b79c-25302f63e72b`：原入口人车冲突问题、`precedent_research`、`balanced`、`research_sources=[]`、`attempt=0`。
- 下一步只等待自然终态并审计 Trace/Results/Board；不取消、不 retry、不创建第二条 Run。
- 首轮现场轮询：Run 从 `searching` 进入 `inspecting`，Provider query planning 成功；首个已检视来源为 ArchDaily 的 Dongchang Elevated Passage，browser completed。当前无停止原因，继续只读轮询。
- 首个真实 rerank 为 4→1，且 `mechanism_context_probe_count=1`、analogical/spatial 各 1；旧 Run 的该路径始终为 0。候选形成 2 个资产但尚未成为正式项目或覆盖分支，证明文章证据门仍在。
- 第二个进入 browser 检视的是 Designboom 的 Rail Baltica Pärnu Passenger Terminal，仍为建筑/交通基础设施尺度。`arrival_sequence` 完成首轮 pass 后依旧 0 个正式项目、0/4 覆盖；Run 已继续到下一分支搜索。
- 四个分支现均完成首轮 pass，仍是 2 个候选资产、0 个正式项目、0/4 覆盖；Run 已进入 round 2 `conflict_nodes` 的 `evidence_angle` 补查。安全门保持。
- round 2 `conflict_nodes` 检视到一个住宅入口项目，但没有新增资产、正式项目或覆盖；该边缘建筑尺度案例被后续门挡住。Run 继续 round 2 `arrival_sequence`。
- round 2 `arrival_sequence` 的候选为 ArchDaily 大庆西综合公路客运站，属于直接相关的交通建筑尺度页面；browser completed，等待正文分析。
- 大庆西综合公路客运站已通过正文分析并提升：7 usable assets、1 个正式项目、`arrival_sequence` 覆盖、1 个 multi-asset project。Run 继续补其余分支。
- round 2 已完成 `service_access` 与 `conflict_nodes` 补查，`temporal_adaptation` 进入第二个 query；覆盖仍稳定为 7 assets、1 project、1/4，未出现错误或安全来源分流。
- round 2 四个分支均已完成，覆盖仍为 7 assets、1 project、1/4；Run 已进入 round 3 `conflict_nodes`，开始更深的 space-first/evidence-angle 查询。
- 会话恢复补记：round 3 已找到 Lourosa-Fiaes Transport Interface，仍属于与人车到达直接相关的交通建筑案例；当前项目数仍为 1，说明该页面尚未重复提升或缺少新的分支证据。继续等待同一 Run 自然终态，不创建 retry、取消或第二条 Run。

## 2026-08-08 — Phase 36 completed

- 唯一现场 Run `55dcb0ad-cce2-4ecb-b79c-25302f63e72b` 已自然终止为 `partial/query_budget_exhausted`，Trace 222 条；没有小红书、retry、取消或并行 Run。
- 最终为 10 个 usable assets、2 个正式项目、1 个 multi-asset project，覆盖 2/4。Lourosa-Fiães 与大庆西均有 `direct_match=true`、完整 evidence chain 和 EvidenceClaim；Dongchang 仅为建筑尺度机制线索，不计正式项目。
- Results/Board 审计完成：10 条资产来自 3 个可信 ArchDaily 来源页，全部 EvidenceClaim 有 text excerpt；Board `caseResults` 只把 `analysisReady` 的正文案例归入正式案例分组，未让无正文线索绕过证据门。
- Phase 36 全部 6 项完成，安装前后 SQLite 哈希保持一致，安装版 Board HTTP 200；阶段标记为 complete。后续若继续优化，应创建新的 Phase/Run，不得 retry 本 Run。

## 2026-08-09 — Phase 37 建筑关键词分层收口

- 建筑查询已拆为“空间发现 lane → 项目/证据核验 lane”。service 首轮优先使用 `service entrance public entrance site circulation`；temporal 首轮优先使用 `arrival space flexible circulation peak event`，后续轮次再轮换 `shared forecourt`、`arrival sequence`、`project description`、`operational` 等词。
- 首轮不再强绑 `post-occupancy evaluation`、`management rules`、`delivery vehicle swept path`、配送窗口等窄运营词；但保留用户明确提出的 `visitor circulation`、`back-of-house circulation`、`independent entrance`、`service corridor` 等空间关系，避免“放宽”反而丢掉问题本身。
- 明确的项目条件继续保留，例如 `adaptive reuse industrial building community cultural center`；无类型/无条件时不再重复拼接泛化的 `architecture project`。没有新增建筑类型字典，也没有把 `loading dock`、`service court` 变成默认答案。
- Provider 提示同步明确：检索同义词只是召回词，不是设计结论；候选仍须通过建筑尺度、正文、direct match、逐字 EvidenceClaim 和来源可信度门槛。`architectural_scale` 机制探针规则保持有限，不改变正式覆盖合同。
- 验证完成：相关 307 项、API 全量 576 项、Ruff lint、62 文件 format、strict Mypy 32 个源文件和 `git diff --check` 全部通过。图纸 fallback 隔离回归通过；`apps/api/src/archresearch_api/research_paths/drawing.py` 等图纸路径文件未改动。
- 本轮没有创建、retry 或取消 Research Run，没有重建安装器，也没有触碰图纸现场数据。Phase 37 的安装版静态复核保留为后续发布/现场验证项，需另行授权；当前唯一工作目标已完成。

## 2026-08-08 — Coverage follow-up diagnosis

- 复查实际安装版 SQLite 中的 20 条 `query_attempts`：`service_access` 运行 8 次、`temporal_adaptation` 运行 7 次，覆盖不足不是分支未执行。
- 根因确认是检索词把建筑空间发现与运营事实核验混为一体：后勤分支偏向 `delivery vehicle swept path/loading operations`，时段分支偏向 `post-occupancy evaluation/management rules/event scheduling`，这些词在建筑媒体正文中稀疏且候选质量低。
- 当前不改代码、不 retry 已完成 Run。下一次若继续，应新建 Phase，先把两层检索拆开：宽召回空间机制案例，再补查后勤/时段事实；缺少运营证据的案例保留为类比，不计 direct-match 覆盖。

## 2026-08-09 Phase 37 实际安装版建筑 Run 完成

- 用户授权后已覆盖安装实际 `ArchResearch.exe`，当前 PID `34308`、端口 `4849`；`/health` 返回 `ok/openai/gpt-5.6-sol`，安装 EXE SHA-256 为 `FE09A116584D5E972966A33CEAF6C6616B207567A7086BD5A9C8B9B18FDFD7B9`。
- 只创建建筑 Run `ea8c5c8d-915c-4d83-80c3-942046d88eb5`，自然终止为 `partial/budget_exhausted`；最终 7 个资产、3 个正式项目、3/4 子问题覆盖。`arrival_sequence`、`service_access`、`temporal_adaptation` 已覆盖；`conflict_nodes` 仍未覆盖。未 retry、未取消、未创建第二条 Run。
- 现场 Trace 156 条，XHS=0；有 2 次 `BrowserCommandError`，但没有阻止建筑 Run。实际 SQLite 只读审计为 12 条查询尝试、32 个来源页（13 available、19 irrelevant），确认新空间优先关键词已进入安装版运行。
- 结果审计完成：Madrid-Barajas T4（1 张，direct match，4 个 supported facts）、Flinders Street Station proposal（2 张，direct match，5 个 supported facts）、Busan Opera House（4 张，direct match，2 个 supported facts）。7 个资产共 23 条 EvidenceClaim，均有 URL 和逐字 excerpt。
- 安装版活动数据库被进程占用，未强行停止服务取当前文件哈希；安装前后保护哈希已验证。图纸路径未改动、未参与本 Run，`drawing.py` 与图纸查询/数据保持不变。

## 2026-08-09 Phase 38 conflict_nodes 红测与最小实现

- 只读审计 Phase 37 安装版 Run 后确认：`conflict_nodes` 8 轮均执行，但候选正文只能证明到达或扩容，未证明访客、车辆、工作人员冲突节点的空间缓解；后续查询还过早混入 `post-occupancy`、`management`、`vehicle operations`。
- 新增红测后旧实现按预期失败：fallback 没有 `arrival forecourt`、`entrance threshold`、`pedestrian vehicle separation` 等冲突空间词；Provider query-planning 提示也没有冲突节点专业同义词。
- 最小实现仅在建筑 precedent 查询路径增加 conflict-node discovery lane：首轮加入前场、入口阈值、人车关系、前台/后勤关系、交叉点和导向；第 4 轮才加入 `operational`、`project description`、`conflict management`。图纸 fallback、候选准入、正文 direct-match 和 EvidenceClaim 门未改。
- 目标红测及 service/temporal 相邻测试 4/4 通过；下一步运行完整 planner/provider/browser 回归和静态门禁。尚未构建、安装或创建新的现场 Run。

- 完整验证完成：`test_agent_planning.py` 24/24、Provider 查询/候选 12/12、browser 相关 6/6、API 全量 576/576；Ruff lint、4 文件 format check、strict Mypy 32 个源文件和 `git diff --check` 全部通过。
- 差异审计确认该改动只按冲突语义扩展建筑检索流程：首轮空间发现词与后续证据 lane；没有写入案例名称、URL、项目类型特例，也没有修改图纸 fallback。Phase 38 现场验证保持 pending，等待用户明确授权后再构建/安装并创建新的建筑 Run。
- 2026-08-09 Phase 39 开始：完成三次建筑 Run 与当前 planner/provider/workflow 控制流复核。确定本轮先写红测，覆盖通用检索 lane 轮换、首轮双 query slot、确定性候选回退数量和图纸隔离；暂不构建、安装或创建现场 Run。
- 2026-08-09 Phase 39 RED：首轮 query slot 测试按预期失败（旧实现首轮 `query_limit=1`）；候选回退初测未命中损失分支，已改为 Provider rerank 异常场景后再测。
- 2026-08-09 Phase 39 实现中发现并修正 fallback 去重缺口：跨子问题重复查询由 Run 级集合发现，重复判断最初受双空格影响，现改为与 `SearchQuery` 相同的空白归一化。

## 2026-08-09 — Phase 39 完成

- 复核三次建筑 Run 后，将优化边界确定为“检索召回与调度层”，没有降低正文证据、建筑尺度或 EvidenceClaim 门，也没有把图纸路径纳入建筑逻辑。
- 已完成通用语义拆槽、通用 lane 轮换、首轮双 query slot、Run 级规范化去重和 rerank 异常时最多 4 条合格候选回退；实现不读取或判断具体子问题 ID 来注入案例空间答案。
- 定向测试通过：planner 22/22、Provider query/candidate 12/12、browser/workflow 恢复与预算相关测试全部通过。
- 完整 API 测试通过；Ruff check、Ruff format check（62 files）、`python -m mypy src`（32 files）和 `git diff --check` 通过。直接运行 `mypy.exe` 的一次空失败码改用模块入口复核并确认无问题。
- 差异审计确认 `apps/api/src/archresearch_api/research_paths/drawing.py` 未修改；本轮没有构建、安装或创建新的 Research Run。
- 下一步：等待用户明确授权后，才在当前安装版上创建一条全新的建筑 Run，审计 query count、lane/strategy、候选数、覆盖和 EvidenceClaim；不 retry 已完成的旧 Run。

## 2026-08-09 — Phase 40 开始

- 用户明确授权进行安装版现场验证。
- 旧安装版 PID `34308`、端口 `4849` 健康，活动 Run=0；当前服务为 Phase 37 安装版，尚未覆盖安装。
- 已确认本阶段只创建一条全新的建筑 Run；旧 Run `ea8c5c8d-915c-4d83-80c3-942046d88eb5` 不 retry，图纸路径不参与。
- 运行中 SQLite 被旧服务持锁，保护哈希将在精确停止 PID 后计算；未执行任何 Research Run 写操作。

## 2026-08-09 — Phase 40 完成

- 构建 `.artifacts/qa/phase40-installed-architecture/ArchResearch-Windows-x64-Setup-v2.2.10.exe` 并通过冻结程序与安装器合同检查；安装目录没有扩展文件。精确停止旧 PID `34308` 后取得 SQLite 保护哈希，静默安装前后均为 `354E53402B7E80850ABEAC788CCDF56AFA7CD8D0DBC856B52C170D4DA49CAE66`。
- 新安装版以 PID `40596`、端口 `6158` 启动，EXE SHA-256 为 `BF71D01FD477619B9B4FF2484AD54427BC2F75501A7DC53F2D6523267772DEC3`；健康、版本和活动租约检查通过。
- 只创建建筑 Run `94c7d473-3f0d-41b1-9ad1-dcaec089c75e`，自然终止为 `completed/coverage_satisfied`：11 个 usable assets、4 个项目、4/4 子问题覆盖；未 retry 旧 Run，未创建并行 Run。
- 完成查询、来源、rerank、正文分析和证据审计：15 条实际查询全部去重，首轮四个子问题均为双槽；8 个 available 来源页、26 个 irrelevant；Provider fallback=0；11 次正文分析为 6 次接受、5 次拒绝；43 条 EvidenceClaim 缺 URL/excerpt 均为 0；XHS/图纸事件为 0。
- Board 首页和详情页只读验收完成。首次用完整按钮名称定位因换行/省略号归一化差异超时，改用唯一“11 张参考”文本后成功；详情页另有一个预览资源 404，主体与四个子问题正常。
- 现场发现两个不同来源的已核验项目仍共享顶层 `project_name=待核验项目`，Board 分组后误合并。已将 Phase 40 标记 complete，并建立 Phase 41 处理全局项目身份提升；尚未修改生产代码。

## 2026-08-09 — Phase 41 行为红测

- 只读链路审计确认占位名由普通网页 browser visual lead 持久化生成；正文分析成功后 `_persist_public_page_analysis()` 会写入 `project_name_zh`、设计分析与 EvidenceClaim，但不更新顶层 `project_name`。Board、导出和收藏都消费顶层字段，因此不能只在 Board 做展示补丁。
- 新增通用行为测试 `test_verified_browser_visual_leads_adopt_distinct_page_project_names`：两个无具体案例依赖的来源页分别完成 `direct_match=true` 和逐字证据链后，应从共享占位名升级为各自页面项目名。
- 旧实现按预期失败：两个资产实际仍均为 `待核验项目`，其余证据持久化断言通过。下一步只在正文持久化成功路径升级仍为占位状态的项目名；已有明确项目名和未核验 lead 保持不变。
- 最小生产实现完成：正文持久化成功路径先从页面标题、来源标题或已核验中文名得到规范项目名，只替换仍为 `待核验项目` 的候选；项目名纳入 before/after 变更比较。
- 目标测试与既有未核验占位名测试 2/2 通过。下一步运行正文分析、跨来源项目身份、缓存重分析和 browser 持久化相邻回归。
- 相邻正文/项目身份回归 13/13 通过；完整 `test_browser_inspection.py` 156/156 通过。
- API 全量测试通过；Ruff lint、33 文件 format check、strict Mypy 32 个源文件与 `git diff --check` 均通过。差异复核确认 Board 和 `research_paths/drawing.py` 未修改。
- 因生产修复只影响新持久化数据，不修改旧 Run，Phase 41 增加安装版现场复验：重建并保护性覆盖当前安装版后，只创建一条新建筑 Run。
- Phase 41 安装器构建成功：69,768,970 bytes，SHA-256 `894D598B4DEF216A475ED185F684D0B45B666B0F602AB1B1F93A5415E4A039BE`；冻结运行目录递归核对扩展路径和 `manifest.json` 文件数为 0。
- 首次清单核对错误假定冻结根目录存在 `manifest.json`，读取失败但命令未中止；改为递归文件枚举后得到有效结果，未修改安装器或应用状态。
- 当前安装版 PID `40596`、端口 `6158`、精确安装路径和健康/版本正常。首次活动检查误用不存在的 `/v1/runs` 且产生错误计数；按路由定义改用 workspace runs 并显式扁平化后，确认 8 条历史 Run、活动 Run=0。
- 精确停止 PID `40596` 后，SQLite 安装前哈希为 `F154BC95F20F8C1C4307B3A6F9432248C85BC8A6CCBADB69B11736480B90B4E2`；静默覆盖安装退出码 0，安装后哈希完全一致。新安装 EXE SHA-256 为 `CDD90C6DCF454D2EE43B556E40681B710FE50F6920C719AB0F960AE2DA8CD71A`，冻结自检通过。
- 新安装版 PID `25168`、端口 `7595`，`/health=ok/openai/gpt-5.6-sol`、`/desktop-health=2.2.10`；创建前重新确认 8 条历史 Run、活动 Run=0。
- 本阶段只创建现场 Run `699ff718-a17b-44ef-8b1b-cd4ce233ab29`。运行中已形成两个正式项目、4 个 usable assets、3/4 覆盖：Tammela Hybrid Stadium 与 Adelaide Zoo Entrance Precinct 各 2 张，同页资产仍正确归组，4 张资产顶层占位名数量为 0。
- 一次附加 source/name pair 计数因 PowerShell 字符串多余转义报错，错误的 `DistinctSourceNamePairs=0` 不采用；有效项目分组表和 `PlaceholderCount=0` 不受影响。继续等待同一 Run 自然终态。
- 用户指出“一个子问题只看到一个案例”后完成 Board 与 API 对照：上一条 Run 子问题 1/3/4 各 1 个案例，子问题 2 有 2 个可见案例；Board 按正文分支关联过滤，不是把全部项目复制到每个子问题。
- 进一步定位数量合同：分支 enrichment 当前按资产 ID 计数，不按不同 `project_name` 计数；总项目目标不约束项目在各子问题的分布，终态 `completion_satisfied()` 也忽略 enrichment gaps。用户明确不要求逐子问题硬配额；后续若使用不同项目数，只能作为软诊断/补查优先级，不能阻止已有可靠结果完成。
- 只读 Board 核对旧 Run：子问题 1/3/4 各 1 个可见案例，子问题 2 有 2 个；再次用独立 `11 张参考` 文本定位失败后，改用 `button` + `hasText` 成功，错误已记录且不再重复。
- 现场 Run 在首个 20 分钟轮询窗口结束时仍自然执行，状态 4/4 覆盖、2 项目、4 资产、无 stop reason；研究本身未超时。当前仅 7 次 query planning，继续低频只读等待，不取消或 retry。
- 延长监控也在自身 30 分钟窗口到期，研究 Run 仍持续产生事件；未取消、retry 或创建并行 Run。替代监控随后取得自然终态 `completed/coverage_satisfied`：16 usable、15 verified/partial、4/4 覆盖，仍有 `insufficient_subquestion_assets` 软提示。
- 终态 HTTP/Trace 审计：332 条事件，35 次实际本地搜索，15 次正文分析（7 接受、8 拒绝、0 失败），query-planning fallback=0、page-analysis deterministic fallback=1，XHS/图纸事件=0。8 个 analysis-ready assets 的 50 条 EvidenceClaim 缺 URL/excerpt 均为 0，正式占位名为 0。
- 安装版 Board 现场确认同一 Adelaide Zoo 来源在子问题 1 和 3 各被拆成两个 dossier；Results 证明短名和完整标题来自同一 URL，导致覆盖报告把 3 个真实来源项目虚增为 4 个项目。Board 未修改，旧 Run 未改写。
- 新增红测 `test_verified_browser_visual_lead_reuses_existing_source_project_name`；合法测试夹具下旧实现按预期失败。最小实现让同源占位资产优先复用已有非占位名称，两个相关项目身份测试与相邻回归转绿。
- Board 同时显示 Zaiwan Village 的所谓后勤机制只有 `service industry` 就业句。新增通用红测证明确定性 flow 回退误把裸 `service` 当建筑流线语义；改为仅保留 `service access/entrance/circulation/route` 后红测与既有确定性正文测试转绿。
- 完整 browser/provider 回归、API 全量、Ruff lint/format、strict Mypy 32 个源文件和 `git diff --check` 全部通过；图纸差异计数为 0。Phase 41 继续 `in_progress`，下一步需用户授权第二次安装版构建/覆盖与一条全新建筑 Run；不得 retry 当前 Run。
- 用户已明确授权 Phase 41 第二次安装版现场复验。安装前基线：实际安装版 PID `25168`、端口 `7595`、`/health=ok`、`/desktop-health=2.2.10`，活动 Run=0；本次只构建/覆盖当前源码并创建一条全新建筑 Run，旧 Run 不 retry、不改写，图纸路径不参与。
- 第二次验收安装器构建成功：`.artifacts/qa/phase41-source-identity-followup/ArchResearch-Windows-x64-Setup-v2.2.10.exe`，69,769,109 bytes，SHA-256 `DC99EB2B1F95C8353C6FC879590EEF7BBE1994DCF79EA5D61941AA72D6FC783D`；冻结 EXE SHA-256 `4340E6918CB8663937FB762D81A31703FE4F5B96336CD45A7915AF66D5D8FA4D`，自检和 Windows 安装器合同通过，扩展/manifest 递归计数均为 0。
- 精确停止旧 PID `25168` 后，SQLite 安装前 SHA-256 为 `F62ABB35223C024DBCED25E236792D1B3991007A8B7B6502EF3EB1C477A468B2`；静默覆盖退出码 0，安装后哈希完全一致，安装 EXE 与冻结 EXE 哈希一致。
- 新安装版 PID `29872`、端口 `11561`，`/health=ok/openai/gpt-5.6-sol`、`/desktop-health=2.2.10`，扩展桥 connected；创建前 9 条历史 Run、活动 Run=0。一次路由检索包含不存在的 `browser_api.py` 导致该并行命令非零，改读实际 `browser.py` 后确认 `/v1/browser/status` 正常，不采用失败批次的其他输出。
- 只创建第二次验收 Run `bef8d1a4-5d09-4624-85e4-6cfff4979b23`：原建筑入口/前场问题、`precedent_research`、`balanced`、`research_sources=[]`、`attempt=0`；创建后活动 Run 恰为 1。后续只等待自然终态并审计，不取消、不 retry、不创建并行 Run。

## 2026-08-09 — Phase 41 第二次现场复验完成

- Run `bef8d1a4-5d09-4624-85e4-6cfff4979b23` 自然终止为 `completed/coverage_satisfied`、`attempt=0`：23 usable/verified-partial assets、8 个项目、4/4 子问题、4 个 multi-asset projects，`gaps=[]`；仅保留 `insufficient_subquestion_assets` 软提示。
- Trace 审计完成：330 条事件、31 次 query planning、35 次实际浏览器搜索（25 次有结果）、15 次正文分析（12 接受、3 拒绝、0 失败）；query-planning deterministic fallback=1、page-analysis deterministic fallback=1，XHS/图纸事件=0。
- Results 审计完成：26 条持久化结果，其中 23 条正式 partial、3 条 visual lead；23 条正式资产来自 8 个来源，来源内顶层 `project_name` 分裂数为 0，93 条正式事实缺 URL/excerpt 均为 0，正式 `service industry` 命中为 0。
- 安装版 Board 只读验收完成：API 按“来源项目 × 受支持子问题”预期 12 个 dossier，界面四问实际为 `1/3/6/2`，合计 12；8 个正式项目全部显示，同一来源在同一子问题内无重复 dossier。
- 第一问只有 1 个案例与 API 的 `flow_interfaces=1` 完全一致；这不是 UI 截断或检索结果被隐藏。系统继续允许单案例分支完成，不复制其他分支案例、不设置逐子问题硬配额。
- 弱回退在 Board 明确显示“把来源机制作为待核验假设”，页面无 `service industry`。当前安装版活动 Run=0；旧 Run 未 retry 或改写，图纸路径与现场数据未修改。Phase 41 标记 complete。

## 2026-08-09 — Phase 42 开始

- 用户要求继续下一步；确定新阶段只处理建筑研究的逐子问题软多样性调度，不增加硬案例配额，不修改 Board 或图纸逻辑。
- 已运行 planning session catchup、`git diff --stat` 并重读规划文件末尾；Phase 41 记录已同步，没有遗留活动 Run。
- Phase 42 计划已写入：先只读审计 coverage 与 workflow 调度，再写红测；当前尚未修改生产代码、尚未构建安装器、尚未创建或 retry Research Run。
- 已完成第一轮源码审计：`verification.py` 的分支 enrichment 只按资产 ID 计数；`precedent.py` 只实现 coverage-first 跳过；`workflow.py` 在 4/4 覆盖后恢复固定查询顺序，没有不同项目数信号。
- 当前判断是增加软诊断并调整 enrichment 查询选择，保持 `completion_satisfied()`、终态和 Board 证据归属不变。下一步继续读取 query 生成顺序、恢复键和相邻测试，再写失败行为测试。
- 已确认 `build_queries()` 是固定的 round-major 顺序，现有 coverage-first 测试将完整覆盖后的 enrichment 写死为第一个分支。Phase 42 红测将把这一预期替换为“不同项目数最少者优先、同数时原顺序稳定”。
- 兼容策略已确定：真实 coverage 新增分支项目数映射；测试 stub 缺字段时 workflow 回退到原顺序，避免无关测试大面积改写。尚未修改生产代码。
- 用户中断后已按 planning skill 再次执行 session catchup、差异统计与四份规划文件恢复；中断前的只读命令已结束，没有后台测试或部分代码写入。Phase 42 仍停在红测前，现继续执行。
- 设计复核否决了“跳过富集分支直到最弱分支追平”的方案，因为失败分支可能长期独占预算。确定采用每轮稳定排序：项目少者先执行，但不删除同轮其他查询，保持软优先和公平性。
- 已核对 `query_index` 与域槽使用：重排只影响执行先后，不改变每个分支的 domain slot、query key、查询总数或恢复键。红测边界可以落在 round-local 顺序上。
- Phase 42 首次 RED：调度参数组已准确失败，旧实现把第二轮执行为 `A/B/C/A/B/C`，没有把项目最少的 C 提前。coverage 去重测试先因夹具重复图片 URL 触发数据库唯一约束，该结果不采用；已改成同项目、同来源但不同图片 URL，待重新运行。
- Phase 42 有效 RED 已确认：修正夹具后，coverage 测试只因缺少 `projects_per_subquestion` 失败；软调度测试只因旧流程第二轮仍按 A/B/C 固定顺序失败。未覆盖优先与同数稳定顺序两个参数组仍通过。
- task plan 的现状审计和行为红测已标为 completed，最小软调度实现进入 in_progress。一次规划补丁因跨阶段错误表上下文不匹配整体未应用，已改用 Phase 42 精确上下文。
- 最小实现完成：`verification.py` 增加 precedent-only 的分支项目去重映射；`workflow.py` 在每轮开始按该映射稳定重排当前轮查询，使用单层索引循环保留原 break/continue 行为。
- 目标测试 `test_article_ready_project_counts_distinct_drawings_from_its_verified_source` 与 `test_precedent_normal_rounds_prioritize_coverage_before_enrichment` 共 4 个用例全绿。Phase 42 步骤 3 完成，步骤 4 回归与隔离开始。
- 第一轮相关回归完成：`test_agent_verification.py`、完整 `test_workflow.py`、`test_research_path_separation.py` 全绿。下一步运行完整 browser inspection 高风险套件。
- 完整 browser inspection 156/156 通过。Phase 42 步骤 4 标记 completed，步骤 5 自动门禁进入 in_progress。
- 自动门禁首轮：Ruff lint 通过；format check 仅报告本轮 `agent/verification.py` 需机械排版，已记录并准备只格式化该文件。
- 仅格式化 `agent/verification.py` 后，Ruff lint、62 文件 format check 和 strict Mypy 32 个源文件全部通过。
- 格式化后目标行为测试 4/4 通过；API 全量 605/605 通过。自动门禁只剩 `git diff --check`、图纸差异和当前安装态/活动 Run 只读确认。
- 最终源码门禁完成：`git diff --check` 通过，`research_paths/drawing.py` 差异为 0；当前已安装 Phase 41 版本健康正常、活动 Run=0。
- Phase 42 步骤 5 标记 completed。尚未构建或安装 Phase 42 候选，尚未创建或 retry Research Run；步骤 6 等待用户明确授权。
- 用户已用“运行”明确授权 Phase 42 的构建、保护性覆盖安装和恰好一条新建筑 Run；步骤 6 进入 in progress。旧 Run 不 retry、不改写，图纸研究保持不变。
- 首次记录授权的规划补丁因摘要中的英文 Step 6 与文件当前中文步骤不匹配而整体未应用；读取精确尾部后已完成记录，产品代码未受影响。
- Phase 42 安装前基线通过：`git diff --check` 无错误；Phase 41 安装版仍为 PID `29872`、端口 `11561`，`/health=ok`、`/desktop-health=2.2.10`，安装 EXE SHA-256 为 `4340E6918CB8663937FB762D81A31703FE4F5B96336CD45A7915AF66D5D8FA4D`；1 个 workspace、10 条历史 Run、活动 Run=0。
- 已完整读取 Windows 构建与安装器 smoke 脚本。构建输出将限定在工作区 `.artifacts/qa/phase42-subquestion-diversity`；覆盖安装前仍需再次确认活动 Run=0，并在精确停止安装版进程后保护 SQLite 哈希。
- Phase 42 候选安装器构建成功：`.artifacts/qa/phase42-subquestion-diversity/ArchResearch-Windows-x64-Setup-v2.2.10.exe`，69,769,520 bytes，SHA-256 `A4104C688013F9D4D0BB00C3C389906B04B193937C8AA09A7CF3E8496560A169`。冻结 EXE SHA-256 为 `13488684A685B64A8443B5FDE36604CC9097A9AC9045B2AF8A3A46AE58EE4856`，`--self-test` 退出码 0，Windows installer contract 通过，`manifest.json` 递归计数为 0。
- 宽泛名称审计报告 2 个包含 `extension` 的路径；精确复核为 Playwright 内部 `extension.js` 与 SQLAlchemy `cyextension`，均是冻结 Python 依赖，不是 `apps/extension`、Chrome manifest 或 extension-only 产物。安装器仍保持扩展分离合同。
- 首个保护安装命令把活动 Run 复核、精确停进程、数据库哈希、安装与重启组合在一起，被本地执行策略在运行前拒绝；旧 PID 仍在、安装器未运行、SQLite 未改。后续拆成五个小步骤执行。
- 拆分后的保护安装完成：覆盖前再次确认 10 条历史 Run、活动 Run=0，精确停止旧 PID `29872`；SQLite 安装前后 SHA-256 均为 `E2229DC80BB0793EE5D8279FF5C43D9E75E704D5292FD97E671770026B5156B2`。安装器退出码 0，已安装 EXE 与冻结 EXE SHA-256 均为 `13488684A685B64A8443B5FDE36604CC9097A9AC9045B2AF8A3A46AE58EE4856`。
- 新安装版已启动为 PID `11140`、动态端口 `14523`；`/health=ok`、Provider `OpenAI 兼容 API`、模型 `gpt-5.6-sol`、`/desktop-health=2.2.10`。启动后首个浏览器状态快照为 disconnected，需等待扩展按新端口重连后再创建 Run。
- 扩展桥随后自动重连，`/v1/browser/status.connected=true`；XHS 能力为 false，符合本次不使用视觉平台的建筑 Run。
- 一次把安装版自检和 API 基线放入并行工具调用的命令被策略在执行前拒绝，没有调用发生；改为分别执行。创建接口已从当前源码确认：`POST /v1/workspaces/{workspace_id}/runs`，本次 payload 只用全局建筑问题、`precedent_research`、`balanced` 和空 `research_sources`。
- 直接调用 GUI 子系统 EXE 时 `$LASTEXITCODE` 为 null，未采用；改用 `Start-Process -Wait -PassThru` 后安装版 `--self-test` 可靠退出码为 0。
- 创建前最终基线：workspace `00000000-0000-4000-8000-000000000001`，10 条历史 Run、活动 Run=0，扩展桥 connected，服务仍为 PID `11140`。现在只提交一次新建筑 Run 创建请求。
- 只创建 Phase 42 新建筑 Run `9fab66b8-feec-40fd-b4ae-feecc17124e0`：问题为全局入口/前场流线冲突与状态变化研究，`precedent_research`、`balanced`、`research_sources=[]`、`attempt=0`；初始状态 `created`。后续只等待自然终态并做只读审计，不取消、不 retry、不创建第二条 Run。
- 首轮只读轮询：Run 从 `planning` 自然进入 `searching`，Provider 已生成 4 个子问题；当前结果数 0、无停止原因。继续低频只读等待。
- Provider 生成的 4 个分支为 `flow-interface`、`state-change`、`arrival-sequence`、`service-integration`，均为通用建筑研究维度，没有项目名或案例特例。首个候选页正文分析为 `direct_match=false`，按原证据门拒绝，未形成正式资产。
- 新安装版现场 coverage 已实际返回 `projects_per_subquestion`，首个 gap-check 为四分支均 0；这证明 Phase 42 统计已进入安装运行时。Run 继续到 `state-change`，无停止原因。
- `state-change` 首轮未保留来源，coverage 仍为 0/4；Run 自然推进到 `arrival-sequence`，首个结构化搜索返回 4 个候选。当前无错误终态或停止原因，继续等待。
- 批量轮询脚本因工具缓冲不能提供中途快照，已仅终止该只读脚本；研究 Run 未取消或修改。恢复单次快照后，Run 已有 10 个 usable/verified-partial 资产、2 个项目，`arrival-sequence` 获 2 个不同项目并成为首个覆盖分支。
- 两个 `arrival-sequence` 来源均为 `direct_match=true` 且证据链 complete；coverage 为 `projects_per_subquestion={arrival-sequence:2, flow-interface:0, service-integration:0, state-change:0}`。Run 已自然推进到首轮 `service-integration`，无停止原因。
- 首轮 `service-integration` 无 direct-match 资产后，第二轮在核心覆盖不完整状态下按原顺序进入 `flow-interface`，符合 coverage-first 边界。该轮保留一个 Designboom 正文来源并完成视觉检视；当前 12 条持久化结果中 coverage 仍只计 10 条正式资产，等待正文分析结果。
- Designboom `flow-interface` 来源只形成 2 条 usable visual lead，未增加 `verified_or_partial` 或 `projects_per_subquestion`，说明占位预览没有冒充正式分支项目。
- 第二轮 `state-change` 的 Calgary Central Library 正文分析为 `direct_match=true`、4 条 supported facts、证据链 complete；coverage 现为 13 usable、3 项目、11 verified/partial、2/4 分支，项目分布 `arrival=2/state=1/flow=0/service=0`。Run 正在第二轮 `service-integration`。
- 第二轮 `service-integration` 两个来源未形成 direct-match；其中 Powerhouse Arts 的视觉浏览有 1 次 `BrowserCommandError`，但公共正文仍完成分析并按 `direct_match=false` 拒绝。Run 未失败，进入第三轮 `flow-interface`。
- 第三轮 `flow-interface` 搜索只返回 1 个候选且未保留来源，coverage 仍为 2/4。已覆盖的 `arrival-sequence` 与 `state-change` 后续应继续由 coverage-first 跳过，剩余机会用于未覆盖分支。
- 第三轮通过已缓存的 Montesanto Station 正文为 `flow-interface` 新增 6 条 supported facts，证据链 complete；同一项目同时支持 arrival 与 flow，结果数未虚增，项目分布变为 `arrival=2/flow=1/state=1/service=0`，coverage 3/4。
- 第三轮 `service-integration` query planning 因 `APITimeoutError` 使用通用 deterministic template，但 4 个候选均未保留。核心覆盖仍不完整，所以第 4 轮 recovery 直接从唯一未覆盖的 `service-integration` 开始，没有执行已覆盖分支；这不是软多样性重排，而是既有 coverage-first 行为。
- Recovery 第 4–8 轮都只执行唯一未覆盖的 `service-integration`；第 5 和第 8 轮结构化搜索为 0 结果，第 6 轮搜索超时，其余没有保留候选。最终 query index 32/32，coverage 仍为 3/4、13 usable、3 项目、11 verified/partial，项目分布 `arrival=2/flow=1/state=1/service=0`。
- Run 当前停留在最终 `gap_check` 之后等待自然终态，attempt 仍为 0、无 stop reason；不会取消或 retry。由于核心覆盖未达到 4/4，本次现场没有进入 Phase 42 的“核心覆盖完成后按项目数软排序”分支，不能用该 Run 宣称现场重排已触发。
- Run 已自然终止为 `partial/no_new_assets`、attempt 0：156 条 Trace、14 次 query-planning、15 次实际搜索（12 次有结果）、9 次正文分析（5 direct match、4 rejected）、1 次 deterministic query fallback、1 次 BrowserCommandError；XHS/图纸事件均为 0。
- Results 审计：13 total = 11 partial + 2 visual lead；3 个正式来源、3 个正式项目、同源名称分裂 0、正式占位名 0。50 条 fact claims 缺 URL/excerpt 均为 0；3 条 observation claims 使用 image region。正式 `service industry` 命中 0。
- 安装版 Board 异步加载后完整呈现：四问 dossier 为 `2/1/2/0`，总计 5；正式来源×分支的 4 个展示位全部存在，另一个为 Designboom 两张 visual lead 合并后的同一正文项目。后勤问题明确显示暂无结果，没有跨分支复制；页面无 `service industry`，控制台错误 0。Chrome 控制技能使本次 UI 审计采用实际安装版 Board，而非仅凭 API 推断。
- 只读对照 Phase 41 成功 Run：两次后勤首轮都使用 Designboom 域槽；旧 Run 的 `space_first + evidence_angle` 得到 4+2 候选并保留 Casino du Lac，本 Run 的 `space_first + project_context` 只有 1+2 候选且保留 0。后续 recovery 查询逐渐收窄为 `delivery/service vehicle stopping` 等少见字面组合，出现 0 结果或超时。
- 根因不是硬案例数量、Board 隐藏或筛选阈值，而是 query strategy 不稳定与 recovery 词形低召回。Phase 43 已作为 proposed 阶段写入，只允许通用 lane 合同与词形轮换；不使用旧 Run 项目名作规则。
- 最终门禁通过：`git diff --check` 无错误，`research_paths/drawing.py` 差异 0；安装版 PID `11140`、端口 `14523` 健康，扩展桥 connected，11 条历史 Run、活动 Run=0；安装/冻结 EXE 哈希一致，安装目录 `manifest.json` 计数 0。
- 用户以“开始”授权进入 Phase 43 源码与自动测试阶段。当前只处理建筑研究的全局查询策略：先写首轮互补 lane 与 recovery 语义轮换的行为红测，再做最小修复；不修改图纸研究、证据门槛、已完成 Run，也不构建安装或创建新 Run。
- Session catchup 确认 Phase 42 已完成、Phase 43 尚为 proposed，并检测到 10 条未同步上下文。第一次规划补丁因终端视觉换行与文件真实单行不一致而未应用；随后一次精确读取命令因嵌套 PowerShell 提前展开 `$lines` 而失败。两次均未改产品文件，改用精确单行补丁与无变量只读命令后恢复。
- 首次向 `findings.md` 追加 Phase 43 结论时误用了 `progress.md` 的末行作为补丁锚点，补丁未应用且源码未变；读取准确末尾后已补记。
- Phase 43 已切换为 `in_progress`，行为红测正在进行。源码定位到 `SearchQueryPlan`/`plan_search_queries()` 的双槽策略校验与 `planning.py` 的 deterministic recovery lane；下一步用抽象查询写 RED，先证明首轮 `project_context` 漂移会被接受、以及后期字面枚举可能主导 fallback。
- 已确认 workflow 的 query slot 分配：建筑首轮为 2，普通 recovery 为 1，特定候选失败恢复可再给 2；搜索预算会在调用前裁剪。Phase 43 将保留这些预算与轮次规则，只修每个槽承担的角色。
- 两次通用 query 探针先后因系统 Python 缺少 Pydantic、以及从错误模块导入 `ResearchGoal` 而失败；均为只读且无项目写入。改用 `apps/api/.venv/Scripts/python.exe` 和 `archresearch_api.schemas.ResearchGoal` 后成功，确认完整英文子问题在每轮被复写、round 4–8 lane 不再轮换。
- 一次并行只读检查因 `rg` 无匹配返回退出码 1，导致组合调用未展示其他结果；改用 `Promise.allSettled` 后完成。该错误没有修改文件。
- Phase 43 三条行为 RED 已稳定复现，结果 0/3：Provider 首轮接受 `space_first + project_context`；deterministic round 1 忽略双槽并返回默认 `project_context`；deterministic round 1–7 只有 4 个唯一查询、完整英文子问题每轮被复写且 late recovery 不轮换。步骤 2 完成，步骤 3 进入最小实现。
- 第一份生产补丁因 Provider 长提示的精确换行与补丁上下文不匹配而整体未应用，源码仍处于 RED；改为拆分小补丁并读取精确行后完成实现。
- Phase 43 三条目标行为初次转绿（3/3）：首轮 Provider context 漂移会触发纠错、deterministic fallback 使用明确 architecture lane、round 1–7 recovery 查询唯一且三类语义 lane 循环，完整 subquestion 不再逐轮复写。后续完整 browser 回归证明 deterministic 双槽会破坏公平预算，因此该测试已收紧为“单槽 discovery + 不额外耗预算”。
- 邻近回归首轮发现 planner 2 个兼容失败（未知英文/中文类型范围被一并删去）、Provider 7 个旧策略预期失败、browser fallback 1 个无关医院候选进入。前两类通过“简短声明范围”与按新 lane 更新抽象测试修正；后一类通过只对带结构化 anchors 的 `space_first` 放宽候选回退修正。planner + browser 邻近 23/23、Provider query-planning 邻近 19/19 均已通过。
- 一次并行回归调度因 JavaScript 变量重名产生语法错误，命令未执行；修正后同组通过。随后用于确认旧提示文案已清空的 `rg` 无匹配并返回退出码 1，这是预期的只读检查结果。
- 第一轮完整回归：Provider 88/88、workflow/verification/path 55/55 通过；browser 146/157，通过 146、失败 11，全部来自 deterministic 双槽改变搜索调用数与预算顺序。撤回 fallback 的第二次真实搜索、保留 lane strategy 后，browser 157/157 全绿。
- 只读通用 query 探针确认 round 1–7 唯一数 7、完整问题复写为 false；同时发现 late recovery 仍拼入过多显式维度，因此在正式全量门禁前补充“每条最多 3 个维度、按轮次轮换”的行为红测。
- 运营枚举有界测试先以 4 个维度稳定 RED，再转绿。第一次 API 全量为 3 个失败，均因限制误伤空间/构造词；把限制收窄到含运营核验维度的长枚举后，4 个定向行为 4/4 通过。
- 第二轮最终源码门禁全绿：API 全量全部通过；Ruff lint 通过；62 文件 format check 通过；strict Mypy 对 32 个源文件无问题。测试环境仍只有既有 Starlette/SQLite 弃用警告。
- 收集确认 API 共 607 个测试；最终 `git diff --check` 通过，`research_paths/drawing.py` 差异为 0。安装版 PID `11140`、端口 `14523` 仍为 `ok/openai/gpt-5.6-sol`、版本 `2.2.10`；Run API 返回 11 条历史 Run、活动 Run=0。
- Phase 43 步骤 4 完成，步骤 5 保持 pending authorization。本阶段没有构建、安装、retry 或创建 Research Run；唯一下一步是等待用户授权一次保护安装与一条新建筑 Run。
- 用户以“可以开始”明确授权 Phase 43 的构建、保护性覆盖安装与恰好一条新建筑 Run。步骤 5 进入 in_progress；授权不包含 retry 旧 Run、第二条 Run 或图纸研究。
- Planning session catchup 检出 5 条未同步上下文；`git diff --stat` 与 Phase 43 计划/末尾记录一致，工作树既有修改全部保留。
- Phase 43 安装前基线：11 条历史 Run、活动 Run=0；当前安装版 PID `11140`、端口 `14523`。已完整读取 Windows 构建和安装器 smoke 脚本，确认 smoke 不允许覆盖现有安装，因此现场采用既有保护性覆盖流程，不直接运行卸载 smoke。
- 数据目录确认在 `%LOCALAPPDATA%\ArchResearch\data`，SQLite 为 `archresearch.db`；构建输出将限定在 `.artifacts/qa/phase43-query-lane-stability`。
- Phase 43 候选构建完成。安装器 69,772,830 bytes、SHA-256 `FA6CFDABDF9D3DB260329941FC79F67BA01A8824D24959559E0D9ED0E20DB1A0`；冻结 EXE 18,000,318 bytes、SHA-256 `CE47B35AA558DF6116245FBBB6C68219C625AF3360BE805B1ACE97FE7BD759B1`。
- 候选冻结自检退出码 0，Windows 安装器契约通过；冻结目录 `manifest.json=0`、扩展专属路径=0。旧安装进程 PID `11140` 仍在运行，尚未执行覆盖安装或创建 Run。
- 最终正确解析 Run API 为 11 条历史 Run、活动 Run=0；首次使用 `@(...)` 包裹 `Invoke-RestMethod` 时把返回数组嵌套成单元素，显示的总数 1 不可采用，改用返回数组本身的 `.Count/.Where()` 后确认基线。
- 服务运行时 SQLite 被独占，在线 `Get-FileHash` 只读失败且无数据改动。校验安装路径后已精确停止 PID `11140`，安装前数据库为 2,985,984 bytes、SHA-256 `9B7D9C3DC084827F7E5BCBA27F2D6DBD767B151933D8678D77B37B2D21EA26DF`；下一步执行候选覆盖安装。
- Phase 43 保护性覆盖安装成功，安装器退出码 0。SQLite 安装前后 SHA-256 均为 `9B7D9C3DC084827F7E5BCBA27F2D6DBD767B151933D8678D77B37B2D21EA26DF`；安装 EXE 与冻结 EXE SHA-256 均为 `CE47B35AA558DF6116245FBBB6C68219C625AF3360BE805B1ACE97FE7BD759B1`，安装版自检退出码 0。
- 新安装版 PID `43912`、动态端口 `3303`，健康为 `ok/openai/gpt-5.6-sol`、版本 `2.2.10`，扩展桥已重新连接；安装目录 `manifest.json=0`、扩展专属路径=0。尚未创建 Phase 43 Run。
- 创建前再次确认 11 条历史 Run、活动 Run=0、扩展桥 connected；唯一 POST 创建 Run `3d85f4f0-1988-41b9-9e83-47e11e3bb4b9`，初始状态 `created`、attempt 0。后续只做低频只读轮询和终态审计，不取消、不 retry、不创建第二条 Run。
- 首次现场快照：Run 已自然进入 `searching`，4 个子问题生成。`spatial_relations` 首轮实际策略为 `space_first + evidence_angle`，首个结构化 ArchDaily 搜索返回 4 个候选；attempt 仍为 0、无停止原因。
- `spatial_relations` 首轮两次搜索均返回 4 个候选，正文来源 `direct_match=false`，coverage 仍为 0/4；3 个视觉 leads 没有冒充正式项目。`user_experience` 首轮计划继续为 `space_first + evidence_angle`，当前无 Browser error。
- `state_change` 首轮实际为 `space_first + evidence_angle`，8 个候选保留 3 个；2 个正文 direct-match、1 个拒绝。gap-check 为 11 usable、2 个项目、覆盖 1/4，项目分布 `state_change=2`、其余 0；Run 继续进入首轮 `site_conditions`。
- 四个子问题首轮计划全部实际为 `space_first + evidence_angle`。首轮后为 15 usable、4 项目、覆盖 2/4；第二轮两个未覆盖分支均按单槽 `space_first` 的空间关系 lane 执行。
- `spatial_relations` 通过缓存 Nanterre 正文的确定性 page-analysis fallback 获得 2 条来源事实；`user_experience` 新项目正文 direct-match、5 条事实、证据链 complete。最新 gap-check 为 25 usable、5 项目、覆盖 4/4、`gaps=[]`，每问项目数 `3/1/2/1`；软数量提示未阻止流程自然继续。
- 第三轮实际先执行项目较少的 `spatial_relations`、`user_experience`，策略均为 `evidence_angle`；Tribut Stadium 为 user 分支增加 4 条支持事实后，Run 自然完成为 `completed/coverage_satisfied`、attempt 0，33 usable、7 项目、4/4、`gaps=[]`、`enrichment_gaps=[]`，项目分布 `5/1/2/2`。
- 终态 Trace 为 133 条、query planning 10（全部 Provider）、搜索 14（12 有结果、2 TimeoutError）、正文分析 14（10 direct-match、4 rejected）、确定性 page-analysis fallback 2、browser failure 0、XHS 0。
- 首次按摘要文本搜索 `drawing` 把 14 个正文事件中的 `drawing_count` 字段误计成图纸事件，该数字作废；后续按 event tool/goal 重算。Results 初步 39 条，不能把全部 32 个 partial 都当 coverage 正式项目，Legacy/Plaine 无正式 subquestion analysis；Board-ready 项目应按既有分支证据门审计为 7 个。
- 第二次自动筛选尝试直接读取空 `PSObject.Properties.Count`，一度把 7 个视觉线索混入正式集合并得到 8 项目/3 同源分裂/7 占位名；该结果与 Board 冲突并作废。改为过滤非空属性名后，Board-ready 为 19 资产、7 来源、7 项目、同源分裂 0、占位名 0。
- Board-ready 证据链为 97 条 fact claims，缺 URL/excerpt 均为 0；5 条 observation claims 均有 image region。Trace 按 tool 重算 XHS=0、drawing/visual-reference=0。
- Chrome 控制技能打开实际安装版 Board，程序化确认 10 个 dossier、四问分布 `1/2/2/5`，每问来源 URL 唯一；2 个确定性回退均显示“待核验假设”，Legacy/Plaine 不展示，`service industry` 为 0。
- 源码只读确认 `evidence_angle` 在底层结构化搜索被统一映射到二值 `search_scope=project_context`；这解释 Trace 标签，不代表策略退化。query-planning 记录仍为首轮四问双 lane、第二轮 `space_first`、第三轮 `evidence_angle`。
- Phase 43 最终门禁通过：`git diff --check`、图纸差异 0；安装版 PID `43912`/端口 `3303` 健康，扩展 connected、12 条历史 Run、活动 Run=0；安装 EXE 哈希与候选一致，安装目录 `manifest.json=0`、扩展专属路径=0。
- Phase 43 已标记 completed。唯一 Run 不 retry、不改写，未创建第二条 Run；图纸研究未修改、未参与现场流程。
- 用户授权正式发布 `v2.3.0` 并要求整理工作区、提交发布更新。已启用 planning-with-files 与 GitHub publish 技能；Phase 44 建立为 in_progress。
- Session catchup 检出 17 条未同步上下文；重新读取 Phase 43 计划/发现/进度并核对 `git diff --stat`，当前 18 个 tracked 修改文件、`.artifacts/ci/` 与 `.planning/` 两个未跟踪目录。
- 发布基线确认远端 latest 为 `v2.2.10`，本地版本合同和 CI 仍硬编码 `2.2.10`；`v2.3.0` 必须作为新 tag/Release，从同一最终提交生成独立 Windows 与 Extension 两个附件。
## 2026-08-09 — Phase 44 发布审计脚本失误

- 首次并行只读审计脚本因 JavaScript 多余右括号而在调用任何仓库命令前失败。
- 影响：无文件、Git 或发布状态变更；改用校正后的脚本继续。
## 2026-08-09 — Phase 44 分支基线确认

- `git fetch origin --prune` 后确认 `origin/main=a2ff995`，当前 HEAD 与主线为 14/1 分叉；不会直接从旧分支历史开 PR。
- GitHub CLI 已登录且发布权限可用。当前相对主线的产品/测试/记录范围已冻结，图纸研究实现差异为 0。
- 本地 `.artifacts/ci/` 与 `.planning/` 不删除，只加入忽略规则；下一步完成 `2.3.0` 全表面版本统一和发布说明。
## 2026-08-09 — Phase 44 发布文件审计路径修正

- 一组并行只读检查引用了不存在的旧脚本名 `scripts/package-extension.ps1` 与 `scripts/build-windows.ps1`，因此该分组退出码为 1；没有修改任何文件或 Git 状态。
- 仓库实际构建入口为 `scripts/build-extension-package.ps1` 与 `scripts/build-windows-installer.ps1`，后续按真实路径继续。
## 2026-08-09 — Phase 44 版本表面冻结

- API、Board、Extension package、Extension manifest、FastAPI 元数据、README、GitHub workflow 与 release contract 已统一为 `2.3.0`；当前代码/发布表面已无 `2.2.10` 残留，历史验收记录保持不变。
- README 新增 v2.3.0 用户摘要，明确两条研究路径拆分、建筑检索 lane 优化、图纸浏览器/笔记路径修复，以及“子问题案例数不是硬配额”。
- `.gitignore` 新增 `.artifacts/ci/` 与 `.planning/`，本地缓存没有删除且不再出现在待提交状态。
- `scripts/tests/release.tests.ps1` 通过，`git diff --check` 通过，图纸研究实现文件相对 `origin/main` 差异为 0。
- 构建脚本审计命令还引用了一个不存在的 `scripts/build-windows-exe.ps1`，导致该只读子命令退出码 1；实际 Windows 构建入口已完整读取且为 `scripts/build-windows-installer.ps1`，没有状态改动。
## 2026-08-09 — Phase 44 第一轮完整门禁

- `scripts/verify.ps1` 第一轮在 Ruff format check 退出 1：API `607 passed`，前置 release/windows/security/process/autostart/evaluation 合同均通过；`apps/api/src/archresearch_api/__init__.py` 与 `main.py` 因版本号编辑后的格式需要规范化。
- 这是格式门禁失败，不是功能测试失败；只运行 Ruff formatter 处理这两个文件，然后从头重跑权威门禁。
## 2026-08-09 — Phase 44 权威门禁全绿

- 格式修正后从头运行 `scripts/verify.ps1`，退出码 0，用时 177.8 秒。
- 结果：API 607/607、Board 190/190、Extension 216/216、packaged MV3 E2E 8/8；Ruff lint/format、strict Mypy 32 source files、前端 lint/typecheck、production build、release/windows/security/process/autostart/evaluation 合同全部通过。
- 门禁后没有 fixtures 或图纸研究实现差异；工作树只保留已冻结的 v2.3.0 发布范围。
- 本机已有用户安装版 PID `43912`，正式 smoke 脚本按设计拒绝覆盖现有安装。不会为本地 smoke 卸载用户安装；本地构建执行冻结 EXE self-test，完整安装/启动/卸载 smoke 由干净 GitHub Actions runner 执行。
## 2026-08-09 — Phase 44 本地双产物完成

- Chrome 扩展 ZIP：`.artifacts/releases/archresearch-chrome-extension-only-v2.3.0.zip`，20,530 bytes，SHA-256 `32E52AF8A7D3489A6367A5D0F1EFDB1B1E8A9018AAA1109B2EC669DC29AE7DEC`；11 entries，根 manifest `2.3.0`。
- Windows 安装器：`.artifacts/releases/ArchResearch-Windows-x64-Setup-v2.3.0.exe`，69,769,701 bytes，SHA-256 `36FD8847915D48F8428E165CE4D3F751ADEC2DF09A63D435FCD579B5E9F80895`；Product/File version 均为 `2.3.0`。
- 冻结 EXE 为 18,000,317 bytes、SHA-256 `7F96EC4B0471A96CA9AD8CDD862C9DC573E6CC2046060BD0497FBED4F6780747`，构建内置 self-test 已通过。
- Windows bundle 中 `manifest.json=0`、Extension 专属文件计数 0；安装器与 Chrome 扩展继续为两个独立附件。
- 相对 `origin/main` 的新增行敏感信息扫描：API Key 赋值 0、`sk-` secret prefix 0、private key block 0。正式提交范围为 28 个 tracked 文件，忽略产物未进入状态。
