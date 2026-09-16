# 03. Flujo de Estados — TROPA GYM

## Estado del alumno (híbrido: automático + manual)
Migración 11/12. Reemplaza el esquema original (calculado siempre, nunca manual, y que en la práctica nunca se recalculaba porque no había trigger ni cron que lo disparara).

`alumnos` guarda `estado` (activo/inactivo), `estado_origen` (`automatico`/`manual`), `estado_motivo` y `estado_desde`. Cada cambio queda además registrado en `alumno_estado_historial` (una fila por transición, no solo el último estado) — ver doc 06.

- **Automático (default)**:
  - **Activo**: asistencia en los últimos 25 días.
  - **Alerta** (visual, no es estado formal): 15 a 24 días sin asistir. Aparece en "Alumnos próximos a inactivarse" del Centro de Resumen Mensual.
  - **Inactivo**: 25 días consecutivos sin asistencia. Se aplica vía `sync_estados_automaticos()`, que se llama lazy al abrir la app (`useSyncEstadosAutomaticos`, staleTime 1h) — no hay cron. Solo toca alumnos con `estado_origen = 'automatico'`.
- **Manual**: Admin/Profesor pueden forzar el estado a mano (licencia, lesión, pausa, etc.) desde el badge Activo/Inactivo (`EstadoToggleButton`, en Alumnos y en la Ficha) — clic abre confirmación con la **fecha desde la que rige** (editable, permite backdatear: "de baja desde el lunes") y **motivo** opcional si pasa a inactivo. RPC `marcar_estado_manual`.
- **Reactivación automática**: una asistencia real **siempre** reactiva al alumno (trigger `trg_asistencia_reactiva_alumno`), esté inactivo por la regla automática o por una baja manual — nunca queda "atascado" en inactivo manual mientras el alumno vuelve a asistir. La reactivación por asistencia queda registrada como `estado_origen = 'automatico'`.
- **Alta de alumno (migración 13)**: el alta (`NuevoAlumnoDrawer`/`AlumnoFormFields`) hace un `INSERT` directo en `alumnos`, sin pasar por ningún RPC. El trigger `trg_alumno_historial_alta` (`AFTER INSERT ON alumnos`) siembra la fila inicial en `alumno_estado_historial` con el `estado`/`estado_origen` con el que se creó (normalmente `activo`/`automatico`). **Bug corregido por esta migración**: sin este trigger, un alumno nuevo tenía `alumnos.estado = 'activo'` (se veía bien en el Listado) pero no aparecía en `alumno_estado_historial`, así que el KPI/gráfico del Dashboard no lo contaba ni como activo ni como inactivo — el conteo daba de menos (llegó a mostrar 0 con una base de alumnos recién recreada, ej. después de un reset de datos).

```
Asistencia registrada
      ↓
  [ACTIVO, automático] ──(15 días sin asistir)──> alerta preventiva
      ↓
  (25 días sin asistir, sync_estados_automaticos)
      ↓
  [INACTIVO, automático] <──(asistencia real, trigger)── vuelve a ACTIVO
      ↑↓
  Admin/Profesor fuerza el estado (marcar_estado_manual) ──> [ACTIVO|INACTIVO, manual]
                                                                     │
                                                    (asistencia real reactiva igual)
```

### Dashboard: conteo por período, no por asistencia del mes
El KPI "Alumnos activos" y el gráfico de evolución (`EstadoEvolucionChart`, barra apilada activos+inactivos) ya no cuentan asistencia dentro del mes — reconstruyen el **estado vigente de cada alumno al cierre de cada período** (o "hoy" si el período no cerró) a partir de `alumno_estado_historial` (`fetchEstadoAlumnosPorPeriodo`, doc 06). Un alumno sin ninguna fila de historial con `fecha_desde` anterior al corte todavía no existía en ese período y no cuenta ni como activo ni como inactivo. Esto evita el problema del esquema anterior, donde el conteo nunca se recalculaba y quedaba desalineado con la realidad.

## Estado del cargo
El `estado` (pendiente/parcial/pagado) es una propiedad del **cargo** (la deuda del período), no del pago. Un pago es una transacción puntual; lo que puede estar "parcial" es la deuda que ese pago va cancelando.

- **Pendiente**: suma de `monto_pagado` de todos los pagos ligados al cargo = 0.
- **Parcial**: 0 < suma de `monto_pagado` < `cargos.monto`.
- **Pagado**: suma de `monto_pagado` >= `cargos.monto`.

