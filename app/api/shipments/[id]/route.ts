import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || session.user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const { cbm, weightKg, scheduledDate, carrier, trackingNumber, notes, palletCount, cartonCount } =
    await req.json()

  const shipment = await prisma.shipment.update({
    where: { id },
    data: {
      cbm: cbm ? Number(cbm) : null,
      weightKg: weightKg ? Number(weightKg) : null,
      scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
      carrier: carrier || null,
      trackingNumber: trackingNumber || null,
      notes: notes || null,
      palletCount: palletCount ? Number(palletCount) : null,
      cartonCount: cartonCount ? Number(cartonCount) : null,
    },
  })

  return NextResponse.json({ shipment })
}
