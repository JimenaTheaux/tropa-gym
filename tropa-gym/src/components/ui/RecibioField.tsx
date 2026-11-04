import type { RecibioEstado } from '@/hooks/useRecibio'
import { Button } from '@/components/ui/button'
import { FormSelect } from '@/components/ui/FormField'
import { SegmentedControl } from '@/components/ui/SegmentedControl'

const MAX_CHIPS = 6

export function RecibioField({ recibio, idPrefix }: { recibio: RecibioEstado; idPrefix: string }) {
  if (recibio.cargando) {
    return <p className="font-inter text-xs text-on-surface-variant">Cargando quién está en turno…</p>
  }

  if (recibio.error) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-error/50 bg-error/10 px-3 py-2">
        <p className="font-inter text-xs text-error">
          No se pudo consultar quién está en turno. Sin ese dato no se puede registrar el pago.
        </p>
        <Button type="button" variant="ghost" onClick={recibio.reintentar}>
          Reintentar
        </Button>
      </div>
    )
  }

  if (recibio.opciones.length === 0) {
    return (
      <p className="font-inter text-xs text-on-surface-variant">
        No hay profesores activos: el pago queda sin receptor y se asigna desde Cierres de caja.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-1.5">
      {recibio.opciones.length > MAX_CHIPS ? (
        <FormSelect
          id={`${idPrefix}-recibio`}
          label="Recibió"
          placeholder="Elegir"
          required
          value={recibio.valor}
          onChange={(e) => recibio.seleccionar(e.target.value)}
          options={recibio.opciones}
        />
      ) : (
        <SegmentedControl
          id={`${idPrefix}-recibio`}
          label="Recibió"
          value={recibio.valor}
          onChange={recibio.seleccionar}
          options={recibio.opciones}
        />
      )}
      {recibio.sinTurno && <p className="font-inter text-xs text-on-surface-variant">Sin turno abierto</p>}
      {!recibio.valor && <p className="font-inter text-xs text-error">Elegí quién recibió el pago.</p>}
    </div>
  )
}
