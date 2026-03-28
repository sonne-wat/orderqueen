import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { DistributorNav } from '@/components/layout/DistributorNav'

export default async function DistributorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session) redirect('/login')
  if (session.user?.role === 'ADMIN') redirect('/admin/dashboard')

  return (
    <div className="min-h-screen bg-gray-50">
      <DistributorNav userName={session.user?.name} />
      <main>{children}</main>
    </div>
  )
}
