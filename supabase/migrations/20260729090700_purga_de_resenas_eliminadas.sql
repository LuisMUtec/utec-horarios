-- Borrado real a los 30 días. Condición 2 de publicación de
-- politica-privacidad.md. Barre reseñas y nada más: la sanción vive en
-- profiles y no tiene purge_after.

create or replace function private.purge_expired_reviews()
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_deleted integer;
begin
  delete from public.reviews
  where purge_after is not null and purge_after < now();

  get diagnostics v_deleted = row_count;
  -- cron.job_run_details no guarda el valor de retorno: sin esto, la única
  -- huella de la corrida nocturna es que el job no falló.
  raise log 'purge_expired_reviews: % reseñas borradas', v_deleted;
  return v_deleted;
end;
$$;

revoke execute on function private.purge_expired_reviews() from public, anon, authenticated;
grant execute on function private.purge_expired_reviews() to service_role;

-- pg_cron no es relocalizable: la extensión va a pg_catalog y sus funciones al
-- esquema `cron`. Tolerante a que no esté disponible, para que la migración
-- aplique igual donde no lo esté; que el job quede programado en producción lo
-- verifica T098.
do $$
begin
  create extension if not exists pg_cron;

  -- `unschedule` falla si el job no existe, así que va en su propio bloque para
  -- que reprogramar sea idempotente.
  begin
    perform cron.unschedule('purgar-resenas-eliminadas');
  exception when others then
    null;
  end;

  perform cron.schedule(
    'purgar-resenas-eliminadas',
    '17 4 * * *',
    $cron$select private.purge_expired_reviews();$cron$
  );
exception when others then
  raise warning 'pg_cron no disponible: la purga queda sin programar. %', sqlerrm;
end;
$$;
