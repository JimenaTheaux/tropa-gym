import { useValidezCampos } from '@/hooks/useValidezCampos'
import { useEffect, useState, type FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { traducirError } from '@/lib/errores'
import { logError } from '@/lib/logErrores'
import { fetchPendientesCierre } from '@/lib/caja'
import { queryKeys } from '@/lib/queryKeys'
import { CierreCajaDrawer, type CierreCajaObjetivo } from '@/components/ui/CierreCajaDrawer'
import { useAuth } from '@/contexts/AuthContext'
import type { AsistenciaProfesor } from '@/types/db'
import { useProfesores } from '@/hooks/useCatalogos'
import { STALE_OPERATIVO } from '@/lib/queryClient'
import { Button } from '@/components/ui/button'
import { Drawer } from '@/components/ui/Drawer'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { FormDateInput, FormMonthInput } from '@/components/ui/FormField'
import { TimeField } from '@/components/ui/TimeField'
import { formatFecha } from '@/lib/utils'
import { fechaLocalISO } from '@/lib/fecha'
import { calcularMinutosTrabajados, formatHoras } from '@/lib/horasProfesor'

// Propaga el error: si la lectura falla no se puede mostrar "sin turno abierto",
// porque habilitaría registrar una entrada duplicada.
async function fetchAbiertos(ids: string[]): Promise<Record<string, AsistenciaProfesor>> {
  if (ids.length === 0) return {}
  const { data, error } = await supabase
    .from('asistencias_profesores')
    .select('*')
    .in('profesor_id', ids)
    .is('hora_salida', null)
  if (error) throw new Error(error.message)
  const map: Record<string, AsistenciaProfesor> = {}
  for (const r of data as AsistenciaProfesor[]) map[r.profesor_id] = r
  return map
}

async function fetchHistorial(ids: string[], periodo: string): Promise<AsistenciaProfesor[]> {
  if (ids.length === 0) return []
  const { data, error } = await supabase
    .from('asistencias_profesores')
    .select('*')
    .in('profesor_id', ids)
    .gte('fecha', `${periodo}-01`)
    .lt('fecha', primerDiaSiguiente(periodo))
    .order('fecha', { ascending: false })
    .order('hora_entrada', { ascending: false })
  if (error) return []
  return data as AsistenciaProfesor[]
}

async function fetchCantidadesPendientes(ids: string[]): Promise<Record<string, number>> {
  const resultados = await Promise.all(ids.map((id) => fetchPendientesCierre(id)))
  return Object.fromEntries(ids.map((id, i) => [id, resultados[i].cantidad]))
}

function periodoActual(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function primerDiaSiguiente(periodo: string): string {
  const [y, m] = periodo.split('-').map(Number)
  const d = new Date(y, m, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function horaActual(): string {
  return new Date().toTimeString().slice(0, 8)
}

// Máscara dd/mm/aaaa para el filtro de fecha por columna — sólo dígitos,
// sin validar completitud (se filtra por prefijo a medida que se escribe).
function maskFechaFiltro(raw: string): string {
  const digitos = raw.replace(/\D/g, '').slice(0, 8)
  let dd = digitos.slice(0, 2)
  let mm = digitos.slice(2, 4)
  const yyyy = digitos.slice(4, 8)
  if (dd.length === 2 && Number(dd) > 31) dd = '31'
  if (mm.length === 2 && Number(mm) > 12) mm = '12'
  return [dd, mm, yyyy].filter(Boolean).join('/')
}

export function AsistenciaProfesores() {
  const validez = useValidezCampos()
  const { perfil } = useAuth()
  const isAdmin = perfil?.rol === 'admin'
  const queryClient = useQueryClient()

  const [periodo, setPeriodo] = useState(periodoActual())
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<AsistenciaProfesor | null>(null)
  const [editForm, setEditForm] = useState({ fecha: '', hora_entrada: '', hora_salida: '' })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<AsistenciaProfesor | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const [filtroProfesorId, setFiltroProfesorId] = useState('')
  const [filtroFechaTexto, setFiltroFechaTexto] = useState('')

  const { data: profesores = [], isFetching: loadingProfesores } = useProfesores(isAdmin ? undefined : perfil?.id)
  const idsKey = [...profesores.map((p) => p.id)].sort().join(',')

  const abiertosQuery = useQuery({
    queryKey: ['asistencias-profesores', 'abiertos', idsKey],
    queryFn: () => fetchAbiertos(profesores.map((p) => p.id)),
    staleTime: STALE_OPERATIVO,
  })
  const historialQuery = useQuery({
    queryKey: ['asistencias-profesores', periodo, idsKey],
    queryFn: () => fetchHistorial(profesores.map((p) => p.id), periodo),
    staleTime: STALE_OPERATIVO,
  })

  const pendientesQuery = useQuery({
    queryKey: queryKeys.cajaPendientesPorProfesor(idsKey),
    queryFn: () => fetchCantidadesPendientes(profesores.map((p) => p.id)),
    enabled: profesores.length > 0,
    staleTime: STALE_OPERATIVO,
  })

  const [cierre, setCierre] = useState<CierreCajaObjetivo | null>(null)
  const [mensajeCierre, setMensajeCierre] = useState<string | null>(null)

  useEffect(() => {
    if (!abiertosQuery.isError) return
    logError({
      contexto: 'asistencia_profesores_abiertos',
      usuarioId: perfil?.id ?? null,
      payloadIntentado: null,
      error: abiertosQuery.error,
    })
  }, [abiertosQuery.isError, abiertosQuery.error, perfil?.id])

  const abiertos = abiertosQuery.data ?? {}
  const pendientes = pendientesQuery.data ?? {}
  const turnosSinDatos = abiertosQuery.isLoading || abiertosQuery.isError
  // Un profe desactivado sigue a la vista mientras tenga algo por cerrar.
  const profesoresVisibles = profesores.filter((p) => p.activo || abiertos[p.id] || pendientes[p.id] > 0)
  const historial = historialQuery.data ?? []
  const loading = loadingProfesores || abiertosQuery.isFetching || historialQuery.isFetching

  const digitosFiltroFecha = filtroFechaTexto.replace(/\D/g, '')
  const historialFiltrado = historial.filter((r) => {
    if (filtroProfesorId && r.profesor_id !== filtroProfesorId) return false
    if (digitosFiltroFecha) {
      const [y, m, d] = r.fecha.split('-')
      if (!`${d}${m}${y}`.startsWith(digitosFiltroFecha)) return false
    }
    return true
  })

  function renderHoras(registro: AsistenciaProfesor) {
    if (!registro.hora_salida) return '—'
    const { minutosReales, minutosRedondeados, redondeado } = calcularMinutosTrabajados(
      registro.hora_entrada,
      registro.hora_salida,
    )
    return (
      <span className="inline-flex items-center gap-1.5">
        {formatHoras(minutosRedondeados)}
        {redondeado && (
          <span className="group relative inline-flex" title={`Real: ${formatHoras(minutosReales)}`}>
            <span
              tabIndex={0}
              className="material-symbols-outlined cursor-help !text-[14px] text-on-surface-variant outline-none"
            >
              history
            </span>
            <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-1 w-max -translate-x-1/2 rounded-md bg-surface-container-highest px-2 py-1 font-inter text-xs text-on-surface opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
              Real: {formatHoras(minutosReales)}
            </span>
          </span>
        )}
      </span>
    )
  }

  function refrescar() {
    return queryClient.invalidateQueries({ queryKey: ['asistencias-profesores'] })
  }

  // La salida ya está guardada cuando se llama: un fallo acá solo posterga el
  // cierre, que se retoma con "Cerrar caja" en la card.
  async function abrirCierreTrasSalida(registro: AsistenciaProfesor) {
    queryClient.invalidateQueries({ queryKey: queryKeys.caja })
    try {
      const { cantidad } = await fetchPendientesCierre(registro.profesor_id)
      if (cantidad > 0) {
        setCierre({
          profesorId: registro.profesor_id,
          nombre: profesorNombre(registro.profesor_id),
          asistenciaId: registro.id,
        })
      }
    } catch (err) {
      await logError({
        contexto: 'cierre_caja',
        usuarioId: perfil?.id ?? null,
        payloadIntentado: { profesorId: registro.profesor_id, asistenciaId: registro.id },
        error: err,
      })
      setError('La salida quedó guardada, pero no se pudo consultar la caja. Cerrala con "Cerrar caja" cuando vuelva la conexión.')
    }
  }

  async function registrarEntrada(profesorId: string) {
    setActionLoading(profesorId)
    setError(null)
    const { error } = await supabase.from('asistencias_profesores').insert({
      profesor_id: profesorId,
      fecha: fechaLocalISO(),
      hora_entrada: horaActual(),
      hora_salida: null,
    })
    setActionLoading(null)
    if (error) {
      setError(traducirError(error.message))
      return
    }
    await refrescar()
  }

  async function registrarSalida(registro: AsistenciaProfesor) {
    setActionLoading(registro.profesor_id)
    setError(null)
    const { error } = await supabase
      .from('asistencias_profesores')
      .update({ hora_salida: horaActual() })
      .eq('id', registro.id)
    setActionLoading(null)
    if (error) {
      setError(traducirError(error.message))
      return
    }
    setMensajeCierre(null)
    await refrescar()
    await abrirCierreTrasSalida(registro)
  }

  function profesorNombre(id: string) {
    const p = profesores.find((pr) => pr.id === id)
    return p ? `${p.nombre} ${p.apellido}` : id
  }

  function openEditRegistro(registro: AsistenciaProfesor) {
    setEditing(registro)
    setEditForm({
      fecha: registro.fecha,
      hora_entrada: registro.hora_entrada.slice(0, 5),
      hora_salida: registro.hora_salida ? registro.hora_salida.slice(0, 5) : '',
    })
    setError(null)
    setDrawerOpen(true)
  }

  async function handleEditSubmit(e: FormEvent) {
    e.preventDefault()
    if (!editing) return
    setSaving(true)
    setError(null)
    const { error } = await supabase
      .from('asistencias_profesores')
      .update({
        fecha: editForm.fecha,
        hora_entrada: editForm.hora_entrada,
        hora_salida: editForm.hora_salida || null,
      })
      .eq('id', editing.id)
    setSaving(false)
    if (error) {
      setError(traducirError(error.message))
      return
    }
    setDrawerOpen(false)
    setEditing(null)
    await refrescar()
  }

  async function handleDeleteRegistro() {
    if (!deleting) return
    setDeleteLoading(true)
    const { error } = await supabase.from('asistencias_profesores').delete().eq('id', deleting.id)
    setDeleteLoading(false)
    if (error) {
      setError(traducirError(error.message))
      setDeleting(null)
      return
    }
    setDeleting(null)
    await refrescar()
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-oswald text-2xl font-bold uppercase tracking-[0.02em] text-on-surface">
        Asistencia Profesores
      </h1>

      {error && !drawerOpen && <p className="font-inter text-sm text-error">{error}</p>}

      {mensajeCierre && (
        <p className="rounded-lg border border-primary bg-surface-container-high px-4 py-3 font-inter text-sm text-primary">
          {mensajeCierre}
        </p>
      )}

      {abiertosQuery.isError && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-error/50 bg-error/10 px-4 py-3">
          <p className="font-inter text-sm text-error">
            No se pudo consultar quién está en turno. Entrada y salida quedan bloqueadas hasta recuperar el dato.
          </p>
          <Button type="button" variant="ghost" onClick={() => abiertosQuery.refetch()}>
            Reintentar
          </Button>
        </div>
      )}

      {pendientesQuery.isError && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-error/50 bg-error/10 px-4 py-3">
          <p className="font-inter text-sm text-error">No se pudo consultar los pagos pendientes de cierre.</p>
          <Button type="button" variant="ghost" onClick={() => pendientesQuery.refetch()}>
            Reintentar
          </Button>
        </div>
      )}

      {!loading && profesores.length === 0 && (
        <p className="font-inter text-sm text-on-surface-variant">
          {isAdmin
            ? 'Todavía no hay profesores cargados. Agregalos desde Configuración.'
            : 'No tenés un perfil de profesor asociado a tu usuario. Contactá al administrador.'}
        </p>
      )}

      {profesores.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {profesoresVisibles.map((p) => {
            const abierto = abiertos[p.id]
            const enTurno = !!abierto
            return (
              <div
                key={p.id}
                className="flex flex-col gap-3 rounded-card border border-outline-variant bg-surface-container p-5"
              >
                <div className="flex items-center justify-between">
                  <p className="font-oswald text-base font-bold uppercase text-on-surface">
                    {p.nombre} {p.apellido}
                  </p>
                  <span
                    className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-inter text-xs font-medium"
                    style={
                      enTurno
                        ? { borderColor: '#40e432', color: '#40e432' }
                        : { borderColor: '#3d4b37', color: '#bbcbb2' }
                    }
                  >
                    <span className="material-symbols-outlined !text-[14px]">
                      {enTurno ? 'schedule' : 'schedule_send'}
                    </span>
                    {turnosSinDatos ? 'Sin datos' : enTurno ? 'En turno' : 'Sin turno abierto'}
                  </span>
                </div>

                {enTurno && (
                  <p className="font-inter text-sm text-on-surface-variant">
                    Entrada: {abierto.hora_entrada.slice(0, 5)} ({formatFecha(abierto.fecha)})
                  </p>
                )}

                <Button
                  type="button"
                  variant="primario"
                  disabled={actionLoading === p.id || turnosSinDatos}
                  onClick={() => (enTurno ? registrarSalida(abierto) : registrarEntrada(p.id))}
                >
                  {actionLoading === p.id
                    ? 'Guardando…'
                    : enTurno
                      ? 'Registrar salida'
                      : 'Registrar entrada'}
                </Button>

                {pendientes[p.id] > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() =>
                      setCierre({
                        profesorId: p.id,
                        nombre: `${p.nombre} ${p.apellido}`,
                        asistenciaId: abierto?.id ?? null,
                      })
                    }
                  >
                    <span className="material-symbols-outlined !text-[16px]">point_of_sale</span>
                    Cerrar caja ({pendientes[p.id]})
                  </Button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {profesores.length > 0 && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end gap-4">
            <FormMonthInput id="asistencia-profesores-periodo" label="Período" required value={periodo} onChange={setPeriodo} />
          </div>

          <div className="overflow-x-auto rounded-card border border-outline-variant">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-surface-container-high/50">
                  <th className="px-4 py-3 font-oswald text-[11px] font-medium uppercase tracking-[0.05em] text-on-surface-variant">
                    Profesor
                  </th>
                  <th className="px-4 py-3 font-oswald text-[11px] font-medium uppercase tracking-[0.05em] text-on-surface-variant">
                    Fecha
                  </th>
                  <th className="px-4 py-3 font-oswald text-[11px] font-medium uppercase tracking-[0.05em] text-on-surface-variant">
                    Entrada
                  </th>
                  <th className="px-4 py-3 font-oswald text-[11px] font-medium uppercase tracking-[0.05em] text-on-surface-variant">
                    Salida
                  </th>
                  <th className="px-4 py-3 font-oswald text-[11px] font-medium uppercase tracking-[0.05em] text-on-surface-variant">
                    Horas
                  </th>
                  {isAdmin && (
                    <th className="px-4 py-3 text-right font-oswald text-[11px] font-medium uppercase tracking-[0.05em] text-on-surface-variant">
                      Acciones
                    </th>
                  )}
                </tr>
                <tr className="border-t border-outline-variant bg-surface-container-high/50">
                  <th className="px-4 py-2">
                    <select
                      aria-label="Filtrar por profesor"
                      value={filtroProfesorId}
                      onChange={(e) => setFiltroProfesorId(e.target.value)}
                      className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-2 py-1.5 font-inter text-xs text-on-surface outline-none focus:border-primary"
                    >
                      <option value="">Todos</option>
                      {profesores.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nombre} {p.apellido}
                        </option>
                      ))}
                    </select>
                  </th>
                  <th className="px-4 py-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      aria-label="Filtrar por fecha"
                      placeholder="dd/mm/aaaa"
                      maxLength={10}
                      value={filtroFechaTexto}
                      onChange={(e) => setFiltroFechaTexto(maskFechaFiltro(e.target.value))}
                      className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-2 py-1.5 font-inter text-xs text-on-surface outline-none focus:border-primary"
                    />
                  </th>
                  <th className="px-4 py-2" colSpan={isAdmin ? 3 : 2} />
                </tr>
              </thead>
              <tbody>
                {historialFiltrado.length === 0 && (
                  <tr>
                    <td
                      colSpan={isAdmin ? 6 : 5}
                      className="px-4 py-10 text-center font-inter text-sm text-on-surface-variant"
                    >
                      {loading
                        ? 'Cargando…'
                        : historial.length === 0
                          ? 'Sin registros en el período.'
                          : 'Ningún registro coincide con el filtro.'}
                    </td>
                  </tr>
                )}
                {historialFiltrado.map((r) => (
                  <tr key={r.id} className="border-t border-outline-variant">
                    <td className="px-4 py-3 font-inter text-sm text-on-surface">
                      {profesorNombre(r.profesor_id)}
                    </td>
                    <td className="px-4 py-3 font-inter text-sm text-on-surface">{formatFecha(r.fecha)}</td>
                    <td className="px-4 py-3 font-inter text-sm text-on-surface">
                      {r.hora_entrada.slice(0, 5)}
                    </td>
                    <td className="px-4 py-3 font-inter text-sm text-on-surface-variant">
                      {r.hora_salida ? r.hora_salida.slice(0, 5) : 'En curso'}
                    </td>
                    <td className="px-4 py-3 font-inter text-sm text-on-surface">{renderHoras(r)}</td>
                    {isAdmin && (
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-3">
                          <button
                            type="button"
                            onClick={() => openEditRegistro(r)}
                            aria-label="Editar"
                            className="text-on-surface-variant hover:text-primary"
                          >
                            <span className="material-symbols-outlined !text-[18px]">edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleting(r)}
                            aria-label="Eliminar"
                            className="text-on-surface-variant hover:text-error"
                          >
                            <span className="material-symbols-outlined !text-[18px]">delete</span>
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {cierre && (
        <CierreCajaDrawer
          key={cierre.profesorId}
          objetivo={cierre}
          onClose={() => setCierre(null)}
          onCerrado={(mensaje) => {
            setCierre(null)
            setMensajeCierre(mensaje)
          }}
        />
      )}

      {isAdmin && (
        <>
          <Drawer
            open={drawerOpen}
            title="Editar registro"
            onClose={() => setDrawerOpen(false)}
            footer={
              <>
                <Button type="button" variant="ghost" onClick={() => setDrawerOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" form="form-asistencia-profesor" variant="solido" disabled={saving || validez.hayInvalidos}>
                  {saving ? 'Guardando…' : 'Guardar'}
                </Button>
              </>
            }
          >
            <form
              id="form-asistencia-profesor"
              className="flex flex-col gap-4"
              onSubmit={handleEditSubmit}
            >
              {editing && (
                <p className="font-inter text-sm text-on-surface-variant">
                  {profesorNombre(editing.profesor_id)}
                </p>
              )}
              <FormDateInput
                id="asistencia-profesor-fecha"
                label="Fecha"
                required
                min="2000-01-01"
                validez={validez}
                value={editForm.fecha}
                onChange={(fecha) => setEditForm({ ...editForm, fecha })}
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <TimeField
                  id="asistencia-profesor-hora-entrada"
                  label="Hora entrada"
                  required
                  validez={validez}
                  value={editForm.hora_entrada}
                  onChange={(hora_entrada) => setEditForm({ ...editForm, hora_entrada })}
                />
                <TimeField
                  id="asistencia-profesor-hora-salida"
                  label="Hora salida"
                  validez={validez}
                  value={editForm.hora_salida}
                  onChange={(hora_salida) => setEditForm({ ...editForm, hora_salida })}
                />
              </div>
              {error && <p className="font-inter text-sm text-error">{error}</p>}
            </form>
          </Drawer>

          <ConfirmDialog
            open={!!deleting}
            title="Eliminar registro"
            message={`¿Eliminar el registro de asistencia de "${deleting ? profesorNombre(deleting.profesor_id) : ''}" del ${deleting ? formatFecha(deleting.fecha) : ''}? Esta acción no se puede deshacer.`}
            loading={deleteLoading}
            onConfirm={handleDeleteRegistro}
            onCancel={() => setDeleting(null)}
          />
        </>
      )}
    </div>
  )
}
