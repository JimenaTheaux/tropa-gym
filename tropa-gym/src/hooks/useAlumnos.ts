import { useQuery } from '@tanstack/react-query'
import { fetchAlumnos } from '@/lib/alumnos'
import { queryKeys } from '@/lib/queryKeys'
import { STALE_OPERATIVO } from '@/lib/queryClient'

export function useAlumnos() {
  return useQuery({ queryKey: queryKeys.alumnos, queryFn: fetchAlumnos, staleTime: STALE_OPERATIVO })
}
