import { createClient } from '@supabase/supabase-js'

// Sin timeout propio, un fetch colgado (wifi de gimnasio que queda en un
// estado intermedio — conectado a la red pero sin salida real) puede quedar
// esperando respuesta indefinidamente: el botón se queda en "Guardando…" sin
// error y sin que el usuario sepa si de verdad se guardó. 20s alcanza de
// sobra para el tamaño de los payloads de esta app y fuerza a que el error
// se muestre (traducirError ya reconoce el mensaje de timeout).
const FETCH_TIMEOUT_MS = 20_000

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    global: {
      fetch: (input, init) =>
        fetch(input, { ...init, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) }),
    },
  },
)
