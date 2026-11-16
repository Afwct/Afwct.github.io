import { gsap } from "gsap"
import { allowsPointerEffects } from "./env"

/**
 * 磁吸按钮
 *
 * 指针靠近时元素朝指针方向偏移，离开时带一点回弹。
 * 与倾斜同源：都用 rAF 节流的补间，避免高频事件创建大量补间。
 */

export interface MagneticOptions {
  /** 最大偏移像素，默认 6 */
  strength?: number
}

export function attachMagnetic(
  element: HTMLElement,
  options: MagneticOptions = {},
): () => void {
  if (!allowsPointerEffects()) return () => {}

  const strength = options.strength ?? 6
  let frame = 0
  let targetX = 0
  let targetY = 0

  const apply = () => {
    frame = 0
    gsap.to(element, {
      x: targetX,
      y: targetY,
      duration: 0.5,
      ease: "power3.out",
      overwrite: "auto",
    })
  }

  const onPointerMove = (event: PointerEvent) => {
    const rect = element.getBoundingClientRect()
    if (!rect.width || !rect.height) return

    const nx = (event.clientX - rect.left) / rect.width - 0.5
    const ny = (event.clientY - rect.top) / rect.height - 0.5

    targetX = nx * strength * 2
    targetY = ny * strength * 2

    if (!frame) frame = requestAnimationFrame(apply)
  }

  const onPointerLeave = () => {
    if (frame) {
      cancelAnimationFrame(frame)
      frame = 0
    }
    targetX = 0
    targetY = 0
    gsap.to(element, {
      x: 0,
      y: 0,
      duration: 0.6,
      ease: "elastic.out(1, 0.5)",
      overwrite: "auto",
    })
  }

  element.addEventListener("pointermove", onPointerMove)
  element.addEventListener("pointerleave", onPointerLeave)

  return () => {
    element.removeEventListener("pointermove", onPointerMove)
    element.removeEventListener("pointerleave", onPointerLeave)
    if (frame) cancelAnimationFrame(frame)
  }
}

export function setupMagnetic(): void {
  gsap.utils
    .toArray<HTMLElement>("[data-magnetic]")
    .forEach((element) => attachMagnetic(element))
}
