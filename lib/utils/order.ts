type OrderItem = {
  unitPrice: unknown
  confirmedQty: number | null
  requestedQty: number
}

export function orderTotal(items: OrderItem[]): number {
  return items.reduce(
    (s, i) => s + Number(i.unitPrice) * (i.confirmedQty ?? i.requestedQty),
    0
  )
}
