import type { AsistenciaAlumno, Cargo, EstadoPago, MetodoPago, Pago, PagoAlumno } from '@/types/db'
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

export interface PagoCargoDetalle {
  id: string
  periodo: string
  fecha: string
  monto: number
  metodoPago: MetodoPago
  estado: EstadoPago
}

// Historial de pagos de un alumno — para el modal "Ver pagos". Con `periodo`
// queda acotado a ese período (pantalla Cargos, contrapartida de "Ver
// asistencias"); sin `periodo`, trae todo el historial del alumno (Resumen
// Mensual — Deudores/Cargos sin monto definido, donde interesa ver todos los
// pagos previos, no solo los del período que disparó la alerta).
//
// El estado es por fila, no un valor único pasado desde afuera: si la fila
// ya tiene cargo_id, se lee cargos.estado (fuente autoritativa); si no
// (pago huérfano, todavía sin cargo vinculado), se infiere agregando los
// pagos sin cargo del mismo período contra el mayor precio_snapshot visto
// entre ellos — mismo criterio que fetchHistorialPagos (lib/cuenta.ts).
export async function fetchPagosAlumnoPeriodo(alumnoId: string, periodo?: string): Promise<PagoCargoDetalle[]> {
  let query = supabase.from('pagos_alumnos').select('*').eq('alumno_id', alumnoId)
  if (periodo) query = query.eq('periodo', periodo)
  const { data: detallesData } = await query
  const detalles = (detallesData ?? []) as PagoAlumno[]
  if (detalles.length === 0) return []

  const pagoIds = [...new Set(detalles.map((d) => d.pago_id))]
  const { data: pagosData } = await supabase.from('pagos').select('*').in('id', pagoIds)
  const pagoPorId = new Map(((pagosData ?? []) as Pago[]).map((p) => [p.id, p]))

  const cargoIds = [...new Set(detalles.map((d) => d.cargo_id).filter((id): id is string => !!id))]
  let cargoPorId = new Map<string, Cargo>()
  if (cargoIds.length > 0) {
    const { data: cargosData } = await supabase.from('cargos').select('*').in('id', cargoIds)
    cargoPorId = new Map(((cargosData ?? []) as Cargo[]).map((c) => [c.id, c]))
  }

  const pagadoPorPeriodo = new Map<string, number>()
  const precioRefPorPeriodo = new Map<string, number>()
  for (const d of detalles) {
    if (d.cargo_id) continue
    pagadoPorPeriodo.set(d.periodo, (pagadoPorPeriodo.get(d.periodo) ?? 0) + Number(d.monto_pagado))
    precioRefPorPeriodo.set(d.periodo, Math.max(precioRefPorPeriodo.get(d.periodo) ?? 0, Number(d.precio_snapshot)))
  }

  return detalles
    .map((d) => {
      const pago = pagoPorId.get(d.pago_id)
      const cargo = d.cargo_id ? cargoPorId.get(d.cargo_id) : null
      const pagadoGrupo = pagadoPorPeriodo.get(d.periodo) ?? 0
      const precioRefGrupo = precioRefPorPeriodo.get(d.periodo) ?? 0
      const estado: EstadoPago = cargo
        ? cargo.estado
        : pagadoGrupo <= 0
          ? 'pendiente'
          : pagadoGrupo >= precioRefGrupo
            ? 'pagado'
            : 'parcial'
      return {
        id: d.id,
        periodo: d.periodo,
        fecha: pago?.fecha ?? d.created_at,
        monto: Number(d.monto_pagado),
        metodoPago: pago?.metodo_pago ?? 'efectivo',
        estado,
      }
    })
    .sort((a, b) => (a.fecha < b.fecha ? 1 : -1))
}

export async function marcarCargoValidado(cargoId: string, validado: boolean): Promise<{ error: string | null }> {
  const { error } = await supabase.from('cargos').update({ validado }).eq('id', cargoId)
  return { error: error?.message ?? null }
}

// Barrido manual: valida de una todos los cargos del período que ya están
// 'pagado' (coincidencia exacta o sobrepago) pero por lo que sea todavía no
// quedaron validado=true — no hace falta ir fila por fila con el checkbox.
// El trigger de base ya autovalida en el momento en que un pago deja el
// cargo en 'pagado' (ver migración 22); esto cubre el resto: cargos que ya
// estaban pagados antes de ese cambio, o cualquier caso que se haya
// escapado por una reconciliación manual fuera de la app.
export async function validarCargosPagadosDelPeriodo(
  periodo: string,
): Promise<{ error: string | null; actualizados: number }> {
  const { data, error } = await supabase
    .from('cargos')
    .update({ validado: true })
    .eq('periodo', periodo)
    .eq('estado', 'pagado')
    .eq('validado', false)
    .select('id')
  if (error) return { error: error.message, actualizados: 0 }
  return { error: null, actualizados: (data ?? []).length }
}
