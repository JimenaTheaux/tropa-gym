import { useCallback, useLayoutEffect, useState } from 'react'

export interface ValidezCampos {
  hayInvalidos: boolean
  reportar: (id: string, valido: boolean) => void
}

// Un campo de fecha u hora inválido no le pasa nada al formulario, que conserva el
// valor anterior: Guardar lo escribiría sin que nadie lo note. Cada formulario crea
// este estado, se lo pasa a sus campos con `validez` y deshabilita Guardar con
// `hayInvalidos`.
export function useValidezCampos(): ValidezCampos {
  const [invalidos, setInvalidos] = useState<ReadonlySet<string>>(() => new Set())

  const reportar = useCallback((id: string, valido: boolean) => {
    setInvalidos((actuales) => {
      if (actuales.has(id) === !valido) return actuales
      const nuevos = new Set(actuales)
      if (valido) nuevos.delete(id)
      else nuevos.add(id)
      return nuevos
    })
  }, [])

  return { hayInvalidos: invalidos.size > 0, reportar }
}

// Un campo que se desmonta deja de frenar al formulario. Layout effect: Guardar se
// actualiza antes de pintar, sin un instante habilitado con una fecha inválida.
export function useReportarValidez(validez: ValidezCampos | undefined, id: string, valido: boolean) {
  const reportar = validez?.reportar
  useLayoutEffect(() => {
    reportar?.(id, valido)
    return () => reportar?.(id, true)
  }, [reportar, id, valido])
}
