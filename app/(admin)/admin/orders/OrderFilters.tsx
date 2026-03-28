'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useState } from 'react'

interface Distributor {
  id: string
  name: string
  company: string | null
}

interface Props {
  distributors: Distributor[]
  totalCount: number
  filteredCount: number
}

const STATUSES = [
  { value: 'SUBMITTED',         label: 'Submitted' },
  { value: 'CONFIRMED',         label: 'Confirmed' },
  { value: 'PAYMENT_PENDING',   label: 'Payment Pending' },
  { value: 'PAYMENT_CONFIRMED', label: 'Payment Confirmed' },
  { value: 'READY_TO_SHIP',     label: 'Ready to Ship' },
  { value: 'SHIPPED',           label: 'Shipped' },
]

const SHIPPING_MODES = [
  { value: 'AIR',       label: 'AIR' },
  { value: 'OCEAN',     label: 'OCEAN' },
  { value: 'HANDCARRY', label: 'HANDCARRY' },
]

export function OrderFilters({ distributors, totalCount, filteredCount }: Props) {
  const router = useRouter()
  const sp = useSearchParams()

  const [distSearch, setDistSearch] = useState('')
  const [distOpen, setDistOpen] = useState(false)

  const push = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(sp.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    router.push(`/admin/orders?${params.toString()}`)
  }, [sp, router])

  const clear = useCallback(() => {
    router.push('/admin/orders')
  }, [router])

  const currentDist = sp.get('distributorId') ?? ''
  const currentStatus = sp.get('status') ?? ''
  const currentMode = sp.get('shippingMode') ?? ''
  const currentFrom = sp.get('dateFrom') ?? ''
  const currentTo = sp.get('dateTo') ?? ''
  const currentSearch = sp.get('search') ?? ''
  const hasFilter = !!(currentDist || currentStatus || currentMode || currentFrom || currentTo || currentSearch)

  const selectedDist = distributors.find((d) => d.id === currentDist)
  const filteredDists = distributors.filter((d) =>
    !distSearch ||
    d.name.toLowerCase().includes(distSearch.toLowerCase()) ||
    (d.company ?? '').toLowerCase().includes(distSearch.toLowerCase())
  )

  return (
    <div className="bg-white rounded-xl border p-4 mb-4">
      <div className="flex flex-wrap gap-3 items-end">

        {/* Order # / Company search */}
        <div className="flex-1 min-w-48">
          <label className="block text-xs font-medium text-gray-500 mb-1">Search</label>
          <input
            key={currentSearch}
            type="text"
            placeholder="Order # or company name…"
            defaultValue={currentSearch}
            onChange={(e) => push('search', e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Distributor */}
        <div className="relative min-w-52">
          <label className="block text-xs font-medium text-gray-500 mb-1">Distributor</label>
          <button
            type="button"
            onClick={() => setDistOpen((v) => !v)}
            className="w-full border rounded-lg px-3 py-2 text-sm text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <span className={selectedDist ? 'text-gray-900' : 'text-gray-400'}>
              {selectedDist ? `${selectedDist.name} · ${selectedDist.company}` : 'All distributors'}
            </span>
            <span className="text-gray-400 ml-2">▾</span>
          </button>
          {distOpen && (
            <div className="absolute z-30 top-full mt-1 left-0 right-0 bg-white border rounded-xl shadow-lg overflow-hidden">
              <div className="p-2 border-b">
                <input
                  autoFocus
                  type="text"
                  placeholder="Search…"
                  value={distSearch}
                  onChange={(e) => setDistSearch(e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="max-h-48 overflow-y-auto">
                <button
                  onClick={() => { push('distributorId', ''); setDistOpen(false); setDistSearch('') }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${!currentDist ? 'font-medium text-blue-600' : 'text-gray-700'}`}
                >
                  All distributors
                </button>
                {filteredDists.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => { push('distributorId', d.id); setDistOpen(false); setDistSearch('') }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${currentDist === d.id ? 'font-medium text-blue-600' : 'text-gray-700'}`}
                  >
                    <span>{d.name}</span>
                    {d.company && <span className="text-gray-400 ml-1 text-xs">· {d.company}</span>}
                  </button>
                ))}
                {filteredDists.length === 0 && (
                  <p className="px-3 py-2 text-sm text-gray-400">No matches</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Status */}
        <div className="min-w-40">
          <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
          <select
            value={currentStatus}
            onChange={(e) => push('status', e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All statuses</option>
            {STATUSES.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        {/* Shipping Mode */}
        <div className="min-w-36">
          <label className="block text-xs font-medium text-gray-500 mb-1">Shipping Mode</label>
          <select
            value={currentMode}
            onChange={(e) => push('shippingMode', e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All modes</option>
            {SHIPPING_MODES.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        {/* Date From */}
        <div className="min-w-36">
          <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
          <input
            type="date"
            value={currentFrom}
            onChange={(e) => push('dateFrom', e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Date To */}
        <div className="min-w-36">
          <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
          <input
            type="date"
            value={currentTo}
            onChange={(e) => push('dateTo', e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Clear */}
        <div className="flex items-end gap-2">
          {hasFilter && (
            <button
              onClick={clear}
              className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 border rounded-lg hover:bg-gray-50"
            >
              Clear
            </button>
          )}
          <span className="text-xs text-gray-400 self-center whitespace-nowrap pb-2">
            {hasFilter ? `${filteredCount} / ${totalCount} orders` : `${totalCount} orders`}
          </span>
        </div>
      </div>

      {/* Close dropdown on outside click */}
      {distOpen && (
        <div className="fixed inset-0 z-20" onClick={() => { setDistOpen(false); setDistSearch('') }} />
      )}
    </div>
  )
}
