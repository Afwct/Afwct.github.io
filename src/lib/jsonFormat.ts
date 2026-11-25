import { preserveBigInts } from "./cryptoEnvelope"

/**
 * JSON 格式化的输入解析
 *
 * 支持两种输入：
 * - 合法 JSON → 直接解析
 * - JS 对象字面量（未加引号的键、单引号字符串、尾随逗号、注释）→ 先转成 JSON 再解析
 *
 * 这里**刻意不使用 eval / new Function**：页面会引导用户粘贴从控制台、日志里
 * 复制的内容，用求值实现等于把任意代码执行权交给粘贴进来的文本。改用逐字符
 * 状态机做语法转换，只接受「字面量」子集（函数调用、变量、模板串等一律报错）。
 *
 * 另一个约定与站点其它工具一致：超出安全整数范围的数字会先补引号保住原值，
 * 否则 JSON.parse 会把 870273276616777308 悄悄改成 ...300。
 */

export type FormatSource = "json" | "escaped-json" | "js-literal"

export interface FormatSuccess {
  ok: true
  /** 解析后的值 */
  value: unknown
  /** 缩进后的 JSON 文本 */
  json: string
  /** 输入被识别成什么 */
  source: FormatSource
  /** 是否触发了大整数保精度（数字被转成了字符串） */
  precisionProtected: boolean
}

export interface FormatFailure {
  ok: false
  error: string
}

export type FormatResult = FormatSuccess | FormatFailure

/**
 * 把 JS 对象字面量语法转换成 JSON 文本。
 *
 * 只做纯粹的字面量转换：字符串引号、未加引号的键、尾随逗号、注释。
 * 不处理表达式，转换后交给 JSON.parse 兜底报错。
 */
export function jsLiteralToJson(input: string): string {
  let out = ""
  let i = 0
  const length = input.length

  /** 去掉输出末尾（忽略空白）多余的那个逗号 */
  const dropTrailingComma = () => {
    let index = out.length - 1
    while (index >= 0 && /\s/.test(out[index])) index--
    if (index >= 0 && out[index] === ",") {
      out = out.slice(0, index) + out.slice(index + 1)
    }
  }

  while (i < length) {
    const char = input[i]

    // 行注释
    if (char === "/" && input[i + 1] === "/") {
      while (i < length && input[i] !== "\n") i++
      continue
    }

    // 块注释
    if (char === "/" && input[i + 1] === "*") {
      i += 2
      while (i < length && !(input[i] === "*" && input[i + 1] === "/")) i++
      i += 2
      continue
    }

    // 单引号字符串 → 双引号字符串
    if (char === "'") {
      out += '"'
      i++
      while (i < length) {
        const current = input[i]
        if (current === "\\") {
          const next = input[i + 1]
          if (next === "'") {
            out += "'"
            i += 2
            continue
          }
          if (next === '"') {
            out += '\\"'
            i += 2
            continue
          }
          out += current + (next ?? "")
          i += 2
          continue
        }
        if (current === '"') {
          out += '\\"'
          i++
          continue
        }
        if (current === "'") {
          out += '"'
          i++
          break
        }
        out += current
        i++
      }
      continue
    }

    // 双引号字符串原样复制（注意跳过转义）
    if (char === '"') {
      out += char
      i++
      while (i < length) {
        const current = input[i]
        if (current === "\\") {
          out += current + (input[i + 1] ?? "")
          i += 2
          continue
        }
        out += current
        i++
        if (current === '"') break
      }
      continue
    }

    // 标识符：可能是未加引号的键，也可能是 true / false / null
    if (/[A-Za-z_$]/.test(char)) {
      let end = i
      while (end < length && /[\w$]/.test(input[end])) end++
      const word = input.slice(i, end)

      let next = end
      while (next < length && /\s/.test(input[next])) next++

      out += input[next] === ":" ? JSON.stringify(word) : word
      i = end
      continue
    }

    // 闭括号前清理尾随逗号
    if (char === "}" || char === "]") {
      dropTrailingComma()
      out += char
      i++
      continue
    }

    out += char
    i++
  }

  return out
}

/** 转义JSON还原 */
function unescapeJsonText(raw: string): string | null {
  // 没有任何转义序列就不可能是被转义过的文本
  if (!/\\["\\/bfnrtu]/.test(raw)) return null
  try {
    const inner = JSON.parse(`"${raw}"`) as unknown
    return typeof inner === "string" && inner.trim() !== raw.trim()
      ? inner
      : null
  } catch {
    return null
  }
}

function pretty(value: unknown): string {
  return JSON.stringify(value, null, 2) ?? ""
}

/**
 * 解析并格式化输入。
 *
 * 依次尝试：严格 JSON → 被整体转义的 JSON → JS 对象字面量。
 */
export function formatJsonInput(raw: string): FormatResult {
  const text = raw.trim()
  if (!text) return { ok: false, error: "还没有内容" }

  /* ① 严格 JSON */
  const strictText = preserveBigInts(text)
  try {
    const value = JSON.parse(strictText) as unknown
    return {
      ok: true,
      value,
      json: pretty(value),
      source: "json",
      precisionProtected: strictText !== text,
    }
  } catch {
    /* 继续尝试 JS 字面量 */
  }

  /* 被整体转义过的 JSON（{\"a\":1} → {"a":1}） */
  const unescaped = unescapeJsonText(text)
  if (unescaped) {
    const unescapedText = unescaped.trim()
    const unescapedSafe = preserveBigInts(unescapedText)
    try {
      const value = JSON.parse(unescapedSafe) as unknown
      return {
        ok: true,
        value,
        json: pretty(value),
        source: "escaped-json",
        precisionProtected: unescapedSafe !== unescapedText,
      }
    } catch {
      /* 还原后仍不是 JSON，继续尝试对象字面量 */
    }
  }

  /* JS 对象字面量 */
  const converted = jsLiteralToJson(text)
  const convertedSafe = preserveBigInts(converted)
  try {
    const value = JSON.parse(convertedSafe) as unknown
    return {
      ok: true,
      value,
      json: pretty(value),
      source: "js-literal",
      precisionProtected: convertedSafe !== converted,
    }
  } catch (error) {
    // 两种解析都失败时，报严格 JSON 的错误更有参考价值
    let strictMessage = ""
    try {
      JSON.parse(text)
    } catch (strictError) {
      strictMessage =
        strictError instanceof Error ? strictError.message : String(strictError)
    }

    const message =
      strictMessage || (error instanceof Error ? error.message : String(error))
    return {
      ok: false,
      error: `${message}（既不是合法 JSON，也不是可转换的对象字面量）`,
    }
  }
}
