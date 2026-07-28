# Feature Specification: Reseñas de docentes por curso

**Feature Branch**: `002-resenas-docentes`
**Created**: 2026-07-28
**Status**: Draft
**Input**: "Mostrar puntuaciones y comentarios de alumnos para cada docente dentro de un curso, de modo que un estudiante pueda comparar las secciones antes de matricularse."

## Execution Flow (main)

```text
1. El estudiante busca un curso y despliega sus secciones (flujo existente)
2. Junto a cada docente, ve su promedio de estrellas para ese curso, el porcentaje que lo recomienda, la cantidad de puntuaciones y la cantidad de comentarios
3. El estudiante abre el detalle de reseñas sin abandonar el flujo de armado del horario
4. Si quiere leer comentarios, inicia sesión con su cuenta institucional UTEC
5. Para puntuar, el estudiante declara que llevó el curso con ese docente, elige de 1 a 5 estrellas e indica si recomendaría llevar ese curso con ese docente
6. Para añadir un comentario, completa su carrera y ciclo actual, escribe el texto y confirma el compromiso de respeto
7. La puntuación actualiza el promedio y el porcentaje de recomendación del docente en ese curso y, si el estudiante añadió texto, el comentario aparece en el detalle
8. El estudiante puede editar o eliminar posteriormente su propia reseña
```

---

## User Scenarios & Testing

### Primary User Story

Como estudiante de UTEC que está armando su horario, quiero conocer la experiencia de otros alumnos con cada docente en el curso que deseo llevar, para comparar las secciones y tomar una decisión mejor informada antes de matricularme.

### Acceptance Scenarios

**Resumen por docente dentro de un curso**

1. **Given** un curso con una sección dictada por un docente que tiene puntuaciones, **When** el estudiante despliega las secciones, **Then** junto al docente ve un promedio de 1 a 5 estrellas con un decimal, el porcentaje que lo recomienda, la cantidad total de puntuaciones y la cantidad total de comentarios.

2. **Given** un mismo docente que aparece en dos secciones del mismo curso, **When** se muestran ambas secciones, **Then** las dos presentan el mismo resumen de reseñas correspondiente a la combinación docente–curso.

3. **Given** una sección con más de un docente, **When** se muestra la sección, **Then** cada docente aparece por separado con su propio resumen para ese curso.

4. **Given** un docente sin puntuaciones para ese curso, **When** se muestra la sección, **Then** aparece el estado `Sin puntuaciones` en lugar de un promedio numérico.

5. **Given** una sesión que la oferta publica sin docente registrado, **When** se muestra la sección, **Then** aparece el estado `Docente por asignar`, sin resumen ni acceso al detalle, y se distingue del estado `Sin puntuaciones`.

6. **Given** una persona sin sesión iniciada, **When** consulta las secciones de un curso, **Then** puede ver los promedios y conteos de todos los docentes.

7. **Given** un resumen visible junto a un docente, **When** el estudiante lo selecciona, **Then** se abre el detalle de sus reseñas para ese curso sin perder la selección actual de cursos y secciones.

**Acceso institucional y perfil**

8. **Given** una persona sin sesión iniciada, **When** intenta leer los comentarios, **Then** se le solicita iniciar sesión con una cuenta institucional UTEC.

9. **Given** una persona que intenta acceder con una cuenta que no pertenece al dominio institucional autorizado, **When** completa el inicio de sesión, **Then** el acceso es rechazado y se explica que la funcionalidad está reservada para estudiantes UTEC.

10. **Given** un estudiante autenticado con su cuenta institucional, **When** abre el detalle de un docente, **Then** puede leer los comentarios sin haber publicado previamente una reseña ni completado su perfil.

11. **Given** un estudiante autenticado que aún no completó su perfil, **When** intenta añadir su primer comentario escrito, **Then** debe seleccionar obligatoriamente su carrera y su ciclo actual antes de continuar.

12. **Given** un estudiante con perfil completo, **When** publica o consulta una reseña, **Then** su correo, nombre, carrera y ciclo no aparecen públicamente.

**Creación y límites de reseñas**

13. **Given** un estudiante autenticado que llevó el curso con el docente, **When** declara esa experiencia, selecciona entre 1 y 5 estrellas, responde si lo recomendaría y publica sin escribir un comentario, **Then** su puntuación y su recomendación se incorporan al resumen sin exigirle carrera, ciclo ni compromiso de respeto, y aumenta la cantidad de puntuaciones en uno sin aumentar la cantidad de comentarios.

