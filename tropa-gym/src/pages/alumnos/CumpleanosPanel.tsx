import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { Alumno } from '@/types/db'
import { supabase } from '@/lib/supabase'
import { whatsappLink } from '@/lib/utils'
import { STALE_OPERATIVO } from '@/lib/queryClient'
import { BadgeEstado } from '@/components/ui/BadgeEstado'
import { Button } from '@/components/ui/button'
import { WhatsAppIcon } from '@/components/ui/WhatsAppIcon'

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]
const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

interface Cumple {
  alumno: Alumno
  dia: number
  mes: number // 1-12
  anioNacimiento: number
}

function parseCumple(alumno: Alumno): Cumple | null {
  if (!alumno.fecha_nacimiento) return null
  const [anio, mes, dia] = alumno.fecha_nacimiento.split('-').map(Number)
  if (!anio || !mes || !dia) return null
  return { alumno, dia, mes, anioNacimiento: anio }
}

async function fetchAlumnosConCumpleanos(): Promise<Alumno[]> {
  const { data, error } = await supabase.from('alumnos').select('*').not('fecha_nacimiento', 'is', null)
  if (error) return []
  return data as Alumno[]
}

export function CumpleanosPanel() {
  const { data: alumnos = [], isLoading: loading } = useQuery({
    queryKey: ['alumnos', 'cumpleanos'],
    queryFn: fetchAlumnosConCumpleanos,
    staleTime: STALE_OPERATIVO,
  })
  const hoy = useMemo(() => new Date(), [])
  const [viewYear, setViewYear] = useState(hoy.getFullYear())
  const [viewMonth, setViewMonth] = useState(hoy.getMonth())

  const cumples = useMemo(() => alumnos.map(parseCumple).filter((c): c is Cumple => c !== null), [alumnos])

  const porDia = useMemo(() => {
    const map = new Map<number, Cumple[]>()
    for (const c of cumples) {
      if (c.mes !== viewMonth + 1) continue
      const lista = map.get(c.dia) ?? []
      lista.push(c)
      map.set(c.dia, lista)
    }
    return map
  }, [cumples, viewMonth])

  const delMes = useMemo(
    () => cumples.filter((c) => c.mes === viewMonth + 1).sort((a, b) => a.dia - b.dia),
    [cumples, viewMonth],
  )

  const primerDiaMes = new Date(viewYear, viewMonth, 1)
  const diasEnMes = new Date(viewYear, viewMonth + 1, 0).getDate()
  const offsetInicial = (primerDiaMes.getDay() + 6) % 7 // lunes = 0

  const celdas: (number | null)[] = [
    ...Array.from({ length: offsetInicial }, () => null),
    ...Array.from({ length: diasEnMes }, (_, i) => i + 1),
  ]
  while (celdas.length % 7 !== 0) celdas.push(null)

  function esHoy(dia: number): boolean {
    return viewYear === hoy.getFullYear() && viewMonth === hoy.getMonth() && dia === hoy.getDate()
  }

  function mesAnterior() {
    if (viewMonth === 0) {
      setViewMonth(11)
      setViewYear((y) => y - 1)
    } else {
      setViewMonth((m) => m - 1)
    }
  }

  function mesSiguiente() {
    if (viewMonth === 11) {
      setViewMonth(0)
      setViewYear((y) => y + 1)
    } else {
      setViewMonth((m) => m + 1)
    }
  }

  function irAHoy() {
    setViewYear(hoy.getFullYear())
    setViewMonth(hoy.getMonth())
  }

  if (loading) {
    return <p className="py-10 text-center font-inter text-sm text-on-surface-variant">Cargando…</p>
  }

  if (cumples.length === 0) {
    return (
      <p className="py-10 text-center font-inter text-sm text-on-surface-variant">
        Todavía no hay fechas de nacimiento cargadas. Agregalas desde la ficha de cada alumno.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="rounded-card border border-outline-variant bg-surface-container p-5 lg:col-span-8">
          <div className="mb-4 flex items-center justify-between">
            <p className="font-anton text-xl text-on-surface">
              {MESES[viewMonth]} {viewYear}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={mesAnterior}
                aria-label="Mes anterior"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-outline-variant text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
              >
                <span className="material-symbols-outlined !text-[18px]">chevron_left</span>
              </button>
              <Button type="button" variant="ghost" onClick={irAHoy}>
                Hoy
              </Button>
              <button
                type="button"
                onClick={mesSiguiente}
                aria-label="Mes siguiente"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-outline-variant text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
              >
                <span className="material-symbols-outlined !text-[18px]">chevron_right</span>
              </button>
            </div>
          </div>

          <div className="mb-2 grid grid-cols-7 gap-1">
            {DIAS_SEMANA.map((d) => (
              <div
                key={d}
                className="py-1 text-center font-oswald text-[10px] uppercase tracking-[0.05em] text-on-surface-variant"
              >
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {celdas.map((dia, idx) => {
              if (dia === null) return <div key={idx} />
              const eventos = porDia.get(dia) ?? []
              const tieneEventos = eventos.length > 0
              return (
                <div
                  key={idx}
                  className={`flex min-h-[72px] flex-col gap-1 rounded-lg border p-1.5 ${
                    tieneEventos ? 'border-primary bg-surface-container-high' : 'border-outline-variant/60'
                  } ${esHoy(dia) ? 'ring-1 ring-primary' : ''}`}
                >
                  <span
                    className={`font-inter text-xs ${esHoy(dia) ? 'font-bold text-primary' : 'text-on-surface-variant'}`}
                  >
                    {dia}
                  </span>

                  {tieneEventos && (
                    <>
                      <div className="hidden flex-col gap-0.5 sm:flex">
                        {eventos.slice(0, 2).map((c) => (
                          <span
                            key={c.alumno.id}
                            title={`${c.alumno.nombre} ${c.alumno.apellido}`}
                            className="truncate rounded border border-primary/40 bg-surface-container-highest px-1 py-0.5 font-inter text-[10px] text-primary"
                          >
                            {c.alumno.nombre}
                          </span>
                        ))}
                        {eventos.length > 2 && (
                          <span className="font-inter text-[10px] text-on-surface-variant">
                            +{eventos.length - 2} más
                          </span>
                        )}
                      </div>
                      <div className="flex gap-0.5 sm:hidden">
                        {eventos.slice(0, 4).map((c) => (
                          <span key={c.alumno.id} className="h-1.5 w-1.5 rounded-full bg-primary" />
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div className="rounded-card border border-outline-variant bg-surface-container p-5 lg:col-span-4">
          <p className="mb-3 font-oswald text-[11px] uppercase tracking-[0.05em] text-on-surface-variant">
            Cumpleaños de {MESES[viewMonth]}
          </p>

          {delMes.length === 0 && (
            <p className="font-inter text-sm text-on-surface-variant">Nadie cumple años este mes.</p>
          )}

          <div className="flex flex-col divide-y divide-outline-variant">
            {delMes.map((c) => (
              <div key={c.alumno.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-container-highest font-oswald text-xs font-bold text-on-surface">
                  {c.dia}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-inter text-sm text-on-surface">
                    {c.alumno.nombre} {c.alumno.apellido}
                  </p>
                  <p className="font-inter text-xs text-on-surface-variant">Cumple {viewYear - c.anioNacimiento} años</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <BadgeEstado estado={c.alumno.estado} />
                  {c.alumno.telefono && (
                    <a
                      href={whatsappLink(c.alumno.telefono)}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Enviar WhatsApp a ${c.alumno.nombre} ${c.alumno.apellido}`}
                      title="Enviar WhatsApp"
                      className="flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high hover:text-primary"
                    >
                      <WhatsAppIcon className="h-[18px] w-[18px]" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
