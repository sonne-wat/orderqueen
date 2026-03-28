# Plan: Batch Shipment Request

## Overview

| Item | Content |
|------|---------|
| Feature Name | batch-shipment-request |
| Priority | High |
| Coordinators | Order Coordinator + Shipping Coordinator |
| Date | 2026-03-21 |

## Background & Problem

Currently, the Orderqueen system enforces a strict **1 Order = 1 Shipment** model.
- `Shipment.orderId` has a `@unique` constraint (one shipment per order)
- Admin creates shipment for each order individually
- No mechanism exists for a distributor to request that multiple orders be consolidated into one shipment

**Problem:** In practice, multiple orders from the same distributor are often shipped together. There is no workflow to request or manage this consolidation. Distributors cannot signal intent, and admin must coordinate off-system.

## Goal

Enable distributors to select multiple confirmed orders and submit a **Batch Shipment Request**. Admin reviews the request and approves or rejects it. Upon approval, the orders proceed through the shipping workflow together.

## Scope

### In Scope
- New `ShipmentRequest` model linking multiple orders to one batch request
- Distributor UI: multi-select confirmed orders → submit batch request
- Admin UI: view pending batch requests → approve or reject
- On approval: transition each order to `READY_TO_SHIP`, create a `BatchShipment` grouping
- Notification/status indicators for pending requests

### Out of Scope
- Partial approval (accept some orders, reject others within a batch) — treat as full approve/reject
- Splitting one order across multiple shipments
- Cross-distributor batch grouping (admin-only batch override)

## Stakeholder Roles

| Role | Responsibility |
|------|---------------|
| **Distributor** | Selects CONFIRMED orders and submits ShipmentRequest |
| **Admin** | Reviews ShipmentRequests, approves or rejects with notes |
| **Order Coordinator** | Manages order status transitions on approval/rejection |
| **Shipping Coordinator** | Manages BatchShipment creation and cargo details |

## Current Architecture (As-Is)

```
Order (CONFIRMED)
  └── Admin creates Shipment (1:1)
        └── Order → READY_TO_SHIP
```

`Shipment` table: `orderId String @unique` — hard constraint, one shipment per order.

## Proposed Architecture (To-Be)

```
Distributor selects N orders (CONFIRMED)
  └── Creates ShipmentRequest
        ├── ShipmentRequestItem[] (links to orders)
        └── status: PENDING

Admin reviews ShipmentRequest
  ├── Approve →
  │     ├── Creates BatchShipment (groups all orders)
  │     ├── Each order → READY_TO_SHIP
  │     └── ShipmentRequest status → APPROVED
  └── Reject →
        ├── ShipmentRequest status → REJECTED (with rejectionNote)
        └── Orders remain CONFIRMED
```

## New Data Models

### ShipmentRequest
```prisma
model ShipmentRequest {
  id             String                  @id @default(cuid())
  distributorId  String
  distributor    User                    @relation(fields: [distributorId], references: [id])
  status         ShipmentRequestStatus   @default(PENDING)
  requestedAt    DateTime                @default(now())
  reviewedAt     DateTime?
  rejectionNote  String?
  orders         ShipmentRequestOrder[]
  batchShipment  BatchShipment?
}

enum ShipmentRequestStatus {
  PENDING
  APPROVED
  REJECTED
}

model ShipmentRequestOrder {
  id                String          @id @default(cuid())
  shipmentRequestId String
  shipmentRequest   ShipmentRequest @relation(fields: [shipmentRequestId], references: [id])
  orderId           String          @unique  // one order per request (can't be in two pending requests)
  order             Order           @relation(fields: [orderId], references: [id])
}
```

### BatchShipment
```prisma
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
  shipments         Shipment[]      // Individual shipments per order within the batch
}
```

### Order model additions
```prisma
model Order {
  // ... existing fields ...
  shipmentRequestOrders ShipmentRequestOrder[]  // can be included in a request
}
```

## Order Status Considerations

Orders eligible for batch request: **CONFIRMED** status only.
- Orders in DRAFT, SUBMITTED, READY_TO_SHIP, or later stages are not eligible.
- An order already included in a PENDING request cannot be added to another request.

On approval:
- Each order → `READY_TO_SHIP`
- Individual `Shipment` records created and linked to `BatchShipment`

On rejection:
- Orders remain `CONFIRMED`
- Distributor can submit a new request (possibly with different orders)

## User Flows

### Distributor: Submit Batch Shipment Request

