export interface OrderItem {
  name: string
  price: number
  person: string
}

export interface PersonResult {
  person: string
  items: {
    name: string
    originalPrice: number
    discount: number
    actualPrice: number
  }[]
  itemTotal: number
  fixedShare: number
  total: number
}

export interface SplitResult {
  originalTotal: number
  itemsTotal: number
  fixedTotal: number
  discount: number
  actualPay: number
  personResults: PersonResult[]
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * 拼单分摊算法
 *
 * 1. 优惠先抵扣配送费和打包费（固定费用）
 * 2. 优惠 > 固定费用：固定费用全免，剩余优惠按商品原价占比分摊
 * 3. 优惠 <= 固定费用：优惠全用于抵扣固定费用，商品无优惠，剩余固定费用按人数均摊
 * 4. 最终结果保留两位小数
 */
export function calculateSplit(
  items: OrderItem[],
  deliveryFee: number,
  packagingFee: number,
  discount: number,
  includeFixedFees: boolean,
): SplitResult {
  const fixedTotal = includeFixedFees ? deliveryFee + packagingFee : 0
  const itemsTotal = items.reduce((sum, item) => sum + item.price, 0)
  const originalTotal = itemsTotal + fixedTotal
  const actualPay = round(itemsTotal + fixedTotal - discount)

  let remainingFixed: number
  let remainingDiscount: number

  if (discount <= fixedTotal) {
    remainingFixed = fixedTotal - discount
    remainingDiscount = 0
  } else {
    remainingFixed = 0
    remainingDiscount = discount - fixedTotal
  }

  const personMap = new Map<string, PersonResult>()

  for (const item of items) {
    if (!personMap.has(item.person)) {
      personMap.set(item.person, {
        person: item.person,
        items: [],
        itemTotal: 0,
        fixedShare: 0,
        total: 0,
      })
    }

    const personResult = personMap.get(item.person)!

    let itemDiscount = 0
    if (itemsTotal > 0 && remainingDiscount > 0) {
      itemDiscount = remainingDiscount * (item.price / itemsTotal)
    }

    const actualPrice = item.price - itemDiscount

    personResult.items.push({
      name: item.name,
      originalPrice: item.price,
      discount: round(itemDiscount),
      actualPrice: round(actualPrice),
    })

    personResult.itemTotal += actualPrice
  }

  const numPeople = personMap.size
  if (remainingFixed > 0 && numPeople > 0) {
    const fixedPerPerson = remainingFixed / numPeople
    for (const result of personMap.values()) {
      result.fixedShare = round(fixedPerPerson)
    }
  }

  let totalCheck = 0
  const personResults: PersonResult[] = []

  for (const result of personMap.values()) {
    result.itemTotal = round(result.itemTotal)
    result.total = round(result.itemTotal + result.fixedShare)
    totalCheck += result.total
    personResults.push(result)
  }

  const diff = round(actualPay - totalCheck)
  if (diff !== 0 && personResults.length > 0) {
    const lastPerson = personResults[personResults.length - 1]
    lastPerson.total = round(lastPerson.total + diff)
  }

  return {
    originalTotal,
    itemsTotal,
    fixedTotal,
    discount,
    actualPay,
    personResults,
  }
}
