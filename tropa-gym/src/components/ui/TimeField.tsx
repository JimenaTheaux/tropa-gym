import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useInputMascara } from '@/hooks/useInputMascara'
import { useReportarValidez, type ValidezCampos } from '@/hooks/useValidezCampos'
import { MASCARA_HORA } from '@/lib/mascara'
import { cn } from '@/lib/utils'

interface TimeFieldProps {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  required?: boolean
  disabled?: boolean
  error?: string
  validez?: ValidezCampos
}

// "HH:mm" en 24 hs, o null si no es una hora que exista. Con `flexible`, también 9:30.
function parseHora(texto: string, flexible = false): string | null {
  const partes = (flexible ? /^(\d{1,2}):(\d{2})$/ : /^(\d{2}):(\d{2})$/).exec(texto.trim())
  if (!partes) return null
  const [h, m] = [Number(partes[1]), Number(partes[2])]
  if (h > 23 || m > 59) return null
  return `${String(h).padStart(2, '0')}:${partes[2]}`
}

export function TimeField({ id, label, value, onChange, required, disabled, error, validez }: TimeFieldProps) {
  const [borrador, setBorrador] = useState(value)
  const [errorPropio, setErrorPropio] = useState<string | null>(null)
  const ultimoEmitido = useRef(value)

  useEffect(() => {
    if (value === ultimoEmitido.current) return
    ultimoEmitido.current = value
    setBorrador(value)
    setErrorPropio(null)
  }, [value])

  useReportarValidez(validez, id, borrador ? !!parseHora(borrador, true) : !required)

  function emitir(nuevo: string) {
    if (nuevo === ultimoEmitido.current) return
    ultimoEmitido.current = nuevo
    onChange(nuevo)
  }

  function evaluar(texto: string, final: boolean): string | null {
    if (!texto) {
      emitir('')
      setErrorPropio(final && required ? 'Hora incompleta' : null)
      return null
    }
    const hora = parseHora(texto, final)
    if (!hora) {
      setErrorPropio(/^\d{2}:\d{2}$/.test(texto) ? 'Hora inválida' : final ? 'Hora incompleta' : null)
      return null
    }
    setErrorPropio(null)
    emitir(hora)
    return hora
  }

  const mascara = useInputMascara(borrador, MASCARA_HORA, (texto) => {
    setBorrador(texto)
    evaluar(texto, false)
  })

  function alSalir() {
    const hora = evaluar(borrador, true)
    if (hora) setBorrador(hora)
  }

  function alTeclear(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      alSalir()
      return
    }
    mascara.onKeyDown(e)
  }

  const mensaje = errorPropio ?? error ?? null
  const idError = `${id}-error`

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="font-oswald text-[11px] uppercase tracking-[0.05em] text-on-surface-variant">
        {label}
      </label>
      <input
        ref={mascara.ref}
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="HH:MM"
        maxLength={6}
        required={required}
        disabled={disabled}
        aria-invalid={!!mensaje}
        aria-describedby={mensaje ? idError : undefined}
        value={borrador}
        onChange={mascara.onChange}
        onKeyDown={alTeclear}
        onBlur={alSalir}
        className={cn(
          'w-full rounded-lg border bg-surface-container-low px-3 py-2 font-inter text-sm text-on-surface outline-none focus:border-primary disabled:opacity-50',
          mensaje ? 'border-error' : 'border-outline-variant',
        )}
      />
      {mensaje && (
        <p id={idError} role="alert" className="font-inter text-xs text-error">
          {mensaje}
        </p>
      )}
    </div>
  )
}
