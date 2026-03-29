import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { OrderStatusTimeline } from '@/components/orders/OrderStatusTimeline'
import { OrderStatusBadge } from '@/components/orders/OrderStatusBadge'
import { orderTotal } from '@/lib/utils/order'
import { DashboardDateFilter } from '@/components/ui/DashboardDateFilter'

const STATUS_MESSAGE: Record<string, { msg: string; color: string }> = {
  SUBMITTED:         { msg: 'Your order has been received. Admin is reviewing the items.', color: 'text-blue-600 bg-blue-50' },
  CONFIRMED:         { msg: 'Order confirmed! Goods are being prepared for shipment.', color: 'text-green-700 bg-green-50' },
  READY_TO_SHIP:     { msg: 'Your order is packed and ready for dispatch.', color: 'text-purple-700 bg-purple-50' },
  PAYMENT_PENDING:   { msg: 'Payment request sent. Please complete payment to proceed.', color: 'text-orange-700 bg-orange-50' },
  PAYMENT_CONFIRMED: { msg: 'Payment received. Your order will be shipped shortly.', color: 'text-teal-700 bg-teal-50' },
  SHIPPED:           { msg: 'Your order has been shipped! Check shipment details below.', color: 'text-indigo-700 bg-indigo-50' },
}

const BATCH_STATUS_LABEL: Record<string, string> = {
  PREPARING: 'Preparing',
  READY:     'Ready to Ship',
  SHIPPED:   'Shipped',
}

type BatchGroup = {
  batchId: string
  batchStatus: string
  requestId: string
  orders: { id: string; orderNumber: string; status: string; createdAt: Date; requestedDelivery: Date | null; shippingMode: string | null; items: { unitPrice: unknown; requestedQty: number; confirmedQty: number | null }[] }[]
}

