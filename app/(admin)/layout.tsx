import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { AdminNav } from '@/components/layout/AdminNav'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session || session.user?.role !== 'ADMIN') redirect('/login')

  const pendingResult = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) as count FROM shipment_requests WHERE status = 'PENDING'
  `
  const pendingRequestCount = Number(pendingResult[0]?.count ?? 0)

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav userName={session.user?.name} pendingRequestCount={pendingRequestCount} />
      <main>{children}</main>
    </div>
  )
}
