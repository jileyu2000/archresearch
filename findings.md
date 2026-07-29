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

## 2026-07-27 M147 备份页参考研究结论（保留供后续复用）

成熟产品备份/恢复 UX 的可迁移共识：第一屏是状态不是设置（上次备份时间/大小是整页信任锚点，WhatsApp/iCloud/Time Machine 共同骨架）；"为什么备份"永远绑定具体场景（换手机/换电脑），不用抽象安全话术；包含范围用排除法一句话（Bitwarden：只列不含什么）；恢复范围的限制必须在备份时就披露（Signal 免费档 45 天媒体限制到恢复时才暴露，直接变成用户投诉）；覆盖式确认的文案写具体宾语与数量（Anki："这将删除你现有的集合并替换为…"），确认重量与破坏性匹配（微信合并式轻确认 vs 覆盖式重确认）；失败文案先说明数据现状再给下一步。

## 2026-07-27 M121 模拟试点立项发现（P0/P1 与重复 P2）

完整记录见 docs/m121-simulated-pilot-2026-07-27.md 与逐字 JSON。进入立项的发现：

- 环境事件复核后的当轮修复（M148）：两起"零反馈"（U1 首次提交、U2 整场冻结）最可能是浏览器自动化 ref 伪影——试点后同页实测 42 个按钮全响应、问题框带原生 required。但产品侧确有两个真缺口会给真人同样体验：提交后按钮无等待态；研究启动失败的报错渲染在主页最底部（App.tsx:2877，远离提交按钮）。
- P1（M149）：结论栏与证据脱节（U1 出现与问题无关的案例简介，疑似绑定错位，先做工程诊断；U3 孤例进结论且口气笃定）；保存入口藏在分享弹层后（2/2，U1 自认靠运气，真实会退回截图）；等待期"可用参考"计数全程 0、结束才跳变（2/2 独立怀疑卡死）；14 天删除+手动备份+无提醒的保留焦虑（3/3，访谈要求至少一学期）；案例供给不足与尺度错配（2 案例撑 3 子问题、孤例答核心问题，含中英案例名不一致待核查）。
- 重复 P2（M150）：三档双命名（3/3）；术语语域（初步依据缩略态/连续检索/未读取图片像素/证据方向，3/3）；研究进行中整页被进度视图接管、全局入口不可达（2/2）；保存成功反馈远离按钮+选中态清空被误读为失败（2/2）；系统长句标题难认领、截断在要害（3/3）；顶栏"查看上次结果/个人收藏"职责重叠（2/3）。
- 应保护的核心价值（两名到达结果页者一致）："怎么做三条+可点回原文的出处链接"是最信任资产；收藏按研究子问题组织的找回路径一次到达。
- 模拟局限已随记录归档；图纸灵感全流程与任务书路径本轮零覆盖，修复后需补定向模拟。

## 2026-07-27 M149/M151 启动观察

- M149 按既定顺序先做只读根因诊断：U1 的“研究结论栏与证据脱节”不能先按展示问题猜修法，必须沿 Run 结果、题目级 summary、案例逐题 analysis 与 Board 投影逐层核对，定位错位发生在哪一层后再写红灯。
- 用户截图里的备份页并非缺信息，而是同一语义重复：页首解释“本地存储 + 手动下载 + 整体恢复”，备份区再次解释“手动 + 定期下载 + 排除项”，恢复区又用整段话重复“替换而非合并 + 自动检查 + 失败回滚 + 手动确认”。信息齐全但扫描成本过高。
- M151 的目标不是删掉风险说明，而是按动作重排：页首一句说明本地数据；备份区只保留当前数据、上次备份与主动作；恢复区把“替换当前数据，不会合并”贴近文件选择和危险确认。行为合同保持不变。
- 成熟产品的共性不是“把所有保护机制先解释完”，而是动词化入口与逐步披露：Apple 用“立即备份 / 从备份恢复”，并把可恢复范围放在动作说明中；Windows 直接以“备份电脑 / 还原”组织任务。可迁移到本产品的是短标题、动作旁后果和状态优先，不是照抄云同步承诺。参考：https://support.apple.com/zh-cn/104984 、https://support.microsoft.com/zh-CN/Windows/experience/backup-recovery/back-up-and-restore-with-windows-backup
- 当前实现的冗长集中在 `App.tsx:2482-2535`：页首 100+ 字、备份三行状态各带括注/建议、排除项另起一段、恢复说明约 150 字。现有测试已经锁定真正不能丢的合同：手动备份、排除服务配置/登录信息、浏览器本地下载记录、自动只读检查、替换而非合并、危险动作二次确认、失败不动数据。因此可以迁移测试表达并安全删除重复解释。
- 当前 CSS 已有 `.data-management-section`、`.data-backup-section`、`.data-backup-action` 和恢复控件的独立布局入口；版式修复应复用这些类与现有 4/8 间距 token，避免新增卡片或新视觉语言。
- 原尺寸截图确认版式根因：1120px 页面把备份区切成“约 760px 文案 + 240px 动作”，但左栏又使用 128px 标签轨，实际说明只有约 600px，造成多处两三行断裂；恢复区虽然是一列，150 字长段落仍先占据整屏主视觉，文件选择被推到首屏底部。标题、解释、状态与风险说明几乎同权重，扫视时找不到唯一下一步。
- 可行的最小布局是两段平面工作流而不是更多卡片：页首缩成一行；“备份”区用紧凑状态列 + 右侧主动作，去掉独立“备份方式”行；“恢复”区用短后果句与文件选择组成两列，自动检查结果再在下方铺满。移动端继续按现有 720px 媒体块单列且控件 44px。
- `design-system.test.ts` 目前没有备份页布局合同；M151 需要新增最小契约，固定桌面恢复区双列、结果跨满与 720px 单列，而不是只靠截图主观验收。`copy-glossary.test.ts` 已封禁若干旧备份术语，但“正在打包”仍残留在按钮状态，与其“不要暴露打包内部概念”的注释冲突；应迁移为用户动作“正在下载…”并加入守卫。
- M149 的原始模拟材料可从 `docs/m121-simulated-pilot-records-2026-07-27.json` 精确追溯 U1，而不是依赖汇总文档转述；下一步先提取 U1 Run、问题、结论原文与用户观察，再对照持久 API 数据。
- U1 的具体错位不是轻微概括偏差：研究问题是“3 米高差的高处沿街入口与低处社区广场如何自然连接”，结果页总标题却是“项目将发现的 18 世纪下水道改造为祖传梅斯卡尔酒品鉴与烹饪体验空间”。它看起来是某个案例自身的逐题机制/摘要被提升成 Run 级结论，且该案例并不是用户记住的两个主要案例之一；应优先核查综合 answer 的构建与 Board `userFacingSynthesis` 投影，不先归因于中文翻译。
- 代码链初步支持这个方向：Board `researchSynthesisOverview` 对正常且 ≤96 字的 `synthesis.answer.statement` 原样作为总标题，只在 fallback/超长时才从 causal chain 投影；后端确定性 fallback 的 answer 明确由若干“项目名：design_mechanism”拼接。若 Provider 返回的正常 answer 本身只是单案例机制，Board 当前不会核查它是否覆盖研究问题或多个子问题。
- 后端已有强证据结构可用于安全投影：`causal_chains` 的 finding 带 `evidence_asset_ids`，每个 case 又按 subquestion 保存 branch analysis。修复方向应优先在展示投影或 synthesis 接受边界上做“总标题必须是跨题判断”的行为合同，而不是丢弃现有逐题案例数据。
- U1 durable data 已用 SQLite `mode=ro` 全量核对，排除“前端绑定到别的 Run”：Run `7456d7eb-...` 的 question/subquestions 均正确，coverage 内 synthesis 明确是 `generation_mode=deterministic_fallback`；answer 与唯一 causal chain 都绑定 asset `7daf4462`（Oaxaca Gastronomic Center）。错位句正是该 asset 的 `design_mechanism`，证据绑定没错，**语义角色错了**：单案例简介被当作整轮结论。
- 根因闭合：quick fallback 只取 `primary_branches[:1]`；后端 answer 用该 branch 的 `design_mechanism`，Board 对 fallback 又从 causal chain 提取同一“机制”作 headline，所以两层共同把第一子问题的首个案例机制提升为 Run 级结论。该 branch 的第一条 `transfer_strategy` 则明确回到用户任务（先测绘层高、地下遗存、夹层和入口标高），是更安全的 fallback 顶部判断来源。
- 兼容旧 Run 的最小修法应同时覆盖两层：后端未来 deterministic answer 改用 evidence-bound transfer，不再持久化单案例简介为总答案；Board 对既有 fallback 优先取 causal chain 的“转译”段，仍保留机制作为最后兜底。这样不改 durable 历史数据也能立即修复 U1 展示。
- 双层修复已按该边界落地：后端只替换 deterministic answer 的字段来源（同一 branch、同一 asset evidence id），不改变 causal/comparison/depth 数量；Board 只调整 machine-shaped/fallback headline 的候选优先级为“转译 → 机制 → raw fallback”，正常 Provider synthesis 完全不受影响。
- 现有设计系统测试以 raw CSS 正则固定关键响应式结构，适合为 M151 增加小型合同；不需要引入截图快照。备份页 720px 媒体块独立于全局 860/620 单块约定，因此可在原块内迁移而不触碰结果页媒体结构。
- M151 loaded QA 证明重排成立：1440×900 下页面 1120px 居中，恢复区是 409.6 / 614.4px 双列，文件控件与说明在右侧形成单一任务列；整个页面高度从用户截图接近一整屏收敛到 474px，水平溢出 0。390×844 下页面宽 351px、恢复区单列，下载按钮与文件控件均 44px，高度 720px，水平溢出 0，console error 0。
- 桌面“备份数据”仍保留明确主动作，移动端顺序为标题 → 两行状态 → 包含/排除一句话 → 下载 → 恢复后果 → 选文件，没有信息断裂。Impeccable 的影响是把风险说明从页首长文移到相关动作附近，并以平面结构线而不是新增卡片建立层级。
- 工具恢复记录：项目内 `.claude/skills/impeccable/scripts/context.mjs` 不存在；改用技能实际安装目录成功。系统 `python` 不在 PATH；改用 `apps/api/.venv/Scripts/python.exe` 执行 session catchup 成功，未发现未同步上下文。

