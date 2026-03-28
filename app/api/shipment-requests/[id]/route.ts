import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/shipment-requests/[id]
export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const rows: {
    id: string; distributorId: string; status: string; type: string; requestedAt: Date;
    reviewedAt: Date | null; rejectionNote: string | null; targetBatchId: string | null;
    distributorName: string; distributorEmail: string; distributorCompany: string | null;
    targetBatchNumber: string | null;
  }[] = await prisma.$queryRaw`
    SELECT sr.id, sr."distributorId", sr.status::text, sr.type::text, sr."requestedAt", sr."reviewedAt",
           sr."rejectionNote", sr."targetBatchId",
           u.name AS "distributorName", u.email AS "distributorEmail", u.company AS "distributorCompany",
           tb."batchNumber" AS "targetBatchNumber"
    FROM shipment_requests sr
    JOIN users u ON u.id = sr."distributorId"
    LEFT JOIN batch_shipments tb ON tb.id = sr."targetBatchId"
    WHERE sr.id = ${id}
  `
  if (rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const req = rows[0]

  if (session.user?.role === 'DISTRIBUTOR' && req.distributorId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Fetch orders with items
  const orderRows: {
    sroId: string; orderId: string; orderNumber: string; orderStatus: string;
    shippingMode: string | null; requestedDelivery: Date | null;
    itemId: string; productId: string; productName: string; productSku: string;
    requestedQty: number; confirmedQty: number | null;
  }[] = await prisma.$queryRaw`
    SELECT sro.id AS "sroId", sro."orderId",
           o."orderNumber", o.status::text AS "orderStatus", o."shippingMode", o."requestedDelivery",
           oi.id AS "itemId", oi."productId", p.name AS "productName", p.sku AS "productSku",
           oi."requestedQty", oi."confirmedQty"
    FROM shipment_request_orders sro
    JOIN orders o ON o.id = sro."orderId"
    JOIN order_items oi ON oi."orderId" = o.id
    JOIN products p ON p.id = oi."productId"
    WHERE sro."shipmentRequestId" = ${id}
    ORDER BY sro.id, oi.id
  `

  // Group by order
  const orderMap = new Map<string, {
    id: string; orderId: string;
    order: {
      id: string; orderNumber: string; status: string;
      shippingMode: string | null; requestedDelivery: Date | null;
      hasPendingUnbundle: boolean;
      items: { id: string; product: { id: string; name: string; sku: string }; requestedQty: number; confirmedQty: number | null }[]
    }
  }>()

  for (const row of orderRows) {
    if (!orderMap.has(row.sroId)) {
      orderMap.set(row.sroId, {
        id: row.sroId,
        orderId: row.orderId,
        order: {
          id: row.orderId,
          orderNumber: row.orderNumber,
          status: row.orderStatus,
          shippingMode: row.shippingMode,
          requestedDelivery: row.requestedDelivery,
          hasPendingUnbundle: false,
          items: [],
        },
      })
    }
    orderMap.get(row.sroId)!.order.items.push({
      id: row.itemId,
      product: { id: row.productId, name: row.productName, sku: row.productSku },
      requestedQty: row.requestedQty,
      confirmedQty: row.confirmedQty,
    })
  }

  // Check which orders already have a pending UNBUNDLE request
  const orderIds = Array.from(orderMap.values()).map((e) => e.orderId)
  if (orderIds.length > 0) {
    const pendingUnbundleRows: { orderId: string }[] = await prisma.$queryRaw`
      SELECT sro."orderId"
      FROM shipment_request_orders sro
      JOIN shipment_requests sr ON sr.id = sro."shipmentRequestId"
      WHERE sro."orderId" = ANY(${orderIds}::text[])
        AND sr.status = 'PENDING'
        AND sr.type::text = 'UNBUNDLE'
        AND sr.id != ${id}
    `
    const pendingSet = new Set(pendingUnbundleRows.map((r) => r.orderId))
    for (const entry of orderMap.values()) {
      if (pendingSet.has(entry.orderId)) {
        entry.order.hasPendingUnbundle = true
      }
    }
  }

  // Fetch batchShipment if exists
  const batchRows: { id: string; status: string; batchNumber: string }[] = await prisma.$queryRaw`
    SELECT id, status::text, "batchNumber" FROM batch_shipments WHERE "shipmentRequestId" = ${id}
  `
  const batchShipment = batchRows.length > 0 ? batchRows[0] : null

  return NextResponse.json({
    request: {
      id: req.id,
      distributorId: req.distributorId,
      status: req.status,
      type: req.type,
      requestedAt: req.requestedAt,
      reviewedAt: req.reviewedAt,
      rejectionNote: req.rejectionNote,
      targetBatchId: req.targetBatchId,
      targetBatchNumber: req.targetBatchNumber,
      distributor: { id: req.distributorId, name: req.distributorName, email: req.distributorEmail, company: req.distributorCompany },
      orders: Array.from(orderMap.values()),
      batchShipment,
    },
  })
}
