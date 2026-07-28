# Implementation Plan: Reseñas de docentes por curso

**Feature Branch**: `002-resenas-docentes`
**Created**: 2026-07-28
**Estado**: Propuesta — requiere tu revisión antes de escribir código
**Spec**: [spec.md](spec.md) · 57 FR, 36 escenarios, SC-001..SC-009

---

## Summary

La feature agrega puntuaciones, recomendación y comentarios por combinación
**docente–curso**, leídos desde el flujo actual de armado del horario. El cambio
estructural no está en la UI de estrellas: está en que **esta es la primera feature de la
app que lee y escribe datos propios**. Hoy `public` está vacío, todo el estado vive en
`localStorage` y lo único que toca la base es el hook de dominio del signup.

El plan se apoya en tres decisiones que ordenan todo lo demás:

1. **La oferta vigente se materializa en una tabla** (`course_teachers`). Es lo que
   permite que la base —y no el cliente— decida qué par docente–curso es reseñable
   (FR-028, FR-053, FR-054) y que el resumen sea una consulta agregada y no un cálculo
   en el navegador.
2. **La base es la única frontera de seguridad.** El cliente habla PostgREST directo con
   la publishable key; RLS y triggers imponen los FR. No se agregan route handlers que
   reimplementen lo que RLS ya sostiene.
3. **Los resúmenes públicos salen de una vista agregada**, no de leer reseñas. `anon`
   nunca obtiene una fila de `reviews`.

---

## Technical Context

| | |
|---|---|
| **Lenguaje** | TypeScript 5, React 19.2.3, Next.js 16.1.6 (App Router) |
| **Datos** | Postgres 17 (Supabase), proyecto `rlsswhwrigdgsboqakyw`; local vía `supabase start` |
| **Auth** | Supabase Auth, Google como único proveedor, allowlist exacta `utec.edu.pe` ([docs/auth.md](../../docs/auth.md)) |
| **Estilos** | Tailwind 4, siempre con variante `dark:` |
| **Tests** | vitest 4, `environment: 'node'`, sin jsdom ni testing-library. Trinquete de coverage con `autoUpdate` |
| **CI** | `pnpm lint`, `pnpm typecheck`, `pnpm test --coverage`, `pnpm build`. **Sin secretos** |
| **Runtime** | Vercel Fluid Compute. Cliente de Supabase por request, nunca en scope de módulo |
| **Escala** | 1821 sesiones, ~700 cursos-sección, 619 pares docente–curso reseñables. Alumnado del orden de miles |

**Restricción heredada que condiciona el diseño**: `docs/auth.md` fija que *"sin variables
de entorno la app corre igual"* y el job `build` del CI no tiene secretos. Toda la UI de
reseñas tiene que degradar a la app actual cuando falten `NEXT_PUBLIC_SUPABASE_URL` /
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, no romper el build.

---

## Constitution Check

El repo no tiene `constitution.md`; las reglas duras están en
[CONTRIBUTING.md](../../CONTRIBUTING.md) y [docs/auth.md](../../docs/auth.md). El plan se
verifica contra ellas:

