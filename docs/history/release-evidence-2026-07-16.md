# ArchResearch V2.1 发布证据清单

> 历史归档：本清单冻结的是 2026-07-16 当时的实现与数据，不代表当前 V2.1 发布状态。Quick `d13bdc67`、Balanced `7d8faa53`、Deep `b4c314a6` 的底层 Run 后续均已按用户确认删除，10 张截图只保留为历史材料，现位于 `.artifacts/portfolio/history-2026-07-16/`。当前可核对证据见 `docs/release-evidence-2026-07-28.md`。

冻结日期：2026-07-16
工作分支：`codex/archresearch-v2-1`
对比基线：`98a9a013423f`（`feat: add honest browser launch readiness`）

## 证据范围

本清单只固化已经完成的本地门禁和同题 Quick / Balanced / Deep 真实验收，不重新请求 Provider、公开建筑站或小红书，也不恢复 Firecrawl。三档运行均使用 `gpt-5.6-sol`、`medium` reasoning；公开建筑来源由 Direct Playwright 读取，小红书由 OpenCLI 1.8.6 只读搜索和素材下载，ArchResearch MV3 仅作通用登录页与故障回退。

小红书结果始终是 `aggregator / visual_lead`，不会升级为正式项目事实。正式事实仍绑定到建筑来源页面；来源可追溯性与图片权利状态分开记录。

## 三档真实运行

| 深度 | Run ID / attempt | 终态 | 覆盖 | 结果摘要 | 创建 / 完成（本地数据库时间） |
| --- | --- | --- | --- | --- | --- |
| Quick | `d13bdc67-d6b3-4006-8d89-089439a02311` / 9 | `completed / coverage_satisfied` | 3/3，0 gaps | 7 usable，3 formal projects，7 partial，3 visual leads | 2026-07-15 18:06:45 / 2026-07-16 08:43:05 |
| Balanced | `7d8faa53-2976-4387-9d9e-67d217225b70` / 1 | `completed / completion_satisfied` | 4/4，0 gaps | 17 usable，4 formal projects，8 partial，29 visual leads | 2026-07-16 09:01:49 / 2026-07-16 09:24:52 |
| Deep | `b4c314a6-e4ff-449b-b20b-617ddb577b28` / 1 | `completed / completion_satisfied` | 6/6，0 gaps | 34 usable，7 formal projects，12 partial，28 visual leads | 2026-07-16 09:29:50 / 2026-07-16 10:09:38 |

保留资产来源主机为 `archdaily.cn`、`archdaily.com`、`designboom.com`；Balanced / Deep 另保留 `xiaohongshu.com` 视觉线索。Quick 的运行配置也包含小红书，但最终保留资产主机不含小红书。

### Quick 历史轨迹边界

Quick 的 `trace_events` 是同一 Run ID 跨 attempt 的累计审计日志，因此仍忠实保留 attempts 0–8 的历史 `firecrawl*` 事件；不能据此声称整个 Run 历史从未使用 Firecrawl。最终接受的 attempt 9 从 sequence 267 开始，只出现 `workflow`、`xiaohongshu_search`、`local_browser_search`、`openai`、`remote_visual_batch`、`public_page_analysis` 和 `local_browser`，没有 Firecrawl。Balanced 与 Deep 均为 attempt 1，累计 Trace 中也没有 Firecrawl 工具。

## Board 可视验收

| 深度 | 图片加载 | 中文与结果边界 | 归档截图 |
| --- | --- | --- | --- |
| Quick | 13/13 loaded，0 failed，0 pending | 3/3；历史外文/空观察/“重新研究”占位均为 0 | 结果视口 + 辅助长页 |
| Balanced | 38/38 loaded | 4/4；小红书灵感与正式案例分区 | 结果、问题、制图灵感、案例 4 个视口 |
| Deep | 44/44 loaded，0 failed，0 pending | 6/6；采光分支及正式案例分区可读 | 结果、问题、制图灵感、案例 4 个视口 |

浏览器 full-page 拼接会重复固定区块，因此 Balanced / Deep 只采用干净视口截图。Quick 的长页截图仅作为辅助证据，主证据仍是结果视口。

## 截图完整性

| 文件 | Bytes | SHA-256 |
| --- | ---: | --- |
| `.artifacts/portfolio/history-2026-07-16/quick-d13bdc67-result.png` | 98,937 | `4AF861BA80689B769DB149A6CF063749056F918D6DA501D75D564E9BE7F4C884` |
| `.artifacts/portfolio/history-2026-07-16/quick-d13bdc67-result-full.png` | 1,154,078 | `2A491459AD0B446F8B338456D25B2BFD4AD7925C547B6A996A586D1872B312DA` |
| `.artifacts/portfolio/history-2026-07-16/balanced-7d8faa53-result.png` | 98,897 | `08950897580C7F0262734E8407DC9050DAB60779600BBD3C29A2361E873558CC` |
| `.artifacts/portfolio/history-2026-07-16/balanced-7d8faa53-questions.png` | 100,367 | `F24BD0B12F4E8671FCA164FCE2DC453642CD4E49E46AF9740921638A55386C01` |
| `.artifacts/portfolio/history-2026-07-16/balanced-7d8faa53-inspiration.png` | 97,750 | `07F69BAD1F887F73C5A909406E083BC486DCCAD8B815A254829FD44BF097C776` |
| `.artifacts/portfolio/history-2026-07-16/balanced-7d8faa53-cases.png` | 81,012 | `D99215A41CB4495155664C96607259484EAC2526FF501DB9382DDA36722BAA90` |
| `.artifacts/portfolio/history-2026-07-16/deep-b4c314a6-result.png` | 98,873 | `2C1429E1F70FC51E8661DB6351F69AE9BD936143973726CF27336EC4D4AEF5A5` |
| `.artifacts/portfolio/history-2026-07-16/deep-b4c314a6-questions.png` | 113,911 | `9B3A1E7CC42C8E795BB74D1C36768D8C762FFBC085E25BD6465FE4A4DC05C20A` |
| `.artifacts/portfolio/history-2026-07-16/deep-b4c314a6-inspiration.png` | 129,667 | `69607F934684E27F1C658CC1EBD94ED1B4AAE308F449A305419B5AE64EDDC721` |
| `.artifacts/portfolio/history-2026-07-16/deep-b4c314a6-cases.png` | 80,160 | `5DD2033BDCE93A2130F7BE3DDE7190599D5210EBE98516E919E6D0A057628A1F` |

## 离线门禁基线

最终完整门禁通过：226 API tests、75 Board tests、165 Extension tests、8 packaged E2E；Python Ruff / format / Mypy、Board 与 Extension lint / typecheck / production build 全部通过；evaluation 为 30 个任务、108 个断言通过。默认测试和演示不要求真实 Provider key。

## 安全、成本与发布边界

- 32 个变更生产源码/脚本的凭据模式扫描为 0；两个测试命中均是固定合成夹具。证据清单不包含签名 URL、cookie、命令 stderr、来源正文或凭据。
- SQLite Trace 的 `cost_usd` 与 duration 成本字段为 0，不能代表真实账单；本清单不推测实际 Provider 或平台费用。
- 源码候选包含已归属的产品代码、测试和文档；上述 10 张 PNG 独立作为发布证据包。
- 两份 pytest XML、`.playwright-cli` 控制日志/页面快照和 `.impeccable/live/config.json` 是可再生成的本地工具输出，不属于源码发布提交或证据包。
- 创建本清单时没有访问实时来源、没有调用 Provider、没有下载新素材，也没有调用 Firecrawl。
