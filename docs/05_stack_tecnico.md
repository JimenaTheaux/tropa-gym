# 05. Stack Técnico — TROPA GYM

## Stack
- React + TypeScript
- Vite (build + plugin PWA)
- Tailwind CSS
- shadcn/ui
- Supabase (Auth, Postgres, RPCs)
- Deploy: Vercel

## Justificación
- Vite: build rápido, soporte nativo de PWA (manifest + service worker).
- React + TS: tipado derivado del schema SQL, menos errores en runtime.
- Tailwind + shadcn: sistema de diseño consistente, velocidad de desarrollo.
- Supabase: Auth integrado con tabla `perfiles`, Postgres con RLS, RPCs para operaciones atómicas (generar cargos, pagos multi-alumno).
- Vercel: deploy directo desde repo, variables de entorno simples, dominios propios.

## Convenciones
- Tipos TS generados/derivados del schema SQL (doc 06).
- RPCs para toda operación multi-tabla (ej: generar cargos del período, pago familiar).
- Iconos: Lucide (sin emojis).
- Colores de estado: objeto global con inline styles (a definir en doc 08).

## Variables de entorno esperadas
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

## Pendiente de definir
- Identidad visual y tokens (doc 08, al final del proceso).
