# 07. Guía de Desarrollo Iterativo — TROPA GYM

## Orden de fases (según proceso general)

**Fase 1 — Setup técnico**
- Vite + React + TS, Tailwind, schema SQL en Supabase, `.env.local`, PWA config.

**Fase 2 — Auth y layout base**
- Login, `useAuth` + tabla `perfiles`, `ProtectedRoute` por rol, layout (sidebar/navbar), nav mobile.
- Probar login con usuario real antes de continuar.

**Fase 3 — ABM de entidades base**
- Orden: turnos, precios, descuentos, profesores (sin FK) → alumnos (con FK a nada crítico).
- CRUD completo: lista + drawer crear + drawer editar + confirmar borrar.
- Probar con datos reales.

**Fase 4 — Flujo principal**
- Asistencia Alumnos (buscar → estado de cuenta → turno → confirmar).
- Pagos (individual → familiar → adelantado).
- Cargos (RPC `generar_cargos_periodo` con preview + confirmación).
- Probar flujo completo con datos reales.

**Fase 5 — Dashboard y KPIs**
- Dashboard Principal (KPIs a definir con el cliente).
- Centro de Resumen Mensual (deuda, deudores, próximos a inactivarse, horas por profesor).

**Fase 6 — Funcionalidades secundarias**
- Asistencia Profesores (entrada/salida).
- Egresos.
- Configuración (precios, descuentos, turnos, profesores) si no se hizo en Fase 3.

**Fase 7 — Revisión final y deploy**
- Build sin errores, prueba en dispositivo real, deploy Vercel, seed de datos, usuarios reales.

## Reglas al escribir prompts
- Leer antes de modificar.
- Un prompt = una tarea.
- Adjuntar solo los docs relevantes (01-07 según tarea; 08 en cada prompt de UI).
- Incluir checklist de cierre y qué NO tocar.

## Reglas al trabajar con la DB
- Schema primero (doc 06), código después.
- Tipos TS derivados del schema.
- Verificar con SELECT COUNT tras migrations.
- RPCs para toda operación multi-tabla.

## Nota
Identidad visual y doc 08 (estilos) se definen al final, después de validar la lógica funcional completa.

## Skills de referencia — actualizado para Tropa Gym

| Tarea | Skills a adjuntar |
|---|---|
| Nueva funcionalidad | `dev-prompting` + `frontend-standards` + `08_estilos_y_diseno.md` |
| Nuevo proyecto | `phased-mvp-planning` + `database-first` |
| Bug de UI | `dev-prompting` + `frontend-standards` |
| Nuevo schema o migración | `database-first` |
| Performance / Fase 5-6 / pre-deploy | `pwa-performance-supabase` |
| Componente nuevo | `frontend-standards` + `08_estilos_y_diseno.md` |

**Regla de prioridad:** cuando `frontend-standards` (u otra skill genérica) contradiga al doc 08 en íconos, tipografía, botones, badges o colores — **manda el doc 08**. Ver nota de prioridad al inicio del doc 08.
