const STEPS = [
  {
    key: 'SUBMITTED',
    label: 'Order Checked',
    desc: 'Order received by admin',
    icon: '📋',
  },
  {
    key: 'CONFIRMED',
    label: 'Order Confirmed',
    desc: 'Items confirmed by admin',
    icon: '✅',
  },
  {
    key: 'READY_TO_SHIP',
    label: 'Ready to Ship',
    desc: 'Goods prepared for shipment',
    icon: '📦',
  },
  {
    key: 'PAYMENT_CONFIRMED',
    label: 'Payment Confirmed',
    desc: 'Payment received',
    icon: '💰',
  },
  {
    key: 'SHIPMENT_BOOKED',
    label: 'Shipment Booked',
    desc: 'Booking confirmed',
    icon: '📬',
  },
  {
    key: 'SHIPPED',
    label: 'Shipped',
    desc: 'Order dispatched',
    icon: '🚢',
  },
]

// Full status order for index calculations (PAYMENT_PENDING sits between READY_TO_SHIP and PAYMENT_CONFIRMED)
const STATUS_ORDER = [
  'DRAFT', 'SUBMITTED', 'CONFIRMED', 'READY_TO_SHIP',
  'PAYMENT_PENDING', 'PAYMENT_CONFIRMED', 'SHIPMENT_BOOKED', 'SHIPPED',
]

// Map intermediate states to the step that should appear active in the timeline
const STATUS_TO_DISPLAY_STEP: Record<string, string> = {
  PAYMENT_PENDING: 'PAYMENT_CONFIRMED',
}

interface TimelineProps {
  status: string
  paymentSkipped?: boolean
  invoiceNumber?: string
  acknowledgementNumber?: string
}

export function OrderStatusTimeline({ status, paymentSkipped = false, invoiceNumber, acknowledgementNumber }: TimelineProps) {
  const displayStatus = STATUS_TO_DISPLAY_STEP[status] ?? status
  const currentIdx = STATUS_ORDER.indexOf(displayStatus)

  return (
    <div className="w-full overflow-x-auto">
      <div className="flex items-start min-w-max py-2">
        {STEPS.map((step, i) => {
          const stepIdx = STATUS_ORDER.indexOf(step.key)
          const isPaymentStep = step.key === 'PAYMENT_CONFIRMED'
          const isConfirmedStep = step.key === 'CONFIRMED'

          // Payment step is "skipped" when paymentSkipped=true and order is SHIPPED
          const skipped = isPaymentStep && paymentSkipped && status === 'SHIPPED'
          const done    = !skipped && currentIdx > stepIdx
          const active  = !skipped && currentIdx === stepIdx

          // Label/desc override for PAYMENT_PENDING active state or skipped state
          const label =
            skipped ? '결제 미완료' :
            (isPaymentStep && status === 'PAYMENT_PENDING') ? 'Payment Pending' :
            step.label

          const desc =
            skipped ? 'Payment not confirmed' :
            (isPaymentStep && status === 'PAYMENT_PENDING') ? 'Awaiting payment' :
            step.desc

          return (
            <div key={step.key} className="flex items-start">
              {/* Step */}
              <div className="flex flex-col items-center w-28">
                {/* Circle */}
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-base border-2 transition-all
                    ${skipped  ? 'bg-orange-50 border-orange-300 text-orange-500' :
                      done     ? 'bg-blue-600 border-blue-600 text-white shadow-sm' :
                      active   ? 'bg-blue-50 border-blue-500 text-blue-600 shadow-md ring-4 ring-blue-100' :
                                 'bg-white border-gray-200 text-gray-300'}`}
                >
                  {skipped ? '⚠️' : done ? '✓' : <span className={active ? '' : 'text-gray-300'}>{step.icon}</span>}
                </div>
                {/* Label */}
                <span
                  className={`text-xs mt-2 text-center leading-tight font-medium
                    ${skipped ? 'text-orange-500' : done ? 'text-blue-600' : active ? 'text-blue-700' : 'text-gray-400'}`}
                >
                  {label}
                </span>
                {/* Description */}
                <span className={`text-[10px] mt-0.5 text-center leading-tight
                  ${skipped ? 'text-orange-400' : active ? 'text-blue-500' : 'text-gray-300'}`}>
                  {desc}
                </span>
                {/* Badge */}
                {active && (
                  <span className="mt-1 px-1.5 py-0.5 bg-blue-600 text-white text-[10px] rounded-full font-medium">
                    Current
                  </span>
                )}
                {skipped && (
                  <span className="mt-1 px-1.5 py-0.5 bg-orange-500 text-white text-[10px] rounded-full font-medium">
                    미완료
                  </span>
                )}
                {/* Acknowledgement number for confirmed step */}
                {isConfirmedStep && acknowledgementNumber && (done || active) && (
                  <span className="mt-1 text-[10px] font-mono text-center leading-tight text-gray-400">
                    #{acknowledgementNumber}
                  </span>
                )}
                {/* Invoice number for payment steps */}
                {isPaymentStep && invoiceNumber && (done || active || skipped) && (
                  <span className={`mt-1 text-[10px] font-mono text-center leading-tight ${skipped ? 'text-orange-400' : 'text-gray-400'}`}>
                    #{invoiceNumber}
                  </span>
                )}
              </div>

              {/* Connector line */}
              {i < STEPS.length - 1 && (
                <div className="flex items-center mt-5 mx-1">
                  <div className={`w-8 h-0.5 ${done ? 'bg-blue-500' : 'bg-gray-200'}`} />
                  <div className={`text-[10px] ${done ? 'text-blue-400' : 'text-gray-200'}`}>›</div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Compact version for list views
export function OrderStatusProgress({ status, paymentSkipped = false }: TimelineProps) {
  const displayStatus = STATUS_TO_DISPLAY_STEP[status] ?? status
  const currentIdx = STATUS_ORDER.indexOf(displayStatus)
  const total = STEPS.length
  const completed = STEPS.filter((s) => STATUS_ORDER.indexOf(s.key) < currentIdx).length
  const activeStep = STEPS.find((s) => STATUS_ORDER.indexOf(s.key) === currentIdx)
  const pct = Math.round((completed / total) * 100)

  if (status === 'DRAFT') return null

  const activeLabel =
    (status === 'PAYMENT_PENDING') ? 'Payment Pending' :
    (activeStep?.label ?? status)

  return (
    <div className="w-full">
      <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
        <span className="font-medium text-gray-700">{activeLabel}</span>
        <span>{completed}/{total} steps</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-1.5">
        <div
          className={`h-1.5 rounded-full transition-all ${
            status === 'SHIPPED' && paymentSkipped ? 'bg-orange-400' :
            status === 'SHIPPED' ? 'bg-indigo-500' : 'bg-blue-500'
          }`}
          style={{ width: `${status === 'SHIPPED' ? 100 : pct}%` }}
        />
      </div>
      {status === 'SHIPPED' && paymentSkipped && (
        <div className="text-[10px] text-orange-500 mt-0.5">결제 미완료 출고</div>
      )}
    </div>
  )
}
