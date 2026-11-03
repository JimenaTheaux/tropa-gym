import { Fragment, useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { Alumno, Cargo, EstadoAlumno, EstadoPago, TipoCargo } from '@/types/db'
import { traducirError } from '@/lib/errores'
import {
  fetchAlertasResumen,
  fetchDeudores,
  periodoActual,
  periodoLabel,
  telefonoWhatsappValido,
  type AlertasResumen,
  type Deudor,
  type ModoDeuda,
} from '@/lib/dashboard'
import { esCargoExento, fetchCargosPeriodo } from '@/lib/cargos'
import { queryKeys } from '@/lib/queryKeys'
import { STALE_OPERATIVO } from '@/lib/queryClient'
import { useAlumnos } from '@/hooks/useAlumnos'
import { Button } from '@/components/ui/button'
import { FormMonthInput, FormInput, FormSelect } from '@/components/ui/FormField'
import { FichaAlumnoDrawer } from '@/components/ui/FichaAlumnoDrawer'
import { BadgeEstado, BadgeEstadoCargo } from '@/components/ui/BadgeEstado'
import { EditarMontoCargo } from '@/components/ui/EditarMontoCargo'
import { AsistenciasPeriodoDrawer } from '@/components/ui/AsistenciasPeriodoDrawer'
import { PagosPeriodoDrawer } from '@/components/ui/PagosPeriodoDrawer'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { WhatsAppDeudaDialog } from '@/components/ui/WhatsAppDeudaDialog'
import { WhatsAppIcon } from '@/components/ui/WhatsAppIcon'

const FILTRO_ESTADO_DEUDA_OPTIONS = [
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'parcial', label: 'Parcial' },
]

const FILTRO_ESTADO_ALUMNO_OPTIONS = [
  { value: 'activo', label: 'Activos' },
  { value: 'inactivo', label: 'Inactivos' },
]

const MODO_DEUDA_OPTIONS: { value: ModoDeuda; label: string }[] = [
  { value: 'periodo', label: 'Este período' },
  { value: 'anteriores', label: 'Anteriores' },
  { value: 'total', label: 'Total a hoy' },
]

const DESGLOSE_ANTERIORES_MAX = 3

const TH_CLASE =
  'px-4 py-3 font-oswald text-[11px] font-medium uppercase tracking-[0.05em] text-on-surface-variant'

const FILTRO_TIPO_OPTIONS = [
  { value: 'completa', label: 'Cuota completa' },
  { value: 'media', label: 'Media cuota' },
]

function money(v: number): string {
  return `$${Math.round(v).toLocaleString('es-AR')}`
}

type Tono = 'verde' | 'rojo' | 'ambar' | 'blanco'

const TONO_CLASE: Record<Tono, string> = {
  verde: 'text-primary-fixed-dim',
  rojo: 'text-error',
  ambar: 'text-warning',
  blanco: 'text-on-surface',
}

function InfoIcon({ info }: { info: string }) {
  return (
    <>
      <span
        tabIndex={0}
        className="material-symbols-outlined !text-[13px] text-on-surface-variant/70 outline-none focus-visible:text-primary"
      >
        info
      </span>
      <div className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 w-64 -translate-x-1/2 rounded-lg border border-outline-variant bg-surface-container-highest p-3 font-inter text-xs leading-relaxed text-on-surface opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        {info}
      </div>
    </>
  )
}

// Card de valor único (o combinado con nodos de color mixto vía `value`).
// `tono` colorea el número entero; para mezclar colores dentro del valor
// (ej. cantidad en blanco + monto en rojo), pasar `value` como JSX con
// spans ya coloreados y dejar `tono` en su default.
function AlertaChica({
  label,
  value,
  info,
  tono = 'blanco',
  detalle,
}: {
  label: string
  value: ReactNode
  info?: string
  tono?: Tono
  detalle?: ReactNode
}) {
  return (
    <div className="group relative mx-auto flex w-full max-w-[190px] flex-col items-center gap-0.5 rounded-card border border-outline-variant bg-surface-container-high/50 px-3 py-3 text-center">
      <div className="flex items-center gap-1">
        <p className="font-oswald text-[10px] uppercase tracking-[0.05em] text-on-surface-variant">{label}</p>
        {info && <InfoIcon info={info} />}
      </div>
      <p className={`font-anton text-2xl leading-tight ${TONO_CLASE[tono]}`}>{value}</p>
      {detalle}
    </div>
  )
}

