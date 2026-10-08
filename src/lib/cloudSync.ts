import {
  collection,
  deleteDoc,
  doc,
  getDocFromServer,
  getDocsFromServer,
  setDoc,
  type DocumentData,
} from 'firebase/firestore'
import {
  deleteObject,
  getBlob,
  listAll,
  ref,
  uploadBytes,
} from 'firebase/storage'
import type { AestheticProduct, ProductSale, Transaction } from '../types'
import { ensureCloudSession } from './auth'
import { withTimeout } from './cloudTimeout'
import {
  getDb,
  getFirebaseStorage,
  isCloudConfigured,
} from './firebase'
import {
  pullInvoiceFromFirestore,
  pushInvoiceToFirestore,
} from './invoiceCloud'
import {
  getInvoiceFile,
  listInvoiceFiles,
  saveInvoiceFile,
  type StoredInvoice,
} from './invoiceStore'

const TX_COLLECTION = 'transactions'
const INV_COLLECTION = 'inventory'
const INV_DOC_ID = 'main'

const PULL_TIMEOUT_MS = 10_000
const PUSH_TIMEOUT_MS = 20_000

const FIRESTORE_SETUP_HINT =
  'Firestore no responde. En Firebase Console → Firestore Database → Crear base de datos (modo producción), publica las reglas de firebase/firestore.rules y pulsa «Sincronizar ahora».'

function mapCloudError(err: unknown): Error {
  const message = err instanceof Error ? err.message : String(err)
  if (/not-found|NOT_FOUND/i.test(message)) {
    return new Error(FIRESTORE_SETUP_HINT)
  }
  if (/Tiempo agotado|timeout|unavailable|FAILED_PRECONDITION/i.test(message)) {
    return new Error(`${FIRESTORE_SETUP_HINT} (${message})`)
  }
  return err instanceof Error ? err : new Error(message)
}

function invoicePath(transactionId: string, fileName: string) {
  const safe = fileName.replace(/[\\/]+/g, '_')
  return `invoices/${transactionId}/${safe}`
}

/** Firestore rechaza `undefined`; hay que omitir esas claves. */
function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue
    if (Array.isArray(value)) {
      out[key] = value.map((item) =>
        item && typeof item === 'object' && !Array.isArray(item)
          ? stripUndefined(item as Record<string, unknown>)
          : item,
      )
      continue
    }
    if (value && typeof value === 'object') {
      out[key] = stripUndefined(value as Record<string, unknown>)
      continue
    }
    out[key] = value
  }
  return out as T
}

export async function cloudHasSession(): Promise<boolean> {
  return ensureCloudSession()
}

function txFromDoc(data: DocumentData): Transaction | null {
  if (!data || typeof data !== 'object') return null
  if (data.deletedAt) return null
  const { deletedAt: _d, ...rest } = data
  return rest as Transaction
}

export async function pullCloudSnapshot(): Promise<{
  transactions: Transaction[]
  products: AestheticProduct[]
  productSales: ProductSale[]
} | null> {
  const db = getDb()
  if (!db || !(await ensureCloudSession())) return null

  const snap = await withTimeout(
    getDocsFromServer(collection(db, TX_COLLECTION)),
    PULL_TIMEOUT_MS,
    'descargar movimientos',
  )
  const transactions: Transaction[] = []
  for (const d of snap.docs) {
    const tx = txFromDoc(d.data())
    if (tx) transactions.push(tx)
  }

  let products: AestheticProduct[] = []
  let productSales: ProductSale[] = []
  try {
    const invSnap = await withTimeout(
      getDocFromServer(doc(db, INV_COLLECTION, INV_DOC_ID)),
      PULL_TIMEOUT_MS,
      'descargar inventario',
    )
    const inv = invSnap.exists() ? invSnap.data() : null
    products = Array.isArray(inv?.products)
      ? (inv!.products as AestheticProduct[])
      : []
    productSales = Array.isArray(inv?.sales)
      ? (inv!.sales as ProductSale[])
      : []
  } catch {
    /* inventario opcional */
  }

  return { transactions, products, productSales }
}

/** Descarga facturas en segundo plano (no bloquea el arranque). */
export async function pullMissingInvoices(
  transactions: Transaction[],
): Promise<void> {
  if (!(await ensureCloudSession())) return
  const storage = getFirebaseStorage()

  for (const tx of transactions) {
    if (!tx.invoiceFileName) continue
    const local = await getInvoiceFile(tx.id)
    if (local) continue

    // 1) Firestore (plan Spark, sin Storage)
    try {
      const fromFs = await pullInvoiceFromFirestore(tx.id)
      if (fromFs) {
        await saveInvoiceFile(
          fromFs.transactionId,
          fromFs.blob,
          fromFs.fileName,
          fromFs.mimeType,
        )
        continue
      }
    } catch {
      /* probar Storage */
    }

    // 2) Storage si está disponible
    if (!storage) continue
    try {
      const path = invoicePath(tx.id, tx.invoiceFileName)
      const blob = await withTimeout(
        getBlob(ref(storage, path)),
        15_000,
        `factura ${tx.invoiceFileName}`,
      )
      await saveInvoiceFile(
        tx.id,
        blob,
        tx.invoiceFileName,
        tx.invoiceMimeType || blob.type,
      )
    } catch {
      /* archivo ausente o lento */
    }
  }
}

