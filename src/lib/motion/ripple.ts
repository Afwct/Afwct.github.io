import { gsap } from "gsap"
import { allowsPointerEffects } from "./env"

/**
 * 点击涟漪 + 按压缩放
 *
 * 涟漪从实际点击点扩散，容器需 position: relative 且 overflow: hidden（见 global.css）。
 * 单个容器最多并存 3 个涟漪，避免狂点时元素堆积。
 */

/** 卡片体量大，整块涟漪观感不佳，这里只做按钮类元素 */
const TARGETS = ".btn, [data-ripple]"
const MAX_RIPPLES = 3
const PRESS_SCALE = 0.97

function spawnRipple(container: HTMLElement, event: PointerEvent): void {
  const rect = container.getBoundingClientRect()
  if (!rect.width || !rect.height) return

  const existing = container.querySelectorAll(":scope > .ripple")
  if (existing.length >= MAX_RIPPLES) existing[0]?.remove()

  const size = Math.max(rect.width, rect.height) * 2
  const ripple = document.createElement("span")
  ripple.className = "ripple"
  ripple.setAttribute("aria-hidden", "true")
  ripple.style.width = `${size}px`
  ripple.style.height = `${size}px`
  ripple.style.left = `${event.clientX - rect.left - size / 2}px`
  ripple.style.top = `${event.clientY - rect.top - size / 2}px`
  container.appendChild(ripple)

  gsap.fromTo(
    ripple,
    { scale: 0, opacity: 0.35 },
    {
      scale: 1,
      opacity: 0,
      duration: 0.6,
      ease: "power2.out",
      onComplete: () => ripple.remove(),
    },
  )
}

export function setupRipple(): void {
  if (!allowsPointerEffects()) return

  gsap.utils.toArray<HTMLElement>(TARGETS).forEach((element) => {
    element.addEventListener("pointerdown", (event) => {
      spawnRipple(element, event)
      gsap.to(element, {
        scale: PRESS_SCALE,
        duration: 0.12,
        ease: "power2.out",
        overwrite: "auto",
      })
    })

    element.addEventListener("pointerup", () => {
      gsap.to(element, {
        scale: 1,
        duration: 0.45,
        ease: "elastic.out(1, 0.6)",
        overwrite: "auto",
      })
    })

    // 指针中途移出也要复位，避免卡在按下态
    element.addEventListener("pointerleave", () => {
      gsap.to(element, {
        scale: 1,
        duration: 0.3,
        ease: "power2.out",
        overwrite: "auto",
      })
    })
  })
}
