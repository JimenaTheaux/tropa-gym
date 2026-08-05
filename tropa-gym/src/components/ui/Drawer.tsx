import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface DrawerProps {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  size?: 'md' | 'lg'
}

// Ancho en desktop: 'md' (480px, default) para forms simples de un solo
// alumno; 'lg' (720px) para forms que necesitan más aire (grillas de
// checkboxes, filas de varios campos) — ej. RegistrarPagoDrawer. En mobile
// ambos se comportan igual (full width).
const SIZE_CLASS: Record<'md' | 'lg', string> = {
  md: 'lg:w-[480px]',
  lg: 'lg:w-[720px]',
}

export function Drawer({ open, title, onClose, children, footer, size = 'md' }: DrawerProps) {
  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`absolute inset-x-0 bottom-0 flex max-h-[90vh] w-full flex-col rounded-t-card border-t border-outline-variant bg-surface-container lg:inset-x-auto lg:inset-y-0 lg:left-1/2 lg:top-1/2 lg:bottom-auto lg:h-auto lg:max-h-[85vh] ${SIZE_CLASS[size]} lg:-translate-x-1/2 lg:-translate-y-1/2 lg:rounded-[20px] lg:border`}
      >
        <div className="flex items-center justify-between border-b border-outline-variant px-6 py-4">
          <h2 className="font-oswald text-lg font-bold uppercase tracking-[0.02em] text-on-surface">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="text-on-surface-variant hover:text-on-surface"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>

        {footer && (
          <div className="flex justify-end gap-3 border-t border-outline-variant px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
