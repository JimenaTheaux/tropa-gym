# Tropa Gym

Gestión operativa del gimnasio: alumnos, asistencias, pagos y estado de cuenta. Ver `docs/` (raíz del repo) para contexto funcional completo.

## Stack
React + TypeScript + Vite (PWA) + Tailwind + shadcn/ui + Supabase. Ver `docs/05_stack_tecnico.md`.

## Desarrollo

```bash
npm install
cp .env.example .env.local   # completar VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
npm run dev
```

## Scripts

- `npm run dev` — servidor de desarrollo
- `npm run build` — build de producción (`tsc -b && vite build`)
- `npm run preview` — sirve el build de producción localmente
- `npm run lint` — oxlint

## Variables de entorno

Ver `.env.example`. Ambas son públicas (anon key), no requieren secreto adicional en Vercel más allá de configurarlas en el proyecto.

## Deploy

Vercel, deploy directo desde el repo. Ver checklist de Fase 7 en `docs/07_guia_desarrollo_iterativo.md`.
