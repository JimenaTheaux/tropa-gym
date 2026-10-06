import { useState } from 'react'

interface AsistenciaEvolucionChartProps {
  title: string
  data: {
    periodo: string
    label: string
    enCurso: boolean
    conAsistencia: number
    sinAsistencia: number
    baseActivos: number
  }[]
}

const CON = '#40e432'
const SIN = '#86957e'

// Dos barras lado a lado por mes, no apiladas: "con asistencia" cuenta a
// cualquier alumno que asistió (aunque hoy esté inactivo) y "sin asistencia"
// sale del padrón activo de hoy, así que con + sin no siempre suma la base —
// apilarlas mostraría un total que no existe.
export function AsistenciaEvolucionChart({ title, data }: AsistenciaEvolucionChartProps) {
  const [activo, setActivo] = useState<number | null>(null)

  const maxValor = Math.max(1, ...data.map((d) => Math.max(d.conAsistencia, d.sinAsistencia)))
  const altoZona = 140
  const base = data[data.length - 1]?.baseActivos ?? 0
  const altura = (v: number) => (v > 0 ? Math.max(2, (v / maxValor) * altoZona) : 0)

  return (
    <div className="rounded-card border border-outline-variant bg-surface-container p-5">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <p className="font-oswald text-[13px] font-bold uppercase tracking-[0.03em] text-on-surface">{title}</p>
        <div className="flex gap-4 font-inter text-xs text-on-surface-variant">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: CON }} />
            Con asistencia
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: SIN }} />
            Sin asistencia
          </span>
        </div>
      </div>

      <p className="mb-4 font-inter text-xs text-on-surface-variant">
        Sin asistencia: sobre {base} alumnos activos hoy
      </p>

      <div className="flex items-end justify-between gap-2" style={{ height: altoZona }}>
        {data.map((d, i) => (
          <div key={d.periodo} className="relative flex flex-1 flex-col items-center">
            <button
              type="button"
              onMouseEnter={() => setActivo(i)}
              onMouseLeave={() => setActivo(null)}
              onFocus={() => setActivo(i)}
              onBlur={() => setActivo(null)}
              aria-label={`${d.label}${d.enCurso ? ' (en curso)' : ''}: ${d.conAsistencia} con asistencia, ${d.sinAsistencia} sin asistencia, base ${d.baseActivos}`}
              className="mx-auto flex w-full max-w-[36px] items-end justify-center gap-1 transition-opacity hover:opacity-80"
              style={{ height: altoZona }}
            >
              <div
                className="w-1/2"
                style={{ height: altura(d.conAsistencia), background: CON, borderRadius: '4px 4px 0 0' }}
              />
              <div
                className="w-1/2"
                style={{ height: altura(d.sinAsistencia), background: SIN, borderRadius: '4px 4px 0 0' }}
              />
            </button>

            {activo === i && (
              <div className="absolute -top-24 z-10 whitespace-nowrap rounded-lg border border-outline-variant bg-surface-container-lowest px-2.5 py-1.5 font-inter text-xs text-on-surface shadow-lg">
                <div className="mb-0.5 font-semibold">
                  {d.label}
                  {d.enCurso && <span className="font-normal text-on-surface-variant"> (en curso)</span>}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: CON }} />
                  <span className="font-semibold">{d.conAsistencia}</span> con asistencia
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: SIN }} />
                  <span className="font-semibold">{d.sinAsistencia}</span> sin asistencia
                </div>
                <div className="mt-0.5 text-on-surface-variant">
                  Base: <span className="font-semibold text-on-surface">{d.baseActivos}</span> activos hoy
                </div>
              </div>
            )}

            <p className="mt-2 font-oswald text-[10px] uppercase tracking-[0.03em] text-on-surface-variant">
              {d.label}
            </p>
            {d.enCurso && <p className="font-inter text-[10px] text-on-surface-variant">(en curso)</p>}
          </div>
        ))}
      </div>
    </div>
  )
}
