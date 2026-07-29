# Implementation Plan: Reseñas de docentes por curso

**Feature Branch**: `002-resenas-docentes`
**Created**: 2026-07-28
**Estado**: Propuesta — requiere tu revisión antes de escribir código
**Spec**: [spec.md](spec.md) · 63 FR, 37 escenarios, SC-001..SC-009

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
2. **El acceso a datos pasa por route handlers** en `/api/*` (D6). Ordenan el código y dan
   dónde validar, pero la Data API queda alcanzable igual, así que **RLS y los triggers
   siguen siendo la frontera de seguridad**.
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
| `'use client'` solo donde hay estado o efectos | ✅ | Ver [D1](#d1-teacher_course_summaries-se-consulta-desde-el-cliente) |
| Tailwind con variante `dark:` | ✅ | Cubre el edge case *Modo claro y oscuro* |
| Texto de UI en español | ✅ | |
| Comentarios escasos, solo el *por qué* | ✅ | |
| La llave de usuario es `sub`, nunca el correo | ✅ | `profiles.id` → `auth.users(id)`, sanción incluida ([D3](#d3-baja-funcional-y-sanción-por-sub)). El correo del **docente** sí es llave, pero identifica la oferta, no una cuenta |
| Cliente de Supabase por request | ✅ | Se reusa `src/lib/supabase/{server,client}.ts` |
| `getClaims()`, no `getSession()` | ✅ | |
| Lint + build pasan | ⚠️ | El trinquete de coverage es el riesgo real, ver [R1](#r1-el-trinquete-de-coverage-bloquea-el-ci) |

---

## Estructura de la documentación

Spec-kit propone abrir `research.md`, `data-model.md`, `contracts/` y `quickstart.md`
junto al plan. Acá van **dentro de este archivo**: la carpeta ya tiene cuatro documentos
(spec, normas, privacidad, carreras) y el modelo de datos de esta feature son cinco tablas
y dos vistas. Partirlo en seis archivos más agrega navegación, no claridad. Si prefieres el
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

## Investigación

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

## Diseño

### Convenciones

Identificadores SQL en inglés, comentarios en español — igual que
`20260728065437_restringir_signup_a_utec.sql`. Nombres de archivo de migración en español,
igual que el historial.

### Modelo de datos

```sql
-- Catálogo de FR-017. Lo lee el selector de carrera; `faculty` solo agrupa
-- visualmente y nunca acompaña a una reseña. `slug` es la llave estable de
-- carreras-utec.md, y sirve para que la migración y el selector no dependan del
-- orden en que se generen los ids.
create table public.careers (
  id        uuid primary key default gen_random_uuid(),
  slug      text unique not null check (slug ~ '^[a-z0-9-]+$'),
  name      text not null,
  faculty   text not null,
  is_active boolean not null default true
);

-- Perfil del estudiante. La llave es `sub`, nunca el correo.
--
-- La sanción (FR-049, FR-056, FR-057) vive acá y no en una tabla aparte: la baja
-- de cuenta es funcional y la fila de auth.users nunca se borra, así que el
-- `sub` sobrevive y no hace falta anclar el baneo a nada más. Ver D3.
--
-- `restrict` y no `cascade`: con cascade, borrar la fila de auth.users se
-- llevaría el perfil y con él la sanción, que es justo lo que tiene que
-- sobrevivir. Un borrado manual falla en vez de dejar el baneo sin registro.
create table public.profiles (
  id             uuid primary key references auth.users(id) on delete restrict,
  career_id      uuid references public.careers(id),
  term           smallint check (term between 1 and 10),
  banned_at      timestamptz,
  ban_reason     text,
  deactivated_at timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  -- Un baneo sin motivo dejaría a FR-057 sin qué mostrar, y `''` o unos
  -- espacios son tan inútiles como un NULL: el check exige texto real.
  constraint ban_has_reason check (
    (banned_at is null and ban_reason is null)
    or (banned_at is not null and nullif(btrim(ban_reason), '') is not null)
  )
);

-- La oferta vigente, materializada. Es la lista blanca de pares reseñables.
-- `is_current` en vez de borrar: una reseña de un par que sale de la oferta se
-- conserva y deja de mostrarse (Dependencies del spec), pero su FK sigue viva.
--
-- El par (course_code, teacher_email) es la llave natural y queda como unique;
-- la que viaja por las FK es `id`, para que renombrar un correo mal parseado sea
-- un update de una fila y no una cascada por todas las reseñas.
create table public.course_teachers (
  id            uuid primary key default gen_random_uuid(),
  course_code   text not null,
  teacher_email text not null check (teacher_email = lower(teacher_email)),
  teacher_name  text not null,
  is_current    boolean not null default true,
  unique (course_code, teacher_email)
);

create type public.review_state as enum ('active', 'deleted_by_author', 'removed_by_moderation');

create table public.reviews (
  id                   uuid primary key default gen_random_uuid(),
  -- `restrict` y no `cascade`: la baja es funcional, así que borrar una fila de
  -- auth.users no es parte de ningún flujo. Si alguien lo intenta a mano desde
  -- Studio, Postgres se niega en vez de llevarse las reseñas por delante y
  -- anular la ventana de 30 días.
  author_id            uuid not null references auth.users(id) on delete restrict,
  course_teacher_id    uuid not null references public.course_teachers(id) on delete restrict,
  rating               smallint not null check (rating between 1 and 5),
  -- FR-061: obligatoria. `not null` sin default es todo lo que hace falta —
  -- "sin valor preseleccionado" es del formulario, no de la columna.
  recommends           boolean not null,
  comment              text check (comment is null or length(comment) between 1 and 500),
  -- FR-021: la declaración es el único respaldo que existe de que llevó el curso.
  -- Se guarda para que la moderación pueda apoyarse en ella.
  declared_attendance  boolean not null check (declared_attendance),
  -- FR-025. Se persiste porque la Data API sigue alcanzable (D6): sin esta
  -- columna, un insert directo por PostgREST publicaría un comentario sin haber
  -- pasado por el control. Borrar el comentario no la resetea.
  respect_acknowledged boolean not null default false,
  state                public.review_state not null default 'active',
  published_at         timestamptz not null default now(),
  comment_published_at timestamptz,
  comment_edited_at    timestamptz,
  updated_at           timestamptz not null default now(),
  -- Se sella al salir de 'active'. La purga de 30 días de la política de
  -- privacidad barre por esta columna.
  purge_after          timestamptz,
  constraint comment_needs_acknowledgement
    check (comment is null or respect_acknowledged)
);

-- FR-027: como máximo una reseña activa por par. Parcial, para que las
-- eliminadas no bloqueen volver a reseñar.
create unique index reviews_one_active_per_pair
  on public.reviews (author_id, course_teacher_id)
  where state = 'active';

create index reviews_by_pair on public.reviews (course_teacher_id) where state = 'active';
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
`review_reports`; *Sanción* → `profiles.banned_at` / `ban_reason`; *Resumen de reseñas* →
la vista de abajo, derivada, no persistida.

**Qué pasa en una baja de cuenta.** La baja es funcional (D3): el acceso se cierra y la
identidad se conserva para trazabilidad. Ninguna fila de `auth.users` se borra.

| Al dar de baja | Qué pasa | Por qué |
|---|---|---|
| Inicio de sesión | se bloquea (`auth.users.banned_until`) | Es lo que el usuario pidió: dejar de tener acceso |
| `reviews` | pasan a eliminadas y se purgan a los 30 días | La política promete esa ventana y la usa para resolver reportes abiertos |
| `profiles.career_id` y `term` | se limpian | Son datos personales sin valor de trazabilidad una vez cerrado el acceso |
| `profiles.id`, la fila de `auth.users` y la sanción si la hubo | **quedan** | Es la trazabilidad. Sin ella una expulsión permanente se esquiva pidiendo la baja y volviendo a registrarse |

### Resúmenes públicos

```sql
create view public.teacher_course_summaries as
select
  ct.id            as course_teacher_id,
  ct.course_code,
  ct.teacher_email,
  round(avg(r.rating)::numeric, 1) as average_rating,
  count(*)                         as rating_count,
  count(r.comment)                 as comment_count,
  -- FR-059: proporción de `Sí` sobre el total de reseñas activas, entero. El
  -- denominador es count(*) y no un filtro aparte porque la recomendación es
  -- obligatoria: coincide siempre con rating_count. No puede ser cero — un
  -- grupo existe solo si tiene al menos una fila.
  round(100.0 * count(*) filter (where r.recommends) / count(*))::int
                                   as recommend_percentage
from public.reviews r
join public.course_teachers ct on ct.id = r.course_teacher_id
-- `is_current` acá y no solo en la UI: un par que sale de la oferta deja de
-- mostrarse aunque conserve sus reseñas (Dependencies del spec).
where r.state = 'active' and ct.is_current
group by ct.id, ct.course_code, ct.teacher_email;

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

`get_advisors` va a marcarla como `security_definer_view`. Es deliberado: la vista **solo**
expone agregados que el spec declara públicos. Queda anotado en la migración, porque
activarle `security_invoker` rompe el acceso anónimo.

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
del referente, `docs/moderacion.md` lleva la consulta:

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
select r.id, r.course_teacher_id, ct.course_code, ct.teacher_email,
       r.rating, r.recommends, r.comment,
       r.comment_published_at, r.comment_edited_at
from public.reviews r
join public.course_teachers ct on ct.id = r.course_teacher_id
where r.state = 'active'
  and ct.is_current                            -- mismo recorte que el resumen
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

> **Corregido durante la implementación.** Este bloque describe el diseño acordado, pero
> la implementación encontró que le faltaban dos piezas sin las cuales no se sostiene.
> Están al final de la sección, en *[Lo que RLS por sí sola no cerró](#lo-que-rls-por-sí-sola-no-cerró)*:
> los privilegios de `reviews` van **por columna**, y eliminar la reseña propia **no puede
> ser un `update` directo**. Léelo antes de tomar este SQL como definitivo.

```sql
alter table public.profiles        enable row level security;
alter table public.reviews         enable row level security;
alter table public.review_reports  enable row level security;
alter table public.course_teachers enable row level security;
alter table public.careers         enable row level security;

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
    select 1 from public.profiles
    where id = (select auth.uid()) and banned_at is not null
  );
$$;

-- El baneado TIENE que poder leer su propio perfil: de ahí sale el motivo que
-- FR-057 exige mostrarle. Por eso esta política no consulta is_banned().
create policy "cada quien ve su perfil" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "cada quien edita su perfil" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) and not public.is_banned())
  with check (id = (select auth.uid()) and banned_at is null);

-- La única política de select sobre `reviews`: la fila propia. Los comentarios
-- ajenos se leen por `review_comments`, que no expone `author_id`.
-- `state = 'active'`: la política de privacidad dice que una reseña eliminada
-- "ya no la ve nadie" durante sus 30 días. Ni su autor. Las eliminadas quedan
-- solo para moderación y purga, que corren con service_role.
create policy "cada quien ve sus propias reseñas activas" on public.reviews
  for select to authenticated
  using (
    author_id = (select auth.uid())
    and state = 'active'
    and not public.is_banned()
  );

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

### Lo que RLS por sí sola no cerró

Dos cosas que el bloque de arriba daba por resueltas y no lo estaban. Las dos salieron de
correr el esquema, no de leerlo.

**1. Los privilegios de `reviews` tienen que ser por columna.** Con `grant select, insert,
update on public.reviews to authenticated`, un estudiante llega por la Data API y reescribe
`published_at` de sus ocho reseñas 48 horas atrás; la novena entra. Medido de punta a punta.
Por el lado del `insert` es peor: veinte filas antedatadas en un solo statement no tocan
ninguna ventana, y FR-030 deja de existir. También quedaban a su alcance `purge_after` —los
30 días de retención—, `comment_edited_at` —la marca `editado` de FR-055— y
`course_teacher_id`, que mueve una reseña a otro docente.

El `with check` de la política no puede cerrarlo, porque **RLS no ve la fila vieja**: no hay
forma de escribir "`published_at` no cambió". El mecanismo correcto es el privilegio por
columna, que es además lo que recomienda la documentación de Supabase para la Data API:

```sql
grant insert (author_id, course_teacher_id, rating, recommends, comment,
              declared_attendance, respect_acknowledged) on public.reviews to authenticated;
grant update (rating, recommends, comment, respect_acknowledged) on public.reviews to authenticated;
```

Un `grant` de más lo reabre en silencio, así que `supabase/tests/permisos.test.sql` fija la
lista exacta de columnas en las dos direcciones: las selladas y las editables.

**2. Eliminar la reseña propia no puede ser un `update`.** Postgres aplica la política de
`select` también a la fila **resultante** de un `update`. Como esa política exige
`state = 'active'`, la transición a `deleted_by_author` falla con *new row violates row-level
security policy*: **el autor no puede eliminar su reseña**. Relajar la política tampoco vale,
porque rompería la promesa de que durante los 30 días *"ya no la ve nadie"*, su autor incluido.

La salida es una función `security definer` que comprueba la propiedad ella misma. Va en
`public` y no en `private` porque tiene que ser alcanzable por la Data API:

```sql
public.delete_own_review(review_id uuid)   -- execute solo para authenticated
```

Con eso `state` sale del `grant update` por completo: el autor no lo toca nunca, ni para
eliminar ni para resucitar lo que moderación eliminó (FR-048). El `with check` de la política
de update se reduce a `state = 'active'`.

### Lo que RLS no puede sostener

RLS decide sobre filas; estas reglas cuentan, comparan contra otra tabla o dependen del
estado anterior. Van en triggers, que es lo que las vuelve inevadibles aunque el cliente
llegue por la Data API y no por código nuestro:

| Trigger | Momento | FR | Qué impone |
|---|---|---|---|
| `handle_new_user` | `after insert on auth.users` | — | Crea el `profiles` del usuario, para que el formulario de perfil siempre tenga fila que actualizar |
| `normalize_review` | `before insert/update on reviews` | edge case | `comment := nullif(btrim(comment), '')`. Un comentario de solo espacios es una reseña sin comentario |
| `enforce_current_pair` | `before insert on reviews` | FR-028 | La FK ya exige que el par exista; el trigger agrega que esté `is_current` |
| `enforce_daily_rating_limit` | `before insert on reviews` | FR-030 | ≤ 8 filas creadas por el autor en 24 h, **contando las eliminadas**. Levanta un error con el instante de liberación para FR-031 |
| `enforce_comment_profile` | `before insert/update on reviews` | FR-017 | Si `comment is not null`, el perfil tiene que tener `career_id` y `term` |
| `stamp_review_timestamps` | `before update on reviews` | FR-055, FR-033 | Primera vez que `comment` deja de ser nulo → `comment_published_at`. Cambio de texto con `comment_published_at` ya puesto → `comment_edited_at`. `published_at` nunca se toca |
| `stamp_purge_after` | `before update on reviews` | privacidad | Al salir de `active`, `purge_after := now() + interval '30 days'` |
| `enforce_reportable` | `before insert on review_reports` | FR-042, FR-052 | Solo se reporta una reseña activa **con comentario** |

**FR-025 (compromiso de respeto) se persiste** en `respect_acknowledged`, con un check que
exige `comment is null or respect_acknowledged`. En el formulario el control arranca
desmarcado; la columna existe porque D6 no cierra la Data API y un insert directo publicaría
un comentario sin haber pasado por él.

### Moderación sin consola (FR-051)

Tres funciones `security definer` con `execute` solo para `service_role`, invocadas desde
Studio. Son las tres decisiones de FR-047, ni una más:

```sql
public.moderation_keep(report_id uuid)                -- FR-033 escenario: se mantiene
public.moderation_remove(report_id uuid)              -- FR-048
public.moderation_ban(report_id uuid, reason text)    -- FR-056: elimina TODAS las reseñas del autor
public.deactivate_account(user_id uuid)               -- baja funcional a pedido (D3)
```

`moderation_ban` hace las dos cosas en una transacción: sella `banned_at`/`ban_reason` y
pasa a `removed_by_moderation` **todas** las reseñas activas del autor. Una sola función
evita que FR-056 se cumpla a medias.

`deactivate_account` es la baja a pedido: bloquea el inicio de sesión, pasa las reseñas a
eliminadas —lo que sella su `purge_after`— y limpia `career_id` y `term`. No borra la
fila de `auth.users` ni la de `profiles`.

**Un baneo y una baja no cierran la misma puerta.** La baja bloquea el login, que es lo que
el usuario pidió. El baneo no: FR-057 obliga a mostrarle al sancionado qué pasó y por qué,
y para leerlo tiene que poder entrar. En un baneo cierra RLS, no `auth`.

Acompaña un `docs/moderacion.md` con la consulta de bandeja de reportes pendientes, la
consulta de SC-009 (pares con al menos una puntuación, estudiantes únicos que
contribuyeron) y el procedimiento de baja de cuenta.

### Purga de 30 días

`pg_cron` diario → `public.purge_expired_reviews()`: borra físicamente las filas con
`purge_after < now()`. Es la condición 2 de publicación de
[politica-privacidad.md](politica-privacidad.md): mientras no exista, el documento promete
un borrado que no ocurre. La purga barre reseñas y nada más: la sanción vive en `profiles`
y no tiene `purge_after`.

### Por qué el baneo no toca el hook de signup

Un baneado no puede reaparecer como alguien nuevo, y no hace falta código: su fila de
`auth.users` nunca se borra y el correo es único ahí, así que volver a entrar con Google lo
devuelve a **la misma cuenta**, con su `banned_at` intacto. El hook `Before User Created`
se queda como está.

Esto se sostiene mientras la baja sea funcional. Si alguna vez se borra de verdad una fila
de `auth.users`, el `sub` desaparece y la sanción se evade: por eso el FK de `reviews` es
`restrict`, para que ese borrado sea un error de Postgres y no un agujero silencioso.

### API de la aplicación

Todo el acceso a datos pasa por route handlers en `src/app/api/`. El navegador no llama a
la Data API; los handlers sí, con `createClient()` de `src/lib/supabase/server.ts` — un
cliente por request, que lee la sesión de las cookies que `updateSession` ya refresca. Un
visitante sin sesión llega como `anon` y uno autenticado como `authenticated`, así que las
políticas de arriba se evalúan sin código extra.

| Método y ruta | Qué hace | Sesión |
|---|---|---|
| `GET /api/courses/[code]/summaries` | Promedios, % de recomendación y conteos de los docentes del curso | No |
| `GET /api/careers` | Catálogo de FR-017 | No |
| `GET /api/reviews?course=&teacher=` | Comentarios del par y la reseña propia si existe | Sí |
| `POST /api/reviews` | Publica una reseña | Sí |
| `PATCH /api/reviews/[id]` | Edita puntuación, recomendación o comentario | Sí |
| `DELETE /api/reviews/[id]` | Soft delete a `deleted_by_author` | Sí |
| `POST /api/reviews/[id]/reports` | Reporta una reseña | Sí |
| `GET` y `PATCH /api/profile` | Carrera y ciclo, y el estado de sanción | Sí |

**Qué compra**: un lugar donde validar entrada y responder errores en español; la
proyección de cada respuesta decidida en el servidor, de modo que `author_id` no sale
aunque una consulta lo traiga; el rate limit por IP que `src/proxy.ts` ya aplica a
`/api/*`; y una UI que no queda acoplada a nombres de tablas y vistas.

**Qué no compra**: cerrar la Data API. La publishable key viaja al navegador para el login,
así que PostgREST sigue siendo alcanzable con ella. Los handlers no son la frontera — lo
son RLS y los triggers.

**El baneo se responde, no se deja fallar (FR-057).** Cada handler restringido consulta el
perfil antes de operar y, si `banned_at` no es nulo, corta con `403` y un cuerpo
`{ banned: true, reason }`. `GET /api/profile` devuelve lo mismo para que la UI muestre el
motivo sin tener que provocar un error. Un rechazo de RLS es un fallo genérico y no alcanza
para FR-057.

El resumen se pide **por curso al desplegarlo**, no par por par: una llamada trae los
docentes de todas las secciones y se cachea en memoria mientras dure la pestaña.
**La caché se invalida en cada mutación**: publicar, editar o eliminar borra la entrada del
curso afectado y vuelve a pedirla. Sin eso SC-005 se rompe en la pestaña del propio autor,
que es donde más se nota.

### Estructura de archivos

```
supabase/migrations/
  NNNN_crear_esquema_de_resenas.sql       # tablas, enums, índices
  NNNN_politicas_de_resenas.sql           # RLS + is_banned()
  NNNN_reglas_de_resenas.sql              # triggers
  NNNN_vistas_publicas.sql                # teacher_course_summaries + review_comments
  NNNN_funciones_de_moderacion.sql        # + deactivate_account
  NNNN_purga_de_resenas_eliminadas.sql    # pg_cron
  NNNN_catalogo_de_carreras.sql           # las 16 de carreras-utec.md
  NNNN_oferta_2026_2.sql                  # generada: upsert de course_teachers
supabase/tests/
  resenas_rls.test.sql                    # pgTAP
src/lib/
  teacher-email.ts        # normalizador compartido (parse-pdf + generador de oferta + tests)
  reviews.ts              # consultas de los handlers contra Supabase; sin JSX
  api-client.ts           # fetch tipado a /api/* desde los componentes
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
src/app/api/
  courses/[code]/summaries/route.ts
  careers/route.ts
  reviews/route.ts
  reviews/[id]/route.ts
  reviews/[id]/reports/route.ts
  profile/route.ts
src/app/
  normas/page.tsx         # normas-comunidad.md
  privacidad/page.tsx     # politica-privacidad.md
  perfil/page.tsx
scripts/
  generate-offer-migration.js
```

La regla que ordena el reparto: **la lógica va a `src/lib/`, los `.tsx` quedan finos**. Es
lo que mantiene arriba el trinquete de coverage (ver [R1](#r1-el-trinquete-de-coverage-bloquea-el-ci)).

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
| *"Se eliminan también todas tus reseñas"* (baja de cuenta) | `deactivate_account`, en una transacción |
| *"El registro de la sanción se conserva… aunque pidas eliminar tu cuenta"* | La baja no borra `auth.users`, así que `profiles.banned_at` sobrevive |
| *"Conservas lo que ve cualquier visitante"* (baneado) | `is_banned()` no toca `teacher_course_summaries` |
| *"Puedes reportar cada reseña una sola vez"* | `unique (review_id, reporter_id)` |
| *"La eliminación es definitiva: ni siquiera su autor puede recuperarla"* | El `using` de la política de update exige `state = 'active'` |

### Cambios en la política

El commit de la recomendación y el diseño de la sanción abrieron cuatro huecos, ya cerrados
en [politica-privacidad.md](politica-privacidad.md):

1. **La recomendación** no figuraba entre los datos que se guardan al publicar ni entre los
   que se muestran junto a un comentario, y FR-035 la agregó a lo público.
2. **La declaración de experiencia** (`declared_attendance`, FR-021) se persiste y no
   estaba enumerada.
3. **La baja de cuenta.** El documento decía *"eliminar tu cuenta"*; con D3 la baja cierra
   el acceso y conserva la identidad.
4. **Los resúmenes anónimos.** *"Nada tuyo sale de tu navegador"* dejó de ser exacto: un
   visitante sin sesión le pide a Supabase los resúmenes del curso que despliega. Viaja ese
   curso y no la lista completa de los seleccionados, porque D1 consulta al desplegar.

---

## Decisiones

| # | Decisión | Descartado |
|---|---|---|
| D1 | `teacher_course_summaries` se consulta desde el cliente, una vez por curso al desplegarlo | Server Component: exige llevar la selección de `localStorage` a la URL |
| D2 | `comment_published_at` es la fecha visible de un comentario | `published_at`, que fecha en marzo un comentario escrito en julio |
| D3 | Baja funcional vía `deactivate_account`; sanción en `profiles.banned_at`, por `sub` | Borrado real de `auth.users`, que vuelve evadible el baneo |
| D4 | `course_teachers` se refresca por migración generada (`pnpm generate-offer`) | Script con service role contra producción |
| D5 | `courses.json` es la fuente; Postgres solo proyecta `course_teachers` | Migrar el catálogo entero a Postgres |
| D6 | El acceso a datos pasa por route handlers en `/api/*`, con el cliente de servidor de Supabase | Llamadas del navegador directo a la Data API |

### D1. `teacher_course_summaries` se consulta desde el cliente

Los cursos cuyos resúmenes hacen falta salen de `localStorage` y de cuál despliega el
usuario. Un Server Component no los conoce sin llevar la selección a la URL, y eso cambia
el modelo de estado de toda la app, que es lo que FR-012 y SC-001 piden no tocar. Convertir
`page.tsx` (473 líneas sobre `useSyncExternalStore`) en shell de servidor tampoco adelanta
la primera pintura: seguiría sin resúmenes hasta que el navegador diga qué cursos hay.

Revierte la parte de Server Component acordada en producto. La vista agregada se mantiene.

### D2. `comment_published_at` es la fecha visible de un comentario

FR-035 pide "la fecha de publicación" y FR-033 la define como la de la reseña. Con una
puntuación de marzo y un comentario de julio, esa fecha desinforma. La lista de comentarios
muestra `comment_published_at`; `published_at` queda para la reseña y para el límite de
FR-030.

### D3. Baja funcional y sanción por `sub`

La baja cierra el acceso y conserva la identidad: bloquea el login, elimina las reseñas con
su purga a 30 días, limpia carrera y ciclo y conserva la fila de `auth.users`.

Con el `sub` estable, la sanción cabe en dos columnas de `profiles` y `docs/auth.md` se
cumple sin excepción. Se caen la tabla `bans`, el `is_banned()` por correo y el cambio al
hook de signup.

**Costo**: "eliminar tu cuenta" significa cerrarla. Bajo la Ley 29733 es una supresión
débil, y el primer punto de la revisión legal pendiente.

### D4. `course_teachers` se refresca por migración generada

`pnpm generate-offer` emite `NNNN_oferta_AAAA_C.sql` con el upsert y el `is_current = false`
de los pares que salieron. Cuesta un archivo por actualización
([R6](#r6-la-oferta-cambia-dentro-del-ciclo-y-eso-apaga-reseñas)) y deja el cambio de oferta
versionado y revisable, sin service key fuera del CI.

### D5. `courses.json` es la fuente; Postgres solo proyecta `course_teachers`

Migrar el catálogo saca del loop de actualización el `git commit` y unos tres minutos de
deploy. No saca el parseo del PDF ni adelanta el aviso de UTEC, que es donde se va el
tiempo. Cuesta cuatro cosas:

- **El golden test** (`tests/parse-pdf.test.ts`): hoy un parseo malo rompe el CI; en base de
  datos lo descubre un alumno en matrícula.
- **Las invariantes** de `tests/courses-data.test.ts`.
- **El diff revisable**: las 360 sesiones con correo corrupto se revisan mirando el diff.
- **La garantía de `docs/auth.md`** de que la app corre sin variables de entorno. Armar el
  horario sobrevive hoy a que Supabase esté caído.

Los 862 KB del archivo son ~38 KB gzipeados en el bundle, así que el tamaño no pesa.

**Drift**: si alguien regenera el JSON y olvida la migración, la UI ofrece reseñar un par
que la FK rechaza. Lo cubre un vitest que compara los pares de la última migración de
oferta contra `courses.json`.

**Qué lo revisaría**: `enrolled` en vivo (hoy 0 en todo el JSON), o una feature que consulte
el catálogo del lado servidor. La frecuencia de cambio no, porque la cubre `pnpm diff-oferta`.

### D6. El acceso a datos pasa por route handlers

El navegador llama a `/api/*` y nunca a la Data API. Los handlers usan el cliente de
servidor que ya existe (`src/lib/supabase/server.ts`), así que no hay driver nuevo,
conexión que administrar ni RLS que reactivar a mano.

**Lo que no hace**: cerrar la Data API. La publishable key está en el navegador para el
login, así que PostgREST queda alcanzable con ella y RLS sigue siendo la frontera (R2). El
backend es convención de código, no perímetro.

Cerrarla exigiría conexión directa a Postgres con una `DATABASE_URL` server-only, pooler en
modo transacción y `set local role` más `set local request.jwt.claims` por transacción para
conservar RLS. Descartado por ahora.

---

## Riesgos

### R1. El trinquete de coverage bloquea el CI

El piso es `lines 27.02 / statements 26.69 / functions 24.68 / branches 16.3`, sobre
**porcentajes**. Los componentes React están en 0% y no hay jsdom ni testing-library.
~1500 líneas de `.tsx` sin tests hunden los cuatro números y el CI falla con el primer
componente.

**Mitigación**: lógica en `src/lib/` y `.tsx` finos. `review-format.ts`, `reviews.ts` y
`teacher-email.ts` son node-testables y compensan el JSX nuevo. Si no alcanza, montar
jsdom + testing-library. Se mide con el primer componente.

### R2. La frontera es RLS, no los handlers

D6 no cierra la Data API: sigue alcanzable con la publishable key, así que un error en una
política es una fuga de datos aunque todos los handlers estén bien. El pgTAP tiene que
cubrir, como mínimo:

- `anon` no lee ninguna fila de `reviews`;
- un autenticado tampoco lee la fila de la reseña de otro, solo su comentario por la vista;
- un usuario no ve la reseña que reportó;
- un baneado no lee nada, salvo su propio motivo;
- nadie edita la reseña de otro.

El segundo caso no da señal en la UI: se ve igual con `author_id` expuesto o sin él.

Y los handlers necesitan su propio test de proyección, por el mismo motivo.

### R3. El CI hoy no levanta Supabase

R2 exige un job con `supabase start` + `supabase test db`. Cuesta varios minutos de
pipeline y la CLI como dependencia nueva del runner.

### R4. Arranque en frío

Al deployar hay 619 pares en `Sin puntuaciones` y ninguna reseña. Los Non-Goals descartan
campañas e incentivos; SC-009 solo deja la consulta para medirlo.

### R5. Dependencias externas sin cerrar

`privacidad@mail.luismaquera.dev` tiene que recibir correo antes de publicar la política.
`pg_cron` tiene que estar habilitado en el proyecto. Ninguna de las dos es código.

### R6. La oferta cambia dentro del ciclo, y eso apaga reseñas

Hay cambios de horario y de docente en plena matrícula, contra el supuesto de oferta
estable del spec.

Un cambio de horario no toca las reseñas: están ancladas a `(curso, correo del docente)`,
no a la sección ni al bloque. Un cambio de docente saca ese par de la oferta, `is_current`
pasa a `false` y sus reseñas dejan de mostrarse.

**Resuelto**: se mantiene el apagado, asumido por escrito en el spec y en las normas de la
comunidad. La alternativa —dejar el par retirado en solo lectura con una nota— se descartó
por añadir un estado más a la interfaz para un caso de borde.

`pnpm diff-oferta` lista los pares que aparecen y desaparecen antes de sobreescribir
`courses.json`. Es el insumo del `is_current` y distingue un cambio real de un correo mal
parseado.

---

## Complexity Tracking

| Complejidad que se agrega | Por qué se acepta | Alternativa descartada |
|---|---|---|
| Dos vistas con semántica de definer | Es la única forma de dar agregados a `anon` y comentarios anónimos a `authenticated` sin abrir `reviews`. RLS filtra filas, no columnas | Grants por columna sobre `reviews`: filtrar por `author_id` exige poder leerlo, así que el autor perdería su propia reseña |
| 8 triggers | Cada uno impone un FR que RLS no alcanza. Los handlers no bastan: la Data API sigue alcanzable | Validar solo en el backend |
| 8 route handlers | Validación, proyección de respuestas y rate limit en un solo lugar (D6) | Llamadas directas del navegador: acoplan la UI al esquema |
| `course_teachers` materializada | Sostiene FR-028, FR-053 y FR-054 en la base, no en el navegador | Validar el par contra `courses.json` en el cliente: evadible con un `insert` directo |
| `deactivate_account` en vez de un `delete` | La baja funcional conserva la trazabilidad y hace permanente una expulsión (D3) | Borrado real: el `sub` desaparece y el baneo se evade pidiendo la baja y volviendo a entrar |
| pgTAP + job de CI nuevo | R2 | Confiar en revisión manual de políticas |
| 8 PRs | El esquema inicial de la app no cabe en un review honesto | PR único |

---

## Progress Tracking

- [x] Technical Context resuelto
- [x] Investigación de datos y del estado actual
- [x] Modelo de datos, RLS, triggers y contratos
- [x] Riesgos identificados
- [x] D1 … D6 documentadas y acordadas
- [x] Política de privacidad alineada con el diseño (sigue siendo borrador)
- [ ] **Plan revisado y aprobado**
- [ ] Las tres condiciones de publicación de la política, cumplidas. La segunda —la purga a los 30 días— ya está implementada; siguen abiertas el buzón `privacidad@mail.luismaquera.dev` y la revisión legal. Mientras tanto `/privacidad` existe y responde 404 (T099)
- [x] R6 resuelto: qué pasa con las reseñas de un docente reemplazado (se apagan con el par y reaparecen si vuelve a la oferta)
- [x] R1 medido con el primer componente: **no se disparó**. Con los cuatro `.tsx` de US1 dentro, el piso subió de `33.22 / 33.28 / 29.12 / 25.86` a `39.29 / 39.12 / 35.74 / 33.93`. Lo que lo sostiene es la regla de no dejar lógica testeable en el JSX: `src/lib/` quedó en 70.64 % y los componentes en 0 %, así que cada `.tsx` nuevo llega acompañado de un módulo que compensa de sobra. jsdom sigue sin hacer falta. Con US2 el piso volvió a subir, a `40.65 / 40.58 / 38.29 / 40.89`, y eso que entraron cuatro páginas y dos componentes más: `src/lib/` está en 77.36 %
- [x] Reparto en PRs (tabla en [tasks.md](tasks.md#reparto-en-prs))
- [ ] Esquema en producción. El proyecto ya está enlazado a `rlsswhwrigdgsboqakyw` y `supabase migration list` da las ocho migraciones pendientes; falta correr `supabase db push` (nunca con `--include-seed`)
