/**
 * 响应体解密（AES-256-GCM 信封）核心逻辑
 *
 * 后端把密文拆成 data（密文）与 tag（16 字节认证标签）两段分别 base64，
 * 而 WebCrypto 要求输入是「密文 || tag」拼接后的连续字节 —— 顺序拼反会直接抛
 * OperationError。本模块把拼接/切分、精度保护等易踩的坑收在一处，页面脚本只负责交互。
 */

/** 传输信封：三个字段均为 base64 字符串 */
export interface CryptoEnvelope {
  /** 初始化向量，12 字节（GCM 推荐长度） */
  iv: string
  /** 认证标签，16 字节（tagLength 128） */
  tag: string
  /** 密文本体（不含 tag） */
  data: string
}

/**
 * 字节数组类型：显式指定由 ArrayBuffer 支撑。
 *
 * TS 5.7 起 `Uint8Array` 带上了 buffer 泛型，裸写 `Uint8Array` 会退化成
 * `Uint8Array<ArrayBufferLike>`——它把 `SharedArrayBuffer` 也算在内，
 * 于是无法赋给 WebCrypto 要求的 `BufferSource`（即 `ArrayBufferView<ArrayBuffer>`），
 * 报错就是那句 "Type 'SharedArrayBuffer' is not assignable to type 'ArrayBuffer'"。
 * 本模块产出的字节一律来自 `new Uint8Array(n)` / `getRandomValues`，必然是
 * ArrayBuffer 支撑，故在源头把类型钉死，避免每处调用点各写一个断言。
 */
export type Bytes = Uint8Array<ArrayBuffer>

/** 会话密钥：AES-256 要求 32 字节（base64 解码后） */
export const AES_KEY_BYTES = 32
export const GCM_IV_BYTES = 12
export const GCM_TAG_BYTES = 16

/* ---------- base64 基础工具 ---------- */

/**
 * base64 / base64url（含无填充、含空白）→ Bytes
 *
 * 兼容 Redis 里取了带换行的值，以及 JWT 那种 URL-safe、去掉了 `=` 填充的变体。
 */
export function b64ToBytes(input: string): Bytes {
  let text = String(input)
    .trim()
    .replace(/\s+/g, "")
    .replace(/-/g, "+")
    .replace(/_/g, "/")

  if (!text) throw new Error("base64 为空")
  while (text.length % 4) text += "="

  let binary: string
  try {
    binary = atob(text)
  } catch {
    throw new Error(`不是合法的 base64：${String(input).slice(0, 24)}...`)
  }

  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export function bytesToB64(bytes: Uint8Array): string {
  let binary = ""
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

const utf8Encoder = new TextEncoder()
const utf8Decoder = new TextDecoder("utf-8")

/* ---------- AES-256-GCM ---------- */

/** 导入会话密钥，顺带把「字节数不对」这个最高频的联调事故挡在前面 */
export async function importSessionKey(rawBytes: Bytes): Promise<CryptoKey> {
  if (rawBytes.length !== AES_KEY_BYTES) {
    throw new Error(
      `会话密钥必须是 ${AES_KEY_BYTES} 字节（AES-256），实际 ${rawBytes.length} 字节，检查是否粘贴错值`,
    )
  }
  return crypto.subtle.importKey("raw", rawBytes, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ])
}

/**
 * 解密响应信封。
 *
 * WebCrypto 期望的输入是「密文 || tag」的连续字节，所以这里要把两段拼回去；
 * 反过来 encryptToEnvelope 里则要把 WebCrypto 输出的尾巴切下 16 字节当 tag。
 */
export async function decryptEnvelope(
  envelope: CryptoEnvelope,
  keyBytes: Bytes,
): Promise<string> {
  if (!envelope || !envelope.iv || !envelope.data || !envelope.tag) {
    throw new Error("信封缺少字段，必须有 iv / tag / data 三个 base64 字段")
  }

  const iv = b64ToBytes(envelope.iv)
  const data = b64ToBytes(envelope.data)
  const tag = b64ToBytes(envelope.tag)

  if (iv.length !== GCM_IV_BYTES) {
    throw new Error(`iv 应为 ${GCM_IV_BYTES} 字节，实际 ${iv.length}`)
  }
  if (tag.length !== GCM_TAG_BYTES) {
    throw new Error(`tag 应为 ${GCM_TAG_BYTES} 字节，实际 ${tag.length}`)
  }

  const sealed = new Uint8Array(data.length + tag.length)
  sealed.set(data, 0)
  sealed.set(tag, data.length)

  const key = await importSessionKey(keyBytes)
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv, tagLength: 128 },
    key,
    sealed,
  )
  return utf8Decoder.decode(plain)
}

/** 加密为信封，对齐后端 CryptoService.encryptToEnvelope，用于联调自测往返 */
export async function encryptToEnvelope(
  plainText: string,
  keyBytes: Bytes,
): Promise<CryptoEnvelope> {
  const iv = crypto.getRandomValues(new Uint8Array(GCM_IV_BYTES))
  const key = await importSessionKey(keyBytes)

  const sealed = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv, tagLength: 128 },
      key,
      utf8Encoder.encode(plainText),
    ),
  )

  const cut = sealed.length - GCM_TAG_BYTES
  return {
    iv: bytesToB64(iv),
    tag: bytesToB64(sealed.slice(cut)),
    data: bytesToB64(sealed.slice(0, cut)),
  }
}

