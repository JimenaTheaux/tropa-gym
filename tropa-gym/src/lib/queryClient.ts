import { QueryClient } from '@tanstack/react-query'

// Entorno controlado (PC del gym, notebook admin, tablet kiosco — sin
// usuarios externos): se puede ser agresivo con el cache. Catálogos
// (turnos/precios/combos/disciplinas/descuentos/profesores) usan staleTime
// más largo por query (ver src/hooks/useCatalogos.ts); datos operativos
// (cargos/pagos/asistencias) usan uno corto por query. Este default cubre
// todo lo que no lo pisa explícitamente.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
    // networkMode default ('online') hace que una mutation (ej. registrar
    // pago) disparada con el navegador marcado offline quede "paused" en
    // memoria en vez de fallar: sin error, sin timeout, y se pierde entera
    // si se cierra el drawer o se recarga la página antes de que vuelva la
    // conexión — con wifi de gimnasio intermitente, así desaparece un pago
    // sin que quede rastro ni en el cliente ni en el server. 'always' hace
    // que el fetch se intente igual y falle rápido (lo agarra el catch de
    // cada panel y ahora también log_errores) en vez de quedar colgada.
    mutations: {
      networkMode: 'always',
    },
  },
})

export const STALE_CATALOGO = 60_000
export const STALE_OPERATIVO = 8_000
// Recálculo de estados automáticos (25 días sin asistir → inactivo): lazy al
// abrir la app, sin cron — 1h alcanza para no repetirlo en cada navegación.
export const STALE_SYNC_ESTADOS = 3_600_000