14. **Given** un estudiante que no marca la casilla `Declaro que llevé este curso con este docente`, **When** intenta publicar una puntuación o un comentario, **Then** no puede publicar y el formulario le explica que el espacio recoge experiencias de alumnos que ya llevaron el curso con ese docente, y que no admite preguntas, solicitudes de información ni expresiones de interés.

15. **Given** un estudiante que intenta añadir un comentario, **When** no eligió una puntuación, no completó carrera y ciclo o no activó el compromiso de respeto, **Then** no puede publicar el comentario y se le indican los requisitos pendientes.

16. **Given** un estudiante que ya publicó una reseña para una combinación docente–curso, **When** intenta publicar otra para la misma combinación, **Then** se le conduce a editar su reseña existente y no se crea una segunda.

17. **Given** un estudiante con menos de ocho puntuaciones nuevas durante las últimas 24 horas, **When** puntúa otra combinación docente–curso, **Then** puede publicarla si cumple los demás requisitos.

18. **Given** un estudiante que ya publicó ocho puntuaciones nuevas durante las últimas 24 horas, **When** intenta crear una novena, **Then** la publicación se bloquea y se le informa cuándo podrá volver a contribuir.

19. **Given** un estudiante que ya declaró su experiencia y eligió una puntuación, **When** completa carrera y ciclo, escribe un comentario, acepta el compromiso de respeto y publica correctamente, **Then** ve una confirmación y la reseña actualizada dentro del detalle del docente.

**Edición y eliminación**

20. **Given** un estudiante que ya publicó una puntuación sin comentario, **When** cambia la cantidad de estrellas o su recomendación y guarda la edición, **Then** el promedio y el porcentaje se recalculan sin exigir carrera, ciclo ni compromiso de respeto y sin aumentar la cantidad de puntuaciones.

21. **Given** un estudiante que añade un comentario a una puntuación existente, **When** completa carrera y ciclo, acepta el compromiso de respeto y guarda la edición, **Then** la cantidad de comentarios aumenta en uno y la cantidad de puntuaciones no cambia.

22. **Given** un estudiante que elimina el comentario pero conserva la puntuación, **When** guarda la edición, **Then** la cantidad de comentarios disminuye en uno y la puntuación continúa formando parte del promedio, sin exigir una nueva confirmación de respeto.

23. **Given** un estudiante que elimina su reseña, **When** confirma la eliminación, **Then** su puntuación deja de formar parte del promedio, su recomendación deja de contar en el porcentaje y su comentario, si existía, desaparece.

24. **Given** un estudiante que edita una reseña existente, **When** guarda el cambio, **Then** la edición no se considera una puntuación nueva para el límite de ocho puntuaciones en 24 horas.

**Lectura de comentarios**

25. **Given** un docente con comentarios para un curso, **When** un estudiante autenticado abre el detalle, **Then** ve primero los comentarios publicados más recientemente.

26. **Given** una reseña que contiene puntuación y comentario, **When** aparece en el detalle, **Then** muestra las estrellas, el texto y la fecha en que se publicó ese comentario —con la marca `editado` si cambió después de publicarse—, sin identificar al autor ni mostrar su carrera, ciclo o período académico.

27. **Given** un docente con puntuaciones pero sin comentarios, **When** un estudiante autenticado abre el detalle, **Then** ve el promedio y el mensaje `Aún no hay comentarios`.

28. **Given** una reseña que contiene únicamente una puntuación, **When** se calcula el resumen, **Then** participa en el promedio y en la cantidad de puntuaciones, pero no aparece como comentario vacío.

**Reportes y moderación**

29. **Given** un estudiante autenticado que considera que una reseña con comentario infringe las normas, **When** la reporta, **Then** debe seleccionar un motivo y recibe confirmación de que el reporte será revisado.

30. **Given** un estudiante que reportó una reseña, **When** vuelve a consultar el detalle, **Then** esa reseña queda oculta para él mientras se revisa, sin ocultarse automáticamente para los demás estudiantes.

31. **Given** una reseña que solo contiene puntuación, **When** un estudiante consulta el detalle del docente, **Then** no aparece en la lista de comentarios y no ofrece la acción `Reportar`.

