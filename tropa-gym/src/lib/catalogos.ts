import type { Descuento, Disciplina, Combo, Perfil, Profesor, Turno, TipoPago } from '@/types/db'
import { supabase } from '@/lib/supabase'

export async function fetchTurnos(): Promise<Turno[]> {
  const { data, error } = await supabase.from('turnos').select('*').order('hora')
  if (error) return []
  return data as Turno[]
}

export async function fetchTurnosActivos(): Promise<Turno[]> {
  const { data, error } = await supabase.from('turnos').select('*').eq('activo', true).order('hora')
  if (error) return []
  return data as Turno[]
}

export async function fetchDisciplinas(): Promise<Disciplina[]> {
  const { data, error } = await supabase.from('disciplinas').select('*').order('nombre')
  if (error) return []
  return data as Disciplina[]
}

export async function fetchCombos(): Promise<Combo[]> {
  const { data, error } = await supabase.from('combos').select('*').order('frecuencia_semanal')
  if (error) return []
  return data as Combo[]
}

export async function fetchDescuentos(): Promise<Descuento[]> {
  const { data, error } = await supabase.from('descuentos').select('*').order('nombre')
  if (error) return []
  return data as Descuento[]
}

// Filtra el catálogo de descuentos/recargos para un selector de pago puntual
// (Individual/Familiar/Adelantado) — un ajuste restringido a un tipo no debe
// aparecer en los otros dos.
export function descuentosParaTipo(descuentos: Descuento[], tipo: TipoPago): Descuento[] {
  return descuentos.filter((d) => d.aplica_a.includes(tipo))
}

export async function fetchProfesores(perfilId?: string): Promise<Profesor[]> {
  let query = supabase.from('profesores').select('*').order('apellido')
  if (perfilId) query = query.eq('perfil_id', perfilId)
  const { data, error } = await query
  if (error) return []
  return data as Profesor[]
}

export async function fetchPerfilesProfesores(): Promise<Perfil[]> {
  const { data, error } = await supabase.from('perfiles').select('id, nombre, rol').eq('rol', 'profesor')
  if (error) return []
  return data as Perfil[]
}
