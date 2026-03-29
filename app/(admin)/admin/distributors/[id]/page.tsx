'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

const CATEGORY_OPTIONS = [
  { value: 'BOWLING_BALL',      label: 'Bowling Ball' },
  { value: 'BOWLING_BAG',       label: 'Bowling Bag' },
  { value: 'BOWLING_SHOES',     label: 'Bowling Shoes' },
  { value: 'APPAREL',           label: 'Apparel' },
  { value: 'BOWLING_ACCESSORY', label: 'Bowling Accessory' },
] as const

type CategoryValue = typeof CATEGORY_OPTIONS[number]['value']

interface DistributorDetail {
  distributor: {
    id: string; name: string; company: string | null; email: string
    phone: string | null; address: string | null; shippingAddress: string | null
    status: 'PENDING' | 'ACTIVE' | 'SUSPENDED'
    creditLimit: number | null; adminNotes: string | null; createdAt: string
    allowedCategories: CategoryValue[]
  }
  analytics: {
    orderStats: { total: number; byStatus: Record<string, number> }
    amountStats: { totalConfirmed: number; paymentPending: number; paymentCompleted: number }
    shipmentStats: { total: number; byStatus: Record<string, number>; byMode: Record<string, number> }
    monthlyOrders: { month: string; count: number; amount: number }[]
  }
}

