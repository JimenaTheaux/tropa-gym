import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { syncEstadosAutomaticos } from '@/lib/alumnos'
import { queryKeys } from '@/lib/queryKeys'
import { STALE_SYNC_ESTADOS } from '@/lib/queryClient'

// Dispara la inactivación automática (25 días sin asistir) al abrir la app,
// sin depender de un cron — ver migración 11. staleTime de 1h evita repetir
// la llamada en cada navegación dentro de la misma sesión.
export function useSyncEstadosAutomaticos() {
  const queryClient = useQueryClient()

  const { data: cambios } = useQuery({
    queryKey: queryKeys.syncEstadosAutomaticos,
    queryFn: syncEstadosAutomaticos,
    staleTime: STALE_SYNC_ESTADOS,
  })

  useEffect(() => {
    if (!cambios) return
    queryClient.invalidateQueries({ queryKey: queryKeys.alumnos })
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  }, [cambios, queryClient])
}
