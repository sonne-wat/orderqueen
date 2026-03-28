# Design: Batch Shipment Request

## Overview

| Item | Content |
|------|---------|
| Feature | batch-shipment-request |
| Phase | Design |
| Coordinators | Order Coordinator + Shipping Coordinator |
| Date | 2026-03-21 |
| Reference | `docs/01-plan/features/batch-shipment-request.plan.md` |

---

## 1. Schema Design (Prisma)

### 1-1. New Models

```prisma
// New enum
enum ShipmentRequestStatus {
  PENDING
  APPROVED
  REJECTED
}

// Distributor-initiated batch shipment request
model ShipmentRequest {
  id              String                 @id @default(cuid())
  distributorId   String
  distributor     User                   @relation(fields: [distributorId], references: [id])
  status          ShipmentRequestStatus  @default(PENDING)
  requestedAt     DateTime               @default(now())
  reviewedAt      DateTime?
  rejectionNote   String?
  orders          ShipmentRequestOrder[]
  batchShipment   BatchShipment?

  @@map("shipment_requests")
}

// Junction table: one record per order in a request
// No @unique on orderId — allows resubmission after rejection
// Application layer enforces: one PENDING request per order at a time
model ShipmentRequestOrder {
  id                String          @id @default(cuid())
  shipmentRequestId String
  shipmentRequest   ShipmentRequest @relation(fields: [shipmentRequestId], references: [id], onDelete: Cascade)
  orderId           String
  order             Order           @relation(fields: [orderId], references: [id])

  @@map("shipment_request_orders")
}

// Created on approval — groups cargo details for the batch
model BatchShipment {
  id                String          @id @default(cuid())
  shipmentRequestId String          @unique
  shipmentRequest   ShipmentRequest @relation(fields: [shipmentRequestId], references: [id])
  status            ShipmentStatus  @default(PREPARING)
  cbm               Decimal?        @db.Decimal(10, 3)
  weightKg          Decimal?        @db.Decimal(8, 2)
  scheduledDate     DateTime?
  carrier           String?
  trackingNumber    String?
  notes             String?
  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt
  shipments         Shipment[]

  @@map("batch_shipments")
}
```

### 1-2. Modified Models

```prisma
// Order — add relation
model Order {
  // ... existing fields unchanged ...
  shipmentRequestOrders ShipmentRequestOrder[]  // NEW
}

// Shipment — add optional batch reference
model Shipment {
  // ... existing fields unchanged ...
  batchShipmentId String?         // NEW — null for solo shipments
  batchShipment   BatchShipment?  @relation(fields: [batchShipmentId], references: [id])
}

// User — add relation
model User {
  // ... existing fields unchanged ...
  shipmentRequests ShipmentRequest[]  // NEW
}
```

### 1-3. Migration Steps

```bash
# 1. Edit prisma/schema.prisma
# 2. Generate migration
npx prisma migrate dev --name add-batch-shipment-request

# 3. No data migration needed — all new tables and nullable columns
```

---

## 2. TypeScript Types

**File:** `types/index.ts` — add the following:

```typescript
import type {
  ShipmentRequest,
  ShipmentRequestOrder,
  BatchShipment,
  ShipmentRequestStatus,
} from '@prisma/client'

export type ShipmentRequestWithDetails = ShipmentRequest & {
  distributor: Pick<User, 'id' | 'name' | 'email' | 'company'>
  orders: (ShipmentRequestOrder & {
    order: Pick<Order, 'id' | 'orderNumber' | 'status' | 'shippingMode' | 'requestedDelivery'> & {
      items: (OrderItem & { product: Pick<Product, 'id' | 'name' | 'sku'> })[]
    }
  })[]
  batchShipment: BatchShipment | null
}

export type BatchShipmentWithDetails = BatchShipment & {
  shipmentRequest: ShipmentRequest & {
    distributor: Pick<User, 'id' | 'name' | 'company'>
    orders: (ShipmentRequestOrder & { order: Pick<Order, 'id' | 'orderNumber' | 'status'> })[]
  }
  shipments: Shipment[]
}
```

---

## 3. API Design

### 3-1. Order Coordinator APIs

#### `GET /api/shipment-requests`
List shipment requests. Role-filtered.

