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
- `estado_pago`: pendiente | parcial | pagado
- `tipo_pago`: individual | familiar | adelantado
- `metodo_pago`: efectivo | transferencia | combinado
- `rol_usuario`: admin | profesor | kiosco

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
| estado | estado_alumno | calculado, default 'activo' |
| fecha_alta | timestamptz | default now() |

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
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| alumno_id | FK alumnos | |
| periodo | text (YYYY-MM) | |
| tipo | 'completa' \| 'media' | RN-017/018 |
| monto | numeric | snapshot del precio vigente, o `0` si no se pudo resolver al generar (ver `monto_definido`). **Editable** por Admin/Profesor como excepción — ver doc 02. Cualquier edición recalcula `estado` y marca `monto_definido = true` |
| estado | estado_pago | **Le pertenece al cargo, no al pago** (ver doc 03). Calculado automáticamente por trigger: suma de `pagos_alumnos.monto_pagado` de todos los pagos ligados a este cargo, comparada contra `monto` |
| monto_definido | boolean | default `true`. `false` cuando `generar_cargos_periodo` no pudo resolver combo+precio (RN-030) — el cargo existe igual (con `monto=0`), pero necesita que Admin/Profesor lo complete a mano. Se puede completar desde la pantalla Cargos (edición inline en la tabla), la ficha del alumno (badge "Monto sin definir") o el Centro de Resumen Mensual — las tres escriben sobre esta misma columna. Ver doc 03, "Cargo con monto sin definir" |
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
| fecha | timestamptz | |

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
| id, nombre, descripcion, porcentaje |

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
- `generar_cargos_periodo(periodo)`: calcula y crea cargos, requiere preview antes de confirmar. Reglas:
  - **Tipo de cuota (RN-017/018)**: según el día del mes de la **primera asistencia del alumno en el período**. Día 1 al 14 → cuota completa. Día 15 en adelante → media cuota (mitad del precio).
  - **Precio (RN-030)**: sale de `precios.combo_id`. El combo a usar se resuelve así, en orden:
    1. El `combo_id` del **último pago** del alumno en un período anterior (`pagos_alumnos`, el de `periodo` más reciente anterior al que se está liquidando) — continuidad con lo que efectivamente pagó la vez anterior.
    2. Si no tiene pagos previos, se usa su plan actual (`alumnos.combo_id`).
    3. Si ninguna de las dos vías resuelve un combo, o el combo no tiene un precio vigente (`precios.vigente_desde <= hoy`), el cargo se genera igual (siempre que haya asistencia) con `monto = 0` y `monto_definido = false` — no se pierde el alumno, queda pendiente de que Admin/Profesor complete el monto a mano (ver doc 03, "Cargo con monto sin definir").
  - **Unicidad (RN-020)**: único por (alumno_id, periodo) — un alumno ya liquidado en el período no se vuelve a insertar (`ON CONFLICT DO NOTHING`), pero sí aparece en el preview marcado `ya_existe`.
  - **Reconciliación de pagos huérfanos**: al confirmar (`p_confirmar = true`), además de insertar los cargos, vincula cualquier `pagos_alumnos` de ese período que haya quedado con `cargo_id NULL` (pago registrado antes de que este cargo existiera — caso típico: alguien paga antes de que Admin corra esta liquidación) al cargo correspondiente (recién creado o ya existente). El `UPDATE` de `cargo_id` dispara el recálculo de `cargos.estado` (ver doc 03).
- `registrar_pago_familiar(...)`: crea 1 pago + N filas en pagos_alumnos. El detalle de cada alumno recibe `disciplina_id`/`combo_id` (antes texto libre).
- `registrar_pago_adelantado(...)`: crea N cargos/pagos en una transacción (uno por período). El detalle de cada período recibe `disciplina_id`/`combo_id` (antes texto libre).
- `calcular_estado_alumno()`: job o vista que recalcula activo/inactivo según última asistencia.
