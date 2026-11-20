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
  aplica_a: TipoPago[]
  created_at: string
}

export type DescuentoInsert = Omit<Descuento, 'id' | 'created_at'>
export type DescuentoUpdate = Partial<DescuentoInsert>

export interface Profesor {
  id: string
  nombre: string
  apellido: string
  perfil_id: string | null
  activo: boolean
  created_at: string
}

export type ProfesorInsert = Omit<Profesor, 'id' | 'created_at' | 'activo'> & { activo?: boolean }
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
  observaciones: string | null
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
  validado: boolean
  /** Monto fijado por una persona (migración 39): un pago nuevo no lo pisa. */
  monto_manual: boolean
  estado: EstadoPago
  created_at: string
}

export type MetodoPago = 'efectivo' | 'transferencia' | 'combinado'
export type TipoPago = 'individual' | 'familiar' | 'adelantado'
export type RecibioTipo = 'admin' | 'profesor'

export interface Pago {
  id: string
  tipo_pago: TipoPago
  metodo_pago: MetodoPago
  importe_efectivo: number
  importe_transferencia: number
  total: number
  fecha: string
  created_at: string
  recibio_tipo: RecibioTipo | null
  recibio_profesor_id: string | null
  cargado_por: string | null
  request_id: string | null
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

// Cierre de caja (migraciones 35 a 37). Las tablas solo se leen como admin; toda
// escritura pasa por RPC.
export type EstadoCierre = 'cerrado' | 'verificado' | 'reabierto'
export type EventoCierre = 'reabierto' | 'modificado_post_cierre' | 'verificado'

export interface ConfigCaja {
  id: boolean
  fecha_arranque: string | null
  updated_at: string
  updated_by: string | null
}

export interface CierreCaja {
  id: string
  profesor_id: string
  asistencia_profesor_id: string | null
  turno_inicio: string | null
  turno_fin: string | null
  efectivo_sistema: number
  efectivo_declarado: number
  diferencia: number
  coincide: boolean
  observacion: string | null
  transferencias_sistema: number
  cantidad_pagos: number
  estado: EstadoCierre
  modificado: boolean
  verificacion_id: string | null
  cerrado_en: string
  created_by: string
}

export interface CierreCajaPago {
  id: string
  cierre_id: string
  pago_id: string | null
  pago_id_original: string
  efectivo: number
  transferencia: number
  total: number
  descripcion: string | null
}

export interface VerificacionCaja {
  id: string
  verificado_por: string
  verificado_en: string
  efectivo_esperado: number
  efectivo_contado: number
  diferencia: number
  nota: string | null
  transferencias_controladas: boolean
  modificado: boolean
}

export interface VerificacionCajaPago {
  id: string
  verificacion_id: string
  pago_id: string | null
  pago_id_original: string
  efectivo: number
}

export interface CierreCajaEvento {
  id: string
  cierre_id: string | null
  verificacion_id: string | null
  evento: EventoCierre
  usuario: string | null
  motivo: string | null
  payload: Record<string, unknown>
  ocurrido_en: string
}

// Parámetros nuevos de registrar_pago_individual/familiar/adelantado.
export interface PagoReceptorParams {
  p_recibio_tipo?: RecibioTipo | null
  p_recibio_profesor_id?: string | null
  p_request_id?: string | null
}

export interface CerrarCajaTurnoParams {
  p_profesor_id: string
  p_asistencia_id: string | null
  p_pago_ids: string[]
  p_coincide: boolean
  p_efectivo_declarado: number | null
  p_observacion: string | null
}

export interface VerificarCierresParams {
  p_cierre_ids: string[]
  p_efectivo_contado: number
  p_nota: string | null
  p_transferencias_controladas: boolean
}

export interface AsignarReceptorPagoParams {
  p_pago_id: string
  p_recibio_tipo: RecibioTipo
  p_recibio_profesor_id: string | null
}

// Devoluciones de las RPC de caja.
export interface PagoPendienteCierre {
  id: string
  created_at: string
  fecha: string
  tipo_pago: TipoPago
  metodo_pago: MetodoPago
  importe_efectivo: number
  importe_transferencia: number
  total: number
  descripcion: string | null
  fecha_distinta: boolean
}

export interface PagosPendientesCierre {
  activo: boolean
  pagos: PagoPendienteCierre[]
  cantidad: number
  total_efectivo: number
  total_transferencia: number
  huerfanos: number
}

export interface CierreResumen {
  cierre_id: string
  profesor_id: string
  profesor: string
  turno_inicio: string | null
  turno_fin: string | null
  cerrado_en: string
  efectivo_sistema: number
  efectivo_declarado: number
  diferencia: number
  transferencias_sistema: number
  cantidad_pagos: number
  observacion: string | null
  modificado: boolean
}

export interface CajaResumenDia {
  activo: boolean
  fecha: string
  cierres: (CierreResumen & { coincide: boolean; estado: EstadoCierre })[]
  cobros_dueno: { cantidad: number; efectivo: number; transferencias: number }
  totales: { efectivo: number; transferencias: number; total: number }
  por_receptor: {
    recibio_tipo: RecibioTipo | null
    profesor_id: string | null
    profesor: string | null
    cantidad: number
    efectivo: number
    transferencias: number
  }[]
  sin_cierre: {
    pago_id: string
    created_at: string
    recibio_tipo: RecibioTipo | null
    profesor_id: string | null
    profesor: string | null
    metodo_pago: MetodoPago
    importe_efectivo: number
    importe_transferencia: number
    total: number
    descripcion: string | null
  }[]
  huerfanos: number
}

export interface CobroDuenoPendiente {
  pago_id: string
  created_at: string
  efectivo: number
  descripcion: string | null
}

export interface CierresParaVerificar {
  activo: boolean
  cierres: CierreResumen[]
  cobros_dueno: { efectivo: number; pagos: CobroDuenoPendiente[] }
  avisos: {
    turnos_abiertos: {
      asistencia_id: string
      profesor_id: string
      profesor: string
      fecha: string
      hora_entrada: string | null
    }[]
    profes_con_pagos_sin_cerrar: {
      profesor_id: string
      profesor: string
      cantidad: number
      efectivo: number
      desde: string
    }[]
  }
}

export interface PreviewVerificacion {
  cierres: {
    cierre_id: string
    profesor_id: string
    profesor: string
    cerrado_en: string
    efectivo_sistema: number
    efectivo_declarado: number
    diferencia: number
    modificado: boolean
  }[]
  suma_declarado: number
  cobros_dueno: CobroDuenoPendiente[]
  suma_cobros_dueno: number
  efectivo_esperado: number
  corte: string
}

export interface ResultadoVerificacion {
  verificacion_id: string
  efectivo_esperado: number
  efectivo_contado: number
  diferencia: number
}

export interface PagoSinCierre {
  grupo: 'sin_receptor' | 'pendiente_cierre'
  pago_id: string
  created_at: string
  fecha: string
  tipo_pago: TipoPago
  metodo_pago: MetodoPago
  importe_efectivo: number
  importe_transferencia: number
  total: number
  descripcion: string | null
  profesor_id: string | null
  profesor: string | null
  antiguedad_dias: number
}
