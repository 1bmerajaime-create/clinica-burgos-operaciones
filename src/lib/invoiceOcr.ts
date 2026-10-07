import Tesseract from 'tesseract.js'

export interface InvoiceOcrResult {
  amount?: number
  date?: string
  description?: string
  rawText: string
}

function normalizeText(text: string): string {
  return text.replace(/\r/g, '\n').replace(/[^\S\n]+/g, ' ').trim()
}

function parseSpanishDate(raw: string): string | undefined {
  const iso = raw.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/)
  if (iso) {
    const [, y, m, d] = iso
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }

  const eu = raw.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2})\b/)
  if (eu) {
    const [, d, m, y] = eu
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }

  return undefined
}

function parseAmount(text: string): number | undefined {
  const labeled = [
    ...text.matchAll(
      /(?:total|importe|total\s*factura|total\s*a\s*pagar|base\s*imponible)?[^\d]{0,20}(\d{1,3}(?:[.\s]\d{3})*(?:[.,]\d{2})|\d+[.,]\d{2})\s*€?/gi,
    ),
  ]

  const candidates = labeled
    .map((m) => m[1])
    .map((raw) => {
      const cleaned = raw.replace(/\s/g, '')
      const normalized =
        cleaned.includes(',') && cleaned.includes('.')
          ? cleaned.replace(/\./g, '').replace(',', '.')
          : cleaned.replace(',', '.')
      const value = Number(normalized)
      return Number.isFinite(value) ? value : NaN
    })
    .filter((n) => n > 0 && n < 1_000_000)

  if (candidates.length === 0) return undefined
  return Math.max(...candidates)
}

function guessDescription(text: string, fileName: string): string {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 4 && !/^\d+([.,]\d+)?$/.test(l))

  const useful = lines.find(
    (l) =>
      /factura|proveedor|material|consulta|cirug|tratamiento|lio|oftalm|estetic/i.test(
        l,
      ),
  )

  if (useful) return useful.slice(0, 120)
  if (lines[0]) return lines[0].slice(0, 120)
  return `Factura: ${fileName}`
}

export async function extractInvoiceFields(
  file: File,
  onProgress?: (pct: number) => void,
): Promise<InvoiceOcrResult> {
  const {
    data: { text },
  } = await Tesseract.recognize(file, 'spa+eng', {
    logger: (m) => {
      if (m.status === 'recognizing text' && typeof m.progress === 'number') {
        onProgress?.(Math.round(m.progress * 100))
      }
    },
  })

  const rawText = normalizeText(text)
  return {
    amount: parseAmount(rawText),
    date: parseSpanishDate(rawText),
    description: guessDescription(rawText, file.name),
    rawText,
  }
}
