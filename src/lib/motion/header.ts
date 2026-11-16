import { gsap } from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { isCompact } from "./env"

gsap.registerPlugin(ScrollTrigger)

/**
 * 顶栏
 *
 * 注意：滚动态背景属于**功能性**行为（影响可读性），因此在减弱动效时也必须生效，
 * 只有入场与滚动收放这类装饰性动作才会被跳过。
 */
export function setupHeader(options: { animate: boolean }): void {
  const header = document.querySelector<HTMLElement>("[data-header]")
  if (!header) return

  ScrollTrigger.create({
    start: 0,
    end: "max",
    onUpdate: (self) => {
      header.classList.toggle("is-scrolled", self.scroll() > 40)
    },
  })

  if (!options.animate) return

  // 向下滚动收起顶栏，向上滚动立刻回来（窄屏不启用，避免误触）
  if (!isCompact()) {
    let lastY = window.scrollY

    ScrollTrigger.create({
      start: 0,
      end: "max",
      onUpdate: () => {
        const y = window.scrollY
        if (y > 160 && y > lastY) header.classList.add("is-hidden")
        else header.classList.remove("is-hidden")
        lastY = y
      },
    })
  }

  gsap.from("[data-logo]", {
    opacity: 0,
    x: -16,
    duration: 0.7,
    ease: "power3.out",
  })

  gsap.from("[data-nav-link]", {
    opacity: 0,
    y: -8,
    duration: 0.5,
    stagger: 0.06,
    delay: 0.15,
    ease: "power2.out",
  })
}

/**
 * 导航指示器
 *
 * 用一个滑动色条替代原先每个链接各自的 ::after 下划线，
 * 悬停时滑向目标项，移开回到当前页对应的项。
 */
export function setupNavIndicator(): void {
  const nav = document.querySelector<HTMLElement>(".nav")
  const list = document.querySelector<HTMLElement>(".nav__list")
  const indicator = document.querySelector<HTMLElement>(".nav__indicator")
  if (!nav || !list || !indicator) return

  const links = gsap.utils.toArray<HTMLAnchorElement>("[data-nav-link]", list)
  if (!links.length) return

  const active =
    links.find((link) => link.classList.contains("nav__link--active")) ??
    links[0]

  // 指示器是 .nav 的绝对定位子元素，故以 .nav 为坐标参照
  const moveTo = (link: HTMLAnchorElement, animated = true) => {
    const navRect = nav.getBoundingClientRect()
    const rect = link.getBoundingClientRect()
    if (!rect.width) return

    const vars = { x: rect.left - navRect.left, width: rect.width }
    if (animated) {
      gsap.to(indicator, { ...vars, duration: 0.35, ease: "power3.out" })
    } else {
      gsap.set(indicator, vars)
    }
    indicator.style.opacity = "1"
  }

  moveTo(active, false)

  links.forEach((link) => {
    link.addEventListener("pointerenter", () => moveTo(link))
    link.addEventListener("focus", () => moveTo(link))
  })

  list.addEventListener("pointerleave", () => moveTo(active))

  let resizeFrame = 0
  window.addEventListener("resize", () => {
    if (resizeFrame) return
    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = 0
      moveTo(active, false)
    })
  })
}

/** 顶部阅读进度条 */
export function setupScrollProgress(): void {
  if (document.querySelector(".scroll-progress")) return

  const bar = document.createElement("div")
  bar.className = "scroll-progress"
  bar.setAttribute("aria-hidden", "true")
  document.body.appendChild(bar)

  gsap.fromTo(
    bar,
    { scaleX: 0 },
    {
      scaleX: 1,
      ease: "none",
      scrollTrigger: {
        trigger: document.body,
        start: "top top",
        end: "bottom bottom",
        scrub: 0.3,
      },
    },
  )
}
