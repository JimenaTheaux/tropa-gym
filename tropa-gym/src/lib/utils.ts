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

// Link directo al chat de WhatsApp, sin mensaje preestablecido. Asume
// Argentina: si el teléfono no trae código de país, antepone 54 9 (celular).
export function whatsappLink(telefono: string): string {
  const digitos = telefono.replace(/\D/g, '')
  if (digitos.startsWith('54')) return `https://wa.me/${digitos}`
  return `https://wa.me/549${digitos.replace(/^0/, '')}`
}
