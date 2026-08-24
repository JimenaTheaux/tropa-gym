import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Alumno, MetodoPago, TipoCargo } from '@/types/db'
import { supabase } from '@/lib/supabase'
import { traducirError } from '@/lib/errores'
import { buscarCargo, fetchResumenPeriodo } from '@/lib/cuenta'
import { aplicarDescuento, aplicarTipoCuota, distribuirMonto, precioVigente } from '@/lib/precios'
import { descuentosParaTipo } from '@/lib/catalogos'
import { useCombosActivos, useDescuentos, useDisciplinasActivas, usePrecios } from '@/hooks/useCatalogos'
import { queryKeys } from '@/lib/queryKeys'
import { hoyIso } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { FormCurrencyInput, FormDateInput, FormMonthInput, FormSelect } from '@/components/ui/FormField'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { AlumnoBuscador } from '@/components/ui/AlumnoBuscador'
import { MetodoPagoField } from '@/components/ui/MetodoPagoField'

const TIPOS_CUOTA: { value: TipoCargo; label: string }[] = [
  { value: 'completa', label: 'Cuota completa' },
  { value: 'media', label: 'Media cuota' },
]

type TipoPagoParcialidad = 'completo' | 'parcial'

const TIPOS_PAGO_PARCIALIDAD: { value: TipoPagoParcialidad; label: string }[] = [
  { value: 'completo', label: 'Completo (precio especial)' },
  { value: 'parcial', label: 'Parcial' },
]

