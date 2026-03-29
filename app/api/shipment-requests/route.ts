import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type RequestRow = {
  id: string
  distributorId: string
  status: string
  type: string
  requestedAt: Date
  reviewedAt: Date | null
  rejectionNote: string | null
  targetBatchId: string | null
  distributorName: string
  distributorEmail: string
  distributorCompany: string | null
  batchShipmentId: string | null
  batchNumber: string | null
}

type OrderIdRow = { orderId: string; shipmentRequestId: string }

// GET /api/shipment-requests
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const dateFrom = searchParams.get('dateFrom')
  const dateTo = searchParams.get('dateTo')
  const from: Date | null = dateFrom ? new Date(dateFrom + 'T00:00:00Z') : null
  const to: Date | null = dateTo ? new Date(dateTo + 'T23:59:59Z') : null

  const requests: RequestRow[] = session.user?.role === 'ADMIN'
    ? (from && to)
      ? await prisma.$queryRaw`
          SELECT sr.id, sr."distributorId", sr.status::text, sr.type::text, sr."requestedAt", sr."reviewedAt",
                 sr."rejectionNote", sr."targetBatchId",
                 u.name AS "distributorName", u.email AS "distributorEmail", u.company AS "distributorCompany",
                 bs.id AS "batchShipmentId", bs."batchNumber"
          FROM shipment_requests sr
          JOIN users u ON u.id = sr."distributorId"
          LEFT JOIN batch_shipments bs ON bs."shipmentRequestId" = sr.id
          WHERE sr."requestedAt" >= ${from} AND sr."requestedAt" <= ${to}
          ORDER BY sr."requestedAt" DESC
        `
      : from
      ? await prisma.$queryRaw`
          SELECT sr.id, sr."distributorId", sr.status::text, sr.type::text, sr."requestedAt", sr."reviewedAt",
                 sr."rejectionNote", sr."targetBatchId",
                 u.name AS "distributorName", u.email AS "distributorEmail", u.company AS "distributorCompany",
                 bs.id AS "batchShipmentId", bs."batchNumber"
          FROM shipment_requests sr
          JOIN users u ON u.id = sr."distributorId"
          LEFT JOIN batch_shipments bs ON bs."shipmentRequestId" = sr.id
          WHERE sr."requestedAt" >= ${from}
          ORDER BY sr."requestedAt" DESC
        `
      : await prisma.$queryRaw`
          SELECT sr.id, sr."distributorId", sr.status::text, sr.type::text, sr."requestedAt", sr."reviewedAt",
                 sr."rejectionNote", sr."targetBatchId",
                 u.name AS "distributorName", u.email AS "distributorEmail", u.company AS "distributorCompany",
                 bs.id AS "batchShipmentId", bs."batchNumber"
          FROM shipment_requests sr
          JOIN users u ON u.id = sr."distributorId"
          LEFT JOIN batch_shipments bs ON bs."shipmentRequestId" = sr.id
          ORDER BY sr."requestedAt" DESC
        `
    : (from && to)
      ? await prisma.$queryRaw`
          SELECT sr.id, sr."distributorId", sr.status::text, sr.type::text, sr."requestedAt", sr."reviewedAt",
                 sr."rejectionNote", sr."targetBatchId",
                 u.name AS "distributorName", u.email AS "distributorEmail", u.company AS "distributorCompany",
                 bs.id AS "batchShipmentId", bs."batchNumber"
          FROM shipment_requests sr
          JOIN users u ON u.id = sr."distributorId"
          LEFT JOIN batch_shipments bs ON bs."shipmentRequestId" = sr.id
          WHERE sr."distributorId" = ${session.user?.id}
            AND sr."requestedAt" >= ${from} AND sr."requestedAt" <= ${to}
          ORDER BY sr."requestedAt" DESC
        `
      : from
      ? await prisma.$queryRaw`
          SELECT sr.id, sr."distributorId", sr.status::text, sr.type::text, sr."requestedAt", sr."reviewedAt",
                 sr."rejectionNote", sr."targetBatchId",
                 u.name AS "distributorName", u.email AS "distributorEmail", u.company AS "distributorCompany",
                 bs.id AS "batchShipmentId", bs."batchNumber"
          FROM shipment_requests sr
          JOIN users u ON u.id = sr."distributorId"
          LEFT JOIN batch_shipments bs ON bs."shipmentRequestId" = sr.id
          WHERE sr."distributorId" = ${session.user?.id}
            AND sr."requestedAt" >= ${from}
          ORDER BY sr."requestedAt" DESC
        `
      : await prisma.$queryRaw`
          SELECT sr.id, sr."distributorId", sr.status::text, sr.type::text, sr."requestedAt", sr."reviewedAt",
                 sr."rejectionNote", sr."targetBatchId",
                 u.name AS "distributorName", u.email AS "distributorEmail", u.company AS "distributorCompany",
                 bs.id AS "batchShipmentId", bs."batchNumber"
          FROM shipment_requests sr
          JOIN users u ON u.id = sr."distributorId"
          LEFT JOIN batch_shipments bs ON bs."shipmentRequestId" = sr.id
          WHERE sr."distributorId" = ${session.user?.id}
          ORDER BY sr."requestedAt" DESC
        `

  const requestIds = requests.map((r) => r.id)
  if (requestIds.length === 0) return NextResponse.json({ requests: [] })

  const orderRows: OrderIdRow[] = await prisma.$queryRaw`
    SELECT "orderId", "shipmentRequestId"
    FROM shipment_request_orders
    WHERE "shipmentRequestId" = ANY(${requestIds}::text[])
  `

  const ordersByRequest = new Map<string, { orderId: string }[]>()
  for (const row of orderRows) {
    if (!ordersByRequest.has(row.shipmentRequestId)) ordersByRequest.set(row.shipmentRequestId, [])
    ordersByRequest.get(row.shipmentRequestId)!.push({ orderId: row.orderId })
  }

  return NextResponse.json({
    requests: requests.map((r) => ({
      id: r.id,
      status: r.status,
      type: r.type,
      requestedAt: r.requestedAt,
      reviewedAt: r.reviewedAt,
      rejectionNote: r.rejectionNote,
      targetBatchId: r.targetBatchId,
      distributor: { id: r.distributorId, name: r.distributorName, email: r.distributorEmail, company: r.distributorCompany },
      orders: ordersByRequest.get(r.id) ?? [],
      orderCount: (ordersByRequest.get(r.id) ?? []).length,
      batchShipmentId: r.batchShipmentId,
      batchNumber: r.batchNumber,
    })),
  })
}

