'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'

interface ParsedProduct {
  sku: string
  name: string
  category: string | null
  unitPrice: number
  stockQuantity: number
  unit: string
}

const CATEGORY_MAP: Record<string, string> = {
  'bowling ball':      'BOWLING_BALL',
  'bowling bag':       'BOWLING_BAG',
  'bowling shoes':     'BOWLING_SHOES',
  'apparel':           'APPAREL',
  'bowling accessory': 'BOWLING_ACCESSORY',
}

function parseCategory(raw: string): string | null {
  return CATEGORY_MAP[raw?.toLowerCase().trim()] ?? null
}

export default function ProductImportPage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<ParsedProduct[]>([])
  const [fileName, setFileName] = useState('')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ created: number; updated: number; errors: { sku: string; error: string }[] } | null>(null)

  function handleFile(file: File) {
    setFileName(file.name)
    setResult(null)
    const reader = new FileReader()
    reader.onload = (e) => {
      const wb = XLSX.read(e.target?.result, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws)
      const parsed: ParsedProduct[] = rows.map((row) => ({
        sku: String(row['SKU'] ?? row['sku'] ?? '').trim(),
        name: String(row['Name'] ?? row['name'] ?? '').trim(),
        category: parseCategory(String(row['Category'] ?? row['category'] ?? '')),
        unitPrice: Number(row['Unit Price'] ?? row['unitPrice'] ?? row['price'] ?? 0),
        stockQuantity: Number(row['Stock'] ?? row['stockQuantity'] ?? row['stock_quantity'] ?? 0),
        unit: String(row['Unit'] ?? row['unit'] ?? 'EA').trim() || 'EA',
      })).filter((p) => p.sku && p.name)
      setPreview(parsed)
    }
    reader.readAsArrayBuffer(file)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  async function handleImport() {
    if (preview.length === 0) return
    setImporting(true)
    const res = await fetch('/api/products/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ products: preview }),
    })
    const data = await res.json()
    setResult(data)
    setImporting(false)
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-700 text-sm">← Back</button>
        <h1 className="text-2xl font-bold text-gray-900">Import Products</h1>
      </div>

      {/* Drop Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => fileRef.current?.click()}
        className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors mb-6"
      >
        <p className="text-gray-500 text-sm mb-1">Drop Excel file here or click to upload</p>
        <p className="text-gray-400 text-xs">(.xlsx, .xls)</p>
        {fileName && <p className="mt-2 text-blue-600 text-sm font-medium">{fileName}</p>}
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }}
        />
      </div>

      <p className="text-xs text-gray-400 mb-6">
        Expected columns: <span className="font-mono">SKU, Name, Category, Unit Price, Stock, Unit</span>
        <br />
        Category values: Bowling Ball, Bowling Bag, Bowling Shoes, Apparel, Bowling Accessory
      </p>

      {/* Preview */}
      {preview.length > 0 && (
        <div className="bg-white rounded-xl border overflow-hidden mb-4">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <span className="text-sm font-medium">Preview — {preview.length} rows</span>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-600">SKU</th>
                <th className="px-4 py-2 text-left font-medium text-gray-600">Name</th>
                <th className="px-4 py-2 text-left font-medium text-gray-600">Category</th>
                <th className="px-4 py-2 text-right font-medium text-gray-600">Price</th>
                <th className="px-4 py-2 text-center font-medium text-gray-600">Stock</th>
              </tr>
            </thead>
            <tbody>
              {preview.slice(0, 5).map((p, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="px-4 py-2 font-mono text-xs text-gray-500">{p.sku}</td>
                  <td className="px-4 py-2">{p.name}</td>
                  <td className="px-4 py-2 text-gray-500">{p.category ?? '—'}</td>
                  <td className="px-4 py-2 text-right">${p.unitPrice.toFixed(2)}</td>
                  <td className="px-4 py-2 text-center">{p.stockQuantity}</td>
                </tr>
              ))}
              {preview.length > 5 && (
                <tr>
                  <td colSpan={5} className="px-4 py-2 text-center text-gray-400 text-xs">
                    ... and {preview.length - 5} more rows
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Import Button */}
      {preview.length > 0 && !result && (
        <button
          onClick={handleImport}
          disabled={importing}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {importing ? 'Importing...' : `Import ${preview.length} Products`}
        </button>
      )}

      {/* Result */}
      {result && (
        <div className="bg-white rounded-xl border p-4">
          <p className="text-sm font-medium text-gray-900 mb-1">Import Complete</p>
          <p className="text-sm text-gray-600">{result.created} created · {result.updated} updated</p>
          {result.errors.length > 0 && (
            <div className="mt-2 text-xs text-red-600">
              {result.errors.map((e, i) => <p key={i}>{e.sku}: {e.error}</p>)}
            </div>
          )}
          <button
            onClick={() => router.push('/admin/products')}
            className="mt-3 px-4 py-2 bg-gray-100 rounded-lg text-sm hover:bg-gray-200"
          >
            Go to Products
          </button>
        </div>
      )}
    </div>
  )
}
