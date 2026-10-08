import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

GlobalWorkerOptions.workerSrc = pdfWorker

let chain: Promise<unknown> = Promise.resolve()

/** Serializa el acceso a pdf.js (OCR y vista previa comparten el worker). */
export function withPdfLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn)
  chain = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

export async function renderPdfBlobToDataUrls(
  blob: Blob,
  maxPages = 12,
  onPage?: (pages: string[]) => void,
): Promise<string[]> {
  return withPdfLock(async () => {
    const data = new Uint8Array(await blob.arrayBuffer())
    const pdf: PDFDocumentProxy = await getDocument({ data }).promise
    try {
      const pageCount = Math.min(pdf.numPages, maxPages)
      const urls: string[] = []

      for (let i = 1; i <= pageCount; i++) {
        const page = await pdf.getPage(i)
        const base = page.getViewport({ scale: 1 })
        const scale = Math.min(1.75, 1000 / base.width)
        const viewport = page.getViewport({ scale })
        const canvas = document.createElement('canvas')
        canvas.width = Math.ceil(viewport.width)
        canvas.height = Math.ceil(viewport.height)
        const ctx = canvas.getContext('2d', { alpha: false })
        if (!ctx) throw new Error('No canvas context')
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        await page.render({ canvasContext: ctx, canvas, viewport }).promise
        urls.push(canvas.toDataURL('image/png'))
        onPage?.([...urls])
      }

      return urls
    } finally {
      await pdf.destroy()
    }
  })
}
