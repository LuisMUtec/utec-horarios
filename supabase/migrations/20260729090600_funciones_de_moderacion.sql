-- Las tres decisiones de FR-047 más la baja a pedido, invocables desde Studio
-- (FR-051). En el esquema private, inalcanzable por la Data API. Procedimiento
-- en docs/moderacion.md.

create or replace function private.moderation_keep(report_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.review_reports
  set status = 'kept', resolved_at = now()
  where id = report_id and status = 'pending';

  if not found then
    raise exception 'No hay un reporte pendiente con ese id.';
  end if;
end;
$$;

-- FR-048
create or replace function private.moderation_remove(report_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_review_id uuid;
begin
  select review_id into v_review_id
  from public.review_reports where id = report_id and status = 'pending';

  if v_review_id is null then
    raise exception 'No hay un reporte pendiente con ese id.';
  end if;

  update public.reviews
  set state = 'removed_by_moderation'
  where id = v_review_id and state = 'active';

  -- Todos los reportes de la reseña, no solo el revisado: si no, los demás
  -- reportantes seguirían sin verla por un `pending` que ya no significa nada.
  update public.review_reports
  set status = 'removed', resolved_at = now()
  where review_id = v_review_id and status = 'pending';
end;
$$;

-- FR-056. Sanción y eliminación de TODAS las reseñas del autor en una sola
-- transacción. No toca auth.users: el sancionado tiene que poder entrar a leer
-- el motivo (FR-057), así que en un baneo cierra RLS y no Auth.
create or replace function private.moderation_ban(report_id uuid, reason text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_author_id uuid;
begin
  if nullif(btrim(reason), '') is null then
    raise exception 'La sanción necesita un motivo: es lo que se le muestra al usuario.';
  end if;

  select r.author_id into v_author_id
  from public.review_reports rp
  join public.reviews r on r.id = rp.review_id
  where rp.id = report_id and rp.status = 'pending';

  if v_author_id is null then
    raise exception 'No hay un reporte pendiente con ese id.';
  end if;

  update public.profiles
  set banned_at = now(), ban_reason = btrim(reason)
  where id = v_author_id;

  update public.reviews
  set state = 'removed_by_moderation'
  where author_id = v_author_id and state = 'active';

  -- Sobre todas las reseñas del autor, no solo la reportada: las demás también
  -- dejaron de existir para el lector, y un pendiente sobre una reseña que ya
  -- no se ve solo ensucia la bandeja.
  update public.review_reports rp
  set status = 'removed', resolved_at = now()
  from public.reviews r
  where r.id = rp.review_id and r.author_id = v_author_id and rp.status = 'pending';
end;
$$;

-- Baja funcional (D3). banned_at y ban_reason no se tocan: si hubo sanción,
-- sobrevive.
create or replace function private.deactivate_account(user_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.profiles where id = user_id) then
    raise exception 'No existe un perfil con ese id.';
  end if;

  update auth.users
  set banned_until = 'infinity'::timestamptz
  where id = user_id;

  update public.reviews
  set state = 'deleted_by_author'
  where author_id = user_id and state = 'active';

  update public.review_reports rp
  set status = 'removed', resolved_at = now()
  from public.reviews r
  where r.id = rp.review_id and r.author_id = user_id and rp.status = 'pending';

  update public.profiles
  set career_id = null, term = null, deactivated_at = now()
  where id = user_id;
end;
$$;

revoke execute on function
  private.moderation_keep(uuid),
  private.moderation_remove(uuid),
  private.moderation_ban(uuid, text),
  private.deactivate_account(uuid)
from public, anon, authenticated;

grant execute on function
  private.moderation_keep(uuid),
  private.moderation_remove(uuid),
  private.moderation_ban(uuid, text),
  private.deactivate_account(uuid)
to service_role;
