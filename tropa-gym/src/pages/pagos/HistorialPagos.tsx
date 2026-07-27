import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { MetodoPago } from '@/types/db'
import { supabase } from '@/lib/supabase'
import { traducirError } from '@/lib/errores'
import { useAuth } from '@/contexts/AuthContext'
import { fetchHistorialPagos, fetchResumenCargo, type HistorialPagoDetalle, type ResumenCargo } from '@/lib/cuenta'
import { formatFecha } from '@/lib/utils'
import { queryKeys } from '@/lib/queryKeys'
import { STALE_OPERATIVO } from '@/lib/queryClient'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { FormCurrencyInput } from '@/components/ui/FormField'
import { BadgeEstadoCargo } from '@/components/ui/BadgeEstado'
import { MetodoPagoField } from '@/components/ui/MetodoPagoField'

const TIPO_LABEL: Record<string, string> = {
  individual: 'Individual',
  familiar: 'Familiar',
  adelantado: 'Adelantado',
}

const METODO_LABEL: Record<string, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  combinado: 'Combinado',
}

interface EdicionMonto {
  id: string
  montoActual: number
}

interface CompletarPago {
  id: string
  cargoId: string
  periodo: string
}

function invalidarPagos(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: queryKeys.historialPagos })
  queryClient.invalidateQueries({ queryKey: ['cuenta'] })
  queryClient.invalidateQueries({ queryKey: ['cargos'] })
  queryClient.invalidateQueries({ queryKey: ['dashboard'] })
}

