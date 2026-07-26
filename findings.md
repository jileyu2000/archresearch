# Findings

> M0–M120 时期的发现已归档至 [docs/history/findings-archive-2026-07.md](docs/history/findings-archive-2026-07.md)，只在追溯根因时查阅。

## M121 next-step planning

- `task_plan.md` 的 completion roadmap 仍以 M113 和 327/107/165/8 为基线，未吸收 M118 幂等启动恢复、M119 完整工作区备份/预检/失败回滚和 M120 保守清理。当前权威基线是 341 API / 112 Board / 165 Extension / 8 packaged E2E，API/Board 200，3 projects / 13 completed Runs / active 0。
- 可继承但未批准的产品方向只剩三类：M109 目标用户验证、M110 维护性/稳定性收敛、M111 可重复发布。M107 任务书流程已完成，M108 来源反查已由 M113 删除，收藏、备份和工作区清理均不应再被包装成新功能。
- 当前三个主要维护热点仍高度集中：`apps/board/src/App.tsx` 3,930 行 / 189,568 bytes，`apps/board/src/styles.css` 4,325 行 / 103,839 bytes，`apps/api/src/archresearch_api/workflow.py` 4,716 行 / 203,751 bytes。拆分前必须先建立行为字符化和覆盖率基线，不应在无保护时一次性重构。
- 仓库当前没有 `.github` CI 文件。README 只记录 Windows 11 / Chrome / Python 3.12 / Node 24 / pnpm 11 的手工 setup/start；`scripts/setup.ps1` 会创建根 `.venv`、安装 Python/Node 依赖并构建扩展，但尚无 clean-machine/update 验收与 CI 复现。`pytest-cov` 已是 dev dependency，但尚无一致的 API/Board/Extension 覆盖率报告或门限。
- M119 备份只覆盖 SQLite 与 durable 用户数据，明确不包含源码。当前 104 个 tracked diff 路径与多个 untracked 产品/测试/迁移文件仍只存在工作树；在继续大规模实施前，最高优先级是经用户单独授权后冻结可恢复的源码基线，不能把数据备份误当成源码备份。

## M121 Xiaohongshu-derived proxy test

