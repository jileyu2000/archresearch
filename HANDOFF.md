# ArchResearch 新会话交接

> 2026-07-27 整理：本文件曾累积 M42–M145 的逐里程碑叙事，多处已互相矛盾（收藏替换语义、来源检视器、旧 Run 计数、"当前唯一下一步"多次残留）。历史叙事已整体归档至 `docs/history/`（task-plan 归档含旧版全文），本文件只保留当前为真的状态与规则。

## 新会话启动顺序

1. 先完整阅读本文件。
2. 阅读 `task_plan.md` 中状态为 `in_progress` 或 `proposed` 的阶段。
3. 阅读 `findings.md` 和 `progress.md` 的末尾；追溯更早根因时查 `docs/history/` 归档。
4. 运行 `git status --short --branch`，保留所有既有修改和未跟踪文件，不得 reset、checkout 或批量清理。
5. 开始动作前，用两三句话复述“当前状态、下一步、验证标准”。

## 产品与不可逆决策

- 产品是面向建筑学生与青年设计师的本地优先实时研究 Agent，不建设案例库或全局向量索引。产品行为的权威描述在 `apps/board/PRODUCT.md` 与 `DESIGN.md`；用户文案词汇由 `apps/board/src/copy-glossary.test.ts` 源码级守卫，版式结构由 `apps/board/src/design-system.test.ts` 按单一 860px/620px 媒体块切片守卫。
- 公开建筑网站使用进程内 Direct Playwright；登录态小红书默认使用 `@jackwener/opencli@1.8.6` Browser Bridge。**不再使用 Firecrawl**（M41 移除）、**无 Pinterest**（M94 移除）、**无来源反查/TinEye**（M113 移除），三者都不得恢复。
- 所有模型统一为 `gpt-5.6-sol`，推理强度 `medium`，base `https://suoxie.codes/v1`。API Key 只在 Windows 凭据管理器（`ArchResearch/suoxie` / `api-key`），不得打印或迁移。
- ArchDaily、Designboom、Dezeen、Divisare、ArchDaily China 与项目官网负责落地案例与方案证据，按查询轮换站点；小红书只负责制图/配色/形体/分析图灵感，始终 `aggregator / visual_lead`，不能单独证明项目事实。图纸灵感 XHS-only fail-closed：OpenCLI 失败才回退扩展，两条路径都不可用时诚实终止，绝不降级为通用网页素材；固定 48 个逐图检查槽位 / 48 MiB，每方向按 rank 最多试 4 帖、累计 3 篇 usable。
- 正式方案案例按项目组织：每条事实绑定自己的 URL 与逐字引文；同项目可合并，一次定向补查最多两个可信文字页；`transfer` 是明确标注的设计转译；模型 relevance 只排序。图片只是可选预览与出处入口，不证明机制、不参与准入。
- 深度是语义合同（拆解规模、逐题覆盖、分析义务），不是许可交浅答案：M124 起 coverage 与 enrichment 同时达标才 `completed`，有用但不足的结果诚实 `partial`。对外三档为“快速找方向 / 形成方案依据 / 做跨案例论证”，内部请求值 `quick/balanced/deep` 不变。
- 保留语义（两次 P0 后的现行规则）：Run 默认 14 天、可逐条永久；**`keep_forever` 同时豁免 Run 行与其全部子数据**（资产/证据 7 天、来源 30 天的独立时钟，M141）。个人收藏是独立快照，Run 过期不删收藏；**保存是纯累加动作**，新批次绝不删除任何既有收藏（M145 废除了 M93 的同题替换）。删除永远只由用户显式执行。
- 单活研究租约：已有活动 Run 时新建/重试返回 409。打开应用永远落主页，运行中的研究是后台进程，不得劫持首屏（M140）。
- 封存 Run 绝不 retry：`10d31b4c-94dd-4442-b24a-fc1b241e658e` 及所有标注“永久封存”的 Run。任何失败先离线合并诊断，不连续 POST；不得未经批准自动创建 Live Run。
- 产品界面不得展示供应商余额、额度或内部核验术语；建筑结果与收藏每案例只保留一个“出处 · 域名”安静链接（M138），无来源检视器/核验状态/收藏来源动作（检视器只存在于图纸灵感）。
- 修改生产代码前先写失败的行为测试；契约被取代时迁移测试而不是叠加。

## 当前已验证基线

- 分支 `codex/archresearch-v2-1`（未 push，push 需显式授权）。基线链：`98a9a01` → `d772902` 产品基线 → `06f3424` WMI-free 启停 → 此后逐里程碑小步提交（最近 `bb32390` 收藏累加保存）。
- 权威门禁 `scripts/verify.ps1`：**342 API / 131 Board / 165 Extension / 8 packaged E2E**，加 Ruff/format、strict Mypy、两端 lint/typecheck/build、进程/安全/评测检查。PowerShell 5 会吞中间失败，脚本末行成功文案不能单独作为证明。
- 进程脚本必须保持无 WMI/CIM（MSIX pwsh 加载 MMI 失败会杀掉自己拉起的服务）：监听发现用 `netstat -ano`，命令行读 PEB。
- 持久数据基线：**4 workspaces / 13 completed Runs / active 0 / `keep_forever` 13/13 / 301 assets / 8 条收藏 / 1 份任务书**。其中《城市社区共享中心》8 问全部 completed 零缺口（M137）；`76f52c79`（三档验收 Deep）与 `ff16988d`（任务书 Standard）是现行验收声明的底层证据，不是失败记录。
- 服务：`scripts/start.ps1` 幂等启动 API 8000 / Board 5173，登录自启已配置（M127）。
- 本工作区由多个 agent 会话并发写入（长期约束）：提交前后必须重读 `git status`，另一会话仍在写同名文件时暂停提交。

## 当前唯一主线

1. **M121 已 complete**（2026-07-27 用户改为多 agent 模拟验收）：记录在 `docs/m121-simulated-pilot-2026-07-27.md`。修复队列：M148 提交反馈加固（当轮，in_progress）→ M149 五项 P1（结论错位/保存入口/等待计数/保留提醒/案例供给）→ M150 六项重复 P2 文案与结构。图纸灵感线与任务书路径修复后需补定向模拟。
2. M122 表征后模块化（表征已完成，见 `docs/m122-extraction-map.md`；styles 拆分必须测试契约先行）→ M123 可重复发布收口（CI 草案已就绪未验证、干净机器证明、刷新发布证据；`docs/release-evidence-2026-07-16.md` 与 8 张旧 PNG 引用已删 Run，留在 Git 外等 M123 一并处置）。

## 工作区保护

- 工作树是用户资产。未跟踪的 `.artifacts/`（含数据备份 ZIP 与 PNG）和 `docs/release-evidence-2026-07-16.md` 是有意留在 Git 之外的，不要重置、覆盖或顺手清理。禁止 `git add -A`、reset、checkout、clean。
- 重要决策写 `findings.md`；阶段和验收写 `task_plan.md`；进展、错误和恢复点写 `progress.md`。不要写逐命令流水账；本文件只在架构、已验证基线或唯一下一步实质变化时更新。

## 给新对话的第一句话

> 继续 ArchResearch。先完整读取 HANDOFF.md，再按它读取 task_plan.md、findings.md、progress.md；不要重做已完成工作，不要恢复 Firecrawl，先汇报当前状态和唯一下一步，然后继续执行。
