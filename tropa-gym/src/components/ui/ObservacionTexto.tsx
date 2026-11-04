import { useState } from 'react'

const LARGO_CORTO = 90

// Observación del profe: siempre visible, hasta 2 líneas con "ver más". Nunca en
// un tooltip (doc 04).
export function ObservacionTexto({ texto }: { texto: string }) {
  const [completo, setCompleto] = useState(false)
  const esLarga = texto.length > LARGO_CORTO || texto.includes('\n')

  return (
    <div className="font-inter text-sm text-on-surface">
      <p
        className={`whitespace-pre-line ${
          completo ? '' : 'overflow-hidden [-webkit-box-orient:vertical] [-webkit-line-clamp:2] [display:-webkit-box]'
        }`}
      >
        {texto}
      </p>
      {esLarga && (
        <button
          type="button"
          onClick={() => setCompleto((v) => !v)}
          className="mt-0.5 font-inter text-xs text-primary hover:underline"
        >
          {completo ? 'ver menos' : 'ver más'}
        </button>
      )}
    </div>
  )
}
