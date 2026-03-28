import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const VALID_STATUSES = ['PREPARING', 'READY', 'BOOKED', 'SHIPPED']

// PUT /api/batch-shipments/[id]/status
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || session.user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const { status } = await req.json()

  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: `Invalid status: ${status}` }, { status: 400 })
  }

  const batchRows: { id: string }[] = await prisma.$queryRaw`SELECT id FROM batch_shipments WHERE id = ${id}`
  if (batchRows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    // Update BatchShipment status
    await prisma.$executeRawUnsafe(
      `UPDATE batch_shipments SET status = $1::"ShipmentStatus", "updatedAt" = NOW() WHERE id = $2`,
      status, id
    )

    if (status === 'SHIPPED') {
      // Update all linked Shipment records
      await prisma.$executeRawUnsafe(
        `UPDATE shipments SET status = 'SHIPPED'::"ShipmentStatus", "updatedAt" = NOW() WHERE "batchShipmentId" = $1`,
        id
      )

      // Update all linked Order records to SHIPPED
      await prisma.$executeRawUnsafe(
        `UPDATE orders SET status = 'SHIPPED'::"OrderStatus", "updatedAt" = NOW()
         WHERE id IN (
           SELECT s."orderId" FROM shipments s WHERE s."batchShipmentId" = $1
         )`,
        id
      )
    }

    return NextResponse.json({ status })
  } catch (e) {
    console.error('[BATCH SHIPMENT STATUS ERROR]', e)
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
