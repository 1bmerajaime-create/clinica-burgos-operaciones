import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { createWorker, PSM } from 'tesseract.js'

GlobalWorkerOptions.workerSrc = pdfWorker

export interface InvoiceOcrResult {
  amount?: number
  date?: string
  description?: string
  rawText: string
}

function normalizeText(text: string): string {
  return text
    .replace(/\r/g, '\n')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function parseSpanishNumber(raw: string): number | undefined {
  let s = raw
    .replace(/\s/g, '')
    .replace(/€/gi, '')
    .replace(/EUR/gi, '')
    .replace(/euros?/gi, '')

  if (!s) return undefined

  const hasComma = s.includes(',')
  const hasDot = s.includes('.')

  if (hasComma && hasDot) {
    // 1.234,56 (ES) vs 1,234.56 (EN)
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.')
    } else {
      s = s.replace(/,/g, '')
    }
  } else if (hasComma) {
    // 1234,56 or 1.234 -> treat comma as decimal if 2 digits after
    s = /,\d{2}$/.test(s) ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '')
  } else if (hasDot) {
    // 1234.56 decimal, or 1.234 thousand
    s = /\.\d{2}$/.test(s) ? s : s.replace(/\./g, '')
  }

  const value = Number(s)
  return Number.isFinite(value) ? value : undefined
}

const AMOUNT_RE =
  /(\d{1,3}(?:[.\s]\d{3})*[.,]\d{2}|\d+[.,]\d{2}|\d{1,6})\s*(?:€|EUR|euros?)?/gi

function parseAmount(text: string): number | undefined {
  type Cand = { value: number; score: number }
  const cands: Cand[] = []

  for (const line of text.split('\n')) {
    const lower = line.toLowerCase()
    let score = 0

    if (/total\s*(factura|general|documento)?/.test(lower)) score += 55
    if (/total\s*a\s*pagar|importe\s*a\s*pagar|a\s*pagar/.test(lower)) score += 60
    if (/importe\s*total|total\s*importe/.test(lower)) score += 58
    if (/\btotal\b/.test(lower)) score += 40
    if (/importe/.test(lower)) score += 25
    if (/€|eur/.test(lower)) score += 8

    if (/base\s*imponible|bi\b/.test(lower)) score -= 40
    if (/\biva\b|i\.?v\.?a\.?|cuota\s*iva|%\s*\d/.test(lower)) score -= 35
    if (/subtotal|neto|bruto/.test(lower)) score -= 15
    if (/unidad|precio\s*ud|cantidad|dto|descuento/.test(lower)) score -= 20
    if (/nif|cif|tel|iban|ccc|página|page/.test(lower)) score -= 30

    const matches = [...line.matchAll(AMOUNT_RE)]
    for (const m of matches) {
      const value = parseSpanishNumber(m[1] ?? m[0])
      if (value === undefined || value < 0.5 || value >= 500_000) continue
      // Prefer realistic invoice totals
      let local = score
      if (value >= 5) local += 3
      if (value < 1) local -= 10
      cands.push({ value, score: local })
    }
  }

  // Whole-document labeled patterns (OCR often joins words oddly)
  for (const m of text.matchAll(
    /(?:total\s*a\s*pagar|importe\s*total|total\s*factura|total)[^\d]{0,24}(\d{1,3}(?:[.\s]\d{3})*[.,]\d{2}|\d+[.,]\d{2})/gi,
  )) {
    const value = parseSpanishNumber(m[1])
    if (value !== undefined && value >= 0.5 && value < 500_000) {
      cands.push({ value, score: 70 })
    }
  }

  if (cands.length === 0) return undefined

  cands.sort((a, b) => b.score - a.score || b.value - a.value)
  const bestScore = cands[0].score
  // Among near-best scores, take the largest amount (usually the final total)
  const top = cands.filter((c) => c.score >= bestScore - 15)
  return Math.max(...top.map((c) => c.value))
}

const MONTHS: Record<string, string> = {
  enero: '01',
  ene: '01',
  febrero: '02',
  feb: '02',
  marzo: '03',
  mar: '03',
  abril: '04',
  abr: '04',
  mayo: '05',
  may: '05',
  junio: '06',
  jun: '06',
  julio: '07',
  jul: '07',
  agosto: '08',
  ago: '08',
  septiembre: '09',
  setiembre: '09',
  sep: '09',
  sept: '09',
  octubre: '10',
  oct: '10',
  noviembre: '11',
  nov: '11',
  diciembre: '12',
  dic: '12',
}

