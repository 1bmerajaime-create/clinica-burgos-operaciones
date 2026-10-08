import { ArrowUpRight, Package, Plus, ShoppingBag, Trash2 } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { useFinance } from '../context/FinanceContext'
import { productSaleProfit } from '../lib/analytics'
import {
  formatCurrency,
  formatCurrencyPrecise,
  formatDate,
  formatSignedCurrency,
  sentimentClass,
} from '../lib/format'
import type { AestheticProduct, AreaId } from '../types'
import { Button, Card, Dialog, Input, Label, SectionTitle, Textarea } from './ui'
import { SignedAmount } from './SignedAmount'

interface Props {
  areaId: AreaId
}

type ModalMode =
  | { type: 'product'; product?: AestheticProduct }
  | { type: 'restock'; product: AestheticProduct }
  | { type: 'sell'; product: AestheticProduct }
  | null

export function ProductsSection({ areaId }: Props) {
  const {
    products,
    productSales,
    addProduct,
    updateProduct,
    removeProduct,
    restockProduct,
    sellProduct,
  } = useFinance()

  const [modal, setModal] = useState<ModalMode>(null)
  const [salesOpen, setSalesOpen] = useState(false)

  const areaProducts = useMemo(
    () => products.filter((p) => p.areaId === areaId),
    [products, areaId],
  )

  const areaSales = useMemo(
    () =>
      productSales
        .filter((s) => s.areaId === areaId)
        .slice()
        .sort((a, b) => b.date.localeCompare(a.date)),
    [productSales, areaId],
  )

  const salesRevenue = areaSales.reduce(
    (acc, s) => acc + s.unitSalePrice * s.quantity,
    0,
  )
  const salesCost = areaSales.reduce(
    (acc, s) => acc + s.unitCost * s.quantity,
    0,
  )
  const salesProfit = salesRevenue - salesCost

  const productName = (id: string) =>
    areaProducts.find((p) => p.id === id)?.name ??
    products.find((p) => p.id === id)?.name ??
    'Producto'

  return (
    <Card className="animate-fade-up-delay-2">
      <SectionTitle
        eyebrow="Inventario"
        title="Productos"
        action={
          <Button onClick={() => setModal({ type: 'product' })}>
            <Plus size={14} />
            Producto
          </Button>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-sand/60 bg-cream/40 p-4">
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-ink-muted">
            Beneficio
          </p>
          <p className={`mt-2 font-display text-2xl ${sentimentClass(salesProfit)}`}>
            {formatSignedCurrency(salesProfit)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setSalesOpen(true)}
          className="group rounded-2xl border border-sand/60 bg-cream/40 p-4 text-left transition hover:border-ink/20 hover:shadow-[0_10px_28px_rgba(45,41,38,0.06)]"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-ink-muted">
              Total ventas
            </p>
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-ink/15 text-ink transition group-hover:bg-ink group-hover:text-cream">
              <ArrowUpRight size={13} />
            </span>
          </div>
          <p
            className={`mt-2 font-display text-2xl ${sentimentClass(salesRevenue, 'income')}`}
          >
            {formatCurrency(salesRevenue)}
          </p>
        </button>
        <div className="rounded-2xl border border-sand/60 bg-cream/40 p-4">
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-ink-muted">
            Gasto productos
          </p>
          <p
            className={`mt-2 font-display text-2xl ${sentimentClass(salesCost, 'expense')}`}
          >
            {formatCurrency(salesCost)}
          </p>
        </div>
      </div>

      {areaProducts.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink-muted">
          Aún no hay productos. Añade el stock para registrar ventas y margen.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-sand/50">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-cream/80 text-[10px] uppercase tracking-[0.12em] text-ink-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Producto</th>
                <th className="px-4 py-3 font-medium">Stock</th>
                <th className="px-4 py-3 font-medium">Coste</th>
                <th className="px-4 py-3 font-medium">PVP</th>
                <th className="px-4 py-3 font-medium">Margen ud.</th>
                <th className="px-4 py-3 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {areaProducts.map((p) => {
                const margin = p.salePrice - p.unitCost
                return (
                  <tr key={p.id} className="border-t border-sand/40">
                    <td className="px-4 py-3 font-medium text-ink">{p.name}</td>
                    <td className="px-4 py-3 tabular-nums">{p.stock}</td>
                    <td className="px-4 py-3 tabular-nums text-ink-soft">
                      {formatCurrencyPrecise(p.unitCost)}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-ink-soft">
                      {formatCurrencyPrecise(p.salePrice)}
                    </td>
                    <td
                      className={`px-4 py-3 tabular-nums ${sentimentClass(margin)}`}
                    >
                      {formatSignedCurrency(margin)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          title="Vender"
                          disabled={p.stock <= 0}
                          onClick={() => setModal({ type: 'sell', product: p })}
                          className="rounded-full p-2 text-ink-soft transition hover:bg-cream-dark hover:text-ink disabled:opacity-30"
                        >
                          <ShoppingBag size={15} />
                        </button>
                        <button
                          type="button"
                          title="Reponer stock"
                          onClick={() => setModal({ type: 'restock', product: p })}
                          className="rounded-full p-2 text-ink-soft transition hover:bg-cream-dark hover:text-ink"
                        >
                          <Package size={15} />
                        </button>
                        <button
                          type="button"
                          title="Editar"
                          onClick={() => setModal({ type: 'product', product: p })}
                          className="rounded-full px-2.5 py-1.5 text-[10px] font-medium uppercase tracking-[0.1em] text-ink-soft transition hover:bg-cream-dark hover:text-ink"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          title="Eliminar"
                          onClick={() => {
                            if (
                              window.confirm(
                                `¿Eliminar el producto «${p.name}»?`,
                              )
                            ) {
                              removeProduct(p.id)
                            }
                          }}
                          className="rounded-full p-2 text-ink-soft transition hover:bg-rose/10 hover:text-rose"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog
        open={salesOpen}
        onClose={() => setSalesOpen(false)}
        title="Total ventas"
        size="lg"
      >
        <p className="mb-4 text-xs text-ink-muted">
          {areaSales.length} venta{areaSales.length === 1 ? '' : 's'} ·{' '}
          {formatCurrency(salesRevenue)}
        </p>
        {areaSales.length === 0 ? (
          <p className="py-10 text-center text-sm text-ink-muted">
            Todavía no hay ventas registradas.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-sand/50">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="bg-cream/80 text-[10px] uppercase tracking-[0.12em] text-ink-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Fecha</th>
                  <th className="px-4 py-3 font-medium">Producto</th>
                  <th className="px-4 py-3 font-medium">Ud.</th>
                  <th className="px-4 py-3 font-medium">Ingreso</th>
                  <th className="px-4 py-3 font-medium">Coste</th>
                  <th className="px-4 py-3 font-medium">Beneficio</th>
                </tr>
              </thead>
              <tbody>
                {areaSales.map((s) => {
                  const profit = productSaleProfit(s)
                  return (
                    <tr key={s.id} className="border-t border-sand/40">
                      <td className="px-4 py-3 text-ink-soft">
                        {formatDate(s.date)}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-ink">
                          {productName(s.productId)}
                        </p>
                        {s.note && (
                          <p className="text-xs text-ink-muted">{s.note}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 tabular-nums">{s.quantity}</td>
                      <td
                        className={`px-4 py-3 tabular-nums ${sentimentClass(1, 'income')}`}
                      >
                        {formatCurrency(s.unitSalePrice * s.quantity)}
                      </td>
                      <td
                        className={`px-4 py-3 tabular-nums ${sentimentClass(1, 'expense')}`}
                      >
                        {formatCurrency(s.unitCost * s.quantity)}
                      </td>
                      <td
                        className={`px-4 py-3 tabular-nums ${sentimentClass(profit)}`}
                      >
                        {formatSignedCurrency(profit)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Dialog>

      {modal?.type === 'product' && (
        <ProductFormModal
          key={modal.product?.id ?? 'new-product'}
          open
          areaId={areaId}
          product={modal.product}
          onClose={() => setModal(null)}
          onSave={(input) => {
            if (modal.product) updateProduct(modal.product.id, input)
            else addProduct(input)
            setModal(null)
          }}
        />
      )}

      {modal?.type === 'restock' && (
        <RestockModal
          key={`restock-${modal.product.id}`}
          open
          product={modal.product}
          onClose={() => setModal(null)}
          onSave={(qty, unitCost) => {
            restockProduct(modal.product.id, qty, unitCost)
            setModal(null)
          }}
        />
      )}

      {modal?.type === 'sell' && (
        <SellModal
          key={`sell-${modal.product.id}`}
          open
          product={modal.product}
          onClose={() => setModal(null)}
          onSave={(payload) => {
            sellProduct(payload)
            setModal(null)
          }}
        />
      )}
    </Card>
  )
}

function ProductFormModal({
  open,
  areaId,
  product,
  onClose,
  onSave,
}: {
  open: boolean
  areaId: AreaId
  product?: AestheticProduct
  onClose: () => void
  onSave: (input: {
    areaId: AreaId
    name: string
    unitCost: number
    salePrice: number
    stock: number
  }) => void
}) {
  const [name, setName] = useState(product?.name ?? '')
  const [unitCost, setUnitCost] = useState(
    product ? String(product.unitCost) : '',
  )
  const [salePrice, setSalePrice] = useState(
    product ? String(product.salePrice) : '',
  )
  const [stock, setStock] = useState(product ? String(product.stock) : '0')

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const cost = Number(unitCost.replace(',', '.'))
    const price = Number(salePrice.replace(',', '.'))
    const qty = Number(stock.replace(',', '.'))
    if (!name.trim() || !(cost >= 0) || !(price >= 0) || !(qty >= 0)) return
    onSave({
      areaId,
      name: name.trim(),
      unitCost: cost,
      salePrice: price,
      stock: Math.floor(qty),
    })
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={product ? 'Editar producto' : 'Nuevo producto'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="prod-name">Nombre</Label>
          <Input
            id="prod-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej. Toxina botulínica"
            required
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="prod-cost">Coste unitario (€)</Label>
            <Input
              id="prod-cost"
              inputMode="decimal"
              value={unitCost}
              onChange={(e) => setUnitCost(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="prod-price">Precio venta (€)</Label>
            <Input
              id="prod-price"
              inputMode="decimal"
              value={salePrice}
              onChange={(e) => setSalePrice(e.target.value)}
              required
            />
          </div>
        </div>
        <div>
          <Label htmlFor="prod-stock">Stock actual</Label>
          <Input
            id="prod-stock"
            inputMode="numeric"
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            required
          />
        </div>
        {(Number(salePrice.replace(',', '.')) || 0) -
          (Number(unitCost.replace(',', '.')) || 0) !==
          0 && (
          <p className="text-xs text-ink-muted">
            Margen unitario:{' '}
            <span
              className={sentimentClass(
                (Number(salePrice.replace(',', '.')) || 0) -
                  (Number(unitCost.replace(',', '.')) || 0),
              )}
            >
              {formatSignedCurrency(
                (Number(salePrice.replace(',', '.')) || 0) -
                  (Number(unitCost.replace(',', '.')) || 0),
              )}
            </span>
          </p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit">Guardar</Button>
        </div>
      </form>
    </Dialog>
  )
}

function RestockModal({
  open,
  product,
  onClose,
  onSave,
}: {
  open: boolean
  product: AestheticProduct
  onClose: () => void
  onSave: (quantity: number, unitCost?: number) => void
}) {
  const [qty, setQty] = useState('1')
  const [unitCost, setUnitCost] = useState(String(product.unitCost))

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const quantity = Math.floor(Number(qty.replace(',', '.')))
    const cost = Number(unitCost.replace(',', '.'))
    if (!(quantity > 0)) return
    onSave(quantity, cost >= 0 ? cost : undefined)
  }

  return (
    <Dialog open={open} onClose={onClose} title={`Reponer · ${product.name}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-ink-soft">
          Stock actual: <strong className="text-ink">{product.stock}</strong>
        </p>
        <div>
          <Label htmlFor="restock-qty">Unidades a añadir</Label>
          <Input
            id="restock-qty"
            inputMode="numeric"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="restock-cost">Coste unitario (€)</Label>
          <Input
            id="restock-cost"
            inputMode="decimal"
            value={unitCost}
            onChange={(e) => setUnitCost(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit">Reponer</Button>
        </div>
      </form>
    </Dialog>
  )
}

function SellModal({
  open,
  product,
  onClose,
  onSave,
}: {
  open: boolean
  product: AestheticProduct
  onClose: () => void
  onSave: (input: {
    productId: string
    quantity: number
    unitSalePrice: number
    date: string
    note?: string
    registerInFinance: boolean
  }) => void
}) {
  const [qty, setQty] = useState('1')
  const [price, setPrice] = useState(String(product.salePrice))
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [note, setNote] = useState('')
  const [registerInFinance, setRegisterInFinance] = useState(true)

  const quantity = Math.floor(Number(qty.replace(',', '.')) || 0)
  const unitSalePrice = Number(price.replace(',', '.')) || 0
  const profit = (unitSalePrice - product.unitCost) * Math.max(quantity, 0)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (quantity <= 0 || quantity > product.stock || unitSalePrice < 0) return
    onSave({
      productId: product.id,
      quantity,
      unitSalePrice,
      date,
      note: note.trim() || undefined,
      registerInFinance,
    })
  }

  return (
    <Dialog open={open} onClose={onClose} title={`Venta · ${product.name}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-ink-soft">
          Disponible: <strong className="text-ink">{product.stock}</strong> ·
          Coste ud. {formatCurrencyPrecise(product.unitCost)}
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="sell-qty">Cantidad</Label>
            <Input
              id="sell-qty"
              inputMode="numeric"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="sell-price">Precio venta ud. (€)</Label>
            <Input
              id="sell-price"
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
            />
          </div>
        </div>
        <div>
          <Label htmlFor="sell-date">Fecha</Label>
          <Input
            id="sell-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="sell-note">Nota (opcional)</Label>
          <Textarea
            id="sell-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Tratamiento, paciente…"
          />
        </div>

        <div className="rounded-2xl border border-sand/60 bg-cream/50 p-4">
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-ink-muted">
            Beneficio estimado
          </p>
          <div className="mt-1">
            <SignedAmount value={profit} size="lg" />
          </div>
          <p className="mt-2 text-xs text-ink-muted">
            Ingreso {formatCurrency(unitSalePrice * Math.max(quantity, 0))} −
            coste {formatCurrency(product.unitCost * Math.max(quantity, 0))}
          </p>
        </div>

        <label className="flex cursor-pointer items-start gap-3 text-sm text-ink-soft">
          <input
            type="checkbox"
            checked={registerInFinance}
            onChange={(e) => setRegisterInFinance(e.target.checked)}
            className="mt-1"
          />
          <span>
            Registrar también en movimientos (ingreso por venta y gasto por
            coste del producto)
          </span>
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={quantity > product.stock}>
            Confirmar venta
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
