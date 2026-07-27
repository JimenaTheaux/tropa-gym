import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Alumno, MetodoPago } from '@/types/db'
import { supabase } from '@/lib/supabase'
import { traducirError } from '@/lib/errores'
import { aplicarDescuento, precioVigente } from '@/lib/precios'
import { useCombosActivos, useDescuentos, useDisciplinasActivas, usePrecios } from '@/hooks/useCatalogos'
import { queryKeys } from '@/lib/queryKeys'
import { Button } from '@/components/ui/button'
import { FormCurrencyInput, FormInput, FormSelect } from '@/components/ui/FormField'
import { BadgeEstado } from '@/components/ui/BadgeEstado'
import { AlumnoBuscador } from '@/components/ui/AlumnoBuscador'
import { MetodoPagoField } from '@/components/ui/MetodoPagoField'

function periodoActual(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function sumarMeses(periodo: string, cantidad: number): string {
  const [anio, mes] = periodo.split('-').map(Number)
  const fecha = new Date(anio, mes - 1 + cantidad, 1)
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`
}

interface DetallePeriodo {
  key: string
  periodo: string
  disciplinaId: string
  comboId: string
  descuentoId: string
  precioCalculado: number
  monto: number
}

interface AdelantadoPanelProps {
  onSuccess?: () => void
}

export function AdelantadoPanel({ onSuccess }: AdelantadoPanelProps) {
  const queryClient = useQueryClient()
  const { data: precios = [] } = usePrecios()
  const { data: disciplinas = [] } = useDisciplinasActivas()
  const { data: combos = [] } = useCombosActivos()
  const { data: descuentos = [] } = useDescuentos()

  const [alumno, setAlumno] = useState<Alumno | null>(null)
  const [periodos, setPeriodos] = useState<DetallePeriodo[]>([])
  const [metodo, setMetodo] = useState<MetodoPago>('efectivo')
  const [importeEfectivo, setImporteEfectivo] = useState(0)
  const [importeTransferencia, setImporteTransferencia] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const registrarPagoAdelantado = useMutation({
    mutationFn: async (payload: {
      p_alumno_id: string
      p_periodos: Record<string, unknown>[]
      p_metodo: MetodoPago
      p_importe_efectivo: number
      p_importe_transferencia: number
    }) => {
      const { error } = await supabase.rpc('registrar_pago_adelantado', payload)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.historialPagos })
      queryClient.invalidateQueries({ queryKey: ['cuenta'] })
      queryClient.invalidateQueries({ queryKey: ['cargos'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
  const saving = registrarPagoAdelantado.isPending

  const total = periodos.reduce((sum, p) => sum + p.monto, 0)

  useEffect(() => {
    if (metodo === 'efectivo') {
      setImporteEfectivo(total)
      setImporteTransferencia(0)
    } else if (metodo === 'transferencia') {
      setImporteEfectivo(0)
      setImporteTransferencia(total)
    }
  }, [metodo, total])

  function agregarPeriodo() {
    const ultimo = periodos[periodos.length - 1]
    const siguiente = ultimo ? sumarMeses(ultimo.periodo, 1) : periodoActual()
    setPeriodos((prev) => [
      ...prev,
      {
        key: `${siguiente}-${prev.length}`,
        periodo: siguiente,
        disciplinaId: '',
        comboId: '',
        descuentoId: '',
        precioCalculado: 0,
        monto: 0,
      },
    ])
  }

  // El monto pagado se pre-carga con el precio calculado (combo/descuento)
  // pero queda editable — permite pago parcial o sobrepago por período.
  function actualizarPeriodo(key: string, patch: Partial<DetallePeriodo>) {
    setPeriodos((prev) =>
      prev.map((p) => {
        if (p.key !== key) return p
        const actualizado = { ...p, ...patch }
        if ('monto' in patch) return actualizado
        const base = precioVigente(precios, actualizado.comboId || null, actualizado.periodo)
        const descuento = descuentos.find((d) => d.id === actualizado.descuentoId)
        const precio = base === null ? 0 : aplicarDescuento(base, descuento?.porcentaje)
        return { ...actualizado, precioCalculado: precio, monto: precio }
      }),
    )
  }

  function quitarPeriodo(key: string) {
    setPeriodos((prev) => prev.filter((p) => p.key !== key))
  }

  function resetForm() {
    setAlumno(null)
    setPeriodos([])
    setMetodo('efectivo')
    setImporteEfectivo(0)
    setImporteTransferencia(0)
  }

  async function handleSubmit() {
    if (!alumno || periodos.length === 0) return
    if (periodos.some((p) => !p.disciplinaId || !p.comboId || !p.periodo || p.monto <= 0)) {
      setError('Completá disciplina, combo y monto para cada período.')
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

    const p_periodos = periodos.map((p) => {
      const precioBase = precioVigente(precios, p.comboId, p.periodo) ?? p.monto
      return {
        periodo: p.periodo,
        disciplina_id: p.disciplinaId,
        combo_id: p.comboId,
        descuento_id: p.descuentoId || null,
        precio_snapshot: precioBase,
        monto_pagado: p.monto,
      }
    })

    const alumnoRegistrado = alumno
    const cantidadPeriodos = periodos.length

    try {
      await registrarPagoAdelantado.mutateAsync({
        p_alumno_id: alumno.id,
        p_periodos,
        p_metodo: metodo,
        p_importe_efectivo: importeEfectivo,
        p_importe_transferencia: importeTransferencia,
      })
    } catch (err) {
      setError(traducirError(err instanceof Error ? err.message : null))
      return
    }

    setSuccess(
      `Pago adelantado de $${total.toLocaleString('es-AR')} registrado para ${alumnoRegistrado.nombre} ${alumnoRegistrado.apellido} (${cantidadPeriodos} período(s)).`,
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
        <>
          <div className="flex items-center justify-between rounded-card border border-outline-variant bg-surface-container p-5">
            <div>
              <p className="font-oswald text-lg font-bold uppercase text-on-surface">
                {alumno.nombre} {alumno.apellido}
              </p>
              <p className="font-inter text-sm text-on-surface-variant">DNI {alumno.dni}</p>
            </div>
            <BadgeEstado estado={alumno.estado} />
          </div>

          {periodos.map((p) => (
            <div
              key={p.key}
              className="flex flex-col gap-4 rounded-card border border-outline-variant bg-surface-container p-5"
            >
              <div className="flex items-center justify-between">
                <p className="font-oswald text-base font-bold uppercase text-on-surface">Período {p.periodo}</p>
                <button
                  type="button"
                  onClick={() => quitarPeriodo(p.key)}
                  aria-label="Quitar período"
                  className="text-on-surface-variant hover:text-error"
                >
                  <span className="material-symbols-outlined !text-[18px]">close</span>
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormSelect
                  id={`adelantado-disciplina-${p.key}`}
                  label="Disciplina"
                  placeholder="Seleccionar disciplina"
                  required
                  value={p.disciplinaId}
                  onChange={(e) => actualizarPeriodo(p.key, { disciplinaId: e.target.value })}
                  options={disciplinas.map((d) => ({ value: d.id, label: d.nombre }))}
                />
                <FormSelect
                  id={`adelantado-combo-${p.key}`}
                  label="Combo"
                  placeholder="Seleccionar combo"
                  required
                  value={p.comboId}
                  onChange={(e) => actualizarPeriodo(p.key, { comboId: e.target.value })}
                  options={combos.map((c) => ({ value: c.id, label: c.nombre }))}
                />
                <FormInput
                  id={`adelantado-periodo-${p.key}`}
                  label="Período"
                  type="month"
                  required
                  value={p.periodo}
                  onChange={(e) => actualizarPeriodo(p.key, { periodo: e.target.value })}
                />
                <FormSelect
                  id={`adelantado-descuento-${p.key}`}
                  label="Descuento (opcional)"
                  placeholder="Sin descuento"
                  value={p.descuentoId}
                  onChange={(e) => actualizarPeriodo(p.key, { descuentoId: e.target.value })}
                  options={descuentos.map((d) => ({ value: d.id, label: `${d.nombre} (${d.porcentaje}%)` }))}
                />
              </div>

              <FormCurrencyInput
                id={`adelantado-monto-${p.key}`}
                label="Monto pagado"
                min={0}
                step="0.01"
                required
                value={p.monto}
                onChange={(e) => actualizarPeriodo(p.key, { monto: Number(e.target.value) })}
              />
              {p.monto > 0 && p.monto !== p.precioCalculado && (
                <p className="font-inter text-xs text-on-surface-variant">
                  Precio calculado: ${p.precioCalculado.toLocaleString('es-AR')} —{' '}
                  {p.monto < p.precioCalculado ? 'pago parcial' : 'sobrepago'}
                </p>
              )}
            </div>
          ))}

          <Button type="button" variant="primario" onClick={agregarPeriodo}>
            <span className="material-symbols-outlined !text-[16px]">add</span>
            Agregar período
          </Button>

          {periodos.length > 0 && (
            <div className="flex flex-col gap-4 rounded-card border border-outline-variant bg-surface-container p-5">
              <div className="flex flex-wrap items-start justify-between gap-6 border-b border-outline-variant pb-4">
                <div className="flex flex-col gap-1.5">
                  <span className="font-oswald text-[11px] uppercase tracking-[0.05em] text-on-surface-variant">
                    Total de la operación
                  </span>
                  <span className="font-anton text-2xl text-on-surface">${total.toLocaleString('es-AR')}</span>
                </div>
                <MetodoPagoField
                  idPrefix="adelantado"
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
                <Button type="button" variant="ghost" onClick={resetForm}>
                  Cancelar
                </Button>
                <Button type="button" variant="solido" disabled={saving} onClick={handleSubmit}>
                  {saving ? 'Registrando…' : 'Registrar pago adelantado'}
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
