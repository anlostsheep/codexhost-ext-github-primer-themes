# GitHub Primer Themes (`github-primer-themes`)

codexhost 统一 Host 扩展（`manifestVersion: 2`），100% 源自 GitHub 官方 [`primer/primitives`](https://github.com/primer/primitives)（`@primer/primitives@11.10.0`）CSS 主题仓库，在 **Codex Desktop** 与 **CH Web** 完整还原 GitHub 官方外观主题。

## 支持的官方主题（7 大基础主题 × 高对比度 = 14 套官方 CSS）

### 浅色模式（3 套 + 3 套高对比度）
- **Light default**（`light.css` / `light-high-contrast.css`）
- **Light protanopia and deuteranopia** `Beta`（`light-colorblind.css` / `light-colorblind-high-contrast.css`）
- **Light tritanopia** `Beta`（`light-tritanopia.css` / `light-tritanopia-high-contrast.css`）

### 深色模式（4 套 + 4 套高对比度）
- **Dark default**（`dark.css` / `dark-high-contrast.css`）
- **Dark protanopia and deuteranopia** `Beta`（`dark-colorblind.css` / `dark-colorblind-high-contrast.css`）
- **Dark tritanopia** `Beta`（`dark-tritanopia.css` / `dark-tritanopia-high-contrast.css`）
- **Soft dark**（`dark-dimmed.css` / `dark-dimmed-high-contrast.css`）

## 目录结构

```text
github-primer-themes/
├── manifest.json                 # manifestVersion: 2 清单（含双语元数据、settingsSchema、icon、screenshots）
├── shared/primer-themes.mjs      # 14 套官方 Primer 主题数据与解析逻辑（page/widget/web 共享相对导入）
├── page/
│   ├── index.mjs                 # 跨端独立管理页（GitHub Theme preferences 完整还原）
│   └── style.css                 # 使用 --cx-page-* 主题变量 + 实时 Primer 卡片/代码/Diff 预览
├── widget/
│   ├── index.mjs                 # 跨端主页面悬浮速切挂件
│   └── style.css                 # 仅交互区域 pointer-events: auto
├── desktop/
│   ├── index.js                  # Codex Desktop 宿主注入（经典脚本 define({ activate })）
│   └── style.css                 # 官方 Primer CSS 变量 → Codex Desktop 样式映射
├── web/
│   ├── index.mjs                 # CH Web 宿主注入（ESM export activate）
│   └── style.css                 # 官方 Primer CSS 变量 → CH Web (--dsw-*, --shiki-*, --cx-page-*) 映射
├── assets/
│   ├── icon.png                  # 插件图标（PNG ≤ 128 KiB）
│   ├── preview-dark.png          # Soft dark 预览截图
│   ├── preview-light.png         # Light default 预览截图
│   └── preview-widget.png        # 悬浮速切挂件预览截图
├── scripts/
│   ├── sync-primer-themes.mjs    # 从 GitHub 官方 @primer/primitives 同步并生成主题 CSS 与共享模块
│   ├── generate-assets.mjs       # 生成图标与真实浏览器渲染截图
│   └── pack-and-validate.mjs     # 校验 manifestVersion: 2 契约、运行测试并打包 dist/*.zip
└── dist/
    └── github-primer-themes-1.2.3.zip
```

## 导入与启用

### 1. Codex Desktop
1. 打开 **设置 → 插件**（Settings → Extensions / Plugins）。
2. 点击 **导入插件**，选择 `dist/github-primer-themes-1.2.3.zip`（开发调试期也可直接导入本机目录）。
3. 启用 **GitHub 官方外观主题**，立即生效；点击 **打开页面** 或从设置左侧 **插件页面** 分组进入「GitHub 主题外观」切换主题与高对比度，也可在主窗口右侧中部贴边使用可拖动的悬浮速切小耳（远离底部发送按钮，避免误触）。

### 2. CH Web
1. 从左侧一级导航进入 **插件 → 插件中心**。
2. 点击 **导入插件** 并上传 `dist/github-primer-themes-1.2.3.zip`，随后点击 **启用**。
3. 启用后，可直接从 **插件工作区顶部的切页栏** 打开独立管理页「GitHub 主题外观」，也可在主界面使用右下角悬浮胶囊快速切主题，或在插件详情弹窗的声明式设置表单中修改选项。

## 从官方 Primer 仓库同步与重新打包

```bash
# 1. 从 GitHub 官方 @primer/primitives 刷新 14 套官方 CSS 与 shared/primer-themes.mjs
PRIMER_REFRESH=1 node scripts/sync-primer-themes.mjs

# 2. 重新生成图标与真实预览截图（需要 rsvg-convert 与 Chrome）
node scripts/generate-assets.mjs

# 3. 执行 codexhost v2 契约校验、安全扫描、运行时冒烟测试并打包 .zip
node scripts/pack-and-validate.mjs
```

## 发布到 GitHub 与投稿 codexhost 插件市场

仓库地址：`https://github.com/anlostsheep/codexhost-ext-github-primer-themes`

1. 直接在 Codex Desktop「设置 → 插件」或 CH Web「插件 → 插件中心」粘贴本仓库链接即可安装（优先拉取最新正式 Release 的 `.zip` 资产）。
2. 如需发布新版本：递增 `manifest.json` 的 `version`，运行 `node scripts/pack-and-validate.mjs`，推送 `main` 后创建对应 tag 的正式 GitHub Release 并上传 `dist/github-primer-themes-<version>.zip`、`assets/icon.png` 与 `assets/preview-*.png`。
3. 如需上架官方市场，可在 [`BytePioneer-AI/codexhost-extensions-registry`](https://github.com/BytePioneer-AI/codexhost-extensions-registry/issues/new/choose) 提交仓库 URL：`https://github.com/anlostsheep/codexhost-ext-github-primer-themes`。
