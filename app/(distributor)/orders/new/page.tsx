'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { ProductWithLowStock } from '@/types'
import * as XLSX from 'xlsx'

const CATEGORIES = [
  { key: 'BOWLING_BALL',      label: 'Bowling Ball' },
  { key: 'BOWLING_BAG',       label: 'Bowling Bag' },
  { key: 'BOWLING_SHOES',     label: 'Bowling Shoes' },
  { key: 'APPAREL',           label: 'Apparel' },
  { key: 'BOWLING_ACCESSORY', label: 'Bowling Accessory' },
  { key: null,                label: 'Uncategorized' },
]

const PACKAGE_TYPES = [
  { value: 'PALLET',  label: 'Pallet' },
  { value: 'CARTON',  label: 'Carton' },
  { value: '',        label: 'To Be Decided' },
]

const FREIGHT_FORWARDER_OPTIONS = [
  { value: 'MY_FREIGHT_FORWARDER',  label: 'My freight forwarder' },
  { value: 'EXPORTER_DESIGNATED',   label: "Exporter's designated freight forwarder" },
  { value: 'COURIER',               label: 'Courier (FedEx, DHL, UPS, etc.)' },
  { value: 'NOT_DECIDED',           label: 'Not decided' },
]

export default function NewOrderPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const draftId = searchParams.get('draft')

  const [products, setProducts] = useState<ProductWithLowStock[]>([])
  const [items, setItems] = useState<{ productId: string; qty: number }[]>([])
  const [deliveryDate, setDeliveryDate] = useState('')
  const [shippingMode, setShippingMode] = useState<'AIR' | 'OCEAN' | 'HANDCARRY'>('OCEAN')
  const [packageType, setPackageType] = useState('')
  const [freightForwarder, setFreightForwarder] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(!!draftId)
  const [error, setError] = useState('')
  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set(['BOWLING_BALL']))
  const [uploadError, setUploadError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load products
  useEffect(() => {
    fetch('/api/products')
      .then((r) => r.json())
      .then((d) => setProducts(d.products))
  }, [])

  // Load draft data if editing
  useEffect(() => {
    if (!draftId) return
    fetch(`/api/orders/${draftId}`)
      .then((r) => r.json())
      .then((d) => {
        const order = d.order
        if (!order || order.status !== 'DRAFT') { router.push('/dashboard'); return }
        setDeliveryDate(order.requestedDelivery ? order.requestedDelivery.slice(0, 10) : '')
        setShippingMode(order.shippingMode ?? 'OCEAN')
        setPackageType(order.packageType ?? '')
        setFreightForwarder(order.freightForwarder ?? '')
        setNotes(order.notes ?? '')
        setItems(order.items.map((i: { productId: string; requestedQty: number }) => ({
          productId: i.productId,
          qty: i.requestedQty,
        })))
        setInitializing(false)
      })
  }, [draftId, router])

  function toggleCategory(key: string) {
    setOpenCategories((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  function setQty(productId: string, qty: number) {
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === productId)
      if (qty <= 0) return prev.filter((i) => i.productId !== productId)
      if (existing) return prev.map((i) => (i.productId === productId ? { ...i, qty } : i))
      return [...prev, { productId, qty }]
    })
  }

  function getQty(productId: string) {
    return items.find((i) => i.productId === productId)?.qty ?? 0
  }

  const grouped = useMemo(() => {
    return CATEGORIES.map(({ key, label }) => ({
      key,
      label,
      products: products.filter((p) => (p.category ?? null) === key),
      selectedCount: items.filter((i) =>
        products.find((p) => p.id === i.productId && (p.category ?? null) === key)
      ).length,
    })).filter((g) => g.products.length > 0)
  }, [products, items])

  const lowStockProducts = products.filter((p) => p.isLowStock && getQty(p.id) > 0)
  const total = items.reduce((sum, item) => {
    const product = products.find((p) => p.id === item.productId)
    return sum + (product ? Number(product.unitPrice) * item.qty : 0)
  }, 0)

  function handleDownloadExcel() {
    const rows = products.map((p) => ({
      SKU: p.sku,
      'Product Name': p.name,
      Category: p.category ?? 'Uncategorized',
      'Unit Price (USD)': Number(p.unitPrice).toFixed(2),
      'Requested Qty': getQty(p.id) || '',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [{ wch: 16 }, { wch: 36 }, { wch: 20 }, { wch: 16 }, { wch: 14 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Order')
    XLSX.writeFile(wb, 'order-list.xlsx')
  }

  function handleUploadExcel(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadError('')

    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = ev.target?.result
        const wb = XLSX.read(data, { type: 'binary' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(ws) as Record<string, unknown>[]

        let matched = 0
        for (const row of rows) {
          const sku = String(row['SKU'] ?? '').trim()
          const qty = Number(row['Requested Qty'] ?? 0)
          if (!sku || qty <= 0) continue
          const product = products.find((p) => p.sku === sku)
          if (product) { setQty(product.id, qty); matched++ }
        }

        if (matched === 0) setUploadError('No matching SKUs found. Make sure the SKU column matches exactly.')
        // Open all categories that have newly selected items
        setOpenCategories(new Set(CATEGORIES.map((c) => c.key ?? 'uncategorized')))
      } catch {
        setUploadError('Failed to read file. Please use the downloaded template.')
      }
    }
    reader.readAsBinaryString(file)
    // reset so same file can be re-uploaded
    e.target.value = ''
  }

  async function handleSaveCart() {
    if (items.length === 0) { setError('최소 1개 이상의 제품을 선택해주세요.'); return }
    setLoading(true)
    setError('')

    const body = {
      requestedDelivery: deliveryDate || null,
      shippingMode,
      packageType: packageType || null,
      freightForwarder: freightForwarder || null,
      notes,
      items: items.map((i) => ({ productId: i.productId, requestedQty: i.qty })),
    }

    let orderId = draftId

    if (draftId) {
      // Update existing draft
      const res = await fetch(`/api/orders/${draftId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) { setError('저장에 실패했습니다.'); setLoading(false); return }
    } else {
      // Create new draft
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) { setError('주문 생성에 실패했습니다.'); setLoading(false); return }
      const data = await res.json()
      orderId = data.id
    }

    router.push(`/orders/${orderId}`)
  }

  if (initializing) {
    return <div className="p-8 text-gray-400 text-center">Loading draft...</div>
  }

  return (
    <div>
      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-lg font-semibold">
            {draftId ? '주문 수정' : '새 주문'}
          </h1>
          {items.length > 0 && (
            <div className="text-sm text-gray-500">
              <span className="font-semibold text-gray-900">{items.length}종</span> 선택 중
            </div>
          )}
        </div>

        {/* Excel toolbar */}
        <div className="flex items-center gap-3 mb-4 p-3 bg-gray-50 border rounded-xl">
          <span className="text-xs text-gray-500 font-medium">Bulk Order:</span>
          <button
            onClick={handleDownloadExcel}
            disabled={products.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
          >
            ↓ Download Product List
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={products.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
          >
            ↑ Upload Filled List
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleUploadExcel}
            className="hidden"
          />
          {uploadError && <span className="text-xs text-red-600">{uploadError}</span>}
        </div>

        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-600 text-sm">{error}</div>}

        {/* Order Info */}
        <div className="bg-white rounded-xl border p-6 mb-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Requested Delivery Date</label>
              <input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Shipping Mode</label>
              <div className="flex gap-4 mt-2">
                {(['AIR', 'OCEAN', 'HANDCARRY'] as const).map((m) => (
                  <label key={m} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="shippingMode"
                      value={m}
                      checked={shippingMode === m}
                      onChange={() => setShippingMode(m)}
                      className="text-blue-600"
                    />
                    <span className="text-sm">{m}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Package Type</label>
              <select
                value={packageType}
                onChange={(e) => setPackageType(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— Select —</option>
                {PACKAGE_TYPES.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Freight Forwarder</label>
              <select
                value={freightForwarder}
                onChange={(e) => setFreightForwarder(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— Select —</option>
                {FREIGHT_FORWARDER_OPTIONS.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Low Stock Alert */}
        {lowStockProducts.length > 0 && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-yellow-800 text-sm">
            ⚠️ Some selected items have low stock — please review quantities before ordering.
          </div>
        )}

        {/* Products — Category Accordion */}
        {grouped.map(({ key, label, products: catProducts, selectedCount }) => {
          const catKey = key ?? 'uncategorized'
          const isOpen = openCategories.has(catKey)
          return (
            <div key={catKey} className="bg-white rounded-xl border mb-3 overflow-hidden">
              <button
                onClick={() => toggleCategory(catKey)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{label}</span>
                  {selectedCount > 0 && (
                    <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">
                      {selectedCount} selected
                    </span>
                  )}
                </div>
                <span className="text-gray-400 text-sm">{isOpen ? '▲' : '▼'}</span>
              </button>
              {isOpen && (
                <table className="w-full text-sm border-t">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium text-gray-600">SKU</th>
                      <th className="px-4 py-2 text-left font-medium text-gray-600">Product</th>
                      <th className="px-4 py-2 text-right font-medium text-gray-600">Price</th>
                      <th className="px-4 py-2 text-left font-medium text-gray-600">Stock Updated</th>
                      <th className="px-4 py-2 text-center font-medium text-gray-600">Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {catProducts.map((p) => (
                      <tr key={p.id} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="px-4 py-2 text-gray-500">{p.sku}</td>
                        <td className="px-4 py-2 font-medium">{p.name}</td>
                        <td className="px-4 py-2 text-right">${Number(p.unitPrice).toFixed(2)}</td>
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-1.5">
                            {p.isOutOfStock ? (
                              <span className="relative group/alert cursor-help text-red-500">
                                🚫
                                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1.5 text-xs bg-gray-800 text-white rounded-lg whitespace-nowrap opacity-0 group-hover/alert:opacity-100 pointer-events-none z-20 shadow-lg transition-opacity">
                                  Out of stock — ordering is not available
                                </span>
                              </span>
                            ) : p.isLowStock ? (
                              <span className="relative group/alert cursor-help text-orange-500">
                                ⚠️
                                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1.5 text-xs bg-gray-800 text-white rounded-lg whitespace-nowrap opacity-0 group-hover/alert:opacity-100 pointer-events-none z-20 shadow-lg transition-opacity">
                                  Low stock (10 or fewer) — please verify quantity before ordering
                                </span>
                              </span>
                            ) : null}
                            {p.stockUpdatedAt ? (
                              <span className="text-xs text-gray-400">
                                {new Date(p.stockUpdatedAt).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-300">—</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2 text-center">
                          {p.isOutOfStock ? (
                            <span className="text-xs text-red-400 font-medium">Unavailable</span>
                          ) : (
                            <div className="flex flex-col items-center gap-0.5">
                              <input
                                type="number"
                                min={0}
                                max={p.stockQuantity}
                                value={getQty(p.id) || ''}
                                onChange={(e) => {
                                  const val = Math.min(Math.max(0, Number(e.target.value)), p.stockQuantity)
                                  setQty(p.id, val)
                                }}
                                className={`w-20 border rounded px-2 py-1 text-center text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${getQty(p.id) > 0 && getQty(p.id) >= p.stockQuantity ? 'border-orange-400' : ''}`}
                                placeholder="0"
                              />
                              {getQty(p.id) > 0 && getQty(p.id) >= p.stockQuantity && (
                                <span className="text-xs text-orange-500 whitespace-nowrap">Max {p.stockQuantity}</span>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )
        })}

        {/* Notes */}
        <div className="bg-white rounded-xl border p-4 mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="추가 요청사항..."
          />
        </div>

        {/* Cart Summary & Action */}
        <div className="bg-white rounded-xl border p-4 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {items.length > 0 ? (
              <>선택 <span className="font-semibold text-gray-900">{items.length}종</span> · 합계 <span className="font-semibold text-gray-900">${total.toFixed(2)} USD</span></>
            ) : (
              <span className="text-gray-400">상품을 선택해주세요</span>
            )}
          </div>
          <button
            onClick={handleSaveCart}
            disabled={loading || items.length === 0}
            className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '저장 중...' : draftId ? '수정 저장하기' : '장바구니에 저장'}
          </button>
        </div>
      </main>
    </div>
  )
}
