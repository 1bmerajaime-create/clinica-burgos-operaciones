import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  SEED_PRODUCTS,
  SEED_PRODUCT_SALES,
  SEED_TRANSACTIONS,
} from '../data/seed'
import { applyBackupPayload, type BackupPayload } from '../lib/backupArchive'
import {
  deleteInvoiceCloud,
  deleteTransactionCloud,
  getLastSyncedAt,
  hydrateFromCloud,
  pullMissingInvoices,
  pushAllToCloud,
  pushInvoiceToCloud,
  setLastSyncedAt,
  upsertInventoryCloud,
  upsertTransactionCloud,
} from '../lib/cloudSync'
import {
  deleteInvoiceFile,
  getInvoiceFile,
  saveInvoiceFile,
} from '../lib/invoiceStore'
import { isCloudConfigured } from '../lib/firebase'
import {
  defaultVatRateFor,
  defaultVatSettings,
  migrateHospitalVatToIrpf,
  normalizeVatTransaction,
  reinterpretAsVatFromTotal,
  resolveIrpfAmount,
  resolveVatAmounts,
} from '../lib/vat'
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
  netAmount?: number
  vatAmount?: number
  grossAmount?: number
  vatRate?: number
  vatExempt?: boolean
  amountIncludesVat?: boolean
  vatDeductible?: boolean
  vatDeductibleShare?: number
  irpfRate?: number
  irpfAmount?: number
  date: string
  description: string
  invoiceFileName?: string
  invoiceMimeType?: string
  /** Archivo de factura a persistir (no se serializa en localStorage). */
  invoiceFile?: Blob
  /** Si true, elimina la factura guardada del movimiento. */
  clearInvoice?: boolean
}

function withVatFields(input: NewTransactionInput): NewTransactionInput {
  const exempt = Boolean(input.vatExempt) || input.vatRate === 0
  const vatRate = exempt
    ? 0
    : (input.vatRate ?? defaultVatRateFor(input.type))
  // Por defecto: el importe es el total con IVA incluido
  const amountIncludesVat = input.amountIncludesVat !== false
  const breakdown = resolveVatAmounts({
    amount: input.amount,
    vatRate,
    amountIncludesVat,
  })
  const irpfRate =
    input.irpfRate != null && input.irpfRate > 0 ? input.irpfRate : undefined
  const irpfAmount =
    irpfRate != null
      ? (input.irpfAmount ??
        resolveIrpfAmount({
          baseAmount: breakdown.netAmount,
          irpfRate,
        }))
      : input.irpfAmount
  return normalizeVatTransaction({
    ...input,
    ...breakdown,
    amount: breakdown.netAmount,
    vatRate,
    vatExempt: exempt,
    amountIncludesVat,
    irpfRate,
    irpfAmount,
  })
}

function normalizeTransaction(tx: Transaction): Transaction {
  return normalizeVatTransaction(migrateHospitalVatToIrpf(tx))
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
  ready: boolean
  cloudEnabled: boolean
  lastSyncedAt: string | null
  syncError: string | null
  transactions: Transaction[]
  products: AestheticProduct[]
  productSales: ProductSale[]
  addTransaction: (input: NewTransactionInput) => Promise<void>
  updateTransaction: (id: string, input: NewTransactionInput) => Promise<void>
  removeTransaction: (id: string) => Promise<void>
  addProduct: (input: NewProductInput) => void
  updateProduct: (id: string, input: NewProductInput) => void
  removeProduct: (id: string) => void
  restockProduct: (id: string, quantity: number, unitCost?: number) => void
  sellProduct: (input: NewSaleInput) => void
  replaceAllData: (payload: BackupPayload) => Promise<void>
  syncNow: () => Promise<void>
}

const FinanceContext = createContext<FinanceContextValue | null>(null)

const TX_KEY = 'cb-operaciones-transactions-v16'
const TX_KEY_PREFIX = 'cb-operaciones-transactions-v'
const INV_KEY = 'cb-operaciones-inventory-v4'

function persistMigrated(txs: Transaction[]): Transaction[] {
  localStorage.setItem(TX_KEY, JSON.stringify(txs))
  return txs
}

/** Busca la clave local más reciente (incl. v4…v15) para no perder datos. */
function findLegacyTransactionKey(): string | null {
  try {
    let bestKey: string | null = null
    let bestVer = -1
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key || !key.startsWith(TX_KEY_PREFIX) || key === TX_KEY) continue
      const ver = Number(key.slice(TX_KEY_PREFIX.length))
      if (!Number.isFinite(ver)) continue
      if (ver > bestVer) {
        bestVer = ver
        bestKey = key
      }
    }
    return bestKey
  } catch {
    return null
  }
}

