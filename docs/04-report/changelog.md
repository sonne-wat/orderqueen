# Changelog

All notable changes to the Orderqueen project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

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
