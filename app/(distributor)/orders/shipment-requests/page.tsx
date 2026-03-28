'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

type RequestSummary = {
  id: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  type: 'BUNDLE' | 'UNBUNDLE'
  requestedAt: string
  reviewedAt: string | null
  rejectionNote: string | null
  targetBatchId: string | null
  orderCount: number
  batchShipmentId: string | null
  batchNumber: string | null
}

type ActiveBatch = {
  id: string
  batchNumber: string
  status: string
  orderCount: number
  scheduledDate: string | null
}

const STATUS_STYLE: Record<string, string> = {
  PENDING:  'bg-yellow-100 text-yellow-800',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
}

const STATUS_LABEL: Record<string, string> = {
  PENDING:  'Awaiting Review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
}

const BATCH_STATUS_STYLE: Record<string, string> = {
  PREPARING: 'bg-orange-100 text-orange-700',
  READY:     'bg-blue-100 text-blue-700',
  SHIPPED:   'bg-gray-100 text-gray-600',
}

export default function ShipmentRequestsPage() {
  const [requests, setRequests] = useState<RequestSummary[]>([])
  const [activeBatches, setActiveBatches] = useState<ActiveBatch[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/shipment-requests').then((r) => r.json()),
      fetch('/api/batch-shipments').then((r) => r.json()),
    ]).then(([reqData, batchData]) => {
      setRequests(reqData.requests ?? [])
      setActiveBatches(batchData.batches ?? [])
      setLoading(false)
    })
  }, [])

  return (
    <main className="max-w-3xl mx-auto px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link href="/dashboard" className="text-sm text-gray-400 hover:underline">← Dashboard</Link>
          <h1 className="text-xl font-semibold mt-2">Shipment Requests</h1>
        </div>
        <Link
          href="/orders/shipping-request"
          className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
        >
          + New Batch Request
        </Link>
      </div>

      {loading ? (
        <div className="text-gray-400 text-center py-12">Loading...</div>
      ) : (
        <>
          {/* Active Batches — show non-SHIPPED batches with Add Orders option */}
          {activeBatches.length > 0 && (
            <div className="mb-6">
              <h2 className="text-sm font-semibold text-gray-500 mb-2 uppercase tracking-wide">Active Batch Shipments</h2>
              <div className="bg-white rounded-xl border divide-y">
                {activeBatches.map((batch) => (
                  <div key={batch.id} className="px-5 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm font-bold text-green-700 bg-green-50 border border-green-200 px-2.5 py-0.5 rounded-full">
                        {batch.batchNumber}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${BATCH_STATUS_STYLE[batch.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {batch.status}
                      </span>
                      <span className="text-sm text-gray-500">{batch.orderCount} orders</span>
                      {batch.scheduledDate && (
                        <span className="text-xs text-gray-400">
                          Scheduled: {new Date(batch.scheduledDate).toLocaleDateString('ko-KR')}
                        </span>
                      )}
                    </div>
                    <Link
                      href={`/orders/batch-add/${batch.id}`}
                      className="px-3 py-1.5 bg-white border border-green-500 text-green-600 rounded-lg text-xs font-medium hover:bg-green-50"
                    >
                      + Add Orders
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Request History */}
          {requests.length === 0 ? (
            <div className="bg-white rounded-xl border p-12 text-center text-gray-400">
              <p className="mb-2">No shipment requests yet.</p>
              <Link href="/orders/shipping-request" className="text-green-600 hover:underline text-sm">
                Request batch shipment →
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-sm font-semibold text-gray-500 mb-2 uppercase tracking-wide">Request History</h2>
              <div className="bg-white rounded-xl border divide-y">
                {requests.map((req) => (
                  <Link key={req.id} href={`/orders/shipment-requests/${req.id}`} className="block px-5 py-4 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLE[req.status]}`}>
                          {STATUS_LABEL[req.status]}
                        </span>
                        {req.type === 'UNBUNDLE' ? (
                          <span className="text-xs px-2 py-0.5 bg-orange-50 text-orange-700 border border-orange-200 rounded-full font-medium">
                            Unbundle from {req.batchNumber ?? req.targetBatchId}
                          </span>
                        ) : req.targetBatchId ? (
                          <span className="text-xs px-2 py-0.5 bg-indigo-50 text-indigo-600 border border-indigo-200 rounded-full font-medium">
                            Add to {req.batchNumber ?? 'Batch'}
                          </span>
                        ) : req.batchNumber ? (
                          <span className="font-mono text-xs font-bold text-green-700">
                            {req.batchNumber}
                          </span>
                        ) : null}
                        <span className="text-sm font-medium">{req.orderCount} orders</span>
                      </div>
                      <span className="text-xs text-gray-400">
                        {new Date(req.requestedAt).toLocaleDateString('ko-KR')}
                      </span>
                    </div>
                    {req.status === 'REJECTED' && req.rejectionNote && (
                      <p className="mt-2 text-xs text-red-600 bg-red-50 rounded px-3 py-2">
                        Rejected: {req.rejectionNote}
                      </p>
                    )}
                    {req.reviewedAt && req.status !== 'REJECTED' && (
                      <p className="mt-1 text-xs text-gray-400">
                        Reviewed: {new Date(req.reviewedAt).toLocaleDateString('ko-KR')}
                      </p>
                    )}
                  </Link>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </main>
  )
}
