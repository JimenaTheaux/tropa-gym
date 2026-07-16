---
name: database-first
description: Metodología de desarrollo donde el schema de base de datos se diseña y aplica antes de escribir cualquier código frontend. Usar siempre al iniciar un proyecto nuevo, al agregar una funcionalidad con tablas nuevas, o al migrar datos existentes. Cubre diseño de schema SQL, tipos TypeScript derivados del schema, snapshots para datos históricos, campos deprecated vs eliminados, orden de ejecución de migrations, y verificación post-migración.
---

# Database First — Schema antes que código

## Principio base
El schema SQL es la fuente de verdad. Los tipos TypeScript se derivan del schema,
nunca al revés. Ningún componente se escribe hasta que las tablas existen y están verificadas.

---

## Orden de desarrollo

```
1. Diseñar schema en papel / doc
2. Escribir SQL (tipos → tablas → índices → RLS → RPCs)
3. Ejecutar en Supabase SQL Editor
4. Verificar con SELECT COUNT(*)
5. Derivar tipos TypeScript del schema
6. Escribir servicios (queries)
7. Escribir componentes
```

Nunca saltear pasos. Nunca escribir un componente que asuma columnas que no existen.

---

## Estructura SQL por orden de ejecución

```sql
-- 1. Tipos enum primero
CREATE TYPE estado_pedido AS ENUM ('borrador', 'confirmado', ...);

-- 2. Tablas sin FK
CREATE TABLE clientes (...);
CREATE TABLE categorias_producto (...);

-- 3. Tablas con FK (en orden de dependencia)
CREATE TABLE productos (..., categoria_id UUID REFERENCES categorias_producto(id));
CREATE TABLE pedidos (..., cliente_id UUID REFERENCES clientes(id));
CREATE TABLE pedido_items (..., pedido_id UUID REFERENCES pedidos(id) ON DELETE CASCADE);

-- 4. Índices
CREATE INDEX idx_pedidos_estado ON pedidos(estado);

-- 5. RLS
ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "..." ON pedidos FOR ALL USING (...);

-- 6. RPCs (funciones atómicas)
CREATE OR REPLACE FUNCTION cambiar_estado_pedido(...) ...;

-- 7. Triggers
CREATE TRIGGER trg_updated_at BEFORE UPDATE ON pedidos ...;
```

---

## Snapshots para datos históricos

Cuando un valor puede cambiar en el futuro pero el histórico debe conservarse:

```sql
-- MAL: referencia al precio actual (cambia con el tiempo)
precio_unitario UUID REFERENCES productos(precio_minorista)

-- BIEN: snapshot del valor al momento de crear
precio_unitario  NUMERIC(10,2) NOT NULL,  -- valor congelado al crear
precio_referencia NUMERIC(10,2) NOT NULL, -- precio actual (para alertas)
costo_snapshot   NUMERIC(10,2) NOT NULL DEFAULT 0  -- costo congelado
```

**Regla:** si el valor puede cambiar en ABM y el histórico importa → snapshot al crear.
Aplica a: precios, costos, direcciones, nombres de cliente en pedidos.

---

## Tipos TypeScript derivados del schema

Derivar el tipo exactamente de la columna SQL. No inventar tipos extra.

```typescript
// Schema SQL:
-- estado TEXT NOT NULL CHECK (estado IN ('cobrado', 'pendiente'))
-- monto NUMERIC(10,2) NOT NULL
-- fecha_cobro DATE

// Tipo TS derivado:
export type EstadoPago = 'cobrado' | 'pendiente'

export type Pago = {
  id: string
  pedido_id: string
  forma_pago: 'efectivo' | 'transferencia'
  monto: number           // NUMERIC → number
  fecha_pago: string      // DATE → string (ISO)
  created_at: string      // TIMESTAMPTZ → string
}
```

