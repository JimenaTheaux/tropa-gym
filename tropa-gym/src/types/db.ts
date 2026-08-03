export type RolUsuario = 'admin' | 'profesor' | 'kiosco'
export type EstadoAlumno = 'activo' | 'inactivo'
export type EstadoOrigen = 'automatico' | 'manual'

export interface Perfil {
  id: string
  nombre: string
  rol: RolUsuario
}

export interface Turno {
  id: string
  nombre: string
  hora: string
  activo: boolean
  created_at: string
}

export type TurnoInsert = Omit<Turno, 'id' | 'created_at'>
export type TurnoUpdate = Partial<TurnoInsert>

export interface Disciplina {
  id: string
  nombre: string
  activo: boolean
  horario_libre: boolean
  created_at: string
}

export type DisciplinaInsert = Omit<Disciplina, 'id' | 'created_at'>
export type DisciplinaUpdate = Partial<DisciplinaInsert>

export interface Combo {
  id: string
  nombre: string
  frecuencia_semanal: number
  activo: boolean
  created_at: string
}

export type ComboInsert = Omit<Combo, 'id' | 'created_at'>
export type ComboUpdate = Partial<ComboInsert>

export interface Precio {
  id: string
  combo_id: string
  vigente_desde: string
  monto: number
  created_at: string
}

export type PrecioInsert = Omit<Precio, 'id' | 'created_at'>
export type PrecioUpdate = Partial<PrecioInsert>

export type TipoAjuste = 'descuento' | 'recargo'

export interface Descuento {
  id: string
  nombre: string
  descripcion: string | null
  porcentaje: number
  tipo: TipoAjuste
  created_at: string
}

export type DescuentoInsert = Omit<Descuento, 'id' | 'created_at'>
export type DescuentoUpdate = Partial<DescuentoInsert>

export interface Profesor {
  id: string
  nombre: string
  apellido: string
  perfil_id: string | null
  created_at: string
}

export type ProfesorInsert = Omit<Profesor, 'id' | 'created_at'>
export type ProfesorUpdate = Partial<ProfesorInsert>

export interface Alumno {
  id: string
  nombre: string
  apellido: string
  dni: string
  telefono: string | null
  fecha_nacimiento: string | null
  disciplina_id: string | null
  combo_id: string | null
  estado: EstadoAlumno
  estado_origen: EstadoOrigen
  estado_motivo: string | null
  estado_desde: string
  fecha_alta: string
  created_at: string
}

export type AlumnoInsert = Omit<
  Alumno,
  'id' | 'created_at' | 'fecha_alta' | 'estado' | 'estado_origen' | 'estado_motivo' | 'estado_desde'
>
export type AlumnoUpdate = Partial<AlumnoInsert>

export interface AlumnoEstadoHistorial {
  id: string
  alumno_id: string
  estado: EstadoAlumno
  origen: EstadoOrigen
  motivo: string | null
  fecha_desde: string
  creado_por: string | null
  created_at: string
}

export interface AsistenciaAlumno {
  id: string
  alumno_id: string
  turno_id: string | null
  disciplina_id: string | null
  fecha: string
  hora: string
  created_at: string
}

export type AsistenciaAlumnoInsert = Omit<AsistenciaAlumno, 'id' | 'created_at'>

export interface AsistenciaProfesor {
  id: string
  profesor_id: string
  fecha: string
  hora_entrada: string
  hora_salida: string | null
  created_at: string
}

export type AsistenciaProfesorInsert = Omit<AsistenciaProfesor, 'id' | 'created_at'>

export interface Egreso {
  id: string
  concepto: string
  monto: number
  fecha: string
  categoria: string
  created_at: string
}

export type EgresoInsert = Omit<Egreso, 'id' | 'created_at'>
export type EgresoUpdate = Partial<EgresoInsert>

export type TipoCargo = 'completa' | 'media'

export type EstadoPago = 'pendiente' | 'parcial' | 'pagado'

export interface Cargo {
  id: string
  alumno_id: string
  periodo: string
  tipo: TipoCargo
  monto: number
  monto_definido: boolean
  estado: EstadoPago
  created_at: string
}

export type MetodoPago = 'efectivo' | 'transferencia' | 'combinado'
export type TipoPago = 'individual' | 'familiar' | 'adelantado'

export interface Pago {
  id: string
  tipo_pago: TipoPago
  metodo_pago: MetodoPago
  importe_efectivo: number
  importe_transferencia: number
  total: number
  fecha: string
  created_at: string
}

export interface PagoAlumno {
  id: string
  pago_id: string
  alumno_id: string
  cargo_id: string | null
  periodo: string
  disciplina_id: string
  combo_id: string
  descuento_id: string | null
  precio_snapshot: number
  monto_pagado: number
  created_at: string
}
