# 04. Funcionalidades por Módulo — TROPA GYM

## Login
- Inicio de sesión.
- Validación de acceso.
- Asociación de perfil y rol.

## Dashboard
### Dashboard Principal
- KPIs generales (a definir en Fase 5).

### Centro de Resumen Mensual
- Liquidación pendiente del período.
- Cantidad de alumnos con deuda.
- Monto total adeudado.
- Acceso al listado de deudores.
- Alumnos próximos a inactivarse (+15 días sin asistencia).
- Horas mensuales por profesor.
- Acción: "Generar cargos del período" (única vía para liquidar, RN-027).

## Alumnos
- Alta, edición, baja.
- Datos: Nombre, Apellido, DNI (obligatorios); Teléfono, Fecha de nacimiento (opcionales).
- Estado calculado (Activo/Inactivo).
- Estado de cuenta (ficha del alumno).

## Pagos
- Tipos: Individual, Familiar, Adelantado.
- Individual: alumno, período, servicio, combo, descuento, método, total.
- Familiar: un comprobante, varios alumnos, cada uno con servicio/combo/descuento propio.
- Adelantado: varios períodos en una operación, cada uno registrado individualmente.
- Métodos: Efectivo, Transferencia, Combinado (registra importe de cada uno).
- Pagos parciales: estado "Parcial" mientras saldo > 0.
- Historial y estado de cuenta.

## Asistencia Alumnos
1. Buscar por DNI o nombre.
2. Mostrar estado de cuenta, servicio, combo.
3. Seleccionar turno.
4. Confirmar asistencia.

## Asistencia Profesores
- Registro de entrada.
- Registro de salida.
- Fecha.
- Insumo para "horas mensuales por profesor" en Dashboard.

## Egresos
- Registro de gastos (sin acceso de Profesor/Kiosco).

## Configuración
- Descuentos: nombre, descripción, porcentaje.
- Precios: asociados a servicio, combo, período. Cambios no afectan pagos históricos (RN-030).
- Profesores: alta/gestión.
- Turnos: alta/gestión.

## Roles y Permisos
- Ver doc 02.
