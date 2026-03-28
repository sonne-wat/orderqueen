import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || session.user?.role !== 'DISTRIBUTOR') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: { include: { product: true } } },
  })
  if (!order || order.distributorId !== session.user?.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (order.status !== 'DRAFT') {
    return NextResponse.json({ error: 'Only DRAFT orders can be submitted' }, { status: 400 })
  }

  // Server-side stock validation
  const overStock = order.items.filter((i) => i.requestedQty > i.product.stockQuantity)
  if (overStock.length > 0) {
    return NextResponse.json({
      error: '재고 초과 항목이 있습니다. 수량을 확인해주세요.',
      details: overStock.map((i) => ({ sku: i.product.sku, name: i.product.name, requested: i.requestedQty, available: i.product.stockQuantity })),
    }, { status: 400 })
  }

  const updated = await prisma.order.update({
    where: { id },
    data: { status: 'SUBMITTED' },
  })

  return NextResponse.json({ status: updated.status })
}
