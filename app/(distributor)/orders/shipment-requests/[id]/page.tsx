'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import type { ShipmentRequestWithDetails } from '@/types'

const STATUS_STYLE: Record<string, string> = {
  PENDING:  'bg-yellow-100 text-yellow-800',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
}

const STATUS_LABEL: Record<string, string> = {
  PENDING:  'Awaiting Admin Review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
}

export default function ShipmentRequestDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [request, setRequest] = useState<ShipmentRequestWithDetails | null>(null)
  const [loading, setLoading] = useState(true)

  // Unbundle state
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set())
  const [unbundleLoading, setUnbundleLoading] = useState(false)
  const [unbundleError, setUnbundleError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/shipment-requests/${id}`)
      .then((r) => r.json())
      .then((d) => { setRequest(d.request); setLoading(false) })
  }, [id])

  const showUnbundleSection =
    request?.status === 'APPROVED' &&
    request?.type !== 'UNBUNDLE' &&
    request?.batchShipment &&
    request.batchShipment.status !== 'SHIPPED' &&
    request.batchShipment.status !== 'BOOKED'

  function toggleOrder(orderId: string) {
    setSelectedOrderIds((prev) => {
      const next = new Set(prev)
      if (next.has(orderId)) next.delete(orderId)
      else next.add(orderId)
      return next
    })
  }

  async function handleUnbundle() {
    if (selectedOrderIds.size === 0) return
    if (!confirm(`Unbundle ${selectedOrderIds.size} order(s) from this batch? Admin approval will be required.`)) return

    setUnbundleLoading(true)
    setUnbundleError(null)
    try {
      const res = await fetch('/api/shipment-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'UNBUNDLE',
          targetBatchId: request!.batchShipment!.id,
          orderIds: Array.from(selectedOrderIds),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setUnbundleError(data.error ?? 'Failed to submit unbundle request')
      } else {
        router.push('/orders/shipment-requests')
      }
    } catch {
      setUnbundleError('Network error')
    } finally {
      setUnbundleLoading(false)
    }
  }

  if (loading) return <div className="p-8 text-gray-400 text-center">Loading...</div>
  if (!request) return <div className="p-8 text-gray-400 text-center">Request not found.</div>

  return (
    <main className="max-w-3xl mx-auto px-6 py-8">
      <div className="mb-6">
        <Link href="/orders/shipment-requests" className="text-sm text-gray-400 hover:underline">← Shipment Requests</Link>
        <div className="flex items-center gap-3 mt-2">
          <h1 className="text-xl font-semibold">Shipment Request</h1>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLE[request.status]}`}>
            {STATUS_LABEL[request.status]}
          </span>
          {request.type === 'UNBUNDLE' && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
              Unbundle
            </span>
          )}
        </div>
        <p className="text-sm text-gray-400 mt-1">
          Requested: {new Date(request.requestedAt).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {request.status === 'REJECTED' && request.rejectionNote && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-6">
          <p className="text-sm font-medium text-red-700">Rejection Reason</p>
          <p className="text-sm text-red-600 mt-1">{request.rejectionNote}</p>
          <Link href="/orders/shipping-request" className="text-sm text-red-700 underline mt-2 inline-block">
            Submit new request →
          </Link>
        </div>
      )}

      {request.status === 'APPROVED' && request.batchShipment && request.type !== 'UNBUNDLE' && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 mb-6">
          <p className="text-sm font-medium text-green-700">Batch Shipment Created</p>
          <p className="text-sm text-green-600 mt-1">Your orders are being prepared for dispatch.</p>
        </div>
      )}

      {request.status === 'APPROVED' && request.type === 'UNBUNDLE' && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg px-4 py-3 mb-6">
          <p className="text-sm font-medium text-orange-700">Unbundle Approved</p>
          <p className="text-sm text-orange-600 mt-1">The selected orders have been returned to CONFIRMED status.</p>
        </div>
      )}

      <div className="bg-white rounded-xl border mb-6">
        <div className="px-5 py-3 border-b bg-gray-50 rounded-t-xl">
          <span className="text-sm font-medium text-gray-600">
            Orders in this request ({request.orders.length})
          </span>
        </div>
        <div className="divide-y">
          {request.orders.map((ro) => (
            <div key={ro.id} className="px-5 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-medium">{ro.order.orderNumber}</span>
                  {ro.order.shippingMode && (
                    <span className="px-1.5 py-0.5 bg-gray-100 rounded text-xs text-gray-600">
                      {ro.order.shippingMode}
                    </span>
                  )}
                </div>
                <Link href={`/orders/${ro.order.id}`} className="text-xs text-blue-600 hover:underline">
                  View →
                </Link>
              </div>
              <p className="text-xs text-gray-400 mt-1">{ro.order.items.length} items</p>
            </div>
          ))}
        </div>
      </div>

      {showUnbundleSection && (
        <div className="bg-white rounded-xl border">
          <div className="px-5 py-3 border-b bg-orange-50 rounded-t-xl">
            <span className="text-sm font-medium text-orange-700">Request to Unbundle Orders</span>
            <p className="text-xs text-orange-600 mt-0.5">Select orders to remove from this batch. Admin approval required.</p>
          </div>
          <div className="divide-y">
            {request.orders.map((ro) => {
              const hasPendingUnbundle = (ro.order as { hasPendingUnbundle?: boolean }).hasPendingUnbundle
              const canUnbundle = ro.order.status === 'READY_TO_SHIP' && !hasPendingUnbundle
              const isSelected = selectedOrderIds.has(ro.orderId)
              return (
                <label
                  key={ro.id}
                  className={`flex items-center gap-3 px-5 py-4 ${canUnbundle ? 'cursor-pointer hover:bg-gray-50' : 'opacity-50'}`}
                >
                  <input
                    type="checkbox"
                    disabled={!canUnbundle}
                    checked={isSelected}
                    onChange={() => toggleOrder(ro.orderId)}
                    className="rounded"
                  />
                  <div className="flex-1">
                    <span className="font-mono text-sm font-medium">{ro.order.orderNumber}</span>
                    <span className="ml-2 text-xs text-gray-500">{ro.order.status}</span>
                  </div>
                  {hasPendingUnbundle ? (
                    <span className="text-xs text-orange-600 font-medium">Unbundle Pending</span>
                  ) : !canUnbundle ? (
                    <span className="text-xs text-gray-400">Not eligible</span>
                  ) : null}
                </label>
              )
            })}
          </div>
          <div className="px-5 py-4 border-t bg-gray-50 rounded-b-xl flex items-center justify-between">
            {unbundleError && <p className="text-sm text-red-600">{unbundleError}</p>}
            <div className="ml-auto">
              <button
                onClick={handleUnbundle}
                disabled={selectedOrderIds.size === 0 || unbundleLoading}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {unbundleLoading ? 'Submitting...' : `Unbundle Selected (${selectedOrderIds.size})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
