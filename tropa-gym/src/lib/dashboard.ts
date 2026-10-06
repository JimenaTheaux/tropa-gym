import type {
  Alumno,
  AlumnoEstadoHistorial,
  AsistenciaProfesor,
  Cargo,
  EstadoAlumno,
  EstadoPago,
  Profesor,
} from '@/types/db'
import { supabase } from '@/lib/supabase'
import { fetchAllPages } from '@/lib/fetchAllPages'
import { whatsappLink } from '@/lib/utils'
import { calcularMinutosTrabajados } from '@/lib/horasProfesor'

// ---- Período (YYYY-MM) — helpers ----

export function periodoActual(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function inicioDeMes(periodo: string): string {
  return `${periodo}-01`
}

export function finDeMes(periodo: string): string {
  const [anio, mes] = periodo.split('-').map(Number)
  const ultimoDia = new Date(anio, mes, 0).getDate()
  return `${periodo}-${String(ultimoDia).padStart(2, '0')}`
}

export function primerDiaSiguiente(periodo: string): string {
  const [anio, mes] = periodo.split('-').map(Number)
  const d = new Date(anio, mes, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

export function addMeses(periodo: string, delta: number): string {
  const [anio, mes] = periodo.split('-').map(Number)
  const d = new Date(anio, mes - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

export function periodoLabel(periodo: string): string {
  const [anio, mes] = periodo.split('-').map(Number)
  return `${MESES_CORTOS[mes - 1]} ${String(anio).slice(2)}`
}

function listaPeriodos(hasta: string, cantidad: number): string[] {
  const lista: string[] = []
  for (let i = cantidad - 1; i >= 0; i--) lista.push(addMeses(hasta, -i))
  return lista
}

// ---- Teléfono / WhatsApp — doc 06: internacional sin símbolos ----
// Misma normalización que CumpleanosPanel (whatsappLink en utils.ts): antes
// esta validación exigía sólo dígitos (`/^\d{8,15}$/`) mientras whatsappLink
// ya limpiaba símbolos, así que un teléfono cargado con espacios o guiones
// quedaba con el botón deshabilitado acá pero funcionaba en Cumpleaños.

export function telefonoWhatsappValido(telefono: string | null | undefined): boolean {
  if (!telefono) return false
  const digitos = telefono.replace(/\D/g, '')
  return digitos.length >= 8 && digitos.length <= 15
}

export function whatsappUrl(telefono: string): string {
  return whatsappLink(telefono)
}

// ---- KPI ----

export interface KpiCards {
  alumnosActivos: number
  alumnosConAsistencia: number
  ingresos: number
  ingresosEfectivo: number
  ingresosTransferencia: number
  saldoACobrar: number
  egresos: number
  gananciaNeta: number
}

export interface TrendPoint {
  periodo: string
  /** Mes actual, todavía no cerrado. */
  enCurso: boolean
  gananciaNeta: number
  /** Alumnos distintos con >= 1 asistencia en el mes (cualquier estado). */
  conAsistencia: number
  /** Alumnos activos HOY sin ninguna asistencia en el mes. */
  sinAsistencia: number
  /** Alumnos activos HOY (padrón vigente) — base de "sin asistencia". */
  baseActivos: number
}

export interface EstadoPeriodoPoint {
  periodo: string
  activos: number
  inactivos: number
}

// Punto-en-el-tiempo: estado vigente de cada alumno al cierre de cada
// período (o "hoy" si el período todavía no cerró) — reconstruido desde
// alumno_estado_historial (migración 11), no desde asistencias. Un alumno
// sin ninguna fila de historial con fecha_desde <= corte todavía no existía
// en ese período y no cuenta ni como activo ni como inactivo.
export async function fetchEstadoAlumnosPorPeriodo(
  hastaPeriodo: string,
  cantidad = 6,
): Promise<EstadoPeriodoPoint[]> {
  const periodos = listaPeriodos(hastaPeriodo, cantidad)

  // Paginado explícito: Supabase corta en 1000 filas por default (db-max-rows).
  // Sin esto, una vez que el historial supera esa marca se pierden las filas
  // más nuevas (quedan último en el orden ascendente por fecha_desde) y el
  // estado "vigente" reconstruido queda desactualizado.
  const historial: Pick<AlumnoEstadoHistorial, 'alumno_id' | 'estado' | 'fecha_desde'>[] = []
  const PAGE_SIZE = 1000
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data } = await supabase
      .from('alumno_estado_historial')
      .select('alumno_id, estado, fecha_desde')
      .order('fecha_desde', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)
    const pagina = (data ?? []) as Pick<AlumnoEstadoHistorial, 'alumno_id' | 'estado' | 'fecha_desde'>[]
    historial.push(...pagina)
    if (pagina.length < PAGE_SIZE) break
  }

  const porAlumno = new Map<string, { estado: EstadoAlumno; fecha_desde: Date }[]>()
  for (const h of historial) {
    if (!porAlumno.has(h.alumno_id)) porAlumno.set(h.alumno_id, [])
    porAlumno.get(h.alumno_id)!.push({ estado: h.estado, fecha_desde: new Date(h.fecha_desde) })
  }

  const hoy = new Date()

  return periodos.map((periodo) => {
    const finPeriodo = new Date(`${primerDiaSiguiente(periodo)}T00:00:00`)
    const corte = finPeriodo < hoy ? finPeriodo : hoy

    let activos = 0
    let inactivos = 0
    for (const eventos of porAlumno.values()) {
      let vigente: EstadoAlumno | null = null
      for (const e of eventos) {
        if (e.fecha_desde <= corte) vigente = e.estado
        else break
      }
      if (vigente === 'activo') activos++
      else if (vigente === 'inactivo') inactivos++
    }
    return { periodo, activos, inactivos }
  })
}

export interface HorarioOcupacion {
  turnoId: string
  nombre: string
  cantidad: number
  dias: number
  promedio: number
}

/** Bajo este umbral de días con clase, el promedio se muestra igual pero marcado como poco representativo. */
export const DIAS_MINIMOS_PROMEDIO_CONFIABLE = 3

interface FinanzasMes {
  ingresos: number
  ingresosEfectivo: number
  ingresosTransferencia: number
  egresos: number
}

// Ingresos/egresos agregados por mes en la base (migración 29): pagos.fecha
// se lleva a día argentino ahí (fn_fecha_pago_local), no con slice() sobre
// el ISO en UTC, y no hay corte a 1000 filas.
async function fetchFinanzasPorMes(desde: string, hasta: string): Promise<Map<string, FinanzasMes>> {
  const { data, error } = await supabase.rpc('dashboard_finanzas_por_mes', { p_desde: desde, p_hasta: hasta })
  if (error) throw new Error(error.message)
  return new Map(
    ((data ?? []) as {
      periodo: string
      ingresos: number
      ingresos_efectivo: number
      ingresos_transferencia: number
      egresos: number
    }[]).map((f) => [
      f.periodo,
      {
        ingresos: Number(f.ingresos),
        ingresosEfectivo: Number(f.ingresos_efectivo),
        ingresosTransferencia: Number(f.ingresos_transferencia),
        egresos: Number(f.egresos),
      },
    ]),
  )
}

// Σ por alumno de max(0, cargos.monto − pagos del mismo período), en la base
// (migración 30). Misma base de saldo que fetchDeudores
// (dashboard_saldo_alumno_periodo) — no pueden diferir.
async function saldoACobrarPorAlumno(periodo: string): Promise<number> {
  const { data, error } = await supabase.rpc('dashboard_saldo_a_cobrar', { p_periodo: periodo })
  if (error) throw new Error(error.message)
  return Number(data ?? 0)
}

export async function fetchKpiCards(periodo: string): Promise<KpiCards> {
  const desde = inicioDeMes(periodo)
  const hasta = primerDiaSiguiente(periodo)

  const [finanzasPorMes, estados, saldoACobrar, conAsistenciaRes] = await Promise.all([
    // Misma RPC que el gráfico de ganancia neta (migración 29) — no pueden diferir.
    fetchFinanzasPorMes(desde, hasta),
    fetchEstadoAlumnosPorPeriodo(periodo, 1),
    saldoACobrarPorAlumno(periodo),
    // count(distinct alumno_id) en la base (migración 28), sin traer filas.
    supabase.rpc('dashboard_alumnos_con_asistencia', { p_desde: desde, p_hasta: hasta }),
  ])
  if (conAsistenciaRes.error) throw new Error(conAsistenciaRes.error.message)

  const finanzas = finanzasPorMes.get(periodo)
  const ingresos = finanzas?.ingresos ?? 0
  const ingresosEfectivo = finanzas?.ingresosEfectivo ?? 0
  const ingresosTransferencia = finanzas?.ingresosTransferencia ?? 0
  const egresos = finanzas?.egresos ?? 0
  const alumnosActivos = estados[0]?.activos ?? 0

  return {
    alumnosActivos,
    alumnosConAsistencia: Number(conAsistenciaRes.data ?? 0),
    ingresos,
    ingresosEfectivo,
    ingresosTransferencia,
    saldoACobrar,
    egresos,
    gananciaNeta: ingresos - egresos,
  }
}

// Rango: hasta el período filtrado (nunca más allá del mes actual), máximo
// `cantidad` meses hacia atrás, y sin los meses anteriores a la primera
// asistencia registrada — antes de eso el sistema no se usaba y "0 con / N
// sin asistencia" no significa nada. Recortar los meses iniciales con
// con_asistencia = 0 equivale a arrancar en min(asistencias_alumnos.fecha).
export async function fetchTrend(hastaPeriodo: string, cantidad = 6): Promise<TrendPoint[]> {
  const actual = periodoActual()
  const hasta = hastaPeriodo > actual ? actual : hastaPeriodo
  const periodos = listaPeriodos(hasta, cantidad)
  const desde = inicioDeMes(periodos[0])
  const fin = primerDiaSiguiente(periodos[periodos.length - 1])

  const [finanzasPorMes, asistenciaRes] = await Promise.all([
    fetchFinanzasPorMes(desde, fin),
    // Una sola consulta agrupada por mes para todo el rango (migración 28).
    supabase.rpc('dashboard_asistencia_por_mes', { p_desde: desde, p_hasta: fin }),
  ])
  if (asistenciaRes.error) throw new Error(asistenciaRes.error.message)

  const asistenciaPorMes = new Map(
    ((asistenciaRes.data ?? []) as {
      periodo: string
      con_asistencia: number
      sin_asistencia: number
      base_activos: number
    }[]).map((a) => [a.periodo, a]),
  )

  const puntos = periodos.map((periodo) => {
    const f = finanzasPorMes.get(periodo)
    return {
      periodo,
      enCurso: periodo === actual,
      gananciaNeta: (f?.ingresos ?? 0) - (f?.egresos ?? 0),
      conAsistencia: asistenciaPorMes.get(periodo)?.con_asistencia ?? 0,
      sinAsistencia: asistenciaPorMes.get(periodo)?.sin_asistencia ?? 0,
      baseActivos: asistenciaPorMes.get(periodo)?.base_activos ?? 0,
    }
  })
  const primeroConUso = puntos.findIndex((p) => p.conAsistencia > 0)
  return primeroConUso === -1 ? [] : puntos.slice(primeroConUso)
}

// Agregado en la base (migración 29): conteo y días distintos por turno, top
// ya recortado — horario libre (turno_id nulo) excluido ahí, como antes.
export async function fetchTopHorarios(periodo: string, top = 5): Promise<HorarioOcupacion[]> {
  const { data, error } = await supabase.rpc('dashboard_top_horarios', {
    p_desde: inicioDeMes(periodo),
    p_hasta: primerDiaSiguiente(periodo),
    p_top: top,
  })
  if (error) throw new Error(error.message)

  return (
    (data ?? []) as {
      turno_id: string
      nombre: string | null
      hora: string | null
      cantidad: number
      dias: number
      promedio: number
    }[]
  ).map((h) => ({
    turnoId: h.turno_id,
    nombre: h.nombre ? `${h.nombre}${h.hora ? ` (${h.hora.slice(0, 5)})` : ''}` : h.turno_id,
    cantidad: Number(h.cantidad),
    dias: Number(h.dias),
    promedio: Number(h.promedio),
  }))
}

// ---- Centro de Resumen Mensual ----

export interface Deudor {
  alumno: Alumno
  cargoId: string
  periodo: string
  cargoMonto: number
  monto: number
  diasVencimiento: number
  estado: EstadoPago
}

export interface ProximoInactivo {
  alumno: Alumno
  diasSinAsistir: number
}

export interface HorasProfesorFila {
  profesor: Profesor
  horas: number
  asistencias: number
}

export interface CargoSinDefinir {
  cargoId: string
  alumno: Alumno
  periodo: string
  tipo: Cargo['tipo']
  monto: number
  estado: EstadoPago
}

export interface AlertasResumen {
  deudores: Deudor[]
  proximosInactivarse: ProximoInactivo[]
  horasProfesor: HorasProfesorFila[]
  cargosSinDefinir: CargoSinDefinir[]
  alumnosSinCargo: Alumno[]
}

// Deuda acumulada (todos los períodos, doc 03), calculada en la base
// (migración 30): por alumno, Σ max(0, cargo − pagos del mismo período),
// cargo/período más antiguo con saldo y días desde el fin de ese período.
// Ya viene ordenada por días de vencimiento desc.
async function fetchDeudores(alumnoPorId: Map<string, Alumno>): Promise<Deudor[]> {
  const { data, error } = await supabase.rpc('dashboard_deudores')
  if (error) throw new Error(error.message)

  const deudores: Deudor[] = []
  for (const d of (data ?? []) as {
    alumno_id: string
    cargo_id: string
    periodo: string
    cargo_monto: number
    saldo: number
    dias_vencimiento: number
    estado: EstadoPago
  }[]) {
    const alumno = alumnoPorId.get(d.alumno_id)
    if (!alumno) continue
    deudores.push({
      alumno,
      cargoId: d.cargo_id,
      periodo: d.periodo,
      cargoMonto: Number(d.cargo_monto),
      monto: Number(d.saldo),
      diasVencimiento: Number(d.dias_vencimiento),
      estado: d.estado,
    })
  }
  return deudores
}

// RN-004: activos con la última asistencia (max(fecha) en la base, migración
// 30) hace 15 a 24 días. Sin ninguna asistencia: no aparecen. Ya viene
// ordenada por días sin asistir desc.
async function fetchProximosInactivarse(alumnoPorId: Map<string, Alumno>): Promise<ProximoInactivo[]> {
  const { data, error } = await supabase.rpc('dashboard_proximos_inactivarse')
  if (error) throw new Error(error.message)

  const resultado: ProximoInactivo[] = []
  for (const p of (data ?? []) as { alumno_id: string; dias_sin_asistir: number }[]) {
    const alumno = alumnoPorId.get(p.alumno_id)
    if (alumno) resultado.push({ alumno, diasSinAsistir: Number(p.dias_sin_asistir) })
  }
  return resultado
}

async function fetchHorasProfesor(periodo: string): Promise<HorasProfesorFila[]> {
  const desde = inicioDeMes(periodo)
  const hasta = primerDiaSiguiente(periodo)

  const [profesoresRes, asistenciasRes] = await Promise.all([
    supabase.from('profesores').select('*').order('apellido'),
    supabase
      .from('asistencias_profesores')
      .select('*')
      .gte('fecha', desde)
      .lt('fecha', hasta),
  ])

  const profesores = (profesoresRes.data ?? []) as Profesor[]
  const asistencias = (asistenciasRes.data ?? []) as AsistenciaProfesor[]

  const minutosPorProfesor = new Map<string, number>()
  const conteoPorProfesor = new Map<string, number>()
  for (const a of asistencias) {
    conteoPorProfesor.set(a.profesor_id, (conteoPorProfesor.get(a.profesor_id) ?? 0) + 1)
    if (a.hora_salida) {
      const { minutosRedondeados } = calcularMinutosTrabajados(a.hora_entrada, a.hora_salida)
      minutosPorProfesor.set(a.profesor_id, (minutosPorProfesor.get(a.profesor_id) ?? 0) + minutosRedondeados)
    }
  }

  return profesores
    .map((profesor) => ({
      profesor,
      // Horas completas: la suma de minutos (ya redondeados por registro)
      // se redondea a la hora entera para el resumen mensual.
      horas: Math.round((minutosPorProfesor.get(profesor.id) ?? 0) / 60),
      asistencias: conteoPorProfesor.get(profesor.id) ?? 0,
    }))
    .filter((f) => f.asistencias > 0)
    .sort((a, b) => b.horas - a.horas)
}

// Cargos generados sin poder resolver combo/precio (RN-030) — ver doc 03,
// "Cargo con monto sin definir". No entran en fetchDeudores por saldo (su
// monto es $0 hasta que se definan), así que necesitan su propia alerta.
async function fetchCargosSinDefinir(periodo: string, alumnos: Alumno[]): Promise<CargoSinDefinir[]> {
  const { data } = await supabase
    .from('cargos')
    .select('*')
    .eq('periodo', periodo)
    .eq('monto_definido', false)
  const cargos = (data ?? []) as Cargo[]

  return cargos
    .map((c) => {
      const alumno = alumnos.find((a) => a.id === c.alumno_id)
      if (!alumno) return null
      return { cargoId: c.id, alumno, periodo: c.periodo, tipo: c.tipo, monto: Number(c.monto), estado: c.estado }
    })
    .filter((c): c is CargoSinDefinir => c !== null)
}

// Alumnos activos sin ningún cargo en el período — con el trigger de cargos
// continuos (migración 22) un cargo existe apenas hay una asistencia, así que
// "sin cargo" equivale a "sin asistencia registrada este período todavía".
// El filtro corre en la base (migración 30), sin mandar ids por la URL.
async function fetchAlumnosSinCargo(periodo: string, alumnoPorId: Map<string, Alumno>): Promise<Alumno[]> {
  const { data, error } = await supabase.rpc('dashboard_alumnos_sin_cargo', { p_periodo: periodo })
  if (error) throw new Error(error.message)
  return ((data ?? []) as { alumno_id: string }[])
    .map((r) => alumnoPorId.get(r.alumno_id))
    .filter((a): a is Alumno => !!a)
}

export async function fetchAlertasResumen(periodo: string): Promise<AlertasResumen> {
  const { data: alumnos, error: alumnosError } = await fetchAllPages<Alumno>((from, to) =>
    supabase.from('alumnos').select('*').order('id').range(from, to),
  )
  if (alumnosError) throw new Error(alumnosError)
  const alumnoPorId = new Map(alumnos.map((a) => [a.id, a]))

  const [deudores, proximosInactivarse, horasProfesor, cargosSinDefinir, alumnosSinCargo] = await Promise.all([
    fetchDeudores(alumnoPorId),
    fetchProximosInactivarse(alumnoPorId),
    fetchHorasProfesor(periodo),
    fetchCargosSinDefinir(periodo, alumnos),
    fetchAlumnosSinCargo(periodo, alumnoPorId),
  ])

  return { deudores, proximosInactivarse, horasProfesor, cargosSinDefinir, alumnosSinCargo }
}
