import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/batch-shipments
export async function GET(_: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rows: {
    id: string; batchNumber: string; status: string; cbm: number | null; weightKg: number | null;
    carrier: string | null; scheduledDate: Date | null; createdAt: Date;
    shipmentRequestId: string; distributorId: string;
    distributorName: string; distributorCompany: string | null;
    orderId: string | null; orderNumber: string | null; orderStatus: string | null;
  }[] = session.user?.role === 'ADMIN'
    ? await prisma.$queryRaw`
        SELECT bs.id, bs."batchNumber", bs.status, bs.cbm, bs."weightKg", bs.carrier, bs."scheduledDate", bs."createdAt",
               bs."shipmentRequestId", sr."distributorId",
               u.name AS "distributorName", u.company AS "distributorCompany",
               s."orderId", o."orderNumber", o.status AS "orderStatus"
        FROM batch_shipments bs
        JOIN shipment_requests sr ON sr.id = bs."shipmentRequestId"
        JOIN users u ON u.id = sr."distributorId"
        LEFT JOIN shipments s ON s."batchShipmentId" = bs.id
        LEFT JOIN orders o ON o.id = s."orderId"
        ORDER BY bs."createdAt" DESC
      `
    : await prisma.$queryRaw`
        SELECT bs.id, bs."batchNumber", bs.status, bs.cbm, bs."weightKg", bs.carrier, bs."scheduledDate", bs."createdAt",
               bs."shipmentRequestId", sr."distributorId",
               u.name AS "distributorName", u.company AS "distributorCompany",
               s."orderId", o."orderNumber", o.status AS "orderStatus"
        FROM batch_shipments bs
        JOIN shipment_requests sr ON sr.id = bs."shipmentRequestId"
        JOIN users u ON u.id = sr."distributorId"
        LEFT JOIN shipments s ON s."batchShipmentId" = bs.id
        LEFT JOIN orders o ON o.id = s."orderId"
        WHERE sr."distributorId" = ${session.user?.id}
          AND bs.status != 'SHIPPED'
        ORDER BY bs."createdAt" DESC
      `

  // Group by batch shipment id
  const batchMap = new Map<string, {
    id: string; batchNumber: string; status: string; cbm: number | null; weightKg: number | null;
    carrier: string | null; scheduledDate: Date | null; createdAt: Date;
    shipmentRequest: {
      id: string;
      distributor: { id: string; name: string; company: string | null };
      orders: { order: { id: string; orderNumber: string; status: string } }[]
    }
  }>()

  for (const row of rows) {
    if (!batchMap.has(row.id)) {
      batchMap.set(row.id, {
        id: row.id, batchNumber: row.batchNumber, status: row.status,
        cbm: row.cbm, weightKg: row.weightKg,
        carrier: row.carrier, scheduledDate: row.scheduledDate, createdAt: row.createdAt,
        shipmentRequest: {
          id: row.shipmentRequestId,
          distributor: { id: row.distributorId, name: row.distributorName, company: row.distributorCompany },
          orders: [],
        },
      })
    }
    if (row.orderId && row.orderNumber && row.orderStatus) {
      batchMap.get(row.id)!.shipmentRequest.orders.push({
        order: { id: row.orderId, orderNumber: row.orderNumber, status: row.orderStatus },
      })
    }
  }

  const all = Array.from(batchMap.values())
  // Distributor gets active (non-SHIPPED) batches under 'batches' key
  if (session.user?.role === 'DISTRIBUTOR') {
    return NextResponse.json({
      batches: all
        .filter((b) => b.status !== 'SHIPPED')
        .map((b) => ({ ...b, orderCount: b.shipmentRequest.orders.length })),
    })
  }
  return NextResponse.json({ batchShipments: all })
}
