import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Cargo, EstadoPago, TipoCargo } from '@/types/db'
import { traducirError } from '@/lib/errores'
import { fetchCargosPeriodo, marcarCargoValidado, validarCargosPagadosDelPeriodo } from '@/lib/cargos'
import { useAlumnos } from '@/hooks/useAlumnos'
import { queryKeys } from '@/lib/queryKeys'
import { STALE_OPERATIVO } from '@/lib/queryClient'
import { FormMonthInput, FormCheckbox, FormInput, FormSelect } from '@/components/ui/FormField'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { BadgeEstadoCargo } from '@/components/ui/BadgeEstado'
import { EditarMontoCargo } from '@/components/ui/EditarMontoCargo'
import { AsistenciasPeriodoDrawer } from '@/components/ui/AsistenciasPeriodoDrawer'
import { PagosPeriodoDrawer } from '@/components/ui/PagosPeriodoDrawer'

function periodoActual(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function money(v: number): string {
  return `$${Math.round(v).toLocaleString('es-AR')}`
}

const FILTRO_TIPO_OPTIONS = [
  { value: 'completa', label: 'Cuota completa' },
  { value: 'media', label: 'Media cuota' },
]

const FILTRO_ESTADO_OPTIONS = [
  { value: 'pagado', label: 'Pagado' },
  { value: 'parcial', label: 'Parcial' },
  { value: 'pendiente', label: 'Pendiente' },
]

// Checkbox "Validar" — UPDATE directo de cargos.validado, sin confirmación
// (a diferencia de editar el monto): es una acción de bajo riesgo y
// reversible, tildar/destildar no cambia ningún número.
function ValidarCheckbox({ cargo }: { cargo: Cargo }) {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: (validado: boolean) => marcarCargoValidado(cargo.id, validado),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cargosPeriodo(cargo.periodo) })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })

  return (
    <FormCheckbox
      id={`validar-cargo-${cargo.id}`}
      label="Validar"
      checked={cargo.validado}
      disabled={mutation.isPending}
      onChange={(e) => mutation.mutate(e.target.checked)}
    />
  )
}

