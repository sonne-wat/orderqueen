# Plan: distributor-date-filter

## Overview
Add date range filter to distributor-facing pages so users can narrow down long order/request histories by date.

## Problem Statement
Distributors accumulate many orders and shipment requests over time. Without a date filter, the dashboard and shipment-requests list load and display everything, making it hard to find recent or specific records.

## Target Pages
1. **Dashboard** (`/dashboard`) — shows Active, Draft, Completed, Cancelled orders
2. **Shipment Requests** (`/orders/shipment-requests`) — shows request history and active batches

## Proposed Solution

### Dashboard (`/dashboard`)
- Currently a **Server Component** — reads all orders via `prisma.order.findMany()`.
- Add `searchParams` (start date / end date) to filter `createdAt` in the Prisma query.
- Render a **Client-side date filter bar** at the top that changes the URL params and triggers a page re-render.
- Default view: show last 3 months (keeps the page fast while still showing recent activity).

### Shipment Requests (`/orders/shipment-requests`)
- Currently a **Client Component** — fetches `/api/shipment-requests` on mount.
- Add date range state (`dateFrom`, `dateTo`) and a filter bar UI.
- Pass `dateFrom` / `dateTo` as query params to `/api/shipment-requests?dateFrom=&dateTo=`.
- Update the API route to accept and apply these params to the `requestedAt` WHERE clause.

## Implementation Scope

### Frontend
- [ ] Reusable `DateRangeFilter` component (Client Component) with From/To date inputs + quick-select presets (Last 30 days, Last 3 months, All time)
- [ ] Dashboard: use `searchParams` + `<DateRangeFilter>` that updates URL
- [ ] Shipment Requests: add `dateFrom`/`dateTo` state + `<DateRangeFilter>` that triggers refetch

### Backend
- [ ] `GET /api/shipment-requests` — accept optional `dateFrom` / `dateTo` query params, filter `requestedAt`
- [ ] Dashboard already fetches server-side — no API change needed, use Prisma `where.createdAt` filter

## Out of Scope
- Admin pages (admin already has its own filtering)
- Orders list page (distributor has no standalone orders list — orders are shown on dashboard)
- Analytics page (already has its own date handling)

## Acceptance Criteria
1. Dashboard shows only orders created within the selected date range.
2. Shipment Requests list shows only requests made within the selected date range.
3. Quick presets: Last 30 days, Last 3 months, All time.
4. Default is last 3 months (not all-time) to keep pages snappy.
5. Clearing the filter restores the full list.
6. Date filter state is reflected in URL (dashboard) or component state (shipment requests).

## Technical Notes
- Use `input[type=date]` for the date pickers (no extra dependency).
- Dashboard date filter → URL search params (`?dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD`).
- Shipment Requests date filter → component state + API query string.
- All date comparisons in UTC; display in `ko-KR` locale.
