import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || session.user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const { items } = await req.json()

  await Promise.all(
    items.map((item: { id: string; decision: string; confirmedQty?: number; rejectReason?: string }) =>
      prisma.orderItem.update({
        where: { id: item.id, orderId: id },
        data: {
          decision: item.decision as never,
          confirmedQty: item.decision === 'ACCEPTED' ? item.confirmedQty : 0,
          rejectReason: item.decision === 'REJECTED' ? item.rejectReason : null,
        },
      })
    )
  )

  return NextResponse.json({ success: true })
}
