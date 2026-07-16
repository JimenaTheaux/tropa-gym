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

## Estado del pago
- **Pendiente**: cargo generado, sin pago asociado.
- **Parcial**: saldo pendiente > 0 tras un pago.
- **Pagado**: saldo pendiente = 0.

```
Cargo generado → [PENDIENTE]
      ↓ (pago parcial)
  [PARCIAL] ──(pago completa saldo)──> [PAGADO]
      ↓ (pago cubre 100%)
  [PAGADO]
```

## Estado de cuenta
Saldo = Cargos − Pagos (por alumno, acumulado).

## Flujo de liquidación mensual
1. Admin abre Centro de Resumen Mensual.
2. Sistema muestra preview: cuotas completas, medias cuotas, alumnos sin asistencia, monto total estimado.
3. Admin confirma "Generar cargos del período".
4. Sistema crea los cargos (uno por alumno activo del período, máximo).

## Flujo de asistencia (alumno)
1. Buscar por DNI/nombre/apellido.
2. Mostrar estado de cuenta, servicio, combo vigente.
3. Seleccionar turno.
4. Confirmar asistencia (deuda nunca bloquea el ingreso).

## Flujo de pago
1. Seleccionar alumno.
2. Definir período, servicio, combo, descuento.
3. Elegir método (efectivo, transferencia, combinado).
4. Registrar pago → actualizar estado de cuenta.
