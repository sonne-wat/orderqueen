# Gap Detector Memory - Orderqueen

## Project Overview
- **Type**: Next.js App Router (no src/ directory)
- **Stack**: Next.js, Prisma (PostgreSQL via PrismaPg adapter), NextAuth v5, bcryptjs, react-pdf, exceljs
- **Architecture Level**: Starter (components, lib, types - no service layer)
- **Language mix**: UI has mixed Korean/English text

## Key Paths
- Schema: `prisma/schema.prisma`
- Auth: `lib/auth.ts`
- API routes: `app/api/`
- Types: `types/index.ts`, `types/next-auth.d.ts`
- No `docs/` directory existed before 2026-03-15 analysis

## Analysis History
- **2026-03-15**: First analysis. Design doc missing. Score: 33/100.
  - 19 API endpoints, 11 pages, 5 components, 6 DB models implemented
  - Major gaps: no design doc, no tests, no input validation, no service layer
  - Payment workflow (PAYMENT_PENDING, PAYMENT_CONFIRMED) defined in enum but unimplemented
  - Output: `docs/03-analysis/order-management.analysis.md`
- **2026-03-15**: distributor-analytics analysis (v1, no design doc). Score: 28/100.
- **2026-03-15**: distributor-analytics re-analysis (v2, WITH design doc from parent dir).
  - Design doc: `/Users/sonnekim/Documents/Project/Orderqueen/docs/02-design/features/distributor-analytics.design.md`
  - Design Match: 94% (121/132 items). Weighted Overall: 81%.
  - 6/6 API endpoints match, 14/14 schema fields match, 9/9 nav links match
  - 5 missing UI features: date filter, export, invite, pending column, date range params
  - 7 added features beyond design (GET profile, extra columns, extra stats fields)
  - 5 minor changes (richer response payloads, layout differences)
  - Persistent issues: orderTotal() x5 duplication, no input validation, no tests, non-null assertions
  - Output: `docs/03-analysis/distributor-analytics.analysis.md` (v2.0)
- **2026-03-20**: cargo-details analysis. Score: 94/100.
  - Design doc: `/Users/sonnekim/Documents/Project/Orderqueen/docs/02-design/features/cargo-details.design.md`
  - 36 items checked: 34 match, 2 minor changes, 0 missing, 0 added
  - Schema 8/8, API 10/10, UI 13/15, PDF 5/5
  - 2 minor gaps: Incoterms select missing descriptions, cargo read-only section hidden when null
  - Output: `docs/03-analysis/cargo-details.analysis.md`
- **2026-03-20**: product-categories analysis. Score: 94/100.
  - Design doc: `/Users/sonnekim/Documents/Project/Orderqueen/docs/02-design/features/product-categories.design.md`
  - 48 items checked: 44 match, 2 minor changes, 2 added, 0 missing
  - Schema 8/8, API 10/10, UI 15/17, Types 4/4, Seed 4/4 (+1 added)
  - 2 additions: Status column in admin products, bowling shoes seed (144 products)
  - 2 changes: preview rows 3->5, import API conditional field updates
  - Key issue: CATEGORY_LABELS/CATEGORY_ORDER duplicated in 3 files instead of importing from types/
  - Output: `docs/03-analysis/product-categories.analysis.md`

## Known Issues
- `as never` type casts in API routes for enum values
- No .env.example file
- No pagination on list endpoints
- Shipment creation skips order status validation
- `orderTotal()` duplicated in 5 files (should be in lib/utils/order.ts)
- CATEGORY_LABELS/CATEGORY_MAP duplicated in 3 files instead of importing from types/index.ts
- Non-null assertions (`!`) on session.user.id in analytics/me and settings/profile
- All API responses use non-standard format (not Phase 4 compliant)
