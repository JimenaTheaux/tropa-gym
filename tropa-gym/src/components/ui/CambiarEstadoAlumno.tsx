import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Alumno } from '@/types/db'
import { marcarEstadoManual } from '@/lib/alumnos'
import { traducirError } from '@/lib/errores'
import { queryKeys } from '@/lib/queryKeys'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { FormInput } from '@/components/ui/FormField'

interface CambiarEstadoAlumnoProps {
  alumno: Alumno
}

// Marcar el estado a mano (Admin/Profesor, ver migración 11) — licencia,
// lesión, pausa acordada, etc. Una asistencia real siempre reactiva igual,
// aunque la baja haya sido manual (RN confirmada con el usuario: el estado
// activo es lo que hace que el alumno se siga considerando para la deuda).
export function CambiarEstadoAlumno({ alumno }: CambiarEstadoAlumnoProps) {
  const [abierto, setAbierto] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [confirmando, setConfirmando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const nuevoEstado = alumno.estado === 'activo' ? 'inactivo' : 'activo'

  const mutar = useMutation({
    mutationFn: async () => {
      const { error } = await marcarEstadoManual(alumno.id, nuevoEstado, motivo.trim() || null)
      if (error) throw new Error(error)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.alumnos })
      queryClient.invalidateQueries({ queryKey: queryKeys.historialEstadoAlumno(alumno.id) })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
  const guardando = mutar.isPending

  function cerrar() {
    setAbierto(false)
    setMotivo('')
    setError(null)
  }

  async function confirmar() {
    try {
      await mutar.mutateAsync()
    } catch (err) {
      setConfirmando(false)
      setError(traducirError(err instanceof Error ? err.message : null))
      return
    }
    setConfirmando(false)
    cerrar()
  }

  if (!abierto) {
    return (
      <Button type="button" variant="ghost" onClick={() => setAbierto(true)}>
        {nuevoEstado === 'inactivo' ? 'Marcar como inactivo' : 'Reactivar'}
      </Button>
    )
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-outline-variant bg-surface-container-low p-3">
      <FormInput
        id={`estado-motivo-${alumno.id}`}
        label={nuevoEstado === 'inactivo' ? 'Motivo (ej. licencia, lesión)' : 'Motivo (opcional)'}
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
      />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={cerrar} disabled={guardando}>
          Cancelar
        </Button>
        <Button type="button" variant="solido" onClick={() => setConfirmando(true)} disabled={guardando}>
          Guardar
        </Button>
      </div>
      {error && <p className="font-inter text-sm text-error">{error}</p>}

      <ConfirmDialog
        open={confirmando}
        title={nuevoEstado === 'inactivo' ? 'Marcar como inactivo' : 'Reactivar alumno'}
        message={
          nuevoEstado === 'inactivo'
            ? `${alumno.nombre} ${alumno.apellido} va a quedar marcado como inactivo a mano. Sigue así hasta que lo reactives o vuelva a registrar una asistencia. ¿Confirmás?`
            : `${alumno.nombre} ${alumno.apellido} va a quedar marcado como activo. ¿Confirmás?`
        }
        confirmLabel="Confirmar"
        loading={guardando}
        onConfirm={confirmar}
        onCancel={() => setConfirmando(false)}
      />
    </div>
  )
}
