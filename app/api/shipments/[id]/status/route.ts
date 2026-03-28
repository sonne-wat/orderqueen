import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || session.user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const { status } = await req.json()

  const shipment = await prisma.shipment.update({
    where: { id },
    data: { status },
  })

  // 선적 완료 시 주문 상태도 SHIPPED로 변경
  if (status === 'SHIPPED') {
    await prisma.order.update({
      where: { id: shipment.orderId },
      data: { status: 'SHIPPED' },
    })
  }

  return NextResponse.json({ status: shipment.status })
}
