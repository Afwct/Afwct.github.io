import { formatJsonInput } from "../lib/jsonFormat"
import {
  diffJson,
  formatValue,
  summarizeDiff,
  type DiffEntry,
} from "../lib/jsonDiff"
import { toast } from "../lib/toast"

function el<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null
}

function show(
  target: HTMLElement | null,
  text: string,
  state: "ok" | "err",
): void {
  if (!target) return
  target.textContent = text
  target.dataset.state = state
  target.hidden = false
}

/** 复制到剪贴板：失败时也给提示，避免点了没反应 */
function copyText(text: string): void {
  const clipboard = navigator.clipboard
  if (!clipboard) {
    toast.error("无法复制", { description: "当前环境不支持剪贴板 API" })
    return
  }
  clipboard
    .writeText(text)
    .then(() => toast.success("已复制到剪贴板"))
    .catch(() =>
      toast.error("复制失败", { description: "浏览器拒绝了剪贴板写入" }),
    )
}

/* ---------------- 格式化 ---------------- */

function initFormatter(): void {
  const inputEl = el<HTMLTextAreaElement>("fmt-input")
  const outputEl = el<HTMLPreElement>("fmt-output")
  const runBtn = el<HTMLButtonElement>("fmt-run")
  const clearBtn = el<HTMLButtonElement>("fmt-clear")
  const copyBtn = el<HTMLButtonElement>("fmt-copy")

  if (!inputEl || !outputEl || !runBtn) return

  /** 当前可复制的格式化结果；为空时复制按钮不可用 */
  let formatted = ""
  const syncCopy = () => {
    if (copyBtn) copyBtn.disabled = !formatted
  }
  syncCopy()

  copyBtn?.addEventListener("click", () => {
    if (!formatted) return
    copyText(formatted)
  })

  runBtn.addEventListener("click", () => {
    const result = formatJsonInput(inputEl.value)

    if (!result.ok) {
      formatted = ""
      syncCopy()
      delete outputEl.dataset.source
      show(outputEl, `格式化失败：${result.error}`, "err")
      toast.error("格式化失败", { description: result.error })
      return
    }

    formatted = result.json
    syncCopy()

    outputEl.dataset.source = result.source
    show(outputEl, result.json, "ok")

    toast.success("格式化完成", {
      description:
        result.source === "js-literal"
          ? "已把对象字面量转换为 JSON"
          : result.precisionProtected
            ? "已保留超范围整数的原值"
            : "已按 2 空格缩进",
    })
  })

  clearBtn?.addEventListener("click", () => {
    inputEl.value = ""
    formatted = ""
    syncCopy()
    delete outputEl.dataset.source
    delete outputEl.dataset.state
    outputEl.textContent = ""
    outputEl.hidden = true
  })
}

/* ---------------- 对比 ---------------- */

/** 差异表格的各处挂载点 */
interface DiffRefs {
  root: HTMLElement
  summary: HTMLElement
  tableWrap: HTMLElement
  body: HTMLElement
  more: HTMLElement
}

const DIFF_LIMIT = 200

const DIFF_MARKER: Record<DiffEntry["kind"], string> = {
  added: "+",
  removed: "−",
  changed: "~",
}

/** 建一个单元格 */
function cell(className: string, text = ""): HTMLTableCellElement {
  const td = document.createElement("td")
  td.className = className
  if (text) {
    td.textContent = text
    td.title = text
  }
  return td
}

