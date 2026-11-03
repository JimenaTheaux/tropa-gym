import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { queryKeys } from '@/lib/queryKeys'
import { formatFecha } from '@/lib/utils'
import { fechaPagoLocal } from '@/lib/fecha'
import { Button } from '@/components/ui/button'

interface LogErrorRow {
  id: string
  contexto: string
  usuario_id: string | null
  error_mensaje: string
  ocurrido_en: string
  usuarioNombre: string
}

interface PagoHuerfano {
  pago_id: string
  tipo_pago: string
  metodo_pago: string
  total: number
  fecha: string
  created_at: string
}

const LIMIT = 100

async function fetchPagosHuerfanos(): Promise<PagoHuerfano[]> {
  const { data, error } = await supabase.rpc('pagos_huerfanos')
  if (error) throw new Error(error.message)
  return (data ?? []) as PagoHuerfano[]
}

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
  const huerfanosQuery = useQuery({
    queryKey: queryKeys.pagosHuerfanos,
    queryFn: fetchPagosHuerfanos,
  })
  const huerfanos = huerfanosQuery.data ?? []
  const [verHuerfanos, setVerHuerfanos] = useState(false)

  return (
    <div>
      {huerfanosQuery.isError && (
        <p className="mb-6 font-inter text-sm text-error">No se pudo consultar los pagos sin detalle.</p>
      )}

      {huerfanos.length > 0 && (
        <div className="mb-6 flex flex-col gap-3 rounded-lg border border-error/50 bg-error/10 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-inter text-sm font-medium text-error">Pagos sin detalle: {huerfanos.length}</p>
            <Button type="button" variant="ghost" onClick={() => setVerHuerfanos((v) => !v)}>
              {verHuerfanos ? 'Ocultar listado' : 'Ver listado'}
            </Button>
          </div>
          <p className="font-inter text-xs text-on-surface-variant">
            Suman en Ingresos pero no bajan ninguna deuda porque no tienen alumno asociado.
          </p>

          {verHuerfanos && (
            <div className="overflow-x-auto rounded-card border border-outline-variant bg-surface-container">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="bg-surface-container-high/50">
                    {['Fecha', 'Cargado', 'Tipo', 'Método', 'Total', 'ID'].map((titulo) => (
                      <th
                        key={titulo}
                        className="px-4 py-3 font-oswald text-[11px] font-medium uppercase tracking-[0.05em] text-on-surface-variant"
                      >
                        {titulo}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {huerfanos.map((h) => (
                    <tr key={h.pago_id} className="border-t border-outline-variant align-top">
                      <td className="whitespace-nowrap px-4 py-3 font-inter text-sm text-on-surface">
                        {formatFecha(fechaPagoLocal(h.fecha))}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-inter text-sm text-on-surface-variant">
                        {new Date(h.created_at).toLocaleString('es-AR', {
                          timeZone: 'America/Argentina/Buenos_Aires',
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </td>
                      <td className="px-4 py-3 font-inter text-sm text-on-surface">{h.tipo_pago}</td>
                      <td className="px-4 py-3 font-inter text-sm text-on-surface">{h.metodo_pago}</td>
                      <td className="whitespace-nowrap px-4 py-3 font-oswald text-sm font-bold text-on-surface">
                        ${Number(h.total).toLocaleString('es-AR')}
                      </td>
                      <td className="px-4 py-3 font-inter text-xs text-on-surface-variant">{h.pago_id}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

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
