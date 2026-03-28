const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  DRAFT:             { label: 'Draft',             color: 'bg-gray-100 text-gray-600' },
  SUBMITTED:         { label: 'Submitted',         color: 'bg-blue-100 text-blue-700' },
  CONFIRMED:         { label: 'Confirmed',         color: 'bg-green-100 text-green-700' },
  PAYMENT_PENDING:   { label: 'Payment Pending',   color: 'bg-yellow-100 text-yellow-700' },
  PAYMENT_CONFIRMED: { label: 'Payment Confirmed', color: 'bg-teal-100 text-teal-700' },
  READY_TO_SHIP:     { label: 'Ready to Ship',     color: 'bg-purple-100 text-purple-700' },
  SHIPMENT_BOOKED:   { label: 'Shipment Booked',   color: 'bg-violet-100 text-violet-700' },
  SHIPPED:           { label: 'Shipped',           color: 'bg-indigo-100 text-indigo-700' },
  CANCELLED:         { label: 'Cancelled',         color: 'bg-red-100 text-red-700' },
}

export function OrderStatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] ?? { label: status, color: 'bg-gray-100 text-gray-600' }
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
      {config.label}
    </span>
  )
}
