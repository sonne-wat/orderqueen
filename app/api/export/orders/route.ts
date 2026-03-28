import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import ExcelJS from 'exceljs'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session || session.user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  const orders = await prisma.order.findMany({
    where: {
      ...(status ? { status: status as never } : {}),
      ...(from || to
        ? { createdAt: { gte: from ? new Date(from) : undefined, lte: to ? new Date(to) : undefined } }
        : {}),
    },
    include: {
      distributor: { select: { name: true, company: true } },
      items: { include: { product: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Orders')

  sheet.columns = [
    { header: '주문번호', key: 'orderNumber', width: 20 },
    { header: 'Distributor', key: 'distributor', width: 20 },
    { header: '회사', key: 'company', width: 20 },
    { header: '제출일', key: 'createdAt', width: 15 },
    { header: '납기 요청일', key: 'requestedDelivery', width: 15 },
    { header: '선적모드', key: 'shippingMode', width: 10 },
    { header: 'SKU', key: 'sku', width: 12 },
    { header: '제품명', key: 'productName', width: 20 },
    { header: '요청수량', key: 'requestedQty', width: 10 },
    { header: '단가(USD)', key: 'unitPrice', width: 12 },
    { header: '소계', key: 'subtotal', width: 12 },
  ]

  // Header style
  sheet.getRow(1).font = { bold: true }
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } }

  for (const order of orders) {
    for (const item of order.items) {
      const unitPrice = Number(item.unitPrice)
      sheet.addRow({
        orderNumber: order.orderNumber,
        distributor: order.distributor.name,
        company: order.distributor.company ?? '',
        createdAt: order.createdAt.toISOString().split('T')[0],
        requestedDelivery: order.requestedDelivery?.toISOString().split('T')[0] ?? '',
        shippingMode: order.shippingMode ?? '',
        sku: item.product.sku,
        productName: item.product.name,
        requestedQty: item.requestedQty,
        unitPrice,
        subtotal: unitPrice * item.requestedQty,
      })
    }
  }

  const buffer = await workbook.xlsx.writeBuffer()

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="orders-${new Date().toISOString().split('T')[0]}.xlsx"`,
    },
  })
}
