# 04. Funcionalidades por Módulo — TROPA GYM

## Login
- Inicio de sesión.
- Validación de acceso.
- Asociación de perfil y rol.

## Dashboard
Submenú con 2 vistas: **KPI** y **Centro de Resumen Mensual**.

### Vista KPI
- Filtro global por período (selector de fechas/mes).
- Card: Alumnos activos. Cuenta el estado vigente **al cierre del período filtrado** (o "hoy" si el período no cerró), reconstruido desde `alumno_estado_historial` — no asistencia dentro del mes (ver doc 03).
- Card: $ Ingresos.
- Card: $ Saldo a cobrar.
- Card: $ Egresos.
- Card: $ Ganancia neta.
- Gráfico de ganancia neta por período (`TrendChart`, línea).
- Gráfico de evolución de alumnos activos/inactivos por período (`EstadoEvolucionChart`) — barra apilada (activos abajo, inactivos arriba) por período, con tooltip de desglose; mismo cálculo punto-en-el-tiempo que la card de arriba. Reemplazó a dos `TrendChart` separados (no se podían comparar entre sí).
- Card: top de horarios con mayor ocupación (calculado desde asistencias_alumnos + turnos).

### Centro de Resumen Mensual
Funciona como centro de alertas. Orden de secciones:

**A. Liquidación del período** (arriba, es la acción principal)
- Estado: pendiente / generada.
- Preview antes de confirmar (RN-016): cantidad de cuotas completas, cantidad de medias cuotas, alumnos sin asistencia, monto total estimado. Cada cuadrito tiene un ícono de info con tooltip al pasar el mouse, explicando su lógica:
  - **Cuotas completas**: alumnos cuya primera asistencia del período fue entre el día 1 y el 14.
  - **Medias cuotas**: alumnos cuya primera asistencia del período fue del día 15 en adelante — se les cobra la mitad del precio del combo.
  - **Alumnos sin asistencia**: alumnos activos sin ninguna asistencia registrada en el período — no se les genera cargo.
  - **Monto a generar**: suma de los cargos nuevos. El precio de cada uno sale del combo con el que el alumno pagó el período anterior (o su plan actual si es la primera vez que se le liquida), según el precio vigente de ese combo.
- Botón "Generar cargos del período" → modal de confirmación (RN-027: única vía para liquidar).

**B. Fila de alertas** (KPIs chicos, estilo borde — doc 08)
- Alumnos con deuda (cantidad + monto total).
- Alumnos próximos a inactivarse (cantidad).
- Horas totales de profesores en el período.
- Cargos sin monto definido (cantidad) — alumnos con asistencia en el período pero sin combo/precio resuelto (ver doc 03, "Cargo con monto sin definir").

**C. Panel Deudores**
- Lista: alumno, monto adeudado, días de vencimiento.
- Acción rápida: **contactar por WhatsApp**.
  - Abre WhatsApp (web o mobile, según dispositivo) directo en el chat del alumno, usando su teléfono registrado.
  - Requiere que `alumnos.telefono` esté guardado en formato internacional sin símbolos (ver doc 06 — nota de formato).
  - Link: `https://wa.me/{telefono_normalizado}` — sin mensaje predefinido, deja que el admin escriba.
  - Acción secundaria: ver ficha del alumno.

**C.2 Panel Cargos sin monto definido** (solo visible si hay alguno)
- Lista: alumno, período, tipo de cuota, edición inline del monto (mismo componente que la pantalla Cargos y la ficha del alumno — las tres escriben sobre `cargos.monto`/`monto_definido`).
- Acción rápida: ver ficha.

**D. Panel Próximos a inactivarse**
- Lista: alumno, días sin asistir (+15, RN-004).
- Acción rápida: ver ficha.

**E. Panel Horas por profesor**
- Tabla: profesor, horas del mes, cantidad de asistencias registradas.

