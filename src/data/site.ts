export const site = {
  name: "Afwct",
  domain: "afwct.top",
  title: "Afwct ❤ Miku",
  description: "心脏献给世界第一公主殿下",
  url: "https://afwct.top",
  github: "https://github.com/afwct",
  email: "Email就算了",
} as const

export const nav = [
  { href: "/", label: "首页" },
  { href: "/about", label: "关于" },
  { href: "/projects", label: "项目" },
  { href: "/notes", label: "笔记" },
  { href: "/contact", label: "联系" },
] as const

export const projects = [
  {
    title: "Afwct",
    desc: "基于 Astro 与 GSAP 的个人站点。",
    tags: ["Astro", "GSAP", site.domain],
    link: "https://github.com/afwct/Afwct.github.io",
  },
  {
    title: "实验性前端",
    desc: "交互原型、动效练习与小工具集合。",
    tags: ["Component"],
    link: "https://github.com/afwct",
  },
  {
    title: "Minecraft MOD",
    desc: "算是学习开发MC模组",
    tags: ["Minecraft", "Forge"],
    link: "https://github.com/Afwct/Alchemy",
  },
  {
    title: "Git 备忘",
    desc: "常用 Git 命令与工作流整理，便于日常查阅。",
    tags: ["Git", "Docs"],
    link: "/notes",
  },
] as const

export const notes = [
  {
    title: "Git 命令速查",
    summary: "同步展示 gitmemo.rst：配置、分支、提交、回滚等常用命令。",
    date: "2025",
    href: "/notes/git",
  },
  {
    title: "Astro 静态站点",
    summary: "用 Astro 搭建 afwct.top，配合 GSAP 页面动效。",
    date: "2026",
    href: "/notes/astro",
  },
  {
    title: "动效设计备忘",
    summary: "ScrollTrigger、时间轴与页面过渡的实践要点。",
    date: "2026",
    href: "/notes/motion",
  },
] as const
