import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { renderToBuffer, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: 'Helvetica' },
  title: { fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
  section: { marginBottom: 12 },
  row: { flexDirection: 'row', marginBottom: 4 },
  label: { width: 140, fontWeight: 'bold' },
  tableHeader: { flexDirection: 'row', backgroundColor: '#E9ECEF', padding: 4, fontWeight: 'bold' },
  tableRow: { flexDirection: 'row', padding: 4, borderBottomWidth: 0.5, borderBottomColor: '#CCC' },
  col1: { width: '15%' },
  col2: { width: '30%' },
  col3: { width: '15%', textAlign: 'right' },
  col4: { width: '15%', textAlign: 'right' },
  col5: { width: '15%', textAlign: 'right' },
  col6: { width: '10%', textAlign: 'center' },
  total: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8, fontWeight: 'bold' },
})

export async function GET(_: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  const session = await auth()
  if (!session || session.user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { orderId } = await params
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      distributor: true,
      items: { include: { product: true } },
    },
  })

  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const acceptedItems = order.items.filter((i) => i.decision === 'ACCEPTED' || i.decision === null)
  const total = acceptedItems.reduce((sum, i) => sum + Number(i.unitPrice) * (i.confirmedQty ?? i.requestedQty), 0)

  const pdf = await renderToBuffer(
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>ORDER CONFIRMATION SHEET</Text>

        <View style={styles.section}>
          <View style={styles.row}><Text style={styles.label}>Order Number:</Text><Text>{order.orderNumber}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Date:</Text><Text>{new Date().toLocaleDateString()}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Distributor:</Text><Text>{order.distributor.name} ({order.distributor.company})</Text></View>
          <View style={styles.row}><Text style={styles.label}>Requested Delivery:</Text><Text>{order.requestedDelivery?.toLocaleDateString() ?? '-'}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Shipping Mode:</Text><Text>{order.shippingMode ?? '-'}</Text></View>
          {order.packageType && <View style={styles.row}><Text style={styles.label}>Package Type:</Text><Text>{order.packageType}</Text></View>}
          {order.incoterms && <View style={styles.row}><Text style={styles.label}>Incoterms:</Text><Text>{order.incoterms}</Text></View>}
        </View>

        <View style={styles.tableHeader}>
          <Text style={styles.col1}>SKU</Text>
          <Text style={styles.col2}>Product</Text>
          <Text style={styles.col3}>Req Qty</Text>
          <Text style={styles.col4}>Conf Qty</Text>
          <Text style={styles.col5}>Unit Price</Text>
          <Text style={styles.col6}>Subtotal</Text>
        </View>

        {acceptedItems.map((item) => (
          <View key={item.id} style={styles.tableRow}>
            <Text style={styles.col1}>{item.product.sku}</Text>
            <Text style={styles.col2}>{item.product.name}</Text>
            <Text style={styles.col3}>{item.requestedQty}</Text>
            <Text style={styles.col4}>{item.confirmedQty ?? item.requestedQty}</Text>
            <Text style={styles.col5}>${Number(item.unitPrice).toFixed(2)}</Text>
            <Text style={styles.col6}>${(Number(item.unitPrice) * (item.confirmedQty ?? item.requestedQty)).toFixed(2)}</Text>
          </View>
        ))}

        <View style={styles.total}>
          <Text>Total Amount: ${total.toFixed(2)} USD</Text>
        </View>
      </Page>
    </Document>
  )

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="confirmation-${order.orderNumber}.pdf"`,
    },
  })
}
