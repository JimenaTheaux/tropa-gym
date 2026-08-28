import type {
  Alumno,
  AlumnoEstadoHistorial,
  AsistenciaAlumno,
  AsistenciaProfesor,
  Cargo,
  Egreso,
  EstadoAlumno,
  EstadoPago,
  Pago,
  PagoAlumno,
  Profesor,
  Turno,
} from '@/types/db'
import { supabase } from '@/lib/supabase'
import { whatsappLink } from '@/lib/utils'

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
  ingresos: number
  ingresosEfectivo: number
  ingresosTransferencia: number
  saldoACobrar: number
  egresos: number
  gananciaNeta: number
}

export interface TrendPoint {
  periodo: string
  gananciaNeta: number
  alumnosActivos: number
  alumnosInactivos: number
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

  const { data } = await supabase
    .from('alumno_estado_historial')
    .select('alumno_id, estado, fecha_desde')
    .order('fecha_desde', { ascending: true })

  const historial = (data ?? []) as Pick<AlumnoEstadoHistorial, 'alumno_id' | 'estado' | 'fecha_desde'>[]

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
}

async function saldoACobrarPorAlumno(periodo: string): Promise<number> {
  const [cargosRes, pagosRes] = await Promise.all([
    supabase.from('cargos').select('*').eq('periodo', periodo),
    supabase.from('pagos_alumnos').select('*').eq('periodo', periodo),
  ])
  const cargos = (cargosRes.data ?? []) as Cargo[]
  const pagos = (pagosRes.data ?? []) as PagoAlumno[]

  const cargoPorAlumno = new Map<string, number>()
  for (const c of cargos) {
    cargoPorAlumno.set(c.alumno_id, (cargoPorAlumno.get(c.alumno_id) ?? 0) + Number(c.monto))
  }
  const pagadoPorAlumno = new Map<string, number>()
  for (const p of pagos) {
    pagadoPorAlumno.set(p.alumno_id, (pagadoPorAlumno.get(p.alumno_id) ?? 0) + Number(p.monto_pagado))
  }

  let total = 0
  for (const [alumnoId, monto] of cargoPorAlumno) {
    const saldo = monto - (pagadoPorAlumno.get(alumnoId) ?? 0)
    if (saldo > 0) total += saldo
  }
  return total
}

export async function fetchKpiCards(periodo: string): Promise<KpiCards> {
  const desde = inicioDeMes(periodo)
  const hasta = primerDiaSiguiente(periodo)

  const [pagosRes, egresosRes, estados, saldoACobrar] = await Promise.all([
    supabase
      .from('pagos')
      .select('total, importe_efectivo, importe_transferencia')
      .gte('fecha', desde)
      .lt('fecha', hasta),
    supabase.from('egresos').select('monto').gte('fecha', desde).lt('fecha', hasta),
    fetchEstadoAlumnosPorPeriodo(periodo, 1),
    saldoACobrarPorAlumno(periodo),
  ])

  const pagos = (pagosRes.data ?? []) as Pick<Pago, 'total' | 'importe_efectivo' | 'importe_transferencia'>[]
  const ingresos = pagos.reduce((s, p) => s + Number(p.total), 0)
  const ingresosEfectivo = pagos.reduce((s, p) => s + Number(p.importe_efectivo), 0)
  const ingresosTransferencia = pagos.reduce((s, p) => s + Number(p.importe_transferencia), 0)
  const egresos = ((egresosRes.data ?? []) as Pick<Egreso, 'monto'>[]).reduce((s, e) => s + Number(e.monto), 0)
  const alumnosActivos = estados[0]?.activos ?? 0

  return {
    alumnosActivos,
    ingresos,
    ingresosEfectivo,
    ingresosTransferencia,
    saldoACobrar,
    egresos,
    gananciaNeta: ingresos - egresos,
  }
}

