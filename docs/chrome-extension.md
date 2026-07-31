# 安装 ArchResearch Chrome 扩展

只有“小红书图纸灵感”需要这个扩展。建筑案例研究和浏览器本地资料管理可以直接使用。

Chrome Web Store 尚未上架，当前需要手动加载一次：

1. 在 Web Edition 的扩展提醒中点击“查看安装方法”，下载名称含 `chrome-extension-only` 的 ZIP。
2. 解压 ZIP。需要选择的文件夹根目录应当直接包含 `manifest.json`。
3. 打开 `chrome://extensions`，开启“开发者模式”，点击“加载已解压的扩展程序”，选择上一步的文件夹。
4. 回到 Web Edition，从扩展工具栏中点击“连接当前 ArchResearch 网页”。
5. Chrome 首次询问网页读取权限时选择允许。

连接成功后，ArchResearch 页面会自动关闭扩展提醒。同一个 Chrome 通常只需完成一次安装和授权；卸载扩展、撤销权限或更换浏览器后需要重新操作。

## 如果仍显示未连接

- 确认加载的是直接包含 `manifest.json` 的文件夹，而不是它外面多套的一层目录。
- 在 `chrome://extensions` 找到“ArchResearch Chrome 扩展”，确认它已启用，再刷新 ArchResearch 页面。
- 更新扩展时，先解压新版 ZIP，再在扩展管理页点击“重新加载”。
- 保持需要连接的 ArchResearch 网页标签处于当前窗口，再从扩展工具栏重试连接。

扩展只执行只读研究动作，不读取 Cookie、密码或私信，也不会点赞、收藏、评论或发布内容。授权可随时在 Chrome 中撤销。
