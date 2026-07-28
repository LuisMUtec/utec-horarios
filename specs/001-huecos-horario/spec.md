# Feature Specification: Visualización de huecos entre clases

**Feature Branch**: `001-huecos-horario`
**Created**: 2026-07-27
**Status**: Draft
**Input**: "Mostrar los huecos (tiempo muerto) entre clases en el calendario semanal, como bloques punteados con la duración del hueco, más un contador total de horas muertas de la semana."

## Execution Flow (main)

```
1. El usuario selecciona cursos y secciones (flujo existente)
2. El calendario semanal renderiza los bloques de clase (flujo existente)
3. Para cada día, el sistema calcula los intervalos libres entre la primera y la última clase
4. Los intervalos que alcanzan el umbral mínimo se renderizan como bloques de hueco
5. El sistema calcula y muestra el total semanal de horas muertas en la cabecera del calendario
6. El usuario puede activar/desactivar la visualización con un toggle persistente
```

---

## User Scenarios & Testing

### Primary User Story

Como estudiante de UTEC armando mi horario, quiero ver de un vistazo cuánto tiempo muerto tengo entre clases cada día y en la semana, para poder comparar combinaciones de secciones y elegir la que menos tiempo me haga esperar en el campus.

### Acceptance Scenarios

**Cálculo y visualización de huecos**

1. **Given** un día con clases de 07:00–09:00 y de 17:00–19:00 y el toggle activo, **When** se renderiza el calendario, **Then** aparece un bloque de hueco entre 09:00 y 17:00 etiquetado `hueco 8 h`.

2. **Given** un día con clases de 07:00–09:00 y de 11:00–13:00 (hueco de 2 h) y el toggle activo, **When** se renderiza el calendario, **Then** aparece un bloque etiquetado `hueco 2 h` (el umbral es inclusivo).

3. **Given** un día con clases de 14:00–16:00 y de 17:00–19:00 (hueco de 1 h) y el toggle activo, **When** se renderiza el calendario, **Then** NO aparece ningún bloque de hueco para ese intervalo.

4. **Given** un hueco de 2 h 30 min, **When** se renderiza su etiqueta, **Then** muestra `hueco 2 h 30 min`.

5. **Given** un día con una sola clase, **When** se renderiza el calendario, **Then** no aparece ningún bloque de hueco en ese día (el tiempo antes de la primera clase y después de la última no cuenta como hueco).

6. **Given** un día sin clases, **When** se renderiza el calendario, **Then** la columna queda vacía, sin bloques de hueco.

7. **Given** dos clases solapadas (cruce permitido) de 09:00–11:00 y 10:00–13:00, seguidas de una clase a las 16:00, **When** se calculan los huecos, **Then** se detecta un único hueco de 13:00 a 16:00 (los bloques solapados se tratan como un solo tramo ocupado).

8. **Given** el usuario está previsualizando una sección (hover) cuyo horario cae dentro de un hueco existente, **When** se renderiza la preview, **Then** los huecos no se recalculan y el bloque de preview se dibuja por encima del bloque de hueco.

9. **Given** el cursor está sobre un bloque de hueco que se superpone con un bloque de clase o de preview, **When** el usuario interactúa, **Then** el bloque de hueco no captura el evento y la interacción llega al bloque de clase.

**Resumen semanal**

10. **Given** un horario con huecos de 3 h el miércoles y 5 h el viernes, **When** se renderiza el calendario, **Then** la cabecera del calendario muestra un contador de `8 h` de tiempo muerto.

11. **Given** cursos seleccionados sin ningún hueco que alcance el umbral, **When** se renderiza el calendario, **Then** el contador muestra `0 h`.

12. **Given** ningún curso seleccionado, **When** se renderiza el calendario, **Then** el contador no se muestra.

13. **Given** un horario con huecos, **When** el usuario cambia la sección o subsesión de un curso, **Then** el contador se actualiza inmediatamente al nuevo total.

**Toggle y persistencia**

14. **Given** un usuario que nunca cambió la preferencia, **When** abre la aplicación, **Then** la visualización de huecos está activada.

15. **Given** un horario con huecos, **When** el usuario desactiva el toggle "Mostrar huecos", **Then** los bloques de hueco y el contador desaparecen inmediatamente, sin afectar los bloques de clase.

16. **Given** el usuario desactivó el toggle, **When** recarga la página, **Then** el toggle sigue desactivado y no hay un parpadeo inicial de bloques de hueco.

**Exportación**

17. **Given** el toggle activo y un horario con huecos, **When** el usuario exporta el horario como imagen PNG, **Then** los bloques de hueco aparecen en la imagen tal como se ven en pantalla.

18. **Given** el toggle activo, **When** el usuario exporta el horario como imagen PNG, **Then** el contador semanal NO aparece en la imagen.

### Edge Cases

- **Clases contiguas** (una termina 09:00, otra empieza 09:00): no hay hueco, no se renderiza nada.
- **Clases con solapamiento parcial o total**: los tramos ocupados se fusionan antes de calcular los huecos; nunca se reporta un hueco "dentro" de un tramo ocupado.
- **Huecos de duración no entera**: la etiqueta usa horas y minutos (`2 h 30 min`); el contador semanal suma los minutos reales y usa el mismo formato.
- **Sábado / días sin clase**: se tratan como cualquier otro día.
- **Modo claro y oscuro**: los bloques de hueco son legibles y visualmente subordinados a los bloques de clase en ambos temas.

---

