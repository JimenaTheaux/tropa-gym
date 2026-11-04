import { useLayoutEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react'
import { aplicarEdicion, borrarSobreSeparador, type Mascara } from '@/lib/mascara'

// Mantiene el cursor en su lugar: al reescribir el value de un input controlado, el
// navegador lo manda al final. La siguiente tecla caería sobre el último dígito.
export function useInputMascara(texto: string, mascara: Mascara, alCambiar: (texto: string) => void) {
  const ref = useRef<HTMLInputElement>(null)
  const caret = useRef<number | null>(null)
  const [, forzarRender] = useState(0)

  useLayoutEffect(() => {
    if (caret.current === null || !ref.current) return
    ref.current.setSelectionRange(caret.current, caret.current)
    caret.current = null
  })

  function aplicar(nuevo: string, posicion: number) {
    caret.current = posicion
    alCambiar(nuevo)
    forzarRender((n) => n + 1)
  }

  function onChange(e: ChangeEvent<HTMLInputElement>) {
    const crudo = e.target.value
    const edicion = aplicarEdicion(texto, crudo, e.target.selectionStart ?? crudo.length, mascara)
    aplicar(edicion.texto, edicion.caret)
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Backspace' && e.key !== 'Delete') return
    const { selectionStart, selectionEnd } = e.currentTarget
    if (selectionStart === null || selectionStart !== selectionEnd) return
    const edicion = borrarSobreSeparador(texto, selectionStart, e.key, mascara)
    if (!edicion) return
    e.preventDefault()
    aplicar(edicion.texto, edicion.caret)
  }

  return { ref, onChange, onKeyDown, aplicar }
}
