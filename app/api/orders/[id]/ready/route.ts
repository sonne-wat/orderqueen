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
  if (order.status !== 'CONFIRMED') {
    return NextResponse.json({ error: 'Only CONFIRMED orders can be marked READY_TO_SHIP' }, { status: 400 })
  }

  const updated = await prisma.order.update({
    where: { id },
    data: { status: 'READY_TO_SHIP' },
  })

  return NextResponse.json({ status: updated.status })
}
