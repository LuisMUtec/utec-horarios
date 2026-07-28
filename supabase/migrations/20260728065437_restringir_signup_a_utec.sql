-- Hook "Before User Created": allowlist estricta de un solo dominio.
-- Corre solo al crear el usuario, así que el callback valida el dominio otra vez.
create or replace function public.hook_restrict_signup_to_utec(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_domain text := split_part(lower(event->'user'->>'email'), '@', 2);
begin
  if v_domain = 'utec.edu.pe' then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object(
    'error', jsonb_build_object(
      'message', 'Solo se permiten cuentas @utec.edu.pe.',
      'http_code', 403
    )
  );
end;
$$;

grant execute on function public.hook_restrict_signup_to_utec(jsonb) to supabase_auth_admin;
revoke execute on function public.hook_restrict_signup_to_utec(jsonb) from authenticated, anon, public;
