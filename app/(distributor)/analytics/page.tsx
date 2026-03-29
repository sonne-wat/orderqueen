'use client'

import { useState, useEffect } from 'react'

interface AnalyticsData {
  orderStats: {
    total: number
    active: number
    shipped: number
    byStatus: Record<string, number>
  }
  amountStats: {
    totalOrdered: number
    paymentPending: number
    paymentCompleted: number
  }
  shipmentStats: {
    total: number
    byStatus: Record<string, number>
  }
  monthlyOrders: { month: string; count: number; amount: number }[]
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null)

  useEffect(() => {
    fetch('/api/analytics/me').then((r) => r.json()).then(setData)
  }, [])

  if (!data) return <div className="p-8 text-gray-400">Loading...</div>

  const { orderStats: os, amountStats: as_, shipmentStats: ss, monthlyOrders } = data
  const maxMonthlyAmount = Math.max(...monthlyOrders.map((m) => m.amount), 1)

  return (
    <div>
      <main className="max-w-4xl mx-auto px-6 py-8">
        <h1 className="text-xl font-bold mb-6">My Analytics</h1>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Total Orders', value: os.total, color: 'text-gray-800' },
            { label: 'Active Orders', value: os.active, color: 'text-blue-600' },
            { label: 'Shipped', value: os.shipped, color: 'text-green-600' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-xl border p-5 text-center">
              <div className={`text-2xl font-bold ${color}`}>{value}</div>
              <div className="text-sm text-gray-400 mt-1">{label}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Total Ordered', value: `$${as_.totalOrdered.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, color: 'text-gray-800' },
            { label: 'Payment Pending', value: `$${as_.paymentPending.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, color: 'text-yellow-600' },
            { label: 'Payment Done', value: `$${as_.paymentCompleted.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, color: 'text-green-600' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-xl border p-5 text-center">
              <div className={`text-xl font-bold ${color}`}>{value}</div>
              <div className="text-sm text-gray-400 mt-1">{label}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Monthly Trend */}
          <div className="col-span-2 bg-white rounded-xl border p-5">
            <h2 className="font-semibold text-gray-700 mb-4">Monthly Orders (Recent 6 Months)</h2>
            {monthlyOrders.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">No order data</p>
            ) : (
              <div className="space-y-3">
                {monthlyOrders.map((m) => (
                  <div key={m.month} className="flex items-center gap-3 text-sm">
                    <span className="w-16 text-gray-500 text-xs">{m.month}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-3">
                      <div
                        className="bg-blue-500 h-3 rounded-full"
                        style={{ width: `${(m.amount / maxMonthlyAmount) * 100}%` }}
                      />
                    </div>
                    <span className="w-8 text-center text-gray-500">{m.count}</span>
                    <span className="w-28 text-right font-medium text-gray-800">
                      ${m.amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Column */}
          <div className="space-y-4">
            {/* Order Status */}
            <div className="bg-white rounded-xl border p-5">
              <h2 className="font-semibold text-gray-700 mb-3">Order Status</h2>
              <div className="space-y-1 text-sm">
                {Object.entries(os.byStatus).map(([status, count]) => (
                  <div key={status} className="flex justify-between">
                    <span className="text-gray-500 text-xs">{status}</span>
                    <span className="font-medium">{count}</span>
                  </div>
                ))}
                {Object.keys(os.byStatus).length === 0 && <span className="text-gray-400">-</span>}
              </div>
            </div>

            {/* Shipment Status */}
            <div className="bg-white rounded-xl border p-5">
              <h2 className="font-semibold text-gray-700 mb-3">Shipments</h2>
              <div className="text-sm">
                <div className="flex justify-between mb-2">
                  <span className="text-gray-500">Total</span>
                  <span className="font-medium">{ss.total}</span>
                </div>
                {Object.entries(ss.byStatus).map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span className="text-gray-500 text-xs">{k}</span>
                    <span className="font-medium">{v}</span>
                  </div>
                ))}
                {Object.keys(ss.byStatus).length === 0 && <span className="text-gray-400 text-xs">No shipment data</span>}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
