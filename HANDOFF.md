# ArchResearch 新会话交接

> 本文件只保留当前为真的产品合同、已验证基线、保护规则和下一步。详细过程见 `task_plan.md`、`findings.md`、`progress.md`、`docs/history/` 与 Git 历史。

## 新会话启动顺序

1. 完整阅读本文件。
2. 阅读 `AGENTS.md`。
3. 阅读 `task_plan.md` 中状态为 `in_progress` 或 `proposed` 的阶段；Phase 43 已完成，当前活动阶段是 in progress 的 Phase 44 `v2.3.0` 正式发布。
4. 阅读 `findings.md` 和 `progress.md` 末尾；需要旧根因时再查历史。
5. 运行 `git status --short --branch`，保留全部既有修改、忽略的本地产物和真实研究数据。
6. 开始动作前复述当前状态、唯一下一步和验证标准。

## Phase 32 视觉验收已被否定

- 根因已确认：真实搜索标签后台打开时连续 10 次媒体枚举为 0；只让图纸研究搜索与详情搜索页前台渲染后，单次现场探针首轮枚举 12/12、滚动后 15/15，并返回 3 个来源。
- 最小修复只让小红书图纸研究搜索页与详情搜索页前台渲染；普通网页和小红书登录入口仍后台，登录/验证码合同未修改。
- Extension 211/211、lint、typecheck、production build、packaged E2E 8/8 通过。
- 候选目录：`C:\Users\76384\Desktop\Archsearch\archresearch-chrome-extension-only-v2.2.10-candidate`
- 候选 ZIP：`C:\Users\76384\Desktop\Archsearch\archresearch-chrome-extension-only-v2.2.10-candidate.zip`
- ZIP：20,131 bytes，SHA-256 `64ED320256FEC5D777748D8C1AAC9DF7570DBA193BB755A5AF57456B92B21FD5`；manifest `2.2.10`、11 文件。
- 完整隔离 Run `e45719b0-5d05-4815-99db-17e262666e6b` 只证明链路生成了 9 个可读取 PNG 并由 Board 渲染，不能证明图纸素材正确。
- 人工逐张审计为 0/9 合格：包含近乎全白轮播、巨大标题、灰色遮罩、错误局部裁剪、小红书导航，以及正文/评论面板。
- `MockVisualClassifier` 未判断空白、网页 UI、遮罩或错误裁剪；此前“可用参考”和“达到发布标准”的结论无效。
- Phase 33 已完成：无效媒体、错误裁切、photograph 误入及最小化 Chrome 窗口不渲染搜索结果的问题均已修复并通过真实逐张验收。正式 `v2.2.9` 未修改；`v2.2.10` 发布记录见下方。

## 当前产品合同

- 唯一产品是 Windows/Chrome 本地优先 ArchResearch：FastAPI、Python workflow、SQLite、本地文件、用户自己的 OpenAI-compatible Provider，以及单独安装的 Chrome 扩展。
- 架构仍是 **Evidence-Grounded Plan-and-Execute**，不是多 Agent。Plan 使用普通 Responses 做开放拆题和结构化查询规划；Execute 负责本地搜索、候选 ID 白名单筛选、本地正文/图纸读取、模型分析、程序证据绑定和覆盖补查。
- 默认不调用 Provider 原生 `web_search`，也不要求兼容 API 支持工具调用。
- 建筑研究面向方案初期，以空间关系、使用体验和环境联系为主；建筑类型只作必要的软语境。正式结论必须绑定真实 URL 和逐字 EvidenceClaim。
- 图纸灵感只接收图纸类型与视觉分割、构图、线型、配色、版式等方向；不得询问或推断住宅、学校等具体建筑类型。登录态小红书走 XHS-only 路径，不进入普通网页搜索。
- `建筑爆炸图`、`建筑效果图`中的“建筑”只作制图学科消歧，用于排除产品、摄影和影视噪声，不是建筑类型。
- 小红书未登录、状态未知或通道不可用时 fail closed；不创建图纸 Run，也不降级到普通网页。
- 进入图纸灵感只读取研究环境状态，不自动打开 Chrome、Board 或小红书登录页。Chrome 扩展未连接且没有本地搜索回退时隐藏登录入口；连接完成后用户可显式打开小红书登录并有限轮询。已连接 Chrome 的既有登录态优先于 OpenCLI `unknown`。遇到安全验证时使用专属 `verification_required`，保留并复用同一验证标签、暂停自动检查，用户完成后再重新检测。登录流程不读取、返回或保存 Cookie、账号、密码。
- 用户首次切换到图纸灵感时显示一次静态使用方法，说明扩展下载、解压加载、连接、登录和返回检测的顺序；关闭后只通过图纸灵感研究环境中的“使用方法”按钮重开。实时扩展连接与小红书登录检测仍留在原位。
- 首次 Provider 配置从上游 `/models` 获取只读模型列表，只探测用户选中的模型；Key 只进入 Windows Credential Manager。
- Windows 安装器自包含本地服务与生产 Board，但不捆绑 Chrome 扩展；扩展始终作为独立 ZIP 发布。
- 单活研究租约保持不变；已有活动 Run 时新建或重试返回 409。部分结果和每阶段 checkpoint 必须保留。

## 禁止恢复的范围

- 不恢复 Cloudflare Web Edition、`apps/web`、`apps/edge`、Wrangler、Workers/Workflows、Durable Objects、R2、Turnstile 或公共 HTTPS 扩展桥。
- 不恢复 Firecrawl、Pinterest、TinEye、通用视觉网页降级、平台案例库、全局向量索引或多 Agent runtime。
- 不新增 token、费用或 Provider 用量界面。
- 不读取、打印或保存 API Key、Cookie、账号或密码。
- 不使用 reset、checkout 或 clean 处理用户工作树；不删除真实研究数据或本地产物。

## v2.2.9 已验证基线

