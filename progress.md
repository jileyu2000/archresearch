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
- 未 reset、checkout 或 clean；本地恢复和 Provider 兼容性修改已提交为 `e9736c8` 并推送到 `agent/local-release-v2.2.2`，v2.2.2 tag/Release 尚未创建。
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
- `scripts/test-windows-installer-package.ps1` 真实安装、启动自检、扩展排除和卸载 smoke 通过；当前分支已提交并推送，尚未创建 v2.2.2 tag/Release。

## 2026-07-31 Release verification

- 权威门禁核心阶段通过：API 401/401、Board 178/178、Extension 165/165、packaged E2E 8/8，Ruff、strict Mypy、前端 lint/typecheck/build、Windows 安装器合同和真实安装 smoke 均通过。
- 外层 `scripts/verify.ps1` 在最后的根级 `pnpm check` 收尾时超过工具 180 秒窗口；随后独立执行 `pnpm run check` 退出码 0，未发现代码或构建失败。
- 用户已授权创建分支 PR、`v2.2.2` tag 和 GitHub Release；Release 标题固定为“ArchResearch 本地版 v2.2.2”，正文只描述 Windows/Chrome 本地产品，附件为 Windows 安装器与独立 Chrome 扩展 ZIP。
