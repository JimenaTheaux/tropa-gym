const TOLERANCIA_MINUTOS = 10

export interface MinutosTrabajados {
  minutosReales: number
  minutosRedondeados: number
  redondeado: boolean
}

// Minutos trabajados entre entrada y salida (HH:MM:SS), con redondeo a la
// hora exacta más cercana cuando cae dentro de la tolerancia (±10 min).
// Fuera de tolerancia se conserva el valor real, sin redondear.
export function calcularMinutosTrabajados(horaEntrada: string, horaSalida: string): MinutosTrabajados {
  const [eh, em] = horaEntrada.split(':').map(Number)
  const [sh, sm] = horaSalida.split(':').map(Number)
  let minutosReales = sh * 60 + sm - (eh * 60 + em)
  if (minutosReales < 0) minutosReales += 24 * 60

  const horaMasCercana = Math.round(minutosReales / 60) * 60
  const diferencia = Math.abs(minutosReales - horaMasCercana)

  if (diferencia > 0 && diferencia <= TOLERANCIA_MINUTOS) {
    return { minutosReales, minutosRedondeados: horaMasCercana, redondeado: true }
  }
  return { minutosReales, minutosRedondeados: minutosReales, redondeado: false }
}

export function formatHoras(minutos: number): string {
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}
