# afwct

个人主页，基于 [Astro](https://astro.build) 构建，使用 [GSAP](https://gsap.com) 实现页面与滚动动效，部署于 [afwct.top](https://afwct.top)。

## 页面

| 路径            | 说明           |
| --------------- | -------------- |
| `/`             | 首页           |
| `/about`        | 关于           |
| `/projects`     | 项目           |
| `/notes`        | 笔记列表       |
| `/notes/git`    | Git 命令速查   |
| `/notes/astro`  | Astro 站点说明 |
| `/notes/motion` | 动效备忘       |
| `/contact`      | 联系           |

## 本地开发

```bash
npm install
npm run sync   # 生成 .astro 类型，消除 astro/config 报错
npm run dev
```

构建：

```bash
npm run build
npm run preview
```

## 部署

推送到 `main` 分支后，GitHub Actions 会自动构建并发布。
