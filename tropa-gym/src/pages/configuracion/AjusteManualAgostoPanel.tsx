import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { marcarEstadoManual } from '@/lib/alumnos'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

// TEMPORAL — uso único. Agosto 2026 no tuvo registro de asistencias, así que
// se usa el pago del mes como evidencia de actividad para no inactivar a
// alumnos al día. Borrar este archivo y su uso en ConfiguracionPage una vez
// corrido. Rango [2026-08-01, 2026-09-01) sobre pagos.fecha.
//
// fecha_desde del RPC va sin backdatear (null = "ahora"): el KPI del
// dashboard reconstruye el estado vigente tomando, por alumno, el evento de
// alumno_estado_historial con fecha_desde más reciente <= hoy. Backdatear al
// 01/08 perdía contra una inactivación automática de sync_estados_automaticos
// fechada más tarde en agosto (el mismo escenario de "sin asistencias" que
// motiva este ajuste), así que no impactaba el dashboard aunque sí
// actualizaba alumnos.estado.
const DESDE = '2026-08-01'
const HASTA = '2026-09-01'

export function AjusteManualAgostoPanel() {
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)
  const [resultado, setResultado] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleConfirm() {
    setLoading(true)
    setError(null)
    setResultado(null)

    try {
      const { data: pagos, error: errorPagos } = await supabase
        .from('pagos')
        .select('id')
        .gte('fecha', DESDE)
        .lt('fecha', HASTA)
      if (errorPagos) throw new Error(errorPagos.message)

      const pagoIds = (pagos ?? []).map((p) => p.id as string)
      if (pagoIds.length === 0) {
        setResultado(0)
        return
      }

      const { data: detalles, error: errorDetalles } = await supabase
        .from('pagos_alumnos')
        .select('alumno_id')
        .in('pago_id', pagoIds)
      if (errorDetalles) throw new Error(errorDetalles.message)

      const alumnoIds = [...new Set((detalles ?? []).map((d) => d.alumno_id as string))]

      let actualizados = 0
      for (const alumnoId of alumnoIds) {
        const { error: errorMarcar } = await marcarEstadoManual(
          alumnoId,
          'activo',
          'Ajuste manual — pago agosto sin asistencia',
          null,
        )
        if (!errorMarcar) actualizados++
      }
      setResultado(actualizados)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado')
    } finally {
      setLoading(false)
      setConfirming(false)
    }
  }

  return (
    <div className="mt-8 rounded-lg border border-dashed border-error bg-error/5 p-4">
      <p className="mb-1 font-oswald text-[13px] font-semibold uppercase tracking-[0.03em] text-error">
        Ajuste temporal · uso único
      </p>
      <p className="mb-3 font-inter text-sm text-on-surface-variant">
        Marca como "activo" a todos los alumnos con un pago registrado entre el 01/08/2026 y el
        31/08/2026, ya que agosto no tuvo registro de asistencias. Correr una sola vez.
      </p>

      <Button type="button" variant="ghost" onClick={() => setConfirming(true)} disabled={loading}>
        {loading ? 'Procesando…' : 'Activar por pago de agosto 2026'}
      </Button>

      {resultado !== null && (
        <p className="mt-3 font-inter text-sm text-on-surface">
          {resultado} alumno{resultado === 1 ? '' : 's'} actualizado{resultado === 1 ? '' : 's'}.
        </p>
      )}
      {error && <p className="mt-3 font-inter text-sm text-error">{error}</p>}

      <ConfirmDialog
        open={confirming}
        title="Ajuste manual de agosto"
        message={`Se marcará como "activo" (vigente desde ahora) a todos los alumnos con pago registrado entre el 01/08/2026 y el 31/08/2026. Esta acción es temporal y debería correrse una sola vez.`}
        confirmLabel={loading ? 'Procesando…' : 'Confirmar'}
        loading={loading}
        onConfirm={handleConfirm}
        onCancel={() => setConfirming(false)}
      />
    </div>
  )
}