function toIso(y: string, m: string, d: string): string | undefined {
  const year = Number(y)
  const month = Number(m)
  const day = Number(d)
  if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
    return undefined
  }
  return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function parseSpanishDate(raw: string): string | undefined {
  type Cand = { iso: string; score: number }
  const cands: Cand[] = []

  const push = (iso: string | undefined, score: number) => {
    if (!iso) return
    cands.push({ iso, score })
  }

  for (const line of raw.split('\n')) {
    const lower = line.toLowerCase()
    let score = 0
    if (/fecha\s*(de\s*)?(factura|emisi[oó]n|documento)?/.test(lower)) score += 40
    if (/fecha/.test(lower)) score += 25
    if (/vencimiento|vto/.test(lower)) score -= 20

    for (const m of line.matchAll(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/g)) {
      push(toIso(m[1], m[2], m[3]), score + 10)
    }
    for (const m of line.matchAll(/\b(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2})\b/g)) {
      push(toIso(m[3], m[2], m[1]), score + 15)
    }
    for (const m of line.matchAll(
      /\b(\d{1,2})\s+de\s+([a-záéíóú]+)\s+(?:de\s+)?(20\d{2})\b/gi,
    )) {
      const mon = MONTHS[m[2].toLowerCase()]
      if (mon) push(toIso(m[3], mon, m[1]), score + 20)
    }
  }

  // Fallback: first EU date in whole text
  if (cands.length === 0) {
    const eu = raw.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2})\b/)
    if (eu) push(toIso(eu[3], eu[2], eu[1]), 5)
    const iso = raw.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/)
    if (iso) push(toIso(iso[1], iso[2], iso[3]), 3)
  }

  if (cands.length === 0) return undefined
  cands.sort((a, b) => b.score - a.score)
  return cands[0].iso
}

function guessDescription(text: string, fileName: string): string | undefined {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 5 && l.length < 140)

  for (let i = 0; i < lines.length; i++) {
    if (/^(concepto|descripci[oó]n|detalle)\b/i.test(lines[i])) {
      const next = lines[i + 1]
      if (next && !/^(total|iva|base|importe|fecha|nif|cif)\b/i.test(next)) {
        return next.slice(0, 120)
      }
      const rest = lines[i].replace(/^(concepto|descripci[oó]n|detalle)\s*[:.-]?\s*/i, '')
      if (rest.length > 4) return rest.slice(0, 120)
    }
  }

  const useful = lines.find(
    (l) =>
      /material|consulta|cirug|tratamiento|servicio|producto|lente|toxina|hialuron|n[oó]mina|alquiler|proveedor/i.test(
        l,
      ) && !/total|iva|base imponible|nif|cif|iban/i.test(l),
  )
  if (useful) return useful.slice(0, 120)

  const issuer = lines.find(
    (l) =>
      l.length > 8 &&
      /sl|s\.l|sa|s\.a|clinic|oftalm|estetic|farmac|optica|óptica/i.test(l) &&
      !/factura|total|cliente/i.test(l),
  )
  if (issuer) return `Factura ${issuer}`.slice(0, 120)

  return `Factura: ${fileName}`
}

function isPdf(file: File): boolean {
  return (
    file.type === 'application/pdf' ||
    file.name.toLowerCase().endsWith('.pdf')
  )
}

function fieldsFromText(rawText: string, fileName: string): InvoiceOcrResult {
  const normalized = normalizeText(rawText)
  return {
    amount: parseAmount(normalized),
    date: parseSpanishDate(normalized),
    description: guessDescription(normalized, fileName),
    rawText: normalized,
  }
}

async function extractEmbeddedPdfText(file: File): Promise<string> {
  const data = new Uint8Array(await file.arrayBuffer())
  const pdf = await getDocument({ data }).promise
  const parts: string[] = []

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    let line = ''
    let lastY: number | null = null

    for (const item of content.items) {
      if (!('str' in item) || !item.str) continue
      const y = 'transform' in item ? item.transform[5] : null
      if (lastY !== null && y !== null && Math.abs(lastY - y) > 6) {
        parts.push(line.trim())
        line = ''
      }
      line += `${item.str} `
      if (y !== null) lastY = y
    }
    if (line.trim()) parts.push(line.trim())
  }

  return parts.join('\n')
}

