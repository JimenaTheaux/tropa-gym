# 08. Estilos y Diseño — TROPA GYM

## Prioridad — LEER PRIMERO
Este documento tiene **prioridad sobre las skills genéricas** (`frontend-standards`, `PROCESO_DESARROLLO.md`) en todo lo referido a íconos, tipografía, botones, badges y colores. Esas skills traen ejemplos de otro proyecto (Burbuja Gestión); donde haya conflicto, **manda este doc 08**. Casos puntuales ya resueltos:
- Íconos: **no** Lucide (default de la skill) → Material Symbols Outlined, FILL 0.35.
- Botones: **no** un único botón sólido de color (default de la skill) → 3 variantes (primario borde, sólido único por pantalla, ghost).
- Badges: **no** fondo sólido de color (default de la skill) → solo borde.

Adjuntar siempre este doc 08 en cualquier prompt de UI, junto con `frontend-standards` solo para lo que no esté cubierto acá (naming de componentes, auditoría antes de crear, mobile-first).

## Referencia
Mockup base: dashboard estilo "gym premium", tema oscuro, acentos verde neón (paleta y layout tomados de ahí).
Tipografía, íconos y estilo de botones/badges: validados en iteración posterior (ver `tropa_estilo_final_v2.html`), reemplazan lo que traía el mockup base.

## Paleta de colores (tokens exactos)

### Base
| Token | Hex | Uso |
|---|---|---|
| `background` / `surface` / `surface-dim` | `#0d160b` | fondo general |
| `surface-container-lowest` | `#081006` | fondo más profundo (modales, hundido) |
| `surface-container-low` | `#151e12` | inputs, superficies bajas |
| `surface-container` | `#192216` | cards (glass-card) |
| `surface-container-high` | `#232c20` | hover de nav, headers de tabla |
| `surface-container-highest` / `surface-variant` | `#2e372a` | avatares placeholder, barras de progreso vacías |
| `surface-bright` | `#333c2f` | elementos elevados con más contraste |
| `on-surface` / `on-background` | `#dbe6d3` | texto principal |
| `on-surface-variant` | `#bbcbb2` | texto secundario |
| `outline` | `#86957e` | bordes visibles |
| `outline-variant` | `#3d4b37` | bordes sutiles (cards, headers) |

### Primary (verde neón — color de marca)
| Token | Hex | Uso |
|---|---|---|
| `primary` / `surface-tint` | `#40e432` | acciones principales, iconos activos, gráficos |
| `primary-fixed` | `#77ff62` | hover/brillo |
| `primary-fixed-dim` | `#40e432` | igual a primary |
| `primary-container` | `#08c609` | fondos de botón alternativos |
| `on-primary` | `#003a00` | texto sobre primary |
| `on-primary-container` | `#004a00` | texto sobre primary-container |
| `inverse-primary` | `#006e01` | uso en superficies invertidas |

### Secondary (verde suave — soporte)
| Token | Hex | Uso |
|---|---|---|
| `secondary` | `#8fd87f` | badges positivos, chips secundarios |
| `secondary-container` | `#065308` | fondo de badge "completado" |
| `on-secondary-container` | `#7ec670` | texto de badge sobre secondary-container |
| `secondary-fixed` | `#aaf599` | acentos claros |

### Tertiary (rosa — reservado, uso puntual)
| Token | Hex | Uso |
|---|---|---|
| `tertiary` | `#ffb1c7` | acentos decorativos puntuales (no es color de estado) |
| `tertiary-container` | `#ff83ac` | igual, uso puntual |

### Error / Alertas (deuda, vencidos)
| Token | Hex | Uso |
|---|---|---|
| `error` | `#ffb4ab` | texto/ícono de alerta |
| `error-container` | `#93000a` | fondo de botón "Generar reporte de morosidad" |
| `on-error-container` | `#ffdad6` | texto sobre error-container |

## Colores de estado del sistema (mapeo funcional)
> El doc 07 general pide "colores de estado en objeto global". Regla validada: **sin fondos sólidos de color** — el color va en borde + ícono + texto, el fondo queda neutro (`surface-container-high` o transparente).

