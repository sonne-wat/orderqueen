'use client'

import { useRouter } from 'next/navigation'
import { DateRangeFilter } from './DateRangeFilter'

interface DashboardDateFilterProps {
  dateFrom: string
  dateTo: string
  allTime: boolean
}

export function DashboardDateFilter({ dateFrom, dateTo, allTime }: DashboardDateFilterProps) {
  const router = useRouter()

  function handleChange(from: string, to: string) {
    if (!from && !to) {
      // All time
      router.push('/dashboard?all=1')
      return
    }
    const params = new URLSearchParams()
    if (from) params.set('dateFrom', from)
    if (to) params.set('dateTo', to)
    router.push(`/dashboard?${params.toString()}`)
  }

  return (
    <DateRangeFilter
      dateFrom={allTime ? '' : dateFrom}
      dateTo={allTime ? '' : dateTo}
      onChange={handleChange}
    />
  )
}
