import { useEffect, useState, type FormEvent } from 'react'
import { AREAS, SPECIALTIES, areaNeedsSpecialty } from '../data/areas'
import { useFinance } from '../context/FinanceContext'
import { extractInvoiceFields } from '../lib/invoiceOcr'
import type { AreaId, SpecialtyId } from '../types'
import { Button, Input, Label, Modal, Select, Textarea } from './ui'

interface Props {
  open: boolean
  onClose: () => void
  defaultAreaId?: AreaId
  defaultSpecialtyId?: SpecialtyId
}

export function InvoiceUploadModal({
  open,
  onClose,
  defaultAreaId = 'clinica',
  defaultSpecialtyId = 'oftalmologia',
}: Props) {
  const { addTransaction } = useFinance()
  const [areaId, setAreaId] = useState<AreaId>(defaultAreaId)
  const [specialtyId, setSpecialtyId] = useState<SpecialtyId | ''>(
    defaultSpecialtyId,
  )
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [description, setDescription] = useState('')
  const [fileName, setFileName] = useState('')
  const [saved, setSaved] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState(0)
  const [scanNote, setScanNote] = useState('')

  const needsSpecialty = areaNeedsSpecialty(areaId)

  useEffect(() => {
    if (!open) return
    setAreaId(defaultAreaId)
    setSpecialtyId(
      areaNeedsSpecialty(defaultAreaId) ? defaultSpecialtyId : '',
    )
    setAmount('')
    setDate(new Date().toISOString().slice(0, 10))
    setDescription('')
    setFileName('')
    setSaved(false)
    setScanning(false)
    setScanProgress(0)
    setScanNote('')
  }, [open, defaultAreaId, defaultSpecialtyId])

  function handleClose() {
    setSaved(false)
    onClose()
  }

  function handleAreaChange(next: AreaId) {
    setAreaId(next)
    if (areaNeedsSpecialty(next)) {
      setSpecialtyId((prev) => prev || 'oftalmologia')
    } else {
      setSpecialtyId('')
    }
  }

  async function handleFile(file: File) {
    setFileName(file.name)
    if (!description) setDescription(`Factura: ${file.name}`)

    const isImage = file.type.startsWith('image/')
    if (!isImage) {
      setScanNote(
        'Para lectura automática sube una imagen (JPG/PNG). Los PDF se registran sin OCR.',
      )
      return
    }

    setScanning(true)
    setScanProgress(0)
    setScanNote('Leyendo la factura…')

    try {
      const result = await extractInvoiceFields(file, setScanProgress)
      if (result.amount) setAmount(String(result.amount))
      if (result.date) setDate(result.date)
      if (result.description) setDescription(result.description)

      const filled = [
        result.amount ? 'importe' : null,
        result.date ? 'fecha' : null,
        result.description ? 'concepto' : null,
      ].filter(Boolean)

      setScanNote(
        filled.length
          ? `Campos detectados: ${filled.join(', ')}. Revísalos antes de guardar.`
          : 'No se pudieron detectar campos con claridad. Complétalos a mano.',
      )
    } catch {
      setScanNote(
        'No se pudo leer la imagen. Puedes completar los campos manualmente.',
      )
    } finally {
      setScanning(false)
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const value = Number(amount.replace(',', '.'))
    if (!value || value <= 0 || !description.trim() || !fileName) return
    if (needsSpecialty && !specialtyId) return

    addTransaction({
      type: 'gasto',
      areaId,
      specialtyId: needsSpecialty ? (specialtyId as SpecialtyId) : undefined,
      amount: value,
      date,
      description: description.trim(),
      invoiceFileName: fileName,
    })
    setSaved(true)
    setTimeout(handleClose, 700)
  }

  return (
    <Modal open={open} onClose={handleClose} title="Subir factura">
      {saved ? (
        <div className="py-8 text-center animate-fade-up">
          <p className="font-display text-2xl text-ink">Factura registrada</p>
          <p className="mt-2 text-sm text-ink-soft">
            Se ha creado el gasto asociado al documento.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="file">Documento</Label>
            <label
              htmlFor="file"
              className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-ink/20 bg-cream-dark/40 px-4 py-8 text-center transition hover:border-ink/40 hover:bg-cream-dark/70"
            >
              <span className="font-display text-xl text-ink">
                {fileName || 'Arrastra o selecciona imagen / PDF'}
              </span>
              <span className="mt-2 text-xs text-ink-muted">
                Con imagen (JPG/PNG) intentamos leer importe, fecha y concepto
              </span>
              <input
                id="file"
                type="file"
                accept=".pdf,image/*"
                className="hidden"
                disabled={scanning}
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void handleFile(f)
                }}
              />
            </label>
            {(scanning || scanNote) && (
              <div className="mt-3 rounded-2xl bg-cream-dark/60 px-4 py-3 text-xs text-ink-soft">
                {scanning && (
                  <p className="mb-2 font-medium text-ink">
                    Analizando factura… {scanProgress}%
                  </p>
                )}
                {scanning && (
                  <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-sand">
                    <div
                      className="h-full rounded-full bg-ink transition-all"
                      style={{ width: `${scanProgress}%` }}
                    />
                  </div>
                )}
                {scanNote && <p>{scanNote}</p>}
              </div>
            )}
          </div>

          <div className={needsSpecialty ? 'grid gap-4 sm:grid-cols-2' : ''}>
            <div>
              <Label htmlFor="inv-area">Categoría</Label>
              <Select
                id="inv-area"
                value={areaId}
                onChange={(e) => handleAreaChange(e.target.value as AreaId)}
              >
                {AREAS.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </div>
            {needsSpecialty && (
              <div className="animate-fade-up">
                <Label htmlFor="inv-specialty">Especialidad</Label>
                <Select
                  id="inv-specialty"
                  value={specialtyId}
                  onChange={(e) =>
                    setSpecialtyId(e.target.value as SpecialtyId)
                  }
                  required
                >
                  <option value="">Seleccionar…</option>
                  {SPECIALTIES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="inv-amount">Importe (€)</Label>
              <Input
                id="inv-amount"
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="inv-date">Fecha factura</Label>
              <Input
                id="inv-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="inv-desc">Concepto</Label>
            <Textarea
              id="inv-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={handleClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!fileName || scanning}>
              Registrar factura
            </Button>
          </div>
        </form>
      )}
    </Modal>
  )
}
