import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { Alumno } from '@/types/db'
import { supabase } from '@/lib/supabase'
import { getEstadoCuenta } from '@/lib/cuenta'
import {
  crearAsistencia,
  fetchConteoPorTurno,
  fetchFechasAsistencia,
} from '@/lib/asistencia'
import { useTurnosActivos, useDisciplinasActivas } from '@/hooks/useCatalogos'
import { queryKeys } from '@/lib/queryKeys'
import { STALE_OPERATIVO } from '@/lib/queryClient'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { NumericKeypad } from '@/components/ui/NumericKeypad'
import { FormDateInput, FormTimeInput } from '@/components/ui/FormField'
import { Footer } from '@/components/layout/Footer'

async function buscarAlumnos(term: string): Promise<Alumno[]> {
  const { data, error } = await supabase
    .from('alumnos')
    .select('*')
    .or(`dni.ilike.%${term}%,nombre.ilike.%${term}%,apellido.ilike.%${term}%`)
    .order('apellido')
    .limit(8)
  if (error) return []
  return data as Alumno[]
}

function hoyISO(): string {
  return new Date().toISOString().slice(0, 10)
}

// Redondea a los 5 minutos más cercanos (hacia abajo) para calzar con las
// opciones de FormTimeInput, que solo ofrece minutos múltiplos de 5.
function horaActualRedondeada(): string {
  const ahora = new Date()
  const minutos = Math.floor(ahora.getMinutes() / 5) * 5
  return `${String(ahora.getHours()).padStart(2, '0')}:${String(minutos).padStart(2, '0')}`
}

const RESET_MS = 8000

