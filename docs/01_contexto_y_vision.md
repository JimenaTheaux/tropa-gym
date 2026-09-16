# 01. Contexto y Visión — TROPA GYM

## Objetivo
Centralizar la gestión operativa del gimnasio: alumnos, asistencias, pagos y estado de cuenta.

## Filosofía
El sistema automatiza cálculos, pero el control operativo queda en manos del administrador. Ninguna deuda ni cargo se genera de forma automática sin acción explícita.

## Alcance del MVP
Incluye:
- Login y roles (Admin, Profesor, Kiosco)
- Alta/gestión de alumnos
- Registro de asistencia (alumnos y profesores)
- Pagos (individual, familiar, adelantado)
- Generación manual de cargos por período
- Estado de cuenta por alumno
- Dashboard + Centro de Resumen Mensual
- Egresos
- Configuración (precios, descuentos, turnos, profesores)

No incluye (fuera de MVP, a definir a futuro):
- Notificaciones automáticas (WhatsApp/email)
- Reservas de clase online
- App mobile nativa (se resuelve como PWA)

## Regla rectora
**Actualizado en migración 22** — las deudas y cargos pasaron a generarse automáticamente: cada asistencia crea o actualiza sola el cargo del período (trigger de base, ver doc 03 "Flujo de liquidación mensual — cargo continuo"). Ya no existe la acción administrativa explícita "Generar cargos del período". Lo que sigue siendo explícito y manual es la **validación**: Admin/Profesor confirma (o corrige) el monto de un cargo antes de que quede protegido de futuros recálculos automáticos (`cargos.validado`, doc 03/06).

*(Regla original del MVP, ya superada: "Las deudas y cargos NO se generan automáticamente. Existe una acción administrativa explícita: 'Generar cargos del período'." — se deja registrada acá por contexto histórico de la decisión inicial.)*
