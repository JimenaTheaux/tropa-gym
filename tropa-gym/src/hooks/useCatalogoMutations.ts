import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

// CRUD genérico para los catálogos de Configuración (turnos, precios, combos,
// disciplinas, descuentos, profesores) — todos siguen el mismo patrón
// crear/actualizar/eliminar + invalidar su propia lista. `payload` llega tal
// cual del formulario de cada panel (misma forma que antes del insert/update
// directo a Supabase), no se agrega validación nueva.
export function useCatalogoMutations<TPayload extends object>(table: string, queryKey: QueryKey) {
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey })

  const crear = useMutation({
    mutationFn: async (payload: TPayload) => {
      const { error } = await supabase.from(table).insert(payload)
      if (error) throw new Error(error.message)
    },
    onSuccess: invalidate,
  })

  const actualizar = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: TPayload }) => {
      const { error } = await supabase.from(table).update(payload).eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: invalidate,
  })

  const eliminar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(table).delete().eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: invalidate,
  })

  return { crear, actualizar, eliminar }
}
