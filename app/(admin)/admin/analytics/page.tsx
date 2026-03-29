import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { orderTotal } from '@/lib/utils/order'
import { subDays, startOfMonth, startOfYear, format } from 'date-fns'

type Period = 'week' | 'month' | 'year'

function leadTimeDays(createdAt: Date, shippedAt: Date) {
  return Math.round((shippedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24))
}

function buildTrend(period: Period, orders: { createdAt: Date; items: { unitPrice: unknown; requestedQty: number; confirmedQty: number | null }[] }[], now: Date) {
  const map: Record<string, { count: number; amount: number }> = {}

  if (period === 'week') {
    for (let i = 6; i >= 0; i--) {
      map[format(subDays(now, i), 'MM/dd')] = { count: 0, amount: 0 }
    }
    for (const o of orders) {
      const key = format(o.createdAt, 'MM/dd')
      if (map[key]) { map[key].count++; map[key].amount += orderTotal(o.items) }
    }
  } else if (period === 'month') {
    const weeks = ['W1', 'W2', 'W3', 'W4', 'W5']
    for (const w of weeks) map[w] = { count: 0, amount: 0 }
    for (const o of orders) {
      const w = `W${Math.min(Math.ceil(o.createdAt.getDate() / 7), 5)}`
      map[w].count++; map[w].amount += orderTotal(o.items)
    }
  } else {
    for (let m = 0; m < 12; m++) {
      map[format(new Date(now.getFullYear(), m, 1), 'MMM')] = { count: 0, amount: 0 }
    }
    for (const o of orders) {
      const key = format(o.createdAt, 'MMM')
      if (map[key]) { map[key].count++; map[key].amount += orderTotal(o.items) }
    }
  }

  return Object.entries(map).map(([label, v]) => ({ label, ...v }))
}

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>
}) {
  const session = await auth()
  if (!session || session.user?.role !== 'ADMIN') redirect('/login')

  const { period: rawPeriod } = await searchParams
  const period: Period = rawPeriod === 'week' || rawPeriod === 'year' ? rawPeriod : 'month'

  const now = new Date()
  let dateFrom: Date
  let periodLabel: string

  if (period === 'week') {
    dateFrom = subDays(now, 7)
    periodLabel = 'Last 7 Days'
  } else if (period === 'year') {
    dateFrom = startOfYear(now)
    periodLabel = `Year ${now.getFullYear()}`
  } else {
    dateFrom = startOfMonth(now)
    periodLabel = format(now, 'MMMM yyyy')
  }

  const [periodOrders, allDistributors] = await Promise.all([
    prisma.order.findMany({
      where: { status: { not: 'DRAFT' }, createdAt: { gte: dateFrom } },
      include: {
        items: { include: { product: { select: { id: true, sku: true, name: true, category: true } } } },
        distributor: { select: { id: true, name: true, company: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.findMany({
      where: { role: 'DISTRIBUTOR' },
      include: {
        orders: {
          where: { status: { not: 'DRAFT' } },
          include: { items: true },
        },
      },
    }),
  ])

  // Summary stats
  const totalRevenue = periodOrders.reduce((s: number, o) => s + orderTotal(o.items), 0)
  const shippedOrders = periodOrders.filter((o) => o.status === 'SHIPPED')
  const leadTimes = shippedOrders.map((o) => leadTimeDays(o.createdAt, o.updatedAt)).filter((d) => d >= 0)
  const avgLeadTime = leadTimes.length > 0 ? leadTimes.reduce((s, d) => s + d, 0) / leadTimes.length : null

  // Order status breakdown
  const statusMap: Record<string, number> = {}
  for (const o of periodOrders) statusMap[o.status] = (statusMap[o.status] ?? 0) + 1

  // Shipping mode breakdown
  const modeMap: Record<string, number> = {}
  for (const o of periodOrders.filter((o) => o.shippingMode))
    modeMap[o.shippingMode!] = (modeMap[o.shippingMode!] ?? 0) + 1

  // Per-distributor stats
  const distStats = allDistributors
    .map((d) => {
      const dOrders = periodOrders.filter((o) => o.distributorId === d.id)
      const dShipped = dOrders.filter((o) => o.status === 'SHIPPED')
      const dLeadTimes = dShipped.map((o) => leadTimeDays(o.createdAt, o.updatedAt)).filter((x) => x >= 0)
      const avgLT = dLeadTimes.length > 0 ? dLeadTimes.reduce((s: number, x) => s + x, 0) / dLeadTimes.length : null
      const minLT = dLeadTimes.length > 0 ? Math.min(...dLeadTimes) : null
      const maxLT = dLeadTimes.length > 0 ? Math.max(...dLeadTimes) : null
      const revenue = dOrders.reduce((s: number, o) => s + orderTotal(o.items), 0)
      const activeOrders = d.orders.filter((o) => !['SHIPPED', 'DRAFT'].includes(o.status)).length
      return {
        id: d.id, name: d.name, company: d.company,
        orderCount: dOrders.length,
        revenue,
        avgOrderValue: dOrders.length > 0 ? revenue / dOrders.length : 0,
        avgLeadTime: avgLT,
        minLeadTime: minLT,
        maxLeadTime: maxLT,
        shippedCount: dShipped.length,
        activeOrders,
      }
    })
    .filter((d) => d.orderCount > 0 || d.activeOrders > 0)
    .sort((a, b) => b.revenue - a.revenue)

  // Top categories
  const CATEGORY_LABELS: Record<string, string> = {
    BOWLING_BALL: 'Bowling Ball',
    BOWLING_BAG: 'Bowling Bag',
    BOWLING_SHOES: 'Bowling Shoes',
    APPAREL: 'Apparel',
    BOWLING_ACCESSORY: 'Bowling Accessory',
  }
  const categoryMap = new Map<string, { label: string; qty: number; revenue: number; orderCount: number }>()
  for (const order of periodOrders) {
    for (const item of order.items) {
      const qty = item.confirmedQty ?? item.requestedQty
      const rev = Number(item.unitPrice) * qty
      const key = item.product.category ?? 'UNCATEGORIZED'
      const label = CATEGORY_LABELS[key] ?? 'Uncategorized'
      const existing = categoryMap.get(key)
      if (existing) {
        existing.qty += qty; existing.revenue += rev; existing.orderCount++
      } else {
        categoryMap.set(key, { label, qty, revenue: rev, orderCount: 1 })
      }
    }
  }
  const topCategories = Array.from(categoryMap.values()).sort((a, b) => b.revenue - a.revenue)

  // Trend
  const trendData = buildTrend(period, periodOrders, now)
  const maxTrendAmount = Math.max(...trendData.map((t) => t.amount), 1)

  const totalModeOrders = Object.values(modeMap).reduce((s: number, v) => s + v, 0)

  const STATUS_COLORS: Record<string, string> = {
    SUBMITTED: 'bg-blue-400',
    CONFIRMED: 'bg-green-400',
    PAYMENT_PENDING: 'bg-yellow-400',
    PAYMENT_CONFIRMED: 'bg-emerald-400',
    READY_TO_SHIP: 'bg-purple-400',
    SHIPPED: 'bg-gray-400',
  }

  return (
    <div>
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Analytics</h1>
            <p className="text-sm text-gray-400 mt-0.5">{periodLabel}</p>
          </div>
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
            {(['week', 'month', 'year'] as const).map((p) => (
              <Link
                key={p}
                href={`/admin/analytics?period=${p}`}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${
                  period === p ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {p === 'week' ? 'Weekly' : p === 'month' ? 'Monthly' : 'Yearly'}
              </Link>
            ))}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Orders', value: periodOrders.length.toString(), sub: `${shippedOrders.length} shipped`, color: 'text-gray-800' },
            { label: 'Total Revenue', value: `$${totalRevenue.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, sub: periodOrders.length > 0 ? `avg $${(totalRevenue / periodOrders.length).toFixed(0)}/order` : '—', color: 'text-blue-700' },
            { label: 'Shipped Orders', value: shippedOrders.length.toString(), sub: periodOrders.length > 0 ? `${Math.round((shippedOrders.length / periodOrders.length) * 100)}% of total` : '—', color: 'text-green-700' },
            { label: 'Avg Lead Time', value: avgLeadTime != null ? `${avgLeadTime.toFixed(1)} days` : '—', sub: 'order → shipped', color: 'text-purple-700' },
          ].map(({ label, value, sub, color }) => (
            <div key={label} className="bg-white rounded-xl border p-5">
              <div className={`text-2xl font-bold ${color}`}>{value}</div>
              <div className="text-sm text-gray-500 mt-1">{label}</div>
              <div className="text-xs text-gray-400 mt-0.5">{sub}</div>
            </div>
          ))}
        </div>

        {/* Trend + Breakdown */}
        <div className="grid grid-cols-3 gap-5 mb-5">
          {/* Period Trend */}
          <div className="col-span-2 bg-white rounded-xl border p-5">
            <h2 className="font-semibold text-gray-700 mb-4">
              {period === 'week' ? 'Daily' : period === 'month' ? 'Weekly' : 'Monthly'} Trend
            </h2>
            {trendData.every((t) => t.count === 0) ? (
              <p className="text-gray-400 text-sm text-center py-8">No orders in this period</p>
            ) : (
              <div className="space-y-2">
                {trendData.map((t) => (
                  <div key={t.label} className="flex items-center gap-3 text-sm">
                    <span className="w-10 text-gray-500 text-xs text-right">{t.label}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-4 relative">
                      <div
                        className="bg-blue-500 h-4 rounded-full transition-all"
                        style={{ width: t.amount > 0 ? `${(t.amount / maxTrendAmount) * 100}%` : '0%' }}
                      />
                    </div>
                    <span className="w-6 text-center text-xs text-gray-500">{t.count}</span>
                    <span className="w-28 text-right text-xs font-medium text-gray-700">
                      {t.amount > 0 ? `$${t.amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right column */}
          <div className="space-y-4">
            {/* Status breakdown */}
            <div className="bg-white rounded-xl border p-5">
              <h2 className="font-semibold text-gray-700 mb-3">Order Status</h2>
              <div className="space-y-1.5">
                {Object.entries(statusMap).length === 0 ? (
                  <p className="text-gray-400 text-sm">—</p>
                ) : Object.entries(statusMap).map(([status, count]) => (
                  <div key={status} className="flex items-center gap-2 text-xs">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_COLORS[status] ?? 'bg-gray-300'}`} />
                    <span className="text-gray-500 flex-1">{status.replace(/_/g, ' ')}</span>
                    <span className="font-semibold text-gray-800">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Shipping mode */}
            <div className="bg-white rounded-xl border p-5">
              <h2 className="font-semibold text-gray-700 mb-3">Shipping Mode</h2>
              {totalModeOrders === 0 ? (
                <p className="text-gray-400 text-sm">—</p>
              ) : (
                <div className="space-y-2">
                  {Object.entries(modeMap).map(([mode, count]) => (
                    <div key={mode} className="flex items-center gap-2 text-xs">
                      <span className="w-16 text-gray-500">{mode}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-2">
                        <div
                          className="bg-indigo-400 h-2 rounded-full"
                          style={{ width: `${(count / totalModeOrders) * 100}%` }}
                        />
                      </div>
                      <span className="text-gray-600">{count} ({Math.round((count / totalModeOrders) * 100)}%)</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Distributor Analysis */}
        <div className="bg-white rounded-xl border overflow-hidden mb-5">
          <div className="px-6 py-4 border-b flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">Distributor Analysis</h2>
            <Link href="/admin/distributors" className="text-sm text-blue-600 hover:underline">All Distributors →</Link>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Distributor</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Orders</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Revenue</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Avg Order Value</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Avg Lead Time</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Active</th>
              </tr>
            </thead>
            <tbody>
              {distStats.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No orders in this period</td></tr>
              ) : distStats.map((d) => (
                <tr key={d.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={`/admin/distributors/${d.id}`} className="font-medium hover:text-blue-600">{d.name}</Link>
                    <div className="text-xs text-gray-400">{d.company}</div>
                  </td>
                  <td className="px-4 py-3 text-center font-medium">{d.orderCount}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-800">
                    ${d.revenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">
                    ${d.avgOrderValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {d.avgLeadTime != null ? (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        d.avgLeadTime <= 14 ? 'bg-green-100 text-green-700' :
                        d.avgLeadTime <= 30 ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-600'
                      }`}>
                        {d.avgLeadTime.toFixed(1)} days
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {d.activeOrders > 0 ? (
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">{d.activeOrders}</span>
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Lead Time by Distributor */}
        {(() => {
          const ltStats = distStats.filter((d) => d.avgLeadTime != null)
          if (ltStats.length === 0) return null
          const maxLT = Math.max(...ltStats.map((d) => d.maxLeadTime!), 1)
          return (
            <div className="bg-white rounded-xl border p-5 mb-5">
              <h2 className="font-semibold text-gray-800 mb-4">Lead Time by Distributor <span className="text-xs font-normal text-gray-400">(order created → shipped, days)</span></h2>
              <div className="space-y-3">
                {ltStats.map((d) => (
                  <div key={d.id} className="flex items-center gap-3 text-sm">
                    <div className="w-36 flex-shrink-0">
                      <div className="font-medium text-xs truncate">{d.name}</div>
                      <div className="text-xs text-gray-400 truncate">{d.company}</div>
                    </div>
                    <div className="flex-1 relative h-5">
                      {/* background track */}
                      <div className="absolute inset-y-0 left-0 right-0 bg-gray-100 rounded-full" />
                      {/* min–max range bar */}
                      <div
                        className="absolute inset-y-0 bg-blue-100 rounded-full"
                        style={{
                          left: `${(d.minLeadTime! / maxLT) * 100}%`,
                          width: `${((d.maxLeadTime! - d.minLeadTime!) / maxLT) * 100}%`,
                          minWidth: '2px',
                        }}
                      />
                      {/* avg marker */}
                      <div
                        className="absolute top-0.5 bottom-0.5 w-1.5 rounded-full bg-blue-600"
                        style={{ left: `calc(${(d.avgLeadTime! / maxLT) * 100}% - 3px)` }}
                      />
                    </div>
                    <div className="w-36 flex-shrink-0 text-xs text-gray-600 flex gap-2">
                      <span className={`px-2 py-0.5 rounded-full font-medium ${
                        d.avgLeadTime! <= 14 ? 'bg-green-100 text-green-700' :
                        d.avgLeadTime! <= 30 ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-600'
                      }`}>avg {d.avgLeadTime!.toFixed(1)}d</span>
                      <span className="text-gray-400">{d.minLeadTime}–{d.maxLeadTime}d</span>
                    </div>
                    <div className="w-12 text-right text-xs text-gray-400">{d.shippedCount} orders</div>
                  </div>
                ))}
              </div>
            </div>
          )
        })()}

        {/* Category Analysis */}
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="px-6 py-4 border-b">
            <h2 className="font-semibold text-gray-800">Category Analysis</h2>
          </div>
          {topCategories.length === 0 ? (
            <p className="px-6 py-8 text-center text-gray-400 text-sm">No category data in this period</p>
          ) : (() => {
            const totalCatRevenue = topCategories.reduce((s, c) => s + c.revenue, 0)
            const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#6b7280']
            const r = 56
            const circumference = 2 * Math.PI * r
            let cumPct = 0
            const segments = topCategories.map((c, i) => {
              const pct = totalCatRevenue > 0 ? c.revenue / totalCatRevenue : 0
              const seg = { ...c, pct, offset: cumPct, color: COLORS[i % COLORS.length] }
              cumPct += pct
              return seg
            })
            return (
              <div className="flex gap-0">
                {/* Donut chart */}
                <div className="flex-shrink-0 flex flex-col items-center justify-center px-8 py-6 border-r">
                  <svg width="160" height="160" viewBox="0 0 160 160">
                    {segments.map((seg) => (
                      <circle
                        key={seg.label}
                        cx="80" cy="80" r={r}
                        fill="none"
                        stroke={seg.color}
                        strokeWidth="24"
                        strokeDasharray={`${seg.pct * circumference} ${circumference}`}
                        strokeDashoffset={`${-(seg.offset - 0.25) * circumference}`}
                        transform="rotate(-90 80 80)"
                      />
                    ))}
                    <text x="80" y="76" textAnchor="middle" fill="#111827" fontSize="11" fontWeight="600">Revenue</text>
                    <text x="80" y="91" textAnchor="middle" fill="#6b7280" fontSize="10">by category</text>
                  </svg>
                  {/* Legend */}
                  <div className="mt-2 space-y-1">
                    {segments.map((seg) => (
                      <div key={seg.label} className="flex items-center gap-1.5 text-xs">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: seg.color }} />
                        <span className="text-gray-600">{seg.label}</span>
                        <span className="text-gray-400 ml-auto pl-2">{Math.round(seg.pct * 100)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Table */}
                <div className="flex-1 overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-gray-600">Category</th>
                        <th className="px-4 py-3 text-center font-medium text-gray-600">In Orders</th>
                        <th className="px-4 py-3 text-center font-medium text-gray-600">Total Qty</th>
                        <th className="px-4 py-3 text-right font-medium text-gray-600">Revenue</th>
                        <th className="px-4 py-3 text-right font-medium text-gray-600">Share</th>
                      </tr>
                    </thead>
                    <tbody>
                      {segments.map((c) => (
                        <tr key={c.label} className="border-b last:border-0 hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
                              <span className="font-medium">{c.label}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center text-gray-600">{c.orderCount}</td>
                          <td className="px-4 py-3 text-center font-medium">{c.qty}</td>
                          <td className="px-4 py-3 text-right font-medium text-gray-800">
                            ${c.revenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-gray-600">
                            {Math.round(c.pct * 100)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })()}
        </div>
      </main>
    </div>
  )
}