// Cantidad en blanco + monto en rojo: alumnos · $ de una card de deuda.
function ValorDeuda({ alumnos, monto }: { alumnos: number; monto: number }) {
  return (
    <>
      <span className="text-on-surface">{alumnos}</span>
      <span className="text-on-surface-variant"> · </span>
      <span className="text-error">{money(monto)}</span>
    </>
  )
}

// Card de fracción (parte lograda / total) con jerarquía de dos colores:
// la parte en verde, el total en gris claro, y una etiqueta apilada por
// cada color exactamente debajo del número (todo centrado).
function AlertaFraccion({
  label,
  parte,
  total,
  labelParte,
  labelTotal,
  exentas = 0,
  info,
}: {
  label: string
  parte: number
  total: number
  labelParte: string
  labelTotal: string
  exentas?: number
  info?: string
}) {
  return (
    <div className="group relative mx-auto flex w-full max-w-[190px] flex-col items-center gap-0.5 rounded-card border border-outline-variant bg-surface-container-high/50 px-3 py-3 text-center">
      <div className="flex items-center gap-1">
        <p className="font-oswald text-[10px] uppercase tracking-[0.05em] text-on-surface-variant">{label}</p>
        {info && <InfoIcon info={info} />}
      </div>
      <p className="font-anton text-3xl leading-tight">
        <span className="text-primary-fixed-dim">{parte}</span>
        <span className="text-on-surface-variant">/</span>
        <span className="text-on-surface">{total}</span>
      </p>
      <div className="flex flex-col leading-tight">
        <span className="font-inter text-[12px] font-semibold text-primary-fixed-dim">{labelParte}</span>
        <span className="font-inter text-[12px] font-semibold text-on-surface-variant">{labelTotal}</span>
        {exentas > 0 && (
          <span className="font-inter text-[12px] text-on-surface-variant">
            {exentas} {exentas === 1 ? 'exenta' : 'exentas'}
          </span>
        )}
      </div>
    </div>
  )
}

