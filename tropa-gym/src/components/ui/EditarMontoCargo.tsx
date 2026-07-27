import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { traducirError } from '@/lib/errores'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { FormCurrencyInput } from '@/components/ui/FormField'

interface EditarMontoCargoProps {
  cargoId: string
  montoActual: number
  label?: string
  confirmMessage?: string
  onGuardado: () => void
  onCancelar?: () => void
}

// Bloque reutilizable para editar cargos.monto (excepción — Admin/Profesor,
// doc 02). El UPDATE dispara solo el trigger que recalcula estado y marca
// monto_definido = true (migración 02/05) — acá no se hace nada de eso.
export function EditarMontoCargo({
  cargoId,
  montoActual,
  label = 'Monto',
  confirmMessage,
  onGuardado,
  onCancelar,
}: EditarMontoCargoProps) {
  const [monto, setMonto] = useState(montoActual)
  const [confirmando, setConfirmando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const actualizar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('cargos').update({ monto }).eq('id', cargoId)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      // El monto de un cargo afecta su propio estado, el estado de cuenta
      // del alumno y cualquier preview/alerta de dashboard que lo liste.
      queryClient.invalidateQueries({ queryKey: ['cargos'] })
      queryClient.invalidateQueries({ queryKey: ['cuenta'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
  const guardando = actualizar.isPending

  async function confirmar() {
    try {
      await actualizar.mutateAsync()
    } catch (err) {
      setConfirmando(false)
      setError(traducirError(err instanceof Error ? err.message : null))
      return
    }
    setConfirmando(false)
    onGuardado()
  }

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-outline-variant bg-surface-container-low p-3">
      <FormCurrencyInput
        id={`editar-monto-cargo-${cargoId}`}
        label={label}
        min={0}
        step="0.01"
        value={monto}
        onChange={(e) => setMonto(Number(e.target.value))}
      />
      <div className="flex gap-2">
        {onCancelar && (
          <Button type="button" variant="ghost" onClick={onCancelar} disabled={guardando}>
            Cancelar
          </Button>
        )}
        <Button type="button" variant="solido" disabled={guardando || monto <= 0} onClick={() => setConfirmando(true)}>
          Guardar
        </Button>
      </div>
      {error && <p className="w-full font-inter text-sm text-error">{error}</p>}

      <ConfirmDialog
        open={confirmando}
        title="Editar monto del cargo"
        message={
          confirmMessage ??
          `Vas a fijar el monto en $${monto.toLocaleString('es-AR')}. Esto recalcula el estado del cargo. ¿Confirmás?`
        }
        confirmLabel="Confirmar"
        loading={guardando}
        onConfirm={confirmar}
        onCancel={() => setConfirmando(false)}
      />
    </div>
  )
}
