import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { renderToBuffer, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: 'Helvetica' },
  title: { fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
  invoiceNum: { textAlign: 'center', marginBottom: 16, color: '#555' },
  section: { marginBottom: 12 },
  row: { flexDirection: 'row', marginBottom: 4 },
  label: { width: 140, fontWeight: 'bold' },
  tableHeader: { flexDirection: 'row', backgroundColor: '#E9ECEF', padding: 4, fontWeight: 'bold' },
  tableRow: { flexDirection: 'row', padding: 4, borderBottomWidth: 0.5, borderBottomColor: '#CCC' },
  col1: { width: '15%' },
  col2: { width: '35%' },
  col3: { width: '15%', textAlign: 'right' },
  col4: { width: '15%', textAlign: 'right' },
  col5: { width: '20%', textAlign: 'right' },
  totalsSection: { marginTop: 12, alignItems: 'flex-end' },
  totalRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 2 },
  totalLabel: { width: 100 },
  totalValue: { width: 80, textAlign: 'right' },
  grandTotal: { fontWeight: 'bold', fontSize: 12, marginTop: 4 },
  terms: { marginTop: 20, fontSize: 9, color: '#666' },
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
      shipment: true,
    },
  })

  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const acceptedItems = order.items.filter((i) => i.decision === 'ACCEPTED')
  const subtotal = acceptedItems.reduce((sum, i) => sum + Number(i.unitPrice) * (i.confirmedQty ?? i.requestedQty), 0)
  const invoiceNumber = `INV-${order.orderNumber}`

  const pdf = await renderToBuffer(
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>INVOICE</Text>
        <Text style={styles.invoiceNum}>{invoiceNumber}</Text>

        <View style={styles.section}>
          <View style={styles.row}><Text style={styles.label}>Invoice Date:</Text><Text>{new Date().toLocaleDateString()}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Order Number:</Text><Text>{order.orderNumber}</Text></View>
          {order.incoterms && <View style={styles.row}><Text style={styles.label}>Incoterms:</Text><Text>{order.incoterms}</Text></View>}
          {order.packageType && <View style={styles.row}><Text style={styles.label}>Package Type:</Text><Text>{order.packageType}</Text></View>}
          {order.shipment?.cbm && <View style={styles.row}><Text style={styles.label}>CBM (m³):</Text><Text>{String(order.shipment.cbm)}</Text></View>}
        </View>

        <View style={styles.section}>
          <View style={styles.row}><Text style={styles.label}>Bill To:</Text></View>
          <Text>{order.distributor.name}</Text>
          <Text>{order.distributor.company ?? ''}</Text>
          <Text>{order.distributor.email}</Text>
        </View>

        <View style={styles.tableHeader}>
          <Text style={styles.col1}>SKU</Text>
          <Text style={styles.col2}>Description</Text>
          <Text style={styles.col3}>Qty</Text>
          <Text style={styles.col4}>Unit Price</Text>
          <Text style={styles.col5}>Amount</Text>
        </View>

        {acceptedItems.map((item) => (
          <View key={item.id} style={styles.tableRow}>
            <Text style={styles.col1}>{item.product.sku}</Text>
            <Text style={styles.col2}>{item.product.name}</Text>
            <Text style={styles.col3}>{item.confirmedQty ?? item.requestedQty}</Text>
            <Text style={styles.col4}>${Number(item.unitPrice).toFixed(2)}</Text>
            <Text style={styles.col5}>${(Number(item.unitPrice) * (item.confirmedQty ?? item.requestedQty)).toFixed(2)}</Text>
          </View>
        ))}

        <View style={styles.totalsSection}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal:</Text>
            <Text style={styles.totalValue}>${subtotal.toFixed(2)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Tax (0%):</Text>
            <Text style={styles.totalValue}>$0.00</Text>
          </View>
          <View style={[styles.totalRow, styles.grandTotal]}>
            <Text style={styles.totalLabel}>Total (USD):</Text>
            <Text style={styles.totalValue}>${subtotal.toFixed(2)}</Text>
          </View>
        </View>

        <Text style={styles.terms}>Payment Terms: As agreed. This invoice is generated automatically by Orderqueen.</Text>
      </Page>
    </Document>
  )

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${invoiceNumber}.pdf"`,
    },
  })
}
