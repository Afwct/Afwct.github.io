import { gsap } from "gsap"
import { allowsPointerEffects } from "./env"

/**
 * 3D 倾斜 + 指针光斑
 *
 * toast 与卡片共用同一套交互语言。为了让调用方能在动画期间临时禁用，
 * 这里不依赖任何具体状态，而是接受一个 `enabled` 判定函数。
 *
 * 返回解绑函数（本站在 MPA 下通常不需要，但便于测试与复用）。
 */

export interface TiltOptions {
  /** 最大倾斜角度，默认 6deg */
  max?: number
  /** 每次是否可用（如入场动画未结束时应返回 false） */
  enabled?: () => boolean
  /** 是否写入 --mx/--my 供光斑层跟随，默认 true */
  spotlight?: boolean
}

export function attachTilt(
  element: HTMLElement,
  options: TiltOptions = {},
): () => void {
  const { max = 6, enabled, spotlight = true } = options

  if (!allowsPointerEffects()) return () => {}

  let frame = 0
  let targetRotateY = 0
  let targetRotateX = 0

  // 每帧最多一个补间：指针高频触发时只保留最后一帧的目标值
  const apply = () => {
    frame = 0
    if (enabled && !enabled()) return
    gsap.to(element, {
      rotateY: targetRotateY,
      rotateX: targetRotateX,
      duration: 0.45,
      ease: "power2.out",
      overwrite: "auto",
    })
  }

  const onPointerMove = (event: PointerEvent) => {
    if (enabled && !enabled()) return

    const rect = element.getBoundingClientRect()
    if (!rect.width || !rect.height) return

    const nx = (event.clientX - rect.left) / rect.width - 0.5
    const ny = (event.clientY - rect.top) / rect.height - 0.5

    targetRotateY = gsap.utils.clamp(-max, max, nx * max * 2)
    targetRotateX = gsap.utils.clamp(-max, max, -ny * max * 2)

    if (spotlight) {
      element.style.setProperty("--mx", `${(nx + 0.5) * 100}%`)
      element.style.setProperty("--my", `${(ny + 0.5) * 100}%`)
    }

    if (!frame) frame = requestAnimationFrame(apply)
  }

  const onPointerLeave = () => {
    if (frame) {
      cancelAnimationFrame(frame)
      frame = 0
    }
    targetRotateY = 0
    targetRotateX = 0
    gsap.to(element, {
      rotateY: 0,
      rotateX: 0,
      duration: 0.45,
      ease: "power2.out",
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
