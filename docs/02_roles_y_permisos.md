# 02. Roles y Permisos — TROPA GYM

## Administrador
- Acceso total al sistema.
- Ejecuta la liquidación mensual ("Generar cargos del período") — desde el Centro de Resumen Mensual (Dashboard) o desde la pantalla Cargos, dedicada a gestionar la liquidación completa (ver doc 04).
- Gestiona Configuración (precios, descuentos, turnos, profesores).
- Accede a Egresos.
- Accede a Dashboard completo.

## Profesor
- Acceso operativo (Alumnos, Asistencia, Pagos).
- Sin acceso a: Dashboard, Configuración, Egresos.
- Registra su propia asistencia (entrada/salida).
- Puede editar `cargos.monto` como excepción (ej. corrección manual de una deuda) — mismo permiso que Admin, ya que ambos roles reciben pagos. La edición dispara el recálculo automático del `estado` del cargo (ver doc 03).
- Puede forzar a mano el estado Activo/Inactivo de un alumno (`marcar_estado_manual`, migración 11/12) — mismo permiso que Admin. El RPC rechaza a cualquier rol que no sea admin/profesor (`get_user_role() NOT IN ('admin','profesor')`). Kiosco solo puede ver el estado (SELECT sobre `alumno_estado_historial`), no cambiarlo.

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
| Cargos | ✅ | ❌ | ❌ |
| Egresos | ✅ | ❌ | ❌ |
| Configuración | ✅ | ❌ | ❌ |

## Reglas de seguridad
- RN-031: Administrador con acceso total.
- RN-032: Profesor sin acceso a Dashboard, Configuración, Egresos.
- RN-033: Kiosco solo registra asistencia, ningún otro módulo.
- RN-034: Edición de `cargos.monto` restringida a roles Admin y Profesor (excepción, requiere confirmación en UI).

## Gestión de usuarios (logins)
- Los 3 roles usan **logins compartidos** (uno para Admin, uno para Profesor, uno para Kiosco), creados directamente en Supabase (Authentication → Add user + insert manual en `perfiles`). La app **no tiene una pantalla para dar de alta logins nuevos** — se decidió así a propósito: crear un usuario de Supabase Auth desde la app requeriría exponer la service role key (permisos totales del proyecto) en algún punto de la infraestructura, y se prefirió evitar ese riesgo.
- El alta de un **profesor nuevo** (como persona/staff, no como login) se hace desde Configuración → Profesores: se carga nombre/apellido y se lo asocia al perfil "profesor" compartido (dropdown "Usuario asociado"). Varios profesores pueden compartir ese mismo login sin problema — `AsistenciaProfesores.tsx` filtra por `profesores.perfil_id`, así que si dos profesores están asociados al mismo perfil, ambos aparecen listados para marcar su propia entrada/salida bajo esa sesión compartida.
- Si más adelante hace falta un login por persona (ej. auditoría fina de quién hizo qué), va a requerir una Edge Function server-side con la service role key — evaluar en ese momento.
