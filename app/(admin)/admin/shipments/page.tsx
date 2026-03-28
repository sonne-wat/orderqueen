import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import Link from 'next/link'

const SHIPMENT_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  PREPARING: { label: 'Preparing',   color: 'bg-yellow-100 text-yellow-700' },
  READY:     { label: 'Ready',       color: 'bg-green-100 text-green-700' },
  SHIPPED:   { label: 'Shipped',     color: 'bg-blue-100 text-blue-700' },
}

export default async function ShipmentsPage() {
  const session = await auth()
  if (!session || session.user?.role !== 'ADMIN') redirect('/login')

  const shipments = await prisma.shipment.findMany({
    include: {
      order: {
        select: {
          id: true,
          orderNumber: true,
          status: true,
          distributor: { select: { name: true, company: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div>
      <main className="max-w-6xl mx-auto px-6 py-8">
        <h1 className="text-xl font-bold mb-6">Shipping Schedule</h1>
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Order #</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Distributor</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">CBM (m³)</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Weight (kg)</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Carrier</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Scheduled</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Status</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Action</th>
              </tr>
            </thead>
            <tbody>
              {shipments.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">선적 정보가 없습니다</td></tr>
              ) : shipments.map((s) => {
                const statusConfig = SHIPMENT_STATUS_CONFIG[s.status]
                return (
                  <tr key={s.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs">{s.order.orderNumber}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{s.order.distributor.name}</div>
                      <div className="text-xs text-gray-400">{s.order.distributor.company}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {s.cbm ? String(s.cbm) : '-'}
                    </td>
                    <td className="px-4 py-3 text-right">{s.weightKg ? `${s.weightKg}` : '-'}</td>
                    <td className="px-4 py-3">{s.carrier ?? '-'}</td>
                    <td className="px-4 py-3">{s.scheduledDate ? new Date(s.scheduledDate).toLocaleDateString('ko-KR') : '-'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig.color}`}>
                        {statusConfig.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Link href={`/admin/orders/${s.order.id}/cargo`} className="text-blue-600 hover:underline text-xs">
                        Edit
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  )
}