export function Cargos() {
  const queryClient = useQueryClient()
  const [periodo, setPeriodo] = useState(periodoActual())
  const { data: alumnos = [] } = useAlumnos()
  const [editandoCargoId, setEditandoCargoId] = useState<string | null>(null)
  const [verAsistenciasDe, setVerAsistenciasDe] = useState<{ alumnoId: string; nombre: string } | null>(null)
  const [verPagosDe, setVerPagosDe] = useState<{
    alumnoId: string
    nombre: string
    cargoMonto: number
    cargoEstado: EstadoPago
  } | null>(null)

  const [busqueda, setBusqueda] = useState('')
  const [filtroTipo, setFiltroTipo] = useState<TipoCargo | ''>('')
  const [filtroEstado, setFiltroEstado] = useState<EstadoPago | ''>('')

  const [confirmarValidarTodos, setConfirmarValidarTodos] = useState(false)
  const [errorValidarTodos, setErrorValidarTodos] = useState<string | null>(null)

  const cargosQuery = useQuery({
    queryKey: queryKeys.cargosPeriodo(periodo),
    queryFn: () => fetchCargosPeriodo(periodo),
    staleTime: STALE_OPERATIVO,
  })

  const loading = cargosQuery.isFetching
  const cargosPeriodo = cargosQuery.data ?? new Map<string, Cargo>()
  const cargos = [...cargosPeriodo.values()]

  function alumnoNombre(id: string) {
    const a = alumnos.find((al) => al.id === id)
    return a ? `${a.nombre} ${a.apellido}` : id
  }

  const busquedaTerm = busqueda.trim().toLowerCase()
  const filas = cargos
    .map((c) => ({ cargo: c, alumno: alumnos.find((a) => a.id === c.alumno_id) }))
    .filter(({ cargo, alumno }) => {
      if (filtroTipo && cargo.tipo !== filtroTipo) return false
      if (filtroEstado && cargo.estado !== filtroEstado) return false
      if (busquedaTerm) {
        const nombre = alumno ? `${alumno.nombre} ${alumno.apellido}`.toLowerCase() : ''
        if (!nombre.includes(busquedaTerm)) return false
      }
      return true
    })
    .sort((a, b) => (a.alumno?.apellido ?? '').localeCompare(b.alumno?.apellido ?? ''))

  const completas = cargos.filter((c) => c.tipo === 'completa').length
  const medias = cargos.filter((c) => c.tipo === 'media').length
  const sinValidar = cargos.filter((c) => !c.validado).length
  const montoTotal = cargos.reduce((sum, c) => sum + Number(c.monto), 0)
  const sinCargo = alumnos.filter((a) => a.estado === 'activo' && !cargosPeriodo.has(a.id))
  const pagadosSinValidar = cargos.filter((c) => c.estado === 'pagado' && !c.validado).length

  const validarTodosMutation = useMutation({
    mutationFn: () => validarCargosPagadosDelPeriodo(periodo),
    onSuccess: ({ error }) => {
      setConfirmarValidarTodos(false)
      if (error) {
        setErrorValidarTodos(traducirError(error))
        return
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.cargosPeriodo(periodo) })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-oswald text-2xl font-bold uppercase tracking-[0.02em] text-on-surface">
        Cargos del Período
      </h1>

      <div className="flex flex-wrap items-end gap-4 rounded-card border border-outline-variant bg-surface-container p-5">
        <FormMonthInput id="cargos-periodo" label="Período" required value={periodo} onChange={setPeriodo} />
        {pagadosSinValidar > 0 && (
          <Button type="button" variant="primario" onClick={() => setConfirmarValidarTodos(true)}>
            Validar pagados ({pagadosSinValidar})
          </Button>
        )}
      </div>

      {errorValidarTodos && <p className="font-inter text-sm text-error">{errorValidarTodos}</p>}

      {loading && <p className="font-inter text-sm text-on-surface-variant">Cargando…</p>}

      {!loading && (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-card border border-outline-variant bg-surface-container p-4">
              <p className="font-oswald text-[11px] uppercase tracking-[0.05em] text-on-surface-variant">
                Cuotas completas
              </p>
              <p className="font-anton text-2xl text-on-surface">{completas}</p>
            </div>
            <div className="rounded-card border border-outline-variant bg-surface-container p-4">
              <p className="font-oswald text-[11px] uppercase tracking-[0.05em] text-on-surface-variant">
                Medias cuotas
              </p>
              <p className="font-anton text-2xl text-on-surface">{medias}</p>
            </div>
            <div className="rounded-card border border-outline-variant bg-surface-container p-4">
              <p className="font-oswald text-[11px] uppercase tracking-[0.05em] text-on-surface-variant">
                Sin validar
              </p>
              <p className="font-anton text-2xl text-error">{sinValidar}</p>
            </div>
            <div className="rounded-card border border-outline-variant bg-surface-container p-4">
              <p className="font-oswald text-[11px] uppercase tracking-[0.05em] text-on-surface-variant">
                Monto total del período
              </p>
              <p className="font-anton text-2xl text-on-surface">{money(montoTotal)}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-4">
            <div className="w-full sm:w-72">
              <FormInput
                id="cargos-buscar-nombre"
                label="Buscar alumno"
                placeholder="Nombre o apellido…"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>
            <div className="w-full sm:w-48">
              <FormSelect
                id="cargos-filtro-tipo"
                label="Tipo"
                placeholder="Todos"
                value={filtroTipo}
                onChange={(e) => setFiltroTipo(e.target.value as TipoCargo | '')}
                options={FILTRO_TIPO_OPTIONS}
              />
            </div>
            <div className="w-full sm:w-48">
              <FormSelect
                id="cargos-filtro-estado"
                label="Estado"
                placeholder="Todos"
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value as EstadoPago | '')}
                options={FILTRO_ESTADO_OPTIONS}
              />
            </div>
          </div>

          <div className="overflow-x-auto rounded-card border border-outline-variant">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-surface-container-high/50">
                  <th className="px-4 py-3 font-oswald text-[11px] font-medium uppercase tracking-[0.05em] text-on-surface-variant">
                    Alumno
                  </th>
                  <th className="px-4 py-3 font-oswald text-[11px] font-medium uppercase tracking-[0.05em] text-on-surface-variant">
                    Tipo
                  </th>
                  <th className="px-4 py-3 font-oswald text-[11px] font-medium uppercase tracking-[0.05em] text-on-surface-variant">
                    Monto
                  </th>
                  <th className="px-4 py-3 font-oswald text-[11px] font-medium uppercase tracking-[0.05em] text-on-surface-variant" />
                  <th className="px-4 py-3 font-oswald text-[11px] font-medium uppercase tracking-[0.05em] text-on-surface-variant">
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody>
                {filas.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center font-inter text-sm text-on-surface-variant">
                      {cargos.length === 0
                        ? 'Sin cargos en este período todavía.'
                        : 'Ningún cargo coincide con el filtro.'}
                    </td>
                  </tr>
                )}
                {filas.map(({ cargo, alumno }) => (
                  <tr key={cargo.id} className="border-t border-outline-variant align-top">
                    <td className="px-4 py-3 font-inter text-sm text-on-surface">
                      {alumno ? `${alumno.nombre} ${alumno.apellido}` : alumnoNombre(cargo.alumno_id)}
                    </td>
                    <td className="px-4 py-3 font-inter text-sm text-on-surface">
                      {cargo.tipo === 'completa' ? 'Cuota completa' : 'Media cuota'}
                    </td>
                    <td className="px-4 py-3 font-inter text-sm text-on-surface">
                      {editandoCargoId === cargo.id ? (
                        <EditarMontoCargo
                          cargoId={cargo.id}
                          montoActual={cargo.monto}
                          label="Monto del cargo"
                          onGuardado={() => setEditandoCargoId(null)}
                          onCancelar={() => setEditandoCargoId(null)}
                        />
                      ) : (
                        <div className="flex items-center gap-3">
                          <span>{money(Number(cargo.monto))}</span>
                          {!cargo.monto_definido && (
                            <span
                              title="No se pudo resolver combo/precio — completá el monto a mano."
                              className="material-symbols-outlined !text-[16px] text-error"
                            >
                              error
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => setEditandoCargoId(cargo.id)}
                            aria-label={`Editar monto del cargo de ${alumno ? `${alumno.nombre} ${alumno.apellido}` : cargo.alumno_id}`}
                            className="text-on-surface-variant hover:text-primary"
                          >
                            <span className="material-symbols-outlined !text-[16px]">edit</span>
                          </button>
                          <ValidarCheckbox cargo={cargo} />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-start gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            setVerAsistenciasDe({
                              alumnoId: cargo.alumno_id,
                              nombre: alumno ? `${alumno.nombre} ${alumno.apellido}` : alumnoNombre(cargo.alumno_id),
                            })
                          }
                          className="inline-flex items-center gap-1 font-inter text-xs font-medium text-primary hover:underline"
                        >
                          <span className="material-symbols-outlined !text-[16px]">event_available</span>
                          Ver asistencias
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setVerPagosDe({
                              alumnoId: cargo.alumno_id,
                              nombre: alumno ? `${alumno.nombre} ${alumno.apellido}` : alumnoNombre(cargo.alumno_id),
                              cargoMonto: Number(cargo.monto),
                              cargoEstado: cargo.estado,
                            })
                          }
                          className="inline-flex items-center gap-1 font-inter text-xs font-medium text-primary hover:underline"
                        >
                          <span className="material-symbols-outlined !text-[16px]">payments</span>
                          Ver pagos
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <BadgeEstadoCargo estado={cargo.estado} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {sinCargo.length > 0 && (
            <div className="rounded-card border border-outline-variant bg-surface-container p-5">
              <p className="mb-2 font-oswald text-[11px] uppercase tracking-[0.05em] text-on-surface-variant">
                Alumnos activos sin cargo en el período (todavía sin asistencia)
              </p>
              <p className="font-inter text-sm text-on-surface">
                {sinCargo.map((a) => `${a.nombre} ${a.apellido}`).join(', ')}
              </p>
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={confirmarValidarTodos}
        title="Validar pagados"
        message={`Se van a marcar como validados ${pagadosSinValidar} cargo(s) del período ${periodo} que ya están pagados (coincidencia exacta o sobrepago). No cambia ningún monto, solo los protege de un recálculo automático. ¿Confirmás?`}
        confirmLabel="Validar"
        loading={validarTodosMutation.isPending}
        onConfirm={() => validarTodosMutation.mutate()}
        onCancel={() => setConfirmarValidarTodos(false)}
      />

      <AsistenciasPeriodoDrawer
        alumnoId={verAsistenciasDe?.alumnoId ?? null}
        alumnoNombre={verAsistenciasDe?.nombre ?? ''}
        periodo={periodo}
        onClose={() => setVerAsistenciasDe(null)}
      />

      <PagosPeriodoDrawer
        alumnoId={verPagosDe?.alumnoId ?? null}
        alumnoNombre={verPagosDe?.nombre ?? ''}
        periodo={periodo}
        cargoMonto={verPagosDe?.cargoMonto ?? 0}
        cargoEstado={verPagosDe?.cargoEstado ?? 'pendiente'}
        onClose={() => setVerPagosDe(null)}
      />
    </div>
  )
}