32. **Given** un estudiante que ya reportó una reseña, **When** intenta reportarla otra vez, **Then** no se crea un reporte duplicado.

33. **Given** una reseña reportada que no incumple las normas, **When** termina la revisión, **Then** se mantiene publicada y continúa participando en los conteos y el promedio.

34. **Given** una reseña reportada que incumple las normas, **When** termina la revisión, **Then** se elimina, deja de participar en el promedio y sus conteos se actualizan.

35. **Given** un usuario que incurre en una infracción que amerita baneo permanente, **When** se aplica la sanción, **Then** se eliminan todas sus reseñas, pierde de forma permanente el acceso autenticado a comentarios, publicación, edición y reportes, y al intentar usar cualquiera de esas acciones se le informa que su acceso fue retirado y por qué motivo; los resúmenes públicos permanecen visibles para él.

36. **Given** una reseña eliminada por moderación, **When** su autor vuelve al detalle del docente, **Then** la reseña no puede restaurarse ni editarse, se haya aplicado o no una sanción a ese autor.

**Recomendación del docente**

37. **Given** un estudiante que intenta publicar una puntuación sin responder si recomendaría al docente, **When** confirma la publicación, **Then** no puede publicar y se le indica que la respuesta es obligatoria.

### Edge Cases

- **Docente repetido dentro de una sección**: si el mismo docente figura en más de una sesión de la sección, aparece una sola vez con un único resumen.
- **Varios docentes en una sección**: cada docente se presenta y se evalúa por separado; no existe una puntuación de la sección completa.
- **Mismo docente en cursos distintos**: sus puntuaciones no se mezclan; cada curso tiene su propio promedio y comentarios.
- **Sesión sin docente en la oferta**: se muestra `Docente por asignar`. Es un estado distinto de `Sin puntuaciones`: allí hay un docente que todavía nadie evaluó, acá no hay a quién evaluar.
- **Par docente–curso fuera de la oferta vigente**: solo se puede reseñar lo que aparece en la oferta actual. Si un par deja de dictarse, sus reseñas se conservan pero dejan de mostrarse hasta que el par vuelva a la oferta; es una consecuencia asumida de anclar las reseñas al flujo de armado del horario.
- **Promedio con una sola puntuación**: se muestra junto a `1 puntuación` para no aparentar mayor representatividad.
- **Eliminación de la última reseña**: el resumen vuelve al estado `Sin puntuaciones`.
- **Comentario vacío o compuesto solo por espacios**: se trata como una reseña sin comentario.
- **Comentario extenso**: el texto admite como máximo 500 caracteres y muestra el límite restante antes de publicar.
- **Sin comentarios después de autenticar**: se conserva el promedio y se muestra el estado vacío, sin crear comentarios ficticios ni obligar al estudiante a contribuir.
- **Perfil incompleto**: no impide leer comentarios ni publicar una puntuación sin texto; solo impide añadir o editar un comentario hasta completar carrera y ciclo.
- **Intento de hacer una pregunta**: el formulario explica que el espacio recoge experiencias pasadas y no publica preguntas, solicitudes de información ni expresiones de interés.
- **Límite de publicación**: eliminar una reseña no libera inmediatamente un cupo de puntuación dentro de las 24 horas posteriores a su creación.
- **Pérdida de sesión durante la publicación**: la reseña no se publica y el texto escrito se mantiene disponible para reintentar después de iniciar sesión.
- **Modo claro y oscuro**: estrellas, conteos, comentarios, formularios, estados vacíos y reportes son legibles en ambos temas.

### Success Criteria

**Comparar antes de matricularse**

- **SC-001**: Un visitante sin sesión puede comparar a todos los docentes de un curso —promedio, porcentaje de recomendación, cantidad de puntuaciones y de comentarios— dentro del flujo de armado del horario, sin iniciar sesión y sin perder los cursos y secciones que ya había seleccionado.
- **SC-002**: Ante un docente sin reseñas o sin asignar, el estudiante distingue por qué no hay promedio: `Sin puntuaciones` y `Docente por asignar` no se confunden entre sí ni con un fallo de carga.

**Contribuir**

- **SC-003**: Contribuir con puntuación y recomendación, sin escribir un comentario, no le exige al estudiante carrera, ciclo ni compromiso de respeto.
- **SC-004**: Un estudiante puede reseñar a todos los docentes de una carga académica completa en una sola sesión, sin toparse con el límite de 24 horas.

