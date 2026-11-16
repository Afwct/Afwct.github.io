import { gsap } from "gsap"

/**
 * 全局消息提示（toast）核心
 *
 * 设计要点：
 * - 容器由 components/Toast.astro 挂载一次，本模块也能在缺容器时自建，避免脚本先于组件运行时报错；
 * - 动画用 GSAP：入场位移+缩放、图标回弹、关闭时可以「补位」平移（FLIP），
 *   并全程尊重 prefers-reduced-motion；
 * - 悬停或聚焦会暂停倒计时，长文案不至于读到一半消失。
 */

export type ToastType = "success" | "error" | "info" | "warning"

export interface ToastAction {
  label: string
  onClick: () => void
}

export interface ToastOptions {
  /** 第二行补充说明 */
  description?: string
  /** 自动关闭毫秒数，0 表示只能手动关闭 */
  duration?: number
  /** 是否显示关闭按钮，默认 true */
  dismissible?: boolean
  /** 附带一个操作按钮 */
  action?: ToastAction
}

export interface ToastHandle {
  close: () => void
  /** 对应 DOM 元素，元素尚未创建时为 null */
  readonly element: HTMLElement | null
}

const HOST_ID = "toast-host"
const DEFAULT_DURATION = 4200
/** 同时最多显示几条，超出时挤掉最旧的一条 */
const MAX_VISIBLE = 4

const ICONS: Record<ToastType, string> = {
  success: "✓",
  error: "✕",
  warning: "!",
  info: "i",
}

interface Entry {
  element: HTMLElement
  key: string
  closed: boolean
  duration: number
  timer: gsap.core.Tween | null
  progress: gsap.core.Tween | null
  bar: HTMLElement | null
}

const entries: Entry[] = []

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

/** 取或建容器；在无 DOM 环境（如构建期误导入）返回 null */
function ensureHost(): HTMLElement | null {
  if (typeof document === "undefined") return null

  let host = document.getElementById(HOST_ID)
  if (!host) {
    host = document.createElement("div")
    host.id = HOST_ID
    host.className = "toast-host"
    document.body.appendChild(host)
  }
  return host
}

function pauseTimers(entry: Entry): void {
  entry.timer?.pause()
  entry.progress?.pause()
}

function resumeTimers(entry: Entry): void {
  entry.timer?.resume()
  entry.progress?.resume()
}

function startTimer(entry: Entry, duration: number): void {
  entry.duration = duration
  if (duration <= 0) {
    if (entry.bar) entry.bar.hidden = true
    return
  }

  const seconds = duration / 1000
  entry.timer = gsap.delayedCall(seconds, () => dismiss(entry))

  // 进度条与倒计时同步收缩，让"还有多久消失"可被看见
  if (entry.bar) {
    entry.bar.hidden = false
    entry.progress = gsap.fromTo(
      entry.bar,
      { scaleX: 1 },
      { scaleX: 0, duration: seconds, ease: "none" },
    )
  }
}

/** 相同内容重复触发时只续期，避免连点堆出一排一模一样的提示 */
function restartTimer(entry: Entry, duration: number): void {
  entry.timer?.kill()
  entry.progress?.kill()
  if (entry.bar) gsap.set(entry.bar, { scaleX: 1 })
  startTimer(entry, duration)

  if (!prefersReducedMotion()) {
    gsap.fromTo(
      entry.element,
      { scale: 1 },
      {
        scale: 1.02,
        duration: 0.16,
        yoyo: true,
        repeat: 1,
        ease: "power1.inOut",
        overwrite: "auto",
      },
    )
  }
}

/**
 * 移除元素并让下方提示平滑补位。
 *
 * 走 FLIP：先量位、再删、再按差值反向动画，避免 flex 重排导致的瞬间跳位。
 */
function removeAndShift(element: HTMLElement): void {
  const siblings = entries
    .map((entry) => entry.element)
    .filter((el) => el !== element && el.isConnected)

  const before = siblings.map((el) => el.getBoundingClientRect().top)
  element.remove()
  const after = siblings.map((el) => el.getBoundingClientRect().top)

  if (prefersReducedMotion()) return

  siblings.forEach((el, index) => {
    const delta = before[index] - after[index]
    if (Math.abs(delta) < 0.5) return
    gsap.fromTo(
      el,
      { y: delta },
      { y: 0, duration: 0.3, ease: "power3.out", overwrite: "auto" },
    )
  })
}

function dismiss(entry: Entry, immediate = false): void {
  if (entry.closed) return
  entry.closed = true

  entry.timer?.kill()
  entry.progress?.kill()

  const index = entries.indexOf(entry)
  if (index >= 0) entries.splice(index, 1)

  const finish = () => removeAndShift(entry.element)

  if (immediate || prefersReducedMotion()) {
    finish()
    return
  }

  gsap.to(entry.element, {
    opacity: 0,
    x: 28,
    scale: 0.96,
    duration: 0.26,
    ease: "power2.in",
    onComplete: finish,
  })
}

