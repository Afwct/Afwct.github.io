import { gsap } from "gsap"
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin"
import { Physics2DPlugin } from "gsap/Physics2DPlugin"
import { canHover, prefersReducedMotion } from "./motion/env"
import { attachTilt } from "./motion/tilt"

gsap.registerPlugin(DrawSVGPlugin, Physics2DPlugin)

/**
 * 全局消息提示（toast）核心
 *
 * 视觉分层（三层各管一类变换，互不抢属性）：
 *   .toast-slot      在流布局里，只吃「退出补位」的 y 位移（FLIP 作用于它）
 *   .toast-depth     只吃「纵深堆叠」：scale / y / rotateX / z / opacity
 *   .toast           只吃「入场、退出、悬停倾斜」+ 全部视觉样式与 ARIA
 *
 * 动效编排按类型区分，并全程尊重 prefers-reduced-motion。
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
  /** 对应 DOM 元素（卡片本体），元素尚未创建时为 null */
  readonly element: HTMLElement | null
}

const HOST_ID = "toast-host"
const DEFAULT_DURATION = 4200
/** 同时最多显示几条，超出时挤掉最旧的一条 */
const MAX_VISIBLE = 4
/** 纵深只作用于最新的几条，再往后用同一组极值封顶 */
const DEPTH_MAX = 3

/**
 * 图标用内联 SVG 才能做描边绘制。
 * 这是库内的可信常量（不含任何外部输入），故可安全地用 innerHTML 注入；
 * 用户文案依旧一律走 textContent。
 */
const ICON_SVG: Record<ToastType, string> = {
  success:
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.4 8.5 6.4 11.5 12.6 4.6"/></svg>',
  error:
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4.6 4.6 11.4 11.4"/><path d="M11.4 4.6 4.6 11.4"/></svg>',
  warning:
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M8 3.6 8 8.9"/><path d="M8 12.1 8 12.2"/></svg>',
  info:
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M8 7.4 8 12.1"/><path d="M8 3.9 8 4"/></svg>',
}

interface Entry {
  slot: HTMLElement
  depth: HTMLElement
  card: HTMLElement
  particles: HTMLElement | null
  key: string
  type: ToastType
  closed: boolean
  /** 入场动画是否已完成（倾斜等交互要等它结束才能接管变换） */
  ready: boolean
  duration: number
  depthIndex: number
  timer: gsap.core.Tween | null
  progress: gsap.core.Tween | null
  intro: gsap.core.Timeline | null
  bar: HTMLElement | null
}

const entries: Entry[] = []

/* ---------- 环境判定：统一走 src/lib/motion/env.ts ---------- */

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

/* ---------- 纵深堆叠 ---------- */

interface DepthTarget {
  scale: number
  y: number
  rotateX: number
  z: number
  opacity: number
}

/** index = 0 表示最新的一条 */
function depthTarget(index: number): DepthTarget {
  const depth = Math.min(index, DEPTH_MAX)
  return {
    scale: 1 - depth * 0.045,
    y: -depth * 9,
    rotateX: -depth * 4,
    z: -depth * 36,
    opacity: 1 - depth * 0.14,
  }
}

/**
 * 重排所有存活提示的纵深，形成"卡堆"。
 * 新提示到达时旧提示会后推，移除时前方提示会向前补位。
 */
function layoutDepth(animated = true): void {
  const alive = entries.filter((entry) => !entry.closed)
  const total = alive.length

  alive.forEach((entry, arrayIndex) => {
    // entries 是插入序（旧→新），最新的在末尾，故深度序号要反过来
    const index = total - 1 - arrayIndex
    entry.depthIndex = index

    if (prefersReducedMotion()) {
      gsap.set(entry.depth, { scale: 1, y: 0, rotateX: 0, z: 0, opacity: 1 })
      return
    }

    const target = depthTarget(index)
    if (!animated) {
      gsap.set(entry.depth, target)
      return
    }

    gsap.to(entry.depth, {
      ...target,
      duration: 0.5,
      ease: "power3.out",
      delay: Math.min(index, DEPTH_MAX) * 0.04,
      overwrite: "auto",
    })
  })
}

/* ---------- 粒子 ---------- */

function spawnParticles(entry: Entry): void {
  const layer = entry.particles
  if (!layer || entry.closed || prefersReducedMotion()) return

  const count = window.innerWidth > 768 ? 8 : 5
  const fragment = document.createDocumentFragment()
  for (let i = 0; i < count; i++) {
    const dot = document.createElement("span")
    dot.className = "toast-particle"
    fragment.appendChild(dot)
  }
  layer.appendChild(fragment)

  const dots = Array.from(layer.children) as HTMLElement[]
  dots.forEach((dot, i) => {
    // 从图标附近起跳，向外抛散并受重力影响
    gsap.set(dot, { x: 16, y: -10 })
    gsap.to(dot, {
      physics2D: {
        velocity: gsap.utils.random(1.4, 3),
        angle: gsap.utils.random(0, 360),
        gravity: 240,
      },
      opacity: 0,
      scale: 0.3,
      duration: 0.75,
      delay: i * 0.012,
      ease: "power1.out",
    })
  })

  gsap.delayedCall(1.05, () => layer.replaceChildren())
}

