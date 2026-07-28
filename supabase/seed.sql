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

-- ---------------------------------------------------------------------------
-- Reseñas de docentes
-- ---------------------------------------------------------------------------
--
-- Un tercer estudiante, sancionado, para poder ver FR-057 sin banear a mano.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change, email_change_token_new,
  created_at, updated_at
)
values (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-00000000da03',
  'authenticated', 'authenticated',
  'sancionado@utec.edu.pe',
  extensions.crypt('horarios123', extensions.gen_salt('bf')),
  now(),
  '{"provider": "email", "providers": ["email"]}', '{}',
  '', '', '', '',
  now(), now()
)
on conflict (id) do nothing;

insert into auth.identities (
  provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
)
select u.id::text, u.id,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       'email', now(), now(), now()
from auth.users u
where u.id = '00000000-0000-0000-0000-00000000da03'
on conflict (provider, provider_id) do nothing;

-- handle_new_user ya creó los tres perfiles; acá solo se completan.
update public.profiles p
set career_id = c.id, term = v.term
from (values
  ('00000000-0000-0000-0000-00000000da01'::uuid, 'ciencia-de-la-computacion', 7::smallint),
  ('00000000-0000-0000-0000-00000000da02'::uuid, 'ingenieria-industrial',     5::smallint)
) as v (id, slug, term)
join public.careers c on c.slug = v.slug
where p.id = v.id;

update public.profiles
set banned_at = now() - interval '2 days',
    ban_reason = 'Ataque personal contra un docente en una reseña.'
where id = '00000000-0000-0000-0000-00000000da03';

-- Cuatro estados visibles sobre pares reales de AD6100 y CS2023:
--   kneira    varias puntuaciones y comentarios
--   jvalencia una sola puntuación (edge case del promedio con n = 1)
--   fvilela   sin puntuaciones
--   lromeroc  un comentario con un reporte pendiente
insert into public.reviews (
  id, author_id, course_teacher_id, rating, recommends, comment,
  declared_attendance, respect_acknowledged, published_at, comment_published_at
)
select v.id, v.author_id, ct.id, v.rating, v.recommends, v.comment, true, v.comment is not null,
       now() - v.age,
       case when v.comment is not null then now() - v.age end
from (values
  ('00000000-0000-0000-0000-0000000000e1'::uuid, '00000000-0000-0000-0000-00000000da01'::uuid,
   'AD6100', 'kneira@utec.edu.pe',    5::smallint, true,
   'Explica con ejemplos concretos y responde dudas fuera de clase.', interval '20 days'),
  ('00000000-0000-0000-0000-0000000000e2'::uuid, '00000000-0000-0000-0000-00000000da02'::uuid,
   'AD6100', 'kneira@utec.edu.pe',    4::smallint, true,
   null, interval '15 days'),
  ('00000000-0000-0000-0000-0000000000e3'::uuid, '00000000-0000-0000-0000-00000000da02'::uuid,
   'AD6100', 'jvalencia@utec.edu.pe', 2::smallint, false,
   null, interval '10 days'),
  ('00000000-0000-0000-0000-0000000000e4'::uuid, '00000000-0000-0000-0000-00000000da01'::uuid,
   'CS2023', 'lromeroc@utec.edu.pe',  3::smallint, true,
   'Buen curso, pero las evaluaciones no se parecen a las prácticas.', interval '5 days')
) as v (id, author_id, course_code, teacher_email, rating, recommends, comment, age)
join public.course_teachers ct
  on ct.course_code = v.course_code and ct.teacher_email = v.teacher_email
on conflict (id) do nothing;

-- El reporte lo hace el otro estudiante: para él la reseña r4 desaparece y para
-- el resto sigue visible (FR-046).
insert into public.review_reports (review_id, reporter_id, reason, details)
values (
  '00000000-0000-0000-0000-0000000000e4',
  '00000000-0000-0000-0000-00000000da02',
  'not_an_experience',
  null
)
on conflict (review_id, reporter_id) do nothing;
