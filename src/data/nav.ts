export interface Crumb {
  label: string
  href?: string
}

export function noteBreadcrumbs(currentTitle: string): Crumb[] {
  return [
    { label: "首页", href: "/" },
    { label: "笔记", href: "/notes" },
    { label: currentTitle },
  ]
}
