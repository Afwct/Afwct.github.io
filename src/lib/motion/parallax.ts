import { gsap } from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { isCompact } from "./env"

gsap.registerPlugin(ScrollTrigger)

/** 同时最多几层视差，避免低端设备滚动时掉帧 */
const MAX_LAYERS = 6

/**
 * 视差
 *
 * 用法：`<div data-parallax="0.15">`，数值为正则向上飘、为负则向下沉。
 * 窄屏直接跳过（移动端视差体感差且耗电）。
 */
export function setupParallax(): void {
  if (isCompact()) return

  const layers = gsap.utils.toArray<HTMLElement>("[data-parallax]").slice(
    0,
    MAX_LAYERS,
  )

  layers.forEach((layer) => {
    const strength = Number.parseFloat(layer.dataset.parallax ?? "0.15")
    if (!Number.isFinite(strength) || strength === 0) return

    gsap.to(layer, {
      yPercent: strength * 100,
      ease: "none",
      scrollTrigger: {
        trigger: layer.closest("section") ?? layer,
        start: "top bottom",
        end: "bottom top",
        scrub: 0.6,
      },
    })
  })
}