**Confiar en lo que se ve**

- **SC-005**: Publicar, editar o eliminar una reseña se refleja en el promedio y los conteos del docente en la siguiente consulta, sin ninguna ventana en que el resumen muestre datos viejos.
- **SC-006**: Ninguna reseña permite identificar a su autor ni conocer su correo, nombre, carrera o ciclo, ni antes ni después de iniciar sesión.
- **SC-007**: Solo las cuentas del dominio institucional autorizado pueden leer comentarios, publicar, editar, eliminar o reportar; cualquier otra persona conserva el acceso a los resúmenes públicos.
- **SC-008**: Un comentario reportado desaparece para quien lo reportó en su siguiente consulta y sigue visible para los demás hasta que exista una decisión de moderación.

**Salud de la feature**

- **SC-009**: En cualquier momento se puede conocer cuántas combinaciones docente–curso tienen al menos una puntuación y cuántos estudiantes únicos han contribuido, para saber si la feature sigue en arranque en frío.

---

## Requirements

### Functional Requirements

#### Resumen y comparación dentro del horario

- **FR-001**: El sistema DEBE asociar las reseñas a una combinación específica de docente y curso, no al docente de manera global ni a una sección.
- **FR-002**: El sistema DEBE mostrar junto a cada docente de una sección su promedio para ese curso, el porcentaje de recomendación (FR-058), la cantidad de puntuaciones y la cantidad de comentarios.
- **FR-003**: El promedio DEBE calcularse con todas las puntuaciones activas de la combinación docente–curso y mostrarse con un decimal en una escala de 1 a 5 estrellas.
- **FR-004**: La puntuación DEBE representar la excelencia general de la experiencia académica con el docente en ese curso; la interfaz NO DEBE presentarla como una medida de facilidad.
- **FR-005**: El conteo de puntuaciones DEBE incluir toda reseña activa con estrellas, tenga o no comentario.
- **FR-006**: El conteo de comentarios DEBE incluir únicamente las reseñas activas que contengan texto no vacío.
- **FR-007**: El sistema DEBE mostrar `Sin puntuaciones` cuando una combinación docente–curso no tenga reseñas activas.
- **FR-008**: Los promedios y conteos DEBEN ser visibles sin iniciar sesión.
- **FR-009**: Si un docente figura varias veces en una misma sección, el sistema DEBE mostrarlo una sola vez.
- **FR-010**: Si una sección tiene varios docentes, el sistema DEBE mostrar un resumen independiente para cada uno.
- **FR-011**: Si un docente aparece en varias secciones del mismo curso, el sistema DEBE reutilizar el mismo resumen docente–curso en todas ellas.
- **FR-012**: El acceso al detalle de reseñas NO DEBE hacer que el estudiante pierda los cursos y secciones que ya seleccionó.
- **FR-053**: La identidad de un docente DEBE ser su correo institucional, no su nombre: dos docentes homónimos no comparten reseñas y un mismo docente escrito de dos formas no se divide en dos.
- **FR-054**: Cuando una sesión no tenga docente registrado en la oferta, el sistema DEBE mostrar `Docente por asignar` y NO DEBE ofrecer resumen, detalle ni publicación para ella. Este estado DEBE distinguirse de `Sin puntuaciones` (FR-007).
- **FR-058**: El sistema DEBE mostrar, junto al promedio y los conteos de cada docente en un curso, el porcentaje de estudiantes que recomendaría llevar ese curso con ese docente.
- **FR-059**: El porcentaje DEBE calcularse como la proporción de respuestas `Sí` sobre el total de reseñas activas de la combinación docente–curso y mostrarse como número entero, sin decimales. Como la recomendación es obligatoria (FR-061), ese total coincide siempre con la cantidad de puntuaciones (FR-005). El porcentaje DEBE mostrarse desde la primera reseña, acompañado siempre de la cantidad de puntuaciones (FR-002), sin umbral mínimo.
- **FR-060**: El porcentaje DEBE ser visible sin iniciar sesión, en las mismas condiciones que el promedio y los conteos (FR-008).

#### Acceso y perfil

