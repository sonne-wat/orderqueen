'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { OrderStatusBadge } from '@/components/orders/OrderStatusBadge'
import { OrderStatusTimeline } from '@/components/orders/OrderStatusTimeline'
import type { OrderWithDetails } from '@/types'

const FF_LABELS: Record<string, string> = {
  MY_FREIGHT_FORWARDER: 'My freight forwarder',
  EXPORTER_DESIGNATED: "Exporter's designated freight forwarder",
  COURIER: 'Courier (FedEx, DHL, UPS, etc.)',
  NOT_DECIDED: 'Not decided',
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [order, setOrder] = useState<OrderWithDetails | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  useEffect(() => {
    fetch(`/api/orders/${id}`)
      .then((r) => r.json())
      .then((d) => setOrder(d.order))
  }, [id])

  async function handleSubmit() {
    setSubmitting(true)
    setSubmitError('')
    const res = await fetch(`/api/orders/${id}/submit`, { method: 'POST' })
    setSubmitting(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: 'Failed to submit order.' }))
      setSubmitError(data.error ?? 'Failed to submit order.')
      return
    }
    router.push('/dashboard')
  }

  async function handleDelete() {
    if (!confirm('Are you sure you want to delete this order?')) return
    setDeleting(true)
    const res = await fetch(`/api/orders/${id}`, { method: 'DELETE' })
    setDeleting(false)
    if (res.ok) router.push('/dashboard')
  }

  if (!order) return <div className="p-8 text-gray-400 text-center">Loading...</div>

  const total = order.items.reduce(
    (s, i) => s + Number(i.unitPrice) * (i.confirmedQty ?? i.requestedQty),
    0
  )

  const isDraft = order.status === 'DRAFT'
  const isCancelled = order.status === 'CANCELLED'

  return (
    <div>
      <main className="max-w-4xl mx-auto px-6 py-8 space-y-4">
        {/* Page title */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-gray-400 hover:text-gray-600 text-sm">← Dashboard</Link>
            <h1 className="text-xl font-bold">{order.orderNumber}</h1>
            <OrderStatusBadge status={order.status} />
          </div>
          {isDraft && (
            <Link
              href={`/orders/new?draft=${id}`}
              className="px-3 py-1.5 border rounded-lg text-sm text-gray-600 hover:bg-gray-50"
            >
              Edit
            </Link>
          )}
        </div>

        {/* Draft notice */}
        {isDraft && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800">
            Please review your order and click <strong>Submit Order</strong> to finalize.
          </div>
        )}

        {/* Price change notice */}
        {order.confirmNote && !isCancelled && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm">
            <div className="font-semibold text-amber-800 mb-1">Price Change Notice</div>
            <div className="text-amber-700">{order.confirmNote}</div>
          </div>
        )}

        {/* Cancellation notice */}
        {isCancelled && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm">
            <div className="font-semibold text-red-700 mb-1">This order has been cancelled.</div>
            {order.cancelReason && (
              <div className="text-red-600">
                <span className="font-medium">Cancellation Reason: </span>
                {order.cancelReason}
              </div>
            )}
          </div>
        )}

        {/* Status Timeline — only for non-draft */}
        {!isDraft && (
          <div className="bg-white rounded-xl border p-6">
            <h2 className="text-sm font-medium text-gray-500 mb-2">Order Progress</h2>
            <OrderStatusTimeline status={order.status} paymentSkipped={order.paymentSkipped} invoiceNumber={order.invoiceNumber ?? undefined} acknowledgementNumber={order.acknowledgementNumber ?? undefined} />
          </div>
        )}

        {/* Order Info */}
        <div className="bg-white rounded-xl border p-6 grid grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Order Date</span>
            <div className="font-medium mt-1">{new Date(order.createdAt).toLocaleDateString('ko-KR')}</div>
          </div>
          <div>
            <span className="text-gray-500">Requested Delivery</span>
            <div className="font-medium mt-1">
              {order.requestedDelivery ? new Date(order.requestedDelivery).toLocaleDateString('ko-KR') : '-'}
            </div>
          </div>
          <div>
            <span className="text-gray-500">Shipping Mode</span>
            <div className="font-medium mt-1">{order.shippingMode ?? '-'}</div>
          </div>
          {order.packageType && (
            <div>
              <span className="text-gray-500">Package Type</span>
              <div className="font-medium mt-1">{order.packageType === 'TO_BE_DECIDED' || !order.packageType ? 'To Be Decided' : order.packageType}</div>
            </div>
          )}
          {order.freightForwarder && (
            <div>
              <span className="text-gray-500">Freight Forwarder</span>
              <div className="font-medium mt-1">{FF_LABELS[order.freightForwarder as string] ?? order.freightForwarder}</div>
            </div>
          )}
          {order.notes && (
            <div className="col-span-3">
              <span className="text-gray-500">Notes</span>
              <div className="mt-1 text-gray-700">{order.notes}</div>
            </div>
          )}
        </div>

        {/* Items */}
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">SKU</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Product</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Qty</th>
                {!isDraft && (
                  <>
                    <th className="px-4 py-3 text-right font-medium text-gray-600">Conf Qty</th>
                    <th className="px-4 py-3 text-center font-medium text-gray-600">Decision</th>
                  </>
                )}
                <th className="px-4 py-3 text-right font-medium text-gray-600">Unit Price</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => {
                const qty = item.confirmedQty ?? item.requestedQty
                return (
                  <tr key={item.id} className="border-b last:border-0">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{item.product.sku}</td>
                    <td className="px-4 py-3 font-medium">{item.product.name}</td>
                    <td className="px-4 py-3 text-right">{item.requestedQty}</td>
                    {!isDraft && (
                      <>
                        <td className="px-4 py-3 text-right">
                          {item.confirmedQty != null ? (
                            item.confirmedQty !== item.requestedQty ? (
                              <div className="flex flex-col items-end gap-0.5">
                                <span className="text-xs text-gray-400 line-through">{item.requestedQty}</span>
                                <span className="text-amber-700 font-medium">{item.confirmedQty}</span>
                              </div>
                            ) : (
                              <span>{item.confirmedQty}</span>
                            )
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {item.decision === 'ACCEPTED' && <span className="text-green-600 text-xs">✅ Accepted</span>}
                          {item.decision === 'REJECTED' && <span className="text-red-500 text-xs">❌ Rejected</span>}
                          {!item.decision && <span className="text-gray-400 text-xs">Pending</span>}
                        </td>
                      </>
                    )}
                    <td className="px-4 py-3 text-right">
                      {item.originalUnitPrice !== null && item.originalUnitPrice !== undefined && Number(item.originalUnitPrice) !== Number(item.unitPrice) ? (
                        <div className="flex flex-col items-end gap-0.5">
                          <span className="text-xs text-gray-400 line-through">${Number(item.originalUnitPrice).toFixed(2)}</span>
                          <span className="text-amber-700 font-medium">${Number(item.unitPrice).toFixed(2)}</span>
                        </div>
                      ) : (
                        <span>${Number(item.unitPrice).toFixed(2)}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">${(Number(item.unitPrice) * qty).toFixed(2)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Shipment Info */}
        {order.shipment && (
          <div className="bg-white rounded-xl border p-6 text-sm">
            <h2 className="font-semibold mb-3">Shipment Details</h2>
            <div className="grid grid-cols-3 gap-3">
              {order.shipment.carrier && <div><span className="text-gray-500">Carrier</span><div className="font-medium mt-1">{order.shipment.carrier}</div></div>}
              {order.shipment.trackingNumber && <div><span className="text-gray-500">Tracking #</span><div className="font-medium mt-1">{order.shipment.trackingNumber}</div></div>}
              {order.shipment.scheduledDate && <div><span className="text-gray-500">Scheduled</span><div className="font-medium mt-1">{new Date(order.shipment.scheduledDate).toLocaleDateString('ko-KR')}</div></div>}
              {order.shipment.cbm && <div><span className="text-gray-500">CBM (m³)</span><div className="font-medium mt-1">{String(order.shipment.cbm)}</div></div>}
              {order.shipment.weightKg && <div><span className="text-gray-500">Weight (kg)</span><div className="font-medium mt-1">{String(order.shipment.weightKg)}</div></div>}
            </div>
          </div>
        )}

        {/* Submit error */}
        {submitError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            {submitError}
          </div>
        )}

        {/* Footer */}
        <div className="bg-white rounded-xl border p-4 flex items-center justify-between">
          <div className="font-semibold">Total: ${total.toFixed(2)} USD</div>
          {isDraft ? (
            <div className="flex gap-3">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
              <Link
                href={`/orders/new?draft=${id}`}
                className="px-4 py-2 border rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                ← Edit
              </Link>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Submit Order'}
              </button>
            </div>
          ) : (
            <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-700">← Back to Dashboard</Link>
          )}
        </div>
      </main>
    </div>
  )
}
