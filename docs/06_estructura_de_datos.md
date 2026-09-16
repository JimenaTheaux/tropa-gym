# 06. Estructura de Datos — TROPA GYM

## Entidades y relaciones

```
perfiles (usuarios/roles)
  └── profesores (1:1 opcional, si rol = profesor)

disciplinas ← alumnos (plan actual), pagos_alumnos
combos ← alumnos (plan actual), precios, pagos_alumnos

alumnos (disciplina_id, combo_id = plan actual)
  ├── asistencias_alumnos (1:N)
  ├── cargos (1:N)
  └── pagos (1:N, vía pagos_alumnos si es familiar)

profesores
  └── asistencias_profesores (1:N)

turnos ← asistencias_alumnos
precios (combo_id) ← cargos, pagos
descuentos ← cargos, pagos
egresos (independiente)
```

## Enums necesarios
- `estado_alumno`: activo | inactivo
- `origen_estado_alumno`: automatico | manual (migración 11)
- `estado_pago`: pendiente | parcial | pagado
- `tipo_pago`: individual | familiar | adelantado
- `metodo_pago`: efectivo | transferencia | combinado
- `rol_usuario`: admin | profesor | kiosco
- `tipo_ajuste`: descuento | recargo (migración 16)

## Tablas principales (borrador)

### alumnos
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| nombre | text | obligatorio |
| apellido | text | obligatorio |
| dni | text unique | obligatorio |
| telefono | text | opcional. **Formato: internacional sin símbolos** (ej. `5493811234567` para Argentina) — necesario para link directo de WhatsApp (`wa.me/{telefono}`) en el panel de Deudores |
| fecha_nacimiento | date | opcional |
| disciplina_id | FK disciplinas | opcional. Plan actual — se muestra en el check-in de asistencia. Se carga al alta y se actualiza solo con cada pago Individual/Familiar (RN-035, no con Adelantado) |
| combo_id | FK combos | opcional. Plan actual — resuelve el precio de los cargos cuando el alumno todavía no tiene pagos previos (RN-030). Se carga al alta y se actualiza solo con cada pago Individual/Familiar (RN-035, no con Adelantado) |
| estado | estado_alumno | default 'activo'. Híbrido (migración 11/12, ver doc 03): automático por defecto (recalculado por `sync_estados_automaticos()`), o forzado a mano por Admin/Profesor (`marcar_estado_manual`). Una asistencia real siempre lo reactiva, sea cual sea el origen |
| estado_origen | origen_estado_alumno | default 'automatico'. Distingue si el `estado` actual viene de la regla de 25 días o de un cambio manual — `sync_estados_automaticos()` nunca toca a los que están en 'manual' |
| estado_motivo | text | opcional. Solo se usa en cambios manuales (ej. "Licencia por lesión") |
| estado_desde | timestamptz | default now(). Fecha desde la que rige el `estado` actual — editable/backdateable en el cambio manual (migración 12), útil para "de baja desde el lunes" |
| fecha_alta | timestamptz | default now() |

### alumno_estado_historial (migración 11)
Registro completo de cada cambio de estado de un alumno, no solo el último — `alumnos.estado*` siempre refleja la fila más reciente de acá.

| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| alumno_id | FK alumnos | `ON DELETE CASCADE` |
| estado | estado_alumno | |
| origen | origen_estado_alumno | |
| motivo | text | opcional |
| fecha_desde | timestamptz | default now(). Backdateable (migración 12) |
| creado_por | FK perfiles | opcional (null en cambios automáticos, que no tienen usuario asociado) |
| created_at | timestamptz | |

RLS: SELECT para admin/profesor/kiosco (mismo `get_user_role()` que `alumnos`). Escritura solo vía `fn_registrar_cambio_estado` (SECURITY DEFINER, no expuesta a PostgREST) — el único punto que escribe `alumnos` + este historial juntos, para que nunca queden desincronizados.

Usado por el Dashboard (`fetchEstadoAlumnosPorPeriodo`) para reconstruir cuántos alumnos estaban activos/inactivos al cierre de cada período (punto-en-el-tiempo), no solo el estado actual.

### asistencias_alumnos
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| alumno_id | FK alumnos | |
| turno_id | FK turnos | |
| fecha | date | |
| hora | time | |

### profesores
| id, nombre, apellido, perfil_id (FK perfiles) |

### asistencias_profesores
| id, profesor_id FK, fecha, hora_entrada, hora_salida |

