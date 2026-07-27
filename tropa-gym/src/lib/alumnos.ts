import type { Alumno, AlumnoEstadoHistorial, EstadoAlumno } from '@/types/db'
import { supabase } from '@/lib/supabase'

export async function fetchAlumnos(): Promise<Alumno[]> {
  const { data, error } = await supabase.from('alumnos').select('*').order('apellido')
  if (error) return []
  return data as Alumno[]
}

export async function fetchHistorialEstado(alumnoId: string): Promise<AlumnoEstadoHistorial[]> {
  const { data, error } = await supabase
    .from('alumno_estado_historial')
    .select('*')
    .eq('alumno_id', alumnoId)
    .order('fecha_desde', { ascending: false })
  if (error) return []
  return data as AlumnoEstadoHistorial[]
}

// Admin/Profesor fuerzan el estado a mano (licencia, lesión, pausa, etc.) —
// una asistencia real siempre lo reactiva igual (ver migración 11).
// fechaDesde (YYYY-MM-DD) permite backdatear el cambio; sin ella, es "ahora".
export async function marcarEstadoManual(
  alumnoId: string,
  estado: EstadoAlumno,
  motivo: string | null,
  fechaDesde?: string | null,
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('marcar_estado_manual', {
    p_alumno_id: alumnoId,
    p_estado: estado,
    p_motivo: motivo,
    p_fecha_desde: fechaDesde ?? null,
  })
  return { error: error?.message ?? null }
}

// Recalcula inactivaciones automáticas (25 días sin asistir) — se llama
// lazy al abrir la app, no hay cron (ver useSyncEstadosAutomaticos).
export async function syncEstadosAutomaticos(): Promise<number> {
  const { data, error } = await supabase.rpc('sync_estados_automaticos')
  if (error) return 0
  return (data ?? 0) as number
}
