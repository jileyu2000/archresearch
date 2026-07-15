# 三条完整演示流程

三条流程分别覆盖离线作品集演示、真实方案研究和截图来源反查。所有命令默认使用 PowerShell 7。

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
4. 只有需要读取真实网页时，才在扩展界面点击站点权限授权。研究进入终态后确认权限已经撤销。

## 流程一：无 Key 的旧厂房参考板

**目标**：完整演示工作界面、证据分区、用户状态和导出，不调用外部网络供应商。

**前提**：保持默认 `ARCHRESEARCH_PROVIDER_MODE=mock`。不需要 OpenAI 或 TinEye Key，也不需要给扩展全站权限。

1. 打开启动脚本输出的参考板地址。仅需要固定作品集画面时使用下面三个纯本地入口；`?demo=1` 继续兼容标准研究。要验证持久化闭环时使用正常地址。

   - 概览：`http://127.0.0.1:5173/?demo=quick`
   - 标准：`http://127.0.0.1:5173/?demo=balanced`
   - 深入：`http://127.0.0.1:5173/?demo=deep`

   三个入口不会创建 Workspace 或 ResearchRun，也不会请求任何外部供应商。仓库中的验收截图位于 `docs/assets/portfolio-demos/`。
2. 新建工作区“旧厂房公共文化中心”。
3. 发起 `precedent_research`，问题使用 `fixtures/queries/research_tasks.jsonl` 中的 `adaptive-reuse-boxes-01`，模式选 Balanced；问题文本已经包含保留屋架和插入功能盒体的研究范围。
4. 观察阶段从 planning 进入 composing；Mock 结果按已核验、部分核验、视觉线索分区出现。
5. 打开一张剖面卡，核对“来源事实、直接观察、方法推断、适用边界”四段没有混写，并检查 URL/PDF 定位。
6. 收藏两张图，给其中一张写备注；拒绝一张不相关结果后撤销拒绝。刷新页面，确认收藏、备注和拒绝状态仍在。
7. 选 2–6 张加入比较，切换比较视图；编辑并保存 StyleProfile 的主色、线型层级和字体类别。
8. 先预览分享版导出：未知或受限图片应降级为来源卡。再生成本地私有版和 JSON 来源清单。

**完成判据**：无需 Key 即可得到非空参考板；刷新后用户状态和比较选择存在；分享版没有完整嵌入未知/受限图片。

## 流程二：真实网页的流线研究

**目标**：演示完整性优先的多轮网页搜索、浏览器候选图块识别、来源绑定和可恢复续研。

**费用与隐私提示**：这是主动启用的真实评测，会调用用户自己的供应商账户并可能产生费用。默认测试、`?demo=1` 和评测夹具不会触发它。Key 不应出现在命令历史、项目文件、截图或 Trace 中。

1. 首次启用时运行安全配置。终端会隐藏输入，并在保存前执行一次可能计费的 Responses + `web_search` 能力探测：

```powershell
pwsh -NoProfile -File scripts/configure-provider.ps1
```

2. 能力探测成功后重启服务。Key 位于 Windows 凭据管理器的 `ArchResearch/suoxie` / `api-key`，项目内配置只含 `https://suoxie.codes/v1` 与 `gpt-5.5`。
3. 安装并配对扩展，在扩展界面主动授予本次研究的 HTTP/HTTPS 临时站点权限。
4. 新建工作区“中小型博物馆流线”，发起 `museum-backstage-04` 的 Deep 研究。也可先用 Balanced 控制成本。
5. 在 Trace 中检查中英文查询、页面检查、视觉分类、来源核验和 gap check。扩展应只打开候选项目页，并在每页限制滚动、裁图和媒体数量。
6. 结果出现后按 `plan` 与 `circulation` 筛选。优先查看 primary/trusted secondary 来源；聚合站只作为线索。
7. 对比至少两个项目的平面和流线图，记录观众、工作人员、藏品运输的差异及不适用条件。
8. 研究若因网页阻塞、限流或额度保留线成为 `blocked`，确认已有证据仍被保留，再使用“继续补齐研究”；续研只查询仍为空白的子问题。只有所有子问题都有可显示、相关且绑定来源的图纸后，建筑先例研究才进入 `completed`。
9. 结束后检查扩展站点权限已撤销。

**完成判据**：结果来自当次实时网页研究；至少一条正式事实能跳转到来源定位；失败页面不会清空已有资产；终态后全站权限不存在。

## 流程三：截图反查与证据降级

**目标**：演示上传图片、TinEye/二次网页搜索、冲突处理和证据边界。

**前提**：OpenAI 供应商按流程二配置。正式反向图片搜索还需要用户自行提供 TinEye API Key；缺少 TinEye 或调用失败时，系统只能依靠二次网页搜索，并应把结果交付为 `partial`，不能假装完成反查。

1. 新建工作区“未知轴测图反查”，上传一张用户有权用于研究的低分辨率截图。不要上传密码、私信、账号页或包含个人敏感信息的完整屏幕。
2. 发起 `source_lookup`，使用 `source-axonometric-watermark-25` 的问题和 Quick 模式。
3. 查看 Trace：反向图片匹配与普通网页搜索是独立证据来源。TinEye 的抓取日期不能当作项目首次发布日期。
4. 打开候选卡，分别核对 `project_identity`、`asset_association` 和 `primary_source`。工作室水印、视觉相似和聚合页转载都不能单独得到 `confirmed`。
5. 若两个来源给出冲突项目名，将卡片保留为 conflict/partial 或 visual lead，在备注中记录人工判断，不改写来源事实。
6. 收藏最可信结果，比较原图与候选轴测的可见特征。分享导出只在权利状态允许时嵌入完整图片，否则输出来源卡与链接。
7. 删除不再需要的上传文件和工作区，确认本地持久数据按用户动作移除。

**完成判据**：截图、项目和来源关系有明确证据等级；无法确认时不会生成 `verified`；所有正式事实都有 URL 或 PDF 页码定位。

## 版本化真实评测记录

30 条任务的数据集本身不会联网。执行真实评测时应由操作者逐条主动启动，并另存下面的运行元数据：

- `evaluation_date` 与任务 `id`；
- 应用版本或 Git commit；
- provider、研究模型和视觉模型（不记录 Key）；
- 查询、访问页面数、运行时间与成本；
- 最终状态、`stop_reason` 和 CoverageReport；
- Top-5 图纸类型人工标注、重复项、来源归属是否正确；
- 因网页变化、验证码或访问规则造成的差异。

不要在 CI 或默认 `scripts/verify.ps1` 中批量执行 30 条真实任务。实时网页会变化且产生费用；作品集报告应明确执行日期和人工标注方法，不把离线合成分类集的成绩混同于真实网页召回率。
