-- ============================================================================
-- RESET COMPLETO de alumnos y todo lo generado — TROPA GYM
-- ============================================================================
-- A diferencia de reset_datos_prueba.sql (que solo vacía lo transaccional y
-- deja los alumnos de prueba), este script borra TAMBIÉN los alumnos, sus
-- estados/historial, egresos y asistencia de profesores. Lo único que queda
-- en pie es lo que se carga desde Configuración:
--   turnos, disciplinas, combos, precios, descuentos, profesores
-- (y los logins en `perfiles`, que no se tocan).
--
-- Pensado para vaciar los datos de prueba antes de pasar a producción.
-- Revisar antes de correr — no tiene vuelta atrás.
--
-- Orden de borrado por dependencias de FK:
--   1. pagos_alumnos      (referencia a pagos, cargos y alumnos)
--   2. pagos               (queda sin referencias después del paso 1)
--   3. cargos               (ya no tiene pagos_alumnos apuntándole)
--   4. asistencias_alumnos (referencia a alumnos y turnos)
--   5. alumno_estado_historial (referencia a alumnos — igual se borraría solo
--      por ON DELETE CASCADE al borrar alumnos en el paso 6, pero se deja
--      explícito por prolijidad y para que el orden quede documentado)
--   6. alumnos
--   7. asistencias_profesores (referencia a profesores — profesores NO se toca)
--   8. egresos              (independiente)
-- ============================================================================

DELETE FROM pagos_alumnos;
DELETE FROM pagos;
DELETE FROM cargos;
DELETE FROM asistencias_alumnos;
DELETE FROM alumno_estado_historial;
DELETE FROM alumnos;
DELETE FROM asistencias_profesores;
DELETE FROM egresos;

-- ============================================================================
-- VERIFICACIÓN
-- ============================================================================
-- SELECT count(*) FROM pagos_alumnos;           -- 0
-- SELECT count(*) FROM pagos;                    -- 0
-- SELECT count(*) FROM cargos;                   -- 0
-- SELECT count(*) FROM asistencias_alumnos;      -- 0
-- SELECT count(*) FROM alumno_estado_historial;  -- 0
-- SELECT count(*) FROM alumnos;                  -- 0
-- SELECT count(*) FROM asistencias_profesores;   -- 0
-- SELECT count(*) FROM egresos;                  -- 0
--
-- Deben seguir con datos (no se tocan):
-- SELECT count(*) FROM turnos;
-- SELECT count(*) FROM disciplinas;
-- SELECT count(*) FROM combos;
-- SELECT count(*) FROM precios;
-- SELECT count(*) FROM descuentos;
-- SELECT count(*) FROM profesores;
-- SELECT count(*) FROM perfiles;                 -- logins, no se tocan
-- ============================================================================
