import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Alumno, MetodoPago, TipoCargo } from '@/types/db'
import { supabase } from '@/lib/supabase'
import { traducirError } from '@/lib/errores'
import { buscarCargo, fetchResumenPeriodo } from '@/lib/cuenta'
import { aplicarDescuento, aplicarTipoCuota, precioVigente } from '@/lib/precios'
import { descuentosParaTipo } from '@/lib/catalogos'
import { useCombosActivos, useDescuentos, useDisciplinasActivas, usePrecios } from '@/hooks/useCatalogos'
import { queryKeys } from '@/lib/queryKeys'
import { hoyIso } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { FormCurrencyInput, FormDateInput, FormMonthInput, FormSelect } from '@/components/ui/FormField'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { BadgeEstado } from '@/components/ui/BadgeEstado'
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

// Datos de una línea de pagos_alumnos ya registrada, para precargar el form
// en modo edición (lápiz en Historial de Pagos). No incluye tipoCuota porque
// no se persiste — se pierde ese dato y se asume 'completa' por default; si
// el pago real fue media cuota, el toggle "Tipo de cuota" queda mal
// preseleccionado (cosmético), pero el precio mostrado sí es el real
// (precioSnapshot) porque no se recalcula hasta que el usuario toca algo.
export interface EditarPagoInit {
  pagoAlumnoId: string
  pagoId: string
  alumno: Alumno
  periodo: string
  disciplinaId: string
  comboId: string
  descuentoId: string | null
  precioSnapshot: number
  montoPagado: number
  metodoPago: MetodoPago
  fecha: string
}

interface IndividualPanelProps {
  onSuccess?: () => void
  onCancel?: () => void
  editar?: EditarPagoInit
}

