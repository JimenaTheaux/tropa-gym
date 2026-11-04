import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { diaLocal, fetchPendientesCierre, horaLocal, parseMontoAR, pesos } from '@/lib/caja'
import { traducirError } from '@/lib/errores'
import { logError } from '@/lib/logErrores'
import { queryKeys } from '@/lib/queryKeys'
import { formatFecha } from '@/lib/utils'
import type { CerrarCajaTurnoParams, PagoPendienteCierre } from '@/types/db'
import { Button } from '@/components/ui/button'
import { ChipCaja } from '@/components/ui/ChipCaja'
import { Drawer } from '@/components/ui/Drawer'
import { FormInput, FormTextarea } from '@/components/ui/FormField'

const METODO_LABEL: Record<string, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  combinado: 'Combinado',
}

export interface CierreCajaObjetivo {
  profesorId: string
  nombre: string
  asistenciaId: string | null
}

interface CierreCajaDrawerProps {
  objetivo: CierreCajaObjetivo
  onClose: () => void
  onCerrado: (mensaje: string) => void
}

export function CierreCajaDrawer({ objetivo, onClose, onCerrado }: CierreCajaDrawerProps) {
  const { perfil } = useAuth()
  const queryClient = useQueryClient()
  const [noCoincide, setNoCoincide] = useState(false)
  const [montoTexto, setMontoTexto] = useState('')
  const [observacion, setObservacion] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  const query = useQuery({
    queryKey: queryKeys.cajaPendientes(objetivo.profesorId),
    queryFn: () => fetchPendientesCierre(objetivo.profesorId),
    staleTime: 0,
  })
  const datos = query.data
  const pagos = useMemo(() => datos?.pagos ?? [], [datos])
  const efectivo = Number(datos?.total_efectivo ?? 0)
  const transferencias = Number(datos?.total_transferencia ?? 0)

  const porDia = useMemo(() => {
    const grupos = new Map<string, PagoPendienteCierre[]>()
    for (const p of pagos) {
      const dia = diaLocal(p.created_at)
      grupos.set(dia, [...(grupos.get(dia) ?? []), p])
    }
    return [...grupos.entries()]
  }, [pagos])

  const declarado = parseMontoAR(montoTexto)
  const diferencia = declarado === null ? null : Math.round((declarado - efectivo) * 100) / 100

  const cerrar = useMutation({
    mutationFn: async (params: CerrarCajaTurnoParams) => {
      const { data, error } = await supabase.rpc('cerrar_caja_turno', params)
      if (error) throw new Error(error.message)
      if (!data) throw new Error('El servidor no confirmó el cierre.')
    },
  })
  const guardando = cerrar.isPending

  async function enviar(coincide: boolean) {
    if (guardando) return
    setError(null)
    setAviso(null)
    const params: CerrarCajaTurnoParams = {
      p_profesor_id: objetivo.profesorId,
      p_asistencia_id: objetivo.asistenciaId,
      p_pago_ids: pagos.map((p) => p.id),
      p_coincide: coincide,
      p_efectivo_declarado: coincide ? null : declarado,
      p_observacion: coincide ? null : observacion,
    }

    try {
      await cerrar.mutateAsync(params)
    } catch (err) {
      const mensaje = err instanceof Error ? err.message : String(err)
      await logError({ contexto: 'cierre_caja', usuarioId: perfil?.id ?? null, payloadIntentado: params, error: err })
      if (mensaje.includes('La lista cambió')) {
        await query.refetch()
        setAviso('La lista cambió: revisá los pagos y volvé a confirmar.')
        return
      }
      setError(traducirError(mensaje, 'No se pudo cerrar la caja.'))
      return
    }

    queryClient.invalidateQueries({ queryKey: queryKeys.caja })
    queryClient.invalidateQueries({ queryKey: queryKeys.historialPagos })
    onCerrado(
      coincide
        ? `Caja de ${objetivo.nombre} cerrada: ${pesos(efectivo)} en efectivo.`
        : `Caja de ${objetivo.nombre} cerrada con diferencia: declaró ${pesos(declarado ?? 0)}, sistema ${pesos(efectivo)}.`,
    )
  }

  const puedeCerrarConDiferencia =
    !guardando && declarado !== null && diferencia !== 0 && observacion.trim().length > 0
  const hayPagos = pagos.length > 0

  return (
    <Drawer
      open
      size="lg"
      title={`Cierre de caja — ${objetivo.nombre}`}
      onClose={guardando ? () => undefined : onClose}
      footer={
        <>
          <Button type="button" variant="ghost" disabled={guardando} onClick={onClose}>
            Cerrar después
          </Button>
          {hayPagos && (
            <Button type="button" variant="primario" disabled={guardando} onClick={() => setNoCoincide((v) => !v)}>
              {noCoincide ? 'Sí coincide' : 'No coincide'}
            </Button>
          )}
          {hayPagos &&
            (noCoincide ? (
              <Button type="button" variant="solido" disabled={!puedeCerrarConDiferencia} onClick={() => enviar(false)}>
                {guardando ? 'Guardando…' : 'Cerrar con diferencia'}
              </Button>
            ) : (
              <Button type="button" variant="solido" disabled={guardando || query.isFetching} onClick={() => enviar(true)}>
                {guardando ? 'Guardando…' : `Confirmo: tengo ${pesos(efectivo)} en efectivo`}
              </Button>
            ))}
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {query.isLoading && <p className="font-inter text-sm text-on-surface-variant">Cargando pagos…</p>}

        {query.isError && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-inter text-sm text-error">No se pudieron cargar los pagos.</p>
            <Button type="button" variant="ghost" onClick={() => query.refetch()}>
              Reintentar
            </Button>
          </div>
        )}

        {aviso && (
          <p className="rounded-lg border border-outline bg-surface-container-high px-3 py-2 font-inter text-sm text-on-surface">
            {aviso}
          </p>
        )}

        {datos && !datos.activo && (
          <p className="font-inter text-sm text-on-surface-variant">El cierre de caja no está activo.</p>
        )}

        {datos?.activo && !hayPagos && (
          <p className="font-inter text-sm text-on-surface-variant">No hay pagos pendientes de cierre.</p>
        )}

        {hayPagos && (
          <div className="flex flex-col gap-1 rounded-card border border-outline-variant bg-surface-container-low p-4">
            <span className="font-oswald text-[11px] uppercase tracking-[0.05em] text-on-surface-variant">
              Efectivo a entregar
            </span>
            <span className="font-anton text-[26px] text-on-surface">{pesos(efectivo)}</span>
            <span className="font-inter text-xs text-on-surface-variant">
              Transferencias: {pesos(transferencias)} — informativo, no se cuenta
            </span>
          </div>
        )}

        {noCoincide && hayPagos && (
          <div className="flex flex-col gap-3 rounded-card border border-outline-variant p-4">
            <div className="flex flex-wrap items-end gap-6">
              <FormInput
                id="cierre-monto-real"
                label="Efectivo que tengo"
                inputMode="decimal"
                placeholder="0,00"
                value={montoTexto}
                onChange={(e) => setMontoTexto(e.target.value)}
              />
              {diferencia !== null && (
                <div className="flex flex-col gap-1">
                  <span className="font-oswald text-[11px] uppercase tracking-[0.05em] text-on-surface-variant">
                    Diferencia
                  </span>
                  <span className={`font-oswald text-base font-bold ${diferencia === 0 ? 'text-on-surface' : 'text-error'}`}>
                    {diferencia > 0 ? '+' : ''}
                    {pesos(diferencia)}
                  </span>
                </div>
              )}
            </div>
            {diferencia === 0 && (
              <p className="font-inter text-xs text-on-surface-variant">
                Es igual al efectivo del sistema: usá "Sí coincide" para confirmar.
              </p>
            )}
            <FormTextarea
              id="cierre-observacion"
              label="Observación (obligatoria)"
              value={observacion}
              onChange={(e) => setObservacion(e.target.value)}
            />
          </div>
        )}

        {error && <p className="font-inter text-sm text-error">{error}</p>}

        {porDia.map(([dia, lista]) => (
          <div key={dia} className="flex flex-col gap-2">
            <h3 className="font-oswald text-[11px] uppercase tracking-[0.05em] text-on-surface-variant">
              {formatFecha(dia)}
            </h3>
            {lista.map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 border-t border-outline-variant py-2"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="font-inter text-sm text-on-surface">{p.descripcion ?? '—'}</span>
                  <span className="font-inter text-xs text-on-surface-variant">{horaLocal(p.created_at)}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {p.fecha_distinta && <ChipCaja label="Fecha distinta" icon="event_busy" />}
                  <ChipCaja label={METODO_LABEL[p.metodo_pago] ?? p.metodo_pago} />
                  <span className="font-oswald text-sm font-bold text-on-surface">{pesos(p.total)}</span>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </Drawer>
  )
}