**Response:**
```json
{
  "requests": [
    {
      "id": "...",
      "status": "PENDING",
      "requestedAt": "2026-03-21T...",
      "distributor": { "id": "...", "name": "...", "company": "..." },
      "orderCount": 3
    }
  ]
}
```

#### `POST /api/shipment-requests`
Distributor creates a new batch request.

**Request body:**
```json
{ "orderIds": ["orderId1", "orderId2", "orderId3"] }
```

**Validations:**
- Session role must be DISTRIBUTOR
- `orderIds` must have length >= 2
- Each order must belong to the requesting distributor
- Each order must have status `CONFIRMED`
- Each order must not appear in any existing `PENDING` ShipmentRequest

**Response:** `201`
```json
{ "id": "...", "status": "PENDING", "requestedAt": "..." }
```

**Error cases:**
- `400` — fewer than 2 orders
- `400` — order not CONFIRMED: `"Order {orderNumber} is not in CONFIRMED status"`
- `400` — order in pending request: `"Order {orderNumber} is already in a pending shipment request"`
- `403` — order belongs to different distributor

#### `GET /api/shipment-requests/[id]`
Get full request detail.

**Response:**
```json
{
  "request": {
    "id": "...",
    "status": "PENDING",
    "requestedAt": "...",
    "reviewedAt": null,
    "rejectionNote": null,
    "distributor": { "id": "...", "name": "...", "company": "..." },
    "orders": [
      {
        "id": "...",
        "orderId": "...",
        "order": {
          "id": "...",
          "orderNumber": "OQ-2026-001",
          "status": "CONFIRMED",
          "shippingMode": "OCEAN",
          "requestedDelivery": "...",
          "items": [{ "product": { "name": "...", "sku": "..." }, "confirmedQty": 10 }]
        }
      }
    ],
    "batchShipment": null
  }
}
```

#### `POST /api/shipment-requests/[id]/approve`
Admin approves a request.

**Auth:** ADMIN only
**Validations:**
- Request must be in PENDING status
- Re-validate each order is still CONFIRMED (status may have changed)

**Actions (single `$transaction`):**
1. Create `BatchShipment` record linked to ShipmentRequest
2. For each order in the request:
   a. Create `Shipment` record (status: PREPARING, batchShipmentId set)
   b. Update Order status: `CONFIRMED` → `READY_TO_SHIP` via `$executeRawUnsafe`
3. Update `ShipmentRequest.status` → `APPROVED`, set `reviewedAt`

**Response:** `200`
```json
{
  "status": "APPROVED",
  "batchShipmentId": "..."
}
```

#### `POST /api/shipment-requests/[id]/reject`
Admin rejects a request.

**Auth:** ADMIN only
**Request body:**
```json
{ "rejectionNote": "Orders not ready for shipment yet." }
```

**Validations:**
- Request must be PENDING
- `rejectionNote` required (min 1 char)

**Actions:**
- Update `ShipmentRequest.status` → `REJECTED`, set `reviewedAt`, set `rejectionNote`
- Orders remain at CONFIRMED (no changes)

**Response:** `200`
```json
{ "status": "REJECTED" }
```

---

### 3-2. Shipping Coordinator APIs

#### `GET /api/batch-shipments`
List batch shipments (Admin: all; Distributor: own).

**Response:**
```json
{
  "batchShipments": [
    {
      "id": "...",
      "status": "PREPARING",
      "cbm": null,
      "carrier": null,
      "scheduledDate": null,
      "createdAt": "...",
      "shipmentRequest": {
        "id": "...",
        "distributor": { "name": "...", "company": "..." },
        "orders": [{ "order": { "orderNumber": "OQ-2026-001" } }]
      }
    }
  ]
}
```

#### `GET /api/batch-shipments/[id]`
Get full batch shipment with all linked order/shipment details.

#### `PUT /api/batch-shipments/[id]`
Admin updates cargo details.

**Auth:** ADMIN only
**Request body:**
```json
{
  "cbm": 12.5,
  "weightKg": 850.0,
  "scheduledDate": "2026-04-15T00:00:00Z",
  "carrier": "Maersk",
  "trackingNumber": "MSKU1234567",
  "notes": "Consolidated shipment"
}
```

