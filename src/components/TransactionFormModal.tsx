import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Download, Eye } from 'lucide-react'
import { AREAS, MOVEMENT_AREAS, SPECIALTIES } from '../data/areas'
import { useFinance } from '../context/FinanceContext'
import { extractInvoiceFields } from '../lib/invoiceOcr'
import { formatCurrencyPrecise } from '../lib/format'
import {
  downloadBlob,
  getInvoiceFile,
} from '../lib/invoiceStore'
import {
  defaultIrpfSettings,
  defaultVatRateFor,
  defaultVatSettings,
  formatVatPercent,
  resolveIrpfAmount,
  resolveVatAmounts,
} from '../lib/vat'
import type {
  AreaId,
  SpecialtyId,
  Transaction,
  TransactionType,
} from '../types'
import { isRevenueSide } from '../types'
import { InvoicePreviewModal } from './InvoicePreviewModal'
import { Button, Dialog, Input, Label, Select } from './ui'

interface Props {
  open: boolean
  onClose: () => void
  type?: TransactionType
  defaultAreaId?: AreaId
  defaultSpecialtyId?: SpecialtyId
  transaction?: Transaction | null
}

function rateToInput(rate: number): string {
  return formatVatPercent(rate)
}

export function TransactionFormModal({
  open,
  onClose,
  type: typeProp = 'ingreso',
  defaultAreaId = 'clinica',
  defaultSpecialtyId = 'oftalmologia',
  transaction = null,
}: Props) {
  const { addTransaction, updateTransaction } = useFinance()
  const isEditing = Boolean(transaction)

  const [type, setType] = useState<TransactionType>(typeProp)
  const [areaId, setAreaId] = useState<AreaId>(defaultAreaId)
  const [specialtyId, setSpecialtyId] = useState<SpecialtyId | ''>(
    defaultSpecialtyId,
  )
  const [amount, setAmount] = useState('')
  /** Por defecto el importe es el total con IVA incluido. */
  const [amountIncludesVat, setAmountIncludesVat] = useState(true)
  const [vatExempt, setVatExempt] = useState(false)
  const [vatRateInput, setVatRateInput] = useState(() =>
    rateToInput(defaultVatRateFor(typeProp)),
  )
  const [vatDeductible, setVatDeductible] = useState(true)
  const [irpfRateInput, setIrpfRateInput] = useState('0')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [description, setDescription] = useState('')
  const [fileName, setFileName] = useState('')
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null)
  const [invoiceMimeType, setInvoiceMimeType] = useState('')
  const [clearInvoice, setClearInvoice] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [saved, setSaved] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState(0)
  const [scanNote, setScanNote] = useState('')

  const areaChoices = useMemo(() => {
    const base = [...MOVEMENT_AREAS]
    // Conservar categoría legado al editar (p.ej. Cataratas).
    if (
      transaction &&
      (transaction.areaId === 'cataratas' || transaction.areaId === 'otros')
    ) {
      const legacy = AREAS.find((a) => a.id === transaction.areaId)
      if (legacy && !base.some((a) => a.id === legacy.id)) base.push(legacy)
    }
    return base
  }, [transaction])
  const revenueSide = isRevenueSide(type)

  const parsedRate = useMemo(() => {
    if (vatExempt) return 0
    const n = Number(vatRateInput.replace(',', '.'))
    if (!Number.isFinite(n) || n < 0) return defaultVatRateFor(type)
    return n / 100
  }, [vatExempt, vatRateInput, type])

  const vatBreakdown = useMemo(() => {
    const value = Number(amount.replace(',', '.'))
    if (!value || value <= 0) return null
    return resolveVatAmounts({
      amount: value,
      vatRate: parsedRate,
      amountIncludesVat,
    })
  }, [amount, parsedRate, amountIncludesVat])

  const parsedIrpfRate = useMemo(() => {
    const n = Number(irpfRateInput.replace(',', '.'))
    if (!Number.isFinite(n) || n < 0) return 0
    return n / 100
  }, [irpfRateInput])

  const irpfAmount = useMemo(() => {
    if (!vatBreakdown || parsedIrpfRate <= 0) return 0
    return resolveIrpfAmount({
      baseAmount: vatBreakdown.netAmount,
      irpfRate: parsedIrpfRate,
    })
  }, [vatBreakdown, parsedIrpfRate])

  const showIrpf = revenueSide && areaId === 'quiron'

  function applyVatDefaults(
    nextType: TransactionType,
    nextArea: AreaId,
    nextSpecialty: SpecialtyId | '',
  ) {
    const defaults = defaultVatSettings({
      type: nextType,
      areaId: nextArea,
      specialtyId: nextSpecialty,
    })
    setVatExempt(defaults.vatExempt)
    setVatRateInput(rateToInput(defaults.vatRate || defaultVatRateFor(nextType)))
    const irpf = defaultIrpfSettings({ type: nextType, areaId: nextArea })
    setIrpfRateInput(rateToInput(irpf.irpfRate))
  }

  useEffect(() => {
    if (!open) return

    if (transaction) {
      setType(transaction.type)
      // Área "otros" antigua → Clínica + especialidad Otros
      if (transaction.areaId === 'otros') {
        setAreaId('clinica')
        setSpecialtyId('otros')
      } else {
        setAreaId(transaction.areaId)
        setSpecialtyId(
          transaction.specialtyId ??
            (transaction.areaId === 'cataratas' ? '' : 'oftalmologia'),
        )
      }
      // Edición sobre el total con IVA incluido
      setAmountIncludesVat(true)
      setAmount(
        String(
          transaction.grossAmount ??
            transaction.netAmount ??
            transaction.amount,
        ),
      )
      const exempt = Boolean(transaction.vatExempt) || transaction.vatRate === 0
      setVatExempt(exempt)
      setVatRateInput(
        rateToInput(
          exempt
            ? defaultVatRateFor(transaction.type)
            : (transaction.vatRate ?? defaultVatRateFor(transaction.type)),
        ),
      )
      setVatDeductible(transaction.vatDeductible !== false)
      setIrpfRateInput(
        rateToInput(
          transaction.irpfRate ??
            (transaction.areaId === 'quiron' &&
            isRevenueSide(transaction.type)
              ? defaultIrpfSettings({
                  type: transaction.type,
                  areaId: transaction.areaId,
                }).irpfRate
              : 0),
        ),
      )
      setDate(transaction.date)
      setDescription(transaction.description)
      setFileName(transaction.invoiceFileName ?? '')
      setInvoiceFile(null)
      setInvoiceMimeType(transaction.invoiceMimeType ?? '')
      setClearInvoice(false)
      setPreviewOpen(false)
      setSaved(false)
      setScanning(false)
      setScanProgress(0)
      setScanNote('')
      return
    }

    const initialArea =
      defaultAreaId === 'clinica' || defaultAreaId === 'quiron'
        ? defaultAreaId
        : 'clinica'
    const initialSpecialty =
      defaultSpecialtyId === 'oftalmologia' ||
      defaultSpecialtyId === 'estetica' ||
      defaultSpecialtyId === 'otros'
        ? defaultSpecialtyId
        : 'oftalmologia'

    setType(typeProp)
    setAreaId(initialArea)
    setSpecialtyId(initialSpecialty)
    setAmount('')
    setAmountIncludesVat(true)
    applyVatDefaults(typeProp, initialArea, initialSpecialty)
    setVatDeductible(true)
    setDate(new Date().toISOString().slice(0, 10))
    setDescription('')
    setFileName('')
    setInvoiceFile(null)
    setInvoiceMimeType('')
    setClearInvoice(false)
    setPreviewOpen(false)
    setSaved(false)
    setScanning(false)
    setScanProgress(0)
    setScanNote('')
  }, [open, transaction, typeProp, defaultAreaId, defaultSpecialtyId])

  const title = isEditing ? 'Editar movimiento' : 'Nuevo movimiento'

  function handleClose() {
    setSaved(false)
    onClose()
  }

  function handleAreaChange(next: AreaId) {
    setAreaId(next)
    const nextSpecialty = (specialtyId || 'oftalmologia') as SpecialtyId
    if (!specialtyId) setSpecialtyId('oftalmologia')
    if (!isEditing) {
      applyVatDefaults(type, next, nextSpecialty)
      return
    }
    // Al pasar a/desde hospital en edición, alinear IRPF por defecto.
    const irpf = defaultIrpfSettings({ type, areaId: next })
    setIrpfRateInput(rateToInput(irpf.irpfRate))
    if (next === 'quiron' && isRevenueSide(type)) {
      const vat = defaultVatSettings({
        type,
        areaId: next,
        specialtyId: nextSpecialty,
      })
      setVatExempt(vat.vatExempt)
      if (vat.vatExempt) setVatRateInput(rateToInput(defaultVatRateFor(type)))
    }
  }

  function handleSpecialtyChange(next: SpecialtyId | '') {
    setSpecialtyId(next)
    if (!isEditing) applyVatDefaults(type, areaId, next)
  }

  function handleTypeChange(next: TransactionType) {
    setType(next)
    if (!isEditing) {
      applyVatDefaults(next, areaId, specialtyId || 'oftalmologia')
    }
  }

  function conceptFromFileName(name: string) {
    return name.replace(/\.[^.]+$/, '').trim() || name
  }

  async function handleFile(file: File) {
    setFileName(file.name)
    setInvoiceFile(file)
    setInvoiceMimeType(file.type || '')
    setClearInvoice(false)
    setDescription(conceptFromFileName(file.name))

    const isImage = file.type.startsWith('image/')
    const isPdf =
      file.type === 'application/pdf' ||
      file.name.toLowerCase().endsWith('.pdf')

    if (!isImage && !isPdf) {
      setScanNote('Formato no soportado. Sube una imagen (JPG/PNG) o un PDF.')
      return
    }

    setScanning(true)
    setScanProgress(0)
    setScanNote(isPdf ? 'Leyendo el PDF…' : 'Leyendo la factura…')

    try {
      const result = await extractInvoiceFields(file, setScanProgress)
      if (result.amount != null) {
        setAmount(result.amount.toFixed(2))
        // Las facturas suelen traer total con IVA
        setAmountIncludesVat(true)
      }
      if (result.date) setDate(result.date)
      // El concepto se toma del nombre del archivo (no lo sobrescribe el OCR)

      const filled = [
        result.amount != null ? 'importe' : null,
        result.date ? 'fecha' : null,
        'concepto',
      ].filter(Boolean)

      const preview = result.rawText
        ? result.rawText.replace(/\s+/g, ' ').trim().slice(0, 140)
        : ''

      setScanNote(
        filled.length
          ? `Detectado: ${filled.join(', ')}. Revísalos antes de guardar.${
              preview ? ` Texto: “${preview}${result.rawText.length > 140 ? '…' : ''}”` : ''
            }`
          : preview
            ? `No se extrajeron campos claros. Texto leído: “${preview}${result.rawText.length > 140 ? '…' : ''}”. Complétalo a mano.`
            : 'No se pudo leer texto útil. Prueba con una foto más nítida o completa a mano.',
      )
    } catch {
      setScanNote(
        'No se pudo leer el documento. Puedes completar los campos manualmente.',
      )
    } finally {
      setScanning(false)
    }
  }

  const hasInvoice =
    Boolean(invoiceFile) || (Boolean(fileName) && !clearInvoice)

  async function handleDownloadInvoice() {
    if (invoiceFile) {
      downloadBlob(invoiceFile, fileName || invoiceFile.name)
      return
    }
    if (!transaction?.id) return
    const stored = await getInvoiceFile(transaction.id)
    if (!stored) {
      setScanNote(
        'No hay archivo guardado para descargar. Vuelve a adjuntar la factura.',
      )
      return
    }
    downloadBlob(stored.blob, stored.fileName)
  }

  const requiresSpecialty = areaId === 'clinica' || areaId === 'quiron'

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const value = Number(amount.replace(',', '.'))
    if (!value || value <= 0 || !description.trim()) return
    if (requiresSpecialty && !specialtyId) return

    const vat = resolveVatAmounts({
      amount: value,
      vatRate: parsedRate,
      amountIncludesVat,
    })

    const payload = {
      type,
      areaId,
      specialtyId: requiresSpecialty
        ? (specialtyId as SpecialtyId)
        : specialtyId || undefined,
      amount: value,
      netAmount: vat.netAmount,
      vatAmount: vat.vatAmount,
      grossAmount: vat.grossAmount,
      vatRate: vat.vatRate,
      vatExempt,
      amountIncludesVat,
      vatDeductible: type === 'gasto' ? vatDeductible && !vatExempt : undefined,
      vatDeductibleShare:
        type === 'gasto'
          ? vatDeductible && !vatExempt
            ? 1
            : 0
          : undefined,
      irpfRate: showIrpf && parsedIrpfRate > 0 ? parsedIrpfRate : undefined,
      irpfAmount: showIrpf && irpfAmount > 0 ? irpfAmount : undefined,
      date,
      description: description.trim(),
      invoiceFileName: clearInvoice
        ? undefined
        : fileName || transaction?.invoiceFileName || undefined,
      invoiceMimeType: clearInvoice
        ? undefined
        : invoiceMimeType ||
          invoiceFile?.type ||
          transaction?.invoiceMimeType ||
          undefined,
      invoiceFile: invoiceFile ?? undefined,
      clearInvoice: clearInvoice || undefined,
    }

    if (transaction) await updateTransaction(transaction.id, payload)
    else await addTransaction(payload)

    setSaved(true)
    setTimeout(handleClose, 700)
  }

  return (
    <>
    <Dialog open={open} onClose={handleClose} title={title} elevated>
      {saved ? (
        <div className="py-8 text-center animate-fade-up">
          <p className="font-display text-2xl text-ink">
            {isEditing ? 'Actualizado' : 'Registrado'}
          </p>
          <p className="mt-2 text-sm text-ink-soft">
            Los cambios ya se reflejan en el dashboard.
          </p>
        </div>
      ) : (
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div>
            <Label htmlFor="type">Tipo</Label>
            <Select
              id="type"
              value={type}
              onChange={(e) =>
                handleTypeChange(e.target.value as TransactionType)
              }
            >
              <option value="ingreso">Ingreso</option>
              <option value="gasto">Gasto</option>
              <option value="devolucion">Devolución</option>
            </Select>
          </div>

          <div>
            <Label htmlFor="invoice-file">Factura (opcional)</Label>
            <label
              htmlFor="invoice-file"
              className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-ink/20 bg-cream-dark/40 px-4 py-6 text-center transition hover:border-ink/40 hover:bg-cream-dark/70 ${
                scanning ? 'pointer-events-none opacity-70' : ''
              }`}
            >
              <span className="font-display text-lg text-ink">
                {fileName || 'Adjuntar factura (JPG / PNG / PDF)'}
              </span>
              <span className="mt-1.5 text-xs text-ink-muted">
                El concepto se rellena con el nombre del archivo; también
                intentamos leer importe y fecha
              </span>
              <input
                id="invoice-file"
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

            {hasInvoice && (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="!px-3.5"
                  onClick={() => setPreviewOpen(true)}
                >
                  <Eye size={14} />
                  Vista previa
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="!px-3.5"
                  onClick={() => void handleDownloadInvoice()}
                >
                  <Download size={14} />
                  Descargar
                </Button>
                {isEditing && !clearInvoice && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="!px-3.5"
                    onClick={() => {
                      setClearInvoice(true)
                      setInvoiceFile(null)
                      setFileName('')
                      setInvoiceMimeType('')
                    }}
                  >
                    Quitar factura
                  </Button>
                )}
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="description">Concepto</Label>
            <Input
              id="description"
              placeholder="Se rellena con el nombre del archivo"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="area">Categoría</Label>
              <Select
                id="area"
                value={areaId}
                onChange={(e) => handleAreaChange(e.target.value as AreaId)}
              >
                {areaChoices.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <Label htmlFor="specialty">Especialidad</Label>
              <Select
                id="specialty"
                value={specialtyId}
                onChange={(e) =>
                  handleSpecialtyChange(e.target.value as SpecialtyId | '')
                }
                required={requiresSpecialty}
                disabled={!requiresSpecialty}
              >
                {!requiresSpecialty && <option value="">—</option>}
                {SPECIALTIES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="amount">Importe total (€)</Label>
              <Input
                id="amount"
                type="number"
                min="0"
                step="0.01"
                placeholder="0,00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
              <p className="mt-1.5 text-[11px] text-ink-muted">
                {vatExempt
                  ? 'Operación exenta: el importe se registra sin IVA.'
                  : vatBreakdown
                    ? `IVA ${formatCurrencyPrecise(vatBreakdown.vatAmount)} (${formatVatPercent(parsedRate)} % del total) · Base ${formatCurrencyPrecise(vatBreakdown.netAmount)}`
                    : `IVA = ${formatVatPercent(parsedRate)} % del total · Base = total − IVA.`}
              </p>
            </div>
            <div>
              <Label htmlFor="date">Fecha</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-3 rounded-2xl border border-sand/80 bg-cream-dark/50 px-4 py-3">
            <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-ink-muted">
              Desglose IVA
            </p>
            <p className="text-[11px] leading-relaxed text-ink-muted">
              El importe es el total con IVA (salvo exentas). Oftalmología en
              Clínica y facturas al hospital van exentas; estética, al 21 %.
              El 15 % del hospital es retención IRPF, no IVA.
            </p>

            <label className="flex cursor-pointer items-start gap-2.5 text-sm text-ink">
              <input
                type="checkbox"
                className="mt-0.5 accent-ink"
                checked={vatExempt}
                onChange={(e) => setVatExempt(e.target.checked)}
              />
              <span>Operación exenta de IVA</span>
            </label>

            {!vatExempt && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="vat-rate">Tipo IVA (%)</Label>
                  <Input
                    id="vat-rate"
                    type="number"
                    min="0"
                    step="0.01"
                    value={vatRateInput}
                    onChange={(e) => setVatRateInput(e.target.value)}
                  />
                </div>
                {type === 'gasto' && (
                  <label className="flex cursor-pointer items-center gap-2.5 self-end pb-3 text-sm text-ink">
                    <input
                      type="checkbox"
                      className="accent-ink"
                      checked={vatDeductible}
                      onChange={(e) => setVatDeductible(e.target.checked)}
                    />
                    <span>IVA soportado deducible</span>
                  </label>
                )}
              </div>
            )}

            <dl className="space-y-1.5 border-t border-sand/70 pt-3 text-sm">
              <div className="flex items-center justify-between gap-4">
                <dt className="font-medium text-ink">Total</dt>
                <dd className="font-medium tabular-nums text-ink">
                  {vatBreakdown
                    ? formatCurrencyPrecise(vatBreakdown.grossAmount)
                    : '—'}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-ink-soft">
                  {revenueSide ? 'IVA repercutido' : 'IVA soportado'}
                  {type === 'devolucion' ? ' (devolución)' : ''}
                  {!vatExempt && ` (${formatVatPercent(parsedRate)} %)`}
                </dt>
                <dd className="tabular-nums text-ink">
                  {vatBreakdown
                    ? formatCurrencyPrecise(vatBreakdown.vatAmount)
                    : '—'}
                </dd>
              </div>
              {type === 'gasto' && !vatExempt && (
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-ink-soft">IVA deducible</dt>
                  <dd className="tabular-nums text-ink">
                    {vatBreakdown
                      ? formatCurrencyPrecise(
                          vatDeductible ? vatBreakdown.vatAmount : 0,
                        )
                      : '—'}
                  </dd>
                </div>
              )}
              <div className="flex items-center justify-between gap-4">
                <dt className="text-ink-soft">Base (sin IVA)</dt>
                <dd className="tabular-nums text-ink">
                  {vatBreakdown
                    ? formatCurrencyPrecise(vatBreakdown.netAmount)
                    : '—'}
                </dd>
              </div>
            </dl>
          </div>

          {showIrpf && (
            <div className="space-y-3 rounded-2xl border border-sand/80 bg-cream-dark/50 px-4 py-3">
              <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-ink-muted">
                Retención IRPF
              </p>
              <p className="text-[11px] leading-relaxed text-ink-muted">
                Retención practicada por el hospital sobre la base de la
                factura. No forma parte del IVA ni se resta de él.
              </p>
              <div>
                <Label htmlFor="irpf-rate">Tipo IRPF (%)</Label>
                <Input
                  id="irpf-rate"
                  type="number"
                  min="0"
                  step="0.01"
                  value={irpfRateInput}
                  onChange={(e) => setIrpfRateInput(e.target.value)}
                />
              </div>
              <dl className="space-y-1.5 border-t border-sand/70 pt-3 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-ink-soft">
                    IRPF retenido
                    {parsedIrpfRate > 0 &&
                      ` (${formatVatPercent(parsedIrpfRate)} %)`}
                  </dt>
                  <dd className="tabular-nums text-ink">
                    {vatBreakdown
                      ? formatCurrencyPrecise(irpfAmount)
                      : '—'}
                  </dd>
                </div>
              </dl>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={handleClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={scanning}>
              {isEditing ? 'Guardar cambios' : 'Guardar movimiento'}
            </Button>
          </div>
        </form>
      )}
    </Dialog>

    <InvoicePreviewModal
      open={previewOpen}
      onClose={() => setPreviewOpen(false)}
      transactionId={invoiceFile ? undefined : transaction?.id}
      fileName={fileName || transaction?.invoiceFileName}
      file={invoiceFile}
      mimeType={invoiceMimeType || invoiceFile?.type || transaction?.invoiceMimeType}
    />
    </>
  )
}