export default async function DistributorDashboard({
  searchParams,
}: {
  searchParams: Promise<{ dateFrom?: string; dateTo?: string; all?: string }>
}) {
  const session = await auth()
  if (!session) redirect('/login')

  const distributorId = session.user!.id!

  const { dateFrom, dateTo, all } = await searchParams

  // Default: last 3 months (unless "all=1" or custom range provided)
  const isAllTime = all === '1'
  const defaultFrom = new Date()
  defaultFrom.setMonth(defaultFrom.getMonth() - 3)
  defaultFrom.setHours(0, 0, 0, 0)

  const fromDate = isAllTime ? undefined : dateFrom ? new Date(dateFrom + 'T00:00:00Z') : defaultFrom
  const toDate = isAllTime ? undefined : dateTo ? new Date(dateTo + 'T23:59:59Z') : new Date()

  const filterFrom = isAllTime ? '' : (dateFrom ?? defaultFrom.toISOString().slice(0, 10))
  const filterTo = isAllTime ? '' : (dateTo ?? '')

  const [orders, pendingRequestOrders, batchOrderRows] = await Promise.all([
    prisma.order.findMany({
      where: {
        distributorId,
        ...(fromDate || toDate ? { createdAt: { gte: fromDate, lte: toDate } } : {}),
      },
      include: { items: { include: { product: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.$queryRaw<{ orderId: string }[]>`
      SELECT sro."orderId"
      FROM shipment_request_orders sro
      JOIN shipment_requests sr ON sr.id = sro."shipmentRequestId"
      WHERE sr."distributorId" = ${distributorId} AND sr.status = 'PENDING'
    `,
    prisma.$queryRaw<{ orderId: string; batchId: string; batchStatus: string; requestId: string }[]>`
      SELECT s."orderId", bs.id AS "batchId", bs.status::text AS "batchStatus", bs."shipmentRequestId" AS "requestId"
      FROM batch_shipments bs
      JOIN shipment_requests sr ON sr.id = bs."shipmentRequestId"
      JOIN shipments s ON s."batchShipmentId" = bs.id
      WHERE sr."distributorId" = ${distributorId}
    `,
  ])

  const pendingRequestOrderIds = new Set(pendingRequestOrders.map((r) => r.orderId))

  // Build orderId → batch mapping
  const orderToBatch = new Map<string, { batchId: string; batchStatus: string; requestId: string }>()
  for (const row of batchOrderRows) {
    orderToBatch.set(row.orderId, { batchId: row.batchId, batchStatus: row.batchStatus, requestId: row.requestId })
  }

  const activeOrders = orders.filter((o) => o.status !== 'DRAFT' && o.status !== 'SHIPPED' && o.status !== 'CANCELLED')
  const draftOrders  = orders.filter((o) => o.status === 'DRAFT')
  const pastOrders   = orders.filter((o) => o.status === 'SHIPPED')
  const cancelledOrders = orders.filter((o) => o.status === 'CANCELLED')

  // Separate active orders into batch groups vs solo
  const batchGroupMap = new Map<string, BatchGroup>()
  const soloActiveOrders: typeof activeOrders = []
  for (const order of activeOrders) {
    const batch = orderToBatch.get(order.id)
    if (batch) {
      if (!batchGroupMap.has(batch.batchId)) {
        batchGroupMap.set(batch.batchId, { ...batch, orders: [] })
      }
      batchGroupMap.get(batch.batchId)!.orders.push(order)
    } else {
      soloActiveOrders.push(order)
    }
  }
  const batchGroups = Array.from(batchGroupMap.values())

  // Separate past orders into batch groups vs solo
  const pastBatchGroupMap = new Map<string, BatchGroup>()
  const soloPastOrders: typeof pastOrders = []
  for (const order of pastOrders) {
    const batch = orderToBatch.get(order.id)
    if (batch) {
      if (!pastBatchGroupMap.has(batch.batchId)) {
        pastBatchGroupMap.set(batch.batchId, { ...batch, orders: [] })
      }
      pastBatchGroupMap.get(batch.batchId)!.orders.push(order)
    } else {
      soloPastOrders.push(order)
    }
  }
  const pastBatchGroups = Array.from(pastBatchGroupMap.values())

  // CONFIRMED orders not already in a pending request → eligible for batch request
  const eligibleForBatch = activeOrders.filter(
    (o) => o.status === 'CONFIRMED' && !pendingRequestOrderIds.has(o.id) && !orderToBatch.has(o.id)
  )

  const totalActiveCount = activeOrders.length

  return (
    <div>
      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="mb-4">
          <DashboardDateFilter dateFrom={filterFrom} dateTo={filterTo} allTime={isAllTime} />
        </div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">My Orders ({orders.length})</h2>
          <div className="flex items-center gap-2">
            {eligibleForBatch.length >= 2 && (
              <Link
                href="/orders/shipping-request"
                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
              >
                Request Batch Shipment ({eligibleForBatch.length})
              </Link>
            )}
            <Link
              href="/orders/new"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              + New Order
            </Link>
          </div>
        </div>

        {orders.length === 0 ? (
          <div className="bg-white rounded-xl border p-12 text-center text-gray-400">
            <p className="text-lg mb-2">No orders found</p>
            <Link href="/orders/new" className="text-blue-600 hover:underline text-sm">Place your first order</Link>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Active Orders */}
            {totalActiveCount > 0 && (
              <section>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  Active Orders ({totalActiveCount})
                </h3>
                <div className="space-y-4">

                  {/* Batch Shipment Groups */}
                  {batchGroups.map((group) => {
                    const firstOrder = group.orders[0]
                    const statusMsg = STATUS_MESSAGE[firstOrder.status]
                    const batchTotal = group.orders.reduce((sum, o) => sum + orderTotal(o.items), 0)
                    return (
                      <div key={group.batchId} className="bg-white rounded-xl border shadow-sm ring-1 ring-green-200">
                        {/* Batch Header */}
                        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b bg-green-50 rounded-t-xl">
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                              Batch Shipment
                            </span>
                            <OrderStatusBadge status={firstOrder.status} />
                            <span className="text-xs text-green-600 font-medium">
                              {group.orders.length} orders consolidated
                            </span>
                          </div>
                          <Link
                            href={`/orders/shipment-requests/${group.requestId}`}
                            className="text-xs text-green-700 hover:underline font-medium"
                          >
                            View Request →
                          </Link>
                        </div>

                        {/* Order list within the batch */}
                        <div className="px-6 pt-4 pb-2 flex flex-wrap gap-2">
                          {group.orders.map((o) => (
                            <Link
                              key={o.id}
                              href={`/orders/${o.id}`}
                              className="inline-flex items-center gap-1.5 bg-gray-50 border rounded-lg px-3 py-1.5 text-xs hover:bg-gray-100"
                            >
                              <span className="font-mono font-medium">{o.orderNumber}</span>
                              <span className="text-gray-400">${orderTotal(o.items).toFixed(2)}</span>
                            </Link>
                          ))}
                        </div>

                        {/* Status message */}
                        {statusMsg && (
                          <div className={`mx-6 mt-2 px-3 py-2 rounded-lg text-xs font-medium ${statusMsg.color}`}>
                            {statusMsg.msg}
                          </div>
                        )}

                        {/* Progress Timeline */}
                        <div className="px-6 py-4">
                          <OrderStatusTimeline status={firstOrder.status} />
                        </div>

                        {/* Footer */}
                        <div className="px-6 pb-4 flex items-center justify-between text-sm border-t pt-3">
                          <span className="text-gray-500 font-medium">
                            Combined Total: ${batchTotal.toFixed(2)} USD
                          </span>
                          <span className="text-xs text-gray-400">
                            {BATCH_STATUS_LABEL[group.batchStatus] ?? group.batchStatus}
                          </span>
                        </div>
                      </div>
                    )
                  })}

                  {/* Solo (non-batch) active orders */}
                  {soloActiveOrders.map((order) => {
                    const statusMsg = STATUS_MESSAGE[order.status]
                    const total = orderTotal(order.items)
                    return (
                      <div key={order.id} className="bg-white rounded-xl border shadow-sm">
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b">
                          <div className="flex items-center gap-3">
                            <span className="font-semibold text-base">{order.orderNumber}</span>
                            <OrderStatusBadge status={order.status} />
                            {pendingRequestOrderIds.has(order.id) && (
                              <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full font-medium">
                                Shipment Requested
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-400 text-right">
                            <div>Ordered: {order.createdAt.toLocaleDateString('ko-KR')}</div>
                            {order.requestedDelivery && (
                              <div>Delivery: {order.requestedDelivery.toLocaleDateString('ko-KR')}</div>
                            )}
                          </div>
                        </div>

                        {/* Status message */}
                        {statusMsg && (
                          <div className={`mx-6 mt-4 px-3 py-2 rounded-lg text-xs font-medium ${statusMsg.color}`}>
                            {statusMsg.msg}
                          </div>
                        )}

                        {/* Progress Timeline */}
                        <div className="px-6 py-4">
                          <OrderStatusTimeline status={order.status} />
                        </div>

                        {/* Footer */}
                        <div className="px-6 pb-4 flex items-center justify-between text-sm">
                          <span className="text-gray-500">
                            {order.items.length} items · ${total.toFixed(2)} USD
                            {order.shippingMode && (
                              <span className="ml-2 px-2 py-0.5 bg-gray-100 rounded text-xs">{order.shippingMode}</span>
                            )}
                          </span>
                          <Link href={`/orders/${order.id}`} className="text-blue-600 hover:underline font-medium">
                            View Details →
                          </Link>
                        </div>
                      </div>
                    )
                  })}

                </div>
              </section>
            )}

            {/* Draft Orders */}
            {draftOrders.length > 0 && (
              <section>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  Drafts ({draftOrders.length})
                </h3>
                <div className="space-y-2">
                  {draftOrders.map((order) => (
                    <div key={order.id} className="bg-white rounded-lg border px-5 py-3 flex items-center justify-between">
                      <div>
                        <span className="font-medium text-sm">{order.orderNumber}</span>
                        <span className="ml-2 text-xs text-gray-400">{order.items.length} items</span>
                        <span className="ml-2 text-xs text-gray-400">{order.createdAt.toLocaleDateString('ko-KR')}</span>
                      </div>
                      <div className="flex gap-3">
                        <Link href={`/orders/new?draft=${order.id}`} className="text-xs text-gray-500 hover:underline">
                          Edit →
                        </Link>
                        <Link href={`/orders/${order.id}`} className="text-xs text-blue-600 hover:underline">
                          Review &amp; Submit →
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Past Orders */}
            {(soloPastOrders.length > 0 || pastBatchGroups.length > 0) && (
              <section>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  Completed ({pastOrders.length})
                </h3>
                <div className="space-y-2">
                  {/* Past batch groups */}
                  {pastBatchGroups.map((group) => {
                    const batchTotal = group.orders.reduce((sum, o) => sum + orderTotal(o.items), 0)
                    return (
                      <div key={group.batchId} className="bg-white rounded-lg border px-5 py-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                              Batch
                            </span>
                            {group.orders.map((o) => (
                              <Link key={o.id} href={`/orders/${o.id}`} className="font-mono text-xs text-gray-600 hover:underline">
                                {o.orderNumber}
                              </Link>
                            ))}
                          </div>
                          <div className="flex items-center gap-4 text-sm">
                            <span className="font-medium">${batchTotal.toFixed(2)}</span>
                            <Link href={`/orders/shipment-requests/${group.requestId}`} className="text-xs text-blue-600 hover:underline">
                              View →
                            </Link>
                          </div>
                        </div>
                      </div>
                    )
                  })}

                  {/* Solo past orders */}
                  {soloPastOrders.length > 0 && (
                    <div className="bg-white rounded-xl border overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b">
                          <tr>
                            <th className="px-4 py-2 text-left font-medium text-gray-500">Order #</th>
                            <th className="px-4 py-2 text-left font-medium text-gray-500">Date</th>
                            <th className="px-4 py-2 text-center font-medium text-gray-500">Items</th>
                            <th className="px-4 py-2 text-right font-medium text-gray-500">Amount</th>
                            <th className="px-4 py-2 text-center font-medium text-gray-500"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {soloPastOrders.map((order) => {
                            const total = orderTotal(order.items)
                            return (
                              <tr key={order.id} className="border-b last:border-0">
                                <td className="px-4 py-2 font-mono text-xs">{order.orderNumber}</td>
                                <td className="px-4 py-2 text-gray-500">{order.createdAt.toLocaleDateString('ko-KR')}</td>
                                <td className="px-4 py-2 text-center text-gray-500">{order.items.length}</td>
                                <td className="px-4 py-2 text-right font-medium">${total.toFixed(2)}</td>
                                <td className="px-4 py-2 text-center">
                                  <Link href={`/orders/${order.id}`} className="text-xs text-blue-600 hover:underline">View →</Link>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </section>
            )}
            {/* Cancelled Orders */}
            {cancelledOrders.length > 0 && (
              <section>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  Cancelled ({cancelledOrders.length})
                </h3>
                <div className="space-y-2">
                  {cancelledOrders.map((order) => (
                    <div key={order.id} className="bg-white rounded-lg border border-red-100 px-5 py-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-medium text-gray-700">{order.orderNumber}</span>
                          <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Cancelled</span>
                        </div>
                        <Link href={`/orders/${order.id}`} className="text-xs text-gray-500 hover:underline">View →</Link>
                      </div>
                      {order.cancelReason && (
                        <p className="mt-1 text-xs text-red-600">
                          Reason: {order.cancelReason}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