**Reglas:**
- `UUID` → `string`
- `NUMERIC` / `INTEGER` → `number`
- `DATE` / `TIMESTAMPTZ` → `string`
- `BOOLEAN` → `boolean`
- Columnas nullable → `tipo | null`
- Enums SQL → union types TS

---

## Campos deprecated vs eliminados

Nunca borrar una columna que tenga datos o sea referenciada por código existente.
Deprecar primero, eliminar después de migrar.

```sql
-- Deprecar: agregar comentario, dejar de usar en queries nuevas
-- pedidos.monto_cobrado  → deprecated, usar SUM(pedido_pagos.monto)
-- pedidos.forma_cobro    → deprecated, usar pedido_pagos.forma_pago

-- Eliminar: solo cuando TODO el código migró y se verificó en producción
ALTER TABLE pedidos DROP COLUMN monto_cobrado;
```

En el código: marcar con comentario `// @deprecated — usar pedido_pagos`.

---

## RLS — patrones seguros

```sql
-- BIEN: sin recursión
CREATE POLICY "perfil_propio" ON perfiles
  FOR SELECT USING (auth.uid() = id);

-- MAL: recursión infinita (consulta perfiles dentro de política de perfiles)
CREATE POLICY "admin_select" ON perfiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'admin')
    -- ↑ esto causa bucle infinito
  );

-- BIEN para otras tablas: subquery a perfiles desde tabla diferente
CREATE POLICY "admin_pedidos" ON pedidos
  FOR ALL USING (
    EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol IN ('admin', 'superadmin'))
  );
```

**Regla de oro para `perfiles`:** solo usar `auth.uid() = id`. Nunca subquery a la misma tabla.
Para acceso admin a todos los perfiles (gestión de usuarios): usar cliente `service_role` que bypasea RLS.

---

## Orden de seed / migración

```sql
-- 1. Borrar en orden inverso de dependencia
DELETE FROM pedido_historial;
DELETE FROM pedido_items;
DELETE FROM pedidos;
DELETE FROM productos;
DELETE FROM categorias_producto;
DELETE FROM clientes;
DELETE FROM perfiles;

-- 2. Resetear serials
ALTER SEQUENCE pedidos_numero_seq RESTART WITH 1;

-- 3. Insertar en orden de dependencia
INSERT INTO categorias_producto ...;  -- sin FK
INSERT INTO productos ...;            -- FK a categorias
INSERT INTO clientes ...;             -- sin FK
-- perfiles: insertar después de crear usuarios en Auth
```

---

## Verificación post-migración

```sql
-- Siempre verificar después de ejecutar seed:
SELECT COUNT(*) FROM categorias_producto;  -- ¿N esperado?
SELECT COUNT(*) FROM productos;             -- ¿N esperado?
SELECT COUNT(*) FROM clientes;              -- ¿N esperado?

-- Verificar integridad referencial:
SELECT p.nombre, c.nombre as categoria
FROM productos p
LEFT JOIN categorias_producto c ON c.id = p.categoria_id
WHERE c.id IS NULL;  -- debe devolver 0 filas

-- Verificar RLS:
-- Testear con usuario logueado que no sea admin
-- Intentar SELECT * FROM pedidos → debe devolver solo sus pedidos
```

---

## RPCs para operaciones atómicas

Usar RPC (función PL/pgSQL) cuando una acción modifica múltiples tablas:

```sql
-- Cuándo usar RPC:
-- ✓ Cambiar estado de pedido + insertar en historial
-- ✓ Cerrar pedido + insertar pagos + actualizar estado_pago
-- ✓ Cualquier operación que deba ser todo-o-nada

-- Cuándo NO usar RPC:
-- ✗ SELECT simple de una tabla
-- ✗ UPDATE de un solo campo
-- ✗ INSERT en una sola tabla
```

Siempre `SECURITY DEFINER` + validación de existencia con `IF NOT FOUND THEN RAISE EXCEPTION`.
