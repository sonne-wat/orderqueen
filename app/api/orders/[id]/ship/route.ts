import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || session.user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const order = await prisma.order.findUnique({ where: { id } })
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (order.status !== 'PAYMENT_CONFIRMED' && order.status !== 'PAYMENT_PENDING') {
    return NextResponse.json({ error: 'Only PAYMENT_CONFIRMED or PAYMENT_PENDING orders can be marked SHIPPED' }, { status: 400 })
  }

  const paymentSkipped = order.status === 'PAYMENT_PENDING'
  // Use $executeRaw to bypass Turbopack WASM query compiler schema validation issue
  await prisma.$executeRawUnsafe(
    `UPDATE orders SET status = $1::"OrderStatus", "paymentSkipped" = $2, "updatedAt" = NOW() WHERE id = $3`,
    'SHIPPED',
    paymentSkipped,
    id
  )

  return NextResponse.json({ status: 'SHIPPED', paymentSkipped })
}
