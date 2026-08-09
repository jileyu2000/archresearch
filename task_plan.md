# ArchResearch 本地产品计划

## Phase 29 — v2.2.9 图纸研究现场仍为零结果

Status: **completed**

目标：定位并修复 v2.2.9 在 Chrome 扩展已连接、小红书搜索可用时，图纸研究三个方向仍全部返回 0 条参考的问题；不能继续只增加固定等待时间。

1. **只读现场审计**：定位最新失败 Run、安装版端口与数据库，读取 Trace、查询方向、搜索耗时、枚举结果和过滤结果；检查当前 Chrome 受管搜索页的可见状态。
2. **协议分层定位**：分别验证内容脚本是否枚举到卡片、扩展是否返回媒体、API 是否接受 URL/尺寸，以及受管标签是否与手动页面使用同一搜索结果形态。
3. **行为红测**：用现场证据建立能稳定复现真实失败边界的测试，旧 v2.2.9 实现必须准确失败。
4. **最小修复与验证**：只修复已证实的层级，运行定向测试、相关 API/Extension 回归、Ruff、Mypy、ESLint、TypeScript 和必要的打包 E2E。
5. **现场复测**：静态门禁通过后再决定是否需要重启源码服务或创建单条新 Run；不修改已有失败 Run，不读取凭据。

### Success criteria

- 能从最新失败 Run 和当前 Chrome 页面证明零结果发生在哪一层，而不是推测加载时间。
- 红测覆盖现场真实页面/协议差异，修复后至少能返回有效小红书笔记候选。
- 保留 XHS-only、URL 白名单、单活 Run 和 fail-closed 合同，不读取 Cookie、storage、账号、密码或 API Key。
- 原工作区既有修改、发布 worktree、本地产物和真实研究数据保持不变。

### Errors encountered

| Error | Attempt | Resolution |
| Chrome 搜索页接管、截图和页面脚本读取连续超时 | 3 | 不再重复同一路径；保留当前标签不动，改用 Trace、只读 HTTP 和本地协议红测。 |
| 可见 DOM 读取通道同样超时 | 1 | 现场候选数组仍不可得；以本地真实边界红测和权威离线门禁收口，现场复测留给独立候选包。 |
| Chrome 扩展桥未注入隔离 `15172` 页面，且浏览器策略阻止直接打开扩展管理/弹窗页 | 1 | 保留隔离 API/Board；请求用户重新加载 v2.2.10 候选扩展后再做唯一真实流程验收，不绕过浏览器策略。 |
| 用户截图中的隔离 Board 返回 `ERR_CONNECTION_REFUSED` | 1 | 复核发现 `15172` 当时无监听；随后隔离 API/Board 已恢复并以 HTTP 200 验证，继续追查服务生命周期。 |
| 外部 Chrome Board 接管连续超时 | 2 | 不再重复接管；改用标签列表、API 只读状态和用户手动重载候选扩展完成现场准备。 |
| 隔离 API `/v1/browser/xiaohongshu-session` 返回 `unknown/chrome_extension` | 1 | Board 预检 fail closed，不创建新 Run；等待候选扩展在隔离 Board 完成配对和网页读取授权。 |
| Chrome Board 的 Playwright/DOM 读取连续超时 | 2 | 不再重复页面脚本读取；保留标签列表和 HTTP/API 证据，避免把工具超时当成页面失败。 |
| 打包 E2E 静态元数据与 FastAPI fixture 未产出预期结果 | 2 | 串行重试仍复现，记录为当前仓库 E2E 基线缺口；新增详情执行器测试与单测门禁不受影响。 |
| 并行运行两个固定资源的 E2E 用例导致 `No connected extension socket` | 1 | 停止并行运行；后续只按串行方式复验。 |
| Chrome 控制模块首次按 skill 子目录导入失败 | 1 | 定位到插件根目录 `scripts/browser-client.mjs` 后成功连接；未重复错误路径。 |
| 同步生产构建时候选 manifest 被覆盖回 `2.2.8` | 1 | 立即复核发现，只恢复候选目录版本为 `2.2.10` 后重新压缩；功能 bundle 哈希保持一致。 |
| 并行只读 HTTP/日志探针的外层工具等待在 10 秒超时 | 1 | 未重复相同并行调用；改为单独执行 40 秒上限的 session 探针，成功取得 3838 ms `unknown/chrome_extension`。 |
| 用 `Start-Process curl.exe` 准备后台 session 探针被执行策略拒绝 | 1 | 未绕过策略；改为同一工具调用内并发执行一个 HTTP 请求和只读标签时间线，成功取得完整时序。 |
|---|---:|---|

### Current result

- 用户安装 v2.2.9 后再次完成图纸研究，结果页显示“研究尚未完成，暂未找到可用图纸”，可用参考 0，三个方向均为 0/3。
- v2.2.9 的最多 5 次结果就绪轮询未解决现场问题；Trace 已进一步证明搜索成功但详情直达被安全限制，媒体与视觉调用均为 0。
- 已完成详情直达修复的红绿闭环：API 缓存搜索页与笔记映射，扩展新增 `open_xiaohongshu_note` 枚举动作，内容脚本只点击精确白名单链接；旧实现红测准确失败。
- 定向 API 小红书 18/18、专用 inspection opener 1/1、Extension 协议/内容/执行器 91/91，API 全量测试、Ruff、strict Mypy、ESLint、TypeScript 和扩展生产构建全部通过。
- 已重新生成独立候选目录与 ZIP；manifest `2.2.10`，内容脚本哈希为 `9D3ED6DD1BC1D06008DF34E1A0556C017BFB272B9ADF3C7457FFF8E3A7525120`，未覆盖正式 `v2.2.9`。
- 截图中的 `ERR_CONNECTION_REFUSED` 已定位为隔离 Board 当时无监听；当前 `15172`、`18072` 均健康，API `/v1/browser/status` 为 `connected=true`，但 session 预检仍是 `unknown/chrome_extension`，因此本轮没有创建新 Run。
- 真实 Board→扩展→小红书流程仍未验收，Phase 29 不能标记完成；下一步是用户重新加载候选扩展并打开 `http://127.0.0.1:15172/?connect=chrome`，待 Board 显示研究环境已就绪后再复测。
- 本轮进一步复现确认：隔离 harness 的 launcher 无条件打开 Board，已修复并重启；真实单击“再次打开小红书登录”新增小红书登录页/检测页，不再新增 Board。
- 当前 Chrome 仍加载旧扩展：session API 约 8.6 秒返回 `unknown`，而可见小红书登录页和搜索页均有已登录入口。新增 `ChromeBrowserPort` 红测覆盖 session 首次无接收端时重注入，修复后扩展全量 `201/201`、lint、typecheck、build 全绿。
- 独立候选已同步为 manifest `2.2.10`，ZIP SHA-256 `BFE11B6D126779E602F7DA576105D54E3554BF29C8A2A2343A081A93B1E9A51`；正式 `v2.2.9` 未覆盖。真实新包验收仍待用户确认扩展管理页重载。
- 用户在候选扩展现场遇到小红书安全验证页后，页面被检测流程带走；当前 Chrome 只剩 Board，验证码页未被保留，Board 回到 `unknown`。本轮必须新增“验证码导航期间不关闭、不重载、不继续检测”的行为红测后再修复。
- 现场时序证实一次请求创建两个 captcha 标签；扩展 URL 优先判定与 API browser-search checker 去重两条红测均在旧实现失败、修复后转绿。
- 最新门禁：API 全量 `580/580`、Board `190/190`、Extension `203/203`，Ruff、strict Mypy、ESLint、TypeScript、两端 build 与 diff check 全绿。
- 最新候选 ZIP 内 manifest 为 `2.2.10`，ZIP SHA-256 `1126A1C73F9D8FF7A534A368D579D43CDE9FD92662E84EE03E085E984179E1AE`；真实 captcha 保留验收待用户重载候选扩展。
- 用户重载候选扩展后的真实单次检测已通过 captcha 保留边界：只出现一个 `/website-login/captcha` 标签，标签未刷新或关闭，Board 稳定进入 `verification_required`。
- 用户完成扫码后反馈 Board 仍一直检测不到登录。当前下一步改为只读核对验证完成后的实际标签 URL、Board 状态、API session 响应与扩展日志；在证明具体失败层级前不继续修改生产代码或重复触发检测。
- 现场时序与红测已定位为只读 session 内容命令的补注入只尝试一次；首次补注入撞上二次导航时抛错，API 将其收敛为 unknown。当前最小修复在原 5 秒边界内重试注入，Extension 204/204、Board 190/190、API 定向 56/56 与扩展静态/构建门禁通过，待同步候选后现场验收。
- 上述补注入候选经用户重载后仍在约 4 秒返回 unknown，现场时序无变化，已否定其为当前根因；本轮会撤销该未验收改动。新的红测边界为 session 内容命令首次抛异常后仍应在同一受管标签、同一 20 次上限内安全复检，并在每轮前继续优先检查 captcha URL。

### 2026-08-07 continuation

- 用户最新截图再次显示 `127.0.0.1:15172` 为 `ERR_CONNECTION_REFUSED`；本轮先把它作为隔离 Board 进程生命周期问题复现，不把它误判为前端路由或图纸解析问题。
- 本轮成功标准：隔离 Board/API 可持续健康检查；在候选扩展确实连接到隔离 API 后，真实图纸查询必须完成并产生至少一条可用小红书图纸参考；若仍失败，必须以最新 Trace 定位到具体协议动作后再修改。
- 代码审计发现详情页新建搜索标签后立即发送点击命令，未覆盖异步卡片渲染；新增红测先失败，修复为最多 5 次、每次 1 秒的同一搜索页安全重试。
- 修复后扩展全量测试 `199/199`、ESLint、TypeScript typecheck 和 production build 全部通过；候选包尚未重新同步，正式 `v2.2.9` 未覆盖。

## Phase 28 — v2.2.9 图纸灵感修复正式发布

Status: **complete**

目标：将 Phase 26 的登录跳转时序修复与 Phase 27 的小红书结果就绪轮询，以 Windows 应用和独立 Chrome 扩展两个分离附件正式发布为 v2.2.9。

1. **发布前提**：确认修复已合并到 `main`，Hosted CI 完整门禁和 Windows 安装/启动/卸载 smoke 全绿。
2. **附件核验**：下载主分支 CI 生成的安装器与独立扩展 ZIP，核对文件名、大小、扩展 manifest 版本和 SHA-256。
3. **GitHub Release**：创建 annotated `v2.2.9` tag，发布正式 Release，并上传两个独立附件。
4. **交接收口**：核对 tag 解引用、Release 状态和服务器 digest；更新交接与持久计划文件，不将交接文件或临时产物加入产品提交。

### Success criteria

- `v2.2.9` tag 解引用到已合并的主分支提交 `97669e0b28b13260197628c08a29113317b964da`。
- Release 为非草稿、非预发布，包含 Windows 安装器和独立 Chrome 扩展 ZIP。
- 两个远端附件的名称、大小和 SHA-256 与主分支 CI 下载文件一致。
- 主分支 CI 已通过 API 576、Board 188、Extension 190、packaged E2E 8 及 Windows smoke。

### Errors encountered

| Error | Attempt | Resolution |
|---|---:|---|
| 主分支自动触发验证曾出现平台失败/取消 | 1 | 使用同一已合并提交手动触发 run `31121126690`，完整门禁和 Windows smoke 全部通过。 |
| PowerShell 直接解析 `v2.2.9^{}` 产生命令提示 | 1 | 用嵌套 PowerShell 脚本对表达式加引号复核，确认解引用为 `97669e0b`。 |

### Current result

