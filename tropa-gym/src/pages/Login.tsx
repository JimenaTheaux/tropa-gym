import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { getHomePath } from '@/config/nav'
import { Button } from '@/components/ui/button'

export function Login() {
  const { session, perfil, loading, signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [capsLockOn, setCapsLockOn] = useState(false)

  if (!loading && session && perfil) {
    return <Navigate to={getHomePath(perfil.rol)} replace />
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const { error } = await signIn(email, password)
    if (error) setError(error)
    setSubmitting(false)
  }

  function handlePasswordKey(e: KeyboardEvent<HTMLInputElement>) {
    setCapsLockOn(e.getModifierState('CapsLock'))
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-gutter">
      <div className="w-full max-w-sm rounded-card border border-outline-variant bg-surface-container p-8">
        <Link
          to="/"
          className="mb-6 inline-flex items-center gap-1 font-inter text-sm text-on-surface-variant hover:text-on-surface"
        >
          <span className="material-symbols-outlined !text-[18px]">arrow_back</span>
          Volver
        </Link>

        <div className="mb-8 flex justify-center">
          <img src="/logo_tropa_blanco.png" alt="Tropa Gym" className="h-auto w-full max-w-[280px]" />
        </div>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="font-oswald text-[11px] uppercase tracking-[0.05em] text-on-surface-variant">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 font-inter text-sm text-on-surface outline-none focus:border-primary"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="font-oswald text-[11px] uppercase tracking-[0.05em] text-on-surface-variant">
              Contraseña
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyUp={handlePasswordKey}
                onKeyDown={handlePasswordKey}
                className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 pr-10 font-inter text-sm text-on-surface outline-none focus:border-primary"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-on-surface-variant hover:text-on-surface"
              >
                <span className="material-symbols-outlined !text-[20px]">
                  {showPassword ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>
            {capsLockOn && (
              <p className="flex items-center gap-1 font-inter text-xs text-on-surface-variant">
                <span className="material-symbols-outlined !text-[16px]">info</span>
                Bloq Mayús activado
              </p>
            )}
          </div>

          {error && <p className="font-inter text-sm text-error">{error}</p>}

          <Button type="submit" variant="solido" disabled={submitting} className="mt-2 w-full">
            {submitting ? 'Ingresando…' : 'Ingresar'}
          </Button>
        </form>
      </div>
    </div>
  )
}
