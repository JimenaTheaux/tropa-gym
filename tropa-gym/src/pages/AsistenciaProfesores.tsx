import { useState, type FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { traducirError } from '@/lib/errores'
import { useAuth } from '@/contexts/AuthContext'
import type { AsistenciaProfesor } from '@/types/db'
import { useProfesores } from '@/hooks/useCatalogos'
import { STALE_OPERATIVO } from '@/lib/queryClient'
import { Button } from '@/components/ui/button'
import { Drawer } from '@/components/ui/Drawer'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { FormDateInput, FormInput, FormMonthInput } from '@/components/ui/FormField'
import { formatFecha } from '@/lib/utils'

async function fetchAbiertos(ids: string[]): Promise<Record<string, AsistenciaProfesor>> {
  if (ids.length === 0) return {}
  const { data, error } = await supabase
    .from('asistencias_profesores')
    .select('*')
    .in('profesor_id', ids)
    .is('hora_salida', null)
  if (error) return {}
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

// Minutos trabajados, redondeados al múltiplo de 10 más cercano.
function minutosTrabajados(horaEntrada: string, horaSalida: string): number {
  const [eh, em] = horaEntrada.split(':').map(Number)
  const [sh, sm] = horaSalida.split(':').map(Number)
  let minutos = sh * 60 + sm - (eh * 60 + em)
  if (minutos < 0) minutos += 24 * 60
  return Math.round(minutos / 10) * 10
}

function formatHoras(minutos: number): string {
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

export function AsistenciaProfesores() {
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

  const abiertos = abiertosQuery.data ?? {}
  const historial = historialQuery.data ?? []
  const loading = loadingProfesores || abiertosQuery.isFetching || historialQuery.isFetching

  function refrescar() {
    return queryClient.invalidateQueries({ queryKey: ['asistencias-profesores'] })
  }

  async function registrarEntrada(profesorId: string) {
    setActionLoading(profesorId)
    setError(null)
    const ahora = new Date()
    const { error } = await supabase.from('asistencias_profesores').insert({
      profesor_id: profesorId,
      fecha: ahora.toISOString().slice(0, 10),
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
    await refrescar()
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

      {!loading && profesores.length === 0 && (
        <p className="font-inter text-sm text-on-surface-variant">
          {isAdmin
            ? 'Todavía no hay profesores cargados. Agregalos desde Configuración.'
            : 'No tenés un perfil de profesor asociado a tu usuario. Contactá al administrador.'}
        </p>
      )}

      {profesores.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {profesores.map((p) => {
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
                    {enTurno ? 'En turno' : 'Sin turno abierto'}
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
                  disabled={actionLoading === p.id}
                  onClick={() => (enTurno ? registrarSalida(abierto) : registrarEntrada(p.id))}
                >
                  {actionLoading === p.id
                    ? 'Guardando…'
                    : enTurno
                      ? 'Registrar salida'
                      : 'Registrar entrada'}
                </Button>
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
              </thead>
              <tbody>
                {historial.length === 0 && (
                  <tr>
                    <td
                      colSpan={isAdmin ? 6 : 5}
                      className="px-4 py-10 text-center font-inter text-sm text-on-surface-variant"
                    >
                      {loading ? 'Cargando…' : 'Sin registros en el período.'}
                    </td>
                  </tr>
                )}
                {historial.map((r) => (
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
                    <td className="px-4 py-3 font-inter text-sm text-on-surface">
                      {r.hora_salida ? formatHoras(minutosTrabajados(r.hora_entrada, r.hora_salida)) : '—'}
                    </td>
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
                <Button type="submit" form="form-asistencia-profesor" variant="solido" disabled={saving}>
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
                value={editForm.fecha}
                onChange={(fecha) => setEditForm({ ...editForm, fecha })}
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormInput
                  id="asistencia-profesor-hora-entrada"
                  label="Hora entrada"
                  type="time"
                  lang="en-GB"
                  required
                  value={editForm.hora_entrada}
                  onChange={(e) => setEditForm({ ...editForm, hora_entrada: e.target.value })}
                />
                <FormInput
                  id="asistencia-profesor-hora-salida"
                  label="Hora salida"
                  type="time"
                  lang="en-GB"
                  value={editForm.hora_salida}
                  onChange={(e) => setEditForm({ ...editForm, hora_salida: e.target.value })}
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