/* ---------- 入场编排 ---------- */

function animateIn(entry: Entry): void {
  const { card, type } = entry
  const iconWrap = card.querySelector<HTMLElement>(".toast__icon")
  const paths = card.querySelectorAll<SVGPathElement>(".toast__icon svg path")
  const ring = card.querySelector<HTMLElement>(".toast__ring")
  const shine = card.querySelector<HTMLElement>(".toast__shine")
  const closeBtn = card.querySelector<HTMLElement>(".toast__close")
  const bodyItems = card.querySelectorAll<HTMLElement>(
    ".toast__title, .toast__desc, .toast__action",
  )

  if (prefersReducedMotion()) {
    gsap.set(card, { opacity: 1 })
    gsap.set(paths, { drawSVG: "100%" })
    entry.ready = true
    return
  }

  card.style.willChange = "transform, opacity"

  const timeline = gsap.timeline({
    defaults: { ease: "power3.out" },
    onComplete: () => {
      card.style.willChange = ""
      entry.ready = true
    },
  })
  entry.intro = timeline

  // ① 卡片主体：按类型给不同的"性格"
  switch (type) {
    case "success":
      timeline.fromTo(
        card,
        { opacity: 0, y: 26, scale: 0.92, rotateX: 16 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          rotateX: 0,
          duration: 0.6,
          ease: "expo.out",
        },
      )
      break

    case "error":
      timeline
        .fromTo(
          card,
          { opacity: 0, scale: 1.08, y: -6 },
          { opacity: 1, scale: 1, y: 0, duration: 0.32, ease: "power4.out" },
        )
        // 砸入后的横向抖动
        .to(
          card,
          {
            keyframes: [
              { x: -7, duration: 0.07 },
              { x: 6, duration: 0.07 },
              { x: -4, duration: 0.07 },
              { x: 2, duration: 0.07 },
              { x: 0, duration: 0.14 },
            ],
            ease: "none",
          },
          "-=0.1",
        )
      break

    case "warning":
      timeline
        .fromTo(
          card,
          { opacity: 0, y: 18, scale: 0.95, rotation: -2.5 },
          {
            opacity: 1,
            y: 0,
            scale: 1,
            rotation: 0,
            duration: 0.45,
            ease: "back.out(1.6)",
          },
        )
        .to(
          card,
          {
            keyframes: [
              { rotation: 2.5, duration: 0.12 },
              { rotation: -1.5, duration: 0.12 },
              { rotation: 0, duration: 0.16 },
            ],
            ease: "sine.inOut",
          },
          "-=0.2",
        )
      break

    default: // info
      timeline.fromTo(
        card,
        { opacity: 0, x: 40, skewX: -6, scale: 0.98 },
        {
          opacity: 1,
          x: 0,
          skewX: 0,
          scale: 1,
          duration: 0.5,
          ease: "expo.out",
        },
      )
  }

  // ② 图标：描边自绘 + 弹入 + 能量环扩散
  timeline.fromTo(
    paths,
    { drawSVG: "0%" },
    { drawSVG: "100%", duration: 0.45, ease: "power2.out" },
    0.12,
  )
  if (iconWrap) {
    timeline.from(
      iconWrap,
      { scale: 0.55, opacity: 0, duration: 0.4, ease: "back.out(2.2)" },
      0.08,
    )
  }
  if (ring) {
    timeline.fromTo(
      ring,
      { scale: 0.55, opacity: 0.75 },
      { scale: 1.75, opacity: 0, duration: 0.75, ease: "power2.out" },
      0.1,
    )
  }

  // ③ 内容依次入场
  if (bodyItems.length) {
    timeline.from(
      bodyItems,
      { opacity: 0, y: 8, duration: 0.35, stagger: 0.06 },
      0.16,
    )
  }
  if (closeBtn) {
    timeline.from(closeBtn, { opacity: 0, duration: 0.3 }, 0.3)
  }

  // ④ 高光扫过（仅轻盈的两型）
  if (shine && (type === "success" || type === "info")) {
    timeline.fromTo(
      shine,
      { xPercent: -140 },
      { xPercent: 240, duration: 0.7, ease: "power2.inOut" },
      0.25,
    )
  }

  // ⑤ 粒子（成功后迸散，触屏与窄屏自动减少）
  if (type === "success" && canHover()) {
    timeline.call(() => spawnParticles(entry), undefined, 0.1)
  }
}

/* ---------- 悬停倾斜 ---------- */

/** 倾斜逻辑与卡片共用 src/lib/motion/tilt.ts */
function attachTiltToEntry(entry: Entry): void {
  attachTilt(entry.card, {
    enabled: () => entry.ready && !entry.closed,
  })
}

