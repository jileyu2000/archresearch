# ArchResearch 新会话交接

> 本文件只保留当前为真的产品合同、已验证基线、保护规则和下一步。详细过程见 `task_plan.md`、`findings.md`、`progress.md`、`docs/history/` 与 Git 历史。

## 新会话启动顺序

1. 完整阅读本文件。
2. 阅读 `AGENTS.md`。
3. 阅读 `task_plan.md` 中状态为 `in_progress` 或 `proposed` 的阶段；当前没有活动阶段。
4. 阅读 `findings.md` 和 `progress.md` 末尾；需要旧根因时再查历史。
5. 运行 `git status --short --branch`，保留全部既有修改、忽略的本地产物和真实研究数据。
6. 开始动作前复述当前状态、唯一下一步和验证标准。

## 当前产品合同

- 唯一产品是 Windows/Chrome 本地优先 ArchResearch：FastAPI、Python workflow、SQLite、本地文件、用户自己的 OpenAI-compatible Provider，以及单独安装的 Chrome 扩展。
- 架构仍是 **Evidence-Grounded Plan-and-Execute**，不是多 Agent。Plan 使用普通 Responses 做开放拆题和结构化查询规划；Execute 负责本地搜索、候选 ID 白名单筛选、本地正文/图纸读取、模型分析、程序证据绑定和覆盖补查。
- 默认不调用 Provider 原生 `web_search`，也不要求兼容 API 支持工具调用。
- 建筑研究面向方案初期，以空间关系、使用体验和环境联系为主；建筑类型只作必要的软语境。正式结论必须绑定真实 URL 和逐字 EvidenceClaim。
- 图纸灵感只接收图纸类型与视觉分割、构图、线型、配色、版式等方向；不得询问或推断住宅、学校等具体建筑类型。登录态小红书走 XHS-only 路径，不进入普通网页搜索。
- `建筑爆炸图`、`建筑效果图`中的“建筑”只作制图学科消歧，用于排除产品、摄影和影视噪声，不是建筑类型。
- 小红书未登录、状态未知或通道不可用时 fail closed；不创建图纸 Run，也不降级到普通网页。
- 首次 Provider 配置从上游 `/models` 获取只读模型列表，只探测用户选中的模型；Key 只进入 Windows Credential Manager。
- Windows 安装器自包含本地服务与生产 Board，但不捆绑 Chrome 扩展；扩展始终作为独立 ZIP 发布。
- 单活研究租约保持不变；已有活动 Run 时新建或重试返回 409。部分结果和每阶段 checkpoint 必须保留。

## 禁止恢复的范围

- 不恢复 Cloudflare Web Edition、`apps/web`、`apps/edge`、Wrangler、Workers/Workflows、Durable Objects、R2、Turnstile 或公共 HTTPS 扩展桥。
- 不恢复 Firecrawl、Pinterest、TinEye、通用视觉网页降级、平台案例库、全局向量索引或多 Agent runtime。
- 不新增 token、费用或 Provider 用量界面。
- 不读取、打印或保存 API Key、Cookie、账号或密码。
- 不使用 reset、checkout 或 clean 处理用户工作树；不删除真实研究数据或本地产物。

## v2.2.4 已验证基线

- 正式 Release：[ArchResearch 本地版 v2.2.4](https://github.com/jileyu2000/archresearch/releases/tag/v2.2.4)，tag 指向 `d80f715d88781810eda7624d9f1d65b3754228fb`。
- PR [#15](https://github.com/jileyu2000/archresearch/pull/15) 已合并；Hosted CI run `30806486060` 的 `verify` job 成功，用时 17 分 16 秒。
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
- 权威门禁：API 569/569、Board 181/181、Extension 182/182、packaged E2E 8/8；Ruff、strict Mypy、TypeScript lint/typecheck/build 和 Windows 发布合同全部通过。
- 真实安装 smoke：静默安装、冻结程序自检、快捷方式、扩展排除、动态端口启动、`/desktop-health`、`/health`、Board、静默卸载和无残留全部通过。

## 发布产物

- `ArchResearch-Windows-x64-Setup-v2.2.4.exe`
  - 69,748,597 bytes
  - SHA-256 `AB2D0D19B4260C89A9F7DE02D277A4EC946707E9AE0D40492E3ABAE27B97A70B`
- `archresearch-chrome-extension-only-v2.2.4.zip`
  - 18,719 bytes
  - SHA-256 `4349E77FEFDEF8AF0F0C22F59D0F6C79AEFB398F17F2AA911CF45EEF76FAA26B`
- GitHub 返回的附件名称、大小和 digest 与本地产物一致。

## 本地文件状态

- `.artifacts/build/`、`.artifacts/qa/` 和 `.artifacts/releases/` 是本地构建、验证截图和发布产物，已精确忽略但继续保留。
- `.archresearch/`、SQLite、Workspace、ResearchRun、图片与真实研究结果不得删除或提交。
- `.artifacts/portfolio/` 中既有跟踪文件保持不变。

## 当前唯一下一步

`v2.2.4` 的开发、真实验收、Board QA、完整门禁、安装 smoke、PR、CI、合并和正式 Release 均已完成。当前没有活动 Run、活动开发阶段或待发布修改；等待用户提出下一项产品任务。
