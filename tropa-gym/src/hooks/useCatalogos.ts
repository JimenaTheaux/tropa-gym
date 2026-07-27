import { useQuery } from '@tanstack/react-query'
import {
  fetchCombos,
  fetchDescuentos,
  fetchPerfilesProfesores,
  fetchProfesores,
  fetchTurnos,
  fetchTurnosActivos,
} from '@/lib/catalogos'
import { fetchCombosActivos, fetchDisciplinasActivas, fetchPrecios } from '@/lib/precios'
import { fetchDisciplinas } from '@/lib/catalogos'
import { queryKeys } from '@/lib/queryKeys'
import { STALE_CATALOGO } from '@/lib/queryClient'

// Catálogos: turnos, precios, combos, disciplinas, descuentos, profesores —
// cambian poco, staleTime largo (doc pwa-performance-supabase). Se comparten
// entre todas las pantallas que los usan (Pagos, Asistencia, Configuración),
// así una sola request alimenta a todas mientras esté "fresh".
export function useTurnos() {
  return useQuery({ queryKey: queryKeys.turnos, queryFn: fetchTurnos, staleTime: STALE_CATALOGO })
}

export function useTurnosActivos() {
  return useQuery({ queryKey: queryKeys.turnosActivos, queryFn: fetchTurnosActivos, staleTime: STALE_CATALOGO })
}

export function useDisciplinas() {
  return useQuery({ queryKey: queryKeys.disciplinas, queryFn: fetchDisciplinas, staleTime: STALE_CATALOGO })
}

export function useDisciplinasActivas() {
  return useQuery({
    queryKey: queryKeys.disciplinasActivas,
    queryFn: fetchDisciplinasActivas,
    staleTime: STALE_CATALOGO,
  })
}

export function useCombos() {
  return useQuery({ queryKey: queryKeys.combos, queryFn: fetchCombos, staleTime: STALE_CATALOGO })
}

export function useCombosActivos() {
  return useQuery({ queryKey: queryKeys.combosActivos, queryFn: fetchCombosActivos, staleTime: STALE_CATALOGO })
}

export function usePrecios() {
  return useQuery({ queryKey: queryKeys.precios, queryFn: fetchPrecios, staleTime: STALE_CATALOGO })
}

export function useDescuentos() {
  return useQuery({ queryKey: queryKeys.descuentos, queryFn: fetchDescuentos, staleTime: STALE_CATALOGO })
}

export function useProfesores(perfilId?: string) {
  return useQuery({
    queryKey: queryKeys.profesores(perfilId),
    queryFn: () => fetchProfesores(perfilId),
    staleTime: STALE_CATALOGO,
  })
}

export function usePerfilesProfesores() {
  return useQuery({
    queryKey: queryKeys.perfilesProfesores,
    queryFn: fetchPerfilesProfesores,
    staleTime: STALE_CATALOGO,
  })
}
