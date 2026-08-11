import { Fragment, useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { MetodoPago } from '@/types/db'
import { supabase } from '@/lib/supabase'
import { traducirError } from '@/lib/errores'
import { useAuth } from '@/contexts/AuthContext'
import { fetchHistorialPagos, fetchResumenPeriodo, type HistorialPagoDetalle, type ResumenCargo } from '@/lib/cuenta'
import { formatFecha } from '@/lib/utils'
import { queryKeys } from '@/lib/queryKeys'
import { STALE_OPERATIVO } from '@/lib/queryClient'
import { Button } from '@/components/ui/button'
import { Drawer } from '@/components/ui/Drawer'
import { FormCurrencyInput, FormInput, FormMonthInput } from '@/components/ui/FormField'
import { BadgeEstadoCargo } from '@/components/ui/BadgeEstado'
import { MetodoPagoField } from '@/components/ui/MetodoPagoField'
import { IndividualPanel } from './IndividualPanel'

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

interface CompletarPago {
  id: string
  cargoId: string | null
  alumnoId: string
  periodo: string
}

function invalidarPagos(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: queryKeys.historialPagos })
  queryClient.invalidateQueries({ queryKey: ['cuenta'] })
  queryClient.invalidateQueries({ queryKey: ['cargos'] })
  queryClient.invalidateQueries({ queryKey: ['dashboard'] })
}

const PAGE_SIZE = 15

