// Claves de TanStack Query — centralizadas para poder invalidar de forma
// consistente desde cualquier mutation (ver skill pwa-performance-supabase).
export const queryKeys = {
  turnos: ['turnos'] as const,
  turnosActivos: ['turnos', 'activos'] as const,
  disciplinas: ['disciplinas'] as const,
  disciplinasActivas: ['disciplinas', 'activas'] as const,
  combos: ['combos'] as const,
  combosActivos: ['combos', 'activos'] as const,
  precios: ['precios'] as const,
  descuentos: ['descuentos'] as const,
  profesores: (perfilId?: string) => ['profesores', perfilId ?? 'todos'] as const,
  perfilesProfesores: ['perfiles', 'profesores'] as const,

  alumnos: ['alumnos'] as const,
  alumnosBusqueda: (term: string) => ['alumnos', 'busqueda', term] as const,
  alumnosConCumpleanos: ['alumnos', 'cumpleanos'] as const,
  historialEstadoAlumno: (alumnoId: string) => ['alumnos', 'estado-historial', alumnoId] as const,
  syncEstadosAutomaticos: ['alumnos', 'sync-estados'] as const,

  cargosPeriodo: (periodo: string) => ['cargos', 'periodo', periodo] as const,
  resumenPeriodoAlumno: (alumnoId: string, periodo: string) => ['cargos', 'resumen', alumnoId, periodo] as const,
  asistenciasAlumnoPeriodo: (alumnoId: string, periodo: string) =>
    ['asistencias', 'alumno-periodo', alumnoId, periodo] as const,
  pagosAlumnoPeriodo: (alumnoId: string, periodo: string) => ['pagos', 'alumno-periodo', alumnoId, periodo] as const,
  pagosAlumno: (alumnoId: string) => ['pagos', 'alumno-historial', alumnoId] as const,

  estadoCuenta: (alumnoId: string) => ['cuenta', alumnoId] as const,
  historialAlumno: (alumnoId: string) => ['cuenta', 'historial', alumnoId] as const,
  historialPagos: ['pagos', 'historial'] as const,
  historialPagosPagina: (nombre: string, periodo: string, page: number) =>
    ['pagos', 'historial', nombre, periodo, page] as const,

  egresos: (periodo: string) => ['egresos', periodo] as const,

  asistenciasPorFecha: (fecha: string) => ['asistencias', fecha] as const,
  conteoPorTurno: (fecha: string) => ['asistencias', 'conteo', fecha] as const,
  fechasAsistenciaAlumno: (alumnoId: string) => ['asistencias', 'alumno', alumnoId] as const,
  asistenciasProfesores: (periodo: string) => ['asistencias-profesores', periodo] as const,
  asistenciasProfesoresAbiertas: ['asistencias-profesores', 'abiertas'] as const,

  dashboardKpi: (periodo: string) => ['dashboard', 'kpi', periodo] as const,
  dashboardTrend: (periodo: string, cantidad: number) => ['dashboard', 'trend', periodo, cantidad] as const,
  dashboardHorarios: (periodo: string) => ['dashboard', 'horarios', periodo] as const,
  // Prefijo de todas las alertas: la deuda de un mes aparece también como
  // "anteriores" y "total" de otros meses.
  dashboardAlertasTodas: ['dashboard', 'alertas'] as const,
  dashboardAlertas: (periodo: string) => ['dashboard', 'alertas', periodo] as const,
  dashboardDeudores: (periodo: string, modo: string) => ['dashboard', 'alertas', periodo, 'deudores', modo] as const,
  dashboardEstadosPorPeriodo: (periodo: string, cantidad: number) =>
    ['dashboard', 'estados-periodo', periodo, cantidad] as const,

  // Bajo el prefijo de asistencias de profesores: registrar entrada o salida
  // refresca quién está en turno en el campo "Recibió".
  receptoresPago: ['asistencias-profesores', 'receptores'] as const,

  caja: ['caja'] as const,
  cajaActiva: ['caja', 'activa'] as const,
  cajaPendientes: (profesorId: string) => ['caja', 'pendientes', profesorId] as const,
  cajaPendientesPorProfesor: (ids: string) => ['caja', 'pendientes-por-profesor', ids] as const,
  cajaResumenDia: (fecha: string) => ['caja', 'resumen-dia', fecha] as const,
  cajaPagosDeCierre: (cierreId: string) => ['caja', 'pagos-de-cierre', cierreId] as const,
  cajaParaVerificar: ['caja', 'para-verificar'] as const,
  cajaPreview: (ids: string) => ['caja', 'preview', ids] as const,
  cajaSinCierre: ['caja', 'sin-cierre'] as const,
  cajaPagosEnCierre: (ids: string) => ['caja', 'pagos-en-cierre', ids] as const,
  cajaConteoMenu: ['caja', 'conteo-menu'] as const,

  logErrores: ['log-errores'] as const,
  pagosHuerfanos: ['log-errores', 'pagos-huerfanos'] as const,
}
