/**
 * 动效环境判定
 *
 * 所有降级决策都从这里取，避免各模块各自拼 matchMedia 字符串。
 */

function query(list: string): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false
  return window.matchMedia(list).matches
}

/** 用户是否要求减少动效 */
export function prefersReducedMotion(): boolean {
  return query("(prefers-reduced-motion: reduce)")
}

/** 是否有可悬停的精细指针（触屏为 false） */
export function canHover(): boolean {
  return query("(hover: hover) and (pointer: fine)")
}

/** 窄屏：装饰性动效统一降级 */
export function isCompact(): boolean {
  return query("(max-width: 768px)")
}

/** 指针交互（倾斜、磁吸、光斑、拖拽）是否值得启用 */
export function allowsPointerEffects(): boolean {
  return canHover() && !isCompact() && !prefersReducedMotion()
}
