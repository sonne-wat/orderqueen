# Plan: order-constraints

**Date**: 2026-03-26
**Feature**: 주문 수량 재고 제한 + Admin 주문 취소(메시지 전달)
**Priority**: High

---

## Sub-Feature 1: Stock Quantity Limit

### Problem
주문자가 현재 재고 이상의 수량을 입력할 수 있음. 재고 초과 주문 시 처리 불가.

### Goals
- 주문 폼에서 재고 수량 초과 입력 불가 (input max 제한)
- 초과 입력 시 "재고 부족" 메시지 표시
- 서버 측에서도 주문 제출 시 재고 초과 검증

### Approach
- Products API에 `stockQuantity` 노출 (distributor용으로 `maxOrderQty` 명칭)
- 프론트엔드: `input max={p.stockQuantity}`, `setQty` 시 clamp 처리
- 서버: 주문 제출(submit) 시 각 item의 requestedQty vs stockQuantity 검증

---

## Sub-Feature 2: Admin 주문 취소 + 사유 전달

### Problem
Admin이 unshipped 주문을 삭제해야 할 때, 삭제 사유를 distributor에게 전달할 방법이 없음.

### Goals
- Admin이 SHIPPED 이전 주문에 대해 취소(Cancel) 가능
- 취소 시 사유(reason) 작성 필수
- 취소된 주문이 distributor 화면에서 취소 사유와 함께 표시됨
- 실제 DB 삭제가 아닌 CANCELLED 상태로 변경 (히스토리 보존)

### Approach
- `OrderStatus` enum에 `CANCELLED` 추가
- `Order` 모델에 `cancelReason String?` 필드 추가
- Admin 주문 상세 페이지: "Cancel Order" 버튼 → 사유 입력 모달 → 확인
- Admin orders API: `DELETE /api/orders/[id]` 에 admin 취소 로직 추가 (reason 포함)
- Distributor 주문 상세/목록: CANCELLED 상태 뱃지 + cancelReason 표시

---

## Files to Change
1. `prisma/schema.prisma` — CANCELLED status, cancelReason 필드
2. `app/api/products/route.ts` — stockQuantity 노출 (distributor용)
3. `types/index.ts` — ProductWithLowStock에 stockQuantity 추가
4. `app/(distributor)/orders/new/page.tsx` — max 제한 + 초과 경고
5. `app/api/orders/[id]/route.ts` — admin DELETE (CANCEL) 처리
6. `app/(admin)/admin/orders/[id]/page.tsx` — Cancel 버튼 + 모달
7. `app/(distributor)/orders/[id]/page.tsx` — CANCELLED 상태 + 사유 표시
8. `app/(distributor)/orders` 목록 — CANCELLED 뱃지
