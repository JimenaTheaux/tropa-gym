import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchKpiCards, fetchTopHorarios, fetchTrend, periodoActual, periodoLabel } from '@/lib/dashboard'
import { traducirError } from '@/lib/errores'
import { queryKeys } from '@/lib/queryKeys'
import { STALE_OPERATIVO } from '@/lib/queryClient'
import { FormMonthInput } from '@/components/ui/FormField'
import { TrendChart } from '@/components/ui/TrendChart'
import { EstadoEvolucionChart } from '@/components/ui/EstadoEvolucionChart'

function money(v: number): string {
  return `$${Math.round(v).toLocaleString('es-AR')}`
}

interface CardKpiProps {
  label: string
  value: string
  destacado?: boolean
}

function CardKpi({ label, value, destacado }: CardKpiProps) {
  return (
    <div className="rounded-card border border-outline-variant bg-surface-container p-4">
      <p className="font-oswald text-[11px] uppercase tracking-[0.05em] text-on-surface-variant">{label}</p>
      <p className="font-anton text-2xl text-on-surface" style={destacado ? { color: '#40e432' } : undefined}>
        {value}
      </p>
    </div>
  )
}

interface CardKpiIngresosMetodoProps {
  efectivo: string
  transferencia: string
}

function CardKpiIngresosMetodo({ efectivo, transferencia }: CardKpiIngresosMetodoProps) {
  return (
    <div className="rounded-card border border-outline-variant bg-surface-container p-4">
      <p className="font-oswald text-[11px] uppercase tracking-[0.05em] text-on-surface-variant">
        Ingresos por método
      </p>
      <div className="mt-1 flex items-end gap-4">
        <div>
          <p className="font-oswald text-[10px] uppercase tracking-[0.05em] text-on-surface-variant">Efectivo</p>
          <p className="font-anton text-lg text-on-surface">{efectivo}</p>
        </div>
        <div>
          <p className="font-oswald text-[10px] uppercase tracking-[0.05em] text-on-surface-variant">
            Transferencia
          </p>
          <p className="font-anton text-lg text-on-surface">{transferencia}</p>
        </div>
      </div>
    </div>
  )
}

export function KpiPanel() {
  const [periodo, setPeriodo] = useState(periodoActual())

  const kpiQuery = useQuery({
    queryKey: queryKeys.dashboardKpi(periodo),
    queryFn: () => fetchKpiCards(periodo),
    staleTime: STALE_OPERATIVO,
  })
  const trendQuery = useQuery({
    queryKey: queryKeys.dashboardTrend(periodo, 6),
    queryFn: () => fetchTrend(periodo, 6),
    staleTime: STALE_OPERATIVO,
  })
  const horariosQuery = useQuery({
    queryKey: queryKeys.dashboardHorarios(periodo),
    queryFn: () => fetchTopHorarios(periodo, 5),
    staleTime: STALE_OPERATIVO,
  })

  const cards = kpiQuery.data ?? null
  const trend = trendQuery.data ?? []
  const horarios = horariosQuery.data ?? []
  const loading = kpiQuery.isFetching || trendQuery.isFetching || horariosQuery.isFetching
  const queryError = kpiQuery.error ?? trendQuery.error ?? horariosQuery.error
  const error = queryError
    ? traducirError(queryError instanceof Error ? queryError.message : null, 'Error al cargar el dashboard')
    : null

  const maxHorario = Math.max(1, ...horarios.map((h) => h.cantidad))

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-4">
        <FormMonthInput id="kpi-periodo" label="Período" required value={periodo} onChange={setPeriodo} />
      </div>

      {error && <p className="font-inter text-sm text-error">{error}</p>}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <CardKpi label="Alumnos activos" value={loading ? '…' : String(cards?.alumnosActivos ?? 0)} />
        <CardKpi label="Ingresos" value={loading ? '…' : money(cards?.ingresos ?? 0)} destacado />
        <CardKpiIngresosMetodo
          efectivo={loading ? '…' : money(cards?.ingresosEfectivo ?? 0)}
          transferencia={loading ? '…' : money(cards?.ingresosTransferencia ?? 0)}
        />
        <CardKpi label="Saldo a cobrar" value={loading ? '…' : money(cards?.saldoACobrar ?? 0)} />
        <CardKpi label="Egresos" value={loading ? '…' : money(cards?.egresos ?? 0)} />
        <CardKpi label="Ganancia neta" value={loading ? '…' : money(cards?.gananciaNeta ?? 0)} destacado />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TrendChart
          title="Ganancia neta por período"
          data={trend.map((t) => ({ periodo: t.periodo, label: periodoLabel(t.periodo), value: t.gananciaNeta }))}
          formatValue={money}
          diverging
        />
        <EstadoEvolucionChart
          title="Alumnos activos vs. inactivos por período"
          data={trend.map((t) => ({
            periodo: t.periodo,
            label: periodoLabel(t.periodo),
            activos: t.alumnosActivos,
            inactivos: t.alumnosInactivos,
          }))}
        />
      </div>

      <div className="rounded-card border border-outline-variant bg-surface-container p-5">
        <p className="mb-4 font-oswald text-[13px] font-bold uppercase tracking-[0.03em] text-on-surface">
          Top horarios con mayor ocupación
        </p>
        {loading && <p className="font-inter text-sm text-on-surface-variant">Cargando…</p>}
        {!loading && horarios.length === 0 && (
          <p className="font-inter text-sm text-on-surface-variant">Sin asistencias registradas en el período.</p>
        )}
        <div className="flex flex-col gap-3">
          {horarios.map((h) => (
            <div key={h.turnoId} className="flex items-center gap-3">
              <p className="w-40 shrink-0 font-inter text-sm text-on-surface">{h.nombre}</p>
              <div className="h-3 flex-1 overflow-hidden rounded-full bg-surface-container-highest">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${(h.cantidad / maxHorario) * 100}%`, background: '#40e432' }}
                />
              </div>
              <p className="w-10 shrink-0 text-right font-inter text-sm text-on-surface-variant">{h.cantidad}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