export async function fetchTrend(hastaPeriodo: string, cantidad = 6): Promise<TrendPoint[]> {
  const periodos = listaPeriodos(hastaPeriodo, cantidad)
  const desde = inicioDeMes(periodos[0])
  const hasta = primerDiaSiguiente(periodos[periodos.length - 1])

  const [pagosRes, egresosRes, estados] = await Promise.all([
    supabase.from('pagos').select('total, fecha').gte('fecha', desde).lt('fecha', hasta),
    supabase.from('egresos').select('monto, fecha').gte('fecha', desde).lt('fecha', hasta),
    fetchEstadoAlumnosPorPeriodo(hastaPeriodo, cantidad),
  ])

  const mesDe = (fecha: string) => fecha.slice(0, 7)

  const ingresosPorMes = new Map<string, number>()
  for (const p of (pagosRes.data ?? []) as { total: number; fecha: string }[]) {
    const m = mesDe(p.fecha)
    ingresosPorMes.set(m, (ingresosPorMes.get(m) ?? 0) + Number(p.total))
  }
  const egresosPorMes = new Map<string, number>()
  for (const e of (egresosRes.data ?? []) as { monto: number; fecha: string }[]) {
    const m = mesDe(e.fecha)
    egresosPorMes.set(m, (egresosPorMes.get(m) ?? 0) + Number(e.monto))
  }
  const estadosPorMes = new Map(estados.map((e) => [e.periodo, e]))

  return periodos.map((periodo) => ({
    periodo,
    gananciaNeta: (ingresosPorMes.get(periodo) ?? 0) - (egresosPorMes.get(periodo) ?? 0),
    alumnosActivos: estadosPorMes.get(periodo)?.activos ?? 0,
    alumnosInactivos: estadosPorMes.get(periodo)?.inactivos ?? 0,
  }))
}

export async function fetchTopHorarios(periodo: string, top = 5): Promise<HorarioOcupacion[]> {
  const desde = inicioDeMes(periodo)
  const hasta = primerDiaSiguiente(periodo)

  const [asistenciasRes, turnosRes] = await Promise.all([
    supabase.from('asistencias_alumnos').select('turno_id').gte('fecha', desde).lt('fecha', hasta),
    supabase.from('turnos').select('*'),
  ])

  const turnos = (turnosRes.data ?? []) as Turno[]
  const conteo = new Map<string, number>()
  for (const a of (asistenciasRes.data ?? []) as Pick<AsistenciaAlumno, 'turno_id'>[]) {
    if (!a.turno_id) continue // horario libre (ej. Musculación) — no cuenta como ocupación de un turno fijo
    conteo.set(a.turno_id, (conteo.get(a.turno_id) ?? 0) + 1)
  }

  return [...conteo.entries()]
    .map(([turnoId, cantidad]) => {
      const t = turnos.find((tu) => tu.id === turnoId)
      const nombre = t ? `${t.nombre} (${t.hora.slice(0, 5)})` : turnoId
      return { turnoId, nombre, cantidad }
    })
    .sort((a, b) => b.cantidad - a.cantidad)
    .slice(0, top)
}

// ---- Centro de Resumen Mensual ----

export interface Deudor {
  alumno: Alumno
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
}

export interface AlertasResumen {
  deudores: Deudor[]
  proximosInactivarse: ProximoInactivo[]
  horasProfesor: HorasProfesorFila[]
  cargosSinDefinir: CargoSinDefinir[]
}

function diasEntre(desde: string, hasta: Date): number {
  const d1 = new Date(`${desde}T00:00:00`)
  return Math.floor((hasta.getTime() - d1.getTime()) / 86_400_000)
}

