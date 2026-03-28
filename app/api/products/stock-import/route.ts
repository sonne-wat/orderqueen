import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || session.user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { items } = await req.json()
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'No items provided' }, { status: 400 })
  }

  let updated = 0, notFound = 0
  const errors: { sku: string; error: string }[] = []
  const now = new Date()

  for (const item of items) {
    try {
      const existing = await prisma.product.findUnique({ where: { sku: item.sku } })
      if (!existing) { notFound++; continue }

      await prisma.product.update({
        where: { sku: item.sku },
        data: { stockQuantity: Number(item.stock), stockUpdatedAt: now },
      })
      updated++
    } catch (e) {
      errors.push({ sku: item.sku, error: String(e) })
    }
  }

  return NextResponse.json({ updated, notFound, errors })
}