## 2026-07-27 M149 五项 P1 根因与产品决策

- U1 结论并非串到错误 asset，而是 deterministic fallback 把首个案例的 `design_mechanism` 提升为整轮 answer，Board 又重复以“机制”作标题。未来持久 answer 与历史 Run 的显示投影都优先使用同一 evidence-bound causal chain 的“转译”，既不改 durable 数据，也不补写新事实。
- 收藏入口的缺口是动作可发现性，不是收藏 API：结果页原先只能先勾选案例，再在底部选择条中保存。每个 dossier 现在直接提供“加入个人收藏”，复用同一保存请求；直接收藏不清空当前多选，原“选择案例”继续服务批量收藏和案例对照。
- 等待期计数一直为 0 的根因在后端检查点：workflow 每轮已计算 coverage，但只把摘要写入 Trace，`ResearchRun.coverage_report` 要到终态才更新。`gap_check` checkpoint 现在同步持久覆盖摘要，因此既有 Board 轮询无需读取半成品结果即可显示实时可用参考数。
- 保留焦虑按试点访谈采用“一学期”而非增加提醒系统：新 Run 从创建日起 180 天，取消永久后从操作日起 180 天；每行显示具体到期日，14 天内才使用“即将到期”警示。现有数据库行的到期日不迁移、不静默延长，backup 的“超过 14 天未下载”提醒仍是另一套备份频率规则。
- U1 的 3 个研究问题只有 2 个正式项目却可完成，来自 Quick `projects=2` 与 `subquestions=3` 的合同不一致；改为至少 3 个正式项目。U3 的儿童卧室案例证据链本身完整，但只是房间/家具尺度类比；仅靠 relevance 无法表达“证据真实但不直接回答本题”，因此正文分析新增独立 `direct_match` 闸门，保留低 relevance 完整证据可被纠偏的既有行为，同时阻止尺度错配进入正式案例。
- “罗马的卧室”不是跨项目绑定错误，而是模型把标题与 URL 中明确的 Barcelona 错译为 Rome。未来 prompt 明确禁止引入来源不存在的城市/国家；Board 对存量记录采用保守显示规则：原题与 URL 同时明示英文地点、中文标签又无法核实时回退原名。这样 U3 立即不再显示错误城市，又不修改历史数据库。

## 2026-07-27 M150 第一轮源码审计

- 三档双命名是一个明确的单点根因：`modeLabels` 仍输出“概览 / 标准 / 深入”，`researchDepthOptions.coverage` 又输出“快速找方向 / 形成方案依据 / 做跨案例论证”。两套词同时进入单选项、最近研究、演示页、partial 缺口与页头。最小修复是让 `modeLabels` 直接成为三条用户结果词，并把选项结构缩成“label + description”；内部 `quick/balanced/deep` 请求值完全不变。
- 已定位四类试点原话对应的源码触点：“证据方向”在 planning 阶段说明；“连续检索”在 `no_new_assets` 停止原因；“初步依据 / 初步灵感”在完成但 enrichment 不足的历史状态；“未读取图片像素”需继续从 App 与收藏投影中定位。它们都是面向用户的状态/边界文案，不需要改后端状态码或证据模型。
- 现有记录标题函数已经会把“背景，如何行动”重排为“背景：行动”，但固定 28 字从尾部截断，长动作会丢失真正的判断对象。M150 需要用实际试点长问题补一个行为样本，再决定是压缩背景还是保留动作尾部；不能把标题问题误修成增加字符上限。
- Header、运行中页面和收藏反馈需要继续读相邻 JSX 后才能定方案。当前已确认收藏成功只有全局 `announcement` 与结果底部 selection dock 的完成态，直接收藏按钮本身没有独立成功反馈；批量保存会清空选择，因此用户看到勾选消失时容易误判为失败。
- 顶栏职责可以用删除而不是重命名解决：“查看上次结果”与最近研究第一条完全重复，也是用户在“找收藏”时的错误候选；移除后主页顶栏只保留数据工具（备份、个人收藏），最近研究负责打开 Run。运行中结果页当前刻意不显示“返回主页”（条件排除了 `isRunActive`），因此全局入口全部消失；让所有结果视图统一显示“返回主页”即可一跳回到历史、收藏与备份，不需在进度页再复制三枚按钮。
- 保存反馈需要分两种动作：直接收藏在原案例按钮就地变成“已加入收藏”，不再触发远处 dock；批量收藏仍在原底部 dock 就地显示“已保存 N 项，选择已清空”，明确消失的是临时选择而不是收藏。API 和累加语义不变。
- 术语收口采用直接、可判断的状态词：“已完成 · 初步依据”→“已完成 · 案例不足”，“已完成 · 初步灵感”→“已完成 · 图纸较少”，“证据方向”→“可研究的小问题”，“连续检索没有找到新的有效项目证据”→“这轮没有找到更多可用案例”，“综合方法”→“整理结论”，“证据问题”→“研究问题”。“策略矩阵”属于同一批用户点名的论文语域，界面动作改为“案例对照表”；底层 export mode 不变。
- 收藏目录的认领顺序目前反了：系统生成的完整 `group.question` 是主标题，用户原始 `collectionQuestion` 只是次要行。应让用户原问题先出现并作为认领锚点，再以“研究方向”标注系统拆解；每行仍由子问题 id 区分，不改变收藏组织结构。
## 2026-07-27 — M150 title and regression-test decisions

- 研究记录标题不能只靠把长度上限调大：现存长问题里有多个连续问句，当前算法总从第一句开头截断，正好丢掉最后一个最能区分任务的问法。最小修复是优先取最后一个完整问句；单问句仍沿用“场景：动作”的既有提炼。
- 收藏目录不新增标题字段。把用户最初输入的问题提升为主标题，把系统拆出的子问题降为“研究方向”副标题，即可保留辨认锚点并避免迁移旧数据。
- M150 行为测试迁移点已经定位：旧“概览 / 标准 / 深入”、旧部分完成状态、顶栏“查看上次结果”、全局收藏成功条，以及批量收藏的模糊成功文案都必须先改成新合同；运行中任务新增“返回主页”可达性断言。
- 标题回归用例会覆盖飞行记录里的真实失败形态：多个问句拼接时，标题应取最后一个问句，而不是截断第一段背景。
- 收藏反馈无需新增持久字段：现有 `savedIds` 足以让单项目按钮原位变成“已加入收藏”；批量成功条只需复用本次操作的 announcement，并且只在清空选择的批量路径出现。
- 研究方式卡片将直接使用唯一名称作标题、效果说明作副文，不再同时显示“概览 / 标准 / 深入”和第二套名称；演示页沿用同一套标题。
- “查看上次结果”整块顶栏动作可直接删除，最近研究列表继续承担找回记录；`返回主页` 条件扩大到所有结果视图即可恢复运行中的全局导航。
- 首次真实 loaded-state QA 暴露了一个旧数据兼容点：后端新标题算法只影响新建记录，现存记录仍携带旧的截断 `title`，首页第一条依旧显示“旧厂房改造成社区文化中心……”。M150 的“记录标题可辨认”不能只验证新建路径，显示层还需为旧截断标题从完整 `question` 生成辨认标题，且不写回耐久数据。
- 复查后确认上条不是代码缺口，而是 QA 时 API 仍运行修改前进程：`ResearchRunRead.derive_title_from_question` 每次响应都会从完整问题动态生成标题，因此服务重启后旧记录也会立即采用新算法，不写回数据库。无需再复制一套前端标题逻辑。
- 服务重启后首条旧记录已显示为“新植入的结构和旧结构应该脱开还是连接”。但单问句仍有第二种失败：高差场地问题的长背景占满 28 字，动作完全不可见。既有提炼函数已经计算 `first_clause`，却在没有“是 / 作为”时误用完整 context；改为使用首个场景分句即可让“用剖面和流线……”进入标题，且不增加长度上限。
- 390×844 截图显示标题算法虽已把动作放进 28 字，但 `.recent-question { white-space: nowrap }` 又在窄屏把动作裁掉。最小布局修复是让记录标题最多显示两行；记录列表已有固定滚动区，不会因此无限拉长首页。
- 完整门禁后第一次基线脚本误报 1/1/1：原因不是测试实例接管或数据变化，而是 PowerShell 对 `Invoke-RestMethod` 顶层 JSON 数组的包装计数方式；直接查看 `/v1/workspaces` 原始响应仍是 4 个真实工作区。最终基线必须用明确枚举/原始 JSON 解析，不能沿用该计数写法。

## 2026-07-27 M152 执行边界

