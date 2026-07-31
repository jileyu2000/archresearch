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
- `git diff --check` exit 0；`HEAD`、`main`、`origin/main` 均为 `87826af`。

## Release candidate

- 扩展 ZIP：18,260 bytes，SHA-256 `9D554576B6DDAAD705EC4E66B1D948EB2305A749CAEFAE40144EC04D8FAD0902`。
- Windows 安装器：69,681,830 bytes，SHA-256 `F859C66720D0A493950653F2178E34C7955CBF7D838CD4569C36D994A30162A1`。
- 两个文件都只存在 `.artifacts/releases/` 并已上传到 [v2.2.2 Release](https://github.com/jileyu2000/archresearch/releases/tag/v2.2.2)；tag 指向 `5637ee0`，PR #11 保持草稿状态。

## Constraints

- 不恢复 Firecrawl、Web/Edge、Cloudflare 或公共 HTTPS 扩展桥。
- 不调用会导致桌面应用闪退的内部浏览器。
- 默认验证不读取用户 Cookie、Chrome 会话或 Provider Key，不创建或重试真实研究。
- 不 reset、checkout 或 clean；本轮用户已明确授权提交、推送、tag 和 Release。
- 本轮只读复核曾假设根级 `tests` 和 `provider_runtime.py` 存在；实际路径分别是 `apps/api/tests`，Provider runtime 定义位于现有 credential 模块。错误命令未写文件，也未重复。