El recálculo es automático (trigger) y usa el **acumulado de todos los pagos** del cargo (`cargo_id`), no solo el último pago registrado. Se dispara en dos casos:
1. Cada INSERT/UPDATE/DELETE en `pagos_alumnos` (se recalcula el cargo afectado).
2. Cada UPDATE de `cargos.monto` (edición manual — ver doc 02, Admin/Profesor).

```
Cargo generado → [PENDIENTE]
      ↓ (suma pagos > 0, < monto)
  [PARCIAL] ──(suma pagos >= monto)──> [PAGADO]
```

### Sobrepago (saldo a favor)
Si la suma de `monto_pagado` supera `cargos.monto`, el cargo igual queda **pagado** (no existe un estado "sobrepagado"). El excedente no se guarda en una tabla aparte: queda reflejado en el **Saldo de cuenta** general del alumno (`Saldo = Cargos − Pagos`, RN-023), que da negativo — es decir, saldo a favor. Ese saldo negativo se puede imputar a futuros períodos simplemente al calcular la cuenta corriente acumulada.

### Cargo con monto sin definir
"¿Tiene que pagar, y qué tipo (completa/media)?" se resuelve solo con la asistencia (RN-017/018) y siempre es calculable. "¿Cuánto exactamente?" depende de combo+precio (RN-030), que a veces no se puede resolver (alumno sin plan asignado y sin pago previo en un período anterior). Antes, si fallaba lo segundo, se perdía silenciosamente lo primero — el alumno no aparecía en ningún lado.

Ahora `fn_recalcular_cargo_automatico` (migración 22, ex `generar_cargos_periodo`) separa las dos cosas: si hay asistencia, el cargo **siempre** se genera/actualiza (con el `tipo` correcto); si no resuelve precio, queda con `monto = 0` y `monto_definido = false` — un placeholder visible, no un cargo perdido. Admin/Profesor lo completa a mano (misma edición de `cargos.monto` de excepción, doc 02), lo que marca `monto_definido = true` y **`validado = true`** (ver "Cargo continuo y validación" más abajo), y dispara el recálculo de `estado` normal.

Mientras `monto_definido = false`, si llega un pago contra ese cargo, el `estado` puede mostrar momentáneamente `pagado` (cualquier pago supera el umbral de $0) — se autocorrige solo apenas se define el monto real. Es un efecto transitorio esperado, no un error.

Estos cargos aparecen marcados con "A definir" directamente en la fila del alumno en la pantalla Cargos (editable ahí mismo, sin ir a otra pantalla), como alerta en el Centro de Resumen Mensual, y como badge rojo "Monto sin definir" en el estado de cuenta de la ficha del alumno — para que nunca se confunda con un cargo de $0 legítimo — hasta que se les define el monto.

### Plan actual de la ficha se actualiza con el pago (RN-035)
`alumnos.disciplina_id` y `alumnos.combo_id` ("plan actual") se cargan una vez al alta del alumno, pero es el pago mensual el que efectivamente confirma qué disciplina hace y qué combo está pagando — es la fuente más confiable de "qué plan tiene hoy". Por eso, cada pago **Individual** o **Familiar** actualiza automáticamente `alumnos.disciplina_id`/`combo_id` con lo que se cargó en ese pago, para que la ficha no quede desactualizada en silencio.

Esto es independiente de cómo se calcula el precio de un cargo (RN-030 sigue igual: usa el combo del último pago en un período anterior, con la ficha como fallback solo si el alumno nunca pagó) — acá lo que se mantiene al día es la ficha en sí, como referencia visible (check-in, listado de alumnos).

**Adelantado no dispara esta actualización**, a propósito: paga varios períodos futuros de una con el mismo combo/disciplina, y actualizar la ficha antes de que ese período arranque mostraría un plan que todavía no empezó (afectaría, por ejemplo, la disciplina preseleccionada en el check-in de asistencia).

## Estado de cuenta
Saldo = Cargos − Pagos (por alumno, acumulado).

