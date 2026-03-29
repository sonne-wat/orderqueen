# Changelog

All notable changes to the Orderqueen project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [2026-03-29] - Distributor Date Filter Feature Complete

### Added
- **Date Range Filter UI Component**: Reusable `DateRangeFilter` component with quick-select presets
  - Last 30 days, Last 3 months, All time presets
  - Custom from/to date inputs (`input[type=date]`)
  - Clean button-based UI with active state highlighting
  - Standalone component for reuse across pages

- **Dashboard Date Filtering**: Server-side filtering for distributor dashboard
  - URL-driven filtering via Next.js searchParams: `?dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD`
  - `DashboardDateFilter` router-aware wrapper component
  - Prisma `createdAt` range filter on order queries
  - Default: last 3 months (performance-optimized default)
  - Support for "all time" mode via `?all=1` param

- **Shipment Requests Date Filtering**: Client-side filtering for shipment requests page
  - Date state management with 90-day default
  - Automatic API refetch on date change via useEffect
  - URL query parameter pass-through: `dateFrom` and `dateTo` to API

- **API Enhancements**:
  - GET /api/shipment-requests: New optional query params `dateFrom` and `dateTo`
  - Conditional SQL filtering on `requestedAt` for both ADMIN and DISTRIBUTOR roles
  - Date range validation with UTC boundary times (start: 00:00:00Z, end: 23:59:59Z)

### Changed
- Distributor dashboard: Now includes date filter bar above order lists
- Shipment requests page: Now includes date filter bar above request list

### Technical Details
- **Files Created**: 2 (DateRangeFilter.tsx, DashboardDateFilter.tsx)
- **Files Modified**: 3 (dashboard/page.tsx, shipment-requests/page.tsx, api/shipment-requests/route.ts)
- **Match Rate**: 95% (36/38 design requirements met)
- **Code Lines Added**: ~150
- **Iterations Required**: 0 (no refinement cycle needed)
- **Status**: PDCA Completed, ready for deployment

**Report**: [distributor-date-filter.report.md](features/distributor-date-filter.report.md)

---

## [2026-03-28] - Order Constraints Feature Complete

### Added
- **Stock Quantity Limiting**: Prevents distributors from ordering quantities exceeding available inventory
  - Client-side input max constraint on order creation form
  - Server-side validation on order submission with itemized error responses
  - "Max {n}" orange warning when quantity reaches stock limit
  - "Unavailable" status for out-of-stock items

- **Admin Order Cancellation with Reason**: Enables cancellation of unshipped orders with documented reason
  - Admin cancel button on order detail page (visible for SUBMITTED, CONFIRMED, READY_TO_SHIP, PAYMENT_PENDING, PAYMENT_CONFIRMED)
  - Modal requiring non-empty cancellation reason
  - CANCELLED status enum value
  - Order.cancelReason field for storing reason
  - Red styling for CANCELLED badge

- **Distributor Cancellation Visibility**:
  - Red alert box on order detail showing cancellation reason
  - Dashboard "Cancelled" section for cancelled orders with inline reason display
  - Exclusion of cancelled orders from "Active Orders" count

- **API Enhancements**:
  - GET /api/products: Distributor role now receives stockQuantity (for max validation)
  - DELETE /api/orders/[id]: Admin cancellation with reason requirement
  - POST /api/orders/[id]/submit: Server-side stock validation with detailed error list

### Changed
- Product API response: Removes lowStockThreshold from distributor role (only stockQuantity included)
- Order deletion: DRAFT orders still support physical deletion; non-DRAFT orders use soft CANCELLED status
- Dashboard order filtering: Cancelled orders now excluded from active count, grouped in separate section

### Fixed
- Prisma type generation: Schema changes now properly regenerated to TypeScript types
- Race condition handling: Server-side validation prevents overstock even if inventory changes between form load and submit

### Technical Details
- **Files Modified**: 9
- **Schema Changes**: OrderStatus enum (CANCELLED), Order.cancelReason field
- **Match Rate**: 96% (24/25 design requirements)
- **Status**: PDCA Completed, ready for deployment

**Report**: [order-constraints.report.md](features/order-constraints.report.md)
