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
  cargosPreview: (periodo: string) => ['cargos', 'preview', periodo] as const,
  resumenPeriodoAlumno: (alumnoId: string, periodo: string) => ['cargos', 'resumen', alumnoId, periodo] as const,

  estadoCuenta: (alumnoId: string) => ['cuenta', alumnoId] as const,
  historialAlumno: (alumnoId: string) => ['cuenta', 'historial', alumnoId] as const,
  historialPagos: ['pagos', 'historial'] as const,

  egresos: (periodo: string) => ['egresos', periodo] as const,

  asistenciasPorFecha: (fecha: string) => ['asistencias', fecha] as const,
  conteoPorTurno: (fecha: string) => ['asistencias', 'conteo', fecha] as const,
  fechasAsistenciaAlumno: (alumnoId: string) => ['asistencias', 'alumno', alumnoId] as const,
  asistenciasProfesores: (periodo: string) => ['asistencias-profesores', periodo] as const,
  asistenciasProfesoresAbiertas: ['asistencias-profesores', 'abiertas'] as const,

  dashboardKpi: (periodo: string) => ['dashboard', 'kpi', periodo] as const,
  dashboardTrend: (periodo: string, cantidad: number) => ['dashboard', 'trend', periodo, cantidad] as const,
  dashboardHorarios: (periodo: string) => ['dashboard', 'horarios', periodo] as const,
  dashboardAlertas: (periodo: string) => ['dashboard', 'alertas', periodo] as const,
  dashboardEstadosPorPeriodo: (periodo: string, cantidad: number) =>
    ['dashboard', 'estados-periodo', periodo, cantidad] as const,
}
