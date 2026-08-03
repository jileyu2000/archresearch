# ArchResearch 新会话交接

> 本文件只保留当前为真的状态、保护规则和单一下一步。旧里程碑叙事在 `docs/history/`、`findings.md` 与 `progress.md`。

## 新会话启动顺序

1. 完整阅读本文件。
2. 阅读 `AGENTS.md`。
3. 阅读 `task_plan.md` 中状态为 `in_progress` 或 `proposed` 的阶段。
4. 阅读 `findings.md` 和 `progress.md` 末尾；需要旧根因时再查历史归档。
5. 运行 `git status --short --branch`，保留全部既有修改和未跟踪文件。
6. 开始动作前复述当前状态、下一步和验证标准。

## 当前产品决策

- Cloudflare Web Edition 已由用户在 M179 正式终止。当前唯一产品是 Windows/Chrome 本地优先 ArchResearch：FastAPI、Python workflow、SQLite、本地文件、用户自己的 OpenAI-compatible API 地址和 Key，以及单独安装的 Chrome 扩展。
- `apps/web`、`apps/edge`、Wrangler/Worker 配置、Web-only 验证脚本、公共 HTTPS 扩展桥和公共 XHS adapter 已删除，不得恢复。
- 普通用户通过 Windows 安装器获得自包含本地服务与生产 Board，不需要 Python、Node.js、pnpm 或 PowerShell。安装器不捆绑扩展；扩展作为独立 ZIP 发布。
- 首次配置明确要求 API 接口地址、模型名称和 API Key；模型名称从上游 `/models` 获取，桌面只读下拉框和脚本序号选择都不允许手输模型 ID。只探测用户选中的模型，先 Responses 再 Chat Completions；成功后保存地址、模型和协议。`gpt-5.6-sol` 仅用于旧配置缺字段兼容，不是新配置默认。Key 只进入 Windows Credential Manager，不进入仓库、日志、默认测试或备份。
- 桌面启动器优先使用回环端口 8000；冲突时自动选择空闲端口。生产 Board、API、健康检查、Chrome URL 和扩展 endpoint 必须使用同一端口。
- 公开建筑网站由本地 FastAPI workflow 与 Direct Playwright 处理。登录态小红书由单独安装并配对的 Chrome 扩展处理；源码环境可先使用 OpenCLI 再回退扩展。图纸 Run 创建前必须通过受限的小红书会话预检；未登录、未知或通道不可用时 fail closed。
- 不恢复 Firecrawl、Pinterest、TinEye/来源反查、通用视觉网页降级、平台案例库、全局向量索引或多 Agent runtime。
- 图纸灵感 XHS-only fail-closed：每方向按 rank 最多 4 帖，累计 3 篇 usable；每帖最多 4 图；全任务 48 个图像槽位 / 48 MiB。全部路径失败时诚实终止。
- 正式建筑事实必须绑定自己的 URL 与逐字引文。图片只作可选预览和出处入口，不证明机制。coverage 与 enrichment 同时达标才 `completed`。
- 新 Run 默认保留 180 天，可逐条永久；`keep_forever` 同时豁免 Run 和子数据。收藏是独立累加快照，删除只能由用户显式执行。
- 单活研究租约：已有活动 Run 时新建或重试返回 409。打开应用永远落主页，后台研究不劫持首屏。

## 仓库与保护规则

- 仓库：`https://github.com/jileyu2000/archresearch`
- 远端 `main` 当前为 `a7fa84a`（已用 `git fetch origin main` 和 GitHub API 核实）；本地 checkout 保持在 `agent/local-release-v2.2.2`，HEAD 为 `d34b0c3`。
- 本地 `origin/main` tracking ref 已更新到 `a7fa84a`；没有 pull、checkout、reset 或 clean。
- 本轮恢复基线：`1695973`，它是最后一个经过 Hosted CI、完整本地门禁、真实安装升级、`--self-test`、`/desktop-health` 和 `/health` 验证的本地发行提交。
- 恢复通过 `git show 1695973:<path>` 和定点补丁完成，不得使用 reset、checkout 或 clean。
- 当前工作树包含有意的本地恢复、Web/Edge 删除、文档和计划修改；`.artifacts/build/`、`.artifacts/qa/`、`.artifacts/releases/` 保留。
- 不执行 `git add -A`、提交、推送、tag、Release 修改或 Worker 部署，除非用户另行明确授权。
- 不调用会导致桌面应用闪退的内部浏览器。默认验证不得读取用户 Cookie、账号会话、Provider Key 或创建真实研究。
- 旧生产 Web URL 不得进入仓库、Release 或 repository metadata。

## M179 完成状态

已从 `1695973` 非破坏性恢复并完成定向验证：

- `apps/api/src/archresearch_api/desktop.py`
- 动态回环端口和严格 Chrome URL allow-list
- Windows Credential Manager 首次 Provider 配置
- PyInstaller launcher、Inno 安装器、图标生成器
- 安装器构建与真实安装 smoke 脚本
- 本地扩展状态、权限、手动配对和断开
- Board 从当前 loopback origin 派生 WebSocket endpoint
- 真实 FastAPI + packaged Chrome Extension E2E

最终已通过：

- Desktop tests：8/8
- API browser tests：29/29
- Board bridge tests：7/7
- Extension local UI/background：14/14
- Board App/result/bridge focused tests：109/109
- 权威 `scripts/verify.ps1`：389 API / 178 Board / 165 Extension / 8 packaged E2E
- Ruff/format、strict Mypy、Board/Extension lint/typecheck/test/build、进程、安全、评测与 Windows 发布合同
- Packaged Extension E2E：8/8，包含真实 FastAPI、一次性配对、浏览器裁图和本地 PNG 资产读取
- Windows 安装器真实安装 smoke：快捷方式、精简 `PATH` 下 `--self-test`、不捆绑扩展、静默卸载清理
- 冻结入口所用 FastAPI desktop app 的 `/desktop-health` 与 `/health` 行为测试
- `git diff --check` 与 Web/Edge/Cloudflare 非历史残留扫描

已删除并完成共享层收口：

- `apps/web`
- `apps/edge`
- `scripts/verify-web.ps1`
- Extension public HTTPS bridge/controller/public XHS adapter 及其测试/build entry
- Board public-edition-only 协议、测试、视觉来源分支和 Turnstile 样式
- pnpm workspace/lockfile 中的 Web、Edge、Wrangler、workerd 与 Cloudflare package 条目

根 `package.json`、`pnpm-workspace.yaml`、`scripts/verify.ps1`、release contracts 与 `.github/workflows/verify.yml` 已恢复为本地 Windows 发布方向。README、PRODUCT、DESIGN、architecture、extension、demo、development、failure 与 AGENTS 已同步本地单入口。

本地发布候选：

- `.artifacts/releases/archresearch-chrome-extension-only-v2.2.2.zip`
  - 18,260 bytes
  - SHA-256 `9D554576B6DDAAD705EC4E66B1D948EB2305A749CAEFAE40144EC04D8FAD0902`
- `.artifacts/releases/ArchResearch-Windows-x64-Setup-v2.2.2.exe`
  - 69,681,830 bytes
  - SHA-256 `F859C66720D0A493950653F2178E34C7955CBF7D838CD4569C36D994A30162A1`

## Provider 配置合同修正已完成

- 新安装明确要求 API 接口地址、模型名称和 API Key；模型名称只从上游 `/models` 只读列表取得，桌面不允许手输模型 ID，脚本只输入序号。
- `gpt-5.6-sol` 只保留为旧配置缺字段的兼容默认；新配置不会自动选择列表第一项。
- 完整门禁：API 395 / Board 178 / Extension 165 / packaged E2E 8；Ruff、strict Mypy、前端 lint/typecheck/build、配置/安装器/Release contracts 全部通过。
- 隔离构建的 Windows 安装器已完成真实安装 smoke，产物位于 `.artifacts/releases/provider-contract-v2.2.1/`，SHA-256 `AD575B9206F8A3B4B8C1774FCD5732862B86D113F677310E37FFA7C27C965489`；旧 `.artifacts/` 内容未清理或覆盖。
- 外部兼容 smoke 只使用临时内存：最新验证中根地址和带 `/v1` 的 `/models` 都返回 23 个模型；但将根地址原样交给应用同款 OpenAI 客户端时，`/responses` 探测失败，带 `/v1` 的 base URL 返回 23 个模型，兼容模型的 Responses structured output 通过；没有保存 Key、配置或研究数据。

## Provider endpoint compatibility correction

- 用户可填写服务根地址或完整 API 路径；首配只在同一主机尝试原地址、`/v1` 和根地址的 `/api/v1`，先读取模型列表，再只探测用户选中的模型。
- 根地址模型列表可读但结构化请求失败时，程序会继续尝试后续候选，并把探测成功的 Base URL 保存到 `provider.json`；DeepSeek 根地址可直接通过时则保留根地址，不强行追加 `/v1`。
- 完整 `scripts/verify.ps1`：401 API / 178 Board / 165 Extension / 8 packaged E2E，Ruff/strict Mypy、前端 lint/typecheck/build、Windows 安装器合同和真实安装 smoke 全部通过。
- 当前版本面统一为 `2.2.2`；GitHub Release 标题和 README 主标题应使用本地 Windows/Chrome 产品文案，不得退回“仅 Chrome 扩展”。

## v2.2.2 GitHub 发布状态

