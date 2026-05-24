import { gsap } from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

gsap.registerPlugin(ScrollTrigger)

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

function revealOnScroll(
  selector: string,
  options?: { stagger?: number; start?: string },
) {
  const { stagger = 0, start = "top 88%" } = options ?? {}
  const elements = gsap.utils.toArray<HTMLElement>(selector)
  if (!elements.length) return

  elements.forEach((el) => {
    const targets =
      stagger > 0
        ? gsap.utils.toArray<HTMLElement>(
            el.querySelectorAll("[data-timeline-item]"),
          )
        : [el]
    if (!targets.length) return

    gsap.set(targets, { opacity: 0, y: 24 })

    gsap.to(targets, {
      opacity: 1,
      y: 0,
      duration: 0.8,
      stagger,
      ease: "power2.out",
      scrollTrigger: {
        trigger: el,
        start,
        once: true,
      },
    })
  })
}

function initHeader() {
  const header = document.querySelector<HTMLElement>("[data-header]")
  if (!header) return

  ScrollTrigger.create({
    start: "top -80",
    onUpdate: (self) => {
      header.classList.toggle("is-scrolled", self.scroll() > 40)
    },
  })

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

function initHero() {
  const tl = gsap.timeline({ defaults: { ease: "power3.out" } })

  tl.from("[data-hero-eyebrow]", { opacity: 0, y: 20, duration: 0.6 })
    .from(
      "[data-hero-title]",
      { opacity: 0, y: 48, duration: 0.9, skewY: 2 },
      "-=0.35",
    )
    .from("[data-hero-subtitle]", { opacity: 0, y: 24, duration: 0.7 }, "-=0.5")
    .from(
      "[data-hero-cta]",
      { opacity: 0, y: 16, duration: 0.5, stagger: 0.1 },
      "-=0.4",
    )
    .from(
      "[data-hero-visual]",
      { opacity: 0, scale: 0.92, duration: 1 },
      "-=0.8",
    )
}

function initHomeExtras() {
  gsap.to("[data-orbit]", {
    rotation: 360,
    duration: 24,
    repeat: -1,
    ease: "none",
    transformOrigin: "50% 50%",
  })

  gsap.from("[data-stat]", {
    opacity: 0,
    y: 24,
    duration: 0.6,
    stagger: 0.12,
    scrollTrigger: {
      trigger: "[data-stats]",
      start: "top 85%",
      once: true,
    },
  })
}

function initScrollAnimations() {
  revealOnScroll("[data-animate]")
  revealOnScroll("[data-timeline]", { stagger: 0.12, start: "top 85%" })

  gsap.utils.toArray<HTMLElement>("[data-card]").forEach((card, i) => {
    gsap.set(card, { opacity: 0, y: 40 })
    gsap.to(card, {
      opacity: 1,
      y: 0,
      duration: 0.7,
      delay: (i % 3) * 0.08,
      ease: "power2.out",
      scrollTrigger: {
        trigger: card,
        start: "top 90%",
        once: true,
      },
    })
  })

  gsap.utils.toArray<HTMLElement>("[data-line]").forEach((line) => {
    gsap.from(line, {
      scaleX: 0,
      transformOrigin: "left center",
      duration: 0.8,
      ease: "power2.inOut",
      scrollTrigger: {
        trigger: line,
        start: "top 85%",
        once: true,
      },
    })
  })
}

function initPageTransition() {
  document
    .querySelectorAll<HTMLAnchorElement>('a[href^="/"]')
    .forEach((link) => {
      link.addEventListener("click", (e) => {
        const url = link.getAttribute("href")
        if (!url || url.startsWith("#") || link.target === "_blank") return
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return

        const dest = new URL(url, window.location.origin)
        if (dest.origin !== window.location.origin) return
        if (dest.pathname === window.location.pathname) return

        e.preventDefault()
        gsap.to("main", {
          opacity: 0,
          y: -12,
          duration: 0.25,
          ease: "power2.in",
          onComplete: () => {
            window.location.href = dest.pathname + dest.search
          },
        })
      })
    })

  gsap.from("main", {
    opacity: 0,
    y: 16,
    duration: 0.45,
    ease: "power2.out",
    delay: 0.05,
  })
}

function init() {
  if (prefersReducedMotion()) {
    gsap.set(
      "[data-animate], [data-card], [data-timeline-item], [data-hero-title], [data-hero-subtitle]",
      {
        opacity: 1,
        y: 0,
        clearProps: "all",
      },
    )
    return
  }

  initHeader()
  initHero()
  initScrollAnimations()
  initPageTransition()

  if (document.querySelector("[data-home]")) {
    initHomeExtras()
  }

  ScrollTrigger.refresh()
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init)
} else {
  init()
}
