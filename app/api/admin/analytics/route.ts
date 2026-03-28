import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { subMonths, format } from 'date-fns'
import { orderTotal } from '@/lib/utils/order'

export async function GET() {
  const session = await auth()
  if (!session || session.user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const sixMonthsAgo = subMonths(new Date(), 6)

  const [allOrders, distributors] = await Promise.all([
    prisma.order.findMany({
      where: { status: { not: 'DRAFT' } },
      include: { items: true, shipment: true },
    }),
    prisma.user.findMany({
      where: { role: 'DISTRIBUTOR' },
      include: {
        orders: {
          where: { status: { not: 'DRAFT' } },
          include: { items: true },
        },
      },
    }),
  ])

  // 요약
  const activeStatuses = ['SUBMITTED', 'CONFIRMED', 'PAYMENT_PENDING', 'PAYMENT_CONFIRMED', 'READY_TO_SHIP']
  const totalAmount = allOrders.reduce((s, o) => s + orderTotal(o.items), 0)
  const paymentPending = allOrders
    .filter((o) => o.status === 'PAYMENT_PENDING')
    .reduce((s, o) => s + orderTotal(o.items), 0)

  // 상태별 주문 수
  const ordersByStatus: Record<string, number> = {}
  for (const o of allOrders) {
    ordersByStatus[o.status] = (ordersByStatus[o.status] ?? 0) + 1
  }

  // 월별 집계 (최근 6개월)
  const recentOrders = allOrders.filter((o) => o.createdAt >= sixMonthsAgo)
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

  // 선적 모드 집계
  const shipmentByMode: Record<string, number> = {}
  for (const o of allOrders.filter((o) => o.shippingMode)) {
    shipmentByMode[o.shippingMode!] = (shipmentByMode[o.shippingMode!] ?? 0) + 1
  }

  // Top Distributors
  const topDistributors = distributors
    .map((d) => ({
      id: d.id,
      name: d.name,
      company: d.company,
      totalAmount: d.orders.reduce((s, o) => s + orderTotal(o.items), 0),
      orderCount: d.orders.length,
    }))
    .sort((a, b) => b.totalAmount - a.totalAmount)
    .slice(0, 5)

  const activeDistributors = distributors.filter((d) =>
    d.orders.some((o) => activeStatuses.includes(o.status))
  ).length

  return NextResponse.json({
    summary: {
      totalDistributors: distributors.length,
      activeDistributors,
      totalOrders: allOrders.length,
      totalAmount,
      paymentPending,
    },
    ordersByStatus,
    monthlyOrders,
    shipmentByMode,
    topDistributors,
  })
}
