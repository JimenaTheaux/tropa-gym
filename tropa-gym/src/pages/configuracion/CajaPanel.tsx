import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { fechaHoraLocal, fetchConfigCaja } from '@/lib/caja'
import { traducirError } from '@/lib/errores'
import { queryKeys } from '@/lib/queryKeys'
import { Button } from '@/components/ui/button'
import { ChipCaja } from '@/components/ui/ChipCaja'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

type Accion = 'activar' | 'apagar'

export function CajaPanel() {
  const queryClient = useQueryClient()
  const [accion, setAccion] = useState<Accion | null>(null)
  const [error, setError] = useState<string | null>(null)

  const query = useQuery({ queryKey: queryKeys.cajaConfig, queryFn: fetchConfigCaja })
  const arranque = query.data?.fecha_arranque ?? null

  const guardar = useMutation({
    mutationFn: async (fecha: string | null) => {
      const { error } = await supabase.rpc('set_fecha_arranque', { p_fecha: fecha })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.caja }),
  })

  async function confirmar() {
    if (!accion) return
    setError(null)
    try {
      await guardar.mutateAsync(accion === 'activar' ? new Date().toISOString() : null)
    } catch (err) {
      setError(traducirError(err instanceof Error ? err.message : null, 'No se pudo guardar.'))
    }
    setAccion(null)
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="font-inter text-sm text-on-surface-variant">
        Solo entran en los cierres los pagos cargados desde la fecha de arranque. Apagada, los pagos se siguen registrando
        con su receptor y las pantallas de caja quedan vacías.
      </p>

      {query.isLoading && <p className="font-inter text-sm text-on-surface-variant">Cargando…</p>}

      {query.isError && (
        <div className="flex flex-wrap items-center gap-3">
          <p className="font-inter text-sm text-error">No se pudo consultar el estado de la caja.</p>
          <Button type="button" variant="ghost" onClick={() => query.refetch()}>
            Reintentar
          </Button>
        </div>
      )}

      {query.isSuccess && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-card border border-outline-variant bg-surface-container p-5">
          {arranque ? (
            <ChipCaja label={`Activa desde ${fechaHoraLocal(arranque)}`} tono="ok" icon="check_circle" />
          ) : (
            <ChipCaja label="Apagada" icon="power_settings_new" />
          )}
          {arranque ? (
            <Button type="button" variant="ghost" onClick={() => setAccion('apagar')}>
              Apagar
            </Button>
          ) : (
            <Button type="button" variant="solido" onClick={() => setAccion('activar')}>
              Activar desde ahora
            </Button>
          )}
        </div>
      )}

      {error && <p className="font-inter text-sm text-error">{error}</p>}

      <ConfirmDialog
        open={accion === 'activar'}
        title="Activar cierre de caja"
        message="Desde este momento los pagos cargados entran en los cierres. Los anteriores quedan afuera."
        confirmLabel="Activar"
        loadingLabel="Guardando…"
        neutro
        loading={guardar.isPending}
        onConfirm={confirmar}
        onCancel={() => setAccion(null)}
      />

      <ConfirmDialog
        open={accion === 'apagar'}
        title="Apagar cierre de caja"
        message="Las pantallas de caja quedan vacías y no se puede cerrar ni verificar. Los cierres existentes no se borran, y al volver a activar solo entran los pagos desde esa nueva fecha."
        confirmLabel="Apagar"
        loadingLabel="Guardando…"
        loading={guardar.isPending}
        onConfirm={confirmar}
        onCancel={() => setAccion(null)}
      />
    </div>
  )
}
