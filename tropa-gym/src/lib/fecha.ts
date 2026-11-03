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

// Día de un pagos.fecha, mismo criterio que fn_fecha_pago_local (migración 29):
// 00:00 UTC es una fecha elegida en el form; cualquier otra hora es un instante
// real y va en hora argentina. Con slice(0, 10), un pago de las 22:00 se ve un
// día después.
export function fechaPagoLocal(fecha: string): string {
  const d = new Date(fecha)
  if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0) {
    return d.toISOString().slice(0, 10)
  }
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
}

// Mismo rango que fn_validar_fecha_pago (migración 33). Devuelve el mensaje de
// error, o null si la fecha es válida.
export function validarFechaPago(fecha: string): string | null {
  const [y, m, d] = fecha.split('-').map(Number)
  const elegida = new Date(y, m - 1, d)
  if (elegida.getFullYear() !== y || elegida.getMonth() !== m - 1 || elegida.getDate() !== d) {
    return 'La fecha del pago no es válida.'
  }
  const ahora = new Date()
  if (elegida > new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + 1)) {
    return 'La fecha del pago no puede ser posterior a mañana.'
  }
  if (elegida < new Date(ahora.getFullYear() - 2, ahora.getMonth(), ahora.getDate())) {
    return 'La fecha del pago no puede tener más de 2 años de antigüedad.'
  }
  return null
}
