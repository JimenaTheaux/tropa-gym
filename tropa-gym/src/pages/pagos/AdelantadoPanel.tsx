import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Alumno, MetodoPago } from '@/types/db'
import { supabase } from '@/lib/supabase'
import { traducirError } from '@/lib/errores'
import { aplicarDescuento, precioVigenteAdelantado } from '@/lib/precios'
import { descuentosParaTipo } from '@/lib/catalogos'
import { useCombosActivos, useDescuentos, useDisciplinasActivas, usePrecios } from '@/hooks/useCatalogos'
import { queryKeys } from '@/lib/queryKeys'
import { Button } from '@/components/ui/button'
import { FormCurrencyInput, FormSelect, FormCheckbox } from '@/components/ui/FormField'
import { BadgeEstado } from '@/components/ui/BadgeEstado'
import { AlumnoBuscador } from '@/components/ui/AlumnoBuscador'
import { MetodoPagoField } from '@/components/ui/MetodoPagoField'

const CANTIDAD_PERIODOS_SELECTOR = 12

function periodoActual(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function sumarMeses(periodo: string, cantidad: number): string {
  const [anio, mes] = periodo.split('-').map(Number)
  const fecha = new Date(anio, mes - 1 + cantidad, 1)
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`
}

function labelPeriodo(periodo: string): string {
  const [anio, mes] = periodo.split('-').map(Number)
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic']
  return `${MESES[mes - 1]} ${anio}`
}

const PERIODOS_DISPONIBLES = Array.from({ length: CANTIDAD_PERIODOS_SELECTOR }, (_, i) =>
  sumarMeses(periodoActual(), i),
)

interface DetallePeriodo {
  periodo: string
  precioCalculado: number
  monto: number
}

interface AdelantadoPanelProps {
  onSuccess?: () => void
  onCancel?: () => void
}

export function AdelantadoPanel({ onSuccess, onCancel }: AdelantadoPanelProps) {
  const queryClient = useQueryClient()
  const { data: precios = [] } = usePrecios()
  const { data: disciplinas = [] } = useDisciplinasActivas()
  const { data: combos = [] } = useCombosActivos()
  const { data: descuentosTodos = [] } = useDescuentos()
  const descuentos = descuentosParaTipo(descuentosTodos, 'adelantado')

  const [alumno, setAlumno] = useState<Alumno | null>(null)
  const [disciplinaId, setDisciplinaId] = useState('')
  const [comboId, setComboId] = useState('')
  const [descuentoId, setDescuentoId] = useState('')
  const [periodos, setPeriodos] = useState<Record<string, DetallePeriodo>>({})
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

  const periodosOrdenados = Object.values(periodos).sort((a, b) => (a.periodo < b.periodo ? -1 : 1))
  const total = periodosOrdenados.reduce((sum, p) => sum + p.monto, 0)

  function calcularPrecio(periodo: string): number {
    const base = precioVigenteAdelantado(precios, comboId || null, periodo)
    const descuento = descuentos.find((d) => d.id === descuentoId)
    return base === null ? 0 : aplicarDescuento(base, descuento)
  }

  // El combo y el descuento son únicos para toda la operación: al cambiar
  // cualquiera de los dos, se recalcula el precio (y el monto pre-cargado)
  // de todos los períodos ya tildados.
  useEffect(() => {
    setPeriodos((prev) => {
      const next: Record<string, DetallePeriodo> = {}
      for (const periodo of Object.keys(prev)) {
        const precio = calcularPrecio(periodo)
        next[periodo] = { periodo, precioCalculado: precio, monto: precio }
      }
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comboId, descuentoId, precios, descuentos])

  useEffect(() => {
    if (metodo === 'efectivo') {
      setImporteEfectivo(total)
      setImporteTransferencia(0)
    } else if (metodo === 'transferencia') {
      setImporteEfectivo(0)
      setImporteTransferencia(total)
    }
  }, [metodo, total])

  function togglePeriodo(periodo: string) {
    setPeriodos((prev) => {
      if (prev[periodo]) {
        const next = { ...prev }
        delete next[periodo]
        return next
      }
      const precio = calcularPrecio(periodo)
      return { ...prev, [periodo]: { periodo, precioCalculado: precio, monto: precio } }
    })
  }

  function actualizarMonto(periodo: string, monto: number) {
    setPeriodos((prev) => ({ ...prev, [periodo]: { ...prev[periodo], monto } }))
  }

  function resetForm() {
    setAlumno(null)
    setDisciplinaId('')
    setComboId('')
    setDescuentoId('')
    setPeriodos({})
    setMetodo('efectivo')
    setImporteEfectivo(0)
    setImporteTransferencia(0)
  }

  async function handleSubmit() {
    if (!alumno || !disciplinaId || !comboId || periodosOrdenados.length === 0) return
    if (periodosOrdenados.some((p) => p.monto <= 0)) {
      setError('Completá un monto mayor a $0 para cada período seleccionado.')
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

    const p_periodos = periodosOrdenados.map((p) => ({
      periodo: p.periodo,
      disciplina_id: disciplinaId,
      combo_id: comboId,
      descuento_id: descuentoId || null,
      precio_snapshot: p.precioCalculado,
      monto_pagado: p.monto,
    }))

    const alumnoRegistrado = alumno
    const cantidadPeriodos = periodosOrdenados.length

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

          <div className="grid grid-cols-1 gap-4 rounded-card border border-outline-variant bg-surface-container p-5 sm:grid-cols-2">
            <FormSelect
              id="adelantado-disciplina"
              label="Disciplina"
              placeholder="Seleccionar disciplina"
              required
              value={disciplinaId}
              onChange={(e) => setDisciplinaId(e.target.value)}
              options={disciplinas.map((d) => ({ value: d.id, label: d.nombre }))}
            />
            <FormSelect
              id="adelantado-combo"
              label="Combo"
              placeholder="Seleccionar combo"
              required
              value={comboId}
              onChange={(e) => setComboId(e.target.value)}
              options={combos.map((c) => ({ value: c.id, label: c.nombre }))}
            />
          </div>

          <div className="flex flex-col gap-3 rounded-card border border-outline-variant bg-surface-container p-5">
            <span className="font-oswald text-[11px] uppercase tracking-[0.05em] text-on-surface-variant">
              Períodos a abonar
            </span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {PERIODOS_DISPONIBLES.map((periodo) => (
                <FormCheckbox
                  key={periodo}
                  id={`adelantado-periodo-chk-${periodo}`}
                  label={labelPeriodo(periodo)}
                  checked={!!periodos[periodo]}
                  disabled={!comboId}
                  onChange={() => togglePeriodo(periodo)}
                />
              ))}
            </div>
            {!comboId && (
              <p className="font-inter text-xs text-on-surface-variant">
                Elegí un combo para poder tildar períodos.
              </p>
            )}
          </div>

          {periodosOrdenados.map((p) => (
            <div
              key={p.periodo}
              className="flex flex-wrap items-center justify-between gap-4 rounded-card border border-outline-variant bg-surface-container p-5"
            >
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => togglePeriodo(p.periodo)}
                  aria-label="Quitar período"
                  className="text-on-surface-variant hover:text-error"
                >
                  <span className="material-symbols-outlined !text-[18px]">close</span>
                </button>
                <div className="flex flex-col">
                  <span className="font-oswald text-sm font-bold uppercase text-on-surface">
                    Período {labelPeriodo(p.periodo)}
                  </span>
                  <span className="font-inter text-xs text-on-surface-variant">
                    Subtotal (con descuento): ${p.precioCalculado.toLocaleString('es-AR')}
                  </span>
                </div>
              </div>
              <FormCurrencyInput
                id={`adelantado-monto-${p.periodo}`}
                label="Monto pagado"
                min={0}
                step="0.01"
                required
                value={p.monto}
                onChange={(e) => actualizarMonto(p.periodo, Number(e.target.value))}
              />
            </div>
          ))}

          {periodosOrdenados.length > 0 && (
            <div className="flex flex-col gap-4 rounded-card border border-outline-variant bg-surface-container p-5">
              <FormSelect
                id="adelantado-descuento"
                label="Descuento / Recargo (opcional) — aplica a todos los períodos"
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
                  disabled={saving || !disciplinaId}
                  onClick={handleSubmit}
                >
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