- PR [#21](https://github.com/jileyu2000/archresearch/pull/21) 已合并，主分支验证 run `31121126690` 全绿。
- 已推送 annotated tag `v2.2.9`，正式 Release 为 [ArchResearch 本地版 v2.2.9](https://github.com/jileyu2000/archresearch/releases/tag/v2.2.9)，非草稿、非预发布。
- Windows 安装器为 70,137,821 bytes / SHA-256 `FA7DFE24CC8CD67E0DA3B46972148836D778FDAF9989C2CDE9199B264FF31AA`；独立扩展 ZIP 为 18,878 bytes / SHA-256 `958FDCC09655181F096A40C712BD1069EF4915DE075CD4B6FD8B7B307B454715`；GitHub digest 与本地文件一致。
- 用户下一步是重新安装 v2.2.9 并验证图纸灵感登录顺序和结果显示；竞赛提交材料仍待整理。

## Phase 26 — 图纸灵感登录跳转时序修复

Status: **complete**

目标：进入图纸灵感页面时不自动打开 Chrome、Board 或小红书登录页；只有在 Chrome 扩展已连接后，用户主动打开小红书登录，避免页面初始化造成多窗口混乱。

1. **行为红测**：覆盖切换图纸灵感不产生外部跳转，以及扩展未连接时登录恢复不启动 Chrome/小红书。
2. **最小修复**：移除视觉模式初始化自动登录；未连接时隐藏登录入口并让登录恢复 fail closed，保留现有连接、手动登录和安全验证流程。
3. **验证收口**：运行 Board 定向测试、Board lint/typecheck/build，并检查工作区仅包含本次相关改动。

### Success criteria

- 切换到图纸灵感不会调用 `/browser/open-chrome` 或 `/browser/open-xiaohongshu-login`。
- Chrome 扩展未连接时，登录操作不会创建 Board 或小红书页面。
- 扩展连接后仍能手动打开小红书登录并继续原有登录状态检测。

### Errors encountered

| Error | Attempt | Resolution |
|---|---:|---|
| 首轮 Hook 红测进入旧的 20 轮登录轮询并超时 | 1 | 将 Hook 红测收窄为未连接时不暴露登录入口；App 红测继续验证两个打开页面接口均不调用。 |
| 首轮完整 Board lint 发现删除 effect 后遗留未使用解构变量 | 1 | 只移除 `xiaohongshuLoginRecoveryActive` 的 App 解构，再重跑全部 Board 门禁。 |
| 两个旧回归仍要求进入图纸灵感后自动登录 | 1 | 按新产品合同改为用户显式点击“打开小红书登录”，继续保留登录轮询与完成检测断言。 |

### Result

- Board 不再在进入图纸灵感时自动打开 Chrome、Board 或小红书登录。
- 未连接且没有本地搜索回退时，小红书登录入口隐藏，恢复函数 fail closed；连接后仍可手动登录、自动轮询和处理安全验证。
- 定向测试 121/121、完整 Board 测试 188/188、ESLint、TypeScript typecheck、生产 build 和 `git diff --check` 全部通过。
- 本地开发服务可通过 `http://127.0.0.1:5173/` 验收；本次修复已随 v2.2.9 安装器与独立扩展发布。

> 本文件只保留当前可执行计划。退役 Web Edition、Cloudflare 和 M158–M178 的过程记录已删除；如确需追溯，使用 Git 历史。M0–M120 的早期本地阶段仍见 `docs/history/task-plan-archive-2026-07-27.md`。

## Phase 25 — v2.2.8 安全验证循环修复发布

Status: **complete**

目标：把 Phase 24 的小红书安全验证页保留、单标签复用和 Board 暂停轮询修复作为 v2.2.8 正式发布；Windows 应用与 Chrome 扩展必须同时更新，原脏工作区、交接记录、本地产物和真实研究数据不得进入产品提交或被清理。

1. **发布前提与范围**：确认 GitHub CLI/认证、远端默认分支、最新 `origin/main` 和精确 Phase 24 文件；Release 合同先提升到 2.2.8 并确认旧版本面准确红灯。
2. **版本同步与本地门禁**：同步 API、Board、Extension、manifest、CI artifact、README/文档和 Release 合同到 2.2.8；运行完整 `scripts/verify.ps1`。
3. **隔离发布工作树**：从最新 `origin/main` 创建独立 `agent/v2.2.8` worktree，仅落入 Phase 24 的 10 个产品/测试文件及必要版本/发布文件；统一换行后逐文件比较。
4. **产物与 GitHub 交付**：构建独立扩展 ZIP 与自包含 Windows 安装器，确认安装器不捆绑扩展；显式暂存、提交、推送并创建 draft PR。
5. **Hosted CI 与正式 Release**：PR CI 全绿后转 Ready、合并；等待最终 main CI 通过真实 Windows 安装/启动/卸载 smoke，创建 annotated `v2.2.8` tag 和正式 Release，上传 main CI 的两个独立附件并核验 digest。
6. **收口**：只读确认活动 Run 为 0，更新四个交接文件；原工作区和发布 worktree 本地产物继续保留。

### Success criteria

- v2.2.8 Windows 应用与独立扩展 ZIP 同时包含 Phase 24 修复，且安装器仍不捆绑扩展。
- 本地完整门禁、Hosted CI、Windows 真实安装 smoke、tag 解引用和 Release 附件 digest 全部通过。
- 提交不包含 `HANDOFF.md`、`task_plan.md`、`findings.md`、`progress.md`、`.artifacts/`、`.archresearch/` 或真实研究数据。
- 不读取、打印或保存 API Key、Cookie、账号或密码，不创建 Research Run。

### Errors encountered

| Error | Attempt | Resolution |
|---|---:|---|
| 首轮 v2.2.8 完整 verify 在 API 574/574 后要求格式化两个版本文件 | 1 | 只机械格式化 `__init__.py` 与 `main.py`，随后从头重跑完整门禁。 |
| 隔离 worktree 首轮 verify 在 API 574/574 后发现 6 个补丁文件混合行尾 | 1 | 仅对 6 个白名单 Python 文件执行 Ruff 机械格式化，复核内容后从头重跑。 |
| GitHub App 创建 PR 返回 integration 403 | 1 | 使用已认证 `gh` CLI 与真实 Markdown body 文件回退，成功创建 draft PR #20。 |
| PR run `30879655088` 的既有 lazy-media packaged E2E 首次枚举偶发为空 | 1 | API/Board/Extension 单测均绿；核对本次扩展 diff 不涉及媒体枚举，按真实顺序本地 E2E 8/8 再次通过，只重跑失败 job。 |
| `gh run watch` 在 attempt 2 安装器阶段遇到 GitHub API `unexpected EOF` | 1 | 立即读取同一 run 的真实步骤状态，确认 job 仍在运行并继续监控；未取消或重跑。 |

### Current state

- 用户已明确授权发布；目标版本为 v2.2.8。
- Phase 24 本地完整门禁基线为 API 574、Board 186、Extension 190、packaged E2E 8，全绿。
- 发布前提已确认；Release 合同先在旧 artifact 名上准确红灯，再同步 API、Board、Extension、manifest、CI、README/文档到 v2.2.8 后转绿；旧 2.2.6/2.2.7 发布面残留扫描与 `git diff --check` 通过。
- 第二轮权威 `scripts/verify.ps1` 全绿：API 574、Board 186、Extension 190、packaged E2E 8，以及 lint、typecheck、production builds 和发布/Windows 合同全部通过。
- 已从 `origin/main=256c70dc` 创建隔离 `agent/v2.2.8` worktree；恰好 21 个白名单文件，21/21 与原工作区验收内容一致（忽略行尾），`git diff --check` 通过。
- 6 个文件机械格式化后 6/6 与原验收内容一致；隔离 worktree 第二轮完整门禁全绿：API 574、Board 186、Extension 190、packaged E2E 8 及全部静态/构建合同。
- 本地两个附件构建成功：冻结程序 `--self-test=0`，扩展 manifest 2.2.8，安装器输入负载扩展入口文件 0；评估 fixture 仅因 verify 出现行尾工作区变化，将保留且不暂存。
- 21 文件提交为 `66c37cc` 并推送 `agent/v2.2.8`；draft PR #20 已创建，fixture、artifacts、交接记录与数据均未提交。
- PR run `30879655088` attempt 2 用时 15m19s 全绿：完整门禁、两个附件构建和真实 Windows 安装/启动/卸载 smoke 均通过。
- 最终 main run `30881344666` 用时 21m19s 全绿并完成真实 Windows smoke；两个独立附件已下载并计算 SHA-256。
- annotated `v2.2.8` tag 已推送并解引用到 `b5223649`；正式 Release 非草稿、非预发布，两个远端 asset digest 与 main CI 文件一致。
- 发布后 SQLite `mode=ro`：项目库 96/活动 0，安装版库 0/活动 0；当前无阻塞、无未完成产品任务。
- 当前唯一下一步：等待用户下一项明确任务；不要重做 v2.2.8 或清理任何工作区、本地产物与研究数据。

### Result

- 发布提交 `66c37cc` 只包含 21 个白名单文件；PR #20 已 squash merge 为 `b5223649f03f152a4b96d159da65c743832f542c`。
- 原工作区与隔离 worktree 的权威完整门禁均全绿：API 574、Board 186、Extension 190、packaged E2E 8，以及全部 lint/typecheck/build/Windows/Release 合同。
- PR run `30879655088` attempt 2 与 main run `30881344666` 均通过真实 Windows 安装、启动和卸载 smoke，并上传两个独立附件。
- 正式 [ArchResearch 本地版 v2.2.8](https://github.com/jileyu2000/archresearch/releases/tag/v2.2.8) 已发布；安装器 70,089,863 bytes / `B091208BF13B7E12D7A21770B7D56CE77EC1625266C2CC46DD55F6642209CBAD`，扩展 ZIP 18,878 bytes / `5BDD32F7C67C75641F56DE6756FF2631979063CEDC1474DE76A6F5356E817130`。
- GitHub 远端 digest、annotated tag 解引用和 Release 状态均核验通过；原工作区修改、未跟踪组件、本地产物、fixture 行尾变化和真实研究数据全部保留。

## Phase 24 — 小红书安全验证页循环打开

Status: **complete**

目标：修复图纸灵感检查小红书登录时，安全验证页被检测流程关闭、Board 又反复打开新小红书页面，导致用户无法完成验证且永远不能通过检测的问题；安全验证期间必须保留一个可操作页面并停止重复开页，完成后仍可自动或手动检测为已登录。

1. **只读链路审计**：核对 Board 自动检测/开页状态机、FastAPI XHS 会话检查和扩展受管标签关闭规则，确认重复开页与验证码页消失的准确调用链。
2. **行为红测**：先复现验证码状态下受管标签被关闭或重复触发登录入口的旧行为；测试必须证明只保留一个验证页面且后续检查复用/等待，而不是不断新建。
3. **最小实现**：只调整验证码等待期的标签生命周期与自动开页去重，不放宽登录判定，不读取 Cookie、storage、账号、密码或 API Key。
4. **验证收口**：运行定向测试、相关 Board/API/Extension 回归、静态检查与生产构建；SQLite `mode=ro` 确认活动 Run 前后为 0。
5. **交付边界**：未经用户明确要求，不 commit、push、创建 PR 或发布；保留所有既有修改、未跟踪文件、本地产物和研究数据。

### Success criteria

- 首次检测遇到 `/website-login/captcha` 时，用户看到的安全验证页不会被自动关闭。
- 自动检测或用户重试不会持续新建小红书页面；同一验证流程最多保留一个可操作入口。
- 用户完成安全验证后，登录状态可转为 `logged_in`；未完成时继续 fail closed，不能伪报就绪。
- 红测先失败后转绿，相关测试与构建通过，活动 Research Run 始终为 0。

### Errors encountered

| Error | Attempt | Resolution |
|---|---:|---|
| 恢复读取 `task_plan.md` 时内层 PowerShell 变量被外层提前展开，命令解析失败 | 1 | 改用不含外层变量的只读读取命令；未写文件 |
| 系统没有 `sqlite3` 命令 | 1 | 改用捆绑 Python 的 SQLite URI `mode=ro` 查询；未写数据库 |
| 编排脚本环境没有 `btoa` | 1 | 改用手工 Base64 编码执行 PowerShell 只读脚本；未写数据库 |
| 模块级 Ruff format check 要求重排两个已修改 API 源文件 | 1 | 只对 `browser.py`、`xiaohongshu.py` 执行机械格式化，再重跑目标测试与静态门禁 |
| 增强连续验证测试后 Ruff 要求重排该测试函数 | 1 | 只格式化 `test_xiaohongshu.py`，行为测试已通过，随后纳入整仓验证 |

### Current state

- v2.2.8 已正式发布，Phase 21–25 不重做。
- 项目库 96 条历史 Run/活动 0；安装版库 0 条/活动 0。
- 根因已确认：captcha 与普通退出登录共用 `not_logged_in`，API 每次检查新建并无条件关闭临时标签，Board 对非登录状态继续 20 次轮询。
- 三层 RED 已成立：Extension 1 项、API 2 项、Board 1 项均只失败在缺少 `verification_required`、标签保留/复用与安全验证提示。
- 专属枚举状态、持久扩展 checker、单标签保留/复用和 Board 暂停逻辑均已实现并通过完整门禁。
- 本轮修复已作为 v2.2.8 同时进入 Windows 应用与独立 Chrome 扩展；Phase 24/25 均已完成。

### Result

- Extension 将 `/website-login/captcha` 单独返回 `verification_required`，不再与普通未登录混为一类。
- API 首次遇到安全验证时保留受管标签；连续重新检测复用同一 tab ID，仍在验证时不新建也不关闭，检测到登录后才关闭。路由复用同一 checker，并用锁串行化并发请求。
- Board 遇到安全验证后立即停止自动轮询，不再调用额外登录入口，显示“需要完成小红书安全验证”；用户完成后点击“重新检测”即可继续。普通未登录的自动登录检测保持不变。
- RED→GREEN：Extension content 25/25、API 新增 2/2、Board 新行为 1/1；模块回归 API 51/51、Board 114/114、Extension 190/190。
- 权威整仓 `scripts/verify.ps1` 全绿：API 574/574、Board 186/186、Extension 190/190、packaged E2E 8/8，以及 Ruff、strict Mypy 26 源文件、ESLint、TypeScript、production builds、Windows/Release/安全合同。
- 收口 SQLite `mode=ro`：项目库 96 条历史 Run/活动 0，安装版库 0 条/活动 0。未读取凭据，未创建 Run，未 commit、push、PR 或发布。

## Phase 23 — v2.2.7 本地版发布

Status: **complete**

目标：把 Phase 21 小红书登录检测修复与 Phase 22 图纸灵感使用方法弹窗作为 v2.2.7 正式发布；不混入本地交接记录、真实研究数据或无关工作区修改。

1. **发布范围与红测**：核对 GitHub 认证、最新远端 `main` 和精确文件差异；先把 Release/README 合同提升为 `2.2.7`，确认旧版本工作流准确红灯。
2. **隔离发布工作树**：从最新 `origin/main` 创建独立 `agent/v2.2.7` worktree，只落入 Phase 21/22 产品、测试、文档和版本合同文件；原脏工作区不提交、不清理。
3. **完整门禁与产物**：运行 API、Board、Extension、packaged E2E、lint/typecheck/build、Windows/Release 合同；构建独立扩展 ZIP 和自包含 Windows 安装器，执行冻结程序自检、真实安装/启动/卸载 smoke，并确认安装器不捆绑扩展。
4. **GitHub 交付**：显式暂存确认文件，提交、推送、创建 draft PR；Hosted CI 全绿后转 Ready 并合并，创建 annotated `v2.2.7` tag 和正式 Release。
5. **发布核验**：核对 Release 非草稿/非预发布、tag 解引用、附件名称/大小/SHA-256 与 CI/smoke 产物一致；只读确认活动 Run 为 0，更新交接。

### Success criteria

- v2.2.7 安装版包含修复后的小红书登录检测与图纸灵感使用方法弹窗；扩展仍为独立 ZIP。
- 默认测试不调用真实 Provider，不读取或打印 API Key、Cookie、账号、密码和浏览器存储。
- 原工作区全部修改、`.artifacts/`、`.archresearch/` 和真实研究数据保持原位。
- 本地完整门禁、Windows smoke、Hosted CI 与 Release 附件核验全部通过。

### Errors encountered

| Error | Attempt | Resolution |
|---|---:|---|
| 首次创建 worktree 时内层 PowerShell 变量被外层提前展开，误在原仓库下创建了本轮空白 worktree | 1 | 只移除本轮误建且无修改的 worktree/分支，再用绝对字面路径从最新 `origin/main` 正确创建；原工作区修改和数据未动。 |
| 首轮完整 verify 在 API 572/572 后发现两个 API 版本文件换行格式不符合 Ruff | 1 | 只对两个版本文件运行 Ruff 机械格式化，并从头重跑完整门；最终全部通过。 |
| GitHub App 创建 PR 返回 integration 403 | 1 | 按 GitHub 发布规范使用已认证 `gh` CLI 回退，成功创建 draft PR #19。 |
| 本地 `gh run watch` 达到等待命令时限 | 1 | 读取 GitHub run 的真实状态，确认仍为 `in_progress` 后继续等待；没有取消、重跑或并发创建附件。 |

### Result

- 干净分支提交 `931b4eb` 只包含 24 个确认文件；PR #19 已 squash 合并为 `256c70dc52fcb5b0cd0fbfaf7382ba2834d087ef`。
- 本地权威门全绿：API 572/572、Board 185/185、Extension 190/190、packaged E2E 8/8，以及 Ruff、strict Mypy、ESLint、TypeScript、生产构建和发布合同。
- PR run `30843780159` 与最终 main push run `30845419827` 均全绿；两轮都完成 Windows 构建、真实安装/启动/卸载 smoke 和两个独立附件上传。
- annotated tag `v2.2.7` 解引用到 `256c70d`；正式 Release 非草稿、非预发布。
- 正式安装器为 70,082,901 bytes / SHA-256 `DB3B135DF4A6A87690FCAE3B16B13F01E3BA6C7095BA28B89718B445C78FD1C7`；扩展 ZIP 为 18,862 bytes / SHA-256 `EB27455944BEC200ECE8809CB8B9389EFFD76A82FBD17D3A38BC9ECA2530BD31`，GitHub digest 与 main CI 文件一致。
- 发布后 SQLite `mode=ro` 仍为项目库 96 条历史 Run/活动 0，安装版库 0/活动 0；原工作区与真实研究数据保持原位。

## Phase 22 — 图纸灵感使用方法弹窗

Status: **complete**

目标：用户首次从“建筑设计研究”切换到“图纸灵感”时看到一次轻量使用方法提醒；关闭后可通过图纸灵感专属“使用方法”按钮再次打开。现有扩展连接和小红书登录检测继续留在原研究环境区域，不移入弹窗。

1. **入口边界**：弹窗只说明扩展安装、连接和登录小红书的使用步骤；不接管任何实时状态或检测动作。
2. **行为红测**：覆盖首次切换自动弹出、扩展安装链接、关闭后不自动重复、图纸灵感专属“使用方法”按钮手动重开，以及全过程不创建 Run。
3. **最小实现**：使用标准可访问 dialog 和本地一次性已读标记；只新增一个“使用方法”按钮，现有连接、登录和重新检测控件保持原位。
4. **回归验证**：运行 Board 定向测试、完整测试、lint、typecheck、production build 与 `git diff --check`。
5. **交接边界**：不创建 Research Run，不改扩展协议，不 commit/push/PR/release；保留现有全部未提交修改与真实研究数据。

### Errors encountered

| Error | Attempt | Resolution |
|---|---:|---|
| `rg` 把以 `--color` 开头的搜索模式误识别为命令参数 | 1 | 下一次使用 `rg -- '<pattern>'` 终止参数解析，不重复原命令 |

### Completed

- 首次进入图纸灵感时以 `localStorage` 版本化已读标记控制一次性使用方法提示；关闭、Escape 和焦点返回复用现有 overlay 基础设施。
- 静态说明覆盖扩展下载/解压加载、连接 ArchResearch、登录小红书、安全验证和返回重新检测；稳定版 Release 页面作为扩展安装入口。
- 研究环境只新增一个“使用方法”按钮；原有连接 Chrome、打开小红书登录、自动轮询和重新检测保持原位与原逻辑。
- RED 精确失败后实现；定向 App/Home 113/113、Board 全量 185/185、lint、typecheck、production build 与 `git diff --check` 全绿。
- SQLite `mode=ro` 复核项目库 96 条历史 Run/活动 0，安装版库 0/活动 0；未创建 Research Run，未 commit、push、PR 或发布。

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

## v2.2.3 real-provider release qualification

Status: **complete**

目标：用当前 Windows Credential Manager 中的 Provider 凭据执行多条全新真实研究，确认建筑与图纸两条产品路径都完成且确实成功调用 Provider；随后整理两个未发布修复，构建、实装验证并正式发布最新本地部署包。

1. **真实 Provider 验收**：依次创建 2 条建筑快速研究和 2 条图纸灵感研究；每条都必须达到可交付终态、有逐题/逐方向结果，并在 Trace 中出现成功的 Provider 规划、分析、视觉或综合调用，不能只靠 deterministic fallback。
2. **版本与发布合同**：真实验收通过后把补丁版本统一提升为 `2.2.3`，同步 Release/安装器合同和面向用户的修复说明，不恢复退役运行时。
3. **完整本地门禁**：运行权威验证、独立扩展打包、Windows 安装器构建、真实安装/卸载 smoke、冻结程序自检与健康端点；记录产物大小和 SHA-256。
4. **GitHub 发布**：显式暂存并提交版本变更，推送当前分支，建立并合并 PR，等待 Hosted CI 成功后创建 `v2.2.3` tag 与正式 Release，上传 Windows 安装器和独立扩展 ZIP。
5. **发布核验与交接**：核对 GitHub Release 标题、附件大小、SHA-256、非草稿/非预发布状态和远端 `main`；不发布 Provider Key、真实研究数据或退役 Web URL。

### Success criteria

- 四条新 Run 覆盖建筑与图纸，各自完整展示结果；任何 Provider 认证/连接失败或纯本地回退都阻止发布。
- API Key 只由运行时从 Windows Credential Manager 使用，不读取、不打印、不写入仓库或 Release。
- `v2.2.3` Windows 安装器自包含本地 API + Board，且不捆绑扩展；扩展仍为独立 ZIP。
- 本地门禁、真实安装 smoke、Hosted CI 和 Release 附件核验全部通过。

### Model-assisted local search correction

Status: **complete**

默认建筑研究链路固定为：模型拆题与生成独立搜索词 -> 本地 Playwright 搜索候选 -> 模型只从候选集中结构化筛选 -> 本地浏览器读取正文与图纸 -> 模型分析 -> 程序绑定 URL 和逐字 EvidenceClaim。

1. **结构化合同红测**：用 Pydantic 锁定逐子问题搜索词计划和候选筛选；覆盖图书馆、旧厂房、候选 ID 白名单、重复/低相关排除、差异化补查、Provider 降级、预算和 XHS 隔离。
2. **普通 Responses 辅助**：Provider 仅用普通 `responses.parse` 生成查询和筛选候选；默认禁止原生 `web_search`，不要求兼容 API 支持工具调用。
3. **本地搜索闭环**：每个子问题每轮最多 2 条中英文适配查询；候选 URL、标题、摘要由本地搜索产生，模型不得编造 URL；已访问、重复项目和已判无关页面进入排除集合。
4. **补查与降级**：覆盖不足时把缺失子问题、失败原因和排除摘要交给模型生成不同补查词；规划或筛选失败时使用改进后的确定性模板，未知类型默认 `public building` 而非旧建筑改造。
5. **Trace 与验收**：记录 `search_query_planning`、`candidate_reranking` 的 Provider 状态、子问题/候选/保留数量和 fallback 错误；建筑发布验收不得依赖确定性查询或筛选 fallback。

#### Search success criteria

- 社区图书馆查询包含 library、atrium、stepped reading、circulation、daylight、structure，且不出现无关改造模板词。
- 旧工业厂房改造保留 adaptive reuse、industrial building、retained structure 等条件词。
- 候选筛选只返回本地候选 ID；重复 URL、重复项目、低相关项和已排除项不进入完整页面分析。
- 查询数、Provider 调用、页面读取均受现有 Run 预算约束；XHS 图纸研究不进入普通网页路径。
- 2 条建筑真实 Run 均为 `completed/coverage_satisfied`，Trace 含成功搜索词规划、候选筛选、正文分析和综合；2 条图纸真实 Run 保持 XHS-only 并完成三方向结果。

### Current qualification evidence

- 新 Provider 配置的模型列表读取成功：返回 8 个模型，所选 `gpt-5.6-sol` 存在。
- 所选模型的 `responses.structured_output` 真实能力探测成功；Key 仅由 Windows Credential Manager 提供，未读取或输出。
- 模型辅助本地搜索核心工作流、旧 Provider 可控时钟兼容、零覆盖 retry 重检、完整 API、Ruff lint/format、strict Mypy 和 `git diff --check` 已通过。
- 候选 fallback 已区分新旧 Provider：支持 reranker 的真实模型路径在调用失败或时间不足时执行严格类型/相关性过滤；未实现新协议的旧 Provider/mock 保留原确定性排序。先前 8 个兼容失败与新增低相关 fallback 测试均通过，随后完整 API、Ruff、strict Mypy 和 `git diff --check` 全绿。
- 真实候选诊断后补齐召回合同：确定性补查从总题继承新建/改造条件与类型，非新建站点压缩仍优先保留 library，同类型可信项目即使搜索摘要为空也由模型保留一次正文核查机会；完整 API 与静态门禁通过。
- API/Board 已重启并加载稳定子问题域名槽位修复；当前只运行建筑 Run `ca3c9228-272e-4ec7-8144-76b97906bb2e`，等待终态后按完整 Provider Trace 与 EvidenceClaim 门槛判定，期间不创建并发 Run。
- 该 Run 已以 `partial/budget_exhausted` 终止，仅 1/3 覆盖；新增红测锁定中庭功能查询被 `section` 误判、缓存页抢占新候选唯一分析名额，以及后期强页无法补早期分支。最小实现、相关 245 项、完整 API 426 项、Ruff、64 文件格式检查、strict Mypy 和 `git diff --check` 均通过，待重启后创建全新 Run。
- 恢复缓存修复后的 Run `cb2eb4a3-6c9f-4a62-b740-f28836698642` 自然终止为 `partial/budget_exhausted`、1/3 覆盖；Calgary New Central Library 为跨层流线形成逐字 EvidenceClaim，15 次查询规划、15 次候选筛选、10 次正文分析和综合均由 Provider 成功，fallback/XHS 均为 0。该 Run 保留且不 retry。
- 从该 Run 的真实查询新增 5 条站点压缩红测：公共楼梯/坡道/步行廊道必须保留 `atrium circulation`，阅览平台/多功能房/公共客厅必须保留 `atrium program layout`，`purpose-built` 必须识别为新建。最小同义词和新建条件修复后参数化测试 10/10、完整 API 435/435、Ruff、64 文件 format check、strict Mypy 26 个源文件和 `git diff --check` 全绿。
- 工业改造 Run `dfadd8a8-4f45-42cf-99dd-8d2401f0eaa5` 最终用 Rotterdam 仓库同一页的 Provider 正文证据覆盖 3/3，但仅 1 个项目、2 个资产，终态仍为 `partial/budget_exhausted`，不计入验收且不 retry。15 轮中 5 次本地搜索超时、1 次一般错误、3 次零结果，只有 6 轮形成候选。
- 审计确认模型原始查询准确，但站点压缩把功能与采光查询都改成公众/后勤流线；弱类型候选又阻止同站点宽化，工业宽化词还丢失文化中心条件。新增 6 条行为红测后，功能/采光机制、弱候选宽化和 `industrial adaptive reuse cultural center program` 均已锁定；公开页面 60/60 通过，真实项目 Playwright 已召回文化枢纽、改造舞蹈中心、画廊和旧茶仓候选，待扩大回归。
- 相关五文件 242/242、完整 API 441/441、Ruff、64 文件 format check、strict Mypy 26 个源文件和 `git diff --check` 已通过；最新 Run `07a2ca39-ce70-4b6c-8989-98b3f207c4a9` 达到 3/3 覆盖、12 个资产、3 个项目，但因 `multi_asset_projects=0` 终止为 `partial/no_new_assets`，不计入验收且不 retry。
- 只读审计确认 Deichman 已缓存同页 `analysis_diagram`、`axonometric`、`section` 三类资产，但均未进入正文分析；综合第一次 `APITimeoutError` 后直接使用确定性回退。下一步以这两个真实缺口补红测，不增加查询、页面读取或 Provider 最坏调用预算。
- 两条红测已转绿：覆盖完成且仅缺多资产类型时，工作流从已缓存、至少含两种图纸类型的项目页选择一个未分析分支，最多补一次正文分析，不新增搜索或页面解析；综合 `APITimeoutError` 复用原两次循环的第二次机会，最坏调用预算不变。
- 相关四文件 198/198、完整 API 443/443、Ruff lint/64 文件 format check、strict Mypy 26 个源文件和 `git diff --check` 全绿。下一步重启并创建第一条全新建筑验收 Run。
- 第一条修复后建筑 Run `5a8dd293-f844-4bb0-ab1b-4ca1a2f63e00` 为 partial，不计入验收；比较型 Run `87b31259-2182-485d-b592-7291d592c3cc` 暴露命名项目被站点压缩删除，在无正式结果时取消。
- 命名项目查询红测与最小修复已完成：每条模型查询至多保留一个显式项目锚点，站点压缩不再删除该名称。相关 222 项、完整 API 445 项和静态门禁全绿。
- Run `7525616f-1864-44ea-9644-044857bb45f2` 验证 15 条真实查询均保留单项目锚点，但因页面分析首次 `APITimeoutError` 直接 fallback 且仅 1 个正式项目而不计入验收。页面分析现可在原两次总调用预算内重试一次瞬时超时；相关 200 项、完整 API 446 项、Ruff、strict Mypy 和 `git diff --check` 全绿，待重启后创建全新 Run。
- Run `3bec22da-8484-4f9b-9053-24a0231b565f` 无 fallback 且 Calgary 覆盖 2/3，但 Daegu 未召回，终态 partial。命名项目第二次站内宽化现继续保留项目名、条件、类型、机制和证据类型；项目 Playwright 已真实召回 Daegu 首位，相关 224 项、完整 API 447 项与静态门禁全绿，待重启后创建全新 Run。
- Run `e2c64da9-9e0a-4c60-9336-501fab671561` 因查询规划/候选筛选 `APIConnectionError` fallback 在 0 资产时取消；随后项目 Provider capability probe 成功。
- Run `11a62e85-81ed-40e5-93c7-9aeca58eec70` 暴露单项目查询候选漂移：Daegu 查询中模型保留 Calgary，页面扩展又进入住宅和 podcast；无正式证据且后续出现 fallback，已取消并保留。
- 当前修复步骤：先用红测要求单个命名项目锚点在模型筛选前过滤候选，支持每轮最多 2 条独立查询且不改变无命名查询；随后跑完整门禁并创建全新单活建筑 Run。
- 候选锚点修复已完成：单项目漂移、双项目独立锚点和无命名兼容测试通过；相关四文件 226 项、完整 API 449 项、Ruff、64 文件格式、strict Mypy 和 `git diff --check` 全绿。下一步重启并开始第一条建筑真实验收。
- 修复后 Run `edf2aae3-60dc-479f-92b8-ae1a2b4c18fe` 验证 Daegu 锚点与正文链路正确，但因候选筛选/正文连接 fallback、最终综合超时 fallback 和 rooflight 正文证据不足，以 `partial/no_new_assets` 结束；不计入验收且不 retry。
- 当前真实验收仍为 0/4；下一步先运行不暴露 Key 的项目 Provider capability probe，成功后创建一条不机械重复 rooflight、改用已知正文可证实机制的全新单活建筑 Run。
- capability probe 成功后的 Run `e7b143e9-9ef1-4bf5-9dde-b6d9d137396f` 达到 3/3 正文覆盖但只形成 Hunters Point 一个正式项目，且含 Provider fallback，不计入验收。
- 新根因已定位为命名项目身份未传递到 Designboom 页面扩展：Daegu 父项目页被正确读取后，程序转而分析侧栏 podcast/住宅。下一步强化现有命名候选红测，使相关链接也不得被读取，再做最小扩展过滤修复。
- 命名页面扩展和瞬时 Provider 有界重试均已完成；相关四文件 230 项、完整 API 453 项与全部静态门禁通过。下一步重启后用同一命名比较题创建全新 Run，验证 Daegu 父页直接分析、项目多样性和 fallback=0。
- 修复后命名 Run `259efb0e-a0ed-4258-b4e3-caa9572b030d` 无 Provider fallback，父页直读正确，但因 Hunters/Calgary 对应站点没有召回匹配项目，以 2/3 partial 结束。下一步改用不强制项目名、机制仍可逐字证明的普通新建社区图书馆问题创建全新 Run。
- 普通图书馆 Run `104aa378-ce28-4238-9a96-ddfd7edd70c3` 达到 3/3、16 个资产和 3 个项目，但正文/查询规划/综合均有 Provider fallback，且 `multi_asset_projects=0`，终态 partial，不计入验收且不 retry。
- 针对该 Run 新增三项红测驱动修复：多图纸 recovery 优先正文意图匹配的子问题；quick 综合首次保持 medium、瞬时错误第二次改用 low；完整语义 article 优先并移除 Designboom `architecture connections` 推荐区。真实 Constitución 页面复核无两条污染句；相关 228 项、完整 API 455 项、Ruff、55 文件格式、strict Mypy 26 个源文件和 `git diff --check` 全绿。下一步重启、probe 并创建全新单活建筑 Run。
- 后续 Run `d0f41d2d-923c-45c8-ac15-9cf0ddfd9514` 仍为 partial；新增具体父页直读和 quick 综合 shared deadline 红测已局部通过，但扩大回归有 4 个 remote-visual 兼容失败，当前阶段未收口，必须先修复再创建新 Run。
- remote-visual 兼容失败已定位为合法 `Courtyard Archive` 项目名被过宽标题守卫误判，修复后定点 8/8、相关四文件 229 项和完整 API 456 项通过；待静态门禁后重启验证。
- 静态门禁已完成：Ruff、55 文件格式、strict Mypy 26 个源文件与 `git diff --check` 全绿。下一步重启、probe，并用同题新 Run 验证父页直读与综合 shared deadline。

### Errors encountered

| Error | Attempt | Resolution |
|---|---:|---|
| `session-catchup.py` 调用系统 `python.exe` 命中 Microsoft Store 占位符 | 1 | 改用 Codex 工作区捆绑 Python，恢复报告成功生成 |
| 开发 API 的 `/desktop-health` 返回 404 | 1 | 当前源码服务以 `/health` 和 Board 200 验证；安装版 `/desktop-health` 留到安装 smoke 验证 |
| 第一条建筑验收 Run 终态为 `partial/budget_exhausted`，仅覆盖 1/3，综合因 `ValueError` 使用确定性回退 | 1 | 正在定位结构化综合校验和低相关重复检索的具体合同缺口；该 Run 不计入发布验收 |
| 综合诊断脚本首次导入不存在的 `archresearch_api.repository` | 1 | 改用 `agent.execution.get_run`；未触发 Provider 请求，第二次脚本成功执行 |
| 相关回归仍断言单次综合最坏耗时，中文采光查询要求旧短语连续 | 1 | 同步预期为两次有界综合；结构词移到原中文短语之后，保留旧查询合同 |
| 新图书馆 Run 的三个不同子问题生成了相同“环形流线”公开搜索词 | 1 | 用真实规划子问题补红测；为自然光/眩光/侧高窗和声学/噪声/动静分区增加明确意图权重 |
| 模型辅助搜索红测在缺失新 Pydantic 合同处无法收集 | 1 | 预期红灯；开始实现查询计划、候选评估模型和普通 Responses 方法 |
| 新搜索辅助无条件读取可控 `clock()`，并让零覆盖 retry 继承旧来源排除集 | 1 | 仅在规划/筛选 Provider 存在时读取时间；零覆盖 retry 清空跨 attempt URL、项目和已检查页面排除，3 个兼容红测与 strict Mypy 转绿 |
| 首条新模型辅助建筑 Run 的 15 次规划成功但本地搜索形成 0 个候选，终态 `blocked/research_synthesis_incomplete` | 1 | 保留失败 Run，不启动第二条；正在核对真实查询文本、搜索域名轮换和 Direct Playwright 返回合同 |
| 站点召回修复后的建筑 Run 已读取并分析相关图书馆，但 relevance=2 的正文分析未形成正式项目证据，终态仍为 0/3 | 1 | 保留失败 Run；正在核对 PublicPageAnalysis 字段、持久化资产和 EvidenceClaim，先补正文证据合同红测 |
| 证据纠正后的 Run 只覆盖采光 1/3，且候选 fallback 打开偏题页 | 1 | 已补逐字 excerpt 校验和 deterministic fallback 类型/文本相关性门槛；待完整回归与重启后用新 Run 验证 |
| deterministic 候选过滤破坏 8 个旧 Provider/mock 兼容测试 | 1 | 仅对支持新 reranker 协议的 Provider fallback 启用严格过滤；旧协议路径保留原排序，8/8 回归和完整 API 均通过 |
| 正式 Board payload 的新建社区图书馆 Run 经过 15 次模型规划/筛选仍为 0/3 覆盖 | 1 | 查询语义和模板边界均正确；只形成 4 个可读项目页，下一步重放关键站点查询定位候选召回与正文可证实性缺口 |
| 不含 `new-build` 的确定性补查把 library 压缩为 cultural center，空摘要同类型项目被 reranker 全拒绝 | 1 | 补查继承总题项目条件；站点压缩优先识别 library；prompt 允许可信同类型项目进入正文核查，相关 89 项和完整 API 全绿 |
| 第二版图书馆 Run 已形成真实 EvidenceClaim 但仅 1/3 覆盖 | 1 | 已确认同页跨题复用正常；问题把阶梯阅读/闭合环线/侧高窗/结构跨度设成复合硬条件，下一条改用正常粒度验证产品链路 |
| 正常粒度图书馆 Run 达到 2/3 后，唯一未覆盖题重复弱站点且未轮到 ArchDaily/Designboom | 1 | 域名选择改用固定子问题目录槽位，不再随已覆盖分支跳过而漂移；新增红测、相关 161 项与完整 API 通过 |
| 稳定槽位 Run 最终仅 1/3；中庭功能查询被证据词 `section` 压缩掉机制，缓存 Calgary 页又占用屋顶采光分支唯一分析名额 | 1 | 增加共享阅览/社区活动功能意图；新页先于缓存页分析；有恢复轮时循环末仅用已读缓存页补一个仍缺失分支。相关 245 项和完整 API 426 项全绿 |
| 已知建筑站点搜索空结果、导航超时或仅返回零相关页面后没有本地补源 | 1 | 红测覆盖三种模式；外部搜索引擎实测不可用后改为同站点宽化短查询，并新增 40 秒搜索专用最坏预算，定向测试 3/3 通过 |
| 首次降级实现把 fallback 块插入候选去重 `if/elif` 中间，产生 `SyntaxError` | 1 | 将候选校验/归并收敛为局部 `add_results()`，格式化后定向测试通过 |
| 短查询诊断脚本误导入不存在的 `PlaywrightBrowserPageParser` | 1 | 删除错误导入后重跑；尚未发起浏览器请求，未影响产品或真实数据 |
| 重启后检查工作区时先后误用 `/workspaces` 与 `/api/workspaces` | 1 | 两者均只读 404；读取 router/OpenAPI 后改用正确 `/v1/workspaces`，确认 1 个工作区、0 个活动 Run |
| 新建筑 Run 最终仅 2/3；恢复轮第二个模型保留候选未解析，最终补分析只能复用旧正式案例 | 1 | 在既有 2 页恢复额度内缓存第二个可信候选，仅 final completion recovery 可选择未分析页；红测与相关 9 项通过 |
| 恢复红测编辑时两次相似 `parse()` 上下文误匹配，分别污染旧测试和造成目标 `NameError` | 1 | 用类名精确定位，移除旧测试污染并在目标 parser 声明变量；Ruff 与目标测试通过 |

### Current acceptance checkpoint

- A/B Run `5c785452-d1f0-434e-b8fd-81d7a88daa73` 已自然终止为 `completed/coverage_satisfied`：15 个可用资产、8 个项目、3/3 子问题、`multi_asset_projects=1`，coverage 与 enrichment gap 均为空。
- 四类关键 Trace 均出现成功记录；当前只发现一个被跳过的本地页面读取错误，尚未发现 Provider 或 deterministic fallback。仍需完成查询来源、候选白名单和 EvidenceClaim 逐字审计后才能计为建筑 1/2。
- 唯一下一步：只读联合 `QueryAttempt`、`SourcePage`、`AssetCandidate`、`EvidenceClaim` 和 Trace；不创建新 Run。
- 只读审计完成：9 条查询不重复且没有题外模板词，7 个 SourcePage URL 不重复，15 个结果均绑定已读页面；四类 Provider Trace 成功且无 deterministic fallback。51 条正文事实都有 excerpt，并在写入前经过当次 Playwright 正文逐字校验；6 条无 excerpt 的图纸归属事实仅作图片索引，不承担机制证明。
- 该 Run 计为建筑验收 1/2；唯一下一步改为确认单活为 0，并创建旧工业厂房改造建筑 Run。
- 创建第二条真实 Run 前的全局证据审计发现：项目页图像 `alt` 为空时，统一持久化函数会生成没有逐字 excerpt 的 `fact`。已用社区图书馆、工业厂房改造、文化中心扩建三种项目名写红测，确认问题与题型无关。
- 通用修复只改 `_persist_expanded_project_page()`：有逐字 `alt` 继续生成事实；无 `alt` 改为绑定真实 image URL 和整图区域的 `observation`，并明确类型来自 URL 线索。5 项定向/兼容测试通过；下一步跑相关与完整全局门禁。
- 全局门禁完成：相关四文件 236 项、完整 API 459 项、Ruff、55 文件格式、strict Mypy 26 个源文件和 `git diff --check` 全部通过。下一步确认单活并重启后执行第二条真实建筑验收。
- 服务重启、API/Board 健康检查和真实 `responses.structured_output` probe 通过；已创建唯一活动旧工业厂房改造 Run `d8105a98-cea9-4dc8-934d-bb6db0e3e6c5`，创建时子问题为 0。唯一下一步为轮询和完整审计。
- 该 Run 已以 `blocked/research_synthesis_incomplete` 终止，不 retry、不计验收。按用户要求暂停新建真实 Run，先收口所有已知通用缺口与全局回归。
- 新增 `roof extension` / `vertical extension` 反例并修复共享项目扩建条件判断；查询生成、首次站点压缩和宽化压缩均使用同一规则，不含项目名分支。
- 审核并更新与新搜索合同冲突的旧断言：明确证据类型不再被压缩删除；每个子问题前两轮覆盖 ArchDaily/Designboom；不得默认生成 `box-in-box` 或 `loading dock`。
- 相关四文件 243 项、完整 API 466 项、扩建/模板词定向 8 项、Ruff、55 文件格式、strict Mypy 26 个源文件和 `git diff --check` 全绿；生产源代码验收项目名扫描为 0。
- 当前活动 Run 为 0。唯一下一步：重启源码服务、执行不暴露 Key 的 capability probe，然后创建一条新的单活建筑验收 Run。
- 2026-08-02 API/Board 与活动 Run 状态复核正常；今天唯一一次 Responses probe 仍为上游 503，不创建 Run。
- XHS 预检完成：browser connected、search available，OpenCLI 返回 4 条且全部为小红书笔记 URL。上游恢复后无需再次做 XHS 通道预检。
- 连续第三个目标回合的 Responses probe 仍返回 503；真实验收与发布无法在不伪造 Provider 成功的情况下继续，当前阶段正式标记为外部阻塞。恢复后唯一动作仍为单次 probe。
- 目标已重新激活；新阻塞审计第 1 个回合仍为 Responses 503。下一回合只探测一次，成功则立即恢复单活验收。
- 新阻塞审计第 2 个回合仍为 Responses 503，当前 2/3；下一回合成功则继续验收，失败则重新标记外部阻塞。
- 最小普通 Responses 隔离仍返回 nginx 502，而 `/models` 与当前模型正常，确认中转推理上游故障；用户要求等待修复，当前暂停探测和真实验收。
- 中转恢复后的单次 Responses structured-output probe 已成功；创建唯一活动建筑 Run `a3f722fe-42ee-4329-af4b-96277cfc7347`，社区文化中心扩建，未预填子问题。下一步只轮询和审计该 Run。
- 该 Run 已以 `blocked/research_synthesis_incomplete` 终止并保留：15 条模型查询与实际模型辅助 Trace 无 fallback，但恢复域只形成 7 个去重页面、0 个正式资产。项目 Playwright 证实 Dezeen/Divisare 多词站内恢复失效，Bing RSS/HTML 也不能提供受限结果。
- 通用候选召回修复先写红测：第 3 轮先回到 ArchDaily/Designboom，后续再扩域；Provider 覆盖失败时轮换 `extension/expansion/addition/new wing` 等价条件词；站点压缩保留所选同义词且不误加 adaptive reuse。目标 6 项、相关四文件 249 项、完整 API 472 项、Ruff、55 文件格式、strict Mypy 和 `git diff --check` 全绿。
- 服务重启后 API/Board 健康，真实 capability probe 调用成功；已创建唯一活动建筑 Run `322028c8-003b-4422-ae77-f4ac48bb891b`。唯一下一步为轮询和完整 Trace/EvidenceClaim 审计，不创建并发 Run。
- Run `322028c8-003b-4422-ae77-f4ac48bb891b` 终态仍为 `blocked/research_synthesis_incomplete`；第 2 轮一次 `APIConnectionError` 触发 deterministic query fallback，不计正式验收。第 3 轮可靠站点复用和扩建同义词轮换已真实生效，但该过度复合问题仍为 0/3，不能通过放宽 EvidenceClaim 或正文门槛制造完成。
- 普通网页查询现剔除 `小红书/Xiaohongshu/XHS/登录态` 来源词，XHS 运行路径未改。新增目标测试后，完整 API 473/473、Ruff、64 文件格式检查、strict Mypy 26 个源文件和 `git diff --check` 全绿。
- 中转恢复后的单次 `responses.structured_output` probe 成功；已创建唯一活动旧工业厂房改造 Run `9f31598c-2601-4fac-9caa-b84be01a9aad`，`quick/precedent_research/research_sources=[]`，创建时子问题为 0。唯一下一步为轮询和完整审计，不创建并发 Run。
- 第二条建筑 Run `9f31598c-2601-4fac-9caa-b84be01a9aad` 已完成并通过审计：`completed/coverage_satisfied`，3/3、11 个资产、3 个正式项目、1 个多图纸项目；75 条 Trace 无 Provider/deterministic fallback，四类关键模型阶段均成功。
- 6 条模型查询准确保留 industrial factory、adaptive reuse、community cultural center、当前机制和证据类型，没有 `box-in-box/loading dock`；5 个 SourcePage URL 无重复，11 个结果均绑定已读页面，64 条 fact 都有逐字 excerpt 且 URL 不越出白名单。
- 项目 Playwright 事后动态重读累计复核 60/64 条引文；余下 4 条对应 ArchDaily 当前 4.5k-5k 短页版本。生产写入仍由当次完整页面 `_supported_project_facts()` 精确验证，没有降低 EvidenceClaim 门槛。当前正式验收为 2/4；下一步顺序执行两条 XHS-only 图纸 Run。
- 第一条 XHS Run `f6a7fb48-cd22-4033-b90f-14af3fbb762c` 已通过：`completed/coverage_satisfied`，3/3、23 个本地图纸、9 个来源项目。规划记录 `planner=openai`，3 次 OpenCLI XHS 搜索、9 篇可用笔记和 30 次视觉调用均完成，fallback=0。
- 12 个 SourcePage 与 23 个结果全部是 XHS URL，23 个结果均有本地文件；Trace 中 `search_query_planning/candidate_reranking/public_page_analysis/local_browser` 事件均为 0。当前正式验收为 3/4，下一步创建第二条不同题型的 XHS-only Run。
- 第二条图纸 Run `814e997c-592b-4fee-b947-25cb37320025` 虽返回 `completed/coverage_satisfied`、3/3 和 20 个本地图纸，但最后方向达到 4 帖上限后仅 2 篇 usable。它违反既定每方向 3 篇 usable 合同，保留但不计验收。
- 新集成红测复现“图纸覆盖已满足、全局视觉额度未耗尽、单方向 4 帖仅 2 篇 usable”仍被误标 completed；最小生产修复让 XHS-only 完成许可直接取决于三方向 note target。
- 3 个冲突旧测试按现行合同更新：1 篇 usable 明确 partial；本地视觉回退和类型过滤在每方向 3 篇 usable 后仍 completed。完整 API 474/474、Ruff、64 文件格式、strict Mypy 和 `git diff --check` 全绿。
- 服务重启并 probe 成功后的新 Run `eb317b7b-863e-4ae0-9966-5b399d7516d9` 验证修复真实生效：尽管 3/3、12 个图纸和 coverage/enrichment gap 为空，因一个方向 4 帖仅 2 篇 usable，终态为 `partial/visual_budget_exhausted`。另有一次视觉 `APIConnectionError` fallback，明确不计验收。
- 新 XHS Run `7405fca2-003c-4446-beaa-48c96cb52d34` 达到严格完成合同：`completed/coverage_satisfied`，3/3、24 个本地图纸、9 个项目，每方向 usable 笔记 `[3,3,3]`，35 次真实视觉调用，fallback=0，普通网页路径事件为 0。当前正式验收 4/4。
- 项目 Playwright 打开四条正式 Run：两条 XHS 分别显示并实际加载 24/24、23/23 图片，各 9 篇帖子；两条建筑显示 6、8 个逐题案例，全部图片加载成功，均有研究结论、3 个子问题且没有空章节。
- QA 截图保存在 `.artifacts/qa/v2.2.3-board/`；下一阶段统一升版 `2.2.3`，执行完整发布门禁、独立扩展与自包含 Windows 安装器构建、真实安装 smoke、提交、CI、合并和正式 Release。
- `2.2.3` 版本面已统一：API、Board、Extension、manifest、Windows CI artifact、Release 合同测试、README 与部署文档一致；Release 合同红测先失败后转绿，非历史发布面不再引用 `2.2.2`。
- 权威 `scripts/verify.ps1` 已完整通过：API 474、Board 179、Extension 174、packaged E2E 8，Ruff、64 文件格式、strict Mypy、前端 lint/typecheck/build 和发布合同均为绿。
- 独立 Chrome 扩展 ZIP 已构建并核验：18,260 bytes，manifest `2.2.3`，SHA-256 `DF1EFDC5381F559BCBE6ADC65D0AE5E79E19B6722237FB229E9FEF761D74E346`。
- Windows 安装器已构建：69,715,457 bytes，文件/产品版本 `2.2.3`，SHA-256 `A1F2658D9540966B5D1F24B90012F5CA1654FE90E863789B58F7B72A8E660D65`。
- `v2.2.3` 安装器真实 smoke 已通过：静默安装、冻结程序自检、健康检查、快捷方式、扩展排除、静默卸载与残留检查均成功。
- 24 个跟踪文件已显式暂存并创建统一 `v2.2.3` 发布提交；`.artifacts/` 与 `.archresearch/` 未提交。
- 发布分支已推送并通过面向 `main` 的 Windows Hosted CI。
- 发布已完成：PR #13 通过 Windows Hosted CI run `30718825811` 后 squash merge，远端 `main` 与 `v2.2.3` tag 均指向 `fc4e7a72dd7c86b61ffb3ad91c76d3c690e9fe47`。
- 正式 Release 为 `ArchResearch 本地版 v2.2.3`，非草稿、非预发布；Windows 安装器与独立扩展 ZIP 的 GitHub 大小和 SHA-256 均与本地 smoke 产物一致。
- 当前计划无未完成阶段；等待用户提出下一项工作。

## Phase 14: Xiaohongshu first-login preflight

**Status:** complete

**Goal:** 图纸研究只能在受限、只读的小红书登录预检成功后创建 Run；未登录用户可以直接打开小红书登录页并在登录后重新检测。

1. **红测与合同** `completed`
   - 覆盖 OpenCLI 存在但未登录、扩展已连接但小红书未登录、登录已就绪和建筑研究不受影响。
2. **受限登录预检实现** `completed`
   - 不读取或保存 Cookie、账号、密码或浏览器存储；后端返回经验证的状态，Board 不再以“搜索后端存在”代替“已登录”。
3. **首次使用交互** `completed`
   - 未登录时不创建 Run，显示明确信息和“打开小红书登录”操作；登录后刷新状态才允许研究。
4. **回归与真实 smoke** `completed`
   - 运行 Python/Board/Extension 定向与相关回归，用项目 Playwright 验证未登录阻断和已登录解锁，不重做已完成的研究 Run。

### Phase 14 completion evidence

- 权威 `scripts/verify.ps1` 完整通过：API 485、Board 181、Extension 182、packaged E2E 8；Ruff、strict Mypy、ESLint、TypeScript、生产构建、发布与安装器合同全部通过。
- 真实本地端点返回 `logged_in/local_search`；只输出登录状态和通道，不输出 Cookie、账号、命令原文或 Provider Key。
- 项目 Playwright 在桌面和移动端验证真实登录态显示“研究环境已就绪”；模拟未登录态在提交前再次预检，Run POST 为 0，并显示固定登录链接和“重新检测”。
- 四张 UI smoke 截图保存在 `.artifacts/qa/xhs-login-preflight/`；本阶段没有创建或重跑真实研究 Run。

### Phase 14 errors encountered

| Error | Attempt | Resolution |
|---|---:|---|
| Codex 的既有 Chrome 控制会话已断开，重新选择系统 Chrome 仍返回不可用 | 3 | 按 Chrome 控制规范完成只读诊断；不降级到内置浏览器、Computer Use 或 shell 自动化。真实 Chrome 重载需要用户操作或明确允许新开受控窗口。 |
| 首版 `status()` 修复让 revoke 测试等待第二次清理而超时 | 1 | 将门禁修复限定为显式 `ui.status`，disconnect/revoke/pair 的结果状态不重复改权限；目标测试 10/10。 |
| 首次同时更新 findings/progress 的补丁因 progress 锚点少一个空格而整体未应用 | 1 | 读取两文件精确末尾后分上下文重试；未修改产品代码。 |
| Codex Chrome browser-client 的旧会话断开，等待重试后仍不可用 | 1 | 按 Chrome 规范运行只读诊断；Chrome、Codex 扩展和 native host 均正常。该通道与 ArchResearch 扩展独立，不用其他浏览器自动化绕过，继续通过产品枚举 API 与源码诊断。 |
| 定向 Ruff check 通过，但 format check 要求重排 `desktop.py` 与 `test_desktop.py`；并行执行未可靠汇总另外两项输出 | 1 | 仅对两个已改文件运行项目 Ruff format，然后分别重跑测试、Ruff 与 Mypy，不复用缺失输出。 |
| 独立 worktree 首次完整 verify 在新红测处为 571/572；复用的 editable venv 导入了原工作区旧 `desktop.py` | 1 | 明确设置 `PYTHONPATH=<worktree>/apps/api/src` 后完整重跑，确保测试与生产代码来自同一 worktree。 |
| 修正 PYTHONPATH 后 API 572/572、Ruff/Mypy 通过，但 pnpm 拒绝在无 TTY 下重建临时 junction `node_modules` | 1 | 不允许 pnpm 删除/重建临时依赖；把已隔离验证的两文件补丁应用到原工作区未修改文件，使用原工作区真实依赖完整重跑。 |
| 尝试移除 4 个本轮创建的临时依赖 junction 被安全策略拦截 | 1 | 未删除任何内容；不绕过策略，junction 仅位于临时 worktree、被 Git 忽略并可供后续补丁构建复用。 |

### Current result

- 根因已修复：安装版只把源码 Board 常量映射到动态本地端口，固定 XHS explore URL 不再被丢弃；默认 launcher 继续使用枚举的已知 URL 白名单。
- 红测在旧实现准确失败、修复后转绿；desktop/browser 定向 45/45，权威完整门禁 API 572/572、Board 184/184、Extension 182/182、packaged E2E 8/8 与全部静态/构建/Windows 合同通过。
- 真实 Chrome 启动验证：Board 标签 3→3，XHS 标签 2→3，唯一新增标签为 `https://www.xiaohongshu.com/explore`；没有再次新增 Board。
- 发布后真实 SQLite 仍为 96 条历史 Run、活动 Run=0；没有点击“查找灵感”或读取凭据。
- 当前阻塞：用户已安装的正式 v2.2.5 仍是旧二进制。制作、提交和发布新补丁安装器需要用户明确授权，本阶段尚未 version bump、build installer、commit、push、PR 或 release。
- 唯一下一步：等待用户确认是否继续准备并发布 v2.2.6；获授权后再更新版本合同、构建并真实安装验收。
| 新 `v2.2.5` Release/README 合同在旧生产版本上失败：CI 仍发布 `v2.2.4` 安装器 | 1 | 红灯符合预期；下一步同步 workflow、API、Board、Extension 与文档版本后转绿 |
| 权威 `verify.ps1` 在 API 572/572 后因 Ruff format check 停止：版本号修改使 `__init__.py`、`main.py` 需机械格式化 | 1 | 仅格式化这两个已修改文件，再完整重跑同一门禁 |
| 原工作区与新 worktree 的 19 文件逐字节哈希比较有 16 个不一致 | 1 | Git 在新 worktree 按配置写入 CRLF，原修改为 LF；改用 CRLF/LF 归一化后的文本比较，不重复字节哈希假设 |
| `session-catchup.py` 调用系统 `python.exe` 命中 Microsoft Store 占位符 | 1 | 改用 Codex 工作区捆绑 Python，catchup 成功 |
| 首次更新计划时上下文误写为 `## Errors encountered` | 1 | 读取文件尾部后改为追加独立 Phase 14 |
| 并行读取用 `Promise.all` 包含可返回 1 的 `rg`，导致输出被丢弃 | 1 | 改用 `Promise.allSettled`，后续检索均保留独立结果 |
| 读取不存在的 `HomeComponents.tsx` | 1 | 用 `rg --files` 确认真实文件名后再读取；同一并行调用的其他结果已保留 |

## Phase 15: Six-run stability qualification and v2.2.4 release

**Status:** complete

**Goal:** 用 3 条全新建筑问题和 3 条全新 XHS-only 图纸问题验证当前研究链路的跨题型稳定性；六条全部通过后，将现有未发布修改统一发布为 `v2.2.4` Windows 本地版。

1. **恢复与发布前提** `completed`
   - API/Board 健康，Provider 为 `openai/gpt-5.6-sol`，小红书会话为 `logged_in/local_search`，活动 Run 为 0；GitHub CLI 已认证。
2. **三条建筑稳定性验收** `completed`
   - 三条宽泛概念初期建筑题已顺序单活通过；每条均为 `completed/coverage_satisfied`，有真实 URL、逐字 EvidenceClaim，且 `search_query_planning`、`candidate_reranking`、`public_page_analysis`、`research_synthesis` 均由 Provider 成功完成、fallback=0。
3. **三条 XHS-only 图纸验收** `completed`
   - 顺序执行三条修改后才确定的全新图纸问题；每条必须 `completed/coverage_satisfied`、每方向 3 篇 usable、结果均为 XHS URL 且有本地文件、普通网页事件为 0、fallback=0。
4. **Board 与稳定性汇总** `completed`
   - 用项目 Playwright 打开六条结果，验证逐题/逐方向内容和图片实际显示；保存 QA 截图，不调用 Codex 内置浏览器。
5. **`v2.2.4` 发布验证** `completed`
   - 同步版本面，运行完整 Python/TypeScript/Extension 门禁，构建独立扩展 ZIP 和自包含 Windows 安装器，完成真实安装/启动/自检/健康/卸载 smoke，并记录大小与 SHA-256。
6. **GitHub 发布** `completed`
   - 明确审计并暂存跟踪修改，不暂存 `.artifacts/` 或真实研究数据；提交、推送、创建 PR、等待 Hosted CI、合并并创建正式 `v2.2.4` Release。

### Phase 15 errors encountered

| Error | Attempt | Resolution |
|---|---:|---|
| 并行审计把可能返回 1 的 `rg` 与 Run 详情放进同一聚合调用，导致首轮输出被丢弃 | 1 | 改用 `Promise.allSettled` 后完整取得路由和 Run 数据；没有修改研究数据 |
| 相关回归中 `gallery` 被误当成建筑类型，覆盖了工业厂房改文化中心 | 1 | 收窄为只识别明确的 `art gallery`；保留 `gallery` 作为空间/功能词 |
| 项目 Playwright 搜索结果输出包含 GBK 无法编码的特殊字符 | 1 | 改用 UTF-8 控制台输出后重放成功；浏览器结果未落盘 |

### Phase 15 strategy correction

- 常见建筑类型词表只能提升已知题型，不能作为正式稳定性方案；停止继续追加类型条目。
- 正式模型路径改用经 Pydantic 校验的结构化搜索锚点，把建筑类型、项目条件、当前机制、证据类型和可选项目名一直传递到本地站点搜索。
- 站点首查和宽化都必须保留全部锚点；任意未见建筑类型不得替换成 `public building`。确定性模板只在 Provider 查询规划失败时兜底，六条正式验收不允许使用。
- 通用结构化路径已用 `courthouse`、`crematorium`、`aquarium` 三种未登记类型和 `new-build`、`renovation`、`extension` 三种条件验证；workflow 会调用 `search_structured` 并记录 `structured_query=true`，无锚点旧 mock 仍走兼容入口。
- 站点宽化不再把 `new-build` 缩成 `new`，也不把 `renovation` 改写成 `adaptive reuse`；宽化只移除模型查询中的非锚点冗余，五类锚点原样保留。
- 相关四文件 263/263、Ruff、55 文件格式检查、strict Mypy 26 个源文件和 `git diff --check` 全绿。正式稳定性验收仍为 0/6；下一步重启并用未参与单元测试的新建筑类型执行单活 Run。
- 新类型 Run `792ab5f7-a923-4918-badc-da6ca150df14` 的 15/15 结构化搜索成功但最终 0/3；查询准确，Designboom 偏题候选被正确拒绝，ArchDaily 已读页正文不能支持题目机制，不能降低证据门槛。
- 通用补查反馈现区分本地无候选、排除后无新候选、模型全拒和正文分析不完整；模型只在候选不足时生成语义等价类型名称，禁止泛化类型。相关四文件 265/265 和静态门禁全绿；正式验收仍为 0/6。
- 游泳馆 A/B Run 首次模型计划实际包含全部锚点，但机制 anchor 与 query 的连接词位置不同，被旧连续子串校验误拒；Run 已取消且不计验收。混合词项/中文子串校验红测、真实隔离规划、相关四文件 266/266 和静态门禁均通过。
- 铁路客运站 Run `4670f769-c795-41c4-bdc2-c201fd8c4516` 为 `partial/budget_exhausted`、1/3；13 次模型规划和筛选、12 次正文分析及综合全部成功且 fallback=0。真实正文复核确认未覆盖页面确实缺少城市空间连续连接或四类流线分离的逐字证据，不能降低 EvidenceClaim 门槛。
- 通用补查不再尝试当前环境中不可用的 Bing/Google 等通用搜索引擎；正式链路继续轮换可靠建筑站点。对“项目相关但当前页面正文不足”的具体可信项目，按项目名逐站点补查最多两个其他来源，并把所有逐字事实绑定回各自实际读取 URL。
- 主搜索与跨来源补证共享 Run 的总查询额度；补证不会绕过 `max_queries + completion_recovery_rounds × 子问题数`。正文分析焦点保持项目条件中性，确定性未知类型不得默认 `public building` 或 `adaptive reuse`，Trace 记录直接匹配、支持事实数与逐字证据链状态。
- 任意建筑类型正式路径只依赖 Pydantic 结构化锚点，不依赖学校、体育馆、车站等词表。完整 API 500/500 与首轮静态门禁已通过；正式稳定性验收仍为 0/6。
- 新建城市消防站 Run `4a6f582b-67c3-49b1-abb9-362fbe316254` 为 `blocked/research_synthesis_incomplete`、0/3，不计验收。15 次本地搜索正好达到共享总额度，其中 4 次为同项目补证；11 次模型规划有 3 次因 query/anchor 偶发不自洽进入 fallback，跨站搜索结果又因标题顺序不同未进入正文读取。
- 通用修复保持严格 Pydantic 合同，对无效模型查询计划最多纠正重试一次；同项目标题允许完整短语或保守长标题词项匹配，短名称近邻不会合并。相关五文件 310/310、strict Mypy、Ruff 和 `git diff --check` 全绿。
- 市政档案馆 Run `17bd42b6-7793-45ea-b8af-973b7a855abb` 为 `blocked/research_synthesis_incomplete`、0/3，不计验收且不 retry。13/13 次模型查询规划成功且 fallback=0，15 次本地搜索和 13 次模型候选筛选只保留 1 个候选；唯一读取页的 3 次正文分析均 `direct_match=false`。
- 项目 Playwright 诊断证明这个失败是“稀有建筑类型在当前站点集合的召回不足”，不是 EvidenceClaim 或候选门槛过严。档案馆只作为失败样本，不往生产代码增加 `records center`、`Stadtarchiv` 等类型专用词表。
- 全局策略门槛调整为：正式主路径不按建筑类型分支；模型以结构化策略轮换精确类型词、命名案例、机制与证据角度；站点调度根据无候选、全拒绝和正文不足的实际产出轮换；任一修复必须同时通过未见类型参数化红测、全回归和修改后才生成的盲测题。
- 当前活动 Run 为 0；正式稳定性验收仍为 0/6。当前唯一下一步：先写“无类型词表的模型查询策略轮换 + 按候选产出自适应站点调度”通用红测，再做最小生产修复；红测和全回归收口前不创建新 Run。
- 通用红测和最小实现已完成：`SearchQuery` 由 Pydantic 枚举四类搜索策略；恢复轮在总额度允许时最多生成两条不同策略；低产出站点在其他支持站点尝试前不重复；结构化站内类型判断直接使用模型 building-type 锚点，不再调用三类硬编码判断。
- 完整 API 509/509、Ruff 全范围、64 文件 format check、strict Mypy 26 个源文件与 `git diff --check` 全绿；新增生产差异扫描未出现任何验收题或盲测题建筑类型名。
- 真实 SearchQueryPlan 隔离调用成功后，修改后才选定的新建城市渡轮客运码头 Run `34626a55-dbdb-46c6-920d-dc394ecb2651` 自然终止为 `partial/time_budget_exhausted`：1/3、5 个可用资产、1 个正式项目、1 个多图纸项目，fallback=0，不计验收且不 retry。
- 15 次本地搜索中 8 次为跨来源补证；多个页面的正文分析已明确 `direct_match=false`，workflow 仍为这些无关火车站/机场项目补证，耗尽共享预算。模型拆题还把用户声明的建筑类型扩大为相邻的交通或滨水公共建筑。
- 当前活动 Run 为 0，正式验收仍为 0/6。当前唯一下一步：先写通用红测约束正文直匹配补证门控与拆题类型边界，再做最小实现和全回归；收口前不创建新 Run。
- 通用红测与最小实现已完成：正文分析通过内部 outcome 把 `direct_match/evidence_chain_status` 传回调度层；无关、分析失败或证据已完整的项目不再补证，直接匹配但证据不完整的项目仍可在原预算内补证。建筑拆题提示明确要求每个子问题原样保留用户声明类型与项目条件。
- 三项目标测试和精准搜索相关五文件全集通过；Ruff、55 文件格式检查、strict Mypy 26 个源文件和 `git diff --check` 全绿。当前唯一下一步：运行完整 API 回归；通过后重启源码服务并做真实规划隔离验证，仍不创建 Run。
- 完整 API 511/511 通过。当前唯一下一步：确认活动 Run 为 0，重启源码 API 加载通用门控，并用真实 Provider 做一个未见类型的拆题与 SearchQueryPlan 隔离验证；不创建研究 Run。
- 服务重启后 API/Board 健康、活动 Run 为 0。真实 `gpt-5.6-sol / responses` 隔离验证使用未预设的“新建高山植物种质资源保存库”：3 个子问题全部保留用户类型和新建条件，2 条查询策略为 `exact_typology + professional_equivalent`，anchors 完整且未请求原生 `web_search`。
- 当前唯一下一步：选择修改后才决定的另一条全新建筑题，创建唯一单活 quick Run；终态前只轮询，不创建并发 Run。
- 已创建唯一活动盲测 Run `0452cfd2-8142-4e09-b483-8e86bddf573a`：新建湿地生态研究中心，`quick/precedent_research/research_sources=[]`。当前唯一下一步：只轮询该 Run 到终态并完整审计，不创建并发 Run。
- 该 Run 已自然终止为 `partial/time_budget_exhausted`：1/3、4 个资产、1 个页面，不 retry、不计验收。新补证门控真实生效，15 次本地搜索中补证为 0；但查询 fallback 丢失原题范围、恢复策略未跨轮升级、确定性正文 fallback 误升无关泛化原句、建筑计划题外引入 XHS。
- 当前活动 Run 为 0、正式验收 0/6。当前唯一下一步：写四类通用红测并修复上述合同，完成相关与全局回归前不创建新 Run。
- 四类通用红测与最小实现已完成并转绿：恢复策略升级、未知中文类型 fallback 范围保留、确定性正文机制支持门槛、建筑规划来源隔离。当前唯一下一步：运行相关全集和静态门禁；收口前不创建新 Run。
- 精准搜索相关五文件全集全绿；旧“Provider 失败仍靠不相关 fallback 完成”的测试已按严格证据合同改为 partial，已知类型英文 fallback 仍保持简洁。当前唯一下一步：运行静态门禁和完整 API；收口前不创建新 Run。
- Ruff、55 文件格式检查、strict Mypy 26 个源文件和 `git diff --check` 全绿。当前唯一下一步：运行完整 API；通过后重启并真实隔离重放失败轮次合同，不创建 Run。
- 完整 API 514/514 通过。当前唯一下一步：确认活动 Run 为 0，重启源码服务，并用失败题上下文纯内存重放建筑拆题与第 3 轮候选短缺规划；不创建 Run。
- 真实纯内存重放确认拆题范围与来源隔离成功，但第 3 轮 `exact_typology + evidence_angle` 被早期 shortage 规则错误拒绝，纠正后仍为 `ValueError`；未创建 Run。当前唯一下一步：按轮次拆分候选短缺策略约束并回归，再做同一纯内存重放。
- 分阶段 shortage 红测与实现已转绿，相关全集和静态门禁全绿。当前唯一下一步：重启服务并做同一真实纯内存重放；不创建 Run。
- 同一真实重放已成功：拆题范围与来源隔离正确，第 3 轮 `exact_typology + evidence_angle`、anchors 完整、无 fallback。当前唯一下一步：补跑完整 API；通过后创建修改后才决定的下一条单活建筑盲测。
- 最终完整 API 514/514 通过；已创建唯一活动盲测 Run `5f740202-37ff-4f20-88f6-fe459223803a`：新建儿童科学馆，`quick/precedent_research/research_sources=[]`。当前唯一下一步：只轮询到终态并审计，不创建并发 Run。
- 该 Run 已终止为 `blocked/research_synthesis_incomplete`、0/3，不计验收。全部模型阶段 fallback=0，补证=0；晚期恢复只用了 `exact_typology + evidence_angle`，没有命名先例，3 个上位类型页面均被正确判为 `direct_match=false`。
- 当前活动 Run 为 0、正式验收 0/6。当前唯一下一步：写两槽位晚期恢复必须同时使用 `named_precedent + evidence_angle` 的通用红测并修复；不创建新 Run。
- 两槽晚期恢复红测与实现已转绿，相关全集和静态门禁全绿。当前唯一下一步：重启服务并做真实两槽位查询规划；不创建 Run。
- 真实两槽位规划已成功返回 `named_precedent + evidence_angle` 且 anchors 完整。当前唯一下一步：创建修改后才决定的新建自然历史博物馆单活 Run，终态前不创建其他 Run。
- 已创建唯一活动盲测 Run `383b7203-f330-4afc-8784-9f1bfe59f0f6`：新建自然历史博物馆，`quick/precedent_research/research_sources=[]`。当前唯一下一步：只轮询和审计该 Run。
- 自然历史博物馆 Run 自然终止为 `partial/no_new_assets`、2/3、fallback=0，不计验收。高级策略真实执行，但第 5 轮重复第 3 轮已判无关的命名项目；正式结构化路径还残留按项目后缀猜身份的旧解析。
- 通用红测和最小实现已转绿：已尝试项目进入后续规划硬排除；重复命名先例在搜索前有界纠正；结构化 `project_name` 直接约束候选，旧正则只留给无锚点兼容路径。当前唯一下一步：运行精准搜索相关全集和静态门禁；收口前不创建新 Run。
- 相关 324 项、完整 API 516 项及全部静态门禁通过；真实排除项目规划返回不同命名先例和完整锚点。已创建唯一公共市场大厅盲测 Run `8308a18e-1898-4e4b-a352-4014dd612d4d`，当前唯一下一步：只轮询和审计该 Run。
- 公共市场 Run 因第 2 轮查询规划 fallback 提前取消；审计发现建筑拆题仍可能夹带题外 XHS/登录态。通用来源隔离和查询语义纠正红测已转绿，真实同题纯内存重放无 XHS、无规划错误、无排除项目别名重复。当前唯一下一步：运行相关全集和静态门禁；收口前不创建新 Run。
- 相关 325 项、完整 API 517 项和静态门禁全绿；已创建唯一新建城市音乐厅盲测 Run `6cac2ab8-0532-407a-9981-9e99c8f25b69`。当前唯一下一步：只轮询和审计该 Run。
- 音乐厅 Run 已终止为 `partial/time_budget_exhausted`：1/3、5 个资产、1 个正式项目，不计验收。正式 Trace 含 reranker `APIConnectionError` fallback 和正文 `APITimeoutError` fallback。
- 同一 attempt 在服务恢复后重复执行前两个已完成分支。根因是 resume key 错把可变 `language` 作为身份：初始 deterministic 查询为 `zh`，普通 Responses 查询规划成功后 QueryAttempt 被更新为 `en`，恢复时无法命中 completed key。
- reranker 暂时失败时 deterministic fallback 放行 4/4 候选，随后 1 个 `Exception`、3 个 `AttributeError` 全部解析失败，进一步浪费页面和时间预算。
- 用户同意在修复上述浪费后有限提高建筑 quick 预算；EvidenceClaim、正文相关性、完成门槛和 XHS 固定限制保持不变。当前活动 Run 为 0、正式验收 0/6。当前唯一下一步：先写不可变恢复键和严格候选降级红测，不创建 Run。
- 不可变恢复键红测先复现 `program=2`，修复后同 attempt/跨 attempt/零覆盖 retry 相关 6 项全绿；QueryAttempt language 继续用于展示，不再参与执行身份。
- 结构化 reranker fallback 红测以未登记 `planetarium` 复现泛化页面放行；修复后正式模型路径只保留命中 building-type anchor 且确定性相关的前 2 页，旧 mock/provider 兼容不变。相关目标组 5/5 通过。
- 用户授权三档增配后，quick / balanced / deep 新预算的有效公开搜索上限为 18 / 28 / 48，基础页面为 16 / 40 / 72，时限为 40 / 60 / 90 分钟，每子问题恢复页为 3。XHS 固定帖子、usable、视觉调用和字节上限不变。
- 完整 workflow 44/44 与 schema 24/24 通过。当前唯一下一步：运行精准搜索相关全集、完整 API 和静态门禁；通过前不创建 Run。
- 精准搜索相关六文件 351/351、完整 API 519/519、Ruff lint/63 文件格式、strict Mypy 26 文件和 diff check 全绿；服务重启后 Responses structured-output probe 成功。
- 修改后才选定的新建大学学生中心题在生产/测试扫描为 0 命中；唯一 Run `4bcbd249-8701-48a6-b0d4-69beb2f83c58` 已创建并实际取得新 quick budget。当前唯一下一步：只轮询和审计，不并发或 retry。
- 建筑学院 Run `15c4d0d2-5643-43af-98d0-7566488682b0` 自然终止为 `partial/time_budget_exhausted`，但实际为 18 次公开搜索额度耗尽：3/3 正文覆盖、1 个正式项目、综合成功、fallback=0，不计验收且不 retry。
- 用户要求避免把候选类型卡得过死；新的通用红测要求在总数 4 以内、同类型不足时最多保留 2 个可信强机制类比，部分命中一个当前机制即可进入正文分析，弱机制和仅视觉相似仍拒绝。
- 目标红测已转绿；查询额度耗尽现记录 `query_budget_exhausted`，不再误报真实时间耗尽。当前唯一下一步：运行相关全集、完整 API 和静态门禁；收口前不创建新 Run。
- 相关六文件全集、完整 API 和全部静态门禁通过；真实普通 Responses reranker 返回 1 个直接候选、2 个强机制类比和 1 个明确拒绝的弱候选，证明新边界在真实模型生效。当前唯一下一步：扫描并创建修改后才决定的全新建筑类型单活 Run。
- 新建大学工程创新中心题型扫描为 0 命中；唯一单活 Run `f64e3b16-740a-4948-9da1-064acce13ae4` 已创建，拆题与首条模型查询规划成功。当前唯一下一步：只轮询和审计，终态前不创建其他 Run。
- 工程创新中心 Run 在 0/3、fallback=0 时取消并保留；QueryAttempt 证明恢复查询仍机械重述完整子问题，类比准入没有足够召回入口，不计验收且不 retry。
- 过载机制红测先失败后转绿：`spatial_mechanism` 只允许一个机制切片，英文 12 词/中文 32 字上限；两条查询分别选择不同切片，其他结构化锚点保持。当前唯一下一步：相关全集、完整 API、静态门禁和真实规划隔离重放；收口前不创建 Run。
- Provider 全集、完整 API 和静态门禁全绿；真实 Responses 对三个工程中心子问题均生成两条 6-9 词的独立机制查询，范围与 anchors 完整、fallback=0。当前唯一下一步：扫描并创建另一种全新建筑类型单活 Run。
- 新建大学医学教育中心题型扫描为 0 命中；唯一 Run `363c9289-eae9-4767-be79-1da6d0918d94` 已创建，拆题与首条短查询成功，2 个同类型候选正在正文读取。当前唯一下一步：只轮询审计。
- 医学教育中心 Run 已自然终止为 `blocked/research_synthesis_incomplete`：0/3、6 个 partial 图纸资产、0 个正式项目，正式模型阶段 fallback=0；保留、不 retry、不计验收。两个同类型医学教育页面的正文分析均没有形成支持当前机制的逐字事实。
- 用户再次明确案例不必与题型严丝合缝，正式研究应优先提取可迁移机制和参考方法。当前唯一下一步：联合审计该 Run 的查询、候选和正文输入，先写任意建筑类型红测约束“一个有逐字正文支持的可迁移机制足以形成受限分析”，但不放宽 URL、EvidenceClaim、适用边界或运行级完成门槛；回归收口前不创建新 Run。
- 联合审计确认 11 条查询始终锁定目标建筑类型，所有 reranker 的 `analogical_retained_count=0`；适度类比只存在于筛选层，尚无恢复查询负责召回强机制跨类型候选。当前唯一下一步：先写“同类型恢复不足后有界启用机制类比搜索、主路径仍保持精确且总预算不增加”的任意类型红测，再做最小实现；不降低正文或 EvidenceClaim 门槛。
- 机制类比恢复的目标合同：早期/默认查询不变；晚期两个槽位最多一个 `mechanism_analogy`，另一个保留同类型证据搜索；模型选择可比较来源类型且禁止泛化公共建筑，结构化本地搜索按该类型召回，后续候选、正文、EvidenceClaim 和总预算门禁不变。下一步先补红测。
- 红测已先失败并转绿：Pydantic 增加 `mechanism_analogy` 与 `target_building_type`；早期类比会纠正，第 4 轮后两个槽位严格为一个机制类比加一个目标类型证据查询；具体来源类型不得与目标相同或泛化为公共建筑。本地搜索集成测试确认只执行来源类型查询。Provider 64/64 通过。
- 当前唯一下一步：运行浏览 workflow、workflow/schema 相关全集和静态门禁；收口前不创建新 Run。
- Provider 64/64、浏览 workflow 133/133、workflow/schema 68/68、完整 API 526/526 全绿；Ruff、55 文件格式、strict Mypy 26 个源文件和 diff check 通过。
- 当前唯一下一步：确认无活动 Run，重启源码服务并真实隔离验证第 4 轮机制类比计划；不创建研究 Run。
- 真实第 4 轮规划结构成功且无 web_search，但模型选择的航天器装配测试设施在 4 个现有建筑站点没有可用召回，只有无关页面。当前唯一下一步：红测约束类比来源类型的建筑媒体可发现性，再做最小提示修复和真实重放；不降低 reranker。

### Phase 15 concept-stage research correction

- 用户纠正产品方向：ArchResearch 服务于建筑概念初期灵感，默认输入应是宽泛设计任务，不应先指定中庭、环形流线、设备带、可变隔断等答案再让搜索证明。
- 默认拆题改为开放研究维度；模型应从真实候选正文和图纸中发现空间机制，再说明可借鉴做法、适用条件和失效边界。
- 搜索优先级改为“空间对象与关系 > 使用体验与环境问题 > 建筑类型背景”。建筑类型用于保留尺度、项目条件和语境，但不得把每条查询锁死在同类型；展厅、教育空间、中庭等空间问题可以从其他可信建筑类型中寻找可迁移案例。
- 只有用户明确要求同类型案例，或题目本身依赖强类型规范时，才提高建筑类型匹配权重；URL、逐字正文、EvidenceClaim、候选白名单和总预算门槛不变。
- 后续正式 3+3 验收题全部使用概念初期宽问题，不再使用预埋具体形式、构件、材料、结构体系或流线答案的问题。
- 当前唯一下一步：运行已写入的概念初期红测，补充空间优先/类型软约束红测；最小修改通用 fallback、Provider 拆题和查询规划合同，完成全回归前不创建新 Run。

#### Conflict audit and revised implementation

- **保留**：普通 Responses 结构化输出、本地 Playwright 搜索与读取、候选 ID 白名单、URL/项目/无关页排除集合、既有预算、XHS-only 隔离、正文逐字 EvidenceClaim、适用边界和综合 Trace。
- **替换**：旧 fallback 的新旧分区/消防分流/核心筒/空间高潮/结构穿越预设；每条查询必须包含建筑类型的合同；以 `exact_typology` 为主、到晚期才准入 `mechanism_analogy` 的类型中心恢复顺序。
- **改写**：结构化站内查询当前按“项目名 -> 条件 -> 类型 -> 空间机制 -> 证据”拼接，导致召回被类型锁死；候选降级仍按类型硬过滤；reranker 虽支持跨类型机制，但只作为最多两个晚期例外，和空间优先目标冲突。
- **两路检索合同**：每个子问题在既有每轮最多两条预算内使用“空间优先路 + 项目语境路”。空间优先路以空间对象、空间关系、使用体验或环境议题和证据类型为主要查询，不强制目标类型进入搜索；项目语境路保留目标类型与新建/改造/扩建条件，补充同类案例和适用性校验。
- **候选准入合同**：空间相关性、可迁移性、图纸/正文可用性和来源可信度优先；类型匹配是加分项和适用性信息，不是默认硬门槛。同类型摘要不足的可信项目页仍可读取，跨类型页面也必须明确命中当前空间议题才可读取。
- **证据合同不变**：跨类型候选进入正文读取不等于正式结论；只有本地读取正文支持设计操作与空间结果、程序绑定真实 URL 和逐字引文、分析写明适用条件与差异时才能进入结果。
- **开发顺序**：先补概念初期、显式空间关系跨类型搜索、旧工业改造条件保留、预算和 XHS 隔离红测；再重构 Pydantic 查询语义、Provider prompt、本地结构化搜索和 reranker；目标/相关/完整回归与静态门禁通过后才做真实内存验证和新 Run。
- **首轮实现完成**：`space_first` 与 `project_context` 双路查询、空间优先 reranker、本地搜索 scope 和 Trace 已通过 10 个核心合同；正式可执行策略不再包含 `exact_typology`、`professional_equivalent` 或 `mechanism_analogy`。
- **确定性 fallback 收口**：显式空间、活动、流线、环境和建造词按通用词汇映射保留；没有明确机制时只补空间关系、使用体验、环境回应等中性维度。旧的动静分区、连续环流、工作坊、柱网/桁架自动扩写已删除。
- **当前验证**：精准搜索相关组合 366/366、完整 API 534/534、Provider 67/67、Ruff、64 文件格式、strict Mypy 26 个源文件与 diff check 通过。当前活动 Run 为 0、正式验收 0/6。
- **真实 Provider 内存验证**：普通 Responses 在 57 秒内完成开放拆题、`space_first + project_context` 查询和候选筛选；保留强空间相关的跨类型/同类型候选并拒绝无关候选，fallback=0，无原生 `web_search`。
- **真实盲测发现与修复**：青年交流与文化中心 Run 在规划阶段出现题外展览、工作坊、后勤、中庭和采光前提，已立即取消。新增通用计划输出门控和一次有界纠正；相关 367、完整 API 535 与静态门禁通过，真实同题重放已开放化。
- **后续真实 Run 审计**：专用空白 workspace 中的公共艺术与社区学习中心 Run `abc168c5-2b31-49c5-a6d5-206b93bf8aea` 拆题开放，但首轮 `user_experience` 查询规划出现 `ValidationError / deterministic_template`；已取消并保留，不 retry、不计验收。其余轮次的双路查询、跨类型候选和一条完整正文证据链成功，说明失败集中在查询语义与校验合同。
- **残留冲突**：`spatial_mechanism` 和 `mechanism_transferability` 仍在正文读取前要求模型先猜设计机制；`building_type` 仍是每条查询必填；英文空间优先查询错误要求仅作结构化语境的中文类型/条件也为 ASCII；deterministic reranker 的空间优先分支仍回落到类型过滤。
- **第二轮通用合同**：查询锚点改为中性的空间研究焦点，具体 `design_mechanism` 只由正文分析产生；建筑类型只在用户明确给出时保留，否则为空；候选按空间相关性、完整项目页/图纸潜力和来源可信度优先，类型只作加分；第二次结构化纠正接收有界校验反馈，一槽首轮明确只返回 `space_first`。
- **保持不变**：普通 Responses、本地 Playwright、候选 ID 白名单、URL/项目/无关页排除、预算、XHS-only、正文逐字 EvidenceClaim、适用边界、Trace 和运行级完成门槛。
- **当前唯一下一步**：先写上述通用红测并取得准确红灯，再做最小生产修改；相关与完整回归收口前不创建真实 Run。
- **第二轮通用修复完成**：五个新增红测先 5/5 准确失败，分别覆盖可选类型语境、中文 context-only anchors、具体校验反馈、空间相关性候选准入和 deterministic fallback 类型回退；生产修改后全部转绿。
- **结构语义**：查询前字段统一为 `spatial_focus`，只描述要研究的空间对象、关系、使用或环境议题；正文后的 `design_mechanism`、逐字事实和转译步骤保持不变。`building_type` 可为空，英文 `space_first` 只校验 query-visible anchors 的 ASCII 与逐词包含。
- **候选语义**：模型输出 `spatial_relevance`，正式准入全局要求可信来源，类型仅作补充；空间优先 deterministic fallback 在已有文本相关性后不再调用旧 typology gate。
- **当前验证**：Provider/公共页面/浏览 workflow 286/286，规划/Provider/公共页面/浏览 workflow/workflow/schema 372/372，完整 API 540/540；Ruff、63 文件 format check、strict Mypy 26 个源文件和 `git diff --check` 全绿。
- **当前唯一下一步**：重启源码服务加载新 Pydantic schema，确认活动 Run=0；用真实普通 Responses 纯内存验证“无建筑类型空间题 + 中文项目语境英文查询 + 候选空间优先”，不创建 Run。
- **真实空间优先验收结果**：普通 Responses 内存验证通过后，唯一概念初期 Run `2a45daa0-52e9-4d35-860f-17a023292a83` 达到 3/3 正文覆盖、3 个正式项目、18 个可用资产和完整综合，四个 Provider 阶段成功且 fallback=0；终态仍为 `partial/budget_exhausted`，仅剩 `insufficient_multi_asset_projects`，不计验收且不 retry。
- **覆盖聚合红测与修复**：同一正文已验证来源页的 `verified/partial` 图纸可共同证明项目图纸丰富度；仅项目名相同但来源页不同的图纸不得混算。红测先得到 0 而失败，最小修复后转绿；真实数据库只读重算得到 `multi_asset_projects=1`、`enrichment_gaps=[]`，未降低正文、URL、EvidenceClaim、来源或子问题覆盖门槛。
- **当前唯一下一步**：运行 workflow/verification 相关全集、完整 API 和静态门禁；全部通过后重启源码服务并创建下一条全新概念初期建筑题做唯一单活验收。
- **门禁与运行时收口**：workflow/verification 47/47、精准搜索相关联合 376/376、完整 API、Ruff、55 文件格式、strict Mypy 26 个源文件和 diff check 全绿。项目脚本重启后 API `openai/gpt-5.6-sol` 与 Board 200，活动 Run 为 0。
- **当前唯一下一步**：扫描修改后才决定的宽泛概念初期建筑题；确认 production/tests 无命中后创建唯一单活 quick Run，并只轮询审计。
- **第二条概念初期 Run**：`22fb1bee-201b-4753-85c2-2ce75ffa48bd` 为 `partial/query_budget_exhausted`，3/3、11 个资产、2 个正式项目、完整综合、fallback=0，不 retry、不计验收。空间优先跨类型召回和严格正文拒绝均正常，失败只剩旧 quick 的 3 项目/多图纸硬丰富度。
- **quick 深度重新校准**：概念初期 quick 改为 2 个正式项目、0 个强制多图纸项目；每题 2 资产、总计 6 资产、4 个 verified/partial、正文、URL、EvidenceClaim、3/3 和综合不变。balanced/deep 原目标不变。
- **红测与能力边界**：schema 红测先失败后转绿；retry 与多图纸恢复测试在夹具内显式启用强丰富度，确认通用恢复能力仍保留。目标三项 3/3 通过。
- **当前唯一下一步**：运行相关全集、完整 API 和静态门禁；通过后重启并创建下一条全新概念初期建筑题单活验收。
- **校准回归收口**：相关 206/206、完整 API、Ruff、55 文件格式、strict Mypy 26 个源文件和 diff check 全绿；源码 API/Board 重启健康，活动 Run 为 0。
- **当前唯一下一步**：扫描并创建“新建城市街角阅读与邻里活动场所”的唯一单活 quick Run，终态前不创建或 retry 其他 Run。
- **建筑验收 1/3**：Run `cc7eee8a-bc70-4f9c-867a-d975567a1c4b` 为 `completed/coverage_satisfied`，3/3、10 个资产、2 项目、18 条逐字 EvidenceClaim；四个 Provider 阶段成功，本地搜索/读取成功，无原生 `web_search`，fallback=0。
- **建筑验收 2/3 失败样本**：Run `e665999e-a7a9-4d79-b4e9-c69fbf5ada85` 自然终止为 `blocked/research_synthesis_incomplete`，0/3、0 usable assets、0 正式项目，Provider fallback=0；保留、不 retry、不计验收。
- **初步信号**：一个共享工作室正文读取超时，两个候选正文为 `direct_match=false`，后续多轮本地搜索返回 0 候选。当前活动 Run 为 0，正式验收仍为建筑 1/3、总计 1/6。
- **当前唯一下一步**：完整审计该 Run 的 QueryAttempt、站点轮换、候选批次与正文输入，先定位跨题型的改造语境召回缺口并写红测；全回归收口前不创建或 retry 新 Run。
- **审计结论**：真实站点存在可发现候选；失败主因是项目语境锚点复制过多 brief 内容、实际站内拼接仍把条件/类型排在空间焦点前，以及已选页面一次读取超时后被永久排除。只翻译查询或单纯加预算不能解决。
- **拟定通用合同**：空间焦点先行；building type/project condition 为简洁软语境；查询语言匹配当前站点；执行词数有界；已选页面瞬时读取最多重试一次。候选白名单、低相关排除、总搜索/页面预算、正文逐字证据和 XHS-only 均不变。
- **首轮最小实现**：项目条件简洁度、站点语言一致、空间焦点优先词序、正文超时单次重读、reranker 拒绝后排除和已选未读候选延后排除共 6 个红测已转绿；搜索、页面和 Provider 预算未增加。
- **恢复语义残留**：同一进程内未读候选可留到后续轮次，但 `_persist_sources()` 会在实际读取前写入 `SourcePage`；服务重启时当前初始化仍把全部 `SourcePage.url` 视为已访问，可能永久排除已持久化但未读的候选。旧 structured-site 测试还保留条件/类型优先词序断言，与空间优先合同冲突。
- **当前唯一下一步**：先写服务重启/继续执行时未读候选仍可恢复的红测并取得准确红灯；最小修复持久化候选状态，同时保证已访问、重复项目和已判无关页面继续排除。随后更新旧词序断言并运行相关全集、完整 API 和静态门禁；收口前不创建真实 Run。
- **恢复状态修复完成**：新增行为红测先准确失败，证明 `pending` SourcePage 在恢复时被误排除；最小实现后 `pending` 可重读、实际读取后转为 `available`、reranker 拒绝项持久化为 `irrelevant`。读取失败不再缓存为本轮永久失败，后续重试仍受既有页面预算限制。
- **相关回归**：规划 18、Provider 75、公共页面 82、浏览 workflow 137、核心 workflow 45、schema 24、XHS/浏览协议 46，共 427 项全绿。旧测试已同步为 40 秒最坏正文读取窗口和空间焦点优先词序，生产逻辑未回退。
- **当前唯一下一步**：运行完整 API、Ruff lint/format check、strict Mypy 和 `git diff --check`；全绿后更新 HANDOFF、重启源码服务并做真实普通 Responses + 本地搜索纯内存验证，仍不创建 Run。
- **完整收口**：完整 API 549/549、Ruff lint、55 文件 format check、strict Mypy 26 个源文件和 diff check 全绿；源码 API/Board 已重启，活动 Run=0。
- **真实内存验证**：Credential Manager 的 `gpt-5.6-sol / responses` 返回 `space_first + project_context`；本地 ArchDaily 4 候选，模型保留白名单内 2 个跨类型空间案例，原生 web_search=0，未创建 Run、未输出或保存 Key。
- **当前唯一下一步**：扫描一条修改后才确定且 production/tests 未出现的宽泛概念初期建筑题；确认无命中后创建唯一单活 quick Run 并只轮询审计。建筑正式验收当前 1/3，总计 1/6。
- **建筑验收 2/3**：Run `60993e17-a7fc-4af9-9f80-1eda31d1ccca` 为 `completed/coverage_satisfied`，3/3、7 资产、2 项目、25 条有效 EvidenceClaim；四类 Provider 阶段成功、本地搜索/读取真实执行、fallback=0、原生 web_search=0。
- **当前唯一下一步**：扫描另一条修改后才确定、production/tests 未出现的宽泛概念初期建筑题；创建第三条唯一单活 quick Run 并审计到终态。当前建筑 2/3、总计 2/6。

### Phase 15 recovery command errors

| Error | Attempt | Resolution |
|---|---:|---|
| 分段读取和健康检查中的 PowerShell 变量被外层 shell 提前展开 | 1 | 改用单引号包裹 `pwsh -Command` 脚本后成功；未修改项目或研究数据 |

### Phase 15 concept-stage audit follow-up

- 第三条建筑候选 Run `f429ca55-5377-4dc5-a8fb-87b99d8bccd5` 自然终止为 `partial/query_budget_exhausted`：3/3、13 资产、1 正式项目、完整综合、fallback=0；保留、不 retry、不计验收。
- 代码冲突审查确认五个通用修复面：默认开放 fallback 拆题；空间焦点与类型语境分层；删除正文前模板机制；空间相关候选优先并限制 type-only 探查；降级相关性使用当前空间焦点。
- URL、逐字 EvidenceClaim、本地浏览器、候选 ID 白名单、排除集合、预算、XHS-only 和完成门槛保持不变。
- 五类行为红测和最小生产实现已完成；默认开放 fallback、空间前景化拆题、无模板机制注入、空间候选优先及空间焦点降级评分均已转绿。
- 相关八文件首轮剩余 18 个旧夹具失败，已对齐开放维度和显式问题证据，18 项定向复检通过；未修改生产证据或完成门槛。
- 当前唯一下一步：重跑相关八文件全集；通过后运行完整 API、Ruff、format、strict Mypy 和 `git diff --check`，再做真实普通 Responses 内存验证。回归收口前不创建真实 Run。
- 相关八文件全集与完整 API 552/552 已通过；Ruff lint/format、strict Mypy 和 diff check 全绿。
- 当前唯一下一步：重启源码服务并完成真实普通 Responses 纯内存验证；确认无 fallback、无原生 web_search、候选 ID 白名单和空间优先策略后，再创建第三条全新建筑验收 Run。
- 真实拆题、双路查询和候选筛选内存探针已通过。建筑候选 Run `202d658e-25a3-4158-b26b-bf2c3c187308` 为 2/3 partial，不 retry、不计验收；真实缺口是正文结构化纠正偶发不自洽。
- 精确证据缺项反馈已完成红测、最小实现、相关全集、完整 API 553/553 和静态门禁；证据与调用预算不变。
- 当前唯一下一步：重启源码服务并做普通 Responses 健康探针；成功后扫描并创建另一条修改后才决定的宽泛概念题作为唯一单活建筑验收 Run。
- **最新候选 Run**：`9b7ed8dc-daef-41d1-b86d-0c0035725a1b` 自然终止为 `partial/no_new_assets`，2/3、3 个资产、1 个正式项目，Provider 查询规划、候选筛选和正文分析 fallback=0；保留、不 retry、不计验收。当前活动 Run=0，建筑正式验收仍为 2/3，总计 2/6。
- **最新通用根因**：空间优先路能召回并形成证据，项目语境路却把多功能 brief 复制为长而生造的 building-type anchor，例如 `children's care and family community venue`，导致建筑媒体站内搜索无法命中常见专业类别。此前候选 Run 的 `urban community shared learning and daily service facility` 是同一类跨题型失败。
- **修复边界**：不添加题型词表，不把类型重新塞回 `space_first`，不降低正文、URL、EvidenceClaim 或完成门槛。只用通用 Pydantic 简洁度/结构约束和 Provider 提示，让 `project_context` 使用短、常见、可索引的专业建筑类别；未知类型不能默认改造或泛化为 `public building`。
- **当前唯一下一步**：写上述 building-type anchor 红测并取得准确红灯；最小修改后运行目标、相关全集、完整 API 和静态门禁，再做真实内存探针。回归收口前不创建 Run。
- **红测与最小实现完成**：英文/中文 multi-program brief 在旧实现中均未触发校验，Provider 也直接接受长类别；新增策略级 Pydantic 合同后，可执行 context 查询只接受英文最多 5 个有效词、中文最多 10 个汉字的单一类别，`space_first` 的 context-only 原始语境不受影响。
- **Provider 提示边界**：模型必须把项目语境归纳为一个常见、可索引的专业建筑类别，活动和空间关系留在 `spatial_focus`；没有新增任何建筑类型词表。目标 4/4、Provider 全集 80/80 通过。
- **当前唯一下一步**：运行精准搜索相关八文件全集；通过后运行完整 API 与 Ruff/format/Mypy/diff 静态门禁。收口前不创建 Run。
- **回归收口**：精准搜索相关八文件 435 项、完整 API 557/557、Ruff lint、63 文件格式、strict Mypy 26 个源文件和 `git diff --check` 全绿。
- **当前唯一下一步**：重启服务并使用 Credential Manager 做普通 Responses 不落盘双路规划探针；通过后扫描并创建一条全新宽泛概念题的唯一单活建筑验收 Run。
- **真实验证**：普通 Responses 双路探针成功，`space_first` 无类型执行词，context 使用 3 词 `urban youth center`。新 Run `3618a879-3ca3-4d45-9cdf-d8238e95d0d5` 在达到 2/3、8 资产、3 项目后出现正文分析 `APIConnectionError / deterministic_fallback`，已立即取消并保留，不 retry、不计验收。
- **真实查询审计**：首轮与第二轮全部为短空间查询；context 查询没有复制 multi-program brief 或生成长类别。本轮修复真实生效，取消原因属于外部 Provider 连接，不修改调用预算或证据门槛。
- **当前唯一下一步**：普通 Responses 健康探针确认上游恢复；成功后创建另一条全新单活建筑验收 Run。
- **建筑验收 3/3**：上游探针恢复后，Run `24b9aade-b7b1-42da-9392-284cd9c1c535` 自然完成 `completed/coverage_satisfied`，3/3、12 资产、3 正式项目、完整综合；7 查询规划、6 实际筛选、8 正文分析、1 综合成功，51/51 EvidenceClaim URL/逐字 excerpt 有效，fallback/native web_search=0。
- **当前验收计数**：建筑 3/3、XHS 0/3，总计 3/6，活动 Run=0。
- **当前唯一下一步**：执行小红书会话预检；仅 `logged_in` 时创建第一条全新 XHS-only Run，其他状态 fail closed。
- **XHS 预检结果**：`unknown/local_search`；固定只读 OpenCLI auth status 超时，Chrome 扩展未配对。Board 登录入口正确，项目 `open-chrome` 端点已打开 Board；未创建图纸 Run、未进入普通网页搜索。
- **当前唯一下一步**：等待用户在系统 Chrome 完成小红书登录并重新检测；预检为 `logged_in` 后开始第一条 XHS-only 验收。
- **XHS 登录恢复**：预检现为 `logged_in/local_search`；7 个工作区活动 Run 为 0。
- **第一条 XHS 失败样本**：Run `96237a51-6425-4365-bec0-dd054b02fabe` 为 `partial/visual_budget_exhausted`，23 资产、8 项目，全部结果为 XHS URL 且有本地内容；普通网页事件 0、fallback=0。`contour-layering` 仅 2 篇 usable，固定 3 篇门槛正确拒绝完成；保留、不 retry、不计验收。
- **通用根因**：实际 OpenCLI 搜索只收到当前视觉方向短文本，原始图纸主题上下文没有进入搜索；QueryAttempt 虽记录完整问题，但不等于实际查询。不得通过降低每方向 3 篇 usable、扩大每方向 4 帖、48 图或 48 MiB 上限制造完成。
- **当前唯一下一步**：先写“简洁原题主题上下文 + 当前视觉方向”的 XHS 实际查询红测；再实现不含 rationale、Provider 指令和公共网页词的通用 compact query，并运行 XHS/浏览 workflow、完整 API 与静态门禁。收口前不创建新 Run。
- **XHS compact query 红测与实现**：山地公共建筑、社区医疗空间两个未见主题在旧实现上 2/2 准确失败；通用 helper 只清除请求话术和执行/公共网页控制词，保留原题空间主题，在 96 字符内追加当前视觉方向。XHS-only QueryAttempt 现在记录真实执行串，不再保存与 OpenCLI 参数不一致的冗长 provider query。
- **相关回归**：XHS adapter、浏览协议、核心 workflow 与完整浏览检查四文件共 232 项全绿；每方向 4 帖/3 usable、每帖 4 图、48 图像槽位/48 MiB、登录 fail-closed 和普通网页隔离均保持。
- **当前唯一下一步**：运行完整 API、Ruff lint/format、strict Mypy 和 `git diff --check`；全绿后更新 HANDOFF 并重启源码服务，再创建修改后才确定的全新 XHS-only 单活盲测 Run。
- **首个修改后盲测**：Run `e1a8fc51-d2a4-4ddf-bf87-fbd01d82f94d` 的真实 OpenCLI/QueryAttempt 已包含主题和方向，但仍有通用请求/媒介话术；第一方向 4 帖仅 1 篇 usable 后确定无法验收，已取消保留、不 retry、不计验收。
- **第二轮通用压缩**：同登录态 A/B 证明主题名词 + 空间关系 + 方向可召回更直接的活动中心/校园空间候选。红测把总长收紧至 64，并删除概念图纸、表现/表达、参考/比较、不同、配色、线型、版式、风格和方向已携带的图纸类型；没有题型词表或预算变化。
- **第二轮门禁**：目标 2/2、完整 API 559/559、Ruff lint、55 文件 format check、strict Mypy 26 个源文件和 `git diff --check` 全绿。
- **当前唯一下一步**：确认活动 Run=0 后重启服务，扫描另一条 production/tests 未出现的宽泛图纸题，创建唯一 XHS-only quick Run 并先审计第一方向 4 帖；不得 retry 校园 Run。
- **XHS 产品边界再次纠正**：图纸研究只检索“视觉表现方向 + 图纸类型”；建筑类型、项目主题、场地和空间关系不得进入 XHS 查询。此前 96/64 字符 compact helper 的主题拼接方向已撤销，不能据此继续创建校园、山地、医疗等项目题。
- **目标验证**：生产 workflow 直接使用视觉子问题文本作为 XHS 查询，并让 `QueryAttempt.query` 与实际 OpenCLI/扩展参数一致；两个未见场景目标测试 2/2 通过，分别严格得到“精细线稿分析图”和“精细线稿剖面图”。
- **当前唯一下一步**：运行 XHS/浏览相关回归、完整 API 与静态门禁；全绿后确认活动 Run=0、重启服务，并以纯图纸类型/视觉风格问题创建第一条新的 XHS-only 单活验收 Run。两条既有 XHS 失败样本均不 retry。
- **回归收口**：XHS adapter、浏览协议、核心 workflow 与浏览检查 232/232，完整 API 559/559，Ruff lint、55 文件 format check、strict Mypy 26 个源文件和 `git diff --check` 全绿。
- **当前唯一下一步**：只读确认 API/Board、XHS 登录态和全局活动 Run；满足 `logged_in`、活动 Run=0 后重启源码服务，并创建一条纯图纸类型/视觉表现请求的唯一 XHS-only quick Run。
- **XHS 正式验收 1/3**：Run `4679f319-7761-461a-a8a7-48939ec523c8` 为 `completed/coverage_satisfied`，三方向各 3 篇 usable，24 个剖面图资产来自 9 篇 XHS 笔记，全部有本地内容。3 条 QueryAttempt 严格为纯视觉剖面图查询；普通网页事件 0、fallback=0。
- **只读审计命令纠正**：首次查询误用了不存在的 `query_attempts.provider_name` 列；读取表结构后改用实际 `provider` 列。SQLite 全程以只读模式打开，未修改研究数据。
- **当前唯一下一步**：扫描并创建一条纯“视觉方向 + 爆炸图”的唯一 XHS-only quick Run，终态前只轮询和审计。当前建筑 3/3、XHS 1/3、总计 4/6。
- **纯爆炸图失败样本**：Run `8ff626c2-c9da-4d3c-8de1-0faca3dc0401` 为 `partial/visual_budget_exhausted`，三方向在各 4 帖后仅有 2/2/1 篇 usable；42 次图像检查、约 7.05 MiB，查询仍为纯视觉爆炸图，普通网页事件 0、fallback=0。保留、不 retry、不计验收。
- **当前唯一下一步**：只读审计爆炸图召回与视觉类型识别，先写跨极简/拼贴/材质三风格的通用红测，再最小修复并跑相关、完整与静态门禁；收口前不创建新 Run。
- **爆炸图 A/B 与红测**：同登录态将图纸类型写为“建筑爆炸图”后，极简/拼贴/材质三组前四条结果均回到建筑图纸；三个生产缺口红测准确失败，分别覆盖执行查询、确定性分类和真实视觉提示。
- **最小实现**：只对跨行业歧义的爆炸图添加建筑图纸学科限定；Mock 与 OpenAI 视觉合同统一将建筑爆炸图/分解轴测图归为 `axonometric`，拼贴或渲染风格不改变图纸类型。目标 5/5 通过，相关性、3 usable、4 帖和视觉预算未放宽。
- **当前唯一下一步**：运行视觉/Provider/XHS/浏览/workflow 相关全集、完整 API 与静态门禁；全绿前不创建新 Run。
- **门禁收口**：视觉/Provider/XHS/浏览/workflow 相关全集 320/320，完整 API 561/561，Ruff、55 文件 format check、strict Mypy 26 个源文件和 `git diff --check` 全绿。
- **当前唯一下一步**：确认活动 Run=0、重启源码服务，并用真实 Credential Manager 模型对临时下载的建筑爆炸式拼贴图做内存分类探针；通过前不创建新 Run。
- **真实探针纠正**：模型正确将没有构件分解关系的“爆炸式拼贴”判为 `analysis_diagram`，没有被新提示误升。进一步 A/B 显示“建筑爆炸图 + 风格”比风格前置更稳定召回真正爆炸图。
- **类型前置修复**：行为红测准确失败后转绿；相关 320/320、完整 API 561/561 与全部静态门禁再次通过。
- **当前唯一下一步**：重启服务，用标题明确的真实轴测爆炸图笔记做一次内存分类探针；通过后创建新的纯视觉爆炸图单活 Run。
- **真实分类探针通过**：标题明确的轴测爆炸图笔记下载 3 张，Provider 全部返回 `axonometric/relevance=4`，观察逐张确认构件分解关系；无 fallback、无持久化临时文件。
- **第二条爆炸图验收失败样本**：Run `a33b0185-fc5d-48ed-a93f-8c3cb7df042f` 自然终止为 `partial/visual_budget_exhausted`。黑白线稿与材质渲染各达到 3 篇 usable；红灰配色在 4 帖上限内只有 2 篇 usable，后两帖 8 张图片均为类型不匹配。20 个结果全部为本地 XHS 内容，普通网页事件 0、fallback=0；保留、不 retry、不计验收。
- **图纸输入边界**：图纸研究只接收视觉风格和图纸类型，不询问或推断建筑类型、项目主题、场地或空间关系。查询中的“建筑爆炸图”仅是排除产品拆解图的制图学科消歧，不是建筑类型。
- **显式风格保真修复**：红测先准确失败后转绿；明确枚举的视觉短语必须逐项逐字进入独立子问题，违规时最多一次普通 Responses 结构化纠正。Provider/相关全集、完整 API 562/562 与全部静态门禁全绿；没有风格词表、预算变化或确定性伪完成。
- **跨图纸类型查询归一化**：真实模型输出的 `图纸类型：风格` 暴露冒号残留；爆炸图两个红测和剖面图一个跨类型红测均先失败后转绿。公共入口统一移除中英文冒号，完整 API 566/566 与静态门禁全绿。
- **真实跨类型探针**：未见剖面图视觉题由真实普通 Responses 逐字保留针管笔密线、低饱和色块和纸张纹理拼贴；查询规范为“剖面图 + 完整风格”，无项目语义、无确定性 fallback，未创建 Run。
- **未见剖面图失败样本**：Run `a6752b62-90f4-4cb4-bf12-e1217db43650` 为 `partial/visual_budget_exhausted`；前两方向各 3 篇 usable，过窄的纸张纹理拼贴仅 2 篇。22 个本地 XHS 资产、普通网页 0、fallback=0。A/B 未证明词序问题，保留、不 retry、不计验收。
- **XHS 正式验收 2/3**：宽泛轴测图 Run `708ab8df-7829-4ea2-b19f-5382fa941920` 为 `completed/coverage_satisfied`，三方向 usable 3/3/3，27 个本地资产、9 篇 XHS 笔记；实际查询仅含视觉风格和轴测图，普通网页 0、fallback=0。
- **平面图失败样本**：Run `d654ecac-3e76-40a6-9555-02789f92cbec` 为 `partial/visual_budget_exhausted`；黑白线稿 3 篇 usable，水彩 0 篇，拼贴 1 篇。类型识别正确、普通网页 0、fallback=0；不加单题词表、不 retry、不计验收。
- **宽泛立面图失败样本**：Run `4bb39b3c-5bc0-46c3-95f7-ab53c9f62937` 为 `partial/visual_budget_exhausted`；三方向 usable 为 2/3/3。失败来自前四条本地搜索元数据中存在空内容或错误图纸类型，不是建筑类型污染、普通网页或 fallback；保留、不 retry、不计验收。
- **通用候选池实现**：视觉 XHS 搜索先读取最多 8 条元数据，按图纸类型标题命中和视觉短语 CJK bigram 相关性排序，再保留最多 4 帖进入既有打开/下载/视觉检查。每帖 4 图、48 图/48 MiB、每方向 3 usable 不变；Trace 增加 `xiaohongshu_candidate_pool`。
- **定向验证**：候选池 8→4 排序红测先失败后转绿；`test_xiaohongshu.py` 13/13、完整 `test_browser_inspection.py` 和定向 Ruff 通过。该修改后的完整 API、format、strict Mypy、diff check 和服务重启尚未完成。
- **图纸输入合同再明确**：用户输入只包含视觉分割/构图/表现方向和剖面图、爆炸图、轴测图等图纸类型。图纸规划、fallback、Board 文案和执行查询不得询问、推断或要求建筑类型，也不得混入项目主题、场地或空间关系。
- **全入口审查与红测**：后端 Provider、fallback、QueryAttempt、实际 XHS 查询和普通网页隔离均已满足纯视觉边界；Board 视觉模式仍显示建筑研究总提示，新增行为测试在旧 UI 上准确失败。
- **最小 UI 修复**：视觉模式首屏只呈现图纸类型与分割/构图/线型/配色/版式方向；建筑模式文案不变。目标 Board 3/3、后端输入边界与候选池目标 6/6 通过。
- **完整门禁收口**：相关 Python 六文件全集、完整 API 567/567、Board 181/181、Ruff lint、64 文件 format、strict Mypy 26 源文件、Board lint/typecheck/build 与 diff check 全绿。
- **运行时加载**：确认 API/Board、`logged_in/local_search`、7 工作区 94 历史 Run 且活动 Run=0，已重启源码服务加载候选池。
- **第三条候选失败样本**：Run `09cd4cb4-4853-42a9-b388-e38baaf42333` 的 Provider 三方向保持纯视觉，但第一方向 8 条候选只有 1 条标题明确命中效果图；4 帖后 2 usable，已取消保留、不 retry、不计验收。
- **通用根因**：`效果图`存在摄影/影视/产品歧义，和爆炸图的产品拆解歧义同类；候选池现有类型命中优先级又会放大非建筑噪声。A/B 表明建筑制图学科限定能恢复建筑渲染候选，不需要也不允许具体建筑类型词表。
- **红测与最小实现**：效果图学科限定和混合标题候选排序在旧实现上准确失败；统一歧义类型消歧与综合候选分实现后，新旧目标 7/7 转绿。建筑语境会覆盖“电影感”等合法风格词的噪声命中。
- **回归收口**：视觉/XHS/浏览相关六文件 328/328、完整 API 569/569、Ruff lint、64 文件 format、strict Mypy 26 源文件与 diff check 全绿；固定 XHS/视觉预算和准入未改。
- **XHS 正式验收 3/3**：宽泛效果图 Run `c521e3bd-6067-4453-b574-7c62684624e8` 为 `completed/coverage_satisfied`，三方向各 3 篇 usable，共 25 个 `render` 资产来自 9 篇 XHS 笔记；全部 URL 与本地文件有效。
- **产品边界实测**：QueryAttempt 只有“建筑效果图 + 视觉方向”。“建筑”仅作制图学科消歧，不是建筑类型；无项目、场地或空间语义。三次候选池均为 8→4，普通网页事件 0、fallback=0。
- **当前验收计数**：建筑 3/3、XHS 3/3，总计 6/6，活动 Run=0。
- **Board 六条验收通过**：三条建筑均显示 3 个子问题章节、逐题结论、案例答案、来源和转译步骤，图片共 10/10 加载；三条 XHS 均显示 3 个方向与 9 篇来源笔记，图片 24/24、27/27、25/25 加载。页面错误和非预期本地响应错误为 0。
- **视觉检查**：六张整页截图保存在 `.artifacts/qa/v2.2.4-board/`，已检查无结果缺失、断图或布局重叠。未创建或 retry 任何 Run。
- **`v2.2.4` 版本合同**：API、Board、Extension、manifest、CI artifact、Release 测试、README 和部署文档已统一；历史发布记录保持不变。Release 合同先准确红在旧 CI artifact，同步后转绿，当前发布面旧版本扫描为空。
- **GitHub 首页更新**：README 明确仍为 Evidence-Grounded Plan-and-Execute，并展示模型结构化规划 → 本地候选搜索 → 候选 ID 白名单筛选 → 本地正文/图纸读取 → 模型分析 → 程序证据绑定；空间优先与纯视觉 XHS-only 边界写入发布合同。
- **完整门禁通过**：API 569/569、Board 181/181、Extension 182/182、packaged E2E 8/8；Ruff 64 文件、strict Mypy 26 源文件、TypeScript lint/typecheck/build 和 Windows 发布合同全绿。
- **发布产物**：扩展 ZIP 为 18,719 bytes，manifest `2.2.4`，SHA-256 `4349E77FEFDEF8AF0F0C22F59D0F6C79AEFB398F17F2AA911CF45EEF76FAA26B`；安装器为 69,748,597 bytes，文件/产品版本 `2.2.4`，SHA-256 `AB2D0D19B4260C89A9F7DE02D277A4EC946707E9AE0D40492E3ABAE27B97A70B`。
- **真实安装 smoke**：静默安装、自检、快捷方式、扩展排除、安装版启动、动态端口健康、API/Board 200、静默卸载与无残留全部通过；仓库标准 package smoke 另行通过。
- **GitHub 发布完成**：发布提交 `08b49bb` 经 PR #15 的 Hosted CI run `30806486060` 全绿后 squash 合并为 `d80f715`；正式 `v2.2.4` Release 已发布，两个附件的 GitHub size/digest 与本地产物一致。
- **Phase 15 结果**：建筑 3/3、XHS-only 3/3、Board 六条 QA、完整门禁、独立扩展、Windows 安装器、真实安装 smoke、PR、CI、合并和 Release 全部完成。
- **当前唯一下一步**：无活动阶段；等待用户提出下一项产品任务。

## Phase 16: new-conversation handoff

Status: **complete**

目标：在不修改产品代码、不创建研究、不提交的前提下，把当前目标、完成项、未完成项、阻塞、活动 Run 和验证结果同步到四个项目管理文件，使同目录新对话可以从磁盘恢复，而不是依赖旧聊天上下文。

1. **恢复核对**：完整读取 `HANDOFF.md` 与 `AGENTS.md`，读取当前计划和 findings/progress 末尾；planning catch-up 只发现 PR #16 文件历史核对与本次交接请求，没有遗漏的产品开发。
2. **工作树核对**：交接修改前 `git status --short --branch` 干净；分支为 `agent/local-release-v2.2.2`，没有待提交产品修改。
3. **活动 Run 核对**：以 SQLite `mode=ro` 查询 `.archresearch/archresearch.db`；96 条历史 Run 全部为终态，非终态 Run 为 0，没有创建、重试、取消或修改研究数据。
4. **基线核对**：`v2.2.4` 产品验收与发布已经完成；本次没有产品代码变化，不重跑 API、Board、Extension、packaged E2E 或安装 smoke，继续引用 Phase 15 权威结果。
5. **交接范围**：只更新 `HANDOFF.md`、`task_plan.md`、`findings.md`、`progress.md`，按用户要求保持未提交。

### Errors encountered

| Error | Attempt | Resolution |
|---|---:|---|
| planning catch-up 首次调用系统 `python`，命中 Microsoft Store 占位符 | 1 | 改用 Codex 附带 Python 后成功；未写项目文件 |
| 两组只读 PowerShell 命令中的 `$null` / `$_` 被外层 shell 提前展开 | 1 | 改用单引号保护内层脚本并重新核验；未修改研究数据 |

### Handoff state

- 当前目标：完成新对话交接记录。
- 已完成：`v2.2.4` 全部产品与发布工作，以及本次只读状态审计。
- 未完成：无产品开发、测试、发布或 GitHub 操作。
- 阻塞：无。
- 活动 Run：0。
- 唯一下一步：新对话按 `HANDOFF.md` 恢复后，等待用户提出下一项产品任务；不要重做已完成工作。

## Phase 17: Xiaohongshu login detection recovery

Status: **complete**

目标：修复图纸灵感的小红书登录预检，使首次无法确认时可直接打开系统 Chrome 的小红书登录入口，登录完成后自动复检；已经登录过的 Chrome 会话应直接识别。不得读取、传输或持久化 Cookie、账号、密码，也不得创建 Research Run 或降级到普通网页搜索。

1. **行为复现与合同审计**：定位 Board 登录提示、FastAPI 预检端点、OpenCLI/扩展检测与 Chrome 打开路径，确认 `unknown` 的真实来源和已登录会话为何未被识别。
2. **先写红测**：覆盖首次未知状态打开小红书登录页并进入等待、登录后自动转为 `logged_in`、既有登录态首次检测直接通过，以及 fail-closed / 单次打开 / 无凭据传输边界。
3. **最小实现**：复用枚举浏览器协议与系统 Chrome，只增加登录入口、有限轮询和清晰状态反馈；不接受任意 URL、selector、脚本或凭据。
4. **验证收口**：运行 Board、API、扩展相关测试和必要静态门禁；只读确认无活动 Run，不使用 Codex 内置浏览器，不重做 v2.2.4 发布工作。

### Success criteria

- 首次检测为未登录、未知或通道暂不可用时，产品能在用户动作上下文中打开小红书登录页，并明确显示正在等待登录。
- 用户完成登录后无需反复手动点击，Board 在有限轮询内识别为 `logged_in`；轮询超时后提供可重复检测的明确动作。
- 系统 Chrome 已存在有效小红书登录态时，第一次检测直接返回 `logged_in`，不重复打开登录页。
- 登录检测不读取、打印、保存或返回 Cookie/账号/密码；小红书不可用时继续 fail closed，绝不创建图纸 Run 或转入普通网页。

### Errors encountered

| Error | Attempt | Resolution |
|---|---:|---|
| 首次管理文件补丁使用了与 `findings.md` 末尾不完全一致的交接句，校验失败 | 1 | 三文件均未改；读取精确末尾后改用实际上下文追加 |
| 本机状态探针的 `$_` 被外层 PowerShell 提前展开，解析失败 | 1 | 未触达服务；改用不含 PowerShell 变量的 `curl.exe` 只读请求 |
| 假定 OpenCLI 编译包存在 `dist/src/sites` 与 `dist/src/adapters`，路径检索失败 | 1 | 未修改文件；先用 `rg --files` 读取真实目录结构，再定位适配器 |
| Board 相关回归出现 4 个失败：2 个旧 link 断言、1 个旧手动配对场景、1 个自动配对与登录恢复竞态 | 1 | 更新按钮合同与手动配对夹具；生产 effect 在 `browserConnecting` 时暂停，并使轮询计时器可取消 |
| 第二轮 Board 回归出现 4 个失败：把后台 broker 连接误作当前页面授权，导致 3 个权限/隔离场景假就绪；另一个旧 fail-closed 测试过早断言异步打开动作 | 2 | 恢复原有页面授权边界，登录态仍由后端优先检测已连接 Chrome；专用自动登录测试负责打开动作，旧测试只验证禁止创建 Run |
| 第三轮 Board 回归剩 1 个失败：`?connect=chrome` 自动配对与登录恢复在 React 状态提交前同时调用连接函数，后一次 request id 取消前一次配对 | 3 | 将浏览器连接改为 single-flight Promise；并发调用复用同一配对过程，登录恢复等待其完成后再打开小红书 |
| single-flight 尝试后同一测试仍失败，说明先前竞态判断不成立；实际是登录恢复成功时清空了刚写入的 Chrome 连接提示 | 4 | 完整撤回 single-flight 改动；登录恢复不再改写独立的 `browserPairingStatus`，保留已验证连接反馈 |
| Python 静态门禁中 Ruff lint 通过，但 `browser.py` format check 要求机械排版；并行调用未可靠返回 Board 结果 | 5 | 仅用 Ruff 格式化该已修改文件，再分别重跑 Python 与 Board 静态门禁 |
| 收口前 SQLite 只读查询的 SQL `*` 被外层 PowerShell 提前解析，查询未执行 | 6 | 服务未重启；改用单引号 here-string 通过 Python stdin 执行同一 `mode=ro` 查询 |
| `mode=ro` 查询使用了错误表名 `runs`，数据库返回 `no such table` | 7 | 未写数据库、未重启服务；先只读读取 `sqlite_master`，再对真实 Run 表统计 |

### Result

- **根因修复**：FastAPI 不再让 OpenCLI `unknown` 遮蔽已连接 Chrome 的 `logged_in`；明确状态按 fail-closed 规则合并，没有登录通道时仍为 `unavailable`。
- **安全登录入口**：新增 POST `/v1/browser/open-xiaohongshu-login`，只把代码内固定小红书 URL 交给系统 Chrome；Board URL 白名单与 pairing attempt 合同保持不变。
- **Board 恢复流程**：首次异常状态自动恢复一次，必要时先复用既有 Chrome 配对，再打开小红书并有限轮询；界面提供 opening、waiting、timed_out 与可重复动作，已有登录不会重复开页。
- **红绿验证**：旧实现上 API 2 条目标测试失败、Board 自动恢复测试失败；实现后目标测试、119 项相关 Board 回归和 48 项相关 API 回归转绿。
- **完整门禁**：API 571/571、Board 183/183、Extension 182/182；Board lint/typecheck/build、Ruff check/format、strict Mypy 26 源文件与 diff check 全绿。
- **运行时加载**：只读确认 96 条历史 Run、活动 Run=0 后，用项目 stop/start 脚本重载；API health=ok、Board=200、新端点已注册。重载后活动 Run 仍为 0。
- **范围**：没有读取、打印或保存凭据，没有创建 Research Run，没有普通网页降级，没有使用 Codex 内置浏览器，也没有 commit、push、PR 或发布。

### Handoff state

- 当前产品版本：已发布版本仍为 `v2.2.4`；本轮是未发布本地源码修复。
- 当前架构：Windows/Chrome local-first Evidence-Grounded Plan-and-Execute，FastAPI + SQLite + 本地文件，架构未变。
- 阻塞：无；下一步仅由用户在自己的 Chrome 做真实账号验收。
- 唯一下一步：刷新本地 Board 并进入图纸灵感；已有登录应直接就绪，未登录应自动打开小红书并在登录后自动就绪。

## Phase 18: system Chrome Xiaohongshu login acceptance

Status: **complete**

目标：在用户自己的系统 Chrome 中对 Phase 17 做真实账号路径验收，不使用 Codex 内置浏览器，不读取浏览器存储或凭据，不提交研究或创建 Research Run。

1. **安全基线**：只读确认活动 Run=0、源码 API/Board 健康，连接用户系统 Chrome，只读取可见页面与标签状态。
2. **既有登录路径**：打开/刷新本地 Board，进入“图纸灵感”，观察首次预检是否直接就绪且不重复打开登录页。
3. **恢复路径**：若当前会话未确认，验证产品是否自动打开固定小红书页面、显示等待状态并自动复检；若需要账号操作，暂停让用户本人登录。
4. **收口**：只读确认活动 Run 仍为 0，记录可见页面结果、打开次数与阻塞；不修改产品代码，除非验收发现可复现缺陷且用户继续要求修复。

### Success criteria

- 只使用系统 Chrome；不检查 Cookie、local storage、密码或账号字段。
- 已有登录时 Board 显示“研究环境已就绪”，且不额外打开小红书登录页。
- 未确认时只打开代码内固定小红书入口，Board 显示 opening/waiting；用户完成登录后自动转为就绪。
- 全程不点击“开始研究”，验收前后活动 Run 都为 0。

### Errors encountered

| Error | Attempt | Resolution |
|---|---:|---|
| Chrome 控制层的 Statsig 初始化请求超时，但 Board DOM 快照完整返回 | 1 | 认定为控制插件遥测噪声，不是 ArchResearch 页面错误；继续使用已连接标签并以页面状态验收 |
| Phase 18 收口补丁因 Statsig 错误行此前被通用表头锚点误插到 Phase 14，校验失败并整体未应用 | 1 | 读取精确位置，移除 Phase 14 误插行并用 Phase 18 标题上下文重新收口；未改产品代码或浏览器状态 |
| 用户退出系统 Chrome 后，Board 仍显示就绪；API 返回 `logged_in/local_search` | 1 | 现场确认 OpenCLI 独立登录覆盖了 Chrome 明确未登录；先写“扩展 not_logged_in 优先于 local logged_in”红测，再做最小通道优先级修复 |
| 新增通道权威红测在旧实现上失败：期望 `not_logged_in/chrome_extension`，实际 `logged_in/local_search` | 1 | 红灯与现场结果一致；进入最小生产修复，扩展明确状态立即返回，只有 `unknown` 回退 local search |
| 完整 API 572/572 通过，但 Ruff format check 要求机械排版 `browser.py` | 1 | lint 已通过；仅格式化该已修改文件，再重跑 Ruff format 与 strict Mypy |
| 只读探针误用 GET 请求 session 端点，返回 405 | 1 | 端点合同为 POST；改用 POST 后得到 `logged_in/local_search`，没有写入研究数据 |
| 首次定向 Vitest 命令携带不支持的 `--runInBand` | 1 | 移除 Jest 专属参数后正常执行；产品代码未受影响 |
| 新晚登录测试首次在启用 fake timers 后使用 `userEvent.click`，测试自身超时 | 1 | 改用同步 `fireEvent.click`，再逐段推进 timer；最终测试在旧 8 次下准确红、20 次下转绿 |

### Result

- **已有登录真实通过**：系统 Chrome 基线只有一个 Board 标签；刷新后点击唯一“图纸灵感”，页面直接显示“研究环境已就绪”和“小红书负责查找灵感 · Chrome 可读取当前页面高清图”。
- **通道确认**：FastAPI 返回 `connected=true`、`session_status=logged_in`、`session_channel=chrome_extension`，证明识别的是用户当前 Chrome 登录态，不是 OpenCLI ephemeral 探针。
- **不重复开页**：就绪后系统 Chrome 仍只有原 Board 标签，没有新增小红书登录页，符合“已有登录不重复打开”。
- **无副作用**：没有点击“查找灵感”，Board 控制台错误为 0；验收前后 SQLite 均为 96 条历史 Run、活动 Run=0，`git diff --check` 通过。
- **未登录路径边界**：当前真实 Chrome 已登录；现场验证该路径需要登出或破坏用户会话，因此没有执行。unknown→打开→自动复检继续由已通过的 Board 行为测试覆盖。
- **未登录路径续测失败**：用户随后自行退出；刷新进入图纸灵感仍错误显示就绪，API 为 `logged_in/local_search`。原通道合并规则“任一 logged_in 即通过”不符合系统 Chrome 登录 UX，需改为 Chrome 明确 `logged_in/not_logged_in` 均权威，只有 `unknown` 才回退 local search。
- **未登录根因已修复**：新增红测在旧实现复现 `logged_in/local_search`；最小修改后扩展明确状态成为权威，API 572/572、Ruff 与 strict Mypy 全绿，现场 API 返回 `not_logged_in/chrome_extension`。
- **未登录前半程真实通过**：重新进入图纸灵感后 Board 显示“等待小红书登录”和自动检测说明；固定 XHS explore 标签从基线 1 个增至 2 个，证明产品自动打开固定登录入口。等待用户本人登录后验证自动转为就绪。
- **用户登录可识别**：用户本人完成登录时旧 8 次轮询已超时；点击“重新检测”后 Board 立即转为“研究环境已就绪”，API 为 `logged_in/local_search`。这证明当前安装扩展不是版本阻塞，剩余缺口是等待窗口不足。
- **真人等待窗口修复**：新增“晚于旧窗口登录”行为测试，最终版本在 8 次常量下准确失败、改为 20 次后通过；登录入口仍只打开一次，超时后的手动动作继续保留。
- **最终门禁**：Board 184/184、lint、typecheck、production build 全绿；本轮后端完整基线保持 API 572/572、Ruff 与 strict Mypy 全绿，Extension 未修改且 182/182 基线保持有效。
- **最终真实冷启动**：用户已登录后刷新 Board，首次进入图纸灵感直接显示“研究环境已就绪”；固定 XHS explore 标签保持 2 个、没有再次打开，Board error 日志为 0。
- **最终无副作用**：SQLite `mode=ro` 仍为 96 条历史 Run、活动 Run=0，`git diff --check` 通过；没有点击“查找灵感”，没有 commit、push、PR 或发布。
- **浏览器边界**：只使用系统 Chrome；没有使用 ambient in-app browser，没有读取 Cookie、storage、profile、账号或密码。

### Handoff state

- 阻塞：无。
- 唯一下一步：等待用户确认结果或提出后续动作；本地修改保持未提交，不 commit、push、PR 或发布。

## Phase 19: v2.2.5 product README and release

Status: **complete**

目标：把仓库首页从开发过程/测试说明改写为面向用户的产品介绍，清楚说明 ArchResearch 的功能、使用方式和运作流程；随后将 Phase 17–18 的小红书登录修复与 README 一起作为 `v2.2.5` 完整验证、提交、代码审查、安装验收并发布。Chrome 扩展代码未改，不要求用户为本次修复重新安装扩展。

1. **范围审计**：完整审查 README、当前 diff、版本与发布脚本，区分产品说明、开发文档和应保留的安装/安全信息。
2. **README 重写**：以用户任务和产品工作流为主线，说明建筑研究、图纸灵感、证据与本地数据；删除开发日志式的测试数字、技术选型辩护和“用了/没用什么”的叙述。
3. **发布验证**：更新版本到 `2.2.5`，运行 API、Board、Extension、构建、发布合同与安装 smoke；只读确认活动 Run=0。
4. **GitHub 发布**：仅暂存本阶段确认的产品、测试、README、版本与用户文档，不纳入原工作区四个交接文件；提交并推送干净分支，创建 draft PR，等待 Hosted CI，通过后合并、打 tag、发布两个独立附件并核验 digest。

### Success criteria

- README 首屏先解释 ArchResearch 能做什么，正文给出从输入问题到研究板/灵感板的完整运作流程。
- README 不再用大篇幅展示开发测试、内部实现选择、退役技术或“为什么没用某某组件”；必要的本地优先、安全边界与安装说明仍清楚。
- `v2.2.5` 包含登录修复与新版 README，安装器和扩展继续作为两个独立附件；安装器不捆绑扩展。
- 全部门禁、真实安装 smoke、GitHub CI、Release 附件大小与 digest 均通过；真实研究数据不写入提交。

### Errors encountered

| Error | Attempt | Resolution |
|---|---:|---|
| 原工作区与新 worktree 的 19 个候选文件逐字节哈希有 16 个不一致 | 1 | 确认为 Git checkout 的 CRLF 与原修改 LF 差异；统一换行后 19/19 内容完全一致，未复制额外文件。 |

### Handoff state

- 阻塞：无。
- 活动 Run：发布后 SQLite `mode=ro` 核对为 96 条历史 Run、非终态 Run=0。
- GitHub：PR #17 已 squash 合并为 `a691a0e141d9863672886b8c868cee03da0a818c`；两套 Hosted CI 均成功；正式 `v2.2.5` Release 已发布，两个附件大小与 digest 均匹配。
- Git 工作区：原工作区的 19 个产品/测试/README/版本修改与四个交接文件修改继续保留，产品内容已通过独立 `codex/v2.2.5` worktree 发布，不代表仍有未完成开发。
- 唯一下一步：等待用户下一项明确任务；不要重做 v2.2.5，也不要自行清理或同步原工作区。

## Phase 20: installed Xiaohongshu login launcher opens Board

Status: **complete**

目标：修复 v2.2.5 Windows 安装版点击/自动触发“小红书登录”时错误再打开一个 Board 标签的问题；安装版必须在用户系统 Chrome 打开代码内固定的 `https://www.xiaohongshu.com/explore`，且不放宽 URL 协议、不读取凭据、不创建 Research Run。

1. **真实复现与链路审计**：记录系统 Chrome 标签基线和安装版运行端口，只读触发一次登录打开动作，定位固定 XHS URL 在 Board → API → 冻结桌面启动器链路中被替换的位置。
2. **行为红测**：先在安装版/桌面启动路径对应测试中复现“XHS 请求最终打开 Board URL”，同时保留 Board 启动固定本地 URL 和任意 URL 禁止输入的既有合同。
3. **最小实现**：只修复 URL 调度/启动参数传递，不新增通用 URL API，不改变扩展协议、登录态检测或研究 workflow。
4. **验证**：运行定向测试、API/Windows 发布合同和必要构建；活动 Run=0 时重载或构建安装候选，再用系统 Chrome 验证只新增固定 XHS 标签、不新增 Board 标签。
5. **v2.2.6 发布**：用户已于 2026-08-04 明确授权发布；先提升版本合同并红测，再同步版本、构建两个独立附件、做安装验证，最后在干净分支提交、PR、CI、合并、tag、Release 与 digest 核验。

### Success criteria

- 安装版首次未确认登录和“再次打开小红书登录”都打开固定 XHS explore，而不是 Board。
- Board 启动仍只允许动态本地 Board URL；XHS 登录端点仍无 URL 参数，不能成为通用浏览器打开器。
- 不读取 Cookie、storage、账号、密码或 API Key；不点击“查找灵感”，验证前后活动 Run=0。
- 先红后绿，定向回归与 Windows 安装/发布合同通过。

### Errors encountered

| Error | Attempt | Resolution |
|---|---:|---|
| 定向 Ruff check 通过，但 format check 要求重排 `desktop.py` 与 `test_desktop.py`；并行执行未可靠汇总另外两项输出 | 1 | 仅对两个已改文件运行项目 Ruff format，然后分别重跑测试、Ruff 与 Mypy，不复用缺失输出。 |
| 独立 worktree 首次完整 verify 在新红测处为 571/572；复用的 editable venv 导入了原工作区旧 `desktop.py` | 1 | 明确设置 worktree `PYTHONPATH` 后重跑，API 572/572、Ruff 与 Mypy 通过。 |
| pnpm 拒绝在无 TTY 下重建临时 junction `node_modules` | 1 | 不允许 pnpm 删除/重建临时依赖；在原工作区现成依赖上完整重跑，所有门禁通过。 |
| 尝试移除 4 个本轮创建的临时依赖 junction 被安全策略拦截 | 1 | 未删除任何内容；不绕过策略，junction 仅位于临时 worktree、被 Git 忽略并可供后续构建复用。 |
| 2026-08-04 发布授权交接补丁因 Phase 20 结果段措辞不匹配而整体未应用 | 1 | 读取 Phase 20 精确行后分文件更新；没有沿用失败上下文。 |
| 版本同步后 Release 合同仍要求 README 的转义正则 `v2\.2\.5`，普通版本扫描未命中 | 1 | 更新 3 个 README 正则到 v2.2.6，并把普通与转义旧版本扫描都纳入重跑。 |
| 首轮 v2.2.6 完整 verify 在 API 572/572 后要求格式化两个版本文件 | 1 | 仅机械格式化 `__init__.py` 与 `main.py`，随后从头完整重跑。 |
| 首次冻结程序自检用普通 PowerShell 调用 GUI EXE，`$LASTEXITCODE` 为空而被脚本误判失败 | 1 | 改用 `Start-Process -Wait -PassThru` 读取真实退出码；冻结程序 `--self-test` 为 0。 |
| 第一轮 Hosted CI 在既有 Provider 测试中把动态剩余超时 `89.99999999999989` 严格等同 `90.0`，导致 1/572 失败 | 1 | 生产逻辑不变；把浮点预算断言改为 `pytest.approx`，目标测试连续 10 次与 Ruff 均通过，再推送最终提交；两套最终 CI 全绿。 |

### Result

- 根因已修复：安装版只把源码 Board 常量映射到动态本地端口，固定 XHS explore URL 不再被丢弃；默认 launcher 继续使用枚举的已知 URL 白名单。
- 红测在旧实现准确失败、修复后转绿；desktop/browser 定向 45/45，权威完整门禁 API 572/572、Board 184/184、Extension 182/182、packaged E2E 8/8 与全部静态/构建/Windows 合同通过。
- 真实 Chrome 启动验证：Board 标签 3→3，XHS 标签 2→3，唯一新增标签为 `https://www.xiaohongshu.com/explore`；没有再次新增 Board。
- SQLite 仍为 96 条历史 Run、活动 Run=0；没有点击“查找灵感”或读取凭据。
- v2.2.6 版本面、README 下载链接、发布合同、安装器和独立扩展 ZIP 已完成；冻结程序自检通过，安装器负载中没有扩展文件。
- 干净分支提交后由 PR #18 合并为 `7512a45bfec010cde8a701c910afbd43af813137`；最终 push/PR 两套 Hosted CI 全绿，均通过真实 Windows 安装/卸载 smoke。
- annotated tag `v2.2.6` 解引用到合并提交；正式 Release 非草稿、非预发布，两个附件名称、大小和 GitHub digest 与 CI 产物一致。
- 最终安装器为 70,087,718 bytes / SHA-256 `4BDC30F5E3D17143D88FB68E25B68C33D5B7586CF3AEEDDCB798FAC19B6916B2`；扩展 ZIP 为 18,697 bytes / SHA-256 `40634B85FD98250185811F9E3B84B1CB9F9139C610FA9DDB2DF689F44EDA30FA`。
- 发布后 SQLite `mode=ro` 仍为 96 条历史 Run、活动 Run=0；当前无阻塞、无未完成产品任务。
- 唯一下一步：等待用户下一项明确任务；不要重做 v2.2.6，也不要清理原工作区或真实研究数据。

## Phase 21: v2.2.6 installed login remains undetected

Status: **completed**

目标：诊断并修复 v2.2.6 安装版已经能打开小红书、但用户完成退出重登后仍显示未检测到登录的问题；必须基于用户系统 Chrome 的真实可见状态和枚举协议判断，不读取 Cookie、storage、账号、密码或 API Key，也不创建 Research Run。

1. **现场只读诊断**：确认当前安装程序版本/进程、动态端口、扩展连接状态、登录检测 API 的 `session_status/session_channel` 与活动 Run；用系统 Chrome 只读取标签和可见页面状态。
2. **链路审计**：对照 v2.2.6 `browser.py`、扩展 XHS 会话检测和 Board 轮询，确定是旧扩展、页面匹配、可见 DOM 判定、通道合并还是安装升级残留导致。
3. **行为红测**：在确定根因后，先用最小 API/扩展/Board 测试复现真实返回，再修改生产代码。
4. **最小修复与验证**：只修改登录检测必要部分，运行定向回归、静态门禁和必要构建；重载候选后由用户系统 Chrome 验证登录可识别，活动 Run 前后保持 0。
5. **交付边界**：未经用户后续明确授权，不 commit、push、PR 或发布；若修复需要新版扩展或安装器，先报告准确升级范围。

### Success criteria

- 当前系统 Chrome 已登录小红书时，API 返回 `logged_in`，Board 自动转为“研究环境已就绪”。
- 明确未登录时仍 fail closed；不得通过搜索结果、历史标签或 OpenCLI 独立会话误判为已登录。
- 不读取或保存凭据，不点击“查找灵感”，不创建 Research Run。
- 先红后绿；目标测试与相关回归通过，并以真实系统 Chrome 可见状态验收。

### Errors encountered

| Error | Attempt | Resolution |
|---|---:|---|

### Current result

- 现场安装版为 v2.2.6、端口 3824，扩展已连接且 Chrome `<all_urls>` 权限已授予；session API 在 196–219 ms 内返回 `unknown/chrome_extension`，证明命令在 3.5 秒页面等待前失败。
- 已加载桌面扩展包确为 v2.2.6 且原 background 与正式产物同哈希；同时发现一个指向已不存在旧项目目录的第二解压扩展登记，存在争抢单一 broker 连接的风险。
- RED 复现 `ui.status` 只报告持久权限却不修复已连接 client 的命令门；最小实现只在显式 connected status 时重同步。扩展 lint、typecheck、183/183 单测、build、8/8 packaged E2E 全绿。
- 候选 background 已先备份旧正式文件后写入当前桌面 v2.2.6 解压扩展目录；Chrome 尚未重新加载 worker，现场 API 仍为 219 ms unknown，符合旧 worker 仍在运行。
- 当前唯一下一步：在 `chrome://extensions` 停用旧登记 `cdkileihmdefnppmjnpobcjgenilohid`，重新加载当前登记 `hcjjgfakbbecihgiehjklobckkjgimmo`，然后只调用 session API 验证已登录状态；不创建 Run。
- 直接 Chrome 验收已揭示真实阻塞：固定搜索页在 Default profile 被重定向到 `/website-login/captcha`（标题“安全验证”），不是普通登录页或搜索页。扩展此前未枚举该路径，因而错误显示 unknown。
- captcha 路由 RED 已转绿，最终扩展门禁为 190/190 单测、lint、typecheck、build、8/8 packaged E2E；候选 content bundle 已更新。
- 当前唯一下一步：用户明确授权 Codex 处理验证码，或用户本人完成保留的安全验证页；随后重新加载扩展并验证 API=`logged_in`、活动 Run=0。
- 用户本人完成安全验证后，生产 session API 在 3.910 秒返回 `logged_in/chrome_extension`；扩展连接保持 true。项目研究库 96 条历史 Run、活动 Run=0；安装版数据库 Run=0、活动 Run=0。
- `git diff --check` 通过；仅有既有 Windows 换行提示。Phase 21 完成，未 commit、push、PR 或发布。

## Phase 27: drawing inspiration search waits for rendered note cards

Status: **completed**

目标：修复 Chrome 扩展已连接且小红书已登录时，图纸灵感搜索仍可能在结果卡渲染前完成两次空枚举并返回 0 条结果的问题。

1. **现场证据**：核对失败 Run、应用实际搜索 URL、当前登录状态和同页可见图纸卡；区分查询无结果、DOM 关联失败与加载时序问题。
2. **行为红测**：模拟受管页面前两次媒体枚举为空、第三次出现有效小红书笔记卡，要求搜索继续等待并返回结果。
3. **最小修复**：只在小红书浏览器搜索层增加有上限的结果就绪轮询；一旦出现有效笔记链接立即停止等待，保留原滚动补充与 URL 安全边界。
4. **验证**：运行 API 定向测试、完整小红书测试、Ruff、Mypy 和相关扩展回归；条件允许时用当前 Chrome 连接做只读现场复测。

### Success criteria

- 前两次枚举为空、随后卡片渲染时，搜索不再提前返回 0 条结果。
- 已就绪页面不增加额外等待；始终无结果时轮询有固定上限。
- 只接受小红书 `/search_result/`、`/explore/`、`/discovery/item/` 笔记 URL，不读取 Cookie、storage、账号、密码或 API Key。
- 先红后绿，失败 Run 保留原始记录，不修改或伪造历史结果。

### Current result

- 红测先证实旧实现两次枚举后提前返回空列表；新增延迟卡片和始终为空两个行为测试后，最小轮询修复已通过。
- API 小红书测试 16/16、完整 API 测试全绿；Ruff、strict Mypy、diff check 全绿；扩展内容协议测试 25/25 全绿。
- 未创建、重试、取消或修改 Research Run；本 Phase 补丁已随 v2.2.9 安装器与独立扩展 ZIP 发布。

## Phase 30 — pause repeated Xiaohongshu login checks

Status: **completed**

目标：修复图纸灵感登录恢复在 `unknown`/`not_logged_in` 状态下由 Board 外层持续检测并反复创建小红书临时标签的问题，同时保留有限自动检测。

1. **行为红测**：同一受管标签上的 `unknown`/`not_logged_in` 状态继续重查，要求不创建第二个标签。
2. **最小修复**：移除 Board 外层重复开页循环，将自动检测限制在扩展同一受管标签内 20 秒；超时或安全验证后暂停，用户可点“重新检测”。
3. **验证**：运行 Board 定向测试、完整 Board 测试、lint、typecheck、production build 和 diff check。

### Success criteria

- 同一轮恢复不会因 `unknown`/`not_logged_in` 重复创建小红书标签，自动检测最多持续 20 秒。
- `logged_in` 仍可完成恢复，`verification_required` 仍保留安全验证页并暂停。
- 不读取 Cookie、storage、账号、密码或 API Key，不创建或修改 Research Run。

### Current result

- 红测在旧实现下复现 20 次会话检测；修复后 Board 每轮只发起一次检测请求，扩展在同一受管标签上对 `unknown`/`not_logged_in` 最多重查 20 次。
- 登录成功和安全验证路径保持通过；Board 全量测试 190/190、Extension 全量测试 200/200、两端 lint/typecheck/build 和 diff check 全部通过。
- 正式 v2.2.9 未覆盖或发布；独立 v2.2.10 候选扩展已同步最新构建；未创建或修改 Research Run。

## Phase 31 — packaged content-script injection and live acceptance

Status: **completed**

目标：修复详情协议新增共享依赖后，生产构建把动态注入的 `content.js` 输出为带静态 `import` 的 ES 模块，导致 Chrome 无法注册消息监听器、登录检测与图纸读取全部失败的问题；继续保留单标签、验证码不刷新/不关闭和普通网页后台读取合同。

1. **构建红测**：真实运行 Vite production build，要求 `assets/content.js` 是可供 `chrome.scripting.executeScript` 注入的自包含文件，不含静态 `import` 或 `export`。
2. **最小修复**：将内容脚本所需的小红书 URL 白名单移入 content 专属模块，避免与 background 共享 chunk；撤销未获现场支持的小红书前台开页改动。
3. **回归验证**：运行 Executor、Extension 全量测试、lint、typecheck、生产构建和相关 API/Board 回归。
4. **协议错误定位**：对内容脚本注入失败、消息接收端不可用、内容操作拒绝和命令超时返回有限内部错误码；QA broker 在 API 泛化异常前记录错误码，不暴露页面数据。
5. **真实验收**：用户重载候选后，只执行一次登录检测；根据记录到的错误码修复已证实层级。登录通过后运行一条隔离图纸研究，确认非零可用参考和图片。

### Success criteria

- 登录检测返回 `logged_in/chrome_extension`，不新增 Board，不重复创建或刷新小红书标签。
- 遇到真实验证码仍立即返回 `verification_required` 并保留同一标签。
- 图纸研究完成或保留部分结果，且可用小红书参考与媒体均大于 0、Board 能实际渲染。
- 正式 v2.2.9 不覆盖、不发布；未通过完整现场验收前不发布 v2.2.10。

### Current result

- 用户重载前一候选后的唯一 session 探针仍为 `unknown/chrome_extension`；QA 命令序列证明 `open_url` 和 `wait` 成功，失败发生在 `xiaohongshu_session_status` 内容命令本身，前台开页假设未获现场支持。
- 新增 3 个错误分类红测，旧实现准确失败；最小实现后定向 52/52、Extension 全量 209/209、ESLint、TypeScript 和 `git diff --check` 通过。
- QA broker 已能记录扩展返回的有限错误码。下一步生产构建并覆盖同一 `v2.2.10-candidate`；用户重载后只做一次 session 探针。
- 诊断候选重载后的唯一 session 探针返回 `content_message_unavailable`：首次消息与补注入后的消息均无接收端。下一步只检查监听器注册、注入目标文档和 documentId 生命周期，不再修改登录 DOM 或增加等待时间。
- 根因已确认：生产 `content.js` 以 `import "./protocol.js"` 开头，动态普通脚本注入时入口不执行。构建红测旧实现准确失败，修复后相关 122/122、Extension 全量 210/210、ESLint、TypeScript、production build 与 packaged E2E 8/8 全绿。
- 最新候选 ZIP 22,329 bytes / SHA-256 `71FF6FFEC100C150C0858F77A9AA5B9C2B5E11590E7EA69FD21D9484FE9E2A9B`；content SHA-256 `97825543F22687BD570539BF0AD0715A27DD5EA113546CD9FDE6C2B9427A77B3`，已验证自包含。下一步用户重载同一目录后做一次 session 现场验收。
- Session 现场已通过，但首条完整图纸 Run `b9bb962a-67e1-4d8a-afec-0efdea37f373` 仍为 0 结果；Trace 将剩余边界收敛到搜索页 `enumerate_media` 或笔记链接关联。下一步用 QA 安全计数区分两者，不再依赖超时的 Chrome DOM 接管。
- Phase 31 的 production content-script 注入与登录现场验收已完成；后续 Run 能进入详情读取并落盘图片。Phase 32 对这些图片的“可用”判断已被人工内容审计否定，视觉结果质量转入 Phase 33，不再计入本阶段完成证据。

### Errors encountered

| Error | Attempt | Resolution |
|---|---:|---|
| 错误分类首次 typecheck 报 `unknown` 不能返回为 `Error` | 1 | 将 `isContentTimeout` 改为 TypeScript 类型谓词；全量 typecheck 随后通过。 |
| packaged E2E 首轮仍期待旧 `execution_failed` | 1 | 产品按新安全分类正确返回 `content_operation_rejected`；更新 E2E 合同后 8/8 通过。 |
# Phase 32 — 新版小红书搜索页媒体枚举与完整图纸验收（invalidated）

## 目标

- 修复真实搜索页 `enumerate_media` 连续返回 0 的问题，并在同一隔离环境中完整跑通图纸研究。

## 已完成证据

- [x] 用户重载后确认隔离 API 正常、扩展桥 `connected=true`。
- [x] 只运行一次搜索探针；`source_count=0`，10 次媒体枚举均为 0，搜索/滚动/会话命令无异常。
- [x] 将修复层收敛到扩展内容脚本的媒体表示、可见性或尺寸枚举。

## 剩余步骤

- [x] 读取现有媒体枚举实现与测试合同。
- [x] 先补能复现后台搜索页不渲染结果卡的失败测试；旧实现 2 项准确失败。
- [x] 做最小生产修复，并通过 Extension 211/211、lint、typecheck、production build 与 packaged E2E 8/8。
- [x] 覆盖同一候选包，用户重载后单次搜索探针返回 3 个来源、12→15 张有效关联图片。
- [x] 新建唯一隔离图纸 Run `e45719b0-5d05-4815-99db-17e262666e6b`：3/3 方向、9 个 PNG、9/9 文件可读，Board 显示 4 篇帖子与 9 张灵感图。
- [ ] 逐张确认结果是干净、完整、可用于图纸研究的素材；本轮人工审计为 0/9 合格。

## 最终结果

- Run 终态 `partial/composing`、`stop_reason=visual_budget_exhausted`；程序记录为 9 个资产、4 个项目/帖子来源、3/3 方向，但“可用资产”标记不可信。
- Trace 39 个事件，3 次小红书搜索、3 次候选池、12 次 browser 检视，浏览器失败事件 0；视觉检查实际执行到 quick 上限。
- Board 真实页面可以渲染这些文件，但渲染成功不等于素材正确。
- 人工逐张审计：2 张近乎全白；多张含巨大标题、灰色遮罩或错误局部裁剪；1 张带完整小红书导航；1 张主要是正文、评论与关注面板。0/9 可作为干净、完整图纸参考。
- 正式 `v2.2.9` 未修改或发布；候选 `v2.2.10` **未达到**发布前现场验收标准。

## Errors encountered

| Error | Attempt | Resolution |
|---|---:|---|
| Chrome DOM 统计超时 | 1 | 不重复同一路径，改用安全探针和既有前台页面证据。 |
| Chrome 只读截图超时 | 1 | 停止 Chrome 页面接管；用行为红测验证后台/前台打开合同。 |
| 递归重建候选目录命令被本地策略拦截 | 1 | 不绕过策略；改为覆盖 dist 文件并用补丁精确删除唯一旧残留文件。 |
| 首次 Board API 媒体检查被 PowerShell 自动数组展开误判 | 1 | 改为读取原始 JSON 并显式转换为 9 个对象，9/9 内容端点随后返回 200。 |
| Board 首次打开同名旧 Run，显示 0 张参考 | 1 | 刷新主页后按最新卡片“9 张参考”打开当前 Run，不修改研究数据。 |
| Board 图片统计中的 `HTMLImageElement instanceof` 在隔离求值环境不可用 | 1 | 改为只读检查 `complete/naturalWidth` 属性，得到 11 个展示节点、10 个即时加载、0 个失败占位。 |
| 首次尝试同时更新四个规划文件时，`findings.md` 锚点与实际末尾不一致，补丁整体未应用 | 1 | 改为按文件实际内容分别更新；生产代码和规划文件均未被部分写入。 |

# Phase 33 — 图纸媒体选择与裁剪质量修复

Status: **complete**

目标：修复详情页媒体选择、加载等待与截图裁剪链路，确保最终结果是帖子中的干净、完整图纸，而不是空白轮播、页面壳、正文面板、遮罩或错误局部裁剪。

1. **失败证据固化**：保留 Run `e45719b0-5d05-4815-99db-17e262666e6b` 的 9 张原始 PNG，记录逐张问题，不修改或伪造历史结果。
2. **链路审计**：检查 `collectMedia()` 的媒体元素与 region、详情打开和媒体枚举时序、`captureTab()` 激活标签后的布局变化，以及 API 截图保存/视觉分类输入。
3. **行为红测**：先覆盖空白轮播不得入选、页面侧栏/正文/遮罩不得成为素材、截图必须使用当前媒体元素的有效坐标。
4. **最小修复**：只修改已证实的媒体筛选、等待或坐标换算层，不扩大浏览器协议，不读取凭据，不改变登录/验证码合同。
5. **真实验收**：使用真实 Chrome 新建一条隔离 Run，逐张检查最终 PNG；只有干净、完整图纸计为通过。

### Success criteria

- 空白或未加载轮播图、页面 UI、正文/评论面板、遮罩截图全部被拒绝。
- 每个保留资产主体完整、边界合理，视觉内容与对应图纸方向一致。
- 自动测试先红后绿；Extension/API 定向回归与必要生产构建通过。
- 真实 Chrome Run 的最终 PNG 必须逐张人工验收，不能再以 HTTP 200、文件可读、数量或 DOM 节点代替内容质量。
- 验收通过前不 commit、push、PR 或发布 `v2.2.10`。

### Current result

- 9 个错误截图与记录中的 XHS CDN URL 已逐项映射；无凭据下载全部 9 张原图后，4 张是完整图纸、5 张是弹层外招聘/邮件/聊天等无关图片，证实同时存在候选越界与 region 截图失真。
- 行为红测在旧实现准确失败：XHS note-detail 返回后台 feed 图片、当前笔记图片和整页 SVG；API 不支持从受限 CDN 保存原图。
- 最小修复后：XHS note-detail 只接受实际未被遮挡的 `img`；通过筛选且 URL 为 HTTPS `*.xhscdn.com` 的媒体无凭据下载原图并规范化为 PNG，下载失败直接跳过；普通网页和非批准媒体继续走 region 截图。
- 门禁通过：Extension 212/212、lint、typecheck、production build；API 582/582、Ruff、format、strict Mypy；packaged MV3 E2E 8/8；`git diff --check` 通过。
- 生产下载器对真实 XHS CDN URL 返回 24,612-byte WebP、尺寸 585×966；未使用 Cookie、账号或浏览器存储。
- 桌面同一候选目录已更新 `assets/content.js`，SHA-256 `BAA18814F1CF0C463FB3BB75014A45ED6A129F5877914F5BA5D768366E80A083`；新建独立 ZIP `archresearch-chrome-extension-only-v2.2.10-phase33-candidate.zip`，20,361 bytes，SHA-256 `79B6046356690F774C6B610F37AEC8F539876676D690C73D0FFDFC5B6D307536`。
- 隔离 API `18072` 已重启并加载新源码，`/health=ok/mock`；重启后扩展桥 `connected=false`，等待用户重载同一候选目录并刷新 Board。
- 用户已于 2026-08-07 手动重载 Phase 33 候选；复用既有系统 Chrome Board 标签导航到 `http://127.0.0.1:15172/?connect=chrome` 后，隔离 API 返回 `connected=true`、`xiaohongshu_search_available=true`。下一步只允许一次小红书 session POST；通过后创建唯一一条隔离图纸 Run 并逐张验收 PNG。
- 唯一一次 `POST /v1/browser/xiaohongshu-session` 于 4,779 ms 返回 `logged_in/chrome_extension`；未出现验证码、重复登录页或新 Board。下一步创建唯一一条隔离图纸 Run，等待自然终止后逐张检查最终 PNG。
- 已创建且只创建一条新隔离 Run `6e9ef544-b8af-4086-abd9-f392bf2c76ed`（HTTP 201，`visual_reference_search/balanced/xiaohongshu`）；当前等待自然终止，不重试、不并行创建。
- Run `6e9ef544-b8af-4086-abd9-f392bf2c76ed` 已自然终止为 `partial/visual_budget_exhausted`，生成 6 个本地候选，4/4 子方向有覆盖，浏览器检视 Trace 无失败。流程状态不作为视觉合格证据，下一步只做 6 张 PNG 的逐张内容验收。
- 6 张 PNG 已逐张验收：Rank 0–4 共 5 张为完整剖面/功能图/拼贴表达，无网页 UI、遮罩或错误裁切；Rank 5 是黑白室内效果图/封面，被错误接受并归入 `linework_style`，因此本轮仅 5/6 合格，Phase 33 继续 `in_progress`。
- 当前新红测目标：图纸灵感结果不得保留 `asset_type=photograph` 或明显非图纸视觉；先复现 Rank 5 的误接纳，再做最小分类/筛选修复。验收需再次创建唯一新 Run 并达到逐张全通过。
- 源码根因已定位：OpenCLI 下载分支会按当前子问题要求的图纸类型删除 mismatch，但真实 Chrome/browser 检视分支将 `inspect_source_page()` 结果直接持久化，缺少同一类型过滤，因此 `photograph` 可进入“剖面图”方向。
- 行为红测现已准确失败：真实 browser 分支完成搜索与 6 次分类后，旧实现持久化 6 个 `photograph` 候选，而预期为 0，并应清理对应临时 PNG。
- 最小实现已完成：抽取现有 requested drawing type 过滤并同时用于 OpenCLI 下载与 Chrome/browser 分支；browser 红测已转绿，6 个 photograph 均未持久化且临时 PNG 已清理。
- 相关回归 8/8 通过，覆盖 OpenCLI 原路径、搜索查询约束、requested type 过滤、Chrome 扩展累计检视、新 mismatch 红测与 XHS CDN 原图保存。
- API 全量门禁通过：583/583；Ruff check、Ruff format check、strict Mypy 与 `git diff --check` 全部通过。下一步精确重启隔离 API `18072` 加载新 workflow，正式 `9872` 不动。
- 隔离 API 已从旧 PID 28264 精确停止并由新 PID 5196 在 `18072` 健康监听，`/health=ok/mock`；Board `15172` 仍正常，正式 `9872` 未监听。
- 复用既有 Board 标签重新导航到 `http://127.0.0.1:15172/?connect=chrome` 后，`GET /v1/browser/status` 已恢复 `connected=true`、`xiaohongshu_search_available=true`。下一步只做一次重启后的 session 检测。
- 重启后的唯一 session POST 于 5,266 ms 返回 `logged_in/chrome_extension`；已创建且只创建复验 Run `ad270123-244e-4295-98c7-cef6c7bd7f86`（HTTP 201）。当前等待自然终止。
- 复验 Run `ad270123-244e-4295-98c7-cef6c7bd7f86` 自然终止为 `blocked/visual_budget_exhausted`、0 结果；Trace 与 QA events 证明失败发生在搜索页枚举连续为 0，尚未进入详情分类，因此不是新 requested type 过滤误杀。
- 下一步不创建第三条 Run；先只运行一次隔离 XHS 搜索探针确认当前枚举是否仍为 0。探针非零后才允许再次完整验收。
- 单次探针耗时 13,013 ms，仍为 `source_count=0`，同一标签多轮枚举均为 0。成功遗留搜索标签最终 URL 含 `type=51`，失败记录只保留初始无 `type=51` URL；下一步进行一次带标签 URL/标题时序观察的诊断探针，区分正常笔记页、空壳与安全限制页。
- 带观察探针确认新标签约 1.88 秒后自动进入 `type=51`，无验证码、登录页或额外 Board；13,050 ms 后仍为 0。URL 参数假设已排除。
- 隔离安全页面状态探针确认同页 `session_status=logged_in`、`page_metadata` 成功且 URL/标题正常，因此不是敏感页 fail-closed；但 `page_snapshot` 0 块、`enumerate_media` 0 项。
- Chrome 自动读取该 XHS 标签仍持续超时。当前保留新标签 `1497398350` 交给用户目视确认页面是正常图片流还是空白/异常壳；取得该证据前不改产品代码、不创建新 Run。
- 用户截图确认页面是正常图片瀑布流；用户实际打开 Chrome 后，同查询新标签在首次 3.5 秒即恢复 12/12，30 秒后仍为 12/12。等待时长和媒体结构假设已排除，根因收敛到 `active=true` 未保证宿主 Chrome 窗口恢复/聚焦。
- 当前新红测目标：仅安全的 XHS 图纸研究搜索与详情打开应恢复并聚焦其 Chrome 窗口；普通网页、小红书登录入口和验证码合同不得改变。红灯准确后再做最小实现。
- 窗口恢复红测旧实现准确失败；最小实现仅让 `active=true` 研究标签恢复 minimized 窗口、聚焦宿主窗口后再导航。后台标签路径保持无 windows API 调用。
- 定向 63/63、Extension 全量 214/214、lint、typecheck、production build、packaged E2E 8/8、diff check 全绿；候选目录与新 window-focus ZIP 已核对 manifest、文件数和哈希。
- 用户重载后，在未人工切到小红书的条件下执行单次搜索探针：4,996 ms 返回 `source_count=3`，首次枚举 11/11，滚动后 16/16，搜索标签正常关闭；窗口恢复/聚焦修复已通过真实现场验证。
- 已创建且只创建唯一完整验收 Run `50f90fc6-dae0-4d80-bc4f-0f1f72e65b87`；自然终止为 `partial/visual_budget_exhausted`，保留 7 个结果、7 个项目，4/4 子方向覆盖，`gaps=[]`、`enrichment_gaps=[]`，没有重试、取消或并行 Run。
- API、Trace、Board 与磁盘已复核：4 次 XHS 搜索均返回 8 个结果，浏览器检视事件无失败；7 个 PNG 位于 `.artifacts/qa/phase29-live/data/runs/50f90fc6-dae0-4d80-bc4f-0f1f72e65b87/candidates/`。
- 7 张 PNG 已按 rank 逐张查看：7/7 均为真正图纸或明确的剖面图解/拼贴表达，方向匹配、内容清晰；没有网页 UI、遮罩、正文/评论面板、错误的应用侧裁切或 photograph 误入。
- Rank 1 虽是局部线稿构造图且边缘包含原始卡片裁切，但用户现场截图确认该构图就是小红书原始搜索卡片，不是 ArchResearch 截图坐标失效；其线型、构造和标注仍完整支持 `linework_style` 研究，判定合格。
- Phase 33 完成。未 commit、push、PR 或发布；下一步仅在用户明确要求后准备 `v2.2.10` 的 Windows 安装器与独立扩展 ZIP 发布流程。

### Errors encountered

| Error | Attempt | Resolution |
|---|---:|---|
| 首个 API 红测使用超出 `_crop_png()` fixture 范围的 pattern 11/12，先触发 `IndexError` | 1 | 改用现有 fixture 范围内的 pattern 3/4，红灯准确收敛为缺少 `image_fetcher` 合同。 |
| Extension 回归首次 typecheck 不允许对必需 DOM 属性使用 `delete` | 1 | 测试清理改用 `Reflect.deleteProperty`；生产代码未改，随后全量门禁通过。 |
| 首次把停止与启动隔离 API 合并在一条复杂命令中被本地策略拒绝 | 1 | 重新核对 PID 与命令行，分步停止精确 QA PID、再隐藏启动 18072；正式服务未触碰。 |
| 搜索既有 QA 启动环境变量的 `rg` 命令无匹配并返回 1 | 1 | 直接读取 `live_xiaohongshu_harness.py` 的必需环境变量后启动，不重复无结果搜索。 |
| 恢复时首个 PowerShell 计划片段命令因嵌套双引号提前展开变量而解析失败 | 1 | 改用单引号脚本和 `rg`/固定行号读取；只读失败，未修改项目。 |
| 首次按 `^## Phase 33` 查找阶段未命中，因为实际标题为一级标题 | 1 | 先用 `rg -n "Phase 33"` 定位，再从精确行号读取到文件末尾。 |
| 首次同时补写三个规划文件时，`findings.md` 末尾锚点不匹配，补丁整体未应用 | 1 | 分文件使用各自真实末尾锚点追加，避免部分写入。 |
| 首次用默认 `rg --files .artifacts` 定位新 Run 图片时，被 `.gitignore` 排除并返回 1 | 1 | 改用 `rg --files --hidden --no-ignore .artifacts`，成功定位 6 个候选 PNG。 |
| 首版 browser mismatch 红测使用 `max_pages=1`，没有进入浏览器检视，导致假绿 | 1 | 增加搜索、browser calls 和 classifier calls 前置断言，并将页面预算改为 12；旧实现随后准确失败为持久化 6 个 photograph。 |
| 尝试用内联 Python 读取失败测试 SQLite 时，命令行 SQL 引号产生 `SyntaxError` | 1 | 不重复该命令，改由测试自身输出 Trace 与 browser/classifier 调用证据。 |
| 搜索 `browser_client` 重新赋值无匹配，`rg` 返回 1 | 1 | 结合初始化源码确认没有重赋值；未把无匹配当成产品错误。 |
| 首次并行全门禁因 Ruff format check 报 `workflow.py` 需格式化而提前结束，其他并行结果未可靠收集 | 1 | 仅对该文件运行 Ruff formatter，随后重新执行全部门禁。 |
| 一次缺少函数上下文的测试补丁误把两个既有测试的 `max_pages=1` 改成 12 | 1 | 通过精确搜索定位并按函数名恢复两处原值；相关回归 8/8 通过。 |
| 两次用于定位测试预算的只读搜索因正则/PowerShell 引号错误失败 | 2 | 改用简单 `rg -n -C` 搜索 `max_pages` 并人工核对上下文，不重复错误表达式。 |
| 首次把隔离 API 启动与健康轮询合并成一条复杂命令时被本地策略拒绝 | 1 | API 当时已安全停止但未错误启动；随后拆成隐藏启动与独立健康/端口检查两步，18072 恢复正常。 |
| 尝试截图既有 XHS 搜索页时 Chrome 控制调用超时并重置浏览器控制会话 | 1 | 未重复 DOM/截图路径；保留 API Trace 与 QA media_count=0 作为诊断证据，改用单次产品搜索探针。 |
| 本次通过 Chrome 控制取得既有 XHS 标签绑定时再次超时并重置控制内核 | 1 | 未继续调用截图、DOM、evaluate 或标签接管；改用隔离 QA harness 对现有受限内容命令做安全状态区分。 |
| planning-with-files 首次 catchup 命令因嵌套 PowerShell 引号把脚本参数解析为 `C:\` 而失败 | 1 | 改用外层单引号的 `pwsh -Command` 调用后成功恢复未同步上下文；未修改项目状态。 |
| 隔离页面状态探针首次调用 API 未枚举的 `viewport_metrics`，路由返回 500 | 1 | 删除该动作，复用已枚举的 `page_metadata`、`page_snapshot` 与 `enumerate_media`；修正后探针完整返回。 |
| 首次重启隔离 API 误用缺少 `uvicorn` 的 Codex runtime Python，健康检查超时 | 1 | 读取 stderr 确认 `No module named uvicorn`，改用项目 `apps/api/.venv/Scripts/python.exe` 后恢复；正式服务未触碰。 |
| 窗口恢复实现后的首次 TypeScript 检查不接受裸字符串 `normal`，且背景入口测试桩缺少 `windows` | 1 | 按现有 Chrome 枚举类型收窄状态值，并补齐测试桩；随后 typecheck、lint、定向与全量测试全部通过。 |
| 隔离 API 重启后尝试读取重启前保留标签返回 `execution_failed` | 1 | 确认标签不再属于新 broker 的受管会话；改为同一 API 会话内新建、延迟枚举并自动关闭，首次/30 秒均得到 12/12。 |
| 恢复后首次组合读取服务与 Run 文件时，外层 PowerShell 提前展开传给 `pwsh -Command` 的变量，导致哈希表解析失败 | 1 | 改用单引号包裹完整 `pwsh` 脚本并在内部使用双引号；第二次只读检查成功，未修改项目或服务。 |

# Phase 34 — 建筑研究发布前真实回归

Status: **complete**

目标：在 Phase 33 图纸灵感修复完成后，创建且只创建一条隔离的 `precedent_research` Run，确认建筑研究的搜索、正文分析、证据绑定、覆盖检查与 Board 结果未受影响。

1. 确认隔离 API 健康、没有活动研究租约，并从现有数据选择一条代表性建筑研究问题。
2. 创建唯一一条建筑研究 Run，不重试、不取消、不并行创建，等待自然终态。
3. 检查 Run、Results、Trace 与 Board：正式事实需有 evidence claims 和真实来源；不得把图纸灵感的 XHS-only 行为带入建筑研究。
4. 不修改生产代码、不触碰正式 `9872`、不 commit、push、PR 或发布。

### Success criteria

- Run 能自然进入终态并保留可用建筑案例结果。
- 建筑研究子问题有覆盖，正式结论绑定来源证据；结果不是小红书图纸卡片或无证据的视觉描述。
- Trace 中没有因 Phase 33 窗口聚焦、XHS 原图下载或 requested drawing type 过滤造成的建筑研究失败。

### Current result

- 代码边界复核确认 requested drawing type 过滤只在 `visual_reference_search` 生效；XHS 原图下载只允许小红书详情页和 `*.xhscdn.com`；普通网页标签仍为后台路径。
- 建筑研究专项自动回归 5/5、扩展窗口与标签行为回归 61/61 通过。下一步检查活动租约并创建唯一真实建筑研究 Run。
- 已创建且只创建建筑研究 Run `6d540f6f-d54d-4ada-86e5-d40bd9bcddd7`，HTTP 201，初始状态 `created`；不重试、不取消、不创建并行任务。
- 虽然请求省略 `research_sources`，响应按当前模型默认规范化为 `[xiaohongshu]`。对 `precedent_research` 而言 XHS 不是强制/XHS-only；最终需从 Trace 确认正式案例和证据仍来自建筑研究路径。
- Run 已自然终止为 `completed/coverage_satisfied`：12 个资产、4 个项目、12 个 verified/partial，4/4 子问题覆盖，`gaps=[]`、`enrichment_gaps=[]`。
- 12/12 结果各含 2 个 facts 和 3 个 EvidenceClaims；正式案例来自 Mock Provider 的 primary/trusted-secondary 演示来源。Trace 中可选 XHS 搜索因 browser unavailable 被跳过，但未阻塞建筑研究，符合既有 optional-source 合同。
- Board 真实验收未通过：主页存在该 Run 卡片并可点击，进入后却只显示“从一个具体设计问题开始”的空状态，没有渲染 4 个案例/12 个结果；浏览器 console/pageerror 均为 0。
- 空状态已确认是验收脚本只等待 700 ms 导致的时序误判，不是产品 bug。等待 Results 请求完成后，Board 正常显示 4 个子问题、4 个项目、4 个出处和 4 组“怎么做”策略。
- 最终 Board 截图为 `.artifacts/qa/phase34-architecture-board-loaded.png`。唯一浏览器 console 信号是新 Board 的 style-profile GET 返回 404；下一步只读确认该 404 是否为前端明确接受的“尚未生成风格档案”状态，再决定 Phase 34 是否完成。
- style-profile 404 已确认是明确设计合同：API 在尚未创建档案时返回 404，Board client 捕获该状态并转换为 `null/defaultStyle`，相关测试也固定覆盖，不属于建筑研究失败。
- 最终 Board 截图逐项验收通过：研究任务、4 个子问题、4 个不同案例、4 个来源、4 组迁移策略和底部对照/导出/分享入口均正常显示。
- Phase 34 完成：当前 Phase 33 修复未影响建筑研究工作流。该结论覆盖确定性 Mock Provider 的完整功能/数据合同；真实 BYOK Provider 与互联网内容质量仍需在正式安装版配置 Key 后单独验收。

### Errors encountered

| Error | Attempt | Resolution |
|---|---:|---|
| 本机没有 `sqlite3` CLI | 1 | 未安装或改动环境；准备使用项目 Python 只读查询。 |
| 两种内联 Python/嵌套 PowerShell 写法分别被 PowerShell 与工具命令解析器拒绝 | 2 | 停止重复本地数据库查询；隔离库已确认无活动租约，改用符合产品合同的代表性建筑更新问题，不再为复用旧题增加风险。 |
| Board 无头检查从 `apps/board` 直接 `require("playwright")` 失败，随后依赖搜索命令又因正则在 PowerShell 中被误解析 | 2 | 未重复相同命令；先用无复杂正则的 `rg playwright` 定位实际依赖位置，再从已有测试运行时执行 Board 检查。 |
| `apps/extension` 声明 `@playwright/test`，但直接 `require("playwright")` 同样不可解析 | 1 | 不安装依赖；改用包实际声明的 `@playwright/test` 导出或仓库 `pnpm exec` 运行时。 |

# Phase 35 — 建筑与图纸完成状态、停止文案及预算修复

Status: **complete**

目标：修复建筑研究与图纸灵感把“核心方向已经覆盖、但富集数量目标未满”误判为 partial 的问题；停止原因必须反映真实耗尽的预算，同时适度提高两类研究的默认执行预算。

1. **合同审计**：定位两类深度预算、覆盖/富集目标、最终状态判定、停止原因和 Board 文案的完整链路。**已完成**
2. **行为红测**：先覆盖“核心覆盖完整且无 gaps，但富集数量不足时应完成”，以及“预算确实耗尽且仍有覆盖 gaps 时应保留真实 partial 原因”；同时锁定新预算合同和 Board 文案。**已完成**
3. **最小实现**：分离基础覆盖与富集目标，只在视觉调用数/字节数真实耗尽时使用 `visual_budget_exhausted`；建筑研究沿用对应真实预算原因；两类默认预算仅小幅提高。**已完成**
4. **静态与全量验证**：运行 API/Board 定向测试、完整测试、lint、format、strict typecheck、生产构建及 `git diff --check`。**已完成**
5. **现场验收**：重启隔离 API 后各创建且只创建一条建筑研究和图纸灵感 Run，等待自然终态；核对状态、停止原因、覆盖、结果、Trace 与 Board，图纸结果继续逐张验收 PNG。**已完成**
6. **路径硬隔离**：建筑 API 禁止视觉平台来源；workflow 对建筑旧 Run/重试忽略遗留 XHS 标记，并过滤 Provider 返回的 XHS 候选。图纸现有 XHS-only 流程保持原实现并单独回归。**已完成**
7. **旧策略分离**：将“是否还能搜索、如何补查、无分支时为何停止”按 goal 明确分流。建筑保留公开检索/Provider 恢复策略；图纸在首轮 XHS 搜索后仍有未覆盖方向且预算充足时允许后续 XHS 补查，绝不调用建筑 Provider。**已完成**
8. **物理代码分离**：把建筑研究与图纸灵感的来源许可、补查策略、查询生成、停止判定和终态判定迁入两个独立模块；共享 workflow 只保留数据库、证据绑定、checkpoint 与持久化骨架。先用结构/行为红测锁定边界，再迁移生产代码。**已完成**

### 物理执行拆分补充

- 当前状态：**completed**。`execute_research_run` 现在只按 goal 分发一次，不再在公共入口中选择策略或混传依赖。
- `precedent_runner.py` 只接收公共页面解析器并显式置空视觉平台搜索；`drawing_runner.py` 只接收视觉平台搜索并显式置空公共页面解析器。数据库、证据、预算、checkpoint 和持久化底座继续共用。
- 结构红测、核心 API 回归和静态门禁均已转绿；后续禁止在共享底座中新增跨路径搜索分支，应把新行为放入对应 runner/policy。

### Success criteria

- 建筑与图纸在核心问题/方向全部覆盖、`gaps=[]` 时均为 `completed/coverage_satisfied`，不因富集数量不足误标 partial。
- `visual_budget_exhausted` 只在视觉调用次数或字节数真实达到上限且任务仍未覆盖时出现；Board 不再为未耗尽预算显示“达到上限”。
- 建筑研究真实耗尽查询、页面或时间预算且仍有覆盖 gaps 时，继续显示准确的 partial 原因。
- 建筑检索/页面/时间预算和图纸帖子检查/视觉调用/字节预算提高约 15%–25%，不改变 BYOK、本地优先、XHS-only、单活 Run 与证据绑定合同。
- 自动测试先红后绿；两条隔离现场 Run 均通过内容和状态验收后才结束。未经用户明确授权，不发布 `v2.2.10`。
- 建筑 Trace 的 `xiaohongshu_search` 必须为 0；图纸 Trace 不得调用公共网页或建筑 Provider 作为降级来源。
- 建筑专用模块不得导入小红书实现；图纸专用模块不得启用公共检索、建筑 Provider 或建筑恢复轮次。共享入口只负责按 goal 选择一次路径策略。

### Errors encountered

| Error | Attempt | Resolution |
|---|---:|---|
| 首次尝试同时更新四个规划文件时，`findings.md` 末尾锚点不匹配，补丁整体未应用 | 1 | 按各文件真实末尾分别追加；生产代码、测试和规划文件均未被部分写入。 |
| 现场端口盘点命令在 `foreach` 块后直接接管道，PowerShell 报 empty pipe element | 1 | 改为先将进程对象收集到数组再格式化输出；命令在解析阶段失败，未触碰任何进程。 |
| Chrome 控制首次连接及等待 2 秒后的唯一重试均返回 `Browser is not available: chrome` | 2 | 按 Chrome 故障诊断完成只读检查：Chrome 已安装、ChatGPT 浏览器扩展已启用、native host 正确，但 Chrome 进程当前未运行；等待用户授权启动 Chrome 后继续，不替换浏览器。 |
| 首条 Phase 35 建筑现场 Run 为 `blocked/browser_inspection_incomplete`，尽管 12 个结果已覆盖 4/4 子问题 | 1 | Trace 证明隔离 Mock Provider 的 `research.example` 假域名在 Chrome 已连接时被真实导航安全检查拒绝；只修改忽略目录中的 QA harness，将该假来源映射到可公开解析的 `example.com` 测试页，产品安全策略和生产代码保持不变。 |
| 修正 harness 后的建筑 Run 意外执行 4 次小红书搜索，并混入 5 条 XHS 候选 | 1 | 手动验收请求漏传 `research_sources`，后端 schema 又把默认值设为 `[xiaohongshu]`；Board 正常建筑请求本已显式发送 `[]`。新增红测要求 API 默认来源为空，再做最小 schema 修复，图纸仍显式使用 XHS-only。 |
| 路径隔离后的首次 API 全量回归有 2 个旧测试失败 | 1 | 两个测试验证的都是 XHS 多图/浏览器回退，却沿用默认 `precedent_research`；改为明确的 `visual_reference_search`，并新增 Provider 零调用断言，不恢复建筑/XHS 混合路径。 |
| 分离后的首条图纸现场 Run 为 `blocked/no_usable_assets` | 1 | Trace 证明图纸严格停留在 XHS-only，Mock/公共检索均 skipped；真实失败是同一搜索标签连续媒体枚举为 0，第二次搜索后扩展返回 `execution_failed`。下一步只做一次安全页面状态探针，先排除验证码并保留验证页，不直接重试 Run。 |
| 恢复后首次只读查询把不存在的 `/v1/runs/{id}/trace` 与有效端点放在同一 try 块，整体显示 404 | 1 | 不重复猜端点；从 FastAPI 路由确认 Trace 通过 `/v1/runs/{id}/events` SSE 提供，再分别读取 Run、Results 与 Events，未修改服务或数据。 |
| 新图纸补查红测首次只创建 2 个子方向，先触发 `ResearchPlan` 至少 3 项的 schema 校验 | 1 | 补成 3 个方向：两个首轮成功、一个首轮失败；随后旧实现准确失败为只搜索首轮 3 次，没有执行第 2 轮缺口补查。 |
| 策略分离后的首次 API 全量为 579 passed / 6 failed | 1 | 5 项测试仍让 visual goal 依赖普通 Provider/公共网页，1 项固定断言每方向只搜一次；不恢复混合路径。导出测试改为独立准备结果夹具，公共网页视觉批处理归回建筑 goal，XHS 浏览器测试更新为 quick 两轮合同。 |
| 公共网页批分类测试首次归回建筑 goal 后仍把来源设为 unknown，随后改为可信来源但旧查询只筛 visual_lead | 2 | 建筑对 unknown 不花视觉预算是既有安全合同；可信项目页分类结果应为 `partial` 且项目归属已确认。测试改为按远程图片 URL 定位该资产，并断言建筑证据等级，不恢复 visual generic 路径。 |
| 中断后的 QA API 重启首次误用无 `uvicorn` 的 Codex runtime Python，随后复杂启动命令又被策略拒绝 | 2 | 数据库无活动 Run。改用项目 `apps/api/.venv` 分步隐藏启动并单独检查健康；18072 恢复 `ok/mock`。 |
| 物理拆分规划补丁首次使用了不存在的 findings 末尾锚点 | 1 | 改为先定位真实末尾，再分别追加规划记录；没有造成部分写入。 |
| 一次 PowerShell `rg` 正则转义错误 | 1 | 改用单引号包裹的固定字符串模式；未修改文件。 |

### 2026-08-08 — isolated end-to-end verification

- 隔离 API/Board 已按最新工作树启动；建筑 Run `18c6edd1-3361-4e66-9869-c6305c3d759d` 由 Board 创建并通过 `completed/coverage_satisfied`，Trace 中 XHS 为 0。
- 图纸 Run `f09b3e6c-695a-4076-9d9a-81e501b81c00` 由 Board 创建并确认 XHS-only 分流，但 6 次搜索全部媒体枚举为 0，终态 `blocked/no_usable_assets`，没有 PNG。
- 该失败发生在扩展媒体枚举层，未进入图纸质量分类，也不是建筑路径串线、公共搜索降级或预算误判。
- 当前唯一下一步：用户先在 Chrome 加载/重载桌面候选扩展 `C:\Users\76384\Desktop\Archsearch\archresearch-chrome-extension-only-v2.2.10-phase33-windowfocus-candidate.zip`，随后只创建一条新的图纸现场 Run；未经复验通过，不更新 Phase 35 为 complete、不发布 `v2.2.10`。

### 2026-08-08 — 用户授权先发布再复验

- 用户明确要求先发布 `v2.2.10`，再用发布版扩展复验图纸灵感；因此现场图纸 Run 仍为 `blocked/no_usable_assets` 不再阻止发布流程。
- 发布范围限定为当前产品代码、测试、用户文档和 CI/Release 合同；`.planning/`、QA 数据、桌面候选 ZIP 及本地研究资料不纳入提交。
- 版本红测已先将 Release 合同提升到 `2.2.10` 并准确失败于旧 CI artifact 名；随后 API、Board、Extension、manifest、CI、README、安装说明和 Release 测试已同步到 `2.2.10`，合同测试转绿。
- 发布前唯一门禁：完整本地测试、静态检查、两个独立构建附件、安装 smoke；发布后只创建一条新的图纸现场 Run。
- 首次完整门禁在 API 594/594 后只因版本同步造成的两个 Python 文件格式检查失败；Ruff 机械格式化 `__init__.py` 与 `main.py` 后重新运行全量门禁通过。
- 独立扩展 ZIP 与 Windows 安装器均已构建；安装器自检、Inno Setup 编译和真实安装/启动/卸载 smoke 全部通过。

### 2026-08-08 — v2.2.10 发布完成

- 最新提交 `81087c4` 已推送，PR #22 已 squash 合并到 `main`，合并提交为 `a2ff995bfed696980df61962ca592f2a2b56d5d6`。
- 主线 Hosted CI run `31245075246` 成功；完整门禁、两个独立附件构建、Windows 安装/启动/卸载 smoke 和附件上传全部通过。
- annotated tag `v2.2.10` 已推送，正式 Release 已发布且为非草稿、非预发布；Release 附件 digest 已与主线 CI 下载文件核对一致。
- Phase 35 仍保持 `in_progress`：建筑现场已通过，图纸现场尚未通过。下一步确认 Chrome 实际加载正式 `v2.2.10` 独立扩展后，只创建一条图纸现场复验；发布前失败 Run 不重试、不取消。

### 2026-08-08 — 线程切换收口

- 发布说明已修正为多行 Markdown，Release 附件、tag 和主线提交未改变。
- 产品发布阶段完成；四个本地交接文件、`.artifacts/ci/` 和 `.planning/submission-pack-2026-08-06/` 保留为本地上下文与证据，不纳入产品提交。
- Phase 35 继续保持 `in_progress`，唯一后续动作是加载正式 `v2.2.10` 扩展并只创建一条图纸现场复验。

### 2026-08-08 — installed release replaces QA as acceptance target

- 已确认唯一验收对象为实际安装的 `ArchResearch.exe` `2.2.10`，动态端口 `9325`；QA `18072` 不再用于验收结论。
- 安装版唯一 Run `d1c0f6f9-1933-47a2-a0df-08e00c3eb836` 搜索链路正常，但 20 次浏览器检视均为 `ValidationError`，终态 `blocked/no_usable_assets`。该 Run 保留，不重试、不取消、不创建第二条。
- 桌面正式扩展目录与主线发布 ZIP 11/11 哈希一致；登录态探针为 `logged_in/chrome_extension`。下一阶段转为安装版协议诊断，重点是 `MediaEnumeration` 校验字段或活动扩展实例版本证据。

### 2026-08-08 — sanitized installed-protocol diagnostics

- 行为红测用非法 `MediaEnumeration.media[0].intrinsic_width` 复现生产现场同类 `ValidationError`；旧实现准确在 `validation_model` 断言处失败。
- 最小实现只扩展既有 `browser/skipped` Trace：记录 `validation_model`、`validation_path`、`validation_error`，并显式排除 Pydantic `input` 与错误 URL。非 Pydantic 异常和浏览器执行策略均未改变。
- 新测试、完整浏览器检视回归和 API 全量通过；Ruff、70 文件格式检查、strict Mypy 32 个源文件及 `git diff --check` 全绿。
- Phase 35 继续 `in_progress`。下一步构建并覆盖安装诊断版，确认实际安装进程加载补丁后再做协议诊断；重新安装前不创建新 Research Run。

### Diagnostic errors encountered

| Error | Attempt | Resolution |
|---|---:|---|
| 首次分支项目去重红测为同一来源重复使用完全相同的图片 URL，先触发 `asset_candidates` 唯一约束，未到达待测 coverage 行为 | 1 | 不采用该失败；给第二组同源资产使用不同图片 URL，保留相同 `project_name` 与分支分析后重跑。 |
| 首次并行路由检索用双引号包裹含 `|` 的 PowerShell 正则，触发 ParserError | 1 | 改用单引号并拆分 workspace/run 路由模式；命令在解析阶段终止，未访问服务或数据。 |
| 首次定向测试命令在 `apps/api` 工作目录下重复拼入 `apps/api`，解释器路径不存在 | 1 | 改用当前目录的 `.venv/Scripts/python.exe`，红测随后准确执行并失败。 |
| 最小实现首次 strict Mypy 将摘要推断为 `dict[str, str]`，不兼容 `checkpoint` 的 `dict[str, object]` | 1 | 只增加显式 `dict[str, object]` 注解；运行时逻辑未改，定向测试和全部静态门禁随后通过。 |

### 2026-08-08 — installed protocol root cause

- 诊断安装版只创建一条 quick 图纸 Run `99670d73-73fd-4e5a-8d80-c3ff4818cdd2`；自然终止为 `blocked/no_usable_assets`，15/15 浏览器事件均为 `ValidationError`，0 结果。
- 安全 Trace 摘要把根因收敛为 `BrowserCommand`、`action`、`literal_error`；没有记录非法动作值。源码映射确认详情打开路径调用 `open_xiaohongshu_note`，扩展已有该动作，但 API 枚举缺失。
- 先写协议红测再实现：增加严格 XHS search/note URL payload，恢复 API 与扩展的既有固定协议边界；API 全量、browser/XHS 回归、Ruff、format、strict Mypy 和 diff check 全部通过。
- 当前下一步：重新构建并覆盖安装当前协议修复；确认安装版健康、桥连接和 `logged_in/chrome_extension` 后，只 retry `99670d73-73fd-4e5a-8d80-c3ff4818cdd2` 一次进行最终安装版验证，不创建第三条 Run。

### 2026-08-08 — installed detail-path validation fix

- 唯一 retry 已执行且自然终止；旧 `BrowserCommand.action/literal_error` 为 0，但 15/15 真实 `/search_result/<note-id>` 详情 URL 被新 payload validator 以根级 `value_error` 拒绝。
- 红测使用 Trace 中的实际详情 URL 准确复现；生产修复只分离搜索页精确路径与固定详情前缀语义，安全主机、HTTPS、无凭据和枚举动作边界保持。
- 定向回归 57/57、API 全量 600/600、Ruff、71 文件 format、strict Mypy 32 源文件和 diff check 全绿。
- 新安装器已覆盖实际安装目录，SQLite 哈希不变，已安装 EXE 与冻结构建哈希一致；当前安装版运行在 `7016`，健康、自检、桥和 `logged_in/chrome_extension` 均通过。
- Phase 35 继续 `in_progress`。产品没有安装版详情 QA 路由，隔离 harness 不可替代验收；目标 Run 已用完约定的一次 retry且仍为 `attempt=1`。
- 当前唯一下一步：用户明确允许一次额外 attempt 或新 Run 后，使用当前安装版完成真实详情打开、页面元数据、媒体枚举和 PNG 逐张验收；未授权前不再创建或重试 Run。

### Detail-path diagnostic errors encountered

| Error | Attempt | Resolution |
|---|---:|---|
| 根目录 `.venv` 不存在，首次红测未执行 | 1 | 改用项目 `apps/api/.venv/Scripts/python.exe` 后，红测准确失败并完成红绿修复。 |
| 两次 retry Trace 时间筛选误得 0 | 2 | PowerShell 7 已把 `created_at` 转成 `System.DateTime`；改按 DateTime 字段切分，得到正确 58 个 retry 事件。 |
| 安装前并行哈希脚本存在 PowerShell 空管道语法错误 | 1 | 拆成简单只读命令；解析失败发生在停止进程前，未改应用或数据库。 |
| 启动轮询误用不存在的 `/v1/health` | 1 | 保留已启动的唯一进程，改用正确 `/health`；确认服务实际健康，没有重复启动。 |
| 误用不存在的 `GET /v1/runs` 后输出伪 `RunCount=0` | 1 | 作废该计数，改用真实目标 Run 端点确认数据仍在、状态 blocked、attempt=1。 |

### 2026-08-08 — extension detail-link execution fix

- 用户完成安全验证后，安装版 session 一次确认返回 `logged_in/chrome_extension`；未刷新或重复开页。
- attempt 2 Trace 确认 API `BrowserCommand` 校验错误为 0，但 5 个详情打开为扩展 `BrowserCommandError`；源码红测锁定完整 href 比较无法匹配带查询 token 的同一路径详情卡片。
- 内容脚本最小修复和红测已完成；Extension 215/215、lint、typecheck、build、packaged E2E 8/8 全绿。
- 新候选 ZIP 已生成但尚未加载到 Chrome；未创建新 Run。Phase 35 继续 `in_progress`。
- 当前唯一下一步：用户加载/重载候选 ZIP 后，只做一次安装版 session 确认；是否执行新的真实详情/媒体现场验证需再次明确授权。

### 2026-08-08 — candidate extension loaded

- 用户已加载候选扩展；安装版 session 一次确认返回 `logged_in/chrome_extension`。
- 现有 Run 已到 `attempt=2`，扩展详情链接修复尚未经过真实现场 Run；Phase 35 继续 `in_progress`。
- 当前唯一下一步：等待用户明确授权一次新的安装版现场 Run 后，执行 XHS-only 详情/媒体链路并逐张验收 PNG；不继续 retry 旧 Run。

### 2026-08-08 — authorized installed run completed

- 用户明确回复“创建”后，只创建安装版 Run `0633b2a4-b76a-458d-bf00-6beab6a19458`，参数为 `visual_reference_search`、`quick`、`research_sources=[xiaohongshu]`。
- Run 自然终止为 `blocked/no_usable_assets`；Trace 58 条，5 次 XHS 搜索，15/15 详情检视为 `BrowserCommandError`，API `BrowserCommand` 校验错误为 0，0 结果、0 PNG。
- Phase 35 仍为 `in_progress`。现场 Run 不再创建或 retry；下一步是扩展详情命令层的只读定位，或在修复后获得新的现场授权。

### 2026-08-08 — canonical detail path fix

- 只读 Trace 时间间隔将问题定位到扩展点击后的详情 URL 等待；新增红测先准确复现跨批准详情前缀的同一 note ID 被旧逻辑拒绝。
- 最小修复完成：`isSameXiaohongshuNote()` 只接受同源且 note ID 相同的批准详情路径，保持 fail closed。
- Extension 全量 `216/216`、静态门禁和 packaged E2E `8/8` 完成；候选 ZIP 已生成但尚未加载。
- Phase 35 仍为 `in_progress`。不创建新现场 Run；加载候选后先做安装版 session 确认，现场复验需用户另行授权。

### 2026-08-08 — canonical candidate loaded and authorized field run

- 候选重载后，安装版一次正确 session POST 返回 `logged_in/chrome_extension`；用户明确授权新现场 Run。
- 创建前活动 Run=0；只创建 `e41c3560-ead1-42e4-8960-f3791abdd42d`，当前为 `inspecting`，未出现安全验证。
- Phase 35 仍为 `in_progress`。下一步只等待该 Run 自然终态并审计详情元数据、媒体枚举与 PNG。

### Additional diagnostic error

| Error | Attempt | Resolution |
|---|---:|---|
| Session probe first used GET and returned 404 | 1 | Read the source route and used its declared POST method once; returned `logged_in/chrome_extension`. No Run or browser state changed. |
| 恢复后的并行只读搜索包含不存在的 `apps/desktop` 路径，导致该组 `rg` 以非零码结束 | 1 | 改为只查询已确认存在的 `apps/api` 与 `scripts` 路径；未修改文件、应用、Run 或数据库。 |
| Python 标准库只读 SQLite 查询在打印含 `➕` 的帖子标题时触发 GBK `UnicodeEncodeError` | 1 | 数据库查询已完成但输出阶段失败；固定该子进程 `PYTHONIOENCODING=utf-8` 后重跑只读查询，不改变数据库。 |
| Results/coverage 统计差异日志补丁因 `progress.md` 锚点空格不一致而未应用 | 1 | 读取两份日志精确末尾后分别追加；首个补丁整体失败，没有部分写入。 |
| 用户连续中断后先前浏览器绑定已失效 | 1 | 重新建立只读安装版 Board 浏览器连接并完整读取新绑定文档；Run、服务和数据未受影响。 |
| 恢复后的并行 Board 检索包含不存在的 `apps/board/tests` | 1 | 改为只查询实际存在的 `apps/board/src` 测试；未修改文件、应用、Run 或数据库。 |
| 把 `ResultViews.test.tsx` 误认为存在同名生产组件 `ResultViews.tsx` | 1 | 使用 `rg --files apps/board/src/components` 定位真实组件 `VisualInspirationBoard.tsx`；未修改文件。 |
| 导出合同检索包含不存在的 `apps/api/src/archresearch_api/exports.py` | 1 | 改为只读取实际承载导出实现的 `api.py`；未修改文件、应用或数据。 |

### 2026-08-08 — installed field acceptance complete

- 实际安装版 Run `e41c3560-ead1-42e4-8960-f3791abdd42d` 自然终止为 `completed/coverage_satisfied`、`attempt=0`；18 个 usable assets、9 篇来源帖子、3/3 方向，`gaps=[]`、`enrichment_gaps=[]`。
- 3/3 XHS 搜索与 10/10 详情检视完成；`BrowserCommandError=0`、Pydantic/协议错误=0、`verification_required=0`。累计 28 次视觉调用、5,082,606 bytes 预览。
- 逐张审计确认 Rank 0-17 即 18 个 usable assets 为 18/18 合格；Rank 18-19 不合格但均为 `relevance=0`，未进入 usable 统计。
- Board 首页显示 18 张参考，详情页明确显示“18 条可用参考 · 2 条只作线索”；控制台 error/warn 为 0。
- 产品合同与 Git 历史确认低相关候选继续显示属于既有线索保留语义：completion-first 合同显式区分全部持久化 Results 与 usable 结果，视觉灵感板显示自然语言相关度，导出只读取用户明确选择的资产。不存在要求自动隐藏 `relevance=0` 的更晚合同。
- Phase 35 验收口径因此为 18/18 usable 视觉结果，而不是全部持久化候选 20/20。建筑与图纸两条现场路径、自动门禁、安装版链路和 Board 均已完成，本 Phase 关闭。

# Phase 36 — 前期建筑研究召回与案例准入放宽

Status: **complete**

目标：解决建筑研究经常只交付部分结果的问题。前期方案研究应优先召回能回答空间关系、使用体验和环境联系的真实案例，不因建筑类型、项目尺度或分析字段过度严格而把可迁移案例全部挡掉；来源真实性、正文证据绑定和建筑尺度边界继续保持。

1. **真实 Run 诊断（complete）**：定位截图对应的实际安装版 Run，核对问题、模式、终态、`gaps`/`enrichment_gaps`、查询、候选筛选、页面分析与拒绝原因。verify: 能用 Trace 数量解释 6 条参考、2 个项目和未覆盖分支分别在哪一层损失。
2. **准入合同审计（complete）**：读取 planner、查询生成、候选 rerank、公共页面分析、正式案例提升和完成判定；区分可放宽的前期类比条件与不可放宽的来源/证据安全条件。verify: 每个拟调整阈值都有真实 Run 证据。
3. **行为红测（complete）**：加入“建筑类型或尺度不同，但空间机制直接回答问题且正文证据完整时可进入正式候选”的失败测试；同时锁定房间、家具、临时装置、无正文证据和视觉相似项仍不能完成建筑分支。verify: 旧实现准确失败于目标准入条件。
4. **最小实现（complete）**：仅放宽已证明过严的候选/文章语义门槛或查询措辞，不降低 `relevance >= 2`、可信 HTTP 来源、逐字 EvidenceClaim、项目正文与分支分析要求。verify: 红测转绿且安全反例保持绿。
5. **自动验证（complete）**：运行建筑路径定向测试、完整 API、Ruff、format、strict Mypy、Board 相关测试与 `git diff --check`。verify: 全部退出码为 0。
6. **实际安装版验收（complete）**：构建并覆盖实际安装版，保护 SQLite；只创建一条代表性建筑研究 Run，等待自然终态并审计覆盖、案例质量、Trace 与 Board。verify: 不调用小红书，至少不再因已放宽条件重复出现同类空白；逐案例人工核对仍为建筑尺度且对前期设计有可迁移价值。

### Success criteria

- 先用截图对应的真实 Run 证明根因，不能把 partial 简单归因于“筛选严格”。
- 前期研究允许跨建筑类型、相近尺度和机制类比，只要正文明确描述与当前问题直接相关的空间组织、使用或环境机制。
- 房间、家具、产品、临时装置、纯视觉图集、无项目正文或无逐字证据的来源不得成为正式建筑案例。
- 建筑路径继续保持 `xiaohongshu_search=0`，不恢复通用视觉平台、平台案例库或多 Agent 运行时。
- 不篡改既有 Run；现场复验只创建一条新 Run，不 retry、不并行创建。

### Errors encountered

| Error | Attempt | Resolution |
|---|---:|---|
| 首次并行路由检索在 PowerShell 双引号正则中包含 `|`，触发 `ParserError` | 1 | 改用单引号并拆分模式；命令解析阶段终止，无状态改动。 |
| `session-catchup.py` 首次通过嵌套 `$env:USERPROFILE` 引号调用时，Python 将目标误解析为 `C:\` | 1 | 改用显式绝对脚本路径和工作区路径后成功恢复；首次命令未改文件。 |
| 活动阶段提取错误假设标题为 `## Phase 36`，`rg` 无匹配并返回 1 | 1 | 先检索阶段号，确认实际标题为 `# Phase 36`，再按行号读取完整阶段。 |
| 恢复期间误触 Default mode 不可用的 `request_user_input`，随后对不存在的 cell 发出无效 `wait` | 1 | 停止该工具路径，改回普通只读 shell 调用；未请求用户输入、未运行后台任务或改状态。 |
| 读取建筑预算源码前再次误触不存在的 `wait` cell | 1 | 立即停止无效等待并使用普通只读 shell；没有后台任务、应用调用或状态改动。 |
| 安装版数据目录首次只读列举使用双引号 `pwsh -Command`，外层 PowerShell 提前展开 `$candidate`，导致空路径错误 | 1 | 改用单引号包裹命令后确认数据库路径；首次命令未读取文件内容、未写数据。 |
| 首次输出 `source_pages` 时 Python stdout 使用 GBK，遇到标题字符 `ç` 触发 `UnicodeEncodeError` | 1 | 显式将 stdout 配置为 UTF-8 后成功；SQLite 始终以 read-only URI 打开，无数据改动。 |
| 首次生产 `apply_patch` 同时修改三文件时，Provider 提示词上下文未精确匹配，补丁校验失败 | 1 | 补丁整体未应用；改为按文件使用更小的精确上下文。 |
| 自动回归前误触 Default mode 不可用的 `request_user_input` | 1 | 未向用户显示问题或暂停任务；改回顺序运行只读测试命令。 |
| 首次 Ruff format check 报告本轮 4 个 Python 文件需要格式化 | 1 | 仅对报告的 4 个文件运行 Ruff formatter，再重跑测试与 format check。 |
| Windows 构建入口检索把不存在的根 `pyproject.toml` 也列为搜索路径，`rg` 在输出有效命中后返回 1 | 1 | 使用命中结果定位并完整读取 `scripts/build-windows-installer.ps1`；未写文件。 |
| 安装前组合基线尝试在服务运行时哈希 `archresearch.db`，被 SQLite 文件锁拒绝 | 1 | 不复制或强读活动数据库；先单独确认活动 Run=0，再正常停止精确安装进程，关闭后哈希主文件/WAL/SHM。 |
| PowerShell `Invoke-RestMethod` 将 workspace Runs 数组保留为一个嵌套元素，错误输出 `active_run_count=1` | 1 | 输出内各 Run 均为 terminal，但不采用该计数；改用 Python 标准库逐项展开同一只读 API 后再决定停进程。 |
| 首次 Python 展开脚本为嵌套引号使用 shell 转义，字典键被改成带空格的 `' id '`，触发 `KeyError` | 1 | 改为先赋值 `workspace_id = workspace["id"]`，避免嵌套引号；首次只读脚本无状态改动。 |
| 精确停止 PID `46888` 后数据库仍被另一进程占用，主文件哈希失败 | 1 | PID `46888` 已停止、安装尚未开始；只读定位安装路径进程与端口监听 PID，不猜测或批量杀进程。 |

# Phase 37 — 建筑子问题关键词分层与空间召回

Status: **complete**

目标：改善前期建筑研究中后勤入口与时段适应类子问题的案例召回。先优化“子问题 → 空间发现词 → 证据核验词”的拆解，不降低正文、来源和 EvidenceClaim 门槛，也不 retry Phase 36 的现场 Run。图纸研究保持原有查询逻辑不变。

1. **现状与真实词审计（complete）**：读取 Phase 36 的实际 `query_attempts`、候选 rerank 和页面分析，确认覆盖不足来自关键词、检索阶段混合还是证据缺失。
2. **关键词分层红测（complete）**：为 service/temporal 流线子问题锁定首轮空间召回词、后续证据词、词组轮换和不应首轮出现的运营窄词。既有图书馆/结构/采光查询断言保持。
3. **最小实现（complete）**：只在 `precedent_research` 查询路径中加入空间发现 lane、证据核验 lane 和按轮次轮换；首轮不强绑 post-occupancy、management rules、vehicle swept path。
4. **自动回归（complete）**：planner/provider 定向测试、API 全量回归、Ruff、format、strict Mypy 与 diff check 全部通过。
5. **实际安装版复核（complete）**：按用户授权构建并覆盖实际安装版，保护 SQLite；只创建一条代表性建筑研究 Run，等待自然终态并审计覆盖、案例质量、Trace 与 Results。图纸研究路径保持隔离。

### Phase 37 success criteria

- service_access 首轮优先召回 service/public entrance、site circulation、arrival/forecourt 等建筑空间关系；temporal_adaptation 首轮优先召回 shared/flexible arrival space、peak/event circulation 等空间适应关系。
- post-occupancy evaluation、management rules、delivery vehicle swept path 等运营核验词只进入后续 evidence_angle 或用户明确要求运营记录时的查询。
- 两个查询槽位不再把所有活动、用户、运营条件压成一个长查询；一个槽位负责空间发现，另一个负责项目/证据核验。
- 不新增建筑类型字典，不凭空加入 loading dock、service court 等用户未提出的具体设计解法；来源、正文、EvidenceClaim 与正式覆盖门保持不变。

### Errors encountered

| Error | Attempt | Resolution |
|---|---:|---|
| 初次并行检索包含不存在的 `apps/api/src/archresearch_api/planning.py` 与 `test_planning.py`，导致该组命令非零退出 | 1 | 改为读取实际的 `agent/planning.py` 与 `test_agent_planning.py`；无文件或应用状态改动。 |
| 关键词测试补丁首次使用错误的 Phase 36 日志锚点而未应用 | 1 | 先核对 `task_plan.md` 末尾，再拆分计划、测试和生产补丁；无部分写入。 |
| 系统 Python 未安装 Ruff，首次格式化命令失败 | 1 | 使用项目已有的 `apps/api/.venv` Ruff；未安装全局依赖或修改配置。 |
| 首次实现把明确的改造项目条件和空间 actor 词随运营流线一起过滤掉 | 1 | 保留明确项目条件；首轮仅过滤配送、排队、核验、运营时段等证据词，相关 307 项回归转绿。 |
| 安装版运行期间直接读取活动 SQLite 主文件哈希被文件锁拒绝 | 1 | 不停止正在验收的精确安装进程；改用 SQLite read-only URI 和 HTTP Results/Trace 审计，安装前后保护哈希已在启动 Run 前完成。 |

### 2026-08-09 — 实际安装版建筑 Run 验收

- 安装版 `C:\Users\76384\AppData\Local\Programs\ArchResearch\ArchResearch.exe` SHA-256 为 `FE09A116584D5E972966A33CEAF6C6616B207567A7086BD5A9C8B9B18FDFD7B9`，进程 PID `34308`、端口 `4849`；`/health` 返回 `ok/openai/gpt-5.6-sol`。
- 唯一新 Run `ea8c5c8d-915c-4d83-80c3-942046d88eb5` 自然终止为 `partial/budget_exhausted`；7 个 usable/verified/partial 资产、3 个正式项目、覆盖 3/4，未创建 retry、取消或并行 Run。
- 实际 SQLite 只读查询得到 12 条 `query_attempts`、32 个 `source_pages`（13 available、19 irrelevant）。`service_access` 首轮为 `service entrance public entrance site circulation floor plan architecture`；`temporal_adaptation` 首轮包含 `arrival space flexible circulation peak event passenger drop-off pedestrian access`，后续查询再加入 `project description`、`operational` 等核验词。
- 3 个正式项目：Madrid-Barajas Airport Terminal 4（1 asset，`direct_match=true`，4 个正文 supported facts）；The Flinders Street Station Winning Proposal（2 assets，`direct_match=true`，5 个正文 supported facts）；wahag studio: busan opera house（4 assets，`direct_match=true`，2 个正文 supported facts，deterministic fallback 仍有完整 EvidenceClaim）。7 个资产共 23 条 EvidenceClaim，均有来源 URL 和逐字 `text_excerpt`。
- `conflict_nodes` 共执行 8 轮搜索，最后仍无 `direct_match` 正式案例；其余 `arrival_sequence`、`service_access`、`temporal_adaptation` 已覆盖。Trace 共 156 条；发现 2 次 `BrowserCommandError`，未阻止 Run 完成，XHS 调用为 0。
- 图纸路径保持隔离：本轮未修改 `apps/api/src/archresearch_api/research_paths/drawing.py`、图纸查询函数或图纸现场数据。

# Phase 38 — conflict_nodes 空间发现词补全

Status: **complete**

目标：继续改善建筑研究唯一未覆盖的 `conflict_nodes`，只优化该子问题的“空间发现 → 证据核验”关键词层；不 retry Phase 37 Run，不创建现场 Run，不降低正文、来源、建筑尺度、`direct_match` 或 EvidenceClaim 门槛。图纸研究保持原有查询逻辑不变。

1. **真实失败定位（complete）**：读取 Phase 37 安装版 Run 的 8 轮 `conflict_nodes` 查询、候选和正文分析，确认空白来自空间词缺失、证据词过早混入还是正文证据不足。
2. **关键词红测（complete）**：锁定首轮前场/入口阈值/人车关系/前后台关系/交叉点同义词，并锁定后续核验词不得提前进入首轮。
3. **最小实现（complete）**：仅扩展建筑 precedent fallback 和 query-planning 提示；不修改 drawing fallback、不放宽候选准入或正文证据门。
4. **自动回归（complete）**：运行 planner/provider/browser 相关测试、API 全量、Ruff、format、strict Mypy 与 diff check。
5. **下一次现场验证（pending）**：只有在用户明确授权后，构建/安装并创建一条新的建筑 Run；不 retry `ea8c5c8d-915c-4d83-80c3-942046d88eb5`。

### Phase 38 success criteria

- `conflict_nodes` 首轮空间发现包含 `arrival forecourt`、`entrance threshold`、`pedestrian vehicle separation` 或等价中性关系词，并包含前台/后勤或访客/工作人员关系的可检索表达。
- 首轮不强绑 `post-occupancy`、`management rules`、`vehicle operations`、技术案例等稀疏证据词；后续轮次再加入项目说明或运营核验角度。
- 现有 `service_access`、`temporal_adaptation` 和图纸 fallback 断言保持；来源、正文、`direct_match`、EvidenceClaim 和建筑尺度边界不变。

### Errors encountered

| Error | Attempt | Resolution |
|---|---:|---|
| 首次红测补丁使用不存在的测试锚点，补丁未应用 | 1 | 改用现有测试函数名精确插入；无部分写入。 |
| 首次实现的冲突核验 lane 将 `operational` 放在查询尾部，被 500 字上限截断 | 1 | 将后续核验词移到 lane 前部；目标测试转绿。 |
| Ruff 报告冲突空间查询字符串超过 100 列 | 1 | 拆为相邻字符串字面量；未改变查询内容。 |

# Phase 39 — 建筑研究全局检索槽位与召回调度

Status: **complete**

目标：把建筑研究检索从“按某个子问题补一组词”提升为通用的语义拆槽和检索 lane 调度。任意子问题都从用户文本提取对象/参与者/空间、关系、状态或条件、证据类型，再轮换空间发现、关系/组织和项目证据查询；不根据子问题 ID、某个案例或预设设计答案写专用词表。图纸研究保持原有查询逻辑不变。

1. **历史 Run 证据收口（complete）**：以 Phase 36、Phase 36 安装版和 Phase 37 安装版的 query attempts、source pages、候选筛选和覆盖结果为依据，确认数量损失主要来自长查询/单槽、分支调度和确定性候选回退，而非正文 EvidenceClaim 门过严。
2. **全局检索合同红测（complete）**：证明旧实现没有通用 lane 轮换、首轮没有稳定的空间发现 + 项目证据双槽，Provider 回退最多保留 2 个候选；同时证明图纸查询不继承建筑检索词。
3. **最小建筑实现（complete）**：改为从用户语义提取检索维度并轮换通用建筑检索 lane；首轮在预算和时间允许时生成两个不同槽位；确定性 candidate reranking 回退最多保留 4 个仍通过相关性/来源/建筑路径准入的候选。正文、建筑尺度、direct_match 和 EvidenceClaim 门不变。
4. **自动验证（complete）**：planner/provider/browser 定向测试、API 全量、Ruff、format、strict Mypy、图纸隔离回归和 diff check 全部通过。
5. **现场授权前收口（complete）**：已更新交接和进度记录；尚未构建、安装或创建新的 Research Run，等待另行授权现场验证。

### Phase 39 success criteria

- 任何建筑子问题都经过同一套语义拆槽；生产逻辑不判断 `conflict_nodes`、`service_access`、`temporal_adaptation` 等 ID，也不注入某个案例的空间答案。
- 首轮有足够预算时，Provider 收到两个不同的检索槽：空间发现槽和项目/证据核验槽；后续轮次通过通用关系、空间组织、使用/场地和证据角度换词。
- Provider 不可用或 rerank 超时时，确定性回退不会因为固定 2 条上限过早丢掉合格候选，但低相关、低信任和非建筑页面仍不能进入分析。
- `apps/api/src/archresearch_api/research_paths/drawing.py`、图纸查询和图纸现场数据不被修改。

### Errors encountered

| Error | Attempt | Resolution |
|---|---:|---|
| planning session catchup 首次调用被外层 PowerShell 引号截断为 `C:\` | 1 | 改用绝对路径直接调用恢复脚本；项目状态未受影响。 |
| Mypy 可执行文件入口返回空失败码且无诊断 | 1 | 使用同一虚拟环境的 `python -m mypy src` 重跑，确认 32 个源文件无类型错误。 |

### Result

- 建筑检索现在按用户文本中的对象/参与者/空间、关系、状态/条件和证据类型组成查询语义，再轮换空间发现、空间关系/组织、使用/场地和项目/证据核验 lane；生产流程不按 `conflict_nodes`、`service_access` 或 `temporal_adaptation` 注入专用案例词。
- 首轮预算允许时向 Provider 请求一个 `space_first` 查询和一个项目/证据查询；跨子问题使用 Run 级规范化 query fingerprint 去重，避免同一查询重复消耗额度。
- Provider 规划或 rerank 不可用时，确定性路径最多保留 4 个合格建筑候选；低相关、低信任、非建筑页面仍被拒绝，正文 EvidenceClaim 门不变。
- API 全量测试、Ruff、62 文件格式检查、strict Mypy 32 个源文件和 `git diff --check` 全部通过；`research_paths/drawing.py` 未出现在差异中。
- 本阶段只完成源码和自动验证，未构建、安装或创建新的现场 Run；下一步需另行授权后，对当前安装版创建一条全新的建筑验证 Run，不 retry 旧 Run。

# Phase 40 — 安装版建筑全局检索现场验证

Status: **complete**

目标：在当前源码构建并安装 Windows 版本后，只创建一条新的建筑 Research Run，验证 Phase 39 的通用检索槽位、lane 轮换、查询去重、候选数量和最终 EvidenceClaim 覆盖；不 retry 旧 Run，不修改或验证图纸路径。

1. **构建与安装保护（completed）**：构建自包含 Windows 安装器，确认不捆绑 Chrome 扩展；保存并核对 SQLite 保护哈希，停止旧安装版后静默安装新版本。
2. **新建筑 Run（completed）**：确认安装版健康且活动租约为 0，只创建一条全新的建筑 Run；等待自然终态，不取消、不 retry、不并行创建。
3. **现场审计（completed）**：只读审计 query attempts、lane/strategy、source pages、候选筛选、正文分析、coverage、EvidenceClaim 和 Board 结果，确认数量提升来自召回层而非证据门放松。
4. **收口（completed）**：更新交接、findings 和 progress；记录安装包与数据库保护结果，保持图纸路径未改动。

### Phase 40 success criteria

- 新安装版 `/health` 正常、版本与源码一致、活动 Run 为 0，安装器不包含扩展文件。
- 只存在一条本阶段新建建筑 Run，Trace 中可见首轮双槽/通用 lane 或其预算裁剪原因，且没有 XHS 或图纸路径调用。
- 现场结果至少按 query 数量、候选保留数、覆盖、正文事实和 EvidenceClaim 分层审计；不能只以结果图片数量判定成功。
- 旧 Run `ea8c5c8d-915c-4d83-80c3-942046d88eb5` 不 retry、不修改；图纸 `drawing.py` 和图纸现场数据不变。

### Errors encountered

| Error | Attempt | Resolution |
|---|---:|---|
| 旧安装版服务持有 SQLite 文件锁，不能在运行中读取数据库哈希 | 1 | 已确认活动 Run=0；待有序停止精确 PID 后立即计算保护哈希，再安装新包。 |
| Board 详情页首次用完整无障碍名称定位按钮时超时 | 1 | 页面按钮文本包含换行与省略号归一化差异；改用页面唯一的“11 张参考”文本只读定位后成功进入详情，未修改 Run。 |
| Board 详情页控制台出现一个预览资源 404 | 1 | 主体与四个子问题均正常渲染；记录为独立资源问题，不把 HTTP/图片数量代替内容审计。 |

### Result

- 构建并安装 `.artifacts/qa/phase40-installed-architecture/ArchResearch-Windows-x64-Setup-v2.2.10.exe`；安装器自检通过且安装目录 `manifest.json` 中扩展文件数为 0。SQLite 安装前后 SHA-256 均为 `354E53402B7E80850ABEAC788CCDF56AFA7CD8D0DBC856B52C170D4DA49CAE66`。
- 新安装版 PID `40596`、端口 `6158`，安装 EXE SHA-256 为 `BF71D01FD477619B9B4FF2484AD54427BC2F75501A7DC53F2D6523267772DEC3`；`/health=ok/openai/gpt-5.6-sol`、`/desktop-health=ArchResearch 2.2.10`，创建前活动 Run=0。
- 本阶段只创建 Run `94c7d473-3f0d-41b1-9ad1-dcaec089c75e`，自然终止为 `completed/coverage_satisfied`：11 个 usable assets、4 个正式项目、10 个 verified/partial、2 个 multi-asset projects，4/4 子问题覆盖且 `gaps=[]`。旧 Run 未 retry。
- 11 条 QueryAttempt 对应 15 条实际查询，15/15 规范化去重；四个子问题首轮均执行 `space_first + evidence_angle`，后续只补未覆盖分支。8 个来源页 available、26 个 irrelevant，Provider fallback=0，XHS/图纸事件=0。
- 11 次正文分析中 6 次 `direct_match=true/complete`、5 次严格拒绝；43 条 EvidenceClaim 缺 URL=0、缺 excerpt=0。相对 Phase 37 的 7 个资产、3 个项目、3/4 覆盖，召回与覆盖均提高，证据门未降低。
- 新发现的后续问题不在检索层：两个不同来源页面正文分析成功后仍保留顶层 `project_name=待核验项目`，Board 按项目名分组时发生误合并。该问题转入 Phase 41；图纸路径仍未修改。

# Phase 41 — 正文核验后的建筑项目身份提升

Status: **complete**

目标：修复建筑 browser visual lead 在正文分析成功后仍保留占位项目名、导致不同来源案例被 Board 错误合并的问题；修复必须适用于所有建筑来源页面，不按案例名称、URL 或当前问题写特例，不修改图纸研究。

1. **链路定位与行为红测（completed）**：定位 visual lead 创建、正文分析结果回写、资产持久化和 Board 分组的数据流；先复现两个不同来源在 `direct_match=true` 后仍共享占位名的失败行为。
2. **最小项目身份提升（completed）**：只在正文成功核验后，以稳定页面/来源项目身份更新顶层 `project_name`；未完成正文分析的候选继续保留 `待核验项目`。
3. **回归与隔离（completed）**：验证同页多资产仍归为一个项目、不同页面不再因占位名合并、EvidenceClaim/direct-match 合同不变，并确认 `research_paths/drawing.py` 未修改。
4. **自动门禁（completed）**：运行 API 定向与全量测试、Ruff、format、strict Mypy 和 diff check。
5. **首次安装版现场复验（completed）**：Run `699ff718-a17b-44ef-8b1b-cd4ce233ab29` 自然完成并证明不同来源不再共享占位名，同时暴露同一来源的明确名称与占位名称在核验后分裂、以及确定性正文回退把 `service industry` 误当建筑后勤语义的两个通用缺口。
6. **现场缺口红测与最小修复（completed）**：同源占位资产优先复用该来源已有明确项目名；确定性 flow 回退移除歧义的裸 `service`，只保留 `service access/entrance/circulation/route` 等建筑复合语义。
7. **新增修复自动门禁（completed）**：两个行为红测、完整 browser/provider 回归、API 全量、Ruff、format、strict Mypy、diff check 均通过；图纸差异为 0。
8. **第二次安装版现场复验（completed）**：用户已明确授权；重新构建并保护性覆盖安装后创建一条全新建筑 Run，确认同源资产只形成一个 dossier、无 `service industry` 误命中，并继续把每个子问题案例数视为软提示而非完成门槛。旧 Run 不改写、不 retry。
9. **收口（completed）**：记录第二次安装、数据库保护、现场结果与 Board 分组；更新交接文件并保持图纸路径未改动。

### Phase 41 success criteria

- 任意建筑正文页面在 `direct_match=true` 后都获得非占位、稳定的顶层项目身份；不同来源页面不会仅因共享占位名而合并。
- 同一来源页面的多张资产继续稳定归组，未核验 visual lead 仍明确显示为待核验，不伪装成正式案例。
- Provider 不可用时的确定性 flow 回退只接受建筑流线复合语义，不把 `service industry` 等普通行业语义提升为后勤案例。
- 每个子问题不设固定案例数硬门槛；所有通过该分支正文证据的不同项目都展示，只有一个合格项目时仍允许完成。
- 不新增项目名/URL/建筑类型特例，不放宽正文、建筑尺度、来源可信度、EvidenceClaim 或覆盖门槛。
- 图纸查询、图纸筛选、图纸现场数据和 `apps/api/src/archresearch_api/research_paths/drawing.py` 不变。

### Errors encountered

| Error | Attempt | Resolution |
|---|---:|---|
| 安装器构建后首次核对冻结目录时假定根目录存在 `manifest.json`，读取路径不存在 | 1 | 改为递归枚举冻结目录中的 `manifest.json` 或 `extension` 路径；结果为 0，安装器与构建产物未受影响。 |
| 首次活动 Run 检查误用不存在的 `/v1/runs`，PowerShell 又把失败对象误计为一条活动记录 | 1 | 从本地路由定义确认实际端点为 `/v1/workspaces/{id}/runs`，不采用错误计数。 |
| workspace runs 响应首次追加为嵌套数组，显示 `RunCount=1` 但展开了多个 ID | 1 | 用双层 `foreach` 显式逐项扁平化；确认 8 条历史 Run、活动 Run=0。 |
| 现场分组审计的附加 source/name pair 表达式被多余反斜杠转义，错误输出 `DistinctSourceNamePairs=0` | 1 | 不采用该附加计数；同一命令已有效返回 2 个项目分组、各 2 张且 `PlaceholderCount=0`，后续用 `Group-Object source_url,project_name` 复核。 |
| Board 再次用独立文本 `11 张参考` 定位旧 Run 时无匹配，重复了 Phase 40 已知定位问题 | 1 | 改为 `button` 加 `hasText` 组合定位并成功打开；后续不再使用独立完整文本定位。 |
| 首个现场轮询脚本达到 20 分钟自设上限时 Run 仍在执行 | 1 | Run 本身为 4/4 覆盖且无停止原因，不取消、不 retry；改用低频只读状态快照等待自然终态。 |
| 延长监控脚本达到 30 分钟自设上限并抛错 | 1 | 研究 Run 仍持续产生事件且未失败；关闭已结束的监控 cell，改用 12 分钟替代监控并取得自然终态。 |
| 一次源码检索包含不存在的 `coverage.py`，一次工具探测因本机无 `jq` 返回非零 | 1 | 改读实际 `agent/verification.py`，结果审计继续使用 PowerShell JSON；不采用失败命令输出。 |
| 新同源归组红测首次使用不符合 schema 的 `drawing_plan/drawing_section` ID | 1 | 改为合法 `drawing_1/drawing_2`，随后旧实现按预期因名称分裂失败。 |
| 并行门禁中 Ruff format check 先发现两个文件需排版，导致该批其他结果不可采用 | 1 | 执行 Ruff 机械格式化后重新运行完整 browser/provider、API 全量和全部静态门禁，结果全绿。 |
| 新浏览器标签首次直接调用 `tab.locator()` 报接口不存在 | 1 | 复用已加载 Chrome skill 的实际接口 `tab.playwright.locator()`；只读标签页未受影响。 |
| PowerShell 首次用 `@(Invoke-RestMethod ...)` 包装 Results，把顶层 JSON 数组保留成一个嵌套元素 | 1 | 改为直接赋值并读取返回数组；确认 26 条持久化 Results，未采用错误计数。 |

### Result

- 第二次候选安装器、SQLite 保护和安装态摘要与 Phase 41 findings 一致；当前安装版 PID `29872`、端口 `11561`，健康、版本、扩展桥和单活租约检查通过。
- 唯一新 Run `bef8d1a4-5d09-4624-85e4-6cfff4979b23` 自然终止为 `completed/coverage_satisfied`、`attempt=0`：23 个 usable/verified-partial assets、8 个项目、4/4 子问题、`gaps=[]`，只有 `insufficient_subquestion_assets` 软提示。
- Trace 330 条、31 次 query planning、35 次实际浏览器搜索、15 次正文分析；12 次接受、3 次拒绝、0 次失败。query-planning deterministic fallback=1、page-analysis deterministic fallback=1；XHS/图纸事件均为 0。
- API 的 23 个正式资产来自 8 个来源，来源内顶层项目名唯一；按来源和受支持子问题去重后应有 12 个 Board dossier，实际 Board 四个子问题显示 `1/3/6/2`，合计恰为 12，8 个项目全部至少出现一次。
- 第一问只有新加坡体育城一个案例，是当前证据只支持该项目回答 `flow_interfaces`，不是 Board 隐藏其他案例。系统没有跨分支复制案例充数，也没有把每问固定数量作为完成门槛。
- Board 没有同源重复 dossier；弱回退明确显示“把来源机制作为待核验假设”，页面无 `service industry`。旧 Run 未 retry 或改写，图纸路径和图纸数据未修改。

# Phase 42 — 建筑逐子问题软多样性调度

Status: **complete**

目标：在不设置逐子问题硬配额的前提下，让建筑研究的剩余检索预算优先补查“不同正式项目较少”的子问题，减少案例分布向已富集分支持续倾斜；只优化建筑研究覆盖统计与调度，不修改 Board 证据归属、正式案例门或图纸研究。

1. **现状审计（completed）**：定位 `calculate_coverage()` 的逐分支资产/项目统计、workflow 的子问题选择顺序、completion/enrichment 停止条件和恢复逻辑；对照 Phase 41 Run 的 `1/3/6/2` 分布确认实际损失点。
2. **行为红测（completed）**：证明覆盖已完整且仍有预算时，补查优先选择不同项目最少的建筑子问题；同一项目多张资产不能冒充项目多样性；所有分支只有一个项目时仍允许正常完成。
3. **最小软调度实现（completed）**：只增加可解释的逐子问题不同项目统计和补查排序，不把目标加入硬 `gaps`，不改变正式正文、来源、建筑尺度、EvidenceClaim 或 Board 分组合同。
4. **回归与隔离（completed）**：验证 query 去重、预算裁剪、resume/retry、Provider fallback 和完成状态；确认 drawing runner、drawing query/fallback 与图纸现场数据不变。
5. **自动门禁（completed）**：运行定向测试、API 全量、Ruff、format、strict Mypy、`git diff --check` 和图纸差异审计。
6. **安装版现场复验（completed）**：用户已用“运行”明确授权；保护性重建/覆盖实际安装版并只创建一条全新的建筑 Run。新统计、coverage-first 边界、数据保护与 Board 均验证，但本 Run 只到 3/4 核心覆盖，未触发覆盖完成后的现场软重排；该限制如实保留，不 retry 或改写 Phase 41/42 Run。

### Phase 42 success criteria

- 建筑 coverage 能按子问题统计不同正式 `project_name`，同一项目的多张资产只计一个项目。
- 核心覆盖已满足但 enrichment 未满时，下一轮优先补查不同项目较少的分支；项目数相同时保持稳定、公平、可恢复的原有顺序。
- 不要求每个子问题达到固定数量；预算或时间结束时，只要原有 `gaps=[]`，仍可 `completed/coverage_satisfied`，不足仅保留为软提示。
- Board 仍只展示对当前分支具有正式正文分析与证据的项目，不跨分支复制案例充数。
- 不按具体案例、URL、建筑类型或本次四个子问题 ID 写规则；图纸研究不共享该统计或调度。

### Errors encountered

| Error | Attempt | Resolution |
|---|---:|---|
| 首次分支项目去重红测为同一来源重复使用完全相同的图片 URL，先触发 `asset_candidates` 唯一约束，未到达待测 coverage 行为 | 1 | 不采用该失败；给第二组同源资产使用不同图片 URL，保留相同 `project_name` 与分支分析后重跑。 |
| 第一次更新 Phase 42 状态的补丁用错误表行作为跨阶段上下文，但该行未在 Phase 42 尾部，补丁整体未应用 | 1 | 读取文件精确尾部后，以 `# Phase 42` 和本阶段步骤为上下文重新应用；未修改产品代码。 |
| Phase 42 首次 Ruff format check 报告 `agent/verification.py` 需要机械排版 | 1 | 仅对该文件运行 Ruff formatter，再重跑 lint、format check 与类型检查。 |
| 记录用户授权的首个规划补丁沿用了摘要中的英文 Step 6 文案，与文件当前中文步骤不匹配，补丁整体未应用 | 1 | 读取 Phase 42 精确尾部后更新授权状态；未修改产品代码。 |
| 将活动 Run 复核、精确停止进程、SQLite 哈希、安装和重启组合在一个 PowerShell 命令中，被本地执行策略在运行前拒绝 | 1 | 确认无状态改动；拆成只读复核、精确停进程、哈希、安装、启动五个可审计步骤。 |
| 重启后把安装版自检和 API 基线放进并行工具调用，被本地执行策略在运行前拒绝 | 1 | 确认没有调用发生；分别执行自检、活动 Run 复核和创建请求。 |
| 直接调用 GUI 子系统 EXE 的 `--self-test` 时 PowerShell `$LASTEXITCODE` 为 null，结果不可采用 | 1 | 改用 `Start-Process -Wait -PassThru` 获取可靠退出码 0；服务进程保持健康。 |
| 10 分钟批量轮询脚本的 PowerShell 输出被工具缓冲，无法提供中途快照 | 1 | 只终止轮询脚本，不操作 Run；恢复为单次低频只读快照，Run 持续自然执行。 |

### Phase 42 result

- 候选安装器 `.artifacts/qa/phase42-subquestion-diversity/ArchResearch-Windows-x64-Setup-v2.2.10.exe` 为 69,769,520 bytes，SHA-256 `A4104C688013F9D4D0BB00C3C389906B04B193937C8AA09A7CF3E8496560A169`；安装版/冻结 EXE SHA-256 均为 `13488684A685B64A8443B5FDE36604CC9097A9AC9045B2AF8A3A46AE58EE4856`。SQLite 覆盖安装前后 SHA-256 均为 `E2229DC80BB0793EE5D8279FF5C43D9E75E704D5292FD97E671770026B5156B2`。
- 唯一现场 Run `9fab66b8-feec-40fd-b4ae-feecc17124e0` 自然终止为 `partial/no_new_assets`、attempt 0：13 usable、3 项目、11 verified/partial，覆盖 3/4；`projects_per_subquestion={arrival-sequence:2, flow-interface:1, state-change:1, service-integration:0}`。
- 安装版确认 `projects_per_subquestion` 已进入 coverage，核心覆盖不完整时仍严格 coverage-first；自动行为测试证明核心覆盖完整时按不同项目数稳定软排序。但该现场 Run 未达到 4/4，因此没有实际触发现场软排序，不能把自动测试写成现场命中。
- Board 四问显示 `2/1/2/0` 个 dossier，后勤问题明确为空；无跨分支复制、无同源重复、无 `service industry`。XHS/图纸事件为 0，最终安装健康、活动 Run=0、图纸差异为 0。

# Phase 43 — 建筑查询策略稳定性与后勤分支召回

Status: **completed**

目标：修复建筑首轮查询策略随 Provider 漂移、以及 recovery 查询过度字面化导致整条分支 8 轮无候选的问题；保持全局语义策略，不增加案例名、URL、建筑类型特例或逐子问题硬数量门槛，不修改图纸研究。

1. **现场对照诊断（completed）**：对比 Phase 41 成功 Run 与 Phase 42 partial Run 的同类分支、域槽、策略和 QueryAttempt；确认差异来自首轮互补 lane 漂移与后续低召回字面词，而非 Board 隐藏或证据筛选过严。
2. **行为红测（completed）**：要求建筑首轮始终包含空间发现与证据角度两个互补 lane；recovery 在空间关系、运营证据和项目说明之间轮换，不能把装卸/垃圾等用户枚举直接变成唯一核心检索表达。
3. **最小全局修复（completed）**：只收紧建筑 query-planning 策略合同和通用 fallback/recovery 词形；保留 Provider 生成具体查询的能力，不写本 Run 项目名或具体案例答案。
4. **回归与门禁（completed）**：运行 planner/provider/browser/workflow、API 全量、Ruff、format、strict Mypy、diff check，并确认图纸差异为 0。
5. **安装版现场验证（completed）**：保护性覆盖安装后只创建 Run `3d85f4f0-1988-41b9-9e83-47e11e3bb4b9`。Run 自然完成为 `completed/coverage_satisfied`、attempt 0，首轮四问均为 `space_first + evidence_angle`，recovery 按空间关系/证据 lane 轮换；33 usable、7 项目、4/4，Trace/API/Board 与最终门禁通过。不 retry 旧 Run，不创建第二条 Run。

### Phase 43 success criteria

- 正常 Provider 路径的首轮两个查询槽在所有建筑子问题上承担不同角色，包含一个空间发现 lane 和一个正文证据 lane；Provider 不能把两者退化为泛项目上下文。Provider 或时间预算不可用时保留单槽 deterministic fallback，避免故障分支额外消耗其他子问题的查询机会。
- 未覆盖分支的 recovery 查询按通用语义层轮换，并保留建筑专业词，不依赖具体案例名、URL、类型字典或用户问题中的字面枚举。
- 不降低正文 direct-match、来源可信度、建筑尺度、EvidenceClaim、正式 coverage 或 Board 证据归属门；不设置逐题案例数量硬门槛。
- Phase 42 的软多样性排序继续只在核心覆盖完成后生效；图纸研究不共享这些查询规则。

### Phase 43 result

- 候选安装器 69,772,830 bytes，SHA-256 `FA6CFDABDF9D3DB260329941FC79F67BA01A8824D24959559E0D9ED0E20DB1A0`；实际安装/冻结 EXE SHA-256 均为 `CE47B35AA558DF6116245FBBB6C68219C625AF3360BE805B1ACE97FE7BD759B1`。SQLite 覆盖安装前后 SHA-256 均为 `9B7D9C3DC084827F7E5BCBA27F2D6DBD767B151933D8678D77B37B2D21EA26DF`。
- 唯一 Run `3d85f4f0-1988-41b9-9e83-47e11e3bb4b9` 为 `completed/coverage_satisfied`、attempt 0：33 usable、32 verified/partial、7 coverage 项目、4/4、`gaps=[]`、`enrichment_gaps=[]`，逐问项目数 `site=5/spatial=1/state=2/user=2`。
- 首轮四问均为 `space_first + evidence_angle`；第二轮是 `space_first` 空间关系 lane，第三轮先处理项目较少的两个分支并使用 `evidence_angle`。Trace 133 条，10 次 Provider query planning、14 次搜索（12 有结果）、14 次正文分析（10 direct-match/4 rejected）、2 次确定性 page-analysis fallback；XHS/图纸工具事件均为 0。
- Board-ready 为 19 个资产、7 来源、7 项目，事实证据 97 条且 URL/excerpt 完整；Board 10 个 dossier，四问 `1/2/2/5`，同问来源唯一，2 个 fallback 显示待核验假设，`service industry` 为 0。
- 最终 `git diff --check` 通过，`research_paths/drawing.py` 差异 0；安装版 PID `43912`、端口 `3303` 健康，扩展 connected、活动 Run=0，安装目录不含 Chrome 扩展。

# Phase 44 — v2.3.0 正式发布

Status: **in_progress**

目标：把已经完成现场验收的“建筑研究 / 图纸灵感执行路径拆分、建筑案例检索全局优化、图纸现场 bug 修复”整理成同一可追溯主线提交，以 `v2.3.0` 同时发布 Windows 安装器与独立 Chrome 扩展 ZIP；不提交本地数据库、运行结果、密钥、构建缓存或 planning skill 临时状态。

1. **范围与发布基线（completed）**：确认当前 tracked diff 全部属于 Phase 35–43 的产品、测试和项目交接记录；审计 untracked 缓存、当前分支与远端主线，确认 GitHub CLI 可用且已认证。
2. **版本与发布文案（completed）**：把 API、Board、Extension、manifest、CI、Release tests、README 下载链接和发布说明统一升级到 `2.3.0`；说明两条研究路径拆分、建筑检索优化、图纸 bug 修复及适用边界。
3. **完整发布门禁（completed）**：从整理后的工作树运行权威 `scripts/verify.ps1`，覆盖 Python/TypeScript、Board/Extension coverage、扩展 packaged E2E、release contract 和 installer contract；修复后必须完整重跑。
4. **双产物与本地自检（completed）**：从同一提交候选生成 `ArchResearch-Windows-x64-Setup-v2.3.0.exe` 与 `archresearch-chrome-extension-only-v2.3.0.zip`，校验版本、内容隔离和 SHA-256；冻结运行时 self-test 通过，不覆盖用户现有安装。
5. **提交、PR 与 CI（in_progress）**：在清晰的 `codex/release-v2.3.0` 分支只提交本次范围文件，推送并创建 ready-for-review PR；等待 Windows 主线验证和干净 runner 的安装/启动/卸载 smoke 全部通过，不绕过失败检查。
6. **合并与正式 Release（pending）**：合并 PR 后确认主线提交，创建 annotated `v2.3.0` tag 和非草稿、非预发布 GitHub Release，上传同一主线 CI 产出的两个附件并复核名称、大小、哈希和 latest 状态。

### Phase 44 success criteria

- 所有公开版本面和 CI/Release 合同统一为 `2.3.0`，远端既有 `v2.2.10` 附件与 tag 不修改。
- 提交范围不包含 `%LOCALAPPDATA%` 数据、Research Run、API Key、浏览器状态、`.artifacts` 构建缓存或 `.planning` 临时状态；工作区发布后清晰可解释。
- 权威本地门禁与 GitHub Actions 均全绿；Windows 安装器和 Chrome 扩展是同一主线提交生成的两个独立附件，安装器内部不捆绑扩展。
- Release 说明准确覆盖：建筑研究与图纸灵感拆分、建筑检索召回/多样性/项目身份优化、图纸浏览器时序与笔记路径 bug 修复；不把单次现场 Run 结果承诺为所有问题都固定返回相同案例数。
- `v2.3.0` tag、Release、附件和主线提交相互可追溯，Release 为 latest、非 draft、非 prerelease。