/* ---------- 倒计时 ---------- */

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

  // 入场还没走完就被重复触发的话，不叠加脉冲，免得和入场抢属性
  if (entry.ready && !prefersReducedMotion()) {
    gsap.fromTo(
      entry.card,
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

/* ---------- 移除与补位 ---------- */

/**
 * 移除 slot 并让下方提示平滑补位，然后重排纵深。
 *
 * 走 FLIP：先量位、再删、再按差值反向动画，避免 flex 重排导致的瞬间跳位。
 * 只作用于 slot 层，所以不受卡片 3D 变换干扰。
 */
function removeAndShift(slot: HTMLElement): void {
  const siblings = entries
    .map((entry) => entry.slot)
    .filter((el) => el !== slot && el.isConnected)

  const before = siblings.map((el) => el.getBoundingClientRect().top)
  slot.remove()
  const after = siblings.map((el) => el.getBoundingClientRect().top)

  if (!prefersReducedMotion()) {
    siblings.forEach((el, index) => {
      const delta = before[index] - after[index]
      if (Math.abs(delta) < 0.5) return
      gsap.fromTo(
        el,
        { y: delta },
        { y: 0, duration: 0.35, ease: "power3.out", overwrite: "auto" },
      )
    })
  }

  // 少了一条，前方的提示要往前补一格
  layoutDepth()
}

function dismiss(entry: Entry, immediate = false): void {
  if (entry.closed) return
  entry.closed = true
  entry.ready = false

  entry.timer?.kill()
  entry.progress?.kill()
  entry.intro?.kill()
  entry.particles?.replaceChildren()

  const index = entries.indexOf(entry)
  if (index >= 0) entries.splice(index, 1)

  if (immediate || prefersReducedMotion()) {
    removeAndShift(entry.slot)
    return
  }

  gsap.to(entry.card, {
    opacity: 0,
    x: 64,
    rotateZ: 4,
    scale: 0.9,
    duration: 0.3,
    ease: "power3.in",
    onComplete: () => removeAndShift(entry.slot),
  })
}

/* ---------- 创建 ---------- */

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
    return { close: () => dismiss(existing), element: existing.card }
  }

  // 超出上限时先把最旧的一条挤出去（立即移除，避免连锁动画打架）
  while (entries.length >= MAX_VISIBLE) {
    const oldest = entries[0]
    if (!oldest) break
    dismiss(oldest, true)
  }

  /* ---- 三层骨架 ---- */
  const slot = document.createElement("div")
  // 类型修饰类挂在 slot 上，好让粒子层也能继承 --toast-color
  slot.className = `toast-slot toast-slot--${type}`

  const particles = document.createElement("div")
  particles.className = "toast-particles"
  particles.setAttribute("aria-hidden", "true")
  slot.appendChild(particles)

  const depth = document.createElement("div")
  depth.className = "toast-depth"
  slot.appendChild(depth)

  const card = document.createElement("div")
  card.className = `toast toast--${type}`
  // 报错类用 alert（打断式播报），其余用 status（礼貌播报）
  card.setAttribute(
    "role",
    type === "error" || type === "warning" ? "alert" : "status",
  )
  depth.appendChild(card)

  const entry: Entry = {
    slot,
    depth,
    card,
    particles,
    key,
    type,
    closed: false,
    ready: false,
    duration,
    depthIndex: 0,
    timer: null,
    progress: null,
    intro: null,
    bar: null,
  }

  /* ---- 图标：SVG + 能量环 ---- */
  const icon = document.createElement("span")
  icon.className = "toast__icon"
  icon.setAttribute("aria-hidden", "true")
  icon.innerHTML = ICON_SVG[type]

  const ring = document.createElement("span")
  ring.className = "toast__ring"
  ring.setAttribute("aria-hidden", "true")
  icon.appendChild(ring)

  card.appendChild(icon)

  /* ---- 正文 ---- */
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

  card.appendChild(body)

  /* ---- 关闭按钮 ---- */
  if (dismissible) {
    const closeBtn = document.createElement("button")
    closeBtn.type = "button"
    closeBtn.className = "toast__close"
    closeBtn.setAttribute("aria-label", "关闭提示")
    closeBtn.textContent = "✕"
    closeBtn.addEventListener("click", () => dismiss(entry))
    card.appendChild(closeBtn)
  }

  /* ---- 装饰层（不参与交互，也不被读屏） ---- */
  const spotlight = document.createElement("span")
  spotlight.className = "toast__spotlight"
  spotlight.setAttribute("aria-hidden", "true")
  card.appendChild(spotlight)

  const shine = document.createElement("span")
  shine.className = "toast__shine"
  shine.setAttribute("aria-hidden", "true")
  card.appendChild(shine)

  const bar = document.createElement("span")
  bar.className = "toast__progress"
  bar.setAttribute("aria-hidden", "true")
  card.appendChild(bar)
  entry.bar = bar

  /* ---- 交互 ---- */
  // 悬停 / 聚焦暂停倒计时，方便读长文案
  card.addEventListener("mouseenter", () => pauseTimers(entry))
  card.addEventListener("mouseleave", () => resumeTimers(entry))
  card.addEventListener("focusin", () => pauseTimers(entry))
  card.addEventListener("focusout", () => resumeTimers(entry))

  host.appendChild(slot)
  entries.push(entry)

  layoutDepth(true)
  animateIn(entry)
  attachTiltToEntry(entry)
  startTimer(entry, duration)

  return { close: () => dismiss(entry), element: card }
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
