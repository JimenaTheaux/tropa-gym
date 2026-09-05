// Fecha de hoy en horario local, formato YYYY-MM-DD.
// No usar `new Date().toISOString().slice(0, 10)`: toISOString() siempre
// devuelve UTC, así que después de las 21hs en Argentina (UTC-3) ya cuenta
// como el día siguiente.
export function fechaLocalISO(): string {
  const ahora = new Date()
  const year = ahora.getFullYear()
  const month = String(ahora.getMonth() + 1).padStart(2, '0')
  const day = String(ahora.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
