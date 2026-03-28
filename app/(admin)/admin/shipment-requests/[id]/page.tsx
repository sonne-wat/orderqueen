'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import type { ShipmentRequestWithDetails } from '@/types'

export default function AdminShipmentRequestDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [request, setRequest] = useState<ShipmentRequestWithDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [rejectionNote, setRejectionNote] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/shipment-requests/${id}`)
      .then((r) => r.json())
      .then((d) => { setRequest(d.request); setLoading(false) })
  }, [id])

  async function handleApprove() {
    setActionLoading(true)
    setError('')
    const res = await fetch(`/api/shipment-requests/${id}/approve`, { method: 'POST' })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Failed to approve.')
      setActionLoading(false)
      return
    }
    if (data.type === 'UNBUNDLE') {
      router.push('/admin/shipment-requests')
    } else {
      router.push(`/admin/batch-shipments/${data.batchShipmentId}/cargo`)
    }
  }

  async function handleReject() {
    if (!rejectionNote.trim()) { setError('Rejection note is required.'); return }
    setActionLoading(true)
    setError('')
    const res = await fetch(`/api/shipment-requests/${id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rejectionNote }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Failed to reject.')
      setActionLoading(false)
      return
    }
    router.push('/admin/shipment-requests')
  }

  if (loading) return <div className="p-8 text-gray-400 text-center">Loading...</div>
  if (!request) return <div className="p-8 text-gray-400 text-center">Request not found.</div>

  const isPending = request.status === 'PENDING'

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="mb-6">
        <Link href="/admin/shipment-requests" className="text-sm text-gray-400 hover:underline">← Shipment Requests</Link>
        <div className="flex items-center gap-3 mt-2">
          <h1 className="text-xl font-semibold">Shipment Request</h1>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            request.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
            request.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
            'bg-red-100 text-red-700'
          }`}>
            {request.status}
          </span>
          {request.type === 'UNBUNDLE' ? (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-200">
              Unbundle Request
            </span>
          ) : (request as { targetBatchNumber?: string }).targetBatchNumber ? (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
              Add to {(request as { targetBatchNumber?: string }).targetBatchNumber}
            </span>
          ) : (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
              New Batch
            </span>
          )}
        </div>
        <div className="mt-1 text-sm text-gray-500">
          <span className="font-medium">{request.distributor.company || request.distributor.name}</span>
          <span className="mx-2">·</span>
          <span>{request.distributor.email}</span>
          <span className="mx-2">·</span>
          <span>Requested {new Date(request.requestedAt).toLocaleDateString('ko-KR')}</span>
        </div>
      </div>

      {/* Orders in Request */}
      <div className="bg-white rounded-xl border mb-6">
        <div className="px-5 py-3 border-b bg-gray-50 rounded-t-xl">
          <span className="text-sm font-semibold text-gray-600">
            Orders in this batch ({request.orders.length})
          </span>
        </div>
        <div className="divide-y">
          {request.orders.map((ro) => (
            <div key={ro.id} className="px-5 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm font-semibold">{ro.order.orderNumber}</span>
                  {ro.order.shippingMode && (
                    <span className="px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-600">
                      {ro.order.shippingMode}
                    </span>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    ro.order.status === 'CONFIRMED' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                  }`}>
                    {ro.order.status}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  {ro.order.requestedDelivery && (
                    <span className="text-xs text-gray-400">
                      Delivery: {new Date(ro.order.requestedDelivery).toLocaleDateString('ko-KR')}
                    </span>
                  )}
                  <Link
                    href={`/admin/orders/${ro.order.id}`}
                    target="_blank"
                    className="text-xs text-blue-600 hover:underline"
                  >
                    View Order ↗
                  </Link>
                </div>
              </div>

              {/* Items summary */}
              {ro.order.items.length > 0 && (
                <div className="mt-2 space-y-1">
                  {ro.order.items.map((item) => (
                    <div key={item.id} className="flex items-center gap-2 text-xs text-gray-500">
                      <span className="font-mono text-gray-400">{item.product.sku}</span>
                      <span>{item.product.name}</span>
                      <span className="ml-auto">
                        {item.confirmedQty != null ? `${item.confirmedQty} confirmed` : `${item.requestedQty} requested`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Rejection note (if rejected) */}
      {request.status === 'REJECTED' && request.rejectionNote && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-6">
          <p className="text-sm font-medium text-red-700">Rejection Reason</p>
          <p className="text-sm text-red-600 mt-1">{request.rejectionNote}</p>
          {request.reviewedAt && (
            <p className="text-xs text-red-400 mt-1">
              Rejected on {new Date(request.reviewedAt).toLocaleDateString('ko-KR')}
            </p>
          )}
        </div>
      )}

      {/* Approval info (if approved) */}
      {request.status === 'APPROVED' && request.type === 'UNBUNDLE' && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg px-4 py-3 mb-6">
          <p className="text-sm font-medium text-orange-700">Unbundle Approved</p>
          <p className="text-xs text-orange-600 mt-0.5">
            Orders have been returned to CONFIRMED status.
            Approved on {request.reviewedAt ? new Date(request.reviewedAt).toLocaleDateString('ko-KR') : '—'}
          </p>
        </div>
      )}
      {request.status === 'APPROVED' && request.type !== 'UNBUNDLE' && request.batchShipment && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 mb-6 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-green-700">Batch Shipment Created</p>
            <p className="text-xs text-green-600 mt-0.5">
              Approved on {request.reviewedAt ? new Date(request.reviewedAt).toLocaleDateString('ko-KR') : '—'}
            </p>
          </div>
          <Link
            href={`/admin/batch-shipments/${request.batchShipment.id}/cargo`}
            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
          >
            Cargo Details →
          </Link>
        </div>
      )}

      {/* Actions */}
      {isPending && (
        <div className="bg-white rounded-xl border px-5 py-5">
          {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

          {showRejectForm ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Rejection Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                value={rejectionNote}
                onChange={(e) => setRejectionNote(e.target.value)}
                rows={3}
                placeholder="Explain why this request is being rejected..."
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 resize-none"
              />
              <div className="flex gap-3 mt-3">
                <button
                  onClick={() => { setShowRejectForm(false); setRejectionNote(''); setError('') }}
                  className="px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReject}
                  disabled={actionLoading}
                  className="px-5 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                >
                  {actionLoading ? 'Rejecting...' : 'Confirm Rejection'}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">
                {request.type === 'UNBUNDLE'
                  ? `The distributor is requesting to remove these orders from batch ${(request as { targetBatchNumber?: string }).targetBatchNumber ?? ''}.`
                  : `Review the ${request.orders.length} orders above and approve or reject this batch shipment request.`}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowRejectForm(true)}
                  className="px-4 py-2 border border-red-300 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50"
                >
                  Reject
                </button>
                <button
                  onClick={handleApprove}
                  disabled={actionLoading}
                  className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {actionLoading ? 'Approving...' : `Approve All ${request.orders.length} Orders →`}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