### cargos
Cargo continuo desde la migración 22 — ya no lo crea un botón "Generar cargos del período": lo crea/actualiza solo el trigger `trg_asistencia_actualiza_cargo` en cada asistencia nueva (ver doc 03, "Flujo de liquidación mensual" y RPCs abajo).

| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| alumno_id | FK alumnos | |
| periodo | text (YYYY-MM) | |
| tipo | 'completa' \| 'media' | RN-017/018. Recalculado en cada asistencia nueva del período mientras `validado = false` |
| monto | numeric | Se resuelve solo (ver `fn_recalcular_cargo_automatico` abajo), o `0` si no se pudo resolver (ver `monto_definido`). **Editable** por Admin/Profesor como excepción — ver doc 02. Cualquier edición manual marca `monto_definido = true` y **`validado = true`** (migración 22/23) |
| estado | estado_pago | **Le pertenece al cargo, no al pago** (ver doc 03). Calculado automáticamente por trigger: suma de `pagos_alumnos.monto_pagado` de todos los pagos ligados a este cargo, comparada contra `monto` |
| monto_definido | boolean | default `true`. `false` cuando el trigger automático no pudo resolver combo+precio (RN-030) — el cargo existe igual (con `monto=0`), pero necesita que Admin/Profesor lo complete a mano. Se puede completar desde la pantalla Cargos (edición inline en la tabla), la ficha del alumno (badge "Monto sin definir") o el Centro de Resumen Mensual — las tres escriben sobre esta misma columna. Ver doc 03, "Cargo con monto sin definir" |
| validado | boolean | default `false` (migración 22). Mientras es `false`, `trg_asistencia_actualiza_cargo` puede seguir recalculando `tipo`/`monto` solo con cada asistencia nueva del período. Pasa a `true` en dos casos: (1) manual — cualquier edición de `monto` desde Admin/Profesor, o el checkbox "Validar" de la pantalla Cargos (`marcarCargoValidado`, UPDATE directo de esta columna); (2) automático — apenas el acumulado de pagos deja el cargo en `estado = 'pagado'` (coincidencia exacta o sobrepago), vía `fn_recalcular_estado_cargo`. Una vez `true`, el trigger automático **nunca** vuelve a tocar `tipo`/`monto` de ese cargo — ver doc 03 |
| **Constraint**: único por (alumno_id, periodo) — RN-020 |

### pagos
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| tipo_pago | tipo_pago | |
| metodo_pago | metodo_pago | |
| importe_efectivo | numeric | si combinado |
| importe_transferencia | numeric | si combinado |
| total | numeric | monto real de la transacción (suma de `monto_pagado` de sus `pagos_alumnos`) |
| fecha | timestamptz | Editable desde los 3 forms de registro (Individual/Familiar/Adelantado) y "Completar pago" — precarga con hoy, permite backdatear pagos atrasados (migración 19). El KPI/tendencia del dashboard filtran por esta columna, no por `created_at` |

*(`pagos.estado` se eliminó — un pago es una transacción, no tiene "parcial/pagado" propio; ese estado ahora vive en `cargos.estado`. No tenía otro uso.)*

### pagos_alumnos (detalle, soporta familiar/adelantado)
| Campo | Notas |
|---|---|
| pago_id, alumno_id, cargo_id, periodo, disciplina_id, combo_id, descuento_id | FKs / datos del detalle |
| precio_snapshot | numeric — lo que **correspondía pagar** según combo/descuento vigente al momento. No se toca su cálculo automático. |
| monto_pagado | numeric — lo que **efectivamente entró** en esta transacción. Puede ser menor (pago parcial) o mayor (sobrepago) que `precio_snapshot`. Reemplaza el uso ambiguo de `monto_asignado`. |

### precios
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| combo_id | FK combos | el precio depende únicamente del combo (frecuencia semanal), no de la disciplina |
| vigente_desde | date | |
| monto | numeric | |
*(los pagos/cargos guardan snapshot, no referencian precio vivo — RN-030)*

### descuentos
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| nombre | text | |
| descripcion | text | opcional |
| porcentaje | numeric | mismo campo para descuento y recargo, el signo lo da `tipo` |
| tipo | tipo_ajuste | default `'descuento'` (migración 16). `'recargo'` **suma** el porcentaje sobre el precio del combo en vez de restarlo. La tabla y `pagos_alumnos.descuento_id` no se renombraron a propósito — siguen llamándose "descuento" aunque ahora el catálogo incluye recargos, para no romper referencias existentes |
| aplica_a | tipo_pago[] | default `array['individual','familiar','adelantado']`. Filtra en qué selector de pago aparece el ítem (`descuentosParaTipo` en `lib/catalogos.ts`) — un ajuste puede restringirse a uno o dos tipos de pago. No afecta cargos ni RPCs, solo qué opciones ve el staff al elegir descuento en cada form |

