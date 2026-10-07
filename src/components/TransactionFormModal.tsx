import { useEffect, useState, type FormEvent } from 'react'
import { AREAS, SPECIALTIES, areaNeedsSpecialty } from '../data/areas'
import { useFinance } from '../context/FinanceContext'
import type {
  AreaId,
  SpecialtyId,
  Transaction,
  TransactionType,
} from '../types'
import { Button, Input, Label, Modal, Select, Textarea } from './ui'

interface Props {
  open: boolean
  onClose: () => void
  type?: TransactionType
  defaultAreaId?: AreaId
  defaultSpecialtyId?: SpecialtyId
  transaction?: Transaction | null
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
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [description, setDescription] = useState('')
  const [saved, setSaved] = useState(false)

  const needsSpecialty = areaNeedsSpecialty(areaId)

  useEffect(() => {
    if (!open) return

    if (transaction) {
      setType(transaction.type)
      setAreaId(transaction.areaId)
      setSpecialtyId(transaction.specialtyId ?? '')
      setAmount(String(transaction.amount))
      setDate(transaction.date)
      setDescription(transaction.description)
      setSaved(false)
      return
    }

    setType(typeProp)
    setAreaId(defaultAreaId)
    setSpecialtyId(
      areaNeedsSpecialty(defaultAreaId) ? defaultSpecialtyId : '',
    )
    setAmount('')
    setDate(new Date().toISOString().slice(0, 10))
    setDescription('')
    setSaved(false)
  }, [open, transaction, typeProp, defaultAreaId, defaultSpecialtyId])

  const title = isEditing
    ? 'Editar movimiento'
    : type === 'ingreso'
      ? 'Introducir ingreso'
      : 'Introducir gasto'

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

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const value = Number(amount.replace(',', '.'))
    if (!value || value <= 0 || !description.trim()) return
    if (needsSpecialty && !specialtyId) return

    const payload = {
      type,
      areaId,
      specialtyId: needsSpecialty ? (specialtyId as SpecialtyId) : undefined,
      amount: value,
      date,
      description: description.trim(),
      invoiceFileName: transaction?.invoiceFileName,
    }

    if (transaction) updateTransaction(transaction.id, payload)
    else addTransaction(payload)

    setSaved(true)
    setTimeout(handleClose, 700)
  }

  return (
    <Modal open={open} onClose={handleClose} title={title} elevated>
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
        <form onSubmit={handleSubmit} className="space-y-4">
          {isEditing && (
            <div>
              <Label htmlFor="type">Tipo</Label>
              <Select
                id="type"
                value={type}
                onChange={(e) => setType(e.target.value as TransactionType)}
              >
                <option value="ingreso">Ingreso</option>
                <option value="gasto">Gasto</option>
              </Select>
            </div>
          )}

          <div className={needsSpecialty ? 'grid gap-4 sm:grid-cols-2' : ''}>
            <div>
              <Label htmlFor="area">Categoría</Label>
              <Select
                id="area"
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
                <Label htmlFor="specialty">Especialidad</Label>
                <Select
                  id="specialty"
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
              <Label htmlFor="amount">Importe (€)</Label>
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

          <div>
            <Label htmlFor="description">Concepto</Label>
            <Textarea
              id="description"
              placeholder={
                type === 'ingreso'
                  ? 'Ej. Consultas oftalmológicas semana 1'
                  : 'Ej. Material quirúrgico proveedor X'
              }
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={handleClose}>
              Cancelar
            </Button>
            <Button type="submit">
              {isEditing
                ? 'Guardar cambios'
                : type === 'ingreso'
                  ? 'Guardar ingreso'
                  : 'Guardar gasto'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  )
}
