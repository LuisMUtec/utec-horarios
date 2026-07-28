-- Datos de desarrollo. Corre después de las migraciones cada vez que hagas
-- `supabase db reset` (y en el primer `supabase start`).
--
-- CUIDADO: `supabase db push` no lo sube, pero `supabase db push --include-seed`
-- SÍ lo ejecuta contra la base remota. Nunca uses ese flag apuntando a
-- producción: crearía estos usuarios con contraseñas conocidas y públicas.

-- Estudiantes de prueba, con contraseña, para tener filas de `auth.users` con
-- las que trabajar desde la API o Studio sin pasar por Google:
--
--   estudiante@utec.edu.pe  / horarios123
--   companera@utec.edu.pe   / horarios123
--
-- Los insertamos directo en `auth.users` en vez de llamar a la API de signup
-- porque el seed corre contra la base, sin Auth levantado todavía. Eso saltea
-- el hook de dominio: por eso los correos ya son @utec.edu.pe, para que el
-- estado sembrado sea uno que el hook habría aceptado.
--
-- Los UUID son fijos a propósito: así el seed es idempotente entre resets y
-- puedes referenciarlos desde otros seeds o desde pruebas manuales.
-- Ojo con las cuatro columnas de token en '': son NULL por defecto, pero GoTrue
-- las lee como string no-nullable y un NULL le revienta el login con un 500
-- "Database error querying schema". El signup real las escribe vacías.
insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  confirmation_token,
  recovery_token,
  email_change,
  email_change_token_new,
  created_at,
  updated_at
)
select
  '00000000-0000-0000-0000-000000000000',
  estudiante.id,
  'authenticated',
  'authenticated',
  estudiante.email,
  extensions.crypt('horarios123', extensions.gen_salt('bf')),
  now(),
  '{"provider": "email", "providers": ["email"]}',
  '{}',
  '',
  '',
  '',
  '',
  now(),
  now()
from (
  values
    ('00000000-0000-0000-0000-00000000da01'::uuid, 'estudiante@utec.edu.pe'),
    ('00000000-0000-0000-0000-00000000da02'::uuid, 'companera@utec.edu.pe')
) as estudiante (id, email)
on conflict (id) do nothing;

-- Sin la identidad `email` correspondiente, GoTrue no encuentra al usuario al
-- iniciar sesión y devuelve "Invalid login credentials".
insert into auth.identities (
  provider_id,
  user_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
select
  u.id::text,
  u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  'email',
  now(),
  now(),
  now()
from auth.users u
where u.id in (
  '00000000-0000-0000-0000-00000000da01',
  '00000000-0000-0000-0000-00000000da02'
)
on conflict (provider, provider_id) do nothing;
