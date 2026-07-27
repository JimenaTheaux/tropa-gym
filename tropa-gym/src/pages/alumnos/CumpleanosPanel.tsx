import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { Alumno } from '@/types/db'
import { supabase } from '@/lib/supabase'
import { whatsappLink } from '@/lib/utils'
import { STALE_OPERATIVO } from '@/lib/queryClient'
import { BadgeEstado } from '@/components/ui/BadgeEstado'
import { Button } from '@/components/ui/button'

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
                      <svg viewBox="0 0 24 24" fill="currentColor" className="h-[18px] w-[18px]">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.99c-.003 5.45-4.437 9.884-9.885 9.884M20.52 3.449C18.24 1.245 15.24 0 12.045 0 5.463 0 .104 5.36.101 11.943c0 2.096.549 4.142 1.595 5.945L0 24l6.335-1.652a11.882 11.882 0 0 0 5.71 1.447h.005c6.582 0 11.94-5.36 11.943-11.943a11.821 11.821 0 0 0-3.473-8.403" />
                      </svg>
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
