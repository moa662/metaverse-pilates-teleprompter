# 影视飓风提词器复刻版

这是从飞书秒搭链接开始整理的本地开发基线。当前环境访问 `https://miaoda.feishu.cn/app/app_4k6101r68dyt5` 时拿到的是飞书登录壳，不是业务页面源码，所以原始可访问快照已保存在 `source-snapshot/miaoda-login-shell.html`。

## 打开方式

直接用浏览器打开 `index.html` 即可。也可以在本目录运行一个静态服务：

```bash
python -m http.server 5177
```

然后访问 `http://localhost:5177`。

## 手机上外场使用

局域网地址只适合同一 Wi-Fi 下临时预览。外场拍摄要稳定使用，建议把本目录作为静态网站部署到：

- Cloudflare Pages
- Vercel
- Netlify
- GitHub Pages

部署后手机访问公网 HTTPS 地址即可，也可以用浏览器“添加到主屏幕”当作轻量 PWA 使用。当前项目是纯静态文件，不需要后端。

### GitHub Pages

项目已包含 GitHub Pages Actions 配置：

- `.github/workflows/pages.yml`
- `.nojekyll`

使用方式：

1. 新建一个 GitHub 仓库。
2. 把 `storm-teleprompter` 目录内的文件推到仓库 `main` 分支根目录。
3. 到仓库 `Settings -> Pages`，Source 选择 `GitHub Actions`。
4. 等 Actions 跑完后，手机访问 Pages 提供的 HTTPS 地址。

工作流只发布 `index.html`、`app.js`、`styles.css` 和 `.nojekyll`，不会发布 `source-snapshot/` 里的抓取快照。

## 已实现

- 稿件管理页：搜索、新建、播放、编辑、复制、删除、导出
- 稿件编辑页：标题、正文、TXT 导入、草稿自动保存、搜索定位、保存后去提词
- 提词播放页：逐字高亮、已读变暗、阅读区域框、自动滚动、手动前后跳字
- 设置面板：自动适配、字号、行距、左右边距、自动速度、倒计时、镜像、点击暂停、熄屏防护
- 手机安全区、横屏布局和 44px 以上触控目标

## 后续接入秒搭源码

如果能从秒搭后台导出源码或拿到业务 JS，请把导出的文件放到 `source-snapshot/exported/`。后续可以把页面结构、默认文案、状态逻辑逐项对照迁移到当前纯前端版本。
