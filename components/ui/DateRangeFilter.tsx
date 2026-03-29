'use client'

interface DateRangeFilterProps {
  dateFrom: string
  dateTo: string
  onChange: (from: string, to: string) => void
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function daysAgo(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

const PRESETS = [
  { label: 'Last 30 days', from: () => daysAgo(30), to: () => todayStr() },
  { label: 'Last 3 months', from: () => daysAgo(90), to: () => todayStr() },
  { label: 'All time', from: () => '', to: () => '' },
]

export function DateRangeFilter({ dateFrom, dateTo, onChange }: DateRangeFilterProps) {
  const activePreset = PRESETS.find(
    (p) => p.from() === dateFrom && p.to() === dateTo
  )?.label ?? null

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      {PRESETS.map((preset) => (
        <button
          key={preset.label}
          onClick={() => onChange(preset.from(), preset.to())}
          className={`px-3 py-1 rounded-full border text-xs font-medium transition-colors ${
            activePreset === preset.label
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-600'
          }`}
        >
          {preset.label}
        </button>
      ))}
      <div className="flex items-center gap-1 ml-2">
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => onChange(e.target.value, dateTo)}
          className="border rounded px-2 py-1 text-xs text-gray-700"
        />
        <span className="text-gray-400">–</span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => onChange(dateFrom, e.target.value)}
          className="border rounded px-2 py-1 text-xs text-gray-700"
        />
      </div>
    </div>
  )
}
