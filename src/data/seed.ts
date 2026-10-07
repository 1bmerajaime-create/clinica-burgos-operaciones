import type { AestheticProduct, ProductSale, Transaction } from '../types'

/**
 * Movimientos recuperados de facturas subidas por el usuario
 * (metadatos; los PDF no se persistían en el navegador).
 */
export const SEED_TRANSACTIONS: Transaction[] = [
  {
    id: 'tx-1791387702715-4whww',
    type: 'ingreso',
    areaId: 'quiron',
    specialtyId: 'oftalmologia',
    amount: 38.02,
    date: '2026-09-05',
    description: 'HM-09 Septiembre.pdf',
    invoiceFileName: 'HM-09 Septiembre.pdf',
    createdAt: '2026-10-07T15:41:42.715Z',
  },
  {
    id: 'tx-1791387648797-93a90',
    type: 'ingreso',
    areaId: 'quiron',
    specialtyId: 'oftalmologia',
    amount: 38.06,
    date: '2026-08-05',
    description: 'Factura: HM-08 Agosto.pdf',
    invoiceFileName: 'HM-08 Agosto.pdf',
    createdAt: '2026-10-07T15:40:48.797Z',
  },
  {
    id: 'tx-1791387556765-ypmya',
    type: 'ingreso',
    areaId: 'quiron',
    specialtyId: 'oftalmologia',
    amount: 330.66,
    date: '2026-07-07',
    description: 'Factura: HM-07 Julio.pdf',
    invoiceFileName: 'HM-07 Julio.pdf',
    createdAt: '2026-10-07T15:39:16.765Z',
  },
  {
    id: 'tx-1791384117160-4e5j7',
    type: 'ingreso',
    areaId: 'quiron',
    specialtyId: 'oftalmologia',
    amount: 4975.36,
    date: '2026-10-07',
    description: 'Quiron Mayo',
    invoiceFileName: '6_26.pdf',
    createdAt: '2026-10-07T14:41:57.160Z',
  },
  {
    id: 'tx-1791384010238-7c4ah',
    type: 'ingreso',
    areaId: 'quiron',
    specialtyId: 'oftalmologia',
    amount: 3604.85,
    date: '2026-10-07',
    description: 'Quiron Abril',
    invoiceFileName: '5_26 QUIRON.pdf',
    createdAt: '2026-10-07T14:40:10.238Z',
  },
]

export const SEED_PRODUCTS: AestheticProduct[] = []

export const SEED_PRODUCT_SALES: ProductSale[] = []
