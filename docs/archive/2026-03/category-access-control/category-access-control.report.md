# Completion Report: category-access-control

**Date**: 2026-03-26
**Feature**: Per-Distributor Product Category Access Control
**Match Rate**: 100%
**Phase**: Completed

---

## Summary

Admin이 distributor 계정별로 접근 가능한 product category를 설정할 수 있는 기능을 구현했습니다. 특정 distributor는 제한된 category의 상품 목록, 가격, 주문을 완전히 차단할 수 있습니다.

---

## What Was Built

### Schema
- `User` 모델에 `allowedCategories ProductCategory[]` 필드 추가
- 빈 배열(`[]`) = 전체 허용 (기본값, 기존 계정 하위 호환)

### `app/api/products/route.ts`
- Distributor 세션 시 DB에서 `allowedCategories` 조회
- 비어있으면 전체 상품 반환 (기존 동작 유지)
- 값이 있으면 해당 category + `category: null` 상품만 반환
  - `null` 포함 이유: 카테고리 미지정 상품이 제한 설정 시 완전히 사라지는 문제 방지
- `try-catch`로 항상 유효한 JSON 반환

### `app/api/admin/distributors/[id]/route.ts`
- GET: 응답에 `allowedCategories` 포함
- PUT: `allowedCategories` 수신 → 배열 타입/유효값 검증 → 저장

### `app/(admin)/admin/distributors/[id]/page.tsx`
- "Category Access" 섹션 추가 (Profile & Settings 카드 내)
- 5개 카테고리 체크박스 (BOWLING_BALL, BOWLING_BAG, BOWLING_SHOES, APPAREL, BOWLING_ACCESSORY)
- 차단된 카테고리: 빨간 배경 + 취소선 + "Blocked" 뱃지
- "Reset to allow all categories" 초기화 버튼
- Save Changes 버튼에 에러 핸들링 추가 (실패 시 에러 메시지 표시)

---

## Bugs Fixed During Implementation

### Bug 1 — Prisma client stale cache
- `prisma db push + generate` 후 Next.js dev 서버 재시작 필요
- 구 Prisma 클라이언트가 `allowedCategories` 필드를 인식 못해 API 500 에러 발생
- `try-catch` 추가 + 서버 재시작으로 해결

### Bug 2 — 카테고리 미지정 상품 미노출
- `{ category: { in: [...] } }` 필터가 `category = null` 상품 제외
- `OR [{ category: { in: [...] } }, { category: null }]` 조건으로 변경

---

## Files Changed

```
prisma/schema.prisma                              (allowedCategories 필드 추가)
app/api/products/route.ts                         (category 필터 + try-catch)
app/api/admin/distributors/[id]/route.ts          (GET/PUT allowedCategories 처리)
app/(admin)/admin/distributors/[id]/page.tsx      (Category Access UI)
```

---

## PDCA Cycle

```
[Plan] ✅ → [Design] ✅ → [Do] ✅ → [Check] ✅ 100% → [Report] ✅
```
