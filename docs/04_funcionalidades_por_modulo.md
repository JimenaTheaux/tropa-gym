# 04. Funcionalidades por Módulo — TROPA GYM

## Login
- Inicio de sesión.
- Validación de acceso.
- Asociación de perfil y rol.

## Dashboard
Submenú con 2 vistas: **KPI** y **Centro de Resumen Mensual**.

### Vista KPI
- Filtro global por período (selector de fechas/mes).
- Card: Alumnos activos.
- Card: $ Ingresos.
- Card: $ Saldo a cobrar.
- Card: $ Egresos.
- Card: $ Ganancia neta.
- Gráfico temporal, 2 categorías: ganancia neta por período / cantidad de alumnos activos por período.
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

**C. Panel Deudores**
- Lista: alumno, monto adeudado, días de vencimiento.
- Acción rápida: **contactar por WhatsApp**.
  - Abre WhatsApp (web o mobile, según dispositivo) directo en el chat del alumno, usando su teléfono registrado.
  - Requiere que `alumnos.telefono` esté guardado en formato internacional sin símbolos (ver doc 06 — nota de formato).
  - Link: `https://wa.me/{telefono_normalizado}` — sin mensaje predefinido, deja que el admin escriba.
  - Acción secundaria: ver ficha del alumno.

**D. Panel Próximos a inactivarse**
- Lista: alumno, días sin asistir (+15, RN-004).
- Acción rápida: ver ficha.

**E. Panel Horas por profesor**
- Tabla: profesor, horas del mes, cantidad de asistencias registradas.

## Alumnos
- Alta, edición, baja.
- Datos: Nombre, Apellido, DNI (obligatorios); Teléfono, Fecha de nacimiento (opcionales).
- Plan actual: Disciplina + Combo (opcional en el alta, es lo que se muestra en el check-in de asistencia). Se actualiza solo con cada pago Individual/Familiar — no hace falta editarlo a mano cuando el alumno cambia de plan (RN-035, no aplica a Adelantado).
- Estado calculado (Activo/Inactivo).
- Estado de cuenta (ficha del alumno): saldo por período, con badge de estado del cargo (Pendiente/Parcial/Pagado) y, si corresponde, badge rojo "Monto sin definir" (ver doc 03) — editable en el momento por Admin/Profesor.

## Pagos
- Tipos: Individual, Familiar, Adelantado.
- Individual: alumno, período, disciplina, combo, tipo de cuota, descuento, método, total.
- Familiar: un comprobante, varios alumnos, cada uno con disciplina/combo/tipo de cuota/descuento propio.
- Adelantado: varios períodos en una operación, cada uno registrado individualmente.
- El precio sale del combo elegido (la disciplina no afecta el precio).
- Tipo de cuota (Completa/Media, selector — Individual y cada sub-pago de Familiar): decisión manual del staff al registrar el pago, no se detecta sola. Es una regla de facturación (RN-017/018), no un descuento — se aplica sobre el precio del combo antes de cualquier descuento comercial. Adelantado no lo tiene: paga el mismo plan completo para todos los períodos futuros.
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

## Configuración
- Descuentos: nombre, descripción, porcentaje.
- Disciplinas: nombre, activar/desactivar. No afecta el precio.
- Combos: nombre, frecuencia semanal de asistencia (2 días, 3 días, 5 días…), activar/desactivar. Es lo único que define el precio.
- Precios: asociados a combo, período. Cambios no afectan pagos históricos (RN-030).
- Profesores: alta/gestión.
- Turnos: nombre, hora única, activar/desactivar (ya no tienen hora de inicio/fin).

## Roles y Permisos
- Ver doc 02.
