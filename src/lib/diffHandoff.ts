/**
 * 跨页交接：响应体解密 → JSON 对比的「左侧」输入
 *
 * 两个页面脚本各在一侧，靠 sessionStorage 传一次性数据：
 * - 数据不会进 URL（避免超长地址与被历史记录/日志留存）
 * - 取一次即清除，所以只在"刚点过去"的那一次生效，刷新后不会再冒出来
 * - 隐私模式等场景下 sessionStorage 可能抛错，全部吞掉，不影响原有功能
 */

const KEY = "afwct:json-diff-left"

/** 保存待带入的左侧 JSON；传空字符串表示本次没有可带的解密结果 */
export function stashDiffLeft(text: string): void {
  try {
    if (text) sessionStorage.setItem(KEY, text)
    else sessionStorage.removeItem(KEY)
  } catch {
    /* 存储不可用时静默降级：用户仍可手动粘贴 */
  }
}

/** 取出并立即清除；没有则返回 null */
export function takeDiffLeft(): string | null {
  try {
    const value = sessionStorage.getItem(KEY)
    if (value !== null) sessionStorage.removeItem(KEY)
    return value
  } catch {
    return null
  }
}
