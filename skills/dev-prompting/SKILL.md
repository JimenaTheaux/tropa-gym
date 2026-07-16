---
name: dev-prompting
description: Guía de prompting iterativo para desarrollo de software con Claude en VSCode o chat. Usar siempre que se vaya a escribir un prompt para implementar una funcionalidad, corregir un bug, o pedir una revisión de código. Cubre estructura de prompts por fases, cómo reportar bugs, cómo pedir diagnósticos antes de cambios, y cómo evitar que Claude toque lo que no debe.
---

# Dev Prompting — Prompts iterativos para desarrollo

## Principio base
Un prompt bien estructurado vale más que diez prompts vagos.
Claude debe leer antes de modificar, reportar antes de actuar, y tocar solo lo que se le pide.

---

## Estructura de prompt por fase

Cada prompt de implementación tiene esta forma:

```
Leé estos archivos: [lista exacta]

[CONTEXTO breve si es necesario — 2-3 líneas máximo]

[INSTRUCCIÓN clara — qué hacer, no cómo hacerlo]

[RESTRICCIONES — qué NO tocar]

[CHECKLIST de cierre — qué confirmar antes de terminar]
```

**Reglas:**
- Nombrar los archivos exactos a leer — no decir "el form de pedidos", decir `@src/components/pedidos/DrawerPedido.tsx`
- Una instrucción por prompt — si hay dos tareas, dos prompts
- Siempre incluir "Mostrámelo antes de modificarlo" si el archivo es complejo
- Nunca pedir varias funcionalidades en el mismo prompt

---

## Patrón leer-reportar-modificar

Para bugs o cambios en código existente:

```
PASO 1 — diagnóstico (prompt separado):
Leé [archivo]. Reportá exactamente cómo está implementado [X].
No toques nada.

PASO 2 — implementación (prompt separado, con el reporte en contexto):
Basado en el reporte anterior, corregí [X] así: [instrucción].
```

**Por qué:** Claude que modifica sin leer puede romper lógica que no conoce.
El reporte previo obliga a entender antes de actuar.

---

## Prompt de bug report

Estructura mínima para reportar un bug a Claude:

```
Síntoma: [qué pasa, exactamente, con ejemplo concreto]
Comportamiento esperado: [qué debería pasar]
Archivos relevantes: [lista]

Diagnosticá la causa raíz y reportá antes de tocar nada.
```

**Ejemplo real:**
```
Síntoma: cuando escribo "1" en el input totalManual, se guarda
automáticamente y no puedo seguir escribiendo el número completo.
Comportamiento esperado: poder escribir "15000" completo antes de guardar.
Archivos: @src/components/pedidos/DrawerPedido.tsx

Diagnosticá la causa raíz y reportá antes de tocar nada.
```

---

## Restricciones estándar

Incluir en prompts de modificación según el caso:

```
No toques lógica de negocio.
No toques estilos fuera del componente indicado.
No toques queries ni servicios.
No toques otros componentes aunque parezcan relacionados.
No reescribas lo que ya funciona — solo corregí lo indicado.
```

---

## Checklist de cierre

Todo prompt de implementación termina con:

```
Checklist:
- [ ] [item 1]
- [ ] [item 2]
- [ ] npm run build sin errores
```

Claude no cierra el prompt hasta completar el checklist.

---

## Prompts de revisión

Para pedir revisión sin cambios:

```
Leé [archivo]. Mostrámelo y reportá:
- [pregunta 1]
- [pregunta 2]
No toques nada.
```

Para pedir revisión global:

```
Revisión de [módulo]:
- Buscá [patrón] en src/ con: grep -r "[término]" src/ --include="*.tsx" -n
- Reportá cada ocurrencia con archivo y línea
- No toques nada hasta que confirme
```

---

## Anti-patterns — nunca hacer esto

- ❌ "Implementá el módulo de pagos y también arreglá el bug del input y actualizá el dashboard"
- ❌ "Hacé lo que consideres mejor"
- ❌ "Refactorizá todo el archivo"
- ❌ Prompt sin lista de archivos a leer
- ❌ Prompt sin restricción de qué no tocar

---

## Template base reutilizable

```
Proyecto: [nombre] — [descripción en una línea].
Stack: [stack].

Leé estos archivos:
@[archivo1]
@[archivo2]

[INSTRUCCIÓN en 2-3 líneas]

No toques: [lista de lo que no se toca]

Checklist:
- [ ] [verificación 1]
- [ ] [verificación 2]
- [ ] npm run build sin errores
```
