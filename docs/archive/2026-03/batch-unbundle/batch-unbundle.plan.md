# Plan: batch-unbundle

**Date**: 2026-03-28
**Feature**: Batch Shipment에서 Order 분리 요청 (Solo Order 복귀)
**Priority**: Medium

---

## Problem

주문자가 여러 order를 batch shipment으로 묶은 후, 계획 변경으로 특정 order를 batch에서 분리해 solo order로 되돌리고 싶을 때 현재 방법이 없음.

---

## Goals

- Distributor가 active batch에 포함된 order 중 일부를 분리 요청 (Unbundle Request) 제출 가능
- Admin이 요청을 승인하면 해당 order들이 batch에서 제거되고 CONFIRMED 상태로 복귀
- Admin이 거절하면 order들은 batch에 그대로 유지
- 거절 시 사유(rejectionNote) 전달

---

## Approach

### DB 변경 (schema)
- `ShipmentRequest` 모델에 `type ShipmentRequestType @default(BUNDLE)` 필드 추가
- `enum ShipmentRequestType { BUNDLE UNBUNDLE }` 추가
- 기존 BUNDLE 요청은 `@default(BUNDLE)`로 자동 호환

### Unbundle 요청 흐름
1. Distributor → batch detail 페이지에서 "Unbundle Orders" 버튼 클릭
2. 분리할 order(들) 선택 → 제출
3. `POST /api/shipment-requests` (type=UNBUNDLE, targetBatchId 필수, orderIds)
4. ShipmentRequest(type=UNBUNDLE, status=PENDING) + ShipmentRequestOrder 생성

### Admin 승인 흐름 (approve)
- UNBUNDLE request 승인 시:
  1. 각 order에 대해 Shipment 레코드 삭제 (batch 연결 해제)
  2. Order.status → CONFIRMED 복귀
  3. ShipmentRequest.status → APPROVED

### Admin 거절 흐름 (reject)
- 기존 reject 로직과 동일 (rejectionNote 필수)

---

## Constraints

- Batch가 이미 SHIPPED 상태이면 unbundle 불가
- Batch에 order가 1개만 남는 경우도 허용 (batch 자체는 유지)
- 이미 PENDING인 unbundle 요청이 있으면 중복 제출 불가 (같은 order)
- Order 상태가 READY_TO_SHIP인 경우에만 unbundle 가능 (PAYMENT_PENDING 이후는 불가)

---

## Files to Change

1. `prisma/schema.prisma` — ShipmentRequestType enum + ShipmentRequest.type 필드
2. `app/api/shipment-requests/route.ts` — POST: type=UNBUNDLE 처리
3. `app/api/shipment-requests/[id]/approve/route.ts` — UNBUNDLE 승인 로직 분기
4. `app/(distributor)/orders/shipment-requests/[id]/page.tsx` — "Unbundle Orders" UI
5. `app/(admin)/admin/shipment-requests/page.tsx` — UNBUNDLE 요청 타입 표시
6. `app/(admin)/admin/shipment-requests/[id]/page.tsx` — UNBUNDLE 요청 상세 + 승인/거절
