import { gsap } from "gsap"
import { Draggable } from "gsap/Draggable"
import { InertiaPlugin } from "gsap/InertiaPlugin"
import { allowsPointerEffects } from "./env"
import { pauseOrbitSpin, startOrbitSpin } from "./hero"

gsap.registerPlugin(Draggable, InertiaPlugin)

/**
 * 可拖拽元素
 *
 * 用于首页轨道视觉：拖拽时暂停自转，松手交给惯性继续旋转，
 * 停稳 1.2s 后从当前角度重新接上匀速自转（避免角度跳变）。
 */

const RESUME_DELAY = 1.2

export function setupDrag(): void {
  if (!allowsPointerEffects()) return

  gsap.utils.toArray<HTMLElement>("[data-drag]").forEach((element) => {
    if (Draggable.get(element)) return

    let resume: gsap.core.Tween | null = null

    Draggable.create(element, {
      type: "rotation",
      inertia: true,
      dragClickables: false,
      onPress() {
        resume?.kill()
        resume = null
        pauseOrbitSpin(element)
        // 兜底：入场延迟可能让自转在按下之后才起来，这里只杀旋转补间
        gsap.killTweensOf(element, "rotation")
      },
      onThrowComplete() {
        resume?.kill()
        resume = gsap.delayedCall(RESUME_DELAY, () => {
          const rotation = Number(gsap.getProperty(element, "rotation")) || 0
          startOrbitSpin(element, rotation)
        })
      },
    })
  })
}
