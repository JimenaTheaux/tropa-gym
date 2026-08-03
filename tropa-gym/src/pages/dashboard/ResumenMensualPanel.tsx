import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { Alumno } from '@/types/db'
import { traducirError } from '@/lib/errores'
import {
  fetchAlertasResumen,
  periodoActual,
  telefonoWhatsappValido,
  whatsappUrl,
  type AlertasResumen,
} from '@/lib/dashboard'
import { confirmarGeneracionCargos, previewCargosPeriodo } from '@/lib/cargos'
import { useAlumnos } from '@/hooks/useAlumnos'
import { queryKeys } from '@/lib/queryKeys'
import { STALE_OPERATIVO } from '@/lib/queryClient'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { FormMonthInput } from '@/components/ui/FormField'
import { FichaAlumnoDrawer } from '@/components/ui/FichaAlumnoDrawer'
import { BadgeEstadoCargo } from '@/components/ui/BadgeEstado'
import { EditarMontoCargo } from '@/components/ui/EditarMontoCargo'

function money(v: number): string {
  return `$${Math.round(v).toLocaleString('es-AR')}`
}

function AlertaChica({ label, value, info }: { label: string; value: string; info?: string }) {
  return (
    <div className="group relative rounded-card border border-outline-variant bg-surface-container-high/50 px-4 py-3">
      <div className="flex items-center gap-1">
        <p className="font-oswald text-[11px] uppercase tracking-[0.05em] text-on-surface-variant">{label}</p>
        {info && (
          <span
            tabIndex={0}
            className="material-symbols-outlined !text-[13px] text-on-surface-variant/70 outline-none focus-visible:text-primary"
          >
            info
          </span>
        )}
      </div>
      <p className="font-anton text-xl text-on-surface">{value}</p>
      {info && (
        <div className="pointer-events-none absolute left-0 top-full z-20 mt-2 w-64 rounded-lg border border-outline-variant bg-surface-container-highest p-3 font-inter text-xs leading-relaxed text-on-surface opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          {info}
        </div>
      )}
    </div>
  )
}

