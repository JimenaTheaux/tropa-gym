# 02. Roles y Permisos — TROPA GYM

## Administrador
- Acceso total al sistema.
- Ejecuta la liquidación mensual ("Generar cargos del período").
- Gestiona Configuración (precios, descuentos, turnos, profesores).
- Accede a Egresos.
- Accede a Dashboard completo.

## Profesor
- Acceso operativo (Alumnos, Asistencia, Pagos).
- Sin acceso a: Dashboard, Configuración, Egresos.
- Registra su propia asistencia (entrada/salida).

## Usuario General (Kiosco)
- Único acceso: registrar asistencia por DNI o nombre.
- Puede consultar estado de cuenta del alumno durante el flujo de asistencia.
- No accede a ningún otro módulo.

## Matriz de acceso por módulo

| Módulo | Admin | Profesor | Kiosco |
|---|---|---|---|
| Login | ✅ | ✅ | ✅ |
| Dashboard | ✅ | ❌ | ❌ |
| Alumnos | ✅ | ✅ | ❌ |
| Pagos | ✅ | ✅ | ❌ |
| Asistencia Alumnos | ✅ | ✅ | ✅ |
| Asistencia Profesores | ✅ | ✅ (propia) | ❌ |
| Egresos | ✅ | ❌ | ❌ |
| Configuración | ✅ | ❌ | ❌ |

## Reglas de seguridad
- RN-031: Administrador con acceso total.
- RN-032: Profesor sin acceso a Dashboard, Configuración, Egresos.
- RN-033: Kiosco solo registra asistencia, ningún otro módulo.
