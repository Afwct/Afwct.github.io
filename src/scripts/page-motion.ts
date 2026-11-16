import { gsap } from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { prefersReducedMotion } from "../lib/motion/env"
import { setupDrag } from "../lib/motion/drag"
import {
  setupHeader,
  setupNavIndicator,
  setupScrollProgress,
} from "../lib/motion/header"
import { setupHero } from "../lib/motion/hero"
import { setupHoverEffects } from "../lib/motion/hover"
import { setupParallax } from "../lib/motion/parallax"
import { setupMagnetic } from "../lib/motion/magnetic"
import { setupReveals } from "../lib/motion/reveal"
import { setupRipple } from "../lib/motion/ripple"
import { attachTilt } from "../lib/motion/tilt"
import { setupPageTransition } from "../lib/motion/transition"

gsap.registerPlugin(ScrollTrigger)

/**
 * 全站动效编排器
 *
 * 分两类：
 * - 功能性（顶栏状态、导航指示器、阅读进度）：永远执行，减弱动效也不跳过；
 * - 装饰性（首屏编曲、滚动揭示、视差、磁吸、倾斜、转场）：减弱动效时整体跳过，
 *   此时没有任何元素被预先隐藏，内容天然可见。
 */

/** 卡片与 toast 共用同一套倾斜交互 */
function setupCardTilt(): void {
  gsap.utils
    .toArray<HTMLElement>("[data-card]")
    .forEach((card) => attachTilt(card))
}

function resetDecorativeState(): void {
  gsap.set(
    [
      "[data-animate]",
      "[data-card]",
      "[data-timeline-item]",
      "[data-hero-title]",
      "[data-hero-eyebrow]",
      "[data-hero-subtitle]",
      "[data-hero-cta]",
      "[data-hero-visual]",
      "[data-line]",
      ".split-line",
    ].join(", "),
    { opacity: 1, clearProps: "all" },
  )
}

function init(): void {
  const reduced = prefersReducedMotion()

  setupHeader({ animate: !reduced })
  setupNavIndicator()
  setupScrollProgress()

  if (reduced) {
    resetDecorativeState()
    ScrollTrigger.refresh()
    return
  }

  setupHero()
  setupReveals()
  setupCardTilt()
  setupMagnetic()
  setupParallax()
  setupPageTransition()

  // 交互层：点击反馈、悬停增强、可拖拽（模块内部再各自校验环境）
  setupRipple()
  setupHoverEffects()
  setupDrag()

  ScrollTrigger.refresh()

  // 字体换上后行宽会变，分行与触发点都需要重算
  document.fonts?.ready
    .then(() => ScrollTrigger.refresh())
    .catch(() => {
      /* 字体加载失败无需处理 */
    })
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init)
} else {
  init()
}
