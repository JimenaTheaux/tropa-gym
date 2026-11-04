import { useMemo, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { useProfesores } from '@/hooks/useCatalogos'
import { fechaHoraLocal, fetchPagosSinCierre, pesos } from '@/lib/caja'
import { traducirError } from '@/lib/errores'
import { logError } from '@/lib/logErrores'
import { queryKeys } from '@/lib/queryKeys'
import { STALE_OPERATIVO } from '@/lib/queryClient'
import type { AsignarReceptorPagoParams, PagoSinCierre } from '@/types/db'
import { Button } from '@/components/ui/button'
import { Drawer } from '@/components/ui/Drawer'
import { FormSelect } from '@/components/ui/FormField'

const VALOR_DUENO = 'admin'

function antiguedad(dias: number): string {
  if (dias === 0) return 'hoy'
  return dias === 1 ? 'hace 1 día' : `hace ${dias} días`
}

function FilaPago({ pago, accion }: { pago: PagoSinCierre; accion?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-outline-variant py-3">
      <div className="flex min-w-0 flex-col">
        <span className="font-inter text-sm text-on-surface">{pago.descripcion ?? '—'}</span>
        <span className="font-inter text-xs text-on-surface-variant">
          {fechaHoraLocal(pago.created_at)} · {antiguedad(pago.antiguedad_dias)}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-inter text-xs text-on-surface-variant">
          Efectivo {pesos(pago.importe_efectivo)} · Transferencia {pesos(pago.importe_transferencia)}
        </span>
        <span className="font-oswald text-sm font-bold text-on-surface">{pesos(pago.total)}</span>
        {accion}
      </div>
    </div>
  )
}

export function SinCierreView() {
  const { perfil } = useAuth()
  const queryClient = useQueryClient()
  const { data: profesores = [] } = useProfesores()
  const [asignando, setAsignando] = useState<PagoSinCierre | null>(null)
  const [receptor, setReceptor] = useState('')
  const [error, setError] = useState<string | null>(null)

  const query = useQuery({
    queryKey: queryKeys.cajaSinCierre,
    queryFn: fetchPagosSinCierre,
    staleTime: STALE_OPERATIVO,
  })
  const pagos = useMemo(() => query.data ?? [], [query.data])
  const sinReceptor = pagos.filter((p) => p.grupo === 'sin_receptor')

  const porProfesor = useMemo(() => {
    const grupos = new Map<string, PagoSinCierre[]>()
    for (const p of pagos) {
      if (p.grupo !== 'pendiente_cierre') continue
      const clave = p.profesor ?? '—'
      grupos.set(clave, [...(grupos.get(clave) ?? []), p])
    }
    return [...grupos.entries()]
  }, [pagos])

  const asignar = useMutation({
    mutationFn: async (params: AsignarReceptorPagoParams) => {
      const { error } = await supabase.rpc('asignar_receptor_pago', params)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.caja })
      queryClient.invalidateQueries({ queryKey: queryKeys.historialPagos })
    },
  })

  async function confirmar() {
    if (!asignando || !receptor) return
    setError(null)
    const params: AsignarReceptorPagoParams = {
      p_pago_id: asignando.pago_id,
      p_recibio_tipo: receptor === VALOR_DUENO ? 'admin' : 'profesor',
      p_recibio_profesor_id: receptor === VALOR_DUENO ? null : receptor,
    }
    try {
      await asignar.mutateAsync(params)
    } catch (err) {
      await logError({ contexto: 'cierre_caja_asignar', usuarioId: perfil?.id ?? null, payloadIntentado: params, error: err })
      setError(traducirError(err instanceof Error ? err.message : null, 'No se pudo asignar el receptor.'))
      return
    }
    setAsignando(null)
  }

  if (query.isLoading) return <p className="font-inter text-sm text-on-surface-variant">Cargando…</p>

  if (query.isError) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <p className="font-inter text-sm text-error">No se pudieron cargar los pagos.</p>
        <Button type="button" variant="ghost" onClick={() => query.refetch()}>
          Reintentar
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-card border border-outline-variant bg-surface-container p-5">
        <h2 className="mb-2 font-oswald text-base font-bold uppercase tracking-[0.02em] text-on-surface">
          Sin receptor ({sinReceptor.length})
        </h2>
        {sinReceptor.length === 0 && <p className="font-inter text-sm text-on-surface-variant">No hay pagos sin receptor.</p>}
        {sinReceptor.map((p) => (
          <FilaPago
            key={p.pago_id}
            pago={p}
            accion={
              <Button
                type="button"
                variant="primario"
                onClick={() => {
                  setError(null)
                  setReceptor('')
                  setAsignando(p)
                }}
              >
                Asignar receptor
              </Button>
            }
          />
        ))}
      </section>

      <section className="rounded-card border border-outline-variant bg-surface-container p-5">
        <h2 className="mb-2 font-oswald text-base font-bold uppercase tracking-[0.02em] text-on-surface">
          Pendientes de cierre por profesor
        </h2>
        {porProfesor.length === 0 && (
          <p className="font-inter text-sm text-on-surface-variant">No hay pagos pendientes de cierre.</p>
        )}
        {porProfesor.map(([profesor, lista]) => (
          <div key={profesor} className="mt-3">
            <h3 className="font-oswald text-[13px] font-semibold uppercase tracking-[0.03em] text-on-surface">
              {profesor} — {pesos(lista.reduce((s, p) => s + Number(p.importe_efectivo), 0))} en efectivo
            </h3>
            {lista.map((p) => (
              <FilaPago key={p.pago_id} pago={p} />
            ))}
          </div>
        ))}
      </section>

      <Drawer
        open={!!asignando}
        title="Asignar receptor"
        onClose={() => setAsignando(null)}
        footer={
          <>
            <Button type="button" variant="ghost" disabled={asignar.isPending} onClick={() => setAsignando(null)}>
              Cancelar
            </Button>
            <Button type="button" variant="solido" disabled={asignar.isPending || !receptor} onClick={confirmar}>
              {asignar.isPending ? 'Guardando…' : 'Asignar'}
            </Button>
          </>
        }
      >
        {asignando && (
          <div className="flex flex-col gap-4">
            <p className="font-inter text-sm text-on-surface-variant">
              {asignando.descripcion ?? '—'} · {pesos(asignando.total)}
            </p>
            <FormSelect
              id="asignar-receptor"
              label="Recibió"
              placeholder="Elegir"
              required
              value={receptor}
              onChange={(e) => setReceptor(e.target.value)}
              options={[
                { value: VALOR_DUENO, label: 'Dueño' },
                ...profesores
                  .filter((p) => p.activo)
                  .map((p) => ({ value: p.id, label: `${p.nombre} ${p.apellido}` })),
              ]}
            />
            {error && <p className="font-inter text-sm text-error">{error}</p>}
          </div>
        )}
      </Drawer>
    </div>
  )
}