- **FR-013**: El sistema DEBE exigir inicio de sesión con una cuenta institucional UTEC para leer comentarios, publicar, editar, eliminar o reportar reseñas.
- **FR-014**: El sistema DEBE rechazar cuentas que no pertenezcan al dominio institucional autorizado.
- **FR-015**: Un estudiante autenticado DEBE poder leer todos los comentarios disponibles sin haber publicado antes una reseña.
- **FR-016**: Leer comentarios NO DEBE requerir que el estudiante complete su carrera ni su ciclo actual.
- **FR-017**: Antes de publicar o editar un comentario escrito, el estudiante DEBE tener registrados una carrera de la lista oficial vigente de UTEC ([carreras-utec.md](carreras-utec.md)) y un ciclo actual entre 1 y 10.
- **FR-018**: Carrera y ciclo DEBEN poder actualizarse desde el perfil del estudiante.
- **FR-019**: El sistema NO DEBE mostrar públicamente el nombre, correo, carrera ni ciclo del autor de una reseña.
- **FR-020**: La interfaz pública NO DEBE mostrar la etiqueta `Alumno UTEC verificado`, dado que el acceso institucional ya es un requisito común para todos los autores.

#### Publicación de puntuaciones y comentarios

- **FR-021**: Antes de publicar una puntuación nueva para una combinación docente–curso, el estudiante DEBE confirmar explícitamente `Declaro que llevé este curso con este docente`, elegir exactamente una puntuación entera de 1 a 5 estrellas y responder la recomendación (FR-061).
- **FR-022**: El comentario DEBE ser opcional y admitir como máximo 500 caracteres.
- **FR-023**: El formulario DEBE presentar el comentario opcional con el texto `Cuenta algo que le serviría saber a otro estudiante. Este espacio no es para preguntas`.
- **FR-024**: El sistema NO DEBE permitir publicar un comentario sin una puntuación.
- **FR-025**: Antes de publicar o guardar un comentario con texto, el estudiante DEBE activar un control inicialmente desmarcado con el texto `Confirmo que esta reseña refleja mi experiencia y cumple las normas de respeto`; eliminar por completo el comentario NO DEBE exigir una nueva confirmación.
- **FR-026**: El control de compromiso DEBE ofrecer acceso directo a las normas de la comunidad y a la política de privacidad.
- **FR-027**: Cada estudiante DEBE tener como máximo una reseña activa por combinación docente–curso.
- **FR-028**: El curso y el docente DEBEN quedar preseleccionados al iniciar una reseña desde su resumen y NO DEBEN poder cambiarse dentro del formulario.
- **FR-029**: El sistema DEBE permitir que un estudiante publique reseñas de combinaciones docente–curso distintas.
- **FR-030**: Cada estudiante DEBE poder crear como máximo ocho puntuaciones nuevas dentro de cualquier período de 24 horas. El tope cubre una carga académica completa para que un alumno pueda reseñar a todos sus docentes del ciclo de una sola vez.
- **FR-031**: El sistema DEBE explicar el límite cuando bloquee una novena puntuación e indicar cuándo vuelve a estar disponible la publicación.
- **FR-032**: El sistema NO DEBE solicitar ni guardar el período académico en que el estudiante llevó el curso.
- **FR-033**: La fecha de publicación de la reseña DEBE registrarse y NO DEBE presentarse como la fecha en que el estudiante llevó el curso. Es la fecha que gobierna el límite de FR-030; la que se muestra junto a un comentario es la de FR-064.
- **FR-061**: Toda reseña DEBE incluir una respuesta obligatoria a `¿Recomendarías llevar este curso con este docente?`, con las opciones `Sí` y `No` y sin valor preseleccionado. El sistema NO DEBE permitir publicar una reseña sin esta respuesta.
- **FR-062**: La recomendación DEBE representar si el estudiante aconsejaría esa experiencia académica a otro alumno; la interfaz NO DEBE presentarla como una medida de facilidad, de carga ni de dificultad del curso.

#### Lectura, edición y eliminación

