# 安装 ArchResearch Chrome 扩展

只有“小红书图纸灵感”和需要 Chrome 可见页面高清图的研究步骤使用这个扩展。建筑案例正文研究、收藏和本地资料管理由 Windows 应用直接完成。

Chrome Web Store 尚未上架，当前需要手动加载一次：

1. 从 [v2.2.2 Release](https://github.com/jileyu2000/archresearch-chrome-extension/releases/tag/v2.2.2) 下载名称含 `chrome-extension-only` 的 ZIP。
2. 解压 ZIP。需要选择的文件夹根目录应当直接包含 `manifest.json`。
3. 打开 `chrome://extensions`，开启“开发者模式”，点击“加载已解压的扩展程序”，选择上一步的文件夹。
4. 启动 ArchResearch，回到 ArchResearch 本地页面，打开“图纸灵感”并点击“连接 Chrome 读取高清图纸”。
5. Chrome 首次询问网页读取权限时选择允许。正常情况下本地页面会自动生成一次性配对码并完成连接。

连接成功后，研究环境会显示“研究环境已就绪”，扩展中的“本地服务”显示“已连接”。同一个 Chrome 通常只需完成一次安装和授权；卸载扩展、主动断开、撤销权限或更换浏览器后需要重新操作。

## 如果仍显示未连接

- 确认加载的是直接包含 `manifest.json` 的文件夹，而不是它外面多套的一层目录。
- 在 `chrome://extensions` 找到“ArchResearch Chrome 扩展”，确认它已启用，再刷新 ArchResearch 本地页面。
- 更新扩展时，先解压新版 ZIP，再在扩展管理页点击“重新加载”。
- 确认 Windows 应用仍在运行，再回到本地页面点击“连接 Chrome 读取高清图纸”。
- 自动连接仍失败时，打开扩展中的“连接有问题？手动配对”，只使用当前本地页面提供的 endpoint 与一次性配对码。

扩展只执行只读研究动作，不读取 Cookie、密码或私信，也不会点赞、收藏、评论或发布内容。授权可随时在 Chrome 中撤销。