## Alumnos
- Alta, edición, baja.
- Datos: Nombre, Apellido, DNI (obligatorios); Teléfono, Fecha de nacimiento (opcionales).
- Plan actual: Disciplina + Combo (opcional en el alta, es lo que se muestra en el check-in de asistencia). Se actualiza solo con cada pago Individual/Familiar — no hace falta editarlo a mano cuando el alumno cambia de plan (RN-035, no aplica a Adelantado).
- Estado Activo/Inactivo, híbrido (ver doc 03): automático por defecto (25 días sin asistir), o forzado a mano por Admin/Profesor tocando el badge (`EstadoToggleButton`, en el listado y en la Ficha) — confirmación pide fecha desde la que rige (backdateable) y motivo opcional si pasa a inactivo. Una asistencia real siempre reactiva, sea cual sea el origen. La Ficha muestra además el historial completo de cambios (fecha, origen, motivo).
- Estado de cuenta (ficha del alumno): saldo por período, con badge de estado del cargo (Pendiente/Parcial/Pagado) y, si corresponde, badge rojo "Monto sin definir" (ver doc 03) — editable en el momento por Admin/Profesor.

## Pagos
Un solo submenú: **Historial de pagos** (lista, siempre visible) + botón sólido **"+ Registrar pago"**, que abre un drawer único (`RegistrarPagoDrawer`) para los 3 tipos.

- Tipos: Individual, Familiar, Adelantado.
- El drawer arranca siempre en modo **Individual** (estado default, mantiene el flujo de siempre: buscador de alumno → se despliega el resto del form). Arriba, un segmented control de 2 botones — "Pago familiar" / "Pago adelantado" — para desviar del default; no hay un tercer botón para Individual (doc 08). Cambiar de modo desmonta el panel anterior (los 3 son componentes distintos: `IndividualPanel`/`FamiliarPanel`/`AdelantadoPanel`), así que el form se resetea solo, sin arrastrar datos entre modos.
- Individual: alumno, período, disciplina, combo, tipo de cuota, descuento, método, total. Sin cambios de flujo respecto a como funcionaba antes de unificar el submenú.
- Familiar: un comprobante, varios alumnos vía `AlumnoBuscador` (siempre visible arriba de la lista, se puede seguir agregando sin pasos extra), cada uno con disciplina/combo/tipo de cuota propios — pero **un solo selector de descuento al final**, aplicado sobre el total. Al elegirlo (o cambiarlo), recalcula el precio de todas las filas ya cargadas. El dato sigue viviendo en `pagos_alumnos.descuento_id` por fila (se guarda el mismo descuento en cada una), solo cambia que el staff lo carga una vez. Cada fila muestra su subtotal (precio del combo con el descuento ya aplicado) de forma permanente, no solo cuando el monto pagado difiere.
- Adelantado: alumno, disciplina y combo se cargan **una sola vez** (no por período). Un selector múltiple de checkboxes con los próximos 12 períodos (decisión sin especificación explícita en el prompt — N=12) reemplaza el alta manual "de a uno". Cada período tildado aparece como su propia línea con subtotal y monto editable (pago parcial/sobrepago por período, igual que antes). Un solo selector de descuento al final, aplicado a todas las líneas. Al confirmar, arma el array de períodos (uno por cada tildado, con su propio `precio_snapshot`/`monto_pagado`) antes de llamar a `registrar_pago_adelantado` — el RPC no cambió.
  - **Precio por período (`precioVigenteAdelantado` en `lib/precios.ts`)**: para períodos ya transcurridos (fin de período ≤ hoy) usa el precio vigente al **fin de ese período** (mismo criterio que `generar_cargos_periodo`, migración 15). Para períodos en curso o futuros (fin de período > hoy) usa el precio vigente **hoy** — no existe un precio "histórico" de algo que todavía no pasó.
