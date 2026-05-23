# afwct.art

个人主页，基于 [Astro](https://astro.build) 构建，使用 [GSAP](https://gsap.com) 实现页面与滚动动效，部署于 [afwct.art](https://afwct.art)（GitHub Pages 自定义域名）。

## 页面

| 路径 | 说明 |
|------|------|
| `/` | 首页 |
| `/about` | 关于 |
| `/projects` | 项目 |
| `/notes` | 笔记列表 |
| `/notes/git` | Git 命令速查 |
| `/notes/astro` | Astro 站点说明 |
| `/notes/motion` | 动效备忘 |
| `/contact` | 联系 |

## 本地开发

```bash
npm install
npm run dev
```

构建：

```bash
npm run build
npm run preview
```

## 部署

推送到 `main` 或 `master` 分支后，GitHub Actions 会自动构建并发布。请在仓库 **Settings → Pages** 中将 Source 设为 **GitHub Actions**，并在 **Custom domain** 填写 `afwct.art`。

域名 DNS（在域名注册商处配置）：

- `@`（根域名 `afwct.art`）→ A 记录指向 GitHub Pages：`185.199.108.153`、`185.199.109.153`、`185.199.110.153`、`185.199.111.153`
- `www` → CNAME 指向 `<用户名>.github.io`（若使用 www 子域）

仓库根目录已包含 `public/CNAME`（内容为 `afwct.art`），构建后会写入 `dist/CNAME` 供 GitHub Pages 识别自定义域名。
