-- Reglas que RLS no alcanza: cuentan filas, comparan contra otra tabla o
-- dependen del estado anterior. En triggers para que sean inevadibles también
-- por la Data API. Los mensajes llegan al usuario, así que van en español.

-- El perfil existe desde el primer login: así el formulario siempre tiene fila
-- que actualizar y no hace falta política de insert sobre profiles.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Un comentario de solo espacios es una reseña sin comentario. Numerados para
-- que este corra primero: los demás miran `comment` ya normalizado.
create or replace function public.normalize_review() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.comment := nullif(btrim(new.comment), '');
  new.updated_at := now();
  return new;
end;
$$;

create trigger review_00_normalize
  before insert or update on public.reviews
  for each row execute function public.normalize_review();

-- FR-028. La FK ya exige que el par exista; esto agrega que esté vigente.
create or replace function public.enforce_current_pair() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.course_teachers
    where id = new.course_teacher_id and is_current
  ) then
    raise exception 'Ese docente ya no dicta este curso en la oferta vigente.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger review_10_current_pair
  before insert on public.reviews
  for each row execute function public.enforce_current_pair();

-- FR-030. Cuenta filas creadas, no activas: borrar no libera cupo. El mensaje
-- incluye el instante de liberación porque FR-031 lo exige y solo se sabe acá.
create or replace function public.enforce_daily_rating_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_limit  constant int := 8;
  v_count  int;
  v_oldest timestamptz;
begin
  select count(*), min(published_at)
    into v_count, v_oldest
  from public.reviews
  where author_id = new.author_id
    and published_at > now() - interval '24 hours';

  if v_count >= v_limit then
    raise exception 'Alcanzaste el límite de % puntuaciones en 24 horas. Podrás publicar de nuevo a partir de %.',
      v_limit, to_char(v_oldest + interval '24 hours', 'YYYY-MM-DD"T"HH24:MI:SSOF')
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger review_20_daily_limit
  before insert on public.reviews
  for each row execute function public.enforce_daily_rating_limit();

-- FR-017: carrera y ciclo se exigen para comentar, no para puntuar.
create or replace function public.enforce_comment_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.comment is not null and not exists (
    select 1 from public.profiles
    where id = new.author_id and career_id is not null and term is not null
  ) then
    raise exception 'Completa tu carrera y tu ciclo antes de escribir un comentario.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger review_30_comment_profile
  before insert or update on public.reviews
  for each row execute function public.enforce_comment_profile();

-- FR-064 y FR-055. `published_at` nunca se toca. Borrar el texto no borra
-- comment_published_at: si el autor lo reescribe es el mismo comentario
-- retomado, y la fecha visible sigue siendo la original.
create or replace function public.stamp_review_timestamps() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.comment is not null and old.comment_published_at is null then
    new.comment_published_at := now();
    new.comment_edited_at := null;
  elsif new.comment is not null
    and old.comment_published_at is not null
    and new.comment is distinct from old.comment then
    new.comment_edited_at := now();
  end if;
  return new;
end;
$$;

create trigger review_40_stamp_timestamps
  before update on public.reviews
  for each row execute function public.stamp_review_timestamps();

-- Un comentario publicado junto con la reseña necesita su sello ya en el
-- insert, donde el trigger de update no llega.
create or replace function public.stamp_comment_on_insert() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.comment is not null then
    new.comment_published_at := coalesce(new.comment_published_at, now());
  end if;
  return new;
end;
$$;

create trigger review_40_stamp_on_insert
  before insert on public.reviews
  for each row execute function public.stamp_comment_on_insert();

-- Los 30 días de retención de politica-privacidad.md.
create or replace function public.stamp_purge_after() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.state <> 'active' and old.state = 'active' then
    new.purge_after := now() + interval '30 days';
  end if;
  return new;
end;
$$;

create trigger review_50_purge_after
  before update on public.reviews
  for each row execute function public.stamp_purge_after();

-- FR-042, FR-052: solo se reporta una reseña activa con comentario.
create or replace function public.enforce_reportable() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.reviews
    where id = new.review_id and state = 'active' and comment is not null
  ) then
    raise exception 'Esa reseña no se puede reportar.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger report_10_reportable
  before insert on public.review_reports
  for each row execute function public.enforce_reportable();

create or replace function public.touch_profile() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profile_touch
  before update on public.profiles
  for each row execute function public.touch_profile();