function periodoActual(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

interface DetalleFamiliar {
  key: string
  alumno: Alumno
  periodo: string
  disciplinaId: string
  comboId: string
  tipoCuota: TipoCargo
  precioCalculado: number
}

interface FamiliarPanelProps {
  onSuccess?: () => void
  onCancel?: () => void
}

export function FamiliarPanel({ onSuccess, onCancel }: FamiliarPanelProps) {
  const queryClient = useQueryClient()
  const { data: precios = [] } = usePrecios()
  const { data: disciplinas = [] } = useDisciplinasActivas()
  const { data: combos = [] } = useCombosActivos()
  const { data: descuentosTodos = [] } = useDescuentos()
  const descuentos = useMemo(() => descuentosParaTipo(descuentosTodos, 'familiar'), [descuentosTodos])

  const [detalles, setDetalles] = useState<DetalleFamiliar[]>([])
  const [descuentoId, setDescuentoId] = useState('')
  const [montoPagado, setMontoPagado] = useState(0)
  const [tipoPagoParcialidad, setTipoPagoParcialidad] = useState<TipoPagoParcialidad | ''>('')
  const [metodo, setMetodo] = useState<MetodoPago>('efectivo')
  const [fechaPago, setFechaPago] = useState(hoyIso())
  const [importeEfectivo, setImporteEfectivo] = useState(0)
  const [importeTransferencia, setImporteTransferencia] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const registrarPagoFamiliar = useMutation({
    mutationFn: async (payload: {
      p_detalles: Record<string, unknown>[]
      p_metodo: MetodoPago
      p_importe_efectivo: number
      p_importe_transferencia: number
      p_fecha: string
    }) => {
      const { error } = await supabase.rpc('registrar_pago_familiar', payload)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.historialPagos })
      queryClient.invalidateQueries({ queryKey: ['cuenta'] })
      queryClient.invalidateQueries({ queryKey: ['cargos'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
  const saving = registrarPagoFamiliar.isPending

  const subtotal = detalles.reduce((sum, d) => sum + d.precioCalculado, 0)

  // Ambiguo = el total pagado quedó por debajo del subtotal: puede ser un
  // pago parcial (queda deuda repartida proporcionalmente) o un precio
  // especial que el dueño cobró completo (no debe quedar deuda).
  const esAmbiguo = montoPagado > 0 && subtotal > 0 && montoPagado < subtotal
  const ajustarPrecio = esAmbiguo && tipoPagoParcialidad === 'completo'

  // Aviso por alumno si ya tiene un pago cargado en ese mismo período —
  // mismo motivo que en IndividualPanel: si en realidad es la segunda cuota
  // de un pago parcial ya existente, hay que usar "Completar pago" en
  // Historial en vez de marcar "Completo" acá (pisaría el precio de
  // referencia con lo repartido a este alumno nomás).
  const [pagosExistentes, setPagosExistentes] = useState<Record<string, { pagado: number; monto: number } | null>>({})
  const clavesDetalles = detalles.map((d) => `${d.alumno.id}|${d.periodo}`).join(',')
  useEffect(() => {
    let cancelado = false
    ;(async () => {
      const resultados = await Promise.all(
        detalles.map(async (d) => {
          if (!d.periodo) return [d.key, null] as const
          const cargo = await buscarCargo(d.alumno.id, d.periodo)
          const resumen = await fetchResumenPeriodo(d.alumno.id, d.periodo, cargo?.id ?? null)
          return [d.key, resumen.pagado > 0 ? { pagado: resumen.pagado, monto: resumen.monto } : null] as const
        }),
      )
      if (!cancelado) setPagosExistentes(Object.fromEntries(resultados))
    })()
    return () => {
      cancelado = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clavesDetalles])

  function precioConDescuento(periodo: string, comboId: string, tipoCuota: TipoCargo): number {
    const base = precioVigente(precios, comboId || null, periodo)
    const descuento = descuentos.find((d) => d.id === descuentoId)
    return base === null ? 0 : aplicarDescuento(aplicarTipoCuota(base, tipoCuota), descuento)
  }

  // El descuento es único para todo el comprobante: al cambiarlo, se
  // recalcula el precio de todas las filas ya agregadas.
  useEffect(() => {
    setDetalles((prev) =>
      prev.map((d) => {
        if (!d.comboId || !d.periodo) return d
        const precio = precioConDescuento(d.periodo, d.comboId, d.tipoCuota)
        return { ...d, precioCalculado: precio }
      }),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [descuentoId, precios, descuentos])

  // El monto pagado (único, sobre el total) se pre-carga con el subtotal
  // pero queda editable — permite pago parcial o sobrepago del comprobante.
  // Se resetea acá, no se deriva del subtotal en cada render.
  useEffect(() => {
    setMontoPagado(subtotal)
    setTipoPagoParcialidad('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtotal])

  useEffect(() => {
    if (metodo === 'efectivo') {
      setImporteEfectivo(montoPagado)
      setImporteTransferencia(0)
    } else if (metodo === 'transferencia') {
      setImporteEfectivo(0)
      setImporteTransferencia(montoPagado)
    }
  }, [metodo, montoPagado])

  function agregarAlumno(alumno: Alumno) {
    if (detalles.some((d) => d.alumno.id === alumno.id)) return
    setDetalles((prev) => [
      ...prev,
      {
        key: alumno.id,
        alumno,
        periodo: periodoActual(),
        disciplinaId: '',
        comboId: '',
        tipoCuota: 'completa',
        precioCalculado: 0,
      },
    ])
  }

  function actualizarDetalle(key: string, patch: Partial<DetalleFamiliar>) {
    setDetalles((prev) =>
      prev.map((d) => {
        if (d.key !== key) return d
        const actualizado = { ...d, ...patch }
        const precio = precioConDescuento(actualizado.periodo, actualizado.comboId, actualizado.tipoCuota)
        return { ...actualizado, precioCalculado: precio }
      }),
    )
  }

  function quitarAlumno(key: string) {
    setDetalles((prev) => prev.filter((d) => d.key !== key))
  }

  function resetForm() {
    setDetalles([])
    setDescuentoId('')
    setMontoPagado(0)
    setTipoPagoParcialidad('')
    setMetodo('efectivo')
    setFechaPago(hoyIso())
    setImporteEfectivo(0)
    setImporteTransferencia(0)
  }

  async function handleSubmit() {
    if (detalles.length === 0 || montoPagado <= 0 || !fechaPago) return
    if (detalles.some((d) => !d.disciplinaId || !d.comboId || !d.periodo)) {
      setError('Completá disciplina y combo para cada alumno.')
      return
    }
    if (esAmbiguo && tipoPagoParcialidad === '') {
      setError('Indicá si fue un pago parcial o el monto completo (precio especial).')
      return
    }
    if (
      metodo === 'combinado' &&
      Math.round((importeEfectivo + importeTransferencia) * 100) !== Math.round(montoPagado * 100)
    ) {
      setError('La suma de efectivo y transferencia debe ser igual al monto pagado.')
      return
    }

    setError(null)

    const montosPorAlumno = distribuirMonto(
      detalles.map((d) => d.precioCalculado),
      montoPagado,
    )

    const p_detalles = await Promise.all(
      detalles.map(async (d, i) => {
        const cargo = await buscarCargo(d.alumno.id, d.periodo)
        const montoAlumno = montosPorAlumno[i]
        const ajustarPrecioAlumno = ajustarPrecio && montoAlumno < d.precioCalculado
        return {
          alumno_id: d.alumno.id,
          cargo_id: cargo?.id ?? null,
          periodo: d.periodo,
          disciplina_id: d.disciplinaId,
          combo_id: d.comboId,
          descuento_id: descuentoId || null,
          precio_snapshot: ajustarPrecioAlumno ? montoAlumno : d.precioCalculado,
          monto_pagado: montoAlumno,
          ajustar_precio: ajustarPrecioAlumno,
        }
      }),
    )

    const cantidadDetalles = detalles.length

    try {
      await registrarPagoFamiliar.mutateAsync({
        p_detalles,
        p_metodo: metodo,
        p_importe_efectivo: importeEfectivo,
        p_importe_transferencia: importeTransferencia,
        p_fecha: fechaPago,
      })
    } catch (err) {
      setError(traducirError(err instanceof Error ? err.message : null))
      return
    }

    setSuccess(
      `Pago familiar de $${montoPagado.toLocaleString('es-AR')} registrado para ${cantidadDetalles} alumno(s).`,
    )
    resetForm()
    onSuccess?.()
  }

  return (
    <div className="flex flex-col gap-4">
      {success && (
        <p className="rounded-lg border border-primary bg-surface-container-high px-4 py-3 font-inter text-sm text-primary">
          {success}
        </p>
      )}

      {detalles.map((d) => (
        <div
          key={d.key}
          className="flex flex-col gap-4 rounded-card border border-outline-variant bg-surface-container p-5"
        >
          <div className="flex items-center justify-between">
            <p className="font-oswald text-base font-bold uppercase text-on-surface">
              {d.alumno.nombre} {d.alumno.apellido}
            </p>
            <button
              type="button"
              onClick={() => quitarAlumno(d.key)}
              aria-label="Quitar alumno"
              className="text-on-surface-variant hover:text-error"
            >
              <span className="material-symbols-outlined !text-[18px]">close</span>
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormSelect
              id={`familiar-disciplina-${d.key}`}
              label="Disciplina"
              placeholder="Seleccionar disciplina"
              required
              value={d.disciplinaId}
              onChange={(e) => actualizarDetalle(d.key, { disciplinaId: e.target.value })}
              options={disciplinas.map((disc) => ({ value: disc.id, label: disc.nombre }))}
            />
            <FormSelect
              id={`familiar-combo-${d.key}`}
              label="Combo"
              placeholder="Seleccionar combo"
              required
              value={d.comboId}
              onChange={(e) => actualizarDetalle(d.key, { comboId: e.target.value })}
              options={combos.map((c) => ({ value: c.id, label: c.nombre }))}
            />
            <FormMonthInput
              id={`familiar-periodo-${d.key}`}
              label="Período"
              required
              value={d.periodo}
              onChange={(periodo) => actualizarDetalle(d.key, { periodo })}
            />
          </div>

          <SegmentedControl
            id={`familiar-tipo-cuota-${d.key}`}
            label="Tipo de cuota"
            value={d.tipoCuota}
            onChange={(tipoCuota) => actualizarDetalle(d.key, { tipoCuota })}
            options={TIPOS_CUOTA}
          />

          <div className="flex flex-col gap-1.5 border-t border-outline-variant pt-4">
            <span className="font-oswald text-[11px] uppercase tracking-[0.05em] text-on-surface-variant">
              Precio calculado (con descuento)
            </span>
            <span className="font-inter text-sm text-on-surface">${d.precioCalculado.toLocaleString('es-AR')}</span>
          </div>

          {pagosExistentes[d.key] && (
            <p className="rounded-lg border border-error/50 bg-error/10 px-3 py-2 font-inter text-xs text-error">
              {pagosExistentes[d.key]!.pagado < pagosExistentes[d.key]!.monto
                ? `Ya hay $${pagosExistentes[d.key]!.pagado.toLocaleString('es-AR')} pagado de $${pagosExistentes[d.key]!.monto.toLocaleString('es-AR')} para este alumno en el período ${d.periodo}. Si es para completar ese pago, usá "Completar pago" en el Historial de Pagos — si acá elegís "Completo", el precio de referencia se fija con lo que le toque a este alumno en este comprobante nomás, no con la suma de ambos pagos.`
                : `Este alumno ya tiene $${pagosExistentes[d.key]!.pagado.toLocaleString('es-AR')} pagados para el período ${d.periodo}. Si es un pago aparte, seguí; si fue un error, revisá el Historial de Pagos.`}
            </p>
          )}
        </div>
      ))}

      <AlumnoBuscador
        onSelect={agregarAlumno}
        placeholder={detalles.length === 0 ? 'Agregar alumno al comprobante…' : 'Agregar otro alumno…'}
      />

      {detalles.length > 0 && (
        <div className="flex flex-col gap-4 rounded-card border border-outline-variant bg-surface-container p-5">
          <FormSelect
            id="familiar-descuento"
            label="Descuento / Recargo (opcional) — aplica a todo el comprobante"
            placeholder="Sin ajuste"
            value={descuentoId}
            onChange={(e) => setDescuentoId(e.target.value)}
            options={descuentos.map((d) => ({
              value: d.id,
              label: `${d.tipo === 'recargo' ? '+' : '-'}${d.porcentaje}% ${d.nombre}`,
            }))}
          />

          <div className="flex flex-wrap items-start gap-6 border-y border-outline-variant py-4">
            <div className="flex flex-col gap-1.5">
              <span className="font-oswald text-[11px] uppercase tracking-[0.05em] text-on-surface-variant">
                Subtotal
              </span>
              <span className="font-anton text-2xl text-on-surface">${subtotal.toLocaleString('es-AR')}</span>
            </div>
            <FormCurrencyInput
              id="familiar-monto-pagado"
              label="Monto pagado"
              min={0}
              step="0.01"
              required
              value={montoPagado}
              onChange={(e) => setMontoPagado(Number(e.target.value))}
            />
            <MetodoPagoField
              idPrefix="familiar"
              metodo={metodo}
              onMetodoChange={setMetodo}
              total={montoPagado}
              importeEfectivo={importeEfectivo}
              importeTransferencia={importeTransferencia}
              onImporteEfectivoChange={setImporteEfectivo}
              onImporteTransferenciaChange={setImporteTransferencia}
            />
          </div>

          <FormDateInput
            id="familiar-fecha-pago"
            label="Fecha de pago"
            required
            value={fechaPago}
            onChange={setFechaPago}
          />

          {esAmbiguo && (
            <div className="flex flex-col gap-2 rounded-lg border border-outline-variant bg-surface-container-low p-3">
              <SegmentedControl
                id="familiar-tipo-pago-parcialidad"
                label="¿Fue un pago parcial o el monto completo?"
                value={tipoPagoParcialidad}
                onChange={setTipoPagoParcialidad}
                options={TIPOS_PAGO_PARCIALIDAD}
              />
              <p className="font-inter text-xs text-on-surface-variant">
                {tipoPagoParcialidad === 'completo'
                  ? 'Se va a fijar el precio de cada cuota en lo repartido proporcionalmente — no queda saldo pendiente.'
                  : tipoPagoParcialidad === 'parcial'
                    ? `Queda un saldo pendiente de $${(subtotal - montoPagado).toLocaleString('es-AR')}, repartido proporcionalmente entre los alumnos.`
                    : 'El monto es menor al subtotal — elegí una opción para continuar.'}
              </p>
            </div>
          )}

          {montoPagado > subtotal && (
            <p className="font-inter text-xs text-on-surface-variant">
              Sobrepago — el excedente queda como saldo a favor, repartido proporcionalmente entre los alumnos.
            </p>
          )}

          {error && <p className="font-inter text-sm text-error">{error}</p>}

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                resetForm()
                onCancel?.()
              }}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="solido"
              disabled={saving || montoPagado <= 0 || !fechaPago || (esAmbiguo && tipoPagoParcialidad === '')}
              onClick={handleSubmit}
            >
              {saving ? 'Registrando…' : 'Registrar pago familiar'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
