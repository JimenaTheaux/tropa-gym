import { Fragment, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { fetchPagosDeCierre, fetchResumenDia, horaLocal, moverDia, pesos } from '@/lib/caja'
import { traducirError } from '@/lib/errores'
import { logError } from '@/lib/logErrores'
import { queryKeys } from '@/lib/queryKeys'
import { STALE_OPERATIVO } from '@/lib/queryClient'
import { hoyIso } from '@/lib/utils'
import type { CajaResumenDia, EstadoCierre } from '@/types/db'
import { Button } from '@/components/ui/button'
import { ChipCaja, ChipEstadoCierre } from '@/components/ui/ChipCaja'
import { FormCheckbox, FormDateInput } from '@/components/ui/FormField'
import { ObservacionTexto } from '@/components/ui/ObservacionTexto'
import { ReabrirCierreDialog } from '@/components/ui/ReabrirCierreDialog'

const TH = 'px-4 py-3 font-oswald text-[11px] font-medium uppercase tracking-[0.05em] text-on-surface-variant'
const TD = 'px-4 py-3 font-inter text-sm text-on-surface'

type CierreDia = CajaResumenDia['cierres'][number]

function horario(c: CierreDia): string {
  if (!c.turno_inicio) return `Cerró ${horaLocal(c.cerrado_en)}`
  return `${horaLocal(c.turno_inicio)} a ${c.turno_fin ? horaLocal(c.turno_fin) : '—'}`
}

function PagosDelCierre({ cierreId, estado }: { cierreId: string; estado: EstadoCierre }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.cajaPagosDeCierre(cierreId),
    queryFn: () => fetchPagosDeCierre(cierreId),
    staleTime: STALE_OPERATIVO,
  })

  if (isLoading) return <p className="font-inter text-xs text-on-surface-variant">Cargando pagos…</p>
  if (isError) return <p className="font-inter text-xs text-error">No se pudieron cargar los pagos.</p>

  return (
    <div className="flex flex-col gap-1">
      {(data ?? []).map((p) => (
        <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-1 font-inter text-sm">
          <span className="text-on-surface">
            {p.descripcion ?? '—'}
            {!p.pago_id && estado !== 'reabierto' && <span className="text-error"> — pago eliminado</span>}
          </span>
          <span className="text-on-surface-variant">
            Efectivo {pesos(p.efectivo)} · Transferencia {pesos(p.transferencia)} · Total {pesos(p.total)}
          </span>
        </div>
      ))}
    </div>
  )
}