| Estado | Color (borde + ícono + texto) | Fondo |
|---|---|---|
| Alumno activo / Pago pagado / Completado | `primary` (#40e432) | `surface-container-high` o transparente |
| Alumno en alerta (+15 días) | `secondary` (#8fd87f), tono más apagado que activo | transparente |
| Alumno inactivo / Deuda / Vencido | `error` (#ffb4ab) | transparente |
| Pago parcial / Pendiente | `outline-variant` (#3d4b37) + texto `on-surface-variant`, sin color de acento | transparente |

## Tipografía (validada)
Tres fuentes, cada una con un rol fijo — no intercambiables:

| Fuente | Uso | Notas |
|---|---|---|
| **Anton** | Títulos grandes, valores de KPI, brand/logo-type | Condensada, muy pesada, look de afiche/cartel de gimnasio. Coherente con el logo TROPA. |
| **Oswald** | Nav, labels de sección, botones, KPI-labels | Condensada, técnica, siempre en mayúsculas, tracking ancho. Da el tono "ficha deportiva". |
| **Inter** | Texto de cuerpo, párrafos, badges, inputs | Legible en bloques largos, neutral, no compite con Anton/Oswald. |

Google Fonts:
```
family=Anton
family=Oswald:wght@400;500;600;700
family=Inter:wght@400;500;600;700
```

| Estilo | Fuente | Tamaño | Peso | Notas |
|---|---|---|---|---|
| Brand title | Anton | 40px | 400 | logo-type, headers de sección hero |
| KPI value | Anton | 26px | 400 | valores grandes en cards |
| Headline | Oswald | 20-24px | 700, uppercase | títulos de card/sección |
| Nav / botón | Oswald | 13px | 600, uppercase, tracking 0.03em | |
| KPI label | Oswald | 11px | 500, uppercase, tracking 0.05em | |
| Body | Inter | 14-16px | 400 | texto general |
| Badge | Inter | 12px | 500 | texto de badges |

## Iconografía (validada)
**Material Symbols Outlined**, con relleno parcial — no sólido, no outline puro:

```css
font-variation-settings: 'FILL' 0.35, 'wght' 300, 'GRAD' 0, 'opsz' 24;
```

Se descartó Lucide (probado, no convenció) y Material Symbols 100% sólido (probado en mockup original, quedaba muy "corporativo/plano"). El FILL 0.35 da un trazo fino con algo de peso — ni delgado ni bloque sólido.

Google Fonts:
```
family=Material+Symbols+Outlined:opsz,wght,FILL@20..48,300,0..1
```

## Botones (validado — regla clave: nada de relleno sólido por default)

3 variantes, sin excepciones:

| Variante | Fondo | Borde | Texto | Uso |
|---|---|---|---|---|
| **Primario** | `surface-container-high` | 1px `primary` | `primary` | acción principal de cada pantalla (default) |
| **Sólido** | `primary` sólido | 1px `primary` | `#06210a` (oscuro, no `on-primary` genérico) | reservado a UNA sola acción destacada por pantalla — confirmar, guardar, generar cargos |
| **Ghost** | transparente | 1px `outline-variant` | `on-surface` | cancelar / acciones secundarias |

Regla: por pantalla, como máximo un botón "Sólido". El resto usa Primario o Ghost. Evitar 3+ botones sólidos de color en la misma vista.

## Badges (validado — solo borde, sin fondo de color)
- Fondo: transparente o `surface-container-high`.
- Borde 1px + ícono + texto en el color de estado (ver tabla de colores de estado arriba).
- Nunca fondo sólido de color (se probó y quedaba "muy colorinche").

## Bordes y radios
- Cards (`glass-card`): `border-radius: 16px`, borde 1px `outline-variant`, fondo `surface-container`.
- Radios generales Tailwind: default 4px, `lg` 8px, `xl` 12px, `full` 9999px.
- Botones circulares (FAB): `rounded-full`.

## Efectos
- `glass-card`: fondo `surface-container` + borde `outline-variant` + radio 16px.
- `premium-glow`: `box-shadow: 0 0 20px 2px rgba(16, 89, 15, 0.1)` — usar en cards destacadas, FAB, barras de gráfico.
- Blur en header: `backdrop-blur-md` sobre `surface/80`.

## Espaciado
| Token | Valor |
|---|---|
| `gutter` | 24px |
| `container-max` | 1440px |
| `margin-desktop` | 40px |
| `margin-mobile` | 16px |
| `unit` | 4px |

## Patrones de layout observados
- **Header fijo** (80px alto), logo + nombre + tagline, nav horizontal, buscador, notificaciones, perfil.
- **KPI row**: grid de 4 cards con ícono, variación %, label, valor grande.
- **Bento grid** para gráficos: gráfico principal 8 cols + gráfico secundario 4 cols.
- **Tablas**: header en `surface-container-high/50`, filas con hover, avatares con iniciales.
- **Panel de alertas** (deudores): lista de cards con avatar, nombre, días de vencimiento, monto, acción rápida.
- **FAB** (botón flotante circular) para acción principal de creación.

## Logo
Logo recibido: "TROPA" en tipografía condensada bold angular (cortes geométricos en la A y la P), con marca registrada (®), y "ENTRENA" debajo en letras espaciadas (letter-spacing ancho). Blanco/negro, simple, sin color.

- Coherente con **Anton** como fuente de brand/headline (mismo peso e impacto condensado).
- El tagline "ENTRENA" debajo del logo valida el patrón `brand-tag` en Oswald con tracking ancho, ya usado en el header (ver `.brand-tag` en el estilo final).
- Uso: logo en blanco (`on-surface` #dbe6d3) sobre fondo oscuro; no forzar el logo a verde primary — mantenerlo neutro para que el verde funcione como acento del resto de la UI.

## Nota
Esta paleta queda fija en `tailwind.config.ts` en Fase 1 (Setup técnico). No se modifica durante el desarrollo salvo ajuste explícito aprobado.
