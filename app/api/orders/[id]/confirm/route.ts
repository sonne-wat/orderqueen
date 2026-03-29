import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || session.user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const order = await prisma.order.findUnique({ where: { id } })
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (order.status !== 'SUBMITTED') {
    return NextResponse.json({ error: 'Only SUBMITTED orders can be confirmed' }, { status: 400 })
  }

  const body = await req.json().catch(() => ({}))
  const note: string | undefined = body.note || undefined

  const updated = await prisma.order.update({
    where: { id },
    data: {
      status: 'CONFIRMED',
      confirmedAt: new Date(),
      ...(note && { confirmNote: note }),
    },
  })

  return NextResponse.json({ status: updated.status })
}