export function ResumenMensualPanel() {
  const queryClient = useQueryClient()
  const [periodo, setPeriodo] = useState(periodoActual())
  const [fichaAlumno, setFichaAlumno] = useState<Alumno | null>(null)
  const [editandoDeudaCargoId, setEditandoDeudaCargoId] = useState<string | null>(null)
  const [editandoSinDefinirCargoId, setEditandoSinDefinirCargoId] = useState<string | null>(null)
  const [verAsistenciasDe, setVerAsistenciasDe] = useState<{ alumnoId: string; nombre: string; periodo: string } | null>(
    null,
  )
  // Sin período: trae todo el historial de pagos del alumno, no solo el del
  // período que disparó la alerta (pedido explícito — acá interesa ver el
  // cuadro completo, a diferencia de la pantalla Cargos donde sí se acota).
  const [verPagosDe, setVerPagosDe] = useState<{ alumnoId: string; nombre: string } | null>(null)

  const [modoDeuda, setModoDeuda] = useState<ModoDeuda>('periodo')
  const [deudorAbiertoId, setDeudorAbiertoId] = useState<string | null>(null)
  const [whatsappDe, setWhatsappDe] = useState<Deudor | null>(null)
  const [buscarDeudor, setBuscarDeudor] = useState('')
  const [filtroEstadoDeudor, setFiltroEstadoDeudor] = useState<EstadoPago | ''>('')
  const [filtroEstadoAlumno, setFiltroEstadoAlumno] = useState<EstadoAlumno | ''>('')
  const [buscarSinDefinir, setBuscarSinDefinir] = useState('')
  const [filtroTipoSinDefinir, setFiltroTipoSinDefinir] = useState<TipoCargo | ''>('')

  // Cargos continuos (migración 22): no hay "generar" — cada asistencia crea
  // o actualiza el cargo sola. Este panel solo lee el estado vigente.
  const cargosQuery = useQuery({
    queryKey: queryKeys.cargosPeriodo(periodo),
    queryFn: () => fetchCargosPeriodo(periodo),
    staleTime: STALE_OPERATIVO,
  })
  const alertasQuery = useQuery({
    queryKey: queryKeys.dashboardAlertas(periodo),
    queryFn: () => fetchAlertasResumen(periodo),
    staleTime: STALE_OPERATIVO,
  })
  const deudoresQuery = useQuery({
    queryKey: queryKeys.dashboardDeudores(periodo, modoDeuda),
    queryFn: () => fetchDeudores(periodo, modoDeuda),
    staleTime: STALE_OPERATIVO,
  })
  const { data: alumnos = [] } = useAlumnos()

  const cargosLoading = cargosQuery.isFetching
  const cargosPeriodo = [...(cargosQuery.data ?? new Map<string, Cargo>()).values()]

  const alertas: AlertasResumen | null = alertasQuery.data ?? null
  const alertasLoading = alertasQuery.isFetching
  const alertasError = alertasQuery.isError
    ? traducirError(
        alertasQuery.error instanceof Error ? alertasQuery.error.message : null,
        'Error al cargar las alertas',
      )
    : null

  const deudoresLoading = deudoresQuery.isFetching
  const deudoresError = deudoresQuery.isError
    ? traducirError(
        deudoresQuery.error instanceof Error ? deudoresQuery.error.message : null,
        'Error al cargar los deudores',
      )
    : null
  const mirandoMesPasado = periodo < periodoActual()

  function cargarAlertas() {
    return queryClient.invalidateQueries({ queryKey: queryKeys.dashboardAlertasTodas })
  }

  function abrirFicha(alumnoId: string) {
    setFichaAlumno(alumnos.find((a) => a.id === alumnoId) ?? null)
  }

  // Las exentas van aparte: no entró plata, la fracción es solo de lo que se cobra.
  const cargosACobrar = cargosPeriodo.filter((c) => !esCargoExento(c.monto, c.monto_definido))
  const completas = cargosACobrar.filter((c) => c.tipo === 'completa').length
  const completasPagadas = cargosACobrar.filter((c) => c.tipo === 'completa' && c.estado === 'pagado').length
  const completasExentas = cargosPeriodo.filter((c) => c.tipo === 'completa').length - completas
  const medias = cargosACobrar.filter((c) => c.tipo === 'media').length
  const mediasPagadas = cargosACobrar.filter((c) => c.tipo === 'media' && c.estado === 'pagado').length
  const mediasExentas = cargosPeriodo.filter((c) => c.tipo === 'media').length - medias
  const montoTotal = cargosPeriodo.reduce((sum, c) => sum + Number(c.monto), 0)

  const deudores = deudoresQuery.data ?? []
  const deudaAnteriorPorMes = alertas?.deudaAnteriorPorMes ?? []
  const proximosInactivarse = alertas?.proximosInactivarse ?? []
  const horasProfesor = alertas?.horasProfesor ?? []
  const cargosSinDefinir = alertas?.cargosSinDefinir ?? []
  const alumnosSinCargo = alertas?.alumnosSinCargo ?? []
  const horasTotalesProfesores = horasProfesor.reduce((s, h) => s + h.horas, 0)

  const buscarDeudorTerm = buscarDeudor.trim().toLowerCase()
  const hayFiltroDeudor = !!(filtroEstadoDeudor || filtroEstadoAlumno || buscarDeudorTerm)
  const deudoresFiltrados = deudores.filter((d) => {
    if (filtroEstadoDeudor && !d.detalle.some((m) => m.cargoEstado === filtroEstadoDeudor)) return false
    if (filtroEstadoAlumno && d.estadoAlumno !== filtroEstadoAlumno) return false
    if (buscarDeudorTerm) {
      const nombre = `${d.nombre} ${d.apellido}`.toLowerCase()
      if (!nombre.includes(buscarDeudorTerm)) return false
    }
    return true
  })

  const buscarSinDefinirTerm = buscarSinDefinir.trim().toLowerCase()
  const cargosSinDefinirFiltrados = cargosSinDefinir.filter((c) => {
    if (filtroTipoSinDefinir && c.tipo !== filtroTipoSinDefinir) return false
    if (buscarSinDefinirTerm) {
      const nombre = `${c.alumno.nombre} ${c.alumno.apellido}`.toLowerCase()
      if (!nombre.includes(buscarSinDefinirTerm)) return false
    }
    return true
  })

  return (
    <div className="flex flex-col gap-6">
      {/* A. Cargos del período — lectura en vivo, sin botón "generar" (migración 22:
          cada asistencia crea/actualiza el cargo sola vía trigger de base). */}
      <div className="flex flex-col gap-4 rounded-card border border-outline-variant bg-surface-container p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="font-oswald text-[13px] font-bold uppercase tracking-[0.03em] text-on-surface">
            Cargos del período
          </p>
          <FormMonthInput
            id="resumen-periodo"
            label="Período"
            required
            value={periodo}
            onChange={setPeriodo}
          />
        </div>

        {cargosLoading && <p className="font-inter text-sm text-on-surface-variant">Cargando…</p>}

        {!cargosLoading && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <AlertaFraccion
              label="Cuotas completas"
              parte={completasPagadas}
              total={completas}
              labelParte="pagadas"
              labelTotal="cuotas"
              exentas={completasExentas}
              info="Alumnos cuya primera asistencia del período fue entre el día 1 y el 14 (precio completo del combo). El número verde es cuántos de esos cargos ya están pagados. Los cargos exentos ($0 por acuerdo) no entran en la fracción."
            />
            <AlertaFraccion
              label="Medias cuotas"
              parte={mediasPagadas}
              total={medias}
              labelParte="pagadas"
              labelTotal="cuotas"
              exentas={mediasExentas}
              info="Alumnos cuya primera asistencia del período fue del día 15 en adelante (mitad del precio del combo). El número verde es cuántos de esos cargos ya están pagados. Los cargos exentos ($0 por acuerdo) no entran en la fracción."
            />
            <AlertaChica
              label="Situaciones a definir"
              value={alertasLoading ? '…' : cargosSinDefinir.length}
              tono="ambar"
              info="Alumnos con asistencia en el período pero sin combo/precio resuelto — el cargo se generó igual, con el monto a completar manualmente."
            />
            <AlertaChica label="Facturado del período" value={money(montoTotal)} tono="blanco" />
          </div>
        )}
      </div>

      {alertasError && <p className="font-inter text-sm text-error">{alertasError}</p>}

      {/* B. Fila de alertas */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <AlertaChica
          label="Deuda del período"
          info={
            mirandoMesPasado
              ? 'Pendiente a hoy de este mes, no al cierre: ya descuenta los pagos cargados después. No resta el saldo a favor.'
              : 'Alumnos y monto pendientes de este mes, incluso si todavía no venció. No resta el saldo a favor.'
          }
          value={
            alertasError ? '—' : alertasLoading || !alertas ? '…' : <ValorDeuda {...alertas.deuda.periodo} />
          }
        />
        <AlertaChica
          label="Deuda de meses anteriores"
          info="Alumnos y monto pendientes a hoy de los meses previos al elegido. No resta el saldo a favor."
          value={
            alertasError ? (
              '—'
            ) : alertasLoading || !alertas ? (
              '…'
            ) : alertas.deuda.anteriores.alumnos === 0 ? (
              <span className="font-inter text-sm text-on-surface-variant">Sin deuda anterior</span>
            ) : (
              <ValorDeuda {...alertas.deuda.anteriores} />
            )
          }
          detalle={
            !alertasError &&
            !alertasLoading &&
            deudaAnteriorPorMes.length > 0 && (
              <div className="mt-1 flex flex-col font-inter text-[11px] leading-snug text-on-surface-variant">
                {deudaAnteriorPorMes.slice(0, DESGLOSE_ANTERIORES_MAX).map((m) => (
                  <span key={m.periodo}>
                    {periodoLabel(m.periodo)}: {m.alumnos} · {money(m.monto)}
                  </span>
                ))}
                {deudaAnteriorPorMes.length > DESGLOSE_ANTERIORES_MAX && (
                  <span>+{deudaAnteriorPorMes.length - DESGLOSE_ANTERIORES_MAX}</span>
                )}
              </div>
            )
          }
        />
        <AlertaChica
          label="Próximos a inactivarse"
          value={alertasError ? '—' : alertasLoading ? '…' : proximosInactivarse.length}
          tono="ambar"
        />
        <AlertaChica
          label="Horas de profesores en el período"
          value={alertasError ? '—' : alertasLoading ? '…' : `${horasTotalesProfesores} hs`}
          tono="blanco"
        />
      </div>

      {/* C. Panel Deudores — tabla filtrable/editable */}
      <div className="rounded-card border border-outline-variant bg-surface-container p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <p className="font-oswald text-[13px] font-bold uppercase tracking-[0.03em] text-on-surface">Deudores</p>
            {mirandoMesPasado && (
              <span className="font-inter text-xs text-on-surface-variant">Pendiente a hoy</span>
            )}
          </div>
          <SegmentedControl value={modoDeuda} onChange={setModoDeuda} options={MODO_DEUDA_OPTIONS} />
        </div>

        <div className="mb-4 flex flex-wrap items-end gap-4">
          <div className="w-full sm:w-64">
            <FormInput
              id="deudores-buscar-nombre"
              label="Buscar alumno"
              placeholder="Nombre o apellido…"
              value={buscarDeudor}
              onChange={(e) => setBuscarDeudor(e.target.value)}
            />
          </div>
          <div className="w-full sm:w-48">
            <FormSelect
              id="deudores-filtro-estado"
              label="Estado"
              placeholder="Todos"
              value={filtroEstadoDeudor}
              onChange={(e) => setFiltroEstadoDeudor(e.target.value as EstadoPago | '')}
              options={FILTRO_ESTADO_DEUDA_OPTIONS}
            />
          </div>
          <div className="w-full sm:w-48">
            <FormSelect
              id="deudores-filtro-alumno"
              label="Alumno"
              placeholder="Todos"
              value={filtroEstadoAlumno}
              onChange={(e) => setFiltroEstadoAlumno(e.target.value as EstadoAlumno | '')}
              options={FILTRO_ESTADO_ALUMNO_OPTIONS}
            />
          </div>
        </div>

        {deudoresError && <p className="font-inter text-sm text-error">{deudoresError}</p>}
        {!deudoresError && deudoresLoading && (
          <p className="font-inter text-sm text-on-surface-variant">Cargando…</p>
        )}
        {!deudoresError && !deudoresLoading && deudores.length === 0 && (
          <p className="font-inter text-sm text-on-surface-variant">No hay alumnos con deuda.</p>
        )}
        {!deudoresError && !deudoresLoading && deudores.length > 0 && hayFiltroDeudor && (
          <p className="mb-2 font-inter text-xs text-on-surface-variant">
            Mostrando {deudoresFiltrados.length} de {deudores.length}
          </p>
        )}

        {!deudoresError && !deudoresLoading && deudores.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-outline-variant">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-surface-container-high/50">
                  <th className={TH_CLASE}>Alumno</th>
                  <th className={TH_CLASE}>Meses</th>
                  <th className={TH_CLASE}>Deuda</th>
                  <th className={TH_CLASE}>Neto</th>
                  <th className={TH_CLASE}>Vencimiento</th>
                  <th className={TH_CLASE}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {deudoresFiltrados.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center font-inter text-sm text-on-surface-variant">
                      Ningún deudor coincide con el filtro.
                    </td>
                  </tr>
                )}
                {deudoresFiltrados.map((d) => {
                  const telValido = telefonoWhatsappValido(d.telefono)
                  const nombreCompleto = `${d.nombre} ${d.apellido}`
                  const abierto = deudorAbiertoId === d.alumnoId
                  return (
                    <Fragment key={d.alumnoId}>
                      <tr className="border-t border-outline-variant">
                        <td className="px-4 py-2 font-inter text-sm text-on-surface">
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setDeudorAbiertoId(abierto ? null : d.alumnoId)}
                              aria-expanded={abierto}
                              aria-label={`${abierto ? 'Ocultar' : 'Ver'} detalle por mes de ${nombreCompleto}`}
                              className="inline-flex items-center gap-1 whitespace-nowrap text-left hover:text-primary"
                            >
                              <span className="material-symbols-outlined !text-[18px] text-on-surface-variant">
                                {abierto ? 'expand_less' : 'expand_more'}
                              </span>
                              {nombreCompleto}
                            </button>
                            {d.estadoAlumno === 'inactivo' && <BadgeEstado estado="inactivo" />}
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-2 font-inter text-sm text-on-surface-variant">
                          {d.mesesAdeudados}
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className="whitespace-nowrap font-oswald text-sm font-bold"
                              style={{ color: '#ffb4ab' }}
                            >
                              {money(d.deudaBruta)}
                            </span>
                            {d.aFavor > 0 && (
                              <span
                                className="whitespace-nowrap rounded-full border px-2.5 py-0.5 font-inter text-xs font-medium"
                                style={{ borderColor: '#8fd87f', color: '#8fd87f' }}
                              >
                                a favor {money(d.aFavor)}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-2 font-oswald text-sm font-bold text-on-surface">
                          {money(d.neto)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2 font-inter text-sm text-on-surface-variant">
                          {d.diasVencimiento} día(s)
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex flex-wrap items-center gap-3">
                            <button
                              type="button"
                              onClick={() => setVerPagosDe({ alumnoId: d.alumnoId, nombre: nombreCompleto })}
                              aria-label="Ver historial de pagos"
                              title="Ver historial de pagos"
                              className="inline-flex items-center text-on-surface-variant hover:text-primary"
                            >
                              <span className="material-symbols-outlined !text-[18px]">payments</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => abrirFicha(d.alumnoId)}
                              className="inline-flex items-center gap-1 whitespace-nowrap font-inter text-xs font-medium text-on-surface-variant hover:text-primary"
                            >
                              <span className="material-symbols-outlined !text-[16px]">badge</span>
                              Ficha de alumno
                            </button>
                            {telValido ? (
                              <button
                                type="button"
                                onClick={() => setWhatsappDe(d)}
                                aria-label={`WhatsApp a ${nombreCompleto}`}
                                title="WhatsApp"
                                className="inline-flex items-center text-on-surface-variant hover:text-primary"
                              >
                                <WhatsAppIcon className="h-[18px] w-[18px]" />
                              </button>
                            ) : (
                              <span
                                title="Teléfono no cargado o en formato inválido — no se puede abrir WhatsApp"
                                className="inline-flex cursor-not-allowed items-center text-on-surface-variant opacity-40"
                              >
                                <WhatsAppIcon className="h-[18px] w-[18px]" />
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                      {abierto && (
                        <tr className="bg-surface-container-low">
                          <td colSpan={6} className="px-4 py-3">
                            <table className="w-full border-collapse text-left">
                              <thead>
                                <tr>
                                  <th className={TH_CLASE}>Mes</th>
                                  <th className={TH_CLASE}>Monto del cargo</th>
                                  <th className={TH_CLASE}>Pagado</th>
                                  <th className={TH_CLASE}>Saldo</th>
                                  <th className={TH_CLASE}>Estado</th>
                                  <th className={TH_CLASE}>Asistencias</th>
                                </tr>
                              </thead>
                              <tbody>
                                {d.detalle.map((m) => (
                                  <tr key={m.cargoId} className="border-t border-outline-variant">
                                    <td className="whitespace-nowrap px-4 py-2 font-inter text-sm text-on-surface">
                                      {periodoLabel(m.periodo)}
                                    </td>
                                    <td className="px-4 py-2 font-inter text-sm text-on-surface">
                                      {editandoDeudaCargoId === m.cargoId ? (
                                        <EditarMontoCargo
                                          cargoId={m.cargoId}
                                          montoActual={m.cargoMonto}
                                          label="Monto del cargo"
                                          onGuardado={() => {
                                            setEditandoDeudaCargoId(null)
                                            cargarAlertas()
                                          }}
                                          onCancelar={() => setEditandoDeudaCargoId(null)}
                                        />
                                      ) : (
                                        <div className="flex items-center gap-2">
                                          <span className="whitespace-nowrap">{money(m.cargoMonto)}</span>
                                          <button
                                            type="button"
                                            onClick={() => setEditandoDeudaCargoId(m.cargoId)}
                                            aria-label={`Editar monto del cargo de ${nombreCompleto}, ${periodoLabel(m.periodo)}`}
                                            className="text-on-surface-variant hover:text-primary"
                                          >
                                            <span className="material-symbols-outlined !text-[16px]">edit</span>
                                          </button>
                                        </div>
                                      )}
                                    </td>
                                    <td className="whitespace-nowrap px-4 py-2 font-inter text-sm text-on-surface-variant">
                                      {money(m.pagado)}
                                    </td>
                                    <td
                                      className="whitespace-nowrap px-4 py-2 font-oswald text-sm font-bold"
                                      style={{ color: '#ffb4ab' }}
                                    >
                                      {money(m.saldo)}
                                    </td>
                                    <td className="px-4 py-2">
                                      <BadgeEstadoCargo estado={m.cargoEstado} />
                                    </td>
                                    <td className="px-4 py-2">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setVerAsistenciasDe({
                                            alumnoId: d.alumnoId,
                                            nombre: nombreCompleto,
                                            periodo: m.periodo,
                                          })
                                        }
                                        aria-label={`Ver asistencias de ${periodoLabel(m.periodo)}`}
                                        title="Ver asistencias"
                                        className="inline-flex items-center text-on-surface-variant hover:text-primary"
                                      >
                                        <span className="material-symbols-outlined !text-[18px]">event_available</span>
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* C.2 Panel Cargos sin monto definido — tabla filtrable/editable */}
      {!alertasLoading && cargosSinDefinir.length > 0 && (
        <div className="rounded-card border border-outline-variant bg-surface-container p-5">
          <p className="mb-1 font-oswald text-[13px] font-bold uppercase tracking-[0.03em] text-error">
            Cargos sin monto definido
          </p>
          <p className="mb-4 font-inter text-xs text-on-surface-variant">
            No se pudo resolver combo/precio para estos alumnos (sin plan asignado y sin pago previo). Completá el
            monto a mano.
          </p>

          <div className="mb-4 flex flex-wrap items-end gap-4">
            <div className="w-full sm:w-64">
              <FormInput
                id="sindefinir-buscar-nombre"
                label="Buscar alumno"
                placeholder="Nombre o apellido…"
                value={buscarSinDefinir}
                onChange={(e) => setBuscarSinDefinir(e.target.value)}
              />
            </div>
            <div className="w-full sm:w-48">
              <FormSelect
                id="sindefinir-filtro-tipo"
                label="Tipo"
                placeholder="Todos"
                value={filtroTipoSinDefinir}
                onChange={(e) => setFiltroTipoSinDefinir(e.target.value as TipoCargo | '')}
                options={FILTRO_TIPO_OPTIONS}
              />
            </div>
          </div>

          {(filtroTipoSinDefinir || buscarSinDefinirTerm) && (
            <p className="mb-2 font-inter text-xs text-on-surface-variant">
              Mostrando {cargosSinDefinirFiltrados.length} de {cargosSinDefinir.length}
            </p>
          )}

          <div className="overflow-x-auto rounded-lg border border-outline-variant">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-surface-container-high/50">
                  <th className="px-4 py-3 font-oswald text-[11px] font-medium uppercase tracking-[0.05em] text-on-surface-variant">
                    Alumno
                  </th>
                  <th className="px-4 py-3 font-oswald text-[11px] font-medium uppercase tracking-[0.05em] text-on-surface-variant">
                    Período
                  </th>
                  <th className="px-4 py-3 font-oswald text-[11px] font-medium uppercase tracking-[0.05em] text-on-surface-variant">
                    Tipo
                  </th>
                  <th className="px-4 py-3 font-oswald text-[11px] font-medium uppercase tracking-[0.05em] text-on-surface-variant">
                    Monto
                  </th>
                  <th className="px-4 py-3 font-oswald text-[11px] font-medium uppercase tracking-[0.05em] text-on-surface-variant">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {cargosSinDefinirFiltrados.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center font-inter text-sm text-on-surface-variant">
                      Ningún cargo coincide con el filtro.
                    </td>
                  </tr>
                )}
                {cargosSinDefinirFiltrados.map((c) => (
                  <tr key={c.cargoId} className="border-t border-outline-variant">
                    <td className="whitespace-nowrap px-4 py-2 font-inter text-sm text-on-surface">
                      {c.alumno.nombre} {c.alumno.apellido}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 font-inter text-sm text-on-surface-variant">{c.periodo}</td>
                    <td className="whitespace-nowrap px-4 py-2 font-inter text-sm text-on-surface">
                      {c.tipo === 'completa' ? 'Cuota completa' : 'Media cuota'}
                    </td>
                    <td className="px-4 py-2 font-inter text-sm text-on-surface">
                      {editandoSinDefinirCargoId === c.cargoId ? (
                        <EditarMontoCargo
                          cargoId={c.cargoId}
                          montoActual={c.monto}
                          label="Monto del cargo"
                          onGuardado={() => {
                            setEditandoSinDefinirCargoId(null)
                            cargarAlertas()
                          }}
                          onCancelar={() => setEditandoSinDefinirCargoId(null)}
                        />
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="whitespace-nowrap">{money(c.monto)}</span>
                          <button
                            type="button"
                            onClick={() => setEditandoSinDefinirCargoId(c.cargoId)}
                            aria-label={`Editar monto del cargo de ${c.alumno.nombre} ${c.alumno.apellido}`}
                            className="text-on-surface-variant hover:text-primary"
                          >
                            <span className="material-symbols-outlined !text-[16px]">edit</span>
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          onClick={() =>
                            setVerAsistenciasDe({
                              alumnoId: c.alumno.id,
                              nombre: `${c.alumno.nombre} ${c.alumno.apellido}`,
                              periodo: c.periodo,
                            })
                          }
                          aria-label="Ver asistencias"
                          title="Ver asistencias"
                          className="inline-flex items-center text-on-surface-variant hover:text-primary"
                        >
                          <span className="material-symbols-outlined !text-[18px]">event_available</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setVerPagosDe({
                              alumnoId: c.alumno.id,
                              nombre: `${c.alumno.nombre} ${c.alumno.apellido}`,
                            })
                          }
                          aria-label="Ver historial de pagos"
                          title="Ver historial de pagos"
                          className="inline-flex items-center text-on-surface-variant hover:text-primary"
                        >
                          <span className="material-symbols-outlined !text-[18px]">payments</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setFichaAlumno(c.alumno)}
                          className="inline-flex items-center gap-1 whitespace-nowrap font-inter text-xs font-medium text-on-surface-variant hover:text-primary"
                        >
                          <span className="material-symbols-outlined !text-[16px]">badge</span>
                          Ficha de alumno
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
                Ficha de alumno
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* D.2 Panel Alumnos sin cargo todavía */}
      <div className="rounded-card border border-outline-variant bg-surface-container p-5">
        <p className="mb-1 font-oswald text-[13px] font-bold uppercase tracking-[0.03em] text-on-surface">
          Alumnos sin cargo todavía
        </p>
        <p className="mb-4 font-inter text-xs text-on-surface-variant">
          Alumnos activos sin ninguna asistencia registrada en este período — el cargo se crea solo apenas asistan.
        </p>
        {alertasLoading && <p className="font-inter text-sm text-on-surface-variant">Cargando…</p>}
        {!alertasLoading && alumnosSinCargo.length === 0 && (
          <p className="font-inter text-sm text-on-surface-variant">Todos los alumnos activos ya tienen cargo.</p>
        )}
        <div className="flex flex-col gap-3">
          {alumnosSinCargo.map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-outline-variant px-4 py-3"
            >
              <p className="font-inter text-sm font-medium text-on-surface">
                {a.nombre} {a.apellido}
              </p>
              <Button type="button" variant="ghost" onClick={() => setFichaAlumno(a)}>
                Ficha de alumno
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

      <FichaAlumnoDrawer alumno={fichaAlumno} onClose={() => setFichaAlumno(null)} />

      <AsistenciasPeriodoDrawer
        alumnoId={verAsistenciasDe?.alumnoId ?? null}
        alumnoNombre={verAsistenciasDe?.nombre ?? ''}
        periodo={verAsistenciasDe?.periodo ?? periodo}
        onClose={() => setVerAsistenciasDe(null)}
      />

      <PagosPeriodoDrawer
        alumnoId={verPagosDe?.alumnoId ?? null}
        alumnoNombre={verPagosDe?.nombre ?? ''}
        onClose={() => setVerPagosDe(null)}
      />

      {whatsappDe && <WhatsAppDeudaDialog deudor={whatsappDe} onClose={() => setWhatsappDe(null)} />}
    </div>
  )
}
