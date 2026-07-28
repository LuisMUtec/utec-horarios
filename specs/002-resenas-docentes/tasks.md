# Tasks: Reseñas de docentes por curso

**Input**: `specs/002-resenas-docentes/` — [spec.md](spec.md) (63 FR, 37 escenarios, SC-001..SC-009), [plan.md](plan.md), [carreras-utec.md](carreras-utec.md), [normas-comunidad.md](normas-comunidad.md), [politica-privacidad.md](politica-privacidad.md)

**Prerequisites**: plan.md ✅ · spec.md ✅ · `research.md`, `data-model.md`, `contracts/`, `quickstart.md` **no existen a propósito** — el plan los absorbió (ver *Estructura de la documentación* en plan.md).

**Tests**: SÍ se generan. No es una preferencia: el repo tiene un trinquete de coverage con `autoUpdate` que hace fallar el CI si el porcentaje baja ([R1](plan.md#r1-el-trinquete-de-coverage-bloquea-el-ci)), y [R2](plan.md#r2-la-frontera-es-rls-no-los-handlers) establece que la frontera de seguridad es RLS, no los route handlers, así que las políticas necesitan pgTAP.

**Organization**: por historia de usuario, con las historias derivadas de los grupos de *Acceptance Scenarios* del spec. Cada fase es un PR.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: paralelizable (archivos distintos, sin dependencias pendientes)
- **[Story]**: US1..US6. Setup, Foundational y Polish no llevan etiqueta

## Path Conventions

Proyecto único Next.js App Router: `src/` y `tests/` en la raíz, migraciones en `supabase/migrations/`, tests de base en `supabase/tests/`.

---

## Reparto en PRs

Cierra el punto abierto *Reparto en PRs* del Progress Tracking del plan.

| PR | Fase | Contenido | Tareas |
|---|---|---|---|
| 1 | Setup + Foundational | Toda la base de datos: esquema, RLS, triggers, vistas, moderación, purga, catálogos, oferta generada, pgTAP y CI | T001–T027 |
| 2 | US1 (P1) 🎯 MVP | Resumen público junto a cada docente en el horario | T028–T040 |
| 3 | US2 (P2) | Sesión institucional, perfil, normas y privacidad | T041–T055 |
| 4 | US3 (P3) | Lectura de comentarios | T056–T064 |
| 5 | US4 (P4) | Publicar puntuación, recomendación y comentario | T065–T077 |
| 6 | US5 (P5) | Editar y eliminar la reseña propia | T078–T085 |
| 7 | US6 (P6) | Reportar y sanción visible | T086–T095 |
| 8 | Polish | SC-009, purga documentada, cierre de la política | T096–T102 |

---

## Decisiones tomadas al generar estas tareas

Tres cosas que el plan dejaba a medias y que estas tareas cierran. **Revísalas antes de ejecutar**: cambian archivos.

1. **R6 — reseñas de un par que sale de la oferta: se apagan.** `is_current = false` y las dos vistas dejan de devolverlas. Es lo que el plan ya había escrito; T024 lo asume por escrito en spec.md y normas-comunidad.md para que deje de ser un pendiente.

2. **El normalizador NO toca `scripts/parse-pdf.js` ni `courses.json`.** El plan listaba `teacher-email.ts` como compartido con el parser. Hacerlo obliga a regenerar `src/data/courses.json`, y eso rompe el golden test de `tests/parse-pdf.test.ts` y borra el diff revisable de las 360 sesiones con correo corrupto —que es justo lo que [D5](plan.md#d5-coursesjson-es-la-fuente-postgres-solo-proyecta-course_teachers) protege. La normalización ocurre **al leer**: la usan la app y el generador de oferta. `courses.json` sigue siendo el volcado crudo del PDF. Unificar el parser queda en Polish (T101), como cambio propio con su regeneración.

3. **`supabase test db` no necesita un job nuevo.** [R3](plan.md#r3-el-ci-hoy-no-levanta-supabase) daba por hecho que el CI no levanta Supabase, pero `.github/workflows/ci.yml` ya tiene un job `supabase` con `supabase start` y `supabase/setup-cli@v3` fijado en 2.109.1. pgTAP es **un step más** en ese job (T022), no varios minutos nuevos de pipeline.

**Desfase detectado**: el plan cita el piso de coverage en `lines 27.02 / statements 26.69 / functions 24.68 / branches 16.3`. `vitest.config.ts` ya está en `32.57 / 32.63 / 28.33 / 25.06`. El riesgo R1 es mayor de lo que el plan estima; T040 lo mide con el primer componente.

---

## Phase 1: Setup

**Purpose**: la única infraestructura compartida que no es base de datos — el normalizador de correo, que es prerequisito de la migración de oferta.

- [x] T001 En `package.json`, subir `engines.node` a `>=22.18.0` y añadir los scripts `generate-offer` (`node scripts/generate-offer-migration.mts`), `diff-oferta` (`node scripts/generate-offer-migration.mts --diff`) y `test:db` (`supabase test db`). La versión de Node sube porque el generador es TypeScript ejecutado con el type stripping nativo, sin flag, disponible desde 22.18; el CI ya usa Node 24 y la máquina local también.

- [x] T002 [P] Crear `src/lib/teacher-email.ts` con `normalizeTeacherEmail(raw: string | null | undefined): string | null`. Colapsa espacios internos (`rcondorena@utec.edu. pe` → `rcondorena@utec.edu.pe`), quita los dígitos de capacidad pegados al dominio (`pperezq@utec.edu.pe 44`, `amorantep@utec.edu.p e`), pasa a minúsculas y devuelve `null` cuando lo que queda no es un correo `@utec.edu.pe` válido — ese `null` es el estado `Docente por asignar` de FR-054. Exportar también `teacherPairKey(courseCode, email)` para la llave `(curso, correo)` que usan la UI y las consultas. Sin dependencias externas.

- [x] T003 [P] Crear `tests/teacher-email.test.ts` cubriendo los tres patrones de corrupción reales del PDF, el correo ya limpio, el campo que solo trae un número de capacidad, la cadena vacía y un correo de otro dominio. Añadir un test agregado sobre `src/data/courses.json` que fije las cifras de la investigación del plan: 1821 sesiones, 378 sin docente evaluable, 336 docentes distintos y 619 pares docente–curso tras normalizar. Ese test es el que convierte la investigación en invariante.

**Checkpoint**: `pnpm test` verde y el normalizador disponible para el generador de oferta.

---

## Phase 2: Foundational — La base de datos completa (PR 1)

**Purpose**: el esquema inicial de la aplicación. Hoy `public` está vacío; esta fase crea todo lo que las seis historias consultan.

**⚠️ CRITICAL**: ninguna historia puede empezar hasta que esta fase esté completa. Es también la fase donde vive la frontera de seguridad: los route handlers de las fases siguientes no protegen nada que RLS no proteja primero ([R2](plan.md#r2-la-frontera-es-rls-no-los-handlers)).

**Convención**: identificadores SQL en inglés, comentarios en español, nombres de archivo en español — igual que `20260728065437_restringir_signup_a_utec.sql`. Los timestamps de las migraciones nuevas deben ser posteriores a ese.

### Esquema y catálogos

- [x] T004 Crear `supabase/migrations/20260729090000_crear_esquema_de_resenas.sql` con las cinco tablas, los tres enums y los tres índices del bloque *Modelo de datos* de plan.md: `careers`, `profiles` (con el check `ban_has_reason`), `course_teachers`, `review_state`, `reviews` (con el check `comment_needs_acknowledgement`), `report_reason`, `report_status`, `review_reports`. Índices: `reviews_one_active_per_pair` (único parcial sobre `state = 'active'`, es FR-027), `reviews_by_pair` y `reviews_by_author_recent`. Copiar los comentarios `--` del plan tal cual: explican por qué las FK a `auth.users` son `on delete restrict` y no `cascade`.

- [x] T005 [P] Crear `supabase/migrations/20260729090100_catalogo_de_carreras.sql` con el insert de las 16 carreras de [carreras-utec.md](carreras-utec.md) usando `slug` como llave de conflicto (`on conflict (slug) do update set name = excluded.name, faculty = excluded.faculty`), para que la migración sea reejecutable y un renombre de carrera no cree una fila nueva. `faculty` toma los cuatro valores de la tabla: Computación, Ingeniería, Negocios, Ciencias Básicas.

- [x] T006 Crear `scripts/generate-offer-migration.mts` que lee `src/data/courses.json`, normaliza los correos con `src/lib/teacher-email.ts` (import con extensión `.ts` explícita, lo exige el type stripping), agrupa por `(course_code, teacher_email)` quedándose con el `teacher_name` más frecuente por par, y emite `supabase/migrations/<timestamp>_oferta_<año>_<ciclo>.sql` con un `insert ... on conflict (course_code, teacher_email) do update set teacher_name = excluded.teacher_name, is_current = true` seguido de un `update ... set is_current = false` para los pares que ya no aparecen. Con `--diff` no escribe nada: imprime los pares que entran y los que salen, que es el insumo de [R6](plan.md#r6-la-oferta-cambia-dentro-del-ciclo-y-eso-apaga-reseñas) y lo que distingue un cambio real de docente de un correo mal parseado.

- [x] T007 Ejecutar `pnpm generate-offer` y commitear la migración resultante `supabase/migrations/20260729090701_oferta_2026_2.sql`. Verificar en el diff que trae 619 pares y que ningún `teacher_email` conserva espacios internos ni dígitos pegados.

- [x] T008 [P] Crear `tests/oferta-drift.test.ts`: parsea el archivo de oferta más reciente de `supabase/migrations/` y comprueba que su conjunto de pares coincide exactamente con el que produce el normalizador sobre `src/data/courses.json`. Es el test que cubre el drift de [D5](plan.md#d5-coursesjson-es-la-fuente-postgres-solo-proyecta-course_teachers): sin él, regenerar el JSON y olvidar la migración deja la UI ofreciendo reseñar un par que la FK rechaza.

### Seguridad

- [x] T009 Crear `supabase/migrations/20260729090300_politicas_de_resenas.sql` con `alter table ... enable row level security` sobre las cinco tablas, la función `private.is_banned()` (`stable security definer set search_path = ''`) y las políticas del bloque *RLS* de plan.md. Puntos que no se pueden simplificar: usar `(select auth.uid())` y no `auth.uid()` para que el planner lo evalúe una vez por consulta; la política de select sobre `profiles` **no** consulta `is_banned()`, porque de ahí sale el motivo que FR-057 le tiene que mostrar al sancionado; la única política de select sobre `reviews` es la fila propia y activa; **no existe política de delete** sobre `reviews`, eliminar es un update a `deleted_by_author`.

- [x] T010 Crear `supabase/migrations/20260729090400_reglas_de_resenas.sql` con los ocho triggers de la tabla *Lo que RLS no puede sostener* de plan.md: `handle_new_user` (after insert on `auth.users`, crea el perfil), `normalize_review` (`comment := nullif(btrim(comment), '')`), `enforce_current_pair` (FR-028), `enforce_daily_rating_limit` (FR-030 — cuenta filas **creadas** en 24 h, incluidas las eliminadas, y levanta un error que incluye el instante de liberación para FR-031), `enforce_comment_profile` (FR-017), `stamp_review_timestamps` (FR-064 y FR-055 — sella `comment_published_at` la primera vez que hay texto y `comment_edited_at` en cambios posteriores, sin tocar nunca `published_at`), `stamp_purge_after` (30 días al salir de `active`) y `enforce_reportable` (FR-042 y FR-052 — solo reseñas activas con comentario). Los mensajes de error en español porque llegan al usuario.

  Dos más que la tabla del plan no anticipaba, y sin los cuales quedan huecos: `stamp_comment_on_insert`, porque `stamp_review_timestamps` es `before update` y un comentario publicado **junto con** la reseña no pasa por ahí — que es el camino más común de FR-064 —, y `touch_profile`, que mantiene `profiles.updated_at`. Son diez en total, y `resenas_reglas.test.sql` fija el inventario con `triggers_are` para que el siguiente no se sume en silencio.

  `search_path = ''` en las diez. `security definer` solo en las cinco que consultan otra tabla (`handle_new_user`, `enforce_current_pair`, `enforce_daily_rating_limit`, `enforce_comment_profile`, `enforce_reportable`): las que únicamente escriben sobre `NEW` no lo necesitan y dárselo ampliaría la superficie sin motivo.

- [x] T011 Crear `supabase/migrations/20260729090500_vistas_publicas.sql` con `teacher_course_summaries` (grant a `anon` y `authenticated`) y `review_comments` (grant solo a `authenticated`), tal como están en plan.md. Anotar en un comentario del archivo por qué `get_advisors` va a marcar `security_definer_view` y por qué activarles `security_invoker` rompería FR-008: las vistas son la única forma de dar agregados a `anon` y comentarios anónimos a `authenticated` sin abrir `reviews`, porque RLS filtra filas y no columnas. Ninguna de las dos expone `author_id`. Ambas filtran por `ct.is_current`, que es donde se materializa la decisión de R6.

- [x] T012 Crear `supabase/migrations/20260729090600_funciones_de_moderacion.sql` con `private.moderation_keep(report_id)`, `private.moderation_remove(report_id)`, `private.moderation_ban(report_id, reason)` y `private.deactivate_account(user_id)`, todas `security definer` con `execute` revocado a `public`, `anon` y `authenticated`, y concedido solo a `service_role`. `moderation_ban` hace las dos cosas en una transacción —sella `banned_at`/`ban_reason` y pasa a `removed_by_moderation` **todas** las reseñas activas del autor—, porque separarlas deja FR-056 cumplido a medias. `deactivate_account` bloquea el login vía `auth.users.banned_until`, pasa las reseñas a `deleted_by_author` (lo que sella su `purge_after`) y limpia `career_id` y `term`, sin borrar ninguna fila.

- [x] T013 Crear `supabase/migrations/20260729090700_purga_de_resenas_eliminadas.sql` con `private.purge_expired_reviews()` (borrado físico de las filas con `purge_after < now()`) y su programación diaria en `pg_cron`. Va en `private` y con `execute` solo para `service_role`, como el resto de las `security definer`: en `public` sería un borrado físico invocable como RPC. `delete_own_review` es la única excepción, y comprueba la propiedad. La extensión se crea con `create extension if not exists pg_cron` a secas —no es relocalizable, la extensión va a `pg_catalog` y sus funciones al esquema `cron`— y el `cron.schedule` va de forma reejecutable (`cron.unschedule` previo tolerante a que no exista). Es la condición 2 de publicación de [politica-privacidad.md](politica-privacidad.md): mientras no exista, el documento promete un borrado que no ocurre.

### Verificación

- [x] T014 Ampliar `supabase/seed.sql` con datos de desarrollo para reseñas: perfiles de los dos estudiantes sembrados con carrera y ciclo, un tercer estudiante **baneado** con motivo (para poder ver FR-057 en local), y reseñas de ejemplo sobre pares reales de la oferta que cubran los cuatro estados visibles — par sin puntuaciones, par con una sola puntuación, par con varias puntuaciones y comentarios, y un comentario reportado como `pending`. Los UUID fijos, igual que los usuarios existentes, para que el seed sea idempotente entre `supabase db reset`.

- [x] T015 [P] Crear `supabase/tests/resenas_rls.test.sql` (pgTAP) con los cinco casos que enumera [R2](plan.md#r2-la-frontera-es-rls-no-los-handlers): `anon` no obtiene ninguna fila de `reviews`; un autenticado no obtiene la fila de la reseña de otro; un usuario no ve la reseña que reportó; un baneado no lee nada salvo su propio perfil y motivo; nadie edita ni elimina la reseña de otro. Usar `set local role authenticated` con `request.jwt.claims` para simular cada identidad. El segundo caso es el importante: no da ninguna señal en la UI, se ve igual con `author_id` expuesto que sin él.

- [x] T016 [P] Crear `supabase/tests/resenas_vistas.test.sql` (pgTAP): `teacher_course_summaries` calcula el promedio con un decimal (FR-003) y el porcentaje de recomendación entero (FR-059); `count(comment)` ignora las reseñas sin texto (FR-006 y escenario 28); un par con `is_current = false` desaparece de las dos vistas aunque conserve sus reseñas (R6); `anon` puede leer `teacher_course_summaries` y **no** `review_comments` (FR-013); `review_comments` no expone `author_id` en ninguna forma y oculta al reportante lo que reportó (FR-046).

- [x] T017 [P] Crear `supabase/tests/resenas_reglas.test.sql` (pgTAP) sobre los triggers: publicar una novena puntuación en 24 h falla y el mensaje trae el instante de liberación (FR-030, FR-031); eliminar una reseña **no** libera cupo dentro de la ventana; una segunda reseña activa del mismo par falla y una tras eliminar la primera pasa (FR-027); un comentario de solo espacios queda como reseña sin comentario; un comentario sin `career_id` o sin `term` falla (FR-017); un insert sobre un par `is_current = false` falla (FR-028); `comment_published_at` se sella al añadir texto y no al crear la reseña sin él, y `comment_edited_at` solo aparece en el cambio posterior (FR-064, FR-055); reportar una reseña sin comentario falla (FR-042).

- [x] T018 [P] Crear `supabase/tests/moderacion.test.sql` (pgTAP): `moderation_remove` saca la reseña del promedio y de los conteos en la consulta siguiente (FR-048); `moderation_ban` elimina **todas** las reseñas del autor, no solo la reportada (FR-056), y el baneado conserva la lectura de `teacher_course_summaries` (FR-050); una reseña en `removed_by_moderation` no puede volver a `active` ni siquiera por su autor (FR-037, FR-048); `deactivate_account` sella `purge_after` en todas las reseñas y conserva la fila de `auth.users` y la sanción si la había; `purge_expired_reviews` borra lo vencido y nada más.

- [x] T019 [P] Crear `supabase/tests/permisos.test.sql` (pgTAP): las cuatro funciones de moderación son inejecutables por `anon` y `authenticated`, y `is_banned()` y los triggers tienen `search_path = ''`. Es el test que detecta un `grant` de más, que es la forma en que este diseño se rompe en silencio.

- [x] T020 Ejecutar `supabase db reset` y `supabase test db` en local hasta tener las cinco suites verdes. Corregir migraciones, no tests: un test que se ablanda para pasar deja de cubrir el FR que nombra.

- [x] T021 Ejecutar `mcp__supabase__get_advisors` (o `supabase inspect`) contra la base local y resolver todo lo que aparezca salvo el `security_definer_view` de las dos vistas, que es deliberado. Dejar constancia en el archivo de la migración de T011 de que ese aviso es esperado, para que la próxima persona no lo "arregle".

- [x] T022 En `.github/workflows/ci.yml`, añadir el step `supabase test db` al job `supabase` existente, después de `supabase start` y antes o después del bloque *Verificar migraciones y seed*. No hace falta un job nuevo: `supabase/setup-cli@v3` y `supabase start` ya están ahí.

### Cierre de la fase

- [x] T023 [P] Generar los tipos de la base en `src/types/database.ts` con `mcp__supabase__generate_typescript_types` (o `supabase gen types typescript --local`), y añadir a `package.json` el script `gen-types`. Es lo que hace que los route handlers de las fases siguientes fallen en `pnpm typecheck` cuando el esquema cambie.

- [x] T024 [P] Cerrar R6 por escrito: en `specs/002-resenas-docentes/spec.md`, convertir el edge case *Par docente–curso fuera de la oferta vigente* en una consecuencia asumida y no en una pregunta abierta, y en `specs/002-resenas-docentes/normas-comunidad.md` decir en una línea que una reseña deja de mostrarse si el docente ya no dicta ese curso. En `plan.md`, marcar el pendiente *R6 resuelto* del Progress Tracking.

- [x] T025 [P] Crear `docs/moderacion.md`: la consulta de bandeja de reportes `pending`, cómo invocar cada una de las cuatro funciones desde Studio, la consulta de SC-009 (pares con al menos una puntuación y estudiantes únicos que contribuyeron), la consulta de correlación puntuación–recomendación que decide si FR-061 se retira, y el procedimiento de baja de cuenta a pedido. Es lo que sostiene FR-051, que descarta una consola de administración.

- [x] T026 [P] Actualizar `README.md` y `CONTRIBUTING.md` con lo que cambia del entorno local: `supabase test db` como parte de la verificación, `pnpm generate-offer` y `pnpm diff-oferta` en el procedimiento de actualización de la oferta, y la nueva versión mínima de Node.

- [x] T027 Verificación de la fase: `pnpm lint`, `pnpm typecheck`, `pnpm test --coverage`, `pnpm build`, `supabase db reset` y `supabase test db` en verde. El build tiene que pasar **sin variables de entorno de Supabase**, que es la garantía de `docs/auth.md`.

**Checkpoint**: base de datos completa y verificada. PR 1 listo. Las seis historias pueden empezar.

---

## Phase 3: US1 — Comparar docentes sin iniciar sesión (Priority: P1) 🎯 MVP

**Goal**: junto a cada docente de una sección aparece su promedio en estrellas, el porcentaje que lo recomienda, la cantidad de puntuaciones y la de comentarios, sin iniciar sesión y sin perder la selección de cursos. Cubre los escenarios 1–6, FR-001..FR-012, FR-053, FR-054, FR-058..FR-060, SC-001 y SC-002.

**Independent Test**: en una ventana de incógnito, buscar un curso, desplegar sus secciones y ver el resumen de cada docente; recargar y comprobar que la selección previa de cursos y secciones sigue intacta. Un docente sembrado sin reseñas muestra `Sin puntuaciones` y una sesión sin correo muestra `Docente por asignar`, y los dos estados se distinguen entre sí y de un fallo de carga.

### Tests para US1

- [x] T028 [P] [US1] Crear `tests/review-format.test.ts`: promedio con un decimal en escala 1–5, porcentaje entero sin decimales, `1 puntuación` en singular frente a `N puntuaciones`, `Aún no hay comentarios`, y la distinción entre `Sin puntuaciones` (hay docente, nadie lo evaluó) y `Docente por asignar` (no hay a quién evaluar).

- [x] T029 [P] [US1] Crear `tests/reviews-queries.test.ts` sobre la capa de consulta: la proyección de `getCourseSummaries` no incluye `author_id` bajo ninguna forma, y agrupa por par docente–curso de modo que un docente repetido en dos sesiones de la misma sección devuelve una sola entrada (FR-009) y el mismo docente en dos secciones del curso comparte resumen (FR-011).

### Implementación de US1

- [x] T030 [P] [US1] Crear `src/lib/review-format.ts` con el formateo puro: promedio, porcentaje, plurales de conteos, etiqueta `editado`, y el texto del límite de FR-031. Sin JSX ni acceso a red — es una de las tres piezas que compensan el coverage del JSX nuevo ([R1](plan.md#r1-el-trinquete-de-coverage-bloquea-el-ci)).

- [x] T031 [P] [US1] Crear `src/lib/reviews.ts` con las consultas contra Supabase que usan los route handlers, empezando por `getCourseSummaries(courseCode)` sobre `teacher_course_summaries`. Recibe el cliente por parámetro para ser testeable en node. Devuelve tipos propios de la aplicación, no las filas de la vista.

- [x] T032 [P] [US1] Crear `src/lib/api-client.ts` con el fetch tipado a `/api/*` desde los componentes, incluida la caché en memoria por curso que vive lo que dure la pestaña y su invalidación explícita. La invalidación es lo que sostiene SC-005 en la pestaña del propio autor, que es donde más se nota; las fases 5 y 6 la van a llamar.

- [x] T033 [US1] Crear `src/app/api/courses/[code]/summaries/route.ts`: valida el código de curso, llama a `getCourseSummaries` con el cliente de servidor de `src/lib/supabase/server.ts` —uno por request, nunca en scope de módulo— y responde la proyección sin `author_id`. Sin sesión requerida. Si faltan las variables de entorno de Supabase, responde un cuerpo vacío bien formado en lugar de reventar, que es lo que mantiene la garantía de `docs/auth.md`.

- [x] T034 [P] [US1] Crear `src/components/reviews/TeacherSummary.tsx`: estrellas con el promedio, porcentaje de recomendación, conteo de puntuaciones y de comentarios, y los estados `Sin puntuaciones` y `Docente por asignar`. Tailwind con variante `dark:` en todo (edge case *Modo claro y oscuro*). Componente fino: todo el texto sale de `review-format.ts`. La interfaz no presenta la puntuación como medida de facilidad (FR-004) ni la recomendación como medida de carga o dificultad (FR-062).

- [x] T035 [US1] Integrar `TeacherSummary` en `src/components/SectionSelector.tsx`, agrupando por docente normalizado con `teacherPairKey` para que un docente repetido en varias sesiones aparezca una sola vez (FR-009) y cada docente de una sección tenga su propio resumen (FR-010). Una sesión cuyo correo normalizado es `null` renderiza `Docente por asignar` y no ofrece detalle (FR-054).

- [x] T036 [US1] Pedir los resúmenes **por curso al desplegarlo** desde `SectionSelector`, no par por par, y cachearlos con `api-client.ts`. Una llamada trae los docentes de todas las secciones del curso ([D1](plan.md#d1-teacher_course_summaries-se-consulta-desde-el-cliente)).

- [x] T037 [US1] Degradación sin Supabase: cuando falten `NEXT_PUBLIC_SUPABASE_URL` o `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, la app renderiza el horario exactamente como hoy y no muestra ni resúmenes ni estados de error. Armar el horario tiene que sobrevivir a que Supabase esté caído.

- [x] T038 [US1] Estado de carga y de fallo distinguibles del estado `Sin puntuaciones`, que es literalmente lo que pide SC-002. Un resumen que no cargó no puede parecerse a un docente sin reseñas.

- [x] T039 [US1] Comprobar que abrir y cerrar el resumen no toca `localStorage` ni la selección de cursos y secciones (FR-012, SC-001). Añadir el caso a `tests/storage.test.ts` si el flujo lo permite sin jsdom.

- [x] T040 [US1] **Medir R1**: correr `pnpm test --coverage` con los `.tsx` nuevos dentro y comparar contra el piso de `vitest.config.ts` (`32.57 / 32.63 / 28.33 / 25.06`). Si alguno de los cuatro baja, montar jsdom + `@testing-library/react` y añadir tests de componente antes de seguir. Anotar el resultado en el Progress Tracking de plan.md — es el pendiente *R1 medido con el primer componente*.

**Checkpoint**: US1 funciona sola. Un visitante sin sesión compara docentes. PR 2 listo.

---

## Phase 4: US2 — Sesión institucional y perfil (Priority: P2)

**Goal**: el estudiante puede iniciar sesión con su cuenta UTEC desde la interfaz, completar carrera y ciclo, y leer las normas y la política de privacidad. Cubre los escenarios 8–12, FR-013..FR-020, FR-026 y SC-007.

**Nota**: hoy existen `/auth/login`, `/auth/callback`, `/auth/signout` y `/auth/error`, pero **ninguna parte de la interfaz llama a ninguna**. Un usuario no tiene forma de iniciar sesión desde la app. Esta fase cierra ese hueco.

**Independent Test**: iniciar sesión con una cuenta `@utec.edu.pe`, ver el menú de sesión con la cuenta activa, guardar carrera y ciclo en `/perfil` y recargar comprobando que persisten. Intentar entrar con una cuenta de otro dominio y ver el rechazo explicado. Abrir `/normas` y `/privacidad` sin sesión.

### Tests para US2

- [ ] T041 [P] [US2] Crear `tests/careers.test.ts`: el catálogo tiene 16 entradas, los slugs cumplen `^[a-z0-9-]+$` y coinciden uno a uno con la tabla de [carreras-utec.md](carreras-utec.md). Es el test que detecta que la migración T005 y el documento se separaron.

- [ ] T042 [P] [US2] Crear `tests/profile-validation.test.ts`: el ciclo se acepta entre 1 y 10 y se rechaza fuera, con no-enteros y con vacío; la carrera se acepta solo si es un slug del catálogo.

### Implementación de US2

- [ ] T043 [P] [US2] Crear `src/lib/careers.ts` con los tipos del catálogo y el agrupado por facultad para ordenar el selector. La facultad agrupa visualmente y **no** se guarda junto a una reseña.

- [ ] T044 [P] [US2] Crear `src/lib/profile.ts` con la validación de carrera y ciclo, compartida por el formulario y el route handler. La del handler es la que cuenta; la del formulario es para no hacer viajar un error evitable.

- [ ] T045 [US2] Crear `src/app/api/careers/route.ts`: devuelve el catálogo desde `careers` filtrando `is_active`. Sin sesión requerida.

- [ ] T046 [US2] Crear `src/app/api/profile/route.ts` con `GET` y `PATCH`. El `GET` devuelve carrera, ciclo y **el estado de sanción**: si `banned_at` no es nulo, `{ banned: true, reason }`. Es lo que le permite a la UI mostrar el motivo de FR-057 sin tener que provocar un error. El `PATCH` valida contra `src/lib/profile.ts` y responde errores en español.

- [ ] T047 [US2] Crear `src/lib/api-guards.ts` con el guard compartido de los handlers restringidos: resuelve la sesión con `getClaims()` —nunca `getSession()`—, consulta el perfil y corta con `403` y `{ banned: true, reason }` si hay sanción. Un rechazo de RLS es un fallo genérico y no alcanza para FR-057. Todos los handlers de las fases 5, 6 y 7 lo usan.

- [ ] T048 [P] [US2] Crear `tests/api-guards.test.ts`: sin sesión devuelve 401, con sesión y sin sanción deja pasar, con sanción devuelve 403 con el motivo en el cuerpo.

- [ ] T049 [P] [US2] Crear `src/components/SessionMenu.tsx`: iniciar sesión con Google cuando no hay sesión, y la cuenta activa con acceso a `/perfil` y cerrar sesión cuando la hay. Cuando faltan las variables de entorno de Supabase no se renderiza (T037). Tailwind con `dark:`.

- [ ] T050 [US2] Montar `SessionMenu` en `src/app/layout.tsx` o en la cabecera existente, que es lo que hace alcanzable el login por primera vez.

- [ ] T051 [P] [US2] Crear `src/components/ProfileForm.tsx`: selector de carrera agrupado por facultad y selector de ciclo 1–10, ambos opcionales para leer y obligatorios solo antes de comentar (FR-016, edge case *Perfil incompleto*).

- [ ] T052 [US2] Crear `src/app/perfil/page.tsx` que monta `ProfileForm` y, si la cuenta está sancionada, muestra el mensaje de FR-057 con el motivo en lugar del formulario.

- [ ] T053 [P] [US2] Crear `src/app/normas/page.tsx` con el contenido de [normas-comunidad.md](normas-comunidad.md).

- [ ] T054 [P] [US2] Crear `src/app/privacidad/page.tsx` con el contenido de [politica-privacidad.md](politica-privacidad.md). **No publicar** hasta que se cumplan las tres condiciones del propio documento (T099).

- [ ] T055 [US2] Verificar el escenario 9 de punta a punta: una cuenta que no es `@utec.edu.pe` es rechazada por el hook y `/auth/error` explica que la funcionalidad está reservada para estudiantes UTEC. Solo hay que comprobarlo; el hook ya existe.

**Checkpoint**: hay sesión, perfil y documentos públicos. PR 3 listo.

---

## Phase 5: US3 — Leer los comentarios de un docente (Priority: P3)

**Goal**: un estudiante autenticado abre el detalle de un docente en un curso y lee los comentarios, del más reciente al más antiguo, sin identidad del autor. Cubre los escenarios 7, 10, 25–28, FR-034..FR-036, FR-064, FR-055 y SC-006.

**Independent Test**: con sesión, abrir el detalle de un par sembrado con comentarios y ver la lista ordenada por fecha de publicación del comentario, con la marca `editado` donde corresponde. Un par con puntuaciones y sin comentarios muestra `Aún no hay comentarios`. Sin sesión, el detalle pide iniciar sesión. Inspeccionar la respuesta de red y comprobar que no viaja ningún identificador de autor.

### Tests para US3

- [ ] T056 [P] [US3] Crear `tests/reviews-comments.test.ts`: la proyección de la lista de comentarios contiene exactamente puntuación, recomendación, texto, fecha de publicación del comentario y marca de edición — y nada más; el orden es por `comment_published_at` descendente (FR-034); las reseñas sin texto no producen entradas (FR-036, escenario 28); la fecha visible es `comment_published_at` y no `published_at` ([D2](plan.md#d2-comment_published_at-es-la-fecha-visible-de-un-comentario)).

### Implementación de US3

- [ ] T057 [US3] Añadir `getPairComments(courseCode, teacherEmail)` a `src/lib/reviews.ts`, sobre la vista `review_comments`. La vista ya aplica FR-046 y FR-049; la capa de aplicación no vuelve a filtrar, solo proyecta.

- [ ] T058 [US3] Crear `src/app/api/reviews/route.ts` con el `GET ?course=&teacher=`: comentarios del par y la reseña propia del usuario si existe, usando el guard de T047. Responde 401 sin sesión, que es lo que dispara la petición de login del escenario 8.

- [ ] T059 [P] [US3] Crear `src/components/reviews/ReviewsPanel.tsx`: el detalle del par. Sin sesión muestra la invitación a iniciar sesión con cuenta institucional; con sesión, la lista de comentarios. Se abre desde `TeacherSummary` sin navegar fuera de la página, para no perder la selección (FR-012, escenario 7).

- [ ] T060 [P] [US3] Crear `src/components/reviews/CommentList.tsx` con la fila de comentario: estrellas, recomendación, texto, fecha de publicación y `editado` cuando `comment_edited_at` no es nulo (FR-035, FR-055). Sin nada del autor (FR-019). Tailwind con `dark:`.

- [ ] T061 [US3] Estado vacío `Aún no hay comentarios` conservando el promedio visible (escenario 27, edge case *Sin comentarios después de autenticar*). No inventar comentarios de relleno ni obligar a contribuir.

- [ ] T062 [US3] Conectar la apertura del detalle desde `TeacherSummary` (T034), respetando que un `Docente por asignar` no ofrece detalle.

- [ ] T063 [US3] Verificar que un estudiante autenticado que nunca publicó y no completó su perfil lee los comentarios sin fricción (escenario 10, FR-015, FR-016).

- [ ] T064 [US3] Comprobar SC-006 en la respuesta cruda de `/api/reviews`: ningún campo permite agrupar comentarios por autor. Es la comprobación que la UI no da: se ve igual con `author_id` que sin él.

**Checkpoint**: se leen comentarios. PR 4 listo.

---

## Phase 6: US4 — Publicar puntuación, recomendación y comentario (Priority: P4)

**Goal**: el estudiante declara que llevó el curso, puntúa de 1 a 5, responde la recomendación y opcionalmente comenta. Cubre los escenarios 13–19, 37, FR-021..FR-033, FR-061, FR-062, SC-003 y SC-004.

**Independent Test**: publicar una puntuación con recomendación y sin comentario, sin que el formulario pida carrera, ciclo ni compromiso de respeto, y ver el promedio actualizado en la siguiente consulta. Después añadir un comentario y comprobar que ahora sí exige perfil y compromiso. Intentar una novena puntuación en 24 h y ver el bloqueo con la hora de liberación.

### Tests para US4

- [ ] T065 [P] [US4] Crear `tests/review-submit.test.ts` sobre la validación compartida: sin declaración de experiencia no se publica (escenario 14); sin puntuación no se publica; sin recomendación no se publica (FR-061, escenario 37); un comentario sin puntuación no se publica (FR-024); un comentario con perfil incompleto o sin compromiso no se publica y el error enumera lo que falta (escenario 15); un comentario de más de 500 caracteres se rechaza (FR-022).

- [ ] T066 [P] [US4] Ampliar `tests/review-format.test.ts` con el texto del límite de FR-031: dado un instante de liberación, el mensaje dice cuándo se puede volver a contribuir.

### Implementación de US4

- [ ] T067 [P] [US4] Crear `src/lib/review-submit.ts` con la validación de una reseña —declaración, puntuación, recomendación, comentario, perfil y compromiso—, compartida por el formulario y el handler. La del handler es la que cuenta.

- [ ] T068 [US4] Añadir `createReview` a `src/lib/reviews.ts` y traducir los errores de los triggers a mensajes en español: unicidad del par (FR-027 → conducir a editar, escenario 16), límite de 24 h (FR-030 con la hora de FR-031), par fuera de la oferta (FR-028), perfil incompleto (FR-017).

- [ ] T069 [US4] Añadir el `POST` a `src/app/api/reviews/route.ts` con el guard de T047 y la validación de T067. Responde el error del trigger ya traducido, con el código que la UI necesita para distinguir *ya reseñaste este par* de *alcanzaste el límite*.

- [ ] T070 [P] [US4] Crear `src/components/reviews/StarRating.tsx`: selector de 1 a 5 estrellas, accesible por teclado, sin valor preseleccionado. Tailwind con `dark:`.

- [ ] T071 [P] [US4] Crear `src/components/reviews/ReviewForm.tsx`: casilla `Declaro que llevé este curso con este docente`, estrellas, recomendación `Sí`/`No` **sin valor preseleccionado** (FR-061), y el comentario opcional con el texto exacto `Cuenta algo que le serviría saber a otro estudiante. Este espacio no es para preguntas` (FR-023) y el contador de caracteres restantes sobre 500 (edge case *Comentario extenso*). El curso y el docente llegan preseleccionados y no se pueden cambiar (FR-028).

- [ ] T072 [US4] Añadir al formulario el bloque de comentario condicional: carrera y ciclo cuando el perfil está incompleto (escenario 11, FR-017) y el control de compromiso de respeto, inicialmente desmarcado, con el texto exacto `Confirmo que esta reseña refleja mi experiencia y cumple las normas de respeto` (FR-025) y enlaces directos a `/normas` y `/privacidad` (FR-026).

- [ ] T073 [US4] Mensaje del escenario 14 cuando falta la declaración: el espacio recoge experiencias de alumnos que ya llevaron el curso con ese docente y no admite preguntas, solicitudes de información ni expresiones de interés (FR-041, edge case *Intento de hacer una pregunta*).

- [ ] T074 [US4] Invalidar la caché del curso en `api-client.ts` tras publicar y volver a pedir el resumen, que es lo que sostiene SC-005 en la pestaña del autor.

- [ ] T075 [US4] Confirmación visible tras publicar, con la reseña ya reflejada en el detalle (escenario 19).

- [ ] T076 [US4] Pérdida de sesión durante la publicación: la reseña no se publica y el texto escrito se conserva para reintentar después de iniciar sesión (edge case *Pérdida de sesión durante la publicación*). Guardar el borrador en memoria del componente basta; no persistirlo en `localStorage`, que lo dejaría en el dispositivo más tiempo del necesario.

- [ ] T077 [US4] Comprobar SC-003 y SC-004 de punta a punta: una puntuación con recomendación y sin comentario no pide perfil ni compromiso, y ocho reseñas seguidas —una carga académica completa— pasan sin toparse con el límite.

**Checkpoint**: se publica. PR 5 listo.

---

## Phase 7: US5 — Editar y eliminar la reseña propia (Priority: P5)

**Goal**: el autor cambia su puntuación, recomendación o comentario, o elimina su reseña. Cubre los escenarios 20–24, FR-037..FR-040, FR-055, FR-064 y SC-005.

**Independent Test**: editar la puntuación de una reseña sin comentario y ver el promedio recalculado sin que suba el conteo de puntuaciones. Añadir un comentario a esa reseña y ver subir solo el conteo de comentarios. Borrar el texto conservando la puntuación. Eliminar la reseña y comprobar que sale del promedio y que el cupo de 24 h **no** se libera.

### Tests para US5

- [ ] T078 [P] [US5] Crear `tests/review-edit.test.ts`: editar puntuación o recomendación no exige perfil ni compromiso (escenario 20); añadir o editar texto sí los exige (FR-038, escenario 21); borrar el texto por completo no exige una nueva confirmación de respeto (FR-025, escenario 22); una edición no consume cupo del límite (escenario 24).

### Implementación de US5

- [ ] T079 [US5] Añadir `updateReview` y `softDeleteReview` a `src/lib/reviews.ts`. Eliminar es un `update` de `state` a `deleted_by_author`, nunca un `delete`: la política de privacidad promete 30 días de retención y el edge case *Límite de publicación* exige que borrar no libere cupo.

- [ ] T080 [US5] Crear `src/app/api/reviews/[id]/route.ts` con `PATCH` y `DELETE`, ambos con el guard de T047. El `DELETE` no borra: hace el soft delete. Una reseña en `removed_by_moderation` responde un error explícito, no un 404 (FR-037, escenario 36).

- [ ] T081 [US5] Reutilizar `ReviewForm` en modo edición, precargado con la reseña propia y sin la casilla de declaración, que ya se hizo al crear.

- [ ] T082 [US5] Confirmación explícita antes de eliminar (FR-039), diciendo que la eliminación es definitiva y que ni siquiera su autor podrá recuperarla.

- [ ] T083 [US5] Conducir a editar cuando el usuario intenta reseñar un par que ya reseñó, en lugar de dejar que falle el índice único (escenario 16). El error de T068 es la señal.

- [ ] T084 [US5] Invalidar la caché del curso en cada edición y eliminación, igual que en T074.

- [ ] T085 [US5] Comprobar SC-005: publicar, editar y eliminar se reflejan en la consulta siguiente sin ninguna ventana de datos viejos, tanto en la pestaña del autor como en otra sesión.

**Checkpoint**: el autor controla su reseña. PR 6 listo.

---

## Phase 8: US6 — Reportar y sanción visible (Priority: P6)

**Goal**: un estudiante reporta una reseña con comentario, deja de vérsela mientras se revisa, y un usuario sancionado recibe el motivo cada vez que intenta actuar. Cubre los escenarios 29–36, FR-041..FR-052, FR-056, FR-057 y SC-008.

**Independent Test**: reportar un comentario y comprobar que desaparece para quien reportó y sigue visible en otra sesión. Intentar reportarlo otra vez y que no se duplique. Resolver el reporte desde Studio con `moderation_remove` y ver el comentario fuera del promedio. Con la cuenta baneada del seed, intentar leer, publicar y reportar y recibir el motivo cada vez.

### Tests para US6

- [ ] T086 [P] [US6] Crear `tests/report-validation.test.ts`: los seis motivos de FR-043 son los aceptados y ningún otro; `Otro` sin explicación se rechaza (FR-044); una reseña sin comentario no es reportable (FR-042, FR-052, escenario 31).

- [ ] T087 [P] [US6] Crear `tests/banned-response.test.ts`: la respuesta 403 de una cuenta sancionada trae siempre el motivo, en las cinco acciones que FR-057 enumera —leer comentarios, publicar, editar, eliminar y reportar—. Ocultar la función sin explicación no cumple el FR.

### Implementación de US6

- [ ] T088 [US6] Añadir `createReport` a `src/lib/reviews.ts` con los seis motivos de FR-043 tipados y la exigencia de explicación en `Otro`.

- [ ] T089 [US6] Crear `src/app/api/reviews/[id]/reports/route.ts` con el `POST`, el guard de T047 y la traducción del error de unicidad `(review_id, reporter_id)` a *ya reportaste esta reseña* (FR-045, escenario 32).

- [ ] T090 [P] [US6] Crear `src/components/reviews/ReportDialog.tsx`: selector de motivo con las seis etiquetas exactas de FR-043, campo de explicación que aparece y se vuelve obligatorio con `Otro`, y confirmación de que el reporte será revisado (escenario 29). Tailwind con `dark:`.

- [ ] T091 [US6] Añadir la acción `Reportar` a cada comentario listado. Como las reseñas sin comentario no se listan (FR-036), no ofrecen la acción — no hace falta lógica extra, solo no añadirla en otro sitio.

- [ ] T092 [US6] Tras reportar, quitar el comentario de la lista visible en el acto y recargar desde la vista, que ya lo oculta para el reportante (FR-046, escenario 30, SC-008).

- [ ] T093 [P] [US6] Crear `src/components/BannedNotice.tsx`: el mensaje de FR-057 con el motivo, para reutilizarlo en el panel, el formulario, el diálogo de reporte y `/perfil`.

- [ ] T094 [US6] Cablear la respuesta `403 { banned, reason }` de todos los handlers a `BannedNotice`, en las cinco acciones. Los resúmenes públicos siguen visibles para el sancionado (FR-050, escenario 35).

- [ ] T095 [US6] Verificar el escenario 36 de punta a punta: una reseña eliminada por moderación no se puede editar ni restaurar, con o sin sanción sobre su autor. La puerta la cierra el `using` de la política de update; acá solo se comprueba que la UI lo explica en vez de fallar en genérico.

**Checkpoint**: reportes y sanciones completos. Las seis historias funcionan. PR 7 listo.

---

## Phase 9: Polish & Cross-Cutting Concerns

- [ ] T096 [P] Repasar los estados vacíos, formularios, estrellas, conteos y diálogos en modo claro y oscuro (edge case *Modo claro y oscuro*). Es transversal a las seis historias y por eso se revisa una vez, al final.

- [ ] T097 [P] Añadir a `docs/moderacion.md` la consulta de SC-009 ya verificada contra datos reales: pares con al menos una puntuación y estudiantes únicos que contribuyeron. Es lo que permite saber si la feature sigue en arranque en frío ([R4](plan.md#r4-arranque-en-frío)).

- [ ] T098 [P] Comprobar en producción que `pg_cron` está habilitado en el proyecto `rlsswhwrigdgsboqakyw` y que el job de purga quedó programado. En local basta el reset; en producción es una dependencia externa ([R5](plan.md#r5-dependencias-externas-sin-cerrar)).

- [ ] T099 Cerrar las tres condiciones de publicación de [politica-privacidad.md](politica-privacidad.md) —incluida la casilla de que `privacidad@mail.luismaquera.dev` recibe correo— y quitarle el estado de borrador. Recién entonces enlazar `/privacidad` desde el formulario.

- [ ] T100 [P] Revisar `src/lib/rate-limit.ts`: es por IP y en memoria, y sigue cubriendo `/api/*` desde `src/proxy.ts`. Comprobar que los límites nuevos no bloquean el uso legítimo del panel de reseñas. El límite por usuario de FR-030 **no** vive acá, vive en el trigger.

- [ ] T101 [P] Opcional: unificar `scripts/parse-pdf.js` con `src/lib/teacher-email.ts`. Es un cambio propio porque obliga a regenerar `src/data/courses.json` y a actualizar el golden test de `tests/parse-pdf.test.ts`. No mezclarlo con ningún PR de esta feature.

- [ ] T102 Actualizar el Progress Tracking de [plan.md](plan.md): marcar *Plan revisado y aprobado*, *R6 resuelto*, *R1 medido*, *Reparto en PRs* y las condiciones de la política.

---

## Dependencies & Execution Order

### Dependencias entre fases

- **Setup (Fase 1)**: sin dependencias.
- **Foundational (Fase 2)**: depende de Setup (T006 necesita el normalizador de T002). **Bloquea todas las historias.**
- **US1 (Fase 3)**: depende de Fase 2. Sin dependencias con otras historias.
- **US2 (Fase 4)**: depende de Fase 2. Independiente de US1.
- **US3 (Fase 5)**: depende de Fase 2 y de **US2** — leer comentarios exige sesión (FR-013), y sin `SessionMenu` no hay forma de iniciarla. Reutiliza el `TeacherSummary` de US1 como punto de entrada.
- **US4 (Fase 6)**: depende de US3 (comparte `ReviewsPanel`) y de US2 (perfil para comentar).
- **US5 (Fase 7)**: depende de US4 (reutiliza `ReviewForm`).
- **US6 (Fase 8)**: depende de US3 (la unidad reportable es un comentario listado).
- **Polish (Fase 9)**: depende de todas.

La única historia realmente independiente es US1, y es a propósito: es el MVP y no necesita sesión.

### Dentro de cada fase

- Los tests van antes que la implementación que verifican.
- `src/lib/` antes que los route handlers, y los handlers antes que los componentes.
- En la Fase 2: el esquema (T004) antes que políticas, triggers, vistas y funciones; el normalizador (T002) antes que el generador de oferta (T006); todas las migraciones antes de los pgTAP (T015–T019).

### Oportunidades de paralelismo

- **Fase 1**: T002 y T003 en paralelo.
- **Fase 2**: T005 (catálogo) es independiente de T009–T013. Los cinco archivos pgTAP (T015–T019) se escriben en paralelo y se corren juntos en T020. T023–T026 son cuatro archivos distintos.
- **Fase 3**: T028/T029 juntos; T030, T031, T032 y T034 son archivos distintos.
- **Fase 4**: T041/T042 juntos; T043, T044, T049, T051, T053 y T054 son archivos distintos.
- **Fases 5–8**: los componentes nuevos de cada fase entre sí, y los tests de cada fase entre sí.

---

## Parallel Example: Fase 2, suite de pgTAP

```bash
# Los cinco archivos de supabase/tests/ se escriben en paralelo:
Task: "resenas_rls.test.sql — los cinco casos de R2"
Task: "resenas_vistas.test.sql — agregados, is_current y ausencia de author_id"
Task: "resenas_reglas.test.sql — los ocho triggers"
Task: "moderacion.test.sql — las cuatro funciones y la purga"
Task: "permisos.test.sql — grants y search_path"

# Y después, una sola vez:
supabase db reset && supabase test db
```

---

## Implementation Strategy

### MVP primero

1. Fase 1 (Setup) → Fase 2 (base de datos completa) → **PR 1**
2. Fase 3 (US1) → **PR 2**
3. **PARAR Y VALIDAR**: un visitante sin sesión compara docentes dentro del flujo de armado del horario. Eso ya es SC-001 y SC-002 cumplidos, y es entregable por sí solo aunque nadie haya publicado todavía una reseña.

### Entrega incremental

Cada PR posterior añade una capacidad sin romper la anterior. El orden 2 → 3 → 4 → 5 → 6 → 7 sigue las dependencias de arriba y no admite reordenarse salvo que US2 y US1 intercambien lugar, que es la única permutación válida.

### Arranque en frío

Al desplegar hay 619 pares en `Sin puntuaciones` y ninguna reseña ([R4](plan.md#r4-arranque-en-frío)). Los Non-Goals descartan campañas e incentivos; SC-009 solo deja la consulta para medirlo. No es un problema a resolver en estas tareas, pero conviene saberlo antes de mirar el primer despliegue.

---

## Notes

- `[P]` = archivos distintos, sin dependencias pendientes.
- Commitear por tarea o por grupo lógico; cada fase cierra en un PR.
- Los mensajes de error de triggers y handlers llegan al usuario: en español.
- Ningún `.tsx` nuevo debe llevar lógica testeable — va a `src/lib/`. Es lo que mantiene arriba el trinquete de coverage.
- Toda la UI degrada a la app actual cuando faltan las variables de entorno de Supabase. El job `build` del CI corre sin secretos.
