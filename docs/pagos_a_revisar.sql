-- ============================================================================
-- PAGOS A REVISAR — TROPA GYM
-- ============================================================================
-- SOLO LECTURA: todos los bloques son SELECT. No modifica datos.
-- Correr BLOQUE POR BLOQUE en el SQL Editor de Supabase (seleccionar y Run).
-- Referencia a hoy: 15 huérfanos y 19 pagos con total distinto de la suma de líneas.
-- ============================================================================


-- 1. Conteo. Esperado a hoy: 15, 19 y otros_con_diferencia = 4.
SELECT
  count(*) FILTER (WHERE l.pago_id IS NULL) AS huerfanos,
  count(*) FILTER (WHERE p.total <> coalesce(l.suma, 0)) AS total_distinto_de_lineas,
  count(*) FILTER (WHERE l.pago_id IS NOT NULL AND p.total <> l.suma) AS otros_con_diferencia
FROM pagos p
LEFT JOIN (SELECT pago_id, sum(monto_pagado) AS suma FROM pagos_alumnos GROUP BY pago_id) l ON l.pago_id = p.id;


-- 2. Huérfanos: pagos sin ninguna línea en pagos_alumnos.
SELECT p.id, p.tipo_pago, p.metodo_pago, p.total, p.importe_efectivo, p.importe_transferencia,
       fn_fecha_pago_local(p.fecha) AS fecha,
       to_char(p.created_at AT TIME ZONE 'America/Argentina/Buenos_Aires', 'YYYY-MM-DD HH24:MI') AS created_at
FROM pagos p
WHERE NOT EXISTS (SELECT 1 FROM pagos_alumnos pa WHERE pa.pago_id = p.id)
ORDER BY p.created_at DESC;


-- 3. Pista para identificar al alumno de cada huérfano: errores registrados hasta
-- 10 minutos después de cargarlo. El log existe desde el commit e04f055: los
-- huérfanos anteriores no van a tener filas.
SELECT p.id AS pago_id, p.total,
       to_char(p.created_at AT TIME ZONE 'America/Argentina/Buenos_Aires', 'YYYY-MM-DD HH24:MI:SS') AS pago_creado,
       to_char(l.ocurrido_en AT TIME ZONE 'America/Argentina/Buenos_Aires', 'YYYY-MM-DD HH24:MI:SS') AS error_ocurrido,
       l.contexto, l.error_mensaje, l.payload_intentado
FROM pagos p
JOIN log_errores l ON l.ocurrido_en BETWEEN p.created_at AND p.created_at + interval '10 minutes'
WHERE NOT EXISTS (SELECT 1 FROM pagos_alumnos pa WHERE pa.pago_id = p.id)
ORDER BY p.created_at DESC, l.ocurrido_en;


-- 4. Los demás pagos con total distinto de la suma de líneas: cabecera.
SELECT p.id, p.tipo_pago, p.metodo_pago, p.total, l.suma AS suma_lineas, p.total - l.suma AS diferencia,
       p.importe_efectivo, p.importe_transferencia, l.lineas,
       fn_fecha_pago_local(p.fecha) AS fecha,
       to_char(p.created_at AT TIME ZONE 'America/Argentina/Buenos_Aires', 'YYYY-MM-DD HH24:MI') AS created_at
FROM pagos p
JOIN (SELECT pago_id, sum(monto_pagado) AS suma, count(*) AS lineas FROM pagos_alumnos GROUP BY pago_id) l ON l.pago_id = p.id
WHERE p.total <> l.suma
ORDER BY p.created_at DESC;


-- 5. Los mismos pagos: detalle de cada línea y estado del cargo.
SELECT p.id AS pago_id, p.total, pa.id AS pago_alumno_id,
       al.apellido, al.nombre, pa.periodo, pa.precio_snapshot, pa.monto_pagado,
       pa.cargo_id, c.monto AS cargo_monto, c.estado AS cargo_estado
FROM pagos p
JOIN pagos_alumnos pa ON pa.pago_id = p.id
JOIN alumnos al ON al.id = pa.alumno_id
LEFT JOIN cargos c ON c.id = pa.cargo_id
WHERE p.id IN (
  SELECT pa2.pago_id
  FROM pagos_alumnos pa2
  JOIN pagos p2 ON p2.id = pa2.pago_id
  GROUP BY pa2.pago_id, p2.total
  HAVING p2.total <> sum(pa2.monto_pagado)
)
ORDER BY p.created_at DESC, al.apellido, al.nombre;
