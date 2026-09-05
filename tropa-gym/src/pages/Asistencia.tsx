import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { Alumno } from '@/types/db'
import { getEstadoCuenta, type EstadoCuenta } from '@/lib/cuenta'
import {
  actualizarAsistencia,
  crearAsistencia,
  eliminarAsistencia,
  fetchAsistenciasPorFecha,
  type AsistenciaConDetalle,
} from '@/lib/asistencia'
import { useCombos, useDisciplinas, useTurnosActivos } from '@/hooks/useCatalogos'
import { queryKeys } from '@/lib/queryKeys'
import { STALE_OPERATIVO } from '@/lib/queryClient'
import { Button } from '@/components/ui/button'
import { FormDateInput, FormSelect, FormTimeInput } from '@/components/ui/FormField'
import { BadgeEstado } from '@/components/ui/BadgeEstado'
import { AlumnoBuscador } from '@/components/ui/AlumnoBuscador'
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable'
import { Drawer } from '@/components/ui/Drawer'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { fechaLocalISO } from '@/lib/fecha'

function fechaDisplay(iso: string): string {
  return iso.split('-').reverse().join('/')
}

export function Asistencia() {
  const queryClient = useQueryClient()
  const { data: turnos = [] } = useTurnosActivos()
  const { data: disciplinas = [] } = useDisciplinas()
  const { data: combos = [] } = useCombos()

  // Registro manual
  const [alumno, setAlumno] = useState<Alumno | null>(null)
  const [cuenta, setCuenta] = useState<EstadoCuenta | null>(null)
  const [cuentaLoading, setCuentaLoading] = useState(false)
  const [disciplinaId, setDisciplinaId] = useState('')
  const [turnoId, setTurnoId] = useState('')
  const [horaLibre, setHoraLibre] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Control: listado del día
  const [fechaFiltro, setFechaFiltro] = useState(fechaLocalISO())
  const [vista, setVista] = useState<'listado' | 'turnos'>('listado')

  // Edición
  const [editando, setEditando] = useState<AsistenciaConDetalle | null>(null)
  const [editDisciplinaId, setEditDisciplinaId] = useState('')
  const [editTurnoId, setEditTurnoId] = useState('')
  const [editHoraLibre, setEditHoraLibre] = useState('')
  const [editFecha, setEditFecha] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  // Borrado
  const [borrando, setBorrando] = useState<AsistenciaConDetalle | null>(null)
  const [borrandoLoading, setBorrandoLoading] = useState(false)

  const { data: asistencias = [], isLoading: listadoLoading } = useQuery({
    queryKey: queryKeys.asistenciasPorFecha(fechaFiltro),
    queryFn: () => fetchAsistenciasPorFecha(fechaFiltro),
    staleTime: STALE_OPERATIVO,
  })

  function refrescarListado() {
    return queryClient.invalidateQueries({ queryKey: queryKeys.asistenciasPorFecha(fechaFiltro) })
  }

  async function seleccionarAlumno(a: Alumno) {
    setAlumno(a)
    setDisciplinaId(a.disciplina_id ?? '')
    setTurnoId('')
    setHoraLibre('')
    setError(null)
    setSuccess(null)
    setCuentaLoading(true)
    setCuenta(await getEstadoCuenta(a.id))
    setCuentaLoading(false)
  }

  function cancelar() {
    setAlumno(null)
    setCuenta(null)
    setDisciplinaId('')
    setTurnoId('')
    setHoraLibre('')
    setError(null)
  }

  const disciplinaSeleccionada = disciplinas.find((d) => d.id === disciplinaId)
  const esHorarioLibre = disciplinaSeleccionada?.horario_libre ?? false

  async function confirmarAsistencia() {
    if (!alumno || !disciplinaId) return
    if (!esHorarioLibre && !turnoId) return
    if (esHorarioLibre && !horaLibre) return

    setSaving(true)
    setError(null)

    const ahora = new Date()
    const hora = esHorarioLibre ? `${horaLibre}:00` : ahora.toTimeString().slice(0, 8)

    const { error } = await crearAsistencia({
      alumnoId: alumno.id,
      disciplinaId,
      turnoId: esHorarioLibre ? null : turnoId,
      fecha: fechaLocalISO(),
      hora,
    })

    setSaving(false)
    if (error) {
      setError(error)
      return
    }

    setSuccess(`Asistencia registrada para ${alumno.nombre} ${alumno.apellido}.`)
    cancelar()
    if (fechaFiltro === fechaLocalISO()) refrescarListado()
  }

  function abrirEdicion(a: AsistenciaConDetalle) {
    setEditando(a)
    setEditDisciplinaId(a.disciplinaId ?? '')
    setEditTurnoId(a.turnoId ?? '')
    setEditHoraLibre(a.turnoId ? '' : a.hora.slice(0, 5))
    setEditFecha(a.fecha)
    setEditError(null)
  }

  const editDisciplina = disciplinas.find((d) => d.id === editDisciplinaId)
  const editEsHorarioLibre = editDisciplina?.horario_libre ?? false

  async function guardarEdicion() {
    if (!editando) return
    setEditSaving(true)
    setEditError(null)

    const { error } = await actualizarAsistencia(editando.id, {
      alumnoId: editando.alumnoId,
      disciplinaId: editDisciplinaId || null,
      turnoId: editEsHorarioLibre ? null : editTurnoId || null,
      fecha: editFecha,
      hora: editEsHorarioLibre ? `${editHoraLibre}:00` : editando.hora,
    })

    setEditSaving(false)
    if (error) {
      setEditError(error)
      return
    }
    setEditando(null)
    refrescarListado()
  }

  async function confirmarBorrado() {
    if (!borrando) return
    setBorrandoLoading(true)
    await eliminarAsistencia(borrando.id)
    setBorrandoLoading(false)
    setBorrando(null)
    refrescarListado()
  }

  const columns: DataTableColumn<AsistenciaConDetalle>[] = [
    { header: 'Alumno', cell: (a) => a.alumnoNombre },
    { header: 'Disciplina', cell: (a) => a.disciplinaNombre ?? '—' },
    { header: 'Turno / Hora', cell: (a) => a.turnoNombre ?? `${a.hora.slice(0, 5)} (libre)` },
  ]

  const porTurno = new Map<string, AsistenciaConDetalle[]>()
  const libres: AsistenciaConDetalle[] = []
  for (const a of asistencias) {
    if (!a.turnoId) {
      libres.push(a)
      continue
    }
    porTurno.set(a.turnoId, [...(porTurno.get(a.turnoId) ?? []), a])
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-oswald text-2xl font-bold uppercase tracking-[0.02em] text-on-surface">
        Asistencia de Alumnos
      </h1>

      {success && (
        <p className="rounded-lg border border-primary bg-surface-container-high px-4 py-3 font-inter text-sm text-primary">
          {success}
        </p>
      )}

      <div className="flex flex-col gap-4 rounded-card border border-outline-variant bg-surface-container p-5">
        <h2 className="font-oswald text-sm font-bold uppercase tracking-[0.03em] text-on-surface-variant">
          Registrar asistencia
        </h2>

        {!alumno && <AlumnoBuscador onSelect={seleccionarAlumno} />}

        {alumno && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-outline-variant pb-4">
              <div>
                <p className="font-oswald text-lg font-bold uppercase text-on-surface">
                  {alumno.nombre} {alumno.apellido}
                </p>
                <p className="font-inter text-sm text-on-surface-variant">DNI {alumno.dni}</p>
              </div>
              <BadgeEstado estado={alumno.estado} />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <p className="font-oswald text-[11px] uppercase tracking-[0.05em] text-on-surface-variant">
                  Estado de cuenta
                </p>
                <p className="font-anton text-2xl text-on-surface">
                  {cuentaLoading ? '…' : `$${(cuenta?.saldoTotal ?? 0).toLocaleString('es-AR')}`}
                </p>
                {!cuentaLoading && (cuenta?.saldoTotal ?? 0) > 0 && (
                  <p className="font-inter text-xs text-error">Saldo pendiente — no bloquea el ingreso</p>
                )}
              </div>
              <div>
                <p className="font-oswald text-[11px] uppercase tracking-[0.05em] text-on-surface-variant">
                  Plan actual
                </p>
                <p className="font-inter text-sm text-on-surface">
                  {(() => {
                    const disciplina = disciplinas.find((d) => d.id === alumno.disciplina_id)
                    const combo = combos.find((c) => c.id === alumno.combo_id)
                    if (!disciplina && !combo) return 'Sin plan asignado'
                    return `${disciplina?.nombre ?? '—'} — ${combo?.nombre ?? '—'}`
                  })()}
                </p>
              </div>
            </div>

            <div>
              <p className="mb-2 font-oswald text-[11px] uppercase tracking-[0.05em] text-on-surface-variant">
                Disciplina
              </p>
              <div className="flex flex-wrap gap-2">
                {disciplinas
                  .filter((d) => d.activo)
                  .map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => {
                        setDisciplinaId(d.id)
                        setTurnoId('')
                      }}
                      className={`rounded-lg border px-4 py-2 font-inter text-sm transition-colors ${
                        disciplinaId === d.id
                          ? 'border-primary bg-primary text-[#06210a]'
                          : 'border-outline-variant bg-surface-container-low text-on-surface hover:bg-surface-container-high'
                      }`}
                    >
                      {d.nombre}
                    </button>
                  ))}
              </div>
            </div>

            {disciplinaId && !esHorarioLibre && (
              <FormSelect
                id="asistencia-turno"
                label="Turno"
                placeholder="Seleccionar turno"
                required
                value={turnoId}
                onChange={(e) => setTurnoId(e.target.value)}
                options={turnos.map((t) => ({
                  value: t.id,
                  label: `${t.nombre} (${t.hora.slice(0, 5)})`,
                }))}
              />
            )}

            {disciplinaId && esHorarioLibre && (
              <FormTimeInput id="asistencia-hora-libre" label="Hora" required value={horaLibre} onChange={setHoraLibre} />
            )}

            {error && <p className="font-inter text-sm text-error">{error}</p>}

            <div className="flex justify-end gap-3">
              <Button type="button" variant="ghost" onClick={cancelar}>
                Cancelar
              </Button>
              <Button
                type="button"
                variant="solido"
                disabled={!disciplinaId || (!esHorarioLibre && !turnoId) || (esHorarioLibre && !horaLibre) || saving}
                onClick={confirmarAsistencia}
              >
                {saving ? 'Registrando…' : 'Confirmar asistencia'}
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4 rounded-card border border-outline-variant bg-surface-container p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="font-oswald text-sm font-bold uppercase tracking-[0.03em] text-on-surface-variant">
            Control de asistencias
          </h2>
          <div className="flex flex-wrap items-end gap-4">
            <FormDateInput id="filtro-fecha" label="Fecha" value={fechaFiltro} onChange={setFechaFiltro} />
            <SegmentedControl
              value={vista}
              onChange={setVista}
              options={[
                { value: 'listado', label: 'Listado' },
                { value: 'turnos', label: 'Por turno' },
              ]}
            />
          </div>
        </div>

        {vista === 'listado' && (
          <DataTable
            columns={columns}
            data={asistencias}
            rowKey={(a) => a.id}
            cardTitle={(a) => a.alumnoNombre}
            onEdit={abrirEdicion}
            onDelete={setBorrando}
            loading={listadoLoading}
            emptyMessage={`Sin asistencias registradas el ${fechaDisplay(fechaFiltro)}.`}
          />
        )}

        {vista === 'turnos' && (
          <div className="flex flex-col gap-3">
            {listadoLoading && <p className="font-inter text-sm text-on-surface-variant">Cargando…</p>}
            {!listadoLoading && asistencias.length === 0 && (
              <p className="font-inter text-sm text-on-surface-variant">
                Sin asistencias registradas el {fechaDisplay(fechaFiltro)}.
              </p>
            )}
            {!listadoLoading &&
              turnos
                .filter((t) => porTurno.has(t.id))
                .map((t) => {
                  const lista = porTurno.get(t.id) ?? []
                  return (
                    <details key={t.id} className="rounded-lg border border-outline-variant bg-surface-container-low p-3">
                      <summary className="flex cursor-pointer items-center justify-between font-inter text-sm text-on-surface">
                        <span>
                          {t.nombre} ({t.hora.slice(0, 5)})
                        </span>
                        <span className="rounded-full bg-surface-container-highest px-2.5 py-0.5 text-xs">
                          {lista.length}
                        </span>
                      </summary>
                      <ul className="mt-2 flex flex-col gap-1">
                        {lista.map((a) => (
                          <li key={a.id} className="font-inter text-sm text-on-surface-variant">
                            {a.alumnoNombre} — {a.disciplinaNombre ?? '—'}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )
                })}
            {!listadoLoading && libres.length > 0 && (
              <details className="rounded-lg border border-outline-variant bg-surface-container-low p-3">
                <summary className="flex cursor-pointer items-center justify-between font-inter text-sm text-on-surface">
                  <span>Horario libre</span>
                  <span className="rounded-full bg-surface-container-highest px-2.5 py-0.5 text-xs">
                    {libres.length}
                  </span>
                </summary>
                <ul className="mt-2 flex flex-col gap-1">
                  {libres.map((a) => (
                    <li key={a.id} className="font-inter text-sm text-on-surface-variant">
                      {a.alumnoNombre} — {a.disciplinaNombre ?? '—'} ({a.hora.slice(0, 5)})
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </div>

      <Drawer
        open={!!editando}
        title="Editar asistencia"
        onClose={() => setEditando(null)}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setEditando(null)} disabled={editSaving}>
              Cancelar
            </Button>
            <Button type="button" variant="solido" onClick={guardarEdicion} disabled={editSaving}>
              {editSaving ? 'Guardando…' : 'Guardar'}
            </Button>
          </>
        }
      >
        {editando && (
          <div className="flex flex-col gap-4">
            <p className="font-inter text-sm text-on-surface-variant">{editando.alumnoNombre}</p>

            <FormSelect
              id="editar-disciplina"
              label="Disciplina"
              placeholder="Sin disciplina"
              value={editDisciplinaId}
              onChange={(e) => {
                setEditDisciplinaId(e.target.value)
                setEditTurnoId('')
              }}
              options={disciplinas.map((d) => ({ value: d.id, label: d.nombre }))}
            />

            {!editEsHorarioLibre && (
              <FormSelect
                id="editar-turno"
                label="Turno"
                placeholder="Seleccionar turno"
                value={editTurnoId}
                onChange={(e) => setEditTurnoId(e.target.value)}
                options={turnos.map((t) => ({ value: t.id, label: `${t.nombre} (${t.hora.slice(0, 5)})` }))}
              />
            )}

            {editEsHorarioLibre && (
              <FormTimeInput id="editar-hora-libre" label="Hora" value={editHoraLibre} onChange={setEditHoraLibre} />
            )}

            <FormDateInput id="editar-fecha" label="Fecha" required value={editFecha} onChange={setEditFecha} />

            {editError && <p className="font-inter text-sm text-error">{editError}</p>}
          </div>
        )}
      </Drawer>

      <ConfirmDialog
        open={!!borrando}
        title="Eliminar asistencia"
        message={`¿Eliminar la asistencia de ${borrando?.alumnoNombre ?? ''} del ${borrando ? fechaDisplay(borrando.fecha) : ''}?`}
        loading={borrandoLoading}
        onConfirm={confirmarBorrado}
        onCancel={() => setBorrando(null)}
      />
    </div>
  )
}
