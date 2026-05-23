export const site = {
	name: 'afwct',
	domain: 'afwct.art',
	title: 'afwct — 个人主页',
	description: '开发者个人站点，记录项目、笔记与日常探索。',
	url: 'https://afwct.art',
	github: 'https://github.com/afwct',
	email: 'kogawananari@gmail.com',
} as const;

export const nav = [
	{ href: '/', label: '首页' },
	{ href: '/about', label: '关于' },
	{ href: '/projects', label: '项目' },
	{ href: '/notes', label: '笔记' },
	{ href: '/contact', label: '联系' },
] as const;

export const projects = [
	{
		title: 'afwct.art',
		desc: '基于 Astro 与 GSAP 的个人站点。',
		tags: ['Astro', 'GSAP', site.domain],
		link: 'https://github.com/afwct/Afwct.github.io',
	},
	{
		title: 'Git 备忘',
		desc: '常用 Git 命令与工作流整理，便于日常查阅。',
		tags: ['Git', 'Docs'],
		link: '/notes',
	},
	{
		title: '实验性前端',
		desc: '交互原型、动效练习与小工具集合。',
		tags: ['HTML', 'CSS', 'JavaScript'],
		link: 'https://github.com/afwct',
	},
	{
		title: '开源贡献',
		desc: '参与社区项目、Issue 与 PR 的零散记录。',
		tags: ['Open Source'],
		link: 'https://github.com/afwct?tab=repositories',
	},
] as const;

export const notes = [
	{
		title: 'Git 命令速查',
		summary: '配置、分支、提交、回滚等常用操作整理。',
		date: '2025',
		href: '/notes/git',
	},
	{
		title: 'Astro 静态站点',
		summary: '用 Astro 搭建 afwct.art，配合 GSAP 页面动效。',
		date: '2026',
		href: '/notes/astro',
	},
	{
		title: '动效设计备忘',
		summary: 'ScrollTrigger、时间轴与页面过渡的实践要点。',
		date: '2026',
		href: '/notes/motion',
	},
] as const;
