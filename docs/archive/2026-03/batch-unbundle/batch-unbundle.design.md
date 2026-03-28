# Design: batch-unbundle

**Date**: 2026-03-28
**Feature**: Batch Shipment에서 Order 분리 요청 (Solo Order 복귀)

---

## 1. Schema 변경

### `prisma/schema.prisma`

```prisma
enum ShipmentRequestType {
  BUNDLE
  UNBUNDLE
}

model ShipmentRequest {
  ...
  type  ShipmentRequestType  @default(BUNDLE)
  ...
}
```

- `@default(BUNDLE)`: 기존 BUNDLE 요청들은 DB default로 자동 호환
- `prisma db push` + `prisma generate` 필요

---

## 2. API 설계

### 2-1. `POST /api/shipment-requests` (기존 확장)

**Request body (UNBUNDLE)**:
```json
{
  "type": "UNBUNDLE",
  "targetBatchId": "<batchId>",
  "orderIds": ["<orderId>", ...]
}
```

**UNBUNDLE 전용 Validation**:
| 조건 | 오류 |
|------|------|
| `targetBatchId` 없음 | 400 "targetBatchId is required for unbundle" |
| Batch가 SHIPPED | 400 "Batch already shipped" |
| Batch가 해당 Distributor 소유 아님 | 403 |
| Order status가 READY_TO_SHIP 아님 | 400 "Order {N} is not READY_TO_SHIP" |
| Order가 해당 Batch에 속하지 않음 | 400 "Order {N} is not in this batch" |
| 같은 Order에 PENDING 요청 존재 | 400 (기존 로직 유지) |

**DB Insert (UNBUNDLE)**:
```sql
INSERT INTO shipment_requests (id, "distributorId", status, type, "targetBatchId", "requestedAt")
VALUES ($1, $2, 'PENDING', 'UNBUNDLE', $3, NOW())
```

**BUNDLE 기존 로직**: `type` 없거나 `'BUNDLE'`이면 기존 로직 그대로 실행

---

### 2-2. `GET /api/shipment-requests` (기존 확장)

raw SQL SELECT에 `sr.type::text` 추가:
```sql
SELECT sr.id, sr.type::text, sr.status::text, ...
```

응답에 `type` 필드 포함.

---

### 2-3. `GET /api/shipment-requests/[id]` (기존 확장)

단일 요청 조회 시 `type` 포함되도록 raw SQL 업데이트.

---

### 2-4. `POST /api/shipment-requests/[id]/approve` (기존 확장)

```
UNBUNDLE request 감지 → type === 'UNBUNDLE' 분기
```

**UNBUNDLE 승인 처리**:
```
for each orderId in request.orders:
  1. DELETE FROM shipments WHERE "orderId" = $orderId
  2. UPDATE orders SET status = 'CONFIRMED', "updatedAt" = NOW() WHERE id = $orderId

UPDATE shipment_requests SET status = 'APPROVED', "reviewedAt" = NOW() WHERE id = $requestId
```

**응답**: `{ status: 'APPROVED', type: 'UNBUNDLE' }`
- Admin UI: cargo 페이지로 redirect 하지 않고 목록으로 복귀

**BUNDLE 기존 로직**: `type !== 'UNBUNDLE'`이면 기존 배치 생성 로직 그대로 실행

---

## 3. Distributor UI

### 3-1. `app/(distributor)/orders/shipment-requests/[id]/page.tsx` (기존 확장)

이 페이지는 BUNDLE request의 상세를 보여줌. APPROVED 상태이고 batch가 SHIPPED가 아닐 때 **Unbundle 섹션** 추가.

**추가 섹션 조건**:
```
request.status === 'APPROVED'
&& request.batchShipment (존재)
&& batchShipment.status !== 'SHIPPED'
```

