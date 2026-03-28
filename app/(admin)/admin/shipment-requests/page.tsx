import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import Link from 'next/link'

const STATUS_STYLE: Record<string, string> = {
  PENDING:  'bg-yellow-100 text-yellow-800',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
}

export default async function AdminShipmentRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const session = await auth()
  if (!session || session.user?.role !== 'ADMIN') redirect('/login')

  const { status } = await searchParams
  const filterStatus = status && ['PENDING', 'APPROVED', 'REJECTED'].includes(status) ? status : null

  const rows: {
    id: string; status: string; type: string; requestedAt: Date; reviewedAt: Date | null;
    targetBatchId: string | null; targetBatchNumber: string | null;
    distributorId: string; distributorName: string; distributorCompany: string | null;
    orderId: string; orderNumber: string;
  }[] = filterStatus
    ? await prisma.$queryRaw`
        SELECT sr.id, sr.status::text, sr.type::text, sr."requestedAt", sr."reviewedAt", sr."targetBatchId",
               tb."batchNumber" AS "targetBatchNumber",
               sr."distributorId",
               u.name AS "distributorName", u.company AS "distributorCompany",
               sro."orderId", o."orderNumber"
        FROM shipment_requests sr
        JOIN users u ON u.id = sr."distributorId"
        JOIN shipment_request_orders sro ON sro."shipmentRequestId" = sr.id
        JOIN orders o ON o.id = sro."orderId"
        LEFT JOIN batch_shipments tb ON tb.id = sr."targetBatchId"
        WHERE sr.status = ${filterStatus}
        ORDER BY sr."requestedAt" DESC
      `
    : await prisma.$queryRaw`
        SELECT sr.id, sr.status::text, sr.type::text, sr."requestedAt", sr."reviewedAt", sr."targetBatchId",
               tb."batchNumber" AS "targetBatchNumber",
               sr."distributorId",
               u.name AS "distributorName", u.company AS "distributorCompany",
               sro."orderId", o."orderNumber"
        FROM shipment_requests sr
        JOIN users u ON u.id = sr."distributorId"
        JOIN shipment_request_orders sro ON sro."shipmentRequestId" = sr.id
        JOIN orders o ON o.id = sro."orderId"
        LEFT JOIN batch_shipments tb ON tb.id = sr."targetBatchId"
        ORDER BY sr."requestedAt" DESC
      `

  // Group by request id
  const requestMap = new Map<string, {
    id: string; status: string; type: string; requestedAt: Date;
    targetBatchId: string | null; targetBatchNumber: string | null;
    distributor: { id: string; name: string; company: string | null };
    orders: { orderId: string; orderNumber: string }[]
  }>()
  for (const row of rows) {
    if (!requestMap.has(row.id)) {
      requestMap.set(row.id, {
        id: row.id, status: row.status, type: row.type, requestedAt: row.requestedAt,
        targetBatchId: row.targetBatchId, targetBatchNumber: row.targetBatchNumber,
        distributor: { id: row.distributorId, name: row.distributorName, company: row.distributorCompany },
        orders: [],
      })
    }
    requestMap.get(row.id)!.orders.push({ orderId: row.orderId, orderNumber: row.orderNumber })
  }
  const requests = Array.from(requestMap.values())

  const countRows: { count: bigint }[] = await prisma.$queryRaw`
    SELECT COUNT(*) as count FROM shipment_requests WHERE status = 'PENDING'
  `
  const pendingCount = Number(countRows[0]?.count ?? 0)

  const tabs = [
    { label: 'All', value: null },
    { label: `Pending${pendingCount > 0 ? ` (${pendingCount})` : ''}`, value: 'PENDING' },
    { label: 'Approved', value: 'APPROVED' },
    { label: 'Rejected', value: 'REJECTED' },
  ]

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Shipment Requests</h1>
        {pendingCount > 0 && (
          <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
            {pendingCount} awaiting review
          </span>
        )}
      </div>

      <div className="flex gap-2 mb-6 border-b">
        {tabs.map((tab) => {
          const href = tab.value ? `/admin/shipment-requests?status=${tab.value}` : '/admin/shipment-requests'
          const active = filterStatus === tab.value
          return (
            <Link
              key={tab.label}
              href={href}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                active ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </Link>
          )
        })}
      </div>

      {requests.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center text-gray-400">No shipment requests found.</div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => (
            <Link
              key={req.id}
              href={`/admin/shipment-requests/${req.id}`}
              className="block bg-white rounded-xl border px-5 py-4 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLE[req.status]}`}>
                    {req.status}
                  </span>
                  {req.type === 'UNBUNDLE' ? (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-200">
                      Unbundle
                    </span>
                  ) : req.targetBatchNumber ? (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                      Add to {req.targetBatchNumber}
                    </span>
                  ) : (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                      New Batch
                    </span>
                  )}
                  <span className="font-medium text-sm">{req.distributor.company || req.distributor.name}</span>
                  <span className="text-sm text-gray-400">{req.orders.length} order{req.orders.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-gray-400">{new Date(req.requestedAt).toLocaleDateString('ko-KR')}</span>
                  <span className="text-blue-600 text-sm">Review →</span>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {req.orders.map((o) => (
                  <span key={o.orderId} className="text-xs font-mono bg-gray-50 border rounded px-2 py-0.5 text-gray-600">
                    {o.orderNumber}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
