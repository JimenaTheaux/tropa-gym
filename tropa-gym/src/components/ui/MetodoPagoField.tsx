import type { MetodoPago } from '@/types/db'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { FormCurrencyInput } from '@/components/ui/FormField'

const metodos: { value: MetodoPago; label: string }[] = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'combinado', label: 'Combinado' },
]

interface MetodoPagoFieldProps {
  idPrefix: string
  metodo: MetodoPago
  onMetodoChange: (metodo: MetodoPago) => void
  total: number
  importeEfectivo: number
  importeTransferencia: number
  onImporteEfectivoChange: (valor: number) => void
  onImporteTransferenciaChange: (valor: number) => void
}

// Método de pago (segmented control) + campos de combinado agrupados,
// con la suma validada en vivo contra el total. Reusado en los 3 forms
// de pago (individual, familiar, adelantado).
export function MetodoPagoField({
  idPrefix,
  metodo,
  onMetodoChange,
  total,
  importeEfectivo,
  importeTransferencia,
  onImporteEfectivoChange,
  onImporteTransferenciaChange,
}: MetodoPagoFieldProps) {
  const suma = importeEfectivo + importeTransferencia
  const diferencia = Math.round((total - suma) * 100) / 100
  const cuadra = Math.round(suma * 100) === Math.round(total * 100)

  return (
    <div className="flex flex-col gap-3">
      <SegmentedControl
        id={`${idPrefix}-metodo`}
        label="Método de pago"
        value={metodo}
        onChange={onMetodoChange}
        options={metodos}
      />

      {metodo === 'combinado' && (
        <div className="flex flex-col gap-3 rounded-lg border border-outline-variant bg-surface-container-low p-4">
          <div className="grid grid-cols-2 gap-4">
            <FormCurrencyInput
              id={`${idPrefix}-efectivo`}
              label="Importe efectivo"
              min={0}
              step="0.01"
              value={importeEfectivo}
              onChange={(e) => onImporteEfectivoChange(Number(e.target.value))}
            />
            <FormCurrencyInput
              id={`${idPrefix}-transferencia`}
              label="Importe transferencia"
              min={0}
              step="0.01"
              value={importeTransferencia}
              onChange={(e) => onImporteTransferenciaChange(Number(e.target.value))}
            />
          </div>
          <p className={`font-inter text-xs ${cuadra ? 'text-on-surface-variant' : 'text-error'}`}>
            {cuadra
              ? `Suma: $${suma.toLocaleString('es-AR')} — coincide con el total.`
              : diferencia > 0
                ? `Suma: $${suma.toLocaleString('es-AR')} — faltan $${diferencia.toLocaleString('es-AR')} para el total.`
                : `Suma: $${suma.toLocaleString('es-AR')} — sobran $${Math.abs(diferencia).toLocaleString('es-AR')} respecto al total.`}
          </p>
        </div>
      )}
    </div>
  )
}
