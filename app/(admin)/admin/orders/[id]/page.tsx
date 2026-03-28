'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { OrderStatusBadge } from '@/components/orders/OrderStatusBadge'
import { OrderStatusTimeline } from '@/components/orders/OrderStatusTimeline'
import type { OrderWithDetails } from '@/types'

export default function AdminOrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [order, setOrder] = useState<OrderWithDetails | null>(null)
  const [decisions, setDecisions] = useState<Record<string, { decision: string; confirmedQty: number; rejectReason: string }>>({})
  const [loading, setLoading] = useState(false)
  const [statusLoading, setStatusLoading] = useState(false)
  const [selectedStatus, setSelectedStatus] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [invoiceSaving, setInvoiceSaving] = useState(false)
  const [acknowledgementNumber, setAcknowledgementNumber] = useState('')
  const [ackSaving, setAckSaving] = useState(false)
  // Editable order info fields
  const [orderInfo, setOrderInfo] = useState({
    requestedDelivery: '',
    shippingMode: '',
    packageType: '',
    freightForwarder: '',
    notes: '',
  })
  const [orderInfoSaving, setOrderInfoSaving] = useState(false)
  const [orderInfoSaved, setOrderInfoSaved] = useState(false)
  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelLoading, setCancelLoading] = useState(false)

  useEffect(() => {
    fetch(`/api/orders/${id}`)
      .then((r) => r.json())
      .then((d) => {
        setOrder(d.order)
        const initial: typeof decisions = {}
        for (const item of d.order.items) {
          initial[item.id] = {
            decision: item.decision ?? 'ACCEPTED',
            confirmedQty: item.confirmedQty ?? item.requestedQty,
            rejectReason: item.rejectReason ?? '',
          }
        }
        setDecisions(initial)
        setSelectedStatus(d.order.status)
        setInvoiceNumber(d.order.invoiceNumber ?? '')
        setAcknowledgementNumber(d.order.acknowledgementNumber ?? '')
        setOrderInfo({
          requestedDelivery: d.order.requestedDelivery ? d.order.requestedDelivery.slice(0, 10) : '',
          shippingMode: d.order.shippingMode ?? '',
          packageType: d.order.packageType ?? '',
          freightForwarder: d.order.freightForwarder ?? '',
          notes: d.order.notes ?? '',
        })
      })
  }, [id])

  async function parseError(res: Response): Promise<string> {
    const text = await res.text()
    try { return JSON.parse(text).error ?? text } catch { return text }
  }

  async function handleStatusTransition(endpoint: string) {
    setStatusLoading(true)
    try {
      const res = await fetch(`/api/orders/${id}/${endpoint}`, { method: 'POST' })
      if (!res.ok) {
        alert(`Failed: ${await parseError(res)}`)
        return
      }
      const data = await res.json()
      setOrder((prev) => prev ? { ...prev, status: data.status, paymentSkipped: data.paymentSkipped ?? prev.paymentSkipped } : prev)
      setSelectedStatus(data.status)
    } catch (e) {
      alert(`Request failed: ${e instanceof Error ? e.message : 'Network error'}`)
    } finally {
      setStatusLoading(false)
    }
  }

  async function handleShipSkipPayment() {
    setStatusLoading(true)
    try {
      const res = await fetch(`/api/orders/${id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'SHIPPED' }),
      })
      if (!res.ok) {
        alert(`Failed: ${await parseError(res)}`)
        return
      }
      const data = await res.json()
      setOrder((prev) => prev ? { ...prev, status: data.status, paymentSkipped: data.paymentSkipped } : prev)
      setSelectedStatus(data.status)
    } catch (e) {
      alert(`Request failed: ${e instanceof Error ? e.message : 'Network error'}`)
    } finally {
      setStatusLoading(false)
    }
  }

  async function handleDirectStatusChange() {
    if (!selectedStatus || selectedStatus === order?.status) return
    setStatusLoading(true)
    try {
      const res = await fetch(`/api/orders/${id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: selectedStatus }),
      })
      if (!res.ok) {
        alert(`Status change failed: ${await parseError(res)}`)
        return
      }
      const data = await res.json()
      setOrder((prev) => prev ? { ...prev, status: data.status, paymentSkipped: data.paymentSkipped } : prev)
    } catch (e) {
      alert(`Request failed: ${e instanceof Error ? e.message : 'Network error'}`)
    } finally {
      setStatusLoading(false)
    }
  }

  async function patch(body: Record<string, unknown>) {
    const res = await fetch(`/api/orders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: 'Unknown error' }))
      alert(`Failed: ${error}`)
      return false
    }
    return true
  }

  async function handleSaveInvoiceNumber() {
    setInvoiceSaving(true)
    await patch({ invoiceNumber })
    setInvoiceSaving(false)
  }

  async function handleSaveAcknowledgementNumber() {
    setAckSaving(true)
    await patch({ acknowledgementNumber })
    setAckSaving(false)
  }

  async function handleSaveOrderInfo() {
    setOrderInfoSaving(true)
    const ok = await patch({
      requestedDelivery: orderInfo.requestedDelivery || null,
      shippingMode: orderInfo.shippingMode || null,
      packageType: orderInfo.packageType || null,
      freightForwarder: orderInfo.freightForwarder || null,
      notes: orderInfo.notes || null,
    })
    setOrderInfoSaving(false)
    if (ok) {
      setOrder((prev) => prev ? {
        ...prev,
        requestedDelivery: orderInfo.requestedDelivery ? orderInfo.requestedDelivery as unknown as Date : null,
        shippingMode: (orderInfo.shippingMode || null) as 'AIR' | 'OCEAN' | 'HANDCARRY' | null,
        packageType: (orderInfo.packageType || null) as 'PALLET' | 'CARTON' | 'TO_BE_DECIDED' | null,
        notes: orderInfo.notes || null,
      } : prev)
      setOrderInfoSaved(true)
      setTimeout(() => setOrderInfoSaved(false), 3000)
    }
  }

  async function handleCancelOrder() {
    if (!cancelReason.trim()) return
    setCancelLoading(true)
    try {
      const res = await fetch(`/api/orders/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: cancelReason }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Unknown error' }))
        alert(`Failed: ${data.error}`)
        return
      }
      setOrder((prev) => prev ? { ...prev, status: 'CANCELLED' as typeof prev.status } : prev)
      setCancelModalOpen(false)
    } catch (e) {
      alert(`Request failed: ${e instanceof Error ? e.message : 'Network error'}`)
    } finally {
      setCancelLoading(false)
    }
  }

  async function handleConfirm() {
    setLoading(true)
    // 1. Save item decisions
    await fetch(`/api/orders/${id}/items`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: Object.entries(decisions).map(([itemId, d]) => ({
          id: itemId,
          decision: d.decision,
          confirmedQty: d.confirmedQty,
          rejectReason: d.rejectReason,
        })),
      }),
    })
    // 2. Confirm order
    await fetch(`/api/orders/${id}/confirm`, { method: 'POST' })
    router.refresh()
    window.location.reload()
  }

  if (!order) return <div className="p-8 text-gray-400">Loading...</div>

  const total = order.items.reduce((s, i) => {
    const d = decisions[i.id]
    const qty = d?.decision === 'REJECTED' ? 0 : (d?.confirmedQty ?? i.requestedQty)
    return s + Number(i.unitPrice) * qty
  }, 0)

  return (
    <div>
      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Page title bar */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link href="/admin/orders" className="text-gray-400 hover:text-gray-600 text-sm">← Orders</Link>
            <h1 className="text-xl font-bold">{order.orderNumber}</h1>
            <OrderStatusBadge status={order.status} />
          </div>
          <div className="flex gap-2">
            {order.status !== 'SHIPPED' && order.status !== 'CANCELLED' && (
              <button
                onClick={() => setCancelModalOpen(true)}
                className="px-3 py-1.5 border border-red-300 text-red-600 rounded-lg text-sm hover:bg-red-50"
              >
                Cancel Order
              </button>
            )}
            <a href={`/api/export/orders`} className="px-3 py-1.5 border rounded-lg text-sm hover:bg-gray-50">
              Excel
            </a>
            {order.status === 'CONFIRMED' && (
              <>
                <a href={`/api/documents/confirmation/${id}`} target="_blank"
                  className="px-3 py-1.5 border rounded-lg text-sm hover:bg-gray-50">
                  Confirmation PDF
                </a>
                <a href={`/api/documents/invoice/${id}`} target="_blank"
                  className="px-3 py-1.5 border rounded-lg text-sm hover:bg-gray-50">
                  Invoice PDF
                </a>
                <Link href={`/admin/orders/${id}/cargo`}
                  className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700">
                  Cargo Details
                </Link>
              </>
            )}
          </div>
        </div>
        {/* Status Timeline */}
        <div className="bg-white rounded-xl border p-6 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-gray-500">Order Progress</h2>
            {/* Admin: direct status change */}
            <div className="flex items-center gap-2">
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="border rounded-lg px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400"
              >
                <option value="SUBMITTED">Order Checked</option>
                <option value="CONFIRMED">Order Confirmed</option>
                <option value="READY_TO_SHIP">Ready to Ship</option>
                <option value="PAYMENT_PENDING">Payment Pending</option>
                <option value="PAYMENT_CONFIRMED">Payment Confirmed</option>
                <option value="SHIPMENT_BOOKED">Shipment Booked</option>
                <option value="SHIPPED">Shipped</option>
              </select>
              <button
                onClick={handleDirectStatusChange}
                disabled={statusLoading || selectedStatus === order.status}
                className="px-3 py-1 bg-gray-700 text-white text-xs rounded-lg hover:bg-gray-800 disabled:opacity-40"
              >
                변경
              </button>
            </div>
          </div>
          <OrderStatusTimeline status={order.status} paymentSkipped={order.paymentSkipped} invoiceNumber={invoiceNumber || undefined} acknowledgementNumber={acknowledgementNumber || undefined} />
        </div>

        {/* Order Info — editable by admin */}
        <div className="bg-white rounded-xl border p-6 mb-4 text-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700">Order Details</h2>
            <div className="flex items-center gap-2">
              {orderInfoSaved && <span className="text-xs text-green-600">Saved</span>}
              <button
                onClick={handleSaveOrderInfo}
                disabled={orderInfoSaving}
                className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {orderInfoSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {/* Distributor — read-only */}
            <div>
              <span className="text-xs font-medium text-gray-500 block mb-1">Distributor</span>
              <div className="font-medium">{order.distributor.name}</div>
              <div className="text-gray-400 text-xs">{order.distributor.company}</div>
            </div>
            {/* Requested Delivery */}
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Requested Delivery</label>
              <input
                type="date"
                value={orderInfo.requestedDelivery}
                onChange={(e) => setOrderInfo({ ...orderInfo, requestedDelivery: e.target.value })}
                className="w-full border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
            {/* Shipping Mode */}
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Shipping Mode</label>
              <select
                value={orderInfo.shippingMode}
                onChange={(e) => setOrderInfo({ ...orderInfo, shippingMode: e.target.value })}
                className="w-full border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
              >
                <option value="">— Not set —</option>
                <option value="OCEAN">OCEAN</option>
                <option value="AIR">AIR</option>
                <option value="HANDCARRY">HANDCARRY</option>
              </select>
            </div>
            {/* Package Type */}
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Package Type</label>
              <select
                value={orderInfo.packageType}
                onChange={(e) => setOrderInfo({ ...orderInfo, packageType: e.target.value })}
                className="w-full border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
              >
                <option value="">— Not set —</option>
                <option value="PALLET">Pallet</option>
                <option value="CARTON">Carton</option>
                <option value="TO_BE_DECIDED">To Be Decided</option>
              </select>
            </div>
            {/* Freight Forwarder */}
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Freight Forwarder</label>
              <select
                value={orderInfo.freightForwarder}
                onChange={(e) => setOrderInfo({ ...orderInfo, freightForwarder: e.target.value })}
                className="w-full border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
              >
                <option value="">— Not set —</option>
                <option value="MY_FREIGHT_FORWARDER">My freight forwarder</option>
                <option value="EXPORTER_DESIGNATED">Exporter&apos;s designated freight forwarder</option>
                <option value="COURIER">Courier (FedEx, DHL, UPS, etc.)</option>
                <option value="NOT_DECIDED">Not decided</option>
              </select>
            </div>
            {/* Notes */}
            <div className="col-span-3">
              <label className="text-xs font-medium text-gray-500 block mb-1">Notes</label>
              <textarea
                value={orderInfo.notes}
                onChange={(e) => setOrderInfo({ ...orderInfo, notes: e.target.value })}
                rows={2}
                className="w-full border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none"
                placeholder="Order notes..."
              />
            </div>
            {/* Acknowledgement Number */}
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Acknowledgement Number</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={acknowledgementNumber}
                  onChange={(e) => setAcknowledgementNumber(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveAcknowledgementNumber()}
                  placeholder="ACK number"
                  className="border rounded-lg px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
                <button
                  onClick={handleSaveAcknowledgementNumber}
                  disabled={ackSaving}
                  className="px-3 py-1.5 bg-gray-600 text-white text-xs rounded-lg hover:bg-gray-700 disabled:opacity-50 whitespace-nowrap"
                >
                  {ackSaving ? '...' : 'Save'}
                </button>
              </div>
            </div>
            {/* Invoice Number */}
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Invoice Number</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveInvoiceNumber()}
                  placeholder="Invoice number"
                  className="border rounded-lg px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
                <button
                  onClick={handleSaveInvoiceNumber}
                  disabled={invoiceSaving}
                  className="px-3 py-1.5 bg-gray-600 text-white text-xs rounded-lg hover:bg-gray-700 disabled:opacity-50 whitespace-nowrap"
                >
                  {invoiceSaving ? '...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Items Table */}
        <div className="bg-white rounded-xl border overflow-hidden mb-4">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">SKU</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Product</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Req Qty</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Conf Qty</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Unit Price</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Decision</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => {
                const d = decisions[item.id] ?? { decision: 'ACCEPTED', confirmedQty: item.requestedQty, rejectReason: '' }
                return (
                  <tr key={item.id} className="border-b last:border-0">
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">{item.product.sku}</td>
                    <td className="px-4 py-3 font-medium">{item.product.name}</td>
                    <td className="px-4 py-3 text-right">{item.requestedQty}</td>
                    <td className="px-4 py-3 text-center">
                      {d.decision === 'ACCEPTED' ? (
                        <input
                          type="number"
                          min={0}
                          value={d.confirmedQty}
                          onChange={(e) => setDecisions({ ...decisions, [item.id]: { ...d, confirmedQty: Number(e.target.value) } })}
                          disabled={order.status === 'CONFIRMED'}
                          className="w-20 border rounded px-2 py-1 text-center text-sm disabled:bg-gray-50"
                        />
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">${Number(item.unitPrice).toFixed(2)}</td>
                    <td className="px-4 py-3 text-center">
                      {order.status !== 'CONFIRMED' ? (
                        <select
                          value={d.decision}
                          onChange={(e) => setDecisions({ ...decisions, [item.id]: { ...d, decision: e.target.value } })}
                          className={`border rounded px-2 py-1 text-xs ${d.decision === 'ACCEPTED' ? 'text-green-700 border-green-300' : 'text-red-700 border-red-300'}`}
                        >
                          <option value="ACCEPTED">✅ Accept</option>
                          <option value="REJECTED">❌ Reject</option>
                        </select>
                      ) : (
                        <span className={d.decision === 'ACCEPTED' ? 'text-green-600' : 'text-red-600'}>
                          {d.decision === 'ACCEPTED' ? '✅ Accepted' : '❌ Rejected'}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="bg-white rounded-xl border p-4 flex items-center justify-between">
          <div className="text-sm font-semibold">Total: ${total.toFixed(2)} USD</div>
          <div className="flex gap-2">
            {order.status === 'SUBMITTED' && (
              <button
                onClick={handleConfirm}
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Confirming...' : 'Confirm Order'}
              </button>
            )}
            {order.status === 'CONFIRMED' && (
              <button
                onClick={() => handleStatusTransition('ready')}
                disabled={statusLoading}
                className="px-5 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
              >
                {statusLoading ? '...' : 'Mark Ready to Ship'}
              </button>
            )}
            {order.status === 'READY_TO_SHIP' && (
              <button
                onClick={() => handleStatusTransition('payment-pending')}
                disabled={statusLoading}
                className="px-5 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50"
              >
                {statusLoading ? '...' : 'Request Payment'}
              </button>
            )}
            {order.status === 'PAYMENT_PENDING' && (
              <>
                <button
                  onClick={() => handleStatusTransition('payment-confirm')}
                  disabled={statusLoading}
                  className="px-5 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                >
                  {statusLoading ? '...' : 'Confirm Payment'}
                </button>
                <button
                  onClick={handleShipSkipPayment}
                  disabled={statusLoading}
                  className="px-5 py-2 bg-gray-800 text-white rounded-lg text-sm font-medium hover:bg-gray-900 disabled:opacity-50"
                >
                  {statusLoading ? '...' : 'Mark Shipped (Skip Payment)'}
                </button>
              </>
            )}
            {order.status === 'PAYMENT_CONFIRMED' && (
              <button
                onClick={() => handleStatusTransition('ship')}
                disabled={statusLoading}
                className="px-5 py-2 bg-gray-800 text-white rounded-lg text-sm font-medium hover:bg-gray-900 disabled:opacity-50"
              >
                {statusLoading ? '...' : 'Mark Shipped'}
              </button>
            )}
          </div>
        </div>
      </main>

      {/* Cancel Order Modal */}
      {cancelModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-base font-semibold mb-1">Cancel Order</h3>
            <p className="text-sm text-gray-500 mb-4">
              This action cannot be undone. The cancellation reason will be visible to the distributor.
            </p>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={4}
              placeholder="Enter cancellation reason..."
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none mb-4"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setCancelModalOpen(false); setCancelReason('') }}
                disabled={cancelLoading}
                className="px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                Back
              </button>
              <button
                onClick={handleCancelOrder}
                disabled={cancelLoading || !cancelReason.trim()}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {cancelLoading ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
