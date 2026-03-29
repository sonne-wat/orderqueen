import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  // Admin 계정
  const adminPassword = await bcrypt.hash('admin1234', 10)
  await prisma.user.upsert({
    where: { email: 'admin@orderqueen.com' },
    update: {},
    create: {
      email: 'admin@orderqueen.com',
      password: adminPassword,
      name: 'Admin',
      company: 'Orderqueen',
      role: 'ADMIN',
      status: 'ACTIVE',
    },
  })

  // 샘플 Distributor
  const distPassword = await bcrypt.hash('dist1234', 10)
  await prisma.user.upsert({
    where: { email: 'distributor@example.com' },
    update: {},
    create: {
      email: 'distributor@example.com',
      password: distPassword,
      name: 'Hong Gil-dong',
      company: 'ABC Trading Co.',
      role: 'DISTRIBUTOR',
      status: 'ACTIVE',
    },
  })

  // 샘플 Products
  const products = [
    { sku: 'PRD-001', name: 'Widget A', unitPrice: 25.0, stockQuantity: 5, lowStockThreshold: 10 },
    { sku: 'PRD-002', name: 'Widget B', unitPrice: 40.0, stockQuantity: 200, lowStockThreshold: 20 },
    { sku: 'PRD-003', name: 'Gadget X', unitPrice: 120.0, stockQuantity: 8, lowStockThreshold: 15 },
    { sku: 'PRD-004', name: 'Gadget Y', unitPrice: 85.0, stockQuantity: 50, lowStockThreshold: 10 },
    { sku: 'PRD-005', name: 'Component Z', unitPrice: 12.5, stockQuantity: 500, lowStockThreshold: 50 },
  ]

  for (const p of products) {
    await prisma.product.upsert({
      where: { sku: p.sku },
      update: {},
      create: { ...p, currency: 'USD', unit: 'EA' },
    })
  }

  console.log('Seed completed.')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
