import { Fragment } from 'react'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { OrderStatusBadge } from '@/components/orders/OrderStatusBadge'
import { OrderStatusProgress } from '@/components/orders/OrderStatusTimeline'
import { orderTotal } from '@/lib/utils/order'
import { OrderFilters } from './OrderFilters'
import type { Prisma } from '@prisma/client'

const FF_LABELS: Record<string, string> = {
  MY_FREIGHT_FORWARDER: 'My Forwarder',
  EXPORTER_DESIGNATED: "Exporter's Forwarder",
  COURIER: 'Courier',
  NOT_DECIDED: 'Not Decided',
}

const STATUS_GROUPS = [
  { key: 'all',               label: 'All' },
  { key: 'SUBMITTED',         label: 'Order Checked' },
  { key: 'CONFIRMED',         label: 'Confirmed' },
  { key: 'READY_TO_SHIP',     label: 'Ready to Ship' },
  { key: 'PAYMENT_PENDING',   label: 'Payment Pending' },
  { key: 'PAYMENT_CONFIRMED', label: 'Payment Confirmed' },
  { key: 'SHIPMENT_BOOKED',   label: 'Shipment Booked' },
  { key: 'SHIPPED',           label: 'Shipped' },
]

const NEXT_ACTION: Record<string, { label: string; color: string }> = {
  SUBMITTED:         { label: 'Confirm Order',       color: 'text-blue-600' },
  CONFIRMED:         { label: 'Mark Ready to Ship',  color: 'text-purple-600' },
  READY_TO_SHIP:     { label: 'Request Payment',     color: 'text-orange-600' },
  PAYMENT_PENDING:   { label: 'Confirm Payment',     color: 'text-green-600' },
  PAYMENT_CONFIRMED: { label: 'Book Shipment',        color: 'text-violet-600' },
  SHIPMENT_BOOKED:   { label: 'Mark Shipped',         color: 'text-gray-700' },
}

