import { useQuery } from '@tanstack/react-query'
import { agruparAsistenciasPorSemana, fetchAsistenciasAlumnoPeriodo } from '@/lib/cargos'
import { useTurnos } from '@/hooks/useCatalogos'
import { queryKeys } from '@/lib/queryKeys'
import { STALE_OPERATIVO } from '@/lib/queryClient'
import { formatFecha } from '@/lib/utils'
import { Drawer } from '@/components/ui/Drawer'

interface AsistenciasPeriodoDrawerProps {
  alumnoId: string | null
  alumnoNombre: string
  periodo: string
  onClose: () => void
}

// "Ver asistencias" del cargo continuo (migración 22, punto 5): detalle de
// asistencias del alumno en el período + resumen agrupado por semana del mes.
export function AsistenciasPeriodoDrawer({ alumnoId, alumnoNombre, periodo, onClose }: AsistenciasPeriodoDrawerProps) {
  const { data: turnos = [] } = useTurnos()

  const asistenciasQuery = useQuery({
    queryKey: queryKeys.asistenciasAlumnoPeriodo(alumnoId ?? '', periodo),
    queryFn: () => fetchAsistenciasAlumnoPeriodo(alumnoId!, periodo),
    enabled: !!alumnoId,
    staleTime: STALE_OPERATIVO,
  })

  const asistencias = asistenciasQuery.data ?? []
  const semanas = agruparAsistenciasPorSemana(asistencias)

  return (
    <Drawer open={!!alumnoId} title={`Asistencias — ${alumnoNombre}`} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <p className="font-inter text-sm text-on-surface-variant">Período {periodo}</p>

        {asistenciasQuery.isFetching && <p className="font-inter text-sm text-on-surface-variant">Cargando…</p>}

        {!asistenciasQuery.isFetching && (
          <>
            <div>
              <p className="mb-2 font-oswald text-[11px] uppercase tracking-[0.05em] text-on-surface-variant">
                Resumen por semana
              </p>
              {semanas.length === 0 ? (
                <p className="font-inter text-sm text-on-surface-variant">Sin asistencias en este período.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {semanas.map((s) => (
                    <span
                      key={s.semana}
                      className="rounded-full border border-outline-variant bg-surface-container-high px-3 py-1.5 font-inter text-xs text-on-surface"
                    >
                      Semana {s.semana}: {s.cantidad} asistencia{s.cantidad === 1 ? '' : 's'}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-outline-variant pt-4">
              <p className="mb-2 font-oswald text-[11px] uppercase tracking-[0.05em] text-on-surface-variant">
                Detalle ({asistencias.length})
              </p>
              <div className="flex flex-col gap-2">
                {asistencias.map((a) => {
                  const turno = turnos.find((t) => t.id === a.turno_id)
                  return (
                    <div key={a.id} className="flex items-center justify-between font-inter text-sm">
                      <span className="text-on-surface">{formatFecha(a.fecha)}</span>
                      <span className="text-on-surface-variant">{turno ? `${turno.nombre} (${turno.hora.slice(0, 5)})` : '—'}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </Drawer>
  )
}
