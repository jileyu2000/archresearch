# ArchResearch

[![verify](https://github.com/jileyu2000/archresearch/actions/workflows/verify.yml/badge.svg)](https://github.com/jileyu2000/archresearch/actions/workflows/verify.yml)
![version](https://img.shields.io/badge/version-2.2.0-2F5BFF)
![platform](https://img.shields.io/badge/platform-Windows%2011-171A18)

> 把建筑设计问题变成有出处、能比较、可继续使用的案例答案与图纸灵感板。

ArchResearch 是为建筑学生和青年设计师制作的本地优先研究工作台。你可以输入一个具体设计问题，附上任务书 PDF 或案例网页；系统会拆解问题、研究公开网页、核对项目正文与图片关系，再把结果整理成可以直接阅读、收藏、对照和导出的研究材料。

它不是案例搜索结果墙，也不预先建设平台案例库。正式案例中的项目条件和空间机制必须绑定原文引文；小红书只用于寻找配色、线型、版式和分析图语言，不单独证明建筑事实。数据库、收藏和备份都保存在用户自己的电脑上。

## 下载与安装

**需要 Windows 11 和 Google Chrome。**

[下载 Windows 安装版 v2.2.0](https://github.com/jileyu2000/archresearch/releases/download/v2.2.0/ArchResearch-Windows-x64-Setup-v2.2.0.exe)

1. 下载并双击安装程序。
2. 首次启动只输入自己的 Key。验证通过后，Key 会存入 Windows 凭据管理器。
3. 以后从桌面或开始菜单打开 ArchResearch，它会自动在 Chrome 中显示本地页面。

本地服务、完整界面、数据库和运行环境都会自动安装。不需要安装 Python、Node.js、pnpm 或 PowerShell。

> 安装程序暂未签名，Windows 可能显示 SmartScreen 或“未知发布者”。可在 [v2.2.0 Release](https://github.com/jileyu2000/archresearch/releases/tag/v2.2.0) 核对文件与 SHA-256。

### 需要小红书时

打开“图纸灵感”后，页面会提示安装 **ArchResearch Chrome 扩展**。按页面里的“查看安装方法”完成下载和连接即可。安装包不包含 Chrome 扩展；连接成功后，提醒会自动消失。

[Chrome 扩展安装说明](docs/chrome-extension.md) · [从源码运行](docs/development.md)

![ArchResearch 首页](.artifacts/portfolio/current-2026-07-28/home-desktop.png)

## 项目定位

ArchResearch 聚焦建筑设计前期最耗时的一段工作：把一个模糊问题拆成可研究的问题，找到真实项目，核对来源，再把可用结论带回方案。它适用于课程设计、建筑竞赛、毕业设计和青年设计师的早期方案研究。

| 项目维度 | ArchResearch 如何回应 |
| --- | --- |
| 目标用户 | 正在做课程设计、竞赛或毕业设计的建筑学生，以及工作 0–3 年、需要快速形成方案依据的青年设计师。 |
| 真实痛点 | 普通搜索把事实、图片和二手转述混在一起；灵感收藏与原设计问题脱节；使用者很难在有限时间内判断“案例为什么适用”。 |
| 使用场景 | 方案前期拆题与案例研究；任务书约束下的定向研究；轴测图、分析图、效果图等表达方向探索。 |
| 实际价值 | 把搜索、网页阅读、证据核对、跨案例比较、收藏与导出串成一条可恢复流程，同时明确证据缺口和图片权利边界。 |

它不是一个只会生成文本的聊天机器人。用户决定研究问题、深度、资料与浏览器权限；Agent 负责有界执行；确定性代码负责证据准入、完成判定、权限和导出门禁。

| 任务书约束的案例研究 | 跨案例论证 | 图纸灵感方向 |
| --- | --- | --- |
| ![任务书驱动研究](.artifacts/portfolio/current-2026-07-28/brief-ff16988d-desktop.png) | ![深度案例研究](.artifacts/portfolio/current-2026-07-28/deep-76f52c79-desktop.png) | ![图纸灵感研究](.artifacts/portfolio/current-2026-07-28/visual-f5be3f17-desktop.png) |

## 可以用它做什么

| 场景 | ArchResearch 的工作 |
| --- | --- |
| 建筑设计研究 | 把总问题拆成可检索的子问题，寻找真实落地项目，并用逐字证据说明案例如何回应当前设计任务。 |
| 图纸灵感 | 围绕轴测图、分析图、效果图等目标扩展不同表达方向，从登录态小红书与当前 Chrome 页面组织视觉参考。 |
| 研究资料管理 | 保存个人收藏、对照案例策略、生成表达规范、按图片权利边界导出，并通过 ZIP 备份或恢复全部本地数据。 |

研究提供“快速找方向 / 形成方案依据 / 做跨案例论证”三种深度。无论选择哪一种，系统都会保留已有结果并如实标记缺口，不把未完成的研究包装成完整答案。

## Evidence-Grounded Plan-and-Execute Agent

ArchResearch 采用 **Evidence-Grounded Plan-and-Execute Agent**。这是项目自身的运行架构，不是用框架名称包装一次模型调用：模型只处理适合语言推理的环节，阶段编排、预算、工具权限、证据准入和终态判断均由可测试的确定性代码控制。

```mermaid
flowchart TB
    U["用户问题 / 任务书 / 研究深度"] --> P["Plan<br/>拆解子问题、生成有界查询"]
    P --> E["Execute<br/>七阶段状态机、工具调用、checkpoint"]
    E --> V["Verify<br/>URL + 逐字引文、coverage + enrichment"]
    V -->|"有缺口且预算允许"| E
    V -->|"双门槛通过或预算结束"| S["Synthesize<br/>证据绑定综合与确定性 fallback"]
    S --> R["案例答案 / 对照 / 收藏 / 图纸灵感板"]

    E --> PW["Direct Playwright<br/>公开建筑网页"]
    E --> X["OpenCLI Browser Bridge<br/>登录态小红书只读检索"]
    E --> C["Chrome MV3 扩展<br/>枚举动作与受管标签"]
    E --> M["OpenAI 兼容 Provider<br/>规划、页面分析、视觉分类、综合"]
    V --> D["SQLite<br/>Run、AssetCandidate、EvidenceClaim、Trace"]
```

代码边界与上述职责一一对应：

- [`agent/planning.py`](apps/api/src/archresearch_api/agent/planning.py)：计划生成、确定性 fallback、查询预算和可信站点轮换。
- [`agent/execution.py`](apps/api/src/archresearch_api/agent/execution.py)：取消、checkpoint、恢复去重、页面预算和运行计数。
- [`agent/verification.py`](apps/api/src/archresearch_api/agent/verification.py)：逐题 coverage、证据丰富度与完成门槛。
- [`agent/synthesis.py`](apps/api/src/archresearch_api/agent/synthesis.py)：只消费已绑定证据的综合内核与可恢复 fallback。
- [`workflow.py`](apps/api/src/archresearch_api/workflow.py)：唯一 orchestrator，保持 `planning → searching → inspecting → analyzing → verifying → gap_check → composing` 的阶段顺序。

项目不依赖 LangChain、LangGraph、OpenAI Agents SDK 或多智能体运行时。Provider 调用仍封装在小型具体客户端之后，默认测试全部使用确定性 mock。

运行组件：

- `apps/board`：React、Vite、TypeScript、TanStack Query。
- `apps/api`：FastAPI、Pydantic v2、SQLAlchemy 2、Alembic、SQLite。
- `apps/extension`：Chrome Manifest V3，只执行随包发布的固定动作。
- `.archresearch`：本地数据库、导出、日志和开发进程状态。

## 人机协同与纠偏

| 环节 | 人负责 | AI 负责 | 确定性系统负责 |
| --- | --- | --- | --- |
| 研究规划 | 提出问题、附任务书、选择研究深度 | 拆解子问题、生成检索方向 | 校验 typed plan、限制问题数/轮数/查询数、失败时使用确定性计划 |
| 研究执行 | 授权浏览器、决定是否继续补齐 | 分析页面正文和图片、估计相关性 | 只调用白名单工具，保存 checkpoint，取消/恢复不丢已有结果 |
| 证据与综合 | 判断案例是否适合自己的设计条件 | 归纳机制、比较案例、生成转译建议 | 每条正式事实绑定 URL 与逐字引文；relevance 只排序；coverage 与 enrichment 同时通过才 completed |
| 收藏与交付 | 主动收藏、删除、对照和导出 | 组织阅读结构与表达方向 | 收藏纯累加；未知权利图片降级为来源卡；不替用户执行社交或发布动作 |

交互迭代不是无限自主循环。Agent 在 `gap_check` 发现逐题缺口后，只有在剩余查询、页面和时间预算允许时才定向补查；模型或网页失败时保留部分结果并记录原因。来源偏差通过建筑媒体轮换、项目官网补证、逐字引文门槛和“小红书只做视觉灵感”来约束，而不是让模型自行宣称可信。

## 模型与密钥

Windows 安装版首次启动时只显示一个 Key 输入框。程序会隐藏输入并先执行一次小型、可能产生费用的 `gpt-5.6-sol + medium` 结构化输出测试；只有验证通过后，才把 Key 保存到 Windows 凭据管理器。失败时不会保存 Key，用户可直接修改并重试。

公开建筑网站由 Direct Playwright 使用系统 Google Chrome，在不落盘的隔离上下文中提取正文、项目链接、图片 URL 和图注；图片、媒体和字体请求默认拦截以降低流量。Windows 安装版的小红书研究由用户单独安装并连接的 ArchResearch 扩展读取登录态页面；源码开发环境还可选用 OpenCLI Browser Bridge。每个灵感方向按 rank 最多尝试四篇笔记，累计三篇产生可用图的帖子后停止；每篇等距选取最多四图并合并为一次视觉分类。图纸灵感共享 48 个逐图检查槽位 / 48 MiB 预览预算。可用的小红书读取路径全部失败时会诚实终止，不降级为通用网页素材。

源码开发、mock 模式和其他 OpenAI 兼容配置见[开发文档](docs/development.md)。

## 研究行为

支持两类研究目标：

- `precedent_research`：按查询轮换 ArchDaily、Designboom、Dezeen、Divisare、ArchDaily China，并继续核对事务所官网等落地项目正文；只有逐字引文支持的项目条件与空间机制进入结果。一个项目可聚合主文章和最多两个定向补充文字来源，转译策略明确属于 ArchResearch 分析。图片只作为可选预览和原站入口。
- `visual_reference_search`：接受“我想出一张轴测图，帮我找风格”“效果图怎么出”这类宽泛提问；用户点名图纸类型时固定该类型，只规划线稿、拼贴、材质渲染、氛围等互不重复的表达方向，再从小红书分类与重排。

建筑设计研究的“快速找方向 / 形成方案依据 / 做跨案例论证”（内部值 `quick / balanced / deep`）都以覆盖各自拆解出的全部子问题，并同时达到正文分析丰富度作为 `completed` 标准。三种深度共用 30 分钟的单次执行安全上限；差异只在子问题数量、每题研究轮数、目标案例数量和分析要求。图纸灵感不显示三档深度，使用固定视觉配置并以各灵感方向获得可用图片为覆盖标准；若 48 个逐图检查槽位耗尽时仍有方向未达到三篇 usable 帖子，结果诚实保留为 `partial`，停止原因为 `visual_budget_exhausted`。局部分支不完整时保留已有结果并明确缺口，不会把不完整结果伪装成全覆盖，也不会丢弃已经有用的答案。

固定界面演示使用回放数据：`?demo=quick`、`?demo=balanced`、`?demo=deep`。三页分别展示“快速找方向 / 形成方案依据 / 做跨案例论证”的 3、4、6 个完整子问题，并在首屏标明各自的研究深度合同。

设计策略研究会先把总问题拆成 3–6 个可检索子问题，再分别召回并读取项目正文。结果按“子问题 → 项目档案 → 正文证据”组织；事实完整性在声明级校验，每条事实分别保留 URL 和逐字引文。同一项目的一篇文章只有背景或局部机制时，系统最多执行一次项目名与缺失主题的定向补查、读取两个可信文字页，再把可核验证据合并到项目档案；不同项目绝不合并。转译步骤和适用边界是基于这些证据的研究分析。同源图片可以作为预览，但不参与证明机制，也不要求精准对应当前问题；文字覆盖未完成时不执行图片批次。

来源不是一条固定高低链：项目官网和可信建筑媒体主要回答“方案怎么成立”，小红书主要回答“图怎么出”。视觉平台图片按“灵感方向 → 图纸类型 → 可见观察”进入独立灵感板，不计入方案项目数量，也不能单独确认项目事实、图纸归属或使用权。工作流会随研究目标切换网页检查优先级。

每张预览图片分别记录来源等级、项目身份、图片归属、首发来源、版权状态和结果等级。只有正文逐字证据支持的事实才生成正式证据声明，并绑定 URL 或 PDF 定位；正文事实、图片可见观察、设计推断和适用边界分开显示。`visual_reference_search` 或明确找图任务仍按图片与问题的视觉相关性筛选。

## 安全边界

- API 仅监听回环地址；扩展令牌保存在本地，API 落盘只保存摘要。
- 扩展只接受枚举 JSON 动作，不接收任意 JavaScript、选择器或远程代码。
- `<all_urls>` 只用于 Chrome 可见页裁图能力，必须由用户从扩展界面明确授予，并可随时撤销；它不会扩大动作 DSL 的公网 HTTP/HTTPS 范围。
- 禁止读取 Cookie、LocalStorage、密码框、私信和账号页面。
- 通用网页 `safe_click` 保留协议但默认不执行不可信页面点击。
- 截图前后验证目标标签；竞态时丢弃图像。
- API 与扩展共同拦截私网、保留地址和不安全 URL。
- OpenCLI 适配器只允许小红书 `search`、`note`、`download` 三种只读命令；当前研究闭环只调用 `search` 与 `download`。子进程不经 shell，Trace 不保存查询、签名参数、stderr 或完整登录页。
- 分享版导出由确定性代码执行版权门禁；未知或受限图片只输出来源卡和链接。

## 验证

```powershell
pnpm test:coverage
pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/verify.ps1
```

第一条命令执行 Board 与 Extension 覆盖率门槛；第二条运行发布、PowerShell 安全与进程生命周期测试、评测夹具验证、Python 单元/集成测试、Ruff、Mypy、两个 TypeScript 应用的 lint/类型检查/测试/生产构建，以及打包后 Chrome 扩展 E2E。所有默认测试均使用 Mock/本地 fixture，不调用真实模型或公开搜索网页。

只验证版本化评测集：

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/validate-evaluation-fixtures.ps1
```

## 完成度与已知边界

当前版本是可安装、可持久化、可备份恢复的 V2.2 系统，不是界面原型。Windows 一键安装程序交付自包含本地服务与生产界面；Chrome 扩展保持独立下载。Agent 四模块边界、七阶段 checkpoint、任务书流程、个人收藏、跨案例对照、权利门禁导出和 Chrome 扩展均已有行为测试。发布门禁包含 Python 与 TypeScript 测试、Ruff、strict Mypy、lint/typecheck、production build、进程、安全、评测夹具、扩展 E2E 和 Windows 安装产物合同；默认测试不调用真实模型或公开网页。完整证据见[发布验证记录](docs/release-evidence-2026-07-28.md)。

产品刻意保持本地优先边界：当前支持 Windows 11 + Google Chrome，一次只运行一个研究任务；实时网页研究需要使用者主动配置自己的 OpenAI 兼容 Provider，并授予所需浏览器权限。小红书视觉研究还需要使用者自己的登录态和独立 ArchResearch Chrome 扩展。未知或受限权利图片只能作为来源卡与链接交付，不能由 Agent 自动升级权利状态。

## 访问与演示

本仓库提供 Windows 安装程序、完整源码和本地演示入口。按[下载与安装](#下载与安装)完成安装后，参考板默认位于 `http://127.0.0.1:8000/`。安装版的三个纯本地回放入口是：

- 快速找方向：`http://127.0.0.1:8000/?demo=quick`
- 形成方案依据：`http://127.0.0.1:8000/?demo=balanced`
- 做跨案例论证：`http://127.0.0.1:8000/?demo=deep`

这些入口不需要 Key，不创建 Workspace 或 ResearchRun，也不请求外部供应商；它们只展示真实产品界面和固定示例数据，不冒充实时网页研究。需要验证持久化闭环时，打开不带 `?demo=` 的正常地址，在默认 `mock` 模式创建工作区和研究即可。

可直接复制的测试问题：

| 研究入口 | 问题 | 建议设置 |
| --- | --- | --- |
| 建筑设计研究 | 寻找面积受限的社区微型图书馆通过家具、楼梯和夹层复合使用的剖面与室内照片。 | 快速找方向 |
| 建筑设计研究 | 寻找中小型博物馆中观众、工作人员和藏品运输三套流线分离的平面和流线分析图。 | 做跨案例论证 |
| 图纸灵感 | 我想出一张低饱和分层轴测图，帮我找保留结构与新增体量的颜色区分方式。 | 实时测试需登录态小红书与 ArchResearch Chrome 扩展 |

任务书路径可在建筑设计研究中附加自己的 PDF，系统会先提取项目边界，再把确认后的子问题写入同一研究 Run。仓库另含[25 条版本化研究任务](fixtures/queries/README.md)；两条完整演示流程、预期证据边界和失败恢复路径见[演示流程](docs/demo-flows.md)。

## 交付文档

- [系统架构与数据流](docs/architecture.md)
- [Chrome 扩展安装说明](docs/chrome-extension.md)
- [从源码运行与维护](docs/development.md)
- [失败案例与恢复策略](docs/failure-cases.md)
- [两条完整演示流程](docs/demo-flows.md)
- [历史 gpt-5.5 实时研究 Smoke 记录](docs/evaluation/live-smoke-2026-07-11.md)
- [25 条版本化研究任务](fixtures/queries/README.md)
- [九类图纸分类评测集](fixtures/evaluation/README.md)

## 设计与计划

- [V2.1 设计规格](docs/superpowers/specs/2026-07-11-arch-research-v2-design.md)
- [实施计划](task_plan.md)
- [关键发现](findings.md)
- [阶段进展](progress.md)
