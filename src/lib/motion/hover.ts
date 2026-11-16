import { gsap } from "gsap"
import { ScrambleTextPlugin } from "gsap/ScrambleTextPlugin"
import { allowsPointerEffects } from "./env"

gsap.registerPlugin(ScrambleTextPlugin)

/**
 * 悬停增强
 *
 * - 卡片：高光扫过 + 悬停上浮 + 指针光斑（光斑与内层视差由 CSS 读取 tilt 写入的 --mx/--my）
 * - 按钮：无磁吸的按钮补上悬停上浮（磁吸会自己动，避免两套抢同一属性）
 * - 链接：文字双轨上滑
 * - 标题：悬停乱码解码
 */

const SCRAMBLE_CHARS = "01<>[]{}/\\_-+="

function setupCardHover(): void {
  gsap.utils.toArray<HTMLElement>("[data-card]").forEach((card) => {
    const shine = document.createElement("span")
    shine.className = "card-shine"
    shine.setAttribute("aria-hidden", "true")
    card.appendChild(shine)

    card.addEventListener("pointerenter", () => {
      gsap.fromTo(
        shine,
        { xPercent: -140 },
        { xPercent: 240, duration: 0.7, ease: "power2.inOut" },
      )
      gsap.to(card, {
        y: -4,
        duration: 0.35,
        ease: "power3.out",
        overwrite: "auto",
      })
    })

    card.addEventListener("pointerleave", () => {
      gsap.to(card, {
        y: 0,
        duration: 0.45,
        ease: "power3.out",
        overwrite: "auto",
      })
    })
  })
}

function setupButtonHover(): void {
  gsap.utils
    .toArray<HTMLElement>(".btn:not([data-magnetic])")
    .forEach((button) => {
      button.addEventListener("pointerenter", () => {
        gsap.to(button, {
          y: -2,
          duration: 0.3,
          ease: "power2.out",
          overwrite: "auto",
        })
      })
      button.addEventListener("pointerleave", () => {
        gsap.to(button, {
          y: 0,
          duration: 0.35,
          ease: "power2.out",
          overwrite: "auto",
        })
      })
    })
}

/** 把文本拆成上下两轨，悬停时原创上滑移出、副本从下滑入 */
function setupTextSwap(): void {
  gsap.utils.toArray<HTMLElement>("[data-swap]").forEach((element) => {
    if (element.querySelector(".swap")) return

    const text = (element.textContent ?? "").trim()
    if (!text) return

    const wrap = document.createElement("span")
    wrap.className = "swap"

    const inner = document.createElement("span")
    inner.className = "swap__in"
    inner.textContent = text

    const outer = document.createElement("span")
    outer.className = "swap__out"
    outer.textContent = text
    outer.setAttribute("aria-hidden", "true")

    wrap.append(inner, outer)
    element.textContent = ""
    element.appendChild(wrap)
  })
}

function setupScramble(): void {
  gsap.utils.toArray<HTMLElement>("[data-scramble]").forEach((element) => {
    const original = element.textContent ?? ""
    if (!original.trim()) return

    let busy = false
    element.addEventListener("pointerenter", () => {
      if (busy) return
      busy = true
      gsap.to(element, {
        duration: 0.6,
        scrambleText: {
          text: original,
          chars: SCRAMBLE_CHARS,
          speed: 0.5,
          revealDelay: 0.1,
        },
        onComplete: () => {
          busy = false
        },
      })
    })
  })
}

export function setupHoverEffects(): void {
  if (!allowsPointerEffects()) return

  setupCardHover()
  setupButtonHover()
  setupTextSwap()
  setupScramble()
}