| Regla | Cumple | Nota |
|---|---|---|
| TypeScript en todo el código nuevo | ✅ | |
| `'use client'` solo donde hay estado o efectos | ✅ | Ver [decisión D1](#d1-los-resúmenes-se-leen-desde-el-cliente-no-desde-un-server-component) |
| Tailwind con variante `dark:` | ✅ | Cubre el edge case *Modo claro y oscuro* |
| Texto de UI en español | ✅ | |
| Comentarios escasos, solo el *por qué* | ✅ | |
| La llave de usuario es `sub`, nunca el correo | ⚠️ | `profiles.id` → `auth.users(id)`, como pide la regla. Dos excepciones: el correo del **docente** (identificador de la oferta, no de una cuenta) y la sanción, que tiene que sobrevivir a la baja de cuenta — ver [D3](#d3-la-sanción-se-guarda-por-correo-no-por-sub) |
| Cliente de Supabase por request | ✅ | Se reusa `src/lib/supabase/{server,client}.ts` |
| `getClaims()`, no `getSession()` | ✅ | |
| Lint + build pasan | ⚠️ | El trinquete de coverage es el riesgo real, ver [R1](#r1-el-trinquete-de-coverage-bloquea-el-ci) |
| Spec e implementación viajan en el mismo PR | ⚠️ | Ver [Fase 2](#fase-2--entrega): la feature no entra en un PR revisable |

---

## Estructura de la documentación

Spec-kit propone abrir `research.md`, `data-model.md`, `contracts/` y `quickstart.md`
junto al plan. Acá van **dentro de este archivo**: la carpeta ya tiene cuatro documentos
(spec, normas, privacidad, carreras) y el modelo de datos de esta feature son cinco tablas
y una vista. Partirlo en seis archivos más agrega navegación, no claridad. Si prefieres el
fan-out estricto de spec-kit, se parte sin costo — dímelo.

```
specs/002-resenas-docentes/
├── spec.md                  # qué y por qué (cerrado)
├── plan.md                  # este archivo: cómo
├── normas-comunidad.md      # contenido de /normas
├── politica-privacidad.md   # contenido de /privacidad (borrador)
└── carreras-utec.md         # catálogo de FR-017
```

---

## Fase 0 — Investigación

### Lo que ya está resuelto y no hay que rehacer

- **Login institucional** (FR-013, FR-014): hook `Before User Created` + revalidación en
  el callback. Escenarios 8 y 9 ya están cubiertos por infraestructura existente.
- **Refresco de sesión**: `src/proxy.ts` → `updateSession`, con `matcher` que cubre páginas.
- **Supabase local reproduce producción** (`supabase/config.toml`, `seed.sql` con dos
  estudiantes de prueba `@utec.edu.pe`).

### Lo que la investigación de datos cambió

El spec asumía que la oferta *"permite distinguir a cada docente de manera consistente"*.
Medido sobre `src/data/courses.json`:

| Hecho | Sesiones |
|---|---|
| Total de sesiones | 1821 |
| Correo del docente **corrupto** (capacidad pegada, dominio partido por el salto de línea del PDF) | 360 |
| Sesiones sin docente ni correo | 362 |
| Sesiones cuyo campo `email` contiene solo un número de capacidad | 16 |
| **Sin docente evaluable** (362 + 16) | **378** (21%) |

Ejemplos reales del campo `email`: `pperezq@utec.edu.pe 44`, `rcondorena@utec.edu. pe`,
`amorantep@utec.edu.p e`.

Tras normalizar (colapsar espacios internos y quitar los dígitos pegados al dominio):
**336 docentes distintos y 619 pares docente–curso**, contra 267 y 496 sin normalizar. Y
un dato que cierra el caso: **de las 378 sesiones sin correo recuperable, ninguna tiene
nombre de docente**. No se pierde ni un docente al descartarlas — son exactamente el
estado `Docente por asignar` de FR-054.

**Consecuencia**: la normalización del correo es un *prerequisito*, no una mejora. Sin
ella, `rcondorena@utec.edu. pe` y `rcondorena@utec.edu.pe` serían dos docentes y FR-053
se rompe desde el primer día.

### Lo que no existe todavía

- Ninguna tabla en `public`. Esta feature crea el esquema de la app.
- **Ninguna UI de sesión.** Existen `/auth/login`, `/auth/callback`, `/auth/signout` y
  `/auth/error`, pero nada en la interfaz llama a ninguna. Un usuario hoy no tiene forma
  de iniciar sesión desde la app.
- `src/lib/rate-limit.ts` es **por IP y en memoria**: no puede sostener FR-030, que es
  una regla por usuario y con ventana de 24 horas.
- No hay pgTAP ni tests de base.

---

## Fase 1 — Diseño

### Convenciones

Identificadores SQL en inglés, comentarios en español — igual que
`20260728065437_restringir_signup_a_utec.sql`. Nombres de archivo de migración en español,
igual que el historial.

### Modelo de datos

```sql
-- Catálogo de FR-017. Lo lee el selector de carrera; `faculty` solo agrupa
-- visualmente y nunca acompaña a una reseña.
create table public.careers (
  slug     text primary key,
  name     text not null,
  faculty  text not null,
  is_active boolean not null default true
);

-- Perfil del estudiante. La llave es `sub`, nunca el correo. Cae con la cuenta:
-- carrera y ciclo no sobreviven a una baja.
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  career_slug text references public.careers(slug),
  term        smallint check (term between 1 and 10),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Sanciones (FR-049, FR-056, FR-057). Por correo y NO por `sub`, y fuera de
-- `profiles`, porque es lo único que la política de privacidad promete conservar
-- cuando el usuario elimina su cuenta. Ver la decisión D3.
create table public.bans (
  email      text primary key check (email = lower(email)),
  -- Un baneo sin motivo dejaría a FR-057 sin qué mostrar.
  reason     text not null,
  created_at timestamptz not null default now()
);

-- La oferta vigente, materializada. Es la lista blanca de pares reseñables.
-- `is_current` en vez de borrar: una reseña de un par que sale de la oferta se
-- conserva y deja de mostrarse (Dependencies del spec), pero su FK sigue viva.
create table public.course_teachers (
  course_code   text not null,
  teacher_email text not null check (teacher_email = lower(teacher_email)),
  teacher_name  text not null,
  is_current    boolean not null default true,
  primary key (course_code, teacher_email)
);

create type public.review_state as enum ('active', 'deleted_by_author', 'removed_by_moderation');

create table public.reviews (
  id                   uuid primary key default gen_random_uuid(),
  -- Anulable y `set null`, no `cascade`: al eliminar la cuenta la reseña ya está
  -- en estado eliminado esperando su purga de 30 días, y cortar el vínculo con
  -- la cuenta es justo lo que la política promete. Con `cascade` la fila
  -- desaparecería el mismo día y la ventana de 30 días sería inaplicable.
  author_id            uuid references auth.users(id) on delete set null,
  course_code          text not null,
  teacher_email        text not null,
  rating               smallint not null check (rating between 1 and 5),
  -- FR-061: obligatoria. `not null` sin default es todo lo que hace falta —
  -- "sin valor preseleccionado" es del formulario, no de la columna.
  recommends           boolean not null,
  comment              text check (comment is null or length(comment) between 1 and 500),
  -- FR-021: la declaración es el único respaldo que existe de que llevó el curso.
  -- Se guarda para que la moderación pueda apoyarse en ella.
  declared_attendance  boolean not null check (declared_attendance),
  state                public.review_state not null default 'active',
  published_at         timestamptz not null default now(),
  comment_published_at timestamptz,
  comment_edited_at    timestamptz,
  updated_at           timestamptz not null default now(),
  -- Se sella al salir de 'active'. La purga de 30 días de la política de
  -- privacidad barre por esta columna.
  purge_after          timestamptz,
  -- Una reseña activa siempre tiene autor; solo las que esperan purga pueden
  -- haberlo perdido.
  constraint active_has_author check (state <> 'active' or author_id is not null),
  foreign key (course_code, teacher_email)
    references public.course_teachers (course_code, teacher_email)
);

-- FR-027: como máximo una reseña activa por par. Parcial, para que las
-- eliminadas no bloqueen volver a reseñar.
create unique index reviews_one_active_per_pair
  on public.reviews (author_id, course_code, teacher_email)
  where state = 'active';

-- El resumen se agrupa por par; el filtro de las políticas es por autor.
create index reviews_by_pair on public.reviews (course_code, teacher_email) where state = 'active';
create index reviews_by_author_recent on public.reviews (author_id, published_at desc);

create type public.report_reason as enum
  ('insult', 'false_content', 'personal_data', 'not_an_experience', 'spam', 'other');
create type public.report_status as enum ('pending', 'kept', 'removed');

create table public.review_reports (
  id          uuid primary key default gen_random_uuid(),
  review_id   uuid not null references public.reviews(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason      public.report_reason not null,
  details     text,
  status      public.report_status not null default 'pending',
  created_at  timestamptz not null default now(),
  resolved_at timestamptz,
  -- FR-045
  unique (review_id, reporter_id),
  -- FR-044
  constraint other_needs_details check (reason <> 'other' or nullif(btrim(details), '') is not null)
);
```

**Mapeo a Key Entities del spec**: *Estudiante UTEC* → `profiles`; *Docente* y
*Combinación docente–curso* → `course_teachers`; *Reseña* → `reviews`; *Reporte* →
`review_reports`; *Sanción* → `bans`; *Resumen de reseñas* → la vista de abajo, derivada,
no persistida.

**Qué se borra con la cuenta y qué no.** Es la línea que decide la mitad de las llaves
foráneas de arriba, y viene de la política de privacidad, no de la conveniencia del
esquema:

| Al eliminar la cuenta | Qué pasa | Por qué |
|---|---|---|
| `profiles` | se borra (`cascade`) | Carrera y ciclo no tienen por qué sobrevivir |
| `review_reports` que emitió | se borran (`cascade`) | Es su actividad, no la de otro |
| `reviews` | **quedan**, sin `author_id`, y se purgan a los 30 días | La política promete esa ventana y la usa para resolver reportes abiertos |
| `bans` | **queda**, indefinidamente | Es la única excepción declarada. Sin ella un baneo permanente se esquiva borrando la cuenta |

### Resúmenes públicos

```sql
create view public.teacher_course_summaries as
select
  course_code,
  teacher_email,
  round(avg(rating)::numeric, 1) as average_rating,
  count(*)                       as rating_count,
  count(comment)                 as comment_count,
  -- FR-059: proporción de `Sí` sobre el total de reseñas activas, entero. El
  -- denominador es count(*) y no un filtro aparte porque la recomendación es
  -- obligatoria: coincide siempre con rating_count. No puede ser cero — un
  -- grupo existe solo si tiene al menos una fila.
  round(100.0 * count(*) filter (where recommends) / count(*))::int
                                 as recommend_percentage
from public.reviews
where state = 'active'
group by course_code, teacher_email;

grant select on public.teacher_course_summaries to anon, authenticated;
```

Tres cosas que esta vista resuelve de una vez:

- **FR-008 sin abrir `reviews`**: la vista corre con los permisos de su dueño, así que
  `anon` obtiene agregados sin que exista ninguna política de select sobre `reviews` para
  `anon`. No hay fila que filtrar porque no hay fila que devolver.
- **SC-005 (sin ventana de datos viejos)**: es una vista normal, no materializada. Un
  `insert` se ve en la consulta siguiente. Con 619 pares y miles de filas el agregado es
  irrelevante en costo; materializarla solo agregaría el desfase que SC-005 prohíbe.
- **FR-003, FR-005, FR-006, FR-058, FR-059, FR-060**: promedio con un decimal, conteo de
  puntuaciones sobre todas las activas, conteo de comentarios solo sobre las que tienen
  texto (`count(comment)` ignora nulos) y porcentaje entero de recomendación. Las seis
  salen de la misma vista y por lo tanto de la misma consulta: FR-060 (porcentaje visible
  sin sesión) no cuesta nada porque no hay dónde separarlo del promedio.

`get_advisors` va a marcarla como `security_definer_view`. Es deliberado y es el punto en
el que hay que ser explícito: la vista **solo** expone agregados que el spec declara
públicos. Queda anotado en la migración para que nadie la "arregle" activando
`security_invoker` y rompa el acceso anónimo.

> **Fuga conocida y aceptada**: con `rating_count = 1`, el promedio revela la puntuación
> de esa única reseña y el porcentaje —que solo puede ser 0 o 100— revela su
> recomendación. Ambas son información pública por diseño (FR-008, FR-060) y el edge case
> *Promedio con una sola puntuación* ya obliga a mostrar el conteo al lado. FR-059
> descartó explícitamente el umbral mínimo, así que no hay nada que ajustar acá.

#### La recomendación no agrega estructura

FR-063 exige que unicidad, límite de publicación, edición, eliminación, moderación y
sanción se apliquen igual a la recomendación que a la puntuación. **Se cumple sin escribir
una sola regla nueva**: es una columna de `reviews`, no una fila propia. El índice único
parcial, el trigger del límite de 24 horas, las políticas de update y `moderation_ban`
operan sobre la fila entera y arrastran la recomendación con ella. Que el porcentaje se
recalcule "en los mismos momentos que el promedio" es literal — salen del mismo `group by`.

Esto es también lo que hace barato el supuesto que dejaste anotado: si la métrica resulta
redundante frente al promedio, retirarla es **una columna y una expresión de la vista**, no
una migración de datos. Para decidirlo con datos propios y no con la correlación de ~0.83
del referente, el `docs/moderacion.md` del PR 7 lleva la consulta:

```sql
-- Correlación entre puntuación y recomendación sobre datos propios.
select corr(rating, recommends::int::float8), count(*)
from public.reviews where state = 'active';
```

### Los comentarios también salen por una vista

La política de privacidad promete que junto a una reseña *"nunca se muestra tu nombre, tu
correo, tu carrera, tu ciclo, **ni ningún identificador que permita saber que esa reseña es
tuya**"*. Esa última frase es la que decide el diseño, porque **RLS filtra filas, no
columnas**: si un estudiante autenticado puede leer la fila de un comentario ajeno, un
`select *` por PostgREST le devuelve `author_id`. Un `uuid` estable por autor
desanonimiza la lista entera —agrupas por él y sabes qué comentarios son de la misma
persona—, y basta que alguien publique un comentario reconocible una vez para ponerle
nombre a ese `uuid`.

Revocar la columna no sirve: en Postgres, filtrar por `author_id` exige privilegio de
select sobre `author_id`, así que el autor perdería la consulta de su propia reseña. La
salida es la misma que para los resúmenes — una segunda vista:

```sql
create view public.review_comments as
select r.id, r.course_code, r.teacher_email,
       r.rating, r.recommends, r.comment,
       r.comment_published_at, r.comment_edited_at
from public.reviews r
where r.state = 'active'
  and r.comment is not null                    -- FR-036: sin elementos vacíos
  and not public.is_banned()                   -- FR-049
  -- FR-046: oculta para quien la reportó, visible para el resto.
  and not exists (
    select 1 from public.review_reports rp
    where rp.review_id = r.id
      and rp.reporter_id = (select auth.uid())
      and rp.status = 'pending'
  );

-- FR-013: leer comentarios exige sesión. Lo impone el grant, no un `where`.
grant select on public.review_comments to authenticated;
```

`author_id` no está en la lista de columnas, y esa lista es la única forma de leer un
comentario ajeno. La tabla queda cerrada a filas propias:

```sql
create policy "cada quien ve sus propias reseñas" on public.reviews
  for select to authenticated
  using (author_id = (select auth.uid()) and not public.is_banned());
```

Queda un patrón único para toda la lectura: **dos vistas y ninguna política de select
sobre `reviews` que no sea la fila propia.** `teacher_course_summaries` para `anon` y
`authenticated`, `review_comments` solo para `authenticated`.

### RLS

```sql
alter table public.profiles        enable row level security;
alter table public.reviews         enable row level security;
alter table public.review_reports  enable row level security;
alter table public.course_teachers enable row level security;
alter table public.careers         enable row level security;
alter table public.bans            enable row level security;

-- Catálogos: lectura pública, escritura solo por service_role (sin política).
create policy "careers son públicas" on public.careers
  for select to anon, authenticated using (true);
create policy "la oferta vigente es pública" on public.course_teachers
  for select to anon, authenticated using (is_current);

-- `(select auth.uid())` y no `auth.uid()`: así el planner lo evalúa una vez por
-- consulta y no una vez por fila.
create or replace function public.is_banned() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.bans
    where email = lower((select auth.jwt() ->> 'email'))
  );
$$;

create policy "cada quien ve su perfil" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "cada quien edita su perfil" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) and not public.is_banned())
  with check (id = (select auth.uid()));

-- El baneado TIENE que poder leer su propia sanción: de ahí sale el motivo que
-- FR-057 exige mostrarle. Nadie ve la de nadie más.
create policy "cada quien ve su sanción" on public.bans
  for select to authenticated
  using (email = lower((select auth.jwt() ->> 'email')));

-- La única política de select sobre `reviews`: la fila propia. Los comentarios
-- ajenos se leen por `review_comments`, que no expone `author_id`.
create policy "cada quien ve sus propias reseñas" on public.reviews
  for select to authenticated
  using (author_id = (select auth.uid()) and not public.is_banned());

create policy "publicar reseñas propias" on public.reviews
  for insert to authenticated with check (
    author_id = (select auth.uid()) and state = 'active' and not public.is_banned()
  );

-- FR-037/FR-048: una reseña eliminada por moderación no vuelve. `using` mira la
-- fila vieja, así que exigir state='active' ahí es lo que cierra la puerta.
create policy "editar la reseña propia activa" on public.reviews
  for update to authenticated
  using (author_id = (select auth.uid()) and state = 'active' and not public.is_banned())
  with check (author_id = (select auth.uid()) and state in ('active', 'deleted_by_author'));

create policy "reportar" on public.review_reports
  for insert to authenticated with check (
    reporter_id = (select auth.uid()) and not public.is_banned()
  );
create policy "ver los reportes propios" on public.review_reports
  for select to authenticated using (reporter_id = (select auth.uid()));
```

**No hay política de `delete` sobre `reviews`.** Eliminar es un `update` a
`deleted_by_author` (FR-039, FR-040): la política de privacidad promete 30 días de
retención antes del borrado real y el edge case *Límite de publicación* exige que borrar
no libere cupo. Un `delete` físico incumpliría las dos cosas.

### Lo que RLS no puede sostener

RLS decide sobre filas; estas reglas cuentan, comparan contra otra tabla o dependen del
estado anterior. Van en triggers, que es lo que las vuelve inevadibles aunque el cliente
hable PostgREST directo:

| Trigger | Momento | FR | Qué impone |
|---|---|---|---|
| `handle_new_user` | `after insert on auth.users` | — | Crea el `profiles` del usuario, para que el formulario de perfil siempre tenga fila que actualizar |
| `normalize_review` | `before insert/update on reviews` | edge case | `comment := nullif(btrim(comment), '')`. Un comentario de solo espacios es una reseña sin comentario |
| `enforce_current_pair` | `before insert on reviews` | FR-028 | El par tiene que estar en `course_teachers` **y** `is_current` |
| `enforce_daily_rating_limit` | `before insert on reviews` | FR-030 | ≤ 8 filas creadas por el autor en 24 h, **contando las eliminadas**. Levanta un error con el instante de liberación para FR-031 |
| `enforce_comment_profile` | `before insert/update on reviews` | FR-017 | Si `comment is not null`, el perfil tiene que tener `career_slug` y `term` |
| `stamp_review_timestamps` | `before update on reviews` | FR-055, FR-033 | Primera vez que `comment` deja de ser nulo → `comment_published_at`. Cambio de texto con `comment_published_at` ya puesto → `comment_edited_at`. `published_at` nunca se toca |
| `stamp_purge_after` | `before update on reviews` | privacidad | Al salir de `active`, `purge_after := now() + interval '30 days'` |
| `enforce_reportable` | `before insert on review_reports` | FR-042, FR-052 | Solo se reporta una reseña activa **con comentario** |

**FR-025 (compromiso de respeto) no se persiste**: es una confirmación por publicación, no
un consentimiento con historia. Se impone en el formulario. Si en el review quieres
trazabilidad, es una columna más y un check — dilo y entra.

### Moderación sin consola (FR-051)

Tres funciones `security definer` con `execute` solo para `service_role`, invocadas desde
Studio. Son las tres decisiones de FR-047, ni una más:

```sql
public.moderation_keep(report_id uuid)                -- FR-033 escenario: se mantiene
public.moderation_remove(report_id uuid)              -- FR-048
public.moderation_ban(report_id uuid, reason text)    -- FR-056: elimina TODAS las reseñas del autor
public.delete_account(user_id uuid)                   -- baja a pedido, política de privacidad
```

`moderation_ban` hace las dos cosas en una transacción: inserta en `bans` el correo del
autor con su motivo y pasa a `removed_by_moderation` **todas** sus reseñas activas. Que
sea una sola función es lo que evita que FR-056 se cumpla a medias un martes a las once de
la noche.

`delete_account` es la contraparte y también tiene que ser una sola transacción, en este
orden: soft-delete de las reseñas (que sella `purge_after`), y recién después el borrado
del usuario en `auth.users`. Al revés, el `set null` del FK dejaría reseñas sin autor pero
sin `purge_after`, y nunca las barrería la purga. La política de privacidad dice que la
baja *"se hace a mano"*; esta función es esa mano.

Acompaña un `docs/moderacion.md` con la consulta de bandeja de reportes pendientes, la
consulta de SC-009 (pares con al menos una puntuación, estudiantes únicos que
contribuyeron) y el procedimiento de baja de cuenta.

### Purga de 30 días

`pg_cron` diario → `public.purge_expired_reviews()`: borra físicamente las filas con
`purge_after < now()`. Es la condición 2 de publicación de
[politica-privacidad.md](politica-privacidad.md): mientras no exista, el documento promete
un borrado que no ocurre. **La sanción es la única excepción** y sobrevive porque `bans`
no cuelga de `auth.users`: ni la purga ni la baja de cuenta la alcanzan.

### El baneo también cierra el registro

Bloquear a un usuario baneado en RLS no alcanza si puede eliminar su cuenta, volver a
entrar con el mismo correo institucional y aparecer como alguien nuevo. El cierre va donde
ya existe la puerta: el hook `Before User Created` de
`20260728065437_restringir_signup_a_utec.sql` gana una segunda condición —además del
dominio, rechaza los correos presentes en `bans`—. Es una migración que reemplaza esa
función, no una tabla ni un endpoint nuevo.

### Contratos de cliente

Todo pasa por `@supabase/ssr` con la publishable key. No se agregan route handlers: RLS y
los triggers ya son la autoridad, y una ruta intermedia solo duplicaría la superficie.

| Operación | Llamada | Sesión |
|---|---|---|
| Resumen de un curso | `from('teacher_course_summaries').select().eq('course_code', …)` | No |
| Catálogo de carreras | `from('careers').select().eq('is_active', true)` | No |
| Comentarios de un par | `from('review_comments').select().eq(…).order('comment_published_at', {ascending:false})` | Sí |
| Mi reseña del par | `from('reviews').select().eq('author_id', …)` — única lectura contra la tabla | Sí |
| Publicar / editar / eliminar | `insert` / `update` sobre `reviews` | Sí |
| Reportar | `insert` sobre `review_reports` | Sí |
| Perfil | `select` / `update` sobre `profiles` | Sí |

El resumen se pide **por curso al desplegarlo**, no par por par: una consulta trae los
docentes de todas las secciones y se cachea en memoria mientras dure la pestaña.

### Estructura de archivos

```
supabase/migrations/
  NNNN_crear_esquema_de_resenas.sql       # tablas, enums, índices
  NNNN_politicas_de_resenas.sql           # RLS + is_banned()
  NNNN_reglas_de_resenas.sql              # triggers
  NNNN_vistas_publicas.sql                # teacher_course_summaries + review_comments
  NNNN_funciones_de_moderacion.sql        # + delete_account
  NNNN_bloquear_signup_de_baneados.sql    # reemplaza el hook de dominio
  NNNN_purga_de_resenas_eliminadas.sql    # pg_cron
  NNNN_catalogo_de_carreras.sql           # las 16 de carreras-utec.md
  NNNN_oferta_2026_2.sql                  # generada: upsert de course_teachers
supabase/tests/
  resenas_rls.test.sql                    # pgTAP
src/lib/
  teacher-email.ts        # normalizador compartido (parse-pdf + generador de oferta + tests)
  reviews.ts              # consultas y mutaciones; sin JSX
  review-format.ts        # promedio, porcentaje, plurales, "editado", texto del límite
  careers.ts              # tipos del catálogo
src/components/reviews/
  TeacherSummary.tsx      # estrellas + % recomienda + conteos + "Sin puntuaciones" / "Docente por asignar"
  ReviewsPanel.tsx        # detalle: lista, formulario, reportar
  ReviewForm.tsx          # estrellas, recomendación sin preseleccionar (FR-061), comentario
  ReportDialog.tsx
src/components/
  SessionMenu.tsx         # iniciar/cerrar sesión — no existe hoy
  ProfileForm.tsx         # carrera + ciclo
src/app/
  normas/page.tsx         # normas-comunidad.md
  privacidad/page.tsx     # politica-privacidad.md
  perfil/page.tsx
scripts/
  generate-offer-migration.js
```

La regla que ordena el reparto: **la lógica va a `src/lib/`, los `.tsx` quedan finos**.
No es estética — es lo único que mantiene el trinquete de coverage arriba (ver [R1](#r1-el-trinquete-de-coverage-bloquea-el-ci)).

---

## Reconciliación con las políticas publicadas

[politica-privacidad.md](politica-privacidad.md) y [normas-comunidad.md](normas-comunidad.md)
son promesas al usuario, así que se leen como requisitos y no como documentación. Lo que
sostiene el diseño de arriba:

| Promesa | Qué la sostiene |
|---|---|
| *"Nunca se muestra… ningún identificador que permita saber que esa reseña es tuya"* | `review_comments` no expone `author_id`; la tabla solo devuelve la fila propia |
| *"Esa reseña deja de aparecerte a ti… sigue visible para el resto"* | El `not exists` sobre reportes `pending`, dentro de la vista |
| *"Una reseña eliminada se conserva 30 días"* | `state` + `purge_after`, sin `delete` físico y sin política de `delete` |
| *"…y para que borrar y volver a publicar no sirva para saltarse el límite"* | El trigger de las 24 h cuenta filas creadas, no filas activas |
| *"Se eliminan también todas tus reseñas"* (baja de cuenta) | `delete_account`, en ese orden y en una transacción |
| *"El registro de la sanción se conserva… aunque pidas eliminar tu cuenta"* | `bans` no cuelga de `auth.users` |
| *"Conservas lo que ve cualquier visitante"* (baneado) | `is_banned()` no toca `teacher_course_summaries` |
| *"Puedes reportar cada reseña una sola vez"* | `unique (review_id, reporter_id)` |
| *"La eliminación es definitiva: ni siquiera su autor puede recuperarla"* | El `using` de la política de update exige `state = 'active'` |

### Lo que las políticas tienen que decir y todavía no dicen

Tres huecos, y los tres los abrió el commit de la recomendación o el diseño de la sanción.
Son cambios a un documento que le hace promesas al usuario, así que van con tu visto bueno,
no de oficio:

1. **La recomendación no está en la política.** *"Si publicas una reseña"* enumera
   *"tu puntuación, tu comentario… y las fechas"*. Ahora también se guarda tu respuesta a
   la recomendación. Y *"Qué es público y qué no"* dice que junto a un comentario se ven
   *"las estrellas, el texto, la fecha"*: FR-035 agregó la recomendación a esa lista. Un
   dato que se guarda y se publica sin figurar en la política es exactamente lo que la
   política existe para evitar.
2. **La declaración de experiencia tampoco.** `declared_attendance` se persiste (FR-021,
   para que la moderación pueda apoyarse en ella) y no aparece en el enumerado.
3. **La sanción se guarda por correo.** El documento dice que conserva *"tu cuenta, el
   motivo y la fecha"*. Con D3 lo que se conserva indefinidamente es tu **correo
   institucional** — un dato personal, no un identificador interno. Decirlo con esa
   palabra es la diferencia entre informar y dar por informado.

### Un matiz que el diseño cambia

*"Si nunca inicias sesión: nada tuyo sale de tu navegador"* deja de ser exacto. Para pintar
los resúmenes, el navegador de un visitante sin sesión le pregunta a Supabase por los
cursos que despliega. No se guarda nada nuestro sobre él, pero la frase, tal como está
escrita, promete más que eso.

El diseño ya elige la variante mínima —una consulta por curso al desplegarlo, no la lista
completa de cursos seleccionados de una vez (D1)—, así que lo que viaja es el curso que el
visitante está mirando, no su horario armado. Eso es lo que hay que decir.

---

## Fase 2 — Entrega

CONTRIBUTING pide spec e implementación en un PR. Acá no se puede: son ~15 archivos
nuevos, 8 migraciones y el primer esquema de la app. Un PR único no se revisa, se aprueba
por cansancio. La propuesta es **una rama por PR, todas con `Refs #<issue>`**, y que el
spec (ya commiteado en esta rama) entre con el primero.

| PR | Contenido | Gate |
|---|---|---|
| **1. Producto** | Esta rama tal cual: spec, normas, privacidad, carreras, plan | Tu revisión de la política de privacidad |
| **2. Normalizar el correo del docente** | `src/lib/teacher-email.ts`, `parse-pdf.js`, `courses.json` regenerado, invariante en `tests/courses-data.test.ts` | El diff de `courses.json` toca 360 sesiones: hay que mirarlo |
| **3. Esquema y políticas** | Tablas, RLS, triggers, vistas, catálogo de carreras, generador de oferta, test de paridad JSON↔migración (D5), pgTAP, job de CI con Supabase | Sin UI. `get_advisors` limpio salvo las vistas |
| **4. Resúmenes públicos** | `TeacherSummary` en `SectionSelector`, % de recomendación, `Sin puntuaciones`, `Docente por asignar` | Escenarios 1–7. Funciona sin sesión y sin env |
| **5. Sesión y perfil** | `SessionMenu`, `/perfil`, carrera y ciclo | Escenarios 8–12 |
| **6. Publicar, editar, eliminar** | `ReviewsPanel`, `ReviewForm`, detalle de comentarios | Escenarios 13–28 y 37 |
| **7. Reportes y moderación** | `ReportDialog`, funciones de moderación, hook de signup con `bans`, `docs/moderacion.md` | Escenarios 29–36 |
| **8. Páginas legales y purga** | `/normas`, `/privacidad`, pg_cron, `delete_account` | Las tres condiciones de la política |

Los PR 4 a 7 son secuenciales por dependencia real, no por gusto. El 2 y el 3 son
independientes entre sí y pueden ir en paralelo.

**`bans` entra en el PR 3, no en el 7**, aunque nadie sancione a nadie hasta el 7:
`is_banned()` la consulta desde las políticas de lectura y publicación. Una tabla vacía en
el PR 3 es más barata que reescribir cuatro políticas en el 7.

**El PR 4 se puede mergear y deployar solo**: muestra `Sin puntuaciones` en todos lados
porque no hay reseñas todavía. Es feo pero es honesto, y es la única forma de partir la
feature en algo desplegable antes del final.

---

## Decisiones que se apartan de lo acordado

### D1. Los resúmenes se leen desde el cliente, no desde un Server Component

En la ronda de decisiones elegiste *"Server Component + vista agregada"*. Mantengo la
vista agregada y **propongo revertir la parte del Server Component**, por una razón que
no vi entonces: los cursos cuyos resúmenes hacen falta salen de `localStorage` y de qué
curso despliega el usuario. Un Server Component no puede saberlos sin meterlos en la URL,
y meterlos en la URL cambia el modelo de estado de toda la app — que es exactamente lo
que FR-012 y SC-001 piden no tocar.

Convertir `page.tsx` (473 líneas, `useSyncExternalStore` sobre `localStorage`) en un shell
de servidor sería el cambio más grande de la feature y no compraría nada: la primera
pintura seguiría sin resúmenes hasta que el navegador diga qué cursos hay.

**Propuesta**: consulta desde el cliente, por curso, al desplegarlo. Si prefieres el
Server Component, la vía realista es llevar la selección a la URL — y eso es otra feature.

### D2. La fecha visible de un comentario es la del comentario

FR-035 pide "la fecha de publicación" y FR-033 dice que es la de publicación de la reseña.
Cuando alguien puntúa en marzo y agrega el comentario en julio, mostrar marzo desinforma.
El diseño guarda `comment_published_at` aparte y **es esa la que se muestra en la lista de
comentarios**. `published_at` sigue siendo la de la reseña y la que gobierna el límite de
FR-030. El spec no distingue los dos casos; esto lo resuelve sin contradecirlo.

### D3. La sanción se guarda por correo, no por `sub`

Es la que más roza una decisión ya tomada: `docs/auth.md` fija que *"la llave de usuario
es `sub`, nunca el correo"*, y lo aplica explícitamente a la futura tabla `profiles`.
Mantengo eso — `profiles.id` es `sub`. Pero **la sanción no puede serlo**, y el motivo lo
escribe la propia política de privacidad: *"sin ese registro una expulsión permanente no
sería permanente: bastaría con borrar la cuenta y volver a entrar"*.

Un `sub` deja de existir cuando se elimina la cuenta. Guardar la sanción contra `sub` es
guardarla contra el identificador que la persona puede hacer desaparecer a pedido. El
correo institucional es lo único que sobrevive a esa baja, y es además el identificador
sobre el que ya opera el hook de signup.

El argumento de `docs/auth.md` para no usar el correo es que Google avisa que puede cambiar
y no es único. En un Workspace institucional cerrado —una allowlist de un solo dominio, sin
subdominios— ese riesgo es mucho menor, y la alternativa es peor: un baneo evadible.

**Si no te convence**, la salida es no eliminar nunca la fila de `auth.users` en una baja
de cuenta y anonimizarla en su lugar. Eso conserva el `sub`, pero convierte "eliminamos tu
cuenta" en una promesa que habría que reescribir en la política de privacidad.

### D4. La oferta se refresca por migración generada, no por script contra producción

Un `pnpm generate-offer` que emite `NNNN_oferta_AAAA_C.sql` con el upsert y el
`is_current = false` de los pares que salieron. Cuesta un archivo por actualización —no
dos al año, ver [R6](#r6-la-oferta-cambia-dentro-del-ciclo-y-eso-apaga-reseñas)— y a cambio
el cambio de oferta queda versionado y revisable, sin necesitar la service key fuera del
CI. La alternativa —un script con service role— es menos archivos y más superficie.

### D5. El catálogo se queda en `courses.json`; Postgres solo proyecta los pares

`courses.json` son 862 KB en disco, 495 KB minificado y **~38 KB gzipeados**: 445 cursos,
777 secciones, 1821 sesiones, que entran enteros al bundle porque `page.tsx` lo importa en
scope de módulo. La cifra que suele decidir esta discusión —el tamaño en disco— no es la
que viaja.

Llevar el catálogo a Postgres saca del loop de actualización **el `git commit` y unos tres
minutos de deploy**. No saca el parseo del PDF y no avisa antes de que UTEC publique un
cambio, que es donde se va el tiempo de verdad. A cambio se pierden cuatro cosas concretas:

- **El golden test** (`tests/parse-pdf.test.ts`), que compara el PDF contra el JSON
  commiteado. Hoy un parseo malo rompe el CI; en base de datos lo descubre un alumno en
  matrícula.
- **Las invariantes** de `tests/courses-data.test.ts`.
- **El diff revisable.** El PR 2 se revisa mirando las 360 sesiones con correo corrupto.
  Sin archivo no hay diff.
- **La garantía de `docs/auth.md`**: *"sin variables de entorno la app corre igual"*, con
  un job `build` en CI sin secretos. Hoy armar el horario sobrevive a que Supabase esté
  caído; las reseñas pueden degradar, el horario no.

**Decisión**: `courses.json` sigue siendo la fuente de verdad del armador de horarios;
Postgres recibe solo `course_teachers`, que es lo que las reseñas necesitan como llave
foránea.

El único costo real de quedarse es el **drift** entre el JSON y la tabla proyectada: si
alguien regenera el JSON y olvida la migración, la UI ofrece reseñar un par que la FK
rechaza. No se arregla con arquitectura sino con un test, del mismo tipo que el repo ya
usa: en el PR 3, un vitest que lea la última migración de oferta generada y compare su
conjunto de pares contra `courses.json`. Si difieren, falla el CI.

**Qué lo revisaría**: que haga falta `enrolled` en vivo (hoy es 0 en todo el JSON) o una
feature que consulte el catálogo entero del lado servidor —hoy todas en los Non-Goals—. La
frecuencia de cambio por sí sola no basta: es justo lo que R6 describe, y se resuelve con
`pnpm diff-oferta`, no con una migración de arquitectura.

---

## Riesgos

### R1. El trinquete de coverage bloquea el CI

El piso actual es `lines 27.02 / statements 26.69 / functions 24.68 / branches 16.3`, y es
un piso sobre **porcentajes**. Los componentes React están en 0% y no hay jsdom ni
testing-library. Sumar ~1500 líneas de `.tsx` sin tests hunde los cuatro números y el CI
falla — no en el PR 7, sino en el 4.

Tres salidas, en orden de preferencia:

1. **Lógica en `src/lib/`, `.tsx` finos.** `review-format.ts`, `reviews.ts` y
   `teacher-email.ts` son node-testables y suman cobertura que compensa el JSX nuevo.
2. **Montar jsdom + testing-library** en el PR 4. Es la solución de fondo y hay que
   hacerla algún día; hacerla acá suma un PR de tooling antes de empezar.
3. Bajar el trinquete a mano. Es lo que el trinquete existe para impedir.

Voy con la 1 y con la 2 si la 1 no alcanza. Hay que medirlo en el PR 4, no suponerlo.

### R2. RLS es la única frontera

Si el cliente habla PostgREST directo, un error en una política es una fuga de datos, no
un bug de UI. Por eso el pgTAP del PR 3 **no es opcional**: tiene que probar, como mínimo,
que `anon` no lee ni una fila de `reviews`, **que un autenticado tampoco lee la fila de la
reseña de otro** —solo su comentario por la vista, sin `author_id`—, que un usuario no ve
la reseña que reportó, que un baneado no lee nada pero sí su propio motivo, y que nadie
edita la reseña de otro. Si el pgTAP se corta por tiempo, lo que se está decidiendo es
shippear RLS sin probar.

El segundo de esos casos es el que más fácil se rompe sin que nadie lo note: la UI se ve
idéntica con `author_id` expuesto o no.

### R3. El CI hoy no levanta Supabase

El PR 3 agrega un job que corre `supabase start` + `supabase test db`. Suma varios minutos
al pipeline y una dependencia nueva (la CLI) en el runner. Es el costo de R2.

### R4. Arranque en frío

Al deployar no hay ni una reseña: 619 pares en `Sin puntuaciones`. SC-009 existe para
medirlo y los Non-Goals descartan campañas e incentivos. El plan no lo resuelve — solo
deja la consulta lista para que se vea.

### R5. Dependencias externas sin cerrar

`privacidad@mail.luismaquera.dev` tiene que recibir correo antes del PR 8, y
`pg_cron` tiene que estar habilitado en el proyecto. Ninguna de las dos es código.

### R6. La oferta cambia dentro del ciclo, y eso apaga reseñas

El spec asumía una oferta estable durante el ciclo. No lo es: hay cambios de horario y de
docente en plena matrícula.

Los dos tipos no pesan igual. **Un cambio de horario no toca las reseñas**: una reseña está
anclada a `(curso, correo del docente)`, no a la sección ni al bloque horario. **Un cambio
de docente sí**: ese par sale de la oferta, `is_current` pasa a `false` y sus reseñas dejan
de mostrarse. Un docente reemplazado se lleva sus reseñas de la pantalla justo cuando más
se consultan.

Es la consecuencia que el spec ya aceptó —*"las reseñas de un par que sale de la oferta
dejan de mostrarse"*—, pero aceptada bajo un supuesto más benigno del que resultó cierto.
Hay que reabrirla en el PR 4, con dos salidas: mostrar las reseñas de un par retirado en
solo lectura y con una nota, o mantener el apagado y dejarlo asumido por escrito.

Operativamente ya está cubierto: `pnpm diff-oferta` (`scripts/diff-oferta.js`) lista los
pares docente–curso que aparecen y desaparecen **antes** de sobreescribir `courses.json`.
Esa lista es el insumo del `is_current` y lo que distingue un cambio real de la oferta de
un correo mal parseado. La herramienta vive en la rama de actualización de datos, no en
esta.

---

## Complexity Tracking

| Complejidad que se agrega | Por qué se acepta | Alternativa descartada |
|---|---|---|
| Dos vistas con semántica de definer | Es la única forma de dar agregados a `anon` y comentarios anónimos a `authenticated` sin abrir `reviews`. RLS filtra filas, no columnas | Grants por columna sobre `reviews`: filtrar por `author_id` exige poder leerlo, así que el autor perdería su propia reseña |
| 8 triggers | Cada uno impone un FR que RLS no alcanza, con el cliente hablando PostgREST directo | Route handlers: duplicarían la regla y dejarían PostgREST abierto |
| `course_teachers` materializada | Sostiene FR-028, FR-053 y FR-054 en la base, no en el navegador | Validar el par contra `courses.json` en el cliente: evadible con un `insert` directo |
| `bans` como tabla aparte y por correo | Es lo único que sobrevive a la baja de cuenta que promete la política de privacidad (D3) | Columnas en `profiles`: caen con el `cascade` y el baneo se esquiva borrando la cuenta |
| pgTAP + job de CI nuevo | R2 | Confiar en revisión manual de políticas |
| 8 PRs | El esquema inicial de la app no cabe en un review honesto | PR único |

---

## Progress Tracking

- [x] Technical Context resuelto
- [x] Fase 0 — investigación de datos y del estado actual
- [x] Fase 1 — modelo de datos, RLS, triggers y contratos
- [x] Fase 2 — reparto en PRs
- [x] Riesgos identificados
- [ ] **Plan revisado y aprobado**
- [ ] D1 … D5 confirmadas o revertidas
- [ ] R6 reabierto en el PR 4: qué pasa con las reseñas de un docente reemplazado
- [ ] Los tres huecos de la política de privacidad, cerrados en el documento
- [ ] R1 medido en el PR 4