- M121 验收轮对图纸灵感线零有效覆盖，任务书路径也未形成从输入到找回的完整证据；M152 只补这两个明确空白，不重跑已经通过的普通建筑研究主线。
- 仍用 M121 的核心判据和严重度规则。定向场次会把 T5/T6b/T7 与任务书版 T2/T3/T6a/T7 串成完整路径，并单独记录运行状态理解；评分与逐字记录必须能追溯到真实 loaded UI。
- 为保护用户现有数据，浏览器动作必须指向隔离数据目录与确定性 mock provider。若隔离环境不能生成某段真实状态，明确记系统原因中断或受控替代，不借用 `.archresearch` 中的持久 Run 完成动作。
- 默认 mock provider 足以驱动任务书路径，但默认 mock 运行没有 XHS searcher，图纸灵感会按产品边界诚实失败；要覆盖图纸结果与收藏，隔离实例必须注入 tests 已有的确定性 XHS 下载器/视觉分类器，而不能改生产配置或触碰真实登录态。
- 已采用临时双端口实例：API 18000、Board 15173、临时 SQLite/文件根和临时 PDF。隔离 API 的健康响应明确为 `provider_mode=mock`；正常 8000/5173 服务保持原状。
- 隔离 Board 首屏真实 loaded DOM 通过：新实例显示空的“建筑研究工作区”，两类入口、单一三档名称、可选任务书入口和 180 天说明均按 M150/M149 现行合同出现；没有借用任何历史 Run 或收藏。
- 图纸入口切换后，问题占位符与 CTA 会改成“轴测图 / 查找灵感”，三档研究方式和任务书入口正确隐藏。研究环境同时显示“小红书可用”和“未启用页面高清图纸读取 / 连接 Chrome”，两者职责对首见者可能仍需解释，先作为单画像 P2 候选观察。
- 图纸提交后约 120ms 已进入结果壳：顶部显示“已创建 / 0 条可用参考”，正文是“正在寻找图纸灵感”，七阶段全部换成图纸语域，且“返回主页”在运行中可达。V1 对“请求已接收、正在检索、完成后自动出现”可从同屏文字直接复述。
- V1 结果在约 3 秒后 completed：3 个命名清楚的轴测表达方向，结果按“方向→帖子→图片”展开，并在每帖附近显示原笔记链接和“转载合集（非首发）· 权利未注明”。V1 可指认“精细线稿轴测图”为可用方向，T5 结果理解通过。
- 图纸结果顶层写 33 张，三个方向各写 12 张（合计 36）；同一图片可能跨方向关联但界面没说明“总数按去重计”，先记录为 V1 单人 P2 候选，不据此立项。另有 36 个选择按钮均使用同一可访问名称“选择此图用于收藏”，键盘/读屏下难以辨认目标，先列可访问性 P2 候选。
- V1 从图片旁按钮选中后，底部明确显示“已选 1 张图纸（最多 6 张）/ 添加 1 项到个人收藏”；保存后原地变为“已保存 1 项，选择已清空”。T6b 保存动作与成功反馈通过。
- V1 返回主页后，最近研究首条能凭原问题前半句识别，副信息是“图纸灵感 · 33 张参考 · 7/27 / 已完成”，保留日期明确到 2027-01-23。
- 个人收藏固定默认打开“建筑方案”，即使当前只有“图纸灵感 1 项”，会先显示空建筑状态；类型切换按钮本身给出 0/1 计数，V1 可据此选择正确类型。作为一次额外点击记录，暂不判失败。
- V1 切到“图纸灵感 1 项”后立即看到保存图片、原笔记入口和删除动作；图片标题与刚选帖子一致。T7 找回通过，完整路径无提示完成。
- V2 以“旧厂房竞赛轴测、比较拼贴/材质/人物叙事”发起，提交后同样立即出现图纸专用七阶段和返回主页，约 3 秒后 completed。三个方向能对应其比较意图，T5 输入、状态与方向理解通过。
- V2 顶层为 35 张、方向仍各 12 张（合计 36），复现 V1 的“去重总数与方向关联数口径不明”；达到 2/2 重复 P2 阈值。V2 首屏也再次读到“小红书可用 · 未启用页面高清图纸读取 / 连接 Chrome”，两种读取能力的关系仍不直观，达到 2/2 重复 P2 候选阈值。
- V2 能按“拼贴叙事轴测图”区域找到目标并保存，选择条和“已保存 1 项，选择已清空”反馈与 V1 一致，T6b 通过。该方向的 12 个图片选择按钮仍全部同名，复现 V1 的键盘/读屏目标不可辨认问题，达到 2/2 重复可访问性 P2 阈值。
- V2 从主页进入图纸收藏后，两条已保存图片都能直接打开高清图与原笔记，T7 的“找到保存内容”通过；但列表只显示帖子标题“轴测图表达参考 5-1 / 1-1”，不显示原研究问题或“精细线稿 / 拼贴叙事”方向，V2 无法从文字说明其与哪次研究的关系。该项按核心 T7 先评 P1 候选，需结合 API 快照和第二路径证据复核是否仅为 fixture 命名局限。
- 隔离 API 首次只读枚举意外看到两个同名“建筑研究工作区”（一个 0 Run、一个 2 Runs）；可能是空实例在 Vite/React 开发模式下的重复初始化，也可能是计数脚本枚举形状问题。当前不定性，下一步看原始 JSON 和创建时间；不把环境伪影写成产品缺陷。
- API 快照复核闭合了图纸找回根因：两条 `SavedReference.snapshot.question` 都保存了完整且不同的原研究问题，界面有数据可用，只是图纸收藏列表没有投影它。故 V2 的关系解释失败不是 fixture 标题限制，按核心 T7 评 P1。
- 原始 `/v1/workspaces` 也确认确有两个不同 id 的同名默认项目，创建时间只差约 3ms；这符合首次空库初始化被 React/Vite 开发模式并发触发两次的竞态形状。一个项目始终空，另一个承载全部 Run/收藏。无数据丢失，按新安装数据初始化 P1 记录；M152 不直接修。
- B1 任务书入口真实 loaded DOM 通过：切回建筑研究后显示三档，展开区直接说明“任务书用于收束研究范围”“系统先读取场地、功能与限制，把它们作为问题拆解和案例检索边界”，案例 URL 单独称研究线索。B1 能准确复述任务书作用。
- B1 通过受支持的 file chooser 成功选入单份 PDF，表单只显示“1 个文件待上传”，不显示文件名。任务可继续，但用户无法在提交前核对是否选对任务书；先记单画像 P2 候选。
- B1 点击后按钮立即进入“正在准备研究…”禁用态，任务书读取期间没有零反馈；约 1 秒后结果壳已显示 4 个《耕织图》专属问题（工序序列、长廊空间语法、人物/器具/场所、四维体验），证明 PDF review 的 typed questions 确实约束同一 Run，而非仅把文件当附件。此时结果仍为空，需继续确认运行终态。
- B1 后端只读状态已是 `completed / coverage_satisfied`，4/4 子问题覆盖、12 个 verified/partial assets；但 loaded UI 在多次等待后仍把四问全部显示为“暂时没有可用结果”，且没有完成状态条。不是研究夹具无产出，而是结果没有装入界面，核心 T3 失败，评 P1。
- `/v1/runs/{id}/results` 独立返回 12 条完整结果，首项目“织造厂再生中心”同时关联四个任务书子问题；浏览器 console 只有 Vite 连接与 React DevTools 提示、零 error。故故障边界收窄到 Board 的快速完成状态/结果 hydration，而非 API 或渲染异常。
- 从主页重开“耕织图：转译提取元素”仍是四问全空，排除只发生在初次自动跳转的 hydration 竞态；主页本身正确显示“研究已完成 / 形成方案依据 / 12 张参考”。需继续核对 Board 是否按 M149 `direct_match` 过滤了 mock 资产，避免把夹具合同缺口误判为生产结果丢失。
- 根因不是 `direct_match`：Board 的 `analysisReady` 要求中文 context/mechanism、transfer 且至少一条 `evidence_claim.text_excerpt`；默认 `MockResearchProvider` 产生的 12 个 verified/partial assets 没有逐字引文，故被正确隐藏，但 workflow coverage 仍把它们计为完成。这个 no-key mock 的完成/展示合同脱节本身是独立 P1；B1 当前场次按系统原因中断，不计 persona T3。
- 诊断用 `rg` 误带不存在的 `apps/board/src/types.ts`，命令退出 2，但其余 App/API 结果有效；后续只查实际类型文件，不重复该路径。
- B1 有效场次再次显示“正在准备研究…”；进入 Run 后同屏是“正在搜索 / 12 条可用参考”、七阶段和四个任务书专属问题，且可返回主页。B1 能准确复述：PDF 已把问题收束到工序、长廊、互动节点和四维体验，运行仍在继续。T2/状态理解通过。
- B1 第二次尝试终态为诚实 partial：界面写“已有证据已保留 / 12 条可用参考 / 覆盖 0 个项目”，后端是 `blocked / article_analysis_incomplete`。复核发现临时解析器错误地从 `/projects/p1` 的第一个 `/p` 切 URL，正文 analyzer 实际没跑；这是测试夹具故障，不计产品或 persona 结果。界面没有伪装 completed，状态诚实性反而通过。
- 第三次隔离尝试中 parser 已正确返回正文，但 workflow 只会对推断为 `trusted_secondary` 的直接项目页进入 public-page analyzer；临时 `research.example` 域名被推断为未知来源，所以 12 页均停在 `enriched: 0`。这是夹具来源分级未满足产品安全门槛，不是产品缺陷；下一次改用可信出版域名形状并换全新隔离数据根。
- B1 v3 的可信来源夹具已进入正文分析：loaded UI 展示四个任务书问题，每问都有 3 个“代表案例”、证据出处和“怎么做”。但同一屏顶部又写“研究尚未完成 / 覆盖 0 个项目 / 12 条可用参考”，与正文至少 3 个明确项目冲突。先作为核心结果状态 P1 候选，下一步用只读 Run/coverage 数据判断是计数语义还是夹具字段缺口。
- v3 的“覆盖 0 / 正文有案例”已判定为夹具字段错配，不是产品缺陷：formal coverage 要求 top-level `project_context` 与 `design_mechanism` 两句都各自绑定逐字引文；临时 analyzer 提供的是另一组同义句，只让按题 branch 达到 Board 展示门槛。已让 v4 analyzer 对齐 mock asset 的原始两句并各带逐字引文；v3 仅保留为系统校准事件，不计 persona 或缺陷。
- v4 进一步暴露默认 mock 的重复 evidence 行为：mock 搜索先为 `project_context` 持久一个无 excerpt 的 claim；正文 analyzer 返回同一 statement 和真实 excerpt 后，持久层把它视为重复而没有补齐 excerpt。`design_mechanism` 能新增带 excerpt 的 claim，但 context 仍无引文，formal coverage 因而继续为 0。这再次支持已登记的“默认 mock 完成/展示合同 P1”，但 v4 仍作为系统校准事件，不计 persona。
- B1 有效场次通过完整任务书链路：等待态明确，PDF 收束出四个专属子问题，完成结果能用“方向→代表案例→怎么做/适用条件→出处”理解；直接收藏原位反馈；个人收藏目录同时显示原研究问题与任务书衍生方向，详情保留解法、出处和案例图。T2/T3/T6a/T7 全部通过。
- B2 选择同一 PDF 后也只显示“1 个文件待上传”，真实文件名 `m152-smart-museum-brief.pdf` 不在 DOM；复现 B1 的提交前无法核对文件问题，达到 2/2 重复 P2 阈值。
- B2 收藏目录把两条相同任务书方向、不同原问题分别显示为完整“原研究问题”，视觉上可一眼区分，建筑收藏的 T7 关系理解继续通过。不过两行按钮的可访问名称都只有同一个子问题，未包含原问题；当前只在 B2 的双记录场景出现，作为单画像可访问性 P2 观察，不单独立项。
- v5 API 为两位任务书 persona 提供一致的正式终态：两条 Run 都是 `completed / coverage_satisfied / 12 usable / 4 projects / 4/4 subquestions`；浏览器 error 日志为 0。空库仍生成两个创建于同一秒的默认工作区，其中只有一个承载 2 Runs，初始化竞态 P1 在独立 v5 数据根再次复现。
- M152 分级闭合为 3 项 P1（图纸收藏缺原问题/方向、fresh DB 双默认工作区、默认 mock completed 与 evidence 展示脱节）与 4 项 2/2 重复 P2（图纸去重计数口径、XHS/Chrome 职责、图片选择 accessible name、任务书文件名）。其余单画像观察不立项；统一进入 M153，不在 M152 修改生产代码。
- 最终 durable 只读核验发现收藏从交接基线 11 增至 14，但新增 3 条均创建于 12:04、属于既有“城市社区共享中心”Run 的多使用者活动问题，和 M152 的两条图纸问题/两条《耕织图》问题都不匹配；正常 Runs 仍为 15。结合本轮隔离 Run 全在临时库，可判为并发外部状态变化，必须保留并把当前基线更新为 14 collections，不能回删。

