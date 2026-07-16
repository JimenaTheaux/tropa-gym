# 06. Estructura de Datos — TROPA GYM

## Entidades y relaciones

```
perfiles (usuarios/roles)
  └── profesores (1:1 opcional, si rol = profesor)

alumnos
  ├── asistencias_alumnos (1:N)
  ├── cargos (1:N)
  └── pagos (1:N, vía pagos_alumnos si es familiar)

profesores
  └── asistencias_profesores (1:N)

turnos ← asistencias_alumnos
precios ← cargos, pagos
descuentos ← cargos, pagos
egresos (independiente)
```

## Enums necesarios
- `estado_alumno`: activo | inactivo
- `estado_pago`: pendiente | parcial | pagado
- `tipo_pago`: individual | familiar | adelantado
- `metodo_pago`: efectivo | transferencia | combinado
- `rol_usuario`: admin | profesor | kiosco

## Tablas principales (borrador)

### alumnos
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| nombre | text | obligatorio |
| apellido | text | obligatorio |
| dni | text unique | obligatorio |
| telefono | text | opcional |
| fecha_nacimiento | date | opcional |
| estado | estado_alumno | calculado, default 'activo' |
| fecha_alta | timestamptz | default now() |

### asistencias_alumnos
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| alumno_id | FK alumnos | |
| turno_id | FK turnos | |
| fecha | date | |
| hora | time | |

### profesores
| id, nombre, apellido, perfil_id (FK perfiles) |

### asistencias_profesores
| id, profesor_id FK, fecha, hora_entrada, hora_salida |

### cargos
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| alumno_id | FK alumnos | |
| periodo | text (YYYY-MM) | |
| tipo | 'completa' \| 'media' | RN-017/018 |
| monto | numeric | snapshot del precio vigente |
| **Constraint**: único por (alumno_id, periodo) — RN-020 |

### pagos
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| tipo_pago | tipo_pago | |
| metodo_pago | metodo_pago | |
| importe_efectivo | numeric | si combinado |
| importe_transferencia | numeric | si combinado |
| total | numeric | |
| estado | estado_pago | calculado |
| fecha | timestamptz | |

### pagos_alumnos (detalle, soporta familiar/adelantado)
| pago_id FK, alumno_id FK, periodo, servicio, combo, descuento_id FK, precio_snapshot |

### precios
| id, servicio, combo, periodo_vigencia_desde, monto |
*(los pagos/cargos guardan snapshot, no referencian precio vivo — RN-030)*

### descuentos
| id, nombre, descripcion, porcentaje |

### turnos
| id, nombre, hora_inicio, hora_fin |

### egresos
| id, concepto, monto, fecha, categoria |

### perfiles
| id (FK auth.users), nombre, rol (rol_usuario) |

## Campos que requieren snapshot (no referenciar valor vivo)
- `cargos.monto`
- `pagos_alumnos.precio_snapshot`

## RPCs necesarios (atomicidad)
- `generar_cargos_periodo(periodo)`: calcula y crea cargos según RN-015 a RN-020, requiere preview antes de confirmar.
- `registrar_pago_familiar(...)`: crea 1 pago + N filas en pagos_alumnos.
- `registrar_pago_adelantado(...)`: crea N cargos/pagos en una transacción (uno por período).
- `calcular_estado_alumno()`: job o vista que recalcula activo/inactivo según última asistencia.
