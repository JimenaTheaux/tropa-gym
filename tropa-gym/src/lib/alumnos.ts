import type { Alumno } from '@/types/db'
import { supabase } from '@/lib/supabase'

export async function fetchAlumnos(): Promise<Alumno[]> {
  const { data, error } = await supabase.from('alumnos').select('*').order('apellido')
  if (error) return []
  return data as Alumno[]
}