/** 把差异渲染成「状态 / 路径 / 左侧 / 右侧」四列表格 */
function renderDiff(refs: DiffRefs, entries: DiffEntry[]): void {
  const summary = summarizeDiff(entries)

  refs.body.textContent = ""
  refs.more.hidden = true
  delete refs.summary.dataset.state

  if (!entries.length) {
    refs.summary.textContent = "两侧 JSON 完全一致"
    refs.tableWrap.hidden = true
    refs.root.hidden = false
    return
  }

  refs.summary.textContent = `共 ${summary.total} 处差异：新增 ${summary.added} · 缺失 ${summary.removed} · 变更 ${summary.changed}`

  const fragment = document.createDocumentFragment()
  for (const entry of entries.slice(0, DIFF_LIMIT)) {
    const row = document.createElement("tr")
    row.className = `diff-row diff-row--${entry.kind}`

    const marker = cell("diff-marker", DIFF_MARKER[entry.kind])
    const pathCell = cell("diff-path", entry.path)

    // 右侧新增时左侧留空，左侧独有时右侧留空 —— 空白本身就是信息
    const leftCell = cell("diff-value diff-value--left")
    const rightCell = cell("diff-value diff-value--right")
    if (entry.kind !== "added") {
      leftCell.textContent = formatValue(entry.left)
      leftCell.title = leftCell.textContent
    }
    if (entry.kind !== "removed") {
      rightCell.textContent = formatValue(entry.right)
      rightCell.title = rightCell.textContent
    }

    row.append(marker, pathCell, leftCell, rightCell)
    fragment.appendChild(row)
  }
  refs.body.appendChild(fragment)

  if (entries.length > DIFF_LIMIT) {
    refs.more.hidden = false
    refs.more.textContent = `… 还有 ${entries.length - DIFF_LIMIT} 处未显示（结果过长，已截断）`
  }

  refs.tableWrap.hidden = false
  refs.root.hidden = false
}

/** 对比失败时只显示一行提示，不显示表格 */
function renderDiffError(refs: DiffRefs, message: string): void {
  refs.body.textContent = ""
  refs.summary.textContent = `无法对比：${message}`
  refs.summary.dataset.state = "err"
  refs.tableWrap.hidden = true
  refs.more.hidden = true
  refs.root.hidden = false
}

function initDiff(): void {
  const leftEl = el<HTMLTextAreaElement>("diff-left")
  const rightEl = el<HTMLTextAreaElement>("diff-right")
  const runBtn = el<HTMLButtonElement>("diff-run")
  const clearBtn = el<HTMLButtonElement>("diff-clear")

  const refs: DiffRefs = {
    root: el<HTMLElement>("diff-output") as HTMLElement,
    summary: el<HTMLElement>("diff-summary") as HTMLElement,
    tableWrap: el<HTMLElement>("diff-table-wrap") as HTMLElement,
    body: el<HTMLElement>("diff-body") as HTMLElement,
    more: el<HTMLElement>("diff-more") as HTMLElement,
  }

  if (
    !leftEl ||
    !rightEl ||
    !runBtn ||
    !refs.root ||
    !refs.summary ||
    !refs.tableWrap ||
    !refs.body ||
    !refs.more
  ) {
    return
  }

  /** 两侧都走同一套解析：JSON 或 JS 对象字面量都能收 */
  const parseSide = (raw: string, side: string): unknown => {
    const result = formatJsonInput(raw)
    if (!result.ok) throw new Error(`${side}：${result.error}`)
    return result.value
  }

  runBtn.addEventListener("click", () => {
    try {
      const left = parseSide(leftEl.value, "左侧")
      const right = parseSide(rightEl.value, "右侧")
      const entries = diffJson(left, right)
      renderDiff(refs, entries)

      const summary = summarizeDiff(entries)
      if (summary.total === 0) {
        toast.success("对比完成", { description: "两侧 JSON 完全一致" })
      } else {
        toast.info("发现差异", {
          description: `共 ${summary.total} 处：新增 ${summary.added} / 缺失 ${summary.removed} / 变更 ${summary.changed}`,
        })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      renderDiffError(refs, message)
      toast.error("对比失败", { description: message })
    }
  })

  clearBtn?.addEventListener("click", () => {
    leftEl.value = ""
    rightEl.value = ""
    refs.body.textContent = ""
    refs.more.hidden = true
    refs.tableWrap.hidden = true
    refs.root.hidden = true
  })
}

initFormatter()
initDiff()
