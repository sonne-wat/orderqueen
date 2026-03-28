import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || session.user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const { name, description, category, unitPrice, currency, stockQuantity, lowStockThreshold, unit, isActive } =
    await req.json()

  const product = await prisma.product.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(category !== undefined && { category }),
      ...(unitPrice !== undefined && { unitPrice }),
      ...(currency !== undefined && { currency }),
      ...(stockQuantity !== undefined && { stockQuantity, stockUpdatedAt: new Date() }),
      ...(lowStockThreshold !== undefined && { lowStockThreshold }),
      ...(unit !== undefined && { unit }),
      ...(isActive !== undefined && { isActive }),
    },
  })

  return NextResponse.json({ ...product, unitPrice: Number(product.unitPrice) })
}