export function HistorialPagos() {
  const { perfil } = useAuth()
  const puedeEditar = perfil?.rol === 'admin' || perfil?.rol === 'profesor'
  const queryClient = useQueryClient()

  const [nombreFiltro, setNombreFiltro] = useState('')
  const [periodoFiltro, setPeriodoFiltro] = useState('')
  const [page, setPage] = useState(0)
  const nombreTerm = nombreFiltro.trim()

  const { data, isLoading: loading } = useQuery({
    queryKey: queryKeys.historialPagosPagina(nombreTerm, periodoFiltro, page),
    queryFn: () => fetchHistorialPagos({ nombre: nombreTerm, periodo: periodoFiltro, page, pageSize: PAGE_SIZE }),
    staleTime: STALE_OPERATIVO,
  })
  const historial = data?.filas ?? []
  const total = data?.total ?? 0
  const totalPaginas = Math.max(1, Math.ceil(total / PAGE_SIZE))

  function cambiarNombreFiltro(v: string) {
    setNombreFiltro(v)
    setPage(0)
  }

  function cambiarPeriodoFiltro(v: string) {
    setPeriodoFiltro(v)
    setPage(0)
  }

  // El lápiz abre el form completo de registro precargado (mismo form que
  // "Registrar pago", en modo edición) — no un editor angosto de un solo
  // campo. Así corrige de una cualquier error de carga (combo, período,
  // monto, método) y aplica la misma lógica Completo/Parcial.
  const [editando, setEditando] = useState<HistorialPagoDetalle | null>(null)

  const [completar, setCompletar] = useState<CompletarPago | null>(null)
  const [montoCompletar, setMontoCompletar] = useState(0)
  const [metodoCompletar, setMetodoCompletar] = useState<MetodoPago>('efectivo')
  const [importeEfectivoCompletar, setImporteEfectivoCompletar] = useState(0)
  const [importeTransferenciaCompletar, setImporteTransferenciaCompletar] = useState(0)
  const [errorCompletar, setErrorCompletar] = useState<string | null>(null)

  const { data: resumenCargo = null, isFetching: cargandoSaldo } = useQuery({
    queryKey: queryKeys.resumenPeriodoAlumno(completar?.alumnoId ?? '', completar?.periodo ?? ''),
    queryFn: () => fetchResumenPeriodo(completar!.alumnoId, completar!.periodo, completar!.cargoId),
    enabled: !!completar,
    staleTime: STALE_OPERATIVO,
  })

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
        precio_snapshot: resumenCargo?.monto ?? d.precioSnapshot,
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

  function iniciarCompletar(d: HistorialPagoDetalle) {
    setEditando(null)
    setErrorCompletar(null)
    setCompletar({ id: d.id, cargoId: d.cargoId, alumnoId: d.alumnoId, periodo: d.periodo })
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

      <div className="mb-4 flex flex-wrap items-end gap-4">
        <div className="w-full sm:w-72">
          <FormInput
            id="historial-buscar-nombre"
            label="Buscar alumno"
            placeholder="Nombre o apellido…"
            value={nombreFiltro}
            onChange={(e) => cambiarNombreFiltro(e.target.value)}
          />
        </div>
        <div className="flex items-end gap-2">
          <FormMonthInput id="historial-filtro-periodo" label="Período" value={periodoFiltro} onChange={cambiarPeriodoFiltro} />
          {periodoFiltro && (
            <button
              type="button"
              onClick={() => cambiarPeriodoFiltro('')}
              className="mb-2 font-inter text-xs text-on-surface-variant hover:text-primary"
            >
              Ver todos
            </button>
          )}
        </div>
      </div>

      {loading && <p className="py-6 text-center font-inter text-sm text-on-surface-variant">Cargando…</p>}

      {!loading && historial.length === 0 && (
        <p className="py-6 text-center font-inter text-sm text-on-surface-variant">
          {nombreTerm || periodoFiltro ? 'No hay pagos que coincidan con el filtro.' : 'Todavía no hay pagos registrados.'}
        </p>
      )}

      {!loading && historial.length > 0 && (
        <div className="overflow-x-auto rounded-card border border-outline-variant">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-surface-container-high/50">
                <th className="px-4 py-3 font-oswald text-[11px] font-medium uppercase tracking-[0.05em] text-on-surface-variant">
                  Fecha
                </th>
                <th className="px-4 py-3 font-oswald text-[11px] font-medium uppercase tracking-[0.05em] text-on-surface-variant">
                  Alumno
                </th>
                <th className="px-4 py-3 font-oswald text-[11px] font-medium uppercase tracking-[0.05em] text-on-surface-variant">
                  Tipo de pago
                </th>
                <th className="px-4 py-3 font-oswald text-[11px] font-medium uppercase tracking-[0.05em] text-on-surface-variant">
                  Método de pago
                </th>
                <th className="px-4 py-3 font-oswald text-[11px] font-medium uppercase tracking-[0.05em] text-on-surface-variant">
                  Monto
                </th>
                <th className="px-4 py-3 font-oswald text-[11px] font-medium uppercase tracking-[0.05em] text-on-surface-variant">
                  Estado
                </th>
                <th className="px-4 py-3 text-right font-oswald text-[11px] font-medium uppercase tracking-[0.05em] text-on-surface-variant">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {historial.map((d) => (
                <Fragment key={d.id}>
                  <tr className="border-t border-outline-variant align-top">
                    <td className="whitespace-nowrap px-4 py-3 font-inter text-sm text-on-surface-variant">
                      {formatFecha(d.fecha.slice(0, 10))}
                    </td>
                    <td className="px-4 py-3 font-inter text-sm text-on-surface">
                      {d.alumnoNombre}
                      <span className="text-on-surface-variant"> — {d.periodo}</span>
                    </td>
                    <td className="px-4 py-3 font-inter text-sm text-on-surface">
                      {TIPO_LABEL[d.tipoPago] ?? d.tipoPago}
                    </td>
                    <td className="px-4 py-3 font-inter text-sm text-on-surface">
                      {METODO_LABEL[d.metodoPago] ?? d.metodoPago}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-oswald text-sm font-bold text-on-surface">
                      ${d.montoPagado.toLocaleString('es-AR')}
                    </td>
                    <td className="px-4 py-3">
                      <BadgeEstadoCargo estado={d.estado} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-3">
                        {d.estado === 'parcial' && completar?.id !== d.id && (
                          <Button type="button" variant="primario" onClick={() => iniciarCompletar(d)}>
                            Completar pago
                          </Button>
                        )}
                        {puedeEditar && d.alumno && (
                          <button
                            type="button"
                            onClick={() => setEditando(d)}
                            aria-label="Editar pago"
                            className="text-on-surface-variant hover:text-primary"
                          >
                            <span className="material-symbols-outlined !text-[18px]">edit</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>

                  {completar?.id === d.id && (
                    <tr className="border-t border-outline-variant bg-surface-container-low">
                      <td colSpan={7} className="px-4 py-3">
                        <div className="flex flex-col gap-3">
                          {cargandoSaldo || !resumenCargo ? (
                            <p className="font-inter text-sm text-on-surface-variant">Calculando saldo pendiente…</p>
                          ) : (
                            <>
                              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-outline-variant/50 pb-3 font-inter text-sm">
                                <span className="text-on-surface-variant">
                                  Ya pagado: ${resumenCargo.pagado.toLocaleString('es-AR')} de $
                                  {resumenCargo.monto.toLocaleString('es-AR')}
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

                              {montoCompletar > 0 &&
                                (() => {
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
                                <Button
                                  type="button"
                                  variant="ghost"
                                  onClick={cancelarCompletar}
                                  disabled={guardandoCompletar}
                                >
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
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && historial.length > 0 && (
        <div className="mt-3 flex items-center justify-end gap-3">
          <span className="font-inter text-xs text-on-surface-variant">
            Página {page + 1} de {totalPaginas}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            aria-label="Página anterior"
            className="text-on-surface-variant hover:text-primary disabled:opacity-30 disabled:hover:text-on-surface-variant"
          >
            <span className="material-symbols-outlined !text-[20px]">chevron_left</span>
          </button>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPaginas - 1, p + 1))}
            disabled={page + 1 >= totalPaginas}
            aria-label="Página siguiente"
            className="text-on-surface-variant hover:text-primary disabled:opacity-30 disabled:hover:text-on-surface-variant"
          >
            <span className="material-symbols-outlined !text-[20px]">chevron_right</span>
          </button>
        </div>
      )}

      <Drawer open={!!editando} title="Editar pago" onClose={() => setEditando(null)} size="lg">
        {editando && editando.alumno && (
          <IndividualPanel
            editar={{
              pagoAlumnoId: editando.id,
              pagoId: editando.pagoId,
              alumno: editando.alumno,
              periodo: editando.periodo,
              disciplinaId: editando.disciplinaId,
              comboId: editando.comboId,
              descuentoId: editando.descuentoId,
              precioSnapshot: editando.precioSnapshot,
              montoPagado: editando.montoPagado,
              metodoPago: editando.metodoPago,
            }}
            onSuccess={() => setEditando(null)}
            onCancel={() => setEditando(null)}
          />
        )}
      </Drawer>
    </div>
  )
}
