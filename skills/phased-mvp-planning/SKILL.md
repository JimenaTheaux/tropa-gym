---
name: phased-mvp-planning
description: Metodología para planificar y ejecutar el desarrollo de un MVP en fases ordenadas. Usar al iniciar un proyecto nuevo, al organizar el backlog de funcionalidades, o al decidir qué incluir y qué diferir. Cubre definición de alcance, orden de fases con dependencias, qué dejar preparado pero inactivo, documentación de contexto, y cómo armar prompts de desarrollo por fase.
---

# Phased MVP Planning — Planificación iterativa

## Principio base
Lanzar simple, lanzar rápido. El MVP debe funcionar y ser usado.
Lo que no se usa en el día uno no va en el MVP — pero puede quedar preparado.

---

## Antes de escribir código — definir el proyecto

Responder estas preguntas antes de abrir el editor:

```
1. ¿Qué problema resuelve? (una línea)
2. ¿Quién lo usa? (roles reales, no hipotéticos)
3. ¿Qué hace el MVP? (lista de 5-10 items máximo)
4. ¿Qué NO hace el MVP? (lista explícita de exclusiones)
5. ¿Cuál es el flujo principal? (paso a paso desde el usuario)
6. ¿Qué datos persisten? (entidades y relaciones clave)
```

No arrancar hasta tener las 6 respuestas.

---

## Documentación de contexto — 8 archivos base

Crear estos docs antes de escribir código.
Adjuntar los relevantes en cada prompt de desarrollo.

```
docs/
├── 01_contexto_y_vision.md      # qué es, para quién, paleta visual
├── 02_roles_y_permisos.md       # quién puede hacer qué
├── 03_flujo_de_estados.md       # ciclo de vida de las entidades
├── 04_funcionalidades_por_modulo.md  # spec de cada módulo
├── 05_stack_tecnico.md          # decisiones de arquitectura
├── 06_estructura_de_datos.md    # schema SQL + tipos TS
├── 07_guia_desarrollo_iterativo.md  # fases + prompts tipo
└── 08_estilos_y_diseno.md       # design system completo
```

**Regla:** el doc 08 (estilos) se adjunta en CADA prompt de UI.
Los docs 03, 04, 06 se adjuntan en prompts de lógica de negocio.

---

## Orden de fases — dependencias obligatorias

```
FASE 0 — Documentación y schema
  → Docs 01-08 escritos
  → Schema SQL aplicado en DB
  → Tipos TS derivados del schema
  → Sin código de UI todavía

FASE 1 — Identidad visual
  → Tokens de color en tailwind.config.ts
  → Nombre y logo en manifest.json y PWA config
  → Layout base (sidebar / navbar)
  → Sin lógica de negocio todavía

FASE 2 — Auth y routing
  → Login funcional
  → Routing protegido por rol
  → Hook useAuth
  → Probar con usuario real antes de avanzar

FASE 3 — ABM base
  → Entidades sin relaciones primero (categorías, clientes)
  → Luego entidades con relaciones (productos → categorías)
  → CRUD completo con drawers/modales

FASE 4 — Flujo principal
  → La acción más importante del sistema
  → Crear → ver → editar → cerrar
  → Probar de punta a punta con datos reales

FASE 5 — Dashboard y KPIs
  → Solo después de que el flujo principal funcione
  → Los datos deben existir para que los KPIs tengan sentido

FASE 6 — Funcionalidades secundarias
  → Documentos, exports, compartir
  → Vistas operativas adicionales

FASE 7 — Polish y deploy
  → Revisión visual en dispositivo real
  → Build de producción sin errores
  → Variables de entorno en producción
```

**Regla:** nunca avanzar a la siguiente fase sin probar la anterior con datos reales.

---

## Qué dejar preparado pero inactivo

Algunas funcionalidades deben existir en el código pero no activarse en el MVP.
Esto evita reescrituras cuando el negocio las necesite.

**Criterio para dejar preparado:**
- La estructura de datos ya la necesita el sistema
- Activarla en el futuro requeriría cambios de schema invasivos
- El código de UI es genérico y reutilizable

**Ejemplo:**
```
Roles operativos (produccion, repartidor):
- ✅ Definidos en el enum de la DB
- ✅ Políticas RLS escritas
- ✅ Vistas de UI construidas
- ✅ Accesibles al admin como páginas
- ❌ No hay usuarios con esos roles en producción
→ Activar: crear usuario con el rol, el sistema lo reconoce solo
```

**Documentar claramente:**
```markdown
## Roles inactivos en MVP
Los roles `produccion` y `repartidor` están definidos en el schema
y en el código, pero no se usan. Para activarlos:
1. Crear usuario en Auth con ese rol en `perfiles`
2. El sistema reconoce el rol al login automáticamente
```

---

## Alcance del MVP — checklist de decisión

Para cada funcionalidad propuesta, preguntar:

```
¿El usuario principal la necesita el día uno?     → SÍ: incluir / NO: diferir
¿Bloquea el flujo principal si no está?           → SÍ: incluir / NO: diferir
¿Requiere infraestructura nueva si se agrega después? → SÍ: preparar / NO: diferir
¿Cambiaría el schema si se agrega después?        → SÍ: preparar / NO: diferir
```

---

## Armar prompts por fase

Cada fase tiene su prompt. Estructura:

```markdown
# PROMPT FASE N — [nombre de la fase]

## Archivos a adjuntar
- docs/0X_...md
- src/...

## Contexto
[2-3 líneas máximo]

## Pasos ordenados
PASO 1 — Leer antes de tocar
PASO 2 — [acción 1]
PASO 3 — [acción 2]
...
PASO N — Verificar build

## Checklist de cierre
- [ ] [item 1]
- [ ] [item 2]
- [ ] npm run build sin errores

## Reglas de esta sesión
- No tocar [X]
- No tocar [Y]
```

Guardar cada prompt en `docs/PROMPT_FASE_N_nombre.md` del repo.

---

## Post-MVP — documentar el roadmap

Al terminar el MVP, documentar las funcionalidades diferidas con suficiente
detalle para retomar sin perder contexto:

```markdown
## Post-MVP — Funcionalidad X

### Qué hace
[descripción]

### Qué ya está preparado
- Tabla `X` en la DB
- Tipo TS `X` en types/index.ts
- Política RLS escrita

### Qué falta implementar
- Componente UI
- Servicio
- Integración en el dashboard

### Dependencias
- Requiere que [Y] esté funcionando primero
```

---

## Métricas de "listo para lanzar"

```
✅ Flujo completo probado con datos reales (no inventados)
✅ Probado en el dispositivo real del usuario principal
✅ Build de producción sin errores de TS ni warnings críticos
✅ Variables de entorno en el servidor (no en el código)
✅ Al menos un usuario real creado con sus datos
✅ Datos iniciales cargados (catálogo, clientes, etc.)
✅ Sin errores en consola en producción
```
