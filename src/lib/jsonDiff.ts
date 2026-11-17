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

/** 把值转成适合单行展示的文本 */
export function formatValue(value: unknown): string {
  if (value === undefined) return "(无)"
  if (typeof value === "string") return JSON.stringify(value)
  if (typeof value === "object" && value !== null) {
    const json = JSON.stringify(value)
    return json.length > 60 ? `${json.slice(0, 57)}…` : json
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