**Response:** `200` — updated BatchShipment fields

#### `PUT /api/batch-shipments/[id]/status`
Admin updates batch shipment status (PREPARING → READY → SHIPPED).

**Auth:** ADMIN only
**Request body:** `{ "status": "READY" }`

**On SHIPPED:**
- Update all linked `Shipment` records → SHIPPED
- Update all linked `Order` records → SHIPPED via `$executeRawUnsafe`

**Response:** `200` — `{ "status": "SHIPPED" }`

---

## 4. File Structure

```
app/
├── api/
│   ├── shipment-requests/
│   │   ├── route.ts                    # GET (list), POST (create)
│   │   └── [id]/
│   │       ├── route.ts                # GET (detail)
│   │       ├── approve/
│   │       │   └── route.ts            # POST (admin approve)
│   │       └── reject/
│   │           └── route.ts            # POST (admin reject)
│   └── batch-shipments/
│       ├── route.ts                    # GET (list)
│       └── [id]/
│           ├── route.ts                # GET (detail), PUT (cargo update)
│           └── status/
│               └── route.ts            # PUT (status update)
│
├── (distributor)/
│   └── orders/
│       ├── shipping-request/
│       │   └── page.tsx                # Select orders + submit request
│       └── shipment-requests/
│           ├── page.tsx                # List own requests
│           └── [id]/
│               └── page.tsx            # Request detail (status + order list)
│
└── (admin)/
    └── admin/
        ├── shipment-requests/
        │   ├── page.tsx                # List all requests (filter: PENDING/APPROVED/REJECTED)
        │   └── [id]/
        │       └── page.tsx            # Detail: approve/reject UI
        └── batch-shipments/
            └── [id]/
                └── cargo/
                    └── page.tsx        # Cargo details editor for batch
```

---

## 5. UI Design

### 5-1. Distributor: `/orders/shipping-request`

**Purpose:** Select CONFIRMED orders and submit a batch shipment request.

**Layout:**
```
┌─────────────────────────────────────────────┐
│  Request Batch Shipment                      │
│  Select 2 or more confirmed orders           │
├─────────────────────────────────────────────┤
│  [ ] OQ-2026-001 | OCEAN | 3 items | Apr 10 │
│  [ ] OQ-2026-002 | AIR   | 1 item  | Apr 15 │
│  [x] OQ-2026-003 | OCEAN | 5 items | Apr 10 │
│  [x] OQ-2026-004 | OCEAN | 2 items | Apr 12 │
├─────────────────────────────────────────────┤
│  Selected: 2 orders                          │
│  [Cancel]              [Submit Request →]    │
└─────────────────────────────────────────────┘
```

**States:**
- Orders already in a PENDING request: shown with "Pending Request" badge, checkbox disabled
- Empty state: "No confirmed orders available for shipment request"
- After submit: redirect to `/orders/shipment-requests` with success toast

**Access:** Add "Request Batch Shipment" button to distributor dashboard when ≥2 CONFIRMED orders exist.

### 5-2. Distributor: `/orders/shipment-requests`

**Purpose:** View history of submitted requests.

**Columns:** Request Date | Orders | Status | Action

**Status badges:**
- PENDING: yellow "Awaiting Review"
- APPROVED: green "Approved"
- REJECTED: red "Rejected" + rejection note expandable

### 5-3. Admin: `/admin/shipment-requests`

**Purpose:** Review pending requests. Filter tabs: All / Pending / Approved / Rejected.

**Pending request card:**
```
┌────────────────────────────────────────────────┐
│ [PENDING]  Distributor Co., Ltd.               │
│ Requested: Mar 21, 2026                        │
│ Orders: OQ-2026-003, OQ-2026-004 (2 orders)   │
│                           [Review →]           │
└────────────────────────────────────────────────┘
```

**Nav badge:** Show count of PENDING requests in admin nav sidebar.

### 5-4. Admin: `/admin/shipment-requests/[id]`

**Purpose:** Review all orders in the request, then approve or reject.

