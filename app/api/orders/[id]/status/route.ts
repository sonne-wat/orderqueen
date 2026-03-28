import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const VALID_STATUSES = ['SUBMITTED', 'CONFIRMED', 'READY_TO_SHIP', 'PAYMENT_PENDING', 'PAYMENT_CONFIRMED', 'SHIPMENT_BOOKED', 'SHIPPED']

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const body = await req.json()
    const status: string = body.status

    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: `Invalid status: ${status}` }, { status: 400 })
    }

    const order = await prisma.order.findUnique({ where: { id } })
    if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const paymentSkipped: boolean =
      status === 'SHIPPED' && order.status === 'PAYMENT_PENDING'
        ? true
        : (status === 'PAYMENT_CONFIRMED' || status === 'SHIPPED') && !order.paymentSkipped
        ? false
        : (order.paymentSkipped ?? false)

    // Use $executeRaw to bypass Turbopack WASM query compiler schema validation issue
    await prisma.$executeRawUnsafe(
      `UPDATE orders SET status = $1::"OrderStatus", "paymentSkipped" = $2, "updatedAt" = NOW() WHERE id = $3`,
      status,
      paymentSkipped,
      id
    )

    return NextResponse.json({ status, paymentSkipped })
  } catch (e) {
    console.error('[STATUS ROUTE ERROR]', e)
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
