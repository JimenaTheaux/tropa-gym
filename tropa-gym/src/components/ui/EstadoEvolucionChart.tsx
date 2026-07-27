import { useState } from 'react'

interface EstadoEvolucionChartProps {
  title: string
  data: { periodo: string; label: string; activos: number; inactivos: number }[]
}

const ACTIVO = '#40e432'
const INACTIVO = '#ffb4ab'

// Barra apilada activos+inactivos por período — a diferencia de dos barras
// separadas (una al lado de la otra), acá cada columna es directamente la
// comparación: la proporción entre ambas y el total de alumnos trackeados
// ese mes se leen en una sola mirada (part-to-whole, ver skill dataviz).
export function EstadoEvolucionChart({ title, data }: EstadoEvolucionChartProps) {
  const [activo, setActivo] = useState<number | null>(null)

  const maxTotal = Math.max(1, ...data.map((d) => d.activos + d.inactivos))
  const altoZona = 140

  return (
    <div className="rounded-card border border-outline-variant bg-surface-container p-5">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <p className="font-oswald text-[13px] font-bold uppercase tracking-[0.03em] text-on-surface">{title}</p>
        <div className="flex gap-4 font-inter text-xs text-on-surface-variant">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: ACTIVO }} />
            Activos
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: INACTIVO }} />
            Inactivos
          </span>
        </div>
      </div>

      <p className="mb-4 font-inter text-xs text-on-surface-variant">Escala: hasta {maxTotal} alumnos</p>

      <div className="flex items-end justify-between gap-2" style={{ height: altoZona }}>
        {data.map((d, i) => {
          const total = d.activos + d.inactivos
          const alturaInactivos = d.inactivos > 0 ? Math.max(2, (d.inactivos / maxTotal) * altoZona) : 0
          const alturaActivos = d.activos > 0 ? Math.max(2, (d.activos / maxTotal) * altoZona) : 0
          const hayAmbos = d.inactivos > 0 && d.activos > 0
          const esUltimo = i === data.length - 1

          return (
            <div key={d.periodo} className="relative flex flex-1 flex-col items-center">
              <button
                type="button"
                onMouseEnter={() => setActivo(i)}
                onMouseLeave={() => setActivo(null)}
                onFocus={() => setActivo(i)}
                onBlur={() => setActivo(null)}
                aria-label={`${d.label}: ${d.activos} activos, ${d.inactivos} inactivos`}
                className="mx-auto flex w-full max-w-[24px] flex-col justify-end transition-opacity hover:opacity-80"
                style={{ height: altoZona }}
              >
                {d.inactivos > 0 && (
                  <div
                    className="w-full"
                    style={{
                      height: alturaInactivos,
                      background: INACTIVO,
                      borderRadius: '4px 4px 0 0',
                      marginBottom: hayAmbos ? 2 : 0,
                    }}
                  />
                )}
                {d.activos > 0 && (
                  <div
                    className="w-full"
                    style={{
                      height: alturaActivos,
                      background: ACTIVO,
                      borderRadius: d.inactivos > 0 ? '0' : '4px 4px 0 0',
                    }}
                  />
                )}
              </button>

              {activo === i && (
                <div className="absolute -top-16 z-10 whitespace-nowrap rounded-lg border border-outline-variant bg-surface-container-lowest px-2.5 py-1.5 font-inter text-xs text-on-surface shadow-lg">
                  <div className="flex items-center gap-1.5">
                    <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: ACTIVO }} />
                    <span className="font-semibold">{d.activos}</span> activos
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ background: INACTIVO }}
                    />
                    <span className="font-semibold">{d.inactivos}</span> inactivos
                  </div>
                </div>
              )}
              {esUltimo && activo !== i && (
                <div className="absolute -top-6 whitespace-nowrap font-inter text-[11px] font-semibold text-on-surface-variant">
                  {total} total
                </div>
              )}

              <p className="mt-2 font-oswald text-[10px] uppercase tracking-[0.03em] text-on-surface-variant">
                {d.label}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
