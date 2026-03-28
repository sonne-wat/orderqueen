import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/batch-shipments/[id]
export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const batchRows: {
    id: string; batchNumber: string; shipmentRequestId: string; status: string;
    cbm: number | null; weightKg: number | null; scheduledDate: Date | null;
    carrier: string | null; trackingNumber: string | null; notes: string | null;
    palletCount: number | null; cartonCount: number | null;
    createdAt: Date; updatedAt: Date;
    distributorId: string; distributorName: string; distributorCompany: string | null;
  }[] = await prisma.$queryRaw`
    SELECT bs.id, bs."batchNumber", bs."shipmentRequestId", bs.status::text,
           bs.cbm, bs."weightKg", bs."scheduledDate", bs.carrier, bs."trackingNumber",
           bs.notes, bs."palletCount", bs."cartonCount", bs."createdAt", bs."updatedAt",
           sr."distributorId", u.name AS "distributorName", u.company AS "distributorCompany"
    FROM batch_shipments bs
    JOIN shipment_requests sr ON sr.id = bs."shipmentRequestId"
    JOIN users u ON u.id = sr."distributorId"
    WHERE bs.id = ${id}
  `
  if (batchRows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const batch = batchRows[0]

  if (session.user?.role === 'DISTRIBUTOR' && batch.distributorId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Query via shipments table so add-to-batch orders (from separate ShipmentRequests) are included
  const orderRows: { orderId: string; orderNumber: string; status: string; shippingMode: string | null; requestedDelivery: Date | null }[] = await prisma.$queryRaw`
    SELECT s."orderId", o."orderNumber", o.status::text, o."shippingMode", o."requestedDelivery"
    FROM shipments s
    JOIN orders o ON o.id = s."orderId"
    WHERE s."batchShipmentId" = ${id}
  `

  const shipmentRows: { id: string; status: string }[] = await prisma.$queryRaw`
    SELECT id, status::text FROM shipments WHERE "batchShipmentId" = ${id}
  `

  return NextResponse.json({
    batchShipment: {
      id: batch.id,
      batchNumber: batch.batchNumber,
      shipmentRequestId: batch.shipmentRequestId,
      status: batch.status,
      cbm: batch.cbm,
      weightKg: batch.weightKg,
      scheduledDate: batch.scheduledDate,
      carrier: batch.carrier,
      trackingNumber: batch.trackingNumber,
      notes: batch.notes,
      palletCount: batch.palletCount,
      cartonCount: batch.cartonCount,
      createdAt: batch.createdAt,
      updatedAt: batch.updatedAt,
      shipmentRequest: {
        id: batch.shipmentRequestId,
        distributor: { id: batch.distributorId, name: batch.distributorName, company: batch.distributorCompany },
        orders: orderRows.map((o) => ({
          id: o.orderId,
          orderId: o.orderId,
          order: { id: o.orderId, orderNumber: o.orderNumber, status: o.status, shippingMode: o.shippingMode, requestedDelivery: o.requestedDelivery },
        })),
      },
      shipments: shipmentRows,
    },
  })
}

// PUT /api/batch-shipments/[id] — update cargo details
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || session.user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const { cbm, weightKg, scheduledDate, carrier, trackingNumber, notes, palletCount, cartonCount } = await req.json()

  const exists: { id: string }[] = await prisma.$queryRaw`SELECT id FROM batch_shipments WHERE id = ${id}`
  if (exists.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.$executeRawUnsafe(
    `UPDATE batch_shipments
     SET cbm = $1, "weightKg" = $2, "scheduledDate" = $3, carrier = $4,
         "trackingNumber" = $5, notes = $6, "palletCount" = $7, "cartonCount" = $8, "updatedAt" = NOW()
     WHERE id = $9`,
    cbm != null ? cbm : null,
    weightKg != null ? weightKg : null,
    scheduledDate ? new Date(scheduledDate) : null,
    carrier || null,
    trackingNumber || null,
    notes || null,
    palletCount != null ? Number(palletCount) : null,
    cartonCount != null ? Number(cartonCount) : null,
    id,
  )

  return NextResponse.json({ success: true })
}