interface SearchParams {
  distributorId?: string
  status?: string
  shippingMode?: string
  dateFrom?: string
  dateTo?: string
  search?: string
}

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const session = await auth()
  if (!session || session.user?.role !== 'ADMIN') redirect('/login')

  const sp = await searchParams

  // Build where clause from filters
  const where: Prisma.OrderWhereInput = {
    status: { not: 'DRAFT' },
  }

  if (sp.distributorId) {
    where.distributorId = sp.distributorId
  }

  if (sp.status) {
    where.status = sp.status as 'DRAFT' | 'SUBMITTED' | 'CONFIRMED' | 'PAYMENT_PENDING' | 'PAYMENT_CONFIRMED' | 'READY_TO_SHIP' | 'SHIPMENT_BOOKED' | 'SHIPPED'
  }

  if (sp.shippingMode) {
    where.shippingMode = sp.shippingMode as 'AIR' | 'OCEAN' | 'HANDCARRY'
  }

  if (sp.dateFrom || sp.dateTo) {
    where.createdAt = {
      ...(sp.dateFrom ? { gte: new Date(sp.dateFrom) } : {}),
      ...(sp.dateTo ? { lte: new Date(sp.dateTo + 'T23:59:59.999Z') } : {}),
    }
  }

  if (sp.search) {
    const term = sp.search
    where.OR = [
      { orderNumber: { contains: term, mode: 'insensitive' } },
      { distributor: { name: { contains: term, mode: 'insensitive' } } },
      { distributor: { company: { contains: term, mode: 'insensitive' } } },
    ]
  }

  const [orders, totalCount, batchOrderRows, distributors] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        distributor: { select: { name: true, company: true } },
        items: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.order.count({ where: { status: { not: 'DRAFT' } } }),
    prisma.$queryRaw<{ orderId: string; batchId: string; batchNumber: string; requestId: string }[]>`
      SELECT s."orderId", bs.id AS "batchId", bs."batchNumber", bs."shipmentRequestId" AS "requestId"
      FROM batch_shipments bs
      JOIN shipments s ON s."batchShipmentId" = bs.id
    `,
    prisma.user.findMany({
      where: { role: 'DISTRIBUTOR' },
      select: { id: true, name: true, company: true },
      orderBy: { name: 'asc' },
    }),
  ])

  // Build orderId → batch mapping
  const orderToBatch = new Map<string, { batchId: string; batchNumber: string; requestId: string }>()
  for (const row of batchOrderRows) {
    orderToBatch.set(row.orderId, { batchId: row.batchId, batchNumber: row.batchNumber, requestId: row.requestId })
  }

  type OrderType = typeof orders[number]
  const batchGroupMap = new Map<string, { batchId: string; batchNumber: string; requestId: string; orders: OrderType[] }>()
  const soloOrders: OrderType[] = []

  for (const order of orders) {
    const batch = orderToBatch.get(order.id)
    if (batch) {
      if (!batchGroupMap.has(batch.batchId)) {
        batchGroupMap.set(batch.batchId, { ...batch, orders: [] })
      }
      batchGroupMap.get(batch.batchId)!.orders.push(order)
    } else {
      soloOrders.push(order)
    }
  }
  const batchGroups = Array.from(batchGroupMap.values())

  const counts: Record<string, number> = { all: orders.length }
  for (const o of orders) counts[o.status] = (counts[o.status] ?? 0) + 1

  const pendingAction = orders.filter((o) => NEXT_ACTION[o.status])
  const hasFilter = !!(sp.distributorId || sp.status || sp.shippingMode || sp.dateFrom || sp.dateTo || sp.search)

  return (
    <div>
      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">
            Order Management
            <span className="ml-2 text-sm font-normal text-gray-400">
              {hasFilter ? `${orders.length} / ${totalCount}` : totalCount}
            </span>
          </h2>
          <a href="/api/export/orders" className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition">
            Export Excel
          </a>
        </div>

        {/* Filters */}
        <OrderFilters
          distributors={distributors}
          totalCount={totalCount}
          filteredCount={orders.length}
        />

        {pendingAction.length > 0 && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3">
            <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse flex-shrink-0" />
            <span className="text-sm text-amber-800 font-medium">{pendingAction.length}개 주문이 처리를 기다리고 있습니다</span>
          </div>
        )}

        <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
          {STATUS_GROUPS.map((g) => (
            <div key={g.key} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white border text-gray-600 whitespace-nowrap">
              {g.label}
              {counts[g.key] ? <span className="px-1.5 py-0.5 bg-gray-100 rounded-full text-[10px]">{counts[g.key]}</span> : null}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Order #</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Distributor</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Date</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Items</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Amount</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 w-40">Progress</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Action</th>
              </tr>
            </thead>
            <tbody>
              {/* Batch groups */}
              {batchGroups.map((group) => (
                <Fragment key={group.batchId}>
                  <tr className="bg-green-50 border-b">
                    <td colSpan={8} className="px-4 py-2">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs font-bold text-green-700 bg-green-100 px-2.5 py-0.5 rounded-full">
                          {group.batchNumber}
                        </span>
                        <span className="text-xs text-green-600">{group.orders.length} orders</span>
                        <span className="text-xs font-semibold text-green-700">
                          ${group.orders.reduce((sum, o) => sum + orderTotal(o.items), 0).toFixed(2)} USD
                        </span>
                        <Link
                          href={`/admin/batch-shipments/${group.batchId}/cargo`}
                          className="px-3 py-1 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700"
                        >
                          Manage Batch →
                        </Link>
                      </div>
                    </td>
                  </tr>
                  {group.orders.map((order, idx) => {
                    return (
                      <tr key={order.id} className={`border-b hover:bg-green-50/50 ${idx === group.orders.length - 1 ? 'border-b-2 border-green-200' : ''}`}>
                        <td className="px-4 py-3 font-mono text-xs text-gray-600">
                          <span className="mr-1.5 text-green-400">┗</span>{order.orderNumber}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium">{order.distributor.name}</div>
                          <div className="text-xs text-gray-400">{order.distributor.company}</div>
                          {order.freightForwarder && (
                            <div className="text-xs text-indigo-500 mt-0.5">{FF_LABELS[order.freightForwarder] ?? order.freightForwarder}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{order.createdAt.toLocaleDateString('ko-KR')}</td>
                        <td className="px-4 py-3 text-center">{order.items.length}</td>
                        <td className="px-4 py-3 text-right text-xs font-medium text-gray-700">
                          ${orderTotal(order.items).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 w-40">
                          <OrderStatusProgress status={order.status} paymentSkipped={order.paymentSkipped} />
                        </td>
                        <td className="px-4 py-3"><OrderStatusBadge status={order.status} /></td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Link href={`/admin/orders/${order.id}`} className="text-xs text-gray-400 hover:underline">
                              View →
                            </Link>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </Fragment>
              ))}

              {/* Solo orders */}
              {soloOrders.map((order) => {
                const nextAction = NEXT_ACTION[order.status]
                return (
                  <tr key={order.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{order.orderNumber}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{order.distributor.name}</div>
                      <div className="text-xs text-gray-400">{order.distributor.company}</div>
                      {order.freightForwarder && (
                        <div className="text-xs text-indigo-500 mt-0.5">{FF_LABELS[order.freightForwarder] ?? order.freightForwarder}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{order.createdAt.toLocaleDateString('ko-KR')}</td>
                    <td className="px-4 py-3 text-center">{order.items.length}</td>
                    <td className="px-4 py-3 text-right text-xs font-medium text-gray-700">
                      ${orderTotal(order.items).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 w-40">
                      <OrderStatusProgress status={order.status} paymentSkipped={order.paymentSkipped} />
                    </td>
                    <td className="px-4 py-3"><OrderStatusBadge status={order.status} /></td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Link href={`/admin/orders/${order.id}`} className="inline-block">
                          {nextAction ? (
                            <span className={`text-xs font-medium ${nextAction.color} hover:underline`}>{nextAction.label} →</span>
                          ) : (
                            <span className="text-xs text-blue-600 hover:underline">View →</span>
                          )}
                        </Link>
                        {['READY_TO_SHIP', 'PAYMENT_PENDING', 'PAYMENT_CONFIRMED', 'SHIPMENT_BOOKED', 'SHIPPED'].includes(order.status) && (
                          <Link href={`/admin/orders/${order.id}/cargo`} className="text-xs text-gray-400 hover:text-gray-600 hover:underline">
                            Cargo
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}

              {orders.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <div className="text-gray-400 text-sm">No orders found</div>
                    {hasFilter && <div className="text-gray-300 text-xs mt-1">Try adjusting your filters</div>}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  )
}
