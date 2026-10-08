import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  writeBatch,
} from 'firebase/firestore'
import { getDb } from './firebase'
import { withTimeout } from './cloudTimeout'
import { ensureCloudSession } from './auth'
import {
  getInvoiceFile,
  saveInvoiceFile,
  type StoredInvoice,
} from './invoiceStore'

const ROOT = 'invoice_files'
/** Margen bajo el límite ~1 MiB de Firestore. */
const CHUNK_BYTES = 500_000

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

function base64ToUint8(b64: string): Uint8Array {
  const binary = atob(b64)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
  return out
}

async function blobToUint8(blob: Blob): Promise<Uint8Array> {
  const buf = await blob.arrayBuffer()
  return new Uint8Array(buf)
}

/** Sube una factura a Firestore (sin depender de Storage). */
export async function pushInvoiceToFirestore(
  inv: StoredInvoice,
): Promise<void> {
  const db = getDb()
  if (!db || !(await ensureCloudSession())) {
    throw new Error('Sin sesión para subir facturas')
  }

  const bytes = await blobToUint8(inv.blob)
  const chunkCount = Math.max(1, Math.ceil(bytes.length / CHUNK_BYTES) || 1)
  const metaRef = doc(db, ROOT, inv.transactionId)

  await withTimeout(
    setDoc(metaRef, {
      transactionId: inv.transactionId,
      fileName: inv.fileName,
      mimeType: inv.mimeType,
      size: bytes.length,
      chunkCount,
      updatedAt: new Date().toISOString(),
    }),
    15_000,
    'subir meta factura',
  )

  // Batches de hasta ~400 ops; aquí bastan pocos chunks.
  let batch = writeBatch(db)
  let ops = 0
  for (let i = 0; i < chunkCount; i++) {
    const slice = bytes.subarray(i * CHUNK_BYTES, (i + 1) * CHUNK_BYTES)
    const chunkRef = doc(collection(metaRef, 'chunks'), String(i))
    batch.set(chunkRef, { index: i, data: uint8ToBase64(slice) })
    ops++
    if (ops >= 400) {
      await withTimeout(batch.commit(), 30_000, 'subir chunks factura')
      batch = writeBatch(db)
      ops = 0
    }
  }
  if (ops > 0) {
    await withTimeout(batch.commit(), 30_000, 'subir chunks factura')
  }
}

/** Descarga una factura desde Firestore si existe. */
export async function pullInvoiceFromFirestore(
  transactionId: string,
): Promise<StoredInvoice | null> {
  const db = getDb()
  if (!db || !(await ensureCloudSession())) return null

  const metaRef = doc(db, ROOT, transactionId)
  const metaSnap = await withTimeout(
    getDoc(metaRef),
    12_000,
    'meta factura',
  )
  if (!metaSnap.exists()) return null
  const meta = metaSnap.data()
  const chunkCount = Number(meta.chunkCount || 0)
  if (!chunkCount || !meta.fileName) return null

  const chunksSnap = await withTimeout(
    getDocs(collection(metaRef, 'chunks')),
    30_000,
    'chunks factura',
  )
  const byIndex = new Map<number, string>()
  for (const d of chunksSnap.docs) {
    const data = d.data()
    byIndex.set(Number(data.index ?? d.id), String(data.data || ''))
  }

  const parts: Uint8Array[] = []
  let total = 0
  for (let i = 0; i < chunkCount; i++) {
    const b64 = byIndex.get(i)
    if (!b64) return null
    const part = base64ToUint8(b64)
    parts.push(part)
    total += part.length
  }
  const merged = new Uint8Array(total)
  let offset = 0
  for (const part of parts) {
    merged.set(part, offset)
    offset += part.length
  }

  const mimeType =
    (meta.mimeType as string) || 'application/octet-stream'
  // Safari necesita un ArrayBuffer “propio”, no un view suelto.
  const buffer = merged.buffer.slice(
    merged.byteOffset,
    merged.byteOffset + merged.byteLength,
  )
  return {
    transactionId,
    fileName: String(meta.fileName),
    mimeType,
    blob: new Blob([buffer], { type: mimeType }),
  }
}

/**
 * Local primero; si falta (típico en móvil nuevo), baja de Firestore y cachea.
 */
export async function ensureInvoiceLocal(
  transactionId: string,
): Promise<StoredInvoice | null> {
  try {
    const local = await getInvoiceFile(transactionId)
    if (local?.blob && local.blob.size > 0) return local
  } catch (err) {
    console.warn('[invoice] IndexedDB read failed', err)
  }

  try {
    const fromFs = await pullInvoiceFromFirestore(transactionId)
    if (!fromFs) return null
    try {
      await saveInvoiceFile(
        fromFs.transactionId,
        fromFs.blob,
        fromFs.fileName,
        fromFs.mimeType,
      )
    } catch (err) {
      console.warn('[invoice] IndexedDB save failed', err)
    }
    return fromFs
  } catch (err) {
    console.warn('[invoice] cloud pull failed', err)
    return null
  }
}
