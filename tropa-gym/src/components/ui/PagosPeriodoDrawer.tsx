import { useQuery } from '@tanstack/react-query'
import type { EstadoPago } from '@/types/db'
import { fetchPagosAlumnoPeriodo } from '@/lib/cargos'
import { queryKeys } from '@/lib/queryKeys'
import { STALE_OPERATIVO } from '@/lib/queryClient'
import { formatFecha } from '@/lib/utils'
import { Drawer } from '@/components/ui/Drawer'
import { BadgeEstadoCargo } from '@/components/ui/BadgeEstado'

const METODO_LABEL: Record<string, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  combinado: 'Combinado',
}

interface PagosPeriodoDrawerProps {
  alumnoId: string | null
  alumnoNombre: string
  // Con período: acotado a ese período (pantalla Cargos) y muestra el
  // resumen de arriba (monto del cargo / estado). Sin período: trae todo el
  // historial de pagos del alumno (Resumen Mensual) — cada fila ya trae su
  // propio estado, no hace falta un resumen único.
  periodo?: string
  cargoMonto?: number
  cargoEstado?: EstadoPago
  onClose: () => void
}

function money(v: number): string {
  return `$${Math.round(v).toLocaleString('es-AR')}`
}

// "Ver pagos" del cargo continuo — contrapartida de "Ver asistencias": el
// historial de pagos del alumno para poder validar de un vistazo si un
// cargo pendiente ya está cubierto.
export function PagosPeriodoDrawer({
  alumnoId,
  alumnoNombre,
  periodo,
  cargoMonto,
  cargoEstado,
  onClose,
}: PagosPeriodoDrawerProps) {
  const pagosQuery = useQuery({
    queryKey: periodo
      ? queryKeys.pagosAlumnoPeriodo(alumnoId ?? '', periodo)
      : queryKeys.pagosAlumno(alumnoId ?? ''),
    queryFn: () => fetchPagosAlumnoPeriodo(alumnoId!, periodo),
    enabled: !!alumnoId,
    staleTime: STALE_OPERATIVO,
  })

  const pagos = pagosQuery.data ?? []
  const totalPagado = pagos.reduce((sum, p) => sum + p.monto, 0)

  return (
    <Drawer
      open={!!alumnoId}
      title={periodo ? `Pagos — ${alumnoNombre}` : `Historial de pagos — ${alumnoNombre}`}
      onClose={onClose}
    >
      <div className="flex flex-col gap-4">
        {periodo && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-outline-variant bg-surface-container-low px-4 py-3">
            <div>
              <p className="font-inter text-xs text-on-surface-variant">Período {periodo}</p>
              <p className="font-inter text-sm text-on-surface">
                Cargo {money(cargoMonto ?? 0)} · Pagado {money(totalPagado)}
              </p>
            </div>
            {cargoEstado && <BadgeEstadoCargo estado={cargoEstado} />}
          </div>
        )}

        {pagosQuery.isFetching && <p className="font-inter text-sm text-on-surface-variant">Cargando…</p>}

        {!pagosQuery.isFetching && pagos.length === 0 && (
          <p className="font-inter text-sm text-on-surface-variant">Sin pagos registrados.</p>
        )}

        {!pagosQuery.isFetching && pagos.length > 0 && (
          <>
            {!periodo && (
              <p className="font-inter text-sm text-on-surface-variant">
                Total pagado (todo el historial): <span className="text-on-surface">{money(totalPagado)}</span>
              </p>
            )}
            <div className="overflow-x-auto rounded-lg border border-outline-variant">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="bg-surface-container-high/50">
                    <th className="px-3 py-2 font-oswald text-[11px] font-medium uppercase tracking-[0.05em] text-on-surface-variant">
                      Período
                    </th>
                    <th className="px-3 py-2 font-oswald text-[11px] font-medium uppercase tracking-[0.05em] text-on-surface-variant">
                      Fecha
                    </th>
                    <th className="px-3 py-2 font-oswald text-[11px] font-medium uppercase tracking-[0.05em] text-on-surface-variant">
                      Monto
                    </th>
                    <th className="px-3 py-2 font-oswald text-[11px] font-medium uppercase tracking-[0.05em] text-on-surface-variant">
                      Forma de pago
                    </th>
                    <th className="px-3 py-2 font-oswald text-[11px] font-medium uppercase tracking-[0.05em] text-on-surface-variant">
                      Estado
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pagos.map((p) => (
                    <tr key={p.id} className="border-t border-outline-variant">
                      <td className="px-3 py-2 font-inter text-sm text-on-surface-variant">{p.periodo}</td>
                      <td className="px-3 py-2 font-inter text-sm text-on-surface">
                        {formatFecha(p.fecha.slice(0, 10))}
                      </td>
                      <td className="px-3 py-2 font-inter text-sm text-on-surface">{money(p.monto)}</td>
                      <td className="px-3 py-2 font-inter text-sm text-on-surface">
                        {METODO_LABEL[p.metodoPago] ?? p.metodoPago}
                      </td>
                      <td className="px-3 py-2">
                        <BadgeEstadoCargo estado={p.estado} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </Drawer>
  )
}
