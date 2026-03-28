'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

type EligibleOrder = {
  id: string
  orderNumber: string
  shippingMode: string | null
  requestedDelivery: string | null
  itemCount: number
  inPendingRequest: boolean
}

type BatchInfo = {
  id: string
  batchNumber: string
  status: string
  orderCount: number
}

export default function BatchAddOrderPage() {
  const { batchId } = useParams<{ batchId: string }>()
  const router = useRouter()

  const [batch, setBatch] = useState<BatchInfo | null>(null)
  const [orders, setOrders] = useState<EligibleOrder[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const [batchRes, ordersRes, pendingRes] = await Promise.all([
        fetch(`/api/batch-shipments/${batchId}`),
        fetch('/api/orders'),
        fetch('/api/shipment-requests'),
      ])

      if (!batchRes.ok) { router.push('/orders/shipment-requests'); return }

      const batchData = await batchRes.json()
      const b = batchData.batchShipment
      setBatch({
        id: b.id,
        batchNumber: b.batchNumber,
        status: b.status,
        orderCount: b.shipmentRequest.orders.length,
      })

      const ordersData = await ordersRes.json()
      const pendingData = await pendingRes.json()

      // Build set of order IDs already in a PENDING request
      const pendingOrderIds = new Set<string>(
        pendingData.requests
          .filter((r: { status: string }) => r.status === 'PENDING')
          .flatMap((r: { orders: { orderId: string }[] }) => r.orders.map((o) => o.orderId))
      )

      // Build set of order IDs already in this batch
      const batchOrderIds = new Set<string>(
        b.shipmentRequest.orders.map((o: { orderId: string }) => o.orderId)
      )

      const eligible = (ordersData.orders as {
        id: string; orderNumber: string; status: string; shippingMode: string | null;
        requestedDelivery: string | null; items: unknown[];
      }[])
        .filter((o) => ['CONFIRMED', 'PAYMENT_PENDING', 'PAYMENT_CONFIRMED', 'READY_TO_SHIP'].includes(o.status) && !batchOrderIds.has(o.id))
        .map((o) => ({
          id: o.id,
          orderNumber: o.orderNumber,
          shippingMode: o.shippingMode,
          requestedDelivery: o.requestedDelivery,
          itemCount: o.items.length,
          inPendingRequest: pendingOrderIds.has(o.id),
        }))

      setOrders(eligible)
      setLoading(false)
    }
    load()
  }, [batchId, router])

  function toggle(orderId: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(orderId)) next.delete(orderId)
      else next.add(orderId)
      return next
    })
  }

  async function handleSubmit() {
    if (selected.size === 0) {
      setError('Please select at least 1 order.')
      return
    }
    setSubmitting(true)
    setError('')

    const res = await fetch('/api/shipment-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderIds: Array.from(selected), targetBatchId: batchId }),
    })

    if (!res.ok) {
      let errorMsg = 'Failed to submit request.'
      try {
        const data = await res.json()
        errorMsg = data.error ?? errorMsg
      } catch {
        errorMsg = `Server error (${res.status}). Please try again.`
      }
      setError(errorMsg)
      setSubmitting(false)
      return
    }

    router.push('/orders/shipment-requests')
  }

  const availableOrders = orders.filter((o) => !o.inPendingRequest)
  const lockedOrders = orders.filter((o) => o.inPendingRequest)

  if (loading) return <div className="p-8 text-gray-400 text-center">Loading...</div>

  return (
    <main className="max-w-3xl mx-auto px-6 py-8">
      <div className="mb-6">
        <Link href="/orders/shipment-requests" className="text-sm text-gray-400 hover:underline">← Shipment Requests</Link>
        <h1 className="text-xl font-semibold mt-2">Add Orders to Batch</h1>
        {batch && (
          <div className="flex items-center gap-3 mt-2">
            <span className="font-mono text-sm font-bold text-green-700 bg-green-50 border border-green-200 px-3 py-1 rounded-full">
              {batch.batchNumber}
            </span>
            <span className="text-sm text-gray-500">{batch.orderCount} orders currently in this batch</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              batch.status === 'PREPARING' ? 'bg-orange-100 text-orange-700' :
              batch.status === 'READY' ? 'bg-blue-100 text-blue-700' :
              'bg-gray-100 text-gray-600'
            }`}>{batch.status}</span>
          </div>
        )}
        <p className="text-sm text-gray-500 mt-2">
          Select confirmed orders to request consolidation into this batch.
        </p>
      </div>

      {orders.length === 0 && !loading ? (
        <div className="bg-white rounded-xl border p-12 text-center text-gray-400">
          <p>No confirmed orders available to add.</p>
          <Link href="/orders/shipment-requests" className="text-blue-600 hover:underline text-sm mt-2 inline-block">
            Back to Shipment Requests
          </Link>
        </div>
      ) : (
        <>
          {availableOrders.length > 0 && (
            <div className="bg-white rounded-xl border mb-4">
              <div className="px-5 py-3 border-b bg-gray-50 rounded-t-xl">
                <span className="text-sm font-medium text-gray-600">Available Orders ({availableOrders.length})</span>
              </div>
              <div className="divide-y">
                {availableOrders.map((order) => (
                  <label key={order.id} className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={selected.has(order.id)}
                      onChange={() => toggle(order.id)}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="font-mono text-sm font-medium">{order.orderNumber}</span>
                      <span className="ml-2 text-xs text-gray-400">{order.itemCount} items</span>
                      {order.shippingMode && (
                        <span className="ml-2 px-1.5 py-0.5 bg-gray-100 rounded text-xs text-gray-600">
                          {order.shippingMode}
                        </span>
                      )}
                    </div>
                    {order.requestedDelivery && (
                      <span className="text-xs text-gray-400">
                        Delivery: {new Date(order.requestedDelivery).toLocaleDateString('ko-KR')}
                      </span>
                    )}
                  </label>
                ))}
              </div>
            </div>
          )}

          {lockedOrders.length > 0 && (
            <div className="bg-white rounded-xl border mb-4 opacity-60">
              <div className="px-5 py-3 border-b bg-yellow-50 rounded-t-xl">
                <span className="text-sm font-medium text-yellow-800">Already Requested ({lockedOrders.length})</span>
              </div>
              <div className="divide-y">
                {lockedOrders.map((order) => (
                  <div key={order.id} className="flex items-center gap-4 px-5 py-4">
                    <input type="checkbox" disabled className="h-4 w-4 rounded border-gray-300" />
                    <div className="flex-1">
                      <span className="font-mono text-sm font-medium text-gray-400">{order.orderNumber}</span>
                      <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">Shipment Requested</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">
              {selected.size} order{selected.size !== 1 ? 's' : ''} selected
            </span>
            <div className="flex gap-3">
              <Link href="/orders/shipment-requests" className="px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                Cancel
              </Link>
              <button
                onClick={handleSubmit}
                disabled={submitting || selected.size === 0}
                className="px-5 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Submitting...' : `Add ${selected.size} Order${selected.size !== 1 ? 's' : ''} to ${batch?.batchNumber ?? 'Batch'}`}
              </button>
            </div>
          </div>
        </>
      )}
    </main>
  )
}
