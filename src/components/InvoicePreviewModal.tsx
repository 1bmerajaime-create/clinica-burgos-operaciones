import { Download, X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ensureInvoiceLocal } from '../lib/invoiceCloud'
import {
  downloadBlob,
  isImageMime,
  isPdfMime,
} from '../lib/invoiceStore'
import { renderPdfBlobToDataUrls } from '../lib/pdfRender'
import { Button } from './ui'

interface Props {
  open: boolean
  onClose: () => void
  transactionId?: string
  fileName?: string
  file?: Blob | File | null
  mimeType?: string
}

export function InvoicePreviewModal({
  open,
  onClose,
  transactionId,
  fileName,
  file = null,
  mimeType = '',
}: Props) {
  const titleId = useId()
  const genRef = useRef(0)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [name, setName] = useState(fileName || 'Factura')
  const [kind, setKind] = useState<'pdf' | 'image' | 'other'>('other')
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const [pdfPages, setPdfPages] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const fileKey = file
    ? [
        file instanceof File ? file.name : 'blob',
        file.size,
        file instanceof File ? file.lastModified : 0,
        file.type,
      ].join(':')
    : ''

  useEffect(() => {
    if (!open) {
      genRef.current += 1
      setBlob(null)
      setObjectUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return null
      })
      setPdfPages([])
      setError('')
      setLoading(false)
      return
    }

    const gen = ++genRef.current

    setLoading(true)
    setError('')
    setBlob(null)
    setObjectUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
    setPdfPages([])
    setKind('other')
    setName(fileName || 'Factura')

    async function load() {
      let nextBlob: Blob
      let nextName = fileName || 'Factura'
      let nextMime = mimeType

      if (file) {
        nextBlob = file
        nextName =
          fileName || (file instanceof File ? file.name : 'Factura')
        nextMime = mimeType || file.type || ''
      } else if (transactionId) {
        const stored = await ensureInvoiceLocal(transactionId)
        if (genRef.current !== gen) return
        if (!stored) {
          setError(
            'No hay archivo en este dispositivo ni en la nube. Vuelve a adjuntarla al editar el movimiento.',
          )
          return
        }
        nextBlob = stored.blob
        nextName = stored.fileName || nextName
        nextMime = stored.mimeType || stored.blob.type || ''
      } else {
        setError('No hay factura para mostrar.')
        return
      }

      if (genRef.current !== gen) return

      const pdf = isPdfMime(nextMime, nextName)
      const image = isImageMime(nextMime) || nextMime.startsWith('image/')
      const url = URL.createObjectURL(nextBlob)

      setBlob(nextBlob)
      setName(nextName)
      setObjectUrl(url)
      setKind(pdf ? 'pdf' : image ? 'image' : 'other')

      if (!pdf) return

      const pages = await renderPdfBlobToDataUrls(nextBlob, 12, (partial) => {
        if (genRef.current !== gen) return
        setPdfPages(partial)
        if (partial.length > 0) setLoading(false)
      })

      if (genRef.current !== gen) return
      if (pages.length === 0) {
        setError('El PDF no tiene páginas para mostrar.')
        return
      }
      setPdfPages(pages)
    }

    void load()
      .catch((err) => {
        console.error('Invoice preview failed', err)
        if (genRef.current === gen) {
          setError(
            'No se pudo mostrar la factura aquí. Usa «Abrir en pestaña» o «Descargar».',
          )
        }
      })
      .finally(() => {
        if (genRef.current === gen) setLoading(false)
      })
    // fileKey identifica el File del render actual.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- file vía fileKey
  }, [open, transactionId, fileKey, fileName, mimeType])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-ink/45 backdrop-blur-[2px]"
        aria-label="Cerrar"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 flex max-h-[92vh] w-full max-w-5xl flex-col rounded-t-[1.5rem] border border-sand bg-cream shadow-2xl sm:rounded-[1.5rem]"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-sand/70 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.16em] text-ink-muted">
              Factura
            </p>
            <h3
              id={titleId}
              className="break-all text-base font-medium leading-snug text-ink sm:text-lg"
              title={name || fileName || 'Factura'}
            >
              {name || fileName || 'Factura'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-ink/15 text-ink-soft transition hover:border-ink/40 hover:text-ink"
            aria-label="Cerrar"
          >
            <X size={16} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          {loading && pdfPages.length === 0 && (
            <p className="py-10 text-center text-sm text-ink-muted">
              Cargando factura…
            </p>
          )}

          {!loading && error && pdfPages.length === 0 && (
            <div className="space-y-3 rounded-2xl border border-sand/70 bg-cream-dark/40 px-4 py-6 text-center text-sm text-ink-soft">
              <p>{error}</p>
              {objectUrl && (
                <Button
                  type="button"
                  onClick={() =>
                    window.open(objectUrl, '_blank', 'noopener,noreferrer')
                  }
                >
                  Abrir en pestaña
                </Button>
              )}
            </div>
          )}

          {kind === 'pdf' && pdfPages.length > 0 && (
            <div className="space-y-3 rounded-2xl border border-sand/70 bg-cream-dark/30 p-2">
              {pdfPages.map((src, i) => (
                <img
                  key={i}
                  src={src}
                  alt={`${name} — página ${i + 1}`}
                  className="mx-auto w-full max-w-full bg-white shadow-sm"
                />
              ))}
            </div>
          )}

          {!loading && !error && kind === 'image' && objectUrl && (
            <div className="overflow-hidden rounded-2xl border border-sand/70 bg-cream-dark/30">
              <img
                src={objectUrl}
                alt={name}
                className="mx-auto max-h-[min(70vh,640px)] w-auto max-w-full object-contain"
              />
            </div>
          )}

          {!loading && !error && kind === 'other' && objectUrl && (
            <div className="rounded-2xl border border-sand/70 bg-cream-dark/40 px-4 py-10 text-center text-sm text-ink-muted">
              Vista previa no disponible para este formato. Puedes descargarlo.
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap gap-2 border-t border-sand/70 px-5 py-4 sm:px-6">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
          {blob && (
            <Button
              type="button"
              onClick={() => downloadBlob(blob, name || 'factura')}
            >
              <Download size={14} />
              Descargar
            </Button>
          )}
          {objectUrl && (
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                window.open(objectUrl, '_blank', 'noopener,noreferrer')
              }
            >
              Abrir en pestaña
            </Button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
