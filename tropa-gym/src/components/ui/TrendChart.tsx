import { useState } from 'react'

interface TrendChartProps {
  title: string
  data: { periodo: string; label: string; value: number }[]
  formatValue: (v: number) => string
  diverging?: boolean
}

const POSITIVO = '#40e432'
const NEGATIVO = '#ffb4ab'

// Gráfico de barras propio (sin lib externa) — mark specs doc dataviz: barra ≤24px,
// extremo redondeado 4px anclado a la base, gap entre barras, tooltip por barra.
export function TrendChart({ title, data, formatValue, diverging = false }: TrendChartProps) {
  const [activo, setActivo] = useState<number | null>(null)

  const maxAbs = Math.max(1, ...data.map((d) => Math.abs(d.value)))
  const altoZona = 120

  return (
    <div className="rounded-card border border-outline-variant bg-surface-container p-5">
      <p className="mb-4 font-oswald text-[13px] font-bold uppercase tracking-[0.03em] text-on-surface">
        {title}
      </p>

      <div className="mb-1 flex items-center justify-between font-inter text-xs text-on-surface-variant">
        <span>Escala: hasta {formatValue(maxAbs)}</span>
        {diverging && (
          <div className="flex gap-4">
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: POSITIVO }} />
              Positivo
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: NEGATIVO }} />
              Negativo
            </span>
          </div>
        )}
      </div>

      <div className="flex items-end justify-between gap-2" style={{ height: diverging ? altoZona * 2 : altoZona }}>
        {data.map((d, i) => {
          const color = diverging ? (d.value >= 0 ? POSITIVO : NEGATIVO) : POSITIVO
          const alturaPx = Math.max(2, (Math.abs(d.value) / maxAbs) * altoZona)
          const esUltimo = i === data.length - 1

          return (
            <div key={d.periodo} className="relative flex flex-1 flex-col items-center">
              {diverging ? (
                <div className="relative flex flex-col items-center" style={{ height: altoZona * 2 }}>
                  <div className="flex flex-col justify-end" style={{ height: altoZona, width: '100%' }}>
                    <button
                      type="button"
                      onMouseEnter={() => setActivo(i)}
                      onMouseLeave={() => setActivo(null)}
                      onFocus={() => setActivo(i)}
                      onBlur={() => setActivo(null)}
                      aria-label={`${d.label}: ${formatValue(d.value)}`}
                      className="mx-auto w-full max-w-[24px] rounded-t-[4px] transition-opacity hover:opacity-80"
                      style={{
                        height: d.value >= 0 ? alturaPx : 2,
                        background: d.value >= 0 ? color : 'transparent',
                      }}
                    />
                  </div>
                  <div className="w-full border-t border-outline-variant" />
                  <div className="flex flex-col" style={{ height: altoZona, width: '100%' }}>
                    <button
                      type="button"
                      onMouseEnter={() => setActivo(i)}
                      onMouseLeave={() => setActivo(null)}
                      onFocus={() => setActivo(i)}
                      onBlur={() => setActivo(null)}
                      aria-label={`${d.label}: ${formatValue(d.value)}`}
                      className="mx-auto w-full max-w-[24px] rounded-b-[4px] transition-opacity hover:opacity-80"
                      style={{
                        height: d.value < 0 ? alturaPx : 2,
                        background: d.value < 0 ? color : 'transparent',
                      }}
                    />
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onMouseEnter={() => setActivo(i)}
                  onMouseLeave={() => setActivo(null)}
                  onFocus={() => setActivo(i)}
                  onBlur={() => setActivo(null)}
                  aria-label={`${d.label}: ${formatValue(d.value)}`}
                  className="mx-auto w-full max-w-[24px] rounded-t-[4px] transition-opacity hover:opacity-80"
                  style={{ height: alturaPx, background: color }}
                />
              )}

              {activo === i && (
                <div className="absolute -top-8 z-10 whitespace-nowrap rounded-lg border border-outline-variant bg-surface-container-lowest px-2 py-1 font-inter text-xs text-on-surface shadow-lg">
                  {formatValue(d.value)}
                </div>
              )}
              {esUltimo && activo !== i && (
                <div
                  className="absolute -top-6 whitespace-nowrap font-inter text-[11px] font-semibold"
                  style={{ color }}
                >
                  {formatValue(d.value)}
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
