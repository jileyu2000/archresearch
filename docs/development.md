# 从源码运行 ArchResearch

本文只面向需要修改或调试源码的开发者。普通用户请直接使用 README 中的 Windows 安装版。

## 环境

- Windows 11
- Google Chrome
- Python 3.12
- Node.js 24
- pnpm 11
- PowerShell 7

## 首次启动

```powershell
Copy-Item .env.example .env
pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/setup.ps1
pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/start.ps1
```

默认地址：

- Board：`http://127.0.0.1:5173`
- API：`http://127.0.0.1:8000`
- 开发扩展：`apps/extension/dist`

停止服务：

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/stop.ps1
```

## Provider

默认 `mock` 模式不需要 Provider 配置。需要运行真实研究时，使用安全配置脚本：

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/configure-provider.ps1
```

脚本会要求 API 接口地址和 API Key，先从上游模型列表自动获取候选模型，再依次测试 Responses 与 Chat Completions 结构化输出；成功后保存接口地址、选中模型和协议，并将 Key 写入 Windows 凭据管理器。地址可指向中转站、DeepSeek、Kimi 或自建服务，不按域名白名单限制；Key 不写入 `.env`、日志或仓库。上游不提供模型列表或没有兼容模型时不会保存任一项；图片分析仍要求选中模型支持视觉输入。

不要提交含 Key 的文件。

## 更新源码运行环境

在你已经通过自己的 Git 操作更新源码后运行：

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/update.ps1
```

该脚本不会执行 `git pull`、reset、checkout 或 clean。它会停止服务、安装依赖、重新构建、运行完整门禁，再启动验证通过的版本。源码数据继续保存在 `.archresearch`。

## 登录后自动启动

启用：

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/configure-autostart.ps1
```

关闭：

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/configure-autostart.ps1 -Disable
```

## 验证

```powershell
pnpm test:coverage
pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/verify.ps1
```

默认测试使用 mock 和本地 fixture，不需要 Provider Key，也不会发起真实研究。
