'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

export default function CargoDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const [orderNumber, setOrderNumber] = useState('')
  const [shipmentId, setShipmentId] = useState<string | null>(null)
  const [packageType, setPackageType] = useState<string | null>(null)
  const [form, setForm] = useState({
    cbm: '', weightKg: '',
    scheduledDate: '', carrier: '', notes: '',
    palletCount: '', cartonCount: '',
  })
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch(`/api/orders/${id}`)
      .then((r) => r.json())
      .then((d) => {
        setOrderNumber(d.order.orderNumber)
        setPackageType(d.order.packageType ?? null)
        if (d.order.shipment) {
          const s = d.order.shipment
          setShipmentId(s.id)
          setForm({
            cbm: s.cbm ?? '',
            weightKg: s.weightKg ?? '',
            scheduledDate: s.scheduledDate ? s.scheduledDate.split('T')[0] : '',
            carrier: s.carrier ?? '',
            notes: s.notes ?? '',
            palletCount: s.palletCount ?? '',
            cartonCount: s.cartonCount ?? '',
          })
        }
      })
  }, [id])

  async function handleSave() {
    setLoading(true)
    if (shipmentId) {
      await fetch(`/api/shipments/${shipmentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, orderId: id }),
      })
    } else {
      const res = await fetch('/api/shipments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, orderId: id }),
      })
      const data = await res.json()
      setShipmentId(data.shipment.id)
    }
    setSaved(true)
    setLoading(false)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div>
      <main className="max-w-2xl mx-auto px-6 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Link href={`/admin/orders/${id}`} className="text-gray-400 hover:text-gray-600 text-sm">← Order</Link>
          <h1 className="text-xl font-bold">Cargo Details — {orderNumber}</h1>
        </div>
        {saved && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded text-green-700 text-sm">
            Saved successfully.
          </div>
        )}

        <div className="bg-white rounded-xl border p-6 space-y-5">
          {/* Order-level read-only info */}
          {packageType && packageType !== 'TO_BE_DECIDED' && (
            <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm">
              <span className="text-gray-500">Package Type: </span><span className="font-medium">{packageType}</span>
            </div>
          )}

          {/* CBM + Weight */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">CBM (m³)</label>
              <input
                type="number"
                value={form.cbm}
                onChange={(e) => setForm({ ...form, cbm: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.000"
                step="0.001"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Weight (kg)</label>
              <input
                type="number"
                value={form.weightKg}
                onChange={(e) => setForm({ ...form, weightKg: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0"
              />
            </div>
          </div>

          {/* Pallets + Cartons */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">No. of Pallets / Packages</label>
              <input
                type="number"
                value={form.palletCount}
                onChange={(e) => setForm({ ...form, palletCount: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0"
                min="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">No. of Cartons</label>
              <input
                type="number"
                value={form.cartonCount}
                onChange={(e) => setForm({ ...form, cartonCount: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0"
                min="0"
              />
            </div>
          </div>

          {/* Shipping Schedule */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Scheduled Shipping Date</label>
            <input
              type="date"
              value={form.scheduledDate}
              onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Carrier */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Carrier</label>
            <input
              type="text"
              value={form.carrier}
              onChange={(e) => setForm({ ...form, carrier: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="DHL, FedEx, ..."
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            onClick={handleSave}
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save Cargo Info'}
          </button>
        </div>
      </main>
    </div>
  )
}