async function blobFromCanvas(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('No se pudo crear la imagen'))),
      'image/png',
    )
  })
}

/** Escala, contraste y limpieza para mejorar Tesseract */
async function preprocessImage(source: Blob | File): Promise<Blob> {
  const bitmap = await createImageBitmap(source)
  let w = bitmap.width
  let h = bitmap.height

  const minW = 1200
  const maxW = 2200
  if (w < minW) {
    const scale = minW / w
    w = Math.round(w * scale)
    h = Math.round(h * scale)
  } else if (w > maxW) {
    const scale = maxW / w
    w = Math.round(w * scale)
    h = Math.round(h * scale)
  }

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No se pudo preparar la imagen')

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()

  const img = ctx.getImageData(0, 0, w, h)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    let g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
    g = (g - 128) * 1.45 + 128
    g = Math.max(0, Math.min(255, g))
    // Binarizado suave
    const v = g > 185 ? 255 : g < 95 ? 0 : g
    d[i] = d[i + 1] = d[i + 2] = v
    d[i + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  return blobFromCanvas(canvas)
}

async function renderPdfPagesToBlobs(
  file: File,
  maxPages = 2,
  onProgress?: (pct: number) => void,
): Promise<Blob[]> {
  const data = new Uint8Array(await file.arrayBuffer())
  const pdf = await getDocument({ data }).promise
  const pageCount = Math.min(pdf.numPages, maxPages)
  const blobs: Blob[] = []

  for (let i = 1; i <= pageCount; i++) {
    onProgress?.(Math.round(((i - 1) / pageCount) * 30))
    const page = await pdf.getPage(i)
    const viewport = page.getViewport({ scale: 2.6 })
    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(viewport.width)
    canvas.height = Math.ceil(viewport.height)
    const canvasContext = canvas.getContext('2d')
    if (!canvasContext) throw new Error('No se pudo crear el canvas')

    canvasContext.fillStyle = '#ffffff'
    canvasContext.fillRect(0, 0, canvas.width, canvas.height)
    await page.render({ canvasContext, canvas, viewport }).promise
    const raw = await blobFromCanvas(canvas)
    blobs.push(await preprocessImage(raw))
  }

  onProgress?.(35)
  return blobs
}

async function ocrImageSource(
  source: File | Blob,
  onProgress?: (pct: number) => void,
  progressFrom = 0,
  progressTo = 100,
): Promise<string> {
  const prepared =
    source instanceof File && source.type.startsWith('image/')
      ? await preprocessImage(source)
      : source instanceof Blob && !(source instanceof File)
        ? source
        : await preprocessImage(source)

  const worker = await createWorker('spa', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text' && typeof m.progress === 'number') {
        onProgress?.(
          Math.round(progressFrom + m.progress * (progressTo - progressFrom)),
        )
      }
    },
  })

  try {
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.AUTO,
      preserve_interword_spaces: '1',
    })
    const {
      data: { text },
    } = await worker.recognize(prepared)
    return text
  } finally {
    await worker.terminate()
  }
}

export async function extractInvoiceFields(
  file: File,
  onProgress?: (pct: number) => void,
): Promise<InvoiceOcrResult> {
  if (isPdf(file)) {
    onProgress?.(5)
    try {
      const embedded = await extractEmbeddedPdfText(file)
      const compact = embedded.replace(/\s+/g, ' ').trim()
      const useful =
        compact.length >= 30 &&
        /\d/.test(compact) &&
        /(?:total|importe|factura|€|eur|\d+[.,]\d{2})/i.test(compact)
      if (useful) {
        onProgress?.(100)
        return fieldsFromText(embedded, file.name)
      }
    } catch {
      /* fallback a OCR visual */
    }

    const pageBlobs = await renderPdfPagesToBlobs(file, 2, onProgress)
    const texts: string[] = []
    for (let i = 0; i < pageBlobs.length; i++) {
      const from = 35 + (i / pageBlobs.length) * 60
      const to = 35 + ((i + 1) / pageBlobs.length) * 60
      texts.push(await ocrImageSource(pageBlobs[i], onProgress, from, to))
    }
    onProgress?.(100)
    return fieldsFromText(texts.join('\n'), file.name)
  }

  onProgress?.(8)
  const text = await ocrImageSource(file, onProgress, 10, 100)
  return fieldsFromText(text, file.name)
}
