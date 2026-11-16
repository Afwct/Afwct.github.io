import { gsap } from "gsap"
import { SplitText } from "gsap/SplitText"
import { allowsPointerEffects } from "./env"

gsap.registerPlugin(SplitText)

/** 轨道自转补间登记表：拖拽模块需要暂停/接管它 */
const orbitSpins = new WeakMap<HTMLElement, gsap.core.Tween>()

/**
 * 启动（或接管）轨道自转。
 *
 * 拖拽结束后用当前角度作为起点重新进入匀速自转，避免角度突跳。
 */
export function startOrbitSpin(
  element: HTMLElement,
  from = 0,
): gsap.core.Tween {
  orbitSpins.get(element)?.kill()
  gsap.set(element, { rotation: from, transformOrigin: "50% 50%" })

  const tween = gsap.to(element, {
    rotation: from + 360,
    duration: 24,
    repeat: -1,
    ease: "none",
    transformOrigin: "50% 50%",
  })
  orbitSpins.set(element, tween)
  return tween
}

export function pauseOrbitSpin(element: HTMLElement): void {
  orbitSpins.get(element)?.pause()
}

/**
 * 首屏编曲
 *
 * 首页 Hero 与内页 PageHero 共用：标题逐行遮罩揭示，其余元素按节奏跟进。
 * 标题用 autoSplit 保证字体加载/窗口缩放后重新分行仍然正确。
 */
export function setupHero(): void {
  const eyebrow = document.querySelector<HTMLElement>("[data-hero-eyebrow]")
  const title = document.querySelector<HTMLElement>("[data-hero-title]")
  const subtitle = document.querySelector<HTMLElement>("[data-hero-subtitle]")
  const cta = document.querySelector<HTMLElement>("[data-hero-cta]")
  const visual = document.querySelector<HTMLElement>("[data-hero-visual]")
  const orbit = document.querySelector<HTMLElement>("[data-orbit]")

  const timeline = gsap.timeline({ defaults: { ease: "power3.out" } })

  if (eyebrow) {
    timeline.from(eyebrow, { opacity: 0, y: 18, duration: 0.7 }, 0)
  }

  if (title) {
    let played = false

    SplitText.create(title, {
      type: "lines",
      mask: "lines",
      linesClass: "split-line",
      autoSplit: true,
      onSplit: (self) => {
        // 重新分行时不再重播入场
        if (played) {
          gsap.set(self.lines, { yPercent: 0, opacity: 1 })
          return
        }
        return gsap.from(self.lines, {
          yPercent: 110,
          opacity: 0,
          duration: 1,
          ease: "expo.out",
          stagger: 0.09,
          delay: 0.1,
          onComplete: () => {
            played = true
          },
        })
      },
    })
  }

  if (subtitle) {
    timeline.from(subtitle, { opacity: 0, y: 20, duration: 0.75 }, 0.5)
  }

  if (cta) {
    timeline.from(cta, { opacity: 0, y: 16, duration: 0.6, stagger: 0.1 }, 0.62)
  }

  if (visual) {
    timeline.from(
      visual,
      { opacity: 0, scale: 0.92, duration: 1, ease: "power2.out" },
      0.25,
    )
  }

  // 轨道视觉：入场放大，随后交给可被拖拽接管的自转
  if (orbit) {
    gsap.fromTo(
      orbit,
      { scale: 0.82, opacity: 0 },
      {
        scale: 1,
        opacity: 1,
        duration: 1.4,
        ease: "power2.out",
        transformOrigin: "50% 50%",
      },
    )
    gsap.delayedCall(0.6, () => startOrbitSpin(orbit))
  }

  // 首页视觉随指针微幅平移，制造纵深
  if (visual && allowsPointerEffects()) {
    let frame = 0
    let targetX = 0
    let targetY = 0

    const apply = () => {
      frame = 0
      gsap.to(visual, {
        x: targetX,
        y: targetY,
        duration: 0.8,
        ease: "power2.out",
        overwrite: "auto",
      })
    }

    window.addEventListener("pointermove", (event) => {
      const nx = event.clientX / window.innerWidth - 0.5
      const ny = event.clientY / window.innerHeight - 0.5
      targetX = nx * 28
      targetY = ny * 28
      if (!frame) frame = requestAnimationFrame(apply)
    })
  }
}
