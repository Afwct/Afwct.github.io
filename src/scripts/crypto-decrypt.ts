import {
  b64ToBytes,
  bytesToB64,
  decryptEnvelope,
  encryptToEnvelope,
  parseEnvelopeText,
  parseJwtInfo,
  prettifyJson,
  preserveBigInts,
  randomSessionKey,
} from "../lib/cryptoEnvelope"
import {
  diffJson,
  formatValue,
  summarizeDiff,
  type DiffEntry,
} from "../lib/jsonDiff"
import { toast } from "../lib/toast"

/**
 * 响应体解密 Demo 的页面交互
 *
 * 三段：解密响应体 / 反向加密自测 / JWT 解析算 Redis 键名。
 * 纯逻辑都在 lib/cryptoEnvelope.ts，这里只负责取 DOM、拼展示文本。
 */

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

const SAMPLE_PLAIN =
  '{"code":200,"message":"操作成功","data":{"orderId":"A20260916","items":[{"name":"阿莫西林胶囊","qty":2}],"total":36.5}}'

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

const DECRYPT_FAIL_HINTS = [
  "",
  "常见原因：",
  "  1. 会话密钥不对（换过 token / 该 sk 属于另一个 bizToken）",
  "  2. iv 或 tag 拼接顺序被改动 —— 密文被篡改或不是本系统产生的",
  "  3. 粘贴的 sk 是 base64 原文还是已解码的原始字节，二者不同",
  "  4. Redis 里 CRYPTO:SK 已过期（默认 TTL 600 分钟）",
].join("\n")

const BIGINT_NOTE = [
  "",
  "",
  "// 注意：上面带引号的整数原本是无引号的 JSON 数字，",
  "// 它们超出 JS 安全整数范围（2^53-1），若交给 JSON.parse 会末位失真。",
  "// 本页为保住原值已把它们显示为字符串，实际密文里的数字是准确的。",
].join("\n")

