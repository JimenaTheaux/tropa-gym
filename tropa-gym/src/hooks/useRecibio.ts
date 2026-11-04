import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { fetchReceptoresPago } from '@/lib/caja'
import { logError } from '@/lib/logErrores'
import { queryKeys } from '@/lib/queryKeys'
import { STALE_OPERATIVO } from '@/lib/queryClient'
import type { RecibioTipo } from '@/types/db'

const CLAVE_STORAGE = 'tropa:recibio'
const VALOR_DUENO = 'admin'

interface Recordado {
  profesorId: string
  asistenciaId: string
}

function leerRecordado(): Recordado | null {
  try {
    const crudo = localStorage.getItem(CLAVE_STORAGE)
    return crudo ? (JSON.parse(crudo) as Recordado) : null
  } catch {
    return null
  }
}

function guardarRecordado(valor: Recordado) {
  try {
    localStorage.setItem(CLAVE_STORAGE, JSON.stringify(valor))
  } catch {
    // Sin storage solo se pierde el recordatorio de la última elección.
  }
}

// Campo "Recibió" de los 4 formularios de pago (doc 04). Admin arranca siempre en
// "Dueño"; la elección solo se recuerda con sesión de profesor y mientras siga el
// mismo turno, para no asignarle plata a un profe por una elección vieja.
export function useRecibio(habilitado = true) {
  const { perfil } = useAuth()
  const esAdmin = perfil?.rol === 'admin'

  const query = useQuery({
    queryKey: queryKeys.receptoresPago,
    queryFn: fetchReceptoresPago,
    enabled: habilitado,
    staleTime: STALE_OPERATIVO,
  })

  const [elegido, setElegido] = useState<string | null>(null)
  const [recordado] = useState(leerRecordado)
  const errorLogueado = useRef(false)

  useEffect(() => {
    if (!query.isError) {
      errorLogueado.current = false
      return
    }
    if (errorLogueado.current) return
    errorLogueado.current = true
    logError({
      contexto: 'recibio_turnos_abiertos',
      usuarioId: perfil?.id ?? null,
      payloadIntentado: null,
      error: query.error,
    })
  }, [query.isError, query.error, perfil?.id])

  const abiertos = useMemo(() => query.data?.abiertos ?? [], [query.data])
  const activos = useMemo(() => query.data?.activos ?? [], [query.data])
  const enTurno = useMemo(
    () => activos.filter((p) => abiertos.some((a) => a.profesor_id === p.id)),
    [activos, abiertos],
  )

  const sinTurno = !esAdmin && enTurno.length === 0
  const lista = sinTurno ? activos : enTurno

  const opciones = useMemo(
    () => [
      ...(esAdmin ? [{ value: VALOR_DUENO, label: 'Dueño' }] : []),
      ...lista.map((p) => ({ value: p.id, label: `${p.nombre} ${p.apellido}` })),
    ],
    [esAdmin, lista],
  )

  let valor = ''
  if (elegido && opciones.some((o) => o.value === elegido)) {
    valor = elegido
  } else if (esAdmin) {
    valor = VALOR_DUENO
  } else if (enTurno.length === 1) {
    valor = enTurno[0].id
  } else if (
    recordado &&
    abiertos.some((a) => a.id === recordado.asistenciaId && a.profesor_id === recordado.profesorId) &&
    opciones.some((o) => o.value === recordado.profesorId)
  ) {
    valor = recordado.profesorId
  }

  function seleccionar(nuevo: string) {
    setElegido(nuevo)
    const turno = abiertos.find((a) => a.profesor_id === nuevo)
    if (!esAdmin && turno) guardarRecordado({ profesorId: nuevo, asistenciaId: turno.id })
  }

  // Sin ningún profesor activo no hay qué elegir: el pago no se puede frenar por
  // eso y queda sin receptor, en "Pagos sin cierre".
  const sinOpciones = !query.isLoading && !query.isError && opciones.length === 0
  const valido = !query.isLoading && !query.isError && (!!valor || sinOpciones)

  const tipo: RecibioTipo | null = !valor ? null : valor === VALOR_DUENO ? 'admin' : 'profesor'
  const params = {
    p_recibio_tipo: tipo,
    p_recibio_profesor_id: tipo === 'profesor' ? valor : null,
  }

  return {
    opciones,
    valor,
    seleccionar,
    valido,
    params,
    sinTurno,
    cargando: query.isLoading,
    error: query.isError,
    reintentar: () => query.refetch(),
  }
}

export type RecibioEstado = ReturnType<typeof useRecibio>

// Un request_id por intento de guardado: el reintento del mismo pago reutiliza el
// id (si el servidor ya lo guardó, devuelve ese pago); si cambian los datos, es
// otro intento. Se renueva después de un éxito.
export function useRequestId() {
  const actual = useRef<{ clave: string; id: string } | null>(null)
  return useMemo(
    () => ({
      paraIntento(clave: string): string {
        if (actual.current?.clave !== clave) actual.current = { clave, id: crypto.randomUUID() }
        return actual.current.id
      },
      renovar() {
        actual.current = null
      },
    }),
    [],
  )
}
