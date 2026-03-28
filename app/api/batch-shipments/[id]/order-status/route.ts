import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// POST /api/batch-shipments/[id]/order-status
// Bulk-updates the order status for all orders in the batch
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || session.user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const { action } = await req.json()

  // Fetch batch + linked order IDs
  const batchRows: { id: string; shipmentRequestId: string }[] = await prisma.$queryRaw`
    SELECT id, "shipmentRequestId" FROM batch_shipments WHERE id = ${id}
  `
  if (batchRows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  // Query via shipments table so add-to-batch orders are included
  const orderRows: { orderId: string; status: string }[] = await prisma.$queryRaw`
    SELECT s."orderId", o.status::text
    FROM shipments s
    JOIN orders o ON o.id = s."orderId"
    WHERE s."batchShipmentId" = ${id}
  `
  if (orderRows.length === 0) return NextResponse.json({ error: 'No orders found' }, { status: 400 })

  const orderIds = orderRows.map((r) => r.orderId)
  const currentStatuses = [...new Set(orderRows.map((r) => r.status))]

  try {
    if (action === 'payment-pending') {
      if (!currentStatuses.every((s) => s === 'READY_TO_SHIP')) {
        return NextResponse.json({ error: 'All orders must be READY_TO_SHIP' }, { status: 400 })
      }
      await prisma.$executeRawUnsafe(
        `UPDATE orders SET status = 'PAYMENT_PENDING'::"OrderStatus", "updatedAt" = NOW()
         WHERE id = ANY($1::text[])`,
        orderIds
      )
    } else if (action === 'payment-confirm') {
      if (!currentStatuses.every((s) => s === 'PAYMENT_PENDING')) {
        return NextResponse.json({ error: 'All orders must be PAYMENT_PENDING' }, { status: 400 })
      }
      await prisma.$executeRawUnsafe(
        `UPDATE orders SET status = 'PAYMENT_CONFIRMED'::"OrderStatus", "updatedAt" = NOW()
         WHERE id = ANY($1::text[])`,
        orderIds
      )
    } else if (action === 'book') {
      if (!currentStatuses.every((s) => s === 'PAYMENT_CONFIRMED')) {
        return NextResponse.json({ error: 'All orders must be PAYMENT_CONFIRMED' }, { status: 400 })
      }
      await prisma.$executeRawUnsafe(
        `UPDATE orders SET status = 'SHIPMENT_BOOKED'::"OrderStatus", "updatedAt" = NOW()
         WHERE id = ANY($1::text[])`,
        orderIds
      )
      await prisma.$executeRawUnsafe(
        `UPDATE batch_shipments SET status = 'BOOKED'::"ShipmentStatus", "updatedAt" = NOW() WHERE id = $1`,
        id
      )
    } else if (action === 'ship') {
      if (!currentStatuses.every((s) => s === 'SHIPMENT_BOOKED')) {
        return NextResponse.json({ error: 'All orders must be SHIPMENT_BOOKED' }, { status: 400 })
      }
      await prisma.$executeRawUnsafe(
        `UPDATE orders SET status = 'SHIPPED'::"OrderStatus", "paymentSkipped" = false, "updatedAt" = NOW()
         WHERE id = ANY($1::text[])`,
        orderIds
      )
      await prisma.$executeRawUnsafe(
        `UPDATE shipments SET status = 'SHIPPED'::"ShipmentStatus", "updatedAt" = NOW()
         WHERE "batchShipmentId" = $1`,
        id
      )
      await prisma.$executeRawUnsafe(
        `UPDATE batch_shipments SET status = 'SHIPPED'::"ShipmentStatus", "updatedAt" = NOW() WHERE id = $1`,
        id
      )
    } else if (action === 'skip-payment') {
      if (!currentStatuses.every((s) => s === 'PAYMENT_PENDING')) {
        return NextResponse.json({ error: 'All orders must be PAYMENT_PENDING' }, { status: 400 })
      }
      await prisma.$executeRawUnsafe(
        `UPDATE orders SET status = 'SHIPPED'::"OrderStatus", "paymentSkipped" = true, "updatedAt" = NOW()
         WHERE id = ANY($1::text[])`,
        orderIds
      )
      await prisma.$executeRawUnsafe(
        `UPDATE shipments SET status = 'SHIPPED'::"ShipmentStatus", "updatedAt" = NOW()
         WHERE "batchShipmentId" = $1`,
        id
      )
      await prisma.$executeRawUnsafe(
        `UPDATE batch_shipments SET status = 'SHIPPED'::"ShipmentStatus", "updatedAt" = NOW() WHERE id = $1`,
        id
      )
    } else {
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }

    return NextResponse.json({ success: true, action, orderCount: orderIds.length })
  } catch (e) {
    console.error('[BATCH ORDER STATUS ERROR]', e)
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