- El precio sale del combo elegido (la disciplina no afecta el precio).
- Tipo de cuota (Completa/Media, selector — Individual y cada sub-pago de Familiar): decisión manual del staff al registrar el pago, no se detecta sola. Es una regla de facturación (RN-017/018), no un descuento — se aplica sobre el precio del combo antes de cualquier descuento/recargo comercial. Adelantado no lo tiene: paga el mismo plan completo para todos los períodos futuros.
- Descuento/Recargo (opcional, selector — mismo catálogo de Configuración → Descuentos/Recargos): un ítem de tipo "descuento" resta su porcentaje sobre el precio del combo (después del tipo de cuota); uno de tipo "recargo" lo suma. El selector diferencia ambos con el signo delante del nombre (ej. "+10% Recargo tarjeta" / "-10% Descuento familiar") para no confundirlos a simple vista. Cada uno de los 3 selectores (Individual/Familiar/Adelantado) filtra el catálogo por `descuentos.aplica_a` (`descuentosParaTipo` en `lib/catalogos.ts`) — un ajuste restringido a un tipo no aparece en los otros dos.
- Individual y Familiar actualizan automáticamente el "plan actual" (disciplina/combo) de la ficha del alumno con lo cargado en el pago (RN-035). Adelantado no la toca.
- Métodos: Efectivo, Transferencia, Combinado (registra importe de cada uno).
- Pagos parciales: estado "Parcial" mientras saldo > 0.
- Historial y estado de cuenta.

## Asistencia Alumnos
1. Buscar por DNI o nombre.
2. Mostrar estado de cuenta y plan actual del alumno (disciplina + combo).
3. Seleccionar turno (solo el horario del check-in).
4. Confirmar asistencia.

## Asistencia Profesores
- Registro de entrada.
- Registro de salida.
- Fecha.
- Insumo para "horas mensuales por profesor" en Dashboard.
- Login compartido en la compu del gimnasio (varios profesores bajo la misma sesión, ver doc 02): el marcado de entrada/salida ya identifica al profesor por card, no depende de la sesión. La tabla/historial de abajo (no las cards) muestra la columna **Profesor** siempre, tanto para Admin como para Profesor — antes solo la veía Admin, dejaba de tener sentido con login compartido (migración 16, RLS).

## Cargos
Pantalla dedicada a gestionar la liquidación mensual (solo Admin — doc 02). Es la vía completa; el Centro de Resumen Mensual del Dashboard muestra el mismo cálculo pero resumido, sin tabla ni edición (ver doc 03, "Flujo de liquidación mensual").

1. Elegir período → "Ver preview": calcula (sin persistir) cuota completa/media según el día de la primera asistencia del alumno en el período (RN-017/018), y el monto según combo+precio vigente (RN-030).
2. Cards resumen, en vivo: cuotas completas, medias cuotas, alumnos sin asistencia, cargos sin monto definido, monto total a generar.
3. Tabla por alumno — nombre, tipo de cuota, monto, estado (Ya generado / A generar). Las filas con monto "A definir" son editables directamente en la tabla, sin salir de la pantalla:
   - Si el cargo **ya existe** (se generó en una corrida anterior sin poder resolver combo/precio): el monto se guarda al toque, con confirmación — misma edición de excepción que en la ficha del alumno.
   - Si el cargo **todavía no existe**: el monto que se carga queda pendiente y se aplica solo al confirmar la generación del período.
4. Botón "Generar cargos del período" → modal de confirmación (RN-027, única vía para liquidar). Muestra el total real (incluye lo que se completó a mano) y avisa si van a quedar cargos sin monto definido — se generan igual, en $0, para no perder al alumno.
5. Alumnos activos sin ninguna asistencia en el período: listados aparte, no se les genera cargo.

## Egresos
- Registro de gastos (sin acceso de Profesor/Kiosco).
- Filtro de período (selector mes/año) arriba de la tabla — filtra server-side (`.gte()`/`.lt()` sobre `fecha`). Default: mes actual al entrar a la pantalla.

## Configuración
- Descuentos/Recargos: nombre, descripción, porcentaje, tipo (Descuento resta / Recargo suma sobre el precio del combo), **Aplica a** (checkboxes Individual/Familiar/Adelantado, mapea a `descuentos.aplica_a`, los 3 tildados por default) — mismo CRUD, un campo más. No se renombró la tabla ni `pagos_alumnos.descuento_id` (ver doc 06).
- Disciplinas: nombre, activar/desactivar. No afecta el precio.
- Combos: nombre, frecuencia semanal de asistencia (2 días, 3 días, 5 días…), activar/desactivar. Es lo único que define el precio.
- Precios: asociados a combo, período. Cambios no afectan pagos históricos (RN-030).
- Profesores: alta/gestión.
- Turnos: nombre, hora única, activar/desactivar (ya no tienen hora de inicio/fin).

## Roles y Permisos
- Ver doc 02.