## 2026-07-27 M153 第一轮审计

- 默认工作区竞态触点已定位到 Board `App.tsx:1432-1441`：挂载 effect 先 GET，空数组后直接 POST “建筑研究工作区”。React/Vite 开发模式的严格挂载会让两个 effect 同时看到空库，纯前端 `length===0` 无法提供数据库级唯一保证；验收测试必须真实并发触发，而不只断言单次调用。
- 任务书、图纸环境与图片 accessible name 都是现有 App JSX 的直接投影，可做小型展示修复，不新增页面或确认步骤。Impeccable 的约束是继续使用标准文件控件、平面信息层级与既有 4/8 token，不为文件名或说明再造卡片。
- 当前 PRODUCT 仍写“文件名由原生控件显示一次，外层只保留文件数量”，与 M152 loaded DOM 中实际无法核对文件名的证据冲突；M153 应迁移这条产品合同为“外层列出已选文件名”，而不是保留旧条款再叠加例外。
- 图纸收藏数据层已按 `snapshot.question` 分组，但只有建筑收藏把该分组投影为问题目录；视觉收藏直接铺图片，所以 P1 不需要新增 durable 字段。方向可从收藏 snapshot 的 `subquestions` / 保存时的选中子问题继续追查，优先复用现有快照。
- 默认 MockResearchProvider 直接预填 context、mechanism、transfer 与 facts，却没有逐字 excerpt；现有 workspace POST 也完全无幂等/默认语义。后端修复应保持普通“创建项目”仍可自由命名，把“确保默认项目”与普通创建分开，不用 workspace 名称唯一索引改变用户行为。
- 默认工作区竞态不应通过“名称唯一”修复：普通用户可能合法创建同名项目。最小安全方案是为首启增加独立的幂等 ensure-default 语义，并在数据库冲突层保证并发调用只留下一个默认工作区。
- 图纸收藏已有 `snapshot.question`，但视觉收藏分支没有渲染它；仍需确认保存快照是否也保留具体方向，不能在 UI 中臆造不存在的数据。
- 任务书文件名合同与当前 `PRODUCT.md` / `DESIGN.md` 中“外层只显示数量”的旧规则冲突；实现时需要同步迁移产品合同，改为控件外展示已选文件名。
- 图纸选择按钮目前所有项共享同一个 `aria-label`，应组合方向、来源、图片类型和序号形成稳定且可区分的名称。
- 图纸总量是去重后的资产数，方向分组是关联数；页面需要一句短说明，明确同一张图可能归入多个方向，避免用户把去重总数与各方向关联数相加后误判为计数错误。
- 图纸收藏保存时 `run.question` 已进入 snapshot，但 `_collection_case_subquestions` 对 visual goal 直接返回空数组；关联方向仍保存在 `AssetCandidate.subquestion_ids` 与 `ResearchRun.subquestions`，因此可以无迁移地写入并回填 `visual_directions`，旧收藏也能兼容恢复。
- 默认 Mock 的最小证据合同收敛为 ProviderAsset 上的可选 `evidence_excerpts` 映射：仅 Mock 为其已声明的 context/mechanism 提供确定性摘录，持久层只按 statement 精确绑定；真实 provider 默认空映射，不凭空把模型总结冒充网页逐字引文。
- 首启幂等入口采用固定 default workspace id + SQLite `INSERT ... ON CONFLICT DO NOTHING`。普通 `POST /workspaces` 保持原样，重复名称仍合法；Board 只把空列表后的创建调用换成 `ensureDefaultWorkspace`。
- UI 最小投影已确定：视觉收藏每张图下方显示“原研究问题 / 灵感方向”；任务书选入后用平面文件名列表供提交前核对；图纸结果标题旁补充“总数按不重复图片计算，同一张图可出现在多个方向”；选择按钮名称包含方向、帖子、图纸类型和组内序号。
- 实现后并发测试稳定通过：两个同时到达的 `POST /v1/workspaces/default` 返回同一固定 UUID，库中只产生一个默认项目；随后两个普通同名 `POST /v1/workspaces` 仍各自成功，确认没有偷改用户创建语义。
- Mock 的证据映射在 live OpenAI 结果进入持久层前由 `_conservative_live_result` 强制清空，因此只有确定性 mock fixture 能直接写入演示摘录；真实 provider 仍必须依赖网页正文分析，正式事实门槛没有放宽。
- Board 第一轮绿灯只剩两处旧环境文案断言；它们是合同迁移而非实现错误，更新为 Chrome/小红书分工后的新词后，App + client 114 项全部通过。
- loaded QA 证明默认工作区修复不仅是接口单测成立：React 开发模式从 fresh DB 启动后，页面与 API 都只返回固定 UUID 的同一个“建筑研究工作区”。
- 视觉结果中的“5 张”是唯一图片数，3/2/2 的三个方向合计为 7 次关联；桌面和 390px 都能同时读到计数说明，且 7 个渲染关联按钮生成 7 个唯一 accessible name。
- 两条视觉收藏的最小认领信息是“原研究问题 + 灵感方向”；在 390px 下两组文本完整呈现且 `scrollWidth === clientWidth`，无需新增详情页或卡片层级。
- 外部 `images.example` 测试图故意不可达时，页面使用既有“灵感图加载失败”占位；这不影响关系、计数和可访问性验收，也没有产生 console error。
- Browser 的 viewport capability 在 reload 后才能稳定作用到目标标签；对弹出窗口调用 `window.resizeTo` 不是可靠的移动端验收方式。

## 2026-07-27 M122 第一片边界

- 这是一轮行为保持型重构，不接受顺手改文案、界面、样式或后端合同；任何变更行都必须能追溯到覆盖率基线或纯函数搬移。
- “失败行为测试”在本片解释为模块边界红灯：测试先从尚不存在的 `lib/*` 入口导入并断言现有行为，确认因缺模块失败后再搬实现；产品行为本身已有 141 项 Board 回归守卫。
- 覆盖率基线必须在搬移前取得；搬移后以同一命令比较，不允许用排除文件或降低阈值制造“覆盖率不下降”。
- Board 与 Extension 的 Vitest 配置都尚未声明 coverage，两个 package 也都没有 `@vitest/coverage-v8`；当前实际测试解析到 Vitest 4.1.10，因此 coverage 插件应使用同一 4.1.x 兼容线，并把稳定命令写成各自的 `test:coverage`。
- extraction map 所列第一片函数仍全部位于 `App.tsx`，但 M153 后行号整体后移；抽取必须按符号与依赖定位，不能按旧行号机械切片。
- 搬移前覆盖率基线：Board 78.17/72.39/80.50/81.78（statements/branches/functions/lines），其中 `App.tsx` 78.29/72.34/78.66/81.85；Extension 82.69/76.52/83.96/84.73。后测使用同一 include/exclude 与 reporter 配置，不以改配置规避下降。
- 第一片依赖图可保持单向：text、labels、storage 独立；backup 只依赖 storage；workResult 依赖 text+labels+API types；demo 依赖 workResult+mock；run 依赖 labels+API types；collections 只依赖 API types。`researchSynthesisOverview` 与 React 组件暂留 App。
- 搬移后 Board 总覆盖率 78.36/72.59/80.50/81.84，四项均达到或超过原基线；新 lib 组为 88.67/81.41/97.01/91.92。App 单文件比例因移走高覆盖纯函数而重新分母化，不能与旧 App 数字直接解释为行为漏测；项目总量和新模块分项才是同配置下可比指标。
- `copy-glossary.test.ts` 原先把单体 `App.tsx` 当作全部用户文案集合。模块化后必须显式拼接各生产纯模块，否则既会误报必需词缺失，也会让禁用词在新模块逃逸；这是一条需沿后续组件拆分继续维护的源码守卫合同。

## 2026-07-27 M122 第二片边界

