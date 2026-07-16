---
name: frontend-standards
description: Estándares de componentes y design tokens para proyectos React + Tailwind + shadcn/ui. Usar al crear componentes nuevos, al revisar si un componente ya existe antes de crear uno, al definir o aplicar colores y estilos, y al establecer reglas de iconografía. Cubre auditoría de componentes existentes, tokens de diseño inmutables, sistema de iconos, y anti-patterns de UI.
---

# Frontend Standards — Componentes y design tokens

## Principio base
Buscar antes de crear. Reusar antes de duplicar.
Los tokens de diseño son inmutables — nunca se inventan variantes.

---

## Auditoría de componentes — antes de crear

Antes de escribir cualquier componente nuevo:

```bash
# 1. Buscar si ya existe
find src/components -name "*.tsx" | xargs grep -l "[NombreComponente]"

# 2. Buscar el patrón que necesito
grep -r "drawer\|modal\|sheet" src/components --include="*.tsx" -l

# 3. Leer el componente existente completo antes de modificarlo
```

**Regla:** si un patrón se repite 2 veces → extraer a componente reutilizable.
**Regla:** un componente por archivo. Sin excepciones.

---

## Naming de componentes

| Elemento | Nombre |
|---|---|
| Badge de estado | `BadgeEstado` |
| Card de pedido | `CardPedido` / `FilaPedido` |
| Card KPI | `CardKPI` |
| Drawer / Sheet | `Drawer` |
| Input con float label | `FloatInput` |
| Dot animado | `PulseDot` |
| Barra de sección | `SectionTitle` |
| Layout admin | `AdminLayout` |
| Bottom nav | `BottomNav` |
| Menú hamburguesa | `HamburgerMenu` |
| Banner de alerta | `AlertBanner` |

---

## Tokens de diseño — inmutables

Los tokens se definen UNA SOLA VEZ en `tailwind.config.ts`.
Nunca hardcodear un color que no esté en la tabla. Nunca inventar variantes.

```typescript
// tailwind.config.ts — fuente de verdad
colors: {
  primary:        '#3DD6B5',   // botones, acciones principales
  'primary-deep': '#28B99A',   // hover, textos sobre fondo claro
  'primary-soft': '#E8FAF6',   // fondos activos, badges
  sky:            '#7EB8E8',   // acento secundario
  'sky-soft':     '#EBF5FF',
  ink:            '#1C1C1E',   // texto principal
  'ink-mid':      '#3A3A3C',
  muted:          '#8E8E93',   // texto secundario
  surface:        '#F5F7F9',   // fondo de la app
  card:           '#FFFFFF',
  border:         '#E5E5EA',
  error:          '#F05252',
  'error-bg':     '#FEF2F2',
  warning:        '#C47B00',
  'warning-bg':   '#FFFDE7',
}
```

---

## Colores de estado — inline styles obligatorios

Los colores de estado de entidades (pedidos, pagos, etc.) van en inline styles,
nunca en clases Tailwind. Definir en un objeto global:

```typescript
// src/types/index.ts o src/lib/estadoConfig.ts
export const ESTADO_CONFIG: Record<EstadoPedido, { bg: string; color: string; label: string }> = {
  borrador:        { bg: '#F0F0F0', color: '#9A9A9A', label: 'Borrador' },
  confirmado:      { bg: '#EBF5FF', color: '#2B6CB0', label: 'Confirmado' },
  en_produccion:   { bg: '#FFF3E0', color: '#E65100', label: 'En producción' },
  listo_reparto:   { bg: '#FFFDE7', color: '#C47B00', label: 'Listo para reparto' },
  en_reparto:      { bg: '#EBF5FF', color: '#2B6CB0', label: 'En reparto' },
  cerrado:         { bg: '#E8FAF6', color: '#28B99A', label: 'Cerrado' },
  entrega_fallida: { bg: '#FEF2F2', color: '#C0392B', label: 'Entrega fallida' },
  anulado:         { bg: '#F0F0F0', color: '#9A9A9A', label: 'Anulado' },
}
```

