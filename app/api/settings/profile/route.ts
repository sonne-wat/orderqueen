import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rows = await prisma.$queryRaw<{
    id: string; name: string; company: string | null; email: string;
    phone: string | null; address: string | null; shippingAddress: string | null;
    notificationEmails: string[];
  }[]>`
    SELECT id, name, company, email, phone, address, "shippingAddress", "notificationEmails"
    FROM users WHERE id = ${session.user?.id!}
  `

  return NextResponse.json(rows[0] ?? null)
}

export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, company, phone, address, shippingAddress, notificationEmails } = await req.json()

  const emails: string[] = Array.isArray(notificationEmails)
    ? notificationEmails.map((e: string) => e.trim()).filter(Boolean)
    : []

  await prisma.$executeRawUnsafe(
    `UPDATE users SET
      name = $1,
      company = $2,
      phone = $3,
      address = $4,
      "shippingAddress" = $5,
      "notificationEmails" = $6,
      "updatedAt" = NOW()
    WHERE id = $7`,
    name ?? null,
    company ?? null,
    phone ?? null,
    address ?? null,
    shippingAddress ?? null,
    emails,
    session.user?.id!,
  )

  const rows = await prisma.$queryRaw<{
    id: string; name: string; company: string | null; email: string;
    phone: string | null; address: string | null; shippingAddress: string | null;
    notificationEmails: string[];
  }[]>`
    SELECT id, name, company, email, phone, address, "shippingAddress", "notificationEmails"
    FROM users WHERE id = ${session.user?.id!}
  `

  return NextResponse.json(rows[0])
}
