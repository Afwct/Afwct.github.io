import { gsap } from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { SplitText } from "gsap/SplitText"

gsap.registerPlugin(ScrollTrigger, SplitText)

/**
 * 滚动揭示
 *
 * 统一负责：标题逐行遮罩、通用元素揭示（含方向变体）、容器交错、
 * 卡片透视落定、时间线（连线生长 + 子项交错）、分割线。
 *
 * 所有「初始隐藏」都在 JS 里设置，因此禁用 JS 时内容照常可见。
 */

/** 触发点提前到 92%：元素刚露头就开始动，减少"盯着它等"的突兀感 */
const START = "top 92%"

type RevealMode = "up" | "down" | "left" | "right" | "mask" | "scale"

/**
 * 默认揭示用「淡入上浮」而不是裁切揭开。
 *
 * 裁切（clip-path）在整块卡片上会形成一道硬边扫过，观感偏"啪一下"；
 * 淡入 + 轻微上浮与轻微放大更柔和。需要裁切效果的仍可用 data-reveal="mask"。
 */
function fromState(mode: RevealMode): gsap.TweenVars {
  switch (mode) {
    case "mask":
      return { opacity: 0, clipPath: "inset(0% 0% 100% 0%)" }
    case "down":
      return { opacity: 0, y: -24, clipPath: "inset(100% 0% 0% 0%)" }
    case "left":
      return { opacity: 0, x: 32, clipPath: "inset(0% 100% 0% 0%)" }
    case "right":
      return { opacity: 0, x: -32, clipPath: "inset(0% 0% 0% 100%)" }
    case "scale":
      return { opacity: 0, scale: 0.94 }
    case "up":
    default:
      // 无裁切：只做透明度 + 位移 + 极轻微的缩放
      return { opacity: 0, y: 20, scale: 0.995 }
  }
}

function toState(mode: RevealMode): gsap.TweenVars {
  const base: gsap.TweenVars = {
    opacity: 1,
    duration: 1.2,
    // sine.out 起步最软、收尾最缓，配合较长时长不会有"弹出来"的感觉
    ease: "sine.out",
    clearProps: "clipPath",
  }
  if (mode === "scale") return { ...base, scale: 1 }
  return { ...base, x: 0, y: 0, scale: 1 }
}

/** 标题逐行遮罩揭示（配合 .split-line 的 CSS 遮罩容器） */
function setupSplitHeadings(): void {
  gsap.utils.toArray<HTMLElement>("[data-split]").forEach((heading) => {
    let revealed = false

    SplitText.create(heading, {
      type: "lines",
      mask: "lines",
      linesClass: "split-line",
      autoSplit: true,
      onSplit: (self) => {
        // 重新分行（字体加载 / 窗口缩放）时：已揭示过的直接归位，不重播
        if (revealed) {
          gsap.set(self.lines, { yPercent: 0, opacity: 1 })
          return
        }
        return gsap.from(self.lines, {
          yPercent: 100,
          opacity: 0,
          duration: 0.9,
          ease: "expo.out",
          stagger: 0.08,
          scrollTrigger: {
            trigger: heading,
            start: START,
            once: true,
            onEnter: () => {
              revealed = true
            },
          },
        })
      },
    })
  })
}

/** 通用元素揭示 */
function setupElementReveals(): void {
  gsap.utils.toArray<HTMLElement>("[data-animate]").forEach((element) => {
    const mode = (element.dataset.reveal ?? "up") as RevealMode

    gsap.set(element, fromState(mode))
    gsap.to(element, {
      ...toState(mode),
      scrollTrigger: { trigger: element, start: START, once: true },
    })
  })
}

/** 容器内子项成组交错（滚动接近时整组一起进场） */
function setupStaggerGroups(): void {
  gsap.utils.toArray<HTMLElement>("[data-stagger]").forEach((container) => {
    const items = gsap.utils.toArray<HTMLElement>(":scope > *", container)
    if (!items.length) return

    gsap.set(items, { opacity: 0, y: 16 })
    ScrollTrigger.batch(items, {
      start: START,
      once: true,
      onEnter: (batch) =>
        gsap.to(batch, {
          opacity: 1,
          y: 0,
          duration: 1,
          ease: "sine.out",
          stagger: 0.1,
          overwrite: true,
        }),
    })
  })
}

/** 卡片：成组交错 + 透视落定 */
function setupCards(): void {
  const cards = gsap.utils.toArray<HTMLElement>("[data-card]")
  if (!cards.length) return

  gsap.set(cards, {
    opacity: 0,
    y: 24,
    rotateX: 6,
    transformPerspective: 900,
  })

  ScrollTrigger.batch(cards, {
    start: START,
    once: true,
    onEnter: (batch) =>
      gsap.to(batch, {
        opacity: 1,
        y: 0,
        rotateX: 0,
        duration: 1,
        ease: "sine.out",
        stagger: 0.08,
        overwrite: true,
      }),
  })
}

/** 时间线：连线随滚动生长 + 子项交错 */
function setupTimeline(): void {
  gsap.utils.toArray<HTMLElement>("[data-timeline]").forEach((timeline) => {
    gsap.to(timeline, {
      "--timeline-progress": 1,
      ease: "none",
      scrollTrigger: {
        trigger: timeline,
        start: "top 80%",
        end: "bottom 65%",
        scrub: 0.5,
      },
    })

    const items = gsap.utils.toArray<HTMLElement>(
      "[data-timeline-item]",
      timeline,
    )
    if (!items.length) return

    gsap.set(items, { opacity: 0, y: 24 })
    ScrollTrigger.batch(items, {
      start: "top 88%",
      once: true,
      onEnter: (batch) =>
        gsap.to(batch, {
          opacity: 1,
          y: 0,
          duration: 0.7,
          ease: "power3.out",
          stagger: 0.12,
          overwrite: true,
        }),
    })
  })
}

/** 分割线：从左侧展开 */
function setupLines(): void {
  gsap.utils.toArray<HTMLElement>("[data-line]").forEach((line) => {
    gsap.from(line, {
      scaleX: 0,
      transformOrigin: "left center",
      duration: 1,
      ease: "power3.inOut",
      scrollTrigger: { trigger: line, start: "top 88%", once: true },
    })
  })
}

export function setupReveals(): void {
  setupSplitHeadings()
  setupElementReveals()
  setupStaggerGroups()
  setupCards()
  setupTimeline()
  setupLines()
}
