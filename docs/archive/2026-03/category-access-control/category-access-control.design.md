# Design: category-access-control

**Date**: 2026-03-26
**Feature**: Per-Distributor Product Category Access Control

---

## Schema Change

### `prisma/schema.prisma` — User 모델에 필드 추가

```prisma
model User {
  ...
  allowedCategories  ProductCategory[]   // 빈 배열 = 전체 허용
  ...
}
```

- `ProductCategory[]` — PostgreSQL enum array
- 기본값: `[]` (빈 배열) = 모든 카테고리 허용
- 값이 하나라도 있으면 해당 카테고리만 허용

---

## API Changes

### `GET /api/admin/distributors/[id]`
응답에 `allowedCategories` 추가:
```json
{
  "distributor": {
    ...
    "allowedCategories": ["BOWLING_BALL", "BOWLING_BAG"]
  }
}
```

### `PUT /api/admin/distributors/[id]`
`allowedCategories` 배열 수신 및 저장:
```json
{ "allowedCategories": ["BOWLING_BALL", "BOWLING_BAG"] }
```
- 빈 배열(`[]`) = 전체 허용으로 초기화
- 유효하지 않은 category 값은 400 반환

### `GET /api/products`
Distributor 세션일 때 `allowedCategories` 필터 적용:
```ts
// user.allowedCategories가 비어있으면 전체 허용
// 값이 있으면 해당 카테고리만 반환
where: {
  isActive: true,
  ...(allowedCategories.length > 0
    ? { category: { in: allowedCategories } }
    : {}),
}
```
- Admin 세션: 필터 없음 (전체 반환)

---

## UI Change

### `app/(admin)/admin/distributors/[id]/page.tsx`

"Profile & Settings" 카드 하단에 **Category Access** 섹션 추가:

```
┌─────────────────────────────────────┐
│ Category Access                     │
│ (체크 없음 = 모든 카테고리 허용)      │
│                                     │
│ ☑ Bowling Ball                      │
│ ☑ Bowling Bag                       │
│ ☐ Bowling Shoes                     │
│ ☑ Apparel                           │
│ ☑ Bowling Accessory                 │
│                                     │
│ 현재 제한: Bowling Shoes 접근 불가   │
└─────────────────────────────────────┘
```

- 체크박스 목록 (각 ProductCategory enum 값)
- "모두 허용" = 체크박스 전부 해제 or 전부 체크
- 저장은 기존 "Save Changes" 버튼과 동일하게 처리
- `allowedCategories` state를 기존 `form` state에 통합

---

## Data Flow

```
Admin 체크박스 선택
  → PUT /api/admin/distributors/[id] { allowedCategories: [...] }
  → prisma.user.update({ allowedCategories })
  → Distributor 로그인 시 GET /api/products
  → products API: session user의 allowedCategories로 DB 쿼리 필터링
  → 허용된 category 상품만 반환
```

---

## Implementation Order

1. `prisma/schema.prisma` — `allowedCategories` 필드 추가
2. `prisma db push`
3. `app/api/products/route.ts` — distributor 필터 로직 추가
4. `app/api/admin/distributors/[id]/route.ts` — GET 응답에 포함, PUT 처리
5. `app/(admin)/admin/distributors/[id]/page.tsx` — UI 체크박스 섹션 추가
