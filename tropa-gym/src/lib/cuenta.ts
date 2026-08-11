import type { Alumno, Cargo, EstadoPago, MetodoPago, Pago, PagoAlumno, TipoPago } from '@/types/db'
import { supabase } from '@/lib/supabase'

export interface PeriodoCuenta {
  periodo: string
  cargoId: string | null
  cargoMonto: number
  cargoMontoDefinido: boolean
  pagado: number
  saldo: number
  estado: EstadoPago
}

export interface EstadoCuenta {
  periodos: PeriodoCuenta[]
  saldoTotal: number
}

// Saldo por período. El estado (pendiente/parcial/pagado) vive en cargos.estado
// (trigger recalcula por acumulado de pagos_alumnos.monto_pagado, doc 03) — acá
// solo se lee, no se recalcula. Períodos sin cargo (ej. adelantado a futuro, o
// cualquier período pagado antes de que Admin corra "Generar cargos") no
// tienen estado autoritativo: se infiere igual que en fetchHistorialPagos,
// comparando lo pagado contra el mayor precio_snapshot visto en ese período
// (si hubiera más de un pago). Antes acá se asumía "pagado" apenas pagado>0,
// sin contemplar 'parcial' — mostraba saldo a favor falso en cualquier pago
// parcial de un período sin cargo todavía.
export async function getEstadoCuenta(alumnoId: string): Promise<EstadoCuenta> {
  const [cargosRes, pagosRes] = await Promise.all([
    supabase.from('cargos').select('*').eq('alumno_id', alumnoId),
    supabase.from('pagos_alumnos').select('*').eq('alumno_id', alumnoId),
  ])

  const cargos = (cargosRes.data ?? []) as Cargo[]
  const pagosAlumnos = (pagosRes.data ?? []) as PagoAlumno[]

  const cargoPorPeriodo = new Map<string, Cargo>()
  for (const c of cargos) {
    cargoPorPeriodo.set(c.periodo, c)
  }

  const pagadoPorPeriodo = new Map<string, number>()
  const precioRefPorPeriodo = new Map<string, number>()
  for (const p of pagosAlumnos) {
    pagadoPorPeriodo.set(p.periodo, (pagadoPorPeriodo.get(p.periodo) ?? 0) + Number(p.monto_pagado))
    const precioSnapshot = Number(p.precio_snapshot)
    precioRefPorPeriodo.set(p.periodo, Math.max(precioRefPorPeriodo.get(p.periodo) ?? 0, precioSnapshot))
  }

  const periodos: PeriodoCuenta[] = [...new Set([...cargoPorPeriodo.keys(), ...pagadoPorPeriodo.keys()])]
    .sort()
    .map((periodo) => {
      const cargo = cargoPorPeriodo.get(periodo) ?? null
      const pagado = pagadoPorPeriodo.get(periodo) ?? 0
      const cargoMonto = cargo ? Number(cargo.monto) : (precioRefPorPeriodo.get(periodo) ?? 0)
      const saldo = cargoMonto - pagado
      const estado: EstadoPago = cargo
        ? cargo.estado
        : pagado <= 0
          ? 'pendiente'
          : pagado >= cargoMonto
            ? 'pagado'
            : 'parcial'
      return {
        periodo,
        cargoId: cargo?.id ?? null,
        cargoMonto,
        cargoMontoDefinido: cargo?.monto_definido ?? true,
        pagado,
        saldo,
        estado,
      }
    })

  const saldoTotal = periodos.reduce((sum, p) => sum + p.saldo, 0)

  return { periodos, saldoTotal }
}

export interface HistorialAlumnoItem {
  id: string
  fecha: string
  periodo: string
  monto: number
  metodoPago: MetodoPago
}

// Historial de pagos de un alumno (uno por línea de pagos_alumnos) — orden desc por fecha del pago.
export async function fetchHistorialAlumno(alumnoId: string, limit = 20): Promise<HistorialAlumnoItem[]> {
  const { data: detallesData } = await supabase.from('pagos_alumnos').select('*').eq('alumno_id', alumnoId)
  const detalles = (detallesData ?? []) as PagoAlumno[]
  if (detalles.length === 0) return []

  const pagoIds = [...new Set(detalles.map((d) => d.pago_id))]
  const { data: pagosData } = await supabase.from('pagos').select('*').in('id', pagoIds)
  const pagoPorId = new Map(((pagosData ?? []) as Pago[]).map((p) => [p.id, p]))

  return detalles
    .map((d) => {
      const pago = pagoPorId.get(d.pago_id)
      return {
        id: d.id,
        fecha: pago?.fecha ?? d.created_at,
        periodo: d.periodo,
        monto: Number(d.monto_pagado),
        metodoPago: pago?.metodo_pago ?? 'efectivo',
      }
    })
    .sort((a, b) => (a.fecha < b.fecha ? 1 : -1))
    .slice(0, limit)
}

