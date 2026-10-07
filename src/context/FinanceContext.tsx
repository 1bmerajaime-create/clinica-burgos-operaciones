import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  SEED_PRODUCTS,
  SEED_PRODUCT_SALES,
  SEED_TRANSACTIONS,
} from '../data/seed'
import type {
  AestheticProduct,
  AreaId,
  ProductSale,
  SpecialtyId,
  Transaction,
  TransactionType,
} from '../types'

export interface NewTransactionInput {
  type: TransactionType
  areaId: AreaId
  specialtyId?: SpecialtyId
  amount: number
  date: string
  description: string
  invoiceFileName?: string
}

export interface NewProductInput {
  areaId: AreaId
  name: string
  unitCost: number
  salePrice: number
  stock: number
}

export interface NewSaleInput {
  productId: string
  quantity: number
  unitSalePrice: number
  date: string
  note?: string
  /** Si true, crea ingreso (venta) y gasto (coste) en movimientos */
  registerInFinance?: boolean
}

interface FinanceContextValue {
  transactions: Transaction[]
  products: AestheticProduct[]
  productSales: ProductSale[]
  addTransaction: (input: NewTransactionInput) => void
  updateTransaction: (id: string, input: NewTransactionInput) => void
  removeTransaction: (id: string) => void
  addProduct: (input: NewProductInput) => void
  updateProduct: (id: string, input: NewProductInput) => void
  removeProduct: (id: string) => void
  restockProduct: (id: string, quantity: number, unitCost?: number) => void
  sellProduct: (input: NewSaleInput) => void
}

const FinanceContext = createContext<FinanceContextValue | null>(null)

const TX_KEY = 'cb-operaciones-transactions-v4'
const INV_KEY = 'cb-operaciones-inventory-v2'

function loadTransactions(): Transaction[] {
  try {
    const raw = localStorage.getItem(TX_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Transaction[]
      if (Array.isArray(parsed)) return parsed
    }
  } catch {
    /* ignore */
  }
  return SEED_TRANSACTIONS
}

