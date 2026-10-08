const DB_NAME = 'cb-operaciones-invoices'
const DB_VERSION = 1
const STORE = 'files'

export interface StoredInvoice {
  transactionId: string
  fileName: string
  mimeType: string
  blob: Blob
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'transactionId' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'))
  })
}

export async function saveInvoiceFile(
  transactionId: string,
  file: Blob,
  fileName: string,
  mimeType?: string,
): Promise<void> {
  const db = await openDb()
  const record: StoredInvoice = {
    transactionId,
    fileName,
    mimeType: mimeType || file.type || 'application/octet-stream',
    blob: file,
  }
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(record)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('Invoice save failed'))
  })
  db.close()
}

export async function getInvoiceFile(
  transactionId: string,
): Promise<StoredInvoice | null> {
  const db = await openDb()
  const result = await new Promise<StoredInvoice | null>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(transactionId)
    req.onsuccess = () => resolve((req.result as StoredInvoice) ?? null)
    req.onerror = () => reject(req.error ?? new Error('Invoice read failed'))
  })
  db.close()
  return result
}

export async function listInvoiceFiles(): Promise<StoredInvoice[]> {
  const db = await openDb()
  const result = await new Promise<StoredInvoice[]>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).getAll()
    req.onsuccess = () => resolve((req.result as StoredInvoice[]) ?? [])
    req.onerror = () => reject(req.error ?? new Error('Invoice list failed'))
  })
  db.close()
  return result
}

export async function replaceAllInvoiceFiles(
  records: StoredInvoice[],
): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    store.clear()
    for (const record of records) {
      store.put(record)
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('Invoice replace failed'))
  })
  db.close()
}

export async function deleteInvoiceFile(transactionId: string): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(transactionId)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('Invoice delete failed'))
  })
  db.close()
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function isImageMime(mime: string) {
  return mime.startsWith('image/')
}

export function isPdfMime(mime: string, fileName?: string) {
  return (
    mime === 'application/pdf' ||
    Boolean(fileName?.toLowerCase().endsWith('.pdf'))
  )
}
