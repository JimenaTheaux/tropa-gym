import { cn } from '@/lib/utils'

interface SegmentedControlOption<T extends string> {
  value: T
  label: string
}

interface SegmentedControlProps<T extends string> {
  label?: string
  value: T
  onChange: (value: T) => void
  options: SegmentedControlOption<T>[]
  id?: string
}

// Reemplaza <select> para grupos de 2-4 opciones excluyentes (doc 08).
// Mismo criterio de color que los botones Primario/Ghost: seleccionado
// toma la variante Primario, el resto queda en Ghost.
export function SegmentedControl<T extends string>({
  label,
  value,
  onChange,
  options,
  id,
}: SegmentedControlProps<T>) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <span className="font-oswald text-[11px] uppercase tracking-[0.05em] text-on-surface-variant">
          {label}
        </span>
      )}
      <div id={id} role="radiogroup" aria-label={label} className="inline-flex flex-wrap gap-2">
        {options.map((opt) => {
          const selected = opt.value === value
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(opt.value)}
              className={cn(
                'rounded-lg border px-4 py-2 font-oswald text-[13px] font-semibold uppercase tracking-[0.03em] transition-colors',
                selected
                  ? 'border-primary bg-surface-container-high text-primary'
                  : 'border-outline-variant bg-transparent text-on-surface-variant hover:bg-surface-container-high',
              )}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
