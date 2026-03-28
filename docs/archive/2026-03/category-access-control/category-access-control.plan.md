# Plan: category-access-control

**Date**: 2026-03-26
**Feature**: Per-Distributor Product Category Access Control
**Priority**: High
**Estimated Scope**: Medium

---

## Problem Statement

현재 모든 distributor 계정은 활성화된 전체 product를 볼 수 있고 주문할 수 있습니다.
비즈니스 요구사항상 특정 distributor에게는 특정 카테고리(예: Bowling Shoes)의 상품 목록, 가격, 주문 기능을 완전히 차단해야 합니다.

## Goals

1. Admin이 distributor별로 접근 가능한 product category를 설정할 수 있다
2. 제한된 distributor는 해당 category의 상품을 목록에서 볼 수 없다
3. 제한된 distributor는 해당 category 상품의 가격을 볼 수 없다
4. 제한된 distributor는 해당 category 상품을 주문할 수 없다
5. 제한이 없는 경우(기본값) 모든 category 접근 가능 (하위 호환성)

## Non-Goals

- Product 단위 개별 권한 제어 (category 단위로 충분)
- Distributor 간 권한 템플릿 복사 (1차 구현 범위 외)

## ProductCategory Enum (현재)

```
BOWLING_BALL
BOWLING_BAG
BOWLING_SHOES
APPAREL
BOWLING_ACCESSORY
```

## Technical Approach

### Schema 변경
`User` 모델에 `allowedCategories ProductCategory[]` 배열 필드 추가
- 빈 배열(`[]`) = 모든 카테고리 허용 (기본값, 기존 계정 하위 호환)
- 값이 있을 경우 = 해당 카테고리만 허용

### 영향 범위
1. **Prisma schema** — `allowedCategories` 필드 추가
2. **DB migration** — `prisma db push`
3. **Admin distributors 상세 페이지** — category 권한 체크박스 UI
4. **`/api/products` GET** — distributor 세션일 경우 `allowedCategories` 필터 적용
5. **Distributor 신규 주문 폼** — 제한된 category 상품 노출 안 됨 (API에서 필터링)
6. **Admin products 목록** — 영향 없음 (admin은 모든 상품 볼 수 있음)

## Acceptance Criteria

- [ ] Admin이 distributor 상세 페이지에서 category 체크박스로 권한 설정 가능
- [ ] 저장 시 즉시 반영 (다음 API 호출부터 적용)
- [ ] 권한 없는 category의 상품은 distributor API 응답에서 제외
- [ ] 신규 distributor 계정은 기본적으로 모든 category 허용
- [ ] Admin 계정은 영향 없음 (항상 전체 접근)