### disciplinas
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| nombre | text | |
| activo | boolean | default true. No afecta el precio |

### combos
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| nombre | text | ej. "2 días", "3 días", "5 días" |
| frecuencia_semanal | integer | cantidad de asistencias esperadas por semana |
| activo | boolean | default true. Es lo único que define el precio |

### turnos
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| nombre | text | |
| hora | time | horario único del check-in (ya no tiene inicio/fin) |
| activo | boolean | default true |

### egresos
| id, concepto, monto, fecha, categoria |

### perfiles
| id (FK auth.users), nombre, rol (rol_usuario) |

## Campos que requieren snapshot (no referenciar valor vivo)
- `cargos.monto`
- `pagos_alumnos.precio_snapshot`

## RPCs necesarios (atomicidad)
- `fn_recalcular_cargo_automatico(alumno_id, periodo)` (migración 22, fix de prioridad en migración 23): calcula y hace upsert del cargo de un alumno en un período — reemplaza a `generar_cargos_periodo` (ver más abajo). La llaman `trg_asistencia_actualiza_cargo` (una asistencia real) y el backfill de reconciliación (una vez por alumno con asistencia en el período a reconstruir). No hace nada si el cargo ya existe y `validado = true`. Reglas:
  - **Tipo de cuota (RN-017/018, sin cambios)**: según el día del mes de la **primera asistencia del alumno en el período**. Día 1 al 14 → cuota completa. Día 15 en adelante → media cuota.
  - **Precio, en orden**:
    1. (Migración 23) Si el alumno **ya tiene un pago registrado en este mismo período** (`pagos_alumnos`, el más reciente por `created_at` si hay más de uno) → el monto es directamente `precio_snapshot` de ese pago, **sin recalcularlo** vía combo/precios/tipo. Motivo: recalcular podía dar un tipo distinto al que se usó al cobrar (ej. la primera asistencia registrada terminó siendo de otro tramo del mes que cuando se cargó el pago), y el monto reconstruido no coincidía con lo ya pagado — el cargo quedaba "parcial" aunque el alumno hubiera pagado exactamente lo que correspondía. El pago ya es la fuente de verdad de cuánto correspondía cobrar ese período.
    2. Si no hay pago en este período, **RN-030 original**: el `combo_id` del **último pago** del alumno en un período anterior (el de `periodo` más reciente anterior al que se está liquidando) — continuidad con lo que efectivamente pagó la vez anterior.
    3. Si no tiene pagos previos, se usa su plan actual (`alumnos.combo_id`).
    4. Si ninguna de las vías 2/3 resuelve un combo, o el combo no tiene un precio vigente (`precios.vigente_desde <=` fin del período), el cargo se genera igual (siempre que haya asistencia) con `monto = 0` y `monto_definido = false` — no se pierde el alumno, queda pendiente de que Admin/Profesor complete el monto a mano (ver doc 03, "Cargo con monto sin definir").
    5. (Migración 20, vía 2) Si ese **último pago de un período anterior** tuvo `descuento_id` no nulo, el cargo nuevo también se genera con `monto = 0` y `monto_definido = false`, aunque el combo sí tenga precio vigente — un descuento de un mes no se reaplica solo al siguiente. Esta protección no aplica a la vía 1 (pago del mismo período): ahí el descuento ya es parte de una decisión tomada para ese período exacto, no un arrastre.
  - **Unicidad (RN-020)**: único por (alumno_id, periodo) — `ON CONFLICT (alumno_id, periodo) DO UPDATE ... WHERE cargos.validado = false`. Un cargo ya validado nunca se pisa.
  - **Reconciliación de pagos huérfanos**: además del upsert, vincula cualquier `pagos_alumnos` de ese alumno/período que haya quedado con `cargo_id NULL` (pago registrado antes de que este cargo existiera) al cargo correspondiente. El `UPDATE` de `cargo_id` dispara `trg_pago_actualiza_estado_cargo` (ver abajo).
