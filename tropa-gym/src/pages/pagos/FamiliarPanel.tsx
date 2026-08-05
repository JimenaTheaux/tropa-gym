import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Alumno, MetodoPago, TipoCargo } from '@/types/db'
import { supabase } from '@/lib/supabase'
import { traducirError } from '@/lib/errores'
import { buscarCargo } from '@/lib/cuenta'
import { aplicarDescuento, aplicarTipoCuota, precioVigente } from '@/lib/precios'
import { descuentosParaTipo } from '@/lib/catalogos'
import { useCombosActivos, useDescuentos, useDisciplinasActivas, usePrecios } from '@/hooks/useCatalogos'
import { queryKeys } from '@/lib/queryKeys'
import { Button } from '@/components/ui/button'
import { FormCurrencyInput, FormMonthInput, FormSelect } from '@/components/ui/FormField'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
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

interface DetalleFamiliar {
  key: string
  alumno: Alumno
  periodo: string
  disciplinaId: string
  comboId: string
  tipoCuota: TipoCargo
  precioCalculado: number
  monto: number
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
  const descuentos = descuentosParaTipo(descuentosTodos, 'familiar')

  const [detalles, setDetalles] = useState<DetalleFamiliar[]>([])
  const [descuentoId, setDescuentoId] = useState('')
  const [metodo, setMetodo] = useState<MetodoPago>('efectivo')
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

  const total = detalles.reduce((sum, d) => sum + d.monto, 0)

  function precioConDescuento(periodo: string, comboId: string, tipoCuota: TipoCargo): number {
    const base = precioVigente(precios, comboId || null, periodo)
    const descuento = descuentos.find((d) => d.id === descuentoId)
    return base === null ? 0 : aplicarDescuento(aplicarTipoCuota(base, tipoCuota), descuento)
  }

  // El descuento es único para todo el comprobante: al cambiarlo, se
  // recalcula el precio (y el monto pre-cargado) de todas las filas ya
  // agregadas, para no tener que reeditarlas una por una.
  useEffect(() => {
    setDetalles((prev) =>
      prev.map((d) => {
        if (!d.comboId || !d.periodo) return d
        const precio = precioConDescuento(d.periodo, d.comboId, d.tipoCuota)
        return { ...d, precioCalculado: precio, monto: precio }
      }),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [descuentoId, precios, descuentos])

  useEffect(() => {
    if (metodo === 'efectivo') {
      setImporteEfectivo(total)
      setImporteTransferencia(0)
    } else if (metodo === 'transferencia') {
      setImporteEfectivo(0)
      setImporteTransferencia(total)
    }
  }, [metodo, total])

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
        monto: 0,
      },
    ])
  }

  // El monto pagado se pre-carga con el precio calculado (combo/descuento)
  // pero queda editable — permite pago parcial o sobrepago por alumno.
  function actualizarDetalle(key: string, patch: Partial<DetalleFamiliar>) {
    setDetalles((prev) =>
      prev.map((d) => {
        if (d.key !== key) return d
        const actualizado = { ...d, ...patch }
        if ('monto' in patch) return actualizado
        const precio = precioConDescuento(actualizado.periodo, actualizado.comboId, actualizado.tipoCuota)
        return { ...actualizado, precioCalculado: precio, monto: precio }
      }),
    )
  }

  function quitarAlumno(key: string) {
    setDetalles((prev) => prev.filter((d) => d.key !== key))
  }

  function resetForm() {
    setDetalles([])
    setDescuentoId('')
    setMetodo('efectivo')
    setImporteEfectivo(0)
    setImporteTransferencia(0)
  }

  async function handleSubmit() {
    if (detalles.length === 0) return
    if (detalles.some((d) => !d.disciplinaId || !d.comboId || !d.periodo || d.monto <= 0)) {
      setError('Completá disciplina, combo y monto para cada alumno.')
      return
    }
    if (
      metodo === 'combinado' &&
      Math.round((importeEfectivo + importeTransferencia) * 100) !== Math.round(total * 100)
    ) {
      setError('La suma de efectivo y transferencia debe ser igual al total.')
      return
    }

    setError(null)

    const p_detalles = await Promise.all(
      detalles.map(async (d) => {
        const cargo = await buscarCargo(d.alumno.id, d.periodo)
        return {
          alumno_id: d.alumno.id,
          cargo_id: cargo?.id ?? null,
          periodo: d.periodo,
          disciplina_id: d.disciplinaId,
          combo_id: d.comboId,
          descuento_id: descuentoId || null,
          precio_snapshot: d.precioCalculado,
          monto_pagado: d.monto,
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
      })
    } catch (err) {
      setError(traducirError(err instanceof Error ? err.message : null))
      return
    }

    setSuccess(`Pago familiar de $${total.toLocaleString('es-AR')} registrado para ${cantidadDetalles} alumno(s).`)
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

          <div className="flex flex-wrap items-start gap-6 border-t border-outline-variant pt-4">
            <div className="flex flex-col gap-1.5">
              <span className="font-oswald text-[11px] uppercase tracking-[0.05em] text-on-surface-variant">
                Subtotal (con descuento)
              </span>
              <span className="font-inter text-sm text-on-surface-variant">
                ${d.precioCalculado.toLocaleString('es-AR')}
              </span>
            </div>
            <FormCurrencyInput
              id={`familiar-monto-${d.key}`}
              label="Monto pagado"
              min={0}
              step="0.01"
              required
              value={d.monto}
              onChange={(e) => actualizarDetalle(d.key, { monto: Number(e.target.value) })}
            />
          </div>
          {d.monto > 0 && d.monto !== d.precioCalculado && (
            <p className="font-inter text-xs text-on-surface-variant">
              {d.monto < d.precioCalculado ? 'Pago parcial' : 'Sobrepago'} respecto al subtotal.
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

          <div className="flex flex-wrap items-start justify-between gap-6 border-y border-outline-variant py-4">
            <div className="flex flex-col gap-1.5">
              <span className="font-oswald text-[11px] uppercase tracking-[0.05em] text-on-surface-variant">
                Total del comprobante
              </span>
              <span className="font-anton text-2xl text-on-surface">${total.toLocaleString('es-AR')}</span>
            </div>
            <MetodoPagoField
              idPrefix="familiar"
              metodo={metodo}
              onMetodoChange={setMetodo}
              total={total}
              importeEfectivo={importeEfectivo}
              importeTransferencia={importeTransferencia}
              onImporteEfectivoChange={setImporteEfectivo}
              onImporteTransferenciaChange={setImporteTransferencia}
            />
          </div>

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
            <Button type="button" variant="solido" disabled={saving} onClick={handleSubmit}>
              {saving ? 'Registrando…' : 'Registrar pago familiar'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