**Layout:**
```
┌──────────────────────────────────────────────────┐
│  Shipment Request — Distributor Co., Ltd.         │
│  Requested: Mar 21, 2026 | Status: PENDING        │
├──────────────────────────────────────────────────┤
│  Orders in this request:                          │
│  ┌──────────────────────────────────────────┐    │
│  │ OQ-2026-003 | OCEAN | 5 items | Apr 10   │    │
│  │ OQ-2026-004 | OCEAN | 2 items | Apr 12   │    │
│  └──────────────────────────────────────────┘    │
├──────────────────────────────────────────────────┤
│  [Reject ▼]              [Approve All Orders →]  │
└──────────────────────────────────────────────────┘
```

**Reject flow:** Click Reject → inline textarea for rejection note → confirm.

**After approval:** Show "Batch Shipment Created" + link to `/admin/batch-shipments/[id]/cargo`.

### 5-5. Admin: `/admin/batch-shipments/[id]/cargo`

**Purpose:** Enter cargo details for the entire batch.

**Similar to existing `/admin/orders/[id]/cargo` page but:**
- Shows all orders in the batch at the top
- Single CBM, weight, carrier, tracking number for the whole batch
- Status control for the batch (PREPARING → READY → SHIPPED)
- On SHIPPED: all orders in the batch transition to SHIPPED

---

## 6. Validation Logic (Application Layer)

### Order Eligibility Check (used in POST /api/shipment-requests)

```typescript
async function getIneligibleOrderIds(orderIds: string[], distributorId: string) {
  // 1. Find orders that are not CONFIRMED or not owned by distributor
  const orders = await prisma.order.findMany({
    where: { id: { in: orderIds } },
    select: { id: true, orderNumber: true, status: true, distributorId: true },
  })

  // 2. Find orders already in a PENDING request
  const pendingRequestOrders = await prisma.shipmentRequestOrder.findMany({
    where: {
      orderId: { in: orderIds },
      shipmentRequest: { status: 'PENDING' },
    },
    select: { orderId: true },
  })
  const pendingOrderIds = new Set(pendingRequestOrders.map((r) => r.orderId))

  return orders
    .filter((o) =>
      o.distributorId !== distributorId ||
      o.status !== 'CONFIRMED' ||
      pendingOrderIds.has(o.id)
    )
    .map((o) => ({ id: o.id, orderNumber: o.orderNumber, reason:
      o.distributorId !== distributorId ? 'not_owner' :
      o.status !== 'CONFIRMED' ? 'not_confirmed' : 'in_pending_request'
    }))
}
```

### Approval Transaction (POST /api/shipment-requests/[id]/approve)

```typescript
await prisma.$transaction(async (tx) => {
  // 1. Re-validate orders are still CONFIRMED
  const requestOrders = await tx.shipmentRequestOrder.findMany({
    where: { shipmentRequestId: id },
    include: { order: { select: { id: true, status: true, orderNumber: true } } },
  })
  const notConfirmed = requestOrders.filter((ro) => ro.order.status !== 'CONFIRMED')
  if (notConfirmed.length > 0) throw new Error(
    `Orders no longer CONFIRMED: ${notConfirmed.map((ro) => ro.order.orderNumber).join(', ')}`
  )

  // 2. Create BatchShipment
  const batch = await tx.batchShipment.create({ data: { shipmentRequestId: id } })

  // 3. For each order: create Shipment + update Order status
  for (const ro of requestOrders) {
    await tx.shipment.create({
      data: { orderId: ro.orderId, batchShipmentId: batch.id, status: 'PREPARING' },
    })
    await tx.$executeRawUnsafe(
      `UPDATE orders SET status = $1::"OrderStatus", "updatedAt" = NOW() WHERE id = $2`,
      'READY_TO_SHIP', ro.orderId
    )
  }

  // 4. Update ShipmentRequest status
  await tx.shipmentRequest.update({
    where: { id },
    data: { status: 'APPROVED', reviewedAt: new Date() },
  })
})
```

---

## 7. Dashboard Integration

### Distributor Dashboard Changes

**Active Orders section** — add badge for orders in a pending request:
```typescript
// Fetch pending request order IDs alongside orders
const pendingRequestOrderIds = new Set(
  pendingRequests.flatMap((r) => r.orders.map((o) => o.orderId))
)
// Render badge
{pendingRequestOrderIds.has(order.id) && (
  <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">
    Shipment Requested
  </span>
)}
```

