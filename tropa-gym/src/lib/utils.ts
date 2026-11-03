import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Formatea fecha ISO (YYYY-MM-DD) a formato argentino dd-MM-AAAA
export function formatFecha(fecha: string): string {
  const [y, m, d] = fecha.split('-')
  return `${d}-${m}-${y}`
}

// Fecha local de hoy en ISO (YYYY-MM-DD) — a diferencia de
// `new Date().toISOString()`, no se corre de día cerca de medianoche en
// zonas con offset negativo (UTC-3).
export function hoyIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Link directo al chat de WhatsApp, con mensaje opcional. Asume Argentina: si
// el teléfono no trae código de país, antepone 54 9 (celular).
export function whatsappLink(telefono: string, mensaje?: string): string {
  const digitos = telefono.replace(/\D/g, '')
  const numero = digitos.startsWith('54') ? digitos : `549${digitos.replace(/^0/, '')}`
  return `https://wa.me/${numero}${mensaje ? `?text=${encodeURIComponent(mensaje)}` : ''}`
}

const MESES_LARGOS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

// 'YYYY-MM' → "noviembre 2026"
export function periodoLargo(periodo: string): string {
  const [anio, mes] = periodo.split('-').map(Number)
  return `${MESES_LARGOS[mes - 1]} ${anio}`
}

function pesos(v: number): string {
  return `$${Math.round(v).toLocaleString('es-AR')}`
}

// Texto precargado del WhatsApp de Deudores: siempre el neto y todos los meses
// adeudados, sea cual sea la pestaña activa (doc 04).
export function armarMensajeDeuda(
  nombre: string,
  meses: { periodo: string; saldo: number }[],
  aFavor: number,
  neto: number,
): string {
  return [
    `Hola ${nombre}! Te escribimos de Tropa Gym. Tenés pendiente:`,
    ...meses.map((m) => `• ${periodoLargo(m.periodo)}: ${pesos(m.saldo)}`),
    ...(aFavor > 0 ? [`Tenés ${pesos(aFavor)} a favor, ya descontados.`] : []),
    `Total a abonar: ${pesos(neto)}`,
    'Cualquier duda, avisanos!',
  ].join('\n')
}