- `trg_asistencia_actualiza_cargo` (migración 22): trigger `AFTER INSERT` en `asistencias_alumnos` — llama a `fn_recalcular_cargo_automatico(alumno_id, periodo_de_la_asistencia)`. Convive con `trg_reactivar_alumno_por_asistencia` (mismo evento, tabla, sin pisarse — uno toca `alumnos.estado`, el otro `cargos`).
- `fn_recalcular_estado_cargo(cargo_id)` (migración 02, autovalidación en migración 22): recalcula `cargos.estado` sumando `pagos_alumnos.monto_pagado` de todos los pagos ligados al cargo, comparado contra `monto` (pendiente / parcial / pagado). Desde la migración 22, si el resultado es `'pagado'` (coincidencia exacta o sobrepago) también marca `validado = true` — automático, sin acción del staff. La llama `trg_pago_actualiza_estado_cargo` en cada INSERT/UPDATE/DELETE de `pagos_alumnos`.
- `trg_pago_actualiza_estado_cargo` (migración 02): trigger `AFTER INSERT OR UPDATE OF monto_pagado, cargo_id OR DELETE` en `pagos_alumnos` — llama a `fn_recalcular_estado_cargo` para el/los cargo(s) afectado(s) (en un UPDATE que cambia `cargo_id`, recalcula tanto el viejo como el nuevo).
- `trg_cargo_recalcula_estado_por_monto` (migración 02/05, ajustado en migración 22): trigger `BEFORE UPDATE OF monto` en `cargos` — recalcula `estado` en la misma fila y marca `monto_definido = true`. Desde la migración 22 también marca `validado = true`, **excepto** cuando el UPDATE viene del propio `fn_recalcular_cargo_automatico` (se distingue con la variable de sesión `tropa_gym.recalculo_automatico`, prendida solo ahí) — así una edición manual valida, pero el recálculo automático no se autovalida a sí mismo.
- `generar_cargos_periodo(periodo, confirmar)` — **en desuso desde la migración 22**, reemplazada por el mecanismo de arriba. Se dejó viva en la base (no se borró) por si hiciera falta volver atrás, pero el frontend ya no la llama. Candidata a `DROP FUNCTION` en una limpieza futura una vez confirmado que el sistema nuevo es estable.
- `eliminar_pago(pago_id)` (migración 21): borra un pago (todas sus filas de `pagos_alumnos` + `pagos`), auditando cada línea en `pagos_eliminados_auditoria` antes de borrarla. Solo Admin. El DELETE sobre `pagos_alumnos` dispara igual `trg_pago_actualiza_estado_cargo`, que recalcula el cargo afectado — si el cargo ya estaba `validado = true`, se mantiene así (sticky; no se revalida solo si el nuevo acumulado ya no alcanza a cubrirlo, el staff lo revisa a mano si hace falta).
- `registrar_pago_familiar(..., p_fecha?)` (migración 19 agrega `p_fecha`): crea 1 pago + N filas en pagos_alumnos. El detalle de cada alumno recibe `disciplina_id`/`combo_id` (antes texto libre). `p_fecha date DEFAULT NULL` — si no se manda, usa `now()`.
- `registrar_pago_adelantado(..., p_fecha?)` (migración 19 agrega `p_fecha`): crea N cargos/pagos en una transacción (uno por período). El detalle de cada período recibe `disciplina_id`/`combo_id` (antes texto libre). `p_fecha date DEFAULT NULL` — si no se manda, usa `now()`.
- `fn_registrar_cambio_estado(alumno_id, estado, origen, motivo, creado_por, fecha_desde?)` (migración 11/12): interna, no expuesta a PostgREST. Único punto que escribe `alumnos.estado*` + `alumno_estado_historial` juntos; no-op si no hay transición real.
- `marcar_estado_manual(alumno_id, estado, motivo?, fecha_desde?)` (migración 11/12): RPC pública, Admin/Profesor. Llama a `fn_registrar_cambio_estado` con `origen='manual'`.
- `sync_estados_automaticos()` (migración 11): recalcula inactivaciones (25 días sin asistir) sobre alumnos con `estado_origen='automatico'`. Se llama lazy al abrir la app (`useSyncEstadosAutomaticos`), no hay cron.
- `trg_reactivar_alumno_por_asistencia` (migración 11): trigger `AFTER INSERT` en `asistencias_alumnos` — si el alumno estaba inactivo (automático o manual), lo reactiva vía `fn_registrar_cambio_estado(..., origen='automatico')`.
- `trg_alumno_historial_alta` (migración 13): trigger `AFTER INSERT` en `alumnos` — siembra la fila inicial en `alumno_estado_historial` con el `estado`/`estado_origen` de alta. El alta (`NuevoAlumnoDrawer`) inserta en `alumnos` directo, sin RPC; sin este trigger el alumno nuevo no aparecía en el historial y el Dashboard (`fetchEstadoAlumnosPorPeriodo`) no lo contaba ni activo ni inactivo — bug detectado cuando el KPI dio 0 con alumnos recién cargados.
