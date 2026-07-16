---
name: pwa-performance-supabase
description: Optimización de performance para PWAs construidas con React + Vite + Supabase. Usar siempre en la Fase 5/6 de un proyecto (dashboard, KPIs, funcionalidades secundarias), al notar carga lenta, al configurar el service worker/manifest de una PWA, al escribir queries a Supabase que traen listas grandes, o al preparar el build de producción. Cubre estrategia de caché offline, code-splitting, optimización de queries e índices, paginación, tamaño de imágenes/assets, y checklist de Lighthouse antes de deploy.
---

# PWA Performance + Supabase — Optimización

## Principio base
Performance no se agrega al final — se previene desde cómo se escriben las queries y se estructura el bundle. Pero la auditoría formal (Lighthouse, bundle size) sí es un paso explícito antes del deploy (Fase 7).

---

## Service Worker y caché offline

Usar `vite-plugin-pwa` (no escribir el service worker a mano):

```bash
npm install vite-plugin-pwa -D --break-system-packages
```

```typescript
// vite.config.ts
import { VitePWA } from 'vite-plugin-pwa'

VitePWA({
  registerType: 'autoUpdate',
  workbox: {
    runtimeCaching: [
      {
        // Assets estáticos: cache-first
        urlPattern: /\.(?:png|jpg|jpeg|svg|woff2)$/,
        handler: 'CacheFirst',
        options: { cacheName: 'assets-cache' },
      },
      {
        // Llamadas a Supabase: network-first (datos frescos, fallback a caché si no hay red)
        urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/.*/,
        handler: 'NetworkFirst',
        options: { cacheName: 'supabase-cache', networkTimeoutSeconds: 5 },
      },
    ],
  },
  manifest: {
    name: '[Nombre completo del proyecto]',
    short_name: '[Nombre corto]',
    theme_color: '[color primary del proyecto]',
    background_color: '[color background del proyecto]',
    display: 'standalone',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  },
})
```

**Regla:** datos de Supabase nunca `CacheFirst` — siempre `NetworkFirst` o `NetworkOnly`. El histórico de pagos/asistencias no puede servirse desde una caché vieja sin avisar.

---

## Queries a Supabase — evitar el N+1 y el over-fetching

```typescript
// MAL: trae todas las columnas, sin límite
const { data } = await supabase.from('alumnos').select('*')

// BIEN: columnas explícitas + paginación
const { data } = await supabase
  .from('alumnos')
  .select('id, nombre, apellido, estado')
  .range(0, 49) // paginado, 50 por página
  .order('apellido')

// BIEN: join en una sola query en vez de N+1
const { data } = await supabase
  .from('alumnos')
  .select('id, nombre, cargos(id, monto, periodo)')
  .eq('estado', 'activo')
```

**Regla:** ninguna lista principal (alumnos, pagos, asistencias) sin `.range()` o paginación explícita. Si la tabla puede superar ~200 filas en producción, paginar sí o sí.

---

## Índices para queries frecuentes

Todo campo usado en `WHERE`, `ORDER BY` o `JOIN` en una query frecuente necesita índice:

```sql
-- Si se filtra alumnos por estado constantemente:
CREATE INDEX idx_alumnos_estado ON alumnos(estado);

-- Si se buscan asistencias por alumno y fecha:
CREATE INDEX idx_asistencias_alumno_fecha ON asistencias_alumnos(alumno_id, fecha);

-- Si se buscan cargos por periodo:
CREATE INDEX idx_cargos_periodo ON cargos(periodo);
```

**Regla:** antes de agregar un índice, verificar con `EXPLAIN ANALYZE` que la query efectivamente lo necesita.

---

## Code-splitting y lazy loading

```typescript
// MAL: todo el bundle en un solo chunk
import Dashboard from './pages/Dashboard'
import Configuracion from './pages/Configuracion'

// BIEN: lazy loading por ruta
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Configuracion = lazy(() => import('./pages/Configuracion'))

// Envolver rutas en Suspense con un fallback simple (no un spinner elaborado)
<Suspense fallback={<div className="p-8">Cargando...</div>}>
  <Dashboard />
</Suspense>
```

**Regla:** rutas de Configuración, Egresos y Dashboard (módulos no usados en cada sesión) siempre lazy. El flujo principal (login, asistencia, pagos) puede ir en el bundle inicial.

---

## Imágenes y assets

- Avatares/fotos de alumnos: servir en WebP, máximo 200x200px, con `loading="lazy"`.
- Logo: SVG si es posible; si es PNG, no subir más de 2x el tamaño de render.
- Iconos: usar el sistema de iconos del proyecto (fuente de íconos o SVG sprite), nunca imágenes sueltas por ícono.

---

## Checklist antes de deploy (Fase 7)

```
[ ] npm run build sin errores ni warnings de tamaño de chunk
[ ] Lighthouse (modo incógnito, mobile): Performance > 85
[ ] Ninguna lista sin paginación
[ ] Ninguna query con SELECT *
[ ] Service worker registra y cachea correctamente (probar en modo avión tras primera carga)
[ ] Manifest.json con nombre, colores e íconos del proyecto (no placeholders)
[ ] Imágenes en WebP donde aplique
[ ] Rutas secundarias con lazy loading confirmado (Network tab: no cargan hasta navegar)
```

---

## Anti-patterns — nunca hacer esto

```
❌ CacheFirst en datos de Supabase
❌ SELECT * en listas que pueden crecer
❌ Cargar todas las rutas en el bundle inicial
❌ Índices "por las dudas" sin verificar con EXPLAIN ANALYZE
❌ Imágenes sin lazy loading ni compresión
❌ Ignorar el warning de Vite sobre chunks > 500kb
```
