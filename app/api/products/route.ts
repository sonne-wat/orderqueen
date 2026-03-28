import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { type ProductCategory } from '@prisma/client'

export async function GET() {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const isAdmin = session.user?.role === 'ADMIN'

    // For distributors: fetch their allowedCategories to filter products
    let allowedCategories: ProductCategory[] = []
    if (!isAdmin && session.user?.id) {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { allowedCategories: true },
      })
      allowedCategories = (user?.allowedCategories ?? []) as ProductCategory[]
    }

    // Build category filter:
    // - If allowedCategories is empty → no restriction (show all)
    // - If non-empty → show products in those categories OR products with no category set
    const categoryFilter = allowedCategories.length > 0
      ? { OR: [
          { category: { in: allowedCategories } },
          { category: null },
        ] }
      : {}

    const products = await prisma.product.findMany({
      where: { isActive: true, ...categoryFilter },
      orderBy: { sku: 'asc' },
    })

    const result = products.map((p) => {
      const isLowStock = p.stockQuantity <= p.lowStockThreshold
      const isOutOfStock = p.stockQuantity === 0
      if (isAdmin) {
        return { ...p, unitPrice: Number(p.unitPrice), isLowStock, isOutOfStock }
      }
      // Distributors see stockQuantity as maxOrderQty for input validation only
      const { lowStockThreshold, ...rest } = p
      void lowStockThreshold
      return { ...rest, unitPrice: Number(p.unitPrice), isLowStock, isOutOfStock }
    })

    return NextResponse.json({ products: result })
  } catch (err) {
    console.error('[GET /api/products]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || session.user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { sku, name, description, category, unitPrice, currency, stockQuantity, lowStockThreshold, unit } =
    await req.json()

  const product = await prisma.product.create({
    data: {
      sku, name, description, category: category || null, unitPrice, currency,
      stockQuantity, lowStockThreshold, unit,
      ...(stockQuantity !== undefined && { stockUpdatedAt: new Date() }),
    },
  })

  return NextResponse.json({ ...product, unitPrice: Number(product.unitPrice) }, { status: 201 })
}