function loadTransactions(): Transaction[] {
  try {
    const raw = localStorage.getItem(TX_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Transaction[]
      if (Array.isArray(parsed)) return parsed.map(normalizeTransaction)
    }
  } catch {
    /* ignore */
  }

  const legacyKey = findLegacyTransactionKey()
  if (legacyKey) {
    try {
      const legacy = localStorage.getItem(legacyKey)
      if (legacy) {
        const parsed = JSON.parse(legacy) as Transaction[]
        if (Array.isArray(parsed) && parsed.length > 0) {
          return persistMigrated(
            parsed.map((tx) =>
              normalizeTransaction(reinterpretAsVatFromTotal(tx)),
            ),
          )
        }
      }
    } catch {
      /* fall through */
    }
  }

  return SEED_TRANSACTIONS.map((tx) =>
    normalizeTransaction(reinterpretAsVatFromTotal(tx)),
  )
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

function touch(tx: Transaction): Transaction {
  return { ...tx, updatedAt: new Date().toISOString() }
}

async function cloudQuiet(fn: () => Promise<void>) {
  try {
    await fn()
    setLastSyncedAt()
  } catch (err) {
    console.warn('[cloud]', err)
    throw err
  }
}

export function FinanceProvider({ children }: { children: ReactNode }) {
  const initialInv = loadInventory()
  const [transactions, setTransactions] = useState<Transaction[]>(loadTransactions)
  const [products, setProducts] = useState<AestheticProduct[]>(initialInv.products)
  const [productSales, setProductSales] = useState<ProductSale[]>(initialInv.sales)
  const [ready, setReady] = useState(!isCloudConfigured())
  const [lastSyncedAt, setLastSynced] = useState<string | null>(getLastSyncedAt)
  const [syncError, setSyncError] = useState<string | null>(null)
  const cloudEnabled = isCloudConfigured()

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

  useEffect(() => {
    if (!cloudEnabled) return
    let cancelled = false

    ;(async () => {
      try {
        const localInv = loadInventory()
        const hydrated = await hydrateFromCloud({
          transactions: loadTransactions(),
          products: localInv.products,
          productSales: localInv.sales,
        })
        if (cancelled) return
        if (
          hydrated.source === 'cloud' ||
          hydrated.source === 'merged' ||
          hydrated.source === 'local'
        ) {
          const txs = hydrated.transactions.map(normalizeTransaction)
          persistTx(txs)
          persistInv(hydrated.products, hydrated.productSales)
          void pullMissingInvoices(txs).catch(() => {
            /* no bloquear */
          })
        }
        const at = new Date().toISOString()
        setLastSyncedAt(at)
        setLastSynced(at)
        setSyncError(null)
      } catch (err) {
        if (!cancelled) {
          setSyncError(
            err instanceof Error ? err.message : 'Error al sincronizar',
          )
        }
      } finally {
        if (!cancelled) setReady(true)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [cloudEnabled, persistInv, persistTx])

  const syncNow = useCallback(async () => {
    if (!cloudEnabled) return
    setSyncError(null)
    try {
      await pushAllToCloud({ transactions, products, productSales })
      const at = new Date().toISOString()
      setLastSyncedAt(at)
      setLastSynced(at)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error al sincronizar'
      setSyncError(message)
      throw err
    }
  }, [cloudEnabled, products, productSales, transactions])

  const replaceAllData = useCallback(
    async (payload: BackupPayload) => {
      await applyBackupPayload(payload)
      const txs = payload.transactions.map(normalizeTransaction)
      persistTx(txs)
      persistInv(payload.products, payload.productSales)
      if (cloudEnabled) {
        try {
          await pushAllToCloud({
            transactions: txs,
            products: payload.products,
            productSales: payload.productSales,
          })
          const at = new Date().toISOString()
          setLastSyncedAt(at)
          setLastSynced(at)
          setSyncError(null)
        } catch (err) {
          setSyncError(
            err instanceof Error ? err.message : 'Error al subir a la nube',
          )
        }
      }
    },
    [cloudEnabled, persistInv, persistTx],
  )

  const addTransaction = useCallback(
    async (input: NewTransactionInput) => {
      const { invoiceFile, clearInvoice: _clear, ...rest } = input
      const id = uid('tx')
      const fields = withVatFields(rest)
      const now = new Date().toISOString()
      const tx: Transaction = touch({
        id,
        ...fields,
        invoiceFileName: fields.invoiceFileName,
        invoiceMimeType:
          fields.invoiceMimeType ||
          (invoiceFile ? invoiceFile.type || undefined : undefined),
        createdAt: now,
      })
      if (invoiceFile && tx.invoiceFileName) {
        await saveInvoiceFile(
          id,
          invoiceFile,
          tx.invoiceFileName,
          tx.invoiceMimeType,
        )
      }
      const next = [tx, ...transactions]
      persistTx(next)
      if (cloudEnabled) {
        try {
          await cloudQuiet(async () => {
            await upsertTransactionCloud(tx)
            if (invoiceFile && tx.invoiceFileName) {
              const stored = await getInvoiceFile(id)
              if (stored) await pushInvoiceToCloud(stored)
            }
          })
          setLastSynced(getLastSyncedAt())
          setSyncError(null)
        } catch (err) {
          setSyncError(
            err instanceof Error ? err.message : 'Error al sincronizar',
          )
        }
      }
    },
    [cloudEnabled, persistTx, transactions],
  )

  const updateTransaction = useCallback(
    async (id: string, input: NewTransactionInput) => {
      const { invoiceFile, clearInvoice, ...rest } = input
      const prev = transactions.find((t) => t.id === id)
      const fields = withVatFields(rest)

      if (clearInvoice) {
        await deleteInvoiceFile(id)
        if (cloudEnabled) {
          try {
            await deleteInvoiceCloud(id, prev?.invoiceFileName)
          } catch {
            /* local already cleared */
          }
        }
        fields.invoiceFileName = undefined
        fields.invoiceMimeType = undefined
      } else if (invoiceFile && fields.invoiceFileName) {
        await saveInvoiceFile(
          id,
          invoiceFile,
          fields.invoiceFileName,
          fields.invoiceMimeType || invoiceFile.type || undefined,
        )
        fields.invoiceMimeType =
          fields.invoiceMimeType || invoiceFile.type || undefined
      } else {
        fields.invoiceFileName =
          fields.invoiceFileName ?? prev?.invoiceFileName
        fields.invoiceMimeType =
          fields.invoiceMimeType ?? prev?.invoiceMimeType
      }

      if (!prev) return
      const updated = touch({ ...prev, ...fields, id })
      const next = transactions.map((t) => (t.id === id ? updated : t))
      persistTx(next)

      if (cloudEnabled) {
        try {
          await cloudQuiet(async () => {
            await upsertTransactionCloud(updated)
            if (invoiceFile && updated.invoiceFileName) {
              const stored = await getInvoiceFile(id)
              if (stored) await pushInvoiceToCloud(stored)
            }
          })
          setLastSynced(getLastSyncedAt())
          setSyncError(null)
        } catch (err) {
          setSyncError(
            err instanceof Error ? err.message : 'Error al sincronizar',
          )
        }
      }
    },
    [cloudEnabled, persistTx, transactions],
  )

  const removeTransaction = useCallback(
    async (id: string) => {
      const prev = transactions.find((t) => t.id === id)
      await deleteInvoiceFile(id)
      persistTx(transactions.filter((t) => t.id !== id))
      if (cloudEnabled) {
        try {
          await cloudQuiet(async () => {
            await deleteTransactionCloud(id)
            await deleteInvoiceCloud(id, prev?.invoiceFileName)
          })
          setLastSynced(getLastSyncedAt())
          setSyncError(null)
        } catch (err) {
          setSyncError(
            err instanceof Error ? err.message : 'Error al sincronizar',
          )
        }
      }
    },
    [cloudEnabled, persistTx, transactions],
  )

  const pushInvCloud = useCallback(
    (nextProducts: AestheticProduct[], nextSales: ProductSale[]) => {
      if (!cloudEnabled) return
      void cloudQuiet(() => upsertInventoryCloud(nextProducts, nextSales))
        .then(() => {
          setLastSynced(getLastSyncedAt())
          setSyncError(null)
        })
        .catch((err) => {
          setSyncError(
            err instanceof Error ? err.message : 'Error al sincronizar',
          )
        })
    },
    [cloudEnabled],
  )

  const addProduct = useCallback(
    (input: NewProductInput) => {
      const product: AestheticProduct = {
        id: uid('p'),
        ...input,
        createdAt: new Date().toISOString(),
      }
      const nextProducts = [product, ...products]
      persistInv(nextProducts, productSales)
      pushInvCloud(nextProducts, productSales)
    },
    [persistInv, products, productSales, pushInvCloud],
  )

  const updateProduct = useCallback(
    (id: string, input: NewProductInput) => {
      const nextProducts = products.map((p) =>
        p.id === id ? { ...p, ...input } : p,
      )
      persistInv(nextProducts, productSales)
      pushInvCloud(nextProducts, productSales)
    },
    [persistInv, products, productSales, pushInvCloud],
  )

  const removeProduct = useCallback(
    (id: string) => {
      const nextProducts = products.filter((p) => p.id !== id)
      const nextSales = productSales.filter((s) => s.productId !== id)
      persistInv(nextProducts, nextSales)
      pushInvCloud(nextProducts, nextSales)
    },
    [persistInv, products, productSales, pushInvCloud],
  )

  const restockProduct = useCallback(
    (id: string, quantity: number, unitCost?: number) => {
      if (quantity <= 0) return
      const nextProducts = products.map((p) => {
        if (p.id !== id) return p
        return {
          ...p,
          stock: p.stock + quantity,
          unitCost: unitCost ?? p.unitCost,
        }
      })
      persistInv(nextProducts, productSales)
      pushInvCloud(nextProducts, productSales)
    },
    [persistInv, products, productSales, pushInvCloud],
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
        const incomeVat = defaultVatSettings({
          type: 'ingreso',
          areaId: product.areaId,
          specialtyId: 'estetica',
        })
        const incomeBreakdown = resolveVatAmounts({
          amount: revenue,
          vatRate: incomeVat.vatExempt ? 0 : incomeVat.vatRate,
          amountIncludesVat: true,
        })
        const expenseBreakdown = resolveVatAmounts({
          amount: cogs,
          vatRate: defaultVatRateFor('gasto'),
          amountIncludesVat: true,
        })
        const income: Transaction = touch(
          normalizeVatTransaction({
            id: incomeTransactionId,
            type: 'ingreso',
            areaId: product.areaId,
            specialtyId: 'estetica' as const,
            amount: incomeBreakdown.netAmount,
            ...incomeBreakdown,
            vatExempt: incomeVat.vatExempt,
            amountIncludesVat: true,
            date: input.date,
            description: `Venta producto: ${product.name} × ${input.quantity}`,
            createdAt: now,
          }),
        )
        const expense: Transaction = touch(
          normalizeVatTransaction({
            id: expenseTransactionId,
            type: 'gasto',
            areaId: product.areaId,
            specialtyId: 'estetica' as const,
            amount: expenseBreakdown.netAmount,
            ...expenseBreakdown,
            amountIncludesVat: true,
            vatDeductible: true,
            vatDeductibleShare: 1,
            date: input.date,
            description: `Coste producto: ${product.name} × ${input.quantity}`,
            createdAt: now,
          }),
        )
        nextTx = [income, expense, ...transactions]
        persistTx(nextTx)
        if (cloudEnabled) {
          void cloudQuiet(async () => {
            await upsertTransactionCloud(income)
            await upsertTransactionCloud(expense)
          })
            .then(() => {
              setLastSynced(getLastSyncedAt())
              setSyncError(null)
            })
            .catch((err) => {
              setSyncError(
                err instanceof Error ? err.message : 'Error al sincronizar',
              )
            })
        }
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

      const nextProducts = products.map((p) =>
        p.id === product.id ? { ...p, stock: p.stock - input.quantity } : p,
      )
      const nextSales = [sale, ...productSales]
      persistInv(nextProducts, nextSales)
      pushInvCloud(nextProducts, nextSales)
    },
    [
      cloudEnabled,
      persistInv,
      persistTx,
      productSales,
      products,
      pushInvCloud,
      transactions,
    ],
  )

  const value = useMemo(
    () => ({
      ready,
      cloudEnabled,
      lastSyncedAt,
      syncError,
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
      replaceAllData,
      syncNow,
    }),
    [
      ready,
      cloudEnabled,
      lastSyncedAt,
      syncError,
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
      replaceAllData,
      syncNow,
    ],
  )

  if (!ready) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-ink-muted">
        Sincronizando datos…
      </div>
    )
  }

  return (
    <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>
  )
}

export function useFinance() {
  const ctx = useContext(FinanceContext)
  if (!ctx) throw new Error('useFinance must be used within FinanceProvider')
  return ctx
}