export function CheckinAlumno() {
  const { signOut } = useAuth()
  const queryClient = useQueryClient()

  const { data: turnos = [] } = useTurnosActivos()
  const { data: disciplinas = [] } = useDisciplinasActivas()

  const [query, setQuery] = useState('')

  const [alumno, setAlumno] = useState<Alumno | null>(null)
  const [disciplinaId, setDisciplinaId] = useState('')
  const [turnoId, setTurnoId] = useState('')
  const [fecha, setFecha] = useState(hoyISO())
  const [horaLibre, setHoraLibre] = useState(horaActualRedondeada())

  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resultado, setResultado] = useState<{ fechas: string[]; debe: boolean } | null>(null)

  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const term = query.trim()
  const { data: resultados = [], isFetching: buscando } = useQuery({
    queryKey: queryKeys.alumnosBusqueda(term),
    queryFn: () => buscarAlumnos(term),
    enabled: term.length >= 2,
    staleTime: STALE_OPERATIVO,
  })

  // Conteo en vivo de asistencias de hoy por turno — refetch inicial +
  // suscripción realtime a nuevos inserts del día, para que el número se
  // actualice solo si otro alumno marca asistencia mientras esta pantalla
  // sigue abierta.
  const hoy = hoyISO()
  const { data: conteoTurnos = {} } = useQuery({
    queryKey: queryKeys.conteoPorTurno(hoy),
    queryFn: () => fetchConteoPorTurno(hoy),
    staleTime: STALE_OPERATIVO,
  })

  useEffect(() => {
    const canal = supabase
      .channel('checkin-conteo-turnos')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'asistencias_alumnos', filter: `fecha=eq.${hoy}` },
        () => {
          queryClient.invalidateQueries({ queryKey: queryKeys.conteoPorTurno(hoy) })
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(canal)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoy])

  useEffect(() => {
    return () => {
      if (resetTimer.current) clearTimeout(resetTimer.current)
    }
  }, [])

  function seleccionarAlumno(a: Alumno) {
    setAlumno(a)
    setQuery('')
    setDisciplinaId(a.disciplina_id ?? '')
    setTurnoId('')
    setFecha(hoyISO())
    setHoraLibre(horaActualRedondeada())
    setError(null)
  }

  function reiniciar() {
    if (resetTimer.current) clearTimeout(resetTimer.current)
    setAlumno(null)
    setQuery('')
    setDisciplinaId('')
    setTurnoId('')
    setFecha(hoyISO())
    setResultado(null)
    setError(null)
  }

  const disciplinaSeleccionada = disciplinas.find((d) => d.id === disciplinaId)
  const esHorarioLibre = disciplinaSeleccionada?.horario_libre ?? false

  async function confirmar() {
    if (!alumno || !disciplinaId) return
    if (!esHorarioLibre && !turnoId) return

    setGuardando(true)
    setError(null)

    const ahora = new Date()
    const hora = esHorarioLibre ? `${horaLibre}:00` : ahora.toTimeString().slice(0, 8)

    const { error } = await crearAsistencia({
      alumnoId: alumno.id,
      disciplinaId,
      turnoId: esHorarioLibre ? null : turnoId,
      fecha,
      hora,
    })

    if (error) {
      setGuardando(false)
      setError(error)
      return
    }

    const [fechas, cuenta] = await Promise.all([
      fetchFechasAsistencia(alumno.id),
      getEstadoCuenta(alumno.id),
    ])
    setGuardando(false)
    setResultado({ fechas, debe: cuenta.saldoTotal > 0 })

    resetTimer.current = setTimeout(reiniciar, RESET_MS)
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 py-6 sm:px-10">
      <img src="/logo_tropa_blanco.png" alt="Tropa Gym" className="h-auto w-full max-w-[150px] sm:max-w-[190px]" />

      <div className="w-full max-w-5xl rounded-card border border-outline-variant bg-surface-container p-6 sm:p-10">
        {/* Paso 1: buscar alumno */}
        {!alumno && !resultado && (
          <div className="flex flex-col items-center gap-5">
            <h1 className="font-oswald text-2xl font-bold uppercase tracking-[0.02em] text-on-surface sm:text-3xl">
              Marcar asistencia
            </h1>

            <div className="grid w-full gap-6 sm:grid-cols-[1fr_auto] sm:items-start">
              <div className="flex flex-col gap-3">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="DNI, nombre o apellido…"
                  className="w-full rounded-xl border border-outline-variant bg-surface-container-low px-4 py-4 text-center font-inter text-2xl text-on-surface outline-none focus:border-primary"
                />

                {buscando && <p className="font-inter text-sm text-on-surface-variant">Buscando…</p>}

                {resultados.length > 0 && (
                  <div className="flex w-full flex-col overflow-hidden rounded-xl border border-outline-variant">
                    {resultados.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => seleccionarAlumno(a)}
                        className="border-b border-outline-variant bg-surface-container-low px-4 py-4 text-left font-inter text-lg text-on-surface last:border-b-0 hover:bg-surface-container-high active:bg-surface-container-highest"
                      >
                        {a.nombre} {a.apellido} <span className="text-on-surface-variant">— DNI {a.dni}</span>
                      </button>
                    ))}
                  </div>
                )}

                {!buscando && query.trim().length >= 2 && resultados.length === 0 && (
                  <p className="font-inter text-base text-on-surface-variant">
                    No se encontró ningún alumno. Consultá en recepción.
                  </p>
                )}
              </div>

              <NumericKeypad value={query} onChange={setQuery} />
            </div>
          </div>
        )}

        {/* Paso 2: disciplina / turno / fecha */}
        {alumno && !resultado && (
          <div className="flex flex-col gap-6">
            <div className="text-center">
              <p className="font-oswald text-2xl font-bold uppercase text-on-surface sm:text-3xl">
                {alumno.nombre} {alumno.apellido}
              </p>
              <p className="font-inter text-base text-on-surface-variant">DNI {alumno.dni}</p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <p className="mb-3 font-oswald text-xs uppercase tracking-[0.05em] text-on-surface-variant">
                  Disciplina
                </p>
                <div className="flex flex-col gap-2">
                  {disciplinas.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => {
                        setDisciplinaId(d.id)
                        setTurnoId('')
                      }}
                      className={`rounded-xl border px-5 py-4 text-left font-inter text-lg transition-colors ${
                        disciplinaId === d.id
                          ? 'border-primary bg-primary text-[#06210a]'
                          : 'border-outline-variant bg-surface-container-low text-on-surface hover:bg-surface-container-high active:bg-surface-container-highest'
                      }`}
                    >
                      {d.nombre}
                    </button>
                  ))}
                </div>
              </div>

              {disciplinaId && !esHorarioLibre && (
                <div>
                  <p className="mb-3 font-oswald text-xs uppercase tracking-[0.05em] text-on-surface-variant">
                    Turno
                  </p>
                  <div className="flex flex-col gap-2">
                    {turnos.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setTurnoId(t.id)}
                        className={`flex items-center justify-between gap-2 rounded-xl border px-5 py-4 font-inter text-lg transition-colors ${
                          turnoId === t.id
                            ? 'border-primary bg-primary text-[#06210a]'
                            : 'border-outline-variant bg-surface-container-low text-on-surface hover:bg-surface-container-high active:bg-surface-container-highest'
                        }`}
                      >
                        <span>
                          {t.nombre}{' '}
                          <span className={turnoId === t.id ? 'text-[#06210a]/70' : 'text-on-surface-variant'}>
                            ({t.hora.slice(0, 5)})
                          </span>
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-1 text-sm ${
                            turnoId === t.id ? 'bg-[#06210a]/20' : 'bg-surface-container-highest'
                          }`}
                        >
                          {conteoTurnos[t.id] ?? 0}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {disciplinaId && esHorarioLibre && (
                <div className="flex flex-col justify-center">
                  <FormTimeInput id="checkin-hora" label="Hora" required value={horaLibre} onChange={setHoraLibre} />
                </div>
              )}
            </div>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="w-full sm:max-w-[220px]">
                <FormDateInput id="checkin-fecha" label="Fecha" required value={fecha} onChange={setFecha} />
              </div>

              <div className="flex gap-3">
                <Button type="button" variant="ghost" onClick={reiniciar} className="px-6 py-4 text-sm">
                  Cancelar
                </Button>
                <Button
                  type="button"
                  variant="solido"
                  disabled={!disciplinaId || (!esHorarioLibre && !turnoId) || guardando}
                  onClick={confirmar}
                  className="flex-1 px-8 py-4 text-base sm:flex-none sm:text-lg"
                >
                  {guardando ? 'Registrando…' : 'Confirmar asistencia'}
                </Button>
              </div>
            </div>

            {error && <p className="text-center font-inter text-sm text-error">{error}</p>}
          </div>
        )}

        {/* Paso 3: resultado — historial simple + estado de deuda */}
        {resultado && alumno && (
          <div className="flex flex-col items-center gap-5 py-4 text-center">
            <span className="material-symbols-outlined !text-[72px] text-primary sm:!text-[88px]">check_circle</span>
            <p className="font-oswald text-3xl font-bold uppercase text-on-surface sm:text-4xl">
              ¡Listo, {alumno.nombre}!
            </p>

            <div
              className={`rounded-xl border px-6 py-3 font-inter text-lg ${
                resultado.debe
                  ? 'border-error text-error'
                  : 'border-primary text-primary'
              }`}
            >
              {resultado.debe ? 'Tenés un pago pendiente' : 'Estás al día'}
            </div>

            <div className="w-full">
              <p className="mb-3 font-oswald text-xs uppercase tracking-[0.05em] text-on-surface-variant">
                Tus últimas asistencias
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {resultado.fechas.map((f) => (
                  <span
                    key={f}
                    className="rounded-full border border-outline-variant bg-surface-container-low px-4 py-1.5 font-inter text-sm text-on-surface"
                  >
                    {f.split('-').reverse().join('/')}
                  </span>
                ))}
              </div>
            </div>

            <Button type="button" variant="solido" onClick={reiniciar} className="px-10 py-4 text-lg">
              Listo
            </Button>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => void signOut()}
        className="font-inter text-xs text-on-surface-variant underline"
      >
        Salir del modo check-in
      </button>

      <Footer prominent />
    </div>
  )
}