## Requirements

### Functional Requirements

#### Cálculo

- **FR-001**: El sistema DEBE calcular, por cada día de la semana, los intervalos de tiempo libre comprendidos entre el final de una clase y el inicio de la siguiente.
- **FR-002**: El sistema DEBE fusionar los tramos de clase que se solapan o son contiguos antes de calcular los huecos, de modo que un solapamiento no genere huecos espurios.
- **FR-003**: El sistema DEBE ignorar el tiempo anterior a la primera clase del día y el posterior a la última clase del día; solo cuentan los intervalos *entre* clases.
- **FR-004**: El sistema DEBE mostrar únicamente los huecos cuya duración sea **mayor o igual a 120 minutos**.
- **FR-005**: El cálculo DEBE basarse únicamente en los cursos seleccionados, excluyendo los eventos de previsualización.

#### Visualización de huecos

- **FR-006**: Cada hueco visible DEBE renderizarse como un bloque dentro de la columna de su día, ocupando exactamente la franja horaria del hueco.
- **FR-007**: El bloque de hueco DEBE distinguirse visualmente de un bloque de clase (borde punteado, sin relleno de color, tipografía tenue) y no debe competir en jerarquía visual con las clases.
- **FR-008**: El bloque DEBE mostrar la etiqueta `hueco {duración}`, con la duración en formato `N h` cuando es entera y `N h M min` cuando incluye minutos.
- **FR-009**: Los bloques de hueco DEBEN renderizarse por debajo de los bloques de clase y de previsualización cuando se superpongan.
- **FR-010**: Los bloques de hueco NO DEBEN capturar eventos de puntero: no son interactivos ni seleccionables, y cualquier interacción sobre ellos debe alcanzar al elemento que tengan debajo o encima.
- **FR-011**: Los bloques de hueco DEBEN ser legibles tanto en modo claro como en modo oscuro.
- **FR-012**: Los bloques de hueco DEBEN incluirse en la exportación del horario a PNG.

#### Resumen semanal

- **FR-013**: El sistema DEBE mostrar el total de horas muertas de la semana, sumando la duración de todos los huecos visibles (los que alcanzan el umbral), con el mismo formato de duración que las etiquetas (FR-008).
- **FR-014**: El contador DEBE ubicarse en la cabecera del calendario semanal, junto al título de la sección.
- **FR-015**: El contador DEBE mostrar `0 h` cuando hay cursos seleccionados pero ningún hueco alcanza el umbral.
- **FR-016**: El contador NO DEBE mostrarse cuando no hay cursos seleccionados, ni cuando la visualización de huecos está desactivada.
- **FR-017**: El contador NO DEBE incluirse en la exportación del horario a PNG.
- **FR-018**: El contador DEBE actualizarse inmediatamente ante cualquier cambio en la selección de cursos, secciones o subsesiones.

#### Control de usuario

- **FR-019**: El sistema DEBE ofrecer un toggle "Mostrar huecos" con el mismo patrón visual e interacción que el toggle existente "Permitir cruces de horario".
- **FR-020**: El toggle DEBE ubicarse en la misma tarjeta que "Permitir cruces de horario", como una segunda opción del mismo grupo.
- **FR-021**: La preferencia del toggle DEBE persistir en el navegador entre sesiones, con el mismo mecanismo que las demás preferencias.
- **FR-022**: El estado por defecto para un usuario nuevo DEBE ser **activado**.
- **FR-023**: Al desactivar el toggle, los bloques de hueco y el contador semanal DEBEN desaparecer sin afectar ningún otro elemento del calendario.
- **FR-024**: El estado inicial del toggle DEBE resolverse sin provocar discrepancias de hidratación entre servidor y cliente ni parpadeo de los bloques al cargar la página.

### Key Entities

- **Hueco (Gap)**: intervalo libre entre dos clases de un mismo día. Atributos: día, hora de inicio, hora de fin, duración en minutos. Derivado — no se persiste.
- **Resumen semanal**: total de minutos muertos de la semana, derivado de la suma de los huecos visibles.
- **Preferencia "mostrar huecos"**: booleano persistido en el navegador; por defecto `true`.

---

## Non-Goals (fuera de alcance)

- Sugerir o reordenar secciones automáticamente para minimizar huecos.
- Umbral configurable por el usuario (fijado en 2 h para esta versión).
- Distinguir huecos "útiles" (almuerzo, estudio) de tiempo muerto.
- Mostrar el hueco entre el fin de clases de un día y el inicio del siguiente.
- Cambiar el diseño general del calendario, la densidad de la grilla o el contenido de los bloques de clase.

---

## Review & Acceptance Checklist

### Content Quality

- [x] Sin detalles de implementación (lenguajes, frameworks, APIs)
- [x] Enfocado en valor para el usuario y necesidades de negocio
- [x] Escrito para stakeholders no técnicos
- [x] Todas las secciones obligatorias completas

### Requirement Completeness

- [x] Sin marcadores `[NEEDS CLARIFICATION]` pendientes
- [x] Requisitos verificables y sin ambigüedad
- [x] Criterios de éxito medibles
- [x] Alcance claramente delimitado
- [x] Dependencias y supuestos identificados

---

## Execution Status

- [x] Descripción del usuario procesada
- [x] Conceptos clave extraídos
- [x] Ambigüedades resueltas
- [x] Escenarios de usuario definidos
- [x] Requisitos generados
- [x] Entidades identificadas
- [x] Revisión del checklist superada
