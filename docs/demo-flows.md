# 两条完整演示流程

两条流程分别覆盖离线作品集演示和真实方案研究。所有命令默认使用 PowerShell 7。

## 演示前检查

```powershell
pwsh -NoProfile -File scripts/setup.ps1
pwsh -NoProfile -File scripts/validate-evaluation-fixtures.ps1
pwsh -NoProfile -File scripts/start.ps1
```

启动脚本会输出实际参考板、API 和扩展目录。完成演示后运行：

```powershell
pwsh -NoProfile -File scripts/stop.ps1
```

### 扩展安装与配对

1. 打开 `chrome://extensions`，启用开发者模式并加载 `apps/extension/dist`。
2. 从本地 API 请求一次性配对码：

```powershell
$pairing = Invoke-RestMethod -Method Post http://127.0.0.1:8000/v1/browser/pairing-code
$pairing.code
```

3. 在扩展中填写 `ws://127.0.0.1:8000/v1/browser` 和配对码。
4. 只有需要读取真实网页时，才在扩展界面首次授予站点权限。研究进入终态后确认研究标签页已关闭；演示结束可从扩展主动撤销权限。

## 流程一：无 Key 的旧厂房参考板

**目标**：完整演示工作界面、证据分区、用户状态和导出，不调用外部网络供应商。

**前提**：保持默认 `ARCHRESEARCH_PROVIDER_MODE=mock`。不需要 OpenAI Key，也不需要给扩展全站权限。

1. 打开启动脚本输出的参考板地址。仅需要固定作品集画面时使用下面三个纯本地入口；`?demo=1` 继续兼容标准研究。要验证持久化闭环时使用正常地址。

   - 概览：`http://127.0.0.1:5173/?demo=quick`
   - 标准：`http://127.0.0.1:5173/?demo=balanced`
   - 深入：`http://127.0.0.1:5173/?demo=deep`

   三个入口不会创建 Workspace 或 ResearchRun，也不会请求任何外部供应商。仓库中的验收截图位于 `docs/assets/portfolio-demos/`。
2. 新建工作区“旧厂房公共文化中心”。
3. 发起 `precedent_research`，问题使用 `fixtures/queries/research_tasks.jsonl` 中的 `adaptive-reuse-boxes-01`，模式选 Balanced；问题文本已经包含保留屋架和插入功能盒体的研究范围。
4. 观察阶段从 planning 进入 composing；Mock 结果分别显示“来源与内容已核对”、“已有依据，仍需核对”和“只作视觉参考”。
5. 打开一张剖面卡，核对“来源事实、直接观察、方法推断、适用边界”四段没有混写，并检查 URL/PDF 定位。
6. 收藏两张图，给其中一张写备注；拒绝一张不相关结果后撤销拒绝。刷新页面，确认收藏、备注和拒绝状态仍在。
7. 选 2–6 张加入比较，切换比较视图；编辑并保存 StyleProfile 的主色、线型层级和字体类别。
8. 先预览分享版导出：未知或受限图片应降级为来源卡。再生成本地私有版和 JSON 来源清单。

**完成判据**：无需 Key 即可得到非空参考板；刷新后用户状态和比较选择存在；分享版没有完整嵌入未知/受限图片。

## 流程二：真实网页的流线研究

**目标**：演示完整性优先的多轮网页搜索、浏览器候选图块识别、来源绑定和可恢复续研。

**费用与隐私提示**：这是主动启用的真实评测，会调用用户自己的供应商账户并可能产生费用。默认测试、`?demo=1` 和评测夹具不会触发它。Key 不应出现在命令历史、项目文件、截图或 Trace 中。

1. 首次启用时运行安全配置。终端会隐藏输入，并在保存前执行一次小型、可能计费的 `gpt-5.6-sol + medium` 结构化输出探测：

```powershell
pwsh -NoProfile -File scripts/configure-provider.ps1
```

2. 能力探测成功后重启服务。Key 位于 Windows 凭据管理器的 `ArchResearch/suoxie` / `api-key`，项目内配置只含 `https://suoxie.codes/v1` 与 `gpt-5.6-sol`；公开网页发现由本地 Playwright 完成。
3. 安装并配对扩展，在扩展界面通过直接用户手势授予 HTTP/HTTPS 网页读取权限；后续研究无需重复授权。
4. 需要小红书视觉灵感时，从 Chrome Web Store 安装一次 OpenCLI Browser Bridge、在同一 Chrome 登录小红书，并用 `pnpm opencli -- doctor` 检查连接。它不使用 ArchResearch 一次性配对码，也不需要每轮重新授权。
5. 新建工作区“中小型博物馆流线”，发起 `museum-backstage-04` 的 Deep 研究。也可先用 Balanced 控制成本。
6. 在 Trace 中检查中英文查询、页面检查、视觉分类、来源核验和 gap check。扩展应只打开候选项目页，并在每页限制滚动、裁图和媒体数量。
7. 结果出现后按 `plan` 与 `circulation` 筛选。优先查看 primary/trusted secondary 来源；聚合站只作为线索。
8. 对比至少两个项目的平面和流线图，记录观众、工作人员、藏品运输的差异及不适用条件。
9. 研究若因网页阻塞、限流或执行上限成为 `blocked`，确认已有证据仍被保留，再使用“继续补齐研究”；续研只查询仍为空白的子问题。只有所有子问题都有可显示、相关且绑定来源的图纸后，建筑先例研究才进入 `completed`。
10. 结束后检查研究标签页已关闭；需要收回全站权限时，在扩展中点击“撤销网页读取权限”。

**完成判据**：结果来自当次实时网页研究；至少一条正式事实能跳转到来源定位；失败页面不会清空已有资产；终态后研究标签页关闭，手动撤销能立即移除全站权限。

## 版本化真实评测记录

25 条任务的数据集本身不会联网。执行真实评测时应由操作者逐条主动启动，并另存下面的运行元数据：

- `evaluation_date` 与任务 `id`；
- 应用版本或 Git commit；
- provider、研究模型和视觉模型（不记录 Key）；
- 查询、访问页面数、运行时间与成本；
- 最终状态、`stop_reason` 和 CoverageReport；
- Top-5 图纸类型人工标注、重复项、来源归属是否正确；
- 因网页变化、验证码或访问规则造成的差异。

不要在 CI 或默认 `scripts/verify.ps1` 中批量执行 30 条真实任务。实时网页会变化且产生费用；作品集报告应明确执行日期和人工标注方法，不把离线合成分类集的成绩混同于真实网页召回率。