export function IndividualPanel({ onSuccess, onCancel, editar }: IndividualPanelProps) {
  const queryClient = useQueryClient()
  const { data: precios = [] } = usePrecios()
  const { data: disciplinas = [] } = useDisciplinasActivas()
  const { data: combos = [] } = useCombosActivos()
  const { data: descuentosTodos = [] } = useDescuentos()
  const descuentos = useMemo(() => descuentosParaTipo(descuentosTodos, 'individual'), [descuentosTodos])

  const [alumno, setAlumno] = useState<Alumno | null>(editar?.alumno ?? null)
  const [periodo, setPeriodo] = useState(editar?.periodo ?? periodoActual())
  const [disciplinaId, setDisciplinaId] = useState(editar?.disciplinaId ?? '')
  const [comboId, setComboId] = useState(editar?.comboId ?? '')
  const [tipoCuota, setTipoCuota] = useState<TipoCargo>('completa')
  const [descuentoId, setDescuentoId] = useState(editar?.descuentoId ?? '')
  const [precioCalculado, setPrecioCalculado] = useState(editar?.precioSnapshot ?? 0)
  const [montoPagado, setMontoPagado] = useState(editar?.montoPagado ?? 0)
  const [tipoPagoParcialidad, setTipoPagoParcialidad] = useState<TipoPagoParcialidad | ''>('')
  const [metodo, setMetodo] = useState<MetodoPago>(editar?.metodoPago ?? 'efectivo')
  const [fechaPago, setFechaPago] = useState(editar?.fecha ?? hoyIso())
  const [importeEfectivo, setImporteEfectivo] = useState(0)
  const [importeTransferencia, setImporteTransferencia] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Recalcular precio/monto/tipoPagoParcialidad al montar pisaría los
  // valores precargados de una edición — se salta la primera pasada.
  const pendienteSeed = useRef(!!editar)

  // El comprobante familiar/adelantado reparte el mismo pago (método,
  // importes, total) entre varias líneas. Al editar una sola línea acá,
  // el total del comprobante para método de pago es el de las OTRAS líneas
  // más esta — no solo esta línea (si no, "combinado" validaría mal y el
  // total del comprobante quedaría pisado con el monto de una sola línea).
  const [otrasLineasTotal, setOtrasLineasTotal] = useState(0)
  useEffect(() => {
    if (!editar) return
    let cancelado = false
    supabase
      .from('pagos_alumnos')
      .select('monto_pagado')
      .eq('pago_id', editar.pagoId)
      .neq('id', editar.pagoAlumnoId)
      .then(({ data }) => {
        if (cancelado) return
        setOtrasLineasTotal((data ?? []).reduce((s, r) => s + Number(r.monto_pagado), 0))
      })
    return () => {
      cancelado = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editar?.pagoAlumnoId, editar?.pagoId])

  const totalRecibo = editar ? otrasLineasTotal + montoPagado : montoPagado

  // Aviso si el alumno ya tiene un pago cargado en este mismo período — no
  // se busca acá para editar (editar apunta a esa fila puntual), solo para
  // registrar uno nuevo. Sirve para no confundir "completar un pago parcial
  // con una segunda cuota" (usar "Completar pago" en Historial) con "cobrar
  // un precio especial completo" (el selector de abajo) — si se elige
  // Completo acá para lo que en realidad es la segunda cuota de un pago ya
  // existente, se pisa el precio de referencia con el monto de esta sola
  // cuota en vez de sumarlo al ya pagado.
  const [pagoExistente, setPagoExistente] = useState<{ pagado: number; monto: number } | null>(null)
  useEffect(() => {
    if (editar || !alumno || !periodo) {
      setPagoExistente(null)
      return
    }
    let cancelado = false
    ;(async () => {
      const cargo = await buscarCargo(alumno.id, periodo)
      const resumen = await fetchResumenPeriodo(alumno.id, periodo, cargo?.id ?? null)
      if (!cancelado) setPagoExistente(resumen.pagado > 0 ? { pagado: resumen.pagado, monto: resumen.monto } : null)
    })()
    return () => {
      cancelado = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!editar, alumno?.id, periodo])

  // Ambiguo = el monto tipeado quedó por debajo de lo calculado: puede ser
  // un pago parcial (queda deuda) o un precio especial que el dueño cobró
  // completo (no debe quedar deuda). Si es igual o mayor, no hay ambigüedad
  // (completo o sobrepago, ya se resuelve solo vía trigger).
  const esAmbiguo = montoPagado > 0 && precioCalculado > 0 && montoPagado < precioCalculado
  const ajustarPrecio = esAmbiguo && tipoPagoParcialidad === 'completo'
  const precioSnapshotFinal = ajustarPrecio ? montoPagado : precioCalculado

  const registrarPago = useMutation({
    mutationFn: async () => {
      if (!alumno) throw new Error('Falta seleccionar un alumno.')
      const cargo = await buscarCargo(alumno.id, periodo)

      if (editar) {
        const { error: detalleError } = await supabase
          .from('pagos_alumnos')
          .update({
            cargo_id: cargo?.id ?? null,
            periodo,
            disciplina_id: disciplinaId,
            combo_id: comboId,
            descuento_id: descuentoId || null,
            precio_snapshot: precioSnapshotFinal,
            monto_pagado: montoPagado,
          })
          .eq('id', editar.pagoAlumnoId)

        if (detalleError) throw new Error(detalleError.message)

        let ajusteFallido = false
        if (ajustarPrecio && cargo) {
          const { error: cargoError } = await supabase
            .from('cargos')
            .update({ monto: montoPagado })
            .eq('id', cargo.id)
          if (cargoError) ajusteFallido = true
        }

        const { error: pagoError } = await supabase
          .from('pagos')
          .update({
            metodo_pago: metodo,
            importe_efectivo: importeEfectivo,
            importe_transferencia: importeTransferencia,
            total: totalRecibo,
            fecha: fechaPago,
          })
          .eq('id', editar.pagoId)
        if (pagoError) throw new Error(pagoError.message)

        return { ajusteFallido }
      }

      const { data: pago, error: pagoError } = await supabase
        .from('pagos')
        .insert({
          tipo_pago: 'individual',
          metodo_pago: metodo,
          importe_efectivo: importeEfectivo,
          importe_transferencia: importeTransferencia,
          total: montoPagado,
          fecha: fechaPago,
        })
        .select()
        .single()

      if (pagoError || !pago) throw new Error(pagoError?.message ?? 'No se pudo registrar el pago.')

      const { error: detalleError } = await supabase.from('pagos_alumnos').insert({
        pago_id: pago.id,
        alumno_id: alumno.id,
        cargo_id: cargo?.id ?? null,
        periodo,
        disciplina_id: disciplinaId,
        combo_id: comboId,
        descuento_id: descuentoId || null,
        precio_snapshot: precioSnapshotFinal,
        monto_pagado: montoPagado,
      })

      if (detalleError) {
        await supabase.from('pagos').delete().eq('id', pago.id)
        throw new Error(detalleError.message)
      }

      // Se ajusta el cargo DESPUÉS de insertar el pago (no antes): si esto
      // falla, el pago ya quedó registrado y el cargo se puede corregir a
      // mano desde la ficha del alumno — mejor eso que un cargo con el
      // precio cambiado sin ningún pago que lo explique.
      let ajusteFallido = false
      if (ajustarPrecio && cargo) {
        const { error: cargoError } = await supabase.from('cargos').update({ monto: montoPagado }).eq('id', cargo.id)
        if (cargoError) ajusteFallido = true
      }

      return { ajusteFallido }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.historialPagos })
      queryClient.invalidateQueries({ queryKey: ['cuenta'] })
      queryClient.invalidateQueries({ queryKey: ['cargos'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
  const saving = registrarPago.isPending

  // Precio de referencia (lo que corresponde pagar) — recalcula automático.
  // El monto pagado se pre-carga con este valor pero queda editable (pago
  // parcial o sobrepago), por eso se resetea acá y no se deriva de él.
  useEffect(() => {
    if (pendienteSeed.current) {
      pendienteSeed.current = false
      return
    }
    const base = precioVigente(precios, comboId || null, periodo)
    const descuento = descuentos.find((d) => d.id === descuentoId)
    const precio = base === null ? 0 : aplicarDescuento(aplicarTipoCuota(base, tipoCuota), descuento)
    setPrecioCalculado(precio)
    setMontoPagado(precio)
    setTipoPagoParcialidad('')
  }, [comboId, periodo, tipoCuota, descuentoId, precios, descuentos])

  useEffect(() => {
    if (metodo === 'efectivo') {
      setImporteEfectivo(totalRecibo)
      setImporteTransferencia(0)
    } else if (metodo === 'transferencia') {
      setImporteEfectivo(0)
      setImporteTransferencia(totalRecibo)
    }
  }, [metodo, totalRecibo])

  function resetForm() {
    setAlumno(null)
    setPeriodo(periodoActual())
    setDisciplinaId('')
    setComboId('')
    setTipoCuota('completa')
    setDescuentoId('')
    setPrecioCalculado(0)
    setMontoPagado(0)
    setTipoPagoParcialidad('')
    setMetodo('efectivo')
    setFechaPago(hoyIso())
    setImporteEfectivo(0)
    setImporteTransferencia(0)
  }

  async function handleSubmit() {
    if (!alumno || !disciplinaId || !comboId || !periodo || montoPagado <= 0 || !fechaPago) return
    if (esAmbiguo && tipoPagoParcialidad === '') {
      setError('Indicá si fue un pago parcial o el monto completo (precio especial).')
      return
    }
    if (
      metodo === 'combinado' &&
      Math.round((importeEfectivo + importeTransferencia) * 100) !== Math.round(totalRecibo * 100)
    ) {
      setError('La suma de efectivo y transferencia debe ser igual al total del comprobante.')
      return
    }

    setError(null)
    const alumnoRegistrado = alumno

    let resultado: { ajusteFallido: boolean }
    try {
      resultado = await registrarPago.mutateAsync()
    } catch (err) {
      setError(
        traducirError(
          err instanceof Error ? err.message : null,
          editar ? 'No se pudo guardar el pago.' : 'No se pudo registrar el pago.',
        ),
      )
      return
    }

    const accion = editar ? 'actualizado' : 'registrado'
    setSuccess(
      resultado.ajusteFallido
        ? `Pago de $${montoPagado.toLocaleString('es-AR')} ${accion} para ${alumnoRegistrado.nombre} ${alumnoRegistrado.apellido}, pero no se pudo ajustar el precio del cargo — corregilo desde la ficha del alumno.`
        : `Pago de $${montoPagado.toLocaleString('es-AR')} ${accion} para ${alumnoRegistrado.nombre} ${alumnoRegistrado.apellido} — período ${periodo}.`,
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

      {!alumno && <AlumnoBuscador onSelect={setAlumno} />}

      {alumno && (
        <div className="flex flex-col gap-4 rounded-card border border-outline-variant bg-surface-container p-5">
          <div className="flex items-center justify-between">
            <p className="font-oswald text-lg font-bold uppercase text-on-surface">
              {alumno.nombre} {alumno.apellido}
            </p>
            <BadgeEstado estado={alumno.estado} />
          </div>

          {pagoExistente && (
            <p className="rounded-lg border border-error/50 bg-error/10 px-3 py-2 font-inter text-xs text-error">
              {pagoExistente.pagado < pagoExistente.monto
                ? `Ya hay $${pagoExistente.pagado.toLocaleString('es-AR')} pagado de $${pagoExistente.monto.toLocaleString('es-AR')} para este alumno en el período ${periodo}. Si esto es para completar ese pago, usá "Completar pago" en el Historial de Pagos en vez de cargar uno nuevo acá — si elegís "Completo" en el selector de abajo, va a fijar el precio de referencia en el monto de este pago nuevo nomás, no en la suma de ambos.`
                : `Este alumno ya tiene $${pagoExistente.pagado.toLocaleString('es-AR')} pagados (cubre el período ${periodo}). Si es un pago aparte, continuá; si fue un error, revisá el Historial de Pagos antes de guardar.`}
            </p>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormSelect
              id="individual-disciplina"
              label="Disciplina"
              placeholder="Seleccionar disciplina"
              required
              value={disciplinaId}
              onChange={(e) => setDisciplinaId(e.target.value)}
              options={disciplinas.map((d) => ({ value: d.id, label: d.nombre }))}
            />
            <FormSelect
              id="individual-combo"
              label="Combo"
              placeholder="Seleccionar combo"
              required
              value={comboId}
              onChange={(e) => setComboId(e.target.value)}
              options={combos.map((c) => ({ value: c.id, label: c.nombre }))}
            />
            <FormMonthInput id="individual-periodo" label="Período" required value={periodo} onChange={setPeriodo} />
            <FormSelect
              id="individual-descuento"
              label="Descuento / Recargo (opcional)"
              placeholder="Sin ajuste"
              value={descuentoId}
              onChange={(e) => setDescuentoId(e.target.value)}
              options={descuentos.map((d) => ({
                value: d.id,
                label: `${d.tipo === 'recargo' ? '+' : '-'}${d.porcentaje}% ${d.nombre}`,
              }))}
            />
          </div>

          {comboId && precioCalculado === 0 && (
            <p className="font-inter text-xs text-error">
              No hay precio vigente para este combo en el período seleccionado. Cargá el monto pagado manualmente.
            </p>
          )}

          <SegmentedControl
            id="individual-tipo-cuota"
            label="Tipo de cuota"
            value={tipoCuota}
            onChange={setTipoCuota}
            options={TIPOS_CUOTA}
          />

          <div className="flex flex-wrap items-start gap-6 border-t border-outline-variant pt-4">
            <div className="flex flex-col gap-1.5">
              <span className="font-oswald text-[11px] uppercase tracking-[0.05em] text-on-surface-variant">
                Precio calculado
              </span>
              <span className="font-inter text-sm text-on-surface-variant">
                ${precioCalculado.toLocaleString('es-AR')}
              </span>
            </div>
            <FormCurrencyInput
              id="individual-monto-pagado"
              label="Monto pagado"
              min={0}
              step="0.01"
              required
              value={montoPagado}
              onChange={(e) => setMontoPagado(Number(e.target.value))}
            />
            <MetodoPagoField
              idPrefix="individual"
              metodo={metodo}
              onMetodoChange={setMetodo}
              total={totalRecibo}
              importeEfectivo={importeEfectivo}
              importeTransferencia={importeTransferencia}
              onImporteEfectivoChange={setImporteEfectivo}
              onImporteTransferenciaChange={setImporteTransferencia}
            />
          </div>

          <FormDateInput
            id="individual-fecha-pago"
            label="Fecha de pago"
            required
            value={fechaPago}
            onChange={setFechaPago}
          />

          {editar && otrasLineasTotal > 0 && (
            <p className="font-inter text-xs text-on-surface-variant">
              Esta línea es parte de un comprobante con otros alumnos o períodos (${otrasLineasTotal.toLocaleString('es-AR')} más). El método de pago que elijas acá aplica a todo el comprobante.
            </p>
          )}

          {esAmbiguo && (
            <div className="flex flex-col gap-2 rounded-lg border border-outline-variant bg-surface-container-low p-3">
              <SegmentedControl
                id="individual-tipo-pago-parcialidad"
                label="¿Fue un pago parcial o el monto completo?"
                value={tipoPagoParcialidad}
                onChange={setTipoPagoParcialidad}
                options={TIPOS_PAGO_PARCIALIDAD}
              />
              <p className="font-inter text-xs text-on-surface-variant">
                {tipoPagoParcialidad === 'completo'
                  ? `Se va a fijar el precio de esta cuota en $${montoPagado.toLocaleString('es-AR')} — no queda saldo pendiente.`
                  : tipoPagoParcialidad === 'parcial'
                    ? `Queda un saldo pendiente de $${(precioCalculado - montoPagado).toLocaleString('es-AR')} en el cargo.`
                    : 'El monto es menor al calculado — elegí una opción para continuar.'}
              </p>
            </div>
          )}

          {montoPagado > precioCalculado && (
            <p className="font-inter text-xs text-on-surface-variant">
              Sobrepago — el excedente queda como saldo a favor del alumno.
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
              disabled={
                saving ||
                !disciplinaId ||
                !comboId ||
                montoPagado <= 0 ||
                !fechaPago ||
                (esAmbiguo && tipoPagoParcialidad === '')
              }
              onClick={handleSubmit}
            >
              {saving ? 'Guardando…' : editar ? 'Guardar cambios' : 'Registrar pago'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
