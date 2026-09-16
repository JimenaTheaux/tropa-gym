import type { AsistenciaAlumno, Cargo } from '@/types/db'
import { supabase } from '@/lib/supabase'

// Cargo continuo (migración 22): ya no hay preview/confirmación por lote —
// cargos.* se lee en vivo, se actualiza solo con cada asistencia/pago
// (triggers de base) y esta pantalla solo edita monto/validado puntuales.
export async function fetchCargosPeriodo(periodo: string): Promise<Map<string, Cargo>> {
  const { data } = await supabase.from('cargos').select('*').eq('periodo', periodo)
  return new Map(((data ?? []) as Cargo[]).map((c) => [c.alumno_id, c]))
}

export async function fetchAsistenciasAlumnoPeriodo(alumnoId: string, periodo: string): Promise<AsistenciaAlumno[]> {
  const { data } = await supabase
    .from('asistencias_alumnos')
    .select('*')
    .eq('alumno_id', alumnoId)
    .gte('fecha', `${periodo}-01`)
    .lt('fecha', primerDiaSiguiente(periodo))
    .order('fecha')
  return (data ?? []) as AsistenciaAlumno[]
}

function primerDiaSiguiente(periodo: string): string {
  const [anio, mes] = periodo.split('-').map(Number)
  const d = new Date(anio, mes, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

export interface SemanaAsistencias {
  semana: number // 1 = días 1-7, 2 = 8-14, etc. (semana calendario del mes, no ISO)
  cantidad: number
}

// Resumen agrupado por semana del mes para el modal "Ver asistencias" — no
// usa semana ISO a propósito: el período es un mes calendario, así que
// "semana 1/2/3/4" del mes es más legible para el staff que un número de
// semana ISO que no coincide con el arranque del período.
export function agruparAsistenciasPorSemana(asistencias: AsistenciaAlumno[]): SemanaAsistencias[] {
  const conteoPorSemana = new Map<number, number>()
  for (const a of asistencias) {
    const dia = Number(a.fecha.slice(8, 10))
    const semana = Math.ceil(dia / 7)
    conteoPorSemana.set(semana, (conteoPorSemana.get(semana) ?? 0) + 1)
  }
  return [...conteoPorSemana.entries()]
    .sort(([a], [b]) => a - b)
    .map(([semana, cantidad]) => ({ semana, cantidad }))
}

export async function marcarCargoValidado(cargoId: string, validado: boolean): Promise<{ error: string | null }> {
  const { error } = await supabase.from('cargos').update({ validado }).eq('id', cargoId)
  return { error: error?.message ?? null }
}
