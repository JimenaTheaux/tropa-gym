import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import {
  diaLocal,
  fechaHoraLocal,
  fetchCierresParaVerificar,
  fetchPreviewVerificacion,
  horaLocal,
  parseMontoAR,
  pesos,
} from '@/lib/caja'
import { traducirError } from '@/lib/errores'
import { logError } from '@/lib/logErrores'
import { queryKeys } from '@/lib/queryKeys'
import { STALE_OPERATIVO } from '@/lib/queryClient'
import { formatFecha } from '@/lib/utils'
import type { ResultadoVerificacion, VerificarCierresParams } from '@/types/db'
import { Button } from '@/components/ui/button'
import { ChipCaja } from '@/components/ui/ChipCaja'
import { DateRangeField } from '@/components/ui/DateField'
import { FormCheckbox, FormInput, FormTextarea } from '@/components/ui/FormField'
import { ObservacionTexto } from '@/components/ui/ObservacionTexto'

export function VerificarView() {
  const { perfil } = useAuth()
  const queryClient = useQueryClient()
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [seleccion, setSeleccion] = useState<string[]>([])
  const [contadoTexto, setContadoTexto] = useState('')
  const [nota, setNota] = useState('')
  const [transferenciasControladas, setTransferenciasControladas] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exito, setExito] = useState<string | null>(null)

  const query = useQuery({
    queryKey: queryKeys.cajaParaVerificar,
    queryFn: fetchCierresParaVerificar,
    staleTime: STALE_OPERATIVO,
  })
  const datos = query.data
  const cierres = useMemo(() => datos?.cierres ?? [], [datos])

  const filtrados = cierres.filter((c) => {
    const dia = diaLocal(c.cerrado_en)
    return (!desde || dia >= desde) && (!hasta || dia <= hasta)
  })

  // Un cierre que dejó de estar pendiente sale solo de la selección al recargar.
  const tildados = cierres.filter((c) => seleccion.includes(c.cierre_id))
  const idsTildados = tildados.map((c) => c.cierre_id).sort()
  const claveIds = idsTildados.join(',')

  const preview = useQuery({
    queryKey: queryKeys.cajaPreview(claveIds),
    queryFn: () => fetchPreviewVerificacion(idsTildados),
    enabled: idsTildados.length > 0,
    staleTime: 0,
  })

  const esperado = preview.data ? Number(preview.data.efectivo_esperado) : null
  const contado = parseMontoAR(contadoTexto)
  const diferencia =
    esperado !== null && contado !== null ? Math.round((contado - esperado) * 100) / 100 : null
  const totalTransferencias = tildados.reduce((s, c) => s + Number(c.transferencias_sistema), 0)
  const observaciones = tildados.filter((c) => c.observacion)
  const faltaNota = diferencia !== null && diferencia !== 0 && !nota.trim()

  const verificar = useMutation({
    mutationFn: async (params: VerificarCierresParams) => {
      const { data, error } = await supabase.rpc('verificar_cierres', params)
      if (error) throw new Error(error.message)
      if (!data) throw new Error('El servidor no confirmó la verificación.')
      return data as ResultadoVerificacion
    },
  })

  function alternar(id: string) {
    setSeleccion((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  }

  const todosFiltradosTildados = filtrados.length > 0 && filtrados.every((c) => seleccion.includes(c.cierre_id))

  function alternarTodos() {
    const ids = filtrados.map((c) => c.cierre_id)
    setSeleccion((s) =>
      todosFiltradosTildados ? s.filter((x) => !ids.includes(x)) : [...new Set([...s, ...ids])],
    )
  }

  async function confirmar() {
    if (verificar.isPending || contado === null || idsTildados.length === 0) return
    setError(null)
    setExito(null)
    const params: VerificarCierresParams = {
      p_cierre_ids: idsTildados,
      p_efectivo_contado: contado,
      p_nota: nota.trim() || null,
      p_transferencias_controladas: transferenciasControladas,
    }

    let resultado: ResultadoVerificacion
    try {
      resultado = await verificar.mutateAsync(params)
    } catch (err) {
      await logError({ contexto: 'cierre_caja_verificar', usuarioId: perfil?.id ?? null, payloadIntentado: params, error: err })
      setError(traducirError(err instanceof Error ? err.message : null, 'No se pudo verificar.'))
      queryClient.invalidateQueries({ queryKey: queryKeys.caja })
      return
    }

    setExito(
      `Verificado: esperado ${pesos(resultado.efectivo_esperado)}, contado ${pesos(resultado.efectivo_contado)}, diferencia ${pesos(resultado.diferencia)}.`,
    )
    setSeleccion([])
    setContadoTexto('')
    setNota('')
    setTransferenciasControladas(false)
    queryClient.invalidateQueries({ queryKey: queryKeys.caja })
    queryClient.invalidateQueries({ queryKey: queryKeys.historialPagos })
  }

  if (query.isLoading) return <p className="font-inter text-sm text-on-surface-variant">Cargando…</p>

  if (query.isError || !datos) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <p className="font-inter text-sm text-error">No se pudieron cargar los cierres.</p>
        <Button type="button" variant="ghost" onClick={() => query.refetch()}>
          Reintentar
        </Button>
      </div>
    )
  }

  const { turnos_abiertos: turnos, profes_con_pagos_sin_cerrar: profes } = datos.avisos

  return (
    <div className="flex flex-col gap-6">
      {exito && (
        <p className="rounded-lg border border-primary bg-surface-container-high px-4 py-3 font-inter text-sm text-primary">
          {exito}
        </p>
      )}

      {(turnos.length > 0 || profes.length > 0) && (
        <div className="flex flex-col gap-2 rounded-lg border border-error/50 p-4 font-inter text-sm">
          {turnos.map((t) => (
            <p key={t.asistencia_id} className="text-on-surface">
              <span className="text-error">Turno abierto:</span> {t.profesor}, desde {formatFecha(t.fecha)}
              {t.hora_entrada ? ` ${t.hora_entrada.slice(0, 5)}` : ''}
            </p>
          ))}
          {profes.map((p) => (
            <p key={p.profesor_id} className="text-on-surface">
              <span className="text-error">Pagos sin cerrar:</span> {p.profesor}, {p.cantidad} pago(s), {pesos(p.efectivo)} en
              efectivo, desde {fechaHoraLocal(p.desde)}
            </p>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-end gap-4">
        <DateRangeField
          id="verificar-rango"
          label="Cerrados entre"
          min="2000-01-01"
          desde={desde}
          hasta={hasta}
          onDesdeChange={setDesde}
          onHastaChange={setHasta}
        />
        <div className="pb-2">
          <FormCheckbox
            id="verificar-todos"
            label="Seleccionar todos"
            checked={todosFiltradosTildados}
            disabled={filtrados.length === 0}
            onChange={alternarTodos}
          />
        </div>
      </div>

      {filtrados.length === 0 && (
        <p className="py-6 text-center font-inter text-sm text-on-surface-variant">
          {cierres.length === 0 ? 'No hay cierres para verificar.' : 'Ningún cierre en ese rango.'}
        </p>
      )}

      <div className="flex flex-col gap-2">
        {filtrados.map((c) => {
          const conDiferencia = Number(c.diferencia) !== 0
          return (
            <div
              key={c.cierre_id}
              className={`flex flex-col gap-2 rounded-card border bg-surface-container p-4 ${
                conDiferencia ? 'border-error/60' : 'border-outline-variant'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <FormCheckbox
                  id={`verificar-${c.cierre_id}`}
                  label={`${c.profesor} — ${formatFecha(diaLocal(c.cerrado_en))} ${horaLocal(c.cerrado_en)}`}
                  checked={seleccion.includes(c.cierre_id)}
                  onChange={() => alternar(c.cierre_id)}
                />
                <div className="flex flex-wrap items-center gap-3 font-inter text-sm text-on-surface-variant">
                  {c.modificado && <ChipCaja label="Modificado" tono="alerta" icon="edit_note" />}
                  <span>{c.cantidad_pagos} pago(s)</span>
                  <span>Sistema {pesos(c.efectivo_sistema)}</span>
                  <span className="text-on-surface">Declarado {pesos(c.efectivo_declarado)}</span>
                  {conDiferencia && <span className="font-oswald font-bold text-error">{pesos(c.diferencia)}</span>}
                </div>
              </div>
              {c.observacion && <ObservacionTexto texto={c.observacion} />}
            </div>
          )
        })}
      </div>

      {tildados.length === 0 && Number(datos.cobros_dueno.efectivo) > 0 && (
        <p className="font-inter text-xs text-on-surface-variant">
          Efectivo cobrado por el dueño sin verificar: {pesos(datos.cobros_dueno.efectivo)}. Se verifica junto con al menos
          un cierre.
        </p>
      )}

      {tildados.length > 0 && (
        <div className="sticky bottom-20 z-30 flex flex-col gap-4 rounded-card border border-primary bg-surface-container-high p-5 md:bottom-4">
          {preview.isError && (
            <p className="font-inter text-sm text-error">
              {traducirError(preview.error instanceof Error ? preview.error.message : null, 'No se pudo calcular el esperado.')}
            </p>
          )}

          <div className="flex flex-wrap gap-6 font-inter text-sm text-on-surface-variant">
            <span>{tildados.length} cierre(s)</span>
            <span>Declarado {preview.data ? pesos(preview.data.suma_declarado) : '…'}</span>
            <span>+ Dueño sin verificar {preview.data ? pesos(preview.data.suma_cobros_dueno) : '…'}</span>
          </div>

          <div className="flex flex-wrap items-end gap-6">
            <div className="flex flex-col gap-1">
              <span className="font-oswald text-[11px] uppercase tracking-[0.05em] text-on-surface-variant">
                Efectivo esperado
              </span>
              <span className="font-anton text-[26px] text-on-surface">{esperado !== null ? pesos(esperado) : '…'}</span>
            </div>
            <FormInput
              id="verificar-contado"
              label="Efectivo contado"
              inputMode="decimal"
              placeholder="0,00"
              value={contadoTexto}
              onChange={(e) => setContadoTexto(e.target.value)}
            />
            {diferencia !== null && (
              <div className="flex flex-col gap-1">
                <span className="font-oswald text-[11px] uppercase tracking-[0.05em] text-on-surface-variant">Diferencia</span>
                <span className={`font-oswald text-base font-bold ${diferencia === 0 ? 'text-on-surface' : 'text-error'}`}>
                  {diferencia > 0 ? '+' : ''}
                  {pesos(diferencia)}
                </span>
              </div>
            )}
          </div>

          <FormTextarea
            id="verificar-nota"
            label={faltaNota ? 'Nota (obligatoria si hay diferencia)' : 'Nota'}
            value={nota}
            onChange={(e) => setNota(e.target.value)}
          />

          <FormCheckbox
            id="verificar-transferencias"
            label={`Transferencias controladas (${pesos(totalTransferencias)}, informativo)`}
            checked={transferenciasControladas}
            onChange={(e) => setTransferenciasControladas(e.target.checked)}
          />

          {observaciones.length > 0 && (
            <div className="flex flex-col gap-2 border-t border-outline-variant pt-3">
              <span className="font-oswald text-[11px] uppercase tracking-[0.05em] text-on-surface-variant">
                Observaciones de los cierres tildados
              </span>
              {observaciones.map((c) => (
                <div key={c.cierre_id} className="flex flex-col gap-0.5">
                  <span className="font-inter text-xs text-on-surface-variant">{c.profesor}</span>
                  <ObservacionTexto texto={c.observacion ?? ''} />
                </div>
              ))}
            </div>
          )}

          {error && <p className="font-inter text-sm text-error">{error}</p>}

          <div className="flex justify-end">
            <Button
              type="button"
              variant="solido"
              disabled={verificar.isPending || esperado === null || preview.isFetching || contado === null || faltaNota}
              onClick={confirmar}
            >
              {verificar.isPending ? 'Verificando…' : 'Verificar'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