// POST /api/shipment-requests
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || session.user?.role !== 'DISTRIBUTOR') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { orderIds, targetBatchId, type } = await req.json()
  const requestType: string = type === 'UNBUNDLE' ? 'UNBUNDLE' : 'BUNDLE'

  if (!Array.isArray(orderIds) || orderIds.length === 0) {
    return NextResponse.json({ error: 'Select at least 1 order' }, { status: 400 })
  }

  const distributorId = session.user.id!

  try {
    if (requestType === 'UNBUNDLE') {
      if (!targetBatchId) {
        return NextResponse.json({ error: 'targetBatchId is required for unbundle' }, { status: 400 })
      }

      const batchRows: { id: string; status: string; distributorId: string }[] = await prisma.$queryRaw`
        SELECT bs.id, bs.status::text, sr."distributorId"
        FROM batch_shipments bs
        JOIN shipment_requests sr ON sr.id = bs."shipmentRequestId"
        WHERE bs.id = ${targetBatchId}
      `
      if (batchRows.length === 0) return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
      if (batchRows[0].distributorId !== distributorId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      if (batchRows[0].status === 'SHIPPED') return NextResponse.json({ error: 'Batch already shipped' }, { status: 400 })

      const orderRows: { id: string; orderNumber: string; status: string; batchShipmentId: string | null }[] =
        await prisma.$queryRaw`
          SELECT o.id, o."orderNumber", o.status::text, s."batchShipmentId"
          FROM orders o
          LEFT JOIN shipments s ON s."orderId" = o.id
          WHERE o.id = ANY(${orderIds}::text[])
        `

      if (orderRows.length !== orderIds.length) {
        return NextResponse.json({ error: 'One or more orders not found' }, { status: 404 })
      }

      for (const order of orderRows) {
        if (order.status !== 'READY_TO_SHIP') {
          return NextResponse.json({ error: `Order ${order.orderNumber} is not READY_TO_SHIP` }, { status: 400 })
        }
        if (order.batchShipmentId !== targetBatchId) {
          return NextResponse.json({ error: `Order ${order.orderNumber} is not in this batch` }, { status: 400 })
        }
      }

      const pendingRows: { orderId: string; orderNumber: string }[] = await prisma.$queryRaw`
        SELECT sro."orderId", o."orderNumber"
        FROM shipment_request_orders sro
        JOIN shipment_requests sr ON sr.id = sro."shipmentRequestId"
        JOIN orders o ON o.id = sro."orderId"
        WHERE sro."orderId" = ANY(${orderIds}::text[]) AND sr.status = 'PENDING'
      `
      if (pendingRows.length > 0) {
        const nums = pendingRows.map((r) => r.orderNumber).join(', ')
        return NextResponse.json({ error: `Orders already in a pending request: ${nums}` }, { status: 400 })
      }

      const requestId = `c${Math.random().toString(36).slice(2, 22)}`
      await prisma.$executeRawUnsafe(
        `INSERT INTO shipment_requests (id, "distributorId", status, type, "targetBatchId", "requestedAt")
         VALUES ($1, $2, 'PENDING', 'UNBUNDLE', $3, NOW())`,
        requestId, distributorId, targetBatchId
      )

      for (const orderId of orderIds) {
        const rowId = `c${Math.random().toString(36).slice(2, 22)}`
        await prisma.$executeRawUnsafe(
          `INSERT INTO shipment_request_orders (id, "shipmentRequestId", "orderId") VALUES ($1, $2, $3)`,
          rowId, requestId, orderId
        )
      }

      return NextResponse.json({ id: requestId, status: 'PENDING', type: 'UNBUNDLE', requestedAt: new Date() }, { status: 201 })
    }

    // BUNDLE logic

    if (targetBatchId) {
      const batchRows: { id: string; status: string; distributorId: string }[] = await prisma.$queryRaw`
        SELECT bs.id, bs.status::text, sr."distributorId"
        FROM batch_shipments bs
        JOIN shipment_requests sr ON sr.id = bs."shipmentRequestId"
        WHERE bs.id = ${targetBatchId}
      `
      if (batchRows.length === 0) return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
      if (batchRows[0].distributorId !== distributorId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      if (batchRows[0].status === 'SHIPPED') return NextResponse.json({ error: 'Batch already shipped' }, { status: 400 })
    }

    const orderRows: { id: string; orderNumber: string; status: string; distributorId: string }[] =
      await prisma.$queryRaw`
        SELECT id, "orderNumber", status::text, "distributorId"
        FROM orders
        WHERE id = ANY(${orderIds}::text[])
      `

    if (orderRows.length !== orderIds.length) {
      return NextResponse.json({ error: 'One or more orders not found' }, { status: 404 })
    }

    const BUNDLE_ELIGIBLE_STATUSES = new Set(['CONFIRMED', 'PAYMENT_PENDING', 'PAYMENT_CONFIRMED', 'READY_TO_SHIP'])

    for (const order of orderRows) {
      if (order.distributorId !== distributorId) {
        return NextResponse.json({ error: `Order ${order.orderNumber} does not belong to you` }, { status: 403 })
      }
      if (!BUNDLE_ELIGIBLE_STATUSES.has(order.status)) {
        return NextResponse.json({ error: `Order ${order.orderNumber} is not ready for shipment` }, { status: 400 })
      }
    }

    const pendingRows: { orderId: string; orderNumber: string }[] = await prisma.$queryRaw`
      SELECT sro."orderId", o."orderNumber"
      FROM shipment_request_orders sro
      JOIN shipment_requests sr ON sr.id = sro."shipmentRequestId"
      JOIN orders o ON o.id = sro."orderId"
      WHERE sro."orderId" = ANY(${orderIds}::text[]) AND sr.status = 'PENDING'
    `

    if (pendingRows.length > 0) {
      const nums = pendingRows.map((r) => r.orderNumber).join(', ')
      return NextResponse.json({ error: `Orders already in a pending request: ${nums}` }, { status: 400 })
    }

    const requestId = `c${Math.random().toString(36).slice(2, 22)}`
    if (targetBatchId) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO shipment_requests (id, "distributorId", status, "targetBatchId", "requestedAt")
         VALUES ($1, $2, 'PENDING', $3, NOW())`,
        requestId, distributorId, targetBatchId
      )
    } else {
      await prisma.$executeRawUnsafe(
        `INSERT INTO shipment_requests (id, "distributorId", status, "requestedAt")
         VALUES ($1, $2, 'PENDING', NOW())`,
        requestId, distributorId
      )
    }

    for (const orderId of orderIds) {
      const rowId = `c${Math.random().toString(36).slice(2, 22)}`
      await prisma.$executeRawUnsafe(
        `INSERT INTO shipment_request_orders (id, "shipmentRequestId", "orderId") VALUES ($1, $2, $3)`,
        rowId, requestId, orderId
      )
    }

    return NextResponse.json({ id: requestId, status: 'PENDING', requestedAt: new Date() }, { status: 201 })
  } catch (e) {
    console.error('[SHIPMENT REQUEST CREATE ERROR]', e)
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
