import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Alumno, MetodoPago, TipoCargo } from '@/types/db'
import { supabase } from '@/lib/supabase'
import { traducirError } from '@/lib/errores'
import { buscarCargo } from '@/lib/cuenta'
import { aplicarDescuento, aplicarTipoCuota, precioVigente } from '@/lib/precios'
import { useCombosActivos, useDescuentos, useDisciplinasActivas, usePrecios } from '@/hooks/useCatalogos'
import { queryKeys } from '@/lib/queryKeys'
import { Button } from '@/components/ui/button'
import { FormCurrencyInput, FormMonthInput, FormSelect } from '@/components/ui/FormField'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { BadgeEstado } from '@/components/ui/BadgeEstado'
import { AlumnoBuscador } from '@/components/ui/AlumnoBuscador'
import { MetodoPagoField } from '@/components/ui/MetodoPagoField'

const TIPOS_CUOTA: { value: TipoCargo; label: string }[] = [
  { value: 'completa', label: 'Cuota completa' },
  { value: 'media', label: 'Media cuota' },
]

function periodoActual(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

interface IndividualPanelProps {
  onSuccess?: () => void
}

export function IndividualPanel({ onSuccess }: IndividualPanelProps) {
  const queryClient = useQueryClient()
  const { data: precios = [] } = usePrecios()
  const { data: disciplinas = [] } = useDisciplinasActivas()
  const { data: combos = [] } = useCombosActivos()
  const { data: descuentos = [] } = useDescuentos()

  const [alumno, setAlumno] = useState<Alumno | null>(null)
  const [periodo, setPeriodo] = useState(periodoActual())
  const [disciplinaId, setDisciplinaId] = useState('')
  const [comboId, setComboId] = useState('')
  const [tipoCuota, setTipoCuota] = useState<TipoCargo>('completa')
  const [descuentoId, setDescuentoId] = useState('')
  const [precioCalculado, setPrecioCalculado] = useState(0)
  const [montoPagado, setMontoPagado] = useState(0)
  const [metodo, setMetodo] = useState<MetodoPago>('efectivo')
  const [importeEfectivo, setImporteEfectivo] = useState(0)
  const [importeTransferencia, setImporteTransferencia] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const registrarPago = useMutation({
    mutationFn: async () => {
      if (!alumno) throw new Error('Falta seleccionar un alumno.')
      const cargo = await buscarCargo(alumno.id, periodo)

      const { data: pago, error: pagoError } = await supabase
        .from('pagos')
        .insert({
          tipo_pago: 'individual',
          metodo_pago: metodo,
          importe_efectivo: importeEfectivo,
          importe_transferencia: importeTransferencia,
          total: montoPagado,
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
        precio_snapshot: precioCalculado,
        monto_pagado: montoPagado,
      })

      if (detalleError) {
        await supabase.from('pagos').delete().eq('id', pago.id)
        throw new Error(detalleError.message)
      }
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
    const base = precioVigente(precios, comboId || null, periodo)
    const descuento = descuentos.find((d) => d.id === descuentoId)
    const precio = base === null ? 0 : aplicarDescuento(aplicarTipoCuota(base, tipoCuota), descuento)
    setPrecioCalculado(precio)
    setMontoPagado(precio)
  }, [comboId, periodo, tipoCuota, descuentoId, precios, descuentos])

  useEffect(() => {
    if (metodo === 'efectivo') {
      setImporteEfectivo(montoPagado)
      setImporteTransferencia(0)
    } else if (metodo === 'transferencia') {
      setImporteEfectivo(0)
      setImporteTransferencia(montoPagado)
    }
  }, [metodo, montoPagado])

  function resetForm() {
    setAlumno(null)
    setPeriodo(periodoActual())
    setDisciplinaId('')
    setComboId('')
    setTipoCuota('completa')
    setDescuentoId('')
    setPrecioCalculado(0)
    setMontoPagado(0)
    setMetodo('efectivo')
    setImporteEfectivo(0)
    setImporteTransferencia(0)
  }

  async function handleSubmit() {
    if (!alumno || !disciplinaId || !comboId || !periodo || montoPagado <= 0) return
    if (
      metodo === 'combinado' &&
      Math.round((importeEfectivo + importeTransferencia) * 100) !== Math.round(montoPagado * 100)
    ) {
      setError('La suma de efectivo y transferencia debe ser igual al monto pagado.')
      return
    }

    setError(null)
    const alumnoRegistrado = alumno

    try {
      await registrarPago.mutateAsync()
    } catch (err) {
      setError(traducirError(err instanceof Error ? err.message : null, 'No se pudo registrar el pago.'))
      return
    }

    setSuccess(
      `Pago de $${montoPagado.toLocaleString('es-AR')} registrado para ${alumnoRegistrado.nombre} ${alumnoRegistrado.apellido} — período ${periodo}.`,
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
              total={montoPagado}
              importeEfectivo={importeEfectivo}
              importeTransferencia={importeTransferencia}
              onImporteEfectivoChange={setImporteEfectivo}
              onImporteTransferenciaChange={setImporteTransferencia}
            />
          </div>

          {montoPagado > 0 && montoPagado !== precioCalculado && (
            <p className="font-inter text-xs text-on-surface-variant">
              {montoPagado < precioCalculado
                ? 'Pago parcial — quedará saldo pendiente en el cargo.'
                : 'Sobrepago — el excedente queda como saldo a favor del alumno.'}
            </p>
          )}

          {error && <p className="font-inter text-sm text-error">{error}</p>}

          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={resetForm}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="solido"
              disabled={saving || !disciplinaId || !comboId || montoPagado <= 0}
              onClick={handleSubmit}
            >
              {saving ? 'Registrando…' : 'Registrar pago'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