- `<DataManagementPage>` 的文件、预检、下载和最终确认状态没有被其他视图消费，适合整体移入组件；App 只保留页面开关、跨开关清空的操作提示、当前项目/研究记录计数、运行中禁用状态和恢复后刷新工作区的父级回调。
- 恢复顺序是本片的关键行为合同：上传恢复 → 重新读取工作区 → 父级更新列表并优先恢复原 active id → 写入 localStorage → 重置当前工作区视图 → 页面清空预检/文件/确认并显示完成状态。抽取不得调换该顺序。
- 页面文案与 CSS 已在 M151 验收，本片不改任何可见文本、className 或响应式结构。`copy-glossary.test.ts` 需要把新生产组件源码纳入扫描，防止抽离后形成文案守卫盲区。

## 2026-07-27 M122 第三片边界

- 四个目标都是条件渲染的叶子覆盖层；App 继续唯一持有 open 状态、触发按钮 ref、统一 `closeOverlays`、body scroll lock、Escape 关闭和 Tab 循环。组件只接收数据与 `onClose`/动作回调，不各自复制焦点管理。
- SharePanel 只需研究类型、已选数、可直接分享图片数、确认与关闭；StylePanel 只需 profile/status、字段修改、保存与关闭。两者不应下沉 API 或父级状态。
- ComparisonDialog 的 overview、推荐首项和表格完全由 selected results + failed preview map 派生，适合随视图下沉；SourceInspector 同样可由单个 WorkResult、收藏/拒绝/备注状态与小回调完整渲染。
- 既有 App 回归直接覆盖分享确认、样式保存和案例对照；SourceInspector 缺少正向打开合同，因此本片的独立组件测试必须覆盖预览失败、证据矩阵、收藏/拒绝、备注 change/blur 与遮罩关闭。
- `copy-glossary.test.ts` 仍是用户文案全集守卫；四个组件搬出后都要纳入 raw source 拼接。CSS class 与 DOM 层级原样保留，不做覆盖层视觉重设计。

## 2026-07-27 M122 第四片边界

- 收藏页的五个状态仍由 App 持有：页面开关、建筑/图纸视图、选中目录项、收藏列表和加载态；因此返首页、重新打开及切换视图时的既有复位时机不会因组件挂载方式改变。
- `collectionSections`、建筑目录和当前目录详情只服务收藏页，可随 JSX 一并下沉；新组件接收受控 view/selection、收藏列表、加载态以及切换、选择、删除回调。
- `deletePersonalCollection` 必须留 App：它同时调用删除 API、更新 `personalCollections` 并按被删快照同步 `savedIds`，不是纯展示职责。打开收藏页时的 API 加载与返回主页状态复位也留 App。
- 既有 App 集成测试已覆盖建筑/图纸计数与切换、建筑目录/详情/返回、视觉上下文、来源、删除及重新打开后的复位；本片另补组件边界红绿测试，避免机械搬移后仅靠大组件间接覆盖。

## 2026-07-28 M122 第五片边界

- `<VisualInspirationBoard>` 只负责方向→帖子→图片的展示与事件转发；`inspirationGroups`、全结果顺序、已选 id、失败预览表和持久化选择函数由 App 提供。打开检视器时仍由 App 记录 trigger、result/subquestion 并切换 overlay。
- `<CaseAnalysis>` 只负责子问题章节、代表案例答案、直接收藏/批量选择和可选项目预览；`caseGroups`、收藏选择状态、saved/rejected 状态、浏览器不可用判断及所有 API 副作用继续留 App。
- 两块结果视图共享 `WorkResult` 和既有纯 helper，但不互相持有状态；为了保持地图规定的边界，不把 group 派生或跨视图选择 reducer 顺手移入组件。
- 既有 App 回归已覆盖主结果结构、视觉方向/帖子/图片、空章节、直接收藏和预览分支；本片仍需独立组件合同，明确 props 与回调语义，并把两个新生产源码纳入 copy glossary 扫描。

## 2026-07-28 M122 第六片边界

- `<ResearchComposer>` 是受控表单：goal/mode/question/files/referenceUrl、加载/运行/就近错误和浏览器环境状态全部由 App 持有；组件只渲染两类入口、任务书/案例页和环境操作，并原样转发表单与按钮事件。
- `questionInputRef` 继续由 App 持有并传入 composer，因为 `<HomeSections>` 的问题起点点击后必须跨组件把焦点送回研究问题；这是两个组件之间唯一通过父级协调的 DOM 引用。
- `<HomeSections>` 可一并承接固定 problem starters、RunHistoryList 和日期/保留期显示 helper；工作区创建、打开历史 Run、更新保留期仍是 App 回调。这样不会把 API 或页面导航下沉。
- 关键行为合同包括：切换 goal 时父级清空不兼容输入；建筑模式显示三档与可选资料，视觉模式显示环境状态；提交错误紧邻按钮；新建项目表单受控；最近研究保留期和打开/永久操作保持原 accessible name。
- 第六片抽取后 `App.tsx` 从 2,349 行降至 2,024 行；组件事件只回传到父级，`handleResearchSubmit`、`handleCreateWorkspace`、`openRun`、`handleRunRetention`、浏览器连接及取消/重试都未下沉。
- 第七片的真实耦合点不是展示文案，而是六项浏览器状态有多个写者：`loadBrowserReadiness`、`handleConnectBrowser`、`ensureBrowserResearchAccess`、`refreshBrowserConnection`，以及 `hydrateRun` 对 `browserConnected` / `xiaohongshuSearchAvailable` 的额外写入。hook 合同必须先钉住竞态与陈旧结果处理，不能只把 useState 和 callback 机械挪文件。
- `useBrowserReadiness` 现在是浏览器环境状态的唯一写者；每次异步检查先取得递增 request id，只允许最后启动且仍有效的检查提交状态。Run 水合复用同一入口并传入自己的 `shouldApply`，因此旧 Run 和旧环境请求都不能覆盖更新结果。
- 初始检查、手动刷新、服务连接刷新、配对/自动连接、XHS 已可用短路、可选 Chrome 放行、页面权限拒绝、API 错误和 demo no-op 均有 hook 或 App 合同；迁出的文案继续由 copy glossary raw source 扫描。
- 第八片不能直接把 `hydrateRun` 和 polling effect 搬文件：当前 payload 有 results、两个 selected id、board、comparison/saved/rejected、notes、trace、style 等成组写入和两套 reset，且 `hydrateRequestRef` 跨打开、启动、取消、重试、重跑和返首页递增。应先用 reducer 固定 hydrate/reset 原子边界，再抽请求世代与轮询。

## 2026-07-28 M122 第八片边界与结果

- Run payload reducer 统一承接 results、selected ids、board、comparison/saved/rejected、notes、trace 与 style；hydrate/reset 由单次 reducer action 提交，局部收藏、拒绝、备注、选择和样式仍通过等价函数式更新，保留异步完成时读取最新 state 的语义。
- `useRunHydration()` 独占请求世代：打开、启动、取消、重试、重跑、切项目和返首页只调用 begin/current/invalidate/isCurrent，不再直接共享 ref。水合仍先并发读取 results/board/user/events 与浏览器环境，再按 board id 读取 style；每个提交点都检查同一世代。
- `useRunPolling()` 保留 1 秒间隔、busy 防并发和后台 Run 静默更新；只有当前打开的 Run 到达终态才水合 payload，后台 Run 只更新最近研究，错误也只在当前打开 Run 上展示。
- 新合同覆盖完整 hydrate/reset、成功投影 board/user/trace/style、局部函数式更新、陈旧请求丢弃和终态顺序。Board 最终 177 tests，覆盖率 80.01/75.75/84.77/83.80，四项均不低于第七片。

## 2026-07-28 M123 初始审计

- CI 草案已存在于 `.github/workflows/verify.yml`，不是从零新增；M123 必须先验证其是否真的覆盖 Windows 所需门禁，不能仅以文件存在作为 CI 完成证据。
- Git 外旧发布清单仍绑定 2026-07-16 的 Quick/Balanced/Deep：Balanced `7d8faa53` 与 Deep `b4c314a6` 已在 M131 删除，对应 8 张 PNG 已失效；Quick `d13bdc67` 两张仍在。旧清单的 226 API / 75 Board 门禁也已明显过期。
- `.artifacts` 另有三份可恢复数据备份与当前 Board/Extension coverage summary；所有文件先保留。发布证据刷新应基于当前 durable Run 与最终门禁，不复用失效 Run，也不主动调用 live provider。
- 支持的更新语义不是替用户拉取源码：`scripts/update.ps1` 在源码已由用户替换后执行 stop → setup → verify → start，禁止 Git 写操作；任何安装或门禁失败都会在 start 前终止。
- CI 草案原本已有 Windows/Python 3.12/Node 24/setup/full verify，但缺少手动触发、显式只读权限和 M122 coverage 门槛。M123 只补这三项，不引入 live provider 或额外服务。
- V2.1 的发布版本面此前仍为 `0.1.0`；API 包/应用、Board 包、Extension 包/manifest 现统一以 `2.1.0` 为发布合同。根包继续 private 且无版本，不作为可发布制品。
- 干净安装使用当前解析到的 Ruff 0.16，发现 `apps/extension/tests/e2e/support/full-stack-api.py` 把同属第三方的 `uvicorn` 与 `archresearch_api` 分成两个 import block；这是 clean-install 工具链兼容问题，不是产品行为或持久数据问题。最小修复只移除块间空行。
- 用户截图中的 `image_gen.imagegen` schema/registration 报错来自 Codex 客户端工具注册冲突；本轮没有调用图片生成，也不属于 ArchResearch 运行、更新或发布链故障。
- 隔离更新在 fresh setup 后完整通过 348 API / 177 Board / 165 Extension / 8 packaged E2E 与全部静态、类型和构建门禁，随后重新启动 8001/5174，两个端口均返回 200。
- `archresearch-backup-before-husk-delete.zip` 的隔离预检为 `ready=true`、format 1、schema `d0f1a2b3c4d5`，识别 56 files / 61,044,756 bytes / 4 workspaces / 17 Runs / 7 collections / 2 inputs；运行前后隔离 SQLite 的共享读 SHA-256 相同，workspace 0→0，未调用 restore。
- 最终源码可视证据采用仍可由当前 API 核对的三条 permanent Run：Deep `76f52c79`（51 usable / 9 formal projects / 6/6 / gaps 0）、任务书 Balanced `ff16988d`（28 / 8 / 4/4 / gaps 0）、图纸 Quick `f5be3f17`（5 / 3 / 3/3 / gaps 0）。桌面首页、备份桌面/390px和三条结果页均横向无溢出、console error 0。
- 旧 2026-07-16 清单的 Quick `d13bdc67` 后来也在 M144 作为不可恢复空壳删除，故不应只归档 Balanced/Deep 的 8 张图；10 张旧 UI 截图全部保留为历史材料，但不再作为当前发布证明。

