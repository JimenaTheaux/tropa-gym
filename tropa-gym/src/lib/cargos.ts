import type { Cargo, TipoCargo } from '@/types/db'
import { supabase } from '@/lib/supabase'

export interface FilaCargoPreview {
  alumno_id: string
  tipo: TipoCargo
  monto: number
  ya_existe: boolean
  monto_definido: boolean
}

export async function fetchCargosPeriodo(periodo: string): Promise<Map<string, Cargo>> {
  const { data } = await supabase.from('cargos').select('*').eq('periodo', periodo)
  return new Map(((data ?? []) as Cargo[]).map((c) => [c.alumno_id, c]))
}

// Preview y confirmación comparten la misma RPC (generar_cargos_periodo) —
// p_confirmar=false no escribe nada, solo calcula qué se generaría.
export async function previewCargosPeriodo(
  periodo: string,
): Promise<{ error: string | null; filas: FilaCargoPreview[] }> {
  const { data, error } = await supabase.rpc('generar_cargos_periodo', { p_periodo: periodo, p_confirmar: false })
  if (error) return { error: error.message, filas: [] }
  return { error: null, filas: (data ?? []) as FilaCargoPreview[] }
}

export async function confirmarGeneracionCargos(
  periodo: string,
): Promise<{ error: string | null; filas: FilaCargoPreview[] }> {
  const { data, error } = await supabase.rpc('generar_cargos_periodo', { p_periodo: periodo, p_confirmar: true })
  if (error) return { error: error.message, filas: [] }
  return { error: null, filas: (data ?? []) as FilaCargoPreview[] }
}
