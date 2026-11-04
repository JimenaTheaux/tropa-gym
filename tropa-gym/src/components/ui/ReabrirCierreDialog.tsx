import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/button'
import { FormTextarea } from '@/components/ui/FormField'

interface ReabrirCierreDialogProps {
  titulo: string
  guardando: boolean
  error: string | null
  onConfirmar: (motivo: string) => void
  onCancelar: () => void
}

// ConfirmDialog solo admite texto; acá el motivo es obligatorio.
export function ReabrirCierreDialog({ titulo, guardando, error, onConfirmar, onCancelar }: ReabrirCierreDialogProps) {
  const [motivo, setMotivo] = useState('')

  return createPortal(
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-black/60" onClick={guardando ? undefined : onCancelar} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Reabrir cierre"
        className="absolute left-1/2 top-1/2 flex w-[90%] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-[20px] border border-outline-variant bg-surface-container p-6"
      >
        <h2 className="font-oswald text-lg font-bold uppercase tracking-[0.02em] text-on-surface">Reabrir cierre</h2>
        <p className="font-inter text-sm text-on-surface-variant">
          {titulo}. Los pagos vuelven a pendientes y el profe los cierra de nuevo. Si ya estaba verificado, el lote queda
          marcado como modificado y lo contado no se recalcula.
        </p>
        <FormTextarea
          id="reabrir-motivo"
          label="Motivo (obligatorio)"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
        />
        {error && <p className="font-inter text-sm text-error">{error}</p>}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onCancelar} disabled={guardando}>
            Cancelar
          </Button>
          <Button type="button" variant="primario" disabled={guardando || !motivo.trim()} onClick={() => onConfirmar(motivo)}>
            {guardando ? 'Reabriendo…' : 'Reabrir'}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