## 2026-07-28 M123 最终结论

- 当前源码的本地可重复发布链已经形成闭环：fresh setup、start、stop → setup → verify → start 更新、隔离备份预检、当前 API 证据与 loaded UI 截图均可复核；默认路径不需要 live provider key。
- 当前发布清单为 `docs/release-evidence-2026-07-28.md`。旧清单与 10 张旧 PNG 已移动到 history 位置而未删除；旧底层 Run 均已不存在，历史截图不能再作为当前发布证明。
- 根级 coverage 最终为 Board 177 tests、80.01/75.75/84.77/83.80；Extension 165 tests、82.69/76.52/83.96/84.73。根级 `scripts/verify.ps1` 另通过 348 API / 177 Board / 165 Extension / 8 packaged E2E 及全部静态、类型、构建、进程、安全和评测检查。
- 本地证明不等于 Hosted CI 已运行。工作流合同已就绪，但远端 CI、版本 tag 和公开发布只能在用户明确授权 Git 发布后产生。

## 2026-07-28 M154 发布预检

- GitHub CLI 2.96.0 已登录 `jileyu2000`，具备 `repo` 与 `workflow` 权限；但本地仓库没有任何 Git remote，账号前 100 个仓库中也没有名称含 arch/research 的候选，不能推断发布目标。
- 项目内可安全清理项是 Mypy/Pytest/Ruff 缓存、`.artifacts` coverage/验证日志与已忽略的旧审计 scratch；API venv、pnpm dependencies、Extension dist 和 `.archresearch` 仍服务本地运行链，不能按体积机械删除。
- `.artifacts` 的三份 ZIP 共 197,333,728 bytes，属于用户数据备份；16 张 portfolio PNG 共 2,609,028 bytes，属于当前/历史发布证据。两类都不是临时垃圾，清理阶段保留，发布 stage 必须显式挑选而不能 `git add -A`。
- 首次 Hosted CI 的 coverage step 不是覆盖率阈值失败，而是 `design-system.test.ts` 的源码结构正则在 Windows CRLF checkout 下误报：选择器组与 `transform: none` 的语义关系未变，但 `\r` 让 240 字符距离上限被突破。测试入口统一换行后，原结构合同可跨 LF/CRLF 执行，无需改生产 CSS 或降低任何门槛。
- 第二次 Hosted CI 已通过 coverage，完整门禁只在 `dev-common.tests.ps1` 的 `.EndsWith("pnpm.cmd")` 失败。Corepack 在 hosted runner 提供可正常执行的无扩展 `pnpm` shim；运行解析器和 setup 均已成功，故正确合同是“路径为现有文件且去扩展名为 pnpm”，而不是绑定某一种 Windows shim 后缀。
- Hosted CI run `30330946581` 已把失败范围缩到环境准备：348 API、177 Board、165 Extension、coverage、lint、typecheck 与 build 均通过；packaged Extension E2E 的 2 个入口因 `ms-playwright/chromium-1228/.../chrome.exe` 不存在而失败，其余 6 项未运行。E2E 实际使用 Playwright Chromium，不使用 runner 自带的系统 Chrome。
- 最小修复是在 workspace setup 后显式执行 `pnpm --dir apps/extension exec playwright install chromium`；发布合同必须锁定该步骤，防止后续工作流注释或 runner 镜像假设再次掩盖真实依赖。
- Hosted CI run `30332351557` 最终全绿：Chromium 安装成功，coverage 通过，完整门禁明确输出 348 API 与 8 packaged E2E 通过；作业总耗时 16 分 58 秒。CI 注释只剩 GitHub Actions 运行时的 Node 20 弃用提示，不影响仓库 Node 24 测试面，也不是本次发布阻塞。
- 最终 tag 落点 `2a92539` 的 Hosted CI run `30334270656` 全绿；annotated tag `v2.1.0` 已推送，正式 Release 为非 draft、非 prerelease，且 assets 为空。GitHub 自动源码包只来自公开 Git tree，不包含被忽略的备份、数据库或凭据。

## 2026-07-28 M155 架构边界审计

- ArchResearch 当前已经是 Evidence-Grounded Plan-and-Execute Agent：模型负责拆解、页面分析与综合，确定性后端负责七阶段编排、工具边界、证据准入、coverage/enrichment 完成门槛和失败保留；优化目标是让源码边界匹配现有运行语义，不是更换 Agent 架构。
- `workflow.py` 当前 4,998 行；`execute_research_run()` 从 185 行延伸到 1,407 行，后续同文件继续承载规划、查询生成、公开页解析、视觉分类、证据持久化、综合、coverage 与失败处理等近 50 个私有函数。
- 348 项 API 基线中，`test_workflow.py`、`test_browser_inspection.py` 和 runs/results 合同大量从 `execute_research_run()` 公共入口覆盖 checkpoint、恢复、取消、来源降级与终态；大块移动执行器风险高，第一片应从无数据库写入的纯规划边界开始。
- M155 不引入 LangChain、LangGraph 或多智能体；`workflow.py` 继续作为单一 orchestrator，抽出的模块只提供 typed、bounded 的阶段职责。
- 第一片初审发现生产调用虽已切到 `agent/planning.py`，旧的 8 个规划/查询函数和站点轮换常量仍留在 `workflow.py`，形成双实现；这必须随本次抽取删除，不能用兼容别名继续保留隐性第二入口。
- 删除旧定义后的首轮红灯来自 `test_workflow.py` 与 `test_browser_inspection.py` 直接导入旧私有函数。测试应迁移到新边界并保留原断言，而不是恢复生产私有入口；迁移后规划、查询、视觉 fallback 与完整 workflow 定向集共 46 项通过。
- 第一片收尾后 Ruff check/format、strict Mypy 与 `git diff --check` 均通过。一次只读 `rg` 同时包含不存在的根 `pyproject.toml` 导致 exit 1；实际配置位于 `apps/api/pyproject.toml`，后续不再查询该不存在路径。
- 第二片选择核验边界，因为 `_coverage()` 虽读取持久结果，却具有稳定的 `CoverageData` 输出并唯一承载 coverage/enrichment 双门槛；相比搬动 1,200 行执行器，这一边界可由现有终态回归直接保护。
- `agent/verification.py` 现在独占 coverage 计算、非建筑目标阈值以及 `completion_satisfied()` / `enrichment_satisfied()`。`workflow.py` 只消费结果决定阶段和终态；测试 monkeypatch 同步迁移到公开边界绑定，没有留下旧 `_coverage` 别名。
- 独立合同明确：coverage gaps 为空只代表逐题覆盖成立，enrichment gaps 仍存在时不得 completed。新模块 2 项与完整 planning/workflow/browser-inspection 受影响集 153 项通过。
- 一次只读测试搜索同时包含不存在的 `test_runs.py` / `test_results.py`，命令因此 exit 1；有效匹配均来自实际存在的 workflow/browser 文件，后续不再使用这两个路径。
- 核验模块首个合并补丁因现行 `CoverageData` 另有 `synthesis: NotRequired[...]` 字段而匹配失败，工具在写入前整体中止；随后按真实定义拆成原子补丁并保留该字段。
- M155 最终边界为 `planning`（计划/查询/站点轮换）、`execution`（checkpoint/取消/恢复键/预算与计数）、`verification`（coverage/enrichment）和 `synthesis`（证据绑定的确定性综合内核）。Provider 调用、页面解析和事务型证据持久化仍由现有具体适配层承担，没有引入框架或多智能体运行时。
- 执行支撑机械重命名曾把新导入 `build_research_context` 的旧后缀再次替换成 `buildbuild_research_context`；首轮导入测试立即捕获，修正单一导入后同一测试通过。综合结构检查也有一次无效 workdir 路径，改用正确项目根后完成，均未造成持久状态变化。
- 四片合并后的权威 `scripts/verify.ps1` exit 0：360 API / 177 Board / 165 Extension / 8 packaged E2E，以及 Ruff/format、strict Mypy、两端 lint/typecheck/build、进程/安全/评测检查全绿。
- durable 只读复核仍为 4 workspaces / 15 Runs / 13 permanent / active 0 / 14 collections / 2 input artifacts；API 8000 health 为 ok，Board 服务保持。首次用不存在的 GET `/workspaces/{id}/inputs` 统计输入得到 405，未写数据，已改用 SQLite `mode=ro` 得到正确 2。

## 2026-07-28 M156 竞赛要求

- 公告明确提交物：智能体 Demo 链接或代码包、项目技术说明、核心演示视频、AI 应用履历表；支持个人或不超过 4 人团队，报名与作品提交周期为 6 月 24 日至 8 月 31 日。
- 评审三维度：场景创意价值（真实痛点与落地可行性）；AI 协同能力（人机协同规划、AI 交互迭代、AI 纠偏管理）；技术创新能力（创新构思、技术应用、工具整合、完成度）。
- 技术说明模板要求覆盖目标用户、痛点与问题定义、使用场景、实际价值、核心功能、技术方案、提示词/交互、知识来源、工作流/工具、前后端/数据库/API/部署、架构图、创新差异、完成度/不足、访问步骤、1-3 个测试问题、案例截图和团队分工。
- 人机协同履历表按 L1 基础问答至 L6 业务创新自评，并记录“使用场景 / AI 工具 / 描述”。GitHub 不替代该表，但应诚实呈现模型负责的任务、确定性系统负责的约束，以及测试/人工决策如何纠偏。
- 公告第 3 页要求独立构思与自主研发，并规定传播/展示权利；README 只使用仓库自有截图和可复核数据，不复制公告海报作为项目宣传素材。
- 公告 PDF 10 页已逐页渲染并检查。两份 DOCX 因本机无 LibreOffice 无法渲染，按 documents 技能允许回退路径完成段落/表格结构提取；模板未修改。

