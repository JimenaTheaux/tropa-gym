import { useEffect, useState } from 'react'
import type { ChangeEvent, FocusEvent, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'

const fieldClass =
  'w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 font-inter text-sm text-on-surface outline-none focus:border-primary disabled:opacity-50'

interface FieldShellProps {
  label: string
  htmlFor: string
  error?: string
  children: ReactNode
}

function FieldShell({ label, htmlFor, error, children }: FieldShellProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={htmlFor}
        className="font-oswald text-[11px] uppercase tracking-[0.05em] text-on-surface-variant"
      >
        {label}
      </label>
      {children}
      {error && <p className="font-inter text-xs text-error">{error}</p>}
    </div>
  )
}

interface FormInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
}

export function FormInput({ label, error, id, className, onFocus, ...props }: FormInputProps) {
  // Selecciona todo el contenido al enfocar un input numérico — sin esto,
  // el "0" inicial queda delante del cursor y hay que borrarlo a mano
  // antes de poder escribir el primer dígito.
  function handleFocus(e: FocusEvent<HTMLInputElement>) {
    if (props.type === 'number') e.target.select()
    onFocus?.(e)
  }

  return (
    <FieldShell label={label} htmlFor={id!} error={error}>
      <input id={id} className={`${fieldClass} ${className ?? ''}`} {...props} onFocus={handleFocus} />
    </FieldShell>
  )
}

interface FormCurrencyInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string
  error?: string
}

// Input de monto acotado (no ocupa el ancho completo del form): prefijo "$"
// a la izquierda dentro del campo, valor numérico alineado a la derecha.
// Sin flechas de incremento (no aportan nada para tipear un monto) y sin el
// "0" precargado (se muestra vacío con placeholder "0" hasta que se escribe
// un valor real), así no hay que borrar nada a mano antes de tipear.
export function FormCurrencyInput({ label, error, id, className, onFocus, value, ...props }: FormCurrencyInputProps) {
  function handleFocus(e: FocusEvent<HTMLInputElement>) {
    e.target.select()
    onFocus?.(e)
  }

  return (
    <FieldShell label={label} htmlFor={id!} error={error}>
      <div className="flex w-fit min-w-[200px] items-center gap-1 rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 focus-within:border-primary">
        <span className="font-inter text-sm text-on-surface-variant">$</span>
        <input
          id={id}
          type="number"
          inputMode="decimal"
          placeholder="0"
          value={value === 0 ? '' : value}
          className={`w-full bg-transparent text-right font-inter text-sm text-on-surface outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none disabled:opacity-50 ${className ?? ''}`}
          {...props}
          onFocus={handleFocus}
        />
      </div>
    </FieldShell>
  )
}

interface FormSelectOption {
  value: string
  label: string
}

interface FormSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  error?: string
  options: FormSelectOption[]
  placeholder?: string
}

interface FormCheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string
}

export function FormCheckbox({ label, id, className, ...props }: FormCheckboxProps) {
  return (
    <label htmlFor={id} className="flex items-center gap-2 font-inter text-sm text-on-surface">
      <input
        id={id}
        type="checkbox"
        className={`h-4 w-4 rounded border-outline-variant text-primary focus:ring-primary ${className ?? ''}`}
        {...props}
      />
      {label}
    </label>
  )
}

export function FormSelect({
  label,
  error,
  id,
  options,
  placeholder,
  className,
  ...props
}: FormSelectProps) {
  return (
    <FieldShell label={label} htmlFor={id!} error={error}>
      <select id={id} className={`${fieldClass} ${className ?? ''}`} {...props}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </FieldShell>
  )
}

interface FormDateInputProps {
  id: string
  label: string
  required?: boolean
  error?: string
  value: string
  onChange: (value: string) => void
}

function isoADisplay(iso: string): string {
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return ''
  return `${d}/${m}/${y}`
}

// Arma dd/mm/aaaa a medida que se escribe, sólo dígitos — acepta pegar
// "05031990" o "05/03/1990" igual. Recorta día a 31 y mes a 12 mientras
// se tipea para no dejar escribir valores imposibles.
function maskFecha(raw: string): string {
  const digitos = raw.replace(/\D/g, '').slice(0, 8)
  let dd = digitos.slice(0, 2)
  let mm = digitos.slice(2, 4)
  const yyyy = digitos.slice(4, 8)
  if (dd.length === 2 && Number(dd) > 31) dd = '31'
  if (mm.length === 2 && Number(mm) > 12) mm = '12'
  return [dd, mm, yyyy].filter(Boolean).join('/')
}

// Reemplaza <input type="date"> nativo: el formato del picker depende del
// sistema operativo, no de lang="es-AR". Un solo campo de texto con máscara
// propia garantiza dd/mm/aaaa siempre, con el mismo aspecto de un input único.
export function FormDateInput({ id, label, required, error, value, onChange }: FormDateInputProps) {
  const [texto, setTexto] = useState(isoADisplay(value))

  useEffect(() => {
    setTexto(isoADisplay(value))
  }, [value])

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const masked = maskFecha(e.target.value)
    setTexto(masked)
    const [dd, mm, yyyy] = masked.split('/')
    if (dd?.length === 2 && mm?.length === 2 && yyyy?.length === 4) {
      onChange(`${yyyy}-${mm}-${dd}`)
    } else if (masked === '') {
      onChange('')
    }
  }

  function handleBlur() {
    setTexto(isoADisplay(value))
  }

  return (
    <FieldShell label={label} htmlFor={id} error={error}>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        placeholder="DD/MM/AAAA"
        maxLength={10}
        required={required}
        value={texto}
        onChange={handleChange}
        onBlur={handleBlur}
        className={fieldClass}
      />
    </FieldShell>
  )
}

const HORAS_24 = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const MINUTOS_24 = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'))

interface FormTimeInputProps {
  id: string
  label: string
  required?: boolean
  error?: string
  value: string
  onChange: (value: string) => void
}

// Reemplaza <input type="time"> nativo — el picker del navegador a veces
// muestra AM/PM según el idioma del sistema operativo aunque la página esté
// en español. Con dos <select> propios queda garantizado el formato 24hs.
export function FormTimeInput({ id, label, required, error, value, onChange }: FormTimeInputProps) {
  const [hh = '', mm = ''] = value ? value.split(':') : []

  return (
    <FieldShell label={label} htmlFor={`${id}-hh`} error={error}>
      <div className="flex items-center gap-2">
        <select
          id={`${id}-hh`}
          required={required}
          value={hh}
          onChange={(e) => onChange(e.target.value && mm ? `${e.target.value}:${mm}` : e.target.value ? `${e.target.value}:00` : '')}
          className={fieldClass}
        >
          <option value="">HH</option>
          {HORAS_24.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>
        <span className="font-inter text-sm text-on-surface-variant">:</span>
        <select
          id={`${id}-mm`}
          required={required}
          value={mm}
          onChange={(e) => onChange(hh ? `${hh}:${e.target.value}` : `00:${e.target.value}`)}
          className={fieldClass}
        >
          <option value="">MM</option>
          {MINUTOS_24.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <span className="font-inter text-xs text-on-surface-variant">HS</span>
      </div>
    </FieldShell>
  )
}
