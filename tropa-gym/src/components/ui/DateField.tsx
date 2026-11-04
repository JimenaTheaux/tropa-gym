import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react'
import { useInputMascara } from '@/hooks/useInputMascara'
import { addDays, formatDMY, hoyAR, parseDMY } from '@/lib/fecha'
import { MASCARA_FECHA } from '@/lib/mascara'
import { cn } from '@/lib/utils'

const ANIO_MINIMO = 1900
const ANIO_MAXIMO = 2100
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const DIAS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do']

function hoyMenosDosAnios(): string {
  const [y, m, d] = hoyAR().split('-')
  return `${Number(y) - 2}-${m}-${d}`
}

interface DateFieldProps {
  id: string
  label: string
  value: string | null
  onChange: (value: string | null) => void
  // Por defecto, de hace 2 años a hoy (igual que el servidor). allowFuture saca ambos
  // límites; min y max explícitos siempre mandan.
  min?: string
  max?: string
  allowFuture?: boolean
  required?: boolean
  disabled?: boolean
  error?: string
  atajos?: boolean
}

interface CalendarioProps {
  valor: string | null
  estaPermitida: (iso: string) => boolean
  atajos: boolean
  onElegir: (iso: string) => void
}

function Calendario({ valor, estaPermitida, atajos, onElegir }: CalendarioProps) {
  const base = valor ?? hoyAR()
  const [anio, setAnio] = useState(Number(base.slice(0, 4)))
  const [mes, setMes] = useState(Number(base.slice(5, 7)) - 1)
  const hoy = hoyAR()
  const ayer = addDays(hoy, -1)

  function moverMes(delta: number) {
    const total = anio * 12 + mes + delta
    setAnio(Math.floor(total / 12))
    setMes(total % 12)
  }

  const diasDelMes = new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate()
  const huecos = (new Date(Date.UTC(anio, mes, 1)).getUTCDay() + 6) % 7
  const iso = (dia: number) => `${anio}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
  const navegar = 'text-on-surface-variant hover:text-primary'

  return (
    <div className="absolute left-0 top-[calc(100%+4px)] z-50 w-[280px] rounded-card border border-outline-variant bg-surface-container p-3 shadow-lg">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button type="button" aria-label="Año anterior" onClick={() => setAnio((a) => a - 1)} className={navegar}>
            <span className="material-symbols-outlined !text-[18px]">keyboard_double_arrow_left</span>
          </button>
          <button type="button" aria-label="Mes anterior" onClick={() => moverMes(-1)} className={navegar}>
            <span className="material-symbols-outlined !text-[18px]">chevron_left</span>
          </button>
        </div>
        <span className="font-oswald text-sm font-semibold text-on-surface">
          {MESES[mes]} {anio}
        </span>
        <div className="flex items-center gap-1">
          <button type="button" aria-label="Mes siguiente" onClick={() => moverMes(1)} className={navegar}>
            <span className="material-symbols-outlined !text-[18px]">chevron_right</span>
          </button>
          <button type="button" aria-label="Año siguiente" onClick={() => setAnio((a) => a + 1)} className={navegar}>
            <span className="material-symbols-outlined !text-[18px]">keyboard_double_arrow_right</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {DIAS.map((d) => (
          <span key={d} className="py-1 text-center font-oswald text-[11px] uppercase text-on-surface-variant">
            {d}
          </span>
        ))}
        {Array.from({ length: huecos }, (_, i) => (
          <span key={`hueco-${i}`} />
        ))}
        {Array.from({ length: diasDelMes }, (_, i) => {
          const fecha = iso(i + 1)
          const permitida = estaPermitida(fecha)
          return (
            <button
              key={fecha}
              type="button"
              disabled={!permitida}
              aria-label={formatDMY(fecha)}
              aria-current={fecha === hoy ? 'date' : undefined}
              onClick={() => onElegir(fecha)}
              className={cn(
                'rounded-lg border py-1.5 font-inter text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-30',
                fecha === valor
                  ? 'border-primary bg-surface-container-high text-primary'
                  : fecha === hoy
                    ? 'border-outline-variant text-on-surface'
                    : 'border-transparent text-on-surface-variant hover:bg-surface-container-high',
              )}
            >
              {i + 1}
            </button>
          )
        })}
      </div>

      {atajos && (
        <div className="mt-3 flex gap-2 border-t border-outline-variant pt-2">
          {[
            { label: 'Hoy', fecha: hoy },
            { label: 'Ayer', fecha: ayer },
          ].map((a) => (
            <button
              key={a.label}
              type="button"
              disabled={!estaPermitida(a.fecha)}
              onClick={() => onElegir(a.fecha)}
              className="rounded-full border border-outline-variant px-3 py-1 font-inter text-xs text-on-surface hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-30"
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function DateField({
  id,
  label,
  value,
  onChange,
  min,
  max,
  allowFuture = false,
  required,
  disabled,
  error,
  atajos = true,
}: DateFieldProps) {
  const externo = value || null
  const [borrador, setBorrador] = useState(externo ? formatDMY(externo) : '')
  const [errorPropio, setErrorPropio] = useState<string | null>(null)
  const [abierto, setAbierto] = useState(false)
  const ultimoEmitido = useRef(externo)
  const contenedor = useRef<HTMLDivElement>(null)

  const hoy = hoyAR()
  const limiteMin = min ?? (allowFuture ? undefined : hoyMenosDosAnios())
  const limiteMax = max ?? (allowFuture ? undefined : hoy)

  // Solo un cambio que no salió de este campo reescribe el borrador (reset, otro
  // registro): mientras se tipea, el valor externo nunca pisa lo escrito.
  useEffect(() => {
    if (externo === ultimoEmitido.current) return
    ultimoEmitido.current = externo
    setBorrador(externo ? formatDMY(externo) : '')
    setErrorPropio(null)
  }, [externo])

  useEffect(() => {
    if (!abierto) return
    function fuera(e: MouseEvent) {
      if (contenedor.current && !contenedor.current.contains(e.target as Node)) setAbierto(false)
    }
    document.addEventListener('mousedown', fuera)
    return () => document.removeEventListener('mousedown', fuera)
  }, [abierto])

  function emitir(nuevo: string | null) {
    if (nuevo === ultimoEmitido.current) return
    ultimoEmitido.current = nuevo
    onChange(nuevo)
  }

  function errorDeRango(iso: string): string | null {
    const anio = Number(iso.slice(0, 4))
    if (anio < ANIO_MINIMO || anio > ANIO_MAXIMO) return 'Año fuera de rango'
    if (limiteMax && iso > limiteMax) {
      return limiteMax === hoy ? 'No puede ser futura' : `No puede ser posterior a ${formatDMY(limiteMax)}`
    }
    if (limiteMin && iso < limiteMin) return `No puede ser anterior a ${formatDMY(limiteMin)}`
    return null
  }

  // Solo sale una fecha completa, válida y en rango. `final` = se terminó de editar.
  function evaluar(texto: string, final: boolean): string | null {
    if (!texto) {
      emitir(null)
      setErrorPropio(final && required ? 'Fecha incompleta' : null)
      return null
    }
    const completa = /^\d{2}\/\d{2}\/\d{4}$/.test(texto)
    const iso = parseDMY(texto, final)
    if (!iso) {
      setErrorPropio(completa ? 'Fecha inválida' : final ? 'Fecha incompleta' : null)
      return null
    }
    const rango = errorDeRango(iso)
    setErrorPropio(rango)
    if (rango) return null
    emitir(iso)
    return iso
  }

  const mascara = useInputMascara(borrador, MASCARA_FECHA, (texto) => {
    setBorrador(texto)
    evaluar(texto, false)
  })

  function fijar(iso: string) {
    const texto = formatDMY(iso)
    mascara.aplicar(texto, texto.length)
    setBorrador(texto)
    setErrorPropio(null)
    emitir(iso)
  }

  function alSalir() {
    const iso = evaluar(borrador, true)
    if (iso) setBorrador(formatDMY(iso))
  }

  function alPegar(e: ClipboardEvent<HTMLInputElement>) {
    const iso = parseDMY(e.clipboardData.getData('text'), true)
    if (!iso) return
    e.preventDefault()
    const texto = formatDMY(iso)
    mascara.aplicar(texto, texto.length)
    setBorrador(texto)
    evaluar(texto, true)
  }

  function alTeclear(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault()
      const base = parseDMY(borrador) ?? externo ?? hoy
      const nueva = addDays(base, e.key === 'ArrowUp' ? 1 : -1)
      if (!errorDeRango(nueva)) fijar(nueva)
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      alSalir()
      return
    }
    if (e.key === 'Escape' && abierto) {
      // Sin esto, el Escape también cierra el Drawer que contiene al campo.
      e.stopPropagation()
      setAbierto(false)
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
      <div ref={contenedor} className="relative min-w-[190px]">
        <div
          className={cn(
            'flex items-center gap-2 rounded-lg border bg-surface-container-low px-3 py-2 focus-within:border-primary',
            mensaje ? 'border-error' : 'border-outline-variant',
            disabled && 'opacity-50',
          )}
        >
          <input
            ref={mascara.ref}
            id={id}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="DD/MM/AAAA"
            maxLength={12}
            required={required}
            disabled={disabled}
            aria-invalid={!!mensaje}
            aria-describedby={mensaje ? idError : undefined}
            value={borrador}
            onChange={mascara.onChange}
            onKeyDown={alTeclear}
            onPaste={alPegar}
            onBlur={alSalir}
            className="w-full min-w-0 bg-transparent font-inter text-sm text-on-surface outline-none"
          />
          <button
            type="button"
            disabled={disabled}
            aria-label={abierto ? 'Cerrar calendario' : 'Abrir calendario'}
            aria-expanded={abierto}
            onClick={() => setAbierto((v) => !v)}
            className="shrink-0 text-on-surface-variant hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          >
            <span className="material-symbols-outlined !text-[18px]">calendar_month</span>
          </button>
        </div>

        {abierto && (
          <Calendario
            valor={parseDMY(borrador) ?? externo}
            estaPermitida={(iso) => !errorDeRango(iso)}
            atajos={atajos}
            onElegir={(iso) => {
              fijar(iso)
              setAbierto(false)
            }}
          />
        )}
      </div>
      {mensaje && (
        <p id={idError} role="alert" className="font-inter text-xs text-error">
          {mensaje}
        </p>
      )}
    </div>
  )
}

type FormDateInputProps = Omit<DateFieldProps, 'value' | 'onChange'> & {
  value: string
  onChange: (value: string) => void
}

// DateField para los formularios que guardan la fecha como string, con '' si está vacía.
export function FormDateInput({ value, onChange, ...props }: FormDateInputProps) {
  return <DateField {...props} value={value} onChange={(nuevo) => onChange(nuevo ?? '')} />
}

interface DateRangeFieldProps {
  id: string
  label: string
  desde: string
  hasta: string
  onDesdeChange: (value: string) => void
  onHastaChange: (value: string) => void
  min?: string
}

// Un rango invertido se rechaza: cada extremo limita al otro.
export function DateRangeField({ id, label, desde, hasta, onDesdeChange, onHastaChange, min }: DateRangeFieldProps) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 font-oswald text-[11px] uppercase tracking-[0.05em] text-on-surface-variant">{label}</legend>
      <div className="flex flex-wrap items-start gap-3 rounded-lg border border-outline-variant p-3">
        <FormDateInput id={`${id}-desde`} label="Desde" value={desde} onChange={onDesdeChange} min={min} max={hasta || undefined} />
        <FormDateInput id={`${id}-hasta`} label="Hasta" value={hasta} onChange={onHastaChange} min={desde || min} />
      </div>
    </fieldset>
  )
}
