# Gap Analysis: order-constraints

**Date**: 2026-03-28
**Feature**: 주문 수량 재고 제한 + Admin 주문 취소(메시지 전달)
**Match Rate**: 96% (24/25)
**Phase**: Check — PASS

---

## Overall Scores

| Category | Score | Status |
|----------|:-----:|:------:|
| Schema (Prisma) | 100% (2/2) | PASS |
| API - Products | 100% (1/1) | PASS |
| API - DELETE Cancel | 100% (4/4) | PASS |
| API - Submit Validation | 100% (2/2) | PASS |
| UI - OrderStatusBadge | 100% (1/1) | PASS |
| UI - New Order (stock limit) | 100% (4/4) | PASS |
| UI - Admin Cancel | 100% (4/4) | PASS |
| UI - Distributor Order Detail | 100% (2/2) | PASS |
| UI - Distributor Dashboard | 100% (3/3) | PASS |
| Types | 50% (1/2) | PARTIAL |
| **Overall** | **96% (24/25)** | **PASS** |

---

## Matched Requirements (24/25)

- `Product.stockQuantity` exists in schema
- Distributor API response includes `stockQuantity` (excludes `lowStockThreshold`)
- `max={p.stockQuantity}` on qty input
- `Math.min` clamp in onChange
- "Max {n}" orange warning when at stock limit
- isOutOfStock shows "Unavailable"
- Submit route validates requestedQty vs stockQuantity server-side
- Overstock returns 400 with detail list
- `OrderStatus.CANCELLED` in schema
- `Order.cancelReason String?` in schema
- DELETE: blocks SHIPPED/CANCELLED orders
- DELETE: requires non-empty reason, returns 400 otherwise
- DELETE: sets CANCELLED + saves cancelReason
- DELETE: DISTRIBUTOR DRAFT delete preserved
- "Cancel Order" button shown when not SHIPPED/CANCELLED
- Modal with reason textarea
- DELETE called with `{ reason }`, success updates order state
- `OrderStatusBadge` CANCELLED = `bg-red-100 text-red-700`
- Distributor order detail: red alert box for CANCELLED
- Distributor order detail: cancelReason displayed
- Dashboard activeOrders excludes CANCELLED
- Dashboard has "Cancelled" section
- Dashboard shows cancelReason per cancelled order

## Partial Match (1/25)

- `ProductWithLowStock` type: plan said to add `stockQuantity` explicitly, but it is already inherited from Prisma's `Product` base type — functionally identical, no real gap.

## Gaps (0)

None.

---

## Conclusion

Implementation fully covers both sub-features. The single partial match is a technicality (type inheritance vs. explicit declaration). No action required.
