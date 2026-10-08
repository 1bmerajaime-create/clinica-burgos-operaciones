import JSZip from 'jszip'
import type { AestheticProduct, ProductSale, Transaction } from '../types'
import {
  downloadBlob,
  listInvoiceFiles,
  replaceAllInvoiceFiles,
  type StoredInvoice,
} from './invoiceStore'

export const BACKUP_FORMAT_VERSION = 1

export interface BackupManifest {
  formatVersion: number
  app: 'cb-operaciones'
  exportedAt: string
  transactionCount: number
  invoiceCount: number
}

export interface BackupPayload {
  transactions: Transaction[]
  products: AestheticProduct[]
  productSales: ProductSale[]
  invoices: StoredInvoice[]
}

function safeFileName(name: string) {
  return name.replace(/[\\/:*?"<>|]+/g, '_').trim() || 'documento'
}

export async function buildBackupZip(payload: {
  transactions: Transaction[]
  products: AestheticProduct[]
  productSales: ProductSale[]
}): Promise<{ blob: Blob; fileName: string }> {
  const invoices = await listInvoiceFiles()
  const zip = new JSZip()
  const day = new Date().toISOString().slice(0, 10)
  const root = `cb-operaciones-backup-${day}`

  const manifest: BackupManifest = {
    formatVersion: BACKUP_FORMAT_VERSION,
    app: 'cb-operaciones',
    exportedAt: new Date().toISOString(),
    transactionCount: payload.transactions.length,
    invoiceCount: invoices.length,
  }

  zip.file(`${root}/manifest.json`, JSON.stringify(manifest, null, 2))
  zip.file(
    `${root}/transactions.json`,
    JSON.stringify(payload.transactions, null, 2),
  )
  zip.file(
    `${root}/inventory.json`,
    JSON.stringify(
      { products: payload.products, sales: payload.productSales },
      null,
      2,
    ),
  )

  const invoicesFolder = zip.folder(`${root}/invoices`)
  for (const inv of invoices) {
    const folder = invoicesFolder?.folder(inv.transactionId)
    folder?.file(safeFileName(inv.fileName), inv.blob)
    folder?.file(
      '_meta.json',
      JSON.stringify(
        {
          transactionId: inv.transactionId,
          fileName: inv.fileName,
          mimeType: inv.mimeType,
        },
        null,
        2,
      ),
    )
  }

  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })

  return { blob, fileName: `${root}.zip` }
}

export async function downloadBackup(payload: {
  transactions: Transaction[]
  products: AestheticProduct[]
  productSales: ProductSale[]
}): Promise<void> {
  const { blob, fileName } = await buildBackupZip(payload)
  downloadBlob(blob, fileName)
}

function findRootPrefix(paths: string[]): string {
  const manifestPath = paths.find((p) => p.endsWith('manifest.json'))
  if (manifestPath) {
    const idx = manifestPath.lastIndexOf('/')
    return idx >= 0 ? manifestPath.slice(0, idx + 1) : ''
  }
  const txPath = paths.find((p) => p.endsWith('transactions.json'))
  if (txPath) {
    const idx = txPath.lastIndexOf('/')
    return idx >= 0 ? txPath.slice(0, idx + 1) : ''
  }
  return ''
}

export async function parseBackupZip(file: Blob): Promise<BackupPayload> {
  const zip = await JSZip.loadAsync(file)
  const paths = Object.keys(zip.files).filter((p) => !zip.files[p].dir)
  const root = findRootPrefix(paths)

  const readJson = async <T,>(relative: string): Promise<T> => {
    const entry = zip.file(root + relative)
    if (!entry) throw new Error(`Falta ${relative} en la copia de seguridad`)
    return JSON.parse(await entry.async('string')) as T
  }

  const manifest = await readJson<BackupManifest>('manifest.json').catch(
    () => null,
  )
  if (manifest && manifest.app !== 'cb-operaciones') {
    throw new Error('El archivo no es una copia de CB Operaciones')
  }

  const transactions = await readJson<Transaction[]>('transactions.json')
  if (!Array.isArray(transactions)) {
    throw new Error('transactions.json inválido')
  }

  const inventory = await readJson<{
    products?: AestheticProduct[]
    sales?: ProductSale[]
  }>('inventory.json').catch(() => ({ products: [], sales: [] }))

  const products = Array.isArray(inventory.products) ? inventory.products : []
  const productSales = Array.isArray(inventory.sales) ? inventory.sales : []

  const invoices: StoredInvoice[] = []
  const metaPaths = paths.filter(
    (p) => p.startsWith(root + 'invoices/') && p.endsWith('/_meta.json'),
  )

  for (const metaPath of metaPaths) {
    const metaEntry = zip.file(metaPath)
    if (!metaEntry) continue
    const meta = JSON.parse(await metaEntry.async('string')) as {
      transactionId: string
      fileName: string
      mimeType: string
    }
    const folder = metaPath.slice(0, -'_meta.json'.length)
    const fileEntry =
      zip.file(folder + safeFileName(meta.fileName)) ||
      zip.file(folder + meta.fileName) ||
      paths
        .filter(
          (p) =>
            p.startsWith(folder) &&
            !p.endsWith('/_meta.json') &&
            !zip.files[p].dir,
        )
        .map((p) => zip.file(p))[0]

    if (!fileEntry) continue
    const blob = await fileEntry.async('blob')
    invoices.push({
      transactionId: meta.transactionId,
      fileName: meta.fileName,
      mimeType: meta.mimeType || blob.type || 'application/octet-stream',
      blob,
    })
  }

  return { transactions, products, productSales, invoices }
}

export async function applyBackupPayload(payload: BackupPayload): Promise<void> {
  await replaceAllInvoiceFiles(payload.invoices)
}
