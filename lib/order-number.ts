import { prisma } from '@/lib/prisma'
import { format, startOfDay, endOfDay } from 'date-fns'

export async function generateOrderNumber(): Promise<string> {
  const now = new Date()
  const dateStr = format(now, 'yyyyMMdd')

  const count = await prisma.order.count({
    where: {
      createdAt: {
        gte: startOfDay(now),
        lte: endOfDay(now),
      },
    },
  })

  const seq = String(count + 1).padStart(3, '0')
  return `OQ-${dateStr}-${seq}`
}