export function HistorialPagos() {
  const { perfil } = useAuth()
  const puedeEditar = perfil?.rol === 'admin' || perfil?.rol === 'profesor'
  const queryClient = useQueryClient()

  const { data: historial = [], isLoading: loading } = useQuery({
    queryKey: queryKeys.historialPagos,
    queryFn: () => fetchHistorialPagos(),
    staleTime: STALE_OPERATIVO,
  })

  const [edicion, setEdicion] = useState<EdicionMonto | null>(null)
  const [nuevoMonto, setNuevoMonto] = useState(0)
  const [confirmandoEdicion, setConfirmandoEdicion] = useState(false)
  const [errorEdicion, setErrorEdicion] = useState<string | null>(null)

  const [completar, setCompletar] = useState<CompletarPago | null>(null)
  const [montoCompletar, setMontoCompletar] = useState(0)
  const [metodoCompletar, setMetodoCompletar] = useState<MetodoPago>('efectivo')
  const [importeEfectivoCompletar, setImporteEfectivoCompletar] = useState(0)
  const [importeTransferenciaCompletar, setImporteTransferenciaCompletar] = useState(0)
  const [errorCompletar, setErrorCompletar] = useState<string | null>(null)

  const { data: resumenCargo = null, isFetching: cargandoSaldo } = useQuery({
    queryKey: queryKeys.resumenCargo(completar?.cargoId ?? ''),
    queryFn: () => fetchResumenCargo(completar!.cargoId),
    enabled: !!completar,
    staleTime: STALE_OPERATIVO,
  })

  const editarMonto = useMutation({
    mutationFn: async ({ id, monto }: { id: string; monto: number }) => {
      const { error } = await supabase.from('pagos_alumnos').update({ monto_pagado: monto }).eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => invalidarPagos(queryClient),
  })
  const guardandoEdicion = editarMonto.isPending

  const completarPago = useMutation({
    mutationFn: async (d: HistorialPagoDetalle) => {
      const { data: pago, error: pagoError } = await supabase
        .from('pagos')
        .insert({
          tipo_pago: 'individual',
          metodo_pago: metodoCompletar,
          importe_efectivo: importeEfectivoCompletar,
          importe_transferencia: importeTransferenciaCompletar,
          total: montoCompletar,
        })
        .select()
        .single()

      if (pagoError || !pago) throw new Error(pagoError?.message ?? 'No se pudo registrar el pago.')

      const { error: detalleError } = await supabase.from('pagos_alumnos').insert({
        pago_id: pago.id,
        alumno_id: d.alumnoId,
        cargo_id: completar!.cargoId,
        periodo: completar!.periodo,
        disciplina_id: d.disciplinaId,
        combo_id: d.comboId,
        descuento_id: d.descuentoId,
        precio_snapshot: d.precioSnapshot,
        monto_pagado: montoCompletar,
      })

      if (detalleError) {
        await supabase.from('pagos').delete().eq('id', pago.id)
        throw new Error(detalleError.message)
      }
    },
    onSuccess: () => invalidarPagos(queryClient),
  })
  const guardandoCompletar = completarPago.isPending

  useEffect(() => {
    if (metodoCompletar === 'efectivo') {
      setImporteEfectivoCompletar(montoCompletar)
      setImporteTransferenciaCompletar(0)
    } else if (metodoCompletar === 'transferencia') {
      setImporteEfectivoCompletar(0)
      setImporteTransferenciaCompletar(montoCompletar)
    }
  }, [metodoCompletar, montoCompletar])

  function iniciarEdicion(d: HistorialPagoDetalle) {
    setEdicion({ id: d.id, montoActual: d.montoPagado })
    setNuevoMonto(d.montoPagado)
    setErrorEdicion(null)
    setCompletar(null)
  }

  function cancelarEdicion() {
    setEdicion(null)
    setErrorEdicion(null)
  }

  async function confirmarEdicion() {
    if (!edicion) return
    try {
      await editarMonto.mutateAsync({ id: edicion.id, monto: nuevoMonto })
    } catch (err) {
      setConfirmandoEdicion(false)
      setErrorEdicion(traducirError(err instanceof Error ? err.message : null))
      return
    }
    setConfirmandoEdicion(false)
    setEdicion(null)
  }

  function iniciarCompletar(d: HistorialPagoDetalle) {
    if (!d.cargoId) return
    setEdicion(null)
    setErrorCompletar(null)
    setCompletar({ id: d.id, cargoId: d.cargoId, periodo: d.periodo })
    setMetodoCompletar('efectivo')
    setMontoCompletar(0)
  }

  function cancelarCompletar() {
    setCompletar(null)
    setErrorCompletar(null)
  }

  // Cálculo en vivo de cómo queda el cargo si se confirma este monto —
  // no reemplaza al trigger (que es la fuente de verdad), solo anticipa
  // el resultado en la UI antes de guardar.
  function proyeccion(resumen: ResumenCargo, montoNuevo: number): { estado: 'pendiente' | 'parcial' | 'pagado'; restante: number } {
    const totalProyectado = resumen.pagado + montoNuevo
    if (totalProyectado <= 0) return { estado: 'pendiente', restante: resumen.monto }
    if (totalProyectado < resumen.monto) return { estado: 'parcial', restante: resumen.monto - totalProyectado }
    return { estado: 'pagado', restante: resumen.monto - totalProyectado }
  }

  async function confirmarCompletar(d: HistorialPagoDetalle) {
    if (!completar || montoCompletar <= 0) return
    if (
      metodoCompletar === 'combinado' &&
      Math.round((importeEfectivoCompletar + importeTransferenciaCompletar) * 100) !== Math.round(montoCompletar * 100)
    ) {
      setErrorCompletar('La suma de efectivo y transferencia debe ser igual al monto pagado.')
      return
    }

    setErrorCompletar(null)

    try {
      await completarPago.mutateAsync(d)
    } catch (err) {
      setErrorCompletar(traducirError(err instanceof Error ? err.message : null, 'No se pudo registrar el pago.'))
      return
    }

    setCompletar(null)
  }

  return (
    <div className="mt-8">
      <h2 className="mb-3 font-oswald text-base font-bold uppercase tracking-[0.02em] text-on-surface">
        Historial de pagos
      </h2>

      {loading && <p className="py-6 text-center font-inter text-sm text-on-surface-variant">Cargando…</p>}

      {!loading && historial.length === 0 && (
        <p className="py-6 text-center font-inter text-sm text-on-surface-variant">
          Todavía no hay pagos registrados.
        </p>
      )}

      {!loading && historial.length > 0 && (
        <div className="flex flex-col gap-2">
          {historial.map((d) => (
            <div
              key={d.id}
              className="flex flex-col gap-3 rounded-card border border-outline-variant bg-surface-container px-4 py-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-col">
                  <span className="font-inter text-sm text-on-surface">
                    {d.alumnoNombre} — {d.periodo}
                  </span>
                  <span className="font-inter text-xs text-on-surface-variant">
                    {formatFecha(d.fecha.slice(0, 10))} — {TIPO_LABEL[d.tipoPago] ?? d.tipoPago} —{' '}
                    {METODO_LABEL[d.metodoPago] ?? d.metodoPago}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-oswald text-base font-bold text-on-surface">
                    ${d.montoPagado.toLocaleString('es-AR')}
                  </span>
                  <BadgeEstadoCargo estado={d.estado} />
                  {puedeEditar && edicion?.id !== d.id && (
                    <button
                      type="button"
                      onClick={() => iniciarEdicion(d)}
                      aria-label="Editar monto pagado"
                      className="text-on-surface-variant hover:text-primary"
                    >
                      <span className="material-symbols-outlined !text-[16px]">edit</span>
                    </button>
                  )}
                </div>
              </div>

              {d.estado === 'parcial' && d.cargoId && completar?.id !== d.id && (
                <div className="flex justify-end">
                  <Button type="button" variant="primario" onClick={() => iniciarCompletar(d)}>
                    Completar pago
                  </Button>
                </div>
              )}

              {edicion?.id === d.id && (
                <div className="flex flex-wrap items-end gap-3 rounded-lg border border-outline-variant bg-surface-container-low p-3">
                  <FormCurrencyInput
                    id={`edicion-monto-pagado-${d.id}`}
                    label="Nuevo monto pagado"
                    min={0}
                    step="0.01"
                    value={nuevoMonto}
                    onChange={(e) => setNuevoMonto(Number(e.target.value))}
                  />
                  <div className="flex gap-2">
                    <Button type="button" variant="ghost" onClick={cancelarEdicion} disabled={guardandoEdicion}>
                      Cancelar
                    </Button>
                    <Button
                      type="button"
                      variant="solido"
                      disabled={guardandoEdicion || nuevoMonto <= 0}
                      onClick={() => setConfirmandoEdicion(true)}
                    >
                      Guardar
                    </Button>
                  </div>
                  {errorEdicion && <p className="w-full font-inter text-sm text-error">{errorEdicion}</p>}
                </div>
              )}

              {completar?.id === d.id && (
                <div className="flex flex-col gap-3 rounded-lg border border-outline-variant bg-surface-container-low p-3">
                  {cargandoSaldo || !resumenCargo ? (
                    <p className="font-inter text-sm text-on-surface-variant">Calculando saldo pendiente…</p>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-outline-variant/50 pb-3 font-inter text-sm">
                        <span className="text-on-surface-variant">
                          Ya pagado: ${resumenCargo.pagado.toLocaleString('es-AR')} de ${resumenCargo.monto.toLocaleString('es-AR')}
                        </span>
                        <span className="font-medium text-on-surface">
                          Saldo pendiente: ${resumenCargo.saldo.toLocaleString('es-AR')}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-start gap-6">
                        <FormCurrencyInput
                          id={`completar-monto-${d.id}`}
                          label="Cuánto se paga ahora"
                          min={0}
                          step="0.01"
                          value={montoCompletar}
                          onChange={(e) => setMontoCompletar(Number(e.target.value))}
                        />
                        <MetodoPagoField
                          idPrefix={`completar-${d.id}`}
                          metodo={metodoCompletar}
                          onMetodoChange={setMetodoCompletar}
                          total={montoCompletar}
                          importeEfectivo={importeEfectivoCompletar}
                          importeTransferencia={importeTransferenciaCompletar}
                          onImporteEfectivoChange={setImporteEfectivoCompletar}
                          onImporteTransferenciaChange={setImporteTransferenciaCompletar}
                        />
                      </div>

                      {montoCompletar > 0 && (() => {
                        const p = proyeccion(resumenCargo, montoCompletar)
                        if (p.estado === 'pagado') {
                          return (
                            <p className="font-inter text-xs text-primary">
                              {p.restante < 0
                                ? `Queda pagado — sobrepago de $${Math.abs(p.restante).toLocaleString('es-AR')} (saldo a favor).`
                                : 'Queda pagado — completa el cargo.'}
                            </p>
                          )
                        }
                        return (
                          <p className="font-inter text-xs text-on-surface-variant">
                            Sigue parcial — quedarán ${p.restante.toLocaleString('es-AR')} pendientes.
                          </p>
                        )
                      })()}

                      {errorCompletar && <p className="font-inter text-sm text-error">{errorCompletar}</p>}
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="ghost" onClick={cancelarCompletar} disabled={guardandoCompletar}>
                          Cancelar
                        </Button>
                        <Button
                          type="button"
                          variant="solido"
                          disabled={guardandoCompletar || montoCompletar <= 0}
                          onClick={() => confirmarCompletar(d)}
                        >
                          {guardandoCompletar ? 'Registrando…' : 'Registrar pago'}
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={confirmandoEdicion}
        title="Editar monto pagado"
        message={
          edicion
            ? `Vas a cambiar el monto de esta transacción de $${edicion.montoActual.toLocaleString('es-AR')} a $${nuevoMonto.toLocaleString('es-AR')}. Esto es una corrección retroactiva y recalcula el estado del cargo. ¿Confirmás?`
            : ''
        }
        confirmLabel="Confirmar cambio"
        loading={guardandoEdicion}
        onConfirm={confirmarEdicion}
        onCancel={() => setConfirmandoEdicion(false)}
      />
    </div>
  )
}
