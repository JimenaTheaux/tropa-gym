# Instructivo para el cliente — TROPA GYM

Módulos explicativos en lenguaje llano (sin jerga técnica), pensados para el
cliente final. Se armaron todos de una vez ya que el sistema quedó testeado y
estable.

Cada archivo `.html` es autocontenido (misma paleta/estilo de la app, doc 08).
Se pueden abrir directamente en el navegador o publicar como Artifact para
compartirlos mientras tanto.

## Entregable compilado

- **`Manual_de_Usuario_Tropa_Gym.pdf`** — los 9 módulos compilados en un solo
  PDF (32 páginas): portada, índice y cada módulo con salto de página propio.
  Pie de página con el logo deciDATA y "Todos los derechos reservados" en
  cada página, igual que el footer de la app. Las tarjetas/tablas no se
  cortan entre páginas (`break-inside: avoid`), así que nunca queda contenido
  tapado por el pie de página.
- `manual_usuario_tropa_gym.html` — fuente del PDF (un solo HTML autocontenido
  con los 9 módulos concatenados). Si se edita algún módulo `NN_*.html`, hay
  que trasladar el mismo cambio a mano acá (no hay merge automático — ver
  comentario en `generar_pdf.py`) y volver a generar el PDF.
- `generar_pdf.py` — script (Playwright) que genera el PDF a partir de este
  HTML. `pip install playwright`, después `python generar_pdf.py` desde esta
  carpeta.

## Módulos

- [x] `00_instructivo_general.html` — overview del sistema, los 3 roles, el
  recorrido completo (alta → asistencia → deuda → pago → liquidación →
  Dashboard), e índice con links a todos los módulos.
- [x] `01_cargos_y_pagos.html` — qué es un cargo, cómo se genera, sus 3 estados
  (pendiente/parcial/pagado), pagos parciales, sobrepago, y cargos sin monto
  definido.
- [x] `02_alumnos_y_fichas.html` — datos del alta, el "plan actual" y por qué
  se actualiza solo con los pagos (RN-035), estado activo/inactivo híbrido
  (automático + forzado a mano por Admin/Profesor, con fecha backdateable,
  motivo e historial), estado de cuenta en la ficha.
- [x] `03_asistencia.html` — check-in de alumnos (4 pasos), qué dispara la
  primera asistencia del mes, estado activo/alerta/inactivo automático (con
  nota sobre el override manual, detallado en el módulo Alumnos), asistencia
  de profesores (entrada/salida → horas mensuales).
- [x] `04_pagos.html` — los 3 tipos (Individual/Familiar/Adelantado), de dónde
  sale el precio, la decisión manual de cuota completa/media (distinta del
  cálculo automático de Cargos), métodos de pago, actualización del plan del
  alumno. Con ejemplos de pago familiar y adelantado.
- [x] `05_dashboard_resumen_mensual.html` — vista KPI (con el gráfico apilado
  de activos/inactivos por período, y la aclaración de que se cuenta el
  estado al cierre de cada período, no la asistencia del mes), y las 5
  secciones del Centro de Resumen Mensual (liquidación, alertas, deudores +
  WhatsApp, próximos a inactivarse, horas por profesor). Aclara la relación
  entre el Centro de Resumen y la pantalla Cargos.
- [x] `06_configuracion.html` — combos como único factor de precio, precios
  con vigencia (no afecta el pasado), disciplinas/descuentos/turnos/profesores.
- [x] `07_roles_y_permisos.html` — matriz de acceso por módulo, y cómo
  funcionan los logins compartidos (y por qué no hay alta de usuarios desde
  la app).
- [x] `08_egresos.html` — registro de gastos, impacto en la ganancia neta.

## Pendiente

- [ ] Revisión final del cliente sobre el contenido de cada módulo.
