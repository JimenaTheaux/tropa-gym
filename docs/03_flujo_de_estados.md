# 03. Flujo de Estados — TROPA GYM

## Estado del alumno
Calculado automáticamente según última asistencia. Nunca manual.

- **Activo**: asistencia en los últimos 25 días.
- **Alerta** (visual, no es estado formal): más de 15 días sin asistir. Aparece en "Alumnos próximos a inactivarse" del Centro de Resumen Mensual.
- **Inactivo**: 25 días consecutivos sin asistencia.

```
Asistencia registrada
      ↓
  [ACTIVO] ──(15 días sin asistir)──> aparece en alerta preventiva
      ↓
  (25 días sin asistir)
      ↓
  [INACTIVO]
```

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

Ahora `generar_cargos_periodo` separa las dos cosas: si hay asistencia, el cargo **siempre** se genera (con el `tipo` correcto); si no resuelve precio, se crea con `monto = 0` y `monto_definido = false` — un placeholder visible, no un cargo perdido. Admin/Profesor lo completa a mano (misma edición de `cargos.monto` de excepción, doc 02), lo que marca `monto_definido = true` y dispara el recálculo de `estado` normal.

Mientras `monto_definido = false`, si llega un pago contra ese cargo, el `estado` puede mostrar momentáneamente `pagado` (cualquier pago supera el umbral de $0) — se autocorrige solo apenas se define el monto real. Es un efecto transitorio esperado, no un error.

Estos cargos aparecen marcados con "A definir" directamente en la fila del alumno en la pantalla Cargos (editable ahí mismo, sin ir a otra pantalla), como alerta en el Centro de Resumen Mensual, y como badge rojo "Monto sin definir" en el estado de cuenta de la ficha del alumno — para que nunca se confunda con un cargo de $0 legítimo — hasta que se les define el monto.

### Plan actual de la ficha se actualiza con el pago (RN-035)
`alumnos.disciplina_id` y `alumnos.combo_id` ("plan actual") se cargan una vez al alta del alumno, pero es el pago mensual el que efectivamente confirma qué disciplina hace y qué combo está pagando — es la fuente más confiable de "qué plan tiene hoy". Por eso, cada pago **Individual** o **Familiar** actualiza automáticamente `alumnos.disciplina_id`/`combo_id` con lo que se cargó en ese pago, para que la ficha no quede desactualizada en silencio.

Esto es independiente de cómo se calcula el precio de un cargo (RN-030 sigue igual: usa el combo del último pago en un período anterior, con la ficha como fallback solo si el alumno nunca pagó) — acá lo que se mantiene al día es la ficha en sí, como referencia visible (check-in, listado de alumnos).

**Adelantado no dispara esta actualización**, a propósito: paga varios períodos futuros de una con el mismo combo/disciplina, y actualizar la ficha antes de que ese período arranque mostraría un plan que todavía no empezó (afectaría, por ejemplo, la disciplina preseleccionada en el check-in de asistencia).

## Estado de cuenta
Saldo = Cargos − Pagos (por alumno, acumulado).

## Flujo de liquidación mensual
Hay dos puntos de entrada, mismo cálculo de fondo (`generar_cargos_periodo`, RN-016/027):

- **Centro de Resumen Mensual** (Dashboard): resumen agregado — cantidades y monto total — pensado para ver de un vistazo si la liquidación está pendiente o generada. No tiene tabla alumno por alumno ni edición de montos.
- **Pantalla Cargos**: la vista completa para gestionar la liquidación. Tiene la tabla fila por fila y es donde se completan los montos sin definir. Ver detalle en doc 04.

Pasos (pantalla Cargos, la vía completa):
1. Admin elige el período y toca "Ver preview". El sistema calcula (sin persistir todavía) cuotas completas, medias cuotas, alumnos sin asistencia y el monto de cada cargo — resuelto automáticamente cuando hay combo+precio, o marcado "A definir" cuando no.
2. Para las filas "A definir", el admin carga el monto ahí mismo, en la misma tabla. El total ("Monto a generar") se recalcula en vivo con lo que va completando — el preview deja de ser una foto ciega y pasa a ser el lugar donde se valida la liquidación completa antes de confirmar.
3. Admin confirma "Generar cargos del período" (modal de confirmación, RN-027 — única vía para liquidar). El modal muestra el total real y avisa si van a quedar cargos sin monto definido (se generan igual, en $0, para no perder al alumno — ver "Cargo con monto sin definir" arriba).
4. Sistema crea los cargos (uno por alumno con asistencia en el período) y aplica automáticamente los montos que el admin cargó a mano en el paso 2.
5. Si igual quedan cargos sin definir (el admin no llegó a completarlos), se pueden resolver después desde la misma pantalla Cargos, desde la ficha del alumno, o desde el panel del Centro de Resumen Mensual — las tres vías escriben sobre el mismo `cargos.monto`.

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
