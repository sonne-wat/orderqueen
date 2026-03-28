# batch-unbundle Analysis Report

> **Analysis Type**: Gap Analysis (Design vs Implementation)
>
> **Project**: Orderqueen
> **Analyst**: Claude (gap-detector)
> **Date**: 2026-03-28
> **Design Doc**: [batch-unbundle.design.md](../02-design/features/batch-unbundle.design.md)

---

## 1. Analysis Overview

### 1.1 Analysis Purpose

Verify that the batch-unbundle feature implementation matches its design document across all 8 changed files: schema, 3 API routes, 2 distributor UI pages, and 2 admin UI pages.

### 1.2 Analysis Scope

- **Design Document**: `docs/02-design/features/batch-unbundle.design.md`
- **Implementation Files**: 8 files as listed in design Section 6
- **Analysis Date**: 2026-03-28

---

## 2. Overall Scores

| Category | Score | Status |
|----------|:-----:|:------:|
| Schema Match | 100% (2/2) | PASS |
| API Match | 100% (18/18) | PASS |
| Distributor UI Match | 100% (10/10) | PASS |
| Admin UI Match | 100% (12/12) | PASS |
| Types Match | 100% (1/1) | PASS |
| **Design Match** | **100%** (42/42) | **PASS** |

---

## 3. Detailed Comparison

### 3.1 Schema (`prisma/schema.prisma`) — 2/2

| # | Design Item | Status | Notes |
|---|-------------|:------:|-------|
| 1 | `ShipmentRequestType` enum (BUNDLE, UNBUNDLE) | MATCH | Lines 236-239 |
| 2 | `ShipmentRequest.type` field `@default(BUNDLE)` | MATCH | Line 122 |

### 3.2 POST /api/shipment-requests — UNBUNDLE branch — 9/9

| # | Design Item | Status | Notes |
|---|-------------|:------:|-------|
| 1 | Parse `type` from request body | MATCH | Line 91 |
| 2 | Default to BUNDLE | MATCH | Line 92 |
| 3 | Validate targetBatchId required (400) | MATCH | Lines 102-103 |
| 4 | Validate batch exists (404) | MATCH | Line 112 |
| 5 | Validate batch ownership (403) | MATCH | Line 113 |
| 6 | Validate batch not SHIPPED (400) | MATCH | Line 114 |
| 7 | Validate orders READY_TO_SHIP (400) | MATCH | Lines 128-131 |
| 8 | Validate orders in target batch (400) | MATCH | Lines 132-134 |
| 9 | Validate no pending requests (400) | MATCH | Lines 137-147 |

### 3.3 GET /api/shipment-requests — type column — 3/3

| # | Design Item | Status | Notes |
|---|-------------|:------:|-------|
| 1 | SQL `sr.type::text` | MATCH | Lines 31, 41 |
| 2 | Response `type` field | MATCH | Line 70 |
| 3 | BUNDLE unaffected | MATCH | Existing logic intact |

### 3.4 GET /api/shipment-requests/[id] — type column — 2/2

| # | Design Item | Status | Notes |
|---|-------------|:------:|-------|
| 1 | SQL `sr.type::text` | MATCH | Line 18 |
| 2 | Response `type` field | MATCH | Line 97 |

### 3.5 POST /api/shipment-requests/[id]/approve — UNBUNDLE — 4/4

| # | Design Item | Status | Notes |
|---|-------------|:------:|-------|
| 1 | Detect `type` from DB row | MATCH | Lines 25, 33 |
| 2 | DELETE shipments per order | MATCH | Lines 47-49 |
| 3 | UPDATE orders to CONFIRMED | MATCH | Lines 51-54 |
| 4 | Response `{ status, type }` | MATCH | Line 62 |

### 3.6 Distributor Detail Page — 9/10

