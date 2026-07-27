import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { Alumno } from '@/types/db'
import { useAuth } from '@/contexts/AuthContext'
import { fetchHistorialAlumno, getEstadoCuenta } from '@/lib/cuenta'
import { fetchHistorialEstado } from '@/lib/alumnos'
import { formatFecha } from '@/lib/utils'
import { useCombos, useDisciplinas } from '@/hooks/useCatalogos'
import { queryKeys } from '@/lib/queryKeys'
import { STALE_OPERATIVO } from '@/lib/queryClient'
import { Drawer } from '@/components/ui/Drawer'
import { BadgeEstadoCargo } from '@/components/ui/BadgeEstado'
import { EditarMontoCargo } from '@/components/ui/EditarMontoCargo'
import { EstadoToggleButton } from '@/components/ui/EstadoToggleButton'

interface FichaAlumnoDrawerProps {
  alumno: Alumno | null
  onClose: () => void
}

const METODO_LABEL: Record<string, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  combinado: 'Combinado',
}

// Vista rápida de solo lectura — no navega a Alumnos para no acoplar el
// Dashboard a esa pantalla (no forma parte del alcance de Fase 5).
export function FichaAlumnoDrawer({ alumno, onClose }: FichaAlumnoDrawerProps) {
  const { perfil } = useAuth()
  const puedeEditarCargos = perfil?.rol === 'admin' || perfil?.rol === 'profesor'
  const queryClient = useQueryClient()

  const { data: disciplinas = [] } = useDisciplinas()
  const { data: combos = [] } = useCombos()
  const disciplina = disciplinas.find((d) => d.id === alumno?.disciplina_id) ?? null
  const combo = combos.find((c) => c.id === alumno?.combo_id) ?? null

  const cuentaQuery = useQuery({
    queryKey: queryKeys.estadoCuenta(alumno?.id ?? ''),
    queryFn: () => getEstadoCuenta(alumno!.id),
    enabled: !!alumno,
    staleTime: STALE_OPERATIVO,
  })
  const historialQuery = useQuery({
    queryKey: queryKeys.historialAlumno(alumno?.id ?? ''),
    queryFn: () => fetchHistorialAlumno(alumno!.id),
    enabled: !!alumno,
    staleTime: STALE_OPERATIVO,
  })
  const historialEstadoQuery = useQuery({
    queryKey: queryKeys.historialEstadoAlumno(alumno?.id ?? ''),
    queryFn: () => fetchHistorialEstado(alumno!.id),
    enabled: !!alumno,
    staleTime: STALE_OPERATIVO,
  })

  const cuenta = cuentaQuery.data ?? null
  const historial = historialQuery.data ?? []
  const historialEstado = historialEstadoQuery.data ?? []
  const loading = cuentaQuery.isFetching || historialQuery.isFetching

  const [editandoPeriodo, setEditandoPeriodo] = useState<string | null>(null)

  useEffect(() => {
    setEditandoPeriodo(null)
  }, [alumno])

  function onMontoGuardado() {
    setEditandoPeriodo(null)
    return queryClient.invalidateQueries({ queryKey: queryKeys.estadoCuenta(alumno?.id ?? '') })
  }

  return (
    <Drawer open={!!alumno} title="Ficha del alumno" onClose={onClose}>
      {alumno && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-oswald text-lg font-bold uppercase text-on-surface">
                {alumno.nombre} {alumno.apellido}
              </p>
              <p className="font-inter text-sm text-on-surface-variant">DNI {alumno.dni}</p>
            </div>
            <EstadoToggleButton alumno={alumno} />
          </div>

          <div className="grid grid-cols-2 gap-4 border-t border-outline-variant pt-4">
            <div>
              <p className="font-oswald text-[11px] uppercase tracking-[0.05em] text-on-surface-variant">
                Teléfono
              </p>
              <p className="font-inter text-sm text-on-surface">{alumno.telefono ?? '—'}</p>
            </div>
            <div>
              <p className="font-oswald text-[11px] uppercase tracking-[0.05em] text-on-surface-variant">
                Fecha de alta
              </p>
              <p className="font-inter text-sm text-on-surface">{formatFecha(alumno.fecha_alta.slice(0, 10))}</p>
            </div>
            <div>
              <p className="font-oswald text-[11px] uppercase tracking-[0.05em] text-on-surface-variant">
                Plan actual
              </p>
              <p className="font-inter text-sm text-on-surface">
                {disciplina || combo
                  ? `${disciplina?.nombre ?? '—'} — ${combo?.nombre ?? '—'}`
                  : 'Sin plan asignado'}
              </p>
            </div>
          </div>

          {historialEstado.length > 0 && (
            <div className="border-t border-outline-variant pt-4">
              <p className="mb-2 font-oswald text-[11px] uppercase tracking-[0.05em] text-on-surface-variant">
                Historial de estado
              </p>
              <div className="flex flex-col gap-2">
                {historialEstado.map((h) => (
                  <div key={h.id} className="flex items-center justify-between font-inter text-xs">
                    <span className="text-on-surface-variant">
                      {formatFecha(h.fecha_desde.slice(0, 10))} — {h.origen === 'manual' ? 'manual' : 'automático'}
                      {h.motivo ? ` (${h.motivo})` : ''}
                    </span>
                    <span className="text-on-surface">{h.estado === 'activo' ? 'Activo' : 'Inactivo'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="border-t border-outline-variant pt-4">
            <p className="mb-2 font-oswald text-[11px] uppercase tracking-[0.05em] text-on-surface-variant">
              Estado de cuenta
            </p>
            {loading && <p className="font-inter text-sm text-on-surface-variant">Cargando…</p>}
            {!loading && cuenta && (
              <>
                <p className="font-anton text-2xl text-on-surface">
                  ${cuenta.saldoTotal.toLocaleString('es-AR')}
                </p>
                <div className="mt-3 flex flex-col gap-2">
                  {cuenta.periodos.length === 0 && (
                    <p className="font-inter text-sm text-on-surface-variant">Sin movimientos registrados.</p>
                  )}
                  {cuenta.periodos.map((p) => (
                    <div key={p.periodo} className="flex flex-col gap-2 border-b border-outline-variant/50 pb-2 last:border-0">
                      <div className="flex items-center justify-between font-inter text-sm">
                        <span className="text-on-surface-variant">{p.periodo}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-on-surface">${p.saldo.toLocaleString('es-AR')}</span>
                          <BadgeEstadoCargo estado={p.estado} />
                          {!p.cargoMontoDefinido && (
                            <span
                              title="El cargo se generó pero no se pudo resolver combo/precio — el monto todavía no está definido."
                              className="inline-flex items-center gap-1 rounded-full border border-error px-2.5 py-1 font-inter text-xs font-medium text-error"
                            >
                              <span className="material-symbols-outlined !text-[14px]">error</span>
                              Monto sin definir
                            </span>
                          )}
                          {puedeEditarCargos && p.cargoId && editandoPeriodo !== p.periodo && (
                            <button
                              type="button"
                              onClick={() => setEditandoPeriodo(p.periodo)}
                              aria-label={`Editar monto del cargo de ${p.periodo}`}
                              className="text-on-surface-variant hover:text-primary"
                            >
                              <span className="material-symbols-outlined !text-[16px]">edit</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {editandoPeriodo === p.periodo && p.cargoId && (
                        <EditarMontoCargo
                          cargoId={p.cargoId}
                          montoActual={p.cargoMonto}
                          label="Nuevo monto del cargo"
                          confirmMessage={`Vas a cambiar el monto del cargo de ${p.periodo}. Esto es una excepción y recalcula el estado del cargo. ¿Confirmás?`}
                          onGuardado={onMontoGuardado}
                          onCancelar={() => setEditandoPeriodo(null)}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="border-t border-outline-variant pt-4">
            <p className="mb-2 font-oswald text-[11px] uppercase tracking-[0.05em] text-on-surface-variant">
              Historial de pagos
            </p>
            {loading && <p className="font-inter text-sm text-on-surface-variant">Cargando…</p>}
            {!loading && historial.length === 0 && (
              <p className="font-inter text-sm text-on-surface-variant">Sin pagos registrados.</p>
            )}
            {!loading && historial.length > 0 && (
              <div className="flex flex-col gap-2">
                {historial.map((h) => (
                  <div key={h.id} className="flex items-center justify-between font-inter text-sm">
                    <div className="flex flex-col">
                      <span className="text-on-surface">{formatFecha(h.fecha.slice(0, 10))}</span>
                      <span className="text-xs text-on-surface-variant">
                        {h.periodo} — {METODO_LABEL[h.metodoPago] ?? h.metodoPago}
                      </span>
                    </div>
                    <span className="font-medium text-on-surface">${h.monto.toLocaleString('es-AR')}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Drawer>
  )
}
