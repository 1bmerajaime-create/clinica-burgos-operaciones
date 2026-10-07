export type AreaId = 'clinica' | 'quiron' | 'cataratas'

export type SpecialtyId = 'oftalmologia' | 'estetica'

export type TransactionType = 'ingreso' | 'gasto'

export interface Area {
  id: AreaId
  name: string
  shortName: string
  description: string
  accent: string
  hasSpecialty: boolean
}

export interface Specialty {
  id: SpecialtyId
  name: string
}

export interface Transaction {
  id: string
  type: TransactionType
  areaId: AreaId
  specialtyId?: SpecialtyId
  amount: number
  date: string
  description: string
  invoiceFileName?: string
  createdAt: string
}

export interface MonthlyPoint {
  month: string
  ingresos: number
  gastos: number
  resultado: number
}

/** Producto de stock (medicina estética) */
export interface AestheticProduct {
  id: string
  areaId: AreaId
  name: string
  /** Coste unitario de adquisición */
  unitCost: number
  /** Precio de venta habitual */
  salePrice: number
  stock: number
  createdAt: string
}

export interface ProductSale {
  id: string
  productId: string
  areaId: AreaId
  quantity: number
  unitCost: number
  unitSalePrice: number
  date: string
  note?: string
  /** Movimientos financieros generados al vender */
  incomeTransactionId?: string
  expenseTransactionId?: string
  createdAt: string
}