- OpenCLI 1.8.6 的 `xiaohongshu` 适配器提供只读 `search` / `note` / `comments` 命令，足以保留公开笔记 URL 并提取问法；不需要也不允许使用 ask、follow、publish 等写操作。
- 当前 OpenCLI daemon 1.8.6 在 19825 正常运行，但 Browser Bridge extension 未连接，doctor 为 `Extension: not connected / Connectivity: failed`。因此专用 CLI 路径尚未访问小红书；按 browser skill 可改用用户 Chrome 已有登录态，但如 Chrome 也未登录，必须请用户在该浏览器登录，不得换站点伪造样本。
- browser runtime 首先选择 in-app Browser，直连小红书聚焦搜索页在 30 秒内未完成并导致控制会话重置；未输入、点击、下载或创建 Run。改用 Chrome 后，`agent.browsers.get("extension")` 报 browser unavailable，连续两次轻量列表均只发现 in-app Browser，确认 ChatGPT Chrome 控制链当前不可用。
- 技能规定的四项诊断进一步确认：Google Chrome 150.0.7871.182 已安装，但当前 `running=false`；Default profile 中 ChatGPT Chrome Extension 1.2.27221.15725 已安装且 enabled；native host manifest/registry/origin 全部正确。唯一阻塞是 Chrome 未运行；按技能要求，必须先得到用户确认才能执行 `open-chrome-window.js`。
- 用户批准后，启动脚本实际打开 Chrome，尽管脚本本身未在 30 秒内返回并使控制内核重置。之后只读检查确认 `running=true`，Chrome browser binding 出现且可用；没有重复启动。
- Chrome 的聚焦搜索 `建筑学课程设计 求助` 成功加载，页面显示已登录的“我”入口。首轮候选笔记包括 `6a2a5e74` 建筑排布课设求助、`69498a11` 建筑设计困惑、`69f856bb` 展板纳入求职作品集、`69dcf0dc` 建筑成图指导、`6a250dab` 方案设不出来、`69eac2b8` 课程作业如何完成、`68a00785` 医疗建筑设计、`6a2e5c42` 求助、`692d7be3` 设计求助。候选只是标题层，必须逐篇读正文才能形成测试问题；代做、付费服务和纯情绪帖排除。
- 样本 XHS-P01（`https://www.xiaohongshu.com/explore/69498a11000000001e03a63c`）正文询问“什么样的设计是好设计、大学各阶段应完成什么目标”，作者评论进一步明确“拿到任务书后如何分析并确定核心理念、怎么进行案例分析、再开始做图”。可去个人化为两条高价值建筑研究测试问题：A）拿到任务书后，如何从场地、功能与限制中确定核心理念，并用案例研究推进方案；B）建筑学生应如何建立判断方案好坏的标准，避免只追随老师偏好。
- 样本 XHS-N01（`https://www.xiaohongshu.com/explore/6a2a5e7400000000080265a0`）正文只是“给了第一个图，第二个图怎么画”，图与评论表明它是天正给排水/45° 轴测图生成的软件操作问题。这应作为负样本：不属于建筑案例研究，也不是“找图纸风格灵感”；产品应识别边界，而不是用案例研究假装回答具体 CAD 命令。
- 样本 XHS-B01（`https://www.xiaohongshu.com/explore/69f856bb000000003700c3e7`）想把原有 100+ 页 A3 / 7 张 A0 课设压缩为作品集中约 5 页，具体矛盾是“保留哪些效果图、平面、草图与分析，是否为信息量重画大图”。去个人化问法为：“如何把一个信息量很大的建筑课设压缩成 5 页作品集，保留完整设计逻辑而不只是堆图？”这是高价值用户需求，但属于“学生自有项目内容编辑”，当前 ArchResearch 只会研究外部案例与导出研究成果，不能假装已读取整套学生图纸并完成作品集编辑。
- 样本 XHS-N02（`https://www.xiaohongshu.com/explore/6a250dab000000001603ff77`）只表达“设不出来”、拖延和临近截止，没有场地、功能、空间矛盾或输出类型。这不能直接成为研究题；正确产品行为应是要求用户补充“什么建筑/哪个设计冲突/希望得到案例还是图纸灵感”，而不是启动昂贵且泛化的 Live Run。
- 样本 XHS-N03（`https://www.xiaohongshu.com/explore/692d7be3000000001e027f13`）描述次日提交 4 张 A2 图前的焦虑、害怕失败与无法开始。它没有可研究的建筑类型或空间冲突，应作为需要温和分流的支持边界；产品不能把心理压力伪装成案例研究问题，也不应据此创建 Live Run。
- 下一候选 `6a2e5c42000000001503dfed` 在详情页加载期间超时，尚未取得可验证正文，不能把标题“求助”计入样本。Chrome 控制内核被自动重置后，应重新绑定现有 Chrome，而不是重复启动窗口。
- `6a2e5c42000000001503dfed` 随后已在原 Chrome 标签中显示标题“求助”，但整页文本读取与结构化内容导出分别再次超时。没有取得正文就没有问题证据；该候选正式跳过，不再重试，也不计入 8–10 条语料。
- 样本 XHS-B02（`https://www.xiaohongshu.com/explore/668fa4a9000000002500570f`）明确描述三合一合用前室为改善入户体验而增设隔墙与普通弹簧门，并追问双向疏散和“前室套前室”的合规风险。去个人化问法为：“高层住宅三合一合用前室中，增设隔墙和普通弹簧门以兼顾入户体验与双向疏散是否合规，会不会形成前室套前室？”这是具体且真实的设计冲突，但结论需要现行消防规范与审图口径；当前 ArchResearch 的案例研究不能替代规范核验，应明确边界而非给出伪合规结论。
- 候选 `69d0f72e000000002202897c` 的公开页只返回标题“逼仄的夹缝空间就这样被激活了”，服务端初始数据没有可验证正文；不能仅凭标题改写成学生问题，跳过且不计入语料。
- 样本 XHS-P02（`https://www.xiaohongshu.com/explore/684d3bb8000000002102e97a`）说明连廊可连接分散建筑、改善流线，并通过坡道/台阶处理高差和提供全天候通行。去个人化学生式问法为：“既有建筑改造中，如何用连廊连接分散且有高差的体量，同时改善日常流线、全天候通行和新旧建筑关系？”它适合建筑案例研究；产品应以多个正式案例比较连接位置、结构独立性、无障碍坡度、气候边界与新旧界面，而不是照抄帖子的泛化结论。
- 样本 XHS-P03（`https://www.xiaohongshu.com/explore/6a44a817000000002100b389`）提出天窗自然采光、挑空中庭、交错楼梯、回游走廊与多材质公共空间。去个人化学生式问法为：“封闭且采光不足的公共建筑，如何通过中庭、天窗和回游动线改善自然采光并形成可停留的公共核心？”它适合建筑案例研究，但需要案例证据说明采光机制、剖面关系和适用边界，不能把“都能套用”当成事实。
- M121 代理语料已达到 9 条：4 条建筑研究正向输入（XHS-P01 两问、XHS-P02、XHS-P03）与 5 条边界/负向输入（XHS-N01、XHS-B01、XHS-N02、XHS-N03、XHS-B02）。这足以进入产品适配筛选；继续采集只会增加相似样本，不应替代真实学生观察。
- 启动器适配筛选：XHS-P01A（任务书→核心理念）可直接进入建筑设计研究，有真实任务书时应作为可选 PDF 收束范围；XHS-P01B（好设计标准）只在补充项目阶段与建筑类型后适合研究，否则过宽；XHS-P02（既有建筑高差连廊）和 XHS-P03（中庭采光/回游动线）可直接进入建筑设计研究。四者都不是图纸灵感任务。
- 边界分流：XHS-N01 是 CAD/天正命令；XHS-B01 需要读取并编辑学生整套作品集；XHS-N02 信息不足；XHS-N03 是情绪支持；XHS-B02 需要规范与审图口径。当前产品应分别拒绝伪装成案例研究、要求补充、或明确不能给出合规/心理支持结论，不能因为文本可提交就机械创建 Run。
- 唯一 Quick Live 选择 XHS-P02：“既有建筑改造中，如何用连廊连接分散且有高差的体量，同时改善日常流线、全天候通行和新旧建筑关系？”它具有清晰建筑对象、三个可验证机制维度和案例研究适配性，且归属于现有“旧厂房社区文化中心”项目。XHS-P03 保留为离线筛选样本，不再为凑数量创建第二条 Run。
- 唯一 M121 Quick `5e4184cf-c3e7-47ce-bc5d-8761bcc632a1` 在 attempt 0 以 `completed / completion_satisfied` 结束：26 usable、3/3 coverage、gaps 0、Firecrawl 未恢复。规划的三题准确覆盖高差与流线分离、全天候连廊复合使用、新旧结构/材料节点，说明问题入口和拆解对真实学生式空间冲突是适配的。
- 研究质量没有达到“已解决学生问题”的标准：`coverage_report.project_count = 1`，且 enrichment 明确缺 `insufficient_project_diversity` 与 `insufficient_multi_asset_projects`。结果列表虽有 4 个项目/26 资产，但另外 3 个只提供图纸列举或有限正文，26 个结果全部为 `partial`；唯一正式覆盖来自 Designboom 的再利用集装箱孵化器。
- 该唯一正式项目能证明碎片化体量、连续互联空间、通透界面、日光与交流，但不能证明被连接对象是既有高差体量，不能证明公众/后勤流线分离、全天候围护，也不能证明新介入与原有砖混外壳的结构独立性或连接节点。综合对这些缺口标注诚实，4 条建议也明确区分证据事实与目标项目推断，这是证据边界优点；但主要问题本身没有获得直接案例回答。
- 当前完成语义存在代理测试暴露的 P1 产品风险：`_completion_satisfied()` 只检查 coverage gaps，不检查 enrichment gaps，因此一个项目跨三题提供有限机制就能显示 `completed/completion_satisfied`。真实学生会把“完成”理解为已有足够案例依据，而不是“每题至少有一条部分证据”。在新增功能前，应先决定是否让直接性/项目多样性不足进入 partial 状态或至少在结果首屏显著显示“依据不足”。
- Loaded Board 无截图核对确认最新记录在“旧厂房社区文化中心”正确显示并可打开，完整结果页、3 个子问题、案例证据和后续工具均能渲染。页面同时显示“研究已完成”“每个子问题都已找到方案证据”，但案例区明确只有“1 个项目已核对项目原文”、23 张网页图片只作预览，且每题唯一项目都标“已有依据，仍需核对”。这不是隐藏证据问题，而是顶层完成文案与下层真实证据强度不一致。
- 第一题摘要还显示“4 个方案项目 · 12 条案例证据”，实际正式 dossier 仍只有 1 个项目；它把保留的 partial/图片线索数量混入用户理解的“方案项目”。代理测试因此给出两个相互关联的 P1：完成状态过强、问题拆解计数口径易误导。修复前不应通过再开 Run 来寻找更好样本。
## 2026-07-26 M121 proxy-result repair evaluation

- The M121 Run is not a failed workflow. `workflow._completion_satisfied()` deliberately means that `coverage_report.gaps` is empty; `_enrichment_satisfied()` separately requires no `enrichment_gaps`. This preserves a useful terminal answer after all three subquestions have at least one source-bound result, even when depth targets are not met.
- The misleading completion claim is created in the Board projection. `runAnnouncement()` maps every architectural `completed` Run to `研究已完成`, although the loaded Run already carries `completion_satisfied` and two enrichment gaps. The same projection is reused in recent history, so fixing only the result-page heading would leave inconsistent language.
- The status-strip count has the same semantic problem: `resultCountLabel` uses backend `usable_assets`, so the tested result can read as 26 usable references even though only one project passes the Board's existing text-evidence gate. Pipeline-usable assets and formal case evidence are not interchangeable user concepts.
- Subquestion summaries currently count every non-XHS result as a case asset/project, including results whose `analysisReady` is false. The formal case section already applies the correct gate (`non-visual-platform && analysisReady`) and therefore reports one evidence-qualified project. Reusing this established gate is a smaller and safer fix than adding a schema or parallel evidence classifier.
- Recommended repair surface, if authorized, is Board-only: derive an evidence-strength presentation state from `coverage_report.gaps` and `enrichment_gaps`, use it in loaded and recent status copy, and make the status/subquestion counts distinguish formal projects from public-page/image leads. No workflow, API schema, database, source policy or Run lifecycle change is required.
- Changing backend `completed` to `partial` was rejected for this finding. It would turn a quality-depth shortfall into an execution-state regression, expose retry UI, affect accepted historical Runs, and conflict with the policy that useful incomplete research remains available. Such a change would require a separate impact audit and stronger evidence than this one proxy Run.
- Required characterization shape is the exact observed contradiction: 3/3 coverage, one formal project, several partial lead projects, project-diversity and multi-asset enrichment gaps, plus synthesis limitations that deny direct proof of key target conditions. The negative control is an enrichment-complete architectural Run; visual inspiration and current partial/blocked retry behavior are out-of-scope regressions to guard.

