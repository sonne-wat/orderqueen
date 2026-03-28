import type { BatchShipment, Order, OrderItem, Product, Shipment, ShipmentRequest, ShipmentRequestOrder, User } from '@prisma/client'

export type OrderWithDetails = Order & {
  distributor: Pick<User, 'id' | 'name' | 'email' | 'company'>
  items: (OrderItem & { product: Product })[]
  shipment: Shipment | null
}

export type ProductWithLowStock = Product & {
  isLowStock: boolean
  isOutOfStock: boolean
}

export type ShipmentRequestWithDetails = ShipmentRequest & {
  distributor: Pick<User, 'id' | 'name' | 'email' | 'company'>
  orders: (ShipmentRequestOrder & {
    order: Pick<Order, 'id' | 'orderNumber' | 'status' | 'shippingMode' | 'requestedDelivery'> & {
      items: (OrderItem & { product: Pick<Product, 'id' | 'name' | 'sku'> })[]
    }
  })[]
  batchShipment: BatchShipment | null
}

export type BatchShipmentWithDetails = Omit<BatchShipment, 'palletCount' | 'cartonCount'> & {
  batchNumber: string
  palletCount: number | null
  cartonCount: number | null
  shipmentRequest: ShipmentRequest & {
    distributor: Pick<User, 'id' | 'name' | 'company'>
    orders: (ShipmentRequestOrder & {
      order: Pick<Order, 'id' | 'orderNumber' | 'status'>
    })[]
  }
  shipments: Shipment[]
}

export const CATEGORY_LABELS: Record<string, string> = {
  BOWLING_BALL:       'Bowling Ball',
  BOWLING_BAG:        'Bowling Bag',
  BOWLING_SHOES:      'Bowling Shoes',
  APPAREL:            'Apparel',
  BOWLING_ACCESSORY:  'Bowling Accessory',
}

export const CATEGORY_ORDER = [
  'BOWLING_BALL',
  'BOWLING_BAG',
  'BOWLING_SHOES',
  'APPAREL',
  'BOWLING_ACCESSORY',
] as const
