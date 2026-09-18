import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { queryKeys } from '@/lib/queryKeys'
import { formatFecha } from '@/lib/utils'

interface LogErrorRow {
  id: string
  contexto: string
  usuario_id: string | null
  error_mensaje: string
  ocurrido_en: string
  usuarioNombre: string
}

const LIMIT = 100

async function fetchLogErrores(): Promise<LogErrorRow[]> {
  const { data: logs, error } = await supabase
    .from('log_errores')
    .select('id, contexto, usuario_id, error_mensaje, ocurrido_en')
    .order('ocurrido_en', { ascending: false })
    .limit(LIMIT)
  if (error) throw new Error(error.message)

  const filas = logs ?? []
  const usuarioIds = [...new Set(filas.map((f) => f.usuario_id).filter((id): id is string => !!id))]
  let nombrePorId = new Map<string, string>()
  if (usuarioIds.length > 0) {
    const { data: perfiles } = await supabase.from('perfiles').select('id, nombre').in('id', usuarioIds)
    nombrePorId = new Map((perfiles ?? []).map((p) => [p.id as string, p.nombre as string]))
  }

  return filas.map((f) => ({
    ...f,
    usuarioNombre: f.usuario_id ? (nombrePorId.get(f.usuario_id) ?? '—') : '—',
  }))
}

// Herramienta de diagnóstico, no un módulo pulido: solo lista lo que ya
// quedó en log_errores (insertado desde el catch de cada mutation de pago)
// para poder ver fallos que el dueño no llegó a reportar.
export function LogErroresPanel() {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: queryKeys.logErrores,
    queryFn: fetchLogErrores,
  })

  return (
    <div>
      <h2 className="mb-3 font-oswald text-base font-bold uppercase tracking-[0.02em] text-on-surface">
        Log de errores
      </h2>
      <p className="mb-4 font-inter text-sm text-on-surface-variant">
        Últimos {LIMIT} errores registrados automáticamente por la app (pagos que fallaron al guardar).
      </p>

      {isLoading && <p className="py-6 text-center font-inter text-sm text-on-surface-variant">Cargando…</p>}

      {!isLoading && logs.length === 0 && (
        <p className="py-6 text-center font-inter text-sm text-on-surface-variant">No hay errores registrados.</p>
      )}

      {!isLoading && logs.length > 0 && (
        <div className="overflow-x-auto rounded-card border border-outline-variant">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-surface-container-high/50">
                <th className="px-4 py-3 font-oswald text-[11px] font-medium uppercase tracking-[0.05em] text-on-surface-variant">
                  Fecha
                </th>
                <th className="px-4 py-3 font-oswald text-[11px] font-medium uppercase tracking-[0.05em] text-on-surface-variant">
                  Contexto
                </th>
                <th className="px-4 py-3 font-oswald text-[11px] font-medium uppercase tracking-[0.05em] text-on-surface-variant">
                  Usuario
                </th>
                <th className="px-4 py-3 font-oswald text-[11px] font-medium uppercase tracking-[0.05em] text-on-surface-variant">
                  Mensaje
                </th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-t border-outline-variant align-top">
                  <td className="whitespace-nowrap px-4 py-3 font-inter text-sm text-on-surface-variant">
                    {formatFecha(log.ocurrido_en.slice(0, 10))} {log.ocurrido_en.slice(11, 16)}
                  </td>
                  <td className="px-4 py-3 font-inter text-sm text-on-surface">{log.contexto}</td>
                  <td className="px-4 py-3 font-inter text-sm text-on-surface">{log.usuarioNombre}</td>
                  <td className="px-4 py-3 font-inter text-sm text-error">{log.error_mensaje}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