## 2026-07-28 M156 GitHub 展示边界

- GitHub 仓库本身可同时承担公告允许的“Demo 链接或代码包”和公开项目介绍，但不能替代技术说明 DOCX、核心演示视频或 AI 应用履历表；README 只覆盖评审快速理解与复现入口。
- 当前产品是 Windows/Chrome 本地应用，没有公网 SaaS。公开页应把固定 `?demo=` 回放、默认 mock 持久化闭环和主动启用的实时网页研究分开，不能把前两者描述成真实模型或实时网页结果。
- 最短评审入口统一使用现行三档“快速找方向 / 形成方案依据 / 做跨案例论证”；`quick / balanced / deep` 只作为内部 URL/请求值说明。
- 版本化任务的权威数量是 25：`research_tasks.jsonl` 实际 25 行、fixture README 与 `validate-evaluation-fixtures.ps1` 合同均为 25。README、architecture 和 demo 文档中的既有“30 条”均是过时陈述，发布前统一修正。
- 公开完成度以现有可复核证据表述：360 API / 177 Board / 165 Extension / 8 packaged E2E；实时研究所需 Provider、浏览器权限、小红书登录态、单活限制与图片权利降级必须与能力一同呈现。
- 公开产品提交 `010eceb` 的 Hosted CI `30362938145` 在 fresh Windows runner 通过 setup、Chromium、前端 coverage 和完整仓库门禁；日志明确为 25 条 fixture、360 API、177 Board、165 Extension、8 packaged E2E 与 `All ArchResearch checks passed.`。

## 2026-07-28 M157 长期项目主页定位

- 用户明确：GitHub README 是 ArchResearch 的长期通用项目主页，即使不参加竞赛也会公开发布；竞赛要求只用于帮助组织目标用户、痛点、场景价值、技术方案、人机协同、完成度和访问方式，不能成为仓库定位。
- 当前 README 的“参赛定位”、海之子杯/投稿方向/评审跳转、“作品简介（100 字内）”、“技术说明模板要求”、“当前参赛版本”和“评审访问与演示”会让访客误解项目专为竞赛制作，必须改为普通项目语言。
- “课程设计、建筑竞赛或毕业设计”是产品的真实使用场景，不属于竞赛投稿定位，应保留；Agent 四模块、截图、安装、演示、测试问题和已知边界也都继续保留。
- 本轮不需要改架构、产品代码或运行功能；验收重点是公开表达、Markdown 完整性、敏感信息边界和发布后 Hosted CI。

## 2026-07-29 M158 Cloudflare Web Edition 用户决定

- 用户明确要求建设可公开访问、可实时研究的完整 Cloudflare 网页版；网页版模型费用由项目方承担，评审无需配置 Key。GitHub 继续提供独立的一键安装本地版，本地版由每位用户自行配置 Key，两种版本不能混淆。
- 网页版长期研究记录要求保存在各自使用者本机。浏览器环境中的可实现语义是同一站点 origin 下的 IndexedDB/OPFS，而不是任意可见文件夹；清除站点数据、无痕模式、换浏览器或换设备会丢失，因此版本化导出/导入是必要功能。
- 真实长任务不能做到云端绝对零状态：浏览器关闭后仍需继续/恢复时，Cloudflare 必须保存最小化、带 TTL 的运行中 checkpoint 和临时素材；完成结果传回浏览器后删除。长期历史、收藏和项目目录不建立平台级案例库。
- 项目方 Key 绝不能进入网页 bundle、IndexedDB、日志或客户端请求。公开匿名入口必须先经过 Turnstile、设备/IP 配额、单次查询/页面/时间/Token 预算、每日总费用熔断和紧急 kill switch，否则公开 URL 会直接暴露项目方成本。
- 现有 `AGENTS.md` 仍把范围限定为本地优先 V2.1；M158 必须先把“保留本地版并新增独立 Web Edition”写成明确仓库合同，不能暗中把本地产品改造成 SaaS。
- 用户追加约束：Web Edition 虽允许所有持有链接者在线使用，但其地址不得出现在 GitHub README、Release、About 或仓库文档，只私下提交给评委。GitHub 继续作为本地安装版和项目资源展示页。

## 2026-07-29 M158 Cloudflare 官方能力审计

- Workers Paid 的单次 HTTP 请求默认 30 秒 CPU、可配置到 5 分钟，内存 128 MB；等待网络不计 CPU，但客户端断开后普通 `waitUntil()` 最多延续约 30 秒。因此研究流程不能依赖单条 HTTP 连接，入口只负责校验和创建任务。来源：<https://developers.cloudflare.com/workers/platform/limits/>。
- Workflows 原生提供跨分钟、小时或更久的 durable step、自动重试、暂停和实例生命周期，适合七阶段 plan/execute/verify/synthesize；每一步仍需服从 Worker CPU 与外部资源预算。来源：<https://developers.cloudflare.com/workflows/>。
- Durable Objects 是全局费用预留和 kill switch 的正确单写者边界；Worker Rate Limiting binding 是边缘位置内最终一致的近似限流，官方明确不应当作精确 accounting，因此只能做入口防滥用，不能替代精确费用账本。来源：<https://developers.cloudflare.com/durable-objects/platform/limits/>、<https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/>。
- Browser Rendering/Browser Run 在 Paid 计划按使用计费并有并发、启动速率与闲置超时限制；每次研究必须限制页面数、并发和会话存活时间，不能为匿名用户提供无界 crawl。来源：<https://developers.cloudflare.com/browser-rendering/platform/limits/>。
- Turnstile token 必须由服务端 Siteverify 验证，token 五分钟过期且只能使用一次；入口还需校验 action/hostname，不能只相信前端 widget 成功。来源：<https://developers.cloudflare.com/turnstile/get-started/server-side-validation/>。
- Provider Key 与 Turnstile secret 使用 Worker Secret，禁止写入 `vars`、Wrangler 配置或 Git；公开 bundle 只允许非敏感 site key。来源：<https://developers.cloudflare.com/workers/configuration/secrets/>。
- 选定拓扑：静态 Web 工作台 + API Worker 作为唯一公网入口；Turnstile/近似速率限制先行，CostGuard Durable Object 原子预留预算后才创建 Research Workflow；Workflow 保存最小 checkpoint，临时大对象写有生命周期规则的 R2，完成结果交付浏览器 IndexedDB/OPFS 后清理。默认测试全部以 in-memory fake bindings 运行。

## 2026-07-29 M158 当前实现与恢复结论

- 先前的 R2/Browser Rendering 默认拓扑已被当前实现取代。`apps/edge` 的默认公开页读取为受限 HTTPS `fetch`、每页 32,000 字符上限、最多 3 个并发、`HTMLRewriter` 去除脚本/导航等噪声后抽取正文；不配置 R2 或 Browser Rendering binding。
- `apps/web` 已实现第一屏研究工作台、快速/形成方案依据/跨案例论证三档、开始/轮询/取消、结果与最近记录。长期 Run、evidence-bound result、collection 当前仅写 IndexedDB；版本化 JSON 可导入导出。OPFS 附件存储尚未实现，不应在公开说明或交接中称为已交付。
- `apps/edge` 已有静态资源 + `/api/*` 路由、same-origin 检查、CSP/noindex 等响应头、Turnstile 服务端校验、设备/IP 近似配额、`CostGuardDurableObject` 精确预留、七阶段 Workflow、Provider Responses client、逐字 quote 实存核验与 coverage + enrichment 双门槛。Quick/Balanced/Deep 的最大模型费用预留为 `$0.20/$0.60/$1.20`，默认日上限 `$2`。
- Workflow 成功状态保留 1 天、异常状态保留 3 天。CostGuard 会以每个 Run 的最大预留结算，避免重试或失败少计模型成本；这只控制项目方承担的 Provider 费用，不是向用户收费。
- 本会话重跑的离线验证：`pnpm --filter @archresearch/web test` 为 3 files / 6 tests 通过；`pnpm --filter @archresearch/edge test` 为 5 files / 13 tests 通过。此前 Web lint/typecheck/build、Edge lint/typecheck 与 Wrangler dry-run 已通过；根级回归、实际 Worker 路由壳/DO 持久化合同、OPFS adapter、浏览器 QA 与安全审查尚未执行。
- 未部署、未创建 Cloudflare 资源或 Secret、未调用真实 Provider 或真实研究流程；Web URL 未写入仓库。

## 2026-07-29 M158 Worker 路由与 SQLite 费用合同

- Worker 专用 `cloudflare:workers` 模块不能由 Node Vitest 直接加载；尝试加入 Cloudflare Vitest pool 时因现有供应链策略拒绝未批准的 `sharp` 构建而终止。未批准该构建，也未保留该开发依赖。
- 为保持完全离线且可复现，静态资源/API 分发和响应安全头抽为 `worker-router.ts`，生产 `index.ts` 仍是唯一 Worker 入口。路由合同确认 `/api/runs` 的费用拒绝不会落入静态资源，也不会创建 Workflow。
- CostGuard 的日账本及预留改用 Durable Object SQLite 的 `storage.sql`；`SqlCostLedger` 同步执行余额读取和预留写入，避免在一次 DO 事件内因 await 交错。合同确认同一 SQLite 状态经对象重建后仍拒绝超出日上限的第二笔预留。
- 红灯为两个缺失生产模块；最小实现后 Edge 离线集为 7 files / 15 tests，并通过 typecheck、lint 与 `git diff --check`。未调用 Provider、真实研究或 Cloudflare 资源。

