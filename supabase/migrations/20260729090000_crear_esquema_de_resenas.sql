-- Esquema de reseñas de docentes por curso.
-- Diseño y decisiones: specs/002-resenas-docentes/plan.md

-- FR-017
create table public.careers (
  id        uuid primary key default gen_random_uuid(),
  slug      text unique not null check (slug ~ '^[a-z0-9-]+$'),
  name      text not null,
  faculty   text not null,
  is_active boolean not null default true
);

-- `restrict` en las FK a auth.users: la baja es funcional, así que borrar esa
-- fila no es parte de ningún flujo. Con cascade, un borrado manual se llevaría
-- la sanción y las reseñas, que es justo lo que tiene que sobrevivir.
create table public.profiles (
  id             uuid primary key references auth.users(id) on delete restrict,
  career_id      uuid references public.careers(id),
  term           smallint check (term between 1 and 10),
  banned_at      timestamptz,
  ban_reason     text,
  deactivated_at timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  -- FR-057 no tiene qué mostrar con un motivo vacío o en blanco.
  constraint ban_has_reason check (
    (banned_at is null and ban_reason is null)
    or (banned_at is not null and nullif(btrim(ban_reason), '') is not null)
  )
);

-- Lista blanca de pares reseñables (FR-028, FR-053, FR-054). La llave natural
-- es (course_code, teacher_email); por las FK viaja `id`, para que corregir un
-- correo mal parseado sea un update de una fila.
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
  author_id            uuid not null references auth.users(id) on delete restrict,
  course_teacher_id    uuid not null references public.course_teachers(id) on delete restrict,
  rating               smallint not null check (rating between 1 and 5),
  recommends           boolean not null,                                    -- FR-061
  comment              text check (comment is null or length(comment) between 1 and 500),
  declared_attendance  boolean not null check (declared_attendance),        -- FR-021
  respect_acknowledged boolean not null default false,                      -- FR-025
  state                public.review_state not null default 'active',
  published_at         timestamptz not null default now(),                  -- FR-033
  comment_published_at timestamptz,                                         -- FR-064
  comment_edited_at    timestamptz,                                         -- FR-055
  updated_at           timestamptz not null default now(),
  purge_after          timestamptz,
  constraint comment_needs_acknowledgement
    check (comment is null or respect_acknowledged)
);

-- FR-027. Parcial, para que las eliminadas no bloqueen volver a reseñar.
create unique index reviews_one_active_per_pair
  on public.reviews (author_id, course_teacher_id)
  where state = 'active';

create index reviews_by_pair on public.reviews (course_teacher_id) where state = 'active';
create index reviews_by_author_recent on public.reviews (author_id, published_at desc);
create index reviews_pending_purge on public.reviews (purge_after) where purge_after is not null;

create type public.report_reason as enum
  ('insult', 'false_content', 'personal_data', 'not_an_experience', 'spam', 'other');
create type public.report_status as enum ('pending', 'kept', 'removed');

create table public.review_reports (
  id          uuid primary key default gen_random_uuid(),
  review_id   uuid not null references public.reviews(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete restrict,
  reason      public.report_reason not null,
  details     text,
  status      public.report_status not null default 'pending',
  created_at  timestamptz not null default now(),
  resolved_at timestamptz,
  unique (review_id, reporter_id),                                          -- FR-045
  constraint other_needs_details                                            -- FR-044
    check (reason <> 'other' or nullif(btrim(details), '') is not null)
);

-- El `not exists` de review_comments (FR-046) se resuelve por este índice.
create index review_reports_pending_by_reporter
  on public.review_reports (reporter_id, review_id)
  where status = 'pending';

create index review_reports_pending on public.review_reports (created_at) where status = 'pending';
