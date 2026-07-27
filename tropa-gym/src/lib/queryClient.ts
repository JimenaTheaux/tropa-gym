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
  },
})

export const STALE_CATALOGO = 60_000
export const STALE_OPERATIVO = 8_000
// Recálculo de estados automáticos (25 días sin asistir → inactivo): lazy al
// abrir la app, sin cron — 1h alcanza para no repetirlo en cada navegación.
export const STALE_SYNC_ESTADOS = 3_600_000
