// Supabase/PostgREST devuelven sus mensajes de error en inglés. Esta capa traduce
// los patrones técnicos conocidos; cualquier mensaje que no matchee se deja tal
// cual (se asume que viene de un RAISE EXCEPTION propio, ya escrito en español).
const PATRONES: { test: RegExp; mensaje: string }[] = [
  { test: /invalid login credentials/i, mensaje: 'Email o contraseña incorrectos.' },
  { test: /email not confirmed/i, mensaje: 'El email todavía no fue confirmado.' },
  { test: /user already registered/i, mensaje: 'Ya existe un usuario con ese email.' },
  { test: /jwt expired/i, mensaje: 'La sesión expiró. Volvé a iniciar sesión.' },
  { test: /invalid.*jwt|jwt.*invalid/i, mensaje: 'La sesión no es válida. Volvé a iniciar sesión.' },
  { test: /failed to fetch|networkerror|network error|load failed/i, mensaje: 'No se pudo conectar con el servidor. Revisá tu conexión a internet.' },
  { test: /duplicate key value/i, mensaje: 'Ya existe un registro con ese valor único.' },
  { test: /permission denied|row-level security/i, mensaje: 'No tenés permisos para realizar esta acción.' },
  { test: /violates foreign key constraint/i, mensaje: 'No se puede completar la operación: hay datos relacionados en otra tabla.' },
  { test: /violates not-null constraint/i, mensaje: 'Faltan datos obligatorios.' },
  { test: /violates check constraint/i, mensaje: 'Alguno de los valores ingresados no es válido.' },
  { test: /timeout/i, mensaje: 'La operación tardó demasiado. Intentá de nuevo.' },
]

export function traducirError(
  mensaje: string | null | undefined,
  generico = 'Ocurrió un error. Intentá de nuevo.',
): string {
  if (!mensaje) return generico
  return PATRONES.find((p) => p.test.test(mensaje))?.mensaje ?? mensaje
}
