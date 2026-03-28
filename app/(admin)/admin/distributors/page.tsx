import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { orderTotal } from '@/lib/utils/order'

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  PENDING:   { label: 'Pending',   className: 'bg-yellow-100 text-yellow-700' },
  ACTIVE:    { label: 'Active',    className: 'bg-green-100 text-green-700' },
  SUSPENDED: { label: 'Suspended', className: 'bg-red-100 text-red-700' },
}

const activeStatuses = ['SUBMITTED', 'CONFIRMED', 'PAYMENT_PENDING', 'PAYMENT_CONFIRMED', 'READY_TO_SHIP']

export default async function DistributorsPage() {
  const session = await auth()
  if (!session || session.user?.role !== 'ADMIN') redirect('/login')

  const distributors = await prisma.user.findMany({
    where: { role: 'DISTRIBUTOR' },
    include: {
      orders: {
        where: { status: { not: 'DRAFT' } },
        include: { items: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  const pending = distributors.filter((d) => d.status === 'PENDING')
  const others  = distributors.filter((d) => d.status !== 'PENDING')

  return (
    <div>
      <main className="max-w-6xl mx-auto px-6 py-8">
        <h1 className="text-xl font-bold mb-6">Distributor Management ({distributors.length})</h1>

        {/* 승인 대기 섹션 */}
        {pending.length > 0 && (
          <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
              <h2 className="font-semibold text-yellow-800">Pending Approval ({pending.length})</h2>
            </div>
            <div className="bg-white rounded-lg border border-yellow-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-yellow-50 border-b border-yellow-100">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-yellow-700">Name / Company</th>
                    <th className="px-4 py-2 text-left font-medium text-yellow-700">Email</th>
                    <th className="px-4 py-2 text-left font-medium text-yellow-700">Phone</th>
                    <th className="px-4 py-2 text-left font-medium text-yellow-700">Registered</th>
                    <th className="px-4 py-2 text-center font-medium text-yellow-700">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pending.map((d) => (
                    <tr key={d.id} className="border-b last:border-0">
                      <td className="px-4 py-2">
                        <div className="font-medium">{d.name}</div>
                        <div className="text-xs text-gray-400">{d.company ?? '-'}</div>
                      </td>
                      <td className="px-4 py-2 text-gray-500">{d.email}</td>
                      <td className="px-4 py-2 text-gray-500">{d.phone ?? '-'}</td>
                      <td className="px-4 py-2 text-gray-400 text-xs">
                        {new Date(d.createdAt).toLocaleDateString('ko-KR')}
                      </td>
                      <td className="px-4 py-2 text-center">
                        <Link
                          href={`/admin/distributors/${d.id}`}
                          className="px-3 py-1 bg-yellow-500 text-white rounded text-xs font-medium hover:bg-yellow-600"
                        >
                          Review & Approve →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 전체 목록 */}
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Name / Company</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Email</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Status</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Total Orders</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Active</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Total ($)</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Credit Limit</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Action</th>
              </tr>
            </thead>
            <tbody>
              {distributors.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">등록된 Distributor가 없습니다</td></tr>
              ) : (
                <>
                  {[...others, ...pending].map((d) => {
                    const total  = d.orders.reduce((s, o) => s + orderTotal(o.items), 0)
                    const active = d.orders.filter((o) => activeStatuses.includes(o.status)).length
                    const badge  = STATUS_BADGE[d.status] ?? STATUS_BADGE.PENDING
                    return (
                      <tr key={d.id} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="font-medium">{d.name}</div>
                          <div className="text-xs text-gray-400">{d.company ?? '-'}</div>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-sm">{d.email}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge.className}`}>{badge.label}</span>
                        </td>
                        <td className="px-4 py-3 text-center">{d.orders.length}</td>
                        <td className="px-4 py-3 text-center">
                          {active > 0 ? (
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs">{active}</span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-sm">
                          ${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-500 text-sm">
                          {d.creditLimit ? `$${Number(d.creditLimit).toLocaleString()}` : '-'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Link href={`/admin/distributors/${d.id}`} className="text-blue-600 hover:underline text-xs">
                            View →
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  )
}