1. Go to **Dashboard** or new **Shipping Requests** page
2. See list of CONFIRMED orders (not already in a pending request)
3. Check/select multiple orders
4. Click "Request Batch Shipment"
5. Confirmation modal showing selected orders
6. Submit → ShipmentRequest created (PENDING)
7. Orders show "Shipment Requested" badge on dashboard

### Admin: Review Batch Shipment Request

1. Admin sees badge/count of pending ShipmentRequests in nav or order list
2. Opens `/admin/shipment-requests` page
3. Sees list of PENDING requests (distributor, order count, order numbers, date)
4. Clicks into a request → detail view showing all orders in the batch
5. Reviews order details, confirms they are ready
6. **Approve** → creates BatchShipment, transitions orders to READY_TO_SHIP
7. **Reject** → enters rejection note, request marked REJECTED

### Post-Approval Flow

After approval, admin enters cargo details (CBM, weight, carrier, etc.) on a new BatchShipment cargo page. Existing per-order Shipment records reference the BatchShipment. The existing shipping workflow (payment, ship) continues per-order or with a batch-level ship action.

## API Design

### Distributor APIs
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/shipment-requests` | GET | List distributor's requests |
| `/api/shipment-requests` | POST | Create new batch request |
| `/api/shipment-requests/[id]` | GET | Get request detail |

### Admin APIs
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/shipment-requests` | GET | List all requests (admin: all, distributor: own) |
| `/api/shipment-requests/[id]/approve` | POST | Approve request → create BatchShipment |
| `/api/shipment-requests/[id]/reject` | POST | Reject with note |

### Batch Shipment APIs
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/batch-shipments` | GET | List batch shipments |
| `/api/batch-shipments/[id]` | GET | Get batch shipment detail |
| `/api/batch-shipments/[id]` | PUT | Update cargo details |

## UI Pages

### New Pages
| Path | Role | Purpose |
|------|------|---------|
| `/orders/shipping-request` | Distributor | Select confirmed orders & submit batch request |
| `/orders/shipment-requests` | Distributor | View own request history |
| `/admin/shipment-requests` | Admin | List all pending/reviewed requests |
| `/admin/shipment-requests/[id]` | Admin | Review request, approve/reject |
| `/admin/batch-shipments/[id]/cargo` | Admin | Enter cargo details for batch |

### Modified Pages
| Path | Change |
|------|--------|
| `/dashboard` | Show "Shipment Requested" badge on applicable orders |
| `/admin/orders` | Indicate orders that are part of a pending request |

## Coordinator Responsibilities

### Order Coordinator
- Schema changes to `Order` model (add `shipmentRequestOrders` relation)
- `ShipmentRequest` and `ShipmentRequestOrder` models
- Order status transition logic on approval/rejection
- Validation: order eligibility (CONFIRMED + not in active request)
- API routes: `/api/shipment-requests` (CRUD + approve/reject)
- Distributor UI: request submission flow
- Admin UI: request review page

### Shipping Coordinator
- `BatchShipment` model
- Individual `Shipment` records linked to `BatchShipment`
- API routes: `/api/batch-shipments`
- Admin cargo entry page for batch
- Status progression for batch shipments
- Admin shipment list updates to show batch vs individual

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Order added to two requests simultaneously | `ShipmentRequestOrder.orderId @unique` prevents duplicate |
| Order status changes while in pending request | Validate order is still CONFIRMED on approval |
| Existing 1:1 Shipment model conflicts | BatchShipment is a new parallel model; existing Shipment unchanged for now |
| Complex rollback if approval fails mid-way | Use Prisma `$transaction` for atomic approval |

## Success Criteria

- [ ] Distributor can select 2+ CONFIRMED orders and submit a batch request
- [ ] Admin can view all pending batch requests with order details
- [ ] Admin can approve a request (orders move to READY_TO_SHIP, BatchShipment created)
- [ ] Admin can reject a request with a note (orders remain CONFIRMED)
- [ ] Rejected orders are selectable for a new request
- [ ] An order cannot be in two simultaneous PENDING requests
- [ ] Existing single-order shipment flow is unaffected

## Implementation Order

1. **Schema** — Add `ShipmentRequest`, `ShipmentRequestOrder`, `BatchShipment` models; `prisma migrate`
2. **Order Coordinator APIs** — ShipmentRequest CRUD, approve, reject endpoints
3. **Shipping Coordinator APIs** — BatchShipment CRUD endpoints
4. **Distributor UI** — Shipping request submission page + dashboard updates
5. **Admin UI** — Request list, request detail (approve/reject), batch cargo page
6. **Integration** — Wire status transitions, test full flow end-to-end
