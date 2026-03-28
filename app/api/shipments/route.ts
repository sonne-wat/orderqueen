import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const where = session.user?.role === 'ADMIN'
    ? {}
    : { order: { distributorId: session.user?.id } }

  const shipments = await prisma.shipment.findMany({
    where,
    include: { order: { select: { orderNumber: true, status: true, distributor: { select: { name: true, company: true } } } } },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ shipments })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || session.user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { orderId, cbm, weightKg, scheduledDate, carrier, trackingNumber, notes } =
    await req.json()

  const order = await prisma.order.findUnique({ where: { id: orderId } })
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  if (order.status !== 'CONFIRMED') {
    return NextResponse.json({ error: 'Order must be CONFIRMED before creating shipment' }, { status: 400 })
  }

  const shipment = await prisma.shipment.create({
    data: {
      orderId,
      cbm: cbm ? Number(cbm) : null,
      weightKg: weightKg ? Number(weightKg) : null,
      scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
      carrier: carrier || null,
      trackingNumber: trackingNumber || null,
      notes: notes || null,
    },
  })

  // 주문 상태를 READY_TO_SHIP으로 변경
  await prisma.order.update({
    where: { id: orderId },
    data: { status: 'READY_TO_SHIP' },
  })

  return NextResponse.json({ shipment }, { status: 201 })
}