- 当前正式 Release：[ArchResearch 本地版 v2.2.9](https://github.com/jileyu2000/archresearch/releases/tag/v2.2.9)，annotated tag 解引用后指向 `97669e0b28b13260197628c08a29113317b964da`。
- PR [#21](https://github.com/jileyu2000/archresearch/pull/21) 已 squash 合并；PR CI run `31115430369` 与最终主分支手动验证 run `31121126690` 均成功，完成完整门禁、Windows 构建、真实安装/启动/卸载 smoke 和两个独立附件上传。
- GitHub README 已改为面向用户的产品首页：先讲下载安装、功能、运作流程、两种研究方式、研究结果、使用步骤与本地数据安全；开发测试矩阵、内部实现清单、技术取舍与退役技术不再占据首页。
- GitHub 仓库 About 简介已同步为“本地优先的建筑研究工作台”，不再把仓库描述为连接 Web Edition 的 Chrome 扩展。
- 小红书登录检测会在扩展 UI 状态刷新时同步已持久授予的网页权限，识别可见登录按钮、头像/profile 入口和无旧类名的笔记链接。`/website-login/captcha` 使用专属 `verification_required`：API 保留并复用同一受管标签，Board 立即暂停自动轮询；用户完成安全验证后点击“重新检测”即可继续。全过程仍 fail closed。
- 安装版桌面 URL 调度继续只把 Board 常量映射到动态本地端口，固定小红书入口会在系统 Chrome 打开，不会错误新增 Board 标签。
- 图纸灵感首次切换会显示一次静态使用方法；关闭后只通过图纸灵感研究环境中的“使用方法”按钮重开，连接、登录和重新检测控件仍在原位。
- v2.2.9 权威门禁：API 576/576、Board 188/188、Extension 190/190、packaged E2E 8/8；覆盖率、Ruff、strict Mypy、TypeScript lint/typecheck/build、Windows/Release 合同与真实安装 smoke 全部通过。
- 系统 Chrome 真实验收在用户完成小红书安全验证后返回 `logged_in/chrome_extension`（3.910 秒）；没有读取 Cookie、账号、密码或 API Key，也没有创建 Research Run。
- 下列 6/6 正式研究验收来自 v2.2.4，研究架构与结果合同在 v2.2.5 中保持不变：
- 建筑正式验收 3/3：
  - `cc7eee8a-bc70-4f9c-867a-d975567a1c4b`
  - `60993e17-a7fc-4af9-9f80-1eda31d1ccca`
  - `24b9aade-b7b1-42da-9392-284cd9c1c535`
- XHS-only 正式验收 3/3：
  - `4679f319-7761-461a-a8a7-48939ec523c8`
  - `708ab8df-7829-4ea2-b19f-5382fa941920`
  - `c521e3bd-6067-4453-b574-7c62684624e8`
- 六条均为 `completed / coverage_satisfied`；正式 Trace 中查询规划、候选筛选、正文/图纸分析和综合成功，deterministic fallback 为 0，Provider 原生 `web_search` 为 0。
- Board Playwright 已验证六条完整结果：建筑图片 3/3、3/3、4/4；XHS 图片 24/24、27/27、25/25；页面错误与非预期本地响应错误为 0。
- 真实安装 smoke：静默安装、冻结程序自检、快捷方式、扩展排除、动态端口启动、`/desktop-health`、`/health`、Board、静默卸载和无残留全部通过。

## 发布产物

- `ArchResearch-Windows-x64-Setup-v2.2.9.exe`
  - 70,137,821 bytes
  - SHA-256 `FA7DFE24CC8CD67E0DA3B46972148836D778FDAF9989C2CDE9199B264FF31AA`
- `archresearch-chrome-extension-only-v2.2.9.zip`
  - 18,878 bytes
  - SHA-256 `958FDCC09655181F096A40C712BD1069EF4915DE075CD4B6FD8B7B307B454715`
- GitHub 返回的附件名称、大小和 digest 与通过 Hosted CI 安装 smoke 的产物一致。

## Phase 24 安全验证修复（v2.2.8 已发布）

- 用户报告 v2.2.7 遇到小红书安全验证时，验证页会被关闭，Board 又持续创建新小红书标签，导致无法完成验证。
- 根因是 captcha 与普通未登录共用 `not_logged_in`；API 每次检查都创建临时搜索标签并在 `finally` 关闭，Board 对任何非登录状态最多轮询 20 次。
- 当前本地源码已新增 `verification_required`：首次验证码页保留，连续重新检测复用同一 tab ID，验证完成并检测到登录后才关闭；Board 在该状态停止自动轮询、隐藏重复开登录动作并提示完成后点“重新检测”。普通登录自动检测保持。
- RED→GREEN 与完整门禁均通过：API 574/574、Board 186/186、Extension 190/190、packaged E2E 8/8，Ruff、strict Mypy、ESLint、TypeScript、生产构建及 Windows/Release/安全合同全绿。
- 该修复同时涉及 FastAPI/Board 与 Chrome 扩展，已作为 v2.2.8 同时发布；用户必须同时更新 Windows 应用和独立 Chrome 扩展，不能只替换一个附件。

## Phase 27 图纸灵感搜索时序修复（已作为 v2.2.9 发布）

- 失败 Run `2c142ad3-59dc-4069-a326-db52b305dcc6` 已确认不是查询参数、登录状态或新版结果卡链接规则问题：当前 Chrome 可见 20 个笔记链接和 11 张有效封面，session API 为 `logged_in/chrome_extension`。
- 根因是受管标签在页面 loading 阶段就能接收内容命令，而小红书结果卡还在异步渲染；API 原先只在 3.5 秒和滚动后各枚举一次，可能两次都早于卡片出现。
- 当前源码已在 `XiaohongshuBrowserSearch.search()` 首轮增加固定上限的结果就绪轮询：最多 5 次、每次间隔 1 秒，发现有效小红书笔记链接立即停止，仍保留滚动补充和安全 URL 过滤。
- RED→GREEN 已验证：API 小红书测试 16/16、完整 API 测试全绿、Ruff、strict Mypy、diff check 全绿；扩展内容协议测试 25/25 全绿。
- 本 Phase 未创建、重试、取消或修改 Research Run，也未读取 Cookie、storage、账号、密码或 API Key。该补丁已随 v2.2.9 Windows 安装器和独立 Chrome 扩展 ZIP 发布。

## 本地文件状态

- `.artifacts/build/`、`.artifacts/qa/` 和 `.artifacts/releases/` 是本地构建、验证截图和发布产物，已精确忽略但继续保留。
- `.archresearch/`、SQLite、Workspace、ResearchRun、图片与真实研究结果不得删除或提交。
- `.artifacts/portfolio/` 中既有跟踪文件保持不变。

## 当前交接状态（2026-08-07）

- **当前目标**：Phase 35 的代码、自动门禁和建筑路径回归已完成；图纸路径仍需使用正式发布版扩展做一次现场复验。Phase 33 的图纸灵感 7/7 视觉验收及 Phase 34 的建筑研究完整回归均已通过。`v2.2.10` 已发布。
- **已验证修复**：XHS note-detail 只保留未被遮挡的 `img`，批准的 `*.xhscdn.com` 图片保存原图；Chrome/browser 分支现复用 requested drawing type 过滤并删除被拒绝的 photograph 临时 PNG。相关回归 8/8、API 583/583、Ruff、format、strict Mypy 和 diff check 全绿。
- **真实结果**：Run `6e9ef544-b8af-4086-abd9-f392bf2c76ed` 的 6 张 PNG 中 5 张为合格图纸，1 张 photograph 被错误接受；该根因已修复。复验 Run `ad270123-244e-4295-98c7-cef6c7bd7f86` 随后因 4 个搜索方向媒体枚举均为 0 而 `blocked/visual_budget_exhausted`，未进入详情分类。
- **搜索诊断**：单次标签时序已证明新搜索标签会从无 `type` URL 自动进入 `type=51`，没有验证码、登录页或额外 Board；因此不能盲加 URL 参数。安全状态探针进一步证明页面为 `logged_in`、`page_metadata` 成功、标题和 URL 正常、并非敏感页拦截，但 `page_snapshot=0`、`media_count=0`。
- **最新根因与修复**：用户截图确认保留页是正常图片瀑布流；用户实际打开 Chrome 后，同查询新标签在首次 3.5 秒即恢复 12/12。红测证明旧实现只激活标签、不恢复或聚焦宿主窗口；最小修复现仅对 `active=true` 的 XHS 研究标签恢复 minimized 窗口并聚焦，再导航。普通网页和登录入口保持后台。
- **门禁与候选**：Extension 214/214、lint、typecheck、production build、packaged E2E 8/8、diff check 全绿。同一目录 `C:\Users\76384\Desktop\Archsearch\archresearch-chrome-extension-only-v2.2.10-candidate` 的 `background.js` 已更新为 SHA-256 `8FD231947F4B6DBD337074C52CFA267DC78B9F030085607C08BC0A95CD8BBCBD`；新 ZIP `C:\Users\76384\Desktop\Archsearch\archresearch-chrome-extension-only-v2.2.10-phase33-windowfocus-candidate.zip` 为 20,459 bytes、SHA-256 `6A22C9F48A5650FCBF07306A2FF474DA9447E2CE6E958E75916F6BE632084C6E`，manifest 2.2.10、11 文件。正式 `v2.2.9` 未修改。
- **重载后真实验证**：在用户未人工切到小红书时，单次搜索探针 4,996 ms 返回 `source_count=3`，首次枚举 11/11、滚动后 16/16；窗口恢复/聚焦修复已真实生效。
- **最新唯一完整 Run**：`50f90fc6-dae0-4d80-bc4f-0f1f72e65b87` 自然终止为 `partial/visual_budget_exhausted`，保留 7 个结果、7 个项目并覆盖 4/4 子方向，`gaps=[]`、`enrichment_gaps=[]`；没有重试、取消或并行 Run。
- **逐张视觉验收**：7/7 都是可用于图纸研究的剖面线稿、图解、材质渲染或拼贴表达；没有网页 UI、遮罩、正文/评论面板、应用侧错误裁切或 photograph 误入。Rank 1 的局部截边已由用户现场搜索页截图确认属于原始卡片构图，不是 ArchResearch 二次裁切。
- **建筑研究回归**：唯一 Run `6d540f6f-d54d-4ada-86e5-d40bd9bcddd7` 为 `completed/coverage_satisfied`，12 个结果、4 个项目、4/4 子问题覆盖、12/12 有 facts 与 EvidenceClaims；Board 最终显示 4 个案例及来源/迁移策略。隔离环境使用 Mock Provider，因此该证据验证功能合同，不替代真实 BYOK 内容质量测试。
- **服务状态**：隔离 API `18072` 返回 `ok/mock`，扩展桥 `connected=true`；正式 `9872` 未触碰。
- **Git 工作区**：原工作区仍保留全部既有修改、未跟踪组件、本地产物、`.archresearch/` 和真实研究数据；未执行 reset、checkout 或 clean。
- **建筑路径隔离验收**：Run `71b77948-d3cf-4665-b344-70d5bf063858` 为 `completed/coverage_satisfied`，12 个结果、4/4 子问题，Trace 中 `xiaohongshu_search=0`、XHS 资产为 0；Board 结果区域无小红书内容。
- **图纸最新现场结果**：Run `3bc25c99-604f-4329-a66b-5ff02be9cbfb` 为 `partial/time_budget_exhausted`，但实际仅运行约 91 秒、使用 10 次视觉检查和约 1.77 MiB，只覆盖 2/4 方向；该停止原因不是真实预算耗尽。
- **图纸最新根因**：共享 workflow 用 `xiaohongshu_searched_subquestions` 将每个方向永久限制为一次 XHS 搜索。四个方向首轮结束后，XHS-only 路径没有公共搜索或建筑 Provider 可用，流程因“无可执行分支”错误落到 `time_budget_exhausted`，剩余时间、查询、页面、视觉调用和字节预算无法用于补查。

## 2026-08-07 — goal-specific execution runners

- `execute_research_run` 已改为只做一次目标分发：建筑进入 `research_paths/precedent_runner.py`，图纸进入 `research_paths/drawing_runner.py`。
- 建筑 runner 不接收视觉平台搜索器，并向共享执行底座显式传入空值；图纸 runner 不接收公共页面解析器，并显式传入空值。这样错误的调用方依赖不会跨路径生效。
- `precedent.py` 与 `drawing.py` 继续分别拥有来源归一化、搜索许可、补查轮次、查询文本、终态判定和图纸质量筛选；共享底座只承载数据库、证据、预算、checkpoint 和持久化生命周期。
- 结构/行为回归：路径 7/7、workflow 53/53、browser inspection 168/168、XHS 24/24；完整 API 门禁、Ruff、format、strict Mypy 32 个源文件和 `git diff --check` 全绿。
- 本轮未修改 Board/Extension，未创建新 Research Run；现有现场 Run 与 `.artifacts/` 数据保留不变。`v2.2.10` 已在后续发布流程中完成发布。

## 当前唯一下一步

Phase 43 已完成：全局建筑查询 lane、恢复轮换、项目身份和逐子问题软多样性均通过源码、安装版 Run、API/Trace/Board 与证据链验收；图纸研究实现未修改，既有 Run 不 retry 或改写。

用户已明确授权正式发布 `v2.3.0`。API、Board、Extension、manifest、CI、release contract 与 README 已统一升版；权威门禁为 API 607/607、Board 190/190、Extension 216/216、packaged E2E 8/8 全绿。本地双产物已生成并通过版本与内容隔离检查，安装/启动/卸载 smoke 留给不覆盖用户现有安装的干净 GitHub Actions runner。

当前唯一下一步是把已审计的 28 个 tracked 发布文件提交到直接以 `origin/main` 为父提交的 `codex/release-v2.3.0`，推送并创建 ready PR；等待 CI 的 Windows smoke 与双附件构建全部通过后再合并、打 annotated tag、创建正式 Release。不得提交 `.artifacts`、`.planning`、本地数据库、Run、密钥或浏览器状态。

## 当前现场交接（2026-08-08）

- 最新隔离 API 使用项目 venv 运行在 `18072`，Board 使用 `15172` 代理到 `18072`；正式 `9872` 未监听。工作区无活动 Run。
- 建筑 E2E 已通过：Run `18c6edd1-3361-4e66-9869-c6305c3d759d` 为 `completed/coverage_satisfied`，12 结果、4/4 覆盖，XHS Trace/URL 均为 0，Board 4 案例完整渲染。
- 图纸 E2E 尚未通过：Run `f09b3e6c-695a-4076-9d9a-81e501b81c00` 为 `blocked/no_usable_assets`；6 次 XHS 搜索的媒体枚举均为 0，0 结果、0 PNG。Trace 未调用公共网页或建筑 Provider。
- 发布前隔离复验时只读桥无法直接报告 Chrome 加载的扩展版本；失败 Run 的媒体枚举为 0。正式发布的独立扩展已为 `2.2.10`，下一步必须确认 Chrome 实际加载该版本，再只做一条图纸复验。
- 未修改生产代码、未重试上述失败 Run、未触碰正式端口。遇到安全验证必须保留页面，不能刷新或反复新开标签。

## 当前交接状态（2026-08-08 发布后）

- `v2.2.10` 正式 Release 已发布：`https://github.com/jileyu2000/archresearch/releases/tag/v2.2.10`，非草稿、非预发布。
- PR #22 已 squash 合并；annotated tag `v2.2.10` 解引用到主线提交 `a2ff995bfed696980df61962ca592f2a2b56d5d6`。
- 主线 Hosted CI run `31245075246` 成功：完整门禁、扩展打包、Windows 安装器构建、安装/启动/卸载 smoke 和两个附件上传均通过。
- 发布附件来自该主线 run：扩展 ZIP 20,438 bytes，SHA-256 `3ADD848F3A094410B2C2295B5F5CA88B6FD924C9F64F4F00CB6763DB0F1C7624`；Windows 安装器 70,255,649 bytes，SHA-256 `B01936155FC6692CABD0124DB9FDB97137DCE34D4A31BEEC425E5D868466AE7F`。
- 图纸现场失败 Run `f09b3e6c-695a-4076-9d9a-81e501b81c00` 保留为发布前证据，不重试、不取消；正式发布后只做一次新现场复验。

## 线程切换收口（2026-08-08）

- `v2.2.10` Release 说明已修正为真正的多行 Markdown，原先显示的字面量 `\\n` 已移除；附件、tag 和 Release 状态未改变。
- 当前产品代码已提交并推送：本地分支 `agent/local-release-v2.2.2` 与远端同名分支均为 `81087c4`；正式 `main` 与 `v2.2.10` tag 指向 `a2ff995`。
- 工作区中 `HANDOFF.md`、`findings.md`、`progress.md`、`task_plan.md` 是线程交接记录，保留为本地修改，不纳入产品提交；`.artifacts/ci/` 保存 CI 附件，`.planning/submission-pack-2026-08-06/` 保存竞赛材料规划，均不删除、不提交。
- 唯一后续动作：确认 Chrome 实际加载正式 `v2.2.10` 独立扩展并保持小红书登录态，再只创建一条图纸现场复验。安全验证页必须保留，不刷新、不重复开标签。

## 2026-08-08 安装版验收现场

- 当前验收目标已切换为用户实际安装的 `C:\Users\76384\AppData\Local\Programs\ArchResearch\ArchResearch.exe`；`/desktop-health` 返回 `2.2.10`、动态端口 `9325`，`/health` 为 `ok`，Provider 为 OpenAI-compatible、模型 `gpt-5.6-sol`。
- 安装版唯一现场 Run 为 `d1c0f6f9-1933-47a2-a0df-08e00c3eb836`，搜索 12/12 成功且每次返回 8 个候选；20 次浏览器检视全部为 `skipped / ValidationError`，最终为 `blocked/no_usable_assets`，没有 PNG 或结果。
- 安装版登录态只读探针返回 `logged_in/chrome_extension`；没有读取 Cookie、账号、密码或 API Key。QA `18072` 不再作为验收目标。
- 桌面 `archresearch-chrome-extension-only-v2.2.10` 目录与正式 CI ZIP 逐文件 11/11 哈希一致，ZIP SHA-256 为 `3ADD848F3A094410B2C2295B5F5CA88B6FD924C9F64F4F00CB6763DB0F1C7624`；尚不能通过浏览器控制页直接证明 Chrome 当前活动实例的加载路径。
- 当前唯一下一步：不创建新 Run，继续定位安装版浏览器检视中 `MediaEnumeration` 的具体校验字段或获取活动扩展实例的只读版本证据；未经修复和回归，不更新 Phase 35 为 complete。

## 2026-08-08 安装版协议诊断补丁

- 新增行为红测，用非法 `intrinsic_width` 复现浏览器响应 Pydantic 校验失败；旧实现准确因 Trace 缺少 `validation_model` 而失败。
- 最小生产改动只在既有 `browser/skipped` Trace 中记录 Pydantic 首个错误的模型名、字段路径和错误类型；调用 `errors(include_input=False, include_url=False)`，不记录原始输入、异常文本、页面正文或新增 URL。
- 红测已转绿；完整浏览器检视回归、API 全量、Ruff check、70 文件格式检查、strict Mypy 32 个源文件和 `git diff --check` 全部通过。
- Phase 35 仍为 `in_progress`。当前唯一下一步是从现工作树构建诊断安装器并覆盖安装到实际 ArchResearch 安装目录；确认安装版启动并加载该补丁后，再做安装版协议诊断。在重新安装前不创建新 Research Run。

## 2026-08-08 安装版真实协议根因

- 诊断版安装后只创建一条 `quick` 图纸 Run `99670d73-73fd-4e5a-8d80-c3ff4818cdd2`；它自然终止为 `blocked/no_usable_assets`，15 个 `browser` 事件均为 `ValidationError`。
- 新 Trace 字段确认真实错误为 `BrowserCommand.action / literal_error`，不是 `MediaEnumeration`；0 结果、0 可用资产，原始非法动作值未进入 Trace。
- 源码审计确认 `XiaohongshuBrowserSearch.open_note()` 使用受控动作 `open_xiaohongshu_note`，扩展端已有同名白名单和严格 URL 校验，但 API `BrowserAction`/`PAYLOAD_ADAPTERS` 漏枚举该动作。
- 已先写红测再修复：API 现在枚举 `open_xiaohongshu_note`，并只接受 HTTPS 小红书搜索页与详情页 URL；协议红测、browser/XHS 回归、API 全量、Ruff、format、strict Mypy 和 diff check 全绿。
- 当前唯一下一步：用包含协议修复的当前工作树重新构建并覆盖安装实际版本；安装版重启并确认桥/登录态后，只对同一诊断 Run 做一次 retry，以验证详情检视和后续媒体枚举，不创建第三条 Run。

## 2026-08-08 安装版详情路径修复

- 同一 Run `99670d73-73fd-4e5a-8d80-c3ff4818cdd2` 的唯一 retry 已自然终止为 `blocked/no_usable_assets`；本次 Trace 序号 59–116 中，15 个 browser 事件的旧 `BrowserCommand.action/literal_error` 已为 0，证明动作枚举修复在实际安装版生效。
- 新的 15/15 错误均为 `BrowserCommand` 根级 `value_error`，目标全部是实际小红书详情 URL `/search_result/<note-id>`。根因是 API 把搜索页“精确 `/search_result`”规则错误复用于详情 URL；扩展端原本已正确区分搜索页与详情页。
- 已按红测流程修复：搜索页仍只允许精确 `/search_result`，详情页只允许 HTTPS 小红书官方主机下 `/explore/<id>`、`/discovery/item/<id>`、`/search_result/<id>`；未增加任意导航、selector、脚本、表单、凭据或浏览器存储能力。
- 定向 browser/XHS 57/57、API 全量 600/600、Ruff check、71 文件 format check、strict Mypy 32 个源文件和 diff check 全绿。
- 修复安装器位于 `.artifacts/qa/phase35-installed-note-path-fix/ArchResearch-Windows-x64-Setup-v2.2.10.exe`，69,760,819 bytes，SHA-256 `2D8879868BA5836680C84D9CE0A91C0BBDC3B4F40645703F78A1873CDBE397E1`。
- 已静默覆盖实际安装目录；SQLite 安装前后 SHA-256 均为 `5CC8B0551390D36AE30330EEC2D9181D6CF09950FFDECAEF4D63195B5CE2D4E4`。已安装 EXE 与冻结构建均为 `F69D9463BC9A165102359C7E29C253CC63BF16E260FA3BD61741F4A7D951D6CC`。
- 当前实际安装版 PID `46888`、动态端口 `7016`，`/desktop-health`、`/health`、`--self-test` 正常；扩展桥 connected，本次唯一 session 检测为 `logged_in/chrome_extension`，没有安全验证状态。
- 产品安装版没有详情协议 QA 路由；隔离 harness 不能替代安装版。目标 Run 已按约束只 retry 一次，当前仍为 `attempt=1`，未创建第三条 Run。
- **当前唯一下一步**：用户明确允许一次额外 attempt 或新 Run 后，直接使用当前 `7016` 安装版做最终 XHS-only 现场复验，要求 `BrowserCommand` 校验错误为 0、进入详情元数据/媒体枚举并逐张验收 PNG；未获授权前不再消耗 Run。Phase 35 保持 `in_progress`。

## 2026-08-08 安全验证暂停

- 用户报告安装版 retry 后小红书刚出现安全验证页。
- 已停止所有浏览器动作；不得刷新、反复新开标签、关闭验证页或调用 session 检测。等待用户本人完成验证并明确通知后，才做一次状态确认。
- 当前安装版仍为 PID `46888`、端口 `7016`；目标 Run `99670d73-73fd-4e5a-8d80-c3ff4818cdd2` 的 retry 已达到 `attempt=2`，不得继续 retry 或创建新 Run。

## 2026-08-08 扩展详情链接修复

- attempt 2 的 API 校验错误已为 0，但 5 个详情打开在扩展执行层返回 `BrowserCommandError`，没有页面元数据、媒体枚举或 PNG。
- 红测复现扩展内容脚本原先要求完整 `candidate.href === target.href`；实际卡片可能为同一路径并附带 `xsec_token` 查询参数。
- 已修复为：候选链接通过既有小红书详情 URL 白名单后，按同源 `origin + pathname` 匹配，忽略查询参数和尾部斜杠。扩展 215/215、packaged E2E 8/8、lint、typecheck、build 全绿。
- 新候选 ZIP：`C:\Users\76384\Documents\灵感agent\.artifacts\qa\phase35-extension-note-link-fix\archresearch-chrome-extension-only-v2.2.10.zip`，SHA-256 `9CB91FCFF8DD04B41C8FF676006482790DF1031D1A272EADDDA29CC319F6D455`。
- 候选尚未加载到 Chrome；不要访问 `chrome://extensions` 绕过安全策略。加载/重载由用户完成后，先只做一次安装版 session 确认，再决定是否进行新的现场执行。目标 Run `99670d73...` 已到 `attempt=2`，不得继续 retry。

## 2026-08-08 候选扩展已加载

- 用户已加载/重载 `.artifacts/qa/phase35-extension-note-link-fix` 候选扩展。
- 安装版 `7016` 只读 session 确认返回 `logged_in/chrome_extension`；未刷新、关闭或新开小红书页面。
- 现有 Run `99670d73-73fd-4e5a-8d80-c3ff4818cdd2` 已到 `attempt=2`，不得继续 retry。若要验证扩展详情链接修复，必须由用户明确授权一次新的现场 Run；Phase 35 继续 `in_progress`。

## 2026-08-08 新安装版现场 Run 已创建

- 用户已明确授权创建一次新的安装版 quick XHS-only 图纸 Run。
- 新 Run：`0633b2a4-b76a-458d-bf00-6beab6a19458`；问题为“帮我找几种剖面图风格”；`goal=visual_reference_search`、`budget_mode=quick`、`research_sources=[xiaohongshu]`。
- 创建前安装版 `7016` 健康，工作区活动 Run 为 0；未重试旧 Run `99670d73-73fd-4e5a-8d80-c3ff4818cdd2`。
- 当前状态：Run 已进入 `inspecting`，Provider 已生成 3 个视觉方向；下一步只等待自然终态并审计 BrowserCommand 校验错误、扩展执行错误、详情元数据、媒体枚举和 PNG。遇到 `verification_required` 必须保留页面并暂停。

## 2026-08-08 新安装版现场 Run 终态

- Run `0633b2a4-b76a-458d-bf00-6beab6a19458` 已自然终止为 `blocked/no_usable_assets`；保留 0 个结果、0 个 PNG，三方向搜索通过计数为 `technical_linework=2`、`collage_color=2`、`atmospheric_render=1`。
- Trace 共 58 条：5 次小红书搜索、20 次搜索/流程事件、15 次浏览检视；15/15 详情打开均为扩展 `BrowserCommandError`。API `BrowserCommand` 校验错误为 0，未进入页面元数据、媒体枚举或视觉分类。
- 本次新 Run 已用尽，旧 Run `99670d73-73fd-4e5a-8d80-c3ff4818cdd2` 仍不得 retry。Phase 35 保持 `in_progress`；下一步回到扩展详情命令层做只读诊断，不再创建现场 Run。

## 2026-08-08 扩展规范详情路径修复

- 15 次详情错误的时间间隔约 8 秒，符合点击后等待详情 URL 超时；API 校验为 0，问题位于扩展执行器的目标 URL 到达判断。
- 红测先复现：目标 `/search_result/note-42`、实际到达同一笔记的 `/explore/note-42?xsec_token=visible` 时，旧执行器等待 5 秒后失败。
- 最小修复只比较同源、批准的 `/explore/<id>`、`/discovery/item/<id>`、`/search_result/<id>` 路径中的相同 note ID；不放宽主机、HTTPS、凭据或导航动作边界。
- Extension 全量 `216/216`、ESLint、TypeScript、生产构建、packaged E2E `8/8` 全部通过。
- 新候选 ZIP：`C:\Users\76384\Documents\灵感agent\.artifacts\qa\phase35-extension-canonical-note-path-fix\archresearch-chrome-extension-only-v2.2.10.zip`，20,530 bytes，SHA-256 `59B625E44296E4F6356E6F4F24D941FEBCAC485B542F42F6EC9C96A7F2D211B4`。尚未加载；用户加载/重载后先做一次安装版 session 确认，现场 Run 需另行授权。

## 2026-08-08 新候选重载与新现场 Run

- 用户已重载 canonical detail-path 修复候选；实际安装版 `7016` 的一次正确 `POST /v1/browser/xiaohongshu-session` 返回 `logged_in / chrome_extension`。
- 初次误用 GET 得到 404，源码确认该路由只接受 POST；该失败未触发浏览器动作或改变数据。
- 用户随后明确授权；创建前活动 Run 为 0，只创建新 Run `e41c3560-ead1-42e4-8960-f3791abdd42d`：`visual_reference_search`、`quick`、`research_sources=[xiaohongshu]`。
- Run 当前为 `inspecting`，已通过 planning/searching，未出现安全验证。下一步只轮询自然终态，不取消、不 retry、不创建并行 Run。

## 2026-08-08 Phase 35 最终收口

- Phase 35 已完成。唯一验收对象仍是实际安装版 `C:\Users\76384\AppData\Local\Programs\ArchResearch\ArchResearch.exe` `2.2.10`；当前已验证进程 PID `46888`、动态端口 `7016`。
- 最终现场 Run `e41c3560-ead1-42e4-8960-f3791abdd42d` 自然终止为 `completed/coverage_satisfied`、`attempt=0`；18 个 usable assets、9 篇来源帖子、3/3 方向，`gaps=[]`、`enrichment_gaps=[]`。
- 扩展链路为 3/3 XHS 搜索和 10/10 详情检视完成；`BrowserCommandError=0`、Pydantic/协议错误=0、`verification_required=0`。未取消、未 retry、未创建并行 Run。
- Rank 0-17 即 18 个 usable assets 已逐张验收为 18/18 合格。Rank 18-19 不合格但均为 `relevance=0`，只作为持久化线索，未进入 usable 统计。
- 实际安装版 Board 首页显示“18 张参考”，详情显示“18 条可用参考 · 2 条只作线索”，并展示 20 张持久化图片；控制台 error/warn 为 0。
- 产品规范、现有实现与 Git 历史一致确认：低相关候选继续显示但不计 usable 是批准的线索保留合同，导出只接受用户明确选择的资产。因此不新增 Board 过滤，不改生产代码。
- 当前没有 Phase 35 内剩余动作。旧 Run `99670d73-73fd-4e5a-8d80-c3ff4818cdd2` 与 `0633b2a4-b76a-458d-bf00-6beab6a19458` 继续保留，不得 retry；最终 Run 也无需 retry。

## 2026-08-08 Phase 36 建筑前期召回验收进行中

- 旧安装版 Run `3ad135af-85c2-4706-a922-2d7a1c09f616` 的真实根因已确认：`time-sharing` 在初次执行和 retry 中各跑 8 轮，实际耗尽公平轮次而非时间/页面预算；查询过度绑定运营时段记录，候选 rerank 的 spatial/analogical retain 始终为 0。
- 最小修复只扩展用户已陈述入口活动的中性专业检索词，并允许最多一个受信、建筑尺度、spatial=1 的机制上下文探针进入全文阅读。公共页面 direct-match、正文事实、逐字 EvidenceClaim、relevance>=2 和建筑尺度边界未降低。
- API 全量、规划/Provider/browser 高风险回归、Ruff、format、strict Mypy、Board 190/190、Board lint/typecheck/build、Windows installer 合同和冻结程序自检全绿。
- Phase 36 安装器已覆盖实际安装目录，安装前后 SQLite SHA-256 均为 `77509C4F338556801897EC51BEEA97BAAB04F1E7613E0FA9FD37EFA5397A8EEC`；当前 PID `45652`、动态端口 `5202`，desktop/health/self-test 正常。
- 当前唯一现场 Run 是 `55dcb0ad-cce2-4ecb-b79c-25302f63e72b`：`precedent_research`、`balanced`、`attempt=0`、无小红书来源。下一步只等待自然终态并审计查询、机制探针、正文证据、覆盖、Results 与 Board；不取消、不 retry、不创建第二条 Run。

## 2026-08-08 Phase 36 建筑前期召回验收完成

- Run `55dcb0ad-cce2-4ecb-b79c-25302f63e72b` 已自然终止为 `partial/query_budget_exhausted`，不是错误终态；Trace 共 222 条，未调用小红书，未 retry、取消或创建并行 Run。
- 实际安装版现场结果为 10 个 usable assets、10 个 verified/partial、2 个正式项目、1 个 multi-asset project，覆盖 `arrival_sequence` 与 `conflict_nodes` 两个分支；`service_access` 和 `temporal_adaptation` 保留为明确未完成缺口，没有被无证据内容填满。
- 20 次候选 rerank 中有 2 次 `mechanism_context_probe`；Lourosa-Fiães Transport Interface 与 Daqing West Integrated Highway Passenger Station 分别以 `direct_match=true`、完整 evidence chain 和 5/2 条 supported facts 进入正式证据链。Dongchang Elevated Passage 仅保留为建筑尺度机制线索，正文 `direct_match=false`、supported facts=0，不计正式项目。
- Results 共 10 条资产，来自 3 个可信 ArchDaily 来源页；全部有 EvidenceClaim/text excerpt。Board 的 `analysisReady`/正文过滤只将有中文项目分析、迁移策略和逐字证据的正式案例归入案例分组，Dongchang 的 2 条线索不绕过该门。
- 结论：前期搜索的召回与候选准入已适当放宽，但来源真实性、`relevance >= 2`、建筑尺度、正文 direct-match、EvidenceClaim 和未完成缺口合同均保持。Phase 36 已完成；后续可在新需求下继续优化查询覆盖，但不得把本 Run retry。

## 2026-08-09 Phase 37 建筑关键词分层完成

- 建筑研究的检索逻辑已完成两层拆分：首轮用空间发现词召回入口、前场、到达序列、公共/后勤关系和弹性流线；后续轮次再使用项目说明、运营或其他证据角度核验。
- 典型首轮查询为 `service entrance public entrance site circulation` 与 `arrival space flexible circulation peak event`；配送、排队、入口核验、运营时段等窄证据词不再阻塞首轮召回。用户明确提出的访客/后勤流线、独立入口、服务廊道等空间关系仍保留。
- 明确的建筑项目条件继续进入查询，例如 `adaptive reuse industrial building community cultural center`；无条件时去掉重复的泛化 `architecture project`。没有新增建筑类型字典，也没有默认加入 `loading dock`、`service court` 等具体解法。
- Provider 只把专业同义词用于检索，不把它们当成案例事实；建筑尺度、正文 direct-match、逐字 EvidenceClaim、来源可信度和正式覆盖门保持不变。
- 相关 307 项、API 全量 576 项、Ruff、format、strict Mypy、diff check 全部通过；图纸 fallback 隔离回归通过。`drawing.py`、图纸查询函数和图纸现场数据均未修改。
- 本轮未创建、retry 或取消 Research Run，未重建安装器。Phase 37 的安装版静态复核留待后续发布/现场验证，需另行授权；当前唯一活动 Run 仍为 0。

## 2026-08-09 Phase 37 实际安装版建筑 Run 完成

- 实际安装版为 `C:\Users\76384\AppData\Local\Programs\ArchResearch\ArchResearch.exe`，PID `34308`、端口 `4849`；`/health=ok/openai/gpt-5.6-sol`，安装 EXE SHA-256 为 `FE09A116584D5E972966A33CEAF6C6616B207567A7086BD5A9C8B9B18FDFD7B9`。
- 唯一建筑 Run `ea8c5c8d-915c-4d83-80c3-942046d88eb5` 自然终止为 `partial/budget_exhausted`：7 个资产、3 个正式项目、覆盖 3/4；已覆盖 `arrival_sequence`、`service_access`、`temporal_adaptation`，`conflict_nodes` 仍是明确缺口。未 retry、未取消、未并行创建 Run。
- Results 中 3 个项目为 Madrid-Barajas T4（1 张，4 个 supported facts）、Flinders Street Station proposal（2 张，5 个 supported facts）和 Busan Opera House（4 张，2 个 supported facts）。7 个资产共 23 条 EvidenceClaim，均带来源 URL 和逐字 excerpt；3 个正式项目的分析事件均为 `direct_match=true`。
- Trace 156 条，XHS 调用 0，2 次 `BrowserCommandError` 未阻止完成；实际查询已使用空间发现词，后续才使用 `project description`/`operational` 等核验词。图纸路径未改动、未参与本 Run。

## 2026-08-09 Phase 38 全局 conflict_nodes 逻辑完成自动验证

- 改动只面向建筑研究流程：按“冲突节点/人车关系/入口前场”等语义触发通用空间发现 lane，后续再切换项目说明和运营证据；没有针对 Madrid、Flinders、Busan 或任何单一案例添加规则。
- API 全量 576/576、planner 24/24、Provider 查询/候选 12/12、browser 6/6、Ruff、strict Mypy 32 个源文件和 diff check 全部通过。
- 图纸查询与图纸 fallback 未修改。Phase 38 安装版现场验证尚未执行，需用户明确授权后创建新的建筑 Run；旧 Run 不 retry。

## 2026-08-09 Phase 41 建筑项目身份与 Board 现场验收完成

- 当前实际安装版为 `C:\Users\76384\AppData\Local\Programs\ArchResearch\ArchResearch.exe` `2.2.10`，PID `29872`、端口 `11561`；`/health=ok/openai/gpt-5.6-sol`、`/desktop-health=2.2.10`，活动 Run=0。
- 第二次验收 Run `bef8d1a4-5d09-4624-85e4-6cfff4979b23` 自然终止为 `completed/coverage_satisfied`、`attempt=0`：23 个 usable/verified-partial assets、8 个正式项目、4/4 子问题，`gaps=[]`；`insufficient_subquestion_assets` 仅是软提示。
- 23 个正式资产来自 8 个来源，每个来源恰有一个顶层 `project_name`；API 预期的 12 个“来源项目 × 受支持子问题”展示位全部出现在 Board，四个子问题分布为 `1/3/6/2`，不是 UI 截断或硬性配额过滤。
- Board 没有同源重复 dossier；Jahad Metro Plaza 的确定性回退明确显示“待核验假设”，没有 `service industry` 误命中。旧 Run 未 retry 或改写，XHS/图纸事件为 0，图纸差异计数为 0。
- 安装器为 `.artifacts/qa/phase41-source-identity-followup/ArchResearch-Windows-x64-Setup-v2.2.10.exe`，SHA-256 `DC99EB2B1F95C8353C6FC879590EEF7BBE1994DCF79EA5D61941AA72D6FC783D`；SQLite 覆盖安装前后 SHA-256 均为 `F62ABB35223C024DBCED25E236792D1B3991007A8B7B6502EF3EB1C477A468B2`。
- 当前没有必须继续执行的动作。后续若继续提高某类子问题的案例多样性，应新建阶段和新 Run，只把逐子问题不同项目数作为软补查优先级，不得硬卡完成或改写本 Run。

## 2026-08-09 Phase 42 建筑逐子问题软多样性调度开始

- 用户要求继续下一步。Phase 42 的目标是让建筑研究在核心覆盖已满足后，把剩余检索机会优先用于“不同正式项目较少”的子问题，而不是继续富集已经拥有较多项目的分支。
- 该指标只能影响补查顺序和软 enrichment 诊断，不能加入 `gaps`、不能阻止 `completed/coverage_satisfied`、不能要求每个子问题达到固定案例数，也不能把无正文关联的项目复制到该分支。
- 源码实现已完成：precedent coverage 按正式顶层 `project_name` 统计每个子问题的不同项目数；核心覆盖完成后，每轮查询按项目数稳定排序，项目少者先执行，但不删除同轮其他查询。覆盖未完整、数量相同、预算、query key、resume/retry 与终态合同保持不变。
- 自动验证通过：目标 4/4、coverage/workflow/path 回归全绿、browser inspection 156/156、API 全量 605/605、Ruff lint、62 文件 format check、strict Mypy 32 个源文件和 `git diff --check`。`research_paths/drawing.py` 差异为 0。
- 当前安装版仍为 PID `29872`、端口 `11561` 的 Phase 41 版本，健康正常、活动 Run=0；没有构建、安装、retry 或创建 Phase 42 Run。
- Phase 42 已完成：保护性覆盖安装后只创建 Run `9fab66b8-feec-40fd-b4ae-feecc17124e0`，自然终止为 `partial/no_new_assets`，13 usable、3 项目、3/4 子问题。新分支项目统计已进入安装版，coverage-first 与 Board 证据归属正常；因后勤分支始终为 0，核心覆盖完成后的软重排没有现场触发，未作虚假通过。
- 当前唯一下一步是 Phase 43 的全局查询策略红测：固定首轮“空间发现 + 证据角度”的互补 lane，并让 recovery 在空间关系/运营证据/项目说明之间轮换，避免过度字面化。不得加入案例名、URL、类型特例或硬数量配额；源码门禁前不构建，另获授权前不创建新 Run，图纸研究不参与。
- 当前安装版 PID `11140`、端口 `14523`，`/health=ok`、`/desktop-health=2.2.10`、扩展桥 connected、活动 Run=0；安装 EXE SHA-256 为 `13488684A685B64A8443B5FDE36604CC9097A9AC9045B2AF8A3A46AE58EE4856`。

## 2026-08-09 Phase 43 建筑查询策略源码完成

- 全局 architecture retrieval lane 由 round 稳定决定：首轮 spatial discovery，后续循环 spatial relationships、operational evidence、project description。正常 Provider 双槽首轮必须是 `space_first + evidence_angle`，不能退化为泛 `project_context`。
- Provider 或时间不可用时 deterministic fallback 保持单槽，避免额外搜索破坏跨子问题公平预算；fallback strategy 仍按当前 lane 标记。已拆出的中英文问题不再逐轮复写完整 subquestion，简短未知项目范围仍保留。
- 运营核验/状态类长枚举每条最多选 3 个显式维度并跨轮次换组；用户明确的空间、构造、图纸对象不受该限制。正文 direct-match、来源、尺度、EvidenceClaim、coverage、Board 和 Phase 42 软多样性边界均未降低。
- 自动门禁通过：API 607/607、Provider 88/88、browser inspection 157/157、workflow/verification/path 55/55、Ruff lint、62 文件 format check、strict Mypy 32 个源文件、`git diff --check`；`research_paths/drawing.py` 差异为 0。
- 当前安装版仍是 Phase 42：PID `11140`、端口 `14523`、`/health=ok/openai/gpt-5.6-sol`、`/desktop-health=2.2.10`；11 条历史 Run、活动 Run=0。本阶段未构建、安装、retry 或创建 Run。
- Phase 43 已完成。候选已保护性覆盖安装，SQLite 前后哈希一致，实际安装 EXE 与候选冻结 EXE 哈希一致；新安装版为 PID `43912`、端口 `3303`，健康且扩展桥 connected。唯一 Run `3d85f4f0-1988-41b9-9e83-47e11e3bb4b9` 自然完成为 `completed/coverage_satisfied`、`attempt=0`，33 usable、7 项目、4/4、`gaps=[]`；Trace/API/Board 与最终门禁全部通过。当前没有必须继续执行的动作；若继续优化，应新建阶段和新建筑 Run，不 retry 本 Run，不修改图纸研究。
- Phase 43 已完成。用户随后授权正式发布 `v2.3.0`；Phase 44 已完成范围审计、统一升版、权威门禁与本地双产物构建。当前唯一下一步是从最新 `origin/main` 创建干净发布提交并进入 PR/CI；本地数据库、Run、密钥、构建缓存和 `.planning` 状态不得提交。