function loadInventory(): { products: AestheticProduct[]; sales: ProductSale[] } {
  try {
    const raw = localStorage.getItem(INV_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as {
        products?: AestheticProduct[]
        sales?: ProductSale[]
      }
      if (Array.isArray(parsed.products)) {
        return {
          products: parsed.products,
          sales: Array.isArray(parsed.sales) ? parsed.sales : [],
        }
      }
    }
  } catch {
    /* ignore */
  }
  return { products: SEED_PRODUCTS, sales: SEED_PRODUCT_SALES }
}

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export function FinanceProvider({ children }: { children: ReactNode }) {
  const initialInv = loadInventory()
  const [transactions, setTransactions] = useState<Transaction[]>(loadTransactions)
  const [products, setProducts] = useState<AestheticProduct[]>(initialInv.products)
  const [productSales, setProductSales] = useState<ProductSale[]>(initialInv.sales)

  const persistTx = useCallback((next: Transaction[]) => {
    setTransactions(next)
    localStorage.setItem(TX_KEY, JSON.stringify(next))
  }, [])

  const persistInv = useCallback(
    (nextProducts: AestheticProduct[], nextSales: ProductSale[]) => {
      setProducts(nextProducts)
      setProductSales(nextSales)
      localStorage.setItem(
        INV_KEY,
        JSON.stringify({ products: nextProducts, sales: nextSales }),
      )
    },
    [],
  )

  const addTransaction = useCallback(
    (input: NewTransactionInput) => {
      const tx: Transaction = {
        id: uid('tx'),
        ...input,
        createdAt: new Date().toISOString(),
      }
      persistTx([tx, ...transactions])
    },
    [persistTx, transactions],
  )

  const updateTransaction = useCallback(
    (id: string, input: NewTransactionInput) => {
      persistTx(
        transactions.map((t) => (t.id === id ? { ...t, ...input } : t)),
      )
    },
    [persistTx, transactions],
  )

  const removeTransaction = useCallback(
    (id: string) => {
      persistTx(transactions.filter((t) => t.id !== id))
    },
    [persistTx, transactions],
  )

  const addProduct = useCallback(
    (input: NewProductInput) => {
      const product: AestheticProduct = {
        id: uid('p'),
        ...input,
        createdAt: new Date().toISOString(),
      }
      persistInv([product, ...products], productSales)
    },
    [persistInv, products, productSales],
  )

  const updateProduct = useCallback(
    (id: string, input: NewProductInput) => {
      persistInv(
        products.map((p) => (p.id === id ? { ...p, ...input } : p)),
        productSales,
      )
    },
    [persistInv, products, productSales],
  )

  const removeProduct = useCallback(
    (id: string) => {
      persistInv(
        products.filter((p) => p.id !== id),
        productSales.filter((s) => s.productId !== id),
      )
    },
    [persistInv, products, productSales],
  )

  const restockProduct = useCallback(
    (id: string, quantity: number, unitCost?: number) => {
      if (quantity <= 0) return
      persistInv(
        products.map((p) => {
          if (p.id !== id) return p
          return {
            ...p,
            stock: p.stock + quantity,
            unitCost: unitCost ?? p.unitCost,
          }
        }),
        productSales,
      )
    },
    [persistInv, products, productSales],
  )

  const sellProduct = useCallback(
    (input: NewSaleInput) => {
      const product = products.find((p) => p.id === input.productId)
      if (!product) return
      if (input.quantity <= 0 || input.quantity > product.stock) return

      const register = input.registerInFinance !== false
      const revenue = input.unitSalePrice * input.quantity
      const cogs = product.unitCost * input.quantity
      const now = new Date().toISOString()

      let incomeTransactionId: string | undefined
      let expenseTransactionId: string | undefined
      let nextTx = transactions

      if (register) {
        incomeTransactionId = uid('tx')
        expenseTransactionId = uid('tx')
        const income: Transaction = {
          id: incomeTransactionId,
          type: 'ingreso',
          areaId: product.areaId,
          specialtyId: 'estetica',
          amount: revenue,
          date: input.date,
          description: `Venta producto: ${product.name} × ${input.quantity}`,
          createdAt: now,
        }
        const expense: Transaction = {
          id: expenseTransactionId,
          type: 'gasto',
          areaId: product.areaId,
          specialtyId: 'estetica',
          amount: cogs,
          date: input.date,
          description: `Coste producto: ${product.name} × ${input.quantity}`,
          createdAt: now,
        }
        nextTx = [income, expense, ...transactions]
        persistTx(nextTx)
      }

      const sale: ProductSale = {
        id: uid('ps'),
        productId: product.id,
        areaId: product.areaId,
        quantity: input.quantity,
        unitCost: product.unitCost,
        unitSalePrice: input.unitSalePrice,
        date: input.date,
        note: input.note,
        incomeTransactionId,
        expenseTransactionId,
        createdAt: now,
      }

      persistInv(
        products.map((p) =>
          p.id === product.id ? { ...p, stock: p.stock - input.quantity } : p,
        ),
        [sale, ...productSales],
      )
    },
    [persistInv, persistTx, productSales, products, transactions],
  )

  const value = useMemo(
    () => ({
      transactions,
      products,
      productSales,
      addTransaction,
      updateTransaction,
      removeTransaction,
      addProduct,
      updateProduct,
      removeProduct,
      restockProduct,
      sellProduct,
    }),
    [
      transactions,
      products,
      productSales,
      addTransaction,
      updateTransaction,
      removeTransaction,
      addProduct,
      updateProduct,
      removeProduct,
      restockProduct,
      sellProduct,
    ],
  )

  return (
    <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>
  )
}

export function useFinance() {
  const ctx = useContext(FinanceContext)
  if (!ctx) throw new Error('useFinance must be used within FinanceProvider')
  return ctx
}
