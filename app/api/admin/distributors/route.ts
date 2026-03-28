import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { orderTotal } from '@/lib/utils/order'

export async function GET() {
  const session = await auth()
  if (!session || session.user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const distributors = await prisma.user.findMany({
    where: { role: 'DISTRIBUTOR' },
    include: {
      orders: {
        where: { status: { not: 'DRAFT' } },
        include: { items: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  const result = distributors.map((d) => {
    const totalAmount = d.orders.reduce((sum, o) => sum + orderTotal(o.items), 0)
    const lastOrder = d.orders.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]
    const activeStatuses = ['SUBMITTED', 'CONFIRMED', 'PAYMENT_PENDING', 'PAYMENT_CONFIRMED', 'READY_TO_SHIP']

    return {
      id: d.id,
      name: d.name,
      company: d.company,
      email: d.email,
      phone: d.phone,
      status: d.status,
      creditLimit: d.creditLimit,
      createdAt: d.createdAt,
      stats: {
        totalOrders: d.orders.length,
        activeOrders: d.orders.filter((o) => activeStatuses.includes(o.status)).length,
        totalAmount,
        lastOrderAt: lastOrder?.createdAt ?? null,
      },
    }
  })

  return NextResponse.json({ distributors: result })
}
