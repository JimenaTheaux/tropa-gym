import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/button'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Eliminar',
  loading,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-black/60" onClick={onCancel} />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        className="absolute left-1/2 top-1/2 w-[90%] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-[20px] border border-outline-variant bg-surface-container p-6"
      >
        <h2 className="font-oswald text-lg font-bold uppercase tracking-[0.02em] text-on-surface">
          {title}
        </h2>
        <p className="mt-2 font-inter text-sm text-on-surface-variant">{message}</p>

        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={loading}>
            Cancelar
          </Button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-error-container bg-error-container px-4 py-2 font-oswald text-[13px] font-semibold uppercase tracking-[0.03em] text-on-error-container transition-colors hover:opacity-90 disabled:pointer-events-none disabled:opacity-50"
          >
            {loading ? 'Eliminando…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