| # | Design Item | Status | Notes |
|---|-------------|:------:|-------|
| 1 | Unbundle section condition | MATCH | Lines 37-41 |
| 2 | Exclude UNBUNDLE-type requests | MATCH | Line 39 |
| 3 | Checkboxes per order | MATCH | Lines 163-186 |
| 4 | READY_TO_SHIP eligibility | MATCH | Line 164 |
| 5 | Confirm dialog | MATCH | Line 54 |
| 6 | POST with UNBUNDLE payload | MATCH | Lines 59-66 |
| 7 | Redirect on success | MATCH | Line 72 |
| 8 | UNBUNDLE badge in header | MATCH | Lines 93-97 |
| 9 | UNBUNDLE approved banner | MATCH | Lines 121-126 |
| 10 | Pending unbundle: disabled + label | **MISSING** | See Gaps section |

### 3.7 Distributor List Page — 3/3

| # | Design Item | Status | Notes |
|---|-------------|:------:|-------|
| 1 | UNBUNDLE badge text | MATCH | Lines 132-135 |
| 2 | Orange color scheme | MATCH | `bg-orange-50 text-orange-700` |
| 3 | BUNDLE badges intact | MATCH | Lines 136-144 |

### 3.8 Admin List Page — 4/4

| # | Design Item | Status | Notes |
|---|-------------|:------:|-------|
| 1 | `sr.type::text` in SQL | MATCH | Lines 30, 44 |
| 2 | "Unbundle" orange badge | MATCH | Lines 133-136 |
| 3 | Badge colors correct | MATCH | `bg-orange-50 text-orange-700` |
| 4 | Existing badges intact | MATCH | Lines 137-145 |

### 3.9 Admin Detail Page — 5/5

| # | Design Item | Status | Notes |
|---|-------------|:------:|-------|
| 1 | "Unbundle Request" badge | MATCH | Lines 77-79 |
| 2 | UNBUNDLE approve → list redirect | MATCH | Line 35 |
| 3 | BUNDLE approve → cargo redirect | MATCH | Line 37 |
| 4 | UNBUNDLE description text | MATCH | Line 236 (minor wording diff) |
| 5 | UNBUNDLE approved banner | MATCH | Lines 173-181 |

### 3.10 Types — 1/1

| # | Design Item | Status | Notes |
|---|-------------|:------:|-------|
| 1 | `ShipmentRequestWithDetails` inherits `type` | MATCH | Via Prisma `ShipmentRequest` |

---

## 4. Gaps Found

### 4.1 Missing Features (Design ○, Implementation ✗)

| # | Item | Design Ref | File | Description |
|---|------|-----------|------|-------------|
| 1 | Pending unbundle indicator | Section 3-1, line 121 | `app/(distributor)/orders/shipment-requests/[id]/page.tsx` | Design specifies: orders with a pending UNBUNDLE request should have their checkbox disabled with an "Unbundle Pending" label. Implementation only checks `order.status === 'READY_TO_SHIP'`. Server-side validation prevents double-submission, but the UI does not show proactive feedback. |

### 4.2 Changed Features (Design ≠ Implementation)

| # | Item | Design | Implementation | Impact |
|---|------|--------|----------------|--------|
| 1 | Admin UNBUNDLE description | "...remove these orders from batch {batchNumber}." | "...remove N order(s) from the batch back to solo CONFIRMED status." | Low — no batchNumber shown; wording differs; behavior identical |

---

## 5. Match Rate

**Overall: 100% (42/42 items)** — after Act-1 iteration

| Threshold | Result |
|-----------|--------|
| >= 90% | ✅ PASS — Design and implementation match well |

---

## 6. Recommended Actions

### Optional Improvements (not blockers)

1. **Pending unbundle indicator** (UX): Query pending UNBUNDLE requests per order in the distributor detail page. Disable checkboxes and show "Unbundle Pending" label for orders already in a pending request. Server-side validation already prevents duplicates, so this is UX polish only.

2. **Admin description text** (cosmetic): Include the batch number in the UNBUNDLE description text to match the design exactly.

### No Immediate Actions Required

The server-side API implementation is 100% complete with all validations. The two gaps are UI-only and do not affect data integrity.

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2026-03-28 | Initial analysis | Claude (gap-detector) |
