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
  /**
   * Base imponible (sin IVA). Es el importe usado en balances de
   * ingresos/gastos para no tratar el IVA como beneficio.
   */
  amount: number
  /** Base imponible (sin IVA) */
  netAmount?: number
  /** Cuota de IVA */
  vatAmount?: number
  /** Total con IVA */
  grossAmount?: number
  /**
   * Tipo IVA aplicado (fracción, p.ej. 0.15).
   * Configurable por operación; 0 si está exenta.
   * Los valores por defecto (15 % / 21 %) son provisionales.
   */
  vatRate?: number
  /** Operación exenta de IVA */
  vatExempt?: boolean
  /**
   * true: el importe introducido es el total (incluye IVA) → se desglosa.
   * false/undefined: el importe es la base → IVA = importe × tipo.
   */
  amountIncludesVat?: boolean
  /**
   * Solo gastos: si el IVA soportado es deducible.
   * No se asume siempre deducible; por defecto true al crear salvo que se indique.
   */
  vatDeductible?: boolean
  /** Solo gastos: fracción deducible 0–1 (si no se indica y vatDeductible, 1) */
  vatDeductibleShare?: number
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
