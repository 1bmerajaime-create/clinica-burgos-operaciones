import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react'

export function Button({
  variant = 'primary',
  className = '',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost'
}) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-[11px] font-medium uppercase tracking-[0.14em] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed'

  const variants = {
    primary:
      'bg-ink text-cream hover:bg-ink/90 shadow-sm hover:shadow-md active:scale-[0.98]',
    secondary:
      'border border-ink/25 bg-white-soft text-ink hover:border-ink/50 hover:bg-cream active:scale-[0.98]',
    ghost: 'text-ink-soft hover:text-ink hover:bg-cream-dark/60',
  }

  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  )
}

export function Card({
  children,
  className = '',
  tone = 'cream',
}: {
  children: ReactNode
  className?: string
  tone?: 'cream' | 'beige' | 'white'
}) {
  const tones = {
    cream: 'bg-white-soft/80 border-sand/60',
    beige: 'bg-cream-dark/70 border-sand/50',
    white: 'bg-white-soft border-sand/40',
  }

  return (
    <div
      className={`rounded-[1.25rem] border p-6 backdrop-blur-sm shadow-[0_10px_40px_rgba(45,41,38,0.04)] ${tones[tone]} ${className}`}
    >
      {children}
    </div>
  )
}

export function Label({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.16em] text-ink-muted"
    >
      {children}
    </label>
  )
}

const fieldClass =
  'w-full rounded-2xl border border-sand bg-cream/50 px-4 py-3 text-sm text-ink outline-none transition focus:border-ink/30 focus:bg-white-soft placeholder:text-ink-muted/70'

export function Input({
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${fieldClass} ${className}`} {...props} />
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative w-full">
      <select
        className="w-full cursor-pointer appearance-none rounded-xl border border-ink/20 bg-white-soft py-2.5 pl-3.5 pr-10 text-[13px] font-medium text-ink shadow-sm outline-none transition hover:border-ink/35 focus:border-ink/40 focus:bg-cream"
        {...props}
      />
      <span
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted"
        aria-hidden
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path
            d="M6 9l6 6 6-6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </div>
  )
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${fieldClass} min-h-[96px] resize-y`} {...props} />
}

export function SectionTitle({
  eyebrow,
  title,
  action,
}: {
  eyebrow?: string
  title: string
  action?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && (
          <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.2em] text-ink-muted">
            {eyebrow}
          </p>
        )}
        <h2 className="font-display text-xl font-medium tracking-tight text-ink md:text-2xl">
          {title}
        </h2>
      </div>
      {action}
    </div>
  )
}

export function Modal({
  open,
  onClose,
  title,
  eyebrow,
  children,
  size = 'md',
  elevated = false,
}: {
  open: boolean
  onClose: () => void
  title: string
  eyebrow?: string
  children: ReactNode
  size?: 'md' | 'lg' | 'xl'
  /** Por encima de otro modal (p.ej. formulario sobre listado) */
  elevated?: boolean
}) {
  if (!open || typeof document === 'undefined') return null

  const width =
    size === 'xl' ? 'max-w-5xl' : size === 'lg' ? 'max-w-4xl' : 'max-w-lg'

  return createPortal(
    <div
      className={`fixed inset-0 flex items-end justify-center p-4 sm:items-center ${
        elevated ? 'z-[90]' : 'z-[80]'
      }`}
    >
      <button
        type="button"
        className="absolute inset-0 bg-ink/35 backdrop-blur-[2px]"
        aria-label="Cerrar"
        onClick={onClose}
      />
      <div
        className={`relative z-10 flex max-h-[90vh] w-full ${width} animate-fade-up flex-col rounded-[1.5rem] border border-sand bg-cream p-6 shadow-2xl sm:p-8`}
      >
        <div className="mb-4 flex shrink-0 items-start justify-between gap-4">
          <div>
            {eyebrow && (
              <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.16em] text-ink-muted">
                {eyebrow}
              </p>
            )}
            <h3 className="font-display text-2xl font-medium text-ink">
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-ink/15 text-ink-soft transition hover:border-ink/40 hover:text-ink"
          >
            ✕
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>,
    document.body,
  )
}

/** Panel inferior para filtros y acciones en móvil. */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-[85] flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-ink/40 backdrop-blur-[2px] animate-fade-in"
        aria-label="Cerrar"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative z-10 flex max-h-[88vh] w-full max-w-lg animate-sheet-up flex-col rounded-t-[1.5rem] border border-sand bg-cream shadow-2xl sm:max-h-[85vh] sm:rounded-[1.5rem]"
      >
        <div className="flex shrink-0 flex-col items-center px-5 pt-3 pb-2 sm:hidden">
          <span className="mb-3 h-1 w-10 rounded-full bg-ink/15" aria-hidden />
        </div>
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-sand/70 px-5 pb-3 sm:px-6 sm:pt-5">
          <h3 className="font-display text-xl font-medium text-ink">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-ink/15 text-ink-soft transition hover:border-ink/40 hover:text-ink"
          >
            ✕
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 sm:px-6">
          {children}
        </div>
        {footer && (
          <div className="shrink-0 border-t border-sand/70 px-5 py-4 sm:px-6">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
