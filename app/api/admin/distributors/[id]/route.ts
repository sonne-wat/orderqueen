import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { subMonths, format } from 'date-fns'
import { orderTotal } from '@/lib/utils/order'
import { ProductCategory } from '@prisma/client'

const VALID_CATEGORIES = Object.values(ProductCategory)

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || session.user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const user = await prisma.user.findUnique({
    where: { id, role: 'DISTRIBUTOR' },
    include: {
      orders: {
        where: { status: { not: 'DRAFT' } },
        include: { items: true, shipment: true },
      },
    },
  })


  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const sixMonthsAgo = subMonths(new Date(), 6)
  const recentOrders = user.orders.filter((o) => o.createdAt >= sixMonthsAgo)

  // 월별 집계
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

  // 상태별 집계
  const byStatus: Record<string, number> = {}
  for (const o of user.orders) {
    byStatus[o.status] = (byStatus[o.status] ?? 0) + 1
  }

  // 결제 금액
  const paymentCompleted = user.orders
    .filter((o) => ['PAYMENT_CONFIRMED', 'READY_TO_SHIP', 'SHIPPED'].includes(o.status))
    .reduce((s, o) => s + orderTotal(o.items), 0)
  const paymentPending = user.orders
    .filter((o) => o.status === 'PAYMENT_PENDING')
    .reduce((s, o) => s + orderTotal(o.items), 0)

  // 선적 통계
  const shipments = user.orders.map((o) => o.shipment).filter(Boolean)
  const shipByStatus: Record<string, number> = {}
  const shipByMode: Record<string, number> = {}
  for (const s of shipments) {
    if (s) shipByStatus[s.status] = (shipByStatus[s.status] ?? 0) + 1
  }
  for (const o of user.orders.filter((o) => o.shipment)) {
    if (o.shippingMode) shipByMode[o.shippingMode] = (shipByMode[o.shippingMode] ?? 0) + 1
  }

  return NextResponse.json({
    distributor: {
      id: user.id,
      name: user.name,
      company: user.company,
      email: user.email,
      phone: user.phone,
      address: user.address,
      shippingAddress: user.shippingAddress,
      status: user.status,
      creditLimit: user.creditLimit,
      adminNotes: user.adminNotes,
      createdAt: user.createdAt,
      allowedCategories: user.allowedCategories,
    },
    analytics: {
      orderStats: { total: user.orders.length, byStatus },
      amountStats: {
        totalConfirmed: paymentCompleted + paymentPending,
        paymentPending,
        paymentCompleted,
      },
      shipmentStats: { total: shipments.length, byStatus: shipByStatus, byMode: shipByMode },
      monthlyOrders,
    },
  })
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || session.user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()
  const { phone, address, shippingAddress, creditLimit, adminNotes, status, allowedCategories } = body

  if (status !== undefined && !['PENDING', 'ACTIVE', 'SUSPENDED'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status value' }, { status: 400 })
  }

  if (allowedCategories !== undefined) {
    if (!Array.isArray(allowedCategories)) {
      return NextResponse.json({ error: 'allowedCategories must be an array' }, { status: 400 })
    }
    const invalid = allowedCategories.filter((c: string) => !VALID_CATEGORIES.includes(c as ProductCategory))
    if (invalid.length > 0) {
      return NextResponse.json({ error: `Invalid categories: ${invalid.join(', ')}` }, { status: 400 })
    }
  }

  const updated = await prisma.user.update({
    where: { id },
    data: {
      phone: phone ?? undefined,
      address: address ?? undefined,
      shippingAddress: shippingAddress ?? undefined,
      creditLimit: creditLimit !== undefined ? creditLimit : undefined,
      adminNotes: adminNotes ?? undefined,
      status: status ?? undefined,
      ...(allowedCategories !== undefined ? { allowedCategories } : {}),
    },
    select: { id: true, name: true, company: true, creditLimit: true, status: true, allowedCategories: true },
  })

  return NextResponse.json(updated)
}
