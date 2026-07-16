# Cómo iniciar un proyecto nuevo — Proceso de desarrollo

Basado en el desarrollo de Burbuja Gestión (PWA de gestión de pedidos).
Stack de referencia: React + TypeScript + Vite + Tailwind + shadcn/ui + Supabase.

---

## Fase 0 — Antes de tocar el editor

### 1. Definir el proyecto en una conversación
Responder estas preguntas con el cliente antes de escribir una línea:

- ¿Qué problema resuelve? (una línea)
- ¿Quién lo usa? ¿Cuántos roles hay?
- ¿Qué hace el MVP? ¿Qué NO hace?
- ¿Cuál es el flujo principal de punta a punta?
- ¿Hay un proyecto existente de referencia o es desde cero?

### 2. Escribir los 8 docs de contexto
Antes de escribir código, crear:

```
docs/01_contexto_y_vision.md
docs/02_roles_y_permisos.md
docs/03_flujo_de_estados.md
docs/04_funcionalidades_por_modulo.md
docs/05_stack_tecnico.md
docs/06_estructura_de_datos.md
docs/07_guia_desarrollo_iterativo.md
docs/08_estilos_y_diseno.md
```

Estos docs son la fuente de verdad del proyecto.
Se adjuntan en cada prompt de desarrollo según relevancia.
El doc 08 (estilos) va en TODOS los prompts de UI.

### 3. Aprobar la identidad visual antes de codear
Generar un preview HTML con los colores, tipografía y componentes principales.
Aprobar con el cliente antes de escribir `tailwind.config.ts`.
Extraer los tokens exactos del logo/brief visual.

### 4. Diseñar el schema SQL
En papel o en el doc 06, definir:
- Entidades y relaciones
- Qué campos necesitan snapshot (precios, costos)
- Qué enums necesita la DB
- Qué RPCs necesitan atomicidad

**Nunca escribir código de UI antes de tener el schema aprobado.**

---

## Fase 1 — Setup técnico

```bash
# Si es proyecto nuevo:
npm create vite@latest [nombre] -- --template react-ts

# Si es fork de proyecto existente:
git clone [repo]
cd [proyecto]
npm install
```

En orden:
1. Aplicar schema SQL en Supabase (SQL Editor → ejecutar todo de una vez)
2. Verificar tablas con `SELECT COUNT(*)`
3. Configurar variables de entorno (`.env.local`)
4. Actualizar `tailwind.config.ts` con tokens aprobados
5. Actualizar `manifest.json` y `vite.config.ts` (nombre, colores PWA)
6. Commit: `feat: project setup — schema, tokens, PWA config`

---

## Fase 2 — Auth y layout base

1. Pantalla de login con estética del proyecto
2. Hook `useAuth` conectado a Supabase Auth + tabla `perfiles`
3. Routing protegido por rol (`ProtectedRoute`)
4. Layout principal (sidebar / navbar según diseño aprobado)
5. Navegación mobile (hamburguesa + bottom nav si aplica)
6. **Probar login con usuario real antes de continuar**
7. Commit: `feat: auth and layout`

---

## Fase 3 — ABM de entidades base

Orden de implementación por dependencias:
1. Entidades sin FK primero (categorías, tags)
2. Entidades con FK (productos → categorías, clientes)
3. CRUD completo: lista + drawer crear + drawer editar + confirmar borrar
4. **Probar crear, editar y borrar con datos reales**
5. Commit: `feat: base ABM`

---

## Fase 4 — Flujo principal

El flujo más importante del sistema de punta a punta:
1. Crear la entidad principal (pedido, orden, etc.)
2. Ver el listado con filtros y badges de estado
3. Editar / avanzar estado
4. Cerrar / finalizar con datos de cierre
5. Ver el resultado en el historial
6. **Probar flujo completo con datos reales**
7. Commit: `feat: main flow`

---

## Fase 5 — Dashboard y KPIs

Solo después de que existan datos reales del flujo principal:
1. KPIs del período (con selector de fechas)
2. Gráfico de evolución temporal
3. Tablas resumen / reportes
4. Exports (Excel, PDF si aplica)
5. Commit: `feat: dashboard and KPIs`

---

## Fase 6 — Funcionalidades secundarias

En orden de valor para el usuario:
- Documentos imprimibles / compartir (WhatsApp, PDF)
- Vistas operativas adicionales (roles secundarios)
- Módulos complementarios (egresos, stock, etc.)
- Commit por módulo: `feat: [nombre del módulo]`

---

## Fase 7 — Revisión final y deploy

1. Buscar rastros del proyecto base si es fork:
   ```bash
   grep -r "[nombre anterior]" src/ --include="*.tsx" --include="*.ts" --include="*.json" -l
   ```
2. Build de producción sin errores: `npm run build`
3. Probar en dispositivo real del usuario principal
4. Deploy en Vercel:
   - Importar repo
   - Configurar variables de entorno
   - Verificar URL en Supabase Auth allowlist
5. Cargar datos iniciales (seed de productos, clientes, etc.)
6. Crear usuario(s) real(es) y verificar acceso
7. Commit: `feat: production deploy`

---

## Reglas del proceso

**Al escribir prompts:**
- Leer siempre antes de modificar
- Un prompt = una tarea
- Adjuntar solo los docs relevantes
- Siempre incluir checklist de cierre
- Siempre incluir qué NO tocar

**Al revisar código:**
- Buscar antes de crear (¿ya existe este componente?)
- Leer el archivo completo antes de modificarlo
- No tocar lo que no se pidió

**Al trabajar con la DB:**
- Schema primero, código después
- Tipos TS derivados del schema SQL
- Siempre verificar con SELECT COUNT después de migrations
- RPCs para operaciones multi-tabla

**Al definir estilos:**
- Tokens definidos una vez en tailwind.config.ts
- Colores de estado en objeto global con inline styles
- Un sistema de iconos (Lucide) — sin emojis
- Doc 08 adjunto en cada prompt de UI

---

## Skills de referencia

Adjuntar según el tipo de tarea:

| Tarea | Skills a adjuntar |
|---|---|
| Nueva funcionalidad | `dev-prompting` + `frontend-standards` + `08_estilos_y_diseno.md` |
| Nuevo proyecto | `phased-mvp-planning` + `database-first` |
| Bug de UI | `dev-prompting` + `frontend-standards` |
| Nuevo schema o migración | `database-first` |
| Performance | `pwa-performance-supabase` |
| Componente nuevo | `frontend-standards` + `08_estilos_y_diseno.md` |
