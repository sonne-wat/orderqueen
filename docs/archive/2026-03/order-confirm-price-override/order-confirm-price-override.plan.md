# Plan: order-confirm-price-override

- **Feature ID**: order-confirm-price-override
- **Date**: 2026-03-29
- **Status**: Plan

## Overview

Admin이 주문서를 CONFIRMED로 처리하기 전, 주문 아이템별 단가를 수정할 수 있다.
변경 이유(특별 할인, 무상지급 등)는 Confirm 시 note에 기재한다.

## Requirements

| # | 요구사항 | 우선순위 |
|---|---------|---------|
| 1 | SUBMITTED 상태 주문의 아이템별 단가(unitPrice) 인라인 수정 | Must |
| 2 | Confirm 버튼 클릭 시 변경 이유 + 노트 입력 모달 표시 | Must |
| 3 | 이유 카테고리: Special Discount / Free Goods (Compensation) / Price Correction / Other | Must |
| 4 | 가격 변경이 있을 경우 노트 필수, 없으면 선택 | Must |
| 5 | 변경된 가격 + 노트는 확정된 주문서에 표시 | Must |
| 6 | 주문 상세 페이지에서 confirmNote 표시 (CONFIRMED 이후) | Should |

## Current State Analysis

**현재 흐름:**
1. Admin이 `/admin/orders/[id]` 페이지에서 각 item의 `confirmedQty`와 `decision`을 수정
2. "Confirm Order" 버튼 → `PUT /api/orders/[id]/items` (결정 저장) → `POST /api/orders/[id]/confirm` (상태 변경)
3. `OrderItem.unitPrice`는 현재 읽기 전용

**필요한 변경:**
- `Order` 모델에 `confirmNote String?` 필드 추가 (스키마 변경)
- `OrderItem.unitPrice`를 SUBMITTED 상태에서 편집 가능하게 변경
- `PUT /api/orders/[id]/items` API에 `unitPrice` 필드 추가
- `POST /api/orders/[id]/confirm` API에 `note` 수신 + 저장
- Confirm 모달 신규 추가

## Data Model Changes

```prisma
model Order {
  // ... existing fields ...
  confirmNote  String?   // 가격 변경 이유 노트 (신규)
}
```

> OrderItem.unitPrice는 기존 Decimal 필드 그대로 사용 (별도 confirmedPrice 필드 불필요)

## UI Flow

```
[SUBMITTED 주문 상세 페이지]
  ↓ Items 테이블: unitPrice 셀 클릭 → 인라인 편집 (숫자 input)
  ↓ 가격 변경된 행: 원래 가격 취소선 + 새 가격 표시
  ↓ "Confirm Order" 클릭
  ↓
[Confirm 모달]
  - 변경된 가격 요약 (있는 경우)
  - 이유 dropdown: Special Discount / Free Goods / Price Correction / Other
  - Note textarea (변경 있으면 required)
  - [Cancel] [Confirm Order] 버튼
  ↓
[API 호출]
  1. PUT /api/orders/[id]/items  (unitPrice 포함)
  2. POST /api/orders/[id]/confirm  { note }
```

## Confirm Modal Reason Options

| Value | Label |
|-------|-------|
| `SPECIAL_DISCOUNT` | Special Discount |
| `FREE_GOODS` | Free Goods (Compensation) |
| `PRICE_CORRECTION` | Price Correction |
| `OTHER` | Other |

## Files to Modify

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `confirmNote String?` to Order |
| `app/(admin)/admin/orders/[id]/page.tsx` | unitPrice 인라인 편집 + Confirm 모달 |
| `app/api/orders/[id]/items/route.ts` | PUT에 unitPrice 필드 추가 |
| `app/api/orders/[id]/confirm/route.ts` | note 수신 + confirmNote 저장 |

## Out of Scope

- Distributor 측 가격 변경 불가 (Admin 전용)
- 가격 변경 이력(audit log) — 별도 기능으로 분리
- 이미 CONFIRMED 된 주문의 가격 재변경
