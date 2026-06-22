import { calculateSplit } from "../lib/calculateSplit"

const PERSON_COLORS = [
  "#6ee7b7",
  "#fbbf24",
  "#60a5fa",
  "#f472b6",
  "#a78bfa",
  "#fb923c",
] as const

function formatMoney(value: number): string {
  return value.toFixed(2)
}

function createItemRow(
  name = "",
  price = "",
  person = "",
): HTMLTableRowElement {
  const row = document.createElement("tr")
  row.innerHTML = `
    <td><input type="text" class="split-input" data-field="name" placeholder="商品名" value="${name}" /></td>
    <td><input type="number" class="split-input" data-field="price" placeholder="0.00" min="0" step="0.01" value="${price}" /></td>
    <td><input type="text" class="split-input" data-field="person" placeholder="归属人" value="${person}" /></td>
    <td><button type="button" class="split-btn split-btn--ghost split-btn--sm" data-remove>删除</button></td>
  `
  return row
}

function initSplitCalculator() {
  const form = document.getElementById("split-form")
  const itemsBody = document.getElementById("split-items-body")
  const addBtn = document.getElementById("split-add-item")
  const resultsEl = document.getElementById("split-results")
  const summaryEl = document.getElementById("split-summary")
  const includeFixedFeesEl = document.getElementById("include-fixed-fees") as HTMLInputElement | null
  const fixedFeesFieldsEl = document.getElementById("fixed-fees-fields")

  if (!form || !itemsBody || !addBtn || !resultsEl || !summaryEl) return

  function syncFixedFeesVisibility() {
    if (!includeFixedFeesEl || !fixedFeesFieldsEl) return
    fixedFeesFieldsEl.hidden = !includeFixedFeesEl.checked
  }

  includeFixedFeesEl?.addEventListener("change", syncFixedFeesVisibility)
  syncFixedFeesVisibility()

  const defaultRows: [string, string, string][] = [
    ["奶茶", "18", "小明"],
    ["炸鸡", "32", "小红"],
    ["薯条", "12", "小明"],
  ]

  for (const [name, price, person] of defaultRows) {
    itemsBody.appendChild(createItemRow(name, price, person))
  }

  addBtn.addEventListener("click", () => {
    itemsBody.appendChild(createItemRow())
  })

  itemsBody.addEventListener("click", (e) => {
    const target = e.target as HTMLElement
    if (!target.matches("[data-remove]")) return
    const row = target.closest("tr")
    if (row && itemsBody.children.length > 1) {
      row.remove()
    }
  })

  form.addEventListener("submit", (e) => {
    e.preventDefault()

    const rows = itemsBody.querySelectorAll("tr")
    const items = Array.from(rows)
      .map((row) => {
        const name =
          (row.querySelector('[data-field="name"]') as HTMLInputElement)?.value.trim() ?? ""
        const price = parseFloat(
          (row.querySelector('[data-field="price"]') as HTMLInputElement)?.value ?? "0",
        )
        const person =
          (row.querySelector('[data-field="person"]') as HTMLInputElement)?.value.trim() ?? ""
        return { name, price, person }
      })
      .filter((item) => item.name && item.person && !Number.isNaN(item.price))

    if (items.length === 0) {
      resultsEl.hidden = true
      summaryEl.textContent = "请至少填写一条完整商品（名称、价格、归属人）。"
      return
    }

    const deliveryFee = parseFloat(
      (document.getElementById("delivery-fee") as HTMLInputElement).value || "0",
    )
    const packagingFee = parseFloat(
      (document.getElementById("packaging-fee") as HTMLInputElement).value || "0",
    )
    const discount = parseFloat(
      (document.getElementById("discount") as HTMLInputElement).value || "0",
    )
    const includeFixedFees = includeFixedFeesEl?.checked ?? false

    const result = calculateSplit(
      items,
      deliveryFee,
      packagingFee,
      discount,
      includeFixedFees,
    )

    const fixedFeeNote = includeFixedFees
      ? `<span>固定费用 <strong>¥${formatMoney(result.fixedTotal)}</strong></span>`
      : `<span>固定费用 <strong>未计入</strong></span>`

    summaryEl.innerHTML = `
      <div class="split-summary__grid">
        <span>原始总计 <strong>¥${formatMoney(result.originalTotal)}</strong></span>
        <span>商品合计 <strong>¥${formatMoney(result.itemsTotal)}</strong></span>
        ${fixedFeeNote}
        <span>总优惠 <strong>¥${formatMoney(result.discount)}</strong></span>
        <span>实付金额 <strong>¥${formatMoney(result.actualPay)}</strong></span>
      </div>
    `

    resultsEl.innerHTML = result.personResults
      .map(
        (person, index) => {
          const color = PERSON_COLORS[index % PERSON_COLORS.length]
          const fixedShareRow = includeFixedFees
            ? `<div><dt>固定费用分摊</dt><dd>¥${formatMoney(person.fixedShare)}</dd></div>`
            : ""

          return `
        <section class="split-person card" style="--person-color: ${color}; border-left-color: ${color}">
          <h3 style="color: ${color}">${person.person}</h3>
          <table class="split-table split-table--result">
            <thead>
              <tr>
                <th>商品</th>
                <th>原价</th>
                <th>优惠</th>
                <th>实付</th>
              </tr>
            </thead>
            <tbody>
              ${person.items
                .map(
                  (item) => `
                <tr>
                  <td>${item.name}</td>
                  <td>¥${formatMoney(item.originalPrice)}</td>
                  <td>-¥${formatMoney(item.discount)}</td>
                  <td>¥${formatMoney(item.actualPrice)}</td>
                </tr>
              `,
                )
                .join("")}
            </tbody>
          </table>
          <dl class="split-person__totals">
            <div><dt>商品小计</dt><dd>¥${formatMoney(person.itemTotal)}</dd></div>
            ${fixedShareRow}
            <div class="split-person__final"><dt>应付</dt><dd style="color: ${color}; background: ${color}2e">¥${formatMoney(person.total)}</dd></div>
          </dl>
        </section>
      `
        },
      )
      .join("")

    resultsEl.hidden = false
  })
}

initSplitCalculator()