## 2026-07-26 M124 approved scope

- The user explicitly superseded the prior Board-only recommendation: architectural research must reach all configured depth/enrichment targets before it may be called complete, and result content must not appear while the Run is active. Bounded provider failure still cannot be fabricated as success; exhaustion must terminate honestly as partial/blocked while preserving checkpoints internally.
- The first screenshot was initially misread as a request to remove the complete Run-history dialog. The user's clarification screenshot identifies the actual target: the workspace-selection popover that contains “当前项目 / 历史归档”. The complete Run-history dialog and compact latest-three list are not requested changes and must be restored.
- Impeccable product guidance still supports the corrected inline direction: workspace context should be visible without a transient dropdown, using the existing flat work-surface vocabulary rather than cards. Current and archived workspaces can become a directly visible labelled selection list; selecting one continues to filter its Run records.
- Active Board content currently arrives through three paths: `openRun()` hydrates an active Run immediately, startup restoration hydrates the latest active Run, and the poll loop calls `syncProvisionalResults()` every second. All three must be gated; hiding only the result section would still spend requests and retain stale provisional state.
- The workflow's normal-round stop condition emits `completion_satisfied` as soon as minimum subquestion coverage is present, while the query loop skips already covered subquestions during recovery rounds. Strict full-depth delivery therefore requires both removing the minimum-completion break and allowing bounded recovery rounds to continue enrichment; changing only final status would not make another attempt to reach the full target.
- The user's final clarification removes the workspace taxonomy from this surface entirely: no workspace popover, no inline “当前项目 / 历史归档” replacement, and no extra project-name layer before records. The direct objects are question-derived Run titles. Workspace IDs still remain in Run data so opening a record can restore its background project context and new research still saves to an active workspace.
- Recovery search confirms the visible home implementation already follows that final direction. Remaining matches are either explicit negative assertions, unrelated collection copy, or stale tests/docs that still describe the removed menu and latest-three/history-dialog model. Those stale contracts must be updated; the flat cross-workspace list itself should not be redesigned again.
- Loaded no-screenshot DOM inspection confirms the current Board renders all 14 Runs as one question-title list. There is no visible workspace selector, “当前项目 / 历史归档” taxonomy, archive region or history dialog; “新建项目” is the only explicit project action. The remaining user-facing mismatch was documentation that still described the superseded current-project/latest-three/history-dialog model.

## 2026-07-26 M124 completion findings

- The final information hierarchy is deliberately flat: the direct object is a research question record, not a Workspace category. Project ownership still exists in data and is restored when a record opens, but it does not create a visible navigation layer on the home surface.
- Strict completion and flat history are one coherent contract. Architectural Runs only announce `completed` when coverage and enrichment both pass; useful under-depth Runs become `partial`, while legacy completed records with enrichment gaps use the honest presentation “研究已形成初步依据”. Active Runs keep checkpoints internally but do not fetch or expose provisional result content.
- The visually hidden workspace-name marker remains only as asynchronous test synchronization. It is `aria-hidden`, provides no visible or navigable project taxonomy, and does not reintroduce the removed selector.
- Impeccable distillation confirms the cut removes an obstacle rather than functionality: question records, retention actions, opening results and “新建项目” remain directly available; the workspace selector, project/archive grouping, separate archive region and history dialog do not earn a place and are absent.
- Final authoritative verification passed at 341 API / 113 Board / 165 Extension / 8 packaged E2E plus Ruff/format, strict Mypy, ESLint, TypeScript, production builds, process/security tests and 25/108 evaluation. Loaded no-screenshot DOM verification found 14 flat question records, no visible project/archive categories, no workspace selector, no history dialog, exactly one “新建项目”, no horizontal overflow and no page errors.

## 2026-07-26 M125 recent-history density finding

- The user screenshot shows M124's flat history semantics are correct but its page density is not: all 14 records extend the home page, while the grid-only header places “新建项目” on a separate row after the title and description, creating roughly one record-row of avoidable empty space.
- The appropriate reduction is a bounded native scroll viewport, not another category, modal or hidden “view all” branch. All question records remain immediately available in one list, but only about four are visible at once; keyboard users need a named focusable scroll region.
- The header can remain in the existing markup and become a two-column grid: title/description at left and the existing project action at top right. No new card, navigation layer, copy or data contract is required.
- The completed implementation caps the viewport at `min(400px, 55dvh)` and keeps native vertical scrolling, `overscroll-behavior: contain`, stable scrollbar space and a visible focus outline. This shows roughly four records in the user's compact view while preserving every record and retention action in one accessible list.
- Loaded no-screenshot geometry at 445×736 reports header height 52.8px, history client height 400px versus 1,871px scroll height, 14 record rows, page overflow 0 and page errors 0. At the default 1030×986 viewport the same header is 52.8px and the 400px history contains 1,162px of scroll content.

## 2026-07-26 M126 shorter recent-history viewport

- The user requested a second, narrower visible history length. The smallest scoped response is to reduce only the existing native scroll viewport from `min(400px, 55dvh)` to `min(320px, 45dvh)`; all 14 cross-workspace question records, keyboard focus, native scrolling, opening and retention remain unchanged.
- The focused CSS contract was changed first and failed against the old production cap as intended. Production CSS and the Board product/design contracts now agree on roughly three visible records rather than four.
- Loaded no-screenshot geometry under the 445×736 viewport override reports a 320px history client/rect height over 1,871px scroll content, 14 record rows, page overflow 0 and page errors 0. The browser reported 446px inner width under the 445px host override; this does not cross the 620px/860px responsive boundaries or affect the acceptance result.
- The narrower viewport does not reintroduce a preview, modal or taxonomy. It remains the same named, focusable native scroll region, so the density improvement does not hide records behind a second interaction model.

## 2026-07-26 M127 restart-safe local availability

- M118 made `scripts/start.ps1` restart stale/partial services and reuse a healthy pair, but no Windows login/startup registration invokes that script. A machine restart therefore always terminates API and Vite, leaving `127.0.0.1:5173` unavailable until a manual start. This is an activation gap, not another listener-health bug.
- The smallest durable fix is a current-user, non-admin login startup entry that launches the existing verified start script invisibly. The startup mechanism must point to an absolute workspace path, be idempotent and have an explicit removal path; process ownership and health remain delegated to M118 rather than duplicated.
- The real pre-fix state reproduced the report: both `/health` and Board timed out while `.archresearch/dev-processes.json` still named listeners from the prior login. Running the existing start script replaced those stale listeners and restored 200/200, confirming that automatic invocation is the missing link.
- The installed current-user shortcut lives at `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\ArchResearch.lnk`, targets the resolved PowerShell 7 runtime, invokes the absolute workspace `scripts/start.ps1` with a hidden window and uses the workspace as its working directory. No administrator or machine-wide task is required.
- Registration is safely idempotent and removable. It refuses to overwrite or delete a same-name shortcut unless its PowerShell target, exact start-script arguments and workspace directory identify this installation.
- The full repository gate includes the new autostart test and passes at 341 API / 114 Board / 165 Extension / 8 packaged E2E, plus Ruff, format, strict Mypy, ESLint, TypeScript and production builds. The change does not depend on a provider key, Firecrawl, a Live Run or browser automation.

## 2026-07-26 recovery verification

