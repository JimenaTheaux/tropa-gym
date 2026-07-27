import { useEffect, useRef, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

const REINTENTO_MS = 15_000

// Campos de texto activos o un Drawer/ConfirmDialog abierto (ambos usan
// role="dialog"/"alertdialog") indican una operación en curso — no hay
// usuarios externos (doc pwa-performance-supabase), así que se puede
// recargar solo apenas quede libre, sin pedirle confirmación a nadie.
function hayOperacionEnCurso(): boolean {
  if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return true
  const activo = document.activeElement
  if (!activo) return false
  const tag = activo.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

export function PwaUpdater() {
  const [avisoVisible, setAvisoVisible] = useState(false)
  const reintentoRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      // Chequea cada hora si hay una versión nueva — cubre las pestañas que
      // quedan abiertas todo el día en la PC del gym / tablet kiosco.
      if (!registration) return
      setInterval(() => registration.update(), 60 * 60 * 1000)
    },
  })

  useEffect(() => {
    if (!needRefresh) return

    function intentarRecargar() {
      if (hayOperacionEnCurso()) {
        setAvisoVisible(true)
        return
      }
      updateServiceWorker(true)
    }

    intentarRecargar()
    reintentoRef.current = setInterval(intentarRecargar, REINTENTO_MS)
    return () => {
      if (reintentoRef.current) clearInterval(reintentoRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needRefresh])

  if (!avisoVisible) return null

  return (
    <div className="fixed bottom-4 left-1/2 z-[70] flex -translate-x-1/2 items-center gap-3 rounded-lg border border-outline-variant bg-surface-container-highest px-4 py-3 shadow-lg">
      <span className="font-inter text-sm text-on-surface">Hay una versión nueva disponible.</span>
      <button
        type="button"
        onClick={() => updateServiceWorker(true)}
        className="rounded-lg border border-primary bg-surface-container-high px-3 py-1.5 font-oswald text-xs font-semibold uppercase tracking-[0.03em] text-primary hover:bg-surface-container-highest"
      >
        Recargar ahora
      </button>
    </div>
  )
}
