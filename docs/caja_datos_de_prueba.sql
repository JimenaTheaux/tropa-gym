-- ============================================================================
-- CAJA — Datos de prueba para las pruebas manuales — TROPA GYM
-- ============================================================================
-- Correr BLOQUE POR BLOQUE en el SQL Editor (seleccionar y Run).
--
-- Orden:
--   1. FOTO: guardar el resultado.
--   2. CREAR: alumno y dos profes de prueba.
--   -- pruebas en la app, solo con esos datos --
--   3. REVISAR: ver qué se va a borrar y si hay algún problema.
--   4. LIMPIAR: borra todo lo de prueba y apaga el módulo. Si algo no cierra,
--      aborta sin borrar nada y dice por qué.
--   5. CONTROL: comparar con la foto.
--
-- Datos de prueba: alumno con DNI 00000000 y apellido CAJA; profesores con
-- apellido PRUEBA-CAJA. Nunca toca pagos, cargos ni turnos de datos reales.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. FOTO. Guardar el resultado para comparar con el bloque 5.
-- ----------------------------------------------------------------------------
SELECT (SELECT count(*) FROM pagos) AS pagos,
       (SELECT coalesce(sum(total), 0) FROM pagos) AS suma_total,
       (SELECT coalesce(sum(importe_efectivo), 0) FROM pagos) AS efectivo,
       (SELECT coalesce(sum(importe_transferencia), 0) FROM pagos) AS transferencia,
       (SELECT count(*) FROM pagos_alumnos) AS lineas,
       (SELECT count(*) FROM cargos) AS cargos,
       (SELECT count(*) FROM alumnos) AS alumnos,
       (SELECT count(*) FROM profesores) AS profesores,
       (SELECT count(*) FROM asistencias_profesores) AS turnos,
       (SELECT count(*) FROM asistencias_alumnos) AS asistencias,
       (SELECT count(*) FROM cierres_caja) AS cierres,
       (SELECT fecha_arranque FROM config_caja) AS fecha_arranque;


-- ----------------------------------------------------------------------------
-- 2. CREAR. Los profes quedan asociados al login de profesor para verse en sus
-- cards. Aborta si ya hay datos de prueba o si el DNI está ocupado.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_login uuid := (SELECT id FROM perfiles WHERE rol = 'profesor' ORDER BY id LIMIT 1);
BEGIN
  IF EXISTS (SELECT 1 FROM alumnos WHERE dni = '00000000')
     OR EXISTS (SELECT 1 FROM profesores WHERE apellido = 'PRUEBA-CAJA') THEN
    RAISE EXCEPTION 'Ya hay datos de prueba, o el DNI 00000000 está ocupado. No se creó nada.';
  END IF;

  INSERT INTO alumnos (nombre, apellido, dni) VALUES ('Prueba', 'CAJA', '00000000');
  INSERT INTO profesores (nombre, apellido, perfil_id) VALUES
    ('Profe A', 'PRUEBA-CAJA', v_login),
    ('Profe B', 'PRUEBA-CAJA', v_login);
END;
$$;

SELECT 'alumno' AS tipo, nombre, apellido FROM alumnos WHERE dni = '00000000'
UNION ALL
SELECT 'profesor', nombre, apellido FROM profesores WHERE apellido = 'PRUEBA-CAJA';