export function ResumenMensualPanel() {
  const queryClient = useQueryClient()
  const [periodo, setPeriodo] = useState(periodoActual())
  const { data: alumnos = [] } = useAlumnos()
  const [confirmando, setConfirmando] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [confirmError, setConfirmError] = useState<string | null>(null)
  const [liquidacionSuccess, setLiquidacionSuccess] = useState<string | null>(null)
  const [fichaAlumno, setFichaAlumno] = useState<Alumno | null>(null)

  const previewQuery = useQuery({
    queryKey: queryKeys.cargosPreview(periodo),
    queryFn: () => previewCargosPeriodo(periodo),
    staleTime: STALE_OPERATIVO,
  })
  const alertasQuery = useQuery({
    queryKey: queryKeys.dashboardAlertas(periodo),
    queryFn: () => fetchAlertasResumen(periodo),
    staleTime: STALE_OPERATIVO,
  })

  const previewLoading = previewQuery.isFetching
  const filas = previewQuery.data?.filas ?? null
  const liquidacionError = confirmError ?? (previewQuery.data?.error ? traducirError(previewQuery.data.error) : null)

  const alertas: AlertasResumen | null = alertasQuery.data ?? null
  const alertasLoading = alertasQuery.isFetching
  const alertasError = alertasQuery.isError
    ? traducirError(
        alertasQuery.error instanceof Error ? alertasQuery.error.message : null,
        'Error al cargar las alertas',
      )
    : null

  function cargarAlertas() {
    return queryClient.invalidateQueries({ queryKey: queryKeys.dashboardAlertas(periodo) })
  }

  async function confirmarGeneracion() {
    setConfirmando(true)
    setConfirmError(null)
    const { filas: resultado, error } = await confirmarGeneracionCargos(periodo)
    setConfirmando(false)
    setModalOpen(false)
    if (error) {
      setConfirmError(traducirError(error))
      return
    }
    const nuevosCreados = resultado.filter((f) => !f.ya_existe).length
    queryClient.setQueryData(queryKeys.cargosPreview(periodo), {
      error: null,
      filas: resultado.map((f) => ({ ...f, ya_existe: true })),
    })
    setLiquidacionSuccess(`Se generaron ${nuevosCreados} cargo(s) nuevo(s) para el período ${periodo}.`)
    queryClient.invalidateQueries({ queryKey: ['cuenta'] })
    cargarAlertas()
  }

  const nuevos = filas?.filter((f) => !f.ya_existe) ?? []
  const montoTotal = nuevos.reduce((sum, f) => sum + Number(f.monto), 0)
  const estadoLiquidacion: 'pendiente' | 'generada' =
    filas && filas.length > 0 && filas.every((f) => f.ya_existe) ? 'generada' : 'pendiente'

  const deudores = alertas?.deudores ?? []
  const proximosInactivarse = alertas?.proximosInactivarse ?? []
  const horasProfesor = alertas?.horasProfesor ?? []
  const cargosSinDefinir = alertas?.cargosSinDefinir ?? []
  const montoTotalDeuda = deudores.reduce((s, d) => s + d.monto, 0)
  const horasTotalesProfesores = horasProfesor.reduce((s, h) => s + h.horas, 0)

  return (
    <div className="flex flex-col gap-6">
      {/* A. Liquidación del período */}
      <div className="flex flex-col gap-4 rounded-card border border-outline-variant bg-surface-container p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-oswald text-[13px] font-bold uppercase tracking-[0.03em] text-on-surface">
              Liquidación del período
            </p>
            <span
              className="mt-1 inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-inter text-xs font-medium"
              style={
                estadoLiquidacion === 'generada'
                  ? { borderColor: '#40e432', color: '#40e432' }
                  : { borderColor: '#3d4b37', color: '#bbcbb2' }
              }
            >
              <span className="material-symbols-outlined !text-[14px]">
                {estadoLiquidacion === 'generada' ? 'check_circle' : 'hourglass_empty'}
              </span>
              {estadoLiquidacion === 'generada' ? 'Generada' : 'Pendiente'}
            </span>
          </div>
          <FormMonthInput
            id="resumen-periodo"
            label="Período"
            required
            value={periodo}
            onChange={(periodo) => {
              setPeriodo(periodo)
              setLiquidacionSuccess(null)
              setConfirmError(null)
            }}
          />
        </div>

        {liquidacionError && <p className="font-inter text-sm text-error">{liquidacionError}</p>}
        {liquidacionSuccess && (
          <p className="rounded-lg border border-primary bg-surface-container-high px-4 py-3 font-inter text-sm text-primary">
            {liquidacionSuccess}
          </p>
        )}

        {previewLoading && <p className="font-inter text-sm text-on-surface-variant">Calculando preview…</p>}

        {!previewLoading && filas && (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <AlertaChica
                label="Cuotas completas"
                value={String(filas.filter((f) => f.tipo === 'completa').length)}
                info="Alumnos cuya primera asistencia del período fue entre el día 1 y el 14. Se les cobra el precio completo del combo."
              />
              <AlertaChica
                label="Medias cuotas"
                value={String(filas.filter((f) => f.tipo === 'media').length)}
                info="Alumnos cuya primera asistencia del período fue del día 15 en adelante. Se les cobra la mitad del precio del combo."
              />
              <AlertaChica
                label="Alumnos sin asistencia"
                value={String(
                  alumnos.filter(
                    (a) => a.estado === 'activo' && !filas.some((f) => f.alumno_id === a.id),
                  ).length,
                )}
                info="Alumnos activos que no registraron ninguna asistencia en el período — no se les genera cargo."
              />
              <AlertaChica
                label="Monto a generar"
                value={money(montoTotal)}
                info="Suma de los cargos nuevos a crear. El precio de cada uno sale del combo con el que el alumno pagó el período anterior (o su plan actual si es la primera vez), según el precio vigente de ese combo."
              />
            </div>

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
          </>
        )}
      </div>

      {alertasError && <p className="font-inter text-sm text-error">{alertasError}</p>}

      {/* B. Fila de alertas */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <AlertaChica
          label="Alumnos con deuda"
          value={alertasLoading ? '…' : `${deudores.length} · ${money(montoTotalDeuda)}`}
        />
        <AlertaChica
          label="Próximos a inactivarse"
          value={alertasLoading ? '…' : String(proximosInactivarse.length)}
        />
        <AlertaChica
          label="Horas de profesores en el período"
          value={alertasLoading ? '…' : `${Math.round(horasTotalesProfesores * 10) / 10} hs`}
        />
        <AlertaChica
          label="Cargos sin monto definido"
          value={alertasLoading ? '…' : String(cargosSinDefinir.length)}
          info="Alumnos con asistencia en el período pero sin combo/precio resuelto — el cargo se generó igual, con el monto a completar manualmente."
        />
      </div>

      {/* C. Panel Deudores */}
      <div className="rounded-card border border-outline-variant bg-surface-container p-5">
        <p className="mb-4 font-oswald text-[13px] font-bold uppercase tracking-[0.03em] text-on-surface">
          Deudores
        </p>
        {alertasLoading && <p className="font-inter text-sm text-on-surface-variant">Cargando…</p>}
        {!alertasLoading && deudores.length === 0 && (
          <p className="font-inter text-sm text-on-surface-variant">No hay alumnos con deuda.</p>
        )}
        <div className="flex flex-col gap-3">
          {deudores.map((d) => {
            const telValido = telefonoWhatsappValido(d.alumno.telefono)
            return (
              <div
                key={d.alumno.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-outline-variant px-4 py-3"
              >
                <div>
                  <p className="font-inter text-sm font-medium text-on-surface">
                    {d.alumno.nombre} {d.alumno.apellido}
                  </p>
                  <p className="font-inter text-xs text-on-surface-variant">
                    {d.diasVencimiento} día(s) de vencimiento
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <p className="font-anton text-lg" style={{ color: '#ffb4ab' }}>
                    {money(d.monto)}
                  </p>
                  <BadgeEstadoCargo estado={d.estado} />
                </div>
                <div className="flex items-center gap-2">
                  {telValido ? (
                    <a
                      href={whatsappUrl(d.alumno.telefono as string)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-primary bg-surface-container-high px-4 py-2 font-oswald text-[13px] font-semibold uppercase tracking-[0.03em] text-primary hover:bg-surface-container-highest"
                    >
                      <span className="material-symbols-outlined !text-[16px]">chat</span>
                      WhatsApp
                    </a>
                  ) : (
                    <span
                      title="Teléfono no cargado o en formato inválido — no se puede abrir WhatsApp"
                      className="inline-flex cursor-not-allowed items-center justify-center gap-1.5 rounded-lg border border-outline-variant bg-transparent px-4 py-2 font-oswald text-[13px] font-semibold uppercase tracking-[0.03em] text-on-surface-variant opacity-50"
                    >
                      <span className="material-symbols-outlined !text-[16px]">chat</span>
                      WhatsApp
                    </span>
                  )}
                  <Button type="button" variant="ghost" onClick={() => setFichaAlumno(d.alumno)}>
                    Ver ficha
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* C.2 Panel Cargos sin monto definido */}
      {!alertasLoading && cargosSinDefinir.length > 0 && (
        <div className="rounded-card border border-outline-variant bg-surface-container p-5">
          <p className="mb-1 font-oswald text-[13px] font-bold uppercase tracking-[0.03em] text-error">
            Cargos sin monto definido
          </p>
          <p className="mb-4 font-inter text-xs text-on-surface-variant">
            No se pudo resolver combo/precio para estos alumnos (sin plan asignado y sin pago previo). Completá el
            monto a mano.
          </p>
          <div className="flex flex-col gap-3">
            {cargosSinDefinir.map((c) => (
              <div key={c.cargoId} className="flex flex-col gap-2 rounded-lg border border-outline-variant px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-inter text-sm font-medium text-on-surface">
                    {c.alumno.nombre} {c.alumno.apellido} — {c.periodo} —{' '}
                    {c.tipo === 'completa' ? 'Cuota completa' : 'Media cuota'}
                  </p>
                  <Button type="button" variant="ghost" onClick={() => setFichaAlumno(c.alumno)}>
                    Ver ficha
                  </Button>
                </div>
                <EditarMontoCargo
                  cargoId={c.cargoId}
                  montoActual={c.monto}
                  label="Monto del cargo"
                  onGuardado={cargarAlertas}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* D. Panel Próximos a inactivarse */}
      <div className="rounded-card border border-outline-variant bg-surface-container p-5">
        <p className="mb-4 font-oswald text-[13px] font-bold uppercase tracking-[0.03em] text-on-surface">
          Próximos a inactivarse
        </p>
        {alertasLoading && <p className="font-inter text-sm text-on-surface-variant">Cargando…</p>}
        {!alertasLoading && proximosInactivarse.length === 0 && (
          <p className="font-inter text-sm text-on-surface-variant">Ningún alumno en alerta.</p>
        )}
        <div className="flex flex-col gap-3">
          {proximosInactivarse.map((p) => (
            <div
              key={p.alumno.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-outline-variant px-4 py-3"
            >
              <div>
                <p className="font-inter text-sm font-medium text-on-surface">
                  {p.alumno.nombre} {p.alumno.apellido}
                </p>
                <p className="font-inter text-xs" style={{ color: '#8fd87f' }}>
                  {p.diasSinAsistir} día(s) sin asistir
                </p>
              </div>
              <Button type="button" variant="ghost" onClick={() => setFichaAlumno(p.alumno)}>
                Ver ficha
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* E. Panel Horas por profesor */}
      <div className="overflow-x-auto rounded-card border border-outline-variant">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="bg-surface-container-high/50">
              <th className="px-4 py-3 font-oswald text-[11px] font-medium uppercase tracking-[0.05em] text-on-surface-variant">
                Profesor
              </th>
              <th className="px-4 py-3 font-oswald text-[11px] font-medium uppercase tracking-[0.05em] text-on-surface-variant">
                Horas del mes
              </th>
              <th className="px-4 py-3 font-oswald text-[11px] font-medium uppercase tracking-[0.05em] text-on-surface-variant">
                Asistencias registradas
              </th>
            </tr>
          </thead>
          <tbody>
            {alertasLoading && (
              <tr>
                <td colSpan={3} className="px-4 py-10 text-center font-inter text-sm text-on-surface-variant">
                  Cargando…
                </td>
              </tr>
            )}
            {!alertasLoading && horasProfesor.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-10 text-center font-inter text-sm text-on-surface-variant">
                  Sin registros en el período.
                </td>
              </tr>
            )}
            {horasProfesor.map((h) => (
              <tr key={h.profesor.id} className="border-t border-outline-variant">
                <td className="px-4 py-3 font-inter text-sm text-on-surface">
                  {h.profesor.nombre} {h.profesor.apellido}
                </td>
                <td className="px-4 py-3 font-inter text-sm text-on-surface">{h.horas} hs</td>
                <td className="px-4 py-3 font-inter text-sm text-on-surface-variant">{h.asistencias}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={modalOpen}
        title="Generar cargos del período"
        message={`Se van a generar ${nuevos.length} cargo(s) nuevo(s) para el período ${periodo}, por un total de ${money(montoTotal)}. Esta es la única vía para liquidar el período. ¿Confirmás?`}
        confirmLabel="Generar cargos"
        loading={confirmando}
        onConfirm={confirmarGeneracion}
        onCancel={() => setModalOpen(false)}
      />

      <FichaAlumnoDrawer alumno={fichaAlumno} onClose={() => setFichaAlumno(null)} />
    </div>
  )
}
