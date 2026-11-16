import {
  b64ToBytes,
  bytesToB64,
  decryptEnvelope,
  encryptToEnvelope,
  parseEnvelopeText,
  parseJwtInfo,
  prettifyJson,
  randomSessionKey,
} from "../lib/cryptoEnvelope"
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
  const cryptoOutput = el<HTMLPreElement>("crypto-output")

  if (!envelopeEl || !keyEl || !outputEl || !decryptBtn) return

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
      toast.success("解密成功", {
        description: result.quotedBigInts
          ? "超范围整数已按原值保留，未丢精度"
          : "明文已解码并格式化",
        action: {
          label: "复制明文",
          onClick: () => copyText(result.text),
        },
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      show(outputEl, `解密失败：${message}${DECRYPT_FAIL_HINTS}`, "err")
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
  })

  // 现造一份密文塞进输入框，省得联调时手工找样例
  sampleBtn?.addEventListener("click", async () => {
    const keyBytes = randomSessionKey()
    const envelope = await encryptToEnvelope(SAMPLE_PLAIN, keyBytes)
    envelopeEl.value = JSON.stringify(envelope)
    keyEl.value = bytesToB64(keyBytes)
    outputEl.hidden = true
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
checkCryptoSupport()
