# Design: order-constraints

**Date**: 2026-03-26
**Feature**: 주문 수량 재고 제한 + Admin 주문 취소(메시지 전달)

---

## Sub-Feature 1: Stock Quantity Limit

### API Change
- `GET /api/products` — distributor 응답에 `stockQuantity` 포함 (기존 `lowStockThreshold`만 제거)

### Frontend: `app/(distributor)/orders/new/page.tsx`
- qty input에 `max={p.stockQuantity}` 추가
- `onChange`: `Math.min(val, p.stockQuantity)` clamp 처리
- qty === stockQuantity 시 "Max {n}" 경고 표시 (orange)
- `isOutOfStock` 인 경우 기존과 동일하게 "Unavailable" 표시

### Server Validation: `app/api/orders/[id]/submit/route.ts`
- 주문 제출 시 items × products 조회 후 stockQuantity 초과 여부 검증
- 초과 시 400 + 상세 항목 목록 반환

---

## Sub-Feature 2: Admin Order Cancellation

### Schema
- `Order.cancelReason String?` — 취소 사유
- `OrderStatus.CANCELLED` enum 값 추가

### API: `DELETE /api/orders/[id]`
- ADMIN 역할: status가 SHIPPED·CANCELLED가 아닌 경우 → `CANCELLED`로 업데이트 + `cancelReason` 저장 (body: `{ reason }`)
- DISTRIBUTOR 역할: 기존 동작 유지 (DRAFT 물리 삭제)

### Admin UI: `app/(admin)/admin/orders/[id]/page.tsx`
- status가 SHIPPED·CANCELLED가 아닌 경우 "Cancel Order" 버튼 표시
- 클릭 시 모달 → reason textarea → "Confirm Cancellation" → DELETE 호출
- 성공 시 order.status를 CANCELLED로 업데이트

### Distributor UI
- `OrderStatusBadge`: CANCELLED → `bg-red-100 text-red-700`
- `app/(distributor)/orders/[id]/page.tsx`: CANCELLED 시 붉은 알림 박스 + cancelReason 표시
- `app/(distributor)/dashboard/page.tsx`:
  - `activeOrders` 필터에서 CANCELLED 제외
  - "Cancelled" 섹션 추가 → 취소 사유 표시

---

## Files Changed
1. `prisma/schema.prisma` — CANCELLED, cancelReason (완료)
2. `app/api/products/route.ts` — stockQuantity 노출 (완료)
3. `app/api/orders/[id]/route.ts` — DELETE admin cancel 로직
4. `app/api/orders/[id]/submit/route.ts` — 서버 재고 검증
5. `components/orders/OrderStatusBadge.tsx` — CANCELLED 스타일
6. `app/(distributor)/orders/new/page.tsx` — max 제한 + 경고
7. `app/(admin)/admin/orders/[id]/page.tsx` — Cancel 버튼 + 모달
8. `app/(distributor)/orders/[id]/page.tsx` — CANCELLED 알림
9. `app/(distributor)/dashboard/page.tsx` — Cancelled 섹션