export interface HistorialPagoDetalle {
  id: string // pagos_alumnos.id — unidad editable
  pagoId: string
  fecha: string
  tipoPago: TipoPago
  metodoPago: MetodoPago
  alumnoId: string
  alumnoNombre: string
  alumno: Alumno | null
  periodo: string
  disciplinaId: string
  comboId: string
  descuentoId: string | null
  cargoId: string | null
  cargoMonto: number | null
  montoPagado: number
  precioSnapshot: number
  estado: EstadoPago
}

// Últimos pagos registrados, a nivel detalle (1 fila = 1 alumno + 1 período)
// — un comprobante familiar/adelantado se ve como varias filas. Necesario
// para poder editar y mostrar estado por alumno (el estado es del cargo,
// no del comprobante, y un comprobante puede mezclar alumnos en distinto
// estado). El estado se lee de cargos.estado; si el detalle no tiene
// cargo_id (ej. adelantado a futuro sin cargo generado) se infiere
// comparando monto_pagado contra precio_snapshot.
export async function fetchHistorialPagos(limit = 15): Promise<HistorialPagoDetalle[]> {
  const { data: pagosData } = await supabase.from('pagos').select('*').order('fecha', { ascending: false }).limit(limit)
  const pagos = (pagosData ?? []) as Pago[]
  if (pagos.length === 0) return []

  const pagoIds = pagos.map((p) => p.id)
  const pagoPorId = new Map(pagos.map((p) => [p.id, p]))

  const { data: detallesData } = await supabase.from('pagos_alumnos').select('*').in('pago_id', pagoIds)
  const detalles = (detallesData ?? []) as PagoAlumno[]

  const alumnoIds = [...new Set(detalles.map((d) => d.alumno_id))]
  const { data: alumnosData } = await supabase.from('alumnos').select('*').in('id', alumnoIds)
  const alumnoPorId = new Map(((alumnosData ?? []) as Alumno[]).map((a) => [a.id, a]))

  const cargoIds = [...new Set(detalles.map((d) => d.cargo_id).filter((id): id is string => !!id))]
  let cargoPorId = new Map<string, Cargo>()
  if (cargoIds.length > 0) {
    const { data: cargosData } = await supabase.from('cargos').select('*').in('id', cargoIds)
    cargoPorId = new Map(((cargosData ?? []) as Cargo[]).map((c) => [c.id, c]))
  }

  return detalles
    .map((d) => {
      const pago = pagoPorId.get(d.pago_id)
      const cargo = d.cargo_id ? cargoPorId.get(d.cargo_id) ?? null : null
      const montoPagado = Number(d.monto_pagado)
      const precioSnapshot = Number(d.precio_snapshot)
      const estado: EstadoPago = cargo
        ? cargo.estado
        : montoPagado <= 0
          ? 'pendiente'
          : montoPagado >= precioSnapshot
            ? 'pagado'
            : 'parcial'
      const alumno = alumnoPorId.get(d.alumno_id) ?? null
      return {
        id: d.id,
        pagoId: d.pago_id,
        fecha: pago?.fecha ?? d.created_at,
        tipoPago: pago?.tipo_pago ?? 'individual',
        metodoPago: pago?.metodo_pago ?? 'efectivo',
        alumnoId: d.alumno_id,
        alumnoNombre: alumno ? `${alumno.nombre} ${alumno.apellido}` : '—',
        alumno,
        periodo: d.periodo,
        disciplinaId: d.disciplina_id,
        comboId: d.combo_id,
        descuentoId: d.descuento_id,
        cargoId: d.cargo_id,
        cargoMonto: cargo ? Number(cargo.monto) : null,
        montoPagado,
        precioSnapshot,
        estado,
      }
    })
    .sort((a, b) => (a.fecha < b.fecha ? 1 : -1))
}

export async function buscarCargo(alumnoId: string, periodo: string): Promise<Cargo | null> {
  const { data, error } = await supabase
    .from('cargos')
    .select('*')
    .eq('alumno_id', alumnoId)
    .eq('periodo', periodo)
    .maybeSingle()
  if (error) return null
  return data as Cargo | null
}

export interface ResumenCargo {
  monto: number
  pagado: number
  saldo: number
}

// Monto del cargo y TODO lo ya pagado (suma de todos sus pagos, no solo el
// de la fila que se está completando) — se consulta al vuelo al abrir
// "Completar pago" para no depender de un agregado potencialmente incompleto.
export async function fetchResumenCargo(cargoId: string): Promise<ResumenCargo> {
  const [{ data: cargoData }, { data: pagosData }] = await Promise.all([
    supabase.from('cargos').select('monto').eq('id', cargoId).maybeSingle(),
    supabase.from('pagos_alumnos').select('monto_pagado').eq('cargo_id', cargoId),
  ])
  const monto = cargoData ? Number(cargoData.monto) : 0
  const pagado = ((pagosData ?? []) as { monto_pagado: number }[]).reduce((s, p) => s + Number(p.monto_pagado), 0)
  return { monto, pagado, saldo: monto - pagado }
}
