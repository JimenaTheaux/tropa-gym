import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Cargo } from '@/types/db'
import { fetchCargosPeriodo, marcarCargoValidado } from '@/lib/cargos'
import { useAlumnos } from '@/hooks/useAlumnos'
import { queryKeys } from '@/lib/queryKeys'
import { STALE_OPERATIVO } from '@/lib/queryClient'
import { FormMonthInput, FormCheckbox } from '@/components/ui/FormField'
import { BadgeEstadoCargo } from '@/components/ui/BadgeEstado'
import { EditarMontoCargo } from '@/components/ui/EditarMontoCargo'
import { AsistenciasPeriodoDrawer } from '@/components/ui/AsistenciasPeriodoDrawer'

function periodoActual(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function money(v: number): string {
  return `$${Math.round(v).toLocaleString('es-AR')}`
}

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
  const [periodo, setPeriodo] = useState(periodoActual())
  const { data: alumnos = [] } = useAlumnos()
  const [editandoCargoId, setEditandoCargoId] = useState<string | null>(null)
  const [verAsistenciasDe, setVerAsistenciasDe] = useState<{ alumnoId: string; nombre: string } | null>(null)

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

  const filas = cargos
    .map((c) => ({ cargo: c, alumno: alumnos.find((a) => a.id === c.alumno_id) }))
    .sort((a, b) => (a.alumno?.apellido ?? '').localeCompare(b.alumno?.apellido ?? ''))

  const completas = cargos.filter((c) => c.tipo === 'completa').length
  const medias = cargos.filter((c) => c.tipo === 'media').length
  const sinValidar = cargos.filter((c) => !c.validado).length
  const montoTotal = cargos.reduce((sum, c) => sum + Number(c.monto), 0)
  const sinCargo = alumnos.filter((a) => a.estado === 'activo' && !cargosPeriodo.has(a.id))

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-oswald text-2xl font-bold uppercase tracking-[0.02em] text-on-surface">
        Cargos del Período
      </h1>

      <div className="flex flex-wrap items-end gap-4 rounded-card border border-outline-variant bg-surface-container p-5">
        <FormMonthInput id="cargos-periodo" label="Período" required value={periodo} onChange={setPeriodo} />
      </div>

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
                      Sin cargos en este período todavía.
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

      <AsistenciasPeriodoDrawer
        alumnoId={verAsistenciasDe?.alumnoId ?? null}
        alumnoNombre={verAsistenciasDe?.nombre ?? ''}
        periodo={periodo}
        onClose={() => setVerAsistenciasDe(null)}
      />
    </div>
  )
}
