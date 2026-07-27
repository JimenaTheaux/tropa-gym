import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { Cargo } from '@/types/db'
import { supabase } from '@/lib/supabase'
import { traducirError } from '@/lib/errores'
import { confirmarGeneracionCargos, fetchCargosPeriodo, previewCargosPeriodo, type FilaCargoPreview } from '@/lib/cargos'
import { useAlumnos } from '@/hooks/useAlumnos'
import { queryKeys } from '@/lib/queryKeys'
import { STALE_OPERATIVO } from '@/lib/queryClient'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { FormInput } from '@/components/ui/FormField'
import { EditarMontoCargo } from '@/components/ui/EditarMontoCargo'

type FilaCargo = FilaCargoPreview

function periodoActual(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function money(v: number): string {
  return `$${Math.round(v).toLocaleString('es-AR')}`
}

export function Cargos() {
  const queryClient = useQueryClient()
  const [periodo, setPeriodo] = useState(periodoActual())
  const { data: alumnos = [] } = useAlumnos()
  // Montos que el admin carga a mano en el preview para cargos que todavía no
  // existen (sin combo/precio resuelto) — se aplican recién al confirmar,
  // porque hasta ese momento el cargo no tiene fila en la base para editar.
  const [overrides, setOverrides] = useState<Record<string, number>>({})
  const [confirmando, setConfirmando] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const previewQuery = useQuery({
    queryKey: queryKeys.cargosPreview(periodo),
    queryFn: () => previewCargosPeriodo(periodo),
    enabled: false,
    staleTime: STALE_OPERATIVO,
  })
  const cargosPeriodoQuery = useQuery({
    queryKey: queryKeys.cargosPeriodo(periodo),
    queryFn: () => fetchCargosPeriodo(periodo),
    enabled: false,
    staleTime: STALE_OPERATIVO,
  })

  const loading = previewQuery.isFetching || cargosPeriodoQuery.isFetching
  const filas = previewQuery.data?.filas ?? null
  const cargosPeriodo = cargosPeriodoQuery.data ?? new Map<string, Cargo>()

  async function verPreview() {
    setError(null)
    setSuccess(null)
    const [previewRes] = await Promise.all([previewQuery.refetch(), cargosPeriodoQuery.refetch()])
    if (previewRes.data?.error) {
      setError(traducirError(previewRes.data.error))
      return
    }
    setOverrides({})
  }

  async function confirmarGeneracion() {
    setConfirmando(true)
    setError(null)
    const { filas: resultado, error } = await confirmarGeneracionCargos(periodo)
    if (error) {
      setConfirmando(false)
      setModalOpen(false)
      setError(traducirError(error))
      return
    }

    // Filas recién creadas (no existían antes de este confirmar) para las que
    // el admin ya había cargado un monto a mano en el preview: se aplican
    // ahora que el cargo existe. El UPDATE dispara el trigger que marca
    // monto_definido = true y recalcula el estado (misma vía que "editar
    // monto" en cualquier otra pantalla).
    const aplicar = resultado.filter(
      (f) => !f.ya_existe && !f.monto_definido && overrides[f.alumno_id] > 0,
    )
    if (aplicar.length > 0) {
      await Promise.all(
        aplicar.map((f) =>
          supabase
            .from('cargos')
            .update({ monto: overrides[f.alumno_id] })
            .eq('alumno_id', f.alumno_id)
            .eq('periodo', periodo),
        ),
      )
    }

    const nuevosCreados = resultado.filter((f) => !f.ya_existe).length
    setConfirmando(false)
    setModalOpen(false)
    setSuccess(`Se generaron ${nuevosCreados} cargo(s) nuevo(s) para el período ${periodo}.`)
    queryClient.invalidateQueries({ queryKey: ['cuenta'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    await verPreview()
  }

  function alumnoNombre(id: string) {
    const a = alumnos.find((al) => al.id === id)
    return a ? `${a.nombre} ${a.apellido}` : id
  }

  const completas = filas?.filter((f) => f.tipo === 'completa') ?? []
  const medias = filas?.filter((f) => f.tipo === 'media') ?? []
  const nuevos = filas?.filter((f) => !f.ya_existe) ?? []
  const alumnosConAsistencia = new Set(filas?.map((f) => f.alumno_id))
  const sinAsistencia = alumnos.filter((a) => a.estado === 'activo' && !alumnosConAsistencia.has(a.id))

  // Monto real: para cargos que ya existen se usa lo que efectivamente quedó
  // guardado (puede diferir de lo recalculado si el precio cambió después o
  // si ya se editó a mano), no el valor recalculado del preview.
  function montoYDefinicion(f: FilaCargo): { monto: number; definido: boolean } {
    const real = cargosPeriodo.get(f.alumno_id)
    if (real) return { monto: Number(real.monto), definido: real.monto_definido }
    if (f.monto_definido) return { monto: Number(f.monto), definido: true }
    const override = overrides[f.alumno_id]
    return { monto: override ?? 0, definido: false }
  }

  const montoTotal = nuevos.reduce((sum, f) => sum + montoYDefinicion(f).monto, 0)
  const sinDefinirCount = filas?.filter((f) => !montoYDefinicion(f).definido).length ?? 0
  // Filas nuevas que van a generarse en $0 porque nadie cargó un monto a
  // mano en el preview (a diferencia de las que sí tienen un override
  // tipeado, que se aplican solas apenas se confirma).
  const quedaranSinDefinir = nuevos.filter((f) => !f.monto_definido && !(overrides[f.alumno_id] > 0)).length

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-oswald text-2xl font-bold uppercase tracking-[0.02em] text-on-surface">
        Generar Cargos del Período
      </h1>

      <div className="flex flex-wrap items-end gap-4 rounded-card border border-outline-variant bg-surface-container p-5">
        <FormInput
          id="cargos-periodo"
          label="Período"
          type="month"
          value={periodo}
          onChange={(e) => {
            setPeriodo(e.target.value)
            setOverrides({})
            setSuccess(null)
          }}
        />
        <Button type="button" variant="primario" disabled={loading} onClick={verPreview}>
          {loading ? 'Calculando…' : 'Ver preview'}
        </Button>
      </div>

      {error && <p className="font-inter text-sm text-error">{error}</p>}
      {success && (
        <p className="rounded-lg border border-primary bg-surface-container-high px-4 py-3 font-inter text-sm text-primary">
          {success}
        </p>
      )}

      {filas && (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <div className="rounded-card border border-outline-variant bg-surface-container p-4">
              <p className="font-oswald text-[11px] uppercase tracking-[0.05em] text-on-surface-variant">
                Cuotas completas
              </p>
              <p className="font-anton text-2xl text-on-surface">{completas.length}</p>
            </div>
            <div className="rounded-card border border-outline-variant bg-surface-container p-4">
              <p className="font-oswald text-[11px] uppercase tracking-[0.05em] text-on-surface-variant">
                Medias cuotas
              </p>
              <p className="font-anton text-2xl text-on-surface">{medias.length}</p>
            </div>
            <div className="rounded-card border border-outline-variant bg-surface-container p-4">
              <p className="font-oswald text-[11px] uppercase tracking-[0.05em] text-on-surface-variant">
                Sin asistencia
              </p>
              <p className="font-anton text-2xl text-on-surface">{sinAsistencia.length}</p>
            </div>
            <div className="rounded-card border border-outline-variant bg-surface-container p-4">
              <p className="font-oswald text-[11px] uppercase tracking-[0.05em] text-on-surface-variant">
                Sin monto definido
              </p>
              <p className="font-anton text-2xl text-error">{sinDefinirCount}</p>
            </div>
            <div className="rounded-card border border-outline-variant bg-surface-container p-4">
              <p className="font-oswald text-[11px] uppercase tracking-[0.05em] text-on-surface-variant">
                Monto a generar
              </p>
              <p className="font-anton text-2xl text-on-surface">{money(montoTotal)}</p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-card border border-outline-variant">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-surface-container-high/50">
                  <th className="px-4 py-3 font-oswald text-[11px] font-medium uppercase tracking-[0.05em] text-on-surface-variant">
                    Alumno
                  </th>
                  <th className="px-4 py-3 font-oswald text-[11px] font-medium uppercase tracking-[0.05em] text-on-surface-variant">
                    Tipo
                  </th>
                  <th className="px-4 py-3 font-oswald text-[11px] font-medium uppercase tracking-[0.05em] text-on-surface-variant">
                    Monto
                  </th>
                  <th className="px-4 py-3 font-oswald text-[11px] font-medium uppercase tracking-[0.05em] text-on-surface-variant">
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => {
                  const real = cargosPeriodo.get(f.alumno_id)
                  const { monto, definido } = montoYDefinicion(f)
                  return (
                    <tr key={f.alumno_id} className="border-t border-outline-variant align-top">
                      <td className="px-4 py-3 font-inter text-sm text-on-surface">{alumnoNombre(f.alumno_id)}</td>
                      <td className="px-4 py-3 font-inter text-sm text-on-surface">
                        {f.tipo === 'completa' ? 'Cuota completa' : 'Media cuota'}
                      </td>
                      <td className="px-4 py-3 font-inter text-sm text-on-surface">
                        {definido ? (
                          money(monto)
                        ) : real ? (
                          <EditarMontoCargo
                            cargoId={real.id}
                            montoActual={real.monto}
                            label="Monto del cargo"
                            onGuardado={verPreview}
                          />
                        ) : (
                          <div className="flex w-fit min-w-[140px] items-center gap-1 rounded-lg border border-error/60 bg-surface-container-low px-3 py-1.5 focus-within:border-primary">
                            <span className="font-inter text-sm text-on-surface-variant">$</span>
                            <input
                              id={`override-${f.alumno_id}`}
                              aria-label={`Definir monto para ${alumnoNombre(f.alumno_id)}`}
                              type="number"
                              inputMode="decimal"
                              min={0}
                              step="0.01"
                              placeholder="A definir"
                              value={overrides[f.alumno_id] ?? ''}
                              onChange={(e) =>
                                setOverrides((prev) => ({ ...prev, [f.alumno_id]: Number(e.target.value) }))
                              }
                              onFocus={(e) => e.target.select()}
                              className="w-full bg-transparent text-right font-inter text-sm text-on-surface outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none"
                            />
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 font-inter text-sm text-on-surface-variant">
                        {f.ya_existe ? 'Ya generado' : 'A generar'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {sinAsistencia.length > 0 && (
            <div className="rounded-card border border-outline-variant bg-surface-container p-5">
              <p className="mb-2 font-oswald text-[11px] uppercase tracking-[0.05em] text-on-surface-variant">
                Alumnos activos sin asistencia en el período
              </p>
              <p className="font-inter text-sm text-on-surface">
                {sinAsistencia.map((a) => `${a.nombre} ${a.apellido}`).join(', ')}
              </p>
            </div>
          )}

          <div className="flex justify-end">
            <Button
              type="button"
              variant="solido"
              disabled={confirmando || nuevos.length === 0}
              onClick={() => setModalOpen(true)}
            >
              {`Generar cargos del período (${nuevos.length})`}
            </Button>
          </div>

          <ConfirmDialog
            open={modalOpen}
            title="Generar cargos del período"
            message={
              quedaranSinDefinir > 0
                ? `Se van a generar ${nuevos.length} cargo(s) nuevo(s) para el período ${periodo}, por un total de ${money(montoTotal)}. ${quedaranSinDefinir} de ellos van a quedar con el monto sin definir (cargo generado igual, en $0, para no perder al alumno) — vas a poder completarlo después en esta misma tabla. ¿Confirmás?`
                : `Se van a generar ${nuevos.length} cargo(s) nuevo(s) para el período ${periodo}, por un total de ${money(montoTotal)}. Esta es la única vía para liquidar el período. ¿Confirmás?`
            }
            confirmLabel="Generar cargos"
            loading={confirmando}
            onConfirm={confirmarGeneracion}
            onCancel={() => setModalOpen(false)}
          />
        </>
      )}
    </div>
  )
}