export async function pushAllToCloud(payload: {
  transactions: Transaction[]
  products: AestheticProduct[]
  productSales: ProductSale[]
}): Promise<void> {
  const db = getDb()
  if (!db || !(await ensureCloudSession())) {
    throw new Error(
      'Sin sesión en la nube. Revisa Firebase Auth y vuelve a entrar.',
    )
  }

  const now = new Date().toISOString()
  await withTimeout(
    Promise.all(
      payload.transactions.map((tx) =>
        setDoc(
          doc(db, TX_COLLECTION, tx.id),
          stripUndefined({
            ...tx,
            updatedAt: tx.updatedAt ?? now,
            deletedAt: null,
          }),
        ),
      ),
    ),
    PUSH_TIMEOUT_MS,
    'subir movimientos',
  )

  await withTimeout(
    setDoc(
      doc(db, INV_COLLECTION, INV_DOC_ID),
      stripUndefined({
        products: payload.products,
        sales: payload.productSales,
        updatedAt: now,
      }),
    ),
    PULL_TIMEOUT_MS,
    'subir inventario',
  )

  // Storage es opcional (plan Spark / bucket no creado): no tumba la sync.
  try {
    const invoices = await listInvoiceFiles()
    for (const inv of invoices) {
      try {
        await pushInvoiceToCloud(inv)
      } catch {
        /* factura concreta */
      }
    }
  } catch {
    /* sin storage */
  }
}

export async function upsertTransactionCloud(tx: Transaction): Promise<void> {
  const db = getDb()
  if (!db || !(await ensureCloudSession())) return
  const now = new Date().toISOString()
  await withTimeout(
    setDoc(
      doc(db, TX_COLLECTION, tx.id),
      stripUndefined({
        ...tx,
        updatedAt: tx.updatedAt ?? now,
        deletedAt: null,
      }),
    ),
    12_000,
    'guardar movimiento en la nube',
  )
}

export async function deleteTransactionCloud(id: string): Promise<void> {
  const db = getDb()
  const storage = getFirebaseStorage()
  if (!db || !(await ensureCloudSession())) return

  await withTimeout(
    deleteDoc(doc(db, TX_COLLECTION, id)),
    12_000,
    'borrar movimiento en la nube',
  )

  if (!storage) return
  try {
    const folder = ref(storage, `invoices/${id}`)
    const listed = await listAll(folder)
    await Promise.all(listed.items.map((item) => deleteObject(item)))
  } catch {
    /* sin archivos */
  }
}

export async function upsertInventoryCloud(
  products: AestheticProduct[],
  sales: ProductSale[],
): Promise<void> {
  const db = getDb()
  if (!db || !(await ensureCloudSession())) return
  await withTimeout(
    setDoc(
      doc(db, INV_COLLECTION, INV_DOC_ID),
      stripUndefined({
        products,
        sales,
        updatedAt: new Date().toISOString(),
      }),
    ),
    12_000,
    'guardar inventario en la nube',
  )
}

export async function pushInvoiceToCloud(inv: StoredInvoice): Promise<void> {
  if (!(await ensureCloudSession())) return

  // Preferir Firestore para no depender de activar Storage.
  try {
    await pushInvoiceToFirestore(inv)
  } catch (err) {
    console.warn('[cloud] invoice firestore upload failed', err)
  }

  const storage = getFirebaseStorage()
  if (!storage) return
  try {
    const path = invoicePath(inv.transactionId, inv.fileName)
    await withTimeout(
      uploadBytes(ref(storage, path), inv.blob, {
        contentType: inv.mimeType,
      }),
      30_000,
      'subir factura storage',
    )
  } catch {
    /* Storage opcional */
  }
}

export async function deleteInvoiceCloud(
  transactionId: string,
  fileName?: string,
): Promise<void> {
  const storage = getFirebaseStorage()
  if (!storage || !(await ensureCloudSession())) return
  try {
    if (fileName) {
      await deleteObject(ref(storage, invoicePath(transactionId, fileName)))
      return
    }
    const folder = ref(storage, `invoices/${transactionId}`)
    const listed = await listAll(folder)
    await Promise.all(listed.items.map((item) => deleteObject(item)))
  } catch {
    /* ignore */
  }
}

/**
 * La nube es la fuente de verdad cuando tiene datos.
 * Solo sube lo local si Firestore está vacío.
 */
export async function hydrateFromCloud(local: {
  transactions: Transaction[]
  products: AestheticProduct[]
  productSales: ProductSale[]
}): Promise<{
  transactions: Transaction[]
  products: AestheticProduct[]
  productSales: ProductSale[]
  source: 'cloud' | 'local' | 'merged' | 'skipped'
}> {
  if (!isCloudConfigured()) {
    return { ...local, source: 'skipped' }
  }

  const sessionOk = await ensureCloudSession()
  if (!sessionOk) {
    throw new Error(
      'No hay sesión en Firebase. Comprueba Auth (usuario técnico) y vuelve a entrar.',
    )
  }

  let remote: Awaited<ReturnType<typeof pullCloudSnapshot>>
  try {
    remote = await pullCloudSnapshot()
  } catch (err) {
    throw mapCloudError(err)
  }

  if (!remote) return { ...local, source: 'skipped' }

  const remoteEmpty =
    remote.transactions.length === 0 &&
    remote.products.length === 0 &&
    remote.productSales.length === 0

  if (!remoteEmpty) {
    return { ...remote, source: 'cloud' }
  }

  if (local.transactions.length > 0 || local.products.length > 0) {
    try {
      await pushAllToCloud(local)
    } catch (err) {
      throw mapCloudError(err)
    }
    return { ...local, source: 'local' }
  }

  return { ...local, source: 'local' }
}

const LAST_SYNC_KEY = 'cb-operaciones-last-cloud-sync'

export function getLastSyncedAt(): string | null {
  try {
    return localStorage.getItem(LAST_SYNC_KEY)
  } catch {
    return null
  }
}

export function setLastSyncedAt(iso: string = new Date().toISOString()) {
  try {
    localStorage.setItem(LAST_SYNC_KEY, iso)
  } catch {
    /* ignore */
  }
}
