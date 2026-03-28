import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      distributor: { select: { id: true, name: true, email: true, company: true } },
      items: { include: { product: true } },
      shipment: true,
      documents: true,
    },
  })

  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Distributor는 자신의 주문만 조회 가능
  if (session.user?.role === 'DISTRIBUTOR' && order.distributorId !== session.user?.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return NextResponse.json({ order })
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || session.user?.role !== 'DISTRIBUTOR') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const order = await prisma.order.findUnique({ where: { id } })
  if (!order || order.distributorId !== session.user?.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (order.status !== 'DRAFT') {
    return NextResponse.json({ error: 'Only DRAFT orders can be edited' }, { status: 400 })
  }

  const { requestedDelivery, shippingMode, packageType, notes, freightForwarder, items } = await req.json()

  // Build order metadata update
  const orderData: Record<string, unknown> = {
    requestedDelivery: requestedDelivery ? new Date(requestedDelivery) : null,
    shippingMode: shippingMode || null,
    packageType: packageType || null,
    notes: notes ?? null,
    freightForwarder: freightForwarder || null,
  }

  let updated
  if (items && items.length > 0) {
    const productIds = items.map((i: { productId: string }) => i.productId)
    const products = await prisma.product.findMany({ where: { id: { in: productIds } } })
    const priceMap = Object.fromEntries(products.map((p) => [p.id, p.unitPrice]))

    // Replace items + update metadata atomically
    const [, result] = await prisma.$transaction([
      prisma.orderItem.deleteMany({ where: { orderId: id } }),
      prisma.order.update({
        where: { id },
        data: {
          ...orderData,
          items: {
            createMany: {
              data: items.map((i: { productId: string; requestedQty: number }) => ({
                productId: i.productId,
                requestedQty: i.requestedQty,
                unitPrice: priceMap[i.productId],
              })),
            },
          },
        },
      }),
    ])
    updated = result
  } else {
    updated = await prisma.order.update({ where: { id }, data: orderData })
  }

  return NextResponse.json({ order: updated })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || session.user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const {
    invoiceNumber, acknowledgementNumber,
    requestedDelivery, shippingMode, packageType, freightForwarder, notes,
  } = await req.json()

  const exists = await prisma.order.findUnique({ where: { id }, select: { id: true } })
  if (!exists) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const setClauses: string[] = ['"updatedAt" = NOW()']
  const values: unknown[] = []

  if (invoiceNumber !== undefined) {
    values.push(invoiceNumber || null)
    setClauses.push(`"invoiceNumber" = $${values.length}`)
  }
  if (acknowledgementNumber !== undefined) {
    values.push(acknowledgementNumber || null)
    setClauses.push(`"acknowledgementNumber" = $${values.length}`)
  }
  if (requestedDelivery !== undefined) {
    values.push(requestedDelivery ? new Date(requestedDelivery) : null)
    setClauses.push(`"requestedDelivery" = $${values.length}`)
  }
  if (shippingMode !== undefined) {
    values.push(shippingMode || null)
    setClauses.push(`"shippingMode" = $${values.length}::"ShippingMode"`)
  }
  if (packageType !== undefined) {
    values.push(packageType || null)
    setClauses.push(`"packageType" = $${values.length}::"PackageType"`)
  }
  if (freightForwarder !== undefined) {
    values.push(freightForwarder || null)
    setClauses.push(`"freightForwarder" = $${values.length}::"FreightForwarder"`)
  }
  if (notes !== undefined) {
    values.push(notes || null)
    setClauses.push(`notes = $${values.length}`)
  }

  values.push(id)
  const idParam = `$${values.length}`

  await prisma.$executeRawUnsafe(
    `UPDATE orders SET ${setClauses.join(', ')} WHERE id = ${idParam}`,
    ...values
  )

  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const order = await prisma.order.findUnique({ where: { id } })
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (session.user?.role === 'ADMIN') {
    // Admin: soft-cancel with reason (any status except SHIPPED)
    if (order.status === 'SHIPPED' || order.status === 'CANCELLED') {
      return NextResponse.json({ error: 'Cannot cancel a shipped or already cancelled order' }, { status: 400 })
    }
    const body = await req.json().catch(() => ({}))
    const { reason } = body as { reason?: string }
    if (!reason?.trim()) {
      return NextResponse.json({ error: 'Cancel reason is required' }, { status: 400 })
    }
    try {
      await prisma.order.update({
        where: { id },
        data: { status: 'CANCELLED', cancelReason: reason.trim() },
      })
    } catch (err) {
      console.error('[DELETE /api/orders/[id]] admin cancel error:', err)
      return NextResponse.json({ error: 'Failed to cancel order' }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  }

  // Distributor: delete DRAFT only
  if (session.user?.role !== 'DISTRIBUTOR') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (order.distributorId !== session.user?.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (order.status !== 'DRAFT') {
    return NextResponse.json({ error: 'Only DRAFT orders can be deleted' }, { status: 400 })
  }

  await prisma.order.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