**"Request Batch Shipment" CTA** — show when ≥2 CONFIRMED orders without active requests:
```typescript
{confirmedOrdersWithoutRequest.length >= 2 && (
  <Link href="/orders/shipping-request">
    Request Batch Shipment ({confirmedOrdersWithoutRequest.length} orders ready)
  </Link>
)}
```

### Admin Nav / Order List Changes

- Admin sidebar or top nav: badge showing count of PENDING ShipmentRequests
- Admin orders list: tag orders that are part of a PENDING request with "In Shipment Request" chip

---

## 8. Coordinator Responsibility Matrix

| Task | Order Coordinator | Shipping Coordinator |
|------|:-----------------:|:--------------------:|
| Schema: ShipmentRequest, ShipmentRequestOrder | ✅ | |
| Schema: BatchShipment | | ✅ |
| Schema: Shipment.batchShipmentId | | ✅ |
| Schema: Order.shipmentRequestOrders relation | ✅ | |
| API: /api/shipment-requests (GET, POST) | ✅ | |
| API: /api/shipment-requests/[id] (GET) | ✅ | |
| API: /api/shipment-requests/[id]/approve | ✅ | ✅ (BatchShipment creation) |
| API: /api/shipment-requests/[id]/reject | ✅ | |
| API: /api/batch-shipments (GET, [id] GET/PUT) | | ✅ |
| API: /api/batch-shipments/[id]/status | | ✅ |
| Page: /orders/shipping-request | ✅ | |
| Page: /orders/shipment-requests (list + detail) | ✅ | |
| Page: /admin/shipment-requests (list + detail) | ✅ | |
| Page: /admin/batch-shipments/[id]/cargo | | ✅ |
| Dashboard: CONFIRMED order badges + CTA | ✅ | |
| Admin nav: PENDING badge | ✅ | |
| Admin batch cargo + ship action | | ✅ |

---

## 9. Implementation Order

### Phase 1 — Schema & Types (Order Coordinator + Shipping Coordinator)
1. Add new models to `prisma/schema.prisma`
2. Run `prisma migrate dev`
3. Add TypeScript types to `types/index.ts`

### Phase 2 — Order Coordinator APIs
4. `app/api/shipment-requests/route.ts` — GET list + POST create
5. `app/api/shipment-requests/[id]/route.ts` — GET detail
6. `app/api/shipment-requests/[id]/approve/route.ts`
7. `app/api/shipment-requests/[id]/reject/route.ts`

### Phase 3 — Shipping Coordinator APIs
8. `app/api/batch-shipments/route.ts` — GET list
9. `app/api/batch-shipments/[id]/route.ts` — GET detail + PUT cargo
10. `app/api/batch-shipments/[id]/status/route.ts` — PUT status

### Phase 4 — Distributor UI (Order Coordinator)
11. `/orders/shipping-request/page.tsx`
12. `/orders/shipment-requests/page.tsx`
13. `/orders/shipment-requests/[id]/page.tsx`
14. Dashboard updates (badge + CTA)

### Phase 5 — Admin UI (Order Coordinator + Shipping Coordinator)
15. `/admin/shipment-requests/page.tsx` (Order Coordinator)
16. `/admin/shipment-requests/[id]/page.tsx` — approve/reject (Order Coordinator)
17. `/admin/batch-shipments/[id]/cargo/page.tsx` (Shipping Coordinator)
18. Admin nav PENDING badge (Order Coordinator)

---

## 10. Success Criteria

- [ ] Distributor can select ≥2 CONFIRMED orders and submit a ShipmentRequest
- [ ] Orders in PENDING request show "Shipment Requested" badge
- [ ] Order ineligible for request shows clear error (not confirmed / already in request)
- [ ] Admin can list PENDING requests with distributor + order summary
- [ ] Admin can approve → BatchShipment created, orders → READY_TO_SHIP
- [ ] Admin can reject with note → orders remain CONFIRMED, selectable again
- [ ] Admin can enter cargo details for BatchShipment
- [ ] Admin can mark BatchShipment SHIPPED → all orders → SHIPPED
- [ ] Existing 1:1 shipment flow (per-order) is completely unaffected
- [ ] All `$executeRawUnsafe` used for Order status updates (Turbopack compatibility)