## 2026-07-29 Web Edition 发布前闭合

- OPFS adapter `apps/web/src/lib/attachments.ts` 已实现：目录名固定、附件 id 受限、写入/读取/显式删除均为浏览器本机文件系统操作；离线合同通过，不上传 Worker 或进入 JSON 备份。
- Web 包补充标准 `dev` script；Web/Edge 均通过生产 build。移动 390px 与默认桌面 loaded QA 的 `scrollWidth === clientWidth`，无横向溢出。
- 权威 `scripts/verify.ps1` 已接入 Web test/typecheck/build 与 Edge test/typecheck/build。全量门禁通过：360 API、177 Board、165 Extension、8 packaged E2E、Web 4 files/7 tests、Edge 7 files/16 tests，以及 lint、类型和构建。
- `wrangler whoami` 确认账号 `53156bb4a7b3c742c8d132fb798faad8` 已登录；只读查询确认 `archresearch-web` 尚不存在。未部署、未创建 Worker/DO/Workflow、未写 Secret。
- 发布阻塞是外部输入而非代码：Provider API Key 必须是允许迁移到 Cloudflare Secret 的独立密钥，Turnstile 需要 site key、secret 和部署 hostname。本地 Windows 凭据按架构规则不能直接迁移，不能用猜测值或 mock 模式冒充实时公网版。

## 2026-07-29 Web Edition 金额上限决策更新

- 用户明确要求“不设 key 使用费用上限 / 不要费用上限”。这只取消按美元金额的每日总额和单次模式预留拒绝，不取消六次/分钟的入口反滥用限制、有界查询/页面/Token/运行时间或紧急服务停机能力。
- 网页使用者继续不提供 Key；项目方 Provider Key 只进入 Cloudflare Secret。CostGuard SQLite 账本仍记录预留与实际用量，但不得再因金额达到某个阈值拒绝研究。
- 取消金额拒绝后的代码审查与验证确认：Wrangler 仍绑定六次/分钟入口限流、Workflow、CostGuard Durable Object 和 `SERVICE_ENABLED` 停机开关；Edge 定向 7 files / 16 tests、lint、typecheck、production dry-run 以及根级完整门禁均通过。较早记录中的 `$0.20/$0.60/$1.20` 单次预留和 `$2` 日上限已被本决策取代，不再是现行拒绝合同。

## 2026-07-29 GitHub 发布状态审计

- GitHub 远端 `main` 与本地 `HEAD` 当前同为 `433d239`（`Close project-first README milestone`）；对应 Hosted CI run `30369444309` 成功。M155 Agent 边界与 M157 项目主页修改已经进入公开 `main`。
- 正式 Release 仍只有 `v2.1.0`，其提交为 `2a92539`；因此 `2a92539..433d239` 的 Agent 架构、公开说明与规划闭合记录虽在 `main`，但尚无后续版本 tag/Release。
- M158–M160 Web Edition 仍是本地未提交工作树：12 个 tracked 修改、40 个未跟踪文件、staged 0。候选 52 文件的敏感文件名/内容扫描未发现 Key、Token、数据库、SQLite、ZIP 或具体 Web 部署地址；这不等于已获 Git 发布授权。

## 2026-07-29 Cloudflare 部署恢复审计

- 交接中的“目标 Worker 不存在、Secret 尚未创建”已被账户只读查询推翻：`archresearch-web` 实际存在，2026-07-29 03:52–03:56Z 有 7 个版本/部署，来源包含首次上传、四次 Secret 变更和后续部署。
- `wrangler secret list` 只读确认 `ADMIN_CONTROL_TOKEN`、`PROVIDER_API_KEY`、`TURNSTILE_SECRET_KEY`、`TURNSTILE_SITE_KEY` 四个名称全部存在；Secret 值不可读且未被读取。上一会话显然在闪退前已执行部署，但规划文件未同步。
- 资源存在不等于发布完成；仍需确认生产路由/URL、线上静态页面、`/api/config`、Turnstile hostname 匹配、非 mock Provider 路径和真实研究终态，再决定是否用当前已验证源码重部署。
- 当前已验证源码随后重新部署成功，版本为 `c17dc24c-28ce-44c3-9c0f-b52a9f4fd95e`，配置明确为 `MOCK_MODE=false`；静态资源无变化，Worker、Workflow、Durable Object、六次/分钟限流和四个既有 Secret 继续绑定。
- 线上主页返回 200，CSP 与 `X-Robots-Tag: noindex, nofollow, noarchive` 生效；`/api/config` 返回非 Cloudflare 测试占位的 site key，缺 Turnstile token 的研究请求返回 400。桌面与 390px Chromium 均无横向溢出。
- Turnstile iframe 的两条 `%c%d ... NaN` console error 来自 `challenges.cloudflare.com`，不是 ArchResearch bundle。真实 Quick 研究仍需真人完成验证码；自动化不得绕过人机验证。
- GitHub 首次 Web Edition 提交 `d684c87` 的 Hosted CI run `30423739118` 通过 setup、Chromium、coverage、360 API、177 Board、165 Extension、Web 7 与 Edge 16 tests，最终只在并行 root build 失败：fresh runner 尚无 `apps/web/dist` 时，Edge Wrangler 与 Web build 同时启动并先读取静态目录。本地残留 dist 曾掩盖该竞态。
- 根级 build 已改为 Web → Board → Extension → Edge 的明确顺序，并新增发布合同守卫该依赖。移开现有 Web dist 后的 fresh root build 与完整 199.6 秒本地门禁均通过；产品 bundle 和 Cloudflare 部署不需要改变。
- 修复提交 `5a068f3` 的 Hosted CI run `30424872745` 在 fresh Windows runner 12m6s 全绿，setup、Chromium、coverage 与完整 repository gate 全部成功；公开网页源码与 Chrome-only README 边界至此已在 GitHub `main` 获得远端证明。

## 2026-07-29 Web Edition parity diagnosis

- 用户对已部署页面的直接验收确认：当前 Web 首页与本地版信息架构不一致，且没有个人收藏入口或可用收藏流程；此前“公开网页完整发布”的表述不准确。
- `apps/web/src/lib/history.ts` 已创建 IndexedDB `collections` object store，并把 collections 放入 JSON 备份，但 `App.tsx` 的 `HistoryPort` 没有暴露 `listCollections`、`saveCollection` 或删除能力，任何界面都不可能使用这份存储。
- 当前 `BrowserCollectionRecord` 仅有 run/result 引用、原问题和保存时间，没有标题、证据事实或来源快照；即使手工写入，也无法在 Run/临时状态之外独立回看。
- 本地版合同和实现已经明确：个人收藏是独立整页、首页入口、建筑方案/图纸灵感标签、按原问题和研究方向组织，并支持结果直接与批量收藏；Web Edition 的浏览器本地存储足以实现这部分，不属于 Cloudflare 或 Chrome 能力限制。

## 2026-07-29 M162 同源迁移结论

- “把本地版转移到公共发布”不能通过继续补齐另一套 Web UI 达成；两套 JSX/CSS 即使短期看起来相似，也会再次出现导航、收藏和结果工具漂移。M162 因此改为公共入口直接渲染 `apps/board/src/App.tsx` 与同一份 `styles.css`，Web 只提供 Edition props、Turnstile 和 `ApiClient` adapter。
- Cloudflare 只保留有界执行和三日阶段检查点；工作区、终态 Run、结果、Board 选择、收藏、用户状态、表达规范、任务书和备份均在当前浏览器 IndexedDB。公共客户端对终态 Run 优先读取本地记录，并在云端 404 时回退本地，避免短期检查点过期破坏长期历史。
- 公共版唯一可见差异是诚实的能力边界：公开 HTTPS 来源替代本地小红书/Chrome 扩展，任务书上限 4 MB，研究启动需要 Turnstile；公共界面不得出现“小红书”“原笔记”“旧版灵感分组”等本地专属或迁移痕迹。
- Web Vite 的 public directory 直接复用 Board 静态素材，因此网格背景和完整演示图不再靠手工复制；生产 dry-run 实际读取 20 个静态文件。
- `impeccable` 上下文检查发现 `apps/web` 缺少自己的 `PRODUCT.md`。现已以本地 `apps/board/PRODUCT.md`、根 `DESIGN.md` 和用户“应完整对齐本地版”的验收意见为事实来源补齐 Web 产品合同，明确其不是简化表单或 lite 版。
- 图纸灵感的本地高质量链路依赖用户已登录的 Chrome/小红书和扩展；Web 可在同一入口明确说明不可用边界，但不能用这一差异解释个人收藏、备份、历史或结果工具的缺失。
- 首轮实现把本地版的蓝色研究任务台、稳定品牌头、独立备份页和独立收藏页迁入 Web；图纸灵感入口仍可发现，但明确标记为本地 Chrome 版专属，没有在公开版伪造登录态读取。
- 收藏现在保存 `kind/title/facts` 快照并按原问题分组；直接收藏、批量选择、删除和备份恢复共用同一 IndexedDB 记录。`listCollections()` 会在读取时补齐第一版无快照记录为“历史收藏”，避免既有浏览器数据升级后崩溃。
- Playwright 使用本机 Chrome headless 直接检查本地 Vite 页面，未调用会闪退的应用内浏览器。1440px 首页/收藏/结果与 390px 首页/收藏均无横向溢出，结果导航会回到页面顶部；console/page error 为 0，390px 未发现宽高都小于 44px 的按钮。
- 用户把迁移标准收紧为“本地产品整体转移到公共发布”。本地 `App.tsx` 当前还包含工作区、任务书/案例页预审、建筑/图纸灵感双目标、保留期限、进度与覆盖诊断、案例分析/视觉结果、对照、表达规范、私有/分享导出、来源检查等 Web 尚未具备的路径；首片收藏修复不能视为最终发布候选。
