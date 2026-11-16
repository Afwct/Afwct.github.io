import { gsap } from "gsap"

const VEIL_ID = "page-veil"

/** 跳转动画的兜底时限：慢网或动画被打断时也必须真的跳走 */
const NAVIGATE_FALLBACK_MS = 1200

function ensureVeil(): HTMLElement {
  let veil = document.getElementById(VEIL_ID)
  if (!veil) {
    veil = document.createElement("div")
    veil.id = VEIL_ID
    veil.className = "page-veil"
    veil.setAttribute("aria-hidden", "true")
    document.body.appendChild(veil)
  }
  return veil
}

/** 只拦截站内普通左键跳转 */
function resolveDestination(
  link: HTMLAnchorElement,
  event: MouseEvent,
): string | null {
  const href = link.getAttribute("href")
  if (!href || href.startsWith("#") || link.target === "_blank") return null
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null

  const destination = new URL(href, window.location.origin)
  if (destination.origin !== window.location.origin) return null
  if (destination.pathname === window.location.pathname) return null

  return destination.pathname + destination.search
}

/**
 * 页面转场（MPA）
 *
 * 退场：内容分层错位 + 遮罩自上而下擦除，然后跳转。
 * 入场：不做「加载即遮挡」（避免无 JS 白屏与首帧闪烁），交由首屏编曲承担。
 */
export function setupPageTransition(): void {
  const veil = ensureVeil()
  let navigating = false

  document
    .querySelectorAll<HTMLAnchorElement>('a[href^="/"]')
    .forEach((link) => {
      link.addEventListener("click", (event) => {
        if (navigating) return

        const destination = resolveDestination(link, event)
        if (!destination) return

        event.preventDefault()

        const go = () => {
          if (navigating) return
          navigating = true
          window.location.href = destination
        }

        const sections = gsap.utils.toArray<HTMLElement>("main > *")

        veil.style.display = "block"
        gsap.set(veil, { clipPath: "inset(0% 0% 100% 0%)" })

        const timeline = gsap.timeline({ onComplete: go })

        if (sections.length) {
          timeline.to(
            sections,
            {
              opacity: 0,
              y: -14,
              duration: 0.3,
              stagger: 0.03,
              ease: "power2.in",
            },
            0,
          )
        }

        timeline.to(
          veil,
          { clipPath: "inset(0% 0% 0% 0%)", duration: 0.5, ease: "power4.inOut" },
          0.05,
        )

        window.setTimeout(go, NAVIGATE_FALLBACK_MS)
      })
    })

  // bfcache 返回：把上一页留下的淡出/遮罩状态复位，否则会白屏
  window.addEventListener("pageshow", (event) => {
    if (!event.persisted) return
    navigating = false
    veil.style.display = "none"
    gsap.set("main", { opacity: 1, y: 0, clearProps: "all" })
    gsap.set("main > *", { opacity: 1, y: 0, clearProps: "all" })
  })
}
