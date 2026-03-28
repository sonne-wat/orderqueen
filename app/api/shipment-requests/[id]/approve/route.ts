import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function generateBatchNumber(): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `BS-${year}-`
  const rows: { count: bigint }[] = await prisma.$queryRaw`
    SELECT COUNT(*) AS count FROM batch_shipments WHERE "batchNumber" LIKE ${prefix + '%'}
  `
  const next = Number(rows[0]?.count ?? 0) + 1
  return `${prefix}${String(next).padStart(3, '0')}`
}

// POST /api/shipment-requests/[id]/approve
export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || session.user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  // Fetch the request (including targetBatchId and type)
  const reqRows: { id: string; status: string; type: string; targetBatchId: string | null }[] = await prisma.$queryRaw`
    SELECT id, status::text, type::text, "targetBatchId" FROM shipment_requests WHERE id = ${id}
  `
  if (reqRows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (reqRows[0].status !== 'PENDING') {
    return NextResponse.json({ error: 'Request is not in PENDING status' }, { status: 400 })
  }

  const { targetBatchId, type: requestType } = reqRows[0]

  // Fetch orders in this request
  const orderRows: { orderId: string; orderNumber: string; status: string }[] = await prisma.$queryRaw`
    SELECT sro."orderId", o."orderNumber", o.status::text
    FROM shipment_request_orders sro
    JOIN orders o ON o.id = sro."orderId"
    WHERE sro."shipmentRequestId" = ${id}
  `

  try {
    // UNBUNDLE approval: delete shipments, revert orders to CONFIRMED
    if (requestType === 'UNBUNDLE') {
      for (const row of orderRows) {
        await prisma.$executeRawUnsafe(
          `DELETE FROM shipments WHERE "orderId" = $1`,
          row.orderId
        )
        await prisma.$executeRawUnsafe(
          `UPDATE orders SET status = $1::"OrderStatus", "updatedAt" = NOW() WHERE id = $2`,
          'CONFIRMED', row.orderId
        )
      }

      await prisma.$executeRawUnsafe(
        `UPDATE shipment_requests SET status = 'APPROVED', "reviewedAt" = NOW() WHERE id = $1`,
        id
      )

      return NextResponse.json({ status: 'APPROVED', type: 'UNBUNDLE' })
    }

    // BUNDLE approval (existing logic)
    const isAddToBatch = !!targetBatchId

    // Re-validate all orders are in a bundle-eligible status
    const BUNDLE_ELIGIBLE_STATUSES = new Set(['CONFIRMED', 'PAYMENT_PENDING', 'PAYMENT_CONFIRMED', 'READY_TO_SHIP'])
    const notEligible = orderRows.filter((r) => !BUNDLE_ELIGIBLE_STATUSES.has(r.status))
    if (notEligible.length > 0) {
      const nums = notEligible.map((r) => r.orderNumber).join(', ')
      return NextResponse.json({ error: `Orders no longer eligible for bundling: ${nums}` }, { status: 400 })
    }

    let batchId: string

    if (isAddToBatch) {
      // Validate target batch exists and is not SHIPPED
      const targetRows: { id: string; status: string }[] = await prisma.$queryRaw`
        SELECT id, status::text FROM batch_shipments WHERE id = ${targetBatchId}
      `
      if (targetRows.length === 0) {
        return NextResponse.json({ error: 'Target batch shipment not found' }, { status: 404 })
      }
      if (targetRows[0].status === 'SHIPPED') {
        return NextResponse.json({ error: 'Target batch has already been shipped' }, { status: 400 })
      }
      batchId = targetBatchId!
    } else {
      // Create new BatchShipment (idempotent)
      const existingBatch: { id: string }[] = await prisma.$queryRaw`
        SELECT id FROM batch_shipments WHERE "shipmentRequestId" = ${id}
      `
      if (existingBatch.length > 0) {
        batchId = existingBatch[0].id
      } else {
        batchId = `c${Math.random().toString(36).slice(2, 22)}`
        const batchNumber = await generateBatchNumber()
        await prisma.$executeRawUnsafe(
          `INSERT INTO batch_shipments (id, "batchNumber", "shipmentRequestId", status, "createdAt", "updatedAt")
           VALUES ($1, $2, $3, 'PREPARING', NOW(), NOW())`,
          batchId, batchNumber, id
        )
      }
    }

    // Create or update Shipment per order + update order status
    for (const row of orderRows) {
      const shipmentId = `c${Math.random().toString(36).slice(2, 22)}`
      await prisma.$executeRawUnsafe(
        `INSERT INTO shipments (id, "orderId", "batchShipmentId", status, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, 'PREPARING', NOW(), NOW())
         ON CONFLICT ("orderId") DO UPDATE
           SET "batchShipmentId" = $3, status = 'PREPARING', "updatedAt" = NOW()`,
        shipmentId, row.orderId, batchId
      )
      await prisma.$executeRawUnsafe(
        `UPDATE orders SET status = $1::"OrderStatus", "updatedAt" = NOW() WHERE id = $2`,
        'READY_TO_SHIP', row.orderId
      )
    }

    // Update ShipmentRequest status
    await prisma.$executeRawUnsafe(
      `UPDATE shipment_requests SET status = 'APPROVED', "reviewedAt" = NOW() WHERE id = $1`,
      id
    )

    return NextResponse.json({ status: 'APPROVED', batchShipmentId: batchId })
  } catch (e) {
    console.error('[APPROVE SHIPMENT REQUEST ERROR]', e)
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
