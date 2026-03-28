import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// POST /api/shipment-requests/[id]/reject
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || session.user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const { rejectionNote } = await req.json()

  if (!rejectionNote?.trim()) {
    return NextResponse.json({ error: 'Rejection note is required' }, { status: 400 })
  }

  const rows: { id: string; status: string }[] = await prisma.$queryRaw`
    SELECT id, status FROM shipment_requests WHERE id = ${id}
  `
  if (rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (rows[0].status !== 'PENDING') {
    return NextResponse.json({ error: 'Request is not in PENDING status' }, { status: 400 })
  }

  await prisma.$executeRawUnsafe(
    `UPDATE shipment_requests SET status = 'REJECTED', "reviewedAt" = NOW(), "rejectionNote" = $1 WHERE id = $2`,
    rejectionNote.trim(), id
  )

  return NextResponse.json({ status: 'REJECTED' })
}