const STATUS_CONFIG = {
  PENDING:   { label: 'Pending Approval', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  ACTIVE:    { label: 'Active',           className: 'bg-green-100 text-green-800 border-green-200' },
  SUSPENDED: { label: 'Suspended',        className: 'bg-red-100 text-red-800 border-red-200' },
}

export default function DistributorDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<DistributorDetail | null>(null)
  const [form, setForm] = useState({
    phone: '', address: '', shippingAddress: '', creditLimit: '', adminNotes: '',
  })
  const [allowedCategories, setAllowedCategories] = useState<CategoryValue[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [statusChanging, setStatusChanging] = useState(false)

  useEffect(() => {
    fetch(`/api/admin/distributors/${id}`)
      .then((r) => r.json())
      .then((d: DistributorDetail) => {
        setData(d)
        setForm({
          phone:           d.distributor.phone ?? '',
          address:         d.distributor.address ?? '',
          shippingAddress: d.distributor.shippingAddress ?? '',
          creditLimit:     d.distributor.creditLimit != null ? String(d.distributor.creditLimit) : '',
          adminNotes:      d.distributor.adminNotes ?? '',
        })
        setAllowedCategories(d.distributor.allowedCategories ?? [])
      })
  }, [id])

  async function handleSave() {
    setSaving(true)
    setSaveError(null)
    try {
      const res = await fetch(`/api/admin/distributors/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone:             form.phone || null,
          address:           form.address || null,
          shippingAddress:   form.shippingAddress || null,
          creditLimit:       form.creditLimit ? Number(form.creditLimit) : null,
          adminNotes:        form.adminNotes || null,
          allowedCategories,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
        setSaveError(err.error ?? 'Save failed')
      } else {
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      }
    } catch {
      setSaveError('Network error — please try again')
    } finally {
      setSaving(false)
    }
  }

  function toggleCategory(cat: CategoryValue) {
    setAllowedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    )
  }

  async function handleStatusChange(newStatus: 'ACTIVE' | 'SUSPENDED' | 'PENDING') {
    setStatusChanging(true)
    const res = await fetch(`/api/admin/distributors/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    if (res.ok) {
      setData((prev) => prev ? { ...prev, distributor: { ...prev.distributor, status: newStatus } } : prev)
    }
    setStatusChanging(false)
  }

  if (!data) return <div className="p-8 text-gray-400">Loading...</div>

  const { distributor: d, analytics: a } = data
  const maxMonthlyAmount = Math.max(...a.monthlyOrders.map((m) => m.amount), 1)
  const statusCfg = STATUS_CONFIG[d.status] ?? STATUS_CONFIG.PENDING

  return (
    <div>
      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/admin/distributors" className="text-gray-400 hover:text-gray-600 text-sm">← Distributors</Link>
          <h1 className="text-xl font-bold">{d.name}</h1>
          <span className="text-sm text-gray-400">{d.company}</span>
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusCfg.className}`}>
            {statusCfg.label}
          </span>
        </div>

        {saved && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded text-green-700 text-sm">Saved successfully.</div>
        )}
        {saveError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">Save failed: {saveError}</div>
        )}

        {/* Approval action banner */}
        {d.status === 'PENDING' && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-xl flex items-center justify-between">
            <div>
              <div className="font-semibold text-yellow-800">Pending Approval</div>
              <div className="text-sm text-yellow-600 mt-0.5">Please review the account information and approve or reject.</div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleStatusChange('ACTIVE')}
                disabled={statusChanging}
                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
              >
                Approve
              </button>
              <button
                onClick={() => handleStatusChange('SUSPENDED')}
                disabled={statusChanging}
                className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-6">
          {/* Profile & Settings */}
          <div className="bg-white rounded-xl border p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-700">Profile & Settings</h2>
              {/* Status change buttons (active/suspended accounts) */}
              {d.status === 'ACTIVE' && (
                <button
                  onClick={() => handleStatusChange('SUSPENDED')}
                  disabled={statusChanging}
                  className="px-3 py-1 text-xs border border-red-300 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50"
                >
                  Suspend Account
                </button>
              )}
              {d.status === 'SUSPENDED' && (
                <button
                  onClick={() => handleStatusChange('ACTIVE')}
                  disabled={statusChanging}
                  className="px-3 py-1 text-xs border border-green-300 text-green-600 rounded-lg hover:bg-green-50 disabled:opacity-50"
                >
                  Reactivate Account
                </button>
              )}
            </div>

            <div className="text-sm space-y-1 text-gray-500">
              <div>Email: <span className="text-gray-900">{d.email}</span></div>
              <div>Joined: <span className="text-gray-900">{new Date(d.createdAt).toLocaleDateString('ko-KR')}</span></div>
            </div>

            {/* Basic info */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Phone</label>
                <input
                  type="text"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+82-10-0000-0000"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Company Address</label>
                <textarea
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  rows={2}
                  placeholder="Seoul, Korea"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Shipping Address</label>
                <textarea
                  value={form.shippingAddress}
                  onChange={(e) => setForm({ ...form, shippingAddress: e.target.value })}
                  rows={2}
                  placeholder="Shipping address (if different from company address)"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Credit Limit (USD)</label>
                <input
                  type="number"
                  value={form.creditLimit}
                  onChange={(e) => setForm({ ...form, creditLimit: e.target.value })}
                  placeholder="50000"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Admin Notes</label>
                <textarea
                  value={form.adminNotes}
                  onChange={(e) => setForm({ ...form, adminNotes: e.target.value })}
                  rows={2}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="VIP customer, special notes..."
                />
              </div>
            </div>

            {/* Category Access Control */}
            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-medium text-gray-500">Category Access</label>
                {allowedCategories.length > 0 ? (
                  <span className="text-xs text-amber-600 font-medium">
                    {allowedCategories.length} / {CATEGORY_OPTIONS.length} categories allowed
                  </span>
                ) : (
                  <span className="text-xs text-green-600 font-medium">All categories allowed</span>
                )}
              </div>
              <p className="text-xs text-gray-400 mb-3">
                Unchecked categories will be hidden from this distributor — they cannot view products, prices, or place orders for those categories.
              </p>
              <div className="space-y-2">
                {CATEGORY_OPTIONS.map(({ value, label }) => {
                  const isRestricted = allowedCategories.length > 0 && !allowedCategories.includes(value)
                  return (
                    <label
                      key={value}
                      className={`flex items-center gap-2.5 p-2 rounded-lg cursor-pointer transition-colors ${
                        isRestricted ? 'bg-red-50' : 'hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={allowedCategories.length === 0 || allowedCategories.includes(value)}
                        onChange={() => {
                          // If currently "all allowed" (empty array), switching to explicit list
                          if (allowedCategories.length === 0) {
                            // Uncheck this one → allow all except this
                            setAllowedCategories(
                              CATEGORY_OPTIONS.map((o) => o.value).filter((v) => v !== value)
                            )
                          } else {
                            toggleCategory(value)
                          }
                        }}
                        className="w-4 h-4 rounded text-blue-600 accent-blue-600"
                      />
                      <span className={`text-sm ${isRestricted ? 'text-red-500 line-through' : 'text-gray-700'}`}>
                        {label}
                      </span>
                      {isRestricted && (
                        <span className="text-xs text-red-400 ml-auto">Blocked</span>
                      )}
                    </label>
                  )
                })}
              </div>
              {allowedCategories.length > 0 && allowedCategories.length < CATEGORY_OPTIONS.length && (
                <button
                  type="button"
                  onClick={() => setAllowedCategories([])}
                  className="mt-2 text-xs text-blue-500 hover:underline"
                >
                  Reset to allow all categories
                </button>
              )}
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>

          {/* Analytics */}
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Total Orders', value: a.orderStats.total },
                { label: 'Payment Done', value: `$${a.amountStats.paymentCompleted.toLocaleString('en-US', { maximumFractionDigits: 0 })}` },
                { label: 'Pending', value: `$${a.amountStats.paymentPending.toLocaleString('en-US', { maximumFractionDigits: 0 })}` },
              ].map(({ label, value }) => (
                <div key={label} className="bg-white rounded-xl border p-4 text-center">
                  <div className="text-lg font-bold text-gray-800">{value}</div>
                  <div className="text-xs text-gray-400 mt-1">{label}</div>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-xl border p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Monthly Orders (Recent 6 Months)</h3>
              {a.monthlyOrders.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-4">No order data</p>
              ) : (
                <div className="space-y-2">
                  {a.monthlyOrders.map((m) => (
                    <div key={m.month} className="flex items-center gap-3 text-sm">
                      <span className="w-16 text-gray-500 text-xs">{m.month}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full"
                          style={{ width: `${(m.amount / maxMonthlyAmount) * 100}%` }}
                        />
                      </div>
                      <span className="w-8 text-center text-gray-600">{m.count}</span>
                      <span className="w-24 text-right text-gray-700 font-medium">${m.amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Shipment</h3>
              <div className="flex gap-6 text-sm">
                <div>
                  <div className="text-xs text-gray-400 mb-2">By Status</div>
                  {Object.entries(a.shipmentStats.byStatus).map(([k, v]) => (
                    <div key={k} className="flex gap-2"><span className="text-gray-500">{k}:</span><span className="font-medium">{v}</span></div>
                  ))}
                  {Object.keys(a.shipmentStats.byStatus).length === 0 && <span className="text-gray-400">-</span>}
                </div>
                <div>
                  <div className="text-xs text-gray-400 mb-2">By Mode</div>
                  {Object.entries(a.shipmentStats.byMode).map(([k, v]) => (
                    <div key={k} className="flex gap-2"><span className="text-gray-500">{k}:</span><span className="font-medium">{v}</span></div>
                  ))}
                  {Object.keys(a.shipmentStats.byMode).length === 0 && <span className="text-gray-400">-</span>}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
