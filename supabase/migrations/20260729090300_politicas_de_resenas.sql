-- RLS de reseñas. Es la frontera de seguridad, no los handlers de /api/* (R2).
--
-- Los grants van explícitos: en una tabla nueva Supabase solo concede
-- REFERENCES, TRIGGER y TRUNCATE a anon y authenticated, así que sin esto las
-- políticas de abajo no llegan a evaluarse nunca. Se conceden solo los verbos
-- que alguna política habilita — en reviews no hay delete, y por eso tampoco
-- grant.

alter table public.profiles        enable row level security;
alter table public.reviews         enable row level security;
alter table public.review_reports  enable row level security;
alter table public.course_teachers enable row level security;
alter table public.careers         enable row level security;

grant select         on public.careers         to anon, authenticated;
grant select         on public.course_teachers to anon, authenticated;
grant select         on public.profiles        to authenticated;
grant select         on public.reviews         to authenticated;
grant select, insert on public.review_reports  to authenticated;

-- En `reviews` los grants son POR COLUMNA, y no es una cortesía de diseño: con
-- update de tabla, el autor reescribe `published_at` de sus 8 reseñas 48 horas
-- atrás y publica la novena — el límite de FR-030 queda evadido a voluntad. Con
-- insert de tabla es peor: 20 filas antedatadas en un solo statement no tocan
-- ninguna ventana. También quedarían a su alcance `purge_after` (los 30 días de
-- retención), `comment_edited_at` (la marca `editado` de FR-055) y
-- `course_teacher_id` (mover una reseña a otro docente).
--
-- El `with check` de la política no puede cerrarlo: RLS no ve la fila vieja.
grant insert (author_id, course_teacher_id, rating, recommends, comment,
              declared_attendance, respect_acknowledged)
  on public.reviews to authenticated;

-- Solo lo que FR-037 y FR-025 dejan editar. `state` no está: eliminar pasa por
-- `public.delete_own_review`, así que el autor no necesita tocarlo, y sin el
-- grant tampoco puede resucitar nada. Las columnas de fecha las sellan los
-- triggers, que no pasan por los privilegios del invocador.
grant update (rating, recommends, comment, respect_acknowledged)
  on public.reviews to authenticated;

-- Igual en profiles, donde FR-017 solo necesita dos columnas: con update de
-- tabla quedan escribibles `ban_reason`, `deactivated_at` y `created_at`, y el
-- `with check` de la política únicamente fija `id` y `banned_at`.
grant update (career_id, term) on public.profiles to authenticated;

grant all on public.careers, public.course_teachers, public.profiles,
             public.reviews, public.review_reports
  to service_role;

-- Catálogos: lectura pública, escritura solo por service_role (sin política).
--
-- `is_active` no filtra acá a propósito: un perfil que apunta a una carrera dada
-- de baja tiene que seguir resolviendo su nombre. Lo que acota es el selector.
create policy "careers son públicas" on public.careers
  for select to anon, authenticated using (true);

create policy "la oferta vigente es pública" on public.course_teachers
  for select to anon, authenticated using (is_current);

-- Las funciones security definer van fuera de `public`: config.toml solo expone
-- public y graphql_public, así que en `private` no son alcanzables por la Data
-- API ni aunque alguien conceda execute de más. Desde las políticas se llaman
-- cualificadas, que es todo lo que hace falta.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

-- FR-049. `(select auth.uid())` para que el planner lo evalúe una vez por
-- consulta y no una vez por fila; igual en todas las políticas de abajo.
create or replace function private.is_banned() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and banned_at is not null
  );
$$;

revoke execute on function private.is_banned() from public;
grant execute on function private.is_banned() to authenticated;

-- Sin is_banned(): de acá sale el motivo que FR-057 le tiene que mostrar al
-- sancionado.
create policy "cada quien ve su perfil" on public.profiles
  for select to authenticated using (id = (select auth.uid()));

create policy "cada quien edita su perfil" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) and not private.is_banned())
  with check (id = (select auth.uid()) and banned_at is null);

-- Sin insert (lo crea handle_new_user) ni delete (la baja es funcional).

-- Única política de select sobre reviews: la fila propia. Los comentarios
-- ajenos se leen por review_comments, que no expone author_id.
create policy "cada quien ve sus propias reseñas activas" on public.reviews
  for select to authenticated
  using (
    author_id = (select auth.uid())
    and state = 'active'
    and not private.is_banned()
  );

create policy "publicar reseñas propias" on public.reviews
  for insert to authenticated with check (
    author_id = (select auth.uid()) and state = 'active' and not private.is_banned()
  );

-- FR-037/FR-048: el `using` mira la fila vieja, así que exigir state='active'
-- ahí es lo que impide restaurar una reseña eliminada por moderación.
create policy "editar la reseña propia activa" on public.reviews
  for update to authenticated
  using (author_id = (select auth.uid()) and state = 'active' and not private.is_banned())
  with check (author_id = (select auth.uid()) and state = 'active');

-- Sin política de delete: eliminar es un update a 'deleted_by_author'
-- (FR-039, FR-040), y ese update pasa por la función de abajo.

-- FR-039. Postgres aplica la política de SELECT también a la fila RESULTANTE de
-- un update, así que con `state = 'active'` ahí el propio autor no puede
-- transicionar su reseña a eliminada: medido, da "new row violates row-level
-- security policy". Relajar esa política rompería la promesa de la política de
-- privacidad de que durante 30 días "ya no la ve nadie", su autor incluido.
--
-- Va en `public` y no en `private` porque tiene que ser alcanzable por la Data
-- API, que solo expone public. La comprobación de propiedad es explícita: como
-- es security definer, RLS no la protege.
create or replace function public.delete_own_review(review_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.reviews
  set state = 'deleted_by_author'
  where id = review_id
    and author_id = (select auth.uid())
    and state = 'active'
    and not private.is_banned();

  if not found then
    raise exception 'No tienes una reseña activa con ese id.';
  end if;
end;
$$;

revoke execute on function public.delete_own_review(uuid) from public, anon;
grant execute on function public.delete_own_review(uuid) to authenticated;

create policy "reportar" on public.review_reports
  for insert to authenticated with check (
    reporter_id = (select auth.uid()) and not private.is_banned()
  );

create policy "ver los reportes propios" on public.review_reports
  for select to authenticated using (reporter_id = (select auth.uid()));
