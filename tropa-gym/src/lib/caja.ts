import type {
  AsistenciaProfesor,
  CajaResumenDia,
  CierreCajaPago,
  CierresParaVerificar,
  PagoSinCierre,
  PagosPendientesCierre,
  PreviewVerificacion,
  Profesor,
} from '@/types/db'
import { supabase } from '@/lib/supabase'
import { addDays, diaArgentino, fechaLocalISO, formatDateTimeAR, horaArgentina } from '@/lib/fecha'

export function pesos(valor: number): string {
  return `$${Number(valor).toLocaleString('es-AR', { maximumFractionDigits: 2 })}`
}

export const diaLocal = diaArgentino
export const horaLocal = horaArgentina
export const fechaHoraLocal = formatDateTimeAR
export const moverDia = addDays

// Monto tipeado en formato es-AR: "12.500,50". Sin coma, un punto es de miles
// solo si separa grupos de 3 dígitos; "12500.5" es decimal. Null si no es válido.
export function parseMontoAR(texto: string): number | null {
  const limpio = texto.trim().replace(/\s|\$/g, '')
  if (!limpio || !/^[\d.,]+$/.test(limpio)) return null
  const normal = limpio.includes(',')
    ? limpio.replace(/\./g, '').replace(',', '.')
    : /^\d{1,3}(\.\d{3})+$/.test(limpio)
      ? limpio.replace(/\./g, '')
      : limpio
  const valor = Number(normal)
  return Number.isFinite(valor) ? Math.round(valor * 100) / 100 : null
}

async function rpc<T>(funcion: string, parametros?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(funcion, parametros)
  if (error) throw new Error(error.message)
  return data as T
}

export interface ReceptoresPago {
  activos: Profesor[]
  abiertos: AsistenciaProfesor[]
}

// A diferencia de fetchProfesores, propaga el error: una lectura fallida no
// puede verse como "nadie en turno" y asignar mal la plata.
export async function fetchReceptoresPago(): Promise<ReceptoresPago> {
  const hoy = fechaLocalISO()
  const [profesores, turnos] = await Promise.all([
    supabase.from('profesores').select('*').eq('activo', true).order('apellido'),
    supabase
      .from('asistencias_profesores')
      .select('*')
      .is('hora_salida', null)
      .gte('fecha', moverDia(hoy, -1))
      .lte('fecha', hoy),
  ])
  if (profesores.error) throw new Error(profesores.error.message)
  if (turnos.error) throw new Error(turnos.error.message)
  return { activos: profesores.data as Profesor[], abiertos: turnos.data as AsistenciaProfesor[] }
}

export const fetchCajaActiva = () => rpc<boolean>('caja_modulo_activo')

export const fetchPendientesCierre = (profesorId: string) =>
  rpc<PagosPendientesCierre>('pagos_pendientes_cierre', { p_profesor_id: profesorId })

export const fetchResumenDia = (fecha: string) => rpc<CajaResumenDia>('caja_resumen_dia', { p_fecha: fecha })

export const fetchCierresParaVerificar = () => rpc<CierresParaVerificar>('cierres_para_verificar')

export const fetchPreviewVerificacion = (cierreIds: string[]) =>
  rpc<PreviewVerificacion>('preview_verificacion', { p_cierre_ids: cierreIds })

export async function fetchPagosSinCierre(): Promise<PagoSinCierre[]> {
  return (await rpc<PagoSinCierre[] | null>('pagos_sin_cierre')) ?? []
}

export async function fetchPagosEnCierre(pagoIds: string[]): Promise<string[]> {
  if (pagoIds.length === 0) return []
  return (await rpc<string[] | null>('pagos_en_cierre', { p_pago_ids: pagoIds })) ?? []
}

export async function fetchPagosDeCierre(cierreId: string): Promise<CierreCajaPago[]> {
  const { data, error } = await supabase.from('cierres_caja_pagos').select('*').eq('cierre_id', cierreId)
  if (error) throw new Error(error.message)
  return data as CierreCajaPago[]
}
