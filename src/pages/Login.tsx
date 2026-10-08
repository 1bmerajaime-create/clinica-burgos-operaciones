import { useState, type FormEvent } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Button, Input, Label } from '../components/ui'
import { login } from '../lib/auth'

interface Props {
  onSuccess: () => void
}

export function Login({ onSuccess }: Props) {
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(false)
    try {
      const ok = await login(password)
      if (ok) {
        onSuccess()
        return
      }
      setError(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid min-h-screen grid-rows-[1fr_auto_1fr] justify-items-center px-5">
      <div className="flex w-full items-center justify-center">
        <img
          src="/logo-clinica-burgos.png"
          alt="Clínica Burgos"
          className="h-6 w-auto animate-fade-up md:h-7"
        />
      </div>

      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="w-full max-w-sm animate-fade-up rounded-[1.25rem] border border-sand/60 bg-white-soft/90 px-6 py-8 shadow-[0_10px_40px_rgba(45,41,38,0.04)] backdrop-blur-sm"
      >
        <div className="mb-8 text-center">
          <h1 className="font-display text-lg font-medium tracking-tight text-[#4A3428] md:text-xl">
            Centro de operaciones
          </h1>
          <p className="mt-1.5 text-sm text-ink-soft">Acceso interno</p>
        </div>

        <Label htmlFor="password">Contraseña</Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            autoFocus
            placeholder="Introduce la contraseña"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              if (error) setError(false)
            }}
            className="pr-12"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-ink-muted transition hover:bg-cream-dark hover:text-ink"
            aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
            title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        {error && (
          <p className="mt-2 text-xs text-rose">Contraseña incorrecta</p>
        )}
        <div className="mt-5">
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? 'Entrando…' : 'Entrar'}
          </Button>
        </div>
      </form>

      <div aria-hidden />
    </div>
  )
}
