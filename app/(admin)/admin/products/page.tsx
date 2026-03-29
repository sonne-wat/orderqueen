'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import * as XLSX from 'xlsx'

interface Product {
  id: string
  sku: string
  name: string
  category: string | null
  unitPrice: number
  currency: string
  stockQuantity: number
  stockUpdatedAt: string | null
  unit: string
  isActive: boolean
  isLowStock: boolean
}

const CATEGORY_LABELS: Record<string, string> = {
  BOWLING_BALL: 'Bowling Ball',
  BOWLING_BAG: 'Bowling Bag',
  BOWLING_SHOES: 'Bowling Shoes',
  APPAREL: 'Apparel',
  BOWLING_ACCESSORY: 'Bowling Accessory',
}

function StockCell({
  product,
  isEditing,
  editValue,
  isSaving,
  onStartEdit,
  onChangeValue,
  onSave,
  onCancel,
}: {
  product: Product
  isEditing: boolean
  editValue: string
  isSaving: boolean
  onStartEdit: () => void
  onChangeValue: (v: string) => void
  onSave: () => void
  onCancel: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing) inputRef.current?.focus()
  }, [isEditing])

  if (isEditing) {
    return (
      <div className="inline-flex items-center gap-1 justify-center">
        <input
          ref={inputRef}
          type="number"
          min={0}
          value={editValue}
          onChange={(e) => onChangeValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSave()
            if (e.key === 'Escape') onCancel()
          }}
          onBlur={onSave}
          className="w-16 border border-blue-400 rounded px-1.5 py-0.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={isSaving}
        />
        <span className="text-xs text-gray-400">{product.unit}</span>
      </div>
    )
  }

  return (
    <div className="inline-flex items-center gap-1 justify-center group/stock">
      <button
        onClick={onStartEdit}
        className={`hover:underline hover:text-blue-600 cursor-pointer ${product.stockQuantity <= 10 ? 'text-orange-500 font-medium' : ''}`}
        title="Click to edit"
      >
        {product.stockQuantity} {product.unit}
      </button>
      {product.stockUpdatedAt && (
        <span className="relative">
          <span className="text-gray-400 text-xs cursor-help select-none">?</span>
          <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 text-xs bg-gray-800 text-white rounded whitespace-nowrap opacity-0 group-hover/stock:opacity-100 pointer-events-none z-10 transition-opacity">
            Updated: {new Date(product.stockUpdatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
          </span>
        </span>
      )}
    </div>
  )
}

function PriceCell({
  product,
  isEditing,
  editValue,
  isSaving,
  onStartEdit,
  onChangeValue,
  onRequestSave,
  onCancel,
}: {
  product: Product
  isEditing: boolean
  editValue: string
  isSaving: boolean
  onStartEdit: () => void
  onChangeValue: (v: string) => void
  onRequestSave: () => void
  onCancel: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing) inputRef.current?.focus()
  }, [isEditing])

  if (isEditing) {
    return (
      <div className="inline-flex items-center gap-1 justify-end">
        <span className="text-gray-400 text-sm">$</span>
        <input
          ref={inputRef}
          type="number"
          min={0}
          step="0.01"
          value={editValue}
          onChange={(e) => onChangeValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onRequestSave()
            if (e.key === 'Escape') onCancel()
          }}
          onBlur={onRequestSave}
          className="w-20 border border-amber-400 rounded px-1.5 py-0.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-amber-500"
          disabled={isSaving}
        />
      </div>
    )
  }

  return (
    <button
      onClick={onStartEdit}
      className="hover:underline hover:text-amber-600 cursor-pointer"
      title="Click to edit price"
    >
      ${Number(product.unitPrice).toFixed(2)}
    </button>
  )
}

interface ConfirmDialog {
  productId: string
  productName: string
  oldPrice: number
  newPrice: number
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [categoryFilter, setCategoryFilter] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  // Stock edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)