- The latest authoritative recovery state is 3 projects / 14 Runs / active 0. Older HANDOFF entries with larger historical Run counts are superseded by the later retention and product-work milestones.
- M77, M78, M93, M126 and M127 are all `implementation_complete`. M121 is the only `in_progress` phase and cannot complete without observing 2–3 real target users.
- Run `10d31b4c-94dd-4442-b24a-fc1b241e658e` remains completed / attempt 0 / coverage_satisfied, permanently sealed and never eligible for retry.
- `HANDOFF.md`, the active phase table, recent findings/progress and `git status --short --branch` all agree that there is no approved automatic next product step. The full dirty and untracked worktree is user-owned state and must be preserved.

## 2026-07-26 next-step recommendation

- The highest-value next step is not another UI feature or workflow optimization. M124–M127 closed the known completion, history-density and restart-availability problems; the remaining product-confidence gap is still M121's lack of direct observation from 2–3 real target users.
- The completed proxy round is useful for question-shape and result-strength diagnosis, but it cannot measure task completion, time, navigation, result comprehension, collection retrieval or recovery expectations. Repeating proxy Runs would add cost without closing the M121 gate.
- The pilot should cover 8–10 de-identified tasks across architectural research, one project-brief path, visual inspiration, result-state comprehension, history reopening and collection retrieval. Participants must initiate their own tasks; Codex must not auto-create Live Runs.
- Findings should trigger implementation only when severity is P0/P1 or the same P2 pattern repeats across at least two participants. This prevents another redesign from a single comment while still escalating safety, trust and core-task failures immediately.
- M122 modularization remains valuable but should follow the pilot and a separate source-baseline decision. The current 104-path tracked diff plus untracked product files are not protected by the M119 data backup, so broad refactoring before that decision increases recovery risk without user evidence.

## 2026-07-26 M121 plan terminology correction

- “来源核验” was an incorrect summary label for the new pilot plan. Source lookup/TinEye was removed by M113 and is not a current product flow, pilot task or roadmap candidate.
- The intended pilot coverage is result-state comprehension: whether users understand completed versus initial-basis output, formal project cases versus preview leads, and visual-inspiration-only material. It does not ask users to perform source lookup or reverse-image verification.

## 2026-07-26 M128 answer-first interface redesign

- User-provided screenshots identify the architectural result page and architectural collection detail as the current readability failures. Both fragment one answer into many small labels, columns, metadata rows and nested disclosures; the result page also hides useful case content behind “查看完整案例与证据”.
- The product goal for both surfaces is now explicit: users want the research result, not how the system researched it or where it came from. The primary UI should expose conclusion, case mechanism, actions, boundary and necessary project images by default; source/provenance/status/verbatim/audit material must not compete on these two surfaces.
- M128 is limited to Board information architecture, rendering, styles, tests and current product/design documentation. Evidence binding and provenance remain in backend/durable data; visual inspiration, APIs, schemas, exports, selection semantics and collection persistence remain unchanged.
- Screenshot audit: every result question repeats a large numbered heading, a separate white summary band, a four-column representative-case ledger, source/status metadata and a closed disclosure. The same answer is split across five reading stops, and the only fuller case content is hidden behind the disclosure.
- Screenshot audit: the collection detail uses abundant width but separates the project title, solution text, numbered moves, images and detached top-right actions into distant islands. The visible project title also mixes project, architect and publication identity, while “打开来源” competes with the actual saved result.
- The shared redesign unit should be one continuous case answer: project identity; a concise mechanism statement; two or three actionable moves; a short applicability boundary; and only the images needed for recognition. Question-level synthesis should precede these units once, not repeat as labels inside each case.
- A bounded HTTP read confirmed CollectUI is reachable, but its category page exposes no useful server-rendered article/list/detail examples to inspect without resuming browser automation. The applicable pattern is therefore the editorial principle behind those references rather than a copied component: a strong chapter lead, flat ruled entries, generous reading width, and one recognition image aligned with each answer.
- The minimal implementation should delete the result-page representative ledger plus hidden full dossier split and render every evidence-qualified dossier once, in source order, as a visible answer unit. Collection detail should remove the original-question repetition and architecture source action, keep deletion, and present the saved mechanism as the lead followed by at most three moves, one non-audit applicability boundary and the existing recognition images.
- The implemented architectural result surface now has one chapter lead and one flat answer unit per evidence-qualified project. It no longer renders the separate question-summary band, representative ledger, project-condition ledger, evidence gallery, source footer, source inspector trigger, completed-run progress disclosure or unassigned lead group. Each project keeps collection selection, up to three transfer moves, one boundary and at most one available recognition image.
- The collection detail now suppresses the repeated original research heading and architecture source link, keeps delete and all persistence behavior, filters audit-like limitation strings from the visible boundary, and uses a constrained editorial text/image split with one dominant image. Drawing collection markup and actions are unchanged.
- Loaded legacy Runs exposed display residue that the deterministic fixtures had not covered: completed architectural results still showed a status strip; synthesis recommendations retained “转译建议 / 该建议转译自” wrappers; boundaries included `drawing_ids`, “源网站入口”, “页面仅支持” and “未覆盖研究子问题”; and some project names ended with `| ArchDaily`. The Board now removes only those presentation artifacts while preserving the original synthesis, limitations and project names in durable data.
- Architectural result and collection project titles strip only recognized publication suffixes (`ArchDaily`, `ArchDaily China`, `Dezeen`, `Designboom`, `Divisare`). Architect or studio identity before the suffix remains visible, and visual-inspiration naming is unchanged.
- No-screenshot loaded QA passes at 1440×900 and 390×844. The architectural result shows 3/3 chapters and 3/3 visible cases, no `<details>`, status strip, source/audit text, hidden content, page overflow, clipped text or unloaded recognition images. The architectural collection detail shows 2/2 visible cases, 3/1 loaded images, no source/audit copy or publisher suffixes, a stable desktop two-column split, a mobile single column and 44×44 delete controls. The mobile result filter is now 44px high. Console errors are 0 and the temporary viewport override was reset.
- The authoritative M128 gate is 341 API / 115 Board / 165 Extension / 8 packaged E2E with every static, type, build, process, security and evaluation check passing. Durable state remains 3 projects / 14 completed Runs / active 0; the sealed Run is unchanged and no runtime data was written.

## 2026-07-26 完成度检查与运行保留期 P0

