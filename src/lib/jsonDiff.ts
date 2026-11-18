export type DiffKind = "added" | "removed" | "changed"

export interface DiffEntry {
  kind: DiffKind
  /** 形如 $.data.items[0].name */
  path: string
  /** kind 为 added 时不存在 */
  left?: unknown
  /** kind 为 removed 时不存在 */
  right?: unknown
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

const SAFE_KEY = /^[A-Za-z_$][\w$]*$/

/** 拼路径：普通键用点号，含特殊字符的键用方括号加引号 */
export function childPath(base: string, key: string | number): string {
  if (typeof key === "number") return `${base}[${key}]`
  return SAFE_KEY.test(key) ? `${base}.${key}` : `${base}[${JSON.stringify(key)}]`
}

function walk(
  left: unknown,
  right: unknown,
  path: string,
  out: DiffEntry[],
): void {
  // 同一引用或同一原始值：无差异（NaN 不会出现在合法 JSON 里）
  if (left === right) return

  const leftIsArray = Array.isArray(left)
  const rightIsArray = Array.isArray(right)

  if (leftIsArray && rightIsArray) {
    const length = Math.max(left.length, right.length)
    for (let i = 0; i < length; i++) {
      const path2 = childPath(path, i)
      if (i >= left.length) {
        out.push({ kind: "added", path: path2, right: right[i] })
        continue
      }
      if (i >= right.length) {
        out.push({ kind: "removed", path: path2, left: left[i] })
        continue
      }
      walk(left[i], right[i], path2, out)
    }
    return
  }

  if (isPlainObject(left) && isPlainObject(right)) {
    const keys = new Set([...Object.keys(left), ...Object.keys(right)])
    for (const key of keys) {
      const path2 = childPath(path, key)
      const inLeft = Object.prototype.hasOwnProperty.call(left, key)
      const inRight = Object.prototype.hasOwnProperty.call(right, key)

      if (!inLeft) {
        out.push({ kind: "added", path: path2, right: right[key] })
        continue
      }
      if (!inRight) {
        out.push({ kind: "removed", path: path2, left: left[key] })
        continue
      }
      walk(left[key], right[key], path2, out)
    }
    return
  }

  // 标量不同，或类型不同（对象 vs 数组 / 标量 vs 容器）
  out.push({ kind: "changed", path, left, right })
}

/** 对比两份已解析的 JSON */
export function diffJson(left: unknown, right: unknown): DiffEntry[] {
  const entries: DiffEntry[] = []
  walk(left, right, "$", entries)
  return entries
}

export interface DiffSummary {
  total: number
  added: number
  removed: number
  changed: number
}

export function summarizeDiff(entries: DiffEntry[]): DiffSummary {
  return entries.reduce<DiffSummary>(
    (acc, entry) => {
      acc.total += 1
      acc[entry.kind] += 1
      return acc
    },
    { total: 0, added: 0, removed: 0, changed: 0 },
  )
}

/**
 * 把值转成表格里展示的文本。
 *
 * 对象/数组按 2 空格缩进展开，配合单元格的 `white-space: pre-wrap`
 * 直接在表里看全内容；不再截断——截断会让用户看不到真实差异。
 */
export function formatValue(value: unknown): string {
  if (value === undefined) return "(无)"
  if (typeof value === "string") return JSON.stringify(value)
  if (value === null) return "null"
  if (typeof value === "object") {
    return JSON.stringify(value, null, 2) ?? "null"
  }
  return String(value)
}

/** 单条差异的可读文案（不含前缀符号，符号由 UI 决定） */
export function describeDiff(entry: DiffEntry): string {
  switch (entry.kind) {
    case "added":
      return `${entry.path} = ${formatValue(entry.right)}`
    case "removed":
      return `${entry.path} = ${formatValue(entry.left)}`
    case "changed":
    default:
      return `${entry.path}: ${formatValue(entry.left)} → ${formatValue(entry.right)}`
  }
}

/** 导出用的一行式紧凑值：保证每条差异占一行，方便粘贴到聊天/工单 */
function compactValue(value: unknown): string {
  if (value === undefined) return "(无)"
  if (typeof value === "string") return JSON.stringify(value)
  if (value === null) return "null"
  if (typeof value === "object") return JSON.stringify(value) ?? "null"
  return String(value)
}

const TEXT_MARKER: Record<DiffKind, string> = {
  added: "+",
  removed: "-",
  changed: "~",
}

/**
 * 把差异转成可直接粘贴的纯文本（每条一行）。
 *
 * 与表格视图的区别：这里用紧凑 JSON，多行缩进会把"一条一行"打散。
 */
export function toTextDiff(entries: DiffEntry[]): string {
  if (!entries.length) return "两侧 JSON 完全一致"

  const summary = summarizeDiff(entries)
  const lines = [
    `共 ${summary.total} 处差异：新增 ${summary.added} · 缺失 ${summary.removed} · 变更 ${summary.changed}`,
    "",
  ]

  for (const entry of entries) {
    const marker = TEXT_MARKER[entry.kind]
    if (entry.kind === "added") {
      lines.push(`${marker} ${entry.path} = ${compactValue(entry.right)}`)
    } else if (entry.kind === "removed") {
      lines.push(`${marker} ${entry.path} = ${compactValue(entry.left)}`)
    } else {
      lines.push(
        `${marker} ${entry.path}: ${compactValue(entry.left)} → ${compactValue(entry.right)}`,
      )
    }
  }

  return lines.join("\n")
}