- **FR-034**: Los comentarios DEBEN mostrarse del más reciente al más antiguo.
- **FR-035**: Cada comentario DEBE mostrar la puntuación asociada, la recomendación asociada, el texto y su fecha de publicación (FR-064), sin identidad pública del autor.
- **FR-036**: Las reseñas sin comentario NO DEBEN generar elementos vacíos en la lista de comentarios.
- **FR-037**: El autor DEBE poder editar la puntuación y añadir, modificar o eliminar el comentario de su reseña activa; una reseña eliminada por moderación NO DEBE poder editarse ni restaurarse por su autor, se haya aplicado o no una sanción.
- **FR-038**: Una edición DEBE actualizar el promedio y los conteos sin aumentar la cantidad de puntuaciones ni consumir un cupo adicional del límite de publicación; añadir o editar texto mantiene los requisitos de perfil y compromiso de respeto.
- **FR-039**: El autor DEBE poder eliminar su reseña después de una confirmación explícita.
- **FR-040**: Una reseña eliminada DEBE dejar inmediatamente de participar en el promedio y en los conteos.
- **FR-055**: Un comentario modificado después de publicarse DEBE mostrar la marca `editado` junto a su fecha. La fecha visible sigue siendo la de su publicación (FR-064) y NO DEBE reemplazarse por la de la última edición.
- **FR-064**: El sistema DEBE registrar por separado la fecha en que un comentario se publicó por primera vez, y esa es la que DEBE mostrarse junto a él. Cuando la puntuación y el comentario se publican juntos coincide con la fecha de la reseña (FR-033); cuando el comentario se añade después, NO DEBE mostrarse la fecha de la puntuación.
- **FR-063**: La recomendación forma parte de la reseña y NO constituye una contribución independiente. Toda regla de unicidad, límite de publicación, edición, eliminación, moderación y sanción aplicable a la puntuación (FR-027, FR-030, FR-037, FR-038, FR-040, FR-048, FR-056) DEBE aplicarse igualmente a la recomendación, y el porcentaje DEBE recalcularse en los mismos momentos que el promedio.

#### Normas, reportes y sanciones

- **FR-041**: Las normas DEBEN prohibir insultos o ataques personales, acusaciones sobre la vida privada, publicación de datos personales, contenido falso o engañoso, spam, preguntas, solicitudes de información, expresiones de interés y cualquier contenido que no describa una experiencia académica con el docente en ese curso.
- **FR-042**: La unidad reportable DEBE ser la reseña. Cada reseña visible en el detalle DEBE ofrecer una acción `Reportar`; como las reseñas sin comentario no se listan (FR-036), NO DEBEN ofrecer esa acción.
- **FR-043**: Para enviar un reporte, el estudiante DEBE elegir uno de estos motivos: `Insulto o ataque personal`, `Contenido falso o engañoso`, `Datos personales`, `No describe una experiencia con el docente`, `Spam o no relacionado` u `Otro`.
- **FR-044**: Cuando el motivo sea `Otro`, el estudiante DEBE añadir una explicación.
- **FR-045**: Cada estudiante DEBE poder reportar una reseña una sola vez.
- **FR-046**: Una reseña reportada DEBE ocultarse para quien la reportó mientras se revisa y DEBE permanecer visible para los demás hasta que exista una decisión de moderación.
- **FR-047**: La revisión de un reporte DEBE terminar en una de estas decisiones: mantener la reseña, eliminarla o eliminarla y banear permanentemente al autor.
- **FR-048**: Una reseña eliminada por moderación DEBE dejar inmediatamente de participar en el promedio y en los conteos, y su eliminación DEBE ser definitiva: ningún autor, sancionado o no, puede restaurarla ni editarla.
- **FR-049**: Un usuario baneado permanentemente NO DEBE poder acceder a comentarios ni publicar, editar, eliminar o reportar reseñas con la cuenta sancionada.
- **FR-050**: Un usuario baneado DEBE conservar únicamente el acceso a los promedios y conteos públicos disponibles para cualquier visitante.
- **FR-051**: El MVP NO DEBE incluir una interfaz de administración; la revisión de reportes y la aplicación de sanciones se realizarán mediante las herramientas operativas existentes.
- **FR-052**: Las reseñas sin comentario quedan fuera del flujo de reportes de estudiantes; si una puntuación resulta abusiva, DEBE poder eliminarse y sancionarse a su autor con las mismas decisiones de FR-047 aplicadas desde las herramientas operativas.
- **FR-056**: Al banear permanentemente a un usuario, el sistema DEBE eliminar todas sus reseñas, no solo la que motivó el reporte. Todas dejan inmediatamente de participar en los promedios y conteos.
- **FR-057**: Un usuario baneado DEBE recibir un mensaje explícito que indique que su acceso fue retirado de forma permanente y por qué motivo, cada vez que intente leer comentarios, publicar, editar, eliminar o reportar. El sistema NO DEBE limitarse a ocultarle esas funciones sin explicación.

