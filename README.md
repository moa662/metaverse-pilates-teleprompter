# 元宇宙普拉提提词器

一个纯静态、手机优先的网页提词器，适合课程口播、动作讲解、短视频拍摄和现场录制。项目已经部署到 GitHub Pages：

https://moa662.github.io/metaverse-pilates-teleprompter/

## 功能

- 稿件管理：新建、搜索、播放、编辑、复制、删除、导出。
- 稿件编辑：标题、正文、TXT 导入、草稿自动保存、搜索定位。
- 提词播放：全屏播放、匀速滚动、暂停继续、前后跳段、横屏尝试、镜像模式。
- 手机适配：安全区、横屏布局、44px 以上触控按钮、外场 HTTPS 访问。
- 现场优化：无阅读区遮罩、无默认倒计时、打开设置不重头播放。

## 本地预览

直接打开 `index.html` 即可。也可以在本目录启动静态服务：

```bash
python -m http.server 5177
```

然后访问 `http://localhost:5177`。

## 手机使用

线上地址是公网 HTTPS，外场手机可以直接打开，不依赖同一 Wi-Fi。建议在手机浏览器里选择“添加到主屏幕”，现场使用时更接近 App。

横屏按钮会尝试先进入全屏，再请求锁定横屏。部分浏览器，尤其 iPhone Safari，可能不允许网页强制横屏；这种情况下需要打开系统自动旋转后手动横放手机。

## 部署

仓库已包含 GitHub Pages Actions 配置：

- `.github/workflows/pages.yml`
- `.nojekyll`

推送到 `main` 分支后会自动发布 `index.html`、`app.js`、`styles.css` 和 `.nojekyll`。本地的 `source-snapshot/` 已被忽略，不会部署。
