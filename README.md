# zMenu 菜单编辑器

一个面向 [zMenu](https://github.com/Maxlego08/zMenu) 插件的本地可视化菜单编辑器，基于 [Minecraft Inventory Builder](https://minecraft-inventory-builder.com/) 的设计风格改造。

## 特性

- **1.21 物品支持**：内置 1749 个物品图标，1.21 默认显示 68 个新物品
- **版本筛选**：下拉支持 1.21 到 1.8，按 `new/items.txt` 排序
- **26 种内置 Actions**：MESSAGE、COMMAND、CHAT、SOUND、TELEPORT 等操作类型
- **自定义 ADD AN ACTION**：参考官网的紫蓝渐变按钮和操作类型选择弹窗
- **卡片化操作面板**：支持折叠、展开、上移、下移、复制、删除
- **附魔光效文档链接**：直跳 zMenu 官方文档

## 目录结构

```
.
├── index.html              # 入口页面
├── editor-assets/
│   ├── zmenu-editor.js     # 核心编辑器逻辑（React）
│   ├── actions-ui.js       # Actions 增强脚本
│   ├── actions-ui.css      # Actions 自定义样式
│   ├── responsive.css      # 桌面/Android 窄屏响应式布局与触控适配
│   └── style.css           # 物品图标 CSS
├── images/
│   └── sprites.webp        # 1.21 物品精灵图
├── new/                    # 参考资源
│   ├── items.txt           # 物品排序与版本数据
│   ├── sprites.webp        # 最新版精灵图
│   └── ...
├── css/                    # SB Admin 2 主题
├── js/                     # 演示脚本
├── vendor/                 # Bootstrap、jQuery、DataTables
└── _serve.ps1              # 本地启动脚本（http://localhost:8765）
```

## 本地运行

直接打开 `index.html` 可能在某些浏览器受限，建议使用本地 HTTP 服务：

```powershell
.\\_serve.ps1
```

然后访问 `http://localhost:8765/index.html`。

也可手动启动：

```powershell
python -m http.server 8765
```

或：

```powershell
npx http-server -p 8765
```

## Android 浏览器

界面已针对窄屏与触控操作适配。手机访问时请通过 HTTP 或 HTTPS 提供页面，不建议直接使用 `file://` 打开。

在与电脑同一局域网时，可在电脑上执行：

```powershell
python -m http.server 8765 --bind 0.0.0.0
```

然后在 Android 浏览器中访问 `http://<电脑局域网 IP>:8765/index.html`。首次访问时请允许 Windows 防火墙放行该端口；部署到网站时建议使用 HTTPS。

## 物品数据来源

- 物品排序与版本信息来自 `new/items.txt`
- 图标精灵图来自 `images/sprites.webp`
- CSS 坐标参考 `new/app-Kzu55Ish.css`

## Actions 类型

当前内置的 26 种操作类型请参考 `editor-assets/zmenu-editor.js` 中的 `_actionTypes`。官方 zMenu/zMenu+ 还提供更多类型；未内置的类型不会显示在编辑器的选择器中。

## 致谢

- [Minecraft Inventory Builder](https://minecraft-inventory-builder.com/)
- [zMenu](https://github.com/Maxlego08/zMenu)
- [groupez docs](https://docs.groupez.dev/zmenu/)

## 版本

`1.0.0` - 2026-08-10

## 许可

仅供学习与个人使用。Minecraft 内容版权归 Mojang AB 所有。
