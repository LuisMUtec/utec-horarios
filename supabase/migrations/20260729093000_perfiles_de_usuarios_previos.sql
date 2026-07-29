-- `on_auth_user_created` crea el perfil al firmar, pero solo para quien firma
-- *después* de la migración que instaló el trigger. Quien ya tenía cuenta se
-- quedó sin fila en `profiles`, y para esa persona todo handler restringido
-- responde 503: `resolveStudent` lee el perfil con `single()` y no encuentra
-- nada, que es una inconsistencia real y por eso lanza.
--
-- En local no se ve nunca, porque `db reset` aplica las migraciones sobre una
-- base vacía y después siembra los usuarios, siempre en ese orden. Apareció al
-- iniciar sesión en producción con una cuenta creada el día anterior.
insert into public.profiles (id)
select id from auth.users
on conflict (id) do nothing;
