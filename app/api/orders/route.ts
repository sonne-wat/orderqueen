import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateOrderNumber } from '@/lib/order-number'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')

  const where =
    session.user?.role === 'ADMIN'
      ? status ? { status: status as never } : {}
      : { distributorId: session.user?.id }

  const orders = await prisma.order.findMany({
    where,
    include: {
      distributor: { select: { id: true, name: true, email: true, company: true } },
      items: { include: { product: true } },
      shipment: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ orders })
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session || session.user?.role !== 'DISTRIBUTOR') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { requestedDelivery, shippingMode, packageType, notes, freightForwarder, items } = await req.json()

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'Order must have at least one item' }, { status: 400 })
    }

    const orderNumber = await generateOrderNumber()

    // 제품 가격 조회
    const productIds = items.map((i: { productId: string }) => i.productId)
    const products = await prisma.product.findMany({ where: { id: { in: productIds } } })
    const priceMap = Object.fromEntries(products.map((p) => [p.id, p.unitPrice]))

    // Use $executeRawUnsafe for order creation to bypass Turbopack WASM query compiler issue
    // Then create order items separately
    const orderId = `c${Math.random().toString(36).slice(2, 22)}`
    await prisma.$executeRawUnsafe(
      `INSERT INTO orders (id, "orderNumber", "distributorId", status, "requestedDelivery", "shippingMode", "packageType", notes, "freightForwarder", "paymentSkipped", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4::"OrderStatus", $5, $6::"ShippingMode", $7::"PackageType", $8, $9::"FreightForwarder", false, NOW(), NOW())`,
      orderId,
      orderNumber,
      session.user!.id!,
      'DRAFT',
      requestedDelivery ? new Date(requestedDelivery) : null,
      shippingMode || null,
      packageType || null,
      notes || null,
      freightForwarder || null,
    )

    // Create order items
    for (const item of items as { productId: string; requestedQty: number }[]) {
      const itemId = `c${Math.random().toString(36).slice(2, 22)}`
      const unitPrice = priceMap[item.productId]
      await prisma.$executeRawUnsafe(
        `INSERT INTO order_items (id, "orderId", "productId", "requestedQty", "unitPrice", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
        itemId,
        orderId,
        item.productId,
        item.requestedQty,
        unitPrice,
      )
    }

    return NextResponse.json(
      { id: orderId, orderNumber, status: 'DRAFT', createdAt: new Date() },
      { status: 201 }
    )
  } catch (e) {
    console.error('[ORDER CREATE ERROR]', e)
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