### Key Entities

- **Estudiante UTEC**: persona autenticada con una cuenta institucional autorizada. Atributos: identidad privada, carrera, ciclo actual, estado de acceso y fecha de creación del perfil. Carrera, ciclo e identidad no se muestran públicamente.
- **Docente**: persona que figura como responsable de una o más sesiones en la oferta de un curso, identificada por su correo institucional. Puede aparecer en varias secciones y cursos. Una sesión sin correo de docente no tiene docente evaluable.
- **Combinación docente–curso**: unidad sobre la que se agregan y consultan puntuaciones y comentarios. No depende del número de sección.
- **Reseña**: contribución única de un estudiante sobre una combinación docente–curso. Atributos: declaración de experiencia, puntuación de 1 a 5, recomendación sí/no, comentario opcional, fecha de publicación, fecha de última edición, autor privado y estado. Se persiste.
- **Resumen de reseñas**: promedio de estrellas, porcentaje de recomendación, cantidad de puntuaciones y cantidad de comentarios activos de una combinación docente–curso. Derivado de las reseñas vigentes.
- **Reporte**: aviso de un estudiante sobre una reseña posiblemente contraria a las normas. Atributos: reseña, reportante privado, motivo, explicación opcional, fecha y estado de revisión. Se persiste.
- **Sanción**: pérdida permanente del acceso autenticado de un estudiante por incumplimiento de las normas, acompañada de la eliminación de todas sus reseñas. Atributos: estudiante, motivo y fecha de aplicación. El motivo se le comunica al sancionado. Se persiste.

### Dependencies and Assumptions

- La oferta de cursos vigente identifica qué docentes participan en cada sección mediante su correo institucional. No todas las sesiones traen docente: las que no lo traen se muestran como `Docente por asignar` (FR-054).
- Solo se puede reseñar un par docente–curso presente en la oferta vigente (FR-028). Un alumno no puede reseñar a un docente que este período no dicta ese curso, y las reseñas de un par que sale de la oferta dejan de mostrarse aunque se conserven.
- Todos los autores de reseñas disponen de una cuenta institucional UTEC válida.
- Una experiencia previa puede reseñarse aunque corresponda a un período académico anterior; el MVP no pregunta ni muestra cuándo se llevó el curso.
- Habrá una persona responsable de revisar manualmente los reportes y aplicar las decisiones de moderación.
- Carrera y ciclo son datos declarados por el estudiante; aportan contexto operativo, pero no demuestran que haya llevado un curso.
- El MVP no afirma que la experiencia académica declarada haya sido verificada contra una matrícula o un historial de notas.
- La recomendación (FR-061) se incorpora asumiendo que aporta señal propia frente al promedio de estrellas. En el referente público esa correlación es de ~0.83, alta pero no total. Si con datos propios resulta redundante, retirarla es una decisión válida y esperada.

---

## Non-Goals (fuera de alcance)

- Crear un ranking global de docentes, cursos o carreras.
- Recomendar automáticamente una sección o un docente.
- Incluir criterios separados de la enseñanza como claridad, dificultad, carga, evaluaciones o facilidad. La recomendación (FR-061) no es uno de estos: no describe una dimensión del curso, sino si el estudiante aconsejaría la experiencia. La evidencia pública del referente muestra que un puntaje de dificultad separado correlaciona negativamente con el de calidad, es decir, castiga a los docentes exigentes.
- Verificar mediante matrícula, historial académico, notas o documentos que el estudiante llevó el curso.
- Solicitar o mostrar el período académico en que el estudiante llevó el curso.
- Mostrar públicamente perfiles, nombres, correos, carreras o ciclos de los autores.
- Exigir que un estudiante publique una reseña para poder leer comentarios.
- Permitir comentarios, respuestas o discusiones entre estudiantes.
- Habilitar preguntas o solicitudes de información dentro de las reseñas.
- Permitir votos de utilidad, reacciones o destacados sobre comentarios.
- Crear páginas generales de docentes separadas del flujo de selección de secciones.
- Crear una consola de administración o moderación dentro de la aplicación.
- Diseñar campañas, recompensas o incentivos externos para conseguir las primeras reseñas.
- Relacionar cursos con planes de estudio o carreras.

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