- 只读复验确认记录属实：3 workspaces / 14 research_runs（全部 `completed`，active 0）、158 asset candidates、304 source pages、302 evidence claims、1,486 trace events、14 reference boards、5 saved references、1 input artifact。API 测试用独立 `pytest --collect-only` 实测 341，与 M128 门禁数字一致；Board 115 / Extension 165 / 8 packaged E2E 沿用 M128 那次全绿门禁，本轮未重跑。
- 新发现 P0：14 条 Run 的 `keep_forever` 全部为 0，其中 12 条在 `2026-08-03T17:56:37Z` 同时到期（M92 采纳宽限期 + 14 天），`ff16988d` 与 `5e4184cf` 分别在 08-06 与 08-08 到期。`main.py:131` 在每次 API 启动的 lifespan 中无条件调用 `cleanup_expired_data`；`lifecycle.py:45-54` 选出到期 Run，`lifecycle.py:113-153` 的 `delete_runs` 对 Run 及其级联 assets/sources/claims/traces、磁盘 `runs/<id>` 与 `exports/<board_id>` 做硬删除。M127 的开机自启会在每次 Windows 登录时触发该启动路径。
- 后果链闭合：2026-08-03 之后的首次无人值守登录即会删除 12 条记录，包含封存 Run `10d31b4c-…` 与全部三档验收 Run（`a2cf2e20`、`d995bed5`、`76f52c79`、`f5be3f17`、`23b6f84c`）及旧发布证据引用的 `7d8faa53`/`b4c314a6`/`d13bdc67`；8 月 8 日后 14 条全失。HANDOFF 的"永久封存"此前只约束不得 retry，不构成删除保护——语义与代码脱节。
- 备份不能替代保留标记：`.artifacts/archresearch-backup-20260725T200720.zip`（70,993,145 B、manifest + 66 数据文件、含 `data/archresearch.db`）确实留存，但其中的 Run 携带**已过期**的 `retention_expires_at`，恢复后下一次 API 启动会把同一批 Run 再删一遍。
- 可见性判断修正：Board 最近研究的每条记录本就有"还剩 N 天 / 设为永久"控件（`App.tsx:585-594`），倒计时并非不可见。真正缺失的是不可替代的验收证据与普通 Run 之间没有任何区分、没有跨记录的集中到期提示、删除后没有撤销。
- 处置：经用户批准，用产品既有 `PATCH /v1/runs/{run_id}/retention` 把 14 条 Run 全部标为永久保留，未改代码、schema 或迁移，可逐条撤销。独立重开只读 SQLite 复读为 `keep_forever=1` / `retention_expires_at` 为空 14/14，按 `lifecycle.py` 原始谓词实测当前可删除 Run 为 0、仍挂到期时钟的 Run 为 0。
- 记录中的 M122 文件规模已过时：实测 `App.tsx` 3,881 行、`styles.css` 5,132 行、`workflow.py` 4,971 行，样式表比旧记录多 807 行。工作树现为 104 个已跟踪改动路径 / +27,400 −4,788 加 16 个未跟踪条目，仍不在 M119 数据备份范围内。

## 2026-07-26 M129 源码基线保护（已批准的 A→B→C 顺序中的 A）

- 边界重算：`98a9a01` 之后的全部实现共 130 个路径（104 个已跟踪改动 = 95 modified + 5 deleted + 4 工程记录，加 26 个未跟踪文件）。无缺口、无重叠地分为 112 个产品路径、5 个工程记录（`AGENTS.md`、`HANDOFF.md`、`task_plan.md`、`findings.md`、`progress.md`）、11 个发布证据路径（manifest + 10 张 PNG，约 2.0 MiB）和 2 个排除的本地工具输出。
- 两个本地输出此前完全没有被 ignore，笼统 `git add -A` 会把它们提交进去：`.artifacts/archresearch-backup-20260725T200720.zip`（70,993,145 B，内含真实 SQLite 数据库）与根 `.impeccable/critique/`。`.gitignore` 已精确补上 `.impeccable/` 与 `.artifacts/*.zip`，同时保留 `.artifacts/portfolio/` 可见，使发布证据仍是显式选择而不是被静默忽略。
- 凭据扫描对“确实要提交的内容”执行，而不是全仓：全部已跟踪 diff 新增行加 14 个未跟踪候选文件，按 provider key、`sk-`/`sk-ant-`、AWS key、GitHub/Slack token、Bearer、私钥头、`X-Amz-Signature`、`api_key=`/`secret=`/`password=` 字面量匹配，命中 0。产品源码、Board、Extension、脚本、`.env.example` 与 README 中 Firecrawl/TinEye 引用 0，绝对用户路径 `76384` 泄漏 0。
- 用户决定：发布证据层暂不纳入 Git。10 张 PNG 是 M46 之前旧运行的截图，`task_plan.md` 已记录它们不能证明当前三档质量；仓库先保持无二进制资产，等 M123 刷新证据时再决定。文件仍保留在磁盘上。
- 门禁在提交前重跑并全绿：341 API / 115 Board / 165 Extension / 8 packaged Chrome E2E，加 dev-common 测试、Provider 配置安全契约、autostart 测试、评测夹具（25 research tasks + 108 classification samples）、Ruff check、Ruff format 51 files、strict Mypy 19 source files 与根 `pnpm run check`（lint/typecheck/test/build）。
- 唯一无法执行的门禁步骤是 `scripts/tests/process-lifecycle.tests.ps1`。本会话 shell 的 CIM/WMI 运行时已损坏：`Get-CimInstance Win32_Process` 直接抛 `Microsoft.Management.Infrastructure.Native.ApplicationMethods` 类型初始化异常，禁用沙箱后同样失败，因此这是环境限制而非代码回归；M127/M128 曾在 Codex 环境下通过该脚本。
- 共享工作区并发写入已被实测确认，必须作为长期约束记录：本 Codex 会话在我提交后仍在写同一工作树，`scripts/tests/process-lifecycle.tests.ps1` 与 `scripts/dev-common.ps1` 的 mtime 分别为 20:03:14 与 20:03:44（提交发生在约 20:02–20:03），`dev-common.ps1` 从提交内的 269 行增长到工作树 431 行，改动方向正是把监听进程检测改为不依赖 WMI。结论：本工作区的 `git add` 只能保证“逐文件读取时刻”的快照，任何跨文件一致性都必须与并发写入方协调，提交前后都要重新读 `git status`。

## 2026-07-26 M130 首页“已完成 / 已形成初步依据”混排诊断

- 用户提出的规则本身没有失效。M124 之后的终态判定在 `workflow.py:1373` 只有 `_enrichment_satisfied(coverage)` 为真才写 `completed`，即 `gaps` 与 `enrichment_gaps` 同时为空，`stop_reason` 恒为 `coverage_satisfied`；达不到就是 `partial`。按当前代码不可能再产生“completed 但深度不足”的记录。
- 混排的成因完全是历史数据。14 条 Run 创建于 2026-07-11 至 2026-07-25，全部早于今天落地的 M124。旧规则只要求 `gaps` 为空（`completion_satisfied`），不检查 enrichment，因此 7 条 Run 持久状态是 `completed`，`coverage_report.enrichment_gaps` 却非空，且带着当前代码已不可能再产生的 `stop_reason=completion_satisfied`。M124 没有改写这批数据，只在 Board 增加了诚实降级标签。
- 实测每条记录的显示标签：6 条建筑 Run 显示“研究已形成初步依据”（`7d8faa53`、`b4c314a6`、`42668844`、`76f52c79`、`ff16988d`、`5e4184cf`），4 条建筑 Run 显示“研究已完成”（`58f4b9f9`、`d13bdc67`、`a2cf2e20`、`d995bed5`），4 条图纸灵感 Run 显示“已完成”。用户截图中的两条“初步依据”加一条“已完成”与此一致。
- 发现一个当前代码的真实不一致，与历史数据无关：`App.tsx:407-414` 的 enrichment 降级条件写死了 `run.goal === 'precedent_research'`，图纸灵感 Run 走 `visualLabels` 直接显示“已完成”。`e525ca77` 正是 `completed` 且 `enrichment_gaps=['insufficient_verified_or_partial']`，与被降级的建筑 Run 条件相同却仍自称已完成。同一条件两种诚实标准，是这份列表看起来随意的直接原因。
- `58f4b9f9`（2026-07-11）的 `coverage_report` 根本没有 `enrichment_gaps` 键，Board 的 `?? 0` 把它当作无缺口。这是比 enrichment 规则更早的记录，不能与真正达标的 Run 混为一谈，但也不应假装它被评估过。
- 不采用回填持久状态的修法：这 7 条里包含 M53/M65 的三档验收 Run 与旧发布证据引用的 `7d8faa53`/`b4c314a6`，改写它们的 `status` 会使既有验收记录与发布证据失真。修复只在展示层进行，durable 数据不动。

