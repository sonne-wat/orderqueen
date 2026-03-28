'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import type { BatchShipmentWithDetails } from '@/types'

export default function AdminBatchShipmentCargoPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [batch, setBatch] = useState<BatchShipmentWithDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  // Cargo form state
  const [cbm, setCbm] = useState('')
  const [weightKg, setWeightKg] = useState('')
  const [scheduledDate, setScheduledDate] = useState('')
  const [carrier, setCarrier] = useState('')
  const [notes, setNotes] = useState('')
  const [palletCount, setPalletCount] = useState('')
  const [cartonCount, setCartonCount] = useState('')

  useEffect(() => {
    fetch(`/api/batch-shipments/${id}`)
      .then((r) => r.json())
      .then((d) => {
        const b = d.batchShipment as BatchShipmentWithDetails
        setBatch(b)
        setCbm(b.cbm?.toString() ?? '')
        setWeightKg(b.weightKg?.toString() ?? '')
        setScheduledDate(b.scheduledDate ? new Date(b.scheduledDate).toISOString().slice(0, 10) : '')
        setCarrier(b.carrier ?? '')
        setNotes(b.notes ?? '')
        setPalletCount(b.palletCount?.toString() ?? '')
        setCartonCount(b.cartonCount?.toString() ?? '')
        setLoading(false)
      })
  }, [id])

  async function handleSaveCargo() {
    setSaving(true)
    setSaved(false)
    setError('')

    const res = await fetch(`/api/batch-shipments/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cbm: cbm ? parseFloat(cbm) : null,
        weightKg: weightKg ? parseFloat(weightKg) : null,
        scheduledDate: scheduledDate || null,
        carrier: carrier || null,
        notes: notes || null,
        palletCount: palletCount ? parseInt(palletCount) : null,
        cartonCount: cartonCount ? parseInt(cartonCount) : null,
      }),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Failed to save.')
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }
    setSaving(false)
  }

  async function handleOrderAction(action: string, confirmMsg?: string) {
    if (confirmMsg && !confirm(confirmMsg)) return
    setActionLoading(true)
    setError('')

    const res = await fetch(`/api/batch-shipments/${id}/order-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Failed to update.')
      setActionLoading(false)
    } else {
      // Reload to reflect new order statuses
      router.refresh()
      const r = await fetch(`/api/batch-shipments/${id}`)
      const d = await r.json()
      setBatch(d.batchShipment)
      setActionLoading(false)
    }
  }

  if (loading) return <div className="p-8 text-gray-400 text-center">Loading...</div>
  if (!batch) return <div className="p-8 text-gray-400 text-center">Batch shipment not found.</div>

  const { shipmentRequest } = batch
  const orders = shipmentRequest.orders

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="mb-6">
        <Link href="/admin/shipment-requests" className="text-sm text-gray-400 hover:underline">← Shipment Requests</Link>
        <div className="flex items-center gap-3 mt-2">
          <h1 className="text-xl font-semibold">Batch Cargo Details</h1>
          {batch.batchNumber && (
            <span className="font-mono text-sm font-bold text-green-700 bg-green-50 border border-green-200 px-2.5 py-0.5 rounded-full">
              {batch.batchNumber}
            </span>
          )}
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            batch.status === 'PREPARING' ? 'bg-orange-100 text-orange-700' :
            batch.status === 'READY' ? 'bg-blue-100 text-blue-700' :
            batch.status === 'BOOKED' ? 'bg-violet-100 text-violet-700' :
            batch.status === 'SHIPPED' ? 'bg-gray-100 text-gray-600' :
            'bg-gray-100 text-gray-600'
          }`}>
            {batch.status}
          </span>
        </div>
        <p className="text-sm text-gray-500 mt-1">
          {shipmentRequest.distributor.company || shipmentRequest.distributor.name}
          <span className="mx-2">·</span>
          {orders.length} orders
        </p>
      </div>

      {/* Orders in batch */}
      <div className="bg-white rounded-xl border mb-6">
        <div className="px-5 py-3 border-b bg-gray-50 rounded-t-xl">
          <span className="text-sm font-semibold text-gray-600">Orders ({orders.length})</span>
        </div>
        <div className="divide-y">
          {orders.map((ro) => (
            <div key={ro.id} className="px-5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm font-medium">{ro.order.orderNumber}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  ro.order.status === 'READY_TO_SHIP' ? 'bg-purple-100 text-purple-700' :
                  ro.order.status === 'SHIPMENT_BOOKED' ? 'bg-violet-100 text-violet-700' :
                  ro.order.status === 'SHIPPED' ? 'bg-gray-100 text-gray-600' :
                  'bg-blue-100 text-blue-700'
                }`}>
                  {ro.order.status}
                </span>
              </div>
              <Link href={`/admin/orders/${ro.order.id}`} target="_blank" className="text-xs text-blue-600 hover:underline">
                View ↗
              </Link>
            </div>
          ))}
        </div>
      </div>

      {/* Cargo Details Form */}
      <div className="bg-white rounded-xl border mb-6">
        <div className="px-5 py-3 border-b bg-gray-50 rounded-t-xl">
          <span className="text-sm font-semibold text-gray-600">Cargo Details</span>
        </div>
        <div className="px-5 py-5 grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">CBM (m³)</label>
            <input
              type="number"
              step="0.001"
              value={cbm}
              onChange={(e) => setCbm(e.target.value)}
              placeholder="0.000"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Weight (kg)</label>
            <input
              type="number"
              step="0.01"
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              placeholder="0.00"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Scheduled Date</label>
            <input
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Carrier</label>
            <input
              type="text"
              value={carrier}
              onChange={(e) => setCarrier(e.target.value)}
              placeholder="e.g. Maersk, FedEx"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">No. of Pallets / Packages</label>
            <input
              type="number"
              value={palletCount}
              onChange={(e) => setPalletCount(e.target.value)}
              placeholder="0"
              min="0"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">No. of Cartons</label>
            <input
              type="number"
              value={cartonCount}
              onChange={(e) => setCartonCount(e.target.value)}
              placeholder="0"
              min="0"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Additional notes..."
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
            />
          </div>
        </div>
        <div className="px-5 pb-5 flex items-center justify-between">
          <div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            {saved && <p className="text-sm text-green-600">Saved successfully.</p>}
          </div>
          <button
            onClick={handleSaveCargo}
            disabled={saving}
            className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Cargo Details'}
          </button>
        </div>
      </div>

      {/* Batch Order Actions */}
      {batch.status === 'SHIPPED' && (
        <div className="bg-white rounded-xl border px-5 py-4 mb-6 flex items-center justify-between">
          <p className="text-sm text-gray-500">This batch is marked as <span className="font-medium text-gray-700">SHIPPED</span>. Reset to re-open for adding orders.</p>
          <button
            onClick={async () => {
              if (!confirm('Reset batch status to PREPARING?')) return
              const res = await fetch(`/api/batch-shipments/${id}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'PREPARING' }),
              })
              if (res.ok) {
                const r = await fetch(`/api/batch-shipments/${id}`)
                const d = await r.json()
                setBatch(d.batchShipment)
              }
            }}
            className="px-3 py-1.5 border border-gray-300 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-50"
          >
            Reset to Preparing
          </button>
        </div>
      )}

      {(() => {
        const orderStatus = orders[0]?.order?.status
        if (!orderStatus || orderStatus === 'SHIPPED') {
          return (
            <div className="bg-gray-50 rounded-xl border px-5 py-4 text-center text-sm text-gray-500">
              All orders have been shipped.
            </div>
          )
        }

        return (
          <div className="bg-white rounded-xl border px-5 py-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-1">
              Order Status Actions
              <span className="ml-2 text-xs font-normal text-gray-400">— applies to all {orders.length} orders</span>
            </h3>
            {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
            <div className="flex gap-3 flex-wrap">
              {orderStatus === 'READY_TO_SHIP' && (
                <button
                  onClick={() => handleOrderAction('payment-pending')}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50"
                >
                  {actionLoading ? 'Updating...' : `Request Payment (${orders.length} orders) →`}
                </button>
              )}
              {orderStatus === 'PAYMENT_PENDING' && (
                <>
                  <button
                    onClick={() => handleOrderAction('payment-confirm')}
                    disabled={actionLoading}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                  >
                    {actionLoading ? 'Updating...' : `Confirm Payment (${orders.length} orders) →`}
                  </button>
                  <button
                    onClick={() => handleOrderAction('skip-payment', `Skip payment and mark all ${orders.length} orders as SHIPPED?`)}
                    disabled={actionLoading}
                    className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
                  >
                    {actionLoading ? 'Updating...' : 'Skip Payment & Ship All'}
                  </button>
                </>
              )}
              {orderStatus === 'PAYMENT_CONFIRMED' && (
                <button
                  onClick={() => handleOrderAction('book', `Book shipment for all ${orders.length} orders? Consolidation will be locked after this.`)}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-50"
                >
                  {actionLoading ? 'Updating...' : `Book Shipment (${orders.length} orders) →`}
                </button>
              )}
              {orderStatus === 'SHIPMENT_BOOKED' && (
                <button
                  onClick={() => handleOrderAction('ship', `Mark all ${orders.length} orders as SHIPPED? This cannot be undone.`)}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                >
                  {actionLoading ? 'Updating...' : `Mark All ${orders.length} Orders Shipped →`}
                </button>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Current order status: <span className="font-medium text-gray-600">{orderStatus}</span>
            </p>
          </div>
        )
      })()}
    </div>
  )
}
