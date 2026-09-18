# Ajustes manuales históricos (uso único, ya eliminados del código)

Registro de paneles/funciones temporales que se agregaron a Configuración para
resolver un problema puntual, se ejecutaron una vez y luego se borraron del
código. Se documentan acá por si en el futuro hace falta algo similar.

## Activación manual por pago de agosto 2026

- **Fecha de uso:** septiembre 2026.
- **Motivo:** agosto 2026 no tuvo registro de asistencias (falla externa), por
  lo que el estado automático de los alumnos (activo/inactivo por asistencia)
  no reflejaba la actividad real de ese mes.
- **Qué hacía:** buscaba todos los pagos con `fecha` entre `2026-08-01` y
  `2026-09-01` (exclusivo), sacaba los `alumno_id` asociados vía
  `pagos_alumnos`, y para cada uno forzaba una transición
  `inactivo → activo` (dos llamadas a `marcarEstadoManual`, la primera para
  evitar el guard no-op de `fn_registrar_cambio_estado` cuando el alumno ya
  estaba en `activo/manual`) dejando el estado "activo" vigente desde el
  momento de la corrida.
- **Dónde vivía:** `tropa-gym/src/pages/configuracion/AjusteManualAgostoPanel.tsx`,
  montado desde `ConfiguracionPage.tsx` (visible solo para admin, debajo de
  los tabs). Eliminado en su totalidad — archivo borrado y referencias
  quitadas de `ConfiguracionPage.tsx`.
- **Si hace falta repetir algo parecido:** recrear un panel temporal siguiendo
  el mismo patrón (rango de fechas sobre `pagos.fecha` → `pagos_alumnos` →
  `alumno_id` → `marcarEstadoManual` con doble llamada inactivo/activo para
  forzar la transición), y volver a borrarlo una vez usado.
