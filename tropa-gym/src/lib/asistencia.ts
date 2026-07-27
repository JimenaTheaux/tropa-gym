import type { AsistenciaAlumno, Alumno, Disciplina, Turno } from '@/types/db'
import { supabase } from '@/lib/supabase'
import { traducirError } from '@/lib/errores'

export interface AsistenciaConDetalle {
  id: string
  alumnoId: string
  alumnoNombre: string
  turnoId: string | null
  turnoNombre: string | null
  disciplinaId: string | null
  disciplinaNombre: string | null
  fecha: string
  hora: string
}

// Asistencias de un día, con nombre de alumno/turno/disciplina resueltos —
// insumo del listado y de la vista agrupada por turno en la pantalla de
// control (Asistencia.tsx).
export async function fetchAsistenciasPorFecha(fecha: string): Promise<AsistenciaConDetalle[]> {
  const { data, error } = await supabase
    .from('asistencias_alumnos')
    .select('*')
    .eq('fecha', fecha)
    .order('hora', { ascending: false })

  if (error || !data) return []
  const asistencias = data as AsistenciaAlumno[]
  if (asistencias.length === 0) return []

  const alumnoIds = [...new Set(asistencias.map((a) => a.alumno_id))]
  const turnoIds = [...new Set(asistencias.map((a) => a.turno_id).filter((id): id is string => !!id))]
  const disciplinaIds = [...new Set(asistencias.map((a) => a.disciplina_id).filter((id): id is string => !!id))]

  const [alumnosRes, turnosRes, disciplinasRes] = await Promise.all([
    alumnoIds.length ? supabase.from('alumnos').select('id, nombre, apellido').in('id', alumnoIds) : Promise.resolve({ data: [] }),
    turnoIds.length ? supabase.from('turnos').select('id, nombre').in('id', turnoIds) : Promise.resolve({ data: [] }),
    disciplinaIds.length
      ? supabase.from('disciplinas').select('id, nombre').in('id', disciplinaIds)
      : Promise.resolve({ data: [] }),
  ])

  const nombrePorAlumno = new Map(
    ((alumnosRes.data ?? []) as Pick<Alumno, 'id' | 'nombre' | 'apellido'>[]).map((a) => [a.id, `${a.nombre} ${a.apellido}`]),
  )
  const nombrePorTurno = new Map(((turnosRes.data ?? []) as Pick<Turno, 'id' | 'nombre'>[]).map((t) => [t.id, t.nombre]))
  const nombrePorDisciplina = new Map(
    ((disciplinasRes.data ?? []) as Pick<Disciplina, 'id' | 'nombre'>[]).map((d) => [d.id, d.nombre]),
  )

  return asistencias.map((a) => ({
    id: a.id,
    alumnoId: a.alumno_id,
    alumnoNombre: nombrePorAlumno.get(a.alumno_id) ?? '—',
    turnoId: a.turno_id,
    turnoNombre: a.turno_id ? (nombrePorTurno.get(a.turno_id) ?? '—') : null,
    disciplinaId: a.disciplina_id,
    disciplinaNombre: a.disciplina_id ? (nombrePorDisciplina.get(a.disciplina_id) ?? '—') : null,
    fecha: a.fecha,
    hora: a.hora,
  }))
}

// Solo fechas (sin hora ni disciplina) de las últimas asistencias de un
// alumno — para el historial simple que ve el propio alumno en el check-in.
export async function fetchFechasAsistencia(alumnoId: string, limit = 10): Promise<string[]> {
  const { data, error } = await supabase
    .from('asistencias_alumnos')
    .select('fecha')
    .eq('alumno_id', alumnoId)
    .order('fecha', { ascending: false })
    .limit(limit)

  if (error || !data) return []
  return [...new Set((data as { fecha: string }[]).map((d) => d.fecha))]
}

// Cantidad de asistencias de hoy por turno — insumo del contador en vivo de
// la pantalla de check-in (no cuenta las de horario libre, que no tienen turno).
export async function fetchConteoPorTurno(fecha: string): Promise<Record<string, number>> {
  const { data, error } = await supabase.from('asistencias_alumnos').select('turno_id').eq('fecha', fecha)
  if (error || !data) return {}

  const conteo: Record<string, number> = {}
  for (const row of data as { turno_id: string | null }[]) {
    if (!row.turno_id) continue
    conteo[row.turno_id] = (conteo[row.turno_id] ?? 0) + 1
  }
  return conteo
}

export interface AsistenciaInput {
  alumnoId: string
  disciplinaId: string | null
  turnoId: string | null
  fecha: string
  hora: string
}

export async function crearAsistencia(input: AsistenciaInput): Promise<{ error: string | null }> {
  const { error } = await supabase.from('asistencias_alumnos').insert({
    alumno_id: input.alumnoId,
    disciplina_id: input.disciplinaId,
    turno_id: input.turnoId,
    fecha: input.fecha,
    hora: input.hora,
  })
  return { error: error ? traducirError(error.message) : null }
}

export async function actualizarAsistencia(
  id: string,
  input: AsistenciaInput,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('asistencias_alumnos')
    .update({
      disciplina_id: input.disciplinaId,
      turno_id: input.turnoId,
      fecha: input.fecha,
      hora: input.hora,
    })
    .eq('id', id)
  return { error: error ? traducirError(error.message) : null }
}

export async function eliminarAsistencia(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('asistencias_alumnos').delete().eq('id', id)
  return { error: error ? traducirError(error.message) : null }
}