export function DiaView() {
  const { perfil } = useAuth()
  const queryClient = useQueryClient()
  const [fecha, setFecha] = useState(hoyIso())
  const [soloDiferencia, setSoloDiferencia] = useState(false)
  const [abierto, setAbierto] = useState<string | null>(null)
  const [reabriendo, setReabriendo] = useState<CierreDia | null>(null)
  const [errorReabrir, setErrorReabrir] = useState<string | null>(null)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.cajaResumenDia(fecha),
    queryFn: () => fetchResumenDia(fecha),
    enabled: fecha.length === 10,
    staleTime: STALE_OPERATIVO,
  })

  const reabrir = useMutation({
    mutationFn: async ({ cierreId, motivo }: { cierreId: string; motivo: string }) => {
      const { error } = await supabase.rpc('reabrir_cierre', { p_cierre_id: cierreId, p_motivo: motivo })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.caja })
      queryClient.invalidateQueries({ queryKey: queryKeys.historialPagos })
    },
  })

  async function confirmarReabrir(motivo: string) {
    if (!reabriendo) return
    setErrorReabrir(null)
    const params = { cierreId: reabriendo.cierre_id, motivo }
    try {
      await reabrir.mutateAsync(params)
    } catch (err) {
      await logError({ contexto: 'cierre_caja_reabrir', usuarioId: perfil?.id ?? null, payloadIntentado: params, error: err })
      setErrorReabrir(traducirError(err instanceof Error ? err.message : null, 'No se pudo reabrir el cierre.'))
      return
    }
    setReabriendo(null)
  }

  const cierres = data?.cierres ?? []
  const visibles = soloDiferencia ? cierres.filter((c) => Number(c.diferencia) !== 0) : cierres
  const diferenciasDia = cierres
    .filter((c) => c.estado !== 'reabierto')
    .reduce((s, c) => s + Number(c.diferencia), 0)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-3">
        <Button type="button" variant="ghost" aria-label="Día anterior" onClick={() => setFecha((f) => moverDia(f, -1))}>
          <span className="material-symbols-outlined !text-[18px]">chevron_left</span>
        </Button>
        <FormDateInput id="caja-dia" label="Fecha" required value={fecha} onChange={setFecha} />
        <Button type="button" variant="ghost" aria-label="Día siguiente" onClick={() => setFecha((f) => moverDia(f, 1))}>
          <span className="material-symbols-outlined !text-[18px]">chevron_right</span>
        </Button>
        <div className="pb-2">
          <FormCheckbox
            id="caja-solo-diferencia"
            label="Solo con diferencia"
            checked={soloDiferencia}
            onChange={(e) => setSoloDiferencia(e.target.checked)}
          />
        </div>
      </div>

      {isLoading && <p className="font-inter text-sm text-on-surface-variant">Cargando…</p>}

      {isError && (
        <div className="flex flex-wrap items-center gap-3">
          <p className="font-inter text-sm text-error">No se pudo cargar el resumen del día.</p>
          <Button type="button" variant="ghost" onClick={() => refetch()}>
            Reintentar
          </Button>
        </div>
      )}

      {data && (
        <>
          <div className="overflow-x-auto rounded-card border border-outline-variant">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-surface-container-high/50">
                  {['Profesor', 'Horario', 'Pagos', 'Sistema', 'Declarado', 'Diferencia', 'Transf.', 'Observación', 'Estado', ''].map(
                    (t) => (
                      <th key={t} className={TH}>
                        {t}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {visibles.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-4 py-10 text-center font-inter text-sm text-on-surface-variant">
                      {soloDiferencia && cierres.length > 0 ? 'Ningún cierre con diferencia.' : 'Sin cierres en el día.'}
                    </td>
                  </tr>
                )}
                {visibles.map((c) => {
                  const conDiferencia = Number(c.diferencia) !== 0
                  return (
                    <Fragment key={c.cierre_id}>
                      <tr
                        className={`border-t border-outline-variant align-top ${conDiferencia ? 'border-l-2 border-l-error' : ''}`}
                      >
                        <td className={TD}>{c.profesor}</td>
                        <td className={`${TD} whitespace-nowrap text-on-surface-variant`}>{horario(c)}</td>
                        <td className={TD}>{c.cantidad_pagos}</td>
                        <td className={`${TD} whitespace-nowrap`}>{pesos(c.efectivo_sistema)}</td>
                        <td className={`${TD} whitespace-nowrap`}>{pesos(c.efectivo_declarado)}</td>
                        <td
                          className={`whitespace-nowrap px-4 py-3 font-oswald text-sm font-bold ${
                            conDiferencia ? 'text-error' : 'text-on-surface-variant'
                          }`}
                        >
                          {pesos(c.diferencia)}
                        </td>
                        <td className={`${TD} whitespace-nowrap text-on-surface-variant`}>{pesos(c.transferencias_sistema)}</td>
                        <td className={`${TD} min-w-[220px] max-w-[320px]`}>
                          {c.observacion ? <ObservacionTexto texto={c.observacion} /> : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1.5">
                            <ChipEstadoCierre estado={c.estado} />
                            {c.modificado && <ChipCaja label="Modificado" tono="alerta" icon="edit_note" />}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-3">
                            {c.estado !== 'reabierto' && (
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() => {
                                  setErrorReabrir(null)
                                  setReabriendo(c)
                                }}
                              >
                                Reabrir
                              </Button>
                            )}
                            <button
                              type="button"
                              aria-label={abierto === c.cierre_id ? 'Ocultar pagos' : 'Ver pagos'}
                              onClick={() => setAbierto((a) => (a === c.cierre_id ? null : c.cierre_id))}
                              className="text-on-surface-variant hover:text-primary"
                            >
                              <span className="material-symbols-outlined !text-[20px]">
                                {abierto === c.cierre_id ? 'expand_less' : 'expand_more'}
                              </span>
                            </button>
                          </div>
                        </td>
                      </tr>
                      {abierto === c.cierre_id && (
                        <tr className="border-t border-outline-variant bg-surface-container-low">
                          <td colSpan={10} className="px-4 py-3">
                            <PagosDelCierre cierreId={c.cierre_id} estado={c.estado} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-outline-variant bg-surface-container p-4 font-inter text-sm">
            <span className="font-oswald text-[13px] font-semibold uppercase tracking-[0.03em] text-on-surface">
              Cobrado por el dueño
            </span>
            <span className="text-on-surface-variant">
              {data.cobros_dueno.cantidad} pago(s) · Efectivo {pesos(data.cobros_dueno.efectivo)} · Transferencias{' '}
              {pesos(data.cobros_dueno.transferencias)}
            </span>
          </div>

          <div className="flex flex-col gap-4 rounded-card border border-outline-variant bg-surface-container p-5">
            <h2 className="font-oswald text-base font-bold uppercase tracking-[0.02em] text-on-surface">Resumen del día</h2>
            <div className="flex flex-wrap gap-8">
              <div className="flex flex-col gap-1">
                <span className="font-oswald text-[11px] uppercase tracking-[0.05em] text-on-surface-variant">Efectivo</span>
                <span className="font-anton text-[26px] text-on-surface">{pesos(data.totales.efectivo)}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="font-oswald text-[11px] uppercase tracking-[0.05em] text-on-surface-variant">Transferencias</span>
                <span className="font-anton text-[26px] text-on-surface">{pesos(data.totales.transferencias)}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="font-oswald text-[11px] uppercase tracking-[0.05em] text-on-surface-variant">Diferencias</span>
                <span className={`font-anton text-[26px] ${diferenciasDia !== 0 ? 'text-error' : 'text-on-surface'}`}>
                  {pesos(diferenciasDia)}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="font-oswald text-[11px] uppercase tracking-[0.05em] text-on-surface-variant">Sin cierre</span>
                <span className="font-anton text-[26px] text-on-surface">{data.sin_cierre.length}</span>
              </div>
            </div>

            {data.por_receptor.length > 0 && (
              <div className="flex flex-col gap-1 border-t border-outline-variant pt-3">
                {data.por_receptor.map((r) => (
                  <div
                    key={r.profesor_id ?? r.recibio_tipo ?? 'sin-receptor'}
                    className="flex flex-wrap items-center justify-between gap-2 py-1 font-inter text-sm"
                  >
                    <span className="text-on-surface">
                      {r.recibio_tipo === 'admin' ? 'Dueño' : (r.profesor ?? 'Sin receptor')}
                    </span>
                    <span className="text-on-surface-variant">
                      {r.cantidad} pago(s) · Efectivo {pesos(r.efectivo)} · Transferencias {pesos(r.transferencias)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {data.sin_cierre.length > 0 && (
              <div className="flex flex-col gap-1 border-t border-outline-variant pt-3">
                <span className="font-oswald text-[11px] uppercase tracking-[0.05em] text-on-surface-variant">
                  Pagos del día sin cierre
                </span>
                {data.sin_cierre.map((p) => (
                  <div key={p.pago_id} className="flex flex-wrap items-center justify-between gap-2 py-1 font-inter text-sm">
                    <span className="text-on-surface">
                      {horaLocal(p.created_at)} — {p.descripcion ?? '—'}
                    </span>
                    <span className="text-on-surface-variant">
                      {p.profesor ?? 'Sin receptor'} · {pesos(p.total)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {data.huerfanos > 0 && (
              <p className="font-inter text-xs text-error">
                {data.huerfanos} pago(s) sin detalle suman en los totales y no entran en ningún cierre. Ver Configuración → Log
                de errores.
              </p>
            )}
          </div>
        </>
      )}

      {reabriendo && (
        <ReabrirCierreDialog
          titulo={`Cierre de ${reabriendo.profesor}`}
          guardando={reabrir.isPending}
          error={errorReabrir}
          onConfirmar={confirmarReabrir}
          onCancelar={() => setReabriendo(null)}
        />
      )}
    </div>
  )
}
