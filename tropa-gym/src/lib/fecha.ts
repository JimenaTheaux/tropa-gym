const TZ = 'America/Argentina/Buenos_Aires'

// Las fechas "solo día" viajan como string YYYY-MM-DD. No usar new Date('YYYY-MM-DD')
// (la interpreta en UTC) ni toISOString().slice(0, 10) (después de las 21hs en
// Argentina ya cuenta como el día siguiente).
export function hoyAR(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: TZ })
}

export function fechaLocalISO(): string {
  return hoyAR()
}

export function isFechaValida(iso: string): boolean {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!partes) return false
  const [y, m, d] = partes.slice(1).map(Number)
  const fecha = new Date(Date.UTC(2000, m - 1, d))
  fecha.setUTCFullYear(y, m - 1, d)
  return fecha.getUTCFullYear() === y && fecha.getUTCMonth() === m - 1 && fecha.getUTCDate() === d
}

export function addDays(iso: string, dias: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const fecha = new Date(Date.UTC(2000, 0, 1))
  fecha.setUTCFullYear(y, m - 1, d + dias)
  return [
    String(fecha.getUTCFullYear()).padStart(4, '0'),
    String(fecha.getUTCMonth() + 1).padStart(2, '0'),
    String(fecha.getUTCDate()).padStart(2, '0'),
  ].join('-')
}

export function formatDMY(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

// Convierte a YYYY-MM-DD o devuelve null si no es una fecha que exista. Estricto:
// solo dd/mm/aaaa. Con `flexible` también acepta d/m/aa y aaaa-mm-dd (pegar, o al
// salir del campo).
export function parseDMY(texto: string, flexible = false): string | null {
  const limpio = texto.trim()
  let iso: string | null = null

  const estricto = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(limpio)
  if (estricto) iso = `${estricto[3]}-${estricto[2]}-${estricto[1]}`

  if (!iso && flexible) {
    const isoTexto = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(limpio)
    const corto = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/.exec(limpio)
    const digitos = /^(\d{2})(\d{2})(\d{4})$/.exec(limpio)
    if (isoTexto) {
      iso = `${isoTexto[1]}-${isoTexto[2].padStart(2, '0')}-${isoTexto[3].padStart(2, '0')}`
    } else if (corto) {
      const anio = corto[3].length === 2 ? `20${corto[3]}` : corto[3]
      iso = `${anio}-${corto[2].padStart(2, '0')}-${corto[1].padStart(2, '0')}`
    } else if (digitos) {
      iso = `${digitos[3]}-${digitos[2]}-${digitos[1]}`
    }
  }

  return iso && isFechaValida(iso) ? iso : null
}

export function diaArgentino(instante: string): string {
  return new Date(instante).toLocaleDateString('en-CA', { timeZone: TZ })
}

export function horaArgentina(instante: string): string {
  return new Date(instante).toLocaleTimeString('es-AR', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

export function formatDateTimeAR(instante: string): string {
  return `${formatDMY(diaArgentino(instante))} ${horaArgentina(instante)}`
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
  return diaArgentino(fecha)
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
