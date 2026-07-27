interface NumericKeypadProps {
  value: string
  onChange: (value: string) => void
  maxLength?: number
}

const TECLAS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'borrar', '0', 'limpiar'] as const

// Teclado numérico en pantalla para la tablet de check-in — evita depender
// del teclado nativo del dispositivo para tipear el DNI.
export function NumericKeypad({ value, onChange, maxLength = 15 }: NumericKeypadProps) {
  function presionar(tecla: (typeof TECLAS)[number]) {
    if (tecla === 'borrar') {
      onChange(value.slice(0, -1))
      return
    }
    if (tecla === 'limpiar') {
      onChange('')
      return
    }
    if (value.length >= maxLength) return
    onChange(value + tecla)
  }

  return (
    <div className="grid w-full max-w-xs grid-cols-3 gap-1.5">
      {TECLAS.map((tecla) => (
        <button
          key={tecla}
          type="button"
          onClick={() => presionar(tecla)}
          aria-label={tecla === 'borrar' ? 'Borrar' : tecla === 'limpiar' ? 'Limpiar' : tecla}
          className="flex h-11 items-center justify-center rounded-lg border border-outline-variant bg-surface-container-low font-oswald text-lg font-bold text-on-surface transition-colors hover:bg-surface-container-high active:bg-surface-container-highest"
        >
          {tecla === 'borrar' ? (
            <span className="material-symbols-outlined !text-[20px]">backspace</span>
          ) : tecla === 'limpiar' ? (
            <span className="material-symbols-outlined !text-[20px]">close</span>
          ) : (
            tecla
          )}
        </button>
      ))}
    </div>
  )
}
