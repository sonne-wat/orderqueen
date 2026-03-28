import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { OrderStatusBadge } from '@/components/orders/OrderStatusBadge'

export default async function AdminDashboardPage() {
  const session = await auth()
  if (!session || session.user?.role !== 'ADMIN') redirect('/login')

  const [total, submitted, confirmed, readyToShip] = await Promise.all([
    prisma.order.count(),
    prisma.order.count({ where: { status: 'SUBMITTED' } }),
    prisma.order.count({ where: { status: 'CONFIRMED' } }),
    prisma.order.count({ where: { status: 'READY_TO_SHIP' } }),
  ])

  const recent = await prisma.order.findMany({
    take: 5,
    include: { distributor: { select: { name: true, company: true } } },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div>
      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Orders', value: total, color: 'text-gray-700' },
            { label: 'Awaiting Review', value: submitted, color: 'text-blue-600' },
            { label: 'Confirmed', value: confirmed, color: 'text-green-600' },
            { label: 'Ready to Ship', value: readyToShip, color: 'text-purple-600' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-xl border p-5">
              <div className={`text-3xl font-bold ${color}`}>{value}</div>
              <div className="text-sm text-gray-500 mt-1">{label}</div>
            </div>
          ))}
        </div>

        {/* Recent Orders */}
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="px-6 py-4 border-b flex items-center justify-between">
            <h2 className="font-semibold">Recent Orders</h2>
            <Link href="/admin/orders" className="text-sm text-blue-600 hover:underline">All →</Link>
          </div>
          <table className="w-full text-sm">
            <tbody>
              {recent.map((order) => (
                <tr key={order.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-6 py-4 font-mono text-xs">{order.orderNumber}</td>
                  <td className="px-6 py-4">
                    <div className="font-medium">{order.distributor.name}</div>
                    <div className="text-xs text-gray-400">{order.distributor.company}</div>
                  </td>
                  <td className="px-6 py-4"><OrderStatusBadge status={order.status} /></td>
                  <td className="px-6 py-4 text-gray-400">{order.createdAt.toLocaleDateString('ko-KR')}</td>
                  <td className="px-6 py-4 text-right">
                    <Link href={`/admin/orders/${order.id}`} className="text-blue-600 hover:underline text-xs">Review →</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  )
}