  // Price edit state
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null)
  const [editingPriceValue, setEditingPriceValue] = useState('')
  const [savingPriceId, setSavingPriceId] = useState<string | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/products')
      .then((r) => r.json())
      .then((d) => { setProducts(d.products); setLoading(false) })
  }, [])

  // Stock edit handlers
  function startEdit(product: Product) {
    setEditingId(product.id)
    setEditingValue(String(product.stockQuantity))
  }

  async function saveEdit(id: string) {
    const qty = Number(editingValue)
    if (isNaN(qty) || qty < 0) { cancelEdit(); return }
    const current = products.find((p) => p.id === id)
    if (current && qty === current.stockQuantity) { cancelEdit(); return }

    setSavingId(id)
    await fetch(`/api/products/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stockQuantity: qty }),
    })
    const now = new Date().toISOString()
    setProducts((prev) => prev.map((p) =>
      p.id === id ? { ...p, stockQuantity: qty, stockUpdatedAt: now, isLowStock: qty <= p.stockQuantity } : p
    ))
    setSavingId(null)
    setEditingId(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditingValue('')
  }

  // Price edit handlers
  function startPriceEdit(product: Product) {
    cancelEdit() // close stock edit if open
    setEditingPriceId(product.id)
    setEditingPriceValue(Number(product.unitPrice).toFixed(2))
  }

  function requestPriceSave(id: string) {
    const newPrice = parseFloat(editingPriceValue)
    if (isNaN(newPrice) || newPrice < 0) { cancelPriceEdit(); return }
    const current = products.find((p) => p.id === id)
    if (!current || newPrice === Number(current.unitPrice)) { cancelPriceEdit(); return }

    setEditingPriceId(null) // close input
    setConfirmDialog({
      productId: id,
      productName: current.name,
      oldPrice: Number(current.unitPrice),
      newPrice,
    })
  }

  async function confirmPriceSave() {
    if (!confirmDialog) return
    const { productId, newPrice } = confirmDialog
    setSavingPriceId(productId)
    setConfirmDialog(null)
    setSaveError(null)

    const res = await fetch(`/api/products/${productId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unitPrice: newPrice }),
    })
    if (res.ok) {
      setProducts((prev) => prev.map((p) =>
        p.id === productId ? { ...p, unitPrice: newPrice } : p
      ))
    } else {
      setSaveError('Failed to update price. Please try again.')
    }
    setSavingPriceId(null)
    setEditingPriceValue('')
  }

  function cancelPriceEdit() {
    setEditingPriceId(null)
    setEditingPriceValue('')
    setConfirmDialog(null)
  }

  // Excel download
  function downloadExcel() {
    const rows = filtered.map((p) => ({
      SKU: p.sku,
      Name: p.name,
      Category: p.category ? (CATEGORY_LABELS[p.category] ?? p.category) : '',
      Price: Number(p.unitPrice),
      Currency: p.currency,
      Stock: p.stockQuantity,
      Unit: p.unit,
      Status: p.isActive ? 'Active' : 'Inactive',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Products')
    XLSX.writeFile(wb, 'products.xlsx')
  }

  const filtered = products.filter((p) => {
    const matchCat = !categoryFilter || p.category === categoryFilter
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Products</h1>
        <div className="flex gap-2">
          <button
            onClick={downloadExcel}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50"
          >
            Download Excel
          </button>
          <Link
            href="/admin/products/price"
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50"
          >
            Update Price (Excel)
          </Link>
          <Link
            href="/admin/products/stock"
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50"
          >
            Update Stock (Excel)
          </Link>
          <Link
            href="/admin/products/import"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            Import Excel
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <input
          type="text"
          placeholder="Search SKU or name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm w-60 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Categories</option>
          {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <span className="text-sm text-gray-500 self-center">{filtered.length} products</span>
      </div>

      <p className="text-xs text-gray-400 mb-3">Click on a price or stock number to edit it inline.</p>

      {saveError && (
        <div className="mb-3 px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex justify-between items-center">
          {saveError}
          <button onClick={() => setSaveError(null)} className="text-red-400 hover:text-red-600 ml-4">✕</button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading...</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">SKU</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Name</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Category</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Price</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Stock</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className={`border-b last:border-0 hover:bg-gray-50 ${(savingId === p.id || savingPriceId === p.id) ? 'opacity-60' : ''}`}>
                  <td className="px-4 py-2 text-gray-500 font-mono text-xs">{p.sku}</td>
                  <td className="px-4 py-2 font-medium">{p.name}</td>
                  <td className="px-4 py-2 text-gray-600">
                    {p.category ? CATEGORY_LABELS[p.category] ?? p.category : '—'}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <PriceCell
                      product={p}
                      isEditing={editingPriceId === p.id}
                      editValue={editingPriceValue}
                      isSaving={savingPriceId === p.id}
                      onStartEdit={() => startPriceEdit(p)}
                      onChangeValue={setEditingPriceValue}
                      onRequestSave={() => requestPriceSave(p.id)}
                      onCancel={cancelPriceEdit}
                    />
                  </td>
                  <td className="px-4 py-2 text-center">
                    <StockCell
                      product={p}
                      isEditing={editingId === p.id}
                      editValue={editingValue}
                      isSaving={savingId === p.id}
                      onStartEdit={() => startEdit(p)}
                      onChangeValue={setEditingValue}
                      onSave={() => saveEdit(p.id)}
                      onCancel={cancelEdit}
                    />
                  </td>
                  <td className="px-4 py-2 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {p.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">No products found</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Price Change Confirmation Dialog */}
      {confirmDialog && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-80 mx-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">가격을 변경하시겠습니까?</h2>
            <p className="text-sm text-gray-600 mb-1">{confirmDialog.productName}</p>
            <p className="text-sm mb-5">
              <span className="line-through text-gray-400">${confirmDialog.oldPrice.toFixed(2)}</span>
              <span className="mx-2 text-gray-400">→</span>
              <span className="font-semibold text-gray-900">${confirmDialog.newPrice.toFixed(2)}</span>
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={cancelPriceEdit}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={confirmPriceSave}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
              >
                변경
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
