import { createHeroModel } from "../lib/model/heroModel"

/**
 * 首页 Zdog 模型启动器
 *
 * 只挂在 index.astro 上，因此 zdog 只进首页的独立 chunk，其它页面不受影响。
 *
 * 模型是**静态**的：不自转，平时不跑 rAF；只有用户拖拽时才临时开启渲染循环。
 * 页面里先有一张静态 SVG 兜底（/hero-model.svg），画布真正画出内容后才标记 ready。
 */

const STATE_ATTR = "data-model-state"

function init(): void {
  const canvas = document.querySelector<HTMLCanvasElement>("[data-hero-model]")
  if (!canvas) return

  const host = canvas.parentElement

  try {
    const handle = createHeroModel(canvas)

    if (handle.active && canvas.width > 1 && canvas.height > 1) {
      host?.setAttribute(STATE_ATTR, "ready")
    } else {
      host?.setAttribute(STATE_ATTR, "fallback")
      console.warn("[hero-model] 画布不可用，保留静态 SVG")
    }

    // 滚出视口 / 切到后台时停掉可能存在的渲染循环
    const observer =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(
            (entries) => {
              for (const entry of entries) handle.setPaused(!entry.isIntersecting)
            },
            { threshold: 0 },
          )
        : null
    observer?.observe(canvas)

    document.addEventListener("visibilitychange", () => {
      handle.setPaused(document.hidden)
    })
  } catch (error) {
    host?.setAttribute(STATE_ATTR, "fallback")
    console.error("[hero-model] 初始化失败，保留静态 SVG：", error)
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init)
} else {
  init()
}
