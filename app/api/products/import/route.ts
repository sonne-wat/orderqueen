import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || session.user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { products } = await req.json()
  if (!Array.isArray(products) || products.length === 0) {
    return NextResponse.json({ error: 'No products provided' }, { status: 400 })
  }

  let created = 0, updated = 0
  const errors: { sku: string; error: string }[] = []

  for (const p of products) {
    try {
      const existing = await prisma.product.findUnique({ where: { sku: p.sku } })
      await prisma.product.upsert({
        where: { sku: p.sku },
        update: {
          name: p.name,
          ...(p.category !== undefined && { category: p.category || null }),
          ...(p.unitPrice !== undefined && { unitPrice: p.unitPrice }),
          ...(p.stockQuantity !== undefined && { stockQuantity: p.stockQuantity, stockUpdatedAt: new Date() }),
          ...(p.unit && { unit: p.unit }),
        },
        create: {
          sku: p.sku,
          name: p.name,
          category: p.category || null,
          unitPrice: p.unitPrice ?? 0,
          stockQuantity: p.stockQuantity ?? 0,
          unit: p.unit || 'EA',
        },
      })
      existing ? updated++ : created++
    } catch (e) {
      errors.push({ sku: p.sku, error: String(e) })
    }
  }

  return NextResponse.json({ created, updated, errors })
}
