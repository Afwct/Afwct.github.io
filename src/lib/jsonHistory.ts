/**
 * JSON 工具的本地历史记录
 *
 * 全部存在 localStorage 里，只保存用户自己粘贴过的原文，不上传、不跨设备。
 * 任何一步失败（隐私模式禁用存储、配额满、数据损坏）都当作「没有历史」处理，
 * 保证页面功能不因此中断。
 */

const STORAGE_KEY = "afwct:json-history"

/** 最多保留多少条 */
export const HISTORY_LIMIT = 20

/** 单条原文的字符上限：太长的报文没必要整段存，避免把存储配额撑爆 */
const MAX_ENTRY_CHARS = 20000

export interface HistoryEntry {
  /** 用户粘贴的原文 */
  text: string
  /** 记录时间（毫秒时间戳） */
  at: number
}

function isEntry(value: unknown): value is HistoryEntry {
  if (!value || typeof value !== "object") return false
  const entry = value as Partial<HistoryEntry>
  return typeof entry.text === "string" && typeof entry.at === "number"
}

/** 读取历史（最新的在前）；读不到就返回空数组 */
export function loadHistory(): HistoryEntry[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isEntry).slice(0, HISTORY_LIMIT)
  } catch {
    return []
  }
}

function write(entries: HistoryEntry[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {
    /* 配额满或被禁用：静默放弃，不影响主流程 */
  }
}

/**
 * 记录一条历史。
 *
 * - 与最新一条相同则不重复记录
 * - 与更早的某条重复则上移到最前
 * - 超长内容直接跳过
 */
export function pushHistory(text: string): HistoryEntry[] {
  const trimmed = text.trim()
  const current = loadHistory()

  if (!trimmed || trimmed.length > MAX_ENTRY_CHARS) return current
  if (current[0]?.text === trimmed) return current

  const rest = current.filter((entry) => entry.text !== trimmed)
  const next = [{ text: trimmed, at: Date.now() }, ...rest].slice(0, HISTORY_LIMIT)
  write(next)
  return next
}

/** 清空历史 */
export function clearHistory(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* 忽略 */
  }
}
