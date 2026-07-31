# ArchResearch V2.1 发布证据清单

冻结日期：2026-07-28
工作分支：`codex/archresearch-v2-1`
发布版本：API / Board / Extension / manifest 均为 `2.1.0`

## 证据边界

本清单只记录可由当前源码、当前本地 API、隔离安装环境和公开 GitHub Actions 日志复核的证据。本轮没有创建或重试 Live Run，没有调用 Provider、公开来源或小红书，也没有恢复备份。

2026-07-16 的旧清单和 10 张旧界面图已保留在 `docs/history/release-evidence-2026-07-16.md` 与 `.artifacts/portfolio/history-2026-07-16/`，只作历史材料。其三个底层 Run 已按用户确认删除，不再作为当前发布证明。

## 当前可核对 Run

| 用途 | Run | 当前 API 终态 | 正式覆盖 | 当前 Board 边界 |
| --- | --- | --- | --- | --- |
| 跨案例深度研究 | `76f52c79-5fd9-4738-837d-5576eb3a72cd` | `completed / completion_satisfied`，attempt 0 | 51 usable，9 formal projects，6/6，0 gaps | 当前 M124 语义如实显示“已完成 · 案例不足”，正文仍展示六题证据绑定结果 |
| 真实任务书研究 | `ff16988d-ebbd-4da4-b5e2-3cd080dcf0be` | `completed / completion_satisfied`，attempt 0 | 28 usable，8 formal projects，4/4，0 gaps | 明示案例不是《耕织图》版本证据，只给受限转译机制 |
| 图纸灵感 | `f5be3f17-2698-4aa6-8f03-155a04e4c5a2` | `completed / coverage_satisfied`，attempt 0 | 5 images，3 directions，3/3，0 gaps | 小红书只作画面表达参考，不确认项目事实或图纸权利 |

三条 Run 均为永久保留。计数来自当前 `GET /v1/runs/{id}` 的 `coverage_report` 与 `GET /v1/runs/{id}/results`，不是截图推算。

## 干净安装与更新

- 从当前完整源码复制 349 个 source/config 文件到系统临时目录，排除 `.git`、`.archresearch`、`.artifacts`、依赖、构建和测试缓存。
- fresh `scripts/setup.ps1` 成功创建根 venv，安装 `archresearch-api==2.1.0`、执行 frozen pnpm install 并构建 Extension。
- fresh `scripts/start.ps1` 因正常服务占用默认端口，自动使用 API 8001 / Board 5174；两个 HTTP 响应均为 200，正常 8000/5173 未受影响。
- `scripts/update.ps1` 完整执行 stop → setup → verify → start，最终输出 `ArchResearch update verified and running.`；验证失败会在 start 前终止，脚本不执行 Git 操作。
- 隔离更新门禁：348 API / 177 Board / 165 Extension / 8 packaged E2E，Ruff/format、strict Mypy、两端 lint/typecheck/build 全绿。

## 备份预检

隔离 API 对现有 `.artifacts/archresearch-backup-before-husk-delete.zip` 只执行 `/v1/data-backups/preflight`：

- `ready=true`，format 1，schema `d0f1a2b3c4d5`
- 56 files / 61,044,756 unpacked bytes
- 4 workspaces / 17 Runs / 7 collections / 2 input artifacts
- 隔离 SQLite 共享读 SHA-256 前后相同，workspace count 0 → 0
- 未调用 `/restore`

## 最终源码可视验收

所有截图来自正常 Board 5173 的当前源码与当前持久数据。桌面为 1440×900，移动为 390×844；页面 `scrollWidth === clientWidth`，console error 0。

| 文件 | Bytes | SHA-256 |
| --- | ---: | --- |
| `.artifacts/portfolio/current-2026-07-28/home-desktop.png` | 95,898 | `0CC2B3817C9392688AA49C83CF08A4224E4337C29D2E304C4D7782AF16DC4682` |
| `.artifacts/portfolio/current-2026-07-28/backup-desktop.png` | 59,614 | `4902CC871C2A2AFECB3BC7093FC52269AD4DF75F14DCC0C61F3CA974C8B750C7` |
| `.artifacts/portfolio/current-2026-07-28/backup-mobile.png` | 34,426 | `3EA5A3F7C12299524B77B471625458E7AEA7B7D2259FBE553B068DACFB2A776D` |
| `.artifacts/portfolio/current-2026-07-28/deep-76f52c79-desktop.png` | 120,016 | `4DBF4290EA17439C230C5461F0B1AF4BC587365B62B6C3FEDDC42BDE0F3A1457` |
| `.artifacts/portfolio/current-2026-07-28/brief-ff16988d-desktop.png` | 120,099 | `CBF9DCB993C64178E7A735AD658C519C507A42E5CDBA098EFC37631A83DA6D88` |
| `.artifacts/portfolio/current-2026-07-28/visual-f5be3f17-desktop.png` | 125,323 | `D852DFE19DF0B9624123AFE477675B0FBDFE77D88FB10E02DB4329FAEDF9575F` |

## CI 与发布边界

`.github/workflows/verify.yml` 使用 Windows latest、Python 3.12、Node 24、frozen setup、根 coverage 和权威 verify，并声明 `workflow_dispatch` 与 `contents: read`。默认 CI 不需要 live provider key。

公开仓库 `jileyu2000/archresearch-chrome-extension` 已建立。Hosted CI run `30332351557` 验证 Chromium 环境修复，run `30333320610` 验证发布记录落点；两轮都通过 setup、Playwright Chromium 安装、Board/Extension coverage 与完整 `scripts/verify.ps1`，最终日志明确为 348 API / 177 Board / 165 Extension / 8 packaged E2E 全绿。默认 CI 未使用 live provider key。

这份记录保留 V2.1 本地发行的历史验证结果。M179 已恢复 Windows 安装器、动态回环端口、Provider 配置、独立扩展和完整本地 CI 合同；新的 V2.2 本地构建、安装 smoke 与健康检查结果以 `progress.md` 的 M179 记录为准，正式发布后再生成新的版本化证据清单。GitHub 自动生成的 Source code ZIP/TAR 仍只是源码快照，不是安装包。
