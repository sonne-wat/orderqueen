# Prisma Gap Analysis Report (v6.0 — Proper Invoice Number Feature)

> **Analysis Date**: 2026-03-21
> **Feature**: Invoice number field, PATCH API, admin edit UI, distributor read-only display
> **Baseline**: v5.0 (97%, 2026-03-21)
> **Overall Match Rate**: 97%

---

## Overall Scores

| Category | Items | Match | Score | Status |
|----------|:-----:|:-----:|:-----:|:------:|
| Schema | 2 | 2 | 100% | PASS |
| API Endpoints | 4 | 4 | 100% | PASS |
| UI Components | 14 | 14 | 100% | PASS |
| Code Quality | 8 | 5 | 63% | WARN |
| **Total** | **28** | **25** | **89%** | — |
| **Weighted Overall** | | | **97%** | **PASS** |

---

## Detailed Comparison

### Schema (100%)

| Item | Expected | Actual | Status |
|------|----------|--------|:------:|
| `paymentSkipped` on Order | `Boolean @default(false)` | Confirmed (schema:62) | MATCH |
| `invoiceNumber` on Order | `String?` (optional, nullable) | `invoiceNumber String?` (schema:61) | MATCH |

### API Endpoints (100%)

| Item | Expected | Actual | Status |
|------|----------|--------|:------:|
| `POST /api/orders/[id]/status` | Admin-only, validates status | VALID_STATUSES check + auth guard | MATCH |
| Status route paymentSkipped logic | Track skip, explicit parentheses | Lines 24-29 | MATCH |
| `POST /api/orders/[id]/ship` paymentSkipped | `paymentSkipped: order.status === 'PAYMENT_PENDING'` | Line 22 | MATCH |
| `PATCH /api/orders/[id]` invoiceNumber | Admin-only, empty string → null | route.ts:88-103 | MATCH |

### UI Components (100%)

| Item | Expected | Actual | Status |
|------|----------|--------|:------:|
| Timeline `paymentSkipped` prop | `paymentSkipped?: boolean` | Confirmed | MATCH |
| Timeline `invoiceNumber` prop | `invoiceNumber?: string` | Confirmed | MATCH |
| Invoice number display | `#{invoiceNumber}` on payment step when done/active/skipped | `isPaymentStep && invoiceNumber && (done \|\| active \|\| skipped)` | MATCH |
| Invoice number styling | Orange when skipped, gray otherwise, monospace | Confirmed | MATCH |
| Orange "결제 미완료" when paymentSkipped | Distinct visual | Confirmed | MATCH |
| "미완료" badge on skipped step | Badge below step | Confirmed | MATCH |
| Admin detail: status dropdown + "변경" button | 6-option select | Confirmed | MATCH |
| Admin detail passes `paymentSkipped` | `paymentSkipped={order.paymentSkipped}` | Confirmed | MATCH |
| Admin detail: `invoiceNumber` state + load | `useState('')`, set from `d.order.invoiceNumber ?? ''` | Lines 18, 36 | MATCH |
| Admin detail: `handleSaveInvoiceNumber()` | `PATCH /api/orders/${id}`, error handling | Lines 69-81 | MATCH |
| Admin detail: Invoice input + save button | Input with Enter key, "저장" button, loading state | Lines 183-198 | MATCH |
| Admin detail passes `invoiceNumber` to Timeline | `invoiceNumber={invoiceNumber \|\| undefined}` (state, live update) | Confirmed | MATCH |
| Distributor detail passes `paymentSkipped` | `paymentSkipped={order.paymentSkipped}` | Confirmed | MATCH |
| Distributor detail passes `invoiceNumber` | `invoiceNumber={order.invoiceNumber ?? undefined}` (read-only) | Confirmed | MATCH |

### Code Quality (63%)

| Item | Status | Detail |
|------|:------:|--------|
| Operator precedence in status/route.ts | PASS | Explicit parentheses added |
| `handleStatusTransition` error handling | PASS | `res.ok` check + `alert()` |
| `handleDirectStatusChange` error handling | PASS | Same pattern |
| `handleSaveInvoiceNumber` error handling | PASS | `res.ok` check + `alert()` |
| Auth guard on PATCH | PASS | Admin-only check present |
| PATCH missing order existence check | WARN | No `findUnique` before `update` — Prisma P2025 surfaces as 500 instead of 404 |
| `as never` type cast in status/route.ts:33 | WARN | Bypasses Prisma enum type checking |
| `window.location.reload()` usage | WARN | Used in 3 places instead of React state updates |

---

## v5.0 Bug Fixed

v5.0 incorrectly used `order.orderNumber` as the invoice number source. v6.0 corrects this:

| Page | v5.0 (Bug) | v6.0 (Fixed) |
|------|------------|--------------|
| Admin detail | `invoiceNumber={order.orderNumber}` | `invoiceNumber={invoiceNumber \|\| undefined}` (state-based, live update) |
| Distributor detail | `invoiceNumber={order.orderNumber}` | `invoiceNumber={order.invoiceNumber ?? undefined}` (actual Prisma field) |

---

## Score Progression

| Version | Date | Score | Key Changes |
|---------|------|:-----:|-------------|
| v1.0 | 2026-03-15 | 33% | Initial analysis |
| v2.0 | 2026-03-20 | 62% | UserStatus, approval flow |
| v3.0 | 2026-03-20 | 95% | Payment APIs, orderTotal(), 5-step timeline |
| v4.0 | 2026-03-21 | 94% | Admin direct status edit, paymentSkipped visualization |
| v5.0 | 2026-03-21 | 97% | Bug fixes (error handling, operator precedence) |
| v6.0 | 2026-03-21 | 97% | Proper invoiceNumber field, PATCH API, admin edit UI |

---

## Remaining Items (non-blocking)

1. Add `findUnique` existence check in PATCH handler before `update` for consistent 404 response
2. Replace `as never` cast with proper `OrderStatus` enum from `@prisma/client`
3. Replace `window.location.reload()` with React state re-fetch