## 2026-07-26 M131 旧深度不足 Run 的定向删除

- 用户判定这批旧记录属于失败记录并要求删除，后续会有新的实际测试。核对后指出其中两条不是失败记录而是记录正在引用的验收证据，用户随即确认删 5 保 2。这条边界值得固化：**“深度不足”不等于“失败”，删除前必须逐条对照它在 `HANDOFF.md`/`task_plan.md` 里的身份**。
- 已删除 5 条：`7d8faa53`（M46 之前的 Balanced 发布证据）、`b4c314a6`（同期 Deep 发布证据）、`42668844`（HANDOFF 第 9 条的 Quick 链路验收）、`e525ca77`（M76 图纸灵感 Live）、`5e4184cf`（M121 代理轮 Quick）。保留 `76f52c79`（M53/M65 被接受的 Deep）与 `ff16988d`（M107 唯一真实任务书 Standard Run）直到新的实际测试产生替代证据。
- 删除前先用产品自带的 `POST /v1/data-backups` 生成 70,957,655 字节完整备份并通过 `POST /v1/data-backups/preflight`：`ready=true`、66 文件、14 Runs、5 收藏、1 份任务书，SHA-256 `2B8D692BB01C257F7B345B52FC9D0D46C39FE9CCC21C6AF35FE563D4B7956A4C`。因此这次删除可整体回滚，不是不可逆操作。
- 删除走产品既有的 `lifecycle.delete_runs` 安全 helper，不写裸 SQL：显式 run_id 列表、目标必须全部存在、目标与保留名单不得重叠、保留名单在删除前必须都在。执行前停服、执行后重启，避免与运行中的 API 争抢 SQLite。
- 个人收藏未受影响，这验证了 M93/M100 的快照设计：`ff16988d` 上挂着 2 条收藏，但收藏保存的是独立 snapshot 与本地图副本，删除前后 `saved_references` 均为 5。删除前已确认另有 2 条收藏本就指向早已不存在的 Run 仍正常。
- 删除后的持久基线为 3 workspaces / 9 Runs（全部 completed）/ active 0 / `keep_forever=1` 9/9 / 5 收藏 / 1 份任务书；磁盘 `runs/` 目录从 6 个减为 3 个。封存 Run `10d31b4c-94dd-4442-b24a-fc1b241e658e` 未在删除名单内，仍为 completed / attempt 0 / coverage_satisfied。
- 遗留的证据不一致必须记录，不能装作没有：`docs/release-evidence-2026-07-16.md` 冻结的三个 accepted run 里有两个（`7d8faa53`、`b4c314a6`）的底层数据已被删除，`.artifacts/portfolio/` 中对应的 8 张 PNG 因此只剩截图而无可核对的 Run。该文档与 10 张 PNG 都未纳入 Git，处置留到 M123 刷新发布证据时一并决定。

## 2026-07-26 M132 案例研究页与收藏页的版式实测

- 在 1920×1080 真实页面上实测，**根因不是留白多少，而是同一页有两条互相冲突的左边界**。`.results-section` 与 `.collection-page` 是 `max-width: var(--layout-stage-max)`（1600px）居中，左边界 x=153；而内部的 `.case-chapter`（`styles.css:2975`）和 `.collection-architecture`（`styles.css:1699`）是 `max-width: 1180px; margin: 0 auto`，在 1600px 里再次居中，左边界 x=**363**。于是章节标题、研究结论、`个人收藏` h1 全在 153，案例正文和收藏案例全在 363，相差 210px。
- 同一原因造成控件“飞到右边”：`图纸类型` select 贴的是 1600px 外框右缘（x=1597），`选择案例` 贴的是 1180px 内框右缘（x=1445），两者与正文右缘（约 1160）分别相距 264px 和 285px。截图里那种“标签在最左、控件在最右、中间一大片空”的观感就来自这两层不同宽度的框。
- 阅读列宽在一页里跳了四次：研究结论 header 673px → `.synthesis-primary` 920px → `.case-chapter` 1180px → `.case-answer-copy` 808px。左缘固定而右缘反复移动，是这两页最强的“排版没做完”信号。
- 行长实测超标的正是没有 measure 的块：`.synthesis-primary li` 896px / 112ch，`.synthesis-boundary` 值列 828px / 153ch，收藏页 `.collection-question-heading h2` 1081px（24px 字号下每行约 45 个汉字）。反之写了 `max-width: 58ch/64ch` 的 `.case-answer-mechanism`、`.case-answer-actions ol` 实测 63–76ch，本来就是舒适的，说明问题是覆盖不全而不是数值错。
- 三处“标签轨”是 M99 已被 M100 否决过的做法的残留：`.synthesis-boundary` `80px minmax(0,1fr)`、`.case-answer-boundary` `80px minmax(0,1fr)`、`.collection-case-boundary` `84px minmax(0,1fr)`。12px 的“适用条件”只占 48px，轨道却是 80–84px，再加 12px gap，必然留出可见空档；正文里还重复一次“适用边界：”“页面不是…”之类的自我标注。
- 这三处适用条件同时是全页最小的字（`--font-sm` 12px），却承载用户必须遵守的使用边界；`优先做法`/`核心解法`/`怎么做` 反而是 14–16px。层级与重要性相反。
- CollectUI 本轮可以正常打开（此前两次会话超时），但它是 Dribbble 作品图聚合站，正文全是图片、无可读结构，且以 landing/branding/motion 类营销版式为主。对一个中文密集研究阅读面没有可直接迁移的结构；照搬只会得到 impeccable 明确列为 slop 的通用卡片墙。真正适用的成熟范式是文档/编辑型阅读版式：单一文档栏 + 固定 measure + 贴着内容的操作，而不是画廊式卡片。
- 第一版修复只做到“统一左缘”是不够的，用户当场指出问题：内容全部贴左、右侧留下约 600px 空白，反而更像没做完。教训是**对齐一致 ≠ 版式成立**；页面级规则必须同时决定内容栏的宽度、位置和两侧余量，而不是只消除内部差异。
- 因此确立全局文档规则并写进 `design-system.test.ts`：`--layout-doc-max: 1180px`，`.result-task-heading`、`.research-synthesis`、`.case-analysis > .results-header`、`.case-chapter`、`.collection-page > .panel-heading`、`.collection-page > .collection-entry-switch`、`.collection-architecture`、`.collection-question-directory` 共用一条 `max-width + margin-inline: auto` 规则。任何新增的结果/收藏区块只要加进这一条选择器就自动符合版式，不需要各自设宽度。
- 实测结果：1920 下左右边距 362 / 378，1440 下 122 / 138，两页所有区块只有一个左缘和一个右缘；`图纸类型` 筛选器与 `选择案例`、收藏页删除按钮的右缘都精确落在 1542（1920 时）文档右缘上，不再分别停在 1600px 外框和 1180px 内框。
- 行长同时收口：案例标题从 148ch 降到 46ch，`优先做法` 从 112ch 降到 69ch，适用条件从 12px/153ch 变为 14px/69ch。收藏页与结果页均无超过 80ch 的文本块。
- 另修两处“标签自我重复”：`userFacingRecommendation` 原本只剥离 `【转译建议…】` 方括号形式，真实数据是裸的 `转译建议：`，因此界面上每条做法都以标签开头；适用条件同样带 `适用边界：` 前缀。现在两者都在展示层剥离，durable 数据不变。

## 2026-07-26 M133 全触点白话文案走查