## Flujo de liquidación mensual — cargo continuo (migración 22)
Reemplaza por completo el flujo anterior de "generar cargos del período" (botón + preview + confirmación por lote, RN-016/027 — ya no aplican). No hay ningún paso manual que dispare la creación de cargos: cada asistencia nueva crea o actualiza sola el cargo de ese alumno/período, vía trigger de base (`trg_asistencia_actualiza_cargo` → `fn_recalcular_cargo_automatico`, ver doc 06). El Centro de Resumen Mensual y la pantalla Cargos son dos ventanas de **lectura y edición en vivo** sobre la misma tabla `cargos`, no dos pasos de un mismo proceso de generación.

### Cargo validado — protección contra el recálculo automático
Mientras un cargo tiene `validado = false`, el trigger automático puede seguir recalculando `tipo` y `monto` libremente cada vez que llega una asistencia nueva del alumno en ese período (por ejemplo, si el combo/precio se resuelve recién con una asistencia posterior). Apenas `validado = true`, el trigger **nunca más** toca ese cargo — solo una acción humana lo cambia.

`validado` pasa a `true` en dos casos:
- **Automático**: el acumulado de pagos deja el cargo en `estado = 'pagado'` (coincidencia exacta o sobrepago) — el pago ya confirmó que el monto estimado era correcto, no hace falta que nadie lo revise. Un pago **parcial** no autovalida: el cargo sigue con el monto resuelto por combo, la deuda restante se ve sola (mismo cálculo de `estado` de siempre), y queda a la espera de que un humano lo valide.
- **Manual**: Admin/Profesor edita `cargos.monto` a mano (misma edición de excepción de siempre, doc 02) — se toma como una decisión consciente, así que también valida. O tilda el checkbox "Validar" en la pantalla Cargos, sin cambiar el monto — sirve para los casos donde el monto ya está bien y solo hace falta confirmarlo.

Como el volumen de cargos que ya están pagados pero no llegaron a autovalidarse antes de este cambio (o por cualquier reconciliación hecha fuera de la app) puede ser grande, la pantalla Cargos tiene un botón **"Validar pagados (N)"** que tilda `validado = true` de una sola vez en todos los cargos del período que ya están en `estado = 'pagado'` — no hace falta ir fila por fila.

### Precio del cargo — prioridad (RN-030 extendida)
1. Si el alumno **ya tiene un pago registrado en este mismo período**, se usa directamente el `precio_snapshot` de ese pago (sin recalcularlo) — el pago ya es la fuente de verdad de cuánto correspondía cobrar. Cubre tanto "pagó y después vino a entrenar" (pago huérfano, se reconcilia solo apenas exista el cargo) como "vino a entrenar y pagó después".
2. Si no, la vía original: combo del **último pago en un período anterior** → si no, el plan actual del alumno (`alumnos.combo_id`) → si ninguna resuelve combo+precio vigente, `monto = 0` y `monto_definido = false` ("Cargo con monto sin definir", arriba). Si ese último pago anterior tuvo un descuento, también se fuerza "a definir" (migración 20) — un descuento no se reaplica solo al período siguiente.

### Pantallas
- **Pantalla Cargos**: tabla en vivo, una fila por cargo del período — alumno, tipo, monto (editable inline + checkbox Validar), botón "Ver asistencias" (detalle + resumen por semana del mes) y "Ver pagos" (historial de pagos del alumno en ese período: fecha, monto, forma de pago, estado), estado (solo lectura). Buscador por nombre y filtros por tipo/estado. Alumnos activos sin ningún cargo en el período (todavía sin asistencia) se listan aparte.
- **Centro de Resumen Mensual** (Dashboard): mismos datos, resumidos — cantidades de cuotas completas/medias/pagadas/sin validar y monto total del período, sin tabla fila por fila. Los paneles de Deudores y Cargos sin monto definido sí son tablas completas (buscador, filtro, monto editable inline) — ver doc 04.

## Flujo de asistencia (alumno)
1. Buscar por DNI/nombre/apellido.
2. Mostrar estado de cuenta, servicio, combo vigente.
3. Seleccionar turno.
4. Confirmar asistencia (deuda nunca bloquea el ingreso).

## Flujo de pago
1. Seleccionar alumno.
2. Definir período, servicio, combo, descuento → sistema calcula el precio (`precio_snapshot`).
3. Monto pagado: pre-cargado con el precio calculado, editable (permite pago parcial o sobrepago).
4. Elegir método (efectivo, transferencia, combinado) — la suma efectivo+transferencia debe igualar el **monto pagado**, no el precio calculado.
5. Registrar pago → recalcula automáticamente el estado del cargo asociado (ver arriba).
