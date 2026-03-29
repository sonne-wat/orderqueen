# Design: distributor-date-filter

## Component: DateRangeFilter
**Path**: `components/ui/DateRangeFilter.tsx`
**Type**: Client Component (`'use client'`)

### Props
```ts
interface DateRangeFilterProps {
  dateFrom: string   // 'YYYY-MM-DD' or ''
  dateTo: string     // 'YYYY-MM-DD' or ''
  onChange: (from: string, to: string) => void
}
```

### Presets
| Label | dateFrom | dateTo |
|-------|----------|--------|
| Last 30 days | today-30d | today |
| Last 3 months | today-90d | today |
| All time | '' | '' |

### UI
```
[Last 30 days] [Last 3 months] [All time]   From: [date input]  To: [date input]
```

---

## Dashboard Changes (`app/(distributor)/dashboard/page.tsx`)

### Server Component + searchParams
```ts
// Page signature
export default async function DistributorDashboard({
  searchParams,
}: {
  searchParams: Promise<{ dateFrom?: string; dateTo?: string }>
})
```

### Prisma filter
```ts
const { dateFrom, dateTo } = await searchParams
// default: last 3 months
const defaultFrom = new Date(); defaultFrom.setMonth(defaultFrom.getMonth() - 3)
const from = dateFrom ? new Date(dateFrom) : defaultFrom
const to = dateTo ? new Date(dateTo + 'T23:59:59Z') : new Date()

prisma.order.findMany({
  where: {
    distributorId,
    createdAt: { gte: from, lte: to },
  },
  ...
})
```

### DateRangeFilter wrapper (Client Component)
Because dashboard is a Server Component, the filter bar must be a separate Client Component that uses `useRouter` + `useSearchParams` to push URL changes.

**Path**: `components/ui/DashboardDateFilter.tsx`
- Wraps `DateRangeFilter`
- On change: `router.push('/dashboard?dateFrom=X&dateTo=Y')`

---

## Shipment Requests Changes (`app/(distributor)/orders/shipment-requests/page.tsx`)

### State
```ts
const [dateFrom, setDateFrom] = useState(() => {
  const d = new Date(); d.setMonth(d.getMonth() - 3)
  return d.toISOString().slice(0, 10)  // default last 3 months
})
const [dateTo, setDateTo] = useState('')
```

### Fetch
```ts
const params = new URLSearchParams()
if (dateFrom) params.set('dateFrom', dateFrom)
if (dateTo) params.set('dateTo', dateTo)
fetch(`/api/shipment-requests?${params}`)
```

### Re-fetch on filter change
```ts
useEffect(() => {
  // fetch with current dateFrom/dateTo
}, [dateFrom, dateTo])
```

---

## API: GET /api/shipment-requests

### New query params
- `dateFrom` (optional): ISO date string — filter `requestedAt >= dateFrom`
- `dateTo` (optional): ISO date string — filter `requestedAt <= dateTo + end of day`

### SQL changes
Add to both ADMIN and DISTRIBUTOR queries:
```sql
AND sr."requestedAt" >= ${from}   -- if dateFrom provided
AND sr."requestedAt" <= ${to}     -- if dateTo provided
```

Since the queries use tagged template literals, build them conditionally using raw SQL with injected params.

**Approach**: Use separate query branches based on which params are present, or append a date filter to the WHERE clause via parameterized conditions.

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `components/ui/DateRangeFilter.tsx` | Create — shared date range UI |
| `components/ui/DashboardDateFilter.tsx` | Create — router-connected wrapper for dashboard |
| `app/(distributor)/dashboard/page.tsx` | Modify — add searchParams, Prisma date filter, render DashboardDateFilter |
| `app/(distributor)/orders/shipment-requests/page.tsx` | Modify — add date state, filter bar, update fetch |
| `app/api/shipment-requests/route.ts` | Modify — accept dateFrom/dateTo, apply to SQL |
