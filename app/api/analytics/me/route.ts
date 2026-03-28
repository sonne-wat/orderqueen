import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { subMonths, format } from 'date-fns'
import { orderTotal } from '@/lib/utils/order'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user?.id!
  const sixMonthsAgo = subMonths(new Date(), 6)

  const orders = await prisma.order.findMany({
    where: { distributorId: userId, status: { not: 'DRAFT' } },
    include: { items: true, shipment: true },
  })

  // 상태별
  const byStatus: Record<string, number> = {}
  for (const o of orders) {
    byStatus[o.status] = (byStatus[o.status] ?? 0) + 1
  }

  // 결제
  const paymentCompleted = orders
    .filter((o) => ['PAYMENT_CONFIRMED', 'READY_TO_SHIP', 'SHIPPED'].includes(o.status))
    .reduce((s, o) => s + orderTotal(o.items), 0)
  const paymentPending = orders
    .filter((o) => o.status === 'PAYMENT_PENDING')
    .reduce((s, o) => s + orderTotal(o.items), 0)
  const totalOrdered = orders.reduce((s, o) => s + orderTotal(o.items), 0)

  // 월별 (최근 6개월)
  const recentOrders = orders.filter((o) => o.createdAt >= sixMonthsAgo)
  const monthlyMap: Record<string, { count: number; amount: number }> = {}
  for (const o of recentOrders) {
    const month = format(o.createdAt, 'yyyy-MM')
    const amount = orderTotal(o.items)
    monthlyMap[month] = {
      count: (monthlyMap[month]?.count ?? 0) + 1,
      amount: (monthlyMap[month]?.amount ?? 0) + amount,
    }
  }
  const monthlyOrders = Object.entries(monthlyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({ month, ...v }))

  // 선적
  const shipments = orders.map((o) => o.shipment).filter(Boolean)
  const shipByStatus: Record<string, number> = {}
  for (const s of shipments) {
    if (s) shipByStatus[s.status] = (shipByStatus[s.status] ?? 0) + 1
  }

  const activeStatuses = ['SUBMITTED', 'CONFIRMED', 'PAYMENT_PENDING', 'PAYMENT_CONFIRMED', 'READY_TO_SHIP']

  return NextResponse.json({
    orderStats: {
      total: orders.length,
      active: orders.filter((o) => activeStatuses.includes(o.status)).length,
      shipped: orders.filter((o) => o.status === 'SHIPPED').length,
      byStatus,
    },
    amountStats: { totalOrdered, paymentPending, paymentCompleted },
    shipmentStats: { total: shipments.length, byStatus: shipByStatus },
    monthlyOrders,
  })
}