function initDecrypt(): void {
  const envelopeEl = el<HTMLTextAreaElement>("crypto-envelope")
  const keyEl = el<HTMLInputElement>("crypto-key")
  const outputEl = el<HTMLPreElement>("crypto-output")
  const decryptBtn = el<HTMLButtonElement>("crypto-decrypt")
  const clearBtn = el<HTMLButtonElement>("crypto-clear")
  const sampleBtn = el<HTMLButtonElement>("crypto-sample")
  const copyBtn = el<HTMLButtonElement>("crypto-copy")
  const cryptoOutput = el<HTMLPreElement>("crypto-output")

  if (!envelopeEl || !keyEl || !outputEl || !decryptBtn) return

  /** 当前可复制的明文；为空时复制按钮不可用 */
  let lastPlain = ""
  const syncCopyState = () => {
    if (copyBtn) copyBtn.disabled = !lastPlain
  }
  syncCopyState()

  copyBtn?.addEventListener("click", () => {
    if (!lastPlain) return
    copyText(lastPlain)
  })

  decryptBtn.addEventListener("click", async () => {
    decryptBtn.disabled = true
    try {
      const envelope = parseEnvelopeText(envelopeEl.value)
      const keyBytes = b64ToBytes(keyEl.value)
      const plain = await decryptEnvelope(envelope, keyBytes)
      const result = prettifyJson(plain)
      show(
        outputEl,
        result.text + (result.quotedBigInts ? BIGINT_NOTE : ""),
        "ok",
      )
      lastPlain = result.text
      syncCopyState()
      toast.success("解密成功", {
        description: result.quotedBigInts
          ? "超范围整数已按原值保留，未丢精度"
          : "明文已解码并格式化",
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      show(outputEl, `解密失败：${message}${DECRYPT_FAIL_HINTS}`, "err")
      // 解密失败后旧结果已不可信，一并禁用复制
      lastPlain = ""
      syncCopyState()
      toast.error("解密失败", { description: message })
    } finally {
      decryptBtn.disabled = false
    }
  })

  cryptoOutput?.addEventListener("click", (e) => {
    console.log(e.target)
  })

  clearBtn?.addEventListener("click", () => {
    envelopeEl.value = ""
    keyEl.value = ""
    outputEl.hidden = true
    lastPlain = ""
    syncCopyState()
  })

  // 现造一份密文塞进输入框，省得联调时手工找样例
  sampleBtn?.addEventListener("click", async () => {
    const keyBytes = randomSessionKey()
    const envelope = await encryptToEnvelope(SAMPLE_PLAIN, keyBytes)
    envelopeEl.value = JSON.stringify(envelope)
    keyEl.value = bytesToB64(keyBytes)
    outputEl.hidden = true
    lastPlain = ""
    syncCopyState()
    toast.info("已填入自测样例", {
      description: "密文与密钥已配对，直接点「解密」即可往返验证",
    })
  })
}

function initEncrypt(): void {
  const plainEl = el<HTMLTextAreaElement>("crypto-plain")
  const keyEl = el<HTMLInputElement>("crypto-key2")
  const outputEl = el<HTMLPreElement>("crypto-output2")
  const encryptBtn = el<HTMLButtonElement>("crypto-encrypt")

  if (!plainEl || !keyEl || !outputEl || !encryptBtn) return

  encryptBtn.addEventListener("click", async () => {
    encryptBtn.disabled = true
    try {
      const text = plainEl.value.trim()
      if (!text) throw new Error("请先填明文 JSON")
      JSON.parse(text) // 校验通过才继续，非 JSON 文本会被 catch 报错拦住

      const typed = keyEl.value.trim()
      const generated = !typed
      const keyBytes = generated ? randomSessionKey() : b64ToBytes(typed)
      const envelope = await encryptToEnvelope(text, keyBytes)

      const json = JSON.stringify(envelope, null, 2)
      show(
        outputEl,
        generated
          ? `本次随机生成的会话密钥 sk(base64)：\n${bytesToB64(keyBytes)}\n\n信封（可直接粘到上面「解密响应体」验证往返）：\n${json}`
          : json,
        "ok",
      )
      toast.success("加密完成", {
        description: generated
          ? "已随机生成一把 32 字节会话密钥"
          : "已按 iv / tag / data 拆分为信封",
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      show(outputEl, `加密失败：${message}`, "err")
      toast.error("加密失败", { description: message })
    } finally {
      encryptBtn.disabled = false
    }
  })
}

function initJwt(): void {
  const jwtEl = el<HTMLInputElement>("crypto-jwt")
  const outputEl = el<HTMLPreElement>("crypto-output3")
  const jwtBtn = el<HTMLButtonElement>("crypto-jwt-parse")

  if (!jwtEl || !outputEl || !jwtBtn) return

  jwtBtn.addEventListener("click", () => {
    try {
      const info = parseJwtInfo(jwtEl.value)
      const lines = ["JWT payload：", JSON.stringify(info.payload, null, 2), ""]

      if (info.redisKey) {
        lines.push("会话密钥 Redis 键：", `  ${info.redisKey}`, "")
        lines.push("取值命令：", `  ${info.redisCommand}`)
      } else {
        lines.push(
          "payload 里没有 bizToken claim —— 可能不是本系统的业务 token，",
        )
        lines.push("或该请求走的是未认证通道（无会话密钥，响应本就是明文）。")
      }

      if (info.expiresAt !== null) {
        lines.push(
          "",
          `exp：${new Date(info.expiresAt).toLocaleString()}${info.expired ? "（已过期）" : ""}`,
        )
      }
      show(outputEl, lines.join("\n"), "ok")
      toast.success("解析成功", {
        description: info.redisKey
          ? `Redis 键：${info.redisKey}`
          : "payload 里没有 bizToken，可能不是本系统 token",
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      show(outputEl, `解析失败：${message}`, "err")
      toast.error("解析失败", { description: message })
    }
  })
}

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
    const path = cell("diff-path", entry.path)

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

    row.append(marker, path, leftCell, rightCell)
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

  const parseSide = (raw: string, side: string): unknown => {
    const text = raw.trim()
    if (!text) throw new Error(`${side}还没有内容`)
    try {
      // 与页面其余部分一致：先给超范围整数补引号，避免末位被改掉造成假差异
      return JSON.parse(preserveBigInts(text))
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(`${side}不是合法 JSON：${message}`)
    }
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

function checkCryptoSupport(): void {
  const banner = el<HTMLDivElement>("crypto-env-banner")
  if (!banner) return

  if (!window.crypto?.subtle) {
    banner.hidden = false
    banner.textContent =
      "当前环境不提供 Web Crypto（crypto.subtle）。请用 Chrome / Edge / Firefox，并通过 https 或 localhost 访问本页。"
  }
}

initDecrypt()
initEncrypt()
initJwt()
initDiff()
checkCryptoSupport()
