import { useState, type FormEvent } from 'react'
import { Button, Input, Label } from '../components/ui'
import { loginWithPassword } from '../lib/auth'

interface Props {
  onSuccess: () => void
}

export function Login({ onSuccess }: Props) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (loginWithPassword(password)) {
      setError(false)
      onSuccess()
      return
    }
    setError(true)
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm animate-fade-up">
        <div className="mb-8 text-center">
          <img
            src="/logo-clinica-burgos.png"
            alt="Clínica Burgos"
            className="mx-auto h-7 w-auto md:h-8"
          />
          <h1 className="mt-6 font-display text-3xl font-medium tracking-tight text-ink">
            CB Operaciones
          </h1>
          <p className="mt-2 text-sm text-ink-soft">Acceso interno</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-[1.25rem] border border-sand/60 bg-white-soft/80 p-6 shadow-[0_10px_40px_rgba(45,41,38,0.04)] backdrop-blur-sm"
        >
          <Label htmlFor="password">Contraseña</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            autoFocus
            placeholder="Introduce la contraseña"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              if (error) setError(false)
            }}
            required
          />
          {error && (
            <p className="mt-2 text-xs text-rose">Contraseña incorrecta</p>
          )}
          <div className="mt-5">
            <Button type="submit" className="w-full">
              Entrar
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