async function fetchDeudores(alumnos: Alumno[]): Promise<Deudor[]> {
  const [cargosRes, pagosRes] = await Promise.all([
    supabase.from('cargos').select('*'),
    supabase.from('pagos_alumnos').select('*'),
  ])
  const cargos = (cargosRes.data ?? []) as Cargo[]
  const pagos = (pagosRes.data ?? []) as PagoAlumno[]

  // saldo y período más antiguo con deuda, por alumno — RN: deuda es acumulada (doc 03)
  const cargosPorAlumno = new Map<string, Cargo[]>()
  for (const c of cargos) {
    if (!cargosPorAlumno.has(c.alumno_id)) cargosPorAlumno.set(c.alumno_id, [])
    cargosPorAlumno.get(c.alumno_id)!.push(c)
  }
  const pagadoPorAlumnoPeriodo = new Map<string, number>()
  for (const p of pagos) {
    const key = `${p.alumno_id}::${p.periodo}`
    pagadoPorAlumnoPeriodo.set(key, (pagadoPorAlumnoPeriodo.get(key) ?? 0) + Number(p.monto_pagado))
  }

  const hoy = new Date()
  const deudores: Deudor[] = []

  for (const [alumnoId, cargosAlumno] of cargosPorAlumno) {
    let saldo = 0
    let cargoMasAntiguoConDeuda: Cargo | null = null
    for (const c of [...cargosAlumno].sort((a, b) => (a.periodo < b.periodo ? -1 : 1))) {
      const pagado = pagadoPorAlumnoPeriodo.get(`${alumnoId}::${c.periodo}`) ?? 0
      const saldoPeriodo = Number(c.monto) - pagado
      if (saldoPeriodo > 0) {
        saldo += saldoPeriodo
        if (!cargoMasAntiguoConDeuda) cargoMasAntiguoConDeuda = c
      }
    }
    if (saldo > 0 && cargoMasAntiguoConDeuda) {
      const alumno = alumnos.find((a) => a.id === alumnoId)
      if (!alumno) continue
      deudores.push({
        alumno,
        monto: saldo,
        diasVencimiento: Math.max(0, diasEntre(finDeMes(cargoMasAntiguoConDeuda.periodo), hoy)),
        estado: cargoMasAntiguoConDeuda.estado,
      })
    }
  }

  return deudores.sort((a, b) => b.diasVencimiento - a.diasVencimiento)
}

async function fetchProximosInactivarse(alumnos: Alumno[]): Promise<ProximoInactivo[]> {
  const activos = alumnos.filter((a) => a.estado === 'activo')
  if (activos.length === 0) return []

  const { data } = await supabase
    .from('asistencias_alumnos')
    .select('alumno_id, fecha')
    .in(
      'alumno_id',
      activos.map((a) => a.id),
    )

  const ultimaPorAlumno = new Map<string, string>()
  for (const row of (data ?? []) as Pick<AsistenciaAlumno, 'alumno_id' | 'fecha'>[]) {
    const actual = ultimaPorAlumno.get(row.alumno_id)
    if (!actual || row.fecha > actual) ultimaPorAlumno.set(row.alumno_id, row.fecha)
  }

  const hoy = new Date()
  const resultado: ProximoInactivo[] = []
  for (const alumno of activos) {
    const ultima = ultimaPorAlumno.get(alumno.id)
    if (!ultima) continue
    const dias = diasEntre(ultima, hoy)
    if (dias >= 15 && dias < 25) {
      resultado.push({ alumno, diasSinAsistir: dias })
    }
  }
  return resultado.sort((a, b) => b.diasSinAsistir - a.diasSinAsistir)
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

  const horasPorProfesor = new Map<string, number>()
  const conteoPorProfesor = new Map<string, number>()
  for (const a of asistencias) {
    conteoPorProfesor.set(a.profesor_id, (conteoPorProfesor.get(a.profesor_id) ?? 0) + 1)
    if (a.hora_salida) {
      const entrada = new Date(`1970-01-01T${a.hora_entrada}`).getTime()
      const salida = new Date(`1970-01-01T${a.hora_salida}`).getTime()
      const horas = Math.max(0, (salida - entrada) / 3_600_000)
      horasPorProfesor.set(a.profesor_id, (horasPorProfesor.get(a.profesor_id) ?? 0) + horas)
    }
  }

  return profesores
    .map((profesor) => ({
      profesor,
      horas: Math.round((horasPorProfesor.get(profesor.id) ?? 0) * 10) / 10,
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
      return { cargoId: c.id, alumno, periodo: c.periodo, tipo: c.tipo, monto: Number(c.monto) }
    })
    .filter((c): c is CargoSinDefinir => c !== null)
}

export async function fetchAlertasResumen(periodo: string): Promise<AlertasResumen> {
  const { data: alumnosData } = await supabase.from('alumnos').select('*')
  const alumnos = (alumnosData ?? []) as Alumno[]

  const [deudores, proximosInactivarse, horasProfesor, cargosSinDefinir] = await Promise.all([
    fetchDeudores(alumnos),
    fetchProximosInactivarse(alumnos),
    fetchHorasProfesor(periodo),
    fetchCargosSinDefinir(periodo, alumnos),
  ])

  return { deudores, proximosInactivarse, horasProfesor, cargosSinDefinir }
}
