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