- 逐块走查主页、建筑结果页、收藏页、备份页的全部可见文案后，最大的问题不是个别词难懂，而是**同一个概念在不同页面有三个名字**：案例的做法在结果页叫“可直接采用”、在收藏页叫“怎么做”；适用边界在结果页/综合区叫“适用条件”、在收藏页叫“适用时注意”。用户在两个页面看同一个案例会以为是不同的信息。已统一为“怎么做 / 适用条件”。
- 主页来源说明“只有正文证据完整的项目进入结果”暴露了内部术语“正文证据”；改为“只收录文章内容完整的项目”。“数据管理”改为“备份与恢复”、“预检备份”改为“检查备份包”——按钮和页面只做这两件事，名字就该说这两件事。
- “研究已形成初步依据 / 已形成初步灵感”是用户在本会话早些时候亲自困惑过的状态；不改标签本身（已批准的措辞），但补了 title 解释（“已回答全部研究问题，但案例数量或深度未达完整标准，可作初步参考”）。“取消永久 / 设为永久”补了后果说明 title（“取消后改为保留 14 天，到期自动删除”）。
- 尝试过抑制“章节小结与首个案例机制逐字重复”，被 7 条既有 M128 契约测试挡下——这些测试明确要求每个案例块自带机制句。已回退。结构性根因记录在案：`App.tsx:2177-2180` 的题目级小结就是第一个案例机制的原文复制，所以每章开头的结论句必然在第一个案例里逐字再现一次。要消除这个重复只有两个方向（小结注明出处案例，或首个案例不重复机制句），都属于对已验收布局的改动，留给用户决定，不在文案轮里顺手改。
- 教训：0×0 视口下 `scrollWidth - clientWidth` 会给出假溢出（本轮测得 320）。浏览器面板收起后必须先显式 resize 再量测，不能把面板状态当页面回归。

## 2026-07-26 M134 章节结论不再在首案例复读

- 用户选择方向 B。设计决定：章节小结保留其“答案优先”位置，首个案例在机制句与小结逐字相同时省略该句；这不是删除信息，而是把 M73 折叠时代“结论只说一次”的本意带进 M128 的全摊开布局。
- 抑制规则刻意收窄到 `dossierIndex === 0 && designMechanism.trim() === questionSummary.statement`：小结取自首个非空机制并经过 trim，所以相等判断必须同样 trim；后续案例机制即使碰巧相同也不受影响。若首案例机制为空、小结来自第二个案例（罕见形状），不做任何抑制，宁可保留重复也不误删非来源案例的机制。
- 迁移的 7 条契约不是被削弱而是换位：机制的可见性仍被断言（章节层），新增“首案例内不存在”的负向断言，多案例测试继续要求 Warehouse Forum 等后续案例自带机制句。跨章节测试的原意（每章用自己的逐题分析、不塌缩进首章）用“章包含自己的机制 + 首案例不复读”表达。
- 真实耕织图 Run 复核证明规则按预期工作：四章案例数 5/1/1/4，案例机制段 4/0/0/3，结论句复读 0。单案例章节的阅读流最能说明收益：问题 → 结论句 → 项目名 → 怎么做 → 适用条件，没有任何一句读两遍。

## 2026-07-26 M135 剩余触点文案收口

- 三个未走查面（图纸灵感结果、运行/失败状态、工具与导出）用"三个并行审计 agent + 每条发现一个对抗核验 agent"的多智能体流程收口：45 条原始发现，43 条核验存活、2 条被驳回。核验层真实拦下了审计层的错误：有替换文案会让 UI 撒谎（就绪状态声称小红书可搜索，而该分支恰好是不可用时才渲染）、有的指向不存在的按钮、有的把方向搞反（"下方结果"实际在上方）——证明对抗核验不是走过场。
- 编排教训：第一轮核验的 prompt 忘了插入发现载荷，45 个核验 agent 全部以"无法核验原文存在，keep=false"正确拒绝。失败安全设计有效，但也说明**编排脚本的模板插值必须先自测一条**再放量；修复后从缓存恢复，审计层零重跑。
- 词汇层面的系统性发现：同一功能最多有三个名字（对照入口"对照案例策略"/"对照方法与边界"、对话框"方法对照"）；"档位""容量""配对码""精确提取""聚合来源""可嵌入"是内部概念直译；"分享版权利检查"存在真实的中文切分歧义（版权/权利抢词）；"权利 权利未知"是模板拼接出的显示级重复。修复统一为一词一概念，并新增 `copy-glossary.test.ts` 在源码层封禁 18 个废弃词，防止词汇漂移回流。
- 死胡同状态是比措辞更重的问题：扩展已连接但未授权时，界面只说"需授权"却没有任何按钮能完成授权（唯一说明藏在提交研究后的错误里）；连接状态读不到时只说"请检查本地服务"。这类状态现在都给出具体修复路径。收藏上限 6 此前完全不可见，第 7 次点击静默失败；现在计数处直接标注"（最多 6 张/个）"。
- 需要向后端同步的观察（本轮未改后端）：`visualLabels.blocked` 的诚实文案依赖 stop_reason 区分"环境不可用"与"没找到图"，当前展示层统一为"暂未找到可用图纸"，若试点中用户对环境类失败困惑，应把 stop_reason 映射进该状态。
- M121 观察工具包已写入 `docs/m121-pilot-kit.md`：10 个按序任务（含任务书路径与状态理解）、去身份化记录表、会后 5 问、P0-P3 处置阈值与硬边界。待用户招募 2–3 名真实用户后执行。

## 2026-07-27 M141 第二次保留期 P0：永久 Run 的证据被独立时钟清空

- 用户两次报告"点开历史研究是空的"，第一次被我误判为热更新伪影——因为我抽测的 `ff16988d` 恰好完好。API 逐条核查后坐实：`76f52c79`（M53/M65 验收 Deep）、`d995bed5`、`a2cf2e20`、`d13bdc67`、`58f4b9f9` 五条的 results 全部为 0。教训与 M136 呼应：**抽样验证会漏掉系统性缺陷，用户复报同一现象时必须全量核查，不能用一次成功样本关闭问题**。
- 根因：`lifecycle.py` 的清扫对 asset_candidates（7 天 TTL）、source_pages（30 天）、evidence_claims（7 天）按各自 `expires_at` 硬删，**完全不看所属 Run 的 `keep_forever`**。7/26 的 P0 修复只把 Run 行标记为永久，子数据的时钟照走——"永久封存"的语义第二次与代码脱节，这次是在子表层。
- 实测危险边缘：修复落地时 `10d31b4c`（封存 Run）与 `f5be3f17` 的资产已过期十余小时、`23b6f84c` 数小时后到期，全靠"API 恰好没重启"才幸存；下一次 Windows 登录的自启动就会触发清扫。修复（三个过期查询豁免 keep_forever Run 的子数据）在下一次启动加载，先于清扫执行。
- 可恢复性：7/25 备份含 `76f52c79` 的 51 资产 + 136 逐字证据（建筑资产为文本行，无磁盘文件依赖），已写外科恢复脚本；`d995bed5`/`a2cf2e20`/`d13bdc67`/`58f4b9f9` 的资产在更早的启动清扫中丢失且两份备份都没有，**不可恢复**。这四条 Run 行仍在、来源页仍在（30 天 TTL 未到），但作为"已验证"引用的底层证据已残缺，需要用户决定去留。
- 结构性教训：**同一保护语义必须覆盖对象的全部组成部分**。"保留 Run"在数据模型里横跨五张表，任何按表独立设计的 TTL 都会在语义上撕开缺口。新增的红绿契约把"永久 Run 的资产/来源/证据不过期"固定为行为测试。

