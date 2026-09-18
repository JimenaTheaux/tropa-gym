import { supabase } from '@/lib/supabase'

// Se llama en el catch de cada mutation de pago, ANTES de mostrarle el error
// al usuario — así un fallo (RPC, insert, o una excepción en el cálculo
// previo al insert) queda registrado aunque el dueño no lo reporte. Es
// best-effort: si el insert a log_errores también falla (ej. la misma caída
// de red que rompió el pago), se traga ese error y deja pasar el original,
// para no reemplazar el mensaje real por uno sobre el logging.
export async function logError(params: {
  contexto: string
  usuarioId: string | null
  payloadIntentado: unknown
  error: unknown
}): Promise<void> {
  try {
    await supabase.from('log_errores').insert({
      contexto: params.contexto,
      usuario_id: params.usuarioId,
      payload_intentado: params.payloadIntentado as never,
      error_mensaje: params.error instanceof Error ? params.error.message : String(params.error),
      error_detalle: serializarError(params.error),
    })
  } catch {
    // best-effort, ver comentario arriba
  }
}

function serializarError(error: unknown): Record<string, unknown> | null {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack ?? null }
  }
  if (error && typeof error === 'object') return error as Record<string, unknown>
  return null
}
