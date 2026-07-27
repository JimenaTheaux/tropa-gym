import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Alumno, EstadoAlumno } from '@/types/db'
import { useAuth } from '@/contexts/AuthContext'
import { marcarEstadoManual } from '@/lib/alumnos'
import { traducirError } from '@/lib/errores'
import { formatFecha } from '@/lib/utils'
import { queryKeys } from '@/lib/queryKeys'
import { Button } from '@/components/ui/button'
import { FormDateInput, FormInput } from '@/components/ui/FormField'

interface EstadoToggleButtonProps {
  alumno: Alumno
}

const ESTADO_CONFIG: Record<EstadoAlumno, { color: string; icon: string; label: string }> = {
  activo: { color: '#40e432', icon: 'check_circle', label: 'Activo' },
  inactivo: { color: '#ffb4ab', icon: 'cancel', label: 'Inactivo' },
}

function hoyIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Badge de estado como toggle — doc 08 (solo borde+icono+texto, sin fondo
// sólido), pero cliqueable para Admin/Profesor: tocarlo abre la confirmación
// para pasar al estado contrario, con la fecha desde la que rige (editable —
// permite backdatear, ej. "de baja desde el lunes") y motivo si va a
// inactivo (ver migración 11/12). El resto de los roles ve el badge de solo
// lectura, sin acción.
export function EstadoToggleButton({ alumno }: EstadoToggleButtonProps) {
  const { perfil } = useAuth()
  const puedeCambiar = perfil?.rol === 'admin' || perfil?.rol === 'profesor'
  const [modalOpen, setModalOpen] = useState(false)
  const [fecha, setFecha] = useState(hoyIso())
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const nuevoEstado: EstadoAlumno = alumno.estado === 'activo' ? 'inactivo' : 'activo'
  const cfg = ESTADO_CONFIG[alumno.estado]

  const mutar = useMutation({
    mutationFn: async () => {
      const { error } = await marcarEstadoManual(alumno.id, nuevoEstado, motivo.trim() || null, fecha)
      if (error) throw new Error(error)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.alumnos })
      queryClient.invalidateQueries({ queryKey: queryKeys.historialEstadoAlumno(alumno.id) })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
  const guardando = mutar.isPending

  function abrir() {
    setFecha(hoyIso())
    setMotivo('')
    setError(null)
    setModalOpen(true)
  }

  async function confirmar() {
    try {
      await mutar.mutateAsync()
    } catch (err) {
      setError(traducirError(err instanceof Error ? err.message : null))
      return
    }
    setModalOpen(false)
  }

  const badge = (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-inter text-xs font-medium"
      style={{ borderColor: cfg.color, color: cfg.color }}
    >
      <span className="material-symbols-outlined !text-[13px]">{cfg.icon}</span>
      {cfg.label}
    </span>
  )

  return (
    <div className="flex flex-col items-center gap-1">
      {puedeCambiar ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            abrir()
          }}
          aria-label={`Marcar como ${nuevoEstado === 'activo' ? 'Activo' : 'Inactivo'}`}
          title={`Marcar como ${nuevoEstado === 'activo' ? 'Activo' : 'Inactivo'}`}
          className="cursor-pointer transition-opacity hover:opacity-70"
        >
          {badge}
        </button>
      ) : (
        badge
      )}
      <span className="font-inter text-[11px] text-on-surface-variant">
        desde {formatFecha(alumno.estado_desde.slice(0, 10))}
      </span>

      {modalOpen &&
        createPortal(
          <div className="fixed inset-0 z-[60]" onClick={(e) => e.stopPropagation()}>
            <div className="absolute inset-0 bg-black/60" onClick={() => setModalOpen(false)} />
            <div
              role="alertdialog"
              aria-modal="true"
              aria-label={nuevoEstado === 'inactivo' ? 'Marcar como inactivo' : 'Reactivar alumno'}
              className="absolute left-1/2 top-1/2 w-[90%] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-[20px] border border-outline-variant bg-surface-container p-6"
            >
              <h2 className="font-oswald text-lg font-bold uppercase tracking-[0.02em] text-on-surface">
                {nuevoEstado === 'inactivo' ? 'Marcar como inactivo' : 'Reactivar alumno'}
              </h2>
              <p className="mt-2 font-inter text-sm text-on-surface-variant">
                {alumno.nombre} {alumno.apellido} va a quedar{' '}
                {nuevoEstado === 'inactivo' ? 'inactivo' : 'activo'}. Confirmá la fecha desde la que rige.
              </p>

              <div className="mt-4 flex flex-col gap-3">
                <FormDateInput id={`estado-fecha-${alumno.id}`} label="Desde" value={fecha} onChange={setFecha} />
                {nuevoEstado === 'inactivo' && (
                  <FormInput
                    id={`estado-motivo-${alumno.id}`}
                    label="Motivo (opcional)"
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                  />
                )}
              </div>

              {error && <p className="mt-3 font-inter text-sm text-error">{error}</p>}

              <div className="mt-6 flex justify-end gap-3">
                <Button type="button" variant="ghost" onClick={() => setModalOpen(false)} disabled={guardando}>
                  Cancelar
                </Button>
                <Button type="button" variant="solido" onClick={confirmar} disabled={guardando || !fecha}>
                  {guardando ? 'Guardando…' : 'Confirmar'}
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}
