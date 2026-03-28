'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type EligibleOrder = {
  id: string
  orderNumber: string
  status: string
  shippingMode: string | null
  requestedDelivery: string | null
  itemCount: number
  inPendingRequest: boolean
}

type ActiveBatch = {
  id: string
  batchNumber: string
  status: string
  orderCount: number
  scheduledDate: string | null
}

type Mode = 'new' | 'add'

export default function ShippingRequestPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('new')
  const [orders, setOrders] = useState<EligibleOrder[]>([])
  const [activeBatches, setActiveBatches] = useState<ActiveBatch[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [selectedBatchId, setSelectedBatchId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadData() {
      const [ordersRes, pendingRes, batchRes] = await Promise.all([
        fetch('/api/orders'),
        fetch('/api/shipment-requests'),
        fetch('/api/batch-shipments'),
      ])
      const ordersData = await ordersRes.json()
      const pendingData = await pendingRes.json()
      const batchData = await batchRes.json()

      const pendingOrderIds = new Set<string>(
        pendingData.requests
          .filter((r: { status: string }) => r.status === 'PENDING')
          .flatMap((r: { orders: { orderId: string }[] }) => r.orders.map((o) => o.orderId))
      )

      const eligible = (ordersData.orders as {
        id: string; orderNumber: string; status: string; shippingMode: string | null;
        requestedDelivery: string | null; items: unknown[];
      }[])
        .filter((o) => ['CONFIRMED', 'PAYMENT_PENDING', 'PAYMENT_CONFIRMED', 'READY_TO_SHIP'].includes(o.status))
        .map((o) => ({
          id: o.id,
          orderNumber: o.orderNumber,
          status: o.status,
          shippingMode: o.shippingMode,
          requestedDelivery: o.requestedDelivery,
          itemCount: o.items.length,
          inPendingRequest: pendingOrderIds.has(o.id),
        }))

      setOrders(eligible)
      setActiveBatches(batchData.batches ?? [])
      if ((batchData.batches ?? []).length > 0) {
        setSelectedBatchId(batchData.batches[0].id)
      }
      setLoading(false)
    }
    loadData()
  }, [])

  function toggle(orderId: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(orderId)) next.delete(orderId)
      else next.add(orderId)
      return next
    })
  }

  async function handleSubmit() {
    const minOrders = 1
    if (selected.size < minOrders) {
      setError('Please select at least 1 order.')
      return
    }
    if (mode === 'add' && !selectedBatchId) {
      setError('Please select a batch to add to.')
      return
    }
    setSubmitting(true)
    setError('')

    const body: { orderIds: string[]; targetBatchId?: string } = {
      orderIds: Array.from(selected),
    }
    if (mode === 'add') body.targetBatchId = selectedBatchId

    const res = await fetch('/api/shipment-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Failed to submit request.')
      setSubmitting(false)
      return
    }

    router.push('/orders/shipment-requests')
  }

  // When mode changes, clear selection
  function switchMode(m: Mode) {
    setMode(m)
    setSelected(new Set())
    setError('')
  }

  const selectedBatch = activeBatches.find((b) => b.id === selectedBatchId)

  // In "add" mode, also exclude orders already in the selected batch
  // (we don't have that info here without another API call, so just show confirmed orders)
  const availableOrders = orders.filter((o) => !o.inPendingRequest)
  const lockedOrders = orders.filter((o) => o.inPendingRequest)

  const minOrders = 1

  return (
    <main className="max-w-3xl mx-auto px-6 py-8">
      <div className="mb-6">
        <Link href="/dashboard" className="text-sm text-gray-400 hover:underline">← Dashboard</Link>
        <h1 className="text-xl font-semibold mt-2">Request Shipment</h1>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-2 mb-5">
        <button
          onClick={() => switchMode('new')}
          className={`flex-1 py-3 rounded-xl border text-sm font-medium transition-colors ${
            mode === 'new'
              ? 'bg-green-600 text-white border-green-600'
              : 'bg-white text-gray-600 border-gray-200 hover:border-green-400 hover:text-green-600'
          }`}
        >
          <div className="font-semibold">New Batch Shipment</div>
          <div className={`text-xs mt-0.5 ${mode === 'new' ? 'text-green-100' : 'text-gray-400'}`}>
            Create a new batch (select 1+ orders)
          </div>
        </button>
        <button
          onClick={() => switchMode('add')}
          disabled={activeBatches.length === 0}
          className={`flex-1 py-3 rounded-xl border text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
            mode === 'add'
              ? 'bg-indigo-600 text-white border-indigo-600'
              : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-400 hover:text-indigo-600'
          }`}
        >
          <div className="font-semibold">Add to Existing Batch</div>
          <div className={`text-xs mt-0.5 ${mode === 'add' ? 'text-indigo-100' : 'text-gray-400'}`}>
            {activeBatches.length === 0
              ? 'No active batches available'
              : `${activeBatches.length} active batch${activeBatches.length > 1 ? 'es' : ''} available`}
          </div>
        </button>
      </div>

      {loading ? (
        <div className="text-gray-400 text-center py-12">Loading...</div>
      ) : (
        <>
          {/* Batch selector (add mode) */}
          {mode === 'add' && activeBatches.length > 0 && (
            <div className="bg-white rounded-xl border mb-4 p-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Target Batch</label>
              <div className="space-y-2">
                {activeBatches.map((batch) => (
                  <label key={batch.id} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="targetBatch"
                      value={batch.id}
                      checked={selectedBatchId === batch.id}
                      onChange={() => setSelectedBatchId(batch.id)}
                      className="text-indigo-600"
                    />
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                        {batch.batchNumber}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        batch.status === 'PREPARING' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {batch.status}
                      </span>
                      <span className="text-sm text-gray-500">{batch.orderCount} orders</span>
                      {batch.scheduledDate && (
                        <span className="text-xs text-gray-400">
                          Scheduled: {new Date(batch.scheduledDate).toLocaleDateString('ko-KR')}
                        </span>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {orders.length === 0 ? (
            <div className="bg-white rounded-xl border p-12 text-center text-gray-400">
              <p>No confirmed orders available.</p>
              <Link href="/dashboard" className="text-blue-600 hover:underline text-sm mt-2 inline-block">Back to Dashboard</Link>
            </div>
          ) : (
            <>
              {/* Available orders */}
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

              {/* Locked orders */}
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
                  {selected.size === 0 && (
                    <span className="text-orange-500 ml-2">(select at least 1)</span>
                  )}
                </span>
                <div className="flex gap-3">
                  <Link href="/dashboard" className="px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                    Cancel
                  </Link>
                  <button
                    onClick={handleSubmit}
                    disabled={submitting || selected.size < minOrders || (mode === 'add' && !selectedBatchId)}
                    className={`px-5 py-2 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed ${
                      mode === 'new' ? 'bg-green-600 hover:bg-green-700' : 'bg-indigo-600 hover:bg-indigo-700'
                    }`}
                  >
                    {submitting
                      ? 'Submitting...'
                      : mode === 'new'
                        ? `Submit New Batch Request (${selected.size} orders)`
                        : `Add ${selected.size} Order${selected.size !== 1 ? 's' : ''} to ${selectedBatch?.batchNumber ?? 'Batch'}`}
                  </button>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </main>
  )
}