**Unbundle 섹션 UI**:
- 각 order 옆에 체크박스 표시 (READY_TO_SHIP인 order만 선택 가능)
- "Unbundle Selected Orders" 버튼
- 클릭 시 확인 → `POST /api/shipment-requests` with `{ type: 'UNBUNDLE', targetBatchId, orderIds }`
- 성공 시 `/orders/shipment-requests` 목록으로 redirect

**Pending 중인 unbundle 요청이 있는 order**: 체크박스 disabled + "Unbundle Pending" 표시

---

### 3-2. `app/(distributor)/orders/shipment-requests/page.tsx` (기존 확장)

요청 목록에 UNBUNDLE 요청 타입 뱃지 추가:
- BUNDLE: "New Batch" 또는 "Add to BS-YYYY-NNN" (기존)
- UNBUNDLE: "Unbundle from BS-YYYY-NNN" (주황색 뱃지)

---

## 4. Admin UI

### 4-1. `app/(admin)/admin/shipment-requests/page.tsx` (기존 확장)

목록에 타입 뱃지 추가:
- 기존: "New Batch" / "Add to {batchNumber}"
- 신규: "Unbundle" (주황색 `bg-orange-50 text-orange-700`)

raw SQL에 `sr.type::text` 추가.

---

### 4-2. `app/(admin)/admin/shipment-requests/[id]/page.tsx` (기존 확장)

**UNBUNDLE 요청 표시**:
- 헤더에 "Unbundle Request" 뱃지
- 설명 텍스트: "The distributor is requesting to remove these orders from batch {batchNumber}."
- Order 목록에 현재 status 표시 (READY_TO_SHIP 예상)

**Approve 버튼 동작**:
- UNBUNDLE: 승인 후 `/admin/shipment-requests` 목록으로 redirect (cargo 페이지 아님)
- BUNDLE: 기존대로 `/admin/batch-shipments/{batchId}/cargo` redirect

**Reject 버튼 동작**: 기존 동일

---

## 5. Types 변경

### `types/index.ts`

`ShipmentRequestWithDetails`는 `ShipmentRequest`를 extends하므로 Prisma에서 `type` 필드가 자동 포함됨. 별도 수정 불필요.

---

## 6. 변경 파일 목록

| # | 파일 | 변경 내용 |
|---|------|-----------|
| 1 | `prisma/schema.prisma` | `ShipmentRequestType` enum + `ShipmentRequest.type` 필드 |
| 2 | `app/api/shipment-requests/route.ts` | POST: UNBUNDLE 분기, GET: type 컬럼 추가 |
| 3 | `app/api/shipment-requests/[id]/route.ts` | GET: type 컬럼 추가 |
| 4 | `app/api/shipment-requests/[id]/approve/route.ts` | UNBUNDLE 승인 로직 분기 |
| 5 | `app/(distributor)/orders/shipment-requests/[id]/page.tsx` | Unbundle 섹션 추가 |
| 6 | `app/(distributor)/orders/shipment-requests/page.tsx` | UNBUNDLE 뱃지 표시 |
| 7 | `app/(admin)/admin/shipment-requests/page.tsx` | UNBUNDLE 뱃지 + type 쿼리 |
| 8 | `app/(admin)/admin/shipment-requests/[id]/page.tsx` | UNBUNDLE 요청 상세 + approve 분기 |

---

## 7. 데이터 흐름

```
Distributor
  → batch detail 페이지에서 order 선택 후 "Unbundle" 제출
  → ShipmentRequest (type=UNBUNDLE, status=PENDING) 생성

Admin
  → /admin/shipment-requests 목록에서 "Unbundle" 뱃지로 식별
  → 상세 페이지에서 Approve 클릭

Approve 처리
  → Shipment 레코드 삭제 (batch 연결 해제)
  → Order.status = CONFIRMED (복귀)
  → ShipmentRequest.status = APPROVED

결과
  → Order는 solo CONFIRMED 상태로 돌아와 재-batch 요청 가능
  → 원본 batch는 나머지 order들과 함께 유지
```
