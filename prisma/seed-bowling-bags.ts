import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

const bowlingBags = [
  { sku: '200206', name: '2026 ROLLING THUNDER ACCESSORY POUCH (WHITE RACER)' },
  { sku: '200207', name: '2026 ROLLING THUNDER ACCESSORY POUCH (SILVER KHAKI)' },
  { sku: '200208', name: '2026 ROLLING THUNDER ACCESSORY POUCH (BRONZE)' },
  { sku: '200209', name: '2026 ROLLING THUNDER ACCESSORY POUCH (SOLID BLACK)' },
  { sku: '200210', name: '2026 ROLLING THUNDER ACCESSORY POUCH (SOLID WHITE)' },
  { sku: '200211', name: '2026 ROLLING THUNDER ACCESSORY POUCH (CREAM)' },
  { sku: '200212', name: '2026 ROLLING THUNDER 1-BALL SPARE KIT (WHITE RACER)' },
  { sku: '200213', name: '2026 ROLLING THUNDER 1-BALL SPARE KIT (SILVER KHAKI)' },
  { sku: '200214', name: '2026 ROLLING THUNDER 1-BALL SPARE KIT (BRONZE)' },
  { sku: '200215', name: '2026 ROLLING THUNDER 1-BALL SPARE KIT (SOLID BLACK)' },
  { sku: '200216', name: '2026 ROLLING THUNDER 1-BALL SPARE KIT (SOLID WHITE)' },
  { sku: '200217', name: '2026 ROLLING THUNDER 1-BALL SPARE KIT (CREAM)' },
  { sku: '200218', name: '2026 ROLLING THUNDER 2-BALL TOTE DLX (SOLID BLACK)' },
  { sku: '200219', name: '2026 ROLLING THUNDER 2-BALL TOTE DLX (SOLID WHITE)' },
  { sku: '200220', name: '2026 ROLLING THUNDER 2-BALL TOTE DLX (CREAM)' },
  { sku: '200221', name: '2026 ROLLING THUNDER 2-BALL ROLLER (WHITE RACER)' },
  { sku: '200222', name: '2026 ROLLING THUNDER 2-BALL ROLLER (SILVER KHAKI)' },
  { sku: '200223', name: '2026 ROLLING THUNDER 2-BALL ROLLER (BRONZE)' },
  { sku: '200224', name: '2026 ROLLING THUNDER 2-BALL ROLLER (SOLID BLACK)' },
  { sku: '200225', name: '2026 ROLLING THUNDER 2-BALL ROLLER (SOLID WHITE)' },
  { sku: '200226', name: '2026 ROLLING THUNDER 2-BALL ROLLER (CREAM)' },
  { sku: '200227', name: '2026 ROLLING THUNDER 3-BALL ROLLER (WHITE RACER)' },
  { sku: '200228', name: '2026 ROLLING THUNDER 3-BALL ROLLER (SILVER KHAKI)' },
  { sku: '200229', name: '2026 ROLLING THUNDER 3-BALL ROLLER (BRONZE)' },
  { sku: '200230', name: '2026 ROLLING THUNDER 3-BALL ROLLER (SOLID BLACK)' },
  { sku: '200231', name: '2026 ROLLING THUNDER 3-BALL ROLLER (SOLID WHITE)' },
  { sku: '200232', name: '2026 ROLLING THUNDER 3-BALL ROLLER (CREAM)' },
  { sku: '200233', name: '2026 ROLLING THUNDER 3-BALL ROLLER PRO (SOLID BLACK)' },
  { sku: '200234', name: '2026 ROLLING THUNDER 3-BALL ROLLER PRO (SOLID WHITE)' },
  { sku: '200235', name: '2026 ROLLING THUNDER 3-BALL ROLLER PRO (CREAM)' },
  { sku: '200236', name: '2026 ROLLING THUNDER 3-BALL INLINE (SOLID BLACK)' },
  { sku: '200237', name: '2026 ROLLING THUNDER 3-BALL INLINE (SOLID WHITE)' },
  { sku: '200238', name: '2026 ROLLING THUNDER 3-BALL INLINE (CREAM)' },
  { sku: '200239', name: '2026 ROLLING THUNDER 4-BALL ROLLER (SOLID BLACK)' },
  { sku: '200240', name: '2026 ROLLING THUNDER 4-BALL ROLLER (SOLID WHITE)' },
  { sku: '200241', name: '2026 ROLLING THUNDER 4-BALL ROLLER (CREAM)' },
  { sku: '200183', name: '2026 1-BALL SPARE KIT VOLT (COOL GRAY)' },
  { sku: '200184', name: '2026 1-BALL SPARE KIT VOLT (STEEL MINT)' },
  { sku: '200185', name: '2026 1-BALL SPARE KIT VOLT (AQUA MINT)' },
  { sku: '200186', name: '2026 1-BALL SPARE KIT VOLT (SHADOW BLACK)' },
  { sku: '200187', name: '2026 1-BALL SPARE KIT VOLT (CREAM BLACK)' },
  { sku: '200188', name: '2026 1-BALL CASTER VOLT (SHADOW BLACK)' },
  { sku: '200189', name: '2026 1-BALL CASTER VOLT (CREAM BLACK)' },
  { sku: '200190', name: '2026 2-BALL TOTE VOLT (SHADOW BLACK)' },
  { sku: '200191', name: '2026 2-BALL TOTE VOLT (CREAM BLACK)' },
  { sku: '200192', name: '2026 2-BALL ROLLER VOLT (COOL GRAY)' },
  { sku: '200193', name: '2026 2-BALL ROLLER VOLT (STEEL MINT)' },
  { sku: '200194', name: '2026 2-BALL ROLLER VOLT (AQUA MINT)' },
  { sku: '200195', name: '2026 2-BALL ROLLER VOLT (SHADOW BLACK)' },
  { sku: '200196', name: '2026 2-BALL ROLLER VOLT (CREAM BLACK)' },
  { sku: '200197', name: '2026 3-BALL TOURNAMENT VOLT (SHADOW BLACK)' },
  { sku: '200198', name: '2026 3-BALL TOURNAMENT VOLT (CREAM BLACK)' },
  { sku: '200199', name: '2026 3-BALL ROLLER VOLT (COOL GRAY)' },
  { sku: '200200', name: '2026 3-BALL ROLLER VOLT (STEEL MINT)' },
  { sku: '200201', name: '2026 3-BALL ROLLER VOLT (AQUA MINT)' },
  { sku: '200202', name: '2026 3-BALL ROLLER VOLT (SHADOW BLACK)' },
  { sku: '200203', name: '2026 3-BALL ROLLER VOLT (CREAM BLACK)' },
  { sku: '200204', name: '2026 3-BALL ROLLER PRO VOLT (SHADOW BLACK)' },
  { sku: '200205', name: '2026 3-BALL ROLLER PRO VOLT (CREAM BLACK)' },
]

async function main() {
  console.log('Seeding Bowling Bag products...')
  let created = 0, updated = 0

  for (const bag of bowlingBags) {
    const existing = await prisma.product.findUnique({ where: { sku: bag.sku } })
    await prisma.product.upsert({
      where: { sku: bag.sku },
      update: { name: bag.name, category: 'BOWLING_BAG' },
      create: {
        sku: bag.sku,
        name: bag.name,
        category: 'BOWLING_BAG',
        unitPrice: 0,
        stockQuantity: 0,
        unit: 'EA',
      },
    })
    existing ? updated++ : created++
  }

  console.log(`Done: ${created} created, ${updated} updated`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