/** 创建一条提示并返回句柄 */
export function showToast(
  type: ToastType,
  message: string,
  options: ToastOptions = {},
): ToastHandle {
  const host = ensureHost()
  if (!host) return { close: () => {}, element: null }

  const {
    description,
    duration = DEFAULT_DURATION,
    dismissible = true,
    action,
  } = options

  const key = `${type}|${message}|${description ?? ""}`

  const existing = entries.find((entry) => !entry.closed && entry.key === key)
  if (existing) {
    restartTimer(existing, duration)
    return { close: () => dismiss(existing), element: existing.element }
  }

  // 超出上限时先把最旧的一条挤出去（立即移除，避免连锁动画打架）
  while (entries.length >= MAX_VISIBLE) {
    const oldest = entries[0]
    if (!oldest) break
    dismiss(oldest, true)
  }

  const element = document.createElement("div")
  element.className = `toast toast--${type}`
  // 报错类用 alert（打断式播报），其余用 status（礼貌播报）
  element.setAttribute(
    "role",
    type === "error" || type === "warning" ? "alert" : "status",
  )

  const entry: Entry = {
    element,
    key,
    closed: false,
    duration,
    timer: null,
    progress: null,
    bar: null,
  }

  const icon = document.createElement("span")
  icon.className = "toast__icon"
  icon.setAttribute("aria-hidden", "true")
  icon.textContent = ICONS[type]
  element.appendChild(icon)

  const body = document.createElement("div")
  body.className = "toast__body"

  // 一律用 textContent：错误信息里常带引号、尖括号，绝不能当 HTML 解析
  const title = document.createElement("p")
  title.className = "toast__title"
  title.textContent = message
  body.appendChild(title)

  if (description) {
    const desc = document.createElement("p")
    desc.className = "toast__desc"
    desc.textContent = description
    body.appendChild(desc)
  }

  if (action) {
    const actionBtn = document.createElement("button")
    actionBtn.type = "button"
    actionBtn.className = "toast__action"
    actionBtn.textContent = action.label
    actionBtn.addEventListener("click", () => {
      action.onClick()
      dismiss(entry)
    })
    body.appendChild(actionBtn)
  }

  element.appendChild(body)

  if (dismissible) {
    const closeBtn = document.createElement("button")
    closeBtn.type = "button"
    closeBtn.className = "toast__close"
    closeBtn.setAttribute("aria-label", "关闭提示")
    closeBtn.textContent = "✕"
    closeBtn.addEventListener("click", () => dismiss(entry))
    element.appendChild(closeBtn)
  }

  const bar = document.createElement("span")
  bar.className = "toast__progress"
  bar.setAttribute("aria-hidden", "true")
  element.appendChild(bar)
  entry.bar = bar

  // 悬停 / 聚焦暂停倒计时，方便读长文案
  element.addEventListener("mouseenter", () => pauseTimers(entry))
  element.addEventListener("mouseleave", () => resumeTimers(entry))
  element.addEventListener("focusin", () => pauseTimers(entry))
  element.addEventListener("focusout", () => resumeTimers(entry))

  host.appendChild(element)
  entries.push(entry)

  // 入场：新提示追加在堆叠末尾，已有提示不会被顶动
  if (prefersReducedMotion()) {
    gsap.set(element, { opacity: 1 })
  } else {
    gsap.fromTo(
      element,
      { opacity: 0, y: 18, scale: 0.97 },
      { opacity: 1, y: 0, scale: 1, duration: 0.42, ease: "power3.out" },
    )
    gsap.from(icon, {
      scale: 0.4,
      opacity: 0,
      duration: 0.45,
      delay: 0.08,
      ease: "back.out(2)",
    })
  }

  startTimer(entry, duration)
  return { close: () => dismiss(entry), element }
}

export interface ToastApi {
  (message: string, options?: ToastOptions): ToastHandle
  success: (message: string, options?: ToastOptions) => ToastHandle
  error: (message: string, options?: ToastOptions) => ToastHandle
  info: (message: string, options?: ToastOptions) => ToastHandle
  warning: (message: string, options?: ToastOptions) => ToastHandle
  /** 立刻清空所有提示 */
  dismissAll: () => void
}

/** 统一出口：页面脚本 `import { toast }`，控制台 `window.toast` */
export const toast: ToastApi = Object.assign(
  (message: string, options?: ToastOptions) =>
    showToast("info", message, options),
  {
    success: (message: string, options?: ToastOptions) =>
      showToast("success", message, options),
    error: (message: string, options?: ToastOptions) =>
      showToast("error", message, options),
    info: (message: string, options?: ToastOptions) =>
      showToast("info", message, options),
    warning: (message: string, options?: ToastOptions) =>
      showToast("warning", message, options),
    dismissAll: () => {
      ;[...entries].forEach((entry) => dismiss(entry, true))
    },
  },
) as ToastApi

declare global {
  interface Window {
    /** 由 Toast.astro 注入，方便控制台与内联脚本直接调用 */
    toast?: ToastApi
  }
}