- 分支 `agent/local-release-v2.2.2` 已推送；当前最新提交为 `2429277`，`v2.2.2` tag 仍指向发布提交 `5637ee0`。
- PR [#11](https://github.com/jileyu2000/archresearch/pull/11) 已合并到 `main`，远端 squash merge commit 为 `9196119`。
- 正式 Release [ArchResearch 本地版 v2.2.2](https://github.com/jileyu2000/archresearch/releases/tag/v2.2.2) 已发布，非草稿、非预发布。
- Release 附件为 Windows 安装器和独立 Chrome 扩展 ZIP；GitHub 侧名称、大小和本地 SHA-256 记录一致，文案未包含生产 Web URL 或 Provider Key。
- 为修复 PR coverage 门禁，新增 `apps/extension/tests/screenshot.test.ts` 的 9 个裁图行为测试；未修改生产代码，也未降低 coverage 阈值。

## v2.2.2 PR CI 状态

- GitHub Actions `verify` run `30633778406` / job `91166171854` 已于 `2026-07-31 13:31:45 UTC` 完成并成功。
- 管理文档提交 `d52da0d` 触发的最新 `verify` run `30636022102` 已于 `2026-07-31 14:09:09 UTC` 完成并成功；coverage、完整本地门禁、独立扩展 ZIP、Windows 安装器和真实安装 smoke 全部成功。
- PR #11 随后已从 Ready 合并到 `main`；本轮没有修改生产代码。
- 本次 coverage 修复没有改变 `v2.2.2` Release tag 或附件，不重新发布 Release。

## PR merge 状态

- 最新 head `2429277` 已通过 `verify` run `30637527995`，并于 `2026-07-31 14:34:44 UTC` squash merge 到远端 `main`。
- 远端 `main` 当前为 `9196119`；本地 checkout 仍停留在 `agent/local-release-v2.2.2`，未自动 checkout 或 pull。

## 源码开发页与 GitHub 发布版

- 已验证源码开发模式由 `scripts/start.ps1` 启动 Vite Board 与 FastAPI API：当前页面为 `http://127.0.0.1:5173/`，API 为 `http://127.0.0.1:8000/`，页面标题为 `ArchResearch Board`。
- GitHub Release 不是在线网页部署；Windows 安装器包含同一套 API 与生产 Board，优先使用单一回环端口 8000，冲突时选择空闲端口；Chrome 扩展作为独立 ZIP 发布。
- 对比发布提交 `5637ee0` 与当前 HEAD `2429277`，`apps/api`、`apps/board`、`apps/extension` 的生产代码没有差异；后续差异仅为扩展截图测试和 Windows 安装器元信息。
- 当前工作树包含本阶段的 Provider 失败回退代码、定向测试、管理文件修改，以及 `.artifacts/build/`、`.artifacts/qa/`、`.artifacts/releases/` 未跟踪产物。

## 当前研究失败修复

- 图纸 Run `06843b31-d478-4b82-959f-49c1f15e65be` 失败根因是远程视觉分类认证/连接错误；已下载图片现在走受限本地确定性分类，仍保留小红书来源和视觉线索边界。
- 建筑 Run `4e304e27-68e2-4beb-8fb2-88a858c676c8` 失败根因还包括网页正文分析和最终综合的 Provider 错误；正文回退只复用已读取页面原句并建立 EvidenceClaim，综合回退使用已有确定性综合。
- 零覆盖 retry 现在刷新本次有界视觉/浏览预算，并重新执行没有形成证据的旧查询；已有覆盖的部分结果仍按原逻辑只补缺口。
- 图纸 Run 已在 attempt 2 真实完成：`completed / coverage_satisfied`，34 个结果、3/3 方向覆盖、9 个来源项目。
- 建筑 Run 已在 attempt 2 真实完成：`completed / coverage_satisfied`，36 个结果、4/4 正文覆盖、6 个项目、79 条 EvidenceClaim；正文分析和最终综合均记录确定性回退。
- 完整 API 测试套件、Ruff lint/format、strict Mypy 和 `git diff --check` 已通过；本地 API `http://127.0.0.1:8000` 与 Board `http://127.0.0.1:5173` 正常运行。
- 本任务不增加 token、费用或 Provider 用量统计；用户自行查看梭子蟹后台。不得读取 Key，不调用 Codex 内置浏览器。

## 完成结果可见性修复

- 建筑 Run `4e304e27-68e2-4beb-8fb2-88a858c676c8` 的 36 条结果中，22 条有逐题正文分析，但确定性回退保留英文来源原句，旧 Board 中文门槛把它们全部过滤为空。
- Board 现在只放行逐题关联一致、中文回退动作与边界存在、条件和机制均精确绑定 EvidenceClaim 的确定性回退；一般旧英文图片线索仍不能升级为正式案例。
- 来源句以“来源原文：”明确显示，不伪装为中文模型分析。真实页面四个章节分别显示 3/3/2/1 个案例，空状态均为 0。
- Board 15 个测试文件、179 项测试、lint、typecheck、production build 和 `git diff --check` 全部通过。
- 本阶段只修改 Board 转换逻辑、行为测试与管理记录；`.artifacts/build/`、`.artifacts/qa/`、`.artifacts/releases/` 继续保留为未跟踪，不 push。

## Xiaohongshu 首次登录预检基线

- 新增 `POST /v1/browser/xiaohongshu-session`，只返回 `logged_in | not_logged_in | unknown | unavailable` 和 `local_search | chrome_extension | none`；Cookie、账号、命令输出和 Provider Key 不进入 API、日志或响应。
- OpenCLI 只执行固定只读 `auth status --site xiaohongshu --timeout 8 -f json`；扩展只允许枚举动作 `xiaohongshu_session_status` 在受管 `xiaohongshu.com` 标签页执行。
- Board 进入图纸模式后自动预检，提交前再次确认；并发检查共用同一请求。只有 `logged_in` 可以创建图纸 Run，其他状态显示固定登录入口和“重新检测”。建筑研究不调用该预检。
- 权威 `scripts/verify.ps1`：API 485、Board 181、Extension 182、packaged E2E 8；Ruff、strict Mypy、ESLint、TypeScript、生产构建、发布和安装器合同全部通过。
- 真实本地 endpoint 返回 `logged_in/local_search`；项目 Playwright 已验证桌面/移动真实登录态和模拟未登录 fail-closed，未登录时 Run POST 为 0。截图位于 `.artifacts/qa/xhs-login-preflight/`。
- 本阶段没有创建或重跑真实研究 Run。此前 4/4 正式验收和 `v2.2.3` Release 基线保持不变。

## 当前唯一下一步

Phase 15 正在执行 3 条建筑 + 3 条 XHS-only 稳定性验收，正式通过计数仍为 0/6。第一条新建小学 Run `f32d16e9-39b8-4998-a5a1-d2cca8c7e73f` 为 `partial`，保留但不 retry、不计验收。

正式建筑搜索已从逐类型词表改为通用结构化锚点合同：OpenAI 普通 Responses 必须为每条查询返回建筑类型、项目条件、空间机制、证据类型和可选项目名；Pydantic 校验锚点真实存在于查询，本地 Playwright 首查和站点宽化原样携带锚点，workflow Trace 标记 `structured_query=true`。旧字符串解析只保留给 Provider 失败或旧 mock，正式验收不得依赖。

结构化锚点修复后的首个新类型 Run `792ab5f7-a923-4918-badc-da6ca150df14`（新建社区体育中心）为 `blocked/research_synthesis_incomplete`、0/3，保留但不 retry、不计验收。它的 15 次查询规划、15 次本地结构化搜索和 15 次候选筛选均成功、fallback=0；根因是后续轮次只收到笼统 coverage gap，未收到“无候选、候选全拒、正文不支持”等阶段反馈，机械重复同一类型名称。

workflow 现按子问题回传 `local_search_no_candidates`、`no_new_local_candidates`、`candidate_reranking_rejected_all` 和 `public_page_analysis_incomplete`；模型在候选不足时使用自己生成的语义等价建筑类型名称，禁止泛化为 `public building` 或相邻类型。

游泳馆 Run `f0a4d691-1360-46ef-bba6-efbf88385a0f` 首次规划因 anchor 与 query 只差连接词位置而触发 `ValidationError`，已立即取消以节省预算，不计验收。Pydantic 现按拉丁词项包含与中文连续子串混合校验，允许语法连接词位置和中文连写差异，真正缺失建筑类型仍拒绝；同一真实子问题隔离规划已成功。

当前环境中的 Bing/Google 等通用搜索引擎不能稳定返回本地 Playwright 候选，相关半成品已撤回。通用恢复改为：继续轮换可靠建筑站点；可信具体项目正文不足时，按项目名逐站点补查最多两个其他来源，并只绑定实际读取到的逐字原文。

主搜索与跨来源补证共享 Run 总查询额度；任意建筑类型正式路径只依赖 Pydantic 结构化锚点，不依赖逐类型词表。

新建城市消防站 Run `4a6f582b-67c3-49b1-abb9-362fbe316254` 为 `blocked/research_synthesis_incomplete`、0/3，不计验收。15 次本地搜索正好达到 quick 共享总额度；11 次模型规划有 3 次因 query/anchor 偶发不自洽进入 fallback，跨站结果又因同项目标题语序变化未进入正文读取。

通用修复保持严格锚点校验，首次无效查询计划最多纠正重试一次；同项目跨站标题允许完整短语或保守长标题词项匹配，短名称近邻保持拒绝。相关五文件 310/310、Ruff、55 文件格式检查、strict Mypy 26 个源文件和 `git diff --check` 全绿。

市政档案馆 Run `17bd42b6-7793-45ea-b8af-973b7a855abb` 为 `blocked/research_synthesis_incomplete`、0/3，不计验收且不 retry。13/13 次模型规划成功且 fallback=0，但 15 次本地搜索和 13 次候选筛选只保留 1 页，3 次正文分析均 `direct_match=false`。项目 Playwright 诊断确认当前 ArchDaily/Designboom 对这类稀有建筑的召回不足。

不往生产代码追加档案馆、学校、消防站等类型专用词表。新的通用稳定性门槛是：正式主路径不按建筑类型分支；模型输出受 Pydantic 约束的查询策略；站点轮换依据实际无候选、全拒绝和正文不足产出；每次修复必须经过任意未见类型参数化测试、全回归和修改后盲测题。

当前 API 健康、活动 Run 为 0，正式验收仍为 0/6，未提交、未发布。

通用红测与最小实现已完成：Pydantic `SearchQuery` 枚举 exact typology、professional equivalent、named precedent 和 evidence angle 四类策略；候选/正文失败后在共享总额度允许时最多生成两条不同策略；每个子问题的低产出站点会先让位给尚未尝试的支持站点；任意结构化建筑类型直接从模型 building-type 锚点做通用匹配。

完整 API 509/509、Ruff 全范围、64 文件 format check、strict Mypy 26 个源文件与 `git diff --check` 全绿；新增生产差异扫描未出现任何验收题或盲测题类型名。当前仍无活动 Run、正式验收 0/6、未提交、未发布。

真实 SearchQueryPlan 隔离调用已经成功；修改后才选定的新建城市渡轮客运码头 Run `34626a55-dbdb-46c6-920d-dc394ecb2651` 已自然终止为 `partial/time_budget_exhausted`：1/3 子问题、5 个可用资产、1 个正式项目、1 个多图纸项目，Provider/deterministic fallback 为 0。当前活动 Run 为 0，不 retry、不计验收。

该 Run 的 15 次本地搜索中有 8 次为 `project_text_supplement`。火车站、机场等页面已经被正文模型判定 `direct_match=false`，workflow 仍为这些无关项目执行跨来源补证，挤占了缺失子问题的主搜索额度；另一个通用缺口是模型拆题把用户声明的渡轮客运码头扩大为“交通或滨水公共建筑”。

通用门控和拆题边界修复已完成：无关、分析失败或证据链已完整的项目不再触发跨来源补证；直接匹配但证据不完整的项目仍可在原预算内补证。完整 API 511/511、精准搜索相关全集、Ruff、55 文件格式检查、strict Mypy 26 个源文件和 `git diff --check` 全绿。

服务已重启，API/Board 健康且活动 Run 为 0。真实 `gpt-5.6-sol / responses` 隔离验证使用未预设的“新建高山植物种质资源保存库”：3 个子问题全部保留类型与条件，2 条查询采用 `exact_typology + professional_equivalent`，结构化锚点完整，未请求原生 `web_search`，未输出或保存 Key。

自然历史博物馆盲测 Run `383b7203-f330-4afc-8784-9f1bfe59f0f6` 已自然终止为 `partial/no_new_assets`、2/3、9 个资产、1 个正式项目，fallback=0，不 retry、不计验收；当前活动 Run 为 0。

新的通用缺口是晚期命名先例会重复已判无关项目，且正式结构化路径仍有一处按项目后缀猜项目名的旧解析。红测和最小实现已转绿：已尝试项目进入后续规划硬排除；重复命名先例在搜索前有界纠正；Pydantic `project_name` 直接约束候选，旧字符串解析只留给无锚点兼容路径。

精准搜索相关五文件 324 项、完整 API 516 项、Ruff、55 文件格式、strict Mypy 26 个源文件与 diff check 全绿。真实排除项目规划隔离验证成功，未重复已排除命名先例，anchors 完整。

公共市场大厅盲测 `8308a18e-1898-4e4b-a352-4014dd612d4d` 因第 2 轮查询规划 `ValueError` fallback 提前取消，保留 7 个候选资产，不 retry、不计验收；当前活动 Run 为 0。

该 Run 暴露建筑拆题仍可能题外加入 XHS/登录态，以及第二次查询纠正缺少正文不足、旧查询和排除项目别名的明确约束。通用红测与最小实现已转绿；真实同题纯内存重放得到无题外来源的 3 个子问题和 `exact_typology + evidence_angle` 两条完整查询，无 `ValueError` 或排除项目别名重复。

精准搜索相关五文件 325 项、完整 API 517 项、Ruff、55 文件格式、strict Mypy 26 个源文件和 diff check 全绿。

新建城市音乐厅盲测 `6cac2ab8-0532-407a-9981-9e99c8f25b69` 已自然终止为 `partial/time_budget_exhausted`：1/3、5 个可用资产、1 个正式项目，不 retry、不计验收。Trace 有一次 `candidate_reranking / APIConnectionError / deterministic_candidate_ranking` 和一次正文 `APITimeoutError / deterministic_fallback`，正式验收不合格。

该 Run 暴露两个通用预算浪费：同一 attempt 在服务恢复后重复执行已完成的前两个子问题；reranker 暂时失败时 deterministic fallback 放行 4/4 候选，随后 4 页全部解析失败。恢复重跑的确切原因是 QueryAttempt 的 resume key 包含可变 `language`：round 1 初始为 `zh`，模型查询规划后持久化为 `en`，重启后新建键仍为 `zh`，导致已完成状态无法匹配。

用户已同意在消除重复和无关候选浪费后有限提高建筑 quick 预算；不得降低 EvidenceClaim、正文证据或完成门槛，也不得放宽 XHS 的每方向 4 帖、累计 3 篇 usable、48 图/48 MiB 上限。

恢复执行身份已改为不可变的 `(round_number, subquestion_id)`；同 attempt 语言变化恢复、跨 attempt 继承和显式 retry 零覆盖重跑共 6 项通过。正式 reranker fallback 复用结构化 building-type anchor，仍要求确定性相关性并最多保留 2 页；旧 mock/provider 兼容路径不变，相关目标测试通过。

三档新 Run 预算已有限上调：quick / balanced / deep 的恢复轮为 4、每子问题恢复页为 3、基础页面上限为 16 / 40 / 72、时间上限为 2400 / 3600 / 5400 秒；按 3 / 4 / 6 个子问题计算，公开搜索有效上限为 18 / 28 / 48。XHS 专用每方向 4 帖、累计 3 篇 usable、48 图 / 48 MiB 不变。

精准搜索相关六文件 351/351、完整 API 519/519、workflow 44/44、schema 24/24、Ruff lint/63 文件格式、strict Mypy 26 文件与 `git diff --check` 全绿。服务已重启，真实 Provider `responses.structured_output` probe 成功。

修改后才选定的新建大学学生中心 Run `4bcbd249-8701-48a6-b0d4-69beb2f83c58` 在 Trace 40 出现 `public_page_analysis / APITimeoutError / deterministic_fallback` 后已立即取消，不计验收、不 retry。取消前为 3/3 coverage、4 个资产、1 个项目，其他模型阶段 fallback=0。

通用正文分析修复已经完成：独立单次窗口由 45 秒提升到 75 秒，第一次瞬时错误后的第二次调用使用 low reasoning，结构证据纠正仍为 medium；最大调用数仍为 2，最坏预算为 150 秒。精准搜索相关六文件 351/351、完整 API 519/519、Ruff、64 文件格式、strict Mypy 26 文件和 diff check 全绿。

服务重启后的真实隔离验证用项目 Playwright 重读同一 10,373 字符大学中心正文，Provider 在 35.0 秒成功返回 `relevance=3/direct_match=true` 和完整事实/机制/转译，无 fallback。生产和测试代码对 `business school / management school / school of business / 商学院` 扫描为 0 命中。

唯一活动 Run 为 `43503eef-b328-4849-9feb-cad43b5a29ea`：新建大学商学院教学中心，`quick/precedent_research/research_sources=[]`。API 已实际返回新 quick 预算。唯一下一步：只轮询并审计该 Run，出现 fallback 时立即取消；终态前不创建或 retry 其他 Run。

用户随后调整案例边界：案例不必题型严丝合缝，应优先研究可迁移机制和如何参考。商学院 Run 已取消并保留，不计验收、不 retry；取消时 10 个 partial 资产、0 个正式项目、fallback=0。

通用适度准入已完成：Pydantic reranker 增加 `mechanism_transferability`，每批最多 3 个类型直接候选和 1 个同建筑尺度强机制类比候选；弱机制、仅视觉相似或一般相邻类型继续拒绝。正文事实与逐字 EvidenceClaim 不放宽；跨类型机制只有正文完整支持且明确 limitations 才能进入后续综合，综合不得冒充同类型直接先例。

精准搜索相关全集、完整 API 520/520 与全部静态门禁通过。两次真实普通 Responses 隔离验证确认模型会保留 `typology=0/mechanism_transferability=4` 的社区文化中心类比，并拒绝机制为 1 的普通办公大厅；没有原生 web_search。当前活动 Run 为 0。唯一下一步：选择修改后才决定且生产/测试未出现的建筑类型，创建唯一单活 quick Run并只轮询审计。

生产和测试对大学建筑学院相关中英文名称扫描为 0。唯一活动 Run 为 `15c4d0d2-5643-43af-98d0-7566488682b0`：新建大学建筑学院，`quick/precedent_research/research_sources=[]`。唯一下一步：只轮询和审计；出现任何 fallback 立即取消，终态前不创建或 retry 其他 Run。

建筑学院 Run 已自然终止为 `partial/time_budget_exhausted`，保留、不 retry、不计验收。它实际达到 3/3 正文覆盖、4 个 usable assets、1 个正式项目，查询规划、候选筛选、正文分析和综合全部 Provider 成功、explicit fallback=0；综合给出了逐字证据约束下的可借鉴操作和适用边界。失败原因是 18 次本地搜索额度耗尽后仍只有 1 个项目，而非 40 分钟时限耗尽。

按用户最新边界新增通用红测并完成最小修复：候选总数仍最多 4 个；直接案例最多 3 个；同类型案例不足时允许最多 2 个可信来源、强机制可迁移的部分匹配案例进入本地正文读取。类比只需明确支持当前子问题中的一个机制，不要求满足全部项目条件；弱机制、仅视觉相似和无机制的一般相邻类型仍拒绝，正文原文、URL、EvidenceClaim 和综合适用边界不放宽。搜索调用额度耗尽现单独记录为 `query_budget_exhausted`，不再误报时间耗尽。

当前活动 Run 为 0，正式验收仍为 0/6。目标测试 3/3 已通过；唯一下一步：运行精准搜索相关全集、完整 API 和静态门禁，通过后重启服务并做真实 reranker 隔离验证；回归收口前不创建新 Run。

精准搜索相关六文件全集、完整 API、Ruff、55 文件格式、strict Mypy 26 个源文件和 `git diff --check` 已通过；服务已重启，API/Board 健康。真实 `gpt-5.6-sol / responses` reranker 隔离验证保留 1 个直接案例和 2 个强机制类比，拒绝普通办公大厅；未调用原生 `web_search`，未输出或保存 Key。唯一下一步：扫描并创建修改后才决定的全新建筑类型单活 quick Run，终态前只轮询审计。

生产和测试对大学工程创新中心相关中英文名称扫描为 0；已创建唯一单活 Run `f64e3b16-740a-4948-9da1-064acce13ae4`。Provider 拆题保留原建筑类型、项目条件和三组机制，首条查询规划与本地结构化搜索成功、fallback=0。唯一下一步：只轮询并审计该 Run，终态前不创建或 retry 其他 Run。

工程创新中心 Run 在 0/3、fallback=0 时已主动取消并保留，不计验收、不 retry。联合 Trace 和 QueryAttempt 审计发现所有后期 `evidence_angle` 仍把多层中庭、实验室、工坊、工作室、展示、采光、结构和运输等整组条件塞进单条站内查询，导致“候选允许类比”无法改善搜索召回。

通用红测已准确失败并转绿：Pydantic `spatial_mechanism` 现在必须聚焦一个可迁移机制切片，英文最多 12 个词、中文最多 32 个汉字；每条查询仍保留建筑类型、项目条件和证据类型，两槽查询使用不同机制切片。过载计划会进入同一有界纠正重试，不靠 deterministic fallback。当前活动 Run 为 0；唯一下一步：运行相关全集、完整 API 和静态门禁，通过后真实隔离重放工程创新中心查询规划，不创建 Run。

Provider 全集、完整 API、Ruff、55 文件格式、strict Mypy 26 个源文件和 diff check 已通过；服务重启后，真实 `gpt-5.6-sol / responses` 对工程创新中心三个子问题均返回 `named_precedent + evidence_angle`，机制锚点为 6-9 个词且分别聚焦中庭/采光、流线分离、结构/可变楼板，全部结构化锚点完整，无 fallback。唯一下一步：扫描另一种修改后才决定的全新建筑类型，创建唯一单活 quick Run。

生产和测试对大学医学教育中心相关中英文名称扫描为 0；唯一单活 Run `363c9289-eae9-4767-be79-1da6d0918d94` 已自然终止为 `blocked/research_synthesis_incomplete`：0/3、6 个 partial 图纸资产、0 个正式项目，Provider/deterministic fallback=0，保留、不 retry、不计验收。

该 Run 的模型拆题、最多两条机制切片查询、本地结构化搜索和候选筛选均按正式路径执行；后期命名先例与证据角度也真实轮换。正文分析读取了两个同类型医学教育页面，但对三个子问题均返回 `direct_match=false`、`supported_fact_count=0`。当前用户要求案例准入不过度追求题型完全吻合，重点转向可迁移机制与如何参考；URL、逐字正文、EvidenceClaim 和适用边界仍不得放宽。

当前活动 Run 为 0，正式验收仍为 0/6。联合审计确认真实缺口在召回层：11 条查询始终锁定同类型，所有候选批次 `analogical_retained_count=0`；正文层已有“一个逐字支持机制即可形成受限分析”的合同。

新的通用晚期恢复策略已实现：第 1-3 轮继续精确类型、专业等价、命名先例与证据角度；第 4 轮后且候选/正文持续不足时，两个既有查询槽最多一个 `mechanism_analogy`，另一个保留目标类型证据查询。Pydantic 同时记录具体类比来源类型和原目标类型，拒绝同类型伪类比与 `public building` 等泛化；本地结构化搜索只执行来源类型查询，后续 reranker、正文、逐字 EvidenceClaim、limitations 和总预算不变。Provider 64/64 与目标工作流集成测试通过。

本轮门禁已通过：Provider 64/64、浏览 workflow 133/133、workflow/schema 68/68、完整 API 526/526；Ruff lint、55 文件格式、strict Mypy 26 个源文件与 `git diff --check` 全绿。没有修改 XHS 固定上限、正文证据或完成门槛。

服务已重启且真实 `gpt-5.6-sol / responses` 第 4 轮隔离规划成功：返回一个目标类型 `evidence_angle` 和一个 `mechanism_analogy`，结构化锚点完整、没有原生 web_search。模型为海洋机器人试验中心选择“航天器装配测试设施”作为类比来源类型。

项目 Playwright 随后对该类比查询轮换 ArchDaily、Designboom、Dezeen、Divisare；没有找到同类项目，返回的是博物馆、体育馆或无关文章，证明仅约束机制尺度仍可能选择建筑媒体中不可发现的稀有技术设施。

唯一下一步：先写红测要求类比来源类型必须是可信建筑媒体中广泛记录、具有完整建成项目页的具体建筑类型，不能只因名称技术相似选择稀有设施；最小修改 Provider 提示后重跑全集与真实隔离规划/本地召回，不创建 Run。

用户随后纠正了更根本的产品方向：ArchResearch 面向建筑概念初期灵感，默认问题应保持宽泛，不能预先规定中庭、环形流线、设备带、可变隔断等具体答案。模型拆题应形成开放研究维度，具体机制必须从本地浏览器读取的候选证据中发现。

搜索权重同时改为“空间对象与关系优先，建筑类型为背景约束”。例如研究互动展厅、教育空间与中庭关系时，应允许从其他可信建筑类型中发现可迁移做法，而不是把每条查询锁死在儿童科学馆。只有用户明确要求同类型案例或题目依赖强类型规范时，才提高类型权重。

当前活动 Run 为 0，正式验收仍为 0/6。已在 `test_agent_planning.py` 和 `test_providers.py` 写入四个尚未运行的概念初期红测。唯一下一步：运行这些红测并补充空间优先/类型软约束测试；随后最小修改 fallback、Provider 拆题和查询规划合同，完整回归前不创建新 Run。

四个概念初期红测已运行并按预期全部失败。进一步冲突审查确认：当前 Pydantic 查询合同强制每条 query 包含建筑类型；Provider 恢复策略和本地结构化站内查询都以类型为中心；`mechanism_analogy` 只作为晚期例外。这些此前未发布改动与用户最新“空间优先”目标冲突。

新的通用设计是同一既有预算内的两路检索：空间优先路按空间对象、关系、体验和环境议题跨类型发现案例；项目语境路保留目标建筑类型及新建/改造/扩建条件，用于同类补充和适用性校验。候选白名单、排除集合、预算、XHS-only、本地正文读取、URL、逐字 EvidenceClaim 和综合边界全部保留。

双路检索首轮实现已完成：Pydantic、Provider prompt、本地结构化搜索、reranker 和 workflow Trace 的 10 个核心合同转绿。确定性 fallback 也已改为只翻译题目明确出现的空间、活动、流线、环境和建造词，并补充中性关系/证据维度；不再按意图自动添加动静分区、连续环流、工作坊、柱网或桁架等方案模板。旧测试中要求题外模板词的断言已同步为显式词合同。

当前活动 Run 为 0，正式验收仍为 0/6。精准搜索相关组合 366/366、完整 API 534/534、Provider 67/67、Ruff、64 文件格式、strict Mypy 26 个源文件和 `git diff --check` 已通过。旧类型中心策略名只保留在反向测试和 Provider 的禁止提示中，不属于 Pydantic 可执行枚举。

真实普通 Responses 纯内存验证已通过：宽泛的新建滨海社区学习与文化中心被拆为功能关系、使用旅程和滨海环境回应三个开放研究维度；没有预设中庭、环流、材料或结构。查询返回 `space_first + project_context`，空间优先查询不含目标类型；reranker 保留跨类型图书馆和同类文化中心，拒绝无关办公立面，候选 ID 全在本地白名单。未调用原生 `web_search`，未输出或保存 Key。

第一条概念初期盲测 Run `3ea1dd1b-08ff-48a8-b7fa-a5f2b1cdbdbf` 在规划阶段暴露模型仍会把宽泛题具体化为展览、工作坊、后勤、中庭、采光和剖面层次，已立即取消并保留，不 retry、不计验收。

通用输出门控已完成：Provider 对计划中出现、但用户问题和项目上下文未声明的具体空间、功能、流线、环境、材料和结构前提做词族检查；只在违规时最多纠正一次，用户明确提出的技术问题不受影响。相关组合 367/367、完整 API 535/535、Ruff、64 文件格式、strict Mypy 26 个源文件和 diff check 全绿。真实同题重放只用一次 Responses 就直接返回开放维度，无题外前提。

后续真实 Run `abc168c5-2b31-49c5-a6d5-206b93bf8aea` 使用专用空白 workspace，拆题保持开放，但首轮 `user_experience` 查询规划出现 `ValidationError / deterministic_template`。该 Run 已取消并保留，不 retry、不计验收；取消前其余轮次证明 `space_first + project_context` 可以召回跨类型候选并形成一条完整正文证据链。

最新冲突审计确认：查询结构仍把检索主题命名为并强制校验 `spatial_mechanism`，候选层仍优先要求 `mechanism_transferability`，等于在本地正文读取前预设设计机制；`building_type` 仍为每条查询必填，无法正确处理只问展厅、教育空间、中庭等空间关系而未声明建筑类型的题目；英文 `space_first` 查询还错误要求仅作上下文的中文类型/条件锚点也必须 ASCII；deterministic reranker 在空间优先分支仍会回落到旧类型过滤。

当前唯一下一步：先写通用红测，把查询锚点改为中性空间研究焦点、建筑类型改为可选语境、候选改为空间相关性与证据潜力优先，并给第二次结构化纠正传递有界校验反馈；保持本地浏览器、候选白名单、排除集合、预算、XHS-only、URL、逐字 EvidenceClaim 和完成门槛不变。相关与完整回归收口前不创建新 Run。

第二轮空间优先修复及回归已完成：`spatial_focus`、可选 `building_type`、`spatial_relevance`、有界校验纠正和 deterministic 空间优先准入均已落地；完整 API 540/540、相关组合 372/372 与静态门禁全绿。真实 Provider 内存验证无 fallback、无原生 `web_search`。

概念初期建筑 Run `2a45daa0-52e9-4d35-860f-17a023292a83` 已自然终止为 `partial/budget_exhausted`，不计正式验收且不 retry。它已达到 3/3 正文覆盖、3 个正式项目、18 个可用资产，`search_query_planning`、`candidate_reranking`、`public_page_analysis` 和 `research_synthesis` 均由 Provider 成功完成，fallback=0；唯一残留项是 `insufficient_multi_asset_projects`。

联合结果与代码审计确认这是图纸丰富度计数错误：蒙特卡洛案例的同一已验证 ArchDaily 项目页已有 `section + axonometric`，但旧计数只检查复制了整套正文分析字段的资产，因此误报 0。红测要求只把“正文已验证项目的同一来源页”上的不同 `verified/partial` 图纸类型聚合；同名但不同来源页不得混算。最小修复后目标测试通过，同一真实数据库只读重算为 3/3、3 项目、18 资产、`multi_asset_projects=1`、`enrichment_gaps=[]`；URL、逐字 EvidenceClaim、正文和子问题覆盖门槛均未放宽。

当前活动 Run 为 0，正式验收仍为 0/6。当前唯一下一步：运行 workflow/verification 相关全集、完整 API 与静态门禁；全部通过后重启源码服务，再创建一条修改后才确定的概念初期建筑题做唯一单活验收。

覆盖聚合修复门禁已收口：workflow/verification 47/47、精准搜索相关联合 376/376、完整 API 全绿；Ruff lint、55 文件 format check、strict Mypy 26 个源文件和 `git diff --check` 均通过。源码 API/Board 已用项目脚本重启，`openai/gpt-5.6-sol` 健康，Board 200，活动 Run 为 0。

当前唯一下一步：扫描一条修改后才决定、未出现在生产和测试中的宽泛概念初期建筑题；确认无命中后只创建这一条 quick Run，并轮询到终态审计。

全新概念初期 Run `22fb1bee-201b-4753-85c2-2ce75ffa48bd` 已自然终止为 `partial/query_budget_exhausted`，不计验收且不 retry。它达到 3/3 正文覆盖、11 个可用资产、2 个正式项目和完整综合；14 次模型查询计划、候选筛选、13 次正文分析及综合均成功，fallback=0。空间优先查询实际召回并分析了共享住宅、图书馆、工作室、公交站和 StreetMekka 等跨类型案例，低相关页保持拒绝。

该 Run 在 3/3 后继续消耗查询，唯一目的仍是达到 quick 的旧丰富度硬门槛“3 个正式项目 + 1 个同项目多图纸”。根据用户最新“概念初期、分析价值优先、案例不应卡死”边界，quick 重新校准为 2 个正式项目且不强制同项目多图纸；每题 2 个资产、6 个总资产、4 个 verified/partial、逐字正文、URL、EvidenceClaim、3/3 覆盖和综合要求不变。balanced/deep 仍保持 4/6 个项目与 2/3 个多图纸项目。

新门槛红测先准确失败于旧值，最小 schema 修改后转绿。两个原本依赖旧 quick 丰富度来测试 retry 与多图纸恢复的夹具改为在测试内显式启用旧强目标，继续证明这些通用能力未被删除；目标三项 3/3 通过。当前活动 Run 为 0。

当前唯一下一步：运行 schema/verification/workflow/browser 相关全集、完整 API 与静态门禁；全绿后重启源码服务并创建下一条全新宽泛概念题做单活验收。

quick 校准后的相关回归 206/206、完整 API、Ruff lint、55 文件 format check、strict Mypy 26 个源文件和 `git diff --check` 全绿。源码服务已重启，API `openai/gpt-5.6-sol` 与 Board 200，活动 Run 为 0。

当前唯一下一步：扫描“新建城市街角阅读与邻里活动场所”宽泛概念题；确认 production/tests 无命中后创建唯一单活 quick Run 并审计到终态。

建筑正式验收 1/3 已通过：Run `cc7eee8a-bc70-4f9c-867a-d975567a1c4b` 为 `completed/coverage_satisfied`，3/3、10 个资产、2 个独立项目、完整综合。6 次模型查询规划、6 次候选筛选、4 次正文分析和 1 次综合成功；7 次本地浏览器搜索、3 次正文读取，原生 `web_search` 事件为 0，fallback=0。4 个正式资产含 18 条真实 URL 绑定且逐字 excerpt 非空的 EvidenceClaim。

建筑验收候选 Run `e665999e-a7a9-4d79-b4e9-c69fbf5ada85`（老城区闲置小型建筑改造为社区手工与共享工作场所）已自然终止为 `blocked/research_synthesis_incomplete`：0/3、0 个 usable assets、0 个正式项目，保留、不 retry、不计验收。空间关系和使用体验各运行 4 轮，街区联系运行 3 轮；Provider/deterministic fallback=0。

初步失败信号包括：One and a Half Co-working Studio 本地正文读取超时；Project Ulsoor Office 与 Vertical Village 的正文分析均为 `direct_match=false`；后续多轮搜索返回 0 候选。当前活动 Run 为 0，建筑正式验收仍为 1/3。

当前唯一下一步：完整审计该 Run 的 QueryAttempt、站点轮换、候选批次和正文分析输入，确认旧建筑改造语境下空间优先搜索为何几乎没有有效召回；先写跨任意题型的红测，再做最小非类型专用修复。修复及全回归收口前不创建或 retry 任何 Run。

该失败审计与通用修复已收口：`project_condition` 限为 6 个拉丁词或 12 个汉字；模型查询语言必须匹配当前站点；项目语境站内查询按“项目名 -> 空间焦点 -> 简洁条件 -> 类型 -> 证据”执行；本地正文超时最多重读一次。reranker 拒绝项持久化为 `irrelevant`，已选但未读页面为 `pending`，服务重启后仍可恢复，实际读取/检查后才转为 `available` 并进入永久排除。

最新门禁：相关回归 427/427、完整 API 549/549、Ruff lint、55 文件 format check、strict Mypy 26 个源文件和 `git diff --check` 全绿。源码 API/Board 已重启，`openai/gpt-5.6-sol` 健康，Board 200，7 个 workspace 的活动 Run 为 0。

真实 Credential Manager 普通 Responses 纯内存验证通过：宽泛河岸公共学习与休闲场所返回 `space_first + project_context`；空间优先查询未带类型/条件；本地 ArchDaily 搜索返回 4 个候选，模型只保留白名单中的 2 个跨类型空间案例。没有原生 `web_search`、没有创建 Run、没有输出或保存 Key。

当前建筑正式验收仍为 1/3，总计 1/6。当前唯一下一步：扫描一条修改后才确定、未出现在 production/tests 的宽泛概念初期建筑题；确认无命中后创建唯一单活 quick Run，并只轮询到终态审计。不得 retry `e665999e-a7a9-4d79-b4e9-c69fbf5ada85`。

修复后的建筑验收 Run `60993e17-a7fc-4af9-9f80-1eda31d1ccca` 已通过：`completed/coverage_satisfied`，3/3、7 个可用资产、2 个正式项目、完整综合。查询保持概念初期开放维度，以空间关系、日常体验和场地连接为主，没有预设具体形式或类型锁定。

该 Run 有 7 次真实查询规划、6 次实际候选筛选加 1 次零候选 `not_called`、9 次正文分析和 1 次综合成功；10 次本地搜索、8 次正文读取，fallback=0、原生 web_search=0。5 个正文正式资产含 25/25 URL 绑定且逐字 excerpt 非空的 EvidenceClaim。正式查询全部为英文且按失败原因变化。

当前建筑正式验收为 2/3，总计 2/6，活动 Run=0。当前唯一下一步：扫描另一条修改后才确定、production/tests 未出现的宽泛概念初期建筑题；确认无命中后创建第三条唯一单活 quick Run 并只轮询审计。

第三条建筑验收 Run `f429ca55-5377-4dc5-a8fb-87b99d8bccd5` 已创建，题目为丘陵住区边缘的公共运动与邻里休憩场所概念初期研究。恢复时 API 为 `openai/gpt-5.6-sol` 且健康，Run 仍为 `inspecting`；不得并发创建或 retry 其他 Run。

用户要求在继续开发前，先按“概念初期开放问题”和“空间优先、类型软语境”审查此前未发布改动是否仍有冲突。当前唯一下一步：只轮询并审计该 Run，同时只读梳理规划、查询、候选筛选、正文分析与恢复/降级路径；在形成明确冲突清单和通用开发顺序前不改生产代码。

第三条建筑验收 Run 已自然终止为 `partial/query_budget_exhausted`：3/3 子问题、13 个可用资产、1 个正式项目、完整 Provider 综合，fallback=0；保留、不 retry、不计验收。当前活动 Run=0，建筑正式验收仍为 2/3。

冲突审查已完成，确认五个通用开发目标：默认开放 fallback 拆题；子问题前景化空间议题而非机械重复类型；删除正文分析前的模板机制注入；空间相关候选优先且类型-only 探查最多 1 个；deterministic reranker 使用当前空间焦点而非整题类型权重。当前唯一下一步：先写并运行上述红测，再做最小生产修改。

上述五项通用修复及回归已完成：目标行为 6/6、相关八文件全集、完整 API 552/552、Ruff lint/63 文件格式、strict Mypy 26 个源文件和 `git diff --check` 全绿。默认 fallback 使用开放维度；Provider 子问题不机械重复类型/条件；正文分析问题不注入模板机制；空间候选优先且 type-only 探查最多 1 个；deterministic reranker 使用当前 `spatial_focus` 和候选摘要。

当前活动 Run 为 0，建筑正式验收仍为 2/3，总计 2/6；第三条候选 Run `f429ca55-5377-4dc5-a8fb-87b99d8bccd5` 保留、不 retry、不计验收。当前唯一下一步：重启源码服务并使用 Credential Manager 的普通 Responses 做纯内存规划、查询和候选筛选验证；成功且无 fallback/web_search 后，创建一条修改后才决定的全新宽泛概念初期建筑题做唯一单活验收。

真实内存探针已通过；后续候选 Run `202d658e-25a3-4158-b26b-bf2c3c187308` 为 `partial/budget_exhausted`、2/3、5 资产、1 项目，保留、不 retry、不计验收。它的上海跨代社区页面和小学页面在缺失分支上两次因相关正文输出不满足证据结构合同而被拒绝；同一上海页面真实重放一次即以 5 条逐字事实完整通过。

通用纠正稳定性修复已完成：第二次正文 Responses 会收到有界、无正文内容的精确缺项标签，调用上限、URL、逐字 EvidenceClaim 和完成门槛不变。Provider 76/76、相关八文件 431 项、完整 API 553/553 与静态门禁全绿。当前活动 Run=0，建筑正式验收仍为 2/3。当前唯一下一步：重启服务并做普通 Responses 健康探针；上游正常后创建另一条全新宽泛概念题作为唯一单活建筑验收 Run。

服务恢复后的普通 `space_first` Responses 探针成功。后续候选 Run `9b7ed8dc-daef-41d1-b86d-0c0035725a1b` 自然终止为 `partial/no_new_assets`：2/3、3 个资产、1 个正式项目，保留、不 retry、不计验收。正式查询规划、候选筛选和正文分析没有 deterministic fallback；当前活动 Run 为 0。

该 Run 的空间优先查询能够找到并形成家庭停留、活动共存的正式证据，失败集中在项目语境路：模型把宽泛 brief 复制成 `children's care and family community venue` 一类长而生造的 building-type anchor，前一候选 Run 也出现 `urban community shared learning and daily service facility`。这些不是建筑媒体常用索引类别，导致日常到达等缺口在后续轮次持续低召回。

当前建筑正式验收为 2/3，XHS 为 0/3，总计 2/6。当前唯一下一步：先写通用红测，要求 `project_context` 的 `building_type` 是简短、常见、可被建筑媒体索引的专业类别，不能复制多功能 brief；`space_first` 继续保持无类型执行查询。最小修改必须依赖 Pydantic 长度/结构合同和 Provider 提示，不能加入儿童照护、社区中心等题型专用词表；通过目标、相关、完整与静态门禁后，再做真实内存探针和一条全新单活建筑验收 Run。

该通用修复已完成：旧实现准确放过英文/中文 multi-program label，新增策略级 Pydantic 合同后，可执行 context 查询的 building type 限为英文最多 5 个有效词或中文最多 10 个汉字；`space_first` 的 context-only 原始语境不受影响。Provider 提示要求归纳一个常见、可索引的专业类别，活动与关系仍留在 `spatial_focus`，没有新增建筑类型词表。

最新门禁：目标 4/4、Provider 80/80、精准搜索相关八文件 435 项、完整 API 557/557；Ruff lint、63 文件格式、strict Mypy 26 个源文件与 `git diff --check` 全绿。当前仍无活动 Run、未 commit、未 push、未发布。

当前唯一下一步：重启源码服务加载新合同，使用 Credential Manager 的普通 Responses 做不落盘双路规划探针；确认 `space_first` 无类型执行查询、`project_context` 使用短可索引类别且无 fallback/native web_search 后，再扫描并创建一条修改后才确定的全新宽泛概念题作为唯一单活建筑验收 Run。

真实双路规划探针已通过：`space_first` 查询未包含类型/条件，context 查询把明确的青年中心语境归纳为 3 词 `urban youth center`；没有 fallback 或 native web_search。随后新 Run `3618a879-3ca3-4d45-9cdf-d8238e95d0d5` 在 Trace 44 出现 `public_page_analysis / APIConnectionError / deterministic_fallback` 后由监控立即取消，保留、不 retry、不计验收。

取消前该 Run 已达到 2/3、8 个资产、3 个项目；正式查询均为空间优先短查询，第二轮 context 查询没有复制 multi-program brief，也没有生造长建筑类型，说明本轮通用修复在真实 workflow 生效。失败是外部 Provider 连接错误，不增加调用次数、不降低正文或 EvidenceClaim 门槛。

当前活动 Run 为 0，建筑正式验收仍为 2/3，总计 2/6。当前唯一下一步：做一次 Credential Manager 普通 Responses 健康探针；上游成功且无 fallback 后，扫描并创建另一条修改后才确定的全新宽泛概念题作为唯一单活建筑验收 Run。不得 retry `3618a879-3ca3-4d45-9cdf-d8238e95d0d5`。

上游健康探针成功后，production/tests 零命中的共享茶室概念题 Run `24b9aade-b7b1-42da-9392-284cd9c1c535` 自然完成为 `completed/coverage_satisfied`：3/3、12 个资产、3 个正式项目、完整综合，记为第三条建筑正式验收。

交付审计：7 次 Provider 查询规划、6 次实际 Provider 候选筛选、8 次 Provider 正文分析和 1 次研究综合成功；13 次本地浏览器搜索、7 次正文读取；51/51 EvidenceClaim 有真实 HTTP(S) URL 和非空逐字 excerpt；fallback=0、native web_search=0。7 条 QueryAttempt 均为不同的短空间查询，未出现 multi-program building type。

当前建筑正式验收 3/3，XHS 0/3，总计 3/6，活动 Run=0。当前唯一下一步：调用现有小红书会话预检；只有 `logged_in` 才按顺序创建第一条全新 XHS-only quick Run。若为 `not_logged_in/unknown/unavailable`，保持 fail closed，不进入普通网页搜索或创建图纸 Run。

真实 XHS 预检返回 `unknown/local_search`；固定只读 OpenCLI `auth status` 随后超时，Chrome 扩展当前 `connected=false`。程序已按设计 fail closed，没有创建图纸 Run，也没有进入普通网页搜索。Board 的“打开小红书登录”入口确认指向 `https://www.xiaohongshu.com/explore`，项目自己的 `POST /v1/browser/open-chrome` 已成功打开 Board。

当前唯一下一步：用户在系统 Chrome 中进入“图纸灵感”，点击“打开小红书登录”并完成登录，然后点击“重新检测”或回复已登录。确认预检为 `logged_in` 后，才创建第一条全新 XHS-only 验收 Run。

登录现已恢复为 `logged_in/local_search`。第一条 XHS-only 验收 Run `96237a51-6425-4365-bec0-dd054b02fabe` 已自然终止为 `partial/visual_budget_exhausted`，保留、不 retry、不计验收；23 个资产、8 个项目，全部结果 URL 为小红书且 `has_local_content=true`，普通网页工具为 0、fallback=0。

该 Run 的固定完成门槛正确生效：`sectional-collage` 与 `diagrammatic-axon` 各有 3 篇 usable 笔记，`contour-layering` 只有 2 篇，因此没有把通用覆盖报告的 3/3 误判为 XHS 完成。每方向最多 4 帖、累计 3 篇 usable、每帖最多 4 图、全任务 48 图像槽位 / 48 MiB 保持不变。

通用召回缺口位于实际 OpenCLI 查询：workflow 只把视觉方向短文本传给 `_try_xiaohongshu_search()`，原始图纸主题、场地/空间关系等上下文只存在于冗长 QueryAttempt 记录，没有进入真正的本地搜索。首轮实际查询因此退化为 `精细线稿分析图`、`拼贴叙事分析图`、`材质渲染分析图` 等泛词。

当前建筑正式验收 3/3，XHS 0/3，总计 3/6；7 个工作区活动 Run 为 0，预检为 `logged_in/local_search`，未 commit、未 push、未发布。

当前唯一下一步：先写通用红测，要求 XHS 实际查询由“原题中简洁的图纸/场地/空间主题上下文 + 当前视觉方向”组成，且不得混入 rationale、Provider 指令或公共网页词；再做最小 compact-query 修复与 XHS/浏览 workflow 回归。收口前不创建新 Run。

XHS compact query 修复已完成：两个未见主题红测在旧实现上 2/2 准确失败，最小实现后实际本地搜索串由原题主题和视觉方向组成，总长最多 96 字符；不含 QueryAttempt 的主问题/子问题/分析要求、Provider 指令或公共建筑网站词。XHS-only QueryAttempt 现在与传入 OpenCLI/扩展搜索器的真实参数一致。

门禁已通过：XHS/browser 相关四文件 232 项、完整 API 559/559、Ruff lint、55 文件 format check、strict Mypy 26 个源文件和 `git diff --check`。固定 4 帖/3 usable/每帖 4 图/48 图像槽位/48 MiB、XHS-only 与 fail-closed 均未变化。

源码 API/Board 已重启至 `8000/5173`；Provider `openai/gpt-5.6-sol` 健康，XHS 预检为 `logged_in/local_search`，重启前活动 Run=0。

当前唯一下一步：扫描一条修改后才确定、production/tests 未出现的宽泛概念初期图纸题；确认 compact query 含主题和方向且全局活动 Run=0 后，只创建一条 XHS-only quick Run 并轮询审计。不得 retry `96237a51-6425-4365-bec0-dd054b02fabe`。

首个修改后盲测 Run `e1a8fc51-d2a4-4ddf-bf87-fbd01d82f94d` 证明主题已真实进入 OpenCLI 和 QueryAttempt，但 96 字符合同仍保留过多“概念图纸/表达/不同风格”话术；第一方向 4 帖只有 1 篇 usable 后已取消并保留，不 retry、不计验收。

同登录态一次只读 A/B 表明，更短的“主题名词 + 空间关系 + 视觉方向”能召回更直接的活动中心、校园节点与学校空间候选。第二轮通用压缩现将总长限制为 64，删除通用请求/媒介词及方向已携带的图纸类型；不翻译或映射空间主题，不添加题型词表，不改变 XHS 固定预算。

第二轮门禁：目标 2/2、完整 API 559/559、Ruff lint、55 文件 format check、strict Mypy 26 个源文件和 `git diff --check` 全绿。当前活动 Run 应为 0。

当前唯一下一步：重启源码服务加载 64 字符合同；确认 `logged_in/local_search` 与活动 Run=0 后，扫描并创建另一条修改后才确定的 XHS-only quick Run，先审计第一方向 4 帖。不得 retry 两条既有 XHS 失败样本。

## XHS 图纸视觉方向产品纠正

- 用户进一步明确：图纸研究不是建筑案例研究。XHS 搜索只关心图纸类型和视觉表现方向，例如“精细线稿剖面图”“拼贴叙事爆炸图”；不得加入建筑类型、项目主题、场地或空间关系。
- 之前把“原题主题 + 视觉方向”组合为 XHS 查询的 96/64 字符 compact helper 属于错误方向，已从生产路径删除。XHS-only 的实际搜索参数和 `QueryAttempt.query` 现在都严格使用当前视觉子问题文本。
- 通用目标测试 `test_xiaohongshu_search_uses_only_visual_direction_and_drawing_type` 已通过 2/2：山地公共建筑输入只执行“精细线稿分析图”，社区医疗空间输入只执行“精细线稿剖面图”，题目主题均未渗入查询。
- 两个既有 XHS 失败样本 `96237a51-6425-4365-bec0-dd054b02fabe` 与 `e1a8fc51-d2a4-4ddf-bf87-fbd01d82f94d` 保留、不 retry、不计验收。后续 3 条 XHS 正式题必须是纯图纸视觉请求，不包含项目或建筑类型。

当前唯一下一步：运行 XHS adapter、浏览协议、核心 workflow 与浏览检查相关回归，再运行完整 API 和静态门禁；全部通过后确认活动 Run=0、重启服务，并只创建一条纯“图纸类型 + 视觉方向”的 XHS-only quick Run。

本轮门禁已收口：XHS/浏览相关四文件 232/232、完整 API 559/559、Ruff lint、55 文件 format check、strict Mypy 26 个源文件和 `git diff --check` 全绿。

当前唯一下一步：只读确认 API/Board、XHS 登录态与全局活动 Run；活动 Run 为 0 且登录态为 `logged_in` 时重启源码服务，再创建一条纯“图纸类型 + 视觉方向”的 XHS-only quick Run。

第一条纯视觉 XHS 正式验收 Run `4679f319-7761-461a-a8a7-48939ec523c8` 已自然完成 `completed/coverage_satisfied`：三方向各 3 篇 usable，24 个 `section` 资产、9 篇来源笔记，24/24 有本地内容且全部为 XHS URL。实际查询严格为“精细线稿剖面图”“拼贴叙事剖面图”“材质渲染剖面图”；普通网页事件 0、fallback=0，使用 30/48 个图像槽位、约 4.33 MiB。

当前验收计数为建筑 3/3、XHS 1/3，总计 4/6，活动 Run=0。当前唯一下一步：扫描并创建一条纯“视觉方向 + 爆炸图”的 XHS-only quick Run，终态前不创建或 retry 其他 Run。

第二条纯爆炸图 Run `8ff626c2-c9da-4d3c-8de1-0faca3dc0401` 已自然终止为 `partial/visual_budget_exhausted`，保留、不 retry、不计验收。三方向实际查询为“极简图解爆炸图”“拼贴叙事爆炸图”“材质渲染爆炸图”，4 帖上限后的 usable 笔记数分别为 2/2/1；42 次图像检查、约 7.05 MiB，普通网页事件 0、fallback=0。

失败集中在通用爆炸图召回/类型分类：多篇笔记已下载图片但 `candidate_count=0` 或 `type_mismatch`，不是项目主题污染、登录、字节预算或 Provider fallback。当前唯一下一步：审计爆炸图搜索结果与视觉类型识别合同，先写覆盖三种风格的通用红测，再做最小修复和完整回归；收口前不创建新 Run。

爆炸图通用修复已完成并通过门禁：实际查询只对歧义图纸类型添加“建筑”学科限定；Mock/OpenAI 视觉合同把建筑爆炸图、分解轴测图归为 `axonometric`，拼贴或渲染风格不改变图纸类型。目标 5/5、相关全集 320/320、完整 API 561/561、Ruff、55 文件 format check、strict Mypy 26 个源文件和 `git diff --check` 全绿；3 usable、4 帖和视觉预算未变化。

当前唯一下一步：确认活动 Run=0 后重启源码服务，使用真实 Credential Manager 模型对一篇本地下载的建筑爆炸式拼贴笔记做不落盘分类探针；成功后才创建新的纯视觉 XHS-only 单活验收 Run。

真实模型首次探针正确拒绝了“爆炸式拼贴”标题下没有构件分解关系的普通 collage，两张图均为 `analysis_diagram/relevance=3`，并明确“未见建筑构件爆炸关系”；不能将其强制升级。后续 A/B 证明查询顺序应为“建筑爆炸图 + 风格”，而不是“风格 + 建筑爆炸图”。类型前置红测先失败后转绿，第二轮相关 320/320、完整 API 561/561 与全部静态门禁再次通过。

当前唯一下一步：活动 Run=0 后重启源码服务，并用标题明确的真实轴测爆炸图笔记做一次不落盘分类探针；确认 `axonometric` 后创建新的纯视觉爆炸图单活 Run。

重启后的真实 Credential Manager 分类探针通过：`建筑爆炸图 拼贴叙事` 返回标题明确的轴测爆炸图笔记，3 张本地下载图片全部由 Provider 判为 `axonometric/relevance=4`，可见观察明确记录楼层、框架、屋面和构件的竖向分解关系；无 fallback，临时文件已自动清理。

第二条爆炸图验收 Run `a33b0185-fc5d-48ed-a93f-8c3cb7df042f` 已自然终止为 `partial/visual_budget_exhausted`，保留、不 retry、不计验收。黑白线稿与材质渲染各达到 3 篇 usable；红灰配色在 4 帖上限内只有 2 篇 usable，后两帖 8 张均为 type mismatch。20 个结果全部为本地 XHS 内容，普通网页事件 0、fallback=0。

最新图纸产品边界：图纸研究只使用视觉风格与图纸类型，不询问或推断建筑类型、项目主题、场地或空间关系。执行查询中的“建筑爆炸图”仅是排除产品拆解图的建筑制图学科消歧，不是建筑类型。该 Run 的 Provider 将用户明确的“红灰配色图解”缩写成“红灰配色”，是当前通用规划缺口。

显式风格保真修复已完成：两个红测先准确失败后转绿；用户明确枚举的视觉短语必须逐项逐字进入独立子问题，违规时最多一次普通 Responses 结构化纠正。Provider/视觉/XHS/browser/workflow 相关全集、完整 API 562/562、Ruff、55 文件 format check、strict Mypy 26 个源文件和 `git diff --check` 全绿。没有风格词表、预算变化或确定性伪完成。

真实普通 Responses 首次探针完整保留黑白线稿、红灰配色图解和材质渲染，但以 `爆炸图：风格` 输出，暴露查询冒号残留。爆炸图与剖面图跨类型红测均先准确失败后转绿；视觉查询公共入口现统一移除中英文冒号。最终完整 API 566/566、Ruff、55 文件 format check、strict Mypy 26 个源文件和 `git diff --check` 全绿。

服务重启后的真实普通 Responses 跨类型探针通过：未见剖面图视觉题逐字保留针管笔密线、低饱和色块和纸张纹理拼贴，执行查询均为“剖面图 + 完整风格”，没有建筑类型、项目、场地或空间语义；未创建 Run，未输出或保存 Key。

未见剖面图 Run `a6752b62-90f4-4cb4-bf12-e1217db43650` 已自然终止为 `partial/visual_budget_exhausted`，保留、不 retry、不计验收。针管笔密线与低饱和色块各达到 3 篇 usable；人为指定的纸张纹理拼贴在 4 帖内只有 2 篇。22 个结果均为本地 XHS 内容，普通网页事件 0、fallback=0。同登录态只读 A/B 没有证明调整词序可以改善该稀疏风格，不增加专用同义词或放宽固定门槛。

宽泛轴测图 Run `708ab8df-7829-4ea2-b19f-5382fa941920` 已完成 `completed/coverage_satisfied`，三方向 usable 3/3/3，27 个本地资产来自 9 篇 XHS 笔记。三条查询仅含精密技术线稿、几何色块拼贴、氛围光影渲染和轴测图；27/27 为 XHS URL 且本地文件存在，33 次视觉检查约 5.3 MiB，普通网页/建筑模型事件 0、fallback=0。

宽泛平面图 Run `d654ecac-3e76-40a6-9555-02789f92cbec` 自然终止为 `partial/visual_budget_exhausted`，保留、不 retry、不计验收。黑白线稿达到 3 篇 usable，水彩为 0 篇，拼贴为 1 篇；40 次视觉检查正确拒绝非平面图，普通网页 0、fallback=0。不为该单题增加水彩/拼贴词表或放宽类型门槛。

当前正式计数仍为建筑 3/3、XHS 2/3，总计 5/6。

宽泛立面图 Run `4bb39b3c-5bc0-46c3-95f7-ab53c9f62937` 自然终止为 `partial/visual_budget_exhausted`，保留、不 retry、不计验收。三方向分别达到 2/3/3 篇 usable，证明常见线稿也可能因为本地搜索前四条中出现空内容或错图纸类型而失败，不能继续按单个风格修补。

通用 XHS 视觉候选池已实现：本地搜索元数据最多读取 8 条，按目标图纸类型标题命中和当前视觉短语的 CJK bigram 相关性排序后，仍只打开/下载最多 4 帖；每帖 4 图、全 Run 48 图/48 MiB 和每方向 3 篇 usable 均未放宽。Trace 新增 `xiaohongshu_candidate_pool`，记录候选池数、保留数和图纸类型命中数。`test_xiaohongshu.py` 13/13、完整 `test_browser_inspection.py` 与定向 Ruff 已通过；完整 API、Ruff format、strict Mypy 和 `git diff --check` 尚未在该修改后重跑，源码服务也尚未重启加载。

用户进一步明确图纸输入合同：用户只会提出想要的视觉分割/构图/表现方向，以及剖面图、爆炸图、轴测图等图纸类型；这是纯图纸视觉参考，不得询问、推断或要求建筑类型，也不得混入项目主题、场地或空间关系。现有“视觉风格 + 图纸类型”实现方向一致，但仍须审查 Provider planning、确定性 fallback、Board 文案和执行查询的所有入口并补通用红测。

全入口审查已完成：正式 Provider 提示、deterministic visual fallback、XHS QueryAttempt 与 OpenCLI/扩展实际查询都只使用视觉方向和图纸类型；XHS-only 在执行前关闭普通网页和建筑模型搜索。唯一残留是 Board 切到“图纸灵感”后仍显示“空间、流线……”的建筑研究总提示。

Board 红测先准确失败，最小修改后视觉模式首屏改为“找图纸视觉方向”，只显示剖面图/爆炸图等图纸类型与分割、构图、线型、配色、版式等视觉方向；建筑模式原文保持不变。目标 Board 3/3 与后端四类边界测试 6/6 通过。

候选池修改后的完整门禁已通过：相关 Python 六文件全集、完整 API 567/567、Board 181/181、Ruff lint、64 文件 format check、strict Mypy 26 个源文件、Board lint/typecheck/production build 与 `git diff --check` 全绿。

运行时确认 API/Board 健康、`logged_in/local_search`、7 个工作区 94 条历史 Run 的活动数为 0，随后已重启源码服务加载候选池。

第三条候选 Run `09cd4cb4-4853-42a9-b388-e38baaf42333` 使用宽泛纯视觉题“帮我比较几种效果图的构图与表现方向”，Provider 生成电影感纵深、杂志感平面构成、氛围感拼贴三个方向，无建筑类型、项目、场地或空间语义。第一方向 8→4 候选池仅 1 条标题明确命中效果图，4 帖后只有 2 篇 usable，因此按固定门槛已不可能完成；Run 已取消保留、不 retry、不计验收，未继续消耗另外两方向。

同登录态只读 A/B 证明两个通用缺口：`效果图`像`爆炸图`一样会召回摄影、影视、产品和 AI 提示词内容，需要“建筑效果图”制图学科消歧；现有候选排序把标题类型命中置于建筑图纸语境之前，会优先选中非建筑效果图。不得改为住宅/学校等建筑类型词，也不得放宽 3 usable、4 帖或视觉分类。

通用红测已先准确失败后转绿：`visual_reference_search_query()` 对爆炸图与效果图统一添加建筑制图学科限定并保持完整视觉短语，剖面图等无歧义类型不加词；8→4 排序用图纸类型命中、建筑制图语境、跨行业噪声、风格重合和原始 rank 的综合分，建筑语境存在时不会把“电影感”误判成影视噪声。

回归已收口：新增/既有目标 7/7、视觉/XHS/浏览相关六文件 328/328、完整 API 569/569、Ruff lint、64 文件 format check、strict Mypy 26 个源文件与 `git diff --check` 全绿。没有修改 XHS 4 帖/3 usable/48 图/48 MiB、Provider 调用预算或视觉类型准入。

新的宽泛效果图 Run `c521e3bd-6067-4453-b574-7c62684624e8` 已自然完成 `completed/coverage_satisfied`：电影感写实、拼贴图形化、氛围水彩三方向均达到 3 篇 usable，共 25 个 `render` 资产来自 9 篇 XHS 笔记，全部为 XHS URL 且本地文件存在。

三条实际 QueryAttempt 分别为“建筑效果图 电影感写实”“建筑效果图 拼贴图形化”“建筑效果图 氛围水彩”。这里的“建筑”只限定制图学科、排除摄影/影视/产品效果图，不是住宅、学校等建筑类型；查询没有项目、场地或空间语义。三次候选池均为 8→4，普通网页事件 0、fallback=0。

正式验收现为建筑 3/3、XHS 3/3，总计 6/6；活动 Run=0。

项目 Playwright 已逐条验证六条正式 Run：三条建筑各显示 3 个子问题章节、逐题结论、案例答案、来源和转译步骤，图片 3/3、3/3、4/4 加载；三条 XHS 各显示 3 个视觉方向与 9 篇来源笔记，图片 24/24、27/27、25/25 加载。页面错误和非预期本地响应错误均为 0。六张整页截图位于 `.artifacts/qa/v2.2.4-board/`，已人工检查无结果缺失或布局重叠。

`v2.2.4` 当前发布面已统一：API、Board、Extension、manifest、Windows CI artifact、Release 合同、README 和部署文档一致；历史 `v2.2.3` 发布记录保留不动。Release 合同先按 `2.2.4` 准确红在旧 CI artifact，同步后转绿；非历史发布面旧版本扫描为空，`git diff --check` 通过。

GitHub 首页 README 已按真实架构更新：系统仍为 Evidence-Grounded Plan-and-Execute；Plan 使用普通 Responses 做开放拆题和结构化搜索词规划，Execute 负责本地候选搜索、候选 ID 白名单筛选、本地正文/图纸读取、分析、证据绑定和补查。README 同时明确空间优先、具体建筑类型为软语境、图纸只接收图纸类型与视觉方向、默认不调用 Provider 原生 `web_search`。这些说明已加入 Release 合同测试。

权威 `scripts/verify.ps1` 已完整通过：API 569/569、Board 181/181、Extension 182/182、packaged E2E 8/8；Ruff lint/64 文件格式、strict Mypy 26 源文件、前端 lint/typecheck/build 与全部 Windows/发布合同均通过。首次运行只因两个版本文件需 Ruff 格式化而停止，机械格式化并更新 README 后完整重跑全绿。

`v2.2.4` 发布产物已构建并核验：独立扩展 ZIP 为 18,719 bytes，manifest `2.2.4`，SHA-256 `4349E77FEFDEF8AF0F0C22F59D0F6C79AEFB398F17F2AA911CF45EEF76FAA26B`；Windows 安装器为 69,748,597 bytes，文件/产品版本 `2.2.4`，SHA-256 `AB2D0D19B4260C89A9F7DE02D277A4EC946707E9AE0D40492E3ABAE27B97A70B`。

真实安装 smoke 已通过：静默安装、安装版冻结程序自检、快捷方式、扩展未捆绑、安装版启动、动态端口 `8771`、`/desktop-health` 200、`/health` 200、Board 200、静默卸载和本次新建数据清理全部成功。仓库标准 `test-windows-installer-package.ps1` 另行通过。本机原先没有安装版程序或数据，smoke 后也没有残留。

当前唯一下一步：当前分支 HEAD 与远端 `main` 文件树相同、提交历史不同；先以普通 merge 连接 `origin/main` 的等价历史，再显式暂存全部本轮及此前未发布的跟踪修改，排除 `.artifacts/`、`.archresearch/` 和真实研究数据，然后提交、推送、PR、等待 CI、合并并创建正式 `v2.2.4` Release。