/** 随机生成一把 32 字节会话密钥，用于反向加密自测 */
export function randomSessionKey(): Bytes {
  return crypto.getRandomValues(new Uint8Array(AES_KEY_BYTES))
}

/* ---------- 粘贴内容解析 ---------- */

/** 宽松解析粘贴进来的 body：先按 JSON 解析，失败则尝试夹在文本里提取对象 */
export function parseEnvelopeText(text: string): CryptoEnvelope {
  const trimmed = text.trim()
  if (!trimmed) throw new Error("请先粘贴响应密文")

  try {
    return JSON.parse(trimmed) as CryptoEnvelope
  } catch {
    /* 继续尝试宽松提取 */
  }

  const matched = trimmed.match(/\{[\s\S]*\}/)
  if (matched) {
    try {
      return JSON.parse(matched[0]) as CryptoEnvelope
    } catch {
      /* 落到下面统一报错 */
    }
  }
  throw new Error("无法解析为 JSON，请确认粘的是完整响应体")
}

/* ---------- 大整数精度保护 ---------- */

/**
 * 判断一串纯数字（无符号、无前导零）是否超出 JS 安全整数范围。
 *
 * 必须用字符串比较而不是 Number()：Number() 本身就会先丢精度，
 * 拿它来判「有没有丢精度」等于让被告当法官。18 位的雪花 id 只有这样比才准。
 */
export function exceedsSafeRange(digits: string): boolean {
  const MAX_SAFE = "9007199254740991" // 2^53 - 1
  if (digits.length !== MAX_SAFE.length) return digits.length > MAX_SAFE.length
  return digits > MAX_SAFE // 等长时字典序即数值序
}

/**
 * 把 JSON 文本里超出安全范围的整数字面量就地加上引号，其余字节原样保留。
 *
 * 只在字符串字面量之外扫描，避免误伤正文里形如 "id":"123" 的内容。
 */
export function preserveBigInts(jsonText: string): string {
  let out = ""
  let i = 0
  const n = jsonText.length

  while (i < n) {
    const ch = jsonText[i]

    // 字符串字面量：整段照抄，识别转义以免提前收尾
    if (ch === '"') {
      out += ch
      i++
      while (i < n) {
        const c = jsonText[i]
        if (c === "\\") {
          out += c + (jsonText[i + 1] || "")
          i += 2
          continue
        }
        out += c
        i++
        if (c === '"') break
      }
      continue
    }

    // 数字字面量：向后吃掉完整 token 再判断
    if (ch === "-" || (ch >= "0" && ch <= "9")) {
      let j = i + 1
      while (j < n && /[0-9eE+\-.]/.test(jsonText[j])) j++
      const token = jsonText.slice(i, j)
      const isInteger = /^-?\d+$/.test(token)

      if (isInteger) {
        const digits = token.replace(/^-/, "").replace(/^0+(?=\d)/, "")
        if (exceedsSafeRange(digits)) {
          out += `"${token}"`
          i = j
          continue
        }
      }
      out += token
      i = j
      continue
    }

    out += ch
    i++
  }
  return out
}

export interface PrettifyResult {
  text: string
  /** 是否真的给超范围整数补了引号（用于提示用户精度被保住了） */
  quotedBigInts: boolean
}

/**
 * 解密结果美化：先给超长整数加引号保住精度，再解析缩进。
 *
 * 直接 JSON.parse 会把 870273276616777308 变成 ...300，且不可逆。
 */
export function prettifyJson(text: string): PrettifyResult {
  try {
    const safe = preserveBigInts(text)
    const pretty = JSON.stringify(JSON.parse(safe), null, 2)
    return { text: pretty, quotedBigInts: safe !== text }
  } catch {
    return { text, quotedBigInts: false }
  }
}

/* ---------- JWT ---------- */

export interface JwtInfo {
  payload: Record<string, unknown>
  /** 会话密钥的 Redis 键名，payload 里没有 bizToken 时为 null */
  redisKey: string | null
  /** redis-cli 取密钥命令 */
  redisCommand: string | null
  /** exp 声明的毫秒时间戳 */
  expiresAt: number | null
  expired: boolean
}

/** 解析 JWT 的 payload（不校验签名，只用于算出 Redis 键名） */
export function parseJwtInfo(rawJwt: string): JwtInfo {
  const jwt = rawJwt.trim().replace(/^Bearer\s+/i, "")
  const parts = jwt.split(".")
  if (parts.length < 2) {
    throw new Error("不是合法 JWT（应为 header.payload.signature 三段）")
  }

  const payload = JSON.parse(utf8Decoder.decode(b64ToBytes(parts[1]))) as Record<
    string,
    unknown
  >

  const bizToken = typeof payload.bizToken === "string" ? payload.bizToken : null
  const exp = typeof payload.exp === "number" ? payload.exp : null

  return {
    payload,
    redisKey: bizToken ? `CRYPTO:SK:${bizToken}` : null,
    redisCommand: bizToken ? `redis-cli GET "CRYPTO:SK:${bizToken}"` : null,
    expiresAt: exp === null ? null : exp * 1000,
    expired: exp === null ? false : Date.now() > exp * 1000,
  }
}