**Regla:** estos valores son inmutables. Si hay que agregar un estado, agregar al objeto — nunca inventar un color nuevo inline.

---

## Sistema de iconos

Un solo sistema de iconos por proyecto. Sin mezclar, sin emojis.

```typescript
// BIEN — Lucide React
import { Package, ClipboardList, Users, TrendingDown } from 'lucide-react'
<Package size={16} />

// MAL — mezcla de sistemas
import { TiPackage } from 'react-icons/ti'  // ❌ otro sistema
<span>📦</span>                              // ❌ emoji
```

**Tamaños estándar por contexto:**
- Sidebar / navbar: `size={15}`
- Botones: `size={14}`
- KPI cards: `size={16}`
- Títulos de sección: `size={13}`
- Acciones en tabla: `size={13}`

---

## Estilos de componentes base

### Card
```typescript
// Clases Tailwind
"bg-white rounded-[20px] p-5 shadow-sm hover:shadow-md transition-shadow"

// Inline cuando tiene borde de estado
style={{ borderLeft: `3px solid ${ESTADO_CONFIG[estado].color}` }}
```

### Botón primary
```typescript
style={{
  height: 36,           // desktop / 44px mobile
  padding: '0 16px',
  border: 'none',
  borderRadius: 10,
  background: '#3DD6B5',
  color: 'white',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'background 0.15s',
}}
```

### Input
```typescript
style={{
  width: '100%',
  height: 36,           // desktop / 44px mobile
  border: '1px solid #E5E5EA',
  borderRadius: 8,
  padding: '0 12px',
  fontSize: 13,         // desktop / 16px mobile (evita zoom iOS)
  fontFamily: 'Inter, sans-serif',
  outline: 'none',
}}
// focus: borderColor '#3DD6B5'
```

### Badge de estado
```typescript
<span style={{
  backgroundColor: ESTADO_CONFIG[estado].bg,
  color: ESTADO_CONFIG[estado].color,
  fontSize: 10,
  fontWeight: 700,
  padding: '3px 9px',
  borderRadius: 99,
  display: 'inline-block',
  whiteSpace: 'nowrap',
}}>
  {ESTADO_CONFIG[estado].label}
</span>
```

---

## Mobile-first

**Breakpoint principal:** `768px` (md) para sidebar vs hamburguesa.
**Breakpoint formularios:** `1024px` (lg) para drawer vs modal centrado.

```css
/* Desktop primero para layout */
.sidebar { display: flex; }          /* desktop */
@media (max-width: 768px) {
  .sidebar { display: none; }        /* mobile: ocultar */
}

/* Mobile-first para inputs */
input { height: 44px; font-size: 16px; }    /* mobile base */
@media (min-width: 1024px) {
  input { height: 36px; font-size: 13px; }  /* desktop override */
}
```

**Reglas mobile:**
- Tap targets mínimo 44px de altura
- `font-size: 16px` en inputs (evita zoom automático en iOS)
- Drawers en mobile: 100% ancho, desde abajo o desde la derecha
- Modales en desktop: centrados, 480px ancho, `border-radius: 20px`

---

## Anti-patterns — nunca hacer esto

```
❌ Emojis en la UI — siempre Lucide
❌ Colores hardcodeados fuera de los tokens definidos
❌ Inventar variantes de color de estado
❌ Mezclar sistemas de iconos
❌ Abrir formularios en páginas nuevas — siempre drawers/modales
❌ Usar window.alert() o window.confirm() — siempre componentes UI
❌ Más de una fuente tipográfica
❌ Sidebar en mobile — hamburguesa + bottom nav
❌ Más de 4 acciones en una card
❌ Crear un componente sin buscar si ya existe
❌ Modificar un archivo sin leerlo completo primero
```