-- ----------------------------------------------------------------------------
-- 3. REVISAR (solo lectura). Las filas con problema = true hacen abortar el
-- bloque 4: hay que resolverlas antes. Las demás son informativas.
-- ----------------------------------------------------------------------------
WITH alumno AS (
  SELECT id FROM alumnos WHERE dni = '00000000' AND apellido = 'CAJA'
),
profes AS (
  SELECT id FROM profesores WHERE apellido = 'PRUEBA-CAJA'
),
pagos_prueba AS (
  SELECT DISTINCT pa.pago_id AS id FROM pagos_alumnos pa WHERE pa.alumno_id IN (SELECT id FROM alumno)
  UNION
  SELECT p.id FROM pagos p WHERE p.recibio_profesor_id IN (SELECT id FROM profes)
),
verifs AS (
  SELECT c.verificacion_id AS id FROM cierres_caja c
  WHERE c.profesor_id IN (SELECT id FROM profes) AND c.verificacion_id IS NOT NULL
  UNION
  SELECT vcp.verificacion_id FROM verificaciones_caja_pagos vcp WHERE vcp.pago_id IN (SELECT id FROM pagos_prueba)
)
SELECT 'Pago de un alumno real cobrado por un profe de prueba' AS revision, count(*) AS cantidad, true AS problema, count(*) > 0 AS frena
FROM pagos_alumnos pa JOIN pagos p ON p.id = pa.pago_id
WHERE p.recibio_profesor_id IN (SELECT id FROM profes) AND pa.alumno_id NOT IN (SELECT id FROM alumno)
UNION ALL
SELECT 'Comprobante que mezcla al alumno de prueba con alumnos reales', count(DISTINCT pa.pago_id), true, count(*) > 0
FROM pagos_alumnos pa
WHERE pa.alumno_id NOT IN (SELECT id FROM alumno)
  AND pa.pago_id IN (SELECT pago_id FROM pagos_alumnos WHERE alumno_id IN (SELECT id FROM alumno))
UNION ALL
SELECT 'Cierre de un profe real que incluye un pago de prueba', count(*), true, count(*) > 0
FROM cierres_caja_pagos ccp JOIN cierres_caja c ON c.id = ccp.cierre_id
WHERE ccp.pago_id IN (SELECT id FROM pagos_prueba) AND c.profesor_id NOT IN (SELECT id FROM profes)
UNION ALL
SELECT 'Verificación que incluye el cierre de un profe real', count(*), true, count(*) > 0
FROM cierres_caja c
WHERE c.verificacion_id IN (SELECT id FROM verifs) AND c.profesor_id NOT IN (SELECT id FROM profes)
UNION ALL
SELECT 'Cierres de prueba a borrar', count(*), false, false
FROM cierres_caja c WHERE c.profesor_id IN (SELECT id FROM profes)
UNION ALL
SELECT 'Verificaciones de prueba a borrar', count(*), false, false FROM verifs
UNION ALL
SELECT 'Pagos de prueba a borrar', count(*), false, false FROM pagos_prueba
UNION ALL
SELECT 'Cobro real del dueño tomado por una verificación de prueba: el pago queda, se suelta el vínculo', count(*), false, false
FROM verificaciones_caja_pagos vcp
WHERE vcp.verificacion_id IN (SELECT id FROM verifs) AND vcp.pago_id NOT IN (SELECT id FROM pagos_prueba)
UNION ALL
SELECT 'Pagos reales cargados con el módulo activo: quedan afuera si la activación real es posterior', count(*), false, false
FROM pagos p
WHERE p.created_at >= (SELECT fecha_arranque FROM config_caja)
  AND p.id NOT IN (SELECT id FROM pagos_prueba);


-- ----------------------------------------------------------------------------
-- 4. LIMPIAR. Todo o nada: si falla algo, no se borra nada. Apaga el módulo.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_alumno uuid;
  v_profes uuid[];
  v_pagos uuid[];
  v_cierres uuid[];
  v_verifs uuid[];
