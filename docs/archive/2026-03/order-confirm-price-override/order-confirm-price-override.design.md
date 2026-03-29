# Design: order-confirm-price-override

- **Feature ID**: order-confirm-price-override
- **Date**: 2026-03-29
- **Status**: Design

## 1. Schema Changes

### `Order` 모델에 `confirmNote` 추가

```prisma
model Order {
  // ... existing fields ...
  confirmNote  String?   // NEW: 가격 변경 이유 노트
}
```

Migration: `npx prisma db push` (개발) / `npx prisma migrate dev --name add-confirm-note` (운영)

## 2. API Changes

### `PUT /api/orders/[id]/items` — unitPrice 필드 추가

**Request body (변경 후):**
```json
{
  "items": [
    {
      "id": "item-id",
      "decision": "ACCEPTED",
      "confirmedQty": 5,
      "rejectReason": null,
      "unitPrice": 22.50
    }
  ]
}
```

**Logic:**
- `unitPrice`가 있으면 해당 item의 `unitPrice`를 업데이트
- 없으면 기존 값 유지 (하위 호환)
- 음수/NaN 거부 (400)

### `POST /api/orders/[id]/confirm` — note 수신

**Request body (변경 후):**
```json
{
  "note": "Special Discount: 10% — VIP customer"
}
```

**Logic:**
- `note`가 있으면 `Order.confirmNote`에 저장
- status: SUBMITTED → CONFIRMED, confirmedAt: now()

## 3. UI Changes — `app/(admin)/admin/orders/[id]/page.tsx`

### 3-1. State 추가

```ts
// 아이템별 단가 override
const [priceOverrides, setPriceOverrides] = useState<Record<string, string>>({})
// Confirm 모달
const [confirmModalOpen, setConfirmModalOpen] = useState(false)
const [confirmReason, setConfirmReason] = useState('SPECIAL_DISCOUNT')
const [confirmNote, setConfirmNote] = useState('')
```

### 3-2. Items 테이블 — unitPrice 셀 인라인 편집

**SUBMITTED 상태에서만 편집 가능:**

```tsx
<td className="px-4 py-3 text-right">
  {order.status === 'SUBMITTED' ? (
    <input
      type="number"
      min={0}
      step="0.01"
      value={priceOverrides[item.id] ?? Number(item.unitPrice).toFixed(2)}
      onChange={(e) => setPriceOverrides({ ...priceOverrides, [item.id]: e.target.value })}
      className="w-24 border rounded px-2 py-1 text-right text-sm"
    />
  ) : (
    <span>${Number(item.unitPrice).toFixed(2)}</span>
  )}
</td>
```

가격 변경이 있는 행은 원래 가격도 표시 (취소선):
```tsx
{priceOverrides[item.id] && Number(priceOverrides[item.id]) !== Number(item.unitPrice) && (
  <span className="text-xs text-gray-400 line-through ml-1">${Number(item.unitPrice).toFixed(2)}</span>
)}
```

### 3-3. "Confirm Order" 버튼 → 모달 열기

```tsx
// 기존: onClick={handleConfirm}
// 변경: onClick={() => setConfirmModalOpen(true)}
```

### 3-4. Confirm 모달 구조

```
┌─────────────────────────────────────────┐
│  Confirm Order                          │
│                                         │
│  [가격 변경 요약 — 변경된 경우만 표시]    │
│  • Widget A: $25.00 → $22.50           │
│  • Gadget X: $120.00 → $0.00 (Free)   │
│                                         │
│  이유:  [dropdown]                       │
│  ┌─────────────────────────────────┐   │
│  │ Special Discount            ▾  │   │
│  └─────────────────────────────────┘   │
│                                         │
│  Note:  (가격 변경 시 필수)              │
│  ┌─────────────────────────────────┐   │
│  │ e.g. VIP customer 10% off      │   │
│  └─────────────────────────────────┘   │
│                                         │
│              [Cancel]  [Confirm Order]  │
└─────────────────────────────────────────┘
```

**Validation:**
- 가격 변경이 있고 note가 비어있으면 Confirm 버튼 disabled

### 3-5. handleConfirm 변경

```ts
async function handleConfirm() {
  setLoading(true)
  // 1. Save item decisions + price overrides
  await fetch(`/api/orders/${id}/items`, {
    method: 'PUT',
    body: JSON.stringify({
      items: order.items.map((item) => ({
        id: item.id,
        decision: decisions[item.id].decision,
        confirmedQty: decisions[item.id].confirmedQty,
        rejectReason: decisions[item.id].rejectReason,
        unitPrice: priceOverrides[item.id] ? Number(priceOverrides[item.id]) : undefined,
      })),
    }),
  })
  // 2. Confirm with note
  const noteText = confirmNote
    ? `[${REASON_LABELS[confirmReason]}] ${confirmNote}`
    : undefined
  await fetch(`/api/orders/${id}/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ note: noteText }),
  })
  setConfirmModalOpen(false)
  router.refresh()
  window.location.reload()
}
```

### 3-6. confirmNote 표시 (CONFIRMED 이후)

Order Details 섹션에서 `confirmNote`가 있으면 표시:
```tsx
{order.confirmNote && (
  <div className="col-span-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
    <span className="font-medium">Price Change Note: </span>{order.confirmNote}
  </div>
)}
```

## 4. Type Update

`OrderWithDetails` 타입에 `confirmNote` 추가:
```ts
confirmNote?: string | null
```

## 5. Implementation Order

1. `prisma/schema.prisma` — confirmNote 추가
2. `npx prisma db push`
3. `app/api/orders/[id]/items/route.ts` — unitPrice 추가
4. `app/api/orders/[id]/confirm/route.ts` — note 수신
5. `app/(admin)/admin/orders/[id]/page.tsx` — UI 변경
6. `types/index.ts` (또는 해당 타입 파일) — confirmNote 추가