- 参考站的可迁移信号在**品类分布**而不是具体页面：siteinspire 2026 策展前五是 Typographic/Design&Art/Portfolio/Web&Interactive/Minimal，加上 Grid Layout 742——证实"排版主导 + 网格节奏 + 单一强调色"仍是高级感的主流语法，我们的制图桌方向不需要转向，需要的是动效词汇量补齐（盘点仅 2 keyframes / 5 transitions）。
- 三设计师 + 逐组对抗核验的 workflow 第二次证明核验层的真实价值：6 条被拒的理由全部站得住——整页入场 stagger 编排正是 DESIGN.md 明令禁止的"千篇一律入场"（核验员正确指出 drawer-in/research-options-reveal 的先例只动单元素、从不编排兄弟）；两条用了非 token 色值字面量；一条给不存在的 DOM 写动画（.evidence-sheet-actions 内根本没有 aria-pressed 按钮）；Material 印圈庆祝动效被识别为通用套路而非制图语汇。**没有这层核验，这 6 条大概率会被我当作"看起来合理"落地。**
- 我自己预备的红灯也被这次裁决推翻：入场 stagger 契约（reading-rise + nth-child 封顶）写在产品自己的设计法禁区里。教训：**红灯测试要在方案裁决之后写，不要在构思之前押注具体机制**。
- 合成时发现两位设计师对同一选择器（.collection-dock-success）提了不同动画——多智能体输出必须由单一整合者裁决冲突（取 sheet-settle fast，保持"内容更替=fast 档"的语义一一对应），否则两条"各自合理"的规则叠加就是抖动。
- 落地时踩了一个结构约定坑：向文件中部插入独立 @media (max-width: 620px) 块会打破 design-system 测试的"860/620 各一块、按序在尾部"切片约定，5 条无关测试瞬间全红。样式表的媒体查询结构本身是被测契约，新增响应式规则只能并入既有块。

## 2026-07-26 M136 模拟 persona 走查（诚实替代，不冒充真人）

- 用户要求"编几个用户开测"。伪造真人观察被拒绝——规划里外部验收门明写人类参与者"intentionally not fabricated"；改为执行诚实等价物：3 个**无任何产品上下文**的 persona 子代理读真实页面文字做首见理解测试，结果明确标注"模拟"，M121 保持 in_progress。方法学上的关键点：子代理真的没见过产品，它们的误读是真实的首见误读，比主对话假装无知可信。
- 最有价值的信号是**三个 persona 独立撞上同样的词**：'轮流检索'（3/3 逐字引用为最不确定的词之一）、'研究已形成初步依据'（2/3 读成"还没跑完"）、保留期恐惧（3/3，包括"我会退回截图存相册"这种信任流失表述）。跨 persona 重复是比单条意见强得多的证据，工具包的 ≥2 复现阈值在模拟里同样有效。
- 一个此前所有代码审计都没抓到的数据形状问题被 persona 抓到了：'适用条件' 槽位里装着"页面不是《耕织图》或其版本出处"这类**来源免责句**。S1 的原话"既然不能用，为什么还列出来给我看"和 S3 的"适用条件应该跟着案例走，而不是跟着当初那个问题走"指向同一根因——`auditBoundaryPattern` 没把来源型免责句算作审计句。这类问题只有"带着目的读内容"的人能发现，纯词汇审计发现不了。
- S2 验证了 M135 的修复真实有效：'转载合集（非首发）· 权利 未注明' 被首见者准确理解为"搬运号发的、版权归属不明"，并能正确推理对自己使用场景的影响。文案修复的效果可以用同方法回归。
- 最重的未修发现是 S3 的出处链接冲突：M128 按用户要求删除了结果与收藏页的全部来源链接，而专业 persona 认为"没有出处的案例一条都不敢放进汇报"，收藏页（最接近产出的页面）恰恰最需要出处。这是答案纯净度与专业信任的真实矛盾，已在 `docs/m121-simulated-walkthrough.md` 列为需用户裁决的第一项。
- 模拟的边界同样得到确认：S1/S3 对"选择案例点了会怎样"的不确定部分源于纯文字模拟看不到点击反馈——这类发现必须降权，留给真人试点。模拟能测文字可理解性，测不了操作行为。

## 2026-07-26 M129 开发服务启停的 WMI 依赖

- 现象与最初判断的偏差：`Get-NetTCPConnection -ErrorAction SilentlyContinue` 在本机返回空并不代表端口空闲，它的 CIM 层此时已经坏了，`-ErrorAction SilentlyContinue` 把失败吞掉。真正可信的空闲证据是 `Get-AvailableTcpPort` 的绑定成功和 `netstat -ano`，两者都不经 WMI。
- 根因定位：MSIX 版 pwsh 7.6.4（`C:\Program Files\WindowsApps\Microsoft.PowerShell_7.6.4.0_x64__8wekyb3d8bbwe`）加载 `Microsoft.Management.Infrastructure.Native.Unmanaged.DLL` 抛 `DllNotFoundException … E_ACCESSDENIED`。Winmgmt 服务本身 Running，Windows PowerShell 5.1 的 `Get-WmiObject` 正常返回，用 `Start-Process` 另起的独立 pwsh 同样失败——所以坏的是这个 PowerShell 安装，不是 WMI，也不是调用它的 shell 环境。
- 失败链闭合：`start.ps1` 先成功拉起 uvicorn 与 vite（日志里有 `VITE v8.1.4 ready`），随后 `Get-WorkspaceListeningProcessIds` 抛错进入 catch，`Stop-Process -Force` 把两个刚起来的进程杀掉。表现是"连接被拒绝且日志无错误"，与用户看到的一致；M127 开机自启走的正是这条路径，每次登录都会重演。
- 该缺陷此前一直被掩盖：12:36 那次成功启动来自 Codex 运行时（自带 pnpm 与可用 CIM 的 pwsh），所以同一份脚本在同一天既能成功也能失败。pnpm 从 PATH 上"消失"和 CIM 失效是同一件事的两个侧面。
- 替代原语的可用性已实测：`netstat -ano` 在 zh-CN 上仍输出英文 `LISTENING`，但实现不依赖该词，只用环回本地端点加未连接对端地址判定；PEB 读法对 `node.exe`（可执行文件在 `C:\Program Files\nodejs`，工作区路径只出现在命令行里）和 uvicorn 都取到了与 WMI 完全一致的命令行。
- 仅凭可执行文件路径判定工作区归属是不够的：vite 监听进程是系统 Node，`apps/api/.venv/Scripts/python.exe` 又是 uv trampoline，实际进程显示为 `~/.cache/codex-runtimes/...python.exe`。两者都只有命令行里带工作区路径，所以必须保留命令行归属语义。

## 2026-07-27 M146 记录整理时确认的规则冲突

整理时逐项核对后判定为"已被取代"并从现行文档清除的规则（历史原文均在 docs/history/ 归档中）：M93 同题收藏批替换（被 M145 累加语义取代）；建筑结果的来源检视器与核验状态文案（M128 移除，检视器只存在于图纸灵感）；图纸类型筛选器（M143 移除）；来源反查/TinEye（M113）、Pinterest（M94）、Firecrawl（M41）；"正式 Run 不自动过期"（被 M92 的 14 天 + 逐条永久取代）；EvidenceClaim 30 天留存（实际代码为 7 天）；历史窗口 400px/55dvh（M126 定为 320px/45dvh）；六名学生可用性研究提法（被 M121 2–3 人观察工具包取代）。dossier 台账 CSS（.dossier-analysis 等）仍在源码中被引用，未按过时处理，留给 M122 表征后再判定死活。