BEGIN
  SELECT id INTO v_alumno FROM alumnos WHERE dni = '00000000' AND apellido = 'CAJA';
  v_profes := ARRAY(SELECT id FROM profesores WHERE apellido = 'PRUEBA-CAJA');

  IF v_alumno IS NULL AND cardinality(v_profes) = 0 THEN
    RAISE EXCEPTION 'No hay datos de prueba. No se borró nada.';
  END IF;

  v_pagos := ARRAY(
    SELECT pago_id FROM pagos_alumnos WHERE alumno_id = v_alumno
    UNION
    SELECT id FROM pagos WHERE recibio_profesor_id = ANY (v_profes)
  );
  v_cierres := ARRAY(SELECT id FROM cierres_caja WHERE profesor_id = ANY (v_profes));
  v_verifs := ARRAY(
    SELECT verificacion_id FROM cierres_caja WHERE id = ANY (v_cierres) AND verificacion_id IS NOT NULL
    UNION
    SELECT verificacion_id FROM verificaciones_caja_pagos WHERE pago_id = ANY (v_pagos)
  );

  IF EXISTS (
    SELECT 1 FROM pagos_alumnos
    WHERE pago_id = ANY (v_pagos) AND alumno_id IS DISTINCT FROM v_alumno
  ) THEN
    RAISE EXCEPTION 'Hay un pago de prueba con un alumno real (cobrado por un profe de prueba o comprobante mezclado). Ver bloque 3. No se borró nada.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM cierres_caja_pagos ccp
    JOIN cierres_caja c ON c.id = ccp.cierre_id
    WHERE ccp.pago_id = ANY (v_pagos) AND NOT (c.id = ANY (v_cierres))
  ) THEN
    RAISE EXCEPTION 'El cierre de un profe real incluye un pago de prueba. Ver bloque 3. No se borró nada.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM cierres_caja
    WHERE verificacion_id = ANY (v_verifs) AND NOT (id = ANY (v_cierres))
  ) THEN
    RAISE EXCEPTION 'Una verificación de prueba incluye el cierre de un profe real. Ver bloque 3. No se borró nada.';
  END IF;

  DELETE FROM cierres_caja_eventos WHERE cierre_id = ANY (v_cierres) OR verificacion_id = ANY (v_verifs);
  DELETE FROM cierres_caja_pagos WHERE cierre_id = ANY (v_cierres);
  DELETE FROM verificaciones_caja_pagos WHERE verificacion_id = ANY (v_verifs);
  DELETE FROM cierres_caja WHERE id = ANY (v_cierres);
  DELETE FROM verificaciones_caja WHERE id = ANY (v_verifs);

  DELETE FROM pagos_alumnos WHERE pago_id = ANY (v_pagos);
  DELETE FROM pagos WHERE id = ANY (v_pagos);
  DELETE FROM pagos_eliminados_auditoria WHERE alumno_id = v_alumno;
  DELETE FROM cargos WHERE alumno_id = v_alumno;
  DELETE FROM asistencias_alumnos WHERE alumno_id = v_alumno;
  DELETE FROM alumnos WHERE id = v_alumno;

  DELETE FROM asistencias_profesores WHERE profesor_id = ANY (v_profes);
  DELETE FROM profesores WHERE id = ANY (v_profes);

  UPDATE config_caja SET fecha_arranque = NULL, updated_at = now(), updated_by = NULL WHERE id;
END;
$$;


-- ----------------------------------------------------------------------------
-- 5. CONTROL. Comparar con el bloque 1: debe dar igual, salvo pagos o turnos
-- reales cargados en el medio. Las columnas sobrantes_* deben dar 0.
-- ----------------------------------------------------------------------------
SELECT (SELECT count(*) FROM pagos) AS pagos,
       (SELECT coalesce(sum(total), 0) FROM pagos) AS suma_total,
       (SELECT coalesce(sum(importe_efectivo), 0) FROM pagos) AS efectivo,
       (SELECT coalesce(sum(importe_transferencia), 0) FROM pagos) AS transferencia,
       (SELECT count(*) FROM pagos_alumnos) AS lineas,
       (SELECT count(*) FROM cargos) AS cargos,
       (SELECT count(*) FROM alumnos) AS alumnos,
       (SELECT count(*) FROM profesores) AS profesores,
       (SELECT count(*) FROM asistencias_profesores) AS turnos,
       (SELECT count(*) FROM asistencias_alumnos) AS asistencias,
       (SELECT count(*) FROM cierres_caja) AS cierres,
       (SELECT fecha_arranque FROM config_caja) AS fecha_arranque,
       (SELECT count(*) FROM alumnos WHERE dni = '00000000') AS sobrantes_alumno,
       (SELECT count(*) FROM profesores WHERE apellido = 'PRUEBA-CAJA') AS sobrantes_profes,
       (SELECT count(*) FROM verificaciones_caja) AS sobrantes_verificaciones,
       (SELECT count(*) FROM cierres_caja_eventos) AS sobrantes_eventos;
